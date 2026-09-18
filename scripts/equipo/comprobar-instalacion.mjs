// scripts/equipo/comprobar-instalacion.mjs — SCRUM-951a · ¿funciona el equipo de fondo en ESTA máquina?
//
//   node scripts/equipo/comprobar-instalacion.mjs --destino <carpeta de la instalación> [--json]
//
// La lista de verificación del final de la guía (`docs/equipo/instalacion-maquina-nueva.md`), en
// ejecutable: la corre el propio Claude de quien instala para DEMOSTRAR que la instalación actúa, no
// para describirla. Cada comprobación EJECUTA la pieza (la copia instalada de `sesion.mjs`, el aviso
// de uso, el censo de huérfanos, `claude --version`) y dice qué vio.
//
// Veredictos, por comprobación:
//   OK             la pieza respondió como debe;
//   AVISO          no bloquea, pero falta algo que la guía dice cómo hacer (p. ej. las tareas
//                  programadas aún sin crear, o el aviso de uso sin lectura todavía);
//   FALLA          la pieza no funciona;
//   NO-PUDE-MIRAR  no se pudo ni preguntar. NUNCA cuenta como OK.
// Salida: 0 = ninguna FALLA ni NO-PUDE-MIRAR · 1 = alguna FALLA · 2 = alguna NO-PUDE-MIRAR (gana).
//
// Lo que NO comprueba, porque un script no puede: que una sesión lanzada CONTESTE por el canal
// (`SendMessage` no existe fuera de Claude Code). Ese paso lo hace a mano el Claude de la guía.
// Solo lee y pregunta: no crea tareas, no toca settings, no lanza sesiones.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validarEquipo } from './sesion.mjs';
import { copias, arranqueCmd } from './instalar.mjs';

const GH_POR_DEFECTO = 'C:\\Program Files\\GitHub CLI\\gh.exe';

/** El veredicto de toda la lista: NO-PUDE-MIRAR gana a FALLA, y FALLA a todo lo demás. */
export function veredictoGlobal(comprobaciones) {
  if (!Array.isArray(comprobaciones) || comprobaciones.length === 0) return { codigo: 2, veredicto: 'NO-PUDE-MIRAR' };
  if (comprobaciones.some((c) => c.veredicto === 'NO-PUDE-MIRAR')) return { codigo: 2, veredicto: 'NO-PUDE-MIRAR' };
  if (comprobaciones.some((c) => c.veredicto === 'FALLA')) return { codigo: 1, veredicto: 'FALLA' };
  return { codigo: 0, veredicto: 'OK' };
}

function ejecutar(orden, args, opciones = {}) {
  const r = spawnSync(orden, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...opciones });
  return { status: r.error ? null : r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}

function claudeDe(config) {
  return Array.isArray(config.claude) ? config.claude : [config.claude];
}

/** La última línea JSON de una salida, o null. */
function ultimoJson(texto) {
  try { return JSON.parse(String(texto || '').trim().split('\n').at(-1)); } catch { return null; }
}

