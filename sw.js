const CACHE = 'sukon-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './watermark.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function notifyUpdated() {
  const all = await self.clients.matchAll({ type: 'window' });
  all.forEach(c => c.postMessage('sukon-updated'));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // يفتح فوراً من النسخة المحفوظة، ويحدّثها بالخلفية
    e.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          const changed = cached && cached.headers.get('etag') && cached.headers.get('etag') !== res.headers.get('etag');
          cache.put(req, copy).then(() => { if (changed) notifyUpdated(); });
        }
        return res;
      }).catch(() => null);
      if (cached) { e.waitUntil(net); return cached; }
      return (await net) || (await cache.match('./index.html')) || Response.error();
    }));
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(res => {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
      }))
    );
  }
  // طلبات Supabase لا تُحفظ أبداً
});
