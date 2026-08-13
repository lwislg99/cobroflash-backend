// tests/scrum290-endpoint-convertir.test.mjs — SCRUM-290 (A0.4)
//
// EL ENDPOINT, EJERCITADO DE VERDAD: handler real + `prisma` de doble (patrón SCRUM-263 / 257b).
// No se mira el fichero: se INVOCA. Un test que lee el código comprueba que el código dice lo que
// dice, no que haga lo que debe.
//
// Lo que se prueba aquí y no en el casador: que el criterio LLEGUE a la emisión. Se puede tener un
// casador impecable y una ruta que lo ignore.
//
// ⚠️ REGLA 38 · aquí NO se emite nada de verdad: `$transaction` es un doble que no ejecuta el
// callback salvo cuando el caso lo exige. Lo que se comprueba es qué se le PASA a `emitInvoice` —
// que es lo que decide el importe que se le cobra al cliente.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DIST = pathToFileURL(path.resolve(import.meta.dirname, '../dist/')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const routerDe = (mod) => mod.default?.default ?? mod.default;

const PRESUPUESTO = [
  { concept: 'Tubo multicapa 16mm', qty: 10, price: 12.5, tax: 0.21 },
  { concept: 'Grifo monomando', qty: 1, price: 80, tax: 0.21 },
];

async function invocar(req) {
  const router = routerDe(await import(DIST + 'modules/jobs/app/routes/albaranes.routes.js'));
  const capa = router.stack.find(
    (l) => l.route?.path === '/:id/convertir-en-factura' && l.route?.methods?.post,
  );
  assert.ok(capa, '🔴 no existe POST /:id/convertir-en-factura: si la ruta se renombró, este test no comprueba NADA');
  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; },
  };
  const handlers = capa.route.stack;
  await handlers[handlers.length - 1].handle(req, res, () => {});
  return salida;
}

/** Monta el mundo mínimo. Devuelve lo que se le pasó a `emitInvoice`, que es lo que importa. */
function montar({ albaran, quote = { id: 7, quoteNumber: 'P-1', lines: PRESUPUESTO }, libro = [], albaranes }) {
  const capturado = { emitido: null, libroEscrito: null };
  const p = moduloPrisma.prisma;
  p.albaran = {
    findFirst: async () => albaran,
    findMany: async () => albaranes ?? [{ id: albaran?.id ?? 1, lineas: albaran?.lineas ?? [] }],
  };
  p.job = { findFirst: async () => ({ id: 1, customerId: 5, quoteId: quote ? quote.id : null }) };
  // ⚠️ MERCHANT REAL, NO EL DEMO. `isDemoMerchant` es `id === 1` o `demo@yaqu.app`, así que un
  // fixture con `id: 1` hace que TODOS los casos corran en modo 'demo' — y entonces la puerta de
  // la regla 24 no se ejercita nunca. La primera versión de este fichero tenía ese `id: 1` y por
  // eso el caso del justificante salía 201: el dato de prueba tapaba la comprobación, no el código.
  p.merchant = {
    findUnique: async () => ({ id: 7, email: 'pro@fontaneria.es', country: 'ES', flags: { INVOICING_ES_ENABLED: true }, defaultCurrency: 'EUR', taxId: 'B1' }),
  };
  p.quote = { findFirst: async () => quote };
  p.albaranLineaFacturada = { findMany: async () => libro, createMany: async (a) => { capturado.libroEscrito = a.data; } };
  // El cliente de transacción es un PROXY tolerante: lo que este test no define devuelve una
  // función async inocua. `allocateInvoiceNumber` toma un `pg_advisory_xact_lock` y consulta la
  // serie dentro de la tx, y enumerar aquí sus interioridades convertiría este test en un espejo
  // de esa implementación — se rompería cada vez que ella cambiara, sin que nada estuviera mal.
  // Lo que sí se fija es lo ÚNICO que decide el importe: qué se le pasa a `invoice.create`.
  const txBase = {
    invoice: { create: async ({ data }) => { capturado.emitido = data; return { ...data, id: 33, total: { toString: () => data.total } }; } },
    albaranLineaFacturada: { createMany: async (a) => { capturado.libroEscrito = a.data; } },
    // `allocateInvoiceNumber` avanza el contador de serie con un `merchant.update`: si solo se
    // define `findUnique`, el Proxy no llega (la clave YA existe) y revienta dentro de la tx.
    merchant: {
      findUnique: async () => ({ id: 1, country: 'ES', flags: { INVOICING_ES_ENABLED: true }, invoiceSeq: 0 }),
      update: async () => ({ id: 1, invoiceSeq: 1 }),
    },
  };
  const tx = new Proxy(txBase, {
    get(obj, k) {
      if (k in obj) return obj[k];
      if (typeof k === 'string' && k.startsWith('$')) return async () => [];
      return { findFirst: async () => null, findMany: async () => [], upsert: async () => ({}), create: async () => ({}), update: async () => ({}) };
    },
  });
  p.$transaction = async (cb) => cb(tx);
  return capturado;
}

