// SCRUM-1599g — el recibo de la tanda gateada guarda fecha y veredicto de CADA fichero, y su último
// verde; `diasSinVerde` dice cuántos días lleva cada uno sin verde, y CIEGO si no hay recibo.
// SIN GATE: no toca BD ni red. Los recibos son FABRICADOS: la tanda gateada de verdad no se corre
// aquí (necesita turno de staging). Lo que sí corre de verdad es el REPORTER, sobre ficheros de
// test fabricados en un temporal FUERA del árbol, con un `node --test` hijo y el entorno limpio.
//
// Decisión del fundador: SCRUM-1599 c.20715 ② («A: Sí, y a Luis lo suyo»). El aviso en el latido es
// de S5; aquí sólo vive la función que consumirá.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { leerFuente } from './_guard-texto.mjs';

import reporterPorFichero, {
  RUTA_RECIBO,
  claveDeFichero,
  veredictoDeFichero,
  leerSalidaReporter,
  fusionarPorFichero,
  diasSinVerde,
  validarEvidencia,
} from '../scripts/_evidencia-tanda.mjs';

// Vistas VIVAS con el código quieto, antes de declararlas (SCRUM-1599 §1599g): cada una tumba SU caso.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // un rojo borra la fecha del último verde: el latido perdería desde cuándo no pasa.
    fichero: 'scripts/_evidencia-tanda.mjs',
    de: '(antes.ultimoVerdeEn ?? null)',
    a: 'null',
    cae: 'SCRUM-1599g · fusionar: lo que corrió pisa su entrada',
  },
  {
    // el borde se mueve un día: N días sin verde avisaría igual que N+1.
    fichero: 'scripts/_evidencia-tanda.mjs',
    de: '(dias !== null && dias > umbralDias)',
    a: '(dias !== null && dias >= umbralDias)',
    cae: 'SCRUM-1599g · un recibo fabricado de N+1 días AVISA',
  },
];

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.parse('2026-10-24T10:00:00.000Z');
const hace = (dias) => new Date(AHORA - dias * DIA).toISOString();

/** Un recibo fabricado con la forma que escribe el runner. */
function reciboCon(porFichero, extra = {}) {
  return JSON.stringify({ commit: 'c'.repeat(40), huella: 'h'.repeat(40), terminadaEn: hace(0),
    total: 1000, pass: 1000, fail: 0, skip: 0, ficheros: 10, hijos: {}, porFichero, ...extra });
}

async function correrReporter(eventos) {
  async function* fuente() { for (const e of eventos) yield e; }
  let salida = '';
  for await (const trozo of reporterPorFichero(fuente())) salida += trozo;
  return salida;
}

test('SCRUM-1599g · el reporter cuenta por fichero: pass, fail y skip; un todo no cuenta', async () => {
  const f = (file, extra = {}) => ({ file, nesting: 0, ...extra });
  const salida = await correrReporter([
    { type: 'test:pass', data: f('C:\\x\\tests\\a.test.mjs') },
    { type: 'test:pass', data: f('C:\\x\\tests\\a.test.mjs', { skip: 'motivo' }) },
    { type: 'test:fail', data: f('/x/tests/b.test.mjs') },
    { type: 'test:fail', data: f('/x/tests/b.test.mjs', { todo: true }) },
    { type: 'test:pass', data: f('/x/tests/c.test.mjs', { skip: true }) },
    { type: 'test:diagnostic', data: { message: 'tests 9' } },
  ]);
  assert.deepEqual(JSON.parse(salida), { porFichero: {
    'a.test.mjs': { pass: 1, fail: 0, skip: 1 },
    'b.test.mjs': { pass: 0, fail: 1, skip: 0 },
    'c.test.mjs': { pass: 0, fail: 0, skip: 1 },
  } });
  assert.deepEqual(leerSalidaReporter(salida), { 'a.test.mjs': 'verde', 'b.test.mjs': 'rojo', 'c.test.mjs': 'saltado' });
});

