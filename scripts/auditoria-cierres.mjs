#!/usr/bin/env node
// SCRUM-1372 · AUDITORÍA DE CIERRES — LA CRIBA (mitad 1 del diseño de SCRUM-1348)
//
//   node scripts/auditoria-cierres.mjs <cierres.json> --desde 2026-09-29 [--fecha 2026-10-01] [--paquetes <carpeta>]
//
// POR QUÉ EXISTE. El equipo comprueba al orquestador y nadie comprueba al equipo: lo que una sesión
// dice al cerrar no lo mira nadie de forma independiente. Único precedente, la auditoría a mano del
// 28-sep-2026: 4 de 8 cierres no cumplían. Fue una vez, no una rutina.
//
// QUÉ ES MECÁNICO Y QUÉ NO — y esto es lo primero que hay que saber de este script:
//
//   MECÁNICO (esto):  si un cierre se PUEDE comprobar y contra qué. Seis señales por cierre, la
//                     población, y a quién se lee. Marca CANDIDATOS, no culpables: un cierre sin
//                     ninguna marca NO está aprobado, solo no está marcado.
//   NO MECÁNICO:      si lo construido CUMPLE la frase de su aceptación. Eso es leer la aceptación y
//                     mirar el producto. Aquí solo se deja preparado el paquete de cada lectura.
//   LA COSTURA:       Jira no tiene credenciales fuera de una sesión. Los cierres los baja una sesión
//                     con el conector y los deja en el fichero de entrada; quien lo escribe decide qué
//                     es «la sección de aceptación» de cada ticket. Ese paso lo hace alguien que LEE.
//
// LAS SEÑALES (C3, «sin desplegar», NO está construida: se dice en cada pasada):
//   C1 · sin rastro       ni `docs/master/SCRUM-n*.md` ni commit en main que lo nombre
//   C2 · trabajo fuera    una rama `scrum-n-…` fuera de main CUYO CONTENIDO cambiaría main. Se compara
//                         contenido, no ancestría: una rama que al fusionarse no cambia nada es un
//                         ZOMBI, no un cierre con trabajo fuera (medido en SCRUM-1196)
//   C4 · cita rota        su registro cita un `tests/…test.mjs` que no existe en main
//   C5 · sin verificar    el ÚLTIMO comentario niega haberlo visto o verificado («sin verificar», «no se
//                         ha visto», «no se verificó», «NO visto»…). Es una búsqueda por palabras: si
//                         marca cero, la pasada lo dice, porque cero puede ser «lo dijo de otra forma»
//   C6 · sin aceptación   no hay contra qué auditar. No lo aprueba: lo cuenta aparte
//   A8 · la tabla         «aceptación → dónde se ve»: que exista (equipo de Luis, desde que la norma está
//                         viva), tantas filas como líneas, cada sitio existe, ninguna fila NO HECHO
//
// SALIDA: 0 = ningún cierre marcado · 1 = hay marcados · 2 = NO VALE (y gana al 1). Sale 2 si el
// fichero no es de la ventana o no cuadra, si algún cierre no se pudo cribar, si git no se deja leer,
// si el canario no salta, o si C5 marca más de un tercio (una señal que grita siempre no es una señal).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Cuántos cierres se leen por pasada COMO MUCHO. Los C1/C2 no cuentan: no se leen, ya están medidos. */
export const TOPE = 6;
/** Huecos del tope que son SIEMPRE del azar: si solo se lee a los marcados, se mide a la criba, no al equipo. */
export const RESERVA_AZAR = 3;
/** Por encima de esto, C5 no está señalando: está gritando. */
export const TECHO_C5 = 1 / 3;
/** Un fichero de cierres más viejo que esto ya no es «la ventana»: le faltan los cierres de después. */
export const HORAS_DE_FICHERO = 24;
/** Las etiquetas de Jira que dicen «este cierre no tiene trabajo dentro» (decisión del orquestador, 1-oct-2026). */
export const ETIQUETAS_SIN_TRABAJO = Object.freeze(['descartado', 'duplicado']);
/** Cuándo entró en main la norma de la tabla (A8, PR #2076). Antes de esto, no tenerla no es una falta. */
export const NORMA_A8_DESDE = '2026-10-01T12:27:10Z';

