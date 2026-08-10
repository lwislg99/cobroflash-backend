// SCRUM-195 (rebanada 3, MITAD NO BLOQUEADA) · crear el adicional sobre el mismo Trabajo,
// y la firma window-first sin caer a plantilla.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ENTRA, Y LO QUE NO — porque lo segundo importa igual
//
// ENTRA:
//   · `job_id` al crear → el presupuesto nace enganchado al Trabajo (`Quote.jobId`), con
//     comprobación de TENENCIA antes de enganchar.
//   · `sinPlantilla` en el envío → con la ventana de 24 h cerrada NO se manda, y el pro lee
//     el copy APROBADO en vez de un error mudo.
//
// NO ENTRA, y no por falta de tiempo:
//   · `terminado → en_curso` — DECIDIDO que no se añade. Un Trabajo terminado con un adicional
//     pendiente se queda en `terminado` y su CTA sigue siendo «Cobrar», que es verdad porque
//     queda dinero. El motivo lo dio la medición: `jobNextAction` (`jobDetailView.js:51`)
//     exige `status === 'terminado'` para el CTA de cobrar, así que reabrir el Trabajo QUITABA
//     el botón justo cuando había más que cobrar.
//   · `Quote.esAdicional` / `rol` — es SCHEMA y es del fundador. Está pendiente, y **no se
//     simula**: por eso `sinPlantilla` es un parámetro y no una regla automática. Quién lo
//     pone se decidirá cuando el rol exista.
//   · La vista multi-documento de `planView` — su microcopy no está aprobada. Hueco declarado,
//     no se pinta nada provisional.

import test from 'node:test';
import assert from 'node:assert/strict';

import { SEND_FAILURE_MESSAGES } from '../dist/lib/sendOutcome.js';

// ═════════════════════════════════════════════════════════════════════════════
// ① El copy de ventana cerrada — regla 30: es el APROBADO, no uno parecido
// ═════════════════════════════════════════════════════════════════════════════

test('① `ventana_cerrada` tiene su propio copy, y es el aprobado en el ticket', () => {
  const texto = SEND_FAILURE_MESSAGES.ventana_cerrada;
  assert.ok(texto, '🔴 sin copy propio, el pro leería un error genérico y no sabría qué hacer');
  // Decisión 3 del ticket (fundador, 28-jul-2026): «tu cliente no ha escrito en 24 h, llámale
  // o mándaselo tú». Se comprueban las tres piezas del mensaje, no la cadena entera, para que
  // una coma no rompa el test — pero ninguna de las tres puede desaparecer.
  assert.match(texto, /24 h/, 'tiene que decir POR QUÉ: la ventana de 24 h');
  assert.match(texto, /llámale/i, 'tiene que dar la salida: llamar');
  assert.match(texto, /mándaselo tú/i, 'y la otra: mandárselo él');
});

test('① NO se reutiliza el copy de «falló el envío»: aquí no ha fallado nada', () => {
  // La diferencia no es de matiz. `whatsapp_send_failed` dice que algo se rompió; aquí se ha
  // DECIDIDO no mandar, y el pro tiene que leer eso para actuar.
  assert.notEqual(SEND_FAILURE_MESSAGES.ventana_cerrada, SEND_FAILURE_MESSAGES.whatsapp_send_failed);
});

// ═════════════════════════════════════════════════════════════════════════════
// ② `sinPlantilla` — no mandar es mejor que mandar lo que parece lo de antes
// ═════════════════════════════════════════════════════════════════════════════

const { sendWhatsAppWindowFirst } = await import('../dist/integrations/whatsapp.js');

/**
 * Doble mínimo del entorno: sin ventana abierta y sin credenciales de Meta. Lo que se fija es
 * la DECISIÓN (mandar plantilla o no), no la llamada a la API.
 */
const PLANTILLA = { templateName: 'quote_decision_es', languageCode: 'es', components: [] };

test('② con la ventana CERRADA y `sinPlantilla`, no se manda y el motivo es `ventana_cerrada`', async () => {
  const r = await sendWhatsAppWindowFirst({
    to: '34000000001', // rango imposible de asignar (SCRUM-262)
    merchantId: 999_999, // merchant inexistente → no hay ventana abierta
    customerId: null,
    windowText: 'texto de ventana',
    template: PLANTILLA,
    sinPlantilla: true,
  });

  assert.equal(r.ok, false, '🔴 no debe darse por enviado');
  assert.equal(r.via, 'none', '🔴 «none» es lo que distingue no-mandar de mandar-plantilla');
  assert.equal(r.reason, 'ventana_cerrada');
});

