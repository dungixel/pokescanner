// Comparador de equipos ("Batalla"). Calcula cada duelo 1 contra 1 con las estadísticas reales de la build (nivel 100, EVs,
// naturaleza), el mejor movimiento, la habilidad y el objeto, y de ahí saca un porcentaje de victoria, las razones y los consejos.
// No simula un combate completo: es una estimación basada en daño, velocidad y rol del equipo.
import { TYPES, matchups, formatRank } from './util.js';

const FIXED = { seismictoss: 100, nightshade: 100 };
const HITS = { iciclespear: 3, rockblast: 3, bulletseed: 3, tailslap: 3, scaleshot: 3.5, watershuriken: 3, bonemerang: 2, doublekick: 2, dualwingbeat: 2, doublehit: 2, surgingstrikes: 3, tripledive: 3, tripleaxel: 6, triplekick: 6, populationbomb: 6, armthrust: 3, furyattack: 3, pinmissile: 3, dragondarts: 2, twinbeam: 2, geargrind: 2, gigatonhammer: 1 };
const POWER = { knockoff: 97, acrobatics: 110, facade: 70, hex: 65, storedpower: 40, poweruptpunch: 40, lowkick: 80, grassknot: 80, heavyslam: 80, heatcrash: 80, eruption: 150, waterspout: 150, gyroball: 70, electroball: 80, ragefist: 60, lastrespects: 80, boltbeak: 85, fishiousrend: 85, payback: 50, avalanche: 60, revenge: 60, return: 102, frustration: 0, crushgrip: 80, wringout: 60, naturalgift: 80, flail: 60, reversal: 60, punishment: 60, trumpcard: 60 };
const ROLE = {
  hazards: ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'ceaselessedge', 'stoneaxe'],
  removal: ['rapidspin', 'defog', 'courtchange', 'mortalspin', 'tidyup'],
  recovery: ['recover', 'roost', 'softboiled', 'slackoff', 'synthesis', 'moonlight', 'morningsun', 'shoreup', 'milkdrink', 'healorder', 'strengthsap', 'rest', 'wish', 'lifedew', 'junglehealing', 'lunarblessing', 'healingwish', 'painsplit'],
  setup: ['swordsdance', 'nastyplot', 'dragondance', 'calmmind', 'bulkup', 'quiverdance', 'shellsmash', 'irondefense', 'agility', 'rockpolish', 'curse', 'coil', 'tailglow', 'bellydrum', 'victorydance', 'shiftgear', 'workup', 'growth', 'cosmicpower', 'amnesia', 'autotomize', 'noretreat', 'filletaway', 'tidyup', 'clangoroussoul', 'trailblaze'],
  status: ['willowisp', 'thunderwave', 'toxic', 'spore', 'sleeppowder', 'hypnosis', 'glare', 'yawn', 'toxicthread', 'stunspore', 'darkvoid', 'lovelykiss', 'sing', 'poisonpowder'],
  screens: ['reflect', 'lightscreen', 'auroraveil'],
  pivot: ['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'batonpass', 'chillyreaction', 'shedtail'],
  phaze: ['roar', 'whirlwind', 'dragontail', 'circlethrow', 'haze', 'clearsmog'],
  speedctl: ['tailwind', 'trickroom', 'thunderwave', 'icywind', 'electroweb', 'stringshot', 'bulldoze'],
};
const IMMUNE = { levitate: 'ground', eartheater: 'ground', flashfire: 'fire', wellbakedbody: 'fire', waterabsorb: 'water', stormdrain: 'water', dryskin: 'water', voltabsorb: 'electric', lightningrod: 'electric', motordrive: 'electric', sapsipper: 'grass' };

const eff = (atk, defTypes) => {
  const m = matchups(defTypes);
  for (const k of Object.keys(m)) if (m[k].includes(atk)) return Number(k);
  return 1;
};

/** Build por defecto: la del formato más importante */
export function bestSetIndex(p) {
  const sets = p.sets || [];
  if (!sets.length) return -1;
  let best = 0;
  sets.forEach((s, i) => { if (formatRank(s.f) < formatRank(sets[best].f)) best = i; });
  return best;
}

