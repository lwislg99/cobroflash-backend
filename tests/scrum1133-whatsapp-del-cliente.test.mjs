// SCRUM-1133 · LA FICHA DEL CLIENTE ENSEÑA LOS WHATSAPP QUE SE LE HAN ENVIADO.
//
// `GET /admin/customers/:id/whatsapp` (SCRUM-1062) estaba construido y la sonda AST de SCRUM-1185
// lo daba SIN consumidor. Aquí se monta la ficha REAL (banco de vistas), se PULSA la pestaña y se
// mira qué pinta: la fecha, el documento con el número que el profesional conoce (no el id
// interno), el chip de estado de WA-0b, y nada de lo que no debe salir (el `error` crudo de Meta, en
// inglés, y el nombre interno de la plantilla como texto).
//
// Textos firmados en SCRUM-1133 (registro: docs/microcopy/2026-09-28-SCRUM-1133-whatsapp-del-cliente.md).

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { constaAprobado } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const espera = () => new Promise((r) => setTimeout(r, 30));

const CLIENTE = {
  id: 11330, name: 'Cliente QA 1133', phone: null, mobile: null, email: null, notes: null, portalToken: null,
  createdAt: '2026-01-10T00:00:00.000Z', waOptOut: false, taxId: null, tags: null,
};
// El presupuesto 57 (id interno) es el nº 12 para el profesional; la factura 88, la F-2026-0003.
const QUOTES = [{ id: 57, quoteNumber: 12, createdAt: '2026-09-01T00:00:00.000Z', total: 100, currency: 'EUR', status: 'sent' }];
const INVOICES = [{ id: 88, number: 'F-2026-0003', createdAt: '2026-09-02T00:00:00.000Z', total: 100, currency: 'EUR', status: 'pending' }];
const STATS = { totalQuotes: 1, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 };
const MENSAJES = [
  { id: 902, type: 'template', templateName: 'yaqu_presupuesto_interno', status: 'read', error: null, relatedType: 'quote', relatedId: 57, createdAt: '2026-09-20T10:00:00.000Z' },
  { id: 901, type: 'template', templateName: 'yaqu_factura_interno', status: 'failed', error: '(#131026) Message undeliverable', relatedType: 'invoice', relatedId: 88, createdAt: '2026-09-19T10:00:00.000Z' },
];

/** Monta la ficha. `wa` es la respuesta de /whatsapp: un objeto, 'falla' (lanza), o una función (url) → respuesta. */
async function montarFicha({ rol = 'admin', wa = { waOptOut: false, mensajes: MENSAJES }, cliente = CLIENTE } = {}) {
  const peticiones = [];
  const banco = cargarDashboard(RAIZ, {
    rol,
    datos: (url) => {
      const u = String(url || '');
      peticiones.push(u);
      if (/\/admin\/customers\/\d+\/detail$/.test(u)) return { customer: cliente, quotes: QUOTES, invoices: INVOICES, events: [], stats: STATS };
      if (/\/admin\/customers\/\d+\/historial/.test(u)) return { trabajos: [], partesSueltos: [] };
      if (/\/admin\/customers\/\d+\/whatsapp/.test(u)) {
        if (wa === 'falla') throw new Error('500');
        return typeof wa === 'function' ? wa(u) : wa;
      }
      if (/\/admin\/customers\/\d+$/.test(u)) return { ...cliente };
      return [];
    },
  });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  const r = await pintarVista(banco, 'renderCustomer360View', cliente.id);
  assert.equal(r.error, null, `la ficha no montó: ${r.error && r.error.message}`);
  const c = r.contenedor;
  const pestanas = () => todos(c).filter((n) => n.tagName === 'BUTTON' && n.dataset && n.dataset.key);
  const pestanaWa = () => pestanas().find((b) => b.dataset.key === 'whatsapp') || null;
  assert.ok(pestanas().some((b) => b.dataset.key === 'quotes'), '🔴 CIEGO: la ficha no pintó ni sus pestañas de siempre');
  const abrirWa = async () => { pestanaWa().disparar('click'); await espera(); };
  const filas = () => todos(c).filter((n) => n.tagName === 'TR' && n.dataset && n.dataset.mensaje);
  const texto = (n) => todos(n).map((x) => x._texto || '').join(' ') + ' ' + (n._html || '');
  return { c, peticiones, pestanaWa, abrirWa, filas, texto };
}

