# Changelog

## [0.5.0-alpha-rc15] — 2026-04-22

### Changed

- **Monorepo package version specifiers** — updated `@figulus/validator-bundled` and `@figulus/validator-node` to use `"rc"` version specifier for their `@figulus/validator-core` dependency instead of wildcard (`"*"`) and pinned prerelease (`"^0.5.0-alpha-rc13"`). The `"rc"` specifier ensures both packages resolve to the latest release candidate version of validator-core within the monorepo, maintaining alignment across pre-release versions and preventing version skew during the alpha cycle.

---

## [0.5.0-alpha-rc14] — 2026-04-22

### Changed

- **`local-registry` author field in PR requests** — added explicit `Author` field to pull request metadata passed to validators. Previously, validators always received the hardcoded local registry username (`localUsername`), losing the author context passed by the CLI. Now the author is extracted from the request body and forwarded to validation, allowing validators to enforce author-based governance rules.

### Fixed

- **`local-registry` staged file cleanup on validation failure** — fixed leaked temporary files on validation failures. Previously, when a PR request validation failed and returned a 422 response, staged files were never deleted from disk, leaving behind orphaned files. Now staged files are cleaned up before returning the validation error response.

---

## [0.5.0-alpha-rc13] — 2026-04-21

### Fixed

- **File-not-found error handling abstraction** — introduced shared `FILE_NOT_FOUND` constant across validator implementations to decouple error handling from HTTP semantics. Previously, `validator-core` checked for "404" in error messages to distinguish file-not-found from unexpected errors, but `validator-goja` used git library semantics with custom error messages, causing new namespace creation to fail. Now both `validator-node` and `validator-goja` throw errors containing the `FILE_NOT_FOUND` sentinel, allowing validator-core to handle missing files uniformly regardless of underlying implementation (HTTP or git-based).
- **`validator-goja` duplicate output** — removed duplicate markdown printing from `main.go`. The validation result markdown was already being printed by `pr.ts` via console helpers, causing output to appear twice in the CLI. Now `main.go` only handles exit codes while letting the validation layer handle output.

---

## [0.5.0-alpha-rc12] — 2026-04-21

### Changed

- **`validator-goja` bundle reference** — replaced stale checked-in `validator-bundled.js` file with a symlink to `../validator-bundled/dist/validator-bundled.js`. Ensures `go generate ./lib` copies the freshly built bundle instead of an outdated version, fixing the release workflow to actually use newly-compiled validator-core changes.

---

## [0.5.0-alpha-rc11] — 2026-04-21

### Fixed

- **Release workflow dependency build order** — fixed `release-binaries` job to build `validator-core` before `validator-bundled`. Previously, only installing npm dependencies wasn't enough; the bundler needs the compiled validator-core dist files. Now builds both in the correct order before running `go generate ./lib`.

---

## [0.5.0-alpha-rc10] — 2026-04-21

### Fixed

- **Release workflow binary build** — fixed `release-binaries` job to build `validator-bundled` before running `go generate ./lib`. Previously, the npm bundle didn't exist when the Go build tried to copy it via symlink, causing build failures. Now the job installs npm dependencies and builds the bundle first, matching the pattern used in the `check` job.

### Changed

- **`local-registry` 404 responses** — added explicit NotFound handler to return structured JSON error responses (`{"error": "not_found", "message": "..."}`) for undefined routes instead of chi's default plain-text 404. Matches the registry API contract by always returning JSON with consistent error codes.
- **`@figulus/validator-core` variable destructuring** — simplified destructuring patterns in `ChangedFile.parseJson()` and `parseFileJson()` to avoid intermediate variable aliases. Now accesses `helpers.fs` directly rather than destructuring `fs` separately, improving code clarity.

---

## [0.5.0-alpha-rc9] — 2026-04-21

### Fixed

- **`validator-goja` and `local-registry` Alpine compatibility** — release workflow now builds both binaries with `CGO_ENABLED=0` to produce fully static binaries. Previously, cgo-enabled builds required libc dependencies that weren't available on Alpine Linux, causing "not found" errors despite the binaries being executable. Static binaries now work on any Linux distribution without libc dependencies.

---

## [0.5.0-alpha-rc8] — 2026-04-21

### Fixed