function calcStats(base, evs, nat, natures) {
  const n = natures?.[nat] || {};
  const ev = k => (evs && evs[k] != null ? evs[k] : (evs ? 0 : 84));
  const keys = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  const out = {};
  keys.forEach((k, i) => {
    if (k === 'hp') { out.hp = base[0] === 1 ? 1 : Math.floor((2 * base[0] + 31 + Math.floor(ev('hp') / 4))) + 110; return; }
    const m = n.plus === k ? 1.1 : n.minus === k ? 0.9 : 1;
    out[k] = Math.floor((Math.floor(2 * base[i] + 31 + Math.floor(ev(k) / 4)) + 5) * m);
  });
  return out;
}

/** Convierte un Pokémon (con su ficha completa) en una "unidad" lista para combatir */
export function buildUnit(p, member, dict) {
  const idx = member?.s != null && p.sets?.[member.s] ? member.s : bestSetIndex(p);
  const set = idx >= 0 ? p.sets[idx] : null;
  const ab = set?.a?.[0] || p.ab?.[0]?.id || '';
  const item = set?.i?.[0] || '';
  const nat = set?.na?.[0] || (p.s[1] >= p.s[3] ? 'adamant' : 'modest');
  const evs = set?.ev || null;
  // sin build de Smogon: se supone el ataque más fuerte y velocidad máxima
  const moves = set ? set.m.map(a => a[0]).filter(Boolean) : [];
  const st = calcStats(p.s, evs || (p.s[1] >= p.s[3] ? { atk: 252, spe: 252, hp: 4 } : { spa: 252, spe: 252, hp: 4 }), nat, dict.natures);
  const mv = moves.map(id => ({ id, ...(dict.moves[id] || {}) })).filter(m => m.t);
  const has = list => mv.some(m => list.includes(m.id));
  return {
    id: p.id, p, name: p.es, en: p.en, types: p.t, st, ab, item, nat, set: idx, moves: mv,
    nfe: p.r === 'NFE' || p.r === 'LC',
    roles: Object.fromEntries(Object.keys(ROLE).map(k => [k, mv.filter(m => ROLE[k].includes(m.id)).map(m => m.id)])),
    recovery: has(ROLE.recovery), setup: has(ROLE.setup),
    prio: mv.filter(m => m.pr > 0 && m.c !== 's' && m.p > 0),
    boots: item === 'heavydutyboots',
    spe: Math.floor(st.spe * (item === 'choicescarf' ? 1.5 : 1)),
  };
}

function movePower(m, att) {
  let pw = POWER[m.id] ?? m.p ?? 0;
  if (!pw) pw = 60;
  const hits = HITS[m.id];
  if (hits) pw = (m.p || pw) * hits;
  if (att.ab === 'technician' && (m.p || 0) <= 60 && !hits) pw *= 1.5;
  if (att.ab === 'sheerforce') pw *= 1.25;
  return pw;
}

/** Daño esperado (% de los PS del defensor) de un movimiento */
export function movePct(att, def, m) {
  if (m.c === 's') return 0;
  if (FIXED[m.id]) return (FIXED[m.id] / def.st.hp) * 100;
  if (m.id === 'superfang' || m.id === 'naturesmadness' || m.id === 'ruination') return 50;
  const phys = m.c === 'f';
  let e = eff(m.t, def.types);
  const imm = IMMUNE[def.ab];
  if (imm && imm === m.t && att.ab !== 'moldbreaker' && m.id !== 'thousandarrows') e = 0;
  if (def.item === 'airballoon' && m.t === 'ground') e = 0;
  if (def.ab === 'wonderguard' && e <= 1) e = 0;
  if (e === 0) return 0;
  if (att.ab === 'tintedlens' && e < 1) e *= 2;
  let A = m.id === 'bodypress' ? att.st.def : m.id === 'foulplay' ? def.st.atk : phys ? att.st.atk : att.st.spa;
  let D = phys && !['psyshock', 'psystrike', 'secretsword'].includes(m.id) ? def.st.def : def.st.spd;
  if (phys && (att.ab === 'hugepower' || att.ab === 'purepower')) A *= 2;
  if (att.item === 'choiceband' && phys) A *= 1.5;
  if (att.item === 'choicespecs' && !phys) A *= 1.5;
  if (def.item === 'assaultvest' && !phys) D *= 1.5;
  if (def.nfe && def.item === 'eviolite') D *= 1.5;
  let dmg = ((((2 * 100) / 5 + 2) * movePower(m, att) * A / D) / 50 + 2);
  const stab = att.types.includes(m.t) || att.ab === 'protean' || att.ab === 'libero';
  if (stab) dmg *= att.ab === 'adaptability' ? 2 : 1.5;
  dmg *= e * 0.925;
  if (att.item === 'lifeorb') dmg *= 1.3;
  if (att.item === 'expertbelt' && e > 1) dmg *= 1.2;
  if (e > 1 && ['filter', 'solidrock', 'prismarmor'].includes(def.ab)) dmg *= 0.75;
  if ((m.t === 'fire' || m.t === 'ice') && def.ab === 'thickfat') dmg *= 0.5;
  if (m.t === 'fire' && def.ab === 'heatproof') dmg *= 0.5;
  if (phys && def.ab === 'furcoat') dmg *= 0.5;
  if (!phys && def.ab === 'icescales') dmg *= 0.5;
  if (def.ab === 'multiscale' || def.ab === 'shadowshield') dmg *= 0.75;
  if (phys && def.ab === 'intimidate') dmg *= 0.85;
  if (m.a && m.a < 100) dmg *= m.a / 100;
  return (dmg / def.st.hp) * 100;
}

