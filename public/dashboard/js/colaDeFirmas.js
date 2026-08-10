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
function claveDeFirma(albaranId) {
  if (albaranId === null || albaranId === undefined) return null;
  const id = String(albaranId).trim();
  if (!id || id === 'undefined' || id === 'null' || id === 'NaN') return null;
  return `firma:albaran:${id}`;
}

/**
 * Mete la firma en la cola antes de intentar subirla.
 *
 * Devuelve el resultado del almacén tal cual —GUARDADO, NO_DISPONIBLE o FALLO—, sin aplanarlo:
 * quien llama necesita distinguir «hay red de seguridad» de «no la hay», y son cosas distintas.
 */
async function encolarFirma(albaranId, cuerpo) {
  const claveIdempotencia = claveDeFirma(albaranId);
  if (!claveIdempotencia) return { estado: window.FALLO, motivo: 'sin id de albarán' };
  return window.guardarFirmaPendiente(
    Object.assign({ claveIdempotencia, albaranId }, cuerpo || {}),
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
async function firmarConRedDeSeguridad(albaranId, cuerpo, subir) {
  const clave = claveDeFirma(albaranId);
  if (!clave) {
    // El suelo: sin clave no se firma. Una firma que no se puede identificar no se puede
    // desencolar, y una cola de la que no se puede sacar nada sube la misma firma para siempre.
    const e = new Error('No se ha podido preparar la firma.');
    e.sinClave = true;
    throw e;
  }

  const encolado = await encolarFirma(albaranId, cuerpo);
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

// Frontend vanilla, sin bundler: se publica en `window` como el resto del dashboard.
window.claveDeFirma = claveDeFirma;
window.encolarFirma = encolarFirma;
window.firmarConRedDeSeguridad = firmarConRedDeSeguridad;
