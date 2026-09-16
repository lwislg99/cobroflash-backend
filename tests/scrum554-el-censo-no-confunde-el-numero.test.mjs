// tests/scrum554-el-censo-no-confunde-el-numero.test.mjs — SCRUM-554 (rebote)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 UN ROJO QUE NO EXISTÍA, Y QUE COSTÓ UNA TANDA ENTERA BUSCARLO
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// `censo-guards-navegador.mjs` imprimió `guard:caja-documento-suelto   28.9 s   rojo(143)`, y ese
// renglón viajó a un expediente como hallazgo: «hay un rojo vivo que nadie ve». No lo había. Ese
// guard, corrido solo, da rc=0 en 7 s. El 143 lo puso un `timeout` externo que envolvía al censo
// entero y se llevó por delante al cuarto hijo.
//
// El censo leyó bien el número y mal su PROCEDENCIA: pintaba `rojo(N)` —o sea, «este guard midió
// y encontró un defecto»— cualquier cosa que no fuera 0 ni 2. Con eso metía en el mismo cajón:
//   · un hallazgo de verdad (1)
//   · dos cegueras que el guard DECLARA (3 NO ARRANCA, 4 SIN SERVIDOR)
//   · un código que el guard no puede haber elegido (143), impuesto desde fuera
//
// ── POR QUÉ ESTO ES UN TEST Y NO UNA REVISIÓN ──────────────────────────────────────────────
// El censo tarda minutos y levanta dieciocho navegadores: nadie lo va a correr para comprobar
// una etiqueta. Por eso la clasificación vive en `_salida-de-guard.mjs`, PURA y sin `process`, y
// se ejercita aquí en milisegundos. Es la misma disciplina que `veredicto()` en
// `guards-visuales.mjs`, y por el mismo motivo: un control que cuesta nueve navegadores es un
// control que no se ejecuta.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 NO dice que los guards estén verdes, ni cuánto tardan. Dice UNA cosa: que el censo no llame
//    «defecto medido» a algo que no lo es. Que cada guard acierte es asunto suyo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { estadoDeLaSalida, esVeredictoDelGuard } from '../scripts/_salida-de-guard.mjs';
import { VOCABULARIO } from '../scripts/guards-visuales.mjs';

// ⚠️ MUTACIÓN DECLARADA (SCRUM-745): la ejecuta `npm run meta:mutaciones` en CI. Devuelve el
// clasificador a lo que hacía antes —todo lo desconocido es `rojo(N)`— y exige que esto se caiga.
// Si no se cayera, este fichero sería un adorno.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'scripts/_salida-de-guard.mjs',
    de: "  if (!v) return 'FUERA DEL VOCABULARIO(' + (r ? r.status : r) + ') · NO MEDIDO';",
    a: "  if (!v) return 'rojo(' + (r ? r.status : r) + ')';",
    cae: 'SCRUM-554 · NEGATIVO: un 143 real NO se llama rojo' },
];

/** Un hijo de verdad que termina con el código pedido. Sin shell, argumentos en array. */
function salidaReal(codigo) {
  return spawnSync(process.execPath, ['-e', 'process.exit(' + codigo + ')'], { encoding: 'utf8' });
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO · si el vocabulario llegara vacío, TODO sería «fuera del vocabulario» y el control
//    negativo pasaría por construcción, sin medir nada.
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-554 · 🔴 SUELO: el vocabulario de códigos llega y no está vacío', () => {
  assert.ok(VOCABULARIO instanceof Map, '🔴 CIEGO: VOCABULARIO no es un Map.');
  assert.ok(VOCABULARIO.size >= 5,
    '🔴 CIEGO: el vocabulario trae ' + VOCABULARIO.size + ' códigos.\n'
    + '  Con el vocabulario vacío TODO cae en «FUERA DEL VOCABULARIO» y el control negativo de\n'
    + '  este fichero se pondría verde sin distinguir nada. «Distingue bien» y «no reconozco\n'
    + '  ningún código» son el mismo resultado con significados opuestos.');
  assert.ok(VOCABULARIO.has(0) && VOCABULARIO.has(1),
    '🔴 CIEGO: faltan los dos códigos que SÍ son veredicto del guard (0 y 1).');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② ✅ POSITIVO · el rojo de verdad sigue siendo rojo. Esto es lo que NO se puede perder:
//    arreglar el falso positivo a costa de tragarse los verdaderos sería relajar el censo.
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-554 · ✅ POSITIVO: un hallazgo real (salida 1) se sigue llamando rojo', () => {
  const r = salidaReal(1);
  assert.equal(r.status, 1, 'el hijo de control no salió con 1; la medición no vale.');
  const e = estadoDeLaSalida(r);
  assert.equal(e, 'rojo(1)',
    '🔴 Se ha perdido el rojo de verdad: un guard que sale con 1 dice «medí y encontré algo»,\n'
    + '  y el censo lo ha llamado «' + e + '».');
  assert.ok(esVeredictoDelGuard(e), 'un rojo(1) ES un veredicto del guard.');
});

