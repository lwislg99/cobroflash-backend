// SCRUM-915b · DEL PARTE FIRMADO, AL PRESUPUESTO CON TODO PUESTO.
//
// Pedido por el fundador (20-nov-2026, literal): «que de un parte se pueda crear un presupuesto y te
// lleve a la creacion de presupuestos con todo ya relleno y solo tenga que completarlo y emitirlo».
// El gemelo es el albarán que nace del parte firmado (SCRUM-1740): mismas líneas, SIN precios.
//
// Se mide el VIAJE, en el banco del panel entero, con los botones PULSADOS:
//   ficha REAL del parte (`renderParteDetailView`) → «+ Nuevo presupuesto» → adónde navega y con qué
//   → editor REAL (`renderQuotesView`) montado con ESO → lo que el profesional ve relleno → pone los
//   precios → «Generar» → el cuerpo REAL del POST.
//
//   ① firmado y con trabajo: hay botón, con el rótulo que la app ya usa para esto, y es secundario;
//   ② pulsarlo abre `quotes-new` con el trabajo, el cliente y las líneas en el orden de la pantalla;
//   ③ el editor abre con el cliente elegido y cada línea con su concepto y su cantidad, SIN precio;
//      y el presupuesto que sale lleva `job_id` (no nace suelto: SCRUM-1274);
//   ④ NO sale en borrador, ni facturado, ni sin trabajo, ni sin nada que llevar.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const texto = (n) => String(n.textContent || '');

const CLIENTE = { id: 5, name: 'Cliente de prueba', email: 'c@x.es', phone: '34000111222', mobile: null };
const OTRO = { id: 6, name: 'Otro cliente', email: 'o@x.es', phone: '34000111333', mobile: null };

