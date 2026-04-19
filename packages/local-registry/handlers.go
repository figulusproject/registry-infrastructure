package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/figulusproject/registry-infrastructure/validator-goja/lib"
)

// Global staging area for files pending commit
var (
	stagingMutex = &sync.Mutex{}
	stagingArea  = make(map[string]string) // path -> content
)

// GetHealth handles the health check endpoint
func GetHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, HealthResponse{Status: "ok"})
}

// GetUser returns the local authenticated user
func GetUser(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, User{Login: localUsername})
}

// CreateFork is a no-op endpoint for local registry
func CreateFork(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusCreated, Repository{
		Name:     "registry",
		FullName: "local/registry",
		Fork:     true,
	})
}

// ListUserRepos returns a single fake fork so EnsureFork finds it
func ListUserRepos(w http.ResponseWriter, r *http.Request) {
	typeParam := r.URL.Query().Get("type")
	if typeParam == "fork" {
		repos := []Repository{
			{
				Name:     "registry",
				FullName: "local/registry",
				Fork:     true,
			},
		}
		writeJSON(w, http.StatusOK, repos)
		return
	}
	writeJSON(w, http.StatusOK, []Repository{})
}

// GetRawFile serves raw file content from the git repo
func GetRawFile(w http.ResponseWriter, r *http.Request) {
	path := chi.URLParam(r, "*")

	content, err := readFile(repoRoot, path)
	if err != nil {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}

	// Guess content type
	contentType := "text/plain"
	if strings.HasSuffix(path, ".json") {
		contentType = "application/json"
	} else if strings.HasSuffix(path, ".js") {
		contentType = "application/javascript"
	} else if strings.HasSuffix(path, ".html") {
		contentType = "text/html"
	} else if strings.HasSuffix(path, ".yaml") || strings.HasSuffix(path, ".yml") {
		contentType = "text/yaml"
	}

	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(http.StatusOK)
	w.Write(content)
}

// GetGitTree returns the git tree in GitHub API format
func GetGitTree(w http.ResponseWriter, r *http.Request) {
	entries, err := walkTree(repoRoot)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to walk tree: %v", err))
		return
	}

	tree := []TreeEntry{}
	for _, entry := range entries {
		tree = append(tree, TreeEntry{
			Path: entry.Path,
			Type: entry.Type,
			SHA:  entry.SHA,
		})
	}

	writeJSON(w, http.StatusOK, TreeResponse{
		Tree:      tree,
		Truncated: false,
	})
}

// GetContents returns file contents in GitHub API format
func GetContents(w http.ResponseWriter, r *http.Request) {
	filePath := chi.URLParam(r, "*")

	content, err := readFile(repoRoot, filePath)
	if err != nil {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}

	encoded := base64.StdEncoding.EncodeToString(content)

	writeJSON(w, http.StatusOK, FileContent{
		Name:     filepath.Base(filePath),
		Path:     filePath,
		SHA:      fmt.Sprintf("%x", sha256Hash(content)),
		Size:     len(content),
		Type:     "file",
		Content:  encoded,
		Encoding: "base64",
	})
}

// PutContents writes a file to the staging area
func PutContents(w http.ResponseWriter, r *http.Request) {
	filePath := chi.URLParam(r, "*")

	// Read request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}
	defer r.Body.Close()

	// Parse JSON request body
	var req struct {
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	// Decode content based on encoding
	var content []byte
	if req.Encoding == "base64" {
		decoded, err := base64.StdEncoding.DecodeString(req.Content)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid base64 content")
			return
		}
		content = decoded
	} else {
		content = []byte(req.Content)
	}

	// Write to disk
	if err := writeFile(repoRoot, filePath, content); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to write file: %v", err))
		return
	}

	// Add to staging area
	stagingMutex.Lock()
	stagingArea[filePath] = "" // Just track that it was staged
	stagingMutex.Unlock()

	// Return GitHub API response
	writeJSON(w, http.StatusCreated, FileContent{
		Name:     filepath.Base(filePath),
		Path:     filePath,
		SHA:      fmt.Sprintf("%x", sha256Hash(content)),
		Size:     len(content),
		Type:     "file",
		Content:  base64.StdEncoding.EncodeToString(content),
		Encoding: "base64",
	})
}

// BlobExists checks if a blob exists in the working tree
func BlobExists(w http.ResponseWriter, r *http.Request) {
	ns := chi.URLParam(r, "ns")
	hash := chi.URLParam(r, "hash")
	ext := chi.URLParam(r, "ext")

	blobPath := filepath.Join("blobs", ns, fmt.Sprintf("%s.%s", hash, ext))
	fullPath := filepath.Join(repoRoot, blobPath)

	if _, err := os.Stat(fullPath); err == nil {
		w.WriteHeader(http.StatusOK)
		return
	}

	w.WriteHeader(http.StatusNotFound)
}

// ListPRs returns all commits as PR-shaped objects
func ListPRs(w http.ResponseWriter, r *http.Request) {
	repo, err := openOrInitRepo(repoRoot)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to open repo: %v", err))
		return
	}

	ref, err := repo.Head()
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get HEAD: %v", err))
		return
	}

	iter, err := repo.Log(&git.LogOptions{From: ref.Hash()})
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get log: %v", err))
		return
	}
	defer iter.Close()

	prs := []PullRequest{}
	idx := 1 // 1-based PR numbering

	err = iter.ForEach(func(c *object.Commit) error {
		pr := PullRequest{
			Number:    idx,
			URL:       fmt.Sprintf("local://commit/%s", c.Hash.String()),
			HTMLURL:   fmt.Sprintf("local://commit/%s", c.Hash.String()),
			CreatedAt: c.Author.When.Format(time.RFC3339),
			User:      User{Login: localUsername},
		}
		pr.Head.Sha = c.Hash.String()
		prs = append(prs, pr)
		idx++
		return nil
	})

	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to iterate log: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, prs)
}

