// tests/scrum1273-archivar-presupuesto.test.mjs — SCRUM-1273
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ARCHIVAR UN PRESUPUESTO: EL VIAJE ENTERO, CON LAS DOS PANTALLAS MONTADAS
//
// La tabla del patrón prometía «Borrar» en cuatro estados y no existía en ningún sitio. Se ARCHIVA
// (c.17511): sólo en `draft`, `rejected` y `expired`; el presupuesto deja de salir en la lista y
// se puede ver y desarchivar. Textos firmados en c.19605.
//
// El servidor de aquí es un DOBLE con estado, escrito contra el contrato aprobado en c.19605
// (la parte de S1): `POST /admin/quotes/:id/archivar` y `/desarchivar`, `GET /admin/quotes` sin
// archivados y con `?archivados=1` sólo ésos, el detalle con `archivedAt`, y un 409 cuyo `message`
// es T10. ⚠️ Lo que este test NO prueba es que la ruta de verdad cumpla ese contrato: eso lo
// prueban los tests de S1 en su PR, y el viaje en yaqu.app.
//
// El viaje: archivar → desaparece de la lista → aparece en «Archivados» → desarchivar → vuelve.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { QUOTE_ACTION_REGISTRY, QUOTE_STATES, QUOTE_ACTION_ROTULOS } = require(path.join(RAIZ, 'public/dashboard/js/quoteActionsRegistry.js'));

const T = {
  confirmar: '¿Archivar este presupuesto? Dejará de salir en tu lista. Podrás desarchivarlo cuando quieras, y si tu cliente llega a aceptarlo volverá a salir.',
  aviso: 'Presupuesto archivado. No sale en tu lista de presupuestos.',
  archivado: 'Presupuesto archivado.',
  desarchivado: 'Presupuesto desarchivado.',
  errorArchivar: 'No se pudo archivar el presupuesto. Inténtalo de nuevo.',
  errorDesarchivar: 'No se pudo desarchivar el presupuesto. Inténtalo de nuevo.',
  vacio: 'No tienes presupuestos archivados.',
  t10: 'Solo se puede archivar un borrador, uno rechazado o uno caducado.',
};
const ARCHIVABLES = ['draft', 'rejected', 'expired'];

/** La ficha que devuelve el detalle. Rango de teléfono IMPOSIBLE: ningún envío llega a nadie. */
const ficha = (q) => ({
  id: q.id, number: q.id, quoteNumber: q.id, revision: 0, numeroConRevision: `P${q.id}`, revisiones: [], vigenteId: q.id,
  status: q.status, archivedAt: q.archivedAt, total: '100.00', currency: 'EUR', payToken: `tok${q.id}`,
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
  customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 1273', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
});

/**
 * El doble del servidor, con estado. `fallo` fuerza la respuesta del próximo POST (409 o 500), para
 * medir los dos caminos de error sin cambiar el estado del presupuesto.
 */
function servidor(presupuestos) {
  const s = { quotes: presupuestos.map((q) => ({ archivedAt: null, ...q })), llamadas: [], fallo: null };
  const responde = (status, cuerpo) => ({
    ok: status >= 200 && status < 300, status, statusText: String(status),
    headers: { get: () => 'application/json' },
    json: async () => cuerpo, text: async () => JSON.stringify(cuerpo), blob: async () => ({}),
  });
  s.fetch = async (url, opts = {}) => {
    const u = new URL(String(url), 'https://yaqu.app');
    const metodo = String(opts.method || 'GET').toUpperCase();
    s.llamadas.push(`${metodo} ${u.pathname}${u.search}`);
    const m = u.pathname.match(/^\/admin\/quotes\/(\d+)(?:\/(archivar|desarchivar))?$/);
    if (u.pathname === '/admin/quotes' && metodo === 'GET') {
      const archivados = u.searchParams.get('archivados') === '1';
      return responde(200, s.quotes
        .filter((q) => (archivados ? q.archivedAt != null : q.archivedAt == null))
        .map((q) => ({ id: q.id, number: q.id, customerName: 'Ana Ruiz', totalAmount: '100.00', currency: 'EUR', status: q.status, createdAt: '2026-10-01T10:00:00.000Z', tags: null })));
    }
    if (m) {
      const q = s.quotes.find((x) => x.id === Number(m[1]));
      if (!q) return responde(404, { error: 'not_found' });
      if (!m[2] && metodo === 'GET') return responde(200, ficha(q));
      if (m[2] && metodo === 'POST') {
        if (s.fallo) { const f = s.fallo; s.fallo = null; return responde(f.status, f.cuerpo); }
        if (m[2] === 'archivar') {
          if (!ARCHIVABLES.includes(q.status)) return responde(409, { error: 'estado_no_archivable', message: T.t10 });
          q.archivedAt = '2026-10-14T09:00:00.000Z';
        } else {
          q.archivedAt = null;
        }
        return responde(200, { ok: true, archivedAt: q.archivedAt });
      }
    }
    return responde(200, []);
  };
  return s;
}

