import { cookieHeader, updateCookies, type StoredCookie } from "./cookie-jar";

const MAX_REDIRECTS = 10;

type LmsRequestBody = ArrayBuffer | string | null;

export type LmsFetchResult = {
  cookies: StoredCookie[];
  redirectCount: number;
  response: Response;
  url: URL;
};

type LmsFetchOptions = {
  body?: LmsRequestBody;
  cookies?: StoredCookie[];
  headers?: HeadersInit;
  isAllowedPath: (path: string) => boolean;
  method?: string;
  origin: string;
  path: string;
};

const isRedirect = (status: number): boolean => status >= 300 && status < 400;

export async function fetchLmsWithCookies({
  body = null,
  cookies = [],
  headers: initialHeaders,
  isAllowedPath,
  method = "GET",
  origin,
  path,
}: LmsFetchOptions): Promise<LmsFetchResult> {
  let currentUrl = new URL(path, origin);
  let currentMethod = method.toUpperCase();
  let currentBody = body;
  let currentCookies = cookies;
  let redirectCount = 0;
  const allowedOrigin = new URL(origin).origin;

  if (currentUrl.origin !== allowedOrigin || !isAllowedPath(currentUrl.pathname)) {
    throw new Error("LMS request path is not allowed.");
  }

  while (true) {
    const headers = new Headers(initialHeaders);
    const cookiesForRequest = cookieHeader(currentCookies);
    if (cookiesForRequest) headers.set("Cookie", cookiesForRequest);
    if (currentBody === null) headers.delete("Content-Type");

    const response = await fetch(currentUrl, {
      body: currentMethod === "GET" || currentMethod === "HEAD" ? null : currentBody,
      headers,
      method: currentMethod,
      redirect: "manual",
    });
    currentCookies = updateCookies(currentCookies, response.headers);

    if (!isRedirect(response.status) || redirectCount >= MAX_REDIRECTS) {
      return { cookies: currentCookies, redirectCount, response, url: currentUrl };
    }

    const location = response.headers.get("location");
    if (!location) {
      return { cookies: currentCookies, redirectCount, response, url: currentUrl };
    }

    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.origin !== allowedOrigin || !isAllowedPath(nextUrl.pathname)) {
      return { cookies: currentCookies, redirectCount, response, url: currentUrl };
    }

    redirectCount += 1;
    currentUrl = nextUrl;
    if (response.status !== 307 && response.status !== 308) {
      currentMethod = "GET";
      currentBody = null;
    }
  }
}
