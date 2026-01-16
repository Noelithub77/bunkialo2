import type {
  AttendanceRecord,
  AttendanceStatus,
  Course,
  CourseAttendance,
  MoodleAjaxRequest,
  MoodleAjaxResponse,
  MoodleCourseApiResponse,
  MoodleCourseTimelineData
} from '@/types'
import { debug } from '@/utils/debug'
import { getAttr, getText, parseHtml, querySelectorAll } from '@/utils/html-parser'
import { api, BASE_URL } from './api'

// Get sesskey from page for API calls
const getSesskey = async (): Promise<string | null> => {
  const response = await api.get<string>('/my/')

  // Find sesskey in page - it's in M.cfg.sesskey in a script tag
  const match = response.data.match(/"sesskey":"([^"]+)"/)

  if (match) {
    debug.scraper(`Found sesskey: ${match[1]}`)
    return match[1]
  }

  debug.scraper('Sesskey not found')
  return null
}

// Fetch courses using Moodle's AJAX API (only "in progress" courses)
export const fetchCourses = async (): Promise<Course[]> => {
  debug.scraper('=== FETCHING IN-PROGRESS COURSES ===')

  const sesskey = await getSesskey()
  if (!sesskey) {
    debug.scraper('No sesskey, falling back to HTML parsing')
    return fetchCoursesFromHtml()
  }

  // Moodle AJAX API call for in-progress courses
  const apiPayload: MoodleAjaxRequest[] = [{
    index: 0,
    methodname: 'core_course_get_enrolled_courses_by_timeline_classification',
    args: {
      offset: 0,
      limit: 0,
      classification: 'inprogress',
      sort: 'fullname',
    },
  }]

  try {
    const response = await api.post<MoodleAjaxResponse<MoodleCourseTimelineData>[]>(
      `/lib/ajax/service.php?sesskey=${sesskey}&info=core_course_get_enrolled_courses_by_timeline_classification`,
      JSON.stringify(apiPayload),
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )

    const data = response.data

    if (Array.isArray(data) && data[0]?.data?.courses) {
      const apiResponse = data[0] as MoodleAjaxResponse<MoodleCourseTimelineData>

      if (apiResponse.error) {
        debug.scraper(`API error: ${apiResponse.exception?.message || 'Unknown error'}`)
        throw new Error(apiResponse.exception?.message || 'API error')
      }

      const courses: Course[] = apiResponse.data.courses.map((c: MoodleCourseApiResponse) => ({
        id: String(c.id),
        name: c.fullname || c.shortname,
        url: `${BASE_URL}/course/view.php?id=${c.id}`,
      }))

      debug.scraper(`Found ${courses.length} in-progress courses via API`)
      courses.forEach(c => debug.scraper(`  [${c.id}] ${c.name.substring(0, 40)}`))

      return courses
    }
  } catch (error) {
    debug.scraper(`API error: ${error}, falling back to HTML`)
  }

  return fetchCoursesFromHtml()
}

// Fallback: Parse courses from dashboard HTML
const fetchCoursesFromHtml = async (): Promise<Course[]> => {
  debug.scraper('Parsing courses from dashboard HTML')

  const response = await api.get<string>('/my/')
  const doc = parseHtml(response.data)
  const courses: Course[] = []

  const links = querySelectorAll(doc, 'a')

  for (const link of links) {
    const href = getAttr(link, 'href') || ''
    if (!href.includes('/course/view.php?id=')) continue

    const name = getText(link)
    const idMatch = href.match(/id=(\d+)/)

    if (idMatch && name && name.length > 3) {
      const courseId = idMatch[1]
      if (!courses.some(c => c.id === courseId)) {
        courses.push({
          id: courseId,
          name: name,
          url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
        })
      }
    }
  }

  debug.scraper(`Found ${courses.length} courses from HTML`)
  return courses
}

// Find attendance module link in a course page
const findAttendanceModuleId = async (courseId: string): Promise<string | null> => {
  debug.scraper(`Finding attendance module for course ${courseId}`)

  const response = await api.get<string>(`/course/view.php?id=${courseId}`)
  const doc = parseHtml(response.data)

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

  debug.scraper(`No attendance module for course ${courseId}`)
  return null
}

// Parse attendance status from text
const parseStatus = (text: string, points: string): AttendanceStatus => {
  const lower = text.toLowerCase().trim()

  // Check for unknown/unmarked status (shows as "?" in LMS)
  if (points.includes('? /') || points.includes('?/') || lower === '?') return 'Unknown'

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

  const tables = querySelectorAll(doc, 'table')
  debug.scraper(`Found ${tables.length} tables`)

  for (const table of tables) {
    const headerText = getText(table).toLowerCase()

    // Check if this looks like an attendance table
    const isAttendanceTable =
      headerText.includes('date') &&
      (headerText.includes('status') || headerText.includes('points') || headerText.includes('present'))

    if (!isAttendanceTable) continue

    debug.scraper('Found attendance table')

    const rows = querySelectorAll(table, 'tr')

    for (const row of rows) {
      const headerCells = querySelectorAll(row, 'th')
      if (headerCells.length > 0) continue

      const cells = querySelectorAll(row, 'td')
      if (cells.length < 2) continue

      const date = getText(cells[0])
      const description = cells.length > 1 ? getText(cells[1]) : ''
      const statusText = cells.length > 2 ? getText(cells[2]) : ''
      const points = cells.length > 3 ? getText(cells[3]) : ''
      const remarks = cells.length > 4 ? getText(cells[4]) : ''

      if (date && date.match(/\d/)) {
        const status = parseStatus(statusText, points)
        records.push({ date, description, status, points, remarks })
      }
    }

    if (records.length > 0) {
      debug.scraper(`Parsed ${records.length} records`)
      break
    }
  }

  return records
}

// Fetch attendance data for a single course
export const fetchAttendanceForCourse = async (course: Course): Promise<CourseAttendance> => {
  debug.scraper(`=== ATTENDANCE: ${course.name.substring(0, 30)} ===`)

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

  // Fetch user's attendance report (view=5)
  const response = await api.get<string>(`/mod/attendance/view.php?id=${attendanceModuleId}&view=5`)
  const records = parseAttendanceTable(response.data)

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

// Fetch attendance for all in-progress courses in parallel
export const fetchAllAttendance = async (): Promise<CourseAttendance[]> => {
  debug.scraper('=== FETCHING ALL ATTENDANCE ===')

  const courses = await fetchCourses()

  if (courses.length === 0) {
    debug.scraper('No in-progress courses found!')
    return []
  }

  debug.scraper(`Fetching attendance for ${courses.length} courses...`)

  const attendancePromises = courses.map(course =>
    fetchAttendanceForCourse(course).catch(error => {
      debug.scraper(`Error: ${course.name}: ${error.message}`)
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

  // Filter out courses with no attendance data
  const coursesWithAttendance = results.filter(c => c.totalSessions > 0)

  debug.scraper(`Courses with attendance: ${coursesWithAttendance.length} / ${results.length}`)

  // Sort by percentage (highest first)
  coursesWithAttendance.sort((a, b) => b.percentage - a.percentage)

  coursesWithAttendance.forEach(c => {
    debug.scraper(`  ${c.courseName.substring(0, 30)}: ${c.attended}/${c.totalSessions} (${c.percentage}%)`)
  })

  debug.scraper(`=== COMPLETE: ${coursesWithAttendance.length} courses with attendance ===`)

  return coursesWithAttendance
}
