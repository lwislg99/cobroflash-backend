// tests/scrum1144-selector-sitio-guardado.test.mjs — SCRUM-1144 (partido de SCRUM-1014)
//
// Sin gate: lee ficheros y monta el dashboard en el banco. Ni BD, ni red, ni servidor.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ IMPIDE ESTO
//
// El servidor de los sitios del cliente (`GET /admin/customers/:id/sites`, SCRUM-1014) estaba
// construido y desplegado, y ninguna pantalla lo leía. Ahora, bajo el campo libre de la dirección
// de la obra, «Elegir un sitio guardado» abre la lista y, al pulsar uno, escribe su dirección.
//
// LO QUE SE VIGILA NO ES «HAY UN BOTÓN». Es lo que se rompería al meterlo:
//   ① P2/DOC-12: el campo NO se rellena solo. Elegir cliente con sitios y pasar a «Personalizada»
//     lo deja vacío; sólo la pulsación del profesional escribe;
//   ② lo que se escribe es la dirección del sitio en el orden postal y sin comas sueltas, la misma
//     composición que la de facturación;
//   ③ los tres estados con su texto FIRMADO: con sitios, sin sitios, y la carga que falla;
//   ④ la lista es de UN cliente: al cambiar de cliente se cierra;
//   ⑤ en la ficha del Trabajo, el MISMO control, y lo elegido se guarda por el único camino que ya
//     tenía el campo: el `blur`. Elegir no guarda por su cuenta.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { cargarDashboard, pintarVista, todos, datosDeMuestra } from './_banco-vistas.mjs';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const S = require_(path.join(RAIZ, 'public/dashboard/js/sitiosGuardados.js'));

const OLIVOS = { id: 21, name: 'Comunidad Los Olivos', phone: '34000000021', billingAddress: 'C/ Mayor 1', billingCity: 'Sevilla' };
const ORTEGA = { id: 23, name: 'Reformas Ortega', phone: '34000000023' };
const PISO = { id: 7, customerId: 21, name: 'Piso 3ºB', address: 'C/ Feria 12, 3ºB', postalCode: '41003', city: 'Sevilla', province: 'Sevilla', country: null };
const NAVE = { id: 8, customerId: 21, name: 'Nave del polígono', address: null, postalCode: null, city: null, province: null, country: null };

const esperar = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };

/** El editor, con `sitiosDe(idCliente)` sirviendo lo que el servidor devolvería por cliente. */
function banco({ sitiosDe = () => [], falla = false, pedidas = [] } = {}) {
  const datos = (url) => {
    const u = String(url || '');
    const m = u.match(/\/admin\/customers\/(\d+)\/sites/);
    if (m) { pedidas.push(Number(m[1])); return { sitios: sitiosDe(Number(m[1])) }; }
    if (/\/admin\/merchant/.test(u)) return { id: 1, name: 'Fontanería Soler' };
    if (/\/admin\/customers/.test(u)) return [OLIVOS, ORTEGA];
    return datosDeMuestra(u);
  };
  const red = falla ? {
    fetch: async (url) => {
      const u = String(url || '');
      if (/\/sites/.test(u)) {
        pedidas.push(u);
        return { ok: false, status: 500, statusText: 'x', headers: { get: () => 'application/json' }, json: async () => ({ error: 'internal_error' }) };
      }
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => datos(u), blob: async () => ({}), text: async () => '' };
    },
  } : undefined;
  return cargarDashboard(RAIZ, { datos, red });
}

const porNombre = (r, tag, name) => todos(r.contenedor).find((n) => n.tagName === tag && n.name === name) || null;
const campoObra = (r) => porNombre(r, 'INPUT', 'shipping_address');
const botonSitios = (r) => todos(r.contenedor).find((n) => n.tagName === 'BUTTON' && n.textContent === S.TEXTOS.boton) || null;
const lista = (r) => todos(r.contenedor).find((n) => n.className === 'sitios-guardados') || null;
const opciones = (r) => todos(lista(r)).filter((n) => n.tagName === 'BUTTON');
const textoDe = (r, clase) => {
  const n = todos(lista(r)).find((x) => String(x.className || '') === clase);
  return n ? n.textContent : null;
};

