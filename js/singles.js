// Comparador INDIVIDUAL: simula combates 1 contra 1 turno a turno (daño real de la calculadora de Smogon, velocidad, prioridad,
// recuperación, mejoras, estados, objetos, clima, trampas) y, encima, el combate completo de 6 contra 6 con cambios.
// El porcentaje final sale de miles de combates simulados con tiradas de daño, precisión y críticos aleatorias.
import { damage, newState, speedOf, canBeStatus, SETUP, RECOVER, STATUS_MOVE, HAZARD, firstTurnOnly, weatherOf, terrainOf, eff, solveGame, SCREEN } from './calcx.js';

export const tick = () => new Promise(r => setTimeout(r, 0));
const INT_IMMUNE = new Set(['clearbody', 'whitesmoke', 'hypercutter', 'fullmetalbody', 'innerfocus', 'oblivious', 'owntempo', 'scrappy', 'mirrorarmor', 'guarddog']);
const clone = s => ({ ...s, boosts: { ...s.boosts } });
const SAND_IMMUNE = ['rock', 'ground', 'steel'];
const stageMul = s => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
const grounded = u => !u.types.includes('flying') && u.ab !== 'levitate' && u.item !== 'airballoon';

/** Efectos al entrar en combate: clima, campo e Intimidación */
export function onEntry(me, foe, f) {
  const u = me.u;
  const w = weatherOf(u.ab); if (w) { f.weather = w; f.wT = 5; }
  const tr = terrainOf(u.ab); if (tr) { f.terrain = tr; f.tT = 5; }
  if (u.ab === 'intimidate' && foe.u.item !== 'clearamulet') {
    const ab = foe.u.ab;
    if (ab === 'guarddog') foe.boosts.atk = Math.min(6, foe.boosts.atk + 1);
    else if (!INT_IMMUNE.has(ab)) {
      const d = ab === 'contrary' ? 1 : -1;
      foe.boosts.atk = Math.max(-6, Math.min(6, foe.boosts.atk + d));
      if (ab === 'defiant') foe.boosts.atk = Math.min(6, foe.boosts.atk + 2);
      if (ab === 'competitive') foe.boosts.spa = Math.min(6, foe.boosts.spa + 2);
    }
  }
}

function hazardChip(hz, u) {
  // hz = { sr, spikes, web, tspikes } con intensidad 0..1 ya escalada por la presencia de eliminadores
  if (u.boots || u.ab === 'magicguard') return { chip: 0, web: false, psn: false };
  let chip = 0;
  if (hz.sr) chip += hz.sr * 0.125 * eff('rock', u.types);
  const g = grounded(u);
  if (hz.spikes && g) chip += hz.spikes * 0.125;
  return { chip, web: !!(hz.web && g), psn: !!(hz.tspikes && g && !u.types.includes('poison') && !u.types.includes('steel') && hz.tspikes >= 0.5) };
}

const sKey = s => `${Math.round(s.hp * 40)},${s.boosts.atk},${s.boosts.def},${s.boosts.spa},${s.boosts.spd},${s.boosts.spe},${s.status || ''},${s.sash ? 1 : 0},${s.berry ? 1 : 0},${s.screens}`;
const fKey = f => `${f.weather || ''}${f.wT || 0}${f.terrain || ''}${f.tT || 0}`;
const duelMemo = new Map();
export const clearDuelMemo = () => duelMemo.clear();

/** Amenaza máxima que supone `foe` para `me` en este turno (fracción de los PS máximos de `me`) */
function threat(foe, me, f, side) {
  let b = 0, bm = null;
  for (const m of foe.u.attacks) {
    if (firstTurnOnly(m.id) && !foe.first) continue;
    const d = damage(foe.u, foe, me.u, me, m, { field: f, dSide: side }).exp;
    if (d > b) { b = d; bm = m; }
  }
  return { d: b, m: bm };
}

function sideOf(st) { return { reflect: st.screens && st.scr === 'reflect', lightScreen: st.screens && st.scr === 'lightscreen', auroraVeil: st.screens && st.scr === 'auroraveil' }; }

