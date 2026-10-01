// tests/scrum1317-cierre-admin-e-inicio-del-operario.test.mjs — SCRUM-1317
//
// LAS RUTAS /admin QUE SE LE CIERRAN AL OPERARIO, Y EL PRODUCTO QUE LE QUEDA.
//
// SCRUM-55 dejó 13 rutas aparcadas en `PENDIENTE_CLASIFICAR`. Corridas con sesión de operario el
// 1-oct-2026, 12 le dejaban pasar: los KPIs de ingresos del negocio, el embudo, el coste de
// WhatsApp, y escribir proveedores y plantillas. Este fichero mide las dos mitades, y las dos por
// EFECTO —routers reales de `dist/`, panel real en el banco—, no leyendo declaraciones:
//
//   ① EL CIERRE: con sesión de operario la ruta NIEGA, y niega ANTES de tocar la base.
//   ② EL POSITIVO, que es el que importa: el operario SIGUE pudiendo trabajar. Su Inicio pinta
//      (con SU ruta, no con la que se le cierra), su lista de Productos carga, puede usar una
//      plantilla al presupuestar, y ningún botón le queda apuntando a un 403.
//
// `scrum55-admin-fail-closed` comprueba que toda ruta DECLARA rol; aquí se comprueba qué HACE.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

// ── EL SERVIDOR: routers reales, prisma doblado (mismo mecanismo que scrum1107b) ─────────────

const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
/** Cada llamada a la base, como `modelo.metodo`. Es lo que distingue «niega» de «niega tarde». */
const llamadas = [];
const modelo = (nombre) => new Proxy({}, {
  get: (_t, metodo) => async (args) => {
    llamadas.push(`${nombre}.${String(metodo)}`);
    if (metodo === 'aggregate') return { _sum: {}, _count: { id: 0 } };
    if (metodo === 'count') return 2;
    if (metodo === 'groupBy') return [];
    if (metodo === 'findMany') {
      return nombre === 'quote'
        ? [{ id: 9, quoteNumber: 4, status: 'sent', customer: { name: 'Marta' }, total: 120, currency: 'EUR', updatedAt: new Date(0), lines: [] }]
        : [];
    }
    if (nombre === 'merchant' && metodo === 'findUnique') return merchantDeLaSesion;
    if (metodo === 'findUnique' || metodo === 'findFirst') return { id: 7, merchantId: 42 };
    return { id: 7, ...(args && args.data) };
  },
});
/** El merchant que la base devuelve a `platform-funnel`. Por defecto, uno cualquiera. */
const UN_MERCHANT = { email: 'taller@example.com', isPlatformOwner: false };
const EL_DUENO = { email: 'duena-de-la-plataforma@example.com', isPlatformOwner: true };
let merchantDeLaSesion = UN_MERCHANT;
const prisma = new Proxy({}, { get: (_t, nombre) => modelo(String(nombre)) });
require_.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma } };

const MONTAJES = {
  '/admin/metrics': './dist/modules/metrics/app/routes/metrics.routes.js',
  '/admin/templates': './dist/modules/templates/app/routes/templates.routes.js',
  '/admin/providers': './dist/modules/providers/app/routes/providers.routes.js',
};

