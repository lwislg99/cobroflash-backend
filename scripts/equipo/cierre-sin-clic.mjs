#!/usr/bin/env node
// SCRUM-1463b · CIERRES SIN CLIC — tickets con el comentario de cierre ESCRITO y el estado SIN MOVER.
//
//   node scripts/equipo/cierre-sin-clic.mjs consultas                       (las dos búsquedas, para pegar)
//   node scripts/equipo/cierre-sin-clic.mjs --jira <foto.json|ficha.json|tsv …> [--control <f.json>]
//   node scripts/equipo/cierre-sin-clic.mjs ultima                          (lo guardado, como lo lee el latido)
//
// POR QUÉ EXISTE. El 13-oct-2026 el orquestador escribió DOS comentarios de cierre sin mover el estado
// (SCRUM-1443 y SCRUM-1528) y lo cazó el fundador preguntando. Cerrar son dos gestos, comentar y
// transicionar, y el segundo dependía de acordarse. Buscando con UNA frase salió un tercero: SCRUM-1126,
// trece días «En curso» con su comentario de cierre puesto y su trabajo en `main`.
//
// LO QUE SE MIDIÓ ANTES DE ESCRIBIRLO, y por eso no busca por una frase:
//   · La frase del encargo, «CERRADO por el orquestador», abre 2 de los 14 comentarios de cierre leídos
//     ese día, y NO abre ninguno de los dos que lo motivaron (los dos empiezan por «CIERRE ·»).
//   · La búsqueda de Jira no distingue mayúsculas: esa frase casó con SCRUM-1538 por «#2286 … cerrado por
//     el orquestador durante el barrido», que habla de un PR. No es un cierre: es una cita.
//   · Así que la búsqueda es sólo la RED (cuatro fórmulas, 13 de 14) y quien decide es el COMENTARIO: es
//     de cierre el que EMPIEZA por CIERRE o CERRADO en mayúsculas (`esDeCierre`). Una entrega de sesión
//     empieza por «CERRABLE» y no casa. Sin los comentarios delante la fila dice SIN LEER, no «limpio».
//
// ES UNA CAPA. «¿Su trabajo está en main?» lo contesta `mirar` (`ya-esta.mjs`, SCRUM-1424), que se LLAMA.
// Eso es lo que separa «olvidé el clic» (todo dentro, ninguna rama viva) de «se cerró antes de tiempo»
// (una rama suya sigue fuera). «En main» NO es «terminado»: lo dice cada fila.
//
// NO TIENE CREDENCIALES DE JIRA, como el latido: lee la foto que le pasa quien lo corre. Vale el JSON de
// `searchJiraIssuesUsingJql` (la búsqueda) y el de `getJiraIssue` (la ficha de uno, con sus comentarios),
// mezclados; o un TSV escrito a mano por quien ya leyó el ticket:
//     clave <TAB> estado <TAB> id del comentario de cierre <TAB> fecha ISO <TAB> su primera línea
// (con `-` en el id si se leyeron los comentarios y ninguno cierra). La foto caduca a las 12 h.
//
// ⛔ NO CIERRA NADA, no transiciona, no escribe en Jira. Lista y calla: cerrar es del orquestador (A13).
// Lo único que escribe es su último resultado, fuera del árbol, para que el latido lo enseñe.
//
// LO QUE NO VE, y lo dice en cada pasada: un cierre escrito con otra fórmula (1 de los 14 medidos: el de
// SCRUM-1443, «CIERRE · … COMPLETO y VISTO EN PRODUCCIÓN», sin «Lo cierro yo») no entra en la RED; y un
// ticket cerrado sin comentario de cierre (3 de 16 ese día) no deja nada que buscar.
//
// Salidas: 0 nada que atender · 1 hay cierres sin clic o tickets sin leer · 2 CIEGO (no pude mirar).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SALIDA_NADA = 0;
export const SALIDA_HAY = 1;
export const SALIDA_CIEGO = 2;
/** Lo que vale una foto de Jira. El mismo tope que `abierto-con-trabajo-en-main.mjs`. */
export const HORAS_DE_FOTO = 12;

