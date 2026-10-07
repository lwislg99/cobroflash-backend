// tests/banco-scrum1477/mutar.mjs — SCRUM-1477
//
// EL TEST DE SCRUM-1477, VISTO CAER. Cada mutación rompe UNA cosa de lo que el ticket pide y se
// comprueba que el test la caza, y cuáles de sus casos la cazan.
//
// Las mutaciones de `dist/` se aplican sobre el `.js` ya construido (es lo que ejecuta el
// laboratorio); la de `src/` es para el censo por AST, que lee el fuente. Cada fichero se
// restaura con el contenido que tenía y se comprueba por sha256 que quedó igual.
//
// USO (con `dist/` construido): node tests/banco-scrum1477/mutar.mjs <carpeta FUERA del árbol>
// Sale con 0 sólo si la base pasa entera, todas las mutaciones caen y el control no cae.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEST = path.join(RAIZ, 'tests', 'scrum1477-meta-dijo-que-no-o-no-contesto.test.mjs');
const DIST = path.join(RAIZ, 'dist', 'integrations', 'whatsapp.js');
const SRC = path.join(RAIZ, 'src', 'integrations', 'whatsapp.ts');

const salida = process.argv[2];
if (!salida || path.resolve(salida).startsWith(RAIZ + path.sep)) {
  console.error('Falta la carpeta de salida, o está DENTRO del árbol (los guards que leen el árbol verían los TAP).');
  process.exit(2);
}
fs.mkdirSync(salida, { recursive: true });

/** Sustituye la aparición número `n` (desde 1) de `de`. Lanza si no hay tantas: una mutación que no se aplica se lee igual que una muda. */
function enLa(n, de, a) {
  return (texto) => {
    let pos = -1;
    for (let i = 0; i < n; i++) {
      pos = texto.indexOf(de, pos + 1);
      if (pos === -1) throw new Error(`la mutación no se aplica: «${de}» no aparece ${n} veces`);
    }
    return texto.slice(0, pos) + a + texto.slice(pos + de.length);
  };
}

const DEVUELVE_JS = 'desenlace: desenlaceDeMeta(err) }';
const DEVUELVE_TS = 'desenlace: desenlaceDeMeta(err) }';

const MUTACIONES = [
  { id: 'M1', que: 'un 5xx pasa a ser un rechazo', fichero: DIST, muta: enLa(1, 'status < 500', 'status < 600') },
  { id: 'M2', que: 'el 408 pasa a ser un rechazo', fichero: DIST, muta: enLa(1, ' && status !== 408', '') },
  { id: 'M3', que: 'ningún 4xx es un rechazo', fichero: DIST, muta: enLa(1, 'status >= 400', 'status >= 600') },
  { id: 'M4', que: 'el freno de salida deja de ser «no enviado»', fichero: DIST, muta: enLa(1, "return 'no_enviado'", "return 'sin_respuesta'") },
  { id: 'M5', que: 'todo lo que no es rechazo dice «rechazado»', fichero: DIST, muta: enLa(1, "return 'sin_respuesta'", "return 'rechazado'") },
  { id: 'M6', que: 'el primer envío (plantilla) no dice el desenlace', fichero: DIST, muta: enLa(1, `, ${DEVUELVE_JS}`, ' }') },
  { id: 'M7', que: 'el cuarto envío (lista) no dice el desenlace', fichero: DIST, muta: enLa(4, `, ${DEVUELVE_JS}`, ' }') },
  { id: 'M8', que: 'el último envío (ubicación) no dice el desenlace', fichero: DIST, muta: enLa(7, `, ${DEVUELVE_JS}`, ' }') },
  { id: 'M9', que: 'un envío pone el desenlace en `reason`', fichero: DIST, muta: enLa(2, DEVUELVE_JS, 'reason: desenlaceDeMeta(err) }') },
  { id: 'M10', que: 'un envío deja de devolver `error`', fichero: DIST, muta: enLa(3, 'error: err?.response?.data || err?.message, desenlace', 'desenlace') },
  { id: 'M11', que: 'un envío pide otro plazo a Meta', fichero: DIST, muta: enLa(5, 'timeout: 10_000', 'timeout: 9_000') },
  { id: 'M12', que: 'en el FUENTE, un `catch` devuelve un desenlace fijo', fichero: SRC, muta: enLa(6, DEVUELVE_TS, "desenlace: 'sin_respuesta' as const }") },
  { id: 'M13', que: 'por ventana: un texto sin respuesta deja de mandar sobre la plantilla rechazada', fichero: DIST, muta: enLa(1, "falloEnVentana?.desenlace === 'sin_respuesta'", "falloEnVentana?.desenlace === 'nunca'") },
  { id: 'M14', que: 'por ventana y sin plantilla: no sube el desenlace', fichero: DIST, muta: enLa(1, '...(falloEnVentana.desenlace ? { desenlace: falloEnVentana.desenlace } : {}),', '') },
  { id: 'M15', que: 'por ventana y sin plantilla: el desenlace pisa el `reason` de SCRUM-1436', fichero: DIST, muta: enLa(1, "reason: falloEnVentana.reason ?? 'whatsapp_send_failed'", "reason: falloEnVentana.reason ?? falloEnVentana.desenlace") },
  { id: 'C1', que: 'CONTROL: un comentario, no cambia nada', fichero: DIST, muta: enLa(1, 'function desenlaceDeMeta(err) {', 'function desenlaceDeMeta(err) { /* control */'), esperaMuda: true },
];

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

