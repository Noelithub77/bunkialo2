import { WIFIX_DEFAULT_PORT, WIFIX_KEEPALIVE_PATH } from "@/constants/wifix";
import type {
  WifixConnectivityResult,
  WifixLoginResult,
  WifixLogoutResult,
  WifixPortalSource,
} from "@/types";
import { debug } from "@/utils/debug";
import { getAttr, parseHtml, querySelector } from "@/utils/html-parser";
import { wifixLogger } from "@/utils/wifix-logger";

const CONNECTIVITY_CHECK_URL =
  "http://connectivitycheck.gstatic.com/generate_204";
const DEFAULT_PORTAL_BASE_URL = "http://172.16.222.1:1000";
const DEFAULT_LOGIN_PATH = "/login?0330598d1f22608a";
const DEFAULT_LOGOUT_PATH = "/logout?0307020009020400";
const REQUEST_TIMEOUT_MS = 8000;

export const getPortalBaseUrl = (portalUrl: string | null): string | null => {
  if (!portalUrl) return null;
  try {
    const url = new URL(portalUrl);
    return url.origin;
  } catch {
    return null;
  }
};

const normalizeUrlForCompare = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
};

const isConnectivityCheckUrl = (url: string | null): boolean => {
  if (!url) return false;
  const normalizedTarget = normalizeUrlForCompare(CONNECTIVITY_CHECK_URL);
  const normalizedUrl = normalizeUrlForCompare(url);
  return Boolean(
    normalizedTarget &&
      normalizedUrl &&
      normalizedTarget === normalizedUrl,
  );
};

const resolveAbsoluteUrl = (
  candidate: string,
  baseUrl: string | null,
): string | null => {
  try {
    if (baseUrl) {
      return new URL(candidate, baseUrl).toString();
    }
    return new URL(candidate).toString();
  } catch {
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
      return candidate;
    }
    return null;
  }
};

const normalizePortalCandidate = (
  candidate: string | null,
  baseUrl: string | null = null,
): string | null => {
  if (!candidate) return null;
  const resolved = resolveAbsoluteUrl(candidate, baseUrl);
  if (!resolved) return null;
  return isConnectivityCheckUrl(resolved) ? null : resolved;
};