/** Todas las comprobaciones, en orden. Cada una: `{ id, veredicto, detalle }`. */
export function comprobar({ destino, plataforma = process.platform }) {
  const lista = [];
  const poner = (id, veredicto, detalle) => lista.push({ id, veredicto, detalle });

  // 1 · el config
  let config = null;
  try { config = JSON.parse(fs.readFileSync(path.join(destino, 'config.json'), 'utf8')); } catch { /* abajo */ }
  if (!config) { poner('config', 'NO-PUDE-MIRAR', `no hay config.json legible en ${destino}`); return lista; }
  const e = validarEquipo(config);
  if (!e.ok) { poner('config', 'FALLA', e.motivo); return lista; }
  const faltan = ['repo', 'claude', 'traspasos', 'prompt'].filter((k) => !config[k]);
  if (faltan.length) { poner('config', 'FALLA', `faltan: ${faltan.join(', ')}`); return lista; }
  if (!Array.isArray(config.tandas) || config.tandas.length === 0) { poner('config', 'FALLA', 'sin `tandas`'); return lista; }
  const nombres = e.equipo.puestos.map((p) => e.equipo.prefijo + p);
  poner('config', 'OK', `equipo «${e.equipo.prefijo || '(sin prefijo)'}»: ${nombres.join(', ')} · orquestador ${e.equipo.prefijo}${e.equipo.orquestador}`);

  // 2 · el binario de Claude
  const [orden, ...previos] = claudeDe(config);
  const v = ejecutar(orden, [...previos, '--version']);
  if (v.status === 0 && v.stdout.trim()) poner('claude', 'OK', v.stdout.trim().split('\n')[0]);
  else poner('claude', 'FALLA', `${orden} --version no responde${v.error ? ` (${v.error.code})` : ''}`);

  // 3 · el repositorio y su origin/main
  const main = ejecutar('git', ['-C', config.repo, 'rev-parse', '--verify', 'origin/main']);
  if (main.status !== 0) { poner('repo', 'NO-PUDE-MIRAR', `no se lee origin/main en ${config.repo}`); return lista; }
  poner('repo', 'OK', `origin/main = ${main.stdout.trim()}`);

  // 4 · las copias instaladas, contra origin/main
  for (const [enRepo, instalado] of copias(config.prompt)) {
    const r = spawnSync('git', ['-C', config.repo, 'show', `origin/main:${enRepo}`], { maxBuffer: 16 * 1024 * 1024 });
    const f = path.join(destino, instalado);
    if (r.status !== 0) poner(`copia:${instalado}`, 'FALLA', `origin/main no tiene ${enRepo}`);
    else if (!fs.existsSync(f)) poner(`copia:${instalado}`, 'FALLA', 'no está en la instalación: vuelve a correr el instalador');
    else if (!Buffer.from(r.stdout).equals(fs.readFileSync(f))) {
      poner(`copia:${instalado}`, 'AVISO', 'desfasada respecto a origin/main: la repone la próxima tanda (hasta entonces sesion.mjs se niega)');
    } else poner(`copia:${instalado}`, 'OK', `idéntica a origin/main:${enRepo}`);
  }

  // 5 · arranque.cmd, exactamente el que genera el instalador
  let cmd = null;
  try { cmd = fs.readFileSync(path.join(destino, 'arranque.cmd'), 'utf8'); } catch { /* abajo */ }
  if (cmd === null) poner('arranque.cmd', 'FALLA', 'no existe');
  else if (cmd !== arranqueCmd({ destino, repo: config.repo, prompt: config.prompt })) poner('arranque.cmd', 'FALLA', 'no es el que genera el instalador para este config');
  else poner('arranque.cmd', 'OK', 'entra en el repo, copia desde origin/main y lanza el arranque');

  // 6 · la carpeta de los traspasos
  if (!fs.existsSync(config.traspasos)) poner('traspasos', 'FALLA', `no existe ${config.traspasos}`);
  else {
    const n = fs.readdirSync(config.traspasos).filter((x) => /^project_.*_traspaso\.md$/.test(x)).length;
    poner('traspasos', 'OK', `${config.traspasos} · ${n} traspaso(s) de puesto`);
  }

  // 7 · la copia instalada de sesion.mjs ACTÚA (su puerta de integridad incluida)
  const estado = ejecutar(process.execPath, [path.join(destino, 'sesion.mjs'), 'estado']);
  const ve = ultimoJson(estado.stdout);
  if (estado.status === 0 && ve?.veredicto === 'ESTADO') poner('sesion.mjs estado', 'OK', `${ve.sesiones.length} sesión(es) del equipo vivas`);
  else poner('sesion.mjs estado', 'FALLA', `${ve?.veredicto || 'sin veredicto'}: ${ve?.motivo || estado.stderr.trim().slice(-200)}`);

  // 8 · el aviso de uso
  const uso = ejecutar(process.execPath, [path.join(destino, 'uso.mjs'), 'leer']);
  const vu = ultimoJson(uso.stdout);
  if (uso.status === 0) poner('aviso de uso', 'OK', vu?.motivo || 'VERDE');
  else if (uso.status === 1) poner('aviso de uso', 'OK', `lee y AVISA: ${vu?.motivo || 'uso alto'}`);
  else if (uso.status === 2) poner('aviso de uso', 'AVISO', `sin lectura vigente (${vu?.motivo || 'no pude mirar'}): falta el statusLine o un turno en una sesión interactiva`);
  else poner('aviso de uso', 'FALLA', 'uso.mjs no arrancó');

  // 9 · el censo de huérfanos
  const hu = ejecutar(process.execPath, [path.join(config.repo, 'scripts', 'equipo', 'huerfanos.mjs'), '--repo', config.repo]);
  if (hu.status === 0) poner('huérfanos', 'OK', 'nada que salvar');
  else if (hu.status === 1) poner('huérfanos', 'AVISO', 'hay trabajo sin empujar o sin commitear: léelo con `node scripts/equipo/huerfanos.mjs`');
  else poner('huérfanos', 'FALLA', `el censo no pudo mirar algún worktree (salida ${hu.status})`);

  // 10 · las tareas programadas (solo Windows; solo se CONSULTAN)
  if (plataforma !== 'win32') poner('tareas programadas', 'AVISO', `no es Windows (${plataforma}): no se consultan`);
  else {
    for (const hora of config.tandas) {
      const tn = `yaqu-equipo-${e.equipo.prefijo}${String(hora).replace(':', '')}`;
      const q = ejecutar('schtasks', ['/query', '/tn', tn]);
      poner(`tarea ${tn}`, q.status === 0 ? 'OK' : 'AVISO', q.status === 0 ? 'creada' : 'no está creada (paso de las tareas de la guía)');
    }
  }

  // 11 · gh (lo usan las sesiones para los PR; no lo usa ningún script de aquí)
  const ghPath = ejecutar('gh', ['--version']);
  const ghDef = ghPath.status === 0 ? ghPath : ejecutar(GH_POR_DEFECTO, ['--version']);
  if (ghDef.status === 0) poner('gh', 'OK', `${ghDef.stdout.trim().split('\n')[0]}${ghPath.status === 0 ? '' : ` (fuera del PATH: ${GH_POR_DEFECTO})`}`);
  else poner('gh', 'AVISO', 'no se encuentra gh: las sesiones no podrán abrir ni mirar PR');

  return lista;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--destino');
  const destino = i > 0 ? process.argv[i + 1] : undefined;
  if (!destino) { console.error('uso: node scripts/equipo/comprobar-instalacion.mjs --destino <carpeta>'); process.exit(2); }
  const lista = comprobar({ destino });
  const g = veredictoGlobal(lista);
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ ...g, poblacion: lista.length, comprobaciones: lista }, null, 2) + '\n');
  } else {
    for (const c of lista) process.stdout.write(`${c.veredicto.padEnd(13)} ${c.id} · ${c.detalle}\n`);
    process.stdout.write(`\n${g.veredicto} · ${lista.length} comprobaciones\n`);
  }
  process.exit(g.codigo);
}
