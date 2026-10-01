// scripts/tests-que-cubren.mjs — SCRUM-1363
//
// «He tocado ESTOS ficheros: ¿qué tests me pueden caer?» — incluidos los que no nombran ninguno.
//
//     node scripts/tests-que-cubren.mjs                      lo que esta rama cambia respecto a su base
//     node scripts/tests-que-cubren.mjs public/…/x.js …      esos ficheros
//     node scripts/tests-que-cubren.mjs --porque             además, por qué entra cada test
//     node scripts/tests-que-cubren.mjs --lanzar             calcula Y corre la dirigida  (npm run tanda:dirigida)
//
// La lista no se elige a mano: ése es el defecto que esto sustituye. El análisis, sus tres cubos
// y de qué NO responde, en `scripts/_tests-que-cubren.mjs`.
//
// ⛔ NO sustituye a la tanda completa: el juez es el CI. Esto decide qué correr ANTES de empujar.
//
// SALIDAS: 0 calculado (y, con `--lanzar`, la dirigida en verde) · 1 la dirigida tiene rojos ·
// 2 no supe medir (el análisis no es fiable, no hay base, `dist/` no corresponde al fuente, o una
// tanda no ejecutó ni un test).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs';
import { baseDeLaRama } from '../tests/_base-de-la-rama.mjs';
import {
  analizarArbol, seleccionar, motivosParaNoFiarse, NOMBRA, RECORRE, NO_SE,
} from './_tests-que-cubren.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SALIDA_ROJO = 1;
export const SALIDA_CIEGO = 2;

/** Cuántos ficheros de test por invocación: Windows corta la línea de órdenes a 32 KB. */
export const LOTE = 200;
/** Ficheros a la vez. La máquina va justa de memoria: se puede BAJAR desde el entorno, no subir. */
export const CONCURRENCIA = 4;

export function concurrenciaEfectiva(pedida) {
  const n = Number.parseInt(pedida, 10);
  return Number.isInteger(n) && n >= 1 && n <= CONCURRENCIA ? n : CONCURRENCIA;
}

/**
 * Lo que la rama cambia respecto a su punto de partida, MÁS lo que hay sin commitear y sin
 * seguir: una dirigida se corre antes de commitear, y lo que aún no está en git es lo que más
 * falta hace medir. Devuelve `null` si no hay base: «no sé qué has tocado» no es «nada».
 */
