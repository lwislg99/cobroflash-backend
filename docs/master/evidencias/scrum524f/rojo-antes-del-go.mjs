// docs/master/evidencias/scrum524f/rojo-antes-del-go.mjs — SCRUM-524f · lo que el diff propuesto
// tiene que hacer, escrito ANTES del GO. Sólo LEE el camino de emisión (regla 38): importa `dist/`
// y lo ejecuta contra una base falsa, sin tocar `src/`.
//
// NO vive en `tests/` a propósito: hoy CAE (ése es su trabajo), y en `tests/` tumbaría el
// obligatorio. Con el GO se pasa a `node:test` en `tests/scrum524f-…test.mjs`. Hasta entonces NO
// usa `node:test`: un fichero que registra tests fuera de la tanda lo tumba `tests/scrum708` (sus
// tests no correrían y nadie lo vería). Lleva su propio ejecutor, abajo, con total y código de salida.
//
// Se corre así (el `dist/` que mide se elige con BANCO; por omisión, el de este árbol):
//
//     BANCO=<raíz de un árbol con dist/> node docs/master/evidencias/scrum524f/rojo-antes-del-go.mjs
//
// Sobre `main` sin el diff: SUELO y controles en verde, los demás en ROJO. Con el diff: todo verde.
const casos = [];
const caso = (nombre, fn) => casos.push({ nombre, fn });
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(process.env.BANCO || path.join(AQUI, '..', '..', '..', '..'));
const dist = (rel) => pathToFileURL(path.join(RAIZ, 'dist', rel)).href;

const { buildVerifactuRegistrosXml, registroParaRemision } =
  await import(dist('modules/invoicing/domain/verifactu.service.js'));
const productorMod = await import(dist('modules/fiscal/verifactu/productor.js'));

