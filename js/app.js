import {
  TYPES, TYPE_ES, TYPE_EN, TYPE_COLOR, STATS, typeName, statName, catName, tierInfo, TIER_ORDER, formatName,
  esc, fold, dexNum, fmtNum, store, matchups, bst, statColor, tierLabel, tierColor, tierNum, tierNumHTML, TIER_MAX, formatRank,
  pname, pname2, dn, dn2, dd, how,
  pokeImg, itemImg, typeIcon, typePill, typeDot, catIcon, SPR, img, spriteChain, smallSprite,
} from './util.js';
import { t, lang, setLang } from './i18n.js';
import { analyzeTeam, scoreInfo } from './team.js';
import { META_TEAMS } from './meta.js';
import * as auth from './auth.js';
import { DOCK, IC } from './icons.js';
import { buildUnit, compareTeams, eff } from './battle.js';
import { baseBuild, currentBuild, diffBuild, finalStats, evTotal, KEYS as EDK, EV_MAX, EV_TOTAL } from './editor.js';

const $app = document.getElementById('app');
/** Icono relleno del menú (con su color) para ponerlo a la izquierda del título de cada página */
const TITLE_COLOR = { 'dock-community': '#3B82F6', 'dock-battle': '#E5484D', 'dock-favs': '#F2B322', 'dock-notifs': '#30A46C', 'dock-settings': 'var(--ink)' };
const titleIc = act => `<span class="ticn" style="--tic:${TITLE_COLOR[act]}">${DOCK[act].f}</span>`;
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
  chev: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
};
/** Ajustes: ventana en medio de la pantalla (idioma con bandera y tema claro/oscuro) */
const FLAG = { es: 'icons/flags/es.svg', en: 'icons/flags/gb.svg' };
const LANGS = { es: 'Español', en: 'English' };
const smodal = document.getElementById('smodal');
let modalKind = null; // 'sd' | 'notifs' | 'settings' | 'login' | 'teampick' | 'picker' | 'saveteam' | 'publish' | 'bans'
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
    <small id="un-msg" class="unmsg">${t('unHint')}</small></div>`;
}
let sdd = null; // desplegable abierto en Ajustes: 'lang' | 'theme'
let fbKind = 'bug';
const FB_KINDS = [['bug', 'fbBug'], ['idea', 'fbIdea'], ['other', 'fbOther']];
const feedbackHTML = () => `<div class="sgroup fb"><h3>${IC.mail}${t('feedbackTitle')}</h3>
  <p class="shint">${t('feedbackHint')}</p>
  <div class="fbkinds" role="radiogroup">${FB_KINDS.map(([k, key]) => `<button class="chip" role="radio" data-act="fb-kind" data-v="${k}" aria-checked="${fbKind === k}" aria-pressed="${fbKind === k}">${t(key)}</button>`).join('')}</div>
  <textarea id="fb-text" class="fbtext" rows="5" maxlength="2000" placeholder="${t('feedbackPh')}" aria-label="${t('feedbackTitle')}"></textarea>
  <div class="fbrow"><small id="fb-msg" class="unmsg">${t('feedbackInfo')}</small><button class="chip accent" data-act="fb-send">${t('feedbackSend')}</button></div></div>`;
function settingsHTML() {
  const pref = themePref();
  return `<div class="scard" role="dialog" aria-modal="true" aria-label="${t('settings')}">
    <div class="shead"><button class="iconbtn" data-act="settings-close" aria-label="${t('close')}">${I.x}</button><h2 class="brand">${titleIc('dock-settings')}${t('settings')}</h2></div>
    ${accountHTML()}
    <div class="sgroup"><div class="spills">
      <button class="ddbtn spill" data-act="sdd" data-v="lang" aria-expanded="${sdd === 'lang'}" aria-haspopup="listbox"><span class="ddl">${t('language')}</span><span class="ddv"><img class="flag" src="${FLAG[lang()]}" alt="" width="18" height="14">${LANGS[lang()]}</span><svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
      ${sdd === 'lang' ? `<div class="sdl" role="listbox">${['es', 'en'].map(l => `<button class="sopt" role="radio" data-act="set-lang" data-v="${l}" aria-checked="${lang() === l}"><img class="flag" src="${FLAG[l]}" alt="" width="24" height="18">${LANGS[l]}<span class="ck">${I.check}</span></button>`).join('')}</div>` : ''}
      <button class="ddbtn spill" data-act="sdd" data-v="theme" aria-expanded="${sdd === 'theme'}" aria-haspopup="listbox"><span class="ddl">${t('theme')}</span><span class="ddv">${t(pref === 'system' ? 'themeSystem' : pref)}</span><svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
      ${sdd === 'theme' ? `<div class="sdl" role="listbox">${['system', 'light', 'dark'].map(m => `<button class="sopt" role="radio" data-act="set-theme" data-v="${m}" aria-checked="${pref === m}">${I[THEME_ICON[m]]}${t(m === 'system' ? 'themeSystem' : m)}<span class="ck">${I.check}</span></button>`).join('')}</div>` : ''}</div></div>
    ${offlineHTML()}
    ${auth.userInfo() ? feedbackHTML() : ''}
    ${auth.userInfo() ? `<div class="sgroup"><button class="sopt" data-act="sign-out">${I.logout}${t('signOut')}</button></div>` : ''}
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
const modalHTML = () => (modalKind === 'login' ? loginHTML() : modalKind === 'bans' ? bansModalHTML() : modalKind === 'sd' ? sdModalHTML() : modalKind === 'likers' ? likersHTML() : modalKind === 'notifs' ? notifsHTML() : modalKind === 'publish' ? publishModalHTML() : modalKind === 'saveteam' ? saveTeamHTML() : modalKind === 'teampick' ? teamPickHTML() : modalKind === 'picker' ? pickerHTML() : settingsHTML());
const refreshModal = () => { if (!smodal.hidden) smodal.innerHTML = modalHTML(); };
/** Confirmación genérica antes de eliminar algo (diálogo propio: queda por encima de cualquier otra ventana) */
function askConfirm(text, okLabel, fn) {
  let dlg = $('#cfm');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'cfm'; dlg.className = 'cfm'; document.body.appendChild(dlg); }
  dlg.innerHTML = `<div class="cfmbox" role="alertdialog" aria-label="${esc(text)}"><p>${esc(text)}</p><div class="cfmbtns"><button class="chip" data-cfm="0">${t('comCancel')}</button><button class="chip danger" data-cfm="1">${esc(okLabel)}</button></div></div>`;
  dlg.onclick = e => { const b = e.target.closest('[data-cfm]'); if (!b && e.target !== dlg) return; dlg.close(); if (b?.dataset.cfm === '1') fn(); };
  dlg.showModal();
}
function showModal(kind) {
  modalKind = kind;
  smodal.innerHTML = modalHTML();
  const wasHidden = smodal.hidden;
  smodal.hidden = false;
  if (wasHidden) { smodal.classList.add('enter'); clearTimeout(showModal.t); showModal.t = setTimeout(() => smodal.classList.remove('enter'), 340); }
  document.documentElement.classList.add('locked');
  updateDock();
}
const openSettings = () => showModal('settings');
const openLogin = action => { pending = action; showModal('login'); };
function closeSettings() {
  sdd = null;
  if (smodal.hidden) return;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { // sale con un fundido: se anima una copia mientras el original ya está cerrado
    const g = smodal.cloneNode(true); g.removeAttribute('id'); g.classList.remove('enter'); g.classList.add('ghost-out'); g.inert = true;
    g.querySelectorAll('[id]').forEach(n => n.removeAttribute('id')); document.body.append(g); setTimeout(() => g.remove(), 200);
  }
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

/** miembro que representa la ficha abierta: el Pokémon tal cual o, en una ficha personalizada, su build editada */
const pageMember = () => (page?.bm ? { id: page.d.id, ...(page.bm.s != null ? { s: page.bm.s } : {}), b: page.bm.b } : { id: page.d.id });
function paintFavBtn() {
  const b = $('.favbtn'); if (!b || !page?.d) return;
  const pm = pageMember();
  const on = teams.some(tm => tm.members.some(m => (page.bm ? sameM(m, pm) : m.id === pm.id)));
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
  document.querySelectorAll('.favdot[data-v]').forEach(b => { const on = favs.has(b.dataset.v); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.innerHTML = on ? IC.starF : IC.star; });
  if (inTeams()) paintTeams();
  document.querySelectorAll('.favn').forEach(n => { n.textContent = favs.size ? `(${favs.size})` : ''; });
}
/** Mete o saca un Pokémon de un equipo. Devuelve true si cambió algo */
function toggleInTeam(slot, id, mem = null) {
  const tm = teams[slot], want = mem || { id };
  const k = tm.members.findIndex(m => (mem ? sameM(m, want) : m.id === id));
  if (k >= 0) tm.members.splice(k, 1);
  else { if (tm.members.length >= MAXTEAM) { toast(t('teamFull')); return false; } tm.members.push({ ...want }); }
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
    notif.items = null; notif.unread = 0; paintBadge();
    pending = null; me = null; resetTeams(); if (state.view === 'community') paintCom(); else if (state.view === 'post') paintPost(); else if (state.view === 'user') paintUser();
    auth.untrackPresence().catch(() => {}); auth.unwatchFriends().catch(() => {});
    refreshModal(); paintFavBtn();
    if (state.view === 'home') renderResults(); else if (inTeams()) paintTeams(); else if (state.view === 'battle') renderBattle();
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
  auth.trackPresence().catch(() => {}); pollNotifs();
  if (!smodal.hidden) closeSettings();
  if (state.view === 'home') renderResults(); else if (inTeams()) paintTeams(); else if (state.view === 'battle') renderBattle();
  paintFavBtn();
  refreshModal();
  await auth.checkAdmin().catch(() => {});
  if (state.view === 'community') loadFeed(true); else if (state.view === 'post') renderPost(curPostId); else if (state.view === 'user') renderUser(usr.id);
  if (wanted?.type === 'favs') location.hash = '#/teams';
  else if (wanted?.type === 'community') location.hash = wanted.hash || '#/community';
  else if (wanted?.type === 'fav' && BYID.has(wanted.id)) openTeamPick(wanted.id, wanted.m);
  else if (wanted?.type === 'saveteam' && wanted.ids?.length) openSaveTeam({ name: wanted.name, ids: wanted.ids });
}
// la presencia solo cuenta mientras la pestaña está a la vista
document.addEventListener('visibilitychange', () => {
  if (!auth.currentUser()) return;
  if (document.hidden) auth.untrackPresence().catch(() => {}); else auth.trackPresence().catch(() => {});
});

// ───────────────────────── Ventanas: elegir equipo y buscador de Pokémon ─────────────────────────
let pickId = null;     // Pokémon que se está guardando
let pickM = null;      // miembro concreto a guardar ({id, s?, b?}); una ficha personalizada guarda su versión
const sameM = (a, b) => a.id === b.id && (a.s ?? null) === (b.s ?? null) && JSON.stringify(a.b || null) === JSON.stringify(b.b || null);
let pickCtx = null;    // { mode: 'team', slot } | { mode: 'avatar' }
const openTeamPick = (id, m = null) => { pickId = id; pickM = m || { id }; showModal('teampick'); };
// guardar en mis equipos un equipo que no es mío (compartido, de un amigo o de ejemplo)
let saveCtx = null;
const openSaveTeam = ctx => {
  const ids = ctx.ids.filter(id => BYID.has(id)).slice(0, MAXTEAM);
  if (!ids.length || !requireLogin(ctx.members ? { type: 'community', hash: location.hash } : { type: 'saveteam', ids, name: ctx.name })) return;
  saveCtx = { name: String(ctx.name || '').slice(0, 24), ids, members: ctx.members ? ctx.members.filter(m => BYID.has(m.id)).slice(0, MAXTEAM).map(m => ({ ...m })) : null };
  showModal('saveteam');
};
function saveTeamHTML() {
  const c = saveCtx;
  return `<div class="scard" role="dialog" aria-modal="true" aria-label="${t('saveTeamTitle')}">
    <div class="shead"><button class="iconbtn" data-act="settings-close" aria-label="${t('close')}">${IC.x}</button><h2>${t('saveTeamTitle')}</h2></div>
    <p class="shint">${t('saveTeamText', { name: esc(c.name || t('sharedOwner')) })}</p>
    <div class="minis savepreview">${c.ids.map(miniPoke).join('')}</div>
    <div class="slotlist">${teams.map((tm, i) => `<button class="slotopt" data-act="save-into" data-v="${i}">
        <span class="sn">${i + 1}</span>
        <span class="sname"><b>${tm.members.length ? `<span class="fulltag">${t('replaceTag')}</span> ` : ''}${esc(teamName(i))}</b><span class="minis">${tm.members.map(m => miniPoke(m.id)).join('') || `<small>${t('teamEmpty')}</small>`}</span></span>
        <span class="scount">${tm.members.length}/${MAXTEAM}</span>
        <span class="sck">${IC.plus}</span></button>`).join('')}</div></div>`;
}
const shareURL = (ids, name) => `${location.origin}${location.pathname}#/t/${ids.join(',')}${name ? `?n=${encodeURIComponent(name)}` : ''}`;
async function shareTeam(ids, name) {
  const url = shareURL(ids, name);
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: name || 'PokeScanner', url }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast(t('linkCopied')); }
  catch { prompt(t('copyLink'), url); }
}
function teamPickHTML() {
  const p = BYID.get(pickId);
  return `<div class="scard" role="dialog" aria-modal="true" aria-label="${t('pickTeamTitle')}">
    <div class="shead"><button class="iconbtn" data-act="settings-close" aria-label="${t('close')}">${IC.x}</button><h2>${t('pickTeamTitle')}</h2></div>
    <p class="shint">${t('pickTeamText', { name: esc(pname(p)) })}</p>
    <div class="slotlist">${teams.map((tm, i) => {
      const has = tm.members.some(m => sameM(m, pickM)), full = tm.members.length >= MAXTEAM && !has;
      return `<button class="slotopt ${has ? 'on' : ''}" data-act="team-toggle" data-v="${i}" ${full ? 'disabled' : ''}>
        <span class="sn">${i + 1}</span>
        <span class="sname"><b>${full ? `<span class="fulltag">${t('fullTag')}</span> ` : ''}${esc(teamName(i))}</b><span class="minis">${tm.members.map(m => miniPoke(m.id)).join('') || `<small>${t('teamEmpty')}</small>`}</span></span>
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
  const it = (act, label) => `<button class="dk" data-act="${act}" aria-label="${label}" title="${label}"><span class="ic">${DOCK[act].o}${DOCK[act].f}</span><span class="lb">${label}</span></button>`;
  dockEl.innerHTML = it('dock-home', t('dockHome')) + it('dock-community', t('dockCommunity')) + it('dock-battle', t('dockBattle')) + it('dock-favs', t('dockFavs')) + it('dock-notifs', t('dockNotifs')) + it('dock-settings', t('settings'));
  updateDock();
}
function updateDock() {
  const home = state.view === 'home';
  const on = { 'dock-home': home, 'dock-community': state.view === 'community' || state.view === 'post' || state.view === 'user', 'dock-battle': state.view === 'battle', 'dock-favs': state.view === 'teams' || state.view === 'team', 'dock-notifs': !smodal.hidden && modalKind === 'notifs', 'dock-settings': !smodal.hidden && modalKind !== 'notifs' };
  dockEl.querySelectorAll('.dk').forEach(b => b.classList.toggle('on', !!on[b.dataset.act]));
  paintBadge();
}
// ───────────── Notificaciones (campana) ─────────────
const notif = { items: null, unread: 0, loading: false };
function paintBadge() {
  const b = dockEl.querySelector('[data-act="dock-notifs"]'); if (!b) return;
  let d = b.querySelector('.nbadge');
  if (!notif.unread) { d?.remove(); return; }
  if (!d) { d = document.createElement('i'); d.className = 'nbadge'; b.append(d); }
  d.textContent = notif.unread > 9 ? '9+' : String(notif.unread);
}
async function pollNotifs() {
  if (!auth.currentUser() || document.hidden) return;
  try { const n = await auth.notifUnread(); if (n !== notif.unread) { notif.unread = n; paintBadge(); } } catch { /* sin red */ }
}
setInterval(pollNotifs, 45000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) pollNotifs(); });
const notifText = n => { const u = `<b>${esc(n.username || '?')}</b>`; return t(n.kind === 'like' ? 'notifLike' : n.kind === 'comment' ? 'notifComment' : n.kind === 'reply' ? 'notifReply' : n.kind === 'mention' ? 'notifMention' : n.kind === 'clike' ? 'notifCLike' : n.kind === 'friend_request' ? 'notifReq' : 'notifAcc', { u }); };
function notifsHTML() {
  const head = `<div class="shead"><button class="iconbtn" data-act="settings-close" aria-label="${t('close')}">${IC.x}</button><h2 class="brand">${titleIc('dock-notifs')}${t('notifTitle')}</h2></div>`;
  const body = !auth.currentUser() ? `<p class="shint">${t('notifLogin')}</p>`
    : notif.items == null ? `<p class="shint">…</p>`
    : !notif.items.length ? `<p class="shint">${t('notifEmpty')}</p>`
    : `<ul class="nlist">${notif.items.map(n => `<li><button class="nitem ${n.fresh ? 'new' : ''}" data-act="notif-go" data-v="${n.id}">${avatarImg(n.avatar, 'sm')}<span class="ntx"><span>${notifText(n)}</span>${n.body ? `<em>“${esc(n.body)}”</em>` : ''}<small>${ago(n.created_at)}</small></span>${n.fresh ? '<i class="ndot"></i>' : ''}</button></li>`).join('')}</ul>`;
  return `<div class="scard" role="dialog" aria-modal="true" aria-label="${t('notifTitle')}">${head}${body}</div>`;
}
async function openNotifs() {
  if (!smodal.hidden && modalKind === 'notifs') { closeSettings(); return; }
  notif.items = null; showModal('notifs');
  if (!auth.currentUser()) return;
  try {
    const rows = await auth.notifList();
    notif.items = rows.map(r => ({ ...r, fresh: !r.read }));
    if (modalKind === 'notifs' && !smodal.hidden) refreshModal();
    if (notif.items.some(n => n.fresh)) { notif.unread = 0; paintBadge(); auth.notifMarkRead().catch(() => {}); }
  } catch { notif.items = []; if (modalKind === 'notifs') refreshModal(); }
}
function goNotif(id) {
  const n = notif.items?.find(x => String(x.id) === String(id)); if (!n) return;
  closeSettings();
  location.hash = n.kind === 'like' ? `#/community/${n.post_id}` : ['comment', 'reply', 'clike', 'mention'].includes(n.kind) ? `#/community/${n.post_id}?c=1` : n.kind === 'friend_request' ? '#/battle' : `#/user/${n.actor_id}`;
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
sheet.addEventListener('close', () => { document.documentElement.classList.remove('locked'); ed = null; delete sheet.dataset.ed; });
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });

const otherName = x => (dn2(x) && dn2(x) !== dn(x) ? `<p class="dim">${t('otherName', { n: esc(dn2(x)) })}</p>` : '');

