// Attendance status types
export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused'

// Single attendance record from the table
export interface AttendanceRecord {
  date: string
  description: string
  status: AttendanceStatus
  points: string
  remarks: string
}

// Course with its attendance data
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

// Basic course info from courses page
export interface Course {
  id: string
  name: string
  url: string
}

// Auth state
export interface AuthState {
  isLoggedIn: boolean
  isLoading: boolean
  username: string | null
  error: string | null
}

// Attendance store state
export interface AttendanceState {
  courses: CourseAttendance[]
  isLoading: boolean
  lastSyncTime: number | null
  error: string | null
}
