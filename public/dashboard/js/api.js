// public/dashboard/js/api.js

// Si el backend sirve el dashboard desde el mismo dominio, base = "".
const API_BASE_URL = ""; // mismo origin (http://localhost:3000)

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-451 · EL PLAZO DE RED VIVE AQUÍ, Y CORTA
//
// LA VÍCTIMA: un profesional con mala cobertura abre una pantalla, la petición se queda en el
// aire, y la pantalla espera PARA SIEMPRE. Ni datos, ni error, ni nada. En SCRUM-448 se midió que
// de 10 vistas que el banco pinta con la petición colgada, **nueve se quedan mudas**.
//
// SCRUM-448 puso el primer plazo de la casa DENTRO de una vista, y dejó dicho que ése era el
// momento de decidir: o baja a un sitio común, o las otras nueve crecen cada una el suyo. Baja.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL PLAZO ES **SOLO PARA GET**, Y ESO NO ES PEREZA: ESTÁ MEDIDO
//
// Censo por AST sobre `public/` entero (136 llamadas a `apiRequest`, 31 ficheros):
//   · **58 GET «pelados»** —sin opciones, o solo `method:'GET'`—. Cero GET con `headers` o `body`,
//     así que dos peticiones a la misma ruta son LA MISMA petición, sin ambigüedad.
//   · **78 MUTACIONES** (POST 56 · PATCH 10 · PUT 8 · DELETE 4).
//   · Las 4 descargas pesadas (ZIP de portabilidad, XML VeriFactu) NO pasan por aquí: van por
//     `descargarBinario`, con su propio `fetch`. **No les toca este plazo**, y no se les pone uno
//     a ojo: un ZIP de evidencias y un listado de cobros no aguantan lo mismo.
//
// Abortar un GET no cuesta nada: es idempotente y se vuelve a pedir. **Abortar una MUTACIÓN es
// otra cosa**: el servidor ha podido procesarla ya, el profesional ve un error, lo repite, y sale
// una segunda factura. Eso es dinero y es el camino de emisión, así que no se decide aquí.
// Queda PARADO y propuesto al fundador. Las 78 mutaciones siguen exactamente como estaban.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL NÚMERO: 10 s, el mismo que ya decidió el fundador en SCRUM-448, y por lo mismo. No hay p95
// de estas rutas en producción y no se inventa; es el umbral clásico a partir del cual una
// persona deja de creer que el sistema trabaja y empieza a creer que está roto. Referencia
// general, no dato nuestro. **Un sitio, una constante**: `cobrosView` ya no tiene el suyo.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** El plazo, en milisegundos. `var` a propósito: así un test puede acortarlo desde `window`. */
var PLAZO_RED_MS = (typeof window !== 'undefined' && window.PLAZO_RED_MS) || 10000;

/**
 * 🔴 QUÉ RESPUESTA MANDA: la de la ÚLTIMA petición lanzada para esa ruta, y solo ésa.
 *
 * Abortar NO quita la necesidad de esto: el aborto no es instantáneo, y una respuesta que ya venía
 * de camino puede llegar DESPUÉS de otra más nueva y pintar encima una lista más vieja, sin que
 * nada lo diga. Es el defecto que nadie ve hasta que muerde.
 *
 * ⚠️ Y NO SE DESCARTA LA VIEJA EN SILENCIO, que era lo primero que pensé: está medido que **22
 * rutas se piden desde más de un sitio** —`/admin/jobs/{}` desde 7, `/admin/merchant` desde 6,
 * `/admin/metrics/home` desde 2 en la MISMA vista—. Descartar dejaría a un llamador legítimo sin
 * su respuesta para siempre, y eso es una avería nueva, no un arreglo. Lo que se hace es
 * **compartir**: al que se quedó atrás se le entrega el resultado de la MÁS NUEVA. Nadie se queda
 * sin respuesta y nadie pinta datos viejos.
 */
const _secuenciaPorRuta = Object.create(null);
const _ultimaPorRuta = Object.create(null);

/** Marca el error de un plazo vencido con la MISMA señal que un fallo de red (SCRUM-404). */
function errorDeRedVencido(causa) {
  // No se inventa microcopy: se marca. `sinRed` porque para el profesional es el mismo hecho
  // —no hay cobertura— y las vistas que ya se bifurcan por esa marca siguen valiendo.
  const e = new Error('la petición ha superado el plazo de red');
  e.sinRed = true;
  e.vencido = true;
  e.causaOriginal = causa;
  return e;
}

/** Una petición, de principio a fin. El plazo cubre TAMBIÉN la descarga del cuerpo. */
async function _enviar(url, finalOptions, ctrl) {
  const opciones = ctrl ? { ...finalOptions, signal: ctrl.signal } : finalOptions;
  // 🔴 El plazo se limpia en el `finally`, no al resolver el `fetch`: `fetch` vuelve con las
  // CABECERAS, y el cuerpo se sigue bajando después. Cortar solo la cabecera dejaría vivo justo lo
  // que gasta los datos del profesional.
  const plazo = ctrl ? setTimeout(() => ctrl.abort(), PLAZO_RED_MS) : null;
  try {
    return await _pedir(url, opciones);
  } catch (e) {
    if (ctrl && ctrl.signal && ctrl.signal.aborted) throw errorDeRedVencido(e);
    throw e;
  } finally {
    if (plazo) clearTimeout(plazo);
  }
}

async function apiRequest(path, options = {}) {
  const url = API_BASE_URL + path;

  const finalOptions = {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  };

  const metodo = String(finalOptions.method || 'GET').toUpperCase();
  // Mutación: camino de siempre, sin plazo y sin secuencia. Ver el bloque de arriba.
  if (metodo !== 'GET' || finalOptions.body) return _pedir(url, finalOptions);

  let mia = (_secuenciaPorRuta[path] = (_secuenciaPorRuta[path] || 0) + 1);
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const promesa = _enviar(url, finalOptions, ctrl);
  _ultimaPorRuta[path] = promesa;

  let resultado; let fallo = null;
  try { resultado = await promesa; } catch (e) { fallo = e; }

  // Si mientras tanto salió otra para esta misma ruta, la que manda es la suya — y se espera, para
  // que quien preguntó primero también reciba lo último. El bucle cubre el caso de que la más
  // nueva quede a su vez superada mientras se la espera.
  while (_secuenciaPorRuta[path] !== mia) {
    mia = _secuenciaPorRuta[path];
    try { resultado = await _ultimaPorRuta[path]; fallo = null; }
    catch (e) { fallo = e; resultado = undefined; }
  }

  if (fallo) throw fallo;
  return resultado;
}

