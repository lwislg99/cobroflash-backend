// scripts/_exenciones-de-guards.mjs — SCRUM-511
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// QUÉ COMPRA UNA EXENCIÓN: ¿USAR la señal, o sólo NOMBRARLA?
//
// SCRUM-510 encontró que la exención de SCRUM-409 libraba ficheros por **mencionar** la señal
// (`texto.includes('isDemoMerchant')`), aunque la mención viviera en un comentario. Y los tres
// casos reales son de manual: tres ficheros tenían la exención **gracias al comentario que
// advertía del defecto**.
//
//   >>> Explicar un riesgo puede comprarte la exención de vigilarlo. <<<
//
// Este módulo CENSA cuántos otros mecanismos de exención tienen esa forma. No arregla ninguno:
// endurecer produce rojos en ficheros ajenos y eso va uno a uno (SCRUM-510), con su clasificación.
//
// ── LAS CUATRO CLASES, Y POR QUÉ SÓLO UNA ES DEFECTO ───────────────────────────────────────
//
//   · `USO`      — decide mirando el CÓDIGO (AST, `soloCodigo`, identificadores). Correcto.
//   · `LISTA`    — nombres escritos a mano. Correcto si cada entrada tiene motivo; se dice si no.
//   · `MENCION`  — 🔴 decide con `includes`/`indexOf`/`test` sobre el TEXTO del fichero. Un
//                  comentario compra la exención. Es el defecto que este ticket viene a contar.
//   · `NO_SE_PUDO_DETERMINAR` — no se adivina. *Un censo que adivina no vale.*
//
// ── 🔴 DOS INSTRUMENTOS, NUNCA UNO (lo exige el ticket, y con razón) ───────────────────────
//
// El AST y el texto se pasan por separado y **se dice qué vio cada uno**. No es redundancia: es
// que discrepan justo donde está el interés. El barrido de TEXTO ve el `includes` que hay dentro
// de un comentario; el AST no lo ve porque no es código. **Cuando discrepan, la discrepancia ES
// el dato**, y por eso se devuelve en vez de resolverse.
//
// ⚠️ Y AQUÍ VIVE SCRUM-349: el fichero que explica este defecto contiene los patrones que
// persigue —esta misma cabecera dice `includes` tres veces—. Por eso la clasificación es por AST,
// que no ve comentarios por construcción. Un censo de texto se contaría a sí mismo.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const ts = require_('typescript');

export const CLASES = Object.freeze({
  USO: 'USO',
  LISTA: 'LISTA',
  MENCION: 'MENCION',
  INDETERMINADO: 'NO_SE_PUDO_DETERMINAR',
});

/** Nombres que delatan que una declaración decide QUIÉN queda fuera de la vigilancia. */
const NOMBRE_DE_EXENCION = /(exent|exim|exclu|salvo|ignora|permitid|allowlist|omitid|whitelist)/i;

/** Lo que convierte una comprobación en «mirar el TEXTO»: subcadena, índice o expresión regular. */
const METODOS_DE_TEXTO = new Set(['includes', 'indexOf', 'search', 'match', 'test', 'startsWith', 'endsWith']);

/** Lo que delata que se está mirando el CÓDIGO y no la prosa. */
const SENAS_DE_USO = /(soloCodigo|createSourceFile|forEachChild|isIdentifier|isCallExpression|identificadores|porAst|AST)/;

/** Nombres de variable que delatan que lo que se inspecciona es el TEXTO de un fichero. */
const HUELE_A_TEXTO = /^(texto|fuente|contenido|codigo|src|raw|linea|lineas|cuerpo|html|css|md)$/i;

/** ¿La declaración es una LISTA literal de cadenas? Acepta `[...]`, `new Set([...])`, `Object.freeze([...])`. */
function arrayLiteralDe(nodo) {
  if (!nodo) return null;
  if (ts.isArrayLiteralExpression(nodo)) return nodo;
  if (ts.isNewExpression(nodo) && nodo.arguments?.length) return arrayLiteralDe(nodo.arguments[0]);
  if (ts.isCallExpression(nodo) && nodo.arguments?.length) return arrayLiteralDe(nodo.arguments[0]);
  return null;
}

/**
 * Clasifica UNA declaración por su mecanismo, mirando su propio subárbol.
 *
 * El orden importa y es deliberado: primero `USO`, porque un reconocedor por AST puede además
 * llevar un `includes` auxiliar dentro y no por eso decide por mención. Clasificarlo al revés
 * acusaría precisamente a los que están BIEN hechos.
 */
