// Mutantes de SCRUM-1056b. Uso: node mutantes-1056b.mjs <raiz del worktree>
// Cada mutante: escribe la pieza mutada, comprueba que el diff NO es vacío, corre el test, restaura.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';

const RAIZ = path.resolve(process.argv[2]);
const REL = 'public/dashboard/js/clienteVolverALlamar.js';
const F = path.join(RAIZ, REL);
const TEST = 'tests/scrum1056b-volver-a-llamar-la-pieza.test.mjs';
const TOTAL = 14;
const ORIGINAL = readFileSync(F);
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8' });

function correr() {
  const env = { ...process.env }; delete env.FORCE_COLOR; delete env.NODE_OPTIONS;
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: RAIZ, encoding: 'utf8', env });
  const lineas = r.stdout.split(/\r?\n/).filter((l) => /^(not ok|ok) \d+ - /.test(l));
  const caen = lineas.filter((l) => l.startsWith('not ok')).map((l) => Number(l.match(/^not ok (\d+)/)[1]));
  return { poblacion: lineas.length, caen, exit: r.status };
}

const base = correr();
console.log(`BASE sin mutar · POBLACION=${base.poblacion} · caen=[${base.caen}] · exit=${base.exit}`);
if (base.poblacion !== TOTAL || base.caen.length) { console.log(`CIEGO: la base no es ${TOTAL} de ${TOTAL}`); console.log('EXIT=2'); process.exit(2); }

const MUTANTES = [
  ['M1 · un texto firmado cambia una letra («Nota» por «Nota de la llamada»)', (s) => s.replace("nota: 'Nota de la llamada',", "nota: 'Nota',")],
  ['M2 · la marca sale también para una llamada futura', (s) => s.replace("    if (l.estado === ESTADOS.VENCIDO) return FRASES.marcaVencida(diaLegible(l.dia));\n    return null;", "    return FRASES.marcaVencida(diaLegible(l.dia));")],
  ['M3 · un día sin estado se da por «futuro»', (s) => s.replace("if (!diaLegible(llamada.dia) || !conocido) return null;", "if (!diaLegible(llamada.dia)) return null; if (!conocido) estado = ESTADOS.FUTURO;")],
  ['M4 · tras guardar se pinta lo tecleado, no lo que devuelve el servidor', (s) => s.replace("var leida = leer(guardada);", "var leida = leer({ dia: enviado.dia, nota: enviado.nota, estado: ESTADOS.FUTURO });")],
  ['M5 · si guardar falla, no se dice', (s) => s.replace("          avisoPuesto = aviso(TEXTOS.noGuardado);\n          contenedor.appendChild(avisoPuesto);\n", '')],
  ['M6 · si guardar falla, los botones se quedan apagados', (s) => s.replace("          apagar([guardar, cancelar], false);\n", '')],
  ['M7 · «Hecho» que falla borra la llamada igual', (s) => s.replace("            pintarEstado(TEXTOS.noGuardado);", "            actual = { dia: null, nota: '', estado: null }; pintarEstado();")],
  ['M8 · se manda una llamada sin día', (s) => s.replace("        if (!diaLegible(dia.value)) {", "        if (false) {")],
  ['M9 · el día pasa por Date (hora y zona)', (s) => s.replace("    return m ? m[3] + '/' + m[2] + '/' + m[1] : null;", "    return m ? new Date(dia).toLocaleDateString('es-ES') : null;")],
  ['M10 · guardado sin día devuelto: se ofrece «Poner fecha»', (s) => s.replace("actual = leida && leida.dia ? leida : null;", "actual = leida;")],
  ['M11 · «Cambiar» abre el formulario vacío', (s) => s.replace("dia.value = actual.dia || '';", "dia.value = '';")],
  ['M12 · la nota viaja sin recortar', (s) => s.replace("nota: nota.value.trim() };", "nota: nota.value };")],
  ['M13 · la nota se pinta sin la clase que parte las palabras largas', (s) => s.replace("crear('p', 'volver-a-llamar-nota', actual.nota)", "crear('p', '', actual.nota)")],
];

const normal = ORIGINAL.toString('utf8').replace(/\r\n/g, '\n');
let mal = 0;
for (const [nombre, mutar] of MUTANTES) {
  const mutado = mutar(normal);
  writeFileSync(F, mutado);
  const numstat = git('diff', '--numstat', '--', REL).trim();
  const aplicado = mutado !== normal && numstat !== '';
  const r = aplicado ? correr() : { poblacion: 0, caen: [], exit: null };
  writeFileSync(F, ORIGINAL);
  const veredicto = !aplicado ? 'CIEGO (no se aplicó)' : r.poblacion !== TOTAL ? `CIEGO (población ≠ ${TOTAL})` : r.caen.length ? 'MUERE' : 'VIVE';
  if (veredicto !== 'MUERE') mal += 1;
  console.log(`${nombre} · numstat=«${numstat}» · POBLACION=${r.poblacion} · caen=[${r.caen}] · ${veredicto}`);
}
const limpio = git('status', '--porcelain').trim();
console.log(`restaurado: git status --porcelain = «${limpio}»`);
console.log(`MUTANTES=${MUTANTES.length} · no mueren=${mal}`);
console.log(`EXIT=${mal || limpio ? 1 : 0}`);
process.exit(mal || limpio ? 1 : 0);
