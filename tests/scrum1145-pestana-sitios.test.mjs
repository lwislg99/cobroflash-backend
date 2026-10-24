// SCRUM-1145 + SCRUM-1044 · LA PESTAÑA «SITIOS» DE LA FICHA DEL CLIENTE.
//
// El servidor es de SCRUM-1014 (`GET/POST /admin/customers/:id/sites`, `PUT/DELETE …/:siteId`) y
// estaba sin pantalla que lo usara. Aquí, dos mitades:
//
//   · SIN BASE (corre siempre): la ficha REAL montada en el banco de vistas. Se PULSA la pestaña y
//     se mira qué pinta y qué pide: la fila fiscal de sólo lectura (SCRUM-1044), «Cómo llegar» con
//     el `hrefAbrirEnMapa` de siempre, el vacío, el error de carga, y el alta, la edición y el
//     borrado con la ruta y el cuerpo que salen de verdad.
//   · CON BASE (`LIBRO_PG_URL`, el banco desechable del CI): HTTP contra `dist/app.js` con sesiones
//     de verdad. Crear, editar y borrar por la ruta real; un merchant no toca los sitios de otro; y
//     borrar un sitio CONSERVA la dirección que ya se copió en un presupuesto (c.20592).
//
// Textos firmados por el fundador en SCRUM-1145 c.20592 y c.20598
// (registro: docs/microcopy/2026-10-23-SCRUM-1145-sitios-del-cliente.md).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { constaAprobado } from './_microcopy-aprobada.mjs';
import { ejecutableDe } from './_guard-texto.mjs';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const espera = () => new Promise((r) => setTimeout(r, 30));

// El catálogo del meta-guard (SCRUM-1387): cada defecto que este fichero tiene que cazar, con el
// caso que lo caza. Lo corre `npm run meta:mutaciones`; en local, `docs/master/evidencias/SCRUM-1145/mutar.mjs`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'public/dashboard/js/customerDetailView.js', de: "  const tabSitios = makeTab(SITIOS_CLIENTE.TEXTOS.pestana, 'sitios');",
    a: "  apiRequest(`/admin/customers/${id}/sites`).catch(() => null);\n  const tabSitios = makeTab(SITIOS_CLIENTE.TEXTOS.pestana, 'sitios');",
    cae: 'la lista se pide AL ABRIRLA' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: 'const filaFiscal = fiscal ? fila(T.fiscal, fiscal) : null;', a: 'const filaFiscal = null;',
    cae: 'la PRIMERA fila es la dirección fiscal' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: '    function borrar(s, boton) {\n', a: '    function borrar(s, boton) {\n      if (!window.confirm(T.eliminar)) return;\n',
    cae: 'SIN preguntar' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: "out[k] = k === 'name' ? t : (t === '' ? null : t);", a: 'out[k] = t;', cae: 'ALTA:' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: '        if (llegar) acciones.appendChild(llegar);\n', a: '',
    cae: '«Cómo llegar» en cada sitio CON dirección' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: '        avisar(window.mensajeParaPersona(err, T.errorCarga));', a: '        pintarLista([]);',
    cae: 'si la lista no carga' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: '`/admin/customers/${id}/sites/${sitio.id}`', a: '`/admin/customers/${id}/sites/${id}`', cae: 'EDICIÓN:' },
  { fichero: 'public/dashboard/js/customerDetailView.js', de: "  tabsWrap.className = 'c360-pestanas';\n", a: '', cae: 'PARTE LÍNEA' },
  { fichero: 'public/dashboard/css/styles.css', de: '.c360-pestanas { flex-wrap: wrap; }', a: '.c360-pestanas { }', cae: 'PARTE LÍNEA' },
];

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SIN BASE · la pantalla
// ═════════════════════════════════════════════════════════════════════════════════════════════

