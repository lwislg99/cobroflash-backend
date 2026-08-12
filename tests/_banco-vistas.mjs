// tests/_banco-vistas.mjs — SCRUM-417 · CARGAR una vista del dashboard, no leerla.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL AGUJERO QUE TAPA
//
// «existe en el router» y «se abre en el navegador» NO son la misma afirmación. El test de
// SCRUM-420 comprobaba que cada entrada de la barra tuviera su `case` en `renderView` — lo único
// que se podía medir desde Node entonces— y una pantalla que revienta al cargar pasa esa
// comprobación y le falla al profesional igual.
//
// `tests/public-js-parsea.test.mjs` cubre el escalón de antes: que el fichero PARSEE. Es el que
// habría cazado el defecto histórico de `exportView.js` (un backtick dentro del template literal,
// arreglado en `d5cd3b7c`). Pero parsear no es ejecutar, y ejecutar no es pintar.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LAS TRES VECES QUE ESTE BANCO DIO ROJO Y EL ROJO ERA SUYO
//
// Se escriben porque son la diferencia entre un banco y un generador de falsos hallazgos. Las
// tres versiones anteriores «encontraron defectos» en `exportView.js` que NO existen:
//
//   1. `getElementById` devolvía `null` siempre → «Cannot read properties of null». La vista hace
//      `container.innerHTML = …` y luego busca por id, que es lo que funciona en el navegador
//      cuando el contenedor está en el documento. **El mini-DOM tiene que resolver los id que
//      declara el marcado asignado.**
//   2. Se cargaba `exportView.js` SOLO → «ERROR_NO_ES_FICHERO is not defined». Es un `const` de
//      nivel superior de `api.js`, y los scripts clásicos **comparten script scope**. **Hay que
//      cargar los `<script src>` de `index.html` EN ORDEN y en UN SOLO contexto.**
//   3. `window` era un objeto aparte del global → «la vista no publica su función». En el
//      navegador `window` ES el global. **`ctx.window = ctx`.**
//
// > Un banco infiel no mide de menos: mide OTRA COSA, y su rojo se lee igual que un hallazgo.
//
// Sin dependencias nuevas (regla 36): `node:vm` y un DOM de mentira, como el de SCRUM-296.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-451 · `querySelector` DE VERDAD — el hueco que dejó ciegas a dos vistas
//
// Era `() => null`, fijo. Con eso, `invoicesView` y `productsView` **reventaban al montarlas**
// (`Cannot read properties of null (reading 'addEventListener')`), y SCRUM-448 tuvo que declararlas
// SIN MEDIR: nadie podía saber qué hacen sin cobertura, y una es la de facturas.
//
// 🔴 Y LO PEOR NO ERA QUE FALTARA: era que MENTÍA EN SILENCIO. Un `null` fijo es indistinguible de
// «ese nodo no existe», así que un test podía dar por bueno «no está» sin que nadie hubiera mirado.
// Por eso, además de resolver, esto **anota lo que no sabe resolver** en `reg.selectoresNoSoportados`:
// un banco que no sabe algo tiene que poder declararse ciego, no devolver `null` y callarse.
//
// LO QUE SOPORTA: listas separadas por comas · descendencia por espacio · y selectores simples
// compuestos de `etiqueta`, `#id`, `.clase`, `[attr]` y `[attr="valor"]` (con `data-*`).
// LO QUE NO: `>`, `+`, `~`, `*` y pseudoclases. Eso NO devuelve `null` a secas: se anota.
// ═════════════════════════════════════════════════════════════════════════════════════════

