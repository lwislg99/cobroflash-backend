// tests/_espera-automatica.mjs — SCRUM-268 (punto 3): detector de ESPERADORES AUTOMÁTICOS
// del turno de staging. Puro: recibe fuente, devuelve veredicto. Sin fs, sin red.
//
// ── EL INCIDENTE ──────────────────────────────────────────────────────────────
// Un esperador en segundo plano consultaba `turno:estado` cada 60 s. En el intento 8 vio
// LIBRE y TOMÓ el turno (`DESKTOP-T5MONF5.22844`, 14:01:05Z), quedándose con lo que un humano
// acababa de ceder a otra sesión. La lección del ticket, literal:
//
//     «cualquier automatismo que espere y tome gana siempre a un humano que espera y decide»
//
// No es un problema de cortesía: un bucle no duerme, no lee el chat y no cede. Compite con
// ventaja estructural contra una persona que está decidiendo.
//
// ── QUÉ SE PROHÍBE, EXACTAMENTE ───────────────────────────────────────────────
// La COMPOSICIÓN «repetir + adquirir», no cada mitad por separado:
//   · esperar y MIRAR es legítimo (un `estado` en bucle que solo imprime, no compite);
//   · adquirir UNA vez es legítimo (es lo que hacen el runner y el CLI, fuera de todo bucle);
//   · repetir hasta que se pueda ADQUIRIR es lo que gana siempre al humano.
//
// Por eso `refrescarLock` NO cuenta como adquisición: el runner refresca DENTRO de su bucle de
// hijos y eso es correcto — ya tiene el turno, no compite por él. Medido en `main`:
// `adquirirLock` está en la línea 272 de `test-staging-gated.mjs`, FUERA de todo bucle, y lo
// que hay dentro del bucle es `refrescarLock`. Confundirlos volvería rojo el runner legítimo.
//
// ── POR QUÉ AST Y NO TEXTO ────────────────────────────────────────────────────
// Dos razones, y la segunda es la que decide:
//   1. Un `grep` no distingue «llamada dentro de un bucle» de «llamada y, aparte, un bucle».
//   2. **Un guard de texto se caza a sí mismo** en el comentario que explica la prohibición
//      (SCRUM-176/168/3, y por eso existe `_guard-texto.mjs`). Aquí el problema ni se plantea:
//      un ejemplo escrito dentro de una cadena NO es un nodo de bucle, así que este mismo
//      fichero puede contener los casos de prueba sin denunciarse. La inmunidad es estructural.
//
// ── LÍMITES DECLARADOS (un límite escrito es un límite; uno callado es la próxima sorpresa) ──
//   · **Fuera del repo no se ve.** El esperador del incidente era un comando en segundo plano,
//     no un fichero commiteado. Ningún guard de ficheros lo habría parado, y este tampoco
//     pararía al siguiente. Esa superficie necesita un hook `PreToolUse` y NO está construida.
//   · **Indirección entre ficheros no se sigue.** Dentro de un fichero sí: se calcula qué
//     funciones locales adquieren (punto fijo) y un bucle que llame a una de ellas cae igual.
//     Si el bucle está en A y la adquisición en B, este guard no lo ve.
//   · **Recursión con `setTimeout` que se auto-reprograma** no se detecta como repetición.
import ts from 'typescript';

/** Lo que ADQUIERE el turno. `refrescarLock`/`soltarLock` NO: quien refresca ya lo tiene. */
export const NOMBRES_ADQUISICION = new Set(['adquirirLock']);

/** Familia de arranque de subprocesos: la otra vía de adquirir (lanzando el CLI o el runner). */
const SPAWNERS = new Set(['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']);

