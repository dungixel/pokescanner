// Genera los JSON estáticos que consume la web (carpeta ./data).
//   data/index.json          → lista ligera de Pokémon (buscador, filtros, aleatorios)
//   data/learners.json       → qué Pokémon aprenden cada movimiento
//   data/abilities.json      → qué Pokémon tienen cada habilidad
//   data/items.json          → qué Pokémon llevan cada objeto en sus builds
//   data/dict.json           → movimientos, habilidades, objetos y naturalezas (nombre + descripción en español)
//   data/pokemon/<id>.json   → ficha completa de cada Pokémon
//
// Fuentes: @pkmn/dex + @pkmn/data (datos de Pokémon Showdown), sets de Smogon (raw/smogon-gen9.json)
// y tablas CSV de PokeAPI para el español (raw/*.csv).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Dex, toID } from '@pkmn/dex';
import { Generations } from '@pkmn/data';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'raw');
const OUT = path.join(ROOT, 'data');

// ───────────────────────── CSV ─────────────────────────
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...rest] = rows;
  return rest.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((k, i) => [k, r[i]])));
}
const csv = name => parseCSV(fs.readFileSync(path.join(RAW, `${name}.csv`), 'utf8'));
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const cleanText = s => s.replace(/­\s*\n/g, '').replace(/[­]/g, '').replace(/[\n\f\r]+/g, ' ').replace(/\s+/g, ' ').trim();
const ES = '7'; // language_id del español en PokeAPI
const EN = '9'; // language_id del inglés en PokeAPI

// nombres + descripción más reciente en español de una entidad
function loadEntity({ table, nameTable, flavorTable, idCol }) {
  const idToKey = new Map(), keyToId = new Map(), keyToIdent = new Map();
  for (const r of csv(table)) { const k = norm(r.identifier); idToKey.set(r.id, k); keyToId.set(k, r.id); keyToIdent.set(k, r.identifier); }
  const names = new Map();
  for (const r of csv(nameTable)) if (r.local_language_id === ES) names.set(idToKey.get(r[idCol]), r.name);
  const flavor = new Map(), best = new Map(), flavorEN = new Map(), bestEN = new Map();
  for (const r of csv(flavorTable)) {
    const k = idToKey.get(r[idCol]);
    const vg = Number(r.version_group_id);
    if (r.language_id === ES && (!best.has(k) || vg >= best.get(k))) { best.set(k, vg); flavor.set(k, cleanText(r.flavor_text)); }
    if (r.language_id === EN && (!bestEN.has(k) || vg >= bestEN.get(k))) { bestEN.set(k, vg); flavorEN.set(k, cleanText(r.flavor_text)); }
  }
  return { names, flavor, flavorEN, ident: keyToIdent };
}

console.log('Leyendo tablas de PokeAPI…');
const moveES = loadEntity({ table: 'moves', nameTable: 'move_names', flavorTable: 'move_flavor_text', idCol: 'move_id' });
const abilityES = loadEntity({ table: 'abilities', nameTable: 'ability_names', flavorTable: 'ability_flavor_text', idCol: 'ability_id' });
const itemES = loadEntity({ table: 'items', nameTable: 'item_names', flavorTable: 'item_flavor_text', idCol: 'item_id' });

const speciesNameES = new Map();
for (const r of csv('pokemon_species_names')) if (r.local_language_id === ES) speciesNameES.set(Number(r.pokemon_species_id), r.name);

const pokeapiIds = new Map(); // identificador normalizado → id de PokeAPI (para sprites)
const pokeapiInfo = new Map(); // id de PokeAPI → altura (m) y peso (kg)
for (const r of csv('pokemon')) {
  pokeapiIds.set(norm(r.identifier), Number(r.id));
  pokeapiInfo.set(Number(r.id), { h: Number(r.height) / 10, w: Number(r.weight) / 10 });
}
const pokeapiKeys = [...pokeapiIds.keys()];

