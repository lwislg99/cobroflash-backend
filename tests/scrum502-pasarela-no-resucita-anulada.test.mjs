// tests/scrum502-pasarela-no-resucita-anulada.test.mjs — SCRUM-502
//
// LAS TRES PUERTAS DE PASARELA NO MARCAN COBRADA UNA FACTURA ANULADA.
//
// SCRUM-153 lo cerró en el marcado a mano; SCRUM-496, en el lote. Quedaban tres, y son de **otra
// categoría**: en `bulk-paid` alguien pulsa un botón y se equivoca; aquí **se dispara solo**, con lo
// que llegue por la red. Ninguna de las tres miraba el estado.
//
// 🔴 EL CONTROL NEGATIVO ES EL QUE MÁS IMPORTA, y va primero: un pago legítimo sobre una factura
// `pending` tiene que seguir funcionando EXACTAMENTE igual. Ésta es la vía por la que entra el
// dinero — romperla sería peor que el defecto que se arregla.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);

const { puedeCobrarPorPasarela, ESTADO_ANULADA } =
  require_(path.join(RAIZ, 'dist/modules/system/invoiceAdmin.js'));

/** Las tres puertas medidas, cada una con su fichero y lo que hace. */
const PUERTAS = [
  { ruta: 'src/modules/billing/app/routes/psp.routes.ts', que: 'PSP · la factura enlazada por chargeId/quoteId' },
  { ruta: 'src/modules/billing/app/routes/mpWebhook.routes.ts', que: 'MercadoPago · la factura del charge' },
];

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-502 · SUELO: la guarda existe y se puede ejercitar', () => {
  assert.equal(typeof puedeCobrarPorPasarela, 'function',
    '🔴 la guarda no está exportada: lo de abajo no mediría nada.');
  assert.equal(typeof ESTADO_ANULADA, 'string');
  // Control positivo del instrumento: si dijera «no» a todo, todos los asserts de abajo pasarían.
  assert.equal(puedeCobrarPorPasarela({ status: 'pending' }), true,
    '🔴 ni una pendiente se puede cobrar: la guarda dice que no a todo y no prueba nada.');
});

// ── 🔴 EL CONTROL NEGATIVO, PRIMERO: EL DINERO SIGUE ENTRANDO ───────────────────────────────

test('SCRUM-502 · 🔴 CONTROL NEGATIVO: un pago legítimo por pasarela SIGUE funcionando', () => {
  // Los estados por los que llega el dinero de verdad. Si alguno cayera, el arreglo sería peor que
  // el defecto: se habría cortado la vía por la que cobra el profesional.
  for (const estado of ['pending', 'sent', 'expired']) {
    assert.equal(puedeCobrarPorPasarela({ status: estado }), true,
      `🔴 UNA FACTURA «${estado}» YA NO SE PUEDE COBRAR POR PASARELA.\n\n` +
      '  Ésta es la vía por la que entra el dinero. Cortarla es peor que el defecto que este\n' +
      '  ticket arregla: el cliente paga, la pasarela lo confirma, y la factura se queda sin marcar.');
  }

  // Y la RE-escritura sobre una ya pagada sigue permitida a propósito: los webhooks se reintentan,
  // y volver a poner `paid` sobre lo que ya está `paid` es idempotente. Excluirla habría sido
  // cambiar el comportamiento del cobro, y el GO era solo la guarda de anulada.
  assert.equal(puedeCobrarPorPasarela({ status: 'paid' }), true,
    '🔴 un reintento del webhook sobre una factura ya pagada se está bloqueando. Eso no es la ' +
    'guarda de anulada: es un cambio en el camino del cobro que nadie autorizó.');
});

// ── EL HECHO ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-502 · 🔴 UNA ANULADA NO SE MARCA COBRADA POR NINGUNA PASARELA', () => {
  assert.equal(puedeCobrarPorPasarela({ status: ESTADO_ANULADA }), false,
    '🔴 UNA FACTURA ANULADA SE PUEDE MARCAR COMO COBRADA DESDE UNA PASARELA.\n\n' +
    '  Es un documento dado de baja ante la AEAT, con su registro de anulación sellado y\n' +
    '  encadenado, volviendo a salir como cobrado — y aquí NADIE PULSA UN BOTÓN: basta con que\n' +
    '  llegue un webhook. El enlace sobrevive a la anulación (anular escribe SOLO `status`), así\n' +
    '  que el pago de un enlace viejo, o un reintento del proveedor, la resucita.\n' +
    '  La Parte L declara `pending → annulled` y NO declara ninguna transición que salga de ahí.');
});

