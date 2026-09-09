import type {
  AttendancePortalUser,
  AttendanceTerm,
  PortalAttendanceSummary,
  PortalCourseSessions,
  PortalNotificationPage,
} from "@/types";
import axios from "axios";
import axiosRetry, {
  exponentialDelay,
  isNetworkOrIdempotentRequestError,
} from "axios-retry";
import {
  portalAttendanceSchema,
  portalCourseSessionsSchema,
  portalNotificationsSchema,
  portalTermsSchema,
  portalUserSchema,
} from "./attendance-schemas";
import { getErrorMessage } from "@/utils/error-details";

const attendanceClient = axios.create({
  baseURL: "/api/attendance",
  headers: {
    Accept: "application/json",
    "Cache-Control": "no-cache, no-store, max-age=0",
    Pragma: "no-cache",
  },
  timeout: 15_000,
  withCredentials: true,
});

axiosRetry(attendanceClient, {
  retries: 2,
  retryDelay: exponentialDelay,
  retryCondition: (error) => {
    const status = error.response?.status;
    if (status === 401 || status === 403) return false;
    return (
      isNetworkOrIdempotentRequestError(error) ||
      status === 429 ||
      (status !== undefined && status >= 500)
    );
  },
});

const request = async <T>(
  label: string,
  operation: () => Promise<T>,
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    throw new Error(`${label}: ${getErrorMessage(error)}`);
  }
};

export const getPortalProfile = async (): Promise<AttendancePortalUser> => {
  return request("Attendance profile request failed", async () => {
    const response = await attendanceClient.get("/api/auth/me");
    return portalUserSchema.parse(response.data);
  });
};

export const getPortalTerms = async (): Promise<AttendanceTerm[]> => {
  return request("Attendance terms request failed", async () => {
    const response = await attendanceClient.get("/api/terms");
    return portalTermsSchema.parse(response.data);
  });
};

export const getPortalAttendance = async (): Promise<PortalAttendanceSummary> => {
  return request("Attendance summary request failed", async () => {
    const response = await attendanceClient.get("/api/students/me/attendance");
    return portalAttendanceSchema.parse(response.data);
  });
};

export const getPortalCourseSessions = async (
  attendanceCourseId: string,
): Promise<PortalCourseSessions> => {
  return request("Attendance course sessions request failed", async () => {
    const response = await attendanceClient.get(
      `/api/students/me/courses/${encodeURIComponent(attendanceCourseId)}/sessions`,
    );
    const parsed = portalCourseSessionsSchema.parse(response.data);
    return {
      courseId: parsed.courseId || attendanceCourseId,
      sessions: parsed.sessions,
    };
  });
};

export const getPortalNotifications = async (): Promise<PortalNotificationPage> => {
  return request("Attendance notifications request failed", async () => {
    const response = await attendanceClient.get("/api/notifications");
    return portalNotificationsSchema.parse(response.data);
  });
};

export const markPortalNotificationRead = async (
  notificationId: string,
): Promise<void> => {
  await attendanceClient.post(`/api/notifications/${encodeURIComponent(notificationId)}/read`);
};

export const markAllPortalNotificationsRead = async (): Promise<void> => {
  await attendanceClient.post("/api/notifications/read-all");
};
