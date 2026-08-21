import type { AttendanceCredentials } from "@/types";
import type { StorageType } from "axios-jwt";
import { offerWebCredential } from "./web-password-manager.web";

// Attendance tokens are held by the Worker session and never exposed to web storage.
export const secureTokenStorage: StorageType = {
  get: async () => null,
  remove: async () => undefined,
  set: async () => undefined,
};

export const getAttendanceCredentials = async (): Promise<AttendanceCredentials | null> => null;

export const saveAttendanceCredentials = async (
  credentials: AttendanceCredentials,
): Promise<void> => {
  await offerWebCredential({
    identifier: credentials.email,
    name: "Bunkialo attendance portal",
    password: credentials.password,
  });
};

export const clearAttendanceCredentials = async (): Promise<void> => undefined;