const SIMPLE = /^([a-zA-Z][\w-]*)?((?:[#.][\w-]+|\[[^\]]+\])*)$/;

function casaSimple(n, sel) {
  const m = SIMPLE.exec(sel.trim());
  if (!m) return null; // no soportado
  if (m[1] && n.tagName !== m[1].toUpperCase()) return false;
  for (const t of (m[2] || '').match(/[#.][\w-]+|\[[^\]]+\]/g) || []) {
    if (t[0] === '#') { if (n.id !== t.slice(1)) return false; continue; }
    if (t[0] === '.') {
      if (!String(n.className || '').split(/\s+/).includes(t.slice(1))) return false;
      continue;
    }
    const a = /^\[([\w-]+)(?:\s*=\s*["']?([^"'\]]*)["']?)?\]$/.exec(t);
    if (!a) return null;
    const valor = a[1].startsWith('data-')
      ? n.dataset[a[1].slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())]
      : (a[1] === 'class' ? n.className : (a[1] === 'id' ? n.id : n.getAttribute(a[1])));
    if (valor === undefined || valor === null) return false;
    if (a[2] !== undefined && String(valor) !== a[2]) return false;
  }
  return true;
}

/** ¿Casa `n` con un selector con descendencia («a b c»)? Sube por `_padre` para los antepasados. */
function casa(n, sel) {
  const partes = sel.trim().split(/\s+/);
  const propio = casaSimple(n, partes[partes.length - 1]);
  if (propio !== true) return propio; // false, o null si no se sabe
  let p = n._padre;
  for (let i = partes.length - 2; i >= 0; i--) {
    let encontrado = false;
    while (p) {
      const r = casaSimple(p, partes[i]);
      if (r === null) return null;
      if (r) { encontrado = true; p = p._padre; break; }
      p = p._padre;
    }
    if (!encontrado) return false;
  }
  return true;
}

/** Busca en el subárbol de `raiz` (sin incluirla, como en el navegador). */
function buscar(raiz, selector, reg, soloUno) {
  const out = [];
  for (const sel of String(selector).split(',')) {
    const pila = [...raiz.hijos];
    while (pila.length) {
      const n = pila.shift();
      const r = casa(n, sel);
      if (r === null) {
        if (reg && !reg.selectoresNoSoportados.includes(selector)) reg.selectoresNoSoportados.push(selector);
        break;
      }
      if (r && !out.includes(n)) { out.push(n); if (soloUno) return out; }
      pila.unshift(...n.hijos);
    }
  }
  return out;
}

/**
 * SCRUM-457 · UN `localStorage` QUE GUARDA DE VERDAD.
 *
 * 🔴 Antes era `{ getItem: () => null, setItem() {}, removeItem() {} }`: un almacén donde escribir
 * no escribe. Con eso, «después del logout no queda ni un dato» sale VERDE aunque el logout no
 * borre absolutamente nada — porque nunca hubo nada que borrar. Es el mismo verde vacío que el
 * `fetch` que ignoraba el `signal` en SCRUM-451, y con las consecuencias del art. 32 detrás.
 *
 * Se implementa el API entero que usa el purgado —`length` y `key(i)`, no solo get/set/remove—
 * porque recorrer el almacén es justamente lo que hay que poder medir. `key(i)` se reindexa al
 * borrar, igual que en el navegador: un bucle que borre mientras recorre se salta la mitad, y ese
 * defecto tiene que poder salir aquí.
 *
 * @param inicial objeto `{clave: valor}` con lo que ya hubiera guardado.
 */
export function almacenDeTeclas(inicial = {}) {
  const m = new Map(Object.entries(inicial || {}));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem(k, v) { m.set(String(k), String(v)); },
    removeItem(k) { m.delete(String(k)); },
    clear() { m.clear(); },
    /** Solo para los tests: lo que queda dentro, para poder afirmar sobre ello. */
    _contenido: () => Object.fromEntries(m),
  };
}

/** Un nodo del DOM de mentira: lo justo para que una vista corra y se pueda mirar lo que pintó. */
export function nodo(tag, reg) {
  const n = {
    tagName: String(tag).toUpperCase(),
    className: '', _id: '', type: '', value: '', disabled: false, checked: false,
    href: '', download: '', title: '', placeholder: '', name: '', src: '',
    style: { cssText: '', color: '', display: '', setProperty() {} },
    dataset: {}, hijos: [], _texto: '', _html: '', _padre: null,
    appendChild(h) { if (h) h._padre = n; n.hijos.push(h); return h; },
    append(...h) { for (const x of h) { if (x) x._padre = n; } n.hijos.push(...h); },
    // ⚠️ SCRUM-444 · al quitar un nodo se DESREGISTRA su id. En el navegador, `getElementById` no
    // encuentra lo que ya no está en el documento; aquí seguía encontrándolo, así que un test que
    // borrara un contenedor y lo volviera a pedir recibía el nodo MUERTO y seguía escribiendo en
    // él. Lo cazó la prueba de rojo de SCRUM-444: la inyección del defecto salía VERDE porque la
    // pila borrada se «encontraba» igual.
    removeChild(h) {
      n.hijos = n.hijos.filter((x) => x !== h);
      if (h) { h._padre = null; if (h._id && reg.porId.get(h._id) === h) reg.porId.delete(h._id); }
    },
    insertBefore(h) { if (h) h._padre = n; n.hijos.unshift(h); return h; },
    // SCRUM-460 · `prepend`. No existía, y por eso `albaranDetailView` REVENTABA al montarse —
    // quedó reportado como hueco en SCRUM-451 y ahora bloqueaba el test que decide de H1. Nada
    // podía depender de él antes, porque llamarlo era un `TypeError`.
    prepend(...h) { for (const x of h) { if (x) x._padre = n; } n.hijos.unshift(...h); },
    // ⚠️ SCRUM-444 · `children`, `firstElementChild` y un `remove()` QUE DE VERDAD QUITA.
    //
    // Antes `remove()` era un NO-OP y `children` no existía. Con eso, una vista que gestione una
    // lista de nodos —quitar el más antiguo, contar los vivos— se medía en un DOM **donde quitar
    // no quita**: el test pasaría o fallaría por motivos que no son los del producto. Es la clase
    // de banco infiel que advierte la cabecera de este fichero, y por eso se corrige aquí en vez
    // de rodearlo desde el test.
    get children() { return n.hijos; },
    get firstElementChild() { return n.hijos[0] || null; },
    get lastElementChild() { return n.hijos[n.hijos.length - 1] || null; },
    remove() { if (n._padre) n._padre.removeChild(n); },
    // ⚠️ SCRUM-444 · UN `id` ASIGNADO A MANO TAMBIÉN SE ENCUENTRA.
    //
    // `reg.porId` sólo se rellenaba desde `innerHTML`, así que
    // `const d = createElement('div'); d.id = 'x'; body.appendChild(d);` NO se encontraba nunca con
    // `getElementById('x')` — cuando en el navegador sí. Eso iba a producir un **falso hallazgo**
    // en SCRUM-444: la pila de avisos se buscaba, no aparecía, y se creaba una nueva por aviso, con
    // lo que «no se apilan» habría sido culpa del banco y no del producto.
    get id() { return n._id; },
    set id(v) { n._id = String(v); if (n._id) reg.porId.set(n._id, n); },
    // SCRUM-285: los oyentes se GUARDAN y se pueden disparar. Antes eran un no-op y por eso
    // SCRUM-417 declaró «no se pulsa nada» como hueco. Hacía falta de verdad: los dos estados
    // vacíos de Cobros —«no hay ninguno» y «tu filtro los esconde»— solo se distinguen PULSANDO un
    // filtro, y son la diferencia entre informar y decirle al profesional que no le deben nada.
    _oyentes: {},
    addEventListener(tipo, fn) { (n._oyentes[tipo] = n._oyentes[tipo] || []).push(fn); },
    removeEventListener(tipo, fn) {
      n._oyentes[tipo] = (n._oyentes[tipo] || []).filter((f) => f !== fn);
    },
    /** Dispara los oyentes de un tipo. Devuelve cuántos corrieron: 0 se lee igual que «no pasó nada». */
    disparar(tipo) {
      const fns = n._oyentes[tipo] || [];
      for (const f of fns) f.call(n, { type: tipo, target: n, preventDefault() {}, stopPropagation() {} });
      return fns.length;
    },
    dispararClick() { return n.disparar('click'); },
    click() { return n.disparar('click'); },
    focus() {}, blur() {},
    // SCRUM-451 · los atributos se GUARDAN. Antes `setAttribute` era un no-op y `getAttribute`
    // devolvía `null` siempre, así que `[aria-hidden="true"]` o `[type="checkbox"]` no se podían
    // resolver — y una vista que pusiera un atributo y luego lo buscara medía el banco, no el
    // producto. `id`, `class` y `data-*` se reflejan en sus campos, como en el navegador.
    _attrs: {},
    setAttribute(k, v) {
      const clave = String(k); n._attrs[clave] = String(v);
      if (clave === 'id') n.id = String(v);
      else if (clave === 'class') n.className = String(v);
      else if (clave.startsWith('data-')) {
        n.dataset[clave.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(v);
      }
    },
    getAttribute: (k) => (Object.prototype.hasOwnProperty.call(n._attrs, String(k)) ? n._attrs[String(k)] : null),
    hasAttribute: (k) => Object.prototype.hasOwnProperty.call(n._attrs, String(k)),
    removeAttribute(k) { delete n._attrs[String(k)]; },
    querySelector: (s) => buscar(n, s, reg, true)[0] || null,
    querySelectorAll: (s) => buscar(n, s, reg, false),
    /** Como el del navegador: se mira a SÍ MISMO y luego sube. */
    closest(s) {
      let p = n;
      while (p) { if (casa(p, s) === true) return p; p = p._padre; }
      return null;
    },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }),
    set textContent(v) { n._texto = String(v); n.hijos = []; },
    get textContent() { return n._texto; },
    set innerHTML(v) {
      n._html = String(v);
      if (v === '') { n.hijos = []; return; }
      // Lo que hace el navegador: el marcado se vuelve árbol. Sin esto, toda vista que pinte con
      // `innerHTML` y luego busque por id daría un rojo falso.
      //
      // SCRUM-285: se representan TODAS las etiquetas con atributos, no solo las que llevan `id`,
      // y se les copia `id`, `class`, `data-*` y su texto. Antes solo entraban las de `id`, así que
      // un bloque marcado con `data-…` —el estado vacío de Cobros— era invisible para el banco y su
      // test daba un rojo que era del banco. Es plano a propósito: no anida, y se declara.
      // SCRUM-451: se representan TAMBIÉN las etiquetas SIN atributos. Antes se saltaban, y con eso
      // un `card.innerHTML = '<div>…</div>'` seguido de `card.querySelector('div')` devolvía `null`
      // y la vista reventaba —`settingsView` lo hace— por un hueco del banco, no del producto.
      for (const m of String(v).matchAll(/<(\w+)([^>]*)>([^<]*)/g)) {
        const attrs = m[2] || '';
        const h = nodo(m[1], reg);
        const id = attrs.match(/\bid="([^"]+)"/);
        const cls = attrs.match(/\bclass="([^"]+)"/);
        if (id) { h.id = id[1]; reg.porId.set(id[1], h); }
        if (cls) h.className = cls[1];
        for (const d of attrs.matchAll(/\bdata-([\w-]+)="([^"]*)"/g)) {
          h.dataset[d[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = d[2];
        }
        const texto = (m[3] || '').trim();
        if (texto) h.textContent = texto;
        n.hijos.push(h);
      }
    },
    get innerHTML() { return n._html; },
  };
  return n;
}

export function todos(n, out = []) { out.push(n); for (const h of n.hijos) todos(h, out); return out; }

/** Los `<script src>` de `dashboard/index.html`, EN SU ORDEN. */
export function scriptsDelDashboard(raiz) {
  const html = fs.readFileSync(path.join(raiz, 'public/dashboard/index.html'), 'utf8');
  return [...html.matchAll(/<script src="\.\/([^"]+)"><\/script>/g)].map((m) => m[1]);
}

/**
 * Monta el dashboard como lo monta el navegador y devuelve el contexto vivo.
 *
 * @param opciones.datos  qué devuelve `apiRequest` (por defecto `{}`)
 * @param opciones.rol    `window.appUserRole` (varias vistas se bifurcan por él)
 */
/**
 * SCRUM-474 fase 2 · LOS CUBOS DEL FILTRO DE COBROS, por donde llegan de verdad.
 *
 * En el producto los recibe `app.js` en el ARRANQUE (`/admin/me`) y los deja en
 * `window.appCobrosCubos`, así que el banco los pone en el contexto igual. Servirlos con la
 * respuesta de `/admin/cobros` mediría una pantalla que ningún navegador pinta.
 *
 * Salen de `cubosDeMetodo` **importada de `dist`** —la misma función que sirve la ruta—, no de una
 * lista escrita aquí: un banco con su propia lista es un verde que no significa nada.
 */
let _cubosDelArranque = null;
function cubosDelArranque() {
  if (!_cubosDelArranque) {
    const m = require('../dist/modules/billing/domain/metodoDeCobro.js');
    _cubosDelArranque = m.cubosDeMetodo(m.ROTULO_SIN_METODO);
  }
  return _cubosDelArranque;
}

export function cargarDashboard(raiz, opciones = {}) {
  // `selectoresNoSoportados`: SCRUM-451 · lo que el mini-DOM NO sabe resolver. Un banco que no sabe
  // algo se declara ciego; devolver `null` y callarse es lo que dejó dos vistas sin medir.
  const reg = { porId: new Map(), errores: [], idsNoResueltos: [], selectoresNoSoportados: [] };
  const mk = (t) => nodo(t, reg);

  const doc = {
    createElement: mk, createElementNS: mk,
    createDocumentFragment: () => mk('fragment'),
    createTextNode: (t) => { const n = mk('#text'); n.textContent = t; return n; },
    getElementById(id) {
      const n = reg.porId.get(id) || null;
      if (!n) reg.idsNoResueltos.push(id);
      return n;
    },
    // El `document` busca en TODO el árbol: su `body` es la raíz que ven las vistas.
    querySelector: (sel) => doc.body.querySelector(sel),
    querySelectorAll: (sel) => doc.body.querySelectorAll(sel),
    addEventListener() {}, removeEventListener() {},
    body: mk('body'), documentElement: mk('html'), head: mk('head'),
    readyState: 'complete', cookie: '',
  };

  const ctx = {
    document: doc,
    location: { href: 'https://yaqu.app/dashboard/', hash: '', pathname: '/dashboard/', search: '', origin: 'https://yaqu.app' },
    // SCRUM-362 (H7): si el test trae un ESCENARIO DE RED (`_banco-red.mjs`), manda el suyo — ahí
    // `onLine` puede mentir, que es medio escenario de «acepta y no entrega».
    navigator: opciones.red?.navigator
      ?? { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    localStorage: almacenDeTeclas(opciones.localStorage),
    sessionStorage: almacenDeTeclas(opciones.sessionStorage),
    // 🔴 EL FIXTURE VA EN `fetch`, NO EN `apiRequest` — corregido en SCRUM-432.
    //
    // SCRUM-417 dejó aquí un `apiRequest` de mentira y declaró como hueco que «el banco sirve `{}`
    // a apiRequest». El hueco era real y **la causa estaba mal escrita**: `api.js` define su propio
    // `apiRequest` de nivel superior, así que al cargarse **PISA** el del banco. Lo que las vistas
    // llamaban era el de verdad, contra un `fetch` que devolvía `{}` pasara lo que pasara.
    //
    // Servir los datos por `fetch` es lo que hace el banco fiel: se ejercita `apiRequest` ENTERO
    // —sus errores tipados, su `res.json()`, su trato del 204— en vez de saltárselo.
    //
    // `datos` puede ser un valor (igual para toda ruta) o una función `(ruta, opciones)`.
    //
    // SCRUM-474 fase 2 · `/admin/cobros` pasó de array a `{ cobros, cubos }`. El banco sirve la
    // MISMA forma que el servidor —y los cubos salen de la MISMA función, importada de `dist`, no
    // de una lista escrita aquí— para que un test que pase un array siga midiendo la pantalla real
    // y no una respuesta que ningún servidor devuelve.
    apiRequest: async (ruta) => (typeof opciones.datos === 'function' ? opciones.datos() : (opciones.datos ?? {})),
    // SCRUM-362 (H7): con escenario de red, el `fetch` es el suyo. Sin él, el de siempre —una red
    // que responde bien— para no cambiar lo que ya miden los demás tests.
    fetch: opciones.red?.fetch ?? (async (url, opts) => ({
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: async () => (typeof opciones.datos === 'function' ? opciones.datos(String(url), opts) : (opciones.datos ?? {})),
      blob: async () => ({}), text: async () => '',
    })),
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    requestAnimationFrame: (f) => setTimeout(f, 0),
    Intl, Date, Array, Number, String, Boolean, Object, JSON, isNaN, parseInt, parseFloat,
    Math, Promise, Error, TypeError, RegExp, Map, Set, Symbol, encodeURIComponent, decodeURIComponent,
    URL: globalThis.URL, URLSearchParams: globalThis.URLSearchParams,
    Blob: class {}, FormData: class {}, FileReader: class {}, AbortController,
    TextEncoder, TextDecoder, btoa: globalThis.btoa, atob: globalThis.atob,
    console: { log() {}, warn() {}, info() {}, debug() {}, error(...a) { reg.errores.push(a.map(String).join(' ')); } },
    alert() {}, confirm: () => true, prompt: () => null, open: () => ({ focus() {} }),
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    appUserRole: opciones.rol ?? 'admin',
    // SCRUM-474 fase 2 · lo que `app.js` deja aquí al arrancar. Va SIEMPRE, también con escenario
    // de red caída: en el producto llega antes de que la vista pida nada, y esa es justamente la
    // propiedad que los suelos de SCRUM-448 miden — la barra de filtros existe aunque la red no.
    appCobrosCubos: opciones.cobrosCubos ?? cubosDelArranque(),
  };
  // 🔴 En el navegador `window` ES el objeto global. Sin esto, un `function f(){}` de nivel
  // superior no aparecería en `window` y el banco diría que la vista no publica su función.
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);

  const scripts = scriptsDelDashboard(raiz);
  const fallos = [];
  for (const rel of scripts) {
    const f = path.join(raiz, 'public/dashboard', rel);
    if (!fs.existsSync(f)) { fallos.push({ fichero: rel, error: 'declarado en index.html y NO EXISTE en el árbol' }); continue; }
    try {
      vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: rel });
    } catch (e) {
      // El navegador descarta el fichero ENTERO ante un error de carga; se anota con su sitio.
      const linea = (e.stack || '').split('\n').find((l) => l.includes(rel)) || '';
      fallos.push({ fichero: rel, error: `${e.name}: ${e.message}`, sitio: linea.trim() });
    }
  }
  return { ctx, reg, scripts, fallos, mk };
}

