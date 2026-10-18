#!/usr/bin/env node
// SCRUM-1357d · SALA — lo que necesita el panel «La sala» del fundador, sacado de `parados.mjs`.
//
//   node scripts/equipo/sala.mjs                    → una línea por cosa que atender; NADA si no hay ninguna
//   node scripts/equipo/sala.mjs --jobs <carpeta>   → otro registro (así lo doblan los tests)
//   node scripts/equipo/sala.mjs --aparcados <fichero>  → otras marcas de aparcado (se pasa a parados.mjs)
//
// POR QUÉ EXISTE. El plugin `yaqu-sala` corría un vigía que vivía en el scratchpad de UNA sesión del
// orquestador (muere con su relevo) y que sólo conocía los nombres `sN-…`. El 16-oct-2026 hubo que lanzar
// por `sesion.mjs`, cuya lista blanca sólo admite `sesion-0`…`sesion-5`, y el panel enseñó los SEIS puestos
// «SIN CUBRIR» con los seis trabajando. A la vez, ese vigía dijo «ningún puesto que atender» mientras
// `parados.mjs` cazaba a `sesion-3` bloqueada en un permiso.
//
// ES UNA TRADUCCIÓN, NO OTRO VIGÍA. Se LLAMA a `parados.mjs --json` como proceso (no se importa ni se
// copia): lo que él sabe —sesión y no puesto, las dos fuentes, «te espera», puestos vacíos, y decir que no
// pudo mirar— es lo que sale aquí. Los nombres de puesto los resuelve `puestoDe` (`latido.mjs`):
// `sN`, `sN-…`, `sesion-N` y `sesion-N-…`.
//
// EL FORMATO es el que el plugin ya lee: una línea = una cosa que atender, campos separados por `|`, y los
// tres primeros son la huella con la que el plugin decide si el aviso es nuevo.
//   AVERIA|no pude mirar <qué>                                  (parados.mjs no pudo mirar algo)
//   PREGUNTA|S2|sesion-2|hace 83 min|sin proceso|«falta tu firma…»|su puesto está SIN CUBRIR   (SCRUM-1357f)
//   VACIO|S3|ninguna sesión suya con proceso|su puesto está SIN CUBRIR
//   BLOQUEADA|S3|sesion-3|hace 8 min|pid 14304|«approve Entering worktree»
//   TE ESPERA|S2|sesion-2|hace 39 min|pid 4100|«lo último que dijo»
//   HUÉRFANAS|2 sesión(es) VIVA(S) que no son de ningún puesto: a, b|¿han cambiado los nombres?
//   APARCADO|S3|hasta 2026-10-18T09:00Z|«gasto»|aparcado a las 2026-10-17T13:00Z   (SCRUM-1357e)
// APARCADO NO ES UN AVISO: lo escribió el orquestador a propósito (`aparcar.mjs`) y su marca vale. Por
// eso no cuenta para la salida (sólo APARCADO → 0) y el plugin debe pintarlo aparte, no como «que
// atender». Su huella (tres primeros campos) lleva el `hasta`, no un «hace N min»: no cambia cada vez.
// Una marca que NO vale (vencida, puesto relanzado después, registro ilegible) deja el VACIO como estaba
// y le añade un quinto campo: «estaba aparcado, pero <por qué ya no vale>».
// Una sesión VIVA que no casa con ningún puesto NO se calla: si el equipo cambia de nombres otra vez, aquí
// sale como huérfana en vez de desaparecer.
//
// PREGUNTA (SCRUM-1357f): una sesión SIN PROCESO que conserva una pregunta en su `needs`. Medido el
// 17-oct-2026: `sesion-2` pasó a `blocked` a las 20:07:56Z pidiendo una firma y nadie la contestó hasta
// pararla a las 21:32:58Z, 85 minutos. El panel enseñaba «VACIO|S2|…»: un puesto vacío se cubre cuando
// se pueda, una pregunta se contesta YA, y se pintaban igual. Esto ya salía como BLOQUEADA «sin proceso»,
// pero DEBAJO de un VACIO del mismo puesto que lo contradecía. Ahora sale PRIMERO, con su propio rótulo,
// y SUSTITUYE al VACIO de su puesto (que viaja en el último campo). La pregunta sobrevive a la sesión:
// se lee del registro aunque el proceso haya muerto. Una muerta SIN `needs` sigue dando VACIO.
// La huella (`PREGUNTA|S2|sesion-2`) no cambia de un repintado a otro: el aviso suena una vez.
//
// 🔴 LA SALIDA VACÍA ES UNA AFIRMACIÓN. El plugin pinta «los 6 trabajando» cuando no lee ninguna línea, y
// hoy no mira el código de salida. Por eso este guion no puede reventar en silencio: cualquier fallo se
// imprime como `AVERIA|…` y sale 2.
//
// SALIDA: 0 = nada que atender (ninguna línea, o sólo APARCADO) · 1 = hay algo que atender · 2 = alguna
// AVERIA (va también en líneas).
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SALIDA_NADA = 0;
export const SALIDA_HAY = 1;
export const SALIDA_AVERIA = 2;
const PARADOS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'parados.mjs');
/** Lo que se espera a `parados.mjs`: él espera hasta 60 s al panel. */
const TOPE_MS = 120_000;
const MIN = 60_000;

