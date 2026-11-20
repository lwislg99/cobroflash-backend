// tests/scrum1780c-factura-desde-parte.test.mjs — SCRUM-1780c (J1)
//
// FACTURA DESDE EL PARTE FIRMADO: `facturarParte` (src/modules/invoicing/domain/facturaDesdeParte.ts)
// con `emitInvoice` DE VERDAD (`dist/`) sobre el banco con estado de la casa
// (`_banco-emision-con-estado.mjs`: dobla la base, el PDF y el correo, y nada más).
//
// 🔴 LO QUE ESTE TEST NO PRUEBA (A10, SCRUM-1344): la RUTA. `partes.routes.ts` es del carril S1 y
// el montaje (tres líneas literales en SCRUM-1780 c.22242) lo escribe S1. Aquí el handler va montado
// en un router DE PRUEBA con el mismo `requireRole('admin')` que dice ese montaje. Este test sigue
// verde con la ruta sin montar: que la ruta real exista lo tiene que vigilar el PR de S1.
//
// 🔴 LÍMITES DEL BANCO (dichos en el propio banco): no deshace una tx que lanza y no aísla. Por eso
// la reclamación del parte va ANTES de pedir número: la segunda petición simultánea sale de la tx
// antes de emitir, y el banco puede contar «una factura» sin necesitar rollback. Contra Postgres de
// verdad NO se ha medido la carrera (no hay base desechable en esta máquina).
//
// La tabla `parteTrabajo` no la gobierna el banco (es de S3 y no se toca): la pone este fichero,
// con el evaluador de `where` de la casa, envolviendo al `prisma` del banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { banco, reiniciar, requiere, rutaDe, M_ES, M_PT, asentar, prisma as prismaDelBanco } from './_banco-emision-con-estado.mjs';
import { casa } from './_where-como-prisma.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

