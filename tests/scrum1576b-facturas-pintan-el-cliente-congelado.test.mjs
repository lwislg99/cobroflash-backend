// tests/scrum1576b-facturas-pintan-el-cliente-congelado.test.mjs — SCRUM-1576b (carril J1)
//
// UNA FACTURA EMITIDA SE NOMBRA CON EL CLIENTE QUE SE CONGELÓ AL EMITIRLA, TAMBIÉN EN EL PANEL.
//
// Medido por J2 en SCRUM-1576 (c.20246, `docs/master/evidencias/SCRUM-1576/clasificacion.md`, clase
// (a) carril J1): tres lectores de facturas nombraban al cliente con la ficha VIVA, aunque la
// factura guarda su destinatario congelado (`Invoice.customerName` y sus cuatro hermanas, SCRUM-729):
//   · la lista de Facturas (`invoicesView.js`, columna «Cliente»);
//   · la ficha de la factura (`invoiceDetailView.js`, fila «Cliente» de «Datos»);
//   · el paquete de disputa (`GET /admin/invoices/:id/dispute-package`, fila «Cliente»: nombre,
//     teléfono y email).
// Corregir la ficha del cliente reescribía así el destinatario de facturas pasadas en esas tres
// pantallas, mientras el PDF, el XML y los libros (SCRUM-1058c) conservan el congelado.
//
// 🔴 POR LA RUTA MONTADA Y HASTA LA PANTALLA: la lista y la ficha piden su JSON a `dist/app.js`
// arrancado entero con el banco de SCRUM-597 (`_banco-camino-real.mjs`), y ESE JSON es el que se
// le da a la vista cargada en `_banco-vistas.mjs`. La API ya mandaba el congelado: el defecto
// estaba en lo que la pantalla elegía pintar, y un test sólo de la ruta seguiría verde con él.
// ⚠️ EL DOBLE RESPETA `include`/`select`, y las columnas congeladas las escribe
// `congelarDesdeFicha` (la función de la casa), no el test.
//
// Lo que NO cambia y se comprueba: una factura anterior al escritor (las cinco a NULL) sigue
// saliendo con la ficha viva, que es lo mejor que consta (`clienteDelDocumento`).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const app = await montarAppReal();
after(() => app.cerrar());

const MIO = 15762;
const ses = sesionesDe(MIO, { id: 9, role: 'tecnico', merchantId: MIO });
const { congelarDesdeFicha, CAMPOS_CONGELADOS } = require('../dist/modules/invoicing/domain/clienteCongelado.js');

const DIA = new Date('2026-08-10T10:00:00.000Z');
// SCRUM-262 · teléfonos del rango imposible: ninguno puede ser de una persona.
const TEL_AL_EMITIR = telefonoDePrueba(15761);
const TEL_HOY = telefonoDePrueba(15762);
const FICHA_AL_EMITIR = { id: 10, merchantId: MIO, name: 'Fusionado', legalName: 'Fusionado SL', taxId: 'B11111111', email: 'antes@x.test', phone: TEL_AL_EMITIR, notes: null };
const FICHA_CORREGIDA = { ...FICHA_AL_EMITIR, name: 'Principal', legalName: 'Principal SA', taxId: 'B22222222', email: 'hoy@x.test', phone: TEL_HOY };
const SIN_CONGELAR = Object.fromEntries(CAMPOS_CONGELADOS.map((c) => [c, null]));
const merchant = { ...ses.merchant, country: 'ES', taxId: 'B00000000', flags: null, legalName: 'QA SL', address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null };

const factura = (id, number, congelado) => ({
  id, merchantId: MIO, number, createdAt: DIA, paidAt: null, type: 'F1', status: 'paid', total: 121,
  currency: 'EUR', customerId: 10, quoteId: null, chargeId: null, lines: [], tags: [], vfHash: 'h',
  ...(congelado ? congelarDesdeFicha(congelado) : SIN_CONGELAR),
});
const CONGELADA = factura(1, 'F-CONG', FICHA_AL_EMITIR);
const ANTIGUA = factura(2, 'F-ANTIGUA', null);

