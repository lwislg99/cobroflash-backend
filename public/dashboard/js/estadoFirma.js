// public/dashboard/js/estadoFirma.js — SCRUM-356 (H2)
//
// LOS TRES SIGNIFICADOS DE «GUARDADO».
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA
//
// Una firma que el profesional CREE guardada y no lo está es PEOR que no poder firmar, porque se
// va de la obra tranquilo. Si no puede firmar lo sabe y busca salida: hace una foto, apunta el
// nombre, sube a la calle. Si cree que firmó, no hace nada — y se entera tres semanas después
// discutiendo con el cliente.
//
// Un producto que dice «✓ Guardado» a secas está afirmando ③ teniendo sólo ①.
//
//   ① GUARDADA EN ESTE MÓVIL     el trazo existe, aquí, y nada más
//   ② ENVIADA                     salió del móvil
//   ③ CONFIRMADA POR EL SERVIDOR  está a salvo aunque pierdas el teléfono
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA ASIMETRÍA DE COSTE, QUE ES LA REGLA DE LA QUE SALE TODO LO DEMÁS
//
// Ante la duda sobre si algo subió, SE DICE QUE NO SUBIÓ. Un falso «pendiente» cuesta una
// comprobación; un falso «a salvo» cuesta el albarán. Por eso ③ se afirma SÓLO con una señal
// positiva del servidor, y CUALQUIER otra cosa —un error, una excepción, una respuesta rara, no
// saber— cae a ①. No hay estado «probablemente sí».
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 `navigator.onLine` NO DECLARA ②, Y NO ES UNA OPINIÓN
//
// Una LAN sin salida cuenta como estar conectado. El caso real de este bloque es ése: wifi de
// obra, portal cautivo, 4G que abre el socket y muere. Un ② decidido por `onLine` es un falso
// «enviado», justo lo que la asimetría prohíbe.
//
// **② lo declara una RESPUESTA DEL SERVIDOR. Mientras no haya respuesta, es ①.** Hoy `onLine`
// tiene cero usos en el árbol (medido en SCRUM-356), así que aquí no hay nada que arreglar: hay
// que impedir que aparezca, y de eso se encarga el guard de `tests/scrum356-tres-estados.test.mjs`.

// ── Los tres estados ───────────────────────────────────────────────────────────────────────
const FIRMA_SOLO_EN_ESTE_MOVIL = 'FIRMA_SOLO_EN_ESTE_MOVIL';
const FIRMA_SUBIENDO = 'FIRMA_SUBIENDO';
const FIRMA_A_SALVO = 'FIRMA_A_SALVO';

/**
 * Microcopy APROBADA por el asesor (SCRUM-356). LITERAL — no se retoca, no se trunca, no se
 * compone con plantillas.
 *
 * Medida la caja antes de darla por buena, que es condición de la aprobación: el más largo son 78
 * caracteres y se pintan en `.alert` (13.5px, `line-height` 1.5) y `.status-pill`, ninguna de las
 * dos con `text-overflow`, `white-space: nowrap` ni `max-width`. Envuelven, no cortan.
 */
const TEXTO_FIRMA = Object.freeze({
  [FIRMA_SOLO_EN_ESTE_MOVIL]: Object.freeze({
    etiqueta: 'Solo en este móvil',
    detalle: 'La firma está guardada solo en este móvil. Si lo pierdes, se pierde.',
  }),
  // ② es transitorio y no lleva detalle: un texto explicativo que aparece y desaparece en un
  // segundo se lee a medias o no se lee.
  [FIRMA_SUBIENDO]: Object.freeze({ etiqueta: 'Subiendo…', detalle: null }),
  [FIRMA_A_SALVO]: Object.freeze({
    etiqueta: 'A salvo',
    detalle: 'Guardado en YaQu. Ya no depende de este móvil.',
  }),
});

