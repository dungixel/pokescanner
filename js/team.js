// Análisis de equipo: usa solo los tipos y las estadísticas base de los Pokémon (no movimientos, habilidades ni objetos).
import { TYPES, matchups, typeName, pname, bst, tierNum } from './util.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// para cada tipo defensor: qué tipos atacantes le hacen daño súper eficaz
const SE_VS = Object.fromEntries(TYPES.map(d => [d, new Set(matchups([d])[2] || [])]));

const FAST = 100;   // Velocidad base para considerar rápido
const SLOW = 60;    // Velocidad base para considerar lento
const BULKY = 90;   // Defensa / Defensa Especial base para considerar buena

// nivel competitivo de cada Pokémon según su tier (1 = Ubers/OU, 0 = ZU); LC y sin evolucionar casi nada
const TIER_POWER = [0.05, 1, 1, 1, 0.92, 0.8, 0.66, 0.52, 0.42, 0.32, 0.22, 0.14, 0.07, 0];
// En dobles el nivel es otro: Incineroar es NU en individuales y DOU en dobles. Cada formato mide con lo suyo:
// individuales con la tier de Smogon; dobles con la tier de dobles de Showdown, y quien aparece en los builds de VGC de Champions (cv)
// cuenta como de primer nivel. Las Megas nuevas de Champions (tier CH) son de primer nivel en los dos.
const D_POWER = { DUber: 1, DOU: 1, DUU: 0.62, LC: 0.05, NFE: 0.05 };
const singlesPower = p => (p.r === 'CH' ? 1 : TIER_POWER[tierNum(p.r)] ?? 0.05);
export const pokePower = (p, mode = 'singles') => {
  if (mode !== 'doubles') return singlesPower(p);
  if (p.cv || p.r === 'CH') return 1;
  return p.dt ? D_POWER[p.dt] ?? singlesPower(p) : singlesPower(p);
};
/** Formato más probable del equipo cuando la persona no ha elegido: dobles si la mayoría juega en el VGC de Champions o es de dobles */
export const autoMode = team => (team.filter(p => p.cv || p.r === 'CH' || p.dt === 'DOU' || p.dt === 'DUber').length * 2 >= team.length ? 'doubles' : 'singles');

export const scoreInfo = s => (s >= 85 ? { k: 'excellent', c: '#3FB6C9' } : s >= 70 ? { k: 'great', c: '#6CC070' } : s >= 55 ? { k: 'ok', c: '#E6C84F' }
  : s >= 40 ? { k: 'weak', c: '#F0974B' } : { k: 'poor', c: '#E5645A' });

/**
 * @param {Array} team Pokémon del índice (id, t, s…)
 * @returns {{score:number, parts:Array, bad:Array, good:Array}}
 *   Cada hallazgo es { key, sev, vars, chips } y se escribe en app.js con t(`an_${key}_t`) / t(`an_${key}_d`).
 */