// ───────────────────────── Traducciones fijas ─────────────────────────
const NATURES_ES = {
  hardy: 'Fuerte', lonely: 'Huraña', brave: 'Audaz', adamant: 'Firme', naughty: 'Pícara',
  bold: 'Osada', docile: 'Dócil', relaxed: 'Plácida', impish: 'Agitada', lax: 'Floja',
  timid: 'Miedosa', hasty: 'Activa', serious: 'Seria', jolly: 'Alegre', naive: 'Ingenua',
  modest: 'Modesta', mild: 'Afable', quiet: 'Mansa', bashful: 'Rara', rash: 'Alocada',
  calm: 'Serena', gentle: 'Amable', sassy: 'Grosera', careful: 'Cauta', quirky: 'Extraña',
};
const STAT_ES = { hp: 'PS', atk: 'Ataque', def: 'Defensa', spa: 'At. Esp.', spd: 'Def. Esp.', spe: 'Velocidad' };
const TYPE_ES = {
  Normal: 'Normal', Fire: 'Fuego', Water: 'Agua', Electric: 'Eléctrico', Grass: 'Planta', Ice: 'Hielo',
  Fighting: 'Lucha', Poison: 'Veneno', Ground: 'Tierra', Flying: 'Volador', Psychic: 'Psíquico', Bug: 'Bicho',
  Rock: 'Roca', Ghost: 'Fantasma', Dragon: 'Dragón', Dark: 'Siniestro', Steel: 'Acero', Fairy: 'Hada', Stellar: 'Astral',
};

const FORME_ES = {
  Alola: 'de Alola', Galar: 'de Galar', Hisui: 'de Hisui', Paldea: 'de Paldea',
  'Paldea-Combat': 'de Paldea (Combatiente)', 'Paldea-Blaze': 'de Paldea (Ardiente)', 'Paldea-Aqua': 'de Paldea (Acuática)',
  Attack: 'Forma Ataque', Defense: 'Forma Defensa', Speed: 'Forma Velocidad',
  Heat: 'Calor', Wash: 'Lavado', Frost: 'Frío', Fan: 'Ventilador', Mow: 'Corte',
  Origin: 'Forma Origen', Sky: 'Forma Cielo', Therian: 'Forma Tótem', Black: 'Negro', White: 'Blanco',
  Pirouette: 'Forma Pirueta', Unbound: 'Forma Desatada', 'Pom-Pom': 'Estilo Animado', "Pa'u": 'Estilo Plácido', Sensu: 'Estilo Refinado',
  Dusk: 'Forma Crepuscular', Midnight: 'Forma Nocturna', 'Dusk-Mane': 'Melena Crepuscular', 'Dawn-Wings': 'Alas del Alba',
  Meteor: 'Forma Meteoro', 'Low-Key': 'Forma Grave', Noice: 'Cara Deshielo', 'Rapid-Strike': 'Estilo Fluido',
  Ice: 'Jinete Glacial', Shadow: 'Jinete Espectral', Bloodmoon: 'Luna Carmesí', F: 'Hembra', Hero: 'Forma Heroica',
  Roaming: 'Forma Andante', Terastal: 'Forma Teracristal', Stellar: 'Forma Astral',
  // formas de generaciones anteriores
  Primal: 'Primigenio', Zen: 'Modo Daruma', 'Galar-Zen': 'de Galar (Modo Daruma)', Complete: 'Forma Completa', '10%': 'Forma 10%',
  Blade: 'Forma Filo', School: 'Forma Banco', Ash: 'Ash', Small: 'Tamaño Pequeño', Large: 'Tamaño Grande', Super: 'Tamaño Supremo',
  Sandy: 'Manto Arena', Trash: 'Manto Basura', Sunny: 'Forma Sol', Rainy: 'Forma Lluvia', Snowy: 'Forma Nieve',
};
const FORME_OVERRIDE = {
  'Zacian-Crowned': 'Zacian Espada Suprema', 'Zamazenta-Crowned': 'Zamazenta Escudo Supremo',
  'Hoopa-Unbound': 'Hoopa Desatado', 'Kyurem-Black': 'Kyurem Negro', 'Kyurem-White': 'Kyurem Blanco',
};

