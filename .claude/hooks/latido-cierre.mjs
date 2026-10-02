#!/usr/bin/env node
// SCRUM-1356 · EL CIERRE, EXIGIDO (Stop)
//
// «Empujar no es entregar: antes de cerrar, mira el check obligatorio de tu último push» (A10) era una
// frase que la sesión tenía que ACORDARSE de cumplir con `latido.mjs cierre`. Aquí deja de depender de
// acordarse: cuando una sesión va a parar, este hook mira el obligatorio de CADA rama que esa sesión ha
// empujado y, si alguna no está en verde, se lo pone delante.
//
// QUÉ RAMAS. Las que salen de los `git push` del transcript de la PROPIA sesión, no de su carpeta ni de
// su registro. Medido el 1-oct-2026:
//   · las sesiones trabajan con `git -C` desde un checkout compartido: el HEAD de su carpeta es de otro;
//   · `children` del state.json trae los PR que la sesión ha CITADO (el #1681 sale en cuatro sesiones
//     que no lo abrieron), no los que ha empujado.
//
// LO QUE NO PUEDE HACER, a propósito:
//   · PARAR A NADIE DOS VECES POR LO MISMO. Avisa UNA vez por estado (ramas + commits + veredictos); si
//     la sesión vuelve a parar sin que nada cambie, pasa. Y con `stop_hook_active` pasa siempre.
//   · BLOQUEAR EN SILENCIO. Cada aviso lleva su población y su motivo. Si no pudo mirar, lo DICE una vez
//     («no pude mirar» no es verde) y deja pasar. Si falla él mismo, sale 0 con un aviso al usuario.
//   · VIGILAR DESPUÉS. Un «todavía no» que sale rojo con la sesión ya parada no lo ve este hook: lo ve la
//     sección SESIONES del latido, desde el lado de quien reparte.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO = 'lwislg99/cobroflash-backend';
/** El MISMO literal que `OBLIGATORIO_POR_DEFECTO` de scripts/equipo/latido.mjs (lo ata el test de SCRUM-1356). */
export const OBLIGATORIO = 'build + tests';
/** Plazo total de la medición. El `timeout` del hook en settings.json tiene que ser MAYOR que esto. */
export const SEGUNDOS = 40;

const CAB = 'CIERRE (hook de Stop, SCRUM-1356)';
const NO_ES_RAMA = new Set(['main', 'master', 'HEAD']);

/**
 * Las ramas que una sesión ha empujado, sacadas de los `tool_use` de su transcript (.jsonl).
 * Entiende `git push origin HEAD:<rama>` y `git push [-u] origin <rama>`, con o sin `git -C <ruta>`.
 * Un `git push` SIN nombre de rama, o con la rama en una variable (`HEAD:$rama`), no deja rastro
 * atribuible: no se inventa.
 */
