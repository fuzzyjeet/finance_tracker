// Lets the installed app open and show its last-known data without a connection.
// - Pages: network first, falling back to the cached app shell
// - /assets (hashed filenames) and icons: cache first
// - GET /api: network first, falling back to the last response (writes are never cached;
//   new transactions made offline are queued by the app itself)
const CACHE = 'jeetmoney-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const networkFirst = async (request, fallbackUrl) => {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackUrl ?? request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(fallbackUrl ?? request);
    if (cached) return cached;
    throw err;
  }
};

const cacheFirst = async request => {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
};

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/index.html'));
  } else {
    event.respondWith(cacheFirst(request));
  }
});