async function _pedir(url, finalOptions) {
  // SCRUM-404 · UN FALLO DE RED Y UN RECHAZO DEL SERVIDOR PIDEN COSAS DISTINTAS AL PROFESIONAL:
  // esperar a tener cobertura, o llamar por teléfono. Sin envolver el `fetch` los dos llegaban
  // igual —un `TypeError: Failed to fetch`, en inglés— y quien mostrara el error no podía
  // distinguirlos.
  //
  // Se MARCA `sinRed` y NO se toca el `message`: los demás llamadores siguen viendo exactamente
  // lo que veían. Quien quiera distinguir, mira la marca.
  let res;
  try {
    res = await fetch(url, finalOptions);
  } catch (errRed) {
    const e = new Error(errRed && errRed.message ? errRed.message : 'fallo de red');
    e.sinRed = true;
    e.causaOriginal = errRed;
    throw e;
  }

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* respuesta no JSON */ }

    // Prueba caducada: en vez de un error feo, llevamos al usuario a Planes
    // (cerrando cualquier modal abierto) para que pueda suscribirse.
    if (res.status === 403 && data && data.error === 'trial_expired') {
      document.querySelectorAll('.modal-overlay').forEach((m) => m.remove());
      const nav = document.querySelector('.nav-item[data-view="plans"]');
      if (nav) nav.click();
      else window.location.hash = '#plans';
      const e = new Error('Tu prueba ha terminado. Elige un plan para continuar.');
      e.status = 403; e.data = data; e.handled = true;
      throw e;
    }

    // SCRUM-151: el MENSAJE HUMANO gana al código técnico. Esto componía siempre
    // `API 409: no_more_invoices_for_payment_terms` y muchas vistas lo enseñan tal cual, así que
    // CUALQUIER endpoint sin `message` acababa mostrándole al usuario un identificador interno.
    // Arreglarlo aquí lo arregla también para todo lo que venga después. El código sigue
    // disponible en `err.code` y en `err.data` para quien decida POR código (que es lo correcto:
    // ramificar por texto es lo que nunca hay que hacer).
    const err = new Error(data?.message || `API ${res.status}: ${data?.error || res.statusText}`);
    err.status = res.status;
    err.code   = data?.error || null;
    err.data   = data;
    throw err;
  }

  if (res.status === 204) return null;
  // 🔴 `await`, no `return` a secas: quien llama a `_pedir` limpia el plazo en su `finally`, y con
  // un `return` sin esperar ese `finally` corre ANTES de que el cuerpo se haya bajado. El plazo
  // moriría justo antes de la parte que de verdad gasta los datos del profesional.
  return await res.json();
}

// -------- SCRUM-405 · LA ÚNICA FORMA DE DESCARGAR UN FICHERO --------
//
// EL DEFECTO QUE CIERRA: tres descargas comprobaban `res.ok` y llamaban a `res.blob()` sin mirar
// NADA más. Un portal cautivo —la wifi de cortesía de una obra, la del bar de al lado— responde
// **200 con el HTML de su página de login**. `res.ok` es `true`, el blob se guarda, y el
// profesional se lleva a casa un `yaqu-datos-2026-08-07.zip` que por dentro es la pantalla de
// acceso de un router. Se entera el día que se lo abre su asesor.
//
// 🔴 Y LO QUE DE VERDAD ARREGLA ESTE BLOQUE NO SON LOS TRES SITIOS: ES QUITAR LA FORMA DE EN MEDIO.
// Los tres eran el mismo código copiado, y el tercero se escribió en SCRUM-325 imitando a los dos
// anteriores. Mientras la forma siga siendo copiable, el cuarto nace mal. Por eso existe esta
// función y por eso hay un guard (`tests/scrum405-descarga-verificada.test.mjs`) que pone en rojo
// cualquier `.blob()` que no pase por aquí, NOMBRANDO fichero y línea.
//
// ⚠️ HASTA DÓNDE LLEGA LA COMPROBACIÓN — y no llega más lejos:
//
//   · **Detectar un portal cautivo CON CERTEZA no se puede desde el navegador**, y esto no lo
//     intenta. Un portal que devolviera `200` con `Content-Type: application/zip` y basura dentro
//     pasaría esta comprobación entera.
//   · Lo que sí se puede, y es lo que hace: **no entregar como fichero algo que evidentemente no
//     lo es.** Si la respuesta dice `text/html`, o dice un tipo que no es el que se pidió, no se
//     descarga nada.
//   · **NO se usa `navigator.onLine`.** Miente exactamente en este escenario —el móvil está
//     conectadísimo… al router del bar— y además hoy tiene CERO usos en el árbol (medido en
//     SCRUM-356). No se estrena aquí.
//
// SIN MICROCOPY: esta función lanza un error con CÓDIGO y **la vista decide el texto**. Ramificar
// por código y no por texto es la regla de SCRUM-151, y además impide que un helper compartido se
// convierta en dueño de microcopy que aprueba el fundador (regla 30).

/** El código del error cuando la respuesta no es el fichero que decía ser. */
const ERROR_NO_ES_FICHERO = 'respuesta_no_es_fichero';

// SCRUM-405 · el mensaje de «esto no es tu fichero». **MICROCOPY APROBADA** por el asesor el
// 10-ago-2026 (regla 30). Reformular estos dos textos es cambio de máster, no edición.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// SON DOS CAUSAS DISTINTAS, Y HASTA HOY PINTABAN EL MISMO TEXTO
//
// La condición que las dispara es `esHtml || !cuadra`. Cuando la causa era la segunda, el mensaje
// del portal cautivo **mentía**: culpaba a la wifi de la obra y mandaba al profesional a gastar
// datos móviles para arreglar algo que no estaba en su red.

/**
 * CASO A · la respuesta es una PÁGINA: wifi de obra o de bar que intercepta la descarga.
 *
 * ⚠️ CORTO A PROPÓSITO. La primera redacción aprobada tenía 157 caracteres —unos 9,5 s de
 * lectura— en un toast que se va a los 5 s: el profesional lo veía desaparecer justo antes de la
 * parte que dice QUÉ HACER. El asesor lo acortó al medirlo. Lo que se cayó es la explicación de
 * POR QUÉ, que en un toast no la lee nadie; lo que se conserva es qué ha pasado y qué puede hacer.
 */
const MSG_DESCARGA_PORTAL_CAUTIVO =
  'Esta red ha devuelto su pantalla de acceso en vez de tu archivo. '
  + 'Prueba con datos móviles u otra red.';

/**
 * CASO B · llegó algo que no es el tipo esperado y NO es una página.
 *
 * 🔴 La última frase es la que de verdad importa, y es justo la que faltaba: le impide gastar
 * datos, cambiar de sitio o culpar a la wifi de la obra. Y pone la culpa donde está. No promete
 * ningún canal de contacto a propósito — no se le da un sitio al que escribir sin haber
 * comprobado que existe.
 */
const MSG_DESCARGA_TIPO_INESPERADO =
  'Lo que ha llegado no es tu archivo. Vuelve a intentarlo; '
  + 'si sigue pasando no es tu conexión, es cosa nuestra.';

/**
 * Qué mensaje toca para un error de descarga.
 *
 * ⚠️ El CASO B es el POR DEFECTO, y no por comodidad: si no consta que la respuesta fuera una
 * página, no se puede afirmar que la culpa sea de la red. Equivocarse hacia «es cosa nuestra» le
 * cuesta al profesional un reintento; equivocarse hacia «es tu wifi» le cuesta datos, un viaje y
 * la sospecha de que su conexión está mal. La asimetría decide el defecto.
 */