// SCRUM-510 · merchant 7, el MISMO que devuelve `p.merchant` arriba. El `id = 1` es el del
// ALBARÁN y se queda. El `merchantId` estaba en 1 —el DEMO— justo en el fichero que cuenta
// que «el dato de prueba tapaba la comprobación»: la exención por mención lo libró.
const REQ = (id = 1) => ({ params: { id: String(id) }, body: {}, merchantId: 7, userRole: 'admin', user: { id: 1 } });

const ALBARAN_FIRMADO = {
  id: 1, jobId: 1, numero: 'A-2026-0001', fecha: new Date('2026-08-01'),
  estado: 'firmado', modoValoracion: 'SIN_VALORAR', invoiceId: null,
  lineas: [{ concepto: 'Tubo multicapa 16mm', cantidad: 3, unidad: 'm', quoteLineIndex: 0 }],
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA CARA QUE FUNCIONA
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-290 · el endpoint factura la CANTIDAD del albarán al PRECIO del presupuesto', async () => {
  const cap = montar({ albaran: ALBARAN_FIRMADO });
  const r = await invocar(REQ());
  assert.equal(r.code, 201, `esperaba 201 y salió ${r.code}: ${JSON.stringify(r.body)}`);

  const lineas = cap.emitido?.lines;
  assert.ok(Array.isArray(lineas) && lineas.length === 1, 'no llegó ni una línea a la factura');
  assert.equal(lineas[0].qty, 3, 'la cantidad sale del albarán');
  assert.equal(lineas[0].price, 12.5, 'el precio sale del presupuesto FIRMADO');
  assert.equal(cap.emitido.total, '45.38', '3 × 12,50 + 21 %');
  // El presupuesto viaja en la factura: es lo que permite auditar después que se cobró lo firmado.
  assert.equal(cap.emitido.quoteId, 7, 'la factura tiene que apuntar al presupuesto del que salieron los precios');
});

test('SCRUM-290 · el LIBRO se escribe con la línea del ALBARÁN, no con la del presupuesto', async () => {
  // `AlbaranLineaFacturada` guarda `lineaIndex` del albarán. Escribir ahí el índice del
  // presupuesto rompería el acumulado por fases de forma invisible: los números seguirían
  // cuadrando en el caso de una línea y se cruzarían en cuanto hubiera dos.
  const cap = montar({ albaran: ALBARAN_FIRMADO });
  await invocar(REQ());
  assert.equal(cap.libroEscrito?.length, 1);
  assert.equal(cap.libroEscrito[0].lineaIndex, 0);
  assert.equal(cap.libroEscrito[0].cantidad, 3);
});

test('SCRUM-290 · lo añadido en obra NO se factura y VUELVE nombrado en la respuesta', async () => {
  const cap = montar({
    albaran: {
      ...ALBARAN_FIRMADO,
      lineas: [
        { concepto: 'Tubo multicapa 16mm', cantidad: 3, unidad: 'm', quoteLineIndex: 0 },
        { concepto: 'Picar tabique', cantidad: 2, unidad: 'h' },
      ],
    },
  });
  const r = await invocar(REQ());
  assert.equal(r.code, 201);
  assert.equal(cap.emitido.lines.length, 1, 'la línea nueva no entra en la factura');
  // Y no desaparece: la pantalla la necesita para ofrecer el presupuesto adicional (SCRUM-271).
  assert.equal(r.body.paraAdicional.length, 1);
  assert.equal(r.body.paraAdicional[0].concepto, 'Picar tabique');
  assert.equal(r.body.paraAdicional[0].motivo, 'no_estaba_en_el_presupuesto');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA OTRA CARA · lo que NO se convierte
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-290 · un albarán SIN FIRMAR no se convierte', async () => {
  montar({ albaran: { ...ALBARAN_FIRMADO, estado: 'emitido' } });
  const r = await invocar(REQ());
  assert.equal(r.code, 409);
  assert.equal(r.body.error, 'albaran_no_firmado');
});

