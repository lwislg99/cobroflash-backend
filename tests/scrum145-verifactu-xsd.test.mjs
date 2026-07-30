// SCRUM-145 (VeriFactu, payload conforme) — el XML de registros valida contra la ESTRUCTURA
// que exigen los XSD oficiales de la AEAT (`src/modules/fiscal/verifactu/xsd/`).
//
// ⚠️ ALCANCE HONESTO DE ESTE TEST: comprueba **presencia de los elementos OBLIGATORIOS** (los
// que el XSD declara sin `minOccurs="0"`) y la forma del envelope. NO es una validación XSD
// completa: no verifica tipos, longitudes, patrones ni cardinalidades. Hacerlo de verdad exige
// una dependencia nativa (libxmljs) o `xmllint`, y ninguna está disponible aquí — se dice en
// voz alta en vez de fingir cobertura (criterio SCRUM-121). La validación real contra el
// esquema la dará el entorno de pruebas de la AEAT en S1-D.
//
// Lo que SÍ aporta: los nombres esperados se EXTRAEN DEL XSD en tiempo de test, no se copian a
// mano. Si la AEAT publica un esquema con un campo obligatorio nuevo, este test se entera solo.
//
// Sin gate: no toca BD (inyecta un prismaClient falso) ni red → corre en `npm test` normal.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const XSD = path.join(DIR, '..', 'src', 'modules', 'fiscal', 'verifactu', 'xsd', 'SuministroInformacion.xsd');

// Datos del productor ANTES de importar dist: `config` se congela al cargar el módulo.
process.env.VERIFACTU_PRODUCTOR_NOMBRE = 'QA Productor';
process.env.VERIFACTU_PRODUCTOR_NIF = '89890001K';
process.env.VERIFACTU_ID_SISTEMA = '01';
process.env.VERIFACTU_VERSION = '1.0.0';
process.env.VERIFACTU_NUM_INSTALACION = '1';

/**
 * Extrae del XSD los hijos OBLIGATORIOS de un complexType.
 *
 * Los bloques `<choice>` se RETIRAN antes de extraer: sus elementos son ALTERNATIVAS
 * (NIF | IDOtro), no requisitos acumulativos — tratarlos como obligatorios exigiría emitir
 * ambos, que es justo lo que el esquema prohíbe. Se devuelven aparte para poder afirmar que
 * hay al menos una de cada choice.
 */
function obligatoriosDe(xsd, typeName) {
  const start = xsd.indexOf(`complexType name="${typeName}"`);
  assert.ok(start > -1, `el XSD ya no declara ${typeName} — ¿cambió el esquema?`);
  const end = xsd.indexOf('</complexType>', start);
  const bloque = xsd.slice(start, end);

  const choices = [...bloque.matchAll(/<choice>([\s\S]*?)<\/choice>/g)].map((m) =>
    [...m[1].matchAll(/<element name="([A-Za-z0-9]+)"/g)].map((e) => e[1]),
  );
  const sinChoices = bloque.replace(/<choice>[\s\S]*?<\/choice>/g, '');
  const requeridos = [...sinChoices.matchAll(/<element name="([A-Za-z0-9]+)"([^>]*)>?/g)]
    .filter((m) => !/minOccurs="0"/.test(m[2]))
    .map((m) => m[1]);
  return { requeridos, choices };
}

const merchant = {
  id: 1, country: 'ES', taxId: 'B12345678', legalName: 'Fontanería QA S.L.', name: 'Fontanería QA',
};
const mkInvoice = (over = {}) => ({
  number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z'), total: '121.00', type: 'F1',
  // SCRUM-209: `tax` en FRACCIÓN, que es lo que lee calcVatBreakdown (vat.service.ts:26).
  // Antes decía `vat: 21` — un campo que nadie lee: el desglose salía al 0 % y este test
  // comprobaba la conformidad de un XML que el producto no genera nunca.
  lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }],
  vfHash: 'A'.repeat(64), vfPrevHash: null, customer: { name: 'Cliente QA', taxId: 'A11111111' }, rectifies: null,
  ...over,
});

