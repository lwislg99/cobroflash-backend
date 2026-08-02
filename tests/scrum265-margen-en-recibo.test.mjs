// tests/scrum265-margen-en-recibo.test.mjs — SCRUM-265: la tanda reporta su propio margen.
//
// SIN GATE, SIN BD, SIN TURNO. El bloque QA acabó en ~28 min con un límite de 30 y nadie lo
// sabía: se descubrió de casualidad. Un hijo al 93 % de su límite y uno al 10 % salen iguales.
//
// Los DOS rojos que este fichero sostiene:
//   (a) el margen no está en el recibo  → guards de fuente sobre el runner.
//   (b) EL QUE IMPORTA: un hijo ABORTADO POR TIEMPO deja su margen escrito. Antes se quedaba en
//       `null` porque el `continue` de la rama de timeout va ANTES de donde se anotaba nada.
//       El único caso en que el margen importa de verdad era el único que no lo escribía.
//
// El (b) se prueba con un `spawnSync` REAL contra un hijo de mentira y un límite ridículo: no
// hace falta staging, y no es una copia de la lógica — es la MISMA función que usa el runner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  medirMargen, porcentajeDeLimite, textoDeMargen, esAbortadoPorTiempo,
  margenesVacios, MARGEN_SIN_ARRANCAR,
} from '../scripts/_margen-tanda.mjs';
import { leerFuente } from './_guard-texto.mjs';

const RUNNER = 'scripts/test-staging-gated.mjs';

// ── EL DATO CRUDO ────────────────────────────────────────────────────────────
test('SCRUM-265 · el recibo guarda CRUDO (durMs y limiteMs), no el porcentaje', () => {
  const m = medirMargen(1_000, 30 * 60_000, 1_000 + 28 * 60_000);
  assert.deepEqual(m, { durMs: 28 * 60_000, limiteMs: 30 * 60_000 });
  // Guardar solo el % perdería información y no se podría recomponer.
  assert.equal(Object.hasOwn(m, 'porcentaje'), false);
});

test('SCRUM-265 · el porcentaje se DERIVA al leer (28 de 30 min = 93 %)', () => {
  const m = { durMs: 28 * 60_000, limiteMs: 30 * 60_000 };
  assert.equal(porcentajeDeLimite(m), 93); // el caso real que motivó el ticket
  assert.equal(porcentajeDeLimite({ durMs: 3 * 60_000, limiteMs: 30 * 60_000 }), 10);
  assert.equal(textoDeMargen(m), ' · 93% del límite');
});

test('SCRUM-265 · sin margen o con límite 0 el porcentaje es null, no 0', () => {
  // Un 0 se leería como «tardó nada». Un null dice «no se puede calcular», que es la verdad.
  assert.equal(porcentajeDeLimite(null), null);
  assert.equal(porcentajeDeLimite({ durMs: 5, limiteMs: 0 }), null);
  assert.equal(textoDeMargen(null), '');
});

// ── EL CASO DEL HIJO QUE NO ARRANCÓ (requisito declarado) ────────────────────
test('SCRUM-265 · «no arrancó» y «arrancó» se distinguen por FORMA, no por valor', () => {
  const vacios = margenesVacios(['a55', 'bot', 'qa']);
  assert.deepEqual(vacios, { a55: null, bot: null, qa: null });
  assert.equal(MARGEN_SIN_ARRANCAR, null);

  // Un hijo que arrancó tiene SIEMPRE objeto con los dos números — aunque tardara 0 ms.
  const arrancoYFueInstantaneo = medirMargen(500, 60_000, 500);
  assert.deepEqual(arrancoYFueInstantaneo, { durMs: 0, limiteMs: 60_000 });
  // Y por eso no hay un cero ambiguo: null y {durMs:0} no se confunden.
  assert.notEqual(arrancoYFueInstantaneo, MARGEN_SIN_ARRANCAR);
  assert.equal(vacios.qa, MARGEN_SIN_ARRANCAR);
});

