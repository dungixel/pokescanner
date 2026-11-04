import {
  TYPES, TYPE_ES, TYPE_COLOR, STATS, STAT_ES, CATEGORY, TIER, TIER_ORDER, FORMAT_NAME,
  esc, fold, dexNum, fmtNum, store, matchups, bst, statColor, tierLabel, tierColor,
  pokeImg, itemImg, typeIcon, typePill, typeDot, catIcon,
} from './util.js';

const $app = document.getElementById('app');
const sheet = document.getElementById('sheet');
const toastEl = document.getElementById('toast');

let INDEX = [];
let BYID = new Map();
let DICT = null;
const cache = new Map();

const favs = new Set(JSON.parse(store.get('pk.favs') || '[]'));
const saveFavs = () => store.set('pk.favs', JSON.stringify([...favs]));

const state = {
  view: 'home', q: '', sort: 'num', dir: 1, types: [], tiers: [], favs: false, base: false,
  shown: 40, scroll: 0, randomMode: 'daily', randoms: null, filtersOpen: false,
};
let page = null; // estado de la ficha abierta
let cmp = null;  // estado del comparador
let io = null;   // IntersectionObserver de la lista

// ───────────────────────── Iconos ─────────────────────────
const I = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.8 6.8 0 0 0 9.7 9.7z"/></svg>',
  compare: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 4v15M6 13l6 6 6-6"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
};
const themeIcon = () => (currentTheme() === 'dark' ? I.sun : I.moon);
const themeBtn = () => `<button class="iconbtn" data-act="theme" aria-label="Cambiar entre modo claro y oscuro">${themeIcon()}</button>`;

// ───────────────────────── Tema ─────────────────────────
function currentTheme() {
  return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store.set('pk.theme', next);
  document.querySelectorAll('[data-act="theme"]').forEach(b => { b.innerHTML = themeIcon(); });
}

// ───────────────────────── Datos ─────────────────────────
async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
const getDict = () => (DICT ? Promise.resolve(DICT) : getJSON('data/dict.json').then(d => (DICT = d)));
/** Las fichas viajan en paquetes de 60 Pokémon (data/pokemon/<k>.json); se piden una vez y se reutilizan */
async function getPokemon(id) {
  const k = BYID.get(id).k;
  if (!cache.has(k)) cache.set(k, getJSON(`data/pokemon/${k}.json`));
  return (await cache.get(k))[id];
}

// ───────────────────────── Utilidades UI ─────────────────────────
const $ = (s, r = document) => r.querySelector(s);
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove('on'), 2200);
}
/** Dispara la animación de las barras: se parte de 0 y se añade .go en el siguiente frame */
function animate(el) {
  if (!el) return;
  el.classList.remove('go');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('go')));
}
const statOf = (p, k) => (k === 'bst' ? bst(p.s) : p.s[STATS.indexOf(k)]);
const footerHTML = () => `<footer class="sitefoot">
  Datos de <a href="https://pokemonshowdown.com" target="_blank" rel="noopener">Pokémon Showdown</a> y los sets de
  <a href="https://www.smogon.com/dex/sv/pokemon/" target="_blank" rel="noopener">Smogon</a>; nombres y descripciones en español de
  <a href="https://pokeapi.co" target="_blank" rel="noopener">PokeAPI</a>. Proyecto de fans sin relación con Nintendo, Game Freak ni The Pokémon Company.
</footer>`;

// Imágenes: si una falla, se prueba la siguiente de la cadena (data-fb)
document.addEventListener('error', e => {
  const t = e.target;
  if (!(t instanceof HTMLImageElement)) return;
  const fb = t.dataset.fb;
  if (fb) {
    const [next, ...rest] = fb.split('|');
    if (rest.length) t.dataset.fb = rest.join('|'); else delete t.dataset.fb;
    t.src = next;
  } else t.classList.add('missing');
}, true);

// ───────────────────────── Ventanitas ─────────────────────────
function openSheet(title, body, { wide = false } = {}) {
  sheet.className = wide ? 'wide' : '';
  sheet.innerHTML = `<div class="sheet-inner">
    <div class="sheet-head"><h2>${esc(title)}</h2><button class="iconbtn" data-act="close" aria-label="Cerrar">${I.close}</button></div>
    <div class="sheet-body">${body}</div></div>`;
  if (!sheet.open) sheet.showModal();
  document.documentElement.classList.add('locked');
  $('.sheet-body', sheet).scrollTop = 0;
}
function closeSheet() { if (sheet.open) sheet.close(); }
sheet.addEventListener('close', () => document.documentElement.classList.remove('locked'));
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });

