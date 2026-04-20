# Changelog

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
