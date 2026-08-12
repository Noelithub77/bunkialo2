import type { AuthLoginRequest, AuthLoginResult } from "@/types";
import { isAxiosError } from "axios";
import { loginToAttendancePortal } from "./attendance-auth";
import { login as loginToLms } from "./lms-auth";

export const login = async (
  request: AuthLoginRequest,
): Promise<AuthLoginResult> => {
  if (request.provider === "attendancePortal") {
    return loginToAttendancePortal(request);
  }

  try {
    const success = await loginToLms(request.username, request.password);
    return success
      ? { status: "success", provider: "lms" }
      : {
          status: "failure",
          provider: "lms",
          reason: "credentials",
          message: "The LMS roll number or password is incorrect.",
        };
  } catch (error) {
    const network = isAxiosError(error) && !error.response;
    return {
      status: "failure",
      provider: "lms",
      reason: network ? "network" : "server",
      message: network
        ? "Could not reach the LMS."
        : "The LMS is unavailable right now.",
    };
  }
};
