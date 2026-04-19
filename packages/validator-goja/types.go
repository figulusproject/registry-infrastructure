package main

import "encoding/json"

// ValidationError represents a validation error or warning
type ValidationError struct {
	Message string `json:"message"`
	Code    string `json:"code"`
}

// SuccessResult represents a successful validation result
type SuccessResult struct {
	Success  bool                `json:"success"`
	Warnings []ValidationError   `json:"warnings,omitempty"`
}

// FailureResult represents a failed validation result
type FailureResult struct {
	Success bool              `json:"success"`
	Errors  []ValidationError `json:"errors"`
}

// FileValidationResult represents validation results for a single file
type FileValidationResult struct {
	File   string          `json:"file"`
	Type   string          `json:"type"`
	Result json.RawMessage `json:"result"`
}

// ValidationSummary represents the complete validation summary
type ValidationSummary struct {
	Success           bool                    `json:"success"`
	TotalFiles        int                     `json:"totalFiles"`
	FilesWithErrors   int                     `json:"filesWithErrors"`
	FilesWithWarnings int                     `json:"filesWithWarnings"`
	Results           []FileValidationResult  `json:"results"`
	Markdown          string                  `json:"markdown"`
}

// SettingsInput represents the input settings structure
type SettingsInput struct {
	RepoRoot string `json:"repoRoot"`
	// Other fields are optional and have defaults
}
