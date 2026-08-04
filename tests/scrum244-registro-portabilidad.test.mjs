// SCRUM-244 · EL REGISTRO DE QUE SE EJERCIÓ EL DERECHO — las dos fechas, y la pregunta.
//
// Sin gate: `prisma` va INYECTADO como doble. Ni BD, ni red, ni turno. Es el patrón de la casa
// (`_merchant-fixture.mjs`, `_staging-lock.mjs`): la garantía no vive detrás de `QA_DB_TEST`,
// porque una red que solo funciona cuando alguien se acuerda de levantarla no es una red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL TEST QUE JUSTIFICA EL MÓDULO
//
// «¿Cuántas solicitudes llevan más de N días sin atender?». Un registro que guarda las dos
// fechas y NO puede cruzarlas tiene el dato y no la respuesta — y la respuesta es lo único que
// sirve para demostrar que se cumplió el mes del art. 12.3.
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  solicitudesPendientes, registrarSolicitud, registrarAtencion,
  fechaLimite, diasTranscurridos, PLAZO_MESES, ACCION_SOLICITADA, ACCION_ATENDIDA, ENTIDAD,
} = await import('../dist/modules/exports/domain/portabilidadRegistro.js');

const DIA = 86_400_000;
const ahora = new Date('2026-08-03T12:00:00.000Z');
const haceDias = (n) => new Date(ahora.getTime() - n * DIA);

/** Doble de Prisma: dos tablas en memoria y las consultas que el módulo hace de verdad. */
function clienteFalso({ solicitudes = [], atenciones = [] } = {}) {
  const llamadas = [];
  return {
    llamadas,
    auditLog: {
      async findMany(args) {
        llamadas.push(args);
        if (args.where.action === ACCION_SOLICITADA) {
          return solicitudes
            .filter((s) => s.createdAt <= args.where.createdAt.lte)
            .filter((s) => args.where.merchantId == null || s.merchantId === args.where.merchantId)
            .sort((a, b) => a.createdAt - b.createdAt);
        }
        const ids = new Set(args.where.entityId.in);
        return atenciones.filter((a) => ids.has(a.entityId)).map((a) => ({ entityId: a.entityId }));
      },
      async create(args) {
        llamadas.push(args);
        return { id: 4242, ...args.data };
      },
    },
  };
}

test('SCRUM-244 · LA PREGUNTA: cuántas solicitudes llevan más de N días sin atender', async () => {
  const cliente = clienteFalso({
    solicitudes: [
      { id: 1, merchantId: 10, createdAt: haceDias(40) }, // vieja, SIN atender  → pendiente
      { id: 2, merchantId: 11, createdAt: haceDias(35) }, // vieja, atendida     → no
      { id: 3, merchantId: 12, createdAt: haceDias(2) },  // reciente, sin atender
    ],
    atenciones: [{ entityId: 2 }],
  });

  const masDe30 = await solicitudesPendientes(cliente, { dias: 30, ahora });
  assert.deepEqual(
    masDe30.map((p) => p.solicitudId), [1],
    '🔴 la consulta no distingue una solicitud SIN atender de una atendida. Sin eso, el registro ' +
      'guarda dos fechas y no puede contestar la única pregunta por la que existe.',
  );
  assert.equal(masDe30[0].dias, 40);
  assert.equal(masDe30[0].fueraDePlazo, true, '🔴 40 días con un plazo de un mes está fuera de plazo');

  // `dias: 0` = TODAS las pendientes, que es lo que pinta una bandeja.
  const todas = await solicitudesPendientes(cliente, { dias: 0, ahora });
  assert.deepEqual(todas.map((p) => p.solicitudId), [1, 3]);
  assert.equal(todas[1].fueraDePlazo, false, '🔴 una solicitud de hace 2 días NO está fuera de plazo');
});

