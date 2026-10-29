// SCRUM-1549f · LA PUERTA DEL LANZADOR: ¿la copia INSTALADA de `sesion.mjs` deja lanzar? Lo usa el latido (sección PUERTA).
//
// POR QUÉ EXISTE. `sesion.mjs` sólo actúa desde su copia instalada (`%LOCALAPPDATA%\yaqu-equipo`), y su
// `puertaDeIntegridad` se niega si esa copia no es IDÉNTICA, byte a byte, a `origin/main` — correctamente:
// falla cerrado. Pero cada merge que toca `sesion.mjs` la cierra, y el 29-oct-2026 estuvo cerrada 6 h 38 min
// (10:53:28Z, merge de #2981 → 17:31:43Z) sin que ningún instrumento lo dijera: el equipo pasó de 14 sesiones a
// 0 (SCRUM-1549e). Las 12 veces anteriores la curaba sola la siguiente pasada de `arranque.cmd`; desde el
// 27-oct las tareas programadas están desactivadas y no la refresca nadie.
//
// TRES RESPUESTAS, no dos. Con la puerta, `ALTERADO` y «no pude comprobar» salen con el MISMO código 2 y sin
// decir versión, ni desde cuándo, ni el remedio. Aquí:
//   · AL DÍA      → sección en verde, con el tamaño y el sha256 de la copia;
//   · ALTERADA    → aviso (salida 1): ATRASADA (es la versión de tal commit; cerrada desde el merge que la
//                   cambió) o AJENA (no es ninguna versión de main; si es main con BOM, UTF-16 o CRLF, lo dice),
//                   y la orden exacta de refresco, que se corre desde `cmd`;
//   · NO PUDE     → sección ciega (salida 2): sin instalación, sin `config.json`, o sin poder leer main.
//
// 🔴 EL REMEDIO SE CORRE DESDE `cmd`, NUNCA DESDE POWERSHELL. El `>` de Windows PowerShell 5.1 reescribe la
// salida de `git show` (UTF-16, BOM): la copia sale con OTRO blob y la puerta queda ALTERADA para siempre.
// Medido por la S5 el 29-oct-2026 (SCRUM-1549e). El `>` de `cmd` copia los bytes tal cual: es lo que hace
// `arranque.cmd` (`instalar.mjs`, `arranqueCmd`).
//
// SÓLO LEE BYTES. No importa ni ejecuta la copia instalada (importar EJECUTA el módulo, y una copia alterada
// correría código antes de que nadie la comprobara: lo mismo que razona `orquestador-arranque.mjs`), no escribe en
// la instalación y no refresca nada: da la orden, y la corre quien tiene permiso para escribir ahí.
//
// CONTRA QUÉ. Contra lo mismo que mira la puerta: `origin/main` del repositorio que dice `config.repo`. No contra la
// punta del remoto: la puerta no pregunta al remoto, y lo que importa es lo que ELLA va a contestar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { RUTA_EN_EL_REPO } from './sesion.mjs';

/** El fichero que guarda la puerta del equipo, y su nombre en la instalación. */
export const INSTALADO = 'sesion.mjs';
/** Cuántas versiones de main se recorren buscando cuál es la copia. Más atrás, «es más vieja que esto». */
export const VERSIONES = 40;

