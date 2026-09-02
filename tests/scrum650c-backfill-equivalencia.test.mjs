// tests/scrum650c-backfill-equivalencia.test.mjs — SCRUM-650 (T1), paso C
//
// TRAS EL BACKFILL, EL FILTRO VE LO MISMO POR LOS DOS SITIOS.
//
// El paso C mueve los asignados de `jobs.assigned_user_id` a filas de `job_assignees`. La pregunta
// que decide si eso se puede hacer sin que nadie pierda sus trabajos es una sola:
//
//   ¿el filtro de visibilidad devuelve LO MISMO leyendo de la tabla que leyendo de la columna?
//
// Si devuelve distinto, eso es el HALLAZGO: se reporta, no se tapa.
//
// ⚠️ QUÉ CAMPO ALIMENTA LA TABLA: `assigned_user_id` (quién EJECUTA, SCRUM-10). NO `operarioId`
// (autoría congelada al aceptar, SCRUM-52). Mezclarlos metería en «los asignados» a gente que solo
// redactó un presupuesto, y el filtro les enseñaría trabajos ajenos. Hay un test de eso abajo.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { backfill, informe, CensoCiego, SQL_BACKFILL } from '../scripts/backfill-job-assignees.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const { loVe } = require_(path.join(RAIZ, 'dist/modules/jobs/domain/asignacionDeTrabajo.js'));

// Los tres empleados del caso real: el parte de papel dice «Israel, Miguel y Jesús.L».
const ISRAEL = 11, MIGUEL = 12, JESUS = 13;

/** Un banco de mentira: una tabla `jobs` en memoria y su `job_assignees`, con el MISMO SQL. */
function bancoDeMentira(jobs) {
  const asignados = new Map(); // "jobId:teamMemberId" → fila
  return {
    filas: () => [...asignados.values()],
    consulta(sql) {
      const s = sql.replace(/\s+/g, ' ').trim();
      if (s.includes('count(*)::int AS n FROM "jobs" WHERE "assigned_user_id" IS NOT NULL')) {
        return { rows: [{ n: jobs.filter((j) => j.assigned_user_id !== null).length }] };
      }
      if (s.includes('count(*)::int AS n FROM "job_assignees"')) {
        return { rows: [{ n: asignados.size }] };
      }
      if (s.startsWith('INSERT INTO "job_assignees"')) {
        let n = 0;
        for (const j of jobs) {
          if (j.assigned_user_id === null) continue;
          const k = `${j.id}:${j.assigned_user_id}`;
          if (asignados.has(k)) continue;          // ON CONFLICT DO NOTHING
          asignados.set(k, { job_id: j.id, team_member_id: j.assigned_user_id });
          n += 1;
        }
        return { rows: [], rowCount: n };
      }
      if (s.includes('NOT EXISTS')) {
        const n = jobs.filter((j) => j.assigned_user_id !== null
          && !asignados.has(`${j.id}:${j.assigned_user_id}`)).length;
        return { rows: [{ n }] };
      }
      throw new Error('el banco de mentira no conoce esta consulta: ' + s.slice(0, 80));
    },
  };
}

const JOBS = [
  { id: 1, assigned_user_id: ISRAEL, operario_id: null },
  { id: 2, assigned_user_id: MIGUEL, operario_id: ISRAEL },
  { id: 3, assigned_user_id: null, operario_id: JESUS },   // sin asignar: invisible para técnicos
  { id: 4, assigned_user_id: ISRAEL, operario_id: MIGUEL },
];

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-650c · SUELO: el banco de mentira ejecuta el MISMO SQL del fichero', () => {
  // Si el banco no reconociera el SQL real, todo lo de abajo mediría una copia inventada.
  const b = bancoDeMentira(JOBS);
  assert.equal(b.consulta(SQL_BACKFILL).rowCount, 3,
    '🔴 el banco no ejecuta el `INSERT` real del backfill: lo de abajo no probaría el fichero.');
  assert.ok(SQL_BACKFILL.includes('assigned_user_id'),
    '🔴 el SQL del backfill ya no menciona `assigned_user_id`.');
});

// ── 🔴 EL SUELO DE CEGUERA ──────────────────────────────────────────────────────────────────

test('SCRUM-650c · 🔴 CERO trabajos con asignado NO se lee como «nada que migrar»: PARA', async () => {
  const vacio = bancoDeMentira([{ id: 1, assigned_user_id: null, operario_id: null }]);
  await assert.rejects(
    () => backfill((sql) => vacio.consulta(sql)),
    (e) => {
      assert.equal(e.name, 'CensoCiego',
        '🔴 con cero candidatos el backfill sigue adelante y sale bien. Un `INSERT … SELECT` sobre ' +
        'cero filas inserta cero y NO falla: así es como un backfill se da por hecho sin haber ' +
        'tocado un dato, y «base vacía» es indistinguible de «nada que migrar».');
      assert.match(e.message, /CENSO CIEGO/);
      assert.match(e.message, /--permitir-cero/,
        '🔴 el rojo no dice cómo salir de él a propósito: un guard que no enuncia la salida se ' +
        'resuelve mal.');
      return true;
    },
  );
  // Y con la salida explícita, sigue: lo que no se puede es cruzarlo sin verlo.
  const r = await backfill((sql) => vacio.consulta(sql), { permitirCero: true, aplicar: true });
  assert.equal(r.candidatos, 0);
});

