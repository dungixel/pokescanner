// Base común de los comparadores: carga la calculadora de daño oficial de Smogon (@smogon/calc, Gen 9), construye cada Pokémon con
// su build real (naturaleza, EVs, habilidad, objeto, movimientos) y da el daño exacto de cada movimiento con memoria (cache).
import { matchups, formatRank } from './util.js';
import { applyBuild } from './build.js';

let C = null, G = null;
export async function initCalc() {
  if (!C) { C = await import('../vendor/smogon-calc.js'); G = C.Generations.get(9); }
  return G;
}
export const toID = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const eff = (atk, defTypes) => {
  const m = matchups(defTypes);
  for (const k of Object.keys(m)) if (m[k].includes(atk)) return Number(k);
  return 1;
};

// ───────── tablas de efectos que la calculadora de daño no cubre ─────────
export const SETUP = {
  swordsdance: { atk: 2 }, nastyplot: { spa: 2 }, dragondance: { atk: 1, spe: 1 }, calmmind: { spa: 1, spd: 1 }, bulkup: { atk: 1, def: 1 },
  quiverdance: { spa: 1, spd: 1, spe: 1 }, shellsmash: { atk: 2, spa: 2, spe: 2, def: -1, spd: -1 }, irondefense: { def: 2 }, acidarmor: { def: 2 }, barrier: { def: 2 },
  agility: { spe: 2 }, rockpolish: { spe: 2 }, autotomize: { spe: 2 }, coil: { atk: 1, def: 1 }, tailglow: { spa: 3 }, victorydance: { atk: 1, def: 1, spe: 1 },
  shiftgear: { atk: 1, spe: 2 }, workup: { atk: 1, spa: 1 }, growth: { atk: 1, spa: 1 }, cosmicpower: { def: 1, spd: 1 }, amnesia: { spd: 2 },
  noretreat: { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 }, curse: { atk: 1, def: 1, spe: -1 }, honeclaws: { atk: 1 }, howl: { atk: 1 }, geomancy: { spa: 2, spd: 2, spe: 2 },
  tidyup: { atk: 1, spe: 1 }, bellydrum: { atk: 6, cost: 0.5 }, filletaway: { atk: 2, spa: 2, spe: 2, cost: 0.5 }, clangoroussoul: { atk: 1, def: 1, spa: 1, spd: 1, spe: 1, cost: 0.33 },
  chargebeam: null, meditate: { atk: 1 }, defensecurl: { def: 1 }, harden: { def: 1 }, withdraw: { def: 1 }, stockpile: { def: 1, spd: 1 },
};
for (const k of Object.keys(SETUP)) if (!SETUP[k]) delete SETUP[k];
export const RECOVER = { recover: 0.5, roost: 0.5, softboiled: 0.5, slackoff: 0.5, synthesis: 0.5, moonlight: 0.5, morningsun: 0.5, shoreup: 0.5, milkdrink: 0.5, healorder: 0.5, strengthsap: 0.4, wish: 0.45, lifedew: 0.25, junglehealing: 0.25, lunarblessing: 0.25, rest: 1 };
export const STATUS_MOVE = {
  willowisp: { s: 'brn', acc: 85 }, thunderwave: { s: 'par', acc: 90 }, toxic: { s: 'tox', acc: 90 }, glare: { s: 'par', acc: 100 }, spore: { s: 'slp', acc: 100 },
  sleeppowder: { s: 'slp', acc: 75 }, stunspore: { s: 'par', acc: 75 }, poisonpowder: { s: 'psn', acc: 75 }, hypnosis: { s: 'slp', acc: 60 }, sing: { s: 'slp', acc: 55 },
  lovelykiss: { s: 'slp', acc: 75 }, darkvoid: { s: 'slp', acc: 80 }, yawn: { s: 'slp', acc: 100 }, toxicthread: { s: 'psn', acc: 100 }, nuzzle: null,
};
for (const k of Object.keys(STATUS_MOVE)) if (!STATUS_MOVE[k]) delete STATUS_MOVE[k];
const POWDER = ['spore', 'sleeppowder', 'stunspore', 'poisonpowder'];
export const HAZARD = { stealthrock: 'sr', spikes: 'spikes', toxicspikes: 'tspikes', stickyweb: 'web', ceaselessedge: 'spikes', stoneaxe: 'sr' };
export const REMOVAL = ['rapidspin', 'defog', 'courtchange', 'mortalspin', 'tidyup'];
export const SCREEN = ['reflect', 'lightscreen', 'auroraveil'];
export const PIVOT = ['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'batonpass', 'chillyreaction', 'shedtail'];
export const PHAZE = ['roar', 'whirlwind', 'dragontail', 'circlethrow', 'haze', 'clearsmog'];
const NOUSE = new Set(['explosion', 'selfdestruct', 'mistyexplosion', 'finalgambit', 'memento', 'healingwish', 'lunardance', 'focuspunch', 'dreameater', 'belch', 'steelroller', 'lastresort', 'synchronoise', 'fling', 'naturalgift']);
const RECHARGE = new Set(['hyperbeam', 'gigaimpact', 'blastburn', 'frenzyplant', 'hydrocannon', 'roaroftime', 'prismaticlaser', 'rockwrecker', 'eternabeam', 'meteorassault']);
const CHARGE = new Set(['solarbeam', 'solarblade', 'skyattack', 'razorwind', 'skullbash', 'freezeshock', 'iceburn', 'meteorbeam', 'electroshot', 'geomancy']);
const FIRST_TURN = new Set(['fakeout', 'firstimpression']);
const HITS = { tripleaxel: 3, triplekick: 3, populationbomb: 6, scaleshot: 4, bulletseed: 3, iciclespear: 3, rockblast: 3, tailslap: 3, pinmissile: 3, furyattack: 3, armthrust: 3, watershuriken: 3, bonemerang: 2, doublekick: 2, surgingstrikes: 3, tripledive: 3, dragondarts: 2, twinbeam: 2, geargrind: 2, doublehit: 2, dualwingbeat: 2, dualchop: 2, doubleironbash: 2, twineedle: 2, suckerpunch: 1 };
const ACC_FREE = new Set(['tripleaxel', 'triplekick', 'populationbomb']);

const SPEED_ABILITY = { swiftswim: 'rain', chlorophyll: 'sun', sandrush: 'sand', slushrush: 'snow', surgesurfer: 'water' };
const WEATHER_SET = { drought: 'Sun', orichalcumpulse: 'Sun', drizzle: 'Rain', sandstream: 'Sand', snowwarning: 'Snow' };
const TERRAIN_SET = { electricsurge: 'Electric', hadronengine: 'Electric', grassysurge: 'Grassy', seedsower: 'Grassy', psychicsurge: 'Psychic', mistysurge: 'Misty' };
export const weatherOf = ab => WEATHER_SET[ab] || null;
export const terrainOf = ab => TERRAIN_SET[ab] || null;
const RUIN = { swordofruin: 'isSwordOfRuin', beadsofruin: 'isBeadsOfRuin', tabletsofruin: 'isTabletsOfRuin', vesselofruin: 'isVesselOfRuin' };

/** Elige la build de cada formato: en individual la del formato más fuerte; en dobles las de dobles/VGC si existen */
const TIER_FORMAT = { AG: 'anythinggoes', Uber: 'ubers', OU: 'ou', UUBL: 'ou', UU: 'uu', RUBL: 'uu', RU: 'ru', NUBL: 'ru', NU: 'nu', PUBL: 'nu', PU: 'pu', ZUBL: 'pu', ZU: 'zu', LC: 'lc', NFE: 'nfe' };
export function setIndexFor(p, mode) {
  const sets = p.sets || [];
  if (!sets.length) return -1;
  if (mode === 'doubles') {
    for (const f of ['vgc2025', 'doublesou']) { const i = sets.findIndex(s => s.f === f); if (i >= 0) return i; }
  }
  // la build del formato que corresponde a la tier del Pokémon (un UU se usa con la build de UU, no de Ubers)
  const want = formatRank(TIER_FORMAT[String(p.r).replace(/^\((.*)\)$/, '$1')] || 'ou');
  let best = -1, bd = 99;
  sets.forEach((s, i) => {
    if (s.f === 'monotype' || s.f === 'doublesou' || s.f === 'vgc2025') return;
    const d = Math.abs(formatRank(s.f) - want);
    if (d < bd || (d === bd && formatRank(s.f) < formatRank(sets[best].f))) { bd = d; best = i; }
  });
  return best >= 0 ? best : 0;
}

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
let UID = 0;

/** Build "estimada" para los Pokémon que no tienen build de Smogon: mejores ataques con STAB, cobertura y un movimiento de apoyo */
function estimateBuild(p, dict, learnable) {
  const [hp, atk, def, spa, spd, spe] = p.s;
  const physical = atk >= spa, mixed = Math.abs(atk - spa) < 15;
  const bulky = hp + def + spd > 1.75 * (Math.max(atk, spa) + spe);
  const ids = (learnable ? learnable(p) : []).filter(id => dict.moves[id]);
  const att = ids.map(id => ({ id, ...dict.moves[id] })).filter(m => m.c !== 's' && m.p >= 40 && !NOUSE.has(m.id) && !RECHARGE.has(m.id) && !CHARGE.has(m.id) && !['fakeout', 'firstimpression', 'lastresort', 'steelroller', 'ragefist', 'lastrespects'].includes(m.id));
  const score = m => m.p * Math.min(1, (m.a || 100) / 100) * (p.t.includes(m.t) ? 1.5 : 1) * (m.c === (physical ? 'f' : 'e') ? 1 : mixed ? 0.9 : 0.2);
  att.sort((a, b) => score(b) - score(a));
  const chosen = [];
  for (const t of p.t) { const m = att.find(x => x.t === t && !chosen.includes(x)); if (m) chosen.push(m); }
  for (const m of att) { if (chosen.length >= (bulky ? 2 : 3)) break; if (!chosen.includes(m) && !chosen.some(c => c.t === m.t)) chosen.push(m); }
  for (const m of att) { if (chosen.length >= (bulky ? 2 : 3)) break; if (!chosen.includes(m)) chosen.push(m); }
  const out = chosen.map(m => m.id);
  const pick = list => list.find(id => ids.includes(id));
  const util = [];
  if (bulky) {
    const rec = pick(Object.keys(RECOVER)); if (rec) util.push(rec);
    const haz = pick(['stealthrock', 'spikes']); if (haz) util.push(haz);
    const st = pick(['toxic', 'willowisp', 'thunderwave']); if (st) util.push(st);
  } else {
    const su = pick(['swordsdance', 'nastyplot', 'dragondance', 'calmmind', 'quiverdance', 'bulkup']); if (su) util.push(su);
    const rec = pick(Object.keys(RECOVER)); if (rec) util.push(rec);
  }
  for (const id of util) if (out.length < 4) out.push(id);
  for (const m of att) if (out.length < 4 && !out.includes(m.id)) out.push(m.id);
  const nat = bulky ? (physical ? 'impish' : 'calm') : physical ? (spe >= 90 ? 'jolly' : 'adamant') : (spe >= 90 ? 'timid' : 'modest');
  const evs = bulky ? { hp: 252, def: 128, spd: 128 } : physical ? { hp: 4, atk: 252, spe: 252 } : { hp: 4, spa: 252, spe: 252 };
  const item = bulky ? 'leftovers' : 'lifeorb';
  return { moves: out, nat, evs, item: dict.items[item] ? item : '' };
}

/**
 * Convierte un Pokémon (ficha completa) en una unidad de combate.
 * learnable(p) debe devolver los ids de los movimientos que puede aprender (para estimar la build si no hay una de Smogon).
 */
export function makeUnit(p, member, dict, mode, { learnable, pname } = {}) {
  const idx = member?.s != null && p.sets?.[member.s] ? member.s : setIndexFor(p, mode);
  const set = idx >= 0 ? p.sets[idx] : null;
  const spec = G.species.get(toID(p.id)) || G.species.get(toID(p.en));
  const physical = p.s[1] >= p.s[3];
  const est = set ? null : estimateBuild(p, dict, learnable);
  let abId = set?.a?.[0] || p.ab?.[0]?.id || '';
  let item = set ? (set.i?.[0] || '') : est.item;
  let nat = set ? (set.na?.[0] || (physical ? 'adamant' : 'modest')) : est.nat;
  let evs = set?.ev || est?.evs || (physical ? { hp: 4, atk: 252, spe: 252 } : { hp: 4, spa: 252, spe: 252 });
  let ivs = {};
  // sin Velocidad invertida en Trick Room: naturaleza que la baja y 0 EVs → IV 0
  if (!evs.spe && ['brave', 'quiet', 'relaxed', 'sassy'].includes(nat)) ivs.spe = 0;
  let moveIds = set ? [...new Set(set.m.map(a => a[0]).filter(Boolean))] : est.moves;
  ({ nat, item, abId, evs, ivs, moveIds } = applyBuild(member, { nat, item, abId, evs, ivs, moveIds }));
  const estimated = !set && !member?.b;
  const moves = moveIds.map(id => {
    const dm = dict.moves[id];
    const cm = dm && G.moves.get(toID(dm.e));
    if (!dm || !cm) return null;
    return {
      id, name: cm.name, t: dm.t, c: dm.c, pr: dm.pr || 0, bp: dm.p || 0, acc: dm.a || 100, tg: cm.target || '', recoil: cm.recoil || null, drain: cm.drain || null,
      contact: !!cm.flags?.contact, multihit: cm.multihit || null, sound: !!cm.flags?.sound, es: dm.n,
    };
  }).filter(Boolean);
  const gAb = abId && dict.abilities?.[abId] ? G.abilities.get(toID(dict.abilities[abId].e)) : null;
  const gIt = item && dict.items?.[item] ? G.items.get(toID(dict.items[item].e)) : null;
  const opts = { level: 100, ability: gAb?.name, item: gIt?.name, nature: cap(nat), evs, ivs };
  if (abId === 'protosynthesis' || abId === 'quarkdrive') opts.boostedStat = 'auto'; // se activa con sol / campo eléctrico / Energía Potenciadora
  const probe = new C.Pokemon(G, spec.name, opts);
  const u = {
    uid: ++UID, id: p.id, p, mem: member || null, name: pname ? pname(p) : p.es, spec: spec.name, types: p.t.slice(), set: idx, setName: set?.n || '', fmt: set?.f || '', estimated,
    ab: abId, item, nat, evs, opts, moves, tera: set?.te?.[0] || null,
    maxHP: probe.maxHP(), raw: probe.rawStats, base: p.s, nfe: p.r === 'NFE' || p.r === 'LC',
  };
  u.has = ids => u.moves.some(m => ids.includes(m.id));
  u.hasMove = id => u.moves.some(m => m.id === id);
  u.setup = u.moves.find(m => SETUP[m.id]) || null;
  u.recover = u.moves.find(m => RECOVER[m.id]) || null;
  u.statusMoves = u.moves.filter(m => STATUS_MOVE[m.id]);
  u.hazards = u.moves.filter(m => HAZARD[m.id]).map(m => HAZARD[m.id]);
  u.removal = u.has(REMOVAL);
  u.screens = u.moves.find(m => SCREEN.includes(m.id)) || null;
  u.pivot = u.has(PIVOT);
  u.phaze = u.has(PHAZE);
  u.boots = item === 'heavydutyboots';
  u.attacks = u.moves.filter(m => m.c !== 's' && !NOUSE.has(m.id));
  return u;
}

// ───────── estado y campo ─────────
export const newState = u => ({ u, hp: 1, boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, status: null, slp: 0, tox: 0, sash: u.item === 'focussash', berry: u.item === 'sitrusberry', first: true, prot: 0, lastMove: null, screens: 0 });
const stageMul = s => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));