function nameES(s) {
  if (FORME_OVERRIDE[s.name]) return FORME_OVERRIDE[s.name];
  const base = speciesNameES.get(s.num) || s.baseSpecies;
  if (!s.forme) return s.baseSpecies === s.name ? base : s.name;
  const mega = /^Mega(?:-([XY]))?$/.exec(s.forme);
  if (mega) return `Mega-${base}${mega[1] ? ' ' + mega[1] : ''}`;
  if (s.forme === 'Ultra') return `Ultra-${base}`;
  if (s.baseSpecies === 'Ogerpon' && s.requiredItem) {
    const it = itemES.names.get(toID(s.requiredItem));
    if (it) return `${base} ${it.replace(/^Máscara /, 'Máscara ')}`;
  }
  const f = FORME_ES[s.forme];
  if (!f) return `${base} (${s.forme})`;
  return /^de /.test(f) ? `${base} ${f}` : `${base} ${f}`;
}

// ───────────────────────── Showdown / Smogon ─────────────────────────
const gen = new Generations(Dex).get(9);

// Formas que solo son cosméticas o duplicadas de otra: no aportan una ficha propia
const SKIP = [
  /^Pikachu-/, /^Arceus-/, /^Vivillon-/, /^Squawkabilly-/, /^Basculin-/, /^Tatsugiri-/, /^Cramorant-/,
  /^Ogerpon-.*-Tera$/, /^Ogerpon-Teal-Tera$/,
  /^Keldeo-Resolute$/, /^Magearna-Original$/, /^Greninja-Bond$/, /^Maushold-Four$/, /^Dudunsparce-Three-Segment$/,
  /^Sinistea-Antique$/, /^Polteageist-Antique$/, /^Rockruff-Dusk$/, /^Poltchageist-Artisan$/, /^Sinistcha-Masterpiece$/,
  /^Zarude-Dada$/, /^Mimikyu-Busted$/, /^Morpeko-Hangry$/,
];
const gen9Species = [...gen.species].filter(s => !s.isNonstandard && !SKIP.some(r => r.test(s.name)));

// Pokémon que ya no están en Gen 9 (Showdown los marca "Past"): se añaden con el rango de la última
// generación en la que tuvieron uno. Se descartan formas de combate o cosméticas sin ficha propia.
const OLD_SKIP = [/-Gmax$/, /-Eternamax$/, /-Totem$/, /-Starter$/, /^Silvally-/, /^Pichu-Spiky-eared$/, /^Floette-Eternal$/];
const dexByGen = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map(g => [g, Dex.forGen(g)]));
const NO_TIER = new Set(['Illegal', 'Unreleased', '']);
function oldRank(s) {
  const all = []; // rango en cada generación, de la más reciente a la más antigua
  for (let g = 8; g >= 1; g--) {
    const x = dexByGen[g].species.get(s.id);
    if (x.exists && !x.isNonstandard && x.tier && !NO_TIER.has(x.tier)) all.push([g, x.tier.replace(/^\((.*)\)$/, '$1')]);
  }
  return all.length ? { r: all[0][1], g: all[0][0], all } : null;
}
const sameStats = (a, b) => a.baseStats.hp === b.baseStats.hp && a.baseStats.atk === b.baseStats.atk && a.baseStats.def === b.baseStats.def &&
  a.baseStats.spa === b.baseStats.spa && a.baseStats.spd === b.baseStats.spd && a.baseStats.spe === b.baseStats.spe;
