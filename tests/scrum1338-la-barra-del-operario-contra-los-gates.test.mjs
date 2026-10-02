// tests/scrum1338-la-barra-del-operario-contra-los-gates.test.mjs — SCRUM-1338
//
// LO QUE EL OPERARIO VE EN LA BARRA, CONTRA LO QUE EL SERVIDOR LE DEJA PEDIR.
//
// ── EL AGUJERO ──────────────────────────────────────────────────────────────────────────────
// `scrum55` audita el servidor: toda ruta /admin declara rol. Y lo hace bien. Lo que no existía
// era nada que comparase eso con la barra del panel: `app.js` ocultaba entradas al operario con una
// lista de nombres escrita a mano, y nadie comprobaba que estuviera completa. Medido el 1-oct-2026
// sobre `8f5906bc`: de las doce entradas que el operario veía, cuatro —Partes por valorar, Cobros, Libro
// de registro y Facturas recibidas— abrían pidiendo una ruta que el servidor le niega. SCRUM-1165
// había ocultado una, SCRUM-1317 otras dos, y éstas seguían ahí: la lista sólo crecía cuando
// alguien tropezaba.
//
// ── QUÉ MIDE, Y CÓMO ────────────────────────────────────────────────────────────────────────
// Nada de esto es una lista. Las tres poblaciones se DERIVAN:
//   · los gates, de los routers reales de `dist/` (la misma enumeración que `scrum55`);
//   · la barra, del `<nav class="sidebar-nav">` de `index.html`;
//   · qué ve el operario, EJECUTANDO `aplicarRolALaBarra` (la función de `app.js`) sobre ese nav;
//   · qué pide cada pantalla, MONTÁNDOLA en el banco de vistas con rol de operario y una red que
//     contesta 403 exactamente donde el gate real lo haría.
//
// Y se exige en los DOS sentidos, porque un barrido que le vacíe el menú es peor que el defecto:
//   ① entrada VISIBLE para el operario  → al abrirse no pide NINGUNA ruta de admin;
//   ② entrada OCULTA para el operario   → al abrirse pide AL MENOS UNA (si no, se le quita algo suyo).
//
// Una entrada nueva hacia una ruta de admin que nazca sin `data-rol="admin"` cae en ①. No hay
// catálogo que mantener: el día que se añada, este fichero no se toca.
//
// ── LO QUE NO MIDE (dicho, para que nadie lo lea de más) ────────────────────────────────────
//   · Lo que una pantalla pide DESPUÉS de abrirse: un botón que al pulsarse llama a una ruta de
//     admin no pasa por aquí. Para los botones hoy hay un censo (docs/master/SCRUM-1338.md), no
//     una puerta.
//   · El navegador: el banco ejecuta las funciones reales sobre un DOM mínimo. Que `initApp` y
//     `renderView` LLAMEN a esas funciones se comprueba por AST, no arrancando el panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { cargarDashboard, pintarVista, todos, datosDeMuestra } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const { app } = await import('../dist/app.js');
const { getAdminMounts } = await import('../dist/core/http/adminMounts.js');

// ── 1 · LOS GATES, de los routers reales ────────────────────────────────────────────────────
const rolDe = (h) => (h && h.__requiredRole) || null;

