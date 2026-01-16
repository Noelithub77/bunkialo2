// ============================================================================
// ATTENDANCE TYPES
// ============================================================================

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused'

export interface AttendanceRecord {
  date: string
  description: string
  status: AttendanceStatus
  points: string
  remarks: string
}

export interface CourseAttendance {
  courseId: string
  courseName: string
  attendanceModuleId: string | null
  totalSessions: number
  attended: number
  percentage: number
  records: AttendanceRecord[]
  lastUpdated: number
}

// ============================================================================
// COURSE TYPES
// ============================================================================

export interface Course {
  id: string
  name: string
  url: string
}

// Moodle Course API Response (from core_course_get_enrolled_courses_by_timeline_classification)
export interface MoodleCourseApiResponse {
  id: number
  fullname: string
  shortname: string
  idnumber: string
  summary: string
  summaryformat: number
  startdate: number
  enddate: number
  visible: boolean
  fullnamedisplay: string
  viewurl: string
  courseimage: string
  progress: number | null
  hasprogress: boolean
  isfavourite: boolean
  hidden: boolean
  timeaccess: number | null
  showshortname: boolean
  coursecategory: string
}

export interface MoodleCourseTimelineData {
  courses: MoodleCourseApiResponse[]
  nextoffset: number
}

export interface MoodleAjaxResponse<T = unknown> {
  error: boolean
  exception?: {
    errorcode: string
    message: string
    type: string
  }
  data: T
}

// ============================================================================
// MOODLE AJAX API TYPES
// ============================================================================

export interface MoodleAjaxRequest {
  index: number
  methodname: string
  args: Record<string, unknown>
}

export type MoodleTimelineClassification = 'inprogress' | 'past' | 'future' | 'all'

export interface MoodleCourseTimelineArgs {
  offset: number
  limit: number
  classification: MoodleTimelineClassification
  sort: 'fullname' | 'lastaccess' | 'shortname'
}

// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

export interface Credentials {
  username: string
  password: string
}

export interface AuthState {
  isLoggedIn: boolean
  isLoading: boolean
  username: string | null
  error: string | null
}

// ============================================================================
// STORE TYPES
// ============================================================================

export interface AttendanceState {
  courses: CourseAttendance[]
  isLoading: boolean
  lastSyncTime: number | null
  error: string | null
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = unknown> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
}

export interface LoginPageResponse {
  html: string
  logintoken: string | null
}

export interface LoginFormData {
  anchor: string
  logintoken: string
  username: string
  password: string
}

// ============================================================================
// HTML PARSING TYPES
// ============================================================================

export interface ParsedCourseLink {
  id: string
  name: string
  href: string
}

export interface ParsedAttendanceTable {
  headers: string[]
  rows: AttendanceRecord[]
}

// ============================================================================
// DEBUG TYPES
// ============================================================================

export type LogCategory = 'AUTH' | 'COOKIE' | 'SCRAPER' | 'API' | 'STORE'

export interface DebugInfo {
  baseUrl: string
  cookieCount: number
  cookies: Record<string, string>
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface CourseStats {
  totalCourses: number
  totalSessions: number
  totalAttended: number
  overallPercentage: number
}

export interface AttendanceSummary {
  courseId: string
  courseName: string
  percentage: number
  attended: number
  totalSessions: number
}

// ============================================================================
// CALENDAR TYPES
// ============================================================================

export type SessionType = 'regular' | 'lab' | 'tutorial'

export interface CalendarDot {
  key: string
  color: string
}

export interface CalendarMarking {
  dots: CalendarDot[]
  selected?: boolean
}

export type MarkedDates = Record<string, CalendarMarking>

// ============================================================================
// BUNK TYPES
// ============================================================================

export type BunkSource = 'lms' | 'user'

export interface BunkRecord {
  id: string
  date: string
  description: string
  timeSlot: string | null
  note: string
  source: BunkSource
  isDutyLeave: boolean
  dutyLeaveNote: string
  isMarkedPresent: boolean
  presenceNote: string
}

export interface CourseConfig {
  credits: number
  alias: string
}

export interface CourseBunkData {
  courseId: string
  courseName: string
  config: CourseConfig | null
  bunks: BunkRecord[]
  isConfigured: boolean
}

export interface BunkState {
  courses: CourseBunkData[]
  lastSyncTime: number | null
  isLoading: boolean
  error: string | null
}

export interface DutyLeaveInfo {
  courseId: string
  courseName: string
  bunkId: string
  date: string
  timeSlot: string | null
  note: string
}

// ============================================================================
// DASHBOARD/TIMELINE TYPES
// ============================================================================

export interface TimelineCourse {
  id: number
  fullname: string
  shortname: string
  viewurl: string
}

export interface TimelineEventAction {
  name: string
  url: string
  actionable: boolean
}

export interface TimelineEvent {
  id: number
  name: string
  activityname: string
  activitystr: string
  modulename: string
  instance: number
  eventtype: string
  timestart: number
  timesort: number
  overdue: boolean
  course: TimelineCourse
  action: TimelineEventAction
  url: string
  purpose: string
}

export interface DashboardState {
  events: TimelineEvent[]
  lastSyncTime: number | null
  isLoading: boolean
  error: string | null
  logs: DashboardLog[]
}

export interface DashboardLog {
  id: string
  timestamp: number
  message: string
  type: 'info' | 'error' | 'success'
}

export interface DashboardSettings {
  refreshIntervalMinutes: number
  reminders: number[]
  notificationsEnabled: boolean
}

