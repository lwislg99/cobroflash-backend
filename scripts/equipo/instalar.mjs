// scripts/equipo/instalar.mjs — SCRUM-899 · prepara la instalación del equipo de fondo (una vez)
//
//   node scripts/equipo/instalar.mjs --destino <carpeta> --repo <checkout del fundador> --claude <ruta de claude.exe>
//
// Hace TRES cosas y ninguna más:
//   1 · crea <destino> con `config.json` ({ repo, claude });
//   2 · escribe <destino>/arranque.cmd, que en CADA tanda copia desde `origin/main` los scripts y el
//       prompt, y lanza `orquestador-arranque.mjs`. Así una copia vieja o tocada nunca llega a actuar;
//   3 · IMPRIME las órdenes de `schtasks` para las tandas. NO las ejecuta: crear tareas programadas
//       lo hace el orquestador con la autorización expresa del fundador.
//
// No hay variables de entorno ni detección de plataforma: todo llega por argumento.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FICHEROS = [
  ['scripts/equipo/sesion.mjs', 'sesion.mjs'],
  ['scripts/equipo/orquestador-arranque.mjs', 'orquestador-arranque.mjs'],
  ['docs/equipo/prompt-tanda-orquestador.md', 'prompt-tanda.md'],
];
/** Horas decididas por el orquestador (17-sep-2026 13:25 CEST). */
export const TANDAS = ['08:00', '13:05', '18:10'];

const aWin = (p) => p.replace(/\//g, '\\');

/** El `.cmd` de cada tanda. Puro, para poder fijarlo en un test sin ejecutar cmd. */
export function arranqueCmd({ destino, repo }) {
  const d = aWin(destino).replace(/\\$/, '');
  const r = aWin(repo);
  return [
    '@echo off',
    'setlocal',
    // La tarea programada arranca en System32: sin esto, el orquestador nacería FUERA del proyecto (sin
    // sus settings ni su CLAUDE.md, y con el diálogo de confianza de carpeta, que en segundo plano bloquea).
    `cd /d "${r}"`,
    `git -C "${r}" fetch --quiet origin main`,
    ...FICHEROS.map(([enRepo, instalado]) => `git -C "${r}" show origin/main:${enRepo} > "${d}\\${instalado}"`),
    `node "${d}\\orquestador-arranque.mjs" >> "${d}\\arranque.log" 2>&1`,
    '',
  ].join('\r\n');
}

/** Las órdenes para crear las tareas, una por hora (schtasks admite un disparador por orden). */
export function ordenesSchtasks({ destino }) {
  const cmd = `${aWin(destino).replace(/\\$/, '')}\\arranque.cmd`;
  return TANDAS.map((hora) =>
    `MSYS_NO_PATHCONV=1 schtasks /create /sc daily /tn yaqu-equipo-${hora.replace(':', '')} /st ${hora} /tr "${cmd}"`);
}

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destino = argumento('--destino');
  const repo = argumento('--repo');
  const claude = argumento('--claude');
  if (!destino || !repo || !claude) {
    console.error('uso: node scripts/equipo/instalar.mjs --destino <carpeta> --repo <checkout> --claude <ruta de claude>');
    process.exit(1);
  }
  fs.mkdirSync(destino, { recursive: true });
  fs.writeFileSync(path.join(destino, 'config.json'), JSON.stringify({ repo, claude }, null, 2));
  fs.writeFileSync(path.join(destino, 'arranque.cmd'), arranqueCmd({ destino, repo }));
  process.stdout.write(JSON.stringify({ veredicto: 'INSTALADO', destino, schtasks: ordenesSchtasks({ destino }) }, null, 2) + '\n');
}
