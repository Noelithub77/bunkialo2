# Adopted file structure

```text
bunkialo2/
├── plan/
│   └── web-pwa-worker/
│       ├── file-structure.md
│       └── summary.md
├── public/
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── manifest.webmanifest
├── scripts/
│   └── build-web.mjs
├── src/
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx
│   │   │   └── _layout.web.tsx
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── settings.tsx
│   ├── background/
│   │   ├── dashboard-background.ts
│   │   ├── dashboard-background.web.ts
│   │   ├── wifix-background.ts
│   │   └── wifix-background.web.ts
│   ├── components/
│   │   ├── auth/
│   │   │   └── login-credentials-step.tsx
│   │   ├── settings/
│   │   │   └── developer-settings-section.tsx
│   │   └── ui/
│   │       ├── container.tsx
│   │       └── container.web.tsx
│   ├── services/
│   │   ├── api.ts
│   │   ├── api.web.ts
│   │   ├── auth/
│   │   │   ├── attendance-auth.ts
│   │   │   ├── attendance-auth.web.ts
│   │   │   ├── lms-auth.ts
│   │   │   ├── lms-auth.web.ts
│   │   │   └── web-password-manager.web.ts
│   │   ├── attendance/
│   │   │   ├── attendance-api.ts
│   │   │   └── attendance-api.web.ts
│   │   ├── sync/
│   │   │   └── app-sync.web.ts
│   │   ├── lms-download.ts
│   │   └── lms-download.web.ts
│   ├── types/
│   │   └── web-push.ts
│   └── utils/
│       ├── notifications.ts
│       └── notifications.web.ts
├── worker/
│   ├── app.ts
│   ├── index.ts
│   ├── session-object.ts
│   ├── lms/
│   │   ├── cookie-jar.ts
│   │   ├── fetch-with-cookies.ts
│   │   └── login-check.ts
│   ├── push/
│   │   └── send-push.ts
│   └── security/
│       ├── request-policy.ts
│       └── validation.ts
├── app.config.ts
├── metro.config.js
├── package.json
├── service-worker.ts
├── workbox-config.cjs
├── worker-configuration.d.ts
├── wrangler.jsonc
└── vitest.worker.config.ts
```

Only web-specific files replace native modules. Shared parsers, stores, screens, and domain types remain in their existing folders.
