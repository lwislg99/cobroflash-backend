// SCRUM-1005d · LA PESTAÑA «DOCUMENTOS» DE LA FICHA DEL CLIENTE.
//
// El servidor es de SCRUM-1005b (`GET/POST /admin/customers/:id/documentos`, `GET …/:docId` descarga,
// `DELETE …/:docId` con `requireRole('admin')`), y contesta CÓDIGOS, no frases. Aquí, la pantalla REAL
// montada en el banco de vistas: se PULSA la pestaña, se sube, se borra, y se mira qué pinta y qué pide.
//
// Los 14 textos son los FIRMADOS por el fundador en SCRUM-1005 c.22192, byte a byte (regla 39); ficha:
// docs/microcopy/2026-11-20-SCRUM-1005-documentos-del-cliente.md. Permisos de c.22192: ver y subir,
// todo el equipo; borrar, solo admin. «{mb}» NO se escribe en el panel: sale de `limites` (bytes) que
// trae la lista, y se divide entre 1024·1024 (el caso de 5 MiB lo demuestra: con una cifra escrita a
// mano saldría «10»).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { constaAprobado } from './_microcopy-aprobada.mjs';
import { medirTexto } from './scrum1773-trinquete-style-en-innerhtml.test.mjs';
import { casosEscritos } from './_casos-escritos.mjs'; // SCRUM-1415

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = 'public/dashboard/js/customerDetailView.js';
const FICHA = 'docs/microcopy/2026-11-20-SCRUM-1005-documentos-del-cliente.md';
const espera = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

// Catálogo del meta-guard (SCRUM-1387 / A3, SCRUM-1731): `aplicarUna` de la casa.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'public/dashboard/js/customerDetailView.js', de: "const puedeBorrar = window.appUserRole === 'admin';", a: 'const puedeBorrar = true;',
    cae: 'TÉCNICO: no hay botón de borrar' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: "subido: 'Documento guardado.',", a: "subido: 'Documento guardado',",
    cae: 'los 14 firmados en c.22192' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: 'if (!window.confirm(D.rellenar(T.confirmarBorrar, { nombre }))) return;', a: 'if (false && !window.confirm(D.rellenar(T.confirmarBorrar, { nombre }))) return;',
    cae: 'ADMIN: «🗑 Eliminar» pregunta' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: "    if (file.size === 0) { avisar(T.vacioFichero); input.value = ''; return; }\n", a: '',
    cae: 'ANTES de enviar' },
];

// ── Los 14 de c.22192, copiados de Jira (no de la ficha del orquestador). `{n}`, `{mb}`, `{nombre}`
//    son los huecos que el propio comentario declara. La 10 no tiene pantalla (c.22192: «hoy ninguna
//    pantalla borra clientes»), así que no está en el panel.
const FIRMADOS = {
  pestana: 'Documentos ({n})',
  subir: '+ Subir documento',
  vacio: 'Todavía no hay documentos guardados para este cliente.',
  subiendo: 'Subiendo…',
  subido: 'Documento guardado.',
  formato: 'Solo se pueden subir documentos PDF, JPG o PNG.',
  grande: 'Cada documento puede ocupar como máximo {mb} MB.',
  topeAdmin: 'Este cliente ya tiene {mb} MB en documentos, el máximo. Borra alguno para subir otro.',
  topeTecnico: 'Este cliente ha llegado al máximo de {mb} MB en documentos.',
  descargar: 'Descargar',
  eliminar: '🗑 Eliminar',
  confirmarBorrar: '¿Borrar el documento "{nombre}"? Esta acción no se puede deshacer.',
  ariaElegir: 'Elegir un documento para subir',
  ariaDescargar: 'Descargar {nombre}',
  ariaBorrar: 'Borrar {nombre}',
  vacioFichero: 'Ese fichero está vacío: elige otro.',
  errorCarga: 'No se pudieron cargar los documentos. Inténtalo de nuevo.',
};

const MIB = 1024 * 1024;
const LIMITES = { porFichero: 10 * MIB, porCliente: 100 * MIB };
const CLIENTE = {
  id: 10050, name: 'Cliente QA 1005', phone: null, mobile: null, email: null, notes: null, portalToken: null,
  createdAt: '2026-01-10T00:00:00.000Z', waOptOut: false, taxId: null, tags: null,
};
const STATS = { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 };
const DOCS = [
  { id: 31, fileName: 'contrato.pdf', mime: 'application/pdf', sizeBytes: 2 * MIB, createdAt: '2026-11-19T10:00:00.000Z' },
  { id: 32, fileName: 'plano.png', mime: 'image/png', sizeBytes: 40 * 1024, createdAt: '2026-11-18T10:00:00.000Z' },
];

