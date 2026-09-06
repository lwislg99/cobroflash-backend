#!/usr/bin/env node
// scripts/meta-guard-mutaciones.mjs — SCRUM-745
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿PUEDE CADA GUARD DECLARAR LA MUTACIÓN QUE LO HACE CAER, Y ALGUIEN EJECUTARLAS?
//
// La pregunta nació de tres trinquetes escritos el mismo día que nacieron MUDOS: comparaban por
// TEXTO (`src.includes('nombreDeFuncion')`) en vez de por identidad, así que seguían VERDES sobre
// el defecto que venían a vigilar — el `import` y el comentario que explica la regla mantienen la
// palabra viva en el fichero aunque la llamada haya desaparecido.
//
// 🔴 Y LO IMPORTANTE: a los tres los encontró lo mismo, y no fue una revisión. Se leen
// perfectamente bien. Los encontró INYECTAR EL DEFECTO Y EXIGIR VER EL ROJO. Eso hoy depende de
// que a alguien se le ocurra hacerlo. Esto lo mecaniza.
//
// ── EN QUÉ SE DIFERENCIA DE SCRUM-719 (`censo:mudez`), que ya existe ─────────────────────────
// Aquél aplica UNA mutación uniforme —vaciar `soloEjecutable`— a los guards que llaman a ese
// filtro, y mide ceguera ante un fuente VACÍO. Medido: los guards de SCRUM-740 y SCRUM-741 no
// llaman al filtro, así que para su censo son «NO APLICA»: invisibles.
//
// Y el defecto es otro: el de aquí sobrevive con el fichero LLENO. Vaciar el fuente pondría
// rojos a estos guards (dirían «no encuentro»), o sea que saldrían VIVOS y sanos. Por eso hace
// falta una mutación POR GUARD: la única que caza a un guard es la que imita exactamente el
// defecto que ese guard promete cazar.
//
// ── EL CONTRATO ─────────────────────────────────────────────────────────────────────────────
// Un guard declara, en su propio fichero:
//
//     export const MUTACIONES_QUE_ME_TUMBAN = [
//       { fichero: 'tests/x.test.mjs', de: '<texto exacto>', a: '<texto exacto>',
//         cae: '<nombre del test que TIENE que ponerse rojo>' },
//     ];
//
// Vive junto al guard a propósito: un registro central se queda atrás en cuanto alguien mueve un
// guard, y lo que no vive al lado no se actualiza.
//
// 🔴 SE LEE POR AST, SIN IMPORTAR EL FICHERO. Importarlo ejecutaría sus tests, y un meta-guard
// que ejecuta lo que va a mutar se mete en su propia carrera.
//
// ⛔ LA MUTACIÓN NUNCA SE COMMITEA: se restaura en un `finally` y se VERIFICA byte a byte contra
// los bytes originales de disco. Si no cuadra, se sale con código 3 gritándolo. Es la disciplina
// de `censo-mudez.mjs` (SCRUM-719) y la de SCRUM-570: el árbitro son los bytes de disco, no el
// blob de git — un fichero normalizado tiene el blob limpio con CR en la copia de trabajo.
//
// SALIDAS: 0 todo vivo · 1 algún guard NO cayó (es mudo) · 2 no supe medir (ciego) · 3 no pude
// restaurar un fichero (grave: hay que mirar el árbol a mano).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // SCRUM-730: `pathname` no decodifica
import { run } from 'node:test'; // SCRUM-745 (adopción): eventos, no reporter
import ts from 'typescript';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs'; // SCRUM-765
import { correspondencia, destinoEnDist, emitirDesdeFuente } from './frontera-dist.mjs'; // SCRUM-763

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_TESTS = path.join(RAIZ, 'tests');