const gen9Ids = new Set(gen9Species.map(s => s.id));
const oldInfo = new Map();
const oldSpecies = [...Dex.forGen(9).species.all()].filter(s => {
  if (!s.exists || gen9Ids.has(s.id) || !['Past', 'LGPE'].includes(s.isNonstandard)) return false;
  if (SKIP.some(r => r.test(s.name)) || OLD_SKIP.some(r => r.test(s.name))) return false;
  if (s.forme) { // forma idéntica a la base (solo cambia el aspecto): sin ficha propia
    const b = Dex.species.get(s.baseSpecies);
    if (b.exists && s.types.join() === b.types.join() && sameStats(s, b)) return false;
  }
  const info = oldRank(s);
  if (!info) return false;
  oldInfo.set(s.id, info);
  return true;
});
const allSpecies = [...gen9Species, ...oldSpecies];
const keptIds = new Set(allSpecies.map(s => s.id));

const smogon = JSON.parse(fs.readFileSync(path.join(RAW, 'smogon-gen9.json'), 'utf8'));
const smogonById = new Map();
for (const [name, formats] of Object.entries(smogon)) {
  const sp = Dex.species.get(name);
  if (sp.exists) smogonById.set(sp.id, formats);
}
// formatos de Smogon que se muestran (en este orden de relevancia)
const FORMATS = ['ou', 'ubers', 'ubersuu', 'anythinggoes', 'uu', 'ru', 'nu', 'pu', 'zu', 'lc', 'nfe', 'doublesou', 'vgc2025', 'monotype'];

// traducciones propias para lo que PokeAPI aún no tiene en español (Gen 9)
const OVERRIDES = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'overrides-es.json'), 'utf8'));
// ids de Showdown que en PokeAPI se llaman distinto
const MOVE_ALIAS = { visegrip: 'vicegrip' };
const SPRITE_ALIAS = { miniormeteor: 'miniorredmeteor', necrozmaduskmane: 'necrozmadusk', necrozmadawnwings: 'necrozmadawn' };

// diccionarios compartidos (solo lo que se usa)
const dict = { moves: {}, abilities: {}, items: {}, natures: {} };
const missing = { move: new Set(), ability: new Set(), item: new Set(), moveDesc: new Set(), abilityDesc: new Set(), itemDesc: new Set(), cond: new Set() };