const TEXTO_NO_SE_PUDO_COMPROBAR = 'No hemos podido comprobar si te queda algo por subir.';

/**
 * 🔴 EL AVISO DE QUE NO HAY VIGILANCIA AUTOMÁTICA.
 *
 * Decisión del fundador, tomada: en iOS no hay aviso automático — Background Sync es 0 % en Safari
 * (medido en H0) y push está descartado (regla 36). La cola sólo se mueve cuando el profesional
 * vuelve a abrir la aplicación.
 *
 * Y por eso el hueco se declara EN LA PANTALLA y no sólo en el registro: si el producto no avisa
 * solo y el pro cree que sí, hemos construido el fallo mudo que este ticket existe para evitar, un
 * piso más arriba. No se vende vigilancia que no existe.
 *
 * ⚠️ SE PINTA SIEMPRE QUE HAYA PENDIENTES, NO SÓLO EN iOS, y es deliberado: hoy **ningún**
 * navegador drena la cola solo, porque el drenado es de H3 y no está construido. Restringirlo a
 * iOS afirmaría que en Android sí se vigila, que es exactamente la promesa que no podemos
 * sostener. Además evita una segunda detección de plataforma — `isIOS` vive dentro de la IIFE de
 * `voiceInput.js` y no está publicada, y duplicarla es el defecto que cerraron SCRUM-360 y 447.
 */
// ✅ TEXTO APROBADO EN SCRUM-356, DE VUELTA — porque ya es verdad.
//
// Entre medias estuvo el provisional de la fase 2: «Las firmas pendientes no suben solas todavía:
// vuelve a firmar el albarán cuando tengas cobertura.» Fue necesario mientras la cola guardaba y
// nadie la vaciaba, porque este texto prometía algo que entonces no ocurría.
//
// **La fase 3 lo devuelve a la verdad:** `drenarAlAbrir` vacía la cola en cada arranque del
// dashboard (`app.js`, paso 9), que es exactamente lo que este texto dice. La reversión estaba
// escrita en `docs/master/SCRUM-356.md` y el guard provisional llevaba las instrucciones dentro de
// su mensaje de fallo; se ha retirado con la fase que lo hacía innecesario.
//
// ⚠️ Y la segunda frase también es cierta y sigue haciendo falta: si no la abre, se quedan aquí.
// No hay Background Sync en iOS ni push, así que el drenado no ocurre por su cuenta.
const TEXTO_SUBEN_AL_ABRIR = 'Las firmas pendientes suben cuando abres YaQu. Si no la abres, se quedan aquí.';

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-469 · EL AVISO DE DESALOJO — microcopy **APROBADA** por el asesor (regla 30).
//
// H5 (SCRUM-360, fase 3) lleva un sprint sabiendo que el navegador se ha llevado firmas sin
// subir: `detectarDesalojo` devuelve `POSIBLE_PERDIDA` cuando hubo cola **y** el almacén está
// vacío. Y no había ninguna superficie donde decirlo — `app.js` llamaba a
// `resistenciaAlArrancar()` y **tiraba el resultado**. El bloque H entero existe para que un
// fallo no sea MUDO, y éste lo era: el mecanismo sabía que se habían perdido firmas y el
// profesional no.
//
// 🔴 POR QUÉ EL TEXTO VIVE AQUÍ Y NO EN `resistenciaAlmacen.js`, QUE ES QUIEN LO MIDE.
// **H5 mide, H2 pinta**, y esa frontera no es una preferencia: la sostiene un guard ajeno.
// `tests/scrum360-desalojo.test.mjs` falla si `resistenciaAlmacen.js` publica un `window.TEXTO_*`
// —«si ha ganado una pantalla, la microcopy la aprueba el asesor y hay que decirlo aquí»—. Se
// CUMPLE en vez de relajarlo, y encima cae donde ya vive el resto de lo que el profesional lee
// sobre sus firmas. (⚠️ El comentario final de `resistenciaAlmacen.js` dice que estos textos «se
// escribirán aquí»; contradice a su propio guard y queda REPORTADO, no arreglado — regla 9.)
//
// 🔴 SON DOS CAMPOS Y NO UNA CADENA — y la razón MEDIDA no es la que se suponía.
//
// El encargo lo justificaba por la caja: «el original eran 148 caracteres en una frase y el aviso
// de pendientes ya ocupaba 4 líneas a 320 px con 97». **Medido en Edge, eso no se reproduce**
// (`npm run guard:caja-avisos`, 11-ago-2026):
//
//     ancho útil del `.alert`   338 px a 390 · 268 px a 320   (coincide con SCRUM-460)
//     este aviso, PARTIDO       3 líneas · 82,8 px   a 390 Y a 320
//     el MISMO texto SIN partir 3 líneas · 82,8 px   a 390 Y a 320   ← la partición no cambia nada
//     el vecino de pendientes   3 líneas (106 car), no 4
//
// O sea: a los dos anchos que soportamos **cabe igual partido que sin partir**, y nada se sale
// (`scrollWidth == innerWidth` a 390, 320 y hasta 240). Los dos campos se mantienen porque **así
// los aprobó el asesor** (regla 30, no se reescribe ni una palabra) y porque un título en
// `<strong>` se lee antes que un párrafo corrido — no porque sin ellos se desborde. Escribirlo al
// revés sería dejar en el árbol un número que nadie ha medido.
//
// ⚠️ Y el `<br>` no es gratis: por debajo de ~240 px el salto forzado cuesta una línea de más
// (5 frente a 4). Fuera de los anchos que soportamos, pero conviene saberlo antes de partir el
// siguiente aviso «porque cabe mejor».
const TEXTO_DESALOJO = Object.freeze({
  titulo: 'El móvil ha borrado firmas sin subir',
  cuerpo: 'Revisa tus albaranes: los que no salgan firmados hay que volver a firmarlos.',
});