function moveSheet(id) {
  const m = DICT.moves[id];
  if (!m) return;
  openSheet(m.n, `
    <div class="lead">${typePill(m.t)}<span class="chip small ghost">${catIcon(m.c)} ${CATEGORY[m.c]}</span></div>
    <div class="kv">
      <div><b>${m.p || '—'}</b><small>Potencia</small></div>
      <div><b>${m.a ? m.a + '%' : '—'}</b><small>Precisión</small></div>
      <div><b>${m.pp || '—'}</b><small>PP</small></div>
      <div><b>${m.pr > 0 ? '+' + m.pr : m.pr}</b><small>Prioridad</small></div>
    </div>
    <p>${esc(m.d) || '<span class="dim">Sin descripción.</span>'}</p>
    ${m.e && m.e !== m.n ? `<p class="dim">En inglés: ${esc(m.e)}</p>` : ''}`);
}
function abilitySheet(id) {
  const a = DICT.abilities[id];
  if (!a) return;
  openSheet(a.n, `<p>${esc(a.d) || '<span class="dim">Sin descripción.</span>'}</p>${a.e !== a.n ? `<p class="dim">En inglés: ${esc(a.e)}</p>` : ''}`);
}
function itemSheet(id) {
  const it = DICT.items[id];
  if (!it) return;
  openSheet(it.n, `
    <div class="lead">${it.i ? itemImg(it, 'big') : ''}<div><b>${esc(it.n)}</b>${it.e !== it.n ? `<div class="dim">${esc(it.e)}</div>` : ''}</div></div>
    <p>${esc(it.d) || ''}</p>`);
}
function natureSheet(id) {
  const n = DICT.natures[id];
  if (!n) return;
  const body = n.plus
    ? `<div class="lead"><span class="chip small" style="color:var(--ok)">▲ ${STAT_ES[n.plus]}</span><span class="chip small" style="color:var(--bad)">▼ ${STAT_ES[n.minus]}</span></div>
       <p>Sube un 10 % ${STAT_ES[n.plus]} y baja un 10 % ${STAT_ES[n.minus]}.</p>`
    : '<p>Naturaleza neutra: no sube ni baja ninguna característica.</p>';
  openSheet(n.n, body + (n.e !== n.n ? `<p class="dim">En inglés: ${esc(n.e)}</p>` : ''));
}
function tierSheet(r) {
  const t = TIER[r];
  const name = t ? t.n : r;
  openSheet(`Rango ${tierLabel(r)}`, `
    <div class="lead"><span class="tier" style="--tier:${tierColor(r)}">${esc(tierLabel(r))}</span><b>${esc(name)}</b></div>
    <p>${esc(t?.d || 'Rango competitivo de Pokémon Showdown.')}</p>
    <button class="chip accent" data-act="tier-go" data-v="${esc(r)}">Ver Pokémon de este rango</button>`);
}