/** Un subproceso ADQUIERE si invoca el CLI del turno en modo `tomar`, o el runner de la tanda. */
function spawnAdquiere(nodo) {
  const nombre = nombreDeLlamada(nodo);
  if (!nombre || !SPAWNERS.has(nombre)) return false;
  const textos = [];
  const recoger = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) textos.push(n.text);
    else if (ts.isTemplateExpression(n)) { textos.push(n.head.text); n.templateSpans.forEach((s) => textos.push(s.literal.text)); }
    n.forEachChild(recoger);
  };
  nodo.arguments.forEach(recoger);
  const todo = textos.join(' ');
  const tomaElTurno = /turno-staging/.test(todo) && /\btomar\b/.test(todo);
  const lanzaLaTanda = /test-staging-gated|test:staging/.test(todo);
  return tomaElTurno || lanzaLaTanda;
}

/** Nombre simple de la función invocada: `f()` → `f`, `a.b.f()` → `f`. */
function nombreDeLlamada(nodo) {
  if (!ts.isCallExpression(nodo)) return null;
  const c = nodo.expression;
  if (ts.isIdentifier(c)) return c.text;
  if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.name)) return c.name.text;
  return null;
}

const LOOPS = (n) =>
  ts.isWhileStatement(n) || ts.isDoStatement(n) || ts.isForStatement(n) ||
  ts.isForInStatement(n) || ts.isForOfStatement(n);

// ── QUÉ SEPARA UN ESPERADOR DE UN BUCLE QUE SOLO ITERA ────────────────────────
// Medido, no supuesto: la primera versión de este guard marcó
// `tests/scrum188-turno-staging.test.mjs:246`, que recorre una TABLA DE CASOS
// (`[null, 'PROD', 'YAQU_STAGINGX', '']`) llamando a `adquirirLock` contra un cliente falso para
// comprobar que se NIEGA. Eso no espera a nadie: itera fixtures. Un guard que lo tumba no
// distingue, y uno que no distingue se acaba desactivando.
//
// Lo prohibido no es «bucle + adquisición»: es **REINTENTAR HASTA CONSEGUIRLO**. Un esperador se
// reconoce porque su continuación depende de obtener el turno. Tres señales, y basta una:
//   · DUERME entre intentos (la firma del sondeo: el del incidente esperaba 60 s);
//   · CORTA el flujo (`break`/`return`) — «para cuando lo tengas»;
//   · su CONDICIÓN está atada a algo que el propio cuerpo asigna (`while (!tengoTurno)`).
// La tabla de casos no tiene ninguna de las tres: no duerme, no corta y no tiene condición.
//
// LÍMITE DECLARADO: un bucle que adquiriera sin dormir, sin cortar y sin condición atada no
// caería — pero eso no es un esperador, es un bucle infinito de adquisiciones, o sea un fallo
// distinto y ruidoso.
const DORMILONES = new Set(['setTimeout', 'setInterval', 'sleep', 'delay', 'esperar', 'dormir']);

/** Recorre sin entrar en funciones anidadas: un `break` de dentro pertenece a otro bucle. */
function recorrerPlano(nodo, fn) {
  nodo.forEachChild(function visita(n) {
    if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)) return;
    fn(n);
    n.forEachChild(visita);
  });
}

function duerme(cuerpo) {
  let si = false;
  recorrer(cuerpo, (n) => {
    if (si || !ts.isCallExpression(n)) return;
    const nombre = nombreDeLlamada(n);
    if (nombre && DORMILONES.has(nombre)) si = true;
  });
  return si;
}

function cortaElFlujo(cuerpo) {
  let si = false;
  recorrerPlano(cuerpo, (n) => {
    if (ts.isBreakStatement(n) || ts.isReturnStatement(n)) si = true;
  });
  return si;
}

/** ¿La condición del bucle depende de algo que el cuerpo asigna? (`while (!tengoTurno)`) */
function condicionAtada(bucle, cuerpo) {
  const cond = ts.isWhileStatement(bucle) || ts.isDoStatement(bucle) ? bucle.expression
    : ts.isForStatement(bucle) ? bucle.condition : null;
  if (!cond) return false;
  const enCondicion = new Set();
  recorrer(cond, (n) => { if (ts.isIdentifier(n)) enCondicion.add(n.text); });
  let atada = false;
  recorrer(cuerpo, (n) => {
    if (atada) return;
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(n.left) && enCondicion.has(n.left.text)) atada = true;
  });
  return atada;
}

