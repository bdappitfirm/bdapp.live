/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'bdapp-v20'; // Bump version
const STATIC_CACHE = 'bdapp-static-v1';

const PRECACHE_FILES = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.ico',
    '/logo192.png',
    '/logo512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(PRECACHE_FILES).catch(err => {
                console.warn('SW: Pre-cache failure:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME && key !== STATIC_CACHE) {
                    return caches.delete(key);
                }
            })
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip API calls - IndexedDB in api.js handles these
    if (url.pathname.includes('/api/')) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).then(async (networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(request, networkResponse.clone());
                    return networkResponse;
                }
                const cached = await caches.match('/index.html') || await caches.match('/');
                return cached || networkResponse;
            }).catch(async () => {
                const cached = await caches.match('/index.html') || await caches.match('/');
                return cached || new Response('Offline mode enabled. Please connect to the internet.', {
                    status: 200,
                    headers: { 'Content-Type': 'text/plain' }
                });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(response => {
            return response || fetch(request).then(async (networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(request, networkResponse.clone());
                }
                return networkResponse;
            }).catch(() => {
                return new Response('Offline', { status: 503 });
            });
        })
    );
});
