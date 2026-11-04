# PokeScanner

Web en español para consultar Pokémon desde el móvil: buscador, filtros (tipo, rango/tier, estadísticas), ficha con estadísticas animadas, build recomendada de Smogon, debilidades, cadena evolutiva, movimientos por nivel, comparador, favoritos y modo claro/oscuro.

Es una web estática (HTML + CSS + JS sin frameworks): no necesita servidor ni base de datos y se publica gratis en GitHub Pages.

## Publicarla en GitHub Pages

1. Crea un repositorio **público** en GitHub (por ejemplo `pokescanner`).
2. Sube el contenido de esta carpeta (`index.html`, `css/`, `js/`, `data/`, etc.).
   - Desde el navegador: *Add file → Upload files* y arrastra los archivos y carpetas (incluida `data/`; son pocos archivos).
   - O con Git:
     ```bash
     git init && git add . && git commit -m "PokeScanner"
     git branch -M main
     git remote add origin https://github.com/TU_USUARIO/pokescanner.git
     git push -u origin main
     ```
3. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)` → Save.
4. En 1-2 minutos tendrás la web en `https://TU_USUARIO.github.io/pokescanner/`. Ese enlace funciona en cualquier móvil.

## Probarla en tu ordenador

Los navegadores no cargan los datos si abres `index.html` con doble clic; usa un servidor local:

```bash
npm install
npm run serve      # abre http://localhost:8080
```

## Actualizar los datos

Los datos están ya generados en `data/`. Para regenerarlos (nuevos tiers, sets de Smogon, etc.):

```bash
npm install
npm update @pkmn/dex @pkmn/data   # tiers y datos de Showdown más recientes
npm run update                    # descarga sets de Smogon + traducciones y regenera data/
```

Después vuelve a subir los cambios a GitHub.

## De dónde sale cada cosa

| Dato | Fuente |
| --- | --- |
| Estadísticas, tipos, rango (tier), habilidades, movimientos por nivel, evoluciones | Pokémon Showdown (`@pkmn/dex`, `@pkmn/data`) |
| Build recomendada (movimientos, habilidad, objeto, naturaleza, EVs, teratipo) | Sets de Smogon (`pkmn/smogon`) |
| Nombres y descripciones en español, altura | PokeAPI |
| Imágenes de Pokémon y objetos | Repositorio `PokeAPI/sprites` (se cargan desde GitHub) |

- Las descripciones de los movimientos, habilidades y objetos más nuevos (Gen 9) que aún no tienen texto en español en PokeAPI están traducidas a mano en `scripts/overrides-es.json`. No son textos oficiales.
- Los nombres de las formas alternativas en español (p. ej. «Landorus Forma Tótem») se generan con una tabla propia en `scripts/build-data.mjs`; algunos pueden diferir del nombre oficial.
- El rango que se muestra es el tier singles de Showdown; Smogon puede tener sets de varios formatos (OU, Ubers, VGC…) y se muestran en pestañas.
- Tipografía: Lexend (regular y bold, licencia SIL OFL), incluida en `fonts/`; no depende de ningún servicio externo.

## Estructura

```
fonts/              tipografía Lexend
index.html          página única (rutas con #/pokemon/<id>, funciona en GitHub Pages)
css/style.css       sistema de diseño
js/app.js           buscador, filtros, ficha, comparador, ventanitas
js/util.js          constantes y utilidades (tipos, tiers, tabla de debilidades…)
data/               JSON generados (index, diccionario, fichas en paquetes)
scripts/            descarga y generación de datos
```

Proyecto de fans, sin relación con Nintendo, Game Freak ni The Pokémon Company.
