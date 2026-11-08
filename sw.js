/* BrainPlay Kids service worker — precache the app shell so it runs fully offline once installed */
const VERSION = 'bp-v1';
const SHELL = [
  './', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-192.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const fetching = fetch(e.request).then(res => {
        if (res && (res.ok || res.type === 'opaque')) caches.open(VERSION).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || fetching; // cache-first, refresh in background
    })
  );
});
