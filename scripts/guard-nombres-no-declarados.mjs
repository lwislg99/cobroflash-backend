#!/usr/bin/env node
// SCRUM-1280 — Un nombre NO DECLARADO en el panel pone el check en rojo.
//
// POR QUÉ: SCRUM-1275 (pulsar una fila de Facturas no abría nada) era `cb`, leído fuera del `if`
// que lo declaraba. 20 días en producción con la suite en verde: el panel es JavaScript suelto y
// un nombre que no existe no se nota hasta que alguien pulsa. Este guard lo caza en segundos.
//
// CÓMO MIDE (y por qué así):
//  · POBLACIÓN = los <script> que carga `public/dashboard/index.html`, en su orden, más sus
//    bloques en línea. Es la puerta por la que entra el navegador: un fichero que el panel no
//    carga no es del panel, y uno que carga y no está en disco sale como «no medido».
//  · UN SOLO programa de TypeScript (checkJs) con todos: comparten el ámbito global igual que en
//    el navegador. Fichero a fichero salen cientos de falsos y el guard se acaba apagando.
//  · Las globales PUBLICADAS se declaran solas, por AST: `window.X = …`, `globalThis.X = …`,
//    `self.X = …` y `root.X = …` cuando `root` es el parámetro de una IIFE a la que se le pasa
//    `this`/`window`/`globalThis`/`self`. Sin esto, cada ayudante compartido (`cabeceraModal`,
//    `renderAppView`, `tipoDeFactura`…) sale como «no encontrado» (medido el 29-sep: 70 nombres).
//    Y las de primer nivel de un script con `module.exports` (para TS, CommonJS; en el navegador,
//    globales como las demás).
//  · Solo cuentan 2304 («Cannot find name») y 2552 (el mismo con «Did you mean…»): un nombre que
//    no existe en ningún sitio. Nada de tipos ni de estilo: en cuanto el guard opine, lo apagan.
//  · Un nombre usado SOLO como operando de `typeof` no cuenta: `typeof X` nunca lanza, es la
//    forma de preguntar si existe (patrón de dependencia opcional y de `module` en los tests).
//
// CONTROL POSITIVO: al programa se le añade un fichero virtual que usa un nombre que no existe.
// Si el guard no lo caza, sale con 2 («no supo medir»), NUNCA con 0.
//
// SALIDA: 0 limpio · 1 hay nombres sin declarar (fichero:línea, nombre y qué hacer) · 2 no medido.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(RAIZ_REPO, 'package.json'));

// Excepciones: UNA A UNA, con su motivo. Clave = fichero + nombre (las líneas se mueven).
// Si una deja de salir, el guard lo dice («caducada») y sale en rojo: la lista no se pudre.
export const EXCEPCIONES = [
  {
    fichero: 'documentoAsignados.js', nombre: 'miembros',
    motivo: 'Dentro de un comentario JSDoc (`@param opts { miembros, … }`): TypeScript lo lee como tipo. No es código, nunca se ejecuta.',
  },
  {
    fichero: 'jobAsignados.js', nombre: 'miembros',
    motivo: 'Dentro de un comentario JSDoc (`@param opts { miembros, … }`): TypeScript lo lee como tipo. No es código, nunca se ejecuta.',
  },
  {
    fichero: 'jobTrabajoPlegable.js', nombre: 'clave',
    motivo: 'Dentro de un comentario JSDoc (`@param o { clave, rotulo, valor }`): TypeScript lo lee como tipo. No es código, nunca se ejecuta.',
  },
  {
    fichero: 'jobTrabajoPlegable.js', nombre: 'elemento',
    motivo: 'Dentro de un comentario JSDoc (`@returns { elemento, cuerpo, … }`): TypeScript lo lee como tipo. No es código, nunca se ejecuta.',
  },
];

const NOMBRE_CONTROL = 'nombreQueNoExisteEnElPanel_scrum1280';
const FICHERO_CONTROL = '__control-positivo-scrum1280__.js';
const FICHERO_GLOBALES = '__globales-publicadas-scrum1280__.d.ts';
const CODIGOS = new Set([2304, 2552]);
const RAICES_GLOBALES = new Set(['window', 'globalThis', 'self']);
// Suelo de población: el 29-sep-2026 el panel carga 95 scripts. Si de pronto salen muchos menos,
// el instrumento está mirando otra cosa (index.html movido, regex rota) y no puede decir «limpio».
const SUELO_SCRIPTS = 60;

