// tests/_audit-log-sync.mjs — SCRUM-255 (+ SCRUM-256, absorbido): punto de sincronización
// determinista para las escrituras fire-and-forget de `AuditLog`, sin tocar una línea del
// camino de producción.
//
// ═════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO ES UN HERMANO DE `_wa-log-sync.mjs` Y NO EL MISMO MECANISMO
// APLICADO A OTRA TABLA. Si has llegado aquí preguntándote por qué hay dos, la
// respuesta es esta, y no es de estilo:
//
//   SCRUM-250 se apoya en una premisa que dejó escrita en su cabecera:
//
//     «el fire-and-forget no es "no hay promesa", es "hay una promesa y nadie la recoge"»
//
//   Para WA-0b es cierto: `recordWaMessage` es `async` y DEVUELVE su promesa; los 16 call-sites
//   la tiran con `.catch(() => {})`. Envolviendo la EXPORTACIÓN se recoge desde fuera.
//
//   **Para auditoría esa premisa es literalmente FALSA.** `recordAudit` devuelve `void`:
//
//     export function recordAudit(params): void {
//       prisma.auditLog.create({ ... }).catch((e) => console.error(...));
//     }
//
//   La promesa se crea y **se tira DENTRO de la función**. Envolver la exportación desde fuera
//   devuelve `undefined`: no hay nada que recoger. La Capa 1 de 250 no sirve aquí, y no por un
//   detalle de implementación — es que el objeto que aquel helper necesita no existe.
//
//   Lo que SÍ funciona es lo que allí es la Capa 2 (diagnóstico) y aquí es el mecanismo ENTERO:
//   envolver `prisma.auditLog.create`, que sí devuelve la promesa aunque quien la llama la
//   descarte. Y funciona para los 11 llamadores SIN EXCEPCIÓN porque `recordAudit` **no es
//   `async`**: invoca `prisma.auditLog.create` de forma síncrona y le cuelga un `.catch`.
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 LO QUE ESTE HELPER **NO** VE, declarado porque un helper que no dice qué no
// cubre promete de más:
//
//   Las escrituras hechas con un cliente de TRANSACCIÓN son INVISIBLES para cualquier envoltura
//   de `prisma.auditLog`, porque `tx.auditLog` es OTRO objeto. Medido, y son las dos FISCALES:
//
//     · `factura_emitida` — `invoiceNumber.service.ts`, cierra con `tx,`
//     · `cambio_flag`     — `flagFiscal.service.ts`, cierra con `tx as any,`
//
//   No necesitan sincronización: van AWAITADAS dentro de su transacción (SCRUM-207), así que no
//   hay carrera. **Pero una aserción NEGATIVA sobre ellas pasaría EN VACÍO por este helper** —
//   `interceptadas === 0` sería cierto y no significaría nada. Si algún día hay que afirmar que
//   una de esas dos NO se escribió, hay que envolver el cliente de la transacción, no éste.
//
//   Sí se ven, en cambio, los dos `exportacion_fiscal` de `exports.routes.ts` (:292 y :570):
//   usan el cliente por defecto, o sea el global.
//
// ⚠️ NOTA DE SEGURIDAD, heredada de la capa 2 de SCRUM-250 y repetida aquí a propósito:
//   envolver `create` devuelve una promesa DERIVADA, que pierde la condición de `PrismaPromise`.
//   Eso solo importa dentro de `$transaction` **en forma de array** (`prisma.$transaction([...])`),
//   que es donde Prisma exige `PrismaPromise` de verdad — y ahí `recordAudit` no entra nunca.
//   Se dice para que nadie lo descubra con un rojo raro.
// ═════════════════════════════════════════════════════════════════════════════
//
// LO QUE SE HEREDA DE 250 TAL CUAL, porque son las garantías y no el mecanismo:
//   · el SUELO (`interceptadas === 0` ⇒ error, no verde): si el registro deja de pasar por aquí,
//     el helper no está sincronizando nada y el test volvería a depender del reloj sin que se
//     note. Es la diferencia entre una red y un adorno.
//   · la RED de última instancia: no decide el veredicto en el caso normal; convierte «colgado
//     para siempre» en «rojo con motivo».
//   · el DIAGNÓSTICO: `recordAudit` se traga el error a propósito (`.catch(console.error)`), así
//     que un fallo de escritura llega al test como «no hay fila», sin causa. Capturándolo aquí,
//     el rojo dice «la escritura de AuditLog FALLÓ: P2024 …».
//   · `prisma` va POR PARÁMETRO, no importado: así se puede probar con dobles, sin BD y sin gate.