async function editorEnPersonalizada(b, idCliente = '21') {
  const r = await pintarVista(b, 'renderQuotesView');
  assert.equal(r.error, null, `🔴 el editor ha dejado de montarse: ${r.error && r.error.message}`);
  const cliente = porNombre(r, 'SELECT', 'customer_id');
  cliente.value = idCliente;
  cliente.disparar('change');
  const modo = porNombre(r, 'SELECT', 'shipping_address_mode');
  modo.value = 'personalizada';
  modo.disparar('change');
  await esperar();
  return r;
}

// ═══ LA PIEZA PURA ════════════════════════════════════════════════════════════════════════

test('SCRUM-1144 · la dirección del sitio sale en orden postal y SIN comas sueltas', () => {
  assert.equal(S.componerDireccionSitio(PISO), 'C/ Feria 12, 3ºB, 41003, Sevilla, Sevilla');
  assert.equal(S.componerDireccionSitio({ name: 'x', province: ' Cádiz ' }), 'Cádiz',
    '🔴 con sólo provincia quedan comas colgando, en un papel que lee el cliente.');
  assert.equal(S.componerDireccionSitio(NAVE), null);
  assert.equal(S.componerDireccionSitio(null), null);
});

test('SCRUM-1144 · un sitio sin dirección escribe su NOMBRE; uno sin nada que escribir no se ofrece', () => {
  assert.equal(S.textoParaElCampo(NAVE), 'Nave del polígono');
  assert.equal(S.textoParaElCampo(PISO), 'C/ Feria 12, 3ºB, 41003, Sevilla, Sevilla');
  const vacio = { id: 9, name: '   ' };
  assert.deepEqual(S.sitiosElegibles({ sitios: [PISO, vacio, NAVE] }).map((s) => s.id), [7, 8],
    '🔴 se ofrece un sitio que no escribe nada: sería un botón muerto.');
  assert.deepEqual(S.sitiosElegibles(null), []);
  assert.deepEqual(S.sitiosElegibles({ sitios: 'no' }), []);
});

test('SCRUM-1144 · 🔴 los tres textos son los FIRMADOS, y la firma consta en docs/microcopy/', () => {
  assert.equal(S.TEXTOS.boton, 'Elegir un sitio guardado');
  assert.equal(S.TEXTOS.sinSitios, 'Este cliente no tiene sitios guardados todavía.');
  assert.equal(S.TEXTOS.errorCarga, 'No se pudieron cargar los sitios guardados. Inténtalo de nuevo.');
  // Contra SU ficha, por ticket y ranura (SCRUM-1306): «¿consta en alguna?» diría que sí aunque
  // el texto se hubiera vuelto a firmar distinto.
  const ficha = aprobacionesDeMicrocopy().find((a) => a.ticket === 'SCRUM-1144' && a.ranura === 'selector-sitio-guardado');
  assert.ok(ficha && ficha.aprobada, '🔴 no hay ficha firmada de SCRUM-1144 en docs/microcopy/.');
  for (const [ranura, texto] of Object.entries(S.TEXTOS)) {
    assert.ok(ficha.literales.includes(texto), `🔴 «${texto}» (${ranura}) no está en la ficha de SCRUM-1144.`);
  }
});

// ═══ LA PANTALLA, EN EL BANCO ═════════════════════════════════════════════════════════════

test('SCRUM-1144 · 🔴 SUELO + P2/DOC-12: con «Personalizada» se ve el botón y el campo sigue VACÍO', async () => {
  const pedidas = [];
  const r = await editorEnPersonalizada(banco({ sitiosDe: () => [PISO, NAVE], pedidas }));
  const boton = botonSitios(r);
  assert.ok(boton, '🔴 no hay botón «Elegir un sitio guardado» en el editor.');
  assert.equal(boton.type, 'button', '🔴 dentro de un formulario, un botón sin `type="button"` envía.');
  assert.equal(boton._padre, campoObra(r)._padre, '🔴 el botón no vive con el campo libre: se vería fuera de «Personalizada».');
  assert.equal(campoObra(r).value, '', '🔴 el campo de la obra se ha rellenado SOLO: P2/DOC-12 lo prohíbe.');
  assert.deepEqual(pedidas, [], '🔴 la lista se ha pedido sin que nadie pulse: el sitio se elige, no se precarga.');
  assert.equal(lista(r).hidden, true, '🔴 la lista sale abierta sin pulsar.');
});

