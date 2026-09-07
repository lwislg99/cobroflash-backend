// tests/_censo-poblacion-de-guards.mjs — SCRUM-759
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA POBLACIÓN QUE UN GUARD LEE, DERIVADA DEL AST DEL PROPIO GUARD.
//
// El defecto que motiva esto: un guard por AST anclado a UN fichero es fuerte donde mira y ciego
// donde no, **y su verde no distingue las dos cosas**. Su población es un fichero; su afirmación
// («hay exactamente UN alta en el front») es sobre el producto entero; y el rótulo no dice cuál
// de las dos mide. SCRUM-303 es el caso medido: una sesión escribió una segunda alta en otro
// fichero —lo que ese guard existe para impedir— y SCRUM-303 se quedó VERDE.
//
// ── POR QUÉ POR AST Y NO POR TEXTO ──────────────────────────────────────────────────────────
// Un `grep` de `readFileSync` casa el comentario que lo explica, casa la línea comentada y no
// sabe QUÉ FICHERO se lee cuando la ruta viene de tres `const` encadenadas —que es como está
// escrita en casi todos los guards de la casa. La ruta se RESUELVE aquí siguiendo las
// declaraciones, y lo que no se puede resolver **se cuenta aparte y se dice**: un guard cuya
// población no se sabe leer sale CIEGO, nunca «no anclado». Un cero de anclados que en realidad
// es «no supe mirar» sería el mismo defecto que este fichero persigue, cometido por el vigilante.
//
// ── LOS TRES ESTADOS DE UNA POBLACIÓN ───────────────────────────────────────────────────────
//   ANCLADA  · todas las lecturas resuelven a ficheros CONCRETOS. Es el que puede mentir.
//   BARRIDO  · hay un `readdirSync` o una lectura con ruta variable (un bucle sobre una lista):
//              la población es un conjunto, no un fichero, y crece sola con el árbol.
//   CIEGO    · usa el AST y NO se ha sabido de dónde lee. No es un veredicto sobre el guard: es
//              un veredicto sobre este censo.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

export const DIR_TESTS = path.join(path.dirname(fileURLToPath(import.meta.url)));

/** El nombre de la declaración con la que un guard dice a qué población mira. */
export const CLAVE_POBLACION = 'POBLACION_QUE_VIGILO';

/**
 * Parsear el árbol de 700 ficheros CUATRO veces cuesta más que el resto del guard junto, y las
 * cuatro preguntas de este censo miran el MISMO árbol. Se parsea una vez por (fichero, contenido).
 * La clave lleva el contenido a propósito: dos árboles distintos —el de trabajo y el de la base
 * de fusión— tienen ficheros con el mismo nombre y NO son el mismo código.
 */
const ARBOLES = new Map();
function parsear(codigo, nombre) {
  const clave = `${nombre} :: ${codigo}`;
  let sf = ARBOLES.get(clave);
  if (!sf) {
    sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    ARBOLES.set(clave, sf);
  }
  return sf;
}

/** Normaliza `a/b/../c` → `a/c`, y deja la ruta relativa a la raíz del repo. */
export function normalizar(rel) {
  const out = [];
  for (const seg of String(rel).split(/[/\\]+/)) {
    if (!seg || seg === '.') continue;
    if (seg === '..') { out.pop(); continue; }
    out.push(seg);
  }
  return out.join('/');
}

/**
 * Lo que un guard LEE, derivado de su AST.
 *
 * `nombre` es el nombre del fichero del guard, y se usa para resolver `import.meta.url`: sin él
 * no se podría saber que `path.join(path.dirname(fileURLToPath(import.meta.url)), '..')` es la
 * raíz del repo, que es como está escrita la constante `RAIZ` en todos los guards de la casa.
 */
