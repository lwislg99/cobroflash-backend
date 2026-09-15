// tests/scrum729-el-escritor-del-cliente.test.mjs — SCRUM-729
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL CLIENTE DE UNA FACTURA EMITIDA NO CAMBIA CUANDO CAMBIA SU FICHA.
//
// Sin gate y SIN BASE: los tres reconstructores de documento —`ensureInvoicePdf` y
// `buildVerifactuRegistrosXml`— reciben el cliente de Prisma POR PARÁMETRO, así que se les pasa un
// doble y se ejecuta el camino de verdad. Ni una firma se ha cambiado para poder mirar.
//
// ── LOS CUATRO CONTROLES QUE PIDIÓ EL FUNDADOR, Y CUÁL DECIDE ──────────────────────────────────
//
//   ① POSITIVO ...... emitir, cambiar nombre y NIF del cliente, y el PDF de la emitida sigue
//                     mostrando lo de entonces.
//   ② NEGATIVO ...... una factura ANTERIOR al escritor, con las cinco columnas a NULL, sigue
//                     generándose sin romper.
//   ③ ROJO POR MECANISMO ... con el escritor revertido, ① vuelve a caer. Si no cae, ① no estaba
//                     midiendo nada.
//   ④ 🔴 EL QUE DECIDE ..... el XML de la AEAT de una factura emitida NO cambia al cambiar el NIF
//                     del cliente. Es el hallazgo más grave del plan y sin esto no se prueba.
//
// ── POR QUÉ ④ ES EL QUE DECIDE ────────────────────────────────────────────────────────────────
//
// En el PDF, el cliente se IMPRIME. En el XML de la AEAT, el NIF del cliente **decide**:
// con `MODO_SIN_DESTINATARIO = 'SIN_DICTAMEN'`, una factura cuyo cliente no tiene NIF queda FUERA
// del registro. Leyendo la ficha viva al exportar, rellenar el NIF de un cliente en septiembre
// METÍA en el registro una factura de marzo, y borrarlo la SACABA. Nadie tocó la factura.
//
// Y peor: `TipoFactura` es uno de los OCHO campos de `computeVeriFactuHash`. Al sellar sale de la
// columna congelada `invoice.type`; al exportar salía de la ficha viva. O sea que editar un
// cliente podía dejar el XML declarando un `TipoFactura` distinto del que va dentro de la huella
// que ese mismo XML lleva firmada.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { textoDePdf, contiene } from './_pdf-texto.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs'; // SCRUM-262: rango imposible

const {
  congelarDesdeFicha, congelarCliente, congelarParaRectificativa, clienteDelDocumento,
  CAMPOS_CONGELADOS,
} = await import('../dist/modules/invoicing/domain/clienteCongelado.js');
const { crearFacturaEmitida } = await import('../dist/modules/invoicing/domain/crearFacturaEmitida.js');
const { ensureInvoicePdf } = await import('../dist/lib/invoicing.js');
const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');

// ── el mundo de la prueba ──────────────────────────────────────────────────────────────────────

/** Merchant ES con NIF: el que SÍ entra en la cadena VeriFactu. */
const MERCHANT = {
  id: 42, country: 'ES', taxId: 'B12345678', name: 'Fontanería QA',
  legalName: 'Fontanería QA S.L.', address: 'Calle Falsa 1', logoUrl: null,
  whatsappPhone: telefonoDePrueba(1), email: 'pro@ejemplo.test', defaultCurrency: 'EUR',
};

/** La ficha del cliente EL DÍA DE LA EMISIÓN. */
const FICHA_DE_ENTONCES = {
  name: 'Ferretería Pepe', legalName: 'Ferretería Pepe SL', taxId: 'B99999999',
  email: 'pepe@ferre.test', phone: telefonoDePrueba(2),
};

/** La MISMA ficha después de que alguien corrija una errata. Nadie tocó ninguna factura. */
const FICHA_DE_HOY = {
  name: 'Suministros Norte', legalName: 'Suministros Norte SLU', taxId: 'B11111111',
  email: 'pepe@ferre.test', phone: telefonoDePrueba(2),
};

const LINEAS = [{ concept: 'Reparación de fuga', qty: 1, price: 100, tax: 0.21 }];

/**
 * Una factura ya emitida. `congelado: false` la deja como estaban TODAS antes de este ticket:
 * las cinco columnas a NULL.
 */