export function clasificarNodo(nodo, sf, contenedor = null) {
  const texto = nodo.getText(sf);
  // 🔴 EL ÁMBITO IMPORTA, y la primera versión lo tenía mal. `const exento = n.properties.find(…)`
  // dentro de un visitador de AST decide por USO, pero la seña (`createSourceFile`) vive en la
  // FUNCIÓN de alrededor, no en la línea. Mirando sólo el nodo, el control positivo del ticket
  // —`scrum245`, ya corregido— salía NO_SE_PUDO_DETERMINAR. Medido y arreglado, no supuesto.
  if (SENAS_DE_USO.test(texto)) return CLASES.USO;
  if (contenedor && SENAS_DE_USO.test(contenedor)) return CLASES.USO;

  const lista = arrayLiteralDe(ts.isVariableDeclaration(nodo) ? nodo.initializer : null);
  if (lista && lista.elements.length > 0) {
    // Una lista de CADENAS y una de OBJETOS `{patron, porque}` son la misma clase: nombres
    // escritos a mano. La segunda es además la forma BUENA —lleva el motivo al lado—, y
    // exigir sólo cadenas la dejaba fuera: `CONSOLA_ALLOWLIST` salía indeterminada.
    const todasLiterales = lista.elements.every((e) => ts.isStringLiteralLike(e) || ts.isObjectLiteralExpression(e)
      || ts.isRegularExpressionLiteral(e));
    if (todasLiterales) return CLASES.LISTA;
  }

  // ¿Hay una comprobación de TEXTO sobre algo que huele a contenido de fichero?
  let porMencion = false;
  (function visita(n) {
    if (porMencion) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && METODOS_DE_TEXTO.has(n.expression.name.text)) {
      const sujeto = n.expression.expression;
      const nombreSujeto = ts.isIdentifier(sujeto) ? sujeto.text
        : (ts.isPropertyAccessExpression(sujeto) ? sujeto.name.text : null);
      // `RE.test(texto)` — el sujeto es la regex y el TEXTO va de argumento.
      const argHuele = (n.arguments || []).some((a) => ts.isIdentifier(a) && HUELE_A_TEXTO.test(a.text));
      if ((nombreSujeto && HUELE_A_TEXTO.test(nombreSujeto)) || argHuele) porMencion = true;
    }
    ts.forEachChild(n, visita);
  }(nodo));
  if (porMencion) return CLASES.MENCION;

  return CLASES.INDETERMINADO;
}

/** INSTRUMENTO ① · por AST. No ve comentarios: es lo que lo hace fiable aquí. */
export function porAst(codigo, nombre = 'x.mjs') {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true);
  const fuera = [];
  // `ambito` es el texto de la función que envuelve a la declaración — donde vive la seña de USO.
  // Se arrastra por la recursión en vez de recalcularlo subiendo por los padres.
  (function visita(n, ambito) {
    const propio = (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)
      || ts.isMethodDeclaration(n)) ? n.getText(sf) : ambito;
    let nm = null;
    if (ts.isFunctionDeclaration(n) && n.name) nm = n.name.text;
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) nm = n.name.text;
    if (nm && NOMBRE_DE_EXENCION.test(nm)) {
      fuera.push({
        nombre: nm,
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        clase: clasificarNodo(n, sf, ambito),
      });
    }
    ts.forEachChild(n, (h) => visita(h, propio));
  }(sf, null));
  return fuera;
}

/**
 * INSTRUMENTO ② · por TEXTO, a propósito ingenuo.
 *
 * Cuenta las líneas que combinan vocabulario de exención con una comprobación de texto, SIN
 * distinguir código de comentario. No está aquí para acertar: está para **discrepar** del AST y
 * enseñar dónde. Si los dos dieran siempre lo mismo, uno de los dos sobraría.
 */
export function porTexto(codigo) {
  const fuera = [];
  const lineas = codigo.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (!NOMBRE_DE_EXENCION.test(l)) continue;
    if (!/\.(includes|indexOf|search|match|test|startsWith|endsWith)\s*\(/.test(l)) continue;
    fuera.push({ linea: i + 1, texto: l.trim().slice(0, 100) });
  }
  return fuera;
}

