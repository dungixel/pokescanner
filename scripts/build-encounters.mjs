// Dónde capturar cada Pokémon (PokeAPI, Gen 1–8). Lee raw/*.csv y data/index.json, escribe data/enc/<k>.json y data/enc-dict.json.
//   data/enc/<k>.json = { id: [ [versiones, lugar, zona, método, nivMin, nivMax, prob, condiciones], ... ] }  (mismos paquetes k que data/pokemon)
// Ejecutar después de `npm run fetch` y `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'raw'), OUT = path.join(ROOT, 'data');
function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...rest] = rows;
  return rest.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((k, i) => [k, r[i]])));
}
const csv = n => parseCSV(fs.readFileSync(path.join(RAW, `${n}.csv`), 'utf8'));
import { readPkhex } from './pkhex-encounters.mjs';
const ES = '7', EN = '9';
const names = (file, idCol, extra = {}) => { const m = new Map(); for (const r of csv(file)) { const o = m.get(r[idCol]) || {}; if (r.local_language_id === ES) o.es = r.name; if (r.local_language_id === EN) o.en = r.name; m.set(r[idCol], o); } return m; };

// ───── traducciones propias de lo que PokeAPI no trae en español ─────
const METHOD_ES = { walk: 'Hierba o suelo', 'old-rod': 'Caña vieja', 'good-rod': 'Caña buena', 'super-rod': 'Supercaña', surf: 'Surf', 'rock-smash': 'Golpe Roca', headbutt: 'Cabezazo (árbol)',
  'dark-grass': 'Hierba densa', 'grass-spots': 'Hierba agitada', 'cave-spots': 'Polvo en cuevas', 'bridge-spots': 'Sombra en puentes', 'super-rod-spots': 'Burbujas (pescando)', 'surf-spots': 'Burbujas (surfeando)',
  'yellow-flowers': 'Flores amarillas', 'purple-flowers': 'Flores moradas', 'red-flowers': 'Flores rojas', 'rough-terrain': 'Terreno irregular', gift: 'Regalo', 'gift-egg': 'Huevo de regalo', static: 'Encuentro fijo',
  pokeflute: 'Poké Flauta', 'headbutt-low': 'Cabezazo (árbol)', 'headbutt-normal': 'Cabezazo (árbol)', 'headbutt-high': 'Cabezazo (árbol)', 'squirt-bottle': 'Regadera', 'wailmer-pail': 'Regadera Wailmer', seaweed: 'Buceo',
  'roaming-grass': 'Errante', 'roaming-water': 'Errante (agua)', 'devon-scope': 'Detector Devon', 'feebas-tile-fishing': 'Casillas de Feebas', 'island-scan': 'Escaneo de islas', sos: 'Llamada de auxilio',
  'bubbling-spots': 'Burbujas', 'berry-trees': 'Árbol de bayas', 'npc-trade': 'Intercambio con un NPC', 'sos-from-bubbling-spot': 'Llamada de auxilio (burbujas)', overworld: 'Visible en el mapa', 'overworld-water': 'Visible en el agua',
  'overworld-flying': 'Visible volando', 'overworld-special': 'Visible en el mapa (especial)', 'overworld-flying-special': 'Visible volando (especial)', 'overworld-water-special': 'Visible en el agua (especial)', horde: 'Horda',
  pokespot: 'Poképunto', 'hidden-grotto': 'Gruta oculta', 'honey-tree': 'Árbol de miel', 'overworld-dirt': 'Visible en el suelo', wanderer: 'Errante', 'wanderer-water': 'Errante (agua)', 'chase-water': 'Perseguido en el agua',
  'dynamax-adventure': 'Aventura Dinamax', 'max-raid': 'Incursión Dinamax', 'trash-can-ambush': 'Emboscada en un cubo de basura', 'rustling-bush-ambush': 'Emboscada en un arbusto', 'ceiling-ambush': 'Emboscada desde el techo',
  'ground-ambush': 'Emboscada desde el suelo', 'sky-ambush': 'Emboscada desde el cielo', snag: 'Captura con Snag', 'snag-rematch': 'Captura con Snag (revancha)', 'pokemon-ranger': 'Pokémon Ranger', 'new-york-pokecenter-wish-eggs': 'Huevo deseo' };