test('SCRUM-244 · una solicitud atendida DESAPARECE de las pendientes (la correlación funciona)', async () => {
  const solicitudes = [{ id: 7, merchantId: 10, createdAt: haceDias(10) }];
  const sinAtender = await solicitudesPendientes(clienteFalso({ solicitudes }), { ahora });
  assert.equal(sinAtender.length, 1, '🔴 ESCÁNER CIEGO: sin atención debería salir pendiente');

  const atendida = await solicitudesPendientes(
    clienteFalso({ solicitudes, atenciones: [{ entityId: 7 }] }), { ahora },
  );
  assert.deepEqual(
    atendida, [],
    '🔴 la atención no cierra su solicitud. La correlación va por `entityId` = id de la ' +
      'solicitud; si se rompe, TODO sale pendiente para siempre y el registro miente al revés.',
  );
});

test('SCRUM-244 · la atención apunta a SU solicitud, y sin id no se puede registrar', async () => {
  const cliente = clienteFalso();
  const id = await registrarSolicitud(cliente, { merchantId: 10, actor: { tipo: 'pro_propietario' } });
  assert.equal(id, 4242, '🔴 `registrarSolicitud` no devuelve el id de la fila: sin él no hay correlación posible');

  const creada = cliente.llamadas.find((l) => l.data?.action === ACCION_SOLICITADA);
  assert.ok(creada, '🔴 no se escribió la fila de solicitud');
  assert.equal(creada.data.entityType, ENTIDAD);
  assert.equal(creada.data.entityId, null, '🔴 la solicitud NO apunta a nada: se apunta a ella');

  await registrarAtencion(cliente, { merchantId: 10, solicitudId: id, actor: { tipo: 'sistema', ref: 'qa' } });
  const cerrada = cliente.llamadas.find((l) => l.data?.action === ACCION_ATENDIDA);
  assert.ok(cerrada, '🔴 no se escribió la fila de atención');
  assert.equal(
    cerrada.data.entityId, id,
    '🔴 la atención no apunta a su solicitud. Una atención que no dice QUÉ cierra no sirve para ' +
      'calcular ningún plazo: es la fila que PARECE cumplimiento sin serlo.',
  );
});

test('SCRUM-244 · el plazo es UN MES de calendario, no 30 días', async () => {
  // No es pedantería: en un mes de 31 días, contar 30 adelanta el vencimiento un día entero
  // sobre una obligación legal, y siempre hacia el lado peligroso (declarar vencido lo que no lo está).
  assert.equal(PLAZO_MESES, 1);

  const enero31 = new Date('2026-01-31T10:00:00.000Z');
  const limite = fechaLimite(enero31);
  assert.ok(
    limite.getTime() > enero31.getTime() + 28 * DIA,
    '🔴 el límite de una solicitud del 31 de enero cae ANTES de 28 días: se está contando mal',
  );

  const marzo1 = new Date('2026-03-01T10:00:00.000Z');
  assert.equal(
    fechaLimite(marzo1).getTime(), new Date('2026-04-01T10:00:00.000Z').getTime(),
    '🔴 un mes desde el 1 de marzo no cae el 1 de abril',
  );
  assert.equal(diasTranscurridos(haceDias(31), ahora), 31);
});

test('SCRUM-244 · las dos acciones son BLOQUEANTES: una solicitud NO puede perderse en silencio', async () => {
  const { ACCIONES_BLOQUEANTES } = await import('../dist/modules/system/audit.service.js');
  for (const accion of [ACCION_SOLICITADA, ACCION_ATENDIDA]) {
    assert.ok(
      ACCIONES_BLOQUEANTES.includes(accion),
      `🔴 «${accion}» NO es bloqueante, así que podría escribirse fire-and-forget.\n\n` +
        '  Registrar de menos es lo ÚNICO que este registro existe para impedir: una solicitud\n' +
        '  perdida deja un plazo legal corriendo que nadie sabe que corre, y el día que alguien\n' +
        '  pregunte no hay nada que enseñar.',
    );
  }
});

test('SCRUM-244 · SUELO: sin solicitudes no se consulta la segunda tabla ni se inventan pendientes', async () => {
  const cliente = clienteFalso();
  const r = await solicitudesPendientes(cliente, { ahora });
  assert.deepEqual(r, []);
  assert.equal(
    cliente.llamadas.length, 1,
    '🔴 con cero solicitudes se ha consultado igualmente la tabla de atenciones: un `in: []` que ' +
      'algunos motores resuelven como «todas». Cortar antes no es optimización, es evitar esa trampa.',
  );
});
