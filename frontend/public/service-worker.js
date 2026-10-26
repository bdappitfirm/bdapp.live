/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'bdapp-shell-v23';
const STATIC_CACHE = 'bdapp-static-v23';

const PRECACHE_FILES = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.ico',
    '/logo192.png',
    '/logo512.png',
    '/bdschoolapplogo.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(PRECACHE_FILES).catch(err => {
                console.warn('SW: Pre-cache warning:', err);
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

    // Skip API and Admin calls
    if (url.pathname.includes('/api/') || url.pathname.startsWith('/admin')) {
        return;
    }

    // 1. Navigation requests (HTML pages / React Router paths)
    if (request.mode === 'navigate') {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                try {
                    const networkResponse = await fetch(request);
                    if (networkResponse && networkResponse.ok) {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    }
                } catch (e) {
                    // Offline - fallback to cached HTML shell
                }
                const cached = await cache.match('/index.html') || await cache.match('/') || await caches.match('/index.html');
                return cached || new Response('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' }
                });
            })
        );
        return;
    }

    // 2. Static assets (JS Chunks, CSS, Images, Fonts) - Stale-While-Revalidate Strategy
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                // Return cached version immediately, update in background if online
                fetch(request).then(async (netRes) => {
                    if (netRes && netRes.status === 200 && request.method === 'GET') {
                        const cache = await caches.open(STATIC_CACHE);
                        cache.put(request, netRes.clone());
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            // If not in cache, fetch from network
            return fetch(request).then(async (networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
                    const cache = await caches.open(STATIC_CACHE);
                    cache.put(request, networkResponse.clone());
                }
                return networkResponse;
            }).catch(() => {
                // If offline and request is for a script/JS, return valid empty script header to avoid SyntaxError
                if (request.destination === 'script' || url.pathname.endsWith('.js')) {
                    return new Response('/* offline script fallback */', {
                        status: 200,
                        headers: { 'Content-Type': 'application/javascript' }
                    });
                }
                return new Response('', { status: 404 });
            });
        })
    );
});
