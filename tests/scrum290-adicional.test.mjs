// tests/scrum290-adicional.test.mjs — SCRUM-290 (A0.4)
//
// EL PRESUPUESTO ADICIONAL: lo añadido en obra no se factura, se convierte en un documento que el
// cliente firma. Aquí se comprueba que ese documento **se crea cuando toca y NO cuando no toca**.
//
// ── POR QUÉ EL CONTROL NEGATIVO ES EL IMPORTANTE ────────────────────────────────────────────
// Un adicional vacío es **un documento que le pide al cliente que firme la nada**. Y no es un
// fallo teórico: si el adicional se creara siempre, cada conversión limpia dejaría un presupuesto
// en `draft` colgando del Trabajo, el profesional acabaría con una lista de documentos fantasma y
// dejaría de mirarla — que es como se pierde el adicional que SÍ importaba.
//
// ── Y NACE SIN PRECIO, A PROPÓSITO ──────────────────────────────────────────────────────────
// Es trabajo NUEVO: no hay ninguna referencia firmada de la que sacar su importe. Ponerle precio
// aquí sería inventarlo. Nace en `draft` y no se manda solo: el profesional le pone importe y lo
// envía. Mandarlo a 0 € para que lo firmen sería pedir que firmen la nada por otra vía.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { lineasParaAdicional } from '../dist/modules/jobs/domain/albaranAFactura.js';

const DIST = pathToFileURL(path.resolve(import.meta.dirname, '../dist/')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const routerDe = (mod) => mod.default?.default ?? mod.default;

const PRESUPUESTO = [{ concept: 'Tubo multicapa 16mm', qty: 10, price: 12.5, tax: 0.21 }];

async function invocar(req) {
  const router = routerDe(await import(DIST + 'modules/jobs/app/routes/albaranes.routes.js'));
  const capa = router.stack.find((l) => l.route?.path === '/:id/convertir-en-factura' && l.route?.methods?.post);
  assert.ok(capa, '🔴 no existe POST /:id/convertir-en-factura: este test no comprobaría NADA');
  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; },
  };
  const h = capa.route.stack;
  await h[h.length - 1].handle(req, res, () => {});
  return salida;
}

/** Monta el mundo y CAPTURA lo que se crearía como presupuesto adicional. */
function montar(lineasAlbaran) {
  const cap = { adicionalCreado: null, facturaEmitida: null };
  const p = moduloPrisma.prisma;
  const albaran = {
    id: 1, jobId: 1, numero: 'A-2026-0001', fecha: new Date('2026-08-01'),
    estado: 'firmado', modoValoracion: 'SIN_VALORAR', invoiceId: null, lineas: lineasAlbaran,
  };
  p.albaran = { findFirst: async () => albaran, findMany: async () => [{ id: 1, lineas: lineasAlbaran }] };
  p.job = { findFirst: async () => ({ id: 1, customerId: 5, quoteId: 7 }) };
  // Merchant REAL con el flag, no el demo (`isDemoMerchant` es id === 1): si no, todo corre en
  // modo demo y la puerta de la regla 24 no se ejercita.
  p.merchant = { findUnique: async () => ({ id: 7, email: 'pro@fontaneria.es', country: 'ES', flags: { INVOICING_ES_ENABLED: true }, defaultCurrency: 'EUR', taxId: 'B1' }) };
  p.quote = { findFirst: async () => ({ id: 7, quoteNumber: 'P-1', lines: PRESUPUESTO }) };
  p.albaranLineaFacturada = { findMany: async () => [], createMany: async () => {} };

  const tx = new Proxy({
    invoice: { create: async ({ data }) => { cap.facturaEmitida = data; return { ...data, id: 33, total: { toString: () => data.total } }; } },
    albaranLineaFacturada: { createMany: async () => {} },
    merchant: {
      findUnique: async () => ({ id: 7, country: 'ES', flags: { INVOICING_ES_ENABLED: true }, invoiceSeq: 0, quoteSeq: 0 }),
      update: async () => ({ id: 7, invoiceSeq: 1, quoteSeq: 1 }),
    },
    // Lo que este test vigila: si se crea un presupuesto, se captura entero.
    quote: { create: async ({ data }) => { cap.adicionalCreado = data; return { id: 91, quoteNumber: 12 }; } },
  }, {
    get(o, k) {
      if (k in o) return o[k];
      if (typeof k === 'string' && k.startsWith('$')) return async () => [];
      return { findFirst: async () => null, findMany: async () => [], upsert: async () => ({}), create: async () => ({}), update: async () => ({}) };
    },
  });
  p.$transaction = async (cb) => cb(tx);
  return cap;
}

