/* Back It (Onchain) — service worker (FE-31).
 *
 * Offline-first for the feed. Two caches:
 *   - shell: static assets + app shell (cache-first)
 *   - feed: GET /feed and /calls responses (network-first, stale while
 *     revalidating) so the feed renders from the last good snapshot when the
 *     network is down and only refills when a request actually succeeds.
 */
const SHELL_CACHE = 'backit-shell-v2';
const FEED_CACHE = 'backit-feed-v2';

const SHELL_URLS = ['/', '/manifest.json'];

const FEED_API_PATTERN = /\/feed|\/calls/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== FEED_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, copy);
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(FEED_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ items: [], nextCursor: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Feed API lives on a different origin in dev; cache those endpoints only.
  if (FEED_API_PATTERN.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Same-origin static assets and app shell.
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Back It';
  const options = {
    body: data.body || 'A call you follow needs your attention.',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || data.callId || 'backit-notification',
    renotify: true,
    data: { url: data.url || (data.callId ? `/calls/${data.callId}` : '/') },
    actions: data.callId ? [{ action: 'open-call', title: 'Open call' }] : [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      if (existing) {
        existing.navigate(target);
        return existing.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});