// ───────────────────────── Páginas de movimiento y habilidad ─────────────────────────
// la flecha de volver sale en todas las páginas cuando hay una anterior a la que volver
const backBar = () => (navIdx > 0 ? topbarHTML() : '');
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
    <span class="meta"><span class="nm"><b>${esc(pname(p))}</b><span class="types">${p.t.map(typeDot).join('')}</span></span>
      <span class="why">${why.map(esc).join(' · ')}</span></span>
    <span class="side">${tierBadge(p.r, '', p.g)}</span></a>`;
}
/** Enlace a la ficha; si el Pokémon tiene la build editada, la ficha se abre con esa build ("personalizada") */
const pokeHref = (id, m) => (m?.b ? `#/pokemon/${id}?b=${encodeURIComponent(JSON.stringify({ ...m.b, ...(m.s != null ? { s: m.s } : {}) }))}` : `#/pokemon/${id}`);
const chipPoke = (p, m) => `<a class="chip pkpill" href="${pokeHref(p.id, m)}" style="--c:${TYPE_COLOR[p.t[0]]}">${pokeImg(p, 'small', 'thumb')}${esc(pname(p))}</a>`;
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
const pfNew = () => ({ types: [], tiers: [], gens: [], gen9: false, sort: '', dir: -1, open: false, dd: null });
let pf = pfNew(); // filtros de las listas de Pokémon de estas páginas
const pfSorted = () => !!pf.sort;
const pfActive = () => pf.types.length + pf.tiers.length + pf.gens.length + (pf.gen9 ? 1 : 0) + (pfSorted() ? 1 : 0);
const pfPass = p => (!pf.types.length || pf.types.every(ty => p.t.includes(ty))) && (!pf.tiers.length || pf.tiers.includes(p.r)) && (!pf.gens.length || pf.gens.includes(genOf(p.num))) && (!pf.gen9 || !p.g);
const SI = d => `<svg class="sico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const SORT_ICON = {
  num: SI('<path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16"/>'),
  hp: SI('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  atk: SI('<path d="M14 4l6-1-1 6L9 19l-4-4zM5 15l-2 2 4 4 2-2M10 14l-2 2"/>'),
  def: SI('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>'),
  spa: SI('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z"/>'),
  spd: SI('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM12 8v8M8.5 12h7"/>'),
  spe: SI('<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>'),
  bst: SI('<path d="M18 5H7l6 7-6 7h11"/>'),
  h: SI('<path d="M4 17V7h16v10zM8 7v4M12 7v6M16 7v4"/>'),
  w: SI('<path d="M6 8h12l2 12H4zM9 8a3 3 0 0 1 6 0M10 13l2 2 2-2"/>'),
};
/** Filtros desplegables: la misma pieza en el inicio y en las páginas de movimiento, habilidad, objeto y rango.
 *  c = { sort: bool, tiers: bool, acts: { toggle, sort, type, tier, gen, gen9 }, on(kind, v), val(key), open(key), dir(k) } */
function filterRowsHTML(c) {
  const opt = (act, v, inner, kind) => `<button class="ddopt" role="option" data-act="${act}" data-v="${v}" aria-pressed="${c.on(kind, v)}">${inner}<span class="ck">${I.check}</span></button>`;
  const dd = (key, label, hint, options) => `<div class="dd ${c.open(key) ? 'open' : ''} ${c.has(key) ? 'has' : ''}" data-dd="${key}"><button class="ddbtn" data-act="${c.acts.toggle}" data-v="${key}" aria-expanded="${c.open(key)}"><span class="ddl">${label}</span><span class="ddv" data-dv="${key}">${c.val(key)}</span><svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
    <div class="ddlist" role="listbox" ${c.open(key) ? '' : 'hidden'}>${hint ? `<p class="ddhint">${hint}</p>` : ''}${options}</div></div>`;
  const rows = [];
  if (c.sort) rows.push(dd('sort', t('sortBy'), '', SORTS.map(k => opt(c.acts.sort, k, `${SORT_ICON[k]}${sortLabel(k)}<span class="dir">${c.dir(k)}</span>`, 'sort')).join('')));
  rows.push(dd('type', t('type'), '', TYPES.map(ty => opt(c.acts.type, ty, `${typeIcon(ty)}${typeName(ty)}`, 'type')).join('')));
  if (c.tiers) rows.push(dd('tier', t('tier'), t('tierHint'), TIER_ORDER.map(r => opt(c.acts.tier, r, `${tierNumHTML(r)}${tierLabel(r)}`, 'tier')).join('')));
  rows.push(dd('gen', t('generation'), '', [1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => opt(c.acts.gen, g, genLabel(g), 'gen')).join('')));
  return `<div class="fgroup">${rows.join('')}</div>`;
}
const selText = (list, none, name) => (!list.length ? none : list.length <= 2 ? list.map(name).join(', ') : t('nSelected', { n: list.length }));
function pfBar(withTiers = true, withSort = false) {
  const n = pfActive();
  const panel = filterRowsHTML({
    sort: withSort, tiers: withTiers, acts: { toggle: 'pf-dd', sort: 'pf-sort', type: 'pf-type', tier: 'pf-tier', gen: 'pf-gen', gen9: { act: 'pf-gen9' } },
    on: (k, v) => (k === 'sort' ? pf.sort === v : k === 'type' ? pf.types.includes(v) : k === 'tier' ? pf.tiers.includes(v) : k === 'gen' ? pf.gens.includes(Number(v)) : pf.gen9),
    open: key => pf.dd === key,
    has: key => (key === 'sort' ? !!pf.sort : key === 'type' ? pf.types.length > 0 : key === 'tier' ? pf.tiers.length > 0 : pf.gens.length > 0),
    dir: k => (pf.sort === k ? (pf.dir === -1 ? '↓' : '↑') : ''),
    val: key => (key === 'sort' ? (pf.sort ? sortLabel(pf.sort) + (pf.dir === -1 ? ' ↓' : ' ↑') : sortLabel('num')) : key === 'type' ? selText(pf.types, t('allM'), typeName) : key === 'tier' ? selText(pf.tiers, t('allM'), tierLabel) : selText(pf.gens, t('allF'), g => t('genShort', { g }))),
  });
  return `<div class="pfbar"><div class="pfrow">
      <button class="chip ${n ? 'has' : ''}" data-act="pf-toggle" aria-expanded="${pf.open}">${I.adjust}${t('filters')}${n ? ` <span class="badge on">${n}</span>` : ''}</button>
      ${n ? `<button class="chip small ghost" data-act="pf-clear">${t('clearFilters')}</button>` : ''}</div>
    ${pf.open ? `<div class="filters pfp">${panel}</div>` : ''}</div>`;
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
  const inTier = INDEX.filter(p => p.r === r && pfPass(p)).sort((x, y) => (!pf.sort ? power(y) - power(x) : pf.sort === 'num' ? 0 : (statOf(x, pf.sort) - statOf(y, pf.sort)) * pf.dir) || (x.num - y.num) * (pf.sort === 'num' ? pf.dir : 1))
    .map(p => ({ p, why: [`${t('total')} ${bst(p.s)}`, ...(p.ns ? [t(p.ns === 1 ? 'nBuild1' : 'nBuilds', { n: p.ns })] : [])] }));
  const all = pageExpand.has('mons'), shown = all ? inTier : inTier.slice(0, FIRST);
  return `${topbarHTML()}
  <section class="mhero" style="--tc:${tierColor(r)}">
    <span class="mtag">${t('rank')}</span>
    <h1><span class="tier big" style="--tier:${tierColor(r)}">${tierNumHTML(r)}${esc(tierLabel(r))}</span></h1>
    <span class="en">${esc(info ? info.n : r)}</span>
  </section>
  <section class="sec"><h2>${t('meaning')}</h2><p class="desc">${esc(info?.d || t('tierDefault'))}</p>
    <p class="hint">${n ? t('tierPos', { n, m: TIER_MAX }) : t('tierNoScale')}</p></section>
  ${pfBar(false, true)}
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
  pf = pfNew();
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
/** Posición de cada pestaña del dock, para deslizar la página hacia el lado correcto */
const tabOf = h => (/^#\/(community|user\/)/.test(h) ? 1 : h === '#/battle' ? 2 : /^#\/team/.test(h) ? 3 : (h === '' || h === '#' || h === '#/') ? 0 : null);
let curTab = null;
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
  const tp = location.hash.match(/^#\/team\/(\d)/);
  const um = location.hash.match(/^#\/user\/([0-9a-f-]{36})/);
  const cm = location.hash.match(/^#\/community\/(\d+)/);
  const sh = location.hash.match(/^#\/t\/([a-z0-9,]*)(?:\?n=(.*))?$/);
  if (state.view === 'battle' && location.hash !== '#/battle') auth.unwatchFriends().catch(() => {});
  if (sh) renderShared(sh[1], sh[2]); else if (m) renderPokemon(m[1]); else if (d) renderDetailPage(d[1], d[2]); else if (tp) renderTeamPage(tp[1]); else if (um) renderUser(um[1]); else if (cm) renderPost(cm[1]); else if (location.hash === '#/community') renderCommunity(); else if (location.hash === '#/types') renderTypes(); else if (/^#\/calc/.test(location.hash)) renderCalc((location.hash.match(/[?&]a=([a-z0-9]+)/) || [])[1]); else if (location.hash === '#/teams') renderTeams(); else if (location.hash === '#/battle') renderBattle(); else renderHome();
  updateDock();
  const tab = tabOf(location.hash), dir = tab != null && curTab != null && tab !== curTab ? (tab > curTab ? 'slide-r' : 'slide-l') : null;
  curTab = tab;
  $app.classList.remove('goback', 'slide-r', 'slide-l'); void $app.offsetWidth;
  if (dir) $app.classList.add(dir); else if (wentBack) $app.classList.add('goback');
  clearTimeout(route.t); route.t = setTimeout(() => $app.classList.remove('goback', 'slide-r', 'slide-l'), 300);
}

// ───────────────────────── Inicio ─────────────────────────
const GEN_END = [151, 251, 386, 493, 649, 721, 809, 905, 1025]; // último número de Pokédex de cada generación
const genOf = num => { const i = GEN_END.findIndex(e => num <= e); return i < 0 ? 9 : i + 1; };
const REGION = { es: ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'], en: ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea'] };
const genLabel = g => `${t('genShort', { g })} · ${REGION[lang()][g - 1]}`;
const SORTS = ['num', 'hp', 'atk', 'def', 'spa', 'spd', 'spe', 'bst', 'h', 'w'];
const sortLabel = k => (k === 'num' ? t('num') : statName(k));

function homeHTML() {
  return `
  <header class="hero">
    <h1 class="brand"><img class="applogo" src="icons/icon.svg" alt="" width="48" height="48" decoding="async">PokeScanner</h1>
    ${updHTML()}
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
  </div>
  <div class="fpanel" id="fpanel"><div class="fpanel-in">
  <section class="filters" id="filters" aria-label="${t('filters')}">
    ${filterRowsHTML({
      sort: true, tiers: true, acts: { toggle: 'dd-toggle', sort: 'sort', type: 'type', tier: 'tier-f', gen: 'gen', gen9: { act: 'flag', v: 'gen9' } },
      on: () => false, open: () => false, has: () => false, val: () => '', dir: () => '',
    })}
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
  const hasF = { sort: state.sort !== 'num' || state.dir !== 1, type: state.types.length > 0, tier: state.tiers.length > 0, gen: state.gens.length > 0 };
  f.querySelectorAll('.dd').forEach(d => {
    const k = d.dataset.dd, open = state.dd === k;
    $('.ddv', d).textContent = dv[k];
    d.classList.toggle('has', hasF[k]);
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
  $('[data-act="filters-toggle"]').classList.toggle('has', active > 0);
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
/** Movimientos, habilidades y objetos cuyo nombre (en cualquier idioma) contiene lo escrito; se piden los datos la primera vez que se busca */
function searchDict(q, kind, max = MOVES_MAX) {
  if (!state.q || q.length < 2 || state.types.length || state.tiers.length || state.favs) return { list: [], total: 0 };
  if (!DICT) { getDict().then(() => { if (state.view === 'home' && fold(state.q).length >= 2) renderResults(false); }).catch(() => {}); return { list: [], total: 0 }; }
  const out = [];
  for (const [id, m] of Object.entries(DICT[kind])) {
    m.fs ??= fold(m.n); m.fe ??= fold(m.e);
    const sc = m.fs.startsWith(q) || m.fe.startsWith(q) ? 0 : m.fs.includes(q) || m.fe.includes(q) ? 1 : -1;
    if (sc >= 0) out.push({ id, m, sc });
  }
  out.sort((a, b) => a.sc - b.sc || dn(a.m).length - dn(b.m).length || dn(a.m).localeCompare(dn(b.m)));
  return { list: out.slice(0, max), total: out.length };
}
const searchMoves = q => searchDict(q, 'moves');
const ABIL_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 5.3 5.8.5-4.4 3.8 1.4 5.6L12 15l-5 3.2 1.4-5.6L4 8.8l5.8-.5z"/></svg>';
function movesBlock({ list, total }) {
  if (!list.length) return '';
  const rows = list.map(({ id, m }) => `<li><button class="lm solo" style="--tc:${TYPE_COLOR[m.t]}" data-act="move" data-v="${id}">${typeIcon(m.t)}<span class="n">${esc(dn(m))}</span>${catIcon(m.c)}<span class="pw">${m.p || '—'}</span></button></li>`).join('');
  return `<div class="block-title tight"><h2>${t('moves')}</h2></div><ul class="lvl mvlist">${rows}</ul>
    ${total > list.length ? `<p class="hint" style="margin-top:8px">${t('moreMoves', { n: total - list.length })}</p>` : ''}`;
}
/** Bloque de habilidades u objetos del buscador */
function namedBlock({ list, total }, kind) {
  if (!list.length) return '';
  const isItem = kind === 'items';
  const rows = list.map(({ id, m }) => `<li><button class="lm solo named" style="--tc:var(--accent)" data-act="${isItem ? 'item' : 'ability'}" data-v="${id}">${isItem && m.i ? itemImg(m) : `<span class="ticon abicon">${ABIL_ICON}</span>`}<span class="n">${esc(dn(m))}</span></button></li>`).join('');
  return `<div class="block-title tight"><h2>${t(isItem ? 'items' : 'abilities')}</h2></div><ul class="lvl mvlist">${rows}</ul>
    ${total > list.length ? `<p class="hint" style="margin-top:8px">${t('moreMoves', { n: total - list.length })}</p>` : ''}`;
}
const searchBlocks = q => movesBlock(searchMoves(q)) + namedBlock(searchDict(q, 'abilities', 4), 'abilities') + namedBlock(searchDict(q, 'items', 4), 'items');

// ───────────────────────── Análisis del equipo (favoritos) ─────────────────────────
const partColor = r => (r >= 0.8 ? '#6CC070' : r >= 0.6 ? '#E6C84F' : r >= 0.4 ? '#F0974B' : '#E5645A');
const chipsHTML = chips => (chips.length ? `<div class="fchips">${chips.map(c => (c.type ? typePill(c.type)
  : `<a class="chip small" href="#/pokemon/${c.poke.id}">${pokeImg(c.poke, 'small', 'thumb')}${esc(pname(c.poke))}</a>`)).join('')}</div>` : '');
const findHTML = (f, kind) => `<li class="find ${kind}"><span class="mark" aria-hidden="true">${kind === 'bad' ? '!' : '✓'}</span>
  <div><b>${t(`an_${f.key}_t`, f.vars)}</b><p>${t(`an_${f.key}_d`, f.vars)}</p>${chipsHTML(f.chips)}</div></li>`;
/** Los Pokémon legales que más subirían la puntuación del equipo (con tipos distintos entre sí) */
function suggestMissing(team, max = 5) {
  const base = analyzeTeam(team).score, nums = new Set(team.map(p => p.num)), ids = new Set(team.map(p => p.id));
  const scored = [];
  for (const p of INDEX) {
    if (!legalPick(p) || ids.has(p.id) || nums.has(p.num)) continue;
    const gain = analyzeTeam([...team, p]).score - base;
    if (gain > 0) scored.push({ p, gain });
  }
  scored.sort((a, b) => b.gain - a.gain || strength(a.p) - strength(b.p) || bst(b.p.s) - bst(a.p.s));
  const out = [], seen = new Set();
  for (const x of scored) { const k = [...x.p.t].sort().join('/'); if (seen.has(k) || out.some(o => o.p.num === x.p.num)) continue; seen.add(k); out.push(x); if (out.length >= max) break; }
  return out;
}
const missingHTML = team => {
  if (state.view !== 'team' || team.length < 3 || team.length >= MAXTEAM || teamsSel.open < 0) return '';
  const picks = suggestMissing(team);
  if (!picks.length) return '';
  return `<div class="swap missing"><h4>${t('an_missing')}</h4><p>${t('an_missingHint', { n: MAXTEAM - team.length })}</p><ul class="pans">${picks.map(x => `<li><span class="lft">${chipPoke(x.p)}<small>${t('an_missingGain', { k: x.gain })}</small></span><button class="chip small accent" data-act="team-sugg-add" data-v="${x.p.id}">${IC.plus}${t('sugAdd')}</button></li>`).join('')}</ul></div>`;
};
function teamHTML(team, shared = false) {
  if (team.length < 3) return `<section class="team need"><h4>${t('an_title')}</h4><p>${t('an_need')}</p></section>`;
  const a = analyzeTeam(team);
  const info = scoreInfo(a.score);
  const PI = {
    def: '<path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/>',
    cov: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0"/><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>',
    atk: '<path d="M7 20l10 0"/><path d="M6 6l6 -1l6 1"/><path d="M12 3l0 17"/><path d="M9 12l-3 -6l-3 6a3 3 0 0 0 6 0"/><path d="M21 12l-3 -6l-3 6a3 3 0 0 0 6 0"/>',
    spe: '<path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"/>',
    bulk: '<path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/>',
    pow: '<path d="M8 21l8 0"/><path d="M12 17l0 4"/><path d="M7 4l10 0"/><path d="M17 4v8a5 5 0 0 1 -10 0v-8"/><path d="M5 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M19 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>',
  };
  const parts = a.parts.map(p => `<div class="tpart"><span class="k"><svg viewBox="0 0 24 24" class="pi" aria-hidden="true">${PI[p.k] || ''}</svg>${t(`an_p_${p.k}`)}</span><span class="v">${Math.round(p.v)}/${p.max}</span>
    <div class="bar"><i style="--w:${(p.v / p.max * 100).toFixed(1)}%;--bc:${partColor(p.v / p.max)}"></i></div></div>`).join('');
  return `<section class="team" aria-label="${t('an_title')}">
    <div class="team-head"><div class="score" style="--sc:${info.c}"><b>${a.score}</b><small>/100</small></div>
      <div><h3>${t(`an_s_${info.k}`)}</h3><p>${t(shared ? 'an_subShared' : 'an_sub', { n: team.length })}</p>${team.length > 6 ? `<p>${t('an_over', { n: team.length })}</p>` : ''}</div></div>
    <div class="tparts">${parts}</div>
    <div><h4 class="bad">${t('an_bad')}</h4>${a.bad.length ? `<ul class="finds">${a.bad.map(f => findHTML(f, 'bad')).join('')}</ul>` : `<p class="note">${t('an_nobad')}</p>`}</div>
    <div><h4 class="good">${t('an_good')}</h4>${a.good.length ? `<ul class="finds">${a.good.map(f => findHTML(f, 'good')).join('')}</ul>` : `<p class="note">${t('an_nogood')}</p>`}</div>
    ${missingHTML(team)}
    <p class="note">${t('an_note')}</p></section>`;
}

function tierBadge(r, extra = '', g = 0) { return `<span class="tier" style="--tier:${tierColor(r)}" ${extra}${g ? ` title="${t('tierInGen', { g })}"` : ''}>${tierNumHTML(r)}${esc(tierLabel(r))}${g ? `<small>G${g}</small>` : ''}</span>`; }

function rowCore(p, shiny = false, href = `#/pokemon/${p.id}`) {
  const showStat = state.sort !== 'num' && state.view === 'home';
  return `<a class="row" href="${href}" style="--c:${TYPE_COLOR[p.t[0]]}">
    ${pokeImg(p, 'small', '', undefined, shiny)}
    <span class="meta"><b>${esc(pname(p))}</b><span class="sub"><small>${dexNum(p.num)}${p.fm && p.es !== p.en && lang() === 'es' ? ` · ${esc(p.en)}` : ''}</small><span class="types">${p.t.map(typeDot).join('')}</span></span></span>
    <span class="side">
      ${showStat ? `<span class="statval">${sortVal(p, state.sort)}<small>${statName(state.sort)}</small></span>` : tierBadge(p.r, '', p.g)}
    </span></a>`;
}
const favStar = (id, on) => `<button class="favdot ${on ? 'on' : ''}" data-act="row-fav" data-v="${id}" aria-pressed="${on}" aria-label="${t(on ? 'favAddedBtn' : 'favAddBtn')}">${on ? IC.starF : IC.star}</button>`;
// cada fila lleva a la derecha una estrella para añadir el Pokémon a un equipo (amarilla si ya está en alguno)
function rowHTML(p) {
  return `<div class="rw hasfav">${rowCore(p)}${favStar(p.id, favs.has(p.id))}</div>`;
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

const SHIC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>';
const CALCIC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>';
const TCIC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M3.5 9.5h17M3.5 15h17M9.5 3.5v17M15 3.5v17"/></svg>';

// ───────── fecha de los datos ─────────
let META = null;
function updHTML() {
  if (!META?.generado) return '';
  const days = Math.max(0, Math.floor((Date.now() - new Date(META.generado).getTime()) / 864e5));
  const when = days === 0 ? t('updToday') : days === 1 ? t('updYesterday') : days < 14 ? t('updDays', { n: days }) : days < 60 ? t('updWeeks', { n: Math.floor(days / 7) }) : t('updMonths', { n: Math.floor(days / 30) });
  return `<p class="upd" title="${esc(META.fuente || '')}">${t('updLabel', { when })}</p>`;
}

// ───────── Tabla de tipos ─────────
const effOne = (atk, def) => { const m = matchups([def]); for (const k of Object.keys(m)) if (m[k].includes(atk)) return Number(k); return 1; };
let TCHART = null;
const tchart = () => (TCHART ??= TYPES.map(a => TYPES.map(d => effOne(a, d))));
const tcPill = ty => `<button class="tpill" data-act="tc-sel" data-v="${ty}" style="--tc:${TYPE_COLOR[ty]}">${typeIcon(ty)}<span>${typeName(ty)}</span></button>`;
function typesHTML() {
  const sel = state.tcSel, si = sel ? TYPES.indexOf(sel) : -1, ch = tchart();
  const head = TYPES.map((ty, i) => `<button class="tc-h ${i === si ? 'sel' : ''}" data-act="tc-sel" data-v="${ty}" aria-label="${typeName(ty)}" style="--tc:${TYPE_COLOR[ty]}">${typeIcon(ty)}</button>`).join('');
  const rows = TYPES.map((a, r) => `<button class="tc-h ${r === si ? 'sel' : ''}" data-act="tc-sel" data-v="${a}" aria-label="${typeName(a)}" style="--tc:${TYPE_COLOR[a]}">${typeIcon(a)}</button>`
    + TYPES.map((d, c) => { const e = ch[r][c]; return `<span class="tc-c ${e === 2 ? 'x2' : e === 0.5 ? 'xh' : e === 0 ? 'x0' : ''} ${r === si || c === si ? 'on' : ''}">${e === 2 ? '2' : e === 0.5 ? '½' : e === 0 ? '0' : ''}</span>`; }).join('')).join('');
  let detail = '';
  if (sel) {
    const atk = k => TYPES.filter((_, c) => ch[si][c] === k), def = k => TYPES.filter((_, r) => ch[r][si] === k);
    const blk = (label, list) => `<div class="mx-row"><b>${label}</b><div class="chips">${list.length ? list.map(tcPill).join('') : `<span class="hint">${t('tcNone')}</span>`}</div></div>`;
    detail = `<div class="tc-detail"><h3>${tcPill(sel)}</h3><div class="mx">${blk(t('tcAtk'), atk(2))}${blk(t('tcAtkNo'), atk(0.5))}${blk(t('tcImm'), atk(0))}${blk(t('tcDefW'), def(2))}${blk(t('tcDefR'), def(0.5))}${blk(t('tcDefI'), def(0))}</div></div>`;
  }
  return `<div class="tc-wrap"><div class="tc"><span class="tc-corner"></span>${head}${rows}</div></div><p class="hint tc-legend">${t('tcLegend')}</p>${detail}`;
}
function paintTypes() { const r = $('#types-root'); if (r) { const y = scrollY; r.innerHTML = typesHTML(); scrollTo(0, y); } }
function renderTypes() {
  state.view = 'types';
  document.title = `${t('typeChart')} · PokeScanner`;
  document.documentElement.style.removeProperty('--accent');
  $app.innerHTML = `${topbarHTML()}<header class="hero"><h1>${t('typeChart')}</h1><p>${t('tcLead')}</p></header><div id="types-root">${typesHTML()}</div>`;
  window.scrollTo(0, 0);
  updateDock();
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
        <div class="btnrow"><button class="chip small" data-act="go-types">${TCIC}${t('typeChart')}</button>
        <button class="chip small" data-act="shuffle">${SHIC}${t('random')}</button></div></div>
      <div class="btnrow" style="margin:-4px 0 14px"><button class="chip small" data-act="go-calc">${CALCIC}${t('calcTitle')}</button></div>
      <div class="cards">${state.randoms.map(id => cardHTML(BYID.get(id))).join('')}</div>`;
    return;
  }

  const list = (state.list = compute());
  const mv = searchBlocks(fold(state.q));
  const goTeams = '';
  const head = goTeams + mv + `<div class="block-title tight"><h2>${t(list.length === 1 ? 'result1' : 'resultN', { n: list.length })}</h2></div>`;
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
  $app.innerHTML = (isFiltering() ? backBar() : '') + homeHTML(); // la flecha solo sale en el inicio si llegaste con un filtro o una búsqueda
  document.documentElement.style.removeProperty('--accent');
  renderResults(false); // al volver desde una ficha se conserva cuántos resultados había cargados
  window.scrollTo(0, state.scroll || 0);
  if (state.focusSearch) { state.focusSearch = false; window.scrollTo(0, 0); $('#q')?.focus(); }
  updateDock();
}

// ───────────────────────── Ficha ─────────────────────────
/** `delta`: cambio de cada stat final (Nv. 100) respecto a la build recomendada; se dibuja como una barrita fina superpuesta (2 puntos finales ≈ 1 punto base) */
function statsHTML(s, delta = null) {
  const rows = STATS.map((k, i) => {
    const d = delta?.[i] || 0, f = Math.min(100, s[i] / 255 * 100), w = Math.min(100, Math.max(1.6, Math.abs(d) / 2 / 255 * 100));
    const ov = d ? `<u class="${d > 0 ? 'up' : 'dn'}" style="--l:${(d > 0 ? Math.min(f, 100 - w) : Math.max(0, f - w)).toFixed(1)}%;--w:${w.toFixed(1)}%" title="${d > 0 ? '+' : '−'}${Math.abs(d)}"></u>` : '';
    return `<div class="stat"><span class="k">${statName(k)}</span><span class="v">${s[i]}</span>
    <div class="bar"><i style="--w:${f.toFixed(1)}%;--bc:${statColor(s[i])};--i:${i}"></i>${ov}</div></div>`;
  }).join('');
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

// ───────── Pestañas de movimientos y datos de la especie ─────────
const EGG_ES = { monster: 'Monstruo', water1: 'Agua 1', bug: 'Bicho', flying: 'Volador', ground: 'Campo', fairy: 'Hada', plant: 'Planta', humanshape: 'Humanoide', water3: 'Agua 3', mineral: 'Mineral', indeterminate: 'Amorfo', water2: 'Agua 2', ditto: 'Ditto', dragon: 'Dragón', 'no-eggs': 'Desconocido' };
const EGG_EN = { monster: 'Monster', water1: 'Water 1', bug: 'Bug', flying: 'Flying', ground: 'Field', fairy: 'Fairy', plant: 'Grass', humanshape: 'Human-Like', water3: 'Water 3', mineral: 'Mineral', indeterminate: 'Amorphous', water2: 'Water 2', ditto: 'Ditto', dragon: 'Dragon', 'no-eggs': 'Undiscovered' };
const GROWTH = { 1: ['Lento', 'Slow'], 2: ['Medio rápido', 'Medium Fast'], 3: ['Rápido', 'Fast'], 4: ['Medio lento', 'Medium Slow'], 5: ['Errático', 'Erratic'], 6: ['Fluctuante', 'Fluctuating'] };
const pct1 = n => `${(Math.round(n * 10) / 10).toLocaleString(lang() === 'en' ? 'en' : 'es')} %`;
function speciesDataHTML(d) {
  if (d.cr == null && !d.ev) return '';
  const ev = (d.ev || []).map((n, i) => (n ? `+${n} ${statName(['hp', 'atk', 'def', 'spa', 'spd', 'spe'][i])}` : '')).filter(Boolean).join(', ');
  const male = d.gr < 0 ? null : 100 - d.gr * 12.5;
  const gender = male == null ? `<b>${t('dtNoGender')}</b>`
    : `<div class="gbar" role="img" aria-label="♂ ${pct1(male)} · ♀ ${pct1(100 - male)}"><i style="width:${male}%"></i></div><b class="gtx"><span style="color:#3B82F6">♂ ${pct1(male)}</span> · <span style="color:#EC4899">♀ ${pct1(100 - male)}</span></b>`;
  const egg = (d.eg || []).map(g => (lang() === 'en' ? EGG_EN : EGG_ES)[g] || g).join(' · ');
  const row = (k, v) => (v ? `<div><span>${k}</span><div class="dv">${v}</div></div>` : '');
  return `<section class="sec"><h2>${t('dtTitle')}</h2><div class="dlist">
    ${row(t('dtEv'), ev ? `<b>${ev}</b>` : `<b>—</b>`)}
    ${d.cr != null ? row(t('dtCatch'), `<b>${d.cr}</b> <small>(≈ ${pct1(d.cr / 7.65)} · Poké Ball)</small>`) : ''}
    ${d.bh != null ? row(t('dtHappy'), `<b>${d.bh}</b>`) : ''}
    ${d.gr != null ? row(t('dtGender'), gender) : ''}
    ${egg ? row(t('dtEgg'), `<b>${egg}</b>`) : ''}
    ${d.hc ? row(t('dtHatch'), `<b>${(d.hc * 256).toLocaleString(lang() === 'en' ? 'en' : 'es')}</b> <small>${t('dtSteps')}</small>`) : ''}
    ${d.gx ? row(t('dtGrowth'), `<b>${GROWTH[d.gx]?.[lang() === 'en' ? 1 : 0] || ''}</b>`) : ''}
  </div></section>`;
}
function formsHTML(d) {
  const fs = INDEX.filter(p => p.num === d.num && p.id !== d.id);
  if (!fs.length) return '';
  return `<section class="sec"><h2>${t('dtForms')} <small>${fs.length + 1}</small></h2><div class="forms">${fs.map(p => `<a class="evo-card" href="#/pokemon/${p.id}">${pokeImg(p, 'small')}<span class="evo-txt"><b>${esc(pname(p))}</b><small>${dexNum(p.num)}</small><span class="types" style="display:flex;gap:4px;margin-top:6px">${p.t.map(typeDot).join('')}</span></span></a>`).join('')}</div></section>`;
}
const MTABS = [['lv', 'mtLevel'], ['mt', 'mtTm'], ['eggm', 'mtEgg'], ['tu', 'mtTutor']];
function methodListHTML(ids) {
  const list = ids.map(id => ({ id, m: DICT.moves[id] })).filter(x => x.m).sort((a, b) => dn(a.m).localeCompare(dn(b.m), lang()));
  return `<ul class="lvl">${list.map(({ id, m }) => `<li><button class="lm solo" style="--tc:${TYPE_COLOR[m.t]}" data-act="move" data-v="${id}">${typeIcon(m.t)}<span class="n">${esc(dn(m))}</span>${catIcon(m.c)}<span class="pw">${m.p || '—'}</span></button></li>`).join('')}</ul>`;
}
function movesSectionHTML() {
  const { d } = page, tab = page.mtab || 'lv';
  const tabs = MTABS.filter(([k]) => k === 'lv' || d[k]?.length);
  const cnt = k => (k === 'lv' ? d.lv.length : d[k].length);
  const body = tab === 'lv' ? (d.lv.length ? levelMovesHTML(page.expanded) : `<p class="hint">${t('noLevelMoves')}</p>`) : methodListHTML(d[tab] || []);
  return `<h2>${t('movesTitle')} <small>${d.g ? `${t('gen', { g: d.lg })} · ` : ''}${cnt(tab)}</small></h2>
    ${tabs.length > 1 ? `<div class="chips mtabs" role="tablist">${tabs.map(([k, lbl]) => `<button class="chip ${k === tab ? 'on' : ''}" role="tab" aria-selected="${k === tab}" data-act="mtab" data-v="${k}">${t(lbl)} <small>${cnt(k)}</small></button>`).join('')}</div>` : ''}
    <div id="lvl">${body}</div>`;
}
const favBtnInner = on => (on ? `${IC.starF}${t('favAddedBtn')}` : `${IC.star}${t('favAddBtn')}`);
// ───────── Dónde capturarlo (PokeAPI, gen 1–8) ─────────
let ENCD = null; const encCache = new Map();
async function loadEnc(id) {
  const k = BYID.get(id).k;
  try {
    ENCD ??= getJSON('data/enc-dict.json');
    if (!encCache.has(k)) encCache.set(k, getJSON(`data/enc/${k}.json`).catch(() => ({})));
    const [dict, bundle] = await Promise.all([ENCD, encCache.get(k)]);
    if (page?.d.id !== id) return;
    page.enc = bundle[id] || []; page.encDict = dict;
  } catch { ENCD = null; if (page?.d.id === id) { page.enc = null; page.encDict = null; } }
  const el = $('#enc'); if (el && page?.d.id === id) el.innerHTML = encHTML();
}
const L2 = a => a[lang() === 'en' ? 1 : 0];
function encHTML() {
  if (!page || page.enc === undefined) return '';
  const D = page.encDict, rows = page.enc;
  if (!D) return '';
  const head = `<h2>${t('encTitle')}</h2>`;
  const note = `<p class="hint enc-note">${t('encNote')}</p>`;
  if (!rows.length) return `${head}<p class="hint">${t('encNone')}</p>${note}`;
  const groups = new Map();
  for (const r of rows) { const g = D.ver[r[0][0]]; (groups.get(g) || groups.set(g, []).get(g)).push(r); }
  const order = [...groups.keys()].sort((a, b) => D.grp[b].g - D.grp[a].g || D.grp[a].o - D.grp[b].o);
  const html = order.map((g, gi) => {
    const G = D.grp[g], list = groups.get(g), allV = G.v.map(x => x[0]);
    const byReg = new Map();
    for (const r of list) { const rg = D.loc[r[1]][2]; (byReg.get(rg) || byReg.set(rg, []).get(rg)).push(r); }
    const regs = [...byReg.entries()].map(([rg, rs]) => {
      const lines = rs.map(r => {
        const [vs, loc, area, m, lo, hi, p, cs] = r;
        const ln = L2(D.loc[loc]); let an = area ? L2(D.area[area]) : '';
        if (an && an.toLowerCase().startsWith(ln.toLowerCase())) an = an.slice(ln.length).replace(/^[\s(–-]+|[)\s]+$/g, '');
        const place = `<b>${esc(ln)}</b>${an ? ` <span class="ea">${esc(an)}</span>` : ''}`;
        const only = vs.length < allV.length ? `<span class="chip small ghost">${t('encOnly', { v: G.v.filter(x => vs.includes(x[0])).map(x => (lang() === 'en' ? x[2] : x[1])).join(' / ') })}</span>` : '';
        const conds = cs.map(c => `<span class="chip small ghost">${esc(L2(D.cond[c]))}</span>`).join('');
        const meta = [L2(D.meth[m]), lo === hi ? t('encLv', { n: lo }) : t('encLv', { n: `${lo}–${hi}` }), p < 100 ? `${p}%` : ''].filter(Boolean).join(' · ');
        return `<li><div class="el">${place}<span class="em">${esc(meta)}</span></div>${only || conds ? `<div class="et">${only}${conds}</div>` : ''}</li>`;
      }).join('');
      const rn = rg && D.reg[rg] ? `<h4>${esc(L2(D.reg[rg]))}</h4>` : '';
      return `${rn}<ul class="enclist">${lines}</ul>`;
    }).join('');
    return `<details class="encg" ${gi === 0 ? 'open' : ''}><summary><span>${esc(L2(G.n))}</span><small>${list.length}</small></summary>${regs}</details>`;
  }).join('');
  return `${head}${html}${note}`;
}

const SPARK = '<svg viewBox="0 0 24 24"><path d="M10 4l1.7 4.6L16.3 10l-4.6 1.7L10 16.3 8.3 11.7 3.7 10l4.6-1.4L10 4zM18 13l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9L18 13z"/></svg>';
const artImg = d => {
  const sh = page?.shiny;
  const srcs = sh ? [`${SPR}/pokemon/other/official-artwork/shiny/${d.sp}.png`, `${SPR}/pokemon/other/home/shiny/${d.sp}.png`, `https://play.pokemonshowdown.com/sprites/gen5-shiny/${d.ss}.png`] : spriteChain({ sp: d.sp, ss: d.ss }, 'art');
  return img(srcs, { cls: 'poke art', alt: '', w: 300, h: 300 }).replace('loading="lazy"', 'fetchpriority="high"');
};

function customBuildHTML() {
  const { d, cur, base } = page;
  const st = finalStats(d.s, cur.e, cur.v, cur.n, DICT.natures);
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const chg = c => (c ? ` <span class="chgtag">${t('changedTag')}</span>` : '');
  const was = h => `<p class="was">${t('recommended')}: ${h}</p>`;
  const nm = (map, id, none) => (id && map[id] ? esc(dn(map[id])) : none);
  const evTxt = e => e.map((v, i) => (v ? `${v} ${statName(EDK[i])}` : '')).filter(Boolean).join(' / ') || '—';
  const ivBase = cur.v.map((v, i) => (v !== 31 ? `<span class="ev"><b>${v}</b> ${statName(EDK[i])}</span>` : '')).join('');
  const evs = cur.e.map((v, i) => (v ? `<span class="ev ${v !== base.e[i] ? 'chg' : ''}"><b>${v}</b> ${statName(EDK[i])}</span>` : '')).join('');
  const mC = !same([...cur.m].sort(), [...base.m].sort()), aC = cur.a !== base.a, iC = cur.i !== base.i, nC = cur.n !== base.n, eC = !same(cur.e, base.e), vC = !same(cur.v, base.v);
  const any = mC || aC || iC || nC || eC || vC;
  const natTxt = id => { const n = DICT.natures[id]; return n ? `${esc(dn(n))}${n.plus ? ` <small>+${statName(n.plus)} −${statName(n.minus)}</small>` : ''}` : '—'; };
  return `<section class="sec"><h2>${t('customBuild')}</h2><div class="build">
    <p class="cbsum ${any ? '' : 'ok'}">${any ? (n => t(n === 1 ? 'customOne' : 'customSome', { n }))([mC, aC, iC, nC, eC, vC].filter(Boolean).length) : t('customNone')}</p>
    <div><h3>${t('moves')}${chg(mC)}</h3><ul class="slots">${cur.m.filter(Boolean).map(id => `<li class="slot ${base.m.includes(id) ? '' : 'chg'}">${chipMove(id)}${base.m.includes(id) ? '' : `<span class="newtag">${t('newTag')}</span>`}</li>`).join('')}</ul>${mC ? was(base.m.filter(id => DICT.moves[id]).map(id => esc(dn(DICT.moves[id]))).join(', ') || '—') : ''}</div>
    <div><h3>${t('ability')}${chg(aC)}</h3><div class="chips">${chipAbility(cur.a)}</div>${aC ? was(nm(DICT.abilities, base.a, '—')) : ''}</div>
    ${cur.i || iC ? `<div><h3>${t('item')}${chg(iC)}</h3><div class="chips">${cur.i ? chipItem(cur.i) : `<span class="dim">${t('noItem')}</span>`}</div>${iC ? was(nm(DICT.items, base.i, t('noItem'))) : ''}</div>` : ''}
    <div><h3>${t('nature')}${chg(nC)}</h3><div class="chips">${chipNature(cur.n)}</div>${nC ? was(natTxt(base.n)) : ''}</div>
    ${evs || eC ? `<div><h3>EVs${chg(eC)}</h3><div class="evs">${evs || '—'}</div>${eC ? was(evTxt(base.e)) : ''}</div>` : ''}
    ${ivBase || vC ? `<div><h3>IVs${chg(vC)}</h3><div class="evs">${ivBase || '—'}</div>${vC ? was(evTxt(base.v.map(v => (v !== 31 ? v : 0)))) : ''}</div>` : ''}
    <div><h3>${t('customFinal')}</h3><div class="fstats">${st.map((v, i) => { const dl = page.delta?.[i] || 0; return `<div><small>${statName(EDK[i])}</small><b>${v}</b>${dl ? `<em class="${dl > 0 ? 'up' : 'dn'}">${dl > 0 ? '+' : '−'}${Math.abs(dl)}</em>` : '<em></em>'}</div>`; }).join('')}</div></div>
  </div></section>`;
}
function pokemonHTML() {
  const { d } = page;
  const pm0 = pageMember(), isFav = teams.some(tm => tm.members.some(m => (page.bm ? sameM(m, pm0) : m.id === d.id)));
  const same = d.es === d.en;
  const abilities = d.ab.map(a => `<button class="chip" data-act="ability" data-v="${a.id}">${esc(dn(DICT.abilities[a.id]))}${a.h ? ` <small>${t('hidden')}</small>` : ''}</button>`).join('');
  return `
  ${topbarHTML()}
  <section class="phero" aria-label="${esc(pname(d))}">
    <button class="shinybtn ${page.shiny ? 'on' : ''}" data-act="shiny" aria-pressed="${!!page.shiny}" aria-label="${t('shiny')}">${SPARK}</button>
    ${artImg(d)}
    <span class="num">${dexNum(d.num)}</span>
    <h1>${esc(pname(d))}${page.mod ? ` <small class="modtag">(${t('modified')})</small>` : ''}</h1>
    ${same || !pname2(d) ? '' : `<span class="en">${esc(pname2(d))}</span>`}
    <div class="tags">${d.t.map(typePill).join('')}</div>
    <div class="rank"><small>${t('rank')}</small><button class="tier" style="--tier:${tierColor(d.r)}" data-act="tier" data-v="${esc(d.r)}" aria-label="${t('rankAria', { r: esc(tierLabel(d.r)) })}">${tierNumHTML(d.r)}${esc(tierLabel(d.r))}</button>
      ${d.g ? `<small>· ${t('gen', { g: d.g })}</small>` : ''}${d.dr ? `<small>· ${t('doubles', { r: esc(tierLabel(d.dr)) })}</small>` : ''}</div>
    <div class="facts">${d.h != null ? `<button data-act="size-go" data-v="h">${t('height')} <b>${fmtNum(d.h)} m</b></button>` : ''}${d.w != null ? `<button data-act="size-go" data-v="w">${t('weight')} <b>${fmtNum(d.w)} kg</b></button>` : ''}</div>
  </section>
  ${page.cur ? `<a class="origbtn" href="#/pokemon/${d.id}">${t('viewOriginal')}</a>` : ''}
  <button class="favbtn" data-act="fav" aria-pressed="${isFav}">${favBtnInner(isFav)}</button>

  ${d.g ? oldNote(d) : ''}
  ${page.cur ? customBuildHTML() : ''}
  <section class="sec"><h2>${t('baseStats')}</h2><div id="stats">${statsHTML(d.s, page.delta)}</div>${page.delta?.some(Boolean) ? `<p class="dnote"><span class="dsw"></span>${t('deltaNote')}</p>` : ''}
    <button class="compare-btn" data-act="compare">${I.compare}${t('compare')}</button>
    <a class="compare-btn" href="#/calc?a=${d.id}">${CALCIC}${t('calcFrom')}</a></section>

  <section class="sec"><h2>${t('buildTitle')} <small>Smogon</small></h2><div id="build">${buildHTML()}</div></section>

  <section class="sec"><h2>${t('abilities')}</h2><div class="chips">${abilities}</div></section>

  <section class="sec"><h2>${t('weak')}</h2>${weaknessHTML(d.t)}</section>

  ${countNodes(d.evo) > 1 ? `<section class="sec"><h2>${t('evolution')}</h2><div class="evo">${evoHTML(d.evo, d.id)}</div></section>` : ''}

  ${speciesDataHTML(d)}
  ${formsHTML(d)}
  <section class="sec" id="moves">${movesSectionHTML()}</section>
  <section class="sec" id="enc">${encHTML()}</section>
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
  if (state.view !== 'pokemon' || !location.hash.startsWith(`#/pokemon/${id}`)) return; // se navegó a otro sitio mientras cargaba
  page = { d, fmt: d.sets[0]?.f, idx: 0, expanded: false, mod: /[?&]mod=1\b/.test(location.hash) };
  const bm = /[?&]b=([^&]+)/.exec(location.hash);
  if (bm) { // ficha "personalizada": se abre con la build editada del equipo
    try {
      const b = JSON.parse(decodeURIComponent(bm[1])), E = await getEditor(); mergeEditor(DICT, E);
      if (state.view !== 'pokemon' || !location.hash.startsWith(`#/pokemon/${id}`)) return;
      const { s: si, ...bb } = b;
      page.base = baseBuild(d, { id, s: si }, DICT, E);
      page.cur = currentBuild(page.base, bb);
      page.delta = finalStats(d.s, page.cur.e, page.cur.v, page.cur.n, DICT.natures).map((x, i) => x - finalStats(d.s, page.base.e, page.base.v, page.base.n, DICT.natures)[i]);
      page.bm = { s: si, b: Object.keys(bb).length ? bb : undefined };
      page.mod = page.mod || Object.keys(bb).some(k => k !== 'sh'); page.shiny = !!bb.sh;
    } catch { /* enlace con build ilegible: se enseña la ficha normal */ }
  }
  $app.innerHTML = pokemonHTML();
  document.documentElement.style.setProperty('--accent', TYPE_COLOR[d.t[0]]);
  animate($('#stats'));
  applyRestore();
  loadEnc(d.id);
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

// ───────────────────────── Editor de builds ─────────────────────────
let EDP = null, ED = null;
const getEditor = () => (EDP ??= getJSON('data/editor.json').then(d => (ED = d)).catch(e => { EDP = null; throw e; }));
/** Añade al diccionario los movimientos, objetos y naturalezas que solo trae el editor (así los comparadores y las fichas los entienden) */
function mergeEditor(dict, E) {
  for (const [id, m] of Object.entries(E.moves)) if (!dict.moves[id]) dict.moves[id] = { n: m[0], e: m[1], t: m[2], c: m[3], p: m[4], a: m[5], pp: 0, pr: m[6], d: '', de: '' };
  for (const [id, x] of Object.entries(E.items)) if (!dict.items[id]) dict.items[id] = { n: x[0], e: x[1], d: '', de: '', i: x[2] };
  for (const [id, x] of Object.entries(E.natures)) if (!dict.natures[id]) dict.natures[id] = { n: x[0], e: x[1], plus: x[2], minus: x[3] };
}
const STAT_IC = [
  '<path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/>',
  '<path d="M20 4v5l-9 7l-4 4l-3 -3l4 -4l7 -9l5 0"/><path d="M6.5 11.5l6 6"/>',
  '<path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/>',
  '<path d="M6 21l15 -15l-3 -3l-15 15l3 3"/><path d="M15 6l3 3"/><path d="M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2"/><path d="M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2"/>',
  '<path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/><path d="M12 3v18"/>',
  '<path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"/>',
];
const statIc = i => `<svg class="edsi" viewBox="0 0 24 24" aria-hidden="true">${STAT_IC[i]}</svg>`;
const pct = (v, max) => Math.round(v / max * 100);
let ed = null; // { slot, k, d, base, cur, pick, q }
async function openEditor(slot, k, ext) {
  const m = ext ? ext.member : teams[slot]?.members[k]; if (!m) return;
  try {
    const [d, dict, E] = await Promise.all([getPokemon(m.id), getDict(), getEditor()]);
    mergeEditor(dict, E);
    const base = baseBuild(d, m, dict, E);
    ed = { slot, k, ext, d, base, cur: currentBuild(base, m.b), pick: null, q: '' };
    openSheet(pname(d), '<div id="edbody"></div>', { wide: true });
    sheet.dataset.ed = '1';
    paintEditor();
  } catch { toast(t('loadFail')); }
}
const natLabel = id => { const n = DICT.natures[id]; return n ? `${dn(n)}${n.plus ? ` <small>+${statName(n.plus)} −${statName(n.minus)}</small>` : ` <small>${t('edNeutral')}</small>`}` : esc(id); };
function paintEditor(keepScroll = true) {
  const box = $('#edbody'); if (!box || !ed) return;
  const sb = $('.sheet-body', sheet), y = sb.scrollTop;
  box.innerHTML = ed.pick ? editorPickHTML() : editorHTML();
  sb.scrollTop = keepScroll ? y : 0;
  if (ed.pick) $('#ed-q')?.focus({ preventScroll: true });
}
function editorHTML() {
  const { d, cur, base } = ed;
  const abil = d.ab.find(a => a.id === cur.a);
  const mvBtn = i => {
    const id = cur.m[i], m = id && DICT.moves[id];
    return `<button class="edmove ${m ? '' : 'empty'}" data-act="ed-pick" data-v="m${i}" style="--tc:${m ? TYPE_COLOR[m.t] : 'var(--line)'}">${m ? `${typeIcon(m.t)}<span class="mn">${esc(dn(m))}</span><small>${m.p ? m.p : '—'}</small>` : `<span class="mn">${t('edEmptyMove')}</span>`}</button>`;
  };
  const stats = finalStats(d.s, cur.e, cur.v, cur.n, DICT.natures), tot = evTotal(cur.e);
  const row = (kind, i) => kind === 'e'
    ? `<div class="edrow">${statIc(i)}<span class="edl">${statName(EDK[i])}</span><input class="edr" type="range" data-ed="e" data-k="${i}" min="0" max="${EV_MAX}" step="4" value="${cur.e[i]}" style="--p:${pct(cur.e[i], EV_MAX)}%" aria-label="EV ${statName(EDK[i])}"><output id="ev-${i}">${cur.e[i]}</output><b class="edst" id="st-${i}">${stats[i]}</b></div>`
    : `<div class="edrow">${statIc(i)}<span class="edl">${statName(EDK[i])}</span><input class="edr" type="range" data-ed="v" data-k="${i}" min="0" max="31" step="1" value="${cur.v[i]}" style="--p:${pct(cur.v[i], 31)}%" aria-label="IV ${statName(EDK[i])}"><output id="iv-${i}">${cur.v[i]}</output></div>`;
  const item = cur.i && DICT.items[cur.i];
  return `<div class="ed">
    <div class="edtop">${pokeImg(d, 'art', 'edart', 96, cur.sh)}<div class="edtx"><b>${esc(pname(d))}</b><span class="types">${d.t.map(typeDot).join('')}</span></div></div>
    <div class="edbtns"><button class="chip ${cur.sh ? 'accent' : ''}" data-act="ed-shiny" aria-pressed="${cur.sh}">${SPARK_I}Shiny</button><button class="chip" data-act="ed-opt">${t('edOpt')}</button></div>
    <p class="shint">${t('edOptHint')}</p>
    <div class="edpills">
      <button class="ddbtn" data-act="ed-pick" data-v="ability"><span class="ddl">${t('edAbility')}</span><span class="ddv">${abil ? esc(dn(DICT.abilities[abil.id])) : esc(cur.a)}</span></button>
      <button class="ddbtn" data-act="ed-pick" data-v="item"><span class="ddl">${t('edItem')}</span><span class="ddv">${item ? esc(dn(item)) : t('edNoItem')}</span></button>
      <button class="ddbtn" data-act="ed-pick" data-v="nature"><span class="ddl">${t('edNature')}</span><span class="ddv">${DICT.natures[cur.n] ? esc(dn(DICT.natures[cur.n])) : esc(cur.n)}</span></button>
    </div>
    <h3>${t('edMoves')}</h3><div class="edmoves">${[0, 1, 2, 3].map(mvBtn).join('')}</div>
    <h3>${t('edEvs')} <small id="ev-tot" class="${tot > EV_TOTAL ? 'bad' : ''}">${t('edTotal')} ${tot}/${EV_TOTAL}</small></h3>${[0, 1, 2, 3, 4, 5].map(i => row('e', i)).join('')}
    <h3>${t('edIvs')}</h3>${[0, 1, 2, 3, 4, 5].map(i => row('v', i)).join('')}
  </div>`;
}
const SPARK_I = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 4l1.7 4.6L16.3 10l-4.6 1.7L10 16.3 8.3 11.7 3.7 10l4.6-1.4L10 4zM18 13l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9L18 13z"/></svg>';
function editorPickHTML() {
  const { d, cur, pick, q } = ed, f = fold(q || '');
  const head = `<div class="edph"><button class="iconbtn" data-act="ed-back" aria-label="${t('backShort')}">${I.back}</button>${/^(m\d|item)$/.test(pick) ? `<input id="ed-q" class="unin" value="${esc(q || '')}" placeholder="${t('edSearch')}" autocomplete="off" autocapitalize="off" spellcheck="false">` : `<b>${t(pick === 'ability' ? 'edAbility' : 'edNature')}</b>`}</div>`;
  let opts = '';
  if (pick === 'ability') opts = d.ab.map(a => { const x = DICT.abilities[a.id]; return `<button class="edopt ${cur.a === a.id ? 'on' : ''}" data-act="ed-set" data-v="${a.id}"><b>${esc(dn(x))}${a.h ? ` <small>${t('hidden')}</small>` : ''}</b><small>${esc(dd(x))}</small></button>`; }).join('');
  else if (pick === 'nature') opts = Object.keys(DICT.natures).sort((a, b) => dn(DICT.natures[a]).localeCompare(dn(DICT.natures[b]))).map(id => `<button class="edopt ${cur.n === id ? 'on' : ''}" data-act="ed-set" data-v="${id}"><b>${natLabel(id)}</b></button>`).join('');
  else if (pick === 'item') {
    const ids = Object.keys(ED.items).filter(id => !f || fold(dn(DICT.items[id])).includes(f) || fold(DICT.items[id].e).includes(f)).sort((a, b) => dn(DICT.items[a]).localeCompare(dn(DICT.items[b]))).slice(0, 80);
    opts = (f ? '' : `<button class="edopt ${cur.i === '' ? 'on' : ''}" data-act="ed-set" data-v=""><b>${t('edNoItem')}</b></button>`) + ids.map(id => `<button class="edopt ${cur.i === id ? 'on' : ''}" data-act="ed-set" data-v="${id}">${itemImg(DICT.items[id])}<b>${esc(dn(DICT.items[id]))}</b></button>`).join('');
  } else {
    const slot = Number(pick.slice(1));
    const ids = (ED.learn[d.id] || []).filter(id => DICT.moves[id] && (!f || fold(dn(DICT.moves[id])).includes(f) || fold(DICT.moves[id].e).includes(f))).sort((a, b) => dn(DICT.moves[a]).localeCompare(dn(DICT.moves[b])));
    opts = (cur.m[slot] ? `<button class="edopt rm" data-act="ed-set" data-v="-">${IC.trash}<b>${t('edRemove')}</b></button>` : '')
      + ids.map(id => { const m = DICT.moves[id], used = cur.m.includes(id) && cur.m[slot] !== id; return `<button class="edopt ${cur.m[slot] === id ? 'on' : ''}" ${used ? 'disabled' : ''} data-act="ed-set" data-v="${id}">${typeIcon(m.t)}<b>${esc(dn(m))}</b><small>${catName(m.c)}${m.p ? ` · ${m.p}` : ''}</small></button>`; }).join('')
      || `<p class="shint">${t('edNone')}</p>`;
  }
  return `${head}<div class="edlist">${opts}</div>`;
}
function persistEditor() {
  const { slot, k, base, cur, ext } = ed;
  if (ext) { const b = diffBuild(base, cur); if (b) ext.member.b = b; else delete ext.member.b; ext.after(); return; }
  const m = teams[slot]?.members[k]; if (!m) return;
  const b = diffBuild(base, cur);
  if (b) m.b = b; else delete m.b;
  saveSlot(slot); if (inTeams()) paintTeams();
}
function onEditorInput(e) {
  const el = e.target, kind = el.dataset.ed, i = Number(el.dataset.k), { cur, d } = ed;
  let v = Number(el.value);
  if (kind === 'e') {
    const others = evTotal(cur.e) - cur.e[i];
    const room = Math.max(0, Math.floor((EV_TOTAL - others) / 4) * 4);
    if (v > room) { v = room; el.value = v; }
    cur.e[i] = v; $(`#ev-${i}`).textContent = v; el.style.setProperty('--p', pct(v, EV_MAX) + '%');
    $('#ev-tot').textContent = `${t('edTotal')} ${evTotal(cur.e)}/${EV_TOTAL}`;
  } else { cur.v[i] = v; $(`#iv-${i}`).textContent = v; el.style.setProperty('--p', pct(v, 31) + '%'); }
  finalStats(d.s, cur.e, cur.v, cur.n, DICT.natures).forEach((x, j) => { const o = $(`#st-${j}`); if (o) o.textContent = x; });
}


// ───────────────────────── Uso sin conexión ─────────────────────────
const OFF_KEY = 'pk.offline';
const off = { busy: false, done: 0, total: 0, at: Number(store.get(OFF_KEY) || 0) || 0, prompt: null, msg: '' };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); off.prompt = e; refreshModal(); });
window.addEventListener('appinstalled', () => { off.prompt = null; refreshModal(); });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function offlineHTML() {
  if (!('caches' in window)) return '';
  const date = off.at ? new Date(off.at).toLocaleDateString(lang(), { day: 'numeric', month: 'short' }) : '';
  const status = off.busy ? t('offBusy', { p: off.total ? Math.round(off.done / off.total * 100) : 0 }) : off.msg || (off.at ? t('offDone', { d: date }) : t('offNone'));
  return `<div class="sgroup offg"><div class="offtx"><b>${t('offTitle')}</b><small>${status}</small></div>
    ${off.busy ? `<div class="offbar"><i style="width:${off.total ? Math.round(off.done / off.total * 100) : 0}%"></i></div>` : ''}
    <div class="offbtns"><button class="chip" data-act="off-download" ${off.busy ? 'disabled' : ''}>${off.at ? t('offUpdate') : t('offDownload')}</button>${off.at && !off.busy ? `<button class="chip" data-act="off-clear">${t('offClear')}</button>` : ''}${off.prompt ? `<button class="chip" data-act="off-install">${t('offInstall')}</button>` : ''}</div>
    ${isIOS() && !isStandalone() ? `<small class="offhint">${t('offIos')}</small>` : ''}</div>`;
}
async function offlineDownload() {
  if (off.busy) return;
  off.busy = true; off.done = 0; off.msg = ''; refreshModal();
  try {
    const ks = [...new Set(INDEX.map(p => p.k))];
    const data = ['index', 'meta', 'dict', 'learners', 'abilities', 'items', 'editor', 'enc-dict'].map(n => `data/${n}.json`)
      .concat(ks.map(k => `data/pokemon/${k}.json`), ks.map(k => `data/enc/${k}.json`));
    const imgs = INDEX.map(p => smallSprite(p));
    off.total = data.length + imgs.length;
    const [dc, ic] = await Promise.all([caches.open('pk-data-v1'), caches.open('pk-img-v1')]);
    let n = 0, fails = 0, tick = 0;
    const jobs = [...data.map(u => [dc, u, false]), ...imgs.map(u => [ic, u, true])];
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (n < jobs.length) {
        const [c, u, cors] = jobs[n++];
        try { const r = await fetch(u, cors ? { mode: 'cors' } : { cache: 'reload' }); if (r.ok) await c.put(u, r); else fails++; } catch { fails++; }
        off.done++;
        if (++tick % 25 === 0) refreshModal();
      }
    }));
    if (fails > off.total * 0.2) throw new Error('too many failures');
    off.at = Date.now(); store.set(OFF_KEY, String(off.at));
  } catch (e) { console.error(e); off.msg = t('offFail'); }
  off.busy = false; refreshModal();
}
async function offlineClear() {
  try { for (const k of await caches.keys()) if (/^pk-(data|img)-/.test(k)) await caches.delete(k); } catch { /* sin acceso */ }
  off.at = 0; try { localStorage.removeItem(OFF_KEY); } catch { /* sin almacenamiento */ }
  off.msg = ''; refreshModal();
}

