// tests/scrum1838-banco-emision-relaciones-y-pdf.test.mjs — SCRUM-1838
//
// EL BANCO DE EMISIÓN MODELA LO QUE 665e LE PIDE AL CAMINO, PARA TODOS SUS CONSUMIDORES.
//
// Desde SCRUM-665e, `ensureInvoicePdf` (src/lib/invoicing.ts) relee la factura con
// `include: { merchant, customer, rectifies: { select: { number } } }` —sin las dos primeras lanza
// `missing_relations`— y después lee la huella del fichero que dejó el PDF (`huellaDeFichero`). El
// banco sólo sabía las relaciones de `charge`, y su doble del PDF no escribía nada: SCRUM-1787s tuvo
// que ponerse DOS envoltorios locales (SCRUM-665g). Aquí se exige que el banco lo haga él:
//
//   ① `invoice.findUnique`/`findFirst` traen `merchant`, `customer` y `rectifies` (con su `select`).
//   ② el doble del PDF escribe el fichero donde lo escribe el de verdad (`pdf.service.ts`:
//      `invoicesDir/<merchantId>-<number>.pdf`) y devuelve su `outPath`.
//   ③ ese disco es un TEMPORAL DEL SISTEMA, fuera del árbol (SCRUM-824), puesto por el banco.
//   ④ punta a punta: una factura tras cobrar sale con `pdf_sha256` = la huella del fichero en disco.
//
// Los CONTROLES dicen que lo que ya funcionaba sigue: las relaciones de `charge`, y que una factura
// sin rectificada trae `rectifies: null` y la de cada comercio trae SU comercio, no el primero.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// El banco ANTES de cargar nada de `dist/` (lo dice su cabecera).
const { banco, prisma, reiniciar, nuevoId, requiere, rutaDe, asentar, M_PT, M_ES, CLIENTE } = await import('./_banco-emision-con-estado.mjs');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { invoicesDir } = requiere(rutaDe('dist/core/storage/dirs.js'));
const { generateInvoicePdf } = requiere(rutaDe('dist/lib/pdf.js')); // el DOBLE del banco
const { ensureInvoiceForCharge } = requiere(rutaDe('dist/lib/invoicing.js'));

// Cada mitad de la cura, quitada por separado, tiene que tumbar su caso (meta-guard de mutaciones).
// La del disco lo DESVÍA dentro del mismo temporal (no al árbol): rompe ③ sin dejar nada en el repo.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'tests/_banco-emision-con-estado.mjs',
    de: 'merchant: (fac, p) => proyectar(banco.tablas.merchant.find((m) => m.id === fac.merchantId), p),',
    a: 'merchant: () => null,',
    cae: 'SCRUM-1838 ① 🔴 `invoice.findUnique` trae merchant, customer y rectifies con su `select`',
  },
  {
    fichero: 'tests/_banco-emision-con-estado.mjs',
    de: 'proyectar(banco.tablas.invoice.find((i) => i.id === fac.rectifiesId), p)',
    a: 'proyectar(banco.tablas.invoice.find((i) => i.id === fac.rectifiesId), true)',
    cae: 'SCRUM-1838 ① 🔴 `invoice.findUnique` trae merchant, customer y rectifies con su `select`',
  },
  {
    fichero: 'tests/_banco-emision-con-estado.mjs',
    de: '    assert.ok(resolver, `',
    a: '    if (!resolver) continue; assert.ok(resolver, `',
    cae: 'SCRUM-1838 ① 🔴 una relación de `invoice` que el banco no sabe LANZA, no se da por buena',
  },
  {
    fichero: 'tests/_banco-emision-con-estado.mjs',
    de: '      fs.writeFileSync(outPath, ',
    a: '      void (',
    cae: 'SCRUM-1838 ② 🔴 el doble del PDF escribe el fichero donde lo escribe el de verdad y devuelve su `outPath`',
  },
  {
    fichero: 'tests/_banco-emision-con-estado.mjs',
    de: 'process.env.RAILWAY_VOLUME_MOUNT_PATH = RAIZ_PDF;',
    a: "process.env.RAILWAY_VOLUME_MOUNT_PATH = path.join(RAIZ_PDF, 'otro');",
    cae: 'SCRUM-1838 ③ 🔴 el disco del PDF es un temporal del sistema, fuera del árbol, y `dirs.js` apunta a él',
  },
];

function facturaEnBanco(campos) {
  const fila = { id: nuevoId('invoice'), status: 'paid', vfEstado: 'pendiente_de_sellado', rectifiesId: null, ...campos };
  banco.tablas.invoice.push(fila);
  return fila;
}

test('SCRUM-1838 · CONTROL · las relaciones de `charge` siguen como estaban', async () => {
  reiniciar();
  const id = nuevoId('charge');
  banco.tablas.charge.push({ id, merchantId: M_PT, customerId: CLIENTE, status: 'paid' });
  banco.tablas.event.push({ id: nuevoId('event'), chargeId: id, type: 'paid' });
  const c = await prisma.charge.findUnique({ where: { id }, include: { customer: true, merchant: true, events: true } });
  assert.equal(c.merchant?.id, M_PT);
  assert.equal(c.customer?.id, CLIENTE);
  assert.equal(c.events.length, 1);
});

