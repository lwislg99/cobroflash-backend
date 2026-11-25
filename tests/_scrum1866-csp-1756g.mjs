// tests/_scrum1866-csp-1756g.mjs — SCRUM-1866 · el clasificador del censo CSP de SCRUM-1756g, para su trinquete.
//
// 🔴 NO ES UN SEGUNDO CENSO. Es la SONDA 2 del guion de 1756g, copiada de
// `docs/master/evidencias/SCRUM-1756/1756g-censo.mjs.txt` (213 líneas, 18-nov, sesión J3 `jv-j3cj`):
//   · TS/JS con el AST de `typescript` (cadena / comentario / código);
//   · HTML sin `<!-- -->` y con el cuerpo de `<script>` aparte;
//   · CSS sin `/* */` (y en una hoja nada cuenta: su lugar es `css`, que no es vivo, como en el guion);
//   · los `<script type="…json">` son datos y no cuentan.
// Lo que cambia respecto al guion, y por qué:
//   · sólo las CUATRO columnas del trinquete (`<style`, `style="`, `<script>` sin `src`, `on*=`): el guion
//     buscaba además `setAttribute('style'` y `href="javascript:`, que su registro deja «sin medir» porque no
//     tienen siembra, así que su cero no vale y aquí no se congelan;
//   · no calcula la línea de cada ocurrencia (el trinquete compara cifras por fichero);
//   · la población sale de `git ls-files` del ÁRBOL que se mide (el guion leía `git ls-tree <sha>`), y el texto
//     se lee del disco: es lo que el obligatorio tiene delante, el merge del PR;
//   · la siembra se escribe en `os.tmpdir()` y se censa con la MISMA función que la población (`censar`).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

export const COLUMNAS = Object.freeze(['style_tag', 'style_attr', 'script', 'on']);
export const ROTULO = Object.freeze({ style_tag: '<style', style_attr: 'style="', script: '<script> sin src', on: 'on*=' });
export const CORREO = 'src/modules/messaging/';
export const TEXTO = /\.(ts|m?js|html|css)$/;

/** `typescript` del propio repo, o el error por el que no carga (el test sale CIEGO, nunca verde). */
export function cargarTs(raiz) {
  try {
    const ts = createRequire(path.join(raiz, 'package.json'))('typescript');
    if (typeof ts?.createSourceFile !== 'function') return { ts: null, error: 'typescript cargó sin createSourceFile' };
    return { ts, error: null };
  } catch (e) {
    return { ts: null, error: String(e?.message ?? e).split('\n')[0] };
  }
}

