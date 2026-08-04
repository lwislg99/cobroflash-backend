// tests/_wa-log-sync.mjs — SCRUM-250: punto de sincronización DETERMINISTA para las
// escrituras fire-and-forget del log WA-0b, sin tocar una línea del camino de producción.
//
// ── EL PROBLEMA ───────────────────────────────────────────────────────────────
// `recordWaMessage` se llama sin `await` en los 16 call-sites de `src/integrations/whatsapp.ts`
// (`recordWaMessage({...}).catch(() => {})`), y con razón: registrar telemetría JAMÁS debe poder
// tumbar un envío de WhatsApp. La consecuencia es que cuando `sendWhatsAppTemplate` devuelve, el
// INSERT puede no haber aterrizado todavía. El test de SCRUM-115 lo resolvía sondeando la tabla
// 30 veces cada 100 ms, y bajo contención del pool de staging la fila llegaba pasados esos 3 s:
// cayó en dos tandas y no cayó en la tercera CON EL MISMO CÓDIGO. La variable era la latencia de
// staging, no el diff.
//
// ── POR QUÉ NO SE ARREGLA SUBIENDO EL POLL ────────────────────────────────────
// Subir el sondeo a 10 s esconde la carrera en vez de cerrarla: sigue habiendo un número que
// decide, y el día que staging vaya un poco peor vuelve el mismo rojo falso.
//
// ── LA CLAVE: LA PROMESA YA EXISTE, PRODUCCIÓN SOLO LA TIRA ───────────────────
// `recordWaMessage` es `async` y DEVUELVE una promesa. El fire-and-forget no es «no hay promesa»,
// es «hay una promesa y nadie la recoge». Este helper la recoge DESDE FUERA:
//
//   · `dist` es CommonJS y `whatsapp.js` llama `(0, whatsappLog_service_1.recordWaMessage)({...})`
//     — acceso a propiedad EN EL MOMENTO DE LA LLAMADA, sobre el objeto `exports` del módulo.
//   · `exports.recordWaMessage` es `writable: true, configurable: true` (medido).
//   · Envolverla (llamar a la original, registrar su promesa, devolver ESA MISMA promesa) es
//     invisible para producción: no añade ningún `await`, y no añade nada que pueda lanzar.
//
// El envío NO se vuelve síncrono y un fallo de registro sigue sin poder romper un mensaje.
// Este fichero solo vive dentro de un proceso de test y restaura lo que tocó.
//
// ── POR QUÉ ES DETERMINISTA Y NO UN POLL CON MÁS SEGUNDOS ─────────────────────
// La propiedad que lo sostiene: EL REGISTRO OCURRE ANTES DE QUE LA PROMESA DEL ENVÍO RESUELVA.
// `logFailure()` está en el camino hacia el `return` de `sendWhatsAppTemplate`, y llamar a una
// función `async` ejecuta su cuerpo hasta el primer `await` — o sea que `prisma.whatsAppMessage
// .create(...)` se invoca antes de ceder el control (medido: se invoca SÍNCRONAMENTE dentro de
// la llamada). Cuando el test hace `await sendWhatsAppTemplate(...)`, la promesa YA está aquí.
// No existe la ventana en la que el test mire un registro vacío y siga adelante.
//
// Resultado: bajo staging lento el test espera 4,86 s y pasa; bajo staging rápido espera 40 ms.
// Varía la DURACIÓN, no el resultado. No hay número que ajustar.
import { setTimeout as programar } from 'node:timers';

/**
 * RED DE ÚLTIMA INSTANCIA — y no es lo mismo que el poll que este fichero viene a quitar.
 * Conviene tenerlo escrito porque se confunden a simple vista:
 *
 *   · El poll de 3 s decidía el VEREDICTO con el reloj: «si en 3 s no hay fila, fallo».
 *     Ese era el defecto.
 *   · Un timeout de 60 s no decide nada en el caso normal: solo convierte «colgado para
 *     siempre» en «rojo con mensaje». Es una red de última instancia, no una espera.
 *
 * En el caso normal la espera la termina la escritura, no este número. Solo actúa si la
 * adquisición de conexión del pool no estuviera acotada — Prisma la acota por su cuenta
 * (`pool_timeout`, error P2024) y entonces la promesa resuelve sola y esto nunca dispara.
 */
export const TIMEOUT_RED_MS = 60_000;

