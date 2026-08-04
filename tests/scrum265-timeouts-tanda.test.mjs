// tests/scrum265-timeouts-tanda.test.mjs — SCRUM-265 puntos 1 y 2.
//
// (El punto 3 —el margen en el recibo— ya está en main desde el 2-ago-2026 y tiene su propio
// fichero, `tests/scrum265-margen-en-recibo.test.mjs`. Lo que hizo posible medir esto.)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// PUNTO 1 · el bloque QA corría al 98,3 % de su límite
//
// El recibo de una tanda real (2-ago-2026): `qa` 1.769.715 ms contra un límite de 1.800.000.
// Treinta segundos. Y la serie de tres tandas seguidas dice que no es un pico —1.825,4 s
// **MURIÓ contra el límite**, 1.792,8 s, 1.769,7 s—, o sea que esto ya costó una tanda entera:
// un hijo muerto por reloj no es un rojo, es una tanda INVÁLIDA que hay que repetir.
//
// El guard NO comprueba «HEAVY_MS === 45 min». Eso sería copiar el número en dos sitios y
// llamarlo verificación: cambiaría a la vez que el código y no diría nada nunca. Comprueba la
// PROPIEDAD que hace bueno al número —cuánto margen deja sobre la peor duración conocida—, y
// por eso el mensaje del rojo explica qué se rompió en vez de qué constante no cuadra.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// PUNTO 2 · `GATED_CHILD_TIMEOUT_MS` ilegible se tragaba en silencio
//
//     const OVERRIDE_MS = Number(process.env.GATED_CHILD_TIMEOUT_MS) || 0;
//
// `Number('treinta')` es `NaN`, `NaN || 0` es `0`, y `0` significa exactamente «no hay
// override». Quien pedía un límite distinto se llevaba el de por defecto sin un solo aviso.
// Fail-open de manual (SCRUM-217): el valor no se entiende y en vez de parar se sigue con otra
// cosa que parece razonable.
//
// **Y ES EL TERCER CASO EL QUE IMPORTA.** Ausente y válido ya funcionaban antes del arreglo;
// un test que solo los cubra pasa igual con el código roto. El defecto vive entero en el
// ilegible, así que ahí es donde tiene que apretar el test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import {
  LIGHT_MS, HEAVY_MS, VAR_OVERRIDE, resolverOverride, limiteDe,
} from '../scripts/_timeouts-tanda.mjs';
import { ttlParaTanda, TTL_POR_DEFECTO_MS } from '../scripts/_staging-lock.mjs';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const RUNNER = 'scripts/test-staging-gated.mjs';

// Datos MEDIDOS, no supuestos. Los tres primeros salen del recibo `.claude/evidencia-tanda.json`
// de una tanda real; la serie de duraciones del bloque QA la midió el fundador el 2-ago-2026.
const MEDIDO = {
  qaPeorCompletadoMs: 1_792_800, // la segunda de la serie; la primera (1.825,4 s) MURIÓ, así
                                 // que su duración real es desconocida y solo acota por abajo.
  qaRecibidoMs: 1_769_715,       // recibo propio, corrobora la magnitud
  botMs: 68_722,
  a55Ms: 25_526,
};

/** Margen mínimo exigido al límite sobre la peor duración conocida de ese hijo. */
const MARGEN_MINIMO = 0.30;

const min = (n) => n * 60 * 1000;

// ── PUNTO 1 ──────────────────────────────────────────────────────────────────────────────

test('SCRUM-265 · el límite del bloque pesado deja margen real sobre lo medido', () => {
  const necesario = MEDIDO.qaPeorCompletadoMs / (1 - MARGEN_MINIMO);
  const usado = MEDIDO.qaPeorCompletadoMs / HEAVY_MS;

  assert.ok(HEAVY_MS >= necesario,
    `🔴 el límite del bloque pesado (${Math.round(HEAVY_MS / 60000)} min) deja al hijo `
    + `«qa» corriendo al ${(100 * usado).toFixed(1)} % de su tiempo.\n\n`
    + `  La peor duración conocida es ${MEDIDO.qaPeorCompletadoMs} ms y se exige al menos un `
    + `${100 * MARGEN_MINIMO} % de margen, o sea ${Math.round(necesario / 60000)} min.\n\n`
    + '  Esto NO es una preferencia de estilo: con el límite apretado el hijo muere por RELOJ,\n'
    + '  y una muerte por tiempo no es un rojo — es una tanda INVÁLIDA que hay que repetir\n'
    + '  entera. Ya pasó el 2-ago-2026 (1.825,4 s contra un límite de 1.800).');
});

