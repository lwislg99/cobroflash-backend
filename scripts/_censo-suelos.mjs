// scripts/_censo-suelos.mjs — SCRUM-775
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿QUÉ SUELOS ESTÁN ESCRITOS Y NO CONECTADOS?
//
// Un suelo es la protección más barata de la casa y la más fácil de dejar decorativa: se escribe,
// se lee perfectamente bien, y no protege. Quien la lea creerá que ese instrumento tiene suelo.
//
// ── EL CASO QUE LO ORIGINA, MEDIDO ──────────────────────────────────────────────────────────
// `scripts/censo-tablero-vs-arbol.mjs` preguntaba `suelo.ok === false` sobre el valor que devuelve
// `comprobarSuelo`, que es un **ARRAY**. Un array no tiene `.ok`, así que la comparación era
// `undefined === false` → siempre falsa. **Esa mitad del suelo no pudo dispararse jamás.**
//
// Provocado el 6-sep-2026 antes de arreglarlo, con `docs/master/` encogido de 28 entradas a 3:
// el suelo devolvía 1 problema y el CLI salía con **0**, informe completo y stderr vacío.
//
// ── EL DISCRIMINADOR, Y POR QUÉ ES ÉSTE ─────────────────────────────────────────────────────
// Los dos casos conocidos tienen la MISMA forma y veredictos opuestos:
//
//   NO CONECTADO   const suelo = comprobarSuelo(…);   if (… suelo.ok === false) process.exit(2)
//                  → `comprobarSuelo` devuelve un array: NUNCA hay `.ok`.
//   CONECTADO      const c = censoDeLaFrontera();      if (c.poblacion === 0) process.exit(2)
//                  → `censoDeLaFrontera` devuelve `{ poblacion, … }`: la propiedad EXISTE.
//
// Así que la pregunta no es «¿hay un suelo?» —eso lo dice cualquier `grep`— sino **«¿la propiedad
// que el guard lee la produce alguna vez quien la fabrica?»**. Se contesta por AST y por
// PRODUCTOR, no por nombre: una lista de nombres de suelo envejecería el día que alguien llame al
// suyo de otra forma (SCRUM-199).
//
// ── ⛔ LO QUE ESTE CENSO NO VE, dicho aquí y no descubierto en un rojo raro ──────────────────
//   · Suelos cuyo productor viene de un `import` que no se puede resolver a un fichero del repo
//     (paquetes de `node_modules`, indirecciones). Salen en NO SÉ LEER, nunca en «conectado».
//   · Productores cuyos `return` no son literales legibles (una llamada, un ternario complejo).
//     También NO SÉ LEER: un veredicto sobre lo que no se ha podido leer sería el defecto mismo.
//   · Guards que no se expresan como `if (…) { salida }` — un `assert` suelto, un `??=`, un
//     early-return sin ruido. Este censo mide UNA forma, la que produjo el defecto, y lo dice.
//   · Que la propiedad exista NO garantiza que el umbral sea el correcto. «Conectado» significa
//     que la comparación PUEDE ser cierta, no que sea la comparación acertada.
//
// 🔴 Y EL SUELO DE ESTE CENSO: si no encuentra población —cero guards de esta forma en todo el
// árbol— no dice «no hay suelos rotos», dice que no ha medido. Un cero sobre población vacía no
// es un cero.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Los directorios que se barren. Declarado, no adivinado. */
export const POBLACION = ['scripts', 'tests'];

/**
 * 🔴 LAS PROPIEDADES QUE UN VALOR TIENE **SIN QUE NADIE SE LAS PONGA**, DERIVADAS DEL LENGUAJE.
 *
 * Esto es un defecto propio, corregido midiendo la primera salida del censo. La versión anterior
 * decía «devuelve un ARRAY, luego no tiene la propiedad que lees» y marcaba como NO CONECTADOS
 * **cinco** guards perfectamente sanos: `ocultos.length`, `exportados.includes`, `bloques.length`,
 * `productos.length`, `exportados.length`. Un array SÍ tiene `.length` y `.includes`.
 *
 * O sea: el censo acusaba a guards buenos, que es la avería contraria y la que hace que un censo
 * se desactive en una tarde. Lo cazó leer su propia salida y comprobar caso por caso, no revisarlo.
 *
 * ⚠️ Se DERIVAN del prototipo, no se escriben a mano: una lista escrita envejece con el lenguaje
 * (SCRUM-199), y aquí el lenguaje es la fuente de verdad.
 */