// ═══ 1 · LO PURO ═════════════════════════════════════════════════════════════════════════════

/** Las fórmulas de la RED. Lista cerrada y visible: se amplía aquí, con el caso medido al lado. */
export const FORMULAS = [
  // «CIERRE · 13-oct-2026, 12:10Z. Lo cierro yo, el orquestador (A13.4)»: 9 de 14. Entera: «Lo cierro yo» a
  // secas traía cinco entregas de sesión que dicen justo lo contrario, «No lo cierro yo (A13)».
  'Lo cierro yo, el orquestador',
  'CERRADO por el orquestador', // 2 de 14
  'Cierre del orquestador', // SCRUM-1126, 29-sep-2026: «CERRADO — la rama está en main … Cierre del orquestador (A13)»
  'CERRADO con la rama en main', // SCRUM-1357, 1-oct-2026
];

const clausulas = () => FORMULAS.map((f) => `comment ~ "\\"${f}\\""`).join(' OR ');
/** Las dos búsquedas. La de control no se salta: es lo único que distingue «no hay ninguno» de «no vi nada». */
export function consultas() {
  return {
    abiertos: `project = SCRUM AND statusCategory != Done AND (${clausulas()}) ORDER BY key ASC`,
    control: `project = SCRUM AND statusCategory = Done AND (${clausulas()})`,
  };
}

