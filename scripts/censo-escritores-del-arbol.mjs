// scripts/censo-escritores-del-arbol.mjs — SCRUM-808
//
//   npm run censo:escritores-arbol
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿QUÉ SCRIPTS DE LA CASA ESCRIBEN DENTRO DEL ÁRBOL, Y CUÁLES SE LO PUEDEN DEJAR ESCRITO?
//
// `meta-guard-mutaciones` muta un fichero del árbol y lo devuelve en un `finally`. **Una
// terminación no ejecuta ese `finally`**: se mata la pasada y el fichero mutado se queda dentro.
// Ocurrió DOS VECES el 6-sep-2026, a dos sesiones distintas, y las dos se cazó porque alguien
// miró `git status` por su cuenta.
//
// La pregunta que queda es si el patrón está en más sitios. Este censo la contesta **sin lista
// cableada**: la población son los `.mjs` que hay en el árbol, y la evidencia es el AST de cada
// uno. Una lista escrita a mano envejece y convertiría esto en «cuento lo que escribí».
//
// ── QUÉ CUENTA COMO «ESCRIBE DENTRO DEL ÁRBOL» ──────────────────────────────────────────────
// Una llamada a una API de `fs` que MODIFICA o BORRA, cuyo primer argumento apunta a una ruta
// derivada de la RAÍZ del repositorio. La raíz se reconoce por cómo la escribe la casa
// (`fileURLToPath(import.meta.url)` / `import.meta.dirname` + `..`), no por el nombre de la
// variable: hay `RAIZ`, `REPO` y `ROOT` en el árbol.
//
// 🔴 SE RESUELVE UN NIVEL DE INDIRECCIÓN, y está medido por qué: `meta-guard-mutaciones` escribe
// `fs.writeFileSync(abs, mutado)` con `const abs = path.join(RAIZ, mut.fichero)`. Mirando sólo el
// argumento, el escritor MÁS PELIGROSO DE LA CASA no habría salido en su propio censo.
//
// ⚠️ Y UN NIVEL ES EL LÍMITE, declarado: una ruta que pase por dos variables, por un parámetro o
// por un `map` NO se ve. Eso NO se cuenta como «no escribe»: sale en `NO CONCLUYENTES`, con la
// llamada delante, para que se mire a mano. Un cero por no haber sabido mirar es la peor cifra.
//
// ── Y LA SEGUNDA COLUMNA: ¿SE PUEDE QUEDAR ESCRITO? ─────────────────────────────────────────
// De los escritores, los que importan son los que **escriben y pretenden deshacerlo**: ésos son
// los que dejan el árbol sucio si mueren. Se detecta el `try`/`finally`. Y se dice cuáles llevan
// ya la red de SCRUM-808 (marca en disco + reparación en el arranque).
//
// SALIDAS: 0 censo completo · 2 no supe medir (población vacía, o el control positivo cae).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIRS = ['scripts', 'tests'];
/** Suelo de la población: hoy son más de 200 `.mjs`; nadie borra la mitad del instrumental. */
export const MINIMO_POBLACION = 60;
/** El control positivo: el escritor que originó el ticket TIENE que salir. */
export const CONTROL_POSITIVO = 'scripts/meta-guard-mutaciones.mjs';

/** Las APIs de `fs` que MODIFICAN o BORRAN. Leer no ensucia nada y no entra. */
export const APIS_QUE_ESCRIBEN = new Set([
  'writeFileSync', 'writeFile', 'appendFileSync', 'appendFile',
  'rmSync', 'rm', 'unlinkSync', 'unlink', 'rmdirSync', 'rmdir',
  'renameSync', 'rename', 'copyFileSync', 'copyFile', 'cpSync', 'cp', 'truncateSync', 'truncate',
]);

/**
 * 🔴 CUÁL DE LOS ARGUMENTOS ES EL QUE SE ESCRIBE — y esto lo destapó el propio censo.
 *
 * En `copyFileSync(origen, destino)` y `renameSync(viejo, nuevo)` el que recibe la escritura es
 * el SEGUNDO. Mirando siempre el primero, `scrum471-node-modules-al-dia` salía como «escribe en
 * el árbol» por COPIAR `package.json` — que es leerlo—, y su destino de verdad (un directorio
 * temporal suyo) no se miraba. Seis falsos en la lista, y con forma de hallazgo.
 */
