// tests/scrum1168-anio-serie-zona-merchant.test.mjs — SCRUM-1168
//
// LAS PUERTAS DE LA SERIE DE FACTURAS MIRABAN EL AÑO DEL PROCESO; EL EMISOR, EL DEL MERCHANT.
//
// `allocateInvoiceNumber` numera con el año del día natural en la zona del merchant (SCRUM-735).
// El bloqueo del prefijo (`updateMerchantProfile`), la pregunta de continuidad del alta
// (`POST /admin/onboarding/serie` y su `/previa`) y la puerta de `GET /admin/me` leían
// `new Date().getFullYear()`: Railway va en UTC. En la frontera del año decidían sobre un año y el
// número salía de otro.
//
// Tres redes:
//   ① COMPORTAMIENTO — `anioDeLaSerie` contra el `allocateInvoiceNumber` REAL, observado con un
//     `tx` falso (regla 38: se lee el emisor, no se modifica). Si una de las dos mitades cambia de
//     reloj sin la otra, cae aquí.
//   ② LO QUE DECIDEN LAS PUERTAS — con el año del emisor y con el del proceso, en la frontera. Es
//     el rojo medido el 28-sep-2026, escrito para que no haga falta volver a medirlo.
//   ③ ESTRUCTURA — por AST sobre los fuentes reales: las cuatro puertas sacan el año de
//     `anioDeLaSerie` y no leen ningún `get*FullYear()`.
//
// Las zonas y los instantes van FIJOS y explícitos: el veredicto no depende de la zona de la
// máquina que corre la tanda (SCRUM-813).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { allocateInvoiceNumber } from '../dist/modules/invoicing/domain/invoiceNumber.service.js';
import {
  anioDeLaSerie, numerosDeLaSerie, bloqueoCambioDeSerie, debeOfrecerArranqueDeSerie,
} from '../dist/core/validation/fiscalInput.js';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ⚠️ NUNCA `id: 1`: es el merchant DEMO (regla 8) y su modo de emisión no es el fiscal.
const MERCHANT_ID = 42;

/** El año con el que `allocateInvoiceNumber` numera DE VERDAD, leído de lo que escribe. */
async function anioDelEmisor(timezone, instante) {
  let escrito = null;
  const tx = {
    $executeRaw: async () => 0,
    merchant: {
      findUnique: async () => ({
        id: MERCHANT_ID, email: 'pro@x.es', country: 'ES', flags: { INVOICING_ES_ENABLED: true },
        timezone, invoiceSeriesPrefix: 'CF', nextInvoiceNumber: 7, nextRectInvoiceNumber: 1,
        invoiceSeriesYear: 2026,
      }),
      update: async (args) => { escrito = args.data; return {}; },
    },
    invoice: { findUnique: async () => null, findMany: async () => [] },
    auditLog: { create: async (args) => args.data },
  };
  const numero = await allocateInvoiceNumber(
    tx, MERCHANT_ID, { camino: 'C3', actor: { tipo: 'pro_propietario', teamMemberId: null } }, instante,
  );
  assert.ok(escrito, `el emisor no escribió la serie (número ${numero})`);
  return escrito.invoiceSeriesYear;
}

// La frontera en los dos sentidos: zona por DELANTE de UTC (Madrid ya está en 2027) y zona por
// DETRÁS (México y Bogotá siguen en 2026). UTC es el control: ahí el proceso y el merchant coinciden.
const FRONTERA = [
  { zona: 'Europe/Madrid', iso: '2026-12-31T23:30:00Z', anio: 2027 },
  { zona: 'America/Mexico_City', iso: '2027-01-01T02:00:00Z', anio: 2026 },
  { zona: 'America/Bogota', iso: '2027-01-01T03:00:00Z', anio: 2026 },
];
const CONTROL_UTC = { zona: 'UTC', iso: '2026-12-31T23:30:00Z', anio: 2026 };

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① COMPORTAMIENTO
// ═════════════════════════════════════════════════════════════════════════════════════════════