export function poblacionQueLee(codigo, nombre = 'x.test.mjs') {
  const sf = parsear(codigo, nombre);
  const consts = new Map();
  const variables = new Set(); // parámetros y variables de bucle: valen cosas distintas cada vuelta

  (function recoger(n) {
    if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer
        && !consts.has(n.name.text)) {
      consts.set(n.name.text, n.initializer);
    }
    if (ts.isParameter(n) && ts.isIdentifier(n.name)) variables.add(n.name.text);
    if ((ts.isForOfStatement(n) || ts.isForInStatement(n))
        && ts.isVariableDeclarationList(n.initializer)) {
      for (const d of n.initializer.declarations) {
        if (ts.isIdentifier(d.name)) variables.add(d.name.text);
      }
    }
    // `.map((f) => …)`, `.filter(…)`: sus parámetros ya entran por `isParameter`.
    ts.forEachChild(n, recoger);
  })(sf);

  /**
   * ¿A qué ruta del repo apunta esta expresión?
   *   { tipo: 'fija', rel }  ·  { tipo: 'variable' }  ·  { tipo: 'desconocida', texto }
   */
  const resolver = (nodo, vistos = new Set()) => {
    if (!nodo) return { tipo: 'desconocida', texto: '(sin argumento)' };
    const texto = nodo.getText(sf).replace(/\s+/g, ' ').slice(0, 80);

    if (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) {
      return { tipo: 'fija', rel: nodo.text };
    }
    if (ts.isTemplateExpression(nodo)) return { tipo: 'variable', texto };

    // Las tres formas con las que un guard se sitúa a sí mismo en el árbol. Se resuelven aquí
    // porque, sin ellas, 30 guards de la casa salían CIEGOS por la manera de escribir la ruta y
    // no por nada suyo: un censo que se declara ciego de más también miente, sólo que por lo bajo.
    if (nodo.getText(sf) === 'import.meta.url') return { tipo: 'fija', rel: `tests/${nombre}` };
    if (nodo.getText(sf) === 'import.meta.filename') return { tipo: 'fija', rel: `tests/${nombre}` };
    if (nodo.getText(sf) === 'import.meta.dirname') return { tipo: 'fija', rel: 'tests' };

    // `new URL('..', import.meta.url)` — relativa a la CARPETA del guard, como manda el estándar.
    if (ts.isNewExpression(nodo) && nodo.expression.getText(sf) === 'URL') {
      const args = nodo.arguments ?? [];
      const rel = resolver(args[0], vistos);
      if (rel.tipo !== 'fija') return rel;
      if (!args[1]) return { tipo: 'desconocida', texto };
      const base = resolver(args[1], vistos);
      if (base.tipo !== 'fija') return base;
      return { tipo: 'fija', rel: normalizar(`${base.rel}/../${rel.rel}`) };
    }

    if (ts.isIdentifier(nodo)) {
      const t = nodo.text;
      if (variables.has(t)) return { tipo: 'variable', texto: t };
      if (vistos.has(t)) return { tipo: 'desconocida', texto: `${t} (ciclo)` };
      if (!consts.has(t)) return { tipo: 'desconocida', texto: t };
      return resolver(consts.get(t), new Set([...vistos, t]));
    }

    // `POBLACION_QUE_VIGILO[0]` — el guard que DERIVA su ruta de su propia declaración. Sin
    // esto, adoptar la declaración dejaría al guard CIEGO en este censo, que es el peor premio
    // posible por hacer lo correcto.
    if (ts.isElementAccessExpression(nodo) && nodo.argumentExpression
        && ts.isNumericLiteral(nodo.argumentExpression)) {
      const idx = Number(nodo.argumentExpression.text);
      let lista = nodo.expression;
      const yaVistos = new Set(vistos);
      while (ts.isIdentifier(lista) && consts.has(lista.text) && !yaVistos.has(lista.text)) {
        yaVistos.add(lista.text);
        lista = consts.get(lista.text);
      }
      if (ts.isArrayLiteralExpression(lista) && lista.elements[idx]) {
        return resolver(lista.elements[idx], yaVistos);
      }
      return { tipo: 'desconocida', texto };
    }

    if (ts.isCallExpression(nodo)) {
      const callee = nodo.expression.getText(sf);
      if (/(^|[.])(join|resolve)$/.test(callee)) {
        const partes = [];
        for (const a of nodo.arguments) {
          const r = resolver(a, vistos);
          if (r.tipo !== 'fija') return r;
          partes.push(r.rel);
        }
        return { tipo: 'fija', rel: normalizar(partes.join('/')) };
      }
      if (/(^|[.])dirname$/.test(callee)) {
        const r = resolver(nodo.arguments[0], vistos);
        if (r.tipo !== 'fija') return r;
        return { tipo: 'fija', rel: normalizar(`${r.rel}/..`) };
      }
      if (/(^|[.])fileURLToPath$/.test(callee)) return resolver(nodo.arguments[0], vistos);
      return { tipo: 'desconocida', texto };
    }
    return { tipo: 'desconocida', texto };
  };

  const ficheros = new Set();
  const barridos = new Set();
  const variablesLeidas = [];
  const noResueltas = [];
  const ayudantes = [];
  let usaAST = false;

  (function visitar(n) {
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText(sf);
      if (/(^|[.])createSourceFile$/.test(callee)) usaAST = true;
      if (/(^|[.])readFileSync$/.test(callee)) {
        const r = resolver(n.arguments[0]);
        if (r.tipo === 'fija') ficheros.add(normalizar(r.rel));
        else if (r.tipo === 'variable') variablesLeidas.push(r.texto);
        else noResueltas.push(r.texto);
      }
      if (/(^|[.])readdirSync$/.test(callee)) {
        const r = resolver(n.arguments[0]);
        if (r.tipo === 'fija') barridos.add(normalizar(r.rel) || '.');
        else barridos.add(`?${r.texto}`);
      }
    }
    // 🔴 QUIEN DELEGA LA LECTURA EN UN HELPER LEE LO QUE EL HELPER LEE. Sin esto, un guard que
    // llama a `_censo-…​.mjs` —que barre `src/` entero— salía ANCLADO al único fichero que abre
    // él mismo, y el censo lo habría acusado de mentir cuando su población es un barrido. Un
    // censo que clasifica de menos es tan falso como uno que cuenta de menos (SCRUM-627b fue el
    // caso medido: salía anclado a `tests/scrum389-censo-vat.test.mjs`).
    if (ts.isImportDeclaration(n) && ts.isStringLiteralLike(n.moduleSpecifier)
        && /^[.]{1,2}[/]/.test(n.moduleSpecifier.text) && n.moduleSpecifier.text.endsWith('.mjs')) {
      ayudantes.push(n.moduleSpecifier.text.replace(/^[.][/]/, ''));
    }
    ts.forEachChild(n, visitar);
  })(sf);

  let tipo;
  if (barridos.size || variablesLeidas.length) tipo = 'BARRIDO';
  else if (ficheros.size) tipo = 'ANCLADA';
  else tipo = 'CIEGA';

  return {
    guard: nombre,
    usaAST,
    tipo,
    ficheros: [...ficheros].sort(),
    barridos: [...barridos].sort(),
    variablesLeidas,
    noResueltas,
    ayudantes,
    sf,
  };
}