// ── (b) EL ROJO QUE IMPORTA · hijo de mentira, límite ridículo, spawnSync REAL ─
test('SCRUM-265 · (b) un hijo ABORTADO POR TIEMPO deja su margen escrito', () => {
  const margenes = margenesVacios(['fantasma']);
  const LIMITE_MS = 120; // ridículo a propósito: el hijo duerme mucho más

  const t0 = Date.now();
  const res = spawnSync(
    process.execPath,
    ['-e', 'setTimeout(() => {}, 60000)'], // hijo de mentira: no termina nunca a tiempo
    { encoding: 'utf8', timeout: LIMITE_MS, killSignal: 'SIGTERM' },
  );
  // Mismo orden que el runner: medir y anotar ANTES de mirar si fue timeout.
  const margen = medirMargen(t0, LIMITE_MS);
  margenes.fantasma = margen;

  assert.equal(esAbortadoPorTiempo(res), true, 'el hijo de mentira tiene que morir por tiempo, o este test no prueba nada');
  assert.notEqual(margenes.fantasma, null, 'un hijo abortado por tiempo NO puede quedarse sin margen: es el caso que motiva el ticket');
  assert.equal(margenes.fantasma.limiteMs, LIMITE_MS);
  assert.ok(margenes.fantasma.durMs >= LIMITE_MS, `debe haber consumido al menos su límite (durMs=${margenes.fantasma.durMs}, límite=${LIMITE_MS})`);
  assert.ok(porcentajeDeLimite(margenes.fantasma) >= 100, 'un abortado por tiempo consumió el 100 % o más');
});

test('SCRUM-265 · esAbortadoPorTiempo NO confunde un fallo normal con un timeout', () => {
  const res = spawnSync(process.execPath, ['-e', 'process.exit(1)'], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(res.status, 1);
  assert.equal(esAbortadoPorTiempo(res), false, 'un exit≠0 que SÍ terminó no es un abortado por tiempo');
});

// ── (a) GUARDS DE FUENTE · el runner es un script, no se puede importar ───────
// `leerFuente` devuelve el fuente SIN comentarios (SCRUM-193): si no, estos asserts casarían la
// prosa que explica la regla y el guard se cazaría a sí mismo.
test('SCRUM-265 · (a) el recibo del runner incluye `margenes`', () => {
  const fuente = leerFuente(RUNNER);
  assert.match(fuente, /\bmargenes,/, 'el objeto `recibo` debe llevar `margenes`');
});

test('SCRUM-265 · `margenes` es un mapa HERMANO de `hijos`, nunca anidado dentro', () => {
  const fuente = leerFuente(RUNNER);
  // El desglose de VEREDICTO sigue escribiéndose solo con sus cuatro campos.
  assert.match(fuente, /desgloseHijos\[h\.clave\] = \{ exit: code, tests: c\.tests, pass: c\.pass, fail: c\.fail \};/,
    'el desglose de hijos no debe ganar campos de observación: eso rompe la clasificación del validador');
  assert.doesNotMatch(fuente, /desgloseHijos\[h\.clave\] = \{[^}]*durMs/,
    'el margen NUNCA va dentro de desgloseHijos: una entrada que deja de ser null cae en la rama «incompleto», que no escala en remedioDominante');
});

test('SCRUM-265 · el margen se anota ANTES del corte por timeout (el orden ES el ticket)', () => {
  const fuente = leerFuente(RUNNER);
  const anota = fuente.indexOf('margenes[h.clave] = margen;');
  const corta = fuente.indexOf('if (esAbortadoPorTiempo(res))');
  assert.ok(anota > 0, 'no encuentro dónde se anota el margen');
  assert.ok(corta > 0, 'no encuentro la rama del timeout');
  assert.ok(
    anota < corta,
    'el margen se anota DESPUÉS del corte por timeout: el hijo que agota su límite volvería a ' +
    'quedarse sin dato, que es exactamente el defecto que SCRUM-265 cierra',
  );
});