/**
 * Monta la ficha con un `fetch` de verdad (status y cuerpo). `docs(metodo, url, opts)` contesta las
 * rutas de documentos: devuelve `{ status, json }`. Por defecto, la lista de arriba y 201/204.
 */
async function montarFicha({ rol = 'admin', docs = null, limites = LIMITES, lista = DOCS } = {}) {
  const peticiones = [];
  const confirmaciones = [];
  let respuestaConfirm = true;
  const porDefecto = (metodo) => {
    if (metodo === 'DELETE') return { status: 204, json: null };
    if (metodo === 'POST') return { status: 201, json: { documento: { id: 99, fileName: 'nuevo.pdf', mime: 'application/pdf', sizeBytes: 10, createdAt: '2026-11-20T10:00:00.000Z' } } };
    return { status: 200, json: { documentos: lista, limites } };
  };
  const fetch = async (url, opts) => {
    // La ruta sin el origen, con `URL` y no con una regex de `//` (el censo de SCRUM-700 la contaría como filtro de comentarios).
    const pu = new URL(String(url), 'http://banco.invalid'); const u = pu.pathname + pu.search;
    const metodo = (opts && opts.method) || 'GET';
    peticiones.push({ u, metodo, opts });
    let r;
    if (/\/admin\/customers\/\d+\/documentos(\/\d+)?$/.test(u)) r = await (docs || porDefecto)(metodo, u, opts);
    else if (/\/detail$/.test(u)) r = { status: 200, json: { customer: CLIENTE, quotes: [], invoices: [], events: [], stats: STATS } };
    else if (/\/historial/.test(u)) r = { status: 200, json: { trabajos: [], partesSueltos: [] } };
    else if (/\/whatsapp/.test(u)) r = { status: 200, json: { waOptOut: false, mensajes: [] } };
    else r = { status: 200, json: [] };
    const ok = r.status >= 200 && r.status < 300;
    return { ok, status: r.status, headers: { get: () => 'application/json' }, blob: async () => ({}),
      json: async () => r.json, text: async () => JSON.stringify(r.json) };
  };
  const banco = cargarDashboard(RAIZ, { rol, red: { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch } });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  // El navegador tiene `File` y `Blob`; el banco no los trae, y sin ellos `apiRequest` (api.js,
  // `esCuerpoQueFetchEnvia`) no reconocería el fichero y lo serializaría a «{}». Se le dan los de node.
  banco.ctx.File = File; banco.ctx.Blob = Blob;
  banco.ctx.confirm = (m) => { confirmaciones.push(m); return respuestaConfirm; };
  const r = await pintarVista(banco, 'renderCustomer360View', CLIENTE.id);
  assert.equal(r.error, null, `la ficha no montó: ${r.error && r.error.message}`);
  await espera();
  const c = r.contenedor;
  const pestanas = () => todos(c).filter((n) => n.tagName === 'BUTTON' && n.dataset && n.dataset.key);
  assert.ok(pestanas().some((b) => b.dataset.key === 'quotes'), '🔴 CIEGO: la ficha no pintó ni sus pestañas de siempre');
  const pestana = () => pestanas().find((b) => b.dataset.key === 'documentos') || null;
  const abrir = async () => { pestana().disparar('click'); await espera(); };
  const filas = () => todos(c).filter((n) => n.tagName === 'LI' && n.dataset && n.dataset.documento);
  const texto = (n) => [n, ...todos(n)].map((x) => x._texto || '').join(' ');
  const input = () => todos(c).find((n) => n.tagName === 'INPUT' && n.type === 'file') || null;
  const botonSubir = () => todos(c).find((n) => n.tagName === 'BUTTON' && n.dataset.accion === 'subir') || null;
  const aviso = () => todos(c).find((n) => n.dataset && n.dataset.rol === 'aviso-documentos') || null;
  const estado = () => todos(c).find((n) => n.dataset && n.dataset.rol === 'estado-documentos') || null;
  const deDocs = () => peticiones.filter((p) => /\/documentos/.test(p.u));
  const elegir = async (fichero) => { input().files = [fichero]; input().disparar('change'); await espera(); };
  const confirmar = (v) => { respuestaConfirm = v; };
  return { c, banco, peticiones, deDocs, confirmaciones, confirmar, pestana, abrir, filas, texto, input, botonSubir, aviso, estado, elegir };
}

