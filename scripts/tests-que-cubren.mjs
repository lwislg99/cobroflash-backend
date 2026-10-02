// scripts/tests-que-cubren.mjs — SCRUM-1363
//
// «He tocado ESTOS ficheros: ¿qué tests me pueden caer?» — incluidos los que no nombran ninguno.
//
//     node scripts/tests-que-cubren.mjs                      lo que esta rama cambia respecto a su base
//     node scripts/tests-que-cubren.mjs public/…/x.js …      esos ficheros
//     node scripts/tests-que-cubren.mjs --porque             además, por qué entra cada test
//     node scripts/tests-que-cubren.mjs --lanzar             calcula Y corre la dirigida  (npm run tanda:dirigida)
//     node scripts/tests-que-cubren.mjs --lanzar --tramo 2/4 sólo el tramo 2 de 4 (SCRUM-1412): cada tramo en SU comando,
//                                                            en primer plano; el veredicto exige haber visto los 4
//     node scripts/tests-que-cubren.mjs --resumen-de 4       qué tramos de la pasada de 4 se han visto sobre ESTE árbol
//
// La lista no se elige a mano: ése es el defecto que esto sustituye. El análisis, sus tres cubos
// y de qué NO responde, en `scripts/_tests-que-cubren.mjs`.
//
// ⛔ NO sustituye a la tanda completa: el juez es el CI. Esto decide qué correr ANTES de empujar.
//
// SALIDAS: 0 calculado (y, con `--lanzar`, la dirigida en verde) · 1 la dirigida tiene rojos ·
// 2 no supe medir (el análisis no es fiable, no hay base, `dist/` no corresponde al fuente, una
// tanda no ejecutó ni un test, o a la pasada por tramos le FALTA alguno).
// Un caído declarado en `_ciegos-por-entorno-declarados.json` cuya condición se cumple en esta
// máquina sale aparte y no decide la salida: no es tu cambio, y el CI sí lo mide.
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs';
import { baseDeLaRama } from '../tests/_base-de-la-rama.mjs';
import { temporal } from '../tests/_temporal.mjs';
import {
  analizarArbol, seleccionar, motivosParaNoFiarse, NOMBRA, RECORRE, NO_SE,
} from './_tests-que-cubren.mjs';
import {
  caidosDelTap, sinNombrar, leerCiegosDeclarados, partirCaidos, lineaDeLote, parsearTramo, tramoDe,
  tramosPropuestos, huellaDeLaPasada, dirDeLaPasada, guardarTramo, leerTramos, olvidarPasada,
  resumenDeTramos, lineasDelResumen, duracion, veredictoDeLaDirigida, UMBRAL_PARA_TROCEAR,
} from './_tanda-por-tramos.mjs';

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
  // SCRUM-1412: a cualquier profundidad. `# fail` cuenta también los anidados, y con sólo los de
  // primer nivel salía «2 fail» nombrando uno.
  const caidos = caidosDelTap(texto);
  return { tests: n('tests'), pass: n('pass'), fail: n('fail'), caidos };
}

