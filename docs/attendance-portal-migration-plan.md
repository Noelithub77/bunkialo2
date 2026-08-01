# Attendance Portal Migration Plan

Companion to [attendance-portal-recon.md](./attendance-portal-recon.md). Read that first
for the API surface.

**Goal**: restore attendance, bunks and timetable from
`attendance.iiitkottayam.ac.in`. Moodle keeps everything else.

**Shape of the answer**: no new store, no new types file, no migration, and no changes
to `timetable-inference.ts`, `timetable-store.ts` or `bunk-store.ts`.

## Status

| Phase | State |
|---|---|
| P0 empty-scrape guard | Done. `stores/attendance-store.ts` |
| P1 portal client + adapter | Done. Formats pinned against a live response 2026-08-01 |
| P2 credential entry UI | Code complete, **not yet verified on a device** |
| 2FA support | Not built. Blocked on whether it is enforced |

`npm test` → 38 passing. `npx tsc --noEmit` clean. `npx expo lint` 0 errors.

### Deviations from the plan as written

1. **The adapter is its own file** (`services/attendance-portal-adapter.ts`), not folded
   into the client. Testability forced it: the client imports `expo-secure-store`, so a
   combined module cannot load under `node --test` without an Expo mock harness. The pure
   adapter has type-only imports and loads directly.
2. **A test harness was added** (`src/scripts/test-setup.mjs`, `test-stub.mjs`, `npm test`).
   The existing `src/scripts/test-*.mjs` scripts duplicate the logic they test, so they
   cannot disagree with the real code. The new harness resolves the `@/` alias and stubs
   native modules so tests import real `.ts` sources. Requires Node 22.15+ for
   `module.registerHooks` and native type stripping.
   Test files are named `*.test.mjs`; the existing scripts are `test-*.mjs`. Both match
   `node --test`'s default glob, so the `test` script scopes explicitly — a bare
   `node --test` would execute the live-LMS scripts with real credentials.
3. **`storage.ts:2`** changed `import { StateStorage }` to `import type`. It is a type
   imported as a value; Metro's Babel tolerates it, Node's type stripping does not.
   Behaviour identical.

### Formats, confirmed 2026-08-01

```
date:      "2026-07-31T00:00:00.000Z"   calendar date at UTC midnight
startTime: "11:30"                       24-hour HH:MM
endTime:   "13:30"
statuses seen: PRESENT, ABSENT
```

The UTC-midnight date was a real defect in the first cut: parsing it through local time
rolls the day back for anyone west of UTC, producing the wrong weekday and filing the
class on the wrong day of the timetable. It worked here only because IST is UTC+5:30.
Fixed by reading the `YYYY-MM-DD` prefix directly. Could not be demonstrated as a failing
test locally — Node ignores `TZ` on this Windows setup — so the invariant is encoded
instead: the ISO form and the bare form must format identically.

The 12-hour time branch was deleted once the real format was known. A meridiem time is
now rejected, so a future format change surfaces as missing sessions rather than silently
wrong times.

### Known behaviour worth a decision

A 2-hour slot (11:30–13:30 was observed) trips the existing `>= 110 minutes implies lab`
rule at `utils/timetable-inference.ts:132` and is labelled a lab. That rule predates this
work and also governs the Moodle path, so it was left alone. If those slots are not labs,
changing it is a product decision affecting both sources.

---

## The one design decision everything follows from

`AttendanceRecord.date` is parsed as a Moodle display string in **16 call sites across 11
files** (`utils/attendance-helpers.ts:38,45,68,86,103`, `utils/semester-course-filter.ts:34`,
`stores/timetable-store.ts:87`, `stores/bunk-store.ts:73,140`,
`utils/timetable-inference.ts:177,183,191`, `utils/bunk-transfer.ts:51`, plus four
components and `hooks/use-bunk-actions.ts`). Most fail silently on a format change: the
worst is `isPastOrCompleted` returning `false` universally, which makes `filterPastBunks`
(`stores/bunk-store.ts:151`) discard every bunk with no error.

So the adapter emits Moodle-format strings and **the entire downstream pipeline is
untouched**. Inference, clustering, conflict resolution, bunk merge, ICS export, every
component: zero changes.

### Canonical string

```
Thu 1 Jan 2026 9:00AM - 9:55AM
```

Derived from the strictest regex in the set. Three constraints:

