// public/dashboard/js/colaDeFirmas.js — SCRUM-358 (H3 · fase 2)
//
// EL PRODUCTOR DE LA COLA: encolar una firma que no ha podido subir.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LO QUE FALTABA
//
// El almacén existe (SCRUM-455) y los tres estados existen (SCRUM-356), pero **nadie escribía en
// `firmasPendientes`**: firmar iba directo al servidor y, si no llegaba, la firma se quedaba en
// pantalla y en ningún sitio más. Esto es lo que convierte lo anterior en producto.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ORDEN DE LAS OPERACIONES: SE ENCOLA ANTES DE SUBIR
//
// Las dos opciones y lo que cuesta equivocarse:
//
//   SUBIR → ENCOLAR SI FALLA   hay una ventana en la que el proceso puede morir —el pro cierra la
//                              app, iOS la mata, el móvil se queda sin batería— con la firma NI
//                              SUBIDA NI ENCOLADA. Se perdió, y nadie lo sabe.
//   ENCOLAR → SUBIR → QUITAR   la firma no se pierde nunca. El riesgo es el contrario: si el
//                              proceso muere entre la confirmación y el desencolado, queda un
//                              FANTASMA que se reintentará.
//
// **Se encola antes.** Con la asimetría de coste delante no hay empate: un fantasma se reintenta y
// el servidor lo para; una firma perdida no la para nada, y el profesional se entera tres semanas
// después discutiendo con el cliente.
//
// ⚠️ Y LA VENTANA DEL PRIMER CAMINO NO ES TEÓRICA: el `POST` de firmar **no tiene plazo**. El de
// SCRUM-451 cubre sólo GET —abortar una mutación puede duplicar una factura—, así que contra una
// red que acepta y no entrega esa petición **no vuelve nunca**. La ventana no dura milisegundos:
// dura lo que el profesional tarde en cerrar la aplicación.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUIÉN PARA AL FANTASMA — Y NO ES LA CLAVE DE IDEMPOTENCIA. MEDIDO.
//
// La clave de idempotencia que construyó SCRUM-358 (11-ago) es del **ALTA** del albarán, no de la
// firma: el endpoint de firmar **no la acepta**. Se leyó entero
// (`src/modules/jobs/app/routes/albaranes.routes.ts:639-703`) y sus entradas son `signatureData`,
// `firmadoPorNombre`, `firmadoPorCalidad` y `firmadoPorCalidadOtro`. Nada más.
//
// **Al fantasma lo para el propio documento**: `albaran.estado === 'firmado'` devuelve
// **409 `albaran_locked`** (`albaranes.routes.ts:644-646`) y no escribe nada. Firmar es terminal y
// se puede pedir dos veces sin consecuencias en los datos.
//
// Decirlo importa porque la alternativa era añadir la clave al camino de firma, y eso es
// **modificar el camino de emisión y el sellado** — fuera de este carril, y sin necesidad: la
// protección ya está y está medida.

/**
 * 🔴 LA CLAVE ES DETERMINISTA, Y ÉSE ES TODO SU SENTIDO.
 *
 * Se acuña a partir del `albaranId` —el identificador de la API, que no se traduce— y **no cambia
 * entre reintentos**. Un uuid aleatorio parecería más «clave» y sería un defecto: dos intentos de
 * firmar el mismo albarán dejarían DOS entradas en la cola, y el pro subiría su firma dos veces.
 * Siendo determinista, el `keyPath` del almacén hace que el segundo intento **sobrescriba** al
 * primero. Una entrada por albarán, sin código que lo vigile.
 *
 * Se apoya en dos hechos medidos, no en una suposición:
 *   · el albarán SIEMPRE tiene id de servidor —se crea con cobertura, no hay creación sin red—,
 *     así que no hace falta acuñar identidad en el cliente;
 *   · un albarán sólo se puede firmar UNA vez: `firmado` es terminal (`canTransitionAlbaran`).
 *
 * Devuelve `null` si el id no sirve. **Sin clave no se firma** — lo dijo el `keyPath` de
 * SCRUM-455: una firma sin clave es un duplicado esperando a ocurrir.
 */
