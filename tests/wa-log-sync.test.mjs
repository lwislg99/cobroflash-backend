// tests/wa-log-sync.test.mjs — SCRUM-250: las garantías de `_wa-log-sync.mjs`, probadas con
// DOBLES: sin BD, SIN GATE, en el `npm test` normal.
//
// Por qué aquí y no detrás de QA_DB_TEST: el helper existe para que el test gateado deje de
// depender del reloj. Si sus garantías solo se ejercitaran cuando alguien levanta staging,
// tendríamos el mismo defecto un piso más abajo — «una red que solo funciona cuando alguien se
// acuerda de levantarla no es una red» (mismo criterio que `merchant-fixture.test.mjs`, que
// prueba `_merchant-fixture.mjs` inyectando un doble).
//
// Las cinco garantías: (1) envuelve sin sustituir · (2) `esperar()` NO resuelve mientras la
// escritura sigue viva · (3) cero interceptaciones = rojo CON NOMBRE · (4) el motivo real del
// fallo llega al mensaje del assert · (5) una sola suscripción a la promesa perezosa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { interceptarWaLog, SIN_INTERCEPTAR } from './_wa-log-sync.mjs';

/** Promesa que se resuelve/rechaza desde fuera: el control del tiempo lo lleva el test. */
function diferida() {
  let resolver, rechazar;
  const promesa = new Promise((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}

/**
 * Dobles con la MISMA FORMA que el par real:
 *   · `log.recordWaMessage` es `async`, llama a `prisma.whatsAppMessage.create` por acceso a
 *     propiedad EN LA LLAMADA, y SE TRAGA el error (try/catch), igual que la de verdad
 *     (`whatsappLog.service.ts:31-53`). Ese `catch` es justo lo que deja ciego al test sin la
 *     capa 2, así que el doble tiene que tenerlo o probaríamos otra cosa.
 */
function dobles(comportamientoDelCreate) {
  const prisma = { whatsAppMessage: { create: (args) => comportamientoDelCreate(args) } };
  const log = {
    recordWaMessage: async (input) => {
      try {
        await prisma.whatsAppMessage.create({ data: input });
      } catch {
        /* la real hace exactamente esto: no romper el envío */
      }
    },
  };
  return { log, prisma };
}

/** Cede el bucle de eventos sin esperar reloj: es una vuelta de cola, no un `sleep`. */
const vueltaDeBucle = () => new Promise((r) => setImmediate(r));

test('SCRUM-250 · (1) envuelve sin sustituir: la escritura de verdad sigue ocurriendo', async () => {
  let escrito = null;
  const { log, prisma } = dobles((args) => { escrito = args; return Promise.resolve({ id: 1 }); });
  const original = log.recordWaMessage;

  const wa = interceptarWaLog({ log, prisma });
  try {
    assert.notEqual(log.recordWaMessage, original, 'debe quedar envuelta');
    log.recordWaMessage({ merchantId: 7, type: 'template', status: 'failed', error: 'wa_opt_out' });
    await wa.esperar();

    assert.equal(escrito?.data?.merchantId, 7, 'la original tiene que haberse ejecutado de verdad');
    assert.equal(escrito?.data?.error, 'wa_opt_out');
    assert.equal(wa.interceptadas, 1);
  } finally {
    wa.restaurar();
  }
  assert.equal(log.recordWaMessage, original, 'restaurar() deja la original en su sitio');
});

test('SCRUM-250 · (2) esperar() NO resuelve mientras la escritura sigue pendiente', async () => {
  const dif = diferida();
  const { log, prisma } = dobles(() => dif.promesa);

  const wa = interceptarWaLog({ log, prisma });
  try {
    log.recordWaMessage({ merchantId: 1 }); // fire-and-forget, como el call-site real

    let resuelta = false;
    const espera = wa.esperar().then(() => { resuelta = true; });

    // Varias vueltas de bucle: si el helper no esperase de verdad, ya habría resuelto.
    await vueltaDeBucle();
    await vueltaDeBucle();
    assert.equal(resuelta, false, 'esperar() resolvió ANTES de que la escritura terminara: el punto de sincronización no sincroniza nada');

    dif.resolver({ id: 1 });
    await espera;
    assert.equal(resuelta, true, 'al terminar la escritura, esperar() tiene que resolver');
  } finally {
    wa.restaurar();
  }
});

test('SCRUM-250 · (3) cero interceptaciones = rojo CON NOMBRE, no verde en vacío', async () => {
  const { log, prisma } = dobles(() => Promise.resolve({ id: 1 }));
  const wa = interceptarWaLog({ log, prisma });
  try {
    // Nadie llamó a recordWaMessage: el día que el log se enrute por otra función, esto es lo
    // único que separa «el test avisa» de «el test vuelve a depender del reloj sin que se note».
    await assert.rejects(() => wa.esperar(), (err) => {
      assert.equal(err.message, SIN_INTERCEPTAR);
      return true;
    });
  } finally {
    wa.restaurar();
  }
});

test('SCRUM-250 · (4) el motivo REAL del fallo llega al mensaje del assert', async () => {
  const p2024 = Object.assign(
    new Error('Timed out fetching a new connection from the connection pool'),
    { code: 'P2024' },
  );
  const { log, prisma } = dobles(() => Promise.reject(p2024));

  const wa = interceptarWaLog({ log, prisma });
  try {
    log.recordWaMessage({ merchantId: 1 });
    await wa.esperar(); // resuelve: la escritura TERMINÓ, aunque terminara mal

    assert.equal(wa.fallos.length, 1, 'la capa 2 tiene que capturar el error antes de que recordWaMessage se lo trague');
    const mensaje = wa.explicar('debe quedar una fila en WA-0b para el intento bloqueado');
    assert.match(mensaje, /P2024/, 'el rojo tiene que decir POR QUÉ, no solo «no hay fila»');
    assert.match(mensaje, /debe quedar una fila/, 'sin perder el mensaje original del assert');
  } finally {
    wa.restaurar();
  }
});

test('SCRUM-250 · (4b) sin fallos, explicar() no inventa causas', async () => {
  const { log, prisma } = dobles(() => Promise.resolve({ id: 1 }));
  const wa = interceptarWaLog({ log, prisma });
  try {
    log.recordWaMessage({ merchantId: 1 });
    await wa.esperar();
    assert.equal(wa.explicar('mensaje pelado'), 'mensaje pelado');
  } finally {
    wa.restaurar();
  }
});

test('SCRUM-250 · (5) una sola suscripción a la promesa perezosa (un PrismaPromise no se ejecuta dos veces)', async () => {
  let suscripciones = 0;
  // Imita a un PrismaPromise: PEREZOSO (no hace nada hasta que alguien llama a `.then`).
  const perezosa = {
    then(res, rej) {
      suscripciones++;
      return Promise.resolve({ id: 1 }).then(res, rej);
    },
  };
  const { log, prisma } = dobles(() => perezosa);

  const wa = interceptarWaLog({ log, prisma });
  try {
    log.recordWaMessage({ merchantId: 1 });
    await wa.esperar();
    assert.equal(suscripciones, 1, 'dos suscripciones a un PrismaPromise es un INSERT ejecutado dos veces');
  } finally {
    wa.restaurar();
  }
});

test('SCRUM-250 · (6) restaurar() deshace TAMBIÉN la envoltura del create', async () => {
  const { log, prisma } = dobles(() => Promise.resolve({ id: 1 }));
  const createOriginal = prisma.whatsAppMessage.create;

  const wa = interceptarWaLog({ log, prisma });
  assert.notEqual(prisma.whatsAppMessage.create, createOriginal);
  wa.restaurar();
  assert.equal(prisma.whatsAppMessage.create, createOriginal);
});

test('SCRUM-250 · (7) la red de última instancia da un rojo con mensaje, no un test colgado', async () => {
  const dif = diferida(); // no se resuelve NUNCA: el caso que la red existe para cazar
  const { log, prisma } = dobles(() => dif.promesa);

  // 20 ms aquí no es «una espera corta»: la escritura no termina jamás, así que el resultado
  // no depende del número. Con 60 s el veredicto sería el mismo, solo tardaría 60 s.
  const wa = interceptarWaLog({ log, prisma, timeoutMs: 20 });
  try {
    log.recordWaMessage({ merchantId: 1 });
    await assert.rejects(() => wa.esperar(), (err) => {
      assert.match(err.message, /no terminó en 20 ms/, 'el mensaje tiene que citar los ms REALES con los que se armó la red');
      assert.match(err.message, /P2024/);
      return true;
    });
  } finally {
    wa.restaurar();
  }
});

test('SCRUM-250 · (8) sin un módulo de log válido, falla en claro al montar', () => {
  assert.throws(() => interceptarWaLog({ log: {}, prisma: {} }), /recordWaMessage/);
  assert.throws(() => interceptarWaLog({}), /recordWaMessage/);
});

// ═════════════════════════════════════════════════════════════════════════════
// SCRUM-255 · `esperarAlMenos(n)`: el disparo ANIDADO
//
// Nace de un rojo REAL, no de un supuesto: en la tanda gateada de SCRUM-255 cayó la segunda
// ventana de `scrum49-firma-remota`. La ruta pública de firmar lanza el auto-envío SIN await y
// responde antes (`albaranPublic.routes.ts:240`), así que cuando el test recibe la respuesta
// `recordWaMessage` todavía no se ha llamado. `esperar()` drenaba lo ya empezado —nada— y su
// suelo daba un rojo con el DIAGNÓSTICO EQUIVOCADO.
//
// Y no es un sitio suelto: el censo derivado del call-graph en SCRUM-255 encontró **23 disparos
// anidados en 7 ficheros**.
// ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-255 · esperarAlMenos(1) espera a que la escritura ARRANQUE, no solo a que termine', async () => {
  const { log, prisma } = dobles(() => Promise.resolve({ id: 1 }));
  const wa = interceptarWaLog({ log, prisma });
  try {
    // La forma real: la escritura nace DESPUÉS de que el test recupere el control.
    assert.equal(wa.interceptadas, 0, 'precondición: todavía no ha arrancado');
    setTimeout(() => log.recordWaMessage({ merchantId: 7, type: 'template', status: 'sent' }), 30);

    await wa.esperarAlMenos(1);
    assert.equal(wa.interceptadas, 1, '🔴 resolvió sin que la escritura hubiera arrancado');
  } finally {
    wa.restaurar();
  }
});

