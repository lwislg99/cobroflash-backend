#!/usr/bin/env node
// SCRUM-1414 · CUÁNTO TIEMPO PASA EL EQUIPO ESPERANDO, Y A QUIÉN
//
//   node scripts/espera-del-equipo.mjs [--jobs <carpeta>] [--desde AAAA-MM-DD] [--hueco-min 15] [--larga-min 120]
//
// POR QUÉ EXISTE. El equipo comprueba al orquestador en lo que entrega, y nadie mide lo que cuesta
// ESPERARLE. El 2-oct-2026, media hora después de arrancar, cuatro de seis puestos estaban parados
// esperando una decisión suya: una foto de un instante, sin serie. Esto es la serie.
//
// DE DÓNDE SALE CADA DATO — y cuál es de fiar:
//
//   CUÁNDO se para y cuándo vuelve   `~/.claude/jobs/<id>/timeline.jsonl`: una línea por cambio, con
//                                    `at` y `state` (working / blocked / done). ESTRUCTURADO.
//   QUIÉN la despertó                la transcripción de la sesión (`linkScanPath` de su `state.json`):
//                                    cada entrada de usuario lleva `origin.kind` (human, peer,
//                                    task-notification) y, si es otra sesión, su nombre. ESTRUCTURADO.
//   QUÉ dijo que esperaba            la prosa de `detail`/`text` al pararse. BÚSQUEDA POR PALABRAS: es
//                                    la parte floja, se imprime aparte y lleva su cubo «sin clasificar».
//                                    La criba de cierres falló dos veces por casar por la forma
//                                    (C5 y C6 de SCRUM-1372): este cubo no se usa para la cifra principal.
//
// QUÉ CUENTA COMO ESPERA. Desde que la sesión pasa a `blocked` o `done` hasta su siguiente `working`.
// `done` cuenta: una sesión que «acabó» y a la que luego se le contesta estaba esperando.
//
// LO QUE NO SE PUEDE RECONSTRUIR, Y SE DICE (nunca se suma a la espera ni al trabajo):
//   HUECO   dos `working` seguidos separados por más de --hueco-min: nadie escribió nada en medio
//           (máquina dormida, proceso muerto, cuota). No se sabe qué pasó.
//   COLA    la sesión se paró y nunca volvió: no se sabe si esperaba o si se la dio por terminada.
//   LARGA   una espera de más de --larga-min: es una noche o una parada del equipo, no un cuello de
//           botella. Se cuenta APARTE de las cortas, que son las que miden a quien tiene que contestar.
//
// SALIDA: 0 = medido · 2 = NO VALE (no se pudo leer ninguna línea de tiempo de un puesto).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HUECO_MIN = 15;
export const LARGA_MIN = 120;
/** La hora de Madrid en la ventana medida (verano, UTC+2). Solo decide a qué DÍA se apunta un tramo. */
export const HUSO_MS = 2 * 3600e3;
/** Días que no representan un día normal, con su motivo. Se marcan; no se quitan. */
export const DIAS_RAROS = Object.freeze({ '2026-10-01': 'parada en seco a las 16:10 por el límite semanal' });

const MIN = 60e3;

/** `s0-2oct`, `sesion-3`, `s4-29c` → `S0`, `S3`, `S4`. Lo demás no es un puesto del equipo. */
export function puestoDe(nombre) {
  const m = /^s(?:esion-)?(\d)(?!\d)/i.exec(nombre || '');
  return m ? `S${m[1]}` : null;
}

/** Quién escribe: el orquestador se llama como el repositorio (`cobroflash-backend-57`) o `orquestador`. */
export function quienEs(origen) {
  if (!origen) return 'sin dato';
  if (origen.kind === 'human') return 'una persona';
  if (origen.kind === 'task-notification') return 'aviso de una tarea propia';
  if (origen.kind !== 'peer') return 'sin dato';
  if (!origen.nombre) return 'otra sesión (sin nombre)';
  if (puestoDe(origen.nombre)) return 'otra sesión del equipo';
  return 'el orquestador';
}