/** prisma falso: distingue la consulta de facturas del año de la de huellas (where.vfHash). */
const fakePrisma = (invoices) => ({
  merchant: { findUnique: async () => merchant },
  invoice: {
    findMany: async (args) => (args?.where?.vfHash ? invoices.filter((i) => i.vfHash) : invoices),
  },
});

const build = async (invoices) => {
  const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');
  const { xml } = await buildVerifactuRegistrosXml({ merchantId: 1, year: 2026 }, fakePrisma(invoices));
  return xml;
};

test('SCRUM-145: el envelope es el del XSD (raíz, namespaces y nombre de elemento correctos)', async () => {
  const xml = await build([mkInvoice()]);
  assert.match(xml, /<sum:RegFactuSistemaFacturacion\b/, 'la raíz debe ser RegFactuSistemaFacturacion');
  assert.match(xml, /xmlns:sum="[^"]*SuministroLR\.xsd"/, 'falta el namespace de SuministroLR');
  assert.match(xml, /xmlns:sum1="[^"]*SuministroInformacion\.xsd"/, 'falta el namespace de SuministroInformacion');
  assert.match(xml, /<sum:Cabecera>/);
  assert.match(xml, /<sum:RegistroFactura>/, 'cada registro va envuelto en RegistroFactura');
  assert.match(xml, /<sum1:RegistroAlta>/, 'el ELEMENTO es RegistroAlta (RegistroFacturacionAlta es el TIPO)');
  assert.ok(!/<RegistrosFacturacion/.test(xml), 'la raíz inventada anterior no debe volver');
});

test('SCRUM-145: están TODOS los elementos obligatorios que declara el XSD (leídos del esquema)', async () => {
  const xsd = fs.readFileSync(XSD, 'utf8');
  const xml = await build([mkInvoice()]);

  // Del RegistroAlta se excluyen los que dependen del caso (rectificativas) o del bloque
  // opcional Destinatarios; el resto tiene que estar SIEMPRE.
  const opcionalesPorCaso = new Set(['IDFacturaRectificada', 'IDFacturaSustituida', 'IDDestinatario']);
  const alta = obligatoriosDe(xsd, 'RegistroFacturacionAltaType');
  const sistema = obligatoriosDe(xsd, 'SistemaInformaticoType');
  const requeridos = [...alta.requeridos, ...sistema.requeridos].filter((n) => !opcionalesPorCaso.has(n));

  assert.ok(requeridos.length >= 10, `el extractor del XSD devolvió muy poco (${requeridos.length}) — ¿se rompió?`);
  const faltan = requeridos.filter((n) => !xml.includes(`<sum1:${n}>`));
  assert.deepEqual(faltan, [], `faltan elementos OBLIGATORIOS del XSD en el XML: ${faltan.join(', ')}`);

  // De cada `choice` (p. ej. NIF | IDOtro del productor) tiene que salir EXACTAMENTE una rama.
  for (const alternativas of [...alta.choices, ...sistema.choices]) {
    const presentes = alternativas.filter((n) => xml.includes(`<sum1:${n}>`));
    assert.equal(
      presentes.length, 1,
      `de la alternativa (${alternativas.join(' | ')}) debe emitirse UNA y solo una; hay ${presentes.length}`,
    );
  }
});

test('SCRUM-145: Encadenamiento — RegistroAnterior identifica la factura anterior COMPLETA', async () => {
  const prev = mkInvoice({ number: '2026-CF-001', vfHash: 'B'.repeat(64) });
  const cur = mkInvoice({ number: '2026-CF-002', vfHash: 'C'.repeat(64), vfPrevHash: 'B'.repeat(64) });
  const xml = await build([prev, cur]);

  assert.match(xml, /<sum1:PrimerRegistro>S<\/sum1:PrimerRegistro>/, 'la primera factura abre cadena');
  const bloque = xml.slice(xml.indexOf('<sum1:RegistroAnterior>'), xml.indexOf('</sum1:RegistroAnterior>'));
  for (const campo of ['IDEmisorFactura', 'NumSerieFactura', 'FechaExpedicionFactura', 'Huella']) {
    assert.ok(bloque.includes(`<sum1:${campo}>`), `RegistroAnterior sin ${campo} (antes solo llevaba Huella)`);
  }
  assert.ok(bloque.includes('2026-CF-001'), 'debe identificar la factura anterior REAL, no solo su huella');
});