/** La primera línea con algo, sin el marcado de delante (`**`, `#`, emojis, `h3.` de la wiki de Jira). */
export function arranqueDe(cuerpo) {
  const linea = String(cuerpo ?? '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
  return linea.replace(/^[^\p{L}]*(?:h[1-6]\.[^\p{L}]*)?/u, '');
}

/** ¿El comentario DECLARA el cierre? Por cómo empieza, y en mayúsculas: «CERRABLE» y «cerrado por…» no casan. */
export function esDeCierre(cuerpo) {
  return /^(?:CIERRE|CERRAD[OA])(?![\p{L}\p{N}])/u.test(arranqueDe(cuerpo));
}

/**
 * El ÚLTIMO comentario de cierre de un ticket, y cuántos se escribieron después (un ticket que siguió
 * hablando tras su cierre puede haberse reabierto: SCRUM-1288 se cerró, se reabrió y se volvió a cerrar).
 * @param {{id:string, created:string, body:string, author?:{displayName?:string}}[]} comentarios
 * @returns {{id:string, fecha:string, linea:string, autor:string|null, despues:number}|null}
 */
export function comentarioDeCierre(comentarios) {
  const orden = [...(comentarios || [])].sort((a, b) => Date.parse(a.created) - Date.parse(b.created));
  let ultimo = -1;
  orden.forEach((c, i) => { if (esDeCierre(c.body)) ultimo = i; });
  if (ultimo < 0) return null;
  const c = orden[ultimo];
  return { id: String(c.id), fecha: c.created, linea: arranqueDe(c.body).slice(0, 110), autor: c.author?.displayName ?? null, despues: orden.length - 1 - ultimo };
}

/**
 * Las fotos, mezcladas. Devuelve los ABIERTOS con lo que se sabe de sus comentarios:
 *   cierre: objeto   → se leyeron y uno cierra        cierre: null → se leyeron y ninguno cierra (una cita)
 *   cierre: undefined → NO se leyeron: no se sabe
 * `cerrados` son los que la foto trae ya en Done: no salen nunca en el informe, lleven lo que lleven.
 */
export function leerFotos(textos) {
  const abiertos = new Map(); const cerrados = new Set(); const problemas = [];
  let busquedaEntera = null;
  const apuntar = (num, dato) => { const a = abiertos.get(num) || { estado: '?', asunto: '', actualizado: null, cierre: undefined }; abiertos.set(num, { ...a, ...dato }); };
  for (const { nombre, texto } of textos) {
    const t = String(texto).trimStart();
    if (t.startsWith('{')) {
      let j;
      try { j = JSON.parse(t); } catch { problemas.push(`${nombre}: no es JSON válido`); continue; }
      const nodos = j?.issues?.nodes;
      if (!Array.isArray(nodos)) { problemas.push(`${nombre}: no trae issues.nodes`); continue; }
      for (const n of nodos) {
        const m = String(n.key || '').match(/^SCRUM-(\d+)$/);
        if (!m) continue;
        const num = Number(m[1]); const f = n.fields || {};
        if (f.status?.statusCategory?.key === 'done') { cerrados.add(num); abiertos.delete(num); continue; }
        if (cerrados.has(num)) continue;
        const dato = {};
        if (f.status?.name) dato.estado = f.status.name;
        if (f.summary) dato.asunto = f.summary;
        if (f.updated) dato.actualizado = f.updated;
        const com = f.comment?.comments;
        if (Array.isArray(com)) {
          // Una ficha que no trae TODOS sus comentarios no ha leído el ticket: se queda en «sin leer».
          const total = f.comment.total;
          if (Number.isFinite(total) && total > com.length) problemas.push(`${nombre}: SCRUM-${num} trae ${com.length} comentarios de ${total}`);
          else dato.cierre = comentarioDeCierre(com);
        }
        apuntar(num, dato);
      }
      // Sólo una BÚSQUEDA pagina. Una ficha (`getJiraIssue`) no trae `pageInfo` y no dice nada de la población.
      const p = j.issues.pageInfo;
      if (p) { if (p.hasNextPage === false) busquedaEntera = true; else if (busquedaEntera !== true) busquedaEntera = false; }
    } else {
      for (const l of String(texto).split(/\r?\n/)) {
        if (!l.trim() || l.startsWith('#')) continue;
        const [k, estado = '', id = '', fecha = '', linea = ''] = l.split('\t');
        const m = String(k).trim().match(/^SCRUM-(\d+)$/);
        if (!m) { problemas.push(`${nombre}: línea que no empieza por una clave: «${l.slice(0, 40)}»`); continue; }
        const num = Number(m[1]);
        if (/finalizad|done|hecho|listo/i.test(estado)) { cerrados.add(num); abiertos.delete(num); continue; }
        const dato = { estado: estado.trim() || '?' };
        if (id.trim() === '-') dato.cierre = null;
        else if (id.trim()) {
          if (Number.isNaN(Date.parse(fecha))) { problemas.push(`${nombre}: SCRUM-${num} lleva comentario ${id.trim()} sin una fecha que se entienda`); continue; }
          dato.cierre = { id: id.trim(), fecha: fecha.trim(), linea: linea.trim().slice(0, 110), autor: null, despues: null, aMano: true };
        }
        apuntar(num, dato);
      }
      busquedaEntera = busquedaEntera ?? true; // un TSV no pagina: quien lo escribe responde de que está entero
    }
  }
  if (busquedaEntera === false) problemas.push('ninguna página de la búsqueda dice hasNextPage:false — faltan páginas');
  if (busquedaEntera === null) problemas.push('no hay ninguna BÚSQUEDA entre las fotos (sólo fichas sueltas): no se sabe qué población se miró');
  return { abiertos, cerrados, problemas };
}

/** ¿El control VE algo hoy? Vale la cuenta (`totalCount`) o los tickets en Done que traiga. */
export function controlVe(texto) {
  let j;
  try { j = JSON.parse(String(texto)); } catch { return { ve: false, motivo: 'no es JSON válido' }; }
  const total = Number(j?.issues?.totalCount);
  const hechos = (j?.issues?.nodes || []).filter((n) => n.fields?.status?.statusCategory?.key === 'done').length;
  const n = Number.isFinite(total) ? total : hechos;
  return n > 0 ? { ve: true, cuantos: n } : { ve: false, motivo: 'no trae ni un ticket cerrado con esas fórmulas' };
}

const DIA = 86400000;
export const TRABAJO = {
  EN_MAIN: 'su trabajo ESTÁ en main y no hay rama suya fuera → LE FALTA EL CLIC',
  EN_MAIN_Y_RAMA: 'tiene trabajo en main Y una rama suya VIVA fuera → se cerró antes de tiempo, o siguió después',
  SOLO_RAMA: 'su trabajo NO está en main: sólo una rama viva → SE CERRÓ ANTES DE TIEMPO',
  SIN_RASTRO: 'nada con su número en main ni en ramas → LÉELO (puede estar hecho bajo otro número)',
  CIEGO: 'NO PUDE MIRAR su trabajo',
};

/**
 * La fila de UN ticket abierto. Pura: `h` es lo que devuelve `mirar` de `ya-esta.mjs`.
 * `tipo`: CIERRE (lleva comentario de cierre) · CITA (leído, ninguno cierra) · SIN_LEER.
 */
export function filaDe(num, info, h, ahora) {
  const tipo = info.cierre ? 'CIERRE' : info.cierre === null ? 'CITA' : 'SIN_LEER';
  const desde = info.cierre ? Date.parse(info.cierre.fecha) : Date.parse(info.actualizado ?? '');
  const dias = Number.isFinite(desde) ? Math.floor((ahora - desde) / DIA) : null;
  let trabajo = 'CIEGO'; let detalle = '';
  if (h && h.ciegos.length === 0) {
    const dentro = h.registros.length + h.evidencias.length + h.commits.length + h.ramasEnMain.length;
    const vivas = h.ramasVivas || [];
    trabajo = dentro > 0 ? (vivas.length ? 'EN_MAIN_Y_RAMA' : 'EN_MAIN') : (vivas.length ? 'SOLO_RAMA' : 'SIN_RASTRO');
    const partes = [];
    if (h.commits.length) partes.push(`${h.commits.length} commit(s) suyos en main, el último del ${h.commits.map((c) => String(c.fecha).slice(0, 10)).sort().pop()}`);
    for (const r of vivas) partes.push(`rama viva ${r.nombre} (${r.adelanto} commit(s) fuera)`);
    // Trabajo en main FECHADO después del comentario de cierre: el ticket siguió vivo tras «cerrarse».
    if (info.cierre) {
      const dia = new Date(Date.parse(info.cierre.fecha)).toISOString().slice(0, 10);
      const tras = h.commits.filter((c) => String(c.fecha).slice(0, 10) > dia).length;
      if (tras) partes.push(`🔴 ${tras} de esos commits son POSTERIORES al comentario de cierre`);
    }
    detalle = partes.join(' · ');
  } else if (h) detalle = h.ciegos.join(' · ');
  return { num, tipo, estado: info.estado, asunto: info.asunto || '', dias, desdeCierre: Boolean(info.cierre), cierre: info.cierre ?? null, trabajo, detalle };
}

const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Pura. Una fila, en una línea: ticket, días parado y si su trabajo está en main. */
export function lineaDe(f) {
  const dias = f.dias === null ? 'días: no se sabe' : f.desdeCierre ? `${pl(f.dias, 'día', 'días')} desde su comentario de cierre` : `${pl(f.dias, 'día', 'días')} sin tocarse en Jira`;
  if (f.tipo === 'SIN_LEER') return `SCRUM-${f.num} [${f.estado}] · SIN LEER SUS COMENTARIOS: casa con la búsqueda y no sé si es un cierre o una cita · ${dias} · pásame su ficha (getJiraIssue, fields comment)`;
  const c = f.cierre;
  return `SCRUM-${f.num} [${f.estado}] · ${dias} (c.${c.id}${c.aMano ? ', dictado a mano' : ''}: «${c.linea.slice(0, 70)}»)${c.despues ? ` · ${pl(c.despues, 'comentario', 'comentarios')} DESPUÉS` : ''} · ${TRABAJO[f.trabajo]}${f.detalle ? ` · ${f.detalle}` : ''}`;
}

/** Pura. El resultado entero → lo que se guarda y lo que se imprime. */
export function resumir({ filas, cerrados = 0, control = null, tomada, main, ahora }) {
  const de = (t) => filas.filter((f) => f.tipo === t);
  return {
    medido: new Date(ahora).toISOString(), tomada: new Date(tomada).toISOString(), main: main ?? null,
    poblacion: { abiertos: filas.length, cierres: de('CIERRE').length, citas: de('CITA').length, sinLeer: de('SIN_LEER').length, cerradosEnLaFoto: cerrados, control: control?.ve ? control.cuantos : null },
    cierres: de('CIERRE').map((f) => ({ ...f, linea: lineaDe(f) })),
    sinLeer: de('SIN_LEER').map((f) => ({ num: f.num, linea: lineaDe(f) })),
    citas: de('CITA').map((f) => f.num),
  };
}

export const ORDEN = 'node scripts/equipo/cierre-sin-clic.mjs consultas   (da las dos búsquedas y la orden que las cruza)';
export const NO_CIERRA = '⛔ este guion NO cierra nada: cerrar es del orquestador (A13)';

/**
 * La sección del latido. Sólo lee lo guardado: el latido no tiene credenciales de Jira.
 * @param {{guardado: object|null|undefined, ahora:number}} e  `null` = nadie lo ha corrido en esta máquina · `undefined` = está y no se deja leer
 * @returns {{nombre:string, pudo:boolean, alertas:{linea:string}[], poblacion:string|null, motivo?:string}|null}  `null` = no hay sección: va como nota
 */
export function seccionCierres({ guardado, ahora }) {
  const nombre = 'CIERRES SIN CLIC';
  if (guardado === null) return null;
  const ciega = (motivo) => ({ nombre, pudo: false, motivo, alertas: [], poblacion: null });
  const tomada = guardado && Date.parse(guardado.tomada);
  if (!guardado || !Number.isFinite(tomada) || !Array.isArray(guardado.cierres) || !Array.isArray(guardado.sinLeer) || !guardado.poblacion) return ciega(`lo guardado por \`cierre-sin-clic.mjs\` no se deja leer. Vuelve a correrlo: ${ORDEN}`);
  const horas = (ahora - tomada) / 3.6e6;
  if (!(horas <= HORAS_DE_FOTO)) return ciega(`la última foto de Jira es de hace ${horas.toFixed(1)} h (vale ${HORAS_DE_FOTO}): lo que decía (${pl(guardado.cierres.length, 'cierre', 'cierres')} sin clic) ya no es una afirmación. Rehazla: ${ORDEN}`);
  const p = guardado.poblacion;
  return {
    nombre, pudo: true,
    alertas: [...guardado.cierres, ...guardado.sinLeer].map((f) => ({ linea: f.linea })),
    poblacion: `${pl(p.abiertos, 'ticket abierto casa', 'tickets abiertos casan')} con las fórmulas de cierre (foto de hace ${horas.toFixed(1)} h): ${p.cierres} con comentario de cierre, ${p.sinLeer} sin leer, ${p.citas} que sólo lo citan · ${NO_CIERRA}`,
  };
}

/** La nota del latido cuando en esta máquina no se ha corrido nunca: señala, no afirma, y no cuenta para la salida. */
export const NOTA_SIN_CORRER = `ℹ️ CIERRES SIN CLIC · nadie ha corrido \`cierre-sin-clic.mjs\` en esta máquina, así que el latido NO sabe si hay tickets con el comentario de cierre escrito y el estado sin mover. ${ORDEN} · desde la primera vez, una foto de más de ${HORAS_DE_FOTO} h deja esta sección en «no pude mirar»`;

// ═══ 2 · LO QUE TOCA EL MUNDO ════════════════════════════════════════════════════════════════

export function rutaDelGuardado() {
  const base = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'yaqu-equipo') : path.join(os.homedir(), '.yaqu-equipo');
  return path.join(base, 'cierre-sin-clic.json');
}
/** `null` = todavía no existe · `undefined` = existe y no se deja leer. */
export function leerGuardado(ruta = rutaDelGuardado()) {
  if (!fs.existsSync(ruta)) return null;
  try { const j = JSON.parse(fs.readFileSync(ruta, 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : undefined; } catch { return undefined; }
}
function guardar(resumen, ruta) {
  try { fs.mkdirSync(path.dirname(ruta), { recursive: true }); fs.writeFileSync(ruta, `${JSON.stringify(resumen, null, 1)}\n`); return true; } catch { return false; }
}

function pintar(r) {
  const p = r.poblacion; const out = [];
  out.push(`CIERRES SIN CLIC · medido ${r.medido.slice(0, 16)}Z · foto de Jira de ${r.tomada.slice(0, 16)}Z · main ${r.main ?? '?'}`);
  out.push(`POBLACIÓN · ${pl(p.abiertos, 'ticket abierto', 'tickets abiertos')} en la foto · ${p.cerradosEnLaFoto} ya en Done (no se listan) · control: ${p.control === null ? 'no hizo falta (la foto trae abiertos)' : `${p.control} cerrados con las mismas fórmulas`}`);
  out.push('', `${p.cierres ? '🔴' : '✅'} CON COMENTARIO DE CIERRE Y SIN CERRAR · ${p.cierres}`);
  for (const f of r.cierres) out.push(`   · ${f.linea}`);
  if (p.sinLeer) { out.push('', `🔴 SIN LEER · ${p.sinLeer} — «no los he leído» no es «no son cierres»`); for (const f of r.sinLeer) out.push(`   · ${f.linea}`); }
  if (p.citas) out.push('', `·  SÓLO LO CITAN (leídos, ningún comentario empieza por CIERRE o CERRADO) · ${p.citas}: ${r.citas.map((n) => `SCRUM-${n}`).join(', ')}`);
  out.push('', `«En main» NO es «terminado»: un ticket con partes puede tener sólo la primera. ${NO_CIERRA}.`);
  out.push(`NO VE: un cierre escrito con otra fórmula que las ${FORMULAS.length} de la búsqueda, ni un ticket cerrado sin comentario de cierre.`);
  return out.join('\n');
}

async function principal(argv) {
  if (argv[0] === 'consultas') {
    const c = consultas();
    console.log(['1 · LOS ABIERTOS (searchJiraIssuesUsingJql, TODAS las páginas, fields: summary, status, updated, comment):', `    ${c.abiertos}`,
      '2 · EL CONTROL (la misma con los cerrados; searchResultMode: count):', `    ${c.control}`,
      '3 · Guarda las respuestas en ficheros FUERA del árbol y corre:', '    node scripts/equipo/cierre-sin-clic.mjs --jira <abiertos.json …> --control <control.json>',
      '   Si la búsqueda no trae los comentarios de alguno, sale SIN LEER: añade su ficha (getJiraIssue, fields: status, updated, comment)',
      '   o escríbelo en un TSV: clave<TAB>estado<TAB>id del comentario de cierre (o -)<TAB>fecha ISO<TAB>su primera línea', NO_CIERRA].join('\n'));
    return SALIDA_NADA;
  }
  if (argv[0] === 'ultima') {
    const s = seccionCierres({ guardado: leerGuardado(), ahora: Date.now() });
    if (s === null) { console.log(NOTA_SIN_CORRER); return SALIDA_CIEGO; }
    console.log(s.pudo ? `${s.alertas.length ? '🔴' : '✅'} ${s.nombre} · ${s.poblacion}\n${s.alertas.map((a) => `   · ${a.linea}`).join('\n')}` : `🔴 ${s.nombre} · NO PUDE MIRAR: ${s.motivo}`);
    return !s.pudo ? SALIDA_CIEGO : s.alertas.length ? SALIDA_HAY : SALIDA_NADA;
  }
  const lista = (n) => { const i = argv.indexOf(n); const out = []; if (i >= 0) for (let k = i + 1; k < argv.length && !argv[k].startsWith('--'); k++) out.push(argv[k]); return out; };
  const valor = (n, d) => { const j = argv.indexOf(n); return j >= 0 ? argv[j + 1] : d; };
  const ficheros = lista('--jira');
  const ahora = Date.now();
  const ciego = [];
  if (!ficheros.length) { console.log('uso: cierre-sin-clic.mjs --jira <foto.json|ficha.json|tsv …> [--control <f.json>] [--tomada ISO] [--horas-max 12] [--raiz <árbol>] [--no-guardar]\n     cierre-sin-clic.mjs consultas | ultima'); return SALIDA_CIEGO; }
  const leer = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { ciego.push(`no pude leer ${f}: ${String(e.message).split('\n')[0]}`); return null; } };
  const textos = ficheros.map((f) => ({ nombre: path.basename(f), texto: leer(f) })).filter((t) => t.texto !== null);
  const horasMax = Number(valor('--horas-max', String(HORAS_DE_FOTO)));
  const tomadaArg = valor('--tomada', null);
  // La foto es tan vieja como su fichero MÁS VIEJO.
  const tomada = tomadaArg ? Date.parse(tomadaArg) : Math.min(...ficheros.filter((f) => fs.existsSync(f)).map((f) => fs.statSync(f).mtimeMs));
  const horas = (ahora - tomada) / 3.6e6;
  if (!Number.isFinite(horas)) ciego.push(`la fecha de la foto no se entiende: ${tomadaArg ?? '(sin ficheros legibles)'}`);
  else if (horas > horasMax) ciego.push(`la foto de Jira es de hace ${horas.toFixed(1)} h: pasa de ${horasMax} h y «abierto» ya no es una afirmación. Rehazla.`);
  const { abiertos, cerrados, problemas } = leerFotos(textos);
  ciego.push(...problemas);
  // El control: sin él, cero abiertos no distingue «no hay ninguno» de «la búsqueda no vio nada».
  const fControl = valor('--control', null);
  let control = null;
  if (fControl) { const t = leer(fControl); control = t === null ? { ve: false, motivo: 'no se pudo leer' } : controlVe(t); if (!control.ve) ciego.push(`el control (${path.basename(fControl)}) no ve nada: ${control.motivo}. Con el instrumento ciego, lo de abajo no vale`); }
  else if (abiertos.size === 0) ciego.push('la foto no trae ningún ticket abierto y no hay --control: no sé si no hay ninguno o si la búsqueda no vio nada');
  const raiz = path.resolve(valor('--raiz', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')));
  if (ciego.length) { console.log(`CIERRES SIN CLIC · ${abiertos.size} abiertos en la foto\n\n🔴 CIEGO — no se puede responder:\n${ciego.map((c) => `   · ${c}`).join('\n')}\n   Esto NO quiere decir que no haya ninguno.`); return SALIDA_CIEGO; }

  // El MOTOR de la casa, para «¿su trabajo está en main?». Se trae `origin` UNA vez.
  const { mirar, traerOrigen } = await import('./ya-esta.mjs');
  // Sólo si hay algo que preguntarle: una foto de citas no toca git ni la red.
  const sinTraer = [...abiertos.values()].some((i) => i.cierre !== null) ? traerOrigen(raiz) : null;
  const filas = []; let main = null;
  for (const num of [...abiertos.keys()].sort((a, b) => a - b)) {
    const info = abiertos.get(num);
    // Una cita no es un cierre: no se le pregunta nada a git.
    const r = info.cierre === null ? null : await mirar(num, { raiz, traer: false, ciegosPrevios: sinTraer ? [sinTraer] : [] });
    if (r && r.main) main = r.main;
    filas.push(filaDe(num, info, r ? r.h : null, ahora));
  }
  const resumen = resumir({ filas, cerrados: cerrados.size, control, tomada, main, ahora });
  console.log(pintar(resumen));
  const ciegas = filas.filter((f) => f.tipo === 'CIERRE' && f.trabajo === 'CIEGO');
  if (!argv.includes('--no-guardar')) {
    const ruta = valor('--guardar-en', rutaDelGuardado());
    console.log(guardar(resumen, ruta) ? `\nguardado para el latido: ${ruta}` : `\n🔴 NO SE PUDO GUARDAR en ${ruta}: el latido seguirá enseñando lo anterior`);
  }
  if (ciegas.length) { console.log(`\n🔴 de ${ciegas.length} no pude mirar el trabajo: arriba va por qué`); return SALIDA_CIEGO; }
  return resumen.poblacion.cierres + resumen.poblacion.sinLeer > 0 ? SALIDA_HAY : SALIDA_NADA;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reventon = (e) => { console.log(`🔴 NO HE PODIDO MIRAR: el comando reventó sin contestar: ${String((e && e.message) || e).split('\n')[0]}\n   Esto NO quiere decir que no haya ninguno.`); process.exit(SALIDA_CIEGO); };
  process.on('uncaughtException', reventon);
  principal(process.argv.slice(2)).then((c) => process.exit(c), reventon);
}
