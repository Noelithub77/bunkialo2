# Bunkialo web, PWA, and Worker plan

## Approaches

### Separate web application

Build a second React application for browsers.

- Pros: complete freedom for desktop UI and browser APIs.
- Cons: duplicates screens, state, parsers, and fixes from the Expo app.

### Shared Expo application with web-only platform files [CHOSEN]

Keep one Expo Router application and add `.web.ts` or `.web.tsx` files only where browser behavior differs.

- Pros: one UI and business-logic codebase; native behavior stays unchanged.
- Cons: some services need small platform-specific implementations.

## Selected architecture

1. Expo exports a single-page web application.
2. Cloudflare Workers Static Assets serves the web build at `bunkialo.workers.dev`.
3. A Hono Worker handles same-origin `/api/*` requests.
4. A SQLite-backed Durable Object stores one browser session's Moodle cookies, attendance tokens, push subscription, and reminder schedule.
5. The browser password manager stores credentials. Bunkialo does not persist raw passwords in web storage.
6. Expo SQLite stores the existing offline client cache. Its web build uses WebAssembly with cross-origin isolation headers.
7. Workbox builds the service worker for app-shell caching and Web Push.
8. Web refreshes use one `POST /api/sync` request. The Worker calls the user's Durable Object once, which fans out to LMS and the attendance portal and returns one combined payload. The upstream calls are subrequests inside that invocation, not separate browser-to-Worker requests.

### Request-count decision

The chosen refresh path is one browser request plus one Durable Object RPC per refresh. This is cheaper in Worker request metrics than making every LMS and attendance call through its own route. The Durable Object remains because it keeps Moodle cookies and attendance tokens server-side; a stateless cookie proxy would either expose credentials to the browser or require putting encrypted session state in every request.

## Security boundaries

- The login password travels only over HTTPS from the browser to Bunkialo's Worker and then to the selected IIIT Kottayam service.
- The Worker never stores or logs passwords.
- Moodle cookies and attendance tokens stay in a per-session Durable Object and are not returned to browser JavaScript.
- Relay destinations use fixed hosts and allowed path prefixes. The Worker is not a general-purpose proxy.
- API responses and login routes use `Cache-Control: no-store`.
- The PWA service worker never caches API requests or authenticated Moodle responses.

## Web-only behavior

- Desktop widths use a persistent left navigation rail and centered content.
- Narrow web widths use bottom navigation.
- WiFix routes, actions, settings, and background work are hidden or disabled.
- Web Push notifications contain the full assignment or course details requested by the user.
- Native builds retain Expo SecureStore, Expo Notifications, and WiFix.

## Package choices

- `hono`: small, typed Worker routing.
- `@pushforge/builder`: Web Crypto-based Web Push payloads that run directly in Cloudflare Workers.
- `workbox-build`: maintained PWA precache tooling with a custom service worker.
- `wrangler`: Cloudflare local development, generated types, and deployment.
