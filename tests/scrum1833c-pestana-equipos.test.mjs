// SCRUM-1833c · LA PESTAÑA «EQUIPOS» DE LA FICHA DEL CLIENTE.
//
// El servidor es de SCRUM-1833b (`GET/POST /admin/customers/:id/equipos`, `PUT …/:equipoId`, y
// `DELETE …/:equipoId` con `requireRole('admin')`), y contesta CÓDIGOS, no frases. Aquí, la pantalla
// REAL montada en el banco de vistas (el de SCRUM-1005d): se PULSA la pestaña y se mira qué pinta y qué pide.
//
// Los textos son los FIRMADOS por el fundador en SCRUM-1833 c.22811 (la tabla de c.22798 §3, «tal
// cual»); ficha: docs/microcopy/2026-11-26-SCRUM-1833-equipos-del-cliente.md. Permisos (P4 de c.22811):
// ver, crear y editar, todo el equipo; borrar, solo admin. P5 ❌: la garantía es una FECHA, sin estado.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { constaAprobado } from './_microcopy-aprobada.mjs';
import { medirTexto } from './scrum1773-trinquete-style-en-innerhtml.test.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = 'public/dashboard/js/customerDetailView.js';
const FICHA = 'docs/microcopy/2026-11-26-SCRUM-1833-equipos-del-cliente.md';
const espera = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

// Catálogo del meta-guard (SCRUM-1387 / A3, SCRUM-1731): `aplicarUna` de la casa.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'public/dashboard/js/customerDetailView.js', de: "const puedeBorrarEquipo = window.appUserRole === 'admin';", a: 'const puedeBorrarEquipo = true;',
    cae: 'TÉCNICO: no hay «🗑 Eliminar»' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: 'if (!window.confirm(E.rellenar(T.confirmarBorrar, { nombre }))) return;', a: 'if (false) return;',
    cae: 'ADMIN: «🗑 Eliminar» pregunta' },
];

// ── Los aplicados de c.22811 (tabla de c.22798 §3), copiados de Jira. `{fecha}` y `{nombre}` son los
//    huecos que la propia tabla declara. NO se aplican aquí: «campo sitio» (P3 ❌), «garantía pasada»
//    (P5 ❌), el historial (1833d) y el selector en trabajo/albarán/parte (equipo de Luis).
const FIRMADOS = {
  pestana: 'Equipos',
  nuevo: '+ Nuevo equipo',
  vacio: 'Todavía no hay equipos guardados para este cliente.',
  ejemploTipo: 'Caldera / Aire acondicionado / Cuadro eléctrico',
  ejemploNombre: 'Caldera de la cocina',
  CAMPOS: {
    type: 'Tipo de equipo',
    name: 'Nombre del equipo',
    brand: 'Marca',
    modelName: 'Modelo',
    serialNumber: 'Número de serie',
    installedOn: 'Fecha de instalación',
    warrantyUntil: 'Garantía hasta',
  },
  garantia: 'Garantía hasta {fecha}',
  obligatorios: 'Escribe el tipo y el nombre del equipo.',
  errorCarga: 'No se pudieron cargar los equipos guardados. Inténtalo de nuevo.',
  generico: 'No se ha podido completar la acción. Vuelve a intentarlo.',
  editar: 'Editar',
  eliminar: '🗑 Eliminar',
  guardar: 'Guardar',
  cancelar: 'Cancelar',
  confirmarBorrar: '¿Borrar el equipo "{nombre}"? Los trabajos ligados a él lo perderán de su historial. Esta acción no se puede deshacer.',
};

const CLIENTE = {
  id: 10050, name: 'Cliente QA 1833', phone: null, mobile: null, email: null, notes: null, portalToken: null,
  createdAt: '2026-01-10T00:00:00.000Z', waOptOut: false, taxId: null, tags: null,
};
const STATS = { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 };
const EQUIPOS = [
  { id: 41, customerId: 10050, type: 'Caldera', name: 'Caldera de la cocina', brand: 'Vaillant', modelName: 'ecoTEC plus',
    serialNumber: 'SN-777', installedOn: '2024-03-05', warrantyUntil: '2027-01-01', createdAt: '2026-11-20T10:00:00.000Z', updatedAt: '2026-11-20T10:00:00.000Z' },
  { id: 42, customerId: 10050, type: 'Aire acondicionado', name: 'Split del salón', brand: null, modelName: null,
    serialNumber: null, installedOn: null, warrantyUntil: null, createdAt: '2026-11-21T10:00:00.000Z', updatedAt: '2026-11-21T10:00:00.000Z' },
];

