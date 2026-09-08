// tests/scrum824b-el-sha-que-parecia-un-numero.test.mjs — SCRUM-824b
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL ROJO INTERMITENTE DE `scrum716c`: UN SHA CORTO QUE PARECÍA UN NÚMERO.
//
// ── EL SÍNTOMA ──────────────────────────────────────────────────────────────────────────────
// `scrum716c` fallaba en CI de vez en cuando, en :255 y en :291, y sobre `main` limpio daba 8/8.
// El informe decía «producción dice `40606975`, un número y no un sha». **No era un número**: era
// un sha corto de ocho caracteres que, por casualidad, son todos dígitos.
//
// ── EL MECANISMO ────────────────────────────────────────────────────────────────────────────
// `shaLegible` rechazaba TODO lo que fuese enteramente dígitos, para cazar el fallback de
// `env.ts` (`String(Date.now())`). El precio estaba DECLARADO en el propio comentario —«un sha
// abreviado que salga todo dígitos también se rechaza… en torno al 2 %»— y se aceptaba porque
// «el error va en la dirección segura».
//
// 🔴 PERO NO ERA GRATIS. Ese 2 % es, en CI, un ROJO INTERMITENTE. Y un rojo intermitente es peor
// que uno fijo: no manda a nadie a mirar, entrena a relanzar la tanda. Medido: **2,32 %, 1 de
// cada 43** (200.000 muestras de 8 hexadecimales).
//
// ── EL ARREGLO, EN EL CÓDIGO DEL VIGÍA ──────────────────────────────────────────────────────
// Se distingue por LONGITUD, no por «ser dígitos». El fallback es un epoch en milisegundos: 13
// caracteres. Un sha en este sistema es 8 (la constancia hace `.slice(0, 8)`) o 40 (`/version`).
// Son formas distintas y no se confunden.
//
// ⚠️ La seguridad NO se pierde, y es la condición de este arreglo: ante un reloj se sigue
// callando. Lo que se deja de hacer es callar ante un commit.
//
// ⛔ No se ha relajado nada de lo que el vigía exige, ni se espera, ni se reintenta (regla 41).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { ritmoDeDespliegue } from '../scripts/_ritmo-de-despliegue.mjs';

const ritmo = (antes, ahora) =>
  ritmoDeDespliegue({ versionDeProduccion: antes }, { versionDeProduccion: ahora }).ritmo;

// El del informe de CI. Ocho hexadecimales, todos dígitos, y un commit perfectamente válido.
const SHA_TODO_DIGITOS = '40606975';
const OTRO_SHA = 'fc0ab675';
// `String(Date.now())` — trece caracteres. Es lo que publica producción cuando le falta
// `RAILWAY_GIT_COMMIT_SHA`, y es lo ÚNICO que hay que rechazar.
const RELOJ = '1788742571305';

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE: un sha corto todo dígitos YA NO se descarta
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-824b · 🔴 un sha corto de dígitos SE LEE: es un commit, no un reloj', () => {
  assert.equal(ritmo(SHA_TODO_DIGITOS, OTRO_SHA), 'despliega',
    '🔴 se sigue descartando un sha corto por ser todo dígitos. Es el rojo INTERMITENTE de '
    + '`scrum716c`: pasa en el 2,3 % de los shas de ocho, no manda a nadie a mirar y entrena a '
    + 'relanzar la tanda.');

  assert.equal(ritmo(SHA_TODO_DIGITOS, SHA_TODO_DIGITOS), 'congelado',
    '🔴 con el MISMO sha en las dos lecturas hay que decir CONGELADO. Si esto dijera «no se sabe», '
    + 'el arreglo habría cambiado el descarte por otro silencio.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ Y LA SEGURIDAD NO SE PIERDE — es la condición del arreglo, no un extra
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-824b · ✅ ante un RELOJ se sigue callando: el fallback de `env.ts` no engaña al vigía', () => {
  // Dos relojes distintos serían «despliega» cada vez, porque el tiempo siempre avanza: una
  // alarma que dice que todo va bien justo cuando no se sabe qué corre.
  assert.equal(ritmo(RELOJ, '1788742571999'), 'no-se-sabe',
    '🔴 EL VIGÍA SE CREE UN RELOJ. Sin `RAILWAY_GIT_COMMIT_SHA`, producción publica '
    + '`String(Date.now())`, y dos lecturas de ésas darían «despliega» siempre. Es exactamente lo '
    + 'que el descarte por dígitos venía a impedir, y no se puede perder al arreglarlo.');

  assert.equal(ritmo(RELOJ, OTRO_SHA), 'no-se-sabe',
    '🔴 con la lectura ANTERIOR siendo un reloj no hay de dónde partir: sigue siendo «no se sabe».');
  assert.equal(ritmo(OTRO_SHA, RELOJ), 'no-se-sabe',
    '🔴 con la lectura de AHORA siendo un reloj tampoco se puede comparar.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SUELO · el caso del informe existe de verdad, y no es una rareza inventada para pasar
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-824b · 🔴 SUELO: un sha de ocho todo dígitos es FRECUENTE, no una anécdota', () => {
  // (10/16)^8 ≈ 2,3 %. Se calcula, no se cita: si algún día git abreviara con otra longitud, este
  // número cambia y quien lo lea verá por qué.
  const p = Math.pow(10 / 16, 8);
  assert.ok(p > 0.02 && p < 0.03,
    `🔴 la probabilidad calculada es ${(p * 100).toFixed(2)} % y se esperaba ~2,3 %. Si ha cambiado, `
    + 'ha cambiado la longitud del sha abreviado y hay que volver a mirar el arreglo entero.');

  // Y que la forma del reloj y la del sha NO se solapan en longitud, que es sobre lo que se apoya
  // todo esto. Si algún día se solaparan, este arreglo dejaría de poder distinguirlas.
  assert.notEqual(SHA_TODO_DIGITOS.length, RELOJ.length,
    '🔴 el sha corto y el reloj tienen la MISMA longitud: entonces no se pueden distinguir por '
    + 'longitud y este arreglo se apoya en algo que ya no es cierto.');
  assert.equal(RELOJ.length, 13, '🔴 `String(Date.now())` ha dejado de tener trece caracteres.');
});
