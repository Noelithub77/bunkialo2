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
  ├── settings.tsx     # Settings screen
  └── (tabs)/
      ├── index.tsx     # Dashboard - Timeline & Overdue assignments (Default)
      ├── attendance.tsx # Attendance list with bunk management
      ├── timetable.tsx # Generated timetable from attendance
      ├── faculty.tsx   # Faculty directory
      ├── mess.tsx      # Mess menu display
      └── _layout.tsx   # Tab navigator config

components/            # React components organized by tab
  ├── dashboard/      # Dashboard-specific components
  │   ├── event-card.tsx
  │   ├── timeline-section.tsx
  │   └── index.ts
  ├── attendance/     # Attendance & bunk management components
  │   ├── add-bunk-modal.tsx
  │   ├── attendance-card.tsx
  │   ├── course-edit-modal.tsx
  │   ├── dl-input-modal.tsx
  │   ├── duty-leave-modal.tsx
  │   ├── presence-input-modal.tsx
  │   ├── swipeable-attendance-slot.tsx
  │   ├── swipeable-bunk-item.tsx
  │   ├── total-absence-calendar.tsx
  │   ├── unified-course-card.tsx
  │   ├── unknown-status-modal.tsx
  │   └── index.ts
  ├── timetable/      # Timetable-specific components
  │   ├── day-schedule.tsx
  │   ├── day-selector.tsx
  │   ├── upnext-carousel.tsx
  │   └── index.ts
  ├── faculty/        # Faculty-specific components
  │   ├── faculty-card.tsx
  │   └── index.ts
  ├── mess/          # Mess-specific components
  │   ├── day-meals.tsx
  │   ├── meal-carousel.tsx
  │   ├── meal-day-selector.tsx
  │   └── index.ts
  ├── shared/        # Components used across multiple tabs
  │   ├── confirm-modal.tsx
  │   ├── external-link.tsx
  │   ├── haptic-tab.tsx
  │   ├── logs-section.tsx
  │   ├── current-class-card.tsx
  │   └── index.ts
  ├── ui/            # Base UI components
  │   ├── button.tsx
  │   ├── collapsible.tsx
  │   ├── container.tsx
  │   ├── gradient-card.tsx
  │   ├── input.tsx
  │   ├── icon-symbol.tsx
  │   └── index.ts
  ├── modals/        # All modal components re-exported
  │   ├── confirm-modal.tsx
  │   ├── selection-modal.tsx
  │   └── index.ts
  ├── themed-text.tsx # Theme text component
  ├── themed-view.tsx # Theme view component
  ├── index.ts       # Main export file
  └── README.md      # Component organization guide

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
  ├── course-name.ts  # Course name utilities
  └── notifications.ts # Notification helpers
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

## Component Organization

Components are organized by the tab they belong to:

### Directory Structure

```
components/
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

2. **Shared components**: Import from shared directory

   ```tsx
   import { ConfirmModal } from "@/components/shared";
   ```

3. **UI components**: Import from ui directory

   ```tsx
   import { Button } from "@/components/ui";
   ```

4. **Convenience imports**: Use the main index for multiple imports
   ```tsx
   import { EventCard, TimelineSection, Button } from "@/components";
   ```

### Notes

- Bunk management functionality is part of the `attendance` directory as it's accessed from the Attendance tab
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