test('② SIN la opción, el comportamiento de siempre NO cambia (no cae en «none»)', async () => {
  // El caso normal tiene que seguir intentando la plantilla. Si esto se rompiera, la opción
  // habría cambiado el envío de TODO el producto, no solo el del adicional.
  const r = await sendWhatsAppWindowFirst({
    to: '34000000002',
    merchantId: 999_999,
    customerId: null,
    windowText: 'texto de ventana',
    template: PLANTILLA,
  });

  assert.notEqual(r.via, 'none', '🔴 sin pedirlo, no se puede dejar de intentar la plantilla');
  assert.equal(r.via, 'template', 'la vía sigue siendo plantilla, salga bien o mal');
});

test('② la opción es explícita: un valor que no es `true` no la activa', async () => {
  const r = await sendWhatsAppWindowFirst({
    to: '34000000003',
    merchantId: 999_999,
    customerId: null,
    windowText: 'texto',
    template: PLANTILLA,
    sinPlantilla: false,
  });
  assert.equal(r.via, 'template');
});

// ═════════════════════════════════════════════════════════════════════════════
// ③ `job_id` al crear — el enganche, y su comprobación de tenencia
// ═════════════════════════════════════════════════════════════════════════════

const { CreateQuoteSchema } = await import('../dist/core/validation/schemas.js');

const BASE = {
  merchant_id: 1, customer_id: 2, currency: 'EUR',
  lines: [{ concept: 'Mano de obra', qty: 1, price: 100 }],
};

test('③ `job_id` es OPCIONAL: un presupuesto normal se sigue creando sin él', () => {
  const r = CreateQuoteSchema.safeParse(BASE);
  assert.equal(r.success, true, r.success ? '' : JSON.stringify(r.error.issues));
  assert.equal(r.data.job_id, undefined);
});

test('③ `job_id` se acepta cuando viene, y es el enganche al Trabajo', () => {
  const r = CreateQuoteSchema.safeParse({ ...BASE, job_id: 50 });
  assert.equal(r.success, true, r.success ? '' : JSON.stringify(r.error.issues));
  assert.equal(r.data.job_id, 50);
});

test('③ un `job_id` que no es un id se rechaza en la puerta, no en la consulta', () => {
  for (const malo of [0, -1, 1.5, 'cincuenta', null]) {
    assert.equal(CreateQuoteSchema.safeParse({ ...BASE, job_id: malo }).success, false,
      `🔴 job_id=${JSON.stringify(malo)} no debería pasar la validación`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ④ Que la TENENCIA se comprueba antes de enganchar — por AST, no por texto
// ═════════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('④ GUARD · el Trabajo de destino se busca SIEMPRE acotado al merchant (regla 2)', () => {
  // Sin esto, un merchant podría colgar un presupuesto —con su dinero— del Trabajo de OTRO
  // mandando un id: la agregación de `totalCobrado` de la rebanada 1 lo sumaría al ajeno.
  //
  // Por AST y no por `grep`: este fichero está lleno de las palabras que vigila, porque son
  // las que hay que escribir para explicar la regla (trampa de SCRUM-233).
  const ruta = path.join(RAIZ, 'src', 'modules', 'quotes', 'app', 'routes', 'quotes.routes.ts');
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  let encontrada = null;
  const recorrer = (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isPropertyAccessExpression(n.expression.expression) &&
      n.expression.expression.name.text === 'job' &&
      n.arguments[0]
    ) {
      const arg = n.arguments[0].getText(sf);
      if (/\bbody\.job_id\b/.test(arg)) encontrada = arg.replace(/\s+/g, ' ');
    }
    n.forEachChild(recorrer);
  };
  recorrer(sf);

  assert.ok(encontrada, '🔴 no se encontró la consulta que resuelve `body.job_id`');
  assert.match(encontrada, /merchantId/,
    '🔴 el Trabajo de destino se busca SIN acotar por merchant: un id ajeno se engancharía');
});

test('④ AUTOPRUEBA · el guard vería una consulta sin acotar', () => {
  const roto = 'const j = await prisma.job.findFirst({ where: { id: body.job_id } });';
  const sf = ts.createSourceFile('roto.ts', roto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let arg = null;
  const recorrer = (n) => {
    if (ts.isCallExpression(n) && n.arguments[0] && /\bbody\.job_id\b/.test(n.arguments[0].getText(sf))) {
      arg = n.arguments[0].getText(sf);
    }
    n.forEachChild(recorrer);
  };
  recorrer(sf);
  assert.ok(arg, 'la autoprueba tiene que encontrar la consulta');
  assert.doesNotMatch(arg, /merchantId/, 'y ver que NO está acotada — si no, no probaría nada');
});