// CreatePR validates staged files and commits them
func CreatePR(w http.ResponseWriter, r *http.Request) {
	var req PRCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Get list of staged files
	stagingMutex.Lock()
	stagedFiles := make([]string, 0, len(stagingArea))
	for path := range stagingArea {
		stagedFiles = append(stagedFiles, path)
	}
	stagingMutex.Unlock()

	if len(stagedFiles) == 0 {
		writeError(w, http.StatusBadRequest, "no files staged for commit")
		return
	}

	// Call validator
	settingsJSON, _ := json.Marshal(map[string]interface{}{
		"repoRoot":      repoRoot,
		"localUsername": localUsername,
	})

	summary, err := lib.ValidateRegistryChanges(stagedFiles, localUsername, repoRoot, string(settingsJSON))
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("validation error: %v", err))
		return
	}

	// Check validation result
	if !summary.Success {
		// Return validation errors
		respJSON, _ := json.Marshal(summary)
		writeJSONString(w, http.StatusUnprocessableEntity, string(respJSON))
		return
	}

	// Validation passed, commit the files
	repo, err := openOrInitRepo(repoRoot)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to open repo: %v", err))
		return
	}

	commitHash, err := commitFiles(repo, repoRoot, stagedFiles, req.Title, localUsername)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to commit: %v", err))
		return
	}

	// Clear staging area
	stagingMutex.Lock()
	stagingArea = make(map[string]string)
	stagingMutex.Unlock()

	// Get commit number (count from HEAD)
	if true {
		ref, _ := repo.Head()
		iter, _ := repo.Log(&git.LogOptions{From: ref.Hash()})
		defer iter.Close()

		prNumber := 1
		iter.ForEach(func(c *object.Commit) error {
			if c.Hash.String() == commitHash {
				return nil // Found it, keep current prNumber
			}
			prNumber++
			return nil
		})

		pr := PullRequest{
			Number:  prNumber,
			URL:     fmt.Sprintf("local://commit/%s", commitHash),
			HTMLURL: fmt.Sprintf("local://commit/%s", commitHash),
		}

		writeJSON(w, http.StatusCreated, pr)
	} else {
		pr := PullRequest{
			Number:  1,
			URL:     fmt.Sprintf("local://commit/%s", commitHash),
			HTMLURL: fmt.Sprintf("local://commit/%s", commitHash),
		}
		writeJSON(w, http.StatusCreated, pr)
	}
}

// GetPRFiles returns files changed in a specific commit
func GetPRFiles(w http.ResponseWriter, r *http.Request) {
	// prNumber is actually a commit hash string (stable identifier)
	hashStr := chi.URLParam(r, "prNumber")

	repo, err := openOrInitRepo(repoRoot)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to open repo: %v", err))
		return
	}

	// Parse the commit hash
	hash := plumbing.NewHash(hashStr)

	// Look up the commit directly by hash
	commit, err := repo.CommitObject(hash)
	if err != nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("commit %s not found", hashStr))
		return
	}

	files := []FileChange{}

	// If this is not the first commit, get the diff against parent
	if commit.NumParents() > 0 {
		parent, err := commit.Parent(0)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get parent: %v", err))
			return
		}

		parentTree, err := parent.Tree()
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get parent tree: %v", err))
			return
		}

		commitTree, err := commit.Tree()
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get commit tree: %v", err))
			return
		}

		changes, err := object.DiffTree(parentTree, commitTree)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to diff: %v", err))
			return
		}

		for _, change := range changes {
			filename := change.To.Name
			if filename == "" && change.From.Name != "" {
				filename = change.From.Name
			}

			files = append(files, FileChange{Filename: filename})
		}
	}

	writeJSON(w, http.StatusOK, files)
}

// FakeDeviceCode returns a fake device code response
func FakeDeviceCode(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, DeviceCodeResponse{
		DeviceCode:      "device-code-fake",
		UserCode:        "USER-FAKE",
		VerificationURI: "https://github.com/login/device",
		ExpiresIn:       600,
		Interval:        5,
	})
}

// FakeAccessToken returns a fake access token response
func FakeAccessToken(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, AccessTokenResponse{
		AccessToken: "local-registry-token",
		TokenType:   "bearer",
	})
}

// ProxyEngineRelease proxies the latest engine release from GitHub
func ProxyEngineRelease(w http.ResponseWriter, r *http.Request) {
	// Simple proxy to GitHub
	resp, err := http.Get("https://api.github.com/repos/figulusproject/figulus/releases/latest")
	if err != nil {
		writeError(w, http.StatusBadGateway, fmt.Sprintf("proxy error: %v", err))
		return
	}
	defer resp.Body.Close()

	// Copy headers
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Copy status and body
	w.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(w, resp.Body); err != nil {
		log.Printf("error copying proxy response: %v", err)
	}
}

// Helper function to compute SHA256 hash
func sha256Hash(data []byte) string {
	hash := sha256.Sum256(data)
	return fmt.Sprintf("%x", hash)
}