function addMove(name) {
  let m = gen.moves.get(name);
  if (!m?.exists) m = Dex.moves.get(name);
  const id = m?.exists ? m.id : toID(name);
  if (dict.moves[id]) return id;
  const key = MOVE_ALIAS[id] || id;
  const nameEs = moveES.names.get(key);
  if (!nameEs) missing.move.add(id);
  let d = moveES.flavor.get(key) || OVERRIDES.moves[id];
  let en = false;
  if (!d) { d = m?.shortDesc || m?.desc || ''; en = !!d; missing.moveDesc.add(id); }
  dict.moves[id] = {
    n: nameEs || m?.name || name, e: m?.name || name,
    t: (m?.type || 'Normal').toLowerCase(),
    c: m?.category === 'Physical' ? 'f' : m?.category === 'Special' ? 'e' : 's',
    p: m?.basePower || 0,
    a: m?.accuracy === true ? 0 : (m?.accuracy ?? 0),
    pp: m?.pp ? Math.floor(m.pp * 8 / 5) : 0, // PP máximos (3 PP extra)
    pr: m?.priority || 0,
    d, de: moveES.flavorEN.get(key) || m?.shortDesc || m?.desc || '', ...(en ? { en: 1 } : {}),
  };
  return id;
}
function addAbility(name) {
  let a = gen.abilities.get(name);
  if (!a?.exists) a = Dex.abilities.get(name);
  const id = a?.exists ? a.id : toID(name);
  if (dict.abilities[id]) return id;
  const nameEs = abilityES.names.get(id);
  if (!nameEs) missing.ability.add(id);
  let d = abilityES.flavor.get(id) || OVERRIDES.abilities[id];
  let en = false;
  if (!d) { d = a?.shortDesc || a?.desc || ''; en = !!d; missing.abilityDesc.add(id); }
  dict.abilities[id] = { n: nameEs || a?.name || name, e: a?.name || name, d, de: abilityES.flavorEN.get(id) || a?.shortDesc || a?.desc || '', ...(en ? { en: 1 } : {}) };
  return id;
}
function addItem(name) {
  let it = gen.items.get(name);
  if (!it?.exists) it = Dex.items.get(name);
  const id = it?.exists ? it.id : toID(name);
  if (dict.items[id]) return id;
  if (id === 'noitem') { dict.items[id] = { n: 'Sin objeto', e: 'No Item', d: OVERRIDES.items.noitem, de: 'No held item.', i: null }; return id; }
  const nameEs = itemES.names.get(id);
  if (!nameEs) missing.item.add(id);
  let d = itemES.flavor.get(id) || OVERRIDES.items[id];
  let en = false;
  if (!d) { d = it?.shortDesc || it?.desc || ''; en = !!d; missing.itemDesc.add(id); }
  dict.items[id] = { n: nameEs || it?.name || name, e: it?.name || name, d, de: itemES.flavorEN.get(id) || it?.shortDesc || it?.desc || '', i: itemES.ident.get(id) || null, ...(en ? { en: 1 } : {}) };
  return id;
}
function addNature(name) {
  const id = toID(name);
  if (dict.natures[id]) return id;
  const n = gen.natures.get(id);
  dict.natures[id] = { n: NATURES_ES[id] || name, e: n?.name || name, plus: n?.plus || null, minus: n?.minus || null };
  return id;
}

// ───────────────────────── Evoluciones ─────────────────────────
const COND_ES = {
  'during the day': 'de día', 'at night': 'de noche', 'at dusk': 'al atardecer', 'in the daytime': 'de día',
  'with high Friendship': 'con mucha amistad', 'with high friendship': 'con mucha amistad',
  'Level up with 999 Coins in the bag': 'Subir de nivel con 999 monedas en la bolsa (Gimmighoul)',
  'Defeat 3 Bisharp leading Pawniard and level-up': 'Subir de nivel tras derrotar a 3 Bisharp líderes con un Pawniard',
  'Use Rage Fist 20 times and level-up': 'Usar Puño Furia 20 veces y subir de nivel',
  'in Legends: Arceus when there\'s a full moon': 'En Leyendas Pokémon: Arceus, con luna llena',
  'Take 49+ damage from attacks without fainting and walk under the stone bridge in Dusty Bowl': 'Recibir 49+ de daño sin debilitarse y pasar bajo el arco de piedra del Valle Polvoriento',
  'Level up in a Mt. Coronet': 'Subir de nivel en el Monte Corona',
  'Hit 3 critical hits in one battle and then walk under the stone bridge in Dusty Bowl': 'Dar 3 golpes críticos en un combate y pasar bajo el arco de piedra del Valle Polvoriento',
  'Walk 1,000 steps in Let\'s Go mode': 'Caminar 1.000 pasos en modo Vamos',
  'Level up with 3 Rage Fist': 'Subir de nivel',
};
Object.assign(COND_ES, OVERRIDES.evolutionConditions);
function condES(c) {
  if (!c) return '';
  if (COND_ES[c]) return COND_ES[c];
  const lc = c.toLowerCase();
  if (COND_ES[lc]) return COND_ES[lc];
  missing.cond.add(c);
  return c;
}

