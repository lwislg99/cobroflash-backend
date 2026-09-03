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
// SCRUM-670 · el ÚNICO sitio del repo donde se lee un `<script>` de un marcado.
import { scriptsDeLaPagina, rutaDelDashboard, hojasDeLaPagina } from './_scripts-de-la-pagina.mjs';
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

// SCRUM-634 · un atributo del marcado: con comillas dobles, simples, o SIN VALOR
// (`<input required>`), que en el navegador vale cadena vacía y NO `null` — que es justo la
// diferencia entre «está puesto» y «no está».
const ATRIBUTO = /(?:^|\s)([A-Za-z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;

// SCRUM-634 · LOS CAMPOS QUE EN EL NAVEGADOR **REFLEJAN** un atributo del mismo nombre, con el
// valor que `nodo()` les da de fábrica. Si uno trae algo distinto del de fábrica pero `_attrs`
// no lo tiene, el banco TIENE el dato y la consulta NO LO VE: eso se grita, no se calla.
//
// FUERA A PROPÓSITO: `value` y `checked`, porque en el navegador el campo NO refleja el
// atributo después de escribir o de marcar —ahí devolver `false` es lo FIEL, no un hueco—; e
// `id` y `class`, que el matcher ya resuelve por su campo unas líneas más abajo.
const REFLEJADOS = new Map([
  ['type', ''], ['name', ''], ['href', ''], ['src', ''],
  ['title', ''], ['placeholder', ''], ['download', ''], ['disabled', false],
]);

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
    if (valor === undefined || valor === null) {
      // SCRUM-634 · AQUÍ VIVÍA EL NULL MUDO. Ahora solo hay dos salidas, y ninguna calla:
      //   · el atributo no está en ninguna parte del nodo → `false`, que es la verdad;
      //   · el nodo SÍ lleva el dato en su campo reflejado y `_attrs` no → se GRITA.
      //
      // El segundo caso es el único que queda tras copiar todo el marcado: un nodo hecho con
      // `createElement` al que la vista le asigna el CAMPO (`i.name = 'x'`) en vez del atributo.
      const defecto = REFLEJADOS.get(a[1]);
      if (defecto !== undefined && n[a[1]] !== undefined && n[a[1]] !== defecto) {
        throw new Error(
          `[banco de vistas] el selector "${sel}" pregunta por el atributo "${a[1]}", que este `
          + `<${String(n.tagName).toLowerCase()}> SÍ lleva en su campo `
          + `(${JSON.stringify(n[a[1]])}) pero no en sus atributos. El banco no puede `
          + `contestar y NO va a devolver null: usa setAttribute() al construir el nodo, o `
          + `pon el atributo en el marcado. (SCRUM-634)`,
        );
      }
      return false;
    }
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
/**
 * 🔴 SCRUM-697 · INSERTAR **MUEVE**. Un nodo está en un sitio, no en dos.
 *
 * En el navegador, meter un nodo en un padre lo desengancha del que tuviera. Aquí las cuatro
 * inserciones sólo hacían `hijos.push`/`unshift`, así que el nodo se quedaba colgando de los
 * DOS y todo recorrido pasaba dos veces por él y por su descendencia.
 *
 * Lo destapó `customersView`, que hace DOM de manual perfectamente legítimo: mete la tabla en
 * el `table-scroll` (l. 183) y luego la mueve al `data-card` (l. 207). Medido: la vista se
 * llama UNA vez, crea UNA tabla, y aun así el recorrido daba 60 nodos para 41 —`tablas[0] ===
 * tablas[1]` era `true`—, de donde salían «16 `<th>` para 8 columnas».
 *
 * NO producía rojos falsos: producía MEDICIONES falsas, que es de donde salen los verdes
 * falsos. Y el modo de fallo más probable era el peor — ver un test pedir 8, verlo caer con 16
 * y «arreglarlo» poniendo 16, fosilizando el defecto dentro de la aserción.
 *
 * ⚠️ NO SE HACE CON `removeChild`, y esto es lo delicado: `removeChild` DESREGISTRA el id a
 * propósito (SCRUM-444), porque en el navegador `getElementById` no encuentra lo que ya no
 * está en el documento. Pero MOVER no es QUITAR: el nodo sigue en el documento. Si el
 * desenganche borrase el id, toda vista que mueva un nodo con id lo perdería en silencio —
 * peor que el defecto que se venía a quitar. Se desengancha por IDENTIDAD y sin tocar
 * `reg.porId`.
 */
function desengancha(h) {
  if (h && h._padre) h._padre.hijos = h._padre.hijos.filter((x) => x !== h);
}

export function nodo(tag, reg) {
  const n = {
    tagName: String(tag).toUpperCase(),
    className: '', _id: '', type: '', value: '', disabled: false, checked: false,
    href: '', download: '', title: '', placeholder: '', name: '', src: '',
    style: { cssText: '', color: '', display: '', setProperty() {} },
    dataset: {}, hijos: [], _texto: '', _html: '', _padre: null,
    // SCRUM-697 · las CUATRO inserciones desenganchan antes de insertar. Si sólo lo hiciera
    // `appendChild`, la próxima vista que use `prepend` traería el mismo síntoma con otra
    // cara y costaría otro ticket entenderlo.
    appendChild(h) { if (h) { desengancha(h); h._padre = n; } n.hijos.push(h); return h; },
    append(...h) { for (const x of h) { if (x) { desengancha(x); x._padre = n; } } n.hijos.push(...h); },
    // ⚠️ SCRUM-444 · al quitar un nodo se DESREGISTRA su id. En el navegador, `getElementById` no
    // encuentra lo que ya no está en el documento; aquí seguía encontrándolo, así que un test que
    // borrara un contenedor y lo volviera a pedir recibía el nodo MUERTO y seguía escribiendo en
    // él. Lo cazó la prueba de rojo de SCRUM-444: la inyección del defecto salía VERDE porque la
    // pila borrada se «encontraba» igual.
    removeChild(h) {
      n.hijos = n.hijos.filter((x) => x !== h);
      if (h) { h._padre = null; if (h._id && reg.porId.get(h._id) === h) reg.porId.delete(h._id); }
    },
    insertBefore(h) { if (h) { desengancha(h); h._padre = n; } n.hijos.unshift(h); return h; },
    // SCRUM-460 · `prepend`. No existía, y por eso `albaranDetailView` REVENTABA al montarse —
    // quedó reportado como hueco en SCRUM-451 y ahora bloqueaba el test que decide de H1. Nada
    // podía depender de él antes, porque llamarlo era un `TypeError`.
    prepend(...h) { for (const x of h) { if (x) { desengancha(x); x._padre = n; } } n.hijos.unshift(...h); },
    // 🔴 SCRUM-698 · `insertAdjacentHTML`. NO EXISTÍA, y por eso `renderSettingsView` REVENTABA
    // al montarse: la vista pone la nota del IBAN con
    // `fIban.wrapper.querySelector('label').insertAdjacentHTML('afterend', …)`, que es DOM de
    // manual y perfectamente legítimo. Es el mismo hueco que `prepend` (SCRUM-460) y
    // `parentNode` (SCRUM-609): una pantalla entera fuera del alcance del banco por una API que
    // el banco no tenía, no por nada del producto.
    //
    // Se apoya en el mismo parser que `innerHTML` —no se escribe un segundo— y respeta las
    // cuatro posiciones del estándar. `beforebegin`/`afterend` necesitan padre: sin él el
    // navegador NO hace nada, y aquí tampoco, en vez de inventarse un sitio donde ponerlo.
    insertAdjacentHTML(posicion, html) {
      const cuna = nodo('div', reg);
      cuna.innerHTML = String(html ?? '');
      const nuevos = cuna.hijos.slice();
      for (const h of nuevos) h._padre = null;
      const dentro = (i) => { for (const h of nuevos) { desengancha(h); h._padre = n; } n.hijos.splice(i, 0, ...nuevos); };
      const fuera = (desplaza) => {
        const p = n._padre;
        if (!p) return; // el navegador no hace nada sin padre; aquí tampoco se inventa uno
        const i = p.hijos.indexOf(n);
        for (const h of nuevos) { desengancha(h); h._padre = p; }
        p.hijos.splice(i < 0 ? p.hijos.length : i + desplaza, 0, ...nuevos);
      };
      const donde = String(posicion || '').toLowerCase();
      if (donde === 'afterbegin') dentro(0);
      else if (donde === 'beforeend') dentro(n.hijos.length);
      else if (donde === 'beforebegin') fuera(0);
      else if (donde === 'afterend') fuera(1);
      // Una posición que no existe NO se trata como `beforeend`: el navegador lanza, y adivinar
      // aquí pondría el marcado en un sitio que el producto no pidió.
      else throw new SyntaxError(`insertAdjacentHTML: posición no válida «${posicion}»`);
    },
    // ⚠️ SCRUM-444 · `children`, `firstElementChild` y un `remove()` QUE DE VERDAD QUITA.
    //
    // Antes `remove()` era un NO-OP y `children` no existía. Con eso, una vista que gestione una
    // lista de nodos —quitar el más antiguo, contar los vivos— se medía en un DOM **donde quitar
    // no quita**: el test pasaría o fallaría por motivos que no son los del producto. Es la clase
    // de banco infiel que advierte la cabecera de este fichero, y por eso se corrige aquí en vez
    // de rodearlo desde el test.
    // SCRUM-609 · `parentNode`. No existía, y por eso `productsView` REVENTABA al montarse en
    // cuanto una vista hizo `x.parentNode.insertBefore(...)` — que es DOM de manual. El banco ya
    // guardaba el padre en `_padre`; sólo le faltaba el nombre estándar. Se corrige AQUÍ y no se
    // rodea desde la vista: la cabecera de este fichero lo dice — un banco infiel hace que el
    // test mida el banco y no el producto.
    get parentNode() { return n._padre; },
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
    // 🔴 SCRUM-591 · `reset()`. NO LO TENÍA, y por eso el formulario de alta de cliente REVENTABA
    // al abrirse desde el banco (`modalForm.reset is not a function`) — en el navegador lo abre
    // un profesional todos los días. Un banco al que le falta un método del navegador no mide de
    // menos: hace imposible medir, que es lo que este fichero lleva seis tickets corrigiendo.
    //
    // Se limita a lo que un `<form>.reset()` hace y que aquí es observable: devolver los controles
    // de su subárbol a su valor de partida. NO se simula `defaultValue` —el mini-DOM no lo
    // tiene— y por eso se vacía: es lo que hace el navegador con un formulario recién construido,
    // que es el único caso que este banco monta.
    reset() {
      for (const h of todos(n)) {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(h.tagName)) { h.value = ''; h.checked = false; }
      }
    },
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
        const h = nodo(m[1], reg);
        // SCRUM-634 · SE COPIAN **TODOS** LOS ATRIBUTOS, no solo `id`, `class` y `data-*`.
        //
        // Antes solo entraban esos tres. Y como el matcher SÍ da por soportado un selector
        // como `[name="cost"]`, preguntarlo devolvía `null` EN SILENCIO: indistinguible de
        // «ese nodo no existe». Son 36 consultas del dashboard las que caían justo ahí.
        //
        // Se copian vía `setAttribute` —no como campos sueltos— porque el matcher resuelve
        // por `getAttribute`, y ese método ya refleja `id`, `class` y `data-*` a sus campos.
        for (const a of String(m[2] || '').matchAll(ATRIBUTO)) {
          h.setAttribute(a[1], a[2] !== undefined ? a[2] : (a[3] !== undefined ? a[3] : ''));
        }
        const texto = (m[3] || '').trim();
        if (texto) h.textContent = texto;
        // SCRUM-609 · el hijo nacido del marcado SABE QUIÉN ES SU PADRE. No lo sabía: el parser
        // sólo lo metía en `hijos`, así que `h.parentNode` era null y cualquier vista que hiciera
        // `x.parentNode.insertBefore(...)` —DOM de manual— reventaba al montarse.
        h._padre = n;
        n.hijos.push(h);
      }
    },
    get innerHTML() { return n._html; },
  };
  return n;
}

