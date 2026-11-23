// tests/scrum1787o-enviada-tambien-por-correo.test.mjs — SCRUM-1787o
//
// LA LÍNEA DE PROGRESO DE LA FICHA DE FACTURA (1787b) MARCA «Enviada» TAMBIÉN SI SALIÓ POR CORREO.
//
// El defecto, medido por jv-j1gy en su entrega (SCRUM-1787 c.22312): «Enviada» solo miraba el
// WhatsApp (`waDelivery.status` y `envioDocumento.whatsapp`), así que una factura mandada solo por
// correo salía con «Enviada» como paso actual. El correo de la factura YA deja fila en
// `email_messages` (`email.service.ts`, `relatedType: 'invoice'`); el GET de la ficha la lee y la
// resume en `correoEnviado`. Sin esquema nuevo, sin texto nuevo («Enviada» firmado en c.22303 ③).
//
//   ① la regla (`correoDelDocumentoSalio`): qué estados del embudo cuentan como «salió»;
//   ② el GET /admin/invoices/:id pone `correoEnviado` en la respuesta, leído por la factura;
//   ③ la vista: solo por correo → «Enviada» hecha; sin envíos → actual; por WhatsApp, igual que antes.
//
// Datos de EJEMPLO, ninguno real. Ningún envío.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La vista deja de mirar el correo: vuelve el defecto de c.22312.
    fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: '|| invoice.correoEnviado === true;',
    a: ';',
    cae: 'SCRUM-1787o · ③ enviada SOLO por correo: «Enviada» sale hecha',
  },
  {
    // Un correo que no salió contaría como enviado.
    fichero: 'src/modules/billing/domain/envioDelDocumento.ts',
    de: "const ESTADOS_DE_CORREO_QUE_SALIO = new Set(['aceptado_sin_confirmacion', 'aceptado_sin_identificador', 'entregado', 'reclamado']);",
    a: "const ESTADOS_DE_CORREO_QUE_SALIO = new Set(['aceptado_sin_confirmacion', 'aceptado_sin_identificador', 'entregado', 'reclamado', 'fallo_envio']);",
    cae: 'SCRUM-1787o · ① un correo fallido o rebotado no cuenta como enviado',
  },
];

// ── ① la regla ────────────────────────────────────────────────────────────────────────────────
const dominio = path.join(RAIZ, 'dist', 'modules', 'billing', 'domain', 'envioDelDocumento.js');

test('SCRUM-1787o · ① un correo aceptado o entregado cuenta como enviado', async () => {
  assert.ok(fs.existsSync(dominio), `🔴 CIEGO: falta ${dominio} (¿build?).`);
  const { correoDelDocumentoSalio } = await import(pathToFileURL(dominio).href);
  assert.equal(typeof correoDelDocumentoSalio, 'function', '🔴 no existe correoDelDocumentoSalio.');
  for (const status of ['aceptado_sin_confirmacion', 'aceptado_sin_identificador', 'entregado', 'reclamado']) {
    assert.equal(correoDelDocumentoSalio([{ status }]), true, `🔴 «${status}» no cuenta como enviado.`);
  }
  // Uno bueno entre fallidos basta: el correo salió.
  assert.equal(correoDelDocumentoSalio([{ status: 'fallo_envio' }, { status: 'entregado' }]), true);
});

test('SCRUM-1787o · ① un correo fallido o rebotado no cuenta como enviado', async () => {
  const { correoDelDocumentoSalio } = await import(pathToFileURL(dominio).href);
  assert.equal(correoDelDocumentoSalio([]), false, '🔴 sin filas no hay envío.');
  assert.equal(correoDelDocumentoSalio([{ status: 'fallo_envio' }]), false, '🔴 «fallo_envio» es «no salió».');
  // Igual que el WhatsApp que Meta marca fallido después (envioDelDocumento.ts): no llegó.
  assert.equal(correoDelDocumentoSalio([{ status: 'rebotado' }]), false, '🔴 «rebotado» no llegó.');
  assert.equal(correoDelDocumentoSalio([{ status: 'zz_estado_inventado' }]), false, '🔴 un estado fuera de la lista no cuenta.');
});

