#!/usr/bin/env node
// SCRUM-1350 · EL LATIDO DEL ORQUESTADOR
//
//   node scripts/equipo/latido.mjs            → todas las secciones
//   node scripts/equipo/latido.mjs repartos   → el libro de repartos (quién mandó qué a quién)
//   node scripts/equipo/latido.mjs cierre     → el obligatorio del último push de ESTA rama
//   node scripts/equipo/latido.mjs contestada <id> <dónde>   → apunta en el libro que esa pregunta ya
//                                               tiene respuesta (SCRUM-1357), y DÓNDE está escrita
//
// POR QUÉ EXISTE. El 29-sep-2026 se abrieron diez PR que NACIERON rojos y estuvieron dos días así
// con el auto-merge armado. Medido el 1-oct: los detectores EXISTÍAN y los vieron —`vigia-atascados`
// los metió en el issue #1241 y el avisador rojo despertó a Claude en los diez—, pero el aviso fue
// a dos buzones que ni el orquestador ni las sesiones abren. Faltaba el canal, no el detector.
//
//   >>> Esto NO detecta nada nuevo: pone delante de quien reparte lo que ya se sabía en otro sitio. <<<
//
// Por eso REUSA los clasificadores de `scripts/vigia-atascados.mjs` en vez de copiarlos: dos copias
// de «qué es un PR atascado» son la próxima contradicción con fecha puesta.
//
// LO QUE MIRA, y cada sección declara su POBLACIÓN o dice «NO PUDE MIRAR» (nunca cero filas mudas):
//   1 · PR       → obligatorio ROJO ≥ 2 h con lo que cayó · punta SIN check con la EDAD del push
//                  («sin check» a los 2 min de empujar es «aún no ha arrancado»: medido el 1-oct,
//                  y confundirlos costó tirar una corrida buena).
//   2 · SESIONES → bloqueadas con lo que esperan (`needs`/`detail` de su state.json) · y la que ya
//                  NO trabaja teniendo un PR suyo en rojo o sin veredicto: «nadie vuelve».
//   3 · TRASPASO → de cada sesión que ya no trabaja, ¿su traspaso existe y es posterior a su arranque?
//   4 · MAIN     → último commit con el obligatorio en VERDE y cuántos hay detrás sin veredicto.
//                  El color de la CORRIDA no se mira: medido el 1-oct, sale roja el 85 % de las
//                  veces que termina por los informativos, y 34 de 60 no ejecutan ningún job.
//   5 · DESPLIEGUE → `in_progress` más de 10 min. Medido sobre 100 despliegues: mediana 1,6 min;
//                  lo que tarda diez es un despliegue ATASCADO, no uno en cola.
//   6 · CEMENTERIO → (SCRUM-1357) la pregunta de TODA sesión bloqueada de más de 24 h, viva o muerta,
//                  con su edad. Medido el 1-oct: ocho, del 27 al 29-sep, ninguna contestada, y la
//                  sección 2 no las veía porque solo mira las de hoy. Una pregunta no caduca porque
//                  muera quien la hizo. Y un state.json que no se deja leer se DICE: antes se saltaba.
//
// DE DÓNDE SALEN LAS SESIONES: del REGISTRO de trabajos (`~/.claude/jobs/*/state.json`), nunca del
// panel. Medido el 1-oct: dos sesiones lanzadas desde una carpeta nueva quedaron pidiendo un permiso,
// el lanzador dijo «backgrounded» con su id, `ListAgents` no las listaba y se las dio por trabajando
// una hora. El panel vacío se leyó como «no existe». Y el bloqueo no siempre está en `state`: una
// sesión con `state=working` puede llevar `tempo=blocked` y la pregunta en `needs`.
//
// SALIDA: 0 = nada que atender · 1 = hay algo · 2 = alguna sección NO PUDO MIRAR (y gana al 1:
// un «no sé» no se tapa con un «hay tres cosas»).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  esAsuntoDelVigia, causaDelAtasco, checksObligatoriosDeReglas, ultimaEjecucionPorCheck, GRACIA_MINUTOS,
} from '../vigia-atascados.mjs';

export const SALIDA_OK = 0;
export const SALIDA_AVISO = 1;
export const SALIDA_CIEGO = 2;

/** Un rojo más joven que esto todavía puede ser de alguien que lo está mirando. */
export const HORAS_DE_ROJO = 2;
/** 6× la mediana medida (1,6 min sobre 100 despliegues, 29-sep → 1-oct-2026). */
export const MINUTOS_DE_DESPLIEGUE = 10;
/** Cuántos commits de main se recorren buscando el último verde antes de rendirse (y decirlo). */
export const COMMITS_DE_MAIN = 20;
/** Una sesión sin tocar su state.json en más de esto ya no es «de hoy». */
export const HORAS_DE_SESION = 24;

const REPO = 'lwislg99/cobroflash-backend';
const OBLIGATORIO_POR_DEFECTO = 'build + tests';

// ───────────────────────────── 1 · PR ─────────────────────────────

