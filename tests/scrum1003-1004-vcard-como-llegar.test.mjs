// tests/scrum1003-1004-vcard-como-llegar.test.mjs — SCRUM-1003 + SCRUM-1004
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA FICHA DEL CLIENTE NO DEJABA GUARDAR EL CONTACTO NI ABRIR SU DIRECCIÓN EN EL MAPA
//
// Hallazgo del recorrido POR DENTRO de Contasimple (SCRUM-1002/1003/1004): su ficha trae
// «Descargar vCard» y un mapa; la nuestra, ninguno de los dos. Aquí se mide el EFECTO, no el
// mecanismo del navegador: `construirVCard` es una función PURA a propósito (ver su cabecera en
// `customerDetailView.js`), así que el TEXTO del .vcf se comprueba sin tocar `Blob`/
// `URL.createObjectURL` — el banco de vistas los deja como stub (`_banco-vistas.mjs`: `Blob:
// class {}`), y eso es un límite DECLARADO del banco, no un hueco silencioso.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STATS_VACIAS = { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 };

async function montarFicha(customer) {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => {
      const u = String(url || '');
      if (/\/admin\/customers\/\d+\/detail$/.test(u)) return { customer, quotes: [], invoices: [], events: [], stats: STATS_VACIAS };
      if (/\/admin\/customers\/\d+\/historial$/.test(u)) return { trabajos: [], partesSueltos: [] };
      return { ...customer };
    },
  });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  const r = await pintarVista(banco, 'renderCustomer360View', customer.id);
  assert.equal(r.error, null, `la ficha 360 no montó: ${r.error && r.error.message}`);
  return { banco, r };
}

const CLIENTE_COMPLETO = {
  id: 6003, name: 'Comunidad Sol, Naciente', phone: telefonoDePrueba(1003), mobile: telefonoDePrueba(10032),
  email: 'contacto@ejemplo.test', notes: null, portalToken: null, createdAt: '2026-01-10T00:00:00.000Z',
  waOptOut: false, taxId: null, legalName: null, companyId: null, contactKind: null, tipoDestinatario: null,
  billingPeriodicity: 'NINGUNA', tags: null, internalRef: null,
  billingAddress: 'Calle Sol, 5', billingCity: 'Getafe', billingPostalCode: '28901', billingProvince: 'Madrid', billingCountry: 'ES',
};

const CLIENTE_SIN_NADA = {
  id: 6004, name: 'Cliente QA 1004b', phone: null, mobile: null, email: null, notes: null, portalToken: null,
  createdAt: '2026-01-10T00:00:00.000Z', waOptOut: false, taxId: null, legalName: null, companyId: null,
  contactKind: null, tipoDestinatario: null, billingPeriodicity: 'NINGUNA', tags: null, internalRef: null,
  billingAddress: null, billingCity: null, billingPostalCode: null, billingProvince: null, billingCountry: null,
};

// ═══ SCRUM-1003 · el .vcf, como función pura ═══════════════════════════════════════════════

test('SCRUM-1003 · 🔴 SUELO: `construirVCard`, `nombreDeFicheroVCard` y `hrefAbrirEnMapa` se publican en window', async () => {
  const { banco } = await montarFicha(CLIENTE_COMPLETO); // carga los scripts del panel, incluido customerDetailView.js
  assert.equal(typeof banco.ctx.construirVCard, 'function', '🔴 CIEGO: `construirVCard` no se publicó en window.');
  assert.equal(typeof banco.ctx.nombreDeFicheroVCard, 'function', '🔴 CIEGO: `nombreDeFicheroVCard` no se publicó en window.');
  assert.equal(typeof banco.ctx.hrefAbrirEnMapa, 'function', '🔴 CIEGO: `hrefAbrirEnMapa` (api.js) no se publicó en window.');
});

