// Análisis de equipo. Con los tipos y las estadísticas base de cada Pokémon; y, si tiene build (elegida o la recomendada de la base de datos),
// también con sus movimientos, habilidad, objeto, naturaleza y EVs: cobertura con los movimientos reales, velocidad y resistencia finales,
// inmunidades por habilidad u objeto, y reconocimiento de estrategias (Espacio Raro, Viento Afín, clima, roles de apoyo).
import { TYPES, matchups, typeName, pname, bst, tierNum, formatRank } from './util.js';
import { t } from './i18n.js';

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


// ───── builds ─────
let DATA = { moves: null, natures: null };
/** Datos del editor (tipo, categoría y potencia de cada movimiento; naturalezas). Sin ellos el análisis usa solo tipos y estadísticas base. */
export const setTeamData = ED => { DATA = { moves: ED?.moves || null, natures: ED?.natures || null }; };
const KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const DOUBLES_F = ['cvgc', 'vgc2025', 'doublesou'];
const fmtBase = f => String(f).split('@')[0];
/** Qué build recomendada usar cuando la persona no ha elegido una: en dobles las de dobles, en individuales las de individuales */
function pickSet(d, mode) {
  const sets = d.sets || [];
  if (!sets.length) return -1;
  const idx = sets.map((_, i) => i);
  if (mode === 'doubles') {
    for (const f of DOUBLES_F) { const i = idx.find(k => fmtBase(sets[k].f) === f); if (i != null) return i; }
  }
  const pool = idx.filter(i => !DOUBLES_F.includes(fmtBase(sets[i].f)));
  const from = pool.length ? pool : idx;
  return from.reduce((b, i) => (formatRank(sets[i].f) < formatRank(sets[b].f) ? i : b), from[0]);
}
/** Build del Pokémon del equipo: { n naturaleza, i objeto, a habilidad, m movimientos, e EVs | null } o null si no hay datos */
function buildOf(p, mode) {
  const d = p.det;
  if (!d || !DATA.moves) return null;
  const mb = p.mb || {}, b = mb.b || {};
  const si = mb.s != null && d.sets?.[mb.s] ? mb.s : pickSet(d, mode);
  const set = si >= 0 ? d.sets[si] : null;
  if (!set && !mb.b) return null;
  const ev = set ? KEYS.map(k => set.ev?.[k] || 0) : null;
  const base = { n: set?.na?.[0] || '', i: set?.i?.[0] || '', a: set?.a?.[0] || d.ab?.[0]?.id || '', m: set ? [...new Set(set.m.map(x => x[0]).filter(Boolean))].slice(0, 4) : [], e: ev && ev.some(Boolean) ? ev : null };
  return { n: b.n || base.n, i: b.i ?? base.i, a: b.a || base.a, m: b.m || base.m, e: b.e || base.e };
}
/** Estadísticas finales a nivel 100 (IVs 31) con EVs y naturaleza */
function statsOf(base, e, nat) {
  const nn = DATA.natures?.[nat];
  return KEYS.map((k, i) => {
    const core = 2 * base[i] + 31 + Math.floor((e[i] || 0) / 4);
    if (i === 0) return base[0] === 1 ? 1 : core + 110;
    return Math.floor((core + 5) * (nn?.[2] === k ? 1.1 : nn?.[3] === k ? 0.9 : 1));
  });
}
// habilidades que dan inmunidad (0) o reducen a la mitad el daño de un tipo
const ABIL_IMMUNE = { levitate: 'ground', eelevate: 'ground', eartheater: 'ground', flashfire: 'fire', wellbakedbody: 'fire', waterabsorb: 'water', stormdrain: 'water', dryskin: 'water', voltabsorb: 'electric', lightningrod: 'electric', motordrive: 'electric', sapsipper: 'grass' };
const ABIL_HALF = { thickfat: ['fire', 'ice'], heatproof: ['fire'], waterbubble: ['fire'], purifyingsalt: ['ghost'] };
// control de velocidad: poner Viento Afín / Espacio Raro, o bajar la Velocidad del rival
const TAILWIND = ['tailwind'], ROOM = ['trickroom'];
const SLOWER = ['icywind', 'electroweb', 'thunderwave', 'glare', 'scaryface', 'stickyweb', 'toxicthread', 'cottonspore', 'bulldoze', 'lowsweep'];
const WEATHER_SET = { drought: 'sun', orichalcumpulse: 'sun', desolateland: 'sun', megasol: 'sun', drizzle: 'rain', primordialsea: 'rain', sandstream: 'sand', sandspit: 'sand', snowwarning: 'snow' };
const WEATHER_MOVE = { sunnyday: 'sun', raindance: 'rain', sandstorm: 'sand', snowscape: 'snow', chillyreception: 'snow' };
const WEATHER_USE = { sun: ['chlorophyll', 'solarpower', 'protosynthesis', 'flowergift', 'orichalcumpulse'], rain: ['swiftswim', 'raindish'], sand: ['sandrush', 'sandforce', 'sandveil'], snow: ['slushrush', 'icebody', 'snowcloak'] };
const WEATHER_TYPE = { sun: 'fire', rain: 'water' };
const FAST_S = 290, SLOW_S = 200, BULK_T = 65000; // velocidad y resistencia finales (nivel 100)

