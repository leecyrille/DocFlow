const CACHE_NAME = 'docflow-static-v2';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/icons/favicon.svg', '/icons/pacetech-logo.svg'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    if (e.request.url.includes('graph.microsoft.com') || e.request.url.includes('/api/') || e.request.url.includes('login.microsoftonline.com')) return;
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        if (res.ok && res.type === 'basic') { const clone = res.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, clone)); }
        return res;
    }).catch(() => caches.match('/index.html'))));
});