// ───────────────────────── Showdown: exportar / importar equipos ─────────────────────────
const SD_LBL = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];
const sd = { mode: 'export', slot: 0, text: '', msg: '', busy: false };
async function teamToShowdown(i) {
  const [dict, E] = await Promise.all([getDict(), getEditor()]); mergeEditor(dict, E);
  const out = [];
  for (const m of teams[i].members) {
    const d = await getPokemon(m.id), cur = currentBuild(baseBuild(d, m, dict, E), m.b);
    const L = [`${d.en}${cur.i && dict.items[cur.i] ? ` @ ${dict.items[cur.i].e}` : ''}`];
    if (cur.a && dict.abilities[cur.a]) L.push(`Ability: ${dict.abilities[cur.a].e}`);
    const ev = cur.e.map((v, k) => (v ? `${v} ${SD_LBL[k]}` : '')).filter(Boolean);
    if (ev.length) L.push(`EVs: ${ev.join(' / ')}`);
    if (dict.natures[cur.n]) L.push(`${dict.natures[cur.n].e} Nature`);
    const iv = cur.v.map((v, k) => (v !== 31 ? `${v} ${SD_LBL[k]}` : '')).filter(Boolean);
    if (iv.length) L.push(`IVs: ${iv.join(' / ')}`);
    if (cur.sh) L.push('Shiny: Yes');
    cur.m.filter(Boolean).forEach(id => dict.moves[id] && L.push(`- ${dict.moves[id].e}`));
    out.push(L.join('\n'));
  }
  return out.join('\n\n');
}
/** Convierte el texto de Showdown en miembros de equipo (con su build). Devuelve { members, skipped } */
async function showdownToTeam(text) {
  const [dict, E] = await Promise.all([getDict(), getEditor()]); mergeEditor(dict, E);
  const f = x => fold(String(x || '').replace(/[^A-Za-z0-9À-ſ]/g, ''));
  const mapOf = (obj, keyFn) => { const m = new Map(); for (const [id, x] of Object.entries(obj)) for (const k of keyFn(x, id)) m.set(f(k), id); return m; };
  const pokeMap = new Map(); for (const p of INDEX) for (const k of [p.en, p.es, p.id]) pokeMap.set(f(k), p.id);
  const moveMap = mapOf(dict.moves, x => [x.e, x.n]), itemMap = mapOf(dict.items, x => [x.e, x.n]), abMap = mapOf(dict.abilities, x => [x.e, x.n]), natMap = mapOf(dict.natures, x => [x.e, x.n]);
  const members = [], skipped = [];
  for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean); if (!lines.length) continue;
    let head = lines[0], item = '';
    const at = head.indexOf(' @ '); if (at >= 0) { item = head.slice(at + 3).trim(); head = head.slice(0, at); }
    head = head.replace(/\s*\((M|F)\)\s*$/i, '').trim();
    const nick = /^(.*)\((.+)\)$/.exec(head);
    const id = pokeMap.get(f(nick ? nick[2] : head)) || pokeMap.get(f(head));
    if (!id) { skipped.push(head); continue; }
    if (members.length >= MAXTEAM) { skipped.push(head); continue; }
    const d = await getPokemon(id), base = baseBuild(d, { id }, dict, E), cur = { ...base, m: [], e: [0, 0, 0, 0, 0, 0], v: [31, 31, 31, 31, 31, 31], i: item ? (itemMap.get(f(item)) || '') : '', sh: false };
    for (const l of lines.slice(1)) {
      let m;
      if ((m = /^ability:\s*(.+)$/i.exec(l))) { const a = abMap.get(f(m[1])); if (a && d.ab.some(x => x.id === a)) cur.a = a; }
      else if ((m = /^(evs|ivs):\s*(.+)$/i.exec(l))) {
        const arr = m[1].toLowerCase() === 'evs' ? cur.e : cur.v;
        for (const part of m[2].split('/')) { const q = /(\d+)\s*(hp|atk|def|spa|spd|spe)/i.exec(part); if (q) arr[SD_LBL.findIndex(x => x.toLowerCase() === q[2].toLowerCase())] = Number(q[1]); }
      }
      else if ((m = /^(.+?)\s+nature$/i.exec(l))) { const n = natMap.get(f(m[1])); if (n) cur.n = n; }
      else if (/^shiny:\s*yes/i.test(l)) cur.sh = true;
      else if ((m = /^-\s*(.+)$/.exec(l))) { const mv = moveMap.get(f(m[1])) || moveMap.get(f(m[1].replace(/\s*\[.*\]$/, ''))); if (mv && cur.m.length < 4 && !cur.m.includes(mv)) cur.m.push(mv); }
    }
    if (!cur.m.length) cur.m = [...base.m];
    const b = diffBuild(base, cur);
    members.push(b ? { id, b } : { id });
  }
  return { members, skipped };
}
const sdModalHTML = () => `<div class="scard" role="dialog" aria-modal="true" aria-label="Showdown">
  <div class="shead"><button class="iconbtn" data-act="settings-close" aria-label="${t('close')}">${IC.x}</button><h2>${t(sd.mode === 'export' ? 'sdExport' : 'sdImport')}</h2></div>
  <p class="shint">${t(sd.mode === 'export' ? 'sdExportHint' : 'sdImportHint')}</p>
  <textarea id="sd-text" class="sdtext" spellcheck="false" autocomplete="off" autocapitalize="off" ${sd.mode === 'export' ? 'readonly' : `placeholder="${t('sdPlaceholder')}"`}>${esc(sd.text)}</textarea>
  ${sd.msg ? `<p class="shint">${sd.msg}</p>` : ''}
  <div class="slotacts">${sd.mode === 'export' ? `<button class="chip" data-act="sd-copy">${IC.share}${t('sdCopy')}</button>` : `<button class="chip" data-act="sd-run" ${sd.busy ? 'disabled' : ''}>${IC.check}${t('sdRun')}</button>`}</div>
</div>`;
async function openShowdown(mode, slot) {
  sd.mode = mode; sd.slot = slot; sd.msg = ''; sd.text = ''; sd.busy = false;
  if (mode === 'export') { try { sd.text = await teamToShowdown(slot); } catch { toast(t('loadFail')); return; } }
  showModal('sd');
}
async function runShowdownImport() {
  const text = $('#sd-text')?.value || ''; if (!text.trim()) return;
  sd.busy = true; sd.text = text;
  try {
    const { members, skipped } = await showdownToTeam(text);
    if (!members.length) { sd.msg = t('sdNone'); sd.busy = false; refreshModal(); return; }
    teams[sd.slot].members = members; saveSlot(sd.slot); afterTeamsChange();
    closeSettings(); toast(skipped.length ? t('sdDoneSkip', { n: members.length, s: skipped.length }) : t('sdDone', { n: members.length }));
  } catch (e) { console.error(e); sd.msg = t('loadFail'); sd.busy = false; refreshModal(); }
}