const factura = ({ congelado = true, ficha = FICHA_DE_ENTONCES, id = 1, number = 'F260001' } = {}) => ({
  id,
  merchantId: MERCHANT.id,
  customerId: 7,
  number,
  type: 'F1',
  total: { toString: () => '121.00' },
  currency: 'EUR',
  lines: LINEAS,
  stageLabel: null,
  createdAt: new Date('2026-03-15T10:00:00Z'),
  vfEstado: 'sellado',
  vfHash: 'A'.repeat(64),
  vfPrevHash: null,
  vfTimestamp: new Date('2026-03-15T10:00:01Z'),
  pdfUrl: 'PENDING_PDF',
  qrData: 'PENDING_QR',
  rectifies: null,
  ...(congelado ? congelarDesdeFicha(ficha) : {}),
});

/** El doble de Prisma para `ensureInvoicePdf`: la ficha VIVA es la que se le pase. */
const prismaParaPdf = (inv, fichaViva) => ({
  invoice: {
    findUnique: async () => ({ ...inv, merchant: MERCHANT, customer: { id: 7, ...fichaViva } }),
    update: async () => inv,
  },
});

/** El doble para el XML de la AEAT. Mismo patrón que `scrum215-sin-destinatario`. */
const prismaParaXml = (invoices, fichaViva) => ({
  merchant: { findUnique: async () => MERCHANT },
  invoice: {
    findMany: async () => invoices.map((i) => ({ ...i, customer: { name: fichaViva.name, taxId: fichaViva.taxId } })),
  },
});

const xmlDe = async (invoices, fichaViva) =>
  buildVerifactuRegistrosXml({ merchantId: MERCHANT.id, year: 2026 }, prismaParaXml(invoices, fichaViva));

/** Genera el PDF y devuelve su texto, BORRANDO antes el fichero para que regenere de verdad. */
async function textoDelPdfDe(inv, fichaViva) {
  const r = await ensureInvoicePdf(inv.id, prismaParaPdf(inv, fichaViva));
  const texto = textoDePdf(r.diskPath);
  fs.rmSync(r.diskPath, { force: true });
  return texto;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ EL CONTROL QUE DECIDE — el registro de la AEAT
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-729 · 🔴 ④ EL QUE DECIDE: el XML de la AEAT NO cambia al cambiar el NIF del cliente', async () => {
  const inv = factura();

  const antes = await xmlDe([inv], FICHA_DE_ENTONCES);
  const despues = await xmlDe([inv], FICHA_DE_HOY);

  // SUELO: si la factura no entrara en el registro, los dos XML serían iguales por vacíos y este
  // test diría «no cambia» sin haber declarado nada. Cero registros es ceguera, no éxito.
  assert.equal(antes.count, 1,
    '🔴 CENSO CIEGO: la factura no ha entrado en el registro, así que comparar los dos XML no '
    + `dice nada. Excluidos: ${JSON.stringify(antes.excluidos)}`);

  assert.equal(despues.xml, antes.xml,
    '🔴 EL REGISTRO DE LA AEAT CAMBIA AL EDITAR UNA FICHA DE CLIENTE. Es el defecto de SCRUM-729 '
    + 'en su versión grave: no es que se imprima otro nombre, es que se DECLARA otro destinatario '
    + 'para una factura ya sellada.');

  assert.ok(antes.xml.includes(FICHA_DE_ENTONCES.taxId),
    `🔴 el XML no lleva el NIF congelado ${FICHA_DE_ENTONCES.taxId}: se está comparando otra cosa`);
  assert.ok(!despues.xml.includes(FICHA_DE_HOY.taxId),
    `🔴 el NIF de HOY (${FICHA_DE_HOY.taxId}) se ha colado en el registro de una factura de marzo`);
});

test('SCRUM-729 · 🔴 ④-bis: y CAE con el mecanismo viejo (columnas a NULL = leer en vivo)', async () => {
  // El mismo par de llamadas sobre una factura ANTERIOR al escritor. Si esto no cambiara, el test
  // de arriba estaría verde por casualidad y no por el arreglo.
  const vieja = factura({ congelado: false });

  const antes = await xmlDe([vieja], FICHA_DE_ENTONCES);
  const despues = await xmlDe([vieja], FICHA_DE_HOY);

  assert.notEqual(despues.xml, antes.xml,
    '🔴 el control ④ no discrimina: sin columnas congeladas el XML TIENE que cambiar, porque ése '
    + 'es exactamente el defecto. Si aquí sale igual, el instrumento no está mirando el NIF.');
});

