import { api, BASE_URL } from './api'
import { parseHtml, querySelectorAll, querySelector, getText, getAttr } from '@/utils/html-parser'
import type { Course, CourseAttendance, AttendanceRecord, AttendanceStatus } from '@/types'

// Parse courses from the courses page
export const fetchCourses = async (): Promise<Course[]> => {
  const response = await api.get('/my/courses.php')
  const doc = parseHtml(response.data)
  const courses: Course[] = []
  
  // Find all course links
  const links = querySelectorAll(doc, 'a')
  
  for (const link of links) {
    const href = getAttr(link, 'href') || ''
    if (!href.includes('/course/view.php?id=')) continue
    
    const name = getText(link)
    const idMatch = href.match(/id=(\d+)/)
    
    if (idMatch && name) {
      const courseId = idMatch[1]
      // Avoid duplicates
      if (!courses.some(c => c.id === courseId)) {
        courses.push({
          id: courseId,
          name: name,
          url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
        })
      }
    }
  }
  
  return courses
}

// Find attendance module link in a course page
const findAttendanceModuleId = async (courseId: string): Promise<string | null> => {
  const response = await api.get(`/course/view.php?id=${courseId}`)
  const doc = parseHtml(response.data)
  
  // Look for attendance module link
  const links = querySelectorAll(doc, 'a')
  for (const link of links) {
    const href = getAttr(link, 'href') || ''
    if (href.includes('/mod/attendance/view.php?id=')) {
      const idMatch = href.match(/id=(\d+)/)
      return idMatch ? idMatch[1] : null
    }
  }
  
  return null
}

// Parse attendance status from text
const parseStatus = (text: string): AttendanceStatus => {
  const lower = text.toLowerCase().trim()
  if (lower.includes('present')) return 'Present'
  if (lower.includes('absent')) return 'Absent'
  if (lower.includes('late')) return 'Late'
  if (lower.includes('excused')) return 'Excused'
  return 'Absent'
}

// Parse attendance table from the attendance view page
const parseAttendanceTable = (html: string): AttendanceRecord[] => {
  const doc = parseHtml(html)
  const records: AttendanceRecord[] = []
  
  // Find tables and check if they contain attendance data
  const tables = querySelectorAll(doc, 'table')
  
  for (const table of tables) {
    const headerText = getText(table).toLowerCase()
    if (!headerText.includes('date') && !headerText.includes('session') && !headerText.includes('status')) {
      continue
    }
    
    // Parse table rows
    const rows = querySelectorAll(table, 'tr')
    
    for (const row of rows) {
      // Skip header rows
      const headerCells = querySelectorAll(row, 'th')
      if (headerCells.length > 0) continue
      
      const cells = querySelectorAll(row, 'td')
      if (cells.length < 3) continue
      
      // Based on the screenshot, columns are: Date, Description, Status, Points, Remarks
      const date = getText(cells[0])
      const description = getText(cells[1])
      const status = parseStatus(getText(cells[2]))
      const points = cells.length > 3 ? getText(cells[3]) : ''
      const remarks = cells.length > 4 ? getText(cells[4]) : ''
      
      if (date) {
        records.push({ date, description, status, points, remarks })
      }
    }
    
    // If we found records, stop looking at other tables
    if (records.length > 0) break
  }
  
  return records
}

// Fetch attendance data for a single course
export const fetchAttendanceForCourse = async (course: Course): Promise<CourseAttendance> => {
  const attendanceModuleId = await findAttendanceModuleId(course.id)
  
  if (!attendanceModuleId) {
    return {
      courseId: course.id,
      courseName: course.name,
      attendanceModuleId: null,
      totalSessions: 0,
      attended: 0,
      percentage: 0,
      records: [],
      lastUpdated: Date.now(),
    }
  }
  
  // Fetch the attendance view page
  const response = await api.get(`/mod/attendance/view.php?id=${attendanceModuleId}`)
  const records = parseAttendanceTable(response.data)
  
  // Calculate attendance stats
  const totalSessions = records.length
  const attended = records.filter(r => r.status === 'Present').length
  const percentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0
  
  return {
    courseId: course.id,
    courseName: course.name,
    attendanceModuleId,
    totalSessions,
    attended,
    percentage,
    records,
    lastUpdated: Date.now(),
  }
}

// Fetch attendance for all courses in parallel
export const fetchAllAttendance = async (): Promise<CourseAttendance[]> => {
  const courses = await fetchCourses()
  
  // Fetch attendance for all courses in parallel
  const attendancePromises = courses.map(course => fetchAttendanceForCourse(course))
  const results = await Promise.all(attendancePromises)
  
  return results
}
