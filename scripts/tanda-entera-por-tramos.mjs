// scripts/tanda-entera-por-tramos.mjs — SCRUM-1244c · LA TANDA ENTERA, EN TRAMOS QUE CABEN, CON UN SOLO VEREDICTO.
//
//     npm run build                                            una vez, antes del tramo 1
//     node scripts/tanda-entera-por-tramos.mjs --plan          cuántos tramos y qué ficheros lleva cada uno
//     node scripts/tanda-entera-por-tramos.mjs --tramo 3/10    corre SÓLO el tramo 3: cada tramo en SU comando, en primer plano
//     node scripts/tanda-entera-por-tramos.mjs --resumen 10    el veredicto de la pasada: VERDE sólo con los 10 vistos
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO (SCRUM-1244, reabierto el 23-oct-2026, c.20605): con 7-9 sesiones vivas, la tanda entera
// en esta máquina no cabe en un comando. Medido el 23-oct entre las 19:03Z y las 19:41Z, en 8 trozos
// a concurrencia 4 (docs/master/SCRUM-1244.md, tramo ⑩): 1.482 ficheros, 12.397 tests y 2.020 s.
// El tope de la herramienta Bash en primer plano es de 600 s; pasado ése, el arnés la manda al fondo y
// su reaper la mata por memoria (lo que le pasó a jv-j3at ese día). Y la memoria libre bajó a 312 MB
// con sólo 4 trabajadores: subir la concurrencia para que quepa en el tiempo es lo que la mata.
//
// Lo que hace: parte la lista ORDENADA de `tests/*.test.mjs` en n tramos contiguos (las piezas son
// de S3, `_tanda-por-tramos.mjs`, y se importan sin tocarlas), corre UNO por comando y apunta su
// registro FUERA del árbol, bajo la huella de la pasada (ficheros + n + estado del árbol). El
// resumen lo da `resumenDeTramos`, que nace CIEGO y sólo dice VERDE con los n tramos vistos.
//
// 🔴 Lo que no se negocia: un tramo que no termina NO SUMA COMO VERDE.
//   · si el proceso muere (reaper, ventana cerrada), no deja registro → al resumen le falta → CIEGO;
//   · si node --test sale sin `# tests N`, o sus cuentas no suman N, o hay `cancelled` → CIEGO;
//   · si sale ≠ 0 sin ningún caído a la vista → CIEGO;
//   · si pasa de TOPE_MS, se para su árbol de procesos y se apunta CIEGO: no cupo, no es verde.
// Un tramo ciego se vuelve a correr (mismo comando); el resumen se queda con el último registro.
//
// SALIDAS: 0 verde · 1 rojo (caídos que no son ciegos por entorno declarados) · 2 ciego / no supe medir.
// ⛔ NO sustituye al CI: el juez obligatorio sigue siendo él.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  caidosDelTap, sinNombrar, partirCaidos, leerCiegosDeclarados, parsearTramo, tramoDe,
  huellaDeLaPasada, dirDeLaPasada, guardarTramo, leerTramos, resumenDeTramos, lineasDelResumen, lineaDeLote,
} from './_tanda-por-tramos.mjs';
import { estadoDelArbol } from './tests-que-cubren.mjs';
import { tokenDeSesion } from './_identidad-sesion.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 150 ficheros por tramo, DERIVADO de la medición del 23-oct: el trozo más lento fue de 2,5 s por fichero
 * (900-1100: 501 s para 200), así que 150 dan 375 s en el peor caso medido, el 69 % de TOPE_MS.
 */
export const FICHEROS_POR_TRAMO = 150;
/** 4: la concurrencia con la que se midió. Con ella la memoria libre ya bajó a 312 MB. */
export const CONCURRENCIA = 4;
/** 540 s: los 600 del primer plano de la herramienta Bash, menos 60 para el arranque y el registro. */
export const TOPE_MS = 540_000;

export const tramosDe = (cuantos, porTramo = FICHEROS_POR_TRAMO) => Math.max(1, Math.ceil(cuantos / porTramo));