export function todos(n, out = []) { out.push(n); for (const h of n.hijos) todos(h, out); return out; }

/**
 * Los `<script src>` LOCALES de `dashboard/index.html`, EN SU ORDEN, relativos a
 * `public/dashboard` (`js/api.js`) — que es como este banco los abre.
 *
 * SCRUM-670 · YA NO TIENE REGEX PROPIA. La que había —`<script src="./X"></script>`— veía **0**
 * ante un `defer`, un atributo de más o la etiqueta partida en dos líneas, y en cambio SÍ contaba
 * un `<script>` COMENTADO, que el navegador no carga. Las dos cosas en silencio: la primera dejaba
 * una vista sin cargar y sin vigilar, la segunda hacía cargar un fichero que nadie pide.
 *
 * Devuelve `clasicos` a propósito: los `type="module"` NO comparten ámbito global, así que
 * ejecutarlos aquí en un solo contexto —que es lo que hace fiel a este banco para los clásicos—
 * mediría otra cosa. Hoy no hay ninguno, y `scrum670` cae el día que entre el primero.
 */
export function scriptsDelDashboard(raiz) {
  const html = fs.readFileSync(path.join(raiz, 'public/dashboard/index.html'), 'utf8');
  return scriptsDeLaPagina(html).clasicos.map(rutaDelDashboard);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-666 · EL CSS EXTERNO, que hasta hoy este banco NO MIRABA
//
// El hueco lo declaró SCRUM-660 al entregar: «el banco no aplica CSS externo; un `display:none`
// en `styles.css` no se detecta». No era el hueco de un campo: era el de TODOS los controles de
// visibilidad que se escriban de aquí en adelante, y producía **verdes falsos** — la clase cara.
//
// ── LO QUE SE MIDIÓ ANTES DE ESCRIBIR ESTO ───────────────────────────────────────────────
// El índice carga DOS hojas locales (`/tokens.css` y `./css/styles.css`) más una remota de
// Google Fonts, que no se lee ni se debe. De 625 reglas, **31 pueden ocultar** (24 `display:none`
// y 7 `opacity:0`; 7 de ellas dentro de `@keyframes`, o sea fotogramas que NO ocultan de verdad).
//
// 🔴 Y EL DATO QUE MANDA EN EL DISEÑO: de las 35 partes de selector que ocultan, el matcher de
// SCRUM-451 resuelve 22 (63 %) — pero las DOS que tocan el editor de líneas, que es justo lo que
// mide el control de SCRUM-660, usan `:not(:focus-within) >` y **no las resuelve ninguna**.
//
// O sea: un lector que aplicara sólo lo que sabe resolver diría «se ve» precisamente donde no
// sabe mirar. Por eso aquí manda la doctrina que este fichero lleva tres tickets desterrando
// (SCRUM-451, 444, 634): **lo que no se sabe resolver se ANOTA, no se contesta**.
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Las hojas de estilo LOCALES que declara el índice. Las remotas (fuentes) se ignoran.
 *
 * SCRUM-676 · la regex que vivía aquí exigía `rel="stylesheet"` ANTES de `href` y sólo con
 * comillas dobles. Medido: no veía la hoja remota del índice —que lleva `href` primero— ni
 * habría visto ninguna con comillas simples, y contaba las COMENTADAS. Ahora deriva del
 * extractor único, que es el que sabe todo eso. Sobre el índice real devuelve lo mismo que
 * antes: eso es el control negativo del cambio, no la prueba de que la regex vieja valiera.
 */
export function hojasDelDashboard(raiz) {
  const html = fs.readFileSync(path.join(raiz, 'public/dashboard/index.html'), 'utf8');
  return hojasDeLaPagina(html).locales
    .map((h) => (h.startsWith('/') ? path.join(raiz, 'public', h.slice(1)) : path.join(raiz, 'public/dashboard', h.replace(/^\.\//, ''))));
}

/** Las cinco formas de ocultar que pedía el encargo. `@keyframes` NO cuenta: son fotogramas. */
function formasDeOcultar(cuerpo) {
  const c = cuerpo.replace(/\s+/g, ' ').toLowerCase();
  const f = [];
  if (/(^|[;{\s])display\s*:\s*none/.test(c)) f.push('display:none');
  if (/visibility\s*:\s*hidden/.test(c)) f.push('visibility:hidden');
  if (/(^|[;\s])opacity\s*:\s*0(\s|;|$)/.test(c)) f.push('opacity:0');
  if (/(^|[;\s])(width|height)\s*:\s*0(px|%|em|rem)?\s*(;|$)/.test(c)) f.push('tamaño cero');
  if (/(^|[;\s])(left|top)\s*:\s*-\s*\d{3,}/.test(c) || /clip\s*:\s*rect\(\s*0/.test(c)) f.push('fuera de pantalla');
  return f;
}

/**
 * Las reglas que pueden OCULTAR algo, sacadas de las hojas del índice.
 *
 * 🔴 SUELO: si no encuentra NINGUNA regla, LANZA. Cero reglas y «no supe abrir el fichero» son
 * el mismo número con significados opuestos, y este banco existe justamente para no confundirlos.
 */
export function reglasQueOcultan(raiz, hojas = null) {
  const ficheros = hojas || hojasDelDashboard(raiz);
  if (!ficheros.length) throw new Error('[banco] el índice no declara ninguna hoja de estilo local');
  const out = [];
  let leidas = 0;
  for (const f of ficheros) {
    const css = fs.readFileSync(f, 'utf8'); // si no existe, LANZA: es el suelo, no un cero mudo
    leidas++;
    const t = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const pila = [];
    let buf = ''; let i = 0;
    while (i < t.length) {
      const ch = t[i];
      if (ch === '{') {
        const sel = buf.trim(); buf = '';
        if (sel.startsWith('@')) { pila.push(sel.split(/\s+/)[0]); } else {
          const cierra = t.indexOf('}', i);
          if (cierra === -1) break;
          const dentroDe = pila[pila.length - 1] || null;
          const formas = formasDeOcultar(t.slice(i + 1, cierra));
          // Los fotogramas de una animación no ocultan: describen un instante.
          if (formas.length && dentroDe !== '@keyframes') {
            out.push({ hoja: path.basename(f), selector: sel, formas, dentroDe });
          }
          i = cierra;
        }
      } else if (ch === '}') { pila.pop(); buf = ''; } else { buf += ch; }
      i++;
    }
  }
  if (!out.length) {
    throw new Error(`[banco] SUELO: leí ${leidas} hoja(s) y NO encontré ni una regla que oculte. `
      + 'Eso no es «no hay»: es «no supe mirar», y devolverlo como cero sería un verde falso.');
  }
  return out;
}

/**
 * ¿Lo esconde el CSS externo? Tres respuestas, y la tercera es la que hace que esto sirva:
 *
 *   · `{ oculto: true,  … }` — una regla que el matcher SABE resolver casa con el nodo o un padre
 *   · `{ oculto: false, … }` — ninguna casa, y ninguna quedó sin resolver: se ve
 *   · `{ oculto: null,  ciego: [...] }` — hay reglas que MENCIONAN una clase del nodo y cuyo
 *     selector el matcher NO sabe resolver. **No se contesta «se ve»**: se declara ciego.
 *
 * Esa tercera es la doctrina de SCRUM-451 aplicada aquí: devolver «visible» ante lo que no se
 * sabe mirar es el `null` mudo que este fichero lleva tres tickets desterrando.
 */
export function ocultoPorCss(n, reglas) {
  const cadena = [];
  for (let x = n; x; x = x._padre) cadena.push(x);
  const clasesDelNodo = new Set();
  for (const x of cadena) {
    for (const c of String(x.className || '').split(/\s+/).filter(Boolean)) clasesDelNodo.add(c);
    if (x.id) clasesDelNodo.add(x.id);
  }

  const ciego = [];
  for (const r of reglas) {
    // Una regla sin ninguna forma de ocultación no esconde nada, por mucho que su selector case.
    // `reglasQueOcultan` no las produce, pero esto se puede llamar con una lista a mano — y lo
    // cazó el CONTROL NEGATIVO de SCRUM-666, no una revisión: marcaba una regla de color.
    if (!r.formas || !r.formas.length) continue;
    for (const parte of r.selector.split(',').map((s) => s.trim()).filter(Boolean)) {
      let casaAlguno = null;
      for (const x of cadena) {
        const v = casa(x, parte); // el matcher de SCRUM-451: true | false | null (no soportado)
        if (v === null) { casaAlguno = null; break; }
        if (v === true) { casaAlguno = true; break; }
        casaAlguno = false;
      }
      if (casaAlguno === true) {
        return { oculto: true, porQue: `${r.hoja}: ${parte} { ${r.formas.join('; ')} }`, ciego: [] };
      }
      if (casaAlguno === null) {
        // No se sabe resolver. Sólo se declara ciego si la regla MENCIONA algo que el nodo tiene:
        // apuntar todas las que no se saben resolver haría el aviso inútil por ruidoso.
        const menciona = (parte.match(/[#.][\w-]+/g) || []).some((t) => clasesDelNodo.has(t.slice(1)));
        if (menciona) ciego.push(`${r.hoja}: ${parte} { ${r.formas.join('; ')} }`);
      }
    }
  }
  if (ciego.length) return { oculto: null, porQue: null, ciego };
  return { oculto: false, porQue: null, ciego: [] };
}

/**
 * SCRUM-559 · CUÁNTOS SCRIPTS DECLARA EL INDEX DEL DASHBOARD. Recuento EXACTO, no un mínimo.
 *
 * 🔴 POR QUÉ EXACTO Y NO `>= N`. Dos guards vigilan esta población —el de colisiones de
 * declaraciones y el de carga de vistas (SCRUM-417)— y los dos usaban un umbral con holgura:
 * `>= 25` sobre 60 (35 de holgura) y `>= 40` sobre 60 (20). Medido en SCRUM-559:
 *
 *   · poner `defer` en las 60 (60 → 0)  → los dos suelos disparan: se declaran ciegos. Bien.
 *   · poner `defer` en UNA  (60 → 59)   → 🔴 16/16 EN VERDE, y ese fichero deja de estar
 *     vigilado POR LOS DOS sin que ninguno diga una palabra.
 *
 * Un umbral con holgura sólo detecta la ceguera TOTAL; la pérdida PARCIAL le pasa por debajo y
 * el guard informa cero en verde, que es peor que un rojo: parece una respuesta.
 *
 * ⚠️ Y EL NÚMERO VIVE AQUÍ, en un solo sitio, a propósito: si cada guard fijara el suyo, el día
 * que el index crezca uno se actualizaría y el otro no, y volveríamos a tener una población
 * vigilada a medias — que es justo el defecto que esto cierra.
 *
 * SI ESTE NÚMERO TIENE QUE CAMBIAR, es porque alguien añadió o quitó un `<script>`: se actualiza
 * AQUÍ, en el mismo commit que lo añade. Que sea una decisión explícita es el objetivo, no un
 * efecto colateral.
 */
// ⚠️ Aquí vivía el historial de las SEIS colisiones de este contador, entrada por entrada.
// Se retira con el contador: **ya no puede volver a pasar**, porque lo que se declara es la
// LISTA y dos ramas que añaden scripts distintos no pueden escribir lo mismo (SCRUM-662).
/**
 * LOS SCRIPTS DEL DASHBOARD — UNA LISTA, NO UNA CUENTA (SCRUM-662).
 *
 * ⚠️ Aquí hubo un número, y ese número colisionó SEIS veces. La séptima fue la que lo mató, y
 * merece quedar en una línea: **los dos lados escribieron `= 69` por scripts DISTINTOS** —una
 * rama sumaba `quoteApartados.js` y main sumaba `tiposDeIva.js`—. Lo único que hizo visible el
 * choque fue que el comentario de al lado llevaba meses engordando y también chocó; sin esa
 * casualidad, git habría fundido «= 69» sin marcadores y main se habría quedado declarando un
 * script menos de los que carga. Un comentario haciendo de mecanismo por accidente.
 *
 * 🔴 UNA CUENTA NO DISTINGUE «TU SCRIPT» DE «MI SCRIPT»; UNA LISTA SÍ. Dos ramas que añaden
 * cosas distintas producen listas distintas: o git las funde y quedan las dos —correcto—, o
 * chocan donde se ve. Nunca «coinciden» por accidente, que era el fallo.
 *
 * ── QUÉ PROTEGE, Y PARA QUIÉN ────────────────────────────────────────────────────────────
 * Sus dos consumidores no querían un número: querían no estar CIEGOS. `dashboard-colisión`
 * comprueba que lee el índice entero antes de decir «cero colisiones», y el banco de SCRUM-417
 * que carga todas las vistas antes de decir «ninguna falla». SCRUM-559 ya midió el fallo real:
 * quitar UNA etiqueta dejaba a los dos en verde con ese fichero fuera de vigilancia. La lista
 * responde eso mejor que la cuenta, porque además **dice cuál**.
 *
 * ── POR QUÉ LA LISTA Y NO LA SECUENCIA ───────────────────────────────────────────────────
 * Se compara como CONJUNTO —ordenada alfabéticamente, no por orden de carga— a conciencia:
 *
 *   · Lo que rompe el producto no es «el orden» en abstracto: son DEPENDENCIAS concretas, y
 *     esas van declaradas abajo con su motivo y se comprueban por separado.
 *   · Exigir las 69 posiciones convertiría cualquier inserción en un conflicto de diseño y
 *     prometería un orden que nadie mantiene: `public/sw.js` lleva su lista en OTRA secuencia
 *     desde antes de este ticket, y SCRUM-274 pasa porque compara con `new Set`.
 *
 * Alfabética y no en orden de carga también por esto: dos inserciones en sitios distintos del
 * alfabeto se funden solas y correctamente, en vez de chocar por vecindad.
 */
export const SCRIPTS_DEL_DASHBOARD = Object.freeze([
  'aiQuoteAssistant.js',
  'albaranActionsRegistry.js',
  'albaranDetailView.js',
  'albaranesView.js',
  'almacenLocal.js',
  'api.js',
  'app.js',
  'cobrosView.js',
  'colaDeFirmas.js',
  'contacto.js',
  'csvImport.js',
  'customerDetailView.js',
  'customersView.js',
  'estadoFirma.js',
  'expensesView.js',
  'exportView.js',
  'facturaPreEmision.js',
  'filtroClientes.js',
  'globalSearch.js',
  'homeView.js',
  'invoiceActionsRegistry.js',
  'invoiceDetailView.js',
  'invoicesView.js',
  'jobActionsRegistry.js',
  'jobCobroHuecos.js',
  'jobDetailView.js',
  'jobDocsReparto.js',
  'jobNextAction.js',
  // SCRUM-651 (2-sep-2026): entra `jobNuevoModal.js`, el modal para abrir un Trabajo SIN
  // presupuesto —una averia, el caso mas frecuente del primer cliente real—. Va ANTES de
  // `jobsView.js`, que lo consume, y despues de `modalHeader.js`, del que usa `cabeceraModal`.
  //
  // 🔴 ESTA RAMA TRAIA UN NUMERO (`= 67`) Y NO SE HA CONSERVADO NADA DE EL. El conflicto se
  // resolvio quedandose con el mecanismo de main: SCRUM-662 mato el contador y puso esta lista,
  // porque una cuenta no distingue «tu script» de «mi script» y colisiono siete veces. Traer de
  // vuelta el numero —o su historial, que main retira a proposito— habria deshecho ese ticket.
  //
  // La entrada se DERIVO del `index.html` ya mezclado, no se heredo de ningun lado: son 71
  // `<script src=`, la lista de main tenia 70, y la diferencia era exactamente este fichero.
  'jobNuevoModal.js',
  'jobRailBlocks.js',
  'jobAsignados.js',
  'jobsCierreTrabajo.js',
  'jobsView.js',
  'libroRegistroView.js',
  'margenCatalogo.js',
  'modalHeader.js',
  'nifEspanol.js',
  'nuevaFacturaModal.js',
  'onboardingView.js',
  'paidViaEtiquetas.js',
  'parteDetailView.js',
  'parteOficinaView.js',
  'patronDetalleAcciones.js',
  'plansView.js',
  'prefijosPais.js',
  'productsView.js',
  'providersView.js',
  'puertaSerie.js',
  'quoteActionsRegistry.js',
  'quoteApartados.js',
  'quoteRevisiones.js',
  'quoteAtajosVencimiento.js',
  'quoteMargen.js',
  'quoteRequestsView.js',
  'quoteSuplido.js',
  'quotesDetailView.js',
  'quotesListView.js',
  'quotesTabs.js',
  'quotesView.js',
  'reportsView.js',
  'resistenciaAlmacen.js',
  'selectorMetodoCobro.js',
  'semaforoFiscal.js',
  'settingsSubmenus.js',
  'settingsView.js',
  'signaturePad.js',
  'switchFormaJuridica.js',
  'switchTipoArticulo.js',
  'teamView.js',
  'templatesView.js',
  'terminadoSinCobrar.js',
  'textoDelDocumento.js',
  'tipoDestinatarioPendiente.js',
  'tiposDeIva.js',
  'tutorial.js',
  'voiceInput.js',
]);
/**
 * LAS DEPENDENCIAS DE CARGA — la mitad que la cuenta NUNCA vigiló.
 *
 * Los scripts clásicos comparten ámbito y se ejecutan en el orden del índice: si el consumidor
 * carga antes que la pieza que consume, la pantalla revienta al abrirse. Un recuento correcto
 * no dice nada de esto — si un merge reordena sin añadir ni quitar, la cuenta sigue cuadrando y
 * el producto carga mal.
 */
export const DEPENDENCIAS_DE_CARGA = Object.freeze([
  { antes: 'filtroClientes.js', despues: 'customersView.js', motivo: 'SCRUM-581: pestañas y orden de la lista' },
  { antes: 'margenCatalogo.js', despues: 'productsView.js', motivo: 'SCRUM-609: la aritmética del margen' },
  { antes: 'switchTipoArticulo.js', despues: 'productsView.js', motivo: 'SCRUM-609: el switch Producto|Servicio' },
  { antes: 'quoteApartados.js', despues: 'quotesDetailView.js', motivo: 'SCRUM-655: apartados, numeración y descripción' },
  { antes: 'signaturePad.js', despues: 'parteDetailView.js', motivo: 'SCRUM-652: el parte abre el pad de firma' },
  { antes: 'colaDeFirmas.js', despues: 'parteDetailView.js', motivo: 'SCRUM-652: firma con la cola que ya existe' },
  // SCRUM-593 (DOC-03): la pieza se carga antes que sus DOS consumidores. `jobDetailView.js`
  // YA la consume (el campo de cabecera del albaran); `quotesView.js` la consumira cuando salga
  // SCRUM-598 de ese fichero, y la dependencia se declara igualmente: si un merge la reordenara
  // antes de que exista el consumidor, el rojo aparecería en la pantalla del profesional.
  { antes: 'textoDelDocumento.js', despues: 'jobDetailView.js', motivo: 'SCRUM-593: el campo de cabecera del albaran' },
  { antes: 'textoDelDocumento.js', despues: 'quotesView.js', motivo: 'SCRUM-593: los dos textos libres (consumidor tras SCRUM-598)' },
]);

/** Nombre a secas, venga con prefijo `js/` o sin él, y sea cadena u objeto `{fichero}`. */
export function nombreDeScript(x) {
  const s = typeof x === 'string' ? x : (x && x.fichero) || '';
  return String(s).replace(/^js[/]/, '');
}

/**
 * Contrasta lo LEÍDO del índice contra la lista declarada. Devuelve qué sobra y qué falta —
 * nombrado, que es lo que una cuenta no podía dar.
 */
export function contrastarScripts(leidos) {
  const vistos = (Array.isArray(leidos) ? leidos : []).map(nombreDeScript).filter(Boolean);
  const declarados = new Set(SCRIPTS_DEL_DASHBOARD);
  const set = new Set(vistos);
  return {
    vistos,
    sobran: [...set].filter((n) => !declarados.has(n)).sort(),
    faltan: SCRIPTS_DEL_DASHBOARD.filter((n) => !set.has(n)),
  };
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
    // 🔴 SCRUM-660 · `window.addEventListener`. NO LO TENÍA, y por eso `renderQuotesView`
    // REVENTABA a media pintada — medido: con la vista de `origin/main`, sin ningún cambio de
    // producto, el banco daba `window.addEventListener is not a function`.
    //
    // La consecuencia era peor que un test menos: la pantalla de presupuestos se pintaba HASTA
    // ese punto y luego paraba, así que sus LÍNEAS nunca llegaban a existir en el banco. Todo lo
    // que viva en una línea —el selector de IVA de SCRUM-611, entre otras cosas— era
    // estructuralmente inalcanzable para cualquier control de pantalla, y eso es exactamente el
    // hueco que 611 declaró al entregar: «si alguien dejara el <select> sin insertar o tras un
    // display:none, todos seguirían verdes».
    //
    // Se GUARDAN los oyentes, como hacen los nodos, en vez de tragárselos: un banco que acepta
    // registros y luego no los puede disparar mide una pantalla que no existe.
    _oyentes: {},
    addEventListener(tipo, fn) { (ctx._oyentes[tipo] = ctx._oyentes[tipo] || []).push(fn); },
    removeEventListener(tipo, fn) {
      ctx._oyentes[tipo] = (ctx._oyentes[tipo] || []).filter((f) => f !== fn);
    },
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
/**
 * 🔴 SCRUM-698 · LA FORMA MÍNIMA PARA QUE UNA VISTA LLEGUE A MONTARSE.
 *
 * El `fetch` del banco devuelve `{}` cuando nadie le pasa `datos`, y `{}.filter` no existe: por
 * eso CINCO pantallas del panel no llegaban a montarse —`quoteRequests`, `team`, `templates`,
 * `plans` y `albaranDetail`— y ningún guard apoyado en el banco podía afirmar NADA sobre ellas.
 * Medido: no falla ninguna de las cinco por su código; fallan porque se les sirve `{}`.
 *
 * ⚠️ QUÉ ES Y QUÉ NO ES. Esto NO es el contrato del backend y no se puede usar para afirmar nada
 * sobre el CONTENIDO de una pantalla: es la forma mínima que hace falta para que la vista llegue
 * a pintarse, derivada de lo que cada una PIDE. Quien quiera medir contenido pasa sus propios
 * datos, como se ha hecho siempre — este fixture no le quita el sitio a nadie.
 *
 * Y por eso NO se pone como valor por defecto de `cargarDashboard`: cambiar lo que reciben las
 * vistas que hoy se montan movería mediciones ajenas sin que nadie lo pidiera. Se ofrece, no se
 * impone.
 */
export function datosDeMuestra(url) {
  const u = String(url || '');
  // Un objeto con `plans`: la vista hace `plans[0]` sin comprobarlo antes.
  if (/\/billing\/plans/.test(u)) return { plans: [], currentPlan: null, founding: null };
  // Un albarán con ESTADO CONOCIDO. El estado importa: `destinoEfectivo` devuelve `undefined`
  // para un estado que el registro no contempla, y la vista revienta al agrupar los botones.
  if (/\/albaranes\//.test(u)) return { id: 1, estado: 'borrador', lines: [], items: [] };
  // Las listas del panel esperan un array. Es lo que devuelven sus endpoints.
  return [];
}

export async function pintarVista(banco, nombreFn) {
  const fn = banco.ctx[nombreFn];
  if (typeof fn !== 'function') {
    return { error: new Error(`la vista no publica \`${nombreFn}\` (es ${typeof fn})`), contenedor: null };
  }
  const contenedor = banco.mk('div');
  const idsAntes = banco.reg.idsNoResueltos.length;

  // 🔴 SCRUM-698 · LOS RECHAZOS HUÉRFANOS SE RECOGEN, NO MATAN EL PROCESO.
  //
  // `reportsView` dispara su carga SIN esperarla (`load()`, `loadVat()`), así que su promesa no
  // pasa por aquí: cuando rechaza, no hay nadie que la maneje y el proceso ENTERO se cae. Y eso,
  // en una tanda, es el defecto de SCRUM-672 con otra cara: **el fichero muere y se lleva sus
  // tests con él**, sin un `fail` que diga quién fue. El total baja y el porcentaje de verdes
  // puede incluso mejorar.
  //
  // No se puede resolver envolviendo la vista —la promesa huérfana no vuelve por ningún sitio—,
  // así que se apartan los oyentes MIENTRAS dura el montaje y se devuelven en un `finally`.
  //
  // 🔴 ESTO NO ES TRAGARSE NADA: los rechazos SE DEVUELVEN en `rechazos`, con su vista delante,
  // para que un test pueda exigir que estén vacíos y NOMBRAR al culpable. Lo que se aparta es el
  // veredicto automático del runner, no la medición.
  const rechazos = [];
  const oyentes = process.listeners('unhandledRejection');
  process.removeAllListeners('unhandledRejection');
  const anota = (e) => rechazos.push(`${nombreFn}: ${String((e && e.message) || e).slice(0, 120)}`);
  process.on('unhandledRejection', anota);
  const devolverOyentes = () => {
    process.off('unhandledRejection', anota);
    for (const o of oyentes) process.on('unhandledRejection', o);
  };

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
    devolverOyentes();
    return { error: e, contenedor, rechazos };
  }
  devolverOyentes();
  return {
    error: null,
    contenedor,
    nodos: todos(contenedor).length,
    idsNoResueltos: banco.reg.idsNoResueltos.slice(idsAntes),
    erroresDeConsola: banco.reg.errores.slice(),
    // Vacío casi siempre. Cuando no lo esté, dice QUÉ vista dejó la promesa suelta y con qué
    // error — que es justo lo que el proceso muriéndose no decía.
    rechazos,
  };
}

/**
 * Las DEPENDENCIAS declaradas que se estén incumpliendo, sobre el orden REAL del índice.
 *
 * Recibe los nombres EN ORDEN DE CARGA. Devuelve las parejas rotas, cada una con su motivo — que
 * es lo que hace accionable el fallo: «X va antes de Y» sin decir por qué se arregla moviendo el
 * que no era.
 */
export function dependenciasRotas(nombresEnOrden) {
  const orden = (Array.isArray(nombresEnOrden) ? nombresEnOrden : []).map(nombreDeScript);
  const rotas = [];
  for (const d of DEPENDENCIAS_DE_CARGA) {
    const a = orden.indexOf(d.antes);
    const b = orden.indexOf(d.despues);
    if (a === -1 || b === -1) { rotas.push({ ...d, falta: true }); continue; }
    if (a > b) rotas.push({ ...d, falta: false, posAntes: a, posDespues: b });
  }
  return rotas;
}