function howES(s) {
  const lv = s.evoLevel, cond = condES(s.evoCondition);
  const withCond = t => (cond ? `${t} (${cond})` : t);
  switch (s.evoType) {
    case 'useItem': return withCond(`Usar ${itemES.names.get(toID(s.evoItem)) || s.evoItem}`);
    case 'trade': return withCond(s.evoItem ? `Intercambio sujetando ${itemES.names.get(toID(s.evoItem)) || s.evoItem}` : 'Intercambio');
    case 'levelFriendship': return withCond('Subir de nivel con amistad');
    case 'levelHold': return withCond(`Subir de nivel sujetando ${itemES.names.get(toID(s.evoItem)) || s.evoItem}`);
    case 'levelMove': return withCond(`Subir de nivel conociendo ${moveES.names.get(toID(s.evoMove)) || s.evoMove}`);
    case 'levelExtra': return withCond(lv ? `Nivel ${lv}` : 'Subir de nivel');
    case 'other': return cond || 'Condición especial';
    default: return withCond(lv ? `Nivel ${lv}` : 'Subir de nivel');
  }
}

function howEN(s) {
  const lv = s.evoLevel, cond = s.evoCondition || '';
  const withCond = t => (cond ? `${t} (${cond})` : t);
  const item = id => Dex.items.get(id).name || id;
  switch (s.evoType) {
    case 'useItem': return withCond(`Use ${item(s.evoItem)}`);
    case 'trade': return withCond(s.evoItem ? `Trade holding ${item(s.evoItem)}` : 'Trade');
    case 'levelFriendship': return withCond('Level up with high friendship');
    case 'levelHold': return withCond(`Level up holding ${item(s.evoItem)}`);
    case 'levelMove': return withCond(`Level up knowing ${Dex.moves.get(s.evoMove).name || s.evoMove}`);
    case 'levelExtra': return withCond(lv ? `Level ${lv}` : 'Level up');
    case 'other': return cond || 'Special condition';
    default: return withCond(lv ? `Level ${lv}` : 'Level up');
  }
}

function evoTree(s) {
  let root = s;
  while (root.prevo && keptIds.has(toID(root.prevo))) root = Dex.species.get(root.prevo);
  const build = (sp, how) => {
    const node = { id: sp.id };
    if (how) { node.how = how; node.hx = howEN(sp); }
    const kids = (sp.evos || []).map(n => Dex.species.get(n)).filter(e => e && keptIds.has(e.id));
    if (kids.length) node.c = kids.map(e => build(e, howES(e)));
    return node;
  };
  return build(root, null);
}

// ───────────────────────── Sprites ─────────────────────────
function spriteId(s) {
  if (!s.forme) return s.num;
  const key = SPRITE_ALIAS[norm(s.name)] || norm(s.name);
  if (pokeapiIds.has(key)) return pokeapiIds.get(key);
  const cand = pokeapiKeys.filter(k => k.startsWith(key)).sort((a, b) => a.length - b.length)[0];
  return cand ? pokeapiIds.get(cand) : s.num;
}
const showdownSprite = s => s.name.toLowerCase().replace(/[^a-z0-9-]/g, '');

// ───────────────────────── Construcción ─────────────────────────
const arr = x => (Array.isArray(x) ? x : x == null ? [] : [x]);
const TIER_FORMAT = {
  AG: 'anythinggoes', Uber: 'ubers', OU: 'ou', UUBL: 'ou', UU: 'uu', RUBL: 'uu', RU: 'ru', NUBL: 'ru',
  NU: 'nu', PUBL: 'nu', PU: 'pu', ZUBL: 'pu', ZU: 'zu', NFE: 'nfe', LC: 'lc',
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'pokemon'), { recursive: true });
const SHARD = 60; // Pokémon por paquete (pocos archivos = fácil de subir a GitHub)
const details = new Map();

const index = [];
const noSprite = [];
let withSets = 0, withLevelMoves = 0;

