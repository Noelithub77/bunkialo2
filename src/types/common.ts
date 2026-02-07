/**
 * Common/utility types
 */

import type { AttendanceRecord } from "./attendance";

export interface Course {
  id: string;
  name: string;
  url: string;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface ParsedCourseLink {
  id: string;
  name: string;
  href: string;
}

export interface ParsedAttendanceTable {
  headers: string[];
  rows: AttendanceRecord[];
}

export type LogCategory = "AUTH" | "COOKIE" | "SCRAPER" | "API" | "STORE";

export interface DebugInfo {
  baseUrl: string;
  cookieCount: number;
  cookies: Record<string, string>;
}
