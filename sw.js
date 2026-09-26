// Service worker: l'app funciona sense connexió i s'instal·la com a aplicació.
// Puja CACHE cada vegada que canviïs index.html perquè els mòbils agafin la versió nova.
const CACHE = 'economia-v25';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'dades.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Només es guarden respostes correctes del mateix servidor (mai la pàgina d'un portal wifi)
const cacheable = r => r && r.ok && r.type === 'basic';

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Primer la xarxa (dades i pàgina sempre al dia; 'no-cache' evita la cache HTTP del navegador);
  // si no n'hi ha, la còpia guardada
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(r => {
      if (cacheable(r)) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