/** Velocidad final con objeto, habilidad, clima, parálisis y Tailwind */
export function speedOf(st, f = {}, side = {}) {
  const u = st.u;
  let s = u.raw.spe * stageMul(st.boosts.spe);
  if (u.item === 'choicescarf') s *= 1.5;
  if (u.item === 'ironball') s *= 0.5;
  const sa = SPEED_ABILITY[u.ab];
  if (sa && ((sa === 'water' && f.terrain === 'Electric') || (sa !== 'water' && f.weather === ({ rain: 'Rain', sun: 'Sun', sand: 'Sand', snow: 'Snow' })[sa]))) s *= 2;
  if (u.ab === 'surgesurfer' && f.terrain === 'Electric') s *= 2;
  if (u.ab === 'quickfeet' && st.status) s *= 1.5;
  else if (st.status === 'par') s *= 0.5;
  if (side.tailwind) s *= 2;
  return Math.floor(s);
}

const SPREAD_TARGETS = new Set(['allAdjacent', 'allAdjacentFoes']);
export const isSpread = m => SPREAD_TARGETS.has(m.tg);

const memo = new Map();
export const clearMemo = () => memo.clear();
const hpDependent = new Set(['eruption', 'waterspout', 'dragonenergy', 'flail', 'reversal', 'crushgrip', 'wringout', 'hardpress']);

