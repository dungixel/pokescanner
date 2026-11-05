// Comparador de DOBLES: elige qué 4 Pokémon llevar y cuáles sacar al principio (juego de suma cero entre las mejores estrategias de
// cada equipo) y simula el combate 2 contra 2 turno a turno: daño real de Smogon con reducción de movimientos de área, Sorpresa,
// Protección, redireccionamiento, Viento Afín / Espacio Raro, Intimidación, climas y campos, Ayuda y fuego amigo.
import { damage, newState, speedOf, canBeStatus, SETUP, RECOVER, STATUS_MOVE, weatherOf, terrainOf, isSpread, solveGame, eff } from './calcx.js';
import { onEntry, tick, TYPES18, bestMove, duelSym } from './singles.js';

const PROTECT = ['protect', 'detect', 'spikyshield', 'kingsshield', 'banefulbunker', 'silktrap', 'burningbulwark', 'obstruct'];
const REDIRECT = ['followme', 'ragepowder'];
const SPEED_DROP = { icywind: 'spe', electroweb: 'spe', bulldoze: 'spe', lowsweep: 'spe', snarl: 'spa', strugglebug: 'spa', mudshot: 'spe', rocktomb: 'spe' };
const RUIN = { swordofruin: 'isSwordOfRuin', beadsofruin: 'isBeadsOfRuin', tabletsofruin: 'isTabletsOfRuin', vesselofruin: 'isVesselOfRuin' };
const PRIO_BLOCK = ['dazzling', 'queenlymajesty', 'armortail'];
const clone = s => ({ ...s, boosts: { ...s.boosts } });
const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sum = (xs, f = x => x) => xs.reduce((n, x) => n + f(x), 0);
const stageMul = s => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
const isPrimed = (u, ids) => u.moves.some(m => ids.includes(m.id));

// ───────── una partida de dobles ─────────
function mkSide(units, order, leads) {
  const st = order.map(i => newState(units[i]));
  const us = order.map(i => units[i]);
  const act = [order.indexOf(leads[0]), order.indexOf(leads[1])];
  const bench = order.map((_, k) => k).filter(k => !act.includes(k));
  return { us, st, act, bench, tailwind: 0, reflect: 0, lightScreen: 0, auroraVeil: 0 };
}

function fieldFor(f, sides) {
  const ruins = [];
  for (const sd of sides) for (const k of sd.act) { if (k < 0) continue; const s = sd.st[k]; if (s.hp > 1e-6 && RUIN[sd.us[k].ab]) ruins.push(RUIN[sd.us[k].ab]); }
  return { weather: f.weather, terrain: f.terrain, doubles: true, ruin: ruins.sort().join(',') };
}

