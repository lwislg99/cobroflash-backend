// tests/scrum665e-el-escritor-del-emisor.test.mjs — SCRUM-665 (E)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL SEXTO PUNTO DE CONEXIÓN: EL XML DE LA AEAT NO CAMBIA CUANDO CAMBIA EL EMISOR.
//
// `tests/scrum665a-congelar-el-emisor.test.mjs` ya prueba el escritor y el lector contra el PDF.
// Lo que faltaba —hallazgo del GO de Javier, comentario 16468 de Jira SCRUM-665, 22-sep-2026— es
// `buildVerifactuRegistrosXml`: hasta hoy `NombreRazonEmisor` e `IDEmisorFactura` salían del
// merchant EN VIVO para TODAS las facturas del ejercicio a la vez, exactamente el defecto que
// `scrum729-el-escritor-del-cliente.test.mjs` ya cerró para el CLIENTE. Mismo patrón, mismo fichero
// de prueba como plantilla, aquí para el EMISOR.
//
// `merchant.taxId` está entre los 8 campos de `computeVeriFactuHash` (auto-defendido: la huella
// deja de cuadrar si drifta); `NombreRazonEmisor` NO, y podía derivar en silencio. Por eso el
// control ④ (el que decide) mira el NOMBRE, y el ④-bis prueba que el mecanismo realmente discrimina.
//
// `buildVerifactuRegistrosXml` es la fuente ÚNICA de las dos rutas (`GET /verifactu.xml` y el ZIP
// de `GET /datos.zip`, `exports.routes.ts`, comentario SCRUM-82 «misma fuente, sin divergencia
// posible»): probar el constructor prueba las dos rutas a la vez, sin duplicar el doble.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs'; // SCRUM-262: rango imposible

const { congelarEmisor } = await import('../dist/modules/invoicing/domain/emisorCongelado.js');
const { congelarDesdeFicha } = await import('../dist/modules/invoicing/domain/clienteCongelado.js');
const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');

// ── el mundo de la prueba ──────────────────────────────────────────────────────────────────────

/** El perfil del merchant EL DÍA DE LA EMISIÓN. */
const FICHA_DE_ENTONCES = {
  name: 'Fontanería QA', legalName: 'Fontanería QA S.L.', taxId: 'B12345678',
  address: 'Calle Mayor 1, 28001 Madrid', logoUrl: null,
  phone: telefonoDePrueba(3), email: 'pro@ejemplo.test',
};

/** La MISMA ficha después de que el profesional corrija nombre, NIF y dirección. Nadie tocó
 *  ninguna factura. */
const FICHA_DE_HOY = {
  name: 'Suministros del Norte', legalName: 'Suministros del Norte SLU', taxId: 'B87654321',
  address: 'Polígono Industrial Sur, nave 7, 28914 Leganés', logoUrl: null,
  phone: telefonoDePrueba(3), email: 'pro@ejemplo.test',
};

/** Merchant EN VIVO, con la ficha que se le pase — es lo que devuelve `merchant.findUnique`. */
const merchantVivo = (ficha) => ({
  id: 42, country: 'ES', taxId: ficha.taxId, name: ficha.name, legalName: ficha.legalName,
  address: ficha.address, logoUrl: ficha.logoUrl, whatsappPhone: ficha.phone, email: ficha.email,
});

const CLIENTE = { name: 'Ferretería Pepe', legalName: 'Ferretería Pepe SL', taxId: 'B99999999', email: null, phone: null };
const LINEAS = [{ concept: 'Reparación de fuga', qty: 1, price: 100, tax: 0.21 }];

/**
 * Una factura ya emitida. `congelado: false` la deja como estaban TODAS las facturas antes de
 * este enchufe: las siete columnas del emisor a NULL.
 */
const factura = ({ congelado = true, ficha = FICHA_DE_ENTONCES, id = 1, number = 'F260001' } = {}) => ({
  id,
  merchantId: 42,
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
  vfAnulHash: null,
  vfAnulTimestamp: null,
  vfAnulPrevHash: null,
  pdfUrl: 'PENDING_PDF',
  qrData: 'PENDING_QR',
  rectifies: null,
  ...congelarDesdeFicha(CLIENTE),
  ...(congelado ? congelarEmisor(ficha) : {}),
});

/** El doble para el XML de la AEAT. Mismo patrón que `scrum729-el-escritor-del-cliente`: una sola
 *  `findMany` sirve a las dos consultas (la de las facturas del ejercicio y la del historial de
 *  huellas), porque el fixture ya trae los campos que ambas necesitan. */
const prismaParaXml = (invoices, fichaVivaMerchant) => ({
  merchant: { findUnique: async () => merchantVivo(fichaVivaMerchant) },
  invoice: { findMany: async () => invoices },
});

