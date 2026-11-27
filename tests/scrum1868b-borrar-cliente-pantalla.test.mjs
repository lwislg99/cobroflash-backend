// SCRUM-1868b · «ELIMINAR ESTE CLIENTE»: LA TARJETA AL FINAL DE LA FICHA Y SU MODAL.
//
// El servidor es de SCRUM-1868a y se construye EN PARALELO contra este contrato:
//   GET    /admin/customers/:id/borrado-previa → 200 { bloqueado, motivos, cuenta } · 404
//   DELETE /admin/customers/:id               → 204 · 409 { error, motivos, cuenta } · 404
// Aquí, la pantalla REAL montada en el banco de vistas (el de SCRUM-1005d) con un doble de `fetch`
// que contesta ese contrato: se PULSA y se mira qué pinta y qué pide.
//
// Los textos son los FIRMADOS por el fundador en SCRUM-1868 (descripción, «2-Los textos valen») y el
// toast en SCRUM-1868 c.22850 («1-✅»); la fila «Solicitudes de presupuesto», en c.22867 («1-Ok»);
// ficha: docs/microcopy/2026-11-26-SCRUM-1868-eliminar-cliente.md.
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
const FICHA = 'docs/microcopy/2026-11-26-SCRUM-1868-eliminar-cliente.md';
const espera = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

// Catálogo del meta-guard (SCRUM-1387 / A3, SCRUM-1731): `aplicarUna` de la casa.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'public/dashboard/js/customerDetailView.js', de: '    if (!listo) return;', a: '    // sin cierre',
    cae: 'BLOQUEADO: alerta, «Lo que lo impide» y solo «Cerrar»; pulsar «Eliminar» igualmente no manda el DELETE' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: "if (err && err.status === 409 && B.estado(err.data).tipo === 'bloqueado') { pintar(err.data); return; }", a: '',
    cae: '409 tras pulsar (alguien emitió una factura entre mirar y pulsar) → el modal pasa al bloqueo con el cuerpo del 409' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: "solicitudes: 'Solicitudes de presupuesto', // APROBADO por el fundador el 26-nov-2026 (SCRUM-1868 comentario 22867)", a: '',
    cae: 'al abrir, la previa (GET) pinta lo que se borra con sus cuentas, y «Eliminar» se habilita' },
];

// ── Los firmados, copiados de Jira (SCRUM-1868: descripción, c.22850 y c.22867). `generico` se reusa de la fusión.
const FIRMADOS = {
  tarjetaTitulo: 'Eliminar este cliente',
  tarjetaTexto: 'Se borra su ficha con sus documentos, sus sitios y sus equipos. No se puede deshacer. Si tiene presupuestos o facturas, no se puede eliminar.',
  tarjetaSoloAdmin: 'Solo lo ve el administrador.',
  boton: 'Eliminar cliente',
  titulo: 'Eliminar cliente',
  subtitulo: 'Revisa lo que se borra antes de confirmar',
  seBorra: 'Se borra',
  filaFicha: 'La ficha de {nombre}',
  FILAS: { documentos: 'Documentos adjuntos', sitios: 'Sitios', equipos: 'Equipos', historial: 'Historial de actividad', solicitudes: 'Solicitudes de presupuesto' },
  nota: 'Este cliente no tiene presupuestos ni facturas: por eso se puede eliminar.',
  irreversible: 'Esto no se puede deshacer.',
  cancelar: 'Cancelar',
  confirmar: 'Eliminar',
  bloqueo: 'No se puede eliminar a {nombre}. Tiene {n} facturas emitidas y {m} presupuestos, y una factura emitida no se borra.',
  loImpide: 'Lo que lo impide',
  MOTIVOS: { tiene_facturas: 'Facturas emitidas', tiene_presupuestos: 'Presupuestos' },
  salida: 'Puedes fusionarlo con otro cliente o dejarlo como está.',
  enlaceFusion: 'fusionarlo con otro cliente',
  cerrar: 'Cerrar',
  exito: 'Cliente eliminado',
  generico: 'No se ha podido completar la acción. Vuelve a intentarlo.',
};

