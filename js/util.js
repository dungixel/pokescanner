// Constantes y utilidades compartidas
import { lang, t } from './i18n.js';

export const SPR = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';

export const TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];
export const TYPE_ID = { normal: 1, fighting: 2, flying: 3, poison: 4, ground: 5, rock: 6, bug: 7, ghost: 8, steel: 9,
  fire: 10, water: 11, grass: 12, electric: 13, psychic: 14, ice: 15, dragon: 16, dark: 17, fairy: 18 };
export const TYPE_ES = { normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta', ice: 'Hielo',
  fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho', rock: 'Roca',
  ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro', steel: 'Acero', fairy: 'Hada', stellar: 'Astral' };
export const TYPE_EN = { normal: 'Normal', fire: 'Fire', water: 'Water', electric: 'Electric', grass: 'Grass', ice: 'Ice',
  fighting: 'Fighting', poison: 'Poison', ground: 'Ground', flying: 'Flying', psychic: 'Psychic', bug: 'Bug', rock: 'Rock',
  ghost: 'Ghost', dragon: 'Dragon', dark: 'Dark', steel: 'Steel', fairy: 'Fairy', stellar: 'Stellar' };
export const typeName = ty => ((lang() === 'en' ? TYPE_EN : TYPE_ES)[ty] || ty);
export const TYPE_COLOR = { normal: '#9DA0AA', fire: '#F5793A', water: '#4D90E8', electric: '#F2C230', grass: '#5DBE62',
  ice: '#6CD0D6', fighting: '#D0453F', poison: '#A653C8', ground: '#D8A64F', flying: '#8FA6F0', psychic: '#F25F8F',
  bug: '#9BBA22', rock: '#B8A55B', ghost: '#6A5DB5', dragon: '#5B6CF0', dark: '#6A5A55', steel: '#7FA3B5', fairy: '#EC8FE6',
  stellar: '#4CC9C0' };

export const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const statName = k => t(`stat_${k}`);
export const catName = c => t(`cat_${c}`);

// Tabla de tipos (generación 9): atacante → defensores
const CHART = {
  normal: { half: ['rock', 'steel'], none: ['ghost'] },
  fire: { sup: ['grass', 'ice', 'bug', 'steel'], half: ['fire', 'water', 'rock', 'dragon'] },
  water: { sup: ['fire', 'ground', 'rock'], half: ['water', 'grass', 'dragon'] },
  electric: { sup: ['water', 'flying'], half: ['electric', 'grass', 'dragon'], none: ['ground'] },
  grass: { sup: ['water', 'ground', 'rock'], half: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'] },
  ice: { sup: ['grass', 'ground', 'flying', 'dragon'], half: ['fire', 'water', 'ice', 'steel'] },
  fighting: { sup: ['normal', 'ice', 'rock', 'dark', 'steel'], half: ['poison', 'flying', 'psychic', 'bug', 'fairy'], none: ['ghost'] },
  poison: { sup: ['grass', 'fairy'], half: ['poison', 'ground', 'rock', 'ghost'], none: ['steel'] },
  ground: { sup: ['fire', 'electric', 'poison', 'rock', 'steel'], half: ['grass', 'bug'], none: ['flying'] },
  flying: { sup: ['grass', 'fighting', 'bug'], half: ['electric', 'rock', 'steel'] },
  psychic: { sup: ['fighting', 'poison'], half: ['psychic', 'steel'], none: ['dark'] },
  bug: { sup: ['grass', 'psychic', 'dark'], half: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'] },
  rock: { sup: ['fire', 'ice', 'flying', 'bug'], half: ['fighting', 'ground', 'steel'] },
  ghost: { sup: ['psychic', 'ghost'], half: ['dark'], none: ['normal'] },
  dragon: { sup: ['dragon'], half: ['steel'], none: ['fairy'] },
  dark: { sup: ['psychic', 'ghost'], half: ['fighting', 'dark', 'fairy'] },
  steel: { sup: ['ice', 'rock', 'fairy'], half: ['fire', 'water', 'electric', 'steel'] },
  fairy: { sup: ['fighting', 'dragon', 'dark'], half: ['fire', 'poison', 'steel'] },
};

/** Multiplicador de daño que recibe un Pokémon de los tipos dados, por cada tipo atacante. */
export function matchups(defTypes) {
  const out = {};
  for (const atk of TYPES) {
    const c = CHART[atk];
    let m = 1;
    for (const d of defTypes) {
      if (c.none?.includes(d)) m *= 0;
      else if (c.sup?.includes(d)) m *= 2;
      else if (c.half?.includes(d)) m *= 0.5;
    }
    (out[m] ||= []).push(atk);
  }
  return out;
}

// Rangos competitivos
const T = (n, d) => ({ n, d });
export const TIER = {
  AG: T('Anything Goes', 'Sin restricciones: aquí compiten incluso los Pokémon prohibidos en Ubers.'),
  Uber: T('Ubers', 'Pokémon tan potentes que están prohibidos en OU. Es el escalón más alto de uso habitual.'),
  OU: T('OverUsed', 'El tier principal del juego competitivo: los Pokémon más usados de la ladder.'),
  UUBL: T('UU borderline', 'Demasiado fuertes para UU, pero con menos uso que los de OU. Se les puede ver en ambos.'),
  UU: T('UnderUsed', 'Los Pokémon que quedan justo por debajo del uso de OU.'),
  RUBL: T('RU borderline', 'Demasiado fuertes para RU, pero sin llegar al uso de UU.'),
  RU: T('RarelyUsed', 'Pokémon con uso medio-bajo en la ladder. Muchos son opciones muy sólidas.'),
  NUBL: T('NU borderline', 'Demasiado fuertes para NU, pero sin llegar al uso de RU.'),
  NU: T('NeverUsed', 'Pokémon de poco uso en los tiers altos.'),
  PUBL: T('PU borderline', 'Demasiado fuertes para PU, pero sin llegar al uso de NU.'),
  PU: T('PartiallyUsed', 'Pokémon de uso bajo; el tier ideal para equipos poco convencionales.'),
  ZUBL: T('ZU borderline', 'Demasiado fuertes para ZU, pero sin llegar al uso de PU.'),
  ZU: T('ZeroUsed', 'Los Pokémon con menos uso del formato.'),
  LC: T('Little Cup', 'Formato donde solo compiten Pokémon de nivel 5 que aún pueden evolucionar.'),
  NFE: T('Not Fully Evolved', 'Pokémon que aún pueden evolucionar y no tienen tier propio (solo se usan en LC o con Mineral Evolutivo).'),
};
const TIER_DESC_EN = {
  AG: 'No restrictions: even Pokémon banned from Ubers compete here.',
  Uber: 'Pokémon so powerful they are banned from OU. The highest tier in regular use.',
  OU: 'The main competitive tier: the most used Pokémon on the ladder.',
  UUBL: 'Too strong for UU, but used less than OU Pokémon. You may see them in both.',
  UU: 'Pokémon just below OU in usage.',
  RUBL: 'Too strong for RU, but not as used as UU.',
  RU: 'Mid-to-low usage on the ladder. Many are very solid picks.',
  NUBL: 'Too strong for NU, but not as used as RU.',
  NU: 'Pokémon with low usage in the higher tiers.',
  PUBL: 'Too strong for PU, but not as used as NU.',
  PU: 'Low-usage Pokémon; the ideal tier for unconventional teams.',
  ZUBL: 'Too strong for ZU, but not as used as PU.',
  ZU: 'The least-used Pokémon of the format.',
  LC: 'A format where only level 5 Pokémon that can still evolve compete.',
  NFE: 'Pokémon that can still evolve and have no tier of their own (only used in LC or with an Eviolite).',
};
/** Nombre y descripción de un rango en el idioma actual */
export const tierInfo = r => { const x = TIER[r]; return x ? { n: x.n, d: lang() === 'en' ? TIER_DESC_EN[r] : x.d } : null; };
export const TIER_ORDER = ['AG', 'Uber', 'OU', 'UUBL', 'UU', 'RUBL', 'RU', 'NUBL', 'NU', 'PUBL', 'PU', 'ZUBL', 'ZU', 'LC', 'NFE'];
// Posición en la escala de fuerza: 1 = el más fuerte. LC y NFE no entran en la escala.
export const TIER_RANK = { AG: 1, Uber: 2, OU: 3, UUBL: 4, UU: 5, RUBL: 6, RU: 7, NUBL: 8, NU: 9, PUBL: 10, PU: 11, ZUBL: 12, ZU: 13 };
export const TIER_MAX = 13;
export const tierNum = r => TIER_RANK[String(r).replace(/^\((.*)\)$/, '$1')] || 0;
export const tierNumHTML = r => (tierNum(r) ? `<b class="tn" style="--tier:${tierColor(r)}">${tierNum(r)}</b>` : '');
export const tierLabel = r => String(r).replace('Uber', 'Ubers').replace(/^\((.*)\)$/, '$1');
const TIER_HUE = { AG: '#8B5CF6', Uber: '#8B5CF6', OU: '#4D7CF0', UU: '#1FA8A0', RU: '#3DAA5C', NU: '#C9A227', PU: '#E8833A', ZU: '#8A91A3', LC: '#E36AA0', NFE: '#A79B8A' };
export const tierColor = r => TIER_HUE[String(r).replace(/BL$/, '')] || '#8A91A3';

const FORMAT_NAME = { ou: 'OU', ubers: 'Ubers', ubersuu: 'Ubers UU', anythinggoes: 'AG', uu: 'UU', ru: 'RU', nu: 'NU', pu: 'PU', zu: 'ZU',
  lc: 'LC', nfe: 'NFE', vgc2025: 'VGC 2025', monotype: 'Monotype' };
export const formatName = f => (f === 'doublesou' ? t('fmt_doublesou') : FORMAT_NAME[f] || f);

// ───────── nombres según el idioma ─────────
export const pname = p => (lang() === 'en' ? p.en : p.es);
/** el nombre en el otro idioma (para mostrarlo debajo) */
export const pname2 = p => (lang() === 'en' ? p.es : p.en);
/** nombre y descripción de movimientos, habilidades, objetos y naturalezas */
export const dn = x => (lang() === 'en' ? x.e : x.n);
export const dn2 = x => (lang() === 'en' ? x.n : x.e);
export const dd = x => (lang() === 'en' ? (x.de || x.d) : x.d);
export const how = n => (lang() === 'en' ? (n.hx || n.how) : n.how);

// ───────── utilidades de texto ─────────
const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ENT[c]);
/** Normaliza para buscar: sin tildes, mayúsculas ni signos */
export const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const dexNum = n => '#' + String(n).padStart(4, '0');
export const fmtNum = n => (lang() === 'en' ? String(n) : String(n).replace('.', ','));

export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
};

// ───────── imágenes ─────────
export const smallSprite = p => `${SPR}/pokemon/${p.sp}.png`;
export const artSprite = p => `${SPR}/pokemon/other/official-artwork/${p.sp}.png`;
const showdownSprite = p => `https://play.pokemonshowdown.com/sprites/gen5/${p.ss}.png`;
export const spriteChain = (p, kind) => (kind === 'art'
  ? [artSprite(p), `${SPR}/pokemon/other/home/${p.sp}.png`, showdownSprite(p)]
  : [smallSprite(p), artSprite(p), showdownSprite(p)]);

/** <img> con cadena de alternativas (el manejador de errores global prueba la siguiente) */
export function img(srcs, { cls = '', alt = '', lazy = true, w, h } = {}) {
  const [first, ...rest] = srcs;
  return `<img class="${cls}" src="${esc(first)}" ${rest.length ? `data-fb="${esc(rest.join('|'))}"` : ''} alt="${esc(alt)}"` +
    `${lazy ? ' loading="lazy"' : ''} decoding="async"${w ? ` width="${w}"` : ''}${h ? ` height="${h}"` : ''}>`;
}
export const pokeImg = (p, kind = 'small', cls = '', size) => img(spriteChain(p, kind), { cls: `poke ${cls}`, alt: '', w: size, h: size });
export const itemImg = (it, cls = '') => (it?.i ? img([`${SPR}/items/${it.i}.png`], { cls: `item ${cls}`, alt: '', w: 32, h: 32 }) : '');

export const typeIcon = (t, cls = '') =>
  `<img class="ticon ${cls}" src="${SPR}/types/generation-ix/scarlet-violet/small/${TYPE_ID[t] || 1}.png" alt="" width="24" height="24" decoding="async">`;
export const typePill = t => `<span class="tpill" style="--tc:${TYPE_COLOR[t]}">${typeIcon(t)}<span>${typeName(t)}</span></span>`;
export const typeDot = t => `<span class="tdot" style="--tc:${TYPE_COLOR[t]}" title="${typeName(t)}" aria-label="${typeName(t)}">${typeIcon(t)}</span>`;

const CAT_SVG = {
  f: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.6 6.4L21 6l-3.4 6 3.4 6-6.4-2.4L12 22l-2.6-6.4L3 18l3.4-6L3 6l6.4 2.4z"/></svg>',
  e: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="4"/></svg>',
  s: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="3" rx="1.5"/><rect x="3" y="10.5" width="18" height="3" rx="1.5"/><rect x="3" y="16" width="12" height="3" rx="1.5"/></svg>',
};
export const catIcon = c => `<span class="cat cat-${c}" title="${catName(c)}">${CAT_SVG[c]}</span>`;

export function statColor(v) {
  if (v < 50) return '#E5645A';
  if (v < 75) return '#F0974B';
  if (v < 100) return '#E6C84F';
  if (v < 125) return '#6CC070';
  return '#3FB6C9';
}
export const bst = s => s.reduce((a, b) => a + b, 0);
