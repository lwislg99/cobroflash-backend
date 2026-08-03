// SCRUM-263 · EMITIR SIN LÍNEAS DEVUELVE 409 CON SU COPY, EN LAS CUATRO RUTAS.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL HUECO EXACTO, Y POR QUÉ LA COBERTURA QUE YA HABÍA NO LO TAPABA
//
// SCRUM-246 dejó dos cosas: un guard AST que garantiza que **ningún camino de emisión escapa al
// portón** (`exigirLineasFacturables`), y el predicado unitario (`hayLineasFacturables`). Las dos
// son correctas y ninguna comprueba lo que importa aquí.
//
// El AST demuestra que se LLAMA al portón. No demuestra que el `catch` de cada ruta **traduzca**
// `FacturaSinLineasError` a un 409 con su copy en vez de dejarlo caer al `internal_error` general
// que hay debajo. Esa traducción es una línea dentro de un `catch`, y borrarla no rompe el AST,
// no rompe el predicado y no rompe ningún test: el profesional pasaría de leer «añade lo que vas
// a cobrar» a leer un 500 mudo, y la suite seguiría verde.
//
// Medido antes de escribir esto: la suite entera tenía **cero menciones de 409** y ningún test de
// extremo a extremo sobre este camino.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SON CUATRO RUTAS, NO TRES
//
// El enunciado hablaba de tres ficheros; los caminos son cuatro, porque `quotesAdmin` emite por
// DOS rutas distintas (se separaron a propósito, no es un flag de la otra):
//   · `jobs.routes.ts`        → POST /:id/collect-rest      (pro, cobra el resto del trabajo)
//   · `quotes.routes.ts`      → POST /:token/decision       (CLIENTE FINAL, acepta por WhatsApp)
//   · `quotesAdmin.routes.ts` → POST /:id/invoice           (pro, factura el tramo)
//   · `quotesAdmin.routes.ts` → POST /:id/invoice-manual    (pro, factura manual)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS CUATRO YA TRADUCEN BIEN HOY. ESTO NO ARREGLA NADA: FIJA EL CONTRATO
//
// Se midió antes de construir y los cuatro `catch` responden ya el 409 correcto. Así que el ROJO
// de este fichero no puede ser «el código está mal» — es **romper cada `catch` por separado y
// comprobar que el test lo caza**. Eso es lo que convierte una conducta correcta por casualidad
// en una conducta que no se puede perder en un refactor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// REGLA 30: EL TEST NUNCA ESCRIBE EL COPY
//
// Los dos textos siguen marcados `[PENDIENTE microcopy oficial]` y los aprueba el fundador
// (SCRUM-264). Aquí se comparan **contra las constantes importadas**, jamás contra un literal:
// el día que se apruebe el texto definitivo, este fichero sigue verde sin tocarlo. Si comparase
// con un literal, aprobar el copy rompería la suite y el test presionaría contra el cambio.
//
// Y de propina ata un dato que hoy vive en dos sitios: `quotes.routes.ts:719` escribe
// `'factura_sin_lineas'` a mano en vez de usar `ERROR_SIN_LINEAS`. No se corrige aquí —no es el
// alcance—, pero al comparar contra la CONSTANTE, el día que diverjan sale rojo. Una coincidencia
// pasa a ser un invariante.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CÓMO SE EJERCITA, Y POR QUÉ NO ES GATEADO
//
// El patrón de la casa para probar rutas es gateado contra staging (`fetch` a un servidor real).
// Aquí no hace falta y sería peor: lo que se vigila es la traducción del error dentro del
// handler, no la integración con la BD. Se importa el router REAL del `dist`, se localiza su capa
// por método y ruta, y se invoca **el handler real** con un `res` de doble y un `prisma`
// sustituido. Sin BD, sin red, sin turno de staging y sin dependencia nueva (regla 36): corre en
// `npm test` como cualquier otro.
//
// `prisma` se sustituye MUTANDO las propiedades del objeto exportado, no reasignando el módulo:
// las rutas hicieron `const { prisma } = require(...)` al cargarse, y esa desestructuración apunta
// al MISMO objeto — así que mutarlo llega a código ya importado. Reasignar el binding no llegaría.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const DIST = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href + '/';

const {
  ERROR_SIN_LINEAS, COPY_ADMIN_SIN_LINEAS, COPY_PUBLICO_SIN_LINEAS,
} = await import(DIST + 'modules/invoicing/domain/lineasFacturables.js');
const moduloPrisma = await import(DIST + 'core/db/prisma.js');

