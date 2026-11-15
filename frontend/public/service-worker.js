/* eslint-disable no-restricted-globals */

// প্রতিটি রিলিজে এই ভার্সন বদলাতে হবে, যাতে পুরনো ক্যাশ মুছে নতুন বিল্ড ইনস্টল হয়।
const CACHE_VERSION = 'v4';
const CACHE_NAME = `bdapp-cache-${CACHE_VERSION}`;

// অ্যাপ শেল — সবসময় অফলাইনে থাকবে
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo.svg',
  '/logo192.png',
  '/logo512.png',
  '/bdschoolapplogo.png',
  '/bdschooapplogo.png'
];

/**
 * asset-manifest.json পড়ে বিল্ডের প্রতিটি ফাইল (সব lazy-loaded page chunk,
 * css, media) একবারেই ডাউনলোড করে ক্যাশ করে। ফলে ইউজার সাইটে একবার ঢুকলেই
 * প্রতিটি পেজ অফলাইনে কাজ করবে — আলাদা করে প্রতিটি পেজে ঢোকার দরকার নেই।
 */
const precacheBuild = async () => {
  const cache = await caches.open(CACHE_NAME);

  // ১) কোর শেল (একটি ফেল করলেও বাকিগুলো যেন ক্যাশ হয়)
  await Promise.all(
    CORE_ASSETS.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (err) {
        console.warn('SW: core asset skipped:', url, err);
      }
    })
  );

  // ২) বিল্ডের সব চাঙ্ক
  try {
    const res = await fetch('/asset-manifest.json', { cache: 'no-store' });
    if (!res.ok) return;

    const manifest = await res.json();
    const urls = new Set([
      ...Object.values(manifest.files || {}),
      ...(manifest.entrypoints || []).flat()
    ]);

    await Promise.all(
      [...urls].map(async (file) => {
        const url = file.startsWith('/') ? file : `/${file}`;
        try {
          if (url === '/index.html') return; // কোর ধাপে হয়ে গেছে
          const alreadyCached = await cache.match(url);
          if (alreadyCached) return;
          await cache.add(new Request(url, { cache: 'reload' }));
        } catch (err) {
          console.warn('SW: chunk skipped:', url, err);
        }
      })
    );

    console.log(`SW: precached ${urls.size} build files`);
  } catch (err) {
    console.warn('SW: asset manifest precache failed:', err);
  }
};

// Install: পুরো বিল্ড pre-cache এবং সাথে সাথে activate
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(precacheBuild());
});

// Activate: পুরনো ক্যাশ মুছে ফেলা এবং সব client দখলে নেওয়া
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              console.log('SW: cleaning legacy cache:', cache);
              return caches.delete(cache);
            }
            return null;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// নতুন SW কে সাথে সাথে activate করার সুযোগ (অটো-আপডেটের জন্য)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // শুধু same-origin GET URL গুলো আমরা হ্যান্ডেল করি
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (_) {
    return;
  }
  if (!url.protocol.startsWith('http')) return;
  if (url.origin !== self.location.origin) return; // ফন্ট/CDN ব্রাউজার নিজে সামলাবে

  // API কল api.js + Dexie offlineDb দিয়ে হ্যান্ডেল হয়
  if (url.pathname.startsWith('/api/')) return;

  // ১) SPA navigation -> Network First, না পেলে ক্যাশ করা শেল
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // `/` এবং `/index.html` দুই জায়গাতেই সর্বশেষ index.html রাখা হয়,
              // যাতে অফলাইন ফলব্যাক কখনো পুরনো chunk নাম ফেরত না দেয়।
              cache.put('/index.html', copy.clone());
              cache.put('/', copy);
            });
          }
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match('/index.html')) ||
            (await caches.match('/')) ||
            Response.error()
          );
        })
    );
    return;
  }

  // ২) হ্যাশেড বিল্ড অ্যাসেট (immutable) -> Cache First (দ্রুততম)
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // ৩) বাকি সব -> Stale While Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