test('SCRUM-502 · 🔴 la población que llega de una pasarela, ejercitada', () => {
  const llegan = [
    { id: 1, status: 'pending' },
    { id: 2, status: ESTADO_ANULADA },
    { id: 3, status: 'paid' },
    { id: 4, status: 'expired' },
  ];
  const seCobran = llegan.filter(puedeCobrarPorPasarela).map((f) => f.id);
  assert.deepEqual(seCobran, [1, 3, 4],
    `🔴 la pasarela cobraría ${JSON.stringify(seCobran)}. La anulada (id 2) no puede estar; las ` +
    'otras tres sí, o se habría cortado el cobro.');
  assert.ok(llegan.some((f) => f.status === ESTADO_ANULADA),
    '🔴 la fixture no trae ninguna anulada: el caso no reproduce el defecto.');
});

// ── QUE LA GUARDA LLEGUE A LAS TRES PUERTAS ─────────────────────────────────────────────────

test('SCRUM-502 · 🔴 LAS TRES puertas consumen la guarda, y ninguna escribe la suya', () => {
  let escriturasVistas = 0;

  for (const { ruta, que } of PUERTAS) {
    const fuente = leer(ruta);
    const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

    assert.match(sinComentarios, /puedeCobrarPorPasarela/,
      `🔴 ${ruta} (${que}) NO consume la guarda. Esa puerta marca cobrada una anulada, y se ` +
      'dispara sola con lo que llegue por la red.');

    // Y no puede haberse escrito una copia del criterio: el estado vive en `invoiceAdmin.ts`.
    assert.equal(/status\s*[!=]==?\s*'annulled'/.test(sinComentarios), false,
      `🔴 ${ruta} compara con el literal «annulled» por su cuenta. Es una segunda declaración del ` +
      'mismo hecho: el día que el estado cambie de nombre, esta puerta se queda sola.');

    // Suelo por fichero: se cuentan las PUERTAS —llamadas de escritura a `Invoice`—, no el texto
    // `status: 'paid'`. La primera versión de este test contaba el texto y dio 4 en vez de 3: el
    // cuarto era `res.json({ ok: true, status: 'paid' })`, una RESPUESTA HTTP. Un instrumento que
    // confunde lo que se devuelve con lo que se escribe no puede vigilar puertas.
    const escrituras = (sinComentarios.match(/prisma\.invoice\.update\(/g) || []).length;
    assert.ok(escrituras > 0,
      `🔴 ${ruta} ya no escribe en \`Invoice\`: o dejó de ser una puerta, o el instrumento no la ` +
      've. En los dos casos, lo de arriba no significa nada.');
    escriturasVistas += escrituras;
  }

  // Las TRES puertas medidas: dos en `psp.routes.ts` y una en `mpWebhook.routes.ts`.
  assert.equal(escriturasVistas, 3,
    `🔴 se ven ${escriturasVistas} escrituras a \`Invoice\` en las rutas de pasarela y las medidas ` +
    'eran 3. Si han aparecido más, hay una puerta nueva sin guarda; si menos, el instrumento se ha ' +
    'quedado ciego. Se lee la LISTA, no el número.');
});

test('SCRUM-502 · el `.catch(() => {})` de MercadoPago SIGUE ahí — reportado, no tocado', () => {
  // No es un guard de calidad: es la constancia de que esta tanda NO lo tocó, que era la condición.
  // Si alguien lo arregla, este test cae y se actualiza en el mismo commit que lo arregle.
  const mp = leer('src/modules/billing/app/routes/mpWebhook.routes.ts');
  assert.match(mp, /\.catch\(\(\) => \{\}\)/,
    '🔴 el `.catch(() => {})` ha desaparecido. Si se ha arreglado, bien — pero era otro defecto y ' +
    'otra tanda: actualiza este test en el commit que lo arregle, para que conste.');
});
