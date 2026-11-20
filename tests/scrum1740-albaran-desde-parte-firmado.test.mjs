// tests/scrum1740-albaran-desde-parte-firmado.test.mjs — SCRUM-1740, mitad PANTALLA (S2)
//
// Recorrido H6, fila 20 (S4, 16-nov-2026): con el parte YA FIRMADO, la ficha del trabajo ofrecía
// «+ Nuevo albarán» DOS veces (la primaria de la cabecera —la escalera, `kind: 'nuevo'`— y el botón
// de la barra de Albaranes) y el albarán nacía VACÍO: ninguna línea del parte viajaba.
//
// Forma decidida (SCRUM-1740 c.21982): el borrador nace PRE-CARGADO por el SERVIDOR con las líneas
// del último parte firmado (concepto y cantidad, SIN precios), editables en el borrador. Contrato de
// S1 (mensaje de la sesión 1, 17-nov): `POST /admin/jobs/:id/albaranes` SIN la clave `lineas` +
// último parte (id mayor) FIRMADO → 201 con esas líneas y `precargaDelParte: {parteId, numero,
// lineas, omitidas}`; con `lineas` en el cuerpo, no se pisa nada.
//
// 🔴 DECLARADO: la respuesta del POST está SIMULADA en este banco (`RESPUESTA_S1`, abajo), con la
// forma de ese contrato: la ruta de S1 va en su propio PR. El acople real se mide en yaqu.app al
// cerrar (regla 42).
//
// Lo que se fija, por rol (admin y técnico, desenrollado: scrum1415 prohíbe nombres construidos):
//   · con el último parte firmado, «+ Nuevo albarán» se ve UNA sola vez;
//   · el alta NO prellena desde el presupuesto: su POST sale SIN `lineas`, y la hoja aterriza en el
//     editor del borrador devuelto, con las líneas del parte y sin precios;
//   · CONTROLES: si el último parte es un borrador (aunque haya uno firmado antes) o no hay partes,
//     el alta es la de siempre (prellenado del presupuesto, `lineas` en el POST).
// Y SCRUM-303 sigue en pie: abrir no crea nada; el POST sale al pulsar «Crear albarán».
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const texto = (n) => String(n.textContent || '').trim();

const QUOTE = { id: 77, number: 3, total: 1210, currency: 'EUR', status: 'accepted' };
const LINEAS_QUOTE = [
  { concept: 'Partida del presupuesto A', qty: 2, price: 100 },
  { concept: 'Partida del presupuesto B', qty: 1, price: 50 },
];
const PARTE_FIRMADO = { id: 22, numero: 'PT-2026-014', fecha: '2026-11-16', estado: 'firmado' };
const PARTE_BORRADOR = { id: 23, numero: 'PT-2026-015', fecha: '2026-11-17', estado: 'borrador' };
const LINEAS_DEL_PARTE = [
  { concepto: 'Cambio de grifo', cantidad: 1, unidad: '' },
  { concepto: 'Sellado de bañera', cantidad: 2, unidad: '' },
  { concepto: 'Revisión de desagüe', cantidad: 1, unidad: '' },
];
// La respuesta del POST con la forma del contrato de S1 (SIMULADA; ver cabecera).
const RESPUESTA_S1 = {
  id: 53, numero: 'AB260008', estado: 'borrador', modoValoracion: 'SIN_VALORAR', version: 1,
  lineas: LINEAS_DEL_PARTE, notas: null, docHeaderText: null, ocultarPreciosEnDocumento: false,
  lugarEntrega: null, fechaEntrega: null,
  precargaDelParte: { parteId: 22, numero: 'PT-2026-014', lineas: 3, omitidas: 0 },
  idempotencia: 'aplicada',
};

const base = (extra) => ({
  id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reforma baño',
  customer: { id: 5, name: 'Cliente de la obra', phone: null, mobile: null },
  asignados: [], operario: null, albaranes: [], gastos: [], notes: '', invoices: [],
  quote: QUOTE, direccion: null, totalAceptado: 1210, totalCobrado: 0, partes: [], ...extra,
});

const pulsar = async (b) => {
  for (const fn of (b._oyentes && b._oyentes.click) || []) {
    await fn.call(b, { type: 'click', target: b, preventDefault() {}, stopPropagation() {} });
  }
};

/** ¿Se ve? Conectado al documento, sin `hidden` ni `display:none` en él o en un antepasado. */
function seVe(n) {
  let p = n;
  while (p) {
    if (p.hidden === true) return false;
    if (p.style && p.style.display === 'none') return false;
    if (p.tagName === 'BODY') return true;
    p = p.parentNode;
  }
  return false;
}

