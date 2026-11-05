import {
  TYPES, TYPE_ES, TYPE_EN, TYPE_COLOR, STATS, typeName, statName, catName, tierInfo, TIER_ORDER, formatName,
  esc, fold, dexNum, fmtNum, store, matchups, bst, statColor, tierLabel, tierColor, tierNum, tierNumHTML, TIER_MAX, formatRank,
  pname, pname2, dn, dn2, dd, how,
  pokeImg, itemImg, typeIcon, typePill, typeDot, catIcon, SPR,
} from './util.js';
import { t, lang, setLang } from './i18n.js';
import { analyzeTeam, scoreInfo } from './team.js';
import * as auth from './auth.js';
import { DOCK, IC } from './icons.js';
import { buildUnit, compareTeams, eff } from './battle.js';

const $app = document.getElementById('app');
const sheet = document.getElementById('sheet');
const toastEl = document.getElementById('toast');

let INDEX = [];
let BYID = new Map();
let DICT = null;
const cache = new Map();

// Los favoritos viven en la cuenta del usuario. Los que se guardaron en este dispositivo antes de existir las cuentas
// (legacyFavs) se suben a la cuenta la primera vez que se inicia sesión.
const favs = new Set();
const legacyFavs = (() => { try { const v = JSON.parse(store.get('pk.favs') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } })();

const state = {
  view: 'home', mode: 'home', q: '', sort: 'num', dir: 1, types: [], tiers: [], gens: [], favs: false, gen9: false, dd: null,
  shown: 40, scroll: 0, randomMode: 'daily', randoms: null, filtersOpen: false,
};
let page = null; // estado de la ficha abierta
let cmp = null;  // estado del comparador
let io = null;   // IntersectionObserver de la lista

// ───────────────────────── Iconos ─────────────────────────
const I = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6l6 6"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/></svg>',
  tsearch: '<svg viewBox="0 0 24 24"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M21 21l-6 -6"/></svg>',
  tstar: '<svg viewBox="0 0 24 24"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245"/></svg>',
  adjust: '<svg viewBox="0 0 24 24"><path d="M12 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 6l8 0"/><path d="M16 6l4 0"/><path d="M6 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 12l2 0"/><path d="M10 12l10 0"/><path d="M15 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 18l11 0"/><path d="M19 18l1 0"/></svg>',
  google: '<svg viewBox="0 0 24 24"><path d="M20.945 11a9 9 0 1 1 -3.284 -5.997l-2.655 2.392a5.5 5.5 0 1 0 2.119 6.605h-4.125v-3h7.945"/></svg>',
  logout: '<svg viewBox="0 0 24 24"><path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2"/><path d="M9 12h12l-3 -3"/><path d="M18 15l3 -3"/></svg>',
  desktop: '<svg viewBox="0 0 24 24"><path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10"/><path d="M7 20h10"/><path d="M9 16v4"/><path d="M15 16v4"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M18 6l-12 12"/><path d="M6 6l12 12"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/></svg>',
  language: '<svg viewBox="0 0 24 24"><path d="M9 6.371c0 4.418 -2.239 6.629 -5 6.629"/><path d="M4 6.371h7"/><path d="M5 9c0 2.144 2.252 3.908 6 4"/><path d="M12 20l4 -9l4 9"/><path d="M19.1 18h-6.2"/><path d="M6.694 3l.793 .582"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5l10 -10"/></svg>',
  compare: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 4v15M6 13l6 6 6-6"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
};
/** Ajustes: ventana en medio de la pantalla (idioma con bandera y tema claro/oscuro) */
const FLAG = { es: 'icons/flags/es.svg', en: 'icons/flags/gb.svg' };
const LANGS = { es: 'Español', en: 'English' };
const smodal = document.getElementById('smodal');
let modalKind = null; // 'settings' | 'login' | 'teampick' | 'picker'
let pending = null;   // lo que la persona quería hacer cuando se le pidió iniciar sesión
const themePref = () => { const v = store.get('pk.theme'); return v === 'light' || v === 'dark' ? v : 'system'; };
const THEME_ICON = { system: 'desktop', light: 'sun', dark: 'moon' };
function accountHTML() {
  const u = auth.userInfo();
  if (!u) return `<div class="sgroup"><button class="gbtn" data-act="sign-in">${I.google}${t('loginGoogle')}</button><p class="shint">${t('loginHint')}</p></div>`;
  return `<div class="sgroup"><div class="acc"><button class="avatarbtn" data-act="avatar-pick" aria-label="${t('avatarChange')}">${avatarImg(me?.avatar)}<span class="edit">${IC.pencil}</span></button>
      <div class="who"><b>${esc(me?.username || u.name)}</b><small>${esc(u.email)}</small></div></div>
    <div class="unrow"><input id="un" class="unin" value="${esc(me?.username || '')}" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${t('username')}">
      <button class="chip accent" data-act="un-save" disabled>${t('saveBtn')}</button></div>
    <small id="un-msg" class="unmsg">${t('unHint')}</small>
    <button class="sopt" data-act="sign-out">${I.logout}${t('signOut')}</button></div>`;
}
function settingsHTML() {
  const pref = themePref();
  return `<div class="scard" role="dialog" aria-modal="true" aria-label="${t('settings')}">
    <div class="shead"><button class="iconbtn" data-act="settings-close" aria-label="${t('close')}">${I.x}</button><h2>${t('settings')}</h2></div>
    ${accountHTML()}
    <div class="sgroup"><h3>${I.language}${t('language')}</h3>
      ${['es', 'en'].map(l => `<button class="sopt" role="radio" data-act="set-lang" data-v="${l}" aria-checked="${lang() === l}"><img class="flag" src="${FLAG[l]}" alt="" width="24" height="18">${LANGS[l]}<span class="ck">${I.check}</span></button>`).join('')}</div>
    <div class="sgroup"><h3>${I[THEME_ICON[pref]]}${t('theme')}</h3>
      ${['system', 'light', 'dark'].map(m => `<button class="sopt" role="radio" data-act="set-theme" data-v="${m}" aria-checked="${pref === m}">${I[THEME_ICON[m]]}${t(m === 'system' ? 'themeSystem' : m)}<span class="ck">${I.check}</span></button>`).join('')}</div>
  </div>`;
}
function loginHTML() {
  return `<div class="scard login" role="dialog" aria-modal="true" aria-label="${t('loginTitle')}">
    <div class="shead"><button class="iconbtn" data-act="settings-close" aria-label="${t('close')}">${I.x}</button></div>
    <div class="lbody"><span class="lbadge">${IC.user}</span><h2>${t('loginTitle')}</h2><p>${t('loginText')}</p>
      ${legacyFavs.length ? `<p class="shint">${t('loginLegacy', { n: legacyFavs.length })}</p>` : ''}
      <button class="gbtn" data-act="sign-in">${I.google}${t('loginGoogle')}</button>
      <button class="ghostbtn" data-act="settings-close">${t('notNow')}</button></div>
  </div>`;
}
const modalHTML = () => (modalKind === 'login' ? loginHTML() : modalKind === 'teampick' ? teamPickHTML() : modalKind === 'picker' ? pickerHTML() : settingsHTML());
const refreshModal = () => { if (!smodal.hidden) smodal.innerHTML = modalHTML(); };
function showModal(kind) {
  modalKind = kind;
  smodal.innerHTML = modalHTML();
  smodal.hidden = false;
  document.documentElement.classList.add('locked');
  updateDock();
}
const openSettings = () => showModal('settings');
const openLogin = action => { pending = action; showModal('login'); };
function closeSettings() {
  if (smodal.hidden) return;
  smodal.hidden = true;
  document.documentElement.classList.remove('locked');
  updateDock();
}
/** true si hay sesión; si no, enseña el aviso para iniciarla y recuerda qué se quería hacer */
const requireLogin = action => { if (auth.currentUser()) return true; openLogin(action); return false; };

// ───────────────────────── Cuenta y equipos ─────────────────────────
const PENDING_KEY = 'pk.pending';
const SLOTS = 9, MAXTEAM = 6;
let teams = Array.from({ length: SLOTS }, () => ({ name: '', members: [] }));
let me = null; // { username, avatar } del perfil público
const teamName = i => teams[i].name || t('teamN', { n: i + 1 });
const rebuildFavs = () => { favs.clear(); teams.forEach(tm => tm.members.forEach(m => favs.add(m.id))); };
const cacheTeams = () => { const u = auth.userInfo(); if (u) store.set(`pk.teams.${u.id}`, JSON.stringify(teams)); };
const resetTeams = () => { teams = Array.from({ length: SLOTS }, () => ({ name: '', members: [] })); rebuildFavs(); };
const avatarImg = (n, cls = '') => `<img class="av ${cls}" src="${SPR}/pokemon/${Number(n) || 25}.png" alt="" width="64" height="64" loading="lazy" decoding="async">`;
const miniPoke = id => (BYID.get(id) ? pokeImg(BYID.get(id), 'small', 'mini') : '');

