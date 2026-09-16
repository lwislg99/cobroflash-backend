// tests/_carga-de-pagina.mjs — SCRUM-378
//
// ¿CADA PÁGINA CARGA LO QUE SU PROPIO CÓDIGO NECESITA?
//
// El guard de SCRUM-274/302 contesta otra pregunta —que `sw.js` e `index.html` digan lo mismo y que
// lo listado exista— y la contesta bien. Éste se suma, y mira las NUEVE páginas, no solo el
// dashboard.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CASO QUE LO MOTIVA
//
// S3 inyectó un `.btn-primary` en `login.html` para provocar un rojo. `login.html` NO carga
// `styles.css`, así que el botón nunca tuvo fondo verde y **la prueba no podía fallar**. Una página
// que no carga lo que das por hecho que carga.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 TRES CUBOS, NO DOS — y el tercero es el que salva al guard de sí mismo
//
// Por cada cosa que el código de una página invoca:
//
//   ① la define un `<script src>` que ESA página carga            → OK
//   ② la define algún fichero del repo, pero esa página no lo carga → ROJO
//   ③ no la define NADIE en el repo y no es de plataforma          → ROJO, y es peor
//
// Sin el cubo ③, este guard tendría un agujero que lo pondría VERDE justo en el caso peor: si el
// conjunto de «globales que define el repo» se deriva de lo que existe, **borrar entero el fichero
// que define algo hace que ese algo salga del conjunto** — y la página que lo invoca dejaría de
// comprobarse. Un conjunto que se define por lo que existe no puede detectar lo que dejó de
// existir. Por eso lo invocado y no definido por nadie es rojo, y es el rojo más grave.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ HAY UNA LISTA A MANO AQUÍ, Y POR QUÉ ES LEGÍTIMA
//
// `PLATAFORMA` es una lista escrita a mano, que es justo lo que esta casa evita. La diferencia que
// la hace legítima está en QUIÉN la mueve:
//
//   · Es EXTERNA y ESTABLE: son los globales del navegador. No cambian cuando cambia nuestro
//     código, así que no puede quedarse corta por algo que hagamos nosotros.
//   · Lo NUESTRO se DERIVA: quién define qué se lee del árbol en cada tanda. Escribirlo a mano sí
//     se quedaría corto en cuanto alguien añadiera un fichero.
//
// Si algún día un nombre de plataforma falta, el síntoma es un rojo del cubo ③ con un nombre que
// cualquiera reconoce (`structuredClone`, `AbortController`) — molesto, pero nunca un verde falso.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
// SCRUM-670 · el ÚNICO sitio del repo donde se lee un `<script>` de un marcado.
import { scriptsDeLaPagina, hojasDeLaPagina, sinComentarios } from './_scripts-de-la-pagina.mjs';

/**
 * Globales del NAVEGADOR (+ los dos de Node que usan los ficheros del navegador dentro de su guard
 * `typeof module !== 'undefined'`, el que los hace `require()`-ables desde la suite).
 */
export const PLATAFORMA = new Set([
  'window', 'document', 'console', 'fetch', 'Response', 'Request', 'Headers', 'URL', 'URLSearchParams',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'JSON', 'Math', 'Date', 'Number', 'String', 'Boolean', 'Array', 'Object', 'Promise', 'Map', 'Set',
  'WeakMap', 'WeakSet', 'RegExp', 'Error', 'TypeError', 'RangeError', 'Function', 'Symbol', 'BigInt',
  'Proxy', 'Reflect', 'Intl', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'escape', 'unescape',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'btoa', 'atob',
  'alert', 'confirm', 'prompt', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history',
  'FormData', 'FileReader', 'Blob', 'File', 'Image', 'getComputedStyle', 'matchMedia', 'getSelection',
  'CustomEvent', 'Event', 'MouseEvent', 'KeyboardEvent', 'IntersectionObserver', 'MutationObserver',
  'ResizeObserver', 'AbortController', 'structuredClone', 'queueMicrotask', 'crypto', 'performance',
  'screen', 'HTMLElement', 'Node', 'NodeList', 'DOMParser', 'TextEncoder', 'TextDecoder', 'CSS',
  'self', 'globalThis', 'open', 'close', 'print', 'scrollTo', 'Notification', 'WebSocket',
  'EventSource', 'MediaRecorder', 'AudioContext', 'SpeechRecognition', 'webkitSpeechRecognition',
  // Node, y solo dentro del guard `typeof module !== 'undefined'` de los ficheros del navegador.
  'require', 'process',
]);

