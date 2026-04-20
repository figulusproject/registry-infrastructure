package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"os"
)

func main() {
	// Define flags
	changedFilesFlag := flag.String("changed-files", "", "JSON array string of file paths")
	authorFlag := flag.String("author", "", "username string")
	repoRootFlag := flag.String("repo-root", "", "path to repository root")
	settingsFileFlag := flag.String("settings-file", "", "path to JSON settings file")
	outputFileFlag := flag.String("output-file", "", "path to write JSON validation summary")
	registryURLFlag := flag.String("registry-url", "", "override registry URL")

	flag.Parse()

	// Validate required flags
	if *changedFilesFlag == "" || *authorFlag == "" {
		fmt.Fprintf(os.Stderr, "Error: --changed-files and --author are required\n")
		os.Exit(1)
	}

	// Parse changed files
	var changedFiles []string
	if err := json.Unmarshal([]byte(*changedFilesFlag), &changedFiles); err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to parse --changed-files as JSON: %v\n", err)
		os.Exit(1)
	}

	// Get repo root (default to current directory)
	repoRoot := *repoRootFlag
	if repoRoot == "" {
		var err error
		repoRoot, err = os.Getwd()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: failed to get current directory: %v\n", err)
			os.Exit(1)
		}
	}

	// Load settings
	var settings map[string]interface{}
	if *settingsFileFlag != "" {
		content, err := ioutil.ReadFile(*settingsFileFlag)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: failed to read settings file: %v\n", err)
			os.Exit(1)
		}
		if err := json.Unmarshal(content, &settings); err != nil {
			fmt.Fprintf(os.Stderr, "Error: failed to parse settings file as JSON: %v\n", err)
			os.Exit(1)
		}
	} else {
		settings = make(map[string]interface{})
	}

	// Ensure repoRoot is set in settings
	settings["repoRoot"] = repoRoot

	// Override registry URL if provided
	if *registryURLFlag != "" {
		if registry, ok := settings["registry"].(map[string]interface{}); ok {
			registry["url"] = *registryURLFlag
		} else {
			settings["registry"] = map[string]interface{}{
				"url": *registryURLFlag,
			}
		}
	}

	settingsBytes, err := json.Marshal(settings)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to marshal settings: %v\n", err)
		os.Exit(1)
	}
	settingsJSON := string(settingsBytes)

	// Run validation
	summary, err := ValidateRegistryChanges(changedFiles, *authorFlag, repoRoot, settingsJSON)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: validation failed: %v\n", err)
		os.Exit(1)
	}

	// Write output file if specified
	if *outputFileFlag != "" {
		output, err := json.MarshalIndent(summary, "", "  ")
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: failed to marshal validation summary: %v\n", err)
			os.Exit(1)
		}
		if err := ioutil.WriteFile(*outputFileFlag, output, 0644); err != nil {
			fmt.Fprintf(os.Stderr, "Error: failed to write output file: %v\n", err)
			os.Exit(1)
		}
	}

	// Print markdown to stdout or stderr based on success
	if summary.Success {
		fmt.Println(summary.Markdown)
		os.Exit(0)
	} else {
		fmt.Fprintf(os.Stderr, summary.Markdown)
		os.Exit(1)
	}
}
