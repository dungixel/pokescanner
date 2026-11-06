// Registro de cambios: compara los datos de la última visita con los actuales y apunta lo que cambió
// (tier, tipos y estadísticas de los Pokémon, Pokémon nuevos, y lo que hacen movimientos, habilidades y objetos).
// Todo se guarda en este dispositivo: la foto de los datos, el registro y los avisos pendientes.
import { store } from './util.js';

const SNAP_KEY = 'pk.snap', LOG_KEY = 'pk.log', BN_KEY = 'pk.banners';
const LOG_MAX = 800, BN_MAX = 300;

const rd = (k, d) => { try { const v = JSON.parse(store.get(k) || 'null'); return Array.isArray(d) ? (Array.isArray(v) ? v : d) : (v ?? d); } catch { return d; } };
export const readLog = () => rd(LOG_KEY, []);
export const readBanners = () => rd(BN_KEY, []);
export const saveBanners = list => store.set(BN_KEY, JSON.stringify(list.slice(0, BN_MAX)));

const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const txt = x => hash(x.xe || x.de || x.x || x.d || '');

const pkSig = p => `${p.r}|${p.t.join(',')}|${p.s.join(',')}|${p.sh || ''}`;
const MV = ['t', 'c', 'p', 'a', 'pp', 'pr'];
const mvSig = m => [...MV.map(k => m[k] ?? ''), txt(m)].join('|');
const txSig = x => txt(x);

/** Cambios de un Pokémon entre dos firmas (r|t|s) */
function pkDiff(a, b) {
  const [ra, ta, sa, ha] = a.split('|'), [rb, tb, sb, hb] = b.split('|'), c = [];
  if (ra !== rb) c.push(['r', ra, rb]);
  if (ta !== tb) c.push(['t', ta.split(','), tb.split(',')]);
  if (sa !== sb) c.push(['s', sa.split(',').map(Number), sb.split(',').map(Number)]);
  if (ha !== undefined && ha !== '' && hb !== undefined && ha !== hb) c.push(['b']); // builds de Smogon cambiados (si antes no había huella, no cuenta)
  return c;
}
const num = v => (v === '' ? null : /^-?\d+$/.test(v) ? Number(v) : v);
function mvDiff(a, b) {
  const x = a.split('|'), y = b.split('|'), c = [];
  MV.forEach((k, i) => { if (x[i] !== y[i]) c.push([k, num(x[i]), num(y[i])]); });
  if (x[MV.length] !== y[MV.length]) c.push(['x']);
  return c;
}
const txDiff = (a, b) => (a !== b ? [['x']] : []);

function diffMap(prev, cur, k, d, differ) {
  const out = [];
  for (const id in cur) if (prev[id] != null && prev[id] !== cur[id]) { const c = differ(prev[id], cur[id]); if (c.length) out.push({ d, k, id, c }); }
  return out;
}

/** Junta cambios nuevos con los que ya había del mismo elemento (el primer "antes" se queda, el último "después" gana) */
function merge(list, add) {
  for (const e of add) {
    const old = list.find(x => x.k === e.k && x.id === e.id);
    if (!old) { list.unshift(e); continue; }
    for (const [f, a, b] of e.c) {
      const o = old.c.find(x => x[0] === f);
      if (o) { o[2] = b; if (f === 'x') continue; if (JSON.stringify(o[1]) === JSON.stringify(o[2])) old.c.splice(old.c.indexOf(o), 1); } else old.c.push([f, a, b]);
    }
    old.d = e.d;
    if (!old.c.length) list.splice(list.indexOf(old), 1);
  }
  return list;
}

/**
 * Compara con la foto guardada. Solo hace falta cuando cambia la fecha de los datos (meta.generado).
 * Devuelve cuántos cambios nuevos hay (0 si no hay o si es la primera visita).
 */
export async function detectChanges({ generado, index, loadDict }) {
  if (!generado || !index?.length) return 0;
  let prev = null; try { prev = JSON.parse(store.get(SNAP_KEY) || 'null'); } catch { /* ilegible */ }
  if (prev?.g === generado && prev.v === 1) return 0;
  const dict = await loadDict();
  const cur = { v: 1, g: generado, p: {}, m: {}, a: {}, i: {} };
  for (const p of index) cur.p[p.id] = pkSig(p);
  for (const id in dict.moves) cur.m[id] = mvSig(dict.moves[id]);
  for (const id in dict.abilities) cur.a[id] = txSig(dict.abilities[id]);
  for (const id in dict.items) cur.i[id] = txSig(dict.items[id]);
  let added = [];
  if (prev?.v === 1 && prev.p) { // en la primera visita solo se guarda la foto
    const d = generado.slice(0, 10);
    added = [
      ...Object.keys(cur.p).filter(id => prev.p[id] == null).map(id => ({ d, k: 'new', id, c: [] })),
      ...diffMap(prev.p, cur.p, 'pk', d, pkDiff),
      ...diffMap(prev.m || {}, cur.m, 'mv', d, mvDiff),
      ...diffMap(prev.a || {}, cur.a, 'ab', d, txDiff),
      ...diffMap(prev.i || {}, cur.i, 'it', d, txDiff),
    ];
  }
  if (added.length) {
    store.set(LOG_KEY, JSON.stringify([...added, ...readLog()].slice(0, LOG_MAX)));
    saveBanners(merge(readBanners(), JSON.parse(JSON.stringify(added))));
  }
  store.set(SNAP_KEY, JSON.stringify(cur));
  return added.length;
}