export function analyzeTeam(team, mode) {
  const n = team.length;
  if (mode !== 'singles' && mode !== 'doubles') mode = autoMode(team);
  const pw = p => pokePower(p, mode);
  const bad = [], good = [];
  const poke = list => list.map(p => ({ poke: p }));
  const types = list => list.map(ty => ({ type: ty }));
  const names = list => list.map(pname).join(', ');

  // ───── defensa de tipos ─────
  const mults = team.map(p => {
    const o = {};
    for (const [k, list] of Object.entries(matchups(p.t))) list.forEach(a => { o[a] = Number(k); });
    return o;
  });
  const perType = TYPES.map(a => {
    const weak = [], quad = [];
    let r = 0;
    mults.forEach((o, i) => {
      const v = o[a];
      if (v > 1) { weak.push(team[i]); if (v >= 4) quad.push(team[i]); } else if (v < 1) r++;
    });
    return { a, w: weak.length, r, net: weak.length - r, weak, quad };
  });
  let defPts = 40;
  for (const x of perType) defPts -= x.net >= 3 ? 10 : x.net === 2 ? 5 : 0;
  const quads = perType.flatMap(x => x.quad.map(p => ({ p, a: x.a })));
  defPts = clamp(defPts - Math.min(6, quads.length * 2), 0, 40);

  perType.filter(x => x.net >= 2).sort((a, b) => b.net - a.net || b.w - a.w).slice(0, 3).forEach(x => {
    bad.push({ key: x.r ? 'weak' : 'weak0', sev: 3 + x.net, vars: { type: typeName(x.a), w: x.w, r: x.r, n }, chips: poke(x.weak) });
  });
  if (quads.length) {
    bad.push({ key: 'quad', sev: 3, vars: { list: quads.map(({ p, a }) => `${pname(p)} (${typeName(a)})`).join(', ') }, chips: [] });
  }
  // tres o más del mismo tipo comparten debilidades
  const typeCount = {};
  team.forEach(p => p.t.forEach(ty => { typeCount[ty] = (typeCount[ty] || 0) + 1; }));
  Object.entries(typeCount).filter(([, k]) => k >= 3).sort((a, b) => b[1] - a[1]).slice(0, 1).forEach(([ty, k]) => {
    bad.push({ key: 'stack', sev: 2, vars: { k, type: typeName(ty) }, chips: poke(team.filter(p => p.t.includes(ty))) });
  });
  const resistant = perType.filter(x => x.r >= 2 && x.w === 0).sort((a, b) => b.r - a.r);
  if (resistant.length) good.push({ key: 'resist', sev: 2, vars: {}, chips: types(resistant.slice(0, 6).map(x => x.a)) });
  if (!perType.some(x => x.net >= 2)) good.push({ key: 'safe', sev: 3, vars: {}, chips: [] });

  // ───── cobertura ofensiva (solo con los tipos de los Pokémon) ─────
  const stab = new Set(team.flatMap(p => p.t));
  const covered = TYPES.filter(d => [...stab].some(a => SE_VS[d].has(a)));
  const missing = TYPES.filter(d => !covered.includes(d));
  const covPts = Math.round(20 * clamp((covered.length - 6) / 10, 0, 1) * 10) / 10;
  if (missing.length >= 2) bad.push({ key: 'cover', sev: missing.length >= 4 ? 4 : 2, vars: { k: missing.length }, chips: types(missing) });
  if (covered.length >= 15) good.push({ key: 'wide', sev: 2, vars: { k: covered.length }, chips: [] });

  // ───── estilo de ataque ─────
  let phys = 0, spec = 0, mixed = 0;
  team.forEach(p => { const d = p.s[1] - p.s[3]; if (d > 15) phys++; else if (d < -15) spec++; else mixed++; });
  const lean = Math.max(phys, spec) / n + (mixed / n) / 2;
  const atkPts = Math.round(10 * clamp(1 - (lean - 0.6) / 0.4, 0, 1) * 10) / 10;
  if (n >= 3 && lean >= 0.75) bad.push({ key: phys > spec ? 'phys' : 'spec', sev: lean >= 0.95 ? 4 : 3, vars: { k: Math.max(phys, spec), n }, chips: [] });
  else if (n >= 3 && lean <= 0.67 && phys && spec) good.push({ key: 'balance', sev: 2, vars: {}, chips: [] });

  // ───── velocidad ─────
  const fast = team.filter(p => p.s[5] >= FAST);
  const slow = team.filter(p => p.s[5] <= SLOW);
  const avgSpe = team.reduce((a, p) => a + p.s[5], 0) / n;
  // sin ningún rápido y con la mitad lentos, la lentitud es una estrategia (Espacio Raro): no se castiga, se reconoce
  const trick = n >= 3 && !fast.length && slow.length / n >= 0.5;
  let spePts = trick ? 7 : fast.length >= 2 ? 10 : fast.length === 1 ? 6 : avgSpe >= 85 ? 3 : 0;
  if (!trick && slow.length / n >= 0.6) spePts = Math.max(0, spePts - 3);
  if (trick) good.push({ key: 'trick', sev: 2, vars: { k: slow.length, n }, chips: poke(slow) });
  else {
    if (!fast.length) bad.push({ key: 'nofast', sev: 4, vars: {}, chips: [] });
    if (slow.length / n >= 0.6 && n >= 3) bad.push({ key: 'slow', sev: 3, vars: { k: slow.length, n }, chips: poke(slow) });
  }
  if (fast.length >= 2) good.push({ key: 'speed', sev: 2, vars: { k: fast.length }, chips: poke(fast) });

  // ───── resistencia (Defensa y Defensa Especial base) ─────
  const goodDef = team.filter(p => p.s[2] >= BULKY);
  const goodSpd = team.filter(p => p.s[4] >= BULKY);
  const need = Math.max(1, Math.round(n / 3));
  const bulkPts = Math.round((10 * Math.min(1, goodDef.length / need) + 10 * Math.min(1, goodSpd.length / need)) * 10) / 10;
  if (n >= 3 && !goodSpd.length) bad.push({ key: 'nospd', sev: 4, vars: {}, chips: [] });
  if (n >= 3 && !goodDef.length) bad.push({ key: 'nodef', sev: 4, vars: {}, chips: [] });
  if (goodSpd.length >= 2) good.push({ key: 'spd', sev: 2, vars: {}, chips: poke(goodSpd) });
  if (goodDef.length >= 2) good.push({ key: 'def', sev: 2, vars: {}, chips: poke(goodDef) });

  // ───── potencia general ─────
  const avgBst = Math.round(team.reduce((a, p) => a + bst(p.s), 0) / n);
  if (avgBst >= 540) good.push({ key: 'power', sev: 1, vars: { avg: avgBst }, chips: [] });

  // ───── nivel competitivo: la tier de cada Pokémon. Multiplica la puntuación de estructura ─────
  const power = team.reduce((a, p) => a + pw(p), 0) / n;
  const weakTier = team.filter(p => pw(p) <= 0.14);
  if (n >= 3 && weakTier.length >= 2) bad.push({ key: 'lowtier', sev: weakTier.length >= n / 2 ? 5 : 3, vars: { k: weakTier.length, n }, chips: poke(weakTier) });
  const topTier = team.filter(p => pw(p) >= 0.92);
  if (n >= 3 && topTier.length / n >= 0.66) good.push({ key: 'toptier', sev: 3, vars: { k: topTier.length, n }, chips: poke(topTier) });
  const structure = defPts + covPts + atkPts + spePts + bulkPts;
  const score = Math.round(structure * (0.4 + 0.6 * power));
  bad.sort((a, b) => b.sev - a.sev);
  good.sort((a, b) => b.sev - a.sev);
  return {
    score, mode, names: names(team),
    parts: [
      { k: 'def', v: defPts, max: 40 }, { k: 'cov', v: covPts, max: 20 }, { k: 'atk', v: atkPts, max: 10 },
      { k: 'spe', v: spePts, max: 10 }, { k: 'bulk', v: bulkPts, max: 20 }, { k: 'pow', v: power * 100, max: 100 },
    ],
    bad: bad.slice(0, 6), good: good.slice(0, 5),
  };
}
