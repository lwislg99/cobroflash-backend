#!/usr/bin/env node
// SCRUM-1357b · PARADOS — quién está bloqueado AHORA, contado por SESIÓN y nunca por puesto.
//
//   node scripts/equipo/parados.mjs            → la foto de ahora (segundos; no llama a GitHub)
//   node scripts/equipo/parados.mjs --json     → lo mismo, para otra herramienta
//   node scripts/equipo/parados.mjs --jobs <carpeta>   → otro registro (así lo doblan los tests)
//
// POR QUÉ EXISTE. El 13-oct-2026 había 37 sesiones en el panel y 31 BLOQUEADAS, siete de ese día,
// paradas entre 12 y 70 minutos. El vigía que miraba el orquestador decía «nadie parado», y con eso
// le dijo tres veces al fundador «los seis trabajando». El fundador lo vio antes, en su panel.
// La causa, medida: aquel vigía miraba UN PUESTO y cogía SU SESIÓN MÁS RECIENTE. Si ésa estaba viva
// daba el puesto por bueno, y no veía las otras cuatro del mismo puesto bloqueadas debajo.
//
//   >>> Aquí la unidad es la SESIÓN. El puesto sólo sirve para agrupar la salida. <<<
//
// ES UNA CAPA, NO UN MOTOR. Lo que la casa ya sabía contestar se llama, no se copia:
//   · `leerTrabajos`, `espera`, `preguntaDe`, `puestoDe` (`latido.mjs`, SCRUM-1350 · 1357): el
//     registro, y que el bloqueo vive en TRES campos (`state`, `tempo`, `needs`) y basta uno;
//   · `clasificarAgente`, `ESTADOS_TERMINALES` (`sesion.mjs`, SCRUM-954): el panel sigue listando
//     como `working` un trabajo que terminó hace semanas; el tell es que no tiene `pid`;
//   · `leerLinea`, `tramosDe` (`scripts/espera-del-equipo.mjs`, SCRUM-1414): desde cuándo está parada.
// El latido ya enseña las bloqueadas de hoy en su sección SESIONES, pero tarda minutos y habla con
// GitHub: en mitad de un turno se acaba mirando otra cosa más rápida, y ésa fue la que falló.
//
// LAS DOS FUENTES, Y POR QUÉ LAS DOS. Se contradicen, y cada una ve algo que la otra no:
//   PANEL     `claude agents --json`: lo que ve el fundador. Sabe si hay PROCESO (`pid`) y si espera
//             un permiso (`waitingFor`). No trae la pregunta, y da por `working` a los muertos.
//   REGISTRO  `~/.claude/jobs/<id>/state.json`: trae la PREGUNTA (`needs`) y el bloqueo que el panel
//             no enseña (`state=working` con `tempo=blocked`). Y ve la sesión que no llegó al panel
//             (medido el 1-oct-2026: dos lanzadas pidiendo un permiso que el panel no listaba).
// Una sesión está BLOQUEADA si lo dice CUALQUIERA de las dos. Se dice siempre cuál lo dice.
//
// LO QUE NO PUDO MIRAR, LO DICE. Si el panel no contesta, si no hay registro, si una sesión del panel
// no tiene un `state.json` legible, o si una dice `working` sin proceso y sin haber terminado, la
// primera línea es «NO PUDE MIRAR» y sale 2. Nunca «ninguna bloqueada» por no haber podido leer.
//
// LO QUE NO HACE: no contesta, no para, no relanza, no escribe en ningún sitio. Y NO sabe si una
// pregunta YA SE CONTESTÓ: una bloqueada a la que se respondió relanzando su puesto sigue saliendo
// hasta que alguien la para. ⚠️ Pararla BORRA su pregunta del registro (medido el 13-oct-2026: 131
// trabajos `stopped`, ninguno conserva `needs`); quien quiera guardarla, que pase antes el latido,
// que la copia a su libro (`latido.mjs preguntas`).
//
// SALIDA: 0 = miré todo y nadie está bloqueado · 1 = hay bloqueadas · 2 = NO PUDE MIRAR algo
// (y gana al 1: debajo va lo que sí se pudo leer, pero un «no sé» no se tapa con una lista).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { leerTrabajos, espera, preguntaDe, puestoDe, HORAS_DE_SESION } from './latido.mjs';
import { clasificarAgente, ESTADOS_TERMINALES } from './sesion.mjs';
import { leerLinea, tramosDe } from '../espera-del-equipo.mjs';

