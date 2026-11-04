import {
  TYPES, TYPE_ES, TYPE_EN, TYPE_COLOR, STATS, typeName, statName, catName, tierInfo, TIER_ORDER, formatName,
  esc, fold, dexNum, fmtNum, store, matchups, bst, statColor, tierLabel, tierColor, tierNum, tierNumHTML, TIER_MAX,
  pname, pname2, dn, dn2, dd, how,
  pokeImg, itemImg, typeIcon, typePill, typeDot, catIcon,
} from './util.js';
import { t, lang, setLang } from './i18n.js';

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
  view: 'home', q: '', sort: 'num', dir: 1, types: [], tiers: [], favs: false, base: false, gen9: false,
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
const themeBtn = () => `<button class="iconbtn" data-act="theme" aria-label="${t('themeAria')}">${themeIcon()}</button>`;
const langBtn = () => `<button class="langbtn" data-act="lang" aria-label="${t('langAria')}"><span class="${lang() === 'es' ? 'on' : ''}">ES</span><span class="${lang() === 'en' ? 'on' : ''}">EN</span></button>`;

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

// ───────────────────────── Idioma ─────────────────────────
/** Cambia el idioma y vuelve a dibujar la página en la que estás, sin moverte de ella ni de donde ibas del scroll. */
function switchLang() {
  setLang(lang() === 'es' ? 'en' : 'es');
  const y = window.scrollY;
  closeSheet();
  if (state.view === 'pokemon' && page && location.hash.endsWith(page.d.id)) {
    document.title = `${pname(page.d)} · PokeScanner`;
    $app.innerHTML = pokemonHTML();
    $('#stats')?.classList.add('go'); // las barras salen ya llenas: no se vuelven a animar
    window.scrollTo(0, y);
  } else if (state.view === 'home') {
    state.scroll = y;
    renderHome();
  } else route();
}

// ───────────────────────── Datos ─────────────────────────
async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
let dictP = null, learnersP = null, LEARNERS = null;
const getDict = () => (dictP ??= getJSON('data/dict.json').then(d => (DICT = d)).catch(e => { dictP = null; throw e; }));
const getLearners = () => (learnersP ??= getJSON('data/learners.json').then(d => (LEARNERS = d)).catch(e => { learnersP = null; throw e; }));
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
const footerHTML = () => `<footer class="sitefoot">${t('footer', {
  ps: '<a href="https://pokemonshowdown.com" target="_blank" rel="noopener">Pokémon Showdown</a>',
  sm: '<a href="https://www.smogon.com/dex/sv/pokemon/" target="_blank" rel="noopener">Smogon</a>',
  api: '<a href="https://pokeapi.co" target="_blank" rel="noopener">PokeAPI</a>',
})}</footer>`;

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
  delete sheet.dataset.mv;
  sheet.innerHTML = `<div class="sheet-inner">
    <div class="sheet-head"><h2>${esc(title)}</h2><button class="iconbtn" data-act="close" aria-label="${t('close')}">${I.close}</button></div>
    <div class="sheet-body">${body}</div></div>`;
  if (!sheet.open) sheet.showModal();
  document.documentElement.classList.add('locked');
  $('.sheet-body', sheet).scrollTop = 0;
}
function closeSheet() { if (sheet.open) sheet.close(); }
sheet.addEventListener('close', () => document.documentElement.classList.remove('locked'));
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });

