// scripts/_censo-entorno-prestado.mjs — SCRUM-1153
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ¿QUÉ LABORATORIO LE PRESTA SU ENTORNO AL SUJETO, EN VEZ DE MEDIRLO?
//
// Un laboratorio que le presta su entorno al sujeto no mide el sujeto: mide la CASA. Si el `node`
// hijo hereda `process.env` sin que nadie lo toque, cuela `NODE_TEST_CONTEXT` (el hijo se niega a
// correr con «run() is being called recursively»), `FORCE_COLOR` (los números salen con ANSI y
// rompen el ancla `^` del regex que los lee) o `NODE_OPTIONS` (un reporter de fuera cambia el
// formato). Las tres veces el síntoma es el mismo: el hijo sale con `total=0` y eso se lee como
// «import roto» sin serlo — el mismo «no pude mirar» = «no hay nada» de SCRUM-846/850/927.
//
// CONFIRMADO, con código real, no reconstruido de memoria (`git show <sha> -- <fichero>`):
//
//   · SCRUM-938 (`decidirVaciando`, `scripts/censo-lista-como-fixture.mjs`, commit `5e64a41b`):
//     `spawnSync(process.execPath, [...], { cwd: raiz, encoding: 'utf8' })` — SIN `env`, hereda
//     entero — y parsea `r.stdout.match(/^ℹ fail (\d+)/m)`. El fix (`d05d9aa6`) construye
//     `entornoHijo = { ...process.env }` y le borra las tres variables ANTES de usarlo.
//
// 🔴 NO CONFIRMADOS PARA ESTE CENSO, Y POR QUÉ (medido, no asumido — la lista de SCRUM-1153 los
// cita como motivación de la FAMILIA, no como instancias literales de ESTA forma):
//
//   · SCRUM-940 (`_censo-de-suelos.mjs:198`): el defecto es `'\b'` como cadena (retroceso 0x08)
//     dentro de una REGEX, sin `spawn`/`exec` de por medio. No hay ningún hijo que censar aquí:
//     es la MISMA familia («no pude mirar» = «no hay nada»), pero un mecanismo completamente
//     distinto. Ningún censo de `spawn` puede acusarlo, y forzarlo sería inventar un caso.
//   · SCRUM-928c (`correrPaso`, `tests/scrum853c-…`): spawnea **`bash`**, no `node` — el `node`
//     real corre DENTRO del guion que ese `bash` ejecuta, sustituido como texto, invisible para un
//     AST que mira el `spawnSync` de fuera. Y no parsea `r.stdout`: lee FICHEROS del temporal
//     (`estados.txt`) y el `.split('|')` vive en el test que LLAMA a `correrPaso`, no dentro de la
//     función. Dos motivos independientes, cualquiera basta para que este censo no lo alcance.
//
// Quien retome esto y quiera cazar 928c/940 con el mismo mecanismo: son OTRO censo (el de 940 no
// tiene sujeto `spawn`; el de 928c pediría seguir el CONTENIDO de un guion de shell generado en
// tiempo de ejecución, que ya no es AST — es interpretar shell, y esta casa ya midió que eso es
// la vía que se cae sola: SCRUM-203 pide AST, no interpretar texto).
//
// ── EL PATRÓN, por AST ────────────────────────────────────────────────────────────────────────
//
//   1. `spawn`/`spawnSync`/`exec`/`execSync`/`execFileSync` (bare o `child_process.X` /
//      `require(...).X`), cuyo primer argumento es `process.execPath` o el literal `'node'` /
//      `'node.exe'` — un `node` HIJO, no cualquier proceso.
//   2. Su resultado se parsea: `<r>.stdout` encadenado con `.match(`/`.test(`/`.split(`, o
//      envuelto en `JSON.parse(...)`.
//   3. Su `env` NO está construido a mano: falta del todo, es `process.env` a secas, o es
//      `{ ...process.env }` (con o sin propiedades añadidas) sin que la variable que lo guarda
//      reciba luego un `delete` antes de usarse. Un `delete` demuestra que alguien pensó en lo
//      que colaba; su ausencia no lo demuestra.
//
// ⛔ NO EJECUTA NADA. Sólo AST (`typescript`, ya en el árbol — regla 36), nunca `grep`.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const ts = require_('typescript');