- **`validator-goja` blob file existence check** — fixed `fileOrDirExists` helper to correctly handle absolute paths returned by `resolvePath`. Previously, `filepath.Join(repoRoot, absolutePath)` would ignore the repoRoot and still check the wrong location when validating blob references. Now checks `filepath.IsAbs()` before joining, preventing absolute paths from being incorrectly joined with repoRoot.

### Changed

- **Build artifacts removed from git** — removed accidentally committed Go binaries (`packages/local-registry/local-registry` and `packages/validator-goja/validator-goja`). Added `.gitignore` files to both packages to prevent future binary commits.

---

## [0.5.0-alpha-rc7] — 2026-04-20

### Changed

- **`validator-goja` module path** — updated module declaration from `github.com/figulusproject/registry-infrastructure/validator-goja` to `github.com/figulusproject/registry-infrastructure/packages/validator-goja` to correctly reflect the submodule location in the monorepo. This enables proper Go module resolution for the packages in the registry-infrastructure repository.
- **`local-registry` imports and dependencies** — updated to use the new `validator-goja` module path. Updated go.mod require and replace directives and import statements in handlers.go to reference the packages-prefixed module path.

---

## [0.5.0-alpha-rc6] — 2026-04-20

### Fixed

- **`@figulus/validator-core` push limit check** — fixed method invocation in `checkPushLimit` where `getRegistrySettings` was being destructured and called as a standalone function, losing its `this` context. Now called as a method on the `registryValidator` instance, resolving "Cannot read properties of undefined" errors when checking push limits.

---

## [0.5.0-alpha-rc5] — 2026-04-20

### Fixed

- **`@figulus/validator-core` new namespace validation** — fixed 404 handling when adding new namespaces. Previously, when a namespace didn't exist in HEAD, the 404 error was caught as a parse error instead of falling through to new namespace validation logic. Now 404 errors (file not found) are distinguished from connection errors and rethrown immediately, allowing new namespace submissions to validate correctly.
- **`@figulus/validator-node` fetch fallback** — fetch errors are now classified: 404 (file not found) throws immediately without attempting fallback registries, while connection errors still try the fallback. This prevents unnecessary fallback attempts when a file genuinely doesn't exist on the configured registry.

---

## [0.5.0-alpha-rc4] — 2026-04-20

### Fixed

- **`@figulus/validator-node` CLI arg parser** — fixed implementation to correctly normalize space-separated arguments to equals format, resolving validation failures that occurred in rc3 when using either syntax.

---

## [0.5.0-alpha-rc3] — 2026-04-20

### Changed

- **Release workflow** — fixed npm publish to apply `--tag` flag to both `@figulus/validator-core` and `@figulus/validator-node`, ensuring prerelease versions (alpha, rc, dev) are correctly tagged in npm registry instead of failing. Reordered npm job steps to determine tag once before publishing both packages.
- **Release notes extraction** — updated GitHub release notes extraction to use file-based pattern (`body_path`) instead of variable passing, matching the figulus workflow for more robust and reliable changelog integration.
- **`@figulus/validator-node` CLI** — arg parser now supports both space-separated (`--key value`) and equals-separated (`--key=value`) argument formats. Regex pattern handles optional equals and lookahead to next arg for value detection.

---

## [0.5.0-alpha-rc2] — 2026-04-20

### Changed

- **`@figulus/validator-core`** — renamed `helpers.git` to `helpers.registry` throughout the `Helpers` interface. The field now accurately reflects its role as the registry API abstraction layer rather than a git-specific interface. All implementations (validator-node, validator-goja) updated accordingly. Consumers implementing the `Helpers` interface must rename the `git` field to `registry`.
- **`@figulus/validator-node`** — added `--registry-url` CLI flag to override the registry URL at runtime without requiring a settings file.
- **`validator-goja`** — added `--registry-url` flag matching validator-node. Added `registry.getSettings()` implementation that fetches `settings.json` from the configured registry URL, enabling registry policy (maintainers, restricted namespaces, push limits) to be respected in the Go validation context. Falls back to `{}` on network failure, inheriting defaults from `loadRegistrySettings`.
- **Release workflow** — added npm-only release trigger via `npm-v*` tags. Tagging `npm-v0.5.0-alpha-rc2` publishes `@figulus/validator-core` and `@figulus/validator-node` to npm without triggering a binary release. Added `@figulus/validator-core` to the OIDC npm publish job.
- **`registry-routes.json` moved to root** — route mapping file relocated for broader accessibility across packages.

