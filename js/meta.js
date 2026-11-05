// Equipos de ejemplo para comparar sin necesitar un rival: arquetipos típicos de cada formato.
// No son estadísticas de uso reales: son equipos bien construidos con Pokémon que tienen build de Smogon en ese formato
// (OU para Individual, VGC para Dobles) y sirven como vara de medir.
const team = (id, fmt, es, en, ids) => ({ id, fmt, name: { es, en }, members: ids.map(i => ({ id: i })) });
export const META_TEAMS = [
  team('ou-ho', 'singles', 'Ofensiva (OU)', 'Hyper offense (OU)', ['gholdengo', 'ragingbolt', 'dragapult', 'greattusk', 'kingambit', 'ironvaliant']),
  team('ou-bal', 'singles', 'Equilibrado (OU)', 'Balance (OU)', ['gliscor', 'corviknight', 'clefable', 'gholdengo', 'dragonite', 'walkingwake']),
  team('ou-rain', 'singles', 'Lluvia (OU)', 'Rain (OU)', ['pelipper', 'barraskewda', 'ogerponwellspring', 'ragingbolt', 'kingambit', 'dragonite']),
  team('ou-sun', 'singles', 'Sol (OU)', 'Sun (OU)', ['torkoal', 'venusaur', 'ironmoth', 'ceruledge', 'cresselia', 'garganacl']),
  team('ou-sand', 'singles', 'Arena (OU)', 'Sand (OU)', ['tyranitar', 'excadrill', 'garganacl', 'gholdengo', 'corviknight', 'ragingbolt']),
  team('ou-stall', 'singles', 'Defensivo (OU)', 'Stall (OU)', ['blissey', 'toxapex', 'clodsire', 'skarmory', 'corviknight', 'tinglu']),
  team('vgc-intim', 'doubles', 'Intimidación y control (VGC)', 'Intimidate & control (VGC)', ['incineroar', 'rillaboom', 'amoonguss', 'ironhands', 'fluttermane', 'urshifurapidstrike']),
  team('vgc-tr', 'doubles', 'Espacio Raro (VGC)', 'Trick Room (VGC)', ['hatterene', 'ursalunabloodmoon', 'torkoal', 'indeedeef', 'amoonguss', 'incineroar']),
  team('vgc-tw', 'doubles', 'Viento Afín (VGC)', 'Tailwind (VGC)', ['tornadus', 'ragingbolt', 'roaringmoon', 'dragapult', 'amoonguss', 'grimmsnarl']),
  team('vgc-rain', 'doubles', 'Lluvia (VGC)', 'Rain (VGC)', ['pelipper', 'archaludon', 'basculegion', 'kingambit', 'amoonguss', 'incineroar']),
  team('vgc-sun', 'doubles', 'Sol (VGC)', 'Sun (VGC)', ['torkoal', 'ogerponhearthflame', 'volcarona', 'ironhands', 'amoonguss', 'grimmsnarl']),
  team('vgc-lege', 'doubles', 'Con legendario (VGC)', 'With a restricted (VGC)', ['miraidon', 'fluttermane', 'incineroar', 'rillaboom', 'urshifurapidstrike', 'amoonguss']),
];