const otherName = x => (dn2(x) && dn2(x) !== dn(x) ? `<p class="dim">${t('otherName', { n: esc(dn2(x)) })}</p>` : '');
function moveSheet(id) {
  const m = DICT.moves[id];
  if (!m) return;
  openSheet(dn(m), `
    <div class="lead">${typePill(m.t)}<span class="chip small ghost">${catIcon(m.c)} ${catName(m.c)}</span></div>
    <div class="kv">
      <div><b>${m.p || '—'}</b><small>${t('power')}</small></div>
      <div><b>${m.a ? m.a + '%' : '—'}</b><small>${t('accuracy')}</small></div>
      <div><b>${m.pp || '—'}</b><small>PP</small></div>
      <div><b>${m.pr > 0 ? '+' + m.pr : m.pr}</b><small>${t('priority')}</small></div>
    </div>
    <p>${esc(dd(m)) || `<span class="dim">${t('noDesc')}</span>`}</p>
    ${otherName(m)}
    <div class="learners" id="learners"></div>`);
  sheet.dataset.mv = id;
  getLearners().then(() => renderLearners(id, false)).catch(() => {});
}
/** Pokémon que aprenden un movimiento (por nivel o en su build); se carga bajo demanda */
function renderLearners(id, all) {
  const box = $('#learners', sheet);
  if (!box || sheet.dataset.mv !== id) return;
  const list = (LEARNERS[id] || []).map(i => INDEX[i]);
  if (!list.length) { box.innerHTML = `<p class="hint">${t('noLearners')}</p>`; return; }
  const shown = all ? list : list.slice(0, 24);
  box.innerHTML = `<h3>${t('learnersTitle', { n: list.length })}</h3><p class="hint">${t('learnersNote')}</p>
    <div class="chips">${shown.map(p => `<a class="chip" href="#/pokemon/${p.id}">${pokeImg(p, 'small', 'thumb')}${esc(pname(p))}</a>`).join('')}
    ${!all && list.length > shown.length ? `<button class="chip accent" data-act="learners-all" data-v="${id}">${t('showAllN', { n: list.length })}</button>` : ''}</div>`;
}
function abilitySheet(id) {
  const a = DICT.abilities[id];
  if (!a) return;
  openSheet(dn(a), `<p>${esc(dd(a)) || `<span class="dim">${t('noDesc')}</span>`}</p>${otherName(a)}`);
}
function itemSheet(id) {
  const it = DICT.items[id];
  if (!it) return;
  openSheet(dn(it), `
    <div class="lead">${it.i ? itemImg(it, 'big') : ''}<div><b>${esc(dn(it))}</b>${dn2(it) !== dn(it) ? `<div class="dim">${esc(dn2(it))}</div>` : ''}</div></div>
    <p>${esc(dd(it)) || ''}</p>`);
}
function natureSheet(id) {
  const n = DICT.natures[id];
  if (!n) return;
  const body = n.plus
    ? `<div class="lead"><span class="chip small" style="color:var(--ok)">▲ ${statName(n.plus)}</span><span class="chip small" style="color:var(--bad)">▼ ${statName(n.minus)}</span></div>
       <p>${t('natureUp', { a: statName(n.plus), b: statName(n.minus) })}</p>`
    : `<p>${t('natureNeutral')}</p>`;
  openSheet(dn(n), body + otherName(n));
}
function tierSheet(r) {
  const info = tierInfo(r);
  const name = info ? info.n : r;
  openSheet(t('tierTitle', { r: tierLabel(r) }), `
    <div class="lead"><span class="tier" style="--tier:${tierColor(r)}">${tierNumHTML(r)}${esc(tierLabel(r))}</span><b>${esc(name)}</b></div>
    <p>${esc(info?.d || t('tierDefault'))}</p>
    <p class="dim">${tierNum(r) ? t('tierPos', { n: tierNum(r), m: TIER_MAX }) : t('tierNoScale')}</p>
    <button class="chip accent" data-act="tier-go" data-v="${esc(r)}">${t('tierGo')}</button>`);
}

