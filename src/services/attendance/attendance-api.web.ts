import type {
  AttendancePortalUser,
  AttendanceTerm,
  PortalAttendanceSummary,
  PortalCourseSessions,
  PortalNotificationPage,
} from "@/types";
import axios from "axios";
import {
  portalAttendanceSchema,
  portalCourseSessionsSchema,
  portalNotificationsSchema,
  portalTermsSchema,
  portalUserSchema,
} from "./attendance-schemas";

const attendanceClient = axios.create({
  baseURL: "/api/attendance",
  headers: { Accept: "application/json" },
  timeout: 15_000,
  withCredentials: true,
});

export const getPortalProfile = async (): Promise<AttendancePortalUser> => {
  const response = await attendanceClient.get("/api/auth/me");
  return portalUserSchema.parse(response.data);
};

export const getPortalTerms = async (): Promise<AttendanceTerm[]> => {
  const response = await attendanceClient.get("/api/terms");
  return portalTermsSchema.parse(response.data);
};

export const getPortalAttendance = async (): Promise<PortalAttendanceSummary> => {
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
  return { courseId: parsed.courseId || attendanceCourseId, sessions: parsed.sessions };
};

export const getPortalNotifications = async (): Promise<PortalNotificationPage> => {
  const response = await attendanceClient.get("/api/notifications");
  return portalNotificationsSchema.parse(response.data);
};

export const markPortalNotificationRead = async (
  notificationId: string,
): Promise<void> => {
  await attendanceClient.post(`/api/notifications/${encodeURIComponent(notificationId)}/read`);
};

export const markAllPortalNotificationsRead = async (): Promise<void> => {
  await attendanceClient.post("/api/notifications/read-all");
};