const COND_ES = { 'swarm-yes': 'Durante un enjambre', 'time-morning': 'Por la mañana', 'time-day': 'De día', 'time-night': 'De noche', 'radar-on': 'Con Poké Radar', 'slot2-ruby': 'Con Rubí en la ranura GBA', 'slot2-sapphire': 'Con Zafiro en la ranura GBA',
  'slot2-emerald': 'Con Esmeralda en la ranura GBA', 'slot2-firered': 'Con Rojo Fuego en la ranura GBA', 'slot2-leafgreen': 'Con Verde Hoja en la ranura GBA', 'radio-hoenn': 'Con la radio de Hoenn', 'radio-sinnoh': 'Con la radio de Sinnoh',
  'season-spring': 'Primavera', 'season-summer': 'Verano', 'season-autumn': 'Otoño', 'season-winter': 'Invierno', 'weather-normal': 'Clima normal', 'weather-overcast': 'Nublado', 'weather-raining': 'Lluvia', 'weather-thunderstorm': 'Tormenta',
  'weather-snowing': 'Nevando', 'weather-snowstorm': 'Ventisca', 'weather-sandstorm': 'Tormenta de arena', 'weather-intense-sun': 'Sol intenso', 'weather-fog': 'Niebla', 'time-04-00-to-19-59': 'Entre las 4:00 y las 19:59',
  'time-20-00-to-21-59': 'Entre las 20:00 y las 21:59', 'time-21-00-to-03-59': 'Entre las 21:00 y las 3:59', 'starter-bulbasaur': 'Si elegiste Bulbasaur', 'starter-squirtle': 'Si elegiste Squirtle', 'starter-charmander': 'Si elegiste Charmander',
  'starter-chespin': 'Si elegiste Chespin', 'starter-fennekin': 'Si elegiste Fennekin', 'starter-froakie': 'Si elegiste Froakie', 'starter-grookey': 'Si elegiste Grookey', 'starter-scorbunny': 'Si elegiste Scorbunny', 'starter-sobble': 'Si elegiste Sobble',
  'weekday-sunday': 'Domingo', 'weekday-monday': 'Lunes', 'weekday-tuesday': 'Martes', 'weekday-wednesday': 'Miércoles', 'weekday-thursday': 'Jueves', 'weekday-friday': 'Viernes', 'weekday-saturday': 'Sábado',
  'story-progress-hall-of-fame': 'Tras entrar en el Salón de la Fama', 'story-progress-national-dex': 'Con el Pokédex Nacional' };
const GROUP_ES = { 21: 'Isla de la Armadura', 22: 'Nieves de la Corona' };
const GROUP_EN = { 21: 'The Isle of Armor', 22: 'The Crown Tundra' };
const esLoc = s => s.replace(/^Roaming (the )?(.+)$/i, 'Errante por $2').replace(/\bSea Route\b/g, 'Ruta').replace(/\bRoute\b/g, 'Ruta').replace(/\bMt\.? /g, 'Monte ');

// ───── tablas ─────
// nombres oficiales de los lugares: PKHeX trae los textos de cada juego en inglés y español con el mismo índice
const normName = s => s.toLowerCase().replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ').trim();
const OFFICIAL = new Map();
for (const f of fs.readdirSync(path.join(RAW, 'pkhex')).filter(f => f.endsWith('_en.txt'))) {
  const en = fs.readFileSync(path.join(RAW, 'pkhex', f), 'utf8').split('\n'), es = fs.readFileSync(path.join(RAW, 'pkhex', f.replace('_en', '_es')), 'utf8').split('\n');
  for (let i = 1; i < en.length; i++) { const a = en[i].trim(), b = (es[i] || '').trim(); if (a && b && !/^[—-]+$/.test(a)) { const k = normName(a), m = OFFICIAL.get(k) || new Map(); m.set(b, (m.get(b) || 0) + 1); OFFICIAL.set(k, m); } }
}
const officialEs = en => { const m = OFFICIAL.get(normName(en)); return m ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null; };
const index = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8'));
const locName = names('location_names', 'location_id'), regName = names('region_names', 'region_id'), verName = names('version_names', 'version_id');
const condProse = names('encounter_condition_value_prose', 'encounter_condition_value_id'), methProse = names('encounter_method_prose', 'encounter_method_id');
const locs = new Map(csv('locations').map(r => [r.id, r]));
const areas = new Map(csv('location_areas').map(r => [r.id, r]));
const areaProse = names('location_area_prose', 'location_area_id');
const areasPerLoc = new Map(); for (const a of areas.values()) areasPerLoc.set(a.location_id, (areasPerLoc.get(a.location_id) || 0) + 1);
const methods = new Map(csv('encounter_methods').map(r => [r.id, r]));
const conds = new Map(csv('encounter_condition_values').map(r => [r.id, r]));
const slots = new Map(csv('encounter_slots').map(r => [r.id, r]));
const versions = new Map(csv('versions').map(r => [r.id, r]));
const vgroups = new Map(csv('version_groups').map(r => [r.id, r]));
const condMap = new Map();
for (const r of csv('encounter_condition_value_map')) { if (conds.get(r.encounter_condition_value_id)?.is_default === '1') continue; (condMap.get(r.encounter_id) || condMap.set(r.encounter_id, []).get(r.encounter_id)).push(Number(r.encounter_condition_value_id)); }