/** La ficha REAL en el banco. `equipos(metodo, u, opts)` contesta las rutas de equipos: `{ status, json }`. */
async function montarFicha({ rol = 'admin', equipos = null, lista = EQUIPOS } = {}) {
  const peticiones = [];
  const confirmaciones = [];
  let respuestaConfirm = true;
  const porDefecto = (metodo) => {
    if (metodo === 'DELETE') return { status: 204, json: null };
    return { status: 200, json: { equipos: lista } };
  };
  const fetch = async (url, opts) => {
    const pu = new URL(String(url), 'http://banco.invalid'); const u = pu.pathname + pu.search;
    const metodo = (opts && opts.method) || 'GET';
    peticiones.push({ u, metodo, opts });
    let r;
    if (/\/admin\/customers\/\d+\/equipos(\/\d+)?$/.test(u)) r = await (equipos || porDefecto)(metodo, u, opts);
    else if (/\/detail$/.test(u)) r = { status: 200, json: { customer: CLIENTE, quotes: [], invoices: [], events: [], stats: STATS } };
    else if (/\/historial/.test(u)) r = { status: 200, json: { trabajos: [], partesSueltos: [] } };
    else if (/\/whatsapp/.test(u)) r = { status: 200, json: { waOptOut: false, mensajes: [] } };
    else if (/\/documentos$/.test(u)) r = { status: 200, json: { documentos: [], limites: {} } };
    else r = { status: 200, json: [] };
    const ok = r.status >= 200 && r.status < 300;
    return { ok, status: r.status, headers: { get: () => 'application/json' }, blob: async () => ({}),
      json: async () => r.json, text: async () => JSON.stringify(r.json) };
  };
  const banco = cargarDashboard(RAIZ, { rol, red: { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch } });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  banco.ctx.confirm = (m) => { confirmaciones.push(m); return respuestaConfirm; };
  const r = await pintarVista(banco, 'renderCustomer360View', CLIENTE.id);
  assert.equal(r.error, null, `la ficha no montó: ${r.error && r.error.message}`);
  await espera();
  const c = r.contenedor;
  const pestanas = () => todos(c).filter((n) => n.tagName === 'BUTTON' && n.dataset && n.dataset.key);
  assert.ok(pestanas().some((b) => b.dataset.key === 'quotes'), '🔴 CIEGO: la ficha no pintó ni sus pestañas de siempre');
  const pestana = () => pestanas().find((b) => b.dataset.key === 'equipos') || null;
  const abrir = async () => { pestana().disparar('click'); await espera(); };
  const filas = () => todos(c).filter((n) => n.tagName === 'LI' && n.dataset && n.dataset.equipo);
  const texto = (n) => [n, ...todos(n)].map((x) => x._texto || '').join(' ');
  const aviso = () => todos(c).find((n) => n.dataset && n.dataset.rol === 'aviso-equipos') || null;
  const deEquipos = () => peticiones.filter((p) => /\/equipos/.test(p.u));
  const confirmar = (v) => { respuestaConfirm = v; };
  return { c, banco, peticiones, deEquipos, confirmaciones, confirmar, pestanas, pestana, abrir, filas, texto, aviso };
}
const avisoVisible = (f) => (f.aviso() && !f.aviso().hidden ? f.aviso().textContent : '');
const botones = (n, accion) => todos(n).filter((x) => x.tagName === 'BUTTON' && x.dataset.accion === accion);

test('SCRUM-1833c · los textos del panel son, byte a byte, los firmados en c.22811 (y uno con una letra cambiada no)', () => {
  const banco = cargarDashboard(RAIZ, { datos: () => [] });
  const E = banco.ctx.equiposCliente;
  assert.ok(E, '🔴 no hay `window.equiposCliente`: la pestaña no existe');
  assert.deepEqual(JSON.parse(JSON.stringify(E.TEXTOS)), FIRMADOS);
  assert.notDeepEqual({ ...FIRMADOS, nuevo: '+ Nuevo equipo.' }, FIRMADOS, 'CIEGO: el detector no distingue una letra');
});