const CLIENTE = {
  id: 10068, name: 'Cliente QA 1868', phone: null, mobile: null, email: null, notes: null, portalToken: null,
  createdAt: '2026-01-10T00:00:00.000Z', waOptOut: false, taxId: null, tags: null,
};
const STATS = { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 };
const CUENTA = { documentos: 3, sitios: 2, equipos: 4, historial: 7, solicitudes: 6, presupuestos: 0, facturas: 0 };
const LIBRE = { bloqueado: false, motivos: [], cuenta: CUENTA };
const BLOQUEADO = { bloqueado: true, motivos: ['tiene_facturas', 'tiene_presupuestos'], cuenta: { ...CUENTA, facturas: 2, presupuestos: 5 } };

/** La ficha REAL en el banco. `previa()` y `borrar()` contestan las dos rutas: `{ status, json }`. */
async function montarFicha({ rol = 'admin', previa = () => ({ status: 200, json: LIBRE }), borrar = () => ({ status: 204, json: null }) } = {}) {
  const peticiones = [];
  const toasts = [];
  const vistas = [];
  const fetch = async (url, opts) => {
    const pu = new URL(String(url), 'http://banco.invalid'); const u = pu.pathname + pu.search;
    const metodo = (opts && opts.method) || 'GET';
    peticiones.push({ u, metodo });
    let r;
    if (/\/admin\/customers\/\d+\/borrado-previa$/.test(u)) r = await previa();
    else if (metodo === 'DELETE' && /\/admin\/customers\/\d+$/.test(u)) r = await borrar();
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
  const r = await pintarVista(banco, 'renderCustomer360View', CLIENTE.id);
  assert.equal(r.error, null, `la ficha no montó: ${r.error && r.error.message}`);
  await espera();
  banco.ctx.showToast = (m) => toasts.push(m);
  banco.ctx.renderAppView = (v) => vistas.push(v);
  const c = r.contenedor;
  const pestanas = () => todos(c).filter((n) => n.tagName === 'BUTTON' && n.dataset && n.dataset.key);
  assert.ok(pestanas().some((b) => b.dataset.key === 'quotes'), '🔴 CIEGO: la ficha no pintó ni sus pestañas de siempre');
  const cuerpo = () => todos(banco.ctx.document.body);
  const tarjeta = () => todos(c).find((n) => n.dataset && n.dataset.rol === 'borrar-cliente') || null;
  const modal = () => cuerpo().find((n) => n.dataset && n.dataset.rol === 'modal-borrar-cliente') || null;
  const en = (raiz, accion) => (raiz ? todos(raiz).find((n) => n.dataset && n.dataset.accion === accion) || null : null);
  const texto = (n) => (n ? todos(n).map((x) => x._texto || '').join(' ') : '');
  const abrir = async () => { en(tarjeta(), 'abrir-borrado').disparar('click'); await espera(); };
  const pulsar = async (accion) => { en(modal(), accion).disparar('click'); await espera(); };
  const aviso = () => { const a = modal() && todos(modal()).find((n) => n.dataset && n.dataset.rol === 'aviso-borrar'); return a ? a.textContent : ''; };
  const filas = () => (modal() ? todos(modal()).filter((n) => n.tagName === 'TR').map((tr) => todos(tr).filter((x) => x.tagName === 'TD').map((td) => td.textContent)) : []);
  const de = (re, metodo) => peticiones.filter((p) => re.test(p.u) && p.metodo === metodo);
  const borrados = () => de(/\/admin\/customers\/\d+$/, 'DELETE');
  const previas = () => de(/\/borrado-previa$/, 'GET');
  return { c, banco, cuerpo, tarjeta, modal, en, texto, abrir, pulsar, aviso, filas, borrados, previas, toasts, vistas, pestanas };
}

test('SCRUM-1868b · los textos del panel son, byte a byte, los firmados en SCRUM-1868 (y uno con una letra cambiada no)', () => {
  const banco = cargarDashboard(RAIZ, { datos: () => [] });
  const B = banco.ctx.borrarCliente;
  assert.ok(B, '🔴 no hay `window.borrarCliente`: la tarjeta no existe');
  assert.deepEqual(JSON.parse(JSON.stringify(B.TEXTOS)), FIRMADOS);
  assert.notDeepEqual({ ...FIRMADOS, boton: 'Eliminar cliente.' }, FIRMADOS, 'CIEGO: el detector no distingue una letra');
  assert.equal(B.TEXTOS.generico, banco.ctx.fusionCliente.TEXTOS.generico, 'el genérico se REUSA de la fusión, byte a byte');
});

test('SCRUM-1868b · cada texto sin hueco consta en la ficha de microcopy, y uno parecido no', () => {
  const planos = [...Object.values(FIRMADOS).filter((t) => typeof t === 'string'), ...Object.values(FIRMADOS.FILAS), ...Object.values(FIRMADOS.MOTIVOS)];
  const sinHueco = planos.filter((t) => !/{[^}]+}/.test(t));
  assert.equal(sinHueco.length, 24, `esperaba 24 textos sin hueco (23 + la fila de c.22867) y veo ${sinHueco.length}`);
  for (const t of sinHueco) assert.ok(constaAprobado(t).includes(FICHA), `🔴 «${t}» no consta en ${FICHA}`);
  assert.deepEqual(constaAprobado('Cliente eliminado.'), [], 'CONTROL NEGATIVO: uno parecido no consta');
  const md = fs.readFileSync(path.join(RAIZ, FICHA), 'utf8');
  for (const t of planos) assert.ok(md.includes(t), `🔴 «${t}» no está literal en la ficha`);
  assert.match(md, /SCRUM-1868 c\.22850/);
  assert.match(md, /SCRUM-1868 c\.22867/);
});