/** Lee los <script> del panel: externos (src local) y en línea, en orden. */
export function poblacion(raiz = RAIZ_REPO) {
  const html = path.join(raiz, 'public/dashboard/index.html');
  if (!fs.existsSync(html)) return { error: `no existe ${path.relative(raiz, html)}` };
  const texto = fs.readFileSync(html, 'utf8');
  const piezas = [];
  const faltan = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m; let enLinea = 0;
  while ((m = re.exec(texto))) {
    const attrs = m[1];
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (/\btype\s*=\s*["'](?!text\/javascript|module)[^"']*["']/i.test(attrs)) continue; // JSON-LD, plantillas…
    if (src) {
      if (/^(https?:)?\/\//i.test(src[1])) continue; // CDN: fuera del repositorio
      const ruta = path.resolve(path.dirname(html), src[1].split(/[?#]/)[0]);
      if (!fs.existsSync(ruta)) { faltan.push(src[1]); continue; }
      piezas.push({ nombre: path.relative(path.join(raiz, 'public/dashboard/js'), ruta).replace(/\\/g, '/'), ruta, texto: fs.readFileSync(ruta, 'utf8') });
    } else if (m[2].trim()) {
      enLinea += 1;
      const linea = texto.slice(0, m.index).split('\n').length;
      piezas.push({ nombre: `index.html#en-linea-${enLinea}(l.${linea})`, ruta: path.join(raiz, `__index-en-linea-${enLinea}.js`), texto: m[2] });
    }
  }
  return { piezas, faltan };
}

function esRaizGlobal(ts, e) {
  if (!e) return false;
  if (ts.isParenthesizedExpression(e)) return esRaizGlobal(ts, e.expression);
  if (e.kind === ts.SyntaxKind.ThisKeyword) return true;
  if (ts.isIdentifier(e)) return RAICES_GLOBALES.has(e.text);
  if (ts.isConditionalExpression(e)) return esRaizGlobal(ts, e.whenTrue) && esRaizGlobal(ts, e.whenFalse);
  return false;
}

/** Nombres publicados como globales (`window.X =`, `root.X =` en una IIFE que recibe la raíz). */
export function globalesPublicadas(ts, sf) {
  const nombres = new Set();
  const visitar = (nodo, alias) => {
    let aliasAqui = alias;
    if (ts.isCallExpression(nodo)) {
      let f = nodo.expression;
      while (ts.isParenthesizedExpression(f)) f = f.expression;
      if (ts.isFunctionExpression(f) || ts.isArrowFunction(f)) {
        const nuevos = new Set(alias);
        f.parameters.forEach((p, i) => {
          if (ts.isIdentifier(p.name) && esRaizGlobal(ts, nodo.arguments[i])) nuevos.add(p.name.text);
        });
        aliasAqui = nuevos;
      }
    }
    if (ts.isBinaryExpression(nodo) && nodo.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const izq = nodo.left;
      if (ts.isPropertyAccessExpression(izq) && ts.isIdentifier(izq.expression)) {
        const base = izq.expression.text;
        if (RAICES_GLOBALES.has(base) || aliasAqui.has(base)) nombres.add(izq.name.text);
      }
    }
    ts.forEachChild(nodo, (h) => visitar(h, aliasAqui));
  };
  visitar(sf, new Set());
  // Un script con `module.exports` es, para TypeScript, un módulo CommonJS y sus declaraciones de
  // primer nivel dejan de ser globales. En el navegador es un <script> clásico y SÍ lo son.
  if (usaModuleExports(ts, sf)) for (const n of declaracionesDePrimerNivel(ts, sf)) nombres.add(n);
  return nombres;
}

function usaModuleExports(ts, sf) {
  let si = false;
  const mirar = (n) => {
    if (si) return;
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'module' && n.name.text === 'exports') si = true;
    else ts.forEachChild(n, mirar);
  };
  mirar(sf);
  return si;
}

function declaracionesDePrimerNivel(ts, sf) {
  const nombres = [];
  for (const s of sf.statements) {
    if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) && s.name) nombres.push(s.name.text);
    if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name)) nombres.push(d.name.text);
    }
  }
  return nombres;
}

