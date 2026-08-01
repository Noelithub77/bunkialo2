# Attendance Portal Recon

**Target**: `https://attendance.iiitkottayam.ac.in`
**Date**: 2026-08-01
**Status**: Recon complete. No live authenticated response captured.

## Why this exists

IIIT Kottayam stopped using the Moodle `mod/attendance` module. Attendance moved to a
separate portal. Courses are still enrolled on Moodle, so Moodle remains the source for
assignments, timeline, resources and faculty. Only attendance moved.

Bunkialo derives its timetable from Moodle attendance records
(`utils/timetable-inference.ts`), so the timetable, bunk tracking and attendance
percentage all lose their data source. See
[attendance-portal-migration-plan.md](./attendance-portal-migration-plan.md) for the work.

## Evidence quality

Everything below was read out of the production JS bundle
(`/assets/index-D0qOHsko.js`, 1,273,221 bytes) plus unauthenticated HTTP probes.

| Claim type | Confidence |
|---|---|
| Endpoint paths and HTTP methods | High. Read from call sites of the API helper. |
| Request bodies | High. Read from `JSON.stringify({...})` literals. |
| Response field names | High. Read from the React render code that consumes them. |
| Response field *types* and nullability | Medium. Inferred from usage. |
| Whether an endpoint returns past-term data | Low. Needs a live request. |

The Claude-in-Chrome extension was not connected during recon, and the CDP browser had
no session, so **no authenticated response body was observed**. Anything marked
UNVERIFIED below needs one live request to settle.

## Stack

- Vite + React SPA, React Router, TanStack Query.
- API: Node v22.23.2, Express-style (404 body is `Cannot GET /path`).
- `GET /api/health` → `{"ok":true,"checks":{"db":"ok"},"uptime_s":58196,"version":"0.1.0","env":"production"}`
- Built by FACTS-H Lab, maintained by Team_Academics (per page footer).
- No `/api/docs`, no `/api/openapi.json`. Both 404.
- Ships feature flags (`/api/admin/features`), maintenance windows and beta-feedback
  endpoints. Actively developed. Version `0.1.0`.

## Auth

```
POST /api/auth/login            {email, password}
  → {access, refresh, user}
  → OR {needs2fa, intermediate}
  → OR {needsEmailOtp, intermediate}

POST /api/auth/login/totp        {intermediate, code}        → {access, refresh, user}
POST /api/auth/login/email-otp   {intermediate, ...}         → {access, refresh, user}
POST /api/auth/login/backup-code {intermediate, backupCode}  → {access, refresh, user}
POST /api/auth/refresh           {refresh token}             → new access
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/forgot-password
```

Observed client behaviour:

- Access token is held **in memory only** (module-scope variable, never persisted).
- Refresh token is persisted at `localStorage["attendance.refresh"]`.
- Every request: `Authorization: Bearer ${access}`, `Content-Type: application/json`.
- On `401` with a non-null access token, the client calls `/api/auth/refresh` **once**,
  then retries the original request. Refresh is de-duplicated through a shared promise,
  so concurrent 401s trigger one refresh.
- Unauthenticated request → `401 {"error":"missing_token"}`.
- Auth failure past refresh dispatches a window event `auth:expired`.

2FA endpoints exist (`/api/auth/2fa/setup`, `/confirm`, `/disable`,
`/backup-codes/regenerate`). **UNVERIFIED**: whether 2FA is enforced for student accounts.

## Student endpoints

