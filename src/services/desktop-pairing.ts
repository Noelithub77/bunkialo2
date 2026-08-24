export interface DesktopPairingStatus {
  paired: boolean;
}

export const DESKTOP_PAIRING_ROUTE = "/pair/desktop" as const;

const desktopTokenPattern = /^v1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readJson = async (response: Response): Promise<Record<string, unknown>> => {
  const value: unknown = await response.json();
  return isRecord(value) ? value : {};
};

const responseError = async (response: Response, fallback: string): Promise<Error> => {
  const data = await readJson(response);
  return new Error(typeof data.error === "string" ? data.error : fallback);
};

export const isDesktopPairingToken = (value: string): boolean =>
  desktopTokenPattern.test(value);

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
  if (typeof data.token !== "string" || !isDesktopPairingToken(data.token)) {
    throw new Error("Bunkialo returned an invalid pairing code.");
  }
  return data.token;
};

export const revokeDesktopPairing = async (): Promise<void> => {
  const response = await fetch("/api/desktop/pair", {
    credentials: "same-origin",
    method: "DELETE",
  });
  if (!response.ok) throw await responseError(response, "Could not revoke desktop pairing.");
};