function claveDeFirma(documentoId, tipo) {
  if (documentoId === null || documentoId === undefined) return null;
  const id = String(documentoId).trim();
  if (!id || id === 'undefined' || id === 'null' || id === 'NaN') return null;
  // SCRUM-652 (T3 fase C) · el TIPO ya estaba en la clave («firma:albaran:7»), y por eso esto se
  // generaliza sin migrar nada: una clave vieja SIGUE SIENDO la clave de su albarán. El default
  // es `albaran` justo para eso — las llamadas de hoy no cambian de valor.
  //
  // 🔴 Y hace falta de verdad: sin el tipo, el albarán 7 y el parte 7 acuñarían LA MISMA clave, y
  // como el `keyPath` del almacén sobrescribe por clave, encolar uno se llevaría por delante la
  // firma del otro. Un documento firmado desapareciendo en silencio.
  return `firma:${tipo || 'albaran'}:${id}`;
}

/**
 * Mete la firma en la cola antes de intentar subirla.
 *
 * Devuelve el resultado del almacén tal cual —GUARDADO, NO_DISPONIBLE o FALLO—, sin aplanarlo:
 * quien llama necesita distinguir «hay red de seguridad» de «no la hay», y son cosas distintas.
 */
async function encolarFirma(documentoId, cuerpo, tipo) {
  const claveIdempotencia = claveDeFirma(documentoId, tipo);
  if (!claveIdempotencia) return { estado: window.FALLO, motivo: 'sin id de documento' };
  // SCRUM-360 fase 3 · queda constancia FUERA de IndexedDB de que este navegador tuvo cola.
  // Sin esto, un desalojo se lleva la cola Y la prueba de que existió, y no hay nada que detectar.
  if (typeof window.marcarQueHuboCola === 'function') window.marcarQueHuboCola();
  return window.guardarFirmaPendiente(
    // SCRUM-358 fase 3 · `encoladaEn` lo añade el drenado para poder ORDENAR. Se pone al encolar
    // y NO se toca al reintentar: es cuándo el cliente firmó, no cuándo se intentó subir.
    // `albaranId` conserva su nombre A PROPÓSITO: es la clave con la que están guardadas las
    // firmas que YA HAY en los móviles. Renombrarlo dejaría huérfana toda cola existente, que es
    // justo lo que esta máquina existe para no hacer. `tipo` dice a dónde va; el default lo pone
    // el que sube, no el que guarda.
    Object.assign({ claveIdempotencia, albaranId: documentoId, tipo: tipo || 'albaran', encoladaEn: Date.now() }, cuerpo || {}),
  );
}

/**
 * FIRMA CON RED DE SEGURIDAD: encola, sube, y desencola sólo si el servidor confirma.
 *
 * `subir` es la petición real —se inyecta para que el camino se pueda ejercitar entero contra el
 * banco de red— y devuelve lo que responda el servidor.
 *
 * Devuelve `{ estado, encolada, error }`:
 *   · `estado` es uno de los tres de SCRUM-356, y ③ sólo se alcanza con confirmación del servidor;
 *   · `encolada` dice si hubo red de seguridad, que NO es lo mismo que si la firma subió;
 *   · `error` se propaga para que la vista siga dando su mensaje aprobado — aquí no se redacta
 *     ninguno (regla 30).
 *
 * 🔴 SIN ALMACÉN SE SIGUE FIRMANDO, y es una decisión, no un descuido. Si `firmasPendientes` no
 * está disponible —navegación privada, cuota— el intento sigue adelante: sin red de seguridad,
 * exactamente como el producto se comporta hoy. Lo contrario sería impedir firmar a quien hoy
 * puede, para protegerlo de un caso que sólo ocurre si además falla la red. Y no se le miente: si
 * la subida falla, no hay ③, y el trazo sigue en pantalla (SCRUM-404), que es lo que dice el
 * mensaje ya aprobado del camino de firma.
 */
