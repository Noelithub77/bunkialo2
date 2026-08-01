# TODO

## Attendance portal

- [ ] **Fold `dlCredited` into the attendance percentage.** The portal's
      `/students/me/attendance` payload carries `dlCredited` (duty-leave sessions
      credited as attended) and the per-course response also carries `dlOverflow`. Both
      are currently ignored. If the portal counts duty leave toward its own percentage
      and Bunkialo does not, a course with duty leaves will disagree with the website.
      Needs one real course with a duty leave to confirm how the portal weights it before
      guessing. See `services/attendance-portal-adapter.ts`.

- [ ] **Two courses sharing a course code collapse into one.** `resolveCourseId` falls
      back to `portal:${CODE}`, so a theory and lab section listed separately under the
      same code would merge. Latent — all current codes are unique. Fix by including
      `section` in the key when a collision is detected.

- [ ] **Term rollover loses previous-semester bunk notes.** `syncFromLms` rebuilds
      bunk-store from the active term's courses, so last semester's courses and their
      notes disappear. Pre-existing behaviour, sharper now that term boundaries are real.
      `/api/terms` plus `?termId=` would allow browsing past semesters.

- [ ] **Replace the hardcoded semester windows.** `utils/semester-course-filter.ts:66`
      hardcodes Jan–Apr and Aug–Nov and guesses the semester from record dates.
      `/api/terms` returns real term IDs and statuses. Portal courses now skip the
      heuristic entirely, so this only affects the Moodle path.

- [ ] **Decide whether 2-hour slots are really labs.** `utils/timetable-inference.ts:132`
      treats any session of 110+ minutes as a lab. Predates the portal work and governs
      the Moodle path too, so changing it is a product decision.

- [ ] **Concurrency cap if the portal rate-limits.** Refreshes fan out one request per
      changed course. No 429 seen so far.

## Pre-existing

- [ ] Three TypeScript errors on `master`, unrelated to the portal work:
      `components/attendance/unified-course-card.tsx:338,354` and
      `components/dashboard/notices-modal.tsx:212` (`possibly undefined` arguments).

- [ ] `expo start --web` does not bundle: `react-native-image-viewing` ships no web
      variant of `ImageItem`, pulled in by `app/faculty/[id].tsx`.

- [ ] `checkAuth` has no timeout. Any hang in `SecureStore.getItemAsync` leaves
      `isCheckingAuth` true forever and the splash screen never hides
      (`app/_layout.tsx:79`, `:86` both gate on it).
