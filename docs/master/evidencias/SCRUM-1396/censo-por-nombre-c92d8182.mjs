// scripts/_censo-mkdtemp.mjs — SCRUM-864c
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ MIDE ESTO, Y POR QUÉ EXISTE SEPARADO DE LA EVIDENCIA DE SCRUM-864
//
// Cuántas llamadas a `mkdtempSync` hay en el árbol y cuántas borran su directorio PASE LO QUE
// PASE. Es el censo que SCRUM-864 escribió el 16-sep-2026 para cerrar los sitios que entonces
// fugaban… y que **nadie volvió a correr**: vivía en
// `docs/master/evidencias/scrum864/censo-mkdtemp.mjs`, que es una FOTO de aquella tanda, no un
// instrumento vivo. Medido el 17-sep-2026, un día después:
//
//     · cero citas de ese fichero en `tests/` y en `scripts/`;
//     · y DOS sitios nuevos con el mismo defecto, nacidos en ese único día.
//
//     🔒 Una prohibición sin mecanismo es una frase.
//
// De ahí las dos diferencias con el original, y las dos son el motivo de que este fichero exista:
//
//   ① **Recibe la raíz.** El de la evidencia la calculaba desde su propia ruta, así que sólo
//      sabía contestar sobre el árbol de verdad — y un instrumento al que no puedes ponerle un
//      caso fabricado delante no se puede juzgar (SCRUM-846: un cero sin caso conocido no
//      distingue «no hay nada» de «el detector está roto»).
//   ② **No escribe NADA.** El original vuelca `censo.json` y `salida-censo.txt` al lado suyo: al
//      correrlo para medir HOY, reescribió con datos de hoy la evidencia fechada del 16-sep.
//      Un instrumento que al medir altera el registro de otra tanda no puede correr en la tanda.
//
// ── LAS CINCO CATEGORÍAS, y por qué no son dos ───────────────────────────────────────────────
//
//   ✅ GARANTIZADA ....... el borrado cuelga de `finally`, de un hook `after*` del runner o de
//                          `process.on('exit')`. Si el cuerpo revienta, se borra igual.
//   ⚠️ NO GARANTIZADA .... SÍ se borra, pero sólo por el camino feliz. Un `assert` que falla se
//                          salta el borrado. **Éste es el defecto del ticket.**
//   🔴 SIN LIMPIEZA ...... no se borra en ninguna parte del fichero.
//   ↗️ ESCAPA ............ el directorio sale por un `return`: lo limpia QUIEN LO RECIBE.
//   ⚙️ FÁBRICA ........... `const tmp = () => mkdtempSync(…)`: lo limpia quien la llama.
//
// Juntar «no se borra» con «se borra sólo si todo va bien» taparía el hallazgo: hay ficheros que
// CREEN que limpian. Y contar las dos últimas como restos sería acusar al sitio equivocado — es
// el falso positivo que ya se comió el primer censo de SCRUM-864 (34 acusados, 27 reales).
//
// ⛔ NO BORRA NADA, no mira TMPDIR y no ejecuta ningún test. Por AST (`typescript`, ya en el
//    árbol — regla 36), nunca por `grep`: `grep` cuenta líneas que MENCIONAN la palabra y no sabe
//    si el borrado cuelga de un `finally`, que es justo la pregunta.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Extensiones que se parsean. */
const EXT = new Set(['.ts', '.mjs', '.js', '.cjs']);
/** Lo que no se recorre: ni dependencias, ni compilado, ni datos. */
const FUERA = new Set(['node_modules', '.git', 'dist', 'coverage', 'storage']);

// COSTE, medido el 17-sep-2026 sobre 1.763 ficheros: ~2,3-3,7 s por pasada, y lo que domina es
// LEER el árbol, no parsearlo (sólo 81 ficheros nombran `mkdtemp` y sólo ésos llegan al AST).
// Se probó filtrar sobre el Buffer en vez de sobre el texto: mismo conjunto de 81 y tiempos
// solapados (3764/2525/2260 ms contra 3328/3691/2463 ms, alternadas en el mismo proceso). No se
// quedó: una optimización que la medición no respalda es sólo código de más.