test('SCRUM-265 · los límites de los hijos ligeros siguen sobrando, y se dice con números', () => {
  // El ticket cambia UN número. Este test es lo que sostiene la frase «los ligeros no se
  // tocan»: sin él, «no se tocan» es una opinión sobre un número que nadie volvió a mirar.
  for (const [nombre, medido] of [['bot', MEDIDO.botMs], ['a55', MEDIDO.a55Ms]]) {
    const usado = medido / LIGHT_MS;
    assert.ok(usado <= 1 - MARGEN_MINIMO,
      `🔴 el hijo ligero «${nombre}» va al ${(100 * usado).toFixed(1)} % de LIGHT_MS. `
      + 'Si ha crecido hasta aquí, LIGHT_MS necesita el mismo análisis que recibió HEAVY_MS '
      + 'en este ticket, no un ajuste a ojo.');
  }
});

test('SCRUM-265 · el TTL del turno DERIVA del límite nuevo, y la ventana de SCRUM-266 está cerrada', () => {
  // El límite nuevo tiene una consecuencia que no está en el enunciado del ticket: el TTL del
  // turno se deriva de él, así que pasa de 45 a 55 min. Eso abre la ventana de SCRUM-266
  // (`TTL derivado − 45 supuestos`) en la configuración POR DEFECTO, sin ningún override.
  // Antes de SCRUM-266 esto habría hecho rutinario que `turno:tomar` se llevara el turno de una
  // tanda viva. Se fija aquí para que quien vuelva a tocar el límite vea la dependencia.
  const ttl = ttlParaTanda(HEAVY_MS);

  assert.ok(ttl > TTL_POR_DEFECTO_MS,
    '🔴 el TTL derivado ya no supera al supuesto. Si esto deja de ser cierto no hay nada roto, '
    + 'pero la nota de arriba deja de aplicar: revísala antes de borrar este test.');
  assert.equal(ttl, HEAVY_MS + min(10),
    '🔴 el TTL ya no es «el límite mayor + el margen». Si la fórmula cambió, la ventana de '
    + 'SCRUM-266 cambia con ella y hay que volver a medirla.');
});

// ── PUNTO 2 · las TRES respuestas ────────────────────────────────────────────────────────

test('SCRUM-265 · override AUSENTE: se usan los límites por defecto', () => {
  const r = resolverOverride(undefined);
  assert.equal(r.ok, true);
  assert.equal(r.ms, 0, 'ausente tiene que dar 0, que es lo que significa «sin override»');
  assert.equal(limiteDe({ pesado: true }, r.ms), HEAVY_MS);
  assert.equal(limiteDe({ pesado: false }, r.ms), LIGHT_MS);
});

test('SCRUM-265 · override VÁLIDO: manda sobre pesados y ligeros', () => {
  const r = resolverOverride('60000');
  assert.equal(r.ok, true);
  assert.equal(r.ms, 60000);
  assert.equal(limiteDe({ pesado: true }, r.ms), 60000);
  assert.equal(limiteDe({ pesado: false }, r.ms), 60000);
});

test('SCRUM-265 · override PRESENTE E ILEGIBLE: se para, no se supone', () => {
  // ESTE es el caso del ticket. Los otros dos ya funcionaban con el código roto.
  const ilegibles = [
    ['treinta', 'texto que no es número'],
    ['30min', 'número con unidad pegada'],
    ['60000ms', 'milisegundos con el sufijo escrito'],
    ['60_000', 'separador de miles de JS, que Number no acepta'],
    ['', 'presente pero vacía — el dedazo más fácil de cometer'],
    ['   ', 'solo espacios'],
    ['0', 'cero: mataría a todos los hijos al nacer'],
    ['-1000', 'negativo: no significa nada'],
    ['NaN', 'la palabra NaN, que Number sí convierte… a NaN'],
  ];

  for (const [valor, porQue] of ilegibles) {
    const r = resolverOverride(valor);
    assert.equal(r.ok, false,
      `🔴 ${VAR_OVERRIDE}=${JSON.stringify(valor)} (${porQue}) se acepta en vez de abortar.\n\n`
      + '  Con el `|| 0` de antes esto daba 0, y 0 significa «no hay override»: quien pidió un\n'
      + '  límite distinto se llevaba el de por defecto SIN UN SOLO AVISO, y la tanda pasaba.\n'
      + '  Ausente = usa el defecto. Presente e ilegible = error.');
    assert.match(r.motivo, new RegExp(VAR_OVERRIDE),
      '🔴 el motivo no nombra la variable: quien lo lea a las once de la noche tiene que saber '
      + 'QUÉ quitar del entorno, no que «algo» está mal.');
  }
});

