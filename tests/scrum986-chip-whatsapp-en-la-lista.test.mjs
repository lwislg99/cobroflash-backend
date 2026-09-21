// tests/scrum986-chip-whatsapp-en-la-lista.test.mjs
//
// SCRUM-986 · el estado de WhatsApp (Enviado / Entregado / Leído / No entregado) también en la LISTA
// de presupuestos. Hasta hoy sólo salía dentro del detalle, porque sólo el detalle lo pedía.
//
// Lo que este fichero ata, cada cosa con su motivo:
//   A · UNA consulta por página de ids, no una por presupuesto (`getDeliveryStatusMany`).
//   B · la lista y el detalle cuentan LO MISMO del mismo presupuesto (misma fila «última»), sin
//       cruzar merchants ni tipos de documento.
//   C · si la lectura del chip falla, la lista sale igual — el chip es información añadida.
//   D · la pantalla: la fila enviada lleva el chip; la que no tiene envío, nada; y el chip sale de
//       `waDeliveryChip`, la misma pieza del detalle (no se reescribe un solo rótulo).
//
// Sin base de datos: se sustituye `prisma.whatsAppMessage` por una tabla en memoria que APLICA el
// `where` y el `orderBy` que recibe. Si el código olvida el merchant o ordena al revés, la tabla
// devuelve lo equivocado y el test cae — la sustitución no decide nada por su cuenta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist') + path.sep).href;
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const wa = await import(DIST + 'modules/messaging/domain/whatsappLog.service.js');
const { listQuotesAdmin } = await import(DIST + 'modules/system/quoteAdmin.js');

const t = (iso) => new Date(iso);

// ── La «base»: una tabla en memoria que hace lo que el `where` y el `orderBy` le piden ───────────
function tablaWa(filas) {
  const llamadas = { findMany: [], findFirst: [] };
  const coincide = (f, where) => Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && Array.isArray(v.in)) return v.in.includes(f[k]);
    return f[k] === v;
  });
  const ordenar = (rs, orderBy) => {
    const criterios = [].concat(orderBy || []);
    return rs.slice().sort((a, b) => {
      for (const c of criterios) {
        const [campo, sentido] = Object.entries(c)[0];
        if (a[campo] < b[campo]) return sentido === 'desc' ? 1 : -1;
        if (a[campo] > b[campo]) return sentido === 'desc' ? -1 : 1;
      }
      return 0;
    });
  };
  const proyectar = (f, select) => (select ? Object.fromEntries(Object.keys(select).map((k) => [k, f[k]])) : f);
  return {
    llamadas,
    findMany: async (a) => {
      llamadas.findMany.push(a);
      return ordenar(filas.filter((f) => coincide(f, a.where)), a.orderBy).map((f) => proyectar(f, a.select));
    },
    findFirst: async (a) => {
      llamadas.findFirst.push(a);
      const r = ordenar(filas.filter((f) => coincide(f, a.where)), a.orderBy)[0];
      return r ? proyectar(r, a.select) : null;
    },
  };
}

const fila = (id, merchantId, relatedType, relatedId, status, creado) => ({
  id, merchantId, relatedType, relatedId, status, templateName: 'presupuesto_enviado',
  createdAt: t(creado), updatedAt: t(creado),
});

// Merchant 7. Presupuesto 1: tres envíos DESORDENADOS en el tiempo (el último por fecha es `read`).
// Presupuesto 2: dos envíos del MISMO milisegundo (desempata `id`: gana el 21). Presupuesto 3: sin
// ningún envío. Presupuesto 4: sólo tiene un envío de OTRO merchant (el 9) — para el 7 es «sin envío».
// Y una FACTURA con el mismo número que el presupuesto 3, que no debe colarse como suyo.
const FILAS = [
  fila(10, 7, 'quote', 1, 'queued',    '2026-09-01T09:00:00Z'),
  fila(12, 7, 'quote', 1, 'read',      '2026-09-01T11:00:00Z'),
  fila(11, 7, 'quote', 1, 'delivered', '2026-09-01T10:00:00Z'),
  fila(20, 7, 'quote', 2, 'sent',      '2026-09-02T09:00:00Z'),
  fila(21, 7, 'quote', 2, 'failed',    '2026-09-02T09:00:00Z'),
  fila(30, 9, 'quote', 4, 'read',      '2026-09-03T09:00:00Z'),
  fila(40, 7, 'invoice', 3, 'read',    '2026-09-04T09:00:00Z'),
];