test('SCRUM-1599g · un fichero sin casos que pasen NO es verde, y una salida cortada no es «todo verde»', () => {
  assert.equal(veredictoDeFichero({ pass: 0, fail: 0, skip: 3 }), 'saltado');
  assert.equal(veredictoDeFichero({ pass: 5, fail: 1, skip: 0 }), 'rojo');
  assert.equal(veredictoDeFichero({ pass: 1, fail: 0, skip: 9 }), 'verde');
  // El hijo que muere antes de terminar deja el fichero vacío o a medias: CIEGO (null), no verde.
  assert.equal(leerSalidaReporter(''), null);
  assert.equal(leerSalidaReporter('{"porFichero":{"a.test.mjs":{"pass"'), null);
  assert.equal(leerSalidaReporter(null), null);
  assert.equal(claveDeFichero('C:\\a\\tests\\x.test.mjs'), 'x.test.mjs');
  assert.equal(claveDeFichero('tests/x.test.mjs'), 'x.test.mjs');
});

test('SCRUM-1599g · el reporter DE VERDAD, cargado por node --test con el spec al lado como en el runner', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'yaqu-1599g-'));
  try {
    writeFileSync(path.join(dir, 'verde.test.mjs'), "import t from 'node:test'; t('pasa', () => {});\n");
    writeFileSync(path.join(dir, 'rojo.test.mjs'), "import t from 'node:test'; t('cae', () => { throw new Error('x'); });\n");
    writeFileSync(path.join(dir, 'saltado.test.mjs'), "import t from 'node:test'; t('salta', { skip: 'sin base' }, () => {});\n");
    writeFileSync(path.join(dir, 'roto.test.mjs'), "throw new Error('carga rota');\n");
    const destino = path.join(dir, 'por-fichero.json');
    const reporter = pathToFileURL(path.join(RAIZ, 'scripts', '_evidencia-tanda.mjs')).href;
    const env = { ...process.env };
    for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete env[k];
    const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-concurrency=1',
      '--test-reporter=spec', '--test-reporter-destination=stdout',
      `--test-reporter=${reporter}`, `--test-reporter-destination=${destino}`,
      ...['verde', 'rojo', 'saltado', 'roto'].map((n) => path.join(dir, `${n}.test.mjs`))],
    { cwd: dir, env, encoding: 'utf8', timeout: 60_000 });
    // El spec sigue en stdout: de su resumen depende `parseCuenta` (SCRUM-197).
    assert.match(r.stdout, /^ℹ tests 4$/m, `el spec ya no llega a stdout:\n${r.stdout}\n${r.stderr}`);
    assert.equal(r.status, 1, 'hay un rojo: el hijo sale 1');
    assert.deepEqual(leerSalidaReporter(readFileSync(destino, 'utf8')), {
      'verde.test.mjs': 'verde', 'rojo.test.mjs': 'rojo', 'saltado.test.mjs': 'saltado', 'roto.test.mjs': 'rojo',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-1599g · fusionar: lo que corrió pisa su entrada, lo que no corrió se queda, el último verde se conserva', () => {
  const previo = {
    'a.test.mjs': { veredicto: 'verde', veredictoEn: hace(10), ultimoVerdeEn: hace(10) },
    'b.test.mjs': { veredicto: 'verde', veredictoEn: hace(10), ultimoVerdeEn: hace(10) },
    'c.test.mjs': { veredicto: 'rojo', veredictoEn: hace(10), ultimoVerdeEn: null },
  };
  const ahora = hace(0);
  const nuevo = fusionarPorFichero(previo, { 'a.test.mjs': 'rojo', 'c.test.mjs': 'verde', 'd.test.mjs': 'saltado', 'e.test.mjs': 'inventado' }, ahora);
  assert.deepEqual(nuevo['a.test.mjs'], { veredicto: 'rojo', veredictoEn: ahora, ultimoVerdeEn: hace(10) },
    'un rojo NO borra la fecha del último verde: es lo que el latido necesita');
  assert.deepEqual(nuevo['b.test.mjs'], previo['b.test.mjs'], 'lo que no corrió se queda como estaba');
  assert.deepEqual(nuevo['c.test.mjs'], { veredicto: 'verde', veredictoEn: ahora, ultimoVerdeEn: ahora });
  assert.deepEqual(nuevo['d.test.mjs'], { veredicto: 'saltado', veredictoEn: ahora, ultimoVerdeEn: null });
  assert.equal(nuevo['e.test.mjs'], undefined, 'un veredicto que no es de los tres no entra');
  assert.deepEqual(fusionarPorFichero(null, { 'a.test.mjs': 'verde' }, ahora),
    { 'a.test.mjs': { veredicto: 'verde', veredictoEn: ahora, ultimoVerdeEn: ahora } }, 'sin recibo previo, empieza hoy');
});