export const SIN_INTERCEPTAR =
  'SCRUM-250: no se interceptó NINGUNA escritura de WA-0b. El log ya no pasa por ' +
  '`recordWaMessage` (¿se enrutó por otra función?), así que este helper no está sincronizando ' +
  'nada y el test habría vuelto a depender del reloj sin que se notara. Revisa el camino de ' +
  'registro antes de tocar el test. (SCRUM-255: si el envío se dispara ANIDADO —la ruta lo lanza ' +
  'sin await y responde antes—, lo que quieres es `esperarAlMenos(n)`, no `esperar()`.)';

/** El texto lleva los ms REALES con los que se armó la red, no la constante: si alguien la baja
 *  en un test y el mensaje siguiera diciendo 60000, el rojo mentiría sobre lo que midió. */
/** SCRUM-255 · «no ARRANCÓ» ≠ «no terminó». Los dos rojos mandan a mirar sitios distintos. */
export const mensajeNoArrancaron = (n, vistas, ms) =>
  `SCRUM-255: se esperaban al menos ${n} escritura(s) de WA-0b y en ${ms} ms arrancaron ${vistas}. ` +
  'Eso NO es «la escritura tarda»: es que NO EMPEZÓ. Mira si el camino sigue llamando a ' +
  '`recordWaMessage` antes de subir este número.';

export const mensajeRedDisparada = (ms) =>
  `SCRUM-250: la escritura de WA-0b no terminó en ${ms} ms. Eso NO es el sondeo de antes ` +
  'agotándose: es una escritura que no acaba nunca. Mira el pool de conexiones (P2024) antes ' +
  'de subir este número.';

/**
 * Envuelve el registro de WA-0b para poder esperarlo de forma determinista.
 *
 * `log` y `prisma` van POR PARÁMETRO, no importados — mismo patrón que `_merchant-fixture.mjs`:
 * así `wa-log-sync.test.mjs` puede inyectar dobles y probar las garantías EN ROJO sin BD y sin
 * gate, en el `npm test` normal. Una red que solo se ejercita cuando alguien levanta staging no
 * es una red.
 *
 * @param {object}   opts
 * @param {object}   opts.log     objeto `exports` de `dist/modules/messaging/domain/whatsappLog.service.js`
 * @param {object}   [opts.prisma] cliente Prisma (capa 2: diagnóstico; opcional)
 * @param {number}   [opts.timeoutMs]
 */