// SCRUM-215 · LA PREMISA DE ESTE TEST CAMBIÓ, y conviene entender por qué.
//
// Antes afirmaba que «sin NIF el bloque se omite, no se emite inválido». La primera mitad
// seguía siendo cierta y la segunda era el error: omitirlo es válido contra el XSD y
// RECHAZADO por la AEAT (1189). O sea que este test daba por bueno el defecto — con toda la
// razón del mundo desde el XSD, que es exactamente lo que lo hacía invisible.
//
// Hoy, sin NIF la factura no se declara: se EXCLUYE del registro y se reporta, hasta que el
// dictamen P11 diga cuál de las dos salidas del esquema procede. Ese caso vive ahora en
// `tests/scrum215-sin-destinatario.test.mjs`. Aquí queda lo que este test sí prueba bien: que
// CON NIF el bloque sale completo, con el choice obligatorio del XSD.
test('SCRUM-145: con NIF, Destinatarios lleva NombreRazon + NIF (choice obligatorio del XSD)', async () => {
  const conNif = await build([mkInvoice({ customer: { name: 'Cliente SA', taxId: 'A11111111' } })]);
  const bloque = conNif.slice(conNif.indexOf('<sum1:Destinatarios>'), conNif.indexOf('</sum1:Destinatarios>'));
  assert.ok(bloque.includes('<sum1:NombreRazon>'), 'con NIF debe ir NombreRazon');
  assert.ok(bloque.includes('<sum1:NIF>A11111111</sum1:NIF>'), 'con NIF debe ir el NIF (choice obligatorio del XSD)');
});

test('SCRUM-145: FAIL-CLOSED — sin datos del productor NO se emite un registro con relleno', () => {
  // En PROCESO HIJO a propósito: `config` se congela al cargar el módulo y un import "fresco"
  // con query string NO lo reevalúa (el módulo de config sigue cacheado bajo el mismo
  // especificador). Un intento anterior de probarlo en el mismo proceso pasaba en VERDE sin
  // ejercer la rama — justo el falso verde que no se acepta. Con un proceso limpio y la var
  // vacía, la rama se ejerce de verdad.
  const hijo = `
    const { buildVerifactuRegistrosXml } = await import('./dist/modules/invoicing/domain/verifactu.service.js');
    const fake = { merchant: { findUnique: async () => ({ id:1, country:'ES', taxId:'B12345678', name:'QA' }) },
                   invoice: { findMany: async () => [] } };
    try { await buildVerifactuRegistrosXml({ merchantId:1, year:2026 }, fake); console.log('NO-LANZO'); }
    catch (e) { console.log(e.message); }
  `;
  const env = { ...process.env, VERIFACTU_PRODUCTOR_NIF: '', VERIFACTU_PRODUCTOR_NOMBRE: '' };
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', hijo], {
    cwd: path.join(DIR, '..'), env, encoding: 'utf8',
  }).trim();

  assert.match(out, /verifactu_productor_no_configurado/,
    `sin datos del productor debe LANZAR, no emitir un SistemaInformatico con placeholders (salida: ${out})`);
});

test('SCRUM-145: FechaHoraHusoGenRegistro emite el sello REAL de la huella (vfTimestamp), no createdAt', async () => {
  const sello = new Date('2026-03-15T18:45:12Z');
  const xml = await build([mkInvoice({ vfTimestamp: sello, createdAt: new Date('2026-03-01T09:00:00Z') })]);
  const emitido = (xml.match(/<sum1:FechaHoraHusoGenRegistro>([^<]+)</) || [])[1];
  assert.ok(emitido, 'debe emitirse el sello');
  // El valor debe derivar de vfTimestamp (18:45:12), no de la fecha de la factura (09:00).
  assert.match(emitido, /T\d{2}:45:12/, `el sello debe venir de vfTimestamp y fue ${emitido}`);
});

