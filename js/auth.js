// Cuenta de usuario (Supabase + Google). La librería pesa ~220 KB, así que solo se descarga si hace falta:
// al arrancar con una sesión guardada, o cuando alguien pulsa "Continuar con Google".
const SB_URL = 'https://fjwawxepxdvpsktboqps.supabase.co';
const SB_KEY = 'sb_publishable_jI7504CZUIU5yqozKv8qGQ_8oPNVHII'; // clave pública: la seguridad la dan las políticas RLS de la base de datos
const TOKEN_KEY = 'sb-fjwawxepxdvpsktboqps-auth-token';

let sb = null, session = null, onChange = () => {};
export const currentUser = () => session?.user ?? null;
export const userInfo = () => {
  const u = currentUser();
  if (!u) return null;
  const m = u.user_metadata || {};
  return { id: u.id, name: m.full_name || m.name || u.email || '', email: u.email || '', avatar: m.avatar_url || m.picture || '' };
};

async function client() {
  if (sb) return sb;
  const { createClient } = await import('../vendor/supabase.js');
  sb = createClient(SB_URL, SB_KEY, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  sb.auth.onAuthStateChange((event, s) => {
    const was = session?.user?.id;
    session = s;
    // INITIAL_SESSION / SIGNED_IN se repiten (p. ej. al volver a la pestaña): solo avisamos si cambió el usuario
    if (event === 'SIGNED_OUT' || (s?.user?.id !== was)) setTimeout(() => onChange(event, s), 0);
  });
  return sb;
}

/** Arranca la cuenta: si hay sesión guardada (o se vuelve de Google) carga la librería y la recupera */
export async function initAuth(cb) {
  onChange = cb;
  let saved = false;
  try { saved = !!localStorage.getItem(TOKEN_KEY); } catch { /* sin almacenamiento */ }
  const returning = /[?&]code=/.test(location.search) || /[?#&]access_token=/.test(location.hash);
  if (!saved && !returning) return;
  const c = await client();
  const { data } = await c.auth.getSession();
  if (data?.session && !session) { session = data.session; onChange('INITIAL_SESSION', session); }
  if (returning && /[?&]code=/.test(location.search)) history.replaceState(history.state, '', location.pathname + (location.hash.startsWith('#/') ? location.hash : '#/'));
}

export async function signInGoogle() {
  if (!(await googleEnabled())) throw Object.assign(new Error('Google no está activado'), { code: 'google_off' });
  const c = await client();
  const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) throw error;
}
export async function signOut() {
  await untrackPresence().catch(() => {});
  await unwatchFriends().catch(() => {});
  const c = await client();
  await c.auth.signOut();
}

// ───────── datos de la cuenta ─────────
export async function loadFavorites() {
  const c = await client();
  const { data, error } = await c.from('favorites').select('pokemon_id');
  if (error) throw error;
  return data.map(r => r.pokemon_id);
}
export async function addFavorites(ids) {
  if (!ids.length) return;
  const c = await client(), uid = currentUser().id;
  const { error } = await c.from('favorites').upsert(ids.map(pokemon_id => ({ user_id: uid, pokemon_id })), { onConflict: 'user_id,pokemon_id', ignoreDuplicates: true });
  if (error) throw error;
}
export async function removeFavorite(id) {
  const c = await client();
  const { error } = await c.from('favorites').delete().eq('pokemon_id', id).eq('user_id', currentUser().id);
  if (error) throw error;
}
export async function loadProfile() {
  const c = await client();
  const { data, error } = await c.from('profiles').select('theme, lang, username, avatar').maybeSingle();
  if (error) throw error;
  return data; // null si es la primera vez
}
export async function ensureUsername() { const c = await client(); await c.rpc('ensure_username'); }
/** Cambia nombre de usuario y/o foto. Devuelve 'ok' | 'invalid' | 'banned' | 'taken' | 'error' */
export async function saveIdentity(fields) {
  const c = await client();
  const { error } = await c.from('profiles').update({ ...fields, updated_at: new Date().toISOString() }).eq('user_id', currentUser().id);
  if (!error) return 'ok';
  const m = String(error.message || '');
  if (error.code === '23505') return 'taken';
  if (/username_banned/.test(m)) return 'banned';
  if (/username_invalid|profiles_username_format/.test(m)) return 'invalid';
  if (/username_taken/.test(m)) return 'taken';
  return 'error';
}
export async function checkUsername(name) {
  const c = await client();
  const { data, error } = await c.rpc('check_username', { p_name: name });
  return error ? 'error' : data;
}
export async function saveProfile(p) {
  const c = await client();
  const { error } = await c.from('profiles').upsert({ user_id: currentUser().id, ...p, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Comprueba que Google está activado en Supabase antes de mandar a nadie a su pantalla de acceso */
export async function googleEnabled() {
  try {
    const r = await fetch(`${SB_URL}/auth/v1/settings`, { headers: { apikey: SB_KEY } });
    const s = await r.json();
    return !!s?.external?.google;
  } catch { return true; } // si no se puede comprobar, se intenta igualmente
}

// ───────── equipos (9 huecos) ─────────
export async function loadTeams() {
  const c = await client();
  const { data, error } = await c.from('teams').select('slot, name, members').eq('user_id', currentUser().id);
  if (error) throw error;
  return data;
}
export async function loadTeamsOf(userId) {
  const c = await client();
  const { data, error } = await c.from('teams').select('slot, name, members').eq('user_id', userId).order('slot');
  if (error) throw error;
  return data;
}
export async function loadAllTeams() { // tuyos y de tus amigos (las políticas RLS filtran el resto)
  const c = await client();
  const { data, error } = await c.from('teams').select('user_id, slot, name, members');
  if (error) throw error;
  return data;
}
export async function saveTeam(slot, name, members) {
  const c = await client();
  const { error } = await c.from('teams').upsert({ user_id: currentUser().id, slot, name, members, updated_at: new Date().toISOString() }, { onConflict: 'user_id,slot' });
  if (error) throw error;
}

// ───────── comentarios y errores ─────────
export async function sendFeedback(kind, message, appInfo) {
  const c = await client();
  const { error } = await c.from('feedback').insert({ kind, message, app_info: appInfo });
  if (error) throw error;
}

// ───────── amigos ─────────
export async function friendsList() {
  const c = await client();
  const { data, error } = await c.rpc('my_friends');
  if (error) throw error;
  return data;
}
export async function sendFriendRequest(username) {
  const c = await client();
  const { data, error } = await c.rpc('send_friend_request', { p_username: username });
  if (error) throw error;
  return data; // 'sent' | 'accepted' | 'already' | 'pending' | 'not_found' | 'self' | 'limit'
}
export async function respondFriend(id, accept) { const c = await client(); const { error } = await c.rpc('respond_friend_request', { p_requester: id, p_accept: accept }); if (error) throw error; }
export async function removeFriend(id) { const c = await client(); const { error } = await c.rpc('remove_friend', { p_other: id }); if (error) throw error; }

// ───────── tiempo real ─────────
// Presencia: cada persona anuncia que está conectada en su propio canal (pres:<id>). Solo los amigos se suscriben a ese canal,
// y solo mientras tienen abierta la pantalla de Batalla, así el servidor no recibe tráfico de desconocidos.
let myPres = null, watchers = [];
export async function trackPresence() {
  if (myPres || !currentUser()) return;
  const c = await client();
  myPres = c.channel(`pres:${currentUser().id}`, { config: { presence: { key: currentUser().id } } });
  myPres.subscribe(st => { if (st === 'SUBSCRIBED') myPres?.track({ at: Date.now() }); });
}
export async function untrackPresence() { if (!myPres) return; const c = await client(); const ch = myPres; myPres = null; await c.removeChannel(ch); }

/** Vigila a los amigos: onOnline(id, bool) cuando cambia su conexión y onTeam(row) cuando modifican un equipo */
export async function watchFriends(ids, { onOnline, onTeam, onFriends }) {
  await unwatchFriends();
  const c = await client();
  for (const id of ids) {
    const ch = c.channel(`pres:${id}`);
    const sync = () => onOnline(id, Object.keys(ch.presenceState()).length > 0);
    ch.on('presence', { event: 'sync' }, sync).on('presence', { event: 'join' }, sync).on('presence', { event: 'leave' }, sync).subscribe();
    watchers.push(ch);
  }
  // los cambios de equipos y amistades llegan filtrados por las políticas RLS: solo ves los tuyos y los de tus amigos
  const db = c.channel('battle-db')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, p => { if (p.new?.user_id) onTeam(p.new); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => onFriends())
    .subscribe();
  watchers.push(db);
}
export async function unwatchFriends() {
  if (!sb || !watchers.length) { watchers = []; return; }
  const list = watchers; watchers = [];
  await Promise.all(list.map(ch => sb.removeChannel(ch)));
}