test('SCRUM-1144 · pulsar abre la lista del cliente elegido; pulsar un sitio escribe su dirección y cierra', async () => {
  const pedidas = [];
  const r = await editorEnPersonalizada(banco({ sitiosDe: (id) => (id === 21 ? [PISO, NAVE] : []), pedidas }));
  botonSitios(r).click();
  await esperar();
  assert.deepEqual(pedidas, [21], '🔴 no se pidieron los sitios de ESTE cliente.');
  assert.equal(lista(r).hidden, false, '🔴 la lista no se abre.');
  assert.equal(botonSitios(r).getAttribute('aria-expanded'), 'true');
  const ops = opciones(r);
  assert.equal(ops.length, 2);
  assert.equal(todos(ops[0]).find((n) => n.className === 'sitios-guardados__nombre').textContent, 'Piso 3ºB');
  assert.equal(todos(ops[0]).find((n) => n.className === 'sitios-guardados__direccion').textContent,
    'C/ Feria 12, 3ºB, 41003, Sevilla, Sevilla');
  assert.equal(campoObra(r).value, '', '🔴 abrir la lista ya ha escrito algo: sólo escribe ELEGIR un sitio.');

  ops[0].click();
  assert.equal(campoObra(r).value, 'C/ Feria 12, 3ºB, 41003, Sevilla, Sevilla');
  assert.equal(lista(r).hidden, true, '🔴 elegido el sitio, la lista sigue abierta.');
  assert.equal(botonSitios(r).getAttribute('aria-expanded'), 'false');

  // Lo escrito sigue siendo del profesional: se corrige como cualquier texto, y viaja como tal.
  const P = require_(path.join(RAIZ, 'public/dashboard/js/quoteDireccionObra.js'));
  assert.deepEqual(P.direccionParaPayload('personalizada', campoObra(r).value),
    { shippingAddressMode: 'personalizada', shippingAddress: 'C/ Feria 12, 3ºB, 41003, Sevilla, Sevilla' });
});

test('SCRUM-1144 · sin sitios, la lista lo DICE con su texto firmado', async () => {
  const r = await editorEnPersonalizada(banco({ sitiosDe: () => [] }));
  botonSitios(r).click();
  await esperar();
  assert.equal(lista(r).hidden, false);
  assert.equal(textoDe(r, 'sitios-guardados__vacio'), S.TEXTOS.sinSitios);
  assert.equal(opciones(r).length, 0);
});

test('SCRUM-1144 · si la carga falla, se dice AL LADO del botón, y el botón vuelve a servir', async () => {
  const pedidas = [];
  const r = await editorEnPersonalizada(banco({ falla: true, pedidas }));
  botonSitios(r).click();
  await esperar();
  assert.equal(pedidas.length, 1, '🔴 CONTROL: la petición que falla no llegó a salir; esto no mediría el fallo.');
  const aviso = todos(lista(r)).find((n) => n.className === 'sitios-guardados__error');
  assert.ok(aviso, '🔴 la carga falló y la pantalla no dice nada.');
  assert.equal(aviso.textContent, S.TEXTOS.errorCarga,
    '🔴 se pinta otra cosa que el texto firmado (¿el «API 500: internal_error» del servidor?).');
  assert.equal(aviso.getAttribute('role'), 'alert');
  assert.equal(botonSitios(r).disabled, false, '🔴 el botón queda deshabilitado: «Inténtalo de nuevo» sería falso.');
  assert.equal(campoObra(r).value, '');
});

test('SCRUM-1144 · la lista es de UN cliente: al cambiar de cliente se cierra', async () => {
  const r = await editorEnPersonalizada(banco({ sitiosDe: () => [PISO] }));
  botonSitios(r).click();
  await esperar();
  assert.equal(lista(r).hidden, false, '🔴 CONTROL: la lista no llegó a abrirse; lo de abajo mediría nada.');
  const cliente = porNombre(r, 'SELECT', 'customer_id');
  cliente.value = '23';
  cliente.disparar('change');
  assert.equal(lista(r).hidden, true, '🔴 cambió el cliente y siguen a la vista los sitios del anterior.');
  assert.equal(opciones(r).length, 0);
});

// ═══ LA FICHA DEL TRABAJO: el mismo control, y se guarda por el MISMO camino que lo tecleado ═══

