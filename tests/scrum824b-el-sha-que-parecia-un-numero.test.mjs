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

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ EL CONTROL SIMÉTRICO — y va por la CADENA REAL, no por copias a mano
//
// 🔴 ES EL DE S6 DADO LA VUELTA, y el crédito es suyo: su control ⑤
// (`scrum-824b-el-vigia-que-no-deja-pasar`, ce14d37f) afirmaba que un `prod=` de ocho dígitos NO
// se puede leer, y con su arreglo —minar el sha en el fixture— eso era cierto. Con éste ya no lo
// es: el vigía SÍ lo lee, que es justamente lo que se ha arreglado. Su test no se tira, se
// invierte.
//
// Lo que SÍ se conserva entero de ella, porque estaba bien hecho: **no se copia el renglón a
// mano, se le PIDE al formateador de verdad** (`constanciaDeEjecucion`) y se lee con
// `ultimaLectura`. Si mañana cambia el formato de la constancia, esto cae y avisa, en vez de
// seguir comparando contra una transcripción que ya no corresponde.
//
// Las DOS mitades van en el MISMO test a propósito: un control que sólo probara «el sha se lee»
// pasaría con un vigía que lo lee TODO, incluido el reloj — y eso es el defecto de enfrente.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-824b · ✅ SIMÉTRICO por la cadena real: el sha de ocho dígitos SE LEE, el reloj de trece NO', async () => {
  const { constanciaDeEjecucion } = await import('../scripts/_vigilante-de-despliegue.mjs');
  const { ultimaLectura, ritmoDeDespliegue, NO_SE_SABE } = await import('../scripts/_ritmo-de-despliegue.mjs');

  const otro = 'deadbeef' + '0'.repeat(32);
  const porLaCadena = (versionDeProduccion) => {
    const { renglon } = constanciaDeEjecucion(
      { veredicto: 'atrasado', horas: 48, titulo: '' },
      { versionDeProduccion, shaDeMain: otro, commitsPorDelante: 1, ahoraEpoch: 1757000000 },
    );
    return { renglon, ritmo: ritmoDeDespliegue(ultimaLectura(renglon), { versionDeProduccion: otro }).ritmo };
  };

  // ── ① EL SHA DE OCHO DÍGITOS SE LEE. Es el caso del informe (`40606975`) y el que bloqueaba.
  const sha = porLaCadena('40606975' + 'a'.repeat(32));
  assert.match(sha.renglon, /prod=\d{8} /,
    '🔴 CIEGO: la constancia no ha salido con `prod=` de ocho dígitos, así que lo de abajo no '
    + 'prueba nada. Se le pide al formateador de verdad justamente para que esto no se dé por hecho.');
  assert.notEqual(sha.ritmo, NO_SE_SABE,
    '🔴 el vigía SIGUE sin leer un sha corto de ocho dígitos. Es el rojo intermitente entero: pasa '
    + 'en el 2,3 % de los shas y no manda a nadie a mirar, sólo a relanzar la tanda.');

  // ── ② Y EL RELOJ NO. Sin esta mitad, el control de arriba lo pasaría un vigía que lo lee TODO.
  const reloj = porLaCadena(String(Date.now()));
  assert.equal(reloj.ritmo, NO_SE_SABE,
    '🔴 EL VIGÍA SE CREE UN RELOJ. Sin `RAILWAY_GIT_COMMIT_SHA`, producción publica '
    + '`String(Date.now())`; dos lecturas de ésas darían «despliega» siempre, porque el tiempo '
    + 'avanza. Leer el sha corto no puede costar esto.');

  // ⚠️ Y POR QUÉ NO SE CONFUNDEN AL GUARDARSE, medido aquí y no supuesto: `corto()` sólo abrevia
  // lo que es un sha40; cualquier otra cosa se escribe como `?`. Así que un reloj NUNCA queda en
  // la constancia truncado a ocho dígitos, que es lo único que rompería el criterio por longitud.
  assert.match(reloj.renglon, /prod=\? /,
    '🔴 la constancia ha guardado el RELOJ como si fuera un sha. Si se truncara a ocho dígitos, '
    + 'sería indistinguible de un sha corto y el arreglo por longitud dejaría de valer.');
  // ── ③ 🔴 EL RELOJ CRUDO, POR EL LADO DE `/version` — y esta pata hubo que añadirla porque la
  // mutación la destapó.
  //
  // Al mutar el vigía para que ACEPTE trece dígitos, las dos mitades de arriba seguían VERDES: por
  // la constancia el reloj nunca llega a `shaLegible` como trece dígitos, porque `corto()` ya lo
  // ha convertido en `?`. O sea que esa mitad la protege el FORMATEADOR, no el criterio nuevo — y
  // un control que no vigila lo que dice vigilar es el defecto que este ticket entero persigue.
  //
  // En producción el reloj SÍ llega crudo: `/version` se lee tal cual y no pasa por `corto()`.
  // Ése es el camino que prueba el criterio, y es el que cae si alguien se lo quita.
  const conSha = constanciaDeEjecucion(
    { veredicto: 'atrasado', horas: 48, titulo: '' },
    { versionDeProduccion: '40606975' + 'a'.repeat(32), shaDeMain: otro, commitsPorDelante: 1, ahoraEpoch: 1757000000 },
  ).renglon;
  const relojCrudo = ritmoDeDespliegue(ultimaLectura(conSha), { versionDeProduccion: String(Date.now()) }).ritmo;
  assert.equal(relojCrudo, NO_SE_SABE,
    '🔴 con la lectura de AHORA siendo un reloj de trece dígitos leído de `/version`, el vigía la '
    + 'da por buena. Dos lecturas así dirían «despliega» siempre, porque el tiempo avanza: una '
    + 'alarma que firma un verde justo cuando no se sabe qué corre.');
});