export const DESTINO_ES_EL_SEGUNDO = new Set(['renameSync', 'rename', 'copyFileSync', 'copyFile', 'cpSync', 'cp']);
/** Las APIs que LEEN. Sirven para distinguir el que CAPTURA-Y-DEVUELVE del que sólo genera. */
const APIS_QUE_LEEN = new Set(['readFileSync', 'readFile', 'createReadStream']);

const ficheros = (dir) => {
  const abs = path.join(RAIZ, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((n) => n.endsWith('.mjs')).sort().map((n) => `${dir}/${n}`);
};

export function poblacion(dirs = DIRS) {
  return dirs.flatMap(ficheros);
}

/** ¿Este `const X = …` construye la raíz del repositorio, tal como la escribe la casa? */
function esRaiz(inicializador, sf) {
  if (!inicializador) return false;
  const t = inicializador.getText(sf);
  return /import\.meta\.(dirname|url)/.test(t) && /['"]\.\.['"]/.test(t);
}

/**
 * Analiza un fichero. Devuelve `{ escrituras, noConcluyentes, tieneFinally, tieneRed }`.
 *
 * `escrituras`      → llamadas que escriben en una ruta derivada de la raíz.
 * `noConcluyentes`  → llamadas que escriben en algo que este instrumento NO supo resolver.
 */
export function analizar(codigo, nombre) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const raices = new Set();
  const derivadas = new Map(); // variable → texto de su inicializador

  const recorrer = (n, ver) => { ver(n); ts.forEachChild(n, (h) => recorrer(h, ver)); };

  // ① Las variables que SON la raíz, y las que se derivan de ellas (UN nivel).
  recorrer(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !n.name || !ts.isIdentifier(n.name)) return;
    if (esRaiz(n.initializer, sf)) raices.add(n.name.text);
  });
  recorrer(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !n.name || !ts.isIdentifier(n.name) || !n.initializer) return;
    const t = n.initializer.getText(sf);
    if ([...raices].some((r) => new RegExp(`\\b${r}\\b`).test(t))) derivadas.set(n.name.text, t);
  });

  const apuntaALaRaiz = (arg) => {
    if (!arg) return false;
    const t = arg.getText(sf);
    if ([...raices].some((r) => new RegExp(`\\b${r}\\b`).test(t))) return true;
    return [...derivadas.keys()].some((d) => new RegExp(`\\b${d}\\b`).test(t));
  };

  const escrituras = [];
  const noConcluyentes = [];
  const leidos = new Set();
  let tieneFinally = false;

  recorrer(sf, (n) => {
    if (ts.isTryStatement(n) && n.finallyBlock) tieneFinally = true;
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return;
    const api = n.expression.name.text;
    // Que cuelgue de `fs`/`fsp`/`promises`: `x.rm()` de otra cosa no es el sistema de ficheros.
    if (!/(^|\.)(fs|fsp|promises)$/.test(n.expression.expression.getText(sf))) return;
    if (APIS_QUE_LEEN.has(api) && n.arguments[0]) { leidos.add(n.arguments[0].getText(sf)); return; }
    if (!APIS_QUE_ESCRIBEN.has(api)) return;
    const destino = n.arguments[DESTINO_ES_EL_SEGUNDO.has(api) ? 1 : 0];
    const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const donde = { linea, api, arg: (destino ? destino.getText(sf) : '(sin destino)').slice(0, 60) };
    if (apuntaALaRaiz(destino)) escrituras.push(donde);
    else if (raices.size) noConcluyentes.push(donde);
  });

  // 🔴 EL QUE IMPORTA ES EL QUE CAPTURA Y DEVUELVE: escribe sobre un fichero que ANTES ha leído.
  // Ése promete dejarlo como estaba, y es el único al que se le puede quedar a medias. El que
  // sólo genera o borra lo suyo no promete nada.
  const capturaYDevuelve = escrituras.filter((w) => leidos.has(w.arg));
  const tieneRed = /marcarEnVuelo|restaurarDesdeMarca|instalarRedDeSeguridad/.test(codigo);
  return { escrituras, capturaYDevuelve, noConcluyentes, tieneFinally, tieneRed, hayRaiz: raices.size > 0 };
}