const fichero = (nombre, bytes, type = 'application/pdf') => {
  const f = new File([new Uint8Array(bytes)], nombre, { type });
  assert.equal(f.size, bytes, 'el File del banco no tiene el tamaño pedido');
  return f;
};
const avisoVisible = (f) => (f.aviso() && !f.aviso().hidden ? f.aviso().textContent : '');

test('SCRUM-1005d · los textos del panel son, byte a byte, los 14 firmados en c.22192 (y uno con una letra cambiada no)', () => {
  const banco = cargarDashboard(RAIZ, { datos: () => [] });
  const D = banco.ctx.documentosCliente;
  assert.ok(D, '🔴 no hay `window.documentosCliente`: la pestaña no existe');
  assert.deepEqual({ ...D.TEXTOS }, FIRMADOS);
  // Positivo SEMBRADO del detector: la misma comparación, con una letra cambiada, tiene que caer.
  assert.notDeepEqual({ ...D.TEXTOS, subido: 'Documento guardado' }, FIRMADOS, 'CIEGO: el detector no distingue una letra');
  assert.equal(D.tituloPestana(2), 'Documentos (2)');
  assert.equal(D.mb(10 * MIB), '10');
  assert.equal(D.mb(5 * MIB), '5');
});

test('SCRUM-1005d · cada texto sin hueco consta en la ficha de c.22192, y uno parecido no', () => {
  const sinHueco = Object.values(FIRMADOS).filter((t) => !/{[^}]+}/.test(t));
  assert.equal(sinHueco.length, 10, `esperaba 10 textos sin hueco y veo ${sinHueco.length}`);
  for (const t of sinHueco) assert.ok(constaAprobado(t).includes(FICHA), `🔴 «${t}» no consta en ${FICHA}`);
  assert.deepEqual(constaAprobado('Todavía no hay documentos guardados.'), [], 'CONTROL NEGATIVO: uno parecido no consta');
  const md = fs.readFileSync(path.join(RAIZ, FICHA), 'utf8');
  for (const t of Object.values(FIRMADOS)) assert.ok(md.includes(t), `🔴 «${t}» no está literal en la ficha`);
  assert.match(md, /SCRUM-1005 c\.22192/);
});

test('SCRUM-1005d · la pestaña dice «Documentos (n)» con el número de la lista, y vacía, el texto firmado', async () => {
  const f = await montarFicha();
  assert.ok(f.pestana(), '🔴 no hay pestaña «Documentos» en la ficha');
  assert.equal(f.pestana().textContent, 'Documentos (2)');
  const v = await montarFicha({ lista: [] });
  assert.equal(v.pestana().textContent, 'Documentos (0)');
  await v.abrir();
  const vacio = todos(v.c).find((n) => n.tagName === 'LI' && n.textContent === FIRMADOS.vacio);
  assert.ok(vacio, '🔴 sin documentos no sale «Todavía no hay documentos guardados para este cliente.»');
});

test('SCRUM-1005d · cada fila: nombre, tamaño, fecha y «Descargar» a la ruta de descarga, con su aria-label', async () => {
  const f = await montarFicha();
  await f.abrir();
  const filas = f.filas();
  assert.deepEqual(filas.map((li) => li.dataset.documento), ['31', '32']);
  assert.match(f.texto(filas[0]), /contrato\.pdf/);
  assert.match(f.texto(filas[0]), /19\/11\/2026/);
  assert.match(f.texto(filas[0]), /2\s?MB/);
  const a = todos(filas[0]).find((n) => n.tagName === 'A');
  assert.ok(a, '🔴 la fila no tiene enlace de descarga');
  assert.equal(a.textContent, 'Descargar');
  assert.equal(a.getAttribute('href'), '/admin/customers/10050/documentos/31');
  assert.equal(a.getAttribute('aria-label'), 'Descargar contrato.pdf');
  assert.ok(a.hasAttribute('download'), 'el enlace descarga (el servidor responde `attachment`)');
});