/** Las cuentas del resumen del TAP. Sin `# tests N` no hay recuento: `null`. */
export function cuentasDelTap(texto) {
  const n = (k) => { const m = new RegExp(`^# ${k} (\\d+)$`, 'm').exec(texto); return m ? Number(m[1]) : null; };
  return { tests: n('tests'), pass: n('pass'), fail: n('fail'), cancelled: n('cancelled'), skipped: n('skipped'), todo: n('todo') };
}

/**
 * El registro de UN tramo, a partir de lo que dejó su proceso. Puro: los tests lo alimentan a mano.
 * `ciegos` no vacío ⇒ el tramo no cuenta como visto en verde (lo decide `resumenDeTramos`).
 */
export function registroDelTramo({ i, n, ficheros, texto, status, signal, ms, agotado }, declarados = [], entorno = {}) {
  const c = cuentasDelTap(texto);
  const ciegos = [];
  if (agotado) ciegos.push(`no cupo en ${Math.round(TOPE_MS / 1000)} s: se paró a los ${Math.round(ms / 1000)} s`);
  if (signal) ciegos.push(`el proceso murió por la señal ${signal}`);
  if (c.tests == null) ciegos.push(`sin recuento: el TAP no trae «# tests N» (salida ${status})`);
  else {
    const suma = (c.pass ?? 0) + (c.fail ?? 0) + (c.cancelled ?? 0) + (c.skipped ?? 0) + (c.todo ?? 0);
    if (suma !== c.tests) ciegos.push(`las cuentas no suman: ${suma} ≠ ${c.tests} tests`);
    if (c.cancelled) ciegos.push(`${c.cancelled} test(s) cancelado(s): no llegaron a terminar`);
    if (c.tests === 0) ciegos.push('cero tests: un tramo que no ejecutó nada no es un verde');
  }
  const caidos = caidosDelTap(texto);
  const { tuyos, porEntorno } = partirCaidos(caidos, declarados, entorno);
  const sinNom = c.fail == null ? 0 : sinNombrar(c.fail, caidos);
  if (status !== 0 && !c.fail && !ciegos.length) ciegos.push(`salida ${status} sin ningún caído a la vista`);
  return { i, n, ficheros, tests: c.tests ?? 0, pass: c.pass ?? 0, fail: c.fail ?? 0, ms, tuyos, porEntorno, sinNombrar: sinNom, ciegos };
}

export function listaDeTests(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort()
    .map((f) => path.relative(RAIZ, path.join(dir, f)).replace(/\\/g, '/'));
}

function leerArgumentos(args) {
  const o = { dir: path.join(RAIZ, 'tests'), base: process.env.TANDA_TRAMOS_BASE || null, porTramo: FICHEROS_POR_TRAMO };
  for (let k = 0; k < args.length; k++) {
    const [clave, enLinea] = args[k].split('=');
    const valor = () => enLinea ?? args[++k];
    if (clave === '--plan') o.plan = true;
    else if (clave === '--tramo') { o.tramo = parsearTramo(valor()); if (!o.tramo) o.error = '--tramo quiere «i/n» con 1 ≤ i ≤ n'; }
    else if (clave === '--resumen') { o.resumen = Number(valor()); if (!(o.resumen >= 1)) o.error = '--resumen quiere el número de tramos'; }
    else if (clave === '--dir') o.dir = path.resolve(valor());
    else if (clave === '--por-tramo') o.porTramo = Number(valor());
    else o.error = `no sé qué es «${args[k]}»`;
  }
  return o;
}

function pararArbol(hijo) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(hijo.pid), '/T', '/F'], { stdio: 'ignore' });
  else try { process.kill(-hijo.pid, 'SIGKILL'); } catch { hijo.kill('SIGKILL'); }
}

