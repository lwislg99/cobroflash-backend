#!/usr/bin/env node
// SCRUM-1473 · EL BARRIDO de las carpetas `tmp` de `~/.claude/jobs`
//
//   node scripts/equipo/barrer-jobs.mjs                    → PASADA EN SECO: qué vaciaría, qué deja y por qué. No borra.
//   node scripts/equipo/barrer-jobs.mjs --borrar <huella>  → vacía EXACTAMENTE lo que enseñó la pasada en seco
//   node scripts/equipo/barrer-jobs.mjs --horas 72         → con más horas de margen (nunca menos de 24)
//
// POR QUÉ EXISTE. El 6-oct-2026 `~/.claude/jobs` ocupaba 4,94 GB y el 99 % eran las carpetas `tmp` de sondas
// (capturas, descargas) de 280 sesiones muertas; los `state.json` eran 0,04 GB. Nadie las limpiaba. Se
// barrieron a mano con una medición que se había callado los errores, y hubo que ir a comprobar después que
// no se había destruido nada a través de un enlace.
//
// LO QUE TOCA Y LO QUE NO, por construcción y no por cuidado:
//   · Sólo el CONTENIDO de `<jobs>/<id>/tmp`. La carpeta `tmp` se queda: una sesión que siga la encuentra.
//   · Nunca `state.json`, ni nada que no cuelgue de un `tmp`. Los transcripts y la memoria viven en
//     `~/.claude/projects`, que este guion no abre para escribir.
//   · NO SIGUE NI BORRA ENLACES (junctions incluidas). Un enlace dentro de un `tmp` se deja donde está; un
//     `tmp` que es él mismo un enlace, o que cuelga de uno, no se toca. No hay ni un borrado recursivo: los
//     ficheros se quitan de uno en uno y las carpetas sólo cuando ya están vacías.
//   · Sólo de trabajos SIN ACTIVIDAD en 24 h. Medido el 6-oct sobre 294 sesiones: 6 callaron más de 3 h y
//     SIGUIERON; el silencio más largo seguido de actividad fue de 22,1 h; ninguna volvió tras 24 h. (El
//     barrido a mano de ese día usó 3 h: con ese número, a esas seis se les habría vaciado el `tmp`.)
//   · Si de un trabajo no se puede saber cuándo fue su última actividad, NO se barre y se dice.
//   · Borrar exige la HUELLA que imprime la pasada en seco: no se borra lo que no se ha visto.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { recorrer } from './disco.mjs';

/** Por encima del mayor silencio-con-reanudación medido (22,1 h sobre 294 sesiones, 6-oct-2026). */
export const HORAS_SIN_ACTIVIDAD = 24;

const GB = 1024 ** 3; const MB = 1024 ** 2;
const tam = (b) => (b >= GB ? `${(b / GB).toFixed(2)} GB` : `${(b / MB).toFixed(1)} MB`);

/**
 * Cada trabajo, con lo que se sabe de él. No borra nada.
 * @returns {{pudo:boolean, motivo?:string, filas:{id:string, nombre:string, estado:string, tmp:string, bytes:number, ficheros:number, enlaces:number, horas:number|null, veredicto:'BARRER'|'VACÍO'|'RECIENTE'|'TRABAJANDO'|'NO SE SABE'|'ENLACE', porque:string}[]}}
 */