// ── QUE EL RUNNER USE ESTO DE VERDAD ─────────────────────────────────────────────────────
// Sin esta parte, todo lo de arriba verifica un módulo que el runner podría no estar usando:
// el número correcto en un fichero que nadie importa es el verde más hueco que hay.

function ast(rel) {
  const codigo = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  return ts.createSourceFile(rel, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function recorrer(n, visita) {
  visita(n);
  n.forEachChild((h) => recorrer(h, visita));
}

/** Accesos a `process.env.<VAR_OVERRIDE>` (o `process.env[VAR_OVERRIDE]`) en un fichero. */
function accesosAlOverride(sf) {
  const hallados = [];
  recorrer(sf, (n) => {
    let esEnv = false;
    if (ts.isPropertyAccessExpression(n)) {
      esEnv = n.name.text === VAR_OVERRIDE && n.expression.getText(sf) === 'process.env';
    } else if (ts.isElementAccessExpression(n)) {
      const arg = n.argumentExpression;
      const nombra = (ts.isStringLiteral(arg) && arg.text === VAR_OVERRIDE)
        || (ts.isIdentifier(arg) && arg.text === 'VAR_OVERRIDE');
      esEnv = nombra && n.expression.getText(sf) === 'process.env';
    }
    if (!esEnv) return;
    const padre = n.parent;
    const envuelto = padre && ts.isCallExpression(padre)
      && ts.isIdentifier(padre.expression) && padre.expression.text === 'resolverOverride'
      && padre.arguments.includes(n);
    hallados.push({ linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, envuelto });
  });
  return hallados;
}

test('SCRUM-265 · el runner lee el override SOLO a través de `resolverOverride`', () => {
  const accesos = accesosAlOverride(ast(RUNNER));

  // SUELO: si el analizador no encuentra ni un acceso, su «0 incumplimientos» significaría a la
  // vez «está bien» y «no miré». Un runner que no lee la variable es un runner que perdió el
  // override entero, y eso también hay que verlo.
  assert.ok(accesos.length >= 1,
    `🔴 el analizador no encuentra ningún acceso a ${VAR_OVERRIDE} en ${RUNNER}. O el override `
    + 'desapareció, o el analizador dejó de reconocer la forma en que se lee. En los dos casos '
    + 'este guard ha dejado de vigilar algo.');

  const crudos = accesos.filter((a) => !a.envuelto).map((a) => a.linea);
  assert.deepEqual(crudos, [],
    `🔴 ${RUNNER} lee ${VAR_OVERRIDE} sin pasar por \`resolverOverride\` (línea${crudos.length > 1 ? 's' : ''} `
    + `${crudos.join(', ')}).\n\n`
    + '  Cualquier lectura directa puede volver a tragarse un valor ilegible: `Number(x) || 0`\n'
    + '  convierte `NaN` en «no hay override» y usa el límite por defecto sin avisar. La\n'
    + '  variable se lee UNA vez y por la función que sabe distinguir las tres respuestas.');
});

test('SCRUM-265 · el runner no guarda su propia copia de los límites', () => {
  // Si el runner declara sus HEAVY_MS/LIGHT_MS, los tests de arriba comprueban un número que
  // el runner no usa: el verde sería sobre `_timeouts-tanda.mjs` y la tanda seguiría muriendo
  // a los 30 min. Es exactamente la forma de verde hueco que este repo persigue.
  const sf = ast(RUNNER);
  const propias = [];
  recorrer(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name)) return;
    if (['HEAVY_MS', 'LIGHT_MS', 'OVERRIDE_MS'].includes(n.name.text) && n.initializer) {
      // `OVERRIDE_MS` sí puede declararse, pero solo como resultado de `resolverOverride`.
      const init = n.initializer.getText(sf);
      if (n.name.text === 'OVERRIDE_MS' && /resolverOverride|\.ms\b/.test(init)) return;
      propias.push(`${n.name.text} (línea ${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1})`);
    }
  });

  assert.deepEqual(propias, [],
    `🔴 ${RUNNER} vuelve a declarar sus propios límites: ${propias.join(', ')}.\n\n`
    + '  Con una copia local, los tests de este fichero verifican `_timeouts-tanda.mjs` y el\n'
    + '  runner corre con otros números. Los límites se importan; no se copian.');
});