/** Un campo no puede llevar `|` ni saltos: partiría la línea en el plugin. */
const campo = (s, n = 200) => {
  const t = String(s ?? '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const hace = (ahora, desde) => {
  if (!Number.isFinite(ahora) || !Number.isFinite(desde)) return 'desde no se sabe';
  const min = Math.max(0, Math.round((ahora - desde) / MIN));
  return min < 120 ? `hace ${min} min` : `hace ${(min / 60).toFixed(1)} h`;
};
const averia = (motivo) => ({ codigo: SALIDA_AVERIA, lineas: [`AVERIA|${campo(motivo, 300)}`] });
const horaDe = (ms) => (Number.isFinite(ms) ? `${new Date(ms).toISOString().slice(0, 16)}Z` : 'no se sabe');

/**
 * El informe de `parados.mjs --json` (su `datos`), traducido a las líneas del plugin.
 * @returns {{codigo: 0|1|2, lineas: string[]}}
 */
export function aLineas(datos) {
  if (!datos || typeof datos !== 'object' || !Array.isArray(datos.filas) || !Array.isArray(datos.ciegos)) {
    return averia('parados.mjs devolvió algo que no es su informe');
  }
  const lineas = [];
  for (const c of datos.ciegos) lineas.push(`AVERIA|no pude mirar ${campo(c, 300)}`);
  const noValen = datos.marcasQueNoValen || {};
  const vacios = datos.vacios || [];
  // 1357f: muerta con su pregunta dentro. Va antes que los vacíos y se come el VACIO de su puesto.
  const preguntas = (datos.bloqueadas || []).filter((f) => !f.pid && f.pregunta);
  for (const f of preguntas) {
    lineas.push(`PREGUNTA|${f.puesto || 'sin puesto'}|${campo(f.nombre, 60)}|${hace(datos.ahora, f.desde)}|sin proceso|«${campo(f.pregunta)}»${vacios.includes(f.puesto) ? '|su puesto está SIN CUBRIR' : ''}`);
  }
  const conPregunta = new Set(preguntas.map((f) => f.puesto));
  for (const p of vacios) {
    if (conPregunta.has(p)) continue;
    lineas.push(`VACIO|${campo(p)}|ninguna sesión suya con proceso|su puesto está SIN CUBRIR${noValen[p] ? `|estaba aparcado, pero ${campo(noValen[p])}` : ''}`);
  }
  for (const f of datos.bloqueadas || []) {
    if (preguntas.includes(f)) continue;
    lineas.push(`BLOQUEADA|${f.puesto || 'sin puesto'}|${campo(f.nombre, 60)}|${hace(datos.ahora, f.desde)}|${f.pid ? `pid ${f.pid}` : 'sin proceso'}|${f.pregunta ? `«${campo(f.pregunta)}»` : '(no dice qué espera)'}`);
  }
  for (const f of datos.esperan || []) {
    lineas.push(`TE ESPERA|${f.puesto || 'sin puesto'}|${campo(f.nombre, 60)}|${hace(datos.ahora, f.desde)}|pid ${f.pid}|${f.detalle ? `«${campo(f.detalle)}»` : '(no dice qué hizo)'}`);
  }
  const huerfanas = datos.filas.filter((f) => f && !f.puesto && f.pid).map((f) => campo(f.nombre, 60));
  if (huerfanas.length) lineas.push(`HUÉRFANAS|${huerfanas.length} sesión(es) VIVA(S) que no son de ningún puesto: ${huerfanas.join(', ')}|¿han cambiado los nombres?`);
  const avisos = lineas.length;
  for (const a of datos.aparcados || []) {
    lineas.push(`APARCADO|${campo(a.puesto)}|hasta ${horaDe(a.hasta)}|${a.motivo ? `«${campo(a.motivo)}»` : '(sin motivo)'}|aparcado a las ${horaDe(a.desde)}`);
  }
  const codigo = datos.ciegos.length ? SALIDA_AVERIA : avisos ? SALIDA_HAY : SALIDA_NADA;
  return { codigo, lineas };
}

/**
 * Corre `parados.mjs --json` y comprueba que su informe y su salida cuadran.
 * @returns {{datos: object} | {averia: string}}
 */
export function correrParados({ jobs, aparcados, lanzar = spawnSync, env = process.env } = {}) {
  const r = lanzar(process.execPath, [PARADOS, '--json', ...(jobs ? ['--jobs', jobs] : []), ...(aparcados ? ['--aparcados', aparcados] : [])],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: TOPE_MS, windowsHide: true, env });
  if (r.error) return { averia: `no pude correr parados.mjs (${r.error.code || r.error.message})` };
  let datos;
  try { datos = JSON.parse(String(r.stdout)); } catch {
    return { averia: `parados.mjs salió con ${r.status} sin un informe legible${r.stderr && r.stderr.trim() ? `: ${campo(r.stderr, 160)}` : ''}` };
  }
  if (!datos || datos.codigo !== r.status) return { averia: `parados.mjs salió con ${r.status} y su informe dice ${datos ? datos.codigo : 'nada'}: no cuadran` };
  return { datos };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fin = ({ codigo, lineas }) => {
    if (lineas.length) process.stdout.write(`${lineas.join('\n')}\n`);
    process.exitCode = codigo;
  };
  try {
    const i = process.argv.indexOf('--jobs');
    const k = process.argv.indexOf('--aparcados');
    const r = correrParados({ jobs: i >= 0 ? process.argv[i + 1] : undefined, aparcados: k >= 0 ? process.argv[k + 1] : undefined });
    fin(r.averia ? averia(r.averia) : aLineas(r.datos));
  } catch (e) {
    fin(averia(`sala.mjs reventó: ${e && e.message ? e.message : e}`));
  }
}
