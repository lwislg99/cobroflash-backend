// SCRUM-524g · EL NÚMERO DE INSTALACIÓN ES DEL COMERCIO, Y `IndicadorMultiplesOT` SE CALCULA.
//
// Aplica la variante B del diseño 524f (`docs/master/SCRUM-524.md`, tramo 524f), con el GO del
// fundador (SCRUM-524, el comentario siguiente a c.20294). Lo que dice la AEAT (524e): cada
// facturación de un SIF SaaS lleva un `NumeroInstalacion` propio que no se repite nunca, e
// `IndicadorMultiplesOT` se calcula por usuario del SaaS (`N` con una sola facturación).
//
// Estos casos son los de `docs/master/evidencias/scrum524f/rojo-antes-del-go.mjs`, que sobre main
// sin el diff daban 10 · 3 pasan · 7 caen, pasados a `node:test` y a la variante B: el número sale
// del `id` del comercio y no puede faltar, así que el caso «[A] sin número no se emite» no aplica.
// Sólo LEEN el camino de emisión: importan `dist/` y lo ejecutan contra una base falsa (el patrón
// de `tests/scrum844c-el-xml-que-se-remite.test.mjs`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildVerifactuRegistrosXml, registroParaRemision } from '../dist/modules/invoicing/domain/verifactu.service.js';
import * as productorMod from '../dist/modules/fiscal/verifactu/productor.js';
import {
  numeroInstalacion, indicadorMultiplesOT, FACTURACIONES_POR_CUENTA,
} from '../dist/modules/fiscal/verifactu/instalacion.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── El banco ───────────────────────────────────────────────────────────────────────────────────
const mkMerchant = (over = {}) => ({
  id: 7, country: 'ES', taxId: 'B12345678',
  legalName: 'Reformas Integrales del Norte S.L.', name: 'Reformas Norte',
  ...over,
});

const mkInvoice = (over = {}) => ({
  id: 70, merchantId: 7,
  number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z'), total: '121.00', type: 'F1',
  lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }],
  vfHash: 'A'.repeat(64), vfPrevHash: null, vfTimestamp: new Date('2026-03-15T10:00:05Z'),
  vfAnulHash: null, vfAnulTimestamp: null, vfAnulPrevHash: null,
  customer: { name: 'Cliente QA', taxId: 'A11111111' }, rectifies: null,
  ...over,
});

const fakePrisma = (invoices, merchant) => ({
  merchant: { findUnique: async () => merchant },
  invoice: {
    findMany: async (args) => (args?.where?.vfHash ? invoices.filter((i) => i.vfHash) : invoices),
    findUnique: async () => invoices[0],
    findFirst: async () => null,
  },
});

const exportar = (invoices, merchant = mkMerchant()) =>
  buildVerifactuRegistrosXml({ merchantId: merchant.id, year: 2026 }, fakePrisma(invoices, merchant));

const valores = (xml, elemento) =>
  [...xml.matchAll(new RegExp(`<sum1:${elemento}>([^<]*)</sum1:${elemento}>`, 'g'))].map((m) => m[1]);

// Una alta y una anulación: las dos plantillas del bloque `SistemaInformatico`.
const ALTA_Y_ANULACION = () => [
  mkInvoice(),
  mkInvoice({ id: 71, number: '2026-CF-002', vfHash: 'B'.repeat(64), vfPrevHash: 'A'.repeat(64),
    vfTimestamp: new Date('2026-03-16T10:00:05Z'), createdAt: new Date('2026-03-16T10:00:00Z'),
    vfAnulHash: 'C'.repeat(64), vfAnulTimestamp: new Date('2026-03-17T10:00:05Z'), vfAnulPrevHash: 'B'.repeat(64) }),
];

// ═══ SUELO — sin esto, «no dice 1» y «no hubo XML» serían el mismo verde ═══════════════════════════