The full student-role surface. All are self-scoped by the JWT: there is **no student ID,
roll number or any other identifier in any path**. Login credentials are the only input.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/students/me/attendance?termId=` | Course summaries + recent sessions |
| GET | `/api/students/me/courses/{courseId}/sessions` | Full session history for one course |
| GET | `/api/terms` | Term list |
| GET | `/api/students/me/duty-leaves` | Duty leaves issued to this student |
| GET | `/api/students/me/leaves` | Personal leave applications |
| POST | `/api/students/me/leaves` | Apply for leave |
| POST | `/api/students/me/leaves/{id}/withdraw` | Withdraw application |
| GET | `/api/students/me/medical-leaves` | Medical leaves |
| POST | `/api/students/attendance/disputes` | `{sessionId, reason, requestedStatus}` |
| POST | `/api/students/checkin` | `{nonce, ...}` QR / geo check-in |
| GET | `/api/notifications` | Notifications |
| POST | `/api/notifications/{id}/read`, `/read-all` | Mark read |

Non-student roles exist and are gated server-side: faculty, HOD, dean, warden, staff,
parent, admin, gate. 233 endpoints total. Not relevant to Bunkialo.

Several student features are behind per-user permission flags checked client-side as
`student.checkin`, `student.appeals`, `student.medicalLeave`, `student.personalLeave`,
`student.gateExit`. Server almost certainly enforces them too.

## Response shapes

Read off the render code. Field names are reliable; types are inferred.

### `GET /api/students/me/attendance?termId=`

```ts
{
  student: { branch: string; semester: number | string };
  courses: {
    courseId: string;
    courseCode: string;
    courseName: string;
    present: number;
    total: number;
    percentage: number;   // rendered with .toFixed(1)
  }[];
  recent: SessionRecord[];          // across all courses
  thresholds: { weakBelow: number };
}
```

`termId` is optional. Omitted means the active term.

### `GET /api/students/me/courses/{courseId}/sessions`

```ts
{
  course: { id: string; code: string; name: string };
  faculty: { name: string }[];
  present: number;
  total: number;
  percentage: number;
  sessions: SessionRecord[];
}
```

### `SessionRecord`

```ts
{
  sessionId: string;
  date: string;        // rendered through a date formatter, so ISO-ish. UNVERIFIED exact format.
  startTime: string;   // rendered through a time formatter. UNVERIFIED exact format.
  endTime: string;
  section: string;
  topic: string | null;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "DUTY_LEAVE";
}
```

The session list has no date-range or pagination parameter in its call site, and the UI
filters All / Present / Absent purely client-side. That is only correct if the server
returns the complete list, so **this endpoint is the full attendance history for a course**.

### `GET /api/terms`

```ts
{ terms: { id: string; name: string; status: "ACTIVE" | "CLOSED" }[] }
```

The student page renders a term dropdown filtered to `status === "CLOSED"`, labelled
"View a past semester (read-only)". Closed terms stay queryable.

### `GET /api/students/me/duty-leaves`

```ts
{
  leaves: {
    id: string;
    category: string;               // SPORTS and others
    reason: string;
    fromDate: string;
    toDate: string;
    slot: "FULL_DAY" | string;
    status: "REVOKED" | string;
    issuer: { name: string; employeeId: string };
    revokedAt?: string;
    revokeReason?: string;
  }[];
}
```

## Session status enum

Exactly five values. Confirmed twice: the faculty mark-attendance UI builds its buttons
from the literal arrays `["PRESENT","ABSENT","LATE","EXCUSED"]` and
`["PRESENT","ABSENT","LATE","EXCUSED","DUTY_LEAVE"]`, and the status-colour function
switches on the same five.

```
PRESENT | ABSENT | LATE | EXCUSED | DUTY_LEAVE
```

Display rules the portal itself applies:

- `EXCUSED` is normalised to `ABSENT` before display. The portal counts excused as absent.
- `DUTY_LEAVE` renders as "Duty leave"; students covered by an active DL are badged `OD`
  in the faculty view until faculty sets the status.

### Correction: there is no `SCHEDULED` session status

An earlier pass matched the string `SCHEDULED` in the bundle and inferred that students
might receive future scheduled sessions, which would have given Bunkialo a real timetable
with no inference. That is wrong. In context, `SCHEDULED` belongs to **admin maintenance
windows** (`status === "SCHEDULED" || status === "ACTIVE"`, with a cancel action).
`PENDING` belongs to **dispute status** (`PENDING`/`APPROVED`/`REJECTED`). `OD` is a
badge label, not a status value.

**No evidence exists that students can read future sessions.** The backend clearly knows
the forward schedule, since faculty and admin have slot-scheduling endpoints
(`PATCH /api/faculty/classes/{id}/slot`, `POST /api/admin/sessions/{id}/move-slot`), but
no student endpoint exposes it. Plan for inference from past sessions, same as today.

## What the portal gives that Moodle did not

| | Moodle | Portal |
|---|---|---|
| Session time | Embedded in a display string, regex-parsed | `startTime` / `endTime` fields |
| Stable session identity | None | `sessionId` |
| Section / batch | None | `section` |
| Class topic | Free-text description | `topic` |
| Past semesters | Current term only | `/api/terms` + `?termId=` |
| Duty leave | Manual user entry | Official records with issuer |
| Dispute an absence | Not possible | `POST /students/attendance/disputes` |

## Open questions

Each needs one live authenticated request.

1. **Exact `date`, `startTime`, `endTime` string formats.** Decides the adapter's parsing.
   Both go through formatter functions before display, so the raw values are not visible
   in the bundle.
2. **Is 2FA enforced for students?** Decides whether ~150 lines of TOTP/OTP UI ship.
3. **Does `/students/me/courses/{id}/sessions` accept `termId`?** Not present at the call
   site. Past-term course drill-down may 404.
4. **Are there any `CLOSED` terms yet?** `version: 0.1.0` suggests the system is new. If
   there is exactly one term, cross-semester history is currently empty.
5. **Does `present` include `LATE`?** The UI prints present, absent and late as three
   separate figures, so the relationship is unclear. Affects percentage reconciliation.
6. **Rate limits.** Unknown. Reading N courses requires N+1 requests.

## Legal / operational

Reverse-engineered from the shipped client. No public API documentation and no reviewed
terms of service. The portal is at `0.1.0` with active feature-flag development, so the
contract can change without warning.

Recommended before building: ask FACTS-H Lab / Team_Academics for sanctioned access. It
costs one email, yields a stable contract, and may surface a real timetable endpoint that
removes the inference layer entirely.
