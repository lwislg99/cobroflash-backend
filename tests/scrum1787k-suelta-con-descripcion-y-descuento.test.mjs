// tests/scrum1787k-suelta-con-descripcion-y-descuento.test.mjs — SCRUM-1787k
//
// GO del fundador (regla 40): SCRUM-1787 c.22338 ①. Medición: c.22339.
//
// La factura SUELTA acepta por línea `description` y `dto` (el descuento del presupuesto: un
// porcentaje), con los validadores del presupuesto, y sus líneas salen por `lineasParaFacturar`,
// la MISMA función del camino desde presupuesto (SCRUM-887): precio neto, `dto` aplicado y no
// guardado, `description` congelada.
//
// ① dos líneas, una con 10 % y descripción → netos, desglose y total
// ② lo mismo que el camino desde presupuesto: líneas, desglose y XML del registro
// ③ control: sin descuento ni descripción, líneas y XML idénticos a los de hoy
// ④ las reglas del presupuesto: fuera de 0-100, más de 2 decimales, o un no-texto → 400
// ⑤ la ruta emite lo que sale de la validación, sin una segunda lista de líneas
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    nombre: 'el descuento no se aplica',
    fichero: 'src/modules/invoicing/domain/facturaSuelta.ts',
    de: 'lineasParaFacturar({ lines: lineas, discountGlobalAmount: null })',
    a: 'lineas',
    cae: 'SCRUM-1787k ① una suelta con 10 % en una línea',
  },
  {
    nombre: 'la descripción no viaja',
    fichero: 'src/modules/invoicing/domain/facturaSuelta.ts',
    de: 'if (descripcion?.success) linea.description = descripcion.data;',
    a: '',
    cae: 'SCRUM-1787k ① una suelta con 10 % en una línea',
  },
];

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const { validarFacturaSuelta, ERROR_LINEAS_INVALIDAS } = await import('../dist/modules/invoicing/domain/facturaSuelta.js');
const { lineasParaFacturar } = await import('../dist/modules/invoicing/domain/invoiceLines.service.js');
const { calcVatBreakdown } = await import('../dist/modules/invoicing/domain/vat.service.js');
const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');

const CON_DTO = Object.freeze({ concept: 'Mano de obra', qty: 2, price: 100, tax: 0.21, dto: 10, description: 'Dos oficiales, una jornada' });
const SIN_DTO = Object.freeze({ concept: 'Material', qty: 1, price: 50, tax: 0.1 });

const validar = (lines) => {
  const v = validarFacturaSuelta({ customerId: 5, lines });
  assert.equal(v.ok, true, `CIEGO: la validación no aceptó el cuerpo: ${JSON.stringify(v)}`);
  return v.lineas;
};
const dePresupuesto = (lines) => lineasParaFacturar({ lines: lines.map((l) => ({ ...l })), discountGlobalAmount: null });

const merchant = { id: 1, country: 'ES', taxId: 'B12345678', legalName: 'Instalaciones QA S.L.', name: 'Instalaciones QA' };
const fakePrisma = (invs) => ({
  merchant: { findUnique: async () => merchant },
  invoice: { findMany: async (a) => (a?.where?.vfHash ? invs.filter((i) => i.vfHash) : invs) },
});
const xmlDe = async (lines) => {
  const bd = calcVatBreakdown(lines);
  const inv = {
    number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z'), total: (bd.base + bd.cuota).toFixed(2), type: 'F1', lines,
    vfHash: 'A'.repeat(64), vfPrevHash: null, customer: { name: 'Cliente QA', taxId: 'A11111111' }, rectifies: null,
  };
  const { excluidos, xml } = await buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, fakePrisma([inv]));
  assert.deepEqual(excluidos, [], 'CIEGO: la factura de prueba no entra en el XML');
  assert.ok(xml.length > 500, 'CIEGO: el XML salió vacío');
  return xml;
};

test('SCRUM-1787k ① una suelta con 10 % en una línea y descripción: netos, desglose y total', () => {
  const lineas = validar([{ ...CON_DTO }, { ...SIN_DTO }]);
  assert.deepEqual(lineas, [
    { concept: 'Mano de obra', qty: 2, price: 90, tax: 0.21, description: 'Dos oficiales, una jornada' },
    { concept: 'Material', qty: 1, price: 50, tax: 0.1 },
  ]);
  assert.equal('dto' in lineas[0], false, 'el descuento va aplicado al precio: la clave no se guarda');
  const bd = calcVatBreakdown(lineas);
  assert.equal(bd.base, 230);
  assert.equal(bd.cuota, 42.8);
  assert.equal((bd.base + bd.cuota).toFixed(2), '272.80');
  // Control: sin el descuento el total sería otro (el caso mide algo).
  const sinDescuento = calcVatBreakdown(validar([{ ...CON_DTO, dto: undefined }, { ...SIN_DTO }]));
  assert.equal((sinDescuento.base + sinDescuento.cuota).toFixed(2), '297.00');
});

