// tests/scrum1839-letra-con-tramo.test.mjs — SCRUM-1839b
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// NINGUNA LETRA DE TRAMO NUEVA LLEGA A LA RAMA PRINCIPAL SIN SU TRAMO
//
// Un asunto de commit que dice `SCRUM-<N><letra>` (p. ej. `SCRUM-1058c`) anuncia una fase con
// nombre propio. Su TRAMO es la cabecera que la abre en `docs/master/SCRUM-<N>.md`. La medición
// de SCRUM-1839 (jv-j6fy, sobre 651a143476a309308898fe252360d0b3d6a2a2ad, 24-nov-2026) encontró
// letras que llegaron sin el suyo, y nada lo impedía: este trinquete lo impide desde ahora.
//
// ── LA REGLA (decidida en Jira SCRUM-1839 c.22677; aquí NO se cambia) ───────────────────────
//   Cuenta como tramo de (N, letra) una CABECERA de `docs/master/SCRUM-<N>.md` del MISMO N:
//     · `#` o `##` al principio de línea, y NO `###` (que también empieza por `##`);
//     · que contenga N+letra ENTEROS, con borde por los dos lados: `1058c` no casa `1058cc`
//       ni `11058c`. Borde = ni letra ni dígito ASCII al lado;
//     · lleve o no `SCRUM-` delante (`## 1058c · …` vale).
//   El par sale del ASUNTO (`%s`), nunca del cuerpo: `SCRUM-(\d+)([a-z]{1,2})` con corte detrás,
//   y sólo «SCRUM» en mayúsculas (las ramas en minúscula de los asuntos de merge no entran).
//
// ── LOS CONTROLES ───────────────────────────────────────────────────────────────────────────
//   ① SUELO ......... lee la historia de la punta del árbol (en CI, el merge del PR) y el
//                     registro del disco; DECLARA su población, y cero commits o cero registros
//                     es CIEGO, no verde. Con el clon superficial no mide y lo dice.
//   ② ROJO SEMBRADO . un asunto «SCRUM-99001z» sin tramo cae nombrando par y fichero; su gemelo
//                     con la cabecera (estricta o sin «SCRUM-») pasa.
//   ③ BORDES ........ `99001zz`, `199001z`, `###` y una mención en el cuerpo NO son tramo.
//   ④ EL TRINQUETE .. sobre el árbol real, las dos mitades: una letra sin tramo fuera de la
//                     lista es ROJO; una de la lista que ya tiene tramo, también («quítala»).
//   ⑤ NO CRECE ...... cada entrada de la lista la nombra un asunto de la historia hasta la foto
//                     congelada (por IDENTIDAD de commit, no por fecha), estaba sin tramo EN esa
//                     foto, y la lista no pasa del tope medido. Y la foto, reclasificada, da lo
//                     mismo que el día que se midió: si no, el instrumento ha cambiado.
//   ⑥ CONTROL ....... sobre la población real: quitar una entrada la hace caer con su nombre,
//                     y meter una que ya tiene tramo, también.
//
// ⚠️ Las cifras de la foto difieren de las de jv-j6fy (24-nov-2026) en cuatro pares, y es la
// regla decidida, no un descuido: aquella sonda contaba `###`…`######` y un borde izquierdo de
// sólo dígitos. `1233i` y `1183c` sólo se nombran en una cabecera `###`; `710b` y `959b` sólo
// dentro de `scrum710b`/`scrum959b` (una letra pegada a la izquierda). Los cuatro, en la lista.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_REGISTRO = path.join(RAIZ, 'docs', 'master');

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA REGLA, en tres piezas puras
// ═════════════════════════════════════════════════════════════════════════════════════════

/** El par de un asunto: número entero y una o dos letras con corte detrás. Sólo «SCRUM» en mayúsculas. */
const RE_PAR = /SCRUM-(\d+)([a-z]{1,2})(?![a-z0-9])/g;

/** Cabecera de tramo: `#` o `##` al principio de línea; `###` empieza por `##` y NO vale. */
const RE_CABECERA = /^#{1,2}(?!#)/;