function paintFavBtn() {
  const b = $('.favbtn'); if (!b || !page?.d) return;
  const on = favs.has(page.d.id);
  b.setAttribute('aria-pressed', on); b.innerHTML = favBtnInner(on);
}
const saveTimers = {};
/** Los cambios de un equipo se guardan en la cuenta un instante después de tocar (así se agrupan varios) */
function saveSlot(i) {
  cacheTeams();
  clearTimeout(saveTimers[i]);
  saveTimers[i] = setTimeout(() => auth.saveTeam(i, teams[i].name, teams[i].members).catch(() => toast(t('favFail'))), 350);
}
function afterTeamsChange() {
  rebuildFavs(); paintFavBtn(); refreshModal();
  if (state.view === 'teams') paintTeams();
  document.querySelectorAll('.favn').forEach(n => { n.textContent = favs.size ? `(${favs.size})` : ''; });
}
/** Mete o saca un Pokémon de un equipo. Devuelve true si cambió algo */
function toggleInTeam(slot, id) {
  const tm = teams[slot];
  const k = tm.members.findIndex(m => m.id === id);
  if (k >= 0) tm.members.splice(k, 1);
  else { if (tm.members.length >= MAXTEAM) { toast(t('teamFull')); return false; } tm.members.push({ id }); }
  saveSlot(slot); afterTeamsChange();
  return true;
}
async function startLogin() {
  try {
    if (pending) store.set(PENDING_KEY, JSON.stringify({ ...pending, exp: Date.now() + 15 * 60 * 1000 }));
    await auth.signInGoogle();
  } catch (err) {
    try { localStorage.removeItem(PENDING_KEY); } catch { /* sin almacenamiento */ }
    toast(t(err?.code === 'google_off' ? 'loginOff' : 'loginFail'));
  }
}
const takePending = () => {
  try { const v = JSON.parse(store.get(PENDING_KEY) || 'null'); localStorage.removeItem(PENDING_KEY); return v && v.exp > Date.now() ? v : null; } catch { return null; }
};
/** Se llama cuando cambia la sesión (inicio, vuelta de Google o cierre) */
async function onAuth(event, s) {
  if (!s) { // sesión cerrada
    pending = null; me = null; resetTeams();
    auth.untrackPresence().catch(() => {}); auth.unwatchFriends().catch(() => {});
    refreshModal(); paintFavBtn();
    if (state.view === 'home') renderResults(); else if (state.view === 'teams') paintTeams(); else if (state.view === 'battle') renderBattle();
    return;
  }
  const u = auth.userInfo();
  try { // se pinta ya lo último que se guardó, mientras llega lo de la nube
    const cached = JSON.parse(store.get(`pk.teams.${u.id}`) || 'null');
    if (Array.isArray(cached) && cached.length === SLOTS) { teams = cached; rebuildFavs(); }
  } catch { /* caché ilegible */ }
  const wanted = takePending();
  try {
    const rows = await auth.loadTeams();
    resetTeams();
    rows.forEach(r => { if (r.slot >= 0 && r.slot < SLOTS) teams[r.slot] = { name: r.name || '', members: (r.members || []).filter(m => BYID.has(m.id)) }; });
    // los favoritos que había guardados en este dispositivo antes de las cuentas pasan al primer equipo
    if (legacyFavs.length && teams.every(tm => !tm.members.length)) {
      teams[0].members = legacyFavs.filter(id => BYID.has(id)).slice(0, MAXTEAM).map(id => ({ id }));
      if (teams[0].members.length) saveSlot(0);
    }
    if (legacyFavs.length) { store.set('pk.favs', '[]'); legacyFavs.length = 0; }
    rebuildFavs(); cacheTeams();
  } catch { toast(t('syncFail')); }
  try {
    let prof = await auth.loadProfile();
    if (!prof?.username || !prof?.avatar) { await auth.ensureUsername(); prof = await auth.loadProfile(); }
    if (prof) {
      me = { username: prof.username, avatar: prof.avatar };
      if (['system', 'light', 'dark'].includes(prof.theme)) setTheme(prof.theme, { save: false });
      if ((prof.lang === 'es' || prof.lang === 'en') && prof.lang !== lang()) switchLang(prof.lang, { save: false });
      else if (!prof.lang) syncProfile(); // cuenta nueva: se guarda el idioma actual
    }
  } catch { /* se queda con lo local */ }
  auth.trackPresence().catch(() => {});
  if (!smodal.hidden) closeSettings();
  if (state.view === 'home') renderResults(); else if (state.view === 'teams') paintTeams(); else if (state.view === 'battle') renderBattle();
  paintFavBtn();
  refreshModal();
  if (wanted?.type === 'favs') location.hash = '#/teams';
  else if (wanted?.type === 'fav' && BYID.has(wanted.id)) openTeamPick(wanted.id);
}
// la presencia solo cuenta mientras la pestaña está a la vista
document.addEventListener('visibilitychange', () => {
  if (!auth.currentUser()) return;
  if (document.hidden) auth.untrackPresence().catch(() => {}); else auth.trackPresence().catch(() => {});
});