const espera = () => new Promise((r) => setTimeout(r, 15));

function montarBanco(srv, confirmar = () => true, rol = 'admin') {
  const banco = cargarDashboard(RAIZ, { red: { fetch: srv.fetch }, rol });
  assert.deepEqual(banco.fallos, [], '🔴 el dashboard no carga entero en el banco');
  banco.ctx.renderAppView = () => {};
  banco.preguntas = [];
  banco.ctx.confirm = (msg) => { banco.preguntas.push(msg); return confirmar(msg); };
  return banco;
}

async function ficheDe(banco, id) {
  const r = await pintarVista(banco, 'renderQuoteDetailView', id);
  assert.equal(r.error, null, `🔴 la ficha revienta: ${r.error && r.error.message}`);
  await espera();
  const nodos = () => todos(r.contenedor);
  return {
    r, nodos,
    archivar: () => nodos().filter((n) => n.getAttribute && n.getAttribute('data-accion') === 'btnArchivar'),
    desarchivar: () => nodos().filter((n) => n.getAttribute && n.getAttribute('data-archivo') === 'desarchivar'),
    aviso: () => nodos().filter((n) => n.getAttribute && n.getAttribute('data-archivo') === 'aviso'),
    alerta: () => nodos().find((n) => /\balert\b/.test(String(n.className)) && n.getAttribute && !n.getAttribute('data-archivo') && n.style.display === 'block'),
  };
}