async function ficha(job, rol) {
  const banco = cargarDashboard(RAIZ);
  const peticiones = [];
  banco.ctx.apiRequest = async (u, opts = {}) => {
    const url = String(u);
    const metodo = (opts && opts.method) || 'GET';
    peticiones.push({ url, metodo, cuerpo: opts && opts.body ? JSON.parse(opts.body) : null });
    if (/\/admin\/team/.test(url) || /gastos/.test(url)) return [];
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/\/admin\/merchant/.test(url)) return { name: 'Epipe' };
    if (/\/admin\/albaranes\/serie$/.test(url)) return { siguiente: 'AB260008' };
    if (/\/admin\/albaranes\/\d+\/fotos$/.test(url)) return [];
    if (/\/admin\/quotes\/77$/.test(url)) return { ...QUOTE, lines: LINEAS_QUOTE };
    if (metodo === 'POST' && /\/admin\/jobs\/42\/albaranes$/.test(url)) {
      const cuerpo = JSON.parse(opts.body);
      // El contrato de S1: sólo precarga SIN la clave `lineas` y con el último parte firmado.
      const ultimo = [...job.partes].sort((a, b) => b.id - a.id)[0];
      if (!('lineas' in cuerpo) && ultimo && ultimo.estado === 'firmado') return RESPUESTA_S1;
      return { ...RESPUESTA_S1, lineas: cuerpo.lineas || [], precargaDelParte: null };
    }
    return job;
  };
  banco.ctx.appUserRole = rol;
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `SUELO: la ficha no monta (${r.error && r.error.message})`);
  await respirar(20);
  const doc = banco.ctx.document;
  // SCRUM-1768 (vuelta 2) · la barra de documentos vive en la pestaña «Albaranes». Se abre, como haría el
  // profesional, para que «a la vista» mida la deduplicación cabecera + barra y no una pestaña cerrada
  // (con ella cerrada, «sale UNA vez» pasaría aunque la barra repitiera el botón).
  const pestanaAlbaranes = todos(doc.body).find((n) => n.tagName === 'BUTTON' && n.getAttribute && n.getAttribute('role') === 'tab' && texto(n) === 'Albaranes');
  assert.ok(pestanaAlbaranes, 'SUELO: la ficha tiene la pestaña «Albaranes»');
  pestanaAlbaranes.click();
  const botonesNuevo = () => todos(doc.body).filter((n) => n.tagName === 'BUTTON' && texto(n) === '+ Nuevo albarán');
  return { banco, doc, peticiones, botonesNuevo };
}

async function crearDesdeLaFicha(f) {
  const visibles = f.botonesNuevo().filter(seVe);
  assert.ok(visibles.length >= 1, 'CIEGO: no hay ningún «+ Nuevo albarán» a la vista');
  await pulsar(visibles[0]);
  await respirar(30);
  const altas = f.peticiones.filter((p) => p.metodo === 'POST' && /\/albaranes$/.test(p.url));
  assert.equal(altas.length, 0, '🔴 SCRUM-303: abrir la hoja ya creó un albarán (número quemado)');
  const hojas = f.doc.querySelectorAll('.modal-overlay');
  const hoja = hojas[hojas.length - 1];
  assert.ok(hoja, 'CIEGO: «+ Nuevo albarán» no abrió la hoja de alta');
  const crear = [...hoja.querySelectorAll('button')].find((b) => texto(b) === 'Crear albarán');
  assert.ok(crear, 'CIEGO: la hoja no tiene «Crear albarán»');
  await pulsar(crear);
  await respirar(30);
  const post = f.peticiones.filter((p) => p.metodo === 'POST' && /\/admin\/jobs\/42\/albaranes$/.test(p.url));
  assert.equal(post.length, 1, 'CIEGO: «Crear albarán» no hizo el alta');
  return { post: post[0], hojas: [...f.doc.querySelectorAll('.modal-overlay')] };
}

/** El editor del borrador devuelto: la hoja «Editar albarán AB260008». */
function hojaDelBorrador(hojas) {
  return hojas.find((h) => String(h.getAttribute('aria-label') || '') === 'Editar albarán AB260008');
}

async function aterrizaEnElBorradorPrecargado(rol) {
  const f = await ficha(base({ partes: [PARTE_FIRMADO] }), rol);
  const { post, hojas } = await crearDesdeLaFicha(f);
  assert.ok(!('lineas' in post.cuerpo),
    `🔴 (${rol}) el alta manda \`lineas\` (${JSON.stringify(post.cuerpo.lineas)}): el servidor no precarga el parte si el cuerpo las trae`);
  assert.ok(!f.peticiones.some((p) => /\/admin\/quotes\/77$/.test(p.url)),
    `🔴 (${rol}) con el parte firmado, el alta sigue leyendo el presupuesto para prellenar`);
  const editor = hojaDelBorrador(hojas);
  assert.ok(editor, `🔴 (${rol}) tras crear, el flujo no aterriza en el borrador precargado (no se abre «Editar albarán AB260008»)`);
  const valores = [...editor.querySelectorAll('input')].map((i) => String(i.value));
  for (const l of LINEAS_DEL_PARTE) {
    assert.ok(valores.includes(l.concepto), `🔴 (${rol}) el borrador no enseña la línea del parte «${l.concepto}»`);
  }
}

