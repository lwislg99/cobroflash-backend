// tests/_comparador-alcance.mjs — SCRUM-493 · LOS DOS INSTRUMENTOS DE ALCANCE, LADO A LADO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA VÍCTIMA, Y ESTÁ EN VUELO
//
// Dos casas están midiendo alcance AHORA para decidir qué se puede borrar, con instrumentos
// distintos que ya han dado números distintos sobre el mismo fichero. **Un borrado decidido con el
// número bajo borra código vivo.** Esto no funde los dos instrumentos —esa decisión es de los
// fundadores y va después— : pone sus veredictos uno al lado del otro y dice EXACTAMENTE dónde
// discrepan y por qué.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS, Y QUÉ PREGUNTA CONTESTA CADA UNO DE VERDAD
//
//   ① `_alcance-dominio.mjs` (SCRUM-411, carril ajeno — aquí SOLO SE LE LLAMA, no se toca)
//      «¿algún fichero alcanzable importa este NOMBRE?». Índice por NOMBRE **global**.
//
//   ② `_alcance-desde-entradas.mjs` (SCRUM-411 fase 2b)
//      «¿lo alcanza el proceso desde una entrada viva?». Resuelve `(módulo, nombre)`, exige que el
//      nombre se USE en el cuerpo del importador, y propaga por el grafo interno del fichero.
//
// ⚠️ NO SON LA MISMA PREGUNTA, y por eso esto es una tabla y no un empate. Se comparan porque **las
// dos se están usando para lo mismo**: decidir si algo se puede borrar. ① es un PROXY de la
// pregunta de ②, y lo que esta tabla enumera son los sitios donde el proxy falla — en cada
// dirección.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA MISMA DEFINICIÓN DE «ENTRADA VIVA» PARA LOS DOS, Y NO ES UN DETALLE
//
// `src/index.ts`, `src/app.ts` y los `scripts/*.mjs` que declara `package.json`. `tests/` NO.
// Los dos instrumentos la toman del MISMO sitio (`ENTRADAS` + `entradasDeComando`): si partieran de
// entradas distintas, comparar sus números no significaría nada.
//
// Y EL MISMO CORPUS: solo los exports de `src/modules/*/domain/**`, que es lo único que ① censa.
// Comparar sobre todo `src/` daría una diferencia que solo dice que ① mira menos sitios.
import ts from 'typescript';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analizar, ficherosTs, exportsDe } from './_alcance-dominio.mjs';
import { censarAlcance, importacionesDe } from './_alcance-desde-entradas.mjs';

export const SI = 'SI';
export const NO = 'NO';
export const NO_SE = 'NO_SE';

/**
 * Las clases de discrepancia. `OTRO` no es una categoría: es un HUECO, y hay un test que exige que
 * esté vacía. Una discrepancia que no se sabe explicar no está clasificada, está sin mirar.
 */
export const CLASES = {
  LLAMADA_INTRA_MODULO: 'nadie lo importa, pero lo llama por dentro un export que sí entra',
  IMPORT_DINAMICO: 'se carga con `await import()`: el nombre no queda atado',
  REEXPORT: 'otro fichero lo re-exporta y por ahí sí se llega',
  NOMBRE_REPETIDO: 'dos módulos exportan el mismo nombre y ① no distingue de cuál',
  NAMESPACE_OPACO: 'su módulo se ata con `import * as`: no se sabe qué nombres se usan',
  TABLA_DE_DESPACHO: 'se invoca por una tabla o un miembro calculado, no por su identificador',
  OTRO: '🔴 SIN EXPLICAR — es un hueco declarado, no una categoría',
};

const rel = (raiz, p) => path.relative(raiz, p).split(path.sep).join('/');

/** Nombres re-exportados con `export { x } from './y'`, y desde dónde. */
function reexportaciones(raiz) {
  const out = new Map(); // nombre → [ficheros que lo re-exportan]
  for (const p of ficherosTs(path.join(raiz, 'src'))) {
    const sf = ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const v = (n) => {
      if (ts.isExportDeclaration(n) && n.moduleSpecifier && n.exportClause && ts.isNamedExports(n.exportClause)) {
        for (const el of n.exportClause.elements) {
          const nombre = el.propertyName?.text ?? el.name.text;
          if (!out.has(nombre)) out.set(nombre, []);
          out.get(nombre).push(rel(raiz, p));
        }
      }
      ts.forEachChild(n, v);
    };
    ts.forEachChild(sf, v);
  }
  return out;
}

/** Qué módulos se cargan con `await import()` y cuáles con `import * as`. */
function ataduraOpaca(raiz) {
  const dinamicos = new Set();
  const namespaces = new Set();
  for (const p of ficherosTs(path.join(raiz, 'src'))) {
    const { namespaces: ns, dinamicos: din } = importacionesDe(p);
    for (const m of ns) namespaces.add(rel(raiz, m));
    for (const m of din) dinamicos.add(rel(raiz, m));
  }
  return { dinamicos, namespaces };
}