function mkPoke(u, st, extra = {}) {
  const o = { ...u.opts, boosts: { ...st.boosts } };
  if (st.status) o.status = st.status === 'psn' ? 'psn' : st.status === 'tox' ? 'tox' : st.status;
  const f = st.hp;
  o.curHP = Math.max(1, Math.round(u.maxHP * f));
  Object.assign(o, extra);
  return new C.Pokemon(G, u.spec, o);
}

/**
 * Daño de un movimiento: devuelve { min, avg, max, exp } como fracción de los PS máximos del defensor.
 * exp = daño esperado teniendo en cuenta precisión, recarga y turnos de carga.
 * ctx = { field:{weather,terrain,doubles,ruin:[...]}, aSide:{helpingHand,...}, dSide:{reflect,lightScreen,auroraVeil,friendGuard}, spread: bool (ataca a 2 objetivos) }
 */
export function damage(att, aSt, def, dSt, move, ctx = {}) {
  if (move.c === 's') return { min: 0, avg: 0, max: 0, exp: 0 };
  const f = ctx.field || {}, as = ctx.aSide || {}, ds = ctx.dSide || {};
  const full = dSt.hp >= 0.999;
  const hpKey = hpDependent.has(move.id) ? Math.ceil(aSt.hp * 10) : (aSt.hp <= 1 / 3 ? 1 : 0);
  const key = [att.uid, def.uid, move.id, aSt.boosts.atk, aSt.boosts.spa, aSt.boosts.spe, aSt.status || '', dSt.boosts.def, dSt.boosts.spd, dSt.boosts.spe, dSt.status || '', full ? 1 : 0, hpKey,
    f.weather || '', f.terrain || '', f.doubles ? 'D' : 'S', f.ruin || '', ctx.spread ? 1 : 0, as.helpingHand ? 1 : 0, as.battery ? 1 : 0, as.powerSpot ? 1 : 0, ds.reflect ? 1 : 0, ds.lightScreen ? 1 : 0, ds.auroraVeil ? 1 : 0, ds.friendGuard ? 1 : 0,
    ctx.crit ? 1 : 0].join('|');
  let r = memo.get(key);
  if (!r) {
    r = { min: 0, avg: 0, max: 0 };
    try {
      const A = mkPoke(att, aSt);
      const D = mkPoke(def, dSt);
      let hits = HITS[move.id] ?? (move.multihit ? (Array.isArray(move.multihit) ? (att.ab === 'skilllink' ? move.multihit[1] : att.item === 'loadeddice' ? 4 : 3) : move.multihit) : undefined);
      const mv = new C.Move(G, move.name, { hits, isCrit: !!ctx.crit });
      const field = new C.Field({
        gameType: f.doubles ? 'Doubles' : 'Singles', weather: f.weather || undefined, terrain: f.terrain || undefined,
        ...(f.ruin ? Object.fromEntries(f.ruin.split(',').filter(Boolean).map(k => [k, true])) : {}),
        attackerSide: { isHelpingHand: !!as.helpingHand, isBattery: !!as.battery, isPowerSpot: !!as.powerSpot },
        defenderSide: { isReflect: !!ds.reflect, isLightScreen: !!ds.lightScreen, isAuroraVeil: !!ds.auroraVeil, isFriendGuard: !!ds.friendGuard },
      });
      const res = C.calculate(G, A, D, mv, field);
      const [lo, hi] = res.range();
      const mhp = D.maxHP();
      r = { min: lo / mhp, max: hi / mhp, avg: (lo + hi) / 2 / mhp };
    } catch { r = { min: 0, avg: 0, max: 0 }; }
    memo.set(key, r);
  }
  let k = 1;
  if (move.acc < 100 && !ACC_FREE.has(move.id)) k *= move.acc / 100;
  if (RECHARGE.has(move.id)) k *= 0.5;
  if (CHARGE.has(move.id) && !(f.weather === 'Sun' && (move.id === 'solarbeam' || move.id === 'solarblade')) && att.item !== 'powerherb') k *= 0.5;
  if (move.id === 'suckerpunch' || move.id === 'thunderclap') k *= 0.7;
  return { ...r, exp: r.avg * k, k };
}
export const firstTurnOnly = id => FIRST_TURN.has(id);