test('SCRUM-1787k ② la suelta da lo MISMO que el camino desde presupuesto: líneas, desglose y XML', async () => {
  const entradas = [
    [{ ...CON_DTO }, { ...SIN_DTO }],
    [{ concept: 'Tornillería', qty: 3, price: 3.33, tax: 0.21, dto: 33.33 }, { concept: 'Visita', qty: 1, price: 40, tax: 0.21, dto: 0 }],
  ];
  for (const entrada of entradas) {
    const suelta = validar(entrada.map((l) => ({ ...l })));
    const presupuesto = dePresupuesto(entrada);
    assert.deepEqual(suelta, presupuesto);
    assert.deepEqual(calcVatBreakdown(suelta), calcVatBreakdown(presupuesto));
    assert.equal(await xmlDe(suelta), await xmlDe(presupuesto));
  }
  // Control: las entradas llevan descuento de verdad (el primer precio cambia).
  assert.notEqual(validar(entradas[1].map((l) => ({ ...l })))[0].price, 3.33);
});

test('SCRUM-1787k ③ control: sin descuento ni descripción, líneas y XML idénticos a los de hoy', async () => {
  const hoy = [{ concept: 'Material', qty: 2, price: 50, tax: 0.21 }, { concept: 'Subcontrata', qty: 1, price: 1000, tax: 0, causa: 'S2' }];
  const lineas = validar(hoy.map((l) => ({ ...l })));
  assert.deepEqual(lineas, hoy);
  for (const l of lineas) {
    assert.equal('dto' in l, false);
    assert.equal('description' in l, false);
  }
  assert.equal(await xmlDe(lineas), await xmlDe(hoy));
  // `null` es «no lleva», como la causa: la clave no viaja.
  const conNulos = validar([{ concept: 'Material', qty: 2, price: 50, tax: 0.21, dto: null, description: null }]);
  assert.deepEqual(conNulos, [{ concept: 'Material', qty: 2, price: 50, tax: 0.21 }]);
});

test('SCRUM-1787k ④ las reglas del presupuesto: descuento fuera de 0-100, con más de 2 decimales o no numérico, y descripción que no es texto', () => {
  const base = { concept: 'Material', qty: 1, price: 50, tax: 0.21 };
  for (const malo of [{ dto: 150 }, { dto: -1 }, { dto: 33.333 }, { dto: '10' }, { description: 7 }]) {
    const v = validarFacturaSuelta({ customerId: 5, lines: [{ ...base, ...malo }] });
    assert.equal(v.ok, false, `se aceptó ${JSON.stringify(malo)}`);
    assert.equal(v.error, ERROR_LINEAS_INVALIDAS);
    // Ningún texto nuevo ni el inglés del validador: sale el mensaje ya servido de su campo.
    assert.equal(v.message, 'description' in malo ? 'Cada línea necesita un concepto.' : 'Cada línea necesita un precio válido.');
  }
  // Control: los bordes válidos pasan.
  for (const bueno of [{ dto: 0 }, { dto: 100 }, { dto: 33.33 }, { description: 'Texto' }]) {
    assert.equal(validarFacturaSuelta({ customerId: 5, lines: [{ ...base, ...bueno }] }).ok, true, JSON.stringify(bueno));
  }
  // Un 100 % deja el precio a cero: lo para el portón de siempre de la ruta, no esto.
  assert.equal(validar([{ ...base, dto: 100 }])[0].price, 0);
});

test('SCRUM-1787k ⑤ la ruta emite lo que sale de la validación: una sola lista de líneas', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/system/app/routes/invoicesAdmin.routes.ts'), 'utf8');
  assert.equal(fuente.split('validarFacturaSuelta(req.body)').length - 1, 1, 'CIEGO: la ruta ya no valida así');
  assert.match(fuente, /calcVatBreakdown\(val\.lineas\)/);
  assert.match(fuente, /lines: val\.lineas,\s*\n\s*quoteId: null/);
});