for (const s of allSpecies) {
  const sid = spriteId(s);
  if (s.forme && sid === s.num) noSprite.push(s.name);
  const bs = s.baseStats;
  const old = oldInfo.get(s.id); // {r, g} solo para Pokémon fuera de Gen 9
  const tier = old ? old.r : s.tier;

  // movimientos por nivel (SV). Las formas sin learnset propio heredan el de la especie base.
  let ls = await gen.learnsets.get(s.id);
  if (!ls?.learnset) ls = await gen.learnsets.get(toID(s.baseSpecies));
  const lv = [];
  // Gen 9: movimientos de SV. Fuera de Gen 9: los de la última generación donde aprendía movimientos por nivel.
  let lg = 9;
  if (old) {
    lg = 0;
    for (const src of Object.values(ls?.learnset || {})) for (const code of src) { const m = /^(\d)L\d+$/.exec(code); if (m) lg = Math.max(lg, Number(m[1])); }
  }
  for (const [mv, src] of Object.entries(ls?.learnset || {})) {
    for (const code of src) {
      const m = /^(\d)L(\d+)$/.exec(code);
      if (m && Number(m[1]) === lg) lv.push([Number(m[2]), mv]);
    }
  }
  lv.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
  const seen = new Set();
  const levelMoves = lv.filter(([l, mv]) => (seen.has(`${l}-${mv}`) ? false : seen.add(`${l}-${mv}`))).map(([l, mv]) => [l, addMove(mv)]);
  if (levelMoves.length) withLevelMoves++;

  // habilidades
  const abilities = Object.entries(s.abilities).map(([slot, name]) => ({ id: addAbility(name), ...(slot === 'H' ? { h: 1 } : {}) }));

  // sets de Smogon
  const fm = smogonById.get(s.id) || {};
  const preferred = TIER_FORMAT[tier];
  const order = [...new Set([preferred, ...FORMATS])].filter(f => f && fm[f]);
  const sets = [];
  for (const f of order) {
    for (const [setName, set] of Object.entries(fm[f])) {
      sets.push({
        f, n: setName,
        m: arr(set.moves).map(slot => arr(slot).map(addMove)),
        a: arr(set.ability).map(addAbility),
        i: arr(set.item).map(addItem),
        na: arr(set.nature).map(addNature),
        ev: set.evs || {},
        te: arr(set.teratypes).map(t => t.toLowerCase()),
      });
    }
  }
  if (sets.length) withSets++;

  const types = s.types.map(t => t.toLowerCase());
  const doublesTier = !old && s.doublesTier && s.doublesTier !== s.tier ? s.doublesTier : null;
  const entry = { id: s.id, num: s.num, es: nameES(s), en: s.name, t: types, r: tier, s: [bs.hp, bs.atk, bs.def, bs.spa, bs.spd, bs.spe], sp: sid, ss: showdownSprite(s) };
  if (s.forme) entry.fm = 1;
  if (old) entry.g = old.g;
  if (sets.length) entry.ns = sets.length; // nº de builds de Smogon (sirve para ordenar "los mejores" de un rango)
  index.push(entry);

  const detail = {
    id: s.id, num: s.num, es: entry.es, en: s.name, t: types, r: tier, ...(old ? { g: old.g, lg, gt: old.all } : {}), ...(doublesTier ? { dr: doublesTier } : {}),
    s: entry.s, h: pokeapiInfo.get(sid)?.h ?? pokeapiInfo.get(s.num)?.h ?? null, w: s.weightkg || pokeapiInfo.get(sid)?.w || null, sp: sid, ss: entry.ss,
    ab: abilities, lv: levelMoves, sets, evo: evoTree(s),
  };
  if (detail.h != null) entry.h = detail.h; // altura y peso también en el índice: sirven para ordenar la lista
  if (detail.w != null) entry.w = detail.w;
  details.set(s.id, detail);
}

