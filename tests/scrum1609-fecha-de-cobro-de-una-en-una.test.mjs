// tests/scrum1609-fecha-de-cobro-de-una-en-una.test.mjs — SCRUM-1609 (J1, 26-oct-2026) · BUGS.md P3-PAIDAT-BO
//
// 🔴 «MARCAR PAGADA» DE UNA EN UNA NO ACEPTABA LA FECHA DEL COBRO, Y EL LOTE SÍ.
// `POST /admin/invoices/bulk-paid` resuelve la fecha con `resolverFechaDeCobro(req.body.paidAt)` desde
// SCRUM-397 (criterio firmado por el fundador el 10-ago-2026: no futura, sin límite hacia atrás). Su hermano
// de UNA factura, `PUT /admin/invoices/:id/status`, hace la misma acción de negocio —conciliar a mano un cobro
// ya recibido, típicamente con fecha pasada— y escribía `paidAt = new Date()` sin mirar el cuerpo. Una
// transferencia del 31 de marzo conciliada el 2 de abril salía cobrada en abril en informes y resumen semanal.
//
// El arreglo es el MISMO mecanismo del lote, no una decisión nueva: misma función, misma zona del merchant,
// mismos errores (`fecha_futura`, `fecha_ilegible`) con los textos que ya tiene `fechaDeCobro.ts`. Sin
// `paidAt` en el cuerpo, la ruta hace exactamente lo de antes: ése es el positivo (④).
//
// ── POR LA RUTA, NO POR EL HANDLER (A10, SCRUM-1344) ──
// Cada petición entra por HTTP en un `express` montado como en `src/app.ts` (`/admin/invoices`), con el
// `requireRole('admin')` de la propia ruta. Lo único que se sustituye es `requireAuth`, por un `req` de sesión
// de `reqDeSesion`. La base va doblada y hace cumplir el `where`: la factura sólo aparece si se pide con el
// merchant de la sesión (regla 2), y el `update` sólo casa si el estado leído sigue siendo el de la fila.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const require = createRequire(import.meta.url);
const express = require('express');

/**
 * Las mutaciones que tienen que tumbarme (SCRUM-745). Una por pieza: la ruta que lee la fecha y la
 * función que la escribe. Quitar cualquiera de las dos devuelve el `new Date()` de antes.
 */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: 'await updateInvoiceStatusAdmin(id, status, req.merchantId, req.body?.paidVia, fecha.fecha)',
    a: 'await updateInvoiceStatusAdmin(id, status, req.merchantId, req.body?.paidVia)',
    cae: 'SCRUM-1609 · PUT /admin/invoices/:id/status · 🔴 ① con paidAt pasada declarada, guarda ESA fecha y la audita como declarada',
  },
  {
    fichero: 'src/modules/system/invoiceAdmin.ts',
    de: 'paidAt = fechaDeCobro ?? new Date();',
    a: 'paidAt = new Date();',
    cae: 'SCRUM-1609 · PUT /admin/invoices/:id/status · 🔴 ① con paidAt pasada declarada, guarda ESA fecha y la audita como declarada',
  },
];

const FACTURA = 5;
const DE_OTRO = 7;
/** id → fila. La 7 es de OTRO comercio. */
const FILAS = new Map([
  [FACTURA, { id: FACTURA, merchantId: MERCHANT, status: 'pending', paidAt: null, type: 'F1', number: 'F-2026-0005' }],
  [DE_OTRO, { id: DE_OTRO, merchantId: MERCHANT + 1, status: 'pending', paidAt: null, type: 'F1', number: 'F-2026-0007' }],
]);

const registro = { updates: [], auditorias: [], merchants: [] };
inyectarBase({
  'invoice.findFirst': (args) => {
    const fila = FILAS.get(args?.where?.id);
    return fila && fila.merchantId === args?.where?.merchantId ? { ...fila } : null;
  },
  'invoice.update': (args) => {
    const fila = FILAS.get(args?.where?.id);
    if (!fila || fila.status !== args?.where?.status) {
      throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
    }
    registro.updates.push(args);
    return { ...fila, ...args.data };
  },
  'merchant.findUnique': (args) => {
    registro.merchants.push(args);
    return args?.where?.id === MERCHANT ? { id: MERCHANT, timezone: 'Europe/Madrid' } : null;
  },
  'auditLog.create': (args) => { registro.auditorias.push(args?.data); return { id: 1 }; },
});

const facturas = moduloDeDist('../dist/modules/system/app/routes/invoicesAdmin.routes.js').default;
const { COPY_FECHA_FUTURA, COPY_FECHA_ILEGIBLE } = moduloDeDist('../dist/modules/billing/domain/fechaDeCobro.js');

const app = express();
app.use(express.json());
app.use('/admin/invoices', (req, _res, next) => {
  Object.assign(req, reqDeSesion({ rol: 'admin', merchantId: MERCHANT }));
  next();
}, facturas);
const servidor = http.createServer(app);
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const PUERTO = servidor.address().port;
test.after(() => servidor.close());

async function marcar(id, cuerpo) {
  registro.updates.length = 0;
  registro.auditorias.length = 0;
  registro.merchants.length = 0;
  const texto = JSON.stringify(cuerpo);
  const callar = console.error; console.error = () => {};
  try {
    return await new Promise((ok, mal) => {
      const req = http.request({
        host: '127.0.0.1', port: PUERTO, path: `/admin/invoices/${id}/status`, method: 'PUT', agent: false,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(texto) },
      }, (res) => {
        let t = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { t += c; });
        res.on('end', () => ok({
          status: res.statusCode, body: t ? JSON.parse(t) : null,
          updates: [...registro.updates], auditorias: [...registro.auditorias], merchants: [...registro.merchants],
        }));
      });
      req.on('error', mal);
      req.end(texto);
    });
  } finally { console.error = callar; }
}

