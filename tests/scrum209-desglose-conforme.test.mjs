// SCRUM-209 (VeriFactu · FISCAL, sin gate: corre en `npm test`, no toca BD ni red).
//
// El XML que emite el SERVICIO valida contra los XSD oficiales de la AEAT.
//
// De dónde sale: había DOS constructores del registro. `registro.builder.ts` era conforme y
// no lo llamaba nadie; el del servicio (`verifactu.service.ts`) omitía `ClaveRegimen` y
// `CalificacionOperacion` y es el que usa la exportación ZIP. O sea que
// `validate-registros-xsd.ps1` —la única validación XSD real del repo— llevaba desde S1-C
// dando verde sobre el constructor que no se envía. El hueco no era «nadie ejecuta el .ps1»:
// era que **ejecutarlo no medía lo que se emite**.
//
// Confirmado en su día por cuatro motores (xmllint-wasm, libxml2-wasm, libxmljs2 y el
// XmlSchemaSet de .NET del propio .ps1) y, por el otro lado, por la calibración de SCRUM-201
// leyendo el catálogo de errores: códigos AEAT 1195 y 1245 (SEMAFORO_CALIBRACION.md §7.2).
//
// ESTE TEST NO PODRÍA HABER NACIDO EN VERDE. Por eso lleva su propio caso rojo permanente:
// el XML de ANTES del arreglo, commiteado como fixture. Si algún día el validador dejara de
// validar de verdad, ese caso pasaría a verde y el test lo canta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validarRegistrosXml } from './_xsd-verifactu.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

// Datos del productor ANTES de importar dist: `config` se congela al cargar el módulo.
// SCRUM-247: aqui se fijaban las cinco `process.env.VERIFACTU_*` del PRODUCTOR. Ya no hacen
// nada: son CONSTANTES del repo (`src/modules/fiscal/verifactu/productor.ts`), no configuracion.
// Se retiran en vez de dejarlas: una asignacion inerte se lee como si tuviera efecto.

const merchant = {
  id: 1, country: 'ES', taxId: 'B12345678', legalName: 'Fontanería QA S.L.', name: 'Fontanería QA',
};

// `tax` va en FRACCIÓN — es lo que lee calcVatBreakdown (vat.service.ts:26).
const mkInvoice = (over = {}) => ({
  number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z'), total: '121.00', type: 'F1',
  lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }],
  vfHash: 'A'.repeat(64), vfPrevHash: null, customer: { name: 'Cliente QA', taxId: 'A11111111' }, rectifies: null,
  ...over,
});

const fakePrisma = (invoices) => ({
  merchant: { findUnique: async () => merchant },
  invoice: { findMany: async (a) => (a?.where?.vfHash ? invoices.filter((i) => i.vfHash) : invoices) },
});

const build = async (invoices) => {
  const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');
  const { xml } = await buildVerifactuRegistrosXml({ merchantId: 1, year: 2026 }, fakePrisma(invoices));
  return xml;
};

// ── 1 · EL VERDE: lo que emite el servicio valida ─────────────────────────────────────────

test('SCRUM-209 · el XML del servicio VALIDA contra los XSD de la AEAT', async () => {
  const xml = await build([mkInvoice()]);
  const { valido, errores } = await validarRegistrosXml(xml, 'servicio.xml');
  assert.equal(
    valido,
    true,
    '🔴 El XML que exporta el producto NO valida contra el esquema oficial. Un XML que no ' +
      `valida es una declaración que la AEAT rechaza.\n\n${errores.join('\n')}`,
  );
});

test('SCRUM-209 · valida también con varios tipos de IVA y con rectificativa', async () => {
  const conDosTipos = mkInvoice({
    total: '231.00',
    lines: [
      { concept: 'Reparación', qty: 1, price: 100, tax: 0.21 },
      { concept: 'Material reducido', qty: 1, price: 100, tax: 0.10 },
    ],
  });
  const { valido, errores } = await validarRegistrosXml(await build([conDosTipos]), 'dos-tipos.xml');
  assert.equal(valido, true, `🔴 dos tramos de IVA rompen la conformidad:\n${errores.join('\n')}`);
});

test('SCRUM-209 · el desglose lleva ClaveRegimen y CalificacionOperacion, en el orden del XSD', async () => {
  const xml = await build([mkInvoice()]);
  // Los dos campos que faltaban (AEAT 1245 y 1195).
  assert.match(xml, /<sum1:ClaveRegimen>01<\/sum1:ClaveRegimen>/);
  assert.match(xml, /<sum1:CalificacionOperacion>S1<\/sum1:CalificacionOperacion>/);
  // El ORDEN es lo que rompía: el XSD declara una `sequence`.
  const i = (t) => xml.indexOf(`<sum1:${t}>`);
  assert.ok(
    i('Impuesto') < i('ClaveRegimen') && i('ClaveRegimen') < i('CalificacionOperacion')
      && i('CalificacionOperacion') < i('TipoImpositivo'),
    '🔴 el orden del desglose ya no es el del XSD (sequence): Impuesto > ClaveRegimen > ' +
      'CalificacionOperacion > TipoImpositivo',
  );
});

// ── 2 · EL ROJO PERMANENTE: el XML de ANTES sigue sin validar ─────────────────────────────
//
// Sin esto, el verde de arriba sería indistinguible de un validador que dice «sí» a todo.