test('SCRUM-524g · SUELO: el banco produce altas Y anulación, y cada una lleva su bloque SistemaInformatico', async () => {
  const { xml, count, excluidos } = await exportar(ALTA_Y_ANULACION());
  assert.deepEqual(excluidos, [], 'el banco excluye facturas: arregla el banco antes de leer nada');
  assert.ok(count >= 2, `count=${count}: sin dos registros no se miden las dos plantillas`);
  assert.match(xml, /<sum1:RegistroAnulacion>/, 'el banco no produjo la anulación: la segunda plantilla no se mide');
  const n = valores(xml, 'NumeroInstalacion').length;
  assert.equal(n, valores(xml, 'IndicadorMultiplesOT').length, 'bloques SistemaInformatico incompletos');
  assert.ok(n >= 3, `sólo ${n} bloques SistemaInformatico (se esperaban ≥3: dos altas y una anulación)`);
});

test('SCRUM-524g · CONTROL: TipoUsoPosibleMultiOT sigue en S en todos los bloques (describe el SISTEMA)', async () => {
  const { xml } = await exportar(ALTA_Y_ANULACION());
  const v = valores(xml, 'TipoUsoPosibleMultiOT');
  assert.ok(v.length >= 3 && v.every((x) => x === 'S'), `TipoUsoPosibleMultiOT = ${JSON.stringify(v)}`);
});

// ═══ NumeroInstalacion — uno por facturación, el del comercio ══════════════════════════════════════

test('SCRUM-524g · NumeroInstalacion es el id del COMERCIO, en alta y en anulación', async () => {
  const { xml } = await exportar(ALTA_Y_ANULACION(), mkMerchant({ id: 7 }));
  assert.deepEqual([...new Set(valores(xml, 'NumeroInstalacion'))], ['7'],
    'el registro no lleva el número de instalación del comercio');
});

test('SCRUM-524g · dos comercios del MISMO NIF declaran números distintos (FAQ AEAT v1.3, apdo. 4)', async () => {
  const a = await exportar([mkInvoice()], mkMerchant({ id: 7 }));
  const b = await exportar([mkInvoice({ merchantId: 8 })], mkMerchant({ id: 8 }));
  const na = valores(a.xml, 'NumeroInstalacion'); const nb = valores(b.xml, 'NumeroInstalacion');
  assert.ok(na.length && nb.length, 'SUELO: sin números no hay comparación');
  assert.notDeepEqual(na, nb, `los dos comercios del NIF B12345678 declaran el mismo número (${na[0]}): `
    + 'para la AEAT serían la MISMA instalación');
});

test('SCRUM-524g · el comercio demo (id=1) sigue declarando «1»', async () => {
  const { xml } = await exportar([mkInvoice({ merchantId: 1 })], mkMerchant({ id: 1 })); // MERCHANT DEMO A PROPOSITO (SCRUM-409): el GO exige que el demo siga en «1»
  assert.deepEqual(valores(xml, 'NumeroInstalacion'), ['1']);
  assert.equal(numeroInstalacion(1), '1');
});

test('SCRUM-524g · la remisión (registroParaRemision) lleva el mismo número que la exportación', async () => {
  const xml = await registroParaRemision(70, fakePrisma([mkInvoice()], mkMerchant({ id: 7 })));
  assert.deepEqual(valores(xml, 'NumeroInstalacion'), ['7']);
});

test('SCRUM-524g · productor.ts ya no exporta un número de instalación GLOBAL', () => {
  assert.equal(productorMod.VERIFACTU_NUM_INSTALACION, undefined,
    `sigue existiendo VERIFACTU_NUM_INSTALACION = ${JSON.stringify(productorMod.VERIFACTU_NUM_INSTALACION)}: `
    + 'un número para todos los comercios es justo lo que 524e midió como incorrecto');
  assert.ok(Object.keys(productorMod.PRODUCTOR_VERIFACTU).length > 0, 'SUELO: el módulo del productor no exporta nada');
});

// ═══ IndicadorMultiplesOT — por usuario del SaaS: N con una sola facturación ═══════════════════════