function proyectar(fila, sel) {
  if (!sel) return { ...fila };
  return Object.fromEntries(Object.keys(sel).filter((k) => sel[k] && k in fila).map((k) => [k, fila[k]]));
}
/** `include`/`select` de las relaciones, como Prisma: sólo llega lo que se pide. */
function conRelaciones(fila, args, ficha) {
  const out = proyectar(fila, args?.select);
  for (const [rel, valor] of [['customer', ficha], ['merchant', merchant]]) {
    const pide = args?.include?.[rel] ?? args?.select?.[rel];
    if (pide) out[rel] = pide === true ? { ...valor } : proyectar(valor, pide.select);
  }
  for (const rel of ['quote', 'charge', 'rectifies']) {
    if (args?.include?.[rel] ?? args?.select?.[rel]) out[rel] = null;
  }
  if (args?.include?.rectifiedBy) out.rectifiedBy = [];
  return out;
}
const programar = (ficha) => bancoDePrisma().programar({
  authSession: ses.tabla,
  merchant: { findUnique: async () => merchant },
  invoice: {
    findMany: async (a) => [CONGELADA, ANTIGUA].map((f) => conRelaciones(f, a, ficha)),
    findFirst: async (a) => {
      const f = [CONGELADA, ANTIGUA].find((x) => x.id === a?.where?.id);
      return f ? conRelaciones(f, a, ficha) : null;
    },
  },
});

async function pedir(ruta, ficha) {
  programar(ficha);
  const r = await app.pedir(ruta, { token: ses.PROPIETARIO });
  assert.equal(r.status, 200, `suelo: ${ruta} → ${r.status} ${String(r.texto).slice(0, 300)}`);
  return r;
}

// ── la lista: la ruta, y su JSON pintado por la vista ─────────────────────────────────────────
async function clientesDeLaLista(ficha) {
  const r = await pedir('/admin/invoices', ficha);
  const json = r.json;
  assert.ok(Array.isArray(json) && json.length === 2, `suelo: la lista no trae las dos facturas: ${String(r.texto).slice(0, 300)}`);
  const banco = cargarDashboard(RAIZ, { datos: (url) => (/\/admin\/invoices(\?|$)/.test(url) ? json : []) });
  assert.deepEqual(banco.fallos, [], '🔴 CIEGO: el dashboard no carga entero en el banco.');
  const v = await pintarVista(banco, 'renderInvoicesView');
  assert.equal(v.error, null, `🔴 CIEGO: la lista revienta al montarse: ${v.error}`);
  const por = new Map();
  for (const tr of todos(v.contenedor).filter((n) => n.tagName === 'TR')) {
    const num = tr.hijos.find((td) => td && td.className === 'cell-id');
    const cli = tr.hijos.find((td) => td && td.className === 'cell-client');
    if (num && cli) por.set(num.textContent, cli.textContent);
  }
  assert.deepEqual([...por.keys()].sort(), ['F-ANTIGUA', 'F-CONG'], '🔴 CIEGO: población de la lista: las dos filas');
  return por;
}

test('SCRUM-1576b · lista · control: con la ficha sin cambiar, la factura congelada sale con su cliente', async () => {
  assert.equal((await clientesDeLaLista(FICHA_AL_EMITIR)).get('F-CONG'), 'Fusionado');
});

test('SCRUM-1576b · lista · 🔴 con la ficha corregida, la factura emitida sigue nombrando al cliente congelado', async () => {
  assert.equal((await clientesDeLaLista(FICHA_CORREGIDA)).get('F-CONG'), 'Fusionado',
    '🔴 la lista de Facturas ha renombrado el cliente de una factura emitida con la ficha de HOY.');
});

test('SCRUM-1576b · lista · la factura anterior al escritor sigue con la ficha viva', async () => {
  assert.equal((await clientesDeLaLista(FICHA_CORREGIDA)).get('F-ANTIGUA'), 'Principal');
});

