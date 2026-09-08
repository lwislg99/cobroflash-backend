// tests/scrum673-arranque-no-produce-veredicto.test.mjs — SCRUM-673
//
// UN ARRANQUE LENTO NO PRODUCE UN VEREDICTO.
//
// `guard:contraste` se cortaba a los 30,0 s arrancando Edge y tumbaba el CI de TODAS las ramas.
// Dos PRs sin una línea en común (SCRUM-651 y SCRUM-654) fallaron con el mismo error.
//
// 🔴 LA PRUEBA DE QUE EL TOPE ESTABA MAL, y es de la misma tirada:
//     guard:contraste    arranque ≥30,0 s (cortado)  → NO ARRANCA
//     guard:caja-avisos  arranque  38,2 s            → ✔ VERDE
// Mismo binario, misma máquina, en serie. El tope estaba POR DEBAJO de un arranque que la propia
// máquina demostró sano ese día. Y el mismo guard arrancó en 0,3 / 12,9 / 38,2 s en tandas
// distintas con el mismo código: eso no es el navegador, es la carga del runner.
//
// Subirlo a 60.000 sería cambiar un número por otro y esperar que el runner no vuelva a ir lento —
// la cura que SCRUM-520 rechazó. Es la TERCERA aparición de la misma enfermedad (SCRUM-520,
// SCRUM-671 y ésta).
import test from 'node:test';
import assert from 'node:assert/strict';

const NAV = 'file:///' + process.cwd().replace(/\\/g, '/') + '/scripts/_navegador.mjs';
const PUERTA = 'file:///' + process.cwd().replace(/\\/g, '/') + '/scripts/guards-visuales.mjs';
const { lanzarNavegador, INTENTOS_DE_ARRANQUE, topeDelIntento } = await import(NAV);
const { leerArranque, lineaDeTramos } = await import(PUERTA);

const MARCA = '⟦arranque⟧';

/** Un `puppeteer` de mentira: falla las `fallos` primeras veces y luego arranca. */
function puppeteerQueTarda(fallos) {
  let intentos = 0;
  return {
    get intentos() { return intentos; },
    async launch() {
      intentos += 1;
      if (intentos <= fallos) {
        throw new Error('Timed out after 30000 ms while waiting for the WS endpoint URL to appear in stdout!');
      }
      return { waitForTarget: async () => ({}), close: async () => {} };
    },
  };
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-673 · SUELO: hay más de un intento, y sus topes CRECEN', () => {
  assert.ok(INTENTOS_DE_ARRANQUE >= 2,
    `🔴 se declara ${INTENTOS_DE_ARRANQUE} intento(s). Con uno solo, el primer arranque lento vuelve ` +
    'a ser un veredicto, que es exactamente el defecto de este ticket.');
  assert.ok(topeDelIntento(2) > topeDelIntento(1),
    '🔴 los topes no crecen: reintentar tres veces con el mismo tope no cubre un runner cargado. ' +
    'La evidencia dice que cuando va lento no va «un poco» lento (0,3 → 38,2 s es x127).');
  // Y la escalera tiene que pasar por encima del arranque que la máquina demostró SANO ese día.
  const mayor = topeDelIntento(INTENTOS_DE_ARRANQUE, 30000);
  assert.ok(mayor > 38200,
    `🔴 el tope mayor de la escalera es ${mayor} ms y no llega a los 38,2 s que \`guard:caja-avisos\` ` +
    'tardó en arrancar ESE MISMO DÍA, en esa misma máquina, y PASÓ. El tope seguiría por debajo de ' +
    'un arranque que la propia máquina demostró sano.');
});

// ── 🔴 EL CONTROL POSITIVO · el mecanismo VIEJO no podría aprobarlo ─────────────────────────