test('SCRUM-524g · IndicadorMultiplesOT = N en alta y en anulación para un comercio con UNA facturación', async () => {
  const { xml } = await exportar(ALTA_Y_ANULACION());
  const v = valores(xml, 'IndicadorMultiplesOT');
  assert.ok(v.length >= 3, 'SUELO');
  assert.deepEqual([...new Set(v)], ['N'], `IndicadorMultiplesOT = ${JSON.stringify(v)}`);
});

test('SCRUM-524g · la remisión también declara N', async () => {
  const xml = await registroParaRemision(70, fakePrisma([mkInvoice()], mkMerchant()));
  assert.deepEqual(valores(xml, 'IndicadorMultiplesOT'), ['N']);
});

test('SCRUM-524g · el indicador se CALCULA: S con más de una facturación, N con una', () => {
  assert.equal(indicadorMultiplesOT(1), 'N');
  assert.equal(indicadorMultiplesOT(2), 'S');
  assert.equal(FACTURACIONES_POR_CUENTA, 1);
});

// ═══ Por qué FACTURACIONES_POR_CUENTA = 1, leído del esquema ═══════════════════════════════════════
// Si alguien hace posible que una cuenta lleve dos comercios (o un comercio dos NIF), esto cae y
// obliga a contar las facturaciones de verdad en vez de usar la constante.

const ESQUEMA = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');
const campos = (modelo) => {
  const m = new RegExp(`^model ${modelo} \\{\\r?\\n([\\s\\S]*?)^\\}`, 'm').exec(ESQUEMA);
  assert.ok(m, `no encuentro el modelo ${modelo} en prisma/schema.prisma`);
  // Cada línea en palabras; las que vienen detrás de una palabra que abre comentario no cuentan
  // (en el esquema un `//` sólo abre comentario: no hay cadenas con barras en una definición de campo).
  return m[1].split(/\r?\n/).map((l) => l.trim().split(/\s+/))
    .map((ps) => { const c = ps.findIndex((p) => p.startsWith('//')); return c === -1 ? ps : ps.slice(0, c); })
    .filter((ps) => ps.length && ps[0] && !ps[0].startsWith('@@'));
};
const campo = (modelo, nombre) => campos(modelo).filter((c) => c[0] === nombre);

test('SCRUM-524g · una cuenta = un comercio = una facturación, según prisma/schema.prisma', () => {
  // La población: los dos modelos tienen campos (si el lector falla, no compara nada).
  assert.ok(campos('Merchant').length > 20 && campos('TeamMember').length > 3, 'SUELO: el lector del esquema no ve campos');

  const email = campo('Merchant', 'email');
  assert.equal(email.length, 1, 'Merchant.email no está, o está dos veces');
  assert.ok(email[0].includes('@unique'), 'Merchant.email ya no es @unique: una cuenta podría llegar a dos comercios');

  const taxId = campo('Merchant', 'taxId');
  assert.equal(taxId.length, 1, 'Merchant.taxId no está, o está dos veces');
  assert.ok(!taxId[0][1].endsWith('[]'), 'Merchant.taxId ya es una lista: un comercio factura para varios obligados');

  const merchantId = campo('TeamMember', 'merchantId');
  assert.equal(merchantId.length, 1, 'TeamMember.merchantId no está, o está dos veces');
  assert.ok(/^Int\??$/.test(merchantId[0][1]), `TeamMember.merchantId es «${merchantId[0][1]}», no un solo comercio`);
  const relaciones = campos('TeamMember').filter((c) => /^Merchant(\[\])?\??$/.test(c[1]));
  assert.equal(relaciones.length, 1, `TeamMember cuelga de ${relaciones.length} relaciones a Merchant, no de una`);

  const emailMiembro = campo('TeamMember', 'email');
  assert.equal(emailMiembro.length, 1, 'TeamMember.email no está, o está dos veces');
  assert.ok(emailMiembro[0].includes('@unique'), 'TeamMember.email ya no es @unique: un miembro podría llegar a dos comercios');
});
