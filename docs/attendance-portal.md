# Attendance Portal Integration

How Bunkialo reads attendance now that Moodle's `mod/attendance` is retired.
For the reverse-engineered API surface see [attendance-portal-recon.md](./attendance-portal-recon.md).

## Why

IIIT Kottayam moved attendance to `https://attendance.iiitkottayam.ac.in`. Courses are
still enrolled on Moodle, so Moodle remains the source for assignments, timeline,
resources and faculty. Only attendance moved.

Bunkialo derives its timetable from attendance records, so losing attendance also lost
bunk tracking and the timetable.

## Shape

```
Moodle  ──> assignments, timeline, resources, faculty, dashboard "Upcoming"
Portal  ──> attendance, bunks, timetable
```

`stores/attendance-store.ts` picks the source: portal when credentials are stored,
Moodle otherwise. Nothing downstream knows which one ran.

### The decision everything follows from

`AttendanceRecord.date` is regex-parsed in **16 call sites across 11 files**
(`utils/attendance-helpers.ts`, `utils/semester-course-filter.ts`,
`utils/timetable-inference.ts`, `utils/bunk-transfer.ts`, `stores/bunk-store.ts`,
`stores/timetable-store.ts`, four components, `hooks/use-bunk-actions.ts`). Most fail
*silently* on a format change — the worst being `isPastOrCompleted` returning `false`
universally, which makes `filterPastBunks` discard every bunk with no error.

So the adapter emits Moodle-style date strings and the entire downstream pipeline is
untouched. Inference, clustering, conflict resolution, bunk merge and ICS export took
**zero changes**.

```
Thu 1 Jan 2026 9:00AM - 9:55AM
```

Constraints, from the strictest regex in the set:

1. Leading 3-letter weekday, derived from the date — `timetable-inference.ts:177` reads
   `dayOfWeek` off the name, not the date, so a wrong name misfiles the class.
2. `d MMM yyyy`, day unpadded.
3. **No space before the meridiem.** `attendance-helpers.ts:40` and `:55` use
   `(?:AM|PM)` with no preceding `\s*`.

Do not put an ISO date in that field.

## Files

| File | Role |
|---|---|
| `services/attendance-portal.ts` | HTTP, auth, token and credential storage |
| `services/attendance-portal-adapter.ts` | Portal payload to `CourseAttendance`. Pure; type-only imports so tests can load it without an Expo runtime |
| `types/attendance.ts` | `PortalSession`, `PortalCourse`, `PortalSessionStatus`, `PortalLoginResult`, `CourseAttendance.source` |
| `stores/attendance-store.ts` | Source selection, in-flight de-duplication, change detection, reconnect flag |
| `components/settings/portal-settings-section.tsx` | Connect / disconnect / reconnect row |
| `components/modals/portal-connect-modal.tsx` | Email + password, and the 2FA code step |

## Auth

```
POST /api/auth/login  {email, password}
  -> {access, refresh, user}
  -> or {needs2fa, intermediate}     -> POST /api/auth/login/totp | /backup-code
  -> or {needsEmailOtp, intermediate} -> POST /api/auth/login/email-otp
POST /api/auth/refresh {refresh}
```

- Access token in memory only, never persisted.
- Refresh token and credentials in `expo-secure-store` with
  `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` — off device backups, unreadable
  while locked. Not applied to the existing `lms_credentials` entry, because changing
  the accessibility class invalidates the keychain item and would log out every current
  user. That is a migration, not a hardening.
- Credentials use the shared `Credentials` type from `types/auth.ts`, the same
  `{username, password}` shape `services/auth.ts` writes. `username` holds the email.
- The 2FA password is held **in memory** between the password step and the code step, so
  an incomplete login never leaves a password on disk. `disconnectPortal` clears it.
- On 401: refresh once, then retry once. Concurrent 401s share a single refresh promise —
  the N+1 fan-out means parallel 401s, and with token rotation, parallel refreshes
  invalidate each other and lock the user out.
- If refresh fails, re-login from the stored password (mirrors
  `services/auth.ts:292 tryAutoLogin`). Only if that also fails are credentials cleared,
  so a changed password prompts instead of retrying a rejected one forever.
- Logout clears the portal too (`stores/auth-store.ts`). It previously did not, which
  made "log out" untrue for one of the two accounts the app holds.
- Every request has a **30s timeout**. `fetch` has no default, and without one a stalled
  portal left `isLoading` true and the tab spinning with no way out.

## Reading attendance

```
GET /api/students/me/attendance                      -> {student, overall, byCourse, recent}
GET /api/students/me/courses/{courseId}/sessions     -> {course, faculty, ..., sessions}
```