const EXT = new Set(['.mjs', '.js', '.ts']);
const FUERA = new Set(['node_modules', '.git', 'dist', 'coverage', 'storage']);

/** Dónde se buscan laboratorios. `docs/` queda fuera, igual que en `_censo-de-suelos.mjs`. */
export const CARPETAS = ['tests', 'scripts'];

const FAMILIA = new Set(['spawn', 'spawnSync', 'exec', 'execSync', 'execFileSync']);
const VARS_CONOCIDAS = ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT'];

/**
 * Ficheros DECLARADOS con motivo, no una lista blanca muda. Si algún día hace falta una excepción
 * real, se anota AQUÍ con su porqué — nunca un suelo numérico (SCRUM-940: un suelo escrito a mano
 * no protege nada).
 */
export const DECLARADAS = new Map([]);

function ficherosDe(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (FUERA.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosDe(p, out);
    else if (EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

/** Nombre de la llamada, si es `X(...)` o `algo.X(...)`. */
function nombreDeLlamada(nodo) {
  const e = nodo.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

/** ¿El primer argumento apunta a un `node` hijo? `process.execPath`, o el literal `'node'`/`'node.exe'`. */
function esNodeHijo(nodo) {
  const arg = nodo.arguments[0];
  if (!arg) return false;
  if (ts.isPropertyAccessExpression(arg) && ts.isIdentifier(arg.expression)
    && arg.expression.text === 'process' && arg.name.text === 'execPath') return true;
  if (ts.isStringLiteralLike(arg) && /^node(\.exe)?$/i.test(arg.text)) return true;
  return false;
}

/** El identificador al que se asigna el resultado de la llamada (`const r = spawnSync(...)`). */
function variableDeResultado(nodo) {
  const p = nodo.parent;
  if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  return null;
}

/** La función (o el módulo) que envuelve un nodo — el ámbito donde se busca el resto de pistas. */
function ambitoDe(nodo) {
  for (let p = nodo.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p)
      || ts.isMethodDeclaration(p)) return p.body || p;
  }
  return null;
}

/** ¿En `ambito`, `nombre.stdout` se parsea (`.match`/`.test`/`.split` o `JSON.parse(...)`)? */
function seParsea(ambito, nombre, sf) {
  if (!ambito || !nombre) return false;
  let hallado = false;
  const esStdoutDe = (n) => ts.isPropertyAccessExpression(n) && n.name.text === 'stdout'
    && ts.isIdentifier(n.expression) && n.expression.text === nombre;
  const rec = (n) => {
    if (hallado) return;
    if (ts.isCallExpression(n)) {
      const nombreLlamada = nombreDeLlamada(n);
      if (/^(match|test|split)$/.test(nombreLlamada || '') && ts.isPropertyAccessExpression(n.expression)
        && esStdoutDe(n.expression.expression)) hallado = true;
      else if (n.expression.getText(sf) === 'JSON.parse'
        && n.arguments.some((a) => esStdoutDe(a) || (a.getText && new RegExp('\\b' + nombre + '\\b\\.stdout\\b').test(a.getText(sf))))) hallado = true;
    }
    if (!hallado) ts.forEachChild(n, rec);
  };
  rec(ambito);
  return hallado;
}

/**
 * ¿Hay un `delete <nombre>.algo` o `delete <nombre>[algo]` antes de `limite`?
 *
 * 🔴 SE BUSCA EN TODO EL FICHERO, NO SÓLO EN EL ÁMBITO DE LA LLAMADA. La primera versión sólo
 * miraba la función que envuelve el `spawnSync`, y el caso real de SCRUM-938 la contradice: el
 * `env` se limpia en `decidirVaciando` (borra `FORCE_COLOR`/`NODE_OPTIONS`/`NODE_TEST_CONTEXT` de
 * `entornoHijo`) y la llamada que lo USA vive en `correr`, un closure ANIDADO — la función de
 * arriba, no la de la llamada. Buscar sólo dentro de `correr` daba un falso ACUSADO sobre código
 * ya arreglado.
 */
function tieneDeleteAntes(sf, nombre, limite) {
  if (!nombre) return false;
  let hallado = false;
  const rec = (n) => {
    if (hallado || n.getStart(sf) >= limite.getStart(sf)) return;
    if (n.kind === ts.SyntaxKind.DeleteExpression) {
      const objetivo = n.expression;
      if (ts.isPropertyAccessExpression(objetivo) || ts.isElementAccessExpression(objetivo)) {
        if (ts.isIdentifier(objetivo.expression) && objetivo.expression.text === nombre) hallado = true;
      }
    }
    ts.forEachChild(n, rec);
  };
  rec(sf);
  return hallado;
}

/** ¿El objeto `obj` es (sólo, o entre otras) un spread de `process.env`? */
function tieneSpreadDeProcessEnv(obj, sf) {
  return obj.properties.some((p) => ts.isSpreadAssignment(p)
    && ts.isPropertyAccessExpression(p.expression)
    && ts.isIdentifier(p.expression.expression) && p.expression.expression.text === 'process'
    && p.expression.name.text === 'env');
}

/**
 * Clasifica CÓMO se construyó el `env` de una llamada. Devuelve:
 *   · null ................. no hay `env`: hereda ENTERO (violación).
 *   · 'DIRECTO' ............ `env: process.env` (violación).
 *   · 'SPREAD_SIN_LIMPIAR' . `{ ...process.env, ... }` sin `delete` que lo sanee (violación).
 *   · 'A_MANO' ............. sin spread de `process.env`, o con `delete` antes de usarse (limpio).
 *   · 'NO_DECIDIBLE' ....... el valor no se pudo resolver (no cuenta como limpio ni como acusado).
 */
function clasificaEnv(nodoLlamada, ambito, sf) {
  const opciones = nodoLlamada.arguments[nodoLlamada.arguments.length - 1];
  if (!opciones || !ts.isObjectLiteralExpression(opciones)) return null;
  const envProp = opciones.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === 'env');
  if (!envProp) return null;
  const valor = envProp.initializer;

  if (ts.isPropertyAccessExpression(valor) && ts.isIdentifier(valor.expression)
    && valor.expression.text === 'process' && valor.name.text === 'env') return 'DIRECTO';

  if (ts.isObjectLiteralExpression(valor)) {
    return tieneSpreadDeProcessEnv(valor, sf) ? 'SPREAD_SIN_LIMPIAR' : 'A_MANO';
  }

  if (ts.isIdentifier(valor)) {
    // Resolver la declaración de esa variable EN EL MISMO ámbito (o el módulo entero).
    let declaracion = null;
    const buscar = (n) => {
      if (declaracion) return;
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === valor.text && n.initializer) {
        declaracion = n;
      }
      ts.forEachChild(n, buscar);
    };
    buscar(sf);
    if (!declaracion || !ts.isObjectLiteralExpression(declaracion.initializer)) return 'NO_DECIDIBLE';
    const spreadea = tieneSpreadDeProcessEnv(declaracion.initializer, sf);
    if (!spreadea) return 'A_MANO';
    return tieneDeleteAntes(sf, valor.text, nodoLlamada) ? 'A_MANO' : 'SPREAD_SIN_LIMPIAR';
  }

  return 'NO_DECIDIBLE';
}

