#!/usr/bin/env node
// scripts/suelo-de-la-tanda.mjs — SCRUM-672
//
// ¿Ha PERDIDO tests la tanda? Lee el TAP y lo compara con el suelo declarado.
//
//   node scripts/suelo-de-la-tanda.mjs <ruta-del-tap>
//
// El veredicto vive en `_suelo-de-la-tanda.mjs`, que es PURO. Aquí sólo se lee el fichero — el
// mismo reparto que `comprobar-claves-bd.mjs` / `_clave-vs-destino.mjs`, y es lo que permite
// ejercitar el rojo sin correr la tanda dentro de la tanda.
//
// 🔴 SE LEE EL TAP Y NO LA CONSOLA. Medido: con el reporter TAP activo, la línea `ℹ tests N` de
// `spec` NO EXISTE. El número que imprime la consola depende de qué reporter esté puesto; el
// `# tests N` del TAP lo emite el propio reporter, siempre y en el mismo formato. El CI ya escribe
// ese fichero en cada tanda, así que esto no añade nada nuevo que mantener: le da superficie.
import fs from 'node:fs';
import path from 'node:path';
import { veredictoDelSuelo, SALIDA_NO_SUPE_MIRAR, SUELO_TESTS } from './_suelo-de-la-tanda.mjs';

const ruta = process.argv[2];
const RAIZ = path.resolve(import.meta.dirname, '..');

/**
 * SCRUM-736 · cuántos tests DECLARA el árbol, para que el suelo no dependa de un número escrito
 * hace ocho días. Se pregunta al censo por AST de SCRUM-708 — el mismo que usa el trinquete
 * derivado de SCRUM-810b, no un segundo censo.
 *
 * 🔴 Y si no se puede contar, se pasa `null`: el veredicto lo DICE y rige el declarado. Un censo
 * que revienta no es un árbol de cero tests, y confundirlos aquí bajaría el suelo a nada.
 */
async function declaradosEnElArbol() {
  try {
    const m = await import('../tests/_poblacion-de-tests.mjs');
    const n = m.testsDeclaradosEn(RAIZ);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

if (!ruta) {
  console.error('\n⚠️ NO SUPE MIRAR: falta la ruta del TAP.');
  console.error('   uso: node scripts/suelo-de-la-tanda.mjs <ruta-del-tap>\n');
  process.exit(SALIDA_NO_SUPE_MIRAR);
}

let texto;
try {
  texto = fs.readFileSync(ruta, 'utf8');
} catch (e) {
  // 🔴 Un TAP que no se puede leer NO es «la tanda está bien». Sale con el código de la ceguera,
  // distinto del 1 del hallazgo: los dos errores no cuestan lo mismo y no pueden leerse igual.
  console.error(`\n⚠️ NO SUPE MIRAR: no pude leer «${ruta}».`);
  console.error(`   ${String(e.message).split('\n')[0]}`);
  console.error('   Esto NO es «la tanda está bien»: es que no se ha podido comprobar.\n');
  process.exit(SALIDA_NO_SUPE_MIRAR);
}

const v = veredictoDelSuelo(texto, SUELO_TESTS, await declaradosEnElArbol());

console.log('\n[suelo de la tanda] ' + v.titulo);
if (v.detalle) console.log(v.detalle);
console.log('');

// Que se vea en el PR sin abrir el log, con el mismo mecanismo que ya usan los otros guards.
if (process.env.GITHUB_ACTIONS === 'true' && v.salida !== 0) {
  const cuerpo = String(v.detalle).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log('::' + (v.salida === SALIDA_NO_SUPE_MIRAR ? 'warning' : 'error')
    + ' title=' + v.titulo + '::' + cuerpo);
}

process.exit(v.salida);
