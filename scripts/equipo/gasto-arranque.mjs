// scripts/equipo/gasto-arranque.mjs — SCRUM-996 · el instrumento que MIDE lo que cuesta arrancar
//
//   node scripts/equipo/gasto-arranque.mjs sesiones   [--horas 24] [--min-turnos 40] [--desde <ISO con huso>] [--nombre <sN>]
//   node scripts/equipo/gasto-arranque.mjs arranque   <nombre> [--turnos 24]
//   node scripts/equipo/gasto-arranque.mjs resultados [--horas 24] [--min-turnos 40]
//   node scripts/equipo/gasto-arranque.mjs traspaso   <sN> | --fichero <ruta> [--tope 5120]
//
// ── POR QUÉ EXISTE ────────────────────────────────────────────────────────────────────────────
// Una sesión nueva paga, antes de hacer nada, lo que lee al arrancar (normas + traspaso + fichas +
// adjuntos), y ese suelo se vuelve a pagar como caché leída en CADA turno. Cinco prototipos sueltos
// lo midieron el 21-sep-2026 y cada uno vivía en un temporal: no se podía repetir ni comparar
// «antes» y «después». Este fichero los junta en UN instrumento con criterio de aceptación:
//
//   CRITERIO SCRUM-996: U8 mediano ≤ 90.000 tokens · lectura de arranque ≤ 10 % del contexto.
//
//   U1  = contexto del PRIMER turno del asistente (el «suelo»: lo que ya cargó sin leer nada).
//   U8  = contexto del turno 8. La LECTURA de arranque es U8 − U1: lo que la sesión leyó para
//         ponerse en marcha.
//   contexto de un turno = input + cache_read + cache_creation (SIN output_tokens).
//
// ── QUÉ SE CUENTA COMO TURNO ──────────────────────────────────────────────────────────────────
// Las entradas `type:"assistant"` con `message.usage`, DEDUPLICADAS por `message.id`: el jsonl
// escribe varias líneas por mensaje (una por bloque) y vale el ÚLTIMO usage de cada id, en el orden
// en que el id apareció por primera vez. Contar líneas en vez de mensajes infla los turnos y
// desplaza U8 al turno 4.
//
// ── LO QUE ES ESTIMACIÓN Y SE DICE ────────────────────────────────────────────────────────────
//   · Los PESOS del coste ponderado (input 1 · cache-write 1,25 · cache-read 0,1 · output 5) son
//     precios relativos SUPUESTOS de la API; la cuota real de la suscripción puede ponderar
//     distinto. Salen impresos en cada informe que los usa.
//   · 2,2 bytes/token es una calibración con documentos en español, NO el tokenizador.
//
// ── QUÉ NO HACE ───────────────────────────────────────────────────────────────────────────────
// Solo LEE `~/.claude/jobs/*/state.json` (o `$CLAUDE_JOBS_DIR`) y los jsonl a los que apuntan;
// no escribe nada. Tolera líneas rotas (la última de un jsonl vivo suele estar a medias): las
// cuenta y las declara. Toda salida trae su POBLACIÓN y termina en `EXIT=<código>`.
//
// Salida: 0 = medido (y, en `sesiones`, el criterio se CUMPLE; en `traspaso`, cabe en el tope) ·
// 1 = medido y NO cumple / excede el tope · 2 = NO PUDE MIRAR (población cero, ficheros ilegibles,
// argumentos que no se entienden). Población cero NUNCA es un verde.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PESOS = { input: 1, creation: 1.25, read: 0.1, output: 5 };
export const BYTES_POR_TOKEN = 2.2;
export const UMBRAL_RESULTADO_GRANDE = 6000;
export const HORAS_POR_DEFECTO = 24;
export const MIN_TURNOS_POR_DEFECTO = 40;
export const TURNOS_POR_DEFECTO = 24;
export const TURNO_LECTURA = 8;
export const OBJETIVO_U8 = 90000;
export const OBJETIVO_LECTURA_PCT = 10;
export const TOPE_TRASPASO_POR_DEFECTO = 5120;

const TEXTO_PESOS = 'pesos SUPUESTOS de precio relativo (no la cuota real): '
  + 'input 1 · cache-write 1,25 · cache-read 0,1 · output 5';

const USO = [
  'uso: node scripts/equipo/gasto-arranque.mjs <subcomando>',
  '  sesiones   [--horas 24] [--min-turnos 40] [--desde <ISO con huso>] [--nombre <sN>]',
  '  arranque   <nombre> [--turnos 24]',
  '  resultados [--horas 24] [--min-turnos 40]',
  '  vivas      [--horas 2] [--umbral 200000] [--simular <umbral>]   quién toca relevar YA (SCRUM-1070)',
  '  traspaso   <sN> | --fichero <ruta> [--tope 5120]',
].join('\n');

/** Argumentos que no se entienden: salida 2. */
export class ErrorDeUso extends Error {
  constructor(motivo) { super(motivo); this.name = 'ErrorDeUso'; this.motivo = motivo; }
}

const num = (x) => (Number.isFinite(x) ? x : 0);
const bytesDeTexto = (s) => Buffer.byteLength(s, 'utf8');
const pct1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '0.0');
const millones = (x) => `${(x / 1e6).toFixed(1)}M`;

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Lectura del jsonl (pura)
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Bytes de lo que devuelve una herramienta: un string, o la suma del `text` de sus bloques. */
export function bytesDe(contenido) {
  if (typeof contenido === 'string') return bytesDeTexto(contenido);
  if (Array.isArray(contenido)) {
    return contenido.reduce((s, b) => s + (b && typeof b.text === 'string' ? bytesDeTexto(b.text) : 0), 0);
  }
  return 0;
}