test('SCRUM-673 · 🔴 un arranque que falla y luego VA no produce veredicto', async () => {
  // 🔴 ESTE ES EL TEST QUE DECIDE, y está construido para que el mecanismo VIEJO lo SUSPENDA:
  // con un solo intento, `lanzarNavegador` habría llamado a `process.exit(3)` en el primer fallo y
  // este test ni siquiera llegaría a su assert — el proceso de prueba se habría muerto.
  // No comprueba que exista una llamada: comprueba que el NAVEGADOR LLEGA a quien lo pidió.
  const falso = puppeteerQueTarda(1);
  const nav = await lanzarNavegador(falso, {});

  assert.ok(nav, '🔴 el primer arranque falló y NO se reintentó: un runner cargado un segundo ' +
    'sigue produciendo un veredicto. Eso es el defecto entero de este ticket.');
  assert.equal(typeof nav.close, 'function',
    '🔴 lo que se devuelve no es un navegador utilizable: el guard no podría comprobar nada con él.');
  assert.equal(falso.intentos, 2,
    `🔴 se hicieron ${falso.intentos} intentos y tenían que ser 2 (uno falla, el siguiente va). Si ` +
    'es 1, no hubo reintento; si son 3, se reintentó después de arrancar bien.');
});

test('SCRUM-673 · y aguanta hasta el penúltimo intento, no solo el primero', async () => {
  const falso = puppeteerQueTarda(INTENTOS_DE_ARRANQUE - 1);
  const nav = await lanzarNavegador(falso, {});
  assert.ok(nav, `🔴 con ${INTENTOS_DE_ARRANQUE - 1} fallos seguidos y un acierto al final, el ` +
    'arranque se da por perdido. Los intentos declarados no se están gastando todos.');
  assert.equal(falso.intentos, INTENTOS_DE_ARRANQUE);
});

// ── 🔴 PARTE B · el informe no puede contradecirse a sí mismo ───────────────────────────────

test('SCRUM-673 · 🔴 con DOS marcas, la tabla pinta la ÚLTIMA, no la primera', () => {
  // Éste es el defecto B, reproducido con la salida real que lo destapó: un guard que arrancó bien
  // (0,3 s) y después murió emitía DOS marcas, y la tabla pintaba «COMPLETA · proceso+ws 0.3 s»
  // debajo de una fila que decía NO ARRANCA. El 0,3 s era de OTRO arranque.
  const dos = [
    MARCA + ' 0.3 s COMPLETA · proceso+ws 0.3 s · primera-página 0.0 s',
    MARCA + ' 30.0 s CORTADA EN «proceso+ws» · proceso+ws ≥30.0 s · primera-página SIN MEDIR',
  ].join('\n');
  const a = leerArranque(dos);

  assert.equal(a.desenlace, 'CORTADA',
    '🔴 EL INFORME SE CONTRADICE A SÍ MISMO. La tabla dice COMPLETA sobre un guard que murió: ese ' +
    '«0,3 s» es de un arranque ANTERIOR, no del que falló. Quien lea solo el desglose concluye que ' +
    'arrancó bien — y con reintentos esto deja de ser raro: pasa SIEMPRE que haya más de un intento.');
  assert.equal(a.total, 30,
    '🔴 el total de la fila sale de la primera marca, no del desenlace.');
  assert.equal(a.intentos, 2,
    '🔴 los intentos anteriores se están tirando en silencio en vez de contarse.');
  assert.match(lineaDeTramos(a), /2 intentos/,
    '🔴 la línea del desglose no dice cuántos intentos costó. Un arranque que necesitó reintentar ' +
    'es un runner cargado, y esa señal es la que hay que ver acumularse ANTES de que vuelva a ' +
    'tumbar el CI.');
});

test('SCRUM-673 · con UNA sola marca no cambia nada de lo que ya funcionaba', () => {
  // CONTROL NEGATIVO: el caso normal —un arranque, una marca— tiene que leerse igual que siempre.
  const una = MARCA + ' 1.2 s COMPLETA · proceso+ws 1.0 s · primera-página 0.2 s';
  const a = leerArranque(una);
  assert.equal(a.desenlace, 'COMPLETA');
  assert.equal(a.total, 1.2);
  assert.equal(a.intentos, 1);
  assert.equal(/intentos/.test(lineaDeTramos(a)), false,
    '🔴 se anuncia «1 intentos» en el caso normal: ruido en las nueve filas de cada tanda.');
  assert.equal(leerArranque('sin marca ninguna'), null,
    '🔴 una salida sin marca ya no devuelve `null`: la tabla pintaría una fila vacía.');
});