/**
 * ⚠️ APROBADA Y **SIN CONSUMIDOR**, a propósito y declarado (SCRUM-469).
 *
 * Es el aviso de «no cabe otra firma», y NO SE PINTA todavía porque
 * `hayEspacioParaOtraFirma` (SCRUM-360) **no está cableada al encolado**: nadie consulta el tope
 * antes de guardar una firma. Pintar este texto hoy sería anunciar un rechazo que no ocurre; y
 * rechazar la firma sin poder decir por qué sería peor todavía.
 *
 * Vive aquí, en la fuente única, para que el ticket que cablee el tope no tenga que volver a
 * pasar por el asesor. `tests/scrum469-aviso-desalojo.test.mjs` vigila el hueco: exige que el
 * texto siga existiendo Y que siga sin consumidor, de modo que el día que se cablee haya que
 * venir a retirar la aserción — una declaración que nadie tiene que retirar no es un hueco, es
 * una promesa.
 */
const TEXTO_SIN_ESPACIO_PARA_FIRMA = 'No cabe otra firma en este móvil. Conéctate para subir las '
  + 'que tienes pendientes.';

/**
 * ¿Esta respuesta es una CONFIRMACIÓN del servidor?
 *
 * `apiRequest` ya comprueba `res.ok` y termina en `res.json()` (`api.js`), así que el HTML de un
 * portal cautivo revienta el parseo y sale por su `catch` — medido en SCRUM-356 §3. Que haya
 * resuelto es, por tanto, la señal.
 *
 * 🔴 Y AUN ASÍ SE MIRA EL CUERPO. No es desconfianza del compañero: es la asimetría de coste. Si
 * alguien cambia `apiRequest` para devolver texto —o se llama a esta función desde un `fetch`
 * directo, que es como `exportView.js` acabó descargando la página de login del router en un ZIP—
 * una cadena que empieza por `<` NO puede pasar por confirmación. Cuesta dos líneas y lo que
 * protege es un albarán.
 */