const corto = (s) => String(s).slice(0, 9);
const aWin = (p) => String(p).replace(/\//g, '\\');

/** El id que git le daría a estos bytes (`git hash-object`), calculado aquí: en PowerShell la tubería lo cambia. */
export function blobDe(bytes) {
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

/**
 * Si la copia AJENA es main estropeada por el camino, cuál de los tres estropicios. `null` si no es ninguno.
 * @param {Buffer} propio  @param {Buffer} main
 */
export function estropicio(propio, main) {
  if (propio.length >= 2 && propio[0] === 0xff && propio[1] === 0xfe) {
    const texto = propio.subarray(2).toString('utf16le');
    if (Buffer.from(texto, 'utf8').equals(main) || Buffer.from(texto.replace(/\r\n/g, '\n'), 'utf8').equals(main)) return 'UTF-16 con BOM (el `>` de PowerShell)';
  }
  const sinBom = propio.length >= 3 && propio[0] === 0xef && propio[1] === 0xbb && propio[2] === 0xbf ? propio.subarray(3) : null;
  if (sinBom && sinBom.equals(main)) return 'UTF-8 con BOM delante (PowerShell)';
  const lf = Buffer.from((sinBom || propio).toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  if (!main.includes(0x0d) && lf.equals(main)) return sinBom ? 'UTF-8 con BOM y finales CRLF (PowerShell)' : 'finales de línea CRLF (la copia pasó por algo que convierte finales)';
  return null;
}

/**
 * Qué es la copia, comparada con las versiones de main. Pura.
 * @param {{propio:Buffer, main:Buffer, versiones?:{commit:string, fecha:string, blob:string}[]|null}} e
 *   `versiones`: de la más nueva a la más vieja, cada una con el commit de main (primer padre) que la dejó.
 *   `null` = no supe leer el historial (el veredicto sale igual; «desde cuándo» no).
 */
export function juzgarCopia({ propio, main, versiones = null }) {
  const blob = blobDe(propio);
  if (blob === blobDe(main)) return { estado: 'AL-DIA', blob };
  if (Array.isArray(versiones)) {
    const i = versiones.findIndex((v) => v.blob === blob);
    if (i > 0) return { estado: 'ATRASADA', blob, es: versiones[i], cerradaPor: versiones[i - 1], saltos: i };
    // i === 0 sería «es la última versión del historial y no es main»: el historial no casa con main. No se afirma nada.
    if (i < 0) return { estado: 'AJENA', blob, causa: estropicio(propio, main), recorridas: versiones.length };
  }
  return { estado: 'AJENA', blob, causa: estropicio(propio, main), recorridas: null };
}

/** Las dos órdenes que refrescan la copia, como las corre `arranque.cmd`. Para `cmd`, no para PowerShell. */
export function ordenDeRefresco({ repo, dir, rutaEnElRepo = RUTA_EN_EL_REPO, instalado = INSTALADO }) {
  const r = aWin(repo);
  const d = aWin(dir).replace(/\\$/, '');
  return [`git -C "${r}" fetch --quiet origin main`, `git -C "${r}" show origin/main:${rutaEnElRepo} > "${d}\\${instalado}"`];
}

/**
 * @param {{dir?:string, repo?:string, bytes?:number, sha256?:string, mtime?:string, juicio?:object, mainRef?:string, motivo?:string, alerta?:string}|null|undefined} m
 *   lo que devuelve `medirPuerta`
 */
export function seccionPuerta(m) {
  const ciega = (motivo) => ({ nombre: 'PUERTA', pudo: false, motivo, alertas: [], poblacion: null });
  if (!m) return ciega('no pude medir la copia instalada del lanzador: NO SÉ si la puerta deja lanzar sesiones');
  if (m.motivo) return ciega(`${m.motivo}: NO SÉ si la puerta deja lanzar sesiones`);
  const donde = `${aWin(m.dir)}\\${INSTALADO}`;
  if (m.alerta) {
    return { nombre: 'PUERTA', pudo: true, poblacion: `la copia instalada del lanzador (${donde})`, alertas: [{ linea: `PUERTA CERRADA · ${m.alerta}` }] };
  }
  const j = m.juicio;
  const poblacion = `la copia instalada del lanzador (${donde}, ${m.bytes} B, sha256 ${String(m.sha256).slice(0, 8)}…${String(m.sha256).slice(-5)}) contra origin/main (${corto(m.mainRef)}) de ${aWin(m.repo)}, sólo los bytes (equipo y modelo, que la puerta también mira, no)`;
  if (j.estado === 'AL-DIA') return { nombre: 'PUERTA', pudo: true, alertas: [], poblacion: `${poblacion} · AL DÍA: idéntica byte a byte` };
  const [fetch, copia] = ordenDeRefresco({ repo: m.repo, dir: m.dir });
  const remedio = `se refresca desde **cmd**, NUNCA desde PowerShell (su \`>\` reescribe la codificación y la copia sale ALTERADA otra vez): \`${fetch}\` y después \`${copia}\` · lo corre quien puede escribir en la instalación (el fundador; para las sesiones es \`deny\`)`;
  let que;
  if (j.estado === 'ATRASADA') {
    que = `ATRASADA ${j.saltos} versión(es): es la de ${corto(j.es.commit)} (${j.es.fecha}) · CERRADA desde el merge ${corto(j.cerradaPor.commit)} (${j.cerradaPor.fecha}), que la cambió en main`;
  } else {
    const de = j.recorridas === null ? 'no supe leer el historial de main' : `no es ninguna de las últimas ${j.recorridas} versiones de main`;
    que = `AJENA: ${de}${j.causa ? ` · es main ESTROPEADA: ${j.causa}` : ''} · escrita el ${m.mtime} (desde entonces, como poco, está cerrada)`;
  }
  return { nombre: 'PUERTA', pudo: true, poblacion, alertas: [{ linea: `PUERTA CERRADA: \`sesion.mjs\` sale ALTERADO y NO se lanza ninguna sesión · ${que} · ${remedio}` }] };
}

function gitDe(cwd, args, binario = false) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: binario ? 'buffer' : 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
}

/** Las versiones de `ruta` en el primer padre de `ref`, de la más nueva a la más vieja. `null` si no se deja leer. */
export function versionesDe(texto) {
  const out = [];
  for (const t of String(texto).split('\0').filter((x) => x.trim())) {
    const [cab, ...resto] = t.split('\n');
    const [commit, fecha] = cab.split('\t');
    const raw = resto.find((l) => l.startsWith(':'));
    const blob = raw && raw.split(' ')[3];
    if (!/^[0-9a-f]{40}$/.test(commit || '') || !/^[0-9a-f]{40}$/.test(blob || '')) return null;
    out.push({ commit, fecha, blob });
  }
  return out;
}

/**
 * Lo único que toca el mundo, y sólo lee.
 * @param {{dir?:string, git?:Function, leer?:(p:string)=>Buffer, existe?:(p:string)=>boolean, mtime?:(p:string)=>Date}} e
 */
export function medirPuerta({
  dir = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'yaqu-equipo') : path.join(os.homedir(), '.yaqu-equipo'),
  git = gitDe, leer = (p) => fs.readFileSync(p), existe = (p) => fs.existsSync(p), mtime = (p) => fs.statSync(p).mtime,
} = {}) {
  if (!existe(dir)) return { motivo: `no hay instalación del equipo en ${aWin(dir)}` };
  let config;
  try { config = JSON.parse(leer(path.join(dir, 'config.json')).toString('utf8').replace(/^﻿/, '')); } catch { return { dir, motivo: `no hay config.json legible en ${aWin(dir)}` }; }
  if (!config || typeof config.repo !== 'string' || !config.repo) return { dir, motivo: 'config.json no trae la ruta del repositorio (`repo`)' };
  const repo = config.repo;
  // La puerta exige que la instalación NO esté dentro de un árbol: si lo está, dice DESDE-UN-ARBOL, y eso es un hecho.
  try {
    if (String(git(dir, ['rev-parse', '--is-inside-work-tree'])).trim() === 'true') {
      return { dir, repo, alerta: `${aWin(dir)} está dentro de un árbol de git: la puerta contesta DESDE-UN-ARBOL` };
    }
  } catch { /* fuera de un árbol, git sale ≠ 0: es lo correcto */ }
  const ruta = path.join(dir, INSTALADO);
  if (!existe(ruta)) return { dir, repo, alerta: `no hay copia de ${INSTALADO} en ${aWin(dir)}: no hay lanzador que abrir · ${ordenDeRefresco({ repo, dir }).join('  y después  ')} (desde cmd)` };
  let main; let mainRef;
  try {
    mainRef = git(repo, ['rev-parse', 'origin/main']).trim();
    main = Buffer.from(git(repo, ['show', `origin/main:${RUTA_EN_EL_REPO}`], true));
  } catch (e) { return { dir, repo, motivo: `no pude leer origin/main:${RUTA_EN_EL_REPO} en ${aWin(repo)} (${String((e && e.message) || e).split('\n')[0]})` }; }
  if (!main.length) return { dir, repo, motivo: `origin/main:${RUTA_EN_EL_REPO} salió VACÍO: no comparo contra nada` };
  let propio;
  try { propio = leer(ruta); } catch (e) { return { dir, repo, motivo: `no pude leer ${aWin(ruta)} (${String((e && e.message) || e).split('\n')[0]})` }; }
  let versiones = null;
  try {
    versiones = versionesDe(git(repo, ['log', '--first-parent', '--diff-merges=first-parent', '--raw', '--no-abbrev', '--format=%x00%H%x09%cI', '-n', String(VERSIONES), 'origin/main', '--', RUTA_EN_EL_REPO]));
  } catch { versiones = null; }
  let escrita = null;
  try { escrita = mtime(ruta).toISOString().slice(0, 19) + 'Z'; } catch { /* se dice «escrita el null»: no se inventa */ }
  return {
    dir, repo, mainRef, bytes: propio.length, mtime: escrita,
    sha256: crypto.createHash('sha256').update(propio).digest('hex'),
    juicio: juzgarCopia({ propio, main, versiones }),
  };
}
