// tests/scrum1033-1034-cabecera-etiquetas-cliente.test.mjs — SCRUM-1033 + SCRUM-1034
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA CABECERA DE LA FICHA 360 NO ENSEÑABA NIF/CIF, DIRECCIÓN, REFERENCIA NI ETIQUETAS
//
// El /detail ya traía `taxId` (SCRUM-983) pero el profesional tenía que abrir «Editar» para
// verlo. Y `tags`, la dirección de facturación y la referencia interna ni siquiera estaban en
// el `select` (eso lo cubre SCRUM-983 · ④). Aquí se mide el EFECTO: lo que la cabecera pinta,
// y que editar las etiquetas desde ahí guarda de verdad.
//
// 🔴 «AUSENTE ≠ VACÍO» en la pantalla también: un cliente casi vacío no pinta chips con
// «null» ni «undefined» escritos — eso sería peor que no pintar nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs'; // SCRUM-262: rango imposible

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CLIENTE_COMPLETO = {
  id: 5033, name: 'Cliente QA 1033', phone: telefonoDePrueba(1033), mobile: null, email: 'qa1033@example.test',
  notes: null, portalToken: null, createdAt: '2026-01-10T00:00:00.000Z', waOptOut: false,
  taxId: '12345678Z', legalName: null, companyId: null, contactKind: null,
  tipoDestinatario: null, billingPeriodicity: 'NINGUNA',
  tags: ['Moroso', 'Urgencias'],
  billingAddress: 'Calle Mayor 3', billingCity: 'Alcalá', billingPostalCode: '28801',
  billingProvince: 'Madrid', billingCountry: 'ES',
  internalRef: 'EXP-2026-118',
};

const CLIENTE_CASI_VACIO = {
  id: 5034, name: 'Cliente QA 1033b', phone: null, mobile: null, email: null,
  notes: null, portalToken: null, createdAt: '2026-01-10T00:00:00.000Z', waOptOut: false,
  taxId: null, legalName: null, companyId: null, contactKind: null,
  tipoDestinatario: null, billingPeriodicity: 'NINGUNA',
  tags: null,
  billingAddress: null, billingCity: null, billingPostalCode: null, billingProvince: null, billingCountry: null,
  internalRef: null,
};

const STATS_VACIAS = { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 };

/** Monta la ficha 360 con el `customer` dado. Las peticiones quedan en `peticiones`. */
async function montarFicha(customer) {
  const peticiones = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opciones) => {
      const u = String(url || '');
      peticiones.push({ url: u, opciones });
      if (/\/admin\/customers\/\d+\/detail$/.test(u)) {
        return { customer, quotes: [], invoices: [], events: [], stats: STATS_VACIAS };
      }
      if (/\/admin\/customers\/\d+\/historial$/.test(u)) return { trabajos: [], partesSueltos: [] };
      if (/\/admin\/customers\/\d+$/.test(u)) return { ...customer };
      return [];
    },
  });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  const r = await pintarVista(banco, 'renderCustomer360View', customer.id);
  assert.equal(r.error, null, `la ficha 360 no montó: ${r.error && r.error.message}`);
  return { banco, r, peticiones };
}

const textoDe = (n) => todos(n).map((x) => x._texto || '').join(' ');

// ═══ ① SUELO ═══════════════════════════════════════════════════════════════════════════

test('SCRUM-1033 · 🔴 SUELO: la ficha 360 monta el bloque #c360-meta', async () => {
  const { r } = await montarFicha(CLIENTE_COMPLETO);
  const meta = r.contenedor.querySelector('#c360-meta');
  assert.ok(meta, '🔴 CIEGO: no encuentro #c360-meta en la ficha 360.');
});

// ═══ ② CLIENTE COMPLETO: los cuatro chips + el aviso del límite ══════════════════════════

test('SCRUM-1033 · con todos los datos, la cabecera pinta NIF/CIF, dirección, referencia y etiquetas', async () => {
  const { r } = await montarFicha(CLIENTE_COMPLETO);
  const meta = r.contenedor.querySelector('#c360-meta');
  const texto = textoDe(meta);

  assert.match(texto, /NIF\/CIF:\s*12345678Z/, '🔴 falta el chip de NIF/CIF.');
  assert.match(texto, /Dirección:.*Calle Mayor 3.*28801.*Alcalá.*Madrid.*ES/,
    '🔴 la dirección no está unida en una sola línea con sus 5 campos.');
  assert.match(texto, /Referencia:\s*EXP-2026-118/, '🔴 falta el chip de referencia interna.');
  assert.match(texto, /Moroso/, '🔴 falta la etiqueta «Moroso».');
  assert.match(texto, /Urgencias/, '🔴 falta la etiqueta «Urgencias».');
  assert.match(texto, /Máximo 20 etiquetas, de hasta 40 caracteres cada una\./,
    '🔴 falta el aviso firmado del límite de etiquetas.');

  // Las etiquetas se pintan con el componente del inventario, no con markup inventado.
  const badges = todos(meta).filter((n) => String(n.className || '').split(/\s+/).includes('badge-slate'));
  assert.ok(badges.length >= 4, `🔴 esperaba al menos 4 chips \`.badge.badge-slate\` (NIF, dirección, referencia, 2 etiquetas); hay ${badges.length}.`);
});

