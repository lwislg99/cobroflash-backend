// tests/scrum1051c-isp-medicion.test.mjs — SCRUM-1051c · MEDICIÓN, sólo lectura (regla 38)
//
// Dos huecos de la inversión del sujeto pasivo (S2), medidos con el código real de `dist/` y sin
// tocar el camino de emisión. Este test FIJA lo que hace HOY; no dice que esté bien. Lo que sale
// mal está en `docs/master/SCRUM-1051.md`, tramo 1051c, con sus preguntas ✅/❌ para el fundador.
// Si un caso cae porque alguien lo ARREGLÓ con GO, se actualiza el caso y el tramo: no es un rojo
// que haya que «devolver a verde» deshaciendo el arreglo.
//
//   ① `POST /admin/invoices` (factura suelta, la única boca que recibe las líneas del cuerpo)
//      pasa por `validarFacturaSuelta`, que reconstruye cada línea con concept/qty/price/tax y
//      DESCARTA `causa`. La boca de presupuesto (`lineasParaFacturar`) sí la conserva.
//      ✅ ARREGLADO en SCRUM-1051d con el GO de c.21180 (punto 1): los tres casos de ① que fijaban
//      el defecto se han dado la vuelta aquí, y el arreglo entero lo vigila
//      `tests/scrum1051d-suelta-conserva-causa.test.mjs`. ② sigue fijando lo de HOY (punto 2, ⏸).
//   ② La R1 de una factura con línea S2, construida como la construye `POST /:id/rectify`
//      ({...l, price: -price}), pasa por `buildVerifactuRegistrosXml`: sale R1 + I, S2, base
//      negativa, SIN `TipoImpositivo` ni `CuotaRepercutida`. El catálogo de la AEAT
//      (docs/legal/fuentes/aeat-errores.properties, código 1198) dice que con S2 esos dos campos
//      «deberan tener valor 0»: si omitirlos lo cumple NO está medido contra la AEAT.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarRegistrosXml } from './_xsd-verifactu.mjs';

const { validarFacturaSuelta } = await import('../dist/modules/invoicing/domain/facturaSuelta.js');
const { lineasParaFacturar } = await import('../dist/modules/invoicing/domain/invoiceLines.service.js');
const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');

const LINEA_S2 = Object.freeze({ concept: 'Subcontrata de obra', qty: 1, price: 1000, tax: 0, causa: 'S2' });

const merchant = { id: 1, country: 'ES', taxId: 'B12345678', legalName: 'Instalaciones QA S.L.', name: 'Instalaciones QA' };
const fakePrisma = (invs) => ({
  merchant: { findUnique: async () => merchant },
  invoice: { findMany: async (a) => (a?.where?.vfHash ? invs.filter((i) => i.vfHash) : invs) },
});
const original = (lines) => ({
  number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z'), total: '1000.00', type: 'F1', lines,
  vfHash: 'A'.repeat(64), vfPrevHash: null, customer: { name: 'Contratista QA', taxId: 'A11111111' }, rectifies: null,
});
// La R1 con la MISMA expresión que `POST /admin/invoices/:id/rectify` (invoicesAdmin.routes.ts):
// la ruta no exporta nada, así que es una copia — si la ruta cambia, este fixture no se entera.
const rectificativa = (orig) => ({
  number: '2026-CF-R-001', createdAt: new Date('2026-03-20T10:00:00Z'), total: (-Number(orig.total)).toFixed(2),
  type: 'R1', lines: orig.lines.map((l) => ({ ...l, price: -(Number(l.price) || 0) })),
  vfHash: 'B'.repeat(64), vfPrevHash: orig.vfHash, customer: orig.customer,
  rectifies: { number: orig.number, createdAt: orig.createdAt, lines: orig.lines },
});
const registroDe = (xml, numero) => {
  const bloques = xml.split('<sum1:RegistroAlta>').slice(1);
  const uno = bloques.filter((b) => b.includes(`<sum1:NumSerieFactura>${numero}</sum1:NumSerieFactura>`)
    && b.indexOf(`<sum1:NumSerieFactura>${numero}<`) === b.indexOf('<sum1:NumSerieFactura>'));
  assert.equal(uno.length, 1, `CIEGO: el XML no trae exactamente un RegistroAlta de ${numero} (trae ${uno.length} de ${bloques.length})`);
  return uno[0];
};