/** El entorno del test, a mano: sin lo que haría que el hijo no ejecutara nada o pisara el informe de quien lo lanza. */
function entorno() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  delete env.FORCE_COLOR;
  return env;
}

function correr(etiqueta) {
  const tap = path.join(salida, `${etiqueta}.tap`);
  fs.rmSync(tap, { force: true });
  const r = spawnSync(process.execPath,
    ['--test', '--test-reporter=tap', `--test-reporter-destination=${tap}`, TEST],
    { env: entorno(), encoding: 'utf8', timeout: 300_000 });
  if (!fs.existsSync(tap)) return { ciego: true, motivo: `sin TAP (status ${r.status})` };
  const texto = fs.readFileSync(tap, 'utf8');
  const num = (k) => { const m = texto.match(new RegExp(`^# ${k} (\\d+)$`, 'm')); return m ? Number(m[1]) : null; };
  const tests = num('tests'), pasan = num('pass'), caen = num('fail');
  if (tests === null || pasan === null || caen === null) return { ciego: true, motivo: 'TAP sin recuentos' };
  const cuales = [...texto.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { ciego: false, tests, pasan, caen, cuales, status: r.status };
}

const filas = [];
const base = correr('base');
console.log(`POBLACION: ${MUTACIONES.length} mutaciones (${MUTACIONES.filter((m) => !m.esperaMuda).length} que deben caer + ${MUTACIONES.filter((m) => m.esperaMuda).length} control) · test: ${path.relative(RAIZ, TEST)}`);
console.log(`BASE: ${base.ciego ? `CIEGA (${base.motivo})` : `${base.pasan} de ${base.tests} pasan, ${base.caen} caen`}`);
if (base.ciego || base.caen !== 0 || base.tests === 0) {
  console.log('La base no pasa entera: sin ella un test que ya caía se leería como una mutación cazada. No se muta.');
  console.log('EXIT=1');
  process.exit(1);
}

let mal = 0;
for (const m of MUTACIONES) {
  const antes = fs.readFileSync(m.fichero, 'utf8');
  const huella = sha(m.fichero);
  let fila;
  try {
    const mutado = m.muta(antes);
    if (mutado === antes) throw new Error('la mutación no cambia el fichero');
    fs.writeFileSync(m.fichero, mutado);
    const r = correr(m.id);
    if (r.ciego) fila = { ...m, veredicto: 'CIEGA', detalle: r.motivo };
    else if (r.tests !== base.tests) fila = { ...m, veredicto: 'CIEGA', detalle: `corrieron ${r.tests} casos y la base tiene ${base.tests}` };
    else if (r.caen > 0) fila = { ...m, veredicto: 'CAE', detalle: `${r.caen} de ${r.tests}`, cuales: r.cuales };
    else fila = { ...m, veredicto: 'MUDA', detalle: `0 de ${r.tests}` };
  } catch (e) {
    fila = { ...m, veredicto: 'CIEGA', detalle: String(e.message) };
  } finally {
    fs.writeFileSync(m.fichero, antes);
  }
  if (sha(m.fichero) !== huella) {
    console.log(`🔴 ${m.id}: el fichero NO ha quedado como estaba (${path.relative(RAIZ, m.fichero)}). Se para.`);
    console.log('EXIT=1');
    process.exit(1);
  }
  const bien = m.esperaMuda ? fila.veredicto === 'MUDA' : fila.veredicto === 'CAE';
  if (!bien) mal++;
  filas.push(fila);
  console.log(`${bien ? 'ok ' : 'MAL'} ${m.id} · ${fila.veredicto} (${fila.detalle}) · ${m.que} · ${path.relative(RAIZ, m.fichero).replace(/\\/g, '/')}`);
  for (const c of fila.cuales ?? []) console.log(`       cae: ${c}`);
}

const caen = filas.filter((f) => f.veredicto === 'CAE').length;
console.log(`RESUMEN: ${caen} caen · ${filas.filter((f) => f.veredicto === 'MUDA').length} mudas · ${filas.filter((f) => f.veredicto === 'CIEGA').length} ciegas · ${mal} que no hicieron lo esperado`);
console.log(`EXIT=${mal === 0 ? 0 : 1}`);
process.exit(mal === 0 ? 0 : 1);
