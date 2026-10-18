#!/usr/bin/env node
// SCRUM-1357b · PARADOS — quién está bloqueado AHORA, contado por SESIÓN y nunca por puesto.
//
//   node scripts/equipo/parados.mjs            → la foto de ahora (segundos; no llama a GitHub)
//   node scripts/equipo/parados.mjs --json     → lo mismo, para otra herramienta
//   node scripts/equipo/parados.mjs --jobs <carpeta>   → otro registro (así lo doblan los tests)
//   node scripts/equipo/parados.mjs --aparcados <fichero>  → otras marcas de aparcado (SCRUM-1357e)
//   node scripts/equipo/parados.mjs --control  → el control positivo, sin `npm test` (SCRUM-1357g)
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
// TE ESPERA (SCRUM-1357c). Una sesión de fondo que acaba su turno queda en `state=done · tempo=idle`, y
// `done` NO es terminal: con un mensaje vuelve a `working`. Medido el 16-oct-2026 en los `timeline.jsonl`:
// `s3-15octb` pasó a `done` a las 16:54Z y volvió a `working` a las 17:33Z, 39 min esperando. Hasta 1357c
// esto la llamaba «acabada» sin mirar el proceso y salía 0 con ✅, el día en que el fundador avisó de
// cinco puestos sin atender. Ahora: terminada (en el panel o en el registro: basta uno) Y con proceso →
// TE ESPERA. «Quieta» no se deduce de un tamaño que no crece: lo afirman las dos fuentes al acabar el turno.
//
// PUESTOS VACÍOS (`--puestos`, por defecto S0-S5). Un puesto sin NINGUNA sesión con proceso no tenía fila:
// la tabla sólo listaba los que tenían alguna. Sin panel no se afirma (no hay procesos que ver).
//
// APARCADOS (SCRUM-1357e). Un puesto vacío que el orquestador ha parado A PROPÓSITO (`aparcar.mjs`) sale
// como APARCADO y no cuenta como alarma. Sólo si su marca VALE (`juzgarAparcado`: no vencida, nadie del
// puesto lanzado después, registro legible); si no vale, sale VACÍO como siempre y dice por qué no valió.
// Una marca ilegible es un ciego. `--aparcados <fichero>` lee otra; con `--jobs` y sin `--aparcados` no se
// lee ninguna: las marcas hablan de las sesiones del registro de verdad, no de uno doblado.
//
// SALIDA: 0 = miré todo y nadie está bloqueado, nadie espera y no falta ningún puesto pedido (los
// aparcados no faltan) · 1 = hay alguna de las tres · 2 = NO PUDE MIRAR algo (y gana al 1: debajo va lo
// que sí se pudo leer, pero un «no sé» no se tapa con una lista).
//
// CONTROL (SCRUM-1357g, `--control`). Fabrica cinco casos y comprueba que se ven como deben: una que
// trabaja (0), una que te espera (1), una bloqueada que el panel da por `working` (1, con su pregunta), un
// panel que no se puede leer (2, NUNCA «ninguna») y un state.json ilegible (2). Pasa por las piezas DE
// VERDAD: el `leerPanel` de aquí con un lanzador falso (su JSON se parsea igual), el `leerTrabajos` del
// latido sobre state.json escritos en un temporal, y este `medir`. No una copia de la condición: el
// 18-oct-2026 un vigía con su `--control` sobre una copia daba verde mientras el programa contaba mal.
// No toca el panel ni el registro reales. Sale 0 si caza los cinco; 2 si no (un vigía cuyo control
// falla está ciego, aunque mire).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { leerTrabajos, espera, preguntaDe, puestoDe, HORAS_DE_SESION } from './latido.mjs';
import { clasificarAgente, ESTADOS_TERMINALES } from './sesion.mjs';
import { leerLinea, tramosDe } from '../espera-del-equipo.mjs';
import { ficheroDeAparcados, leerAparcados, juzgarAparcado } from './aparcar.mjs';

export const SALIDA_NADIE = 0;
export const SALIDA_HAY = 1;
export const SALIDA_CIEGO = 2;
/** Lo que se espera al panel. Medido el 13-oct-2026 con 15 entradas: contesta en 2 s. */
export const TOPE_PANEL_MS = 60_000;
/** Los puestos del equipo que se miran por defecto desde la línea de órdenes (`dos-equipos.md`). */
export const PUESTOS_DEL_EQUIPO = Object.freeze(['S0', 'S1', 'S2', 'S3', 'S4', 'S5']);

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
 * `puestos`: los que tienen que tener alguna sesión viva (`['S0', …]`) · `[]` = no se mira.
 * `aparcados`: lo que devuelve `leerAparcados` (`{marcas}` o `{marcas:null, motivo}`) · ausente = ninguna marca.
 * @returns {{codigo:0|1|2, lineas:string[], datos:object}}
 */
