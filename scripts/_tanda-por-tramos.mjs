// scripts/_tanda-por-tramos.mjs — SCRUM-1412
//
// Lo que le faltaba a `tanda:dirigida` (`scripts/tests-que-cubren.mjs`) y se vio USÁNDOLA:
//
//   ① dijo «2 fail» y nombró uno: `# fail` cuenta también los caídos ANIDADOS (un subtest que cae
//      tumba a su padre: son dos) y sólo se recogían los `not ok` de primer nivel. Ahora se nombran
//      a cualquier profundidad, y si aun así faltan, se DICE cuántos no se supieron nombrar;
//   ② un test que en ESTA máquina no puede medir (el temporal en `C:`, el árbol en `D:`) salía
//      como un rojo más, y cada puesto pagaba el peaje de decidir si era suyo. Se cuenta aparte,
//      con la condición MEDIDA en la máquina, no supuesta;
//   ③ una pasada de más de diez minutos se va sola al fondo, y viva y muerta se veían igual: una
//      línea por lote al terminar, y `--tramo i/n` con un resumen que EXIGE haber visto los n.
//
// ⛔ NINGUNA estimación de tiempo: el TAP de una tanda no dice de qué fichero es cada test, así que
//    no hay duraciones medidas por fichero de las que sacarla. Lo que se imprime es lo que tardó lo
//    que ya corrió. Una cifra inventada es peor que ninguna.
//
// Funciones puras salvo las cuatro de abajo que tocan disco (el registro de tramos vistos), que
// reciben su directorio: los tests les dan uno temporal.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

/** Por encima de esto, una dirigida entera no cabe en diez minutos en la máquina tipo. */
export const UMBRAL_PARA_TROCEAR = 150;
/** Lo que S4 corrió a mano el 1-oct: 426 ficheros en tramos de 70, cada uno en primer plano. */
export const FICHEROS_POR_TRAMO = 70;

/** Los `not ok` del TAP, a CUALQUIER profundidad. */
export function caidosDelTap(texto) {
  return [...String(texto).matchAll(/^[ \t]*not ok \d+ - (.*)$/gm)].map((m) => m[1].trimEnd());
}

/** Cuántos caídos cuenta el TAP que no sé nombrar. Sin recuento (`null`), no se sabe: `null`. */
export function sinNombrar(fail, caidos) {
  if (fail == null) return null;
  return Math.max(0, fail - caidos.length);
}

/**
 * Las condiciones de entorno que esta casa sabe MEDIR. Una declaración que nombre otra es un error
 * de la declaración, no un ciego: se lanza.
 */
export const CONDICIONES = {
  /** El temporal y el árbol en unidades distintas: `path.relative` entre los dos no se alcanza. */
  'temporal-en-otra-unidad': ({ raiz, tmp }) => {
    const unidad = (p) => path.parse(path.resolve(p)).root.toLowerCase();
    return unidad(raiz) !== unidad(tmp);
  },
};

/** Lee y valida `scripts/_ciegos-por-entorno-declarados.json`. */
export function leerCiegosDeclarados(fichero) {
  const crudo = fs.readFileSync(fichero, 'utf8');
  const lista = JSON.parse(crudo.charCodeAt(0) === 0xfeff ? crudo.slice(1) : crudo);
  if (!Array.isArray(lista)) throw new Error(`${fichero}: tiene que ser una lista`);
  for (const d of lista) {
    if (!d || typeof d.test !== 'string' || !d.test || typeof d.motivo !== 'string' || !d.motivo) {
      throw new Error(`${fichero}: cada entrada lleva «test» y «motivo»`);
    }
    if (!Object.hasOwn(CONDICIONES, d.condicion)) throw new Error(`${fichero}: condición «${d.condicion}» desconocida (sé medir: ${Object.keys(CONDICIONES).join(', ')})`);
  }
  return lista;
}

/**
 * Parte los caídos en «tuyos» y «ciegos por entorno». Un caído sólo es ciego por entorno si está
 * DECLARADO por su nombre exacto Y su condición se cumple en esta máquina. Declarado con la
 * condición sin cumplirse, es un rojo como cualquier otro: ahí el test sí podía medir.
 */
export function partirCaidos(caidos, declarados, entorno = { raiz: process.cwd(), tmp: os.tmpdir() }) {
  const tuyos = [];
  const porEntorno = [];
  for (const nombre of caidos) {
    const d = declarados.find((x) => x.test === nombre);
    if (d && CONDICIONES[d.condicion](entorno)) porEntorno.push({ test: nombre, condicion: d.condicion, motivo: d.motivo });
    else tuyos.push(nombre);
  }
  return { tuyos, porEntorno };
}

/**
 * El veredicto de UNA dirigida (o de un tramo): quién cayó por ti, quién por la máquina, y cuántos
 * cuenta el TAP que no se saben nombrar. Salida: 1 si hay caídos tuyos o sin nombrar · 2 si no hay
 * rojos pero algún lote no se pudo medir · 0 si no. Los ciegos por entorno NO deciden.
 */
export function veredictoDeLaDirigida({ fail, caidos, ciegos = [] }, declarados, entorno) {
  const { tuyos, porEntorno } = partirCaidos(caidos, declarados, entorno);
  const faltan = sinNombrar(fail, caidos) ?? 0;
  const lineas = tuyos.map((c) => `  not ok · ${c}`);
  if (faltan) lineas.push(`  🔴 NO SUPE NOMBRAR ${faltan} de los ${fail} caídos: el TAP los cuenta y no los encuentro por nombre. Léelo con --tap=<fichero>.`);
  for (const c of porEntorno) lineas.push(`  ciego por entorno, no es tu cambio · ${c.test}\n      (${c.condicion}) ${c.motivo}`);
  if (porEntorno.length) lineas.push(`  De los ${fail} fail, ${porEntorno.length} son ciegos por entorno de ESTA máquina: no deciden la salida. El CI sí los mide.`);
  const salida = tuyos.length || faltan ? 1 : ciegos.length ? 2 : 0;
  return { tuyos, porEntorno, sinNombrar: faltan, lineas, salida };
}

