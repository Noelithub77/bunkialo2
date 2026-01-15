# AGENTS.md - Project Collaboration Guide

This document provides guidance for LLMs collaborating on the Bunkialo project.

## Project Overview

**Bunkialo** is a React Native (Expo) app that scrapes attendance data from IIIT Kottayam's Moodle LMS.

**Target LMS**: `https://lmsug24.iiitkottayam.ac.in`

### Key Features
- Secure credential storage with `expo-secure-store`
- Cookie-based session management (pure JS, no native deps)
- HTML parsing with `htmlparser2` (works in React Native)
- Parallel course scraping for performance
- Offline caching with AsyncStorage
- Minimalistic black/gray gradient UI

## Technology Stack

| Category | Technology | Notes |
|----------|------------|-------|
| Framework | Expo SDK 54 + Expo Router 6 | File-based routing |
| Language | TypeScript (strict) | All code is typed |
| State | Zustand 5 | With AsyncStorage persistence |
| HTTP | Axios | With custom cookie interceptors |
| HTML Parser | htmlparser2 + domutils + css-select | Cheerio alternative for RN |
| Storage | expo-secure-store (credentials), AsyncStorage (cache) | No native modules |
| UI | Custom components + expo-linear-gradient | Black/gray theme |

## Project Structure

```
bunkialo/
├── app/                          # Expo Router screens
│   ├── _layout.tsx              # Root layout, auth routing, theme
│   ├── login.tsx                # Login screen
│   └── (tabs)/                  # Tab navigator group
│       ├── _layout.tsx          # Tab bar config
│       ├── index.tsx            # Attendance list (main screen)
│       └── settings.tsx         # Settings, logout
│
├── components/                   # UI components
│   ├── attendance-card.tsx      # Expandable course card
│   ├── stats-header.tsx         # Overall stats display
│   └── ui/                      # Base components
│       ├── button.tsx           # Gradient button
│       ├── container.tsx        # Safe area wrapper
│       ├── gradient-card.tsx    # Card with gradient
│       └── input.tsx            # Text input
│
├── services/                     # Business logic (NO React)
│   ├── api.ts                   # Axios instance + cookie interceptors
│   ├── auth.ts                  # Login/logout/credentials
│   ├── cookie-store.ts          # In-memory cookie management
│   └── scraper.ts               # HTML scraping logic
│
├── stores/                       # Zustand stores
│   ├── storage.ts               # AsyncStorage adapter
│   ├── auth-store.ts            # Auth state
│   └── attendance-store.ts      # Attendance data + cache
│
├── utils/                        # Utility functions
│   └── html-parser.ts           # htmlparser2 wrapper
│
├── types/                        # TypeScript types
│   └── index.ts                 # All shared interfaces
│
├── constants/                    # App constants
│   └── theme.ts                 # Colors, gradients, spacing
│
└── hooks/                        # React hooks
    └── use-color-scheme.ts      # Theme hook
```

## Key Implementation Details

### 1. Cookie Management (`services/cookie-store.ts`)

Pure JavaScript cookie store - no native dependencies.

```typescript
// How it works:
// 1. Response interceptor captures Set-Cookie headers
// 2. Cookies stored in memory Map
// 3. Request interceptor attaches Cookie header
// 4. Handles expiration automatically

// Usage:
cookieStore.setCookiesFromHeader(response.headers['set-cookie'])
const cookieHeader = cookieStore.getCookieHeader()
cookieStore.clear()
```

### 2. HTTP Client (`services/api.ts`)

Axios with interceptors for automatic cookie handling:

```typescript
// Request interceptor: attaches stored cookies
api.interceptors.request.use((config) => {
  config.headers.Cookie = cookieStore.getCookieHeader()
  return config
})

// Response interceptor: stores new cookies
api.interceptors.response.use((response) => {
  cookieStore.setCookiesFromHeader(response.headers['set-cookie'])
  return response
})
```

### 3. HTML Parsing (`utils/html-parser.ts`)

Wrapper around htmlparser2 for jQuery-like syntax:

```typescript
import { parseHtml, querySelector, querySelectorAll, getText, getAttr } from '@/utils/html-parser'

const doc = parseHtml(html)
const element = querySelector(doc, 'input[name="logintoken"]')
const value = getAttr(element, 'value')
const text = getText(element)
const links = querySelectorAll(doc, 'a')
```

### 4. Authentication Flow (`services/auth.ts`)

```
1. clearSession() - clear cookies
2. GET /login/index.php - get CSRF token (logintoken)
3. POST /login/index.php - submit credentials
4. Check response HTML for success indicators
5. Save credentials to expo-secure-store
```

### 5. Scraping Flow (`services/scraper.ts`)

```
1. GET /my/courses.php - list enrolled courses
2. For each course (parallel):
   a. GET /course/view.php?id={id} - find attendance module
   b. GET /mod/attendance/view.php?id={id} - get attendance table
   c. Parse table rows for date, status, points
3. Return CourseAttendance[] array
```

