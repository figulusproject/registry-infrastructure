package main

import (
	"github.com/figulusproject/registry-infrastructure/packages/validator-goja/lib"
)

// ValidateRegistryChanges is a wrapper around lib.ValidateRegistryChanges
func ValidateRegistryChanges(changedFiles []string, author string, repoRoot string, settingsJSON string) (*lib.ValidationSummary, error) {
	return lib.ValidateRegistryChanges(changedFiles, author, repoRoot, settingsJSON)
}