export const SALIDA_MUDO = 1;
export const SALIDA_CIEGO = 2;
export const SALIDA_NO_RESTAURADO = 3;

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SCRUM-765 · LOS DOS SUELOS, Y POR QUÉ HACEN FALTA LOS DOS.
 *
 * Este instrumento le exige a todos los censos de la casa que un CERO se distinga de un «no supe
 * mirar», y no se lo exigía a sí mismo. Se cerró por los dos sitios por los que se puede llegar
 * a cero sin enterarse:
 *
 * ① `SUELO_DECLARACIONES` / `SUELO_GUARDS` — un `MUTACIONES_QUE_ME_TUMBAN` **borrado entero**
 *    saca al guard del censo, y el censo no sabía cuántos debería haber: el recuento bajaba de
 *    N a N-1 y el job seguía verde. La declaración COJA ya se denunciaba desde SCRUM-745; la
 *    BORRADA no. Es el hueco hermano, y sin suelo no hay forma de verlo.
 *
 * ② El suelo de EJECUCIÓN, abajo en el bloque principal: si al final no se ha ejecutado ni una
 *    mutación, se sale CIEGO. Sin él, la puerta rota de SCRUM-765 daba exit 0 en 0,28 s.
 *
 * SON NÚMEROS QUE SÓLO SUBEN. Se suben al adoptar el mecanismo en un guard nuevo; bajarlos es
 * retirar cobertura, y entonces el diff lo tiene que decir en voz alta. Medido en el árbol del
 * 6-sep-2026 (rama scrum-765-763, tras mezclar main por tercera vez): 20 guards · 54 declaraciones.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export const SUELO_GUARDS = 20;
export const SUELO_DECLARACIONES = 54;

/**
 * SUELO ① · ¿ha encogido el censo? Devuelve el motivo, o `null` si el suelo aguanta.
 *
 * Vive FUERA del bloque principal a propósito: un suelo que sólo existe dentro del `if` de
 * arranque no se le puede exigir el rojo sin pagar los minutos del trabajo entero, y un guard al
 * que no se le ha visto caer es una decoración.
 */
export function sueloDelCenso({ guards, declaraciones }) {
  if (guards >= SUELO_GUARDS && declaraciones >= SUELO_DECLARACIONES) return null;
  return `EL CENSO HA ENCOGIDO: ${guards} guards y ${declaraciones} declaraciones, y el suelo es `
    + `${SUELO_GUARDS} y ${SUELO_DECLARACIONES}.\n`
    + '  Un `MUTACIONES_QUE_ME_TUMBAN` borrado entero saca a su guard del censo sin que nada lo '
    + 'diga: el recuento baja y el verde de al lado se lee igual.\n'
    + '  Si la cobertura se ha retirado A PROPÓSITO, baja el suelo EN EL MISMO COMMIT y que el '
    + 'diff lo diga en voz alta.';
}

/**
 * SUELO ② · ¿se ha ejecutado algo? Devuelve el motivo, o `null` si sí.
 *
 * EJECUTADAS = VIVAS + MUDAS. Las CIEGAS se descartaron ANTES de tocar el árbol, así que no
 * cuentan como trabajo hecho: contarlas convertiría «no supe medir» en «he medido».
 */
export function sueloDeEjecucion({ vivas, mudas }) {
  if (vivas + mudas > 0) return null;
  return 'NO SE HA EJECUTADO NI UNA MUTACIÓN. Este exit no dice que los guards estén vivos: '
    + 'dice que no he medido nada. Mira las ciegas de arriba.';
}

/**
 * Lee las mutaciones declaradas en un fichero, POR AST y sin ejecutarlo.
 *
 * Devuelve `[]` si no declara ninguna — no es un error: la mayoría de los guards todavía no lo
 * hacen, y este mecanismo se adopta guard a guard.
 */