function mensajeDescargaFallida(err) {
  return err && err.esHtml === true ? MSG_DESCARGA_PORTAL_CAUTIVO : MSG_DESCARGA_TIPO_INESPERADO;
}

/**
 * Descarga un binario y lo entrega al navegador. Lanza si algo no cuadra; NO pinta nada.
 *
 * @param {string} url
 * @param {{tipoEsperado: string, nombrePorDefecto: string}} opciones
 *        `tipoEsperado` es una subcadena del `Content-Type` (p. ej. `'zip'`, `'csv'`).
 * @returns {Promise<{nombre: string, res: Response}>} el nombre con el que se guardó y la
 *        respuesta, para que quien llama pueda leer sus cabeceras (`X-Yaqu-Filas`, etc.).
 */
async function descargarBinario(url, { tipoEsperado, nombrePorDefecto }) {
  const res = await fetch(url, { credentials: 'same-origin' });

  if (!res.ok) {
    // El error de estado se deja pasar TAL CUAL: cada pantalla lo trata a su manera (una lee el
    // JSON del cuerpo, otra solo avisa) y unificarlo aquí les quitaría información.
    const err = new Error(`descarga ${res.status}`);
    err.status = res.status;
    err.respuesta = res;
    throw err;
  }

  const tipo = (res.headers.get('content-type') || '').toLowerCase();
  const esHtml = tipo.includes('text/html');
  const cuadra = tipo.includes(String(tipoEsperado).toLowerCase());
  if (esHtml || !cuadra) {
    const err = new Error(`la respuesta no es un fichero (${tipo || 'sin Content-Type'})`);
    err.code = ERROR_NO_ES_FICHERO;
    err.tipoRecibido = tipo || null;
    err.tipoEsperado = tipoEsperado;
    // SCRUM-405 · CUÁL de las dos causas fue. `tipoRecibido` ya viajaba, pero nadie lo miraba y las
    // dos causas acababan pintando el mismo texto. Esto lo hace explícito para que la elección del
    // mensaje no dependa de volver a parsear el Content-Type en cada pantalla.
    err.esHtml = esHtml;
    throw err;
  }

  // El nombre lo decide el SERVIDOR: lleva la fecha o el periodo, y a veces una señal (el
  // `INCOMPLETO` del paquete de datos). Esa señal tiene que llegar al fichero guardado.
  const cd = res.headers.get('content-disposition') || '';
  const m = /filename="([^"]+)"/.exec(cd);
  const nombre = m ? m[1] : nombrePorDefecto;

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);

  return { nombre, res };
}

// -------- UI helpers compartidos (carga / error) --------

// Pinta un estado de error con botón de reintento dentro de `container`.
// onRetry se llama al pulsar "Reintentar". Reutilizable por cualquier vista.
function uiErrorState(container, message, onRetry) {
  if (!container) return;
  container.innerHTML = `
    <div class="state-error" role="alert" aria-live="assertive">
      <div class="state-error-ico" aria-hidden="true">⚠️</div>
      <div class="state-error-msg">${message || 'No pudimos cargar la información.'}</div>
      ${onRetry ? '<button type="button" class="state-error-retry">Reintentar</button>' : ''}
    </div>`;
  if (onRetry) {
    container.querySelector('.state-error-retry')?.addEventListener('click', onRetry);
  }
}
window.uiErrorState = uiErrorState;

// Marca un campo como inválido (origen del error) y lo enfoca. Limpia los
// previos dentro de `scope` para no acumular marcas.
function uiMarkFieldError(el, scope) {
  (scope || document).querySelectorAll('.input-error').forEach((n) => n.classList.remove('input-error'));
  if (!el) return;
  el.classList.add('input-error');
  el.focus?.();
  const clear = () => { el.classList.remove('input-error'); el.removeEventListener('input', clear); };
  el.addEventListener('input', clear);
}
window.uiMarkFieldError = uiMarkFieldError;

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-360 (H5 · fase 1) · ¿ESTÁ LA APLICACIÓN INSTALADA EN LA PANTALLA DE INICIO?
//
// No es una curiosidad: **es la mitigación entera de H5**. iOS borra el origen completo —service
// worker, caché e IndexedDB— cuando pasan 7 días sin abrir la aplicación, y con él se llevaría una
// firma pendiente de subir. **Las aplicaciones añadidas a la pantalla de inicio están EXENTAS de
// ese borrado; una pestaña normal, no.** Así que saber en cuál estamos es saber si hay riesgo.
//
// ⚠️ VIVE AQUÍ, Y NO EN UN FICHERO NUEVO, por dos motivos medidos: `api.js` es el PRIMER script del
// dashboard —así que la función existe antes que cualquier vista— y ya está en el precache del
// service worker (`sw.js:23`). Un fichero nuevo habría que meterlo en ese precache, y el service
// worker no se toca en esta fase.
//
// 🔴 TRES ESTADOS, NO DOS, y ésta es la decisión que sostiene el dato:
//
//   · `instalada`   — se pudo evaluar y la respuesta es sí;
//   · `pestana`     — se pudo evaluar y la respuesta es no;
//   · `desconocido` — **NO SE PUDO EVALUAR**.
//
// «No está instalada» y «no supe mirar» son lo CONTRARIO: el primero dice que hay riesgo, el
// segundo no dice nada. Colapsarlos en un booleano daría un recuento tranquilo y falso — parecería
// que sabemos que N están en pestaña cuando en realidad no pudimos preguntárselo a nadie.

/** Los tres estados posibles. Cerrado a propósito: quien lo lea no tiene que adivinar. */
var ENTORNO_INSTALADA = 'instalada';
var ENTORNO_PESTANA = 'pestana';
var ENTORNO_DESCONOCIDO = 'desconocido';

/**
 * En qué contexto se está ejecutando la aplicación.
 *
 * Dos vías, y las dos hacen falta: `display-mode: standalone` es el estándar, y
 * `navigator.standalone` es **la única que responde en Safari de iPhone** — que es el caso peor
 * del parque medido en H0 y justo el que sufre el borrado a los 7 días.
 */
function entornoDeLaApp() {
  var puedeMatchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  var tieneLegacy = typeof window !== 'undefined' && window.navigator
    && typeof window.navigator.standalone === 'boolean';

  // Si NINGUNA de las dos vías se puede consultar, no se contesta: se dice que no se sabe.
  if (!puedeMatchMedia && !tieneLegacy) return ENTORNO_DESCONOCIDO;

  if (puedeMatchMedia && window.matchMedia('(display-mode: standalone)').matches) return ENTORNO_INSTALADA;
  if (tieneLegacy && window.navigator.standalone === true) return ENTORNO_INSTALADA;
  return ENTORNO_PESTANA;
}
window.entornoDeLaApp = entornoDeLaApp;
window.ENTORNO_INSTALADA = ENTORNO_INSTALADA;
window.ENTORNO_PESTANA = ENTORNO_PESTANA;
window.ENTORNO_DESCONOCIDO = ENTORNO_DESCONOCIDO;