const FILAS_1 = [...FRONTERA, CONTROL_UTC];
const caso1 = casosEscritos(FILAS_1, (c) => `SCRUM-1168 · ① ${c.zona} a ${c.iso}: la puerta y el emisor usan el MISMO año (${c.anio})`, async (c) => {
  const instante = new Date(c.iso);
  const delEmisor = await anioDelEmisor(c.zona, instante);
  assert.equal(delEmisor, c.anio, `el emisor numeró con ${delEmisor}: el caso no es el que dice ser`);
  assert.equal(anioDeLaSerie({ timezone: c.zona }, instante), delEmisor,
    '🔴 la puerta de la serie razona sobre un año distinto del que numera `allocateInvoiceNumber`');
});
test('SCRUM-1168 · ① Europe/Madrid a 2026-12-31T23:30:00Z: la puerta y el emisor usan el MISMO año (2027)', caso1(0));
test('SCRUM-1168 · ① America/Mexico_City a 2027-01-01T02:00:00Z: la puerta y el emisor usan el MISMO año (2026)', caso1(1));
test('SCRUM-1168 · ① America/Bogota a 2027-01-01T03:00:00Z: la puerta y el emisor usan el MISMO año (2026)', caso1(2));
test('SCRUM-1168 · ① UTC a 2026-12-31T23:30:00Z: la puerta y el emisor usan el MISMO año (2026)', caso1(3));
caso1.todos();

test('SCRUM-1168 · ① CONTROL: los casos de frontera SON frontera (el reloj del proceso discrepa)', async () => {
  // Sin esto, ① podría pasar con casos donde UTC y la zona coinciden — y entonces no probaría nada.
  for (const c of FRONTERA) {
    const instante = new Date(c.iso);
    assert.notEqual(instante.getUTCFullYear(), await anioDelEmisor(c.zona, instante),
      `${c.zona} a ${c.iso} no cruza el año: no sirve de caso de frontera`);
  }
  const u = new Date(CONTROL_UTC.iso);
  assert.equal(u.getUTCFullYear(), await anioDelEmisor(CONTROL_UTC.zona, u));
});