test('SCRUM-1833c · cada texto sin hueco consta en la ficha de c.22811, y uno parecido no', () => {
  const planos = [...Object.values(FIRMADOS).filter((t) => typeof t === 'string'), ...Object.values(FIRMADOS.CAMPOS)];
  const sinHueco = planos.filter((t) => !/{[^}]+}/.test(t));
  assert.equal(sinHueco.length, 19, `esperaba 19 textos sin hueco y veo ${sinHueco.length}`);
  for (const t of sinHueco) assert.ok(constaAprobado(t).includes(FICHA), `🔴 «${t}» no consta en ${FICHA}`);
  assert.deepEqual(constaAprobado('Todavía no hay equipos guardados.'), [], 'CONTROL NEGATIVO: uno parecido no consta');
  const md = fs.readFileSync(path.join(RAIZ, FICHA), 'utf8');
  for (const t of planos) assert.ok(md.includes(t), `🔴 «${t}» no está literal en la ficha`);
  assert.match(md, /SCRUM-1833 c\.22811/);
});

test('SCRUM-1833c · la fecha `YYYY-MM-DD` se pinta en el día que dice, con el formato de la ficha (no la medianoche UTC)', () => {
  const banco = cargarDashboard(RAIZ, { datos: () => [] });
  const E = banco.ctx.equiposCliente;
  assert.equal(E.fecha('2027-01-01'), new Date(2027, 0, 1).toLocaleDateString('es-ES'));
  assert.equal(E.fecha('2024-03-05'), new Date(2024, 2, 5).toLocaleDateString('es-ES'));
  assert.equal(E.fecha(null), '');
  assert.equal(E.fecha('no-es-fecha'), '');
  assert.equal(E.garantia('2027-01-01'), `Garantía hasta ${new Date(2027, 0, 1).toLocaleDateString('es-ES')}`);
  assert.equal(E.garantia(null), '', 'sin garantía no se pinta nada (P5 ❌: ni estado ni pastilla)');
});

test('SCRUM-1833c · lo que viaja al servidor: recortado, «ausente ≠ vacío» y SIN `customerSiteId` (P3 ❌)', () => {
  const banco = cargarDashboard(RAIZ, { datos: () => [] });
  const E = banco.ctx.equiposCliente;
  const c = JSON.parse(JSON.stringify(E.cuerpo({ type: ' Caldera ', name: ' Cocina ', brand: '', modelName: ' X ', serialNumber: '   ', installedOn: '2024-03-05', warrantyUntil: '' })));
  assert.deepEqual(c, { type: 'Caldera', name: 'Cocina', brand: null, modelName: 'X', serialNumber: null, installedOn: '2024-03-05', warrantyUntil: '' });
  assert.equal('customerSiteId' in c, false);
});

test('SCRUM-1833c · la pestaña va justo después de «Sitios», y al abrirla pinta cada equipo con sus datos y su garantía como fecha', async () => {
  const f = await montarFicha({ rol: 'admin' });
  const claves = f.pestanas().map((b) => b.dataset.key);
  assert.equal(claves[claves.indexOf('sitios') + 1], 'equipos', `orden de pestañas: ${claves.join(',')}`);
  assert.equal(f.pestana().textContent, 'Equipos');
  assert.equal(f.deEquipos().length, 0, 'la lista se pide al ABRIR la pestaña, no al pintar la ficha');
  await f.abrir();
  assert.deepEqual(f.deEquipos().map((p) => `${p.metodo} ${p.u}`), ['GET /admin/customers/10050/equipos']);
  assert.equal(f.filas().length, 2, 'CIEGO: no se pintó la lista');
  const t = f.texto(f.filas()[0]);
  for (const trozo of ['Caldera de la cocina', 'Caldera', 'Vaillant', 'ecoTEC plus', 'SN-777',
    new Date(2024, 2, 5).toLocaleDateString('es-ES'), `Garantía hasta ${new Date(2027, 0, 1).toLocaleDateString('es-ES')}`]) {
    assert.ok(t.includes(trozo), `🔴 la fila no lleva «${trozo}»: ${t}`);
  }
  const t2 = f.texto(f.filas()[1]);
  assert.ok(!t2.includes('Garantía hasta'), `un equipo sin garantía no pinta la línea: ${t2}`);
  assert.equal(todos(f.c).filter((n) => /status-pill/.test(n.className || '')).length, 0, 'P5 ❌: ninguna pastilla de estado');
});