/** A qué apunta una llamada a herramienta, en una línea corta. */
export function objetivoDe(bloque) {
  const i = (bloque && bloque.input) || {};
  const t = i.file_path || i.path || i.pattern || i.command || i.query || i.skill || i.to || i.url || '';
  return String(t).replace(/\s+/g, ' ').replace(/^.*\\jobs\\[0-9a-f]+\\tmp\\/, 'TMP/').slice(0, 78);
}

/** Las líneas de un jsonl. Las que no son JSON se CUENTAN (`rotas`), no se ignoran en silencio. */
export function parsearJsonl(texto) {
  const entradas = [];
  let rotas = 0;
  for (const linea of String(texto).split(/\r?\n/)) {
    if (!linea.trim()) continue;
    try {
      const o = JSON.parse(linea);
      if (o && typeof o === 'object') entradas.push(o); else rotas++;
    } catch { rotas++; }
  }
  return { entradas, rotas };
}

/**
 * Los turnos del asistente: entradas `assistant` con `message.usage`, deduplicadas por
 * `message.id` (vale el ÚLTIMO usage), en orden de primera aparición. Las herramientas se juntan
 * de todas las líneas del mismo id. `U` es el contexto: input + cache_read + cache_creation.
 */
export function turnosDeEntradas(entradas) {
  const porId = new Map();
  const orden = [];
  for (const o of entradas) {
    if (!o || o.type !== 'assistant' || !o.message) continue;
    const id = o.message.id || o.uuid;
    if (!id) continue;
    let t = porId.get(id);
    if (!t) {
      t = { id, ts: o.timestamp || null, usage: null, tools: [] };
      porId.set(id, t);
      orden.push(t);
    }
    const u = o.message.usage;
    if (u && typeof u === 'object') {
      t.usage = {
        input: num(u.input_tokens),
        creation: num(u.cache_creation_input_tokens),
        read: num(u.cache_read_input_tokens),
        output: num(u.output_tokens),
      };
    }
    if (Array.isArray(o.message.content)) {
      for (const b of o.message.content) {
        if (b && b.type === 'tool_use' && !t.tools.some((x) => x.id === b.id)) {
          t.tools.push({ id: b.id, nombre: b.name, objetivo: objetivoDe(b) });
        }
      }
    }
  }
  return orden.filter((t) => t.usage).map((t) => ({
    ...t, U: t.usage.input + t.usage.read + t.usage.creation,
  }));
}

/** El contexto de cada turno, sin output. */
export function contextoPorTurno(turnos) {
  return turnos.map((t) => t.U);
}

/** Los resultados de herramienta del jsonl: [{id, bytes}] (`tool_result` de las entradas `user`). */
export function resultadosDeHerramientas(entradas) {
  const out = [];
  for (const o of entradas) {
    if (!o || o.type !== 'user' || !o.message || !Array.isArray(o.message.content)) continue;
    for (const b of o.message.content) {
      if (b && b.type === 'tool_result') out.push({ id: b.tool_use_id, bytes: bytesDe(b.content) });
    }
  }
  return out;
}

