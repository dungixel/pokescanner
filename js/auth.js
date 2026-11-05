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
  const { data, error } = await c.from('profiles').select('theme, lang').maybeSingle();
  if (error) throw error;
  return data; // null si es la primera vez
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