test('SCRUM-1003 · construirVCard: un cliente completo produce un VCARD 3.0 con los 5 datos que la ficha ya muestra', async () => {
  const { banco } = await montarFicha(CLIENTE_COMPLETO);
  const fn = banco.ctx.construirVCard;
  assert.equal(typeof fn, 'function', '🔴 CIEGO: `construirVCard` no se publicó en window.');
  const v = fn(CLIENTE_COMPLETO);
  assert.match(v, /^BEGIN:VCARD\r\nVERSION:3\.0\r\n/, '🔴 cabecera VCARD 3.0 mal formada.');
  assert.match(v, /FN:Comunidad Sol\\, Naciente/, '🔴 el nombre no viaja escapado (la coma tiene que llevar `\\,`).');
  assert.match(v, new RegExp('TEL;TYPE=WORK,VOICE:' + CLIENTE_COMPLETO.phone));
  assert.match(v, new RegExp('TEL;TYPE=CELL:' + CLIENTE_COMPLETO.mobile));
  assert.match(v, /EMAIL:contacto@ejemplo\.test/);
  assert.match(v, /ADR;TYPE=WORK:;;Calle Sol\\, 5;Getafe;Madrid;28901;ES/, '🔴 la dirección (ADR) no lleva los 5 campos en el orden RFC 6350, o no escapa la coma.');
  assert.match(v, /END:VCARD\r\n$/);
});

test('SCRUM-1003 · 🔴 construirVCard: sin teléfono/móvil/email/dirección, esas líneas NO aparecen (ausente ≠ vacío)', async () => {
  const { banco } = await montarFicha(CLIENTE_SIN_NADA);
  const v = banco.ctx.construirVCard(CLIENTE_SIN_NADA);
  assert.doesNotMatch(v, /TEL;/, '🔴 pinta un TEL sin que el cliente tenga teléfono ni móvil.');
  assert.doesNotMatch(v, /EMAIL:/, '🔴 pinta un EMAIL sin que el cliente tenga email.');
  assert.doesNotMatch(v, /ADR;/, '🔴 pinta un ADR sin que el cliente tenga ningún campo de dirección.');
  assert.match(v, /FN:Cliente QA 1004b/);
});

test('SCRUM-1003 · nombreDeFicheroVCard: quita los caracteres que rompen un nombre de fichero', async () => {
  const { banco } = await montarFicha(CLIENTE_COMPLETO);
  const fn = banco.ctx.nombreDeFicheroVCard;
  assert.equal(fn({ name: 'Bar/Restaurante "El Rincón": 24h' }), 'BarRestaurante El Rincón 24h.vcf');
  assert.equal(fn({ name: '' }), 'cliente.vcf', '🔴 sin nombre, un fallback razonable, no un fichero vacío.');
});

test('SCRUM-1003 · el botón «Guardar en mis contactos» existe en la cabecera y está enganchado', async () => {
  const { r } = await montarFicha(CLIENTE_COMPLETO);
  const boton = r.contenedor.querySelector('#btn-vcard-360');
  assert.ok(boton, '🔴 CIEGO: no encuentro #btn-vcard-360 en la cabecera.');
  assert.match(boton.textContent, /Guardar en mis contactos/, '🔴 el botón no lleva el texto firmado.');
  assert.equal(typeof boton.onclick, 'function', '🔴 el botón no tiene comportamiento enganchado.');
});

// ═══ SCRUM-1004 · «Cómo llegar» ═════════════════════════════════════════════════════════════

test('SCRUM-1004 · con dirección, la cabecera pinta «Cómo llegar» con la MISMA fórmula de Google Maps que el carril del Trabajo', async () => {
  const { r, banco } = await montarFicha(CLIENTE_COMPLETO);
  const enlace = r.contenedor.querySelector('#c360-como-llegar');
  assert.ok(enlace, '🔴 CIEGO: no encuentro #c360-como-llegar.');
  assert.equal(enlace.textContent, 'Cómo llegar', '🔴 el enlace no lleva el texto firmado.');
  assert.equal(enlace.target, '_blank');
  const direccionTexto = 'Calle Sol, 5, 28901, Getafe, Madrid, ES';
  const esperado = banco.ctx.hrefAbrirEnMapa(direccionTexto);
  assert.equal(enlace.href, esperado,
    '🔴 el href de «Cómo llegar» no sale de `hrefAbrirEnMapa` (la misma fórmula que ya usa jobRailBlocks.js).');
  assert.match(enlace.href, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/, '🔴 control independiente: control negativo de la fórmula.');
});

test('SCRUM-1004 · 🔴 sin ningún campo de dirección, NO hay enlace «Cómo llegar» (ausente ≠ vacío)', async () => {
  const { r } = await montarFicha(CLIENTE_SIN_NADA);
  const enlace = r.contenedor.querySelector('#c360-como-llegar');
  assert.equal(enlace, null, '🔴 pinta «Cómo llegar» sin que el cliente tenga dirección.');
});