export function censar(dirJobs, { ahora = Date.now(), horas = HORAS_SIN_ACTIVIDAD } = {}) {
  let ents; let real;
  try { ents = fs.readdirSync(dirJobs, { withFileTypes: true }); real = fs.realpathSync(dirJobs); } catch (e) {
    return { pudo: false, motivo: `no se pudo leer ${dirJobs} (${e.code || e.message})`, filas: [] };
  }
  const filas = [];
  for (const e of ents) {
    if (!e.isDirectory() || e.isSymbolicLink()) continue;
    const id = e.name;
    const base = path.join(dirJobs, id);
    const tmp = path.join(base, 'tmp');
    const fila = { id, nombre: id, estado: '?', tmp, bytes: 0, ficheros: 0, enlaces: 0, horas: null };
    const deja = (veredicto, porque) => filas.push({ ...fila, veredicto, porque });
    let tmpSt;
    try { tmpSt = fs.lstatSync(tmp); } catch (err) {
      if (err.code === 'ENOENT') continue; // sin `tmp` no hay nada que barrer ni que decir
      deja('NO SE SABE', `no se pudo mirar su tmp (${err.code})`); continue;
    }
    // Un `tmp` que es un enlace, o cuya ruta real no es la escrita (cuelga de un enlace), no se toca.
    if (tmpSt.isSymbolicLink()) { deja('ENLACE', 'su `tmp` es un enlace: no se sigue ni se toca'); continue; }
    let tmpReal;
    try { tmpReal = fs.realpathSync(tmp); } catch (err) { deja('NO SE SABE', `no se pudo resolver su tmp (${err.code})`); continue; }
    if (tmpReal !== path.join(real, id, 'tmp')) { deja('ENLACE', 'su `tmp` no está donde dice su ruta (cuelga de un enlace)'); continue; }
    if (!tmpSt.isDirectory()) { deja('NO SE SABE', 'su `tmp` no es una carpeta'); continue; }

    // La última actividad es la MÁS RECIENTE de todas las señales. Si una no se deja leer, no se sabe.
    let ultima = 0; let ciego = '';
    const rutaEstado = path.join(base, 'state.json');
    let s;
    try {
      ultima = Math.max(ultima, fs.statSync(rutaEstado).mtimeMs);
      const txt = fs.readFileSync(rutaEstado, 'utf8');
      s = JSON.parse(txt.charCodeAt(0) === 0xFEFF ? txt.slice(1) : txt);
    } catch (err) { ciego = `su state.json no se deja leer (${err.code || err.name})`; }
    if (s && typeof s === 'object') {
      fila.nombre = String(s.name || id); fila.estado = String(s.state || '?');
      const act = Date.parse(s.updatedAt);
      if (Number.isFinite(act)) ultima = Math.max(ultima, act);
      // El transcript vive fuera: sólo se le mira la fecha. Que ya no exista no ciega; que no se deje mirar, sí.
      if (s.linkScanPath) {
        try { ultima = Math.max(ultima, fs.statSync(s.linkScanPath).mtimeMs); } catch (err) { if (err.code !== 'ENOENT') ciego = ciego || `su transcript no se deja mirar (${err.code})`; }
      }
    } else if (!ciego) ciego = 'su state.json no es un objeto';
    const todo = recorrer(base, (p, st) => { if (st.mtimeMs > ultima) ultima = st.mtimeMs; });
    if (todo.noRecorridas.length) ciego = ciego || `${todo.noRecorridas.length} carpeta(s) suyas no se pudieron recorrer (${todo.noRecorridas[0].codigo})`;
    const dentro = recorrer(tmp);
    fila.bytes = dentro.bytes; fila.ficheros = dentro.ficheros; fila.enlaces = dentro.enlaces;
    fila.horas = ultima ? (ahora - ultima) / 36e5 : null;

    if (ciego) deja('NO SE SABE', ciego);
    else if (fila.horas === null) deja('NO SE SABE', 'no tiene ninguna fecha de actividad');
    else if (dentro.ficheros === 0 && dentro.carpetas <= 1 && dentro.enlaces === 0) deja('VACÍO', 'su `tmp` ya está vacío');
    else if (fila.estado === 'working') deja('TRABAJANDO', 'su state dice «working»');
    else if (fila.horas < horas) deja('RECIENTE', `tuvo actividad hace ${fila.horas.toFixed(1)} h (menos de ${horas})`);
    else deja('BARRER', `sin actividad desde hace ${fila.horas.toFixed(1)} h`);
  }
  filas.sort((a, b) => b.bytes - a.bytes);
  return { pudo: true, filas };
}

export const candidatos = (censo) => censo.filas.filter((f) => f.veredicto === 'BARRER');

/** La lista que se va a borrar, hecha número: si cambia la lista, cambia la huella. */
export function huellaDe(censo) {
  const ids = candidatos(censo).map((f) => f.id).sort();
  return crypto.createHash('sha256').update(ids.join('\n')).digest('hex').slice(0, 8);
}

