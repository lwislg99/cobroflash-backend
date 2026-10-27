// Mutantes de SCRUM-1150b. Uso: node mutantes-1150b.mjs <raiz del worktree>
// Cada mutante: escribe el fichero mutado, comprueba que el diff NO es vacío, corre el test, restaura los bytes.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';

const RAIZ = path.resolve(process.argv[2]);
const PANTALLA = 'public/dashboard/js/quoteRevisiones.js';
const DOMINIO = 'src/modules/quotes/domain/revision.ts';
const TEST = 'tests/scrum1150b-la-pantalla-decide-por-el-codigo.test.mjs';
const TOTAL = 16;
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8' });

function correr() {
  const env = { ...process.env }; delete env.FORCE_COLOR; delete env.NODE_OPTIONS;
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: RAIZ, encoding: 'utf8', env });
  const lineas = r.stdout.split(/\r?\n/).filter((l) => /^(not ok|ok) \d+ - /.test(l));
  const caen = lineas.filter((l) => l.startsWith('not ok')).map((l) => Number(l.match(/^not ok (\d+)/)[1]));
  const dos = (r.stdout.match(/tras dos fallos hay (\d+) avisos colgados/) || [])[1] || null;
  return { poblacion: lineas.length, caen, exit: r.status, dos };
}

const base = correr();
console.log(`BASE sin mutar · POBLACION=${base.poblacion} · caen=[${base.caen}] · exit=${base.exit}`);
if (base.poblacion !== TOTAL || base.caen.length) { console.log(`CIEGO: la base no es ${TOTAL} de ${TOTAL}`); console.log('EXIT=2'); process.exit(2); }

const viejo = git('show', `origin/main:${PANTALLA}`);
const MUTANTES = [
  ['M1 · el quoteRevisiones.js de origin/main (pinta data.message, sin role, cuelga avisos)', PANTALLA, () => viejo],
  ['M2 · sin role="alert"', PANTALLA, (s) => s.replace("          aviso.setAttribute('role', 'alert');\n", '')],
  ['M3 · no quita el aviso del intento anterior', PANTALLA, (s) => s.replace("for (var v = 0; v < viejos.length; v += 1) viejos[v].remove();", '')],
  ['M4 · lo que no está en la tabla pinta el message del servidor (la puerta abierta)', PANTALLA, (s) => s.replace("    if (codigo === CODIGO_QUE_TRAE_SU_TEXTO) return mensajeParaPersona(e, TEXTOS.errorCrear);\n    return TEXTOS.errorCrear;", "    return mensajeParaPersona(e, TEXTOS.errorCrear);")],
  ['M5 · una clave de la tabla con errata (código que el servidor no contesta)', PANTALLA, (s) => s.replace("    quote_sin_numero: 'No se puede", "    quote_sin_num: 'No se puede")],
  ['M6 · una letra cambiada en un literal firmado', PANTALLA, (s) => s.replace('este presupuesto ya no existe.', 'ese presupuesto ya no existe.')],
  ['M7 · la frase SIN FIRMA de revisiones_dos_vigentes metida en la tabla', PANTALLA, (s) => s.replace("    quote_not_found: 'No se puede crear una revisión: este presupuesto ya no existe.',", "    quote_not_found: 'No se puede crear una revisión: este presupuesto ya no existe.',\n    revisiones_dos_vigentes: 'No se puede crear una revisión: hay dos presupuestos con el mismo número.',")],
  ['M8 · SERVIDOR: un motivo nuevo en el dominio que la pantalla no ha decidido', DOMINIO, (s) => s.replace("type MotivoDeCensoCiego = 'revisiones_sin_leer' | 'revisiones_sin_la_propia';", "type MotivoDeCensoCiego = 'revisiones_sin_leer' | 'revisiones_sin_la_propia' | 'revisiones_de_otro_ano';")],
];

let mal = 0;
for (const [nombre, rel, mutar] of MUTANTES) {
  const F = path.join(RAIZ, rel);
  const ORIGINAL = readFileSync(F);
  const normal = ORIGINAL.toString('utf8').replace(/\r\n/g, '\n');
  const mutado = mutar(normal);
  writeFileSync(F, mutado);
  const numstat = git('diff', '--numstat', '--', rel).trim();
  const aplicado = mutado !== normal && numstat !== '';
  const r = aplicado ? correr() : { poblacion: 0, caen: [], exit: null, dos: null };
  writeFileSync(F, ORIGINAL);
  const veredicto = !aplicado ? 'CIEGO (no se aplicó)' : r.poblacion !== TOTAL ? `CIEGO (población ${r.poblacion} ≠ ${TOTAL})` : r.caen.length ? 'MUERE' : 'VIVE';
  if (veredicto !== 'MUERE') mal += 1;
  console.log(`${nombre} · numstat=«${numstat}» · POBLACION=${r.poblacion} · caen=[${r.caen}]${r.dos ? ` · tras dos fallos: ${r.dos} avisos` : ''} · ${veredicto}`);
}
const limpio = git('status', '--porcelain').trim();
console.log(`restaurado: git status --porcelain = «${limpio}»`);
console.log(`MUTANTES=${MUTANTES.length} · no mueren=${mal}`);
console.log(`EXIT=${mal || limpio ? 1 : 0}`);
process.exit(mal || limpio ? 1 : 0);
