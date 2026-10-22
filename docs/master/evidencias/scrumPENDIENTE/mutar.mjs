// Réplica local del meta-guard para el catálogo de tests/scrumPENDIENTE-configuracion-44.test.mjs.
// Cada mutación se aplica en una COPIA fuera del árbol (el árbol no se toca) y se mira si cae SU prueba.
// Uso: node mutar.mjs <raiz> <carpeta temporal>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const [RAIZ, TMP] = process.argv.slice(2).map((p) => path.resolve(p));
const TEST = 'tests/scrumPENDIENTE-configuracion-44.test.mjs';
const { MUTACIONES_QUE_ME_TUMBAN: M } = await import(pathToFileURL(path.join(RAIZ, TEST)).href);
const FICHEROS = [TEST, 'public/dashboard/js/settingsView.js', 'public/dashboard/css/styles.css'];
const entorno = { ...process.env }; delete entorno.NODE_TEST_CONTEXT; delete entorno.NODE_OPTIONS;
const correr = (dir) => spawnSync(process.execPath, ['--test', '--test-reporter=spec', path.join(dir, TEST)], { encoding: 'utf8', env: entorno });
let malas = 0;
for (const [i, m] of [{ base: true }, ...M].entries()) {
  const dir = path.join(TMP, 'mut-' + i);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const f of FICHEROS) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.copyFileSync(path.join(RAIZ, f), path.join(dir, f)); }
  if (!m.base) {
    const p = path.join(dir, m.fichero), s = fs.readFileSync(p, 'utf8');
    const n = s.split(m.de).length - 1;
    if (n !== 1) { console.log(`#${i} ANCLA ${n} veces (debe ser 1): ${m.de}`); malas++; continue; }
    fs.writeFileSync(p, s.replace(m.de, m.a));
  }
  const r = correr(dir);
  const caidos = (r.stdout.match(/^✖ .*$/gm) || []).filter((l) => !/failing tests/.test(l));
  const ok = m.base ? r.status === 0 && caidos.length === 0 : r.status !== 0 && caidos.some((l) => l.includes(m.cae));
  if (!ok) malas++;
  console.log(`#${i} ${m.base ? 'BASE sin mutar' : m.cae + ' ' + m.fichero} → salida ${r.status} · cae: ${[...new Set(caidos)].map((l) => l.slice(2, 22)).join(' | ') || 'nada'} · ${ok ? 'OK' : 'MAL'}`);
}
console.log(`población: ${M.length} mutaciones + 1 base · MAL ${malas}`);
process.exit(malas ? 1 : 0);
