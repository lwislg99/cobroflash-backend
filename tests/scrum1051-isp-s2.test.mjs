// SCRUM-1051 (GO de Javier, 23-sep-2026) · ISP en obra/subcontrata (S2), en el sellado VeriFactu.
//
// EL ROJO YA ESTABA MEDIDO antes de este ticket (docs/master/SCRUM-1050.md y SCRUM-1051.md): una
// línea sin cuota (ISP o exenta) tumbaba `buildVerifactuRegistrosXml` con
// `DesgloseNoClasificableError`, porque `Invoice.lines` no guardaba POR QUÉ una línea no
// repercute IVA. Este test prueba el arreglo (una `causa` por línea) y el ratchet: que el mismo
// 0% SIN causa siga rechazándose igual que antes — el arreglo es aditivo, no relaja nada.
//
// Alcance del GO: SOLO `S2` está activa. `E1`/`N1` existen en el tipo pero ningún llamador las
// habilita — eso lo prueba el validador (`causaLineaEmitible.test` más abajo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarRegistrosXml } from './_xsd-verifactu.mjs';

const merchant = {
  id: 1, country: 'ES', taxId: 'B12345678', legalName: 'Instalaciones QA S.L.', name: 'Instalaciones QA',
};

const mkInvoice = (over = {}) => ({
  number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z'), total: '1000.00', type: 'F1',
  lines: [{ concept: 'Subcontrata de obra (ISP art. 84.Uno.2.f LIVA)', qty: 1, price: 1000, tax: 0, causa: 'S2' }],
  vfHash: 'A'.repeat(64), vfPrevHash: null, customer: { name: 'Contratista QA', taxId: 'A11111111' }, rectifies: null,
  ...over,
});

const fakePrisma = (invoices) => ({
  merchant: { findUnique: async () => merchant },
  invoice: { findMany: async (a) => (a?.where?.vfHash ? invoices.filter((i) => i.vfHash) : invoices) },
});

const build = async (invoices) => {
  const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');
  const { xml } = await buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, fakePrisma(invoices));
  return xml;
};

test('SCRUM-1051 · una línea ISP (causa: S2) SELLA, con CalificacionOperacion S2', async () => {
  const xml = await build([mkInvoice()]);
  const { valido, errores } = await validarRegistrosXml(xml, 'isp.xml');
  assert.equal(valido, true, `🔴 el XML con ISP no valida contra el XSD:\n${errores.join('\n')}`);
  assert.match(xml, /<sum1:CalificacionOperacion>S2<\/sum1:CalificacionOperacion>/);
  // TipoImpositivo y CuotaRepercutida son minOccurs="0" en el XSD, y la cuota la
  // autorrepercute el destinatario: NO deben aparecer para un tramo S2.
  assert.doesNotMatch(xml, /<sum1:TipoImpositivo>0<\/sum1:TipoImpositivo>/);
  assert.doesNotMatch(xml, /<sum1:CuotaRepercutida>0\.00<\/sum1:CuotaRepercutida>/);
  assert.match(xml, /<sum1:BaseImponibleOimporteNoSujeto>1000\.00<\/sum1:BaseImponibleOimporteNoSujeto>/);
});

test('SCRUM-1051 · factura mixta (21% normal + ISP) SELLA las dos entradas por separado', async () => {
  const mixta = mkInvoice({
    total: '1242.00',
    lines: [
      { concept: 'Material', qty: 1, price: 200, tax: 0.21 },
      { concept: 'Subcontrata de obra (ISP)', qty: 1, price: 1000, tax: 0, causa: 'S2' },
    ],
  });
  const xml = await build([mixta]);
  const { valido, errores } = await validarRegistrosXml(xml, 'mixta-isp.xml');
  assert.equal(valido, true, `🔴 la factura mixta 21%+ISP no valida:\n${errores.join('\n')}`);
  assert.match(xml, /<sum1:CalificacionOperacion>S1<\/sum1:CalificacionOperacion>/);
  assert.match(xml, /<sum1:CalificacionOperacion>S2<\/sum1:CalificacionOperacion>/);
});

test('SCRUM-1051 (ratchet) · un 0% SIN causa sigue EXCLUYÉNDOSE igual que antes de este ticket', async () => {
  const sinCausa = mkInvoice({ lines: [{ concept: 'x', qty: 1, price: 100, tax: 0 }] });
  const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');
  const { excluidos } = await buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, fakePrisma([sinCausa]));
  assert.equal(excluidos.length, 1, '🔴 SCRUM-1051 relajó el rechazo del 0% sin causa (SCRUM-209/1050).');
  assert.match(excluidos[0].motivo, /no se puede saber si es/);
});

// ── El portón: causa fuera de la lista activa se rechaza (SCRUM-1050 sigue sin construirse) ──

test('SCRUM-1051 · el portón rechaza E1/N1 (no activas) y acepta S2 y "sin causa"', async () => {
  const { causaLineaNoEmitible } = await import('../dist/core/validation/causaLineaEmitible.js');
  assert.match(causaLineaNoEmitible([{ causa: 'E1' }]) ?? '', /E1.*no está activa/);
  assert.match(causaLineaNoEmitible([{ causa: 'N1' }]) ?? '', /N1.*no está activa/);
  assert.equal(causaLineaNoEmitible([{ causa: 'S2' }]), null);
  assert.equal(causaLineaNoEmitible([{}]), null);
  assert.equal(causaLineaNoEmitible([]), null);
  assert.equal(causaLineaNoEmitible(null), null);
});