test('SCRUM-729 · 🔴 ④-ter: el NIF de hoy ya no decide si la factura ENTRA en el registro', async () => {
  // Emitida a un particular SIN NIF (el caso normal en oficios, SCRUM-215): queda fuera del
  // registro. Si mañana alguien le rellena el NIF a esa ficha, la factura de marzo NO puede
  // aparecer de pronto declarada — con `TipoFactura` distinto del que lleva dentro la huella.
  const sinNif = factura({ ficha: { ...FICHA_DE_ENTONCES, taxId: null } });

  const conFichaSinNif = await xmlDe([sinNif], { ...FICHA_DE_ENTONCES, taxId: null });
  const conFichaConNif = await xmlDe([sinNif], FICHA_DE_HOY);

  assert.equal(conFichaSinNif.count, 0, 'una factura sin NIF del cliente queda fuera (SIN_DICTAMEN)');
  assert.equal(conFichaConNif.count, 0,
    '🔴 rellenar el NIF de un cliente HOY ha metido en el registro de la AEAT una factura que se '
    + 'emitió sin destinatario identificado. Eso es fabricar una declaración.');
  assert.equal(conFichaConNif.xml, conFichaSinNif.xml);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① y ② los controles sobre el PDF
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-729 · SUELO: el extractor lee texto de verdad del PDF generado', async () => {
  const texto = await textoDelPdfDe(factura(), FICHA_DE_ENTONCES);
  assert.ok(texto.length > 100,
    `🔴 EXTRACTOR CIEGO: ${texto.length} caracteres. Dos vacíos comparados dan «idéntico», así que `
    + 'sin este suelo los controles de abajo saldrían verdes sin mirar nada.');
  assert.ok(contiene(texto, MERCHANT.name),
    '🔴 el PDF no lleva ni el nombre del emisor: no se está leyendo el documento correcto');
});

test('SCRUM-729 · 🔴 ① CONTROL POSITIVO: cambia la ficha y el PDF de la emitida NO cambia', async () => {
  const inv = factura();

  const antes = await textoDelPdfDe(inv, FICHA_DE_ENTONCES);
  const despues = await textoDelPdfDe(inv, FICHA_DE_HOY);

  assert.ok(contiene(antes, FICHA_DE_ENTONCES.legalName), 'suelo: el nombre de entonces SÍ salía');

  assert.ok(contiene(despues, FICHA_DE_ENTONCES.legalName),
    `🔴 el PDF ha dejado de mostrar «${FICHA_DE_ENTONCES.legalName}», que es el cliente del día en `
    + 'que se emitió. Una factura emitida no cambia de destinatario (regla 29).');
  assert.ok(!contiene(despues, FICHA_DE_HOY.legalName),
    `🔴 «${FICHA_DE_HOY.legalName}» —la ficha de HOY— ha aparecido en una factura de marzo.`);
});

test('SCRUM-729 · 🔴 ③ ROJO POR MECANISMO: con el escritor revertido, ① vuelve a caer', async () => {
  // «Escritor revertido» = las cinco columnas a NULL, que es literalmente el mundo de antes de
  // este ticket. Si el PDF NO cambiara aquí, el control ① estaría verde por otra razón.
  const vieja = factura({ congelado: false });

  const antes = await textoDelPdfDe(vieja, FICHA_DE_ENTONCES);
  const despues = await textoDelPdfDe(vieja, FICHA_DE_HOY);

  assert.notEqual(despues, antes,
    '🔴 el control ① no discrimina: sin congelar, el PDF TIENE que cambiar. Ése es el defecto.');
  assert.ok(contiene(despues, FICHA_DE_HOY.legalName),
    '🔴 con las columnas a NULL el PDF debería estar leyendo la ficha viva, y no lo hace: '
    + 'entonces el respaldo para las facturas antiguas no funciona.');
});

