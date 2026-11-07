// Registro de cambios: la actualización diaria (scripts/build-changelog.mjs) compara los datos de cada día con los
// del anterior y deja el resultado en data/changelog.json. Aquí se lee ese registro y, en este dispositivo,
// solo se guarda hasta cuándo has visto cambios (para los avisos) y qué avisos quedan por cerrar.
import { store } from './util.js';
import { mergeLog } from './cgdiff.js';

const SEEN_KEY = 'pk.seen', BN_KEY = 'pk.banners', CACHE_KEY = 'pk.log2', OLD = ['pk.snap', 'pk.log'];
const BN_MAX = 300;

const rd = (k, d) => { try { const v = JSON.parse(store.get(k) || 'null'); return Array.isArray(d) ? (Array.isArray(v) ? v : d) : (v ?? d); } catch { return d; } };
export const readBanners = () => rd(BN_KEY, []);
export const saveBanners = list => store.set(BN_KEY, JSON.stringify(list.slice(0, BN_MAX)));

let LOG = null;
/** Registro completo del servidor (con copia en este dispositivo por si no hay conexión) */
export async function loadLog() {
  if (LOG) return LOG;
  try {
    const r = await fetch('data/changelog.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    LOG = (await r.json()).log || [];
    try { store.set(CACHE_KEY, JSON.stringify(LOG)); } catch { /* sin espacio */ }
  } catch { LOG = rd(CACHE_KEY, []); }
  return LOG;
}

/**
 * Avisos nuevos desde la última vez que este dispositivo miró. En la primera visita no hay avisos:
 * solo se apunta hasta dónde llega el registro. Devuelve cuántos avisos nuevos hay.
 */
export async function detectChanges({ generado }) {
  if (!generado) return 0;
  const log = await loadLog();
  const latest = log.reduce((m, e) => ((e.t || e.d) > m ? e.t || e.d : m), '');
  let seen = store.get(SEEN_KEY);
  if (!seen) { // si venía del sistema antiguo, la última foto guardada marca hasta dónde había visto
    let old = null; try { old = JSON.parse(store.get('pk.snap') || 'null'); } catch { /* ilegible */ }
    seen = old?.g || latest || generado;
  }
  OLD.forEach(k => { store.remove(k); });
  const fresh = log.filter(e => (e.t || e.d) > seen);
  store.set(SEEN_KEY, latest > seen ? latest : seen);
  if (!fresh.length) return 0;
  saveBanners(mergeLog(readBanners(), JSON.parse(JSON.stringify(fresh))));
  return fresh.length;
}