const ORIG = {};
function sustituir(prismaQuote, tabla) {
  for (const k of ['quote', 'whatsAppMessage']) ORIG[k] = moduloPrisma.prisma[k];
  if (prismaQuote) moduloPrisma.prisma.quote = prismaQuote;
  if (tabla) moduloPrisma.prisma.whatsAppMessage = tabla;
}
function restaurar() { for (const k of Object.keys(ORIG)) moduloPrisma.prisma[k] = ORIG[k]; }

const quoteFalso = (id) => ({
  id, quoteNumber: id, customer: { name: `Cliente ${id}`, phone: '34000000001' }, // SCRUM-262: rango imposible (34 0XX)
  createdAt: t('2026-09-05T09:00:00Z'), currency: 'EUR', total: 100 + id, status: 'sent',
  charge: null, internalNotes: null, tags: null,
});
const listaDe = (ids) => ({ findMany: async () => ids.map(quoteFalso) });

// ── A · UNA consulta por página ───────────────────────────────────────────────────────────────────
test('SCRUM-986 · A · una página de 100 presupuestos hace UNA consulta, no cien', async (tt) => {
  tt.after(restaurar);
  const tabla = tablaWa(FILAS);
  sustituir(null, tabla);
  const ids = Array.from({ length: 100 }, (_, i) => i + 1);
  const mapa = await wa.getDeliveryStatusMany(7, 'quote', ids);
  assert.equal(tabla.llamadas.findMany.length, 1, 'una sola lectura para toda la página');
  assert.equal(tabla.llamadas.findFirst.length, 0, 'ninguna lectura por presupuesto');
  assert.deepEqual([...mapa.keys()].sort((a, b) => a - b), [1, 2], 'sólo salen los que tienen envío del 7');
});

test('SCRUM-986 · A · control positivo: el detalle SÍ lee de uno en uno (el instrumento cuenta)', async (tt) => {
  tt.after(restaurar);
  const tabla = tablaWa(FILAS);
  sustituir(null, tabla);
  for (const id of [1, 2, 3]) await wa.getDeliveryStatus(7, 'quote', id);
  assert.equal(tabla.llamadas.findFirst.length, 3, 'una lectura por presupuesto: lo que la lista NO debe hacer');
});

test('SCRUM-986 · A · sin ids no hay consulta', async (tt) => {
  tt.after(restaurar);
  const tabla = tablaWa(FILAS);
  sustituir(null, tabla);
  const mapa = await wa.getDeliveryStatusMany(7, 'quote', []);
  assert.equal(mapa.size, 0);
  assert.equal(tabla.llamadas.findMany.length, 0);
});

// ── B · la lista y el detalle dicen lo mismo ──────────────────────────────────────────────────────
test('SCRUM-986 · B · cada fila de la lista trae lo MISMO que el detalle del mismo presupuesto', async (tt) => {
  tt.after(restaurar);
  sustituir(listaDe([1, 2, 3, 4]), tablaWa(FILAS));
  const lista = await listQuotesAdmin(7);
  assert.equal(lista.length, 4);
  for (const q of lista) {
    const detalle = await wa.getDeliveryStatus(7, 'quote', q.id);
    assert.deepEqual(q.waDelivery, detalle,
      `🔴 el presupuesto ${q.id}: la lista dice ${JSON.stringify(q.waDelivery)} y el detalle ${JSON.stringify(detalle)}`);
  }
  const porId = Object.fromEntries(lista.map((q) => [q.id, q.waDelivery]));
  assert.equal(porId[1].status, 'read', 'el último por FECHA, aunque no sea la última fila insertada');
  assert.equal(porId[2].status, 'failed', 'a igual fecha desempata el id más alto (el 21)');
  assert.equal(porId[3], null, 'sin envío → null → sin chip (la factura 3 no es el presupuesto 3)');
  assert.equal(porId[4], null, 'el envío de OTRO merchant no es de este');
});