function confirmaElServidor(respuesta) {
  if (respuesta === null || respuesta === undefined) return false;
  if (typeof respuesta === 'string') {
    // Un portal cautivo devuelve su pantalla de acceso con 200. Eso no es una confirmación.
    return !/^\s*<|<!doctype|<html/i.test(respuesta);
  }
  return true;
}

/**
 * El estado de UNA firma a partir de hechos, no de conjeturas.
 *
 * @param hechos.confirmadaPorElServidor  hay respuesta del servidor y confirma
 * @param hechos.subiendo                 hay una petición EN VUELO ahora mismo
 */
function estadoDeLaFirma(hechos = {}) {
  // ③ primero y con `=== true`: un valor «casi verdadero» —una cadena, un 1, un objeto— no basta
  // para afirmar que el albarán está a salvo.
  if (hechos.confirmadaPorElServidor === true) return FIRMA_A_SALVO;
  if (hechos.subiendo === true) return FIRMA_SUBIENDO;
  // Y todo lo demás, incluida la duda, es ①. Aquí es donde vive la asimetría de coste.
  return FIRMA_SOLO_EN_ESTE_MOVIL;
}

/**
 * Ejecuta el intento de subida y devuelve el estado que RESULTA de él.
 *
 * Que el intento lance, que devuelva algo que no es una confirmación, o que no devuelva nada:
 * los tres caen a ①. No hay rama que suba a ③ sin haber pasado por `confirmaElServidor`.
 */
async function estadoTrasIntentarSubir(intento) {
  try {
    const respuesta = await intento();
    return estadoDeLaFirma({ confirmadaPorElServidor: confirmaElServidor(respuesta) });
  } catch (_e) {
    return FIRMA_SOLO_EN_ESTE_MOVIL;
  }
}

/**
 * El texto del contador. Singular y plural, los dos.
 *
 * 🔴 EL NÚMERO CUENTA FIRMAS EN LA COLA — una por albarán firmado y no confirmado. No suma nada
 * más. (En SCRUM-423 se llegó a aprobar «N líneas» sobre un campo que sumaba CANTIDADES: habría
 * pintado «2,5 líneas».)
 */
function textoDelContador(n) {
  if (n === 1) return 'Te queda 1 firma por subir';
  return `Te quedan ${n} firmas por subir`;
}

/**
 * 🔴 EL SUELO: «nada pendiente» y «no supe mirar» son la misma pantalla y significan lo contrario.
 *
 * Si no se consigue leer la cola, NO se dice «0 pendientes»: se dice que no se sabe, con un texto
 * DISTINTO. Un cero tranquiliza; y aquí tranquilizar sin haber podido mirar le está diciendo al
 * profesional que está todo a salvo.
 *
 * Devuelve `{ sabemos, n, texto }`. Con `sabemos: true` y `n === 0` el texto es `null`: no hay
 * microcopy aprobada para «no queda nada», y no se inventa (regla 30). No pintar nada cuando no
 * hay nada pendiente es además lo correcto.
 */
async function pendientesDeSubir(leerCola) {
  const leer = leerCola || (typeof window !== 'undefined' && window.leerFirmasPendientes);
  if (typeof leer !== 'function') {
    return { sabemos: false, n: null, texto: TEXTO_NO_SE_PUDO_COMPROBAR };
  }
  let r;
  try {
    r = await leer();
  } catch (_e) {
    return { sabemos: false, n: null, texto: TEXTO_NO_SE_PUDO_COMPROBAR };
  }
  const ok = typeof window !== 'undefined' ? window.GUARDADO : 'GUARDADO';
  if (!r || r.estado !== ok || !Array.isArray(r.firmas)) {
    return { sabemos: false, n: null, texto: TEXTO_NO_SE_PUDO_COMPROBAR };
  }
  const n = r.firmas.length;
  return { sabemos: true, n, texto: n === 0 ? null : textoDelContador(n) };
}