/** Lo que el meta-guard muta (scripts/meta-guard-mutaciones.mjs, `aplicarUna`). `cae`, literal. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Sin el comercio en la búsqueda, el parte de OTRO comercio se factura con el emisor de éste.
    fichero: 'src/modules/invoicing/domain/facturaDesdeParte.ts',
    de: 'const parte = await prisma.parteTrabajo.findFirst({ where: { id: parteId, merchantId } });',
    a: 'const parte = await prisma.parteTrabajo.findFirst({ where: { id: parteId } });',
    cae: 'comercio B → 404',
  },
  {
    // Sin escribir el enlace, el parte sigue facturable con su factura emitida (B1: «facturado» = invoiceId).
    fichero: 'src/modules/invoicing/domain/facturaDesdeParte.ts',
    de: 'data: { invoiceId: inv.id },',
    a: 'data: {},',
    cae: 'caso feliz → F1 con las líneas',
  },
  {
    // Sin la precomprobación, un parte que ya lleva factura llega a emitir otra (B1). La de quitar
    // `invoiceId: null` del WHERE del enlace solo la ve la simultánea, que va bajo Postgres (SCRUM-1780).
    fichero: 'src/modules/invoicing/domain/facturaDesdeParte.ts',
    de: 'if (parte.invoiceId != null) return',
    a: 'if (false) return',
    cae: 'firmado con factura ya enlazada → 409 parte_ya_facturado',
  },
];

// ── LA TABLA DEL PARTE, envolviendo al prisma del banco ────────────────────────────────────
let partes = [];
const modeloParte = {
  findFirst: async (a) => { const f = partes.find((x) => casa(x, a?.where)); return f ? { ...f } : null; },
  updateMany: async (a) => {
    const filas = partes.filter((x) => casa(x, a?.where));
    for (const f of filas) Object.assign(f, a.data ?? {});
    return { count: filas.length };
  },
};
const envolver = (base) => new Proxy({}, {
  get: (_t, prop) => {
    if (prop === 'parteTrabajo') return modeloParte;
    if (prop === '$transaction') {
      const tr = base.$transaction;
      return tr === undefined ? undefined : (cb) => tr((tx) => cb(envolver(tx)));
    }
    return base[prop];
  },
});
const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: envolver(prismaDelBanco) } };

const DIST = pathToFileURL(path.resolve(import.meta.dirname, '../dist/')).href + '/';
const { facturarParte } = await import(DIST + 'modules/invoicing/domain/facturaDesdeParte.js');
const { requireRole } = await import(DIST + 'core/http/authMiddleware.js');

// El router DE PRUEBA, con el montaje literal de c.22242.
const express = requiere('express');
const router = express.Router();
router.post('/:id/facturar', requireRole('admin'), facturarParte);

async function invocar({ merchantId = M_ES, rol = 'admin', id }) {
  const capa = router.stack.find((l) => l.route?.path === '/:id/facturar' && l.route?.methods?.post);
  assert.ok(capa, '🔴 el router de prueba no tiene POST /:id/facturar');
  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; },
  };
  const req = reqDeSesion({ rol, merchantId, params: { id: String(id) }, body: {}, headers: {} });
  const capas = capa.route.stack.map((l) => l.handle);
  const pendientes = [];
  let i = 0;
  const next = () => { const h = capas[i++]; if (h) pendientes.push(Promise.resolve(h(req, res, next))); };
  next();
  for (let k = 0; k < pendientes.length; k++) await pendientes[k];
  await asentar();
  return salida;
}

const CLIENTE_ES = 7304;
const M_OFF = 8304; // España SIN el flag de facturación: `getEmissionMode` → 'receipt'
const LINEAS = [
  { bloque: 'Material', unds: 2, descripcion: 'Tubo multicapa 16mm', precioUnitario: 12.5, tipoIva: 21 },
  { bloque: 'Mano de obra', unds: 1, descripcion: 'Cambio de grifo', precioUnitario: 80, tipoIva: 10 },
];
let siguienteParte = 900;
function parte(campos = {}) {
  const fila = {
    id: ++siguienteParte, merchantId: M_ES, jobId: null, customerId: CLIENTE_ES,
    numero: `PT-${siguienteParte}`, fecha: new Date('2026-11-20T10:00:00Z'),
    lineas: LINEAS, estado: 'firmado', invoiceId: null, ...campos,
  };
  partes.push(fila);
  return fila;
}
const facturas = () => banco.tablas.invoice;

test.beforeEach(() => {
  reiniciar();
  partes = [];
  banco.tablas.customer.push({ id: CLIENTE_ES, merchantId: M_ES, name: 'Clienta de Lugo', legalName: null, taxId: null, email: null, phone: null });
  const es = banco.tablas.merchant.find((m) => m.id === M_ES);
  es.llevaLibrosPorSii = false; // como scrum1330: sin SII declarado «No», el flag ON sigue en 'receipt'
  banco.tablas.merchant.push({ ...es, id: M_OFF, flags: null, name: 'Fontanería sin flag' });
  banco.tablas.customer.push({ id: CLIENTE_ES + 1, merchantId: M_OFF, name: 'Cliente sin flag', legalName: null, taxId: null, email: null, phone: null });
});

test('SCRUM-1780c · caso feliz → F1 con las líneas, C7-parte, 0 Charge, parte facturado con invoiceId', async () => {
  const p = parte();
  const r = await invocar({ id: p.id });
  assert.equal(r.code, 201, JSON.stringify(r.body));
  assert.equal(facturas().length, 1);
  const f = facturas()[0];
  assert.equal(f.type, 'F1');
  assert.equal(f.merchantId, M_ES);
  assert.equal(f.customerId, CLIENTE_ES);
  assert.equal(f.quoteId ?? null, null);
  assert.deepEqual(
    (f.lines ?? []).map((l) => [l.concept, Number(l.qty), Number(l.price), Number(l.tax)]),
    [['Tubo multicapa 16mm', 2, 12.5, 0.21], ['Cambio de grifo', 1, 80, 0.1]],
    'el concepto es la descripción del parte TAL CUAL (c.22244 ②) y el IVA pasa a fracción',
  );
  // base 25 + 80 = 105; cuota 5,25 + 8 = 13,25 → 118,25
  assert.equal(String(f.total), '118.25');
  assert.equal(banco.tablas.charge.length, 0, 'la factura nace SIN cobro (c.22237 ②)');
  assert.ok(JSON.stringify(banco.tablas.auditLog).includes('C7-parte'), 'la auditoría de emitInvoice lleva el origen C7-parte');
  assert.equal(p.estado, 'firmado', 'B1 (SCRUM-1780): el parte se queda firmado; «facturado» es invoiceId no nulo');
  assert.equal(p.invoiceId, f.id);
  assert.equal(r.body.factura.id, f.id);
  assert.equal(r.body.message, undefined, 'ningún texto de usuario (regla 39)');
});

test('SCRUM-1780c · comercio B → 404 y nada emitido', async () => {
  const ajeno = parte({ merchantId: M_PT });
  const r = await invocar({ id: ajeno.id, merchantId: M_ES });
  assert.equal(r.code, 404);
  assert.deepEqual(r.body, { error: 'not_found' });
  assert.equal(facturas().length, 0);
  assert.equal(ajeno.estado, 'firmado');
});

test('SCRUM-1780c · borrador → 409 parte_no_firmado', async () => {
  const p = parte({ estado: 'borrador' });
  const r = await invocar({ id: p.id });
  assert.deepEqual([r.code, r.body], [409, { error: 'parte_no_firmado' }]);
  assert.equal(facturas().length, 0);
});

test('SCRUM-1780c · línea sin precio o sin IVA → 409 parte_sin_precio', async () => {
  for (const mala of [
    { ...LINEAS[1], precioUnitario: null },
    { ...LINEAS[1], tipoIva: undefined },
  ]) {
    const p = parte({ lineas: [LINEAS[0], mala] });
    const r = await invocar({ id: p.id });
    assert.deepEqual([r.code, r.body], [409, { error: 'parte_sin_precio' }]);
    assert.equal(p.estado, 'firmado');
  }
  assert.equal(facturas().length, 0);
});

test('SCRUM-1780c · sin cliente → 409 parte_sin_cliente', async () => {
  for (const customerId of [null, CLIENTE_ES + 1 /* de OTRO comercio */]) {
    const p = parte({ customerId });
    const r = await invocar({ id: p.id });
    assert.deepEqual([r.code, r.body], [409, { error: 'parte_sin_cliente' }]);
  }
  assert.equal(facturas().length, 0);
});