/**
 * DECLARADAS: ficheros cuyo temporal NO se puede juzgar con este censo, con su motivo.
 *
 * Una declaración sin motivo es una lista blanca, y una lista blanca es donde van a morir los
 * defectos que molestan. Hoy hay UNA, y es estructural: `tests/_temporal.mjs` **es el mecanismo**
 * de limpieza de la casa. Su borrado va por el registro del propio módulo en `process.on('exit')`
 * y no por un `rmSync` sobre esa variable, así que este censo —que empareja creación y borrado
 * POR NOMBRE— no puede verlo y lo llamaría «no garantizada» para siempre. No se convierte: un
 * helper no puede usarse a sí mismo para existir. Lo que sí lo vigila es
 * `tests/scrum864-el-temporal-que-se-borra.test.mjs`, con su proceso hijo que revienta de verdad.
 */
export const DECLARADAS = new Map([
  ['tests/_temporal.mjs', 'ES el mecanismo de limpieza: su borrado va por el registro del módulo, no por su variable.'],
]);

/** Código de terceros vendorizado: no corre en la tanda y sus temporales llevan su propio prefijo. */
const esAjeno = (rel) => rel.startsWith('.claude/') || rel.startsWith('.agents/');

/** ¿Es una llamada a `mkdtempSync` / `mkdtemp`? Cubre `fs.mkdtempSync(…)` y el importado suelto. */
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
 * 🔴 LA PRIMERA VERSIÓN DE ESTO (SCRUM-864) SOBRECONTABA, y se vio revisando a mano lo que
 * clasificaba como «sin limpieza». Miraba SÓLO el padre inmediato, así que tres formas reales del
 * repositorio caían a «sin limpieza» sin estarlo:
 *
 *     const dir   = fs.realpathSync(fs.mkdtempSync(...));      ← envuelto en otra llamada
 *     const copia = path.join(fs.mkdtempSync(...), 'x.mjs');   ← el nombre guarda algo DE DENTRO
 *     const tmp   = () => fs.mkdtempSync(...);                 ← una FÁBRICA
 *
 * Por eso se sube por los envoltorios y se distingue si el nombre guarda **el directorio** o
 * **algo de dentro** — porque en el segundo caso la limpieza correcta es `rmSync(path.dirname(x))`
 * y buscar `rmSync(x)` no la encontraría.
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
    // FÁBRICA: `const tmp = () => mkdtempSync(…)`. El directorio no se nombra aquí, sino en cada
    // llamador, así que con este fichero delante no se puede afirmar nada sobre su limpieza.
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