/** Nombres de test de la sección «✖ failing tests:» del log `spec`, sin duración. */
export function fallosDelLog(texto) {
  const lineas = String(texto || '').split('\n').map((l) => l.replace(/^\S+Z /, '').replace(/\x1b\[[0-9;]*m/g, '').trimEnd());
  const i = lineas.findIndex((l) => l.includes('✖ failing tests:'));
  if (i === -1) return null; // no llegó a su resumen: NO es «cero fallos»
  const vistos = new Set();
  for (const l of lineas.slice(i + 1)) {
    const m = l.match(/^✖ (.+?)(?: \([\d.]+ms\))?$/);
    if (m) vistos.add(m[1]);
  }
  return [...vistos];
}

/**
 * @param {{prs:object[], reglas:any, checksDe:(n:number)=>object[]|undefined, minutosDesdePush:(n:number)=>number|undefined, ahora?:number}} e
 */
export function seccionPRs({ prs, reglas, checksDe, minutosDesdePush }) {
  if (!Array.isArray(prs)) return ciega('PR', 'la lista de PR abiertos no llegó');
  const obligatorios = checksObligatoriosDeReglas(reglas);
  const filas = [];
  let borradores = 0;
  for (const p of prs) {
    if (p.isDraft) borradores++;
    const v = esAsuntoDelVigia({
      autor: p.author && p.author.login, draft: p.isDraft,
      etiquetas: (p.labels || []).map((l) => l.name), autoMerge: !!p.autoMergeRequest,
    });
    if (!v.vigilar) continue;
    const checkRuns = checksDe(p.number);
    const min = minutosDesdePush(p.number);
    const c = causaDelAtasco({
      estado: p.mergeStateStatus || 'UNKNOWN',
      checks: Array.isArray(checkRuns) ? checkRuns.length : 0,
      minutosDesdePush: min,
      sondaConflicto: p.mergeable === 'CONFLICTING' ? true : p.mergeable === 'MERGEABLE' ? false : null,
      checkRuns, obligatorios, autoMerge: !!p.autoMergeRequest,
    });
    filas.push({ numero: p.number, rama: p.headRefName, causa: c.causa, detalle: c.detalle, minutos: min });
  }
  const alertas = [];
  for (const f of filas) {
    const h = Number.isFinite(f.minutos) ? f.minutos / 60 : null;
    const edad = h === null ? 'edad del push DESCONOCIDA' : h >= 1 ? `${h.toFixed(1)} h desde su último push` : `${Math.round(f.minutos)} min desde su último push`;
    if (/^ROJO/.test(f.causa) && (h === null || h >= HORAS_DE_ROJO)) {
      alertas.push({ ...f, linea: `#${f.numero} ${f.rama} · ${f.causa} · ${edad}` });
    } else if (f.causa === 'SIN-CHECKS') {
      // `causaDelAtasco` ya absuelve al recién empujado (RECIEN-EMPUJADO, ${GRACIA_MINUTOS} min): si llega aquí, es mudo de verdad.
      alertas.push({ ...f, linea: `#${f.numero} ${f.rama} · punta SIN ningún check · ${edad}` });
    } else if (/^(DIRTY|CONFLICTO)/.test(f.causa)) {
      alertas.push({ ...f, linea: `#${f.numero} ${f.rama} · CONFLICTO con main · ${edad}` });
    }
  }
  return {
    nombre: 'PR', pudo: true, alertas, filas,
    poblacion: `${prs.length} PR abiertos (${borradores} en borrador, ${filas.length} vigilados) · obligatorios: ${obligatorios ? obligatorios.join(', ') : 'NO SE PUDO LEER la lista (un rojo sale ROJO-SIN-LISTA)'} · gracia ${GRACIA_MINUTOS} min`,
  };
}

// ───────────────────────────── 2 y 3 · SESIONES y TRASPASOS ─────────────────────────────

/** `s3-1oct`, `sesion-3`, `s4-1octb` → 3 · lo demás → null (no se inventa un puesto). */
export function puestoDe(nombre) {
  const m = String(nombre || '').match(/^(?:s|sesion-)(\d)(?:-|$)/);
  return m ? Number(m[1]) : null;
}

/** El bloqueo vive en TRES campos y basta uno: `state`, `tempo` o una pregunta en `needs`. */
export function espera(s) {
  return s.estado === 'blocked' || s.tempo === 'blocked' || !!s.needs;
}

/** La pregunta, tal cual está en el registro. Si no hay, se dice: no se rellena con el `detail`. */
export function preguntaDe(s) {
  const n = s.needs;
  return n ? (typeof n === 'string' ? n : JSON.stringify(n)).replace(/\s+/g, ' ').trim() : '';
}

/**
 * @param {{sesiones:{id:string,nombre:string,estado:string,tempo?:string,detalle?:string,needs?:any,actualizado:number,creado?:number,prs:number[]}[], filasPR:object[]|null, ilegibles?:object[], ahora:number}} e
 */
export function seccionSesiones({ sesiones, filasPR, ilegibles = [], ahora }) {
  if (!Array.isArray(sesiones)) return ciega('SESIONES', 'no se pudo leer la carpeta de trabajos');
  const hoy = sesiones.filter((s) => (ahora - s.actualizado) / 36e5 <= HORAS_DE_SESION);
  const porNumero = new Map((filasPR || []).map((f) => [f.numero, f]));
  const alertas = [];
  for (const s of hoy) {
    const min = Math.round((ahora - s.actualizado) / 60000);
    if (espera(s)) {
      // Quien lee «working» en el panel no mira más: si el bloqueo no está en `state`, se dice dónde está.
      const disfraz = s.estado === 'blocked' ? '' : ` · ⚠️ su state dice «${s.estado}»: el bloqueo está en ${s.tempo === 'blocked' ? 'tempo' : 'needs'}`;
      alertas.push({ sesion: s.nombre, linea: `${s.nombre} (${s.id}) BLOQUEADA hace ${min} min · espera: ${String(s.needs || s.detalle || 'no lo dice').slice(0, 200)}${disfraz}` });
    }
    if (s.estado !== 'working') {
      for (const n of s.prs) {
        const f = porNumero.get(n);
        // Un PR que ya no está abierto no aparece en `filasPR`: mergeado o cerrado, no es asunto de nadie.
        if (!f) continue;
        if (/^ROJO|SIN-CHECKS|CONFLICTO|DIRTY/.test(f.causa)) {
          alertas.push({ sesion: s.nombre, linea: `${s.nombre} (${s.id}) ya NO trabaja (${s.estado}) y su PR #${n} sigue ${f.causa}: nadie vuelve` });
        } else {
          // Abierto y sin rojo: todavía no hay veredicto. Cerrar así no es entregar (A10), y si luego sale rojo nadie lo verá.
          alertas.push({ sesion: s.nombre, linea: `${s.nombre} (${s.id}) ya NO trabaja (${s.estado}) y su PR #${n} sigue ABIERTO sin veredicto (${f.causa}): si sale rojo, nadie vuelve` });
        }
      }
    }
  }
  const cuenta = {};
  for (const s of hoy) cuenta[s.estado] = (cuenta[s.estado] || 0) + 1;
  return {
    nombre: 'SESIONES', pudo: true, alertas,
    poblacion: `${sesiones.length} trabajos con state.json · ${hoy.length} con actividad en ${HORAS_DE_SESION} h (${Object.entries(cuenta).map(([k, v]) => `${v} ${k}`).join(', ') || 'ninguno'}) · leído del REGISTRO, no del panel${filasPR ? '' : ' · ⚠️ sin la sección PR no se pudo cruzar con sus PR'}${ilegibles.length ? ` · ⚠️ ${ilegibles.length} state.json ILEGIBLES, que pueden ser de hoy (ver CEMENTERIO)` : ''}`,
  };
}

// ───────────────────────────── 6 · CEMENTERIO ─────────────────────────────

const edadDe = (ms) => (ms < 48 * 36e5 ? `${Math.round(ms / 36e5)} h` : `${(ms / (24 * 36e5)).toFixed(1)} días`);

/** Estados en los que una sesión ya no va a contestarse sola. `working`/`done` = siguió: alguien le contestó. */
const MUERTA = /^(stopped|failed)$/;

/**
 * EL LIBRO. El registro pierde la pregunta cuando alguien PARA la sesión (medido el 1-oct: 0 de 227
 * trabajos en done/failed/stopped conservan `needs`). Así que cada pasada copia aquí las preguntas que ve, y
 * una pregunta apuntada solo sale del libro si la sesión SIGUIÓ trabajando (se le contestó) o si
 * alguien la marca con `contestada`. Que la maten no la saca.
 * @param {Record<string,{nombre:string,needs:string,desde:number,contestada?:{cuando:number,donde:string}}>} libro
 */
export function actualizarLibro(libro, sesiones) {
  const nuevo = { ...libro };
  for (const s of sesiones) {
    const q = preguntaDe(s);
    if (espera(s) && q) {
      // Otra pregunta de la misma sesión es otra pregunta: la respuesta apuntada era de la anterior.
      if (!nuevo[s.id] || nuevo[s.id].needs !== q) nuevo[s.id] = { nombre: s.nombre, needs: q, desde: s.actualizado };
    } else if (nuevo[s.id] && !espera(s) && !MUERTA.test(s.estado)) {
      delete nuevo[s.id];
    }
  }
  return nuevo;
}

/**
 * @param {{sesiones:object[], ilegibles?:{id:string,motivo:string}[], sinEstado?:string[], libro:object|null|undefined, libroGuardado?:boolean, ahora:number}} e
 * `libro`: `undefined` si existe y no se pudo leer · `null` si todavía no existe (no es un fallo).
 */
export function seccionCementerio({ sesiones, ilegibles = [], sinEstado = [], libro, libroGuardado = true, ahora }) {
  if (!Array.isArray(sesiones)) return ciega('CEMENTERIO', 'no se pudo leer la carpeta de trabajos');
  const apuntado = libro || {};
  const alertas = [];
  let contestadas = 0; let deHoy = 0;
  const enRegistro = new Map(sesiones.map((s) => [s.id, s]));
  for (const s of sesiones) {
    if (!espera(s)) continue;
    if ((ahora - s.actualizado) / 36e5 <= HORAS_DE_SESION) { deHoy++; continue; }
    const q = preguntaDe(s);
    const a = apuntado[s.id];
    if (a && a.contestada && a.needs === q) { contestadas++; continue; }
    alertas.push({ sesion: s.nombre, desde: s.actualizado, linea: `${s.nombre} (${s.id}) · hace ${edadDe(ahora - s.actualizado)} · espera: ${q || 'NO LO DICE (bloqueada sin `needs`)'}` });
  }
  // Lo que el registro ya no enseña y el libro sí: la sesión fue parada (o borrada) con la pregunta dentro.
  for (const [id, a] of Object.entries(apuntado)) {
    const s = enRegistro.get(id);
    if (s && espera(s)) continue;
    if (a.contestada) { contestadas++; continue; }
    alertas.push({ sesion: a.nombre, desde: a.desde, linea: `${a.nombre} (${id}) · hace ${edadDe(ahora - a.desde)} · espera: ${a.needs} · ⚠️ ${s ? `el registro ya la da por «${s.estado}» y ha BORRADO la pregunta` : 'su carpeta ya no existe'}: sale del libro` });
  }
  alertas.sort((x, y) => x.desde - y.desde);
  const poblacion = `${sesiones.length} trabajos leídos · ${alertas.length} pregunta(s) sin contestar (de más de ${HORAS_DE_SESION} h, o de una sesión ya parada) · ${deHoy} de hoy (están en SESIONES) · ${contestadas} marcada(s) como contestadas${sinEstado.length ? ` · ${sinEstado.length} carpeta(s) de trabajo SIN state.json (${sinEstado.slice(0, 5).join(', ')}): lanzadas y sin registro` : ''}${libroGuardado ? '' : ' · ⚠️ NO pude guardar el libro: si paran una sesión bloqueada, su pregunta se pierde'}`;
  const ciegos = [];
  if (ilegibles.length) ciegos.push(`${ilegibles.length} state.json que NO se dejan leer (${ilegibles.slice(0, 5).map((i) => `${i.id}: ${i.motivo}`).join(' · ')})`);
  if (libro === undefined) ciegos.push('el libro de preguntas existe y no se deja leer (las contestadas y las de sesiones ya paradas NO están contadas)');
  if (ciegos.length) return { nombre: 'CEMENTERIO', pudo: false, motivo: `${ciegos.join(' · ')}. Debajo va SOLO lo que sí pude leer: ${poblacion}`, alertas, poblacion: null };
  return { nombre: 'CEMENTERIO', pudo: true, alertas, poblacion };
}

/**
 * @param {{sesiones:object[], mtimeDelTraspaso:(puesto:number)=>number|null|undefined, ahora:number}} e
 * `mtimeDelTraspaso` devuelve `undefined` si no pudo mirar, `null` si el fichero no existe.
 */
export function seccionTraspasos({ sesiones, mtimeDelTraspaso, ahora }) {
  if (!Array.isArray(sesiones)) return ciega('TRASPASO', 'no se pudo leer la carpeta de trabajos');
  const cerradas = sesiones.filter((s) => (ahora - s.actualizado) / 36e5 <= HORAS_DE_SESION && s.estado !== 'working' && s.estado !== 'blocked');
  const alertas = [];
  let sinPuesto = 0;
  for (const s of cerradas) {
    const puesto = puestoDe(s.nombre);
    if (puesto === null) { sinPuesto++; continue; }
    const m = mtimeDelTraspaso(puesto);
    if (m === undefined) return ciega('TRASPASO', `no se pudo mirar el traspaso del puesto ${puesto}`);
    if (m === null) alertas.push({ sesion: s.nombre, linea: `${s.nombre} cerró (${s.estado}) y project_s${puesto}_traspaso.md NO EXISTE` });
    // El fichero se REUTILIZA entre relevos: que exista no dice nada. Tiene que ser posterior al arranque de ESTA sesión.
    else if (Number.isFinite(s.creado) && m < s.creado) {
      alertas.push({ sesion: s.nombre, linea: `${s.nombre} cerró (${s.estado}) y su traspaso es ANTERIOR a su arranque (${new Date(m).toISOString().slice(0, 16)}Z < ${new Date(s.creado).toISOString().slice(0, 16)}Z): es el de la sesión anterior` });
    }
  }
  return {
    nombre: 'TRASPASO', pudo: true, alertas,
    poblacion: `${cerradas.length} sesiones que ya no trabajan en ${HORAS_DE_SESION} h${sinPuesto ? ` · ${sinPuesto} sin puesto reconocible en el nombre (NO medidas)` : ''}`,
  };
}

// ───────────────────────────── 4 · MAIN ─────────────────────────────

/** @param {{commits:{sha:string, checkRuns:object[]|undefined}[], obligatorio?:string}} e — commits de main, del más NUEVO al más viejo. */
export function seccionMain({ commits, obligatorio = OBLIGATORIO_POR_DEFECTO }) {
  if (!Array.isArray(commits) || commits.length === 0) return ciega('MAIN', 'no llegaron commits de main');
  let detras = 0;
  const alertas = [];
  for (const c of commits) {
    if (!Array.isArray(c.checkRuns)) return ciega('MAIN', `no se pudieron leer los checks de ${c.sha.slice(0, 8)}`);
    const run = c.checkRuns.filter((r) => String(r.name || '').startsWith(obligatorio))
      .sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')))[0];
    const veredicto = run && run.status === 'completed' ? run.conclusion : null;
    if (veredicto === 'success') {
      return {
        nombre: 'MAIN', pudo: true, alertas,
        poblacion: `${commits.length} commits de main recorridos · último con el obligatorio VERDE: ${c.sha.slice(0, 8)} · ${detras} commit(s) más nuevos sin veredicto`,
      };
    }
    if (veredicto === 'failure') {
      alertas.push({ linea: `main ${c.sha.slice(0, 8)} tiene el obligatorio en ROJO (${detras} commit(s) más nuevos sin veredicto)` });
      return { nombre: 'MAIN', pudo: true, alertas, poblacion: `${commits.length} commits de main recorridos` };
    }
    detras++;
  }
  alertas.push({ linea: `ninguno de los últimos ${commits.length} commits de main tiene veredicto del obligatorio` });
  return { nombre: 'MAIN', pudo: true, alertas, poblacion: `${commits.length} commits de main recorridos, NINGUNO con veredicto` };
}

// ───────────────────────────── 5 · DESPLIEGUE ─────────────────────────────

/** @param {{despliegues:{sha:string, creado:string, estados:string[]|undefined}[], ahora:number}} e — `estados` del más NUEVO al más viejo. */
export function seccionDespliegue({ despliegues, ahora }) {
  if (!Array.isArray(despliegues) || despliegues.length === 0) return ciega('DESPLIEGUE', 'la API no devolvió despliegues');
  const alertas = [];
  for (const d of despliegues) {
    if (!Array.isArray(d.estados)) return ciega('DESPLIEGUE', `no se pudieron leer los estados de ${d.sha.slice(0, 8)}`);
    const min = (ahora - Date.parse(d.creado)) / 60000;
    if (d.estados[0] === 'in_progress' && !d.estados.includes('success') && min > MINUTOS_DE_DESPLIEGUE) {
      alertas.push({ linea: `despliegue de ${d.sha.slice(0, 8)} lleva ${Math.round(min)} min en in_progress (umbral ${MINUTOS_DE_DESPLIEGUE}): ATASCADO, no en cola` });
    }
  }
  const u = despliegues[0];
  return {
    nombre: 'DESPLIEGUE', pudo: true, alertas,
    poblacion: `${despliegues.length} despliegues mirados · el último: ${u.sha.slice(0, 8)} → ${u.estados[0] || 'sin estado'} (lo que Railway le dice a GitHub, NO lo que sirve yaqu.app)`,
  };
}

// ───────────────────────────── el veredicto ─────────────────────────────

function ciega(nombre, motivo) { return { nombre, pudo: false, motivo, alertas: [], poblacion: null }; }

export function salidaDe(secciones) {
  if (secciones.some((s) => !s.pudo)) return SALIDA_CIEGO;
  if (secciones.some((s) => s.alertas.length > 0)) return SALIDA_AVISO;
  return SALIDA_OK;
}

export function informe(secciones, { ahora, fallosDe = () => undefined }) {
  const out = [`LATIDO · ${new Date(ahora).toISOString().slice(0, 16)}Z`];
  for (const s of secciones) {
    if (!s.pudo) { out.push('', `🔴 ${s.nombre} · NO PUDE MIRAR: ${s.motivo}`, '   Esto NO quiere decir que no haya nada.'); for (const a of s.alertas) out.push(`   · ${a.linea}`); continue; }
    out.push('', `${s.alertas.length ? '🔴' : '✅'} ${s.nombre} · ${s.poblacion}`);
    for (const a of s.alertas) {
      out.push(`   · ${a.linea}`);
      const f = a.numero ? fallosDe(a.numero) : undefined;
      if (Array.isArray(f)) for (const t of f.slice(0, 6)) out.push(`       ✖ ${t}`);
      else if (f === null) out.push('       (no supe leer qué cayó: el log no llegó a su resumen)');
    }
  }
  const c = salidaDe(secciones);
  out.push('', c === SALIDA_CIEGO ? '→ ALGUNA SECCIÓN NO PUDO MIRAR (salida 2)' : c === SALIDA_AVISO ? '→ HAY COSAS QUE ATENDER (salida 1)' : '→ nada que atender (salida 0)');
  return out.join('\n');
}

// ───────────────────────────── recogida (lo único que toca el mundo) ─────────────────────────────

function ghDe() {
  const cand = process.platform === 'win32' ? ['C:\\Program Files\\GitHub CLI\\gh.exe', 'gh'] : ['gh'];
  return cand.find((c) => c === 'gh' || fs.existsSync(c));
}
function gh(args) {
  const txt = execFileSync(ghDe(), args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
  return txt.replace(/^\uFEFF/, '');
}
const ghJson = (args) => JSON.parse(gh(args));
const intentar = (f) => { try { return f(); } catch { return undefined; } };

function dirDeTrabajos() { return path.join(os.homedir(), '.claude', 'jobs'); }

/**
 * El registro entero, y lo que NO se pudo leer de él aparte: un state.json ilegible no es una sesión
 * que no existe (SCRUM-1357; antes se saltaba con un `continue` y nadie lo sabía).
 * @returns {{sesiones:object[], ilegibles:{id:string,motivo:string}[], sinEstado:string[]}|undefined}
 */
export function leerTrabajos(dir = dirDeTrabajos()) {
  if (!fs.existsSync(dir)) return undefined;
  const out = []; const ilegibles = []; const sinEstado = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const id = e.name;
    const ruta = path.join(dir, id, 'state.json');
    if (!fs.existsSync(ruta)) { sinEstado.push(id); continue; }
    let s; try { s = JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '')); } catch (err) { ilegibles.push({ id, motivo: String(err.code || err.name || 'error') }); continue; }
    if (!s || typeof s !== 'object') { ilegibles.push({ id, motivo: 'no es un objeto' }); continue; }
    const flags = s.respawnFlags || [];
    const i = flags.indexOf('-n');
    out.push({
      id, nombre: s.name || (i >= 0 ? flags[i + 1] : id), estado: String(s.state || 'desconocido'), tempo: s.tempo, detalle: s.detail, needs: s.needs,
      actualizado: Date.parse(s.updatedAt) || fs.statSync(ruta).mtimeMs, creado: Date.parse(s.createdAt) || undefined,
      prs: (s.children || []).filter((c) => c && c.kind === 'pr').map((c) => Number(c.id)).filter(Number.isFinite),
      transcript: s.linkScanPath,
    });
  }
  return { sesiones: out, ilegibles, sinEstado };
}

