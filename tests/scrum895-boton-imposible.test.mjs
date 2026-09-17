// tests/scrum895-boton-imposible.test.mjs — SCRUM-895
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UNA PANTALLA NO OFRECE LO QUE NO PUEDE HACER
//
// En un albarán FIRMADO, la primaria de `firmado` para el parte SIN_VALORAR es
// `btnConvertirFactura` → `POST /admin/albaranes/:id/convertir-en-factura`. Esa ruta emite un
// documento FISCAL, y en modo justificante el documento no existe: corta con 409
// `facturacion_no_disponible` después de `getEmissionMode(merchant) === 'receipt'`.
//
// Para un merchant ES real con `INVOICING_ES_ENABLED` apagado —como están los negocios de
// verdad— ese 409 es el único desenlace posible. El botón no falla a veces: no puede funcionar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// LAS DOS MITADES, Y POR QUÉ NINGUNA VALE SOLA
//
//   · ROJO REAL  — con el modo justificante, `btnConvertirFactura` NO se ofrece.
//   · VERDE REAL — con el modo fiscal, SÍ se ofrece.
//
// Sin la segunda, un resolutor que escondiera el botón SIEMPRE pasaría este fichero entero, y
// habríamos cambiado un botón que miente por una acción que desaparece para todo el mundo.
//
// ⚠️ NO SE COMPRUEBA NINGÚN TEXTO. El rótulo del botón y el mensaje del 409 siguen siendo
// `[PENDIENTE microcopy oficial]` y los firma el fundador (regla 30): este ticket sólo quita de
// en medio una acción imposible. Atar aquí un literal sería escribir microcopy por la puerta de
// atrás.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const PATRON = leer('public/dashboard/js/patronDetalleAcciones.js');
const REGISTRO = leer('public/dashboard/js/albaranActionsRegistry.js');
const ACCION = leer('public/dashboard/js/albaranAccion.js');
const DETALLE = leer('public/dashboard/js/albaranDetailView.js');

/** El resolutor de verdad, con su registro y su patrón, en el modo de emisión que se le pida. */
function cargarResolutor(modoEmision) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(PATRON, ctx);
  vm.runInContext(REGISTRO, ctx);
  vm.runInContext(ACCION, ctx);
  // `undefined` NO es lo mismo que `null`: el primero es «esta prueba no lo puso», el segundo es
  // «el servidor no lo supo decir», que es un caso con su propio test más abajo.
  if (modoEmision !== undefined) ctx.window.appModoEmision = modoEmision;
  return ctx.window;
}

/** El albarán del ticket: FIRMADO, SIN precios y con presupuesto detrás. */
const albaranDelTicket = (extra) => ({
  estado: 'firmado',
  estadoFacturacion: 'sin_facturar',
  modoValoracion: 'SIN_VALORAR',
  quote: { id: 7, quoteNumber: 'P-2026-0007' },
  ...extra,
});

const primariaCon = (modoEmision, alb) => {
  const w = cargarResolutor(modoEmision);
  const p = w.primariaDeAlbaran(alb ?? albaranDelTicket());
  return p ? p.id : null;
};

// ═══ ⓿ SUELO · si el resolutor no se carga o no discrimina, lo de abajo no mide nada ═════════

test('SCRUM-895 · SUELO: el resolutor se carga y distingue por estado', () => {
  const w = cargarResolutor('fiscal');
  assert.equal(typeof w.primariaDeAlbaran, 'function',
    '🔴 ESCÁNER CIEGO: `primariaDeAlbaran` no se pudo cargar — los tests de abajo no comprobarían nada.');
  assert.equal(typeof w.ctxAlbaranDeFila, 'function',
    '🔴 ESCÁNER CIEGO: `ctxAlbaranDeFila` no está en el global; el detalle no podría preguntarle.');

  const respuestas = new Set([
    primariaCon('fiscal', albaranDelTicket({ estado: 'borrador' })),
    primariaCon('fiscal', albaranDelTicket({ estado: 'emitido' })),
    primariaCon('fiscal', albaranDelTicket()),
  ].map((r) => r ?? '(null)'));
  assert.ok(respuestas.size >= 3,
    '🔴 ESCÁNER CIEGO: los tres estados dan ' + respuestas.size + ' respuesta(s) distintas. Con una\n' +
    '  sola, un resolutor que no mirase nada pasaría igual.');
});

// ═══ ① ROJO REAL · con la facturación ES apagada, la acción imposible NO se ofrece ═══════════

test('SCRUM-895 · ROJO REAL: en modo justificante no se ofrece convertir en factura', () => {
  assert.notEqual(primariaCon('receipt'), 'btnConvertirFactura',
    '🔴 la pantalla ofrece `btnConvertirFactura` a un merchant en modo justificante. Esa ruta\n' +
    '  responde 409 `facturacion_no_disponible` SIEMPRE en este modo: es un botón que sólo sabe\n' +
    '  fallar, y encima lo hace después de que el profesional lo haya pulsado.');
  assert.equal(primariaCon('receipt'), null,
    '🔴 en modo justificante este albarán no tiene siguiente paso, así que la primaria debe ser\n' +
    '  `null` — y `null` es información: significa «nada que hacer aquí», no «no supe calcularlo».');
});

