import type {
  AttendancePortalTokens,
  AuthLoginRequest,
  AuthLoginResult,
} from "@/types";
import { z } from "zod";
import { saveAttendanceCredentials } from "./secure-auth-storage";

export const ATTENDANCE_PORTAL_URL = "https://attendance.iiitkottayam.ac.in";

const responseSchema = z
  .object({
    authenticated: z.boolean().optional(),
    intermediate: z.string().optional(),
    needs2fa: z.boolean().optional(),
    needsEmailOtp: z.boolean().optional(),
  })
  .passthrough();
let pendingCredentials: { email: string; password: string } | null = null;

const failure = (status: number): Extract<AuthLoginResult, { status: "failure" }> => ({
  status: "failure",
  provider: "attendancePortal",
  reason: status === 401 || status === 403 ? "credentials" : "server",
  message:
    status === 401 || status === 403
      ? "The attendance email or password is incorrect."
      : "The attendance portal is unavailable right now.",
});

export const loginToAttendancePortal = async (
  request: Exclude<AuthLoginRequest, { provider: "lms" }>,
): Promise<AuthLoginResult> => {
  try {
    if (request.mode === "password") {
      pendingCredentials = {
        email: request.email.trim().toLowerCase(),
        password: request.password,
      };
    }
    const response = await fetch("/api/attendance/auth", {
      body: JSON.stringify(request),
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) return failure(response.status);
    const parsed = responseSchema.safeParse(await response.json());
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
    if (!parsed.data.authenticated) return failure(401);
    if (pendingCredentials) await saveAttendanceCredentials(pendingCredentials);
    pendingCredentials = null;
    return { status: "success", provider: "attendancePortal" };
  } catch {
    return {
      status: "failure",
      provider: "attendancePortal",
      reason: "network",
      message: "Could not reach the attendance portal.",
    };
  }
};

export const checkAttendanceSession = async (): Promise<boolean> => {
  try {
    const response = await fetch("/api/attendance/api/auth/me", {
      credentials: "same-origin",
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const refreshAttendanceTokens = async (): Promise<AttendancePortalTokens> => {
  throw new Error("Attendance tokens are managed by the web relay.");
};

export const logoutFromAttendancePortal = async (): Promise<void> => {
  pendingCredentials = null;
  // The shared web logout endpoint clears both upstream sessions atomically.
};