// SCRUM-676 · era una CUARTA opinión sobre qué es un comentario HTML, escrita aquí a mano. El
// extractor único ya exporta `sinComentarios` justo para esto, y su propio comentario lo dice: si
// cada consumidor decide por su cuenta, vuelve a haber dos criterios. Se usa el de la casa.
const sinComentariosHtml = sinComentarios;

/** Las páginas del producto. */
export function paginas(raiz) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) out.push(p);
    }
  };
  walk(path.join(raiz, 'public'));
  return out.sort();
}

/**
 * Los `<script src>` y `<link .css>` que la página CARGA de verdad (comentados no cuentan).
 *
 * SCRUM-670 · los `<script>` los lee el extractor ÚNICO. Éste era uno de los dos que acertaban
 * —quitaba comentarios y aceptaba comillas simples—, así que aquí no se pierde nada: lo que se
 * gana es que las otras cinco lecturas del repo pasen a compartir su criterio en vez de tener
 * cada una el suyo. Se juntan las tres clases porque esta función pregunta «qué carga la página»,
 * no «cómo se aísla cada cosa».
 *
 * SCRUM-676 · y las HOJAS también, por el mismo motivo y con dos defectos medidos encima: la
 * regex que vivía aquí exigía que el href ACABARA en `.css` —así que un `?v=` la dejaba a cero—
 * y contaba un `rel="preload"` como hoja cargada, que no lo es. Ahora la población se decide por
 * `rel`, como la decide el navegador. Se juntan locales y remotas porque la pregunta sigue
 * siendo «qué carga la página»; quien necesite sólo las del árbol filtra con `aFichero`.
 */
export function recursosDe(html) {
  const s = scriptsDeLaPagina(html);
  const h = hojasDeLaPagina(html);
  return {
    scripts: [...s.clasicos, ...s.modulos, ...s.remotos],
    hojas: [...h.locales, ...h.remotas],
  };
}

/** Resuelve una referencia del HTML a un fichero del árbol, o `null` si es externa/no existe. */
export function aFichero(raiz, pagina, ref) {
  if (/^(https?:)?\/\//.test(ref)) return null;
  const limpia = ref.split('?')[0];
  const abs = limpia.startsWith('/')
    ? path.join(raiz, 'public', limpia)
    : path.join(path.dirname(pagina), limpia);
  return fs.existsSync(abs) ? abs : null;
}

/** Nombres declarados en un fichero (a cualquier profundidad) y lo que cuelga de `window`. */
export function defineFichero(fuente) {
  const sf = ts.createSourceFile('x.js', fuente, ts.ScriptTarget.Latest, true);
  const declarados = new Set();
  const enWindow = new Set();
  const visita = (n) => {
    if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n) || ts.isFunctionExpression(n)) && n.name) declarados.add(n.name.text);
    if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) && ts.isIdentifier(n.name)) declarados.add(n.name.text);
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(n.left) && ts.isIdentifier(n.left.expression) &&
        n.left.expression.text === 'window') enWindow.add(n.left.name.text);
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return { declarados, enWindow, todo: new Set([...declarados, ...enWindow]) };
}

/**
 * Los nombres que un fichero LLAMA a pelo —`foo(...)`— sin declararlos él mismo.
 *
 * Solo llamadas con identificador desnudo, y es deliberado: ésas revientan con `ReferenceError` si
 * el nombre no existe. `window.foo(...)` no cuenta — en este repo va casi siempre tras un
 * `if (window.foo)`, que es una dependencia BLANDA y marcarla daría falsos rojos.
 */
export function llamaFichero(fuente) {
  const sf = ts.createSourceFile('x.js', fuente, ts.ScriptTarget.Latest, true);
  const { todo } = defineFichero(fuente);
  const out = new Set();
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const nombre = n.expression.text;
      if (!todo.has(nombre) && !PLATAFORMA.has(nombre)) out.add(nombre);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

/** Quién define cada global, en TODO el árbol de `public/`. Se DERIVA en cada tanda. */
export function globalesDelRepo(raiz) {
  const mapa = new Map();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) {
        for (const g of defineFichero(fs.readFileSync(p, 'utf8')).todo) {
          if (!mapa.has(g)) mapa.set(g, []);
          mapa.get(g).push(p);
        }
      }
    }
  };
  walk(path.join(raiz, 'public'));
  return mapa;
}

