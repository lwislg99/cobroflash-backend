// docs/master/evidencias/scrum864/censo-mkdtemp.mjs — SCRUM-864
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ¿CUÁNTAS LLAMADAS A `mkdtempSync` HAY, Y CUÁNTAS LIMPIAN PASE LO QUE PASE?
//
// Por AST (`typescript`, ya en el árbol — regla 36), no por `grep`. La diferencia no es de estilo:
// `grep` cuenta líneas que MENCIONAN la palabra —comentarios, cadenas, el propio censo— y no
// sabe si el borrado está dentro de un `finally` o colgando del camino feliz, que es justo la
// pregunta del ticket.
//
// ── LAS TRES CATEGORÍAS, y por qué son tres y no dos ──────────────────────────────────────
//
//   ✅ GARANTIZADA ....... el borrado cuelga de `finally`, de un hook `after`/`afterEach` del
//                          runner, o de `process.on('exit')`. Si el cuerpo revienta, se borra.
//   ⚠️ NO GARANTIZADA .... SÍ se borra, pero sólo por el camino feliz. Un `assert` que falla
//                          salta el borrado: el resto queda. **Éste es el defecto del ticket.**
//   🔴 SIN LIMPIEZA ...... el directorio no se borra en ninguna parte del fichero.
//
// Juntar las dos últimas en «no limpia» taparía el hallazgo: hay ficheros que creen que limpian.
//
// ⛔ NO BORRA NADA. No mira TMPDIR, no toca `src/`, no ejecuta ningún test.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

// `new URL(...).pathname` deja la ruta PERCENT-ENCODED («Javier%20Pereira») y `readdirSync` no la
// resuelve. `fileURLToPath` es lo que existe para esto.
const RAIZ = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
const EXT = new Set(['.ts', '.mjs', '.js', '.cjs']);
const FUERA = new Set(['node_modules', '.git', 'dist', 'coverage', 'storage']);

function ficheros(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (FUERA.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, out);
    else if (EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

/** ¿Es una llamada a `mkdtempSync` / `mkdtemp`? Cubre `fs.mkdtempSync(...)` y el importado suelto. */
function esMkdtemp(nodo) {
  if (!ts.isCallExpression(nodo)) return null;
  const e = nodo.expression;
  if (ts.isIdentifier(e) && /^mkdtemp(Sync)?$/.test(e.text)) return e.text;
  if (ts.isPropertyAccessExpression(e) && /^mkdtemp(Sync)?$/.test(e.name.text)) return e.name.text;
  return null;
}

/**
 * A qué nombre acaba yendo el directorio.
 *
 * 🔴 LA PRIMERA VERSIÓN DE ESTO SOBRECONTABA, y se vio revisando a mano lo que clasificó como
 * «sin limpieza». Miraba SÓLO el padre inmediato, así que tres formas reales del repositorio se
 * le escapaban y caían a «sin limpieza» sin estarlo:
 *
 *     const dir   = fs.realpathSync(fs.mkdtempSync(...));      ← envuelto en otra llamada
 *     const copia = path.join(fs.mkdtempSync(...), 'x.mjs');   ← el nombre guarda algo DE DENTRO
 *     const tmp   = () => fs.mkdtempSync(...);                 ← una FÁBRICA; el destino está
 *                                                                en quien la llama
 *
 * Un censo que llama «resto» a un directorio que sí se borra publica un agujero que no existe, y
 * eso cuesta más que no medirlo. Así que se sube por los envoltorios y se distingue si el nombre
 * guarda **el directorio** o **algo de dentro** — porque en el segundo caso la limpieza correcta
 * es `rmSync(path.dirname(x))`, y buscar `rmSync(x)` no la encontraría.
 */
function destinoDe(nodo) {
  let actual = nodo;
  let dentro = false; // ¿el nombre guarda algo DE DENTRO del temporal, no el temporal?
  for (let p = actual.parent; p; actual = p, p = p.parent) {
    if (ts.isAwaitExpression(p) || ts.isParenthesizedExpression(p)) continue;
    if (ts.isCallExpression(p) && p.arguments.includes(actual)) {
      const e = p.expression;
      const nombre = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '';
      // `path.join(tmp, 'x')` con MÁS argumentos → el valor es una ruta de dentro.
      if (/^(join|resolve)$/.test(nombre) && p.arguments.length > 1) dentro = true;
      else if (!/^(realpathSync|realpath|normalize|toString|String)$/.test(nombre)) return null;
      continue;
    }
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return { nombre: p.name.text, dentro, fabrica: false };
    if (ts.isBinaryExpression(p) && ts.isIdentifier(p.left)) return { nombre: p.left.text, dentro, fabrica: false };
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) return { nombre: p.name.text, dentro, fabrica: false };
    // FÁBRICA: `const tmp = () => mkdtempSync(...)` o `function tmp() { return mkdtempSync(...) }`.
    // El directorio no se nombra aquí: se nombra en cada llamador.
    if (ts.isArrowFunction(p) || ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p)
      || ts.isReturnStatement(p)) {
      const f = ts.isReturnStatement(p) ? p.parent && p.parent.parent : p;
      const nom = f && (ts.isFunctionDeclaration(f) ? f.name && f.name.text
        : ts.isVariableDeclaration(f.parent || {}) && ts.isIdentifier(f.parent.name) ? f.parent.name.text : null);
      return { nombre: nom || null, dentro, fabrica: true };
    }
    return null;
  }
  return null;
}