test('SCRUM-290 · un albarán SIN PRESUPUESTO detrás no se convierte, y NO emite nada', async () => {
  const cap = montar({ albaran: ALBARAN_FIRMADO, quote: null });
  const r = await invocar(REQ());
  assert.equal(r.code, 409);
  assert.equal(r.body.error, 'albaran_no_convertible');
  assert.match(r.body.motivos.join(' '), /presupuesto firmado detrás/);
  assert.equal(cap.emitido, null, '🔴 se ha emitido una factura sin precios aceptados por el cliente');
});

test('SCRUM-290 · SUELO: con líneas y NINGUNA casada, 409 y CERO emisión', async () => {
  // La factura vacía es el fallo que no se puede deshacer (regla 29). El suelo tiene que actuar
  // ANTES de pedir número: si se pidiera y luego se abortara, quedaría un hueco en la serie.
  const cap = montar({
    albaran: { ...ALBARAN_FIRMADO, lineas: [{ concepto: 'A', cantidad: 1, unidad: 'ud' }] },
  });
  const r = await invocar(REQ());
  assert.equal(r.code, 409);
  assert.match(r.body.motivos.join(' '), /NINGUNA casa/);
  assert.equal(cap.emitido, null, '🔴 se habría emitido una factura VACÍA');
});

test('SCRUM-290 · un albarán YA facturado entero no se vuelve a convertir', async () => {
  const cap = montar({ albaran: { ...ALBARAN_FIRMADO, invoiceId: 99 } });
  const r = await invocar(REQ());
  assert.equal(r.code, 409);
  assert.equal(r.body.error, 'albaran_ya_facturado');
  assert.equal(cap.emitido, null);
});

test('SCRUM-290 · en modo JUSTIFICANTE no se emite (reglas 24/26)', async () => {
  // `INVOICING_ES_ENABLED` OFF para merchants reales: mejor no ofrecerla que emitir un J- que
  // después no vale como factura. Esto se construye, no se enciende.
  const cap = montar({ albaran: ALBARAN_FIRMADO });
  // Profesional REAL en España SIN el flag: es el estado de producción hoy (regla 24).
  moduloPrisma.prisma.merchant = {
    findUnique: async () => ({ id: 7, email: 'pro@fontaneria.es', country: 'ES', flags: {}, defaultCurrency: 'EUR', taxId: 'B1' }),
  };
  const r = await invocar(REQ());
  assert.equal(r.code, 409);
  assert.equal(r.body.error, 'facturacion_no_disponible');
  assert.equal(cap.emitido, null);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// TENENCIA Y MICROCOPY
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-290 · el presupuesto se consulta filtrando por merchant (regla 2)', async () => {
  // Sin `merchantId` en el `where`, se cobrarían los precios del presupuesto de OTRO profesional.
  let where = null;
  montar({ albaran: ALBARAN_FIRMADO });
  moduloPrisma.prisma.quote = {
    findFirst: async (args) => { where = args?.where; return { id: 7, quoteNumber: 'P-1', lines: PRESUPUESTO }; },
  };
  await invocar(REQ());
  assert.ok(where && 'merchantId' in where, '🔴 la consulta del presupuesto NO filtra por merchantId');
});

test('SCRUM-290 · TODO el texto de pantalla sigue con el marcador (regla 30)', async () => {
  // La microcopy está bloqueada por `docs/legal/PREGUNTAS_ASESOR.md` §G — un texto que le dice a
  // un profesional qué puede cobrar no se escribe sobre fuentes públicas. Si alguien la rellena
  // sin que vuelva el asesor, esto cae.
  montar({ albaran: { ...ALBARAN_FIRMADO, estado: 'emitido' } });
  const r = await invocar(REQ());
  assert.equal(r.body.message, '[PENDIENTE microcopy oficial]',
    '🔴 hay microcopy escrita sin aprobar en una ruta que decide qué se le puede cobrar a un cliente');
});
