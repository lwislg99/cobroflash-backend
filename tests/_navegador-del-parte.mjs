// tests/_navegador-del-parte.mjs — SCRUM-1646 (CSP paso 2, tramo albarán público)
//
// DOS INSTRUMENTOS PARA LA PÁGINA PÚBLICA DE FIRMA DEL PARTE, y por qué hacen falta los dos:
//
//   A · EL CENSO DE LO QUE LA CSP BLOQUEARÍA. Con `script-src 'self'` (SCRUM-1637) el navegador NO
//       ejecuta: un `<script>` sin `src`, ni un atributo `on*=`, ni el `onclick` que el propio código
//       mete después con `innerHTML` (el de «Ver la versión actual» vivía así: dentro de una cadena,
//       invisible para quien busque `onclick` en el HTML). Por eso el censo mira DOS sitios:
//         · el HTML GENERADO, tokenizado por etiquetas y atributos (no `grep`: una cadena `<script`
//           dentro de un JSON o de un comentario no es un elemento);
//         · el JS que corre en la página —el de los `<script>` en línea y el que se sirve aparte—,
//           por AST de TypeScript: toda escritura de HTML desde código (`innerHTML`, `outerHTML`,
//           `insertAdjacentHTML`, `document.write`) y todo código que nace de una cadena (`eval`,
//           `new Function`, `setTimeout('…')`).
//       ⚠️ Sin parser de HTML en las dependencias (medido el 10-nov-2026: sólo `typescript`), el
//       tokenizador es propio. Es mínimo a propósito y su control positivo vive en el test.
//
//   B · UN NAVEGADOR DE MENTIRA que EJECUTA el JS servido sobre los ids del HTML generado y los datos
//       de su bloque `application/json`. Desde SCRUM-1646 los textos viajan en ese bloque y la lógica
//       en un fichero aparte, así que «qué texto lee el cliente si la firma no vuelve» ya no se puede
//       leer en el código de la página: hay que hacerlo pasar. Esto lo hace pasar.
//       🔴 EL LÍMITE: no es un DOM. Sólo tiene lo que el guion usa (ids, `.card`, `createElement`,
//       eventos sin propagación). Un id que el HTML no tiene devuelve `null`, como el de verdad, y un
//       método que el guion empiece a usar y aquí no exista revienta: es lo que debe pasar.
import ts from 'typescript';
import vm from 'node:vm';

// ── A · el HTML, por etiquetas ───────────────────────────────────────────────────────────────

/** Elementos del HTML con sus atributos, en orden. `<script>` y `<style>` llevan su texto crudo. */
export function elementosDe(html) {
  const out = [];
  const n = html.length;
  let i = 0;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) break;
    if (html.startsWith('<!--', lt)) { const f = html.indexOf('-->', lt + 4); i = f < 0 ? n : f + 3; continue; }
    if (html[lt + 1] === '!' || html[lt + 1] === '?' || html[lt + 1] === '/') {
      const f = html.indexOf('>', lt); i = f < 0 ? n : f + 1; continue;
    }
    const m = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(lt, lt + 64));
    if (!m) { i = lt + 1; continue; }
    const tag = m[1].toLowerCase();
    const attrs = [];
    let j = lt + m[0].length;
    while (j < n) {
      while (j < n && /\s/.test(html[j])) j++;
      if (html[j] === '>') { j++; break; }
      if (html[j] === '/') { j++; continue; }
      const an = /^[^\s"'>/=]+/.exec(html.slice(j, j + 256));
      if (!an) { j++; continue; }
      const name = an[0].toLowerCase();
      j += an[0].length;
      while (j < n && /\s/.test(html[j])) j++;
      let value = '';
      if (html[j] === '=') {
        j++;
        while (j < n && /\s/.test(html[j])) j++;
        const q = html[j];
        if (q === '"' || q === "'") {
          const f = html.indexOf(q, j + 1);
          value = html.slice(j + 1, f < 0 ? n : f);
          j = f < 0 ? n : f + 1;
        } else {
          value = /^[^\s>]*/.exec(html.slice(j))[0];
          j += value.length;
        }
      }
      attrs.push({ name, value });
    }
    const el = { tag, attrs, attr: (k) => attrs.find((a) => a.name === k)?.value, texto: '' };
    if (tag === 'script' || tag === 'style') {
      const resto = html.slice(j);
      const cierre = new RegExp(`</${tag}\\s*>`, 'i').exec(resto);
      el.texto = cierre ? resto.slice(0, cierre.index) : resto;
      j += cierre ? cierre.index + cierre[0].length : resto.length;
    }
    out.push(el);
    i = j;
  }
  return out;
}

/** Un `<script type="application/json">` no se ejecuta: la CSP no lo mira. */
const esDeDatos = (el) => (el.attr('type') || '').trim().toLowerCase() === 'application/json';

// ── A · el JS, por AST ───────────────────────────────────────────────────────────────────────

const ESCRIBE_HTML = new Set(['innerHTML', 'outerHTML']);
const LLAMADAS_DE_HTML = new Set(['insertAdjacentHTML', 'write', 'writeln']);