// ───────────────────────── Calculadora de daño ─────────────────────────
const CALC_KEY = 'pk.calc';
const ZB = () => ({ atk: 0, def: 0, spa: 0, spd: 0 });
const calc = { a: { id: 'garchomp' }, d: { id: 'corviknight' }, ua: null, ud: null, boosts: { a: ZB(), d: ZB() }, hp: 1, hpA: 1, weather: '', terrain: '', doubles: false, reflect: false, lightScreen: false, crit: false, busy: false, err: false, det: {} };
try { const sv = JSON.parse(store.get(CALC_KEY) || 'null'); if (sv?.a?.id && sv?.d?.id) Object.assign(calc, { a: sv.a, d: sv.d, weather: sv.weather || '', terrain: sv.terrain || '', doubles: !!sv.doubles, reflect: !!sv.reflect, lightScreen: !!sv.lightScreen, hp: sv.hp || 1, hpA: sv.hpA || 1 }); } catch { /* sin guardado */ }
const saveCalc = () => store.set(CALC_KEY, JSON.stringify({ a: calc.a, d: calc.d, weather: calc.weather, terrain: calc.terrain, doubles: calc.doubles, reflect: calc.reflect, lightScreen: calc.lightScreen, hp: calc.hp, hpA: calc.hpA }));
const WEATHERS = [['', 'cNone'], ['Sun', 'cSun'], ['Rain', 'cRain'], ['Sand', 'cSand'], ['Snow', 'cSnow']];
const TERRAINS = [['', 'cNone'], ['Electric', 'cElectric'], ['Grassy', 'cGrassy'], ['Psychic', 'cPsychic'], ['Misty', 'cMisty']];
let calcSeq = 0;
/** Elige el set de Smogon más ofensivo (atacante) o el más resistente (defensor) cuando no se ha elegido ninguno */
function autoSet(d, side) {
  if (!d.sets?.length) return null;
  let best = -1, bs = -1;
  d.sets.forEach((st, i) => {
    if (st.f === 'monotype') return;
    const ev = st.ev || {};
    const atk = Math.max(ev.atk || 0, ev.spa || 0), bulk = (ev.hp || 0) + (ev.def || 0) + (ev.spd || 0);
    const attacks = st.m.filter(sl => { const m = DICT.moves[sl[0]]; return m && m.c !== 's'; }).length;
    const sc = side === 'a' ? atk * 2 + attacks * 60 : bulk * 2 + (st.m.length - attacks) * 30;
    if (sc > bs) { bs = sc; best = i; }
  });
  return best;
}
async function loadCalcUnits() {
  const seq = ++calcSeq;
  try {
    const [dict, eng] = await Promise.all([getDict(), getEngine(), getLearners()]);
    if ([calc.a, calc.d].some(m => m.b)) mergeEditor(dict, await getEditor());
    const mk = async (side) => {
      const m = calc[side], d = await getPokemon(m.id); calc.det[side] = d;
      if (m.s == null && !m.b) { const k = autoSet(d, side); if (k != null && k >= 0) m.s = k; }
      return eng.X.makeUnit(d, m, dict, 'singles', { learnable: learnableOf, pname });
    };
    const [ua, ud] = await Promise.all([mk('a'), mk('d')]);
    if (seq !== calcSeq) return;
    eng.X.clearMemo(); calc.ua = ua; calc.ud = ud; calc.X = eng.X; calc.err = false;
  } catch (e) { console.error(e); if (seq === calcSeq) calc.err = true; }
  saveCalc();
  if (state.view === 'calc') paintCalc();
}
function renderCalc(a) {
  state.view = 'calc';
  document.title = `${t('calcTitle')} · PokeScanner`;
  document.documentElement.style.removeProperty('--accent');
  if (a && BYID.has(a)) { calc.a = { id: a }; calc.ua = null; calc.boosts.a = ZB(); }
  window.scrollTo(0, 0);
  $app.innerHTML = `${topbarHTML()}<header class="hero"><h1>${t('calcTitle')}</h1><p>${t('calcLead')}</p></header><div id="calc-root"><p class="boot">…</p></div>`;
  updateDock();
  loadCalcUnits();
}
const boostTxt = n => (n > 0 ? `+${n}` : String(n));
function calcSideHTML(side) {
  const u = side === 'a' ? calc.ua : calc.ud, m = calc[side], p = BYID.get(m.id), d = calc.det[side];
  const ab = u.ab && DICT.abilities[u.ab], it = u.item && DICT.items[u.item];
  const ev = Object.entries(u.evs || {}).filter(([, v]) => v).map(([k, v]) => `${v} ${statName(k)}`).join(' / ');
  const sets = d?.sets || [];
  const cur = m.b ? 'custom' : m.s != null ? String(m.s) : '';
  const opts = sets.map((st, i) => `<option value="${i}" ${cur === String(i) ? 'selected' : ''}>${esc(st.n)} · ${esc(formatName(st.f))}</option>`).join('')
    + `<option value="custom" ${cur === 'custom' ? 'selected' : ''}>${t('calcCustom')}</option>${sets.length ? '' : `<option value="" ${cur === '' ? 'selected' : ''}>${t('calcAuto')}</option>`}`;
  const bs = ['atk', 'def', 'spa', 'spd'];
  return `<section class="sec calcside"><h2>${t(side === 'a' ? 'calcAtk' : 'calcDef')}</h2>
    <div class="calchead"><button class="pkopt" data-act="calc-pick" data-v="${side}">${pokeImg(p, 'small')}<span><b>${esc(pname(p))}</b><small>${p.t.map(x => typeName(x)).join(' / ')}</small></span></button>
      <button class="iconbtn" data-act="calc-edit" data-v="${side}" aria-label="${t('edTitle')}">${IC.pencil}</button></div>
    <label class="calcset"><span>${t('calcSet')}</span><select data-calcset="${side}" aria-label="${t('calcSet')}">${opts}</select></label>
    <p class="calcsum">${[DICT.natures[u.nat] ? dn(DICT.natures[u.nat]) : u.nat, ab ? dn(ab) : '', it ? dn(it) : t('edNoItem'), ev].filter(Boolean).map(esc).join(' · ')}</p>
    <div class="boosts">${bs.map(k => `<div class="bst"><span>${statName(k)}</span><button class="iconbtn sm" data-act="calc-boost" data-v="${side}:${k}:-1" aria-label="−">−</button><b class="${calc.boosts[side][k] > 0 ? 'up' : calc.boosts[side][k] < 0 ? 'dn' : ''}">${boostTxt(calc.boosts[side][k])}</b><button class="iconbtn sm" data-act="calc-boost" data-v="${side}:${k}:1" aria-label="+">+</button></div>`).join('')}</div>
  </section>`;
}
function calcRows(from, to, hpLeft) {
  const eng = calc.X, ua = from === 'a' ? calc.ua : calc.ud, ud = from === 'a' ? calc.ud : calc.ua;
  const f = { weather: calc.weather || undefined, terrain: calc.terrain || undefined, doubles: calc.doubles };
  const ctx = { field: f, dSide: { reflect: calc.reflect, lightScreen: calc.lightScreen }, crit: calc.crit };
  const aSt = eng.newState(ua), dSt = eng.newState(ud);
  Object.assign(aSt.boosts, calc.boosts[from]); Object.assign(dSt.boosts, calc.boosts[to]);
  dSt.hp = hpLeft;
  const fmt = n => (Math.round(n * 1000) / 10).toLocaleString(lang() === 'en' ? 'en' : 'es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return ua.moves.filter(m => m.c !== 's').map(mv => {
    const r = eng.damage(ua, aSt, ud, dSt, mv, ctx);
    const lo = Math.round(r.min * ud.maxHP), hi = Math.round(r.max * ud.maxHP);
    const k = r.max <= 0 ? 'none' : r.min >= hpLeft ? 'ko' : r.max >= hpLeft ? 'maybe' : 'hit';
    const n1 = Math.ceil(hpLeft / Math.max(r.max, 1e-9)), n2 = Math.ceil(hpLeft / Math.max(r.min, 1e-9));
    const txt = k === 'none' ? t('calcNoDmg') : k === 'ko' ? t('calcOhko') : k === 'maybe' ? t('calcMaybeOhko') : n1 === n2 ? t('calcHko', { n: n1 }) : t('calcHkoRange', { a: n1, b: n2 });
    const m = DICT.moves[mv.id];
    return { mv, m, r, lo, hi, k, txt, fmt };
  });
}
function calcListHTML(from, to) {
  const hp = from === 'a' ? calc.hp : calc.hpA, dmax = (to === 'd' ? calc.ud : calc.ua).maxHP;
  const rows = calcRows(from, to, hp);
  const pf = BYID.get(calc[from].id), pt = BYID.get(calc[to].id);
  return `<div class="cbox ${from === 'a' ? 'fa' : 'fd'}"><h3 class="cdir">${pokeImg(pf, 'small', 'mini')}<b>${esc(pname(pf))}</b> <span>→</span> ${pokeImg(pt, 'small', 'mini')}<b>${esc(pname(pt))}</b></h3>
    <p class="lbl">${t('calcHpOf', { n: esc(pname(pt)) })}</p><div class="chips hpch">${[1, 0.75, 0.5, 0.25].map(h => `<button class="chip" data-act="${from === 'a' ? 'calc-hp' : 'calc-hpa'}" data-v="${h}" aria-pressed="${hp === h}">${h * 100} %</button>`).join('')}</div>${rows.length ? `<ul class="cresl">${rows.map(({ mv, m, r, lo, hi, k, txt, fmt }) => `<li class="cres k-${k}" style="--tc:${TYPE_COLOR[mv.t]}"><div class="cmv">${m ? `<button class="cmvlink" data-act="move" data-v="${mv.id}">${typeIcon(mv.t)}<b>${esc(dn(m))}</b></button>` : `${typeIcon(mv.t)}<b>${esc(mv.name)}</b>`}${catIcon(mv.c)}<span class="cko">${txt}</span></div>
      <div class="cbar"><i style="width:${Math.min(100, r.max * 100)}%"></i><u style="width:${Math.min(100, r.min * 100)}%"></u></div>
      <div class="cnum"><b>${fmt(r.min)}–${fmt(r.max)} %</b><small>${lo}–${hi} / ${dmax} ${t('calcHp')}</small></div></li>`).join('')}</ul>` : `<p class="hint">${t('calcNoMoves')}</p>`}</div>`;
}
function calcHTML() {
  if (calc.err) return `<div class="empty"><b>${t('loadFail')}</b>${t('loadFailHint')}</div>`;
  if (!calc.ua || !calc.ud) return '<p class="boot">…</p>';
  const chip = (act, v, on, label) => `<button class="chip" data-act="${act}" data-v="${v}" aria-pressed="${on}">${label}</button>`;
  return `${calcSideHTML('a')}
    <div class="calcswap"><button class="chip" data-act="calc-swap">⇅ ${t('calcSwap')}</button></div>
    ${calcSideHTML('d')}
    <section class="sec"><h2>${t('calcResult')}</h2>
      ${calcListHTML('a', 'd')}${calcListHTML('d', 'a')}
    </section>
    <section class="sec"><h2>${t('calcField')}</h2>
      <p class="lbl">${t('calcWeather')}</p><div class="chips">${WEATHERS.map(([k, l]) => chip('calc-set', `weather:${k}`, calc.weather === k, t(l))).join('')}</div>
      <p class="lbl">${t('calcTerrain')}</p><div class="chips">${TERRAINS.map(([k, l]) => chip('calc-set', `terrain:${k}`, calc.terrain === k, t(l))).join('')}</div>
      <p class="lbl">${t('calcOther')}</p><div class="chips">${chip('calc-tog', 'doubles', calc.doubles, t('calcDoubles'))}${chip('calc-tog', 'reflect', calc.reflect, t('calcReflect'))}${chip('calc-tog', 'lightScreen', calc.lightScreen, t('calcLightScreen'))}${chip('calc-tog', 'crit', calc.crit, t('calcCrit'))}</div>
      <button class="chip ghost calcreset" data-act="calc-reset">${t('calcReset')}</button>
    </section>`;
}
function paintCalc() {
  const root = $('#calc-root'); if (!root) return;
  const y = window.scrollY; root.innerHTML = calcHTML(); window.scrollTo(0, y); saveCalc();
}
const calcOpenPick = side => openPicker({ mode: 'calc', side });
async function calcEdit(side) { await openEditor(-1, -1, { member: calc[side], after: () => { clearTimeout(calcEdit.t); calcEdit.t = setTimeout(loadCalcUnits, 250); } }); }
document.addEventListener('change', e => {
  const side = e.target?.dataset?.calcset; if (!side) return;
  const v = e.target.value, m = calc[side];
  if (v === 'custom') { calcEdit(side); paintCalc(); return; }
  calc[side] = { id: m.id, ...(v === '' ? {} : { s: Number(v) }) };
  calc.boosts[side] = ZB(); calc[side === 'a' ? 'ua' : 'ud'] = null; paintCalc(); loadCalcUnits();
});