// ── La sonda 2 de 1756g, tal cual (RX de las cuatro columnas, rangosTs, rangosHtml) ──────────────
const RX = {
  style_tag: /<style[\s>]/gi,
  style_attr: /\sstyle\s*=\s*\\?["']/gi,
  script: /<script\b([^>]*)>/gi,
  on: /[\s"']on[a-z]{3,}\s*=\s*\\?["']/gi,
};
function rangosTs(ts, ruta, txt) {
  const kind = /\.m?js$/.test(ruta) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(ruta, txt, ts.ScriptTarget.Latest, true, kind);
  const cad = [], com = [];
  const K = ts.SyntaxKind;
  const visto = new Set();
  const comentarios = (pos) => {
    for (const f of [ts.getLeadingCommentRanges, ts.getTrailingCommentRanges]) {
      for (const c of f(txt, pos) ?? []) { const k = c.pos + ':' + c.end; if (!visto.has(k)) { visto.add(k); com.push([c.pos, c.end]); } }
    }
  };
  (function v(n) {
    comentarios(n.pos); comentarios(n.end);
    if ([K.StringLiteral, K.NoSubstitutionTemplateLiteral, K.TemplateHead, K.TemplateMiddle, K.TemplateTail, K.RegularExpressionLiteral].includes(n.kind)) cad.push([n.getStart(sf), n.end, n.kind === K.RegularExpressionLiteral ? 'regex' : 'cadena']);
    ts.forEachChild(n, v);
  })(sf);
  comentarios(sf.endOfFileToken.pos);
  return (i) => {
    for (const [a, b, t] of cad) if (i >= a && i < b) return t;
    for (const [a, b] of com) if (i >= a && i < b) return 'comentario';
    return 'codigo';
  };
}
function rangosHtml(txt, css) {
  const r = [];
  const re = css ? /\/\*[\s\S]*?\*\//g : /<!--[\s\S]*?-->/g;
  for (const m of txt.matchAll(re)) r.push([m.index, m.index + m[0].length, 'comentario']);
  if (!css) for (const m of txt.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) { const a = m.index + m[0].indexOf('>') + 1; r.push([a, a + m[1].length, 'dentro-de-guion']); }
  return (i) => { for (const [a, b, t] of r) if (i >= a && i < b) return t; return css ? 'css' : 'marcado'; };
}
const vivo = (l) => l === 'cadena' || l === 'marcado' || l === 'dentro-de-guion' || l === 'codigo';

/** Ocurrencias VIVAS por columna de un fichero (la sonda 2: fuera de comentario y de bloque de datos). */
export function contarVivos(ts, ruta, txt) {
  const donde = /\.(m?js|ts)$/.test(ruta) ? rangosTs(ts, ruta, txt) : rangosHtml(txt, /\.css$/.test(ruta));
  const c = { style_tag: 0, style_attr: 0, script: 0, on: 0 };
  for (const [k, rx] of Object.entries(RX)) {
    for (const m of txt.matchAll(rx)) {
      if (k === 'script') {
        if (/\ssrc\s*=/.test(m[1])) continue;
        const t = /type\s*=\s*\\?["']([^"'\\]+)/.exec(m[1]);
        if (t && /json/.test(t[1])) continue; // datos, no se ejecutan
      }
      if (vivo(donde(m.index))) c[k]++;
    }
  }
  return c;
}

/** Los ficheros que `git ls-files` da en src/** + public/** del árbol `raiz` (null si git no contesta). */
export function listaGit(raiz) {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--', 'src', 'public'], { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 26 });
    return out.split('\0').filter(Boolean);
  } catch { return null; }
}

/**
 * La población y su tabla: de `lista` se quita el correo (src/modules/messaging/**), se analizan los de
 * texto (ts/js/mjs/html/css) y se devuelven SOLO los ficheros con alguna columna > 0.
 */
export function censar(ts, raiz, lista) {
  const correo = lista.filter((p) => p.startsWith(CORREO));
  const pob = lista.filter((p) => !p.startsWith(CORREO));
  const texto = pob.filter((p) => TEXTO.test(p));
  const tabla = {};
  const noLeidos = [];
  for (const f of texto) {
    let txt;
    try { txt = fs.readFileSync(path.join(raiz, f), 'utf8'); } catch { noLeidos.push(f); continue; }
    const c = contarVivos(ts, f, txt);
    if (COLUMNAS.some((k) => c[k] > 0)) tabla[f] = c;
  }
  return { total: lista.length, correo: correo.length, poblacion: pob.length, texto: texto.length, noLeidos, tabla };
}

/** Subidas (y ficheros nuevos > 0) y bajadas, fichero a fichero y columna a columna. */
export function comparar(congelada, actual) {
  const subidas = [], bajadas = [];
  const cero = { style_tag: 0, style_attr: 0, script: 0, on: 0 };
  for (const f of [...new Set([...Object.keys(congelada), ...Object.keys(actual)])].sort()) {
    const a = congelada[f] ?? cero, b = actual[f] ?? cero;
    for (const k of COLUMNAS) {
      const antes = a[k] ?? 0, ahora = b[k] ?? 0;
      const fila = { f, k, antes, ahora, nuevo: !(f in congelada) };
      if (ahora > antes) subidas.push(fila); else if (ahora < antes) bajadas.push(fila);
    }
  }
  return { subidas, bajadas };
}
export const comoLinea = (x) => `${x.f}:${ROTULO[x.k]}:${x.antes}→${x.ahora}${x.nuevo ? ' (sin fila en la tabla: fichero nuevo o que estaba a 0)' : ''}`;

/** El JSON congelado, un fichero por línea (dos PR que tocan ficheros distintos no chocan). */
export function serializar(meta, tabla) {
  const filas = Object.keys(tabla).sort().map((f) => `    ${JSON.stringify(f)}: ${JSON.stringify(Object.fromEntries(COLUMNAS.map((k) => [k, tabla[f][k]])))}`);
  const cab = Object.entries(meta).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  return `{\n${cab.join('\n')}\n  "ficheros": {\n${filas.join(',\n')}\n  }\n}\n`;
}

// ── Siembra y cero (fabricados aquí: el positivo se siembra, no se toma prestado del árbol) ───────
// Los textos de `public/siembra.html`, `src/siembra.ts` y `public/cero.html` son los del guion de 1756g;
// `src/modules/messaging/siembra-correo.ts` es nuevo: comprueba que el correo queda FUERA de la población.
export const SIEMBRA = Object.freeze({
  'public/siembra.html': '<!doctype html>\n<!-- <style> comentado: no cuenta en S2 -->\n<style>p{color:red}</style>\n<p style="color:red">x</p>\n<script>var a=1;</script>\n<script src="/a.js"></script>\n<button onclick="go()">b</button>\n',
  'src/siembra.ts': '// un <style> en comentario: S1 lo cuenta, S2 lo da por comentario\nexport const h = `<style>a{}</style><b style="x:y" onclick="f()">c</b><script>1</script>`;\n',
  'public/cero.html': '<!doctype html>\n<link rel="stylesheet" href="/a.css">\n<script src="/b.js"></script>\n<p class="styles">sin nada</p>\n',
  'src/modules/messaging/siembra-correo.ts': 'export const c = `<p style="color:red" onclick="x()">correo</p>`;\n',
});
// Lo que TIENE que salir, derivado de los textos de arriba (no de lo que dé el instrumento):
export const ESPERADO_SIEMBRA = Object.freeze({
  'public/siembra.html': { style_tag: 1, style_attr: 1, script: 1, on: 1 },
  'src/siembra.ts': { style_tag: 1, style_attr: 1, script: 1, on: 1 },
});

/** Escribe la siembra en un temporal propio de `os.tmpdir()`, la censa con `censar` y la borra. */
export function censarSiembra(ts, { sinSiembra = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-1866-${process.pid}-`));
  try {
    if (!sinSiembra) {
      for (const [p, t] of Object.entries(SIEMBRA)) {
        fs.mkdirSync(path.join(dir, path.dirname(p)), { recursive: true });
        fs.writeFileSync(path.join(dir, p), t);
      }
    }
    const lista = sinSiembra ? [] : Object.keys(SIEMBRA);
    return censar(ts, dir, lista);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
