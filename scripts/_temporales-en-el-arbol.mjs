// scripts/_temporales-en-el-arbol.mjs — SCRUM-824
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ MIDE ESTO, Y POR QUÉ EXISTE
//
// Un test que crea su fixture DENTRO del árbol de trabajo se lo crea a TODOS los demás. La tanda
// corre 781 ficheros con concurrencia 12: mientras uno escribe y borra `tests/.tmp-549-XXXX`, otro
// está recorriendo `tests/` para censar exports. El segundo lista el directorio, el primero lo
// borra, y el segundo entra:
//
//     ENOENT: no such file or directory, scandir '…\tests\.tmp-549-CP9zfR'
//
// No es una hipótesis: está reproducido en SCRUM-824 (2 rojos / 112 recorridos con contención de
// 12). El síntoma es un ROJO INTERMITENTE, que es peor que uno fijo — enseña a relanzar la tanda.
//
// ── LO QUE SE CLASIFICA ──────────────────────────────────────────────────────────────────────
// Cada llamada que CREA algo en disco, por la RAÍZ de la ruta que crea:
//
//   · TMP         — cuelga de `os.tmpdir()` o de `process.env.TEMP/TMPDIR`. Es lo correcto.
//   · FUERA       — ruta absoluta fuera del repositorio. No molesta a nadie de aquí.
//   · ARBOL       — 🔴 cuelga del repositorio. Es el defecto.
//   · DESCONOCIDO — no se ha podido probar de dónde cuelga. NO se lee como «está bien»: se
//                   cuenta aparte y se enseña, porque un no-sé que se cuenta como bien es
//                   exactamente cómo un censo deja de ver (SCRUM-549).
//
// 🔴 EL ARGUMENTO QUE SE MIRA NO ES SIEMPRE EL PRIMERO. `copyFileSync(origen, destino)` LEE el
// primero y CREA el segundo. Mirar el arg 0 daba tres falsos positivos medidos en SCRUM-824
// —`copyFileSync(path.join(RAIZ, 'package.json'), …)` es una LECTURA legítima del repo— y, peor,
// dejaba pasar el destino de verdad. Por eso cada método declara su índice.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

/**
 * Método → índice del argumento que nombra lo que SE CREA.
 * Los de dos rutas (`copy`, `cp`, `rename`, `symlink`) crean el SEGUNDO.
 */
export const CREADORAS = new Map([
  // 🔴 UN ELEMENTO POR LÍNEA (SCRUM-710b): dos pares en la misma línea física hacen que dos
  // tickets que toquen entradas distintas choquen, y el conflicto no dirá que son independientes.
  ['mkdtempSync', 0],
  ['mkdtemp', 0],
  ['mkdirSync', 0],
  ['mkdir', 0],
  ['writeFileSync', 0],
  ['writeFile', 0],
  ['appendFileSync', 0],
  ['appendFile', 0],
  ['createWriteStream', 0],
  ['openSync', 0],
  ['copyFileSync', 1],
  ['cpSync', 1],
  ['renameSync', 1],
  ['symlinkSync', 1],
]);

/** Clases que NO son un defecto. `DESCONOCIDO` no está aquí a propósito. */
export const SANAS = new Set(['TMP', 'FUERA']);

export class CensoCiego extends Error {}

/**
 * Clasifica las creaciones de una fuente. `raiz` es el repositorio contra el que se decide si una
 * ruta absoluta cae dentro o fuera.
 */