// ── ① la boca de la factura suelta ──────────────────────────────────────────────────────────

test('1051c ① · desde 1051d validarFacturaSuelta CONSERVA la causa de la línea (las otras cuatro claves llegan)', () => {
  const v = validarFacturaSuelta({ customerId: 5, lines: [{ ...LINEA_S2 }] });
  assert.equal(v.ok, true, `CIEGO: la validación no aceptó el cuerpo de control: ${JSON.stringify(v)}`);
  assert.equal(v.lineas.length, 1);
  // Suelo: lo que la línea sí conserva, para que «no trae causa» no se lea sobre una línea vacía.
  assert.deepEqual(
    { concept: v.lineas[0].concept, qty: v.lineas[0].qty, price: v.lineas[0].price, tax: v.lineas[0].tax },
    { concept: 'Subcontrata de obra', qty: 1, price: 1000, tax: 0 },
  );
  assert.equal(v.lineas[0].causa, 'S2', 'la factura suelta vuelve a DESCARTAR la causa (el defecto de 1051c)');
});

test('1051c ① · control: la boca de presupuesto (lineasParaFacturar) SÍ conserva la causa', () => {
  const lineas = lineasParaFacturar({ lines: [{ ...LINEA_S2 }], discountGlobalAmount: null });
  assert.equal(lineas.length, 1);
  assert.equal(lineas[0].causa, 'S2');
});

test('1051c ① · desde 1051d la línea S2 que sale de la suelta SELLA (ya no es un 0 % sin causa que se excluye)', async () => {
  const { lineas } = validarFacturaSuelta({ customerId: 5, lines: [{ ...LINEA_S2 }] });
  const conCausa = await buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, fakePrisma([original([{ ...LINEA_S2 }])]));
  assert.equal(conCausa.excluidos.length, 0, 'control: con la causa puesta, la misma línea SELLA');
  // Control negativo: SIN la causa, la misma línea sigue excluyéndose (el builder no ha cambiado).
  const { causa: _c, ...sinLaCausa } = LINEA_S2;
  const sinCausa = await buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, fakePrisma([original([sinLaCausa])]));
  assert.equal(sinCausa.excluidos.length, 1);
  assert.match(sinCausa.excluidos[0].motivo, /no se puede saber si es/);
  const deSuelta = await buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, fakePrisma([original(lineas)]));
  assert.equal(deSuelta.excluidos.length, 0, 'la línea S2 que sale de la suelta vuelve a excluirse (el defecto de 1051c)');
});

test('1051c ① · desde 1051d una S2 con tax 0.21 que entra por la suelta conserva la causa (no es un 21 % que cobra)', () => {
  const { lineas } = validarFacturaSuelta({ customerId: 5, lines: [{ ...LINEA_S2, tax: 0.21 }] });
  assert.deepEqual(lineas[0], { concept: 'Subcontrata de obra', qty: 1, price: 1000, tax: 0.21, causa: 'S2' });
});

// ── ② la R1 de una factura con línea S2 ─────────────────────────────────────────────────────

