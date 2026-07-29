// SCRUM-215 (VeriFactu · FISCAL, sin gate: corre en `npm test`, no toca BD ni red).
//
// LA FACTURA A UN PARTICULAR — el caso NORMAL en oficios, no el borde.
//
// El emisor omitía `Destinatarios` en cuanto el cliente no tenía NIF. Eso es VÁLIDO contra el
// XSD (`minOccurs="0"`) y RECHAZADO por la AEAT con el error **1189**: una F1/R1 tiene que
// llevar destinatario. O sea, el hueco perfecto: ni el esquema ni un assert de cadena podían
// verlo, y ocurría en cada factura a un particular.
//
// EL ESQUEMA PREVÉ DOS SALIDAS Y SON DECLARACIONES DISTINTAS:
//   A · `FacturaSinIdentifDestinatarioArt61d = S` — factura COMPLETA sin destinatario
//       identificado (art. 61.d RIVA). Sigue siendo F1.
//   B · `FacturaSimplificadaArt7273 = S` con `TipoFactura = F2` — la factura ES simplificada
//       (arts. 7.2/7.3). Otro documento, otro contenido obligatorio, y con techo de importe.
//
// 🚨 ESTE TEST NO ELIGE, Y EL CÓDIGO TAMPOCO. Cuál procede lo dice el dictamen P11. Lo que se
// prueba aquí es que las DOS están construidas y validan, para que el día del dictamen sea
// cambiar una constante y no escribir el mecanismo con prisa.
import test from 'node:test';
import assert from 'node:assert/strict';

import { validarRegistrosXml } from './_xsd-verifactu.mjs';

process.env.VERIFACTU_PRODUCTOR_NOMBRE = 'QA Productor';
process.env.VERIFACTU_PRODUCTOR_NIF = '89890001K';
process.env.VERIFACTU_ID_SISTEMA = '01';
process.env.VERIFACTU_VERSION = '1.0.0';
process.env.VERIFACTU_NUM_INSTALACION = '1';

const merchant = {
  id: 1, country: 'ES', taxId: 'B12345678', legalName: 'Fontanería QA S.L.', name: 'Fontanería QA',
};

/** Por defecto, CLIENTE SIN NIF: el particular al que el fontanero le arregla el baño. */
const mkInvoice = (over = {}) => ({
  number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z'), total: '121.00', type: 'F1',
  lines: [{ concept: 'Reparación de fuga', qty: 1, price: 100, tax: 0.21 }],
  vfHash: 'A'.repeat(64), vfPrevHash: null,
  customer: { name: 'María García', taxId: null },
  rectifies: null,
  ...over,
});

const fakePrisma = (invoices) => ({
  merchant: { findUnique: async () => merchant },
  invoice: { findMany: async (a) => (a?.where?.vfHash ? invoices.filter((i) => i.vfHash) : invoices) },
});

const build = async (invoices, opts) => {
  const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');
  return buildVerifactuRegistrosXml({ merchantId: 1, year: 2026 }, fakePrisma(invoices), opts);
};

// ── 1 · HOY, SIN DICTAMEN: no se declara, se excluye y se dice por qué ────────────────────

test('SCRUM-215 · sin dictamen, la factura a un particular se EXCLUYE y se reporta', async () => {
  const { count, excluidos, xml } = await build([mkInvoice()]);

  assert.equal(count, 0, 'no se declara');
  assert.equal(excluidos.length, 1);
  assert.equal(excluidos[0].number, '2026-CF-001');
  assert.match(excluidos[0].motivo, /1189/, 'el motivo debe nombrar el error de la AEAT');
  assert.match(excluidos[0].motivo, /P11/, 'y el dictamen que lo desbloquea');

  // SCRUM-216: si NO queda NADA declarable, no se entrega documento — un envelope sin
  // `RegistroFactura` no valida contra el XSD. El parte viaja en `excluidos`, que es lo que
  // el ZIP pone en el LEEME y el endpoint suelto devuelve con un 409.
  assert.equal(xml, '', '🔴 se estaría entregando un XML sin registros, que es inválido');
});

test('SCRUM-215 · si SOBREVIVE alguna, el XML sale y nombra dentro a la excluida', async () => {
  // El parte dentro del documento (SCRUM-209) sigue vivo mientras haya algo que declarar.
  const conNif = mkInvoice({ number: '2026-CF-009', customer: { name: 'Empresa', taxId: 'B99999999' } });
  const { count, excluidos, xml } = await build([mkInvoice(), conNif]);

  assert.equal(count, 1);
  assert.equal(excluidos.length, 1);
  assert.match(xml, /<sum1:NumSerieFactura>2026-CF-009<\/sum1:NumSerieFactura>/, 'la buena se declara');
  assert.match(xml, /ATENCION: 1 factura\(s\)/);
  assert.match(xml, /2026-CF-001/, 'la excluida se nombra dentro del fichero entregado');

  const { valido, errores } = await validarRegistrosXml(xml, 'mixto-sin-nif.xml');
  assert.equal(valido, true, `🔴 el lote mixto no valida:\n${errores.join('\n')}`);
});

test('SCRUM-215 · una factura CON NIF sigue declarándose con normalidad', async () => {
  // El caso bueno no puede haberse roto por el camino.
  const conNif = mkInvoice({ customer: { name: 'Comunidad de Vecinos', taxId: 'B99999999' } });
  const { count, excluidos, xml } = await build([conNif]);

  assert.equal(count, 1);
  assert.deepEqual(excluidos, []);
  assert.match(xml, /<sum1:Destinatarios>/);
  assert.match(xml, /<sum1:NIF>B99999999<\/sum1:NIF>/);
  assert.doesNotMatch(xml, /FacturaSinIdentifDestinatarioArt61d|FacturaSimplificadaArt7273/,
    '🔴 con destinatario identificado NO se marca ninguna de las dos salidas');

  const { valido, errores } = await validarRegistrosXml(xml, 'con-nif.xml');
  assert.equal(valido, true, `🔴 el caso con NIF dejó de validar:\n${errores.join('\n')}`);
});

