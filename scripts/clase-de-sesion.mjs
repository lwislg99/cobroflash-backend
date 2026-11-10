// scripts/clase-de-sesion.mjs — SCRUM-1238b · «sin pid» no es «muerta», y «blocked» no es «viva»
//
// Qué es de verdad una sesión de fondo, con DOS fuentes y cada veredicto diciendo de cuál sale:
//   · el PROCESO: la lista de `claude agents --json` (un `pid` > 0 para su id). Sólo ella dice si
//     hay alguien al otro lado. Sin la lista → NO-PUDE-MIRAR, nunca un veredicto.
//   · el `state.json` del trabajo (`~/.claude/jobs/<id>/state.json`): `state`, `tempo`, `needs` y
//     `firstTerminalAt`. Dice QUÉ esperaba y si llegó a terminar algún turno; NO dice si vive.
//
// Los dos defectos que esto separa, medidos:
//   · `sesion.mjs` (`estadoDeJob`) da MUERTA a una sesión sin proceso con `firstTerminalAt` relleno,
//     y `firstTerminalAt` se rellena al acabar un TURNO: la J2 `4d9f556d` del 28-sep terminó su
//     turno preguntando dos cosas y se sustituyó (SCRUM-1238, registro ①).
//   · `latido.mjs` (`seccionSesiones`) da BLOQUEADA a toda sesión con `blocked`/`needs` sin mirar
//     si tiene proceso: el 24-oct por la mañana dio «BLOQUEADA hace 710/674 min» a jv-j1bb y
//     jv-j6bg, que no tenían proceso desde un reinicio de la máquina.
// Los dos ficheros son de S5: aquí vive sólo la función pura, y en el registro de SCRUM-1238 la
// llamada exacta para cada uno.
//
// Lo que esto NO decide: si una sesión TERMINADA (`done`, sin pregunta) cuenta como resto para
// `lanzar`/`relevar`/`olvidar`. Es la decisión ⑤ del registro de SCRUM-1238, de Javier y Luis.
//
// Uso (sólo lee): node scripts/clase-de-sesion.mjs [--jobs <dir>] [--agentes <fichero.json>] [--horas 24]
// Salida: 0 · clasificado · 2 · CIEGO (no se pudo leer la lista de procesos o la carpeta de trabajos).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { espera, preguntaDe } from './equipo/latido.mjs';

/** Los estados que sólo pone un final de verdad. `done` NO está: lo escribe también un fin de turno. */
export const ESTADOS_DE_FIN = Object.freeze(['stopped', 'failed', 'cancelled']);

export const CLASES = Object.freeze([
  'VIVA-TRABAJANDO',
  'VIVA-BLOQUEADA',
  'TERMINADA-ESPERANDO',
  'TERMINADA',
  'MUERTA-SIN-PROCESO',
  'NO-PUDE-MIRAR',
]);

/**
 * La forma que usa el latido (`leerTrabajos`) más `primerFin`, que el latido hoy no lee.
 * @param {object} raw el `state.json` tal cual
 */
export function desdeStateJson(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    estado: String(raw.state || 'desconocido'),
    tempo: raw.tempo,
    needs: raw.needs,
    primerFin: typeof raw.firstTerminalAt === 'string' && raw.firstTerminalAt ? raw.firstTerminalAt : null,
  };
}

/**
 * El proceso de `id` según la lista de `claude agents --json`.
 * @returns {number|null} el pid · 0 si la lista se leyó y no le da proceso · null si no hay lista
 */
export function procesoDe(agentes, id) {
  if (!Array.isArray(agentes)) return null;
  let pid = 0;
  for (const a of agentes) {
    if (a && a.id === id && typeof a.pid === 'number' && a.pid > 0) pid = a.pid;
  }
  return pid;
}

/**
 * @param {{estado:string, tempo?:string, needs?:any, primerFin?:string|null}|null} s
 * @param {number|null|undefined} proceso lo que devuelve `procesoDe`
 * @returns {{clase:string, motivo:string, pregunta:string, fuente:string}}
 */