/** Cuántos módulos de `src/` exportan cada nombre. Si son ≥2, el índice global de ① es ambiguo. */
function exportadoresPorNombre(raiz) {
  const out = new Map();
  for (const p of ficherosTs(path.join(raiz, 'src'))) {
    for (const n of exportsDe(p)) {
      if (!out.has(n)) out.set(n, []);
      out.get(n).push(rel(raiz, p));
    }
  }
  return out;
}

/**
 * Se invoca por tabla de despacho o miembro calculado: el nombre aparece como LITERAL DE CADENA o
 * como clave de objeto en algún fichero de `src/` que no es el suyo.
 *
 * ⚠️ Es una señal, no una prueba, y por eso su clase se declara como tal: un literal con el mismo
 * texto puede ser cualquier cosa. Se usa para EXPLICAR una discrepancia que ya existe, nunca para
 * afirmar que algo está vivo.
 */
function nombresEnLiteralesOClaves(raiz) {
  const out = new Map(); // nombre → [ficheros]
  for (const p of ficherosTs(path.join(raiz, 'src'))) {
    const r = rel(raiz, p);
    const sf = ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const anota = (texto) => {
      if (!out.has(texto)) out.set(texto, []);
      if (!out.get(texto).includes(r)) out.get(texto).push(r);
    };
    const v = (n) => {
      if (ts.isStringLiteral(n) && !ts.isImportDeclaration(n.parent) && !ts.isExportDeclaration(n.parent)) anota(n.text);
      if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && n.name && ts.isIdentifier(n.name)) anota(n.name.text);
      ts.forEachChild(n, v);
    };
    ts.forEachChild(sf, v);
  }
  return out;
}

/** ① normalizado. Ojo: ① NUNCA dice `NO_SE` — no tiene ese veredicto, y eso es un hallazgo. */
function veredictoUno(R) {
  const out = new Map();
  for (const m of R.modulos) {
    for (const nombre of m.exports) {
      out.set(`${m.modulo}::${nombre}`, {
        modulo: m.modulo, nombre,
        veredicto: m.huerfanos.includes(nombre) ? NO : SI,
        // ①, cuando no sabe (`import * as`), da el módulo por VIVO ENTERO. Es su única concesión a
        // la duda, y se resuelve hacia el SÍ: por eso no tiene `NO_SE`.
        porNamespace: m.porNamespace === true,
      });
    }
  }
  return out;
}

/** ② normalizado. */
function veredictoDos(A) {
  const out = new Map();
  for (const [k, v] of A.veredictos) {
    out.set(k, {
      modulo: v.modulo, nombre: v.nombre, linea: v.linea, porQue: v.porQue,
      veredicto: v.estado === 'ALCANZABLE' ? SI : v.estado === 'NO_ALCANZABLE' ? NO : NO_SE,
    });
  }
  return out;
}

/**
 * EL COMPARADOR. Corre los dos sobre el mismo corpus y devuelve dónde discrepan, con el motivo.
 *
 * `sesgo` dice qué instrumento falla y HACIA DÓNDE, que es lo único accionable: quien vaya a borrar
 * necesita saber si el número que mira acusa de más o de menos.
 */