export function clasificaFuente(rutaFichero, fuente, raiz) {
  const sf = ts.createSourceFile(rutaFichero, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const raizAbs = path.resolve(raiz).toLowerCase();

  // Resolución POR ÁMBITO: desde el uso hacia arriba, la declaración más cercana. Un mapa global
  // de nombres no vale — `dir` se declara en veinte tests distintos de un mismo fichero y el
  // último ganaría, que es como un censo empieza a contestar sobre otro sujeto.
  const declDesde = (nodo, nombre) => {
    for (let s = nodo; s; s = s.parent) {
      let hallado = null;
      const mira = (n) => {
        if (hallado) return;
        if ((ts.isVariableDeclaration(n) || ts.isBindingElement(n))
            && ts.isIdentifier(n.name) && n.name.text === nombre) {
          hallado = n.initializer || (ts.isForOfStatement(n.parent?.parent?.parent) ? n.parent.parent.parent.expression : null);
          if (hallado) return;
        }
        if (n !== s && (ts.isFunctionLike(n) || ts.isBlock(n))) return; // no bajar a ámbitos internos
        ts.forEachChild(n, mira);
      };
      ts.forEachChild(s, mira);
      if (hallado) return hallado;
    }
    return null;
  };

  /** El cuerpo-expresión de una flecha, o el `return` único de una función. */
  const devuelveDe = (fn) => {
    if (!fn) return null;
    if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return fn.body;
    const cuerpo = fn.body;
    if (!cuerpo || !ts.isBlock(cuerpo)) return null;
    const rets = [];
    const busca = (n) => {
      if (ts.isReturnStatement(n) && n.expression) rets.push(n.expression);
      if (ts.isFunctionLike(n) && n !== fn) return;
      ts.forEachChild(n, busca);
    };
    ts.forEachChild(cuerpo, busca);
    return rets.length === 1 ? rets[0] : null;
  };

  const une = (a, b) => {
    if (a === 'ARBOL' || b === 'ARBOL') return 'ARBOL'; // el `|| '.'` de reserva del 659
    if (a === b) return a;
    if (SANAS.has(a) && SANAS.has(b)) return 'FUERA';
    return 'DESCONOCIDO';
  };

  const raizDe = (n, prof = 0) => {
    if (!n || prof > 18) return 'DESCONOCIDO';

    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const nom = ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : '';
      if (nom === 'tmpdir') return 'TMP';
      // SCRUM-864 · `temporal(prefijo)` es el ayudante de la casa (`tests/_temporal.mjs`) y su
      // cuerpo construye la ruta con `path.join(os.tmpdir(), prefijo)`. Se reconoce aquí porque
      // llega IMPORTADO, y la resolución de ayudantes de abajo sólo atraviesa los declarados en
      // el propio fichero.
      //
      // 🔴 Esto NO afloja el guard: el conjunto de «sin probar» ENCOGE, y la exigencia sigue
      // siendo la misma. Y no es una promesa escrita: `scrum864-el-temporal-que-se-borra` tiene
      // un caso que comprueba que el helper sigue colgando de `os.tmpdir()`. El día que deje de
      // hacerlo, cae ese test — no este reconocimiento en silencio.
      if (nom === 'temporal') return 'TMP';
      if (['join', 'resolve', 'normalize'].includes(nom)) return raizDe(n.arguments[0], prof + 1);
      // `realpathSync`, `realpathSync.native` y `mkdtemp*` son TUBERÍAS: la raíz es la de su
      // argumento. `native` hay que nombrarlo aparte porque el nombre del método es ése, no
      // `realpathSync` — y sin él, media docena de ayudantes `banco()` salían sin probar.
      if (['mkdtempSync', 'mkdtemp', 'realpathSync', 'native'].includes(nom)) return raizDe(n.arguments[0], prof + 1);
      if (nom === 'fileURLToPath') return 'ARBOL';
      if (nom === 'dirname') return raizDe(n.arguments[0], prof + 1);
      if (nom === 'cwd') return 'ARBOL';
      // Llamada a un ayudante local: `const tmp = () => fs.mkdtempSync(os.tmpdir()…)`
      if (ts.isIdentifier(c)) return raizDe(devuelveDe(declDesde(n, c.text)), prof + 1);
      return 'DESCONOCIDO';
    }

    if (ts.isPropertyAccessExpression(n)) {
      const t = n.getText(sf);
      if (/process\.env\.(TEMP|TMPDIR|TMP)\b/.test(t)) return 'TMP';
      if (/import\.meta\.(dirname|url)/.test(t)) return 'ARBOL';
      // `b.fuente` → el objeto que devuelve el ayudante, y de él la propiedad.
      const obj = raizDeObjetoPropiedad(n, prof);
      if (obj) return obj;
      return raizDe(declDesde(n, n.name.text), prof + 1);
    }

    if (ts.isIdentifier(n)) {
      if (n.text === '__dirname') return 'ARBOL';
      return raizDe(declDesde(n, n.text), prof + 1);
    }

    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const v = n.text;
      if (/^[A-Za-z]:[\\/]/.test(v) || v.startsWith('/') || v.startsWith('\\')) {
        return path.resolve(v).toLowerCase().startsWith(raizAbs) ? 'ARBOL' : 'FUERA';
      }
      return 'ARBOL'; // relativa ⇒ relativa al cwd, que durante la tanda es el repositorio
    }

    if (ts.isTemplateExpression(n)) {
      if (n.head.text) return raizDe(ts.factory.createStringLiteral(n.head.text), prof + 1);
      return n.templateSpans.length ? raizDe(n.templateSpans[0].expression, prof + 1) : 'DESCONOCIDO';
    }

    if (ts.isArrayLiteralExpression(n)) {
      return n.elements.length
        ? n.elements.map((e) => raizDe(e, prof + 1)).reduce(une)
        : 'DESCONOCIDO';
    }

    if (ts.isBinaryExpression(n)) {
      const k = n.operatorToken.kind;
      if (k === ts.SyntaxKind.PlusToken) return raizDe(n.left, prof + 1);
      if (k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken) {
        return une(raizDe(n.left, prof + 1), raizDe(n.right, prof + 1));
      }
      return 'DESCONOCIDO';
    }

    if (ts.isConditionalExpression(n)) return une(raizDe(n.whenTrue, prof + 1), raizDe(n.whenFalse, prof + 1));
    if (ts.isParenthesizedExpression(n)) return raizDe(n.expression, prof + 1);
    if (ts.isAwaitExpression(n)) return raizDe(n.expression, prof + 1);
    if (ts.isAsExpression?.(n)) return raizDe(n.expression, prof + 1);
    return 'DESCONOCIDO';
  };

  /** `b.fuente` donde `b` sale de un ayudante que devuelve un objeto literal. */
  function raizDeObjetoPropiedad(acceso, prof) {
    if (!ts.isIdentifier(acceso.expression)) return null;
    let origen = declDesde(acceso, acceso.expression.text);
    if (origen && ts.isCallExpression(origen) && ts.isIdentifier(origen.expression)) {
      origen = devuelveDe(declDesde(origen, origen.expression.text));
    }
    if (!origen || !ts.isObjectLiteralExpression(origen)) return null;
    const prop = origen.properties.find((p) => p.name && ts.isIdentifier(p.name) && p.name.text === acceso.name.text);
    if (!prop) return null;
    if (ts.isPropertyAssignment(prop)) return raizDe(prop.initializer, prof + 1);
    if (ts.isShorthandPropertyAssignment(prop)) return raizDe(declDesde(origen, acceso.name.text), prof + 1);
    return null;
  }

  const sitios = [];
  const rec = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const metodo = n.expression.name.text;
      if (CREADORAS.has(metodo)) {
        const i = CREADORAS.get(metodo);
        const arg = n.arguments[i];
        if (arg) {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
          sitios.push({
            linea: line + 1,
            metodo,
            clase: raizDe(arg),
            texto: arg.getText(sf).replace(/\s+/g, ' ').slice(0, 90),
          });
        }
      }
    }
    ts.forEachChild(n, rec);
  };
  rec(sf);
  return sitios;
}