/** Decide qué hace `me` este turno (heurística de jugador competente) */
function decide(me, foe, f, rng) {
  const U = me.u, fs = sideOf(foe);
  let best = { d: 0, m: null };
  for (const m of U.attacks) {
    if (firstTurnOnly(m.id) && !me.first) continue;
    const d = damage(U, me, foe.u, foe, m, { field: f, dSide: fs }).exp;
    if (d > best.d + 1e-9 || (Math.abs(d - best.d) <= 1e-9 && best.m && m.pr > best.m.pr)) best = { d, m };
  }
  const th = threat(foe, me, f, sideOf(me));
  const foeCanBeKOd = best.d >= foe.hp - 1e-6 && !(foe.sash && foe.hp >= 0.999);
  const speedMe = speedOf(me, f), speedFoe = speedOf(foe, f);
  const iFirst = speedMe > speedFoe || (speedMe === speedFoe && rng ? rng() < 0.5 : false);
  const turnsNow = best.d > 0 ? Math.ceil(foe.hp / best.d - 1e-9) : 99;
  const attack = best.m ? { type: 'atk', m: best.m, d: best.d } : null;
  if (foeCanBeKOd && (iFirst || th.d < me.hp)) return attack;

  // recuperación
  if (U.recover) {
    const heal = U.recover.id === 'rest' ? 1 : RECOVER[U.recover.id];
    const need = U.recover.id === 'rest' ? me.hp <= 0.4 && th.d < 0.35 : me.hp <= 1 - heal + 0.05 && me.hp <= 0.62;
    if (need && (iFirst || th.d < me.hp) && th.d < heal * 0.95 - 0.02) return { type: 'recover', m: U.recover };
  }
  // mejoras de estadísticas
  if (U.setup && (me.hp - th.d > 0.06) && (th.d < me.hp * 0.75 || iFirst)) {
    const S = SETUP[U.setup.id];
    const cat = best.m ? best.m.c : 'f', keyOff = cat === 'f' ? 'atk' : 'spa';
    const mOff = S[keyOff] ? stageMul(Math.min(6, me.boosts[keyOff] + S[keyOff])) / stageMul(me.boosts[keyOff]) : 1;
    const foeCat = th.m ? th.m.c : 'f', keyDef = foeCat === 'f' ? 'def' : 'spd';
    const mDef = S[keyDef] ? stageMul(Math.min(6, me.boosts[keyDef] + S[keyDef])) / stageMul(me.boosts[keyDef]) : 1;
    const flip = S.spe && me.boosts.spe < 2 && speedMe <= speedFoe && speedMe * stageMul(me.boosts.spe + S.spe) / stageMul(me.boosts.spe) > speedFoe;
    const turnsBoosted = best.d > 0 ? Math.ceil(foe.hp / (best.d * mOff) - 1e-9) : 99;
    const capped = (S[keyOff] && me.boosts[keyOff] >= 2 && !flip) && !(mDef >= 1.4);
    const ok = !capped && ((mOff >= 1.4 && 1 + turnsBoosted <= turnsNow && me.boosts[keyOff] < 3) || (mDef >= 1.4 && th.d >= 0.15 && turnsNow >= 3 && me.boosts[keyDef] < 2) || flip);
    if (ok && (!S.cost || me.hp > S.cost + th.d + 0.05)) return { type: 'setup', m: U.setup };
  }
  // estados
  if (U.statusMoves.length && !foeCanBeKOd && me.hp > th.d && turnsNow >= 2 && !foe.status) {
    for (const m of U.statusMoves) {
      const sm = STATUS_MOVE[m.id];
      if (sm.acc < 75 || !canBeStatus(foe.u, foe, m, sm.s, f)) continue;
      const foePhys = th.m ? th.m.c === 'f' : true;
      const good = sm.s === 'brn' ? foePhys && foe.u.ab !== 'guts' && foe.u.ab !== 'magicguard' : sm.s === 'par' ? speedFoe >= speedMe * 0.9 || turnsNow >= 3 : sm.s === 'slp' ? true : turnsNow >= 3 && !foe.u.recover;
      if (good) return { type: 'status', m, s: sm.s, acc: sm.acc };
    }
  }
  // pantallas
  if (U.screens && !me.screens && th.d >= 0.22 && me.hp > th.d * 1.3) {
    const id = U.screens.id;
    if (id === 'auroraveil' ? f.weather === 'Snow' : true) return { type: 'screen', m: U.screens };
  }
  return attack || { type: 'pass' };
}

function actPrio(me, a, f) {
  if (!a.m) return 0;
  let p = a.m.pr || 0;
  if (a.type !== 'atk' && me.u.ab === 'prankster') p += 1;
  if (a.type === 'atk' && me.u.ab === 'galewings' && me.hp >= 0.999 && a.m.t === 'flying') p += 1;
  if (a.type === 'atk' && me.u.ab === 'triage' && a.m.drain) p += 3;
  return p;
}