1. Leading 3-letter day name + whitespace (`timetable-inference.ts:177`).
2. `d MMM yyyy`, day unpadded (`timetable-inference.ts:183`).
3. **No space before the meridiem.** `attendance-helpers.ts:40` and `:55` use `(?:AM|PM)`
   with no `\s*` in front. `timetable-inference.ts:192` tolerates a space. Satisfy the
   stricter one.

Day name derived from the date, never trusted from the portal, because
`timetable-inference.ts:177` reads `dayOfWeek` off the leading name rather than the date.

---

## Phase 0: stop the data loss

Independent. Ships now.

`scraper.fetchAllAttendance()` returns `[]` with the module gone
(`services/scraper.ts:276-279`). `stores/attendance-store.ts:44` writes it straight into
state, wiping the cache. `bunk-store.syncFromLms` then drops every LMS course
(`stores/bunk-store.ts:194`), and on next launch `onRehydrateStorage`
(`stores/timetable-store.ts:641-654`) regenerates from empty and wipes the timetable too.

**Work**: `stores/attendance-store.ts`, change `(set)` → `(set, get)` at line 24, then in
`fetchAttendance`:

```ts
const courses = await scraper.fetchAllAttendance();
// ponytail: empty scrape = module gone or session dead, not "no courses". Keep cache.
// Ceiling: a student who genuinely drops all courses keeps stale data until reinstall.
if (courses.length === 0 && get().courses.length > 0) { set({ isLoading: false }); return; }
```

**Verify**: refresh with Moodle attendance dead, relaunch, confirm courses and timetable
persist.

~5 lines.

---

## Phase 1: portal client

**One new file**: `services/attendance-portal.ts`. Auth, fetch and adapter together. They
have one caller and change together, so splitting them is three files to keep in sync.

Plain `fetch`, not the axios instance from `services/api.ts`: that one is bound to the
Moodle base URL and carries a cookie interceptor (`:37-47`) and HTML session-expiry
detection (`:16-21`), all meaningless here. RN has `fetch`.

```
login(email, password)        → POST /api/auth/login
refreshAccess()               → POST /api/auth/refresh
fetchPortalAttendance()       → CourseAttendance[]
hasPortalCredentials()        → boolean
disconnectPortal()            → clears SecureStore
```

- Access token: module-scope variable. Never persisted.
- Refresh token + credentials: `expo-secure-store`, keys `attendance_portal_refresh` and
  `attendance_portal_credentials`, mirroring `services/auth.ts:21`.
- 401: refresh once, retry once. Share one in-flight refresh promise. Not optional
  cleverness: the N+1 fan-out means concurrent 401s, and if refresh tokens rotate,
  parallel refreshes lock the user out.
- N+1 requests (1 summary + 1 per course). `Promise.all`, same as
  `services/scraper.ts:283`.
- Logging through the existing `debug.scraper` channel.

**Types**: append to `types/attendance.ts`, no new file. ~15 lines.

```ts
export type PortalSessionStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "DUTY_LEAVE";
export interface PortalSession { sessionId; date; startTime; endTime; section; topic; status; }
export interface PortalCourse { courseId; courseCode; courseName; present; total; percentage; }
```

**Adapter rules**

| Portal | `AttendanceStatus` |
|---|---|
| `PRESENT` | `Present` |
| `ABSENT` | `Absent` |
| `LATE` | `Late` |
| `EXCUSED` | `Excused` |
| `DUTY_LEAVE` | `Excused` |

- `present` / `total` / `percentage` copied **straight from the portal response**, not
  recomputed. The portal counts `EXCUSED` as absent; Bunkialo does not. Copying keeps the
  app's numbers identical to the official ones.
- `description: ""`. `getCanonicalRecordDescription`
  (`utils/attendance-helpers.ts:124`) then falls back to the date, which is stable. Not
  `topic`: faculty edit it after the fact, which would change
  `buildRecordKey(date, description)` and orphan the user's bunk notes.
- `points: ""`, `attendanceModuleId: null`. Display-only fields.

**Course identity**: resolve to the Moodle `courseId` by matching `courseCode` against
`config.courseCode`, which `syncFromLms` already stores
(`stores/bunk-store.ts:262,297` via `extractCourseCode`, `utils/course-name.ts:21`). No
Moodle match → `portal:${courseCode}`, stable because it derives from the code, not the
portal's numeric ID.