export const SALIDA_NADIE = 0;
export const SALIDA_HAY = 1;
export const SALIDA_CIEGO = 2;
/** Lo que se espera al panel. Medido el 13-oct-2026 con 15 entradas: contesta en 2 s. */
export const TOPE_PANEL_MS = 60_000;

const MIN = 60_000;
const horaDe = (ms) => `${new Date(ms).toISOString().slice(0, 16)}Z`;
const haceDe = (ms) => (ms < 120 * MIN ? `${Math.max(0, Math.round(ms / MIN))} min` : ms < 48 * 3600e3 ? `${(ms / 3600e3).toFixed(1)} h` : `${Math.round(ms / 86400e3)} d`);
const corto = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const celda = (s) => String(s).replace(/\|/g, '/');

/** En Windows `claude` es un `.cmd`: sin shell no se encuentra, y con `shell:true` node avisa de los argumentos. */
export function ordenPorDefecto(plataforma = process.platform, env = process.env) {
  return plataforma === 'win32' ? [env.ComSpec || 'cmd.exe', '/d', '/s', '/c', 'claude'] : ['claude'];
}

/**
 * Lee el panel. O devuelve la lista, o devuelve POR QUÉ no: nunca una lista vacía por un fallo.
 * @returns {{panel: object[]|null, motivo?: string}}
 */
export function leerPanel({ orden = ordenPorDefecto(), topeMs = TOPE_PANEL_MS, lanzar = spawnSync } = {}) {
  const [bin, ...previos] = orden;
  const r = lanzar(bin, [...previos, 'agents', '--json'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: topeMs, windowsHide: true });
  if (r.error) return { panel: null, motivo: r.error.code === 'ETIMEDOUT' ? `no contestó en ${Math.round(topeMs / 1000)} s` : `no se pudo lanzar (${r.error.code || r.error.message})` };
  if (r.status !== 0) return { panel: null, motivo: `salió con ${r.status === null ? `la señal ${r.signal}` : `código ${r.status}`}${r.stderr && r.stderr.trim() ? `: ${corto(r.stderr, 160)}` : ''}` };
  let a; try { a = JSON.parse(String(r.stdout).replace(/^﻿/, '')); } catch { return { panel: null, motivo: 'su salida no es JSON' }; }
  if (!Array.isArray(a)) return { panel: null, motivo: 'su salida no es una lista' };
  return { panel: a };
}

/**
 * Desde cuándo está parada. La línea de tiempo dice el instante en que dejó de trabajar; si no lo
 * dice (el bloqueo que vive sólo en `tempo`/`needs` no deja evento), queda la última escritura del
 * registro. La fuente se devuelve: son dos datos distintos y no se rotulan igual.
 * @returns {{desde:number|null, fuente:string}}
 */
export function paradaDesde(reg, linea) {
  if (typeof linea === 'string') {
    const tramos = tramosDe(leerLinea(linea).eventos);
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.tipo === 'cola') return { desde: ultimo.desde, fuente: 'timeline' };
  }
  if (reg && Number.isFinite(reg.actualizado)) return { desde: reg.actualizado, fuente: 'updatedAt' };
  return { desde: null, fuente: 'no se sabe' };
}

/**
 * @param {{panel: object[]|null, motivoPanel?: string, registro: {sesiones:object[], ilegibles:{id:string,motivo:string}[], sinEstado:string[]}|undefined, lineaDe?: (id:string)=>string|null, ahora:number}} e
 * `panel`: la salida de `claude agents --json` · `null` = no se pudo leer (con `motivoPanel`).
 * `registro`: lo que devuelve `leerTrabajos` · `undefined` = la carpeta no existe.
 * @returns {{codigo:0|1|2, lineas:string[], datos:object}}
 */