export function medir({ panel, motivoPanel = 'sin motivo', registro, lineaDe = () => null, ahora, puestos: pedidos = [], motivoPuestos = null, aparcados: marcasLeidas = { marcas: {} } }) {
  const ciegos = [];
  if (motivoPuestos) ciegos.push(`los PUESTOS pedidos: ${motivoPuestos}`);
  if (!marcasLeidas || !marcasLeidas.marcas) ciegos.push(`las MARCAS DE APARCADO: ${(marcasLeidas && marcasLeidas.motivo) || 'sin motivo'} — un puesto aparcado sale como SIN CUBRIR`);
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
    // 1357c: terminada en CUALQUIERA de las dos fuentes y con proceso = acabó su turno y espera.
    const conProceso = !!a && typeof a.pid === 'number' && a.pid > 0;
    const terminoPanel = !!a && ESTADOS_TERMINALES.includes(a.state);
    const terminoRegistro = !!reg && ESTADOS_TERMINALES.includes(reg.estado);
    let clase; let nota = '';
    if (dice.length) clase = 'bloqueada';
    else if (!a) { clase = 'nose'; nota = `el registro la da por «${reg.estado}» y el panel NO la lista`; }
    else if (conProceso && (terminoPanel || terminoRegistro)) {
      clase = 'espera';
      if (terminoPanel) dice.push(`panel: state=${a.state}`);
      if (terminoRegistro) dice.push(`registro: state=${reg.estado}`);
      if (a.status) dice.push(`panel: status=${a.status}`);
    } else if (a.state === 'working') {
      clase = vida.estado === 'VIVA' ? 'trabajando' : vida.estado === 'MUERTA' ? 'resto' : 'nose';
      nota = vida.motivo;
    } else if (ESTADOS_TERMINALES.includes(a.state)) clase = 'acabada';
    else { clase = 'nose'; nota = `el panel le da un state que no conozco («${a.state}»)`; }
    const d = clase === 'bloqueada' || clase === 'espera' ? paradaDesde(reg, reg ? lineaDe(id) : null) : { desde: null, fuente: '' };
    const pregunta = reg ? preguntaDe(reg) : '';
    return {
      id, nombre, puesto: p === null ? null : `S${p}`, clase, nota, dice,
      enPanel: !!a, estadoPanel: a ? a.state ?? null : null, estadoRegistro: reg ? reg.estado : null,
      pid: a && typeof a.pid === 'number' ? a.pid : null,
      desde: d.desde, fuente: d.fuente, pregunta, detalle: reg ? corto(reg.detalle, 300) : '',
      waitingFor: (a && a.waitingFor) || null, sinRegistro,
      // Quien lee «working» en el panel no mira más: si el bloqueo no está ahí, se dice.
      disfraz: (clase === 'bloqueada' && !!a && a.state !== 'blocked') || (clase === 'espera' && !terminoPanel),
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

  const esperan = filas.filter((f) => f.clase === 'espera').sort((x, y) => (x.desde ?? Infinity) - (y.desde ?? Infinity));
  const nuevo = () => ({ trabajando: [], bloqueada: [], acabada: [], resto: [], nose: [], espera: [] });
  const puestos = {};
  // Sin panel no hay procesos que ver: un puesto pedido no se puede dar por vacío, ni pintar como tal.
  if (hayPanel) for (const p of pedidos) puestos[p] = nuevo();
  for (const f of filas) {
    const k = f.puesto || 'sin puesto';
    puestos[k] = puestos[k] || nuevo();
    puestos[k][f.clase].push(f.nombre);
  }
  // Vacío = ninguna sesión suya con proceso. Si alguna es «no sé», no se afirma: ya va en los ciegos.
  const sinNadie = hayPanel ? pedidos.filter((p) => !filas.some((f) => f.puesto === p && (f.pid || f.clase === 'nose'))) : [];
  // 1357e: de los vacíos, los que el orquestador aparcó a propósito y cuya marca VALE. Ante la duda, vacío.
  const marcas = (marcasLeidas && marcasLeidas.marcas) || {};
  const aparcados = [];
  const marcasQueNoValen = {};
  for (const p of sinNadie) {
    if (!Object.prototype.hasOwnProperty.call(marcas, p)) continue;
    const j = juzgarAparcado({ puesto: p, marca: marcas[p], sesiones: hayRegistro ? registro.sesiones : null, ahora });
    if (j.vale) aparcados.push({ puesto: p, desde: j.desde, hasta: j.hasta, motivo: j.motivo });
    else marcasQueNoValen[p] = j.porque;
  }
  const vacios = sinNadie.filter((p) => !aparcados.some((a) => a.puesto === p));
  const conBloqueo = Object.keys(puestos).filter((k) => puestos[k].bloqueada.length).sort();
  const conEspera = Object.keys(puestos).filter((k) => puestos[k].espera.length).sort();
  const alarma = bloqueadas.length || esperan.length || vacios.length;
  const codigo = ciegos.length ? SALIDA_CIEGO : alarma ? SALIDA_HAY : SALIDA_NADIE;

  const out = [];
  const partes = [];
  if (bloqueadas.length) partes.push(`${bloqueadas.length} SESIÓN(ES) BLOQUEADA(S) en ${conBloqueo.length} puesto(s) (${conBloqueo.join(', ')})${Number.isFinite(bloqueadas[0].desde) ? ` · la más antigua, hace ${haceDe(ahora - bloqueadas[0].desde)}` : ''}`);
  if (esperan.length) partes.push(`${esperan.length} SESIÓN(ES) TE ESPERA(N) (acabaron su turno y siguen vivas) en ${conEspera.length} puesto(s) (${conEspera.join(', ')})${Number.isFinite(esperan[0].desde) ? ` · la que más, hace ${haceDe(ahora - esperan[0].desde)}` : ''}`);
  if (vacios.length) partes.push(`PUESTO(S) SIN NINGUNA SESIÓN VIVA: ${vacios.map((p) => (marcasQueNoValen[p] ? `${p} (estaba aparcado, pero ${marcasQueNoValen[p]})` : p)).join(', ')}`);
  const titular = partes.length ? partes.join(' · ') : 'ninguna sesión bloqueada';
  const aparcadosTxt = aparcados.map((a) => `${a.puesto} hasta ${horaDe(a.hasta)} («${corto(a.motivo, 80)}»)`).join(', ');
  if (ciegos.length) {
    out.push(`🔴 PARADOS · NO PUDE MIRAR (salida 2) — esto NO quiere decir que nadie esté parado.`);
    for (const c of ciegos) out.push(`   · no pude mirar ${c}`);
    // Con algo sin mirar, un cero NO es «nadie»: no se escribe con las palabras del verde.
    out.push(alarma ? `   En lo que SÍ pude leer: ${titular}.` : '   En lo que SÍ pude leer hay 0 bloqueadas, y con lo que falta por mirar eso NO vale como «nadie parado».');
  } else {
    out.push(`${alarma ? '🔴' : '✅'} PARADOS · ${titular}`);
    out.push(`   ${esperan.length ? `${esperan.length} te espera(n)` : 'ninguna te espera'} · ${!pedidos.length ? 'no se pidió mirar puestos (--puestos)' : `puestos pedidos: ${pedidos.join(', ')} — ${vacios.length ? `SIN sesión viva: ${vacios.join(', ')}` : aparcados.length ? 'los no aparcados, todos con alguna sesión viva' : 'todos con alguna sesión viva'}`}`);
  }
  if (aparcados.length) out.push(`   ⏸ APARCADO(S) A PROPÓSITO, no es una avería: ${aparcadosTxt} (\`aparcar.mjs\`)`);
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

  if (esperan.length) {
    out.push('', 'TE ESPERAN (acabaron su turno y su proceso sigue vivo; de la que más lleva a la que menos)', '| puesto | sesión | id | acabó | hace | proceso | quién lo dice | lo último que dijo |', '|---|---|---|---|---|---|---|---|');
    for (const f of esperan) {
      const desde = Number.isFinite(f.desde) ? `${horaDe(f.desde)}${f.fuente === 'updatedAt' ? ' (`updatedAt`)' : ''}` : 'no se sabe';
      const marca = f.disfraz ? ` ⚠️ el panel la da por «${f.estadoPanel}»` : '';
      out.push(`| ${f.puesto || '—'} | ${celda(f.nombre)} | ${f.id} | ${desde} | ${Number.isFinite(f.desde) ? haceDe(ahora - f.desde) : '?'} | pid ${f.pid} | ${celda(f.dice.join(' · '))}${marca} | ${f.detalle ? `«${celda(f.detalle)}»` : 'no lo dice (sin `detail`)'} |`);
    }
  }

  const claves = Object.keys(puestos).sort();
  if (claves.length) {
    out.push('', 'POR PUESTO (cada sesión cuenta una vez; una viva NO tapa a las bloqueadas de su puesto)', '| puesto | trabajando | bloqueadas | acabadas | restos | no sé | te esperan |', '|---|---|---|---|---|---|---|');
    for (const k of claves) {
      const v = puestos[k];
      const n = (l) => (l.length ? `${l.length} (${l.join(', ')})` : '0');
      // «Nadie» sólo es un aviso en un PUESTO: las sesiones sin puesto no forman uno. Una que te espera está viva.
      out.push(`| ${k} | ${v.trabajando.length || v.espera.length || k === 'sin puesto' ? n(v.trabajando) : aparcados.some((a) => a.puesto === k) ? '0 ⏸ aparcado' : '0 ⚠️ NADIE'} | ${n(v.bloqueada)} | ${n(v.acabada)} | ${n(v.resto)} | ${n(v.nose)} | ${n(v.espera)} |`);
    }
    out.push('trabajando = el panel la da por `working` Y tiene proceso · acabada = terminada y SIN proceso · resto = el panel la da por `working`, pero no tiene proceso y su state.json dice que terminó · te espera = terminada (panel o registro) y CON proceso.');
  }
  if (viejas) out.push('', `Además, ${viejas} trabajo(s) de más de ${HORAS_DE_SESION} h que ya no están en el panel conservan una pregunta en el registro: son del cementerio → node scripts/equipo/latido.mjs preguntas`);
  if (bloqueadas.length) out.push('', '⚠️ Parar una sesión BORRA su pregunta del registro. Esto no sabe si ya se contestó: sólo que sigue bloqueada.');

  return { codigo, lineas: out, datos: { codigo, ahora, bloqueadas, esperan, vacios, aparcados, marcasQueNoValen, pedidos: [...pedidos], puestos, ciegos, filas, viejas, panel: hayPanel ? { entradas: panel.length, fondo: fondo.length, interactivas: interactivas.length } : null } };
}

/**
 * SCRUM-1357g · el control positivo. Las piezas se pueden cambiar para probar el control mismo: un control
 * que no cae cuando `medir` se equivoca no controla nada.
 * @returns {{ok:boolean, lineas:string[]}}
 */
export function control({ medir: medirX = medir, leerPanel: leerPanelX = leerPanel, leerTrabajos: leerTrabajosX = leerTrabajos, ahora = Date.now() } = {}) {
  const iso = (ms) => new Date(ms).toISOString();
  const lanzadorQueContesta = (entradas) => () => ({ status: 0, stdout: JSON.stringify(entradas), stderr: '' });
  const lanzadorRoto = () => ({ error: Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }), status: null });
  const panelDe = (id, name, state, pid, status) => ({ id, name, kind: 'background', state, pid, status, cwd: 'D:\\control' });
  const estado = (name, state, tempo, extra = {}) => JSON.stringify({ name, state, tempo, updatedAt: iso(ahora - 10 * MIN), createdAt: iso(ahora - 60 * MIN), ...extra });
  const PREGUNTA = '¿Me das la cookie de la demo para medir el plan?';

  const casos = [
    { n: 'una que trabaja', espera: 'sale 0 y la cuenta trabajando',
      panel: lanzadorQueContesta([panelDe('c1357g01', 'sesion-1', 'working', 101, 'busy')]),
      jobs: { c1357g01: estado('sesion-1', 'working', 'active') },
      vale: (r) => r.codigo === SALIDA_NADIE && r.datos.filas.some((f) => f.id === 'c1357g01' && f.clase === 'trabajando') },
    { n: 'una que acabó su turno con proceso', espera: 'sale 1 y TE ESPERA',
      panel: lanzadorQueContesta([panelDe('c1357g02', 'sesion-2', 'done', 102, 'idle')]),
      jobs: { c1357g02: estado('sesion-2', 'done', 'idle') },
      vale: (r) => r.codigo === SALIDA_HAY && r.datos.esperan.some((f) => f.id === 'c1357g02') },
    { n: 'una bloqueada que el panel da por working', espera: 'sale 1, BLOQUEADA y con su pregunta',
      panel: lanzadorQueContesta([panelDe('c1357g03', 'sesion-3', 'working', 103, 'busy')]),
      jobs: { c1357g03: estado('sesion-3', 'working', 'blocked', { needs: PREGUNTA }) },
      vale: (r) => r.codigo === SALIDA_HAY && r.datos.bloqueadas.some((f) => f.id === 'c1357g03' && f.disfraz && f.pregunta === PREGUNTA) },
    { n: 'un panel que no se puede leer', espera: 'sale 2 y dice NO PUDE MIRAR, nunca «ninguna»',
      panel: lanzadorRoto,
      jobs: { c1357g04: estado('sesion-4', 'done', 'idle') },
      vale: (r) => r.codigo === SALIDA_CIEGO && /NO PUDE MIRAR/.test(r.lineas[0]) && !r.lineas.some((l) => /✅|ninguna sesión bloqueada/.test(l)) },
    { n: 'un state.json ilegible', espera: 'sale 2: no sé qué pregunta',
      panel: lanzadorQueContesta([panelDe('c1357g05', 'sesion-5', 'working', 105, 'busy')]),
      jobs: { c1357g05: '{ esto no es json' },
      vale: (r) => r.codigo === SALIDA_CIEGO && r.datos.ciegos.some((c) => /ILEGIBLE/.test(c)) },
  ];

  const lineas = [];
  let mal = 0;
  let raiz = null;
  try {
    raiz = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-1357g-${process.pid}-`));
    casos.forEach((c, i) => {
      let r = null; let fallo = '';
      try {
        const dir = path.join(raiz, String(i));
        for (const [id, cuerpo] of Object.entries(c.jobs)) {
          fs.mkdirSync(path.join(dir, id), { recursive: true });
          fs.writeFileSync(path.join(dir, id, 'state.json'), cuerpo);
        }
        const leido = leerPanelX({ orden: ['claude'], lanzar: c.panel });
        r = medirX({ panel: leido.panel, motivoPanel: leido.motivo, registro: leerTrabajosX(dir), ahora });
      } catch (e) { fallo = `reventó: ${e.message}`; }
      const ok = !fallo && !!r && c.vale(r) === true;
      if (!ok) mal++;
      lineas.push(`  ${ok ? '✔' : '🔴'} ${c.n} → ${c.espera}${ok ? '' : ` · ha dado: ${fallo || (r ? `salida ${r.codigo} · «${corto(r.lineas[0], 140)}»` : 'nada')}`}`);
    });
  } catch (e) {
    mal++;
    lineas.push(`  🔴 no pude fabricar los casos: ${e.message}`);
  } finally {
    if (raiz) fs.rmSync(raiz, { recursive: true, force: true });
  }
  lineas.unshift(mal
    ? `🔴 PARADOS · CONTROL: falla en ${mal} de ${casos.length} — no te fíes de su salida`
    : `✅ PARADOS · CONTROL: caza los ${casos.length} casos (los de verdad: leerPanel, leerTrabajos y medir)`);
  return { ok: mal === 0, lineas };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--control')) {
  const c = control();
  console.log(c.lineas.join('\n'));
  process.exit(c.ok ? SALIDA_NADIE : SALIDA_CIEGO);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && !process.argv.includes('--control')) {
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
  // `--puestos S0,S3` (por defecto los seis; `--puestos ninguno` no mira puestos). Lo que no se entiende
  // NO se lee como «ninguno»: un vacío por errata sería el verde que nadie pidió.
  const crudo = arg('--puestos', PUESTOS_DEL_EQUIPO.join(','));
  const lista = crudo === 'ninguno' ? [] : String(crudo).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const malos = crudo === 'ninguno' ? [] : !lista.length ? [String(crudo)] : lista.filter((p) => !/^S\d$/.test(p));
  const motivoPuestos = malos.length ? `--puestos no se deja leer («${malos.join(', ')}»): se esperan nombres como S0,S3, o «ninguno»` : null;
  // 1357e: con otro registro (`--jobs`) las marcas del equipo no aplican; se pasan con `--aparcados`.
  const ficheroMarcas = arg('--aparcados', process.argv.includes('--jobs') ? null : ficheroDeAparcados());
  const aparcados = ficheroMarcas ? leerAparcados(ficheroMarcas) : { marcas: {} };
  const r = medir({ panel: leido.panel, motivoPanel: leido.motivo, registro, lineaDe, ahora: Date.now(), puestos: malos.length ? [] : lista, motivoPuestos, aparcados });
  console.log(process.argv.includes('--json') ? JSON.stringify(r.datos, null, 2) : r.lineas.join('\n'));
  process.exit(r.codigo);
}