test('SCRUM-1005d · subir: el botón y la entrada llevan sus textos, y el fichero va en BINARIO con su nombre', async () => {
  let soltar;
  const pendiente = new Promise((r) => { soltar = r; });
  const f = await montarFicha({ docs: async (metodo) => {
    if (metodo === 'POST') { await pendiente; return { status: 201, json: { documento: { id: 99 } } }; }
    return { status: 200, json: { documentos: DOCS, limites: LIMITES } };
  } });
  await f.abrir();
  assert.equal(f.botonSubir().textContent, '+ Subir documento');
  assert.equal(f.input().getAttribute('aria-label'), 'Elegir un documento para subir');
  const pdf = fichero('boletín 3ºB.pdf', 64);
  {
    f.input().files = [pdf];
    f.input().disparar('change');
    await espera();
  }
  assert.equal(f.estado().textContent, 'Subiendo…', '🔴 mientras sube no dice «Subiendo…»');
  soltar();
  await espera();
  const post = f.deDocs().find((p) => p.metodo === 'POST');
  assert.ok(post, '🔴 no se envió nada');
  assert.equal(post.u, '/admin/customers/10050/documentos');
  assert.equal(post.opts.body, pdf, 'el cuerpo es el fichero tal cual, no un JSON');
  assert.equal(post.opts.headers['Content-Type'], 'application/pdf');
  assert.equal(post.opts.headers['X-Nombre-Fichero'], encodeURIComponent('boletín 3ºB.pdf'));
  assert.equal(f.estado().textContent, 'Documento guardado.');
  assert.ok(f.deDocs().filter((p) => p.metodo === 'GET').length >= 2, 'tras subir, la lista se vuelve a pedir');
});

test('SCRUM-1005d · ANTES de enviar: vacío y demasiado grande se dicen sin mandar nada, con {mb} de `limites`', async () => {
  const f = await montarFicha({ limites: { porFichero: 5 * MIB, porCliente: 100 * MIB } });
  await f.abrir();
  await f.elegir(fichero('vacio.pdf', 0));
  assert.equal(avisoVisible(f), 'Ese fichero está vacío: elige otro.');
  await f.elegir(fichero('grande.pdf', 5 * MIB + 1));
  assert.equal(avisoVisible(f), 'Cada documento puede ocupar como máximo 5 MB.', '🔴 {mb} no sale de `limites`');
  assert.equal(f.deDocs().filter((p) => p.metodo === 'POST').length, 0, '🔴 se envió un fichero que la pantalla ya sabía rechazar');
  await f.elegir(fichero('justo.pdf', 5 * MIB));
  assert.equal(f.deDocs().filter((p) => p.metodo === 'POST').length, 1, 'el que cabe justo, sí se envía');
});

const CODIGOS = [
  ['FORMATO_NO_ADMITIDO', 415, 'admin', 'Solo se pueden subir documentos PDF, JPG o PNG.'],
  ['FICHERO_DEMASIADO_GRANDE', 413, 'admin', 'Cada documento puede ocupar como máximo 10 MB.'],
  ['TOPE_DEL_CLIENTE', 409, 'admin', 'Este cliente ya tiene 100 MB en documentos, el máximo. Borra alguno para subir otro.'],
  ['TOPE_DEL_CLIENTE', 409, 'tecnico', 'Este cliente ha llegado al máximo de 100 MB en documentos.'],
  ['FICHERO_VACIO', 400, 'admin', 'Ese fichero está vacío: elige otro.'],
  ['NOMBRE_NO_VALIDO', 400, 'admin', ''],
  ['CUERPO_ILEGIBLE', 400, 'admin', null], // el genérico que ya existe en el panel
];
// SCRUM-1415: un caso por fila con el nombre ESCRITO (la señal por nombres no ve un nombre construido).
const casoCodigo = casosEscritos(CODIGOS,
  ([codigo, , rol]) => `SCRUM-1005d · el servidor contesta ${codigo} (${rol}) → la pantalla pinta su texto firmado`,
  async ([codigo, status, rol, esperado]) => {
    const f = await montarFicha({ rol, docs: async (metodo) => (metodo === 'POST'
      ? { status, json: { error: codigo } } : { status: 200, json: { documentos: DOCS, limites: LIMITES } }) });
    await f.abrir();
    await f.elegir(fichero('x.pdf', 64));
    assert.equal(f.deDocs().filter((p) => p.metodo === 'POST').length, 1, 'CIEGO: no llegó a enviarse');
    const generico = f.banco.ctx.sitiosCliente.TEXTOS.generico;
    assert.equal(avisoVisible(f), esperado === null ? generico : esperado);
    assert.notEqual(f.estado().textContent, 'Documento guardado.');
  });
