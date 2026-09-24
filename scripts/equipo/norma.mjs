// scripts/equipo/norma.mjs — SCRUM-996 · las normas comunes POR SECCIONES, no enteras
//
//   node scripts/equipo/norma.mjs [--arranque]     el subconjunto de arranque (es lo que hace sin argumentos)
//   node scripts/equipo/norma.mjs --lista          el índice de TODAS las secciones, con su tamaño
//   node scripts/equipo/norma.mjs A23 [A22 …]      esas secciones, y solo esas
//   node scripts/equipo/norma.mjs --todo           el fichero entero
//   opciones:  --fichero <ruta>   lee ese fichero (tests, o quien no tenga origin/main)
//              --origen <ref>     otra referencia de git en vez de `origin/main`
//              --entera           no corta A19 antes de su historia
//
// ── POR QUÉ EXISTE ────────────────────────────────────────────────────────────────────────────
// Cada sesión nueva del equipo arranca leyendo `docs/equipo/00-normas-comunes.md` ENTERO (51,8 KB,
// unos 25.000 tokens a 2,2 B/token: es una ESTIMACIÓN, no un conteo del tokenizador) y su
// traspaso (11,4 KB de media). Con las dos lecturas, un relevo cuesta ~55.000 tokens ANTES de
// hacer nada, y esos tokens se vuelven a pagar (como caché leída) en cada turno de la sesión.
// El suelo de arranque se mide con `gasto-arranque.mjs`; este script es la mitad que lo baja:
// 13 de las 24 secciones son las que hay que saber ANTES de tocar nada (tanda, PASO 0, medir, git,
// lo que no se toca, entrega, fallos, ticket, informe, encargo, relevo, carril, PR), y las otras
// 11 son consulta: el arranque imprime su ÍNDICE (id, título y tamaño) y se traen a demanda.
//
// ── LO QUE HACE Y LO QUE NO ───────────────────────────────────────────────────────────────────
// Solo LEE y solo IMPRIME: no escribe nada, no hace `fetch`, no toca el fichero. Y no se calla:
//   · la fuente por defecto es `git show origin/main:docs/equipo/00-normas-comunes.md`. Si no se
//     puede leer, es «NO PUDE MIRAR» (salida 2). NO hay caída silenciosa al árbol de trabajo: un
//     checkout viejo daría normas fósiles y la sesión creería tener las de hoy.
//   · las 14 secciones de arranque se buscan por id Y por título. Si falta una, o su título ya no
//     casa, es «NO PUDE MIRAR» y NO se imprime un subconjunto en verde: referenciar por posición
//     caduca en cuanto alguien renumera, y un arranque que omite en silencio A13 es peor que uno
//     que falla.
//   · un id que aparece dos veces es ambiguo: salida 2.
//   · el corte de A19 (la historia de sus versiones anteriores) se DECLARA en la salida, con la
//     orden que trae la sección completa; si el marcador ya no está, se imprime ENTERA y también
//     se declara.
//
// Salida: 0 = impreso · 2 = NO PUDE MIRAR o argumentos que no se entienden. No existe el 1: aquí
// no hay «algo que listar», o se leyó o no se leyó. La última línea trae `EXIT=<código>` y sale de
// la MISMA variable que se pasa a `process.exit`.
//
// Bytes y sha256 son los del texto con LF: un fichero convertido a CRLF por un editor da la misma
// cuenta y las mismas secciones (el repo tiene ficheros de los dos tipos).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const RUTA_NORMAS = 'docs/equipo/00-normas-comunes.md';
export const ORIGEN_POR_DEFECTO = 'origin/main';
export const MARCADOR_DE_CORTE_A19 = 'Cuarta versión';
export const MAX_BUFFER = 20 * 1024 * 1024;

/** Las secciones que tienen un corte y por dónde se cortan. */
export const CORTES = { A19: MARCADOR_DE_CORTE_A19 };