test('SCRUM-1133 · 🔴 la ficha tiene la pestaña «WhatsApp (2)», y al pulsarla pinta fecha, documento y estado', async () => {
  const f = await montarFicha();
  assert.ok(f.peticiones.some((u) => /\/admin\/customers\/11330\/whatsapp$/.test(u)), '🔴 la ficha no pide /whatsapp: la ruta sigue sin consumidor');
  assert.ok(f.pestanaWa(), '🔴 no hay pestaña de WhatsApp en la ficha');
  assert.equal(f.pestanaWa().textContent, 'WhatsApp (2)');
  await f.abrirWa();
  const filas = f.filas();
  assert.equal(filas.length, 2, `🔴 esperaba 2 filas de mensajes y veo ${filas.length}`);
  const celdas = filas.map((tr) => tr.hijos.filter((h) => h.tagName === 'TD'));
  assert.equal(celdas[0][0].textContent, new Date(MENSAJES[0].createdAt).toLocaleDateString('es-ES'));
  assert.equal(celdas[0][1].textContent, 'Presupuesto #12', 'el número es el que conoce el profesional, no el id 57');
  assert.equal(celdas[1][1].textContent, 'Factura F-2026-0003');
  const estado0 = f.texto(celdas[0][2]);
  const estado1 = f.texto(celdas[1][2]);
  assert.match(estado0, /WhatsApp: Leído/, `🔴 el estado no es el chip de WA-0b: ${estado0}`);
  assert.match(estado1, /WhatsApp: No entregado/);
});

test('SCRUM-1133 · 🔴 NO se pinta el error crudo de Meta ni el nombre interno de la plantilla como texto', async () => {
  const f = await montarFicha();
  await f.abrirWa();
  const visible = f.filas().map((tr) => todos(tr).map((x) => x._texto || '').join(' ')).join(' ');
  // POSITIVOS con el mismo token (SCRUM-237): el error SÍ viene en la respuesta, y el nombre de la
  // plantilla SÍ llega a la pantalla —en el `title` del chip, como en presupuestos y facturas—. Sin
  // ellos, las dos negaciones de abajo serían verdes aunque el dato nunca hubiera llegado.
  assert.match(MENSAJES[1].error, /131026|undeliverable/i);
  const marcado = f.filas().map((tr) => todos(tr).map((n) => (n.getAttribute && n.getAttribute('title')) || '').join(' ')).join(' ');
  assert.match(marcado, /yaqu_presupuesto_interno|yaqu_factura_interno/, '🔴 CIEGO: el nombre de la plantilla ni llegó a la fila');
  assert.ok(!/131026|undeliverable/i.test(visible), `🔴 se pinta el error crudo de Meta: ${visible}`);
  assert.ok(!/yaqu_presupuesto_interno|yaqu_factura_interno/.test(visible), `🔴 se pinta el nombre interno de la plantilla: ${visible}`);
});

test('SCRUM-1133 · sin documento que case con las listas, el tipo sin número (nunca el id interno)', () => {
  const W = cargarDashboard(RAIZ).ctx.whatsappCliente;
  assert.equal(W.documento({ relatedType: 'quote', relatedId: 999 }, QUOTES, INVOICES, 'Presupuesto'), 'Presupuesto');
  assert.equal(W.documento({ relatedType: 'invoice', relatedId: 999 }, QUOTES, INVOICES, 'Presupuesto'), 'Factura');
  assert.equal(W.documento({ relatedType: 'charge', relatedId: 5 }, QUOTES, INVOICES, 'Presupuesto'), 'Cobro');
  assert.equal(W.documento({ relatedType: null }, QUOTES, INVOICES, 'Presupuesto'), '—');
  assert.equal(W.documento({ relatedType: 'algo-nuevo', relatedId: 1 }, QUOTES, INVOICES, 'Presupuesto'), '—');
});

