/* Cache isolated to this GitHub Pages project (important for github.io origins). */
const CACHE_PREFIX = 'thoi-gian-gotino-pages-';
const CACHE_NAME = CACHE_PREFIX + 'v1.4.0';
const FILES = ['./', './index.html', './styles.css?v=1.4.0', './app.js?v=1.4.0', './events.js?v=1.4.0', './manifest.webmanifest', './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable-512.png', './assets/apple-touch-icon.png'];
const base = new URL(self.registration.scope);
const offlinePage = new URL('./index.html', base);
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
 const req=event.request;
 const url=new URL(req.url);
 if(req.method !== 'GET' || url.origin!==base.origin || !url.pathname.startsWith(base.pathname)) return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(res=>{
   if(res.ok){const clone=res.clone();caches.open(CACHE_NAME).then(cache=>cache.put(offlinePage,clone));}
   return res;
  }).catch(()=>caches.match(offlinePage)));
  return;
 }
 event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => {
  if(res.ok){const clone=res.clone();caches.open(CACHE_NAME).then(cache=>cache.put(req,clone));}
  return res;
 })));
});