async function listaDe(banco, filtro = null) {
  const r = await pintarVista(banco, 'renderQuotesListView');
  assert.equal(r.error, null, `🔴 la lista revienta: ${r.error && r.error.message}`);
  await espera();
  const select = todos(r.contenedor).find((n) => n.tagName === 'SELECT' && n.hijos.some((h) => h.value === 'archivados'));
  assert.ok(select, '🔴 CIEGO: la lista no tiene un selector con la opción «Archivados»');
  if (filtro) { select.value = filtro; select.disparar('change'); await espera(); }
  const nodos = todos(r.contenedor);
  return {
    select,
    ids: nodos.filter((n) => n.className === 'cell-id').map((n) => String(n._html || n.textContent).match(/#(\d+)/)?.[1]).filter(Boolean).map(Number),
    texto: nodos.map((n) => String(n.textContent || '')).join(' | '),
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① LA TABLA
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1273 · la tabla ofrece «Archivar» SÓLO en borrador, rechazado y caducado, y «Borrar» ya no está', () => {
  const fila = QUOTE_ACTION_REGISTRY.find((a) => a.id === 'btnArchivar');
  assert.ok(fila, '🔴 no hay fila `btnArchivar`');
  assert.equal(QUOTE_ACTION_REGISTRY.some((a) => a.id === 'btnBorrar'), false, '🔴 `btnBorrar` sigue en la tabla');
  assert.equal(QUOTE_ACTION_ROTULOS.btnArchivar, 'Archivar');
  for (const e of QUOTE_STATES) {
    assert.equal(fila.destinos[e], ARCHIVABLES.includes(e) ? 'overflow' : 'oculta', `🔴 «Archivar» en «${e}» no es lo decidido en c.17511`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② EL VIAJE
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1273 · 🔴 EL VIAJE: archivar → sale de la lista → está en «Archivados» → desarchivar → vuelve', async () => {
  const srv = servidor([{ id: 1, status: 'draft' }, { id: 2, status: 'sent' }]);
  const banco = montarBanco(srv);

  // Antes: los dos en la lista, ninguno en «Archivados». CONTROL: la lista ve filas.
  let l = await listaDe(banco);
  assert.deepEqual(l.ids.sort(), [1, 2], '🔴 CIEGO: la lista de partida no enseña los dos presupuestos');
  l = await listaDe(banco, 'archivados');
  assert.deepEqual(l.ids, [], 'antes de archivar, «Archivados» está vacío');
  assert.ok(l.texto.includes(T.vacio), '🔴 «Archivados» vacío no dice T9');
  assert.ok(srv.llamadas.includes('GET /admin/quotes?archivados=1'), '🔴 «Archivados» no se pide con `?archivados=1`');
  assert.equal(srv.llamadas.some((c) => /status=archivados/.test(c)), false, '🔴 «Archivados» viajó como un estado');

  // Archivar desde la ficha.
  let f = await ficheDe(banco, 1);
  assert.equal(f.archivar().length, 1, '🔴 un borrador sin archivar no ofrece «Archivar»');
  assert.equal(f.archivar()[0].textContent, 'Archivar');
  assert.equal(f.aviso().length, 0, 'un presupuesto sin archivar no lleva el aviso');
  f.archivar()[0].click();
  await espera();
  assert.deepEqual(banco.preguntas, [T.confirmar], '🔴 archivar no pide la confirmación firmada (T2)');
  assert.ok(srv.llamadas.includes('POST /admin/quotes/1/archivar'), '🔴 no se llamó a la ruta de archivar');
  assert.equal(srv.quotes[0].archivedAt != null, true, '🔴 el servidor no quedó archivado');
  assert.equal(f.alerta() && f.alerta().textContent, T.archivado, '🔴 no se dice T5 al archivar');
  assert.equal(f.archivar().length, 0, '🔴 ya archivado, sigue ofreciendo «Archivar»');
  assert.equal(f.aviso().length, 1, '🔴 la ficha de un archivado no lleva el aviso');
  assert.ok(String(f.aviso()[0].hijos[0].textContent) === T.aviso, '🔴 el aviso no es T3');
  assert.equal(f.desarchivar().length, 1, '🔴 la ficha de un archivado no ofrece «Desarchivar»');

  // Sale de la lista y está en «Archivados».
  l = await listaDe(banco);
  assert.deepEqual(l.ids, [2], '🔴 el archivado sigue en la lista, o se llevó al otro');
  l = await listaDe(banco, 'archivados');
  assert.deepEqual(l.ids, [1], '🔴 el archivado no está en «Archivados»');

  // Desarchivar: lo dice el dato del servidor, no el aviso.
  f = await ficheDe(banco, 1);
  assert.equal(f.aviso().length, 1, '🔴 al volver a abrirla, la ficha no sabe que está archivado (lee `archivedAt`)');
  f.desarchivar()[0].click();
  await espera();
  assert.ok(srv.llamadas.includes('POST /admin/quotes/1/desarchivar'), '🔴 no se llamó a la ruta de desarchivar');
  assert.equal(srv.quotes[0].archivedAt, null, '🔴 el servidor sigue archivado');
  assert.equal(f.alerta() && f.alerta().textContent, T.desarchivado, '🔴 no se dice T6 al desarchivar');
  assert.equal(f.aviso().length, 0, '🔴 desarchivado, el aviso sigue');
  assert.equal(f.archivar().length, 1, '🔴 desarchivado, no vuelve a ofrecer «Archivar»');
  assert.equal(banco.preguntas.length, 1, 'desarchivar no pide confirmación: se deshace solo');

  l = await listaDe(banco);
  assert.deepEqual(l.ids.sort(), [1, 2], '🔴 desarchivado, no vuelve a la lista');
  l = await listaDe(banco, 'archivados');
  assert.deepEqual(l.ids, [], '🔴 desarchivado, sigue en «Archivados»');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ TABLA = PANTALLA, en los seis estados
// ═════════════════════════════════════════════════════════════════════════════════════════════

const ESTADOS_ESCRITOS = ['draft', 'pending_approval', 'sent', 'accepted', 'rejected', 'expired'];
test('SCRUM-1273 · la lista de estados de este test es la de la tabla', () => {
  assert.deepEqual(ESTADOS_ESCRITOS, QUOTE_STATES, '🔴 la tabla cambió de estados: actualiza los casos escritos');
});
const casoEstado = casosEscritos(ESTADOS_ESCRITOS, (estado) => `SCRUM-1273 · en «${estado}» la ficha ofrece «Archivar» si y sólo si la tabla lo dice`, async (estado) => {
  const srv = servidor([{ id: 1, status: estado }]);
  const f = await ficheDe(montarBanco(srv), 1);
  assert.ok(f.nodos().length > 60, `🔴 CIEGO: la ficha montó ${f.nodos().length} nodos`);
  const enTabla = QUOTE_ACTION_REGISTRY.find((a) => a.id === 'btnArchivar').destinos[estado] !== 'oculta';
  assert.equal(f.archivar().length, enTabla ? 1 : 0, `🔴 en «${estado}» la pantalla y la tabla no coinciden`);
});
test('SCRUM-1273 · en «draft» la ficha ofrece «Archivar» si y sólo si la tabla lo dice', casoEstado(0));
test('SCRUM-1273 · en «pending_approval» la ficha ofrece «Archivar» si y sólo si la tabla lo dice', casoEstado(1));
test('SCRUM-1273 · en «sent» la ficha ofrece «Archivar» si y sólo si la tabla lo dice', casoEstado(2));
test('SCRUM-1273 · en «accepted» la ficha ofrece «Archivar» si y sólo si la tabla lo dice', casoEstado(3));
test('SCRUM-1273 · en «rejected» la ficha ofrece «Archivar» si y sólo si la tabla lo dice', casoEstado(4));
test('SCRUM-1273 · en «expired» la ficha ofrece «Archivar» si y sólo si la tabla lo dice', casoEstado(5));
casoEstado.todos();

test('SCRUM-1273 · un archivado enseña el aviso y «Desarchivar» en cualquier estado (el servidor lo dice, no la tabla)', async () => {
  const srv = servidor([{ id: 1, status: 'accepted', archivedAt: '2026-10-14T09:00:00.000Z' }]);
  const f = await ficheDe(montarBanco(srv), 1);
  assert.equal(f.aviso().length, 1);
  assert.equal(f.desarchivar().length, 1);
  assert.equal(f.archivar().length, 0);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL ROL · las dos rutas son `requireRole('admin')` (c.19655): a otro rol le contestan 403, y su
// pantalla no puede ofrecer un botón que acaba en «Inténtalo de nuevo» (c.19728).
// ═════════════════════════════════════════════════════════════════════════════════════════════

// Los nombres van escritos enteros (SCRUM-1415): uno construido no lo puede contar la tanda.
const casoRolSinArchivo = (rol) => async () => {
  const srv = servidor([{ id: 1, status: 'draft' }, { id: 2, status: 'draft', archivedAt: '2026-10-14T09:00:00.000Z' }]);
  let f = await ficheDe(montarBanco(srv, () => true, rol), 1);
  assert.ok(f.nodos().length > 60, `🔴 CIEGO: la ficha montó ${f.nodos().length} nodos`);
  assert.equal(f.archivar().length, 0, `🔴 a un «${rol}» se le ofrece «Archivar», y la ruta le contesta 403`);
  f = await ficheDe(montarBanco(srv, () => true, rol), 2);
  assert.equal(f.aviso().length, 1, `🔴 a un «${rol}» no se le dice que el presupuesto está archivado`);
  assert.equal(f.desarchivar().length, 0, `🔴 a un «${rol}» se le ofrece «Desarchivar», y la ruta le contesta 403`);
  assert.equal(srv.llamadas.some((c) => c.startsWith('POST')), false);
};
test('SCRUM-1273 · 🔴 a un «tecnico» la ficha NO le ofrece «Archivar» ni «Desarchivar», y el aviso de archivado sí lo ve', casoRolSinArchivo('tecnico'));
test('SCRUM-1273 · 🔴 a un «operario» la ficha NO le ofrece «Archivar» ni «Desarchivar», y el aviso de archivado sí lo ve', casoRolSinArchivo('operario'));

test('SCRUM-1273 · CONTROL: con el MISMO servidor y rol «admin», la ficha sí ofrece los dos', async () => {
  const srv = servidor([{ id: 1, status: 'draft' }, { id: 2, status: 'draft', archivedAt: '2026-10-14T09:00:00.000Z' }]);
  assert.equal((await ficheDe(montarBanco(srv, () => true, 'admin'), 1)).archivar().length, 1);
  assert.equal((await ficheDe(montarBanco(srv, () => true, 'admin'), 2)).desarchivar().length, 1);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ LOS FALLOS
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1273 · si se cancela la confirmación, no se llama al servidor', async () => {
  const srv = servidor([{ id: 1, status: 'draft' }]);
  const banco = montarBanco(srv, () => false);
  const f = await ficheDe(banco, 1);
  f.archivar()[0].click();
  await espera();
  assert.equal(banco.preguntas.length, 1, '🔴 CIEGO: la confirmación no se llegó a pedir');
  assert.equal(srv.llamadas.some((c) => c.startsWith('POST')), false, '🔴 cancelar archivó igual');
  assert.equal(f.archivar().length, 1);
});

test('SCRUM-1273 · el 409 de archivar enseña SU motivo (T10), y el botón sigue ahí', async () => {
  const srv = servidor([{ id: 1, status: 'draft' }]);
  srv.fallo = { status: 409, cuerpo: { error: 'estado_no_archivable', message: T.t10 } };
  const f = await ficheDe(montarBanco(srv), 1);
  f.archivar()[0].click();
  await espera();
  assert.equal(f.alerta() && f.alerta().textContent, T.t10, '🔴 el 409 no enseña el motivo del servidor');
  assert.equal(f.archivar().length, 1);
  assert.equal(f.archivar()[0].disabled, false, '🔴 tras el fallo, el botón se queda deshabilitado');
  assert.equal(f.aviso().length, 0, '🔴 un fallo pintó el aviso de archivado');
});

test('SCRUM-1273 · un fallo SIN frase para una persona dice el texto de la pantalla (T7 y T8), nunca el código', async () => {
  // La regla de la casa es `mensajeParaPersona` (SCRUM-1233): se pinta `data.message` si el
  // servidor lo trae, y si no, el texto aprobado. Aquí se mide la segunda mitad.
  const srv = servidor([{ id: 1, status: 'draft' }, { id: 2, status: 'draft', archivedAt: '2026-10-14T09:00:00.000Z' }]);
  srv.fallo = { status: 500, cuerpo: { error: 'internal_error' } };
  let f = await ficheDe(montarBanco(srv), 1);
  f.archivar()[0].click();
  await espera();
  assert.equal(f.alerta() && f.alerta().textContent, T.errorArchivar, '🔴 un 500 al archivar no dice T7');

  srv.fallo = { status: 500, cuerpo: { error: 'internal_error' } };
  f = await ficheDe(montarBanco(srv), 2);
  f.desarchivar()[0].click();
  await espera();
  assert.equal(f.alerta() && f.alerta().textContent, T.errorDesarchivar, '🔴 un fallo al desarchivar no dice T8');
  assert.equal(f.desarchivar().length, 1);
});