export function medir({ panel, motivoPanel = 'sin motivo', registro, lineaDe = () => null, ahora }) {
  const ciegos = [];
  const hayPanel = Array.isArray(panel);
  const hayRegistro = !!registro && Array.isArray(registro.sesiones);
  if (!hayPanel) ciegos.push(`el PANEL (\`claude agents --json\`): ${motivoPanel}`);
  if (!hayRegistro) ciegos.push('el REGISTRO: no existe la carpeta de trabajos (`~/.claude/jobs`)');

  const porId = new Map((hayRegistro ? registro.sesiones : []).map((s) => [s.id, s]));
  const ilegible = new Map((hayRegistro ? registro.ilegibles : []).map((i) => [i.id, i.motivo]));
  const entradas = hayPanel ? panel.filter((a) => a && typeof a === 'object') : [];
  const fondo = entradas.filter((a) => a.id);
  const interactivas = entradas.filter((a) => !a.id);
  const rotas = hayPanel ? panel.length - entradas.length : 0;
  if (rotas) ciegos.push(`${rotas} entrada(s) del panel que no son un objeto`);

  const filas = [];
  const fila = ({ a, reg }) => {
    const id = a ? a.id : reg.id;
    const nombre = (a && a.name) || (reg && reg.nombre) || id;
    const p = puestoDe(nombre);
    const dice = [];
    if (a && a.state === 'blocked') dice.push('panel: state=blocked');
    if (a && (a.status === 'waiting' || a.waitingFor)) dice.push(`panel: espera ${a.waitingFor || 'algo (no dice qué)'}`);
    if (reg && reg.estado === 'blocked') dice.push('registro: state=blocked');
    if (reg && reg.tempo === 'blocked') dice.push('registro: tempo=blocked');
    if (reg && reg.needs) dice.push('registro: needs');
    const sinRegistro = a && !reg ? (ilegible.has(id) ? `su state.json es ILEGIBLE (${ilegible.get(id)})` : 'no tiene state.json') : null;
    const job = reg ? { leido: true, terminal: ESTADOS_TERMINALES.includes(reg.estado), cuando: horaDe(reg.actualizado) } : { leido: false, motivo: sinRegistro || 'sin registro' };
    const vida = a ? clasificarAgente(a, job) : null;
    let clase; let nota = '';
    if (dice.length) clase = 'bloqueada';
    else if (!a) { clase = 'nose'; nota = `el registro la da por «${reg.estado}» y el panel NO la lista`; }
    else if (a.state === 'working') {
      clase = vida.estado === 'VIVA' ? 'trabajando' : vida.estado === 'MUERTA' ? 'resto' : 'nose';
      nota = vida.motivo;
    } else if (ESTADOS_TERMINALES.includes(a.state)) clase = 'acabada';
    else { clase = 'nose'; nota = `el panel le da un state que no conozco («${a.state}»)`; }
    const d = clase === 'bloqueada' ? paradaDesde(reg, reg ? lineaDe(id) : null) : { desde: null, fuente: '' };
    const pregunta = reg ? preguntaDe(reg) : '';
    return {
      id, nombre, puesto: p === null ? null : `S${p}`, clase, nota, dice,
      enPanel: !!a, estadoPanel: a ? a.state ?? null : null, estadoRegistro: reg ? reg.estado : null,
      pid: a && typeof a.pid === 'number' ? a.pid : null,
      desde: d.desde, fuente: d.fuente, pregunta, detalle: reg ? corto(reg.detalle, 300) : '',
      waitingFor: (a && a.waitingFor) || null, sinRegistro,
      // Quien lee «working» en el panel no mira más: si el bloqueo no está ahí, se dice.
      disfraz: clase === 'bloqueada' && !!a && a.state !== 'blocked',
    };
  };

  for (const a of fondo) filas.push(fila({ a, reg: porId.get(a.id) }));
  // El registro, por si el panel no lista algo que existe. Sólo lo de las últimas 24 h: lo más viejo
  // es del cementerio del latido, que guarda la pregunta aunque el registro la borre.
  const enPanel = new Set(fondo.map((a) => a.id));
  let viejas = 0;
  for (const s of hayRegistro ? registro.sesiones : []) {
    if (enPanel.has(s.id)) continue;
    const reciente = (ahora - s.actualizado) / 3600e3 <= HORAS_DE_SESION;
    if (espera(s)) { if (reciente) filas.push(fila({ a: null, reg: s })); else viejas++; continue; }
    if (reciente && !ESTADOS_TERMINALES.includes(s.estado)) filas.push(fila({ a: null, reg: s }));
  }

  const bloqueadas = filas.filter((f) => f.clase === 'bloqueada').sort((x, y) => (x.desde ?? Infinity) - (y.desde ?? Infinity));
  const dudosas = filas.filter((f) => f.clase === 'nose');
  const sinLeer = filas.filter((f) => f.sinRegistro);
  if (sinLeer.length) ciegos.push(`${sinLeer.length} sesión(es) del panel sin registro que leer (${sinLeer.map((f) => `${f.nombre}: ${f.sinRegistro}`).join(' · ')}): NO SÉ qué preguntan`);
  if (dudosas.length) ciegos.push(`${dudosas.length} sesión(es) que no sé si trabajan (${dudosas.map((f) => `${f.nombre} (${f.id}): ${f.nota}`).join(' · ')})`);

  const puestos = {};
  for (const f of filas) {
    const k = f.puesto || 'sin puesto';
    puestos[k] = puestos[k] || { trabajando: [], bloqueada: [], acabada: [], resto: [], nose: [] };
    puestos[k][f.clase].push(f.nombre);
  }
  const conBloqueo = Object.keys(puestos).filter((k) => puestos[k].bloqueada.length).sort();
  const codigo = ciegos.length ? SALIDA_CIEGO : bloqueadas.length ? SALIDA_HAY : SALIDA_NADIE;

  const out = [];
  const titular = bloqueadas.length
    ? `${bloqueadas.length} SESIÓN(ES) BLOQUEADA(S) en ${conBloqueo.length} puesto(s) (${conBloqueo.join(', ')})${Number.isFinite(bloqueadas[0].desde) ? ` · la más antigua, hace ${haceDe(ahora - bloqueadas[0].desde)}` : ''}`
    : 'ninguna sesión bloqueada';
  if (ciegos.length) {
    out.push(`🔴 PARADOS · NO PUDE MIRAR (salida 2) — esto NO quiere decir que nadie esté parado.`);
    for (const c of ciegos) out.push(`   · no pude mirar ${c}`);
    // Con algo sin mirar, un cero NO es «nadie»: no se escribe con las palabras del verde.
    out.push(bloqueadas.length ? `   En lo que SÍ pude leer: ${titular}.` : '   En lo que SÍ pude leer hay 0 bloqueadas, y con lo que falta por mirar eso NO vale como «nadie parado».');
  } else out.push(`${bloqueadas.length ? '🔴' : '✅'} PARADOS · ${titular}`);
  out.push(
    `   mirado a las ${horaDe(ahora)} (reloj de esta máquina) · contado por SESIÓN, no por puesto`,
    `   panel: ${hayPanel ? `${panel.length} entradas — ${fondo.length} trabajos de fondo, ${interactivas.length} interactivas (${interactivas.map((a) => a.name || '?').join(', ') || 'ninguna'}; no son trabajos y no se miran)` : 'NO LEÍDO'}`,
    `   registro: ${hayRegistro ? `${registro.sesiones.length} trabajos con state.json · ${registro.ilegibles.length} ilegibles · ${registro.sinEstado.length} carpetas sin state.json · fuera del panel sólo se mira lo de las últimas ${HORAS_DE_SESION} h` : 'NO LEÍDO'}`,
  );

  if (bloqueadas.length) {
    out.push('', 'BLOQUEADAS (de la que más lleva a la que menos)', '| puesto | sesión | id | parada desde | hace | proceso | quién lo dice | espera |', '|---|---|---|---|---|---|---|---|');
    for (const f of bloqueadas) {
      const desde = Number.isFinite(f.desde) ? `${horaDe(f.desde)}${f.fuente === 'updatedAt' ? ' (`updatedAt`)' : ''}` : 'no se sabe';
      const espera_ = f.sinRegistro ? `NO PUDE LEERLO: ${f.sinRegistro}`
        : f.pregunta ? `«${corto(f.pregunta, 220)}»`
          : `NO LO DICE (sin \`needs\`)${f.waitingFor ? ` · el panel: ${f.waitingFor}` : ''}${f.detalle ? ` · su \`detail\`: «${corto(f.detalle, 120)}»` : ''}`;
      const marcas = `${f.disfraz ? ` ⚠️ el panel la da por «${f.estadoPanel}»` : ''}${f.enPanel ? '' : ' ⚠️ NO sale en el panel'}`;
      out.push(`| ${f.puesto || '—'} | ${celda(f.nombre)} | ${f.id} | ${desde} | ${Number.isFinite(f.desde) ? haceDe(ahora - f.desde) : '?'} | ${f.pid ? `pid ${f.pid}` : 'sin proceso'} | ${celda(f.dice.join(' · '))}${marcas} | ${celda(espera_)} |`);
    }
    out.push('«parada desde» sale del `timeline.jsonl` de la sesión; con (`updatedAt`), de la última escritura de su state.json, que es lo que hay cuando el bloqueo no dejó evento.');
  }

  const claves = Object.keys(puestos).sort();
  if (claves.length) {
    out.push('', 'POR PUESTO (cada sesión cuenta una vez; una viva NO tapa a las bloqueadas de su puesto)', '| puesto | trabajando | bloqueadas | acabadas | restos | no sé |', '|---|---|---|---|---|---|');
    for (const k of claves) {
      const v = puestos[k];
      const n = (l) => (l.length ? `${l.length} (${l.join(', ')})` : '0');
      // «Nadie» sólo es un aviso en un PUESTO: las sesiones sin puesto no forman uno.
      out.push(`| ${k} | ${v.trabajando.length || k === 'sin puesto' ? n(v.trabajando) : '0 ⚠️ NADIE'} | ${n(v.bloqueada)} | ${n(v.acabada)} | ${n(v.resto)} | ${n(v.nose)} |`);
    }
    out.push('trabajando = el panel la da por `working` Y tiene proceso · acabada = el panel la da por terminada · resto = el panel la da por `working`, pero no tiene proceso y su state.json dice que terminó.');
  }
  if (viejas) out.push('', `Además, ${viejas} trabajo(s) de más de ${HORAS_DE_SESION} h que ya no están en el panel conservan una pregunta en el registro: son del cementerio → node scripts/equipo/latido.mjs preguntas`);
  if (bloqueadas.length) out.push('', '⚠️ Parar una sesión BORRA su pregunta del registro. Esto no sabe si ya se contestó: sólo que sigue bloqueada.');

  return { codigo, lineas: out, datos: { codigo, ahora, bloqueadas, puestos, ciegos, filas, viejas, panel: hayPanel ? { entradas: panel.length, fondo: fondo.length, interactivas: interactivas.length } : null } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n, def) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : def; };
  const dir = arg('--jobs', path.join(os.homedir(), '.claude', 'jobs'));
  // `PARADOS_CLAUDE`: la orden del panel como lista JSON (`["node","doble.mjs"]`). Así lo doblan los tests.
  let orden = ordenPorDefecto(); let ordenRota = null;
  if (process.env.PARADOS_CLAUDE) {
    try { orden = JSON.parse(process.env.PARADOS_CLAUDE); if (!Array.isArray(orden) || !orden.length || orden.some((x) => typeof x !== 'string')) throw new Error('no es una lista de textos'); } catch (e) { ordenRota = `PARADOS_CLAUDE no se deja leer (${e.message})`; }
  }
  const leido = ordenRota ? { panel: null, motivo: ordenRota } : leerPanel({ orden });
  let registro; try { registro = leerTrabajos(dir); } catch { registro = undefined; }
  const lineaDe = (id) => { try { return fs.readFileSync(path.join(dir, id, 'timeline.jsonl'), 'utf8'); } catch { return null; } };
  const r = medir({ panel: leido.panel, motivoPanel: leido.motivo, registro, lineaDe, ahora: Date.now() });
  console.log(process.argv.includes('--json') ? JSON.stringify(r.datos, null, 2) : r.lineas.join('\n'));
  process.exit(r.codigo);
}