// ── 🔴 EL SEGUNDO CRITERIO, Y EL QUE DE VERDAD MIDE — por MECANISMO, no por nombre ──────────
//
// El criterio de arriba (declaraciones cuyo NOMBRE delata exención) **no ve el control positivo**,
// y eso lo invalida como medida del defecto. Medido: en `scrum409` —el caso que origina el
// ticket— el mecanismo se llama `usaElMecanismoDelDemo`, `pruebaElDemo` y `loMenciona`. Ninguno
// contiene «exento», «excluido» ni «permitido».
//
//   >>> Un censo que sólo ve lo que está bien nombrado mide la nomenclatura, no el código. <<<
//
// Se conserva porque su reparto (USO / LISTA / …) sigue siendo información útil, pero **su cero
// no se puede leer como salud**, y por eso el veredicto del ticket NO sale de él.
//
// Lo que decide es esto: un guard exime por MENCIÓN cuando **decide sobre el TEXTO CRUDO de un
// fichero del árbol** —comentarios incluidos— en vez de sobre su código. Se detecta siguiendo el
// dato, no el nombre:
//
//   ① ¿lee ficheros del árbol?                         `readFileSync`
//   ② ¿decide con una comprobación de texto?           `.includes` / `.test` / `.indexOf` …
//   ③ ¿esa decisión DESCARTA algo?                     dentro de un `filter` / `some` / `every` / `if`
//   ④ ¿y NO pasa por el código?                        ni `soloCodigo` ni AST en el fichero
//
// El ④ es el que separa: un fichero que lee texto crudo **pero lo tokeniza** está haciendo lo
// correcto. Los cuatro juntos son la forma exacta del defecto de SCRUM-409.

/** Métodos que, sobre el texto de un fichero, deciden por SUBCADENA en vez de por estructura. */
const DECIDE_POR_TEXTO = /\.(includes|indexOf|match|search)\s*\(|\.test\s*\(/;
/** Lo que convierte una comprobación en un DESCARTE: filtrar, saltar, o cortar. */
const DESCARTA = /\b(filter|some|every|find|continue|return\s+(true|false|null))\b/;

/**
 * ¿Este fichero decide exenciones mirando el TEXTO CRUDO de otros ficheros?
 *
 * Devuelve el veredicto con sus cuatro señales por separado, para que quien lo lea pueda ver
 * POR QUÉ salió lo que salió en vez de tener que fiarse del booleano.
 */
export function mecanismoDelFichero(codigo) {
  const lee = /readFileSync\s*\(/.test(codigo);
  const decidePorTexto = DECIDE_POR_TEXTO.test(codigo);
  const descarta = DESCARTA.test(codigo);
  const miraElCodigo = SENAS_DE_USO.test(codigo);
  return {
    lee,
    decidePorTexto,
    descarta,
    miraElCodigo,
    // 🔴 El defecto: lee ficheros, decide por texto, descarta con eso, y NO tokeniza.
    porMencion: lee && decidePorTexto && descarta && !miraElCodigo,
  };
}

/** La población declarada: dónde se busca. Un censo sin población declarada no es un censo. */
export const POBLACION = Object.freeze([{ dir: 'tests', ext: '.mjs' }, { dir: 'scripts', ext: '.mjs' }]);

/** Recorre la población y devuelve las declaraciones de exención con su clase, por los DOS caminos. */
export function censar(raiz) {
  const declaraciones = [];
  const soloTexto = [];
  const porMecanismo = [];
  let ficheros = 0;
  for (const { dir, ext } of POBLACION) {
    const abs = path.join(raiz, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (!f.endsWith(ext)) continue;
      const rel = `${dir}/${f}`;
      ficheros += 1;
      const codigo = fs.readFileSync(path.join(abs, f), 'utf8');
      for (const d of porAst(codigo, rel)) declaraciones.push({ fichero: rel, ...d });
      for (const t of porTexto(codigo)) soloTexto.push({ fichero: rel, ...t });
      porMecanismo.push({ fichero: rel, ...mecanismoDelFichero(codigo) });
    }
  }
  const porClase = (c) => declaraciones.filter((d) => d.clase === c);
  return {
    ficheros,
    declaraciones,
    soloTexto,
    porMecanismo,
    // 🔴 EL VEREDICTO DEL TICKET sale de AQUI, no del reparto por nombre.
    sospechosos: porMecanismo.filter((m) => m.porMencion),
    uso: porClase(CLASES.USO),
    lista: porClase(CLASES.LISTA),
    mencion: porClase(CLASES.MENCION),
    indeterminado: porClase(CLASES.INDETERMINADO),
  };
}