export function medianaDe(numeros) {
  if (!numeros.length) return null;
  const s = [...numeros].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

const suma = (xs) => xs.reduce((s, x) => s + x, 0);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Decisiones puras: suelo, lectura, coste, criterio
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Suelo y lectura de UNA sesión. Necesita al menos 8 turnos (U8): con menos devuelve null, porque
 * «el último turno» no es el turno 8 y presentarlo como tal daría una lectura de arranque falsa.
 *
 * El coste ponderado del suelo supone que se paga una vez como cache-write y se relee en los N−1
 * turnos siguientes; el de la lectura, igual desde el turno 8 (N−8 releídas).
 */
export function resumenDeSesion(turnos) {
  const U = contextoPorTurno(turnos);
  const N = U.length;
  if (N < TURNO_LECTURA) return null;
  const total = suma(U);
  const U1 = U[0];
  const U8 = U[TURNO_LECTURA - 1];
  const lectura = U8 - U1;
  const tokens = { input: 0, creation: 0, read: 0, output: 0 };
  for (const t of turnos) for (const k of Object.keys(tokens)) tokens[k] += t.usage[k];
  const coste = tokens.input * PESOS.input + tokens.creation * PESOS.creation
    + tokens.read * PESOS.read + tokens.output * PESOS.output;
  return {
    N, suma: total, U1, U8, lectura,
    sueloPct: total > 0 ? (100 * U1 * N) / total : 0,
    lecturaPct: total > 0 ? (100 * lectura * (N - TURNO_LECTURA)) / total : 0,
    coste,
    costeSuelo: U1 * PESOS.creation + U1 * PESOS.read * (N - 1),
    costeLectura: lectura * PESOS.creation + lectura * PESOS.read * (N - TURNO_LECTURA),
  };
}

/** Totales de varias sesiones: suelo %, lectura %, % ponderado y U8 mediano. */
export function agregarSesiones(resumenes) {
  const sumaTotal = suma(resumenes.map((r) => r.suma));
  const suelo = suma(resumenes.map((r) => r.U1 * r.N));
  const lectura = suma(resumenes.map((r) => r.lectura * (r.N - TURNO_LECTURA)));
  const coste = suma(resumenes.map((r) => r.coste));
  const costeSuelo = suma(resumenes.map((r) => r.costeSuelo));
  const costeLectura = suma(resumenes.map((r) => r.costeLectura));
  const de = (x, base) => (base > 0 ? (100 * x) / base : 0);
  return {
    n: resumenes.length,
    suma: sumaTotal,
    sueloPct: de(suelo, sumaTotal),
    lecturaPct: de(lectura, sumaTotal),
    costeSueloPct: de(costeSuelo, coste),
    costeLecturaPct: de(costeLectura, coste),
    costeJuntosPct: de(costeSuelo + costeLectura, coste),
    u8Mediano: medianaDe(resumenes.map((r) => r.U8)),
  };
}

/** El criterio de aceptación de SCRUM-996, calculado. */
export function evaluarCriterio(ag) {
  const u8Cumple = ag.u8Mediano <= OBJETIVO_U8;
  const lecturaCumple = ag.lecturaPct <= OBJETIVO_LECTURA_PCT;
  return { u8Cumple, lecturaCumple, cumple: u8Cumple && lecturaCumple };
}

/** El traspaso cabe en su tope si pesa MENOS O IGUAL que el tope. */
export function medirTraspaso(bytes, tope = TOPE_TRASPASO_POR_DEFECTO) {
  const excede = bytes > tope;
  return {
    bytes, tope, excede,
    exceso: excede ? bytes - tope : 0,
    margen: excede ? 0 : tope - bytes,
    tokens: Math.round(bytes / BYTES_POR_TOKEN),
  };
}

/** `D:\MILLONARIO\cobroFlash\cobroflash-backend` → `D--MILLONARIO-cobroFlash-cobroflash-backend`. */
export function slugDeCwd(cwd) {
  return String(cwd).replace(/[:\\/]/g, '-');
}

export function rutaDeTraspaso(puesto, { cwd, home }) {
  return path.join(home, '.claude', 'projects', slugDeCwd(cwd), 'memory', `project_${puesto}_traspaso.md`);
}

/**
 * Coste ponderado de lo que devuelven las herramientas en UNA sesión. Cada byte devuelto en el
 * turno t entra en el contexto en el t+1: se paga una vez como cache-write y se relee en los
 * N−t−1 turnos siguientes. Un resultado cuyo `tool_use` no está entre los turnos no se puede
 * fechar: se cuenta aparte (`sinUso`), no se reparte.
 */
export function analizarResultados(turnos, entradas) {
  const N = turnos.length;
  const usos = new Map();
  turnos.forEach((t, i) => t.tools.forEach((x) => usos.set(x.id, { turno: i + 1, nombre: x.nombre })));
  const costeTotal = suma(turnos.map((t) => t.usage.input * PESOS.input + t.usage.creation * PESOS.creation
    + t.usage.read * PESOS.read + t.usage.output * PESOS.output));
  const r = { N, costeTotal, costeRes: 0, nRes: 0, nGrandes: 0, costeGrandes: 0, sinUso: 0, porHerr: {}, grandesPorHerr: {} };
  for (const { id, bytes } of resultadosDeHerramientas(entradas)) {
    const uso = usos.get(id);
    if (!uso) { r.sinUso++; continue; }
    const coste = (bytes / BYTES_POR_TOKEN) * (PESOS.creation + PESOS.read * Math.max(0, N - uso.turno - 1));
    r.nRes++;
    r.costeRes += coste;
    const h = (r.porHerr[uso.nombre] ||= { n: 0, coste: 0 });
    h.n++; h.coste += coste;
    if (bytes >= UMBRAL_RESULTADO_GRANDE) {
      r.nGrandes++;
      r.costeGrandes += coste;
      const g = (r.grandesPorHerr[uso.nombre] ||= { n: 0, coste: 0, bytes: 0 });
      g.n++; g.coste += coste; g.bytes += bytes;
    }
  }
  return r;
}

function fusionar(destino, origen, campos) {
  for (const [k, v] of Object.entries(origen)) {
    const d = (destino[k] ||= Object.fromEntries(campos.map((c) => [c, 0])));
    for (const c of campos) d[c] += v[c];
  }
}

export function agregarResultados(lista) {
  const t = { costeTotal: 0, costeRes: 0, nRes: 0, nGrandes: 0, costeGrandes: 0, sinUso: 0, porHerr: {}, grandesPorHerr: {} };
  for (const r of lista) {
    for (const k of ['costeTotal', 'costeRes', 'nRes', 'nGrandes', 'costeGrandes', 'sinUso']) t[k] += r[k];
    fusionar(t.porHerr, r.porHerr, ['n', 'coste']);
    fusionar(t.grandesPorHerr, r.grandesPorHerr, ['n', 'coste', 'bytes']);
  }
  return t;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Descubrimiento de sesiones (lee disco; nada se escribe)
// ═════════════════════════════════════════════════════════════════════════════════════════════

const sinBom = (t) => (t.charCodeAt(0) === 0xfeff ? t.slice(1) : t);

/** El valor que sigue a `-n` en `respawnFlags`. */
export function nombreDe(estado) {
  const f = Array.isArray(estado.respawnFlags) ? estado.respawnFlags : [];
  const i = f.indexOf('-n');
  return i !== -1 && typeof f[i + 1] === 'string' ? f[i + 1] : '(sin nombre)';
}

/** `s5` casa con `s5` y con `s5-21e`, no con `s50`. */
export function coincideNombre(nombre, filtro) {
  return nombre === filtro || nombre.startsWith(`${filtro}-`);
}

/** Los `state.json` de `dirJobs`. Un directorio que no se puede listar es `ok:false`, no «cero». */
export function listarStates(dirJobs) {
  let dirs;
  try {
    dirs = fs.readdirSync(dirJobs, { withFileTypes: true });
  } catch (e) {
    return { ok: false, motivo: `no pude listar ${dirJobs} (${e.code || e.message})` };
  }
  const filas = [];
  let states = 0;
  let ilegibles = 0;
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const sf = path.join(dirJobs, d.name, 'state.json');
    if (!fs.existsSync(sf)) continue;
    states++;
    let st;
    try { st = JSON.parse(sinBom(fs.readFileSync(sf, 'utf8'))); } catch { ilegibles++; continue; }
    if (!st || typeof st !== 'object') { ilegibles++; continue; }
    filas.push({
      dir: d.name,
      nombre: nombreDe(st),
      jsonl: typeof st.linkScanPath === 'string' && st.linkScanPath ? st.linkScanPath : null,
    });
  }
  return { ok: true, states, ilegibles, filas };
}

/**
 * Las sesiones con actividad en la ventana, con su análisis. `analizar(turnos, entradas)` recibe
 * los turnos y las entradas de UNA sesión y devuelve lo que hay que guardar de ella (así no se
 * retiene ningún jsonl entero en memoria).
 */
export function censarSesiones({ dirJobs, ahoraMs, horas, desdeMs = null, nombre = null, minTurnos, analizar }) {
  const ls = listarStates(dirJobs);
  if (!ls.ok) return ls;
  const pob = { states: ls.states, ilegibles: ls.ilegibles, conJsonl: 0, activas: 0, incluidas: 0, jsonlIlegibles: 0 };
  let rotas = 0;
  const sesiones = [];
  for (const f of ls.filas) {
    if (!f.jsonl) continue;
    let mtime;
    try { mtime = fs.statSync(f.jsonl).mtimeMs; } catch { continue; }
    pob.conJsonl++;
    if (ahoraMs - mtime > horas * 3600 * 1000) continue;
    pob.activas++;
    if (nombre && !coincideNombre(f.nombre, nombre)) continue;
    let texto;
    try { texto = fs.readFileSync(f.jsonl, 'utf8'); } catch { pob.jsonlIlegibles++; continue; }
    const { entradas, rotas: r } = parsearJsonl(texto);
    rotas += r;
    const turnos = turnosDeEntradas(entradas);
    if (desdeMs !== null && !(Date.parse((turnos[0] && turnos[0].ts) || '') >= desdeMs)) continue;
    if (turnos.length < minTurnos) continue;
    const datos = analizar(turnos, entradas);
    if (!datos) continue;
    pob.incluidas++;
    sesiones.push({ nombre: f.nombre, dir: f.dir, jsonl: f.jsonl, datos });
  }
  return { ok: true, pob, rotas, sesiones };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Informes (puros: devuelven {codigo, cuerpo})
// ═════════════════════════════════════════════════════════════════════════════════════════════

export function lineaPoblacion(pob, minTurnos, filtros = []) {
  const f = filtros.length ? ` [${filtros.join(' · ')}]` : '';
  return `POBLACION: ${pob.states} state.json · ${pob.conJsonl} con jsonl · ${pob.activas} con actividad en la ventana`
    + ` · ${pob.incluidas} con ≥ ${minTurnos} turnos${f}`;
}

const lineaLectura = (cen) => `LECTURA: líneas rotas=${cen.rotas} · state.json ilegibles=${cen.pob.ilegibles}`
  + ` · jsonl ilegibles=${cen.pob.jsonlIlegibles}`;

const sinPoblacion = (cen, minTurnos, horas, filtros) => ({
  codigo: 2,
  cuerpo: [
    `NO PUDE MIRAR: cero sesiones con ≥ ${minTurnos} turnos en las últimas ${horas} h. Esto NO es «gasto cero».`,
    lineaPoblacion(cen.pob, minTurnos, filtros),
    lineaLectura(cen),
  ].join('\n'),
});

export function informeSesiones(cen, { horas, minTurnos, filtros }) {
  if (!cen.ok) return { codigo: 2, cuerpo: `NO PUDE MIRAR: ${cen.motivo}\nPOBLACION: 0 state.json` };
  if (cen.sesiones.length === 0) return sinPoblacion(cen, minTurnos, horas, filtros);
  const rs = cen.sesiones.map((s) => ({ nombre: s.nombre, ...s.datos })).sort((a, b) => b.suma - a.suma);
  const ag = agregarSesiones(rs);
  const cr = evaluarCriterio(ag);
  const l = [`sesiones · ventana ${horas} h · ≥ ${minTurnos} turnos · U8 = contexto del turno ${TURNO_LECTURA}, lectura = U8 − U1`];
  for (const r of rs) {
    l.push(`${r.nombre.padEnd(14)} turnos=${String(r.N).padStart(4)} Σcontexto=${r.suma} U1=${r.U1} U8=${r.U8} lectura=${r.lectura}`
      + ` → suelo ${pct1(r.sueloPct)} % · lectura ${pct1(r.lecturaPct)} % del contexto`);
  }
  l.push(`TOTAL ${ag.n} sesiones · Σcontexto=${millones(ag.suma)} · suelo=${pct1(ag.sueloPct)} % · lectura=${pct1(ag.lecturaPct)} %`);
  l.push(`PONDERADO · ${TEXTO_PESOS} · suelo ${pct1(ag.costeSueloPct)} % · lectura ${pct1(ag.costeLecturaPct)} %`
    + ` · juntos ${pct1(ag.costeJuntosPct)} % del coste`);
  l.push(`CRITERIO SCRUM-996: U8 mediano=${ag.u8Mediano} (objetivo ≤ ${OBJETIVO_U8}) · lectura/contexto=${pct1(ag.lecturaPct)} % `
    + `(objetivo ≤ ${OBJETIVO_LECTURA_PCT} %) · ${cr.cumple ? 'CUMPLE' : 'NO CUMPLE'} `
    + `(U8: ${cr.u8Cumple ? 'CUMPLE' : 'NO CUMPLE'}, lectura: ${cr.lecturaCumple ? 'CUMPLE' : 'NO CUMPLE'})`);
  l.push(lineaPoblacion(cen.pob, minTurnos, filtros), lineaLectura(cen));
  return { codigo: cr.cumple ? 0 : 1, cuerpo: l.join('\n') };
}

export function informeResultados(cen, { horas, minTurnos }) {
  if (!cen.ok) return { codigo: 2, cuerpo: `NO PUDE MIRAR: ${cen.motivo}\nPOBLACION: 0 state.json` };
  const t = agregarResultados(cen.sesiones.map((s) => s.datos));
  if (cen.sesiones.length === 0 || t.nRes === 0) {
    return {
      codigo: 2,
      cuerpo: [
        `NO PUDE MIRAR: ${cen.sesiones.length === 0 ? 'cero sesiones' : 'cero resultados de herramienta'} `
        + `con ≥ ${minTurnos} turnos en las últimas ${horas} h. Esto NO es «las herramientas no cuestan nada».`,
        lineaPoblacion(cen.pob, minTurnos),
        lineaLectura(cen),
      ].join('\n'),
    };
  }
  const p = (x) => (t.costeTotal > 0 ? pct1((100 * x) / t.costeTotal) : '0.0');
  const top = (obj, f) => Object.entries(obj).sort((a, b) => b[1].coste - a[1].coste).slice(0, 6).map(f).join(' · ');
  const l = [
    `resultados · ventana ${horas} h · ≥ ${minTurnos} turnos · coste total ponderado=${millones(t.costeTotal)}`,
    `ESTIMACION: ${String(BYTES_POR_TOKEN).replace('.', ',')} B/token (calibrado con Read de docs en español; NO es el tokenizador) · ${TEXTO_PESOS}`
    + ' · cada byte devuelto en el turno t se paga una vez como cache-write y se relee en los turnos posteriores',
    `Todo lo que devuelven las herramientas: ${p(t.costeRes)} % del coste · resultados ≥ ${UMBRAL_RESULTADO_GRANDE} B: ${t.nGrandes} `
    + `(${pct1((100 * t.nGrandes) / t.nRes)} % de los resultados) = ${p(t.costeGrandes)} % del coste`,
    `Por herramienta (todos los resultados): ${top(t.porHerr, ([k, v]) => `${k} n=${v.n} ${p(v.coste)} %`)}`,
    `Solo resultados grandes: ${top(t.grandesPorHerr, ([k, v]) => `${k} n=${v.n} media=${Math.round(v.bytes / v.n)}B ${p(v.coste)} %`) || '(ninguno)'}`,
    `RESULTADOS: ${t.nRes} resultados de herramienta casados con su llamada · ${t.sinUso} sin llamada casada (no cuentan)`,
    lineaPoblacion(cen.pob, minTurnos),
    lineaLectura(cen),
  ];
  return { codigo: 0, cuerpo: l.join('\n') };
}

/** La tabla por turno de UNA sesión: contexto, salto, herramientas con objetivo y bytes devueltos. */
export function informeArranque({ nombre, turnos, entradas, maxTurnos, poblacion, rotas, repetidas }) {
  const adjuntos = {};
  for (const o of entradas) {
    if (o.type === 'attachment' && o.attachment) {
      const k = o.attachment.type || '?';
      adjuntos[k] = (adjuntos[k] || 0) + bytesDeTexto(JSON.stringify(o.attachment));
    }
  }
  const devuelto = new Map(resultadosDeHerramientas(entradas).map((r) => [r.id, r.bytes]));
  const l = [`=== ${nombre} · turnos=${turnos.length} · suelo(turno 1)=${turnos[0] ? turnos[0].U : 'n/d'}`];
  l.push('adjuntos de arranque (bytes JSON): '
    + (Object.entries(adjuntos).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}=${v}`).join(' · ') || '(ninguno)'));
  const n = Math.min(turnos.length, maxTurnos);
  let anterior = null;
  for (let i = 0; i < n; i++) {
    const t = turnos[i];
    const delta = anterior === null ? t.U : t.U - anterior;
    const sig = turnos[i + 1];
    const res = suma(t.tools.map((x) => devuelto.get(x.id) || 0));
    const desc = t.tools.map((x) => `${x.nombre}:${x.objetivo}(${devuelto.get(x.id) || 0}B)`).join(' | ');
    l.push(`t${String(i + 1).padStart(2, '0')} U=${t.U} Δ=${delta}${sig ? ` Δsig=${sig.U - t.U}` : ''} res=${res}B  ${desc}`);
    anterior = t.U;
  }
  if (repetidas > 1) l.push(`(hay ${repetidas} sesiones con ese nombre: se mide la de jsonl más reciente)`);
  l.push(poblacion, `LECTURA: líneas rotas=${rotas}`);
  return { codigo: 0, cuerpo: l.join('\n') };
}

/** El traspaso frente a su tope. */
export function informeTraspaso({ ruta, bytes, tope, historial }) {
  const m = medirTraspaso(bytes, tope);
  const l = [
    `traspaso ${ruta}`,
    `${m.bytes} B (≈ ${m.tokens} tokens a ${String(BYTES_POR_TOKEN).replace('.', ',')} B/token, estimación) · tope ${m.tope} B`,
  ];
  if (m.excede) {
    l.push(`EXCEDE EL TOPE por ${m.exceso} B`, `mueve lo histórico y las trampas a ${historial}`);
  } else {
    l.push(`OK: dentro del tope (${m.margen} B de margen)`);
  }
  l.push('POBLACION: 1 fichero');
  return { codigo: m.excede ? 1 : 0, cuerpo: l.join('\n') };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Argumentos y ejecución
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Separa `--opción valor` de los posicionales. Una opción que no se conoce es un error. */
export function parsearOpciones(args, conValor) {
  const opciones = {};
  const posicionales = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (conValor.includes(a)) {
      const v = args[++i];
      if (v === undefined) throw new ErrorDeUso(`${a} necesita un valor`);
      opciones[a] = v;
    } else if (a.startsWith('--')) {
      throw new ErrorDeUso(`opción desconocida «${a}»`);
    } else {
      posicionales.push(a);
    }
  }
  return { opciones, posicionales };
}

function positivo(txt, nombre, { entero = false } = {}) {
  const n = Number(txt);
  if (txt === '' || !Number.isFinite(n) || n <= 0 || (entero && !Number.isInteger(n))) {
    throw new ErrorDeUso(`${nombre} tiene que ser un número ${entero ? 'entero ' : ''}positivo (llegó «${txt}»)`);
  }
  return n;
}

/** `--desde` exige huso (Z o ±hh:mm): sin él, `Date.parse` usa la zona de la máquina. */
function instante(txt) {
  if (!/(Z|[+-]\d\d:?\d\d)$/i.test(txt) || !Number.isFinite(Date.parse(txt))) {
    throw new ErrorDeUso(`--desde necesita una fecha ISO con huso, p. ej. 2026-09-21T12:00:00Z (llegó «${txt}»)`);
  }
  return Date.parse(txt);
}

function subcomandoSesiones(args, ctx) {
  const { opciones, posicionales } = parsearOpciones(args, ['--horas', '--min-turnos', '--desde', '--nombre']);
  if (posicionales.length) throw new ErrorDeUso(`sobra «${posicionales[0]}»`);
  const horas = opciones['--horas'] === undefined ? HORAS_POR_DEFECTO : positivo(opciones['--horas'], '--horas');
  const pedido = opciones['--min-turnos'] === undefined ? MIN_TURNOS_POR_DEFECTO
    : positivo(opciones['--min-turnos'], '--min-turnos', { entero: true });
  const minTurnos = Math.max(pedido, TURNO_LECTURA);
  const desdeMs = opciones['--desde'] === undefined ? null : instante(opciones['--desde']);
  const nombre = opciones['--nombre'] || null;
  const filtros = [];
  if (minTurnos !== pedido) filtros.push(`--min-turnos subido a ${TURNO_LECTURA}: U8 necesita ${TURNO_LECTURA} turnos`);
  if (nombre) filtros.push(`nombre ${nombre}`);
  if (desdeMs !== null) filtros.push(`desde ${opciones['--desde']}`);
  const cen = censarSesiones({
    dirJobs: ctx.dirJobs, ahoraMs: ctx.ahoraMs, horas, desdeMs, nombre, minTurnos,
    analizar: (turnos) => resumenDeSesion(turnos),
  });
  return informeSesiones(cen, { horas, minTurnos, filtros });
}

function subcomandoResultados(args, ctx) {
  const { opciones, posicionales } = parsearOpciones(args, ['--horas', '--min-turnos']);
  if (posicionales.length) throw new ErrorDeUso(`sobra «${posicionales[0]}»`);
  const horas = opciones['--horas'] === undefined ? HORAS_POR_DEFECTO : positivo(opciones['--horas'], '--horas');
  const minTurnos = opciones['--min-turnos'] === undefined ? MIN_TURNOS_POR_DEFECTO
    : positivo(opciones['--min-turnos'], '--min-turnos', { entero: true });
  const cen = censarSesiones({
    dirJobs: ctx.dirJobs, ahoraMs: ctx.ahoraMs, horas, minTurnos, analizar: analizarResultados,
  });
  return informeResultados(cen, { horas, minTurnos });
}

function subcomandoArranque(args, ctx) {
  const { opciones, posicionales } = parsearOpciones(args, ['--turnos']);
  if (posicionales.length !== 1) throw new ErrorDeUso('arranque necesita UN nombre de sesión');
  const nombre = posicionales[0];
  const maxTurnos = opciones['--turnos'] === undefined ? TURNOS_POR_DEFECTO
    : positivo(opciones['--turnos'], '--turnos', { entero: true });
  const ls = listarStates(ctx.dirJobs);
  if (!ls.ok) return { codigo: 2, cuerpo: `NO PUDE MIRAR: ${ls.motivo}\nPOBLACION: 0 state.json` };
  let conJsonl = 0;
  const candidatas = [];
  for (const f of ls.filas) {
    if (!f.jsonl) continue;
    let mtime;
    try { mtime = fs.statSync(f.jsonl).mtimeMs; } catch { continue; }
    conJsonl++;
    if (f.nombre === nombre) candidatas.push({ ...f, mtime });
  }
  const poblacion = `POBLACION: ${ls.states} state.json · ${conJsonl} con jsonl · ${candidatas.length} con el nombre «${nombre}»`;
  if (!candidatas.length) {
    return { codigo: 2, cuerpo: `NO PUDE MIRAR: ninguna sesión llamada «${nombre}» con jsonl legible\n${poblacion}` };
  }
  candidatas.sort((a, b) => b.mtime - a.mtime);
  let texto;
  try { texto = fs.readFileSync(candidatas[0].jsonl, 'utf8'); } catch (e) {
    return { codigo: 2, cuerpo: `NO PUDE MIRAR: no pude leer ${candidatas[0].jsonl} (${e.code || e.message})\n${poblacion}` };
  }
  const { entradas, rotas } = parsearJsonl(texto);
  const turnos = turnosDeEntradas(entradas);
  if (!turnos.length) {
    return { codigo: 2, cuerpo: `NO PUDE MIRAR: «${nombre}» no tiene ningún turno del asistente con usage\n${poblacion}` };
  }
  return informeArranque({ nombre, turnos, entradas, maxTurnos, poblacion, rotas, repetidas: candidatas.length });
}

function subcomandoTraspaso(args, ctx) {
  const { opciones, posicionales } = parsearOpciones(args, ['--fichero', '--tope']);
  if (posicionales.length > 1) throw new ErrorDeUso(`sobra «${posicionales[1]}»`);
  const tope = opciones['--tope'] === undefined ? TOPE_TRASPASO_POR_DEFECTO
    : positivo(opciones['--tope'], '--tope', { entero: true });
  const puesto = posicionales[0] || null;
  if (puesto !== null && !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(puesto)) {
    throw new ErrorDeUso(`«${puesto}» no es un nombre de puesto (p. ej. s5)`);
  }
  if (puesto === null && !opciones['--fichero']) throw new ErrorDeUso('traspaso necesita <sN> o --fichero <ruta>');
  const ruta = opciones['--fichero'] ? path.resolve(opciones['--fichero'])
    : rutaDeTraspaso(puesto, { cwd: ctx.cwd, home: ctx.home });
  const deFichero = /^project_(.+)_traspaso\.md$/.exec(path.basename(ruta));
  const historial = `project_${puesto || (deFichero && deFichero[1]) || '<puesto>'}_historial.md`;
  let bytes;
  try {
    bytes = fs.readFileSync(ruta).length;
  } catch (e) {
    return {
      codigo: 2,
      cuerpo: `NO PUDE MIRAR: no pude leer ${ruta} (${e.code || e.message})`
        + `${opciones['--fichero'] ? '' : ' (la ruta sale del directorio desde el que lo lanzas; usa --fichero <ruta>)'}\nPOBLACION: 0 ficheros`,
    };
  }
  if (bytes === 0) return { codigo: 2, cuerpo: `NO PUDE MIRAR: ${ruta} está vacío: no es un traspaso\nPOBLACION: 0 ficheros` };
  return informeTraspaso({ ruta, bytes, tope, historial });
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// vivas · SCRUM-1070 · ¿a quién le toca el relevo AHORA?
// El coste de una sesión es Σ (contexto de cada turno): crece con el cuadrado de su longitud.
// Medido el 21-sep-2026 (55 sesiones ≥ 40 turnos, 30 h): la mediana ACABA en 337k y 38 de 55 pasan de
// 300k; con relevo a 200k, Σcontexto baja ~44 % (simulado, no medido; ver simularRelevo).
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const UMBRAL_RELEVO = 200000; // fundador, 21-sep (la A19 decía 300k)
export const CTX_TRAS_RELEVO = 85000; // supuesto: ≈ U8 mediano de una sesión nacida (57k de suelo + arranque + traspaso)
export const OCIOSA_MIN = 60; // A19 caso 2: la caché de prompt caduca a la hora

/** Dónde está una sesión AHORA: su último contexto y cuándo habló por última vez. */
export function resumenDeVivas(turnos) {
  const us = contextoPorTurno(turnos);
  const ultimo = turnos[turnos.length - 1];
  return { N: turnos.length, ctx: us[us.length - 1], ultimoMs: Date.parse((ultimo && ultimo.ts) || ''), us };
}

/** Σcontexto de la serie `us` si se relevara al cruzar `umbral`: cada relevo reinicia en `arr`. */
export function simularRelevo(us, umbral, arr = CTX_TRAS_RELEVO) {
  let suma = 0;
  let relevos = 0;
  let off = 0;
  for (let i = 0; i < us.length; i++) {
    let u = us[i] - off;
    if (u > umbral && i < us.length - 1) { relevos++; off = us[i] - arr; u = arr; }
    suma += u;
  }
  return { suma, relevos };
}

export function informeVivas(cen, { horas, umbral, simular, ahoraMs }) {
  if (!cen.ok) return { codigo: 2, cuerpo: `NO PUDE MIRAR: ${cen.motivo}\nPOBLACION: 0 state.json` };
  if (cen.sesiones.length === 0) {
    return { codigo: 2, cuerpo: [`NO PUDE MIRAR: cero sesiones con turnos en las últimas ${horas} h. Esto NO es «nadie pasa del umbral».`,
      lineaPoblacion(cen.pob, 1), lineaLectura(cen)].join('\n') };
  }
  const rs = cen.sesiones.map((s) => ({ nombre: s.nombre, ...s.datos })).sort((a, b) => b.ctx - a.ctx);
  const l = [`vivas · ventana ${horas} h · umbral de relevo ${umbral} (fundador, 21-sep) · contexto = último turno medido`];
  let sobre = 0;
  for (const r of rs) {
    const parada = Number.isFinite(r.ultimoMs) ? Math.max(0, Math.round((ahoraMs - r.ultimoMs) / 60000)) : null;
    const toca = r.ctx >= umbral;
    if (toca) sobre++;
    const fria = parada !== null && parada > OCIOSA_MIN ? ` · parada ${parada} min: caché fría, RELEVO antes de reanudar` : '';
    l.push(`${r.nombre.padEnd(14)} turnos=${String(r.N).padStart(4)} contexto=${String(r.ctx).padStart(7)} ${toca ? 'RELEVAR' : 'ok     '}`
      + `${parada !== null ? ` · último turno hace ${parada} min` : ''}${fria}`);
  }
  l.push(`VIVAS ${rs.length} · a relevar (≥ ${umbral}): ${sobre} · mediana ${medianaDe(rs.map((r) => r.ctx))}`);
  if (simular !== null) {
    const base = rs.reduce((s, r) => s + r.us.reduce((a, x) => a + x, 0), 0);
    const sim = rs.map((r) => simularRelevo(r.us, simular));
    const suma = sim.reduce((s, x) => s + x.suma, 0);
    l.push(`SIMULADO relevo a ${simular} sobre estas ${rs.length}: Σcontexto ${millones(base)} → ${millones(suma)}`
      + ` (${pct1((1 - suma / base) * 100)} % menos) · +${sim.reduce((s, x) => s + x.relevos, 0)} relevos · arranque tras relevo ${CTX_TRAS_RELEVO} SUPUESTO;`
      + ' es una simulación de Σcontexto, no del coste ni de la eficiencia (mirar rojos de CI y correcciones tras entregar)');
  }
  l.push(lineaPoblacion(cen.pob, 1), lineaLectura(cen));
  return { codigo: sobre > 0 ? 1 : 0, cuerpo: l.join('\n') };
}

function subcomandoVivas(args, ctx) {
  const { opciones, posicionales } = parsearOpciones(args, ['--horas', '--umbral', '--simular']);
  if (posicionales.length) throw new ErrorDeUso(`sobra «${posicionales[0]}»`);
  const horas = opciones['--horas'] === undefined ? 2 : positivo(opciones['--horas'], '--horas');
  const umbral = opciones['--umbral'] === undefined ? UMBRAL_RELEVO : positivo(opciones['--umbral'], '--umbral', { entero: true });
  const simular = opciones['--simular'] === undefined ? null : positivo(opciones['--simular'], '--simular', { entero: true });
  const cen = censarSesiones({
    dirJobs: ctx.dirJobs, ahoraMs: ctx.ahoraMs, horas, minTurnos: 1, analizar: (turnos) => resumenDeVivas(turnos),
  });
  return informeVivas(cen, { horas, umbral, simular, ahoraMs: ctx.ahoraMs });
}

const SUBCOMANDOS = {
  sesiones: subcomandoSesiones,
  arranque: subcomandoArranque,
  resultados: subcomandoResultados,
  vivas: subcomandoVivas,
  traspaso: subcomandoTraspaso,
};

/**
 * Todo el programa menos escribir en pantalla. Devuelve `{codigo, texto}`; el `EXIT=` del texto
 * sale de la misma variable `codigo` que se devuelve.
 */
export function ejecutar(argv, deps = {}) {
  const env = deps.env || process.env;
  const ctx = {
    dirJobs: env.CLAUDE_JOBS_DIR || path.join(deps.home || os.homedir(), '.claude', 'jobs'),
    ahoraMs: deps.ahoraMs ?? Date.now(),
    cwd: deps.cwd || process.cwd(),
    home: deps.home || os.homedir(),
  };
  const sub = argv[0];
  let codigo = 2;
  let cuerpo;
  try {
    if (!Object.hasOwn(SUBCOMANDOS, sub)) throw new ErrorDeUso(sub ? `subcomando desconocido «${sub}»` : 'falta el subcomando');
    const r = SUBCOMANDOS[sub](argv.slice(1), ctx);
    codigo = r.codigo;
    cuerpo = r.cuerpo;
  } catch (e) {
    codigo = 2;
    if (e instanceof ErrorDeUso) cuerpo = `NO PUDE MIRAR: argumentos (${e.motivo})\n${USO}`;
    else cuerpo = `NO PUDE MIRAR: error inesperado (${e && e.message ? e.message : e})`;
  }
  return { codigo, texto: `${cuerpo}\ngasto-arranque ${Object.hasOwn(SUBCOMANDOS, sub) ? sub : '?'} · EXIT=${codigo}\n` };
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
  process.stdout.write(r.texto, () => process.exit(r.codigo));
}
