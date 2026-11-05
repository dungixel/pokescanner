// Iconos del dock y de las pantallas nuevas. Todos son de Tabler Icons (https://tabler.io/icons), salvo "battle",
// que está dibujado a mano (dos Pokéballs chocando) porque Tabler no lo tiene.
const svg = (inner, cls = "") => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${inner}</svg>`;
const T = {
"home": {
"o": "<path d=\"M5 12l-2 0l9 -9l9 9l-2 0\"/><path d=\"M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7\"/><path d=\"M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6\"/>",
"f": "<path d=\"M12.707 2.293l9 9c.63 .63 .184 1.707 -.707 1.707h-1v6a3 3 0 0 1 -3 3h-1v-7a3 3 0 0 0 -2.824 -2.995l-.176 -.005h-2a3 3 0 0 0 -3 3v7h-1a3 3 0 0 1 -3 -3v-6h-1c-.89 0 -1.337 -1.077 -.707 -1.707l9 -9a1 1 0 0 1 1.414 0m.293 11.707a1 1 0 0 1 1 1v7h-4v-7a1 1 0 0 1 .883 -.993l.117 -.007z\"/>"
},
"search": {
"o": "<path d=\"M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0\"/><path d=\"M21 21l-6 -6\"/>",
"f": "<path d=\"M14 3.072a8 8 0 0 1 2.32 11.834l5.387 5.387a1 1 0 0 1 -1.414 1.414l-5.388 -5.387a8 8 0 1 1 -.905 -13.249\"/>"
},
"star": {
"o": "<path d=\"M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245\"/>",
"f": "<path d=\"M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z\"/>"
},
"settings": {
"o": "<path d=\"M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065\"/><path d=\"M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\"/>",
"f": "<path d=\"M14.647 4.081a.724 .724 0 0 0 1.08 .448c2.439 -1.485 5.23 1.305 3.745 3.744a.724 .724 0 0 0 .447 1.08c2.775 .673 2.775 4.62 0 5.294a.724 .724 0 0 0 -.448 1.08c1.485 2.439 -1.305 5.23 -3.744 3.745a.724 .724 0 0 0 -1.08 .447c-.673 2.775 -4.62 2.775 -5.294 0a.724 .724 0 0 0 -1.08 -.448c-2.439 1.485 -5.23 -1.305 -3.745 -3.744a.724 .724 0 0 0 -.447 -1.08c-2.775 -.673 -2.775 -4.62 0 -5.294a.724 .724 0 0 0 .448 -1.08c-1.485 -2.439 1.305 -5.23 3.744 -3.745a.722 .722 0 0 0 1.08 -.447c.673 -2.775 4.62 -2.775 5.294 0zm-2.647 4.919a3 3 0 1 0 0 6a3 3 0 0 0 0 -6\"/>"
},
"user": {
"o": "<path d=\"M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0\"/><path d=\"M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2\"/>",
"f": "<path d=\"M12 2a5 5 0 1 1 -5 5l.005 -.217a5 5 0 0 1 4.995 -4.783z\"/><path d=\"M14 14a5 5 0 0 1 5 5v1a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-1a5 5 0 0 1 5 -5h4z\"/>"
},
"plus": {
"o": "<path d=\"M12 5l0 14\"/><path d=\"M5 12l14 0\"/>",
"f": "<path d=\"M12 4a1 1 0 0 1 1 1v6h6a1 1 0 0 1 0 2h-6v6a1 1 0 0 1 -2 0v-6h-6a1 1 0 0 1 0 -2h6v-6a1 1 0 0 1 1 -1\"/>"
},
"pencil": {
"o": "<path d=\"M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4\"/><path d=\"M13.5 6.5l4 4\"/>",
"f": "<path d=\"M12.085 6.5l5.415 5.415l-8.793 8.792a1 1 0 0 1 -.707 .293h-4a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 .293 -.707zm5.406 -2.698a3.828 3.828 0 0 1 1.716 6.405l-.292 .293l-5.415 -5.415l.293 -.292a3.83 3.83 0 0 1 3.698 -.991\"/>"
},
"trash": {
"o": "<path d=\"M4 7l16 0\"/><path d=\"M10 11l0 6\"/><path d=\"M14 11l0 6\"/><path d=\"M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12\"/><path d=\"M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3\"/>",
"f": "<path d=\"M20 6a1 1 0 0 1 .117 1.993l-.117 .007h-.081l-.919 11a3 3 0 0 1 -2.824 2.995l-.176 .005h-8c-1.598 0 -2.904 -1.249 -2.992 -2.75l-.005 -.167l-.923 -11.083h-.08a1 1 0 0 1 -.117 -1.993l.117 -.007zm-10 4a1 1 0 0 0 -1 1v6a1 1 0 0 0 2 0v-6a1 1 0 0 0 -1 -1m4 0a1 1 0 0 0 -1 1v6a1 1 0 0 0 2 0v-6a1 1 0 0 0 -1 -1\"/><path d=\"M14 2a2 2 0 0 1 2 2a1 1 0 0 1 -1.993 .117l-.007 -.117h-4l-.007 .117a1 1 0 0 1 -1.993 -.117a2 2 0 0 1 1.85 -1.995l.15 -.005z\"/>"
},
"check": {
"o": "<path d=\"M5 12l5 5l10 -10\"/>",
"f": "<path d=\"M20.707 6.293a1 1 0 0 1 0 1.414l-10 10a1 1 0 0 1 -1.414 0l-5 -5a1 1 0 0 1 1.414 -1.414l4.293 4.293l9.293 -9.293a1 1 0 0 1 1.414 0\"/>"
},
"x": {
"o": "<path d=\"M18 6l-12 12\"/><path d=\"M6 6l12 12\"/>",
"f": "<path d=\"M6.707 5.293l5.293 5.292l5.293 -5.292a1 1 0 0 1 1.414 1.414l-5.292 5.293l5.292 5.293a1 1 0 0 1 -1.414 1.414l-5.293 -5.292l-5.293 5.292a1 1 0 1 1 -1.414 -1.414l5.292 -5.293l-5.292 -5.293a1 1 0 0 1 1.414 -1.414\"/>"
},
"user-plus": {
"o": "<path d=\"M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0\"/><path d=\"M16 19h6\"/><path d=\"M19 16v6\"/><path d=\"M6 21v-2a4 4 0 0 1 4 -4h4\"/>"
},
"circle-check": {
"o": "<path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0\"/><path d=\"M9 12l2 2l4 -4\"/>",
"f": "<path d=\"M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-1.293 5.953a1 1 0 0 0 -1.32 -.083l-.094 .083l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.403 1.403l.083 .094l2 2l.094 .083a1 1 0 0 0 1.226 0l.094 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z\"/>"
}
};

/** Pareja contorno / relleno para el dock */
const pair = n => ({ o: svg(T[n].o, 'o'), f: svg(T[n].f, 'f') });

// Batalla: dos Pokéballs chocando (contorno y relleno)
const R = 4.9, AX = 6.9, BX = 17.1, Y = 14.5;
const ROT = 35; // las bandas van en diagonal, como si las bolas girasen al chocar
const BALL = (cx, cy, rot) => `<circle cx="${cx}" cy="${cy}" r="${R}"/><path transform="rotate(${rot} ${cx} ${cy})" d="M${cx - R} ${cy}h${R - 1.6}M${cx + 1.6} ${cy}h${R - 1.6}"/><circle cx="${cx}" cy="${cy}" r="1.6"/>`;
const SPARK = '<path d="M12 3v3.2M7.9 4.6l1.5 2.4M16.1 4.6l-1.5 2.4"/>';
const SPARK_F = '<path d="M12 3v3.2M7.9 4.6l1.5 2.4M16.1 4.6l-1.5 2.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
const battleO = svg(`${BALL(AX, Y, -ROT)}${BALL(BX, Y, ROT)}${SPARK}`, 'o');
const battleF = svg(`<defs><mask id="bm" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="#fff"/>
  <path transform="rotate(${-ROT} ${AX} ${Y})" d="M${AX - R - 1} ${Y}h${2 * R + 2}" stroke="#000" stroke-width="1.7"/><path transform="rotate(${ROT} ${BX} ${Y})" d="M${BX - R - 1} ${Y}h${2 * R + 2}" stroke="#000" stroke-width="1.7"/>
  <circle cx="${AX}" cy="${Y}" r="2.5" fill="#000"/><circle cx="${BX}" cy="${Y}" r="2.5" fill="#000"/>
  <circle cx="${AX}" cy="${Y}" r="1.3" fill="#fff"/><circle cx="${BX}" cy="${Y}" r="1.3" fill="#fff"/></mask></defs>
  <g mask="url(#bm)" fill="currentColor" stroke="none"><circle cx="${AX}" cy="${Y}" r="${R}"/><circle cx="${BX}" cy="${Y}" r="${R}"/></g>${SPARK_F}`, 'f');

const USERS_O = '<path d="M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10"/><path d="M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2"/>';
const USERS_F = '<path d="M20.901 14.995l-.044 -.006a.4 .4 0 0 1 -.102 -.02l-.045 -.012l-.048 -.017l-.045 -.016l-.043 -.02l-.045 -.022l-.04 -.024l-.044 -.026l-.043 -.032l-.036 -.027a1 1 0 0 1 -.073 -.066l-2.707 -2.707h-6.586a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2h9a2 2 0 0 1 2 2v10a1 1 0 0 1 -.076 .383l-.02 .043l-.022 .045l-.024 .04l-.026 .044l-.032 .043l-.027 .036a1 1 0 0 1 -.578 .347l-.052 .008l-.044 .006a1 1 0 0 1 -.198 0"/><path d="M7 8.999v1.001a4 4 0 0 0 4 4h4v3a2 2 0 0 1 -2 2h-6.586l-2.707 2.707c-.63 .63 -1.707 .184 -1.707 -.707v-10a2 2 0 0 1 2 -2z"/>';
export const DOCK = {
  'dock-community': { o: svg(USERS_O, 'o'), f: svg(USERS_F, 'f') },
  'dock-home': pair('home'), 'dock-battle': { o: battleO, f: battleF }, 'dock-favs': pair('star'), 'dock-settings': pair('settings'),
};
export const IC = {
  user: svg(T.user.o), userF: svg(T.user.f), plus: svg(T.plus.o), pencil: svg(T.pencil.o), trash: svg(T.trash.o), check: svg(T.check.o),
  x: svg(T.x.o), userPlus: svg(T['user-plus'].o), starF: svg(T.star.f, 'sf'), star: svg(T.star.o), circleCheck: svg(T['circle-check'].o),
  battle: battleO,
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  share: svg('<path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>'),
};
