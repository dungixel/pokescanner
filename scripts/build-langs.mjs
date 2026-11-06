// Genera data/lang/fr.json y de.json (nombres y textos oficiales en francés y alemán) a partir de los CSV de PokeAPI.
// Uso: node scripts/build-langs.mjs <carpeta con los csv de nombres> (por defecto ./raw)
import fs from 'node:fs';
import path from 'node:path';
const RAW = process.argv[2] || 'raw', EXTRA = process.argv[3] || RAW;
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const csv = f => {
  const t = fs.readFileSync(fs.existsSync(path.join(EXTRA, f)) ? path.join(EXTRA, f) : path.join(RAW, f), 'utf8');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c;
  }
  const h = rows.shift(); return rows.filter(r => r.length === h.length).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
};
const dict = JSON.parse(fs.readFileSync('data/dict.json', 'utf8'));
const LANG = { fr: '5', de: '6', en: '9' };
const idOf = (file, key) => Object.fromEntries(csv(file).map(r => [norm(r.identifier), r.id]));
const mvId = idOf('moves.csv'), abId = idOf('abilities.csv'), itId = idOf('items.csv');
const spN = csv('pokemon_species_names.csv'), mvN = csv('move_names.csv'), abN = csv('ability_names.csv'), itN = csv('item_names.csv'), natN = csv('nature_names.csv');
const mvF = csv('move_flavor_text.csv'), abF = csv('ability_flavor_text.csv'), itF = csv('item_flavor_text.csv');
const natId = Object.fromEntries(csv('natures.csv').map(r => [norm(r.identifier), r.id]));
const names = (rows, idKey, lg) => Object.fromEntries(rows.filter(r => r.local_language_id === lg).map(r => [r[idKey], r.name]));
const flav = (rows, idKey, lg) => { const o = {}; for (const r of rows) if (r.language_id === lg) { const k = r[idKey], v = +r.version_group_id; if (!o[k] || v >= o[k][0]) o[k] = [v, r.flavor_text.replace(/[\n\f­]+/g, ' ').replace(/\s+/g, ' ').trim()]; } return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v[1]])); };
const TYPES = { fr: { normal: 'Normal', fire: 'Feu', water: 'Eau', electric: 'Électrik', grass: 'Plante', ice: 'Glace', fighting: 'Combat', poison: 'Poison', ground: 'Sol', flying: 'Vol', psychic: 'Psy', bug: 'Insecte', rock: 'Roche', ghost: 'Spectre', dragon: 'Dragon', dark: 'Ténèbres', steel: 'Acier', fairy: 'Fée' },
  de: { normal: 'Normal', fire: 'Feuer', water: 'Wasser', electric: 'Elektro', grass: 'Pflanze', ice: 'Eis', fighting: 'Kampf', poison: 'Gift', ground: 'Boden', flying: 'Flug', psychic: 'Psycho', bug: 'Käfer', rock: 'Gestein', ghost: 'Geist', dragon: 'Drache', dark: 'Unlicht', steel: 'Stahl', fairy: 'Fee' } };
const spEn = names(spN, 'pokemon_species_id', LANG.en);
fs.mkdirSync('data/lang', { recursive: true });
for (const L of ['fr', 'de']) {
  const lg = LANG[L], out = { ty: TYPES[L], pk: names(spN, 'pokemon_species_id', lg), pe: spEn, mv: {}, ab: {}, it: {}, nat: {} };
  const mn = names(mvN, 'move_id', lg), an = names(abN, 'ability_id', lg), inn = names(itN, 'item_id', lg), nn = names(natN, 'nature_id', lg);
  const mf = flav(mvF, 'move_id', lg), af = flav(abF, 'ability_id', lg), itf = flav(itF, 'item_id', lg);
  const miss = { mv: [], ab: [], it: [], nat: [] };
  for (const k of Object.keys(dict.moves)) { const id = mvId[norm(k)]; if (id && mn[id]) out.mv[k] = [mn[id], mf[id] || '']; else miss.mv.push(k); }
  for (const k of Object.keys(dict.abilities)) { const id = abId[norm(k)]; if (id && an[id]) out.ab[k] = [an[id], af[id] || '']; else miss.ab.push(k); }
  for (const k of Object.keys(dict.items)) { const id = itId[norm(k)]; if (id && inn[id]) out.it[k] = [inn[id], itf[id] || '']; else miss.it.push(k); }
  for (const k of Object.keys(dict.natures)) { const id = natId[norm(k)]; if (id && nn[id]) out.nat[k] = nn[id]; else miss.nat.push(k); }
  fs.writeFileSync(`data/lang/${L}.json`, JSON.stringify(out));
  console.log(L, 'pk', Object.keys(out.pk).length, 'mv', Object.keys(out.mv).length, 'ab', Object.keys(out.ab).length, 'it', Object.keys(out.it).length, 'nat', Object.keys(out.nat).length, 'faltan', Object.fromEntries(Object.entries(miss).map(([k, v]) => [k, v.length + (v.length ? ':' + v.slice(0, 8).join(',') : '')])));
}
