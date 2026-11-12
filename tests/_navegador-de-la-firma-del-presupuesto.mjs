// tests/_navegador-de-la-firma-del-presupuesto.mjs — SCRUM-1646c (CSP paso 2, firma del presupuesto)
//
// UN NAVEGADOR DE MENTIRA QUE EJECUTA EL GUION SERVIDO sobre la página generada.
//
// Desde SCRUM-1646c la página de firma del presupuesto ya no lleva `<script>` en línea: la lógica
// se sirve desde 'self' (`quoteDecisionNavegador.ts`) y los textos viajan en el bloque
// `<script type="application/json" id="presupuesto-firma-datos">`. Así que «qué lee el cliente si
// el servidor contesta X» ya no se puede leer en el HTML: hay que hacerlo pasar. Esto lo hace
// pasar, con el guion REAL (el que sirve la ruta) y los datos REALES (los que pinta la página).
//
// 🔴 EL LÍMITE: no es un DOM. Sólo tiene lo que el guion usa (ids, `.card`, las opciones,
// `createElement(NS)`, eventos sin propagación). Un id que el HTML no tiene devuelve `null`, como el
// de verdad, y un selector que el guion empiece a usar y aquí no exista REVIENTA: es lo que debe
// pasar, para que nadie lea un verde sobre un guion que ya no hace lo que este doble imita.
import vm from 'node:vm';

class Nodo {
  constructor(tag, attrs = {}) {
    this.tagName = String(tag).toUpperCase();
    this.attrs = { ...attrs };
    this.id = attrs.id || '';
    this.className = attrs.class || '';
    this.children = [];
    this.parentElement = null;
    this._texto = '';
    this.style = {};
    this.oyentes = {};
    this.disabled = false;
    this.checked = false;
    this.value = '';
    const nodo = this;
    this.classList = {
      add: (c) => { const s = new Set(nodo.className.split(/\s+/).filter(Boolean)); s.add(c); nodo.className = [...s].join(' '); },
      remove: (c) => { nodo.className = nodo.className.split(/\s+/).filter((x) => x && x !== c).join(' '); },
      contains: (c) => nodo.className.split(/\s+/).includes(c),
    };
  }
  get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join('') : this._texto; }
  set textContent(v) { this.children = []; this._texto = v == null ? '' : String(v); }
  appendChild(n) { n.parentElement = this; this.children.push(n); return n; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(ev, fn) { (this.oyentes[ev] ||= []).push(fn); }
  remove() {}
  closest(sel) {
    const cls = /^\.([\w-]+)$/.exec(sel);
    if (!cls) throw new Error(`navegador de mentira: no sé resolver closest(«${sel}»)`);
    for (let n = this; n; n = n.parentElement) if (n.classList.contains(cls[1])) return n;
    return null;
  }
  querySelector(sel) {
    const cls = /^\.([\w-]+)$/.exec(sel);
    if (!cls) throw new Error(`navegador de mentira: no sé resolver querySelector(«${sel}») en un nodo`);
    return this.children.find((c) => c.classList.contains(cls[1])) || null;
  }
  scrollIntoView() {}
  getContext() {
    return { getImageData: () => ({}), putImageData() {}, scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, clearRect() {} };
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 120 }; }
  toDataURL() { return 'data:image/png;base64,AAAA'; }
  async disparar(ev, extra = {}) {
    const e = { preventDefault() {}, clientX: 0, clientY: 0, ...extra };
    for (const fn of this.oyentes[ev] || []) await fn.call(this, e);
  }
}

/** El texto visible de un nodo y sus hijos, como lo leería alguien. */
export const textoDe = (n) => (n ? n.textContent : '');

const desescapar = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

const atributos = (crudo) => Object.fromEntries(
  [...crudo.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]),
);

/** El bloque de datos que lee el guion. Exactamente UNO, o CIEGO. */
export function datosDeLaFirma(html) {
  const bloques = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => atributos(m[1]).id === 'presupuesto-firma-datos');
  if (bloques.length !== 1) throw new Error(`CIEGO: esperaba UN bloque de datos de la firma y hay ${bloques.length}`);
  return { crudo: bloques[0][2], datos: JSON.parse(bloques[0][2]) };
}