/**
 * Pinta una vista y devuelve lo que salió. **No lanza**: devuelve el error, para que el test
 * pueda enseñar el mensaje en vez de morir con una traza sin contexto.
 */
export async function pintarVista(banco, nombreFn) {
  const fn = banco.ctx[nombreFn];
  if (typeof fn !== 'function') {
    return { error: new Error(`la vista no publica \`${nombreFn}\` (es ${typeof fn})`), contenedor: null };
  }
  const contenedor = banco.mk('div');
  const idsAntes = banco.reg.idsNoResueltos.length;
  try {
    const r = fn(contenedor);
    // 🔴 SCRUM-448 · SE ESPERA LA VISTA **O** UNOS TICKS, LO QUE PASE ANTES.
    //
    // El `await r` a secas colgaba el test PARA SIEMPRE en cuanto la vista era `async` y esperaba
    // una petición que no vuelve — que es justo el escenario «acepta y no entrega» de SCRUM-362, o
    // sea el que este banco existe para poder montar. El propio banco no podía usar su escenario.
    //
    // Con el tope, la vista queda **a medio pintar**, que es exactamente lo que hay que mirar: qué
    // enseña el producto MIENTRAS la respuesta no ha llegado. No es una tolerancia: es la única
    // forma de observar un estado que por definición no termina.
    const ticks = (async () => { for (let i = 0; i < 10; i++) await new Promise((res) => setImmediate(res)); })();
    if (r && typeof r.then === 'function') await Promise.race([r, ticks]);
    await ticks;
  } catch (e) {
    return { error: e, contenedor };
  }
  return {
    error: null,
    contenedor,
    nodos: todos(contenedor).length,
    idsNoResueltos: banco.reg.idsNoResueltos.slice(idsAntes),
    erroresDeConsola: banco.reg.errores.slice(),
  };
}
