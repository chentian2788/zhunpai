/* 准拍 · 离线缓存 Service Worker */
const CACHE = 'zhunpai-v2';
const ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './terms.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // 逐个缓存：单个文件失败不影响整体安装
      .then((c) => Promise.all(ASSETS.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          // 只缓存「成功的同源响应」，避免把 404 / 错误页写进缓存
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch((err) => {
          // 离线兜底：只有「页面导航」且该页未缓存时，才退回首页
          if (req.mode === 'navigate') return caches.match('./index.html');
          throw err;
        });
    })
  );
});