/** Juega un combate de dobles completo. Devuelve { v, turns, first: acciones del primer turno, kos } */
function playDoubles(UA, UB, strA, strB, { rng, tie = 'A', trace = false } = {}) {
  const sides = [mkSide(UA, strA.order, strA.leads), mkSide(UB, strB.order, strB.leads)];
  const f = { weather: null, wT: 0, terrain: null, tT: 0, trick: 0 };
  const mon = (s, k) => { const sd = sides[s], i = sd.act[k]; return i >= 0 ? { s, k, i, u: sd.us[i], st: sd.st[i] } : null; };
  const alive = m => m && m.st.hp > 1e-6;
  const foesOf = s => [0, 1].map(k => mon(1 - s, k)).filter(alive);
  const allyOf = (s, k) => { const m = mon(s, 1 - k); return alive(m) ? m : null; };
  const first = [];
  const kos = { A: 0, B: 0 };
  const ctxFor = (att, tgt, extra = {}) => ({
    field: fieldFor(f, sides),
    aSide: { helpingHand: !!att.st.helped, battery: false, powerSpot: false },
    dSide: { reflect: sides[tgt.s].reflect > 0, lightScreen: sides[tgt.s].lightScreen > 0, auroraVeil: sides[tgt.s].auroraVeil > 0, friendGuard: !!(allyOf(tgt.s, tgt.k)?.u.ab === 'friendguard') },
    ...extra,
  });
  const spd = m => { const v = speedOf(m.st, f, { tailwind: sides[m.s].tailwind > 0 }); return v; };

  // Intimidación: baja el Ataque de los rivales que hay en el campo
  const intim = (m, foes) => { for (const fo of foes) onEntry({ u: m.u }, { u: fo.u, boosts: fo.st.boosts }, {}); };
  const entryAll = () => {
    const all = [0, 1].flatMap(s => [0, 1].map(k => mon(s, k))).filter(alive).sort((a, b) => spd(a) - spd(b));
    for (const m of all) {
      const u = m.u;
      const w = weatherOf(u.ab); if (w) { f.weather = w; f.wT = 5; }
      const tr = terrainOf(u.ab); if (tr) { f.terrain = tr; f.tT = 5; }
      if (u.ab === 'intimidate') intim(m, foesOf(m.s));
    }
  };
  entryAll();

  const threatOn = (foe, tgt) => {
    // daño esperado máximo que `foe` hace a `tgt` en un solo turno (movimiento individual)
    let b = 0;
    for (const m of foe.u.attacks) {
      if (m.id === 'fakeout' && !foe.st.first) continue;
      const sp = isSpread(m) && foesOf(foe.s).length >= 1;
      const d = damage(foe.u, foe.st, tgt.u, tgt.st, m, ctxFor(foe, tgt, { spread: sp && alive(allyOf(tgt.s, tgt.k)) })).exp;
      if (d > b) b = d;
    }
    return b;
  };

  const chooseAction = (me, planned) => {
    const U = me.u, st = me.st;
    const foes = foesOf(me.s), ally = allyOf(me.s, me.k);
    const opts = [];
    const remHP = (t) => { const r = planned.dmg.get(t.st) || 0; return Math.max(0.0001, t.st.hp - r); };
    const threatScore = fo => Math.min(1, mean([me, ally].filter(Boolean).map(x => threatOn(fo, x))));
    for (const m of U.attacks) {
      if ((m.id === 'fakeout' || m.id === 'firstimpression') && !st.first) continue;
      const spread = isSpread(m);
      const tg = m.tg === 'allAdjacent' ? [...foes, ...(ally ? [ally] : [])] : spread ? foes : null;
      if (spread) {
        const two = tg.length >= 2;
        let val = 0, dsum = 0, ads = 0;
        for (const t of tg) {
          const isAlly = t.s === me.s;
          const r = damage(U, st, t.u, t.st, m, ctxFor(me, t, { spread: two }));
          const dd = Math.min(r.exp, remHP(t));
          if (isAlly) { ads += dd; val -= dd * 1.4 + (r.exp >= t.st.hp ? 0.5 : 0); }
          else { dsum += dd; val += dd * (0.75 + 0.5 * threatScore(t)) + (r.exp >= remHP(t) - 1e-6 ? 0.3 : 0); if (SPEED_DROP[m.id]) val += 0.1; }
        }
        opts.push({ type: 'atk', m, targets: tg, val, spread: true, two });
      } else {
        for (const t of foes) {
          const r = damage(U, st, t.u, t.st, m, ctxFor(me, t));
          const dd = Math.min(r.exp, remHP(t));
          let val = dd * (0.75 + 0.5 * threatScore(t)) + (r.exp >= remHP(t) - 1e-6 ? 0.3 : 0);
          if (m.id === 'fakeout' || m.id === 'firstimpression') val += 0.35 * threatScore(t) + 0.1;
          opts.push({ type: 'atk', m, targets: [t], val });
        }
      }
    }
    const best = opts.reduce((a, b) => (!a || b.val > a.val ? b : a), null);
    const bestVal = best ? best.val : 0;
    const incoming = fo => threatOn(fo, me);
    const inc = Math.min(1.5, sum(foes, fo => incoming(fo) * 0.5 * (foes.length === 1 ? 2 : 1)));
    // Protección
    if (U.moves.some(m => PROTECT.includes(m.id)) && st.prot === 0 && foes.length) {
      const pm = U.moves.find(m => PROTECT.includes(m.id));
      let val = inc >= st.hp * 0.7 ? 0.55 * Math.min(inc, st.hp) + 0.15 : 0.12 * inc;
      if (planned.allyDoing?.some(a => a.type === 'speed' || a.type === 'setup')) val += 0.1;
      if (me.st.first && inc > st.hp * 0.5) val += 0.1;
      opts.push({ type: 'protect', m: pm, val: val * 0.9 });
    }
    // Ayuda
    if (ally && U.moves.some(m => m.id === 'helpinghand')) {
      const am = ally.u.attacks.length ? Math.max(...ally.u.attacks.map(m => Math.max(0, ...foes.map(t => damage(ally.u, ally.st, t.u, t.st, m, ctxFor(ally, t, { spread: isSpread(m) && foes.length > 1 })).exp)))) : 0;
      opts.push({ type: 'help', m: U.moves.find(m => m.id === 'helpinghand'), val: Math.min(0.5, am * 0.5) * 0.9 });
    }
    // Redirección
    if (ally && U.moves.some(m => REDIRECT.includes(m.id))) {
      const incAlly = sum(foes, fo => threatOn(fo, ally)) * 0.5;
      opts.push({ type: 'redirect', m: U.moves.find(m => REDIRECT.includes(m.id)), val: 0.5 * Math.min(incAlly, ally.st.hp) + 0.08 });
    }
    // control de velocidad
    const tw = U.moves.find(m => m.id === 'tailwind');
    if (tw && sides[me.s].tailwind === 0) {
      let flips = 0;
      for (const x of [me, ally].filter(Boolean)) for (const fo of foes) { const sx = spd(x), sf = spd(fo); if (sx < sf && sx * 2 > sf) flips += 0.25; else if (sx >= sf) flips += 0.05; }
      opts.push({ type: 'speed', m: tw, val: 0.12 + flips * 0.35 });
    }
    const trm = U.moves.find(m => m.id === 'trickroom');
    if (trm) {
      let fl = 0;
      for (const x of [me, ally].filter(Boolean)) for (const fo of foes) { const sx = spd(x), sf = spd(fo); const slowerBefore = sx < sf; fl += (f.trick ? (slowerBefore ? -0.2 : 0.25) : (slowerBefore ? 0.25 : -0.2)); }
      if (f.trick > 0) fl = -fl; // volver a usarlo anula el espacio
      opts.push({ type: 'trick', m: trm, val: 0.1 + fl * 0.4 });
    }
    // Protección contra movimientos de área
    const wg = U.moves.find(m => m.id === 'wideguard');
    if (wg) {
      const spreadInc = sum(foes, fo => Math.max(0, ...fo.u.attacks.filter(isSpread).map(m => damage(fo.u, fo.st, me.u, me.st, m, ctxFor(fo, me, { spread: true })).exp)));
      opts.push({ type: 'wide', m: wg, val: Math.min(0.5, spreadInc * 0.6) * 0.8 });
    }
    // mejoras y recuperación
    if (U.setup && st.hp > inc * 1.3 + 0.1) {
      const S = SETUP[U.setup.id];
      const keyOff = best?.m?.c === 'e' ? 'spa' : 'atk';
      if (S[keyOff] && st.boosts[keyOff] < 2) opts.push({ type: 'setup', m: U.setup, val: 0.5 * bestVal * (stageMul(st.boosts[keyOff] + S[keyOff]) / stageMul(st.boosts[keyOff]) - 1) });
      else if (S.spe && st.boosts.spe < 2) opts.push({ type: 'setup', m: U.setup, val: 0.12 });
    }
    if (U.recover && st.hp <= 0.55 && inc < RECOVER[U.recover.id]) opts.push({ type: 'recover', m: U.recover, val: 0.5 * (RECOVER[U.recover.id]) });
    // estados
    for (const m of U.statusMoves) {
      const sm = STATUS_MOVE[m.id];
      if (sm.acc < 75) continue;
      for (const t of foes) {
        if (!canBeStatus(t.u, t.st, m, sm.s, fieldFor(f, sides))) continue;
        const th = threatScore(t);
        const phys = t.u.attacks.length ? (t.u.attacks.reduce((a, b) => (b.bp > a.bp ? b : a)).c === 'f') : true;
        const val = sm.s === 'slp' ? 0.55 * th + 0.1 : sm.s === 'brn' ? (phys ? 0.4 * th : 0.08) : sm.s === 'par' ? 0.25 * th + 0.1 : 0.15 * th;
        opts.push({ type: 'status', m, targets: [t], s: sm.s, acc: sm.acc, val });
      }
    }
    // pantallas
    const scr = U.screens;
    if (scr && !(sides[me.s][{ reflect: 'reflect', lightscreen: 'lightScreen', auroraveil: 'auroraVeil' }[scr.id]] > 0) && foes.length) {
      if (scr.id !== 'auroraveil' || f.weather === 'Snow') opts.push({ type: 'screen', m: scr, val: 0.18 + 0.2 * inc });
    }
    const pick = opts.reduce((a, b) => (!a || b.val > a.val + 1e-9 ? b : a), null);
    return pick || { type: 'pass', val: 0 };
  };

  const prioOf = (a, me) => {
    if (!a.m) return 0;
    let p = a.m.pr || 0;
    if (a.type === 'protect') p = 4;
    if (a.type === 'help') p = 5;
    if (a.type === 'redirect') p = 2;
    if (a.type === 'wide') p = 3;
    if (a.type === 'speed' || a.type === 'trick') p = a.m.id === 'trickroom' ? -7 : 0;
    if (a.type !== 'atk' && me.u.ab === 'prankster') p += 1;
    if (a.type === 'atk' && me.u.ab === 'galewings' && me.st.hp >= 0.999 && a.m.t === 'flying') p += 1;
    return p;
  };

  let turns = 0;
  const teamAlive = s => sides[s].act.some(k => k >= 0 && sides[s].st[k].hp > 1e-6) || sides[s].bench.some(k => sides[s].st[k].hp > 1e-6);
  while (teamAlive(0) && teamAlive(1) && turns < 22) {
    turns++;
    const planned = { dmg: new Map(), allyDoing: [] };
    const actions = [];
    // 1) decisiones (primero el más rápido de cada bando para coordinar el fuego)
    const actors = [0, 1].flatMap(s => [0, 1].map(k => mon(s, k))).filter(alive).sort((a, b) => spd(b) - spd(a));
    for (const me of actors) {
      const a = me.st.status === 'slp' && me.st.slp > 0 ? { type: 'pass', asleep: true } : chooseAction(me, { dmg: planned.dmg, allyDoing: actions.filter(x => x.me.s === me.s).map(x => x.act) });
      if (a.type === 'atk') for (const t of a.targets) planned.dmg.set(t.st, (planned.dmg.get(t.st) || 0) + (t.s !== me.s ? damage(me.u, me.st, t.u, t.st, a.m, ctxFor(me, t, { spread: a.two })).exp : 0));
      actions.push({ me, act: a });
      if (trace && turns === 1) first.push({ side: me.s, unit: me.u, act: a });
    }
    // 2) resolución con orden dinámico (prioridad, velocidad, Espacio Raro)
    const left = actions.slice();
    const flinched = new Set(), protectedNow = new Set(), wide = [false, false], redirect = [null, null];
    const next = () => {
      let bi = -1, bk = null;
      left.forEach((x, i) => {
        if (x.me.st.hp <= 1e-6) return;
        const pr = prioOf(x.act, x.me), sp = spd(x.me) * (f.trick > 0 ? -1 : 1);
        const key = [pr, sp];
        let better = !bk || key[0] > bk[0] || (key[0] === bk[0] && key[1] > bk[1]);
        if (bk && key[0] === bk[0] && key[1] === bk[1]) better = rng ? rng() < 0.5 : (tie === 'A' ? x.me.s === 0 : x.me.s === 1);
        if (better) { bk = key; bi = i; }
      });
      return bi < 0 ? null : left.splice(bi, 1)[0];
    };
    let step;
    while ((step = next())) {
      const { me, act } = step;
      if (me.st.hp <= 1e-6) continue;
      const st = me.st, U = me.u;
      if (flinched.has(st)) continue;
      if (st.status === 'slp') { st.slp--; if (st.slp <= 0) st.status = null; if (st.slp >= 0 && st.status === 'slp') continue; }
      if (st.status === 'par' && rng && rng() < 0.25) continue;
      const parMul = st.status === 'par' && !rng ? 0.75 : 1;
      const foes = foesOf(me.s), ally = allyOf(me.s, me.k);
      st.prot = act.type === 'protect' ? st.prot + 1 : 0;
      if (act.type === 'protect') protectedNow.add(st);
      else if (act.type === 'help') { if (ally) ally.st.helped = true; }
      else if (act.type === 'redirect') redirect[me.s] = me;
      else if (act.type === 'wide') wide[me.s] = true;
      else if (act.type === 'speed') sides[me.s].tailwind = 4;
      else if (act.type === 'trick') f.trick = f.trick > 0 ? 0 : 5;
      else if (act.type === 'recover') { if (act.m.id === 'rest') { st.hp = 1; st.status = 'slp'; st.slp = 2; } else st.hp = Math.min(1, st.hp + RECOVER[act.m.id]); }
      else if (act.type === 'setup') { const S = SETUP[act.m.id]; for (const k of ['atk', 'def', 'spa', 'spd', 'spe']) if (S[k]) st.boosts[k] = Math.max(-6, Math.min(6, st.boosts[k] + S[k])); if (S.cost) st.hp -= S.cost; }
      else if (act.type === 'screen') { const k = { reflect: 'reflect', lightscreen: 'lightScreen', auroraveil: 'auroraVeil' }[act.m.id]; sides[me.s][k] = 5; }
      else if (act.type === 'status') {
        let t = act.targets[0];
        if (t.st.hp <= 1e-6) t = foesOf(me.s)[0];
        if (t && !protectedNow.has(t.st) && (rng ? rng() * 100 < act.acc : true) && canBeStatus(t.u, t.st, act.m, act.s, fieldFor(f, sides))) {
          t.st.status = act.s;
          if (act.s === 'slp') t.st.slp = rng ? 2 + Math.floor(rng() * 3) : 3;
        }
      } else if (act.type === 'atk') {
        const m = act.m;
        let targets = act.targets.filter(t => t.st.hp > 1e-6);
        if (!targets.length) {
          const re = foesOf(me.s);
          if (!act.spread && re.length) targets = [re[0]]; else continue;
        }
        if (!act.spread) {
          const rd = redirect[1 - me.s];
          if (rd && rd.st.hp > 1e-6 && targets[0] !== rd && !['propellertail', 'stalwart'].includes(U.ab)) targets = [rd];
        }
        if (act.spread && m.pr === 0 && wide[1 - me.s]) { me.st.first = false; continue; }
        if (m.pr > 0 && foes.some(x => PRIO_BLOCK.includes(x.u.ab))) { me.st.first = false; continue; }
        if ((m.id === 'fakeout' || m.id === 'firstimpression') && !st.first) { continue; }
        const two = act.spread && targets.filter(t => t.s !== me.s).length + targets.filter(t => t.s === me.s).length >= 2;
        for (const t of targets) {
          if (t.st.hp <= 1e-6) continue;
          if (protectedNow.has(t.st) && t.s !== me.s) continue;
          let dmg;
          if (rng) {
            if (m.acc < 100 && rng() * 100 >= m.acc && !['tripleaxel', 'triplekick', 'populationbomb'].includes(m.id)) continue;
            const r = damage(U, st, t.u, t.st, m, ctxFor(me, t, { spread: two }));
            const kk = r.avg > 0 ? r.exp / r.avg / (m.acc < 100 && !['tripleaxel', 'triplekick', 'populationbomb'].includes(m.id) ? m.acc / 100 : 1) : 1;
            dmg = (r.min + rng() * (r.max - r.min)) * kk * (rng() < 1 / 24 ? 1.5 : 1);
          } else dmg = damage(U, st, t.u, t.st, m, ctxFor(me, t, { spread: two })).exp * parMul;
          if (dmg <= 0) continue;
          let real = Math.min(dmg, t.st.hp);
          if ((t.st.sash && t.st.hp >= 0.999) || (t.u.ab === 'sturdy' && t.st.hp >= 0.999)) if (dmg >= t.st.hp) { real = t.st.hp - 0.01; if (t.st.sash) t.st.sash = false; }
          t.st.hp -= real;
          const abs = real * t.u.maxHP;
          if (m.recoil) st.hp -= abs * m.recoil[0] / m.recoil[1] / U.maxHP;
          if (m.drain) st.hp = Math.min(1, st.hp + abs * m.drain[0] / m.drain[1] / U.maxHP);
          if (m.contact && U.ab !== 'longreach') {
            if (t.u.item === 'rockyhelmet') st.hp -= 1 / 6;
            if (t.u.ab === 'roughskin' || t.u.ab === 'ironbarbs') st.hp -= 1 / 8;
          }
          if (m.id === 'fakeout' && t.s !== me.s && t.u.ab !== 'innerfocus' && t.u.ab !== 'shielddust') flinched.add(t.st);
          if (SPEED_DROP[m.id] && t.s !== me.s) t.st.boosts[SPEED_DROP[m.id]] = Math.max(-6, t.st.boosts[SPEED_DROP[m.id]] - 1);
          if (t.st.hp <= 1e-6) kos[t.s === 0 ? 'B' : 'A']++;
        }
        if (U.item === 'lifeorb' && U.ab !== 'magicguard') st.hp -= 0.1;
      }
      st.first = false;
    }
    // 3) fin de turno
    for (const s of [0, 1]) {
      for (const k of sides[s].act) {
        if (k < 0) continue;
        const x = sides[s].st[k], U = sides[s].us[k];
        x.helped = false;
        if (x.hp <= 1e-6) continue;
        if (f.weather === 'Sand' && !U.types.some(t => ['rock', 'ground', 'steel'].includes(t)) && !['magicguard', 'overcoat', 'sandveil', 'sandrush', 'sandforce'].includes(U.ab) && U.item !== 'safetygoggles') x.hp -= 1 / 16;
        if (U.item === 'leftovers') x.hp = Math.min(1, x.hp + 1 / 16);
        if (U.item === 'blacksludge') x.hp = U.types.includes('poison') ? Math.min(1, x.hp + 1 / 16) : x.hp - 1 / 8;
        if (f.terrain === 'Grassy' && !U.types.includes('flying')) x.hp = Math.min(1, x.hp + 1 / 16);
        if (x.status === 'brn' && U.ab !== 'magicguard') x.hp -= 1 / 16;
        if (x.status === 'psn' && U.ab !== 'magicguard') x.hp -= 1 / 8;
        if (x.status === 'tox' && U.ab !== 'magicguard') { x.tox++; x.hp -= Math.min(15, x.tox) / 16; }
        if (x.berry && x.hp > 0 && x.hp <= 0.5) { x.hp = Math.min(1, x.hp + 0.25); x.berry = false; }
        x.hp = Math.min(1, x.hp);
      }
      const sd = sides[s];
      sd.tailwind = Math.max(0, sd.tailwind - 1); sd.reflect = Math.max(0, sd.reflect - 1); sd.lightScreen = Math.max(0, sd.lightScreen - 1); sd.auroraVeil = Math.max(0, sd.auroraVeil - 1);
    }
    if (f.trick) f.trick--;
    if (f.wT) { f.wT--; if (!f.wT) f.weather = null; }
    if (f.tT) { f.tT--; if (!f.tT) f.terrain = null; }
    // 4) sustitutos de los caídos
    for (const s of [0, 1]) {
      const sd = sides[s];
      for (let q = 0; q < 2; q++) {
        const k = sd.act[q];
        if (k >= 0 && sd.st[k].hp > 1e-6) continue;
        const nx = sd.bench.findIndex(b => sd.st[b].hp > 1e-6);
        if (nx < 0) { sd.act[q] = -1; continue; }
        const b = sd.bench.splice(nx, 1)[0];
        sd.act[q] = b;
        const m = mon(s, q);
        if (m.u.ab === 'intimidate') intim(m, foesOf(s));
        const w = weatherOf(m.u.ab); if (w) { f.weather = w; f.wT = 5; }
        const tr = terrainOf(m.u.ab); if (tr) { f.terrain = tr; f.tT = 5; }
      }
    }
  }
  const total = s => sum(sides[s].st, x => Math.max(0, x.hp));
  const nA = sides[0].st.length, nB = sides[1].st.length, N = Math.max(nA, nB);
  const aAlive = teamAlive(0), bAlive = teamAlive(1);
  const v = aAlive && !bAlive ? total(0) / N : bAlive && !aAlive ? -total(1) / N : (total(0) - total(1)) / N;
  return { v, turns, first, kos, win: v > 0 ? 'A' : v < 0 ? 'B' : (tie === 'A' ? 'A' : 'B') };
}