const CLIENTE = {
  id: 11450, name: 'Cliente QA 1145', phone: null, mobile: null, email: null, notes: null, portalToken: null,
  createdAt: '2026-01-10T00:00:00.000Z', waOptOut: false, taxId: null, tags: null,
  billingAddress: 'Calle Mayor 1', billingPostalCode: '28001', billingCity: 'Madrid', billingProvince: 'Madrid', billingCountry: 'ES',
};
const SIN_FISCAL = { ...CLIENTE, billingAddress: null, billingPostalCode: null, billingCity: null, billingProvince: null, billingCountry: null };
const STATS = { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 };
const SITIOS = [
  { id: 71, name: 'Nave del polígono', address: 'Polígono Sur, nave 4', city: 'Getafe', postalCode: '28906', province: 'Madrid', country: 'ES', contactName: 'Portero', phone: '34000000004' },
  { id: 72, name: 'Piso 3ºB', address: null, city: null, postalCode: null, province: null, country: null, contactName: null, phone: null },
];

/**
 * Monta la ficha. `sitios(url, opts)` contesta TODAS las rutas de sitios: devuelve la respuesta o
 * lanza. Por defecto la lista de arriba, y 201/204 a lo que escribe.
 */
async function montarFicha({ rol = 'admin', cliente = CLIENTE, sitios = null } = {}) {
  const peticiones = [];
  const confirmaciones = [];
  const porDefecto = (u, o) => {
    if ((o && o.method) === 'DELETE') return null;
    if (o && o.method) return { sitio: { id: 99, ...JSON.parse(o.body) } };
    return { sitios: SITIOS };
  };
  const banco = cargarDashboard(RAIZ, {
    rol,
    datos: (url, opts) => {
      const u = String(url || '');
      peticiones.push({ u, metodo: (opts && opts.method) || 'GET', cuerpo: opts && opts.body ? JSON.parse(opts.body) : null });
      if (/\/admin\/customers\/\d+\/sites(\/\d+)?$/.test(u)) return (sitios || porDefecto)(u, opts);
      if (/\/admin\/customers\/\d+\/detail$/.test(u)) return { customer: cliente, quotes: [], invoices: [], events: [], stats: STATS };
      if (/\/admin\/customers\/\d+\/historial/.test(u)) return { trabajos: [], partesSueltos: [] };
      if (/\/admin\/customers\/\d+\/whatsapp/.test(u)) return { waOptOut: false, mensajes: [] };
      if (/\/admin\/customers\/\d+$/.test(u)) return { ...cliente };
      return [];
    },
  });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  // Si alguien añade una confirmación al borrado, se ve: c.20592 dice «sin preguntar».
  banco.ctx.confirm = (m) => { confirmaciones.push(m); return true; };
  const r = await pintarVista(banco, 'renderCustomer360View', cliente.id);
  assert.equal(r.error, null, `la ficha no montó: ${r.error && r.error.message}`);
  const c = r.contenedor;
  const pestanas = () => todos(c).filter((n) => n.tagName === 'BUTTON' && n.dataset && n.dataset.key);
  assert.ok(pestanas().some((b) => b.dataset.key === 'quotes'), '🔴 CIEGO: la ficha no pintó ni sus pestañas de siempre');
  const pestana = () => pestanas().find((b) => b.dataset.key === 'sitios') || null;
  const abrir = async () => { pestana().disparar('click'); await espera(); };
  const filas = () => todos(c).filter((n) => n.tagName === 'LI' && n.dataset && n.dataset.sitio);
  const texto = (n) => [n, ...todos(n)].map((x) => x._texto || '').join(' ');
  const porClase = (clase) => todos(c).filter((n) => n.classList && n.classList.contains(clase));
  const porId = (id) => todos(c).find((n) => n.id === id) || null;
  const boton = (fila, accion) => todos(fila).find((n) => n.tagName === 'BUTTON' && n.dataset.accion === accion) || null;
  const deSitios = () => peticiones.filter((p) => /\/sites/.test(p.u));
  return { c, banco, peticiones, deSitios, confirmaciones, pestana, abrir, filas, texto, porClase, porId, boton };
}