test('SCRUM-1868b · la alerta del bloqueo se DERIVA del literal firmado sin palabras nuevas (plural, singular, solo una de las dos)', () => {
  const B = cargarDashboard(RAIZ, { datos: () => [] }).ctx.borrarCliente;
  const casos = [
    [2, 5, 'No se puede eliminar a Ana. Tiene 2 facturas emitidas y 5 presupuestos, y una factura emitida no se borra.'],
    [1, 1, 'No se puede eliminar a Ana. Tiene 1 factura emitida y 1 presupuesto, y una factura emitida no se borra.'],
    [3, 0, 'No se puede eliminar a Ana. Tiene 3 facturas emitidas, y una factura emitida no se borra.'],
    [0, 4, 'No se puede eliminar a Ana. Tiene 4 presupuestos.'],
    [0, 1, 'No se puede eliminar a Ana. Tiene 1 presupuesto.'],
  ];
  for (const [n, m, esperado] of casos) assert.equal(B.alertaBloqueo('Ana', n, m), esperado, `n=${n} m=${m}`);
  assert.equal(B.alertaBloqueo('Ana', 0, 0), null, 'con cero de las dos no hay alerta: cae en el genérico');
  // Ninguna palabra que no esté en el literal firmado (los números y el nombre son los huecos).
  const palabras = (t) => t.replace(/[.,]/g, ' ').split(/\s+/).filter((w) => w && !/^\d+$/.test(w) && w !== 'Ana');
  const firmadas = new Set(palabras(FIRMADOS.bloqueo).map((w) => w.replace(/s$/, '')));
  for (const [, , esperado] of casos) for (const w of palabras(esperado)) assert.ok(firmadas.has(w.replace(/s$/, '')), `🔴 «${w}» no está en el literal firmado`);
  assert.ok(!firmadas.has('mañana'), 'CONTROL NEGATIVO: una palabra que no está no casa');
});

test('SCRUM-1868b · TÉCNICO: no hay tarjeta (las rutas son solo admin); ADMIN: una, DESPUÉS de las pestañas', async () => {
  const t = await montarFicha({ rol: 'tecnico' });
  assert.equal(t.tarjeta(), null, '🔴 el técnico ve «Eliminar este cliente»: el servidor le daría 403');
  assert.equal(t.previas().length, 0, 'sin tarjeta no se pide la previa');
  const a = await montarFicha({ rol: 'admin' });
  const tarjetas = todos(a.c).filter((n) => n.dataset && n.dataset.rol === 'borrar-cliente');
  assert.equal(tarjetas.length, 1, 'CIEGO: el admin no ve la tarjeta');
  assert.match(a.texto(a.tarjeta()), /Eliminar este cliente/);
  assert.match(a.texto(a.tarjeta()), /Solo lo ve el administrador\./);
  const orden = todos(a.c);
  const ultimaPestana = Math.max(...a.pestanas().map((p) => orden.indexOf(p)));
  assert.ok(orden.indexOf(a.tarjeta()) > ultimaPestana, '🔴 la tarjeta no va después de las pestañas (opción B)');
  const boton = a.en(a.tarjeta(), 'abrir-borrado');
  assert.equal(boton.className, 'btn btn-secondary gasto-opcion-eliminar', 'secundario con la tinta de peligro que ya existe, sin btn-sm');
  assert.equal(a.previas().length, 0, 'pintar la tarjeta no pide nada: la previa sale al abrir');
});

