import { debug } from "@/utils/debug";
import type { AxiosRequestConfig } from "axios";
import axios from "axios";
import { getBaseUrl as getBaseUrlFromStore } from "./baseurl";
import { cookieStore } from "./cookie-store";

const DEFAULT_BASE_URL = "https://lmsug24.iiitkottayam.ac.in";
let currentBaseUrl = DEFAULT_BASE_URL; // lazy init to avoid circular dep

// Re-auth state
let isReauthenticating = false;
let reauthPromise: Promise<boolean> | null = null;

// Check if response indicates session expired (redirected to login)
const isSessionExpired = (html: string, url: string): boolean => {
  if (url?.includes("/login/index.php")) return false; // skip login page itself
  const hasLoginForm =
    html?.includes('name="logintoken"') || html?.includes('id="login"');
  return hasLoginForm;
};

// Axios instance for LMS requests
export const api = axios.create({
  baseURL: currentBaseUrl,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0.4472.120 Mobile",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
  },
  maxRedirects: 5,
  timeout: 30000,
});

// Request interceptor: attach cookies to outgoing requests
api.interceptors.request.use((config) => {
  const cookieHeader = cookieStore.getCookieHeader();
  if (cookieHeader) {
    config.headers.Cookie = cookieHeader;
  }

  debug.api(`REQUEST: ${config.method?.toUpperCase()} ${config.url}`);
  debug.api(`Cookies attached: ${cookieStore.getCookieCount()}`);

  return config;
});

// Response interceptor: detect session expiry and auto-retry
api.interceptors.response.use(
  async (response) => {
    const setCookie = response.headers["set-cookie"];
    if (setCookie) {
      debug.api(`Response has Set-Cookie header`);
      cookieStore.setCookiesFromHeader(setCookie);
    }

    debug.api(`RESPONSE: ${response.status} ${response.config.url}`);
    debug.api(`Response size: ${response.data?.length || 0} chars`);

    // Check for session expiry (HTML response with login form)
    const url = response.config.url || "";
    const isRetry = response.config.headers?.["X-Retry-After-Reauth"];

    if (
      !isRetry &&
      typeof response.data === "string" &&
      isSessionExpired(response.data, url)
    ) {
      debug.api("Session expired detected, attempting re-auth...");

      const reauthSuccess = await handleReauth();
      if (reauthSuccess) {
        debug.api("Re-auth successful, retrying original request...");
        const retryConfig: AxiosRequestConfig = {
          ...response.config,
          headers: {
            ...response.config.headers,
            "X-Retry-After-Reauth": "true",
          },
        };
        return api.request(retryConfig);
      }
      debug.api("Re-auth failed, returning original response");
    }

    return response;
  },
  (error) => {
    debug.api(`ERROR: ${error.message}`);
    if (error.response) {
      debug.api(`Status: ${error.response.status}`);
    }
    return Promise.reject(error);
  },
);

// Handle re-authentication with mutex
const handleReauth = async (): Promise<boolean> => {
  if (isReauthenticating && reauthPromise) {
    debug.api("Re-auth in progress, waiting...");
    return reauthPromise;
  }

  isReauthenticating = true;
  reauthPromise = performReauth();

  try {
    return await reauthPromise;
  } finally {
    isReauthenticating = false;
    reauthPromise = null;
  }
};

const performReauth = async (): Promise<boolean> => {
  try {
    // dynamic import to avoid circular dependency
    const { getCredentials, login } = await import("./auth");
    const credentials = await getCredentials();

    if (!credentials) {
      debug.api("No credentials stored, cannot re-auth");
      return false;
    }

    debug.api(`Re-authenticating as ${credentials.username}...`);
    return await login(credentials.username, credentials.password);
  } catch (error) {
    debug.api(`Re-auth error: ${error}`);
    return false;
  }
};

// Update base URL based on username
export const updateBaseUrl = () => {
  const newBaseUrl = getBaseUrlFromStore();
  currentBaseUrl = newBaseUrl;
  api.defaults.baseURL = newBaseUrl;
  debug.api(`Base URL updated to: ${newBaseUrl}`);
};

// Get current base URL
export const getCurrentBaseUrl = () => currentBaseUrl;

// Clear all cookies
export const clearCookies = () => {
  cookieStore.clear();
};

// Get debug info
export const getDebugInfo = () => ({
  baseUrl: currentBaseUrl,
  cookieCount: cookieStore.getCookieCount(),
  cookies: cookieStore.getAllCookies(),
});

export { currentBaseUrl as BASE_URL };

