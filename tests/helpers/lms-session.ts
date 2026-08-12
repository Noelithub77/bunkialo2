import fs from "node:fs";
import path from "node:path";
import { CookieJar } from "tough-cookie";

const DEFAULT_BASE_URL = "https://lmsug24.iiitkottayam.ac.in";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const MAX_REDIRECTS = 10;

export interface LmsSessionOptions {
  baseUrl?: string;
  username?: string;
  password?: string;
  userAgent?: string;
}

export interface LmsSession {
  baseUrl: string;
  username: string;
  fetchWithCookies: (
    url: string,
    options?: RequestInit,
  ) => Promise<Response>;
  fetchWithSession: (
    url: string,
    options?: RequestInit,
  ) => Promise<Response>;
  toAbsoluteUrl: (href: string) => string | null;
  login: () => Promise<boolean>;
  ensureSession: () => Promise<boolean>;
  checkSession: () => Promise<boolean>;
  getSesskey: () => Promise<string | null>;
  getCookieCount: () => Promise<number>;
}

const getRepoRoot = (): string => path.resolve(__dirname, "..", "..");

export const loadEnvFromRoot = (): void => {
  const envPath = path.join(getRepoRoot(), ".env");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
};

export const isLoginHtml = (html: string): boolean => {
  const condensed = html.replace(/\s+/g, " ");
  return (
    condensed.includes('name="logintoken"') ||
    condensed.includes('id="login"') ||
    condensed.includes("/login/index.php")
  );
};

const isLoginSuccessful = (html: string): boolean => {
  const condensed = html.replace(/\s+/g, " ");
  const hasUserMenu =
    condensed.includes("usermenu") ||
    condensed.includes("userloggedinas") ||
    condensed.includes("loggedin-user");
  const hasLogoutLink = /href=["'][^"']*logout/i.test(condensed);
  const hasLoginForm =
    /<form[^>]*id=["']login["']/i.test(condensed) ||
    /name=["']logintoken["']/i.test(condensed);
  const hasSesskey = /"sesskey":"[^"]+"/i.test(condensed);
  const hasError = /loginerrors|alert-danger|loginerrormessage/i.test(condensed);

  return (
    (hasUserMenu || hasLogoutLink || (hasSesskey && !hasLoginForm)) && !hasError
  );
};

const extractLoginToken = (html: string): string | null => {
  const tokenMatch =
    html.match(/name=["']logintoken["'][^>]*value=["']([^"']+)["']/i) ||
    html.match(/value=["']([^"']+)["'][^>]*name=["']logintoken["']/i);
  return tokenMatch?.[1] ?? null;
};

const collectSetCookieHeaders = (response: Response): string[] => {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
};

export const createLmsSession = ({
  baseUrl = process.env.LMS_BASE_URL || DEFAULT_BASE_URL,
  username = process.env.LMS_TEST_USERNAME,
  password = process.env.LMS_TEST_PASSWORD,
  userAgent = DEFAULT_USER_AGENT,
}: LmsSessionOptions = {}): LmsSession => {
  if (!username || !password) {
    throw new Error(
      "Missing LMS_TEST_USERNAME/LMS_TEST_PASSWORD. Set env vars or .env values.",
    );
  }

  const jar = new CookieJar();

  const toAbsoluteUrl = (href: string): string | null => {
    if (!href) return null;
    if (href.startsWith("http://") || href.startsWith("https://")) return href;
    if (href.startsWith("//")) return `https:${href}`;
    if (href.startsWith("/")) return `${baseUrl}${href}`;
    return `${baseUrl}/${href.replace(/^\.?\//, "")}`;
  };

  const storeResponseCookies = async (
    response: Response,
    url: string,
  ): Promise<void> => {
    for (const cookie of collectSetCookieHeaders(response)) {
      await jar.setCookie(cookie, url);
    }
  };

  const fetchWithCookies = async (
    url: string,
    options: RequestInit = {},
    redirectCount = 0,
  ): Promise<Response> => {
    const absoluteUrl = toAbsoluteUrl(url);
    if (!absoluteUrl) throw new Error("Invalid URL");

    const cookieHeader = await jar.getCookieString(absoluteUrl);
    const headers = new Headers(options.headers);
    headers.set("User-Agent", userAgent);
    if (!headers.has("Accept")) {
      headers.set(
        "Accept",
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      );
    }
    if (cookieHeader) headers.set("Cookie", cookieHeader);

    const response = await fetch(absoluteUrl, {
      ...options,
      headers,
      redirect: "manual",
    });
    await storeResponseCookies(response, absoluteUrl);

    if (response.status >= 300 && response.status < 400) {
      if (redirectCount >= MAX_REDIRECTS) {
        throw new Error("Too many redirects while fetching LMS URL");
      }
      const location = response.headers.get("location");
      if (!location) return response;
      const redirectUrl = new URL(location, absoluteUrl).toString();
      const preserveMethod = response.status === 307 || response.status === 308;
      return fetchWithCookies(
        redirectUrl,
        preserveMethod ? options : { method: "GET", headers: options.headers },
        redirectCount + 1,
      );
    }

    return response;
  };

  const responseLooksLikeLoginPage = async (
    response: Response,
  ): Promise<boolean> => {
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return false;
    }
    return isLoginHtml(await response.clone().text());
  };

  const login = async (): Promise<boolean> => {
    const loginPageResponse = await fetchWithCookies("/login/index.php");
    const loginToken = extractLoginToken(await loginPageResponse.text());
    if (!loginToken) return false;

    const formData = new URLSearchParams({
      anchor: "",
      logintoken: loginToken,
      username,
      password,
    });
    const loginResponse = await fetchWithCookies("/login/index.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
    return isLoginSuccessful(await loginResponse.text());
  };

  const fetchWithSession = async (
    url: string,
    options: RequestInit = {},
  ): Promise<Response> => {
    let response = await fetchWithCookies(url, options);
    if (!(await responseLooksLikeLoginPage(response))) return response;
    if (!(await login())) return response;
    response = await fetchWithCookies(url, options);
    return response;
  };

  const checkSession = async (): Promise<boolean> => {
    const response = await fetchWithCookies("/my/");
    return isLoginSuccessful(await response.text());
  };

  const ensureSession = async (): Promise<boolean> =>
    (await checkSession()) || (await login());

  const getSesskey = async (): Promise<string | null> => {
    if (!(await ensureSession())) return null;
    const html = await (await fetchWithSession("/my/")).text();
    return html.match(/"sesskey":"([^"]+)"/)?.[1] ?? null;
  };

  return {
    baseUrl,
    username,
    fetchWithCookies,
    fetchWithSession,
    toAbsoluteUrl,
    login,
    ensureSession,
    checkSession,
    getSesskey,
    getCookieCount: async () => (await jar.getCookies(baseUrl)).length,
  };
};