test('SCRUM-255 · esperarAlMenos(1) no espera nada si la escritura YA arrancó', async () => {
  const { log, prisma } = dobles(() => Promise.resolve({ id: 1 }));
  const wa = interceptarWaLog({ log, prisma });
  try {
    log.recordWaMessage({ merchantId: 7, type: 'template', status: 'sent' });
    await wa.esperarAlMenos(1);
    assert.equal(wa.interceptadas, 1);
  } finally {
    wa.restaurar();
  }
});

test('SCRUM-255 · si NO arranca, el rojo dice «NO EMPEZÓ» y no «no terminó»', async () => {
  const { log, prisma } = dobles(() => Promise.resolve({ id: 1 }));
  const wa = interceptarWaLog({ log, prisma, timeoutMs: 60 });
  try {
    await assert.rejects(
      () => wa.esperarAlMenos(1),
      (e) => /NO EMPEZ/.test(e.message) && /arrancaron 0/.test(e.message),
      '🔴 los dos rojos mandan a mirar sitios distintos: tienen que decir cosas distintas',
    );
  } finally {
    wa.restaurar();
  }
});

test('SCRUM-255 · el suelo de esperar() manda a esperarAlMenos, que es el hueco real', () => {
  // Sin esta pista, «el log ya no pasa por recordWaMessage» manda a buscar el defecto al sitio
  // equivocado — que es exactamente lo que pasó en la tanda.
  assert.match(SIN_INTERCEPTAR, /esperarAlMenos/);
});

test('SCRUM-255 · esperarAlMenos rechaza una `n` sin sentido', async () => {
  const { log, prisma } = dobles(() => Promise.resolve({ id: 1 }));
  const wa = interceptarWaLog({ log, prisma });
  try {
    await assert.rejects(() => wa.esperarAlMenos(0), /entero/);
    await assert.rejects(() => wa.esperarAlMenos(1.5), /entero/);
  } finally {
    wa.restaurar();
  }
});
