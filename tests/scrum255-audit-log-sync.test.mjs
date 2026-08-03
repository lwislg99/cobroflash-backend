// SCRUM-255 · el punto de sincronización de AuditLog, probado CON DOBLES y SIN GATE.
//
// Corre en el `npm test` normal, a propósito y por el mismo motivo que SCRUM-250 lo hizo con el
// suyo: **una red que solo se ejercita cuando alguien levanta staging no es una red**. Los cinco
// tests que dependen de este helper son gateados; sus garantías no pueden serlo.
//
// LO QUE SE FIJA AQUÍ, y cada uno nace de algo que puede romperse en silencio:
//   ① `esperar()` espera de verdad a que la escritura TERMINE (si no encolara, resolvería antes).
//   ② el SUELO: sin ninguna escritura interceptada es ERROR, no verde.
//   ③ `esperarAlMenos(n)` espera a que la escritura ARRANQUE — el caso anidado, donde `esperar()`
//      daría un rojo con el diagnóstico equivocado.
//   ④ el contador a CERO como afirmación NEGATIVA (la inversión de scrum66), que es el uso que
//      parece raro y es el correcto.
//   ⑤ el diagnóstico: el motivo REAL del fallo llega al mensaje del assert.
//   ⑥ UNA SOLA SUSCRIPCIÓN: envolver no puede ejecutar el INSERT dos veces.
//   ⑦ `restaurar()` deja el delegate como estaba.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  interceptarAuditLog,
  SIN_INTERCEPTAR,
} from './_audit-log-sync.mjs';

/** Cliente de mentira con la forma mínima: `auditLog.create`. */
function prismaFalso({ retraso = 0, fallar = null } = {}) {
  const estado = { llamadas: 0, ejecuciones: 0, terminadas: 0 };
  return {
    estado,
    auditLog: {
      create(datos) {
        estado.llamadas++;
        // Se cuenta la EJECUCIÓN aparte de la llamada para poder detectar una doble suscripción.
        estado.ejecuciones++;
        return new Promise((resolver, rechazar) => {
          setTimeout(() => {
            estado.terminadas++;
            if (fallar) rechazar(fallar);
            else resolver({ id: estado.llamadas, ...datos });
          }, retraso);
        });
      },
    },
  };
}

// ── ① esperar() espera a que TERMINE ─────────────────────────────────────────

test('esperar() no resuelve hasta que la escritura ha TERMINADO', async () => {
  const prisma = prismaFalso({ retraso: 40 });
  const au = interceptarAuditLog({ prisma });
  try {
    prisma.auditLog.create({ data: { action: 'x' } }); // fire-and-forget: nadie la espera
    assert.equal(prisma.estado.terminadas, 0, 'precondición: aún no ha terminado');
    await au.esperar();
    assert.equal(prisma.estado.terminadas, 1, '🔴 esperar() resolvió ANTES de que la escritura acabara');
  } finally {
    au.restaurar();
  }
});

test('esperar() drena también las escrituras que nacen MIENTRAS se drena', async () => {
  const prisma = prismaFalso({ retraso: 10 });
  const au = interceptarAuditLog({ prisma });
  try {
    prisma.auditLog.create({ data: { action: 'a' } }).then(() => {
      prisma.auditLog.create({ data: { action: 'b' } }); // encadenada: nace durante el drenaje
    });
    await au.esperar();
    assert.equal(prisma.estado.terminadas, 2, '🔴 la segunda escritura se quedó fuera del drenaje');
  } finally {
    au.restaurar();
  }
});

// ── ② El suelo ───────────────────────────────────────────────────────────────

test('SUELO · esperar() sin ninguna escritura interceptada es ERROR, no verde', async () => {
  const prisma = prismaFalso();
  const au = interceptarAuditLog({ prisma });
  try {
    await assert.rejects(() => au.esperar(), (e) => e.message === SIN_INTERCEPTAR);
  } finally {
    au.restaurar();
  }
});

test('SUELO · el mensaje manda a `esperarAlMenos` cuando la escritura aún no ha arrancado', () => {
  // El diagnóstico importa tanto como el rojo: sin esta pista, «el log ya no pasa por aquí»
  // manda a buscar el defecto donde no está.
  assert.match(SIN_INTERCEPTAR, /esperarAlMenos/);
});

// ── ③ esperarAlMenos: el caso ANIDADO ────────────────────────────────────────

test('esperarAlMenos(1) espera a que la escritura ARRANQUE (fire-and-forget anidado)', async () => {
  const prisma = prismaFalso({ retraso: 10 });
  const au = interceptarAuditLog({ prisma });
  try {
    // Reproduce la forma real: la escritura nace DESPUÉS de un await por medio, así que en este
    // punto `interceptadas` es 0 y `esperar()` daría el rojo equivocado.
    assert.equal(au.interceptadas, 0, 'precondición: todavía no ha arrancado');
    setTimeout(() => prisma.auditLog.create({ data: { action: 'anidada' } }), 30);

    await au.esperarAlMenos(1);
    assert.equal(prisma.estado.terminadas, 1, '🔴 no esperó a que arrancara y terminara');
  } finally {
    au.restaurar();
  }
});

test('esperarAlMenos(1) no espera nada si la escritura YA arrancó', async () => {
  const prisma = prismaFalso({ retraso: 5 });
  const au = interceptarAuditLog({ prisma });
  try {
    prisma.auditLog.create({ data: { action: 'ya' } });
    await au.esperarAlMenos(1);
    assert.equal(prisma.estado.terminadas, 1);
  } finally {
    au.restaurar();
  }
});

