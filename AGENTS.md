# AGENTS.md - Project Guide

## Project Overview

use bun as package manager; keep Expo workflows consistent
ALWAYS USE NATIVEWIND (TAILWIND FOR REACT NATIVE) and preffer it over stylesheets
**Bunkialo** - React Native (Expo) app that scrapes attendance and assignments from IIIT Kottayam Moodle LMS.

**LMS**: `https://lmsug24.iiitkottayam.ac.in`

**Key Features**: Secure auth, Dashboard with timeline, Attendance tracking, Bunk management, Timetable generation, Mess menu, Academic calendar, GPA calculator, Background refresh, Local notifications, Offline cache, ICS export.

## Tech Stack

- **Framework**: Expo SDK 54 + Expo Router 6
- **Language**: TypeScript (strict, no `any`)
- **State**: Zustand + AsyncStorage
- **HTTP**: Axios with cookie interceptors
- **Parser**: htmlparser2
- **Storage**: expo-secure-store (credentials), AsyncStorage (cache)
- **Notifications**: expo-notifications
- **Calendar**: react-native-calendars, expo-calendar
- **Date Utils**: date-fns
- **UI**: react-native-paper (Material Design) + NativeWind (Tailwind)
- **Search**: fuse.js (fuzzy search)
- **Background tasks**: expo-background-task, expo-task-manager (WiFix auto reconnect)

## Project Structure

```
app/                    # Expo Router screens
  ├── _layout.tsx      # Root layout, auth routing
  ├── login.tsx        # Login screen
  ├── settings.tsx     # Settings screen
  ├── (fab-group)/     # FAB modal routes (acad-cal, gpa, wifix)
  ├── faculty/         # Faculty detail page
  │   └── [id].tsx     # Dynamic route for faculty details
  └── (tabs)/
      ├── index.tsx     # Dashboard - Timeline & Overdue assignments (Default)
      ├── attendance.tsx # Attendance list with bunk management
      ├── timetable.tsx # Generated timetable from attendance
      ├── faculty.tsx   # Faculty directory
      ├── mess.tsx      # Mess menu display
      └── _layout.tsx   # Tab navigator config

screens/                # Lazy-loaded screen bundles
  ├── acad-cal-screen.tsx
  ├── gpa-screen.tsx
  └── wifix-screen.tsx

components/            # React components organized by tab
  ├── acad-cal/
  ├── attendance/
  ├── dashboard/
  ├── faculty/
  ├── mess/
  ├── timetable/
  ├── wifix/           # WiFix log modal + exports
  ├── shared/
  ├── ui/
  ├── modals/
  ├── themed-text.tsx
  ├── themed-view.tsx
  ├── index.ts
  └── README.md

hooks/                 # Custom React hooks
services/              # Business logic (NO React)
background/            # Background tasks (dashboard refresh, WiFix login)
stores/                # Zustand stores (includes wifix-store, wifix-log-store)
data/                  # Static data (acad-cal, credits, faculty, mess)
types/                 # TypeScript types (domain-split, central index)
utils/                 # Utilities (html-parser, debug, notifications, ics-export)
constants/             # App constants (theme, wifix)
scripts/               # Node utilities (generate-icons, test-scraper, test-dashboard, test-timetable)
assets/                # Images/icons
global.css             # Web baseline
```

## Key Types (`types/index.ts`)

Types are organized by domain in separate files and re-exported from `types/index.ts`:

```typescript
// Core (types/attendance.ts)
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

// Academic Calendar (types/academic-calendar.ts)
type AcademicTermId = "even-2025-26" | "odd-2026-27";
type AcademicEventCategory = "academic" | "exam" | "holiday" | "committee" | "project" | "sports" | "festival" | "admin" | "result";
interface AcademicTermInfo {
  id;
  title;
  shortTitle;
  semesterLabel;
  startDate;
  endDate;
}
interface AcademicEvent {
  id;
  title;
  date;
  endDate?;
  category;
  termId;
  note?;
  isTentative?;
}

// GPA Calculator (types/gpa.ts)
type GradeLetter = "A" | "A-" | "B" | "B-" | "C" | "C-" | "D" | "F";
interface SemesterGpaEntry {
  id;
  label;
  sgpa;
  credits;
}
interface GpaCourseItem {
  courseId;
  courseName;
  courseCode;
  credits;
  grade;
}

// Dashboard (types/dashboard.ts)
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

// Mess Menu (types/common.ts)
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

// Moodle API (types/lms.ts)
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

// WiFix (types/wifix.ts)
type WifixConnectionState = "idle" | "checking" | "online" | "captive" | "offline" | "error";
type WifixPortalSource = "auto" | "manual";
interface WifixConnectivityResult {
  state;
  portalUrl;
  portalBaseUrl;
  statusCode;
  message;
}
interface WifixLoginResult {
  success;
  portalBaseUrl;
  statusCode;
  message;
}
interface WifixSettings {
  autoReconnectEnabled;
  backgroundIntervalMinutes;
  portalBaseUrl;
  manualPortalUrl;
  portalSource;
}
```

