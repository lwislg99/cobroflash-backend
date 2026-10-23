// tests/scrum1576-cobros-y-recibo-leen-el-cliente-de-la-factura.test.mjs — SCRUM-1576 (carril J2)
//
// UNA FACTURA EMITIDA SE NOMBRA CON EL CLIENTE QUE SE CONGELÓ AL EMITIRLA, TAMBIÉN EN COBROS.
//
// Medido por J2 el 22-oct-2026 (censo AST de `docs/master/evidencias/SCRUM-1576/censo.mjs`): dos
// lectores del carril de cobros nombran al cliente de una factura emitida con la ficha VIVA,
// aunque la factura guarda su nombre congelado (`Invoice.customerName`, SCRUM-729):
//   · `GET /admin/cobros` (`cobros.service.ts`, fila de una factura cobrada a mano): «Cliente».
//   · `GET /recibo/:token` (`receipt.routes.ts`): el pie «Cobro #N · Cliente: X» de un cobro que
//     ya tiene factura.
// Corregir el nombre de la ficha reescribía así el cliente de facturas pasadas en esas dos
// pantallas, mientras el PDF, el XML y los libros (SCRUM-1058c) conservan el congelado.
//
// 🔴 POR LA RUTA MONTADA, NO POR EL HANDLER: arranca `dist/app.js` con el banco de SCRUM-597.
// ⚠️ EL DOBLE RESPETA `include`/`select`: la relación `customer` sólo llega si se pide, y las
// columnas congeladas las escribe `congelarDesdeFicha` (la función de la casa), no el test.
//
// Lo que NO cambia y se comprueba: un cobro SIN factura (el `Charge` no guarda cliente) y una
// factura anterior al escritor (columnas a NULL) siguen saliendo con la ficha viva.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';

const require = createRequire(import.meta.url);
const app = await montarAppReal();
after(() => app.cerrar());

const MIO = 1576;
const ses = sesionesDe(MIO, { id: 9, role: 'tecnico', merchantId: MIO });
const { congelarDesdeFicha, CAMPOS_CONGELADOS } = require('../dist/modules/invoicing/domain/clienteCongelado.js');

const DIA = new Date('2026-08-10T10:00:00.000Z');
const FICHA_AL_EMITIR = { id: 10, merchantId: MIO, name: 'Fusionado', legalName: 'Fusionado SL', taxId: 'B11111111', email: null, phone: null };
const FICHA_CORREGIDA = { ...FICHA_AL_EMITIR, name: 'Principal', legalName: 'Principal SA', taxId: 'B22222222' };
const SIN_CONGELAR = Object.fromEntries(CAMPOS_CONGELADOS.map((c) => [c, null]));

function proyectar(fila, sel) {
  if (!sel) return { ...fila };
  return Object.fromEntries(Object.keys(sel).filter((k) => sel[k] && k in fila).map((k) => [k, fila[k]]));
}
/** `include`/`select` de la relación `customer`, como Prisma: sólo llega si se pide. */
function conCliente(fila, args, ficha) {
  const out = proyectar(fila, args?.select);
  const pide = args?.include?.customer ?? args?.select?.customer;
  if (pide) out.customer = pide === true ? { ...ficha } : proyectar(ficha, pide.select);
  return out;
}
const merchant = { ...ses.merchant, country: 'ES', taxId: 'B00000000', flags: null };

// ── /admin/cobros ─────────────────────────────────────────────────────────────────────────────
const facturaManual = (id, number, congelado) => ({
  id, merchantId: MIO, number, createdAt: DIA, total: 121, currency: 'EUR', status: 'paid', type: 'F1',
  paidVia: 'transferencia', chargeId: null, customerId: 10,
  ...(congelado ? congelarDesdeFicha(congelado) : SIN_CONGELAR),
});
const FACTURAS = [facturaManual(1, 'F-CONG', FICHA_AL_EMITIR), facturaManual(2, 'F-ANTIGUA', null)];
const COBRO_SIN_FACTURA = { id: 50, merchantId: MIO, createdAt: DIA, amount: 30, currency: 'EUR', method: null, status: 'pending', concept: 'Señal', reference: null, customerId: 10 };