/** Ms que se conceden antes de considerar que algo no va a pasar. Igual que en SCRUM-250. */
export const TIMEOUT_RED_MS = 60_000;

export const SIN_INTERCEPTAR =
  'SCRUM-255: no se interceptó NINGUNA escritura de AuditLog. El registro ya no pasa por ' +
  '`prisma.auditLog.create` del cliente que se pasó a este helper, así que no está ' +
  'sincronizando nada y el test habría vuelto a depender del reloj sin que se notara. Revisa el ' +
  'camino de registro antes de tocar el test. (Si lo que esperas es una escritura ANIDADA que ' +
  'aún no ha arrancado, lo que quieres es `esperarAlMenos(n)`, no `esperar()`.)';

export const mensajeRedDisparada = (ms) =>
  `SCRUM-255: la escritura de AuditLog no terminó en ${ms} ms. Eso NO es un sondeo agotándose: ` +
  'es una escritura que no acaba nunca. Mira el pool de conexiones (P2024) antes de subir este ' +
  'número.';

export const mensajeNoArrancaron = (n, vistas, ms) =>
  `SCRUM-255: se esperaban al menos ${n} escritura(s) de AuditLog y en ${ms} ms arrancaron ` +
  `${vistas}. Eso NO es «la escritura tarda»: es que NO EMPEZÓ. Mira si el camino sigue llamando ` +
  'a `recordAudit` antes de subir este número.';

/**
 * Envuelve `prisma.auditLog.create` para poder esperar de forma determinista las escrituras que
 * `recordAudit` lanza y no espera.
 *
 * @param {object} opts
 * @param {object} opts.prisma      cliente Prisma (el MISMO que usa `audit.service`)
 * @param {number} [opts.timeoutMs]
 */
