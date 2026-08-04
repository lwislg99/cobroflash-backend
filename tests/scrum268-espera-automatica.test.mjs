// tests/scrum268-espera-automatica.test.mjs — SCRUM-268 punto 3 (guard estructural, sin gate).
//
// NADIE ESPERA EL TURNO EN UN BUCLE Y LO TOMA.
//
// Origen medido, en la descripción del ticket: un esperador en segundo plano consultaba
// `turno:estado` cada 60 s; en el intento 8 vio LIBRE y TOMÓ el turno (`DESKTOP-T5MONF5.22844`,
// 14:01:05Z), quedándose con lo que un humano acababa de ceder a otra sesión.
//
//     «cualquier automatismo que espere y tome gana siempre a un humano que espera y decide»
//
// Este fichero es la mitad del ticket que NO cambia la semántica del turno (los puntos 1 y 2
// —`turno:ceder --a` y que `adquirirLock` rechace a quien no es el destinatario— tienen GATE de
// fundador y viven en otra rama). Aquí solo se prohíbe la FORMA en el repo.
//
// ⚠️ LOS EJEMPLOS DE ABAJO VAN EN CADENAS A PROPÓSITO. No es estilo: es lo que hace que este
// fichero no se denuncie a sí mismo. Un `grep` casaría su propia prosa (SCRUM-176/168/3); el
// AST no, porque el código dentro de una cadena no produce nodos de bucle. La inmunidad es
// estructural, no una excepción escrita a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analizar, NOMBRES_ADQUISICION } from './_espera-automatica.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const ARBOLES = ['scripts', 'tests', 'src'];
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