export function comparar(raiz) {
  const R = analizar(raiz);
  const A = censarAlcance(raiz);
  if (R.sinSrc || A.sinSrc) return { sinSrc: true, corpus: 0, acuerdos: 0, discrepancias: [], porClase: {} };

  const uno = veredictoUno(R);
  const dos = veredictoDos(A);
  const reex = reexportaciones(raiz);
  const { dinamicos, namespaces } = ataduraOpaca(raiz);
  const porNombre = exportadoresPorNombre(raiz);
  const literales = nombresEnLiteralesOClaves(raiz);

  const discrepancias = [];
  let corpus = 0, acuerdos = 0;

  for (const [k, u] of uno) {
    const d = dos.get(k);
    if (!d) continue; // fuera del corpus común
    corpus++;
    if (u.veredicto === d.veredicto) { acuerdos++; continue; }

    const señales = [];
    if (/por dentro/.test(d.porQue)) señales.push('LLAMADA_INTRA_MODULO');
    if (dinamicos.has(u.modulo)) señales.push('IMPORT_DINAMICO');
    if (namespaces.has(u.modulo)) señales.push('NAMESPACE_OPACO');
    if ((reex.get(u.nombre) ?? []).length) señales.push('REEXPORT');
    if ((porNombre.get(u.nombre) ?? []).length > 1) señales.push('NOMBRE_REPETIDO');
    if ((literales.get(u.nombre) ?? []).some((f) => f !== u.modulo)) señales.push('TABLA_DE_DESPACHO');

    // La clase PRIMARIA es la que explica ESTA discrepancia, no la primera que aparezca.
    let clase = 'OTRO';
    if (u.veredicto === NO && d.veredicto === SI && señales.includes('LLAMADA_INTRA_MODULO')) {
      clase = 'LLAMADA_INTRA_MODULO';
    } else if (d.veredicto === NO_SE) {
      // ② no sabe. Lo que lo dejó opaco manda; si además hay re-export, ESO es lo que hace que ①
      // acierte y ② se quede corto, y es lo que hay que enseñar.
      clase = u.veredicto === SI && señales.includes('REEXPORT') ? 'REEXPORT'
        : señales.includes('IMPORT_DINAMICO') ? 'IMPORT_DINAMICO'
          : señales.includes('NAMESPACE_OPACO') ? 'NAMESPACE_OPACO' : 'OTRO';
    } else if (u.veredicto === SI && d.veredicto === NO) {
      clase = señales.includes('NOMBRE_REPETIDO') ? 'NOMBRE_REPETIDO'
        : señales.includes('REEXPORT') ? 'REEXPORT'
          : señales.includes('TABLA_DE_DESPACHO') ? 'TABLA_DE_DESPACHO' : 'OTRO';
    }

    discrepancias.push({
      modulo: u.modulo, nombre: u.nombre, linea: d.linea,
      uno: u.veredicto, dos: d.veredicto, clase, señales,
      // 🔴 Qué instrumento se equivoca y hacia dónde. Es lo único accionable para quien vaya a borrar.
      sesgo: u.veredicto === NO && d.veredicto === SI
        ? '① lo da por HUÉRFANO y el proceso SÍ pasa por él → borrar con ① borra código vivo'
        : u.veredicto === SI && d.veredicto === NO
          ? '② dice que no llega y ① lo da por vivo → ② acusa de más; comprobar antes de borrar'
          : u.veredicto === SI
            ? '① dice que llega y ② NO SABE → ② se queda corto; el número de ② no basta para borrar'
            : '① lo da por HUÉRFANO y ② NO SABE → nadie ha comprobado nada: NO se puede borrar',
    });
  }

  discrepancias.sort((a, b) => (a.clase.localeCompare(b.clase)) || a.modulo.localeCompare(b.modulo) || a.nombre.localeCompare(b.nombre));
  const porClase = {};
  for (const x of discrepancias) porClase[x.clase] = (porClase[x.clase] ?? 0) + 1;
  return { sinSrc: false, corpus, acuerdos, discrepancias, porClase };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA AUTOPRUEBA — con una discrepancia SINTÉTICA plantada
//
// Si la lista de discrepancias saliera vacía, «coinciden» y «el comparador está ciego» darían el
// mismo verde. Así que antes de creerse ningún número se construye un árbol donde se sabe de
// antemano dónde tienen que discrepar y dónde NO:
//
//   · `AYUDA`       nadie la importa, la usa `motorVivo` por dentro → ① NO · ② SÍ  → DISCREPAN
//   · `motorVivo`   lo importa la ruta                              → ① SÍ · ② SÍ  → coinciden
//   · `motorMuerto` no lo alcanza nada                              → ① NO · ② NO  → coinciden
//
// Vale solo si encuentra EXACTAMENTE la plantada: ni una más (inventaría discrepancias) ni una
// menos (estaría ciego).
// ─────────────────────────────────────────────────────────────────────────────────────────

const FUENTE = {
  'package.json': '{ "name": "sintetico", "scripts": {} }\n',
  'src/index.ts': `import { arrancar } from './app';\narrancar();\n`,
  'src/app.ts': `import { rutaViva } from './modules/x/x.routes';\nexport function arrancar() { return rutaViva(); }\n`,
  'src/modules/x/x.routes.ts': `import { motorVivo } from './domain/motor';\nexport function rutaViva() { return motorVivo(); }\n`,
  'src/modules/x/domain/motor.ts':
    `export const AYUDA = 7;\n` +
    `export function motorVivo() { return AYUDA; }\n` +
    `export function motorMuerto() { return 'nadie'; }\n`,
};

export function escribirFuenteSintetica() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum493-comparador-'));
  for (const [r, c] of Object.entries(FUENTE)) {
    const destino = path.join(raiz, r);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, c);
  }
  return raiz;
}

export function autoprueba() {
  const raiz = escribirFuenteSintetica();
  try {
    const c = comparar(raiz);
    const vistas = c.discrepancias.map((d) => `${d.nombre}:${d.uno}/${d.dos}:${d.clase}`);
    return {
      vistas,
      encuentraLaPlantada: vistas.includes('AYUDA:NO/SI:LLAMADA_INTRA_MODULO'),
      noInventaOtras: c.discrepancias.length === 1,
      // Y el otro lado: donde coinciden, coinciden. Sin esto, un comparador que marcara todo como
      // discrepancia también «encontraría la plantada».
      coincidenLosDemas: c.acuerdos >= 2,
      corpus: c.corpus,
      acuerdos: c.acuerdos,
    };
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
}
