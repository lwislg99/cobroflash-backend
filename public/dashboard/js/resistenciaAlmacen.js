// public/dashboard/js/resistenciaAlmacen.js — SCRUM-360 (H5 · fase 3)
//
// QUE iOS NO SE LLEVE UNA FIRMA EN SILENCIO.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA, Y POR QUÉ AHORA
//
// [MEDIDO en H0] WebKit borra **el origen entero** —service worker, Cache API e IndexedDB, todo
// junto— tras **7 días** de usar Safari sin visitar el sitio. Los web apps añadidos a la pantalla
// de inicio están EXENTOS; una pestaña normal, no.
//
// Hasta ahora esto era teoría porque no había nada que perder. Ya lo hay: `firmasPendientes`
// guarda firmas de verdad (SCRUM-358 fase 2) y sólo se vacía al abrir la aplicación (fase 3). Un
// profesional que emite cada dos semanas, en una pestaña de Safari, **pierde una firma pendiente**.
// Y no se entera él ni nos enteramos nosotros: esa firma nunca llegó a nuestro servidor.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LAS TRES PIEZAS
//
//   ① PEDIR PERSISTENCIA — y MIRAR la respuesta. Pedirla sin mirar no sirve de nada.
//   ② DETECTAR EL DESALOJO — si hubo almacén y ya no hay, algo se perdió.
//   ③ MIRAR EL ESPACIO antes de encolar, en vez de descubrirlo al fallar.

// ── ① PERSISTENCIA ─────────────────────────────────────────────────────────────────────────

const PERSISTENTE = 'PERSISTENTE';
const NO_PERSISTENTE = 'NO_PERSISTENTE';
const NO_SE_SABE = 'NO_SE_SABE';

/**
 * Pide almacenamiento persistente y **devuelve lo que ha contestado el navegador**.
 *
 * 🔴 PEDIRLO Y NO MIRAR LA RESPUESTA NO SIRVE DE NADA. `persist()` puede decir que no —Safari lo
 * concede por heurística, y en una pestaña normal lo normal es que no—, y ese «no» significa que
 * **el navegador puede borrar la cola cuando quiera**. Es un dato del producto, no un detalle: es
 * la diferencia entre «tus firmas están a salvo hasta que subas» y «pueden desaparecer solas».
 *
 * `NO_SE_SABE` cuando la API no existe. No es lo mismo que `NO_PERSISTENTE`: uno dice que el
 * navegador puede borrar, el otro que no hemos podido preguntar. Colapsarlos es la lección de
 * SCRUM-360 fase 1, que existe justo por esto.
 */
async function pedirPersistencia() {
  try {
    const s = navigator.storage;
    if (!s || typeof s.persist !== 'function') return NO_SE_SABE;
    const concedido = await s.persist();
    return concedido === true ? PERSISTENTE : NO_PERSISTENTE;
  } catch (_e) {
    return NO_SE_SABE;
  }
}

/** Lo mismo pero sin pedir nada: qué hay ahora mismo. */
async function estadoDePersistencia() {
  try {
    const s = navigator.storage;
    if (!s || typeof s.persisted !== 'function') return NO_SE_SABE;
    return (await s.persisted()) === true ? PERSISTENTE : NO_PERSISTENTE;
  } catch (_e) {
    return NO_SE_SABE;
  }
}

// ── ② DETECCIÓN DE DESALOJO ────────────────────────────────────────────────────────────────

/**
 * La marca de «este almacén existió alguna vez».
 *
 * 🔴 POR QUÉ NO PUEDE VIVIR DENTRO DE IndexedDB: se iría con él. Una marca que desaparece con lo
 * que vigila no vigila nada. Vive en `localStorage`, que es otro almacén y puede sobrevivir a un
 * desalojo parcial.
 *
 * ⚠️ Y ÉSE ES EL LÍMITE DE ESTA DETECCIÓN, declarado y no descubierto: si el borrado se lleva
 * **también** `localStorage` —que es lo que hace un borrado de origen completo— la marca se va con
 * la cola y **no detectamos nada**. Lo que se cubre es el caso en que IndexedDB se vacía y
 * `localStorage` no. Detectar el borrado total exigiría que el SERVIDOR recordara que este cliente
 * tuvo cola, y eso es una columna nueva: del fundador.
 */
const MARCA_HUBO_COLA = 'yaqu_hubo_cola';

// ⚠️ LA CLAVE VA COMO LITERAL EN LAS TRES LLAMADAS, y no es descuido: el censo AST de SCRUM-457
// —que comprueba que toda escritura del panel esté en el registro de purgado— resuelve literales,
// no identificadores, y con la constante **se declaraba CIEGO**. Estaba haciendo su trabajo: no
// puede decir si una clave se purga si no sabe cuál es.
//
// Se prefiere repetir el literal a enseñarle a resolver constantes —que es tocar un guard de otro
// carril— y `tests/scrum360-desalojo.test.mjs` ata literal y constante para que no diverjan.