test('SCRUM-209 (caso rojo) · el XML anterior al arreglo NO valida, y falla por lo que sabemos', async () => {
  const antes = fs.readFileSync(path.join(AQUI, 'fixtures', 'verifactu-pre-scrum209.xml'), 'utf8');

  // Guarda de presencia: si el fixture se vaciara o se regenerara con el código nuevo, este
  // test pasaría a comprobar otra cosa sin avisar.
  assert.ok(
    antes.includes('<sum1:DetalleDesglose>') && !antes.includes('CalificacionOperacion'),
    '🔴 el fixture del ANTES ya no es el de antes: debe llevar DetalleDesglose y NO llevar ' +
      'CalificacionOperacion. Si alguien lo regeneró con el código actual, este caso rojo ' +
      'dejó de probar nada.',
  );

  const { valido, errores } = await validarRegistrosXml(antes, 'pre-scrum209.xml');
  assert.equal(valido, false, '🔴 EL VALIDADOR NO DISTINGUE: el XML defectuoso de antes le parece válido.');
  assert.ok(
    errores.some((e) => e.includes('CalificacionOperacion')),
    `🔴 falla, pero no por el motivo que perseguimos. Errores:\n${errores.join('\n')}`,
  );
});

// ── 3 · LA REGLA FISCAL: lo que no se puede calificar se EXCLUYE y se REPORTA ──────────────
//
// Un tramo que no se sabe calificar no se declara — pero tampoco tumba el paquete entero.
// Una sola factura antigua sin líneas dejaría a un merchant sin su pack de inspección
// completo, y eso convierte un rojo puntual en una caída total. Se excluye ESA, se dice
// cuál y por qué, y el resto del ejercicio sale.

/** Igual que `build`, pero devuelve también el parte de exclusiones. */
const buildCompleto = async (invoices) => {
  const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');
  return buildVerifactuRegistrosXml({ merchantId: 1, year: 2026 }, fakePrisma(invoices));
};

test('SCRUM-209 · un tramo al 0% NO se declara: se excluye esa factura y se dice cuál', async () => {
  const cero = mkInvoice({
    number: '2026-CF-002', total: '100.00',
    lines: [{ concept: 'Algo sin tipo', qty: 1, price: 100, tax: 0 }],
  });
  const { xml, count, excluidos } = await buildCompleto([mkInvoice(), cero]);

  assert.equal(count, 1, '🔴 la buena tiene que salir igual: excluir una no puede llevarse las demás');
  assert.equal(excluidos.length, 1);
  assert.equal(excluidos[0].number, '2026-CF-002');
  assert.match(excluidos[0].motivo, /0%/);

  // La buena está; la mala no.
  assert.match(xml, /<sum1:NumSerieFactura>2026-CF-001<\/sum1:NumSerieFactura>/);
  assert.doesNotMatch(xml, /<sum1:NumSerieFactura>2026-CF-002<\/sum1:NumSerieFactura>/);

  // Y NO es una omisión silenciosa: el parte viaja dentro del propio documento.
  assert.match(xml, /ATENCION: 1 factura\(s\)/);
  assert.match(xml, /2026-CF-002/, '🔴 la excluida debe aparecer NOMBRADA en el XML entregado');
});

test('SCRUM-209 · el XML con exclusiones SIGUE validando contra el XSD', async () => {
  // El comentario del parte no puede romper el esquema: si lo rompiera, el aviso costaría
  // el paquete entero — justo lo que se quería evitar.
  const cero = mkInvoice({ number: '2026-CF-002', lines: [{ concept: 'x', qty: 1, price: 100, tax: 0 }] });
  const { xml } = await buildCompleto([mkInvoice(), cero]);
  const { valido, errores } = await validarRegistrosXml(xml, 'con-exclusiones.xml');
  assert.equal(valido, true, `🔴 el parte de exclusiones rompe la validación:\n${errores.join('\n')}`);
});

test('SCRUM-209 · una factura SIN líneas se excluye igual (antes declaraba un 0% inventado)', async () => {
  const sinLineas = mkInvoice({ number: '2026-CF-003', lines: [] });
  const { count, excluidos } = await buildCompleto([mkInvoice(), sinLineas]);
  assert.equal(count, 1);
  assert.equal(excluidos[0].number, '2026-CF-003');
  assert.match(excluidos[0].motivo, /no tiene líneas/);
});

test('SCRUM-209 · sin exclusiones NO se cuela ningún aviso en el XML', async () => {
  // Un parte que apareciera siempre enseñaría a ignorarlo.
  const { xml, excluidos } = await buildCompleto([mkInvoice()]);
  assert.deepEqual(excluidos, []);
  assert.doesNotMatch(xml, /ATENCION/);
});

test('SCRUM-209 · una cadena rota SIGUE tumbando el paquete entero, a propósito', async () => {
  // No todo fallo se excluye: si el encadenamiento no se puede acreditar, el problema no es
  // una factura suelta — es que el pack no se sostiene. Ahí sí se cae todo.
  const huerfana = mkInvoice({ number: '2026-CF-004', vfPrevHash: 'F'.repeat(64) });
  await assert.rejects(() => buildCompleto([huerfana]), /verifactu_cadena_rota/);
});

test('SCRUM-209 · una rectificativa (importes en negativo) SÍ se clasifica y valida', async () => {
  // El signo no afecta a la calificación: sigue siendo régimen general sujeta no exenta.
  const r1 = mkInvoice({
    number: '2026-CF-R-001', type: 'R1', total: '-121.00',
    lines: [{ concept: 'Reparación (rectificada)', qty: 1, price: -100, tax: 0.21 }],
    rectifies: { number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z') },
  });
  const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');
  const { xml } = await buildVerifactuRegistrosXml(
    { merchantId: 1, year: 2026 }, fakePrisma([r1]), { modoTipoRectificativa: 'INCREMENTAL_I' },
  );
  const { valido, errores } = await validarRegistrosXml(xml, 'rectificativa.xml');
  assert.equal(valido, true, `🔴 la rectificativa no valida:\n${errores.join('\n')}`);
});
