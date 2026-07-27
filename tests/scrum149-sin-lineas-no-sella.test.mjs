// SCRUM-149 — una factura SIN LÍNEAS no se puede sellar en la cadena VeriFactu.
//
// EL DAÑO QUE IMPIDE: `cuotaTotal` de la huella sale de `calcVatCuotaTotal(invoice.lines)`. Sin
// líneas devuelve 0,00, así que la factura se sellaría declarando CERO IVA repercutido sobre un
// importe que sí lo lleva. La huella es inmutable y ENCADENADA (`vfPrevHash`, regla 29): una vez
// sellada, eso solo se corrige emitiendo una R1.
//
// DE DÓNDE SALE: `createInvoiceFromQuoteAdmin` (retirada en este ticket) creaba la factura sin
// copiar las líneas — el mismo "bug E2E V0-1" que la ruta viva documenta como ya corregido,
// fosilizado en un camino paralelo y muerto. Bastaba con que UN call-site se olvidara.
//
// COMPORTAMIENTO REAL, no estructural: `applyVeriFactu` acepta el cliente Prisma por parámetro,
// así que se ejercita con un doble y se comprueba lo que HACE — no cómo está escrito.
//
// SIN GATE: el doble no toca BD.
import test from 'node:test';
import assert from 'node:assert/strict';

const { applyVeriFactu } = await import('../dist/modules/invoicing/domain/verifactu.service.js');

/**
 * Doble mínimo de Prisma: `lines` es lo único que decide el caso.
 *
 * SCRUM-173: ahora expone además `$transaction` y `$executeRaw`, porque `applyVeriFactu`
 * sella la cadena DENTRO de una transacción con cerrojo por merchant
 * (`pg_advisory_xact_lock`). No es adorno: la función distingue el cliente global del de una
 * transacción por la presencia de `$transaction` y **rechaza el segundo** — sellar dentro de
 * otra tx haría que las facturas de un mismo lote no se vieran entre sí y todas encadenaran
 * al mismo registro anterior. Un doble sin `$transaction` se parecía a un cliente de
 * transacción y saltaba ese guard.
 *
 * `$transaction` ejecuta el callback con el MISMO doble: aquí no hay aislamiento que emular,
 * solo la forma. `$executeRaw` traga el cerrojo sin hacer nada — no hay Postgres detrás.
 */
function fakePrisma({ lines }) {
  const client = {
    invoice: {
      findUnique: async () => ({ lines }),
      findFirst: async () => null,          // no hay huella anterior (primer registro)
      update: async ({ data }) => ({ ...data }),
    },
    $executeRaw: async () => 1,
    $transaction: async (fn) => fn(client),
  };
  return client;
}

const facturaBase = {
  id: 1,
  number: '2026-CF-001',
  total: { toString: () => '121.00' },
  createdAt: new Date('2026-03-10T10:00:00Z'),
  merchantId: 7,
  type: 'F1',
};

test('SCRUM-149: sin líneas → NO se sella (fail-closed), con un error nombrado', async () => {
  await assert.rejects(
    () => applyVeriFactu(facturaBase, 'B12345678', fakePrisma({ lines: null })),
    /invoice_without_lines_not_sealable/,
    'una factura sin líneas no puede entrar en la cadena de huellas',
  );
});

test('SCRUM-149: lines vacío ([]) tampoco sella — es el mismo caso, no "líneas presentes"', async () => {
  await assert.rejects(
    () => applyVeriFactu(facturaBase, 'B12345678', fakePrisma({ lines: [] })),
    /invoice_without_lines_not_sealable/,
  );
});

test('SCRUM-149: con líneas SÍ sella, y la cuota es la real (no 0,00)', async () => {
  const r = await applyVeriFactu(
    facturaBase,
    'B12345678',
    fakePrisma({ lines: [{ concept: 'Obra', qty: 1, price: 100, tax: 0.21 }] }),
  );
  assert.match(r.vfHash, /^[0-9A-F]{64}$/, 'huella SHA-256 en hex mayúsculas');
  // La prueba de que el guard protege algo REAL: el importe que se sella lleva IVA.
  // Sin líneas, esa misma factura habría entrado en la cadena con cuota 0,00.
  assert.ok(r.qrUrl.includes('121.00'), 'el QR de cotejo lleva el importe total');
});

test('SCRUM-149: el guard NO se salta la regla de los justificantes (orden de las comprobaciones)', async () => {
  // Un J- debe seguir fallando por SER justificante, no por no tener líneas: si el guard nuevo
  // se hubiera puesto antes, el motivo del rechazo cambiaría y los call-sites que distinguen
  // ese caso dejarían de reconocerlo.
  await assert.rejects(
    () => applyVeriFactu({ ...facturaBase, number: 'J-20260310-AB12' }, 'B12345678', fakePrisma({ lines: null })),
    /receipt_document_not_invoiceable/,
    'el justificante se rechaza por serlo, antes de mirar las líneas',
  );
});

test('SCRUM-149: el camino muerto que creaba facturas sin líneas ya no existe', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

  const quoteAdmin = fs.readFileSync(path.join(raiz, 'src/modules/system/quoteAdmin.ts'), 'utf8');
  const rutas = fs.readFileSync(path.join(raiz, 'src/modules/system/app/routes/quotesAdmin.routes.ts'), 'utf8');
  const codigo = (s) => s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  assert.doesNotMatch(codigo(quoteAdmin), /createInvoiceFromQuoteAdmin/,
    'la función muerta no debe volver: emitía sin líneas y saltándose el plan de tramos');
  assert.doesNotMatch(codigo(rutas), /createInvoiceFromQuoteAdmin/,
    'ni su import huérfano');
});