**Rule**: Never use `any`. Always import types from `types/index.ts`.

## Component Organization

Components are organized by the tab they belong to:

### Directory Structure

```
components/
├── acad-cal/          # Components used in Academic Calendar (FAB)
├── dashboard/          # Components used in Dashboard tab
├── attendance/         # Components used in Attendance tab (includes bunk management)
├── timetable/          # Components used in Timetable tab
├── faculty/            # Components used in Faculty tab
├── mess/              # Components used in Mess tab
├── shared/            # Shared components used across multiple tabs
├── ui/                # Base UI components
├── modals/            # All modal components re-exported
├── themed-text.tsx    # Theme components (kept at root)
├── themed-view.tsx    # Theme components (kept at root)
└── index.ts           # Main export file
```

### Import Guidelines

1. **Tab-specific imports**: Import directly from the tab's directory

   ```tsx
   import { EventCard } from "@/components/dashboard";
   ```

2. **FAB feature imports**: Import from acad-cal directory

   ```tsx
   import { ChangesModal } from "@/components/acad-cal";
   ```

3. **Shared components**: Import from shared directory

   ```tsx
   import { ConfirmModal } from "@/components/shared";
   ```

4. **UI components**: Import from ui directory

   ```tsx
   import { Button } from "@/components/ui";
   ```

5. **Convenience imports**: Use the main index for multiple imports
   ```tsx
   import { EventCard, TimelineSection, Button } from "@/components";
   ```

### Notes

- Bunk management functionality is part of the `attendance` directory as it's accessed from the Attendance tab
- Academic Calendar, GPA Calculator, and WiFix are accessed via FAB (Floating Action Button) modal routes
- Modal components are re-exported from the `modals` directory for convenience
- Theme components (`themed-text.tsx`, `themed-view.tsx`) remain at the root as they're fundamental utilities

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

### Faculty Directory

1. Faculty data stored in `data/faculty.ts`.
2. Search functionality with recent searches.
3. Faculty cards with contact details and courses.

### Mess Menu

1. Static menu data stored in `data/mess.ts`.
2. Helper functions to get current/next meal based on time.
3. Carousel display for upcoming meals with expandable items.
4. Daily schedule view with timeline visualization.

### Academic Calendar

1. Academic terms and events stored in `data/acad-cal.ts`.
2. Two sub-tabs: Calendar view and Up Next view.
3. Event categories with color coding and icons.
4. Event editing modal with date range support.
5. ICS export functionality for calendar apps.
6. Term-based filtering (Even/Odd semesters).

### GPA Calculator

1. Semester-based GPA entry with course breakdown.
2. Grade letters: A, A-, B, B-, C, C-, D, F.
3. Credit-weighted GPA calculation.
4. Automatic CGPA computation from all semesters.

### WiFix (Captive Portal Auto Login)

1. Screen: `screens/wifix-screen.tsx` (lazy-loaded via `app/(fab-group)/wifix.tsx`).
2. Background task: `background/wifix-background.ts` (expo-background-task + task manager).
3. Service: `services/wifix.ts` handles connectivity detection, login/logout, URL normalization.
4. Store: `stores/wifix-store.ts` for settings; `stores/wifix-log-store.ts` for logs; `components/wifix/wifix-log-modal.tsx` for viewing logs.
5. Constants: `constants/wifix.ts` presets and defaults; types in `types/wifix.ts`.

## Background Tasks & Notifications

```typescript
// background/dashboard-background.ts
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
6. **FAB Routes** - Academic Calendar, GPA Calculator, WiFix are modal routes accessed via FAB

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
# Test timetable
node scripts/test-timetable-logic.mjs
```

---

**Expo SDK**: 54 | **React Native**: 0.81.5 | **TypeScript**: 5.9.2 (strict) | **React**: 19.1.0 | **Preferred package manager**: pnpm