async function correrTramo({ i, n }, ficheros, dirPasada) {
  const entorno = { ...process.env };
  for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
  const tap = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-tramo-')), `tramo-${i}.tap`);
  const t0 = Date.now();
  const hijo = spawn(process.execPath, ['--test', '--test-force-exit', `--test-concurrency=${CONCURRENCIA}`,
    '--import=./scripts/tuberia-bloqueante.mjs', '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...ficheros],
  { cwd: RAIZ, env: entorno, stdio: ['ignore', 'inherit', 'inherit'], detached: process.platform !== 'win32', windowsHide: true });
  let agotado = false;
  const reloj = setTimeout(() => { agotado = true; pararArbol(hijo); }, Number(process.env.TANDA_TRAMOS_TOPE_MS) || TOPE_MS);
  const { status, signal } = await new Promise((ok) => hijo.on('exit', (status, signal) => ok({ status, signal })));
  clearTimeout(reloj);
  const ms = Date.now() - t0;
  const texto = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  fs.rmSync(path.dirname(tap), { recursive: true, force: true });
  const declarados = leerCiegosDeclarados(path.join(RAIZ, 'scripts', '_ciegos-por-entorno-declarados.json'));
  const r = registroDelTramo({ i, n, ficheros: ficheros.length, texto, status, signal: agotado ? null : signal, ms, agotado },
    declarados, { raiz: RAIZ, tmp: path.dirname(path.dirname(dirPasada)) });
  guardarTramo(dirPasada, r);
  console.log(lineaDeLote({ i, n, ficheros: r.ficheros, tests: r.tests, fail: r.fail, ms }));
  for (const c of r.ciegos) console.log(`  🔴 CIEGO · ${c}`);
  for (const c of r.tuyos) console.log(`  not ok · ${c}`);
  return r.tuyos.length || r.sinNombrar ? 1 : r.ciegos.length ? 2 : 0;
}

async function main() {
  const o = leerArgumentos(process.argv.slice(2));
  if (o.error || (!o.plan && !o.tramo && !o.resumen)) {
    console.error(`${o.error ?? 'falta --plan, --tramo i/n o --resumen n'}\nuso: node scripts/tanda-entera-por-tramos.mjs --plan | --tramo i/n | --resumen n`);
    process.exit(2);
  }
  const elegidos = listaDeTests(o.dir);
  if (!elegidos.length) { console.error(`🔴 CIEGO: ningún *.test.mjs en ${o.dir}`); process.exit(2); }
  if (o.plan) {
    const n = tramosDe(elegidos.length, o.porTramo);
    console.log(`${elegidos.length} ficheros → ${n} tramos de hasta ${Math.ceil(elegidos.length / n)} (concurrencia ${CONCURRENCIA}, tope ${TOPE_MS / 1000} s por tramo)`);
    for (let i = 1; i <= n; i++) { const t = tramoDe(elegidos, i, n); console.log(`  ${i}/${n}: ${t[0]} … ${t.at(-1)} (${t.length})`); }
    return;
  }
  const n = o.tramo ? o.tramo.n : o.resumen;
  const base = o.base || path.join(os.tmpdir(), `yaqu-tanda-tramos-${tokenDeSesion(RAIZ)}`);
  // `TANDA_TRAMOS_ARBOL` sólo lo pone su test: sus tramos de muestra corren mientras la tanda del CI
  // escribe en el árbol, y la huella del árbol real cambiaría entre su tramo 1 y su resumen.
  const arbol = process.env.TANDA_TRAMOS_ARBOL || estadoDelArbol(RAIZ);
  const dirPasada = dirDeLaPasada(base, huellaDeLaPasada({ elegidos, n, arbol }));
  if (o.tramo) process.exit(await correrTramo(o.tramo, tramoDe(elegidos, o.tramo.i, n), dirPasada));
  const r = resumenDeTramos(leerTramos(dirPasada), n);
  console.log(`población: ${elegidos.length} ficheros de ${path.relative(RAIZ, o.dir) || '.'} · pasada ${path.basename(dirPasada)}`);
  for (const l of lineasDelResumen(r)) console.log(l);
  process.exit(r.veredicto === 'VERDE' ? 0 : r.veredicto === 'ROJO' ? 1 : 2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