/**
 * Monta la página y ejecuta `js` (el guion servido). `responder(url, init)` hace de `fetch`:
 * devuelve `{ ok, status, json }` o lanza (la respuesta no volvió).
 *
 * De la página se toman: cada elemento con `id`, la `.card`, y las opciones (`.tier-card` con su
 * `.btn-tier`, `.tier-label` y `.tier-total` colgando de ella), más los bloques del héroe.
 */
export function navegadorDeLaFirma(html, js, responder, { firma = null, sinFirmar = false } = {}) {
  const porId = new Map();
  const porClase = new Map();
  let card = null;
  let tarjetaActual = null;
  const opciones = [];
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const attrs = atributos(m[2]);
    const nodo = new Nodo(m[1], attrs);
    // Su texto propio: lo que hay justo detrás de la etiqueta hasta la siguiente (con las entidades
    // de `esc` deshechas, como haría el navegador). Basta para `.tier-label`, `.tier-total`, etc.
    const fin = html.indexOf('<', m.index + m[0].length);
    nodo._texto = desescapar(html.slice(m.index + m[0].length, fin < 0 ? html.length : fin));
    const clases = (attrs.class || '').split(/\s+/).filter(Boolean);
    if (attrs.id) porId.set(attrs.id, nodo);
    for (const c of clases) if (!porClase.has(c)) porClase.set(c, nodo);
    if (!card && clases.includes('card')) card = nodo;
    if (clases.includes('tier-card')) { tarjetaActual = nodo; opciones.push(nodo); }
    else if (tarjetaActual && ['btn-tier', 'tier-label', 'tier-total'].some((c) => clases.includes(c))) tarjetaActual.appendChild(nodo);
  }
  const { crudo } = datosDeLaFirma(html);
  porId.get('presupuesto-firma-datos').textContent = crudo;
  if (porId.get('sig-canvas') && porId.get('sig-wrapper')) porId.get('sig-canvas').parentElement = porId.get('sig-wrapper');
  if (porId.get('no-sig-check')) porId.get('no-sig-check').checked = sinFirmar;

  const peticiones = [];
  let recargas = 0;
  const document = {
    getElementById: (id) => porId.get(id) || null,
    querySelector: (sel) => {
      if (sel === '.card') return card;
      const cls = /^\.([\w-]+)$/.exec(sel);
      if (cls) return porClase.get(cls[1]) || null;
      const tier = /^\[data-tier-id="(.*)"\]$/.exec(sel);
      if (tier) return opciones.find((o) => o.getAttribute('data-tier-id') === tier[1]) || null;
      throw new Error(`navegador de mentira: no sé resolver querySelector(«${sel}»)`);
    },
    querySelectorAll: (sel) => {
      if (sel === '.tier-card') return opciones;
      if (sel === '.tier-card .btn-tier') return opciones.map((o) => o.querySelector('.btn-tier')).filter(Boolean);
      throw new Error(`navegador de mentira: no sé resolver querySelectorAll(«${sel}»)`);
    },
    createElement: (tag) => new Nodo(tag),
    createElementNS: (_ns, tag) => new Nodo(tag),
    createTextNode: (t) => { const n = new Nodo('#text'); n.textContent = t; return n; },
    body: { appendChild() {} },
  };
  const window = { devicePixelRatio: 1, addEventListener() {}, matchMedia: () => ({ matches: true }) };
  const location = { reload() { recargas += 1; } };
  const fetch = async (url, init) => {
    peticiones.push({ url, init, cuerpo: JSON.parse(init.body) });
    return responder(url, init);
  };
  vm.runInNewContext(js, { document, window, location, fetch, console, setTimeout: () => {} });
  // El guion expone la firma en `window`; aquí se sustituye por la que pida el test.
  if (firma !== undefined) window.getSignatureData = () => firma;

  const el = (id) => porId.get(id) || null;
  return {
    el,
    card: () => card,
    porClase: (c) => porClase.get(c) || null,
    opciones,
    peticiones,
    recargas: () => recargas,
    window,
    aceptar: () => el('btn-accept').disparar('click'),
    elegir: (tierId) => opciones.find((o) => o.getAttribute('data-tier-id') === tierId).querySelector('.btn-tier').disparar('click'),
  };
}

/** Respuesta de `fetch` de mentira. `cuerpo` undefined = no es JSON. */
export const respuesta = (status, cuerpo) => ({
  ok: status < 400, status,
  json: async () => { if (cuerpo === undefined) throw new SyntaxError('no es JSON'); return cuerpo; },
});