/**
 * Las 14 secciones que se leen al arrancar. `titulo` es un TROZO del título real (no el título
 * entero): si la sección se renumera o se retitula, el arranque avisa en vez de callar.
 */
export const ARRANQUE = [
  { id: 'A1', titulo: 'Cada tanda' },
  { id: 'A2', titulo: 'PASO 0' },
  { id: 'A3', titulo: 'Cómo se mide' },
  { id: 'A4', titulo: 'Git' },
  { id: 'A7', titulo: 'Lo que no se toca' },
  { id: 'A8', titulo: 'Cómo se entrega' },
  { id: 'A9', titulo: 'Cuando algo te sale mal' },
  { id: 'A13', titulo: 'El ticket' },
  { id: 'A14', titulo: 'Todo informe empieza' },
  { id: 'A16', titulo: 'Repite el encargo' },
  { id: 'A19', titulo: 'El PUESTO es fijo' },
  { id: 'A20', titulo: 'Si el encargo cae fuera' },
  { id: 'A24', titulo: 'El PR lo abre el bot' },
  { id: 'A25', titulo: 'Eficiencia y gasto' },
];

export const PUNTEROS = 'Trampas de la máquina: docs/equipo/trampas-del-entorno.md · coordinación: '
  + 'docs/equipo/orquestador.md · puestos: docs/equipo/dos-equipos.md';

const USO = 'uso: node scripts/equipo/norma.mjs [--arranque] | --lista | --todo | A23 [A22 …] '
  + '[--fichero <ruta> | --origen <ref>] [--entera]';

/** «No pude mirar»: siempre salida 2, nunca un verde. */
export class NoPudeMirar extends Error {
  constructor(motivo) { super(motivo); this.name = 'NoPudeMirar'; this.motivo = motivo; }
}
/** Argumentos que no se entienden: también salida 2. */
export class ErrorDeUso extends Error {
  constructor(motivo) { super(motivo); this.name = 'ErrorDeUso'; this.motivo = motivo; }
}

const bytesDe = (s) => Buffer.byteLength(s, 'utf8');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Lectura y parseo (puros salvo `leerFuente`)
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Quita el BOM y unifica los finales de línea a LF. */
export function normalizar(entrada) {
  let t = Buffer.isBuffer(entrada) ? entrada.toString('utf8') : String(entrada);
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  return t.replace(/\r\n/g, '\n');
}

/** Empaqueta lo leído con sus cifras: bytes y sha256 del texto NORMALIZADO. */
export function prepararFuente(etiqueta, contenido) {
  const bruto = Buffer.isBuffer(contenido) ? contenido : Buffer.from(String(contenido), 'utf8');
  if (bruto.length === 0) throw new NoPudeMirar(`${etiqueta} está vacío`);
  const texto = normalizar(bruto);
  return {
    etiqueta,
    texto,
    bytes: bytesDe(texto),
    bytesBrutos: bruto.length,
    sha8: crypto.createHash('sha256').update(texto, 'utf8').digest('hex').slice(0, 8),
  };
}

/**
 * Lee las normas. Con `fichero`, ese fichero; si no, `git show <origen>:<ruta>` desde `cwd`, en
 * bytes crudos. Cualquier fallo es NoPudeMirar: no hay caída al árbol de trabajo.
 */