/** Mejor movimiento de ataque contra un rival: { pct, move } */
export function best(att, def) {
  let b = { pct: 0, move: null };
  for (const m of att.moves) { const pct = movePct(att, def, m); if (pct > b.pct) b = { pct, move: m }; }
  return b;
}

/** Duelo 1 contra 1: de -1 (pierde por completo) a +1 (gana sin recibir daño) */
export function duel(A, B) {
  const a = best(A, B), b = best(B, A);
  const lefts = u => (u.item === 'leftovers' || u.item === 'blacksludge' ? 6.25 : 0);
  const a0 = Math.max(0, a.pct - lefts(B)), b0 = Math.max(0, b.pct - lefts(A));
  // todos los ajustes parten de los valores originales para que el duelo A-B sea el espejo exacto de B-A
  const aHeals = A.recovery && b0 < 45, bHeals = B.recovery && a0 < 45;
  const dBeff = aHeals ? Math.max(0, b0 - 28) : b0, dAeff = bHeals ? Math.max(0, a0 - 28) : a0;
  let dA = dAeff * (aHeals && dBeff > 0 ? 0.7 : 1), dB = dBeff * (bHeals && dAeff > 0 ? 0.7 : 1);
  if (A.setup && b0 <= 35) dA *= 1.35;
  if (B.setup && a0 <= 35) dB *= 1.35;
  let tA = dA > 0 ? Math.ceil(100 / dA) : Infinity, tB = dB > 0 ? Math.ceil(100 / dB) : Infinity;
  if ((B.item === 'focussash' || B.ab === 'sturdy') && tA === 1) tA = 2;
  if ((A.item === 'focussash' || A.ab === 'sturdy') && tB === 1) tB = 2;
  if (!isFinite(tA) && !isFinite(tB)) return { s: 0, a, b, aFirst: A.spe >= B.spe };
  const run = aFirst => {
    const aWins = tA < tB || (tA === tB && aFirst);
    if (aWins) { const hits = aFirst ? tA - 1 : tA; return Math.min(1, Math.max(0.06, 1 - (hits * dB) / 100)); }
    const hits = aFirst ? tB : tB - 1;
    return -Math.min(1, Math.max(0.06, 1 - (hits * dA) / 100));
  };
  // con la misma velocidad cada uno pega primero la mitad de las veces
  const s = A.spe === B.spe ? (run(true) + run(false)) / 2 : run(A.spe > B.spe);
  return { s, a, b, aFirst: A.spe >= B.spe };
}

const sum = (xs, f = x => x) => xs.reduce((n, x) => n + f(x), 0);
const mean = xs => (xs.length ? sum(xs) / xs.length : 0);

