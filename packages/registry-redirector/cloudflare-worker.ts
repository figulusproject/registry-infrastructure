/**
 * Figulus Registry Proxy Worker
 *
 * Routes unified registry paths to GitHub endpoints.
 * - /api/* → api.github.com/repos/figulusproject/registry (unless /api/user)
 * - /raw/* → raw.githubusercontent.com/figulusproject/registry
 * - /auth/* → github.com
 * - /releases/engine/* → api.github.com/repos/figulusproject/figulus
 * - /releases/registry/* → api.github.com/repos/figulusproject/registry-infrastructure
 */

interface Env {
  REGISTRY_DOMAIN?: string; // Optional: override base domain for local testing
}

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
};

type ExportedHandler<T = unknown> = {
  fetch(request: Request, env: T, ctx?: ExecutionContext): Promise<Response>;
};

type RouteHandler = (
  path: string,
  request: Request
) => Promise<string | undefined>;

/**
 * Resolve a unified path to its GitHub backend URL.
 * Returns undefined if the route doesn't match any known pattern.
 */
function resolveUrl(path: string): string | undefined {
  // /api/* routes
  if (path.startsWith("/api/")) {
    const apiPath = path.slice(5); // Remove /api/ prefix (including slash)
    if (apiPath.startsWith("user")) {
      // /api/user and /api/user/* stay at api.github.com root
      return `https://api.github.com/${apiPath}`;
    }
    // All other /api/* routes target the registry repo
    return `https://api.github.com/repos/figulusproject/registry/${apiPath}`;
  }

  // /raw/* routes
  if (path.startsWith("/raw/")) {
    const rawPath = path.slice(5); // Remove /raw/ prefix (including slash)
    return `https://raw.githubusercontent.com/figulusproject/registry/${rawPath}`;
  }

  // /auth/* routes (OAuth)
  if (path.startsWith("/auth/")) {
    const authPath = path.slice(6); // Remove /auth/ prefix (including slash)
    return `https://github.com/${authPath}`;
  }

  // /releases/* routes (special handling for different repos)
  if (path.startsWith("/releases/")) {
    const releasePath = path.slice(10); // Remove /releases/ prefix (including slash)
    if (releasePath.startsWith("engine/")) {
      const enginePath = releasePath.slice(7); // Remove engine/ prefix
      return `https://api.github.com/repos/figulusproject/figulus/releases/${enginePath}`;
    }
    if (releasePath.startsWith("registry/")) {
      const registryPath = releasePath.slice(9); // Remove registry/ prefix
      return `https://api.github.com/repos/figulusproject/registry-infrastructure/releases/${registryPath}`;
    }
  }

  return undefined;
}

/**
 * Forward a request to the resolved GitHub URL, preserving auth headers.
 */