/** ¿Este nodo está DENTRO de un bloque `finally`, de un hook `after*`, o de `process.on('exit')`? */
function coberturaDe(nodo) {
  for (let p = nodo.parent; p; p = p.parent) {
    // `try { … } finally { AQUÍ }`
    if (ts.isTryStatement(p.parent || {}) && p.parent.finallyBlock === p) return 'finally';
    if (ts.isBlock(p) && p.parent && ts.isTryStatement(p.parent) && p.parent.finallyBlock === p) return 'finally';
    if (ts.isCallExpression(p)) {
      const e = p.expression;
      const nombre = ts.isIdentifier(e) ? e.text
        : ts.isPropertyAccessExpression(e) ? e.name.text : '';
      // `after(...)`, `afterEach(...)`, `t.after(...)` — los hooks del runner de la casa.
      if (/^after(Each|All)?$/.test(nombre)) return 'hook ' + nombre;
      // `process.on('exit', …)` / `process.once('exit', …)`
      if (/^(on|once)$/.test(nombre) && p.arguments[0] && ts.isStringLiteral(p.arguments[0])
        && /^(exit|beforeExit|SIGINT|SIGTERM)$/.test(p.arguments[0].text)) return "process.on('" + p.arguments[0].text + "')";
    }
  }
  return null;
}

/** ¿El nombre sale de su función por un `return`? Entonces lo limpia quien lo recibe. */
function escapaDeSuFuncion(nodo, nombre, sf) {
  let fn = null;
  for (let p = nodo.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p)
      || ts.isMethodDeclaration(p)) { fn = p; break; }
  }
  if (!fn || !fn.body) return false;
  let sale = false;
  const ver = (n) => {
    if (sale) return;
    if (ts.isReturnStatement(n) && n.expression && new RegExp('\\b' + nombre + '\\b').test(n.expression.getText(sf))) sale = true;
    ts.forEachChild(n, ver);
  };
  ver(fn.body);
  return sale;
}

const llamadas = [];
const todos = ficheros(RAIZ);

