// docs/master/evidencias/SCRUM-1544/medir.mjs — SCRUM-1544
//
// Tres mediciones sobre `tests/_censo-por-posicion.mjs`, y ninguna toca el árbol:
//
//   ① SIEMBRA. Una raíz fabricada en el temporal, con una cita `fichero:línea` por fichero: unas
//      escritas ENTERAS en un literal y otras ARMADAS de otra manera. Antes de preguntarle al censo
//      se comprueba que el veneno ENTRÓ: cada fichero sembrado se importa y su valor, ya en
//      ejecución, tiene que ser la cita.
//   ② EL CASO REAL. El test de SCRUM-1537 tal como estaba en `1b827185f` (tres citas enteras) y
//      tal como lo dejó `5b46be141` (las mismas, troceadas), sacados de git a la raíz fabricada.
//   ③ EL BARRIDO. Cuántas citas armadas en ejecución hay hoy en `tests/` y `scripts/`, por AST,
//      sobre la MISMA población de ficheros que lee el censo.
//
// Uso: node docs/master/evidencias/SCRUM-1544/medir.mjs [--lista]
//      CENSO=docs/master/evidencias/SCRUM-1544/censo-ANTES.mjs node …/medir.mjs   (el censo de antes)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const LISTA = process.argv.includes('--lista');
const di = (...a) => console.log(...a);

// Qué censo se mide: el del árbol, o el que diga CENSO (para medir el de ANTES, copiado de main).
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RUTA_CENSO = process.env.CENSO ? path.resolve(process.env.CENSO) : path.join(RAIZ, 'tests', '_censo-por-posicion.mjs');
const { anclajesPorLinea } = await import(pathToFileURL(RUTA_CENSO).href);
di('censo medido:', path.relative(RAIZ, RUTA_CENSO).split(path.sep).join('/'), '·', fs.statSync(RUTA_CENSO).size, 'B');
di('');

// La misma forma que busca el censo, copiada de él para comprobar el valor en ejecución.
const CITA = /[\w.\-/]+\.(?:js|mjs|ts|tsx|html|md):\d+/;