/**
 * La población de un guard CONTANDO lo que leen los helpers que importa, transitivamente.
 *
 * `leerAyudante(ruta)` devuelve el código del helper o `null` si no está: un helper que no se
 * puede leer se apunta como NO RESUELTO, que es lo que corresponde — no se puede afirmar nada
 * sobre lo que no se ha podido abrir.
 */
export function poblacionConAyudantes(codigo, nombre, leerAyudante, vistos = new Set()) {
  const propia = poblacionQueLee(codigo, nombre);
  const ficheros = new Set(propia.ficheros);
  const barridos = new Set(propia.barridos);
  const variablesLeidas = [...propia.variablesLeidas];
  const noResueltas = [...propia.noResueltas];
  let usaAST = propia.usaAST;

  for (const ruta of propia.ayudantes) {
    if (vistos.has(ruta)) continue;
    vistos.add(ruta);
    const cod = leerAyudante(ruta);
    if (cod == null) { noResueltas.push(`helper ilegible: ${ruta}`); continue; }
    const sub = poblacionConAyudantes(cod, ruta, leerAyudante, vistos);
    for (const f of sub.ficheros) ficheros.add(f);
    for (const b of sub.barridos) barridos.add(b);
    variablesLeidas.push(...sub.variablesLeidas);
    noResueltas.push(...sub.noResueltas);
    usaAST = usaAST || sub.usaAST;
  }

  let tipo;
  if (barridos.size || variablesLeidas.length) tipo = 'BARRIDO';
  else if (ficheros.size) tipo = 'ANCLADA';
  else tipo = 'CIEGA';

  return {
    guard: nombre,
    usaAST,
    tipo,
    ficheros: [...ficheros].sort(),
    barridos: [...barridos].sort(),
    variablesLeidas,
    noResueltas,
    ayudantes: propia.ayudantes,
    propia,
  };
}