/** Lo que un JS hace que la CSP bloquearía o que mete HTML (y con él, `on*=`) desde código. */
export function riesgosDelCodigo(codigo) {
  const sf = ts.createSourceFile('pagina.js', codigo, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const out = [];
  const linea = (nodo) => sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1;
  const nombre = (e) => (ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '');
  const visitar = (nodo) => {
    if (ts.isBinaryExpression(nodo) && [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken].includes(nodo.operatorToken.kind)
      && ts.isPropertyAccessExpression(nodo.left) && ESCRIBE_HTML.has(nodo.left.name.text)) {
      out.push(`${nodo.left.name.text} (línea ${linea(nodo)})`);
    }
    if (ts.isCallExpression(nodo) || ts.isNewExpression(nodo)) {
      const n = nombre(nodo.expression);
      if (ts.isCallExpression(nodo) && ts.isPropertyAccessExpression(nodo.expression) && LLAMADAS_DE_HTML.has(n)) out.push(`${n}() (línea ${linea(nodo)})`);
      if (n === 'eval' || n === 'Function') out.push(`${n} (línea ${linea(nodo)})`);
      if ((n === 'setTimeout' || n === 'setInterval') && nodo.arguments?.[0] && ts.isStringLiteralLike(nodo.arguments[0])) out.push(`${n}('…') (línea ${linea(nodo)})`);
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(sf);
  return out;
}

/**
 * EL CENSO. `servidos` = el texto de cada JS que la página carga por `src` (el test lo pide al router).
 * Devuelve lo que la CSP del paso 1 bloquearía, con su sitio, para que el rojo diga DÓNDE.
 */
export function censoCsp(html, servidos = []) {
  const els = elementosDe(html);
  const scripts = els.filter((e) => e.tag === 'script');
  const enLinea = scripts.filter((e) => !e.attr('src') && !esDeDatos(e));
  const manejadores = els.flatMap((e) => e.attrs.filter((a) => /^on/.test(a.name)).map((a) => `<${e.tag} ${a.name}>`));
  const enCodigo = [...enLinea.map((e) => e.texto), ...servidos].flatMap(riesgosDelCodigo);
  return { scripts, enLinea: enLinea.length, manejadores, enCodigo };
}

// ── B · el navegador de mentira ──────────────────────────────────────────────────────────────

class Nodo {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.id = attrs.id || '';
    this.className = attrs.class || '';
    this.value = attrs.value ?? '';
    this.type = attrs.type || '';
    this.href = '';
    this.disabled = false;
    this.textContent = '';
    this.style = {};
    this.dataset = {};
    this.children = [];
    this.parentElement = null;
    this.oyentes = {};
    const clases = new Set(this.className.split(/\s+/).filter(Boolean));
    this.classList = { add: (c) => clases.add(c), remove: (c) => clases.delete(c), contains: (c) => clases.has(c) };
  }
  addEventListener(tipo, fn) { (this.oyentes[tipo] ||= []).push(fn); }
  appendChild(hijo) { hijo.parentElement = this; this.children.push(hijo); return hijo; }
  focus() { Nodo.enfocado = this; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 150 }; }
  getContext() {
    return { scale() {}, getImageData() { return {}; }, putImageData() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, clearRect() {} };
  }
  toDataURL() { return 'data:image/png;base64,SONDA1646'; }
  /** Dispara un evento y devuelve lo que devuelvan los oyentes (el de firmar es `async`). */
  disparar(tipo, ev = {}) {
    const e = { preventDefault() {}, clientX: 10, clientY: 10, ...ev };
    return Promise.all((this.oyentes[tipo] || []).map((fn) => fn.call(this, e)));
  }
}

/** El texto visible de un nodo y sus hijos, como lo leería alguien. */
export const textoDe = (n) => (n.children.length ? n.children.map(textoDe).join('') : n.textContent);

/**
 * Ejecuta `js` sobre la página `html`. `responder(url, init)` hace de `fetch`: devuelve
 * `{ ok, json }` o lanza (la respuesta no volvió).
 */
export function navegadorDelParte(html, js, responder) {
  const els = elementosDe(html);
  const porId = new Map();
  let card = null;
  for (const e of els) {
    const attrs = Object.fromEntries(e.attrs.map((a) => [a.name, a.value]));
    const nodo = new Nodo(e.tag, attrs);
    if (e.tag === 'script' || e.tag === 'style') nodo.textContent = e.texto;
    if (attrs.id) porId.set(attrs.id, nodo);
    if (!card && (attrs.class || '').split(/\s+/).includes('card')) card = nodo;
  }
  // El lienzo cuelga de su envoltorio, que es lo que el guion pinta de verde al trazar.
  if (porId.get('sig-canvas') && porId.get('sig-wrapper')) porId.get('sig-canvas').parentElement = porId.get('sig-wrapper');

  const peticiones = [];
  let recargas = 0;
  const document = {
    getElementById: (id) => porId.get(id) || null,
    querySelector: (sel) => {
      if (sel === '.card') return card;
      if (sel === '.card > div') return card?.children.find((c) => c.tagName === 'DIV') || null;
      throw new Error(`navegador de mentira: no sé resolver «${sel}»`);
    },
    createElement: (tag) => new Nodo(tag),
  };
  const window = { devicePixelRatio: 1, addEventListener() {} };
  const location = { reload() { recargas += 1; } };
  const fetch = async (url, init) => { peticiones.push({ url, init, cuerpo: JSON.parse(init.body) }); return responder(url, init); };
  vm.runInNewContext(js, { document, window, location, fetch, console });

  const el = (id) => porId.get(id) || null;
  return {
    el,
    card: () => card,
    peticiones,
    recargas: () => recargas,
    async trazar() {
      const c = el('sig-canvas');
      await c.disparar('mousedown'); await c.disparar('mousemove', { clientX: 40, clientY: 30 }); await c.disparar('mouseup');
    },
    firmar: () => el('btn-sign').disparar('click'),
  };
}

/** Los datos de la página: el bloque `application/json` que lee el guion. */
export function datosDe(html) {
  const bloques = elementosDe(html).filter((e) => e.tag === 'script' && esDeDatos(e));
  if (bloques.length !== 1) throw new Error(`CIEGO: esperaba UN bloque de datos y hay ${bloques.length}`);
  return JSON.parse(bloques[0].texto);
}