test('SCRUM-1168 · ① sin zona (o zona corrupta) cae a UTC, igual que el emisor', async () => {
  const instante = new Date('2026-12-31T23:30:00Z');
  for (const timezone of [null, '', 'Marte/Olimpo']) {
    assert.equal(anioDeLaSerie({ timezone }, instante), await anioDelEmisor(timezone, instante));
  }
  assert.equal(anioDeLaSerie(null, instante), 2026);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② LO QUE DECIDEN LAS PUERTAS
// ═════════════════════════════════════════════════════════════════════════════════════════════

const EMITIDAS_2026 = ['2026-CF-001', '2026-CF-040'];

function decisiones(anio) {
  return {
    bloqueaPrefijo: bloqueoCambioDeSerie({
      prefijoActual: 'CF', prefijoNuevo: 'FAC', numerosDeLaSerie: numerosDeLaSerie(EMITIDAS_2026, anio),
    }).bloqueado,
    ofreceArranque: debeOfrecerArranqueDeSerie({ invoiceSeriesYear: 2026, año: anio, numerosDeLaSerie: [] }),
  };
}

const caso2 = casosEscritos(FRONTERA, (c) => `SCRUM-1168 · ② ${c.zona}: con el año del PROCESO las puertas deciden otra cosa que con el del emisor`, async (c) => {
  const instante = new Date(c.iso);
  const delEmisor = await anioDelEmisor(c.zona, instante);
  const correcta = decisiones(delEmisor);
  // El rojo medido: lo que hacían las puertas con `new Date().getFullYear()` en un proceso UTC.
  assert.notDeepEqual(decisiones(instante.getUTCFullYear()), correcta,
    'el caso no separa: con los dos años las puertas deciden lo mismo, así que no mide nada');
  assert.deepEqual(decisiones(anioDeLaSerie({ timezone: c.zona }, instante)), correcta,
    '🔴 con `anioDeLaSerie` las puertas no deciden lo mismo que el año con el que se numera');
});
test('SCRUM-1168 · ② Europe/Madrid: con el año del PROCESO las puertas deciden otra cosa que con el del emisor', caso2(0));
test('SCRUM-1168 · ② America/Mexico_City: con el año del PROCESO las puertas deciden otra cosa que con el del emisor', caso2(1));
test('SCRUM-1168 · ② America/Bogota: con el año del PROCESO las puertas deciden otra cosa que con el del emisor', caso2(2));
caso2.todos();

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ ESTRUCTURA — por AST sobre los fuentes reales
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Lo que el censo ve dentro de un nodo: llamadas a `anioDeLaSerie` y a `get*FullYear()`. */
function censaNodo(nodo) {
  let anioDeLaSerieLlamadas = 0;
  const fullYear = [];
  (function anda(n) {
    if (ts.isCallExpression(n)) {
      if (ts.isIdentifier(n.expression) && n.expression.text === 'anioDeLaSerie') anioDeLaSerieLlamadas += 1;
      if (ts.isPropertyAccessExpression(n.expression) && /^get(UTC)?FullYear$/.test(n.expression.name.text)) {
        fullYear.push(n.expression.name.text);
      }
    }
    n.forEachChild(anda);
  })(nodo);
  return { anioDeLaSerieLlamadas, fullYear };
}

/** Los handlers de `app.<verbo>('<ruta>', …)` y las funciones exportadas, por nombre. */
function puertas(fuente, nombreFichero) {
  const sf = ts.createSourceFile(nombreFichero, fuente, ts.ScriptTarget.Latest, true);
  const encontradas = new Map();
  (function anda(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'app'
        && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
      encontradas.set(`${n.expression.name.text.toUpperCase()} ${n.arguments[0].text}`, n);
    }
    if (ts.isFunctionDeclaration(n) && n.name) encontradas.set(n.name.text, n);
    n.forEachChild(anda);
  })(sf);
  return encontradas;
}

const PUERTAS = [
  { fichero: 'src/app.ts', nombre: 'GET /admin/me' },
  { fichero: 'src/app.ts', nombre: 'POST /admin/onboarding/serie/previa' },
  { fichero: 'src/app.ts', nombre: 'POST /admin/onboarding/serie' },
  { fichero: 'src/modules/system/merchantAdmin.ts', nombre: 'updateMerchantProfile' },
];

function censaPuerta(fuente, p) {
  const nodo = puertas(fuente, p.fichero).get(p.nombre);
  assert.ok(nodo, `CIEGO: no encuentro «${p.nombre}» en ${p.fichero}`);
  return censaNodo(nodo);
}

const caso3 = casosEscritos(PUERTAS, (p) => `SCRUM-1168 · ③ ${p.fichero} · ${p.nombre}: el año sale de \`anioDeLaSerie\`, no de un get*FullYear()`, (p) => {
  const c = censaPuerta(fs.readFileSync(path.join(RAIZ, p.fichero), 'utf8'), p);
  assert.ok(c.anioDeLaSerieLlamadas >= 1, `🔴 ${p.nombre} no deriva el año con anioDeLaSerie(merchant)`);
  assert.deepEqual(c.fullYear, [], `🔴 ${p.nombre} sigue leyendo el año con ${c.fullYear.join(', ')}()`);
});
test('SCRUM-1168 · ③ src/app.ts · GET /admin/me: el año sale de `anioDeLaSerie`, no de un get*FullYear()', caso3(0));
test('SCRUM-1168 · ③ src/app.ts · POST /admin/onboarding/serie/previa: el año sale de `anioDeLaSerie`, no de un get*FullYear()', caso3(1));
test('SCRUM-1168 · ③ src/app.ts · POST /admin/onboarding/serie: el año sale de `anioDeLaSerie`, no de un get*FullYear()', caso3(2));
test('SCRUM-1168 · ③ src/modules/system/merchantAdmin.ts · updateMerchantProfile: el año sale de `anioDeLaSerie`, no de un get*FullYear()', caso3(3));
caso3.todos();

test('SCRUM-1168 · ③ CONTROL: el censo CAZA la forma del defecto y ABSUELVE la del arreglo', () => {
  const p = { fichero: 'src/modules/system/merchantAdmin.ts', nombre: 'updateMerchantProfile' };
  const defecto = censaPuerta('export async function updateMerchantProfile() { const año = new Date().getFullYear(); }', p);
  assert.equal(defecto.anioDeLaSerieLlamadas, 0);
  assert.deepEqual(defecto.fullYear, ['getFullYear']);
  const utc = censaPuerta('export async function updateMerchantProfile() { const año = new Date().getUTCFullYear(); }', p);
  assert.deepEqual(utc.fullYear, ['getUTCFullYear'], 'UTC explícito sigue siendo el reloj del proceso, no el del merchant');
  const arreglo = censaPuerta('export async function updateMerchantProfile(a) { const año = anioDeLaSerie(a); }', p);
  assert.equal(arreglo.anioDeLaSerieLlamadas, 1);
  assert.deepEqual(arreglo.fullYear, []);
});