test('SCRUM-1833c · sin equipos, el vacío firmado', async () => {
  const f = await montarFicha({ lista: [] });
  await f.abrir();
  assert.equal(f.filas().length, 0);
  const vacio = todos(f.c).find((n) => n.tagName === 'LI' && /sitios-cliente__vacio/.test(n.className || ''));
  assert.ok(vacio, '🔴 no hay estado vacío');
  assert.equal(vacio.textContent, 'Todavía no hay equipos guardados para este cliente.');
});

test('SCRUM-1833c · TÉCNICO: no hay «🗑 Eliminar» (P4: borrar, solo admin), pero sí ve, crea y edita', async () => {
  const f = await montarFicha({ rol: 'tecnico' });
  assert.ok(f.pestana(), 'el técnico SÍ ve la pestaña');
  await f.abrir();
  assert.equal(f.filas().length, 2, 'CIEGO: el técnico no ve la lista');
  assert.equal(botones(f.c, 'eliminar').length, 0, '🔴 el técnico ve «🗑 Eliminar»: el servidor le daría 403');
  assert.equal(botones(f.c, 'editar').length, 2, 'el técnico SÍ edita');
  assert.equal(botones(f.c, 'nuevo-equipo').length, 1, 'el técnico SÍ crea');
});

test('SCRUM-1833c · ADMIN: «🗑 Eliminar» pregunta con el texto firmado; «no» no borra, «sí» borra ESE equipo', async () => {
  const f = await montarFicha({ rol: 'admin' });
  await f.abrir();
  const boton = botones(f.filas()[0], 'eliminar')[0];
  assert.ok(boton, '🔴 el admin no tiene botón de borrar');
  assert.equal(boton.textContent, '🗑 Eliminar');
  f.confirmar(false);
  boton.disparar('click'); await espera();
  assert.deepEqual(f.confirmaciones, ['¿Borrar el equipo "Caldera de la cocina"? Los trabajos ligados a él lo perderán de su historial. Esta acción no se puede deshacer.']);
  assert.equal(f.deEquipos().filter((p) => p.metodo === 'DELETE').length, 0, '🔴 dijo «no» y se borró');
  f.confirmar(true);
  boton.disparar('click'); await espera();
  assert.deepEqual(f.deEquipos().filter((p) => p.metodo === 'DELETE').map((p) => p.u), ['/admin/customers/10050/equipos/41']);
});

test('SCRUM-1833c · si la lista no carga al abrir, se dice con el texto firmado', async () => {
  const f = await montarFicha({ equipos: async () => ({ status: 500, json: { error: 'internal_error' } }) });
  await f.abrir();
  assert.equal(f.deEquipos().length, 1, 'CIEGO: al abrir no se pidió la lista');
  assert.equal(avisoVisible(f), 'No se pudieron cargar los equipos guardados. Inténtalo de nuevo.');
});

test('SCRUM-1773 · el bloque de la pestaña «Equipos» no escribe `style=` ni `on*=` dentro de una cadena (y el detector lo ve)', () => {
  const txt = fs.readFileSync(path.join(RAIZ, VISTA), 'utf8');
  const ini = txt.indexOf('// SCRUM-1833c · INICIO'); const fin = txt.indexOf('// SCRUM-1833c · FIN');
  assert.ok(ini >= 0 && fin > ini, '🔴 no encuentro las marcas del bloque de SCRUM-1833c');
  const m = medirTexto(VISTA, txt.slice(ini, fin));
  assert.deepEqual({ style: m.style.length, on: m.on.length }, { style: 0, on: 0 });
  const sembrado = medirTexto(VISTA, "x.innerHTML = '<p style=\"color:red\" onclick=\"y()\">a</p>';");
  assert.deepEqual({ style: sembrado.style.length, on: sembrado.on.length }, { style: 1, on: 1 }, 'CIEGO: el detector no ve uno sembrado');
});