/**
 * ¿Hay en la cola una firma de ESTE albarán?
 *
 * ⚠️ ACUERDO MÍNIMO CON H3, y se declara aquí para que se cambie en UN sitio. SCRUM-455 dejó
 * escrito que «qué campos lleva una firma en cola lo decide H3»; lo único que H2 necesita saber es
 * a qué albarán pertenece, y `albaranId` es el identificador de la API, que no se traduce. Si H3
 * lo llama de otra forma, se toca esta función y nada más.
 *
 * PURA sobre sus argumentos: hoy la cola siempre está vacía —no tiene productor— y una lista vacía
 * hace verdad cualquier «no hay ninguna», así que el control positivo se ejercita con corpus.
 */
function hayFirmaEnColaDe(albaranId, firmas) {
  if (!Array.isArray(firmas)) return false;
  return firmas.some((f) => f && String(f.albaranId) === String(albaranId));
}

/**
 * El estado de la firma de un albarán, combinando lo que dice el servidor con lo que hay en la cola.
 *
 * `firmadoSegunElServidor` viene de la API: si el albarán llega con estado «firmado», el servidor
 * lo tiene. Eso es ③ — señal positiva, no conjetura.
 *
 * 🔴 La cola sólo puede DEGRADAR, nunca ascender: si hay una firma pendiente de este albarán se
 * baja a ①, aunque la API diga que está firmado. Es la asimetría otra vez — entre «el servidor lo
 * tiene» y «este móvil cree que aún debe subirlo», gana la lectura que no promete nada.
 */
function estadoDeLaFirmaDelAlbaran(albaranId, firmadoSegunElServidor, firmasEnCola) {
  if (hayFirmaEnColaDe(albaranId, firmasEnCola)) return FIRMA_SOLO_EN_ESTE_MOVIL;
  return estadoDeLaFirma({ confirmadaPorElServidor: firmadoSegunElServidor === true });
}

// ── El pintado ─────────────────────────────────────────────────────────────────────────────