export function leerSesiones(dir = dirDeTrabajos()) {
  const t = leerTrabajos(dir);
  return t && t.sesiones;
}

function rutaDelLibro() {
  const base = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'yaqu-equipo') : path.join(os.homedir(), '.yaqu-equipo');
  return path.join(base, 'cementerio.json');
}
/** `null` = todavía no existe · `undefined` = existe y no se deja leer. */
export function leerLibro(ruta = rutaDelLibro()) {
  if (!fs.existsSync(ruta)) return null;
  const l = intentar(() => JSON.parse(fs.readFileSync(ruta, 'utf8')));
  return l && typeof l === 'object' && !Array.isArray(l) ? l : undefined;
}
function guardarLibro(libro, ruta = rutaDelLibro()) {
  return intentar(() => { fs.mkdirSync(path.dirname(ruta), { recursive: true }); fs.writeFileSync(ruta, `${JSON.stringify(libro, null, 1)}\n`); return true; }) === true;
}

function contestada(id, donde) {
  if (!id || !donde) { console.log('uso: latido.mjs contestada <id del trabajo> <dónde está la respuesta: ticket, comentario, mensaje>'); return SALIDA_CIEGO; }
  const t = leerTrabajos();
  const libro = leerLibro();
  if (!t || libro === undefined) { console.log('🔴 NO PUDE MIRAR: el registro de trabajos o el libro no se dejan leer. No apunto nada.'); return SALIDA_CIEGO; }
  const nuevo = actualizarLibro(libro || {}, t.sesiones);
  const hallados = Object.keys(nuevo).filter((k) => k === id || nuevo[k].nombre === id);
  if (hallados.length !== 1) { console.log(`🔴 «${id}» casa con ${hallados.length} preguntas del libro: no apunto nada. Usa el id del trabajo (el de entre paréntesis).`); return SALIDA_AVISO; }
  nuevo[hallados[0]].contestada = { cuando: Date.now(), donde: String(donde) };
  if (!guardarLibro(nuevo)) { console.log('🔴 NO pude guardar el libro: la pregunta sigue contando como sin contestar.'); return SALIDA_CIEGO; }
  console.log(`✅ ${nuevo[hallados[0]].nombre} (${hallados[0]}): «${nuevo[hallados[0]].needs.slice(0, 120)}» → contestada en ${donde}`);
  return SALIDA_OK;
}

