# AGENTS.md - Project Guide

## Project Overview

**Bunkialo** - React Native (Expo) app that scrapes attendance and assignments from IIIT Kottayam Moodle LMS.

**LMS**: `https://lmsug24.iiitkottayam.ac.in`

**Key Features**: Secure auth, Dashboard with timeline, Attendance tracking, Background refresh, Local notifications, Offline cache.

## Tech Stack

- **Framework**: Expo SDK 54 + Expo Router 6
- **Language**: TypeScript (strict, no `any`)
- **State**: Zustand + AsyncStorage
- **HTTP**: Axios with cookie interceptors
- **Parser**: htmlparser2
- **Storage**: expo-secure-store (credentials), AsyncStorage (cache)
- **Notifications**: expo-notifications

## Project Structure

```
app/                    # Expo Router screens
  ├── _layout.tsx      # Root layout, auth routing
  ├── login.tsx        # Login screen
  └── (tabs)/
      ├── dashboard.tsx # Timeline & Overdue assignments (Default)
      ├── attendance.tsx # Attendance list
      └── bunks.tsx     # Bunk management
      └── _layout.tsx   # Tab navigator config

services/              # Business logic (NO React)
  ├── api.ts          # Axios + cookie interceptors
  ├── auth.ts         # Login/logout
  ├── dashboard.ts     # Moodle Timeline/Events API
  ├── background-tasks.ts # Refresh & Notifications
  └── scraper.ts      # Moodle API + HTML parsing

stores/                # Zustand stores
  ├── auth-store.ts
  ├── attendance-store.ts
  ├── dashboard-store.ts # Events, logs, sync state
  └── settings-store.ts  # Refresh interval, reminders

types/index.ts         # All TypeScript types
utils/debug.ts         # Debug logging
```

## Key Types (`types/index.ts`)

```typescript
// Core
type AttendanceStatus = "Present" | "Absent" | "Late" | "Excused";
interface AttendanceRecord {
  date;
  description;
  status;
  points;
  remarks;
}
interface CourseAttendance {
  courseId;
  courseName;
  totalSessions;
  attended;
  percentage;
  records;
}

// Dashboard
interface TimelineEvent {
  id;
  name;
  activityname;
  timesort;
  overdue;
  url;
  course;
}
interface DashboardLog {
  id;
  timestamp;
  message;
  type: "info" | "success" | "error";
}
interface DashboardSettings {
  refreshIntervalMinutes;
  reminders: number[];
  notificationsEnabled;
}

// Moodle API
interface MoodleAjaxRequest {
  index;
  methodname;
  args;
}
interface MoodleAjaxResponse<T> {
  error;
  exception?;
  data: T;
}
```

**Rule**: Never use `any`. Always import types from `types/index.ts`.

## Implementation Flow

### Dashboard & Timeline

1. GET `/my/` → extract `sesskey`
2. POST to Moodle AJAX API (`core_calendar_get_action_events_by_timesort`):
   - **Upcoming**: `timesortfrom: now`
   - **Overdue**: `timesortto: now, timesortfrom: now - 30 days`
3. Background Refresh: Interval based, schedules local notifications for upcoming deadlines.

### Course & Attendance

1. Fetch enrolled courses via `core_course_get_enrolled_courses_by_timeline_classification: inprogress`.
2. Scrape `/mod/attendance/view.php?id={id}&view=5` for user report.
3. Parse metrics: Total Sessions, Attended, Percentage.

## Background Tasks & Notifications

```typescript
// services/background-tasks.ts
startBackgroundRefresh(); // Starts setInterval for sync
scheduleAllEventNotifications(); // schedules reminders before deadlines
```

## Debug Logging

```typescript
import { debug } from "@/utils/debug";
debug.scraper("Dashboard refresh triggered", data);
```

## Constraints

1. **No native modules** - Must work in Expo Go
2. **No Node.js imports** - Use htmlparser2
3. **No `any` types**
4. **Initial Route** - `dashboard` is the default tab
5. **Functional components only**

## Common Errors

| Error                     | Fix                                            |
| ------------------------- | ---------------------------------------------- |
| "Alert.prompt not found"  | Use `Alert.alert` (cross-platform)             |
| "Index signature missing" | Remove unnecessary type assertions in API args |

## Testing

```bash
# Test scraper
node scripts/test-scraper.mjs
# Test dashboard
node scripts/test-dashboard.mjs
```

---

**Expo SDK**: 54 | **React Native**: 0.81.5 | **TypeScript**: 5.9.2 (strict)
