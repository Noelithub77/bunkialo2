# AGENTS.md - Project Guide

## Project Overview

**Bunkialo** - React Native (Expo) app that scrapes attendance from IIIT Kottayam Moodle LMS.

**LMS**: `https://lmsug24.iiitkottayam.ac.in`

**Key Features**: Secure auth, Moodle API integration, HTML parsing, offline cache, only shows in-progress courses with attendance.

## Tech Stack

- **Framework**: Expo SDK 54 + Expo Router 6
- **Language**: TypeScript (strict, no `any`)
- **State**: Zustand + AsyncStorage
- **HTTP**: Axios with cookie interceptors
- **Parser**: htmlparser2 (not cheerio - has Node deps)
- **Storage**: expo-secure-store (credentials), AsyncStorage (cache)

## Project Structure

```
app/                    # Expo Router screens
  ├── _layout.tsx      # Root layout, auth routing
  ├── login.tsx        # Login screen
  └── (tabs)/
      ├── index.tsx    # Attendance list
      └── settings.tsx # Settings

services/              # Business logic (NO React)
  ├── api.ts          # Axios + cookie interceptors
  ├── auth.ts         # Login/logout
  ├── cookie-store.ts  # In-memory cookies
  └── scraper.ts      # Moodle API + HTML parsing

stores/                # Zustand stores
  ├── auth-store.ts
  └── attendance-store.ts

types/index.ts         # All TypeScript types
utils/debug.ts         # Debug logging
```

## Key Types (`types/index.ts`)

```typescript
// Core
type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused'
interface AttendanceRecord { date, description, status, points, remarks }
interface CourseAttendance { courseId, courseName, totalSessions, attended, percentage, records }
interface Course { id, name, url }

// Moodle API
interface MoodleAjaxRequest { index, methodname, args }
interface MoodleAjaxResponse<T> { error, exception?, data: T }
interface MoodleCourseApiResponse { id, fullname, shortname, courseimage, ... }
interface MoodleCourseTimelineData { courses, nextoffset }

// Auth
interface Credentials { username, password }
interface LoginFormData { anchor, logintoken, username, password }
```

**Rule**: Never use `any`. Always import types from `types/index.ts`.

## Implementation Flow

### Authentication
1. GET `/login/index.php` → extract `logintoken`
2. POST credentials with token
3. Verify success (check for logout link)
4. Save to `expo-secure-store`

### Course Fetching
1. GET `/my/` → extract `sesskey` from HTML
2. POST to Moodle AJAX API:
   ```
   /lib/ajax/service.php?sesskey={key}&info=core_course_get_enrolled_courses_by_timeline_classification
   Body: [{
     methodname: 'core_course_get_enrolled_courses_by_timeline_classification',
     args: { classification: 'inprogress', limit: 0, sort: 'fullname' }
   }]
   ```
3. Response: `MoodleAjaxResponse<MoodleCourseTimelineData>`

### Attendance Fetching
1. For each course: GET `/course/view.php?id={id}` → find attendance module
2. GET `/mod/attendance/view.php?id={moduleId}&view=5` (view=5 = user report)
3. Parse table: Date | Description | Status | Points | Remarks
4. Filter: Only return courses where `totalSessions > 0`
5. Sort by percentage (highest first)

### Status Detection
- Check `points` first: `"1 / 1"` = Present, `"0 / 1"` = Absent
- Fallback to `status` text

## Cookie Management

```typescript
// Automatic via interceptors in api.ts
cookieStore.setCookiesFromHeader(response.headers['set-cookie'])
cookieStore.getCookieHeader() // Attached to requests automatically
```

## HTML Parsing

```typescript
import { parseHtml, querySelector, querySelectorAll, getText, getAttr } from '@/utils/html-parser'

const doc = parseHtml(html)
const token = getAttr(querySelector(doc, 'input[name="logintoken"]'), 'value')
```

## Debug Logging

```typescript
import { debug } from '@/utils/debug'

debug.auth('Message', data)
debug.cookie('Message', data)
debug.scraper('Message', data)
debug.api('Message', data)
```

Only logs in `__DEV__` mode.

## Constraints

1. **No native modules** - Must work in Expo Go
2. **No Node.js imports** - No `node:*` modules
3. **No `any` types** - Use types from `types/index.ts`
4. **Only in-progress courses** - Via Moodle API classification
5. **Only courses with attendance** - Filter `totalSessions === 0`
6. **Functional components only**

## Common Errors

| Error | Fix |
|-------|-----|
| "NitroModules not found" | Use Expo-compatible packages |
| "node:stream import" | Use htmlparser2, not cheerio |
| "Type 'any' not allowed" | Add proper type from `types/index.ts` |
| "Sesskey not found" | Check login session is valid |

## Testing

```bash
# Test scraper
node scripts/test-scraper.mjs

# Credentials
Username: REDACTED_LMS_USERNAME
Password: REDACTED_LMS_PASSWORD
```

## Code Style

- Functional programming
- Self-explanatory names
- No emojis
- Use theme constants (`Colors`, `Spacing`, `Radius`)
- kebab-case files, PascalCase components
- Import types: `import type { Type } from '@/types'`

---

**Expo SDK**: 54 | **React Native**: 0.81.5 | **TypeScript**: 5.9.2 (strict)