test('SCRUM-1133 · vacío: «Sin mensajes de WhatsApp» · y la baja del cliente NO se afirma (SCRUM-1262)', async () => {
  // La línea «Se dio de baja de WhatsApp: no se le envían mensajes.» estaba firmada (17448) con una
  // condición: que fuera VERDAD. Medido, no lo es —la baja no corta todos los envíos—, así que no se
  // publica y el hallazgo va a SCRUM-1262. Este caso cae si alguien la vuelve a pintar antes.
  const wa = { waOptOut: true, mensajes: [] };
  const f = await montarFicha({ wa });
  assert.equal(f.pestanaWa().textContent, 'WhatsApp (0)');
  await f.abrirWa();
  const todo = todos(f.c).map((x) => x._texto || '');
  assert.ok(todo.includes('Sin mensajes de WhatsApp'), '🔴 no sale el vacío');
  // POSITIVO con el mismo token: la respuesta SÍ decía que está de baja; si no, la negación no mide.
  assert.equal(wa.waOptOut, true);
  assert.ok(f.peticiones.some((u) => /\/admin\/customers\/11330\/whatsapp$/.test(u)), '🔴 CIEGO: ni se pidió /whatsapp');
  assert.ok(!todo.some((t) => /de baja de WhatsApp|no se le envían/.test(t)),
    '🔴 la ficha AFIRMA que no se le envían mensajes, y es falso mientras SCRUM-1262 siga abierto');
});

test('SCRUM-1133 · con más páginas: «WhatsApp (1+)», y «Ver más mensajes» pide la siguiente con despuesDe', async () => {
  const f = await montarFicha({
    wa: (u) => (/despuesDe=902/.test(u)
      ? { waOptOut: false, mensajes: [MENSAJES[1]] }
      : { waOptOut: false, mensajes: [MENSAJES[0]], siguiente: 902 }),
  });
  assert.equal(f.pestanaWa().textContent, 'WhatsApp (1+)');
  await f.abrirWa();
  const mas = todos(f.c).find((n) => n.tagName === 'BUTTON' && n.textContent === 'Ver más mensajes');
  assert.ok(mas, '🔴 con más páginas no sale «Ver más mensajes»');
  mas.disparar('click');
  await espera();
  assert.ok(f.peticiones.some((u) => /\/whatsapp\?despuesDe=902$/.test(u)), '🔴 no pidió la página siguiente con despuesDe');
  assert.equal(f.pestanaWa().textContent, 'WhatsApp (2)');
  assert.equal(f.filas().length, 2);
});

test('SCRUM-1133 · a un técnico ni se le pide ni se le pinta (la ruta es requireRole(admin))', async () => {
  const f = await montarFicha({ rol: 'tecnico' });
  assert.ok(!f.peticiones.some((u) => /\/whatsapp/.test(u)), '🔴 la ficha del técnico pide /whatsapp: un 403 seguro');
  assert.equal(f.pestanaWa(), null);
});

test('SCRUM-1133 · si /whatsapp falla, la ficha sale entera, sin esa pestaña', async () => {
  const f = await montarFicha({ wa: 'falla' });
  assert.equal(f.pestanaWa(), null);
});

test('SCRUM-1133 · cada texto nuevo consta firmado en SCRUM-1133', () => {
  const T = cargarDashboard(RAIZ).ctx.whatsappCliente.TEXTOS;
  const textos = [T.pestana, T.vacio, ...T.columnas, T.verMas, T.factura, T.cobro, T.sinDocumento];
  for (const t of textos) {
    assert.ok(constaAprobado(t).some((f) => f.includes('SCRUM-1133')), `🔴 «${t}» no consta firmado en SCRUM-1133`);
  }
  assert.deepEqual(constaAprobado('Sin mensajes'), [], 'CONTROL NEGATIVO: uno parecido no consta');
  // La línea de la baja se quedó fuera (SCRUM-1262): ni se pinta ni queda un literal suyo esperando.
  assert.equal(T.baja, undefined, '🔴 vuelve a haber un texto de baja en TEXTOS, y SCRUM-1262 no se ha cerrado');
});