test('SCRUM-1145 · 🔴 la ficha tiene la pestaña «Sitios», y la lista se pide AL ABRIRLA, no al pintar la ficha', async () => {
  const f = await montarFicha();
  assert.ok(f.pestana(), '🔴 no hay pestaña «Sitios» en la ficha');
  assert.equal(f.pestana().textContent, 'Sitios', 'sin número: c.20592 firma «Sitios» a secas');
  assert.deepEqual(f.deSitios(), [], '🔴 abrir la ficha ya pide los sitios: c.20598 acepta pedirlos al abrir la pestaña');
  await f.abrir();
  assert.deepEqual(f.deSitios().map((p) => `${p.metodo} ${p.u}`), ['GET /admin/customers/11450/sites']);
});

test('SCRUM-1044 · 🔴 la PRIMERA fila es la dirección fiscal, de sólo lectura, con su «Cómo llegar»', async () => {
  const f = await montarFicha();
  await f.abrir();
  const filas = f.filas();
  assert.deepEqual(filas.map((li) => li.dataset.sitio), ['fiscal', '71', '72'], '🔴 la fiscal no va primera, o falta un sitio');
  const fiscal = filas[0];
  assert.match(f.texto(fiscal), /Dirección fiscal/);
  const direccion = 'Calle Mayor 1, 28001, Madrid, Madrid, ES';
  assert.match(f.texto(fiscal), new RegExp(direccion));
  assert.equal(todos(fiscal).filter((n) => n.tagName === 'BUTTON').length, 0, '🔴 la fila fiscal tiene botones: es de SÓLO LECTURA');
  const llegar = todos(fiscal).find((n) => n.tagName === 'A');
  assert.ok(llegar, '🔴 la fila fiscal no tiene «Cómo llegar»');
  assert.equal(llegar.textContent, 'Cómo llegar');
  assert.equal(llegar.href, f.banco.ctx.hrefAbrirEnMapa(direccion), 'el enlace es el `hrefAbrirEnMapa` de siempre, con la dirección fiscal');
});

test('SCRUM-1044 · «Cómo llegar» en cada sitio CON dirección, y en el que no la tiene no hay enlace', async () => {
  const f = await montarFicha();
  await f.abrir();
  const [, nave, piso] = f.filas();
  const enlaceNave = todos(nave).find((n) => n.tagName === 'A');
  assert.ok(enlaceNave, '🔴 un sitio con dirección no tiene «Cómo llegar»');
  assert.equal(enlaceNave.href, f.banco.ctx.hrefAbrirEnMapa('Polígono Sur, nave 4, 28906, Getafe, Madrid, ES'));
  assert.equal(enlaceNave.target, '_blank');
  assert.match(f.texto(nave), /Portero · 34000000004/, 'el contacto del sitio no se pinta');
  assert.equal(todos(piso).filter((n) => n.tagName === 'A').length, 0, '🔴 un enlace al mapa sin dirección abre un mapa vacío');
  assert.ok(f.boton(nave, 'editar') && f.boton(nave, 'eliminar'), 'cada sitio guardado lleva «Editar» y «🗑 Eliminar»');
});

test('SCRUM-1145 · lista vacía: el texto firmado, debajo de la fiscal; sin fiscal, el vacío solo', async () => {
  const vacia = () => ({ sitios: [] });
  const f = await montarFicha({ sitios: vacia });
  await f.abrir();
  assert.deepEqual(f.filas().map((li) => li.dataset.sitio), ['fiscal'], 'un cliente antiguo sin sitios ve al menos su fiscal');
  assert.equal(f.porClase('sitios-cliente__vacio').map((n) => n.textContent).join('|'), 'Todavía no hay sitios guardados para este cliente.');

  const g = await montarFicha({ cliente: SIN_FISCAL, sitios: vacia });
  await g.abrir();
  assert.deepEqual(g.filas(), [], 'sin ningún `billing*` no hay fila fiscal que pintar');
  assert.equal(g.porClase('sitios-cliente__vacio').length, 1);
});

