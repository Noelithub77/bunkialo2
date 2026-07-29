# Attendance portal migration

## Selected approach

- **[CHOSEN]** Keep Moodle for assignments, announcements, resources, and events.
- **[CHOSEN]** Use the attendance portal bearer-token API for attendance and alerts.
- **[CHOSEN]** Keep LMS course IDs and attendance UUIDs as separate fields.
- **[CHOSEN]** Store non-secret Zustand data with `expo-sqlite/kv-store`.
- **[CHOSEN]** Store both providers' credentials and attendance tokens in SecureStore.
- **[CHOSEN]** Show cached data first and refresh summaries before course sessions.
- **[CHOSEN]** Use foreground sync in Expo Go and the existing Expo background task in builds.

## Preserved code

The replaced Moodle attendance scraper is retained at:

`src/services/archive/moodle-attendance.ts`

The archive folder is excluded from TypeScript compilation and is not used at runtime.

## Runtime boundaries

- Moodle login uses a cookie store with expiry, domain, path, and one re-login retry.
- Attendance login uses rotating access and refresh tokens.
- A failed attendance login never overwrites working credentials.
- Dashboard and attendance sync settle independently.
- Historical portal notifications form a baseline and are not replayed locally.