// ═══ ① SIEMBRA ═══════════════════════════════════════════════════════════════════════════
const F = 'src/sembrado.ts';
const SIEMBRAS = [
  // [nombre, si la veía el censo de ANTES (sólo informativo), fuente del módulo]
  ['entera-en-comillas', true, `export const cita = '${F}:12 calcula()';`],
  ['entera-en-plantilla-sin-huecos', true, 'export const cita = `' + F + ':12 calcula()`;'],
  ['join', false, `export const cita = ['${F}', 12].join(':') + ' calcula()';`],
  ['concatenada', false, `export const cita = '${F}' + ':' + 12 + ' calcula()';`],
  ['plantilla-con-la-linea-en-un-hueco', false, 'export const cita = `' + F + ':${12} calcula()`;'],
  ['entera-en-plantilla-con-un-hueco-al-lado', false,
    'const expr = "calcula()";\nexport const cita = `' + F + ':12 ${expr}`;'],
  ['linea-en-una-constante', false, `const L = 12;\nexport const cita = '${F}:' + L + ' calcula()';`],
  ['dos-puntos-por-codigo', false,
    `export const cita = '${F}' + String.fromCharCode(58) + '12 calcula()';`],
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1544-'));
let salida = 0;
try {
  fs.mkdirSync(path.join(tmp, 'tests'));
  for (const [nombre, , fuente] of SIEMBRAS) {
    fs.writeFileSync(path.join(tmp, 'tests', `${nombre}.mjs`), fuente + '\n');
  }
  di('① SIEMBRA · raíz fabricada, una cita por fichero · población:', SIEMBRAS.length, 'ficheros');
  const censo = anclajesPorLinea(tmp, ['tests']);
  di(`   el censo leyó ${censo.leidos} ficheros y halló ${censo.hallados.length}`);
  let entro = 0; let comoSeEsperaba = 0;
  for (const [nombre, esperaVer] of SIEMBRAS) {
    const mod = await import(pathToFileURL(path.join(tmp, 'tests', `${nombre}.mjs`)).href);
    const enEjecucion = CITA.test(mod.cita) && mod.cita.startsWith(`${F}:12`);
    if (enEjecucion) entro++;
    const visto = censo.hallados.some((h) => h.fichero === `tests/${nombre}.mjs`);
    if (visto) comoSeEsperaba++;
    di(`   ${visto ? 'VE     ' : 'NO VE  '} ${nombre.padEnd(44)} en ejecución es la cita: ${enEjecucion ? 'sí' : 'NO'}`
);
  }
  di(`   el veneno entró en ${entro} de ${SIEMBRAS.length} · el censo VE ${comoSeEsperaba} de ${SIEMBRAS.length}`);
  if (entro !== SIEMBRAS.length) { di('   🔴 CIEGO: una siembra no es la cita en ejecución'); salida = 2; }

  // ═══ ② EL CASO REAL ════════════════════════════════════════════════════════════════════
  di('');
  di('② EL CASO REAL · tests/scrum1537-los-dos-cotejos.test.mjs, sacado de git a la raíz fabricada');
  for (const sha of ['1b827185fc2724e682498d92f4cd87ece46225d9', '5b46be141fb56fbd4f133eff3e98cdee432383ce']) {
    const r2 = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1544-real-'));
    try {
      fs.mkdirSync(path.join(r2, 'tests'));
      let fuente;
      try {
        fuente = execFileSync('git', ['show', `${sha}:tests/scrum1537-los-dos-cotejos.test.mjs`],
          { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 26 });
      } catch (e) { di(`   ${sha.slice(0, 9)} · CIEGO: git no tiene ese commit aquí`); salida = 2; continue; }
      fs.writeFileSync(path.join(r2, 'tests', 'scrum1537-los-dos-cotejos.test.mjs'), fuente);
      const c = anclajesPorLinea(r2, ['tests']);
      const menciones = (fuente.match(/sembrado\.ts/g) || []).length;
      di(`   ${sha.slice(0, 9)} · ${fuente.length} caracteres · «sembrado.ts» aparece ${menciones} veces · `
        + `el censo leyó ${c.leidos} y halló ${c.hallados.length}`
        + (c.hallados.length ? ` (${c.hallados.map((h) => h.cita).join(', ')})` : ''));
    } finally { fs.rmSync(r2, { recursive: true, force: true }); }
  }
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// ═══ ③ EL BARRIDO ════════════════════════════════════════════════════════════════════════
// La misma población que el censo: `tests/` y `scripts/`, .mjs/.js/.ts, sin node_modules/.git/dist.
function ficheros(dir, out = [], fuera = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { ficheros(p, out, fuera); continue; }
    if (/\.(mjs|js|ts)$/.test(e.name)) out.push(p); else fuera.push(p);
  }
  return out;
}
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const H = '§'; // el hueco: una pieza que no es un literal

/** El «esqueleto» de una expresión que arma texto: los literales con su texto, lo demás un hueco. */
function esCompuesta(n) {
  if (ts.isTemplateExpression(n)) return true;
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) return true;
  if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'join' && n.arguments.length === 1
      && ts.isStringLiteralLike(n.arguments[0]) && ts.isArrayLiteralExpression(n.expression.expression)) return true;
  return false;
}
function esqueleto(n, opacos) {
  if (ts.isParenthesizedExpression(n)) return esqueleto(n.expression, opacos);
  // Un literal que YA lleva la cita entera lo ve el censo por su cuenta: aqui es un hueco.
  if (ts.isStringLiteralLike(n)) { if (CITA.test(n.text)) { yaVistas++; return H; } return n.text; }
  if (ts.isNumericLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n)) {
    return n.head.text + n.templateSpans.map((s) => esqueleto(s.expression, opacos) + s.literal.text).join('');
  }
  if (esCompuesta(n) && ts.isBinaryExpression(n)) return esqueleto(n.left, opacos) + esqueleto(n.right, opacos);
  if (esCompuesta(n) && ts.isCallExpression(n)) {
    return n.expression.expression.elements.map((el) => esqueleto(el, opacos)).join(n.arguments[0].text);
  }
  opacos.push(n);
  return H;
}

