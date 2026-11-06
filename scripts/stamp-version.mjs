// Pone en js/app.js el número de versión que se ve junto al logo: v1.<nº de guardados>. Ejecutar antes de cada commit: node scripts/stamp-version.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const f = new URL('../js/app.js', import.meta.url);
const n = Number(execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim()) + 1;
const s = readFileSync(f, 'utf8'), v = `v1.${n}`;
const out = s.replace(/const APP_VERSION = '[^']*';/, `const APP_VERSION = '${v}';`);
if (out !== s) writeFileSync(f, out);
console.log('versión', v);
