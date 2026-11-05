// Aplica las diferencias de `member.b` (build editada) a los campos que usan los motores de combate. Ver editor.js.
const KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/** Aplica las diferencias de `member.b` a los campos que usan los motores de combate */
export function applyBuild(member, f) {
  const b = member?.b; if (!b) return f;
  const out = { ...f };
  if (b.n) out.nat = b.n;
  if (b.i !== undefined) out.item = b.i;
  if (b.a) out.abId = b.a;
  if (b.m?.length) out.moveIds = [...b.m];
  if (b.e) out.evs = Object.fromEntries(KEYS.map((k, i) => [k, b.e[i] || 0]));
  if (b.v) out.ivs = Object.fromEntries(KEYS.map((k, i) => [k, b.v[i] ?? 31]));
  return out;
}
