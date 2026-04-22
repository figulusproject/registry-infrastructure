package main

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// SetupRoutes configures all HTTP routes
func SetupRoutes(r *chi.Mux) {
	// Health check
	r.Get("/_health", GetHealth)

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   "not_found",
			"message": fmt.Sprintf("route not found: %s %s", r.Method, r.URL.Path),
		})
	})

	// User endpoints
	r.Get("/api/user", GetUser)
	r.Get("/api/user/repos", ListUserRepos)

	// Fork endpoints
	r.Post("/api/forks", CreateFork)

	// Pull request endpoints
	r.Get("/api/pulls", ListPRs)
	r.Post("/api/pulls", CreatePR)
	r.Get("/api/pulls/{prNumber}/files", GetPRFiles)

	// Raw content endpoints
	r.Get("/raw/refs/heads/main/*", GetRawFile)
	r.Head("/raw/main/blobs/{ns}/{hash}.{ext}", BlobExists)

	// Git tree endpoints
	r.Get("/api/git/trees/main", GetGitTree)

	// File content endpoints
	r.Get("/api/contents/*", GetContents)
	r.Put("/api/contents/*", PutContents)

	// Auth endpoints (fake)
	r.Post("/auth/login/device/code", FakeDeviceCode)
	r.Post("/auth/login/oauth/access_token", FakeAccessToken)

	// Release proxy endpoints
	r.Get("/releases/engine/latest", ProxyEngineRelease)
}

// StartServer starts the HTTP server
func StartServer(port int) error {
	r := chi.NewRouter()

	// Setup middleware
	SetupMiddleware(r)

	// Setup routes
	SetupRoutes(r)

	addr := fmt.Sprintf(":%d", port)
	fmt.Printf("Server listening on %s\n", addr)

	return http.ListenAndServe(addr, r)
}