// ── ② la respuesta del GET ────────────────────────────────────────────────────────────────────
// Leído del fuente: correr el GET pide base de datos. Se acota al handler de `router.get('/:id'`.
test('SCRUM-1787o · ② el GET de la ficha lleva `correoEnviado`, leído de las filas de ESTA factura', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/system/app/routes/invoicesAdmin.routes.ts'), 'utf8');
  const ini = fuente.indexOf("router.get('/:id', ");
  assert.ok(ini > 0, '🔴 CIEGO: no encuentro el GET /:id.');
  const fin = fuente.indexOf('router.', ini + 10);
  const handler = fuente.slice(ini, fin);
  assert.match(handler, /const correoEnviado = await correoDeLaFacturaSalio\(req\.merchantId!, id\)/, '🔴 el GET no lee el correo de la factura.');
  assert.match(handler, /const cuerpo = \{[^\n]*\bcorreoEnviado\b[^\n]*\};/,'🔴 `correoEnviado` no viaja en la respuesta.');
  const fn = fuente.slice(fuente.indexOf('async function correoDeLaFacturaSalio'));
  assert.ok(fn.length > 0 && fuente.includes('async function correoDeLaFacturaSalio'), '🔴 falta correoDeLaFacturaSalio.');
  const cuerpoFn = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(cuerpoFn, /merchantId/, '🔴 la consulta no filtra por merchantId (regla 2).');
  assert.match(cuerpoFn, /relatedType: 'invoice'/, '🔴 la consulta no se ata a la factura.');
  assert.match(cuerpoFn, /relatedId: invoiceId/, '🔴 la consulta no se ata a ESTA factura.');
  assert.match(cuerpoFn, /correoDelDocumentoSalio\(/, '🔴 la regla no es la de ①.');
});

// ── ③ la vista ────────────────────────────────────────────────────────────────────────────────
const BASE = Object.freeze({
  id: 7, number: 'F-2026-0007', status: 'pending', type: 'F1', total: 133.1, currency: 'EUR',
  createdAt: '2026-11-02T09:00:00.000Z',
  customerName: 'ZZCLIENTE Reformas Ejemplo', customerTaxId: 'B12345678',
  customerPhone: '+34600000000', customerEmail: 'cliente@ejemplo.test',
  customer: { id: 1, name: 'ZZCLIENTE ficha viva' },
  lines: [{ concept: 'ZZCONCEPTO alicatado', qty: 1, price: 100, tax: 0.21 }],
  rectifiedBy: [],
});

async function estadosDelProgreso(cambios = {}) {
  const factura = { ...BASE, ...cambios };
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.fetch = async (u) => ({ ok: true, json: async () => (/\/admin\/invoices\/7$/.test(String(u)) ? factura : []) });
  banco.ctx.apiRequest = async () => [];
  const r = await pintarVista(banco, 'renderInvoiceDetailView', 7);
  assert.equal(r.error, null, `🔴 la ficha revienta: ${r.error && r.error.message}`);
  const pasos = todos(r.contenedor).filter((n) => String(n.className || '').split(/\s+/).includes('j1-prog-paso'));
  assert.equal(pasos.length, 3, `🔴 CIEGO: la línea de progreso tiene ${pasos.length} pasos.`);
  return pasos.map((p) => p.dataset && p.dataset.estado);
}

test('SCRUM-1787o · ③ enviada SOLO por correo: «Enviada» sale hecha', async () => {
  assert.deepEqual(await estadosDelProgreso({ correoEnviado: true }), ['hecho', 'hecho', 'pendiente']);
});

test('SCRUM-1787o · ③ sin ningún envío: «Enviada» sigue siendo el paso actual', async () => {
  assert.deepEqual(await estadosDelProgreso({ correoEnviado: false }), ['hecho', 'actual', 'pendiente']);
  assert.deepEqual(await estadosDelProgreso(), ['hecho', 'actual', 'pendiente'], '🔴 sin el campo (respuesta vieja) no puede salir enviada.');
});

test('SCRUM-1787o · ③ control: por WhatsApp sigue igual que antes', async () => {
  assert.deepEqual(await estadosDelProgreso({ waDelivery: { status: 'delivered' }, correoEnviado: false }), ['hecho', 'hecho', 'pendiente']);
  assert.deepEqual(await estadosDelProgreso({ waDelivery: { status: 'failed' } }), ['hecho', 'actual', 'pendiente']);
});