// ── 2 · LAS DOS SALIDAS DEL DICTAMEN, construidas y validando ─────────────────────────────

test('SCRUM-215 · salida A — art. 61.d: F1 marcada, sin Destinatarios, y VALIDA', async () => {
  const { xml, count, excluidos } = await build([mkInvoice()], { modoSinDestinatario: 'ART_61D' });

  assert.equal(count, 1);
  assert.deepEqual(excluidos, []);
  assert.match(xml, /<sum1:TipoFactura>F1<\/sum1:TipoFactura>/, 'sigue siendo factura COMPLETA');
  assert.match(xml, /<sum1:FacturaSinIdentifDestinatarioArt61d>S<\/sum1:FacturaSinIdentifDestinatarioArt61d>/);
  assert.doesNotMatch(xml, /<sum1:Destinatarios>/);
  assert.doesNotMatch(xml, /FacturaSimplificadaArt7273/, '🔴 las dos salidas son excluyentes');

  const { valido, errores } = await validarRegistrosXml(xml, 'art61d.xml');
  assert.equal(valido, true, `🔴 la salida A no valida:\n${errores.join('\n')}`);
});

test('SCRUM-215 · salida B — simplificada: F2 marcada, sin Destinatarios, y VALIDA', async () => {
  const { xml, count, excluidos } = await build([mkInvoice()], { modoSinDestinatario: 'SIMPLIFICADA_F2' });

  assert.equal(count, 1);
  assert.deepEqual(excluidos, []);
  assert.match(xml, /<sum1:TipoFactura>F2<\/sum1:TipoFactura>/, 'el TIPO cambia: es otro documento');
  assert.match(xml, /<sum1:FacturaSimplificadaArt7273>S<\/sum1:FacturaSimplificadaArt7273>/);
  assert.doesNotMatch(xml, /<sum1:Destinatarios>/, 'una F2 con Destinatarios sería el error 1190');
  assert.doesNotMatch(xml, /FacturaSinIdentifDestinatarioArt61d/);

  const { valido, errores } = await validarRegistrosXml(xml, 'simplificada.xml');
  assert.equal(valido, true, `🔴 la salida B no valida:\n${errores.join('\n')}`);
});

test('SCRUM-215 · el ORDEN del XSD: el marcador va antes de Destinatarios', async () => {
  // La secuencia del XSD es DescripcionOperacion > FacturaSimplificada… >
  // FacturaSinIdentif… > … > Destinatarios. Ponerlo después valida hoy por casualidad
  // (no hay Destinatarios en este camino) y rompería en cuanto convivieran.
  const conNif = mkInvoice({ customer: { name: 'Cliente', taxId: 'B99999999' } });
  const { xml } = await build([mkInvoice({ number: '2026-CF-002' }), conNif], { modoSinDestinatario: 'ART_61D' });
  assert.ok(
    xml.indexOf('FacturaSinIdentifDestinatarioArt61d') < xml.indexOf('<sum1:Destinatarios>'),
    '🔴 el marcador debe ir ANTES de Destinatarios (sequence del XSD)',
  );
  const { valido, errores } = await validarRegistrosXml(xml, 'mixto.xml');
  assert.equal(valido, true, `🔴 el lote mixto no valida:\n${errores.join('\n')}`);
});

// ── 3 · LO QUE NO SE INVENTA ──────────────────────────────────────────────────────────────

test('SCRUM-215 · una R1 sin NIF NO se convierte en simplificada: se excluye', async () => {
  // Sería una R5 (rectificativa de simplificada) y el producto no modela ese tipo. Inventarle
  // el tipo a una rectificativa es la misma clase de error que inventar la calificación.
  const r1 = mkInvoice({ number: '2026-CF-R-001', type: 'R1' });
  const { count, excluidos } = await build([r1], { modoSinDestinatario: 'SIMPLIFICADA_F2' });
  assert.equal(count, 0);
  assert.match(excluidos[0].motivo, /R5/);
});

test('SCRUM-215 · bajo art. 61.d una R1 sin NIF SÍ se resuelve (sigue siendo R1)', async () => {
  const r1 = mkInvoice({ number: '2026-CF-R-001', type: 'R1' });
  const { xml, count } = await build([r1], { modoSinDestinatario: 'ART_61D' });
  assert.equal(count, 1);
  assert.match(xml, /<sum1:TipoFactura>R1<\/sum1:TipoFactura>/);
  const { valido } = await validarRegistrosXml(xml, 'r1-art61d.xml');
  assert.equal(valido, true);
});

// ── 4 · EL RATCHET DEL DICTAMEN ───────────────────────────────────────────────────────────

test('SCRUM-215 · la constante sigue SIN DICTAMEN — cambiarla es aplicar el dictamen P11', async () => {
  const { MODO_SIN_DESTINATARIO } = await import('../dist/modules/fiscal/verifactu/registro.builder.js');
  assert.equal(
    MODO_SIN_DESTINATARIO,
    'SIN_DICTAMEN',
    '🔴 Alguien ha elegido entre `FacturaSinIdentifDestinatarioArt61d` y ' +
      '`FacturaSimplificadaArt7273`. Esa elección es una calificación fiscal y la decide el ' +
      'dictamen P11, no el código. Si el dictamen YA está, actualiza este test citándolo — y ' +
      'si eliges F2, mira antes el 1150: una simplificada por encima de 3.000 € es otro ROJO, ' +
      'y hoy nada comprueba ese techo.',
  );
});