function lanzar(elegidos, concurrencia) {
  const entorno = { ...process.env };
  for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
  const total = { tests: 0, pass: 0, fail: 0, caidos: [], ciegos: [], ms: 0 };
  const taps = [];
  // FUERA del árbol, y en un directorio ÚNICO por llamada: una ruta fija del temporal la comparten
  // todas las sesiones de la máquina y dos dirigidas a la vez se pisarían el TAP (SCRUM-258).
  // Se borra al salir (SCRUM-864): quien quiera conservar el TAP lo pide con `--tap=<fichero>`.
  const dirTap = temporal('yaqu-dirigida-');
  const lotes = Math.ceil(elegidos.length / LOTE);
  for (let i = 0; i < elegidos.length; i += LOTE) {
    const lote = elegidos.slice(i, i + LOTE);
    const t0 = Date.now();
    const tap = path.join(dirTap, `lote-${i / LOTE + 1}.tap`);
    taps.push(tap);
    const r = spawnSync(process.execPath, [
      '--test', '--test-force-exit', `--test-concurrency=${concurrencia}`,
      '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...lote,
    ], { cwd: RAIZ, encoding: 'utf8', env: entorno, stdio: ['ignore', 'inherit', 'inherit'] });
    const textoTap = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
    taps[taps.length - 1] = textoTap;
    const c = cuentasDelTap(textoTap);
    const ms = Date.now() - t0;
    total.ms += ms;
    // Al TERMINAR cada lote (SCRUM-1412): una pasada viva y una muerta dejan de verse igual.
    console.log(lineaDeLote({ i: i / LOTE + 1, n: lotes, ficheros: lote.length, tests: c.tests, fail: c.fail, ms }));
    // Una tanda que no ejecutó ni un test no es un verde: es un instrumento que no arrancó.
    if (!c.tests) { total.ciegos.push(`lote ${i / LOTE + 1} (${lote.length} ficheros): sin recuento, salida ${r.status}`); continue; }
    total.tests += c.tests; total.pass += c.pass || 0; total.fail += c.fail || 0; total.caidos.push(...c.caidos);
    if (r.status !== 0 && !c.fail) total.ciegos.push(`lote ${i / LOTE + 1}: salida ${r.status} sin ningún caído a la vista`);
  }
  return { ...total, taps };
}

/**
 * Las banderas, los ficheros dados y los dos argumentos CON VALOR (`--tramo i/n`, `--resumen-de n`;
 * también con `=`). Un valor mal formado es un `error`, no un fichero más ni una pasada entera.
 */
