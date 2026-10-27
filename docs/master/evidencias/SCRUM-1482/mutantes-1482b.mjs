// SCRUM-1482b · CONTROL POSITIVO de los tests del título de la vista: ¿caen cuando el código está mal?
//
//   node docs/master/evidencias/SCRUM-1482/mutantes-1482b.mjs      (desde la raíz, con el árbol LIMPIO)
//
// Para cada mutante: aplica UNA sustitución (aborta si no casa exactamente una vez), imprime el
// `git diff --numstat` como prueba de que la mutación ENTRÓ, corre los cuatro ficheros de test y
// devuelve los bytes originales. La BASE sin mutar va primero: sin ella, un test inestable que cae
// se leería como un mutante que muere. Un mutante sin recuentos es CIEGO, no un resultado.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const APP = path.join(RAIZ, 'public', 'dashboard', 'js', 'app.js');
const FICHA = path.join(RAIZ, 'public', 'dashboard', 'js', 'quotesDetailView.js');
const TESTS = [
  'tests/scrum832-atras-vuelve-a-la-lista.test.mjs',
  'tests/scrum1482-el-panel-no-ensena-el-id-de-la-tabla.test.mjs',
  'tests/scrum1487-la-ficha-lee-la-palabra-del-locale.test.mjs',
  'tests/scrum1495-el-titulo-es-de-la-ficha-montada.test.mjs',
];

const ROUTER_NUEVO = "viewTitle.textContent = state.quoteId != null ? L.quote : L.quotePlural;";
const ROUTER_VIEJO = "viewTitle.textContent = state.quoteId != null ? 'Presupuesto #' + state.quoteId : L.quotePlural;";
const FICHA_NUEVA = "if (viewTitleEl && sigueMontada && palabraDelDocumento && viewTitleEl.textContent === palabraDelDocumento) {";
const FICHA_VIEJA = "if (viewTitleEl && sigueMontada && /^Presupuesto #/.test(viewTitleEl.textContent || '')) {";

const MUTANTES = [
  ['M1 · el router y la ficha de ANTES (lo que hay en producción el 13-oct)', [[APP, ROUTER_NUEVO, ROUTER_VIEJO], [FICHA, FICHA_NUEVA, FICHA_VIEJA]]],
  ['M2 · router nuevo con la ficha de antes (la V1 de c.18498: el título se queda sin número)', [[FICHA, FICHA_NUEVA, FICHA_VIEJA]]],
  ['M3 · router de antes con la ficha nueva', [[APP, ROUTER_NUEVO, ROUTER_VIEJO]]],
  ['M4 · el router escribe la palabra A MANO en vez de leerla del locale', [[APP, ROUTER_NUEVO, "viewTitle.textContent = state.quoteId != null ? 'Presupuesto' : L.quotePlural;"]]],
  ['M5 · la ficha corrige el título sin mirar si sigue MONTADA', [[FICHA, FICHA_NUEVA, "if (viewTitleEl && palabraDelDocumento && viewTitleEl.textContent === palabraDelDocumento) {"]]],
  ['M6 · la ficha montada corrige CUALQUIER título, sin mirar que sea el provisional', [[FICHA, FICHA_NUEVA, "if (viewTitleEl && sigueMontada) {"]]],
  ['M7 · el router escribe la palabra y una almohadilla, sin el id', [[APP, ROUTER_NUEVO, "viewTitle.textContent = state.quoteId != null ? L.quote + ' #' : L.quotePlural;"]]],
];

function correr() {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-concurrency=2', '--test-reporter=tap', ...TESTS],
    { cwd: RAIZ, encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP } });
  const tap = String(r.stdout || '');
  const num = (k) => { const m = tap.match(new RegExp(`^# ${k} (\\d+)$`, 'm')); return m ? Number(m[1]) : null; };
  const caidos = [...tap.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]);
  return { tests: num('tests'), pass: num('pass'), fail: num('fail'), caidos };
}

const sucio = execFileSync('git', ['status', '--porcelain', '--', 'public', 'tests'], { cwd: RAIZ, encoding: 'utf8' }).trim();
if (sucio) { console.log(`CIEGO: el árbol no está limpio en public/ o tests/:\n${sucio}`); console.log('EXIT=2'); process.exit(2); }
console.log(`POBLACION=${MUTANTES.length} mutantes · ${TESTS.length} ficheros de test · árbol ${execFileSync('git', ['rev-parse', 'HEAD'], { cwd: RAIZ, encoding: 'utf8' }).trim()}`);

const base = correr();
console.log(`BASE sin mutar · tests ${base.tests} · pasan ${base.pass} · fallan ${base.fail}`);
if (base.tests == null || base.fail !== 0) { console.log('CIEGO: la base no está en verde o no dio recuentos; ningún mutante vale.'); console.log('EXIT=2'); process.exit(2); }

let vivos = 0;
let ciegos = 0;
for (const [nombre, cambios] of MUTANTES) {
  const originales = new Map();
  let aplicado = true;
  for (const [fichero, de, a] of cambios) {
    const antes = fs.readFileSync(fichero);
    originales.set(fichero, antes);
    const texto = antes.toString('utf8');
    const veces = texto.split(de).length - 1;
    if (veces !== 1) { console.log(`\n${nombre}\n   CIEGO: la sustitución casa ${veces} veces en ${path.basename(fichero)} (se espera 1)`); aplicado = false; break; }
    fs.writeFileSync(fichero, texto.replace(de, a));
  }
  let r = null;
  let numstat = '';
  if (aplicado) {
    numstat = execFileSync('git', ['diff', '--numstat', '--', 'public'], { cwd: RAIZ, encoding: 'utf8' }).trim().replace(/\r?\n/g, ' · ');
    r = correr();
  }
  for (const [fichero, bytes] of originales) fs.writeFileSync(fichero, bytes);
  if (!aplicado) { ciegos += 1; continue; }
  console.log(`\n${nombre}`);
  console.log(`   git diff --numstat: ${numstat || 'VACÍO'}`);
  if (!numstat || r.tests == null) { ciegos += 1; console.log('   CIEGO: la mutación no entró o la tanda no dio recuentos'); continue; }
  console.log(`   tests ${r.tests} · pasan ${r.pass} · fallan ${r.fail} → ${r.fail > 0 ? 'MUERE' : '🔴 VIVE'}`);
  for (const c of r.caidos) console.log(`     ✗ ${c}`);
  if (r.fail === 0) vivos += 1;
}

const resto = execFileSync('git', ['status', '--porcelain', '--', 'public', 'tests'], { cwd: RAIZ, encoding: 'utf8' }).trim();
console.log(`\nárbol después: ${resto ? `SUCIO\n${resto}` : 'limpio (git status vacío en public/ y tests/)'}`);
console.log(`RECUENTO · ${MUTANTES.length} mutantes · ${MUTANTES.length - vivos - ciegos} mueren · ${vivos} viven · ${ciegos} ciegos`);
const salida = vivos || ciegos || resto ? 1 : 0;
console.log(`EXIT=${salida}`);
process.exit(salida);