async function forwardRequest(
  targetUrl: string,
  request: Request
): Promise<Response> {
  const headers = new Headers(request.headers);

  // Ensure proper GitHub API headers for JSON endpoints
  if (targetUrl.includes("/api.github.com/")) {
    headers.set("Accept", "application/vnd.github+json");
    headers.set("X-GitHub-Api-Version", "2022-11-28");
  }

  // Preserve raw.githubusercontent.com request header (optional)
  if (targetUrl.includes("/raw.githubusercontent.com/")) {
    headers.set("Accept", "application/vnd.github.v3.raw");
  }

  // Forward the authorization token if present
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    headers.set("Authorization", authHeader);
  }

  // Don't send host header to upstream
  headers.delete("Host");

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
    });

    // Clone the response and preserve headers
    const clonedResponse = response.clone();
    const newHeaders = new Headers(clonedResponse.headers);

    // Preserve GitHub rate limit headers for client visibility
    const rateLimitRemaining = clonedResponse.headers.get(
      "X-RateLimit-Remaining"
    );
    const rateLimitReset = clonedResponse.headers.get("X-RateLimit-Reset");
    if (rateLimitRemaining) {
      newHeaders.set("X-RateLimit-Remaining", rateLimitRemaining);
    }
    if (rateLimitReset) {
      newHeaders.set("X-RateLimit-Reset", rateLimitReset);
    }

    // Add CORS headers to allow browser access
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, HEAD, OPTIONS"
    );
    newHeaders.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Accept"
    );

    // Enforce HTTPS for all future requests from this client
    newHeaders.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );

    return new Response(clonedResponse.body, {
      status: clonedResponse.status,
      statusText: clonedResponse.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Proxy error forwarding to ${targetUrl}:`, errorMsg);
    const headers = addSecurityHeaders(
      new Headers({ "Content-Type": "application/json" })
    );
    return new Response(
      JSON.stringify({
        error: "Proxy forwarding failed",
        message: errorMsg,
        url: targetUrl,
      }),
      {
        status: 502,
        headers,
      }
    );
  }
}

/**
 * Add security headers to all responses.
 */
function addSecurityHeaders(headers: Headers): Headers {
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  return headers;
}

/**
 * Handle OPTIONS preflight requests for CORS.
 */
function handleOptions(): Response {
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods":
      "GET, POST, PUT, DELETE, HEAD, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Accept",
    "Access-Control-Max-Age": "86400",
  });
  return new Response(null, {
    status: 204,
    headers: addSecurityHeaders(headers),
  });
}

/**
 * Handle health check requests.
 */
function handleHealth(): Response {
  const headers = addSecurityHeaders(
    new Headers({ "Content-Type": "application/json" })
  );
  return new Response(
    JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      routes: [
        "/api/* - GitHub API (api.github.com/repos/figulusproject/registry)",
        "/raw/* - Raw content (raw.githubusercontent.com/figulusproject/registry)",
        "/auth/* - OAuth (github.com)",
        "/releases/engine/* - Engine releases (figulusproject/figulus)",
        "/releases/registry/* - Registry infrastructure releases",
      ],
    }),
    {
      status: 200,
      headers,
    }
  );
}

/**
 * Main worker handler.
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx?: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname + url.search;

    // REJECT ALL HTTP REQUESTS — tokens only over HTTPS
    if (url.protocol !== "https:") {
      const clientIP = request.headers.get("cf-connecting-ip") || "unknown";
      console.warn(
        `Rejected ${request.method} request over ${url.protocol} from ${clientIP} to ${path}`
      );
      const headers = addSecurityHeaders(
        new Headers({ "Content-Type": "application/json" })
      );
      return new Response(
        JSON.stringify({
          error: "HTTPS Required",
          message:
            "This endpoint only accepts HTTPS requests. Tokens are never sent over unencrypted HTTP.",
          received: url.protocol,
        }),
        {
          status: 400,
          headers,
        }
      );
    }

    // Health check endpoint
    if (path === "/_health" || path === "/health") {
      return handleHealth();
    }

    // CORS preflight
    if (request.method === "OPTIONS") {
      return handleOptions();
    }

    // Root path redirects to browse interface
    if (path === "/") {
      const redirectHeaders = addSecurityHeaders(
        new Headers({
          Location: "https://figulus.net/registry/browse",
        })
      );
      return new Response(null, {
        status: 301,
        headers: redirectHeaders,
      });
    }

    // Resolve the unified path to GitHub URL
    const targetUrl = resolveUrl(path);
    if (!targetUrl) {
      const headers = addSecurityHeaders(
        new Headers({ "Content-Type": "application/json" })
      );
      return new Response(
        JSON.stringify({
          error: "Not found",
          message: `No route matched for ${path}`,
          example_paths: [
            "/api/user",
            "/api/repos/figulusproject/registry/contents/specs",
            "/raw/refs/heads/main/specs",
            "/auth/login/device/code",
            "/releases/engine/latest",
          ],
        }),
        {
          status: 404,
          headers,
        }
      );
    }

    // Forward the request
    console.log(`Forwarding ${request.method} ${path} to ${targetUrl}`);
    return forwardRequest(targetUrl, request);
  },
} satisfies ExportedHandler<Env>;
