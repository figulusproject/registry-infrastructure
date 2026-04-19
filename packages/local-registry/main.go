package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/go-git/go-git/v5/plumbing"
)

var (
	port          int
	repoRoot      string
	settingsFile  string
	localUsername string
)

func init() {
	flag.IntVar(&port, "port", 5678, "port to listen on")
	flag.StringVar(&repoRoot, "repo-root", "", "path to git repository (required)")
	flag.StringVar(&settingsFile, "settings-file", "", "path to JSON settings file")
	flag.StringVar(&localUsername, "local-username", "admin", "username for locally-created content")
}

func main() {
	flag.Parse()

	// Validate required flags
	if repoRoot == "" {
		fmt.Fprintf(os.Stderr, "Error: --repo-root is required\n")
		os.Exit(1)
	}

	// Ensure repo exists
	if _, err := os.Stat(repoRoot); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "Error: repo root does not exist: %s\n", repoRoot)
		os.Exit(1)
	}

	// Open or initialize git repository
	repo, err := openOrInitRepo(repoRoot)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to initialize repository: %v\n", err)
		os.Exit(1)
	}

	// Verify it's a valid git repo
	if _, err := repo.Head(); err != nil {
		if err == plumbing.ErrReferenceNotFound {
			// No commits yet, that's okay
		} else {
			fmt.Fprintf(os.Stderr, "Error: failed to get HEAD: %v\n", err)
			os.Exit(1)
		}
	}

	// Start the server
	if err := StartServer(port); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