function dirDeTraspasos() {
  const cfg = path.join(process.env.LOCALAPPDATA || '', 'yaqu-equipo', 'config.json');
  const c = intentar(() => JSON.parse(fs.readFileSync(cfg, 'utf8')));
  return c && typeof c.traspasos === 'string' ? c.traspasos : undefined;
}

async function repartos({ horas = 12 } = {}) {
  const sesiones = leerSesiones();
  if (!sesiones) { console.log('🔴 NO PUDE MIRAR: no existe la carpeta de trabajos'); return SALIDA_CIEGO; }
  // El orquestador no es un trabajo de fondo: su transcript está con los demás, en la carpeta del proyecto.
  // La misma carpeta aparece escrita `D--…` y `d--…` según quién la abrió: se compara sin mayúsculas,
  // o el mismo transcript se lee dos veces (medido: 116 «mensajes» que eran 58).
  const clave = (r) => path.resolve(r).toLowerCase();
  const rutas = new Map(sesiones.filter((s) => s.transcript).map((s) => [clave(s.transcript), { ruta: s.transcript, nombre: s.nombre }]));
  for (const s of sesiones) {
    if (!s.transcript) continue;
    const d = path.dirname(s.transcript);
    for (const f of intentar(() => fs.readdirSync(d)) || []) {
      const r = path.join(d, f);
      if (f.endsWith('.jsonl') && !rutas.has(clave(r))) rutas.set(clave(r), { ruta: r, nombre: `(sin trabajo de fondo: ${f.slice(0, 8)})` });
    }
  }
  const corte = Date.now() - horas * 36e5;
  const filas = [];
  let leidos = 0;
  const vistos = new Set();
  for (const { ruta, nombre } of rutas.values()) {
    if (!fs.existsSync(ruta) || fs.statSync(ruta).mtimeMs < corte) continue;
    leidos++;
    const rl = readline.createInterface({ input: fs.createReadStream(ruta) });
    for await (const l of rl) {
      if (!l.includes('"SendMessage"')) continue;
      let o; try { o = JSON.parse(l); } catch { continue; }
      if (Date.parse(o.timestamp) < corte) continue;
      for (const c of (o.message?.content || [])) {
        // Un mismo `tool_use` puede estar escrito más de una vez en el transcript: se cuenta por su id.
        if (c.type !== 'tool_use' || c.name !== 'SendMessage' || vistos.has(c.id)) continue;
        vistos.add(c.id);
        filas.push({ t: o.timestamp, de: nombre, a: c.input?.to, que: String(c.input?.message || '').split('\n')[0].slice(0, 140) });
      }
    }
  }
  filas.sort((a, b) => a.t.localeCompare(b.t));
  console.log(`REPARTOS · ${leidos} transcripts leídos de ${rutas.size} conocidos · ${filas.length} mensajes en ${horas} h`);
  console.log('   (se ve lo que se MANDÓ; si el otro lo leyó no queda en ningún sitio: solo su respuesta, si la hay)');
  for (const f of filas) console.log(`${f.t.slice(11, 16)}Z  ${f.de} → ${f.a}  ·  ${f.que}`);
  if (leidos === 0) { console.log('🔴 NO PUDE MIRAR: ningún transcript reciente'); return SALIDA_CIEGO; }
  return SALIDA_OK;
}