The course list is **`byCourse`**. `courses` is the faculty dashboard's key; using it was
the first integration failure — empty attendance, empty bunks, empty timetable.

`percentage` is **not** in the payload (`courseId, courseCode, courseName, total,
present, dlCredited`), so the adapter derives it from `present / total`.

### Request load

A naive refresh is 1 + N requests. Three things keep that down:

1. **In-flight de-duplication.** The dashboard, attendance tab and timetable tab each
   trigger a fetch on mount; concurrent callers share one promise.
2. **Unchanged-course caching.** The summary already reports `present`/`total`. If
   neither moved, that course has no new sessions, so its request is skipped and the
   cached records are reused. Steady state is **1 request**, not 7.
3. **Change detection.** If the whole result is equivalent to what is in the store,
   `courses` and `lastSyncTime` are left alone. Writing them triggers `syncFromLms` and a
   timetable regeneration, so an unconditional write recomputed everything on every
   navigation.

Pull to refresh passes `force`, bypassing all three.

### Refresh cadence

Attendance **never refreshes in the background**. `dashboard-background.ts` only fetches
Moodle calendar events for deadline notifications. Data moves only while the app is open.

| Trigger | Staleness check |
|---|---|
| Attendance tab mount | 30 min (`attendance.tsx:57`) |
| Dashboard mount | none, queued after interactions |
| Pull to refresh | none, forced |
| Settings connect | once |

## Course identity

Portal course IDs are unrelated to Moodle's, and `bunk-store` keys every user
customisation by `courseId`. The adapter resolves portal courses onto the Moodle
`courseId` by course code, falling back to `portal:${CODE}`.

A portal ID therefore never reaches persisted state and **no store migration was needed**.
The join is idempotent: after the first sync, bunk-store holds `courseCode: "CSS311"`
against `courseId: "portal:CSS311"`, so re-resolving returns the same id and bunk notes
stay attached.

**Known limit**: two courses sharing a code (theory and lab listed separately) collapse
into one. Latent, not active.

## Semester handling

`bunk-store`'s auto-drop hides courses whose records fall mostly outside the current
semester window. It exists because Moodle's "in progress" list keeps stale courses.

The portal only ever returns the **active term**, so the heuristic has nothing to catch —
and it actively misfires: `utils/semester-course-filter.ts:66` hardcodes the window as
Aug–Nov, so on 1 Aug a course whose sessions are dated late July reads as entirely
outside it. Four of six courses were hidden this way.

Portal courses (`CourseAttendance.source === "portal"`) skip the heuristic. Moodle
courses behave exactly as before, pinned by a test.

## Timetable

Unchanged. The portal exposes no student-visible schedule, so slots are still inferred
from past sessions by `utils/timetable-inference.ts`.

Resilience: coverage is measured against `activeWeeksForDay` — weeks where the course
actually met — so a cancelled week is counted on neither side of the ratio and does not
drag the score down. Inference runs over all history, not a recent window, so one quiet
week cannot erase a slot.

Early in a term (`activeWeeksForDay < 3`) every cluster is kept, so slots look noisy
until a few weeks accumulate.

## Failure modes

| Failure | Behaviour |
|---|---|
| Portal signs itself out (password change, 2FA enabled, refresh expiry) | `portalDisconnected` persisted, red **Reconnect** row in Settings, explicit error text |
| Network error | Cache preserved, error shown in foreground, silent in background |
| Captive portal returns login HTML | JSON parse fails, treated as a failed fetch, cache preserved |
| Malformed session (bad date or time) | That row is dropped; the rest of the course still loads |
| Request stalls | Aborted at 30s |
| Empty result with a populated cache | Cache kept. An empty scrape means the module is gone or the session died, not that the student dropped every course |

## Testing

```bash
npm test        # 80 hermetic tests, no network
```

Runs on Node's built-in runner and imports the real `.ts` sources through a resolve hook
(`src/scripts/test-setup.mjs`). Requires **Node 22.15+** for `module.registerHooks` and
native TypeScript type stripping.

Test files are `*.test.mjs`. The pre-existing integration scripts are `test-*.mjs` and
also match `node --test`'s default glob, so the `test` script scopes explicitly — a bare
`node --test` would run them against the live LMS with real credentials.

Format tests assert correctness by feeding adapter output through the **real** downstream
parsers (`parseTimeSlot`, `isAttendanceRecordCompleted`, `inferRecurringLmsSlots`) rather
than restating the expected string, so format drift fails loudly.