export function claseDeSesion(s, proceso) {
  if (!s || typeof s !== 'object') {
    return { clase: 'NO-PUDE-MIRAR', motivo: 'su state.json no se pudo leer', pregunta: '', fuente: 'state.json' };
  }
  const pregunta = preguntaDe(s);
  const huella = `state=${s.estado}${s.tempo ? ` tempo=${s.tempo}` : ''}${s.primerFin ? ` firstTerminalAt=${s.primerFin}` : ' sin firstTerminalAt'}${pregunta ? ' con needs' : ''}`;
  if (typeof proceso !== 'number') {
    return { clase: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer la lista de procesos', pregunta, fuente: `claude agents: sin lista · state.json: ${huella}` };
  }
  if (proceso > 0) {
    const fuente = `claude agents: pid ${proceso} · state.json: ${huella}`;
    if (!espera(s)) return { clase: 'VIVA-TRABAJANDO', motivo: 'tiene proceso y no espera nada', pregunta, fuente };
    const cuando = s.primerFin ? 'a mitad de un turno' : 'en el arranque (aún no ha terminado ningún turno)';
    return { clase: 'VIVA-BLOQUEADA', motivo: `tiene proceso y está parada ${cuando}`, pregunta, fuente };
  }
  const fuente = `claude agents: sin proceso · state.json: ${huella}`;
  if (ESTADOS_DE_FIN.includes(s.estado)) {
    return { clase: 'MUERTA-SIN-PROCESO', motivo: `sin proceso y su state.json dice «${s.estado}»`, pregunta, fuente };
  }
  if (espera(s) && s.primerFin) {
    return { clase: 'TERMINADA-ESPERANDO', motivo: 'sin proceso: terminó su turno preguntando, y su contexto sigue ahí', pregunta, fuente };
  }
  if (s.estado === 'done') {
    return { clase: 'TERMINADA', motivo: 'sin proceso: terminó su turno y no pregunta nada', pregunta, fuente };
  }
  // `working` o `blocked` sin proceso y sin un turno que lo explique: se fue a mitad de turno (un reinicio).
  return { clase: 'MUERTA-SIN-PROCESO', motivo: `sin proceso y su state.json se quedó en «${s.estado}» a mitad de turno`, pregunta, fuente };
}

/** La línea del vigía para cada clase; `null` = no avisa. */
export function avisoDe(nombre, id, c) {
  const q = c.pregunta ? c.pregunta.slice(0, 200) : 'no lo dice';
  switch (c.clase) {
    case 'TERMINADA-ESPERANDO': return `${nombre} (${id}) te está esperando: ${q}`;
    case 'VIVA-BLOQUEADA': return `${nombre} (${id}) BLOQUEADA con proceso, ${c.motivo.replace(/^tiene proceso y está parada /, '')}: ${q}`;
    case 'MUERTA-SIN-PROCESO': return c.pregunta
      ? `${nombre} (${id}) SIN PROCESO (${c.motivo}): contestarle ahí no la despierta; su pregunta era: ${q}`
      : null;
    case 'NO-PUDE-MIRAR': return `${nombre} (${id}) NO SE PUDO MIRAR: ${c.motivo}`;
    default: return null;
  }
}

/**
 * Los trabajos tocados en las últimas `horas`, con su clase. `undefined` si no hay carpeta.
 * `agentes` puede ser la lista o una función que la lee: si es función, se llama DESPUÉS de leer los
 * state.json. Medido el 24-oct: con una lista leída antes, una sesión lanzada entre medias salió
 * MUERTA-SIN-PROCESO («working» sin pid) teniendo proceso. Leída después, toda sesión cuyo state.json
 * ya existía está en la lista si vive.
 */
export function clasificarTrabajos({ dir, agentes, ahora = Date.now(), horas = 24 }) {
  if (!fs.existsSync(dir)) return undefined;
  const leidos = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const ruta = path.join(dir, e.name, 'state.json');
    if (!fs.existsSync(ruta)) continue;
    let raw = null;
    try { raw = JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '')); } catch { raw = null; }
    const actualizado = (raw && Date.parse(raw.updatedAt)) || fs.statSync(ruta).mtimeMs;
    if ((ahora - actualizado) / 36e5 > horas) continue;
    leidos.push({ id: e.name, nombre: (raw && raw.name) || e.name, s: desdeStateJson(raw) });
  }
  const lista = typeof agentes === 'function' ? agentes() : agentes;
  return leidos.map(({ id, nombre, s }) => ({ id, nombre, ...claseDeSesion(s, procesoDe(lista, id)) }));
}

function leerAgentes(fichero) {
  try {
    if (fichero) return JSON.parse(fs.readFileSync(fichero, 'utf8'));
    const r = spawnSync('claude agents --json', { encoding: 'utf8', shell: true, timeout: 60_000 });
    return r.status === 0 ? JSON.parse(r.stdout) : null;
  } catch { return null; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
  const dir = arg('--jobs') || path.join(os.homedir(), '.claude', 'jobs');
  let agentes;
  const filas = clasificarTrabajos({ dir, agentes: () => (agentes = leerAgentes(arg('--agentes'))), horas: Number(arg('--horas') || 24) });
  if (!filas) { console.log(`CIEGO · no existe ${dir}`); process.exit(2); }
  const lista = Array.isArray(agentes) ? `${agentes.length} entradas en claude agents` : 'SIN lista de procesos';
  console.log(`CLASE DE SESIÓN · ${filas.length} trabajos tocados en ${arg('--horas') || 24} h · ${lista}`);
  for (const k of CLASES) console.log(`   ${k}: ${filas.filter((f) => f.clase === k).length}`);
  for (const f of filas) { const l = avisoDe(f.nombre, f.id, f); if (l) console.log(`   · ${l}`); }
  process.exit(Array.isArray(agentes) ? 0 : 2);
}