// ═══ ③ CLIENTE CASI VACÍO: ni un chip de más, ni «null»/«undefined» ═════════════════════

test('SCRUM-1033 · 🔴 con un cliente casi vacío, la cabecera NO pinta chips de NIF/dirección/referencia y no escribe «null»/«undefined»', async () => {
  const { r } = await montarFicha(CLIENTE_CASI_VACIO);
  const meta = r.contenedor.querySelector('#c360-meta');
  const texto = textoDe(meta);

  assert.doesNotMatch(texto, /NIF\/CIF/, '🔴 pinta un chip de NIF/CIF sin que el cliente tenga NIF.');
  assert.doesNotMatch(texto, /Dirección:/, '🔴 pinta un chip de Dirección sin que el cliente tenga ninguno de los 5 campos.');
  assert.doesNotMatch(texto, /Referencia:/, '🔴 pinta un chip de Referencia sin que el cliente tenga referencia interna.');
  assert.doesNotMatch(texto, /\bnull\b/i, '🔴 «ausente ≠ vacío» roto: se ve la palabra «null» en la cabecera.');
  assert.doesNotMatch(texto, /\bundefined\b/i, '🔴 «ausente ≠ vacío» roto: se ve la palabra «undefined» en la cabecera.');
  // El aviso del límite y el campo de etiquetas SÍ se pintan siempre: son la parte editable.
  assert.match(texto, /Máximo 20 etiquetas, de hasta 40 caracteres cada una\./,
    '🔴 el aviso del límite tiene que verse también sin ninguna etiqueta todavía.');
});

// ═══ ④ SCRUM-1034 · escribir etiquetas desde la ficha las guarda con PUT /admin/customers/:id ══

test('SCRUM-1034 · 🔴 escribir en el campo de etiquetas dispara un PUT a /admin/customers/:id con {tags:[...]}', async () => {
  const { r, peticiones } = await montarFicha(CLIENTE_CASI_VACIO);
  const meta = r.contenedor.querySelector('#c360-meta');
  const campo = todos(meta).find((n) => n.tagName === 'INPUT' && n.type === 'text');
  assert.ok(campo, '🔴 CIEGO: no encuentro el campo de texto de las etiquetas en #c360-meta.');

  campo.value = 'Comunidad, Administrador';
  campo.disparar('input');
  // El guardado tiene debounce real (1200ms, `etiquetasDelDocumento.js`): se espera de verdad.
  await new Promise((res) => setTimeout(res, 1400));

  const put = peticiones.find((p) => p.opciones?.method === 'PUT' && /\/admin\/customers\/\d+$/.test(p.url));
  assert.ok(put, `🔴 escribir en el campo no produjo un PUT a /admin/customers/:id. Peticiones: ${JSON.stringify(peticiones.map((p) => p.url))}`);
  const body = JSON.parse(put.opciones.body);
  assert.deepEqual(body, { tags: ['Comunidad', 'Administrador'] },
    `🔴 el PUT no manda {tags:[...]} como espera el servidor (SCRUM-580/1034); manda ${JSON.stringify(body)}.`);
});

test('SCRUM-1034 · 🔴 vaciar el campo de etiquetas manda {tags:null}, nunca {tags:[]} (ausente ≠ vacío)', async () => {
  const { r, peticiones } = await montarFicha(CLIENTE_COMPLETO);
  const meta = r.contenedor.querySelector('#c360-meta');
  const campo = todos(meta).find((n) => n.tagName === 'INPUT' && n.type === 'text');
  assert.ok(campo, '🔴 CIEGO: no encuentro el campo de texto de las etiquetas.');

  campo.value = '';
  campo.disparar('input');
  await new Promise((res) => setTimeout(res, 1400));

  const put = peticiones.find((p) => p.opciones?.method === 'PUT' && /\/admin\/customers\/\d+$/.test(p.url));
  assert.ok(put, '🔴 vaciar el campo no produjo ningún PUT.');
  const body = JSON.parse(put.opciones.body);
  assert.deepEqual(body, { tags: null },
    `🔴 vaciar las etiquetas manda ${JSON.stringify(body)} en vez de {tags:null}: un \`IS NOT NULL\` mentiría.`);
});