// SCRUM-510 · merchant 7, el MISMO que devuelve `p.merchant` arriba. Estaba en 1 —el DEMO— y
// el guard de SCRUM-409 lo eximía por el comentario que explica que este fichero lo evita.
const REQ = { params: { id: '1' }, body: {}, merchantId: 7, userRole: 'admin', user: { id: 1 } };

const LINEA_QUE_CASA = { concepto: 'Tubo multicapa 16mm', cantidad: 3, unidad: 'm', quoteLineIndex: 0 };

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO · el que de verdad protege al cliente
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-290 · CONTROL NEGATIVO: sin nada fuera de presupuesto, NO se crea ningún adicional', () => {
  const cap = montar([LINEA_QUE_CASA]);
  return invocar(REQ).then((r) => {
    assert.equal(r.code, 201);
    assert.equal(cap.adicionalCreado, null,
      '🔴 se ha creado un presupuesto adicional VACÍO: un documento que le pide al cliente que firme la nada');
    assert.equal(r.body.adicional, null, '`null` = no hacía falta, y se dice explícitamente');
    assert.equal(r.body.adicionalFallido, false, 'no haber creado nada NO es un fallo: son cosas distintas');
  });
});

test('SCRUM-290 · una línea SIN CANTIDAD tampoco genera adicional', () => {
  // No es trabajo nuevo: es una línea mal rellenada. Meterla haría firmar al cliente algo que ni
  // siquiera se hizo.
  const cap = montar([LINEA_QUE_CASA, { concepto: 'Revisión', cantidad: 0, unidad: 'h' }]);
  return invocar(REQ).then((r) => {
    assert.equal(r.code, 201);
    assert.equal(cap.adicionalCreado, null);
    // Pero NO desaparece del informe: sigue nombrada, para que el profesional vea que está mal.
    assert.ok(r.body.paraAdicional.some((l) => l.motivo === 'sin_cantidad'),
      'no se factura y no va al adicional, pero tampoco se descarta en silencio');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO · se crea, y las lleva TODAS
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-290 · CONTROL POSITIVO: con líneas fuera, se crea el adicional y las lleva todas', () => {
  const cap = montar([
    LINEA_QUE_CASA,
    { concepto: 'Picar tabique', cantidad: 2, unidad: 'h' },
    { concepto: 'Retirar escombro', cantidad: 1, unidad: 'ud' },
  ]);
  return invocar(REQ).then((r) => {
    assert.equal(r.code, 201);
    assert.ok(cap.adicionalCreado, '🔴 había trabajo fuera de presupuesto y no se creó el adicional');

    // ENGANCHADO AL TRABAJO (SCRUM-195): aceptarlo NO crea un segundo Trabajo.
    assert.equal(cap.adicionalCreado.jobId, 1, 'sin `jobId` sería un presupuesto suelto, no un adicional');
    // 🔴 SCRUM-510 · la expectativa se DERIVA del `REQ`, no se escribe un número. Estaba clavada a
    // `1` —el merchant DEMO— y por eso cambiar el fixture la rompía: medía el número, no el hecho.
    // Lo que hay que comprobar es que el adicional hereda la tenencia DE LA PETICIÓN (regla 2).
    assert.equal(cap.adicionalCreado.merchantId, REQ.merchantId, 'tenencia (regla 2)');
    // NACE EN `draft`: no se manda solo, porque sus líneas no tienen precio todavía.
    assert.equal(cap.adicionalCreado.status, 'draft');
    assert.equal(cap.adicionalCreado.total, '0.00');

    const lineas = cap.adicionalCreado.lines;
    assert.equal(lineas.length, 2, 'las DOS líneas de obra, no una');
    assert.ok(lineas.every((l) => l.price === 0),
      'el precio de un trabajo nuevo no se puede inventar: lo pone el profesional');
    // La unidad va en el concepto porque `Quote.lines` no tiene campo para ella, y sin ella «2» no
    // dice si son dos horas o dos metros.
    assert.match(lineas[0].concept, /Picar tabique \(2 h\)/);
    assert.match(lineas[1].concept, /Retirar escombro \(1 ud\)/);

    // Y el MOTIVO viaja en la respuesta, no en el documento que lee el cliente.
    assert.equal(r.body.paraAdicional.length, 2);
    assert.ok(r.body.paraAdicional.every((l) => l.motivo === 'no_estaba_en_el_presupuesto'));
  });
});

test('SCRUM-290 · el motivo NO se le enseña al cliente en el documento', () => {
  // «exceso_sobre_lo_presupuestado» es jerga nuestra. Ponerla en un papel que alguien firma es
  // ponerle delante nuestro razonamiento interno en vez de lo que contrató.
  const lineas = lineasParaAdicional([
    { lineaIndex: 0, concepto: 'Tubo', cantidad: 2, unidad: 'm', motivo: 'exceso_sobre_lo_presupuestado', exceso: 2 },
  ]);
  assert.equal(lineas.length, 1);
  assert.doesNotMatch(lineas[0].concept, /exceso|presupuestado|motivo/i);
  assert.match(lineas[0].concept, /Tubo \(2 m\)/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA FACTURA NO SE REVIERTE SI EL ADICIONAL FALLA (regla 29)
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-290 · si el adicional falla, la factura emitida NO se revierte — se dice', () => {
  const cap = montar([LINEA_QUE_CASA, { concepto: 'Picar tabique', cantidad: 2, unidad: 'h' }]);
  const p = moduloPrisma.prisma;
  const original = p.$transaction;
  let vuelta = 0;
  p.$transaction = async (cb) => {
    vuelta += 1;
    if (vuelta === 2) throw new Error('la BD se cayó creando el adicional');
    return original(cb);
  };
  return invocar(REQ).then((r) => {
    assert.equal(r.code, 201, 'la factura se emitió: deshacerla iría contra la regla 29');
    assert.ok(cap.facturaEmitida, 'la factura existe');
    assert.equal(r.body.adicional, null);
    assert.equal(r.body.adicionalFallido, true, '🔴 el fallo se ha callado: el profesional creería que el adicional está creado');
    assert.ok(r.body.message, 'y se dice en la respuesta, no solo en el log');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ROJO POR EL MECANISMO
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-290 · ROJO POR EL MECANISMO: si nadie crea el adicional, el test lo NOMBRA', () => {
  // Neutralizar la creación = `quote.create` que no se llama nunca. Si el endpoint dejara de
  // crearlo, esto es lo que caería, y con el nombre de lo que falta.
  const cap = montar([LINEA_QUE_CASA, { concepto: 'Picar tabique', cantidad: 2, unidad: 'h' }]);
  return invocar(REQ).then(() => {
    assert.ok(cap.adicionalCreado,
      '🔴 hay trabajo fuera de presupuesto y NADIE ha creado el presupuesto adicional: se factura lo pactado y lo demás se pierde, que es exactamente lo que la ley obliga a evitar');
  });
});
