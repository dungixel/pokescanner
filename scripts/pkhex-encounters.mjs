// Encuentros de Escarlata/Púrpura (+DLC), Diamante/Perla Reluciente, Leyendas Arceus y Leyendas Z-A, leídos de los datos de PKHeX (raw/pkhex).
// Devuelve filas en el mismo formato que build-encounters.mjs: [versiones, lugar, zona, método, nivMin, nivMax, prob, condiciones]
import fs from 'node:fs';
import path from 'node:path';

const T = (RAW, f) => fs.readFileSync(path.join(RAW, 'pkhex', f), 'utf8').split('\n').map(s => s.replace(/\r$/, ''));

/** contenedor BinLinker: cabecera "xx", cuenta u16 y por entrada (inicio,fin) en u32 (o u16 en la versión 16) */
function linker(buf, wide = true) {
  const n = buf.readUInt16LE(2), out = [];
  for (let i = 0; i < n; i++) {
    const o = 4 + i * (wide ? 4 : 2);
    const s = wide ? buf.readUInt32LE(o) : buf.readUInt16LE(o), e = wide ? buf.readUInt32LE(o + 4) : buf.readUInt16LE(o + 2);
    out.push(buf.subarray(s, e));
  }
  return out;
}

/** (especie, forma) del juego → id de nuestra ficha. Las formas regionales siguen el orden Alola, Galar, Hisui, Paldea; el resto cae en la forma base. */
export function makeFormMapper(index) {
  const by = new Map();
  for (const p of index) (by.get(p.num) || by.set(p.num, []).get(p.num)).push(p);
  const REG = ['alola', 'galar', 'hisui', 'paldea'];
  return (species, form) => {
    const c = by.get(species); if (!c) return null;
    const base = c.find(p => !p.fm) || c[0];
    if (!form) return base.id;
    const reg = c.filter(p => p.fm && REG.some(r => p.id.includes(r)) && !/mega|gmax/.test(p.id))
      .sort((a, b) => REG.findIndex(r => a.id.includes(r)) - REG.findIndex(r => b.id.includes(r)));
    return (reg[form - 1] || base).id;
  };
}

