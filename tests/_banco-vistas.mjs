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

/** Un nodo del DOM de mentira: lo justo para que una vista corra y se pueda mirar lo que pintó. */
export function nodo(tag, reg) {
  const n = {
    tagName: String(tag).toUpperCase(),
    className: '', id: '', type: '', value: '', disabled: false, checked: false,
    href: '', download: '', title: '', placeholder: '', name: '', src: '',
    style: { cssText: '', color: '', display: '', setProperty() {} },
    dataset: {}, hijos: [], _texto: '', _html: '',
    appendChild(h) { n.hijos.push(h); return h; },
    append(...h) { n.hijos.push(...h); },
    removeChild(h) { n.hijos = n.hijos.filter((x) => x !== h); },
    insertBefore(h) { n.hijos.unshift(h); return h; },
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
    remove() {}, focus() {}, blur() {},
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
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
      for (const m of String(v).matchAll(/<(\w+)([^>]*)>([^<]*)/g)) {
        const attrs = m[2] || '';
        if (!/\b(id|class|data-)/.test(attrs)) continue;
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
export function cargarDashboard(raiz, opciones = {}) {
  const reg = { porId: new Map(), errores: [], idsNoResueltos: [] };
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
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    body: mk('body'), documentElement: mk('html'), head: mk('head'),
    readyState: 'complete', cookie: '',
  };

  const ctx = {
    document: doc,
    location: { href: 'https://yaqu.app/dashboard/', hash: '', pathname: '/dashboard/', search: '', origin: 'https://yaqu.app' },
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
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
    apiRequest: async () => (typeof opciones.datos === 'function' ? opciones.datos() : (opciones.datos ?? {})),
    fetch: async (url, opts) => ({
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: async () => (typeof opciones.datos === 'function' ? opciones.datos(String(url), opts) : (opciones.datos ?? {})),
      blob: async () => ({}), text: async () => '',
    }),
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
    if (r && typeof r.then === 'function') await r;
    for (let i = 0; i < 10; i++) await new Promise((res) => setImmediate(res));
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