/** Simula un duelo 1 contra 1 hasta que alguien cae. Devuelve { win:'A'|'B'|null, a:estado, b:estado, turns } */
function simulate(A, sA, B, sB, o) {
  const rng = o.rng;
  const f = { weather: o.field?.weather || null, wT: o.field?.wT || 0, terrain: o.field?.terrain || null, tT: o.field?.tT || 0, doubles: false };
  const a = clone(sA), b = clone(sB);
  if (o.enterA && o.enterB) {
    // el más lento entra "después": su clima prevalece
    const sa = speedOf(a, f), sb = speedOf(b, f);
    const aFirstIn = sa > sb || (sa === sb && A.uid < B.uid);
    if (aFirstIn) { onEntry(a, b, f); onEntry(b, a, f); } else { onEntry(b, a, f); onEntry(a, b, f); }
  } else if (o.enterA) onEntry(a, b, f);
  else if (o.enterB) onEntry(b, a, f);
  let turns = 0, tie = false;
  while (a.hp > 1e-6 && b.hp > 1e-6 && turns < 40) {
    turns++;
    const actA = a.status === 'slp' && a.slp > 0 ? { type: 'pass', asleep: true } : decide(a, b, f, rng);
    const actB = b.status === 'slp' && b.slp > 0 ? { type: 'pass', asleep: true } : decide(b, a, f, rng);
    const pa = actPrio(a, actA, f), pb = actPrio(b, actB, f);
    let order;
    const spa = speedOf(a, f), spb = speedOf(b, f);
    if (pa !== pb) order = pa > pb ? 'AB' : 'BA';
    else if (spa !== spb) order = spa > spb ? 'AB' : 'BA';
    else { tie = true; order = (rng ? rng() < 0.5 : o.tie === 'A') ? 'AB' : 'BA'; }
    const run = (me, foe, act, U) => {
      if (me.hp <= 1e-6 || foe.hp <= 1e-6 && act.type !== 'recover') return;
      if (me.status === 'slp') { me.slp--; if (me.slp <= 0) me.status = null; if (me.slp >= 0 && me.status === 'slp') return; }
      let fail = 0;
      if (me.status === 'par') { if (rng) { if (rng() < 0.25) return; } else fail = 0.25; }
      me.prot = 0;
      if (act.type === 'atk') {
        const m = act.m;
        let dmg;
        if (rng) {
          if (m.acc < 100 && rng() * 100 >= m.acc && !['tripleaxel', 'triplekick', 'populationbomb'].includes(m.id)) { me.first = false; return; }
          const r = damage(me.u, me, foe.u, foe, m, { field: f, dSide: sideOf(foe) });
          const k = r.exp > 0 && r.avg > 0 ? r.exp / r.avg / (m.acc < 100 && !['tripleaxel', 'triplekick', 'populationbomb'].includes(m.id) ? m.acc / 100 : 1) : 1;
          dmg = (r.min + rng() * (r.max - r.min)) * k;
          if (r.max > 0 && rng() < 1 / 24) dmg *= 1.5;
        } else dmg = act.d * (1 - fail);
        if (fail && !rng) dmg *= 1; // ya incluido
        if (dmg > 0) {
          let real = Math.min(dmg, foe.hp);
          if ((foe.sash && foe.hp >= 0.999) || (foe.u.ab === 'sturdy' && foe.hp >= 0.999)) { if (dmg >= foe.hp) { real = foe.hp - 0.01; if (foe.sash) foe.sash = false; } }
          foe.hp -= real;
          const abs = real * foe.u.maxHP;
          if (m.recoil) me.hp -= abs * m.recoil[0] / m.recoil[1] / U.maxHP;
          if (m.drain) me.hp = Math.min(1, me.hp + abs * (m.drain[0] / m.drain[1]) * (U.item === 'bigroot' ? 1.3 : 1) / U.maxHP);
          if (U.item === 'lifeorb' && U.ab !== 'magicguard' && U.ab !== 'sheerforce') me.hp -= 0.1;
          if (m.contact && U.ab !== 'longreach' && U.item !== 'protectivepads') {
            if (foe.u.item === 'rockyhelmet') me.hp -= 1 / 6;
            if (foe.u.ab === 'roughskin' || foe.u.ab === 'ironbarbs') me.hp -= 1 / 8;
            if (foe.u.ab === 'static' && !me.status && rng && rng() < 0.3 && !U.types.includes('electric')) me.status = 'par';
          }
          if (m.pr === 0 || true) {
            // Cinturón de enfoque / baya Aníbal ya tratadas; Pulso Dragón etc. no tienen efectos extra relevantes
          }
        }
      } else if (act.type === 'recover') {
        const h = RECOVER[act.m.id];
        if (act.m.id === 'rest') { me.hp = 1; me.status = 'slp'; me.slp = 2; }
        else me.hp = Math.min(1, me.hp + h);
      } else if (act.type === 'setup') {
        const S = SETUP[act.m.id];
        for (const k of ['atk', 'def', 'spa', 'spd', 'spe']) if (S[k]) me.boosts[k] = Math.max(-6, Math.min(6, me.boosts[k] + (U.ab === 'contrary' ? -S[k] : S[k])));
        if (S.cost) me.hp -= S.cost;
      } else if (act.type === 'status') {
        const ok = rng ? rng() * 100 < act.acc : true;
        if (ok && canBeStatus(foe.u, foe, act.m, act.s, f)) {
          foe.status = act.s;
          if (act.s === 'slp') foe.slp = rng ? 1 + Math.floor(rng() * 3) + 1 : 3;
          if (act.s === 'tox') foe.tox = 0;
        }
      } else if (act.type === 'screen') {
        me.screens = 5; me.scr = act.m.id;
      }
      me.first = false;
    };
    if (order === 'AB') { run(a, b, actA, A); run(b, a, actB, B); } else { run(b, a, actB, B); run(a, b, actA, A); }
    // fin de turno
    for (const [s, U] of [[a, A], [b, B]]) {
      if (s.hp <= 1e-6) continue;
      if (f.weather === 'Sand' && !U.types.some(t => SAND_IMMUNE.includes(t)) && !['magicguard', 'overcoat', 'sandveil', 'sandrush', 'sandforce'].includes(U.ab) && U.item !== 'safetygoggles') s.hp -= 1 / 16;
      if (U.item === 'leftovers') s.hp = Math.min(1, s.hp + 1 / 16);
      if (U.item === 'blacksludge') s.hp = U.types.includes('poison') ? Math.min(1, s.hp + 1 / 16) : s.hp - 1 / 8;
      if (f.terrain === 'Grassy' && grounded(U)) s.hp = Math.min(1, s.hp + 1 / 16);
      if (s.status === 'brn' && U.ab !== 'magicguard') s.hp -= (U.ab === 'heatproof' ? 1 / 32 : 1 / 16);
      if (s.status === 'psn' && U.ab !== 'magicguard') s.hp = U.ab === 'poisonheal' ? Math.min(1, s.hp + 1 / 8) : s.hp - 1 / 8;
      if (s.status === 'tox' && U.ab !== 'magicguard') { s.tox++; s.hp = U.ab === 'poisonheal' ? Math.min(1, s.hp + 1 / 8) : s.hp - Math.min(15, s.tox) / 16; }
      if (s.berry && s.hp > 0 && s.hp <= 0.5) { s.hp = Math.min(1, s.hp + 0.25); s.berry = false; }
      if (s.screens) { s.screens--; }
      s.hp = Math.min(1, s.hp);
    }
    if (f.wT) { f.wT--; if (!f.wT) f.weather = null; }
    if (f.tT) { f.tT--; if (!f.tT) f.terrain = null; }
  }
  const win = a.hp > 1e-6 && b.hp <= 1e-6 ? 'A' : b.hp > 1e-6 && a.hp <= 1e-6 ? 'B' : a.hp === b.hp ? (rng ? (rng() < 0.5 ? 'A' : 'B') : o.tie === 'B' ? 'B' : 'A') : (a.hp > b.hp ? 'A' : 'B');
  return { win, a, b, turns, tie, field: { weather: f.weather, wT: f.wT, terrain: f.terrain, tT: f.tT } };
}

