// scripts/guards-entrada.mjs — SCRUM-414 · los guards de una ENTRADA DE REGISTRO, todos de golpe.
//
//   npm run guards:entrada
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────────────────────
// En tres días, las entradas de `docs/master/` han sido cazadas por CUATRO guards distintos, y cada
// sesión los ha descubierto **en rojo, después de empujar**: el nombre del fichero (SCRUM-273), el
// ancla de medición (SCRUM-267), los tests declarados (SCRUM-391) y no nombrar documentos que no
// existen (SCRUM-242).
//
// Eso no es descuido. Ninguna sesión los conoce todos hasta que le saltan, y **no había forma de
// comprobarlos de golpe antes de empujar**: `npm test` compila y corre 2.400 tests, así que nadie
// lo lanza para revisar un fichero de texto. Cada rojo de estos cuesta una vuelta completa de PR.
//
// Estos cuatro corren **sin compilar y sin base de datos** —son estructurales, leen ficheros— así
// que el comando tarda segundos. Ese es el punto: uno que tarde un minuto no se ejecuta.
//
// ⚠️ Esto NO sustituye a `npm test`. Comprueba la ENTRADA, no el trabajo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Los guards que vigilan una entrada del registro. Cada uno con el motivo por el que está, para que
 * quien añada el quinto sepa qué clase de cosa entra aquí: **lo que puede poner en rojo un PR por el
 * fichero de `docs/master/`, sin tocar código**.
 */
const GUARDS = [
  { fichero: 'tests/scrum273-registro-por-fichero.test.mjs',
    porque: 'el fichero se llama SCRUM-<n>.md y el trabajo no se escribe en YAQU_MASTER.md' },
  { fichero: 'tests/scrum267-ancla-de-medicion.test.mjs',
    porque: 'la entrada declara contra qué `origin/main` se midió, con sha de 40 y hora con huso' },
  { fichero: 'tests/scrum391-guards-declarados-presentes.test.mjs',
    porque: 'todo test que la entrada DECLARA existe en el árbol' },
  { fichero: 'tests/scrum242-scripts-no-prometen-documentos.test.mjs',
    porque: 'no se nombra un documento que no existe (la promesa que se lee y no se busca)' },
];

// SUELO Nº1. Un agregador que se queda corto es PEOR que no tenerlo: da la tranquilidad entera con
// la cobertura a medias, y quien lo corre en verde deja de mirar. Si mañana alguien borra una línea
// de la lista de arriba «porque molestaba», esto para.
const MINIMO = 4;

// Secuencias de escape ANSI (CSI). El runner de node colorea su resumen cuando cree que hay un
// terminal detrás —o cuando el entorno trae `FORCE_COLOR`—, y entonces la línea del recuento llega
// como `\x1b[34mℹ tests 26\x1b[39m`.
const ANSI = /\u001B\[[0-9;]*[A-Za-z]/g;

/**
 * El recuento de tests que imprime el runner de node, leído de su salida.
 *
 * Está aquí fuera, y exportada, porque es lo único de este script que se puede equivocar en
 * silencio: si devuelve 0 cuando han corrido 26, el comando dice «tus guards no han corrido» y
 * manda a quien lo lea a buscar un guard roto que no existe. Pasó de verdad el 17-sep-2026, a tres
 * sesiones el mismo día (SCRUM-928): el `\x1b[39m` del final rompía el ancla de fin de línea, el
 * recuento salía 0 y `guards:entrada` moría en rojo **con los 26 tests en verde**.
 *
 * Se limpia el color ANTES de leer, y no se afloja la expresión: el ancla es el suelo que
 * distingue la línea del recuento de cualquier otra que mencione «tests».
 *
 * Se arregla AQUÍ, en quien lee, y no en quien llama, porque poner `FORCE_COLOR=0` delante del
 * comando NO basta: se midió que una sesión lanzada así sigue trayendo `FORCE_COLOR=3` en su
 * entorno. Un arreglo que depende de que todo el mundo invoque bien no es un arreglo.
 */
export function recuentoDeTests(salida) {
  const limpia = (salida || '').replace(ANSI, '');
  const m = /^[^\n]*\btests\s+(\d+)\s*$/m.exec(limpia);
  return m ? Number(m[1]) : 0;
}

function main() {
const faltan = GUARDS.filter((g) => !fs.existsSync(path.join(RAIZ, g.fichero)));
if (faltan.length) {
  console.error('🔴 FALTAN GUARDS DE ENTRADA — no se ejecuta nada:\n');
  for (const g of faltan) console.error(`   · ${g.fichero}\n     (vigilaba: ${g.porque})`);
  console.error('\n  O el fichero se ha renombrado y hay que actualizar esta lista, o el guard ha');
  console.error('  desaparecido y hay que decidirlo a propósito. Correr los que quedan y decir');
  console.error('  «verde» sería exactamente el fallo que este comando viene a evitar.');
  process.exit(1);
}
if (GUARDS.length < MINIMO) {
  console.error(`🔴 la lista tiene ${GUARDS.length} guards y el mínimo son ${MINIMO}. No se ejecuta nada.`);
  process.exit(1);
}

console.log(`Guards de entrada del registro (${GUARDS.length}):`);
for (const g of GUARDS) console.log(`  · ${path.basename(g.fichero)} — ${g.porque}`);
console.log();

const r = spawnSync(process.execPath, ['--test', ...GUARDS.map((g) => g.fichero)], {
  cwd: RAIZ, encoding: 'utf8',
});
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');

// SUELO Nº2: que además de correr, HAYAN CORRIDO. Un fichero que existe pero se quedó sin tests
// —o un runner que no encuentra nada— saldría con éxito y en silencio, y «0 tests, 0 fallos» es
// verde. Se lee el recuento que imprime el propio runner.
const ejecutados = recuentoDeTests(r.stdout || '');
if (ejecutados < MINIMO) {
  console.error(`\n🔴 solo se ejecutaron ${ejecutados} tests entre ${GUARDS.length} ficheros.`);
  console.error('  Los ficheros están, pero no han corrido: «0 tests, 0 fallos» también sale verde.');
  process.exit(1);
}

if (r.status !== 0) {
  console.error('\n🔴 Algún guard de entrada está en rojo. Arréglalo ANTES de empujar: si entra así,');
  console.error('  el PR sale rojo y cuesta una vuelta entera.');
  process.exit(r.status ?? 1);
}
console.log(`\n✓ ${GUARDS.length} guards de entrada en verde (${ejecutados} tests). La entrada puede empujarse.`);
}

// Solo corre cuando se le llama como comando. Importarlo —para probar el lector de arriba— no
// debe lanzar 23 s de guards ni, peor, matar a quien lo importa con un `process.exit(1)`.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
