// tests/scrum1470c-la-factura-imprime-el-dia-de-su-registro.test.mjs — SCRUM-1470c
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL PDF DE LA FACTURA IMPRIME EL MISMO DÍA QUE SU REGISTRO FISCAL
//
// Decisión del fundador (SCRUM-1470 c.20530, «Sí, el mismo día»): la «Fecha:» del PDF de la FACTURA
// es el día natural de su `FechaExpedicionFactura`, que `verifactu.service` escribe con
// `formatDateES(createdAt, zonaDelMerchant(merchant))`. Medido el 23-oct-2026 con el proceso en UTC
// (como Railway): una factura del 3-oct a las 00:30 de Madrid imprimía «02/10/2026» y su registro
// decía 03-10-2026. `dateStr` pintaba con `getDate()`, o sea con el reloj del proceso.
//
// Para un negocio SIN zona declarada no cambia nada: `zonaDelMerchant` cae a UTC (decisión A del
// 2-sep-2026, SCRUM-643), que es lo que el proceso de producción ya imprimía.
//
// ── CÓMO SE MIDE ────────────────────────────────────────────────────────────────────────────────
// `tests/_sonda-fecha-de-la-factura.mjs`: un hijo que ARRANCA en UTC, genera el PDF real y lee su
// texto, y calcula el día del registro con la función que lo escribe. Sin el hijo, en una máquina
// que va en la hora de Madrid este fichero saldría verde sin el arreglo.
// Lo esperado va ESCRITO A MANO: si saliera de la función que lo pinta, se compararía consigo mismo.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { entornoLimpio } from '../scripts/_trinquete-de-zona.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const MADRID = 'Europe/Madrid';
const CANARIAS = 'Atlantic/Canary';

/** El desplazamiento de `zona` (en minutos) en ese instante, preguntado a `Intl`. */
function desplazamiento(t, zona) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(t))) p[x.type] = x.value;
  const pared = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
  return Math.round((pared - t) / 60_000);
}

/** El instante en que `zona` marca ese reloj de pared (mismo cálculo que el test de SCRUM-1470). */
function alas(zona, [y, m, d], [hh, mm, ss = 0]) {
  const objetivo = Date.UTC(y, m - 1, d, hh, mm, ss);
  let t = objetivo;
  for (let i = 0; i < 3; i++) t = objetivo - desplazamiento(t, zona) * 60_000;
  return new Date(t).toISOString();
}

// `fecha` y `vispera` van escritas A MANO.
const CASOS = {
  verano: { zona: MADRID, instante: alas(MADRID, [2026, 10, 3], [0, 30]), fecha: '03/10/2026', vispera: '02/10/2026' },
  invierno: { zona: MADRID, instante: alas(MADRID, [2026, 1, 15], [0, 30]), fecha: '15/01/2026', vispera: '14/01/2026' },
  canarias: { zona: CANARIAS, instante: alas(CANARIAS, [2026, 7, 10], [0, 30]), fecha: '10/07/2026', vispera: '09/07/2026' },
  // Los controles que pueden tumbar el arreglo: una factura de mediodía no se mueve…
  mediodia: { zona: MADRID, instante: alas(MADRID, [2026, 10, 2], [14, 0]), fecha: '02/10/2026' },
  // …y el mismo instante del caso de verano, SIN zona o con una zona rota, sale como salía (UTC).
  sinZona: { zona: '', instante: alas(MADRID, [2026, 10, 3], [0, 30]), fecha: '02/10/2026' },
  zonaRota: { zona: 'No/Existe', instante: alas(MADRID, [2026, 10, 3], [0, 30]), fecha: '02/10/2026' },
  // El BORDE, derivado: el primer segundo del día del negocio y el último del anterior.
  bordeDentro: { zona: MADRID, instante: alas(MADRID, [2026, 10, 3], [0, 0, 0]), fecha: '03/10/2026' },
  bordeFuera: { zona: MADRID, instante: alas(MADRID, [2026, 10, 2], [23, 59, 59]), fecha: '02/10/2026' },
};
const NOMBRES = Object.keys(CASOS);
const CRUCES = ['verano', 'invierno', 'canarias'];

