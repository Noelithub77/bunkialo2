import type { AttendanceCredentials } from "@/types";
import * as SecureStore from "expo-secure-store";
import type { StorageType } from "axios-jwt";
import { z } from "zod";

const ATTENDANCE_CREDENTIALS_KEY = "attendance_portal_credentials_v1";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const secureTokenStorage: StorageType = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
};

export const getAttendanceCredentials =
  async (): Promise<AttendanceCredentials | null> => {
    const saved = await SecureStore.getItemAsync(ATTENDANCE_CREDENTIALS_KEY);
    if (!saved) return null;

    try {
      return credentialsSchema.parse(JSON.parse(saved));
    } catch {
      await SecureStore.deleteItemAsync(ATTENDANCE_CREDENTIALS_KEY);
      return null;
    }
  };

export const saveAttendanceCredentials = async (
  credentials: AttendanceCredentials,
): Promise<void> => {
  const valid = credentialsSchema.parse(credentials);
  await SecureStore.setItemAsync(
    ATTENDANCE_CREDENTIALS_KEY,
    JSON.stringify(valid),
  );
};

export const clearAttendanceCredentials = (): Promise<void> =>
  SecureStore.deleteItemAsync(ATTENDANCE_CREDENTIALS_KEY);