test('SCRUM-1780c · doble facturación secuencial → 409 parte_ya_facturado y UNA factura', async () => {
  const p = parte();
  assert.equal((await invocar({ id: p.id })).code, 201);
  const r = await invocar({ id: p.id });
  assert.deepEqual([r.code, r.body], [409, { error: 'parte_ya_facturado' }]);
  assert.equal(facturas().length, 1);
});

// B1 (SCRUM-1780): el enlace va DESPUÉS de emitir y la segunda petición la deshace la tx de Postgres.
// Este banco no deshace ni aísla: aquí la simultánea no se puede probar. Va bajo el Postgres
// desechable de la casa (pendiente del relevo, traspaso en SCRUM-1780); aquí queda el salto declarado.
test('SCRUM-1780c · doble facturación simultánea → un 201 y un 409, UNA factura, contador +1', { skip: 'B1: se mide contra Postgres desechable (pendiente, SCRUM-1780); el banco en memoria no deshace la tx' }, async () => {
  const p = parte();
  const antes = banco.tablas.merchant.find((m) => m.id === M_ES).nextInvoiceNumber;
  const rs = await Promise.all([invocar({ id: p.id }), invocar({ id: p.id })]);
  assert.deepEqual(rs.map((r) => r.code).sort(), [201, 409]);
  assert.deepEqual(rs.find((r) => r.code === 409).body, { error: 'parte_ya_facturado' });
  assert.equal(facturas().length, 1);
  assert.equal(banco.tablas.merchant.find((m) => m.id === M_ES).nextInvoiceNumber, antes + 1);
  assert.equal(p.invoiceId, facturas()[0].id);
});

test('SCRUM-1780c · firmado con factura ya enlazada → 409 parte_ya_facturado (lo para el WHERE de la tx)', async () => {
  const p = parte({ invoiceId: 4242 });
  const r = await invocar({ id: p.id });
  assert.deepEqual([r.code, r.body], [409, { error: 'parte_ya_facturado' }]);
  assert.equal(facturas().length, 0);
  assert.equal(p.estado, 'firmado');
});

test('SCRUM-1780c · flag OFF → 409 facturacion_no_disponible y parte intacto', async () => {
  const p = parte({ merchantId: M_OFF, customerId: CLIENTE_ES + 1 });
  const copia = structuredClone(p);
  const r = await invocar({ id: p.id, merchantId: M_OFF });
  assert.deepEqual([r.code, r.body], [409, { error: 'facturacion_no_disponible' }]);
  assert.deepEqual(p, copia);
  assert.equal(facturas().length, 0);
});

test('SCRUM-1780c · técnico → 403 y nada emitido', async () => {
  const p = parte();
  const r = await invocar({ id: p.id, rol: 'tecnico' });
  assert.equal(r.code, 403);
  assert.equal(facturas().length, 0);
  assert.equal(p.estado, 'firmado');
});

test('SCRUM-1780c · trabajo con presupuesto ya facturado → se factura igual (c.22244 ③)', async () => {
  banco.tablas.quote.push({ id: 31, merchantId: M_ES, customerId: CLIENTE_ES, status: 'accepted', jobId: 77 });
  banco.tablas.invoice.push({ id: 61, merchantId: M_ES, customerId: CLIENTE_ES, quoteId: 31, number: 'F260099', type: 'F1', total: '50.00' });
  const p = parte({ jobId: 77 });
  const r = await invocar({ id: p.id });
  assert.equal(r.code, 201, JSON.stringify(r.body));
  assert.equal(facturas().length, 2);
  assert.equal(p.invoiceId, facturas()[1].id);
});