// ───────── elección de los 4 y de los líderes ─────────
function combos(n, k) { const out = []; const rec = (s, cur) => { if (cur.length === k) { out.push(cur.slice()); return; } for (let i = s; i < n; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); } }; rec(0, []); return out; }

/** Puntuación de cada Pokémon contra el equipo rival y candidatos a estrategia (qué 4 llevar, a quiénes sacar primero) */
function candidates(Mine, Foe, K = 9) {
  const sc = Mine.map(u => {
    let off = 0, def = 0, spreadBonus = 0;
    for (const f of Foe) {
      const o = bestMove(u, f, { doubles: true });
      const d = bestMove(f, u, { doubles: true });
      off += Math.min(1, o?.avg || 0); def += Math.min(1, d?.avg || 0);
    }
    off /= Foe.length; def /= Foe.length;
    const util = (u.hasMove('fakeout') ? 0.12 : 0) + (u.moves.some(m => REDIRECT.includes(m.id)) ? 0.1 : 0) + (u.hasMove('tailwind') || u.hasMove('trickroom') ? 0.1 : 0) + (u.ab === 'intimidate' ? 0.1 : 0) + (u.hasMove('helpinghand') ? 0.04 : 0) + (u.moves.some(m => PROTECT.includes(m.id)) ? 0.03 : 0);
    return off + 0.5 * (1 - def) + util;
  });
  const typeWeak = (T) => { let pen = 0; for (const ty of TYPES18) { const w = T.filter(u => eff(ty, u.types) >= 2).length; if (w >= 3) pen += 0.25 * (w - 2); } return pen; };
  const bringScores = combos(Mine.length, Math.min(4, Mine.length)).map(c => ({ c, s: sum(c, i => sc[i]) - typeWeak(c.map(i => Mine[i])) }));
  bringScores.sort((a, b) => b.s - a.s);
  const out = [];
  for (const b of bringScores.slice(0, Math.max(3, Math.ceil(K / 2)))) {
    const order = b.c.slice().sort((x, y) => sc[y] - sc[x]);
    const leads = combos(order.length, 2).map(p => ({ p: [order[p[0]], order[p[1]]], s: sc[order[p[0]]] + sc[order[p[1]]] }));
    // los líderes se puntúan además por sinergia sencilla (Sorpresa/redirección/velocidad con un atacante)
    leads.forEach(l => { const a = Mine[l.p[0]], b2 = Mine[l.p[1]]; const sup = x => x.hasMove('fakeout') || x.moves.some(m => REDIRECT.includes(m.id)) || x.hasMove('tailwind') || x.hasMove('trickroom') || x.hasMove('helpinghand'); if ((sup(a) && !sup(b2)) || (sup(b2) && !sup(a))) l.s += 0.12; if (a.types.some(t => b2.types.includes(t))) l.s -= 0.04; });
    leads.sort((x, y) => y.s - x.s);
    for (const l of leads.slice(0, 3)) out.push({ order, leads: l.p, key: `${order.join('')}|${l.p.join('')}` });
  }
  const seen = new Set();
  return out.filter(s => (seen.has(s.key) ? false : seen.add(s.key))).slice(0, K);
}