// ───────────────────────── Comunidad ─────────────────────────
const com = { q: '', pokes: [], types: [], minScore: 0, fopen: false, sort: 'new', items: [], more: false, loading: false, err: false, post: null, comments: [], full: null, confirm: null, busy: false, msg: '' };
let curPostId = null, pubCtx = null;
const PAGE = 20;
const ago = iso => {
  const s = (new Date(iso).getTime() - Date.now()) / 1000, a = Math.abs(s);
  const [v, u] = a < 60 ? [0, 'second'] : a < 3600 ? [s / 60, 'minute'] : a < 86400 ? [s / 3600, 'hour'] : a < 2592000 ? [s / 86400, 'day'] : a < 31536000 ? [s / 2592000, 'month'] : [s / 31536000, 'year'];
  try { return new Intl.RelativeTimeFormat(lang(), { numeric: 'auto', style: 'short' }).format(Math.round(v), u); } catch { return ''; }
};
const heart = on => `<svg viewBox="0 0 24 24" class="hrt ${on ? 'on' : ''}" aria-hidden="true"><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/></svg>`;
const bubble = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20l1.3 -3.9a9 8 0 1 1 3.4 2.9l-4.7 1"/></svg>';
const postMinis = ms => `<span class="minis">${ms.map(m => { const p = BYID.get(m.id); return p ? pokeImg(p, 'small', 'mini', undefined, !!m.b?.sh) : ''; }).join('')}</span>`;
const scoreBadge = ms => { const ps = (ms || []).map(m => BYID.get(m.id)).filter(Boolean); return ps.length >= 3 ? (sc => `<span class="sn sc big" style="--sc:${scoreInfo(sc).c}" title="${t('an_title')}">${sc}</span>`)(analyzeTeam(ps).score) : `<span class="sn sc big none" title="${t('an_title')}">-</span>`; };
const userLink = (uid, name, avatar) => `<button class="userlink" data-act="user-open" data-v="${uid}">${avatarImg(avatar, 'sm')}<b>${esc(name || '?')}</b></button>`;
const delBtns = x => ((x.mine || auth.isAdmin()) ? (String(com.confirm) === String(x.id)
  ? `<button class="cact danger" data-act="com-del-yes" data-v="${x.id}">${t('comDeleteSure')}</button><button class="cact" data-act="com-del-no">${t('comCancel')}</button>`
  : `<button class="cact" data-act="com-del" data-v="${x.id}" aria-label="${t('comDelete')}">${IC.trash}</button>`) : '');
function postCardHTML(x) {
  return `<article class="cpost">
    <div class="chead">${userLink(x.user_id, x.username, x.avatar)}<small>${ago(x.created_at)}</small></div>
    <button class="cmain" data-act="com-open" data-v="${x.id}">
      <span class="cname">${esc(x.name)}</span>
      ${x.description ? `<span class="cdesc">${esc(x.description)}</span>` : ''}
      ${postMinis(x.members || [])}
    </button>
    <div class="cscore">${scoreBadge(x.members)}</div>
    <div class="cacts"><button class="cact like ${x.liked ? 'on' : ''}" data-act="com-like" data-v="${x.id}" aria-pressed="${!!x.liked}" aria-label="${t('comLike')}">${heart(x.liked)}<span>${x.likes}</span></button>
      <button class="cact" data-act="com-open" data-v="${x.id}" data-c="1" aria-label="${t('comComments')}">${bubble}<span>${x.comments}</span></button><span class="grow"></span>${delBtns(x)}</div>
  </article>`;
}
const FILTIC = '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>';
const postScore = x => { if (x._sc == null) { const ps = (x.members || []).map(m => BYID.get(m.id)).filter(Boolean); x._sc = ps.length >= 3 ? analyzeTeam(ps).score : -1; } return x._sc; };
const comClient = () => com.types.length > 0 || com.minScore > 0;
const comVisible = () => (!comClient() ? com.items : com.items.filter(x => {
  const ps = (x.members || []).map(m => BYID.get(m.id)).filter(Boolean);
  return com.types.every(ty => ps.some(p => p.t.includes(ty))) && (!com.minScore || postScore(x) >= com.minScore);
}));
const comFCount = () => com.pokes.length + com.types.length + (com.minScore ? 1 : 0);
function comPanelHTML() {
  const pk = com.pokes.map(id => BYID.get(id)).filter(Boolean).map(p => `<button class="chip pkf" data-act="com-pk-del" data-v="${p.id}" aria-label="${t('edRemove')}">${pokeImg(p, 'small', 'thumb')}${esc(pname(p))}<span class="x">${IC.x}</span></button>`).join('');
  return `<div class="companel">
    <p class="lbl">${t('comFPokes')}</p><div class="chips">${pk}${com.pokes.length < 3 ? `<button class="chip" data-act="com-pk-add">${IC.plus}${t('comFAdd')}</button>` : ''}</div>
    <p class="lbl">${t('comFTypes')}</p><div class="chips">${TYPES.map(ty => `<button class="chip" data-act="com-type" data-v="${ty}" aria-pressed="${com.types.includes(ty)}">${typeIcon(ty)}${typeName(ty)}</button>`).join('')}</div>
    <p class="lbl">${t('comFScore')}</p><div class="chips">${[0, 50, 70, 85].map(n => `<button class="chip" data-act="com-score" data-v="${n}" aria-pressed="${com.minScore === n}">${n ? `${n}+` : t('comFAny')}</button>`).join('')}</div>
    ${comFCount() ? `<button class="chip ghost" data-act="com-fclear">${t('comFClear')}</button>` : ''}
  </div>`;
}
function communityHTML() {
  const sortBtn = (k, lbl) => `<button class="chip" data-act="com-sort" data-v="${k}" aria-pressed="${com.sort === k}">${t(lbl)}</button>`;
  const vis = comVisible();
  const list = vis.length ? vis.map(postCardHTML).join('')
    : com.loading ? '' : com.err ? `<div class="empty"><b>${t('comLoadFail')}</b></div>` : (com.q.trim() || comFCount()) ? `<div class="empty"><b>${t('comNoMatch')}</b></div>` : `<div class="empty"><b>${t('comEmpty')}</b>${t('comEmptyHint')}</div>`;
  const pkChips = com.pokes.map(id => BYID.get(id)).filter(Boolean).map(p => `<button class="chip pkf" data-act="com-pk-del" data-v="${p.id}" aria-label="${t('edRemove')}">${pokeImg(p, 'small', 'thumb')}${esc(pname(p))}<span class="x">${IC.x}</span></button>`).join('');
  return `<header class="hero"><h1 class="brand">${titleIc('dock-community')}${t('comTitle')}</h1><p>${t('comLead')}</p></header>
    <div class="searchbar"><div class="search ${com.q ? 'filled' : ''}">${I.search}<input id="com-q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${t('comSearchPh')}" value="${esc(com.q)}" aria-label="${t('comSearchPh')}"></div></div>
    <div class="comfilters"><button class="chip ${com.fopen ? 'on' : ''}" data-act="com-ftoggle" aria-expanded="${com.fopen}">${FILTIC}${t('comFilters')}${comFCount() ? ` <span class="badge on">${comFCount()}</span>` : ''}<svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button></div>
    ${com.fopen ? comPanelHTML() : ''}
    <div class="comtools"><div class="comsort">${sortBtn('new', 'comNew')}${sortBtn('top', 'comTop')}</div><span class="comtools-r">${auth.isAdmin() ? `<button class="chip" data-act="adm-bans">${t('admBans')}</button>` : ''}<button class="chip accent" data-act="com-publish">${IC.plus}${t('comPublish')}</button></span></div>
    <div class="cfeed">${list}</div>
    ${com.more ? `<div class="ctarow"><button class="chip" data-act="com-more" ${com.loading ? 'disabled' : ''}>${t('comMore')}</button></div>` : ''}`;
}
function paintCom() {
  const root = $('#com-root'); if (!root) return;
  const y = window.scrollY, q = $('#com-q'), had = q && document.activeElement === q, pos = q?.selectionStart;
  root.innerHTML = communityHTML();
  if (had) { const n = $('#com-q'); n.focus({ preventScroll: true }); try { n.setSelectionRange(pos, pos); } catch { /* sin selección */ } }
  window.scrollTo(0, y);
}
let comT = 0;
document.addEventListener('input', e => {
  if (e.target.id !== 'com-q') return;
  com.q = e.target.value;
  e.target.closest('.search')?.classList.toggle('filled', !!com.q);
  clearTimeout(comT); comT = setTimeout(() => loadFeed(true), 350);
});
async function loadFeed(reset) {
  if (com.loading && !reset) return;
  const seq = com.seq = (com.seq || 0) + 1; // si se pide otra vez (p. ej. al terminar de iniciar sesión) solo vale la última respuesta
  com.loading = true; com.err = false;
  if (reset) { com.items = []; com.more = false; }
  paintCom();
  try {
    const rows = await auth.communitySearch(com.q.trim(), com.pokes, com.sort, com.items.length, PAGE);
    if (seq !== com.seq) return;
    com.items = com.items.concat(rows.filter(r => !com.items.some(x => String(x.id) === String(r.id))));
    com.more = rows.length === PAGE;
    if (reset) com.auto = 0;
  } catch { if (seq !== com.seq) return; com.err = true; if (com.items.length) toast(t('comLoadFail')); }
  com.loading = false;
  if (state.view === 'community') paintCom();
  // con filtros de tipo o puntuación (que se aplican aquí) se siguen pidiendo páginas hasta que salgan unos cuantos equipos
  if (!com.err && comClient() && com.more && comVisible().length < 6 && (com.auto = (com.auto || 0) + 1) <= 8 && seq === com.seq) loadFeed(false);
}
function renderCommunity() {
  state.view = 'community';
  document.title = `${t('comTitle')} · PokeScanner`;
  document.documentElement.style.removeProperty('--accent');
  com.confirm = null;
  $app.innerHTML = '<div id="com-root"></div>';
  window.scrollTo(0, 0);
  updateDock();
  loadFeed(true);
}
async function likePost(id) {
  if (!requireLogin({ type: 'community', hash: location.hash })) return;
  const same = y => y && String(y.id) === String(id), all = [...com.items, ...usr.posts, com.post].filter(same), x = all[0]; if (!x) return;
  const on = !x.liked, sync = () => { for (const y of all) { y.liked = on; y.likes = Math.max(0, y.likes + (on ? 1 : -1)); } };
  sync(); repaintCom();
  try { await auth.setLike(id, on); } catch (err) { on ? (x.liked = true) : (x.liked = false); const bk = !on; for (const y of all) { y.liked = bk; y.likes = Math.max(0, y.likes + (bk ? 1 : -1)); } repaintCom(); toast(t(/banned/.test(String(err?.message)) ? 'comBanned' : 'syncFail')); }
}
const repaintCom = () => (state.view === 'post' ? paintPost() : state.view === 'user' ? paintUser() : paintCom());
async function removePost(id) {
  try {
    await auth.deletePost(id);
    com.items = com.items.filter(i => String(i.id) !== String(id)); usr.posts = usr.posts.filter(i => String(i.id) !== String(id)); com.confirm = null;
    toast(t('comDeleted'));
    if (state.view === 'post') location.hash = '#/community'; else repaintCom();
  } catch { toast(t('syncFail')); }
}
// publicar
function publishHTML() {
  const c = pubCtx, filled = teams.map((tm, i) => ({ tm, i })).filter(x => x.tm.members.length);
  if (!filled.length) return `<p class="shint">${t('comPubNoTeams')}</p>`;
  return `<p class="shint">${t('comPubPick')}</p>
    <div class="slotlist">${filled.map(({ tm, i }) => `<button class="slotopt ${c.slot === i ? 'on' : ''}" data-act="pub-pick" data-v="${i}" aria-pressed="${c.slot === i}">
      <span class="sn">${i + 1}</span><span class="sname"><b>${esc(teamName(i))}</b>${postMinis(tm.members)}</span><span class="scount">${tm.members.length}/${MAXTEAM}</span><span class="sck">${IC.check}</span></button>`).join('')}</div>
    <label class="tname"><span>${t('comPubName')}</span><input class="unin" id="pub-name" maxlength="30" value="${esc(c.name)}" autocomplete="off"></label>
    <label class="tname"><span>${t('comPubDesc')} <small id="pub-cnt">${c.desc.length}/280</small></span><textarea class="unin" id="pub-desc" rows="4" maxlength="280" placeholder="${t('comPubDescPh')}">${esc(c.desc)}</textarea></label>
    <p class="shint">${t('comPubNote')}</p><p class="shint err" id="pub-msg" role="alert"></p>
    <div class="ctarow"><button class="chip accent" data-act="pub-go" id="pub-go">${t('comPubGo')}</button></div>`;
}
function openPublish() {
  if (!requireLogin({ type: 'community', hash: location.hash })) return;
  const first = teams.findIndex(tm => tm.members.length);
  pubCtx = { slot: first, name: first >= 0 ? teams[first].name.slice(0, 30) : '', nameTouched: false, desc: '' };
  showModal('publish');
}
const publishModalHTML = () => `<div class="scard" role="dialog" aria-modal="true" aria-label="${t('comPubTitle')}">
  <div class="shead"><button class="iconbtn" data-act="settings-close" aria-label="${t('close')}">${IC.x}</button><h2>${t('comPubTitle')}</h2></div>
  <div id="pub-body">${publishHTML()}</div></div>`;
smodal.addEventListener('input', e => {
  if (!pubCtx) return;
  if (e.target.id === 'pub-name') { pubCtx.name = e.target.value; pubCtx.nameTouched = true; }
  if (e.target.id === 'pub-desc') { pubCtx.desc = e.target.value; const c = $('#pub-cnt', smodal); if (c) c.textContent = `${e.target.value.length}/280`; }
});
async function doPublish() {
  const c = pubCtx, msg = $('#pub-msg', smodal), btn = $('#pub-go', smodal);
  const members = (teams[c.slot]?.members || []).map(m => { const o = { id: m.id }; if (m.s != null) o.s = m.s; if (m.b) o.b = m.b; return o; });
  const name = c.name.trim() || teamName(c.slot);
  if (!members.length) return;
  btn.disabled = true; msg.textContent = '';
  try {
    await auth.publishPost(name.slice(0, 30), c.desc.trim().slice(0, 280), members);
    pubCtx = null; closeSettings(); toast(t('comPublished'));
    if (state.view === 'community') { com.sort = 'new'; loadFeed(true); } else location.hash = '#/community';
  } catch (err) {
    msg.textContent = err.message === 'text_banned' ? t('comPubBanned') : err.message === 'banned' ? t('comBanned') : t('comPubFail');
    btn.disabled = false;
  }
}
// detalle
const nowMs = () => Date.now();
async function renderPost(id) {
  state.view = 'post'; curPostId = id;
  document.title = `${t('comTitle')} · PokeScanner`;
  document.documentElement.style.removeProperty('--accent');
  com.post = null; com.comments = []; com.full = null; com.confirm = null; com.msg = ''; com.reply = null;
  $app.innerHTML = topbarHTML() + '<div id="post-root"><div class="empty"><b>…</b></div></div>';
  window.scrollTo(0, 0); updateDock();
  try {
    const [rows, cms] = await Promise.all([auth.communityFeed('new', 0, 1, id), auth.communityComments(id)]);
    if (String(curPostId) !== String(id) || state.view !== 'post') return;
    com.post = rows[0] || null; com.comments = cms;
    if (com.post) {
      document.title = `${com.post.name} · PokeScanner`;
      const [dict, E] = await Promise.all([getDict(), getEditor()]);
      mergeEditor(dict, E);
      com.full = await Promise.all((com.post.members || []).filter(m => BYID.has(m.id)).map(async m => { const d = await getPokemon(m.id); return { m, d, cur: currentBuild(baseBuild(d, m, dict, E), m.b) }; }));
    }
  } catch { com.post = null; com.err = true; }
  if (String(curPostId) === String(id) && state.view === 'post') {
    paintPost();
    if (/[?&]c=1\b/.test(location.hash)) requestAnimationFrame(() => $('#post-comments')?.scrollIntoView({ block: 'start' }));
  }
}
function buildCardHTML({ m, d, cur }) {
  const it = DICT.items[cur.i], ab = d.ab.find(a => a.id === cur.a), nat = DICT.natures[cur.n];
  const evs = cur.e.map((v, i) => (v ? `${v} ${statName(EDK[i])}` : '')).filter(Boolean).join(' / ');
  const ivs = cur.v.some(v => v !== 31) ? cur.v.map((v, i) => (v !== 31 ? `${v} ${statName(EDK[i])}` : '')).filter(Boolean).join(' / ') : '';
  return `<div class="cbuild">${(mod => `<a class="cb-poke" href="${pokeHref(d.id, mod ? m : null)}">${pokeImg(d, 'small', 'thumb', undefined, cur.sh)}<b>${esc(pname(d))}</b>${mod ? `<small class="modtag">(${t('modified')})</small>` : ''}</a>`)(!!m.b && Object.keys(m.b).some(k => k !== 'sh'))}
    <div class="cb-info">
      <div class="cb-line">${it ? `<button class="cb-item" data-act="item" data-v="${cur.i}">${itemImg(it)}${esc(dn(it))}</button>` : ''}${ab ? `<button class="cb-ab" data-act="ability" data-v="${ab.id}">${esc(dn(DICT.abilities[ab.id] || ab))}</button>` : ''}${nat ? `<span>${esc(dn(nat))}${nat.plus ? ` <small>(+${statName(nat.plus)} −${statName(nat.minus)})</small>` : ''}</span>` : ''}</div>
      <div class="cb-moves">${cur.m.map(id => { const mv = DICT.moves[id]; return mv ? `<button class="cb-mv" style="--tc:${TYPE_COLOR[mv.t]}" data-act="move" data-v="${id}">${typeIcon(mv.t)}${esc(dn(mv))}</button>` : ''; }).join('')}</div>
      <small class="cb-ev">${evs ? `EVs ${evs}` : ''}${ivs ? ` · IVs ${ivs}` : ''}</small>
    </div></div>`;
}
function commentHTML(c, reply = false) {
  const can = c.mine || com.post?.mine || auth.isAdmin();
  const body = esc(c.body).replace(/(^|\s)@([A-Za-z0-9_]{3,16})/g, '$1<span class="ment">@$2</span>');
  const tag = reply ? 'li' : 'div';
  return `<${tag} class="ccm ${reply ? 'rep' : ''}" id="cm-${c.id}">
    <button class="avbtn" data-act="user-open" data-v="${c.user_id}" aria-label="${esc(c.username || '')}">${avatarImg(c.avatar, 'sm')}</button>
    <div class="cbody"><p><button class="userlink" data-act="user-open" data-v="${c.user_id}"><b>${esc(c.username || '?')}</b></button> ${body}</p>
      <div class="cmeta"><small>${ago(c.created_at)}</small>${c.likes ? `<small>${t(c.likes === 1 ? 'cmLikeOne' : 'cmLikeN', { n: c.likes })}</small>` : ''}<button class="cmbtn" data-act="cm-reply" data-v="${c.id}">${t('cmReply')}</button>${can ? `<button class="cmbtn del" data-act="com-cdel" data-v="${c.id}" aria-label="${t('comDelete')}">${IC.trash}</button>` : ''}</div></div>
    <button class="clike ${c.liked ? 'on' : ''}" data-act="cm-like" data-v="${c.id}" aria-pressed="${!!c.liked}" aria-label="${t('comLike')}">${heart(c.liked)}</button>
  </${tag}>`;
}
/** comentarios principales con sus respuestas debajo (como en Instagram, las respuestas a respuestas cuelgan del mismo comentario) */
function commentsListHTML() {
  const all = com.comments, top = all.filter(c => !c.parent_id), ids = new Set(all.map(c => String(c.id)));
  const orphans = all.filter(c => c.parent_id && !ids.has(String(c.parent_id)));
  return [...top, ...orphans].map(c => {
    const reps = all.filter(r => String(r.parent_id) === String(c.id));
    return `<li class="cthread">${commentHTML(c)}${reps.length ? `<ul class="creps">${reps.map(r => commentHTML(r, true)).join('')}</ul>` : ''}</li>`;
  }).join('');
}
function postHTML() {
  const x = com.post;
  if (!x) return `<div class="empty"><b>${t(com.err ? 'comLoadFail' : 'comGone')}</b><div class="ctarow"><a class="chip" href="#/community">${t('comBack')}</a></div></div>`;
  const del = delBtns(x);
  const form = auth.currentUser()
    ? `${com.reply ? `<div class="replybar"><span>${t('cmReplyingTo', { u: esc(com.reply.user) })}</span><button class="iconbtn sm" data-act="cm-reply-x" aria-label="${t('comCancel')}">${IC.x}</button></div>` : ''}<div class="cform"><textarea id="cm-body" rows="2" maxlength="300" placeholder="${t('comCommentPh')}"></textarea><button class="chip accent" data-act="com-send">${t('comSend')}</button></div><p class="shint err" id="cm-msg" role="alert">${esc(com.msg)}</p>`
    : `<div class="ctarow"><button class="chip accent" data-act="com-login">${IC.user}${t('comLoginAct')}</button></div>`;
  return `<header class="chero"><div class="chead">${userLink(x.user_id, x.username, x.avatar)}<small>${ago(x.created_at)}</small></div>
      <h1>${esc(x.name)}</h1>${x.description ? `<p class="cdesc full">${esc(x.description)}</p>` : ''}</header>
    <div class="cacts"><button class="cact like ${x.liked ? 'on' : ''}" data-act="com-like" data-v="${x.id}" aria-pressed="${!!x.liked}" aria-label="${t('comLike')}">${heart(x.liked)}<span>${x.likes}</span></button><span class="grow"></span>${scoreBadge(x.members)}${del}</div>
    <div class="sharedacts"><button class="chip accent" data-act="com-save">${IC.star}${t('comSave')}</button><button class="chip" data-act="com-compare">${IC.battle}${t('comCompare')}</button></div>
    <div class="cbuilds">${(com.full || []).map(buildCardHTML).join('')}</div>
    ${(ps => (ps.length >= 3 ? teamHTML(ps, true) : ''))((x.members || []).map(m => BYID.get(m.id)).filter(Boolean))}
    <section class="sec" id="post-comments"><h2>${t('comComments')} <small>${com.comments.length}</small></h2>
      ${form}
      <ul class="ccms">${com.comments.length ? commentsListHTML() : `<li class="dim">${t('comNoComments')}</li>`}</ul></section>`;
}
function paintPost() {
  const root = $('#post-root'); if (!root) return;
  const y = window.scrollY, draft = $('#cm-body')?.value || '';
  root.innerHTML = postHTML();
  const b = $('#cm-body'); if (b && draft) b.value = draft;
  window.scrollTo(0, y);
}
async function likeComment(id) {
  if (!requireLogin({ type: 'community', hash: location.hash })) return;
  const c = com.comments.find(x => String(x.id) === String(id)); if (!c) return;
  const on = !c.liked, apply = v => { c.liked = v; c.likes = Math.max(0, (c.likes || 0) + (v ? 1 : -1)); };
  apply(on); paintPost();
  try { await auth.setCommentLike(id, on); } catch { apply(!on); paintPost(); toast(t('syncFail')); }
}
async function sendComment() {
  const box = $('#cm-body'); const body = box?.value.trim(); if (!body) return;
  const btn = $('[data-act="com-send"]'); btn.disabled = true;
  try {
    if (com.reply && body === `@${com.reply.user}`) { btn.disabled = false; return; }
    await auth.addComment(com.post.id, body, com.reply?.parent);
    box.value = ''; com.reply = null;
    com.comments = await auth.communityComments(com.post.id); com.post.comments = com.comments.length; com.msg = '';
  } catch (err) { com.msg = t(err.message === 'rate_limit' ? 'comCommentLimit' : err.message === 'text_banned' ? 'comCommentBanned' : err.message === 'banned' ? 'comBanned' : 'comCommentFail'); }
  paintPost();
}


