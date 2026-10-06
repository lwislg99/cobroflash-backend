// tests/banco-scrum1456/mutar.mjs — SCRUM-1455 y SCRUM-1456
//
// UN MUTANTE POR LECTURA DE ID, Y CADA UNO TUMBA SÓLO LO SUYO.
//
// Por cada llamada a `cabeEnColumnaInt(` de los ficheros de rutas (el `import` no cuenta) se hacen
// dos mutaciones, una cada vez:
//   · «entero»  → `Number.isInteger(`      : el defecto de antes. Deja pasar `1e20`.
//   · «seguro»  → `Number.isSafeInteger(`  : el arreglo que PARECE bueno. Deja pasar `10000000000`.
// Se aplica al FUENTE (y se comprueba que se aplicó), se transpila ESE fichero a su sitio en `dist/`,
// se corre `tests/scrum1456-…` y se apunta qué casos caen, POR NOMBRE. Después se restauran fuente y
// `dist/` byte a byte, y al final se comprueba por CONTENIDO (sha256) que han vuelto a ser los que eran.
//
// La pasada «T0» transpila los ficheros SIN mutar: si el test sigue en verde, un rojo de después es
// de la mutación y no del transpilado. Sin T0 en verde el banco se declara CIEGO y no opina.
//
// Se lanza a mano, con el árbol comiteado y `dist/` recién construido, y mientras corre no se mide
// nada más en este árbol:
//   node tests/banco-scrum1456/mutar.mjs <carpeta FUERA del árbol>
// Sale con 0 si todas las mutaciones caen donde deben, 1 si alguna queda VIVA o cae de más, 2 si CIEGO.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const TEST = 'tests/scrum1456-ids-que-no-caben-en-la-columna.test.mjs';
const CLIENTES = 'src/modules/system/app/routes/customersAdmin.routes.ts';
const FACTURAS = 'src/modules/system/app/routes/invoicesAdmin.routes.ts';

// Qué casos «🔴 … → 400» tiene que tumbar cada llamada, en el ORDEN en que aparecen en el fuente.
// Es la misma tabla que `LECTURAS` del test, leída por fichero. `PUT` y `PATCH /:id` comparten línea.
const ESPERADO = {
  [CLIENTES]: [
    ['GET customers /:id · `id` (params)'],
    ['PUT customers /:id · `id` (params)', 'PATCH customers /:id · `id` (params)'],
    ['GET customers /:id/portal-url · `id` (params)'],
    ['GET customers /:id/historial · `id` (params)'],
    ['GET customers /:id/historial · `despuesDe` (query)'],
    ['GET customers /:id/whatsapp · `id` (params)'],
    ['GET customers /:id/whatsapp · `despuesDe` (query)'],
    ['GET customers /:id/notes · `id` (params)'],
    ['POST customers /:id/notes · `id` (params)'],
    ['GET customers /:id/sites · `id` (params)'],
    ['POST customers /:id/sites · `id` (params)'],
    ['PUT customers /:id/sites/:siteId · `id` (params)'],
    ['PUT customers /:id/sites/:siteId · `siteId` (params)'],
    ['DELETE customers /:id/sites/:siteId · `id` (params)'],
    ['DELETE customers /:id/sites/:siteId · `siteId` (params)'],
    ['GET customers /:id/detail · `id` (params)'],
    ['GET customers /:id/fusion-preview · `id` (params)'],
    ['GET customers /:id/fusion-preview · `con` (query)'],
  ],
  [FACTURAS]: [
    ['GET invoices /:id · `id` (params)'],
    ['GET invoices /:id/dispute-package · `id` (params)'],
    ['PUT invoices /:id/tags · `id` (params)'],
    ['GET invoices /:id/pdf · `id` (params)'],
    ['PATCH invoices /:id/asignados · `id` (params)'],
  ],
};
const VARIANTES = [['entero', 'Number.isInteger('], ['seguro', 'Number.isSafeInteger(']];
const AGUJA = 'cabeEnColumnaInt(';

const fuera = process.argv[2];
if (!fuera || path.resolve(fuera).startsWith(RAIZ + path.sep)) {
  console.log('CIEGO: dame una carpeta FUERA del árbol para el TAP · EXIT=2');
  process.exit(2);
}
fs.mkdirSync(fuera, { recursive: true });

const abs = (rel) => path.join(RAIZ, rel);
const enDist = (rel) => abs(rel.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js'));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const opciones = ts.parseJsonConfigFileContent(
  ts.readConfigFile(abs('tsconfig.json'), ts.sys.readFile).config, ts.sys, RAIZ,
).options;

const FICHEROS = [CLIENTES, FACTURAS];
const original = Object.fromEntries(FICHEROS.flatMap((f) => [[abs(f), fs.readFileSync(abs(f))], [enDist(f), fs.readFileSync(enDist(f))]]));
const huella = Object.fromEntries(Object.keys(original).map((f) => [f, sha(f)]));

function transpilar(rel, texto) {
  const salida = ts.transpileModule(texto, { compilerOptions: { ...opciones, sourceMap: false }, fileName: abs(rel) });
  fs.writeFileSync(enDist(rel), salida.outputText);
}
function restaurar() {
  for (const [f, bytes] of Object.entries(original)) fs.writeFileSync(f, bytes);
}

