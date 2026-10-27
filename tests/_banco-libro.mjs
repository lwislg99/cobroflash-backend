// tests/_banco-libro.mjs — SCRUM-876e
// El SEGUNDO destino de un test gateado por `QA_DB_TEST`: el banco desechable de `LIBRO_PG_URL`,
// el que CI ya levanta para la tanda (`ci.yml`, «el esquema, en el banco desechable»).
//
// Es el mismo bloque que SCRUM-876c escribió DENTRO de `scrum13-cobrado`, `scrum52-operario` y
// `scrum692-guardado-parcial-en-base`. Aquí vive en un módulo porque hay ficheros que no pueden
// llevarlo dentro: `albaran.test.mjs` importa `dist/…/albaran.service.js` de forma ESTÁTICA, y ese
// módulo construye el cliente de Prisma al cargarse. En ESM los imports se evalúan antes que el
// cuerpo del fichero, así que una asignación de `DATABASE_URL` escrita en el cuerpo llegaría tarde.
// Se importa el SEGUNDO, justo detrás de `./_staging-db.mjs` y antes de cualquier `dist/`.
//
// ⚠️ ESTO ES CÓDIGO DE SEGURIDAD, igual que `_staging-db.mjs`: quien lo importa CREA Y BORRA
// merchants. Tres propiedades, y las tres las fija `scrum876e-el-segundo-destino.test.mjs`:
//   1) NO afloja el primer destino. Con cualquiera de los gates de staging puesto, manda
//      `_staging-db.mjs` y esta variable ni se lee.
//   2) Fail-closed. Una URL que no sea loopback + base terminada en `_test` hace FALLAR el fichero
//      que lo importa (lanza al cargar), no saltarlo.
//   3) Nunca imprime la URL (SCRUM-226).
//
// No es `*.test.mjs` → `node --test` no lo ejecuta como test.
import { parseBDSegura } from '../scripts/_db-guard.mjs';

const GATES_DE_STAGING = ['QA_DB_TEST', 'A55_DB_TEST', 'BOT_SUITE_TEST'];
const mandaStaging = GATES_DE_STAGING.some((g) => process.env[g] === '1');

/** La URL del banco desechable, o '' si este proceso no tiene uno (o manda staging). */
export const URL_BANCO = mandaStaging ? '' : (process.env.LIBRO_PG_URL || '');

if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). Este test crea y borra merchants: no se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