/** N+letra ENTEROS: ni letra ni dígito pegados por ningún lado. */
const tokenDeTramo = (n, letra) => new RegExp(`(?<![0-9A-Za-z])${n}${letra}(?![0-9A-Za-z])`);

/** ¿Esta línea abre el tramo de (n, letra)? */
export function esCabeceraDeTramo(linea, n, letra) {
  return RE_CABECERA.test(linea) && tokenDeTramo(n, letra).test(linea);
}

/** Los pares que nombran los asuntos, con el asunto MÁS RECIENTE que nombra cada uno. */
export function paresDeAsuntos(asuntos) {
  const pares = new Map();
  for (const { sha, asunto } of asuntos) {
    for (const m of asunto.matchAll(RE_PAR)) {
      const n = String(Number(m[1]));
      const clave = n + m[2];
      if (!pares.has(clave)) pares.set(clave, { clave, n, letra: m[2], sha, asunto });
    }
  }
  return pares;
}

/**
 * Reparte los pares en con tramo / sin tramo / sin fichero. `leerRegistro(n)` devuelve el texto
 * de `docs/master/SCRUM-<n>.md` o `null` si no existe: así se le puede sembrar un registro.
 */
export function clasificar(pares, leerRegistro) {
  const textos = new Map();
  const out = { conTramo: [], sinTramo: [], sinFichero: [], registrosLeidos: 0 };
  for (const p of pares.values()) {
    if (!textos.has(p.n)) textos.set(p.n, leerRegistro(p.n));
    const texto = textos.get(p.n);
    const fichero = `docs/master/SCRUM-${p.n}.md`;
    if (texto === null || texto === undefined) { out.sinFichero.push({ ...p, fichero }); continue; }
    // El BOM no es texto de la línea: sin quitarlo, una cabecera en la línea 1 no empezaría por `#`.
    const linea = texto.replace(/^﻿/, '').split(/\r?\n/).find((l) => esCabeceraDeTramo(l, p.n, p.letra));
    (linea === undefined ? out.sinTramo : out.conTramo).push({ ...p, fichero, linea });
  }
  out.registrosLeidos = [...textos.values()].filter((t) => t !== null && t !== undefined).length;
  return out;
}

/** Las dos mitades del trinquete contra la lista congelada. */
export function contraLaLista(clasif, lista) {
  const enLista = new Set(lista);
  const sin = [...clasif.sinTramo, ...clasif.sinFichero];
  const nuevos = sin.filter((p) => !enLista.has(p.clave));
  const conTramo = new Map(clasif.conTramo.map((p) => [p.clave, p]));
  const sobran = lista.filter((c) => conTramo.has(c)).map((c) => conTramo.get(c));
  const vistos = new Set([...sin, ...clasif.conTramo].map((p) => p.clave));
  const ausentes = lista.filter((c) => !vistos.has(c));
  return { nuevos, sobran, ausentes };
}

const comoPar = (p) => `${p.clave} · ${p.fichero} · lo nombra ${p.sha} «${p.asunto.slice(0, 90)}»`;

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA FOTO CONGELADA Y LA LISTA
// ═════════════════════════════════════════════════════════════════════════════════════════

/** El commit de la medición de SCRUM-1839 (jv-j6fy, 24-nov-2026 17:11Z). Un sha, no una ref: no se mueve. */
export const CONGELADO = '651a143476a309308898fe252360d0b3d6a2a2ad';

/**
 * Lo que ESTE instrumento ve en la foto congelada (24-nov-2026, sobre 651a143476a309308898fe252360d0b3d6a2a2ad).
 * Es historia: el mismo sha da los mismos números para siempre. Si cambian, ha cambiado la regla
 * o el lector, y eso se decide y se escribe aquí, no se re-mide para que cuadre.
 */
export const MEDIDA_CONGELADA = Object.freeze({
  commits: 13083,
  registros: 1366,
  pares: 1078,
  conTramo: 975,
  sinTramo: 89,
  sinFichero: 14,
});