// ── C · si el chip falla, la lista sale ───────────────────────────────────────────────────────────
test('SCRUM-986 · C · si la lectura del chip revienta, la lista sale igual y sin chips', async (tt) => {
  tt.after(restaurar);
  const errores = console.error;
  console.error = () => {};
  tt.after(() => { console.error = errores; });
  sustituir(listaDe([1, 2]), { findMany: async () => { throw new Error('conexión caída'); }, findFirst: async () => null });
  const lista = await listQuotesAdmin(7);
  assert.equal(lista.length, 2, 'los presupuestos salen');
  assert.deepEqual(lista.map((q) => q.waDelivery), [null, null]);
});

// ── D · la pantalla ───────────────────────────────────────────────────────────────────────────────
const ENVIOS = { sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'No entregado' };
const filaDeLista = (id, waDelivery) => ({
  id, number: id, customerName: `Cliente ${id}`, customerPhone: null, createdAt: '2026-09-05T09:00:00Z',
  currency: 'EUR', totalAmount: 100 + id, status: 'sent', method: null, chargeId: null, internalNotes: null,
  tags: null, waDelivery,
});
const LISTA_DE_PANTALLA = [
  filaDeLista(1, { status: 'sent', templateName: 'presupuesto_enviado', at: '2026-09-05T10:00:00Z' }),
  filaDeLista(2, { status: 'delivered', templateName: 'presupuesto_enviado', at: '2026-09-05T10:05:00Z' }),
  filaDeLista(3, { status: 'read', templateName: 'presupuesto_enviado', at: '2026-09-05T10:30:00Z' }),
  filaDeLista(4, { status: 'failed', templateName: 'presupuesto_enviado', at: '2026-09-05T10:31:00Z' }),
  filaDeLista(5, null),
];

async function pantallaDeLista(lista) {
  const banco = cargarDashboard(RAIZ, { datos: (ruta) => (String(ruta).startsWith('/admin/quotes') ? lista : {}) });
  const r = await pintarVista(banco, 'renderQuotesListView');
  assert.equal(r.error, null, `la lista no se monta: ${r.error}`);
  const filas = todos(r.contenedor).filter((n) => n.tagName === 'TR' && todos(n).some((h) => h.tagName === 'TD'));
  return { banco, filas };
}
const textoDe = (n) => todos(n).map((h) => h._texto || '').join(' ');

test('SCRUM-986 · D · la fila enviada lleva el chip con su rótulo; la que no, nada', async () => {
  const { banco, filas } = await pantallaDeLista(LISTA_DE_PANTALLA);
  assert.equal(filas.length, 5, `esperaba 5 filas y salieron ${filas.length}`);
  const chipsDe = (f) => todos(f).filter((n) => String(n._html || '').includes('wa-chip'));
  const enviadas = filas.slice(0, 4);
  enviadas.forEach((f, i) => {
    const estado = LISTA_DE_PANTALLA[i].waDelivery.status;
    assert.ok(chipsDe(f).length > 0, `🔴 la fila ${i + 1} (${estado}) no lleva chip`);
    assert.match(textoDe(f) + chipsDe(f).map((n) => n._html).join(' '), new RegExp(`WhatsApp: ${ENVIOS[estado]}`),
      `🔴 la fila ${i + 1}: el rótulo «${ENVIOS[estado]}» no está`);
    assert.ok(f.classList.contains('has-wa'), `la fila ${i + 1} debe llevar la marca que recompone la tarjeta móvil`);
  });
  const sinEnvio = filas[4];
  assert.equal(chipsDe(sinEnvio).length, 0, '🔴 la fila SIN envío no debe pintar chip');
  assert.ok(!sinEnvio.classList.contains('has-wa'), 'la fila sin envío conserva su tarjeta de siempre');
  const todo = filas.map(textoDe).join(' ') + filas.map((f) => todos(f).map((n) => n._html || '').join(' ')).join(' ');
  assert.doesNotMatch(todo, /\b(null|undefined)\b/, '🔴 no sale «null» ni «undefined» en ninguna fila');
  assert.equal(typeof banco.ctx.waDeliveryChip, 'function');
});