export function interceptarAuditLog({ prisma, timeoutMs = TIMEOUT_RED_MS } = {}) {
  const delegate = prisma?.auditLog;
  if (!delegate || typeof delegate.create !== 'function') {
    throw new Error('interceptarAuditLog: `prisma.auditLog.create` no es una función (¿cliente equivocado?)');
  }

  const pendientes = [];
  const fallos = [];
  let interceptadas = 0;
  /** Espera de ARRANQUE pendiente: `{ n, resolver }`. Ver `esperarAlMenos`. */
  let arranque = null;

  const createOriginal = delegate.create;
  delegate.create = function envueltaAuditCreate(...args) {
    const p = createOriginal.apply(this, args);
    interceptadas++;
    // ⚠️ UNA SOLA SUSCRIPCIÓN, por el mismo motivo que en SCRUM-250: un `PrismaPromise` es
    // PEREZOSO y no ejecuta hasta que alguien llama a su `.then`. Se llama UNA vez y se devuelve
    // la promesa derivada, en vez de suscribirse aparte y devolver la original — así no hay que
    // razonar sobre si dos suscripciones ejecutan el INSERT dos veces.
    const derivada = p.then(
      (valor) => valor,
      (err) => { fallos.push(err); throw err; },
    );
    pendientes.push(derivada.catch(() => {})); // el fallo se guarda arriba; aquí no se re-lanza
    // Despertar a quien esperaba a que ARRANCARAN n escrituras. Se resuelve en el mismo tick en
    // que nace la promesa: no hay sondeo ni reloj de por medio.
    if (arranque && interceptadas >= arranque.n) { arranque.resolver(); arranque = null; }
    return derivada;
  };

  /** Corre `promesa` con la red de última instancia. La red no decide en el caso normal. */
  async function conRed(promesa, mensaje) {
    let temporizador = null;
    const red = new Promise((_, rechazar) => {
      temporizador = setTimeout(() => rechazar(new Error(mensaje())), timeoutMs);
      temporizador.unref?.(); // que la red no mantenga vivo el proceso por sí sola
    });
    try {
      return await Promise.race([promesa, red]);
    } finally {
      clearTimeout(temporizador);
    }
  }

  /** Drena TODO lo registrado, incluidas las escrituras que nazcan mientras se drena. */
  async function drenar() {
    while (pendientes.length) {
      await Promise.allSettled(pendientes.splice(0));
    }
  }

  return {
    /**
     * Espera a que TODAS las escrituras YA EMPEZADAS hayan terminado. Resuelve cuando termina la
     * escritura, no cuando lo dice un reloj.
     *
     * Falla si no interceptó ninguna: ver `SIN_INTERCEPTAR`.
     */
    async esperar() {
      if (interceptadas === 0) throw new Error(SIN_INTERCEPTAR);
      await conRed(drenar(), () => mensajeRedDisparada(timeoutMs));
    },

    /**
     * Espera a que hayan ARRANCADO al menos `n` escrituras, y luego a que terminen.
     *
     * 🔴 PARA QUÉ HACE FALTA, porque no es lo mismo que `esperar()` con otro nombre:
     * `recordAudit` puede colgar de un fire-and-forget **ANIDADO**, con un `await` por medio:
     *
     *     ensureJobForQuote(quote.id).catch(() => {})   ← el llamador NO espera
     *        └─ await prisma.job.create(...)             ← un await POR MEDIO
     *             └─ recordAudit({ operario_asignado })  ← aquí nace la promesa
     *
     * En ese caso, cuando la petición del test resuelve, `prisma.auditLog.create` **todavía no
     * se ha llamado**. `esperar()` drena lo ya empezado, que es nada — y peor: su suelo daría un
     * ROJO con el diagnóstico EQUIVOCADO, «el log ya no pasa por aquí», cuando la verdad es «aún
     * no ha empezado».
     *
     * Es correcto también cuando la escritura YA arrancó: en ese caso no espera nada.
     */
    async esperarAlMenos(n = 1) {
      if (!Number.isInteger(n) || n < 1) throw new Error('esperarAlMenos: `n` debe ser un entero ≥ 1');
      if (interceptadas < n) {
        await conRed(
          new Promise((resolver) => { arranque = { n, resolver }; }),
          () => mensajeNoArrancaron(n, interceptadas, timeoutMs),
        );
      }
      await conRed(drenar(), () => mensajeRedDisparada(timeoutMs));
    },

    /**
     * Mensaje de assert enriquecido con el motivo REAL si alguna escritura falló. Sin fallos
     * capturados devuelve el mensaje tal cual: no inventa causas.
     */
    explicar(mensaje) {
      if (!fallos.length) return mensaje;
      const motivos = fallos.map((e) => (e?.code ? `${e.code} ${e?.message || ''}` : (e?.message || String(e))));
      return `${mensaje}\n   ↳ la escritura de AuditLog FALLÓ: ${motivos.join(' | ')}`;
    },

    /**
     * Nº de escrituras interceptadas.
     *
     * 🔴 EL USO QUE PARECE RARO Y ES EL CORRECTO — ver `scrum66-tipo-operacion.test.mjs`:
     * para afirmar que algo **NO** se audita, esto se compara con **0** y NO se llama a
     * `esperar()`. No es una migración descuidada: es la afirmación CONTRARIA. Un punto de
     * sincronización espera a que algo termine; cuando lo que se afirma es que no hay nada que
     * esperar, `esperar()` es justo lo que no se debe llamar — y de hecho LANZA (`SIN_INTERCEPTAR`).
     */
    get interceptadas() { return interceptadas; },

    /** Errores capturados en el `create`. */
    get fallos() { return [...fallos]; },

    /** Deshace la envoltura. Llamar SIEMPRE en un `finally`. */
    restaurar() {
      delegate.create = createOriginal;
    },
  };
}