// P-A66-3: dinero SIEMPRE en formato español también dentro del BO — espejo
// del formatMoneyEs del servidor (core/utils). "2.383,70 €", nunca "2383.70 EUR".
function fmtMoneyEs(n, currency = 'EUR') {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  const opts = {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };
  // A18.2 (AB6 "9.999,99 €"): es-ES por defecto NO agrupa los miles de 4 cifras
  // (CLDR); useGrouping 'always' fuerza el punto SIEMPRE. Fallback en cascada.
  try {
    return new Intl.NumberFormat('es-ES', { ...opts, useGrouping: 'always' }).format(safe);
  } catch {
    try { return new Intl.NumberFormat('es-ES', opts).format(safe); }
    catch { return safe.toFixed(2) + ' ' + currency; }
  }
}
window.fmtMoneyEs = fmtMoneyEs;

/**
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * SCRUM-436 · EL MISMO IMPORTE, PERO DISTINGUIENDO EL AUSENTE DEL CERO
 *
 * `fmtMoneyEs` trata el dato ilegible o ausente como **0,00 €**, y para casi todas las pantallas
 * eso está bien: un total que aún no se ha calculado se enseña a cero y no pasa nada.
 *
 * En un **libro de registro** no: ahí `null` NO es cero — es «no hay dato», y se imprime y se
 * entrega. Decir «0,00 €» donde no se sabe nada es afirmar un importe que nadie ha calculado.
 *
 * Esta variante existe para eso y **NO reimplementa el formato**: delega en `fmtMoneyEs`, así que
 * el separador de miles, los decimales, la posición del símbolo y la moneda son los mismos POR
 * CONSTRUCCIÓN. Lo único que añade es la decisión sobre el ausente.
 *
 * @param {*} n         el importe
 * @param {string} [currency='EUR']
 * @param {string} [ausente='—']  qué se pinta cuando no hay dato
 */
function fmtMoneyEsOAusente(n, currency = 'EUR', ausente = '—') {
  if (n === null || n === undefined || n === '') return ausente;
  // Un texto que no es un número tampoco es un importe: `fmtMoneyEs` lo daría por 0,00 € y aquí
  // eso volvería a ser la afirmación que esta función existe para no hacer.
  if (!Number.isFinite(Number(n))) return ausente;
  return fmtMoneyEs(n, currency);
}
window.fmtMoneyEsOAusente = fmtMoneyEsOAusente;

// A6.2: toast compartido de TODO el BO (una sola voz para el feedback de acción).
// kind: 'ok' (verde marca) · 'warn' (ámbar) · 'error' (rojo). Sustituye a los
// alert() del navegador. Uno cada vez; aria-live para lectores de pantalla.
// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-443 · EL TOAST DE ERROR SE PUEDE LEER ENTERO, Y SE PUEDE QUITAR
//
// El defecto, medido: los errores duraban **5 s fijos** y el mensaje de error más largo del
// producto son **136 caracteres ≈ 7,5 s de lectura**. O sea que había errores que **se iban por la
// mitad**, y el profesional no podía ni recuperarlos ni pararlos: `showToast` no registraba ningún
// listener, no pintaba cierre y no tenía `cursor:pointer`.
//
// Se queda sabiendo que algo falló y sin saber qué.
//
// ⚠️ ESTO CAMBIA EL CONTENEDOR, JAMÁS EL CONTENIDO. Ni un texto se toca aquí.

/**
 * Cuánto tiempo tiene que estar un aviso en pantalla, DERIVADO DE SU LONGITUD.
 *
 * 🔴 EL NÚMERO NO SE ELIGE: SE CALCULA. Un «pongamos 10 segundos» vuelve a romperse el día que
 * alguien escriba un mensaje más largo — que es exactamente cómo hemos llegado hasta aquí, con un
 * 5 fijo puesto cuando los mensajes eran cortos.
 *
 * `MS_POR_CARACTER` sale de la velocidad de lectura habitual (~3,3 palabras/s a ~5,5 caracteres por
 * palabra ≈ 18 car/s ≈ 55 ms/car), redondeada al alza. `MS_BASE` es el tiempo de darse cuenta de
 * que ha aparecido algo antes de empezar a leerlo.
 *
 * El SUELO de 5 s es el valor que había: esto sólo puede alargar, nunca acortar.
 */
const TOAST_MS_BASE = 1500;
const TOAST_MS_POR_CARACTER = 60;
const TOAST_MS_MIN_ERROR = 5000;
const TOAST_MS_MAX = 15000;
/** Los avisos de ÉXITO no se tocan: un «guardado» quiere irse rápido y estorbar lo mínimo. */
const TOAST_MS_OK = 3000;

/**
 * `null` = **no se cierra solo**; se queda hasta que el profesional lo cierre.
 *
 * 🔴 Esto lo destapó el propio guard de este ticket, y merece explicarse porque el primer intento
 * estaba mal: yo había puesto un tope de 15 s, y con un mensaje de 300 caracteres —que necesita
 * ~16,7 s— el tope RECORTABA por debajo de lo legible. O sea que había reconstruido el defecto
 * original, más arriba: un mensaje que se va antes de poder leerse.
 *
 * Un tope hace falta —un aviso de 25 s tapando la pantalla es intrusivo—, pero la salida no era
 * subirlo hasta que cupiera el mensaje más largo imaginable. **Si un aviso no cabe en el tope, lo
 * que no puede hacer es irse solo.** Ahora que los errores llevan botón de cierre, quedarse es una
 * opción honesta: el profesional lo lee al ritmo que sea y lo quita cuando termina.
 */
function duracionToast(msg, kind) {
  if (kind !== 'error') return TOAST_MS_OK;
  const largo = String(msg == null ? '' : msg).length;
  const necesita = Math.max(TOAST_MS_MIN_ERROR, TOAST_MS_BASE + largo * TOAST_MS_POR_CARACTER);
  return necesita > TOAST_MS_MAX ? null : necesita;
}

/**
 * ¿Es un aviso de una sola línea?
 *
 * El `border-radius: 999px` está pensado para una línea: con tres, los extremos curvos se comen las
 * esquinas del texto. Por debajo de este largo cabe en una línea a 14px dentro del ancho máximo del
 * toast (480px, y 92vw en móvil); por encima, se usa un radio normal.
 */
const TOAST_LARGO_UNA_LINEA = 45;

/**
 * SCRUM-444 · CUÁNTOS AVISOS CABEN A LA VEZ.
 *
 * Con más de esto en pantalla ya no hay nada que leer, hay una pared. Al llegar el que sobra se
 * retira el MÁS ANTIGUO —el que más tiempo ha tenido para leerse—, y queda declarado como el
 * único caso en que este ticket sigue perdiendo un aviso.
 */
const TOAST_MAX_A_LA_VEZ = 4;