// ───────────────────────── Router ─────────────────────────
function route() {
  closeSheet();
  if (state.view === 'home') state.scroll = window.scrollY;
  const m = location.hash.match(/^#\/pokemon\/([a-z0-9]+)/);
  if (m) renderPokemon(m[1]); else renderHome();
}

// ───────────────────────── Inicio ─────────────────────────
const SORTS = ['num', 'hp', 'atk', 'def', 'spa', 'spd', 'spe', 'bst'];
const sortLabel = k => (k === 'num' ? t('num') : statName(k));

function homeHTML() {
  const chip = (attrs, inner, extra = '') => `<button class="chip ${extra}" ${attrs} aria-pressed="false">${inner}</button>`;
  return `
  <div class="topline">${langBtn()}${themeBtn()}</div>
  <header class="hero">
    <h1>PokeScanner</h1>
  </header>
  <div class="searchbar"><div class="search ${state.q ? 'filled' : ''}">
    ${I.search}
    <input id="q" type="text" role="searchbox" inputmode="search" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
      data-form-type="other" data-lpignore="true" aria-label="${t('searchLabel')}" value="${esc(state.q)}">
    <span class="ph" aria-hidden="true">${t('searchPh')}</span>
    <button class="clear" data-act="clear-q" aria-label="${t('clearSearch')}">${I.close}</button>
  </div></div>
  <div class="ftoggle">
    <button class="chip" data-act="filters-toggle" aria-expanded="false" aria-controls="fpanel">
      <svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>
      ${t('filters')} <span class="badge" id="fbadge"></span>
      <svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <button class="chip" data-act="flag" data-v="favs" aria-pressed="false">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z"/></svg>${t('favorites')} <small class="favn"></small>
    </button>
  </div>
  <div class="fpanel" id="fpanel"><div class="fpanel-in">
  <section class="filters" id="filters" aria-label="${t('filters')}">
    <div class="frow"><span>${t('sortBy')}</span><div class="scroller">${SORTS.map(k => chip(`data-act="sort" data-v="${k}"`, `${sortLabel(k)}<span class="dir"></span>`)).join('')}</div></div>
    <div class="frow"><span>${t('type')}</span><div class="scroller">${TYPES.map(ty => chip(`data-act="type" data-v="${ty}"`, `${typeIcon(ty)}${typeName(ty)}`)).join('')}</div></div>
    <div class="frow"><span>${t('tier')} <small>${t('tierHint')}</small></span><div class="scroller">${TIER_ORDER.map(r => chip(`data-act="tier-f" data-v="${r}"`, `${tierNumHTML(r)}${tierLabel(r)}`)).join('')}</div></div>
    <div class="frow"><span>${t('show')}</span><div class="scroller">
      ${chip('data-act="flag" data-v="base"', t('baseOnly'))}
      ${chip('data-act="flag" data-v="gen9"', t('gen9Only'))}
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
  document.querySelectorAll('[data-act="flag"]').forEach(b => b.setAttribute('aria-pressed', !!state[b.dataset.v]));
  document.querySelectorAll('.favn').forEach(n => { n.textContent = favs.size ? `(${favs.size})` : ''; });
  $('.search .clear')?.classList.toggle('on', !!state.q);
  $('.search')?.classList.toggle('filled', !!state.q);
  // el botón "Filtros" muestra cuántos hay activos y abre/cierra el panel
  const active = state.types.length + state.tiers.length + (state.base ? 1 : 0) + (state.gen9 ? 1 : 0) + (state.sort !== 'num' || state.dir !== 1 ? 1 : 0);
  $('#fbadge').textContent = active || '';
  $('[data-act="filters-toggle"]').setAttribute('aria-expanded', state.filtersOpen);
  $('#fpanel').classList.toggle('open', state.filtersOpen);
  f.inert = !state.filtersOpen;
}

const isFiltering = () => !!fold(state.q) || state.types.length || state.tiers.length || state.favs || state.base || state.gen9 || state.sort !== 'num' || state.dir !== 1;

function compute() {
  const q = fold(state.q);
  let list = INDEX;
  if (state.favs) list = list.filter(p => favs.has(p.id));
  if (state.base) list = list.filter(p => !p.fm);
  if (state.gen9) list = list.filter(p => !p.g);
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
  const typeHits = q.length >= 3 ? TYPES.filter(ty => fold(TYPE_ES[ty]).startsWith(q) || fold(TYPE_EN[ty]).startsWith(q)) : [];
  const out = [];
  for (const p of list) {
    p.fs ??= fold(p.es); p.fe ??= fold(p.en);
    let sc = -1;
    if (isNum) { if (String(p.num) === String(Number(q))) sc = 0; }
    if (sc < 0) {
      if (p.fs.startsWith(q) || p.fe.startsWith(q)) sc = 0;
      else if (p.fs.includes(q) || p.fe.includes(q)) sc = 1;
      else if (typeHits.some(ty => p.t.includes(ty))) sc = 3;
    }
    if (sc >= 0) out.push({ p, sc });
  }
  return out;
}

const MOVES_MAX = 6;
/** Movimientos cuyo nombre (en cualquier idioma) contiene lo escrito; se piden los datos la primera vez que se busca */
function searchMoves(q) {
  if (!state.q || q.length < 2 || state.types.length || state.tiers.length || state.favs) return { list: [], total: 0 };
  if (!DICT) { getDict().then(() => { if (state.view === 'home' && fold(state.q).length >= 2) renderResults(false); }).catch(() => {}); return { list: [], total: 0 }; }
  const out = [];
  for (const [id, m] of Object.entries(DICT.moves)) {
    m.fs ??= fold(m.n); m.fe ??= fold(m.e);
    const sc = m.fs.startsWith(q) || m.fe.startsWith(q) ? 0 : m.fs.includes(q) || m.fe.includes(q) ? 1 : -1;
    if (sc >= 0) out.push({ id, m, sc });
  }
  out.sort((a, b) => a.sc - b.sc || dn(a.m).length - dn(b.m).length || dn(a.m).localeCompare(dn(b.m)));
  return { list: out.slice(0, MOVES_MAX), total: out.length };
}
function movesBlock({ list, total }) {
  if (!list.length) return '';
  const rows = list.map(({ id, m }) => `<li><button class="lm solo" style="--tc:${TYPE_COLOR[m.t]}" data-act="move" data-v="${id}">${typeIcon(m.t)}<span class="n">${esc(dn(m))}</span>${catIcon(m.c)}<span class="pw">${m.p || '—'}</span></button></li>`).join('');
  return `<div class="block-title tight"><h2>${t('moves')}</h2></div><ul class="lvl mvlist">${rows}</ul>
    ${total > list.length ? `<p class="hint" style="margin-top:8px">${t('moreMoves', { n: total - list.length })}</p>` : ''}`;
}

function tierBadge(r, extra = '', g = 0) { return `<span class="tier" style="--tier:${tierColor(r)}" ${extra}${g ? ` title="${t('tierInGen', { g })}"` : ''}>${tierNumHTML(r)}${esc(tierLabel(r))}${g ? `<small>G${g}</small>` : ''}</span>`; }

function rowHTML(p) {
  const showStat = state.sort !== 'num';
  return `<a class="row" href="#/pokemon/${p.id}" style="--c:${TYPE_COLOR[p.t[0]]}">
    ${pokeImg(p, 'small')}
    <span class="meta"><b>${esc(pname(p))}</b><span class="sub"><small>${dexNum(p.num)}${p.fm && p.es !== p.en && lang() === 'es' ? ` · ${esc(p.en)}` : ''}</small><span class="types">${p.t.map(typeDot).join('')}</span></span></span>
    <span class="side">
      ${showStat ? `<span class="statval">${statOf(p, state.sort)}<small>${statName(state.sort)}</small></span>` : tierBadge(p.r, '', p.g)}
    </span></a>`;
}
function cardHTML(p) {
  return `<a class="card" href="#/pokemon/${p.id}" style="--c:${TYPE_COLOR[p.t[0]]}">
    ${pokeImg(p, 'art')}
    <span class="num">${dexNum(p.num)}</span><b>${esc(pname(p))}</b>
    <span class="foot"><span class="types">${p.t.map(typeDot).join('')}</span>${tierBadge(p.r, '', p.g)}</span></a>`;
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
  const pool = INDEX.filter(p => !p.g && p.r !== 'LC' && p.r !== 'NFE');
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
      <div class="block-title"><h2>${state.randomMode === 'daily' ? t('daily') : t('random')}</h2>
        <button class="chip small" data-act="shuffle">${'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>'}${t('shuffle')}</button></div>
      <div class="cards">${state.randoms.map(id => cardHTML(BYID.get(id))).join('')}</div>`;
    return;
  }

  const list = (state.list = compute());
  const mv = movesBlock(searchMoves(fold(state.q)));
  const head = mv + `<div class="block-title tight"><h2>${t(list.length === 1 ? 'result1' : 'resultN', { n: list.length })}</h2>
    <button class="chip small ghost" data-act="reset">${t('clearFilters')}</button></div>`;
  if (!list.length) {
    // si no hay Pokémon pero sí movimientos, solo se muestran los movimientos
    box.innerHTML = mv || head + `<div class="empty"><b>${t('emptyTitle')}</b>${state.favs && !favs.size ? t('emptyFavs') : t('emptyHint')}</div>`;
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
  const rows = STATS.map((k, i) => `<div class="stat"><span class="k">${statName(k)}</span><span class="v">${s[i]}</span>
    <div class="bar"><i style="--w:${Math.min(100, s[i] / 255 * 100).toFixed(1)}%;--bc:${statColor(s[i])};--i:${i}"></i></div></div>`).join('');
  return `<div class="stats">${rows}<div class="stat total"><span class="k">${t('total')}</span><span class="v">${bst(s)}</span><div class="bar"></div></div></div>`;
}

const chipMove = (id, alt = false) => {
  const m = DICT.moves[id];
  return `<button class="mv ${alt ? 'alt' : ''}" style="--tc:${TYPE_COLOR[m.t]}" data-act="move" data-v="${id}">${typeIcon(m.t)}${esc(dn(m))}</button>`;
};
const chipAbility = id => `<button class="chip" data-act="ability" data-v="${id}">${esc(dn(DICT.abilities[id]))}</button>`;
const chipItem = id => `<button class="chip" data-act="item" data-v="${id}">${itemImg(DICT.items[id])}${esc(dn(DICT.items[id]))}</button>`;
const chipNature = id => {
  const n = DICT.natures[id];
  return `<button class="chip" data-act="nature" data-v="${id}">${esc(dn(n))}${n.plus ? ` <small>+${statName(n.plus)} −${statName(n.minus)}</small>` : ` <small>${t('neutral')}</small>`}</button>`;
};

function oldNote(d) {
  const rows = d.gt.map(([g, r]) => `<span class="gt"><span class="tier" style="--tier:${tierColor(r)}">${tierNumHTML(r)}${esc(tierLabel(r))}</span><small>${t('gen', { g })}</small></span>`).join('');
  return `<aside class="oldnote" aria-label="${t('oldAria')}">
    <b>${t('oldTitle')}</b>
    <p>${t('oldText', { g: d.g })}</p>
    <div class="gts">${rows}</div></aside>`;
}

function buildHTML() {
  const { d, fmt, idx } = page;
  if (!d.sets.length) return `<p class="hint">${t(d.g ? 'noSetsOld' : 'noSets')}</p>`;
  const formats = [...new Set(d.sets.map(s => s.f))];
  const sets = d.sets.filter(s => s.f === fmt);
  const set = sets[idx] || sets[0];
  const tabs = (items, attr, active) => `<div class="scroller" role="tablist">${items.map(([v, l]) =>
    `<button class="chip small" role="tab" data-act="${attr}" data-v="${esc(v)}" aria-selected="${String(v) === String(active)}">${esc(l)}</button>`).join('')}</div>`;
  const evs = Object.entries(set.ev || {});
  return `
    ${formats.length > 1 ? tabs(formats.map(f => [f, formatName(f)]), 'fmt', fmt) : `<span class="hint">${t('format', { f: esc(formatName(fmt)) })}</span>`}
    ${sets.length > 1 ? `<div style="margin-top:8px">${tabs(sets.map((s, i) => [i, s.n]), 'set', idx)}</div>` : ''}
    <div class="build">
      <div><h3>${t('moves')}</h3><ul class="slots">${set.m.map(slot => `<li class="slot">${chipMove(slot[0])}${slot.length > 1 ? `<span class="or">${t('or')}</span>${slot.slice(1).map(id => chipMove(id, true)).join('')}` : ''}</li>`).join('')}</ul></div>
      ${set.a.length ? `<div><h3>${t('ability')}</h3><div class="chips">${set.a.map(chipAbility).join('')}</div></div>` : ''}
      ${set.i.length ? `<div><h3>${t('item')}</h3><div class="chips">${set.i.map(chipItem).join('')}</div></div>` : ''}
      ${set.na.length ? `<div><h3>${t('nature')}</h3><div class="chips">${set.na.map(chipNature).join('')}</div></div>` : ''}
      ${evs.length ? `<div><h3>EVs</h3><div class="evs">${evs.map(([k, v]) => `<span class="ev"><b>${v}</b> ${statName(k)}</span>`).join('')}</div></div>` : ''}
      ${set.te.length ? `<div><h3>${t('tera')}</h3><div class="chips">${set.te.map(typePill).join('')}</div></div>` : ''}
      <div class="actions"><button class="chip" data-act="copy">${I.copy.replace('<svg', '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"')}${t('copy')}</button></div>
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
  toast(t('copied'));
}

function weaknessHTML(types) {
  const m = matchups(types);
  const rows = [['4', '×4', 'w'], ['2', '×2', 'w'], ['0.5', '×½', 'r'], ['0.25', '×¼', 'r'], ['0', '×0', 'i']]
    .filter(([k]) => m[k]?.length)
    .map(([k, l, c]) => `<div class="mx-row ${c}"><b>${l}</b><div class="chips">${m[k].map(typePill).join('')}</div></div>`);
  return `<div class="mx">${rows.join('')}</div><p class="hint" style="margin-top:10px">${t('weakNote')}</p>`;
}

const countNodes = n => 1 + (n.c || []).reduce((a, c) => a + countNodes(c), 0);
function evoHTML(node, curId, req = '') {
  const p = BYID.get(node.id);
  if (!p) return '';
  // `how` = requisito para evolucionar hasta este Pokémon (nivel, piedra, amistad, intercambio…)
  let h = `<a class="evo-card ${node.id === curId ? 'current' : ''}" href="#/pokemon/${p.id}" ${node.id === curId ? 'aria-current="page"' : ''}>
    ${pokeImg(p, 'small')}<span class="evo-txt"><b>${esc(pname(p))}</b><small>${dexNum(p.num)}</small>
    ${req ? `<span class="evo-how">${esc(req)}</span>` : ''}
    <span class="types" style="display:flex;gap:4px;margin-top:6px">${p.t.map(typeDot).join('')}</span></span></a>`;
  const kids = (node.c || []).filter(c => BYID.has(c.id));
  if (kids.length) {
    h += `<div class="evo-kids">${kids.map(c => `<div class="evo-link" aria-hidden="true">${I.down}</div>${evoHTML(c, curId, how(c))}`).join('')}</div>`;
  }
  return h;
}

function levelMovesHTML(expanded) {
  const lv = page.d.lv;
  const LIMIT = 14;
  const rows = (expanded ? lv : lv.slice(0, LIMIT)).map(([l, id]) => {
    const m = DICT.moves[id];
    return `<li><button class="lm" style="--tc:${TYPE_COLOR[m.t]}" data-act="move" data-v="${id}">
      <span class="l">${l === 0 ? `<b>${t('evo')}</b>` : `${t('lv')} <b>${l}</b>`}</span>${typeIcon(m.t)}<span class="n">${esc(dn(m))}</span>${catIcon(m.c)}<span class="pw">${m.p ? m.p : '—'}</span></button></li>`;
  }).join('');
  return `<ul class="lvl">${rows}</ul>${!expanded && lv.length > LIMIT ? `<button class="chip more" data-act="more">${t('showAllMoves', { n: lv.length })}</button>` : ''}`;
}

function pokemonHTML() {
  const { d } = page;
  const isFav = favs.has(d.id);
  const same = d.es === d.en;
  const abilities = d.ab.map(a => `<button class="chip" data-act="ability" data-v="${a.id}">${esc(dn(DICT.abilities[a.id]))}${a.h ? ` <small>${t('hidden')}</small>` : ''}</button>`).join('');
  return `
  <div class="topbar">
    <a class="iconbtn" href="#/" aria-label="${t('back')}">${I.back}</a>
    <div class="right">
      <button class="iconbtn" data-act="fav" aria-pressed="${isFav}" aria-label="${isFav ? t('favRemove') : t('favAdd')}">${I.star}</button>
      ${langBtn()}${themeBtn()}
    </div>
  </div>
  <button class="compare-btn" data-act="compare">${I.compare}${t('compare')}</button>
  <section class="phero" aria-label="${esc(pname(d))}">
    ${pokeImg({ sp: d.sp, ss: d.ss }, 'art', 'art', 300).replace('loading="lazy"', 'fetchpriority="high"')}
    <span class="num">${dexNum(d.num)}</span>
    <h1>${esc(pname(d))}</h1>
    ${same ? '' : `<span class="en">${esc(pname2(d))}</span>`}
    <div class="tags">${d.t.map(typePill).join('')}</div>
    <div class="rank"><small>${t('rank')}</small><button class="tier" style="--tier:${tierColor(d.r)}" data-act="tier" data-v="${esc(d.r)}" aria-label="${t('rankAria', { r: esc(tierLabel(d.r)) })}">${tierNumHTML(d.r)}${esc(tierLabel(d.r))}</button>
      ${d.g ? `<small>· ${t('gen', { g: d.g })}</small>` : ''}${d.dr ? `<small>· ${t('doubles', { r: esc(tierLabel(d.dr)) })}</small>` : ''}</div>
    <div class="facts">${d.h != null ? `<span>${t('height')} <b>${fmtNum(d.h)} m</b></span>` : ''}${d.w != null ? `<span>${t('weight')} <b>${fmtNum(d.w)} kg</b></span>` : ''}</div>
  </section>

  ${d.g ? oldNote(d) : ''}
  <section class="sec"><h2>${t('baseStats')}</h2><div id="stats">${statsHTML(d.s)}</div></section>

  <section class="sec"><h2>${t('buildTitle')} <small>Smogon</small></h2><div id="build">${buildHTML()}</div></section>

  <section class="sec"><h2>${t('abilities')}</h2><div class="chips">${abilities}</div></section>

  <section class="sec"><h2>${t('weak')}</h2>${weaknessHTML(d.t)}</section>

  ${countNodes(d.evo) > 1 ? `<section class="sec"><h2>${t('evolution')}</h2><div class="evo">${evoHTML(d.evo, d.id)}</div></section>` : ''}

  <section class="sec"><h2>${t('levelMoves')} <small>${d.g ? `${t('gen', { g: d.lg })} · ` : ''}${d.lv.length}</small></h2><div id="lvl">${d.lv.length ? levelMovesHTML(page.expanded) : `<p class="hint">${t('noLevelMoves')}</p>`}</div></section>
  ${footerHTML()}`;
}

async function renderPokemon(id) {
  state.view = 'pokemon';
  const p = BYID.get(id);
  if (!p) {
    $app.innerHTML = `<div class="topbar"><a class="iconbtn" href="#/" aria-label="${t('backShort')}">${I.back}</a><div class="right">${langBtn()}${themeBtn()}</div></div>
      <div class="empty"><b>${t('notFound')}</b>${t('notFoundHint')}</div>`;
    return;
  }
  document.title = `${pname(p)} · PokeScanner`;
  window.scrollTo(0, 0);
  $app.innerHTML = `<p class="boot">${t('loading', { n: esc(pname(p)) })}</p>`;
  let d;
  try { [d] = await Promise.all([getPokemon(id), getDict()]); }
  catch { $app.innerHTML = `<div class="empty"><b>${t('loadFail')}</b>${t('loadFailHint')}</div>`; return; }
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
  openSheet(t('cmpTitle'), `
    <div class="legend" id="cmp-legend"></div>
    <div class="cmp-search"><input id="cmp-q" type="text" role="searchbox" inputmode="search" enterkeyhint="search" placeholder="${t('cmpPh')}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-form-type="other" data-lpignore="true" aria-label="${t('cmpAria')}"></div>
    <div class="suggest" id="cmp-suggest"></div>
    <div class="cmp" id="cmp-bars"></div>`, { wide: true });
  renderCompare();
}
function renderCompare() {
  const all = [cmp.base, ...cmp.others];
  $('#cmp-legend').innerHTML = all.map((p, i) => `<span class="chip" style="--k:${CMP_COLORS[i]}"><i></i>${esc(pname(p))}${i ? `<button class="x" data-act="remove" data-v="${p.id}" aria-label="${t('remove', { n: esc(pname(p)) })}">×</button>` : ''}</span>`).join('');
  const bars = $('#cmp-bars');
  const keys = [...STATS, 'bst'];
  bars.innerHTML = keys.map(k => {
    const vals = all.map(p => statOf(p, k));
    const max = Math.max(...vals);
    const scale = k === 'bst' ? 800 : 255;
    return `<div class="cmp-stat ${k === 'bst' ? 'cmp-total' : ''}"><span class="k">${statName(k)}</span>${vals.map((v, i) => {
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
  else list = INDEX.filter(p => p.r === cmp.base.r && !p.g === !cmp.base.g).sort((a, b) => bst(b.s) - bst(a.s));
  list = list.filter(p => !taken.has(p.id));
  list = list.slice(0, 10);
  $('#cmp-suggest').innerHTML = (q ? '' : `<span class="hint">${t('cmpSuggest')}</span>`) + (list.length
    ? `<div class="scroller">${list.map(p => `<button class="chip" data-act="pick" data-v="${p.id}">${pokeImg(p, 'small', 'thumb')}${esc(pname(p))}</button>`).join('')}</div>`
    : `<span class="hint">${t('noResults')}</span>`);
}
sheet.addEventListener('input', e => { if (e.target.id === 'cmp-q') renderSuggest(); });

// ───────────────────────── Eventos ─────────────────────────
document.addEventListener('input', e => {
  if (e.target.id !== 'q') return;
  state.q = e.target.value;
  renderResults();
  // al escribir, el buscador sube a lo alto de la pantalla para ver cuantos más resultados mejor
  const top = $('.searchbar')?.getBoundingClientRect().top;
  if (state.q && top > 2) window.scrollBy({ top, behavior: 'instant' });
});

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const v = el.dataset.v;
  switch (el.dataset.act) {
    case 'theme': toggleTheme(); break;
    case 'lang': switchLang(); break;
    case 'filters-toggle': state.filtersOpen = !state.filtersOpen; syncFilters(); break;
    case 'close': closeSheet(); break;
    case 'learners-all': renderLearners(v, true); break;

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
      el.setAttribute('aria-label', favs.has(page.d.id) ? t('favRemove') : t('favAdd'));
      toast(favs.has(page.d.id) ? t('favAdded') : t('favRemoved'));
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
      if (cmp.others.length >= 3) { toast(t('cmpMax')); break; }
      cmp.others.push(BYID.get(v)); $('#cmp-q').value = ''; renderCompare(); break;
    case 'remove': cmp.others = cmp.others.filter(p => p.id !== v); renderCompare(); break;
  }
});

// ───────────────────────── Arranque ─────────────────────────
async function boot() {
  try {
    INDEX = await getJSON('data/index.json');
  } catch (err) {
    $app.innerHTML = `<div class="empty"><b>${t('loadFail')}</b>${t('bootFail')}</div>`;
    console.error(err);
    return;
  }
  BYID = new Map(INDEX.map(p => [p.id, p]));
  window.addEventListener('hashchange', route);
  route();
}
boot();
