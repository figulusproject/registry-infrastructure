package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"
)

// openOrInitRepo opens an existing git repository or initializes a new one
func openOrInitRepo(path string) (*git.Repository, error) {
	repo, err := git.PlainOpen(path)
	if err == nil {
		return repo, nil
	}

	// Not a git repo, initialize it
	repo, err = git.PlainInit(path, false)
	if err != nil {
		return nil, fmt.Errorf("failed to init repo: %w", err)
	}

	// Configure git user for commits
	config, err := repo.Config()
	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}

	config.User.Name = "admin"
	config.User.Email = "admin@local"

	if err := repo.SetConfig(config); err != nil {
		return nil, fmt.Errorf("failed to set config: %w", err)
	}

	// Create initial empty commit
	w, err := repo.Worktree()
	if err != nil {
		return nil, fmt.Errorf("failed to get worktree: %w", err)
	}

	_, err = w.Commit("initial commit", &git.CommitOptions{
		Author: &object.Signature{
			Name:  "admin",
			Email: "admin@local",
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create initial commit: %w", err)
	}

	return repo, nil
}

// readFile reads a file from the working tree
func readFile(repoRoot, filePath string) ([]byte, error) {
	fullPath := filepath.Join(repoRoot, filePath)
	content, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}
	return content, nil
}

// writeFile writes a file to the working tree, creating directories as needed
func writeFile(repoRoot, filePath string, content []byte) error {
	fullPath := filepath.Join(repoRoot, filePath)

	// Create parent directories
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return fmt.Errorf("failed to create directories: %w", err)
	}

	// Write the file
	if err := os.WriteFile(fullPath, content, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	return nil
}

// commitFiles stages and commits the specified files
func commitFiles(repo *git.Repository, repoRoot string, files []string, message string, authorName string) (string, error) {
	w, err := repo.Worktree()
	if err != nil {
		return "", fmt.Errorf("failed to get worktree: %w", err)
	}

	// Stage all files
	for _, file := range files {
		if _, err := w.Add(file); err != nil {
			return "", fmt.Errorf("failed to add file %s: %w", file, err)
		}
	}

	// Commit
	hash, err := w.Commit(message, &git.CommitOptions{
		Author: &object.Signature{
			Name:  authorName,
			Email: "admin@local",
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to commit: %w", err)
	}

	return hash.String(), nil
}

// TreeEntry represents a file/directory in the tree
type TreeEntryLocal struct {
	Path string
	Type string // "blob" or "tree"
	SHA  string
}

// walkTree walks the working tree and returns all file entries, skipping .git
func walkTree(repoRoot string) ([]TreeEntryLocal, error) {
	var entries []TreeEntryLocal

	err := filepath.WalkDir(repoRoot, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Skip .git directory
		if d.IsDir() && d.Name() == ".git" {
			return filepath.SkipDir
		}

		// Get relative path
		relPath, err := filepath.Rel(repoRoot, path)
		if err != nil {
			return err
		}

		// Skip root entry
		if relPath == "." {
			return nil
		}

		// Convert to forward slashes for consistency
		relPath = strings.ReplaceAll(relPath, "\\", "/")

		if d.IsDir() {
			entries = append(entries, TreeEntryLocal{
				Path: relPath,
				Type: "tree",
				SHA:  "",
			})
		} else {
			// Read file and compute SHA
			content, err := os.ReadFile(path)
			if err != nil {
				return err
			}

			hash := sha256.Sum256(content)
			sha := hex.EncodeToString(hash[:])

			entries = append(entries, TreeEntryLocal{
				Path: relPath,
				Type: "blob",
				SHA:  sha,
			})
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk tree: %w", err)
	}

	return entries, nil
}
