// Editor de builds: la build de cada Pokémon del equipo se guarda como diferencias respecto a la de la base de datos.
//   member.b = { n: naturaleza, i: objeto ('' = ninguno), a: habilidad, m: [movimientos], e: [6 EVs], v: [6 IVs], sh: 1 }
//   (hp, atk, def, spa, spd, spe). Solo se guardan los campos que cambian; sin diferencias no hay `b`.
import { bestSetIndex } from './battle.js';
export { applyBuild } from './build.js';

export const KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const EV_MAX = 252, EV_TOTAL = 510;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Build de la base de datos de PokeScanner (o, sin sets de Smogon, una estimada) */
export function baseBuild(p, member, dict, ED) {
  const idx = member?.s != null && p.sets?.[member.s] ? member.s : bestSetIndex(p);
  const set = idx >= 0 ? p.sets[idx] : null;
  const physical = p.s[1] >= p.s[3];
  if (set) {
    const e = KEYS.map(k => set.ev?.[k] || 0);
    return { n: set.na?.[0] || (physical ? 'adamant' : 'modest'), i: set.i?.[0] || '', a: set.a?.[0] || p.ab?.[0]?.id || '', m: [...new Set(set.m.map(x => x[0]).filter(Boolean))].slice(0, 4), e, v: [31, 31, 31, 31, 31, 31] };
  }
  const learn = ED?.learn?.[p.id] || [];
  const cat = physical ? 'f' : 'e';
  const moves = learn.map(id => ({ id, m: ED.moves[id] })).filter(x => x.m && x.m[3] === cat && x.m[4] >= 60)
    .sort((a, b) => (p.t.includes(b.m[2]) ? 1.5 : 1) * b.m[4] - (p.t.includes(a.m[2]) ? 1.5 : 1) * a.m[4]).slice(0, 4).map(x => x.id);
  return { n: physical ? 'adamant' : 'modest', i: '', a: p.ab?.[0]?.id || '', m: moves, e: physical ? [4, 252, 0, 0, 0, 252] : [4, 0, 0, 252, 0, 252], v: [31, 31, 31, 31, 31, 31] };
}
/** Build con los cambios del equipo aplicados */
export const currentBuild = (base, b) => ({
  n: b?.n || base.n, i: b?.i ?? base.i, a: b?.a || base.a, m: b?.m ? [...b.m] : [...base.m], e: b?.e ? [...b.e] : [...base.e], v: b?.v ? [...b.v] : [...base.v], sh: !!b?.sh,
});
/** Deja solo lo que cambia respecto a la base. Devuelve null si no cambia nada */
export function diffBuild(base, cur) {
  const b = {};
  if (cur.n !== base.n) b.n = cur.n;
  if (cur.i !== base.i) b.i = cur.i;
  if (cur.a !== base.a) b.a = cur.a;
  if (!same(cur.m, base.m)) b.m = cur.m;
  if (!same(cur.e, base.e)) b.e = cur.e;
  if (!same(cur.v, base.v)) b.v = cur.v;
  if (cur.sh) b.sh = 1;
  return Object.keys(b).length ? b : null;
}
export const evTotal = e => e.reduce((a, x) => a + x, 0);

/** Estadísticas finales a nivel 100 */
export function finalStats(base, e, v, nat, natures) {
  const n = natures?.[nat] || {};
  return KEYS.map((k, i) => {
    const core = 2 * base[i] + (v[i] ?? 31) + Math.floor((e[i] || 0) / 4);
    if (k === 'hp') return base[0] === 1 ? 1 : core + 110;
    return Math.floor((core + 5) * (n.plus === k ? 1.1 : n.minus === k ? 0.9 : 1));
  });
}