export function lecturaDeDeclaraciones(codigo, nombre = 'x.mjs') {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const buenas = [];
  const incompletas = [];
  const textoDe = (nodo) => (ts.isStringLiteralLike(nodo) ? nodo.text : null);

  const v = (n) => {
    if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name)
        && n.name.text === 'MUTACIONES_QUE_ME_TUMBAN' && n.initializer
        && ts.isArrayLiteralExpression(n.initializer)) {
      for (const el of n.initializer.elements) {
        if (!ts.isObjectLiteralExpression(el)) continue;
        const m = {};
        for (const p of el.properties) {
          if (!ts.isPropertyAssignment(p) || !p.name) continue;
          const clave = p.name.getText(sf).replace(/['"]/g, '');
          const valor = textoDe(p.initializer);
          if (valor !== null) m[clave] = valor;
        }
        if (m.fichero && m.de && typeof m.a === 'string' && m.cae) buenas.push(m);
        // 🔴 LA QUE SE CAE POR EL AGUJERO. Antes se descartaba con un `continue` mudo, y el
        // recuento del job bajaba de N a N-1 sin que nada lo dijera: una declaración a la que le
        // falta un campo DESAPARECE, y el verde de al lado se lee como si siguiera cubriendo.
        else incompletas.push({ faltan: ['fichero', 'de', 'a', 'cae'].filter((k) => typeof m[k] !== 'string'), tiene: m });
      }
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return { buenas, incompletas };
}

/**
 * Las declaraciones COMPLETAS de un fichero. Se deriva de `lecturaDeDeclaraciones` en vez de
 * repetir el recorrido: dos recorridos del mismo AST son dos cosas que se quedan atrás por
 * separado.
 */
export function mutacionesDeclaradas(codigo, nombre = 'x.mjs') {
  return lecturaDeDeclaraciones(codigo, nombre).buenas;
}

/** Todos los guards que declaran mutaciones, con las suyas. */
export function censoDeDeclaraciones(dir = DIR_TESTS) {
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.test.mjs'))) {
    const { buenas, incompletas } = lecturaDeDeclaraciones(fs.readFileSync(path.join(dir, f), 'utf8'), f);
    if (buenas.length || incompletas.length) out.push({ guard: f, mutaciones: buenas, incompletas });
  }
  return out;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SCRUM-745 (adopción) · POR QUÉ AQUÍ YA NO SE LEE NINGÚN REPORTER.
 *
 * Hasta hoy los dos lectores parseaban la salida del reporter `spec` —buscaban `✔` y `✖` al
 * principio de la línea—, y eso los dejaba COLGANDO DEL MISMO CLAVO: el día que alguien cambiara
 * `--test-reporter` en `correr()`, **el vigilante y su control se quedaban ciegos a la vez**. Un
 * detector y su control compartiendo punto de fallo es el defecto de SCRUM-742 metido dentro de
 * la propia herramienta que lo persigue.
 *
 * ⛔ NO SE ARREGLA VIGILANDO LA CONSTANTE DEL REPORTER. Eso es duplicar el dato y ponerle un
 * guard encima —el escalón 3—, y el escalón manda: primero, hacerlo IMPOSIBLE. Aquí se podía, y
 * está medido: `run()` de `node:test` entrega eventos `test:pass` / `test:fail` con el nombre del
 * test dentro. Sin reporter no hay reporter que cambiar, y no hay glifo que se pueda mover.
 *
 * ── LO QUE SE MIDIÓ ANTES DE ESCRIBIRLO, PROVOCANDO EL CASO EN VEZ DE PREDECIRLO (regla 13) ──
 * Un fichero que MUERE AL CARGAR emite **exactamente un** `test:fail`, y su `name` es la RUTA DEL
 * FICHERO, jamás el nombre de un test. O sea que sobre un fichero muerto los dos lectores dicen
 * NO — que es justo la conjunción de la que SCRUM-748 hizo nacer el veredicto CIEGO. La
 * discriminación de los tres estados no sólo sobrevive al cambio: pasa de casar TEXTO a casar
 * DATO.
 *
 * El `nombre` sigue siendo un FRAGMENTO del nombre del test —así están escritas las declaraciones
 * del árbol—, no el nombre entero.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** ¿El test `nombre` aparece como FALLIDO en este resultado? */
export function cayo(resultado, nombre) {
  return (resultado?.caidos || []).some((n) => n.includes(nombre));
}

/** ¿El test `nombre` aparece como PASADO en este resultado? */
export function paso(resultado, nombre) {
  return (resultado?.pasados || []).some((n) => n.includes(nombre));
}

/**
 * 🔴 SCRUM-748 · LA LÍNEA BASE, Y POR QUÉ NO SE RECONOCE EL MENSAJE DE ERROR.
 *
 * Este meta-guard llamaba MUDO a todo lo que no caía, y eso metía por la misma puerta dos cosas
 * distintas: **«el guard no cayó»** y **«el guard no llegó a ejecutarse»**.
 *
 * Pasó en CI con `scrum748`. Su fichero llama a `cargarDashboard` en el top level, y el job no
 * compilaba, así que `_banco-vistas.mjs` no encontraba `dist/` y **el fichero entero moría antes
 * de registrar un solo test**. La línea `✖ <nombre>` nunca se imprimía, este script no la
 * encontraba, y dictaba MUDO sobre un guard que **con `dist/` presente cae con las dos
 * mutaciones**. El guard nunca estuvo mudo: mintió el rótulo.
 *
 * ⛔ Y NO SE ARREGLA RECONOCIENDO `Cannot find module` ni ninguna otra cadena de fallo. Un
 * detector que reconoce mensajes sólo sabe decir que no a lo que le enseñaron — es la lista negra
 * de siempre, y caduca con el primer fallo que nadie previó.
 *
 * SE ARREGLA POR LÍNEA BASE: antes de mutar nada se corre el fichero LIMPIO. Si el test que la
 * declaración nombra no aparece **en verde** ahí, no hay nada que juzgar y **ni siquiera se muta**:
 * es CIEGO. Los tres estados quedan separados por construcción y no porque alguien acierte un
 * texto.
 *
 * Y de propina cierra un caso que antes no se veía: una declaración que nombra un test
 * **renombrado o borrado** salía MUDA —acusaba al guard— y ahora sale CIEGA, que es lo que es.
 */
export async function correr(guard) {
  const pasados = [];
  const caidos = [];
  const flujo = run({
    files: [path.join(DIR_TESTS, guard)],
    cwd: RAIZ,
    forceExit: true,
    timeout: 300000,
  });
  // ⚠️ EL FLUJO HAY QUE CONSUMIRLO. Con sólo suscribirse a `test:pass` no arranca: salen CERO
  // eventos y estado 0, que es un «no hay» indistinguible de un «no supe mirar». Cazado al
  // medir esto, y por eso la sonda llevaba control positivo.
  for await (const ev of flujo) {
    if (ev.type === 'test:pass') pasados.push(ev.data.name);
    else if (ev.type === 'test:fail') caidos.push(ev.data.name);
  }
  return { pasados, caidos };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * EL ALCANCE DEL AGUJERO: ¿cuántas declaraciones tienen un test que EJECUTA `dist/`?
 *
 * No es la misma pregunta que «¿cuántas mutan un `.ts`?» (eso lo contesta
 * `censoDeExposicionATypeScript`). Una declaración puede mutar un `.ts` y que su test lea el
 * FUENTE —buscar una forma en el `.ts` por AST o por texto—, y entonces la frontera `src/`↔`dist/`
 * no la toca. La expuesta de verdad es aquella cuyo test **importa de `dist/`**: sin emitir el
 * `.js`, esa mutación no llega al código que se ejecuta y el guard sale MUDO sin serlo.
 *
 * 🔴 SE MIRA SOBRE EL CÓDIGO, NO SOBRE EL FICHERO ENTERO. `dist/` aparece en comentarios por todo
 * el árbol —este mismo párrafo lo escribe cuatro veces—, y el AST no ve comentarios.
 * Y se sigue la cadena de helpers: `scrum641` no nombra `dist/`, pero importa `_banco-vistas.mjs`,
 * que sí. Un censo que no siguiera esa flecha diría «no lee dist» de un fichero que muere sin él.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const arbolDe = (codigo, nombre) =>
  ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

/**
 * ¿Este código nombra `dist/` en alguna CADENA suya?
 *
 * 🔴 POR AST Y SOBRE LITERALES, no por `grep`. Los comentarios del árbol escriben `dist/` a
 * puñados —este fichero el primero— y el AST no los ve. Cubre las dos formas reales:
 * `'../dist/x.js'` (el import) y `path.join(RAIZ, 'dist', …)` (la ruta montada a trozos).
 */
export function leeDistEnTexto(codigo, nombre = 'x.mjs') {
  const sf = arbolDe(codigo, nombre);
  let visto = false;

  /** ¿Es este literal un TROZO DE RUTA, o sólo una palabra? Lo dice quién lo usa. */
  const esTrozoDeRuta = (n) => {
    const padre = n.parent;
    if (!padre || !ts.isCallExpression(padre)) return false;
    const f = padre.expression;
    const nombreLlamada = ts.isPropertyAccessExpression(f) ? f.name.text
      : (ts.isIdentifier(f) ? f.text : '');
    return nombreLlamada === 'join' || nombreLlamada === 'resolve';
  };

  const v = (n) => {
    if (ts.isStringLiteralLike(n)) {
      // ① `'../dist/x.js'` — el import, que no admite otra lectura.
      if (/(^|[^\w.])(\.\.\/)?dist\//.test(n.text)) visto = true;
      // ② `path.join(RAIZ, 'dist', …)` — la ruta montada a trozos.
      //
      // 🔴 UN `'dist'` A SECAS NO BASTA, Y ESTO ESTÁ MEDIDO. En `tests/` hay 43 literales `'dist'`
      // y tienen DOS significados opuestos: la mayoría EXCLUYE el directorio de un barrido
      // (`SKIP_DIRS`, `if (e.name === 'dist') continue`) y el resto CONSTRUYE la ruta para
      // importarlo (`pathToFileURL(path.join(RAIZ, 'dist'))`). Contar los dos igual metió a
      // `scrum751` entre los lectores de `dist/` cuando su helper hace justo lo contrario:
      // saltárselo. Los distingue QUIÉN LOS USA, no el literal.
      else if (n.text === 'dist' && esTrozoDeRuta(n)) visto = true;
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return visto;
}

/**
 * Especificadores `./x.mjs` que este código IMPORTA de verdad — estático o dinámico.
 *
 * 🔴 TIENE QUE SER AST. La primera versión casaba cualquier literal `'./algo.mjs'` y se comió un
 * DATO: `scrum740-carrera-por-el-arbol.test.mjs` lleva `'./x.mjs'` como nombre de fichero de
 * mentira para su banco de pruebas, el censo intentó abrirlo y se declaró CIEGO con un ENOENT.
 * Se declaró ciego —que es lo correcto— pero por un defecto suyo, no del árbol.
 */
export function importsHermanos(codigo, nombre = 'x.mjs') {
  const sf = arbolDe(codigo, nombre);
  const out = [];
  const v = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteralLike(n.moduleSpecifier)) {
      out.push(n.moduleSpecifier.text);
    } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword
        && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) {
      out.push(n.arguments[0].text);
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return out.filter((s) => s.startsWith('./') && s.endsWith('.mjs'));
}

/**
 * ¿Este guard llega a `dist/`, por sí mismo o por un helper suyo? Devuelve el CAMINO, para que el
 * censo diga POR DÓNDE y no sólo que sí.
 */
export function rastroDeDist(nombre, dir = DIR_TESTS, vistos = new Set()) {
  if (vistos.has(nombre)) return { lee: false, por: null };
  vistos.add(nombre);
  const codigo = fs.readFileSync(path.join(dir, nombre), 'utf8'); // si no se puede leer, revienta
  if (leeDistEnTexto(codigo)) return { lee: true, por: nombre };
  for (const esp of importsHermanos(codigo)) {
    const r = rastroDeDist(path.basename(esp), dir, vistos);
    if (r.lee) return { lee: true, por: `${nombre} → ${r.por}` };
  }
  return { lee: false, por: null };
}

/** El censo, con su población delante y sus ilegibles aparte: un cero suyo tiene que ser legible. */
export function censoDeLectoresDeDist(dir = DIR_TESTS) {
  const leen = [];
  const noLeen = [];
  const noLegibles = [];
  for (const { guard, mutaciones } of censoDeDeclaraciones(dir)) {
    if (!mutaciones.length) continue;
    let r;
    try {
      r = rastroDeDist(guard, dir);
    } catch (e) {
      // 🔴 NO se cuenta como «no lee dist»: eso convertiría un fallo de lectura en un dato.
      noLegibles.push({ guard, porque: e.message });
      continue;
    }
    for (const m of mutaciones) (r.lee ? leen : noLeen).push({ guard, fichero: m.fichero, cae: m.cae, por: r.por });
  }
  return { poblacion: leen.length + noLeen.length, leen, noLeen, noLegibles };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 QUÉ HAY QUE DEVOLVER AL ÁRBOL DESPUÉS DE UNA MUTACIÓN — y por qué son DOS piezas.
 *
 * Restaurar el fuente NO es restaurar el árbol (SCRUM-763). Si el fichero mutado se compila, el
 * código que ejecutan los tests es su `.js` de `dist/`, y ése no lo devuelve ninguna restauración
 * del fuente: `Buffer.compare` sobre el fuente da 0 sobre un árbol que sigue mutado.
 *
 * Vive FUERA de `aplicarUna` para que se le pueda exigir el rojo sin fabricar un `src/` de
 * mentira: la pieza de `dist` se puede pedir, contar y provocar desde un test. Estaba EJERCITADA
 * por las declaraciones sobre TypeScript, y ejercitada no es vigilada.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function piezasARestaurar({ fichero, abs, ORIGINAL, destino, absDist, ORIGINAL_DIST }) {
  const piezas = [{ ruta: fichero, abs, ORIGINAL }];
  // Sólo hay segunda pieza si el fichero se COMPILA. Para un `.mjs` no hay árbol ejecutable
  // detrás, y pedir uno encarecería todas las mutaciones de la casa por un caso que no aplica.
  if (absDist && ORIGINAL_DIST) piezas.push({ ruta: destino, abs: absDist, ORIGINAL: ORIGINAL_DIST });
  return piezas;
}

/**
 * Devuelve cada pieza a sus BYTES originales y lo VERIFICA leyendo el disco otra vez. Devuelve la
 * lista de las que no cuadraron — vacía si todo volvió a su sitio.
 *
 * No traga fallos de escritura: si una pieza no se puede escribir, revienta. Un restaurador que
 * devuelve «todo bien» porque no pudo ni intentarlo es peor que no tenerlo.
 */
export function restaurarYVerificar(piezas) {
  const sinRestaurar = [];
  for (const p of piezas) {
    fs.writeFileSync(p.abs, p.ORIGINAL);
    if (Buffer.compare(fs.readFileSync(p.abs), p.ORIGINAL) !== 0) sinRestaurar.push(p.ruta);
  }
  return sinRestaurar;
}

export async function aplicarUna(mut, guard, limpia) {
  const abs = path.join(RAIZ, mut.fichero);
  if (!fs.existsSync(abs)) return { ok: false, ciego: `el fichero \`${mut.fichero}\` no existe` };

  // 🔴 PUERTA 1 · ¿EXISTE EN VERDE LO QUE VAMOS A JUZGAR? Si el test que la declaración nombra no
  // pasó en la pasada limpia —porque el fichero no cargó, porque está renombrado, porque ya
  // fallaba— no hay nada que juzgar sobre él, y NI SIQUIERA SE MUTA.
  if (!paso(limpia, mut.cae)) {
    return {
      ok: false,
      ciego: `el test «${mut.cae}» NO aparece EN VERDE en la pasada limpia, así que no se ha `
        + 'mutado nada. O el fichero no llegó a ejecutarse (una dependencia que falta: '
        + '`dist/` sin compilar, por ejemplo), o ese test ya fallaba, o el nombre de la '
        + 'declaración caducó. NO es que el guard esté mudo: es que no se ha podido medir.',
    };
  }

  const ORIGINAL = fs.readFileSync(abs); // los BYTES de disco (SCRUM-570), no el blob
  const texto = ORIGINAL.toString('utf8');
  if (!texto.includes(mut.de)) {
    return { ok: false, ciego: `el ancla no está en \`${mut.fichero}\`: la declaración caducó` };
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 PUERTA 2 (SCRUM-763) · ¿HAY UN ÁRBOL EJECUTABLE DETRÁS DE ESTE FUENTE?
  //
  // Si el fichero se compila, el código que corren los tests NO es éste: es su `.js` de `dist/`.
  // Mutar sólo el fuente dejaría al guard midiendo el árbol de antes, y este instrumento
  // dictaría MUDO sobre un guard sano — la misma falsa acusación de SCRUM-748, por la otra cara.
  // Y restaurar sólo el fuente dejaría `dist/` mutado para todo lo que venga detrás, que es
  // exactamente lo que casi hizo publicar a S1 la conclusión contraria a la real.
  //
  // Antes de tocar nada se exige que `dist/` YA corresponda al fuente. Si no corresponde, no se
  // muta: no hay nada que juzgar sobre un árbol que no es el que está escrito. Es CIEGO, y con
  // el motivo delante en vez de un rojo que acusaría al guard equivocado.
  //
  // ✅ CONTRASTE: para un `.mjs`, `destinoEnDist` devuelve `null` y todo esto no cuesta nada.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  const destino = destinoEnDist(mut.fichero, RAIZ);
  const absDist = destino ? path.join(RAIZ, destino) : null;
  let ORIGINAL_DIST = null;
  if (absDist) {
    const corr = correspondencia(mut.fichero, RAIZ, texto);
    if (corr.estado !== 'corresponde') {
      return {
        ok: false,
        ciego: `\`${mut.fichero}\` se compila a \`${destino}\`, y el árbol ejecutable NO `
          + `corresponde al fuente (${corr.estado}). Los tests de este guard medirían un código `
          + 'que no es el que hay escrito, así que NO se ha mutado nada. Compila '
          + '(`npm run build`) y vuelve a correrme; `npm run frontera:dist` lo enseña entero.',
      };
    }
    ORIGINAL_DIST = fs.readFileSync(absDist);
  }

  let resultado;
  try {
    const mutado = texto.replace(mut.de, mut.a);
    fs.writeFileSync(abs, mutado);
    if (Buffer.compare(fs.readFileSync(abs), ORIGINAL) === 0) {
      return { ok: false, ciego: 'la mutación no cambió el fichero: no probaría nada' };
    }
    // El árbol ejecutable tiene que llevar la mutación TAMBIÉN, o el guard mide el de antes.
    if (absDist) fs.writeFileSync(absDist, emitirDesdeFuente(abs, mutado, RAIZ));
    const tras = await correr(guard);
    resultado = cayo(tras, mut.cae)
      ? { ok: true }
      : { ok: false, mudo: `el guard NO cayó. Test que debía ponerse rojo: «${mut.cae}»` };
  } finally {
    const sinRestaurar = restaurarYVerificar(
      piezasARestaurar({ fichero: mut.fichero, abs, ORIGINAL, destino, absDist, ORIGINAL_DIST }));
    if (sinRestaurar.length) {
      console.error(`🔴🔴 NO PUDE RESTAURAR \`${sinRestaurar.join('` y `')}\`. `
        + 'MÍRALO A MANO ANTES DE SEGUIR.');
      process.exit(SALIDA_NO_RESTAURADO);
    }
  }
  return resultado;
}

/**
 * ¿Qué declaraciones del árbol tocan código COMPILADO, y por tanto viven sobre la frontera de
 * SCRUM-763? Lleva su población delante: sin ella, un «0 expuestas» no se distingue de un censo
 * que no encontró nada que mirar.
 */
export function censoDeExposicionATypeScript(dir = DIR_TESTS, raiz = RAIZ) {
  const expuestas = [];
  const noExpuestas = [];
  for (const { guard, mutaciones } of censoDeDeclaraciones(dir)) {
    for (const m of mutaciones) {
      const destino = destinoEnDist(m.fichero, raiz);
      (destino ? expuestas : noExpuestas).push({ guard, fichero: m.fichero, destino });
    }
  }
  return { poblacion: expuestas.length + noExpuestas.length, expuestas, noExpuestas };
}

// 🔴 SCRUM-765 · LA PUERTA. Antes comparaba `import.meta.url` con `'file://' + argv[1]`, que en
// Windows NUNCA casa, y arrancaba SÓLO por el respaldo `endsWith('meta-guard-mutaciones.mjs')`.
// El respaldo comparaba por NOMBRE DE FICHERO: una copia renombrada salía exit 0 en 0,28 s sin
// ejecutar una sola mutación. El respaldo se ha ido con la avería — era lo que la tapaba.
if (ejecutadoDirectamente(import.meta.url)) {
  // `--solo-censo` abre esta misma puerta y aplica los suelos del censo SIN mutar nada. Existe
  // para que se pueda comprobar en un segundo que la puerta abre, en vez de tener que esperar
  // los ~76 s del trabajo entero. NO es el modo del CI: `npm run meta:mutaciones` no lo pasa.
  const soloCenso = process.argv.includes('--solo-censo');
  const censo = censoDeDeclaraciones();

  // ── SUELO ① · EL TAMAÑO DEL CENSO ─────────────────────────────────────────────────────────
  const declaraciones = censo.reduce((n, c) => n + c.mutaciones.length, 0);
  const guardsConDeclaracion = censo.filter((c) => c.mutaciones.length).length;
  const encogido = sueloDelCenso({ guards: guardsConDeclaracion, declaraciones });
  if (encogido) {
    console.error(`🔴 CIEGO · ${encogido}`);
    process.exit(SALIDA_CIEGO);
  }
  if (soloCenso) {
    const expo = censoDeExposicionATypeScript(); // `expo`, no `ts`: `ts` es el compilador de arriba
    console.log(`censo · ${guardsConDeclaracion} guards · ${declaraciones} declaraciones `
      + `(suelos ${SUELO_GUARDS} / ${SUELO_DECLARACIONES})`);
    console.log(`  sobre la frontera src/ ↔ dist/ (SCRUM-763): ${expo.expuestas.length} de ${expo.poblacion}`);
    for (const e of expo.expuestas) console.log(`    · ${e.guard} → ${e.fichero}`);
    console.log('\n⚠️ MODO CENSO: NO se ha ejecutado ninguna mutación.');
    process.exit(0);
  }

  const mudos = [];
  const ciegos = [];
  let vivas = 0;
  for (const { guard, mutaciones, incompletas } of censo) {
    // 🔴 UNA DECLARACIÓN A LA QUE LE FALTA UN CAMPO NO ES UNA DECLARACIÓN MENOS: ES UN HUECO.
    // Se descartaba en silencio y el recuento bajaba sin que nadie lo dijera — «parece cobertura»,
    // que es el defecto que este mecanismo entero vino a cerrar. Provocado el 5-sep-2026 al perder
    // yo mismo la línea `fichero:` de una declaración en una edición: el job siguió verde.
    for (const inc of incompletas || []) {
      ciegos.push(`${guard} · una declaración está INCOMPLETA (le faltan: ${inc.faltan.join(', ')}) `
        + `y por eso no se ha ejecutado. Media declaración es peor que ninguna: parece cobertura.`);
      console.log(`  ? ${guard} · CIEGO (declaración incompleta)`);
    }
    if (!mutaciones.length) continue;
    // La línea base se corre UNA VEZ por guard, no por mutación: es la misma pasada limpia para
    // todas las suyas y duplicarla sólo costaría reloj.
    const limpia = await correr(guard);
    for (const mut of mutaciones) {
      const r = await aplicarUna(mut, guard, limpia);
      if (r.ok) { vivas += 1; console.log(`  ✔ ${guard} · ${mut.cae}`); }
      else if (r.mudo) { mudos.push(`${guard} · ${r.mudo}`); console.log(`  ✖ ${guard} · MUDO`); }
      else { ciegos.push(`${guard} · ${r.ciego}`); console.log(`  ? ${guard} · CIEGO`); }
    }
  }
  console.log(`\nvivas ${vivas} · mudas ${mudos.length} · ciegas ${ciegos.length}`);

  // ── SUELO ② · LA EJECUCIÓN (SCRUM-765) ────────────────────────────────────────────────────
  // 🔴 EJECUTADAS = las que llegaron a mutar el árbol: las VIVAS y las MUDAS. Las CIEGAS se
  // descartaron ANTES de tocar nada, así que no cuentan como trabajo hecho.
  //
  // Sin este suelo, cualquier camino que llegue al final sin haber mutado nada sale con 0, y un
  // exit 0 de este script es lo que sostiene el requisito de entrega de toda la casa. Es la
  // misma medicina que este instrumento le exige a los demás censos, y no se la aplicaba.
  const sinMedir = sueloDeEjecucion({ vivas, mudas: mudos.length });
  if (sinMedir) {
    console.error(`🔴 CIEGO: ${sinMedir}`);
    process.exit(SALIDA_CIEGO);
  }

  if (ciegos.length) console.error('🔴 CIEGO:\n  · ' + ciegos.join('\n  · '));
  if (mudos.length) {
    console.error('🔴 GUARDS MUDOS — pasan en verde sobre el defecto que dicen vigilar:\n  · '
      + mudos.join('\n  · '));
    process.exit(SALIDA_MUDO);
  }
  if (ciegos.length) process.exit(SALIDA_CIEGO);
}