export function ramasEmpujadas(jsonl) {
  const ramas = new Set();
  for (const linea of String(jsonl || '').split('\n')) {
    if (!linea.includes('push') || !linea.includes('"tool_use"')) continue;
    let o; try { o = JSON.parse(linea); } catch { continue; }
    for (const c of (o && o.message && Array.isArray(o.message.content) ? o.message.content : [])) {
      if (!c || c.type !== 'tool_use' || !c.input || typeof c.input.command !== 'string') continue;
      // `origin <rama>` u `origin <origen>:<rama>` (HEAD:rama, +HEAD:rama, rama:rama): cuenta el DESTINO.
      const re = /\bgit\b[^\n;|&]*?\bpush\b[^\n;|&]*?\borigin\s+(?:\+?[\w./-]*:)?(?:refs\/heads\/)?([A-Za-z0-9][\w./-]*)/g;
      for (const m of c.input.command.matchAll(re)) {
        const rama = m[1].replace(/[.,'")]+$/, '');
        if (rama && !NO_ES_RAMA.has(rama)) ramas.add(rama);
      }
    }
  }
  return [...ramas];
}

/**
 * @param {{rama:string, remoto:string|null|undefined, local:string|null|undefined, runs:object[]|undefined}} e
 *   `remoto`: sha en origin · `null` = la rama ya no está · `undefined` = no se pudo mirar.
 * @returns {{rama:string, estado:'VERDE'|'ROJO'|'TODAVIA-NO'|'SIN-EMPUJAR'|'FUERA'|'CIEGO', linea:string, sha?:string}}
 */
export function veredictoDeRama({ rama, remoto, local, runs }) {
  if (remoto === undefined) return { rama, estado: 'CIEGO', linea: `🔴 ${rama}: NO PUDE MIRAR si está en origin` };
  if (remoto === null) return { rama, estado: 'FUERA', linea: `· ${rama}: ya no está en origin (mergeada y borrada, o borrada): no la mido` };
  const sha = remoto.slice(0, 8);
  if (local && local !== remoto) {
    return { rama, estado: 'SIN-EMPUJAR', sha, linea: `🔴 ${rama}: la rama local (${local.slice(0, 8)}) NO es lo empujado (${sha}). El CI no ha visto tu último commit: empuja o dilo.` };
  }
  if (!Array.isArray(runs)) return { rama, estado: 'CIEGO', sha, linea: `🔴 ${rama} ${sha}: NO PUDE MIRAR sus checks` };
  const run = runs.filter((r) => String(r.name || '').startsWith(OBLIGATORIO))
    .sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')))[0];
  if (!run) return { rama, estado: 'TODAVIA-NO', sha, linea: `🟡 ${rama} ${sha}: el obligatorio NO ha arrancado (${runs.length} checks en total). No es verde: es «todavía no».` };
  if (run.status !== 'completed') return { rama, estado: 'TODAVIA-NO', sha, linea: `🟡 ${rama} ${sha}: obligatorio ${run.status}. No es verde: es «todavía no».` };
  if (run.conclusion === 'success') return { rama, estado: 'VERDE', sha, linea: `✅ ${rama} ${sha}: obligatorio VERDE` };
  return { rama, estado: 'ROJO', sha, linea: `🔴 ${rama} ${sha}: obligatorio ${String(run.conclusion).toUpperCase()}` };
}

const PENDIENTE = new Set(['ROJO', 'TODAVIA-NO', 'SIN-EMPUJAR', 'CIEGO']);

/**
 * @param {{activo:boolean, veredictos?:object[], ciego?:string, dicho?:string|null}} e
 *   `ciego`: motivo por el que no se pudo medir NADA. `dicho`: la clave del último aviso dado a esta sesión.
 * @returns {{bloquear:boolean, clave:string|null, razon?:string}}
 */
export function decidirCierre({ activo, veredictos = [], ciego, dicho = null }) {
  if (activo) return { bloquear: false, clave: null };
  const cola = 'Esto NO te impide parar: se dice UNA vez por estado, y si vuelves a parar sin que nada cambie, paso. Antes de parar, dilo en tu mensaje (verde, rojo o todavía no) o arréglalo. Empujar no es entregar (A10).';
  if (ciego) {
    const clave = `CIEGO:${ciego}`;
    if (clave === dicho) return { bloquear: false, clave };
    return { bloquear: true, clave, razon: `${CAB} · 🔴 NO PUDE MIRAR el obligatorio de tus ramas: ${ciego}.\n«No pude mirar» no es verde. ${cola}` };
  }
  const pendientes = veredictos.filter((v) => PENDIENTE.has(v.estado));
  if (pendientes.length === 0) return { bloquear: false, clave: null };
  const clave = veredictos.map((v) => `${v.rama}@${v.sha || '-'}=${v.estado}`).sort().join('|');
  if (clave === dicho) return { bloquear: false, clave };
  const razon = [
    `${CAB} · ${veredictos.length} rama(s) empujadas por esta sesión, leídas de su transcript · ${pendientes.length} sin verde:`,
    ...veredictos.map((v) => `   ${v.linea}`),
    cola,
  ].join('\n');
  return { bloquear: true, clave, razon };
}

// ───────────────────────────── lo que toca el mundo ─────────────────────────────

const intentar = (f) => { try { return f(); } catch { return undefined; } };

function ghDe() {
  const cand = process.platform === 'win32' ? ['C:\\Program Files\\GitHub CLI\\gh.exe', 'gh'] : ['gh'];
  return cand.find((c) => c === 'gh' || fs.existsSync(c));
}
const correr = (bin, args) => execFileSync(bin, args, { cwd: RAIZ, encoding: 'utf8', timeout: 15000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

function transcriptDe(s) {
  if (typeof s.transcript_path === 'string' && fs.existsSync(s.transcript_path)) return s.transcript_path;
  if (!s.session_id) return undefined;
  const proyectos = path.join(os.homedir(), '.claude', 'projects');
  for (const d of intentar(() => fs.readdirSync(proyectos)) || []) {
    const r = path.join(proyectos, d, `${s.session_id}.jsonl`);
    if (fs.existsSync(r)) return r;
  }
  return undefined;
}

function medir(ramas, limite) {
  // UNA llamada para todas: qué ramas siguen en origin y en qué commit.
  const remotos = intentar(() => correr('git', ['ls-remote', 'origin', ...ramas.map((r) => `refs/heads/${r}`)]));
  const enOrigin = remotos === undefined ? undefined
    : new Map(remotos.split('\n').filter(Boolean).map((l) => { const [sha, ref] = l.split(/\s+/); return [String(ref).replace('refs/heads/', ''), sha]; }));
  return ramas.map((rama) => {
    if (!enOrigin) return veredictoDeRama({ rama, remoto: undefined });
    const remoto = enOrigin.get(rama) ?? null;
    if (remoto === null) return veredictoDeRama({ rama, remoto });
    if (Date.now() > limite) return { rama, estado: 'CIEGO', sha: remoto.slice(0, 8), linea: `🔴 ${rama} ${remoto.slice(0, 8)}: NO PUDE MIRAR, se acabó el plazo de ${SEGUNDOS} s` };
    const local = intentar(() => correr('git', ['rev-parse', '-q', '--verify', `refs/heads/${rama}`]).trim()) || null;
    const runs = intentar(() => JSON.parse(correr(ghDe(), ['api', `repos/${REPO}/commits/${remoto}/check-runs?per_page=100`]).replace(/^\uFEFF/, '')).check_runs);
    return veredictoDeRama({ rama, remoto, local, runs });
  });
}

function rutaDeLoDicho(sesion) {
  return path.join(os.tmpdir(), 'yaqu-latido-cierre', `${String(sesion || 'sin-sesion').replace(/[^\w-]/g, '_')}.json`);
}
function rutaDelRastro() {
  const base = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'yaqu-equipo') : path.join(os.homedir(), '.yaqu-equipo');
  return path.join(base, 'latido-cierre.log');
}
function apuntar(fila) {
  intentar(() => {
    const ruta = rutaDelRastro();
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    // Corre en CADA parada de CADA sesión: al pasar de 1 MB se queda con la mitad más nueva.
    if (fs.existsSync(ruta) && fs.statSync(ruta).size > 1024 * 1024) {
      const l = fs.readFileSync(ruta, 'utf8').split('\n');
      fs.writeFileSync(ruta, l.slice(Math.floor(l.length / 2)).join('\n'));
    }
    fs.appendFileSync(ruta, `${JSON.stringify(fila)}\n`);
  });
}

function hook(crudo) {
  let s = {};
  // Una entrada que no se deja leer NO se trata como «sin ramas»: cae abajo en «no pude mirar».
  try { s = JSON.parse(String(crudo || '{}').replace(/^﻿/, '')); } catch { /* se dice abajo */ }
  if (s.stop_hook_active) return null;
  const ruta = rutaDeLoDicho(s.session_id);
  const dicho = intentar(() => JSON.parse(fs.readFileSync(ruta, 'utf8')).clave) ?? null;
  let d;
  const transcript = transcriptDe(s);
  const texto = transcript === undefined ? undefined : intentar(() => fs.readFileSync(transcript, 'utf8'));
  let ramas = [];
  if (texto === undefined) {
    d = decidirCierre({ activo: false, ciego: 'no encuentro o no puedo leer el transcript de esta sesión, así que no sé qué ramas has empujado', dicho });
  } else {
    ramas = ramasEmpujadas(texto);
    d = ramas.length === 0 ? { bloquear: false, clave: null } : decidirCierre({ activo: false, veredictos: medir(ramas, Date.now() + SEGUNDOS * 1000), dicho });
  }
  if (d.clave) intentar(() => { fs.mkdirSync(path.dirname(ruta), { recursive: true }); fs.writeFileSync(ruta, JSON.stringify({ clave: d.clave, cuando: new Date().toISOString() })); });
  apuntar({ cuando: new Date().toISOString(), sesion: s.session_id, ramas: ramas.length, aviso: d.bloquear, clave: d.clave });
  return d.bloquear ? { decision: 'block', reason: d.razon } : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let d = '';
  process.stdin.on('data', (c) => { d += c; });
  process.stdin.on('end', () => {
    let salida;
    try { salida = hook(d); } catch (e) {
      // Un fallo del hook NO para a nadie: se le dice al usuario y se deja pasar.
      salida = { systemMessage: `${CAB} · el hook falló y NO ha medido nada (${String((e && e.message) || e).slice(0, 200)}). No es un verde.` };
    }
    if (salida) process.stdout.write(JSON.stringify(salida));
    process.exit(0);
  });
}