export const scoreInfo = s => (s >= 85 ? { k: 'excellent', c: '#3FB6C9' } : s >= 70 ? { k: 'great', c: '#6CC070' } : s >= 55 ? { k: 'ok', c: '#E6C84F' }
  : s >= 40 ? { k: 'weak', c: '#F0974B' } : { k: 'poor', c: '#E5645A' });

/**
 * @param {Array} team Pokémon del índice (id, t, s…); con `det` (ficha) y `mb` ({s, b} del equipo) se usa también su build
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

  // ───── build de cada Pokémon (si la hay): movimientos, habilidad, objeto y estadísticas finales ─────
  const fx = team.map(p => {
    const bd = buildOf(p, mode);
    if (!bd) return null;
    const mv = bd.m.map(id => ({ id, d: DATA.moves[id] })).filter(x => x.d);
    const dmg = mv.filter(x => (x.d[3] === 'f' || x.d[3] === 'e') && (x.d[4] === 0 || x.d[4] >= 40));
    const st = bd.e ? statsOf(p.s, bd.e, bd.n) : null;
    return {
      bd, ids: new Set(bd.m), dmgTypes: [...new Set(dmg.map(x => x.d[2]))],
      phys: dmg.filter(x => x.d[3] === 'f').length, spec: dmg.filter(x => x.d[3] === 'e').length,
      spe: st ? st[5] * (bd.i === 'choicescarf' ? 1.5 : 1) : null,
      pb: st ? st[0] * st[2] : null, sb: st ? st[0] * st[4] * (bd.i === 'assaultvest' ? 1.5 : 1) : null,
    };
  });
  const nb = fx.filter(Boolean).length;
  const has = (i, list) => !!fx[i] && list.some(m => fx[i].ids.has(m));
  const who = list => team.filter((_, i) => has(i, list));

  // ───── defensa de tipos (con inmunidades por habilidad u objeto) ─────
  const mults = team.map((p, i) => {
    const o = {};
    for (const [k, list] of Object.entries(matchups(p.t))) list.forEach(a => { o[a] = Number(k); });
    const b = fx[i]?.bd;
    if (b) {
      const imm = ABIL_IMMUNE[b.a] || (b.i === 'airballoon' ? 'ground' : null);
      if (imm) o[imm] = 0;
      (ABIL_HALF[b.a] || []).forEach(a => { o[a] = (o[a] ?? 1) * 0.5; });
    }
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

  // ───── cobertura ofensiva: tipos de los movimientos que dañan; sin build, los tipos del Pokémon (STAB) ─────
  const atkTypes = new Set(team.flatMap((p, i) => (fx[i] ? fx[i].dmgTypes : p.t)));
  const covered = TYPES.filter(d => [...atkTypes].some(a => SE_VS[d].has(a)));
  const missing = TYPES.filter(d => !covered.includes(d));
  const covPts = Math.round(20 * clamp((covered.length - 6) / 10, 0, 1) * 10) / 10;
  if (missing.length >= 2) bad.push({ key: 'cover', sev: missing.length >= 4 ? 4 : 2, vars: { k: missing.length }, chips: types(missing) });
  if (covered.length >= 15) good.push({ key: 'wide', sev: 2, vars: { k: covered.length }, chips: [] });

  // ───── estilo de ataque: con build, por los movimientos que dañan; sin build, por las estadísticas base ─────
  let phys = 0, spec = 0, mixed = 0;
  team.forEach((p, i) => {
    const f = fx[i];
    const d = f && f.phys !== f.spec ? f.phys - f.spec : p.s[1] - p.s[3];
    const th = f && f.phys !== f.spec ? 0 : 15;
    if (d > th) phys++; else if (d < -th) spec++; else mixed++;
  });
  const lean = Math.max(phys, spec) / n + (mixed / n) / 2;
  const atkPts = Math.round(10 * clamp(1 - (lean - 0.6) / 0.4, 0, 1) * 10) / 10;
  if (n >= 3 && lean >= 0.75) bad.push({ key: phys > spec ? 'phys' : 'spec', sev: lean >= 0.95 ? 4 : 3, vars: { k: Math.max(phys, spec), n }, chips: [] });
  else if (n >= 3 && lean <= 0.67 && phys && spec) good.push({ key: 'balance', sev: 2, vars: {}, chips: [] });

  // ───── velocidad: estadística final si hay EVs; si no, la base ─────
  const isFast = (p, i) => (fx[i]?.spe != null ? fx[i].spe >= FAST_S : p.s[5] >= FAST);
  const isSlow = (p, i) => (fx[i]?.spe != null ? fx[i].spe <= SLOW_S : p.s[5] <= SLOW);
  const fast = team.filter(isFast);
  const slow = team.filter(isSlow);
  const avgSpe = team.reduce((a, p) => a + p.s[5], 0) / n;
  // estrategias de velocidad: se reconocen por los movimientos (Espacio Raro, Viento Afín)
  const setRoom = who(ROOM), setTail = who(TAILWIND), slower = who(SLOWER);
  const room = n >= 3 && setRoom.length > 0 && slow.length >= 2;
  const trick = n >= 3 && !room && !fast.length && slow.length / n >= 0.5; // sin movimientos conocidos: muchos lentos y ninguno rápido
  let spePts = room ? 9 : trick ? 7 : fast.length >= 2 ? 10 : fast.length === 1 ? 6 : avgSpe >= 85 ? 3 : 0;
  if (!room && !trick && slow.length / n >= 0.6) spePts = Math.max(0, spePts - 3);
  if (mode === 'doubles') { if (setTail.length) spePts = Math.max(spePts, 9); else if (slower.length) spePts = Math.max(spePts, 7); }
  if (room && setTail.length) spePts = 10;
  if (room && setTail.length) good.push({ key: 'tailroom', sev: 3, vars: {}, chips: poke([...new Set([...setRoom, ...setTail])]) });
  else if (room) good.push({ key: 'room', sev: 3, vars: { k: slow.length }, chips: poke(setRoom) });
  else if (trick) good.push({ key: 'trick', sev: 2, vars: { k: slow.length, n }, chips: poke(slow) });
  const ctrlOk = room || trick || (mode === 'doubles' && (setTail.length || slower.length));
  if (!room && (setTail.length || slower.length) && mode === 'doubles') good.push({ key: 'ctrl', sev: 2, vars: {}, chips: poke([...new Set([...setTail, ...slower])]) });
  if (!fast.length && !ctrlOk) bad.push({ key: 'nofast', sev: 4, vars: {}, chips: [] });
  if (!room && !trick && slow.length / n >= 0.6 && n >= 3) bad.push({ key: 'slow', sev: 3, vars: { k: slow.length, n }, chips: poke(slow) });
  if (fast.length >= 2) good.push({ key: 'speed', sev: 2, vars: { k: fast.length }, chips: poke(fast) });

  // ───── resistencia: con EVs, vida × defensa final; sin ellos, Defensa y Defensa Especial base ─────
  const goodDef = team.filter((p, i) => (fx[i]?.pb != null ? fx[i].pb >= BULK_T : p.s[2] >= BULKY));
  const goodSpd = team.filter((p, i) => (fx[i]?.sb != null ? fx[i].sb >= BULK_T : p.s[4] >= BULKY));
  const need = Math.max(1, Math.round(n / 3));
  const bulkPts = Math.round((10 * Math.min(1, goodDef.length / need) + 10 * Math.min(1, goodSpd.length / need)) * 10) / 10;
  if (n >= 3 && !goodSpd.length) bad.push({ key: 'nospd', sev: 4, vars: {}, chips: [] });
  if (n >= 3 && !goodDef.length) bad.push({ key: 'nodef', sev: 4, vars: {}, chips: [] });
  if (goodSpd.length >= 2) good.push({ key: 'spd', sev: 2, vars: {}, chips: poke(goodSpd) });
  if (goodDef.length >= 2) good.push({ key: 'def', sev: 2, vars: {}, chips: poke(goodDef) });

  // ───── clima: alguien lo pone y alguien se aprovecha (habilidad del clima o ataques del tipo que potencia) ─────
  if (nb) {
    for (const w of ['sun', 'rain', 'sand', 'snow']) {
      const setters = team.filter((_, i) => fx[i] && (WEATHER_SET[fx[i].bd.a] === w || [...fx[i].ids].some(m => WEATHER_MOVE[m] === w)));
      const users = team.filter((p, i) => !setters.includes(p) && fx[i] && (WEATHER_USE[w].includes(fx[i].bd.a) || (WEATHER_TYPE[w] && fx[i].dmgTypes.includes(WEATHER_TYPE[w]))));
      if (setters.length && users.length) { good.push({ key: 'weather', sev: 3, vars: { w: t(`an_w_${w}`), k: users.length }, chips: poke([...setters, ...users]) }); break; }
    }
  }
  // ───── apoyo en dobles: Sorpresa, redirección e Intimidación ─────
  if (mode === 'doubles' && nb) {
    const roles = [['fakeout', who(['fakeout'])], ['redirect', who(['followme', 'ragepowder'])], ['intimidate', team.filter((_, i) => fx[i]?.bd.a === 'intimidate')]].filter(([, l]) => l.length);
    if (roles.length >= 2) good.push({ key: 'support', sev: 2, vars: { roles: roles.map(([k]) => t(`an_r_${k}`)).join(', ') }, chips: poke([...new Set(roles.flatMap(([, l]) => l))]) });
  }

  // ───── potencia general ─────
  const avgBst = Math.round(team.reduce((a, p) => a + bst(p.s), 0) / n);
  if (avgBst >= 540) good.push({ key: 'power', sev: 1, vars: { avg: avgBst }, chips: [] });

  // ───── nivel competitivo: la tier de cada Pokémon en el formato elegido. Multiplica la puntuación de estructura ─────
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
    score, mode, builds: nb, names: names(team),
    parts: [
      { k: 'def', v: defPts, max: 40 }, { k: 'cov', v: covPts, max: 20 }, { k: 'atk', v: atkPts, max: 10 },
      { k: 'spe', v: spePts, max: 10 }, { k: 'bulk', v: bulkPts, max: 20 }, { k: 'pow', v: power * 100, max: 100 },
    ],
    bad: bad.slice(0, 6), good: good.slice(0, 5),
  };
}