/** Recorre un subárbol aplicando `fn`. */
function recorrer(nodo, fn) {
  fn(nodo);
  nodo.forEachChild((h) => recorrer(h, fn));
}

/** ¿Este subárbol adquiere DIRECTAMENTE? (llamada al símbolo, o spawn del CLI/runner) */
function adquiereDirecto(nodo) {
  let si = false;
  recorrer(nodo, (n) => {
    if (si || !ts.isCallExpression(n)) return;
    const nombre = nombreDeLlamada(n);
    if (nombre && NOMBRES_ADQUISICION.has(nombre)) si = true;
    else if (spawnAdquiere(n)) si = true;
  });
  return si;
}

/** Funciones locales con nombre: `function f(){}`, `const f = () => {}`, métodos. */
function funcionesLocales(raiz) {
  const mapa = new Map();
  recorrer(raiz, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) mapa.set(n.name.text, n.body);
    else if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer &&
             (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) && n.initializer.body) {
      mapa.set(n.name.text, n.initializer.body);
    } else if (ts.isMethodDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.body) {
      mapa.set(n.name.text, n.body);
    }
  });
  return mapa;
}

/** Nombres de funciones invocadas dentro de un subárbol. */
function llamadasEn(nodo) {
  const out = new Set();
  recorrer(nodo, (n) => {
    const nombre = nombreDeLlamada(n);
    if (nombre) out.add(nombre);
  });
  return out;
}

/**
 * Analiza UN fuente.
 * @returns {{bucles:number, adquisicionesDirectas:number, violaciones:Array<{linea:number,motivo:string}>}}
 */
export function analizar(fuente, ruta = 'anonimo.mjs') {
  const sf = ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true);

  // ── qué funciones locales adquieren, incluida la indirección (punto fijo) ──
  const locales = funcionesLocales(sf);
  const adquieren = new Set();
  for (const [nombre, cuerpo] of locales) if (adquiereDirecto(cuerpo)) adquieren.add(nombre);
  let creció = true;
  while (creció) {
    creció = false;
    for (const [nombre, cuerpo] of locales) {
      if (adquieren.has(nombre)) continue;
      for (const llamada of llamadasEn(cuerpo)) {
        if (adquieren.has(llamada)) { adquieren.add(nombre); creció = true; break; }
      }
    }
  }

  const violaciones = [];
  let bucles = 0;
  let adquisicionesDirectas = 0;

  recorrer(sf, (n) => {
    if (ts.isCallExpression(n)) {
      const nombre = nombreDeLlamada(n);
      if ((nombre && NOMBRES_ADQUISICION.has(nombre)) || spawnAdquiere(n)) adquisicionesDirectas++;
    }

    // Cuerpos que se REPITEN: bucles léxicos y el callback de setInterval.
    let cuerpo = null;
    let esperaPorSuNaturaleza = false;
    if (LOOPS(n)) { bucles++; cuerpo = n.statement; }
    else if (ts.isCallExpression(n) && nombreDeLlamada(n) === 'setInterval' && n.arguments[0]) {
      // Un `setInterval` no itera una colección: repite en el tiempo. Eso YA es sondeo.
      bucles++; cuerpo = n.arguments[0]; esperaPorSuNaturaleza = true;
    }
    if (!cuerpo) return;

    const directo = adquiereDirecto(cuerpo);
    const indirecto = !directo && [...llamadasEn(cuerpo)].some((f) => adquieren.has(f));
    if (!directo && !indirecto) return;

    // Adquirir dentro de un bucle no basta: tiene que REINTENTAR HASTA CONSEGUIRLO.
    if (!esperaPorSuNaturaleza && !duerme(cuerpo) && !cortaElFlujo(cuerpo) && !condicionAtada(n, cuerpo)) return;

    const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
    violaciones.push({
      linea: line + 1,
      motivo: directo
        ? 'un cuerpo que se repite ADQUIERE el turno'
        : 'un cuerpo que se repite llama a una función local que ADQUIERE el turno',
    });
  });

  return { bucles, adquisicionesDirectas, violaciones };
}
