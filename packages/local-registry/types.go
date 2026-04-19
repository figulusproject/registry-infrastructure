package main

import "encoding/json"

// User represents a GitHub user object
type User struct {
	Login string `json:"login"`
}

// Repository represents a GitHub repository object
type Repository struct {
	Name     string `json:"name"`
	FullName string `json:"full_name"`
	Fork     bool   `json:"fork"`
}

// TreeEntry represents a file or directory in the git tree
type TreeEntry struct {
	Path string `json:"path"`
	Mode string `json:"mode"`
	Type string `json:"type"` // "blob" or "tree"
	SHA  string `json:"sha"`
	Size int    `json:"size,omitempty"`
	URL  string `json:"url,omitempty"`
}

// TreeResponse represents the GitHub tree API response
type TreeResponse struct {
	Tree      []TreeEntry `json:"tree"`
	Truncated bool        `json:"truncated"`
}

// PullRequest represents a GitHub pull request (or commit in local registry)
type PullRequest struct {
	Number    int    `json:"number"`
	URL       string `json:"url"`
	HTMLURL   string `json:"html_url"`
	Title     string `json:"title,omitempty"`
	Body      string `json:"body,omitempty"`
	CreatedAt string `json:"created_at"`
	User      User   `json:"user"`
	Head      struct {
		Sha string `json:"sha"`
	} `json:"head,omitempty"`
	Base struct {
		Sha string `json:"sha"`
	} `json:"base,omitempty"`
}

// PRCreateRequest represents a PR creation request
type PRCreateRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Head  string `json:"head"`
	Base  string `json:"base"`
}

// FileChange represents a file that changed in a commit
type FileChange struct {
	Filename string `json:"filename"`
	Status   string `json:"status,omitempty"`
	Changes  int    `json:"changes,omitempty"`
}

// FileContent represents a file in the GitHub API format
type FileContent struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	SHA      string `json:"sha"`
	Size     int    `json:"size"`
	Type     string `json:"type"`
	Content  string `json:"content"`
	Encoding string `json:"encoding"`
}

// DeviceCodeResponse represents the device flow code response
type DeviceCodeResponse struct {
	DeviceCode      string `json:"device_code"`
	UserCode        string `json:"user_code"`
	VerificationURI string `json:"verification_uri"`
	ExpiresIn       int    `json:"expires_in"`
	Interval        int    `json:"interval"`
}

// AccessTokenResponse represents the OAuth access token response
type AccessTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope,omitempty"`
}

// HealthResponse represents a health check response
type HealthResponse struct {
	Status string `json:"status"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

// ValidationErrorResponse wraps validation errors for PR rejection
type ValidationErrorResponse struct {
	Message           string          `json:"message"`
	Success           bool            `json:"success"`
	TotalFiles        int             `json:"totalFiles"`
	FilesWithErrors   int             `json:"filesWithErrors"`
	FilesWithWarnings int             `json:"filesWithWarnings"`
	Results           json.RawMessage `json:"results,omitempty"`
	Markdown          string          `json:"markdown"`
}