export function readPkhex({ RAW, index }) {
  const map = makeFormMapper(index);
  const rows = new Map(); // id → filas (con prob. 100)
  const dict = { grp: {}, ver: {}, loc: {}, reg: {}, meth: {}, cond: {} };
  const add = (id, vs, loc, meth, lo, hi, conds = []) => {
    if (!id) return;
    const list = rows.get(id) || rows.set(id, []).get(id);
    list.push([vs, loc, 0, meth, lo, hi, 100, conds]);
  };
  const names = (base, file, code) => {
    const en = T(RAW, `${file}_en.txt`), es = T(RAW, `${file}_es.txt`);
    for (let i = 1; i < en.length; i++) if (en[i] && !/^[—-]+$/.test(en[i])) dict.loc[base + i] = [es[i] || en[i], en[i], code(i)];
  };
  const group = (g, es, en, gen, o, vers) => {
    dict.grp[g] = { n: [es, en], g: gen, o, v: vers };
    for (const [v] of vers) dict.ver[v] = g;
  };
  dict.meth[2001] = ['En la naturaleza', 'In the wild']; dict.meth[2002] = ['Distorsión espaciotemporal', 'Space-time distortion']; dict.meth[2003] = ['Punto de interés', 'Landmark'];
  dict.meth[2004] = ['Brote masivo', 'Mass outbreak']; dict.meth[2005] = ['Brote masivo (enorme)', 'Massive mass outbreak']; dict.meth[2006] = ['Hiperespacio', 'Hyperspace'];
  dict.cond[2001] = ['Alfa', 'Alpha'];
  dict.reg[101] = ['Kitakami', 'Kitakami']; dict.reg[102] = ['Academia Arándano', 'Blueberry Academy'];

  // ───── Escarlata / Púrpura (los tres mapas: Paldea, Kitakami y Academia Arándano) ─────
  const SV = 10000;
  names(SV, 'text_sv', i => (i >= 172 ? 102 : i >= 132 ? 101 : 10)); // 10 = Paldea (id de región de PokeAPI)
  group(100, 'Escarlata / Púrpura', 'Scarlet / Violet', 9, 100, [[100, 'Escarlata', 'Scarlet'], [101, 'Púrpura', 'Violet']]);
  for (const a of linker(fs.readFileSync(path.join(RAW, 'pkhex', 'encounter_wild_paldea.pkl')))) {
    const loc = a[2] || a[0];
    for (let o = 4; o + 8 <= a.length; o += 8) {
      const sp = a.readUInt16LE(o), form = a[o + 2], lo = a[o + 4], hi = a[o + 5];
      add(map(sp, form), [100, 101], SV + loc, 2001, lo, hi);
    }
  }
  // ───── Diamante / Perla Reluciente ─────
  const BD = 20000, BDT = { 1: 1, 2: 5, 3: 2, 4: 3, 5: 4, 6: 6, 8: 55 }; // tipo de zona → método de PokeAPI (hierba, surf, cañas, Golpe Roca, árbol de miel)
  names(BD, 'text_bdsp', () => 4);
  group(101, 'Diamante Brillante / Perla Reluciente', 'Brilliant Diamond / Shining Pearl', 8, 23, [[102, 'Diamante Brillante', 'Brilliant Diamond'], [103, 'Perla Reluciente', 'Shining Pearl']]);
  for (const [file, ver] of [['encounter_bd.pkl', 102], ['encounter_sp.pkl', 103]]) {
    for (const a of linker(fs.readFileSync(path.join(RAW, 'pkhex', file)))) {
      const loc = a.readUInt16LE(0), type = a[2], meth = BDT[type]; if (!meth) continue;
      for (let o = 4; o + 4 <= a.length; o += 4) {
        const v = a.readUInt16LE(o), sp = v & 0x3ff, form = v >> 11;
        add(map(sp, form), [ver], BD + loc, meth, a[o + 2], a[o + 3]);
      }
    }
  }
  // ───── Leyendas Arceus ─────
  const LA = 30000, LAT = { 0: 2001, 1: 2002, 2: 2003, 3: 2004, 4: 2005 };
  names(LA, 'text_la', () => 9);
  group(102, 'Leyendas Pokémon: Arceus', 'Pokémon Legends: Arceus', 8, 24, [[104, 'Leyendas Arceus', 'Legends: Arceus']]);
  for (const a of linker(fs.readFileSync(path.join(RAW, 'pkhex', 'encounter_la.pkl')))) {
    const nloc = a[0], locs = [...a.subarray(1, 1 + nloc)];
    let align = nloc + 1; align += align & 1;
    const type = a[align], count = a[align + 1];
    for (let i = 0; i < count; i++) {
      const o = align + 2 + i * 8, sp = a.readUInt16LE(o), form = a[o + 2], alpha = a[o + 3];
      add(map(sp, form), [104], LA + locs[0], LAT[type] || 2001, a[o + 4], a[o + 5], alpha ? [2001] : []);
    }
  }
  // ───── Leyendas Z-A (Lumiose y su hiperespacio) ─────
  const ZA = 40000;
  names(ZA, 'text_za', () => 6);
  group(103, 'Leyendas Pokémon: Z-A', 'Pokémon Legends: Z-A', 9, 101, [[105, 'Leyendas Z-A', 'Legends: Z-A']]);
  for (const [file, meth] of [['encounter_za.pkl', 2001], ['encounter_hyperspace_za.pkl', 2006]]) {
    for (const a of linker(fs.readFileSync(path.join(RAW, 'pkhex', file)), false)) {
      const loc = a.readUInt16LE(0);
      for (let o = 4; o + 8 <= a.length; o += 8) {
        const sp = a.readUInt16LE(o), form = a[o + 2], alpha = a[o + 6] === 1;
        add(map(sp, form), [105], ZA + loc, meth, a[o + 4], a[o + 5], alpha ? [2001] : []);
      }
    }
  }
  // quita lo que no se usa y junta filas repetidas (mismo lugar/método/versiones/condiciones: niveles mín-máx)
  for (const [id, list] of rows) {
    const m = new Map();
    for (const r of list) {
      const k = [r[0].join(), r[1], r[3], r[7].join()].join('|'), o = m.get(k);
      if (o) { o[4] = Math.min(o[4], r[4]); o[5] = Math.max(o[5], r[5]); } else m.set(k, r);
    }
    rows.set(id, [...m.values()]);
  }
  const used = new Set(); for (const list of rows.values()) for (const r of list) used.add(r[1]);
  for (const k of Object.keys(dict.loc)) if (!used.has(Number(k))) delete dict.loc[k];
  return { rows, dict };
}