function gatesDelServidor() {
  const porClave = new Map();
  const anota = (metodo, ruta, rol) => {
    const k = `${metodo.toUpperCase()} ${ruta}`;
    const previa = porClave.get(k);
    if (previa) { previa.rol = previa.rol || rol; return; }
    porClave.set(k, { metodo: metodo.toUpperCase(), ruta, rol });
  };
  for (const capa of app.router.stack) {
    if (!capa.route) continue;
    const ruta = capa.route.path;
    if (typeof ruta !== 'string' || !ruta.startsWith('/admin')) continue;
    const rol = capa.route.stack.map((s) => rolDe(s.handle)).find(Boolean) || null;
    for (const m of Object.keys(capa.route.methods)) anota(m, ruta, rol);
  }
  for (const montaje of getAdminMounts()) {
    const delMontaje = montaje.gates.map(rolDe).find(Boolean) || null;
    const delUse = montaje.router.stack.filter((l) => !l.route).map((l) => rolDe(l.handle)).find(Boolean) || null;
    for (const capa of montaje.router.stack) {
      if (!capa.route) continue;
      const delaRuta = capa.route.stack.map((s) => rolDe(s.handle)).find(Boolean) || null;
      const rel = capa.route.path === '/' ? '' : capa.route.path;
      for (const m of Object.keys(capa.route.methods)) anota(m, montaje.prefix + rel, delMontaje || delUse || delaRuta);
    }
  }
  return [...porClave.values()].map((r) => ({
    ...r,
    literales: r.ruta.split('/').filter((s) => s && !s.startsWith(':')).length,
    forma: new RegExp('^' + r.ruta.split('/')
      .map((s) => (s.startsWith(':') ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/') + '/?$'),
  }));
}

const GATES = gatesDelServidor();

/** El gate de una petición: la ruta más literal que casa. `null` si el servidor no la tiene. */
function gateDe(metodo, url) {
  const p = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/[?#].*$/, '');
  return GATES.filter((r) => r.metodo === String(metodo).toUpperCase() && r.forma.test(p))
    .sort((a, b) => b.literales - a.literales)[0] || null;
}

// ── 2 · LA BARRA, de `index.html` ───────────────────────────────────────────────────────────
const HTML = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');

function navDe(html) {
  const m = /<nav class="sidebar-nav"[^>]*>([^]*?)<\/nav>/.exec(html);
  assert.ok(m, '🔴 CIEGO: no encuentro <nav class="sidebar-nav"> en index.html');
  return m[1].replace(/<!--[^]*?-->/g, '');
}

/**
 * Monta el nav en el banco y EJECUTA `aplicarRolALaBarra` de `app.js` con ese rol.
 * Devuelve lo que quedó a la vista, leído del DOM después de ejecutarla.
 */
function barraPara(rol, nav) {
  const b = cargarDashboard(RAIZ, { rol });
  assert.equal(typeof b.ctx.aplicarRolALaBarra, 'function', '🔴 `app.js` ya no publica `aplicarRolALaBarra`');
  const cont = b.mk('nav');
  cont.className = 'sidebar-nav';
  b.ctx.document.body.appendChild(cont);
  cont.innerHTML = nav;
  b.ctx.aplicarRolALaBarra(b.ctx.document, rol);
  const oculto = (n) => String(n.style.display) === 'none';
  const entradas = [];
  const secciones = [];
  let actual = null;
  for (const n of cont.children) {
    const clases = String(n.className || '').split(/\s+/);
    if (clases.includes('nav-section-label')) {
      actual = { rotulo: String(n.textContent || '').trim(), oculto: oculto(n), entradas: [] };
      secciones.push(actual);
    } else if (clases.includes('nav-item')) {
      const e = { vista: n.dataset.view, declarada: n.dataset.rol || null, oculta: oculto(n) };
      entradas.push(e);
      if (actual) actual.entradas.push(e);
    }
  }
  return { b, entradas, secciones };
}

// ── 3 · QUÉ PIDE CADA PANTALLA con rol de operario ──────────────────────────────────────────
/** vista → la función que la pinta, del `switch` de `renderView` (AST, no una tabla). */
function funcionesDeVista() {
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');
  const sf = ts.createSourceFile('app.js', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let sw = null;
  let renderView = null;
  let initApp = null;
  (function busca(n) {
    if (ts.isFunctionDeclaration(n) && n.name) {
      if (n.name.text === 'renderView') { renderView = n; (function d(x) { if (ts.isSwitchStatement(x) && !sw) sw = x; ts.forEachChild(x, d); })(n); }
      if (n.name.text === 'initApp') initApp = n;
    }
    ts.forEachChild(n, busca);
  })(sf);
  const mapa = new Map();
  if (sw) {
    for (const c of sw.caseBlock.clauses) {
      if (!ts.isCaseClause(c)) continue;
      const nombre = c.expression.getText(sf).replace(/^['"]|['"]$/g, '');
      const fns = new Set();
      const v = (n) => { if (ts.isIdentifier(n) && /^render\w+View$/.test(n.text) && n.text !== 'renderView') fns.add(n.text); ts.forEachChild(n, v); };
      c.statements.forEach(v);
      const propias = [...fns].filter((f) => f !== 'renderHomeView');
      mapa.set(nombre, nombre === 'home' ? 'renderHomeView' : (propias[0] || null));
    }
  }
  return { mapa, sf, renderView, initApp };
}

const DISPATCH = funcionesDeVista();

/** Datos mínimos para que la pantalla llegue a pedir lo suyo (no son el contrato del servidor). */
function datos(url) {
  const u = String(url);
  if (/\/admin\/merchant(\?|$)/.test(u)) return { id: 1, name: 'Taller', defaultCurrency: 'EUR', country: 'ES' };
  if (/\/admin\/(products|providers)(\?|$)/.test(u)) return { ok: true, items: [] };
  return datosDeMuestra(u);
}

const APERTURAS = new Map();
/** Abre `vista` con ese rol y devuelve cada petición con el gate que le toca. Se mide una vez. */
async function abrir(rol, vista) {
  const clave = `${rol} ${vista}`;
  if (APERTURAS.has(clave)) return APERTURAS.get(clave);
  const fn = DISPATCH.mapa.get(vista);
  const peticiones = [];
  const fetch = async (url, opts) => {
    const metodo = (opts && opts.method) || 'GET';
    const g = gateDe(metodo, url);
    const niega = !!g && g.rol === 'admin' && rol !== 'admin';
    peticiones.push({ metodo, url: String(url).replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, ''), conocida: !!g, rol: g ? g.rol : null, niega });
    const base = { headers: { get: () => 'application/json' }, blob: async () => ({}) };
    if (niega) return { ...base, ok: false, status: 403, json: async () => ({ error: 'forbidden', required_role: 'admin' }), text: async () => '{"error":"forbidden","required_role":"admin"}' };
    return { ...base, ok: true, status: 200, json: async () => datos(url), text: async () => '' };
  };
  const b = cargarDashboard(RAIZ, { rol, red: { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch } });
  b.ctx.appMerchantId = 1;
  b.ctx.appDocumentoSuelto = 'no';
  b.ctx.renderAppView = () => {};
  const v = fn ? await pintarVista(b, fn, ...(vista === 'partes-oficina' ? [{}] : [])) : { error: new Error('sin función de vista') };
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
  const r = { fn, peticiones, error: v.error ? String(v.error.message) : null, noMedida: v.noMedida || null, contenedor: v.contenedor || null };
  APERTURAS.set(clave, r);
  return r;
}

/**
 * EL NÚCLEO, PURO: dada una barra (ya con el rol aplicado) y lo que pide cada vista, qué está mal.
 * Separado de la lectura para poder probarlo con una barra ESTROPEADA sin tocar el disco.
 */
async function veredicto(entradas) {
  const haciaUn403 = [];
  const ocultasSinMotivo = [];
  const ciegas = [];
  for (const e of entradas) {
    const a = await abrir('tecnico', e.vista);
    if (a.error || a.noMedida || a.peticiones.length === 0) { ciegas.push(`${e.vista}: ${a.error || a.noMedida || 'no pidió nada'}`); continue; }
    const negadas = a.peticiones.filter((p) => p.niega).map((p) => `${p.metodo} ${p.url}`);
    if (!e.oculta && negadas.length) haciaUn403.push(`${e.vista} → ${[...new Set(negadas)].join(', ')}`);
    if (e.oculta && negadas.length === 0) ocultasSinMotivo.push(e.vista);
  }
  return { haciaUn403, ocultasSinMotivo, ciegas };
}

const NAV = navDe(HTML);
const BARRA_OPERARIO = barraPara('tecnico', NAV);

// ── SUELOS ──────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1338 · SUELO: los gates salen del servidor real, y el instrumento distingue admin de operario', () => {
  const deAdmin = GATES.filter((r) => r.rol === 'admin').length;
  console.log(`scrum1338 · población: ${GATES.length} rutas /admin · ${deAdmin} de admin · ${GATES.length - deAdmin} sin rol`);
  assert.ok(GATES.length >= 125, `🔴 CIEGO: sólo ${GATES.length} rutas /admin enumeradas (scrum55 exige 125)`);
  assert.equal(gateDe('GET', '/admin/team')?.rol, 'admin', '🔴 CIEGO: `GET /admin/team` no sale como de admin');
  assert.equal(gateDe('GET', '/admin/customers?x=1')?.rol, null, '🔴 CIEGO: `GET /admin/customers` no sale como del operario');
  assert.equal(gateDe('GET', '/admin/jobs/7')?.ruta, '/admin/jobs/:id', '🔴 una ruta con parámetro no casa con su forma');
  assert.equal(gateDe('GET', '/admin/esto-no-existe'), null, 'una ruta que no existe tiene que salir como desconocida');
});

test('SCRUM-1338 · SUELO: el banco ve TODAS las entradas de la barra, y cada una tiene su pantalla', () => {
  const enElHtml = [...NAV.matchAll(/<button[^>]*class="nav-item"[^>]*data-view="([^"]+)"/g)].map((m) => m[1]);
  const rotulosEnElHtml = [...NAV.matchAll(/<div class="nav-section-label"[^>]*>([^<]*)<\/div>/g)].map((m) => m[1].trim());
  console.log(`scrum1338 · barra: ${enElHtml.length} entradas · ${rotulosEnElHtml.length} secciones con rótulo`);
  assert.ok(enElHtml.length >= 10, `🔴 CIEGO: sólo ${enElHtml.length} entradas en la barra`);
  assert.deepEqual(BARRA_OPERARIO.entradas.map((e) => e.vista), enElHtml,
    '🔴 CIEGO: el DOM del banco no ve las mismas entradas que el HTML');
  assert.deepEqual(BARRA_OPERARIO.secciones.map((s) => s.rotulo), rotulosEnElHtml,
    '🔴 CIEGO: el DOM del banco no ve los mismos rótulos de sección que el HTML');
  const sinPantalla = enElHtml.filter((v) => !DISPATCH.mapa.get(v));
  assert.deepEqual(sinPantalla, [], `🔴 entradas de la barra sin función de vista en \`renderView\`: ${sinPantalla.join(', ')}`);
});

// ── LA REGLA ────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1338 · 🔴 ninguna entrada que el OPERARIO ve abre pidiendo una ruta de admin', async () => {
  const v = await veredicto(BARRA_OPERARIO.entradas);
  assert.deepEqual(v.ciegas, [], `🔴 CIEGO: pantallas que no se pudieron medir con rol de operario:\n  ${v.ciegas.join('\n  ')}`);
  assert.deepEqual(v.haciaUn403, [],
    '🔴 El operario VE estas entradas y el servidor le niega lo que piden al abrirse:\n  ' + v.haciaUn403.join('\n  ') +
    '\n\nUna entrada de menú hacia un 403 es peor que no tenerla. Si la pantalla es del admin, declara\n' +
    '`data-rol="admin"` en su <button class="nav-item"> de public/dashboard/index.html. Si es del\n' +
    'operario, lo que sobra es esa petición. ⛔ No se arregla tocando este test ni el `requireRole`.');
});

test('SCRUM-1338 · ✅ y no se le oculta nada que SÍ puede usar: toda entrada oculta pide alguna ruta de admin', async () => {
  const v = await veredicto(BARRA_OPERARIO.entradas);
  assert.deepEqual(v.ocultasSinMotivo, [],
    '🔴 Estas entradas se le OCULTAN al operario y al abrirse no piden ninguna ruta de admin:\n  ' + v.ocultasSinMotivo.join(', ') +
    '\n\nUn barrido que le vacíe el menú es peor que el defecto. Si la pantalla es suya, quítale el `data-rol="admin"`.');
  const visibles = BARRA_OPERARIO.entradas.filter((e) => !e.oculta).map((e) => e.vista);
  console.log(`scrum1338 · el operario ve ${visibles.length} de ${BARRA_OPERARIO.entradas.length}: ${visibles.join(', ')}`);
  assert.ok(visibles.includes('home'), '🔴 al operario se le ha quitado Inicio');
  assert.ok(visibles.length >= 2, `🔴 al operario le quedan ${visibles.length} entradas`);
  for (const vista of visibles) {
    const a = await abrir('tecnico', vista);
    assert.ok(a.peticiones.some((p) => p.conocida && !p.niega),
      `🔴 CIEGO: «${vista}» no llegó a pedirle nada suyo al servidor (pidió: ${a.peticiones.map((p) => p.url).join(', ') || 'nada'})`);
  }
});

test('SCRUM-1338 · la declaración manda sola: se oculta lo declarado de admin, y nada más', () => {
  for (const e of BARRA_OPERARIO.entradas) {
    assert.equal(e.oculta, e.declarada === 'admin', `«${e.vista}»: declarada=${e.declarada} y oculta=${e.oculta}`);
  }
  const admin = barraPara('admin', NAV);
  assert.deepEqual(admin.entradas.filter((e) => e.oculta).map((e) => e.vista), [], '🔴 al ADMIN se le oculta algo de la barra');
  assert.deepEqual(admin.secciones.filter((s) => s.oculto).map((s) => s.rotulo), [], '🔴 al ADMIN se le oculta un rótulo de sección');
  // Un rol que no existe todavía cae del lado RESTRINGIDO, como el operario (allowlist de admin).
  const otro = barraPara('comercial', NAV);
  assert.deepEqual(otro.entradas.filter((e) => e.oculta).map((e) => e.vista),
    BARRA_OPERARIO.entradas.filter((e) => e.oculta).map((e) => e.vista),
    '🔴 un rol desconocido ve entradas de admin: la barra se ha escrito como denylist de «tecnico»');
});

test('SCRUM-1338 · un rótulo de sección sin ninguna entrada debajo tampoco se pinta («CUENTA»)', () => {
  assert.ok(BARRA_OPERARIO.secciones.length >= 1, '🔴 CIEGO: la barra no tiene secciones con rótulo');
  for (const s of BARRA_OPERARIO.secciones) {
    const quedan = s.entradas.filter((e) => !e.oculta).length;
    assert.equal(s.oculto, quedan === 0, `sección «${s.rotulo}»: le quedan ${quedan} entradas y su rótulo ${s.oculto ? 'está oculto' : 'se pinta'}`);
  }
  // Los dos casos existen HOY, o lo de arriba no distingue nada.
  assert.ok(BARRA_OPERARIO.secciones.some((s) => s.oculto), '🔴 CIEGO: ningún rótulo se queda sin entradas; el caso no se está midiendo');
  assert.ok(BARRA_OPERARIO.secciones.some((s) => !s.oculto), '🔴 al operario se le han ocultado TODOS los rótulos');
});

test('SCRUM-1338 · la vista TECLEADA pasa por la misma declaración (`#cobros` no abre Cobros al operario)', () => {
  const { b, entradas } = BARRA_OPERARIO;
  const vedada = (rol, vista) => b.ctx.vistaVedadaPorRol(b.ctx.document, rol, vista);
  for (const e of entradas) {
    assert.equal(vedada('tecnico', e.vista), e.oculta, `«${e.vista}» tecleada por el operario`);
    assert.equal(vedada('admin', e.vista), false, `«${e.vista}» tecleada por el admin`);
  }
  assert.equal(vedada('tecnico', 'quotes-detail'), false, 'una vista sin entrada en la barra no la veta esta función');

  // Y `app.js` las LLAMA: por AST (los comentarios no cuentan), no arrancando el panel.
  const { sf, renderView, initApp } = DISPATCH;
  assert.ok(renderView && initApp, '🔴 CIEGO: no encuentro `renderView` o `initApp` en app.js');
  const llamaA = (nodo, nombre) => {
    let visto = false;
    (function v(n) { if (ts.isCallExpression(n) && n.expression.getText(sf) === nombre) visto = true; ts.forEachChild(n, v); })(nodo);
    return visto;
  };
  assert.ok(llamaA(initApp, 'aplicarRolALaBarra'), '🔴 `initApp` ya no aplica el rol a la barra');
  const primera = renderView.body.statements[0];
  assert.ok(ts.isIfStatement(primera) && llamaA(primera.expression, 'vistaVedadaPorRol') && /renderView\(\s*'home'/.test(primera.thenStatement.getText(sf)),
    '🔴 la PRIMERA sentencia de `renderView` ya no es el veto por rol que manda a Inicio');
});

// ── EL GUARD, VISTO CAER (dos barras estropeadas a propósito, sin tocar el disco) ───────────
test('SCRUM-1338 · 🔴 AUTOPRUEBA: una entrada de admin que nazca SIN declarar, cae; y una del operario declarada de admin, también', async () => {
  // ① La de admin sin declarar. Se elige la primera que HOY está declarada: no es un nombre fijo.
  const deAdmin = BARRA_OPERARIO.entradas.find((e) => e.declarada === 'admin');
  assert.ok(deAdmin, '🔴 CIEGO: no hay ninguna entrada declarada de admin con la que probar');
  const sinDeclarar = NAV.replace(new RegExp(`(data-view="${deAdmin.vista}"[^>]*?) data-rol="admin"`), '$1');
  assert.notEqual(sinDeclarar, NAV, '🔴 CIEGO: la avería no se aplicó');
  const v1 = await veredicto(barraPara('tecnico', sinDeclarar).entradas);
  assert.ok(v1.haciaUn403.some((x) => x.startsWith(`${deAdmin.vista} →`)),
    `🔴 MUDO: «${deAdmin.vista}» sin declarar queda a la vista del operario y el guard no lo dice`);

  // ② La del operario, escondida. Se elige la primera visible que no sea Inicio.
  const suya = BARRA_OPERARIO.entradas.find((e) => !e.oculta && e.vista !== 'home');
  assert.ok(suya, '🔴 CIEGO: no hay ninguna entrada del operario con la que probar');
  const escondida = NAV.replace(new RegExp(`(data-view="${suya.vista}"[^>]*?)>`), '$1 data-rol="admin">');
  assert.notEqual(escondida, NAV, '🔴 CIEGO: la avería no se aplicó');
  const v2 = await veredicto(barraPara('tecnico', escondida).entradas);
  assert.ok(v2.ocultasSinMotivo.includes(suya.vista),
    `🔴 MUDO: «${suya.vista}» se le oculta al operario sin motivo y el guard no lo dice`);
});

// ── EL BOTÓN DE ESTE TICKET ─────────────────────────────────────────────────────────────────
const rotulo = (n) => String(n.textContent || n.innerHTML || '').replace(/\s+/g, ' ').trim();

test('SCRUM-1338 · Productos: «Crear producto» va DESHABILITADO y con su nota para el operario; el admin, igual que siempre', async () => {
  const boton = (a) => todos(a.contenedor).find((n) => n.id === 'pf-create-product');
  const notas = (a) => todos(a.contenedor).filter((n) => String(n.className).split(/\s+/).includes('role-locked-note'));

  const operario = await abrir('tecnico', 'products');
  const bo = boton(operario);
  assert.ok(bo, '🔴 CIEGO: el alta de Productos no pinta su botón con rol de operario');
  assert.equal(gateDe('POST', '/admin/products')?.rol, 'admin', 'SUELO: si el servidor abre el alta al operario, este veto sobra');
  assert.equal(bo.disabled, true, '🔴 el operario puede pulsar «Crear producto», y el servidor le contestará 403');
  assert.ok(String(bo.className).split(/\s+/).includes('role-locked'), 'el botón no lleva la clase del veto por rol');
  // La nota es la de ESTE botón: lo que va justo detrás de su fila. Buscar «alguna nota en la
  // pantalla» salía verde sin ella —la mutación M9 era MUDA—, porque con el catálogo vacío
  // «Cargar el catálogo de mi gremio» ya pinta la suya unas líneas más abajo.
  const fila = bo._padre;
  const hermanos = fila._padre.hijos;
  const detras = hermanos[hermanos.indexOf(fila) + 1];
  assert.ok(detras && String(detras.className).split(/\s+/).includes('role-locked-note'),
    '🔴 el botón está deshabilitado y no dice por qué (un control que no explica por qué no se usa, no se deshabilita)');
  assert.equal(rotulo(detras), 'Esta acción es solo para administradores. Pídeselo a quien gestiona la cuenta.');

  const admin = await abrir('admin', 'products');
  const ba = boton(admin);
  assert.ok(ba, '🔴 CIEGO: el alta de Productos no pinta su botón con rol de admin');
  assert.equal(ba.disabled, false, '🔴 al ADMIN se le ha deshabilitado «Crear producto»');
  assert.equal(notas(admin).length, 0, '🔴 al ADMIN se le pinta la nota de «sólo administradores»');
});