/** La pila donde viven. Se crea sola la primera vez que hace falta. */
function pilaDeToasts() {
  let pila = document.getElementById('yaqu-toasts');
  if (pila) return pila;
  pila = document.createElement('div');
  pila.id = 'yaqu-toasts';
  // Columna INVERSA: el más nuevo aparece abajo, junto al pulgar y donde estaba el toast único de
  // siempre. Los anteriores suben, así que nada salta de sitio bajo el dedo.
  pila.style.cssText = `
    position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
    z-index:400; display:flex; flex-direction:column-reverse; gap:8px;
    align-items:center; pointer-events:none;
  `;
  document.body.appendChild(pila);
  return pila;
}

function showToast(msg, kind = 'ok') {
  // Compat: llamadas antiguas showToast(msg, true) = warn
  if (kind === true) kind = 'warn';
  const pila = pilaDeToasts();

  // ── ① EL MISMO AVISO OTRA VEZ NO SE APILA: SE REFRESCA ──────────────────────────────────
  //
  // Medido: «No se pudieron guardar las notas» existe en DOS sitios (`jobsView` y `jobDetailView`)
  // y se dispara al perder el foco. Si el profesional corrige, vuelve a salir del campo y vuelve a
  // fallar, el mensaje es EL MISMO — y dos copias idénticas apiladas ocupan el doble sin decir
  // nada nuevo. Se reinicia el reloj del que ya está: sigue siendo verdad y vuelve a estar entero.
  const yaEsta = [...pila.children].find(
    (n) => n.dataset.kind === kind && n.dataset.msg === String(msg == null ? '' : msg),
  );
  if (yaEsta) {
    clearTimeout(Number(yaEsta.dataset.timer));
    programarCierre(yaEsta, msg, kind);
    return;
  }

  const colors = { ok: 'var(--brand, #16a34a)', warn: '#b45309', error: '#b91c1c' };
  const toast = document.createElement('div');
  toast.className = 'yaqu-toast';
  toast.dataset.kind = kind;
  toast.dataset.msg = String(msg == null ? '' : msg);
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
  const unaLinea = String(msg == null ? '' : msg).length <= TOAST_LARGO_UNA_LINEA;
  toast.style.cssText = `
    background:${colors[kind] || colors.ok}; color:#fff; max-width:min(92vw,480px);
    padding:10px 20px; border-radius:${unaLinea ? '999px' : '14px'}; font-size:14px; font-weight:600;
    box-shadow:0 4px 12px rgba(0,0,0,0.2); pointer-events:auto;
    display:flex; align-items:center; gap:12px; text-align:left;
  `;
  const texto = document.createElement('span');
  texto.textContent = msg;
  toast.appendChild(texto);

  // ── CERRARLO A MANO ─────────────────────────────────────────────────────────────────────
  //
  // Sólo en los errores: son los únicos que duran lo bastante como para estorbar, y los únicos
  // que alguien puede querer quitarse de encima antes de tiempo. Un «guardado» de 3 s con una
  // aspa al lado es ruido.
  //
  // ⚠️ SE REUTILIZA `.modal-close`, el patrón de cierre que YA existe en la casa (seis
  // componentes: modales de IA, importador CSV, clientes, gastos, inicio…). No se inventa un
  // segundo botón de cerrar con otra pinta y otro tamaño.
  if (kind === 'error') {
    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'modal-close';
    // `aria-label="Cerrar"` NO es microcopy nueva: es el literal que ya usan `invoiceDetailView`,
    // `jobDetailView` y `settingsView` con este mismo patrón. Reutilizar no es inventar (regla 30)
    // — y aquí un marcador sería peor que en ningún sitio: un lector de pantalla leería en voz
    // alta «PENDIENTE microcopy oficial» a alguien que sólo quiere cerrar un aviso.
    cerrar.setAttribute('aria-label', 'Cerrar');
    cerrar.innerHTML = '&times;';
    cerrar.style.cssText = 'flex:0 0 auto; width:24px; height:24px; font-size:16px; background:rgba(255,255,255,.22); color:#fff';
    cerrar.addEventListener('click', () => toast.remove());
    toast.appendChild(cerrar);
  }

  pila.appendChild(toast);

  // ── ② EL TOPE, Y EL ÚNICO AVISO QUE ESTE TICKET SIGUE PUDIENDO PERDER ───────────────────
  //
  // Se retira el MÁS ANTIGUO, que es el que más tiempo ha tenido para leerse. Con cuatro avisos
  // simultáneos ya no hay nada que leer: hay una pared tapando la pantalla.
  while (pila.children.length > TOAST_MAX_A_LA_VEZ) {
    clearTimeout(Number(pila.firstElementChild.dataset.timer));
    pila.firstElementChild.remove();
  }

  programarCierre(toast, msg, kind);
}

/**
 * Le pone (o le renueva) el reloj a un aviso.
 *
 * 🔴 Aparte para que **refrescar un aviso repetido sea exactamente lo mismo que estrenarlo**: si el
 * cierre se programara en dos sitios, el repetido acabaría con otra duración que el original y
 * nadie se enteraría. `null` = no se cierra solo (SCRUM-443); sólo pasa en errores, que llevan
 * botón — un aviso que no se va y no se puede quitar sería una trampa, no una mejora.
 */
function programarCierre(toast, msg, kind) {
  const ms = duracionToast(msg, kind);
  if (ms === null) { delete toast.dataset.timer; return; }
  toast.dataset.timer = String(setTimeout(() => toast.remove(), ms));
}

window.showToast = showToast;
window.duracionToast = duracionToast;

// Rellena un <tbody> con filas-esqueleto mientras carga una lista. Se sustituyen
// al pintar los datos (tbody.innerHTML = ''). cols = nº de columnas de la tabla.
function uiSkeletonRows(tbody, cols, rows = 6) {
  if (!tbody) return;
  let html = '';
  for (let r = 0; r < rows; r++) {
    let tds = '';
    for (let c = 0; c < cols; c++) {
      const w = 45 + ((r + c) % 4) * 14;   // anchos variados 45–87%
      tds += `<td><span class="skeleton" style="display:block;height:12px;width:${w}%"></span></td>`;
    }
    html += `<tr class="skeleton-row" aria-hidden="true">${tds}</tr>`;
  }
  tbody.innerHTML = html;
}
window.uiSkeletonRows = uiSkeletonRows;

// SCRUM-126: `sent` es la ÚNICA verdad sobre si una notificación (WhatsApp/email) salió,
// en los 9 endpoints de envío del dashboard — nunca `ok` (eso era el punto ciego: un 200
// se lee como éxito si nadie mira el cuerpo). Un solo sitio que lo sepa, para que ningún
// consumidor futuro vuelva a mirar el campo equivocado.
function waSendFailed(result) {
  return !!result && result.sent === false;
}
window.waSendFailed = waSendFailed;