test('SCRUM-1868b · al abrir, la previa (GET) pinta lo que se borra con sus cuentas, y «Eliminar» se habilita', async () => {
  const f = await montarFicha();
  await f.abrir();
  assert.equal(f.previas().length, 1, 'al abrir se pide UNA previa');
  assert.ok(f.modal(), 'CIEGO: no se abrió el modal');
  // c.22867: «Solicitudes de presupuesto», con `cuenta.solicitudes` (6), DETRÁS de «Historial de actividad».
  assert.deepEqual(f.filas(), [['La ficha de Cliente QA 1868', '1'], ['Documentos adjuntos', '3'], ['Sitios', '2'], ['Equipos', '4'], ['Historial de actividad', '7'], ['Solicitudes de presupuesto', '6']]);
  const t = f.texto(f.modal());
  for (const s of [FIRMADOS.titulo, FIRMADOS.subtitulo, FIRMADOS.seBorra, FIRMADOS.nota, FIRMADOS.irreversible]) assert.ok(t.includes(s), `falta «${s}»`);
  assert.equal(f.en(f.modal(), 'confirmar-borrado').disabled, false, '«Eliminar» habilitado con la previa libre');
  assert.equal(f.borrados().length, 0, 'abrir NO borra nada');
});

test('SCRUM-1868b · «Eliminar» está desactivado hasta que llega la previa, y pulsarlo antes no borra', async () => {
  let soltar;
  const f = await montarFicha({ previa: () => new Promise((res) => { soltar = () => res({ status: 200, json: LIBRE }); }) });
  await f.abrir();
  assert.equal(f.en(f.modal(), 'confirmar-borrado').disabled, true, 'desactivado mientras no llega la previa');
  await f.pulsar('confirmar-borrado');
  assert.equal(f.borrados().length, 0, '🔴 sin previa en pantalla salió un DELETE');
  soltar(); await espera();
  assert.equal(f.en(f.modal(), 'confirmar-borrado').disabled, false, 'CIEGO: la previa no llegó a habilitarlo');
});

test('SCRUM-1868b · BLOQUEADO: alerta, «Lo que lo impide» y solo «Cerrar»; pulsar «Eliminar» igualmente no manda el DELETE', async () => {
  const f = await montarFicha({ previa: () => ({ status: 200, json: BLOQUEADO }) });
  await f.abrir();
  const t = f.texto(f.modal());
  assert.ok(t.includes('No se puede eliminar a Cliente QA 1868. Tiene 2 facturas emitidas y 5 presupuestos, y una factura emitida no se borra.'), 'la alerta firmada con sus números');
  assert.ok(t.includes(FIRMADOS.loImpide));
  assert.deepEqual(f.filas(), [['Facturas emitidas', '2'], ['Presupuestos', '5']]);
  assert.ok(t.includes('Puedes ') && t.includes(FIRMADOS.enlaceFusion) && t.includes(' o dejarlo como está.'), 'la frase de salida, con su enlace');
  assert.equal(f.en(f.modal(), 'confirmar-borrado').hidden, true, '🔴 bloqueado y con «Eliminar» a la vista');
  assert.equal(f.en(f.modal(), 'cancelar-borrado').hidden, true, 'bloqueado: ni «Cancelar»');
  assert.equal(f.en(f.modal(), 'cerrar-borrado').hidden, false, 'bloqueado: solo «Cerrar»');
  await f.pulsar('confirmar-borrado');
  assert.equal(f.borrados().length, 0, '🔴 bloqueado y salió el DELETE');
  await f.pulsar('cerrar-borrado');
  assert.equal(f.modal(), null, '«Cerrar» cierra el modal');
});

test('SCRUM-1868b · el enlace «fusionarlo con otro cliente» cierra este modal y abre el de fusión', async () => {
  const f = await montarFicha({ previa: () => ({ status: 200, json: BLOQUEADO }) });
  await f.abrir();
  await f.pulsar('fusionar-en-vez');
  assert.equal(f.modal(), null, 'el modal de borrar se cierra');
  const fusion = f.cuerpo().find((n) => n.id === 'fusion-confirmar');
  assert.ok(fusion, '🔴 no se abrió el modal de fusión');
  assert.equal(f.borrados().length, 0);
});

