#!/usr/bin/env node
// SCRUM-1356 · EL LATIDO, ENGANCHADO AL ARRANQUE (SessionStart)
//
//   node .claude/hooks/latido-arranque.mjs           → el hook: lee el JSON de SessionStart por stdin
//   node .claude/hooks/latido-arranque.mjs corrio    → ¿ha corrido de verdad? su último rastro y su edad
//
// POR QUÉ EXISTE. `scripts/equipo/latido.mjs` (S5, SCRUM-1350) funciona, pero solo si quien reparte se
// acuerda de lanzarlo. Medido el 1-oct-2026 en la mano del orquestador: prometió a tres sesiones vigilar
// sus PR, ESCRIBIÓ el vigía y no lo armó; durante minutos nadie miraba y él creía que sí.
//
//   >>> ESCRITO NO ES CORRIENDO. Por eso este hook deja RASTRO cada vez que corre, y `corrio` lo lee. <<<
//
// A QUIÉN. Solo a quien NO es un puesto: el orquestador y las sesiones sin nombre. A `s3-1oct`,
// `sesion-2` o `j4-…` no les dice nada: una pasada costó 30, 62 y 245 s (tres medidas del 1-oct, con 12,
// 9 y 11 PR abiertos: no depende solo de cuántos hay) y el parte es de quien reparte.
//
// LO QUE NO PUEDE HACER, a propósito:
//   · PARAR A NADIE. SessionStart no bloquea, y este fichero sale 0 SIEMPRE.
//   · CALLAR. Si la pasada no cabe en su plazo, da las secciones LOCALES (el registro de trabajos se lee
//     en 0,4 s) y dice con todas las letras que PR, MAIN y DESPLIEGUE no se miraron. Si falla él mismo,
//     lo dice en el contexto. Un silencio aquí se leería como «nada que atender».
//   · LANZAR ALGO DE FONDO. La pasada es un hijo síncrono con plazo; al vencer, se le mata.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LATIDO = path.join(RAIZ, 'scripts', 'equipo', 'latido.mjs');

/** Plazo de la pasada completa. El `timeout` del hook en settings.json tiene que ser MAYOR que esto. */
export const SEGUNDOS = 90;
/** Lo que cabe en un `additionalContext` sin que el arnés lo recorte por su cuenta y sin decirlo. */
export const TOPE_CARACTERES = 9000;
/** Un rastro más viejo que esto ya no prueba que el hook siga enganchado. */
export const HORAS_DE_RASTRO = 24;

const CAB = 'LATIDO (hook de inicio, SCRUM-1356)';

/** `s3-1oct`, `sesion-2`, `j4-…`, `puesto-j1` → puesto. Sin nombre, u otro nombre → NO es un puesto. */
export function esPuesto(nombre) {
  return /^(?:s|sesion-|j|puesto-j)\d/i.test(String(nombre || '').trim());
}

/** @returns {{correr:boolean, motivo:string}} */
export function decidir({ titulo, env = {} }) {
  if (/^(0|no|off)$/i.test(String(env.YAQU_LATIDO || ''))) return { correr: false, motivo: 'apagado con YAQU_LATIDO' };
  if (esPuesto(titulo)) return { correr: false, motivo: `«${String(titulo).trim()}» es un puesto` };
  return { correr: true, motivo: titulo ? `«${String(titulo).trim()}» no es un puesto` : 'sesión sin nombre' };
}

export function recortar(texto, tope = TOPE_CARACTERES) {
  const t = String(texto);
  if (t.length <= tope) return t;
  return `${t.slice(0, tope)}\n… RECORTADO: faltan ${t.length - tope} caracteres. Entero: node scripts/equipo/latido.mjs`;
}

/**
 * @param {{pasada:{estado:'ok'|'tiempo'|'fallo', salida?:string, motivo?:string, segundos:number},
 *          locales?:{texto?:string, motivo?:string}, atraso?:number, rastro?:boolean}} e
 */