test('SCRUM-986 · D · el chip de la lista ES el del detalle: sale de `waDeliveryChip`, no se reescribe', async () => {
  const { banco, filas } = await pantallaDeLista(LISTA_DE_PANTALLA);
  const w = LISTA_DE_PANTALLA[2].waDelivery;
  // La lista pide la variante SIN fecha (medido en navegador: con la fecha el chip mide ~200 px y
  // parte el ID, la fecha y el importe de todas las filas). El detalle no la pide y no cambia.
  const enLista = banco.ctx.waDeliveryChip(w, { sinFecha: true });
  const enDetalle = banco.ctx.waDeliveryChip(w);
  assert.ok(enLista.includes('WhatsApp: Leído') && !enLista.includes('sept'), 'la lista dice «Leído» y no lleva fecha');
  assert.ok(enDetalle.includes('WhatsApp: Leído') && /· \d{2} /.test(enDetalle), '🔴 el detalle conserva su fecha');
  const html = todos(filas[2]).map((n) => n._html || '').join(' ');
  assert.ok(html.includes(enLista), '🔴 el chip de la fila no es el que devuelve `waDeliveryChip`');
  // Y el fuente no inventa rótulos: los cuatro viven en `api.js` y en ningún otro sitio de la lista.
  const fuente = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesListView.js'), 'utf8');
  assert.match(fuente, /waDeliveryChip\s*\(/, 'la lista lee de `waDeliveryChip`');
  for (const rotulo of Object.values(ENVIOS)) {
    assert.ok(!fuente.includes(`'${rotulo}'`) && !fuente.includes(`"${rotulo}"`),
      `🔴 la lista escribe «${rotulo}» a mano: el rótulo vive en \`waDeliveryChip\``);
  }
});

test('SCRUM-986 · D · el arreglo de anchos sólo alcanza a la tabla que lleva una fila con chip, no a las otras que comparten `table--cards-mobile`', () => {
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
  const fuente = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesListView.js'), 'utf8');
  // Y el marcado de la tabla NO cambia (una clase nueva movía el HTML de Presupuestos aunque no hubiera
  // ni un chip, y `guard:lista-trabajos` exige que esa lista salga idéntica a la base salvo lo declarado).
  assert.match(fuente, /table\.className\s*=\s*"table table--cards-mobile";/, 'la tabla conserva su clase de siempre');
  assert.doesNotMatch(fuente, /table--presupuestos/, '🔴 se ha vuelto a añadir una clase a la tabla de presupuestos');
  assert.match(css, /\.table--cards-mobile:has\(tr\.has-wa\) td\.cell-id,\s*\n?\s*\.table--cards-mobile:has\(tr\.has-wa\) td\.cell-amount\s*\{\s*white-space:\s*nowrap/,
    '🔴 el ID y el importe de la lista con chips ya no se protegen de partirse');
  assert.doesNotMatch(css, /\.table--cards-mobile\s+td\.cell-(id|amount|date)\s*\{[^}]*white-space/,
    '🔴 el nowrap se ha puesto en `table--cards-mobile` a secas, que comparten Facturas, Cobros, Albaranes y Trabajos');
});
