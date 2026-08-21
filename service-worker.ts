/// <reference lib="webworker" />

type ManifestEntry = { revision: string | null; url: string };
type PushDetails = {
  body?: string;
  data?: { url?: string };
  icon?: string;
  tag?: string;
  title?: string;
};

type BunkialoServiceWorker = ServiceWorkerGlobalScope & {
  __WB_MANIFEST: ManifestEntry[];
};

const isBunkialoServiceWorker = (value: unknown): value is BunkialoServiceWorker =>
  typeof value === "object" &&
  value !== null &&
  "clients" in value &&
  "registration" in value;

const runtime: unknown = globalThis;
if (!isBunkialoServiceWorker(runtime)) {
  throw new Error("Bunkialo service worker started outside a service worker.");
}
const serviceWorker = runtime;

const APP_CACHE = "bunkialo-app-v1";
const manifestUrls = serviceWorker.__WB_MANIFEST.map((entry) => entry.url);

serviceWorker.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(manifestUrls)),
  );
  void serviceWorker.skipWaiting();
});

serviceWorker.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key !== APP_CACHE)
              .map((key) => caches.delete(key)),
          ),
        ),
      serviceWorker.clients.claim(),
    ]),
  );
});

serviceWorker.addEventListener("fetch", (event: FetchEvent) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== serviceWorker.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        const shell = await caches.match("/");
        if (shell) return shell;
      }
      return new Response("Bunkialo is offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }),
  );
});

serviceWorker.addEventListener("push", (event: PushEvent) => {
  const details: PushDetails = event.data?.json() ?? {};
  event.waitUntil(
    serviceWorker.registration.showNotification(details.title ?? "Bunkialo reminder", {
      body: details.body,
      data: details.data,
      icon: details.icon ?? "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: details.tag,
    }),
  );
});

serviceWorker.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const details = event.notification.data as { url?: string } | undefined;
  const target = details?.url ?? "/";
  event.waitUntil(serviceWorker.clients.openWindow(target));
});