index.sort((a, b) => a.num - b.num || (a.fm || 0) - (b.fm || 0));
// fichas agrupadas en paquetes: data/pokemon/<k>.json = { id: ficha, ... }
index.forEach((e, i) => { e.k = Math.floor(i / SHARD); });
for (let k = 0; k * SHARD < index.length; k++) {
  const bundle = {};
  for (const e of index.slice(k * SHARD, (k + 1) * SHARD)) bundle[e.id] = details.get(e.id);
  fs.writeFileSync(path.join(OUT, 'pokemon', `${k}.json`), JSON.stringify(bundle));
}
// quién aprende cada movimiento y quién tiene cada habilidad: id → posiciones en index.json
//   learners[m] = { s: [[pos, setsQueLoUsan, setsTotales]], l: [pos] }  (s = lo llevan en algún build de Smogon; l = solo lo aprenden por nivel)
//   abilities[a] = { s: [[pos, setsQueLaUsan, setsTotales]], n: [pos], h: [pos] }  (n = habilidad normal, h = oculta; s = la usan en algún build)
const learners = {}, abilities = {}, items = {};
index.forEach((e, i) => {
  const d = details.get(e.id);
  const total = d.sets.length;
  const useM = {}, useA = {}, useI = {};
  d.sets.forEach(st => {
    new Set(st.m.flat()).forEach(m => { useM[m] = (useM[m] || 0) + 1; });
    new Set(st.a || []).forEach(a => { useA[a] = (useA[a] || 0) + 1; });
    new Set(st.i || []).forEach(x => { useI[x] = (useI[x] || 0) + 1; });
  });
  for (const m of Object.keys(useM)) ((learners[m] ||= { s: [], l: [] }).s.push([i, useM[m], total]));
  new Set(d.lv.map(x => x[1])).forEach(m => { if (!useM[m]) (learners[m] ||= { s: [], l: [] }).l.push(i); });
  for (const a of Object.keys(useA)) ((abilities[a] ||= { s: [], n: [], h: [] }).s.push([i, useA[a], total]));
  for (const x of Object.keys(useI)) (items[x] ||= []).push([i, useI[x], total]);
  d.ab.forEach(x => (abilities[x.id] ||= { s: [], n: [], h: [] })[x.h ? 'h' : 'n'].push(i));
});
fs.writeFileSync(path.join(OUT, 'learners.json'), JSON.stringify(learners));
fs.writeFileSync(path.join(OUT, 'abilities.json'), JSON.stringify(abilities));
fs.writeFileSync(path.join(OUT, 'items.json'), JSON.stringify(items));
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
fs.writeFileSync(path.join(OUT, 'dict.json'), JSON.stringify(dict));
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ generado: new Date().toISOString(), pokemon: index.length, fuente: 'Pokémon Showdown (@pkmn/dex) · Smogon (pkmn/smogon) · PokeAPI (español)' }));

// ───────────────────────── Informe ─────────────────────────
const kb = f => (fs.statSync(f).size / 1024).toFixed(0);
console.log(`\n✓ ${index.length} Pokémon · ${withSets} con sets de Smogon · ${withLevelMoves} con movimientos por nivel`);
console.log(`✓ ${Object.keys(dict.moves).length} movimientos · ${Object.keys(dict.abilities).length} habilidades · ${Object.keys(dict.items).length} objetos`);
console.log(`  index.json ${kb(path.join(OUT, 'index.json'))} KB · dict.json ${kb(path.join(OUT, 'dict.json'))} KB`);
const show = (label, set) => set.size && console.log(`  ⚠ ${label} (${set.size}): ${[...set].slice(0, 25).join(', ')}`);
show('Formas sin sprite propio (usan el de la especie base)', new Set(noSprite));
show('Movimientos sin nombre en español', missing.move);
show('Habilidades sin nombre en español', missing.ability);
show('Objetos sin nombre en español', missing.item);
show('Movimientos con descripción en inglés', missing.moveDesc);
show('Habilidades con descripción en inglés', missing.abilityDesc);
show('Objetos con descripción en inglés', missing.itemDesc);
show('Condiciones de evolución sin traducir', missing.cond);