test('SCRUM-1868b · el DELETE sale SOLO del botón: 204 → toast «Cliente eliminado» y vuelta a la lista', async () => {
  const f = await montarFicha();
  await f.abrir();
  assert.equal(f.borrados().length, 0, 'antes de pulsar, ningún DELETE');
  await f.pulsar('confirmar-borrado');
  assert.deepEqual(f.borrados().map((p) => p.u), [`/admin/customers/${CLIENTE.id}`], 'UN DELETE, a ESTE cliente');
  assert.deepEqual(f.toasts, [FIRMADOS.exito]);
  assert.deepEqual(f.vistas, ['customers'], 'la misma vuelta que «← Volver a Clientes»');
  assert.equal(f.modal(), null, 'el modal se cierra');
});

test('SCRUM-1868b · 409 tras pulsar (alguien emitió una factura entre mirar y pulsar) → el modal pasa al bloqueo con el cuerpo del 409', async () => {
  const f = await montarFicha({ borrar: () => ({ status: 409, json: { error: 'cliente_con_documentos', motivos: ['tiene_facturas'], cuenta: { ...CUENTA, facturas: 1 } } }) });
  await f.abrir();
  await f.pulsar('confirmar-borrado');
  assert.equal(f.borrados().length, 1);
  const t = f.texto(f.modal());
  assert.ok(t.includes('No se puede eliminar a Cliente QA 1868. Tiene 1 factura emitida, y una factura emitida no se borra.'), `🔴 no pintó el bloqueo del 409: ${t.slice(0, 200)}`);
  assert.deepEqual(f.filas(), [['Facturas emitidas', '1']]);
  assert.equal(f.en(f.modal(), 'confirmar-borrado').hidden, true);
  assert.deepEqual(f.toasts, [], 'sin toast');
  assert.deepEqual(f.vistas, [], 'sin vuelta a la lista');
});

test('SCRUM-1868b · otro error, o un motivo fuera de la tabla → el genérico firmado, sin «Eliminar» habilitado', async () => {
  const a = await montarFicha({ borrar: () => ({ status: 500, json: { error: 'internal_error' } }) });
  await a.abrir();
  await a.pulsar('confirmar-borrado');
  assert.equal(a.aviso(), FIRMADOS.generico);
  assert.deepEqual(a.toasts, []);
  const b = await montarFicha({ previa: () => ({ status: 200, json: { bloqueado: true, motivos: ['tiene_otra_cosa'], cuenta: CUENTA } }) });
  await b.abrir();
  assert.equal(b.aviso(), FIRMADOS.generico, 'un código que no está en la tabla cae en el genérico');
  assert.equal(b.en(b.modal(), 'confirmar-borrado').disabled, true);
  const c = await montarFicha({ previa: () => ({ status: 404, json: { error: 'cliente_no_encontrado' } }) });
  await c.abrir();
  assert.equal(c.aviso(), FIRMADOS.generico, 'la previa con 404 → el genérico');
  assert.equal(c.en(c.modal(), 'confirmar-borrado').disabled, true);
});

test('SCRUM-1773 · los bloques de SCRUM-1868b no escriben `style=` ni `on*=` dentro de una cadena (y el detector lo ve)', () => {
  const txt = fs.readFileSync(path.join(RAIZ, VISTA), 'utf8');
  const tramo = (ini, fin) => { const i = txt.indexOf(ini); const j = txt.indexOf(fin, i); assert.ok(i >= 0 && j > i, `🔴 no encuentro «${ini}»`); return txt.slice(i, j); };
  const bloques = [
    tramo('// ── SCRUM-1868b · ELIMINAR ESTE CLIENTE', 'window.borrarCliente = BORRAR_CLIENTE;'),
    tramo('// SCRUM-1868b · «Eliminar este cliente», al final', 'wrap.appendChild(tarjeta);'),
    tramo('// ── SCRUM-1868b · Eliminar cliente ──', '// ── SCRUM-1781d'),
  ];
  for (const b of bloques) {
    const m = medirTexto(VISTA, b);
    assert.deepEqual({ style: m.style.length, on: m.on.length }, { style: 0, on: 0 });
  }
  const sembrado = medirTexto(VISTA, "x.innerHTML = '<p style=\"color:red\" onclick=\"y()\">a</p>';");
  assert.deepEqual({ style: sembrado.style.length, on: sembrado.on.length }, { style: 1, on: 1 }, 'CIEGO: el detector no ve uno sembrado');
});