/**
 * ¿Este guard afirma un TOTAL sobre lo que censa?
 *
 * No se mira el rótulo (es prosa), se mira la FORMA: una función que recorre el AST y va
 * `push`eando en un array —eso es un censo—, y un `assert` que compara lo censado contra `[]` o
 * contra un número. Eso es una afirmación sobre TODA la población. Un guard que sólo comprueba
 * «en este fichero, tal función hace tal cosa» no aparece aquí, y hace bien: afirma sobre el
 * fichero que lee y nada más.
 */
export function afirmacionesDeTotal(codigo, nombre = 'x.test.mjs') {
  const sf = parsear(codigo, nombre);
  const censadoras = new Set();

  (function fns(n) {
    if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) && n.name && ts.isIdentifier(n.name)) {
      const t = n.getText(sf);
      if (/forEachChild|createSourceFile/.test(t) && /[.]push[(]/.test(t)) censadoras.add(n.name.text);
    }
    ts.forEachChild(n, fns);
  })(sf);

  // Lo que sale de una censadora queda MARCADO, y la marca se propaga por `.filter`/`.map`.
  const marcadas = new Set();
  const marcaEn = (txt) => [...censadoras].some((c) => new RegExp(`(^|[^\\w$])${c}\\s*[(]`).test(txt))
    || [...marcadas].some((t) => new RegExp(`(^|[^\\w$])${t}([^\\w$]|$)`).test(txt));

  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    (function marcar(n) {
      if (ts.isVariableDeclaration(n) && n.initializer && marcaEn(n.initializer.getText(sf))) {
        if (ts.isIdentifier(n.name)) marcadas.add(n.name.text);
        else for (const el of n.name.elements ?? []) {
          if (el.name && ts.isIdentifier(el.name)) marcadas.add(el.name.text);
        }
      }
      ts.forEachChild(n, marcar);
    })(sf);
  }

  const totales = [];
  (function asserts(n) {
    if (ts.isCallExpression(n) && /^assert([.]|$)/.test(n.expression.getText(sf))
        && n.arguments.length >= 2) {
      const real = n.arguments[0];
      const esperado = n.arguments[1];
      const esListaVacia = ts.isArrayLiteralExpression(esperado) && esperado.elements.length === 0;
      const esNumero = ts.isNumericLiteral(esperado);
      if ((esListaVacia || esNumero) && marcaEn(real.getText(sf))) {
        totales.push({
          linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          sujeto: real.getText(sf).replace(/\s+/g, ' ').slice(0, 70),
          mensaje: n.arguments[2] ?? null,
          sf,
        });
      }
    }
    ts.forEachChild(n, asserts);
  })(sf);

  return { censadoras: [...censadoras], totales };
}

/**
 * La población DECLARADA por el guard (`export const POBLACION_QUE_VIGILO = [...]`).
 *
 * 🔴 Lo que no se sabe evaluar se DENUNCIA, no se descarta — la lección de SCRUM-757, que costó
 * tres sesiones: un elemento que no sea un literal haría bajar el recuento en silencio y el
 * guard se quedaría comparando contra media declaración.
 */