/** Una fecha que es futura en cualquier zona: hoy + 3 días, como `AAAA-MM-DD`. */
const FUTURA = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
const instanteDe = (v) => (v instanceof Date ? v : new Date(v)).toISOString();

// Los nombres van LITERALES (SCRUM-1415): la señal por nombres no puede echar de menos uno construido.
test('SCRUM-1609 · PUT /admin/invoices/:id/status · 🔴 ① con paidAt pasada declarada, guarda ESA fecha y la audita como declarada', async () => {
  const r = await marcar(FACTURA, { status: 'paid', paidAt: '2026-03-31' });
  assert.equal(r.status, 200, `responde ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(r.updates.length, 1, 'CIEGO: la base doblada no ha recibido el update');
  assert.equal(instanteDe(r.updates[0].data.paidAt), '2026-03-31T00:00:00.000Z',
    `🔴 la fecha que declaró la persona no es la que se ha escrito: ${instanteDe(r.updates[0].data.paidAt)}`);
  const audit = r.auditorias.find((a) => a.action === 'marcar_pagado_manual');
  assert.ok(audit, 'el marcado manual no ha dejado auditoría');
  assert.equal(audit.meta?.paidAt, '2026-03-31T00:00:00.000Z', 'la auditoría no guarda la fecha escrita');
  assert.equal(audit.meta?.fechaOrigen, 'declarada', 'la auditoría no dice que la fecha la afirmó una persona');
  assert.ok(r.merchants.length > 0 && r.merchants.every((c) => c.where.id === MERCHANT),
    '🔴 la zona no se ha leído, o se ha leído de un merchant que no es el de la sesión');
});

test('SCRUM-1609 · PUT /admin/invoices/:id/status · 🔴 ② con paidAt futura → 400 fecha_futura con el texto de siempre, y la factura no se escribe', async () => {
  const r = await marcar(FACTURA, { status: 'paid', paidAt: FUTURA });
  assert.equal(r.status, 400, `🔴 una fecha futura (${FUTURA}) responde ${r.status}`);
  assert.deepEqual(r.body, { error: 'fecha_futura', message: COPY_FECHA_FUTURA });
  assert.equal(r.updates.length, 0, '🔴 se ha escrito la factura pese al rechazo');
  assert.equal(r.auditorias.length, 0, '🔴 se ha auditado un marcado que no ocurrió');
});

test('SCRUM-1609 · PUT /admin/invoices/:id/status · 🔴 ③ con paidAt ilegible → 400 fecha_ilegible con el texto de siempre, y la factura no se escribe', async () => {
  const r = await marcar(FACTURA, { status: 'paid', paidAt: 'el martes' });
  assert.equal(r.status, 400, `🔴 una fecha ilegible responde ${r.status}`);
  assert.deepEqual(r.body, { error: 'fecha_ilegible', message: COPY_FECHA_ILEGIBLE });
  assert.equal(r.updates.length, 0, '🔴 se ha escrito la factura pese al rechazo');
});

test('SCRUM-1609 · PUT /admin/invoices/:id/status · ④ POSITIVO: sin paidAt, se comporta como hoy (paidAt = el instante del marcado) y no consulta el merchant', async () => {
  const antes = Date.now();
  const r = await marcar(FACTURA, { status: 'paid' });
  const despues = Date.now();
  assert.equal(r.status, 200, `responde ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(r.updates.length, 1, 'CIEGO: la base doblada no ha recibido el update');
  const escrita = new Date(r.updates[0].data.paidAt).getTime();
  assert.ok(escrita >= antes && escrita <= despues, `🔴 sin fecha declarada, paidAt no es el instante del marcado: ${instanteDe(escrita)}`);
  assert.deepEqual(Object.keys(r.updates[0].data).sort(), ['paidAt', 'status'], 'el update escribe campos que antes no escribía');
  assert.equal(r.merchants.length, 0, 'sin fecha declarada, la ruta ha empezado a consultar el merchant');
  const audit = r.auditorias.find((a) => a.action === 'marcar_pagado_manual');
  assert.equal(audit?.meta?.fechaOrigen, 'ahora');
});

test('SCRUM-1609 · PUT /admin/invoices/:id/status · ⑤ CONTROL: la fecha sólo cuenta al marcar pagada — expired con paidAt ilegible no la mira y no toca paidAt', async () => {
  const r = await marcar(FACTURA, { status: 'expired', paidAt: 'el martes' });
  assert.equal(r.status, 200, `responde ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(r.updates.length, 1);
  assert.equal(r.updates[0].data.paidAt, null, 'expired ha escrito una fecha de cobro');
  assert.equal(r.merchants.length, 0);
});

test('SCRUM-1609 · PUT /admin/invoices/:id/status · ⑥ CONTROL regla 2: una factura de OTRO merchant con fecha declarada → 404 y no se escribe', async () => {
  const r = await marcar(DE_OTRO, { status: 'paid', paidAt: '2026-03-31' });
  assert.equal(r.status, 404, `responde ${r.status}`);
  assert.equal(r.updates.length, 0, '🔴 se ha escrito la factura de otro comercio');
});
