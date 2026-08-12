import type {
  AttendancePortalUser,
  AttendanceTerm,
  PortalAttendanceSummary,
  PortalCourseSessions,
  PortalNotificationPage,
} from "@/types";
import axios, { isAxiosError } from "axios";
import axiosRetry, {
  exponentialDelay,
  isNetworkOrIdempotentRequestError,
} from "axios-retry";
import {
  applyAuthTokenInterceptor,
  getRefreshToken,
  setAuthTokens,
} from "axios-jwt";
import {
  ATTENDANCE_PORTAL_URL,
  refreshAttendanceTokens,
} from "@/services/auth/attendance-auth";
import { secureTokenStorage } from "@/services/auth/secure-auth-storage";
import {
  portalAttendanceSchema,
  portalCourseSessionsSchema,
  portalNotificationsSchema,
  portalTermsSchema,
  portalUserSchema,
} from "./attendance-schemas";

const attendanceClient = axios.create({
  baseURL: ATTENDANCE_PORTAL_URL,
  timeout: 15_000,
  headers: { Accept: "application/json" },
});

applyAuthTokenInterceptor(attendanceClient, {
  requestRefresh: refreshAttendanceTokens,
  getStorage: () => secureTokenStorage,
  tokenExpireFudge: "20s",
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

const replayedRequests = new WeakSet<object>();
let unauthorizedRefresh: ReturnType<typeof refreshAttendanceTokens> | null =
  null;

attendanceClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }
    const config = error.config;
    if (!config || replayedRequests.has(config)) return Promise.reject(error);
    replayedRequests.add(config);

    const refreshToken = await getRefreshToken();
    if (!refreshToken) return Promise.reject(error);
    unauthorizedRefresh ??= refreshAttendanceTokens(refreshToken).finally(
      () => {
        unauthorizedRefresh = null;
      },
    );
    const tokens = await unauthorizedRefresh;
    await setAuthTokens(tokens);
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    return attendanceClient.request(config);
  },
);

export const getPortalProfile = async (): Promise<AttendancePortalUser> => {
  const response = await attendanceClient.get("/api/auth/me");
  return portalUserSchema.parse(response.data);
};

export const getPortalTerms = async (): Promise<AttendanceTerm[]> => {
  const response = await attendanceClient.get("/api/terms");
  return portalTermsSchema.parse(response.data);
};

export const getPortalAttendance =
  async (): Promise<PortalAttendanceSummary> => {
    const response = await attendanceClient.get("/api/students/me/attendance");
    return portalAttendanceSchema.parse(response.data);
  };

export const getPortalCourseSessions = async (
  attendanceCourseId: string,
): Promise<PortalCourseSessions> => {
  const response = await attendanceClient.get(
    `/api/students/me/courses/${encodeURIComponent(attendanceCourseId)}/sessions`,
  );
  const parsed = portalCourseSessionsSchema.parse(response.data);
  return {
    courseId: parsed.courseId || attendanceCourseId,
    sessions: parsed.sessions,
  };
};

export const getPortalNotifications =
  async (): Promise<PortalNotificationPage> => {
    const response = await attendanceClient.get("/api/notifications");
    return portalNotificationsSchema.parse(response.data);
  };

export const markPortalNotificationRead = async (
  notificationId: string,
): Promise<void> => {
  await attendanceClient.post(
    `/api/notifications/${encodeURIComponent(notificationId)}/read`,
  );
};

export const markAllPortalNotificationsRead = async (): Promise<void> => {
  await attendanceClient.post("/api/notifications/read-all");
};
