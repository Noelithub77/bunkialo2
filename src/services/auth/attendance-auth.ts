import {
  portalLoginSchema,
  portalRefreshSchema,
} from "@/services/attendance/attendance-schemas";
import type {
  AttendancePortalTokens,
  AuthLoginRequest,
  AuthLoginResult,
} from "@/types";
import axios, { AxiosError, isAxiosError } from "axios";
import {
  applyAuthTokenInterceptor,
  clearAuthTokens,
  setAuthTokens,
} from "axios-jwt";
import {
  clearAttendanceCredentials,
  getAttendanceCredentials,
  saveAttendanceCredentials,
  secureTokenStorage,
} from "./secure-auth-storage";

export const ATTENDANCE_PORTAL_URL = "https://attendance.iiitkottayam.ac.in";

const rawAuthClient = axios.create({
  baseURL: ATTENDANCE_PORTAL_URL,
  timeout: 15_000,
  headers: { Accept: "application/json" },
});
let pendingAttendanceCredentials: { email: string; password: string } | null =
  null;

const tokensFromResponse = (data: {
  access?: string;
  refresh?: string;
  accessToken?: string;
  refreshToken?: string;
}): AttendancePortalTokens | null => {
  const accessToken = data.access ?? data.accessToken;
  const refreshToken = data.refresh ?? data.refreshToken;
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
};

const failureFromError = (
  error: unknown,
  fallback: string,
): Extract<AuthLoginResult, { status: "failure" }> => {
  if (!isAxiosError(error)) {
    return {
      status: "failure",
      provider: "attendancePortal",
      reason: "invalidResponse",
      message: fallback,
    };
  }
  if (!error.response) {
    return {
      status: "failure",
      provider: "attendancePortal",
      reason: "network",
      message: "Could not reach the attendance portal.",
    };
  }
  if (error.response.status === 401 || error.response.status === 403) {
    return {
      status: "failure",
      provider: "attendancePortal",
      reason: "credentials",
      message: "The attendance email or password is incorrect.",
    };
  }
  return {
    status: "failure",
    provider: "attendancePortal",
    reason: "server",
    message: "The attendance portal is unavailable right now.",
  };
};

const finishPortalLogin = async (
  responseData: unknown,
  credentials?: { email: string; password: string },
): Promise<AuthLoginResult> => {
  const parsed = portalLoginSchema.safeParse(responseData);
  if (!parsed.success) {
    return {
      status: "failure",
      provider: "attendancePortal",
      reason: "invalidResponse",
      message: "The attendance portal returned an unexpected response.",
    };
  }

  if (parsed.data.needs2fa || parsed.data.needsEmailOtp) {
    if (!parsed.data.intermediate) {
      return {
        status: "failure",
        provider: "attendancePortal",
        reason: "invalidResponse",
        message: "The verification request was incomplete.",
      };
    }
    return {
      status: "challenge",
      provider: "attendancePortal",
      challenge: parsed.data.needsEmailOtp ? "emailOtp" : "totp",
      intermediate: parsed.data.intermediate,
    };
  }

  const tokens = tokensFromResponse(parsed.data);
  if (!tokens) {
    return {
      status: "failure",
      provider: "attendancePortal",
      reason: "invalidResponse",
      message: "The attendance portal did not return login tokens.",
    };
  }

  await setAuthTokens(tokens);
  const credentialsToSave = credentials ?? pendingAttendanceCredentials;
  if (credentialsToSave) await saveAttendanceCredentials(credentialsToSave);
  pendingAttendanceCredentials = null;
  return { status: "success", provider: "attendancePortal" };
};

export const loginToAttendancePortal = async (
  request: Exclude<AuthLoginRequest, { provider: "lms" }>,
): Promise<AuthLoginResult> => {
  try {
    if (request.mode === "password") {
      pendingAttendanceCredentials = null;
      const response = await rawAuthClient.post("/api/auth/login", {
        email: request.email.trim().toLowerCase(),
        password: request.password,
      });
      const credentials = {
        email: request.email.trim().toLowerCase(),
        password: request.password,
      };
      const result = await finishPortalLogin(response.data, credentials);
      pendingAttendanceCredentials =
        result.status === "challenge" ? credentials : null;
      return result;
    }

    const endpoint =
      request.mode === "emailOtp"
        ? "/api/auth/login/email-otp"
        : request.mode === "backupCode"
          ? "/api/auth/login/backup-code"
          : "/api/auth/login/totp";
    const response = await rawAuthClient.post(endpoint, {
      intermediate: request.intermediate,
      ...(request.mode === "backupCode"
        ? { backupCode: request.code }
        : { code: request.code }),
    });
    return finishPortalLogin(response.data);
  } catch (error) {
    return failureFromError(error, "Attendance login failed.");
  }
};

let credentialFallbackUsed = false;

export const refreshAttendanceTokens = async (
  refreshToken: string,
): Promise<AttendancePortalTokens> => {
  try {
    const response = await rawAuthClient.post("/api/auth/refresh", {
      refresh: refreshToken,
    });
    const parsed = portalRefreshSchema.parse(response.data);
    const tokens = tokensFromResponse(parsed);
    if (!tokens)
      throw new Error("Refresh response did not include both tokens.");
    credentialFallbackUsed = false;
    pendingAttendanceCredentials = null;
    return tokens;
  } catch (error) {
    const isStale =
      error instanceof AxiosError &&
      (error.response?.status === 401 || error.response?.status === 403);
    if (!isStale || credentialFallbackUsed) throw error;

    credentialFallbackUsed = true;
    const credentials = await getAttendanceCredentials();
    if (!credentials) throw error;
    try {
      const response = await rawAuthClient.post("/api/auth/login", credentials);
      const parsed = portalLoginSchema.parse(response.data);
      const tokens = tokensFromResponse(parsed);
      if (!tokens) throw error;
      return tokens;
    } catch {
      await clearAttendanceCredentials();
      throw error;
    }
  }
};

export const logoutFromAttendancePortal = async (): Promise<void> => {
  try {
    const { getRefreshToken } = await import("axios-jwt");
    const refresh = await getRefreshToken();
    if (refresh) await rawAuthClient.post("/api/auth/logout", { refresh });
  } catch {
    // Local logout must still finish when the portal is offline.
  } finally {
    credentialFallbackUsed = false;
    await clearAuthTokens();
    await clearAttendanceCredentials();
  }
};

// axios-jwt keeps one storage adapter. Configure it before any login can save.
applyAuthTokenInterceptor(axios.create(), {
  requestRefresh: refreshAttendanceTokens,
  getStorage: () => secureTokenStorage,
  tokenExpireFudge: "20s",
});