/** Duelo con memoria (modo esperado, empates de velocidad según o.tie) o aleatorio (rng) */
export function duel(A, sA, B, sB, o = {}) {
  if (o.rng) return finish(simulate(A, sA, B, sB, o));
  const tie = o.tie || 'A';
  const key = `${A.uid}|${B.uid}|${sKey(sA)}|${sKey(sB)}|${o.enterA ? 1 : 0}${o.enterB ? 1 : 0}|${fKey(o.field || {})}|${tie}`;
  let r = duelMemo.get(key);
  if (!r) { r = finish(simulate(A, sA, B, sB, { ...o, tie })); duelMemo.set(key, r); }
  return r;
}
function finish(r) {
  const stalled = r.turns >= 40 && r.a.hp > 1e-6 && r.b.hp > 1e-6;
  const hpW = r.win === 'A' ? r.a.hp : r.b.hp;
  r.margin = (r.win === 'A' ? 1 : -1) * (stalled ? Math.min(0.3, Math.abs(r.a.hp - r.b.hp) * 0.5) : Math.max(hpW, 0.02));
  return r;
}
/** Margen medio de un 1v1 sin favorecer a nadie en los empates de velocidad (para enseñar en pantalla) */
export function duelSym(A, sA, B, sB, o = {}) {
  const r1 = duel(A, sA, B, sB, { ...o, tie: 'A' }), r2 = duel(A, sA, B, sB, { ...o, tie: 'B' });
  return { margin: (r1.margin + r2.margin) / 2, r: Math.abs(r1.margin) >= Math.abs(r2.margin) ? r1 : r2, win: (r1.margin + r2.margin) >= 0 ? 'A' : 'B', turns: Math.max(r1.turns, r2.turns), tied: r1.win !== r2.win };
}

// ───────── equipo contra equipo ─────────
/** Intensidad de las trampas que `foes` ponen sobre el equipo `team` */
function hazardsFor(foes, team) {
  const has = k => foes.some(u => u.hazards.includes(k));
  const rem = team.some(u => u.removal) ? 0.6 : 1;
  return { sr: has('sr') ? rem : 0, spikes: has('spikes') ? rem : 0, web: has('web') ? rem : 0, tspikes: has('tspikes') ? rem : 0 };
}

