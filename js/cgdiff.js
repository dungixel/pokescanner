// Cálculo de cambios entre dos "fotos" de los datos. Lo usan la actualización diaria (scripts/build-changelog.mjs)
// y la web, así que no debe tocar nada del navegador.
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
// solo el texto del juego: así no depende de si hay descripción precisa o no
const txt = x => hash(x.de || x.d || '');
const pkSig = p => `${p.r}|${p.t.join(',')}|${p.s.join(',')}|${p.sh || ''}`;
const MV = ['t', 'c', 'p', 'a', 'pp', 'pr'];
const mvSig = m => [...MV.map(k => m[k] ?? ''), txt(m)].join('|');
const txSig = x => txt(x);

function pkDiff(a, b) {
  const [ra, ta, sa, ha] = a.split('|'), [rb, tb, sb, hb] = b.split('|'), c = [];
  if (ra !== rb) c.push(['r', ra, rb]);
  if (ta !== tb) c.push(['t', ta.split(','), tb.split(',')]);
  if (sa !== sb) c.push(['s', sa.split(',').map(Number), sb.split(',').map(Number)]);
  if (ha !== undefined && ha !== '' && hb !== undefined && ha !== hb) c.push(['b']); // builds de Smogon cambiados
  return c;
}
const num = v => (v === '' ? null : /^-?\d+$/.test(v) ? Number(v) : v);
function mvDiff(a, b) {
  const x = a.split('|'), y = b.split('|'), c = [];
  MV.forEach((k, i) => { if (x[i] !== y[i]) c.push([k, num(x[i]), num(y[i])]); });
  if (x[MV.length] !== y[MV.length]) c.push(['x']);
  return c;
}
const txDiff = (a, b) => (a !== b ? [['x']] : []);

function diffMap(prev, cur, k, d, t, differ) {
  const out = [];
  for (const id in cur) if (prev[id] != null && prev[id] !== cur[id]) { const c = differ(prev[id], cur[id]); if (c.length) out.push({ d, t, k, id, c }); }
  return out;
}

/** Foto de los datos: una firma corta por Pokémon, movimiento, habilidad y objeto */
export function snapshot(generado, index, dict) {
  const s = { v: 2, g: generado, p: {}, m: {}, a: {}, i: {} };
  for (const p of index) s.p[p.id] = pkSig(p);
  for (const id in dict.moves) s.m[id] = mvSig(dict.moves[id]);
  for (const id in dict.abilities) s.a[id] = txSig(dict.abilities[id]);
  for (const id in dict.items) s.i[id] = txSig(dict.items[id]);
  return s;
}

/** Cambios entre dos fotos: [{d (día), t (momento de los datos), k, id, c}] */
export function diffSnaps(prev, cur) {
  const d = cur.g.slice(0, 10), t = cur.g;
  return [
    ...Object.keys(cur.p).filter(id => prev.p[id] == null).map(id => ({ d, t, k: 'new', id, c: [] })),
    ...diffMap(prev.p, cur.p, 'pk', d, t, pkDiff),
    ...diffMap(prev.m || {}, cur.m, 'mv', d, t, mvDiff),
    ...diffMap(prev.a || {}, cur.a, 'ab', d, t, txDiff),
    ...diffMap(prev.i || {}, cur.i, 'it', d, t, txDiff),
  ];
}

/** Junta cambios nuevos con los que ya había del mismo elemento (el primer "antes" se queda, el último "después" gana) */
export function mergeLog(list, add) {
  for (const e of add) {
    const old = list.find(x => x.k === e.k && x.id === e.id);
    if (!old) { list.unshift(e); continue; }
    for (const [f, a, b] of e.c) {
      const o = old.c.find(x => x[0] === f);
      if (o) { o[2] = b; if (f === 'x') continue; if (JSON.stringify(o[1]) === JSON.stringify(o[2])) old.c.splice(old.c.indexOf(o), 1); } else old.c.push([f, a, b]);
    }
    old.d = e.d; if (e.t) old.t = e.t;
    if (!old.c.length && old.k !== 'new') list.splice(list.indexOf(old), 1);
  }
  return list;
}