test('SCRUM-1145 · si la lista no carga: el error firmado, y la fiscal sigue', async () => {
  const f = await montarFicha({ sitios: () => { throw new Error('500'); } });
  await f.abrir();
  const avisos = f.porClase('sitios-cliente__error').filter((n) => !n.hidden);
  assert.deepEqual(avisos.map((n) => n.textContent), ['No se pudieron cargar los sitios guardados. Inténtalo de nuevo.']);
  assert.deepEqual(f.filas().map((li) => li.dataset.sitio), ['fiscal']);
  assert.equal(f.porClase('sitios-cliente__vacio').length, 0, '🔴 un fallo de carga NO es «no hay sitios»');
});

test('SCRUM-1145 · 🔴 ALTA: «+ Nuevo sitio» abre el formulario, y «Guardar» hace POST con lo tecleado y vuelve a pedir la lista', async () => {
  const f = await montarFicha();
  await f.abrir();
  const nuevo = f.porId('c360-sitio-nuevo');
  assert.equal(nuevo.textContent, '+ Nuevo sitio');
  nuevo.disparar('click');
  const rotulos = todos(f.c).filter((n) => n.tagName === 'LABEL' && /^c360-sitio-/.test(n.htmlFor || ''));
  assert.deepEqual(rotulos.map((n) => n.textContent), ['Nombre del sitio', 'Dirección', 'Ciudad', 'Código postal', 'Provincia', 'País', 'Contacto en el sitio', 'Teléfono del contacto']);
  rotulos.forEach((l) => assert.ok(f.porId(l.htmlFor), `🔴 el rótulo «${l.textContent}» no apunta a ningún campo`));
  const nombre = f.porId('c360-sitio-name');
  assert.equal(nombre.required, true, 'el obligatorio lo avisa el navegador (`required`), c.20598');
  assert.equal(nombre.placeholder, 'Piso 3ºB / Nave del polígono');

  // Sólo espacios: el `required` del navegador lo deja pasar, y la pantalla no lo manda.
  nombre.value = '   ';
  const form = todos(f.c).find((n) => n.tagName === 'FORM');
  form.disparar('submit');
  await espera();
  assert.equal(f.deSitios().filter((p) => p.metodo === 'POST').length, 0, '🔴 un nombre de sólo espacios llega al servidor');

  nombre.value = '  Local de la calle Luna ';
  f.porId('c360-sitio-city').value = 'Sevilla';
  f.porId('c360-sitio-country').value = 'ES';
  form.disparar('submit');
  await espera();
  const post = f.deSitios().filter((p) => p.metodo === 'POST');
  assert.equal(post.length, 1);
  assert.equal(post[0].u, '/admin/customers/11450/sites');
  assert.deepEqual(post[0].cuerpo, {
    name: 'Local de la calle Luna', address: null, city: 'Sevilla', postalCode: null, province: null, country: 'ES', contactName: null, phone: null,
  }, 'en blanco viaja `null`, nunca `""`');
  assert.equal(f.deSitios().filter((p) => p.metodo === 'GET').length, 2, 'tras guardar se vuelve a pedir la lista');
  assert.equal(todos(f.c).filter((n) => n.tagName === 'FORM').length, 0, 'el formulario se cierra al guardar');
});