/** El tope de la lista se DERIVA de la foto: lo que en ella estaba sin tramo, con o sin fichero. */
const TOPE_DE_LA_LISTA = MEDIDA_CONGELADA.sinTramo + MEDIDA_CONGELADA.sinFichero;

/**
 * Los pares históricos que llegaron SIN TRAMO. Medida el 24-nov-2026 sobre la foto
 * 651a143476a309308898fe252360d0b3d6a2a2ad (la rama, a esa hora, daba el mismo conjunto).
 *
 * SÓLO BAJA. Una entrada sale cuando su registro gana la cabecera (④ lo exige: «quítala»). No se
 * añade NINGUNA: una letra nueva sin tramo se arregla escribiendo su cabecera en su registro, en
 * el mismo PR. Una por línea (A23 #15).
 */
export const SIN_TRAMO_CONGELADOS = [
  // — en la foto, con fichero y sin cabecera que las nombre —
  '525b',
  '525c',
  '525d',
  '529c',
  '534d',
  '534e',
  '542b',
  '609b',
  '652e',
  '652f',
  '655b',
  '710b',
  '717b',
  '717d',
  '717e',
  '732b',
  '746b',
  '821b',
  '825b',
  '834b',
  '834c',
  '834d',
  '834e',
  '839b',
  '839c',
  '846b',
  '848b',
  '855b',
  '860b',
  '878b',
  '880b',
  '880c',
  '885c',
  '887b',
  '887c',
  '889b',
  '890b',
  '903c',
  '903d',
  '906l',
  '919b',
  '920b',
  '920g',
  '940c',
  '944b',
  '959b',
  '976b',
  '995b',
  '997d',
  '1005c',
  '1058b',
  '1106b',
  '1127b',
  '1158d',
  '1183c',
  '1211b',
  '1233i',
  '1236c',
  '1244b',
  '1244c',
  '1244d',
  '1251a',
  '1282d',
  '1310a',
  '1442b',
  '1499a',
  '1507d',
  '1548c',
  '1549b',
  '1559d',
  '1559e',
  '1559f',
  '1559h',
  '1562b',
  '1562e',
  '1566d',
  '1566e',
  '1589b',
  '1608b',
  '1636c',
  '1669b',
  '1725e',
  '1742b',
  '1745d',
  '1762c',
  '1778a',
  '1787aa',
  '1810c',
  // — en la foto, sin fichero `docs/master/SCRUM-<N>.md` —
  '93b',
  '145d',
  '171a',
  '171b',
  '173b',
  '176b',
  '183b',
  '193b',
  '193c',
  '201b',
  '206b',
  '218b',
  '224b',
  '1122c',
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// LECTORES (git y disco)
// ═════════════════════════════════════════════════════════════════════════════════════════

const git = (...args) => execFileSync('git', args, {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
});

/** Los asuntos de la historia de un commit. `HEAD` es el árbol bajo prueba; en CI, el merge del PR. */
function asuntosDe(punta) {
  return git('log', punta, '--format=%h%x09%s').split('\n').filter(Boolean).map((l) => {
    const i = l.indexOf('\t');
    return { sha: l.slice(0, i), asunto: l.slice(i + 1) };
  });
}

/** El registro del disco: el árbol que se está probando. */
function leerRegistroDelDisco(n) {
  const f = path.join(DIR_REGISTRO, `SCRUM-${n}.md`);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
}

const registrosDelDisco = () => fs.readdirSync(DIR_REGISTRO).filter((f) => /^SCRUM-\d+\.md$/.test(f)).length;

/**
 * La foto congelada: sus asuntos y sus registros, leídos de git por el sha. De los registros sólo
 * hacen falta las líneas que empiezan por `#` (una cabecera no puede ser otra cosa), y `git grep`
 * las trae todas en un solo proceso. El `(?:\d+:)?` tolera un `grep.lineNumber` puesto en la
 * configuración: el contenido empieza siempre por `#`, así que no hay ambigüedad.
 */
function fotoCongelada() {
  const asuntos = asuntosDe(CONGELADO);
  const ficheros = new Set(git('ls-tree', '--name-only', CONGELADO, 'docs/master/').split('\n')
    .map((f) => /^docs\/master\/SCRUM-(\d+)\.md$/.exec(f.trim())).filter(Boolean).map((m) => String(Number(m[1]))));
  const cabeceras = new Map();
  for (const l of git('grep', '--no-color', '-E', '^#', CONGELADO, '--', 'docs/master/').split('\n')) {
    const m = /^[0-9a-f]{40}:docs\/master\/SCRUM-(\d+)\.md:(?:\d+:)?(#.*?)\r?$/.exec(l);
    if (!m) continue;
    const n = String(Number(m[1]));
    if (!cabeceras.has(n)) cabeceras.set(n, []);
    cabeceras.get(n).push(m[2]);
  }
  const pares = paresDeAsuntos(asuntos);
  const clasif = clasificar(pares, (n) => (ficheros.has(n) ? (cabeceras.get(n) || []).join('\n') : null));
  return {
    commits: asuntos.length,
    registros: ficheros.size,
    pares,
    clasif,
    sin: new Set([...clasif.sinTramo, ...clasif.sinFichero].map((p) => p.clave)),
  };
}

/** Por qué una lista no puede ser la congelada. Pura: recibe la foto ya leída. */
export function problemasDeLaLista(lista, foto) {
  const problemas = [];
  const vistas = new Set();
  for (const c of lista) {
    if (!/^\d+[a-z]{1,2}$/.test(c)) problemas.push(`«${c}» no tiene forma de par (<N><letra>)`);
    if (vistas.has(c)) problemas.push(`«${c}» está repetida`);
    vistas.add(c);
    if (!foto.pares.has(c)) {
      problemas.push(`«${c}» no la nombra ningún asunto de la historia de ${CONGELADO}: la lista NO crece; `
        + 'una letra nueva se arregla escribiendo su cabecera en su registro');
    } else if (!foto.sin.has(c)) {
      problemas.push(`«${c}» ya tenía tramo en la foto ${CONGELADO.slice(0, 12)}: no puede estar en la lista`);
    }
  }
  if (lista.length > TOPE_DE_LA_LISTA) {
    problemas.push(`la lista tiene ${lista.length} entradas y el tope medido es ${TOPE_DE_LA_LISTA}`);
  }
  return problemas;
}

/** NO MEDIDO antes que verde: sin la historia entera, «no veo asuntos» no se distingue de «no hay». */
function exigirHistoria() {
  // Copiado de tests/scrum1349-entorno-prestado-solo-baja.test.mjs (el mismo `--is-shallow-repository`).
  assert.equal(git('rev-parse', '--is-shallow-repository').trim(), 'false',
    '🔴 NO MEDIDO: el clon es superficial y la historia no se puede leer entera (el job de CI lleva `fetch-depth: 0`, SCRUM-388)');
  let esAncestro = true;
  try { git('merge-base', '--is-ancestor', CONGELADO, 'HEAD'); } catch { esAncestro = false; }
  assert.ok(esAncestro,
    `🔴 NO MEDIDO: la foto congelada ${CONGELADO} no está en la historia de este árbol (o el clon no la trae). `
    + 'Sin ella, «la lista no crece» no se puede comprobar.');
}

// Se lee UNA vez por fichero: los casos de abajo comparten la población.
let cache = null;
function poblacion() {
  if (cache) return cache;
  exigirHistoria();
  const asuntos = asuntosDe('HEAD');
  const pares = paresDeAsuntos(asuntos);
  const clasif = clasificar(pares, leerRegistroDelDisco);
  cache = { asuntos, pares, clasif, registros: registrosDelDisco() };
  return cache;
}

const rotulo = ({ asuntos, pares, clasif, registros }) => `población: ${asuntos.length} commits · `
  + `${registros} registros (${clasif.registrosLeidos} leídos por tener par) · ${pares.size} pares = `
  + `${clasif.conTramo.length} con tramo + ${clasif.sinTramo.length} sin tramo + ${clasif.sinFichero.length} sin fichero`;

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA SIEMBRA
// ═════════════════════════════════════════════════════════════════════════════════════════
const SEMBRADO = { sha: '0000000', asunto: 'J6 · SCRUM-99001z: asunto sembrado por el propio test' };
const conRegistro = (texto) => (n) => (n === '99001' ? texto : null);
const veredicto = (texto) => {
  const c = clasificar(paresDeAsuntos([SEMBRADO]), conRegistro(texto));
  if (c.conTramo.length) return 'con tramo';
  if (c.sinTramo.length) return 'sin tramo';
  return c.sinFichero.length ? 'sin fichero' : 'AUSENTE';
};

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-1839b · ① SUELO: la historia y el registro se ven, y la población cuadra', (t) => {
  const p = poblacion();
  t.diagnostic(rotulo(p));
  assert.ok(p.asuntos.length > 0, '🔴 CIEGO: cero commits leídos de la historia. Cero no es «está limpio».');
  assert.ok(p.registros > 0 && p.clasif.registrosLeidos > 0,
    `🔴 CIEGO: cero registros en docs/master (o ninguno leído). ${rotulo(p)}`);
  assert.ok(p.pares.size > 0, `🔴 CIEGO: ningún asunto nombra un par. ${rotulo(p)}`);
  const suma = p.clasif.conTramo.length + p.clasif.sinTramo.length + p.clasif.sinFichero.length;
  assert.equal(suma, p.pares.size, `🔴 el reparto no suma el total: ${rotulo(p)}`);
  // La historia del árbol CONTIENE la foto: no puede tener menos commits ni menos pares que ella.
  assert.ok(p.asuntos.length >= MEDIDA_CONGELADA.commits && p.pares.size >= MEDIDA_CONGELADA.pares,
    `🔴 el árbol ve menos historia que la foto congelada (${MEDIDA_CONGELADA.commits} commits, `
    + `${MEDIDA_CONGELADA.pares} pares): el lector se ha descarriado. ${rotulo(p)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② ROJO SEMBRADO, Y SU GEMELO VERDE
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-1839b · 🔴 ② un asunto sembrado sin tramo es ROJO, y con su cabecera es verde', () => {
  // Rojo: sin registro, y con registro pero sin cabecera que lo nombre.
  const sinFichero = clasificar(paresDeAsuntos([SEMBRADO]), () => null);
  const r1 = contraLaLista(sinFichero, SIN_TRAMO_CONGELADOS);
  assert.deepEqual(r1.nuevos.map((x) => [x.clave, x.fichero]), [['99001z', 'docs/master/SCRUM-99001.md']],
    '🔴 un par sin fichero no sale como nuevo sin tramo, o no nombra par y fichero');
  const sinCabecera = clasificar(paresDeAsuntos([SEMBRADO]), conRegistro('# SCRUM-99001\n\nTexto.\n'));
  const r2 = contraLaLista(sinCabecera, SIN_TRAMO_CONGELADOS);
  assert.deepEqual(r2.nuevos.map((x) => [x.clave, x.fichero]), [['99001z', 'docs/master/SCRUM-99001.md']],
    '🔴 un par con fichero y sin cabecera no sale como nuevo sin tramo');
  assert.match(comoPar(r2.nuevos[0]), /99001z · docs\/master\/SCRUM-99001\.md · lo nombra 0000000/);

  // Verde: el gemelo con su cabecera, estricta y sin «SCRUM-» delante, en `#` y en `##`.
  for (const cabecera of ['## SCRUM-99001z · el tramo', '## 99001z · el tramo, forma laxa', '# SCRUM-99001z']) {
    const c = clasificar(paresDeAsuntos([SEMBRADO]), conRegistro(`# SCRUM-99001\n\n${cabecera}\n\nCuerpo.\n`));
    const r = contraLaLista(c, SIN_TRAMO_CONGELADOS);
    assert.deepEqual(r.nuevos, [], `🔴 con la cabecera «${cabecera}» el par sembrado sigue saliendo sin tramo`);
    assert.equal(c.conTramo[0]?.linea, cabecera, `🔴 la cabecera que se cuenta no es «${cabecera}»`);
  }

  // Sobre la población REAL: sembrar el asunto añade exactamente ese par, y sin siembra, nada.
  const p = poblacion();
  const conSiembra = contraLaLista(clasificar(paresDeAsuntos([SEMBRADO, ...p.asuntos]), leerRegistroDelDisco), SIN_TRAMO_CONGELADOS);
  assert.deepEqual(conSiembra.nuevos.map((x) => x.clave), ['99001z'], '🔴 la siembra sobre el árbol real no cae nombrándola');
  const sinSiembra = contraLaLista(p.clasif, SIN_TRAMO_CONGELADOS);
  assert.equal(sinSiembra.nuevos.some((x) => x.clave === '99001z'), false, '🔴 99001z aparece sin haberlo sembrado');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ BORDES — cada «no vale» con su «sí vale» del MISMO token al lado
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-1839b · 🔴 ③ BORDES: ni 99001zz, ni 199001z, ni ###, ni el cuerpo cuentan como tramo de 99001z', () => {
  // Dos letras: `99001zz` es OTRO tramo.
  assert.equal(veredicto('# SCRUM-99001\n\n## 99001zz · otra fase\n'), 'sin tramo', '🔴 `## 99001zz` cuenta como tramo de 99001z');
  assert.equal(veredicto('# SCRUM-99001\n\n## 99001z · la fase\n'), 'con tramo', '🔴 `## 99001z` no cuenta: el borde se ha pasado');
  // Un dígito delante: `199001z` es otro número.
  assert.equal(veredicto('# SCRUM-99001\n\n## SCRUM-199001z · de otro ticket\n'), 'sin tramo', '🔴 `199001z` cuenta como 99001z');
  assert.equal(veredicto('# SCRUM-99001\n\n## SCRUM-99001z · de este ticket\n'), 'con tramo', '🔴 `SCRUM-99001z` no cuenta');
  // Una letra pegada delante (un nombre de fichero, `scrum99001z-…`) no es borde.
  assert.equal(veredicto('# SCRUM-99001\n\n## Lo medido (`tests/scrum99001z-x.test.mjs`)\n'), 'sin tramo',
    '🔴 una letra pegada a la izquierda cuenta como borde');
  assert.equal(veredicto('# SCRUM-99001\n\n## Lo medido (`tests/scrum-99001z-x.test.mjs`)\n'), 'con tramo',
    '🔴 un guion delante no cuenta como borde');
  // `###` empieza por `##` y NO es cabecera de tramo (regla literal).
  assert.equal(veredicto('# SCRUM-99001\n\n### SCRUM-99001z · nivel tres\n'), 'sin tramo', '🔴 `###` cuenta como cabecera de tramo');
  assert.equal(veredicto('# SCRUM-99001\n\n## SCRUM-99001z · nivel dos\n'), 'con tramo', '🔴 `##` no cuenta como cabecera de tramo');
  // Una mención fuera de cabecera (texto normal, negrita o cita) no es tramo.
  assert.equal(veredicto('# SCRUM-99001\n\nTexto que cita SCRUM-99001z.\n**SCRUM-99001z**\n> SCRUM-99001z\n'), 'sin tramo',
    '🔴 una mención fuera de cabecera cuenta como tramo');
  assert.equal(veredicto('# SCRUM-99001\n\nTexto que cita SCRUM-99001z.\n# SCRUM-99001z\n'), 'con tramo',
    '🔴 la cabecera `#` debajo de una mención no cuenta');
  // El par del asunto: `SCRUM-99001zz` es el par 99001zz, y «scrum-» en minúscula no es par.
  assert.deepEqual([...paresDeAsuntos([{ sha: '1', asunto: 'x SCRUM-99001zz y' }]).keys()], ['99001zz']);
  assert.deepEqual([...paresDeAsuntos([{ sha: '1', asunto: 'Merge pull request #1 from x/scrum-99001z-rama' }]).keys()], []);
  assert.deepEqual([...paresDeAsuntos([{ sha: '1', asunto: 'Merge pull request #1 · SCRUM-99001z' }]).keys()], ['99001z']);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ EL TRINQUETE, sobre el árbol real
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-1839b · 🔴 ④ TRINQUETE: ninguna letra sin tramo fuera de la lista, y ninguna de la lista con tramo', (t) => {
  const p = poblacion();
  t.diagnostic(rotulo(p));
  const { nuevos, sobran, ausentes } = contraLaLista(p.clasif, SIN_TRAMO_CONGELADOS);
  assert.deepEqual(nuevos.map(comoPar), [],
    `🔴 HAY LETRAS DE TRAMO SIN SU TRAMO, y no están en la lista congelada:\n    ${nuevos.map(comoPar).join('\n    ')}\n\n`
    + '  Se arregla escribiendo en ese registro una cabecera `## SCRUM-<N><letra> · …` (o `#`), en el MISMO PR.\n'
    + '  La lista NO crece (⑤). Un fichero que falta se crea con su `# SCRUM-<N>` y su tramo.\n'
    + `  ${rotulo(p)}`);
  assert.deepEqual(sobran.map(comoPar), [],
    `🔴 EL TRINQUETE PUEDE APRETAR: estas entradas de la lista YA tienen tramo. Quítalas de SIN_TRAMO_CONGELADOS en este commit:\n    `
    + sobran.map((x) => `${comoPar(x)}\n      cabecera: ${x.linea}`).join('\n    '));
  assert.deepEqual(ausentes, [], `🔴 entradas de la lista que ningún asunto de este árbol nombra: ${ausentes.join(', ')}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ LA LISTA NO CRECE
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-1839b · 🔴 ⑤ LA LISTA NO CRECE: cada entrada sale de la foto congelada, sin tramo allí, y no pasa del tope', (t) => {
  exigirHistoria();
  const foto = fotoCongelada();
  const medida = {
    commits: foto.commits,
    registros: foto.registros,
    pares: foto.pares.size,
    conTramo: foto.clasif.conTramo.length,
    sinTramo: foto.clasif.sinTramo.length,
    sinFichero: foto.clasif.sinFichero.length,
  };
  t.diagnostic(`foto ${CONGELADO.slice(0, 12)}: ${JSON.stringify(medida)}`);
  // El instrumento de hoy, sobre la foto de entonces, tiene que ver lo mismo que vio: si no, la
  // regla o el lector han cambiado, y entonces la lista ya no significa lo que dice.
  assert.deepEqual(medida, { ...MEDIDA_CONGELADA },
    '🔴 la foto congelada, reclasificada hoy, no da lo que se midió: ha cambiado la regla o el lector. '
    + 'Eso se decide y se escribe; no se re-mide para que cuadre.');
  assert.deepEqual(problemasDeLaLista(SIN_TRAMO_CONGELADOS, foto), [], '🔴 la lista congelada ha crecido o está mal');

  // Controles: cada puerta de `problemasDeLaLista` cae con su caso, y no cae sin él.
  const dentro = SIN_TRAMO_CONGELADOS[0];
  assert.deepEqual(problemasDeLaLista([dentro], foto), [], `🔴 «${dentro}», de la lista, sale con problemas`);
  assert.match(problemasDeLaLista([dentro, '99001z'], foto).join(' · '), /«99001z» no la nombra ningún asunto/,
    '🔴 una entrada que no nombra la historia congelada entra en la lista');
  const conTramoEnLaFoto = foto.clasif.conTramo[0].clave;
  assert.match(problemasDeLaLista([dentro, conTramoEnLaFoto], foto).join(' · '), new RegExp(`«${conTramoEnLaFoto}» ya tenía tramo`),
    '🔴 una entrada que ya tenía tramo en la foto entra en la lista');
  assert.match(problemasDeLaLista([dentro, dentro], foto).join(' · '), new RegExp(`«${dentro}» está repetida`),
    '🔴 una entrada repetida pasa');
  // Rellena hasta UNA por encima del tope, sea cual sea la longitud de hoy: la lista BAJA, y un
  // control que sólo añade una entrada deja de pasar del tope en cuanto baja la primera (me pasó).
  const deMas = [...SIN_TRAMO_CONGELADOS, ...Array(TOPE_DE_LA_LISTA + 1 - SIN_TRAMO_CONGELADOS.length).fill(dentro)];
  assert.match(problemasDeLaLista(deMas, foto).join(' · '), /el tope medido es/, '🔴 la lista pasa del tope sin que nada lo diga');
  assert.doesNotMatch(problemasDeLaLista(SIN_TRAMO_CONGELADOS, foto).join(' · '), /el tope medido es/,
    '🔴 la lista congelada, tal cual, ya pasa del tope');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑥ CONTROL DEL TRINQUETE sobre la población real
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-1839b · 🔴 ⑥ CONTROL DEL TRINQUETE sobre la población real: quitar una entrada o meter una con tramo lo hace caer', () => {
  const p = poblacion();
  const base = contraLaLista(p.clasif, SIN_TRAMO_CONGELADOS);
  assert.deepEqual([base.nuevos.length, base.sobran.length], [0, 0], '🔴 la base no está limpia: este control no distingue nada');
  // Hacia arriba: una entrada quitada que sigue sin tramo sale como nueva, con su nombre.
  const quitada = SIN_TRAMO_CONGELADOS.find((c) => [...p.clasif.sinTramo, ...p.clasif.sinFichero].some((x) => x.clave === c));
  assert.ok(quitada, '🔴 NO MEDIDO: la lista está vacía. Cuando llegue a cero, este caso se retira con ella.');
  const sinUna = contraLaLista(p.clasif, SIN_TRAMO_CONGELADOS.filter((c) => c !== quitada));
  assert.deepEqual(sinUna.nuevos.map((x) => x.clave), [quitada], `🔴 quitar «${quitada}» de la lista no la hace caer`);
  assert.match(comoPar(sinUna.nuevos[0]), new RegExp(`^${quitada} · docs/master/SCRUM-\\d+\\.md · lo nombra `));
  // Hacia abajo: un par con tramo metido en la lista sale como sobrante.
  const conTramo = p.clasif.conTramo[0].clave;
  const conUnaDeMas = contraLaLista(p.clasif, [...SIN_TRAMO_CONGELADOS, conTramo]);
  assert.deepEqual(conUnaDeMas.sobran.map((x) => x.clave), [conTramo], `🔴 «${conTramo}», con tramo, pasa en la lista sin que nada lo diga`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN (SCRUM-745) · las ejecuta `npm run meta:mutaciones`
// ═════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Sin borde: `99001zz` y `199001z` pasan a contar como tramo de 99001z.
    fichero: 'tests/scrum1839-letra-con-tramo.test.mjs',
    de: 'const tokenDeTramo = (n, letra) => new RegExp(`(?<![0-9A-Za-z])${n}${letra}(?![0-9A-Za-z])`);',
    a: 'const tokenDeTramo = (n, letra) => new RegExp(`${n}${letra}`);',
    cae: 'BORDES: ni 99001zz',
  },
  {
    // La cabecera deja de ser literal: `###` pasa a contar.
    fichero: 'tests/scrum1839-letra-con-tramo.test.mjs',
    de: 'const RE_CABECERA = /^#{1,2}(?!#)/;',
    a: 'const RE_CABECERA = /^#{1,6}(?!#)/;',
    cae: 'BORDES: ni 99001zz',
  },
  {
    // El trinquete deja de ver las letras nuevas sin tramo.
    fichero: 'tests/scrum1839-letra-con-tramo.test.mjs',
    de: '  const nuevos = sin.filter((p) => !enLista.has(p.clave));',
    a: '  const nuevos = [];',
    cae: 'un asunto sembrado sin tramo es ROJO',
  },
];
