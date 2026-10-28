/*
 * ShiftSync service worker.
 *
 * Deliberately conservative:
 *  - only same-origin GET requests are considered;
 *  - /api responses, RSC navigation payloads and HTML documents are never cached;
 *  - the cache holds hashed build assets, PWA icons and the public offline page;
 *  - authenticated workforce/candidate data therefore never enters Cache Storage.
 *
 * Bump CACHE_VERSION when the caching contract changes. Old versioned caches are
 * deleted on activate so a deployment cannot keep serving obsolete assets.
 */
const CACHE_VERSION = "shiftsync-static-v2";
const STATIC_CACHE = `${CACHE_VERSION}-assets`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/manifest.webmanifest",
];

const STATIC_PATH_PREFIXES = ["/_next/static/", "/icons/"];
const STATIC_FILE_PATTERN = /\.(?:css|js|woff2?|ttf|otf|png|jpe?g|webp|svg|ico)$/i;
const PUBLIC_ASSETS = new Set([
  "/shiftsync-icon.png",
  "/shiftsync-logo.png",
  "/shiftsync-logo-light.png",
  "/avs-invoice-logo.png",
  "/avs-invoice-logo.jpg",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);

      // addAll aborts the whole install if one URL 404s, so tolerate individual
      // failures: a missing optional icon must not disable the service worker.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => undefined)
        )
      );

      // First install: activate immediately so the app is controlled without a
      // reload. Updates keep the old worker until the user accepts the prompt.
      if (!self.registration.active) {
        await self.skipWaiting();
      }
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith("shiftsync-") &&
              name !== STATIC_CACHE
          )
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const isStaticAsset = (url) => {
  if (PUBLIC_ASSETS.has(url.pathname)) return true;
  if (STATIC_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return true;
  }
  return STATIC_FILE_PATTERN.test(url.pathname);
};

const isCacheableResponse = (response) =>
  Boolean(response) &&
  response.ok &&
  response.status === 200 &&
  response.type === "basic";

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    // Do not cache navigations: pages are authenticated shells and may vary by
    // deployment. The offline page is the only document served from cache.
    return response;
  } catch {
    const cached = await caches.match(OFFLINE_URL);
    return (
      cached ||
      new Response("You are offline and no offline page is available.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

function staleWhileRevalidate(event) {
  const { request } = event;

  return (async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);

    const network = fetch(request)
      .then((response) => {
        if (isCacheableResponse(response)) {
          void cache.put(request, response.clone()).catch(() => undefined);
        }
        return response;
      })
      .catch(() => undefined);

    // Keep the worker alive long enough to refresh the cache in the background.
    event.waitUntil(network.then(() => undefined));

    if (cached) return cached;

    const fresh = await network;
    return (
      fresh ||
      new Response("Asset unavailable offline.", {
        status: 504,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  })();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Auth, workforce data, reports, uploads and RSC payloads stay network-only.
  if (url.pathname.startsWith("/api/")) return;
  if (url.searchParams.has("_rsc")) return;
  if (request.headers.has("range")) return;
  if (url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});