/** `agent: false`, nunca `fetch`: ver el aviso de libuv en scrum1107b. */
function peticion(puerto, method, url, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      { host: '127.0.0.1', port: puerto, path: url, method, agent: false,
        headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {} },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (t) => { data += t; });
        res.on('end', () => {
          let cuerpo = null;
          try { cuerpo = data ? JSON.parse(data) : null; } catch { /* se deja null */ }
          resolve({ status: res.statusCode, cuerpo });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Pide `method url` con la sesión de `userRole` y dice qué contestó y cuánto tocó la base. */
async function pedir(userRole, method, url) {
  const express = require_('express');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.merchantId = 42; req.userRole = userRole; next(); });
  for (const [prefijo, rel] of Object.entries(MONTAJES)) app.use(prefijo, require_(rel).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const antes = llamadas.length;
  // Silencio del `console.error` de los handlers: el doble no es una base y algunos caen al 500.
  const errorDeVerdad = console.error;
  console.error = () => {};
  try {
    const body = method === 'GET' || method === 'DELETE' ? undefined : { name: 'x', lines: [{ concept: 'a', qty: 1, price: 1 }] };
    const r = await peticion(server.address().port, method, url, body);
    return { ...r, base: llamadas.slice(antes) };
  } finally {
    console.error = errorDeVerdad;
    await new Promise((r) => server.close(r));
  }
}

/** Las que se cierran: admin y nadie más. Una por línea (A23 nº 15). */
const CERRADAS = [
  ['GET', '/admin/metrics/home'],
  ['GET', '/admin/metrics/funnel'],
  ['GET', '/admin/metrics/services'],
  ['GET', '/admin/metrics/whatsapp'],
  ['GET', '/admin/providers'],
  ['POST', '/admin/providers'],
  ['PUT', '/admin/providers/7'],
  ['DELETE', '/admin/providers/7'],
  ['POST', '/admin/templates'],
  ['PUT', '/admin/templates/7'],
  ['DELETE', '/admin/templates/7'],
];

/** Las que el operario conserva, con lo que hace con cada una. */
const DEL_OPERARIO = [
  ['GET', '/admin/metrics/inicio'],   // su portada
  ['GET', '/admin/templates'],        // usar una plantilla al montar el presupuesto
];

test('SCRUM-1317 · 🔴 con sesión de OPERARIO, las once rutas cerradas NIEGAN — y antes de tocar la base', async () => {
  const abiertas = [];
  for (const [method, url] of CERRADAS) {
    const r = await pedir('tecnico', method, url);
    if (r.status !== 403 || r.base.length !== 0) abiertas.push(`${method} ${url} → ${r.status}, ${r.base.length} llamada(s) a la base`);
  }
  assert.deepEqual(abiertas, [],
    `\n🔴 RUTA DE ADMIN QUE DEJA PASAR AL OPERARIO (${abiertas.length} de ${CERRADAS.length}):\n   · ${abiertas.join('\n   · ')}\n`);
});

test('SCRUM-1317 · un rol que no es admin ni operario tampoco pasa (allowlist, no denylist)', async () => {
  for (const [method, url] of CERRADAS) {
    const r = await pedir('comercial', method, url);
    assert.equal(r.status, 403, `🔴 ${method} ${url} deja pasar a un rol desconocido: ${r.status}`);
  }
});

test('SCRUM-1317 · control: el ADMIN sigue llegando a las once, y el handler corre', async () => {
  for (const [method, url] of CERRADAS) {
    const r = await pedir('admin', method, url);
    assert.notEqual(r.status, 403, `🔴 ${method} ${url} le niega al admin`);
    assert.ok(r.base.length > 0,
      `🔴 CIEGO: ${method} ${url} contestó ${r.status} al admin sin tocar la base — el arnés no llega al handler, y entonces el 403 del operario no prueba nada`);
  }
});

test('SCRUM-1317 · ✅ lo que el operario conserva le contesta 200', async () => {
  for (const [method, url] of DEL_OPERARIO) {
    const r = await pedir('tecnico', method, url);
    assert.equal(r.status, 200, `🔴 ${method} ${url} le niega al operario algo que es de su trabajo: ${r.status}`);
  }
});

test('SCRUM-1317 · la portada del operario no lleva NI UN importe agregado del negocio', async () => {
  const inicio = await pedir('tecnico', 'GET', '/admin/metrics/inicio');
  assert.deepEqual(Object.keys(inicio.cuerpo).sort(), ['pendingCount', 'pendingRequests', 'quotesAwaiting', 'recentActivity'],
    '🔴 la portada del operario devuelve otros campos: cada campo nuevo es una decisión de permisos');
  // Por EFECTO, no por nombre de campo: una suma del negocio sólo sale de `aggregate`/`groupBy`.
  const sumas = inicio.base.filter((l) => /\.(aggregate|groupBy)$/.test(l));
  assert.deepEqual(sumas, [], '🔴 la portada del operario le pide sumas a la base');
  assert.ok(inicio.base.length >= 4, `🔴 CIEGO: sólo ${inicio.base.length} llamadas; la función no ha corrido`);

  // Control: la del admin SÍ las pide. Si no, el filtro de arriba no vería una suma ni teniéndola.
  const home = await pedir('admin', 'GET', '/admin/metrics/home');
  assert.ok(home.base.some((l) => /\.aggregate$/.test(l)), '🔴 CIEGO: /home ya no suma; el control de arriba no mide nada');
  for (const dinero of ['pendingAmount', 'awaitingAmount', 'collectedThisMonth', 'expensesThisMonth', 'profitThisMonth', 'topCustomers']) {
    assert.ok(dinero in home.cuerpo, `🔴 CIEGO: /home ya no devuelve ${dinero}`);
    assert.ok(!(dinero in inicio.cuerpo), `🔴 la portada del operario devuelve ${dinero}`);
  }
});

test('SCRUM-1317 · el embudo de PLATAFORMA exige las dos cosas: ser admin Y ser el merchant dueño', async () => {
  // La puerta de SCRUM-102 mira el MERCHANT (correo en OWNER_EMAILS + marca en la base), no quién
  // llama: un operario dado de alta en la cuenta dueña de la plataforma veía el embudo de TODOS
  // los merchants. `requireRole('admin')` va delante; la de dueño se queda intacta detrás.
  const { config } = require_('./dist/core/config/env.js');
  const antes = config.OWNER_EMAILS;
  config.OWNER_EMAILS = [EL_DUENO.email];
  const pedirComo = async (rol, merchant) => {
    merchantDeLaSesion = merchant;
    try { return (await pedir(rol, 'GET', '/admin/metrics/platform-funnel')).status; } finally { merchantDeLaSesion = UN_MERCHANT; }
  };
  try {
    assert.equal(await pedirComo('tecnico', UN_MERCHANT), 403, '🔴 un operario cualquiera llega al embudo de plataforma');
    assert.equal(await pedirComo('admin', UN_MERCHANT), 403, '🔴 un admin que no es el dueño llega al embudo de plataforma');
    assert.equal(await pedirComo('tecnico', EL_DUENO), 403, '🔴 un operario del merchant dueño ve el embudo de todos los merchants');
    // Control: el admin del merchant dueño SÍ pasa. Sin él, los tres 403 de arriba no dirían nada.
    assert.notEqual(await pedirComo('admin', EL_DUENO), 403, '🔴 CIEGO: el admin dueño tampoco pasa; el arnés no distingue');
  } finally {
    config.OWNER_EMAILS = antes;
  }
});

// ── EL PANEL: lo que ve y lo que pide el operario ────────────────────────────────────────────

const respirar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
const texto = (n) => todos(n).map((x) => (x.hijos.length ? '' : String(x.textContent || ''))).join(' ');
/** El rótulo de un botón: unas vistas lo ponen con `textContent` y otras con `innerHTML`. */
const rotulo = (b) => String(b.textContent || b.innerHTML || '').trim();
const botones = (n, re) => todos(n).filter((x) => x.tagName === 'BUTTON' && re.test(rotulo(x)));

/** Una red que apunta cada petición. Contesta lo que el servidor contestaría a quien SÍ puede. */
function red() {
  const peticiones = [];
  const fetch = async (url, opts) => {
    const u = String(url);
    peticiones.push(`${(opts && opts.method) || 'GET'} ${u.replace(/\?.*$/, '')}`);
    let cuerpo = [];
    if (/\/admin\/metrics\/(home|inicio)$/.test(u)) {
      cuerpo = { pendingCount: 3, quotesAwaiting: 5, pendingRequests: 1, weekly: {}, sparkline: [],
        recentActivity: [{ type: 'quote', id: 9, quoteNumber: 4, status: 'sent', customer: 'Marta Ruiz', total: 120, currency: 'EUR', updatedAt: '2026-09-30T10:00:00Z' }] };
    } else if (/\/admin\/merchant/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR', country: 'ES' };
    else if (/\/admin\/products/.test(u)) cuerpo = { ok: true, items: [{ id: 1, name: 'Grifo monomando', price: 40, isActive: true }] };
    else if (/\/admin\/providers/.test(u)) cuerpo = { ok: true, items: [] };
    else if (/\/admin\/templates$/.test(u)) cuerpo = [{ id: 1, name: 'Revisión anual', currency: 'EUR', lines: [{ concept: 'Revisión', qty: 1, price: 90 }], updatedAt: '2026-09-30T10:00:00Z' }];
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
  };
  return { peticiones, fetch };
}

async function montar(rol, vista, ...args) {
  const r = red();
  const b = cargarDashboard(RAIZ, {
    rol,
    red: { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch: r.fetch },
  });
  b.ctx.appMerchantId = 1;
  b.ctx.appDocumentoSuelto = 'no';
  b.ctx.renderAppView = () => {};
  // Los globos viven en la barra, que el banco no monta: se ponen los tres huecos.
  for (const id of ['req-badge', 'nav-quotes-badge', 'nav-invoices-badge']) {
    const g = b.mk('span');
    g.id = id;
    b.ctx.document.body.appendChild(g);
  }
  const v = await pintarVista(b, vista, ...args);
  assert.equal(v.error, null, `🔴 SUELO: ${vista} no monta con rol ${rol}: ${v.error && v.error.message}`);
  assert.equal(v.noMedida, null, `🔴 SUELO: ${v.noMedida}`);
  await respirar();
  return { b, contenedor: v.contenedor, peticiones: r.peticiones };
}

test('SCRUM-1317 · ✅ EL INICIO DEL OPERARIO PINTA, con sus globos, y sin pedir la ruta que se le cierra', async () => {
  const m = await montar('tecnico', 'renderHomeView');
  assert.ok(m.peticiones.includes('GET /admin/metrics/inicio'), `🔴 el Inicio del operario no pide su ruta. Pidió: ${m.peticiones.join(', ')}`);
  const prohibidas = m.peticiones.filter((p) => /\/admin\/(metrics\/home|reports)/.test(p));
  assert.deepEqual(prohibidas, [], '🔴 el Inicio del operario pide rutas que le contestan 403');

  const t = texto(m.contenedor);
  assert.match(t, /Marta Ruiz/, '🔴 la actividad reciente no se pinta en el Inicio del operario');
  assert.match(t, /Acciones rápidas/, '🔴 el Inicio del operario pierde sus acciones rápidas');
  assert.doesNotMatch(t, /No pudimos cargar/, '🔴 el Inicio del operario acaba en su cartel de error');
  for (const id of ['kpi-grid', 'week-summary', 'top-customers', 'top-services']) {
    assert.equal(m.b.reg.porId.get(id) || null, null, `🔴 al operario se le pinta #${id}, que es cifra del negocio`);
  }
  assert.equal(String(m.b.reg.porId.get('home-hero').innerHTML || '').trim(), '', '🔴 al operario se le pinta el número héroe');

  const globo = (id) => String(m.b.reg.porId.get(id).textContent);
  assert.deepEqual([globo('req-badge'), globo('nav-quotes-badge'), globo('nav-invoices-badge')], ['1', '5', '3'],
    '🔴 los globos del menú del operario no salen de su ruta');
});

test('SCRUM-1317 · los globos del arranque (`refreshSidebarBadges`) también salen de la ruta del operario', async () => {
  const m = await montar('tecnico', 'renderHomeView');
  const desde = m.peticiones.length;
  await m.b.ctx.refreshSidebarBadges();
  assert.deepEqual(m.peticiones.slice(desde), ['GET /admin/metrics/inicio']);
});

test('SCRUM-1317 · control: el Inicio del ADMIN sigue siendo el de siempre', async () => {
  const m = await montar('admin', 'renderHomeView');
  assert.ok(m.peticiones.includes('GET /admin/metrics/home'), '🔴 el Inicio del admin ya no pide sus métricas');
  assert.ok(!m.peticiones.includes('GET /admin/metrics/inicio'));
  for (const id of ['kpi-grid', 'week-summary', 'top-customers', 'top-services']) {
    assert.ok(m.b.reg.porId.get(id), `🔴 al admin le falta #${id}`);
  }
  assert.notEqual(String(m.b.reg.porId.get('home-hero').innerHTML || '').trim(), '', '🔴 al admin le falta el número héroe');
});

test('SCRUM-1317 · ✅ la lista de PRODUCTOS del operario carga sin pedir proveedores', async () => {
  const m = await montar('tecnico', 'renderProductsView');
  assert.deepEqual(m.peticiones.filter((p) => /\/admin\/providers/.test(p)), [],
    '🔴 Productos le pide proveedores al servidor con sesión de operario: su 403 tumba la lista entera');
  assert.ok(m.peticiones.some((p) => /\/admin\/products$/.test(p)), `🔴 CIEGO: Productos no pidió los productos. Pidió: ${m.peticiones.join(', ')}`);
  assert.match(texto(m.contenedor), /Grifo monomando/, '🔴 la lista de productos del operario no se pinta');

  const admin = await montar('admin', 'renderProductsView');
  assert.ok(admin.peticiones.some((p) => /\/admin\/providers$/.test(p)), '🔴 CIEGO: el admin tampoco pide proveedores; el control no distingue');
});

test('SCRUM-1317 · ✅ en Plantillas el operario puede USAR, y no ve «Renombrar» ni «Borrar»', async () => {
  const m = await montar('tecnico', 'renderTemplatesView');
  assert.equal(botones(m.contenedor, /Usar$/).length, 1, '🔴 el operario pierde «Usar» la plantilla');
  assert.deepEqual(botones(m.contenedor, /^(Renombrar|Borrar)$/).map(rotulo), [],
    '🔴 al operario se le pinta un botón que acaba en 403');

  const admin = await montar('admin', 'renderTemplatesView');
  assert.equal(botones(admin.contenedor, /^(Renombrar|Borrar)$/).length, 2, '🔴 CIEGO: el admin tampoco los ve');
});

test('SCRUM-1317 · ✅ en el editor el operario puede usar plantillas, y «Guardar como plantilla» no se le pinta', async () => {
  const enElMenu = async (rol) => {
    const m = await montar(rol, 'renderQuotesView', null, false);
    const mas = todos(m.contenedor).find((x) => x.tagName === 'BUTTON' && x._attrs && x._attrs['aria-label'] === 'Más acciones');
    assert.ok(mas, `🔴 SUELO: no está el menú «⋯» del editor (rol ${rol})`);
    mas.disparar('click');
    const menu = todos(m.b.ctx.document.body).find((x) => x._attrs && x._attrs.role === 'menu');
    assert.ok(menu, `🔴 SUELO: el menú «⋯» no se abre (rol ${rol})`);
    return { m, rotulos: botones(menu, /./).map(rotulo) };
  };

  const operario = await enElMenu('tecnico');
  assert.deepEqual(operario.rotulos, ['Limpiar formulario'], '🔴 el menú «⋯» del operario no es el esperado');
  assert.equal(botones(operario.m.b.ctx.document.body, /Guardar como plantilla/).length, 0,
    '🔴 «Guardar como plantilla» se le pinta al operario en algún sitio');
  assert.ok(operario.m.peticiones.includes('GET /admin/templates'), '🔴 el editor del operario ya no le ofrece las plantillas');

  const admin = await enElMenu('admin');
  assert.ok(admin.rotulos.some((r) => /Guardar como plantilla/.test(r)), '🔴 el admin pierde «Guardar como plantilla»');
});