test('SCRUM-1599g · sin recibo, CIEGO; con el recibo de antes (sin desglose por fichero), CIEGO', () => {
  for (const texto of [null, undefined, '', '   ']) {
    const r = diasSinVerde({ texto, ahoraMs: AHORA, umbralDias: 7 });
    assert.equal(r.estado, 'CIEGO');
    assert.equal(r.poblacion, 0);
    assert.match(r.motivo, new RegExp(RUTA_RECIBO.replace(/\./g, '\\.')));
  }
  assert.equal(diasSinVerde({ texto: '{no es json', ahoraMs: AHORA }).estado, 'CIEGO');
  // La forma del ÚNICO recibo de la máquina (4-sep-2026, SCRUM-1599 c.20713 ②): sin `porFichero`.
  const delCuatroDeSeptiembre = JSON.stringify({ commit: 'c'.repeat(40), huella: 'h'.repeat(40),
    terminadaEn: '2026-09-04T22:46:26.000Z', total: 900, fail: 0, hijos: { qa: null } });
  const r = diasSinVerde({ texto: delCuatroDeSeptiembre, ahoraMs: AHORA, umbralDias: 7 });
  assert.equal(r.estado, 'CIEGO', 'un recibo sin desglose no dice nada de ningún fichero: CIEGO, no verde');
  assert.match(r.motivo, /desglose por fichero/);
  assert.equal(diasSinVerde({ texto: reciboCon({}), ahoraMs: AHORA }).estado, 'CIEGO', 'un desglose vacío tampoco');
});

test('SCRUM-1599g · un recibo fabricado de N+1 días AVISA; uno de N días no (el borde sale del umbral)', () => {
  const N = 7;
  const texto = reciboCon({
    'viejo.test.mjs': { veredicto: 'rojo', veredictoEn: hace(0), ultimoVerdeEn: hace(N + 1) },
    'justo.test.mjs': { veredicto: 'rojo', veredictoEn: hace(0), ultimoVerdeEn: hace(N) },
    'fresco.test.mjs': { veredicto: 'verde', veredictoEn: hace(0), ultimoVerdeEn: hace(0) },
  });
  const r = diasSinVerde({ texto, ahoraMs: AHORA, umbralDias: N });
  assert.equal(r.estado, 'OK');
  assert.equal(r.poblacion, 3, 'declara sobre cuántos ficheros midió');
  const por = Object.fromEntries(r.ficheros.map((f) => [f.fichero, f]));
  assert.equal(por['viejo.test.mjs'].dias, N + 1);
  assert.equal(por['viejo.test.mjs'].estado, 'sin-verde');
  assert.equal(por['viejo.test.mjs'].avisa, true, `${N + 1} días sin verde con umbral ${N} tiene que avisar`);
  assert.equal(por['justo.test.mjs'].dias, N);
  assert.equal(por['justo.test.mjs'].avisa, false);
  assert.equal(por['fresco.test.mjs'].estado, 'verde');
  assert.equal(por['fresco.test.mjs'].avisa, false);
  assert.deepEqual(r.avisos.map((f) => f.fichero), ['viejo.test.mjs']);
  // Un verde VIEJO también avisa: la última tanda que lo vio verde fue hace N+1 días.
  const verdeViejo = diasSinVerde({ texto: reciboCon({ 'v.test.mjs': { veredicto: 'verde', veredictoEn: hace(N + 1), ultimoVerdeEn: hace(N + 1) } }), ahoraMs: AHORA, umbralDias: N });
  assert.equal(verdeViejo.ficheros[0].avisa, true);
  // Sin umbral la edad se da igual, y `avisa` queda sin calcular (el número no está decidido).
  const sinUmbral = diasSinVerde({ texto, ahoraMs: AHORA });
  assert.equal(sinUmbral.ficheros.find((f) => f.fichero === 'viejo.test.mjs').dias, N + 1);
  assert.ok(sinUmbral.ficheros.every((f) => f.avisa === null));
});

