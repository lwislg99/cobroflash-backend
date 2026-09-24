// scripts/equipo/instalar.mjs — SCRUM-899 · prepara la instalación del equipo de fondo (una vez)
//
//   node scripts/equipo/instalar.mjs --destino <carpeta> --repo <checkout> --claude <ruta de claude.exe>
//        (--prefijo <p> | --sin-prefijo) --puestos <a,b,…> --orquestador <puesto>
//        --tandas <HH:MM,…> --prompt <ruta del prompt en el repo> [--traspasos <carpeta>]
//
// Hace CUATRO cosas y ninguna más:
//   1 · crea <destino> con `config.json`: el repositorio, el binario de Claude y el EQUIPO (prefijo,
//       puestos, orquestador, tandas, prompt y la carpeta de los traspasos);
//   2 · copia a <destino>, desde `origin/main` del repositorio, los scripts y el prompt, para que la
//       instalación sirva desde el primer minuto (el statusLine del aviso de uso, sobre todo);
//   3 · escribe <destino>/arranque.cmd, que en CADA tanda vuelve a copiarlos desde `origin/main` y
//       lanza `orquestador-arranque.mjs`. Así una copia vieja o tocada nunca llega a actuar;
//   4 · IMPRIME las órdenes de `schtasks` para las tandas y la línea del statusLine. NO las ejecuta:
//       crear tareas programadas y tocar settings lo hace quien manda en esa máquina.
//
// SCRUM-951a · NADA DE ESTE FICHERO ESTÁ ATADO A UNA MÁQUINA NI A UN EQUIPO. Los nombres de sesión,
// las horas y las rutas llegan por argumento; los valores del equipo de Luis están en la guía
// (`docs/equipo/instalacion-orquestador-autonomo.md`), no aquí. El prefijo se DECLARA siempre —
// `--sin-prefijo` para el equipo que no lo lleva—: un prefijo olvidado no puede pasar por vacío.
//
// Todo se valida y se lee ANTES de escribir nada: si algo falla, no queda una instalación a medias.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validarEquipo } from './sesion.mjs';