/** Los `.mjs` de un directorio, sin bajar a subdirectorios. */
function fuentesDe(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort().map((f) => path.join(dir, f));
}

/**
 * Censo de `tests/`. Devuelve los sitios con su clase y el resumen.
 *
 * Se queda en `tests/` A PROPÓSITO: el defecto es la CONCURRENCIA de la tanda, y lo que corre en
 * paralelo son los ficheros de test. Un script de `scripts/` que escriba en el árbol puede estar
 * haciendo su trabajo (generar un doc), y meterlo aquí convertiría el trinquete en ruido.
 */
export function censar(raiz) {
  const dir = path.join(raiz, 'tests');
  const sitios = [];
  for (const p of fuentesDe(dir)) {
    const rel = path.relative(raiz, p).split(path.sep).join('/');
    for (const s of clasificaFuente(p, fs.readFileSync(p, 'utf8'), raiz)) sitios.push({ fichero: rel, ...s });
  }
  const resumen = { total: sitios.length, TMP: 0, FUERA: 0, ARBOL: 0, DESCONOCIDO: 0 };
  for (const s of sitios) resumen[s.clase] += 1;
  return { sitios, resumen, ficheros: fuentesDe(dir).length };
}

/**
 * 🔴 EL SUELO. Un censo que no ve nada contesta «cero infracciones», que se lee igual que «está
 * limpio». Las dos condiciones son estructurales y no son una foto del árbol:
 *   · hay ficheros y hay creaciones que clasificar;
 *   · y se ve al menos una SANA — si no, el clasificador no está distinguiendo, está callando.
 */
export function motivosParaNoFiarse({ ficheros, resumen }) {
  const m = [];
  if (!ficheros) m.push('CERO ficheros .mjs en `tests/`: no hay población que clasificar.');
  if (!resumen.total) m.push('CERO llamadas de creación en toda la tanda: el detector no reconoce ninguna.');
  else if (!resumen.TMP && !resumen.FUERA) {
    m.push('NI UNA creación clasificada como sana: el clasificador no distingue, contesta lo mismo a todo.');
  }
  return m;
}

export const enElArbol = (censo) => censo.sitios.filter((s) => s.clase === 'ARBOL');
export const sinProbar = (censo) => censo.sitios.filter((s) => s.clase === 'DESCONOCIDO');
export const comoLinea = (s) => `${s.fichero}:${s.linea} · ${s.metodo}(${s.texto})`;