/** Lo que la sesión DIJO que esperaba. Por palabras: orienta, no decide. El orden es de más a menos concreto. */
const DICE = [
  ['cuota', /l[ií]mite (semanal|de uso)|\bcuota\b|usage limit|rate limit/i],
  ['permiso del sistema', /permiso|permission|denegad|clasificador|hook|arn[eé]s/i],
  ['veredicto de CI', /\bCI\b|\bchecks?\b|veredicto|workflow|auto-?merge|\bPR\b.*(verde|rojo|pendiente)/i],
  ['el fundador', /fundador|\bfirma\b|\bfirme\b|\bGO\b|founder/i],
  ['decisión del orquestador', /orquestador|orchestrator|decisi[oó]n|decision|awaiting|esperando|a la espera|dime/i],
];
export function queDice(texto) {
  for (const [nombre, re] of DICE) if (re.test(texto || '')) return nombre;
  return 'sin clasificar';
}

/** @returns {{eventos:{at:number,state:string,dice:string}[], ilegibles:number}} */
export function leerLinea(jsonl) {
  const eventos = []; let ilegibles = 0;
  for (const l of String(jsonl).split('\n')) {
    if (!l.trim()) continue;
    let o; try { o = JSON.parse(l); } catch { ilegibles++; continue; }
    const at = Date.parse(o && o.at);
    if (!Number.isFinite(at) || !['working', 'blocked', 'done'].includes(o.state)) { ilegibles++; continue; }
    eventos.push({ at, state: o.state, dice: `${o.detail || ''} ${o.text || ''}` });
  }
  eventos.sort((a, b) => a.at - b.at);
  return { eventos, ilegibles };
}

/** Las entradas que pueden despertar a una sesión, con su hora. @returns {{at:number,kind:string,nombre:string|null}[]} */
export function leerDespertadores(jsonl) {
  const out = [];
  for (const l of String(jsonl).split('\n')) {
    if (!l.includes('"origin"')) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (o.type !== 'user' || o.toolUseResult !== undefined || !o.origin) continue;
    const at = Date.parse(o.timestamp);
    if (!Number.isFinite(at)) continue;
    const c = o.message && o.message.content;
    const m = /from-name="([^"]+)"/.exec(typeof c === 'string' ? c : JSON.stringify(c || '').replace(/\\"/g, '"'));
    out.push({ at, kind: o.origin.kind, nombre: m ? m[1] : null });
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * La línea de tiempo, partida en tramos. Cada instante entre el primer y el último evento cae en UNO.
 * @returns {{tipo:'trabajo'|'espera'|'hueco'|'cola', desde:number, hasta:number|null, estado?:string, dice?:string}[]}
 */
export function tramosDe(eventos, { huecoMs = HUECO_MIN * MIN } = {}) {
  const tramos = [];
  let parada = null; // el primer evento de la parada en curso
  for (let i = 0; i < eventos.length; i++) {
    const e = eventos[i]; const sig = eventos[i + 1];
    if (e.state === 'working') {
      if (parada) { tramos.push({ tipo: 'espera', desde: parada.at, hasta: e.at, estado: parada.state, dice: parada.dice }); parada = null; }
      if (sig) tramos.push({ tipo: sig.at - e.at > huecoMs ? 'hueco' : 'trabajo', desde: e.at, hasta: sig.at });
    } else if (!parada) parada = e;
    // una segunda parada sin `working` en medio (done → blocked) es la MISMA espera: manda la primera
  }
  if (parada) tramos.push({ tipo: 'cola', desde: parada.at, hasta: null, estado: parada.state, dice: parada.dice });
  return tramos;
}

/** Quién despertó una espera: la última entrada que llegó mientras estaba parada (con 5 s de holgura al volver). */
export function despertadorDe(tramo, despertadores) {
  if (!despertadores) return 'sin transcripción';
  let ultimo = null;
  for (const d of despertadores) if (d.at >= tramo.desde && d.at <= tramo.hasta + 5000) ultimo = d;
  return quienEs(ultimo);
}

const dia = (ms) => new Date(ms + HUSO_MS).toISOString().slice(0, 10);

/** Por cada jornada (un puesto, un día): de su primer a su último trabajo, cuánto no trabajó NINGUNA de sus sesiones. */
export function paradoDeLasJornadas(jornadas) {
  let total = 0, parado = 0, n = 0;
  for (const tramos of Object.values(jornadas)) {
    const o = [...tramos].sort((a, b) => a[0] - b[0]);
    let fin = o[0][0], trabajado = 0;
    for (const [d, hta] of o) { if (hta > fin) { trabajado += hta - Math.max(d, fin); fin = hta; } }
    n++; total += fin - o[0][0]; parado += fin - o[0][0] - trabajado;
  }
  return { n, total, parado };
}