// ═══ ② VERDE REAL · con la facturación ES encendida, SÍ se ofrece ════════════════════════════

test('SCRUM-895 · VERDE REAL: en modo fiscal se sigue ofreciendo convertir en factura', () => {
  assert.equal(primariaCon('fiscal'), 'btnConvertirFactura',
    '🔴 se ha escondido la acción para TODO EL MUNDO. Un resolutor que devolviera siempre `null`\n' +
    '  pasaría el rojo de arriba: sin esta mitad, el criterio sería un «nunca» con nombre de\n' +
    '  condición. En modo fiscal la ruta funciona y el parte SIN precios se factura contra su\n' +
    '  presupuesto firmado.');
});

test('SCRUM-895 · el merchant DEMO conserva la factura completa, así que conserva el botón', () => {
  assert.equal(primariaCon('demo'), 'btnConvertirFactura',
    '🔴 `demo` no es `receipt`: el merchant demo (regla 8) emite facturas completas con marca de\n' +
    '  agua, y `getEmissionMode` las distingue. Esconderle el botón sería apagar la demo.');
});

// ═══ ③ LO QUE NO SE SABE NO SE TRATA COMO UN «NO» ════════════════════════════════════════════

test('SCRUM-895 · con el modo DESCONOCIDO el botón se conserva, y es una decisión', () => {
  assert.equal(primariaCon(null), 'btnConvertirFactura',
    '🔴 se está escondiendo la primaria por un modo que el servidor NO dijo. `app.js` deja\n' +
    '  `appModoEmision` en `null` a propósito antes que inventarse el estado fiscal de alguien, y\n' +
    '  un `/me` corto no debe dejar sin siguiente paso a un profesional que SÍ factura: eso\n' +
    '  cambiaría un botón que falla por una pantalla que se calla.');
  assert.equal(primariaCon(undefined), 'btnConvertirFactura',
    '🔴 sin el campo puesto tampoco se esconde: sólo se oculta cuando se SABE que es `receipt`.');
});

// ═══ ④ UNA SOLA FUENTE · el detalle pregunta, no recalcula ═══════════════════════════════════

test('SCRUM-895 · el detalle del albarán NO tiene su propia copia del criterio', () => {
  const codigo = soloEjecutable(DETALLE);
  assert.ok(codigo.includes('ctxAlbaranDeFila'),
    '🔴 `albaranDetailView.js` ya no pregunta a `ctxAlbaranDeFila`. Si vuelve a calcularse el\n' +
    '  contexto aquí, esta pantalla y la lista de Albaranes pueden discrepar sobre el mismo\n' +
    '  albarán — que es el defecto que SCRUM-831 vino a cerrar.');
  assert.ok(!codigo.includes('sin-valorar-convertible'),
    '🔴 vuelve a haber una SEGUNDA FUENTE del criterio en `albaranDetailView.js`. Mientras las dos\n' +
    '  copias digan lo mismo no se nota; el día que alguien arregle una, la otra seguirá\n' +
    '  ofreciendo el botón imposible.');

  // Control positivo del filtro: si `soloEjecutable` devolviera vacío, los dos asertos de arriba
  // se volverían un «no está» que no ha mirado nada.
  assert.ok(codigo.length > 1000,
    '🔴 ESCÁNER CIEGO: `soloEjecutable` devolvió ' + codigo.length + ' caracteres. Con el fuente\n' +
    '  vacío, `!includes(...)` pasaría sobre la nada.');
});

// ═══ ⑤ EL CRITERIO ESTÁ DONDE LO ENCUENTRAN LAS TRES SUPERFICIES ═════════════════════════════

test('SCRUM-895 · la condición del modo de emisión vive en el resolutor compartido', () => {
  const w = cargarResolutor('receipt');
  const ctx = w.ctxAlbaranDeFila(albaranDelTicket());
  assert.equal(ctx['sin-valorar-convertible'], false,
    '🔴 el contexto compartido sigue diciendo que el albarán es convertible en modo justificante.\n' +
    '  La lista de Albaranes y la ficha del Trabajo leen de aquí: si la condición sólo estuviera\n' +
    '  en el detalle, esas dos seguirían ofreciendo el botón.');

  const wFiscal = cargarResolutor('fiscal');
  assert.equal(wFiscal.ctxAlbaranDeFila(albaranDelTicket())['sin-valorar-convertible'], true,
    '🔴 la otra mitad: en modo fiscal el contexto compartido tiene que seguir diciendo que sí.');
});