/** El router real que exporta un módulo de rutas, sorteando la envoltura ESM→CJS. */
const routerDe = (mod) => mod.default?.default ?? mod.default;

/**
 * Invoca el ÚLTIMO handler de una ruta (el de negocio; los previos son middlewares de auth, que
 * no son lo que se vigila aquí) y devuelve lo que respondió.
 */
async function invocar(rutaModulo, metodo, ruta, req) {
  const router = routerDe(await import(DIST + rutaModulo));
  assert.ok(Array.isArray(router?.stack),
    `🔴 no se pudo leer el router de ${rutaModulo}: sin su stack no se está invocando nada`);
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route?.methods?.[metodo]);
  assert.ok(capa,
    `🔴 no existe ${metodo.toUpperCase()} ${ruta} en ${rutaModulo}. Si la ruta se renombró, este ` +
    'test dejaría de comprobar nada y pasaría en verde: por eso falla aquí en vez de seguir.');

  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    send(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; },
    type() { return this; },
  };
  const handlers = capa.route.stack;
  await handlers[handlers.length - 1].handle(req, res, () => {});
  return salida;
}

/** Una línea que NO aporta importe: el caso que el portón rechaza. */
const LINEA_SIN_IMPORTE = { concept: 'Pendiente de precio', qty: 1, price: 0 };
/** Una línea que SÍ aporta importe: el control que demuestra que se llegó al portón. */
const LINEA_CON_IMPORTE = { concept: 'Reparación', qty: 1, price: 100 };

const MERCHANT = { id: 1, name: 'QA', country: 'ES', taxId: 'B12345678', invoiceSeriesPrefix: 'CF' };
const CUSTOMER = { id: 2, name: 'Cliente QA', phone: '+34600000000' };

const quoteBase = (lines) => ({
  id: 7, merchantId: 1, customerId: 2, status: 'accepted', currency: 'EUR',
  lines, Invoice: [], billingPlan: null, customBillingPlan: null,
  merchant: MERCHANT, customer: CUSTOMER,
});

/** Deja `prisma` con lo mínimo para llegar al portón. Best-effort y explícito. */
function sustituirPrisma(quote, extra = {}) {
  moduloPrisma.prisma.quote = { findFirst: async () => quote, findUnique: async () => quote, update: async () => quote, ...extra.quote };
  moduloPrisma.prisma.job = extra.job ?? moduloPrisma.prisma.job;
  moduloPrisma.prisma.invoice = { findMany: async () => [], findFirst: async () => null, ...extra.invoice };
}

/**
 * El contrato, en un solo sitio: 409 + el código + EL COPY QUE HAY (constante, nunca literal).
 */
function exigir409ConCopy(resp, copyEsperado, quien) {
  assert.ok(resp, `🔴 ${quien}: el handler no respondió nada — no se llegó al portón`);
  assert.equal(resp.code, 409,
    `🔴 ${quien}: respondió ${resp.code} en vez de 409.\n\n` +
    '  Un 500 aquí no es un matiz: el profesional deja de leer «añade lo que vas a cobrar» y pasa\n' +
    '  a leer un error mudo, sin saber que el arreglo está en su mano. La traducción del error\n' +
    `  vive en el catch de la ruta — probablemente se perdió ahí.\n  Cuerpo: ${JSON.stringify(resp.body)}`);
  assert.equal(resp.body?.error, ERROR_SIN_LINEAS,
    `🔴 ${quien}: el código de error no es el de la constante. Se ramifica por CÓDIGO, nunca por ` +
    'el texto (SCRUM-151), así que si diverge del literal, el front deja de reconocerlo.');
  assert.equal(resp.body?.message, copyEsperado,
    `🔴 ${quien}: el mensaje no es el copy que declara lineasFacturables.ts.\n\n` +
    '  Este assert compara contra la CONSTANTE, no contra un literal: los dos textos siguen\n' +
    '  marcados [PENDIENTE microcopy oficial] y cuando el fundador apruebe el definitivo\n' +
    '  (SCRUM-264) este test tiene que seguir verde sin tocarlo. Si falla, es que la ruta manda\n' +
    '  un texto propio en vez del declarado.');
}

// ── LAS CUATRO RUTAS ─────────────────────────────────────────────────────────────────────

