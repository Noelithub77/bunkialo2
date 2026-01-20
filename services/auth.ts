import type { Credentials, LoginFormData } from "@/types";
import { debug } from "@/utils/debug";
import {
    getAttr,
    hasMatch,
    parseHtml,
    querySelector,
    querySelectorAll,
} from "@/utils/html-parser";
import * as SecureStore from "expo-secure-store";
import { api, clearCookies, getDebugInfo, updateBaseUrl } from "./api";

const CREDENTIALS_KEY = "lms_credentials";

// Extract login token from the login page
const extractLoginToken = (html: string): string | null => {
  const doc = parseHtml(html);
  const tokenInput = querySelector(doc, 'input[name="logintoken"]');
  const token = getAttr(tokenInput, "value");

  debug.auth(
    `Login token extracted: ${token ? token.substring(0, 20) + "..." : "NOT FOUND"}`,
  );

  return token;
};

// Check if login was successful by looking for user menu or error messages
const isLoginSuccessful = (html: string): boolean => {
  const doc = parseHtml(html);

  // Check for logged-in indicators
  const hasUserMenu = hasMatch(
    doc,
    ".usermenu, .userloggedinas, #loggedin-user, .logininfo",
  );
  const allLinks = querySelectorAll(doc, "a");
  const hasLogoutLink = allLinks.some((el) => {
    const href = getAttr(el, "href");
    return href?.includes("logout");
  });

  // Check for error indicators
  const hasError = hasMatch(
    doc,
    ".loginerrors, .alert-danger, #loginerrormessage",
  );

  debug.auth("Login success check:", {
    hasUserMenu,
    hasLogoutLink,
    hasError,
    totalLinks: allLinks.length,
  });

  return (hasUserMenu || hasLogoutLink) && !hasError;
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
  debug.auth(`=== LOGIN ATTEMPT: ${username} ===`);

  // Clear any existing session
  clearSession();

  // Set base URL based on username year
  updateBaseUrl(username);

  // Step 1: Get the login page to extract CSRF token
  debug.auth("Step 1: Fetching login page...");
  const loginPageResponse = await api.get<string>("/login/index.php");
  debug.auth(`Login page size: ${loginPageResponse.data.length} chars`);

  const loginToken = extractLoginToken(loginPageResponse.data);

  if (!loginToken) {
    debug.auth("ERROR: Could not extract login token");
    throw new Error("Could not extract login token from page");
  }

  // Step 2: Submit login form
  debug.auth("Step 2: Submitting login form...");
  const formDataObj: LoginFormData = {
    anchor: "",
    logintoken: loginToken,
    username: username,
    password: password,
  };

  const formData = new URLSearchParams({
    anchor: formDataObj.anchor,
    logintoken: formDataObj.logintoken,
    username: formDataObj.username,
    password: formDataObj.password,
  });

  debug.auth("Form data:", {
    anchor: "",
    logintoken: loginToken.substring(0, 10) + "...",
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

  debug.auth(`Login response size: ${loginResponse.data.length} chars`);

  // Step 3: Verify login success
  debug.auth("Step 3: Verifying login success...");
  const isSuccess = isLoginSuccessful(loginResponse.data);

  debug.auth(`Login result: ${isSuccess ? "SUCCESS" : "FAILED"}`);
  debug.auth("Debug info:", getDebugInfo());

  if (isSuccess) {
    await saveCredentials(username, password);
  }

  return isSuccess;
};

// Check if we have a valid session
export const checkSession = async (): Promise<boolean> => {
  debug.auth("Checking session validity...");
  try {
    const response = await api.get<string>("/my/");
    const isValid = isLoginSuccessful(response.data);
    debug.auth(`Session valid: ${isValid}`);
    return isValid;
  } catch (error) {
    debug.auth(`Session check error: ${error}`);
    return false;
  }
};

// Try to restore session using saved credentials
export const tryAutoLogin = async (): Promise<boolean> => {
  debug.auth("=== AUTO LOGIN ATTEMPT ===");

  const credentials = await getCredentials();
  if (!credentials) {
    debug.auth("No credentials found, cannot auto-login");
    return false;
  }

  // First check if current session is valid
  const hasValidSession = await checkSession();
  if (hasValidSession) {
    debug.auth("Existing session is valid");
    return true;
  }

  // Session expired, try to login again
  debug.auth("Session expired, re-authenticating...");
  return await login(credentials.username, credentials.password);
};

// Logout - clear session and optionally credentials
export const logout = async (clearSavedCredentials = true) => {
  debug.auth("=== LOGOUT ===");
  clearSession();
  if (clearSavedCredentials) {
    await clearCredentials();
  }
  debug.auth("Logout complete");
};

// Export debug helper
export const getAuthDebugInfo = () => ({
  ...getDebugInfo(),
});