/** Un combate completo 6v6. Devuelve { v, aliveA, aliveB, log } con v = (PS que le quedan a A - PS de B) / nº de Pokémon */
function playout(TA, TB, la, lb, ctx, rng, tie = 'A') {
  const sa = TA.map(newState), sb = TB.map(newState);
  const hzA = ctx.hzA, hzB = ctx.hzB;
  let i = la, j = lb, field = { weather: null, wT: 0, terrain: null, tT: 0 };
  let enterA = true, enterB = true;
  const alive = s => s.filter(x => x.hp > 1e-6).length;
  const log = [];
  let guard = 0;
  while (guard++ < 24) {
    const r = duel(TA[i], sa[i], TB[j], sb[j], { enterA, enterB, field, rng, tie });
    sa[i] = clone(r.a); sb[j] = clone(r.b); field = r.field || field;
    log.push({ a: i, b: j, win: r.win, hpA: r.a.hp, hpB: r.b.hp });
    const loseA = r.win === 'B';
    const L = loseA ? sa : sb, Lt = loseA ? TA : TB, W = loseA ? sb : sa, Wt = loseA ? TB : TA, wi = loseA ? j : i;
    const li = loseA ? i : j;
    L[li].hp = 0;
    if (!alive(L)) break;
    // el que perdió saca al mejor contra el ganador (con las trampas incluidas)
    let bestK = -1, bestV = -2;
    for (let k = 0; k < L.length; k++) {
      if (L[k].hp <= 1e-6) continue;
      const cand = clone(L[k]);
      const hz = loseA ? hzA : hzB;
      const c = hazardChip(hz, Lt[k]);
      cand.hp -= c.chip; if (c.psn && !cand.status) cand.status = 'psn'; if (c.web) cand.boosts.spe = Math.max(-6, cand.boosts.spe - 1);
      if (cand.hp <= 1e-6) continue;
      const rr = loseA ? duel(Lt[k], cand, Wt[wi], W[wi], { enterA: true, enterB: false, field, tie }) : duel(Wt[wi], W[wi], Lt[k], cand, { enterA: false, enterB: true, field, tie });
      const lw = loseA ? (rr.win === 'A') : (rr.win === 'B');
      const lhp = loseA ? rr.a.hp : rr.b.hp, whp = loseA ? rr.b.hp : rr.a.hp;
      const v = lw ? 0.2 + lhp : -(0.2 + whp);
      if (v > bestV) { bestV = v; bestK = k; }
    }
    if (bestK < 0) break;
    const c = hazardChip(loseA ? hzA : hzB, Lt[bestK]);
    L[bestK].hp -= c.chip; if (c.psn && !L[bestK].status) L[bestK].status = 'psn'; if (c.web) L[bestK].boosts.spe = Math.max(-6, L[bestK].boosts.spe - 1);
    if (loseA) { i = bestK; enterA = true; enterB = false; } else { j = bestK; enterB = true; enterA = false; }
    if (L[bestK].hp <= 1e-6) { // la trampa lo tumba al entrar: se saca otro
      L[bestK].hp = 0;
      if (!alive(L)) break;
      let k2 = L.findIndex(x => x.hp > 1e-6);
      if (loseA) i = k2; else j = k2;
    }
  }
  const sumA = sa.reduce((n, x) => n + Math.max(0, x.hp), 0), sumB = sb.reduce((n, x) => n + Math.max(0, x.hp), 0);
  const aliveA = alive(sa), aliveB = alive(sb);
  const N = Math.max(TA.length, TB.length);
  const v = aliveA && !aliveB ? sumA / N : aliveB && !aliveA ? -sumB / N : (sumA - sumB) / N;
  return { v, win: aliveA && !aliveB ? 'A' : aliveB && !aliveA ? 'B' : (sumA >= sumB ? 'A' : 'B'), aliveA, aliveB, log };
}

function mulberry(seed) {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Compara dos equipos en individual. onProgress(frac, texto) se llama a menudo; budgetMs limita el tiempo de la parte aleatoria.
 */
export async function compareSingles(A, B, { onProgress = () => {}, budgetMs = 22000, dict } = {}) {
  const nA = A.length, nB = B.length;
  const t0 = Date.now();
  let lastTick = Date.now();
  const yieldNow = async () => { if (Date.now() - lastTick > 40) { lastTick = Date.now(); await tick(); } };
  const ctx = { hzA: hazardsFor(B, A), hzB: hazardsFor(A, B) };

  // 1) todos los 1 contra 1 con PS completos
  onProgress(0.02, 'duelos');
  const S = A.map(() => B.map(() => null));
  let done = 0;
  for (let i = 0; i < nA; i++) for (let j = 0; j < nB; j++) {
    const r = duelSym(A[i], newState(A[i]), B[j], newState(B[j]), { enterA: true, enterB: true });
    S[i][j] = { s: r.margin, win: r.win, turns: r.turns, hpLeft: Math.abs(r.margin), tied: r.tied };
    done++; onProgress(0.02 + 0.2 * done / (nA * nB), 'duelos'); await yieldNow();
  }
  // 2) combates completos con cada pareja de líderes (modo esperado) y juego de elección de líder
  const V = A.map(() => B.map(() => 0));
  let d2 = 0;
  for (let i = 0; i < nA; i++) for (let j = 0; j < nB; j++) {
    V[i][j] = (playout(A, B, i, j, ctx, null, 'A').v + playout(A, B, i, j, ctx, null, 'B').v) / 2;
    d2++; onProgress(0.22 + 0.22 * d2 / (nA * nB), 'líderes'); await yieldNow();
  }
  const game = solveGame(V);
  // 3) Monte Carlo: miles de combates con tiradas, precisión y críticos aleatorios; el líder se elige según la estrategia óptima
  const rng = mulberry(12345);
  const pick = (p) => { let r = rng(), c = 0; for (let k = 0; k < p.length; k++) { c += p[k]; if (r <= c) return k; } return p.length - 1; };
  let wins = 0, trials = 0, sumV = 0, ties = 0;
  const tStart = Date.now(), MAX = 12000;
  while (trials < MAX && Date.now() - tStart < budgetMs) {
    const li = pick(game.pa), lj = pick(game.pb);
    const r = playout(A, B, li, lj, ctx, rng, rng() < 0.5 ? 'A' : 'B');
    trials++; sumV += r.v; if (r.win === 'A') wins++;
    if (trials % 10 === 0) { onProgress(0.44 + 0.46 * Math.min(1, Math.max((Date.now() - tStart) / budgetMs, trials / MAX)), 'combates'); await yieldNow(); }
  }
  const pMC = trials ? wins / trials : 0.5;
  const pExp = 1 / (1 + Math.exp(-4.2 * game.value));
  // se combinan: el Monte Carlo manda, el modo esperado estabiliza cuando hay pocas muestras
  const wMC = Math.min(1, trials / 400);
  const pA = Math.max(0.03, Math.min(0.97, pMC * wMC + pExp * (1 - wMC)));
  onProgress(0.92, 'análisis');
  await tick();
  return { pA, pMC, pExp, trials, value: game.value, V, S, game, ctx, ms: Date.now() - t0 };
}

// ───────── análisis de los resultados: razones, consejos y plan de juego ─────────
const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sum = (xs, f = x => x) => xs.reduce((n, x) => n + f(x), 0);
export const TYPES18 = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];
const IMMUNE_AB = { levitate: 'ground', eartheater: 'ground', flashfire: 'fire', wellbakedbody: 'fire', waterabsorb: 'water', stormdrain: 'water', dryskin: 'water', voltabsorb: 'electric', lightningrod: 'electric', motordrive: 'electric', sapsipper: 'grass' };

