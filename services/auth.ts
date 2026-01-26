import type { Credentials } from "@/types";
import { debug } from "@/utils/debug";
import {
  getAttr,
  getText,
  hasMatch,
  parseHtml,
  querySelector,
  querySelectorAll,
} from "@/utils/html-parser";
import * as SecureStore from "expo-secure-store";
import {
  api,
  clearCookies,
  getCurrentBaseUrl,
  getDebugInfo,
  setReauthEnabled,
  updateBaseUrl,
} from "./api";

const CREDENTIALS_KEY = "lms_credentials";
let authEpoch = 0;

const bumpAuthEpoch = (): number => {
  authEpoch += 1;
  return authEpoch;
};

const isStaleAttempt = (attemptEpoch: number): boolean =>
  attemptEpoch !== authEpoch;

type LoginDiagnostics = {
  hasUserMenu: boolean;
  hasLogoutLink: boolean;
  hasLoginForm: boolean;
  hasSesskey: boolean;
  hasError: boolean;
  errorMessage: string | null;
  totalLinks: number;
};

const summarizeHtml = (html: string) => {
  const head = html.slice(0, 5000);
  const condensed = head.replace(/\s+/g, " ").trim();
  const titleMatch = condensed.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;
  const snippet = condensed.slice(0, 160);
  const hasLoginToken = /name=["']logintoken["']/i.test(condensed);
  const hasLoginForm =
    /<form[^>]*id=["']login["']/i.test(condensed) ||
    /<form[^>]*action=["'][^"']*login/i.test(condensed);
  const hasSesskey = /"sesskey":"[^"]+"/i.test(condensed);
  return { title, snippet, hasLoginToken, hasLoginForm, hasSesskey };
};

const extractLoginError = (doc: ReturnType<typeof parseHtml>): string | null => {
  const errorNode = querySelector(
    doc,
    ".loginerrors, .alert-danger, #loginerrormessage",
  );
  const message = getText(errorNode);
  return message ? message.slice(0, 160) : null;
};

const getLoginDiagnostics = (html: string): LoginDiagnostics => {
  const doc = parseHtml(html);

  const hasUserMenu = hasMatch(
    doc,
    ".usermenu, .userloggedinas, #loggedin-user, .logininfo",
  );
  const hasLoginForm =
    hasMatch(doc, "form#login") ||
    hasMatch(doc, 'input[name="logintoken"]');
  const allLinks = querySelectorAll(doc, "a");
  const hasLogoutLink = allLinks.some((el) => {
    const href = getAttr(el, "href");
    return href?.includes("logout");
  });
  const errorMessage = extractLoginError(doc);
  const hasError =
    Boolean(errorMessage) ||
    hasMatch(doc, ".loginerrors, .alert-danger, #loginerrormessage");
  const hasSesskey = /"sesskey":"[^"]+"/i.test(html);

  return {
    hasUserMenu,
    hasLogoutLink,
    hasLoginForm,
    hasSesskey,
    hasError,
    errorMessage,
    totalLinks: allLinks.length,
  };
};

const isLoginSuccessful = (diagnostics: LoginDiagnostics): boolean =>
  (diagnostics.hasUserMenu ||
    diagnostics.hasLogoutLink ||
    (diagnostics.hasSesskey && !diagnostics.hasLoginForm)) &&
  !diagnostics.hasError;

// Extract login token from the login page
const extractLoginToken = (html: string): string | null => {
  const doc = parseHtml(html);
  const tokenInput = querySelector(doc, 'input[name="logintoken"]');
  const token = getAttr(tokenInput, "value");

  if (token) {
    debug.auth(`Login token extracted: ${token.substring(0, 20)}...`);
    return token;
  }

  const patterns = [
    /name=["']logintoken["'][^>]*value=["']([^"']+)["']/i,
    /value=["']([^"']+)["'][^>]*name=["']logintoken["']/i,
    /["']logintoken["']\s*[:=]\s*["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      debug.auth(
        `Login token extracted (regex): ${match[1].substring(0, 20)}...`,
      );
      return match[1];
    }
  }

  debug.auth("Login token not found");
  return null;
};

// Save credentials securely
export const saveCredentials = async (username: string, password: string) => {
  await SecureStore.setItemAsync(
    CREDENTIALS_KEY,
    JSON.stringify({ username, password }),
  );
  debug.auth(`Credentials saved for: ${username}`);
};

// Get saved credentials
export const getCredentials = async (): Promise<Credentials | null> => {
  const stored = await SecureStore.getItemAsync(CREDENTIALS_KEY);
  if (!stored) {
    debug.auth("No stored credentials found");
    return null;
  }
  const parsed = JSON.parse(stored) as Credentials;
  debug.auth(`Credentials loaded for: ${parsed.username}`);
  return parsed;
};

// Clear saved credentials
export const clearCredentials = async () => {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
  debug.auth("Credentials cleared");
};

// Clear session (cookies)
export const clearSession = () => {
  clearCookies();
  debug.auth("Session cleared");
};

// Login to Moodle LMS
export const login = async (
  username: string,
  password: string,
): Promise<boolean> => {
  const attemptEpoch = authEpoch;
  debug.auth("Login start", { username });
  debug.auth(`=== LOGIN ATTEMPT: ${username} ===`);

  // Clear any existing session
  clearSession();

  // Set base URL based on username year
  updateBaseUrl(username);
  debug.auth("Base URL selected", { baseUrl: getCurrentBaseUrl() });

  // Step 1: Get the login page to extract CSRF token
  debug.auth("Step 1: Fetching login page...");
  const loginPageResponse = await api.get<string>("/login/index.php");
  debug.auth(`Login page size: ${loginPageResponse.data.length} chars`);
  debug.auth("Login page summary", {
    status: loginPageResponse.status,
    ...summarizeHtml(loginPageResponse.data),
  });
  if (isStaleAttempt(attemptEpoch)) {
    debug.auth("Login aborted after login page fetch");
    return false;
  }

  const loginToken = extractLoginToken(loginPageResponse.data);

  // Step 2: Submit login form
  debug.auth("Step 2: Submitting login form...");
  if (!loginToken) {
    debug.auth("Login token missing, attempting login without token");
  }

  const formData = new URLSearchParams();
  formData.append("anchor", "");
  if (loginToken) {
    formData.append("logintoken", loginToken);
  }
  formData.append("username", username);
  formData.append("password", password);

  debug.auth("Form data:", {
    anchor: "",
    logintoken: loginToken ? loginToken.substring(0, 10) + "..." : "MISSING",
    username,
    password: "***",
  });

  const loginResponse = await api.post<string>(
    "/login/index.php",
    formData.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  debug.auth("Login response summary", {
    status: loginResponse.status,
    ...summarizeHtml(loginResponse.data),
  });
  if (isStaleAttempt(attemptEpoch)) {
    debug.auth("Login aborted after login response");
    return false;
  }

  // Step 3: Verify login success
  debug.auth("Step 3: Verifying login success...");
  const loginDiagnostics = getLoginDiagnostics(loginResponse.data);
  debug.auth("Login diagnostics", loginDiagnostics);
  let isSuccess = isLoginSuccessful(loginDiagnostics);

  if (!isSuccess) {
    debug.auth("Login response check failed", {
      baseUrl: getCurrentBaseUrl(),
      errorMessage: loginDiagnostics.errorMessage,
    });
    const sessionValid = await checkSession();
    if (sessionValid) {
      debug.auth("Session valid after login response check");
      isSuccess = true;
    }
  }

  debug.auth(`Login result: ${isSuccess ? "SUCCESS" : "FAILED"}`);
  debug.auth("Debug info:", getDebugInfo());

  if (isStaleAttempt(attemptEpoch)) {
    debug.auth("Login aborted before saving credentials");
    return false;
  }

  if (isSuccess) {
    setReauthEnabled(true);
    await saveCredentials(username, password);
  }

  return isSuccess;
};

// Check if we have a valid session
export const checkSession = async (): Promise<boolean> => {
  const attemptEpoch = authEpoch;
  debug.auth("Checking session validity...");
  try {
    const response = await api.get<string>("/my/");
    const diagnostics = getLoginDiagnostics(response.data);
    debug.auth("Session diagnostics", diagnostics);
    const isValid = isLoginSuccessful(diagnostics);
    const stillValid = !isStaleAttempt(attemptEpoch) && isValid;
    debug.auth(`Session valid: ${stillValid}`);
    return stillValid;
  } catch (error) {
    debug.auth(`Session check error: ${error}`);
    return false;
  }
};

// Try to restore session using saved credentials
export const tryAutoLogin = async (): Promise<boolean> => {
  const attemptEpoch = authEpoch;
  debug.auth("=== AUTO LOGIN ATTEMPT ===");

  const credentials = await getCredentials();
  if (!credentials) {
    debug.auth("No credentials found, cannot auto-login");
    return false;
  }
  if (isStaleAttempt(attemptEpoch)) {
    debug.auth("Auto-login aborted after reading credentials");
    return false;
  }

  updateBaseUrl(credentials.username);
  debug.auth("Base URL selected (auto-login)", {
    username: credentials.username,
    baseUrl: getCurrentBaseUrl(),
  });
  if (isStaleAttempt(attemptEpoch)) {
    debug.auth("Auto-login aborted after base URL update");
    return false;
  }

  // First check if current session is valid
  const hasValidSession = await checkSession();
  if (isStaleAttempt(attemptEpoch)) {
    debug.auth("Auto-login aborted after session check");
    return false;
  }
  if (hasValidSession) {
    setReauthEnabled(true);
    debug.auth("Existing session is valid");
    return true;
  }

  // Session expired, try to login again
  debug.auth("Session expired, re-authenticating...");
  const loginSuccess = await login(credentials.username, credentials.password);
  if (isStaleAttempt(attemptEpoch)) {
    debug.auth("Auto-login aborted after re-auth");
    return false;
  }
  return loginSuccess;
};

// Logout - clear session and optionally credentials
export const logout = async (clearSavedCredentials = true) => {
  debug.auth("=== LOGOUT ===");
  bumpAuthEpoch();
  setReauthEnabled(false);
  clearSession();
  updateBaseUrl();
  if (clearSavedCredentials) {
    try {
      await clearCredentials();
    } catch (error) {
      debug.auth(`Failed to clear credentials: ${error}`);
    }
  }
  debug.auth("Logout complete");
};

// Export debug helper
export const getAuthDebugInfo = () => ({
  ...getDebugInfo(),
});