// Mismo criterio para el subobjeto anidado de collect-rest (`whatsapp:{sent,error,message}`
// — la factura SÍ se creó, `ok` de la respuesta es siempre true; el envío es un efecto
// secundario con su propio resultado).
function waCollectRestSent(whatsapp) {
  return !!whatsapp && whatsapp.sent === true;
}
window.waCollectRestSent = waCollectRestSent;

// A20.5 (J5): acciones de FALLBACK cuando un envío de WhatsApp falla — SIEMPRE
// se ofrecen las tres salidas: Copiar enlace · Enviar por email · Reintentar.
// Devuelve el elemento para insertarlo junto al mensaje de error de la vista.
function waFallbackBar({ link, onEmail, onRetry, emailDisabledReason }) {
  const bar = document.createElement('div');
  bar.className = 'wa-fallback-bar';
  bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-secondary btn-sm';
  copyBtn.textContent = '📋 Copiar enlace';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      showToast('✓ Enlace copiado — mándaselo por SMS o desde tu WhatsApp');
    } catch {
      window.prompt('Copia el enlace:', link);
    }
  });
  bar.appendChild(copyBtn);

  const emailBtn = document.createElement('button');
  emailBtn.className = 'btn-secondary btn-sm';
  emailBtn.textContent = '✉️ Enviar por email';
  if (emailDisabledReason) {
    emailBtn.disabled = true;
    emailBtn.title = emailDisabledReason;
    emailBtn.style.opacity = '.55';
  } else if (onEmail) {
    emailBtn.addEventListener('click', async () => {
      emailBtn.disabled = true;
      emailBtn.textContent = 'Enviando…';
      try {
        const result = await onEmail();
        // SCRUM-115: apiRequest() solo rechaza en HTTP≠2xx. Los 2 endpoints /send-email
        // responden 200+sent:false cuando el envío falla — sin este chequeo, esta barra
        // (compartida por facturas, presupuestos y trabajos) siempre decía "✓ Enviado".
        if (waSendFailed(result)) throw { data: result, message: result.message };
        showToast('✓ Enviado por email'); emailBtn.textContent = '✉️ Enviado';
      } catch (e) {
        showToast('Email falló: ' + (e?.data?.message || e.message), 'error');
        emailBtn.disabled = false; emailBtn.textContent = '✉️ Enviar por email';
      }
    });
  }
  bar.appendChild(emailBtn);

  if (onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-ghost btn-sm';
    retryBtn.textContent = '↻ Reintentar WhatsApp';
    retryBtn.addEventListener('click', () => { bar.remove(); onRetry(); });
    bar.appendChild(retryBtn);
  }
  return bar;
}
window.waFallbackBar = waFallbackBar;

// A6.2: esqueleto para listas de TARJETAS (solicitudes, gastos…): mismas
// proporciones que una fila-card real para que la carga no "salte".
function uiSkeletonCards(container, cards = 4) {
  if (!container) return;
  let html = '';
  for (let i = 0; i < cards; i++) {
    const w = 40 + (i % 3) * 18;
    html += `
      <div class="customers-card" aria-hidden="true" style="display:flex;flex-direction:column;gap:10px">
        <span class="skeleton" style="display:block;height:14px;width:${w}%"></span>
        <span class="skeleton" style="display:block;height:11px;width:${Math.min(w + 32, 92)}%"></span>
      </div>`;
  }
  container.innerHTML = html;
}
window.uiSkeletonCards = uiSkeletonCards;

// progressBar(pct, estado, {cobrado, aceptado, currency}) — barra de % cobrado COMPARTIDA
// (SCRUM-11 → extraída en SCRUM-12). Devuelve label "Cobrado X de Y · %" + barra .progress.
// estado 'Parcial' pinta ámbar; ancho = dato (inline). Tokens de styles.css:487-495.
function progressBar(pct, estado, { cobrado = 0, aceptado = 0, currency = 'EUR' } = {}) {
  const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  const partial = estado === 'Parcial' ? ' progress-fill--partial' : '';
  return `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:12px;margin-bottom:5px">
        <span style="color:var(--muted)">Cobrado <b style="color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums">${fmtMoneyEs(cobrado, currency)}</b> de <b style="color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums">${fmtMoneyEs(aceptado, currency)}</b></span>
        <span style="color:var(--muted);font-variant-numeric:tabular-nums">${p}%</span>
      </div>
      <div class="progress" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="Cobrado ${p}% de ${fmtMoneyEs(aceptado, currency)}">
        <div class="progress-fill${partial}" style="width:${p}%"></div>
      </div>
    </div>`;
}
window.progressBar = progressBar;

// SCRUM-30: mapeo ÚNICO del estado de cobro → clase de status-pill. Antes DUPLICADO inline en
// jobsView/jobDetailView/operariosView (mismos umbrales/colores): Pagado→accepted (verde),
// Parcial→pending (ámbar), Pendiente→draft (neutro). Default draft (defensivo). Regla AB/AB3.
function cobroPillClass(estadoCobro) {
  return { Pagado: 'status-pill-accepted', Parcial: 'status-pill-pending', Pendiente: 'status-pill-draft' }[estadoCobro] || 'status-pill-draft';
}
window.cobroPillClass = cobroPillClass;

