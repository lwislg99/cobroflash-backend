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
  lines: [{ concept: 'Reparación', qty: 1, price: 100, vat: 21 }],
  vfHash: 'A'.repeat(64), vfPrevHash: null, customer: { name: 'Cliente QA', taxId: null }, rectifies: null,
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

test('SCRUM-145: Destinatarios solo si hay NIF (sin NIF el bloque se omite, no se emite inválido)', async () => {
  const sinNif = await build([mkInvoice()]);
  assert.ok(!sinNif.includes('<sum1:Destinatarios>'), 'sin NIF NO se emite Destinatarios (era XML inválido)');

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