/** Las posiciones de cada llamada en el fuente, sin la del `import`. */
function llamadas(texto) {
  const pos = [];
  for (let i = texto.indexOf(AGUJA); i !== -1; i = texto.indexOf(AGUJA, i + 1)) {
    const linea = texto.slice(texto.lastIndexOf('\n', i) + 1, texto.indexOf('\n', i));
    if (!linea.startsWith('import ')) pos.push(i);
  }
  return pos;
}

let pasada = 0;
function correr() {
  pasada += 1;
  const tap = path.join(fuera, `pasada-${String(pasada).padStart(2, '0')}.tap`);
  fs.rmSync(tap, { force: true });
  // El entorno del hijo se construye a mano: sin lo que el laboratorio le prestaría (SCRUM-1153).
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  delete env.FORCE_COLOR;
  const r = spawnSync(process.execPath, [
    '--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, TEST,
  ], { cwd: RAIZ, env, encoding: 'utf8' });
  const texto = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  const total = Number((texto.match(/^# tests (\d+)$/m) || [])[1] ?? NaN);
  const caen = [...texto.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { status: r.status, total, caen };
}

const filas = [];
let ciego = null;
try {
  // T0 · el transpilado SIN mutar deja el test como estaba.
  for (const f of FICHEROS) transpilar(f, fs.readFileSync(abs(f), 'utf8'));
  const t0 = correr();
  if (!(t0.total > 0) || t0.caen.length > 0 || t0.status !== 0) {
    ciego = `T0 no está en verde (total=${t0.total}, caen=${t0.caen.length}, status=${t0.status})`;
  } else {
    console.log(`T0 · transpilado sin mutar: ${t0.total} casos, 0 caen`);
    for (const f of FICHEROS) {
      const texto = fs.readFileSync(abs(f), 'utf8');
      const pos = llamadas(texto);
      if (pos.length !== ESPERADO[f].length) {
        ciego = `${f}: ${pos.length} llamadas en el fuente y ${ESPERADO[f].length} en la tabla del banco`;
        break;
      }
      for (let k = 0; k < pos.length; k += 1) {
        for (const [nombre, sustituto] of VARIANTES) {
          const mutado = texto.slice(0, pos[k]) + sustituto + texto.slice(pos[k] + AGUJA.length);
          const linea = texto.slice(0, pos[k]).split('\n').length;
          fs.writeFileSync(abs(f), mutado);
          // Que la mutación SE APLICÓ: el fuente en disco lleva una llamada menos.
          const aplicada = llamadas(fs.readFileSync(abs(f), 'utf8')).length === pos.length - 1;
          transpilar(f, mutado);
          const r = correr();
          fs.writeFileSync(abs(f), original[abs(f)]);
          fs.writeFileSync(enDist(f), original[enDist(f)]);
          const esperan = ESPERADO[f][k].map((n) => `SCRUM-1456 · ${n} · 🔴 un id que no cabe en la columna → 400, sin tocar la base`);
          const faltan = esperan.filter((n) => !r.caen.includes(n));
          const sobran = r.caen.filter((n) => !esperan.includes(n));
          let veredicto = 'CAE';
          if (!aplicada || !(r.total > 0)) veredicto = 'CIEGA';
          else if (r.caen.length === 0) veredicto = 'VIVA';
          else if (faltan.length || sobran.length) veredicto = 'CAE DE MÁS O DE MENOS';
          filas.push({ f: path.basename(f), linea, nombre, veredicto, caen: r.caen.length, esperan: esperan.length, sobran });
        }
      }
      if (ciego) break;
    }
  }
} finally {
  restaurar();
}

const intacto = Object.keys(original).every((f) => sha(f) === huella[f]);
for (const x of filas) {
  console.log(`${x.veredicto.padEnd(7)} ${x.f}:${x.linea} «${x.nombre}» · caen ${x.caen} de ${x.esperan} esperados${x.sobran.length ? ' · DE MÁS: ' + x.sobran.join(' | ') : ''}`);
}
const cuenta = (v) => filas.filter((x) => x.veredicto === v).length;
console.log(`POBLACION=${filas.length} mutaciones (${Object.values(ESPERADO).flat().length} llamadas × ${VARIANTES.length}) · caen ${cuenta('CAE')} · vivas ${cuenta('VIVA')} · ciegas ${cuenta('CIEGA')} · mal repartidas ${cuenta('CAE DE MÁS O DE MENOS')}`);
console.log(`ÁRBOL: ${intacto ? 'intacto (sha256 de los 4 ficheros igual que al empezar)' : '🔴 NO HA VUELTO A SER EL QUE ERA'}`);
if (ciego || !intacto || cuenta('CIEGA') > 0) {
  console.log(`CIEGO: ${ciego ?? 'ver arriba'} · EXIT=2`);
  process.exit(2);
}
const bien = cuenta('CAE') === filas.length && filas.length > 0;
console.log(`EXIT=${bien ? 0 : 1}`);
process.exit(bien ? 0 : 1);
