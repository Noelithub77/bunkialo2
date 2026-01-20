# AGENTS.md - Project Guide

## Project Overview

**Bunkialo** - React Native (Expo) app that scrapes attendance and assignments from IIIT Kottayam Moodle LMS.

**LMS**: `https://lmsug24.iiitkottayam.ac.in`

**Key Features**: Secure auth, Dashboard with timeline, Attendance tracking, Bunk management, Timetable generation, Mess menu, Background refresh, Local notifications, Offline cache.

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
      ├── index.tsx     # Dashboard - Timeline & Overdue assignments (Default)
      ├── attendance.tsx # Attendance list
      ├── bunks.tsx     # Bunk management
      ├── timetable.tsx # Generated timetable from attendance
      ├── mess.tsx      # Mess menu display
      └── _layout.tsx   # Tab navigator config

services/              # Business logic (NO React)
  ├── api.ts          # Axios + cookie interceptors
  ├── auth.ts         # Login/logout
  ├── dashboard.ts     # Moodle Timeline/Events API
  ├── background-tasks.ts # Refresh & Notifications
  ├── scraper.ts      # Moodle API + HTML parsing
  ├── baseurl.ts      # LMS base URL configuration
  └── cookie-store.ts # Cookie management utilities

stores/                # Zustand stores
  ├── auth-store.ts
  ├── attendance-store.ts
  ├── bunk-store.ts
  ├── dashboard-store.ts # Events, logs, sync state
  ├── settings-store.ts  # Refresh interval, reminders
  ├── timetable-store.ts  # Generated timetable state
  ├── faculty-store.ts    # Faculty directory state
  └── storage.ts          # AsyncStorage wrapper

data/                  # Static data
  ├── mess.ts         # Mess menu data and helpers
  ├── faculty.ts      # Faculty directory data
  └── credits.ts      # Course credits data

types/index.ts         # All TypeScript types
utils/                 # Utility functions
  ├── debug.ts        # Debug logging
  ├── html-parser.ts  # HTML parsing helpers
  └── course-name.ts  # Course name utilities
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

// Mess Menu
type MealType = "breakfast" | "lunch" | "snacks" | "dinner";
interface Meal {
  type: MealType;
  name: string;
  items: string[];
  startTime: string;
  endTime: string;
}
interface DayMenu {
  day: number; // 0=Sun, 1=Mon, etc
  meals: Meal[];
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

### Timetable Generation

1. Parse attendance records to extract day, time, and session type.
2. Generate timetable slots from attendance data.
3. Support for regular, lab, and tutorial sessions.
4. **Auto-detection**: 2-hour slots (≥110 minutes) are automatically marked as labs, regardless of description.

### Mess Menu

1. Static menu data stored in `data/mess.ts`.
2. Helper functions to get current/next meal based on time.
3. Carousel display for upcoming meals with expandable items.
4. Daily schedule view with timeline visualization.

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
4. **Initial Route** - `index` (dashboard) is the default tab
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
