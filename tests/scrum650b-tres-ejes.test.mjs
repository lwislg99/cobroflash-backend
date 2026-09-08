// tests/scrum650b-tres-ejes.test.mjs — SCRUM-650 (T1), fase B · paso B
//
// LOS TRES EJES DECIDEN QUIÉN VE UN TRABAJO.
//
//   ① `operarioId`     — lo creó él (autoría congelada, SCRUM-52)
//   ② `assignedUserId` — se lo asignaron por la columna de siempre (SCRUM-10)
//   ③ `job_assignees`  — se lo asignaron por la tabla puente (SCRUM-650)
//
// 🔴 EL TERCERO NO ES COSMÉTICO. Sin él, un técnico asignado por la tabla NUEVA no ve su trabajo —
// que es LITERALMENTE el defecto que SCRUM-467 arregló: había 6 trabajos con `assignedUserId`
// escrito que no miraba nadie. No se reintroduce.
//
// Los tests de SCRUM-467 siguen verdes y SIN TOCAR: esto AMPLÍA la garantía, no la cambia.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const { loVe, EJES_DE_VISIBILIDAD } =
  require_(path.join(RAIZ, 'dist/modules/jobs/domain/asignacionDeTrabajo.js'));

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

// Los empleados del caso real, con nombre: el parte de papel dice «Israel, Miguel y Jesús.L».
const ISRAEL = 11, MIGUEL = 12, JESUS = 13, AJENO = 99;

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-650b · SUELO: hay TRES ejes declarados y la decisión los usa', () => {
  assert.equal(EJES_DE_VISIBILIDAD.length, 3,
    `🔴 se declaran ${EJES_DE_VISIBILIDAD.length} ejes y son TRES. Si baja a dos, alguien deja de ` +
    'ver sus trabajos y este fichero tiene que decirlo antes que el técnico.');
  // Control positivo del instrumento: si `loVe` dijera «sí» a todo, los controles negativos de
  // abajo pasarían sin medir nada.
  assert.equal(loVe({}, ISRAEL), false,
    '🔴 un trabajo SIN ninguno de los tres ejes se ve. Entonces `loVe` dice que sí a todo.');
});

// ── 🔴 CONTROL POSITIVO: CON DOS ASIGNADOS, LOS DOS LO VEN ──────────────────────────────────

test('SCRUM-650b · 🔴 con DOS empleados asignados, LOS DOS ven el trabajo', () => {
  // Probar con UNO no distingue «asignación múltiple» de «asignación al último».
  const trabajo = { operarioId: null, assignedUserId: ISRAEL, asignados: [ISRAEL, MIGUEL] };

  assert.equal(loVe(trabajo, ISRAEL), true,
    '🔴 ISRAEL está asignado y NO ve el trabajo. Es el primero de la lista y además el principal ' +
    'de la columna: si él no lo ve, no lo ve nadie.');
  assert.equal(loVe(trabajo, MIGUEL), true,
    '🔴 MIGUEL está asignado por la TABLA y no ve el trabajo. Éste es el defecto exacto: la ' +
    'asignación múltiple guardada y un técnico que abre la app y no tiene nada. Con la columna ' +
    'sola solo se ve al principal, y el segundo asignado desaparece.');

  // Y con TRES, como en el parte de papel: los tres.
  const tres = { operarioId: null, assignedUserId: ISRAEL, asignados: [ISRAEL, MIGUEL, JESUS] };
  const losQueVen = [ISRAEL, MIGUEL, JESUS].filter((id) => loVe(tres, id));
  assert.deepEqual(losQueVen, [ISRAEL, MIGUEL, JESUS],
    `🔴 de los tres asignados solo ven el trabajo ${JSON.stringify(losQueVen)}. El parte en papel ` +
    'de la empresa dice «Israel, Miguel y Jesús.L» en una línea: los tres tienen que verlo.');
});

// ── 🔴 CONTROL NEGATIVO: UN TERCERO NO LO VE ────────────────────────────────────────────────