export function censar({ dirs = DIRS, raiz = RAIZ } = {}) {
  const pobl = poblacion(dirs);
  if (pobl.length < MINIMO_POBLACION) {
    return { motivo: `sólo ${pobl.length} ficheros en la población y el suelo son ${MINIMO_POBLACION}` };
  }
  const escritores = [];
  const opacos = [];
  for (const rel of pobl) {
    const a = analizar(fs.readFileSync(path.join(raiz, rel), 'utf8'), rel);
    if (a.escrituras.length) escritores.push({ rel, ...a });
    else if (a.noConcluyentes.length) opacos.push({ rel, ...a });
  }
  return { motivo: null, poblacion: pobl.length, escritores, opacos };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════

function principal() {
  const c = censar();
  if (c.motivo) {
    console.error(`🔴 CIEGO: ${c.motivo}. No se imprime número: un cero por no haber mirado es la `
      + 'peor cifra posible.');
    return 2;
  }

  // EL RIESGO = capturar un fichero del árbol, escribirlo, y prometer devolverlo en un `finally`.
  const conRiesgo = c.escritores.filter((e) => e.tieneFinally && e.capturaYDevuelve.length);
  console.log('═══ LA POBLACIÓN ═══');
  console.log(`   ficheros .mjs barridos (${DIRS.join(', ')}) : ${c.poblacion}`);
  console.log(`   ESCRIBEN dentro del árbol                   : ${c.escritores.length}`);
  console.log(`   🔴 …CAPTURAN un fichero, lo escriben y prometen devolverlo : ${conRiesgo.length}`);
  console.log(`   …de ésos, con la red de SCRUM-808           : ${conRiesgo.filter((e) => e.tieneRed).length}`);

  console.log('\n═══ 🔴 CAPTURAN Y DEVUELVEN — los únicos a los que se les puede quedar a medias ═══');
  for (const e of conRiesgo) {
    console.log(`   ${e.tieneRed ? '✅ con red ' : '🔴 SIN RED '} ${e.rel}`);
    for (const w of e.capturaYDevuelve) console.log(`        :${w.linea} fs.${w.api}(${w.arg}…)`);
  }

  const soloEscriben = c.escritores.filter((e) => !conRiesgo.includes(e));
  console.log(`\n═══ ESCRIBEN, PERO NO CAPTURAN NADA (${soloEscriben.length}) ═══`);
  console.log('   Generan o borran lo suyo: no prometen devolver ningún fichero a como estaba,');
  console.log('   así que no hay nada que se les pueda quedar a medias.');
  for (const e of soloEscriben) console.log(`   · ${e.rel} (${e.escrituras.length} escrituras)`);

  console.log(`\n═══ ⚠️ NO CONCLUYENTES (${c.opacos.length}) · escriben en algo que NO supe resolver ═══`);
  console.log('   Un nivel de indirección es el límite de este instrumento. NO se cuentan como');
  console.log('   «no escriben en el árbol»: se nombran para que alguien los mire.');
  for (const e of c.opacos) {
    console.log(`   · ${e.rel}`);
    for (const w of e.noConcluyentes.slice(0, 3)) console.log(`        :${w.linea} fs.${w.api}(${w.arg}…)`);
  }

  console.log('\n═══ ✅ CONTROL POSITIVO DEL INSTRUMENTO ═══');
  const yo = c.escritores.find((e) => e.rel === CONTROL_POSITIVO);
  if (!yo || !yo.tieneFinally) {
    console.error(`   🔴 el censo NO encuentra \`${CONTROL_POSITIVO}\` entre los que escriben y `
      + 'deshacen, y es EL escritor que originó este ticket. El instrumento no está viendo.');
    return 2;
  }
  console.log(`   \`${CONTROL_POSITIVO}\` sale, con ${yo.escrituras.length} escrituras y su \`finally\`.`);
  return 0;
}

if (ejecutadoDirectamente(import.meta.url)) process.exit(principal());