/**
 * Vacía una carpeta `tmp` SIN borrado recursivo: ficheros de uno en uno, carpetas sólo si quedaron vacías.
 * Un enlace no se sigue y no se borra: se queda, y la carpeta que lo contiene también.
 * @returns {{ficheros:number, carpetas:number, bytes:number, enlaces:number, fallos:{codigo:string, ruta:string}[]}}
 */
export function vaciar(tmp) {
  const r = { ficheros: 0, carpetas: 0, bytes: 0, enlaces: 0, fallos: [] };
  const baja = (d, esRaiz) => {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { r.fallos.push({ codigo: String(e.code || e.name), ruta: d }); return false; }
    let vacia = true;
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) { r.enlaces++; vacia = false; continue; }
      if (e.isDirectory()) { if (!baja(p, false)) vacia = false; continue; }
      try { const st = fs.lstatSync(p); fs.unlinkSync(p); r.ficheros++; r.bytes += st.size; } catch (err) { r.fallos.push({ codigo: String(err.code || err.name), ruta: p }); vacia = false; }
    }
    if (esRaiz) return vacia;
    if (!vacia) return false;
    try { fs.rmdirSync(d); r.carpetas++; return true; } catch (err) { r.fallos.push({ codigo: String(err.code || err.name), ruta: d }); return false; }
  };
  baja(tmp, true);
  return r;
}

/**
 * Borra lo que el censo marca como BARRER, y sólo si la huella es la de ESE censo.
 * @returns {{borro:boolean, motivo?:string, resultados:{id:string, nombre:string, r:ReturnType<typeof vaciar>}[]}}
 */
export function barrer(dirJobs, { huella, ahora = Date.now(), horas = HORAS_SIN_ACTIVIDAD } = {}) {
  const censo = censar(dirJobs, { ahora, horas });
  if (!censo.pudo) return { borro: false, motivo: censo.motivo, censo, resultados: [] };
  const buena = huellaDe(censo);
  if (!huella || huella !== buena) return { borro: false, motivo: huella ? `la huella «${huella}» no es la de esta lista («${buena}»): la lista ha cambiado desde que la viste, o no era de aquí` : 'falta la huella de la pasada en seco', censo, resultados: [] };
  const resultados = candidatos(censo).map((f) => ({ id: f.id, nombre: f.nombre, r: vaciar(f.tmp) }));
  return { borro: true, censo, resultados };
}

/** El texto de la pasada en seco. La población primero; la orden de borrar, al final y entera. */
export function informe(censo, { dirJobs, horas = HORAS_SIN_ACTIVIDAD }) {
  if (!censo.pudo) return `BARRIDO · 🔴 NO PUDE MIRAR: ${censo.motivo}\n   Esto NO quiere decir que no haya nada que barrer.`;
  const cs = candidatos(censo);
  const de = (v) => censo.filas.filter((f) => f.veredicto === v);
  const total = cs.reduce((a, f) => a + f.bytes, 0);
  const out = [`BARRIDO de \`tmp\` · ${dirJobs} · ${censo.filas.length} trabajo(s) con carpeta tmp · sin actividad en ${horas} h o más: ${cs.length} · PASADA EN SECO: no se ha borrado nada`];
  out.push('', `SE VACIARÍA (${cs.length} trabajo(s), ${tam(total)}, ${cs.reduce((a, f) => a + f.ficheros, 0)} fichero(s)):`);
  for (const f of cs) out.push(`   · ${f.id} ${f.nombre} (${f.estado}) · ${f.porque} · ${tam(f.bytes)} en ${f.ficheros} fichero(s)${f.enlaces ? ` · ${f.enlaces} ENLACE(S) dentro: se dejan, no se siguen` : ''}`);
  if (!cs.length) out.push('   (nada)');
  out.push('', 'SE DEJA:');
  for (const [v, que] of [['RECIENTE', 'con actividad reciente'], ['TRABAJANDO', 'trabajando'], ['VACÍO', 'ya vacíos'], ['ENLACE', 'con un enlace por `tmp`'], ['NO SE SABE', 'de los que NO SE SABE su última actividad']]) {
    const fs_ = de(v);
    if (!fs_.length) continue;
    const peso = fs_.reduce((a, f) => a + f.bytes, 0);
    // Los que no se saben y los enlaces se nombran uno a uno: son los que alguien tiene que mirar.
    const detalle = v === 'NO SE SABE' || v === 'ENLACE' ? `: ${fs_.map((f) => `${f.id} ${f.nombre} — ${f.porque}`).join(' · ')}` : v === 'VACÍO' ? '' : `: ${fs_.slice(0, 20).map((f) => f.nombre).join(', ')}${fs_.length > 20 ? ' …' : ''}`;
    out.push(`   · ${fs_.length} ${que}${peso ? ` (${tam(peso)})` : ''}${detalle}`);
  }
  out.push('', 'NO SE TOCA NUNCA: `state.json`, la carpeta `tmp` en sí, nada de fuera de un `tmp`, ningún enlace ni lo que haya detrás.');
  out.push(cs.length ? `Para vaciar EXACTAMENTE esta lista → node scripts/equipo/barrer-jobs.mjs --borrar ${huellaDe(censo)}${horas !== HORAS_SIN_ACTIVIDAD ? ` --horas ${horas}` : ''}` : 'No hay nada que vaciar.');
  return out.join('\n');
}