test('SCRUM-729 · ② CONTROL NEGATIVO: una factura ANTERIOR (cinco columnas a NULL) sigue saliendo', async () => {
  const vieja = factura({ congelado: false, id: 2, number: 'F260002' });

  const texto = await textoDelPdfDe(vieja, FICHA_DE_HOY);

  assert.ok(texto.length > 100, '🔴 el PDF de una factura antigua ha dejado de generarse');
  assert.ok(contiene(texto, FICHA_DE_HOY.legalName),
    '🔴 sin dato congelado el documento tiene que caer a la ficha viva: es lo mejor que consta, '
    + 'y romper el PDF de las 55 facturas que ya existen no es una opción.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL ESCRITOR: que no pueda producir un NULL es lo que hace segura la frontera
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-729 · 🔴 el envoltorio escribe los CINCO campos en el MISMO insert', async () => {
  let visto = null;
  const tx = { invoice: { create: async ({ data }) => { visto = data; return { id: 1 }; } } };

  // ⚠️ `merchantId` NO es 1: el 1 es el merchant DEMO (regla 8) y un fixture ahí desactiva
  // comprobaciones sin tocar ningún guard. Lo cazó SCRUM-409 sobre este mismo fichero.
  await crearFacturaEmitida(tx, congelarDesdeFicha(FICHA_DE_ENTONCES), {
    merchantId: MERCHANT.id, customerId: 7, number: 'F260003', total: '121.00', currency: 'EUR',
  });

  assert.ok(visto, '🔴 el envoltorio no ha llamado a `invoice.create`');
  for (const campo of CAMPOS_CONGELADOS) {
    assert.ok(campo in visto,
      `🔴 el envoltorio no escribe \`${campo}\`. Congelar cuatro de cinco deja un documento mitad `
      + 'congelado y mitad vivo, y nadie sabe cuál es cuál mirándolo.');
  }
  assert.equal(visto.customerName, FICHA_DE_ENTONCES.name);
  assert.equal(visto.customerTaxId, FICHA_DE_ENTONCES.taxId);
  assert.equal(visto.number, 'F260003', 'y no pisa los datos del documento');
});

test('SCRUM-729 · 🔴 `customerName` NUNCA sale nulo del escritor: es lo que hace segura la frontera', () => {
  // La regla de lectura dice «NULL = documento anterior al escritor». Eso sólo es cierto si el
  // escritor no puede producir un NULL. `Customer.name` es `String` no nulo en el esquema.
  assert.equal(congelarDesdeFicha({ name: 'X' }).customerName, 'X');
  assert.equal(congelarDesdeFicha({ name: 'X' }).customerTaxId, null,
    'los otros cuatro SÍ pueden ser nulos, y por eso el lector no pregunta por ellos');
});

test('SCRUM-729 · `congelarCliente` falla ANTES de pedir número si el cliente no existe', async () => {
  const db = { customer: { findFirst: async () => null } };
  await assert.rejects(() => congelarCliente(db, MERCHANT.id, 7), /cliente_no_encontrado_al_congelar:7/,
    '🔴 tiene que fallar aquí: si reventara después, el número ya estaría consumido y la serie '
    + 'tendría un hueco que justificar ante Hacienda.');
});

test('SCRUM-729 · la RECTIFICATIVA hereda el destinatario de la factura que rectifica', async () => {
  const db = { customer: { findFirst: async () => FICHA_DE_HOY } };

  const heredado = await congelarParaRectificativa(db, { ...factura(), customerId: 7 });
  assert.equal(heredado.customerTaxId, FICHA_DE_ENTONCES.taxId,
    '🔴 la R1 ha cogido el NIF de HOY. Declararía un destinatario distinto del de la factura que '
    + 'corrige, y a la AEAT le llegan las dos.');

  // Si la original es anterior al escritor no hay nada que heredar: se congela la ficha viva.
  const sinHerencia = await congelarParaRectificativa(db, { ...factura({ congelado: false }), customerId: 7 });
  assert.equal(sinHerencia.customerTaxId, FICHA_DE_HOY.taxId);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL LECTOR, en sus tres desenlaces
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-729 · el lector: columna presente → la columna, SIEMPRE, aunque la ficha diga otra cosa', () => {
  const r = clienteDelDocumento(congelarDesdeFicha(FICHA_DE_ENTONCES), FICHA_DE_HOY);
  assert.equal(r.name, FICHA_DE_ENTONCES.name);
  assert.equal(r.taxId, FICHA_DE_ENTONCES.taxId);
  assert.equal(r.congelado, true);
});

test('SCRUM-729 · el lector: columna a NULL → ficha viva, y lo DICE', () => {
  const r = clienteDelDocumento({}, FICHA_DE_HOY);
  assert.equal(r.name, FICHA_DE_HOY.name);
  assert.equal(r.congelado, false,
    '🔴 el lector tiene que poder decir que está leyendo en vivo: una excepción declarada no es '
    + 'una excepción si no se distingue del caso normal.');
});

test('SCRUM-729 · el lector: sin columna y sin ficha, LANZA (no devuelve un cliente vacío)', () => {
  assert.throws(() => clienteDelDocumento({}, null), /documento_sin_cliente_congelado_ni_ficha_viva/,
    '🔴 un documento con el destinatario en blanco es peor que un error: parece válido.');
});

test('SCRUM-729 · 🔴 un particular SIN NIF sigue contando como congelado (no es «no consta»)', () => {
  // Si el lector preguntara por `customerTaxId` en vez de por `customerName`, TODA factura a un
  // particular —el caso normal en oficios— se leería como «anterior al escritor» y volvería a
  // leer en vivo. El defecto entero, colado por la puerta del caso más común.
  const congeladoSinNif = congelarDesdeFicha({ ...FICHA_DE_ENTONCES, taxId: null });
  const r = clienteDelDocumento(congeladoSinNif, FICHA_DE_HOY);
  assert.equal(r.congelado, true);
  assert.equal(r.taxId, null);
  assert.equal(r.name, FICHA_DE_ENTONCES.name,
    '🔴 una factura a un particular ha vuelto a leer la ficha viva');
});
