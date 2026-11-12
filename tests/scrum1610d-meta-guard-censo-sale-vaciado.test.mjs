// SCRUM-1610d · EL MODO CENSO DEL META-GUARD SALE CUANDO SU CENTINELA YA SE HA ESCRITO.
//
// POR QUÉ. SCRUM-1610 (c.20951) midió cinco salidas cortadas en el CI: el hijo terminaba con su código y
// la cola de su salida no llegaba. Uno de los dos hijos era `scripts/meta-guard-mutaciones.mjs --solo-censo`,
// que acababa con un `console.log` de su centinela y un `process.exit(0)` inmediato. Con stdout a una
// tubería en Linux, ese exit tira lo que quede en la cola, y lo que quedaba era justo la centinela: código 0
// sin ella es un verde que no ha medido nada. El lector ya lo detecta (1610b, `tests/_salida-entera.mjs`,
// carril J6). Lo que faltaba es la causa en el hijo, que es de S3 por la decisión de c.21007, y es esto.
//
// QUÉ SE PRUEBA, en el fuente sin comentarios: dentro del bloque `if (soloCenso) {` hay UNA salida, y va
// en el callback de la escritura de la centinela. Es el mismo contrato que 1610b exige a `_censo-frontera`.
// ⚠️ Lo que NO prueba: que esto evite el corte en el runner de Linux. En Windows la tubería es bloqueante y
// el corte no se reproduce (0 de 300, c.20951); medirlo allí necesita un workflow (punto 3 de c.20952, S5).
// Las otras 12 salidas del meta-guard (13 en total) no entran aquí: el encargo es la pieza del MODO CENSO.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const META = path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs');
const ANCLA = 'if (soloCenso) {';

/** El bloque `if (soloCenso) { … }` del fuente sin comentarios, hasta su llave de cierre a dos espacios. */
function bloqueDelCenso() {
  const codigo = leerFuente(META, { ancla: ANCLA });
  const i = codigo.indexOf(ANCLA);
  const fin = codigo.indexOf('\n  }\n', i);
  assert.ok(i >= 0 && fin > i, `no encuentro el bloque \`${ANCLA}\` del meta-guard cerrado por «  }»`);
  return codigo.slice(i, fin);
}

test('SCRUM-1610d · el MODO CENSO sale SÓLO en el callback de la escritura de su centinela', () => {
  const bloque = bloqueDelCenso();
  const salidas = bloque.match(/process\.exit\(/g) || [];
  const enCallback = /await new Promise\(\(\) => process\.stdout\.write\('\\n⚠️ MODO CENSO: NO se ha ejecutado ninguna mutación\.\\n',\s*\(\) => process\.exit\(0\)\)\);/.test(bloque);
  console.log(`[meta-guard · if (soloCenso)] process.exit( ${salidas.length} · en el callback de la centinela: ${enCallback ? 'sí' : 'NO'}`);
  assert.equal(salidas.length, 1, 'el bloque del MODO CENSO tiene que salir UNA vez, y por el callback de la centinela');
  assert.ok(enCallback,
    '🔴 el MODO CENSO vuelve a salir sin esperar a que se escriba su centinela: con stdout a una tubería, '
      + 'el lector puede recibir código 0 sin la última línea (SCRUM-1610 c.20951)');
  assert.doesNotMatch(bloque, /console\.log\([^)]*MODO CENSO/,
    '🔴 la centinela vuelve a ir por console.log: entonces la salida ya no espera a ESA escritura');
});

// Las mutaciones que TIENEN que tumbar este fichero (catálogo del meta-guard): vuelve la forma de antes.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: "    await new Promise(() => process.stdout.write('\\n⚠️ MODO CENSO: NO se ha ejecutado ninguna mutación.\\n',\n      () => process.exit(0)));\n",
    a: "    console.log('\\n⚠️ MODO CENSO: NO se ha ejecutado ninguna mutación.');\n    process.exit(0);\n",
    cae: 'SCRUM-1610d · el MODO CENSO sale SÓLO en el callback de la escritura de su centinela',
  },
];
