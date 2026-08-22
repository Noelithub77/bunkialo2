import type { AttendanceCredentials } from "@/types";
import type { StorageType } from "axios-jwt";
import { z } from "zod";
import { offerWebCredential } from "./web-password-manager.web";

const ATTENDANCE_CREDENTIALS_KEY = "attendance_portal_credentials_v1";
const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// Attendance tokens are held by the Worker session and never exposed to web storage.
export const secureTokenStorage: StorageType = {
  get: async () => null,
  remove: async () => undefined,
  set: async () => undefined,
};

export const getAttendanceCredentials = async (): Promise<AttendanceCredentials | null> => {
  const saved = localStorage.getItem(ATTENDANCE_CREDENTIALS_KEY);
  if (!saved) return null;

  try {
    return credentialsSchema.parse(JSON.parse(saved));
  } catch {
    localStorage.removeItem(ATTENDANCE_CREDENTIALS_KEY);
    return null;
  }
};

export const saveAttendanceCredentials = async (
  credentials: AttendanceCredentials,
): Promise<void> => {
  const valid = credentialsSchema.parse(credentials);
  localStorage.setItem(ATTENDANCE_CREDENTIALS_KEY, JSON.stringify(valid));
  await offerWebCredential({
    identifier: valid.email,
    name: "Bunkialo attendance portal",
    password: valid.password,
  });
};

export const clearAttendanceCredentials = async (): Promise<void> => {
  localStorage.removeItem(ATTENDANCE_CREDENTIALS_KEY);
};
