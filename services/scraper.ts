import { api, BASE_URL } from './api'
import { parseHtml, querySelectorAll, getText, getAttr } from '@/utils/html-parser'
import { debug } from '@/utils/debug'
import type { Course, CourseAttendance, AttendanceRecord, AttendanceStatus } from '@/types'

// Parse courses from dashboard (not /my/courses.php - that page doesn't show course links properly)
export const fetchCourses = async (): Promise<Course[]> => {
  debug.scraper('=== FETCHING COURSES FROM DASHBOARD ===')
  
  const response = await api.get('/my/')
  debug.scraper(`Dashboard page size: ${response.data.length} chars`)
  
  const doc = parseHtml(response.data)
  const courses: Course[] = []
  
  // Find all course links
  const links = querySelectorAll(doc, 'a')
  debug.scraper(`Total links found: ${links.length}`)
  
  for (const link of links) {
    const href = getAttr(link, 'href') || ''
    if (!href.includes('/course/view.php?id=')) continue
    
    const name = getText(link)
    const idMatch = href.match(/id=(\d+)/)
    
    if (idMatch && name && name.length > 3) {
      const courseId = idMatch[1]
      // Avoid duplicates
      if (!courses.some(c => c.id === courseId)) {
        courses.push({
          id: courseId,
          name: name,
          url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
        })
        debug.scraper(`Found course: [${courseId}] ${name.substring(0, 40)}`)
      }
    }
  }
  
  debug.scraper(`Total unique courses: ${courses.length}`)
  return courses
}

// Find attendance module link in a course page
const findAttendanceModuleId = async (courseId: string): Promise<string | null> => {
  debug.scraper(`Finding attendance module for course ${courseId}`)
  
  const response = await api.get(`/course/view.php?id=${courseId}`)
  const doc = parseHtml(response.data)
  
  // Look for attendance module link
  const links = querySelectorAll(doc, 'a')
  for (const link of links) {
    const href = getAttr(link, 'href') || ''
    if (href.includes('/mod/attendance/view.php')) {
      const idMatch = href.match(/id=(\d+)/)
      if (idMatch) {
        debug.scraper(`Found attendance module: ${idMatch[1]}`)
        return idMatch[1]
      }
    }
  }
  
  debug.scraper(`No attendance module found for course ${courseId}`)
  return null
}

// Parse attendance status from text
const parseStatus = (text: string, points: string): AttendanceStatus => {
  const lower = text.toLowerCase().trim()
  
  // Check points first (more reliable)
  if (points.includes('1 /') || points.includes('1/')) return 'Present'
  if (points.includes('0 /') || points.includes('0/')) return 'Absent'
  
  // Fall back to text
  if (lower.includes('present')) return 'Present'
  if (lower.includes('absent')) return 'Absent'
  if (lower.includes('late')) return 'Late'
  if (lower.includes('excused')) return 'Excused'
  
  return 'Absent'
}

// Parse attendance table from the attendance report page
const parseAttendanceTable = (html: string): AttendanceRecord[] => {
  const doc = parseHtml(html)
  const records: AttendanceRecord[] = []
  
  // Find tables
  const tables = querySelectorAll(doc, 'table')
  debug.scraper(`Found ${tables.length} tables`)
  
  for (const table of tables) {
    const headerText = getText(table).toLowerCase()
    
    // Check if this looks like an attendance table (has Date, Status, Points columns)
    const isAttendanceTable = 
      headerText.includes('date') && 
      (headerText.includes('status') || headerText.includes('points') || headerText.includes('present'))
    
    if (!isAttendanceTable) continue
    
    debug.scraper('Found attendance table')
    
    // Parse table rows
    const rows = querySelectorAll(table, 'tr')
    debug.scraper(`Table has ${rows.length} rows`)
    
    for (const row of rows) {
      // Skip header rows
      const headerCells = querySelectorAll(row, 'th')
      if (headerCells.length > 0) continue
      
      const cells = querySelectorAll(row, 'td')
      if (cells.length < 2) continue
      
      // Columns: Date | Description | Status | Points | Remarks
      const date = getText(cells[0])
      const description = cells.length > 1 ? getText(cells[1]) : ''
      const statusText = cells.length > 2 ? getText(cells[2]) : ''
      const points = cells.length > 3 ? getText(cells[3]) : ''
      const remarks = cells.length > 4 ? getText(cells[4]) : ''
      
      // Validate this is a real record (date should have numbers)
      if (date && date.match(/\d/)) {
        const status = parseStatus(statusText, points)
        records.push({ date, description, status, points, remarks })
        debug.scraper(`Record: ${date} | ${status} | ${points}`)
      }
    }
    
    // If we found records, stop looking at other tables
    if (records.length > 0) {
      debug.scraper(`Parsed ${records.length} attendance records`)
      break
    }
  }
  
  return records
}

// Fetch attendance data for a single course
export const fetchAttendanceForCourse = async (course: Course): Promise<CourseAttendance> => {
  debug.scraper(`=== FETCHING ATTENDANCE: ${course.name.substring(0, 30)} ===`)
  
  const attendanceModuleId = await findAttendanceModuleId(course.id)
  
  if (!attendanceModuleId) {
    debug.scraper('No attendance module, returning empty')
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
  
  // Fetch the user's attendance report (view=5 shows all sessions for current user)
  debug.scraper(`Fetching attendance report: /mod/attendance/view.php?id=${attendanceModuleId}&view=5`)
  const response = await api.get(`/mod/attendance/view.php?id=${attendanceModuleId}&view=5`)
  debug.scraper(`Attendance page size: ${response.data.length} chars`)
  
  const records = parseAttendanceTable(response.data)
  
  // Calculate attendance stats
  const totalSessions = records.length
  const attended = records.filter(r => r.status === 'Present').length
  const percentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0
  
  debug.scraper(`Stats: ${attended}/${totalSessions} = ${percentage}%`)
  
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
  debug.scraper('=== FETCHING ALL ATTENDANCE ===')
  
  const courses = await fetchCourses()
  
  if (courses.length === 0) {
    debug.scraper('No courses found!')
    return []
  }
  
  debug.scraper(`Fetching attendance for ${courses.length} courses in parallel...`)
  
  // Fetch attendance for all courses in parallel
  const attendancePromises = courses.map(course => 
    fetchAttendanceForCourse(course).catch(error => {
      debug.scraper(`Error fetching ${course.name}: ${error.message}`)
      return {
        courseId: course.id,
        courseName: course.name,
        attendanceModuleId: null,
        totalSessions: 0,
        attended: 0,
        percentage: 0,
        records: [],
        lastUpdated: Date.now(),
      } as CourseAttendance
    })
  )
  
  const results = await Promise.all(attendancePromises)
  
  // Sort by courses with attendance first, then by percentage
  results.sort((a, b) => {
    if (a.totalSessions === 0 && b.totalSessions > 0) return 1
    if (a.totalSessions > 0 && b.totalSessions === 0) return -1
    return b.percentage - a.percentage
  })
  
  debug.scraper(`=== FETCH COMPLETE: ${results.length} courses ===`)
  results.forEach(r => {
    if (r.totalSessions > 0) {
      debug.scraper(`  ${r.courseName.substring(0, 30)}: ${r.attended}/${r.totalSessions} (${r.percentage}%)`)
    }
  })
  
  return results
}
