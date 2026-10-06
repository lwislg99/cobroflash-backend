// tests/_casos-escritos.mjs — SCRUM-1415
//
// UN CASO POR FILA DE UNA TABLA, CON EL NOMBRE ESCRITO.
//
// `for (const f of TABLA) test(`… ${f.que}`, …)` registra un caso por fila, pero su nombre se
// CONSTRUYE al ejecutar: en el fuente no hay literal que buscar, así que la señal por nombres de
// SCRUM-1339d (`scripts/_senal-de-nombres.mjs`) no puede decir que falta si la tanda lo pierde.
// Medido en `exp-1384`: parte de lo que se perdió era de éstos y no lo nombró nadie (las cifras,
// con su fecha, en `docs/master/SCRUM-1415.md`).
//
// Con esto el bucle se escribe desenrollado, y cada caso lleva su nombre LITERAL:
//
//     const decide = casosEscritos(TABLA, (f) => `… ${f.que}`, (f) => { …el cuerpo… });
//     test('… la primera', decide(0));
//     test('… la segunda', decide(1));
//     decide.todos();
//
// Lo que un literal pierde frente al bucle, y cómo se sujeta aquí:
//   · EL NOMBRE SE SEPARA DEL DATO (alguien cambia la fila y no el literal): cada caso compara
//     su nombre con el que sale de su fila, y cae.
//   · UNA FILA NUEVA SE QUEDA SIN CASO (el bucle la recogía sola): `todos()` lanza al cargar el
//     fichero si no hay exactamente un caso escrito por fila. Lanza, no registra un caso: así
//     el fichero tiene los MISMOS casos que tenía con el bucle.
import assert from 'node:assert/strict';

/**
 * Un caso SUELTO cuyo nombre lleva dentro un dato (un umbral, una cifra medida): el nombre se
 * escribe literal y el caso comprueba, lo primero, que sigue siendo el que sale del dato.
 *
 *     test('… por debajo de 3 h no se avisa', (t) => {
 *       nombreEscrito(t, `… por debajo de ${UMBRAL} h no se avisa`);
 */
export function nombreEscrito(t, construido) {
  assert.equal(t.name, construido,
    '🔴 el nombre ESCRITO de este caso ya no es el que sale de su dato: cambió el dato y no el literal. '
    + 'Corrige el literal: es lo que la señal por nombres busca en el TAP.');
}

/**
 * @param {readonly unknown[]} filas   la tabla
 * @param {(fila: any) => string} nombreDe   el nombre que el bucle le habría dado a esa fila
 * @param {(fila: any, t: any) => unknown} cuerpo   lo que el caso comprueba
 * @returns la función que, dada la posición de una fila, devuelve el cuerpo de su `test(…)`
 */
export function casosEscritos(filas, nombreDe, cuerpo) {
  const escritos = new Set();
  const caso = (i) => {
    assert.ok(Number.isInteger(i) && i >= 0 && i < filas.length,
      `casosEscritos: no hay fila ${i} (la tabla tiene ${filas.length})`);
    assert.ok(!escritos.has(i), `casosEscritos: la fila ${i} tiene dos casos escritos`);
    escritos.add(i);
    return (t) => {
      assert.equal(t.name, nombreDe(filas[i]),
        '🔴 el nombre ESCRITO de este caso ya no es el que sale de su fila: se cambió la tabla (o la '
        + 'plantilla) y no el literal. Corrige el literal: es lo que la señal por nombres busca en el TAP.');
      return cuerpo(filas[i], t);
    };
  };
  caso.todos = () => {
    const sinCaso = filas.map((_, i) => i).filter((i) => !escritos.has(i));
    assert.deepEqual(sinCaso, [],
      `🔴 casosEscritos: ${sinCaso.length} fila(s) de ${filas.length} sin su caso escrito (posiciones `
      + `${sinCaso.join(', ')}): ${sinCaso.map((i) => `«${nombreDe(filas[i])}»`).join(' · ')}. `
      + 'Una fila sin caso no se comprueba; escribe su `test(\'…\', …)` con ese nombre.');
  };
  return caso;
}