// ───────── inmunidades a estados ─────────
export function canBeStatus(def, dSt, mv, s, f = {}) {
  if (dSt.status) return false;
  const t = def.types, ab = def.ab;
  if (['goodasgold', 'magicbounce', 'comatose', 'purifyingsalt'].includes(ab)) return false;
  if (POWDER.includes(mv.id) && (t.includes('grass') || ab === 'overcoat' || def.item === 'safetygoggles')) return false;
  if (f.terrain === 'Misty' || (f.terrain === 'Electric' && s === 'slp')) return false;
  if (s === 'brn') return !(t.includes('fire') || ['waterveil', 'waterbubble', 'thermalaction'].includes(ab));
  if (s === 'par') return !(t.includes('electric') || ab === 'limber' || (mv.id === 'thunderwave' && t.includes('ground')));
  if (s === 'psn' || s === 'tox') return !(t.includes('poison') || t.includes('steel') || ['immunity', 'pastelveil'].includes(ab));
  if (s === 'slp') return !['insomnia', 'vitalspirit', 'sweetveil'].includes(ab);
  return true;
}

// ───────── resolución de un juego de suma cero (elección simultánea de líder) ─────────
/** Valor y estrategias óptimas de un juego de suma cero con matriz M (filas = A, columnas = B) por juego ficticio */
export function solveGame(M, iters = 600) {
  const n = M.length, m = M[0].length;
  const ra = new Array(m).fill(0), cb = new Array(n).fill(0);
  const fa = new Array(n).fill(0), fb = new Array(m).fill(0);
  let i = 0, j = 0;
  for (let t = 0; t < iters; t++) {
    fa[i]++; fb[j]++;
    for (let c = 0; c < m; c++) ra[c] += M[i][c];
    for (let r = 0; r < n; r++) cb[r] += M[r][j];
    i = cb.indexOf(Math.max(...cb));
    j = ra.indexOf(Math.min(...ra));
  }
  const pa = fa.map(x => x / iters), pb = fb.map(x => x / iters);
  let v = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < m; c++) v += pa[r] * pb[c] * M[r][c];
  return { value: v, pa, pb };
}