export function interceptarWaLog({ log, prisma, timeoutMs = TIMEOUT_RED_MS } = {}) {
  if (!log || typeof log.recordWaMessage !== 'function') {
    throw new Error('interceptarWaLog: `log.recordWaMessage` no es una función (¿módulo equivocado?)');
  }

  const pendientes = [];
  const fallos = [];
  let interceptadas = 0;
  /** SCRUM-255 · espera de ARRANQUE pendiente: `{ n, resolver }`. Ver `esperarAlMenos`. */
  let arranque = null;

  // ── CAPA 1 · el punto de espera, en el borde del módulo ─────────────────────
  // Se ENVUELVE, no se sustituye: la escritura de verdad sigue ocurriendo. Se devuelve la
  // MISMA promesa que devolvió la original, así que el call-site de producción ve exactamente
  // lo que veía antes (y su `.catch(() => {})` sigue siendo el único que la maneja).
  const recordOriginal = log.recordWaMessage;
  log.recordWaMessage = function envueltaWaLog(input) {
    const p = recordOriginal.call(this, input);
    interceptadas++;
    pendientes.push(Promise.resolve(p));
    // SCRUM-255: despertar a quien esperaba a que ARRANCARAN n escrituras (`esperarAlMenos`).
    // Se resuelve en el mismo tick en que nace la promesa: sin sondeo y sin reloj.
    if (arranque && interceptadas >= arranque.n) { arranque.resolver(); arranque = null; }
    return p;
  };

  // ── CAPA 2 · el diagnóstico ─────────────────────────────────────────────────
  // `recordWaMessage` se TRAGA el error (try/catch interno, a propósito: no debe romper un
  // envío). Bien para producción, ciego para el test: un fallo de escritura llega como «no hay
  // fila», sin causa. Envolviendo el `create` se captura el motivo REAL antes de que se lo
  // trague, y el rojo pasa a decir «la escritura falló: P2024 …» en vez de «no hay fila».
  // Es la señal que le falta a la otra cara del problema (las huérfanas de SCRUM-194).
  //
  // ⚠️ UNA SOLA SUSCRIPCIÓN. Un `PrismaPromise` es PEREZOSO: no ejecuta hasta que alguien
  // llama a su `.then`. Por eso aquí se llama UNA vez y se devuelve la promesa derivada, en
  // vez de suscribirse aparte y devolver la original — así no hay que razonar sobre si dos
  // suscripciones ejecutan el INSERT dos veces. La derivada pierde la condición de
  // `PrismaPromise` (no vale dentro de `$transaction`), y eso es seguro aquí: en todo `src/`
  // hay UN solo `prisma.whatsAppMessage.create`, en `whatsappLog.service.ts:33`, y está fuera
  // de cualquier transacción (verificado). Además esto solo existe dentro del test y se restaura.
  const delegate = prisma?.whatsAppMessage;
  const createOriginal = typeof delegate?.create === 'function' ? delegate.create : null;
  if (createOriginal) {
    delegate.create = function envueltaWaCreate(...args) {
      const p = createOriginal.apply(this, args);
      return p.then(
        (valor) => valor,
        (err) => { fallos.push(err); throw err; },
      );
    };
  }

  /** Corre `promesa` con la red de última instancia. La red no decide en el caso normal. */
  async function conRed(promesa, mensaje) {
    let temporizador = null;
    const red = new Promise((_, rechazar) => {
      temporizador = programar(() => rechazar(new Error(mensaje())), timeoutMs);
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
     * Espera a que TODAS las escrituras de WA-0b iniciadas hayan terminado. Resuelve cuando
     * termina la escritura, no cuando lo dice un reloj.
     */
    async esperar() {
      if (interceptadas === 0) throw new Error(SIN_INTERCEPTAR);
      await conRed(drenar(), () => mensajeRedDisparada(timeoutMs));
    },

    /**
     * SCRUM-255 · Espera a que hayan ARRANCADO al menos `n` escrituras, y luego a que terminen.
     *
     * 🔴 PARA QUÉ HACE FALTA, y no es `esperar()` con otro nombre. El envío de WhatsApp puede
     * dispararse ANIDADO: una ruta lo lanza sin `await` y responde antes —
     *
     *     sendAlbaranFirmadoWhatsApp(albaran.id).catch(…);  ← albaranPublic.routes.ts:240
     *     return res.json({ ok: true });                     ← responde ANTES
     *
     * Cuando el test recibe la respuesta, `recordWaMessage` **todavía no se ha llamado**:
     * al envío le falta generar el PDF y hablar con Meta. `esperar()` drena lo ya empezado, que
     * es nada, y su suelo da un ROJO CON EL DIAGNÓSTICO EQUIVOCADO — «el log ya no pasa por
     * `recordWaMessage`» cuando la verdad es «aún no ha empezado». Pasó de verdad en la tanda
     * gateada de SCRUM-255, en la segunda ventana de `scrum49-firma-remota`.
     *
     * CUÁNDO USAR CUÁL: si la acción que dispara el envío se ESPERA (la ruta hace
     * `await sendAlbaran…`, como `albaranes.routes.ts:577` y `:592`), `esperar()` basta. Si la
     * ruta lo lanza y responde, hace falta esto. **Censo derivado del call-graph en SCRUM-255:
     * hay 23 disparos anidados en 7 ficheros**, así que esto no es un parche para un sitio.
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
     * Mensaje de assert enriquecido con el motivo REAL si alguna escritura falló.
     * Sin fallos capturados devuelve el mensaje tal cual: no inventa causas.
     */
    explicar(mensaje) {
      if (!fallos.length) return mensaje;
      const motivos = fallos.map((e) => e?.code ? `${e.code} ${e?.message || ''}` : (e?.message || String(e)));
      return `${mensaje}\n   ↳ la escritura de WA-0b FALLÓ: ${motivos.join(' | ')}`;
    },

    /** Nº de escrituras interceptadas (para asserts propios del helper). */
    get interceptadas() { return interceptadas; },

    /** Errores capturados en el `create` (capa 2). */
    get fallos() { return [...fallos]; },

    /** Deshace las dos envolturas. Llamar SIEMPRE en un `finally`. */
    restaurar() {
      log.recordWaMessage = recordOriginal;
      if (createOriginal) delegate.create = createOriginal;
    },
  };
}
