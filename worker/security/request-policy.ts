const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const isTrustedBrowserRequest = (request: Request): boolean => {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return true;

  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  return origin === requestOrigin &&
    (fetchSite === null || fetchSite === "same-origin");
};

export const applyApiHeaders = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

export const applyWebHeaders = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};