export function poblacionDeclarada(codigo, nombre = 'x.test.mjs') {
  const sf = parsear(codigo, nombre);
  let declarada = null;
  const ilegibles = [];

  (function v(n) {
    if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name)
        && n.name.text === CLAVE_POBLACION && n.initializer) {
      if (!ts.isArrayLiteralExpression(n.initializer)) {
        ilegibles.push({
          linea: sf.getLineAndCharacterOfPosition(n.initializer.getStart(sf)).line + 1,
          forma: ts.SyntaxKind[n.initializer.kind],
          texto: n.initializer.getText(sf).replace(/\s+/g, ' ').slice(0, 70),
        });
        return;
      }
      declarada = [];
      for (const el of n.initializer.elements) {
        if (ts.isStringLiteral(el) || ts.isNoSubstitutionTemplateLiteral(el)) {
          declarada.push(normalizar(el.text));
        } else {
          ilegibles.push({
            linea: sf.getLineAndCharacterOfPosition(el.getStart(sf)).line + 1,
            forma: ts.SyntaxKind[el.kind],
            texto: el.getText(sf).replace(/\s+/g, ' ').slice(0, 70),
          });
        }
      }
    }
    ts.forEachChild(n, v);
  })(sf);

  return { declarada, ilegibles };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * EL INSTRUMENTO GENÉRICO · censar una violación POR AST sobre LA POBLACIÓN QUE SE LE DÉ.
 *
 * La población entra por la puerta en vez de estar escrita dentro. Eso es todo lo que separa a
 * un guard que ve el árbol de uno que ve un fichero, y es lo que hace demostrable el defecto de
 * este ticket: con el MISMO criterio y la MISMA violación, la población decide si se ve o no.
 *
 * Lleva su SUELO dentro: `leidos` e `ilegibles`. Cero hallazgos sobre cero ficheros leídos no es
 * «no hay»; es «no he mirado», y quien llame tiene que poder distinguirlo.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function censarEnPoblacion(ficheros, esViolacion, leer = (f) => fs.readFileSync(f, 'utf8')) {
  const hallazgos = [];
  const ilegibles = [];
  let leidos = 0;
  for (const f of ficheros) {
    let codigo;
    try { codigo = leer(f); } catch { ilegibles.push(f); continue; }
    leidos += 1;
    const nombre = path.basename(f);
    const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    (function v(n) {
      if (esViolacion(n, sf)) {
        hallazgos.push({ fichero: nombre, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
      }
      ts.forEachChild(n, v);
    })(sf);
  }
  return { hallazgos, leidos, ilegibles };
}

/**
 * ¿El rótulo de esta afirmación de total está DERIVADO de la población declarada?
 *
 * Se mira por AST si el mensaje del `assert` menciona el identificador `POBLACION_QUE_VIGILO`
 * —directamente o a través de una `const` que salga de él—. **No se lee la prosa**: se comprueba
 * de dónde sale el texto. Un rótulo derivado no puede afirmar sobre una superficie que el guard
 * no lee, porque el nombre de la superficie lo pone la población.
 *
 * Es el escalón de arriba: la divergencia entre lo que se mira y lo que se dice pasa de VIGILADA
 * a IMPOSIBLE.
 */
export function rotuloDerivado(mensaje, sf, codigo, nombre = 'x.test.mjs') {
  if (!mensaje) return false;
  const fuente = sf ?? ts.createSourceFile(nombre, codigo ?? '', ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  // Constantes que salen de la población: `const DONDE = POBLACION_QUE_VIGILO.join(', ')`.
  const derivadas = new Set([CLAVE_POBLACION]);
  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    (function v(n) {
      if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer) {
        const txt = n.initializer.getText(fuente);
        if ([...derivadas].some((d) => new RegExp(`(^|[^\\w$])${d}([^\\w$]|$)`).test(txt))) {
          derivadas.add(n.name.text);
        }
      }
      ts.forEachChild(n, v);
    })(fuente);
  }

  let usa = false;
  (function v(n) {
    if (ts.isIdentifier(n) && derivadas.has(n.text)) usa = true;
    ts.forEachChild(n, v);
  })(mensaje);
  return usa;
}

/**
 * El censo entero. **Lleva su población delante**: sin ella, un «0 anclados» no se distingue de
 * un censo que no encontró qué mirar.
 */
export function censoDeGuards(dir = DIR_TESTS) {
  const nombres = fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
  const guards = [];
  const leerAyudante = (ruta) => {
    try { return fs.readFileSync(path.join(dir, ruta), 'utf8'); } catch { return null; }
  };

  for (const nombre of nombres) {
    const codigo = fs.readFileSync(path.join(dir, nombre), 'utf8');
    const lee = poblacionQueLee(codigo, nombre);
    if (!lee.usaAST) continue;
    // 🔴 DOS POBLACIONES, Y SE GUARDAN LAS DOS. La PROPIA es la que puede mentir: es la que el
    // guard abre él mismo. La EFECTIVA suma lo que leen sus helpers.
    //
    // Clasificar sólo por la efectiva ESCONDERÍA candidatos, porque casi todos los helpers de la
    // casa reciben la ruta por parámetro y eso los hace parecer barridos aunque el llamante les
    // pase un fichero fijo. Clasificar sólo por la propia acusaría a quien delega de verdad
    // (SCRUM-627b). Así que la clasificación va por la PROPIA y la EFECTIVA viaja al lado, para
    // que quien juzgue el rótulo sepa si la amplitud está justificada.
    const efectiva = poblacionConAyudantes(codigo, nombre, leerAyudante);
    const { censadoras, totales } = afirmacionesDeTotal(codigo, nombre);
    const { declarada, ilegibles } = poblacionDeclarada(codigo, nombre);
    guards.push({
      guard: nombre,
      tipo: lee.tipo,
      ficheros: lee.ficheros,
      barridos: lee.barridos,
      variablesLeidas: lee.variablesLeidas,
      noResueltas: lee.noResueltas,
      ayudantes: lee.ayudantes,
      tipoEfectivo: efectiva.tipo,
      barridosEfectivos: efectiva.barridos,
      censadoras,
      totales: totales.map((t) => ({
        linea: t.linea,
        sujeto: t.sujeto,
        derivado: rotuloDerivado(t.mensaje, t.sf),
      })),
      declarada,
      ilegibles,
    });
  }

  return { poblacion: nombres.length, conAST: guards.length, guards };
}

/**
 * Los que tienen LA FORMA del defecto: población ANCLADA a ficheros concretos **y** una
 * afirmación sobre el total de lo censado. Es aquí donde el rótulo puede abarcar más que la
 * población sin que nada lo diga.
 */
export function ancladosQueAfirmanTotal(censo) {
  return censo.guards.filter((g) => g.tipo === 'ANCLADA' && g.totales.length > 0);
}

/** Los que usan el AST y este censo NO ha sabido de dónde leen. Cero anclados sin mirar esto es un cero falso. */
export function ciegos(censo) {
  return censo.guards.filter((g) => g.tipo === 'CIEGA' || g.noResueltas.length > 0);
}

/**
 * Divergencia entre lo DECLARADO y lo que de verdad se lee, para los que han adoptado la
 * declaración. Vacío = cuadran.
 */
export function divergenciasDePoblacion(censo) {
  const out = [];
  for (const g of censo.guards) {
    if (!g.declarada && !g.ilegibles.length) continue;
    const declarada = new Set(g.declarada ?? []);
    const leida = new Set(g.ficheros);
    const sobran = [...declarada].filter((f) => !leida.has(f));
    const faltan = [...leida].filter((f) => !declarada.has(f));
    if (sobran.length || faltan.length || g.ilegibles.length) {
      out.push({ guard: g.guard, sobran, faltan, ilegibles: g.ilegibles });
    }
  }
  return out;
}

/** Los que han adoptado la declaración de población. Su número es un suelo que sólo sube. */
export function adoptantes(censo) {
  return censo.guards.filter((g) => Array.isArray(g.declarada));
}

/**
 * CUÁNTOS guards declaran su población en un directorio de tests, sin censarlo entero.
 *
 * Existe por una razón medida: el suelo derivado de SCRUM-810 corre el censo sobre DOS árboles
 * —el de trabajo y el de la base de fusión— y parsear 710 ficheros dos veces cuesta 25 s. El
 * texto sólo PRESELECCIONA; quien cuenta sigue siendo el AST, igual que en `candidatosEn` del
 * suelo contra main. Un fichero que no contiene el nombre de la declaración no puede declararla.
 */
export function contarAdoptantes(dir = DIR_TESTS) {
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.test.mjs')) continue;
    const codigo = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!codigo.includes(CLAVE_POBLACION)) continue;
    if (Array.isArray(poblacionDeclarada(codigo, f).declarada)) n += 1;
  }
  return n;
}