### 6. State Persistence (`stores/attendance-store.ts`)

```typescript
// Uses Zustand persist middleware with AsyncStorage
persist(
  (set) => ({ /* state and actions */ }),
  {
    name: 'attendance-storage',
    storage: createJSONStorage(() => zustandStorage),
    partialize: (state) => ({
      courses: state.courses,
      lastSyncTime: state.lastSyncTime,
    }),
  }
)
```

## Data Types (`types/index.ts`)

```typescript
interface AttendanceRecord {
  date: string
  description: string
  status: 'Present' | 'Absent' | 'Late' | 'Excused'
  points: string
  remarks: string
}

interface CourseAttendance {
  courseId: string
  courseName: string
  attendanceModuleId: string | null
  totalSessions: number
  attended: number
  percentage: number
  records: AttendanceRecord[]
  lastUpdated: number
}

interface Course {
  id: string
  name: string
  url: string
}
```

## Design System (`constants/theme.ts`)

```typescript
// Color palette
Colors.black        // #000000
Colors.white        // #FFFFFF
Colors.gray[50-950] // Gray scale
Colors.status.success // #22C55E (green)
Colors.status.warning // #F59E0B (yellow)
Colors.status.danger  // #EF4444 (red)

// Theme-aware
Colors.light / Colors.dark // Auto-switches based on system

// Gradients (for LinearGradient)
Gradients.dark.card   // ['#171717', '#0A0A0A']
Gradients.dark.button // ['#262626', '#171717']

// Spacing
Spacing.xs/sm/md/lg/xl/xxl // 4/8/16/24/32/48

// Border radius
Radius.sm/md/lg/xl/full // 8/12/16/24/9999
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm expo start

# Clear cache and start
pnpm expo start --clear

# Run on Android
pnpm expo start --android

# Run on iOS
pnpm expo start --ios

# Lint code
pnpm lint
```

## Debugging Tips

### 1. Network Issues
Check `services/api.ts` - add console.log in interceptors:
```typescript
api.interceptors.request.use((config) => {
  console.log('REQUEST:', config.url)
  console.log('COOKIES:', cookieStore.getCookieHeader())
  return config
})
```

### 2. Cookie Issues
Check `services/cookie-store.ts`:
```typescript
// After login, verify cookies are stored
console.log('Stored cookies:', cookieStore.getCookieHeader())
```

### 3. Parsing Issues
Check `utils/html-parser.ts` - test selectors:
```typescript
const doc = parseHtml(html)
console.log('Found elements:', querySelectorAll(doc, 'selector').length)
```

### 4. Auth Issues
In `services/auth.ts`:
```typescript
// Log the login token extraction
console.log('Login token:', extractLoginToken(html))
// Log success check
console.log('Login successful:', isLoginSuccessful(html))
```

### 5. State Issues
In stores, add logging:
```typescript
set((state) => {
  console.log('State update:', newState)
  return newState
})
```

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "NitroModules not found" | Using native package in Expo Go | Use Expo-compatible packages |
| "node:stream import" | Using Node.js package | Use RN-compatible alternative |
| "Missing default export" | Route file issue | Ensure `export default function` |
| "Network request failed" | CORS or connectivity | Check URL and network |
| "logintoken not found" | HTML structure changed | Update selectors in auth.ts |

## File Dependencies

```
app/_layout.tsx
  └── stores/auth-store.ts
      └── services/auth.ts
          ├── services/api.ts
          │   └── services/cookie-store.ts
          └── utils/html-parser.ts

app/(tabs)/index.tsx
  └── stores/attendance-store.ts
      └── services/scraper.ts
          ├── services/api.ts
          └── utils/html-parser.ts
```

## Important Constraints

1. **No native modules** - Must work in Expo Go
2. **No Node.js imports** - No `node:*` modules
3. **Pure JS cookies** - Custom cookie store, not tough-cookie
4. **htmlparser2 not cheerio** - Cheerio 1.x has Node deps
5. **AsyncStorage not MMKV** - MMKV requires native
6. **Functional components** - No class components
7. **TypeScript strict** - All code must be typed

## Testing Credentials

```
Username: REDACTED_LMS_USERNAME
Password: REDACTED_LMS_PASSWORD
LMS URL: https://lmsug24.iiitkottayam.ac.in
```

## Adding New Features

1. **New screens**: Add to `app/` folder with `export default function`
2. **New components**: Add to `components/` or `components/ui/`
3. **New services**: Add to `services/`, no React imports
4. **New types**: Add to `types/index.ts`
5. **New state**: Create store in `stores/` using Zustand

## Code Style

- Functional programming preferred
- Self-explanatory variable names
- No emojis in code or UI
- Use theme constants, not hardcoded colors
- Use Spacing constants, not hardcoded values
- kebab-case for files, PascalCase for components

---

**Last Updated**: January 2026
**Expo SDK**: 54
**React Native**: 0.81.5
