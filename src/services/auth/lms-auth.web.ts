import type { Credentials } from "@/types";
import { getBaseUrl } from "../baseurl";
import { offerWebCredential, preventAutomaticWebSignIn } from "./web-password-manager.web";

let username: string | null = null;
const USERNAME_KEY = "bunkialo_lms_username";

export const saveCredentials = async (
  nextUsername: string,
  password: string,
): Promise<void> => {
  username = nextUsername;
  localStorage.setItem(USERNAME_KEY, nextUsername);
  await offerWebCredential({
    identifier: nextUsername,
    name: "Bunkialo LMS",
    password,
  });
};

export const getCredentials = async (): Promise<Credentials | null> => {
  const savedUsername = localStorage.getItem(USERNAME_KEY)?.trim();
  return savedUsername ? { username: savedUsername, password: "" } : null;
};

export const clearCredentials = async (): Promise<void> => {
  username = null;
  localStorage.removeItem(USERNAME_KEY);
  await preventAutomaticWebSignIn();
};

export const clearSession = (): void => undefined;

export const login = async (
  nextUsername: string,
  password: string,
): Promise<boolean> => {
  const response = await fetch("/api/auth/lms/login", {
    body: JSON.stringify({ password, username: nextUsername }),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) return false;
  const data = await response.json() as { success?: boolean };
  if (!data.success) return false;
  username = nextUsername;
  await saveCredentials(nextUsername, password);
  return true;
};

export const checkSession = async (): Promise<boolean> => {
  const response = await fetch("/api/auth/lms/session", {
    credentials: "same-origin",
  });
  if (!response.ok) return false;
  const data = await response.json() as { valid?: boolean };
  return data.valid === true;
};

export const tryAutoLogin = async (): Promise<boolean> => checkSession();
export const refreshAuthSession = async (): Promise<boolean> => checkSession();

export const logout = async (clearSavedCredentials = true): Promise<void> => {
  await fetch("/api/auth/logout", {
    credentials: "same-origin",
    method: "POST",
  });
  if (clearSavedCredentials) await clearCredentials();
};

export const getAuthDebugInfo = (): {
  baseUrl: string;
  cookieCount: number;
  cookies: Record<string, string>;
  hasCredentials: boolean;
} => ({
  baseUrl: getBaseUrl(username),
  cookieCount: 0,
  cookies: {},
  hasCredentials: false,
});
