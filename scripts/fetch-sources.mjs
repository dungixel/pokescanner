// Descarga las fuentes externas a ./raw (no se sube a GitHub, está en .gitignore).
//  - Sets de Smogon (pkmn/smogon): movimientos, habilidad, objeto y naturaleza recomendados
//  - Tablas CSV de PokeAPI: nombres y descripciones en español
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'raw');

const SMOGON = 'https://raw.githubusercontent.com/pkmn/smogon/main/data/sets/gen9.json';
const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const CSVS = [
  'pokemon', 'pokemon_species_names', 'pokemon_species', 'pokemon_stats', 'pokemon_egg_groups', 'egg_groups', 'egg_group_prose', 'stats', 'moves', 'move_names', 'move_flavor_text',
  'abilities', 'ability_names', 'ability_flavor_text', 'items', 'item_names', 'item_flavor_text',
  // dónde capturarlos
  'encounters', 'encounter_slots', 'encounter_methods', 'encounter_method_prose', 'encounter_conditions', 'encounter_condition_values', 'encounter_condition_value_prose',
  'encounter_condition_value_map', 'location_areas', 'location_area_prose', 'locations', 'location_names', 'regions', 'region_names', 'versions', 'version_names', 'version_groups',
];

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} al descargar ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(path.join(RAW, file), buf);
  console.log(`✓ ${file} (${(buf.length / 1024).toFixed(0)} KB)`);
}

// PKHeX (kwsch/PKHeX): encuentros de Escarlata/Púrpura, Diamante/Perla Reluciente, Leyendas Arceus y Z-A, y los textos oficiales de lugares (es/en)
const PKHEX = 'https://raw.githubusercontent.com/kwsch/PKHeX/master/PKHeX.Core/Resources';
const PKX_WILD = ['Gen9/encounter_wild_paldea', 'Gen9/encounter_za', 'Gen9/encounter_hyperspace_za', 'Gen8/encounter_bd', 'Gen8/encounter_sp', 'Gen8/encounter_la'];
const PKX_TEXT = ['gen2/text_gsc', 'gen3/text_rsefrlg', 'gen3/text_cxd', 'gen4/text_hgss', 'gen5/text_bw2', 'gen6/text_xy', 'gen7/text_sm', 'gen7/text_gg', 'gen8/text_swsh', 'gen8a/text_la', 'gen8b/text_bdsp', 'gen9/text_sv', 'gen9a/text_za'];

await fs.mkdir(RAW, { recursive: true });
await fs.mkdir(path.join(RAW, 'pkhex'), { recursive: true });
await download(SMOGON, 'smogon-gen9.json');
for (let g = 8; g >= 1; g--) await download(SMOGON.replace('gen9', `gen${g}`), `smogon-gen${g}.json`); // generaciones anteriores (respaldo para los Pokémon sin sets en Gen 9)
for (const name of CSVS) await download(`${POKEAPI}/${name}.csv`, `${name}.csv`);
for (const f of PKX_WILD) await download(`${PKHEX}/legality/wild/${f}.pkl`, `pkhex/${path.basename(f)}.pkl`);
for (const f of PKX_TEXT) for (const l of ['en', 'es']) await download(`${PKHEX}/text/locations/${f}_00000_${l}.txt`, `pkhex/${path.basename(f)}_${l}.txt`);
console.log('Listo. Ahora ejecuta: npm run build');
