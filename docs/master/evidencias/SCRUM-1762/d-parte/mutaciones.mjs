// docs/master/evidencias/SCRUM-1762/d-parte/mutaciones.mjs — SCRUM-1762d (S4)
//
// Aplica UNA A UNA las mutaciones que declara `tests/scrum1762d-parte-ancho-y-hallmark.test.mjs`
// (`MUTACIONES_QUE_ME_TUMBAN`), corre el test y exige que caiga EL CASO QUE NOMBRA. Restaura siempre.
// Es la comprobación local y rápida; la que manda es `npm run meta:mutaciones` (CI).
//
// Uso:  node docs/master/evidencias/SCRUM-1762/d-parte/mutaciones.mjs     → sale con 1 si alguna no cae.
// ⚠️ MUTA ficheros de `public/` mientras corre: nada de tandas ni `git add` hasta que acabe.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const TEST = path.join(RAIZ, 'tests', 'scrum1762d-parte-ancho-y-hallmark.test.mjs');
// El catálogo se lee del fuente, sin ejecutar el test en este proceso.
const fuente = fs.readFileSync(TEST, 'utf8');
const inicio = fuente.indexOf('export const MUTACIONES_QUE_ME_TUMBAN = [');
const fin = fuente.indexOf('\n];', inicio);
if (inicio < 0 || fin < 0) { console.error('🔴 NO SUPE MIRAR: el test no declara su catálogo.'); process.exit(2); }
const modulo = path.join(os.tmpdir(), `catalogo-1762d-${process.pid}.mjs`);
let MUTACIONES;
try {
  fs.writeFileSync(modulo, fuente.slice(inicio, fin + 3) + '\n');
  ({ MUTACIONES_QUE_ME_TUMBAN: MUTACIONES } = await import(pathToFileURL(modulo).href));
} finally {
  fs.rmSync(modulo, { force: true });
}

const correr = () => spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: RAIZ, encoding: 'utf8' });
const base = correr();
if (base.status !== 0) { console.error('🔴 NO SUPE MIRAR: el test no está en verde ANTES de mutar.'); process.exit(2); }

let malas = 0;
for (const [i, m] of MUTACIONES.entries()) {
  const ruta = path.join(RAIZ, m.fichero);
  const original = fs.readFileSync(ruta, 'utf8');
  const veces = original.split(m.de).length - 1;
  if (veces !== 1) { console.error(`🔴 ${i + 1}. el texto a mutar aparece ${veces} veces en ${m.fichero} (tiene que ser 1).`); malas++; continue; }
  let r;
  try {
    fs.writeFileSync(ruta, original.replace(m.de, m.a));
    r = correr();
  } finally {
    fs.writeFileSync(ruta, original);
  }
  const cayo = r.stdout.split(/\r?\n/).some((l) => /^\s*not ok \d+ - /.test(l) && l.trim().endsWith(' - ' + m.cae));
  console.log(`${cayo ? '✔ ROJO ' : '🔴 VERDE'} ${i + 1}. ${m.cae}`);
  if (!cayo) malas++;
}
console.log(`\n${MUTACIONES.length - malas}/${MUTACIONES.length} mutaciones tumban su caso.`);
process.exit(malas ? 1 : 0);