test('SCRUM-650b · 🔴 CONTROL NEGATIVO: quien NO está asignado no lo ve', () => {
  const trabajo = { operarioId: null, assignedUserId: ISRAEL, asignados: [ISRAEL, MIGUEL] };
  assert.equal(loVe(trabajo, JESUS), false,
    '🔴 JESÚS no está asignado a este trabajo y LO VE. El filtro no filtra: cualquier técnico ve ' +
    'todos los trabajos del negocio, que es lo contrario de lo que este ticket entrega.');

  // Enumerado, para que el rojo diga QUIÉN y QUÉ trabajo.
  const trabajos = [
    { id: 1, asignados: [ISRAEL] },
    { id: 2, asignados: [MIGUEL] },
    { id: 3, asignados: [ISRAEL, MIGUEL] },
    { id: 4, asignados: [] },
  ];
  const deIsrael = trabajos.filter((t) => loVe(t, ISRAEL)).map((t) => t.id);
  const deMiguel = trabajos.filter((t) => loVe(t, MIGUEL)).map((t) => t.id);
  const deJesus = trabajos.filter((t) => loVe(t, JESUS)).map((t) => t.id);

  assert.deepEqual(deIsrael, [1, 3], `🔴 ISRAEL ve ${JSON.stringify(deIsrael)} y son [1, 3].`);
  assert.deepEqual(deMiguel, [2, 3], `🔴 MIGUEL ve ${JSON.stringify(deMiguel)} y son [2, 3].`);
  assert.deepEqual(deJesus, [], `🔴 JESÚS no tiene ninguno asignado y ve ${JSON.stringify(deJesus)}.`);
});

test('SCRUM-650b · un trabajo SIN NADIE es invisible para todo técnico', () => {
  // Decisión del fundador: se puede dejar sin asignar, y entonces solo lo ven los admin — que no
  // pasan por este filtro. Se prueba para que nadie lo «arregle» dándoselo a alguien.
  const huerfano = { operarioId: null, assignedUserId: null, asignados: [] };
  for (const quien of [ISRAEL, MIGUEL, JESUS]) {
    assert.equal(loVe(huerfano, quien), false,
      `🔴 un trabajo sin ningún asignado lo ve ${quien}. Sin nadie asignado es INVISIBLE para los ` +
      'técnicos: solo lo ven los admin.');
  }
});

// ── 🔴 REGLA 2 ──────────────────────────────────────────────────────────────────────────────

test('SCRUM-650b · 🔴 REGLA 2: el eje NUNCA sustituye al filtro por merchant', () => {
  const ruta = sinComentarios(leer('src/modules/jobs/app/routes/jobs.routes.ts'));
  // El `where` del listado tiene que llevar SIEMPRE `merchantId`, y el `OR` va ENCIMA, no en su
  // lugar: un `OR` sin `merchantId` dejaría ver trabajos de otro negocio a quien acierte un id.
  assert.match(ruta, /=\s*\{\s*merchantId: req\.merchantId\s*\}/,
    '🔴 el `where` del listado ya no parte de `merchantId`. El filtro por empleado va ENCIMA del ' +
    'row-level, nunca en su lugar: sin él, un técnico vería trabajos de OTRO merchant.');

  // Y la escritura valida cada id contra el merchant, uno a uno.
  assert.match(ruta, /findFirst\(\{ where: \{ id: uid, merchantId: req\.merchantId \} \}\)/,
    '🔴 los ids que se asignan ya no se validan contra el merchant: se podría asignar un trabajo ' +
    'a un empleado de otro negocio, y entonces ese empleado lo vería.');
});

// ── QUE LOS TRES EJES LLEGUEN A LAS DOS RUTAS ───────────────────────────────────────────────

test('SCRUM-650b · 🔴 las DOS rutas consumen la MISMA fuente de ejes', () => {
  const RUTAS = [
    ['src/modules/jobs/app/routes/jobs.routes.ts', 'el listado de Trabajos'],
    ['src/modules/jobs/app/routes/albaranes.routes.ts', 'los albaranes del técnico'],
  ];
  for (const [ruta, que] of RUTAS) {
    const fuente = sinComentarios(leer(ruta));
    // LOS TRES, uno a uno. El `where` lleva el literal a proposito —el guard de SCRUM-467
    // comprueba los dos primeros POR SU TEXTO y es de otro carril—, asi que lo que impide que las
    // dos rutas se separen es ESTE assert, no una funcion comun.
    for (const eje of ['operarioId', 'assignedUserId', 'assignees']) {
      assert.ok(fuente.includes(eje),
        `🔴 ${ruta} (${que}) ya no filtra por «${eje}». Con un eje de menos, alguien deja de ver ` +
        'trabajos que son suyos, y no se entera nadie hasta que el técnico abre la app y no tiene ' +
        'nada. Es el defecto exacto que SCRUM-467 arregló: no se reintroduce.');
    }
    assert.ok(fuente.includes('assignees: { some: { teamMemberId'),
      `🔴 ${ruta} nombra «assignees» pero NO filtra por él: el tercer eje está escrito y no se usa.`);
  }
});