// ── la ficha: la ruta, y su JSON pintado por la vista ─────────────────────────────────────────
async function clienteDeLaFicha(id, ficha) {
  const r = await pedir(`/admin/invoices/${id}`, ficha);
  const json = r.json;
  assert.equal(json?.id, id, `suelo: la ficha no trae la factura ${id}: ${String(r.texto).slice(0, 300)}`);
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.fetch = async (u) => ({ ok: true, json: async () => (new RegExp(`/admin/invoices/${id}$`).test(String(u)) ? json : []) });
  banco.ctx.apiRequest = async () => [];
  const v = await pintarVista(banco, 'renderInvoiceDetailView', id);
  assert.equal(v.error, null, `🔴 CIEGO: la ficha revienta al abrirse: ${v.error && v.error.message}`);
  const nodos = todos(v.contenedor);
  const i = nodos.findIndex((n) => n.tagName === 'DT' && n.textContent === 'Cliente');
  assert.ok(i >= 0, '🔴 CIEGO: la ficha no pinta la fila «Cliente».');
  const dd = nodos.slice(i + 1).find((n) => n.tagName === 'DD');
  assert.ok(dd, '🔴 CIEGO: la fila «Cliente» no tiene valor.');
  return dd.textContent;
}

test('SCRUM-1576b · ficha · control: con la ficha sin cambiar, «Cliente» es el congelado', async () => {
  assert.equal(await clienteDeLaFicha(1, FICHA_AL_EMITIR), 'Fusionado');
});

test('SCRUM-1576b · ficha · 🔴 con la ficha corregida, «Cliente» sigue siendo el congelado', async () => {
  assert.equal(await clienteDeLaFicha(1, FICHA_CORREGIDA), 'Fusionado',
    '🔴 la ficha de la factura ha renombrado su cliente con la ficha de HOY.');
});

test('SCRUM-1576b · ficha · la factura anterior al escritor sigue con la ficha viva', async () => {
  assert.equal(await clienteDeLaFicha(2, FICHA_CORREGIDA), 'Principal');
});

// ── el paquete de disputa: la ruta ES la pantalla (HTML imprimible) ──────────────────────────
async function clienteDelPaquete(id, ficha) {
  const r = await pedir(`/admin/invoices/${id}/dispute-package`, ficha);
  // SCRUM-553 · sin el `>` pegado: la fila se sigue encontrando si alguien le pone una clase.
  const m = /<th\b[^>]*>Cliente<\/th>\s*<td\b[^>]*>([^<]*)<\/td>/.exec(r.texto);
  assert.ok(m, '🔴 CIEGO: el paquete no pinta la fila «Cliente».');
  return m[1].replace(/\s+/g, ' ').trim();
}

test('SCRUM-1576b · disputa · control: con la ficha sin cambiar, «Cliente» lleva nombre, teléfono y email congelados', async () => {
  assert.equal(await clienteDelPaquete(1, FICHA_AL_EMITIR), `Fusionado · ${TEL_AL_EMITIR} antes@x.test`);
});

test('SCRUM-1576b · disputa · 🔴 con la ficha corregida, el paquete sigue con el cliente de la factura', async () => {
  assert.equal(await clienteDelPaquete(1, FICHA_CORREGIDA), `Fusionado · ${TEL_AL_EMITIR} antes@x.test`,
    '🔴 el paquete de disputa —la evidencia que se le da al banco— nombra al cliente con la ficha de HOY.');
});

test('SCRUM-1576b · disputa · la factura anterior al escritor sigue con la ficha viva', async () => {
  assert.equal(await clienteDelPaquete(2, FICHA_CORREGIDA), `Principal · ${TEL_HOY} hoy@x.test`);
});

test('SCRUM-1576b · las tres sólo LEEN: ninguna escritura en el banco', async () => {
  for (const ruta of ['/admin/invoices', '/admin/invoices/1', '/admin/invoices/1/dispute-package']) {
    programar(FICHA_CORREGIDA);
    const r = await app.pedir(ruta, { token: ses.PROPIETARIO });
    assert.equal(r.status, 200, `suelo: ${ruta} → ${r.status}`);
    assert.deepEqual(bancoDePrisma().escrituras, [], `${ruta} escribe`);
  }
});
