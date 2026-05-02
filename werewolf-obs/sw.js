// Service Worker for PWA
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
});

self.addEventListener('fetch', (e) => {
  // Simple pass-through
  e.respondWith(fetch(e.request));
});
