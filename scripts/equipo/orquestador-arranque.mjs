// scripts/equipo/orquestador-arranque.mjs — SCRUM-899 · lo que corre en cada tanda programada
//
// Lo lanza `arranque.cmd` (generado por `instalar.mjs`), que antes ha copiado desde `origin/main`
// este fichero, `sesion.mjs` y el prompt de la tanda. Aquí solo se decide si esas copias pueden
// actuar y se delega en `sesion.mjs`, que es la única puerta para lanzar sesiones.
//
// Falla CERRADO, en este orden:
//   1 · no corre desde un árbol de git, y hay `config.json` con el repositorio;
//   2 · este fichero y `sesion.mjs` son IDÉNTICOS a los de `origin/main`;
//   3 · el prompt de la tanda existe y no está vacío. El prompt es del ORQUESTADOR
//       (`docs/equipo/prompt-tanda-orquestador.md`); este script no lo escribe ni lo inventa.
//
// 🔴 NO SE IMPORTA `sesion.mjs` para reutilizar su puerta: importar EJECUTA el módulo, así que una
// copia alterada correría código antes de que nadie la comprobara. Se compara por bytes y se lanza
// como proceso aparte, donde vuelve a pasar su propia puerta.
//
// ⚠️ LO QUE NO RESUELVE: si el orquestador de fondo ya está VIVO y parado, `sesion.mjs` contesta
// `YA-VIVA` y no se le despierta — reanudar una sesión viva arranca una COPIA (CLI 2.1.263). Para
// eso está el cron DENTRO de su propia sesión; esta tarea es la que lo resucita si no existe.
//
// SCRUM-999 · ANTES de llamar a `sesion.mjs lanzar` se pregunta a `uso.mjs leer` si queda cuota:
// `decidirLanzar` (sesion.mjs) sólo mira si hay algo VIVO en el repo, nunca la cuota de la cuenta,
// y una tanda programada disparaba igual con la ventana de 5 h agotada. Fail-closed, como el resto
// de la puerta: sólo VERDE deja lanzar; AVISO y NO_PUDE_MIRAR paran con veredicto `SIN-CUOTA` y
// quedan en `arranque.log` para que la tanda siguiente lo intente — esta tarea no reintenta sola.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PROMPT_INSTALADO = 'prompt-tanda.md';
export const COMPROBADOS = [
  ['orquestador-arranque.mjs', 'scripts/equipo/orquestador-arranque.mjs'],
  ['sesion.mjs', 'scripts/equipo/sesion.mjs'],
  ['uso.mjs', 'scripts/equipo/uso.mjs'],
];

function gitReal(cwd, args, binario = false) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: binario ? 'buffer' : 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return { status: r.error ? null : r.status, stdout: r.stdout };
}

/** @returns {{ok:true} | {ok:false, veredicto:string, motivo:string}} */
export function puertas({ dir, git = gitReal }) {
  const dentro = git(dir, ['rev-parse', '--is-inside-work-tree']);
  if (dentro.status === 0 && String(dentro.stdout).trim() === 'true') {
    return { ok: false, veredicto: 'DESDE-UN-ARBOL', motivo: `${dir} está dentro de un árbol de git: solo actúa la copia instalada` };
  }
  let config;
  try { config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')); } catch { config = null; }
  if (!config || typeof config.repo !== 'string' || !config.repo) {
    return { ok: false, veredicto: 'NO-PUDE-MIRAR', motivo: 'no hay config.json con la ruta del repositorio' };
  }
  // SCRUM-951a: a quién se lanza sale del config (prefijo + puesto del orquestador), no del código.
  // Aquí solo se comprueba que ESTÁ; la validación entera la repite `sesion.mjs` en su puerta.
  if (typeof config.prefijo !== 'string' || typeof config.orquestador !== 'string' || !config.orquestador) {
    return { ok: false, veredicto: 'NO-PUDE-MIRAR', motivo: 'config.json no declara `prefijo` y `orquestador`' };
  }
  for (const [instalado, enRepo] of COMPROBADOS) {
    const main = git(config.repo, ['show', `origin/main:${enRepo}`], true);
    if (main.status !== 0) return { ok: false, veredicto: 'NO-PUDE-MIRAR', motivo: `no se pudo leer origin/main:${enRepo}` };
    let local;
    try { local = fs.readFileSync(path.join(dir, instalado)); } catch {
      return { ok: false, veredicto: 'NO-PUDE-MIRAR', motivo: `falta ${instalado} en la instalación` };
    }
    if (!Buffer.from(main.stdout).equals(local)) {
      return { ok: false, veredicto: 'ALTERADO', motivo: `${instalado} no es idéntico a origin/main:${enRepo}` };
    }
  }
  let texto = '';
  try { texto = fs.readFileSync(path.join(dir, PROMPT_INSTALADO), 'utf8'); } catch { /* se dice abajo */ }
  if (!texto.trim()) return { ok: false, veredicto: 'NO-PUDE-MIRAR', motivo: `el prompt de la tanda (${PROMPT_INSTALADO}) falta o está vacío` };
  return { ok: true, nombre: `${config.prefijo}${config.orquestador}` };
}

/**
 * ¿Queda cuota para lanzar? Se pregunta a la copia de `uso.mjs` que `puertas` ya verificó
 * byte a byte contra `origin/main`, como proceso aparte — igual que con `sesion.mjs lanzar`:
 * nunca se importa un fichero cuya integridad decide otro código (ver cabecera). Sólo VERDE deja
 * lanzar: AVISO y NO_PUDE_MIRAR son fail-closed (SCRUM-999) — un arranque que no puede ni
 * preguntar la cuota no es un arranque seguro.
 * @returns {{veredicto:string, motivo?:string, [k:string]:*}}
 */
export function veredictoDeUso({ dir, ejecutar = spawnSync }) {
  const r = ejecutar(process.execPath, [path.join(dir, 'uso.mjs'), 'leer'], { encoding: 'utf8' });
  const ultima = (r.stdout || '').trim().split('\n').at(-1) || '';
  let v;
  try { v = JSON.parse(ultima); } catch { v = null; }
  if (!v || typeof v.veredicto !== 'string') {
    return { veredicto: 'NO_PUDE_MIRAR', motivo: 'uso.mjs no devolvió veredicto', salida: ultima.slice(-300) };
  }
  return v;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const cuando = new Date().toISOString();
  const p = puertas({ dir });
  if (!p.ok) {
    process.stdout.write(JSON.stringify({ cuando, ...p }) + '\n');
    process.exit(2);
  }
  const uso = veredictoDeUso({ dir });
  if (uso.veredicto !== 'VERDE') {
    process.stdout.write(JSON.stringify({ cuando, veredicto: 'SIN-CUOTA', motivo: uso.motivo || `uso.mjs dio ${uso.veredicto}`, uso }) + '\n');
    process.exit(1);
  }
  const r = spawnSync(process.execPath, [path.join(dir, 'sesion.mjs'), 'lanzar', p.nombre, path.join(dir, PROMPT_INSTALADO)], { encoding: 'utf8' });
  const ultima = (r.stdout || '').trim().split('\n').at(-1) || '';
  let veredicto;
  try { veredicto = JSON.parse(ultima); } catch { veredicto = { veredicto: 'NO-PUDE-MIRAR', motivo: 'sesion.mjs no devolvió veredicto', salida: ultima.slice(-300) }; }
  process.stdout.write(JSON.stringify({ cuando, tanda: veredicto }) + '\n');
  process.exit(r.status === null ? 2 : r.status);
}