async function firmarConRedDeSeguridad(documentoId, cuerpo, subir, tipo) {
  const clave = claveDeFirma(documentoId, tipo);
  if (!clave) {
    // El suelo: sin clave no se firma. Una firma que no se puede identificar no se puede
    // desencolar, y una cola de la que no se puede sacar nada sube la misma firma para siempre.
    const e = new Error('No se ha podido preparar la firma.');
    e.sinClave = true;
    throw e;
  }

  const encolado = await encolarFirma(documentoId, cuerpo, tipo);
  const encolada = encolado && encolado.estado === window.GUARDADO;

  let respuesta;
  try {
    respuesta = await subir();
  } catch (error) {
    // No se desencola: es justo el caso para el que existe la cola.
    return { estado: window.FIRMA_SOLO_EN_ESTE_MOVIL, encolada, error };
  }

  if (!window.confirmaElServidor(respuesta)) {
    // Respondió algo que no es una confirmación —el HTML de un portal cautivo, por ejemplo—. No
    // subió: se queda en la cola.
    return { estado: window.FIRMA_SOLO_EN_ESTE_MOVIL, encolada, respuesta };
  }

  // Confirmada: fuera de la cola. Si el desencolado fallara, queda un fantasma —y el 409
  // `albaran_locked` del servidor lo para—, pero el estado que se devuelve es el que el servidor
  // ya ha declarado: la firma ESTÁ a salvo, y eso no depende de que el móvil sepa olvidarla.
  if (encolada) await window.quitarFirmaPendiente(clave);
  return { estado: window.FIRMA_A_SALVO, encolada, respuesta };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-358 · FASE 3 · EL DRENADO — que la cola se vacíe SOLA
//
// Hasta aquí la cola guardaba y no vaciaba: una firma encolada se quedaba dentro hasta que el
// profesional volviera a pulsar «Firmar aquí mismo» en ese albarán. Por eso el aviso hubo que
// degradarlo a «no suben solas todavía». Esto lo devuelve a la verdad.
//
// 🔴 SE DRENA AL ABRIR LA APLICACIÓN, y no es una elección de comodidad: en iOS **no hay
// Background Sync** (0 % en Safari, medido en H0) y el push está descartado (regla 36). No existe
// ningún momento en el que el navegador nos despierte. El único momento que tenemos es éste.
//
// 🔴 EL ORDEN ES EL MISMO QUE EN LA FASE 2, Y POR EL MISMO MOTIVO: se desencola CUANDO EL SERVIDOR
// CONFIRMA, nunca cuando se lanza. Una firma que desaparece de la cola sin confirmación es una
// firma perdida — y aquí es peor que en la fase 2, porque ya no hay nadie detrás que la reintente.


/**
 * El orden de subida: **la más antigua primero**.
 *
 * No hay dependencia entre firmas —cada una es de un albarán distinto— así que el orden no cambia
 * el resultado. Cambia QUIÉN se queda fuera si algo va mal, y por eso se elige: la más antigua es
 * la que lleva más tiempo en riesgo. Si el navegador desaloja el almacén (iOS a los 7 días, H5) o
 * la cuota se agota, lo que se pierde es lo más viejo. Subir eso primero es reducir el daño del
 * peor caso, no ordenar por ordenar.
 *
 * Una firma SIN `encoladaEn` va **primero**: sólo puede venir de una versión anterior a la fase 3,
 * así que lleva ahí más tiempo que cualquiera con marca. Tratarla como la más nueva la dejaría
 * siempre la última — justo la que peor lo tiene.
 */
function ordenDeDrenado(firmas) {
  return [...(firmas || [])].sort((a, b) => {
    const ta = Number(a && a.encoladaEn);
    const tb = Number(b && b.encoladaEn);
    const va = Number.isFinite(ta) ? ta : -Infinity;
    const vb = Number.isFinite(tb) ? tb : -Infinity;
    if (va !== vb) return va - vb;
    // Empate: por clave, para que el orden sea estable y el test pueda afirmarlo.
    return String(a.claveIdempotencia).localeCompare(String(b.claveIdempotencia));
  });
}

/**
 * 🔴 UN 409 `albaran_locked` ES UN ÉXITO, y es la sutileza de esta fase.
 *
 * Significa «este albarán ya está firmado»: el servidor LO TIENE. Que llegue como error HTTP no lo
 * convierte en un fallo nuestro — es el caso normal de un reintento cuya petición anterior sí
 * llegó y cuya respuesta se perdió.
 *
 * Si se tratara como fallo, esa firma **no saldría de la cola jamás**: cada apertura reintentaría,
 * cada reintento daría 409, y el contador le diría al profesional que tiene algo pendiente que
 * lleva semanas a salvo. La cola no se vaciaría nunca y el aviso mentiría en la otra dirección.
 *
 * Se mira `err.code`, no el texto: ramificar por mensaje es lo que nunca hay que hacer, y `api.js`
 * expone el código justo para esto.
 */
function elServidorYaLaTiene(error) {
  // SCRUM-652 · `parte_locked` es el gemelo exacto de `albaran_locked`, y tiene que estar aquí o
  // la firma de un parte reintentado NO SALDRÍA DE LA COLA JAMÁS: cada apertura daría 409, cada
  // 409 se leería como fallo, y el contador le diría al profesional que tiene pendiente algo que
  // lleva semanas a salvo. Se mira el código, nunca el texto.
  return !!error && error.status === 409 &&
    (error.code === 'albaran_locked' || error.code === 'parte_locked');
}


/**
 * Vacía la cola: sube lo que pueda y deja dentro lo que no.
 *
 * `subirFirma(firma)` hace la petición real; se inyecta para poder ejercitar el camino entero
 * contra el banco de red.
 *
 * Devuelve `{ estado, subidas, yaEstaban, quedan, fallidas }`.
 *
 * 🔴 EL SUELO: si no se consigue LEER la cola, NO se dice «nada pendiente». Se devuelve el estado
 * del almacén tal cual —NO_DISPONIBLE o FALLO— y `quedan: null`. «Cola vacía» y «no supe mirarla»
 * son la misma pantalla y significan lo contrario, y aquí el segundo le dice al profesional que
 * está todo a salvo.
 */
async function drenarFirmasPendientes(subirFirma, opciones) {
  const plazo = (opciones && opciones.plazoMs) || 0;   // 0 = el de la casa (api.js)

  const cola = await window.leerFirmasPendientes();
  if (!cola || cola.estado !== window.GUARDADO || !Array.isArray(cola.firmas)) {
    return {
      estado: (cola && cola.estado) || window.FALLO,
      subidas: 0, yaEstaban: 0, quedan: null, fallidas: [],
    };
  }

  let subidas = 0;
  let yaEstaban = 0;
  const fallidas = [];

  for (const firma of ordenDeDrenado(cola.firmas)) {
    // 🔴 UNA QUE FALLA NO BLOQUEA A LAS DEMÁS — pero tampoco se salta EN SILENCIO: cae en
    // `fallidas` con su motivo, para que quien mire pueda decir cuál y por qué.
    const r = await window.esperarLoQueLaRed(Promise.resolve().then(() => subirFirma(firma)), plazo);

    if (r.vencio) {
      fallidas.push({ clave: firma.claveIdempotencia, motivo: 'no respondió a tiempo' });
      continue;
    }
    if (r.error) {
      if (elServidorYaLaTiene(r.error)) {
        // Ya está a salvo: sale de la cola igual que si la hubiéramos subido nosotros.
        const quitada = await window.quitarFirmaPendiente(firma.claveIdempotencia);
        if (quitada && quitada.estado === window.GUARDADO) yaEstaban += 1;
        else fallidas.push({ clave: firma.claveIdempotencia, motivo: 'el servidor la tiene y no se pudo sacar de la cola' });
        continue;
      }
      fallidas.push({ clave: firma.claveIdempotencia, motivo: String((r.error && r.error.message) || r.error) });
      continue;
    }
    if (!window.confirmaElServidor(r.valor)) {
      // Respondió algo que no es una confirmación —el HTML de un portal cautivo—. No subió.
      fallidas.push({ clave: firma.claveIdempotencia, motivo: 'la respuesta no confirma' });
      continue;
    }

    // CONFIRMADA. Sólo aquí sale de la cola.
    const quitada = await window.quitarFirmaPendiente(firma.claveIdempotencia);
    if (quitada && quitada.estado === window.GUARDADO) subidas += 1;
    else fallidas.push({ clave: firma.claveIdempotencia, motivo: 'subió y no se pudo sacar de la cola' });
  }

  const despues = await window.leerFirmasPendientes();
  const quedan = (despues && despues.estado === window.GUARDADO && Array.isArray(despues.firmas))
    ? despues.firmas.length
    : null;   // se pudo drenar y no se pudo releer: no se inventa un cero

  // Si la cola quedó vacía DE VERDAD —leída y sin nada—, ya no hay nada que perder: se retira la
  // marca. Dejarla puesta haría que el siguiente arranque avisara de una pérdida que no hubo.
  if (quedan === 0 && typeof window.olvidarQueHuboCola === 'function') window.olvidarQueHuboCola();
  return { estado: window.GUARDADO, subidas, yaEstaban, quedan, fallidas };
}

/**
 * Sube UNA firma de la cola por el mismo endpoint que el botón de firmar.
 *
 * ⚠️ Se envía SÓLO lo que el servidor acepta —`signatureData`, `firmadoPorNombre`,
 * `firmadoPorCalidad`, `firmadoPorCalidadOtro`, medido en
 * `src/modules/jobs/app/routes/albaranes.routes.ts:639-703`—. `claveIdempotencia`, `albaranId` y
 * `encoladaEn` son NUESTROS: sirven para manejar la cola y no viajan. El endpoint de firmar **no
 * acepta clave de idempotencia** y metérsela sería tocar el sellado.
 */
function subirFirmaDeLaCola(firma) {
  const cuerpo = { signatureData: firma.signatureData };
  for (const campo of ['firmadoPorNombre', 'firmadoPorCalidad', 'firmadoPorCalidadOtro']) {
    if (firma[campo] !== undefined) cuerpo[campo] = firma[campo];
  }
  // 🔴 A SU ENDPOINT, y el default importa: una firma encolada por una versión ANTERIOR a
  // SCRUM-652 no tiene `tipo`, y es de un albarán por construcción —era lo único que se podía
  // firmar—. Sin el default se quedaría sin ruta y sin subir, después de haber sobrevivido a la
  // falta de cobertura que la puso ahí.
  const RUTAS = { albaran: '/admin/albaranes', parte: '/admin/partes' };
  const base = RUTAS[firma.tipo || 'albaran'];
  if (!base) {
    // Ni se adivina ni se cae al albarán: subir la firma de un documento desconocido a la ruta
    // equivocada es peor que no subirla. Se queda en la cola y se dice cuál.
    return Promise.reject(Object.assign(new Error(`tipo de documento desconocido: ${firma.tipo}`), { tipoDesconocido: true }));
  }
  return window.apiRequest(`${base}/${firma.albaranId}/firmar`, {
    method: 'POST',
    body: JSON.stringify(cuerpo),
  });
}

/**
 * El drenado tal y como lo dispara la aplicación al abrirse.
 *
 * No lanza nunca: cerrar la cola no puede tumbar el arranque del dashboard. Y **repinta el aviso**
 * al terminar, porque el contador es el ÚNICO sitio donde el profesional ve que el drenado
 * funcionó: si sube una firma y el número no se mueve, para él no ha pasado nada.
 */
async function drenarAlAbrir() {
  if (typeof window.leerFirmasPendientes !== 'function') return null;
  let r = null;
  try {
    r = await drenarFirmasPendientes(subirFirmaDeLaCola);
  } catch (_e) {
    r = null;   // el drenado es best-effort; lo que NO puede es quedarse a medias sin decirlo
  }
  try {
    if (typeof window.pintarFirmasPendientesEnHome === 'function') {
      await window.pintarFirmasPendientesEnHome();
    }
  } catch (_e) { /* la home puede no estar montada todavía */ }
  return r;
}

// Frontend vanilla, sin bundler: se publica en `window` como el resto del dashboard.
window.subirFirmaDeLaCola = subirFirmaDeLaCola;
window.drenarAlAbrir = drenarAlAbrir;
window.claveDeFirma = claveDeFirma;
window.encolarFirma = encolarFirma;
window.firmarConRedDeSeguridad = firmarConRedDeSeguridad;
window.ordenDeDrenado = ordenDeDrenado;
window.elServidorYaLaTiene = elServidorYaLaTiene;
window.drenarFirmasPendientes = drenarFirmasPendientes;