/**
 * Censa las llamadas de UNA fuente.
 *
 * @param {string} rel     con qué nombre se etiqueta el resultado (SCRUM-846: un literal vale,
 *                          así se le pone delante un caso fabricado).
 * @param {string} fuente  el código, como texto.
 */
export function clasificaFuente(rel, fuente) {
  const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const salida = [];

  const rec = (n) => {
    if (ts.isCallExpression(n) && FAMILIA.has(nombreDeLlamada(n) || '')) {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      const nodeHijo = esNodeHijo(n);
      if (nodeHijo) {
        const ambito = ambitoDe(n);
        const resultado = variableDeResultado(n);
        const parseaSalida = seParsea(ambito, resultado, sf);
        const envClase = clasificaEnv(n, ambito, sf);
        if (parseaSalida) {
          salida.push({
            fichero: rel,
            linea: line + 1,
            llamada: nombreDeLlamada(n),
            envClase,
            acusado: envClase === null || envClase === 'DIRECTO' || envClase === 'SPREAD_SIN_LIMPIAR',
          });
        }
      }
    }
    ts.forEachChild(n, rec);
  };
  ts.forEachChild(sf, rec);
  return salida;
}

/** Censa el árbol entero. Declara su POBLACIÓN, no sólo su resultado (SCRUM-850). */
export function censar(raiz) {
  const abs = path.resolve(raiz);
  const rel = (p) => path.relative(abs, p).split(path.sep).join('/');
  const todos = CARPETAS.flatMap((c) => ficherosDe(path.join(abs, c)));

  const llamadas = [];
  let ficherosConFamilia = 0;
  for (const f of todos) {
    const fuente = fs.readFileSync(f, 'utf8');
    if (!/\b(spawn|spawnSync|exec|execSync|execFileSync)\s*\(/.test(fuente)) continue;
    ficherosConFamilia++;
    const r = rel(f);
    for (const l of clasificaFuente(r, fuente)) llamadas.push(l);
  }

  const nuestras = llamadas.filter((l) => !DECLARADAS.has(l.fichero));
  const acusados = nuestras.filter((l) => l.acusado);
  const limpios = nuestras.filter((l) => !l.acusado);

  return {
    ficheros: todos.length,
    ficherosConFamilia,
    llamadas,
    nuestras,
    declaradas: llamadas.filter((l) => DECLARADAS.has(l.fichero)),
    acusados,
    limpios,
  };
}

/**
 * 🔴 EL SUELO DEL PROPIO CENSO (SCRUM-850/940): un cero no es «está limpio», es «no he mirado».
 * Nunca un número escrito a mano: exige que el censo vea POBLACIÓN y al menos una llamada LIMPIA,
 * que es la prueba de que el clasificador distingue en vez de acusar a todo lo que ve.
 */
export function motivosParaNoFiarse(censo) {
  const m = [];
  if (!censo.ficheros) m.push('CERO ficheros: no hay población que mirar.');
  if (!censo.ficherosConFamilia) {
    m.push('CERO ficheros mencionan spawn/exec: el detector no reconoce ni el atajo de texto.');
  } else if (!censo.nuestras.length) {
    m.push('CERO llamadas a un `node` hijo cuya salida se parsea: puede que el árbol esté limpio, '
      + 'o que el AST no reconozca la forma. Sin al menos una LLAMADA vista, no se puede distinguir.');
  } else if (!censo.limpios.length && !censo.acusados.length) {
    m.push('Hay llamadas pero ninguna se clasificó ni LIMPIA ni ACUSADA: el clasificador no decide.');
  }
  return m;
}

/** Una llamada, en una línea legible en el mensaje de un rojo — dice CÓMO arreglarla. */
export const comoLinea = (l) => `${l.fichero}:${l.linea} · ${l.llamada}(…) → env: ${l.envClase ?? '(sin env)'}`
  + (l.acusado
    ? '  ·  🔴 hereda process.env sin limpiar: construir `{ ...process.env }` y `delete` '
      + VARS_CONOCIDAS.join('/') + ' antes de usarlo'
    : '  ·  limpio');