export function leerFuente({ fichero = null, origen = null, cwd = process.cwd() } = {}) {
  if (fichero) {
    try {
      return { etiqueta: `fichero:${fichero}`, contenido: fs.readFileSync(path.resolve(fichero)) };
    } catch (e) {
      throw new NoPudeMirar(`no pude leer ${fichero} (${e.code || e.message})`);
    }
  }
  const ref = origen || ORIGEN_POR_DEFECTO;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/@{}~^-]*$/.test(ref)) {
    throw new NoPudeMirar(`«${ref}» no parece una referencia de git`);
  }
  try {
    const contenido = execFileSync('git', ['show', `${ref}:${RUTA_NORMAS}`], {
      cwd, maxBuffer: MAX_BUFFER, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { etiqueta: `${ref}:${RUTA_NORMAS}`, contenido };
  } catch (e) {
    const detalle = e.stderr ? String(e.stderr).trim().split(/\r?\n/)[0] : (e.code || e.message);
    throw new NoPudeMirar(`git show ${ref}:${RUTA_NORMAS} falló (${detalle}) (¿git fetch origin?)`);
  }
}

const RE_SECCION = /^## (A\d+) · (.+)$/;

/** Quita las líneas en blanco del final. */
function sinFinalEnBlanco(lineas) {
  let n = lineas.length;
  while (n > 0 && lineas[n - 1].trim() === '') n--;
  return lineas.slice(0, n);
}

/**
 * Parte el texto en secciones. Una sección empieza en `## A<n> · <título>` y llega hasta la
 * siguiente; los `###` NO parten (A22.1 y A22.2 son de A22). Lo anterior a la primera es la
 * cabecera. Un id repetido es NoPudeMirar: no se elige entre dos.
 */
export function parsearSecciones(texto) {
  const cabecera = [];
  const crudas = [];
  let actual = null;
  for (const linea of String(texto).split(/\r?\n/)) {
    const m = RE_SECCION.exec(linea);
    if (m) {
      actual = { id: m[1], titulo: m[2].trim(), lineas: [linea] };
      crudas.push(actual);
    } else {
      (actual ? actual.lineas : cabecera).push(linea);
    }
  }
  const vistos = new Set();
  for (const s of crudas) {
    if (vistos.has(s.id)) throw new NoPudeMirar(`la sección ${s.id} aparece dos veces: es ambiguo`);
    vistos.add(s.id);
  }
  const secciones = crudas.map((s) => {
    const lineas = sinFinalEnBlanco(s.lineas);
    const textoSeccion = lineas.join('\n');
    return { id: s.id, titulo: s.titulo, lineas, texto: textoSeccion, bytes: bytesDe(textoSeccion) };
  });
  return { cabecera: sinFinalEnBlanco(cabecera).join('\n'), secciones };
}

/**
 * Las secciones de `lista` (por defecto ARRANQUE), en ese orden. Si una falta o su título ya no
 * casa, NoPudeMirar: nunca un subconjunto.
 */
export function seleccionarArranque(secciones, lista = ARRANQUE) {
  const porId = new Map(secciones.map((s) => [s.id, s]));
  return lista.map((req) => {
    const s = porId.get(req.id);
    if (!s || !s.titulo.includes(req.titulo)) {
      throw new NoPudeMirar(`la sección ${req.id} no está o cambió de título `
        + `(esperaba un título con «${req.titulo}»${s ? `, hay «${s.titulo}»` : ''})`);
    }
    return s;
  });
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Presentación (pura)
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Lo que se imprime de UNA sección: el texto exacto del fichero, salvo el corte declarado (A19).
 * Devuelve el texto, sus bytes (sin la nota, que es del script y no del fichero) y la nota.
 */
export function imprimirSeccion(sec, { entera = false } = {}) {
  const marcador = entera ? null : CORTES[sec.id];
  if (!marcador) return { texto: sec.texto, bytes: sec.bytes, nota: null };
  const i = sec.lineas.findIndex((l, k) => k > 0 && l.includes(marcador));
  if (i === -1) {
    return { texto: sec.texto, bytes: sec.bytes, nota: `[${sec.id}: no encontré el corte; impresa entera]` };
  }
  const texto = sinFinalEnBlanco(sec.lineas.slice(0, i)).join('\n');
  return {
    texto,
    bytes: bytesDe(texto),
    nota: `[${sec.id} cortada antes de «${marcador}» (historia); \`norma.mjs ${sec.id} --entera\` la trae completa]`,
  };
}

function bloqueDe(sec, opciones) {
  const p = imprimirSeccion(sec, opciones);
  return { bloque: p.nota ? `${p.texto}\n${p.nota}` : p.texto, bytes: p.bytes };
}

const lineaDeIndice = (s) => `${s.id} · ${s.titulo} (${s.bytes} B)`;

/** La primera línea de toda salida: de dónde salió, cuánto pesa, qué versión y cuántas secciones. */
export function lineaDeFuente(fuente, nSecciones) {
  return `norma.mjs · origen ${fuente.etiqueta} · ${fuente.bytes} B · sha256 ${fuente.sha8} · ${nSecciones} secciones`;
}

/** El pie común. `codigo` llega por argumento: es el MISMO que sale por `process.exit`. */
export function lineaFinal({ impresas, bytesImpresos, total, sinLeer }, codigo) {
  const pct = total > 0 ? Math.round((100 * bytesImpresos) / total) : 0;
  return `norma.mjs · impresas=${impresas} · ${bytesImpresos} B de ${total} B (${pct} %) · sin leer=${sinLeer} · EXIT=${codigo}`;
}

/** El subconjunto de arranque + el índice de lo que no se ha impreso. */
export function renderizarArranque({ fuente, parseo, entera = false }) {
  const elegidas = seleccionarArranque(parseo.secciones);
  const bloques = elegidas.map((s) => bloqueDe(s, { entera }));
  const impresas = new Set(elegidas.map((s) => s.id));
  const resto = parseo.secciones.filter((s) => !impresas.has(s.id));
  const cuerpo = [
    lineaDeFuente(fuente, parseo.secciones.length),
    PUNTEROS,
    '',
    bloques.map((b) => b.bloque).join('\n\n'),
    '',
    'ÍNDICE de lo que NO has leído (se trae con `node scripts/equipo/norma.mjs A23`):',
    ...resto.map(lineaDeIndice),
  ].join('\n');
  return {
    cuerpo,
    pie: (codigo) => lineaFinal({
      impresas: elegidas.length,
      bytesImpresos: bloques.reduce((s, b) => s + b.bytes, 0),
      total: fuente.bytes,
      sinLeer: resto.length,
    }, codigo),
  };
}

/** Las secciones pedidas por id, y solo esas. Un id que no existe es NoPudeMirar. */
export function renderizarIds({ fuente, parseo, ids, entera = false }) {
  const porId = new Map(parseo.secciones.map((s) => [s.id, s]));
  const pedidas = ids.map((id) => {
    const s = porId.get(id);
    if (!s) throw new NoPudeMirar(`la sección ${id} no existe (hay ${parseo.secciones.map((x) => x.id).join(' ')})`);
    return s;
  });
  const bloques = pedidas.map((s) => bloqueDe(s, { entera }));
  const cuerpo = [lineaDeFuente(fuente, parseo.secciones.length), '', bloques.map((b) => b.bloque).join('\n\n')].join('\n');
  return {
    cuerpo,
    pie: (codigo) => lineaFinal({
      impresas: pedidas.length,
      bytesImpresos: bloques.reduce((s, b) => s + b.bytes, 0),
      total: fuente.bytes,
      sinLeer: parseo.secciones.length - pedidas.length,
    }, codigo),
  };
}

/** El índice de TODAS las secciones con su tamaño. */
export function renderizarLista({ fuente, parseo }) {
  const cuerpo = [lineaDeFuente(fuente, parseo.secciones.length), ...parseo.secciones.map(lineaDeIndice)].join('\n');
  return {
    cuerpo,
    pie: (codigo) => `norma.mjs · listadas=${parseo.secciones.length} · ${fuente.bytes} B · EXIT=${codigo}`,
  };
}

/** El fichero entero (con LF), con su línea de fuente y su pie. */
export function renderizarTodo({ fuente, parseo }) {
  return {
    cuerpo: [lineaDeFuente(fuente, parseo.secciones.length), fuente.texto.replace(/\n+$/, '')].join('\n'),
    pie: (codigo) => lineaFinal({
      impresas: parseo.secciones.length, bytesImpresos: fuente.bytes, total: fuente.bytes, sinLeer: 0,
    }, codigo),
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Argumentos y ejecución
// ═════════════════════════════════════════════════════════════════════════════════════════════

export function parsearArgs(argv) {
  const o = { modo: null, ids: [], fichero: null, origen: null, entera: false };
  const fijar = (modo) => {
    if (o.modo && o.modo !== modo) throw new ErrorDeUso(`modos incompatibles: ${o.modo} y ${modo}`);
    o.modo = modo;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--arranque') fijar('arranque');
    else if (a === '--lista') fijar('lista');
    else if (a === '--todo') fijar('todo');
    else if (a === '--entera') o.entera = true;
    else if (a === '--fichero' || a === '--origen') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new ErrorDeUso(`${a} necesita un valor`);
      o[a.slice(2)] = v;
    } else if (/^A\d+$/i.test(a)) {
      fijar('ids');
      const id = a.toUpperCase();
      if (!o.ids.includes(id)) o.ids.push(id);
    } else {
      throw new ErrorDeUso(`argumento desconocido «${a}»`);
    }
  }
  if (!o.modo) o.modo = 'arranque';
  if (o.fichero && o.origen) throw new ErrorDeUso('--fichero y --origen son excluyentes');
  return o;
}

/**
 * Todo el programa menos escribir en pantalla. Devuelve `{codigo, texto}`; el `EXIT=` del texto
 * sale de la misma variable `codigo` que se devuelve. `deps.leer` permite probarlo sin git.
 */
export function ejecutar(argv, deps = {}) {
  const leer = deps.leer || leerFuente;
  let codigo = 2;
  let cuerpo;
  let pie = null;
  try {
    const args = parsearArgs(argv);
    const lectura = leer({ fichero: args.fichero, origen: args.origen, cwd: deps.cwd || process.cwd() });
    const fuente = prepararFuente(lectura.etiqueta, lectura.contenido);
    const parseo = parsearSecciones(fuente.texto);
    if (parseo.secciones.length === 0) {
      throw new NoPudeMirar(`${fuente.etiqueta} no trae ninguna sección «## A<n> · título» (¿cambió el formato?)`);
    }
    const r = args.modo === 'lista' ? renderizarLista({ fuente, parseo })
      : args.modo === 'todo' ? renderizarTodo({ fuente, parseo })
        : args.modo === 'ids' ? renderizarIds({ fuente, parseo, ids: args.ids, entera: args.entera })
          : renderizarArranque({ fuente, parseo, entera: args.entera });
    cuerpo = r.cuerpo;
    pie = r.pie;
    codigo = 0;
  } catch (e) {
    codigo = 2;
    if (e instanceof NoPudeMirar) cuerpo = `NO PUDE MIRAR: ${e.motivo}`;
    else if (e instanceof ErrorDeUso) cuerpo = `NO PUDE MIRAR: argumentos (${e.motivo})\n${USO}`;
    else cuerpo = `NO PUDE MIRAR: error inesperado (${e && e.message ? e.message : e})`;
  }
  const final = pie ? pie(codigo) : `norma.mjs · impresas=0 · EXIT=${codigo}`;
  return { codigo, texto: `${cuerpo}\n${final}\n` };
}

/** ¿Es este el script que ejecuta `node`, y no un `import` de un test? */
function esElScriptEjecutado() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync.native(process.argv[1]) === fs.realpathSync.native(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (esElScriptEjecutado()) {
  const r = ejecutar(process.argv.slice(2));
  // Se sale DESPUÉS de vaciar la salida: con 52 KB en una tubería, `exit` a secas puede cortarla.
  process.stdout.write(r.texto, () => process.exit(r.codigo));
}