/**
 * @param {{id:string, nombre:string, linea:string|null, transcripcion:string|null}[]} trabajos
 * @returns {{codigo:0|2, lineas:string[], datos?:object}}
 */
export function medir(trabajos, { desde = null, huecoMin = HUECO_MIN, largaMin = LARGA_MIN, ahora = Date.now() } = {}) {
  const out = ['ESPERA DEL EQUIPO · cuánto tiempo pasan los puestos parados, y quién los despierta'];
  const fuera = {}; const puestos = [];
  for (const t of trabajos) {
    const p = puestoDe(t.nombre);
    if (!p) { const k = t.nombre ? 'no es un puesto (orquestador, pruebas…)' : 'sin nombre'; fuera[k] = (fuera[k] || 0) + 1; continue; }
    if (t.linea == null) { fuera['puesto sin línea de tiempo'] = (fuera['puesto sin línea de tiempo'] || 0) + 1; continue; }
    puestos.push({ ...t, puesto: p });
  }
  const desdeMs = desde ? Date.parse(`${desde}T00:00:00Z`) - HUSO_MS : -Infinity;
  const suma = { trabajo: 0, corta: 0, larga: 0, hueco: 0 };
  const porQuien = {}; const porDice = {}; const porEstado = {}; const porDia = {}; const porPuesto = {};
  const esperasDelOrquestador = []; const jornadas = {}; const abiertas = [];
  let ilegibles = 0, colas = 0, sinTranscripcion = 0, leidas = 0, primero = Infinity, ultimo = -Infinity, nEsperas = 0, nLargas = 0;
  const mas = (o, k, ms) => { o[k] = o[k] || { ms: 0, n: 0 }; o[k].ms += ms; o[k].n += 1; };
  for (const t of puestos) {
    const { eventos, ilegibles: il } = leerLinea(t.linea);
    ilegibles += il;
    const enVentana = eventos.filter((e) => e.at >= desdeMs);
    if (enVentana.length === 0) { fuera['puesto sin actividad en la ventana'] = (fuera['puesto sin actividad en la ventana'] || 0) + 1; continue; }
    leidas++;
    const desp = t.transcripcion == null ? null : leerDespertadores(t.transcripcion);
    if (!desp) sinTranscripcion++;
    primero = Math.min(primero, enVentana[0].at); ultimo = Math.max(ultimo, enVentana[enVentana.length - 1].at);
    for (const tr of tramosDe(enVentana, { huecoMs: huecoMin * MIN })) {
      if (tr.tipo === 'cola') {
        colas++;
        if (dia(tr.desde) === dia(ahora)) abiertas.push({ nombre: t.nombre, estado: tr.estado, ms: ahora - tr.desde, dice: queDice(tr.dice) });
        continue;
      }
      const ms = tr.hasta - tr.desde; const d = dia(tr.desde);
      porDia[d] = porDia[d] || { trabajo: 0, corta: 0, orquestador: 0, larga: 0, hueco: 0 };
      porPuesto[t.puesto] = porPuesto[t.puesto] || { trabajo: 0, corta: 0, orquestador: 0 };
      if (tr.tipo === 'trabajo') { const k = `${d} ${t.puesto}`; (jornadas[k] = jornadas[k] || []).push([tr.desde, tr.hasta]); }
      if (tr.tipo !== 'espera') { suma[tr.tipo] += ms; porDia[d][tr.tipo] += ms; if (tr.tipo === 'trabajo') porPuesto[t.puesto].trabajo += ms; continue; }
      if (ms > largaMin * MIN) { suma.larga += ms; porDia[d].larga += ms; nLargas++; continue; }
      nEsperas++; suma.corta += ms; porDia[d].corta += ms; porPuesto[t.puesto].corta += ms;
      const quien = despertadorDe(tr, desp);
      mas(porQuien, quien, ms); mas(porDice, queDice(tr.dice), ms); mas(porEstado, tr.estado, ms);
      if (quien === 'el orquestador') { esperasDelOrquestador.push(ms); porDia[d].orquestador += ms; porPuesto[t.puesto].orquestador += ms; }
    }
  }
  const h = (ms) => `${(ms / 3600e3).toFixed(1)} h`;
  const pct = (a, b) => (b > 0 ? `${Math.round((100 * a) / b)} %` : 'sin base');
  out.push(
    '',
    `trabajos mirados: ${trabajos.length} · puestos del equipo con línea de tiempo en la ventana: ${leidas}`,
    `fuera de la medida: ${Object.entries(fuera).map(([k, v]) => `${v} ${k}`).join(' · ') || 'ninguno'}`,
  );
  if (leidas === 0) {
    out.push('', '🔴 NO VALE (salida 2): no se pudo leer la línea de tiempo de ningún puesto.', '   Esto NO quiere decir que nadie esperase.');
    return { codigo: 2, lineas: out };
  }
  const vivo = suma.trabajo + suma.corta;
  const delOrq = (porQuien['el orquestador'] || { ms: 0 }).ms;
  out.push(
    `ventana: ${new Date(primero).toISOString()} → ${new Date(ultimo).toISOString()}${desde ? ` (desde ${desde})` : ''}`,
    `umbrales: hueco > ${huecoMin} min entre dos «working» · espera larga > ${largaMin} min`,
    '',
    'LA CIFRA',
    `   tiempo vivo (trabajando + esperas cortas): ${h(vivo)}`,
    `   de él, ESPERANDO: ${h(suma.corta)} = ${pct(suma.corta, vivo)} · en ${nEsperas} esperas`,
    `   de esa espera, la despertó EL ORQUESTADOR: ${h(delOrq)} = ${pct(delOrq, suma.corta)} de la espera · ${pct(delOrq, vivo)} del tiempo vivo`,
  );
  if (esperasDelOrquestador.length) {
    const o = [...esperasDelOrquestador].sort((a, b) => a - b);
    const q = (p) => Math.round(o[Math.min(o.length - 1, Math.floor(p * o.length))] / MIN);
    out.push(`   lo que tarda el orquestador en despertar a una sesión parada: mediana ${q(0.5)} min · 9 de cada 10 en menos de ${q(0.9)} min · ${o.length} veces`);
  }
  const tabla = (titulo, obj, nota) => {
    out.push('', titulo, '| | tiempo | de la espera | veces |', '|---|---|---|---|');
    for (const [k, v] of Object.entries(obj).sort((a, b) => b[1].ms - a[1].ms)) out.push(`| ${k} | ${h(v.ms)} | ${pct(v.ms, suma.corta)} | ${v.n} |`);
    if (nota) out.push(nota);
  };
  tabla('QUIÉN LA DESPERTÓ (dato estructurado: el origen de la entrada en la transcripción)', porQuien,
    '«una persona» es quien teclea en esa sesión: el fundador, o el prompt de arranque. «sin dato»: volvió a trabajar sin ninguna entrada en la transcripción.');
  tabla('CÓMO SE PARÓ (dato estructurado: el estado que la sesión declaró)', porEstado, '`blocked` = dijo que no podía seguir · `done` = dijo que había acabado, y luego se le contestó.');
  tabla('QUÉ DIJO QUE ESPERABA (⚠️ búsqueda por palabras en su último mensaje: orienta, no decide)', porDice);
  if (!porDice['sin clasificar']) out.push('| sin clasificar | 0.0 h | 0 % | 0 |');
  out.push('', 'POR PUESTO', '| puesto | trabajando | esperando | esperando al orquestador |', '|---|---|---|---|');
  for (const [p, v] of Object.entries(porPuesto).sort()) out.push(`| ${p} | ${h(v.trabajo)} | ${h(v.corta)} (${pct(v.corta, v.trabajo + v.corta)}) | ${h(v.orquestador)} |`);
  // EL TECHO. Una sesión que se para y a la que se contesta LANZANDO OTRA no deja espera en su línea de
  // tiempo: deja una cola. Lo que sí se ve es el PUESTO: dentro de su jornada (de su primer a su último
  // tramo de trabajo del día, en cualquiera de sus sesiones), el tiempo en que ninguna trabajaba.
  const jornada = paradoDeLasJornadas(jornadas);
  out.push(
    '',
    'EL PUESTO, NO LA SESIÓN (el techo: incluye relevos, esperas largas y huecos dentro de la jornada)',
    `   jornadas de puesto medidas: ${jornada.n} · suman ${h(jornada.total)} de primer a último trabajo del día`,
    `   de ellas, con NINGUNA sesión del puesto trabajando: ${h(jornada.parado)} = ${pct(jornada.parado, jornada.total)}`,
    `   → el tiempo parado está entre ${pct(suma.corta, vivo)} (solo esperas que se ven en una sesión) y ${pct(jornada.parado, jornada.total)} (todo lo que el puesto no trabajó dentro de su jornada).`,
  );
  // LO DE AHORA. Una sesión parada HOY que todavía no ha vuelto no está en ninguna cifra de arriba
  // (su espera no ha terminado). Es justo la que alguien puede desbloquear en este momento.
  abiertas.sort((a, b) => b.ms - a.ms);
  out.push('', `PARADAS HOY Y SIN VOLVER (${abiertas.length}) — esperan, o se dieron por terminadas: no se distingue. Suman ${h(abiertas.reduce((s, a) => s + a.ms, 0))} hasta ahora`);
  for (const a of abiertas) out.push(`   · ${a.nombre} · ${a.estado} hace ${Math.round(a.ms / MIN)} min · dijo: ${a.dice}`);
  out.push('', 'POR DÍA (el día en que EMPIEZA el tramo, hora de Madrid)', '| día | trabajando | esperando | al orquestador | esperas largas | huecos |', '|---|---|---|---|---|---|');
  for (const [d, v] of Object.entries(porDia).sort()) {
    out.push(`| ${d}${DIAS_RAROS[d] ? ' ⚠️' : ''} | ${h(v.trabajo)} | ${h(v.corta)} (${pct(v.corta, v.trabajo + v.corta)}) | ${h(v.orquestador)} | ${h(v.larga)} | ${h(v.hueco)} |`);
  }
  for (const [d, motivo] of Object.entries(DIAS_RAROS)) if (porDia[d]) out.push(`⚠️ ${d} NO es un día representativo: ${motivo}.`);
  out.push(
    '',
    'LO QUE NO SE PUDO RECONSTRUIR (no está en ninguna cifra de arriba)',
    `   esperas largas (> ${largaMin} min): ${nLargas}, ${h(suma.larga)} — noches y paradas del equipo; no miden a quien contesta`,
    `   huecos entre dos «working» (> ${huecoMin} min): ${h(suma.hueco)} — no se sabe si trabajaba, dormía la máquina o murió el proceso`,
    `   sesiones que se pararon y NUNCA volvieron: ${colas} — no se sabe si esperaban o si se las dio por terminadas; su espera no tiene final y no se suma`,
    `   puestos sin transcripción (no se sabe quién los despertó): ${sinTranscripcion}`,
    `   líneas ilegibles en las líneas de tiempo: ${ilegibles}`,
  );
  return { codigo: 0, lineas: out, datos: { suma, vivo, porQuien, porDice, porEstado, porDia, porPuesto, colas, ilegibles, sinTranscripcion, leidas, fuera, nEsperas, nLargas, jornada, abiertas } };
}