export function tocadosDeLaRama(raiz = RAIZ) {
  const base = baseDeLaRama(raiz);
  if (!base) return null;
  const git = (args) => execFileSync('git', args, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const lineas = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  const cambiados = lineas(git(['diff', '--name-only', base.sha]));
  const sinSeguir = lineas(git(['ls-files', '--others', '--exclude-standard']));
  return { base, ficheros: [...new Set([...cambiados, ...sinSeguir])].sort() };
}

/**
 * Los tests corren contra `dist/`. Si se ha tocado un `.ts` y su compilado es más viejo —o no
 * está—, la dirigida mediría el código de ANTES y saldría verde sobre lo que no se ha probado.
 */
export function distQueNoCorresponde(tocados, raiz = RAIZ) {
  const viejos = [];
  for (const t of tocados) {
    if (!/^src\/.*\.ts$/.test(t) || t.endsWith('.d.ts')) continue;
    const fuente = path.join(raiz, t);
    if (!fs.existsSync(fuente)) continue; // borrado: no hay nada que compilar
    const compilado = path.join(raiz, t.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js'));
    if (!fs.existsSync(compilado) || fs.statSync(compilado).mtimeMs < fs.statSync(fuente).mtimeMs) viejos.push(t);
  }
  return viejos;
}

/** El resumen que sale SIEMPRE: población, cubos y selección. */
export function resumen({ arbol, tocados, seleccion }) {
  const c = seleccion.cuenta;
  return [
    `POBLACIÓN: ${arbol.porTest.size} tests analizados (${arbol.enDisco} en disco) · ficheros tocados: ${tocados.length}`,
    `  ${NOMBRA}: ${c[NOMBRA]} · ${RECORRE} un directorio que los contiene: ${c[RECORRE]} · ${NO_SE} qué leen (entran siempre): ${c[NO_SE]}`,
    `  SELECCIONADOS: ${seleccion.elegidos.size} de ${arbol.porTest.size}`,
  ].join('\n');
}

/** Lee de un TAP lo que hace falta para el veredicto. */
export function cuentasDelTap(texto) {
  const n = (clave) => {
    const m = new RegExp(`^# ${clave} (\\d+)$`, 'm').exec(texto);
    return m ? Number(m[1]) : null;
  };
  const caidos = [...texto.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { tests: n('tests'), pass: n('pass'), fail: n('fail'), caidos };
}

function lanzar(elegidos, concurrencia) {
  const entorno = { ...process.env };
  for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
  const total = { tests: 0, pass: 0, fail: 0, caidos: [], ciegos: [] };
  const taps = [];
  for (let i = 0; i < elegidos.length; i += LOTE) {
    const lote = elegidos.slice(i, i + LOTE);
    const tap = path.join(os.tmpdir(), `yaqu-dirigida-${process.pid}-${i / LOTE}.tap`);
    taps.push(tap);
    const r = spawnSync(process.execPath, [
      '--test', '--test-force-exit', `--test-concurrency=${concurrencia}`,
      '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...lote,
    ], { cwd: RAIZ, encoding: 'utf8', env: entorno, stdio: ['ignore', 'inherit', 'inherit'] });
    const c = cuentasDelTap(fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '');
    // Una tanda que no ejecutó ni un test no es un verde: es un instrumento que no arrancó.
    if (!c.tests) { total.ciegos.push(`lote ${i / LOTE + 1} (${lote.length} ficheros): sin recuento, salida ${r.status}`); continue; }
    total.tests += c.tests; total.pass += c.pass || 0; total.fail += c.fail || 0; total.caidos.push(...c.caidos);
    if (r.status !== 0 && !c.fail) total.ciegos.push(`lote ${i / LOTE + 1}: salida ${r.status} sin ningún caído a la vista`);
  }
  return { ...total, taps };
}

function main() {
  const args = process.argv.slice(2);
  const banderas = new Set(args.filter((a) => a.startsWith('--')));
  const dados = args.filter((a) => !a.startsWith('--')).map((a) => a.replace(/\\/g, '/').replace(/^\.\//, ''));

  let tocados = dados;
  let base = null;
  if (!dados.length) {
    const t = tocadosDeLaRama();
    if (!t) {
      console.error('🔴 CIEGO: no encuentro la base de esta rama, así que no sé qué has tocado.');
      console.error('   Dime los ficheros: node scripts/tests-que-cubren.mjs <fichero> …');
      process.exit(SALIDA_CIEGO);
    }
    tocados = t.ficheros;
    base = t.base;
  }

  const arbol = analizarArbol(RAIZ);
  const motivos = motivosParaNoFiarse(arbol);
  if (motivos.length) {
    console.error(`🔴 CIEGO: el análisis no es fiable — ${motivos.join(' · ')}`);
    process.exit(SALIDA_CIEGO);
  }
  const seleccion = seleccionar(arbol, tocados);
  const elegidos = [...seleccion.elegidos.keys()].sort();

  console.log(resumen({ arbol, tocados, seleccion }) + (base ? `\n  base de la rama: ${base.sha.slice(0, 8)}` : ''));
  if (!tocados.length) console.log('  No hay nada tocado respecto a la base: no hay dirigida que correr.');
  if (seleccion.sinCobertura.length) {
    console.log(`\n⚠️ NO SÉ QUIÉN CUBRE ESTOS ${seleccion.sinCobertura.length} (ningún test los nombra ni recorre su carpeta):`);
    for (const f of seleccion.sinCobertura) console.log(`   · ${f}`);
    console.log('   No es «no hace falta probarlos»: es que desde aquí no se ve. El juez es el CI.');
  }
  if (banderas.has('--porque')) {
    console.log();
    for (const t of elegidos) {
      const r = seleccion.elegidos.get(t);
      console.log(`${t}\n    ${r.cubo} · ${r.por}  ←  ${r.tocado}`);
    }
  } else if (!banderas.has('--lanzar')) {
    console.log();
    for (const t of elegidos) console.log(t);
  }
  if (!banderas.has('--lanzar') || !elegidos.length) return;

  if (!fs.existsSync(path.join(RAIZ, 'dist'))) {
    console.error('\n🔴 CIEGO: no hay `dist/`. Los tests corren contra el compilado: `npm run build` primero.');
    process.exit(SALIDA_CIEGO);
  }
  const viejos = distQueNoCorresponde(tocados);
  if (viejos.length) {
    console.error(`\n🔴 CIEGO: has tocado ${viejos.length} fuente(s) y su compilado es más viejo o no está:`);
    for (const v of viejos.slice(0, 10)) console.error(`   · ${v}`);
    console.error('   La dirigida mediría el código de ANTES. `npm run build`, y vuelve a lanzarme.');
    process.exit(SALIDA_CIEGO);
  }

  const concurrencia = concurrenciaEfectiva(process.env.TANDA_DIRIGIDA_CONCURRENCIA);
  console.log(`\nLanzo ${elegidos.length} ficheros de test, ${concurrencia} a la vez, en lotes de ${LOTE}…\n`);
  const r = lanzar(elegidos, concurrencia);
  console.log(`\nDIRIGIDA: ${elegidos.length} ficheros · ${r.tests} tests · ${r.pass} pass · ${r.fail} fail`);
  console.log(`  TAP: ${r.taps.join(' · ')}`);
  for (const c of r.caidos) console.log(`  not ok · ${c}`);
  for (const c of r.ciegos) console.error(`  🔴 CIEGO · ${c}`);
  const salida = r.ciegos.length && !r.fail ? SALIDA_CIEGO : r.fail || r.ciegos.length ? SALIDA_ROJO : 0;
  console.log(`  Verde aquí no es verde en CI: esto es lo que te cubre a la vista, no la tanda entera.`);
  console.log(`EXIT=${salida}`);
  process.exit(salida);
}

if (ejecutadoDirectamente(import.meta.url)) main();