// ───────────────────────── Ventanas: elegir equipo y buscador de Pokémon ─────────────────────────
let pickId = null;     // Pokémon que se está guardando
let pickCtx = null;    // { mode: 'team', slot } | { mode: 'avatar' }
const openTeamPick = id => { pickId = id; showModal('teampick'); };
function teamPickHTML() {
  const p = BYID.get(pickId);
  return `<div class="scard" role="dialog" aria-modal="true" aria-label="${t('pickTeamTitle')}">
    <div class="shead"><button class="iconbtn" data-act="settings-close" aria-label="${t('close')}">${IC.x}</button><h2>${t('pickTeamTitle')}</h2></div>
    <p class="shint">${t('pickTeamText', { name: esc(pname(p)) })}</p>
    <div class="slotlist">${teams.map((tm, i) => {
      const has = tm.members.some(m => m.id === pickId), full = tm.members.length >= MAXTEAM && !has;
      return `<button class="slotopt ${has ? 'on' : ''}" data-act="team-toggle" data-v="${i}" ${full ? 'disabled' : ''}>
        <span class="sn">${i + 1}</span>
        <span class="sname"><b>${esc(teamName(i))}</b><span class="minis">${tm.members.map(m => miniPoke(m.id)).join('') || `<small>${t('teamEmpty')}</small>`}</span></span>
        <span class="scount">${tm.members.length}/${MAXTEAM}</span>
        <span class="sck">${has ? IC.check : full ? '' : IC.plus}</span></button>`;
    }).join('')}</div></div>`;
}
const pkMatches = q => {
  const f = fold(q.trim());
  const base = INDEX.filter(p => !p.g || pickCtx?.mode !== 'avatar');
  if (!f) return (pickCtx?.mode === 'avatar' ? base.filter(p => p.num <= 1025 && !p.fm) : [...base].sort((a, b) => strength(a) - strength(b) || a.num - b.num)).slice(0, 40);
  return base.filter(p => fold(p.es).includes(f) || fold(p.en).includes(f) || fold(p.id).includes(f)).slice(0, 40);
};
function pickerListHTML(q = '') {
  const inTeam = pickCtx?.mode === 'team' ? new Set(teams[pickCtx.slot].members.map(m => m.id)) : new Set();
  const list = pkMatches(q).filter(p => !inTeam.has(p.id));
  if (!list.length) return `<p class="shint">${t('pickerNone')}</p>`;
  return list.map(p => `<button class="pkopt" data-act="pk-pick" data-v="${p.id}">${pokeImg(p, 'small')}<span><b>${esc(pname(p))}</b><small>${dexNum(p.num)}</small></span></button>`).join('');
}
function pickerHTML() {
  const avatar = pickCtx?.mode === 'avatar';
  return `<div class="scard picker" role="dialog" aria-modal="true" aria-label="${t(avatar ? 'avatarPick' : 'addPoke')}">
    <div class="shead"><button class="iconbtn" data-act="settings-close" aria-label="${t('close')}">${IC.x}</button><h2>${t(avatar ? 'avatarPick' : 'addPoke')}</h2></div>
    <input id="pk-q" class="pkq" type="search" placeholder="${t('pickerSearch')}" autocomplete="off" autocapitalize="off" spellcheck="false">
    <div class="pklist">${pickerListHTML()}</div></div>`;
}
const openPicker = ctx => { pickCtx = ctx; showModal('picker'); };
smodal.addEventListener('click', e => { if (e.target === smodal) closeSettings(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });

/** Dock inferior, como en una app móvil */
const dockEl = document.getElementById('dock');
function renderDock() {
  const it = (act, label) => `<button class="dk" data-act="${act}" aria-label="${label}"><span class="ic">${DOCK[act].o}${DOCK[act].f}</span></button>`;
  dockEl.innerHTML = it('dock-home', t('dockHome')) + it('dock-battle', t('dockBattle')) + it('dock-search', t('dockSearch')) + it('dock-favs', t('dockFavs')) + it('dock-settings', t('settings'));
  updateDock();
}
function updateDock() {
  const home = state.view === 'home';
  const on = { 'dock-home': home && state.mode !== 'search', 'dock-search': home && state.mode === 'search', 'dock-battle': state.view === 'battle', 'dock-favs': state.view === 'teams', 'dock-settings': !smodal.hidden };
  dockEl.querySelectorAll('.dk').forEach(b => b.classList.toggle('on', !!on[b.dataset.act]));
}
/** Vuelve al buscador con los filtros que se indiquen (el resto se limpia) */
function goSearch(opts = {}, focus = false) {
  Object.assign(state, { q: '', sort: 'num', dir: 1, types: [], tiers: [], gens: [], favs: false, gen9: false, dd: null, scroll: 0, shown: 40 }, opts);
  state.mode = focus || Object.keys(opts).length ? 'search' : 'home';
  state.focusSearch = focus;
  if (location.hash === '#/' || location.hash === '') renderHome(); else location.hash = '#/';
}
// con el teclado abierto el dock se esconde
document.addEventListener('focusin', e => { if (e.target.matches?.('input, textarea')) document.documentElement.classList.add('kb'); });
document.addEventListener('focusout', () => document.documentElement.classList.remove('kb'));

// ───────────────────────── Tema ─────────────────────────
/** 'system' sigue el modo claro/oscuro del dispositivo (es lo que se usa por defecto) */
function applyTheme(pref) {
  if (pref === 'light' || pref === 'dark') document.documentElement.dataset.theme = pref; else delete document.documentElement.dataset.theme;
}
function setTheme(pref, { save = true } = {}) {
  store.set('pk.theme', pref);
  applyTheme(pref);
  refreshModal();
  if (save) syncProfile();
}
/** Las preferencias (tema e idioma) se guardan en la cuenta */
function syncProfile() {
  if (auth.currentUser()) auth.saveProfile({ theme: themePref(), lang: lang() }).catch(() => {});
}

// ───────────────────────── Idioma ─────────────────────────
/** Vuelve a dibujar la página en la que estás sin moverte de ella ni del scroll */
function repaintCurrent() {
  const y = window.scrollY;
  closeSheet();
  if (state.view === 'pokemon' && page && location.hash.endsWith(page.d.id)) {
    document.title = `${pname(page.d)} · PokeScanner`;
    $app.innerHTML = pokemonHTML();
    $('#stats')?.classList.add('go'); // las barras salen ya llenas: no se vuelven a animar
    window.scrollTo(0, y);
  } else if (['move', 'ability', 'item', 'tier'].includes(state.view) && pageData) {
    paintDetailPage();
    window.scrollTo(0, y);
  } else if (state.view === 'home') {
    state.scroll = y;
    renderHome();
  } else route();
  updateDock();
}
/** Cambia el idioma de toda la web sin sacarte de la página */
function switchLang(to, { save = true } = {}) {
  if (to === lang()) return;
  setLang(to);
  document.documentElement.lang = to;
  renderDock();
  refreshModal();
  repaintCurrent();
  if (save) syncProfile();
}

// ───────────────────────── Datos ─────────────────────────
async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
let dictP = null, learnersP = null, LEARNERS = null, abilP = null, ABIL = null, itemP = null, ITEMS = null;
const getDict = () => (dictP ??= getJSON('data/dict.json').then(d => (DICT = d)).catch(e => { dictP = null; throw e; }));
const getAbil = () => (abilP ??= getJSON('data/abilities.json').then(d => (ABIL = d)).catch(e => { abilP = null; throw e; }));
const getItems = () => (itemP ??= getJSON('data/items.json').then(d => (ITEMS = d)).catch(e => { itemP = null; throw e; }));
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
const statOf = (p, k) => (k === 'bst' ? bst(p.s) : k === 'h' || k === 'w' ? p[k] ?? 0 : p.s[STATS.indexOf(k)]);
const sortVal = (p, k) => (k === 'h' ? `${fmtNum(p.h ?? 0)} m` : k === 'w' ? `${fmtNum(p.w ?? 0)} kg` : statOf(p, k));
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

// ───────────────────────── Páginas de movimiento y habilidad ─────────────────────────
const topbarHTML = () => `<button class="backfab" data-act="back" aria-label="${t('backShort')}">${I.back}</button><div class="topgap"></div>`;
const FIRST = 12; // Pokémon que se enseñan antes de "Ver todos"
const strength = p => tierNum(p.r) || 14; // 1 = más fuerte; LC y NFE cuentan como lo más débil

const fitSets = (k, n) => (n === 1 ? t('fit_set1') : t('fit_sets', { k, n }));
/** Puntúa lo bien que le viene un movimiento a un Pokémon y explica por qué */
function moveFit(m, p, use, total) {
  let sc = 0; const why = [];
  if (use) { sc += 40 + 50 * use / total; why.push(fitSets(use, total)); }
  else why.push(t('fit_lv'));
  if (m.c !== 'e') {
    const stab = p.t.includes(m.t);
    const v = p.s[m.c === 'f' ? 1 : 3];
    if (stab) { sc += 14; why.push(t('fit_stab')); }
    sc += v / 255 * 22;
    if (v >= 100) why.push(`${statName(m.c === 'f' ? 'atk' : 'spa')} ${v}`);
  }
  sc += (14 - strength(p)) * 1.4;
  return { p, sc, why };
}
function fitRow({ p, why }) {
  return `<a class="row" href="#/pokemon/${p.id}" style="--c:${TYPE_COLOR[p.t[0]]}">
    ${pokeImg(p, 'small')}
    <span class="meta"><b>${esc(pname(p))}</b><span class="sub"><span class="types">${p.t.map(typeDot).join('')}</span></span>
      <span class="why">${why.map(esc).join(' · ')}</span></span>
    <span class="side">${tierBadge(p.r, '', p.g)}</span></a>`;
}
const chipPoke = p => `<a class="chip" href="#/pokemon/${p.id}">${pokeImg(p, 'small', 'thumb')}${esc(pname(p))}</a>`;
const byStrength = (a, b) => strength(a) - strength(b) || a.num - b.num;
/** Lista que muestra los primeros y deja ver el resto con un botón */
function listSection(key, title, hint, items, render, wrap) {
  if (!items.length) return '';
  const all = pageExpand.has(key), shown = all ? items : items.slice(0, FIRST);
  return `<section class="sec"><h2>${title} <small>${items.length}</small></h2>${hint ? `<p class="hint">${hint}</p>` : ''}
    <div class="${wrap}">${shown.map(render).join('')}</div>
    ${!all && items.length > shown.length ? `<button class="chip accent more" data-act="more-list" data-v="${key}">${t('showAllN', { n: items.length })}</button>` : ''}</section>`;
}
let pageExpand = new Set(), pageData = null;
let pf = { types: [], tiers: [], open: false }; // filtros de las listas de Pokémon de estas páginas
const pfActive = () => pf.types.length + pf.tiers.length;
const pfPass = p => (!pf.types.length || pf.types.every(ty => p.t.includes(ty))) && (!pf.tiers.length || pf.tiers.includes(p.r));
function pfBar(withTiers = true) {
  const n = pfActive();
  const chip = (act, v, on, inner) => `<button class="chip small" data-act="${act}" data-v="${v}" aria-pressed="${on}">${inner}</button>`;
  return `<div class="pfbar"><div class="pfrow">
      <button class="chip" data-act="pf-toggle" aria-expanded="${pf.open}">${I.adjust}${t('filters')}${n ? ` <span class="badge on">${n}</span>` : ''}</button>
      ${n ? `<button class="chip small ghost" data-act="pf-clear">${t('clearFilters')}</button>` : ''}</div>
    ${pf.open ? `<div class="pfpanel">
      <div class="frow"><span>${t('type')}</span><div class="scroller">${TYPES.map(ty => chip('pf-type', ty, pf.types.includes(ty), `${typeIcon(ty)}${typeName(ty)}`)).join('')}</div></div>
      ${withTiers ? `<div class="frow"><span>${t('tier')} <small>${t('tierHint')}</small></span><div class="scroller">${TIER_ORDER.map(r => chip('pf-tier', esc(r), pf.tiers.includes(r), `${tierNumHTML(r)}${tierLabel(r)}`)).join('')}</div></div>` : ''}
    </div>` : ''}</div>`;
}
const pfEmpty = () => `<section class="sec"><div class="empty"><b>${t('emptyTitle')}</b>${t('emptyHint')}</div></section>`;
const SRC = { move: 'moves', ability: 'abilities', item: 'items', tier: null };
const HTML = { move: moveHTML, ability: abilityHTML, item: itemHTML, tier: tierHTML };

function moveHTML(id) {
  const m = DICT.moves[id], L = LEARNERS[id] || { s: [], l: [] };
  const fit = [
    ...L.s.map(([i, k, n]) => moveFit(m, INDEX[i], k, n)),
    ...L.l.map(i => moveFit(m, INDEX[i], 0, 0)),
  ].filter(f => pfPass(f.p)).sort((x, y) => y.sc - x.sc || byStrength(x.p, y.p));
  const best = fit.slice(0, FIRST);
  const rest = fit.slice(FIRST);
  const all = pageExpand.has('rest');
  const body = fit.length
    ? `<section class="sec"><h2>${t('mv_best')} <small>${best.length}</small></h2><p class="hint">${t('mv_bestNote')}</p>
        <div class="list">${best.map(fitRow).join('')}</div></section>
       ${rest.length ? `<section class="sec"><h2>${t('mv_rest')} <small>${rest.length}</small></h2>
         <div class="list">${(all ? rest : rest.slice(0, 0)).map(fitRow).join('')}</div>
         ${all ? '' : `<button class="chip accent more" data-act="more-list" data-v="rest">${t('showAllN', { n: rest.length })}</button>`}</section>` : ''}`
    : pfActive() ? pfEmpty() : `<section class="sec"><p class="hint">${t('noLearners')}</p></section>`;
  return `${topbarHTML()}
  <section class="mhero" style="--tc:${TYPE_COLOR[m.t]}">
    <span class="mtag">${t('move')}</span>
    <h1>${esc(dn(m))}</h1>
    ${dn2(m) && dn2(m) !== dn(m) ? `<span class="en">${esc(dn2(m))}</span>` : ''}
    <div class="tags">${typePill(m.t)}<span class="chip small ghost">${catIcon(m.c)} ${catName(m.c)}</span></div>
  </section>
  <section class="sec"><div class="kv">
    <div><b>${m.p || '—'}</b><small>${t('power')}</small></div>
    <div><b>${m.a ? m.a + '%' : '—'}</b><small>${t('accuracy')}</small></div>
    <div><b>${m.pp || '—'}</b><small>PP</small></div>
    <div><b>${m.pr > 0 ? '+' + m.pr : m.pr}</b><small>${t('priority')}</small></div>
  </div></section>
  <section class="sec"><h2>${t('description')}</h2><p class="desc">${esc(dd(m)) || `<span class="dim">${t('noDesc')}</span>`}</p></section>
  ${(L.s.length + L.l.length) ? pfBar() : ''}
  ${body}${footerHTML()}`;
}
function abilityHTML(id) {
  const a = DICT.abilities[id], L = ABIL[id] || { s: [], n: [], h: [] };
  const users = L.s.map(([i, k, n]) => ({ p: INDEX[i], r: k / n, why: [fitSets(k, n)] })).filter(x => pfPass(x.p))
    .sort((x, y) => y.r - x.r || byStrength(x.p, y.p));
  const inSets = new Set(L.s.map(x => x[0]));
  const plain = list => list.filter(i => !inSets.has(i)).map(i => INDEX[i]).filter(pfPass).sort(byStrength);
  const normal = plain(L.n), hidden = plain(L.h);
  const none = !users.length && !normal.length && !hidden.length;
  const any = L.s.length + L.n.length + L.h.length > 0;
  return `${topbarHTML()}
  <section class="mhero" style="--tc:var(--accent)">
    <span class="mtag">${t('ability')}</span>
    <h1>${esc(dn(a))}</h1>
    ${dn2(a) && dn2(a) !== dn(a) ? `<span class="en">${esc(dn2(a))}</span>` : ''}
  </section>
  <section class="sec"><h2>${t('description')}</h2><p class="desc">${esc(dd(a)) || `<span class="dim">${t('noDesc')}</span>`}</p></section>
  ${any ? pfBar() : ''}
  ${listSection('users', t('ab_best'), t('ab_bestNote'), users, fitRow, 'list')}
  ${listSection('normal', t('ab_normal'), '', normal, chipPoke, 'chips')}
  ${listSection('hidden', t('ab_hidden'), '', hidden, chipPoke, 'chips')}
  ${none ? (pfActive() ? pfEmpty() : `<section class="sec"><p class="hint">${t('ab_none')}</p></section>`) : ''}
  ${footerHTML()}`;
}

function itemHTML(id) {
  const it = DICT.items[id], L = ITEMS[id] || [];
  const users = L.map(([i, k, n]) => ({ p: INDEX[i], r: k / n, why: [fitSets(k, n)] })).filter(x => pfPass(x.p))
    .sort((x, y) => y.r - x.r || byStrength(x.p, y.p));
  return `${topbarHTML()}
  <section class="mhero" style="--tc:var(--accent)">
    <span class="mtag">${t('item')}</span>
    ${it.i ? itemImg(it, 'big') : ''}
    <h1>${esc(dn(it))}</h1>
    ${dn2(it) && dn2(it) !== dn(it) ? `<span class="en">${esc(dn2(it))}</span>` : ''}
  </section>
  <section class="sec"><h2>${t('description')}</h2><p class="desc">${esc(dd(it)) || `<span class="dim">${t('noDesc')}</span>`}</p></section>
  ${L.length ? pfBar() : ''}
  ${users.length ? listSection('users', t('it_best'), t('it_bestNote'), users, fitRow, 'list') : pfActive() ? pfEmpty() : `<section class="sec"><p class="hint">${t('it_none')}</p></section>`}
  ${footerHTML()}`;
}
function tierHTML(r) {
  const info = tierInfo(r), n = tierNum(r);
  const power = p => bst(p.s) + (p.ns ? 50 : 0); // primero los que tienen build en Smogon; después, por estadísticas totales
  const inTier = INDEX.filter(p => p.r === r && (!pf.types.length || pf.types.every(ty => p.t.includes(ty)))).sort((x, y) => power(y) - power(x) || x.num - y.num)
    .map(p => ({ p, why: [`${t('total')} ${bst(p.s)}`, ...(p.ns ? [t(p.ns === 1 ? 'nBuild1' : 'nBuilds', { n: p.ns })] : [])] }));
  const near = n ? [TIER_ORDER[TIER_ORDER.indexOf(r) - 1], TIER_ORDER[TIER_ORDER.indexOf(r) + 1]].filter(x => x && tierNum(x)) : [];
  const nearChip = x => `<a class="chip" href="#/tier/${x}"><span class="tier" style="--tier:${tierColor(x)}">${tierNumHTML(x)}${esc(tierLabel(x))}</span></a>`;
  const all = pageExpand.has('mons'), shown = all ? inTier : inTier.slice(0, FIRST);
  return `${topbarHTML()}
  <section class="mhero" style="--tc:${tierColor(r)}">
    <span class="mtag">${t('rank')}</span>
    <h1><span class="tier big" style="--tier:${tierColor(r)}">${tierNumHTML(r)}${esc(tierLabel(r))}</span></h1>
    <span class="en">${esc(info ? info.n : r)}</span>
  </section>
  <section class="sec"><h2>${t('meaning')}</h2><p class="desc">${esc(info?.d || t('tierDefault'))}</p>
    <p class="hint">${n ? t('tierPos', { n, m: TIER_MAX }) : t('tierNoScale')}</p>
    ${near.length ? `<div class="chips near">${near.map(nearChip).join('')}</div>` : ''}</section>
  ${pfBar(false)}
  <section class="sec"><h2>${t('tr_best')} <small>${inTier.length}</small></h2><p class="hint">${t('tr_bestNote')}</p>
    ${inTier.length ? '' : `<div class="empty"><b>${t('emptyTitle')}</b>${t('emptyHint')}</div>`}
    <div class="list">${shown.map(fitRow).join('')}</div>
    ${!all && inTier.length > shown.length ? `<button class="chip accent more" data-act="more-list" data-v="mons">${t('showAllN', { n: inTier.length })}</button>` : ''}
    <button class="chip more" data-act="tier-go" data-v="${esc(r)}">${t('tierGo')}</button></section>
  ${footerHTML()}`;
}
async function renderDetailPage(kind, id) {
  state.view = kind;
  const src = SRC[kind];
  window.scrollTo(0, 0);
  pageExpand = new Set();
  pf = { types: [], tiers: [], open: false };
  pageData = { kind, id };
  $app.innerHTML = `<p class="boot">${t('loading', { n: '…' })}</p>`;
  try { await Promise.all([getDict(), kind === 'move' ? getLearners() : kind === 'ability' ? getAbil() : kind === 'item' ? getItems() : null]); }
  catch { $app.innerHTML = `<div class="empty"><b>${t('loadFail')}</b>${t('loadFailHint')}</div>`; return; }
  if (state.view !== kind || pageData.id !== id) return;
  const x = src ? DICT[src][id] : tierInfo(id) || (TIER_ORDER.includes(id) ? { n: id } : null);
  if (!x) { $app.innerHTML = `${topbarHTML()}<div class="empty"><b>${t('notFound')}</b>${t('notFoundHint')}</div>`; return; }
  document.documentElement.style.removeProperty('--accent');
  paintDetailPage();
  applyRestore();
}
/** Vuelve a dibujar la página sin mover el scroll ni la posición de las filas de filtros */
function repaintKeep() {
  const y = window.scrollY, rows = [...document.querySelectorAll('.pfpanel .scroller')].map(s => s.scrollLeft);
  paintDetailPage();
  window.scrollTo(0, y);
  document.querySelectorAll('.pfpanel .scroller').forEach((s, i) => { s.scrollLeft = rows[i] || 0; });
}
function paintDetailPage() {
  if (!pageData) return;
  const { kind, id } = pageData, src = SRC[kind];
  document.title = `${src ? dn(DICT[src][id]) : tierLabel(id)} · PokeScanner`;
  $app.innerHTML = HTML[kind](id);
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
// ───────────────────────── Router ─────────────────────────
// Historial: se recuerdan las últimas 10 páginas (búsqueda, filtros y scroll), así "atrás" te devuelve justo a donde estabas
const snaps = new Map(), SNAP_MAX = 10;
const KEEP = ['mode', 'q', 'sort', 'dir', 'types', 'tiers', 'gens', 'favs', 'gen9', 'shown', 'filtersOpen'];
let curPid = null, pidSeq = 0, navIdx = 0;
const copyKeys = (from, to) => KEEP.forEach(k => { to[k] = Array.isArray(from[k]) ? [...from[k]] : from[k]; });
function remember(pid) {
  const s = { y: window.scrollY };
  copyKeys(state, s);
  snaps.delete(pid); snaps.set(pid, s);
  while (snaps.size > SNAP_MAX) snaps.delete(snaps.keys().next().value);
}
function applyRestore() { if (state.restoreY != null) { window.scrollTo(0, state.restoreY); state.restoreY = null; } }
let backFlag = false;
function route() {
  closeSheet();
  closeSettings();
  if (curPid != null) remember(curPid); // se guarda cómo estaba la página que se deja
  let { pid, idx } = history.state || {};
  if (pid == null) { pid = ++pidSeq; idx = curPid == null ? 0 : navIdx + 1; history.replaceState({ pid, idx }, ''); } // página nueva
  pidSeq = Math.max(pidSeq, pid);
  const back = snaps.get(pid);
  const wentBack = backFlag || (curPid != null && (idx || 0) < navIdx); backFlag = false;
  navIdx = idx || 0; curPid = pid; state.restoreY = null;
  if (back) { copyKeys(back, state); state.scroll = back.y; state.restoreY = back.y; } // se vuelve a una página ya vista: se recupera tal cual
  const m = location.hash.match(/^#\/pokemon\/([a-z0-9]+)/);
  const d = location.hash.match(/^#\/(move|ability|item|tier)\/([A-Za-z0-9]+)/);
  if (state.view === 'battle' && location.hash !== '#/battle') auth.unwatchFriends().catch(() => {});
  if (m) renderPokemon(m[1]); else if (d) renderDetailPage(d[1], d[2]); else if (location.hash === '#/teams') renderTeams(); else if (location.hash === '#/battle') renderBattle(); else renderHome();
  updateDock();
  if (wentBack) { $app.classList.remove('goback'); void $app.offsetWidth; $app.classList.add('goback'); setTimeout(() => $app.classList.remove('goback'), 260); }
}

// ───────────────────────── Inicio ─────────────────────────
const GEN_END = [151, 251, 386, 493, 649, 721, 809, 905, 1025]; // último número de Pokédex de cada generación
const genOf = num => { const i = GEN_END.findIndex(e => num <= e); return i < 0 ? 9 : i + 1; };
const REGION = { es: ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'], en: ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea'] };
const genLabel = g => `${t('genShort', { g })} · ${REGION[lang()][g - 1]}`;
const SORTS = ['num', 'hp', 'atk', 'def', 'spa', 'spd', 'spe', 'bst', 'h', 'w'];
const sortLabel = k => (k === 'num' ? t('num') : statName(k));

function homeHTML() {
  const chip = (attrs, inner, extra = '') => `<button class="chip ${extra}" ${attrs} aria-pressed="false">${inner}</button>`;
  const opt = (act, v, inner) => `<button class="ddopt" role="option" data-act="${act}" data-v="${v}" aria-pressed="false">${inner}<span class="ck">${I.check}</span></button>`;
  const dd = (key, label, hint, options) => `<div class="dd" data-dd="${key}"><button class="ddbtn" data-act="dd-toggle" data-v="${key}" aria-expanded="false"><span class="ddl">${label}</span><span class="ddv" data-dv="${key}"></span><svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
    <div class="ddlist" role="listbox" hidden>${hint ? `<p class="ddhint">${hint}</p>` : ''}${options}</div></div>`;
  return `
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
    ${dd('sort', t('sortBy'), '', SORTS.map(k => opt('sort', k, sortLabel(k) + '<span class="dir"></span>')).join(''))}
    ${dd('type', t('type'), '', TYPES.map(ty => opt('type', ty, `${typeIcon(ty)}${typeName(ty)}`)).join(''))}
    ${dd('tier', t('tier'), t('tierHint'), TIER_ORDER.map(r => opt('tier-f', r, `${tierNumHTML(r)}${tierLabel(r)}`)).join(''))}
    ${dd('gen', t('generation'), '', [1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => opt('gen', g, genLabel(g))).join(''))}
    <div class="frow"><div class="scroller">${chip('data-act="flag" data-v="gen9"', t('gen9Only'))}</div></div>
    <button class="chip ghost clearbtn" data-act="reset" hidden>${t('clearFilters')}</button>
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
  f.querySelectorAll('[data-act="gen"]').forEach(b => b.setAttribute('aria-pressed', state.gens.includes(Number(b.dataset.v))));
  // texto de cada desplegable y cuál está abierto
  const sel = (list, none, name) => (!list.length ? none : list.length <= 2 ? list.map(name).join(', ') : t('nSelected', { n: list.length }));
  const dv = {
    sort: sortLabel(state.sort) + (state.sort !== 'num' || state.dir !== 1 ? (state.dir === -1 ? ' ↓' : ' ↑') : ''),
    type: sel(state.types, t('allM'), typeName), tier: sel(state.tiers, t('allM'), tierLabel), gen: sel(state.gens, t('allF'), g => t('genShort', { g })),
  };
  f.querySelectorAll('.dd').forEach(d => {
    const k = d.dataset.dd, open = state.dd === k;
    $('.ddv', d).textContent = dv[k];
    $('.ddbtn', d).setAttribute('aria-expanded', open);
    $('.ddlist', d).hidden = !open;
  });
  document.querySelectorAll('[data-act="flag"]').forEach(b => b.setAttribute('aria-pressed', !!state[b.dataset.v]));
  document.querySelectorAll('.favn').forEach(n => { n.textContent = favs.size ? `(${favs.size})` : ''; });
  $('.search .clear')?.classList.toggle('on', !!state.q);
  $('.search')?.classList.toggle('filled', !!state.q);
  // el botón "Filtros" muestra cuántos hay activos y abre/cierra el panel
  const active = state.types.length + state.tiers.length + state.gens.length + (state.gen9 ? 1 : 0) + (state.sort !== 'num' || state.dir !== 1 ? 1 : 0);
  $('#fbadge').textContent = active || '';
  $('.clearbtn', f).hidden = !isFiltering();
  $('[data-act="filters-toggle"]').setAttribute('aria-expanded', state.filtersOpen);
  $('#fpanel').classList.toggle('open', state.filtersOpen);
  f.inert = !state.filtersOpen;
}

const isFiltering = () => !!fold(state.q) || state.types.length || state.tiers.length || state.gens.length || state.favs || state.gen9 || state.sort !== 'num' || state.dir !== 1;

function compute() {
  const q = fold(state.q);
  let list = INDEX;
  if (state.favs) list = list.filter(p => favs.has(p.id));
  if (state.gen9) list = list.filter(p => !p.g);
  if (state.types.length) list = list.filter(p => state.types.every(t => p.t.includes(t)));
  if (state.tiers.length) list = list.filter(p => state.tiers.includes(p.r));
  if (state.gens.length) list = list.filter(p => state.gens.includes(genOf(p.num)));
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

// ───────────────────────── Análisis del equipo (favoritos) ─────────────────────────
const partColor = r => (r >= 0.8 ? '#6CC070' : r >= 0.6 ? '#E6C84F' : r >= 0.4 ? '#F0974B' : '#E5645A');
const chipsHTML = chips => (chips.length ? `<div class="fchips">${chips.map(c => (c.type ? typePill(c.type)
  : `<a class="chip small" href="#/pokemon/${c.poke.id}">${pokeImg(c.poke, 'small', 'thumb')}${esc(pname(c.poke))}</a>`)).join('')}</div>` : '');
const findHTML = (f, kind) => `<li class="find ${kind}"><span class="mark" aria-hidden="true">${kind === 'bad' ? '!' : '✓'}</span>
  <div><b>${t(`an_${f.key}_t`, f.vars)}</b><p>${t(`an_${f.key}_d`, f.vars)}</p>${chipsHTML(f.chips)}</div></li>`;
function teamHTML(team) {
  if (team.length < 3) return `<section class="team need"><h4>${t('an_title')}</h4><p>${t('an_need')}</p></section>`;
  const a = analyzeTeam(team);
  const info = scoreInfo(a.score);
  const parts = a.parts.map(p => `<div class="tpart"><span class="k">${t(`an_p_${p.k}`)}</span><span class="v">${Math.round(p.v)}/${p.max}</span>
    <div class="bar"><i style="--w:${(p.v / p.max * 100).toFixed(1)}%;--bc:${partColor(p.v / p.max)}"></i></div></div>`).join('');
  return `<section class="team" aria-label="${t('an_title')}">
    <div class="team-head"><div class="score" style="--sc:${info.c}"><b>${a.score}</b><small>/100</small></div>
      <div><h3>${t(`an_s_${info.k}`)}</h3><p>${t('an_sub', { n: team.length })}</p>${team.length > 6 ? `<p>${t('an_over', { n: team.length })}</p>` : ''}</div></div>
    <div class="tparts">${parts}</div>
    <div><h4 class="bad">${t('an_bad')}</h4>${a.bad.length ? `<ul class="finds">${a.bad.map(f => findHTML(f, 'bad')).join('')}</ul>` : `<p class="note">${t('an_nobad')}</p>`}</div>
    <div><h4 class="good">${t('an_good')}</h4>${a.good.length ? `<ul class="finds">${a.good.map(f => findHTML(f, 'good')).join('')}</ul>` : `<p class="note">${t('an_nogood')}</p>`}</div>
    <p class="note">${t('an_note')}</p></section>`;
}

function tierBadge(r, extra = '', g = 0) { return `<span class="tier" style="--tier:${tierColor(r)}" ${extra}${g ? ` title="${t('tierInGen', { g })}"` : ''}>${tierNumHTML(r)}${esc(tierLabel(r))}${g ? `<small>G${g}</small>` : ''}</span>`; }

function rowCore(p) {
  const showStat = state.sort !== 'num' && state.view === 'home';
  return `<a class="row" href="#/pokemon/${p.id}" style="--c:${TYPE_COLOR[p.t[0]]}">
    ${pokeImg(p, 'small')}
    <span class="meta"><b>${esc(pname(p))}</b><span class="sub"><small>${dexNum(p.num)}${p.fm && p.es !== p.en && lang() === 'es' ? ` · ${esc(p.en)}` : ''}</small><span class="types">${p.t.map(typeDot).join('')}</span></span></span>
    <span class="side">
      ${showStat ? `<span class="statval">${sortVal(p, state.sort)}<small>${statName(state.sort)}</small></span>` : tierBadge(p.r, '', p.g)}
    </span></a>`;
}
function rowHTML(p) {
  const row = rowCore(p);
  // con algún favorito, todas las filas dejan un hueco a la derecha: la estrella amarilla marca los que están en un equipo
  return favs.size ? `<div class="rw hasfav">${row}${favs.has(p.id) ? `<span class="favdot" title="${t('favAddedBtn')}">${IC.starF}</span>` : '<span></span>'}</div>` : row;
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
      <div class="block-title"><h2>${t('daily')}</h2>
        <button class="chip small" data-act="shuffle">${'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>'}${t('random')}</button></div>
      <div class="cards">${state.randoms.map(id => cardHTML(BYID.get(id))).join('')}</div>`;
    return;
  }

  const list = (state.list = compute());
  const mv = movesBlock(searchMoves(fold(state.q)));
  const head = mv + `<div class="block-title tight"><h2>${t(list.length === 1 ? 'result1' : 'resultN', { n: list.length })}</h2></div>`;
  if (!list.length) {
    // si no hay Pokémon pero sí movimientos, solo se muestran los movimientos
    box.innerHTML = mv || head + `<div class="empty"><b>${t(state.favs ? 'emptyTitleFavs' : 'emptyTitle')}</b>${state.favs && !favs.size ? t('emptyFavs') : t('emptyHint')}</div>`;
    return;
  }
  // en la vista de favoritos (sin otros filtros) se analiza el equipo
  const analysis = '';
  box.innerHTML = head + `<div class="list">${list.slice(0, state.shown).map(rowHTML).join('')}</div><div class="sentinel"></div>` + analysis;
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
  if (state.focusSearch) { state.focusSearch = false; window.scrollTo(0, 0); $('#q')?.focus(); }
  updateDock();
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
  const formats = [...new Set(d.sets.map(s => s.f))].sort((x, y) => formatRank(x) - formatRank(y));
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

const favBtnInner = on => (on ? `${IC.starF}${t('favAddedBtn')}` : `${IC.star}${t('favAddBtn')}`);
function pokemonHTML() {
  const { d } = page;
  const isFav = favs.has(d.id);
  const same = d.es === d.en;
  const abilities = d.ab.map(a => `<button class="chip" data-act="ability" data-v="${a.id}">${esc(dn(DICT.abilities[a.id]))}${a.h ? ` <small>${t('hidden')}</small>` : ''}</button>`).join('');
  return `
  ${topbarHTML()}
  <section class="phero" aria-label="${esc(pname(d))}">
    ${pokeImg({ sp: d.sp, ss: d.ss }, 'art', 'art', 300).replace('loading="lazy"', 'fetchpriority="high"')}
    <span class="num">${dexNum(d.num)}</span>
    <h1>${esc(pname(d))}</h1>
    ${same ? '' : `<span class="en">${esc(pname2(d))}</span>`}
    <div class="tags">${d.t.map(typePill).join('')}</div>
    <div class="rank"><small>${t('rank')}</small><button class="tier" style="--tier:${tierColor(d.r)}" data-act="tier" data-v="${esc(d.r)}" aria-label="${t('rankAria', { r: esc(tierLabel(d.r)) })}">${tierNumHTML(d.r)}${esc(tierLabel(d.r))}</button>
      ${d.g ? `<small>· ${t('gen', { g: d.g })}</small>` : ''}${d.dr ? `<small>· ${t('doubles', { r: esc(tierLabel(d.dr)) })}</small>` : ''}</div>
    <div class="facts">${d.h != null ? `<button data-act="size-go" data-v="h">${t('height')} <b>${fmtNum(d.h)} m</b></button>` : ''}${d.w != null ? `<button data-act="size-go" data-v="w">${t('weight')} <b>${fmtNum(d.w)} kg</b></button>` : ''}</div>
  </section>
  <button class="favbtn" data-act="fav" aria-pressed="${isFav}">${favBtnInner(isFav)}</button>

  ${d.g ? oldNote(d) : ''}
  <section class="sec"><h2>${t('baseStats')}</h2><div id="stats">${statsHTML(d.s)}</div>
    <button class="compare-btn" data-act="compare">${I.compare}${t('compare')}</button></section>

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
    $app.innerHTML = `${topbarHTML()}
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
  applyRestore();
}

// ───────────────────────── Comparador ─────────────────────────
// orden fijo: azul, rojo, verde, amarillo, rosa, morado, marrón, celeste
const CMP_COLORS = ['#2F6BEA', '#E5484D', '#30A46C', '#F2C012', '#EC6BB0', '#8E4EC6', '#8B5E3C', '#5CC8F2'];
const cmpColor = i => CMP_COLORS[i % CMP_COLORS.length]; // del noveno en adelante los colores se repiten
const CMP_MAX = 11; // además del Pokémon de la ficha (12 en total)
function openCompare() {
  const base = BYID.get(page.d.id);
  cmp = { base, others: [] };
  openSheet(t('cmpTitle'), `
    <div class="legend" id="cmp-legend"></div>
    <div class="cmp-search"><input id="cmp-q" type="text" role="searchbox" inputmode="search" enterkeyhint="search" placeholder="${t('cmpPh', { n: CMP_MAX })}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-form-type="other" data-lpignore="true" aria-label="${t('cmpAria')}"></div>
    <div class="suggest" id="cmp-suggest"></div>
    <div class="cmp" id="cmp-bars"></div>`, { wide: true });
  renderCompare();
}
function renderCompare() {
  const all = [cmp.base, ...cmp.others];
  $('#cmp-legend').innerHTML = all.map((p, i) => `<span class="chip" style="--k:${cmpColor(i)}"><i></i>${esc(pname(p))}${i ? `<button class="x" data-act="remove" data-v="${p.id}" aria-label="${t('remove', { n: esc(pname(p)) })}">×</button>` : ''}</span>`).join('');
  const bars = $('#cmp-bars');
  const keys = [...STATS, 'bst'];
  bars.innerHTML = keys.map(k => {
    const vals = all.map(p => statOf(p, k));
    const max = Math.max(...vals);
    const scale = k === 'bst' ? 800 : 255;
    return `<div class="cmp-stat ${k === 'bst' ? 'cmp-total' : ''}"><span class="k">${statName(k)}</span>${vals.map((v, i) => {
      const diff = v - vals[0];
      const d = i === 0 ? '' : diff === 0 ? '=' : (diff > 0 ? '+' : '−') + Math.abs(diff);
      return `<div class="cmp-line ${v === max ? 'best' : ''}"><div class="bar"><i style="--w:${Math.min(100, v / scale * 100).toFixed(1)}%;--bc:${cmpColor(i)};--i:${i}"></i></div>
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

// ───────────────────────── Favoritos: 9 equipos ─────────────────────────
const teamsSel = { open: 0 };
const loginCta = (title, action) => `<div class="empty"><b>${t(title)}</b>${t('loginText')}<div class="ctarow"><button class="chip accent" data-act="login-open" data-v="${action}">${IC.user}${t('loginGoogle')}</button></div></div>`;
function memberRow(p) {
  return `<div class="mrow">${rowCore(p)}<button class="iconbtn" data-act="team-remove" data-v="${p.id}" aria-label="${t('removePoke')}">${IC.trash}</button></div>`;
}
function slotHTML(i) {
  const tm = teams[i], open = teamsSel.open === i;
  const members = tm.members.map(m => BYID.get(m.id)).filter(Boolean);
  const body = !open ? '' : `<div class="slotbody">
    <label class="tname"><span>${t('teamName')}</span><input class="unin" id="tn" data-slot="${i}" value="${esc(tm.name)}" placeholder="${t('teamN', { n: i + 1 })}" maxlength="24" autocomplete="off" autocapitalize="sentences"></label>
    ${members.length ? `<div class="list">${members.map(memberRow).join('')}</div>` : `<p class="shint">${t('teamEmptyHint')}</p>`}
    ${members.length < MAXTEAM ? `<button class="chip" data-act="slot-add">${IC.plus}${t('addPoke')}</button>` : ''}
    ${members.length ? teamHTML(members) : ''}</div>`;
  return `<section class="slot ${open ? 'open' : ''}">
    <button class="slothead" data-act="slot-open" data-v="${i}" aria-expanded="${open}">
      <span class="sn">${i + 1}</span>
      <span class="sname"><b>${esc(teamName(i))}</b><span class="minis">${members.map(p => pokeImg(p, 'small', 'mini')).join('') || `<small>${t('teamEmpty')}</small>`}</span></span>
      <span class="scount">${members.length}/${MAXTEAM}</span><span class="chev">${I.down}</span></button>${body}</section>`;
}
function teamsHTML() {
  if (!auth.currentUser()) return `<header class="hero"><h1>${t('teamsTitle')}</h1><p>${t('teamsLead')}</p></header>${loginCta('loginTitle', 'favs')}`;
  return `<header class="hero"><h1>${t('teamsTitle')}</h1><p>${t('teamsLead')}</p></header><div class="slots">${teams.map((_, i) => slotHTML(i)).join('')}</div>`;
}
function paintTeams() {
  const root = $('#teams-root'); if (!root) return;
  const y = window.scrollY;
  root.innerHTML = teamsHTML();
  window.scrollTo(0, y);
}
function renderTeams() {
  state.view = 'teams';
  document.title = `${t('teamsTitle')} · PokeScanner`;
  document.documentElement.style.removeProperty('--accent');
  $app.innerHTML = '<div id="teams-root"></div>';
  paintTeams();
  window.scrollTo(0, 0);
  updateDock();
}

// ───────────────────────── Batalla ─────────────────────────
const bt = { friends: [], online: new Map(), others: new Map(), a: { owner: 'me', slot: 0 }, b: { owner: 'me', slot: 1 }, res: null, busy: false, msg: '', live: false };
const friendById = id => bt.friends.find(f => f.user_id === id);
const frAvatar = f => avatarImg(f.avatar);
const teamOf = sel => (sel.owner === 'me' ? teams[sel.slot] : bt.others.get(sel.owner)?.[sel.slot] || null);
const ownerName = sel => (sel.owner === 'me' ? t('yourTeam') : t('teamOf', { name: friendById(sel.owner)?.username || '?' }));
const sideName = sel => { const tm = teamOf(sel); return `${ownerName(sel)} · ${esc(tm?.name || t('teamN', { n: sel.slot + 1 }))}`; };

async function refreshFriends() {
  try { bt.friends = await auth.friendsList(); } catch { bt.friends = []; toast(t('syncFail')); }
  try {
    const rows = await auth.loadAllTeams();
    bt.others = new Map();
    rows.filter(r => r.user_id !== auth.currentUser().id).forEach(r => {
      if (!bt.others.has(r.user_id)) bt.others.set(r.user_id, Array.from({ length: SLOTS }, () => ({ name: '', members: [] })));
      bt.others.get(r.user_id)[r.slot] = { name: r.name || '', members: (r.members || []).filter(m => BYID.has(m.id)) };
    });
  } catch { /* sin equipos de amigos */ }
  const ids = new Set(bt.friends.filter(f => f.direction === 'friend').map(f => f.user_id));
  if (bt.b.owner !== 'me' && !ids.has(bt.b.owner)) bt.b = { owner: 'me', slot: bt.b.slot };
}
async function watchBattle() {
  const ids = bt.friends.filter(f => f.direction === 'friend').map(f => f.user_id);
  await auth.watchFriends(ids, {
    onOnline: (id, on) => { bt.online.set(id, on); if (state.view === 'battle') paintBattle(); },
    onTeam: row => {
      if (row.user_id === auth.currentUser()?.id) return;
      if (!friendById(row.user_id)) return;
      if (!bt.others.has(row.user_id)) bt.others.set(row.user_id, Array.from({ length: SLOTS }, () => ({ name: '', members: [] })));
      bt.others.get(row.user_id)[row.slot] = { name: row.name || '', members: (row.members || []).filter(m => BYID.has(m.id)) };
      if (state.view !== 'battle') return;
      if (bt.res && bt.b.owner === row.user_id && bt.b.slot === row.slot) { toast(t('liveUpdated', { name: friendById(row.user_id).username })); runCompare(); } else paintBattle();
    },
    onFriends: async () => { await refreshFriends(); if (state.view === 'battle') { paintBattle(); watchBattle(); } },
  });
}
async function renderBattle() {
  state.view = 'battle';
  document.title = `${t('battleTitle')} · PokeScanner`;
  document.documentElement.style.removeProperty('--accent');
  $app.innerHTML = '<div id="battle-root"></div>';
  window.scrollTo(0, 0);
  updateDock();
  if (!auth.currentUser()) { paintBattle(); return; }
  paintBattle();
  await refreshFriends();
  if (state.view !== 'battle') return;
  paintBattle();
  watchBattle().catch(() => {});
}
const optLabel = (i, tm) => `${i + 1}. ${tm.name || t('teamN', { n: i + 1 })} (${tm.members.length}/${MAXTEAM})`;
function teamSelect(id, side) {
  const sel = bt[side];
  const val = `${sel.owner}:${sel.slot}`;
  const mine = `<optgroup label="${t('mineGroup')}">${teams.map((tm, i) => `<option value="me:${i}" ${val === `me:${i}` ? 'selected' : ''}>${esc(optLabel(i, tm))}</option>`).join('')}</optgroup>`;
  const theirs = bt.friends.filter(f => f.direction === 'friend').map(f => {
    const list = (bt.others.get(f.user_id) || []).map((tm, i) => [tm, i]).filter(([tm]) => tm.members.length);
    return list.length ? `<optgroup label="${esc(t('friendGroup', { name: f.username }))}">${list.map(([tm, i]) => `<option value="${f.user_id}:${i}" ${val === `${f.user_id}:${i}` ? 'selected' : ''}>${esc(optLabel(i, tm))}</option>`).join('')}</optgroup>` : '';
  }).join('');
  return `<select id="${id}" class="tsel" data-side="${side}" aria-label="${t(side === 'a' ? 'yourTeam' : 'rivalTeam')}">${mine}${theirs}</select>`;
}
const sidePreview = (sel, cls) => {
  const tm = teamOf(sel);
  const ps = (tm?.members || []).map(m => BYID.get(m.id)).filter(Boolean);
  return `<div class="side ${cls}"><small>${ownerName(sel)}</small><b>${esc(tm?.name || t('teamN', { n: sel.slot + 1 }))}</b><span class="minis">${ps.map(p => pokeImg(p, 'small', 'mini')).join('') || `<small>${t('teamEmpty')}</small>`}</span></div>`;
};
function friendRow(f) {
  const on = !!bt.online.get(f.user_id);
  if (f.direction === 'in') return `<div class="frow"><span class="fav">${frAvatar(f)}</span><span class="fname"><b>${esc(f.username)}</b><small>${t('friendWants')}</small></span>
    <button class="iconbtn ok" data-act="friend-accept" data-v="${f.user_id}" aria-label="${t('accept')}">${IC.check}</button><button class="iconbtn" data-act="friend-decline" data-v="${f.user_id}" aria-label="${t('decline')}">${IC.x}</button></div>`;
  if (f.direction === 'out') return `<div class="frow"><span class="fav">${frAvatar(f)}</span><span class="fname"><b>${esc(f.username)}</b><small>${t('friendPending')}</small></span>
    <button class="iconbtn" data-act="friend-decline" data-v="${f.user_id}" aria-label="${t('decline')}">${IC.x}</button></div>`;
  return `<div class="frow"><span class="fav">${frAvatar(f)}<i class="dot ${on ? 'on' : ''}" title="${t(on ? 'friendOnline' : 'friendOffline')}"></i></span>
    <span class="fname"><b>${esc(f.username)}</b><small class="${on ? 'live' : ''}">${t(on ? 'friendOnline' : 'friendOffline')}</small></span>
    <button class="iconbtn" data-act="friend-remove" data-v="${f.user_id}" aria-label="${t('friendRemove')}">${IC.trash}</button></div>`;
}
function battleHTML() {
  const head = `<header class="hero"><h1>${t('battleTitle')}</h1><p>${t('battleLead')}</p></header>`;
  if (!auth.currentUser()) return head + loginCta('loginTitle', 'battle');
  const inc = bt.friends.filter(f => f.direction === 'in'), fr = bt.friends.filter(f => f.direction === 'friend'), out = bt.friends.filter(f => f.direction === 'out');
  const friendsSec = `<section class="sec"><div class="block-title"><h2>${t('friends')}</h2></div>
    <div class="frform"><input id="fr-name" class="unin" placeholder="${t('friendAddPh')}" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="chip accent" data-act="friend-add">${IC.userPlus}${t('friendAdd')}</button></div>
    ${bt.msg ? `<small class="unmsg">${esc(bt.msg)}</small>` : ''}
    <div class="frlist">${[...inc, ...fr, ...out].map(friendRow).join('') || `<p class="shint">${t('friendNone')}</p>`}</div></section>`;
  const compare = `<section class="sec"><div class="block-title"><h2>${t('compareTitle')}</h2>${bt.res && bt.b.owner !== 'me' ? `<span class="livebadge"><i></i>${t('live')}</span>` : ''}</div>
    <div class="vsgrid"><div class="vscol">${teamSelect('sel-a', 'a')}${sidePreview(bt.a, 'a')}</div><span class="vs">${t('vs')}</span><div class="vscol">${teamSelect('sel-b', 'b')}${sidePreview(bt.b, 'b')}</div></div>
    <button class="gbtn comparebtn" data-act="compare" ${bt.busy ? 'disabled' : ''}>${IC.battle}${t(bt.busy ? 'comparing' : 'compareBtn')}</button>
    ${bt.cmpMsg ? `<small class="unmsg">${esc(bt.cmpMsg)}</small>` : ''}</section>`;
  return head + friendsSec + compare + (bt.res ? resultHTML() : '');
}
function paintBattle() {
  const root = $('#battle-root'); if (!root) return;
  const y = window.scrollY, typed = $('#fr-name')?.value || '', focus = document.activeElement?.id === 'fr-name';
  root.innerHTML = battleHTML();
  const inp = $('#fr-name'); if (inp && typed) { inp.value = typed; if (focus) inp.focus(); }
  window.scrollTo(0, y);
}
async function runCompare() {
  const A = teamOf(bt.a), B = teamOf(bt.b);
  bt.cmpMsg = '';
  if (!A?.members.length || !B?.members.length) { bt.cmpMsg = t('compareEmpty'); paintBattle(); return; }
  bt.busy = true; paintBattle();
  try {
    const dict = await getDict();
    const load = ms => Promise.all(ms.map(async m => buildUnit(await getPokemon(m.id), m, dict)));
    const [ua, ub] = await Promise.all([load(A.members), load(B.members)]);
    bt.res = { r: compareTeams(ua, ub), ua, ub, aName: sideName(bt.a), bName: sideName(bt.b), aMine: bt.a.owner === 'me', bMine: bt.b.owner === 'me' };
  } catch { bt.cmpMsg = t('loadFail'); }
  bt.busy = false;
  if (state.view === 'battle') paintBattle();
}

// ───── resultado ─────
const fmtVars = v => Object.fromEntries(Object.entries(v || {}).map(([k, x]) => [k, k === 'type' ? typeName(x) : k === 'name' ? esc(pname(x)) : k === 'list' ? x.map(p => esc(pname(p))).join(', ') : x]));
const resistSuggestions = type => INDEX.filter(p => !p.g && strength(p) <= 6 && eff(type, p.t) < 1).sort((a, b) => strength(a) - strength(b) || bst(b.s) - bst(a.s)).slice(0, 4);
function tipHTML(tp) {
  const sug = tp.resist ? resistSuggestions(tp.resist) : (tp.ids || []).map(id => BYID.get(id)).filter(Boolean).slice(0, 4);
  return `<li>${t(`tp_${tp.key}`, fmtVars(tp.vars))}${sug.length ? `<div class="sugs"><small>${t('tpSuggest')}</small>${sug.map(chipPoke).join('')}</div>` : ''}</li>`;
}
const cellColor = s => (s > 0 ? `color-mix(in srgb, #2FAE5F ${Math.round(18 + Math.abs(s) * 72)}%, var(--surface))` : s < 0 ? `color-mix(in srgb, #E5484D ${Math.round(18 + Math.abs(s) * 72)}%, var(--surface))` : 'var(--soft)');
function resultHTML() {
  const { r, ua, ub, aName, bName } = bt.res;
  const pa = Math.round(r.pA * 100), pb = 100 - pa;
  const winName = r.win === 'A' ? aName : bName;
  const rs = r.reasons.length ? `<ol class="reasons">${r.reasons.map(x => `<li>${t(`br_${x.key}${x.key === 'hazards' && !x.vars.noRemoval ? '_b' : ''}`, fmtVars(x.vars))}</li>`).join('')}</ol>` : `<p class="shint">${t('noReasons')}</p>`;
  const tipBlock = (name, tips, mine) => `<div class="tipbox"><h3>${t('tipsTitle', { name })}</h3>${tips.length ? `<ul class="tips">${tips.map(tipHTML).join('')}</ul>` : `<p class="shint">${t('tipsNone')}</p>`}</div>`;
  const loserTips = r.win === 'A' ? tipBlock(bName, r.tipsB) : tipBlock(aName, r.tipsA);
  const winnerTips = r.close ? (r.win === 'A' ? tipBlock(aName, r.tipsA) : tipBlock(bName, r.tipsB)) : '';
  const matrix = `<div class="mxwrap"><table class="mx"><thead><tr><th></th>${ub.map(u => `<th>${pokeImg(u.p, 'small', 'mini')}</th>`).join('')}</tr></thead><tbody>${ua.map((a, i) => `<tr><th>${pokeImg(a.p, 'small', 'mini')}</th>${ub.map((b, j) => {
    const s = r.matrix[i][j].s;
    return `<td style="background:${cellColor(s)}" title="${esc(pname(a.p))} ${s > 0 ? '>' : s < 0 ? '<' : '='} ${esc(pname(b.p))}">${s > 0.001 ? '✓' : s < -0.001 ? '✕' : '–'}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table></div>`;
  const maxSpe = Math.max(...r.speeds.map(x => x.u.spe));
  const speed = r.speeds.map(x => `<div class="spd ${x.side}"><span class="sp">${pokeImg(x.u.p, 'small', 'mini')}</span><span class="n">${esc(pname(x.u.p))}</span><div class="bar"><i style="--w:${(x.u.spe / maxSpe * 100).toFixed(1)}%"></i></div><b>${x.u.spe}</b></div>`).join('');
  const star = (rows, label) => {
    const sorted = [...rows].sort((p, q) => q.score - p.score);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    return `<div class="stars"><b>${label}</b><div class="starrow"><span class="stag good">${t('mvp')}</span>${chipPoke(best.u.p)}</div>${rows.length > 1 ? `<div class="starrow"><span class="stag bad">${t('weakestLink')}</span>${chipPoke(worst.u.p)}</div>` : ''}</div>`;
  };
  const f = r.factors;
  const FACT = [['duels', f.duels], ['speed', f.speed], ['hazards', f.hazards], ['support', f.support]];
  const fmax = Math.max(0.6, ...FACT.map(([, v]) => Math.abs(v)));
  const factors = FACT.map(([k, v]) => `<div class="fact"><span>${t(`f_${k}`)}</span><div class="fbar"><i class="${v >= 0 ? 'a' : 'b'}" style="width:${(Math.abs(v) / fmax * 50).toFixed(1)}%;${v >= 0 ? 'right:50%' : 'left:50%'}"></i></div></div>`).join('');
  return `<section class="sec result">
    <div class="block-title"><h2>${t('resultTitle')}</h2></div>
    <div class="resbox"><div class="vsnames"><span class="na">${aName}</span><span class="nb">${bName}</span></div>
      <div class="vsbar" role="img" aria-label="${pa}% / ${pb}%"><i class="va" style="width:${pa}%"><b>${pa}%</b></i><i class="vb"><b>${pb}%</b></i></div>
      <h3 class="winline">${r.close ? t('resEven') : t('resWin', { name: winName })}</h3>
      <p class="shint">${t('resChance', { p: r.pct, name: winName })}</p></div>
    <div class="block-title"><h2>${t('whyTitle')}</h2></div>${rs}
    <div class="block-title"><h2>${t('improveTitle')}</h2></div>${loserTips}${winnerTips}
    <div class="block-title"><h2>${t('extraMatrix')}</h2></div><p class="shint">${t('extraMatrixHint')}</p>${matrix}
    <div class="block-title"><h2>${t('extraStars')}</h2></div><div class="starsgrid">${star(r.rowA, aName)}${star(r.rowB, bName)}</div>
    <div class="block-title"><h2>${t('extraSpeed')}</h2></div><div class="spdlist">${speed}</div>
    <div class="block-title"><h2>${t('extraFactors')}</h2></div><div class="factors">${factors}</div><p class="shint facthint"><span>← ${aName}</span><span>${bName} →</span></p>
    <p class="note">${t('resNote')}</p></section>`;
}

// ───────────────────────── Eventos ─────────────────────────
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'pk-q') { const l = $('.pklist'); if (l) l.innerHTML = pickerListHTML(e.target.value); return; }
  if (id === 'un') { onUsernameInput(e.target); return; }
  if (id === 'tn') {
    const i = Number(e.target.dataset.slot);
    teams[i].name = e.target.value.slice(0, 24); saveSlot(i);
    const b = document.querySelector('.slot.open .slothead b'); if (b) b.textContent = teamName(i);
    return;
  }
  if (id !== 'q') return;
  state.q = e.target.value;
  renderResults();
  // al escribir, el buscador sube a lo alto de la pantalla para ver cuantos más resultados mejor
  const top = $('.searchbar')?.getBoundingClientRect().top;
  if (state.q && top > 2) window.scrollBy({ top, behavior: 'instant' });
});

/** Nombre de usuario: comprueba en el servidor si está libre y no es ofensivo */
let unTimer = null;
function onUsernameInput(el) {
  const v = el.value.trim(), msg = $('#un-msg'), btn = $('[data-act="un-save"]');
  if (!msg || !btn) return;
  btn.disabled = true; clearTimeout(unTimer);
  const set = (txt, cls = '') => { msg.textContent = txt; msg.className = `unmsg ${cls}`; };
  if (v === me?.username) return set(t('unHint'));
  if (!/^[A-Za-z0-9_]{3,16}$/.test(v)) return set(t('un_invalid'), 'bad');
  set('…');
  unTimer = setTimeout(async () => {
    const st = await auth.checkUsername(v);
    if ($('#un')?.value.trim() !== v) return;
    set(t(`un_${st}`), st === 'ok' ? 'ok' : 'bad');
    btn.disabled = st !== 'ok';
  }, 300);
}
async function saveUsername() {
  const v = $('#un')?.value.trim(); if (!v) return;
  const st = await auth.saveIdentity({ username: v });
  if (st === 'ok') { me.username = v; refreshModal(); toast(t('un_saved')); } else { const m = $('#un-msg'); if (m) { m.textContent = t(`un_${st}`); m.className = 'unmsg bad'; } }
}
async function setAvatar(num) {
  const st = await auth.saveIdentity({ avatar: num });
  if (st === 'ok') me.avatar = num; else toast(t('un_error'));
  showModal('settings');
}
async function addFriend() {
  const inp = $('#fr-name'), name = inp?.value.trim(); if (!name) return;
  let code;
  try { code = await auth.sendFriendRequest(name); } catch { code = 'error'; }
  bt.msg = code === 'sent' ? t('fr_sent', { name }) : t(`fr_${code}`);
  if (code === 'sent' || code === 'accepted') { if (inp) inp.value = ''; await refreshFriends(); watchBattle(); }
  paintBattle();
}
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'fr-name') { e.preventDefault(); addFriend(); } });
document.addEventListener('change', e => {
  const el = e.target;
  if (el.classList?.contains('tsel')) {
    const k = el.value.lastIndexOf(':');
    bt[el.dataset.side] = { owner: el.value.slice(0, k), slot: Number(el.value.slice(k + 1)) };
    bt.res = null; bt.cmpMsg = ''; paintBattle();
  }
});
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const v = el.dataset.v;
  switch (el.dataset.act) {
    case 'settings': { const p = el.parentElement.querySelector('.spanel'), open = p.hidden; closeSettings(); p.hidden = !open; el.setAttribute('aria-expanded', String(open)); break; }
    case 'set-theme': setTheme(v); break;
    case 'set-lang': switchLang(v); break;
    case 'filters-toggle': state.filtersOpen = !state.filtersOpen; syncFilters(); break;
    case 'close': closeSheet(); break;
    case 'back': backFlag = true; if (navIdx > 0) history.back(); else if (location.hash === '#/' || !location.hash) route(); else location.hash = '#/'; break;
    case 'pf-toggle': pf.open = !pf.open; repaintKeep(); break;
    case 'pf-clear': pf.types = []; pf.tiers = []; pageExpand = new Set(); repaintKeep(); break;
    case 'pf-type': pf.types = pf.types.includes(v) ? pf.types.filter(x => x !== v) : [...pf.types, v]; pageExpand = new Set(); repaintKeep(); break;
    case 'pf-tier': pf.tiers = pf.tiers.includes(v) ? pf.tiers.filter(x => x !== v) : [...pf.tiers, v]; pageExpand = new Set(); repaintKeep(); break;
    case 'more-list': { const y = window.scrollY; pageExpand.add(v); paintDetailPage(); window.scrollTo(0, y); break; }

    // inicio
    case 'dd-toggle': state.dd = state.dd === v ? null : v; syncFilters(); break;
    case 'gen': { const g = Number(v); state.gens = (state.gens.includes(g) ? state.gens.filter(x => x !== g) : [...state.gens, g]).sort((x, y) => x - y); renderResults(); break; }
    case 'sort':
      if (state.sort === v) state.dir *= -1; else { state.sort = v; state.dir = v === 'num' ? 1 : -1; }
      state.dd = null; renderResults(); break;
    case 'type':
      state.types = state.types.includes(v) ? state.types.filter(t => t !== v) : [...state.types, v].slice(-2);
      renderResults(); break;
    case 'tier-f':
      state.tiers = state.tiers.includes(v) ? state.tiers.filter(t => t !== v) : [...state.tiers, v];
      renderResults(); break;
    case 'flag': if (v === 'favs' && !state.favs && !requireLogin({ type: 'favs' })) break; state[v] = !state[v]; renderResults(); break;
    case 'clear-q': state.q = ''; $('#q').value = ''; $('#q').focus(); renderResults(); break;
    case 'reset':
      Object.assign(state, { q: '', sort: 'num', dir: 1, types: [], tiers: [], gens: [], favs: false, gen9: false, dd: null });
      $('#q').value = ''; renderResults(); break;
    case 'shuffle': { const pool = INDEX.filter(p => !p.g); location.hash = '#/pokemon/' + pool[Math.floor(Math.random() * pool.length)].id; break; }
    case 'tier-go': goSearch({ tiers: [v] }); break;

    // ficha
    case 'fav': if (requireLogin({ type: 'fav', id: page.d.id })) openTeamPick(page.d.id); break;
    case 'login-open': openLogin({ type: v }); break;
    case 'team-toggle': {
      const i = Number(v), had = teams[i].members.some(m => m.id === pickId), p = BYID.get(pickId);
      if (toggleInTeam(i, pickId)) { closeSettings(); toast(t(had ? 'removedFrom' : 'addedTo', { name: pname(p), team: teamName(i) })); }
      break;
    }
    case 'slot-open': teamsSel.open = teamsSel.open === Number(v) ? -1 : Number(v); paintTeams(); break;
    case 'slot-add': if (teamsSel.open >= 0) openPicker({ mode: 'team', slot: teamsSel.open }); break;
    case 'team-remove': if (teamsSel.open >= 0) toggleInTeam(teamsSel.open, v); break;
    case 'pk-pick':
      if (pickCtx?.mode === 'avatar') setAvatar(BYID.get(v).num);
      else if (pickCtx?.mode === 'team') {
        toggleInTeam(pickCtx.slot, v);
        if (teams[pickCtx.slot].members.length >= MAXTEAM) closeSettings();
        else { const l = $('.pklist'); if (l) l.innerHTML = pickerListHTML($('#pk-q')?.value || ''); }
      }
      break;
    case 'avatar-pick': openPicker({ mode: 'avatar' }); break;
    case 'un-save': saveUsername(); break;
    case 'friend-add': addFriend(); break;
    case 'friend-accept': auth.respondFriend(v, true).then(() => refreshFriends()).then(() => { paintBattle(); watchBattle(); }).catch(() => toast(t('syncFail'))); break;
    case 'friend-decline': auth.respondFriend(v, false).then(() => auth.removeFriend(v)).catch(() => {}).then(() => refreshFriends()).then(() => { paintBattle(); watchBattle(); }); break;
    case 'friend-remove': auth.removeFriend(v).then(() => refreshFriends()).then(() => { if (bt.b.owner === v) bt.b = { owner: 'me', slot: 1 }; bt.res = null; paintBattle(); watchBattle(); }).catch(() => toast(t('syncFail'))); break;
    case 'compare': runCompare(); break;
    case 'sign-in': startLogin(); break;
    case 'sign-out': auth.signOut().catch(() => {}); closeSettings(); break;
    case 'type-go': goSearch({ types: [v] }); break;
    case 'size-go': goSearch({ sort: v, dir: -1 }); break;
    case 'dock-home': goSearch(); window.scrollTo(0, 0); break;
    case 'dock-search': goSearch({ q: state.view === 'home' ? state.q : '' }, true); break;
    case 'dock-favs': if (requireLogin({ type: 'favs' })) location.hash = '#/teams'; break;
    case 'dock-battle': location.hash = '#/battle'; break;
    case 'dock-settings': if (smodal.hidden) openSettings(); else closeSettings(); break;
    case 'settings-close': closeSettings(); break;
    case 'compare': openCompare(); break;
    case 'tier': location.hash = `#/tier/${v}`; break;
    case 'move': location.hash = `#/move/${v}`; break;
    case 'ability': location.hash = `#/ability/${v}`; break;
    case 'item': location.hash = `#/item/${v}`; break;
    case 'nature': natureSheet(v); break;
    case 'fmt': page.fmt = v; page.idx = 0; $('#build').innerHTML = buildHTML(); break;
    case 'set': page.idx = Number(v); $('#build').innerHTML = buildHTML(); break;
    case 'copy': copyText(showdownText()); break;
    case 'more': page.expanded = true; $('#lvl').innerHTML = levelMovesHTML(true); break;

    // comparador
    case 'pick':
      if (cmp.others.length >= CMP_MAX) { toast(t('cmpMax', { n: CMP_MAX })); break; }
      cmp.others.push(BYID.get(v)); $('#cmp-q').value = ''; renderCompare(); break;
    case 'remove': cmp.others = cmp.others.filter(p => p.id !== v); renderCompare(); break;
  }
});

/** Al pasar el ratón por un botón o tarjeta: zoom suave y una inclinación 3D hacia el lado que tocas (solo con ratón) */
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const TILT = 'button:not(:disabled), a.row, a.card, a.chip, a.evo-card, .frow, .slotopt';
  let cur = null;
  const reset = () => { if (!cur) return; cur.classList.remove('tilt-on'); ['--rx', '--ry', '--s'].forEach(k => cur.style.removeProperty(k)); cur = null; };
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest?.(TILT);
    if (el !== cur) { reset(); if (!el) return; cur = el; el.classList.add('tilt-on'); }
    const r = cur.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    const big = Math.max(r.width, r.height) > 260; // las piezas grandes se inclinan menos
    const max = big ? 5 : 14;
    cur.style.setProperty('--ry', `${(x * max * 2).toFixed(2)}deg`);
    cur.style.setProperty('--rx', `${(-y * max * 2).toFixed(2)}deg`);
    cur.style.setProperty('--s', big ? 1.03 : 1.09);
  }, { passive: true });
  document.addEventListener('pointerleave', reset);
  document.addEventListener('pointerdown', () => cur?.style.setProperty('--s', 0.96));
  document.addEventListener('pointerup', () => cur?.style.setProperty('--s', 1.06));
  window.addEventListener('blur', reset);
}

/** En la app instalada de iOS la web puede quedar bajo la barra de estado sin que env() lo indique: se calcula a mano */
function fixStatusBar() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px)';
  document.body.appendChild(probe);
  const env = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  if (navigator.standalone && env < 1 && innerHeight >= screen.height - 1) {
    document.documentElement.style.setProperty('--st', `${screen.height >= 852 ? 56 : screen.height >= 812 ? 47 : 20}px`);
  }
}
fixStatusBar();

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
  renderDock();
  window.addEventListener('hashchange', route);
  route();
  auth.initAuth(onAuth).catch(() => {});
}
boot();
