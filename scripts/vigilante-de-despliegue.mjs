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
import path from 'node:path';
import {
  veredictoDeDespliegue, MARGEN_HORAS_PROPUESTO, SALIDA_NO_SUPE_MIRAR,
  constanciaDeEjecucion,
} from './_vigilante-de-despliegue.mjs';
// SCRUM-716 · el ritmo: congelado y retrasado no son lo mismo. La aritmética y la decisión son
// puras y viven allí; aquí sólo se lee el fichero y se escribe.
import { ritmoDeDespliegue, ultimaLectura, salidaConRitmo } from './_ritmo-de-despliegue.mjs';

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

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-716 · EL RITMO: ¿ESTÁ CONGELADA, O SÓLO VA POR DETRÁS?
//
// El veredicto de arriba mira UN instante. El 6-sep-2026 eso pintó igual dos situaciones muy
// distintas —producción movida y producción quieta—, mandó a buscar un healthcheck sano y bloqueó
// cinco ramas media jornada. El discriminador es comparar con la lectura ANTERIOR.
//
// 🔴 EL ALMACÉN ES LA CACHÉ DE ACTIONS, y por eso el diseño aguanta que falle: cuando la caché se
// pierde no hay lectura anterior, y la respuesta es `NO_SE_SABE` — un valor de primera clase que
// ya existe. Ningún permiso nuevo, nada escrito en el repositorio.
//
// ⚠️ SIN `VIGIA_ESTADO` NO HAY HISTORIAL, y es deliberado: en local no se ensucia nada y el vigía
// contesta lo honrado, que es que no sabe si se mueve. La ruta la pone el job.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const rutaEstado = process.env.VIGIA_ESTADO || '';
let anterior = null;
if (rutaEstado) {
  // Que no exista todavía es lo normal en la primera ejecución: no es un error, es que no hay
  // lectura anterior. Cualquier otro fallo de lectura SE DICE — un historial que falla en
  // silencio es la avería que este historial existe para no repetir.
  try {
    anterior = ultimaLectura(fs.readFileSync(rutaEstado, 'utf8'));
  } catch (e) {
    if (e && e.code !== 'ENOENT') {
      console.error('   (no se pudo leer el historial en ' + rutaEstado + ': '
        + String(e.message).split('\n')[0] + ')');
    }
  }
}
const ritmo = ritmoDeDespliegue(anterior, { versionDeProduccion });
const final = salidaConRitmo(v, ritmo);

console.log('\n[vigilante de despliegue] ' + url);
console.log(v.titulo);
if (v.detalle) console.log(v.detalle);
// El ritmo sólo habla cuando tiene algo que decir sobre este veredicto; si no, callarse es lo
// correcto — un vigía que repite «no sé nada del ritmo» en cada verde es ruido.
if (final.califica) {
  console.log('');
  console.log(final.titulo);
  console.log('   ' + final.detalle);
}
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

// SCRUM-716 · y el MISMO renglón se guarda, para que la ejecución siguiente tenga con qué
// comparar. Se APENDA: un historial que se sobrescribe no es un historial. Si no se puede
// escribir SE DICE y no se calla — pero no cambia el veredicto, que ya está decidido arriba.
if (rutaEstado) {
  try {
    fs.mkdirSync(path.dirname(rutaEstado), { recursive: true });
    fs.appendFileSync(rutaEstado, constancia.renglon + '\n', 'utf8');
  } catch (e) {
    console.error('   (no se pudo anotar el historial en ' + rutaEstado + ': '
      + String(e.message).split('\n')[0] + ')');
  }
}

// Y en el resumen del job, para que se lea sin abrir el log. Mismo mecanismo que
// `guards-visuales.mjs` —no uno nuevo—, incluido su `try/catch`: el resumen es un EXTRA, y si no
// se puede escribir, el veredicto y el código de salida siguen siendo los que ya se decidieron.
if (process.env.GITHUB_STEP_SUMMARY) {
  try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, constancia.resumen); }
  catch { /* anotar no es decidir: que falle el resumen no cambia nada de lo de arriba */ }
}

// Que se vea en el PR sin abrir el log, igual que hace `guards-visuales` (mismo mecanismo, no uno
// nuevo). En local no se emite nada, para no ensuciar una salida que alguien esté leyendo.
//
// 🔴 SCRUM-716 · MIRA LA SALIDA **FINAL**, no la del veredicto suelto. Si el ritmo dice que
// producción se está moviendo, la salida baja a 0 y aquí NO se emite nada: poner un ::error sobre
// un retraso que se está cerrando solo es exactamente lo que bloqueó cinco ramas el 6-sep.
if (process.env.GITHUB_ACTIONS === 'true' && final.salida !== 0) {
  const titulo = final.califica ? final.titulo : v.titulo;
  const texto = final.califica ? final.detalle : v.detalle;
  const cuerpo = String(texto).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  // `warning` para la ceguera y `error` para el defecto: el mismo reparto de antes, ahora
  // decidido por el código de salida final en vez de por el veredicto suelto.
  console.log('::' + (final.salida === SALIDA_NO_SUPE_MIRAR ? 'warning' : 'error')
    + ' title=' + titulo + '::' + cuerpo);
}

process.exit(final.salida);