test('SCRUM-1005d · el servidor contesta FORMATO_NO_ADMITIDO (admin) → la pantalla pinta su texto firmado', casoCodigo(0));
test('SCRUM-1005d · el servidor contesta FICHERO_DEMASIADO_GRANDE (admin) → la pantalla pinta su texto firmado', casoCodigo(1));
test('SCRUM-1005d · el servidor contesta TOPE_DEL_CLIENTE (admin) → la pantalla pinta su texto firmado', casoCodigo(2));
test('SCRUM-1005d · el servidor contesta TOPE_DEL_CLIENTE (tecnico) → la pantalla pinta su texto firmado', casoCodigo(3));
test('SCRUM-1005d · el servidor contesta FICHERO_VACIO (admin) → la pantalla pinta su texto firmado', casoCodigo(4));
test('SCRUM-1005d · el servidor contesta NOMBRE_NO_VALIDO (admin) → la pantalla pinta su texto firmado', casoCodigo(5));
test('SCRUM-1005d · el servidor contesta CUERPO_ILEGIBLE (admin) → la pantalla pinta su texto firmado', casoCodigo(6));
casoCodigo.todos();

test('SCRUM-1005d · TÉCNICO: no hay botón de borrar (c.22192: borrar, solo admin), pero sí descargar y subir', async () => {
  const f = await montarFicha({ rol: 'tecnico' });
  await f.abrir();
  assert.equal(f.filas().length, 2, 'CIEGO: el técnico no ve la lista');
  const borrar = todos(f.c).filter((n) => n.tagName === 'BUTTON' && n.dataset.accion === 'eliminar');
  assert.equal(borrar.length, 0, '🔴 el técnico ve «🗑 Eliminar»: el servidor le daría 403');
  assert.ok(f.botonSubir(), 'el técnico SÍ sube');
  assert.ok(todos(f.filas()[0]).some((n) => n.tagName === 'A'), 'el técnico SÍ descarga');
});

test('SCRUM-1005d · ADMIN: «🗑 Eliminar» pregunta con el texto firmado; «no» no borra, «sí» borra ESE documento', async () => {
  const f = await montarFicha({ rol: 'admin' });
  await f.abrir();
  const boton = todos(f.filas()[0]).find((n) => n.tagName === 'BUTTON' && n.dataset.accion === 'eliminar');
  assert.ok(boton, '🔴 el admin no tiene botón de borrar');
  assert.equal(boton.textContent, '🗑 Eliminar');
  assert.equal(boton.getAttribute('aria-label'), 'Borrar contrato.pdf');
  f.confirmar(false);
  boton.disparar('click'); await espera();
  assert.deepEqual(f.confirmaciones, ['¿Borrar el documento "contrato.pdf"? Esta acción no se puede deshacer.']);
  assert.equal(f.deDocs().filter((p) => p.metodo === 'DELETE').length, 0, '🔴 dijo «no» y se borró');
  f.confirmar(true);
  boton.disparar('click'); await espera();
  assert.deepEqual(f.deDocs().filter((p) => p.metodo === 'DELETE').map((p) => p.u), ['/admin/customers/10050/documentos/31']);
});

test('SCRUM-1005d · si la lista no carga al abrir, se dice con el texto firmado (fila 14)', async () => {
  let veces = 0;
  const f = await montarFicha({ docs: async () => (++veces === 1
    ? { status: 200, json: { documentos: DOCS, limites: LIMITES } } : { status: 500, json: { error: 'internal_error' } }) });
  await f.abrir();
  assert.equal(veces, 2, 'CIEGO: al abrir no se volvió a pedir la lista');
  assert.equal(avisoVisible(f), 'No se pudieron cargar los documentos. Inténtalo de nuevo.');
});

test('SCRUM-1773 · el bloque de la pestaña no escribe `style=` ni `on*=` dentro de una cadena (y el detector lo ve)', () => {
  const txt = fs.readFileSync(path.join(RAIZ, VISTA), 'utf8');
  const ini = txt.indexOf('// SCRUM-1005d · INICIO'); const fin = txt.indexOf('// SCRUM-1005d · FIN');
  assert.ok(ini >= 0 && fin > ini, '🔴 no encuentro las marcas del bloque de SCRUM-1005d');
  const m = medirTexto(VISTA, txt.slice(ini, fin));
  assert.deepEqual({ style: m.style.length, on: m.on.length }, { style: 0, on: 0 });
  const sembrado = medirTexto(VISTA, "x.innerHTML = '<p style=\"color:red\" onclick=\"y()\">a</p>';");
  assert.deepEqual({ style: sembrado.style.length, on: sembrado.on.length }, { style: 1, on: 1 }, 'CIEGO: el detector no ve uno sembrado');
});