/** Lee la carpeta de trabajos de verdad. Lo que no se puede leer llega como `null`, no se salta. */
export function leerTrabajos(carpeta) {
  const trabajos = [];
  for (const id of fs.readdirSync(carpeta)) {
    const dir = path.join(carpeta, id);
    if (!fs.statSync(dir).isDirectory()) continue;
    let estado = null; try { estado = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')); } catch { /* sin estado: sin nombre */ }
    const flags = (estado && estado.respawnFlags) || [];
    const i = flags.indexOf('-n');
    const leer = (f) => { try { return f ? fs.readFileSync(f, 'utf8') : null; } catch { return null; } };
    trabajos.push({ id, nombre: i >= 0 ? flags[i + 1] : '', linea: leer(path.join(dir, 'timeline.jsonl')), transcripcion: leer(estado && estado.linkScanPath) });
  }
  return trabajos;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n, def) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : def; };
  const carpeta = arg('--jobs', path.join(os.homedir(), '.claude', 'jobs'));
  let trabajos;
  try { trabajos = leerTrabajos(carpeta); } catch (e) {
    console.log(`🔴 NO VALE (salida 2): no se puede leer ${carpeta} (${e.code || e.message}).`);
    process.exit(2);
  }
  const r = medir(trabajos, { desde: arg('--desde', null), huecoMin: Number(arg('--hueco-min', HUECO_MIN)), largaMin: Number(arg('--larga-min', LARGA_MIN)) });
  console.log(r.lineas.join('\n'));
  process.exit(r.codigo);
}