/** Mejor ataque de `att` contra `def` con los dos a PS completos: { m, avg, min, max, hits } */
export function bestMove(att, def, field = {}) {
  let b = null;
  const as = newState(att), ds = newState(def);
  for (const m of att.attacks) {
    if (firstTurnOnly(m.id)) continue;
    const r = damage(att, as, def, ds, m, { field });
    if (!b || r.exp > b.exp) b = { m, exp: r.exp, avg: r.avg, min: r.min, max: r.max };
  }
  if (!b || b.exp <= 0) return null;
  b.hits = Math.max(1, Math.ceil(1 / Math.max(b.avg, 1e-6) - 1e-9));
  b.ohko = b.min >= 1;
  return b;
}

/** Plan de juego de un bando: qué sacar al principio, a quién mandar contra cada rival y en qué ataques fijarse */
function buildPlan(Mine, Foe, M, probs, foeProbs) {
  // M[i][j]: puntuación firmada desde el punto de vista del bando propio
  const order = probs.map((p, i) => ({ i, p })).sort((a, b) => b.p - a.p);
  const leads = order.filter(x => x.p >= 0.12).slice(0, 3);
  if (!leads.length) leads.push(order[0]);
  const foeLeads = foeProbs.map((p, j) => ({ j, p })).sort((a, b) => b.p - a.p).filter(x => x.p >= 0.12).slice(0, 3);
  const answers = Foe.map((f, j) => {
    let bi = 0; Mine.forEach((_, i) => { if (M[i][j] > M[bi][j]) bi = i; });
    const mv = bestMove(Mine[bi], f);
    return { foe: j, mine: bi, margin: M[bi][j], move: mv?.m || null, hits: mv?.hits || 0, pct: mv ? Math.round(mv.avg * 100) : 0, ohko: !!mv?.ohko };
  });
  // contra el líder más probable del rival
  const topFoe = foeLeads[0]?.j ?? 0;
  let bestVs = 0; Mine.forEach((_, i) => { if (M[i][topFoe] > M[bestVs][topFoe]) bestVs = i; });
  const focus = Mine.map((u, i) => {
    const rows = Foe.map((f, j) => ({ foe: j, mv: bestMove(u, f), win: M[i][j] }));
    const counts = new Map();
    rows.forEach(r => { if (!r.mv) return; const w = Math.max(0.2, r.win > 0 ? 1 : 0.5); counts.set(r.mv.m.id, (counts.get(r.mv.m.id) || 0) + w); });
    const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const targets = rows.filter(r => r.mv && r.mv.avg >= 0.3).sort((a, b) => b.mv.avg - a.mv.avg).slice(0, 4)
      .map(r => ({ foe: r.foe, move: r.mv.m, pct: Math.round(r.mv.avg * 100), hits: r.mv.hits, ohko: r.mv.ohko }));
    const useless = rows.filter(r => !r.mv || r.mv.avg < 0.12).map(r => r.foe);
    return { mine: i, main: main ? u.moves.find(m => m.id === main[0]) : null, targets, useless };
  });
  return { leads, foeLeads, bestVsLead: { foe: topFoe, mine: bestVs }, answers, focus };
}