// ───────────────────────── Perfiles de usuario y administración ─────────────────────────
const usr = { id: null, prof: null, posts: [], more: false, teams: null, err: false, confirm: null, msg: '', bans: null };
const postsLabel = n => (Number(n) === 1 ? t('uPostsOne') : t('uPostsN', { n }));
async function renderUser(id) {
  state.view = 'user'; usr.id = id; usr.prof = null; usr.posts = []; usr.more = false; usr.teams = null; usr.err = false; usr.confirm = null; usr.msg = '';
  document.title = `PokeScanner`;
  document.documentElement.style.removeProperty('--accent');
  $app.innerHTML = topbarHTML() + '<div id="user-root"></div>';
  window.scrollTo(0, 0); updateDock();
  if (!auth.currentUser()) { paintUser(); return; }
  try {
    const prof = await auth.communityProfile(id);
    if (usr.id !== id || state.view !== 'user') return;
    usr.prof = prof;
    if (prof) {
      document.title = `${prof.username} · PokeScanner`;
      const friend = prof.relation === 'friend' || prof.relation === 'self';
      const [posts, teams] = await Promise.all([auth.communityUserPosts(id, 0, PAGE), friend ? auth.loadTeamsOf(id).catch(() => null) : null]);
      if (usr.id !== id || state.view !== 'user') return;
      usr.posts = posts; usr.more = posts.length === PAGE; usr.teams = teams;
    }
  } catch { usr.err = true; }
  if (usr.id === id && state.view === 'user') paintUser();
}
function userTeamsHTML() {
  const p = usr.prof;
  if (!(p.relation === 'friend' || p.relation === 'self')) return `<p class="shint">${t('uTeamsLocked')}</p>`;
  const rows = (usr.teams || []).map(r => ({ ...r, members: (r.members || []).filter(m => BYID.has(m.id)) })).filter(r => r.members.length).sort((a, b) => a.slot - b.slot);
  if (!rows.length) return `<p class="shint">${t('uNoTeams')}</p>`;
  return `<div class="uteams">${rows.map(r => `<div class="uteam"><div class="utinfo"><b>${esc(r.name || t('uTeamN', { n: r.slot + 1 }))}</b>${postMinis(r.members)}</div>${scoreBadge(r.members)}
    <button class="iconbtn" data-act="u-team-save" data-v="${r.slot}" aria-label="${t('comSave')}">${IC.star}</button><button class="iconbtn" data-act="u-team-cmp" data-v="${r.slot}" aria-label="${t('comCompare')}">${IC.battle}</button></div>`).join('')}</div>`;
}
function userActionsHTML() {
  const p = usr.prof, rel = p.relation;
  if (rel === 'self') return `<span class="chip static">${t('uSelf')}</span>`;
  if (rel === 'friend') return `<span class="chip static">${IC.check}${t('uFriends')}</span>` + (usr.confirm === 'rm'
    ? `<button class="chip danger" data-act="u-remove">${t('uRemoveSure')}</button><button class="chip" data-act="u-cancel">${t('comCancel')}</button>`
    : `<button class="chip" data-act="u-remove">${t('uRemove')}</button>`);
  if (rel === 'out') return `<span class="chip static">${t('friendPending')}</span><button class="chip" data-act="u-remove">${t('uCancelReq')}</button>`;
  if (rel === 'in') return `<span class="chip static">${t('friendWants')}</span><button class="chip accent" data-act="u-accept">${IC.check}${t('accept')}</button><button class="chip" data-act="u-decline">${t('decline')}</button>`;
  return `<button class="chip accent" data-act="u-add">${IC.userPlus}${t('uFriendAdd')}</button>`;
}
function adminBoxHTML() {
  const p = usr.prof; if (!auth.isAdmin() || p.relation === 'self') return '';
  const two = (k, label, sure, act) => (usr.confirm === k ? `<button class="chip danger" data-act="${act}">${t(sure)}</button><button class="chip" data-act="u-cancel">${t('comCancel')}</button>` : `<button class="chip" data-act="u-ask" data-v="${k}">${t(label)}</button>`);
  return `<section class="admbox"><h2>${t('admTitle')}</h2>
    <label class="tname"><span>${t('admRename')}</span><span class="frform"><input id="adm-name" class="unin" value="${esc(p.username || '')}" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="chip" data-act="u-rename">${t('admSave')}</button></span></label>
    <div class="uacts">${p.banned ? `<button class="chip" data-act="u-unban">${t('admUnban')}</button>` : two('ban', 'admBan', 'admBanSure', 'u-ban')}${two('purge', 'admPurge', 'admPurgeSure', 'u-purge')}</div>
    <p class="shint err" id="adm-msg" role="alert">${esc(usr.msg)}</p></section>`;
}
function userHTML() {
  if (!auth.currentUser()) return `<div class="empty"><b>${t('uLoginNeed')}</b><div class="ctarow"><button class="chip accent" data-act="com-login">${IC.user}${t('comLoginAct')}</button></div></div>`;
  const p = usr.prof;
  if (!p) return `<div class="empty"><b>${t(usr.err ? 'comLoadFail' : 'uNotFound')}</b></div>`;
  return `<header class="uhero">${avatarImg(p.avatar, 'lg')}<h1>${esc(p.username || '?')}${p.banned ? ` <small class="modtag">(${t('admBanned')})</small>` : ''}</h1><p class="dim">${postsLabel(p.posts)}</p>
      <div class="uacts">${userActionsHTML()}</div></header>
    ${adminBoxHTML()}
    <section class="sec"><h2>${t('uTeams')}</h2>${userTeamsHTML()}</section>
    <section class="sec"><h2>${t('uPosts')} <small>${p.posts}</small></h2>
      ${usr.posts.length ? `<div class="cfeed">${usr.posts.map(postCardHTML).join('')}</div>` : `<p class="shint">${t('uNoPosts')}</p>`}
      ${usr.more ? `<div class="ctarow"><button class="chip" data-act="u-more">${t('uMore')}</button></div>` : ''}</section>`;
}
function paintUser() {
  const root = $('#user-root'); if (!root) return;
  const y = window.scrollY, nm = $('#adm-name')?.value;
  root.innerHTML = userHTML();
  const inp = $('#adm-name'); if (inp && nm != null && usr.msg) inp.value = nm;
  window.scrollTo(0, y);
}
const reloadProfile = async () => { try { usr.prof = await auth.communityProfile(usr.id); } catch { /* se queda como está */ } };
async function userAction(act, v) {
  const p = usr.prof; if (!p) return;
  const done = async (relation, msg) => {
    if (relation) p.relation = relation;
    if (relation === 'friend') usr.teams = await auth.loadTeamsOf(usr.id).catch(() => null);
    if (relation === 'none') usr.teams = null;
    usr.confirm = null; if (msg) toast(msg); paintUser();
  };
  try {
    if (act === 'u-add') { const code = await auth.sendFriendRequest(p.username); await done(code === 'sent' || code === 'pending' ? 'out' : code === 'accepted' || code === 'already' ? 'friend' : null, code === 'sent' ? t('fr_sent', { name: p.username }) : t(`fr_${code}`)); }
    else if (act === 'u-accept') { await auth.respondFriend(usr.id, true); await done('friend'); }
    else if (act === 'u-decline') { await auth.respondFriend(usr.id, false); await auth.removeFriend(usr.id).catch(() => {}); await done('none'); }
    else if (act === 'u-remove') { if (p.relation === 'friend' && usr.confirm !== 'rm') { usr.confirm = 'rm'; paintUser(); return; } await auth.removeFriend(usr.id); await done('none'); }
    else if (act === 'u-ban') { await auth.adminBan(usr.id); p.banned = true; await done(null, t('admDone')); }
    else if (act === 'u-unban') { await auth.adminUnban(usr.id); p.banned = false; await done(null, t('admDone')); }
    else if (act === 'u-purge') { await auth.adminPurge(usr.id); usr.posts = []; usr.more = false; p.posts = 0; com.items = com.items.filter(x => x.user_id !== usr.id); await done(null, t('admDone')); }
    else if (act === 'u-rename') {
      const name = $('#adm-name')?.value.trim() || '';
      try { await auth.adminSetUsername(usr.id, name); p.username = name; usr.msg = ''; await done(null, t('un_saved')); }
      catch (err) { const m = /username_(taken|banned|invalid)/.exec(String(err?.message || '')); usr.msg = t(m ? `un_${m[1]}` : 'un_error'); paintUser(); }
    }
  } catch { toast(t('syncFail')); paintUser(); }
}
// lista de baneados (solo administradores)
async function openBans() {
  usr.bans = null; showModal('bans');
  try { usr.bans = await auth.adminBans(); } catch { usr.bans = []; }
  if (modalKind === 'bans') refreshModal();
}
// ───────────────────────── Quién ha dado like (mantener pulsado el corazón) ─────────────────────────
const lk = { items: null, n: 0 };
const likersHTML = () => `<div class="scard" role="dialog" aria-modal="true" aria-label="${t('likersTitle')}">
  <div class="shead"><button class="iconbtn" data-act="settings-close" aria-label="${t('close')}">${IC.x}</button><h2>${t('likersTitle')}</h2></div>
  ${lk.items == null ? '<p class="shint">…</p>' : lk.items.length ? `<ul class="nlist">${lk.items.map(u => `<li><button class="nitem" data-act="lk-go" data-v="${u.user_id}">${avatarImg(u.avatar, 'sm')}<span class="ntx"><span><b>${esc(u.username || '?')}</b></span></span></button></li>`).join('')}</ul>` : `<p class="shint">${t('likersNone')}</p>`}</div>`;
async function openLikers(kind, id) {
  lk.items = null; showModal('likers');
  try { lk.items = await auth.likers(kind, id); } catch { lk.items = []; }
  if (modalKind === 'likers' && !smodal.hidden) refreshModal();
}
// pulsación larga sobre un corazón → lista de quién ha dado like
{
  let timer = 0, sx = 0, sy = 0, fired = 0;
  const sel = '[data-act="com-like"], [data-act="cm-like"]';
  const stop = () => { clearTimeout(timer); timer = 0; };
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest?.(sel); if (!el) return;
    sx = e.clientX; sy = e.clientY; stop();
    timer = setTimeout(() => { timer = 0; fired = Date.now(); if (navigator.vibrate) navigator.vibrate(12); openLikers(el.dataset.act === 'cm-like' ? 'c' : 'p', el.dataset.v); }, 480);
  });
  document.addEventListener('pointermove', e => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) stop(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => document.addEventListener(n, stop));
  document.addEventListener('contextmenu', e => { if (e.target.closest?.(sel)) e.preventDefault(); });
  // el click que llega al soltar tras una pulsación larga no debe dar/quitar el like
  document.addEventListener('click', e => { if (fired && Date.now() - fired < 900 && e.target.closest?.(sel)) { e.stopPropagation(); e.preventDefault(); fired = 0; } }, true);
}
const bansModalHTML = () => `<div class="scard" role="dialog" aria-modal="true" aria-label="${t('admBans')}">
  <div class="shead"><button class="iconbtn" data-act="settings-close" aria-label="${t('close')}">${IC.x}</button><h2>${t('admBans')}</h2></div>
  ${usr.bans == null ? '<p class="shint">…</p>' : usr.bans.length ? `<ul class="banlist">${usr.bans.map(b => `<li>${avatarImg(b.avatar, 'sm')}<a href="#/user/${b.user_id}" data-act="settings-close"><b>${esc(b.username || '?')}</b></a><button class="chip" data-act="adm-unban" data-v="${b.user_id}">${t('admUnban')}</button></li>`).join('')}</ul>` : `<p class="shint">${t('admNoBans')}</p>`}</div>`;

