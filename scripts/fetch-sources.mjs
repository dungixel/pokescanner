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
  'pokemon', 'pokemon_species_names', 'moves', 'move_names', 'move_flavor_text',
  'abilities', 'ability_names', 'ability_flavor_text', 'items', 'item_names', 'item_flavor_text',
];

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} al descargar ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(path.join(RAW, file), buf);
  console.log(`✓ ${file} (${(buf.length / 1024).toFixed(0)} KB)`);
}

await fs.mkdir(RAW, { recursive: true });
await download(SMOGON, 'smogon-gen9.json');
for (const name of CSVS) await download(`${POKEAPI}/${name}.csv`, `${name}.csv`);
console.log('Listo. Ahora ejecuta: npm run build');