test('SCRUM-145: una factura anulada emite su RegistroAnulacion DETRAS del alta, sin perder el alta', async () => {
  const alta = mkInvoice({ number: '2026-CF-001', vfHash: 'D'.repeat(64), vfTimestamp: new Date('2026-03-15T10:00:00Z') });
  const anulada = mkInvoice({
    number: '2026-CF-002', vfHash: 'E'.repeat(64), vfPrevHash: 'D'.repeat(64),
    vfTimestamp: new Date('2026-03-16T10:00:00Z'),
    vfAnulHash: 'F'.repeat(64), vfAnulTimestamp: new Date('2026-03-17T10:00:00Z'),
    vfAnulPrevHash: 'E'.repeat(64), // SCRUM-145d: el eslabon va PERSISTIDO, ya no se infiere por sello
  });
  const xml = await build([alta, anulada]);

  assert.match(xml, /<sum1:RegistroAnulacion>/, 'debe emitirse el registro de anulacion');
  assert.equal((xml.match(/<sum1:RegistroAlta>/g) || []).length, 2, 'las DOS altas siguen (regla 29: no se retira)');
  for (const campo of ['IDEmisorFacturaAnulada', 'NumSerieFacturaAnulada', 'FechaExpedicionFacturaAnulada']) {
    assert.ok(xml.includes(`<sum1:${campo}>`), `la anulacion debe identificar la factura anulada (${campo})`);
  }
  // Encadena con el registro inmediatamente anterior por sello: el alta de 2026-CF-002.
  const bloque = xml.slice(xml.indexOf('<sum1:RegistroAnulacion>'));
  assert.ok(bloque.includes('<sum1:RegistroAnterior>'), 'la anulacion encadena, no abre cadena');
  assert.ok(bloque.includes('E'.repeat(64)), 'debe encadenar con la huella del registro anterior por sello');
});

test('SCRUM-145d: la anulacion encadena por la huella PERSISTIDA, no por el orden temporal', async () => {
  // Sellos INVERTIDOS a proposito: la anulacion lleva un sello ANTERIOR al del alta con la que
  // encadena. Con la resolucion por sello esto daba el eslabon equivocado (o ninguno); con la
  // huella persistida da el correcto, que es justo lo que se hasheo.
  const a1 = mkInvoice({ number: '2026-CF-010', vfHash: '1'.repeat(64), vfTimestamp: new Date('2026-05-02T10:00:00Z') });
  const anul = mkInvoice({
    number: '2026-CF-011', vfHash: '2'.repeat(64), vfPrevHash: '1'.repeat(64),
    vfTimestamp: new Date('2026-05-03T10:00:00Z'),
    vfAnulHash: '3'.repeat(64), vfAnulTimestamp: new Date('2026-05-01T10:00:00Z'), // sello ANTERIOR
    vfAnulPrevHash: '2'.repeat(64), // pero encadena con su propia alta
  });
  const xml = await build([a1, anul]);
  const bloque = xml.slice(xml.indexOf('<sum1:RegistroAnulacion>'));
  assert.ok(bloque.includes('2'.repeat(64)), 'debe encadenar con la huella GUARDADA, no con la que sugiere el sello');
  assert.ok(bloque.includes('2026-CF-011'), 'y debe identificar el registro correcto');
});

test('SCRUM-145d: una anulacion sin eslabon guardado abre cadena (PrimerRegistro), sin inventar', async () => {
  const solo = mkInvoice({
    number: '2026-CF-020', vfHash: '9'.repeat(64), vfTimestamp: new Date('2026-06-01T10:00:00Z'),
    vfAnulHash: '8'.repeat(64), vfAnulTimestamp: new Date('2026-06-02T10:00:00Z'), vfAnulPrevHash: null,
  });
  const xml = await build([solo]);
  const bloque = xml.slice(xml.indexOf('<sum1:RegistroAnulacion>'));
  assert.ok(bloque.includes('<sum1:PrimerRegistro>S</sum1:PrimerRegistro>'), 'sin eslabon guardado = primer registro');
  assert.ok(!bloque.includes('<sum1:RegistroAnterior>'), 'y NO se inventa un anterior');
});
