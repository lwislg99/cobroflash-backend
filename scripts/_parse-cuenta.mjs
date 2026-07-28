// scripts/_parse-cuenta.mjs — SCRUM-197: parseo del resumen de node:test, EXTRAÍDO para poder testearlo.
//
// `parseCuenta` es la ÚNICA función que sostiene la distinción CRASH-vs-ROJO del recibo (SCRUM-197):
// de sus contadores por hijo sale el `fail` PROPIO que separa un crash (fail=0) de un rojo (fail>0).
// Vivía dentro de test-staging-gated.mjs, que no se puede importar sin EJECUTAR la tanda entera, así
// que ningún test la ejercitaba — un dato del que depende una decisión, sin registrar (el defecto que
// SCRUM-197 cierra, un escalón más abajo). Aquí, pura y aislada, su comportamiento queda fijado en
// tests/scrum197-parse-cuenta.test.mjs, sobre todo con salida TRUNCADA, que es donde tiene menos que leer.

/** Las categorías del resumen de node:test (spec `ℹ` / tap `#`). Se cuentan TODAS para poder cuadrar
 *  la suma: si node reporta cancelled/todo y no se contaran, la suma no daría el total por diseño. */
export const CATS = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'];

/**
 * Cuenta las categorías del resumen de node:test presentes en `salida`.
 *
 * GARANTÍAS (fijadas en el test, de ellas depende SCRUM-197):
 *   · Sin línea de resumen (crash antes del resumen, salida vacía/null/undefined) → TODO CEROS, y
 *     NUNCA lanza. Así un crash deja `fail=0` y el validador lo lee como crash, no como rojo.
 *   · Resumen a medias (cortado) → parcial cuya suma NO cuadra con `tests`. Eso es lo que dispara
 *     REGLA B en el runner (segunda capa: un desglose inconsistente no llega a escribirse en el recibo).
 */
export function parseCuenta(salida) {
  const c = Object.fromEntries(CATS.map((k) => [k, 0]));
  const re = /^[#ℹ]\s+(tests|pass|fail|cancelled|skipped|todo)\s+(\d+)/gm;
  let m;
  while ((m = re.exec(salida)) !== null) c[m[1]] = Number(m[2]);
  return c;
}