function mulberry(seed) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }

export async function compareDoubles(A, B, { onProgress = () => {}, budgetMs = 24000 } = {}) {
  const t0 = Date.now();
  let lastTick = Date.now();
  const yieldNow = async () => { if (Date.now() - lastTick > 40) { lastTick = Date.now(); await tick(); } };
  onProgress(0.02, 'estrategias');
  const SA = candidates(A, B), SB = candidates(B, A);
  await tick();
  // 1) matriz de valores con el modo esperado (se promedian los dos órdenes en empates de velocidad)
  const V = SA.map(() => SB.map(() => 0));
  let n = 0;
  for (let i = 0; i < SA.length; i++) for (let j = 0; j < SB.length; j++) {
    const r1 = playDoubles(A, B, SA[i], SB[j], { tie: 'A' }), r2 = playDoubles(A, B, SA[i], SB[j], { tie: 'B' });
    V[i][j] = (r1.v + r2.v) / 2;
    n++; onProgress(0.05 + 0.35 * n / (SA.length * SB.length), 'líderes'); await yieldNow();
  }
  const game = solveGame(V);
  // 2) Monte Carlo
  const rng = mulberry(777);
  const pick = p => { let r = rng(), c = 0; for (let k = 0; k < p.length; k++) { c += p[k]; if (r <= c) return k; } return p.length - 1; };
  let wins = 0, trials = 0;
  const kosA = A.map(() => 0), kosB = B.map(() => 0);
  const tStart = Date.now(), MAX = 16000;
  while (trials < MAX && Date.now() - tStart < budgetMs) {
    const i = pick(game.pa), j = pick(game.pb);
    const r = playDoubles(A, B, SA[i], SB[j], { rng });
    trials++; if (r.win === 'A') wins++;
    if (trials % 8 === 0) { onProgress(0.4 + 0.5 * Math.min(1, Math.max((Date.now() - tStart) / budgetMs, trials / MAX)), 'combates'); await yieldNow(); }
  }
  const pMC = trials ? wins / trials : 0.5;
  const pExp = 1 / (1 + Math.exp(-5 * game.value));
  const wMC = Math.min(1, trials / 300);
  const pA = Math.max(0.03, Math.min(0.97, pMC * wMC + pExp * (1 - wMC)));
  // turno 1 de la mejor pareja de estrategias (para el plan)
  const bi = game.pa.indexOf(Math.max(...game.pa)), bj = game.pb.indexOf(Math.max(...game.pb));
  const trace = playDoubles(A, B, SA[bi], SB[bj], { tie: 'A', trace: true });
  const traceB = playDoubles(A, B, SA[bi], SB[bj], { tie: 'B', trace: true });
  onProgress(0.92, 'análisis');
  await tick();
  return { pA, pMC, pExp, trials, value: game.value, V, game, SA, SB, bi, bj, trace, traceB, ms: Date.now() - t0 };
}