/**
 * EL CANARIO. Un cierre fabricado que se sabe malo por tres motivos a la vez. Pasa por la MISMA criba
 * que los de verdad, en cada pasada; si no sale marcado con los tres, la criba no ve y su resultado
 * no vale. Prueba la criba, no al lector: el canario del lector es un cierre real, y es de la mitad 2.
 */
export const CANARIO = Object.freeze({
  clave: 'SCRUM-0', resuelto: '2026-10-01T12:00:00.000+0200', etiquetas: ['area-s0', 'equipo-luis'],
  resumen: 'CANARIO de la criba: sin registro, sin aceptación y diciendo de sí mismo que no se miró',
  aceptacion: [], comentarios: 1, ultimoComentario: 'Hecho, 15/15 en verde. Queda pendiente verificar en yaqu.app.',
  ultimoComentarioCuando: '2026-10-01T12:00:00.000+0200', tablaA8: null,
});
export const ESPERADO_DEL_CANARIO = ['C1', 'C5', 'C6'];

export const numeroDe = (clave) => { const m = /^SCRUM-(\d+)$/.exec(String(clave || '')); return m ? Number(m[1]) : null; };

/** `area-s1` → S1 · `area-j4` → J4 · varias → la primera por orden · ninguna → `sin-area` (no se inventa). */
export function puestoDe(etiquetas) {
  const p = (etiquetas || []).map((e) => /^area-([sj]\d)$/i.exec(e)).filter(Boolean).map((m) => m[1].toUpperCase()).sort();
  return p[0] || 'sin-area';
}
export function esDeLuis(etiquetas) {
  return (etiquetas || []).some((e) => e === 'equipo-luis' || /^area-s\d$/i.test(e));
}

// LAS FORMAS, medidas dos veces y las dos mal antes de ésta:
//   · por palabra suelta («pendiente», «falta») marcaba 28 de 41: gritaba (piloto de SCRUM-1348);
//   · con solo las tres primeras de abajo marcaba 0 de 61 habiendo seis que lo decían con otras
//     palabras («no se ha visto», «NO visto», «no se verificó», «NO VERIFICABLE»): callaba (1-oct).
// Es una NEGACIÓN pegada a ver/verificar, en pasado o presente. «No se habría visto» no casa.
const FORMAS_C5 = new RegExp('(?<![\\p{L}\\p{N}_])('
  + 'sin verificar|quedan? pendientes? (?:de )?verificar|pendiente de verificar|falta verlo'
  + '|no se han? (?:podido )?(?:visto|ver|verificado|verificar)'
  + '|no (?:se )?verific(?:ó|ado|ada|able)'
  + '|no visto|no lo he (?:visto|verificado|mirado)'
  + ')(?![\\p{L}\\p{N}_])', 'iu');
// Un «no se vio» que dice POR QUÉ no es lo mismo que uno que no lo dice. El 1-oct cuatro verificaciones
// se quedaron a medias por el mismo hueco del entorno de pruebas (SCRUM-1367) y lo declararon bien: eso
// es un cierre honesto con un límite dicho, y una criba que lo acuse igual que al que calla castiga a
// quien hizo lo correcto. Se mira la frase y lo que la sigue.
const MOTIVO_C5 = /porque|ya que|fixture|cuenta (?:de )?QA|no existe ning|no (?:hay|tiene) (?:ning|un|una)\b|modo recibo|sin (?:sesi[oó]n|credenciales)|SCRUM-\d+/i;
const VENTANA_DEL_MOTIVO = 220;

/** @returns {{forma:string, conMotivo:boolean}|null} la forma que casó (para citarla) y si la acompaña un motivo. */
export function senalC5(texto) {
  const t = String(texto || '');
  const m = FORMAS_C5.exec(t);
  if (!m) return null;
  return { forma: m[1].toLowerCase(), conMotivo: MOTIVO_C5.test(t.slice(m.index, m.index + m[0].length + VENTANA_DEL_MOTIVO)) };
}