// ── CENSO DERIVADO DEL ÁRBOL, jamás una lista a mano ──────────────────────────
// Una lista escrita a mano no avisa de lo que le falta: el fichero nuevo que nadie añade no se
// mira nunca, y el guard sigue verde. Se recorre el directorio.
function ficheros(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, out);
    else if (/\.(ts|tsx|mjs|cjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const CENSO = ARBOLES.flatMap((d) => ficheros(path.join(RAIZ, d)));
const ANALISIS = CENSO.map((p) => ({ ruta: rel(p), ...analizar(fs.readFileSync(p, 'utf8'), rel(p)) }));

// ─────────────────────────────────────────────────────────────────────────────
// 1 · EL SUELO. Sin esto, «no hay bucle esperador» y «no supe mirar» son el mismo
//     número y significan lo contrario.
// ─────────────────────────────────────────────────────────────────────────────
test('SCRUM-268 · SUELO: el censo se recorrió de verdad', () => {
  assert.ok(CENSO.length >= 100,
    `🔴 solo ${CENSO.length} ficheros en el censo: el recorrido del árbol está roto y este guard ` +
    'no está mirando el repo. Un censo vacío da verde por no ver, no por estar limpio.');
});

test('SCRUM-268 · SUELO: el detector VE los bucles que hay en el repo', () => {
  const bucles = ANALISIS.reduce((t, a) => t + a.bucles, 0);
  assert.ok(bucles >= 50,
    `🔴 el detector solo vio ${bucles} bucles en ${CENSO.length} ficheros. En este repo hay muchos ` +
    'más: si el reconocimiento de bucles se rompiera, este guard daría verde sobre cualquier cosa.');
});

test('SCRUM-268 · SUELO: el detector VE la adquisición real del turno', () => {
  const conAdquisicion = ANALISIS.filter((a) => a.adquisicionesDirectas > 0).map((a) => a.ruta);
  assert.ok(conAdquisicion.length >= 1,
    `🔴 el detector no encontró NI UNA adquisición del turno en todo el repo. Pero las hay ` +
    `(el CLI y el runner la usan): si no las ve, tampoco vería una dentro de un bucle. ` +
    `Símbolos buscados: ${[...NOMBRES_ADQUISICION].join(', ')}.`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · CONTROL POSITIVO — el detector reconoce lo prohibido. Si esto no cae, el
//     verde del repo no significa nada.
// ─────────────────────────────────────────────────────────────────────────────
test('SCRUM-268 · POSITIVO: un bucle que espera y adquiere se detecta', () => {
  const esperador = `
    while (true) {
      const estado = await leerMarcaCruda(cliente);
      if (!estado.marca.includes('lock:')) {
        await adquirirLock(cliente, { dueño: 'yo', ttlMs: 1000 });
        break;
      }
      await new Promise((r) => setTimeout(r, 60000));
    }
  `;
  const r = analizar(esperador, 'sintetico.mjs');
  assert.equal(r.violaciones.length, 1, 'el esperador del incidente TIENE que caer');
  assert.match(r.violaciones[0].motivo, /ADQUIERE el turno/);
});

test('SCRUM-268 · POSITIVO: la forma EVASIVA (asignar y luego mirar) también cae', () => {
  // Un guard que solo mirase la llamada como sentencia se esquiva con esto.
  const evasivo = `
    for (let i = 0; i < 20; i++) {
      const x = await adquirirLock(cliente, { dueño: 'yo' });
      if (x && x.ok) break;
    }
  `;
  const r = analizar(evasivo, 'evasivo.mjs');
  assert.equal(r.violaciones.length, 1, 'asignar el resultado no puede servir para esquivar el guard');
});

test('SCRUM-268 · POSITIVO: la indirección dentro del fichero también cae', () => {
  const indirecto = `
    async function intentarUnaVez() { return adquirirLock(cliente, { dueño: 'yo' }); }
    while (!tengoTurno) {
      const r = await intentarUnaVez();
      if (r.ok) tengoTurno = true;
    }
  `;
  const r = analizar(indirecto, 'indirecto.mjs');
  assert.equal(r.violaciones.length, 1, 'envolver la adquisición en una función local no puede bastar');
  assert.match(r.violaciones[0].motivo, /función local que ADQUIERE/);
});

test('SCRUM-268 · POSITIVO: esperar y lanzar el CLI en modo `tomar` también cae', () => {
  const porCli = `
    while (true) {
      const r = spawnSync('node', ['scripts/turno-staging.mjs', 'tomar', '--ref', 'x']);
      if (r.status === 0) break;
    }
  `;
  const r = analizar(porCli, 'cli.mjs');
  assert.equal(r.violaciones.length, 1, 'adquirir por subproceso es adquirir igual');
});

test('SCRUM-268 · POSITIVO: un setInterval que adquiere cae (se repite igual que un bucle)', () => {
  const porTimer = `
    setInterval(async () => {
      await adquirirLock(cliente, { dueño: 'yo' });
    }, 60000);
  `;
  const r = analizar(porTimer, 'timer.mjs');
  assert.equal(r.violaciones.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · CONTROL NEGATIVO — si tumba lo legítimo, el guard no distingue y no vale.
// ─────────────────────────────────────────────────────────────────────────────
test('SCRUM-268 · NEGATIVO: esperar MIRANDO, sin adquirir, es legítimo', () => {
  const soloMira = `
    while (true) {
      const estado = await leerMarcaCruda(cliente);
      console.log('turno:', estado.marca);
      await new Promise((r) => setTimeout(r, 60000));
    }
  `;
  assert.deepEqual(analizar(soloMira, 'mirón.mjs').violaciones, [],
    'consultar el estado en bucle y solo imprimirlo NO compite con nadie: no puede caer');
});

test('SCRUM-268 · NEGATIVO: adquirir UNA vez, fuera de todo bucle, es legítimo', () => {
  const unaVez = `
    const res = await adquirirLock(cliente, { dueño: 'yo', ttlMs: 1000 });
    for (const hijo of hijos) { await refrescarLock(cliente, { marcaPropia }); }
  `;
  assert.deepEqual(analizar(unaVez, 'runner.mjs').violaciones, [],
    'es la forma del runner real: adquiere fuera del bucle y dentro solo REFRESCA');
});

test('SCRUM-268 · NEGATIVO: una TABLA DE CASOS que adquiere no es un esperador', () => {
  // Caso REAL: la primera versión de este guard marcó tests/scrum188-turno-staging.test.mjs:246,
  // que recorre fixtures contra un cliente falso para comprobar que adquirirLock se NIEGA.
  // Va como control negativo y no como excepción a mano: una excepción tapa el caso, un control
  // explica POR QUÉ es legítimo y avisa el día que el detector deje de distinguirlo.
  const tablaDeCasos = `
    for (const marca of [null, 'PROD', 'YAQU_STAGINGX', '']) {
      const cli = clienteFalso({ marca });
      const res = await adquirirLock(cli, { dueño: 'yo.1', ttlMs: min(45) });
      assert.equal(res.ok, false);
      assert.equal(res.motivo, 'no-es-staging');
    }
  `;
  assert.deepEqual(analizar(tablaDeCasos, 'tabla.mjs').violaciones, [],
    'no duerme, no corta el flujo y no tiene condición atada: itera fixtures, no espera turno');
});

test('SCRUM-268 · NEGATIVO: refrescar dentro de un bucle NO es adquirir', () => {
  const refresca = `
    while (quedanHijos) { await refrescarLock(cliente, { marcaPropia, dueño }); }
  `;
  assert.deepEqual(analizar(refresca, 'refresco.mjs').violaciones, [],
    'quien refresca YA tiene el turno: no compite por él');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 · EL REPO, HOY
// ─────────────────────────────────────────────────────────────────────────────
test('SCRUM-268 · el repo no contiene ningún esperador automático del turno', () => {
  const malos = ANALISIS.filter((a) => a.violaciones.length > 0);
  const detalle = malos
    .map((a) => a.violaciones.map((v) => `   · ${a.ruta}:${v.linea} — ${v.motivo}`).join('\n'))
    .join('\n');
  assert.equal(malos.length, 0,
    '🔴 SCRUM-268: hay un bucle que espera el turno y lo TOMA:\n' + detalle +
    '\n   Un automatismo que espera y toma gana SIEMPRE a un humano que espera y decide.\n' +
    '   Espera mirando y que la decisión de tomarlo la firme una persona.');
});