test('SCRUM-1145 · EDICIÓN: «Editar» trae el sitio relleno, y «Guardar» hace PUT a SU id; «Cancelar» no manda nada', async () => {
  const f = await montarFicha();
  await f.abrir();
  const nave = f.filas()[1];
  assert.equal(f.boton(nave, 'editar').textContent, 'Editar');
  f.boton(nave, 'editar').disparar('click');
  assert.equal(f.porId('c360-sitio-name').value, 'Nave del polígono');
  assert.equal(f.porId('c360-sitio-contactName').value, 'Portero');
  const pie = f.porClase('sitios-cliente__pie')[0];
  const [cancelar, guardar] = todos(pie).filter((n) => n.tagName === 'BUTTON');
  assert.deepEqual([cancelar.textContent, guardar.textContent], ['Cancelar', 'Guardar']);

  cancelar.disparar('click');
  assert.equal(todos(f.c).filter((n) => n.tagName === 'FORM').length, 0);
  assert.equal(f.deSitios().filter((p) => p.metodo !== 'GET').length, 0, '«Cancelar» no escribe nada');

  f.boton(f.filas()[1], 'editar').disparar('click');
  f.porId('c360-sitio-phone').value = '';
  todos(f.c).find((n) => n.tagName === 'FORM').disparar('submit');
  await espera();
  const put = f.deSitios().filter((p) => p.metodo === 'PUT');
  assert.equal(put.length, 1);
  assert.equal(put[0].u, '/admin/customers/11450/sites/71');
  assert.equal(put[0].cuerpo.phone, null, 'vaciar un campo al editar lo BORRA: viaja `null`');
  assert.equal(put[0].cuerpo.name, 'Nave del polígono');
});

test('SCRUM-1145 · BORRADO: «🗑 Eliminar» hace DELETE a su id SIN preguntar, y vuelve a pedir la lista', async () => {
  const f = await montarFicha();
  await f.abrir();
  const piso = f.filas()[2];
  assert.equal(f.boton(piso, 'eliminar').textContent, '🗑 Eliminar');
  f.boton(piso, 'eliminar').disparar('click');
  await espera();
  assert.deepEqual(f.deSitios().filter((p) => p.metodo === 'DELETE').map((p) => p.u), ['/admin/customers/11450/sites/72']);
  assert.deepEqual(f.confirmaciones, [], '🔴 el borrado pregunta: c.20592 dice que no');
  assert.equal(f.deSitios().filter((p) => p.metodo === 'GET').length, 2);
});

test('SCRUM-1145 · si guardar o borrar falla: el genérico firmado, y nada se da por hecho', async () => {
  const falla = (u, o) => { if (o && o.method) throw new Error('500'); return { sitios: SITIOS }; };
  const f = await montarFicha({ sitios: falla });
  await f.abrir();
  f.boton(f.filas()[1], 'eliminar').disparar('click');
  await espera();
  assert.deepEqual(f.porClase('sitios-cliente__error').filter((n) => !n.hidden).map((n) => n.textContent),
    ['No se ha podido completar la acción. Vuelve a intentarlo.']);
  assert.equal(f.filas().length, 3, 'el sitio sigue en la lista: el borrado no salió');

  f.porId('c360-sitio-nuevo').disparar('click');
  f.porId('c360-sitio-name').value = 'Otro';
  todos(f.c).find((n) => n.tagName === 'FORM').disparar('submit');
  await espera();
  const enForm = todos(todos(f.c).find((n) => n.tagName === 'FORM')).filter((n) => n.classList && n.classList.contains('sitios-cliente__error') && !n.hidden);
  assert.deepEqual(enForm.map((n) => n.textContent), ['No se ha podido completar la acción. Vuelve a intentarlo.'], 'el formulario se queda abierto, con el aviso');
});

test('SCRUM-1145 · el Técnico también tiene la pestaña (las cuatro rutas le dejan, adminRouteDeclarations); lo demás no cambia', async () => {
  const f = await montarFicha({ rol: 'tecnico' });
  assert.ok(f.pestana(), 'el técnico apunta un sitio DESDE la obra: las cuatro rutas le dejan');
  assert.ok(!f.peticiones.some((p) => /\/whatsapp$/.test(p.u)), 'al técnico no se le pide /whatsapp, como antes');
});

