# Adopted file structure

```text
plan/
  attendance-portal-migration/
    file-structure.md
    summary.md

src/
  app/
    _layout.tsx
    login.tsx
    settings.tsx
    (tabs)/
      attendance.tsx
      index.tsx
      timetable.tsx

  background/
    dashboard-background.ts
    wifix-background.ts

  components/
    auth/
      attendance-setup-sheet.tsx
      login-credentials-step.tsx
      portal-challenge-step.tsx
    dashboard/
      notices-modal.tsx
    settings/
      account-settings-section.tsx
      course-link-settings-section.tsx
      developer-settings-section.tsx

  services/
    archive/
      moodle-attendance.ts
    auth/
      attendance-auth.ts
      lms-auth.ts
      login.ts
      secure-auth-storage.ts
    attendance/
      attendance-api.ts
      attendance-schemas.ts
      attendance-sync.ts
      course-matcher.ts
      portal-notification-sync.ts
    sync/
      app-sync.ts
    lms-courses.ts

  stores/
    attendance-store.ts
    auth-store.ts
    course-link-store.ts
    portal-notification-store.ts
    storage.ts
    other persisted stores

  types/
    attendance-portal.ts
    attendance.ts
    auth.ts
    course-link.ts
    notification.ts

tests/
  unit/
    services/attendance/
    utils/
  integration/
    attendance-portal/test-attendance-portal.ts
    lms/
  e2e/lms/
  helpers/
    attendance-session.ts
    lms-session.ts
```