// ───────── análisis: razones, consejos y plan de juego ─────────
const IMMUNE_AB = { levitate: 'ground', eartheater: 'ground', flashfire: 'fire', wellbakedbody: 'fire', waterabsorb: 'water', stormdrain: 'water', dryskin: 'water', voltabsorb: 'electric', lightningrod: 'electric', motordrive: 'electric', sapsipper: 'grass' };
const FIELD2 = { doubles: true };

/** Mejor ataque de `att` contra `def` en dobles (los de área cuentan con la reducción del 25 %) */
function bestMoveD(att, def) {
  const as = newState(att), ds = newState(def);
  let b = null;
  for (const m of att.attacks) {
    if (m.id === 'fakeout' || m.id === 'firstimpression') continue;
    const r = damage(att, as, def, ds, m, { field: FIELD2, spread: isSpread(m) });
    if (!b || r.exp > b.exp) b = { m, exp: r.exp, avg: r.avg, min: r.min, max: r.max };
  }
  if (!b || b.exp <= 0) return null;
  b.hits = Math.max(1, Math.ceil(1 / Math.max(b.avg, 1e-6) - 1e-9));
  b.ohko = b.min >= 1;
  return b;
}
const SUPPORT_IDS = [...PROTECT.slice(0, 0), 'fakeout', 'tailwind', 'trickroom', 'helpingHand'.toLowerCase(), ...REDIRECT, 'icywind', 'electroweb', 'snarl', 'wideguard', 'quickguard'];
const isSupport = u => u.ab === 'intimidate' || u.moves.some(m => SUPPORT_IDS.includes(m.id));
const controlCount = T => sum(T, u => (u.moves.some(m => ['fakeout', 'tailwind', 'trickroom'].includes(m.id) || REDIRECT.includes(m.id)) || u.ab === 'intimidate' ? 1 : 0));
const spreadCount = T => sum(T, u => (u.attacks.some(m => isSpread(m) && m.bp >= 70) ? 1 : 0));

