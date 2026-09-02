// scripts/backfill-job-assignees.mjs — SCRUM-650 (T1), paso C
//
// PASA LOS ASIGNADOS DE LA COLUMNA VIEJA A `job_assignees`.
//
//   node scripts/backfill-job-assignees.mjs            # cuenta y NO escribe (por defecto)
//   node scripts/backfill-job-assignees.mjs --aplicar   # escribe
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUÉ CAMPO LO ALIMENTA, Y POR QUÉ NO EL OTRO
//
// **`jobs.assigned_user_id`**, y solo ése. NO `operarioId`.
//
// Son dos ideas distintas y el esquema las declara aparte:
//   · `assignedUserId` — QUIÉN EJECUTA el trabajo (SCRUM-10). Es lo que `job_assignees` guarda.
//   · `operarioId`     — AUTORÍA: quién creó el presupuesto, congelada al aceptarlo (SCRUM-52).
//
// Mezclarlas metería en «los asignados a ejecutar» a gente que solo redactó un presupuesto, y el
// filtro de visibilidad les enseñaría trabajos que no son suyos. El `WHERE` no menciona
// `operario_id` en ninguna parte, y hay un test que lo comprueba.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SUELO DE CEGUERA, que es lo que un `INSERT` de SQL puro NO puede tener
//
// Un `INSERT … SELECT` sobre cero filas inserta cero y **sale con éxito**. Y «cero trabajos con
// asignado» puede significar dos cosas opuestas:
//
//   · no hay nada que migrar   → correcto, no hay que hacer nada;
//   · me he conectado a una base vacía o equivocada → **no he mirado nada**.
//
// Desde fuera son idénticos, así que aquí el cero **PARA** y lo dice. Se sale del suelo a
// propósito con `--permitir-cero`, que hay que teclear: lo que no se puede es cruzarlo sin verlo.
//
// ⚠️ LA URL NO SE PARSEA A MANO (regla de la casa, SCRUM-226): se valida con `parseBDSegura`, que
// es fail-closed contra producción y staging. Sin ella, esto no arranca.
import { parseBDSegura, describirBD } from './_db-guard.mjs';

/** El backfill, tal cual está en `docs/sql/scrum-650-paso-c-backfill.sql`. No se reescribe aquí. */
export const SQL_BACKFILL = `
INSERT INTO "job_assignees" ("job_id", "team_member_id", "assigned_at")
SELECT j."id", j."assigned_user_id", COALESCE(j."updated_at", j."created_at")
FROM "jobs" j
WHERE j."assigned_user_id" IS NOT NULL
ON CONFLICT ("job_id", "team_member_id") DO NOTHING`;

/** Cuántos trabajos tienen asignado en la columna vieja. Es la población del suelo. */
export const SQL_CANDIDATOS = `SELECT count(*)::int AS n FROM "jobs" WHERE "assigned_user_id" IS NOT NULL`;

/** Los que TIENEN asignado y NO están en la tabla. Tras aplicar, tiene que ser 0. */
export const SQL_PENDIENTES = `
SELECT count(*)::int AS n FROM "jobs" j
WHERE j."assigned_user_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "job_assignees" a
    WHERE a."job_id" = j."id" AND a."team_member_id" = j."assigned_user_id")`;

export const SQL_FILAS = `SELECT count(*)::int AS n FROM "job_assignees"`;

/** Lo que se lanza cuando el censo sale a cero y nadie ha dicho que eso esté bien. */
export class CensoCiego extends Error {
  constructor(mensaje) { super(mensaje); this.name = 'CensoCiego'; }
}

/**
 * El backfill, con su suelo. `consulta(sql)` devuelve `{ rows: [...] }` — se inyecta para poder
 * ejercitarlo entero contra un banco de prueba sin montar aquí ningún cliente.
 *
 * @throws {CensoCiego} el censo dio cero y no se pasó `permitirCero`.
 */
export async function backfill(consulta, opciones = {}) {
  const { aplicar = false, permitirCero = false } = opciones;

  const candidatos = (await consulta(SQL_CANDIDATOS)).rows[0].n;
  if (candidatos === 0 && !permitirCero) {
    throw new CensoCiego(
      'CENSO CIEGO · cero trabajos con `assigned_user_id`. Eso NO se puede leer como «no hay nada '
      + 'que migrar»: es indistinguible de «me he conectado a una base vacía o equivocada y no he '
      + 'mirado nada».\n'
      + '  Un `INSERT … SELECT` sobre cero filas inserta cero y SALE BIEN, y ahí es donde un '
      + 'backfill se da por hecho sin haber tocado un dato.\n'
      + '  Si de verdad no hay nada que migrar, dilo a mano: `--permitir-cero`.',
    );
  }

  const antes = (await consulta(SQL_FILAS)).rows[0].n;
  let insertadas = 0;
  if (aplicar) {
    const r = await consulta(SQL_BACKFILL);
    insertadas = typeof r.rowCount === 'number' ? r.rowCount : 0;
  }
  const despues = (await consulta(SQL_FILAS)).rows[0].n;
  const pendientes = (await consulta(SQL_PENDIENTES)).rows[0].n;

  return { candidatos, antes, insertadas, despues, pendientes, aplicado: aplicar };
}

/** El informe, en texto. Se separa para poder compararlo entre dos pasadas sin parsear nada. */
export function informe(r) {
  return [
    `  trabajos con asignado en la columna vieja : ${r.candidatos}`,
    `  filas en job_assignees ANTES              : ${r.antes}`,
    `  filas insertadas                          : ${r.insertadas}`,
    `  filas en job_assignees DESPUÉS            : ${r.despues}`,
    `  PENDIENTES (con asignado y sin fila)      : ${r.pendientes}`,
    `  modo                                      : ${r.aplicado ? 'APLICADO' : 'solo recuento'}`,
  ].join('\n');
}

// ── Ejecución directa ───────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const argv = process.argv.slice(2);
  const url = process.env.SCRUM650_DATABASE_URL || '';
  // 🔴 FAIL-CLOSED: sin URL válida y segura, no se ejecuta NADA. Y no se parsea a mano.
  const bd = parseBDSegura(url);
  console.error('base: ' + describirBD(bd));

  const { default: pgModule } = await import('pg').catch(() => ({ default: null }));
  if (!pgModule) {
    console.error('🔴 falta el cliente `pg`: este script no monta ninguno por su cuenta.');
    process.exit(2);
  }
  const cliente = new pgModule.Client({ connectionString: url });
  await cliente.connect();
  try {
    const r = await backfill((sql) => cliente.query(sql), {
      aplicar: argv.includes('--aplicar'),
      permitirCero: argv.includes('--permitir-cero'),
    });
    console.log(informe(r));
    if (r.aplicado && r.pendientes !== 0) {
      console.error(`🔴 quedan ${r.pendientes} pendientes tras aplicar: el backfill NO está completo.`);
      process.exit(1);
    }
  } finally {
    await cliente.end();
  }
}
