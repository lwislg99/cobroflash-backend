#!/usr/bin/env node
// scripts/vigilante-de-despliegue.mjs — SCRUM-677
//
// ¿Está producción corriendo lo que hay en `main`? Lo pregunta y lo dice.
//
//   node scripts/vigilante-de-despliegue.mjs                 # margen por defecto
//   node scripts/vigilante-de-despliegue.mjs --margen 12     # otro margen, en horas
//   node scripts/vigilante-de-despliegue.mjs --url https://…/version
//
// ── LO ÚNICO QUE HACE ESTE FICHERO ES CONSEGUIR LOS DATOS ───────────────────────────────────
// El veredicto vive en `_vigilante-de-despliegue.mjs`, que es PURO. Aquí sólo se lee la red y
// git. Es el mismo reparto que `comprobar-claves-bd.mjs` / `_clave-vs-destino.mjs`: así el rojo
// se puede ejercitar sin red y sin repo preparado, que es lo que hace que alguien lo ejercite.
//
// 🔴 NO USA NINGUNA CREDENCIAL, y no es una limitación: es el hallazgo del ticket. `GET /version`
// es público y declarado (`publicAccessDeclarations.ts`), así que el commit activo se sabe sin
// token de Railway, sin base de datos y sin secretos. **No hay ninguna cadena de conexión en este
// fichero, ni de ejemplo.**
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import {
  veredictoDeDespliegue, MARGEN_HORAS_PROPUESTO, NO_SUPE_MIRAR, SALIDA_NO_SUPE_MIRAR,
  constanciaDeEjecucion,
} from './_vigilante-de-despliegue.mjs';

const URL_POR_DEFECTO = 'https://yaqu.app/version';

function arg(nombre, pordefecto) {
  const i = process.argv.indexOf('--' + nombre);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : pordefecto;
}

const url = arg('url', URL_POR_DEFECTO);
const margenHoras = Number(arg('margen', MARGEN_HORAS_PROPUESTO));

/** git, siempre acotado y sin lanzar: lo que no se pueda leer se devuelve como `null`. */
function git(...args) {
  try { return String(execFileSync('git', args, { encoding: 'utf8' })).trim(); }
  catch { return null; }
}

let versionDeProduccion = null;
try {
  const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (r.ok) versionDeProduccion = (await r.json()).version;
  else console.error('   (respuesta ' + r.status + ' de ' + url + ')');
} catch (e) {
  console.error('   (no se pudo pedir ' + url + ': ' + String(e.message).split('\n')[0] + ')');
}

const shaDeMain = git('rev-parse', 'origin/main');
let conoceElCommit = null; let estaEnMain = null;
let commitsPorDelante = null; let epochDelPrimeroSinDesplegar = null;

if (typeof versionDeProduccion === 'string' && /^[0-9a-f]{40}$/.test(versionDeProduccion)) {
  conoceElCommit = git('cat-file', '-e', versionDeProduccion) !== null;
  if (conoceElCommit && shaDeMain) {
    estaEnMain = git('merge-base', '--is-ancestor', versionDeProduccion, shaDeMain) !== null;
    if (estaEnMain) {
      const n = git('rev-list', '--count', versionDeProduccion + '..' + shaDeMain);
      commitsPorDelante = n === null ? null : Number(n);
      if (commitsPorDelante) {
        // El MÁS ANTIGUO que falta, que es el que dice desde cuándo estamos parados. `--reverse`
        // + la primera línea: el primero que main tiene y producción no.
        const lista = git('log', '--format=%ct', '--reverse', versionDeProduccion + '..' + shaDeMain);
        const primera = lista && lista.split('\n')[0];
        epochDelPrimeroSinDesplegar = primera ? Number(primera) : null;
      }
    }
  }
}

const datos = {
  versionDeProduccion, shaDeMain, conoceElCommit, estaEnMain,
  commitsPorDelante, epochDelPrimeroSinDesplegar,
  ahoraEpoch: Math.floor(Date.now() / 1000), margenHoras,
};
const v = veredictoDeDespliegue(datos);

console.log('\n[vigilante de despliegue] ' + url);
console.log(v.titulo);
if (v.detalle) console.log(v.detalle);
console.log('');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-727 · LA CONSTANCIA, Y VA FUERA DE TODO `if` A PROPÓSITO
//
// Un renglón por ejecución, SIEMPRE: verde, rojo y ciego. Ésa es la línea que faltaba — el
// 4-sep-2026 el vigía cantó 24,9 h y 9 commits, el hueco se cerró solo y no se pudo decir por
// qué, porque los verdes no dejaban rastro con el que comparar.
//
// Va antes del `process.exit` y sin ninguna condición sobre el veredicto: en cuanto esto viva
// dentro de un `if (v.salida !== 0)`, los verdes vuelven a no existir y este ticket se deshace.
// La anotación de abajo SÍ es condicional, y son cosas distintas: aquella AVISA (y avisar de un
// verde es ruido), ésta ANOTA.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const constancia = constanciaDeEjecucion(v, datos);
console.log(constancia.renglon);

// Y en el resumen del job, para que se lea sin abrir el log. Mismo mecanismo que
// `guards-visuales.mjs` —no uno nuevo—, incluido su `try/catch`: el resumen es un EXTRA, y si no
// se puede escribir, el veredicto y el código de salida siguen siendo los que ya se decidieron.
if (process.env.GITHUB_STEP_SUMMARY) {
  try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, constancia.resumen); }
  catch { /* anotar no es decidir: que falle el resumen no cambia nada de lo de arriba */ }
}

// Que se vea en el PR sin abrir el log, igual que hace `guards-visuales` (mismo mecanismo, no uno
// nuevo). En local no se emite nada, para no ensuciar una salida que alguien esté leyendo.
if (process.env.GITHUB_ACTIONS === 'true' && v.salida !== 0) {
  const cuerpo = String(v.detalle).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log('::' + (v.veredicto === NO_SUPE_MIRAR ? 'warning' : 'error')
    + ' title=' + v.titulo + '::' + cuerpo);
}

process.exit(v.salida);