test('SCRUM-1599g · el positivo sembrado: quitar el fichero del recibo da CIEGO, no verde', () => {
  const lleno = { 'sembrado.test.mjs': { veredicto: 'verde', veredictoEn: hace(0), ultimoVerdeEn: hace(0) },
    'otro.test.mjs': { veredicto: 'verde', veredictoEn: hace(0), ultimoVerdeEn: hace(0) } };
  const conEl = diasSinVerde({ texto: reciboCon(lleno), ahoraMs: AHORA, ficheros: ['tests/sembrado.test.mjs'], umbralDias: 7 });
  assert.equal(conEl.ficheros[0].estado, 'verde');
  const { 'sembrado.test.mjs': _, ...sinEl } = lleno;
  const r = diasSinVerde({ texto: reciboCon(sinEl), ahoraMs: AHORA, ficheros: ['tests/sembrado.test.mjs'], umbralDias: 7 });
  assert.equal(r.poblacion, 1);
  assert.equal(r.ficheros[0].estado, 'CIEGO', 'un fichero que el recibo no nombra no está verde: no se ha mirado');
  assert.equal(r.ficheros[0].avisa, true);
  // Rojo sin ningún verde registrado avisa; saltado sin verde no (la tanda no lo mide).
  const r2 = diasSinVerde({ texto: reciboCon({
    'r.test.mjs': { veredicto: 'rojo', veredictoEn: hace(0), ultimoVerdeEn: null },
    's.test.mjs': { veredicto: 'saltado', veredictoEn: hace(0), ultimoVerdeEn: null } }), ahoraMs: AHORA, umbralDias: 7 });
  assert.deepEqual(r2.ficheros.map((f) => [f.fichero, f.estado, f.avisa]), [['r.test.mjs', 'nunca-verde', true], ['s.test.mjs', 'saltado', false]]);
});

test('SCRUM-1599g · el desglose por fichero no cambia lo que SCRUM-161 decide del recibo', () => {
  const base = { texto: null, commitActual: 'c'.repeat(40), huellaActual: { huella: 'h'.repeat(40), ficheros: 600 }, ahoraMs: AHORA, ficherosEsperados: 10 };
  const hijos = { a55: { exit: 0, fail: 0 }, bot: { exit: 0, fail: 0 }, scrum180: { exit: 0, fail: 0 }, qa: { exit: 0, fail: 0 } };
  const sin = validarEvidencia({ ...base, texto: reciboCon(undefined, { hijos }) });
  const con = validarEvidencia({ ...base, texto: reciboCon({ 'a.test.mjs': { veredicto: 'rojo', veredictoEn: hace(0), ultimoVerdeEn: null } }, { hijos }) });
  assert.equal(sin.ok, true, JSON.stringify(sin.problemas));
  assert.deepEqual(con.problemas, sin.problemas);
});

test('SCRUM-1599g · el runner carga el reporter, lee su salida y escribe `porFichero` en el recibo', () => {
  const fuente = leerFuente(path.join(RAIZ, 'scripts/staging-gated.mjs'), { ancla: '_evidencia-tanda' });
  assert.match(fuente, /--test-reporter=spec/, 'sin nombrar el spec, el segundo reporter lo quita de stdout y parseCuenta se queda a ceros');
  assert.match(fuente, /--test-reporter-destination=stdout/);
  assert.match(fuente, /pathToFileURL\(path\.join\(HERE, '_evidencia-tanda\.mjs'\)\)/, 'el reporter es el export default de _evidencia-tanda.mjs');
  assert.match(fuente, /leerSalidaReporter\(/);
  assert.match(fuente, /fusionarPorFichero\(previo, veredictosPorFichero, terminadaEn\)/);
  assert.match(fuente, /^\s*porFichero,$/m, 'el recibo lleva el campo porFichero');
  assert.match(fuente, /mkdtempSync\(path\.join\(os\.tmpdir\(\)/, 'la salida del reporter va FUERA del árbol (SCRUM-824) y en un directorio único por tanda (scrum258)');
});