function bancoTrabajo({ customer = { id: 21, name: 'Comunidad Los Olivos' }, sitios = [PISO], llamadas = [] } = {}) {
  const job = {
    id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reparación caldera',
    customer, asignados: [], operario: null, albaranes: [], gastos: [], notes: '',
    quote: null, direccion: null, totalAceptado: 0, totalCobrado: 0,
  };
  const b = cargarDashboard(RAIZ);
  b.ctx.apiRequest = async (u, opts) => {
    const url = String(u);
    llamadas.push({ url, metodo: String((opts && opts.method) || 'GET'), body: opts && opts.body });
    if (/\/admin\/customers\/\d+\/sites/.test(url)) return { sitios };
    if (/\/admin\/team/.test(url)) return [];
    if (/\/admin\/merchant/.test(url)) return { name: 'Fontanería Soler' };
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/gastos/.test(url)) return [];
    return job;
  };
  b.ctx.appUserRole = 'admin';
  return b;
}

test('SCRUM-1144 · TRABAJO: elegir un sitio escribe en «Dirección de la obra», y se guarda al SALIR del campo', async () => {
  const llamadas = [];
  const r = await pintarVista(bancoTrabajo({ llamadas }), 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha del Trabajo no monta (${r.error && r.error.message})`);
  const campo = todos(r.contenedor).find((n) => n.id === 'job-direccion');
  assert.ok(campo, '🔴 CIEGO: no está el campo «Dirección de la obra» del Trabajo.');
  const boton = botonSitios(r);
  assert.ok(boton, '🔴 la ficha del Trabajo no ofrece «Elegir un sitio guardado».');
  assert.equal(boton._padre, campo._padre, '🔴 el botón no vive junto al campo de la obra.');
  assert.equal(llamadas.filter((l) => /\/sites/.test(l.url)).length, 0, '🔴 se han pedido los sitios sin pulsar.');

  boton.click();
  await esperar();
  assert.deepEqual(llamadas.filter((l) => /\/sites/.test(l.url)).map((l) => l.url), ['/admin/customers/21/sites']);
  opciones(r)[0].click();
  assert.equal(campo.value, 'C/ Feria 12, 3ºB, 41003, Sevilla, Sevilla');
  assert.equal(llamadas.filter((l) => l.metodo === 'PATCH').length, 0,
    '🔴 elegir ya ha guardado: el camino de guardado es UNO, el `blur` del campo, como al teclear.');

  campo.disparar('blur');
  await esperar();
  const patch = llamadas.filter((l) => l.metodo === 'PATCH');
  assert.equal(patch.length, 1, '🔴 al salir del campo no se guardó el sitio elegido.');
  assert.equal(patch[0].url, '/admin/jobs/42');
  // Por JSON: el cuerpo nace en el contexto del banco (otro `Object.prototype`).
  assert.equal(JSON.stringify(patch[0].body), JSON.stringify({ direccion: 'C/ Feria 12, 3ºB, 41003, Sevilla, Sevilla' }));
});

test('SCRUM-1144 · TRABAJO sin cliente: no hay sitios que ofrecer y el botón no se pinta', async () => {
  const r = await pintarVista(bancoTrabajo({ customer: null }), 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha del Trabajo no monta (${r.error && r.error.message})`);
  assert.ok(todos(r.contenedor).find((n) => n.id === 'job-direccion'), '🔴 CIEGO: no está el campo de la obra.');
  assert.equal(botonSitios(r), null, '🔴 sin cliente se ofrece un botón que no puede listar nada.');
});

test('SCRUM-1144 · la pieza se carga ANTES que la vista, y el service worker la cachea', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');
  const iPieza = html.indexOf('js/sitiosGuardados.js');
  assert.ok(iPieza !== -1, '🔴 `sitiosGuardados.js` no está en index.html: el editor daría error.');
  for (const vista of ['js/quotesView.js', 'js/jobDetailView.js']) {
    const iVista = html.indexOf(vista);
    assert.ok(iVista !== -1, `🔴 CIEGO: ${vista} no está en index.html.`);
    assert.ok(iPieza < iVista, `🔴 \`sitiosGuardados.js\` se carga DESPUÉS de \`${vista}\`.`);
  }
  const sw = fs.readFileSync(path.join(RAIZ, 'public/sw.js'), 'utf8');
  assert.match(sw, /'\/dashboard\/js\/sitiosGuardados\.js'/, '🔴 el service worker no cachea la pieza.');
});