// ── El banco: el patrón de `tests/scrum844c`, más la columna que propone el diff ─────────────────
const mkMerchant = (over = {}) => ({
  id: 7, country: 'ES', taxId: 'B12345678',
  legalName: 'Reformas Integrales del Norte S.L.', name: 'Reformas Norte',
  vfNumInstalacion: '7',
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

// Una alta y una anulación: las dos plantillas del bloque `SistemaInformatico` (`verifactu.service.ts`).
const ALTA_Y_ANULACION = () => [
  mkInvoice(),
  mkInvoice({ id: 71, number: '2026-CF-002', vfHash: 'B'.repeat(64), vfPrevHash: 'A'.repeat(64),
    vfTimestamp: new Date('2026-03-16T10:00:05Z'), createdAt: new Date('2026-03-16T10:00:00Z'),
    vfAnulHash: 'C'.repeat(64), vfAnulTimestamp: new Date('2026-03-17T10:00:05Z'), vfAnulPrevHash: 'B'.repeat(64) }),
];

// ═══ SUELO — sin esto, «no dice 1» y «no hubo XML» serían el mismo verde ═══════════════════════════

caso('524f · SUELO: el banco produce altas Y anulación, y cada una lleva su bloque SistemaInformatico', async () => {
  const { xml, count, excluidos } = await exportar(ALTA_Y_ANULACION());
  assert.deepEqual(excluidos, [], '🔴 el banco excluye facturas: arregla el banco antes de leer nada');
  assert.ok(count >= 2, `🔴 count=${count}: sin dos registros no se miden las dos plantillas`);
  assert.match(xml, /<sum1:RegistroAnulacion>/, '🔴 el banco no produjo la anulación: la segunda plantilla no se mide');
  const n = valores(xml, 'NumeroInstalacion').length;
  assert.equal(n, valores(xml, 'IndicadorMultiplesOT').length, '🔴 bloques SistemaInformatico incompletos');
  assert.ok(n >= 3, `🔴 sólo ${n} bloques SistemaInformatico (se esperaban ≥3: dos altas y una anulación)`);
});

// ═══ CONTROL que tiene que seguir VERDE con y sin el diff (524e ③.2: ya es correcto) ═══════════════

caso('524f · CONTROL: TipoUsoPosibleMultiOT sigue en S en todos los bloques (describe el SISTEMA)', async () => {
  const { xml } = await exportar(ALTA_Y_ANULACION());
  const v = valores(xml, 'TipoUsoPosibleMultiOT');
  assert.ok(v.length >= 3 && v.every((x) => x === 'S'), `🔴 TipoUsoPosibleMultiOT = ${JSON.stringify(v)}`);
});

// ═══ (1) NumeroInstalacion — uno por facturación, el del comercio ══════════════════════════════════

caso('524f · 🔴 NumeroInstalacion es el del COMERCIO, en alta y en anulación (hoy: «1» fijo)', async () => {
  const { xml } = await exportar(ALTA_Y_ANULACION(), mkMerchant({ id: 7, vfNumInstalacion: '7' }));
  assert.deepEqual([...new Set(valores(xml, 'NumeroInstalacion'))], ['7'],
    '🔴 el registro no lleva el número de instalación del comercio');
});

caso('524f · 🔴 dos comercios del MISMO NIF declaran números distintos (FAQ AEAT v1.3, apdo. 4)', async () => {
  const a = await exportar([mkInvoice()], mkMerchant({ id: 7, vfNumInstalacion: '7' }));
  const b = await exportar([mkInvoice({ merchantId: 8 })], mkMerchant({ id: 8, vfNumInstalacion: '8' }));
  const na = valores(a.xml, 'NumeroInstalacion'); const nb = valores(b.xml, 'NumeroInstalacion');
  assert.ok(na.length && nb.length, '🔴 SUELO: sin números no hay comparación');
  assert.notDeepEqual(na, nb, `🔴 los dos comercios del NIF B12345678 declaran el mismo número (${na[0]}): `
    + 'para la AEAT serían la MISMA instalación');
});

// SÓLO VARIANTE A (columna). En la B el número sale del `id` y nunca está vacío: este caso no aplica.
caso('524f · 🔴 [A] sin número asignado NO se emite (fail-closed, como el resto del productor)', async () => {
  await assert.rejects(exportar([mkInvoice()], mkMerchant({ vfNumInstalacion: null })),
    /verifactu_productor_no_configurado/,
    '🔴 un comercio sin número de instalación produjo un registro: lleva un número que no es suyo');
});

caso('524f · 🔴 la remisión (registroParaRemision) lleva el mismo número que la exportación', async () => {
  const m = mkMerchant({ id: 7, vfNumInstalacion: '7' });
  const xml = await registroParaRemision(70, fakePrisma([mkInvoice()], m));
  assert.deepEqual(valores(xml, 'NumeroInstalacion'), ['7']);
});

caso('524f · 🔴 productor.ts ya no exporta un número de instalación GLOBAL', () => {
  assert.equal(productorMod.VERIFACTU_NUM_INSTALACION, undefined,
    `🔴 sigue existiendo VERIFACTU_NUM_INSTALACION = ${JSON.stringify(productorMod.VERIFACTU_NUM_INSTALACION)}: `
    + 'un número para todos los comercios es justo lo que 524e midió como incorrecto');
});

// ═══ (2 bis) IndicadorMultiplesOT — por usuario del SaaS: N con una sola facturación ═══════════════

caso('524f · 🔴 IndicadorMultiplesOT = N en alta y en anulación para un comercio con UNA facturación (hoy: S fijo)', async () => {
  const { xml } = await exportar(ALTA_Y_ANULACION());
  const v = valores(xml, 'IndicadorMultiplesOT');
  assert.ok(v.length >= 3, '🔴 SUELO');
  assert.deepEqual([...new Set(v)], ['N'], `🔴 IndicadorMultiplesOT = ${JSON.stringify(v)}`);
});

caso('524f · 🔴 la remisión también declara N', async () => {
  const xml = await registroParaRemision(70, fakePrisma([mkInvoice()], mkMerchant()));
  assert.deepEqual(valores(xml, 'IndicadorMultiplesOT'), ['N']);
});

// El banco se declara: si el `dist/` no existe, el import de arriba revienta y el proceso sale con
// código ≠ 0 sin imprimir ningún total — que no se lee como «0 casos». Esto deja escrito de qué
// árbol se midió.
caso('524f · POBLACIÓN: de qué dist/ se midió', () => {
  const f = path.join(RAIZ, 'dist', 'modules', 'invoicing', 'domain', 'verifactu.service.js');
  assert.ok(fs.existsSync(f), `🔴 no existe ${f}`);
  console.log(`# banco: ${RAIZ} · verifactu.service.js ${fs.statSync(f).size} B`);
});

// ── El ejecutor: uno a uno, en orden; total declarado; sale con 1 si cae alguno ─────────────────────
let caen = 0;
for (const [i, c] of casos.entries()) {
  try {
    await c.fn();
    console.log(`ok ${i + 1} - ${c.nombre}`);
  } catch (e) {
    caen++;
    console.log(`not ok ${i + 1} - ${c.nombre}\n#   ${String(e?.message ?? e).split('\n').join('\n#   ')}`);
  }
}
console.log(`# casos ${casos.length} · pasan ${casos.length - caen} · caen ${caen}`);
if (!casos.length) { console.log('# 🔴 CIEGO: cero casos registrados'); process.exitCode = 2; }
else if (caen) process.exitCode = 1;