const EXT = '(?:js|mjs|ts|tsx|html|md)';
const CLASES = [
  // de la más grave a la más ancha; la primera que casa gana
  ['A · fichero y línea ESCRITOS, sólo troceados', new RegExp(`[\\w.\\-/]+\\.${EXT}:\\d+`)],
  ['B · fichero escrito, línea en un hueco', new RegExp(`[\\w.\\-/${H}]*\\.${EXT}:${H}`)],
  ['C · fichero en un hueco, línea ESCRITA', new RegExp(`${H}:\\d+`)],
  ['D · fichero y línea en huecos', new RegExp(`${H}:${H}`)],
];
const porClase = new Map(CLASES.map(([c]) => [c, []]));
const regexConCita = [];
const extFuera = [];
let leidos = 0; let compuestas = 0; let yaVistas = 0;
const fuera = [];
const todos = [...ficheros(path.join(RAIZ, 'tests'), [], fuera), ...ficheros(path.join(RAIZ, 'scripts'), [], fuera)];
for (const p of todos) {
  leidos++;
  const src = fs.readFileSync(p, 'utf8');
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true,
    p.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  (function walk(n) {
    if (esCompuesta(n)) {
      compuestas++;
      const opacos = [];
      const esq = esqueleto(n, opacos);
      {
        for (const [clase, re] of CLASES) {
          if (re.test(esq)) { porClase.get(clase).push({ f: rel(p), l: linea(n), t: n.getText(sf).replace(/\s+/g, ' ').slice(0, 110) }); break; }
        }
      }
      for (const o of opacos) walk(o);
      return;
    }
    if (n.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      const t = n.getText(sf).replace(/\\/g, '');
      if (new RegExp(`\\.${EXT}:\\d+`).test(t)) regexConCita.push({ f: rel(p), l: linea(n), t: n.getText(sf).slice(0, 110) });
    }
    if (ts.isStringLiteralLike(n) && !CITA.test(n.text)
        && /[\w.\-/]+\.(?:cjs|css|json|prisma|yml|yaml|sql|sh|ps1|txt|jsx):\d+/.test(n.text)) {
      extFuera.push({ f: rel(p), l: linea(n), t: n.text.replace(/\s+/g, ' ').slice(0, 110) });
    }
    ts.forEachChild(n, walk);
  })(sf);
}

di('');
di('③ EL BARRIDO · tests/ y scripts/ ·', leidos, 'ficheros leídos (.mjs/.js/.ts, los que lee el censo) ·',
  fuera.length, 'que el censo NO lee por su extensión');
const porExt = new Map();
for (const p of fuera) { const e = path.extname(p) || '(sin)'; porExt.set(e, (porExt.get(e) || 0) + 1); }
di('   no leídos, por extensión:', [...porExt].sort((a, b) => b[1] - a[1]).map(([e, n]) => `${e} ${n}`).join(' · '));
const censoReal = anclajesPorLinea(RAIZ);
di(`   control: el censo de verdad lee ${censoReal.leidos} y halla ${censoReal.hallados.length} citas enteras`);
di(`   expresiones que arman texto (plantilla con huecos, suma, join de una lista): ${compuestas}`
  + ` · literales de dentro con la cita ya entera (los ve el censo de siempre): ${yaVistas}`);
for (const [clase] of CLASES) {
  const hs = porClase.get(clase);
  di(`   ${clase}: ${hs.length} en ${new Set(hs.map((h) => h.f)).size} ficheros`);
  const conTexto = /^[AB] /.test(clase);
  if (conTexto || (LISTA && /^C /.test(clase))) for (const h of hs) di(`       ${h.f}:${h.l}` + (conTexto ? `  ${h.t}` : ''));
}
di(`   expresión regular con un fichero:línea escrito dentro: ${regexConCita.length}`);
for (const h of regexConCita) di(`       ${h.f}:${h.l}  ${h.t}`);
di(`   cita entera a una extensión que el censo no reconoce (cjs, css, json, prisma…): ${extFuera.length}`
  + ` en ${new Set(extFuera.map((h) => h.f)).size} ficheros`);
if (LISTA || extFuera.length <= 12) for (const h of extFuera) di(`       ${h.f}:${h.l}  ${h.t}`);
di('');
di(`EXIT=${salida}`);
process.exitCode = salida;