test('SCRUM-1838 ① 🔴 `invoice.findUnique` trae merchant, customer y rectifies con su `select`', async () => {
  reiniciar();
  const original = facturaEnBanco({ merchantId: M_ES, customerId: CLIENTE, number: 'F-2026-001', total: '10' });
  const rect = facturaEnBanco({ merchantId: M_ES, customerId: CLIENTE, number: 'R-2026-001', rectifiesId: original.id });
  const inc = { merchant: true, customer: true, rectifies: { select: { number: true } } };
  const f = await prisma.invoice.findUnique({ where: { id: rect.id }, include: inc });
  assert.equal(f.merchant?.id, M_ES, '🔴 sin `merchant` el camino lanza `missing_relations`');
  assert.equal(f.customer?.id, CLIENTE, '🔴 sin `customer` el camino lanza `missing_relations`');
  assert.deepEqual(f.rectifies, { number: 'F-2026-001' }, '🔴 `rectifies` no respeta su `select`');
  const g = await prisma.invoice.findFirst({ where: { id: rect.id }, include: inc });
  assert.equal(g.merchant?.id, M_ES, '🔴 `findFirst` no trae las relaciones');
  // Sin `include`, la fila sola: el banco no se inventa relaciones que nadie pidió.
  const sola = await prisma.invoice.findUnique({ where: { id: rect.id } });
  assert.equal('merchant' in sola, false);
  // Y lo que el banco devuelve es una COPIA: tocarla no escribe en la tabla.
  f.merchant.name = 'tocado';
  assert.notEqual(banco.tablas.merchant.find((m) => m.id === M_ES).name, 'tocado');
});

test('SCRUM-1838 ① CONTROL POSITIVO · sin rectificada, `rectifies: null`; y cada factura trae SU comercio', async () => {
  reiniciar();
  const pt = facturaEnBanco({ merchantId: M_PT, customerId: CLIENTE, number: 'PT-1' });
  const es = facturaEnBanco({ merchantId: M_ES, customerId: CLIENTE, number: 'ES-1' });
  const inc = { merchant: true, customer: true, rectifies: { select: { number: true } } };
  const a = await prisma.invoice.findUnique({ where: { id: pt.id }, include: inc });
  const b = await prisma.invoice.findUnique({ where: { id: es.id }, include: inc });
  assert.equal(a.rectifies, null);
  assert.equal(a.merchant.id, M_PT);
  assert.equal(b.merchant.id, M_ES);
});

test('SCRUM-1838 ① 🔴 una relación de `invoice` que el banco no sabe LANZA, no se da por buena', async () => {
  reiniciar();
  const f = facturaEnBanco({ merchantId: M_PT, customerId: CLIENTE, number: 'PT-2' });
  await assert.rejects(prisma.invoice.findUnique({ where: { id: f.id }, include: { inventada: true } }), /EL BANCO NO SABE/);
});

test('SCRUM-1838 ③ 🔴 el disco del PDF es un temporal del sistema, fuera del árbol, y `dirs.js` apunta a él', () => {
  assert.equal(invoicesDir, banco.dirPdf, '🔴 `dirs.js` no apunta al disco del banco');
  const relativa = path.relative(RAIZ, invoicesDir);
  assert.ok(relativa.startsWith('..') || path.isAbsolute(relativa), `🔴 el disco cae dentro del árbol: ${invoicesDir}`);
});

test('SCRUM-1838 ② 🔴 el doble del PDF escribe el fichero donde lo escribe el de verdad y devuelve su `outPath`', async () => {
  reiniciar();
  const r = await generateInvoicePdf({ number: 'F-2026-777', invoiceId: 777, merchantId: M_PT });
  const esperado = path.join(invoicesDir, `${M_PT}-F-2026-777.pdf`);
  assert.equal(r.outPath, esperado, '🔴 el doble no devuelve la ruta que devuelve `pdf.service.ts`');
  assert.equal(r.publicUrlPath, '/admin/invoices/777/pdf');
  assert.ok(fs.existsSync(esperado), '🔴 el doble no escribe el fichero: 665e lee su huella y da ENOENT');
  assert.ok(fs.readFileSync(esperado).length > 0);
  assert.equal(banco.pdf.generados, 1);
});

test('SCRUM-1838 ② CONTROL · el fallo a propósito del PDF sigue fallando y no deja fichero', async () => {
  reiniciar();
  banco.pdf.fallos = 1;
  await assert.rejects(generateInvoicePdf({ number: 'F-2026-778', invoiceId: 778, merchantId: M_PT }), /pdf_caido_a_proposito/);
  assert.equal(fs.existsSync(path.join(invoicesDir, `${M_PT}-F-2026-778.pdf`)), false);
});

test('SCRUM-1838 ④ 🔴 punta a punta: la factura tras cobrar sale con `pdf_sha256` = la huella del fichero', async () => {
  reiniciar();
  const id = nuevoId('charge');
  banco.tablas.charge.push({
    id, merchantId: M_PT, customerId: CLIENTE, status: 'paid', amount: '121.00', currency: 'EUR',
    concept: 'Arreglo de una fuga', method: 'card', reference: null, intentId: null, receiptToken: null, paidAt: null,
  });
  await ensureInvoiceForCharge(id, prisma);
  await asentar();
  const fs_ = banco.tablas.invoice.filter((f) => f.chargeId === id);
  assert.equal(fs_.length, 1, `🔴 CIEGO: el cobro dejó ${fs_.length} facturas`);
  const f = fs_[0];
  assert.ok(f.pdfSha256, '🔴 la factura no quedó congelada: sin relaciones o sin fichero, 665e no llega a la huella');
  const fichero = path.join(invoicesDir, `${f.merchantId}-${f.number}.pdf`);
  assert.equal(f.pdfSha256, crypto.createHash('sha256').update(fs.readFileSync(fichero)).digest('hex'));
});
