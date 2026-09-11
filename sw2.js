/* 准拍 · 离线缓存 Service Worker
 *
 * 策略：
 *  - 页面（导航）：网络优先 → 保证用户总能拿到最新版本；离线时回退到缓存
 *  - 静态资源（图标等）：缓存优先
 *
 * 注意：导航请求（mode === 'navigate'）不能直接传给 fetch()，会抛 TypeError，
 * 所以这里统一用 fetch(url) 而不是 fetch(request)。
 */
const CACHE = 'zhunpai-v4';
const ASSETS = [
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

  const isPage = req.mode === 'navigate' || req.destination === 'document';

  if (isPage) {
    // 页面：网络优先，离线回退缓存
    e.respondWith(
      fetch(req.url, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req.url, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req.url, { ignoreSearch: true })
            .then((hit) => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  // 静态资源：缓存优先，只缓存成功响应
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req.url).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