/** Clases CSS que define una hoja de estilos (selectores `.loQueSea`). */
export function clasesDeHoja(css) {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set([...sinComentarios.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
}

/**
 * Clases que define la propia página en sus bloques `<style>` inline.
 *
 * MEDIDO al escribir el guard, y sin esto habría nacido rojo sobre cinco páginas sanas: la
 * landing, precios, admin, privacidad y términos NO cargan `styles.css` — llevan su CSS dentro.
 * Un analizador que solo mira `<link>` las acusa a todas de usar clases que no cargan, y el guard
 * se habría estrenado señalando a quien no tenía culpa.
 */
export function clasesInline(html) {
  const out = new Set();
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    for (const c of clasesDeHoja(m[1])) out.add(c);
  }
  return out;
}

/** Clases que USA una página: las de su HTML y las que asigna el JS que carga. */
export function clasesQueUsa(html, fuentesJs) {
  const usadas = new Set();
  for (const m of sinComentariosHtml(html).matchAll(/class=["']([^"']+)["']/g)) {
    for (const c of m[1].split(/\s+/)) if (c) usadas.add(c);
  }
  for (const src of fuentesJs) {
    for (const m of src.matchAll(/className\s*=\s*["'`]([^"'`]+)["'`]/g)) {
      for (const c of m[1].split(/\s+/)) if (c && !c.includes('$')) usadas.add(c);
    }
    for (const m of src.matchAll(/classList\.(?:add|toggle|remove)\(\s*["']([^"']+)["']/g)) usadas.add(m[1]);
  }
  return usadas;
}

/**
 * El informe de una página, en los tres cubos.
 *
 * `cubo2` y `cubo3` son ROJO; el ① no se devuelve porque lo que no está en ningún cubo es lo que
 * está bien.
 */
export function analizarPagina(raiz, pagina, definidoPorElRepo, clasesPorHoja) {
  const html = fs.readFileSync(pagina, 'utf8');
  const { scripts, hojas } = recursosDe(html);

  const ficherosJs = scripts.map((r) => aFichero(raiz, pagina, r)).filter(Boolean);
  const fuentes = ficherosJs.map((f) => fs.readFileSync(f, 'utf8'));

  const defineLaPagina = new Set();
  for (const src of fuentes) for (const g of defineFichero(src).todo) defineLaPagina.add(g);

  const jsCubo2 = new Set();
  const jsCubo3 = new Set();
  for (const src of fuentes) {
    for (const g of llamaFichero(src)) {
      if (defineLaPagina.has(g)) continue;
      if (definidoPorElRepo.has(g)) jsCubo2.add(g);
      else jsCubo3.add(g);
    }
  }

  // ── CSS: mismo cubo ②. El ③ NO se aplica a las clases y se dice por qué: una clase que nadie
  //    estiliza suele ser un ANCLA de JS (`.inv-row-check`), no un defecto. Lo que sí es defecto es
  //    usar una clase que ALGUIEN estiliza y no cargar su hoja — que es el caso de `login.html`.
  const hojasDeLaPagina = hojas.map((r) => aFichero(raiz, pagina, r)).filter(Boolean);
  const clasesCargadas = new Set();
  for (const h of hojasDeLaPagina) for (const c of clasesDeHoja(fs.readFileSync(h, 'utf8'))) clasesCargadas.add(c);
  // Y lo que la página estiliza ELLA MISMA en su `<style>`: cuenta igual que una hoja cargada.
  for (const c of clasesInline(html)) clasesCargadas.add(c);

  const cssCubo2 = new Set();
  for (const c of clasesQueUsa(html, fuentes)) {
    if (clasesCargadas.has(c)) continue;
    const laDefineAlguien = [...clasesPorHoja.entries()].filter(([, cls]) => cls.has(c)).map(([h]) => h);
    if (laDefineAlguien.length) cssCubo2.add(c);
  }

  return {
    pagina: path.relative(raiz, pagina).replace(/\\/g, '/'),
    scripts: scripts.length,
    hojas: hojas.length,
    jsCubo2: [...jsCubo2].sort(),
    jsCubo3: [...jsCubo3].sort(),
    cssCubo2: [...cssCubo2].sort(),
  };
}

/** Las clases que define cada hoja del árbol. */
export function hojasDelRepo(raiz) {
  const mapa = new Map();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.css')) mapa.set(p, clasesDeHoja(fs.readFileSync(p, 'utf8')));
    }
  };
  walk(path.join(raiz, 'public'));
  return mapa;
}