async function unSoloBoton(rol) {
  const f = await ficha(base({ partes: [PARTE_FIRMADO] }), rol);
  const visibles = f.botonesNuevo().filter(seVe);
  assert.equal(visibles.length, 1,
    `🔴 (${rol}) con el parte firmado, «+ Nuevo albarán» sale ${visibles.length} veces en la ficha (fila 20 del recorrido H6)`);
}

test('SCRUM-1740 · admin · con el parte firmado, «+ Nuevo albarán» aparece UNA sola vez', async () => {
  await unSoloBoton('admin');
});

test('SCRUM-1740 · técnico · con el parte firmado, «+ Nuevo albarán» aparece UNA sola vez', async () => {
  await unSoloBoton('tecnico');
});

test('SCRUM-1740 · admin · el alta sale sin `lineas` y aterriza en el borrador con las líneas del parte', async () => {
  await aterrizaEnElBorradorPrecargado('admin');
});

test('SCRUM-1740 · técnico · el alta sale sin `lineas` y aterriza en el borrador con las líneas del parte', async () => {
  await aterrizaEnElBorradorPrecargado('tecnico');
});

test('SCRUM-1740 · técnico · el borrador precargado no enseña precios', async () => {
  const f = await ficha(base({ partes: [PARTE_FIRMADO] }), 'tecnico');
  const { hojas } = await crearDesdeLaFicha(f);
  const editor = hojaDelBorrador(hojas);
  assert.ok(editor, 'CIEGO: no se abrió el borrador');
  // Los campos de precio EXISTEN en cada fila del editor (`.alb-precio-field`) y se esconden en
  // SIN_VALORAR: que estén es el control de que el filtro de abajo mira algo.
  const precios = [...editor.querySelectorAll('input')].filter((i) => /\balb-precio-field\b/.test(String(i.className || '')));
  assert.ok(precios.length >= LINEAS_DEL_PARTE.length, 'CIEGO: el editor no tiene campos de precio que mirar');
  assert.equal(precios.filter(seVe).length, 0, '🔴 el técnico ve campos de precio en el borrador precargado');
  // El IVA oculto nace en 21 por defecto (de siempre, SCRUM-65); el PRECIO es el que no debe venir.
  const unitarios = precios.filter((i) => i.placeholder === 'Precio ud.');
  assert.ok(unitarios.length >= LINEAS_DEL_PARTE.length, 'CIEGO: no encuentro los campos «Precio ud.»');
  assert.ok(unitarios.every((i) => !i.value), '🔴 el borrador precargado trae precios');
});

test('SCRUM-1740 · CONTROL · el último parte es un BORRADOR (aunque haya uno firmado antes): el alta es la de siempre', async () => {
  const f = await ficha(base({ partes: [PARTE_FIRMADO, PARTE_BORRADOR] }), 'admin');
  const { post, hojas } = await crearDesdeLaFicha(f);
  assert.ok(f.peticiones.some((p) => /\/admin\/quotes\/77$/.test(p.url)), 'el alta de siempre lee el presupuesto para prellenar');
  assert.equal(JSON.stringify((post.cuerpo.lineas || []).map((l) => l.concepto)),
    JSON.stringify(LINEAS_QUOTE.map((l) => l.concept)), 'el alta de siempre manda las líneas del presupuesto');
  assert.equal(hojaDelBorrador(hojas), undefined, 'sin precarga del parte no se abre el borrador: la ficha se refresca, como hoy');
});

test('SCRUM-1740 · CONTROL · sin partes, el alta es la de siempre (prellenado del presupuesto)', async () => {
  const f = await ficha(base({ partes: [] }), 'admin');
  const { post } = await crearDesdeLaFicha(f);
  assert.equal(JSON.stringify((post.cuerpo.lineas || []).map((l) => l.concepto)),
    JSON.stringify(LINEAS_QUOTE.map((l) => l.concept)), 'el alta de siempre manda las líneas del presupuesto');
});

test('SCRUM-1740 · sin parte firmado y sin albaranes, «+ Nuevo albarán» también sale UNA vez (y al menos una)', async () => {
  // El duplicado no depende del parte: la cabecera propone `nuevo` siempre que no hay albaranes.
  const f = await ficha(base({ partes: [] }), 'admin');
  assert.equal(f.botonesNuevo().filter(seVe).length, 1, '🔴 sin albaranes, «+ Nuevo albarán» sale dos veces (cabecera + barra)');
});

test('SCRUM-1740 · CONTROL · con un albarán ya en marcha, el botón de la barra sigue ahí (la cabecera propone otra cosa)', async () => {
  const f = await ficha(base({ partes: [PARTE_FIRMADO], albaranes: [{ id: 51, numero: 'AB260006', estado: 'borrador', modoValoracion: 'SIN_VALORAR', lineas: [], version: 1 }] }), 'admin');
  assert.equal(f.botonesNuevo().filter(seVe).length, 1, 'con un borrador, la cabecera dice «Emitir albarán» y la barra conserva «+ Nuevo albarán»');
});