export function analyzeSingles(A, B, res, { dict } = {}) {
  const nA = A.length, nB = B.length, { S, game, ctx } = res;
  const M = S.map(r => r.map(c => c.s));
  const Mb = B.map((_, j) => A.map((_, i) => -M[i][j])); // desde el punto de vista de B
  const rowA = A.map((u, i) => ({ u, wins: sum(M[i], s => (s > 0.001 ? 1 : 0)), score: mean(M[i]) }));
  const rowB = B.map((u, j) => ({ u, wins: sum(M, r => (r[j] < -0.001 ? 1 : 0)), score: mean(M.map(r => -r[j])) }));
  const pA = res.pA, win = pA >= 0.5 ? 'A' : 'B', pct = Math.round(Math.max(pA, 1 - pA) * 100);
  const pairs = nA * nB;
  const fs = u => speedOf(newState(u), {});
  const fasterA = sum(A, a => sum(B, b => (fs(a) > fs(b) ? 1 : 0))), fasterB = sum(B, b => sum(A, a => (fs(b) > fs(a) ? 1 : 0)));
  const has = (T, k) => sum(T, u => (k === 'hazards' ? u.hazards.length : k === 'removal' ? (u.removal ? 1 : 0) : k === 'phaze' ? (u.phaze ? 1 : 0) : k === 'pivot' ? (u.pivot ? 1 : 0) : 0));
  const margin = pct - 50;
  const reasonsFor = win => {
  const W = win === 'A' ? A : B, L = win === 'A' ? B : A, Wrow = win === 'A' ? rowA : rowB;
  const reasons = [];
  // 1 contra 1
  const winsW = win === 'A' ? sum(rowA, r => r.wins) : sum(rowB, r => r.wins), winsL = win === 'A' ? sum(rowB, r => r.wins) : sum(rowA, r => r.wins);
  if (winsW - winsL >= Math.max(2, pairs * 0.1)) reasons.push({ key: 'duels', strength: (winsW - winsL) / pairs * 1.6, vars: { k: winsW, n: pairs } });
  const fW = (win === 'A' ? fasterA : fasterB) / pairs, fL = (win === 'A' ? fasterB : fasterA) / pairs;
  if (fW - fL >= 0.16) reasons.push({ key: 'speed', strength: (fW - fL) * 1.5, vars: { k: Math.round(fW * 100) } });
  // golpes que sacan a un rival de combate
  const threatCount = (X, Y) => sum(Y, y => (X.some(x => (bestMove(x, y)?.avg || 0) >= 0.5) ? 1 : 0));
  const ohkoCount = (X, Y) => sum(Y, y => (X.some(x => bestMove(x, y)?.ohko) ? 1 : 0));
  const tW = threatCount(W, L), tL = threatCount(L, W);
  if (tW / L.length - tL / W.length >= 0.2) reasons.push({ key: 'cover', strength: (tW / L.length - tL / W.length) * 1.3, vars: { k: tW, n: L.length } });
  const oW = ohkoCount(W, L), oL = ohkoCount(L, W);
  if (oW - oL >= 2) reasons.push({ key: 'ohko', strength: 0.3 + 0.07 * (oW - oL), vars: { k: oW, n: L.length } });
  const star = [...Wrow].sort((a, b) => b.wins - a.wins || b.score - a.score)[0];
  if (star && star.wins / L.length >= 0.6) reasons.push({ key: 'star', strength: (star.wins / L.length) * 0.85, vars: { name: star.u.p, k: star.wins, n: L.length } });
  const weakCount = TYPES18.map(ty => ({ ty, ws: L.filter(u => eff(ty, u.types) >= 2 && IMMUNE_AB[u.ab] !== ty) }));
  const sharedW = weakCount.filter(w => w.ws.length >= 3 && W.some(u => u.types.includes(w.ty) || u.moves.some(m => m.t === w.ty && m.c !== 's' && m.bp >= 60))).sort((a, b) => b.ws.length - a.ws.length)[0];
  if (sharedW) reasons.push({ key: 'weak', strength: (sharedW.ws.length / L.length) * 1.1, vars: { type: sharedW.ty, k: sharedW.ws.length, n: L.length } });
  const hzW = win === 'A' ? (ctx.hzB.sr + ctx.hzB.spikes) : (ctx.hzA.sr + ctx.hzA.spikes), hzL = win === 'A' ? (ctx.hzA.sr + ctx.hzA.spikes) : (ctx.hzB.sr + ctx.hzB.spikes);
  if (hzW - hzL > 0.3) reasons.push({ key: 'hazards', strength: 0.3 + (hzW - hzL) * 0.35, vars: { noRemoval: !has(L, 'removal') } });
  const recW = sum(W, u => (u.recover ? 1 : 0)), recL = sum(L, u => (u.recover ? 1 : 0));
  if (recW - recL >= 2) reasons.push({ key: 'recovery', strength: 0.3 + 0.06 * (recW - recL), vars: { k: recW } });
  const sweeper = Wrow.filter(r => r.u.setup && r.wins / L.length >= 0.5 && !has(L, 'phaze')).sort((a, b) => b.wins - a.wins)[0];
  if (sweeper) reasons.push({ key: 'setup', strength: 0.34, vars: { name: sweeper.u.p } });
  const prioW = sum(W, u => (u.moves.some(m => m.pr > 0 && m.c !== 's' && m.bp > 0) ? 1 : 0)), prioL = sum(L, u => (u.moves.some(m => m.pr > 0 && m.c !== 's' && m.bp > 0) ? 1 : 0));
  if (prioW - prioL >= 2) reasons.push({ key: 'priority', strength: 0.26, vars: { k: prioW } });
  const stW = sum(W, u => (u.statusMoves.length ? 1 : 0)), stL = sum(L, u => (u.statusMoves.length ? 1 : 0));
  if (stW - stL >= 2) reasons.push({ key: 'status', strength: 0.22 + 0.04 * (stW - stL), vars: { k: stW } });
  reasons.sort((a, b) => b.strength - a.strength);
  const maxReasons = margin < 8 ? 1 : margin < 18 ? 2 : 3;
  return reasons.filter(r => r.strength >= 0.18).slice(0, maxReasons);
  };
  const top = reasonsFor(win), topOther = reasonsFor(win === 'A' ? 'B' : 'A');

  // consejos para cada bando
  const tipsFor = (T, O, Trow, Mt, side) => {
    const tips = [];
    const weaks = TYPES18.map(ty => ({ ty, ws: T.filter(u => eff(ty, u.types) >= 2 && IMMUNE_AB[u.ab] !== ty) })).filter(w => w.ws.length >= 3).sort((a, b) => b.ws.length - a.ws.length);
    if (weaks[0]) tips.push({ key: 'weak', sev: weaks[0].ws.length, vars: { type: weaks[0].ty, k: weaks[0].ws.length }, resist: weaks[0].ty });
    if (has(O, 'hazards') && !has(T, 'removal')) tips.push({ key: 'removal', sev: 4, vars: {}, ids: ['corviknight', 'excadrill', 'forretress', 'tentacruel', 'tinkaton', 'greninja'] });
    if (!has(T, 'hazards') && T.length >= 3) tips.push({ key: 'nohazards', sev: 2, vars: {}, ids: ['gliscor', 'garganacl', 'ferrothorn', 'landorustherian', 'glimmora'] });
    const oFast = Math.max(...O.map(fs)), myFast = Math.max(...T.map(fs));
    if (myFast < oFast * 0.97) tips.push({ key: 'speed', sev: 4, vars: { mine: myFast, theirs: oFast } });
    if (!sum(T, u => (u.recover ? 1 : 0)) && T.length >= 4) tips.push({ key: 'recovery', sev: 3, vars: {}, ids: ['clefable', 'blissey', 'toxapex', 'slowking', 'skarmory', 'gliscor'] });
    const weakest = [...Trow].sort((a, b) => a.score - b.score)[0];
    if (weakest && weakest.score < -0.3 && T.length >= 3) tips.push({ key: 'weakest', sev: 3 + Math.round(-weakest.score * 2), vars: { name: weakest.u.name, k: weakest.wins, n: O.length }, replace: weakest.u.id });
    const uncovered = O.filter((o, j) => !T.some(u => (bestMove(u, o)?.avg || 0) >= 0.35));
    if (uncovered.length >= 2) tips.push({ key: 'uncovered', sev: 2 + uncovered.length, vars: { list: uncovered.slice(0, 3).map(u => u.name), k: uncovered.length } });
    if (!T.some(u => u.pivot) && T.length >= 4) tips.push({ key: 'pivot', sev: 1, vars: {}, ids: ['rotomwash', 'landorustherian', 'toxapex', 'dragapult'] });
    tips.sort((a, b) => b.sev - a.sev);
    return tips.slice(0, side === 'loser' ? 4 : 2);
  };
  const close = margin < 6;
  const tipsA = tipsFor(A, B, rowA, M, pA < 0.5 ? 'loser' : 'winner');
  const tipsB = tipsFor(B, A, rowB, Mb, pA >= 0.5 ? 'loser' : 'winner');
  const speeds = [...A.map(u => ({ u, side: 'A', spe: fs(u) })), ...B.map(u => ({ u, side: 'B', spe: fs(u) }))].sort((a, b) => b.spe - a.spe);
  speeds.forEach(x => { x.u.spe = x.spe; });
  const planA = buildPlan(A, B, M, game.pa, game.pb);
  const planB = buildPlan(B, A, Mb, game.pb, game.pa);
  const factors = {
    duels: mean(M.flat()), speed: 0.35 * ((fasterA - fasterB) / pairs),
    hazards: 0.1 * ((ctx.hzB.sr + ctx.hzB.spikes) - (ctx.hzA.sr + ctx.hzA.spikes)),
    support: 0.03 * (Math.min(2, sum(A, u => u.statusMoves.length)) - Math.min(2, sum(B, u => u.statusMoves.length))) + 0.025 * (Math.min(3, sum(A, u => (u.recover ? 1 : 0))) - Math.min(3, sum(B, u => (u.recover ? 1 : 0)))),
  };
  return {
    mode: 'singles', pA, win, pct, close, matrix: S.map(r => r.map(c => ({ s: c.s }))), rowA, rowB, reasons: top, reasonsOther: topOther, tipsA, tipsB, speeds, factors,
    summary: { fasterA, fasterB, pairs, winsA: sum(rowA, r => r.wins), winsB: sum(rowB, r => r.wins) },
    plan: { A: planA, B: planB }, trials: res.trials, ms: res.ms,
  };
}