async function pedirCobros(ficha) {
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => merchant },
    charge: { findMany: async (a) => [conCliente(COBRO_SIN_FACTURA, a, ficha)] },
    invoice: { findMany: async (a) => FACTURAS.filter((f) => f.merchantId === a?.where?.merchantId).map((f) => conCliente(f, a, ficha)) },
    event: { findMany: async () => [] },
    emailMessage: { findMany: async () => [] },
  });
  const r = await app.pedir('/admin/cobros', { token: ses.PROPIETARIO });
  assert.equal(r.status, 200, `suelo: /admin/cobros → ${r.status} ${String(r.texto).slice(0, 200)}`);
  const lista = Array.isArray(r.json) ? r.json : r.json?.cobros;
  assert.ok(Array.isArray(lista), `suelo: /admin/cobros no devuelve una lista: ${String(r.texto).slice(0, 200)}`);
  const por = new Map(lista.map((c) => [c.numero ?? `charge-${c.chargeId}`, c.cliente]));
  assert.deepEqual([...por.keys()].sort(), ['F-ANTIGUA', 'F-CONG', 'charge-50'], 'población: las dos facturas y el cobro');
  return por;
}

test('SCRUM-1576 · /admin/cobros · control: con la ficha sin cambiar, la factura congelada sale con su cliente', async () => {
  assert.equal((await pedirCobros(FICHA_AL_EMITIR)).get('F-CONG'), 'Fusionado');
});

test('SCRUM-1576 · /admin/cobros · 🔴 con la ficha corregida, la factura emitida sigue nombrando al cliente congelado', async () => {
  const por = await pedirCobros(FICHA_CORREGIDA);
  assert.equal(por.get('F-CONG'), 'Fusionado',
    '🔴 la pantalla de cobros ha renombrado el cliente de una factura emitida con la ficha de HOY: '
    + 'la factura guarda `customerName` y el PDF, el XML y los libros dicen otra cosa.');
});

test('SCRUM-1576 · /admin/cobros · la factura anterior al escritor y el cobro sin factura siguen con la ficha viva', async () => {
  const por = await pedirCobros(FICHA_CORREGIDA);
  assert.equal(por.get('F-ANTIGUA'), 'Principal');
  assert.equal(por.get('charge-50'), 'Principal');
});

// ── /recibo/:token ────────────────────────────────────────────────────────────────────────────
const TOKEN = 'tok-1576-recibo';
const cobroPagado = (conFactura) => ({
  id: 60, merchantId: MIO, receiptToken: TOKEN, createdAt: DIA, paidAt: DIA, amount: 121, currency: 'EUR',
  method: 'transferencia', status: 'paid', concept: 'Trabajo', reference: null, customerId: 10,
  events: conFactura ? [{ type: 'invoiced', payload: { invoice_id: 3 } }] : [], reconciliations: [],
});
const facturaDelCobro = { id: 3, merchantId: MIO, number: 'F-2026-0003', createdAt: DIA, type: 'F1', status: 'paid', total: 121, currency: 'EUR', customerId: 10, pdfUrl: null, ...congelarDesdeFicha(FICHA_AL_EMITIR) };

async function pedirRecibo(ficha, conFactura = true) {
  bancoDePrisma().programar({
    charge: {
      findUnique: async (a) => {
        if (a?.where?.receiptToken !== TOKEN) return null;
        const out = conCliente(cobroPagado(conFactura), a, ficha);
        out.merchant = merchant;
        return out;
      },
    },
    quote: { findFirst: async () => null },
    invoice: { findUnique: async (a) => (conFactura && a?.where?.id === 3 ? { ...facturaDelCobro } : null), findFirst: async () => null },
  });
  const r = await app.pedir(`/recibo/${TOKEN}`);
  assert.equal(r.status, 200, `suelo: /recibo → ${r.status} ${String(r.texto).slice(0, 200)}`);
  const m = /Cobro #60 · Cliente: ([^<]*)</.exec(r.texto);
  assert.ok(m, 'suelo: la página no pinta el pie «Cobro #60 · Cliente: …»');
  return m[1];
}

test('SCRUM-1576 · /recibo · control: con la ficha sin cambiar, el pie nombra al cliente de la factura', async () => {
  assert.equal(await pedirRecibo(FICHA_AL_EMITIR), 'Fusionado');
});

test('SCRUM-1576 · /recibo · 🔴 con la ficha corregida, un cobro ya facturado sigue nombrando al cliente congelado', async () => {
  assert.equal(await pedirRecibo(FICHA_CORREGIDA), 'Fusionado',
    '🔴 el recibo público ha renombrado el cliente de un cobro ya facturado con la ficha de HOY.');
});

test('SCRUM-1576 · /recibo · un cobro SIN factura sigue con la ficha viva (el Charge no guarda cliente)', async () => {
  assert.equal(await pedirRecibo(FICHA_CORREGIDA, false), 'Principal');
});

test('SCRUM-1576 · las dos pantallas sólo LEEN: ninguna escritura en el banco', async () => {
  await pedirCobros(FICHA_CORREGIDA);
  await pedirRecibo(FICHA_CORREGIDA);
  assert.deepEqual(bancoDePrisma().escrituras, []);
});