let memo = null;
/** La sonda, UNA vez, en UTC. Si no arranca ahí o no recorre todo, aquí no se mide nada: CIEGO. */
function sonda() {
  if (memo) return memo;
  const encargo = NOMBRES.map((n) => ({ zona: CASOS[n].zona, instante: CASOS[n].instante }));
  const r = spawnSync(process.execPath,
    [path.join(RAIZ, 'tests', '_sonda-fecha-de-la-factura.mjs'), 'UTC', JSON.stringify(encargo)],
    { encoding: 'utf8', env: entornoLimpio('UTC'), maxBuffer: 16 * 1024 * 1024 });
  const ultima = String(r.stdout || '').trim().split('\n').pop() || '';
  let j = null;
  try { j = JSON.parse(ultima); } catch { /* se dice abajo */ }
  assert.ok(j, `🔴 CIEGO: la sonda no devolvió JSON (estado ${r.status}). stderr: ${String(r.stderr).slice(-1500)}`);
  assert.ok(!j.ciego, `🔴 CIEGO: la sonda dice «${j.ciego}»`);
  assert.equal(r.status, 0, `🔴 CIEGO: la sonda salió con ${r.status}`);
  assert.equal(j.zonaDelProceso, 'UTC', '🔴 CIEGO: la sonda no arrancó en UTC: mediría el reloj de esta máquina');
  assert.equal(j.casos.length, NOMBRES.length, '🔴 CIEGO: la sonda no recorrió todos los casos');
  memo = j;
  return memo;
}

/** Lo que salió de un caso, con su suelo: el PDF dijo una «Fecha:» y el registro una fecha. */
function caso(nombre) {
  const c = sonda().casos[NOMBRES.indexOf(nombre)];
  assert.equal(c.instante, CASOS[nombre].instante, `🔴 SUELO: el caso «${nombre}» no está en su sitio`);
  assert.ok(c.pdf, `🔴 SUELO (${nombre}): no encontré «Fecha: dd/mm/aaaa» en el PDF: un hueco se leería como «no dice la víspera»`);
  assert.match(c.registro, /^\d{2}\/\d{2}\/\d{4}$/, `🔴 SUELO (${nombre}): el registro dio «${c.registro}»`);
  return c;
}

test('SCRUM-1470c · SUELO: los tres instantes de las 00:30 caen en OTRO día en UTC, con el desplazamiento de su fecha', () => {
  const desplazamientos = [];
  for (const nombre of CRUCES) {
    const t = Date.parse(CASOS[nombre].instante);
    const enUtc = new Date(t).toISOString().slice(0, 10).split('-').reverse().join('/');
    assert.equal(enUtc, CASOS[nombre].vispera, `🔴 SUELO (${nombre}): en UTC este instante no cae en la víspera; el caso no distingue nada`);
    desplazamientos.push(desplazamiento(t, CASOS[nombre].zona));
  }
  // Madrid en octubre (+2), Madrid en enero (+1) y Canarias en julio (+1): un literal `T22:30:00Z`
  // sólo acertaría el primero.
  assert.deepEqual(desplazamientos, [120, 60, 60], '🔴 SUELO: los instantes no llevan el desplazamiento de su zona y su fecha');
});

test('SCRUM-1470c · 🔴 una factura de las 00:30 del negocio imprime el día de su REGISTRO, no la víspera', () => {
  for (const nombre of CRUCES) {
    const c = caso(nombre);
    assert.equal(c.registro, CASOS[nombre].fecha, `🔴 ${nombre}: el registro dice ${c.registro}; el caso estaba mal escrito`);
    assert.notEqual(c.pdf, CASOS[nombre].vispera, `🔴 ${nombre}: el PDF de la factura imprime la víspera (${c.pdf}), con el reloj del proceso`);
    assert.equal(c.pdf, c.registro, `🔴 ${nombre}: el PDF dice ${c.pdf} y su registro ${c.registro}`);
  }
});

