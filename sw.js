// PokeScanner: modo sin conexión.
//  - Código y datos: primero la red (así siempre ves la última versión) y, si no hay conexión, lo guardado.
//  - Imágenes y fuentes: primero lo guardado, y se guardan al verlas.
//  - Las llamadas a la cuenta (Supabase) no pasan por aquí.
const V = 'v1';
const CORE = `pk-core-${V}`, DATA = `pk-data-${V}`, IMG = `pk-img-${V}`;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/auth.js', 'js/battle.js', 'js/build.js', 'js/calcx.js', 'js/doubles.js', 'js/editor.js', 'js/i18n.js', 'js/icons.js', 'js/meta.js', 'js/singles.js', 'js/team.js', 'js/util.js',
  'vendor/supabase.js', 'vendor/smogon-calc.js',
  'fonts/lexend-latin-400-normal.woff2', 'fonts/lexend-latin-700-normal.woff2', 'fonts/lexend-latin-ext-400-normal.woff2', 'fonts/lexend-latin-ext-700-normal.woff2',
  'icons/icon.svg', 'icons/spin.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'data/index.json', 'data/meta.json', 'data/dict.json',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('pk-') && ![CORE, DATA, IMG].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
async function networkFirst(req, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName);
  try {
    const res = await withTimeout(fetch(req), 4000);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || (await caches.match(req)) || (fallbackKey ? await caches.match(fallbackKey) : null) || Response.error();
  }
}
async function imageFirst(req) {
  const cache = await caches.open(IMG);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  try {
    // las imágenes de otras webs se piden con CORS para poder guardarlas sin que ocupen de más
    const res = req.url.startsWith(self.location.origin) ? await fetch(req) : await fetch(req.url, { mode: 'cors' });
    if (res.ok) cache.put(req.url, res.clone());
    return res;
  } catch {
    try { return await fetch(req); } catch { return Response.error(); }
  }
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/supabase\.(co|in)$/.test(url.hostname)) return;
  if (req.destination === 'image' || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(url.pathname) && url.origin !== self.location.origin) { e.respondWith(imageFirst(req)); return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/fonts/')) { e.respondWith(caches.match(req).then(h => h || networkFirst(req, CORE))); return; }
  if (req.mode === 'navigate') { e.respondWith(networkFirst(new Request('index.html'), CORE, 'index.html').catch(() => Response.error())); return; }
  e.respondWith(networkFirst(req, url.pathname.includes('/data/') ? DATA : CORE));
});