export function contextoDe({ pasada, locales, atraso, rastro = true, plazo = SEGUNDOS }) {
  const out = [];
  const arbol = Number.isFinite(atraso)
    ? (atraso > 0 ? ` · ⚠️ este árbol va ${atraso} commit(s) por detrás de origin/main (sin fetch: como mínimo)` : '')
    : ' · ⚠️ no pude medir cuánto va este árbol por detrás de origin/main';
  if (pasada.estado === 'ok') {
    out.push(`${CAB} · pasada completa en ${pasada.segundos} s, sin que nadie la pidiera${arbol}`, '', pasada.salida.trim());
  } else {
    const por = pasada.estado === 'tiempo'
      ? `la pasada completa no cupo en ${plazo} s (medido el 1-oct, tres pasadas: 30, 62 y 245 s)`
      : `la pasada completa falló: ${pasada.motivo || 'sin motivo'}`;
    out.push(
      `${CAB} · 🔴 PR, MAIN y DESPLIEGUE: NO PUDE MIRAR — ${por}${arbol}`,
      '   Esto NO quiere decir que no haya PR en rojo. Córrela tú antes de repartir: node scripts/equipo/latido.mjs',
      '',
    );
    if (locales && locales.texto) out.push('Lo que SÍ se pudo leer, del registro local (sin cruzar con los PR; TRASPASO y CONTEXTO no mirados):', locales.texto.trim());
    else out.push(`🔴 Y las secciones locales TAMPOCO: ${(locales && locales.motivo) || 'sin motivo'}. No sabes nada del equipo hasta que lo corras.`);
  }
  if (!rastro) out.push('', '⚠️ No pude escribir el rastro de esta pasada: `latido-arranque.mjs corrio` no la contará.');
  return recortar(out.join('\n'));
}

// ───────────────────────────── lo que toca el mundo ─────────────────────────────

/** El plazo se puede ACORTAR con YAQU_LATIDO_SEGUNDOS, nunca alargar: por encima está el corte del arnés. */
export function plazoDe(env = {}) {
  const n = Number(env.YAQU_LATIDO_SEGUNDOS);
  return Number.isFinite(n) && n > 0 && n < SEGUNDOS ? n : SEGUNDOS;
}