test('1051c ② · la R1 de una S2 sale R1·I, S2, base −1000.00, sin TipoImpositivo ni CuotaRepercutida, y valida contra el XSD', async () => {
  const orig = original([{ ...LINEA_S2 }]);
  const { xml, excluidos } = await buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, fakePrisma([orig, rectificativa(orig)]));
  assert.deepEqual(excluidos, []);
  const { valido, errores } = await validarRegistrosXml(xml, 'scrum1051c-r1-s2.xml');
  assert.equal(valido, true, `el XML con la R1 de una S2 no valida contra el XSD:\n${errores.join('\n')}`);

  const r1 = registroDe(xml, '2026-CF-R-001');
  assert.match(r1, /<sum1:TipoFactura>R1<\/sum1:TipoFactura>/);       // 1197: S2 admite R1
  assert.match(r1, /<sum1:TipoRectificativa>I<\/sum1:TipoRectificativa>/);
  assert.doesNotMatch(r1, /ImporteRectificacion/);                     // 1119: con I no va
  assert.match(r1, /<sum1:NumSerieFactura>2026-CF-001<\/sum1:NumSerieFactura>/); // la rectificada
  const desglose = r1.slice(r1.indexOf('<sum1:Desglose>'), r1.indexOf('</sum1:Desglose>'));
  assert.ok(desglose.length > 0, 'CIEGO: la R1 no trae Desglose');
  assert.equal((desglose.match(/<sum1:DetalleDesglose>/g) ?? []).length, 1);
  assert.match(desglose, /<sum1:ClaveRegimen>01<\/sum1:ClaveRegimen>/);
  assert.match(desglose, /<sum1:CalificacionOperacion>S2<\/sum1:CalificacionOperacion>/);
  assert.match(desglose, /<sum1:BaseImponibleOimporteNoSujeto>-1000\.00<\/sum1:BaseImponibleOimporteNoSujeto>/);
  // 1198 pide «valor 0» en los dos; HOY no se escriben (igual que en la F1 S2 de scrum1051).
  assert.doesNotMatch(desglose, /TipoImpositivo/);
  assert.doesNotMatch(desglose, /CuotaRepercutida/);
  assert.match(r1, /<sum1:CuotaTotal>0\.00<\/sum1:CuotaTotal>/);       // 1207: ninguna cuota ≠ 0
  assert.match(r1, /<sum1:ImporteTotal>-1000\.00<\/sum1:ImporteTotal>/); // 1210: base + cuota
});

test('1051c ② · control: la F1 original del mismo paquete también sale S2 sin TipoImpositivo ni CuotaRepercutida', async () => {
  const orig = original([{ ...LINEA_S2 }]);
  const { xml } = await buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, fakePrisma([orig, rectificativa(orig)]));
  const f1 = registroDe(xml, '2026-CF-001');
  assert.match(f1, /<sum1:TipoFactura>F1<\/sum1:TipoFactura>/);
  assert.match(f1, /<sum1:CalificacionOperacion>S2<\/sum1:CalificacionOperacion>/);
  const desgloseF1 = f1.slice(f1.indexOf('<sum1:Desglose>'), f1.indexOf('</sum1:Desglose>'));
  assert.match(desgloseF1, /<sum1:CalificacionOperacion>S2<\/sum1:CalificacionOperacion>/);
  assert.match(desgloseF1, /<sum1:BaseImponibleOimporteNoSujeto>1000\.00<\/sum1:BaseImponibleOimporteNoSujeto>/);
  assert.doesNotMatch(desgloseF1, /TipoImpositivo/);
  assert.doesNotMatch(desgloseF1, /CuotaRepercutida/);
});

test('1051c ② · control positivo: una línea S1 al 21 % SÍ escribe TipoImpositivo y CuotaRepercutida', async () => {
  const s1 = original([{ concept: 'Material', qty: 1, price: 1000, tax: 0.21 }]);
  const { xml, excluidos } = await buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, fakePrisma([{ ...s1, total: '1210.00' }]));
  assert.deepEqual(excluidos, []);
  const reg = registroDe(xml, '2026-CF-001');
  const desgloseS1 = reg.slice(reg.indexOf('<sum1:Desglose>'), reg.indexOf('</sum1:Desglose>'));
  assert.match(desgloseS1, /<sum1:CalificacionOperacion>S1<\/sum1:CalificacionOperacion>/);
  assert.match(desgloseS1, /TipoImpositivo/);
  assert.match(desgloseS1, /CuotaRepercutida/);
});
