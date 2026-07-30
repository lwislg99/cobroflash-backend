// SCRUM-218 · EL FLAG FISCAL NO CAMBIA SIN SU FILA DE AUDITORÍA.
//
// Encender `INVOICING_ES_ENABLED` es el instante en que un profesional empieza a emitir con
// efectos fiscales. Lo que este test protege no es «que se intente auditar»: es que **sin
// constancia el hecho no ocurra**.
//
// CÓMO SE PRUEBA SIN BD: se inyecta un cliente falso que registra qué se escribió y con qué
// cliente. La garantía real la da que el update del flag y la fila de auditoría vayan en la
// MISMA `$transaction` con el MISMO `tx` — si la fila falla, Postgres deshace el update. Aquí
// se comprueban las dos mitades de esa afirmación:
//   ① los dos writes ocurren dentro del callback de la transacción, y con el mismo cliente;
//   ② si la auditoría lanza, `cambiarFlagFiscal` PROPAGA (no se traga el error).
// Con las dos, la atomicidad de Postgres hace el resto.
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  cambiarFlagFiscal, FLAGS_FISCALES, esFlagFiscal, ErrorCambioFlag,
} = await import('../dist/modules/system/domain/flagFiscal.service.js');

const MERCHANT = { id: 7, email: 'pro@ejemplo.es', country: 'ES', flags: null };
const ACTOR = { tipo: 'pro_propietario', teamMemberId: null, ref: null };

/** Cliente falso: apunta cada escritura y con qué cliente se hizo. */
function clienteFalso({ merchant = MERCHANT, auditFalla = false } = {}) {
  const registro = { updates: [], auditorias: [], dentroDeTx: [] };
  const hacerTx = (marca) => ({
    merchant: {
      findUnique: async () => merchant,
      update: async (args) => { registro.updates.push({ args, cliente: marca }); return merchant; },
    },
    auditLog: {
      create: async (args) => {
        if (auditFalla) throw new Error('audit_log_caido');
        registro.auditorias.push({ data: args.data, cliente: marca });
      },
    },
    $transaction: async (fn) => fn(hacerTx('tx')),
  });
  return { cliente: hacerTx('raiz'), registro };
}

const base = (over = {}) => ({
  merchantId: 7, flag: 'INVOICING_ES_ENABLED', valorNuevo: true,
  confirmacion: 'pro@ejemplo.es', actor: ACTOR, ...over,
});

// ── 1 · EL CAMINO EXISTE Y DEJA CONSTANCIA ───────────────────────────────────────────────

test('SCRUM-218 · encender el flag escribe cambio_flag con anterior, nuevo, actor y entidad', async () => {
  const { cliente, registro } = clienteFalso();
  const r = await cambiarFlagFiscal(base(), cliente);

  assert.equal(r.anterior, false);
  assert.equal(r.nuevo, true);

  assert.equal(registro.auditorias.length, 1, '🔴 el flag cambió sin escribir su fila de auditoría');
  const fila = registro.auditorias[0].data;
  assert.equal(fila.action, 'cambio_flag');
  assert.equal(fila.merchantId, 7);
  assert.equal(fila.entityType, 'merchant');
  assert.equal(fila.entityId, 7);

  // Valor anterior y nuevo, que es lo que hace la fila acreditable ante una inspección.
  // ⚠️ `sobreFiscal` APLANA el payload al nivel superior del sobre (`...params.payload`), no lo
  // anida bajo `.payload`. Este test lo asumió mal y salió rojo: se corrigió el TEST, no el
  // servicio — el contrato del sobre es de SCRUM-207 y manda él.
  assert.equal(fila.meta.flag, 'INVOICING_ES_ENABLED');
  assert.equal(fila.meta.valorAnterior, false);
  assert.equal(fila.meta.valorNuevo, true);
  // El ACTOR viaja en el sobre fiscal.
  assert.equal(fila.meta.actor.tipo, 'pro_propietario');
  // El MOMENTO no se pone desde la aplicación: lo pone AuditLog.createdAt en la base.
  assert.ok(!('createdAt' in fila), 'el momento lo pone la BD, no el proceso');
});

// ── 2 · LA GARANTÍA: MISMA TRANSACCIÓN, MISMO CLIENTE ────────────────────────────────────

test('SCRUM-218 · el update del flag y la auditoría van en la MISMA transacción', async () => {
  const { cliente, registro } = clienteFalso();
  await cambiarFlagFiscal(base(), cliente);

  assert.equal(registro.updates.length, 1);
  assert.equal(registro.updates[0].cliente, 'tx',
    '🔴 el flag se actualizó FUERA de la transacción: un fallo de auditoría ya no lo desharía');
  assert.equal(registro.auditorias[0].cliente, 'tx',
    '🔴 la auditoría se escribió con el cliente global, no con el de la transacción: no comparten destino');
});

// ── 3 · EL ROJO QUE IMPORTA: SI NO HAY FILA, NO HAY CAMBIO ───────────────────────────────

test('SCRUM-218 · si la auditoría falla, el error PROPAGA (no se traga)', async () => {
  const { cliente, registro } = clienteFalso({ auditFalla: true });
  await assert.rejects(
    () => cambiarFlagFiscal(base(), cliente),
    /audit_log_caido/,
    '🔴 el fallo de auditoría se tragó: el flag quedaría cambiado y sin constancia',
  );
  assert.equal(registro.auditorias.length, 0);
});

// ── 4 · LA PUERTA: confirmación explícita y lista cerrada ────────────────────────────────

test('SCRUM-218 · sin la confirmación exacta no se toca nada', async () => {
  const { cliente, registro } = clienteFalso();
  await assert.rejects(() => cambiarFlagFiscal(base({ confirmacion: 'otro@ejemplo.es' }), cliente));
  assert.equal(registro.updates.length, 0, '🔴 se actualizó el flag pese a la confirmación mala');
  assert.equal(registro.auditorias.length, 0);

  // El id se confunde; el email hay que ir a buscarlo. Mayúsculas y espacios sí se perdonan.
  const b = clienteFalso();
  await cambiarFlagFiscal(base({ confirmacion: '  PRO@Ejemplo.ES ' }), b.cliente);
  assert.equal(b.registro.updates.length, 1);
});

test('SCRUM-218 · solo se pueden tocar los flags FISCALES', () => {
  assert.deepEqual([...FLAGS_FISCALES], ['INVOICING_ES_ENABLED', 'SIF_ENABLED']);
  assert.equal(esFlagFiscal('BIZUM_AUTO_ENABLED'), false);
  assert.equal(esFlagFiscal('INVOICING_ES_ENABLED'), true);
});

test('SCRUM-218 · un flag no fiscal se rechaza antes de leer nada', async () => {
  const { cliente, registro } = clienteFalso();
  await assert.rejects(
    () => cambiarFlagFiscal(base({ flag: 'BIZUM_AUTO_ENABLED' }), cliente),
    (e) => e instanceof ErrorCambioFlag && e.codigo === 'flag_no_fiscal',
  );
  assert.equal(registro.updates.length, 0);
});

test('SCRUM-218 · poner el flag al valor que ya tiene no genera fila fantasma', async () => {
  const yaEncendido = { ...MERCHANT, flags: { INVOICING_ES_ENABLED: true } };
  const { cliente, registro } = clienteFalso({ merchant: yaEncendido });
  await assert.rejects(
    () => cambiarFlagFiscal(base(), cliente),
    (e) => e.codigo === 'flag_sin_cambio',
  );
  assert.equal(registro.auditorias.length, 0, 'una fila sin cambio real ensucia la traza de inspección');
});
