// Idioma de la interfaz (es / en) y textos fijos. Los datos (nombres, descripciones) vienen ya en los dos idiomas.
let L = 'es';
try { const v = localStorage.getItem('pk.lang'); if (v === 'en' || v === 'es') L = v; } catch { /* sin almacenamiento */ }
document.documentElement.lang = L;

export const lang = () => L;
export function setLang(l) {
  L = l === 'en' ? 'en' : 'es';
  document.documentElement.lang = L;
  try { localStorage.setItem('pk.lang', L); } catch { /* sin almacenamiento */ }
}

const STR = {
  es: {
    footer: 'Datos de {ps} y los sets de {sm}; nombres y descripciones en español de {api}. Proyecto de fans sin relación con Nintendo, Game Freak ni The Pokémon Company.',
    searchPh: 'Busca un Pokémon o un movimiento', searchLabel: 'Buscar Pokémon', clearSearch: 'Borrar búsqueda',
    filters: 'Filtros', sortBy: 'Ordenar por', type: 'Tipo', tier: 'Rango (tier)', tierHint: '1 = el más fuerte', show: 'Mostrar',
    favorites: 'Favoritos', baseOnly: 'Solo formas base', gen9Only: 'Solo Gen 9', num: 'Nº',
    daily: 'Pokémon del día', random: 'Pokémon al azar', shuffle: 'Otros al azar',
    result1: '{n} resultado', resultN: '{n} resultados', clearFilters: 'Limpiar filtros',
    emptyTitle: 'No hay Pokémon con esos filtros', emptyFavs: 'Aún no has marcado ningún favorito: pulsa la estrella en la ficha de un Pokémon.',
    emptyHint: 'Prueba a quitar algún filtro o a cambiar la búsqueda.',
    learnersTitle: 'Pokémon que lo aprenden ({n})', learnersNote: 'Por nivel o en su build de Smogon.', showAllN: 'Ver todos ({n})',
    noLearners: 'Ningún Pokémon de la web lo aprende por nivel ni lo lleva en su build.', moreMoves: '+{n} más: escribe más letras para afinar',
    tierInGen: 'Rango en la Gen {g}',
    themeAria: 'Cambiar entre modo claro y oscuro', langAria: 'Cambiar idioma a inglés',
    back: 'Volver al buscador', backShort: 'Volver', favAdd: 'Añadir a favoritos', favRemove: 'Quitar de favoritos',
    favAdded: 'Añadido a favoritos', favRemoved: 'Quitado de favoritos',
    compare: 'Comparar estadísticas', rank: 'Rango', rankAria: 'Qué significa el rango {r}', doubles: 'Dobles {r}',
    height: 'Altura', weight: 'Peso', baseStats: 'Estadísticas base', total: 'Total', build: 'Recomendada', buildTitle: 'Build recomendada',
    abilities: 'Habilidades', hidden: 'oculta', weak: 'Debilidades y resistencias',
    weakNote: 'Solo cuenta los tipos; no incluye habilidades como Levitación.',
    evolution: 'Evolución', levelMoves: 'Movimientos por nivel', noLevelMoves: 'Este Pokémon no aprende movimientos por nivel.',
    showAllMoves: 'Ver los {n} movimientos', lv: 'Nv', evo: 'Evo',
    oldTitle: 'No está en Escarlata y Púrpura', oldAria: 'Fuera de Gen 9',
    oldText: 'No se puede usar en Gen 9, así que el rango y los movimientos son los de la Gen {g}. Rango en cada generación:',
    gen: 'Gen {g}',
    noSetsOld: 'No se puede usar en Gen 9, así que Smogon no tiene sets para este Pokémon.', noSets: 'Smogon todavía no tiene sets para este Pokémon.',
    format: 'Formato {f}', moves: 'Movimientos', or: 'o', ability: 'Habilidad', item: 'Objeto', nature: 'Naturaleza', tera: 'Teratipo',
    copy: 'Copiar para Showdown', copied: 'Set copiado: pégalo en el teambuilder de Showdown', neutral: 'neutra',
    close: 'Cerrar', power: 'Potencia', accuracy: 'Precisión', priority: 'Prioridad', noDesc: 'Sin descripción.',
    otherName: 'En inglés: {n}',
    natureUp: 'Sube un 10 % {a} y baja un 10 % {b}.', natureNeutral: 'Naturaleza neutra: no sube ni baja ninguna característica.',
    tierTitle: 'Rango {r}', tierDefault: 'Rango competitivo de Pokémon Showdown.',
    tierPos: 'Puesto {n} de {m}: el 1 es el más fuerte y el {m}, el más débil.',
    tierNoScale: 'No entra en la escala de fuerza: es un formato aparte, o el Pokémon aún puede evolucionar.',
    tierGo: 'Ver Pokémon de este rango',
    cmpTitle: 'Comparar estadísticas', cmpPh: 'Añade otro Pokémon (hasta 3)', cmpAria: 'Buscar Pokémon para comparar', remove: 'Quitar {n}',
    cmpSuggest: 'Sugerencias de su mismo rango', noResults: 'No hay resultados', cmpMax: 'Puedes comparar hasta 3 Pokémon más',
    loading: 'Cargando {n}…', notFound: 'No encuentro ese Pokémon', notFoundHint: 'Puede que no esté disponible en Pokémon Escarlata y Púrpura.',
    loadFail: 'No se han podido cargar los datos', loadFailHint: 'Comprueba tu conexión e inténtalo de nuevo.',
    bootFail: 'Si abres el archivo directamente, usa un servidor local (<code>npm run serve</code>) o publica la web en GitHub Pages.',
    stat_hp: 'PS', stat_atk: 'Ataque', stat_def: 'Defensa', stat_spa: 'At. Esp.', stat_spd: 'Def. Esp.', stat_spe: 'Velocidad', stat_bst: 'Total',
    cat_f: 'Físico', cat_e: 'Especial', cat_s: 'Estado',
    fmt_doublesou: 'Dobles OU',
  },
  en: {
    footer: 'Data from {ps} and {sm} sets; Spanish names and descriptions from {api}. Fan project, not affiliated with Nintendo, Game Freak or The Pokémon Company.',
    searchPh: 'Search a Pokémon or a move', searchLabel: 'Search Pokémon', clearSearch: 'Clear search',
    filters: 'Filters', sortBy: 'Sort by', type: 'Type', tier: 'Tier', tierHint: '1 = strongest', show: 'Show',
    favorites: 'Favorites', baseOnly: 'Base forms only', gen9Only: 'Gen 9 only', num: 'No.',
    daily: 'Pokémon of the day', random: 'Random Pokémon', shuffle: 'Shuffle',
    result1: '{n} result', resultN: '{n} results', clearFilters: 'Clear filters',
    emptyTitle: 'No Pokémon match those filters', emptyFavs: 'You have no favorites yet: tap the star on a Pokémon page.',
    emptyHint: 'Try removing a filter or changing your search.',
    learnersTitle: 'Pokémon that learn it ({n})', learnersNote: 'By level-up or in their Smogon build.', showAllN: 'Show all ({n})',
    noLearners: 'No Pokémon here learn it by level-up or carry it in their build.', moreMoves: '+{n} more: type more letters to narrow it down',
    tierInGen: 'Tier in Gen {g}',
    themeAria: 'Switch between light and dark mode', langAria: 'Switch language to Spanish',
    back: 'Back to search', backShort: 'Back', favAdd: 'Add to favorites', favRemove: 'Remove from favorites',
    favAdded: 'Added to favorites', favRemoved: 'Removed from favorites',
    compare: 'Compare stats', rank: 'Tier', rankAria: 'What does tier {r} mean', doubles: 'Doubles {r}',
    height: 'Height', weight: 'Weight', baseStats: 'Base stats', total: 'Total', build: 'Recommended', buildTitle: 'Recommended build',
    abilities: 'Abilities', hidden: 'hidden', weak: 'Weaknesses and resistances',
    weakNote: 'Types only; abilities like Levitate are not included.',
    evolution: 'Evolution', levelMoves: 'Level-up moves', noLevelMoves: 'This Pokémon does not learn moves by level.',
    showAllMoves: 'Show all {n} moves', lv: 'Lv', evo: 'Evo',
    oldTitle: 'Not in Scarlet and Violet', oldAria: 'Not in Gen 9',
    oldText: 'It cannot be used in Gen 9, so its tier and moves are from Gen {g}. Tier in each generation:',
    gen: 'Gen {g}',
    noSetsOld: 'It cannot be used in Gen 9, so Smogon has no sets for this Pokémon.', noSets: 'Smogon does not have sets for this Pokémon yet.',
    format: 'Format {f}', moves: 'Moves', or: 'or', ability: 'Ability', item: 'Item', nature: 'Nature', tera: 'Tera Type',
    copy: 'Copy for Showdown', copied: 'Set copied: paste it into the Showdown teambuilder', neutral: 'neutral',
    close: 'Close', power: 'Power', accuracy: 'Accuracy', priority: 'Priority', noDesc: 'No description.',
    otherName: 'In Spanish: {n}',
    natureUp: 'Raises {a} by 10% and lowers {b} by 10%.', natureNeutral: 'Neutral nature: it does not raise or lower any stat.',
    tierTitle: 'Tier {r}', tierDefault: 'Competitive tier from Pokémon Showdown.',
    tierPos: 'Rank {n} of {m}: 1 is the strongest and {m} the weakest.',
    tierNoScale: 'Not on the strength scale: it is a separate format, or the Pokémon can still evolve.',
    tierGo: 'Show Pokémon in this tier',
    cmpTitle: 'Compare stats', cmpPh: 'Add another Pokémon (up to 3)', cmpAria: 'Search Pokémon to compare', remove: 'Remove {n}',
    cmpSuggest: 'Suggestions from the same tier', noResults: 'No results', cmpMax: 'You can compare up to 3 more Pokémon',
    loading: 'Loading {n}…', notFound: 'Pokémon not found', notFoundHint: 'It may not be available in Pokémon Scarlet and Violet.',
    loadFail: 'Could not load the data', loadFailHint: 'Check your connection and try again.',
    bootFail: 'If you open the file directly, use a local server (<code>npm run serve</code>) or publish the site on GitHub Pages.',
    stat_hp: 'HP', stat_atk: 'Attack', stat_def: 'Defense', stat_spa: 'Sp. Atk', stat_spd: 'Sp. Def', stat_spe: 'Speed', stat_bst: 'Total',
    cat_f: 'Physical', cat_e: 'Special', cat_s: 'Status',
    fmt_doublesou: 'Doubles OU',
  },
};

/** Texto fijo en el idioma actual; {x} se sustituye con las variables dadas */
export function t(key, vars) {
  let s = STR[L][key] ?? STR.es[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, n) => vars[n] ?? '');
  return s;
}