/** ¿Este nodo está DENTRO de un `finally`, de un hook `after*` o de `process.on('exit')`? */
function coberturaDe(nodo) {
  for (let p = nodo.parent; p; p = p.parent) {
    if (ts.isBlock(p) && p.parent && ts.isTryStatement(p.parent) && p.parent.finallyBlock === p) return 'finally';
    if (ts.isCallExpression(p)) {
      const e = p.expression;
      const nombre = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '';
      // `after(…)`, `afterEach(…)`, `t.after(…)` — los hooks del runner de la casa.
      if (/^after(Each|All)?$/.test(nombre)) return 'hook ' + nombre;
      if (/^(on|once)$/.test(nombre) && p.arguments[0] && ts.isStringLiteral(p.arguments[0])
        && /^(exit|beforeExit|SIGINT|SIGTERM)$/.test(p.arguments[0].text)) {
        return "process.on('" + p.arguments[0].text + "')";
      }
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

/**
 * Clasifica las llamadas a `mkdtemp*` de UNA fuente.
 *
 * El primer argumento es la ruta con la que se etiqueta el resultado; la fuente se le pasa como
 * texto. Así se le puede poner delante un caso fabricado cuya respuesta se sabe de antemano, que
 * es lo que SCRUM-846 exige de cualquier instrumento de esta casa.
 *
 * @param {string} rutaRelativa  cómo se llama el fichero en el resultado (p.ej. `tests/x.test.mjs`).
 * @param {string} fuente        el código, como texto.
 */
export function clasificaFuente(rutaRelativa, fuente) {
  const sf = ts.createSourceFile(rutaRelativa, fuente, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

  // ① todas las creaciones del fichero
  const creaciones = [];
  const visitar = (n) => {
    const fn = esMkdtemp(n);
    if (fn) {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      creaciones.push({ nodo: n, fn, linea: line + 1, destino: destinoDe(n) });
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  if (!creaciones.length) return [];

  // ② todos los borrados del fichero, con su cobertura
  const borrados = [];
  const visitarBorrados = (n) => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const nombre = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '';
      if (/^(rmSync|rm|rmdirSync|rmdir)$/.test(nombre) && n.arguments[0]) {
        const arg = n.arguments[0];
        // El argumento puede ser la variable a secas (`rmSync(TMP)`) o llevarla dentro
        // (`rmSync(path.dirname(tmp))`, que es la limpieza CORRECTA cuando el nombre guarda una
        // ruta de dentro). Se guardan los identificadores que aparecen y quien compara decide.
        const ids = new Set();
        const rec = (x) => { if (ts.isIdentifier(x)) ids.add(x.text); ts.forEachChild(x, rec); };
        rec(arg);
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        borrados.push({
          ids,
          porDirname: /\bdirname\s*\(/.test(arg.getText(sf)),
          linea: line + 1,
          cobertura: coberturaDe(n),
        });
      }
    }
    ts.forEachChild(n, visitarBorrados);
  };
  ts.forEachChild(sf, visitarBorrados);

  const salida = [];
  for (const c of creaciones) {
    const d = c.destino;
    // Si el nombre guarda algo DE DENTRO del temporal, la limpieza válida es la que sube un nivel
    // (`path.dirname(x)`): borrar el fichero suelto NO borra el directorio, y contarlo como
    // limpieza sería el falso negativo simétrico del falso positivo de arriba.
    const suyos = !d || !d.nombre ? [] : borrados.filter((b) => {
      if (!b.ids.has(d.nombre)) return false;
      return d.dentro ? b.porDirname : true;
    });
    const escapa = !!(d && d.nombre && escapaDeSuFuncion(c.nodo, d.nombre, sf));
    const garantizado = suyos.find((b) => b.cobertura);
    salida.push({
      fichero: rutaRelativa,
      linea: c.linea,
      fn: c.fn,
      destino: d ? d.nombre : null,
      guardaRutaDeDentro: !!(d && d.dentro),
      categoria: d && d.fabrica ? 'FABRICA'
        : garantizado ? 'GARANTIZADA'
          : (suyos.length ? 'NO_GARANTIZADA' : (escapa ? 'ESCAPA' : 'SIN_LIMPIEZA')),
      cobertura: garantizado ? garantizado.cobertura : null,
      borradoEn: suyos.map((b) => b.linea),
    });
  }
  return salida;
}

/** Los ficheros con extensión parseable que cuelgan de `raiz`, sin bajar a lo excluido. */
function ficherosDe(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (FUERA.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosDe(p, out);
    else if (EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

/**
 * Censa un árbol entero. Devuelve las llamadas con su categoría, separando las nuestras de las
 * ajenas y de las declaradas, y DECLARA SU POBLACIÓN: cuántos ficheros ha mirado.
 *
 *   🔒 Un instrumento declara su población, no sólo su resultado.
 *
 * @param {string} raiz  el árbol a censar. Un temporal fabricado vale, y es como se le pone un
 *                       caso conocido delante.
 */
export function censar(raiz) {
  const abs = path.resolve(raiz);
  const rel = (p) => path.relative(abs, p).split(path.sep).join('/');
  const todos = ficherosDe(abs);
  const llamadas = [];
  for (const f of todos) {
    const fuente = fs.readFileSync(f, 'utf8');
    if (!/mkdtemp/.test(fuente)) continue; // atajo barato; el AST decide después
    const r = rel(f);
    for (const l of clasificaFuente(r, fuente)) llamadas.push({ ...l, ajeno: esAjeno(r) });
  }
  const nuestras = llamadas.filter((l) => !l.ajeno && !DECLARADAS.has(l.fichero));
  const cuenta = (c) => nuestras.filter((l) => l.categoria === c);
  return {
    ficheros: todos.length,
    llamadas,
    nuestras,
    ajenas: llamadas.filter((l) => l.ajeno),
    declaradas: llamadas.filter((l) => !l.ajeno && DECLARADAS.has(l.fichero)),
    GARANTIZADA: cuenta('GARANTIZADA'),
    NO_GARANTIZADA: cuenta('NO_GARANTIZADA'),
    SIN_LIMPIEZA: cuenta('SIN_LIMPIEZA'),
    ESCAPA: cuenta('ESCAPA'),
    FABRICA: cuenta('FABRICA'),
  };
}

/** Lo que este ticket prohíbe: creado y no borrado, o borrado sólo si todo sale bien. */
export const sinCierre = (censo) => [...censo.SIN_LIMPIEZA, ...censo.NO_GARANTIZADA];

/**
 * Las que NO limpian AQUÍ porque el directorio se va: sale por un `return` o nace en una fábrica.
 *
 * 🔴 SCRUM-864 las dejó declaradas y sin tocar, con un argumento correcto —«la limpieza es del
 * llamador, y acusar a este fichero sería acusar al sitio equivocado»— y una consecuencia que
 * nadie midió hasta el 17-sep-2026: **eran el 100% de la fuga viva**. Ese día, de los 1.982 restos
 * creados en veinticuatro horas, TODOS venían de estas dos categorías; de las que SCRUM-864 sí
 * convirtió no venía ninguno (`scrum385-`, 1.867 acumulados, 0 nuevos; `scrum727-`, 749 y 0).
 *
 * «Lo limpia el llamador» describe de quién es la responsabilidad, no lo que pasa: el llamador no
 * se acuerda. Por eso ahora se exigen igual que las otras dos — y el arreglo no es reestructurar
 * a nadie, es `temporal()`, que limpia sin que el llamador tenga que enterarse.
 */
export const sinDueno = (censo) => [...censo.ESCAPA, ...censo.FABRICA];

/**
 * 🔴 EL SUELO. Un censo que no ve nada contesta «cero infracciones», y eso se lee igual que «está
 * limpio». Las condiciones son estructurales, no una foto del árbol:
 *   · hay ficheros que mirar;
 *   · se encuentra alguna llamada — si no, el detector no reconoce la forma que busca;
 *   · y se ve al menos una GARANTIZADA, que es la prueba de que el clasificador DISTINGUE en vez
 *     de contestar lo mismo a todo.
 *
 *   🔒 Cero no es «está limpio»: es «no he mirado».
 */
export function motivosParaNoFiarse(censo) {
  const m = [];
  if (!censo.ficheros) m.push('CERO ficheros que mirar: no hay población que clasificar.');
  if (!censo.llamadas.length) {
    m.push('CERO llamadas a `mkdtemp*` en todo el árbol: el detector no reconoce la forma que busca. '
      + 'El ticket declara al menos tres familias de restos (yaqu*, scrum723, scrum385); si de verdad no '
      + 'hubiera llamadas, esos directorios no podrían existir.');
  } else if (!censo.GARANTIZADA.length) {
    m.push('NI UNA llamada clasificada como GARANTIZADA: el clasificador no distingue, contesta lo mismo a todo.');
  }
  return m;
}

/** Una llamada, en una línea que se pueda leer en el mensaje de un rojo. */
export const comoLinea = (l) => `${l.fichero}:${l.linea} · ${l.fn}(…)`
  + (l.destino ? ` → ${l.destino}` : ' → (sin asignar)')
  + (l.borradoEn.length ? `  ·  borra en ${l.borradoEn.join(', ')} SIN cobertura` : '  ·  no se borra en ninguna parte');