test('SCRUM-554 · ✅ POSITIVO: el verde sigue siendo verde', () => {
  const r = salidaReal(0);
  assert.equal(estadoDeLaSalida(r), 'verde');
  assert.ok(esVeredictoDelGuard('verde'));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ ✅ NEGATIVO · el caso que ocurrió. Hijo REAL saliendo con 143, no un objeto de mentira:
//    un `{status:143}` escrito a mano comprueba mi idea de spawnSync, no spawnSync.
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-554 · NEGATIVO: un 143 real NO se llama rojo', () => {
  const r = salidaReal(143);
  assert.equal(r.status, 143, 'el hijo de control no salió con 143; la medición no vale.');
  const e = estadoDeLaSalida(r);
  assert.ok(!e.startsWith('rojo'),
    '🔴 EL DEFECTO ESTÁ DE VUELTA: el censo llama «' + e + '» a un código que ningún guard de\n'
    + '  navegador puede elegir (su vocabulario es 0,1,2,3,4). Eso es lo que mandó a buscar un\n'
    + '  defecto inexistente el 16-sep-2026.');
  assert.ok(e.includes('NO MEDIDO'),
    'un código fuera del vocabulario tiene que DECIR que no se midió; dijo «' + e + '».');
  assert.ok(!esVeredictoDelGuard(e), 'un 143 no es un veredicto del guard.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ Las cegueras que el guard DECLARA tampoco son defectos — y también salían como rojo(N).
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-554 · las cegueras declaradas (2, 3, 4) no se pintan como defecto', () => {
  for (const [codigo, etiqueta] of [[2, 'CIEGO'], [3, 'NO ARRANCA'], [4, 'SIN SERVIDOR']]) {
    const r = salidaReal(codigo);
    assert.equal(r.status, codigo, 'el hijo de control no salió con ' + codigo + '.');
    const e = estadoDeLaSalida(r);
    assert.equal(e, etiqueta,
      '🔴 salida ' + codigo + ' se llamó «' + e + '» en vez de «' + etiqueta + '».\n'
      + '  Es una ceguera DECLARADA por el guard, no un hallazgo: llamarla rojo manda a buscar\n'
      + '  un defecto donde lo que pasó es que no se pudo mirar.');
    assert.ok(!esVeredictoDelGuard(e), codigo + ' no es un veredicto del guard.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ El tope de `spawnSync` ya tenía rama propia y NO se ha tocado. Se comprueba que sigue viva:
//    un arreglo que rompe la rama que ya funcionaba no es un arreglo.
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-554 · el TOPE de spawnSync sigue siendo TOPE (y llega con señal de verdad)', () => {
  const r = spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 9000)'], { timeout: 700, encoding: 'utf8' });
  assert.equal(r.error && r.error.code, 'ETIMEDOUT', 'el hijo de control no llegó a tope.');
  assert.equal(estadoDeLaSalida(r), 'TOPE');
  assert.ok(!esVeredictoDelGuard('TOPE'));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑥ ⚠️ EL LÍMITE, ESCRITO EN VEZ DE DISIMULADO
//    En win32 `r.signal` no llega nunca en estos casos (medido: un hijo que se manda SIGTERM a
//    sí mismo sale con status=1 y signal=null). La rama de la señal sólo se ejercita de verdad
//    en POSIX. Se comprueba con un objeto —y se DICE que es un objeto— en lugar de fingir que
//    esta máquina la ha probado.
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-554 · la rama de señal existe (comprobada sobre un objeto, no sobre esta máquina)', () => {
  const e = estadoDeLaSalida({ status: null, signal: 'SIGKILL' });
  assert.ok(e.startsWith('MATADO(SIGKILL)') && e.includes('NO MEDIDO'), 'dijo «' + e + '».');
  assert.ok(!esVeredictoDelGuard(e));
});