function principal(argv) {
  const dirJobs = process.env.CLAUDE_JOBS_DIR || path.join(os.homedir(), '.claude', 'jobs');
  const i = argv.indexOf('--horas');
  const horas = i >= 0 ? Number(argv[i + 1]) : HORAS_SIN_ACTIVIDAD;
  if (!Number.isFinite(horas) || horas < HORAS_SIN_ACTIVIDAD) {
    console.log(`🔴 --horas tiene que ser un número de ${HORAS_SIN_ACTIVIDAD} o más: por debajo hay sesiones que callan y siguen (medido: hasta 22,1 h). No hago nada.`);
    return 2;
  }
  const j = argv.indexOf('--borrar');
  const valores = new Set([i, j].filter((k) => k >= 0).map((k) => k + 1));
  const sobran = argv.filter((a, k) => !['--horas', '--borrar'].includes(a) && !valores.has(k));
  if (sobran.length) { console.log(`🔴 no entiendo «${sobran.join(' ')}». uso: barrer-jobs.mjs [--horas N] [--borrar <huella>]. No hago nada.`); return 2; }
  if (j < 0) {
    const censo = censar(dirJobs, { horas });
    console.log(informe(censo, { dirJobs, horas }));
    return censo.pudo ? 0 : 2;
  }
  const r = barrer(dirJobs, { huella: argv[j + 1], horas });
  if (!r.borro) {
    console.log(informe(r.censo, { dirJobs, horas }));
    console.log(`\n🔴 NO SE HA BORRADO NADA: ${r.motivo}.`);
    return r.censo.pudo ? 1 : 2;
  }
  let bytes = 0; let ficheros = 0; let fallos = 0; let enlaces = 0;
  for (const x of r.resultados) {
    bytes += x.r.bytes; ficheros += x.r.ficheros; fallos += x.r.fallos.length; enlaces += x.r.enlaces;
    console.log(`   · ${x.id} ${x.nombre} · ${tam(x.r.bytes)} en ${x.r.ficheros} fichero(s)${x.r.enlaces ? ` · ${x.r.enlaces} enlace(s) dejados` : ''}${x.r.fallos.length ? ` · 🔴 ${x.r.fallos.length} sin borrar (${x.r.fallos.slice(0, 2).map((f) => `${f.codigo}: ${f.ruta}`).join(' · ')})` : ''}`);
  }
  console.log(`BARRIDO · vaciados ${r.resultados.length} tmp · ${tam(bytes)} en ${ficheros} fichero(s) · ${enlaces} enlace(s) dejados sin tocar · ${fallos} que NO se pudieron borrar`);
  return fallos ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = principal(process.argv.slice(2));
}