// SCRUM-37 · ESTADO DEL PLAN DE TRAMOS — ÚNICA copia en el front de la regla del invariante.
//
// ⚠️ ESTO DUPLICA UNA REGLA DEL SERVIDOR, Y ES A PROPÓSITO. El pro tiene que ver el descuadre
// MIENTRAS edita, no enterarse por un 409 después de guardar; para eso hace falta calcular en
// el navegador. Pero duplicar una regla de dinero es exactamente el patrón que ya ha mordido
// dos veces este mes —`vat_default` pisando el IVA por línea, y el total guardado ganando al
// bruto de las líneas (SCRUM-141)—: dos fuentes que empiezan de acuerdo y se separan sin que
// nadie lo note.
//
// Tres cosas hacen que aquí sea seguro y no una bomba con temporizador:
//   1. **UNA sola copia.** Antes había ya una en `quotesView.js` (`customStagesValid`, SCRUM-27)
//      y el editor de SCRUM-37 iba a ser la segunda. Ahora las dos llaman aquí.
//   2. **Mismas unidades que el servidor**: `percentage` es FRACCIÓN (0,3 = 30 %), y la suma se
//      hace en céntimos con el mismo redondeo. Comparar manzanas con manzanas es lo que permite…
//   3. …un **test DIFERENCIAL** (`tests/scrum37-plan-front-vs-back.test.mjs`): las mismas
//      entradas van a esta función y a `validateCustomBillingPlan`/`validarEdicionPlan` del
//      dominio, y tienen que coincidir. No es un guard que comprueba que aquí «se mencione» a
//      los emitidos: es uno que falla el día que las dos verdades discrepan, que es el fallo real.
//
// El 409 del servidor sigue ahí y sigue mandando. Esto es para que no haga falta llegar a él.
function planTramosEstado(tramos, emitidas) {
  const lista = Array.isArray(tramos) ? tramos : [];
  const yaEmitidos = Number.isFinite(Number(emitidas)) ? Math.max(0, Math.trunc(Number(emitidas))) : 0;

  if (lista.length === 0) {
    return { ok: false, sumaPct: 0, error: 'El plan de cobro debe tener al menos un tramo.' };
  }
  // El plan no puede encoger por debajo de lo ya facturado: esas facturas existen, con su
  // `stageLabel`, y una emitida no se edita ni se borra (regla 29).
  if (lista.length < yaEmitidos) {
    return {
      ok: false,
      sumaPct: 0,
      error: `Ya hay ${yaEmitidos} ${yaEmitidos === 1 ? 'tramo facturado' : 'tramos facturados'}: el plan no puede tener menos.`,
    };
  }

  // OJO CON LAS UNIDADES: `percentage` es FRACCIÓN (0,3 = 30 %), así que `pct * 100` da PUNTOS
  // PORCENTUALES, no céntimos. El servidor llama `sumCents` a esta misma magnitud y compara
  // contra 100; se conserva la aritmética exacta y se le da aquí el nombre que describe lo que
  // es, porque este valor se PINTA en pantalla («Suman 130 %») y equivocarse de unidad ahí es
  // enseñar un número falso al pro. Lo cazó el test diferencial: había puesto `/100`.
  let sumaPuntos = 0;
  for (const t of lista) {
    const label = typeof t?.label === 'string' ? t.label.trim() : '';
    if (!label) return { ok: false, sumaPct: sumaPuntos, error: 'Cada tramo necesita una etiqueta (p. ej. "Anticipo").' };
    const pct = Number(t?.percentage);
    if (!Number.isFinite(pct) || pct <= 0) {
      return { ok: false, sumaPct: sumaPuntos, error: `El tramo "${label}" debe tener un porcentaje mayor que 0.` };
    }
    sumaPuntos += Math.round(pct * 100);
  }
  // La suma cuenta TODOS los tramos, emitidos incluidos. Repartir el 100 % «de lo que queda»
  // es el error natural del pro y es justo lo que hay que delatar en vivo.
  if (sumaPuntos !== 100) {
    return { ok: false, sumaPct: sumaPuntos, error: 'Los tramos deben sumar exactamente el 100 %.' };
  }
  return { ok: true, sumaPct: sumaPuntos, error: '' };
}
window.planTramosEstado = planTramosEstado;

// SCRUM-153: estado de la FACTURA → etiqueta + clase de status-pill CANÓNICA.
//
// Antes esto era un ternario DUPLICADO inline en invoicesView (listado) e invoiceDetailView
// (detalle), y los dos terminaban igual: `: 'PENDIENTE'`. Es decir, **cualquier estado que no
// fuese `paid` ni `expired` se pintaba como PENDIENTE** — así que una factura ANULADA salía en
// pantalla como pendiente de cobro. La ruta de anulación existía y sellaba bien; lo que mentía
// era la pantalla, que es donde el pro toma la decisión de perseguir el cobro.
//
// El fallo real no era el estado que faltaba: era **el `else` que se lo tragaba**. Por eso aquí
// lo desconocido NO cae a «pendiente»: cae a un estado visible y raro (el propio código en
// mayúsculas, con pill neutra), para que un estado nuevo sin mapear se vea en vez de disfrazarse
// del más inocente. Mismo criterio que `cobroPillClass` y `jobStatusMeta`, un paso más lejos.
//
// ANULADA usa la pill `rejected` igual que VENCIDA: las dos dicen «de aquí no viene dinero».
// La ETIQUETA las distingue, que es lo que exige DESIGN.md — el color no es el único canal.
function invoiceStatusMeta(status) {
  const M = {
    paid:     { label: 'PAGADA',    pillClass: 'status-pill-accepted' },
    pending:  { label: 'PENDIENTE', pillClass: 'status-pill-pending' },
    expired:  { label: 'VENCIDA',   pillClass: 'status-pill-rejected' },
    annulled: { label: 'ANULADA',   pillClass: 'status-pill-rejected' },
  };
  return M[status] || { label: String(status || '—').toUpperCase(), pillClass: 'status-pill-draft' };
}
window.invoiceStatusMeta = invoiceStatusMeta;

// SCRUM-31 (F1): estado del TRABAJO (FSM Parte L) → etiqueta + clase de status-pill CANÓNICA.
// Antes hand-styled en JOB_STATE_META (jobsView, deuda SCRUM-11). El color codifica la
// disponibilidad de cobro (verde=terminado→cobrar · ámbar=en curso · neutro=aún no / cerrado);
// la ETIQUETA distingue el estado exacto (el color no es el único canal, DESIGN.md). Sin azul:
// el sistema canónico solo tiene accepted/pending/draft/rejected.
function jobStatusMeta(status) {
  const M = {
    pendiente_agendar: { label: 'Sin agendar', pillClass: 'status-pill-draft' },
    agendado:          { label: 'Agendado',    pillClass: 'status-pill-draft' },
    en_curso:          { label: 'En curso',    pillClass: 'status-pill-pending' },
    terminado:         { label: 'Terminado',   pillClass: 'status-pill-accepted' },
    cerrado:           { label: 'Cerrado',     pillClass: 'status-pill-draft' },
  };
  return M[status] || M.pendiente_agendar;
}
window.jobStatusMeta = jobStatusMeta;