export const normalizePortalUrlInput = (input: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `http://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (!url.port) {
      url.port = WIFIX_DEFAULT_PORT;
    }

    const [keepalivePath, keepaliveQuery] =
      WIFIX_KEEPALIVE_PATH.split("?");
    const hasPath = url.pathname && url.pathname !== "/";
    if (!hasPath) {
      url.pathname = keepalivePath || "/keepalive";
      url.search = keepaliveQuery ? `?${keepaliveQuery}` : "";
    } else if (url.pathname === (keepalivePath || "/keepalive") && !url.search) {
      url.search = keepaliveQuery ? `?${keepaliveQuery}` : "";
    }

    return url.toString();
  } catch {
    return null;
  }
};

export const resolvePortalSelection = (params: {
  detectedPortalUrl: string | null;
  detectedPortalBaseUrl: string | null;
  manualPortalUrl: string | null;
  portalSource: WifixPortalSource;
}): {
  portalUrl: string | null;
  portalBaseUrl: string | null;
  source: WifixPortalSource;
  normalizedManualUrl: string | null;
} => {
  const normalizedManualUrl = normalizePortalUrlInput(params.manualPortalUrl);
  const manualBaseUrl = getPortalBaseUrl(normalizedManualUrl);
  const autoBaseUrl =
    params.detectedPortalBaseUrl ?? getPortalBaseUrl(params.detectedPortalUrl);

  if (params.portalSource === "manual") {
    if (normalizedManualUrl) {
      return {
        portalUrl: normalizedManualUrl,
        portalBaseUrl: manualBaseUrl,
        source: "manual",
        normalizedManualUrl,
      };
    }
    if (params.detectedPortalUrl || autoBaseUrl) {
      return {
        portalUrl: params.detectedPortalUrl,
        portalBaseUrl: autoBaseUrl,
        source: "auto",
        normalizedManualUrl,
      };
    }
    return {
      portalUrl: null,
      portalBaseUrl: null,
      source: "manual",
      normalizedManualUrl,
    };
  }

  if (params.detectedPortalUrl || autoBaseUrl) {
    return {
      portalUrl: params.detectedPortalUrl,
      portalBaseUrl: autoBaseUrl,
      source: "auto",
      normalizedManualUrl,
    };
  }

  if (normalizedManualUrl) {
    return {
      portalUrl: normalizedManualUrl,
      portalBaseUrl: manualBaseUrl,
      source: "manual",
      normalizedManualUrl,
    };
  }

  return {
    portalUrl: null,
    portalBaseUrl: null,
    source: "auto",
    normalizedManualUrl,
  };
};

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

const extractPortalUrlFromHtml = (html: string): string | null => {
  const windowMatch = html.match(/window\.location\s*=\s*["']([^"']+)["']/i);
  if (windowMatch?.[1]) return windowMatch[1];

  const metaRefreshMatch = html.match(
    /http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"']+)["']/i,
  );
  if (metaRefreshMatch?.[1]) return metaRefreshMatch[1];

  const metaUrlMatch = html.match(/<meta[^>]+url=['"]?([^'">\s]+)/i);
  if (metaUrlMatch?.[1]) return metaUrlMatch[1];

  const doc = parseHtml(html);
  const baseHref = getAttr(querySelector(doc, "base[href]"), "href");
  const formAction = getAttr(querySelector(doc, "form[action]"), "action");
  const linkHref = getAttr(querySelector(doc, "a[href]"), "href");

  const candidates = [formAction, baseHref, linkHref];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = resolveAbsoluteUrl(candidate, baseHref);
    if (resolved) return resolved;
  }

  const urlMatch = html.match(/https?:\/\/[^"'\s>]+/i);
  return urlMatch?.[0] ?? null;
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
  debug.wifix("Step 1: Checking connectivity");
  wifixLogger.info("Starting connectivity check...");

  try {
    wifixLogger.info(`Connectivity check URL: ${CONNECTIVITY_CHECK_URL}`);
    const response = await fetchWithTimeout(CONNECTIVITY_CHECK_URL, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
    });

    debug.wifix("Step 2: Response received", { status: response.status });
    wifixLogger.info(`Response received: ${response.status}`);

    if (response.status === 204) {
      debug.wifix("Step 3: Online - no captive portal");
      wifixLogger.success("Connection successful: Online (no captive portal)");
      return {
        state: "online",
        portalUrl: null,
        portalBaseUrl: null,
        statusCode: response.status,
        message: "Online",
      };
    }

    let portalUrl: string | null = null;
    const locationHeader = response.headers.get("Location");

    if (locationHeader) {
      wifixLogger.info(`Location header detected: ${locationHeader}`);
    } else {
      wifixLogger.info("No Location header in response");
    }

    if (response.url) {
      wifixLogger.info(`Response URL: ${response.url}`);
    } else {
      wifixLogger.info("No response URL reported by fetch");
    }

    const portalFromLocation = normalizePortalCandidate(locationHeader);
    const portalFromResponseUrl = normalizePortalCandidate(response.url);

    if (locationHeader && !portalFromLocation) {
      wifixLogger.info("Location header ignored (matches connectivity URL)");
    }

    if (response.url && !portalFromResponseUrl) {
      wifixLogger.info("Response URL ignored (matches connectivity URL)");
    }

    if (portalFromLocation) {
      portalUrl = portalFromLocation;
      debug.wifix("Step 3: Captive portal found in location header", {
        portalUrl,
      });
      wifixLogger.info(`Captive portal detected in location header`);
    } else if (portalFromResponseUrl) {
      portalUrl = portalFromResponseUrl;
      debug.wifix("Step 3: Captive portal found in response URL", {
        portalUrl,
      });
      wifixLogger.info(`Captive portal detected in response URL`);
    } else {
      const body = await response.text();
      wifixLogger.info(
        `HTML body length: ${body.length} characters (extracting portal URL)`,
      );
      const portalFromHtml = normalizePortalCandidate(
        extractPortalUrlFromHtml(body),
      );
      portalUrl = portalFromHtml;
      debug.wifix("Step 3: Captive portal found in HTML", { portalUrl });
      if (portalUrl) {
        wifixLogger.info(`Captive portal detected in HTML content`);
      } else {
        wifixLogger.info("No portal URL found in HTML content");
      }
    }

    const state = "captive";
    debug.wifix("Step 4: Connectivity check complete", {
      state,
    });

    if (portalUrl) {
      wifixLogger.success(`Captive portal detected: ${portalUrl}`);
    } else {
      wifixLogger.info("Captive portal detected (no portal URL in response)");
    }

    return {
      state,
      portalUrl,
      portalBaseUrl: getPortalBaseUrl(portalUrl),
      statusCode: response.status,
      message: portalUrl
        ? "Captive portal detected"
        : "Captive portal detected (no portal URL)",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    debug.wifix("Step 3: Connectivity check failed", { message });
    wifixLogger.error(`Connectivity check failed: ${message}`);
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
  debug.wifix("Step 1: Starting captive portal login");
  wifixLogger.info("Starting captive portal login...");

  const portalBaseUrl =
    params.portalBaseUrl ?? getPortalBaseUrl(params.portalUrl);
  const baseUrl = portalBaseUrl ?? DEFAULT_PORTAL_BASE_URL;

  const loginUrl = params.portalUrl?.includes("/login")
    ? params.portalUrl
    : `${baseUrl}${DEFAULT_LOGIN_PATH}`;

  debug.wifix("Step 2: Fetching login page", { loginUrl });
  wifixLogger.info(`Fetching login page: ${loginUrl}`);

  try {
    const loginPageResponse = await fetchWithTimeout(loginUrl, {
      method: "GET",
      cache: "no-store",
    });

    const loginHtml = await loginPageResponse.text();
    const { redirect, magic } = extractLoginFields(loginHtml);
    debug.wifix("Step 3: Extracted login fields", { redirect, magic });
    wifixLogger.info(
      `Extracted login fields - redirect: ${redirect ? "found" : "not found"}, magic: ${magic ? "found" : "not found"}`,
    );

    const formData = new URLSearchParams();
    if (redirect) formData.append("4Tredir", redirect);
    if (magic) formData.append("magic", magic);
    formData.append("username", params.username);
    formData.append("password", params.password);

    const postUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

    debug.wifix("Step 4: Posting login credentials", { postUrl });
    wifixLogger.info(`Posting login credentials to: ${postUrl}`);

    const loginResponse = await fetchWithTimeout(postUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const success = loginResponse.status >= 200 && loginResponse.status < 400;
    const result = {
      success,
      portalBaseUrl: baseUrl,
      statusCode: loginResponse.status,
      message: success
        ? "Login successful"
        : `Login failed (code ${loginResponse.status})`,
    };
    debug.wifix("Step 5: Login complete", { success: result.success });

    if (success) {
      wifixLogger.success(`Login successful! Status: ${loginResponse.status}`);
    } else {
      wifixLogger.error(`Login failed: Status ${loginResponse.status}`);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    debug.wifix("Step 4: Login failed", { message });
    wifixLogger.error(`Login error: ${message}`);
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
  debug.wifix("Step 1: Starting captive portal logout");
  wifixLogger.info("Starting captive portal logout...");

  const portalBaseUrl =
    params.portalBaseUrl ?? getPortalBaseUrl(params.portalUrl);
  const baseUrl = portalBaseUrl ?? DEFAULT_PORTAL_BASE_URL;
  const logoutUrl = baseUrl.endsWith("/")
    ? `${baseUrl}${DEFAULT_LOGOUT_PATH.slice(1)}`
    : `${baseUrl}${DEFAULT_LOGOUT_PATH}`;

  debug.wifix("Step 2: Requesting logout", { logoutUrl });
  wifixLogger.info(`Requesting logout: ${logoutUrl}`);

  try {
    const response = await fetchWithTimeout(logoutUrl, {
      method: "GET",
      cache: "no-store",
    });

    const success = response.status >= 200 && response.status < 400;
    const result = {
      success,
      portalBaseUrl: baseUrl,
      statusCode: response.status,
      message: success
        ? "Logged out of WiFi"
        : `Logout failed (code ${response.status})`,
    };
    debug.wifix("Step 3: Logout complete", { success: result.success });

    if (success) {
      wifixLogger.success(`Logout successful! Status: ${response.status}`);
    } else {
      wifixLogger.error(`Logout failed: Status ${response.status}`);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Logout failed";
    debug.wifix("Step 2: Logout failed", { message });
    wifixLogger.error(`Logout error: ${message}`);
    return {
      success: false,
      portalBaseUrl: baseUrl,
      statusCode: null,
      message,
    };
  }
};

export const getDefaultPortalBaseUrl = (): string => DEFAULT_PORTAL_BASE_URL;