// ───────────────────────── Router ─────────────────────────
function route() {
  closeSheet();
  if (state.view === 'home') state.scroll = window.scrollY;
  const m = location.hash.match(/^#\/pokemon\/([a-z0-9]+)/);
  if (m) renderPokemon(m[1]); else renderHome();
}

// ───────────────────────── Inicio ─────────────────────────
const SORTS = [['num', 'Nº'], ['hp', 'PS'], ['atk', 'Ataque'], ['def', 'Defensa'], ['spa', 'At. Esp.'], ['spd', 'Def. Esp.'], ['spe', 'Velocidad'], ['bst', 'Total']];

function homeHTML() {
  const chip = (attrs, inner, extra = '') => `<button class="chip ${extra}" ${attrs} aria-pressed="false">${inner}</button>`;
  return `
  <div class="topline">${themeBtn()}</div>
  <header class="hero">
    <h1>PokeScanner</h1>
    <p>La Pokédex competitiva en español: estadísticas, rangos y builds de Smogon.</p>
  </header>
  <div class="search">
    ${I.search}
    <input id="q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"
      placeholder="Busca por nombre o número" aria-label="Buscar Pokémon" value="${esc(state.q)}">
    <button class="clear" data-act="clear-q" aria-label="Borrar búsqueda">${I.close}</button>
  </div>
  <div class="ftoggle">
    <button class="chip" data-act="filters-toggle" aria-expanded="false" aria-controls="fpanel">
      <svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>
      Filtros <span class="badge" id="fbadge"></span>
      <svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
    </button>
  </div>
  <div class="fpanel" id="fpanel"><div class="fpanel-in">
  <section class="filters" id="filters" aria-label="Filtros">
    <div class="frow"><span>Ordenar por</span><div class="scroller">${SORTS.map(([k, l]) => chip(`data-act="sort" data-v="${k}"`, `${l}<span class="dir"></span>`)).join('')}</div></div>
    <div class="frow"><span>Tipo</span><div class="scroller">${TYPES.map(t => chip(`data-act="type" data-v="${t}"`, `${typeIcon(t)}${TYPE_ES[t]}`)).join('')}</div></div>
    <div class="frow"><span>Rango (tier)</span><div class="scroller">${TIER_ORDER.map(r => chip(`data-act="tier-f" data-v="${r}"`, tierLabel(r))).join('')}</div></div>
    <div class="frow"><span>Mostrar</span><div class="scroller">
      ${chip('data-act="flag" data-v="favs"', `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z"/></svg>Favoritos <small class="favn"></small>`)}
      ${chip('data-act="flag" data-v="base"', 'Solo formas base')}
    </div></div>
  </section>
  </div></div>
  <div id="results"></div>
  ${footerHTML()}`;
}

function syncFilters() {
  const f = $('#filters');
  if (!f) return;
  f.querySelectorAll('[data-act="sort"]').forEach(b => {
    const on = b.dataset.v === state.sort;
    b.setAttribute('aria-pressed', on);
    $('.dir', b).textContent = on && (state.sort !== 'num' || state.dir !== 1) ? (state.dir === -1 ? '↓' : '↑') : '';
  });
  f.querySelectorAll('[data-act="type"]').forEach(b => b.setAttribute('aria-pressed', state.types.includes(b.dataset.v)));
  f.querySelectorAll('[data-act="tier-f"]').forEach(b => b.setAttribute('aria-pressed', state.tiers.includes(b.dataset.v)));
  f.querySelectorAll('[data-act="flag"]').forEach(b => b.setAttribute('aria-pressed', !!state[b.dataset.v]));
  const n = $('.favn', f);
  if (n) n.textContent = favs.size ? `(${favs.size})` : '';
  $('.search .clear')?.classList.toggle('on', !!state.q);
  // el botón "Filtros" muestra cuántos hay activos y abre/cierra el panel
  const active = state.types.length + state.tiers.length + (state.favs ? 1 : 0) + (state.base ? 1 : 0) + (state.sort !== 'num' || state.dir !== 1 ? 1 : 0);
  $('#fbadge').textContent = active || '';
  $('[data-act="filters-toggle"]').setAttribute('aria-expanded', state.filtersOpen);
  $('#fpanel').classList.toggle('open', state.filtersOpen);
  f.inert = !state.filtersOpen;
}

const isFiltering = () => !!fold(state.q) || state.types.length || state.tiers.length || state.favs || state.base || state.sort !== 'num' || state.dir !== 1;

function compute() {
  const q = fold(state.q);
  let list = INDEX;
  if (state.favs) list = list.filter(p => favs.has(p.id));
  if (state.base) list = list.filter(p => !p.fm);
  if (state.types.length) list = list.filter(p => state.types.every(t => p.t.includes(t)));
  if (state.tiers.length) list = list.filter(p => state.tiers.includes(p.r));
  let scored = list.map(p => ({ p, sc: 0 }));
  if (q) scored = searchScored(q, list);
  const byStat = state.sort !== 'num';
  scored.sort((a, b) => {
    if (byStat) return (statOf(a.p, state.sort) - statOf(b.p, state.sort)) * state.dir || a.p.num - b.p.num;
    return a.sc - b.sc || (a.p.num - b.p.num) * state.dir;
  });
  return scored.map(s => s.p);
}
function searchScored(q, list) {
  const isNum = /^\d+$/.test(q);
  const typeHits = q.length >= 3 ? TYPES.filter(t => fold(TYPE_ES[t]).startsWith(q)) : [];
  const out = [];
  for (const p of list) {
    p.fs ??= fold(p.es); p.fe ??= fold(p.en);
    let sc = -1;
    if (isNum) { if (String(p.num) === String(Number(q))) sc = 0; }
    if (sc < 0) {
      if (p.fs.startsWith(q) || p.fe.startsWith(q)) sc = 0;
      else if (p.fs.includes(q) || p.fe.includes(q)) sc = 1;
      else if (typeHits.some(t => p.t.includes(t))) sc = 3;
    }
    if (sc >= 0) out.push({ p, sc });
  }
  return out;
}

function tierBadge(r, extra = '') { return `<span class="tier" style="--tier:${tierColor(r)}" ${extra}>${esc(tierLabel(r))}</span>`; }

function rowHTML(p) {
  const showStat = state.sort !== 'num';
  return `<a class="row" href="#/pokemon/${p.id}" style="--c:${TYPE_COLOR[p.t[0]]}">
    ${pokeImg(p, 'small')}
    <span class="meta"><b>${esc(p.es)}</b><small>${dexNum(p.num)}${p.fm && p.es !== p.en ? ` · ${esc(p.en)}` : ''}</small><span class="types">${p.t.map(typeDot).join('')}</span></span>
    <span class="side">
      ${showStat ? `<span class="statval">${statOf(p, state.sort)}<small>${STAT_ES[state.sort]}</small></span>` : tierBadge(p.r)}
    </span></a>`;
}
function cardHTML(p) {
  return `<a class="card" href="#/pokemon/${p.id}" style="--c:${TYPE_COLOR[p.t[0]]}">
    ${pokeImg(p, 'art')}
    <span class="num">${dexNum(p.num)}</span><b>${esc(p.es)}</b>
    <span class="foot"><span class="types">${p.t.map(typeDot).join('')}</span>${tierBadge(p.r)}</span></a>`;
}

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickRandoms(daily) {
  const pool = INDEX.filter(p => p.r !== 'LC' && p.r !== 'NFE');
  const d = new Date();
  const rnd = daily ? mulberry(d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) : Math.random;
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, 6).map(p => p.id);
}

function renderResults(reset = true) {
  const box = $('#results');
  if (!box) return;
  io?.disconnect();
  if (reset) state.shown = 40;
  syncFilters();

  if (!isFiltering()) {
    state.randoms ??= pickRandoms(true);
    box.innerHTML = `
      <div class="block-title"><h2>${state.randomMode === 'daily' ? 'Pokémon del día' : 'Pokémon al azar'}</h2>
        <button class="chip small" data-act="shuffle">${'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>'}Otros al azar</button></div>
      <div class="cards">${state.randoms.map(id => cardHTML(BYID.get(id))).join('')}</div>`;
    return;
  }

  const list = (state.list = compute());
  const head = `<div class="block-title"><h2>${list.length} ${list.length === 1 ? 'resultado' : 'resultados'}</h2>
    <button class="chip small ghost" data-act="reset">Limpiar filtros</button></div>`;
  if (!list.length) {
    box.innerHTML = head + `<div class="empty"><b>No hay Pokémon con esos filtros</b>${state.favs && !favs.size ? 'Aún no has marcado ningún favorito: pulsa la estrella en la ficha de un Pokémon.' : 'Prueba a quitar algún filtro o a cambiar la búsqueda.'}</div>`;
    return;
  }
  box.innerHTML = head + `<div class="list">${list.slice(0, state.shown).map(rowHTML).join('')}</div><div class="sentinel"></div>`;
  watchSentinel();
}
function watchSentinel() {
  const s = $('.sentinel');
  if (!s || state.shown >= state.list.length) return;
  io = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    const from = state.shown;
    state.shown = Math.min(state.shown + 40, state.list.length);
    $('.list')?.insertAdjacentHTML('beforeend', state.list.slice(from, state.shown).map(rowHTML).join(''));
    if (state.shown >= state.list.length) io.disconnect();
  }, { rootMargin: '700px 0px' });
  io.observe(s);
}

function renderHome() {
  state.view = 'home';
  document.title = 'PokeScanner';
  $app.innerHTML = homeHTML();
  document.documentElement.style.removeProperty('--accent');
  renderResults(false); // al volver desde una ficha se conserva cuántos resultados había cargados
  window.scrollTo(0, state.scroll || 0);
}

// ───────────────────────── Ficha ─────────────────────────
function statsHTML(s) {
  const rows = STATS.map((k, i) => `<div class="stat"><span class="k">${STAT_ES[k]}</span><span class="v">${s[i]}</span>
    <div class="bar"><i style="--w:${Math.min(100, s[i] / 255 * 100).toFixed(1)}%;--bc:${statColor(s[i])};--i:${i}"></i></div></div>`).join('');
  return `<div class="stats">${rows}<div class="stat total"><span class="k">Total</span><span class="v">${bst(s)}</span><div class="bar"></div></div></div>`;
}

const chipMove = (id, alt = false) => {
  const m = DICT.moves[id];
  return `<button class="mv ${alt ? 'alt' : ''}" style="--tc:${TYPE_COLOR[m.t]}" data-act="move" data-v="${id}">${typeIcon(m.t)}${esc(m.n)}</button>`;
};
const chipAbility = id => `<button class="chip" data-act="ability" data-v="${id}">${esc(DICT.abilities[id].n)}</button>`;
const chipItem = id => `<button class="chip" data-act="item" data-v="${id}">${itemImg(DICT.items[id])}${esc(DICT.items[id].n)}</button>`;
const chipNature = id => {
  const n = DICT.natures[id];
  return `<button class="chip" data-act="nature" data-v="${id}">${esc(n.n)}${n.plus ? ` <small>+${STAT_ES[n.plus]} −${STAT_ES[n.minus]}</small>` : ' <small>neutra</small>'}</button>`;
};

function buildHTML() {
  const { d, fmt, idx } = page;
  if (!d.sets.length) return '<p class="hint">Smogon todavía no tiene sets para este Pokémon.</p>';
  const formats = [...new Set(d.sets.map(s => s.f))];
  const sets = d.sets.filter(s => s.f === fmt);
  const set = sets[idx] || sets[0];
  const tabs = (items, attr, active) => `<div class="scroller" role="tablist">${items.map(([v, l]) =>
    `<button class="chip small" role="tab" data-act="${attr}" data-v="${esc(v)}" aria-selected="${String(v) === String(active)}">${esc(l)}</button>`).join('')}</div>`;
  const evs = Object.entries(set.ev || {});
  return `
    ${formats.length > 1 ? tabs(formats.map(f => [f, FORMAT_NAME[f] || f]), 'fmt', fmt) : `<span class="hint">Formato ${esc(FORMAT_NAME[fmt] || fmt)}</span>`}
    ${sets.length > 1 ? `<div style="margin-top:8px">${tabs(sets.map((s, i) => [i, s.n]), 'set', idx)}</div>` : ''}
    <div class="build">
      <div><h3>Movimientos</h3><ul class="slots">${set.m.map(slot => `<li class="slot">${chipMove(slot[0])}${slot.length > 1 ? `<span class="or">o</span>${slot.slice(1).map(id => chipMove(id, true)).join('')}` : ''}</li>`).join('')}</ul></div>
      ${set.a.length ? `<div><h3>Habilidad</h3><div class="chips">${set.a.map(chipAbility).join('')}</div></div>` : ''}
      ${set.i.length ? `<div><h3>Objeto</h3><div class="chips">${set.i.map(chipItem).join('')}</div></div>` : ''}
      ${set.na.length ? `<div><h3>Naturaleza</h3><div class="chips">${set.na.map(chipNature).join('')}</div></div>` : ''}
      ${evs.length ? `<div><h3>EVs</h3><div class="evs">${evs.map(([k, v]) => `<span class="ev"><b>${v}</b> ${STAT_ES[k]}</span>`).join('')}</div></div>` : ''}
      ${set.te.length ? `<div><h3>Teratipo</h3><div class="chips">${set.te.map(typePill).join('')}</div></div>` : ''}
      <div class="actions"><button class="chip" data-act="copy">${I.copy.replace('<svg', '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"')}Copiar para Showdown</button></div>
    </div>`;
}

function showdownText() {
  const { d, fmt, idx } = page;
  const sets = d.sets.filter(s => s.f === fmt);
  const set = sets[idx] || sets[0];
  const it = set.i[0] && set.i[0] !== 'noitem' ? DICT.items[set.i[0]] : null;
  const EV = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
  const lines = [`${d.en}${it ? ` @ ${it.e}` : ''}`];
  if (set.a[0]) lines.push(`Ability: ${DICT.abilities[set.a[0]].e}`);
  if (set.te[0]) lines.push(`Tera Type: ${set.te[0][0].toUpperCase()}${set.te[0].slice(1)}`);
  const evs = Object.entries(set.ev || {});
  if (evs.length) lines.push(`EVs: ${evs.map(([k, v]) => `${v} ${EV[k]}`).join(' / ')}`);
  if (set.na[0]) lines.push(`${DICT.natures[set.na[0]].e} Nature`);
  set.m.forEach(slot => lines.push(`- ${DICT.moves[slot[0]].e}`));
  return lines.join('\n');
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* sin portapapeles */ }
    ta.remove();
  }
  toast('Set copiado: pégalo en el teambuilder de Showdown');
}

function weaknessHTML(types) {
  const m = matchups(types);
  const rows = [['4', '×4', 'w'], ['2', '×2', 'w'], ['0.5', '×½', 'r'], ['0.25', '×¼', 'r'], ['0', '×0', 'i']]
    .filter(([k]) => m[k]?.length)
    .map(([k, l, c]) => `<div class="mx-row ${c}"><b>${l}</b><div class="chips">${m[k].map(typePill).join('')}</div></div>`);
  return `<div class="mx">${rows.join('')}</div><p class="hint" style="margin-top:10px">Solo cuenta los tipos; no incluye habilidades como Levitación.</p>`;
}

const countNodes = n => 1 + (n.c || []).reduce((a, c) => a + countNodes(c), 0);
function evoHTML(node, curId) {
  const p = BYID.get(node.id);
  if (!p) return '';
  let h = `<a class="evo-card ${node.id === curId ? 'current' : ''}" href="#/pokemon/${p.id}" ${node.id === curId ? 'aria-current="page"' : ''}>
    ${pokeImg(p, 'small')}<span><b>${esc(p.es)}</b><small>${dexNum(p.num)}</small><span class="types" style="display:flex;gap:4px;margin-top:4px">${p.t.map(typeDot).join('')}</span></span></a>`;
  const kids = (node.c || []).filter(c => BYID.has(c.id));
  if (kids.length) {
    h += `<div class="evo-kids">${kids.map(c => `<div class="evo-link">${I.down}<span>${esc(c.how)}</span></div>${evoHTML(c, curId)}`).join('')}</div>`;
  }
  return h;
}

function levelMovesHTML(expanded) {
  const lv = page.d.lv;
  const LIMIT = 14;
  const rows = (expanded ? lv : lv.slice(0, LIMIT)).map(([l, id]) => {
    const m = DICT.moves[id];
    return `<li><button class="lm" style="--tc:${TYPE_COLOR[m.t]}" data-act="move" data-v="${id}">
      <span class="l">${l === 0 ? '<b>Evo</b>' : `Nv <b>${l}</b>`}</span>${typeIcon(m.t)}<span class="n">${esc(m.n)}</span>${catIcon(m.c)}<span class="pw">${m.p ? m.p : '—'}</span></button></li>`;
  }).join('');
  return `<ul class="lvl">${rows}</ul>${!expanded && lv.length > LIMIT ? `<button class="chip more" data-act="more">Ver los ${lv.length} movimientos</button>` : ''}`;
}

function pokemonHTML() {
  const { d } = page;
  const isFav = favs.has(d.id);
  const same = d.es === d.en;
  const abilities = d.ab.map(a => `<button class="chip" data-act="ability" data-v="${a.id}">${esc(DICT.abilities[a.id].n)}${a.h ? ' <small>oculta</small>' : ''}</button>`).join('');
  const fmts = [...new Set(d.sets.map(s => s.f))];
  return `
  <div class="topbar">
    <a class="iconbtn" href="#/" aria-label="Volver al buscador">${I.back}</a>
    <div class="right">
      <button class="iconbtn" data-act="fav" aria-pressed="${isFav}" aria-label="${isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}">${I.star}</button>
      ${themeBtn()}
    </div>
  </div>
  <button class="compare-btn" data-act="compare">${I.compare}Comparar estadísticas</button>
  <section class="phero" aria-label="${esc(d.es)}">
    ${pokeImg({ sp: d.sp, ss: d.ss }, 'art', 'art', 300).replace('loading="lazy"', 'fetchpriority="high"')}
    <span class="num">${dexNum(d.num)}</span>
    <h1>${esc(d.es)}</h1>
    ${same ? '' : `<span class="en">${esc(d.en)}</span>`}
    <div class="tags">${d.t.map(typePill).join('')}</div>
    <div class="rank"><small>Rango</small><button class="tier" style="--tier:${tierColor(d.r)}" data-act="tier" data-v="${esc(d.r)}" aria-label="Qué significa el rango ${esc(tierLabel(d.r))}">${esc(tierLabel(d.r))}</button>
      ${d.dr ? `<small>· Dobles ${esc(tierLabel(d.dr))}</small>` : ''}</div>
    <div class="facts">${d.h != null ? `<span>Altura <b>${fmtNum(d.h)} m</b></span>` : ''}${d.w != null ? `<span>Peso <b>${fmtNum(d.w)} kg</b></span>` : ''}</div>
  </section>

  <section class="sec"><h2>Estadísticas base</h2><div id="stats">${statsHTML(d.s)}</div></section>

  <section class="sec"><h2>Build recomendada <small>Smogon</small></h2><div id="build">${buildHTML()}</div></section>

  <section class="sec"><h2>Habilidades</h2><div class="chips">${abilities}</div></section>

  <section class="sec"><h2>Debilidades y resistencias</h2>${weaknessHTML(d.t)}</section>

  ${countNodes(d.evo) > 1 ? `<section class="sec"><h2>Evolución</h2><div class="evo">${evoHTML(d.evo, d.id)}</div></section>` : ''}

  <section class="sec"><h2>Movimientos por nivel <small>${d.lv.length}</small></h2><div id="lvl">${d.lv.length ? levelMovesHTML(false) : '<p class="hint">Este Pokémon no aprende movimientos por nivel.</p>'}</div></section>
  ${footerHTML()}`;
}

async function renderPokemon(id) {
  state.view = 'pokemon';
  const p = BYID.get(id);
  if (!p) {
    $app.innerHTML = `<div class="topbar"><a class="iconbtn" href="#/" aria-label="Volver">${I.back}</a></div>
      <div class="empty"><b>No encuentro ese Pokémon</b>Puede que no esté disponible en Pokémon Escarlata y Púrpura.</div>`;
    return;
  }
  document.title = `${p.es} · PokeScanner`;
  window.scrollTo(0, 0);
  $app.innerHTML = `<p class="boot">Cargando ${esc(p.es)}…</p>`;
  let d;
  try { [d] = await Promise.all([getPokemon(id), getDict()]); }
  catch { $app.innerHTML = '<div class="empty"><b>No se han podido cargar los datos</b>Comprueba tu conexión e inténtalo de nuevo.</div>'; return; }
  if (state.view !== 'pokemon' || !location.hash.endsWith(id)) return; // se navegó a otro sitio mientras cargaba
  page = { d, fmt: d.sets[0]?.f, idx: 0, expanded: false };
  $app.innerHTML = pokemonHTML();
  document.documentElement.style.setProperty('--accent', TYPE_COLOR[d.t[0]]);
  animate($('#stats'));
}

// ───────────────────────── Comparador ─────────────────────────
const CMP_COLORS = ['var(--accent)', '#6C7BF2', '#F2A03D', '#2FB5A6'];
function openCompare() {
  const base = BYID.get(page.d.id);
  cmp = { base, others: [] };
  openSheet('Comparar estadísticas', `
    <div class="legend" id="cmp-legend"></div>
    <div class="cmp-search"><input id="cmp-q" type="search" placeholder="Añade otro Pokémon (hasta 3)" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Buscar Pokémon para comparar"></div>
    <div class="suggest" id="cmp-suggest"></div>
    <div class="cmp" id="cmp-bars"></div>`, { wide: true });
  renderCompare();
}
function renderCompare() {
  const all = [cmp.base, ...cmp.others];
  $('#cmp-legend').innerHTML = all.map((p, i) => `<span class="chip" style="--k:${CMP_COLORS[i]}"><i></i>${esc(p.es)}${i ? `<button class="x" data-act="remove" data-v="${p.id}" aria-label="Quitar ${esc(p.es)}">×</button>` : ''}</span>`).join('');
  const bars = $('#cmp-bars');
  const keys = [...STATS, 'bst'];
  bars.innerHTML = keys.map(k => {
    const vals = all.map(p => statOf(p, k));
    const max = Math.max(...vals);
    const scale = k === 'bst' ? 800 : 255;
    return `<div class="cmp-stat ${k === 'bst' ? 'cmp-total' : ''}"><span class="k">${STAT_ES[k]}</span>${vals.map((v, i) => {
      const diff = v - vals[0];
      const d = i === 0 ? '' : diff === 0 ? '=' : (diff > 0 ? '+' : '−') + Math.abs(diff);
      return `<div class="cmp-line ${v === max ? 'best' : ''}"><div class="bar"><i style="--w:${Math.min(100, v / scale * 100).toFixed(1)}%;--bc:${CMP_COLORS[i]};--i:${i}"></i></div>
        <span class="v">${v}</span><span class="d ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${d}</span></div>`;
    }).join('')}</div>`;
  }).join('');
  animate(bars);
  renderSuggest();
}
function renderSuggest() {
  const q = fold($('#cmp-q')?.value || '');
  const taken = new Set([cmp.base.id, ...cmp.others.map(p => p.id)]);
  let list;
  if (q) list = searchScored(q, INDEX).sort((a, b) => a.sc - b.sc || a.p.num - b.p.num).map(s => s.p);
  else list = INDEX.filter(p => p.r === cmp.base.r).sort((a, b) => bst(b.s) - bst(a.s));
  list = list.filter(p => !taken.has(p.id));
  list = list.slice(0, 10);
  $('#cmp-suggest').innerHTML = (q ? '' : '<span class="hint">Sugerencias de su mismo rango</span>') + (list.length
    ? `<div class="scroller">${list.map(p => `<button class="chip" data-act="pick" data-v="${p.id}">${pokeImg(p, 'small', 'thumb')}${esc(p.es)}</button>`).join('')}</div>`
    : '<span class="hint">No hay resultados</span>');
}
sheet.addEventListener('input', e => { if (e.target.id === 'cmp-q') renderSuggest(); });

// ───────────────────────── Eventos ─────────────────────────
document.addEventListener('input', e => {
  if (e.target.id !== 'q') return;
  state.q = e.target.value;
  renderResults();
});

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const v = el.dataset.v;
  switch (el.dataset.act) {
    case 'theme': toggleTheme(); break;
    case 'filters-toggle': state.filtersOpen = !state.filtersOpen; syncFilters(); break;
    case 'close': closeSheet(); break;

    // inicio
    case 'sort':
      if (state.sort === v) state.dir *= -1; else { state.sort = v; state.dir = v === 'num' ? 1 : -1; }
      renderResults(); break;
    case 'type':
      state.types = state.types.includes(v) ? state.types.filter(t => t !== v) : [...state.types, v].slice(-2);
      renderResults(); break;
    case 'tier-f':
      state.tiers = state.tiers.includes(v) ? state.tiers.filter(t => t !== v) : [...state.tiers, v];
      renderResults(); break;
    case 'flag': state[v] = !state[v]; renderResults(); break;
    case 'clear-q': state.q = ''; $('#q').value = ''; $('#q').focus(); renderResults(); break;
    case 'reset':
      Object.assign(state, { q: '', sort: 'num', dir: 1, types: [], tiers: [], favs: false, base: false });
      $('#q').value = ''; renderResults(); break;
    case 'shuffle': state.randomMode = 'random'; state.randoms = pickRandoms(false); renderResults(); break;
    case 'tier-go':
      closeSheet();
      Object.assign(state, { q: '', sort: 'num', dir: 1, types: [], tiers: [v], favs: false, base: false, scroll: 0, shown: 40 });
      if (location.hash === '#/' || location.hash === '') renderHome(); else location.hash = '#/';
      break;

    // ficha
    case 'fav':
      if (favs.has(page.d.id)) favs.delete(page.d.id); else favs.add(page.d.id);
      saveFavs();
      el.setAttribute('aria-pressed', favs.has(page.d.id));
      el.setAttribute('aria-label', favs.has(page.d.id) ? 'Quitar de favoritos' : 'Añadir a favoritos');
      toast(favs.has(page.d.id) ? 'Añadido a favoritos' : 'Quitado de favoritos');
      break;
    case 'compare': openCompare(); break;
    case 'tier': tierSheet(v); break;
    case 'move': moveSheet(v); break;
    case 'ability': abilitySheet(v); break;
    case 'item': itemSheet(v); break;
    case 'nature': natureSheet(v); break;
    case 'fmt': page.fmt = v; page.idx = 0; $('#build').innerHTML = buildHTML(); break;
    case 'set': page.idx = Number(v); $('#build').innerHTML = buildHTML(); break;
    case 'copy': copyText(showdownText()); break;
    case 'more': page.expanded = true; $('#lvl').innerHTML = levelMovesHTML(true); break;

    // comparador
    case 'pick':
      if (cmp.others.length >= 3) { toast('Puedes comparar hasta 3 Pokémon más'); break; }
      cmp.others.push(BYID.get(v)); $('#cmp-q').value = ''; renderCompare(); break;
    case 'remove': cmp.others = cmp.others.filter(p => p.id !== v); renderCompare(); break;
  }
});

// ───────────────────────── Arranque ─────────────────────────
async function boot() {
  try {
    INDEX = await getJSON('data/index.json');
  } catch (err) {
    $app.innerHTML = `<div class="empty"><b>No se han podido cargar los datos</b>
      Si abres el archivo directamente, usa un servidor local (<code>npm run serve</code>) o publica la web en GitHub Pages.</div>`;
    console.error(err);
    return;
  }
  BYID = new Map(INDEX.map(p => [p.id, p]));
  window.addEventListener('hashchange', route);
  route();
}
boot();