test('esperarAlMenos(n) espera a las n, no a la primera', async () => {
  const prisma = prismaFalso({ retraso: 5 });
  const au = interceptarAuditLog({ prisma });
  try {
    prisma.auditLog.create({ data: { action: '1' } });
    setTimeout(() => prisma.auditLog.create({ data: { action: '2' } }), 25);
    await au.esperarAlMenos(2);
    assert.equal(prisma.estado.terminadas, 2, '🔴 resolvió con una sola escritura');
  } finally {
    au.restaurar();
  }
});

test('esperarAlMenos · si NO arranca, el rojo dice «NO EMPEZÓ», no «no terminó»', async () => {
  const prisma = prismaFalso();
  const au = interceptarAuditLog({ prisma, timeoutMs: 60 });
  try {
    await assert.rejects(
      () => au.esperarAlMenos(1),
      (e) => /NO EMPEZ/.test(e.message) && /arrancaron 0/.test(e.message),
    );
  } finally {
    au.restaurar();
  }
});

test('esperarAlMenos rechaza una `n` que no tiene sentido', async () => {
  const prisma = prismaFalso();
  const au = interceptarAuditLog({ prisma });
  try {
    await assert.rejects(() => au.esperarAlMenos(0), /entero/);
    await assert.rejects(() => au.esperarAlMenos(1.5), /entero/);
  } finally {
    au.restaurar();
  }
});

// ── ④ El contador a CERO: la afirmación NEGATIVA ─────────────────────────────

test('INVERSIÓN · para afirmar que algo NO se audita se mira el contador, no el reloj', async () => {
  const prisma = prismaFalso();
  const au = interceptarAuditLog({ prisma });
  try {
    // No pasa nada: nadie escribe. La afirmación correcta es inmediata.
    assert.equal(au.interceptadas, 0);
    // Y `esperar()` es justo lo que NO se debe llamar aquí: lanza.
    await assert.rejects(() => au.esperar(), (e) => e.message === SIN_INTERCEPTAR);
  } finally {
    au.restaurar();
  }
});

// ── ⑤ El diagnóstico ─────────────────────────────────────────────────────────

test('explicar() lleva el motivo REAL del fallo al mensaje del assert', async () => {
  const err = Object.assign(new Error('Timed out fetching a new connection'), { code: 'P2024' });
  const prisma = prismaFalso({ retraso: 5, fallar: err });
  const au = interceptarAuditLog({ prisma });
  try {
    prisma.auditLog.create({ data: { action: 'x' } }).catch(() => {}); // como hace recordAudit
    await au.esperar();
    const m = au.explicar('no hay fila');
    assert.match(m, /P2024/, '🔴 sin el motivo real, el rojo dice «no hay fila» y no dice por qué');
    assert.match(m, /AuditLog FALL/);
  } finally {
    au.restaurar();
  }
});

test('explicar() NO inventa causas cuando no hubo fallo', async () => {
  const prisma = prismaFalso({ retraso: 1 });
  const au = interceptarAuditLog({ prisma });
  try {
    prisma.auditLog.create({ data: { action: 'x' } });
    await au.esperar();
    assert.equal(au.explicar('mensaje pelado'), 'mensaje pelado');
  } finally {
    au.restaurar();
  }
});

// ── ⑥ Una sola suscripción ───────────────────────────────────────────────────

test('envolver NO ejecuta el INSERT dos veces', async () => {
  const prisma = prismaFalso({ retraso: 1 });
  const au = interceptarAuditLog({ prisma });
  try {
    const p = prisma.auditLog.create({ data: { action: 'x' } });
    await p;               // el llamador se suscribe
    await au.esperar();    // y el helper también
    assert.equal(prisma.estado.ejecuciones, 1,
      '🔴 el INSERT se ejecutó más de una vez: hay dos suscripciones a un PrismaPromise');
  } finally {
    au.restaurar();
  }
});

test('la promesa devuelta conserva el VALOR de la original', async () => {
  const prisma = prismaFalso({ retraso: 1 });
  const au = interceptarAuditLog({ prisma });
  try {
    const valor = await prisma.auditLog.create({ data: { action: 'x' } });
    assert.equal(valor.data.action, 'x', '🔴 la envoltura cambió lo que devuelve el create');
    await au.esperar();
  } finally {
    au.restaurar();
  }
});

test('un fallo sigue llegando al llamador: la envoltura no se lo traga', async () => {
  const prisma = prismaFalso({ retraso: 1, fallar: new Error('boom') });
  const au = interceptarAuditLog({ prisma });
  try {
    await assert.rejects(() => prisma.auditLog.create({ data: { action: 'x' } }), /boom/);
    await au.esperar(); // y el drenaje NO revienta por ese fallo
    assert.equal(au.fallos.length, 1);
  } finally {
    au.restaurar();
  }
});

// ── ⑦ Restaurar y validación de entrada ──────────────────────────────────────

test('restaurar() deja el delegate EXACTAMENTE como estaba', () => {
  const prisma = prismaFalso();
  const original = prisma.auditLog.create;
  const au = interceptarAuditLog({ prisma });
  assert.notEqual(prisma.auditLog.create, original, 'precondición: estaba envuelto');
  au.restaurar();
  assert.equal(prisma.auditLog.create, original, '🔴 el delegate quedó envuelto tras restaurar');
});

test('un cliente sin auditLog.create se rechaza al construir, no más tarde', () => {
  assert.throws(() => interceptarAuditLog({ prisma: {} }), /no es una función/);
  assert.throws(() => interceptarAuditLog({}), /no es una función/);
});