for (const f of todos) {
  const fuente = fs.readFileSync(f, 'utf8');
  if (!/mkdtemp/.test(fuente)) continue; // atajo barato; el AST decide después
  const sf = ts.createSourceFile(rel(f), fuente, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

  // ① todas las llamadas a mkdtemp del fichero
  const delFichero = [];
  const visitar = (n) => {
    const fn = esMkdtemp(n);
    if (fn) {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      delFichero.push({ nodo: n, fn, linea: line + 1, destino: destinoDe(n) });
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  if (!delFichero.length) continue;

  // ② todos los borrados del fichero, con su cobertura
  const borrados = [];
  const visitarBorrados = (n) => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const nombre = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '';
      if (/^(rmSync|rm|rmdirSync|rmdir)$/.test(nombre) && n.arguments[0]) {
        const arg = n.arguments[0];
        const texto = arg.getText(sf);
        // El argumento puede ser la variable a secas (`rmSync(TMP)`) o llevarla dentro
        // (`rmSync(path.dirname(tmp))`, que es la limpieza CORRECTA cuando el nombre guarda una
        // ruta de dentro). Se guardan los identificadores que aparecen, y quien compara decide.
        const ids = new Set();
        const rec = (x) => { if (ts.isIdentifier(x)) ids.add(x.text); ts.forEachChild(x, rec); };
        rec(arg);
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        borrados.push({
          ids, directo: ts.isIdentifier(arg) ? arg.text : null,
          porDirname: /\bdirname\s*\(/.test(texto),
          linea: line + 1, cobertura: coberturaDe(n), texto: texto.slice(0, 60),
        });
      }
    }
    ts.forEachChild(n, visitarBorrados);
  };
  ts.forEachChild(sf, visitarBorrados);

  for (const c of delFichero) {
    const d = c.destino;
    // Si el nombre guarda algo DE DENTRO del temporal, la limpieza válida es la que sube un nivel
    // (`path.dirname(x)`); borrar el fichero suelto NO borra el directorio, y contarlo como
    // limpieza sería el falso negativo simétrico del que ya me mordió.
    const suyos = !d || !d.nombre ? [] : borrados.filter((b) => {
      if (!b.ids.has(d.nombre)) return false;
      return d.dentro ? b.porDirname : true;
    });
    // 🔴 UNA FÁBRICA la limpia QUIEN LA LLAMA, no ella. Aquí no se puede afirmar nada con este
    // fichero delante, así que se declara aparte en vez de contarla como resto.
    //
    // Y lo mismo si el directorio SE ESCAPA de la función por un `return` —`return { tmp, bin }`
    // en `scrum853`, medido—: quien lo recibe es quien puede borrarlo. Contarlo como resto sería
    // acusar al sitio equivocado.
    const escapa = !!(d && d.nombre && escapaDeSuFuncion(c.nodo, d.nombre, sf));
    const garantizado = suyos.find((b) => b.cobertura);
    llamadas.push({
      fichero: rel(f),
      linea: c.linea,
      fn: c.fn,
      destino: d ? d.nombre : null,
      guardaRutaDeDentro: !!(d && d.dentro),
      ajeno: rel(f).startsWith('.claude/') || rel(f).startsWith('.agents/'),
      categoria: d && d.fabrica ? 'FABRICA'
        : garantizado ? 'GARANTIZADA'
          : (suyos.length ? 'NO_GARANTIZADA' : (escapa ? 'ESCAPA' : 'SIN_LIMPIEZA')),
      cobertura: garantizado ? garantizado.cobertura : null,
      borradoEn: suyos.map((b) => b.linea),
    });
  }
}

// ── SUELO ───────────────────────────────────────────────────────────────────────────────────
const salida = [];
const di = (s = '') => { salida.push(s); console.log(s); };

di('═══ CENSO DE `mkdtempSync` · por AST, no por grep ═══');
di('   ficheros mirados: ' + todos.length);
di('   llamadas encontradas: ' + llamadas.length);
di('');
if (llamadas.length === 0) {
  di('🔴 CIEGO: el censo no encuentra NINGUNA llamada a `mkdtempSync`, y el ticket declara al');
  di('   menos tres familias de restos (yaqu*, scrum723, scrum385). Si de verdad no hubiera');
  di('   llamadas, esos directorios no podrían existir: el censo no está midiendo lo que dice.');
  fs.writeFileSync(new URL('./salida-censo.txt', import.meta.url), salida.join('\n') + '\n');
  process.exit(3);
}

// El skill `impeccable` vive en `.claude/` y `.agents/`: es código de terceros vendorizado, no
// corre en la tanda y sus temporales llevan su propio prefijo (`impeccable-…`). Se cuenta aparte
// porque «restos NUESTROS» es la afirmación del ticket, y meterlos dentro la falsearía.
// 🔴 DECLARADA CON MOTIVO, como pide el ticket para lo que no se puede cerrar igual que el resto:
// `tests/_temporal.mjs` ES EL MECANISMO. Su `mkdtempSync` lo limpia el registro del propio módulo
// en `process.on('exit')`, no un `rmSync` sobre esa variable, así que este censo —que empareja
// creación y borrado POR NOMBRE— no puede verlo y lo llamaría «no garantizada». No se convierte:
// un helper no puede usarse a sí mismo para existir. Se nombra aquí para que el número de abajo
// no arrastre un falso positivo permanente.
const DECLARADAS = new Map([
  ['tests/_temporal.mjs', 'ES el mecanismo de limpieza: su borrado va por el registro del módulo, no por su variable.'],
]);

const nuestras = llamadas.filter((l) => !l.ajeno && !DECLARADAS.has(l.fichero));
const declaradas = llamadas.filter((l) => DECLARADAS.has(l.fichero));
const ajenas = llamadas.filter((l) => l.ajeno);

const por = (c) => nuestras.filter((l) => l.categoria === c);
const g = por('GARANTIZADA'), ng = por('NO_GARANTIZADA'), sin = por('SIN_LIMPIEZA');
const fab = por('FABRICA'), esc = por('ESCAPA');

di('   de ellas NUESTRAS: ' + nuestras.length
  + '  ·  de terceros (`.claude/`, `.agents/`, skill impeccable): ' + ajenas.length
  + '  ·  DECLARADAS: ' + declaradas.length);
for (const [f, motivo] of DECLARADAS) di('     · ' + f + ' — ' + motivo);
di('');
di('   ✅ GARANTIZADA (finally / hook after / process.on) : ' + g.length);
di('   ⚠️ NO GARANTIZADA (sólo por el camino feliz) ......: ' + ng.length);
di('   🔴 SIN LIMPIEZA (no se borra en ninguna parte) ....: ' + sin.length);
di('   ↗️ ESCAPA por `return` (lo limpia quien lo recibe) .: ' + esc.length);
di('   ⚙️ FÁBRICA (la limpia quien la llama; no se juzga) .: ' + fab.length);
di('   ' + '-'.repeat(60));
const suma = g.length + ng.length + sin.length + fab.length + esc.length;
di('   suman: ' + suma + ' de ' + nuestras.length + (suma === nuestras.length ? '  ✅ cuadra' : '  🔴 NO CUADRA'));
di('');

for (const [titulo, lista] of [['🔴 SIN LIMPIEZA', sin], ['⚠️ NO GARANTIZADA', ng],
  ['↗️ ESCAPA', esc], ['⚙️ FÁBRICA', fab], ['✅ GARANTIZADA', g]]) {
  if (!lista.length) continue;
  di('── ' + titulo + ' (' + lista.length + ') ' + '─'.repeat(Math.max(0, 60 - titulo.length)));
  for (const l of lista) {
    di('   ' + l.fichero + ':' + l.linea
      + '  ' + (l.destino ? '→ ' + l.destino : '→ (sin asignar a variable)')
      + (l.cobertura ? '  [' + l.cobertura + ']' : '')
      + (l.borradoEn.length ? '  borra en ' + l.borradoEn.join(', ') : ''));
  }
  di('');
}

fs.writeFileSync(new URL('./salida-censo.txt', import.meta.url), salida.join('\n') + '\n');
fs.writeFileSync(new URL('./censo.json', import.meta.url), JSON.stringify(llamadas, null, 2) + '\n');