export function leerArgumentos(args) {
  const banderas = new Set();
  const dados = [];
  let tramo = null;
  let resumenDe = null;
  let error = null;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    const conValor = /^--(tramo|resumen-de)(?:=(.*))?$/.exec(a);
    if (conValor) {
      const valor = conValor[2] ?? args[++k];
      if (conValor[1] === 'tramo') {
        tramo = parsearTramo(valor);
        if (!tramo) error = `--tramo quiere «i/n» con 1 ≤ i ≤ n (he leído «${valor ?? ''}»)`;
      } else {
        resumenDe = /^\d+$/.test(String(valor ?? '')) && Number(valor) >= 1 ? Number(valor) : null;
        if (!resumenDe) error = `--resumen-de quiere el número de tramos (he leído «${valor ?? ''}»)`;
      }
    } else if (a.startsWith('--')) banderas.add(a);
    else dados.push(a.replace(/\\/g, '/').replace(/^\.\//, ''));
  }
  return { banderas, dados, tramo, resumenDe, error };
}

/**
 * Sobre QUÉ árbol se corre: el commit, lo cambiado sin commitear y lo que está sin seguir, con su
 * contenido. Es la mitad de la identidad de una pasada por tramos: si cambia entre dos tramos, no
 * se suman.
 */
export function estadoDelArbol(raiz = RAIZ) {
  const git = (a) => execFileSync('git', a, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
  const h = crypto.createHash('sha256');
  h.update(git(['rev-parse', 'HEAD']));
  h.update(git(['diff', 'HEAD']));
  for (const f of git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean).sort()) {
    h.update(f);
    try { h.update(fs.readFileSync(path.join(raiz, f))); } catch { h.update('ilegible'); }
  }
  return h.digest('hex');
}

/** Donde se apunta qué tramos se han visto. FUERA del árbol; se borra al completar la pasada. */
const BASE_DE_TRAMOS = path.join(os.tmpdir(), 'yaqu-dirigida-tramos');

function main() {
  const args = process.argv.slice(2);
  const { banderas, dados, tramo, resumenDe, error } = leerArgumentos(args);
  if (error) {
    console.error(`🔴 ${error}`);
    process.exit(SALIDA_CIEGO);
  }

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
  } else if (!banderas.has('--lanzar') && !resumenDe) {
    console.log();
    for (const t of elegidos) console.log(t);
  }
  if (resumenDe) {
    // Sólo LEE: qué tramos de la pasada de `resumenDe` se han visto sobre ESTE árbol y selección.
    const dir = dirDeLaPasada(BASE_DE_TRAMOS, huellaDeLaPasada({ elegidos, n: resumenDe, arbol: estadoDelArbol() }));
    const res = resumenDeTramos(leerTramos(dir), resumenDe);
    console.log();
    for (const l of lineasDelResumen(res)) console.log(l);
    const salida = res.veredicto === 'ROJO' ? SALIDA_ROJO : res.veredicto === 'CIEGO' ? SALIDA_CIEGO : 0;
    console.log(`EXIT=${salida}`);
    process.exit(salida);
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
  let aCorrer = elegidos;
  if (tramo) {
    if (tramo.n > elegidos.length) {
      console.error(`\n🔴 no hay ${tramo.n} tramos en ${elegidos.length} ficheros.`);
      process.exit(SALIDA_CIEGO);
    }
    aCorrer = tramoDe(elegidos, tramo.i, tramo.n);
    console.log(`\nTRAMO ${tramo.i}/${tramo.n}: ${aCorrer.length} de los ${elegidos.length} ficheros seleccionados.`);
  } else if (elegidos.length > UMBRAL_PARA_TROCEAR) {
    const n = tramosPropuestos(elegidos.length);
    console.log(`\n⚠️ ${elegidos.length} ficheros son más de ${UMBRAL_PARA_TROCEAR}: entera, esta pasada suele pasar de diez minutos y el sistema la manda sola al fondo.`);
    console.log(`   Por tramos, cada uno en SU comando y en primer plano: --lanzar --tramo 1/${n} … --tramo ${n}/${n}.`);
  }
  console.log(`\nLanzo ${aCorrer.length} ficheros de test, ${concurrencia} a la vez, en lotes de ${LOTE}…\n`);
  const r = lanzar(aCorrer, concurrencia);
  const v = veredictoDeLaDirigida(r, leerCiegosDeclarados(path.join(RAIZ, 'scripts', '_ciegos-por-entorno-declarados.json')), { raiz: RAIZ, tmp: os.tmpdir() });
  console.log(`\nDIRIGIDA: ${aCorrer.length} ficheros · ${r.tests} tests · ${r.pass} pass · ${r.fail} fail · ${duracion(r.ms)} medidos`);
  const destinoTap = args.find((a) => a.startsWith('--tap='))?.slice('--tap='.length);
  if (destinoTap) {
    fs.writeFileSync(path.resolve(destinoTap), r.taps.join('\n'));
    console.log(`  TAP: ${path.resolve(destinoTap)}`);
  } else {
    console.log('  TAP no conservado. Para leerlo después: --tap=<fichero FUERA del árbol>.');
  }
  for (const l of v.lineas) console.log(l);
  for (const c of r.ciegos) console.error(`  🔴 CIEGO · ${c}`);
  let salida = v.salida;
  if (tramo) {
    // Se apunta este tramo y se dice cómo va la PASADA. Con los n vistos sobre el mismo árbol, el
    // veredicto es el de la pasada entera y el registro se borra; si falta alguno, no es un verde.
    const dir = dirDeLaPasada(BASE_DE_TRAMOS, huellaDeLaPasada({ elegidos, n: tramo.n, arbol: estadoDelArbol() }));
    guardarTramo(dir, {
      i: tramo.i, n: tramo.n, ficheros: aCorrer.length, tests: r.tests, pass: r.pass, fail: r.fail, ms: r.ms,
      tuyos: v.tuyos, porEntorno: v.porEntorno, sinNombrar: v.sinNombrar, ciegos: r.ciegos,
    });
    const res = resumenDeTramos(leerTramos(dir), tramo.n);
    console.log();
    for (const l of lineasDelResumen(res)) console.log(l);
    if (!res.faltan.length) {
      salida = res.veredicto === 'ROJO' ? SALIDA_ROJO : res.veredicto === 'CIEGO' ? SALIDA_CIEGO : 0;
      olvidarPasada(dir);
    } else {
      console.log(`  La salida de abajo es la de ESTE tramo. La de la pasada: --resumen-de ${tramo.n}, o el último tramo.`);
    }
  }
  console.log(`  Verde aquí no es verde en CI: esto es lo que te cubre a la vista, no la tanda entera.`);
  console.log(`EXIT=${salida}`);
  process.exit(salida);
}

if (ejecutadoDirectamente(import.meta.url)) main();
