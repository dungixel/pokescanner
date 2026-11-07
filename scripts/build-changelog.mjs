// Registro de cambios del servidor: compara los datos de hoy con la foto de la última vez
// y apunta lo que cambió en data/changelog.json (el más nuevo primero).
// Uso normal: node scripts/build-changelog.mjs   (lo ejecuta `npm run update`)
// Rellenar el pasado con el historial de git: node scripts/build-changelog.mjs --backfill
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { snapshot, diffSnaps, mergeLog } from '../js/cgdiff.js';

const SNAP = 'data/changelog-snap.json', LOG = 'data/changelog.json', KEEP_DAYS = 120;
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });

/** Añade a `log` lo que cambió entre dos fotos (los cambios del mismo día se juntan) */
function addDiff(log, prev, cur) {
  const added = diffSnaps(prev, cur), d = cur.g.slice(0, 10);
  // un día puede tener varias ejecuciones: solo se juntan los cambios del mismo día; los de otros días no se tocan
  const same = mergeLog(log.filter(e => e.d === d), JSON.parse(JSON.stringify(added)));
  return [...same, ...log.filter(e => e.d !== d)];
}
const trim = log => { const lim = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10); return log.filter(e => e.d >= lim); };
const order = log => log.sort((a, b) => (b.t || b.d).localeCompare(a.t || a.d));

if (process.argv.includes('--backfill')) {
  // una foto por cada versión de los datos que haya en el historial de git, de la más antigua a la más nueva
  // Solo cuentan las actualizaciones diarias (y la versión justo anterior a la primera): los demás commits son
  // cambios míos al construir la web, que no son cambios del juego.
  const all = git('log', '--reverse', '--format=%H\t%s', '--', 'data/meta.json').split('\n').filter(Boolean).map(l => l.split('\t'));
  const bot = h => /^Actualización diaria/.test(h[1]);
  const commits = all.filter((h, i) => bot(h) || (all[i + 1] && bot(all[i + 1]) && !bot(h) && (i === 0 || bot(all[i - 1]) === false))).map(h => h[0]);
  let prev = null, log = [], used = 0;
  for (const h of commits) {
    try {
      const meta = JSON.parse(git('show', `${h}:data/meta.json`));
      const index = JSON.parse(git('show', `${h}:data/index.json`));
      const dict = JSON.parse(git('show', `${h}:data/dict.json`));
      if (!Array.isArray(index) || !dict.moves || !dict.abilities || !dict.items || !meta.generado) continue;
      const cur = snapshot(meta.generado, index, dict);
      if (prev && prev.g !== cur.g) { log = addDiff(log, prev, cur); }
      prev = cur; used++;
      console.log(h.slice(0, 7), meta.generado, '→', log.length, 'cambios');
    } catch (e) { console.log(h.slice(0, 7), 'omitido:', e.message.split('\n')[0]); }
  }
  fs.writeFileSync(LOG, JSON.stringify({ v: 1, log: order(trim(log)) }));
  if (prev) fs.writeFileSync(SNAP, JSON.stringify(prev));
  console.log('listo:', used, 'versiones,', log.length, 'cambios');
} else {
  const meta = readJson('data/meta.json'), index = readJson('data/index.json'), dict = readJson('data/dict.json');
  if (!meta?.generado || !Array.isArray(index) || !dict?.moves) { console.error('Faltan datos'); process.exit(1); }
  const cur = snapshot(meta.generado, index, dict), prev = readJson(SNAP, null);
  let log = readJson(LOG, { v: 1, log: [] }).log;
  if (prev && prev.v === 2 && prev.g !== cur.g) log = addDiff(log, prev, cur);
  fs.writeFileSync(LOG, JSON.stringify({ v: 1, log: order(trim(log)) }));
  fs.writeFileSync(SNAP, JSON.stringify(cur));
  console.log('registro:', log.length, 'cambios');
}