export const DEL_ARRAY = new Set([
  ...Object.getOwnPropertyNames(Array.prototype),
  ...Object.getOwnPropertyNames(Object.prototype),
]);
export const DEL_OBJETO = new Set(Object.getOwnPropertyNames(Object.prototype));

/** Lo que hace de un `if` un GUARD: su cuerpo corta la ejecución. */
const CORTA = /process\.exit|assert\.|assert\(|\bfail\(/;

const arbolDe = (rel, txt) => ts.createSourceFile(rel, txt, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

/**
 * Las propiedades que una función puede devolver.
 *
 * Devuelve `null` cuando NO SE SABE LEER —y eso es un resultado, no un fallo—: con `null` el
 * censo se declara ciego sobre ese caso en vez de dictaminar. Es la diferencia entre «no produce
 * esa propiedad» y «no he podido mirar», que es literalmente el defecto que persigue.
 */
export function propiedadesQueDevuelve(fn, sf) {
  const props = new Set();
  let leible = false;
  let opaco = false;

  // Las variables locales, para poder seguir `const problemas = []; … return problemas;` — que es
  // exactamente cómo está escrito `comprobarSuelo`, y sin esto no se sabría que devuelve un array.
  const locales = new Map();
  const anotar = (n) => {
    if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer) {
      locales.set(n.name.text, n.initializer);
    }
    ts.forEachChild(n, anotar);
  };
  anotar(fn);

  const mirar = (e, saltos = 0) => {
    if (!e || saltos > 4) { opaco = true; return; }
    if (ts.isObjectLiteralExpression(e)) {
      leible = true;
      for (const p of e.properties) {
        if (p.name) props.add(p.name.getText(sf).replace(/['"`]/g, ''));
        // Un `...spread` mete propiedades que no se ven aquí: se declara opaco y NO se dictamina.
        if (ts.isSpreadAssignment(p)) opaco = true;
      }
      return;
    }
    if (ts.isArrayLiteralExpression(e)) { leible = true; return; }  // array: sin propiedades propias
    if (ts.isIdentifier(e) && locales.has(e.text)) { mirar(locales.get(e.text), saltos + 1); return; }
    if (ts.isParenthesizedExpression(e)) { mirar(e.expression, saltos + 1); return; }
    opaco = true;
  };

  const rec = (n) => {
    // No se entra en funciones anidadas: sus `return` son de ellas, no de ésta.
    if (n !== fn && (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n))) return;
    if (ts.isReturnStatement(n)) mirar(n.expression);
    ts.forEachChild(n, rec);
  };
  rec(fn);

  if (!leible || opaco) return null;
  return { props: [...props], devuelveArray: props.size === 0 };
}

/** Las funciones declaradas en un fuente, por nombre. Cubre `function f(){}` y `const f = () =>`. */
export function funcionesDe(sf) {
  const out = new Map();
  const rec = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) out.set(n.name.text, n);
    if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer
        && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) {
      out.set(n.name.text, n.initializer);
    }
    ts.forEachChild(n, rec);
  };
  rec(sf);
  return out;
}

/**
 * De qué fichero del repo viene cada nombre importado, y qué nombres vienen de FUERA.
 *
 * Sin esto, `censar` aparecía declarada en 17 ficheros distintos (medido el 6-sep-2026 en la
 * primera pasada) y el censo se declaraba ciego en todos ellos por ambigüedad. Resolviendo por el
 * `import` del propio fichero, la ambigüedad desaparece donde el código ya la había resuelto.
 */
export function importacionesDe(sf, rel) {
  const deRepo = new Map();   // nombre → ruta relativa del fichero que lo exporta
  const deFuera = new Map();  // nombre → especificador (`node:child_process`, `typescript`…)
  const dir = path.posix.dirname(rel.split(path.sep).join('/'));
  const rec = (n) => {
    if (ts.isImportDeclaration(n) && n.importClause && ts.isStringLiteralLike(n.moduleSpecifier)) {
      const spec = n.moduleSpecifier.text;
      const nombres = [];
      if (n.importClause.name) nombres.push(n.importClause.name.text);
      const b = n.importClause.namedBindings;
      if (b && ts.isNamedImports(b)) for (const el of b.elements) nombres.push(el.name.text);
      for (const nombre of nombres) {
        if (spec.startsWith('.')) deRepo.set(nombre, path.posix.normalize(path.posix.join(dir, spec)));
        else deFuera.set(nombre, spec);
      }
    }
    ts.forEachChild(n, rec);
  };
  rec(sf);
  return { deRepo, deFuera };
}

/** Lee los ficheros de la población. Lanza si un directorio no existe: ciego declarado, no vacío. */
export function ficherosDe(raiz, dirs = POBLACION) {
  const out = [];
  for (const dir of dirs) {
    const abs = path.join(raiz, dir);
    if (!fs.existsSync(abs)) throw new Error(`[censo-suelos] no existe ${dir}/ bajo ${raiz}`);
    for (const f of fs.readdirSync(abs)) {
      if (f.endsWith('.mjs')) out.push({ rel: `${dir}/${f}`, txt: fs.readFileSync(path.join(abs, f), 'utf8') });
    }
  }
  return out;
}

/**
 * EL CENSO. Recibe los ficheros ya leídos para que el guard pueda pasarle un corpus sintético —
 * y para que el control positivo no dependa del árbol de hoy.
 */
export function censar(ficheros) {
  // ── El índice de productores. Un nombre puede estar en varios ficheros; se guardan todos y si
  //    hay ambigüedad NO se dictamina, se declara ciego.
  const indice = new Map();
  for (const { rel, txt } of ficheros) {
    const sf = arbolDe(rel, txt);
    for (const [nombre, nodo] of funcionesDe(sf)) {
      if (!indice.has(nombre)) indice.set(nombre, []);
      indice.get(nombre).push({ rel, nodo, sf });
    }
  }

  const conectados = [];
  const noConectados = [];
  const ciegos = [];
  let guards = 0;

  for (const { rel, txt } of ficheros) {
    const sf = arbolDe(rel, txt);
    const { deRepo, deFuera } = importacionesDe(sf, rel);
    const propias = funcionesDe(sf);

    // variable → nombre de la función que la produjo
    const origen = new Map();
    // variable → expresión con la que se inicializó (para seguir un `const X = …; if (X) …`)
    const inicializador = new Map();
    const anotar = (n) => {
      if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer) {
        inicializador.set(n.name.text, n.initializer);
        if (ts.isCallExpression(n.initializer) && ts.isIdentifier(n.initializer.expression)) {
          origen.set(n.name.text, n.initializer.expression.text);
        }
      }
      ts.forEachChild(n, anotar);
    };
    anotar(sf);

    const corta = (nodo) => {
      let s = false;
      const r = (x) => {
        if (ts.isCallExpression(x) && CORTA.test(x.expression.getText(sf))) s = true;
        if (ts.isThrowStatement(x)) s = true;
        ts.forEachChild(x, r);
      };
      r(nodo);
      return s;
    };

    const rec = (n) => {
      if (ts.isIfStatement(n) && n.thenStatement && corta(n.thenStatement)) {
        const r = (x) => {
          if (ts.isPropertyAccessExpression(x) && ts.isIdentifier(x.expression)
              && origen.has(x.expression.text)) {
            guards += 1;
            const variable = x.expression.text;
            const prop = x.name.text;
            const fn = origen.get(variable);
            const linea = sf.getLineAndCharacterOfPosition(x.getStart(sf)).line + 1;
            const donde = `${rel}:${linea}`;

            // ── DE DÓNDE SALE EL PRODUCTOR, en este orden: el propio fichero → su `import`
            //    relativo → el índice global. Resolver por el `import` quita la ambigüedad donde
            //    el código ya la tenía resuelta: sin esto, `censar` salía «declarada en 17
            //    ficheros» y el censo se declaraba ciego en todos ellos.
            let cand = null;
            let porqueCiego = null;
            if (deFuera.has(fn)) {
              porqueCiego = `\`${fn}\` viene de \`${deFuera.get(fn)}\`, fuera de la población: `
                + 'no puedo leer qué devuelve';
            } else if (propias.has(fn)) {
              cand = { nodo: propias.get(fn), sf };
            } else if (deRepo.has(fn)) {
              const base = deRepo.get(fn);
              const enIndice = (indice.get(fn) || []).find((c) => c.rel.replace(/\.mjs$/, '') === base.replace(/\.mjs$/, ''));
              if (enIndice) cand = enIndice;
              else porqueCiego = `\`${fn}\` se importa de \`${base}\`, que no está en la población`;
            } else {
              const cands = indice.get(fn) || [];
              if (cands.length === 1) cand = cands[0];
              else if (cands.length === 0) porqueCiego = `no encuentro \`${fn}\` en la población`;
              else porqueCiego = `\`${fn}\` está declarada en ${cands.length} ficheros y este fuente no la importa: no sé cuál es`;
            }

            if (!cand) {
              ciegos.push({ donde, variable, prop, fn, porque: porqueCiego });
            } else {
              const info = propiedadesQueDevuelve(cand.nodo, cand.sf);
              if (!info) {
                ciegos.push({ donde, variable, prop, fn, porque: `no sé leer los \`return\` de \`${fn}\`` });
              } else {
                // 🔴 Las propiedades del LENGUAJE cuentan como producidas: un array tiene `.length`
                // aunque nadie se la ponga. Sin esto el censo acusaba a cinco guards sanos.
                const heredadas = info.devuelveArray ? DEL_ARRAY : DEL_OBJETO;
                if (info.props.includes(prop) || heredadas.has(prop)) {
                  conectados.push({ donde, variable, prop, fn });
                } else {
                  noConectados.push({
                    donde, variable, prop, fn,
                    devuelve: info.devuelveArray ? 'un ARRAY' : `{ ${info.props.join(', ')} }`,
                  });
                }
              }
            }
          }
          ts.forEachChild(x, r);
        };
        // 🔴 SE SIGUE UN SALTO DE VARIABLE BOOLEANA: `const noSeFia = a || b.c; if (noSeFia) …`.
        //
        // Sin esto el censo se quedaba ciego EXACTAMENTE en el fichero que lo originó: al sacar la
        // condición a una variable —que es lo que hace el arreglo de SCRUM-775— el guard dejaba de
        // verse, ni conectado ni roto: invisible. Y un censo que no ve el caso que lo motivó no
        // distingue «no hay» de «no supe mirar».
        //
        // UN salto y no más: seguir cadenas arbitrarias pediría análisis de flujo de verdad, y el
        // resto sale por NO SÉ LEER, que es un resultado honesto.
        const cond = n.expression;
        r(cond);
        if (ts.isIdentifier(cond) && inicializador.has(cond.text)) r(inicializador.get(cond.text));
      }
      ts.forEachChild(n, rec);
    };
    rec(sf);
  }

  return { ficheros: ficheros.length, guards, conectados, noConectados, ciegos };
}

/**
 * 🔴 EL SUELO DEL CENSO. Un cero sobre población vacía no es un cero.
 *
 * Si no se han leído ficheros, o no se ha encontrado NI UN guard de esta forma en todo el árbol,
 * este censo no dice «no hay suelos rotos»: dice que no ha medido.
 */
export function motivosParaNoFiarse(censo, { minimoFicheros = 50 } = {}) {
  const motivos = [];
  if (censo.ficheros < minimoFicheros) {
    motivos.push(`sólo se han leído ${censo.ficheros} ficheros de ${POBLACION.join('/ y ')}/: `
      + 'el barrido no está llegando al árbol');
  }
  if (censo.guards === 0) {
    motivos.push('CERO guards con la forma que este censo mide. Eso no dice «no hay suelos '
      + 'rotos»: dice que el detector no ha reconocido ni uno, y entonces su cero no significa nada');
  }
  return motivos;
}