function pasadaCompleta(plazo) {
  const t0 = Date.now();
  if (!fs.existsSync(LATIDO)) return { estado: 'fallo', motivo: 'este árbol no tiene scripts/equipo/latido.mjs (¿checkout antiguo?)', segundos: 0 };
  const r = spawnSync(process.execPath, [LATIDO], { cwd: RAIZ, encoding: 'utf8', timeout: plazo * 1000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  const segundos = Math.round((Date.now() - t0) / 1000);
  if (r.error && r.error.code === 'ETIMEDOUT') return { estado: 'tiempo', segundos };
  if (r.error) return { estado: 'fallo', motivo: String(r.error.code || r.error.message), segundos };
  // 0, 1 y 2 son los tres veredictos del latido (el 2 ya dice él mismo qué no pudo mirar).
  if (![0, 1, 2].includes(r.status) || !String(r.stdout || '').trim()) {
    return { estado: 'fallo', motivo: `salió ${r.status} · ${String(r.stderr || '').trim().split('\n').slice(-2).join(' ').slice(0, 300) || 'sin stderr'}`, segundos };
  }
  return { estado: 'ok', salida: r.stdout, segundos };
}

async function seccionesLocales() {
  try {
    const m = await import(pathToFileURL(LATIDO).href);
    const ahora = Date.now();
    const t = m.leerTrabajos();
    const sesiones = t && t.sesiones;
    const ilegibles = t ? t.ilegibles : [];
    const libro = m.leerLibro();
    // El libro se LEE y se pone al día en memoria, pero no se guarda: guardar es de la pasada completa.
    const alDia = sesiones && libro !== undefined ? m.actualizarLibro(libro || {}, sesiones) : libro;
    const secciones = [
      m.seccionSesiones({ sesiones, filasPR: null, ilegibles, ahora }),
      m.seccionCementerio({ sesiones, ilegibles, sinEstado: t ? t.sinEstado : [], libro: alDia, ahora }),
    ];
    return { texto: m.informe(secciones, { ahora }) };
  } catch (e) {
    return { motivo: String((e && e.message) || e).slice(0, 300) };
  }
}

function atrasoDelArbol() {
  const r = spawnSync('git', ['-C', RAIZ, 'rev-list', '--count', 'HEAD..origin/main'], { encoding: 'utf8', timeout: 15000, windowsHide: true });
  const n = Number(String(r.stdout || '').trim());
  return r.status === 0 && Number.isFinite(n) ? n : undefined;
}

export function rutaDelRastro() {
  const base = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'yaqu-equipo') : path.join(os.homedir(), '.yaqu-equipo');
  return path.join(base, 'latido-arranque.log');
}

function apuntar(fila, ruta = rutaDelRastro()) {
  try { fs.mkdirSync(path.dirname(ruta), { recursive: true }); fs.appendFileSync(ruta, `${JSON.stringify(fila)}\n`); return true; } catch { return false; }
}

/** @returns {{codigo:number, texto:string}} 0 = corrió hace poco · 1 = rastro viejo · 2 = no hay rastro que leer */
export function corrio({ ruta = rutaDelRastro(), ahora = Date.now() } = {}) {
  let lineas;
  try { lineas = fs.readFileSync(ruta, 'utf8').split('\n').filter(Boolean); } catch { lineas = null; }
  if (!lineas || lineas.length === 0) {
    return { codigo: 2, texto: `🔴 NO HAY RASTRO en ${ruta}: el hook de arranque no ha corrido NUNCA en esta máquina (o no pudo escribir). Escrito no es corriendo.` };
  }
  let u; try { u = JSON.parse(lineas[lineas.length - 1]); } catch { u = null; }
  const t = u && Date.parse(u.cuando);
  if (!Number.isFinite(t)) return { codigo: 2, texto: `🔴 El último rastro de ${ruta} no se deja leer.` };
  const horas = (ahora - t) / 36e5;
  const fila = `${lineas.length} pasada(s) apuntadas · la última: ${u.cuando} · sesión «${u.sesion || 'sin nombre'}» (${u.source || '?'}) · ${u.resultado} en ${u.segundos} s`;
  if (horas > HORAS_DE_RASTRO) return { codigo: 1, texto: `🔴 ${fila} · hace ${horas.toFixed(1)} h: más de ${HORAS_DE_RASTRO} h sin correr. ¿Sigue enganchado en la carpeta desde la que arranca el orquestador?` };
  return { codigo: 0, texto: `✅ ${fila} · hace ${horas < 1 ? `${Math.round(horas * 60)} min` : `${horas.toFixed(1)} h`}` };
}

async function hook(crudo) {
  let s = {};
  try { s = JSON.parse(String(crudo || '{}').replace(/^﻿/, '')); } catch { /* sin datos: se trata como sesión sin nombre */ }
  const titulo = typeof s.session_title === 'string' ? s.session_title : '';
  const d = decidir({ titulo, env: process.env });
  if (!d.correr) return null;
  const plazo = plazoDe(process.env);
  const pasada = pasadaCompleta(plazo);
  const locales = pasada.estado === 'ok' ? undefined : await seccionesLocales();
  const rastro = apuntar({ cuando: new Date().toISOString(), sesion: titulo, source: s.source, resultado: pasada.estado, segundos: pasada.segundos });
  return contextoDe({ pasada, locales, atraso: atrasoDelArbol(), rastro, plazo });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'corrio') {
    const r = corrio();
    console.log(r.texto);
    process.exit(r.codigo);
  }
  let d = '';
  process.stdin.on('data', (c) => { d += c; });
  process.stdin.on('end', async () => {
    let contexto;
    try { contexto = await hook(d); } catch (e) {
      contexto = `${CAB} · 🔴 NO PUDE MIRAR: el propio hook falló (${String((e && e.message) || e).slice(0, 200)}). Esto NO es «nada que atender»: node scripts/equipo/latido.mjs`;
    }
    if (contexto) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: contexto } }));
    process.exit(0);
  });
}