const SKIP_VER = new Set(['44', '45', '46']); // versiones japonesas de Rojo/Verde/Azul: repiten a las normales
const spToIds = new Map(); for (const p of index) (spToIds.get(String(p.sp)) || spToIds.set(String(p.sp), []).get(String(p.sp))).push(p);

// agrupa: pokémon → (versión, zona, método, condiciones) → { nivel mín/máx, prob. sumada }
const per = new Map();
for (const e of csv('encounters')) {
  if (SKIP_VER.has(e.version_id)) continue;
  const sl = slots.get(e.encounter_slot_id); if (!sl) continue;
  const cs = (condMap.get(e.id) || []).sort((a, b) => a - b);
  const key = [e.version_id, e.location_area_id, sl.encounter_method_id, cs.join('+')].join('|');
  let m = per.get(e.pokemon_id); if (!m) per.set(e.pokemon_id, (m = new Map()));
  const o = m.get(key) || { v: Number(e.version_id), a: Number(e.location_area_id), m: Number(sl.encounter_method_id), c: cs, lo: 999, hi: 0, p: 0 };
  o.lo = Math.min(o.lo, Number(e.min_level)); o.hi = Math.max(o.hi, Number(e.max_level)); o.p += Number(sl.rarity);
  m.set(key, o);
}

// junta versiones con la misma entrada (misma zona/método/niveles/prob./condiciones)
const usedLoc = new Set(), usedArea = new Set(), usedMeth = new Set(), usedCond = new Set(), usedVer = new Set();
const byPokemon = new Map();
for (const [pid, m] of per) {
  const merged = new Map();
  for (const o of m.values()) {
    const p = Math.min(o.p, 100);
    const k = [o.a, o.m, o.lo, o.hi, p, o.c.join('+')].join('|');
    const g = merged.get(k) || { vs: [], a: o.a, m: o.m, lo: o.lo, hi: o.hi, p, c: o.c };
    g.vs.push(o.v); merged.set(k, g);
  }
  const rows = [...merged.values()].map(g => {
    const loc = Number(areas.get(String(g.a)).location_id);
    usedLoc.add(loc); usedMeth.add(g.m); g.c.forEach(c => usedCond.add(c)); g.vs.forEach(v => usedVer.add(v));
    const area = (areasPerLoc.get(String(loc)) || 0) > 1 ? g.a : 0; if (area) usedArea.add(area);
    return [g.vs.sort((a, b) => a - b), loc, area, g.m, g.lo, g.hi, g.p, g.c];
  }).sort((a, b) => a[0][0] - b[0][0] || a[1] - b[1] || a[3] - b[3]);
  byPokemon.set(pid, rows);
}

// ───── Escarlata/Púrpura, BDSP, Leyendas Arceus y Z-A (PKHeX) ─────
const PK = readPkhex({ RAW, index });