/** Duelo rápido por daño entre dos Pokémon en dobles: de -1 (pierde) a 1 (gana) */
export function pairScore(a, b) {
  const x = bestMoveD(a, b)?.avg || 0, y = bestMoveD(b, a)?.avg || 0;
  const sa = speedOf(newState(a)), sb = speedOf(newState(b));
  const ta = x >= 1e-6 ? Math.min(6, Math.ceil(1 / x - 1e-9)) : 9, tb = y >= 1e-6 ? Math.min(6, Math.ceil(1 / y - 1e-9)) : 9;
  const turnA = ta - (sa > sb ? 0.5 : 0), turnB = tb - (sb > sa ? 0.5 : 0);
  return Math.max(-1, Math.min(1, (turnB - turnA) / 3));
}

export function analyzeDoubles(A, B, res) {
  const { pA, game, SA, SB } = res;
  const win = pA >= 0.5 ? 'A' : 'B', pct = Math.round(Math.max(pA, 1 - pA) * 100), margin = pct - 50;
  const nA = A.length, nB = B.length, pairs = nA * nB;
  // matriz de 1 contra 1 por daño (para el cuadro y las estrellas)
  const mx = A.map(a => B.map(b => ({ s: pairScore(a, b) })));
  const Mb = B.map((_, j) => A.map((_, i) => -mx[i][j].s));
  const rowA = A.map((u, i) => ({ u, wins: sum(mx[i], c => (c.s > 0.001 ? 1 : 0)), score: mean(mx[i].map(c => c.s)) }));
  const rowB = B.map((u, j) => ({ u, wins: sum(mx, r => (r[j].s < -0.001 ? 1 : 0)), score: mean(mx.map(r => -r[j].s)) }));
  const W = win === 'A' ? A : B, L = win === 'A' ? B : A, Wrow = win === 'A' ? rowA : rowB;
  const reasons = [];
  const fs = u => speedOf(newState(u), {});
  const fasterA = sum(A, a => sum(B, b => (fs(a) > fs(b) ? 1 : 0))), fasterB = sum(B, b => sum(A, a => (fs(b) > fs(a) ? 1 : 0)));
  const fW = (win === 'A' ? fasterA : fasterB) / pairs, fL = (win === 'A' ? fasterB : fasterA) / pairs;
  if (fW - fL >= 0.16) reasons.push({ key: 'speed', strength: (fW - fL) * 1.2, vars: { k: Math.round(fW * 100) } });
  const cW = controlCount(W), cL = controlCount(L);
  if (cW - cL >= 1) reasons.push({ key: 'control', strength: 0.3 + 0.12 * (cW - cL), vars: { k: cW } });
  const sW = spreadCount(W), sL = spreadCount(L);
  if (sW - sL >= 2) reasons.push({ key: 'spread', strength: 0.25 + 0.06 * (sW - sL), vars: { k: sW } });
  const tcount = (X, Y) => sum(Y, y => (X.some(x => (bestMoveD(x, y)?.avg || 0) >= 0.45) ? 1 : 0));
  const tW = tcount(W, L), tL = tcount(L, W);
  if (tW / L.length - tL / W.length >= 0.2) reasons.push({ key: 'cover', strength: (tW / L.length - tL / W.length) * 1.3, vars: { k: tW, n: L.length } });
  const ohko = (X, Y) => sum(Y, y => (X.some(x => bestMoveD(x, y)?.ohko) ? 1 : 0));
  if (ohko(W, L) - ohko(L, W) >= 2) reasons.push({ key: 'ohko', strength: 0.3 + 0.07 * (ohko(W, L) - ohko(L, W)), vars: { k: ohko(W, L), n: L.length } });
  const star = [...Wrow].sort((a, b) => b.wins - a.wins || b.score - a.score)[0];
  if (star && star.wins / L.length >= 0.6) reasons.push({ key: 'star', strength: (star.wins / L.length) * 0.85, vars: { name: star.u.name, k: star.wins, n: L.length } });
  const weakCount = TYPES18.map(ty => ({ ty, ws: L.filter(u => eff(ty, u.types) >= 2 && IMMUNE_AB[u.ab] !== ty) }));
  const sharedW = weakCount.filter(w => w.ws.length >= 3 && W.some(u => u.types.includes(w.ty) || u.moves.some(m => m.t === w.ty && m.c !== 's' && m.bp >= 60))).sort((a, b) => b.ws.length - a.ws.length)[0];
  if (sharedW) reasons.push({ key: 'weak', strength: (sharedW.ws.length / L.length) * 1.1, vars: { type: sharedW.ty, k: sharedW.ws.length, n: L.length } });
  const foeIntim = sum(L, u => (u.ab === 'intimidate' ? 1 : 0)), myIntim = sum(W, u => (u.ab === 'intimidate' ? 1 : 0));
  if (myIntim - foeIntim >= 1 && sum(L, u => (u.p.s[1] >= u.p.s[3] ? 1 : 0)) >= L.length / 2) reasons.push({ key: 'intim', strength: 0.3, vars: {} });
  reasons.sort((a, b) => b.strength - a.strength);
  const top = reasons.filter(r => r.strength >= 0.18).slice(0, margin < 8 ? 1 : margin < 18 ? 2 : 3);

  // probabilidad con la que cada Pokémon entra en el equipo de 4 y cada pareja sale de líder
  const probs = (S, pr, n) => {
    const bring = new Array(n).fill(0), pair = new Map();
    S.forEach((st, k) => { st.order.forEach(i => { bring[i] += pr[k]; }); const key = st.leads.slice().sort().join('-'); pair.set(key, (pair.get(key) || 0) + pr[k]); });
    return { bring, pair };
  };
  const pa = probs(SA, game.pa, nA), pb = probs(SB, game.pb, nB);
  const accion = (act, mon, me, foe) => {
    const tgt = act.targets?.length === 1 && act.targets[0].s !== undefined ? act.targets[0] : null;
    return { mine: me.indexOf(mon), type: act.type, move: act.m ? { id: act.m.id, name: act.m.name, es: act.m.es, t: act.m.t } : null, target: tgt && tgt.s !== undefined ? foe.indexOf(tgt.u) : null, spread: !!act.spread };
  };
  const turn1 = (tr, side, me, foe) => tr.first.filter(x => x.side === side).map(x => accion(x.act, x.unit, me, foe));
  const planFor = (Mine, Foe, S, gp, prSelf, prFoe, side) => {
    const si = gp.indexOf(Math.max(...gp));
    const st = S[si];
    const foeBring = prFoe.bring;
    const leadPairs = [...prSelf.pair.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, p]) => ({ i: k.split('-').map(Number), p }));
    const foePairs = [...prFoe.pair.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, p]) => ({ j: k.split('-').map(Number), p }));
    const bring = st.order.map(i => i);
    const t1 = side === 'A' ? turn1(res.trace, 0, Mine, Foe) : turn1(res.trace, 1, Mine, Foe);
    // ataques en los que fijarse, ponderados por la probabilidad de que el rival lleve a cada Pokémon
    const focus = Mine.map((u, i) => {
      const rows = Foe.map((f, j) => ({ foe: j, w: Math.max(0.05, foeBring[j]), mv: bestMoveD(u, f) }));
      const counts = new Map();
      rows.forEach(r => { if (r.mv) counts.set(r.mv.m.id, (counts.get(r.mv.m.id) || 0) + r.w * Math.min(1, r.mv.avg * 2)); });
      const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      const targets = rows.filter(r => r.mv && r.mv.avg >= 0.3).sort((a, b) => b.w * b.mv.avg - a.w * a.mv.avg).slice(0, 4).map(r => ({ foe: r.foe, move: r.mv.m, pct: Math.round(r.mv.avg * 100), hits: r.mv.hits, ohko: r.mv.ohko }));
      const useless = rows.filter(r => !r.mv || r.mv.avg < 0.12).map(r => r.foe);
      return { mine: i, main: main ? u.moves.find(m => m.id === main[0]) : null, targets, useless };
    });
    return { bring, leads: leadPairs, foeLeads: foePairs, foeBring: foeBring.map((p, j) => ({ j, p })).sort((a, b) => b.p - a.p), turn1: t1, focus, bringProb: prSelf.bring };
  };
  const planA = planFor(A, B, SA, game.pa, pa, pb, 'A');
  const planB = planFor(B, A, SB, game.pb, pb, pa, 'B');

  // consejos
  const tipsFor = (T, O, Trow, side) => {
    const tips = [];
    const weaks = TYPES18.map(ty => ({ ty, ws: T.filter(u => eff(ty, u.types) >= 2 && IMMUNE_AB[u.ab] !== ty) })).filter(w => w.ws.length >= 3).sort((a, b) => b.ws.length - a.ws.length);
    if (weaks[0]) tips.push({ key: 'weak', sev: weaks[0].ws.length, vars: { type: weaks[0].ty, k: weaks[0].ws.length }, resist: weaks[0].ty });
    if (!T.some(u => u.hasMove('fakeout'))) tips.push({ key: 'nofake', sev: 3, vars: {}, ids: ['incineroar', 'rillaboom', 'ambipom', 'sneasler', 'mienshao'] });
    if (!T.some(u => u.hasMove('tailwind') || u.hasMove('trickroom'))) tips.push({ key: 'nospeed', sev: 3, vars: {}, ids: ['tornadus', 'whimsicott', 'talonflame', 'hatterene', 'cresselia'] });
    if (!T.some(u => u.ab === 'intimidate') && sum(O, u => (u.p.s[1] >= u.p.s[3] ? 1 : 0)) >= 3) tips.push({ key: 'nointim', sev: 3, vars: {}, ids: ['incineroar', 'landorustherian', 'gyarados', 'arcanine', 'salamence'] });
    const oFast = Math.max(...O.map(fs)), myFast = Math.max(...T.map(fs));
    if (myFast < oFast * 0.97 && !T.some(u => u.hasMove('trickroom') || u.hasMove('tailwind'))) tips.push({ key: 'speed', sev: 4, vars: { mine: myFast, theirs: oFast } });
    const weakest = [...Trow].sort((a, b) => a.score - b.score)[0];
    if (weakest && weakest.score < -0.2 && T.length >= 4) tips.push({ key: 'weakest', sev: 3 + Math.round(-weakest.score * 2), vars: { name: weakest.u.name, k: weakest.wins, n: O.length }, replace: weakest.u.id });
    const uncovered = O.filter(o => !T.some(u => (bestMoveD(u, o)?.avg || 0) >= 0.35));
    if (uncovered.length >= 2) tips.push({ key: 'uncovered', sev: 2 + uncovered.length, vars: { list: uncovered.slice(0, 3).map(u => u.name), k: uncovered.length } });
    // fuego amigo: terremoto y similares junto a compañeros que no los resisten
    const hurt = T.filter(u => u.attacks.some(m => m.tg === 'allAdjacent' && m.bp >= 70)).filter(u => T.some(o => o !== u && eff(u.attacks.find(m => m.tg === 'allAdjacent' && m.bp >= 70).t, o.types) >= 1 && IMMUNE_AB[o.ab] !== u.attacks.find(m => m.tg === 'allAdjacent' && m.bp >= 70).t && o.item !== 'airballoon' && !(o.types.includes('flying') && u.attacks.find(m => m.tg === 'allAdjacent' && m.bp >= 70).t === 'ground')));
    if (hurt.length >= 2) tips.push({ key: 'friendly', sev: 2, vars: { name: hurt[0].name } });
    tips.sort((a, b) => b.sev - a.sev);
    return tips.slice(0, side === 'loser' ? 4 : 2);
  };
  const tipsA = tipsFor(A, B, rowA, pA < 0.5 ? 'loser' : 'winner');
  const tipsB = tipsFor(B, A, rowB, pA >= 0.5 ? 'loser' : 'winner');
  const speeds = [...A.map(u => ({ u, side: 'A', spe: fs(u) })), ...B.map(u => ({ u, side: 'B', spe: fs(u) }))].sort((a, b) => b.spe - a.spe);
  speeds.forEach(x => { x.u.spe = x.spe; });
  const factors = {
    duels: mean(mx.flat().map(c => c.s)), speed: 0.35 * ((fasterA - fasterB) / pairs),
    hazards: 0.08 * (controlCount(A) - controlCount(B)),
    support: 0.05 * (Math.min(3, spreadCount(A)) - Math.min(3, spreadCount(B))),
  };
  return {
    mode: 'doubles', pA, win, pct, close: margin < 6, matrix: mx, rowA, rowB, reasons: top, tipsA, tipsB, speeds, factors,
    plan: { A: planA, B: planB }, trials: res.trials, ms: res.ms,
  };
}