export function medir({ raiz = RAIZ_REPO, piezasExtra = [], excepcionesDeclaradas = EXCEPCIONES } = {}) {
  let ts;
  try { ts = require('typescript'); } catch (e) { return { noMedido: `no se pudo cargar typescript: ${e.message}` }; }
  const pob = poblacion(raiz);
  if (pob.error) return { noMedido: pob.error };
  if (pob.faltan.length) return { noMedido: `index.html carga scripts que no existen en disco: ${pob.faltan.join(', ')}` };
  const externos = pob.piezas.filter((p) => !p.nombre.startsWith('index.html#')).length;
  if (externos < SUELO_SCRIPTS) return { noMedido: `solo ${externos} scripts del panel (suelo ${SUELO_SCRIPTS}): el instrumento no está mirando el panel` };

  const control = { nombre: FICHERO_CONTROL, ruta: path.join(raiz, FICHERO_CONTROL), texto: `function __controlScrum1280() { return ${NOMBRE_CONTROL}; }\n` };
  const piezas = [...pob.piezas, ...piezasExtra, control];

  const publicadas = new Set();
  for (const p of piezas) {
    const sf = ts.createSourceFile(p.ruta, p.texto, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
    for (const n of globalesPublicadas(ts, sf)) publicadas.add(n);
  }
  const rutaGlobales = path.join(raiz, FICHERO_GLOBALES);
  const dts = [...publicadas].sort().map((n) => `declare var ${n}: any;`).join('\n') + '\n';

  const virtuales = new Map(piezas.map((p) => [path.normalize(p.ruta), p]));
  virtuales.set(path.normalize(rutaGlobales), { nombre: FICHERO_GLOBALES, ruta: rutaGlobales, texto: dts });
  const opciones = {
    allowJs: true, checkJs: true, noEmit: true, target: ts.ScriptTarget.ES2022,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'], types: [], skipLibCheck: true,
  };
  const host = ts.createCompilerHost(opciones);
  const leerOriginal = host.getSourceFile.bind(host);
  host.getSourceFile = (nombre, lang, ...resto) => {
    const v = virtuales.get(path.normalize(nombre));
    if (v) return ts.createSourceFile(nombre, v.texto, lang, true, nombre.endsWith('.d.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    return leerOriginal(nombre, lang, ...resto);
  };
  const existeOriginal = host.fileExists.bind(host);
  host.fileExists = (n) => virtuales.has(path.normalize(n)) || existeOriginal(n);
  const programa = ts.createProgram([...virtuales.keys()], opciones, host);

  const hallazgos = [];
  let controlCazado = false;
  for (const d of ts.getPreEmitDiagnostics(programa)) {
    if (!CODIGOS.has(d.code) || !d.file) continue;
    const v = virtuales.get(path.normalize(d.file.fileName));
    if (!v) continue;
    const nombre = d.file.text.slice(d.start, d.start + d.length);
    if (v.nombre === FICHERO_CONTROL) { if (nombre === NOMBRE_CONTROL) controlCazado = true; continue; }
    const nodo = nodoEn(ts, d.file, d.start);
    if (nodo && nodo.parent && ts.isTypeOfExpression(nodo.parent)) continue; // `typeof X` no lanza
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    hallazgos.push({ fichero: v.nombre, linea: line + 1, nombre, codigo: d.file.text.split('\n')[line].trim().slice(0, 140) });
  }
  if (!controlCazado) return { noMedido: `CONTROL POSITIVO FALLIDO: el nombre inventado «${NOMBRE_CONTROL}» no salió. El instrumento no sabe detectar; su «limpio» no vale nada.` };

  const clave = (x) => `${x.fichero}::${x.nombre}`;
  const excepciones = new Map(excepcionesDeclaradas.map((e) => [clave(e), e]));
  const vistas = new Set();
  const reales = [];
  for (const h of hallazgos) {
    if (excepciones.has(clave(h))) { vistas.add(clave(h)); continue; }
    reales.push(h);
  }
  const caducadas = excepcionesDeclaradas.filter((e) => !vistas.has(clave(e)));
  return { reales, caducadas, poblacion: { scripts: externos, enLinea: pob.piezas.length - externos, publicadas: publicadas.size } };
}

function nodoEn(ts, sf, pos) {
  let hallado;
  const bajar = (n) => {
    if (pos < n.getStart(sf) || pos >= n.getEnd()) return;
    hallado = n;
    ts.forEachChild(n, bajar);
  };
  bajar(sf);
  return hallado;
}

function main() {
  const r = medir();
  if (r.noMedido) {
    console.error(`❌ NO MEDIDO (SCRUM-1280): ${r.noMedido}`);
    process.exit(2);
  }
  const { scripts, enLinea, publicadas } = r.poblacion;
  console.log(`Nombres no declarados en el panel (SCRUM-1280) · población: ${scripts} scripts de public/dashboard/index.html + ${enLinea} bloque(s) en línea, en UN programa · ${publicadas} globales publicadas · control positivo cazado · ${EXCEPCIONES.length} excepciones declaradas`);
  let rojo = false;
  if (r.reales.length) {
    rojo = true;
    console.error(`\n❌ ${r.reales.length} uso(s) de un nombre que no está declarado en ninguna parte del panel:`);
    for (const h of r.reales) console.error(`  public/dashboard/js/${h.fichero}:${h.linea} · «${h.nombre}»\n      ${h.codigo}`);
    console.error('\nQué hacer: en el navegador eso es un ReferenceError en cuanto la línea se ejecuta (SCRUM-1275: el clic de una fila no hacía nada).');
    console.error('  · Si el nombre debía existir: decláralo en su ámbito (o publícalo con `window.X = X` en el fichero que lo define).');
    console.error('  · Si es un falso (p. ej. dentro de un comentario JSDoc): añádelo a EXCEPCIONES en scripts/guard-nombres-no-declarados.mjs, UNO, con su motivo.');
  }
  if (r.caducadas.length) {
    rojo = true;
    console.error(`\n❌ ${r.caducadas.length} excepción(es) caducada(s): ya no salen, quítalas de EXCEPCIONES:`);
    for (const e of r.caducadas) console.error(`  ${e.fichero} · «${e.nombre}»`);
  }
  if (rojo) process.exit(1);
  console.log('✅ ningún nombre sin declarar.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