// ── 🔴 IDEMPOTENCIA, MEDIDA ─────────────────────────────────────────────────────────────────

test('SCRUM-650c · 🔴 correrlo DOS VECES deja exactamente el mismo resultado', async () => {
  const b = bancoDeMentira(JOBS);
  const una = await backfill((sql) => b.consulta(sql), { aplicar: true });
  const dos = await backfill((sql) => b.consulta(sql), { aplicar: true });

  assert.equal(una.insertadas, 3, `🔴 la primera pasada insertó ${una.insertadas} y son 3.`);
  assert.equal(dos.insertadas, 0,
    `🔴 la SEGUNDA pasada insertó ${dos.insertadas} filas. El backfill duplica al repetirse, y ` +
    'entonces no se puede volver a correr si la primera se queda a medias.');
  assert.equal(una.despues, dos.despues,
    '🔴 el número de filas cambia entre pasadas: no es idempotente.');
  assert.equal(dos.pendientes, 0);
});

// ── 🔴 LA EQUIVALENCIA, QUE ES LO QUE DECIDE ────────────────────────────────────────────────

test('SCRUM-650c · 🔴 tras el backfill, el filtro ve LO MISMO por los dos sitios', async () => {
  const b = bancoDeMentira(JOBS);
  await backfill((sql) => b.consulta(sql), { aplicar: true });
  const filas = b.filas();

  for (const quien of [ISRAEL, MIGUEL, JESUS]) {
    // ① Leyendo de la COLUMNA VIEJA, como hace el filtro hoy.
    const porColumna = JOBS.filter((j) => loVe(
      { operarioId: j.operario_id, assignedUserId: j.assigned_user_id }, quien)).map((j) => j.id);
    // ② Leyendo de la TABLA, como hará cuando la columna se retire.
    const porTabla = JOBS.filter((j) => loVe({
      operarioId: j.operario_id,
      assignedUserId: null,
      asignados: filas.filter((f) => f.job_id === j.id).map((f) => f.team_member_id),
    }, quien)).map((j) => j.id);

    assert.deepEqual(porTabla, porColumna,
      `🔴 EL FILTRO NO VE LO MISMO POR LOS DOS SITIOS para el empleado ${quien}:\n` +
      `    por la columna vieja: ${JSON.stringify(porColumna)}\n` +
      `    por job_assignees   : ${JSON.stringify(porTabla)}\n` +
      '  Retirar la columna le cambiaría los trabajos a alguien. Esto NO se tapa: es el hallazgo.');
  }

  // Suelo del caso: si nadie viera nada, los `deepEqual` de arriba pasarían vacíos.
  const deIsrael = JOBS.filter((j) => loVe(
    { operarioId: j.operario_id, assignedUserId: j.assigned_user_id }, ISRAEL)).map((j) => j.id);
  assert.deepEqual(deIsrael, [1, 2, 4],
    `🔴 ISRAEL ve ${JSON.stringify(deIsrael)} y tenían que ser [1, 2, 4] — dos asignados y uno por ` +
    'autoría. Si esto sale vacío, la comparación de arriba no probaba nada.');
});

// ── 🔴 `operarioId` NO ENTRA EN LA TABLA ────────────────────────────────────────────────────

test('SCRUM-650c · 🔴 el backfill NO mete la AUTORÍA en los asignados', async () => {
  const b = bancoDeMentira(JOBS);
  await backfill((sql) => b.consulta(sql), { aplicar: true });
  const filas = b.filas();

  // El trabajo 3 tiene `operario_id: JESUS` y NINGÚN asignado: no puede aparecer.
  assert.equal(filas.some((f) => f.job_id === 3), false,
    '🔴 el trabajo 3 no tiene asignado —solo autoría— y ha entrado en `job_assignees`. El backfill ' +
    'está mezclando `operarioId` con `assignedUserId`: son dos ideas distintas (SCRUM-52 vs ' +
    'SCRUM-10), y con esa mezcla el filtro le enseñaría a un redactor de presupuestos trabajos que ' +
    'no ejecuta.');
  // Y el 2, cuyo operario es ISRAEL y su asignado MIGUEL, solo mete a MIGUEL.
  const del2 = filas.filter((f) => f.job_id === 2).map((f) => f.team_member_id);
  assert.deepEqual(del2, [MIGUEL],
    `🔴 el trabajo 2 mete ${JSON.stringify(del2)} y solo tenía que meter al asignado (${MIGUEL}). ` +
    'Su `operario_id` es otra cosa.');

  const sql = fs.readFileSync(path.join(RAIZ, 'docs/sql/scrum-650-paso-c-backfill.sql'), 'utf8')
    .replace(/^\s*--.*$/gm, ' ');
  assert.equal(/operario_id/.test(sql), false,
    '🔴 el SQL del backfill menciona `operario_id`. La tabla es de quién EJECUTA, no de quién ' +
    'redactó: no se unifican.');
});