/** Se llama al encolar. Deja constancia de que este navegador llegó a tener firmas. */
function marcarQueHuboCola() {
  try { localStorage.setItem('yaqu_hubo_cola', String(Date.now())); return true; }
  catch (_e) { return false; }   // sin localStorage no hay marca, y se dirá que no se sabe
}

function huboColaAlgunaVez() {
  try { return localStorage.getItem('yaqu_hubo_cola') !== null; }
  catch (_e) { return false; }
}

/** Se llama cuando la cola se vacía DE VERDAD (drenada): ya no hay nada que perder. */
function olvidarQueHuboCola() {
  try { localStorage.removeItem('yaqu_hubo_cola'); return true; } catch (_e) { return false; }
}

const SIN_PERDIDA = 'SIN_PERDIDA';
const POSIBLE_PERDIDA = 'POSIBLE_PERDIDA';

/**
 * ¿Se ha perdido algo?
 *
 * La señal es la conjunción: **hubo cola alguna vez** y **ahora el almacén no tiene nada**. No
 * sabemos QUÉ se perdió —esa información se fue con el almacén—, pero sabemos que pasó, y callarlo
 * es el fallo mudo que todo el bloque H existe para evitar.
 *
 * 🔴 EL CONTROL QUE DECIDE SI ESTO SIRVE: **un profesional nuevo también arranca con el almacén
 * vacío.** Si no se distinguen, le diríamos que ha perdido trabajo el día que se registra — y un
 * aviso que grita en falso se ignora, y entonces no avisa del bueno. Lo que los separa es la marca:
 * quien nunca encoló no la tiene.
 *
 * Y si no se puede LEER la cola, no se afirma nada: `NO_SE_SABE`. «Vacía» y «no supe mirarla» son
 * el mismo cero con significados opuestos.
 */
async function detectarDesalojo(leerCola) {
  const leer = leerCola || (typeof window !== 'undefined' && window.leerFirmasPendientes);
  if (typeof leer !== 'function') return { estado: NO_SE_SABE, motivo: 'no hay almacén que consultar' };

  let r;
  try { r = await leer(); } catch (e) { return { estado: NO_SE_SABE, motivo: String((e && e.message) || e) }; }

  const ok = typeof window !== 'undefined' ? window.GUARDADO : 'GUARDADO';
  if (!r || r.estado !== ok || !Array.isArray(r.firmas)) {
    // No poder leer la cola NO es «no queda nada»: es no saberlo.
    return { estado: NO_SE_SABE, motivo: (r && r.motivo) || 'no se pudo leer la cola' };
  }

  if (r.firmas.length > 0) return { estado: SIN_PERDIDA, motivo: 'la cola tiene firmas' };
  if (!huboColaAlgunaVez()) return { estado: SIN_PERDIDA, motivo: 'nunca hubo cola en este navegador' };
  return { estado: POSIBLE_PERDIDA, motivo: 'hubo cola y el almacén está vacío' };
}

// ── ③ EL ESPACIO ───────────────────────────────────────────────────────────────────────────

/**
 * 🔴 EL TOPE, MEDIDO Y NO ELEGIDO A OJO.
 *
 * Cuánto ocupa una firma, medido en Edge con el MISMO canvas y el MISMO
 * `toDataURL('image/png')` que usa `signaturePad.js` (340×180 css, escalado por `devicePixelRatio`):
 *
 *     dpr 1 · 1 trazo    11.470 car (~11 KB)     dpr 2 · 3 trazos   56.906 car (~56 KB)
 *     dpr 2 · 1 trazo    28.866 car (~28 KB)     dpr 3 · 3 trazos   97.550 car (~95 KB)
 *     dpr 3 · 5 trazos  142.274 car (~139 KB)  ← peor caso medido
 *
 * Y el servidor ya rechaza por encima de 500.000 caracteres (`FIRMA_MAX_CHARS`, ~488 KB), así que
 * ése es el techo absoluto por firma.
 *
 * **50 firmas** es el tope. Con el peor caso medido son ~7 MB; con el techo del servidor, ~24 MB.
 * Y 50 albaranes firmados sin subir es una cola enorme —meses de trabajo sin cobertura—: si se
 * llega ahí, el problema no es el espacio, es que el drenado lleva sin funcionar mucho tiempo.
 * El número viene de la entrada del 11-ago de SCRUM-358, que ya lo proponía.
 */
const TOPE_FIRMAS_EN_COLA = 50;

/** Lo que se reserva libre además de la firma: tres veces el peor caso medido. */
const MARGEN_BYTES = 3 * 142274;

const HAY_ESPACIO = 'HAY_ESPACIO';
const SIN_ESPACIO = 'SIN_ESPACIO';

