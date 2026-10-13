// Mutantes de SCRUM-1188e. Uso: node mutantes-1188e.mjs <raiz del worktree>
// Cada mutante: escribe quotesView.js mutado, comprueba que el diff NO es vacío, corre el test, restaura.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';

const RAIZ = path.resolve(process.argv[2]);
const F = path.join(RAIZ, 'public/dashboard/js/quotesView.js');
const TEST = 'tests/scrum1188e-sustituir-una-plantilla-con-su-nombre.test.mjs';
const ORIGINAL = readFileSync(F);
const fuente = ORIGINAL.toString('utf8');
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
if (base.poblacion !== 7 || base.caen.length) { console.log('CIEGO: la base no es 7 de 7'); console.log('EXIT=2'); process.exit(2); }

const viejo = git('show', 'origin/main:public/dashboard/js/quotesView.js');
const MUTANTES = [
  ['M1 · el quotesView.js de origin/main (sin la parte C)', () => viejo],
  ['M2 · sin repintar las fichas rápidas tras sustituir', (s) => s.replace("          useTemplateBtn.hidden = false;\n          pintarPlantillasRapidas();\n", '').replace("          plantillasRapidas.hidden = true;\n          plantillasRapidas.innerHTML = '';\n          plantillasRotulo = null;\n", '')],
  ['M3 · el PUT no manda paymentTerms cuando es null', (s) => s.replace("body: JSON.stringify({ currency, lines: templateLines, paymentTerms }),", "body: JSON.stringify(paymentTerms === null ? { currency, lines: templateLines } : { currency, lines: templateLines, paymentTerms }),")],
  ['M4 · sustituye SIN preguntar', (s) => s.replace("if (!window.confirm(`Ya tienes una plantilla llamada \"${name}\". ¿Quieres sustituirla? Esta acción no se puede deshacer.`)) {", "if (false) {")],
  ['M5 · si la lista no se lee, crea a ciegas', (s) => s.replace("const yaGuardadas = await apiRequest('/admin/templates');\n        if (!Array.isArray(yaGuardadas)) throw new Error('lista_de_plantillas_ilegible');", "let yaGuardadas = []; try { yaGuardadas = await apiRequest('/admin/templates'); } catch (_e) { yaGuardadas = []; }\n        if (!Array.isArray(yaGuardadas)) yaGuardadas = [];")],
  ['M6 · «mismo nombre» exacto (cuenta mayúsculas)', (s) => s.replace("String(a || '').trim().toLocaleLowerCase('es') === String(b || '').trim().toLocaleLowerCase('es')", "String(a || '').trim() === String(b || '').trim()")],
  ['M7 · el PUT manda también name', (s) => s.replace("body: JSON.stringify({ currency, lines: templateLines, paymentTerms }),", "body: JSON.stringify({ name, currency, lines: templateLines, paymentTerms }),")],
  ['M8 · la pregunta sin «no se puede deshacer» (el literal de antes de la firma)', (s) => s.replace(" ¿Quieres sustituirla? Esta acción no se puede deshacer.`)) {", " ¿Quieres sustituirla?`)) {")],
];

const normal = fuente.replace(/\r\n/g, '\n');
let mal = 0;
for (const [nombre, mutar] of MUTANTES) {
  const mutado = mutar(normal);
  writeFileSync(F, mutado);
  const numstat = git('diff', '--numstat', '--', 'public/dashboard/js/quotesView.js').trim();
  const aplicado = mutado !== normal && numstat !== '';
  const r = aplicado ? correr() : { poblacion: 0, caen: [], exit: null };
  writeFileSync(F, ORIGINAL);
  const veredicto = !aplicado ? 'CIEGO (no se aplicó)' : r.poblacion !== 7 ? 'CIEGO (población ≠ 7)' : r.caen.length ? 'MUERE' : 'VIVE';
  if (veredicto !== 'MUERE') mal += 1;
  console.log(`${nombre} · numstat=«${numstat}» · POBLACION=${r.poblacion} · caen=[${r.caen}] · ${veredicto}`);
}
const limpio = git('status', '--porcelain').trim();
console.log(`restaurado: git status --porcelain = «${limpio}»`);
console.log(`MUTANTES=${MUTANTES.length} · no mueren=${mal}`);
console.log(`EXIT=${mal || limpio ? 1 : 0}`);
process.exit(mal || limpio ? 1 : 0);