// SCRUM-31 (F3, AB3 aprobado): menú de acciones secundarias (kebab «⋯»). Agrupa elementos de
// acción YA creados (botones/enlaces con sus handlers intactos): 1 primaria visible + el resto
// aquí. Desktop = popover anclado con flip; ≤640px = hoja inferior (reutiliza .modal-overlay/.modal
// como F2). Teclado (↑↓/Home/End/Enter/Esc/Tab), foco al abrir→1.er ítem y al cerrar→trigger,
// cierre por clic-fuera/scroll, uno abierto a la vez. Nunca esconde primaria / Marcar PAGADA / PDF.
let overflowOpenClose = null; // el que esté abierto; se cierra al abrir otro
function overflowMenu(actionEls, { label = 'Más acciones' } = {}) {
  const items = (actionEls || []).filter(Boolean);
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'overflow-trigger btn-ghost btn-sm';
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', label);
  trigger.textContent = '⋯';

  let panel = null, overlay = null;
  // preventScroll: enfocar un ítem NO debe desplazar la página (si lo hace, dispararía onScroll
  // y el popover se cerraría solo al abrir). El popover ya está posicionado junto al trigger.
  function focusItem(i) { const n = items.length; if (n) items[((i % n) + n) % n].focus({ preventScroll: true }); }
  const onDocPointer = (e) => {
    if ((panel && panel.contains(e.target)) || trigger.contains(e.target)) return;
    close(false);
  };
  const onKey = (e) => {
    if (!panel) return;
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
    else if (e.key === 'End') { e.preventDefault(); focusItem(items.length - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') { close(false); }
  };
  const onScroll = () => close(false);
  function close(restoreFocus) {
    if (!panel && !overlay) return;
    if (overlay) overlay.remove(); else if (panel) panel.remove();
    panel = overlay = null;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDocPointer, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onScroll, true);
    overflowOpenClose = null;
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }
  function open() {
    if (overflowOpenClose) overflowOpenClose();
    const mobile = window.innerWidth <= 640;
    if (mobile) {
      overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      panel = document.createElement('div');
      panel.className = 'modal overflow-sheet';
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
    } else {
      panel = document.createElement('div');
      panel.className = 'overflow-menu';
      document.body.appendChild(panel);
    }
    panel.setAttribute('role', 'menu');
    panel.setAttribute('aria-label', label);
    items.forEach((el) => panel.appendChild(el));
    if (!mobile) {
      const r = trigger.getBoundingClientRect();
      panel.style.minWidth = Math.max(180, Math.round(r.width)) + 'px';
      const pw = panel.offsetWidth, ph = panel.offsetHeight;
      const left = Math.max(8, Math.min(r.right - pw, window.innerWidth - pw - 8));
      let top = r.bottom + 6;
      if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6); // flip arriba
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
    }
    trigger.setAttribute('aria-expanded', 'true');
    overflowOpenClose = () => close(false);
    document.addEventListener('pointerdown', onDocPointer, true);
    document.addEventListener('keydown', onKey, true);
    if (!mobile) { window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', onScroll, true); }
    focusItem(0);
  }

  items.forEach((el) => {
    el.setAttribute('role', 'menuitem');
    el.tabIndex = -1;
    el.classList.remove('btn-secondary', 'btn-ghost', 'btn-primary', 'btn-sm');
    el.classList.add('overflow-item');
    el.addEventListener('click', () => close(false)); // activar un ítem cierra el menú
  });
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (trigger.getAttribute('aria-expanded') === 'true') close(true); else open();
  });
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); open(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); open(); focusItem(items.length - 1); }
  });
  return trigger;
}
window.overflowMenu = overflowMenu;

// SCRUM-89: acción vetada por ROL (técnico/operario) — DESHABILITAR CON EXPLICACIÓN, no ocultar
// (que aprenda que el cobro lo hace el admin). El botón queda visible pero disabled; la explicación
// se pone UNA vez por grupo (roleLockedNote), no por botón. La seguridad real la da el 403 del backend.
function lockActionForRole(btn) {
  if (!btn) return btn;
  btn.disabled = true;
  btn.classList.add('role-locked');
  btn.setAttribute('aria-disabled', 'true');
  btn.title = 'Solo para administradores';
  return btn;
}
function roleLockedNote() {
  const p = document.createElement('p');
  p.className = 'role-locked-note';
  p.textContent = 'Esta acción es solo para administradores. Pídeselo a quien gestiona la cuenta.';
  return p;
}
window.lockActionForRole = lockActionForRole;
window.roleLockedNote = roleLockedNote;

// Copy aprobado por el fundador (23-jul, docs/Sprint Scrum/SESION_ACTUAL_SCRUM-69.md) — NO reformular.
// SCRUM-210: vivía dentro de invoicesView.js; se mudó aquí SIN tocar una letra porque ahora lo
// comparten dos superficies — la bandeja de pendientes (SCRUM-69) y el aviso ámbar de plazo
// vencido del semáforo fiscal. Copy aprobado duplicado es copy que acaba divergiendo, y este
// además tiene que ser reproducible desde el AuditLog.
function copyRojo(mesLabel) {
  return `El plazo de este mes venció — ya no se puede agrupar en una recapitulativa de `
    + `${mesLabel}. Puedes facturar estos partes igualmente (factura individual o `
    + `recapitulativa del mes en curso); si tienes dudas, consúltalo con tu asesor.`;
}
window.copyRojo = copyRojo;

// WA-0b · chip de entrega de WhatsApp (J4). Recibe `waDelivery` del detalle
// ({status, templateName, at} | null) y devuelve el HTML del chip, o '' si no hay envío.
// Estados de Meta: sent → delivered → read | failed. Microcopy clara para el merchant.
function waDeliveryChip(waDelivery) {
  if (!waDelivery || !waDelivery.status) return '';
  const map = {
    queued:    { cls: 'wa-chip-sent',      glyph: '🕓', label: 'En cola' },
    sent:      { cls: 'wa-chip-sent',      glyph: '✓',  label: 'Enviado' },
    delivered: { cls: 'wa-chip-delivered', glyph: '✓✓', label: 'Entregado' },
    read:      { cls: 'wa-chip-read',      glyph: '✓✓', label: 'Leído' },
    failed:    { cls: 'wa-chip-failed',    glyph: '⚠',  label: 'No entregado' },
  };
  const m = map[waDelivery.status] || map.sent;
  let when = '';
  if (waDelivery.at) {
    const d = new Date(waDelivery.at);
    if (!isNaN(d)) when = ' · ' + d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }
  const title = 'WhatsApp' + (waDelivery.templateName ? ' (' + waDelivery.templateName + ')' : '');
  return `<span class="wa-chip ${m.cls}" title="${title}">`
    + `<span class="wa-chip-glyph">${m.glyph}</span> WhatsApp: ${m.label}${when}</span>`;
}
window.waDeliveryChip = waDeliveryChip;

// -------- Admin – Merchant --------

function getMerchantProfile() {
  // GET /admin/merchant
  return apiRequest("/admin/merchant");
}

function updateMerchantProfile(payload) {
  // PUT /admin/merchant
  return apiRequest("/admin/merchant", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// -------- Admin – Clientes --------

function getCustomers(search = "") {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiRequest(`/admin/customers${query}`);
}

function createCustomer(payload) {
  return apiRequest("/admin/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function updateCustomer(id, payload) {
  return apiRequest(`/admin/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// -------- Presupuestos (Quotes) – creación antigua --------

function createQuote(payload) {
  // POST /quote/create
  return apiRequest("/quote/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function acceptQuote(id, payload) {
  // POST /quote/:id/accept
  return apiRequest(`/quote/${id}/accept`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// -------- Admin – Presupuestos (historial + detalle + decisión) --------

// Lista de presupuestos para el BO
async function getQuotesList(search) {
  const params = new URLSearchParams();
  if (search && search.trim() !== "") {
    params.set("search", search.trim());
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/admin/quotes${query}`);
}

// Detalle completo de un presupuesto
async function getQuoteDetailAdmin(id) {
  return apiRequest(`/admin/quotes/${id}`);
}

// Alias para no romper nada si algún sitio llama a getQuoteDetail
async function getQuoteDetail(id) {
  return getQuoteDetailAdmin(id);
}

// Aceptar desde el BO
async function acceptQuoteAdmin(id, payload = {}) {
  return apiRequest(`/admin/quotes/${id}/accept`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Rechazar desde el BO
async function rejectQuoteAdmin(id, payload = {}) {
  return apiRequest(`/admin/quotes/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// -------- Admin – Productos --------

function getProducts(search = "", limit = 20) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("limit", String(limit));
  return apiRequest(`/admin/products?${params.toString()}`);
}