/** `1m40s`, `45s`. Sólo se le pasan duraciones MEDIDAS. */
export function duracion(ms) {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

/** La línea que sale al TERMINAR cada lote: con ella, una pasada viva y una muerta dejan de verse igual. */
export function lineaDeLote({ i, n, ficheros, tests, fail, ms }) {
  const cuenta = tests ? `${tests} tests · ${fail ?? 0} fail` : 'SIN RECUENTO';
  return `lote ${i}/${n} · ${ficheros} ficheros · ${cuenta} · ${duracion(ms)}`;
}

/** `2/4` → `{ i: 2, n: 4 }`, o `null` si no tiene esa forma o no es un tramo que exista. */
export function parsearTramo(texto) {
  const m = /^(\d+)\/(\d+)$/.exec(String(texto ?? ''));
  if (!m) return null;
  const i = Number(m[1]);
  const n = Number(m[2]);
  return i >= 1 && n >= 1 && i <= n ? { i, n } : null;
}

/** Los ficheros del tramo `i` de `n`: trozos contiguos de la lista ORDENADA, sin solapes ni huecos. */
export function tramoDe(elegidos, i, n) {
  if (n > elegidos.length) throw new Error(`no hay ${n} tramos en ${elegidos.length} ficheros`);
  const tam = Math.ceil(elegidos.length / n);
  return elegidos.slice((i - 1) * tam, i * tam);
}

/** En cuántos tramos se propone trocear una selección que no cabe entera. */
export function tramosPropuestos(cuantos) {
  return Math.max(1, Math.ceil(cuantos / FICHEROS_POR_TRAMO));
}

/**
 * La identidad de UNA pasada: qué ficheros, en cuántos tramos y sobre qué árbol. Dos tramos sólo
 * se suman si la comparten. Si el árbol cambia entre el tramo 1 y el 3, son pasadas distintas y a
 * la nueva le faltan tramos: sale CIEGO, no un verde cosido con mitades de dos árboles.
 */
export function huellaDeLaPasada({ elegidos, n, arbol }) {
  return crypto.createHash('sha256').update(JSON.stringify({ elegidos, n, arbol })).digest('hex').slice(0, 16);
}

export const dirDeLaPasada = (base, huella) => path.join(base, huella);

export function guardarTramo(dir, registro) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `tramo-${registro.i}.json`), JSON.stringify(registro));
}

export function leerTramos(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^tramo-\d+\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

export function olvidarPasada(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * El veredicto de la PASADA. Exige los `n` tramos: si falta uno es CIEGO aunque los vistos estén
 * en verde, y un tramo sin recuento o con caídos sin nombrar tampoco deja decir «verde».
 */
export function resumenDeTramos(registros, n) {
  const vistos = new Map(registros.filter((r) => r.n === n && r.i >= 1 && r.i <= n).map((r) => [r.i, r]));
  const faltan = [];
  for (let i = 1; i <= n; i++) if (!vistos.has(i)) faltan.push(i);
  const de = [...vistos.values()];
  const suma = (k) => de.reduce((a, r) => a + (r[k] || 0), 0);
  const total = {
    ficheros: suma('ficheros'), tests: suma('tests'), pass: suma('pass'), fail: suma('fail'), ms: suma('ms'),
    tuyos: de.flatMap((r) => r.tuyos || []),
    porEntorno: de.flatMap((r) => r.porEntorno || []),
    sinNombrar: suma('sinNombrar'),
    ciegos: de.flatMap((r) => (r.ciegos || []).map((c) => `tramo ${r.i}: ${c}`)),
  };
  const rojo = total.tuyos.length > 0 || total.sinNombrar > 0;
  const ciego = faltan.length > 0 || total.ciegos.length > 0;
  const veredicto = rojo ? 'ROJO' : ciego ? 'CIEGO' : 'VERDE';
  return { n, vistos: [...vistos.keys()].sort((a, b) => a - b), faltan, total, veredicto };
}

/** Las líneas del resumen de la pasada, para personas. */
export function lineasDelResumen(r) {
  const t = r.total;
  const lineas = [
    `PASADA POR TRAMOS: vistos ${r.vistos.length} de ${r.n}${r.vistos.length ? ` (${r.vistos.join(', ')})` : ''} · ${t.ficheros} ficheros · ${t.tests} tests · ${t.pass} pass · ${t.fail} fail · ${duracion(t.ms)} medidos`,
  ];
  if (r.faltan.length) lineas.push(`  🔴 CIEGO: faltan los tramos ${r.faltan.join(', ')} de ${r.n}. Lo visto no es un verde: es una parte.`);
  for (const c of t.ciegos) lineas.push(`  🔴 CIEGO · ${c}`);
  for (const c of t.tuyos) lineas.push(`  not ok · ${c}`);
  if (t.sinNombrar) lineas.push(`  🔴 NO SUPE NOMBRAR ${t.sinNombrar} caído(s): el TAP los cuenta y no los encuentro por nombre.`);
  for (const c of t.porEntorno) lineas.push(`  ciego por entorno, no es tu cambio · ${c.test}`);
  lineas.push(`  VEREDICTO DE LA PASADA: ${r.veredicto}`);
  return lineas;
}
