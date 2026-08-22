import type { Credentials } from "@/types";
import { z } from "zod";
import { getBaseUrl } from "../baseurl";
import { offerWebCredential, preventAutomaticWebSignIn } from "./web-password-manager.web";

let username: string | null = null;
const CREDENTIALS_KEY = "bunkialo_lms_credentials_v1";
const LEGACY_USERNAME_KEY = "bunkialo_lms_username";
const credentialsSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export const saveCredentials = async (
  nextUsername: string,
  password: string,
): Promise<void> => {
  const credentials = credentialsSchema.parse({
    username: nextUsername,
    password,
  });
  username = credentials.username;
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
  localStorage.removeItem(LEGACY_USERNAME_KEY);
  await offerWebCredential({
    identifier: credentials.username,
    name: "Bunkialo LMS",
    password: credentials.password,
  });
};

export const getCredentials = async (): Promise<Credentials | null> => {
  const saved = localStorage.getItem(CREDENTIALS_KEY);
  if (!saved) return null;

  try {
    const credentials = credentialsSchema.parse(JSON.parse(saved));
    username = credentials.username;
    return credentials;
  } catch {
    localStorage.removeItem(CREDENTIALS_KEY);
    return null;
  }
};

export const clearCredentials = async (): Promise<void> => {
  username = null;
  localStorage.removeItem(CREDENTIALS_KEY);
  localStorage.removeItem(LEGACY_USERNAME_KEY);
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

export const tryAutoLogin = async (): Promise<boolean> => {
  const credentials = await getCredentials();
  if (!credentials) return false;
  if (await checkSession()) return true;
  return login(credentials.username, credentials.password);
};

export const refreshAuthSession = async (): Promise<boolean> => {
  const credentials = await getCredentials();
  return credentials ? login(credentials.username, credentials.password) : false;
};

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
  hasCredentials: localStorage.getItem(CREDENTIALS_KEY) !== null,
});