function cierre() {
  const rama = intentar(() => execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim());
  const local = intentar(() => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
  if (!rama || !local) { console.log('🔴 NO PUDE MIRAR: no sé en qué rama estoy'); return SALIDA_CIEGO; }
  const remoto = intentar(() => execFileSync('git', ['ls-remote', '--exit-code', 'origin', `refs/heads/${rama}`], { encoding: 'utf8' }).split(/\s/)[0]);
  if (!remoto) { console.log(`🔴 ${rama} NO está empujada: no hay nada que el CI pueda haber mirado`); return SALIDA_AVISO; }
  if (remoto !== local) { console.log(`🔴 ${rama}: tu HEAD (${local.slice(0, 8)}) NO es lo empujado (${remoto.slice(0, 8)}). El veredicto de abajo sería de otro commit: empuja o dilo.`); return SALIDA_AVISO; }
  const runs = intentar(() => ghJson(['api', `repos/${REPO}/commits/${remoto}/check-runs?per_page=100`]).check_runs);
  if (!Array.isArray(runs)) { console.log('🔴 NO PUDE MIRAR los checks (¿gh sin sesión?)'); return SALIDA_CIEGO; }
  const run = runs.filter((r) => String(r.name).startsWith(OBLIGATORIO_POR_DEFECTO)).sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0];
  if (!run) { console.log(`🔴 ${rama} ${remoto.slice(0, 8)}: el obligatorio NO ha arrancado (${runs.length} checks en total). No es verde: es «todavía no».`); return SALIDA_AVISO; }
  if (run.status !== 'completed') { console.log(`🟡 ${rama} ${remoto.slice(0, 8)}: obligatorio ${run.status} desde ${run.started_at}. No cierres diciendo «verde».`); return SALIDA_AVISO; }
  if (run.conclusion === 'success') { console.log(`✅ ${rama} ${remoto.slice(0, 8)}: obligatorio VERDE`); return SALIDA_OK; }
  console.log(`🔴 ${rama} ${remoto.slice(0, 8)}: obligatorio ${String(run.conclusion).toUpperCase()}`);
  const log = intentar(() => gh(['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${run.id}/logs`]));
  const f = log === undefined ? undefined : fallosDelLog(log);
  if (Array.isArray(f)) for (const t of f) console.log(`   ✖ ${t}`);
  else console.log('   (no supe leer qué cayó)');
  return SALIDA_AVISO;
}

function todo() {
  const ahora = Date.now();
  // 1 · PR
  const prs = intentar(() => ghJson(['pr', 'list', '--state', 'open', '--limit', '100', '--json',
    'number,title,author,isDraft,labels,autoMergeRequest,createdAt,headRefOid,headRefName,mergeStateStatus,mergeable']));
  const reglas = intentar(() => ghJson(['api', `repos/${REPO}/rules/branches/main`])) ?? null;
  const checks = new Map(); const minutos = new Map();
  for (const p of prs || []) {
    checks.set(p.number, intentar(() => ghJson(['api', `repos/${REPO}/commits/${p.headRefOid}/check-runs?per_page=100`]).check_runs));
    const fecha = intentar(() => gh(['api', `repos/${REPO}/commits/${p.headRefOid}`, '-q', '.commit.committer.date']).trim());
    const t = Date.parse(fecha);
    minutos.set(p.number, Number.isFinite(t) ? (ahora - t) / 60000 : undefined);
  }
  const sPR = seccionPRs({ prs, reglas, checksDe: (n) => checks.get(n), minutosDesdePush: (n) => minutos.get(n) });
  // 2 y 3 · sesiones y traspasos
  const trabajos = leerTrabajos();
  const sesiones = trabajos && trabajos.sesiones;
  const sSes = seccionSesiones({ sesiones, filasPR: sPR.pudo ? sPR.filas : null, ilegibles: trabajos ? trabajos.ilegibles : [], ahora });
  const dT = dirDeTraspasos();
  const sTra = dT === undefined ? ciega('TRASPASO', 'no encuentro la carpeta de traspasos en la instalación del equipo')
    : seccionTraspasos({ sesiones, ahora, mtimeDelTraspaso: (n) => { const r = path.join(dT, `project_s${n}_traspaso.md`); return fs.existsSync(r) ? fs.statSync(r).mtimeMs : null; } });
  // 4 · main
  const shas = intentar(() => ghJson(['api', `repos/${REPO}/commits?sha=main&per_page=${COMMITS_DE_MAIN}`]).map((c) => c.sha));
  const commits = [];
  for (const sha of shas || []) {
    const checkRuns = intentar(() => ghJson(['api', `repos/${REPO}/commits/${sha}/check-runs?per_page=100`]).check_runs);
    commits.push({ sha, checkRuns });
    if (Array.isArray(checkRuns) && checkRuns.some((r) => String(r.name).startsWith(OBLIGATORIO_POR_DEFECTO) && r.status === 'completed' && /^(success|failure)$/.test(r.conclusion))) break;
  }
  const sMain = seccionMain({ commits });
  // 5 · despliegue
  const ds = intentar(() => ghJson(['api', `repos/${REPO}/deployments?per_page=5`]));
  const despliegues = (ds || []).map((d) => ({ sha: d.sha, creado: d.created_at, estados: intentar(() => ghJson(['api', `repos/${REPO}/deployments/${d.id}/statuses?per_page=30`]).map((s) => s.state)) }));
  const sDep = seccionDespliegue({ despliegues, ahora });

  // Lo que cayó, solo de los PR en rojo (un log pesa ~1,5 MB: no se baja el de los verdes).
  const fallos = new Map();
  for (const a of sPR.alertas) {
    if (!/^ROJO/.test(a.causa)) continue;
    const rojo = ultimaEjecucionPorCheck(checks.get(a.numero) || []).find((r) => String(r.name).startsWith(OBLIGATORIO_POR_DEFECTO) && r.conclusion === 'failure');
    const id = rojo && rojo.id;
    const log = id ? intentar(() => gh(['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${id}/logs`])) : undefined;
    if (log !== undefined) fallos.set(a.numero, fallosDelLog(log));
  }
  // 6 · cementerio. El libro se actualiza ANTES de informar: lo que se ve hoy tiene que sobrevivir a que la paren mañana.
  let libro = leerLibro();
  let libroGuardado = true;
  if (sesiones && libro !== undefined) { libro = actualizarLibro(libro || {}, sesiones); libroGuardado = guardarLibro(libro); }
  const sCem = seccionCementerio({ sesiones, ilegibles: trabajos ? trabajos.ilegibles : [], sinEstado: trabajos ? trabajos.sinEstado : [], libro, libroGuardado, ahora });
  const secciones = [sPR, sSes, sTra, sMain, sDep, sCem];
  console.log(informe(secciones, { ahora, fallosDe: (n) => fallos.get(n) }));
  return salidaDe(secciones);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const orden = process.argv[2];
  process.exitCode = orden === 'repartos' ? await repartos() : orden === 'cierre' ? cierre()
    : orden === 'contestada' ? contestada(process.argv[3], process.argv.slice(4).join(' ')) : todo();
}