test('SCRUM-263 · POST /admin/quotes/:id/invoice — 409 con el copy del PROFESIONAL', async () => {
  sustituirPrisma(quoteBase([LINEA_SIN_IMPORTE]));
  const resp = await invocar('modules/system/app/routes/quotesAdmin.routes.js', 'post', '/:id/invoice',
    { params: { id: '7' }, body: {}, merchantId: 1, query: {}, headers: {} });
  exigir409ConCopy(resp, COPY_ADMIN_SIN_LINEAS, 'quotesAdmin /:id/invoice');
});

test('SCRUM-263 · POST /admin/quotes/:id/invoice-manual — 409 con el copy del PROFESIONAL', async () => {
  // `paymentTerms: 'MANUAL'` a proposito: esta ruta EXISTE para los presupuestos sin plan de
  // tramos, y con un plan responde `has_billing_plan` antes de llegar al porton. Medido.
  sustituirPrisma({ ...quoteBase([LINEA_SIN_IMPORTE]), paymentTerms: 'MANUAL' });
  const resp = await invocar('modules/system/app/routes/quotesAdmin.routes.js', 'post', '/:id/invoice-manual',
    { params: { id: '7' }, body: { amount: '0.00' }, merchantId: 1, query: {}, headers: {} });
  exigir409ConCopy(resp, COPY_ADMIN_SIN_LINEAS, 'quotesAdmin /:id/invoice-manual');
});

test('SCRUM-263 · POST /admin/jobs/:id/collect-rest — 409 con el copy del PROFESIONAL', async () => {
  const quote = quoteBase([LINEA_SIN_IMPORTE]);
  sustituirPrisma(quote, {
    job: {
      findFirst: async () => ({ id: 3, merchantId: 1, quoteId: 7, status: 'terminado', quote }),
      findUnique: async () => ({ id: 3, merchantId: 1, quoteId: 7, status: 'terminado', quote }),
    },
  });
  const resp = await invocar('modules/jobs/app/routes/jobs.routes.js', 'post', '/:id/collect-rest',
    { params: { id: '3' }, body: {}, merchantId: 1, query: {}, headers: {} });
  exigir409ConCopy(resp, COPY_ADMIN_SIN_LINEAS, 'jobs /:id/collect-rest');
});

test('SCRUM-263 · POST /quote/:token/decision — 409 con el copy del CLIENTE FINAL', async () => {
  // ⚠️ Este es el que más importa del cuatro, y por eso lleva copy PROPIO: lo lee el cliente
  // final desde WhatsApp, y él NO PUEDE ARREGLARLO. Su aceptación ya valió; falta que el
  // profesional complete el presupuesto. Mandarle el copy del pro le diría que repita algo que
  // ya hizo bien.
  // `status: 'sent'` a proposito: con 'accepted' la ruta corta antes por idempotencia y
  // responde 200 `already_accepted`, sin llegar nunca al porton. Medido.
  // El token tiene que ser HEXADECIMAL: `parseToken` descarta todo lo demas, y con la cadena
  // vacia la ruta responde 404 sin llegar al porton. Medido, no supuesto.
  sustituirPrisma({ ...quoteBase([LINEA_SIN_IMPORTE]), status: 'sent', decisionToken: 'abc123', validUntil: null });
  const resp = await invocar('modules/quotes/app/routes/quotes.routes.js', 'post', '/:token/decision',
    { params: { token: 'abc123' }, body: { decision: 'accept' }, query: {}, headers: {}, ip: '127.0.0.1' });
  exigir409ConCopy(resp, COPY_PUBLICO_SIN_LINEAS, 'quotes /:token/decision');
});

// ── SUELO: que el 409 salga por lo que creemos ───────────────────────────────────────────

test('SCRUM-263 · SUELO: con una línea CON importe, NO sale el rechazo por falta de líneas', async () => {
  // Sin esto, los cuatro asserts de arriba pasarían igual si la ruta devolviera 409 SIEMPRE por
  // cualquier otro motivo. El control demuestra que el 409 lo produce el portón y no el decorado.
  sustituirPrisma(quoteBase([LINEA_CON_IMPORTE]));
  const resp = await invocar('modules/system/app/routes/quotesAdmin.routes.js', 'post', '/:id/invoice',
    { params: { id: '7' }, body: {}, merchantId: 1, query: {}, headers: {} });

  assert.ok(resp, '🔴 el handler no respondió nada con líneas válidas');
  assert.notEqual(resp.body?.error, ERROR_SIN_LINEAS,
    '🔴 devuelve «sin líneas» con una línea de 100 €: el portón está rechazando lo que debería ' +
    'dejar pasar, y entonces los cuatro tests de arriba no prueban lo que dicen probar.\n' +
    `  Cuerpo: ${JSON.stringify(resp.body)}`);
});