/** Lo que se copia desde `origin/main` en cada tanda (el prompt va aparte: su ruta es del config). */
export const FICHEROS = [
  ['scripts/equipo/sesion.mjs', 'sesion.mjs'],
  ['scripts/equipo/orquestador-arranque.mjs', 'orquestador-arranque.mjs'],
  ['scripts/equipo/uso.mjs', 'uso.mjs'],
];
export const PROMPT_INSTALADO = 'prompt-tanda.md';
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const aWin = (p) => p.replace(/\//g, '\\');

/** Todo lo que `arranque.cmd` copia: los scripts fijos y el prompt que diga el config. */
export function copias(prompt) {
  return [...FICHEROS, [prompt, PROMPT_INSTALADO]];
}

/**
 * La carpeta de memoria que Claude Code usa para un repositorio: `<proyectos>/<ruta>/memory`, donde
 * la ruta lleva cada carácter que no es letra ni número cambiado por `-`. Medido el 18-sep-2026 en
 * `~/.claude/projects` (`D:\MILLONARIO\…\.claude\worktrees\x` → `D--MILLONARIO-…--claude-worktrees-x`).
 * Ahí escribe cada sesión su `project_*_traspaso.md`, que es lo que `relevar` necesita leer.
 */
export function carpetaDeMemoria(repo, proyectos) {
  return path.join(proyectos, String(repo).replace(/[^A-Za-z0-9]/g, '-'), 'memory');
}

/** El `.cmd` de cada tanda. Puro, para poder fijarlo en un test sin ejecutar cmd. */
export function arranqueCmd({ destino, repo, prompt }) {
  const d = aWin(destino).replace(/\\$/, '');
  const r = aWin(repo);
  return [
    '@echo off',
    'setlocal',
    // La tarea programada arranca en System32: sin esto, el orquestador nacería FUERA del proyecto (sin
    // sus settings ni su CLAUDE.md, y con el diálogo de confianza de carpeta, que en segundo plano bloquea).
    `cd /d "${r}"`,
    `git -C "${r}" fetch --quiet origin main`,
    ...copias(prompt).map(([enRepo, instalado]) => `git -C "${r}" show origin/main:${enRepo} > "${d}\\${instalado}"`),
    `node "${d}\\orquestador-arranque.mjs" >> "${d}\\arranque.log" 2>&1`,
    '',
  ].join('\r\n');
}

/** Las órdenes para crear las tareas, una por hora (schtasks admite un disparador por orden). */
export function ordenesSchtasks({ destino, tandas, prefijo }) {
  const cmd = `${aWin(destino).replace(/\\$/, '')}\\arranque.cmd`;
  return tandas.map((hora) =>
    `MSYS_NO_PATHCONV=1 schtasks /create /sc daily /tn yaqu-equipo-${prefijo}${hora.replace(':', '')} /st ${hora} /tr "${cmd}"`);
}

/** La línea del statusLine para `~/.claude/settings.json` (la pone quien manda en la máquina). */
export function lineaStatusLine(destino) {
  const uso = `${destino.replace(/\\/g, '/').replace(/\/$/, '')}/uso.mjs`;
  // SCRUM-953: sin comillas, un usuario de Windows con espacio (`C:/Users/Javier Pereira/…`) corta
  // la orden en el espacio y el aviso de uso no arranca nunca, sin error visible en ningún sitio.
  return { statusLine: { type: 'command', command: `node "${uso}" escribir` } };
}

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function fallar(motivo) {
  process.stdout.write(JSON.stringify({ veredicto: 'NO-INSTALADO', motivo }, null, 2) + '\n');
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destino = argumento('--destino');
  const repo = argumento('--repo');
  const claude = argumento('--claude');
  const prompt = argumento('--prompt');
  const orquestador = argumento('--orquestador');
  const puestos = (argumento('--puestos') || '').split(',').filter(Boolean);
  const tandas = (argumento('--tandas') || '').split(',').filter(Boolean);
  const conPrefijo = process.argv.includes('--prefijo');
  const sinPrefijo = process.argv.includes('--sin-prefijo');

  if (!destino || !repo || !claude || !prompt) fallar('faltan --destino, --repo, --claude o --prompt');
  // `--prefijo ""` no sirve: PowerShell 5.1 se come los argumentos vacíos. Por eso existe --sin-prefijo.
  if (conPrefijo === sinPrefijo) fallar('declara el prefijo: --prefijo <p> o --sin-prefijo (uno de los dos)');
  const prefijo = conPrefijo ? argumento('--prefijo') : '';
  if (conPrefijo && !prefijo) fallar('--prefijo sin valor: para un equipo sin prefijo, --sin-prefijo');
  const e = validarEquipo({ prefijo, puestos, orquestador });
  if (!e.ok) fallar(e.motivo);
  if (tandas.length === 0 || !tandas.every((h) => HORA.test(h))) fallar('--tandas: una o más horas HH:MM separadas por comas');

  const traspasos = argumento('--traspasos') || carpetaDeMemoria(repo, path.join(os.homedir(), '.claude', 'projects'));
  if (!fs.existsSync(traspasos)) {
    fallar(`no existe la carpeta de los traspasos: ${traspasos}. Abre Claude Code una vez en el repositorio `
      + 'para que la cree, o pásala con --traspasos');
  }

  // Se lee TODO antes de escribir nada.
  const contenidos = [];
  for (const [enRepo, instalado] of copias(prompt)) {
    const r = spawnSync('git', ['-C', repo, 'show', `origin/main:${enRepo}`], { maxBuffer: 16 * 1024 * 1024 });
    if (r.error || r.status !== 0) fallar(`no se pudo leer origin/main:${enRepo} en ${repo}`);
    contenidos.push([instalado, r.stdout]);
  }

  const config = { repo, claude, prefijo, puestos, orquestador, tandas, prompt, traspasos };
  fs.mkdirSync(destino, { recursive: true });
  for (const [instalado, contenido] of contenidos) fs.writeFileSync(path.join(destino, instalado), contenido);
  fs.writeFileSync(path.join(destino, 'arranque.cmd'), arranqueCmd({ destino, repo, prompt }));
  fs.writeFileSync(path.join(destino, 'config.json'), JSON.stringify(config, null, 2));
  process.stdout.write(JSON.stringify({
    veredicto: 'INSTALADO',
    destino,
    config,
    schtasks: ordenesSchtasks({ destino, tandas, prefijo }),
    settings: lineaStatusLine(destino),
  }, null, 2) + '\n');
}