// ───── diccionario ─────
const dict = { ver: {}, grp: {}, loc: {}, area: {}, meth: {}, cond: {}, reg: {} };
const UNTRANSLATED = new Set();
const grpVers = new Map();
for (const v of [...usedVer].sort((a, b) => a - b)) {
  const ver = versions.get(String(v)); const g = ver.version_group_id;
  dict.ver[v] = Number(g);
  (grpVers.get(g) || grpVers.set(g, []).get(g)).push(v);
}
for (const [g, vs] of grpVers) {
  const gr = vgroups.get(g);
  const nm = lang => vs.map(v => verName.get(String(v))?.[lang] || versions.get(String(v)).identifier).filter((x, i, a) => a.indexOf(x) === i);
  const es = GROUP_ES[g] || nm('es').join(' / '), en = GROUP_EN[g] || nm('en').join(' / ');
  dict.grp[g] = { n: [es, en], g: Number(gr.generation_id), o: Number(gr.order), v: vs.map(v => [v, verName.get(String(v))?.es || versions.get(String(v)).identifier, verName.get(String(v))?.en || versions.get(String(v)).identifier]) };
}
for (const l of usedLoc) {
  const r = locs.get(String(l)), n = locName.get(String(l)) || {};
  const en = n.en || r.identifier.replace(/-/g, ' ');
  dict.loc[l] = [officialEs(en) || n.es || esLoc(en), en, Number(r.region_id) || 0];
  if (!officialEs(en) && !n.es) UNTRANSLATED.add(en);
  if (r.region_id) dict.reg[r.region_id] = [regName.get(r.region_id)?.es || regName.get(r.region_id)?.en || '', regName.get(r.region_id)?.en || ''];
}
const prettyArea = s => (/^b?\d+f$/i.test(s) ? s.toUpperCase() : s.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase()));
for (const a of usedArea) {
  const r = areas.get(String(a)), n = areaProse.get(String(a));
  const en = n?.en || prettyArea(r.identifier || '');
  dict.area[a] = [n?.es || esLoc(en), en];
}
for (const m of usedMeth) { const r = methods.get(String(m)); const en = methProse.get(String(m))?.en || r.identifier.replace(/-/g, ' '); dict.meth[m] = [METHOD_ES[r.identifier] || en, en]; }
// condiciones sin traducir y de texto largo (progreso de historia, incursiones…) se descartan: no caben como etiqueta
const DROP = new Set();
for (const c of usedCond) { const r = conds.get(String(c)); const en = condProse.get(String(c))?.en || r.identifier.replace(/-/g, ' '); if (!COND_ES[r.identifier] && en.length > 32) { DROP.add(c); continue; } dict.cond[c] = [COND_ES[r.identifier] || en, en]; }
for (const [pid, rows] of byPokemon) {
  const m = new Map();
  for (const r of rows) {
    r[7] = r[7].filter(c => !DROP.has(c));
    const k = [r[0].join(), r[1], r[2], r[3], r[7].join()].join('|'), o = m.get(k);
    if (o) { o[4] = Math.min(o[4], r[4]); o[5] = Math.max(o[5], r[5]); o[6] = Math.max(o[6], r[6]); } else m.set(k, r);
  }
  byPokemon.set(pid, [...m.values()]);
}
for (const k of ['grp', 'ver', 'loc', 'meth', 'cond']) Object.assign(dict[k], PK.dict[k]);
for (const [k, v] of Object.entries(PK.dict.reg)) dict.reg[k] = v;
for (const r of csv('regions')) if (['hisui', 'paldea'].includes(r.identifier) && !dict.reg[r.id]) dict.reg[r.id] = [regName.get(r.id)?.es || regName.get(r.id)?.en || r.identifier, regName.get(r.id)?.en || r.identifier];
fs.writeFileSync(path.join(OUT, 'enc-dict.json'), JSON.stringify(dict));
fs.writeFileSync(path.join(RAW, 'untranslated-locations.txt'), [...UNTRANSLATED].sort().join('\n'));

// ───── paquetes por k (los mismos que data/pokemon) ─────
fs.mkdirSync(path.join(OUT, 'enc'), { recursive: true });
const bundles = new Map(); let withData = 0, rowsTotal = 0;
for (const [pid, rows] of byPokemon) {
  for (const p of spToIds.get(pid) || []) {
    (bundles.get(p.k) || bundles.set(p.k, {}).get(p.k))[p.id] = rows; withData++; rowsTotal += rows.length;
  }
}
for (const [id, rows] of PK.rows) { const p = index.find(x => x.id === id); if (!p) continue; const b = bundles.get(p.k) || bundles.set(p.k, {}).get(p.k); if (!b[id]) withData++; b[id] = [...(b[id] || []), ...rows]; rowsTotal += rows.length; }
for (const [k, b] of bundles) fs.writeFileSync(path.join(OUT, 'enc', `${k}.json`), JSON.stringify(b));
console.log(`Pokémon con datos: ${withData}/${index.length} · filas: ${rowsTotal} · paquetes: ${bundles.size}`);