// ───────────────────────── Favoritos: 9 equipos ─────────────────────────
const teamsSel = { open: 0, rename: false };
const inTeams = () => state.view === 'teams' || state.view === 'team';
const loginCta = (title, action) => `<div class="empty"><b>${t(title)}</b>${t('loginText')}<div class="ctarow"><button class="chip accent" data-act="login-open" data-v="${action}">${IC.user}${t('loginGoogle')}</button></div></div>`;
function memberRow(p, slot, k) {
  const m = teams[slot]?.members[k];
  return `<div class="mrow">${rowCore(p, m?.b?.sh, pokeHref(p.id, m))}<button class="iconbtn ${m?.b ? 'on' : ''}" data-act="ed-open" data-v="${slot}:${k}" aria-label="${t('edTitle')}">${IC.pencil}</button><button class="iconbtn" data-act="team-remove" data-v="${p.id}" aria-label="${t('removePoke')}">${IC.trash}</button></div>`;
}
function slotHTML(i) {
  const tm = teams[i];
  const members = tm.members.map(m => BYID.get(m.id)).filter(Boolean);
  return `<button class="slot slothead" data-act="slot-go" data-v="${i}">
      ${members.length >= 3 ? (sc => `<span class="sn sc" style="--sc:${scoreInfo(sc).c}" title="${t('an_title')}">${sc}</span>`)(analyzeTeam(members).score) : `<span class="sn sc none" title="${t('an_title')}">-</span>`}
      <span class="sname"><b>${esc(teamName(i))}</b><span class="minis">${members.map((p, k) => pokeImg(p, 'small', 'mini', undefined, !!tm.members[k]?.b?.sh)).join('') || `<small>${t('teamEmpty')}</small>`}</span></span>
      <span class="scount">${members.length}/${MAXTEAM}</span></button>`;
}
function teamPageHTML(i) {
  const tm = teams[i];
  const members = tm.members.map(m => BYID.get(m.id)).filter(Boolean);
  const name = teamsSel.rename
    ? `<input class="tninput" id="tn" data-slot="${i}" value="${esc(tm.name)}" placeholder="${t('teamN', { n: i + 1 })}" maxlength="24" autocomplete="off" autocapitalize="sentences" aria-label="${t('teamName')}">`
    : `<h1>${esc(teamName(i))}</h1>`;
  return `<header class="thead"><div class="tnrow">${name}<button class="iconbtn" data-act="tn-edit" aria-label="${t('teamName')}">${teamsSel.rename ? IC.check : IC.pencil}</button></div>
      <span class="minis">${members.map((p, k) => pokeImg(p, 'small', 'mini', undefined, !!tm.members[k]?.b?.sh)).join('') || `<small>${t('teamEmpty')}</small>`}</span></header>
    <hr class="tdiv">
    ${members.length ? `<div class="list">${tm.members.map((m, k) => (BYID.get(m.id) ? memberRow(BYID.get(m.id), i, k) : '')).join('')}</div>` : `<p class="shint">${t('teamEmptyHint')}</p>`}
    <div class="slotacts">${members.length < MAXTEAM ? `<button class="chip" data-act="slot-add">${IC.plus}${t('addPoke')}</button>` : ''}${members.length ? `<button class="chip" data-act="team-share" data-v="${i}">${IC.share}${t('shareTeam')}</button><button class="chip" data-act="sd-open" data-v="export:${i}">${t('sdExport')}</button>` : ''}<button class="chip" data-act="sd-open" data-v="import:${i}">${t('sdImport')}</button></div>
    ${members.length ? teamHTML(members) : ''}`;
}
function teamsHTML() {
  if (!auth.currentUser()) return `<header class="hero"><h1 class="brand">${titleIc('dock-favs')}${t('teamsTitle')}</h1><p>${t('teamsLead')}</p></header>${loginCta('loginTitle', 'favs')}`;
  if (state.view === 'team') return teamPageHTML(teamsSel.open);
  return `<header class="hero"><h1 class="brand">${titleIc('dock-favs')}${t('teamsTitle')}</h1><p>${t('teamsLead')}</p></header><div class="slots">${teams.map((_, i) => slotHTML(i)).join('')}</div>`;
}
function paintTeams() {
  const root = $('#teams-root'); if (!root) return;
  const y = window.scrollY, had = document.activeElement?.id === 'tn';
  root.innerHTML = teamsHTML();
  if (had) { const n = $('#tn'); n?.focus({ preventScroll: true }); }
  window.scrollTo(0, y);
}
function renderShared(idStr, nameRaw) {
  state.view = 'shared';
  let name = ''; try { name = decodeURIComponent(nameRaw || '').slice(0, 24); } catch { /* nombre ilegible */ }
  const ids = [...new Set((idStr || '').split(',').filter(id => BYID.has(id)))].slice(0, MAXTEAM);
  bt.link = { name: name || t('sharedOwner'), custom: !!name, members: ids.map(id => ({ id })) };
  document.title = `${bt.link.name} · PokeScanner`;
  document.documentElement.style.removeProperty('--accent');
  const ps = ids.map(id => BYID.get(id));
  $app.innerHTML = topbarHTML() + (ps.length
    ? `<header class="hero"><h1>${esc(bt.link.name)}</h1><p>${t('sharedLead')}</p></header>
      <div class="sharedacts"><button class="chip accent" data-act="shared-save">${IC.star}${t('sharedSave')}</button><button class="chip" data-act="shared-compare">${IC.battle}${t('sharedCompare')}</button><button class="chip" data-act="shared-share">${IC.share}${t('shareTeam')}</button></div>
      <div class="list">${ps.map(rowCore).join('')}</div>${ps.length >= 3 ? teamHTML(ps, true) : ''}`
    : `<div class="empty"><b>${t('sharedEmpty')}</b></div>`);
  window.scrollTo(0, 0);
  updateDock();
}
function renderTeamPage(n) {
  state.view = 'team'; teamsSel.open = Math.min(Math.max(Number(n) || 0, 0), SLOTS - 1); teamsSel.rename = false;
  document.title = `${teamName(teamsSel.open)} · PokeScanner`;
  document.documentElement.style.removeProperty('--accent');
  $app.innerHTML = topbarHTML() + '<div id="teams-root"></div>';
  paintTeams();
  window.scrollTo(0, 0);
  updateDock();
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
const bt = { friends: [], online: new Map(), others: new Map(), a: { owner: 'me', slot: 0 }, b: { owner: 'me', slot: 1 }, res: null, busy: false, msg: '', live: false, menu: null, mode: 'singles', prog: null, planSide: 'A' };
const friendById = id => bt.friends.find(f => f.user_id === id);
const frAvatar = f => avatarImg(f.avatar);
// equipos de ejemplo (meta): se usan con la build de su formato (OU en Individual, VGC en Dobles)
const metaTeam = i => { const m = META_TEAMS[i]; return m ? { name: m.name[lang()] || m.name.es, members: m.members, fmt: m.fmt, num: META_TEAMS.slice(0, i + 1).filter(x => x.fmt === m.fmt).length, force: m.fmt === 'doubles' ? 'vgc2025' : 'ou' } : null; };
const isFriendOwner = o => o !== 'me' && o !== 'meta' && o !== 'link';
const teamOf = sel => (sel.owner === 'me' ? teams[sel.slot] : sel.owner === 'meta' ? metaTeam(sel.slot) : sel.owner === 'link' ? bt.link || null : bt.others.get(sel.owner)?.[sel.slot] || null);
const ownerName = sel => (sel.owner === 'me' ? t('yourTeam') : sel.owner === 'meta' ? t('metaOwner') : sel.owner === 'link' ? t('sharedOwner') : t('teamOf', { name: friendById(sel.owner)?.username || '?' }));
const sideName = sel => { const tm = teamOf(sel), nm = esc(tm?.name || t('teamN', { n: sel.slot + 1 })); return !isFriendOwner(sel.owner) ? nm : `${nm} (${esc(friendById(sel.owner)?.username || '?')})`; };

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
  if (isFriendOwner(bt.b.owner) && !ids.has(bt.b.owner)) bt.b = { owner: 'me', slot: bt.b.slot };
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
/** Lista de equipos elegibles (los tuyos y los de tus amigos), con el diseño de la web en vez del desplegable del navegador */
function teamMenuHTML(side) {
  const sel = bt[side], val = `${sel.owner}:${sel.slot}`;
  const opt = (owner, i, tm) => {
    const ps = tm.members.map(m => BYID.get(m.id)).filter(Boolean), on = val === `${owner}:${i}`;
    return `<button class="topt ${on ? 'on' : ''}" role="option" aria-selected="${on}" data-act="team-pick" data-side="${side}" data-v="${owner}:${i}" ${ps.length ? '' : 'disabled'}>
      <span class="sn">${tm.num ?? i + 1}</span>
      <span class="tn2"><b>${esc(tm.name || t('teamN', { n: i + 1 }))}</b><span class="minis">${ps.map(p => pokeImg(p, 'small', 'mini')).join('') || `<small>${t('teamEmpty')}</small>`}</span></span>
      <span class="tck">${on ? IC.check : `<small>${tm.fmt ? t(tm.fmt === 'doubles' ? 'bt_double' : 'bt_single') : `${tm.members.length}/${MAXTEAM}`}</small>`}</span></button>`;
  };
  const groups = [`<div class="tgrp">${t('mineGroup')}</div>${teams.map((tm, i) => opt('me', i, tm)).join('')}`];
  bt.friends.filter(f => f.direction === 'friend').forEach(f => {
    const list = (bt.others.get(f.user_id) || []).map((tm, i) => [tm, i]).filter(([tm]) => tm.members.length);
    if (list.length) groups.push(`<div class="tgrp">${esc(t('friendGroup', { name: f.username }))}</div>${list.map(([tm, i]) => opt(f.user_id, i, tm)).join('')}`);
  });
  if (bt.link?.members.length) groups.push(`<div class="tgrp">${t('sharedOwner')}</div>${opt('link', 0, bt.link)}`);
  [['singles', 'metaGroupS'], ['doubles', 'metaGroupD']].forEach(([fmt, key]) => {
    const rows = META_TEAMS.map((_, i) => [metaTeam(i), i]).filter(([m]) => m.fmt === fmt);
    groups.push(`<div class="tgrp">${t(key)}</div>${rows.map(([m, i]) => opt('meta', i, m)).join('')}`);
  });
  return `<div class="tmenu ${side}" role="listbox" aria-label="${t(side === 'a' ? 'yourTeam' : 'rivalTeam')}">${groups.join('')}</div>`;
}
const sidePreview = (sel, cls) => {
  const tm = teamOf(sel);
  const ps = (tm?.members || []).map(m => BYID.get(m.id)).filter(Boolean);
  const open = bt.menu === cls;
  return `<button class="side ${cls} ${open ? 'open' : ''}" data-act="team-menu" data-v="${cls}" aria-haspopup="listbox" aria-expanded="${open}" aria-label="${t(cls === 'a' ? 'yourTeam' : 'rivalTeam')}">
    <small>${ownerName(sel)}</small><b>${esc(tm?.name || t('teamN', { n: sel.slot + 1 }))}</b><span class="minis">${ps.map(p => pokeImg(p, 'small', 'mini')).join('') || `<small>${t('teamEmpty')}</small>`}</span><i class="sdd">${I.chev}</i></button>`;
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
  const head = `<header class="hero"><h1 class="brand">${titleIc('dock-battle')}${t('battleTitle')}</h1><p>${t('battleLead')}</p></header>`;
  if (!auth.currentUser()) return head + loginCta('loginTitle', 'battle');
  const inc = bt.friends.filter(f => f.direction === 'in'), fr = bt.friends.filter(f => f.direction === 'friend'), out = bt.friends.filter(f => f.direction === 'out');
  const friendsSec = `<section class="sec"><div class="block-title"><h2>${t('friends')}</h2></div>
    <div class="frform"><input id="fr-name" class="unin" placeholder="${t('friendAddPh')}" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="chip accent" data-act="friend-add">${IC.userPlus}${t('friendAdd')}</button></div>
    ${bt.msg ? `<small class="unmsg">${esc(bt.msg)}</small>` : ''}
    <div class="frlist">${[...inc, ...fr, ...out].map(friendRow).join('') || `<p class="shint">${t('friendNone')}</p>`}</div></section>`;
  const compare = `<section class="sec"><div class="block-title"><h2>${t('compareTitle')}</h2>${bt.res && isFriendOwner(bt.b.owner) ? `<span class="livebadge"><i></i>${t('live')}</span>` : ''}</div>
    <div class="vswrap"><div class="vsgrid">${sidePreview(bt.a, 'a')}<span class="vs" aria-hidden="true"><b>${t('vs')}</b></span>${sidePreview(bt.b, 'b')}</div>${bt.menu ? teamMenuHTML(bt.menu) : ''}${['a', 'b'].filter(sd => bt[sd].owner !== 'me' && teamOf(bt[sd])?.members.length).map(sd => `<button class="chip small sidesave" data-act="save-side" data-v="${sd}">${IC.star}${t('saveSide', { name: esc(teamOf(bt[sd]).name || t('teamN', { n: bt[sd].slot + 1 })) })}</button>`).join('')}</div>
    <div class="modetabs" role="tablist">${['singles', 'doubles'].map(m => `<button role="tab" data-act="bt-mode" data-v="${m}" aria-selected="${bt.mode === m}" ${bt.busy ? 'disabled' : ''}>${t(m === 'singles' ? 'bt_single' : 'bt_double')}</button>`).join('')}</div>
    <p class="shint modehint">${t(bt.mode === 'singles' ? 'bt_modeHint_single' : 'bt_modeHint_double')}</p>
    <button class="gbtn comparebtn" data-act="compare" ${bt.busy ? 'disabled' : ''}>${IC.battle}${t(bt.busy ? 'comparing' : 'compareBtn')}</button>
    ${bt.busy ? `<div class="progbox" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div class="progtop"><span id="pg-l">${t(`pg_${bt.prog?.label || 'load'}`)}</span><b id="pg-n">${Math.round((bt.prog?.f || 0) * 100)}%</b></div><div class="progbar"><i id="pg-i" style="width:${Math.round((bt.prog?.f || 0) * 100)}%"></i></div></div>` : ''}
    ${bt.cmpMsg ? `<small class="unmsg">${esc(bt.cmpMsg)}</small>` : ''}</section>`;
  return head + friendsSec + compare + (bt.res?.[bt.mode] && !bt.busy ? resultHTML() : '');
}
function paintBattle() {
  const root = $('#battle-root'); if (!root) return;
  const y = window.scrollY, typed = $('#fr-name')?.value || '', focus = document.activeElement?.id === 'fr-name';
  root.innerHTML = battleHTML();
  const inp = $('#fr-name'); if (inp && typed) { inp.value = typed; if (focus) inp.focus(); }
  window.scrollTo(0, y);
}
let ENG = null;
const getEngine = () => (ENG ??= (async () => {
  const [X, S, D] = await Promise.all([import('./calcx.js'), import('./singles.js'), import('./doubles.js')]);
  await X.initCalc();
  return { X, S, D };
})().catch(e => { ENG = null; throw e; }));
let LMAP = null;
const learnableOf = p => {
  if (!LMAP) {
    LMAP = new Map();
    const pos = new Map(INDEX.map((q, i) => [q.id, i]));
    const rev = new Map();
    for (const [mv, o] of Object.entries(LEARNERS)) for (const i of o.l) { if (!rev.has(i)) rev.set(i, []); rev.get(i).push(mv); }
    LMAP.pos = pos; LMAP.rev = rev;
  }
  return LMAP.rev.get(LMAP.pos.get(p.id)) || [];
};
function paintProgress() {
  const p = bt.prog, bar = $('#pg-i');
  if (!p || !bar) return;
  const pc = Math.max(1, Math.min(100, Math.round(p.f * 100)));
  bar.style.width = `${pc}%`; $('#pg-n').textContent = `${pc}%`; $('#pg-l').textContent = t(`pg_${p.label}`);
  $('.progbox')?.setAttribute('aria-valuenow', pc);
}
const SWAP_TIERS = new Set(['OU', 'UUBL', 'UU', 'RUBL', 'RU']);
/** Cambios legales (de OU a RU) que mejor rinden contra el equipo rival, calculados con el propio motor */
async function suggestSwaps(own, foe, mode, eng, dict) {
  if (own.length < 3) return null;
  const score = u => {
    if (mode === 'doubles') return eng.D.pairScore ? foe.reduce((n, f) => n + eng.D.pairScore(u, f), 0) / foe.length : 0;
    return foe.reduce((n, f) => n + eng.S.duelSym(u, eng.X.newState(u), f, eng.X.newState(f), { enterA: true, enterB: true }).margin, 0) / foe.length;
  };
  const base = own.map(score);
  const wi = base.indexOf(Math.min(...base));
  const rest = own.filter((_, i) => i !== wi);
  const weakTypes = ty => rest.filter(u => eng.X.eff(ty, u.types) >= 2).length;
  const haveNum = new Set(own.map(u => u.p.num));
  const pool = INDEX.filter(p => !p.g && SWAP_TIERS.has(p.r) && p.ns > 0 && !haveNum.has(p.num));
  const full = await Promise.all(pool.map(p => getPokemon(p.id)));
  const out = [];
  for (let k = 0; k < pool.length; k++) {
    let u; try { u = eng.X.makeUnit(full[k], {}, dict, mode, { learnable: learnableOf, pname }); } catch { continue; }
    let sc = score(u);
    // no se recomienda uno que deje al equipo con tres debilidades al mismo tipo
    for (const ty of TYPES) if (weakTypes(ty) >= 2 && eng.X.eff(ty, u.types) >= 2) sc -= 0.25;
    out.push({ p: pool[k], sc, wins: foe.filter(f => eng.S.duelSym(u, eng.X.newState(u), f, eng.X.newState(f), { enterA: true, enterB: true }).margin > 0.001).length });
    if (k % 25 === 0) await eng.S.tick();
  }
  out.sort((a, b) => b.sc - a.sc);
  const picks = out.filter(o => o.sc > base[wi] + 0.15).slice(0, 3);
  return { replace: own[wi], base: base[wi], picks, n: foe.length };
}
async function runCompare() {
  const A = teamOf(bt.a), B = teamOf(bt.b), mode = bt.mode;
  bt.cmpMsg = '';
  if (!A?.members.length || !B?.members.length) { bt.cmpMsg = t('compareEmpty'); paintBattle(); return; }
  if (mode === 'doubles' && (A.members.length < 2 || B.members.length < 2)) { bt.cmpMsg = t('dblNeed'); paintBattle(); return; }
  bt.busy = true; bt.prog = { f: 0.01, label: 'load' }; paintBattle();
  const names = { aName: sideName(bt.a), bName: sideName(bt.b), aMine: bt.a.owner === 'me', bMine: bt.b.owner === 'me' };
  try {
    const [dict] = await Promise.all([getDict(), getLearners()]);
    if ([...A.members, ...B.members].some(m => m.b)) mergeEditor(dict, await getEditor());
    let out;
    try {
      const eng = await getEngine();
      const load = (ms, force) => Promise.all(ms.map(async m => {
        const p = await getPokemon(m.id); let mm = m;
        if (force) { const i = p.sets?.findIndex(x => x.f === force) ?? -1; if (i >= 0) mm = { ...m, s: i }; } // equipos de ejemplo: la build de su formato
        return eng.X.makeUnit(p, mm, dict, mode, { learnable: learnableOf, pname });
      }));
      const [ua, ub] = await Promise.all([load(A.members, A.force), load(B.members, B.force)]);
      eng.X.clearMemo(); eng.S.clearDuelMemo();
      const onProgress = (f, label) => { bt.prog = { f: Math.min(0.97, f), label }; paintProgress(); };
      const comp = mode === 'doubles' ? await eng.D.compareDoubles(ua, ub, { onProgress, budgetMs: 22000 }) : await eng.S.compareSingles(ua, ub, { onProgress, budgetMs: 22000, dict });
      const r = mode === 'doubles' ? eng.D.analyzeDoubles(ua, ub, comp) : eng.S.analyzeSingles(ua, ub, comp);
      onProgress(0.95, 'swaps');
      let swaps = { A: null, B: null };
      try { swaps = { A: await suggestSwaps(ua, ub, mode, eng, dict), B: await suggestSwaps(ub, ua, mode, eng, dict) }; } catch (e) { console.warn('swaps', e); }
      out = { r, ua, ub, swaps, ...names };
    } catch (e) {
      // si la calculadora no carga, se usa el comparador sencillo
      console.error(e);
      if (mode === 'doubles') throw e;
      const load = ms => Promise.all(ms.map(async m => buildUnit(await getPokemon(m.id), m, dict)));
      const [ua, ub] = await Promise.all([load(A.members), load(B.members)]);
      out = { r: compareTeams(ua, ub), ua, ub, swaps: { A: null, B: null }, ...names };
    }
    bt.res = { ...(bt.res || {}), [mode]: out };
  } catch (e) { console.error(e); bt.cmpMsg = t('loadFail'); }
  bt.busy = false; bt.prog = null;
  if (state.view === 'battle') paintBattle();
}

// ───── resultado ─────
const fmtVars = v => Object.fromEntries(Object.entries(v || {}).map(([k, x]) => [k, k === 'type' ? typeName(x) : k === 'name' ? (typeof x === 'string' ? esc(x) : esc(pname(x))) : k === 'list' ? x.map(p => (typeof p === 'string' ? esc(p) : esc(pname(p)))).join(', ') : x]));
// solo se recomiendan Pokémon legales en los formatos normales: nada de Ubers ni de Pokémon que solo se usan en juego libre (AG)
const legalPick = p => !p.g && tierNum(p.r) >= 3;
const resistSuggestions = type => INDEX.filter(p => legalPick(p) && strength(p) <= 6 && eff(type, p.t) < 1).sort((a, b) => strength(a) - strength(b) || bst(b.s) - bst(a.s)).slice(0, 4);
function tipHTML(tp) {
  const sug = tp.resist ? resistSuggestions(tp.resist) : (tp.ids || []).map(id => BYID.get(id)).filter(p => p && legalPick(p)).slice(0, 4);
  return `<li>${t(`tp_${tp.key}`, fmtVars(tp.vars))}${sug.length ? `<div class="sugs"><small>${t('tpSuggest')}</small>${sug.map(chipPoke).join('')}</div>` : ''}</li>`;
}
const cellColor = s => (s > 0 ? `color-mix(in srgb, #2FAE5F ${Math.round(18 + Math.abs(s) * 72)}%, var(--surface))` : s < 0 ? `color-mix(in srgb, #E5484D ${Math.round(18 + Math.abs(s) * 72)}%, var(--surface))` : 'var(--soft)');
// ───── plan de juego ─────
const uChip = u => chipPoke(u.p, u.mem);
const mvLabel = m => esc(m ? (lang() === 'es' ? m.es || m.name : m.name) : '');
const hitsText = x => (x.ohko || x.hits <= 1 ? t('pl_ohko') : t('pl_hko', { n: x.hits }));
const pctText = x => `${Math.min(100, x.pct)}%`;
function actionText(a, Mine, Foe) {
  const name = `<b>${esc(pname(Mine[a.mine].p))}</b>`, mv = a.move ? `<b>${mvLabel(a.move)}</b>` : '';
  const tg = a.target != null && Foe[a.target] ? `<b>${esc(pname(Foe[a.target].p))}</b>` : '';
  const k = { atk: a.spread ? 'act_spread' : 'act_atk', protect: 'act_protect', help: 'act_help', redirect: 'act_redirect', speed: 'act_speed', trick: 'act_trick', wide: 'act_wide', setup: 'act_setup', recover: 'act_recover', status: 'act_status', screen: 'act_screen', pass: 'act_pass' }[a.type] || 'act_pass';
  return t(k, { name, move: mv, target: tg });
}
function focusHTML(plan, Mine, Foe, only) {
  const rows = plan.focus.filter(f => !only || only.includes(f.mine)).map(f => {
    const u = Mine[f.mine];
    const tg = f.targets.map(x => `<li>${uChip(Foe[x.foe])}<span><b>${mvLabel(x.move)}</b> <small>${pctText(x)} · ${hitsText(x)}</small></span></li>`).join('');
    const none = f.useless.length ? `<p class="shint">${t('pl_nothing', { list: f.useless.slice(0, 3).map(j => esc(pname(Foe[j].p))).join(', ') })}</p>` : '';
    return `<div class="pfoc"><div class="pfh">${uChip(u)}${f.main ? `<span class="mvp" style="--tc:${TYPE_COLOR[f.main.t]}">${typeIcon(f.main.t)}${mvLabel(f.main)}</span>` : ''}</div>${tg ? `<ul class="pans">${tg}</ul>` : ''}${none}</div>`;
  }).join('');
  return rows;
}
function planHTML(res, side) {
  const { r, ua, ub, aName, bName } = res;
  if (!r.plan) return '';
  const mine = side === 'A' ? ua : ub, foe = side === 'A' ? ub : ua, plan = r.plan[side], name = side === 'A' ? aName : bName, foeName = side === 'A' ? bName : aName;
  const tabs = `<div class="modetabs small" role="tablist">${['A', 'B'].map(sd => `<button role="tab" data-act="bt-plan" data-v="${sd}" aria-selected="${side === sd}">${sd === 'A' ? aName : bName}</button>`).join('')}</div>`;
  let body = '';
  const sec = (title, inner, hint = '') => (inner ? `<div class="psec">${title ? `<h4>${title}</h4>` : ''}${inner}${hint ? `<p class="shint">${hint}</p>` : ''}</div>` : '');
  if (r.mode === 'doubles') {
    const pairs = plan.leads.map((l, k) => `<div class="pairrow ${k ? 'alt' : 'main'}"><span class="pairlab">${k ? t('pl_leadAlt') : t('pl_lead')}</span><span class="pairchips">${l.i.map(i => uChip(mine[i])).join('<span class="plus">+</span>')}</span></div>`).join('');
    body = sec(t('pl_bring'), `<div class="chipline">${plan.bring.map(i => uChip(mine[i])).join('')}</div>`, t('pl_bringHint'))
      + sec('', pairs)
      + sec(t('pl_t1'), plan.turn1.length ? `<ul class="acts">${plan.turn1.map(a => `<li>${actionText(a, mine, foe)}</li>`).join('')}</ul>` : '')
      + sec(t('pl_foeLead'), plan.foeLeads.slice(0, 2).map(l => `<div class="pairrow"><span class="pairchips">${l.j.map(j => uChip(foe[j])).join('<span class="plus">+</span>')}</span></div>`).join(''))
      + sec(t('pl_focus'), `<div class="focuslist">${focusHTML(plan, mine, foe, plan.bring)}</div>`);
  } else {
    const leads = plan.leads.map((l, k) => `<div class="pairrow ${k ? 'alt' : 'main'}"><span class="pairlab">${k ? t('pl_leadAlt') : t('pl_lead')}</span><span class="pairchips">${uChip(mine[l.i])}</span></div>`).join('');
    const ans = plan.answers.map(x => `<li>${uChip(foe[x.foe])}<span class="arrow">→</span>${uChip(mine[x.mine])}<span>${x.move ? `<b>${mvLabel(x.move)}</b> <small>${pctText(x)} · ${hitsText(x)}</small>` : ''}</span></li>`).join('');
    body = sec('', leads)
      + sec(t('pl_foeLead'), plan.foeLeads.length ? `<div class="chipline">${plan.foeLeads.map(l => uChip(foe[l.j])).join('')}</div>` : '')
      + sec(t('pl_answers'), `<ul class="pans">${ans}</ul>`)
      + sec(t('pl_focus'), `<div class="focuslist">${focusHTML(plan, mine, foe)}</div>`);
  }
  return `<div class="block-title"><h2>${t('planTitle')}</h2></div><div class="plan">${tabs}<p class="shint">${t('planHint')}</p>${body}</div>`;
}
const swapHTML = (sw, side) => {
  if (!sw) return '';
  if (!sw.picks.length) return `<p class="shint">${t('swapNone')}</p>`;
  return `<div class="swap"><h4>${t('swapTitle')}</h4><p>${t('swapText', { name: `<b>${esc(pname(sw.replace.p))}</b>` })}</p><ul class="pans">${sw.picks.map(x => `<li>${chipPoke(x.p)}<small>${t('swapGain', { k: x.wins, n: sw.n })}</small></li>`).join('')}</ul></div>`;
};
function resultHTML() {
  const { r, ua, ub, aName, bName, swaps } = bt.res[bt.mode];
  const pa = Math.round(r.pA * 100), pb = 100 - pa;
  const winName = r.win === 'A' ? aName : bName;
  // cada razón dice de qué equipo habla (pastilla con su nombre) y los Pokémon salen con su sprite, enlazados a su ficha
  const teamTag = n => `<span class="chip small teamtag">${n}</span>`;
  const reasonVars = (v, team, foe) => { const { name, ...rest } = v || {}; const o = fmtVars(rest); if (name) o.name = typeof name === 'string' ? `<b>${esc(name)}</b>` : chipPoke(name); o.team = teamTag(team); o.foe = teamTag(foe); return o; };
  const reasonList = (list, team, foe) => (list.length ? `<ol class="reasons">${list.map(x => `<li><div class="rt">${t(`br_${x.key}${x.key === 'hazards' && !x.vars.noRemoval ? '_b' : ''}`, reasonVars(x.vars, team, foe))}</div></li>`).join('')}</ol>` : `<p class="shint">${t('noReasons')}</p>`);
  const [reasA, reasB] = r.win === 'A' ? [r.reasons, r.reasonsOther || []] : [r.reasonsOther || [], r.reasons];
  // si está igualado no hay ganador: se enseña lo que aporta cada equipo
  const why = r.close
    ? `<div class="block-title"><h2>${t('whyEven')}</h2></div><div class="evenwhy"><h3>${t('strengthsOf', { name: aName })}</h3>${reasonList(reasA, aName, bName)}<h3>${t('strengthsOf', { name: bName })}</h3>${reasonList(reasB, bName, aName)}</div>`
    : `<div class="block-title"><h2>${t('whyFor', { name: winName })}</h2></div>${reasonList(r.reasons, winName, r.win === 'A' ? bName : aName)}`;
  const tipBlock = (name, tips, side) => `<div class="tipbox"><h3>${t('tipsTitle', { name })}</h3>${tips.length ? `<ul class="tips">${tips.map(tipHTML).join('')}</ul>` : `<p class="shint">${t('tipsNone')}</p>`}${swapHTML(swaps?.[side], side)}</div>`;
  const loserTips = r.win === 'A' ? tipBlock(bName, r.tipsB, 'B') : tipBlock(aName, r.tipsA, 'A');
  const winnerTips = r.close ? (r.win === 'A' ? tipBlock(aName, r.tipsA, 'A') : tipBlock(bName, r.tipsB, 'B')) : '';
  const matrix = `<div class="mxwrap"><table class="mx"><thead><tr><th></th>${ub.map(u => `<th><a href="#/pokemon/${u.p.id}" aria-label="${esc(pname(u.p))}">${pokeImg(u.p, 'small', 'mini')}</a></th>`).join('')}</tr></thead><tbody>${ua.map((a, i) => `<tr><th><a href="#/pokemon/${a.p.id}" aria-label="${esc(pname(a.p))}">${pokeImg(a.p, 'small', 'mini')}</a></th>${ub.map((b, j) => {
    const s = r.matrix[i][j].s;
    return `<td style="background:${cellColor(s)}" title="${esc(pname(a.p))} ${s > 0 ? '>' : s < 0 ? '<' : '='} ${esc(pname(b.p))}">${s > 0.001 ? '✓' : s < -0.001 ? '✕' : '–'}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table></div>`;
  const maxSpe = Math.max(...r.speeds.map(x => x.u.spe));
  const speed = r.speeds.map(x => `<div class="spd ${x.side}"><span class="sp">${pokeImg(x.u.p, 'small', 'mini')}</span><span class="n">${esc(pname(x.u.p))}</span><div class="bar"><i style="--w:${(x.u.spe / maxSpe * 100).toFixed(1)}%"></i></div><b>${x.u.spe}</b></div>`).join('');
  const star = (rows, label) => {
    const sorted = [...rows].sort((p, q) => q.score - p.score);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    return `<div class="stars"><b>${label}</b><div class="starrow"><span class="stag good">${t('mvp')}</span>${uChip(best.u)}</div>${rows.length > 1 ? `<div class="starrow"><span class="stag bad">${t('weakestLink')}</span>${chipPoke(worst.u.p)}</div>` : ''}</div>`;
  };
  const est = [...ua, ...ub].filter(u => u.estimated);
  const f = r.factors;
  const FACT = [['duels', f.duels], ['speed', f.speed], ['hazards', f.hazards], ['support', f.support]];
  const fmax = Math.max(0.6, ...FACT.map(([, v]) => Math.abs(v)));
  const factors = FACT.map(([k, v]) => `<div class="fact"><span>${t(`${r.mode === 'doubles' ? 'fd' : 'f'}_${k}`)}</span><div class="fbar"><i class="${v >= 0 ? 'a' : 'b'}" style="width:${(Math.abs(v) / fmax * 50).toFixed(1)}%;${v >= 0 ? 'right:50%' : 'left:50%'}"></i></div></div>`).join('');
  return `<section class="sec result">
    <div class="block-title"><h2>${t('resultTitle')}</h2></div>
    <div class="resbox"><div class="vsnames"><span class="na">${aName}</span><span class="nb">${bName}</span></div>
      <div class="vsbar" role="img" aria-label="${pa}% / ${pb}%"><i class="va" style="width:${pa}%"><b>${pa}%</b></i><i class="vb"><b>${pb}%</b></i></div>
      <h3 class="winline">${r.close ? t('resEven') : t('resWin', { name: winName })}</h3></div>
    ${why}
    ${planHTML(bt.res[bt.mode], bt.planSide)}
    <div class="block-title"><h2>${t('improveTitle')}</h2></div>${loserTips}${winnerTips}
    <div class="block-title"><h2>${t(r.mode === 'doubles' ? 'extraMatrixD' : 'extraMatrix')}</h2></div><p class="shint">${t(r.mode === 'doubles' ? 'extraMatrixHintD' : 'extraMatrixHint')}</p>${matrix}
    <div class="block-title"><h2>${t('extraStars')}</h2></div><div class="starsgrid">${star(r.rowA, aName)}${star(r.rowB, bName)}</div>
    <div class="block-title"><h2>${t('extraSpeed')}</h2></div><div class="spdlist">${speed}</div>
    <div class="block-title"><h2>${t('extraFactors')}</h2></div><div class="factbox"><div class="factors">${factors}</div><p class="shint facthint"><span>← ${aName}</span><span>${bName} →</span></p></div>
    ${est.length ? `<p class="shint">${t('estNote', { list: est.map(u => esc(pname(u.p))).join(', ') })}</p>` : ''}
    <p class="note">${r.trials ? t('resNote2', { n: r.trials.toLocaleString(lang()) }) : t('resNote')}</p></section>`;
}

// ───────────────────────── Eventos ─────────────────────────
document.addEventListener('input', e => {
  const id = e.target.id;
  if (ed && e.target.classList?.contains('edr')) { onEditorInput(e); return; }
  if (id === 'ed-q' && ed) { ed.q = e.target.value; const l = $('.edlist'); if (l) { const tmp = document.createElement('div'); tmp.innerHTML = editorPickHTML(); l.innerHTML = tmp.querySelector('.edlist').innerHTML; } return; }
  if (id === 'pk-q') { const l = $('.pklist'); if (l) l.innerHTML = pickerListHTML(e.target.value); return; }
  if (id === 'un') { onUsernameInput(e.target); return; }
  if (id === 'tn') {
    const i = Number(e.target.dataset.slot);
    teams[i].name = e.target.value.slice(0, 24); saveSlot(i);
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
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'tn') { e.preventDefault(); teamsSel.rename = false; paintTeams(); document.title = `${teamName(teamsSel.open)} · PokeScanner`; } });
// el menú de equipos se cierra al pulsar fuera o con Escape
document.addEventListener('pointerdown', e => { if (bt.menu && !e.target.closest('.tmenu, [data-act="team-menu"]')) { bt.menu = null; paintBattle(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && bt.menu) { bt.menu = null; paintBattle(); } });
document.addEventListener('change', e => { if (ed && e.target.classList?.contains('edr')) persistEditor(); });
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const v = el.dataset.v;
  switch (el.dataset.act) {
    case 'ed-open': { const [a, b] = v.split(':').map(Number); openEditor(a, b); break; }
    case 'ed-pick': ed.pick = v; ed.q = ''; paintEditor(false); break;
    case 'ed-back': ed.pick = null; paintEditor(false); break;
    case 'ed-set': {
      const { pick, cur } = ed;
      if (v === '-' && !el.dataset.ok) { askConfirm(t('cfmMove'), t('cfmRemove'), () => { el.dataset.ok = '1'; el.click(); }); break; }
      if (pick === 'ability') cur.a = v; else if (pick === 'nature') cur.n = v; else if (pick === 'item') cur.i = v;
      else { const s = Number(pick.slice(1)); if (v === '-') cur.m.splice(s, 1); else if (cur.m.length > s) cur.m[s] = v; else cur.m.push(v); }
      ed.pick = null; persistEditor(); paintEditor(false); break;
    }
    case 'ed-shiny': ed.cur.sh = !ed.cur.sh; persistEditor(); paintEditor(); break;
    case 'ed-opt': askConfirm(t('cfmReset'), t('cfmResetBtn'), () => { const keep = ed.cur.sh; ed.cur = { ...currentBuild(ed.base, null), sh: keep }; persistEditor(); paintEditor(); toast(t('edReset')); }); break;
    case 'team-menu': bt.menu = bt.menu === v ? null : v; paintBattle(); if (bt.menu) $('.tmenu')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
    case 'team-pick': { const k = v.lastIndexOf(':'), side = el.dataset.side; bt[side] = { owner: v.slice(0, k), slot: Number(v.slice(k + 1)) }; { const mt = bt[side].owner === 'meta' ? metaTeam(bt[side].slot) : null; if (mt) bt.mode = mt.fmt; } bt.menu = null; bt.res = null; bt.cmpMsg = ''; paintBattle(); break; }
    case 'settings': { const p = el.parentElement.querySelector('.spanel'), open = p.hidden; closeSettings(); p.hidden = !open; el.setAttribute('aria-expanded', String(open)); break; }
    case 'sdd': sdd = sdd === v ? null : v; refreshModal(); break;
    case 'set-theme': sdd = null; setTheme(v); break;
    case 'set-lang': sdd = null; if (v === lang()) refreshModal(); else switchLang(v); break;
    case 'filters-toggle': state.filtersOpen = !state.filtersOpen; syncFilters(); break;
    case 'close': closeSheet(); break;
    case 'back': backFlag = true; if (navIdx > 0) history.back(); else if (location.hash === '#/' || !location.hash) route(); else location.hash = '#/'; break;
    case 'pf-toggle': pf.open = !pf.open; repaintKeep(); break;
    case 'pf-clear': { const o = pf.open; pf = pfNew(); pf.open = o; pageExpand = new Set(); repaintKeep(); break; }
    case 'pf-type': pf.types = pf.types.includes(v) ? pf.types.filter(x => x !== v) : [...pf.types, v]; pageExpand = new Set(); repaintKeep(); break;
    case 'pf-gen': { const g = Number(v); pf.gens = pf.gens.includes(g) ? pf.gens.filter(x => x !== g) : [...pf.gens, g]; pageExpand = new Set(); repaintKeep(); break; }
    case 'pf-dd': pf.dd = pf.dd === v ? null : v; repaintKeep(); break;
    case 'pf-gen9': pf.gen9 = !pf.gen9; pageExpand = new Set(); repaintKeep(); break;
    case 'pf-sort': if (pf.sort === v) pf.dir = -pf.dir; else { pf.sort = v; pf.dir = v === 'num' ? 1 : -1; } pf.dd = null; pageExpand = new Set(); repaintKeep(); break;
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
    case 'go-types': location.hash = '#/types'; break;
    case 'sd-open': { const [m, n] = v.split(':'); openShowdown(m, Number(n)); break; }
    case 'sd-copy': copyText($('#sd-text')?.value || sd.text); break;
    case 'sd-run': runShowdownImport(); break;
    case 'off-download': offlineDownload(); break;
    case 'off-clear': askConfirm(t('cfmOffline'), t('cfmRemove'), offlineClear); break;
    case 'off-install': { const pr = off.prompt; off.prompt = null; pr?.prompt?.(); refreshModal(); break; }
    case 'com-ftoggle': com.fopen = !com.fopen; paintCom(); break;
    case 'com-type': com.types = com.types.includes(v) ? com.types.filter(x => x !== v) : [...com.types, v]; com.auto = 0; paintCom(); if (com.more && comVisible().length < 6) loadFeed(false); break;
    case 'com-score': com.minScore = Number(v); com.auto = 0; paintCom(); if (com.more && comVisible().length < 6) loadFeed(false); break;
    case 'com-fclear': com.types = []; com.minScore = 0; if (com.pokes.length) { com.pokes = []; loadFeed(true); } else paintCom(); break;
    case 'go-calc': location.hash = '#/calc'; break;
    case 'calc-pick': calcOpenPick(v); break;
    case 'calc-edit': calcEdit(v); break;
    case 'calc-swap': [calc.a, calc.d] = [calc.d, calc.a]; [calc.boosts.a, calc.boosts.d] = [calc.boosts.d, calc.boosts.a]; calc.ua = calc.ud = null; paintCalc(); loadCalcUnits(); break;
    case 'calc-hp': calc.hp = Number(v); paintCalc(); break;
    case 'calc-hpa': calc.hpA = Number(v); paintCalc(); break;
    case 'calc-reset': Object.assign(calc, { weather: '', terrain: '', doubles: false, reflect: false, lightScreen: false, crit: false, hp: 1, hpA: 1, boosts: { a: ZB(), d: ZB() } }); paintCalc(); break;
    case 'calc-boost': { const [sd, k, n] = v.split(':'); calc.boosts[sd][k] = Math.max(-6, Math.min(6, calc.boosts[sd][k] + Number(n))); paintCalc(); break; }
    case 'calc-set': { const i = v.indexOf(':'); calc[v.slice(0, i)] = v.slice(i + 1); paintCalc(); break; }
    case 'calc-tog': calc[v] = !calc[v]; paintCalc(); break;
    case 'tc-sel': state.tcSel = state.tcSel === v ? null : v; paintTypes(); break;
    case 'shuffle': { const pool = INDEX.filter(p => !p.g); location.hash = '#/pokemon/' + pool[Math.floor(Math.random() * pool.length)].id; break; }
    case 'tier-go': goSearch({ tiers: [v] }); break;

    // ficha
    case 'row-fav': if (requireLogin({ type: 'fav', id: v })) openTeamPick(v); break;
    case 'shiny': {
      page.shiny = !page.shiny;
      const b = $('.shinybtn'); b.classList.toggle('on', page.shiny); b.setAttribute('aria-pressed', page.shiny);
      const old = $('.phero .art'); old.insertAdjacentHTML('beforebegin', artImg(page.d)); old.remove();
      $('.phero .art').classList.add('swap-in');
      break;
    }
    case 'fav': { const m = pageMember(); if (requireLogin({ type: 'fav', id: page.d.id, m })) openTeamPick(page.d.id, m); break; }
    case 'login-open': openLogin({ type: v }); break;
    case 'team-toggle': {
      const i = Number(v), had = teams[i].members.some(m => sameM(m, pickM)), p = BYID.get(pickId);
      const go = () => { if (toggleInTeam(i, pickId, pickM)) { closeSettings(); toast(t(had ? 'removedFrom' : 'addedTo', { name: pname(p), team: teamName(i) })); } };
      if (had) askConfirm(t('cfmRemovePoke', { name: pname(p), team: teamName(i) }), t('cfmRemove'), go); else go();
      break;
    }
    case 'slot-go': location.hash = `#/team/${v}`; break;
    case 'tn-edit': teamsSel.rename = !teamsSel.rename; paintTeams(); if (teamsSel.rename) { const n = $('#tn'); n?.focus(); n?.setSelectionRange(n.value.length, n.value.length); } else document.title = `${teamName(teamsSel.open)} · PokeScanner`; break;
    case 'slot-add': if (teamsSel.open >= 0) openPicker({ mode: 'team', slot: teamsSel.open }); break;
    case 'team-sugg-add': if (teamsSel.open >= 0) { const had = teams[teamsSel.open].members.some(m => m.id === v); if (!had && toggleInTeam(teamsSel.open, v)) toast(t('addedTo', { name: pname(BYID.get(v)), team: teamName(teamsSel.open) })); } break;
    case 'fb-kind': fbKind = v; document.querySelectorAll('[data-act="fb-kind"]').forEach(b => { const on = b.dataset.v === v; b.setAttribute('aria-pressed', on); b.setAttribute('aria-checked', on); }); break;
    case 'fb-send': {
      const box = $('#fb-text'), msg = $('#fb-msg'), text = (box?.value || '').trim();
      if (text.length < 5) { if (msg) msg.textContent = t('feedbackShort'); box?.focus(); break; }
      el.disabled = true;
      auth.sendFeedback(fbKind, text, `${navigator.userAgent.slice(0, 220)} | ${location.hash.slice(0, 80)} | ${lang()}`)
        .then(() => { if (box) box.value = ''; if (msg) msg.textContent = t('feedbackThanks'); toast(t('feedbackThanks')); })
        .catch(err => { if (msg) msg.textContent = /rate_limit/.test(err?.message || '') ? t('feedbackLimit') : t('feedbackFail'); })
        .finally(() => { el.disabled = false; });
      break;
    }
    case 'team-share': { const tm = teams[Number(v)]; if (tm?.members.length) shareTeam(tm.members.map(m => m.id), tm.name); break; }
    case 'save-into': { const i = Number(v); if (!saveCtx) break; teams[i].members = saveCtx.members || saveCtx.ids.map(id => ({ id })); if (saveCtx.name) teams[i].name = saveCtx.name; saveSlot(i); afterTeamsChange(); closeSettings(); toast(t('teamSaved', { team: teamName(i) })); break; }
    case 'shared-save': openSaveTeam({ name: bt.link?.name, ids: (bt.link?.members || []).map(m => m.id) }); break;
    case 'shared-share': if (bt.link) shareTeam(bt.link.members.map(m => m.id), bt.link.custom ? bt.link.name : ''); break;
    case 'shared-compare': bt.b = { owner: 'link', slot: 0 }; bt.res = null; bt.cmpMsg = ''; location.hash = '#/battle'; break;
    case 'save-side': { const sel = bt[v], tm = teamOf(sel); if (tm?.members.length) openSaveTeam({ name: tm.name, ids: tm.members.map(m => m.id) }); break; }
    case 'team-remove': if (teamsSel.open >= 0) { const i = teamsSel.open; askConfirm(t('cfmRemovePoke', { name: pname(BYID.get(v)), team: teamName(i) }), t('cfmRemove'), () => toggleInTeam(i, v)); } break;
    case 'pk-pick':
      if (pickCtx?.mode === 'avatar') setAvatar(BYID.get(v).num);
      else if (pickCtx?.mode === 'calc') { calc[pickCtx.side] = { id: v }; calc.boosts[pickCtx.side] = ZB(); calc.ua = calc.ud = null; closeSettings(); paintCalc(); loadCalcUnits(); }
      else if (pickCtx?.mode === 'comfilter') { if (!com.pokes.includes(v) && com.pokes.length < 3) com.pokes.push(v); closeSettings(); if (state.view === 'community') loadFeed(true); }
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
    case 'friend-decline': askConfirm(t('cfmDecline'), t('decline'), () => auth.respondFriend(v, false).then(() => auth.removeFriend(v)).catch(() => {}).then(() => refreshFriends()).then(() => { paintBattle(); watchBattle(); })); break;
    case 'friend-remove': askConfirm(t('cfmFriend'), t('cfmRemove'), () => { auth.removeFriend(v).then(() => refreshFriends()).then(() => { if (bt.b.owner === v) bt.b = { owner: 'me', slot: 1 }; bt.res = null; paintBattle(); watchBattle(); }).catch(() => toast(t('syncFail')));; }); break;
    case 'compare': if (state.view === 'battle') runCompare(); else openCompare(); break;
    case 'bt-mode': if (!bt.busy && bt.mode !== v) { bt.mode = v; bt.cmpMsg = ''; paintBattle(); } break;
    case 'bt-plan': bt.planSide = v; paintBattle(); break;
    case 'sign-in': startLogin(); break;
    case 'sign-out': auth.signOut().catch(() => {}); closeSettings(); break;
    case 'type-go': goSearch({ types: [v] }); break;
    case 'size-go': goSearch({ sort: v, dir: -1 }); break;
    case 'dock-home': goSearch(); window.scrollTo(0, 0); break;
    case 'dock-favs': if (requireLogin({ type: 'favs' })) location.hash = '#/teams'; break;
    case 'com-sort': if (com.sort !== v) { com.sort = v; loadFeed(true); } break;
    case 'com-more': loadFeed(false); break;
    case 'com-open': location.hash = `#/community/${v}${el.dataset.c ? '?c=1' : ''}`; break;
    case 'com-like': likePost(v); break;
    case 'com-del': com.confirm = v; repaintCom(); break;
    case 'com-del-no': com.confirm = null; repaintCom(); break;
    case 'com-del-yes': removePost(v); break;
    case 'com-publish': openPublish(); break;
    case 'pub-pick': { const i = Number(v); if (!pubCtx) break; pubCtx.slot = i; if (!pubCtx.nameTouched) pubCtx.name = teams[i].name.slice(0, 30); $('#pub-body', smodal).innerHTML = publishHTML(); break; }
    case 'pub-go': doPublish(); break;
    case 'com-login': openLogin({ type: 'community', hash: location.hash }); break;
    case 'com-send': sendComment(); break;
    case 'cm-like': likeComment(v); break;
    case 'cm-reply': {
      if (!requireLogin({ type: 'community', hash: location.hash })) break;
      const c = com.comments.find(x => String(x.id) === String(v)); if (!c) break;
      com.reply = { parent: c.parent_id || c.id, user: c.username || '?' };
      const keep = $('#cm-body')?.value || '';
      paintPost();
      const box = $('#cm-body'); if (box) { box.value = /^@\w+\s/.test(keep) ? keep.replace(/^@\w+\s/, `@${com.reply.user} `) : `@${com.reply.user} ${keep}`; box.scrollIntoView({ block: 'center', behavior: 'smooth' }); box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
      break;
    }
    case 'cm-reply-x': { const box = $('#cm-body'); const txt = (box?.value || '').replace(/^@\w+\s?/, ''); com.reply = null; paintPost(); const b2 = $('#cm-body'); if (b2) b2.value = txt; break; }
    case 'com-cdel': askConfirm(t('cfmComment'), t('comDelete'), () => auth.deleteComment(v).then(() => auth.communityComments(com.post.id)).then(c => { com.comments = c; com.post.comments = c.length; paintPost(); }).catch(() => toast(t('syncFail')))); break;
    case 'com-save': if (com.post) openSaveTeam({ name: com.post.name, ids: com.post.members.map(m => m.id), members: com.post.members }); break;
    case 'com-compare': if (com.post) { bt.link = { name: com.post.name, custom: true, members: com.post.members.filter(m => BYID.has(m.id)) }; bt.b = { owner: 'link', slot: 0 }; bt.res = null; bt.cmpMsg = ''; location.hash = '#/battle'; } break;
    case 'lk-go': closeSettings(); location.hash = `#/user/${v}`; break;
    case 'user-open': location.hash = `#/user/${v}`; break;
    case 'u-add': case 'u-accept': case 'u-decline': case 'u-remove': case 'u-ban': case 'u-unban': case 'u-purge': case 'u-rename': {
      const a = el.dataset.act;
      if (a === 'u-decline' || (a === 'u-remove' && usr.prof?.relation === 'out')) askConfirm(t(a === 'u-decline' ? 'cfmDecline' : 'cfmCancelReq'), t(a === 'u-decline' ? 'decline' : 'uCancelReq'), () => userAction(a, v));
      else userAction(a, v);
      break;
    }
    case 'u-ask': usr.confirm = v; paintUser(); break;
    case 'u-cancel': usr.confirm = null; paintUser(); break;
    case 'u-more': auth.communityUserPosts(usr.id, usr.posts.length, PAGE).then(r => { usr.posts = usr.posts.concat(r); usr.more = r.length === PAGE; paintUser(); }).catch(() => toast(t('syncFail'))); break;
    case 'u-team-save': { const r = (usr.teams || []).find(x => x.slot === Number(v)); const ms = (r?.members || []).filter(m => BYID.has(m.id)); if (ms.length) openSaveTeam({ name: r.name || usr.prof?.username, ids: ms.map(m => m.id), members: ms }); break; }
    case 'u-team-cmp': { const r = (usr.teams || []).find(x => x.slot === Number(v)); const ms = (r?.members || []).filter(m => BYID.has(m.id)); if (ms.length) { bt.link = { name: r.name || usr.prof?.username, custom: true, members: ms }; bt.b = { owner: 'link', slot: 0 }; bt.res = null; bt.cmpMsg = ''; location.hash = '#/battle'; } break; }
    case 'adm-bans': openBans(); break;
    case 'adm-unban': auth.adminUnban(v).then(() => auth.adminBans()).then(b => { usr.bans = b; refreshModal(); if (state.view === 'user' && usr.prof && usr.id === v) { usr.prof.banned = false; paintUser(); } }).catch(() => toast(t('syncFail'))); break;
    case 'com-pk-add': openPicker({ mode: 'comfilter' }); break;
    case 'com-pk-del': com.pokes = com.pokes.filter(x => x !== v); loadFeed(true); break;
    case 'dock-community': location.hash = '#/community'; break;
    case 'dock-battle': location.hash = '#/battle'; break;
    case 'dock-notifs': openNotifs(); break;
    case 'notif-go': goNotif(v); break;
    case 'dock-settings': if (smodal.hidden) openSettings(); else closeSettings(); break;
    case 'settings-close': closeSettings(); break;
    case 'tier': location.hash = `#/tier/${v}`; break;
    case 'move': location.hash = `#/move/${v}`; break;
    case 'ability': location.hash = `#/ability/${v}`; break;
    case 'item': location.hash = `#/item/${v}`; break;
    case 'nature': natureSheet(v); break;
    case 'fmt': page.fmt = v; page.idx = 0; $('#build').innerHTML = buildHTML(); break;
    case 'set': page.idx = Number(v); $('#build').innerHTML = buildHTML(); break;
    case 'copy': copyText(showdownText()); break;
    case 'more': page.expanded = true; $('#lvl').innerHTML = levelMovesHTML(true); break;
    case 'mtab': page.mtab = v; $('#moves').innerHTML = movesSectionHTML(); break;

    // comparador
    case 'pick':
      if (cmp.others.length >= CMP_MAX) { toast(t('cmpMax', { n: CMP_MAX })); break; }
      cmp.others.push(BYID.get(v)); $('#cmp-q').value = ''; renderCompare(); break;
    case 'remove': cmp.others = cmp.others.filter(p => p.id !== v); renderCompare(); break;
  }
});

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
  fetch('data/meta.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(m => { META = m; const h1 = state.view === 'home' && document.querySelector('.hero h1'); if (m && h1 && !h1.parentElement.querySelector('.upd')) h1.insertAdjacentHTML('afterend', updHTML()); }).catch(() => {});
  window.addEventListener('hashchange', route);
  route();
  auth.initAuth(onAuth).catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