// Lo que sirve `GET /admin/partes/:id` (`serializeParteParaElTecnico`): líneas {bloque, unds,
// descripcion}, sin dinero. Los materiales van ANTES en la lista a propósito: la pantalla pinta
// primero la mano de obra, y lo que viaja tiene que ser lo que se ve.
const BASE = Object.freeze({
  id: 13, jobId: 79, customerId: CLIENTE.id, numero: 'PT-2026-013', clienteNombre: CLIENTE.name,
  fecha: '2026-11-10T08:00:00.000Z', obra: '', referencia: '', entrada: '09:00', salida: '11:00',
  desplazamientos: 0, kilometros: 0, tecnicos: [], tipo: 'averia',
  lineas: [
    { bloque: 'materiales', unds: 3, descripcion: 'Latiguillo 1/2' },
    { bloque: 'mano_obra', unds: 2, descripcion: 'Cambio de grifo' },
    { bloque: 'materiales', unds: 1.5, descripcion: 'Tubo multicapa (m)' },
  ],
  notas: '', estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const CERRADO = { puedeEditarContenido: { ok: false, motivo: 'firmado' } };
const FIRMADO = { ...CERRADO, estado: 'firmado', firmoElCliente: true, firmoElTecnico: true, firmadoPorNombre: 'Ana', firmadoTecnicoNombre: 'Israel' };
const FIRMADO_UNO = { ...CERRADO, estado: 'firmado', firmoElTecnico: true, firmadoTecnicoNombre: 'Israel' };
// Como lo sirve el servidor: al facturar se cierra TAMBIÉN el candado de los precios (`puedeEditarPrecios`).
const FACTURADO = {
  ...FIRMADO, estado: 'facturado',
  puedeEditarContenido: { ok: false, motivo: 'facturado' }, puedeEditarPrecios: { ok: false, motivo: 'facturado' },
};

const ROTULO = '+ Nuevo presupuesto';
const EN_PANTALLA = [
  { concept: 'Cambio de grifo', qty: 2 },
  { concept: 'Latiguillo 1/2', qty: 3 },
  { concept: 'Tubo multicapa (m)', qty: 1.5 },
];

const responder = (cuerpo) => ({
  ok: true, status: 200, headers: { get: () => 'application/json' },
  json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});
const NAVEGADOR = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };

/** La ficha REAL del parte, pintada. Devuelve el botón, el de volver y adónde navega el panel. */
async function pintarParte(parte) {
  const fetch = async (url) => (/\/admin\/partes\/13$/.test(String(url)) ? responder(parte) : responder({}));
  const banco = cargarDashboard(RAIZ, { red: { fetch, navigator: NAVEGADOR } });
  const w = banco.ctx.window;
  const navegaciones = [];
  w.renderAppView = (vista, datos) => { navegaciones.push({ vista, datos }); };
  const contenedor = banco.mk('div');
  banco.ctx.document.body.appendChild(contenedor);
  assert.equal(await w.renderParteDetailView(contenedor, 13), true, '🔴 CIEGO: la ficha del parte no se pintó en el banco');
  assert.ok(contenedor.querySelector('[data-parte-firmas]'), '🔴 CIEGO: se pintó otra cosa que la ficha del parte');
  return {
    contenedor,
    presupuesto: contenedor.querySelector('[data-parte-presupuesto]'),
    volver: contenedor.querySelector('[data-parte-volver-al-trabajo]'),
    navegaciones,
  };
}

/** Pulsa «+ Nuevo presupuesto» en un parte firmado y devuelve lo que el panel recibió. */
async function pulsarEnElParte(parte) {
  const r = await pintarParte(parte);
  assert.ok(r.presupuesto, '🔴 el parte firmado no ofrece hacer un presupuesto');
  assert.ok(r.presupuesto.click() > 0, '🔴 «+ Nuevo presupuesto» no tiene a nadie escuchando');
  assert.equal(r.navegaciones.length, 1, `🔴 un clic, una navegación: ${JSON.stringify(r.navegaciones)}`);
  return r.navegaciones[0];
}

/** El editor REAL, montado con lo que le pasó el parte. Devuelve lo que se ve y lo que se manda. */
async function abrirElEditor(template) {
  const posts = [];
  const red = {
    navigator: NAVEGADOR,
    fetch: async (url, opts) => {
      const u = String(url);
      const metodo = (opts && opts.method) || 'GET';
      let cuerpo = {};
      if (/\/admin\/customers/.test(u)) cuerpo = [CLIENTE, OTRO];
      else if (/\/admin\/merchant$/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR', clausulasPresupuesto: [] };
      else if (/\/quote\/create/.test(u) && metodo === 'POST') {
        posts.push(JSON.parse(String(opts.body)));
        cuerpo = { id: 99, number: 'P-2026-0003', status: 'draft' };
      } else if (/\/admin\/quotes\/\d+$/.test(u)) cuerpo = { id: 99, pdfUrl: '/pdf/99.pdf' };
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
    },
  };
  const b = cargarDashboard(RAIZ, { red });
  b.ctx.appMerchantId = 1;
  b.ctx.renderAppView = () => {};
  const r = await pintarVista(b, 'renderQuotesView', template);
  assert.equal(r.error, null, `SUELO: el editor no monta: ${r.error && r.error.message}`);
  await respirar();
  const n = todos(r.contenedor);
  const cliente = n.find((x) => x.tagName === 'SELECT' && x.name === 'customer_id');
  assert.ok(cliente, 'SUELO: no se encuentra el selector de cliente');
  const conceptos = n.filter((x) => x.tagName === 'INPUT' && x.placeholder === 'Concepto / servicio');
  assert.ok(conceptos.length, 'CIEGO: el editor no tiene ninguna línea que mirar');
  // Cada línea es una tarjeta: su cantidad y su precio son los dos `number` de la misma tarjeta.
  const filas = conceptos.map((c) => {
    let tarjeta = c.parentNode;
    while (tarjeta && !(tarjeta.getAttribute && tarjeta.getAttribute('role') === 'listitem')) tarjeta = tarjeta.parentNode;
    assert.ok(tarjeta, 'CIEGO: el concepto no cuelga de una tarjeta de línea');
    const numeros = todos(tarjeta).filter((x) => x.tagName === 'INPUT' && x.type === 'number');
    const cantidad = numeros.find((x) => String(x.step) === '1');
    const precio = numeros.find((x) => String(x.step) === '0.01' && x !== cantidad);
    assert.ok(cantidad && precio, 'CIEGO: la tarjeta no tiene cantidad y precio que mirar');
    return { concepto: c, cantidad, precio };
  });
  return {
    clienteAlAbrir: cliente.value,
    filas,
    async generar() {
      const primaria = n.find((x) => x.tagName === 'BUTTON' && /^Generar/.test(texto(x)));
      assert.ok(primaria, 'SUELO: la pantalla no tiene «Generar»');
      primaria.disparar('click');
      await respirar(20);
      return posts;
    },
  };
}

test('SCRUM-915b ① el parte FIRMADO con trabajo ofrece «+ Nuevo presupuesto», secundario y bajo «Volver al trabajo»', async () => {
  for (const [nombre, parte] of [['firmado por los dos', { ...BASE, ...FIRMADO }], ['firmado por uno', { ...BASE, ...FIRMADO_UNO }]]) {
    const r = await pintarParte(parte);
    assert.ok(r.volver, `🔴 CIEGO: el parte ${nombre} no pinta sus salidas`);
    assert.ok(r.presupuesto, `🔴 el parte ${nombre} no ofrece hacer un presupuesto`);
    assert.equal(texto(r.presupuesto), ROTULO, '🔴 el rótulo no es el que la app ya usa para abrir el editor desde un trabajo');
    assert.match(String(r.presupuesto.className), /\bbtn-secondary\b/, '🔴 compite en verde con la acción principal del parte');
    assert.doesNotMatch(String(r.presupuesto.className), /\bbtn-primary\b/);
    const orden = todos(r.contenedor);
    assert.ok(orden.indexOf(r.volver) >= 0 && orden.indexOf(r.presupuesto) > orden.indexOf(r.volver),
      '🔴 «+ Nuevo presupuesto» no va DEBAJO de «Volver al trabajo»');
  }
});

test('SCRUM-915b ② pulsarlo abre `quotes-new` con el trabajo, el cliente y las líneas en el orden de la pantalla', async () => {
  const nav = await pulsarEnElParte({ ...BASE, ...FIRMADO });
  assert.equal(nav.vista, 'quotes-new');
  const t = nav.datos && nav.datos.template;
  assert.ok(t, '🔴 navega al editor sin pasarle nada: abriría en blanco');
  assert.deepEqual({ ...t.deTrabajo }, { jobId: 79, customerId: CLIENTE.id }, '🔴 el presupuesto no nace con el trabajo y el cliente del parte');
  // `Array.from`: la lista nace en el contexto del banco y `deepEqual` estricto mira el prototipo.
  assert.deepEqual(Array.from(t.lines, (l) => ({ ...l })), EN_PANTALLA,
    `🔴 las líneas no son las del parte, en su orden y sin nada más: ${JSON.stringify(t.lines)}`);
  for (const l of t.lines) {
    assert.equal('price' in l, false, '🔴 la línea viaja con un precio que el parte no tiene');
  }
});

test('SCRUM-915b ③ 🔴 EL VIAJE: el editor abre relleno (cliente, conceptos, cantidades), sin precio, y lo que sale cuelga del trabajo', async () => {
  const nav = await pulsarEnElParte({ ...BASE, ...FIRMADO });
  const editor = await abrirElEditor(nav.datos.template);
  assert.equal(editor.clienteAlAbrir, String(CLIENTE.id), '🔴 el editor no abre con el cliente del parte');
  assert.deepEqual(
    editor.filas.map((f) => ({ concept: f.concepto.value, qty: Number(f.cantidad.value) })), EN_PANTALLA,
    '🔴 el editor no enseña las líneas del parte');
  assert.deepEqual(editor.filas.map((f) => String(f.precio.value)), ['', '', ''],
    '🔴 el editor inventa un precio: el parte no lo trae y lo pone el profesional');

  // «…y solo tenga que completarlo y emitirlo»: pone los precios y genera.
  editor.filas.forEach((f, i) => { f.precio.value = String(10 * (i + 1)); f.precio.disparar('input'); });
  const posts = await editor.generar();
  assert.equal(posts.length, 1, 'SUELO: «Generar» no ha llegado al POST /quote/create');
  const cuerpo = posts[0];
  assert.equal(cuerpo.customer_id, CLIENTE.id);
  assert.equal(cuerpo.job_id, 79, '🔴 el POST no lleva `job_id`: el presupuesto nace suelto y al aceptarlo habría DOS trabajos');
  assert.deepEqual(cuerpo.lines.map((l) => [l.concept, Number(l.qty), Number(l.price)]), [
    ['Cambio de grifo', 2, 10], ['Latiguillo 1/2', 3, 20], ['Tubo multicapa (m)', 1.5, 30],
  ], `🔴 lo que se emite no son las líneas del parte: ${JSON.stringify(cuerpo.lines)}`);
});

test('SCRUM-915b ④ NO sale en borrador, ni facturado, ni sin trabajo, ni sin líneas que llevar', async () => {
  const positivo = await pintarParte({ ...BASE, ...FIRMADO });
  assert.ok(positivo.presupuesto, '🔴 CIEGO: sin el botón en el caso bueno, los negativos no prueban nada');

  const casos = [
    ['borrador (aún se está apuntando)', BASE],
    ['facturado', { ...BASE, ...FACTURADO }],
    // Sin un candado no se sabe en qué punto está el parte: la respuesta es NO, no «será firmado».
    ['sin el candado de los precios', { ...BASE, ...FIRMADO, puedeEditarPrecios: undefined }],
    ['sin el candado del contenido', { ...BASE, ...FIRMADO, puedeEditarContenido: undefined }],
    ['sin trabajo', { ...BASE, ...FIRMADO, jobId: null }],
    ['sin líneas', { ...BASE, ...FIRMADO, lineas: [] }],
    ['con líneas sin descripción', { ...BASE, ...FIRMADO, lineas: [{ bloque: 'mano_obra', unds: 1, descripcion: '   ' }] }],
  ];
  for (const [nombre, parte] of casos) {
    const r = await pintarParte(parte);
    assert.equal(r.presupuesto, null, `🔴 el parte ${nombre} ofrece «+ Nuevo presupuesto»`);
  }
});

test('SCRUM-915b ⑤ una cantidad ilegible no se inventa: la línea viaja con la cantidad EN BLANCO', async () => {
  const nav = await pulsarEnElParte({ ...BASE, ...FIRMADO, lineas: [
    { bloque: 'mano_obra', unds: null, descripcion: 'Revisión de la caldera' },
    { bloque: 'mano_obra', unds: 0, descripcion: 'Purgado' },
    { bloque: 'materiales', unds: 4, descripcion: 'Junta' },
  ] });
  assert.deepEqual(Array.from(nav.datos.template.lines, (l) => ({ ...l })), [
    { concept: 'Revisión de la caldera', qty: '' },
    { concept: 'Purgado', qty: '' },
    { concept: 'Junta', qty: 4 },
  ]);
});