/** Los ficheros de test que cita un texto, entre comillas invertidas o sueltos. */
export function citasDeTest(texto) {
  return [...new Set([...String(texto || '').matchAll(/(?<![\w./-])(tests\/[\w./-]+\.test\.mjs)/g)].map((m) => m[1]))];
}
/** Rutas del repositorio entre comillas invertidas: lo que «dónde se ve» puede señalar y un script puede abrir. */
export function rutasDelRepo(texto) {
  return [...new Set([...String(texto || '').matchAll(/`((?:tests|scripts|src|public|docs|\.claude|\.github)\/[^`\s*<>…]+)`/g)]
    .map((m) => m[1].replace(/[.,;:)]+$/, '').replace(/:\d+(?:-\d+)?$/, '')))];
}

/**
 * La tabla «aceptación → dónde se ve» de un comentario de entrega.
 * @returns {{filas:{aceptacion:string, donde:string}[]}|null} `null` = no hay tabla, o no es esa tabla.
 */
export function leerTablaA8(md) {
  const lineas = String(md || '').split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
  const celdas = (l) => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const i = lineas.findIndex((l) => /aceptaci[oó]n/i.test(l) && /d[oó]nde se ve/i.test(l));
  if (i === -1) return null;
  const filas = [];
  for (const l of lineas.slice(i + 1)) {
    const c = celdas(l);
    if (c.every((x) => /^:?-{2,}:?$/.test(x))) continue; // la raya de la cabecera
    if (c.length < 2) continue;
    filas.push({ aceptacion: c[0], donde: c.slice(1).join(' | ') });
  }
  return { filas };
}

/**
 * @param {object} c — un cierre del fichero de entrada.
 * @param {{tieneRegistro:(n:number)=>boolean, commits:(n:number)=>object[], registros:(n:number)=>string[],
 *          ramasFuera:(n:number)=>{rama:string, cambia:boolean|null, detalle:string}[], existe:(ruta:string)=>boolean}} repo
 */
export function cribarUno(c, repo) {
  const n = numeroDe(c && c.clave);
  const falta = [];
  if (n === null) falta.push('clave');
  if (c && c.error) falta.push(`el que lo bajó dejó un error: ${c.error}`);
  if (!c || !Array.isArray(c.aceptacion)) falta.push('aceptacion');
  if (!c || typeof c.ultimoComentario !== 'string') falta.push('ultimoComentario');
  if (!c || !Array.isArray(c.etiquetas)) falta.push('etiquetas');
  if (!c || !Number.isFinite(Date.parse(c.resuelto))) falta.push('resuelto');
  if (falta.length) return { clave: (c && c.clave) || '(sin clave)', cribado: false, motivo: falta.join(' · ') };

  const senales = []; const notas = [];
  const commits = repo.commits(n);
  // Un cierre por descarte o por duplicado NO tiene trabajo que buscar, y Jira lo deja con el mismo
  // estado que un cierre vacío. Si lo dice su etiqueta, la criba no lo acusa cada día de lo que no es.
  const sinTrabajo = c.etiquetas.find((e) => ETIQUETAS_SIN_TRABAJO.includes(e)) || null;
  if (sinTrabajo) notas.push(`cierre sin trabajo, por su etiqueta «${sinTrabajo}»: no se le busca rastro ni tabla`);
  else if (!repo.tieneRegistro(n) && commits.length === 0) senales.push('C1');

  for (const r of repo.ramasFuera(n)) {
    if (r.cambia === false) notas.push(`rama zombi ${r.rama}: fuera de main, pero fusionarla no cambia nada`);
    else if (r.cambia === true) { senales.push('C2'); notas.push(`${r.rama}: ${r.detalle}`); }
    else return { clave: c.clave, cribado: false, motivo: `no pude comparar el contenido de ${r.rama} con main (${r.detalle})` };
  }

  const rotas = repo.registros(n).flatMap(citasDeTest).filter((t) => !repo.existe(t));
  if (rotas.length) { senales.push('C4'); notas.push(`cita ${[...new Set(rotas)].join(', ')}, que no existe en main`); }

  const c5 = senalC5(c.ultimoComentario);
  if (c5) {
    senales.push('C5');
    notas.push(`su último comentario dice «${c5.forma}»${c5.conMotivo ? ' y da el motivo: límite DECLARADO, no un cierre malo' : ', sin decir por qué'}`);
  }

  if (c.aceptacion.length === 0) senales.push('C6');

  // A8 · la tabla. Sin aceptación no hay filas que contar: eso ya lo dice C6.
  const tabla = c.tablaA8 ? leerTablaA8(c.tablaA8) : null;
  const obligado = !sinTrabajo && esDeLuis(c.etiquetas) && Date.parse(c.resuelto) >= Date.parse(NORMA_A8_DESDE) && c.aceptacion.length > 0;
  if (c.tablaA8 && !tabla) return { clave: c.clave, cribado: false, motivo: 'trae `tablaA8` y no sé leerla como tabla «aceptación → dónde se ve»' };
  if (!tabla && obligado) { senales.push('A8'); notas.push('sin tabla «aceptación → dónde se ve» (cerrado con la norma ya viva)'); }
  if (tabla) {
    const fallos = [];
    if (c.aceptacion.length > 0 && tabla.filas.length < c.aceptacion.length) fallos.push(`${tabla.filas.length} filas para ${c.aceptacion.length} líneas de aceptación`);
    const noHechas = tabla.filas.filter((f) => /\bNO HECHO\b/.test(f.donde));
    if (noHechas.length) fallos.push(`${noHechas.length} fila(s) NO HECHO: es un cierre por efecto, se parte (A18)`);
    const rotos = tabla.filas.flatMap((f) => rutasDelRepo(f.donde)).filter((r) => !repo.existe(r));
    if (rotos.length) fallos.push(`señala ${[...new Set(rotos)].join(', ')}, que no existe en main`);
    if (fallos.length) { senales.push('A8'); notas.push(...fallos); }
  }

  return {
    clave: c.clave, cribado: true, puesto: puestoDe(c.etiquetas), senales: [...new Set(senales)], notas,
    conAceptacion: c.aceptacion.length > 0, commits, c5ConMotivo: c5 ? c5.conMotivo : null, sinTrabajo,
  };
}

/** @returns {{ok:true}|{ok:false, motivo:string}} */
export function validarFichero(datos, { desde, ahora = Date.now() }) {
  if (!datos || typeof datos !== 'object' || !Array.isArray(datos.cierres)) return { ok: false, motivo: 'el fichero no trae una lista `cierres`' };
  if (datos.cierres.length === 0) return { ok: false, motivo: 'el fichero trae CERO cierres. Eso no es «nada que auditar»: es que no se bajó nada' };
  if (!datos.ventana || datos.ventana.desde !== desde) return { ok: false, motivo: `el fichero es de la ventana «${datos.ventana && datos.ventana.desde}» y se pidió «${desde}»` };
  if (datos.total !== datos.cierres.length) return { ok: false, motivo: `Jira dijo ${datos.total} cierres y el fichero trae ${datos.cierres.length}: faltan por bajar` };
  const claves = datos.cierres.map((c) => c && c.clave);
  const repetidas = claves.filter((k, i) => claves.indexOf(k) !== i);
  if (repetidas.length) return { ok: false, motivo: `claves repetidas: ${[...new Set(repetidas)].join(', ')}` };
  // `resuelto` viene con el huso de Jira (+02:00): sus diez primeros caracteres son el día LOCAL, el mismo que usa el JQL.
  const fuera = datos.cierres.filter((c) => c && typeof c.resuelto === 'string' && c.resuelto.slice(0, 10) < desde).map((c) => c.clave);
  if (fuera.length) return { ok: false, motivo: `${fuera.length} cierre(s) son de ANTES de la ventana (${fuera.slice(0, 5).join(', ')})` };
  const t = Date.parse(datos.bajado);
  if (!Number.isFinite(t)) return { ok: false, motivo: 'el fichero no dice cuándo se bajó (`bajado`)' };
  if ((ahora - t) / 36e5 > HORAS_DE_FICHERO) return { ok: false, motivo: `el fichero se bajó hace ${((ahora - t) / 36e5).toFixed(1)} h (tope ${HORAS_DE_FICHERO}): le faltan los cierres de después` };
  return { ok: true };
}

// ───────────────────────────── la muestra ─────────────────────────────

/** FNV-1a de la fecha → mulberry32. Misma fecha, misma muestra, en cualquier máquina. */
export function azarDe(fecha) {
  let h = 0x811c9dc5;
  for (const ch of String(fecha)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
  let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function barajar(lista, azar) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

/**
 * A quién se lee. GANA EL TOPE (decisión del orquestador, 1-oct-2026): «uno por puesto» y «tope 6» no
 * caben juntos con nueve puestos cerrando, y una muestra que no dice a quién no miró parece cubrir a todos.
 *   · los C1/C2 van TODOS y no gastan tope: son un hecho que la criba ya midió (no hay rastro, o hay una
 *     rama con contenido fuera), no una lectura. Se listan para que alguien los resuelva;
 *   · los C5 que NO dan su motivo se leen, como mucho TOPE − RESERVA_AZAR;
 *   · los C5 con el motivo dicho NO se leen: su límite ya está declarado, y confirmarlo rinde casi nada;
 *   · al AZAR, RESERVA_AZAR entre los no marcados con aceptación, uno por puesto. No rellena el tope
 *     cuando sobran huecos: la lectura cuesta agentes, y la cifra del equipo sale de estos, no de más;
 *   · y todo lo que se queda fuera se DEVUELVE con nombre, para que la pasada lo diga.
 */
export function elegirMuestra(cribados, { fecha }) {
  const orden = [...cribados].sort((a, b) => a.clave.localeCompare(b.clave, 'en', { numeric: true }));
  const es = (c, s) => c.senales.includes(s);
  const seguros = orden.filter((c) => es(c, 'C1') || es(c, 'C2'));
  const deC5 = orden.filter((c) => es(c, 'C5') && !seguros.includes(c));
  const callan = deC5.filter((c) => c.c5ConMotivo === false);
  const c5 = callan.slice(0, TOPE - RESERVA_AZAR);
  // «No marcados» = sin señal que acuse. C6 no acusa, pero sin aceptación no hay contra qué leer.
  const limpios = orden.filter((c) => c.conAceptacion && c.senales.length === 0 && !c.sinTrabajo);
  const azar = azarDe(fecha);
  const porPuesto = new Map();
  for (const c of limpios) { if (!porPuesto.has(c.puesto)) porPuesto.set(c.puesto, []); porPuesto.get(c.puesto).push(c); }
  const puestos = barajar([...porPuesto.keys()].sort(), azar);
  for (const p of puestos) porPuesto.set(p, barajar(porPuesto.get(p), azar));
  const alAzar = []; const sinLeer = [];
  for (const p of puestos) { if (alAzar.length < RESERVA_AZAR) alAzar.push(porPuesto.get(p)[0]); else sinLeer.push(p); }
  return {
    seguros, c5, azar: alAzar, limpios: limpios.length,
    fueraDeTope: callan.slice(TOPE - RESERVA_AZAR),
    conLimiteDeclarado: deC5.filter((c) => c.c5ConMotivo === true),
    puestosSinLeer: sinLeer.sort(),
  };
}

// ───────────────────────────── la pasada ─────────────────────────────

/** @returns {{codigo:0|1|2, lineas:string[], cribados?:object[], muestra?:object}} */
export function pasada({ datos, repo, desde, fecha, ahora = Date.now(), conCanario = true }) {
  const out = [`AUDITORÍA DE CIERRES · criba · ventana desde ${desde} · pasada del ${fecha}`];
  const no = (motivo) => { out.push('', `🔴 NO VALE (salida 2): ${motivo}`, '   Esto NO quiere decir que los cierres estén bien.'); return { codigo: 2, lineas: out }; };
  if (repo.incapaz) return no(`git no se deja leer: ${repo.incapaz}`);
  const v = validarFichero(datos, { desde, ahora });
  if (!v.ok) return no(v.motivo);
  if (!conCanario) return no('pasada sin canario. Sin un cierre que se sabe malo dentro, un «nada marcado» no distingue una criba limpia de una ciega');
  const can = cribarUno(CANARIO, repo);
  const faltan = ESPERADO_DEL_CANARIO.filter((s) => !can.cribado || !can.senales.includes(s));
  if (faltan.length) return no(`el canario NO saltó (${can.cribado ? `le faltan ${faltan.join(', ')}` : can.motivo}): la criba no ve`);

  const todos = datos.cierres.map((c) => cribarUno(c, repo));
  const ciegos = todos.filter((c) => !c.cribado);
  const cribados = todos.filter((c) => c.cribado);
  const cuenta = (s) => cribados.filter((c) => c.senales.includes(s)).length;
  const marcados = cribados.filter((c) => c.senales.some((s) => s !== 'C6'));
  out.push(
    '',
    `cierres en la ventana: ${datos.cierres.length} · cribados: ${cribados.length} · merges en main en la ventana: ${repo.mergesEnVentana ?? 'NO MEDIDO'}`,
    `marcados: ${marcados.length} (C1 ${cuenta('C1')} · C2 ${cuenta('C2')} · C4 ${cuenta('C4')} · C5 ${cuenta('C5')}, de ellos ${cribados.filter((c) => c.c5ConMotivo === true).length} con el motivo dicho · A8 ${cuenta('A8')}) · sin aceptación (C6): ${cuenta('C6')} · C3 (despliegue): NO CONSTRUIDA, no se mira`,
    `canario: saltó con ${ESPERADO_DEL_CANARIO.join(', ')}`,
  );
  if (ciegos.length) {
    for (const c of ciegos) out.push(`   · ${c.clave}: NO CRIBADO — ${c.motivo}`);
    return { ...no(`${ciegos.length} de ${datos.cierres.length} cierres no se pudieron cribar`), cribados };
  }
  if (cuenta('C5') === 0) out.push('⚠️ C5 no marcó ninguno. Es una búsqueda por palabras: cero es «nadie lo dijo» O «lo dijo de otra forma» (el 1-oct marcaba 0 de 61 habiendo seis).');
  if (cuenta('C5') / cribados.length > TECHO_C5) return { ...no(`C5 marca ${cuenta('C5')} de ${cribados.length}, más de un tercio: la señal está gritando, no señalando`), cribados };

  if (marcados.length) {
    out.push('', '| cierre | puesto | señales | lo que vio |', '|---|---|---|---|');
    for (const c of marcados.sort((a, b) => a.clave.localeCompare(b.clave, 'en', { numeric: true }))) {
      out.push(`| ${c.clave} | ${c.puesto} | ${c.senales.join(' ')} | ${c.notas.join(' · ') || '—'} |`);
    }
  }
  const sinAcept = cribados.filter((c) => c.senales.includes('C6'));
  if (sinAcept.length) out.push('', `sin aceptación escrita (${sinAcept.length}): no se pueden leer contra nada, y NO están aprobados → ${sinAcept.map((c) => c.clave.replace('SCRUM-', '')).join(', ')}`);
  const zombis = cribados.flatMap((c) => c.notas.filter((x) => x.startsWith('rama zombi')).map((x) => `${c.clave}: ${x}`));
  if (zombis.length) { out.push('', 'ramas por borrar (no acusan a nadie):'); for (const z of zombis) out.push(`   · ${z}`); }

  const m = elegirMuestra(cribados, { fecha });
  out.push(
    '',
    `A QUIÉN SE LEE (mitad 2, NO mecánica) · semilla ${fecha} · ${m.c5.length + m.azar.length} lecturas · tope ${TOPE} y GANA EL TOPE · ${RESERVA_AZAR} al azar`,
    `   dicen que no se vio y NO dan motivo (C5): ${m.c5.map((c) => c.clave).join(', ') || 'ninguno'}`,
    `   al azar entre ${m.limpios} no marcados con aceptación: ${m.azar.map((c) => `${c.clave} (${c.puesto})`).join(', ') || 'NINGUNO'}`,
    'A QUIÉN NO SE LEE, y se dice:',
    `   sin rastro o con trabajo fuera (C1/C2; ya medidos, se resuelven, no se leen): ${m.seguros.map((c) => c.clave).join(', ') || 'ninguno'}`,
    `   C5 sin motivo que no cupieron en el tope: ${m.fueraDeTope.map((c) => c.clave).join(', ') || 'ninguno'}`,
    `   C5 con el límite declarado (no se leen: confirmar un límite ya dicho rinde casi nada): ${m.conLimiteDeclarado.map((c) => c.clave).join(', ') || 'ninguno'}`,
    `   puestos con cierres limpios y SIN lectura al azar esta pasada: ${m.puestosSinLeer.join(', ') || 'ninguno'}`,
  );
  if (m.azar.length === 0) out.push('   ⚠️ Sin lecturas al azar NO hay cifra del equipo: leer solo a los marcados mide a la criba.');
  out.push('', marcados.length ? '→ HAY CIERRES MARCADOS (salida 1). Marcado no es culpable; y a quién NO se lee está dicho arriba.' : '→ ningún cierre marcado (salida 0). No marcado NO es aprobado.');
  return { codigo: marcados.length ? 1 : 0, lineas: out, cribados, muestra: m };
}

/** El paquete que recibe quien lee. NO lleva el comentario de entrega: quien lee «hecho, 15/15» tiende a confirmarlo. */
export function paqueteDe(cierre, cribado) {
  return [
    `# ${cierre.clave} · lectura de un cierre contra su aceptación`,
    '',
    `> ${cierre.resumen || ''}`,
    '',
    '## La aceptación, literal',
    '',
    ...cierre.aceptacion.map((l, i) => `${i + 1}. ${l}`),
    '',
    '## Dónde está el trabajo',
    '',
    ...(cribado.commits.length ? cribado.commits.slice(0, 12).map((c) => `- \`${c.sha}\` ${c.asunto}`) : ['- ningún commit de `main` nombra este ticket']),
    '',
    '## Cómo mirar producción',
    '',
    'https://yaqu.app con la cuenta de QA del equipo (se la pides al orquestador). `/version` dice qué commit se sirve.',
    '',
    '## Qué devuelves',
    '',
    'Por CADA línea de la aceptación, uno de tres: `CUMPLE` con su evidencia (ruta y línea, o lo que viste en yaqu.app) ·',
    '`NO CUMPLE` con lo que viste en su lugar · `NO PUDE MIRAR` con el motivo. Sin evidencia, la línea es `NO PUDE MIRAR`.',
    '',
    'Este paquete NO trae el comentario de entrega, a propósito. No lo busques antes de mirar.',
    '',
  ].join('\n');
}

// ───────────────────────────── lo que toca el mundo ─────────────────────────────

async function repoReal(raiz, desde) {
  const { instantanea, alcanzabilidadDe } = await import('./_censo-alcanzabilidad.mjs');
  const g = (...args) => execFileSync('git', ['-C', raiz, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const inst = instantanea({ raiz, traer: false });
  if (inst.incapaz) return { incapaz: inst.incapaz };
  const arbol = new Set(g('ls-tree', '-r', '--name-only', inst.sha).split('\n').filter(Boolean));
  const porTicket = new Map();
  for (const l of g('log', inst.sha, '--format=%H%x09%s').split('\n')) {
    const [sha, asunto] = l.split('\t');
    for (const m of String(asunto || '').matchAll(/SCRUM-(\d+)/g)) {
      const n = Number(m[1]); if (!porTicket.has(n)) porTicket.set(n, []); porTicket.get(n).push({ sha, asunto });
    }
  }
  const alcanzable = alcanzabilidadDe(inst);
  const arbolDeMain = g('rev-parse', `${inst.sha}^{tree}`).trim();
  const registrosDe = (n) => [...arbol].filter((p) => new RegExp(`^docs/master/SCRUM-${n}[a-z]?\\.md$`).test(p));
  return {
    sha: inst.sha,
    mergesEnVentana: Number(g('rev-list', '--count', '--merges', `--since=${desde}T00:00:00`, inst.sha).trim()),
    existe: (ruta) => arbol.has(ruta) || [...arbol].some((p) => p.startsWith(`${ruta.replace(/\/$/, '')}/`)),
    tieneRegistro: (n) => registrosDe(n).length > 0,
    registros: (n) => registrosDe(n).map((p) => g('show', `${inst.sha}:${p}`)),
    commits: (n) => porTicket.get(n) || [],
    ramasFuera: (n) => inst.ramas.filter((r) => new RegExp(`^scrum-${n}[a-z]?(-|$)`).test(r.nombre) && alcanzable(r.nombre) === false).map((r) => {
      try {
        const t = g('merge-tree', '--write-tree', inst.sha, r.objeto).split('\n')[0].trim();
        if (t === arbolDeMain) return { rama: r.nombre, cambia: false, detalle: 'fusionarla no cambia main' };
        const f = g('diff', '--name-only', arbolDeMain, t).split('\n').filter(Boolean);
        return { rama: r.nombre, cambia: true, detalle: `fuera de main; fusionarla cambiaría ${f.length} fichero(s) (${f.slice(0, 3).join(', ')}${f.length > 3 ? '…' : ''})` };
      } catch (e) {
        // `merge-tree` sale 1 cuando hay conflicto: hay contenido distinto, y además choca.
        if (e && e.status === 1) return { rama: r.nombre, cambia: true, detalle: 'fuera de main, y fusionarla da CONFLICTO' };
        return { rama: r.nombre, cambia: null, detalle: String((e && e.stderr) || e).trim().split('\n')[0].slice(0, 160) };
      }
    }),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opcion = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const CON_VALOR = new Set(['--desde', '--fecha', '--paquetes']);
  const fichero = argv.find((a, i) => !a.startsWith('--') && !CON_VALOR.has(argv[i - 1]));
  const desde = opcion('--desde');
  const fecha = opcion('--fecha') || new Date().toISOString().slice(0, 10);
  if (!fichero || !/^\d{4}-\d{2}-\d{2}$/.test(String(desde))) {
    console.log('uso: node scripts/auditoria-cierres.mjs <cierres.json> --desde AAAA-MM-DD [--fecha AAAA-MM-DD] [--paquetes <carpeta>]');
    process.exit(2);
  }
  let datos = null;
  try { datos = JSON.parse(fs.readFileSync(fichero, 'utf8').replace(/^﻿/, '')); } catch { datos = null; }
  const conCanario = !argv.includes('--sin-canario');
  // El fichero se valida ANTES de tocar git: un fichero vacío o de otra ventana no merece 15 s de censo.
  let repo = {};
  if (conCanario && validarFichero(datos, { desde }).ok) {
    try { repo = await repoReal(process.cwd(), desde); } catch (e) { repo = { incapaz: String((e && e.message) || e).split('\n')[0].slice(0, 200) }; }
  }
  const r = pasada({ datos, repo, desde, fecha, conCanario });
  if (repo.sha) r.lineas.splice(1, 0, `medido contra origin/main = ${repo.sha}`);
  console.log(r.lineas.join('\n'));
  const carpeta = opcion('--paquetes');
  if (carpeta && r.muestra) {
    fs.mkdirSync(carpeta, { recursive: true });
    const porClave = new Map(datos.cierres.map((c) => [c.clave, c]));
    const leer = [...r.muestra.seguros, ...r.muestra.c5, ...r.muestra.azar];
    for (const c of leer) fs.writeFileSync(path.join(carpeta, `${c.clave}.md`), paqueteDe(porClave.get(c.clave), c));
    console.log(`\n${leer.length} paquete(s) de lectura en ${carpeta} (sin el comentario de entrega)`);
  }
  process.exit(r.codigo);
}