test('SCRUM-1470c · CONTROL: una factura de mediodía y los bordes del día imprimen su día, igual que su registro', () => {
  for (const nombre of ['mediodia', 'bordeDentro', 'bordeFuera']) {
    const c = caso(nombre);
    assert.equal(c.pdf, CASOS[nombre].fecha, `🔴 ${nombre}: el PDF dice ${c.pdf}`);
    assert.equal(c.pdf, c.registro, `🔴 ${nombre}: el PDF dice ${c.pdf} y su registro ${c.registro}`);
  }
});

test('SCRUM-1470c · un negocio SIN zona declarada (o con una zona rota) imprime lo mismo que antes: el día en UTC (decisión A)', () => {
  for (const nombre of ['sinZona', 'zonaRota']) {
    const c = caso(nombre);
    // `fecha` es el día UTC de ese instante, o sea lo que `getDate()` daba en el proceso de producción.
    const enUtc = new Date(CASOS[nombre].instante).toISOString().slice(0, 10).split('-').reverse().join('/');
    assert.equal(CASOS[nombre].fecha, enUtc, `🔴 SUELO (${nombre}): el caso no es el día UTC`);
    assert.equal(c.pdf, CASOS[nombre].fecha, `🔴 ${nombre}: sin zona el PDF ha cambiado (dice ${c.pdf}): decisión A, no se mueve`);
    assert.equal(c.pdf, c.registro, `🔴 ${nombre}: el PDF dice ${c.pdf} y su registro ${c.registro}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LOS LLAMADORES · el PDF sólo imprime el día del negocio si quien lo pide le pasa la zona
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Cada `generateInvoicePdf({...})` de un fuente: dónde está y qué expresión lleva en `zona`. */
function llamadas(rel, texto) {
  const sf = ts.createSourceFile(rel, texto, ts.ScriptTarget.Latest, true);
  const out = [];
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'generateInvoicePdf') {
      const arg = n.arguments[0];
      const zona = arg && ts.isObjectLiteralExpression(arg)
        ? arg.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === 'zona')
        : null;
      out.push({ donde: `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`, zona: zona ? zona.initializer.getText(sf) : null });
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

/** Los `.ts` de `src/` que nombran la función (población), recorridos desde el disco. */
function fuentesQueLaLlaman() {
  const out = [];
  const anda = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) anda(p);
      else if (e.name.endsWith('.ts') && fs.readFileSync(p, 'utf8').includes('generateInvoicePdf(')) out.push(p);
    }
  };
  anda(path.join(RAIZ, 'src'));
  return out;
}

test('SCRUM-1470c · CONTROL del lector: una llamada sembrada SIN zona se ve, y una con zona también', () => {
  const sembrado = 'await generateInvoicePdf({ number: "1" });\nawait generateInvoicePdf({ number: "2", zona: m.timezone });';
  assert.deepEqual(llamadas('sembrado.ts', sembrado).map((l) => l.zona), [null, 'm.timezone'],
    '🔴 CIEGO: el lector no distingue una llamada con zona de una sin ella');
});

test('SCRUM-1470c · los TRES llamadores de `src/` pasan la zona del negocio (`….timezone`)', () => {
  const todas = fuentesQueLaLlaman().flatMap((p) => llamadas(path.relative(RAIZ, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8')));
  // Población declarada: medida el 23-oct-2026, dos en `src/lib/invoicing.ts` y una en
  // `invoicesAdmin.routes.ts` (regenerar PDF). Una cuarta que nazca entra aquí y se mira.
  assert.equal(todas.length, 3, `🔴 POBLACIÓN: esperaba 3 llamadas a generateInvoicePdf en src/, hay ${todas.length}: ${todas.map((l) => l.donde).join(', ')}`);
  for (const l of todas) {
    assert.ok(l.zona && /\.timezone$/.test(l.zona), `🔴 ${l.donde}: llama a generateInvoicePdf sin la zona del negocio (zona = ${l.zona})`);
  }
});