/**
 * ¿Cabe otra firma?
 *
 * 🔴 EL SUELO: si `estimate()` no contesta, **NO se afirma que hay sitio**. Devuelve `NO_SE_SABE`,
 * que es un tercer valor y no un `HAY_ESPACIO` disfrazado.
 *
 * ⚠️ QUÉ SE HACE CON `NO_SE_SABE` — y es una decisión, no un descuido: **se intenta encolar
 * igual**. Bloquear la firma porque no hemos podido medir el disco dejaría sin cola a cualquier
 * navegador sin `estimate()`, para protegerlo de un caso que puede no darse; y la protección de
 * verdad ya existe un piso más abajo — `guardarFirmaPendiente` devuelve `FALLO` si la escritura no
 * confirma (SCRUM-455), así que una cuota agotada **no pasa por buena**. Lo que este suelo impide
 * es lo otro: **decir que hay sitio sin haberlo mirado**.
 */
async function hayEspacioParaOtraFirma(firmasEnCola, tamanoAproximado) {
  if (Number.isFinite(firmasEnCola) && firmasEnCola >= TOPE_FIRMAS_EN_COLA) {
    return { estado: SIN_ESPACIO, motivo: `la cola ha llegado al tope de ${TOPE_FIRMAS_EN_COLA} firmas` };
  }
  let libre = null;
  try {
    const s = navigator.storage;
    if (s && typeof s.estimate === 'function') {
      const e = await s.estimate();
      if (e && Number.isFinite(e.quota) && Number.isFinite(e.usage)) libre = e.quota - e.usage;
    }
  } catch (_e) { libre = null; }

  if (libre === null) return { estado: NO_SE_SABE, motivo: 'el navegador no dice cuánto espacio queda' };

  const necesario = (Number.isFinite(tamanoAproximado) ? tamanoAproximado : 142274) + MARGEN_BYTES;
  return libre >= necesario
    ? { estado: HAY_ESPACIO, motivo: `quedan ${libre} bytes` }
    : { estado: SIN_ESPACIO, motivo: `quedan ${libre} bytes y hacen falta ${necesario}` };
}

// ── LOS DOS TEXTOS QUE HARÁN FALTA, Y POR QUÉ NO ESTÁN AQUÍ ────────────────────────────────
//
// 🔴 NO HAY NINGÚN TEXTO EN ESTE FICHERO, y es deliberado. Esta fase **mide y devuelve**: no pinta
// nada. Harán falta dos microcopys —«no cabe otra firma» y «puede haberse perdido algo»— y las dos
// están SIN APROBAR (regla 30), así que se proponen en `docs/master/SCRUM-360.md` y se escribirán
// aquí el día que el asesor las fije.
//
// La primera versión de esta fase las dejó como constantes con marcador `[PENDIENTE …]`, y el
// trinquete de SCRUM-402 lo puso en rojo con el argumento correcto: *«si el texto no está aprobado,
// esa superficie no se pinta todavía»*. Un marcador entra en el árbol cuando hay una pantalla que
// necesita decir algo YA; aquí no la hay, así que era microcopy sin aprobar puesta para nada.
//
// El segundo es el texto más difícil del producto: hay que decirle a un profesional que puede haber
// perdido trabajo **sin saber exactamente qué**. Lo aprueba el asesor con el fundador delante.

/**
 * Lo que corre al abrir la aplicación: pedir persistencia y mirar si algo se ha perdido.
 *
 * No lanza nunca —esto informa, no bloquea el arranque— y devuelve lo medido para que se pueda
 * ejercitar y para que H2 lo consuma cuando tenga superficie.
 *
 * ⚠️ NO PINTA NADA todavía, y es a propósito: los dos textos que harían falta están SIN APROBAR
 * (regla 30). El de «se ha perdido algo» es el más difícil del producto —hay que decirle a un
 * profesional que puede haber perdido trabajo sin saber exactamente qué— y lo aprueba el asesor con
 * el fundador delante. Hasta entonces el hecho se mide y se devuelve; lo que no se hace es
 * inventarse las palabras.
 */
async function resistenciaAlArrancar(opciones) {
  const persistencia = await pedirPersistencia();
  const desalojo = await detectarDesalojo(opciones && opciones.leerCola);
  return { persistencia, desalojo };
}

// Frontend vanilla, sin bundler: se publica en `window` como el resto del dashboard.
window.resistenciaAlArrancar = resistenciaAlArrancar;
window.PERSISTENTE = PERSISTENTE;
window.NO_PERSISTENTE = NO_PERSISTENTE;
window.ALMACEN_NO_SE_SABE = NO_SE_SABE;
window.SIN_PERDIDA = SIN_PERDIDA;
window.POSIBLE_PERDIDA = POSIBLE_PERDIDA;
window.HAY_ESPACIO = HAY_ESPACIO;
window.SIN_ESPACIO = SIN_ESPACIO;
window.TOPE_FIRMAS_EN_COLA = TOPE_FIRMAS_EN_COLA;
window.MARCA_HUBO_COLA = MARCA_HUBO_COLA;
window.pedirPersistencia = pedirPersistencia;
window.estadoDePersistencia = estadoDePersistencia;
window.marcarQueHuboCola = marcarQueHuboCola;
window.huboColaAlgunaVez = huboColaAlgunaVez;
window.olvidarQueHuboCola = olvidarQueHuboCola;
window.detectarDesalojo = detectarDesalojo;
window.hayEspacioParaOtraFirma = hayEspacioParaOtraFirma;