/** Calcula todo lo que se enseña en la pantalla de comparación */
export function compareTeams(A, B) {
  const nA = A.length, nB = B.length;
  const S = A.map(a => B.map(b => duel(a, b)));
  const cA = mean(B.map((_, j) => Math.max(...A.map((_, i) => S[i][j].s))));
  const cB = mean(A.map((_, i) => Math.max(...B.map((_, j) => -S[i][j].s))));
  const winsA = sum(S, r => sum(r, d => (d.s > 0.001 ? 1 : 0))), winsB = sum(S, r => sum(r, d => (d.s < -0.001 ? 1 : 0)));
  const pairs = nA * nB;
  const fasterA = sum(A, a => sum(B, b => (a.spe > b.spe ? 1 : 0))), fasterB = sum(B, b => sum(A, a => (b.spe > a.spe ? 1 : 0)));

  const has = (T, role) => sum(T, u => u.roles[role].length);
  const hazScore = (X, Y) => {
    const haz = has(X, 'hazards');
    if (!haz) return 0;
    const bootsShare = sum(Y, u => (u.boots ? 1 : 0)) / Y.length;
    return 0.1 * (has(Y, 'removal') ? 0.4 : 1) * (1 - bootsShare * 0.6);
  };
  const factors = {
    duels: (cA - cB) + 0.5 * ((winsA - winsB) / pairs),
    speed: 0.35 * ((fasterA - fasterB) / pairs),
    hazards: hazScore(A, B) - hazScore(B, A),
    support: 0.03 * (Math.min(2, has(A, 'status')) - Math.min(2, has(B, 'status'))) + 0.03 * (Math.min(2, has(A, 'screens')) - Math.min(2, has(B, 'screens'))) + 0.025 * (Math.min(3, sum(A, u => (u.recovery ? 1 : 0))) - Math.min(3, sum(B, u => (u.recovery ? 1 : 0)))),
    size: -0.07 * (nB - nA),
  };
  const x = sum(Object.values(factors));
  const pA = Math.max(0.05, Math.min(0.95, 1 / (1 + Math.exp(-2.2 * x))));

  // resumen por Pokémon
  const rowA = A.map((u, i) => ({ u, wins: sum(S[i], d => (d.s > 0.001 ? 1 : 0)), score: mean(S[i].map(d => d.s)) }));
  const rowB = B.map((u, j) => ({ u, wins: sum(S, r => (r[j].s < -0.001 ? 1 : 0)), score: mean(S.map(r => -r[j].s)) }));

  const win = pA >= 0.5 ? 'A' : 'B';
  const W = win === 'A' ? A : B, L = win === 'A' ? B : A;
  const Wrow = win === 'A' ? rowA : rowB, Lrow = win === 'A' ? rowB : rowA;
  const reasons = [];
  const pct = Math.round(Math.max(pA, 1 - pA) * 100);

  // velocidad
  const fW = (win === 'A' ? fasterA : fasterB) / pairs, fL = (win === 'A' ? fasterB : fasterA) / pairs;
  if (fW - fL >= 0.16) reasons.push({ key: 'speed', strength: (fW - fL) * 1.6, vars: { k: Math.round(fW * 100) } });
  // cobertura súper eficaz
  const seOf = (X, Y) => sum(Y, y => (X.some(x => x.moves.some(m => m.c !== 's' && movePct(x, y, m) > 0 && eff(m.t, y.types) >= 2 && !(IMMUNE[y.ab] === m.t)) ) ? 1 : 0));
  const seW = seOf(W, L), seL = seOf(L, W);
  if (seW / L.length - seL / W.length >= 0.2) reasons.push({ key: 'cover', strength: (seW / L.length - seL / W.length) * 1.3, vars: { k: seW, n: L.length } });
  // pokémon clave
  const star = [...Wrow].sort((a, b) => b.wins - a.wins || b.score - a.score)[0];
  if (star && star.wins / L.length >= 0.6) reasons.push({ key: 'star', strength: (star.wins / L.length) * 0.85, vars: { name: star.u.p, k: star.wins, n: L.length } });
  // debilidad compartida del perdedor
  const weakCount = TYPES.map(ty => ({ ty, ws: L.filter(u => eff(ty, u.types) >= 2 && IMMUNE[u.ab] !== ty) }));
  const sharedW = weakCount.filter(w => w.ws.length >= 3 && W.some(u => u.types.includes(w.ty) || u.moves.some(m => m.t === w.ty && m.c !== 's' && m.p >= 60))).sort((a, b) => b.ws.length - a.ws.length)[0];
  if (sharedW) reasons.push({ key: 'weak', strength: (sharedW.ws.length / L.length) * 1.1, vars: { type: sharedW.ty, k: sharedW.ws.length, n: L.length } });
  // trampas
  const hz = (win === 'A' ? factors.hazards : -factors.hazards);
  if (hz > 0.03) reasons.push({ key: 'hazards', strength: hz * 4, vars: { noRemoval: !has(L, 'removal') } });
  // recuperación y resistencia
  const recW = sum(W, u => (u.recovery ? 1 : 0)), recL = sum(L, u => (u.recovery ? 1 : 0));
  if (recW - recL >= 2) reasons.push({ key: 'recovery', strength: 0.3 + 0.06 * (recW - recL), vars: { k: recW } });
  // setup
  const sweeper = W.find(u => u.setup && u.spe >= mean(L.map(l => l.spe)));
  if (sweeper && !has(L, 'phaze')) reasons.push({ key: 'setup', strength: 0.34, vars: { name: sweeper.p } });
  // prioridad
  const prioW = W.filter(u => u.prio.length).length, prioL = L.filter(u => u.prio.length).length;
  if (prioW - prioL >= 2) reasons.push({ key: 'priority', strength: 0.26, vars: { k: prioW } });
  reasons.sort((a, b) => b.strength - a.strength);
  const margin = pct - 50;
  const maxReasons = margin < 8 ? 1 : margin < 18 ? 2 : 3;
  const top = reasons.filter(r => r.strength >= 0.18).slice(0, maxReasons);

  // consejos para el equipo que pierde (y, si va muy igualado, para los dos)
  const tipsFor = (T, O, Trow, side) => {
    const tips = [];
    const weaks = TYPES.map(ty => ({ ty, ws: T.filter(u => eff(ty, u.types) >= 2 && IMMUNE[u.ab] !== ty) })).filter(w => w.ws.length >= 3).sort((a, b) => b.ws.length - a.ws.length);
    if (weaks[0]) tips.push({ key: 'weak', sev: weaks[0].ws.length, vars: { type: weaks[0].ty, k: weaks[0].ws.length }, resist: weaks[0].ty });
    const oHaz = has(O, 'hazards');
    if (oHaz && !has(T, 'removal')) tips.push({ key: 'removal', sev: 4, vars: {}, ids: ['corviknight', 'excadrill', 'forretress', 'tentacruel', 'tinkaton', 'greninja'] });
    if (!has(T, 'hazards') && T.length >= 3) tips.push({ key: 'nohazards', sev: 2, vars: {}, ids: ['gliscor', 'garganacl', 'ferrothorn', 'landorustherian', 'glimmora'] });
    const oFast = Math.max(...O.map(u => u.spe)), myFast = Math.max(...T.map(u => u.spe));
    if (myFast < oFast * 0.97) tips.push({ key: 'speed', sev: 4, vars: { mine: myFast, theirs: oFast } });
    if (!sum(T, u => (u.recovery ? 1 : 0)) && T.length >= 4) tips.push({ key: 'recovery', sev: 3, vars: {}, ids: ['clefable', 'blissey', 'toxapex', 'slowking', 'skarmory', 'gliscor'] });
    const weakest = [...Trow].sort((a, b) => a.score - b.score)[0];
    if (weakest && weakest.score < -0.35 && T.length >= 3) tips.push({ key: 'weakest', sev: 3 + Math.round(-weakest.score * 2), vars: { name: weakest.u.p, k: weakest.wins, n: O.length }, replace: true });
    const uncovered = O.filter(o => !T.some(u => u.moves.some(m => m.c !== 's' && movePct(u, o, m) >= 35)));
    if (uncovered.length >= 2) tips.push({ key: 'uncovered', sev: 2 + uncovered.length, vars: { list: uncovered.slice(0, 3).map(u => u.p), k: uncovered.length } });
    if (!T.some(u => u.roles.pivot.length) && T.length >= 4) tips.push({ key: 'pivot', sev: 1, vars: {}, ids: ['rotomwash', 'landorustherian', 'toxapex', 'dragapult'] });
    tips.sort((a, b) => b.sev - a.sev);
    return tips.slice(0, side === 'loser' ? 4 : 2);
  };
  const close = margin < 6;
  const tipsA = tipsFor(A, B, rowA, pA < 0.5 ? 'loser' : 'winner');
  const tipsB = tipsFor(B, A, rowB, pA >= 0.5 ? 'loser' : 'winner');

  // orden de velocidad de los 12 Pokémon
  const speeds = [...A.map(u => ({ u, side: 'A' })), ...B.map(u => ({ u, side: 'B' }))].sort((a, b) => b.u.spe - a.u.spe);

  return {
    pA, win, pct, close, matrix: S, rowA, rowB, reasons: top, tipsA, tipsB, speeds, factors,
    summary: { fasterA, fasterB, pairs, winsA, winsB },
  };
}

export { eff };