This is why there is no migration phase. A portal ID never reaches persisted state, so
`bunk-store` and `timetable-store` never see a key they don't recognise, and no persist
version bumps. Skip the code-collision and missing-code handling until real data shows
either happening; `extractCourseCode` falling back to the whole string
(`utils/course-name.ts:37`) just means no match, which is already the handled path.

**Edit** `stores/attendance-store.ts`: if `hasPortalCredentials()`, fetch from the portal,
else Moodle. Keep the Phase 0 guard on both. ~15 lines.

**Test**: `src/scripts/test-portal-adapter.mjs`, run with `node`, no framework. Asserts a
formatted date string survives the three strictest consumers:

```
assert parseTimeSlot(s)                    === "9:00AM - 9:55AM"
assert isAttendanceRecordCompleted({date:s}) === true   // past date
assert parseAttendanceSlot({date:s}).slot.dayOfWeek === expected
```

That is the one check worth owning. If the format drifts, 16 call sites break silently and
this fails loudly.

**Verify**: per-course percentages match the portal web UI exactly. Timetable generates
without touching any timetable code.

~200 lines new, ~30 edited.

**Blocked on**: exact `date` / `startTime` / `endTime` formats. One live response settles it.

---

## Phase 2: credential entry

Settings screen, not `app/login.tsx`. Keeps the portal optional and avoids blocking
first-run on a second password.

- `components/settings/portal-settings-section.tsx` — connect / disconnect row.
- `components/modals/portal-connect-modal.tsx` — email + password form.
- `app/settings.tsx` — handlers and modal wiring.

Connection state is local `useState` seeded from `hasPortalCredentials()`, not a store:
it changes twice per install. Connecting calls `fetchAttendance()` and nothing else,
because `syncFromLms` and timetable regeneration already run off `lastSyncTime` when the
attendance tab renders (`app/(tabs)/attendance.tsx:111-123`). A 2FA challenge is reported
as unsupported rather than failing opaquely.

**Not covered by tests.** UI was not among the agreed seams, and React Native component
testing would mean adding a renderer dependency for one form. Verify manually:

1. Connect with a wrong password → clear error, nothing stored.
2. Connect with correct credentials → attendance repopulates, timetable regenerates.
3. Kill and relaunch → still connected, no re-prompt.
4. Disconnect → confirm dialog, attendance clears, no portal requests afterwards.
5. Connect on an account with 2FA, if one exists → the unsupported message, not a crash.

---

## Skipped, and when to add

| Skipped | Add when |
|---|---|
| 2FA UI (TOTP / email OTP / backup code) | Confirmed enforced for students. ~150 lines. |
| Structured `startTime`/`endTime` on `AttendanceRecord` | Never, unless string formatting shows up in a profile. The round trip is microseconds and it keeps 16 call sites untouched. |
| `portal-auth-store.ts` | A third screen needs live connection state. |
| Separate types / adapter files | They gain a second caller. |
| Term support (`?termId=`, `/api/terms`) | Someone asks for past semesters. Also the natural fix for the hardcoded Jan-Apr / Aug-Nov windows in `utils/semester-course-filter.ts:66`. |
| Rate-limit backoff, concurrency cap | A 429 is actually observed. |
| Duty-leave sync, disputes, check-in, notifications | Core path is stable and someone wants them. |
| `section`-aware clustering | Real data shows two sections colliding as a conflict. |
| Course-code collision handling | Two courses actually share a code. |
| Postman collection for the portal | Debugging needs it. `docs/postman/` has the Moodle one. |

---

## Sequencing

```
P0 guard   ── done
P1 client  ── done, formats pinned
P2 UI      ── code complete, needs device verification
```

## Unresolved questions

1. ~~Exact `date`, `startTime`, `endTime` formats.~~ Answered 2026-08-01, see above.
2. **Is 2FA enforced for students?** Currently reported as unsupported. If any student
   account requires it, that account cannot connect at all.
3. **Does `present` include `LATE`?** Unsettled: the sampled course had no `LATE`
   sessions. Only matters if the app's percentage disagrees with the portal's.
4. **Are `EXCUSED` and `DUTY_LEAVE` ever sent to students?** Only `PRESENT` and `ABSENT`
   were observed. The mapping handles all five, but is unexercised against real data.
5. **Sanctioned access from FACTS-H Lab / Team_Academics?** Portal is `0.1.0` with active
   feature-flag work; a scraped contract can break on any deploy.
6. **Rate limits**, given one request per course per refresh. Still unknown.