function escapar(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * La píldora de estado de una firma, con su detalle debajo.
 *
 * Reutiliza `.status-pill` del inventario AB3 —no se inventa componente— con las variantes que ya
 * existen: `pending` (ámbar) para ① y ②, `accepted` (verde) para ③.
 *
 * 🔴 EL TEXTO VA SIEMPRE. El color NO es el único canal: un tic verde a secas es «guardado a
 * secas» dibujado, y afirma ③ sin decir dónde está la firma. Lo vigila un guard.
 */
function pintarEstadoDeFirma(estado) {
  const t = TEXTO_FIRMA[estado];
  if (!t) return '';
  const variante = estado === FIRMA_A_SALVO ? 'accepted' : 'pending';
  return `<span class="status-pill status-pill-${variante}">${escapar(t.etiqueta)}</span>` +
    (t.detalle ? `<p class="muted" style="margin:6px 0 0">${escapar(t.detalle)}</p>` : '');
}

/**
 * El aviso de firmas pendientes: el contador, y la declaración de que nadie las sube solo.
 *
 * Devuelve cadena vacía cuando se sabe que no queda nada — sin pendientes no hay nada que decir, y
 * un aviso permanente que dice «todo bien» acaba siendo invisible el día que diga otra cosa.
 */
function pintarPendientesDeSubir(resultado) {
  if (!resultado) return '';
  if (resultado.sabemos && resultado.n === 0) return '';
  // Sin saber, es `warning` igual que con pendientes: no saber NO es una buena noticia.
  const cuerpo = resultado.sabemos
    ? `<strong>${escapar(resultado.texto)}</strong><br>${escapar(TEXTO_SUBEN_AL_ABRIR)}`
    : escapar(resultado.texto);
  return `<div class="alert warning" role="status">${cuerpo}</div>`;
}

/**
 * SCRUM-469 · El aviso de desalojo. Cadena vacía en todo lo que no sea `POSIBLE_PERDIDA`.
 *
 * 🔴 EL CONTROL QUE DECIDE SI ESTO SIRVE ES EL NEGATIVO, no el positivo: **un profesional recién
 * instalado NO VE NADA**. Su almacén también está vacío, y decirle que ha perdido trabajo el día
 * que se registra es la forma más rápida de enseñarle a ignorar el aviso — y entonces no avisa el
 * día que sí. Quien los separa es `detectarDesalojo` con la marca `yaqu_hubo_cola`: quien nunca
 * encoló no la tiene. Aquí se respeta ese veredicto **sin ampliarlo**.
 *
 * 🔴 Y `NO_SE_SABE` NO PINTA ESTE AVISO. No haber podido leer la cola no es haber perdido nada;
 * convertir un fallo de lectura en «el móvil ha borrado firmas» es una acusación falsa. «Vacía» y
 * «no supe mirarla» son el mismo cero con significados opuestos, y esto sale del lado prudente.
 *
 * ⚠️ ACEPTA LA MEDIDA ENTERA O SU VEREDICTO. `resistenciaAlArrancar` devuelve
 * `{persistencia, desalojo}`, y pasar ese objeto por descuido devolvería `''` — o sea SILENCIO,
 * que es exactamente el fallo que este ticket cierra. Se admiten los dos en vez de fallar callando.
 */
function pintarDesalojo(medida) {
  const v = (medida && medida.desalojo) ? medida.desalojo : medida;
  const perdida = (typeof window !== 'undefined' && window.POSIBLE_PERDIDA) || 'POSIBLE_PERDIDA';
  if (!v || v.estado !== perdida) return '';
  // `error` y no `warning`: el vecino ámbar dice «te queda trabajo por subir» y esto dice «ese
  // trabajo YA NO ESTÁ». Y `role="alert"` en vez de `status` por lo mismo — no es un contador que
  // se actualiza, es una pérdida consumada que hay que leer ahora.
  return '<div class="alert error" role="alert">'
    + `<strong>${escapar(TEXTO_DESALOJO.titulo)}</strong><br>${escapar(TEXTO_DESALOJO.cuerpo)}</div>`;
}

// Frontend vanilla, sin bundler: se publica en `window` como el resto del dashboard.
window.FIRMA_SOLO_EN_ESTE_MOVIL = FIRMA_SOLO_EN_ESTE_MOVIL;
window.FIRMA_SUBIENDO = FIRMA_SUBIENDO;
window.FIRMA_A_SALVO = FIRMA_A_SALVO;
window.TEXTO_FIRMA = TEXTO_FIRMA;
window.TEXTO_NO_SE_PUDO_COMPROBAR = TEXTO_NO_SE_PUDO_COMPROBAR;
window.TEXTO_SUBEN_AL_ABRIR = TEXTO_SUBEN_AL_ABRIR;
window.TEXTO_DESALOJO = TEXTO_DESALOJO;
window.TEXTO_SIN_ESPACIO_PARA_FIRMA = TEXTO_SIN_ESPACIO_PARA_FIRMA;
window.pintarDesalojo = pintarDesalojo;
window.confirmaElServidor = confirmaElServidor;
window.estadoDeLaFirma = estadoDeLaFirma;
window.estadoTrasIntentarSubir = estadoTrasIntentarSubir;
window.textoDelContador = textoDelContador;
window.pendientesDeSubir = pendientesDeSubir;
window.pintarEstadoDeFirma = pintarEstadoDeFirma;
window.pintarPendientesDeSubir = pintarPendientesDeSubir;
window.hayFirmaEnColaDe = hayFirmaEnColaDe;
window.estadoDeLaFirmaDelAlbaran = estadoDeLaFirmaDelAlbaran;