const xmlDe = async (invoices, fichaVivaMerchant) =>
  buildVerifactuRegistrosXml({ merchantId: 42, year: 2026 }, prismaParaXml(invoices, fichaVivaMerchant));

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE DECIDE — el registro de la AEAT
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-665E · 🔴 ④ EL QUE DECIDE: el XML de la AEAT NO cambia al corregir el perfil del emisor', async () => {
  const inv = factura();

  const antes = await xmlDe([inv], FICHA_DE_ENTONCES);
  const despues = await xmlDe([inv], FICHA_DE_HOY);

  // SUELO: si la factura no entrara en el registro, comparar los dos XML no diría nada.
  assert.equal(antes.count, 1,
    `🔴 CENSO CIEGO: la factura no ha entrado en el registro. Excluidos: ${JSON.stringify(antes.excluidos)}`);

  // Se compara SOLO el `RegistroFactura` (lo que identifica a ESTA factura), no el documento
  // entero: el `<sum:Cabecera>` con el `ObligadoEmision` es el SOBRE del lote, y ÉSE sí sigue al
  // emisor EN VIVO a propósito (identifica quién presenta el lote HOY) — lo prueba el test de más
  // abajo. Mezclar las dos cosas en una sola comparación haría que este control nunca pudiera
  // pasar ni aunque el arreglo fuera perfecto.
  const registroDe = (xml) => xml.slice(xml.indexOf('</sum:Cabecera>'));

  assert.equal(registroDe(despues.xml), registroDe(antes.xml),
    '🔴 EL REGISTRO DE LA AEAT CAMBIA AL CORREGIR EL PERFIL DEL EMISOR. Es el sexto punto de '
    + 'conexión del hallazgo de Javier: una factura ya sellada declara un emisor distinto del que '
    + 'la emitió, y nadie tocó esa factura.');

  // 🔴 Estos CUATRO se miran SOLO en el `RegistroFactura`, no en el XML entero: el sobre lleva su
  // PROPIO `<sum1:NIF>`/`<sum1:NombreRazon>` con el emisor EN VIVO (a propósito, ver arriba), así
  // que buscar en `despues.xml` completo encontraría el NIF de hoy ahí y daría un falso positivo.
  assert.ok(registroDe(antes.xml).includes(FICHA_DE_ENTONCES.taxId),
    `🔴 el registro no lleva el NIF congelado ${FICHA_DE_ENTONCES.taxId}: se está comparando otra cosa`);
  assert.ok(!registroDe(despues.xml).includes(FICHA_DE_HOY.taxId),
    `🔴 el NIF de HOY (${FICHA_DE_HOY.taxId}) se ha colado en el registro de una factura de marzo`);
  assert.ok(registroDe(antes.xml).includes(FICHA_DE_ENTONCES.name),
    '🔴 el NOMBRE del emisor de entonces no aparece: es justo el campo que no está en la huella '
    + 'y por eso puede derivar en silencio — el hallazgo concreto de Javier.');
  assert.ok(!registroDe(despues.xml).includes(FICHA_DE_HOY.name),
    `🔴 el nombre de HOY (${FICHA_DE_HOY.name}) ha aparecido en una factura de marzo`);
});

test('SCRUM-665E · 🔴 ④-bis: y CAE con el mecanismo viejo (columnas del emisor a NULL = leer en vivo)', async () => {
  // El mismo par de llamadas sobre una factura ANTERIOR al escritor. Si esto no cambiara, el
  // control de arriba estaría verde por casualidad y no por el arreglo.
  const vieja = factura({ congelado: false });

  const antes = await xmlDe([vieja], FICHA_DE_ENTONCES);
  const despues = await xmlDe([vieja], FICHA_DE_HOY);

  assert.notEqual(despues.xml, antes.xml,
    '🔴 el control ④ no discrimina: sin columnas congeladas del emisor el XML TIENE que cambiar, '
    + 'porque ése es exactamente el defecto. Si aquí sale igual, el instrumento no está midiendo '
    + 'el emisor.');
  assert.ok(despues.xml.includes(FICHA_DE_HOY.name),
    '🔴 la rama viva no ha traído el nombre nuevo: el estímulo no llegó');
});

test('SCRUM-665E · ✅ CONTROL POSITIVO: una factura ANTERIOR (sin emisor congelado) sigue saliendo', async () => {
  const vieja = factura({ congelado: false, id: 2, number: 'F260002' });

  const r = await xmlDe([vieja], FICHA_DE_HOY);

  assert.equal(r.count, 1, '🔴 el registro de una factura antigua ha dejado de generarse');
  assert.ok(r.xml.includes(FICHA_DE_HOY.taxId),
    '🔴 sin columnas congeladas el documento tiene que caer al perfil vivo: es lo mejor que consta, '
    + 'y romper el registro de las facturas que ya existen no es una opción.');
});

test('SCRUM-665E · el ENVOLTORIO (`obligado` del sobre) sigue siendo el emisor EN VIVO, no el congelado', async () => {
  // El `obligado` del sobre `SuministroLote` identifica quién PRESENTA el lote HOY, no quién
  // emitió cada factura — es un concepto distinto del `NombreRazonEmisor` por registro, y aquí
  // SÍ tiene que leer el perfil vivo aunque las facturas del lote estén congeladas.
  const inv = factura(); // congelada con FICHA_DE_ENTONCES

  const r = await xmlDe([inv], FICHA_DE_HOY);

  assert.ok(r.xml.includes('<sum1:NombreRazon>Suministros del Norte SLU</sum1:NombreRazon>'),
    '🔴 el sobre no lleva el nombre del emisor EN VIVO — el submitter del lote tiene que ser quien '
    + 'presenta HOY, no una foto congelada de una factura del lote.');
});
