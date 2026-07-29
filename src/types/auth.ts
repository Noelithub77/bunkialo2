/**
 * Authentication-related types
 */

export interface Credentials {
  username: string;
  password: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  isLoading: boolean;
  isCheckingAuth: boolean;
  isOffline: boolean;
  username: string | null;
  error: string | null;
}

export interface LoginPageResponse {
  html: string;
  logintoken: string | null;
}

export interface LoginFormData {
  anchor: string;
  logintoken: string;
  username: string;
  password: string;
}

export type AuthProvider = "lms" | "attendancePortal";

export type AuthLoginRequest =
  | { provider: "lms"; mode: "password"; username: string; password: string }
  | {
      provider: "attendancePortal";
      mode: "password";
      email: string;
      password: string;
    }
  | {
      provider: "attendancePortal";
      mode: "totp" | "emailOtp" | "backupCode";
      intermediate: string;
      code: string;
    };

export type AuthLoginResult =
  | { status: "success"; provider: AuthProvider }
  | {
      status: "challenge";
      provider: "attendancePortal";
      challenge: "totp" | "emailOtp";
      intermediate: string;
    }
  | {
      status: "failure";
      provider: AuthProvider;
      reason: "credentials" | "network" | "server" | "invalidResponse";
      message: string;
    };

export interface AttendanceCredentials {
  email: string;
  password: string;
}