test('SCRUM-1145 · la fila de pestañas PARTE LÍNEA: con cinco no cabe a 390 (medido 456 px), y a 320 ya no cabían cuatro', async () => {
  const f = await montarFicha();
  const fila = f.pestana()._padre;
  assert.ok(fila.classList.contains('c360-pestanas'), '🔴 la fila de pestañas perdió su clase: la regla de abajo ya no le llega');
  // El quitacomentarios de la casa (SCRUM-700) con suelo (SCRUM-1395); en CSS `#` es un selector.
  const css = ejecutableDe(fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8'),
    { ancla: '.c360-pestanas', donde: 'styles.css', almohadillaEsComentario: false });
  assert.match(css, /\.c360-pestanas\s*\{[^}]*flex-wrap:\s*wrap/, '🔴 sin `flex-wrap: wrap` la quinta pestaña queda fuera de la pantalla en el móvil');
});

test('SCRUM-1145 · cada texto de la pestaña consta firmado en SCRUM-1145, y uno parecido no', async () => {
  const banco = cargarDashboard(RAIZ, { datos: () => [] });
  const TX = banco.ctx.sitiosCliente.TEXTOS;
  const planos = Object.entries(TX).flatMap(([k, v]) => (k === 'CAMPOS' ? Object.values(v) : [v]));
  assert.equal(planos.length, 20, `esperaba 20 textos (12 de c.20592, 7 de c.20598 y «Cómo llegar» de SCRUM-1004) y veo ${planos.length}`);
  // Contra SU ficha, por ruta exacta (SCRUM-1306): «¿consta en alguna?» no distingue una firma
  // vigente de una superada. «Cómo llegar» es de SCRUM-1004; los demás, de SCRUM-1145.
  for (const t of planos) {
    const FICHA = t === 'Cómo llegar'
      ? 'docs/microcopy/2026-09-22-SCRUM-1003-1004-vcard-como-llegar.md'
      : 'docs/microcopy/2026-10-23-SCRUM-1145-sitios-del-cliente.md';
    assert.ok(constaAprobado(t).includes(FICHA), `🔴 «${t}» no consta en ${FICHA}`);
  }
  assert.deepEqual(constaAprobado('Todavía no hay sitios guardados.'), [], 'CONTROL NEGATIVO: uno parecido no consta');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// CON BASE · por la ruta real
// ═════════════════════════════════════════════════════════════════════════════════════════════

const URL_BANCO = process.env.LIBRO_PG_URL || '';
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const CON_BASE = URL_BANCO !== '';

after(async () => {
  if (!CON_BASE) return;
  const { prisma } = await import('../dist/core/db/prisma.js');
  await prisma.$disconnect();
});

async function montar(app) {
  const server = http.createServer(app).listen(0);
  await new Promise((r) => server.once('listening', r));
  return { port: server.address().port, cerrar: () => new Promise((r) => server.close(r)) };
}

/** Una administradora con sesión en el merchant. */
async function sesionDeAdmin(prisma, merchant, marca) {
  const jefa = await prisma.teamMember.create({
    data: { merchantId: merchant.id, name: 'Jefa', email: `qa1145-${marca}-${Date.now()}@test.local`, role: 'admin', status: 'active' },
  });
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.authSession.create({
    data: { merchantId: merchant.id, teamMemberId: jefa.id, token, type: 'session', expiresAt: new Date(Date.now() + 3600e3) },
  });
  return token;
}

// `node:http` sin agente y no `fetch` (SCRUM-1218c), como en scrum1397.
const pedir = (port, token, metodo, ruta, cuerpo) => new Promise((ok, mal) => {
  const datos = cuerpo === undefined ? null : JSON.stringify(cuerpo);
  const headers = { cookie: `pf_session=${token}` };
  if (datos) { headers['content-type'] = 'application/json'; headers['content-length'] = Buffer.byteLength(datos); }
  const req = http.request({ host: '127.0.0.1', port, path: ruta, method: metodo, headers, agent: false }, (r) => {
    let d = ''; r.setEncoding('utf8');
    r.on('data', (t) => { d += t; });
    r.on('end', () => {
      let json = null;
      if ((r.headers['content-type'] || '').includes('json')) { try { json = JSON.parse(d); } catch { json = null; } }
      ok({ status: r.statusCode, cuerpo: json });
    });
  });
  req.on('error', mal);
  if (datos) req.write(datos);
  req.end();
});

test('SCRUM-1145 · 🔴 por la ruta real: crear, editar y borrar; otro merchant no ve ni toca; borrar CONSERVA lo copiado al presupuesto', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const sello = Date.now();
  await withMerchant(prisma, { name: 'QA SCRUM-1145 A', email: `qa-1145-a-${sello}@test.local` }, (a) =>
    withMerchant(prisma, { name: 'QA SCRUM-1145 B', email: `qa-1145-b-${sello}@test.local` }, async (b) => {
      const tokA = await sesionDeAdmin(prisma, a, 'a');
      const tokB = await sesionDeAdmin(prisma, b, 'b');
      const cliente = await prisma.customer.create({ data: { merchantId: a.id, name: 'Cliente QA 1145' } });
      const srv = await montar(app);
      try {
        const base = `/admin/customers/${cliente.id}/sites`;

        // ── crear ──
        const alta = await pedir(srv.port, tokA, 'POST', base, { name: 'Nave del polígono', address: 'Polígono Sur, nave 4', city: 'Getafe', country: 'ES' });
        assert.equal(alta.status, 201, `alta: ${JSON.stringify(alta.cuerpo)}`);
        const id = alta.cuerpo.sitio.id;
        const lista = await pedir(srv.port, tokA, 'GET', base);
        assert.equal(lista.status, 200);
        assert.deepEqual(lista.cuerpo.sitios.map((s) => s.id), [id]);

        // ── otro merchant: ni ve, ni edita, ni borra ──
        assert.equal((await pedir(srv.port, tokB, 'GET', base)).status, 404, '🔴 B ve los sitios de un cliente de A');
        assert.equal((await pedir(srv.port, tokB, 'PUT', `${base}/${id}`, { name: 'De B' })).status, 404, '🔴 B edita un sitio de A');
        assert.equal((await pedir(srv.port, tokB, 'DELETE', `${base}/${id}`)).status, 404, '🔴 B borra un sitio de A');
        const intacto = await prisma.customerSite.findUnique({ where: { id } });
        assert.equal(intacto && intacto.name, 'Nave del polígono', '🔴 el sitio de A cambió por una petición de B');

        // ── editar: un campo a `null` se BORRA ──
        const edicion = await pedir(srv.port, tokA, 'PUT', `${base}/${id}`, { name: 'Nave 4', city: null });
        assert.equal(edicion.status, 200);
        assert.equal(edicion.cuerpo.sitio.name, 'Nave 4');
        assert.equal(edicion.cuerpo.sitio.city, null);

        // ── borrar CONSERVA: la dirección ya copiada en un presupuesto sigue igual ──
        const copiada = 'Polígono Sur, nave 4, Getafe, ES'; // lo que escribe `sitiosGuardados.textoParaElCampo`
        const q = await prisma.quote.create({
          data: { merchantId: a.id, customerId: cliente.id, total: '100', currency: 'EUR', lines: [], quoteNumber: 1, status: 'draft',
            shippingAddressMode: 'personalizada', shippingAddress: copiada },
        });
        const baja = await pedir(srv.port, tokA, 'DELETE', `${base}/${id}`);
        assert.equal(baja.status, 204);
        assert.equal(await prisma.customerSite.findUnique({ where: { id } }), null, 'el sitio no se borró');
        const despues = await prisma.quote.findUnique({ where: { id: q.id } });
        assert.equal(despues.shippingAddress, copiada, '🔴 borrar el sitio tocó la dirección del presupuesto');
        assert.equal(despues.shippingAddressMode, 'personalizada');
        assert.deepEqual((await pedir(srv.port, tokA, 'GET', base)).cuerpo.sitios, []);
      } finally {
        await srv.cerrar();
      }
    }));
});