---

## [0.5.0-alpha-rc1] — 2026-04-19

Initial release of the Figulus registry infrastructure — validation tooling for the community registry, a Cloudflare Worker proxy for the registry API, and a local registry server for self-hosted deployments.

### Added

- **`@figulus/validator-core`** — engine-agnostic validation library for Figulus registry pull requests. Validates blob content hashes against filenames, enforces namespace ownership and editor access control, checks push limits (per-editor and namespace-wide), prevents ownership transfers by non-owners, and verifies that blob files referenced in metadata variants actually exist. All filesystem, git, and crypto operations are injected via a `Helpers` interface, making the core logic runnable in any environment. Structured error codes with type-safe discriminated unions. Markdown-formatted validation output included in `ValidationSummary` for direct use as PR comments.
- **Registry settings fetched from registry** — governance configuration (`registryMaintainers`, `restrictedNamespaces`, `pushLimits`) is fetched at validation time from `GET /raw/refs/heads/main/settings.json` on the target registry rather than hardcoded in the validator. Enables local registries to define their own policy without modifying validator code. Falls back to sensible defaults if the endpoint is unreachable.
- **`@figulus/validator-node`** — Node.js binding for `@figulus/validator-core`. Implements the `Helpers` interface using Node's `fs`, `crypto`, `child_process`, and `up-fetch`. Accepts `--changed-files`, `--author`, `--repo-root`, `--settings-file`, `--registry-url`, and `--output-file` CLI flags. Writes a JSON `ValidationSummary` to `--output-file` when specified. Falls back to the default registry (`https://registry.figulus.net`) if the configured registry is unreachable. Published to npm as `@figulus/validator-node`; runnable via `npx @figulus/validator-node`.
- **`validator-bundled`** — esbuild CJS bundle of `@figulus/validator-core` and all its dependencies (`zod`, `zod-spdx`, `@figulus/schema`, `strip-json-comments`). Self-contained single file for embedding in non-Node environments. SHA-256 hash committed alongside the bundle; release workflow fails if the committed hash is stale.
- **`validator-goja`** — Go package and binary that embeds the validator bundle and runs it in a [Goja](https://github.com/dop251/goja) JavaScript runtime. Exposes `ValidateRegistryChanges(changedFiles, author, repoRoot, settingsJSON)` as a Go function callable from other Go packages. Uses go-git for all git operations. Accepts the same flags as `validator-node` via CLI. Released as a signed binary for `linux/amd64`, `linux/arm64`, and `darwin/arm64`.
- **`local-registry`** — self-hosted Figulus registry server. Implements the full Figulus registry API (identical routes to `registry.figulus.net`) using git for storage and `validator-goja` for validation. Changes are validated before being committed; invalid submissions are rejected with structured error output. Auth endpoints return fake tokens — the local registry is intentionally unauthenticated (network-local trust model). Serves `settings.json` from the repo root for per-deployment policy configuration. Accepts `--port` (default: 5678), `--repo-root` (required), `--settings-file`, and `--local-username` (default: `"admin"`) flags. Released as a signed binary for `linux/amd64`, `linux/arm64`, and `darwin/arm64`.
- **`figulus-registry-proxy` Cloudflare Worker** — deployed at `registry.figulus.net`. Proxies all registry API calls to the appropriate GitHub endpoints, normalising three GitHub domains (`api.github.com`, `raw.githubusercontent.com`, `github.com`) into a single consistent API surface. Adds CORS headers and enforces HTTPS. Routes: `/api/*` → GitHub API, `/raw/*` → raw content, `/auth/*` → GitHub OAuth, `/releases/engine/*` → Figulus engine releases, `/releases/registry/*` → registry-infrastructure releases. Enables the Figulus engine to switch between the hosted registry and a local registry by changing a single base URL.
- **Release workflow** — GitHub Actions workflow that builds and signs `validator-goja` and `local-registry` binaries for all three platforms, publishes `@figulus/validator-node` to npm via OIDC trusted publishing (no tokens), and creates a GitHub release with cosign-signed archives. Pre-release check verifies the committed `validator-bundled.js` hash matches a fresh build before proceeding.
