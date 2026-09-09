import type { DesktopPairingCode } from "@/types";

export interface DesktopPairingStatus {
  paired: boolean;
}

export const DESKTOP_PAIRING_ROUTE = "/pair/desktop" as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isDesktopPairingObject = (value: unknown): value is DesktopPairingCode => {
  if (!isRecord(value) || Array.isArray(value)) return false;
  const entries = Object.entries(value) as [string, unknown][];
  return entries.length === 2 && entries.every(([username, password]) =>
    username.length > 0 && typeof password === "string" && password.length > 0,
  );
};

const readJson = async (response: Response): Promise<Record<string, unknown>> => {
  const value: unknown = await response.json();
  return isRecord(value) ? value : {};
};

const responseError = async (response: Response, fallback: string): Promise<Error> => {
  const data = await readJson(response);
  return new Error(typeof data.error === "string" ? data.error : fallback);
};

export const isDesktopPairingCode = (value: string): boolean => {
  try {
    return isDesktopPairingObject(JSON.parse(value));
  } catch {
    return false;
  }
};

export const getDesktopPairingStatus = async (): Promise<boolean> => {
  const response = await fetch("/api/desktop/pair", { credentials: "same-origin" });
  if (!response.ok) return false;
  const data = await readJson(response);
  return data.paired === true;
};

export const createDesktopPairing = async (): Promise<string> => {
  const response = await fetch("/api/desktop/pair", {
    credentials: "same-origin",
    method: "POST",
  });
  if (!response.ok) throw await responseError(response, "Could not create desktop pairing.");
  const data = await readJson(response);
  if (typeof data.code !== "string" || !isDesktopPairingCode(data.code)) {
    throw new Error("Bunkialo returned an invalid pairing code.");
  }
  return data.code;
};

export const revokeDesktopPairing = async (): Promise<void> => {
  const response = await fetch("/api/desktop/pair", {
    credentials: "same-origin",
    method: "DELETE",
  });
  if (!response.ok) throw await responseError(response, "Could not revoke desktop pairing.");
};
