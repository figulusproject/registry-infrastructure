package lib

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/dop251/goja"
	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
)

// resolvePromise resolves a promise with the given value
func resolvePromise(rt *goja.Runtime, value goja.Value) goja.Value {
	promise, resolve, _ := rt.NewPromise()
	resolve(value)
	return rt.ToValue(promise)
}

// rejectPromise rejects a promise with the given error message
func rejectPromise(rt *goja.Runtime, msg string) goja.Value {
	promise, _, reject := rt.NewPromise()
	reject(rt.NewGoError(fmt.Errorf(msg)))
	return rt.ToValue(promise)
}

// InjectHelpers injects the __goHelpers object into the Goja runtime
func InjectHelpers(rt *goja.Runtime, repoRoot string, localUsername string, settingsJSON string) error {
	helpers := rt.NewObject()

	// Parse registry URL from settings
	registryURL := "https://registry.figulus.net"
	var settings map[string]interface{}
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err == nil {
		if registry, ok := settings["registry"].(map[string]interface{}); ok {
			if url, ok := registry["url"].(string); ok {
				registryURL = url
			}
		}
	}

	// fs object
	fsObj := rt.NewObject()

	// fs.readFileAsUtf8
	fsObj.Set("readFileAsUtf8", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) < 1 {
			return rt.ToValue("")
		}
		path := call.Arguments[0].String()

		content, err := os.ReadFile(path)
		if err != nil {
			return rt.ToValue("")
		}

		return rt.ToValue(string(content))
	})

	// fs.fileOrDirExists
	fsObj.Set("fileOrDirExists", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) < 1 {
			return rt.ToValue(false)
		}
		path := call.Arguments[0].String()
		fullPath := path
		if !filepath.IsAbs(path) {
			fullPath = filepath.Join(repoRoot, path)
		}

		_, err := os.Stat(fullPath)
		exists := err == nil
		return rt.ToValue(exists)
	})

	// fs.resolvePath
	fsObj.Set("resolvePath", func(call goja.FunctionCall) goja.Value {
		paths := make([]string, len(call.Arguments))
		for i, arg := range call.Arguments {
			paths[i] = arg.String()
		}

		joined := filepath.Join(paths...)
		absPath, err := filepath.Abs(joined)
		if err != nil {
			return rt.ToValue(joined)
		}
		return rt.ToValue(absPath)
	})

	// fs.splitPath
	fsObj.Set("splitPath", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) < 1 {
			return rt.ToValue([]string{})
		}
		path := call.Arguments[0].String()

		// Replace backslashes with forward slashes and split
		path = strings.ReplaceAll(path, "\\", "/")
		parts := strings.Split(path, "/")

		// Convert to goja array
		arr := rt.NewArray()
		for i, part := range parts {
			arr.Set(fmt.Sprintf("%d", i), rt.ToValue(part))
		}
		return arr
	})

	helpers.Set("fs", fsObj)

	// crypto object
	cryptoObj := rt.NewObject()

	// crypto.createSha256HexHash
	cryptoObj.Set("createSha256HexHash", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) < 1 {
			return rt.ToValue("")
		}
		data := call.Arguments[0].String()

		hash := sha256.Sum256([]byte(data))
		hexHash := hex.EncodeToString(hash[:])
		return rt.ToValue(hexHash)
	})

	helpers.Set("crypto", cryptoObj)

	// registry object
	registryObj := rt.NewObject()

	// registry.getSettings
	registryObj.Set("getSettings", func(call goja.FunctionCall) goja.Value {
		client := &http.Client{
			Timeout: 10 * time.Second,
		}

		url := registryURL + "/raw/refs/heads/main/settings.json"
		resp, err := client.Get(url)
		if err != nil {
			return resolvePromise(rt, rt.ToValue("{}"))
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return resolvePromise(rt, rt.ToValue("{}"))
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return resolvePromise(rt, rt.ToValue("{}"))
		}

		return resolvePromise(rt, rt.ToValue(string(body)))
	})

	// registry.showHead
	registryObj.Set("showHead", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) < 1 {
			return rejectPromise(rt, "showHead: missing filePath argument")
		}
		filePath := call.Arguments[0].String()

		repo, err := git.PlainOpen(repoRoot)
		if err != nil {
			return rejectPromise(rt, fmt.Sprintf("showHead: failed to open repo: %v", err))
		}

		ref, err := repo.Head()
		if err != nil {
			return rejectPromise(rt, fmt.Sprintf("showHead: failed to get HEAD: %v", err))
		}

		commit, err := repo.CommitObject(ref.Hash())
		if err != nil {
			return rejectPromise(rt, fmt.Sprintf("showHead: failed to get commit: %v", err))
		}

		tree, err := commit.Tree()
		if err != nil {
			return rejectPromise(rt, fmt.Sprintf("showHead: failed to get tree: %v", err))
		}

		file, err := tree.File(filePath)
		if err != nil {
			return rejectPromise(rt, fmt.Sprintf("showHead: file not found: %v", err))
		}

		content, err := file.Contents()
		if err != nil {
			return rejectPromise(rt, fmt.Sprintf("showHead: failed to read file: %v", err))
		}

		return resolvePromise(rt, rt.ToValue(content))
	})

	// registry.getAllPRs (returns commits as PR-shaped objects)
	registryObj.Set("getAllPRs", func(call goja.FunctionCall) goja.Value {
		repo, err := git.PlainOpen(repoRoot)
		if err != nil {
			return rejectPromise(rt, fmt.Sprintf("getAllPRs: failed to open repo: %v", err))
		}

		ref, err := repo.Head()
		if err != nil {
			return rejectPromise(rt, fmt.Sprintf("getAllPRs: failed to get HEAD: %v", err))
		}

		iter, err := repo.Log(&git.LogOptions{From: ref.Hash()})
		if err != nil {
			return rejectPromise(rt, fmt.Sprintf("getAllPRs: failed to get log: %v", err))
		}
		defer iter.Close()

		arr := rt.NewArray()
		idx := 0

		err = iter.ForEach(func(c *object.Commit) error {
			prObj := rt.NewObject()
			prObj.Set("url", rt.ToValue(c.Hash.String()))
			prObj.Set("created_at", rt.ToValue(c.Author.When.Format(time.RFC3339)))

			userObj := rt.NewObject()
			userObj.Set("id", rt.ToValue(localUsername))
			prObj.Set("user", userObj)

			arr.Set(fmt.Sprintf("%d", idx), prObj)
			idx++
			return nil
		})

		if err != nil {
			return rejectPromise(rt, fmt.Sprintf("getAllPRs: %v", err))
		}

		return resolvePromise(rt, arr)
	})

	// registry.getPRFiles
	registryObj.Set("getPRFiles", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) < 1 {
			return rejectPromise(rt, "getPRFiles: missing url argument")
		}
		commitHash := call.Arguments[0].String()

		repo, err := git.PlainOpen(repoRoot)
		if err != nil {
			return rejectPromise(rt, fmt.Sprintf("getPRFiles: failed to open repo: %v", err))
		}

		// Parse the commit hash
		hash := plumbing.NewHash(commitHash)

		commit, err := repo.CommitObject(hash)
		if err != nil {
			return rejectPromise(rt, fmt.Sprintf("getPRFiles: failed to get commit: %v", err))
		}

		// Get the parent commit
		var parentTree *object.Tree
		if commit.NumParents() > 0 {
			parent, err := commit.Parent(0)
			if err != nil {
				return rejectPromise(rt, fmt.Sprintf("getPRFiles: failed to get parent: %v", err))
			}
			parentTree, err = parent.Tree()
			if err != nil {
				return rejectPromise(rt, fmt.Sprintf("getPRFiles: failed to get parent tree: %v", err))
			}
		}

		commitTree, err := commit.Tree()
		if err != nil {
			return rejectPromise(rt, fmt.Sprintf("getPRFiles: failed to get commit tree: %v", err))
		}

		// Diff the trees
		changes, err := object.DiffTree(parentTree, commitTree)
		if err != nil {
			return rejectPromise(rt, fmt.Sprintf("getPRFiles: failed to diff trees: %v", err))
		}

		arr := rt.NewArray()
		idx := 0

		for _, change := range changes {
			fileObj := rt.NewObject()

			// Get the "To" path (the current filename, or "From" if it's a deletion)
			path := change.To.Name
			if path == "" && change.From.Name != "" {
				path = change.From.Name
			}

			fileObj.Set("filename", rt.ToValue(path))
			arr.Set(fmt.Sprintf("%d", idx), fileObj)
			idx++
		}

		return resolvePromise(rt, arr)
	})

	helpers.Set("registry", registryObj)

	// console object
	consoleObj := rt.NewObject()

	// console.log
	consoleObj.Set("log", func(call goja.FunctionCall) goja.Value {
		parts := make([]string, len(call.Arguments))
		for i, arg := range call.Arguments {
			parts[i] = fmt.Sprint(arg)
		}
		fmt.Println(strings.Join(parts, " "))
		return goja.Undefined()
	})

	// console.error
	consoleObj.Set("error", func(call goja.FunctionCall) goja.Value {
		parts := make([]string, len(call.Arguments))
		for i, arg := range call.Arguments {
			parts[i] = fmt.Sprint(arg)
		}
		fmt.Fprintln(os.Stderr, strings.Join(parts, " "))
		return goja.Undefined()
	})

	helpers.Set("console", consoleObj)

	// Set the __goHelpers global
	rt.Set("__goHelpers", helpers)

	return nil
}
