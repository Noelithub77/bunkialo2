import { getAttr, parseHtml, querySelector } from "@/utils/html-parser";
import type {
  WifixConnectivityResult,
  WifixLoginResult,
  WifixLogoutResult,
} from "@/types";

const CONNECTIVITY_CHECK_URL =
  "http://connectivitycheck.gstatic.com/generate_204";
const DEFAULT_PORTAL_BASE_URL = "http://172.16.222.1:1000";
const DEFAULT_LOGIN_PATH = "/login?0330598d1f22608a";
const DEFAULT_LOGOUT_PATH = "/logout?09080d0309080201";
const REQUEST_TIMEOUT_MS = 8000;

const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const extractPortalBaseUrl = (portalUrl: string | null): string | null => {
  if (!portalUrl) return null;
  try {
    const url = new URL(portalUrl);
    return url.origin;
  } catch {
    return null;
  }
};

const extractPortalUrlFromHtml = (html: string): string | null => {
  const match = html.match(/https?:\/\/[^"'\s>]+/i);
  if (!match) return null;
  return match[0];
};

const extractLoginFields = (
  html: string,
): { redirect: string | null; magic: string | null } => {
  const doc = parseHtml(html);
  const redirectInput = querySelector(doc, 'input[name="4Tredir"]');
  const magicInput = querySelector(doc, 'input[name="magic"]');

  const redirect = getAttr(redirectInput, "value");
  const magic = getAttr(magicInput, "value");

  if (redirect || magic) {
    return { redirect, magic };
  }

  const redirectMatch = html.match(/4Tredir" value="([^"]+)"/i);
  const magicMatch = html.match(/magic" value="([^"]+)"/i);

  return {
    redirect: redirectMatch?.[1] ?? null,
    magic: magicMatch?.[1] ?? null,
  };
};

export const checkConnectivity = async (): Promise<WifixConnectivityResult> => {
  try {
    const response = await fetchWithTimeout(CONNECTIVITY_CHECK_URL, {
      method: "GET",
      cache: "no-store",
    });

    if (response.status === 204) {
      return {
        state: "online",
        portalUrl: null,
        portalBaseUrl: null,
        statusCode: response.status,
        message: "Online",
      };
    }

    let portalUrl: string | null = null;
    if (response.url && response.url !== CONNECTIVITY_CHECK_URL) {
      portalUrl = response.url;
    } else {
      const body = await response.text();
      portalUrl = extractPortalUrlFromHtml(body);
    }

    return {
      state: portalUrl ? "captive" : "offline",
      portalUrl,
      portalBaseUrl: extractPortalBaseUrl(portalUrl),
      statusCode: response.status,
      message: portalUrl ? "Captive portal detected" : "Offline",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return {
      state: "offline",
      portalUrl: null,
      portalBaseUrl: null,
      statusCode: null,
      message,
    };
  }
};

export const loginToCaptivePortal = async (params: {
  username: string;
  password: string;
  portalUrl: string | null;
  portalBaseUrl: string | null;
}): Promise<WifixLoginResult> => {
  const portalBaseUrl =
    params.portalBaseUrl ?? extractPortalBaseUrl(params.portalUrl);
  const baseUrl = portalBaseUrl ?? DEFAULT_PORTAL_BASE_URL;

  const loginUrl = params.portalUrl?.includes("/login")
    ? params.portalUrl
    : `${baseUrl}${DEFAULT_LOGIN_PATH}`;

  try {
    const loginPageResponse = await fetchWithTimeout(loginUrl, {
      method: "GET",
      cache: "no-store",
    });

    const loginHtml = await loginPageResponse.text();
    const { redirect, magic } = extractLoginFields(loginHtml);

    const formData = new URLSearchParams();
    if (redirect) formData.append("4Tredir", redirect);
    if (magic) formData.append("magic", magic);
    formData.append("username", params.username);
    formData.append("password", params.password);

    const postUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

    const loginResponse = await fetchWithTimeout(postUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const success = loginResponse.status >= 200 && loginResponse.status < 400;
    return {
      success,
      portalBaseUrl: baseUrl,
      statusCode: loginResponse.status,
      message: success
        ? "Login successful"
        : `Login failed (code ${loginResponse.status})`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return {
      success: false,
      portalBaseUrl: baseUrl,
      statusCode: null,
      message,
    };
  }
};

export const logoutFromCaptivePortal = async (params: {
  portalUrl: string | null;
  portalBaseUrl: string | null;
}): Promise<WifixLogoutResult> => {
  const portalBaseUrl =
    params.portalBaseUrl ?? extractPortalBaseUrl(params.portalUrl);
  const baseUrl = portalBaseUrl ?? DEFAULT_PORTAL_BASE_URL;
  const logoutUrl = baseUrl.endsWith("/")
    ? `${baseUrl}${DEFAULT_LOGOUT_PATH.slice(1)}`
    : `${baseUrl}${DEFAULT_LOGOUT_PATH}`;

  try {
    const response = await fetchWithTimeout(logoutUrl, {
      method: "GET",
      cache: "no-store",
    });

    const success = response.status >= 200 && response.status < 400;
    return {
      success,
      portalBaseUrl: baseUrl,
      statusCode: response.status,
      message: success
        ? "Logged out of WiFi"
        : `Logout failed (code ${response.status})`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Logout failed";
    return {
      success: false,
      portalBaseUrl: baseUrl,
      statusCode: null,
      message,
    };
  }
};

export const getDefaultPortalBaseUrl = (): string => DEFAULT_PORTAL_BASE_URL;
