const CACHE_NAME = 'tajer-v20';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/utils.js',
    './js/db.js',
    './js/firebase-config.js',
    './js/dashboard.js',
    './js/products.js',
    './js/customers.js',
    './js/customer-detail.js',
    './js/suppliers.js',
    './js/supplier-detail.js',
    './js/reports.js',
    './js/orders-history.js',
    './js/ai-analysis.js',
    './js/google-sync.js',
    './js/calculator.js',
    './js/whatsapp.js',
    './js/auth.js',
    './js/app.js',
    './lib/dexie.min.js',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// Install - cache all assets and force activate immediately
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate - delete ALL old caches immediately
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch - Network first, fallback to cache
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clone);
                });
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then(cached => {
                    return cached || new Response('Offline', { status: 503 });
                });
            })
    );
});
