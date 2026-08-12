// public/dashboard/js/cobrosView.js — SCRUM-285 (B4)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// «Menú **Cobros** = los cobros con su justificante» (diseño §B4)
//
// La pantalla que faltaba, y la que desbloquea la entrada `Cobros` de la barra: hasta hoy el
// profesional que quería saber qué le deben tenía que mirar Facturas y deducirlo.
//
// 🔴 LISTA LAS DOS POBLACIONES, Y ESO NO ES UN DETALLE DE IMPLEMENTACIÓN. Un cobro por
// transferencia o efectivo NO crea `Charge` (medido: `invoiceAdmin.ts:93` marca `paidAt` en la
// Invoice y no toca `Charge`). Una pantalla que listara solo `Charge` escondería justo el dinero
// que el profesional marca a mano. El servidor las funde; aquí solo se pintan.
//
// ⚠️ LA CLASIFICACIÓN LA HACE `tipoDeFactura`, NO UNA COPIA. Es la MISMA función que reparte la
// pila de documentos del Trabajo y que alimenta el bloque DINERO del rail (G4). Si esta pantalla
// dedujera por su cuenta qué es un justificante, tendríamos dos verdades sobre el mismo documento
// — exactamente lo que G4 evitó a propósito.

/**
 * MICROCOPY APROBADA por el asesor el 10-ago-2026 (regla 30). Las seis cabeceras
 * se aprobaron al partir la quinta columna en dos: YA NO QUEDA MARCADOR en esta pantalla.
 *
 * 🔴 EL ESTADO VACÍO SON DOS, Y CONFUNDIRLOS ES EL DEFECTO. «No hay datos» y «tu filtro los ha
 * escondido» son afirmaciones distintas, y la primera dicha en el sitio de la segunda le dice al
 * profesional **que no le deben nada**. En una pantalla de dinero eso no es un texto impreciso: es
 * una respuesta falsa a la pregunta que vino a hacer.
 *
 * Y «Método no registrado» no es «Otro»: «otro» AFIRMA que hubo un método distinto, y aquí no
 * consta ninguno. Es la misma distinción que obligó a crear el cubo.
 */
var COBROS_COPY = {
  titulo: 'Cobros',
  filtroTodos: 'Todos',
  // 🔴 SCRUM-481 · AQUÍ HABÍA UN SEGUNDO NOMBRE PARA LO MISMO: `metodoSinRegistrar: 'No
  // registrado'`, que pintaba la columna mientras la pestaña de al lado decía «Método no
  // registrado». Dos rótulos para el mismo hecho en la misma pantalla es el defecto de este
  // ticket en miniatura, así que se retira y queda UNO. Si alguien necesita una versión corta,
  // que se apruebe como tal en vez de renacer por comodidad.
  filtroSinMetodo: 'Método no registrado',
  errorCarga: 'No hemos podido cargar los cobros. Vuelve a intentarlo.',
  vacioSinCobros: 'Todavía no hay cobros registrados.',
  vacioPorFiltro: 'Ningún cobro coincide con este filtro.',
  /**
   * LA ANTIGÜEDAD, en sus dos formas — y son dos porque el sitio cambia lo que hace falta decir.
   *
   * · EN TABLA la columna ya se llama «Sin cobrar», así que la celda solo pone el número:
   *   repetir la etiqueta en cada fila es ruido, y lo que el profesional hace aquí es BARRER con
   *   la vista buscando el que lleva más tiempo. Un número corto se barre; una frase, no.
   * · FUERA DE LA TABLA no hay cabecera que lo explique, así que va la frase entera.
   *
   * Las dos con singular. `n=1` → «1 día».
   */
  diasEnTabla: function (n) { return n + (n === 1 ? ' día' : ' días'); },
  /**
   * 🔴 SE DERIVA DE LA CORTA, no se escribe otra vez. Las dos frases se pintan a la vez en la misma
   * celda —una para la tabla y otra para la card— y dos copias de un texto aprobado que pueden
   * divergir son microcopy esperando a romperse: alguien arregla el singular en una y la otra se
   * queda diciendo «1 días» en el sitio donde de verdad se mira.
   *
   * Derivándola, la divergencia **no es que se vigile: es que no puede pasar**. Y aun así hay test
   * que las ata, porque el día que alguien las separe tiene que enterarse por un rojo y no por una
   * captura.
   */
  diasSinCobrar: function (n) { return 'Sin cobrar desde hace ' + COBROS_COPY.diasEnTabla(n); },
  cabeceras: ['Fecha', 'Cliente', 'Importe', 'Método', 'Documento', 'Sin cobrar'],
};

/**
 * CUATRO cubos, no cinco: `bizum_auto` y `bizum_manual` son una distinción NUESTRA —confirmado
 * por la pasarela frente a dicho por el profesional— y el diseño nombra cuatro métodos porque el
 * profesional piensa en cuatro. La distinción no se pierde: se lee en la fila de cada cobro.
 * **Filtrar por cuatro, leer los cinco** — y desde SCRUM-481 la fila lo cumple de verdad, con
 * «Bizum · automático» y «Bizum · manual» (`COBROS_MATICES`). Mientras los dos se leyeron «Bizum»,
 * esta frase describía un mecanismo que no existía.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 ESTA LISTA YA NO PINTA LA BARRA, Y SIGUE HACIENDO TRES COSAS. SCRUM-474 fase 2 se llevó al
 * servidor quién decide los cubos (`cubosDeMetodo`, derivado de `PAID_VIA`) y en cuál cae cada
 * cobro (`c.metodoCubo`) — que es lo correcto: el conjunto cerrado de la regla 22 no puede vivir
 * duplicado en el front. Lo que queda aquí no es aquella copia:
 *
 *   ① `casa` — qué valores del conjunto cerrado pertenecen a cada cubo. Es lo que ata
 *      `tests/scrum474-dos-copias-atadas.test.mjs` contra `PAID_VIA`: si el conjunto crece y esto
 *      no, sale en rojo. Borrarla apagaría ese guard.
 *   ② el SUELO de `cuboDeMetodo`, para una fila que llegue sin `metodoCubo` — una respuesta que el
 *      Service Worker guardó antes del despliegue. Sin él, esos cobros se leerían «Método no
 *      registrado» teniendo método.
 *   ③ la GRAFÍA de la columna cuando el arranque no trajo los cubos (ver `rotuloDeMetodo`).
 *
 * Los tres son de LECTURA de un dato que ya vino decidido. Ninguno vuelve a ofrecer un filtro que
 * el servidor no haya confirmado, que es lo que la fase 2 vino a impedir.
 */
/**
 * SCRUM-451 · EL PLAZO Y EL NÚMERO DE SECUENCIA YA NO VIVEN AQUÍ.
 *
 * SCRUM-448 los estrenó en esta vista, y dejó dicho por qué era provisional: **el segundo sitio
 * donde se copia una decisión es donde deja de ser una decisión y pasa a ser una costumbre.** Los
 * dos bajaron a `apiRequest` (`api.js`), que es por donde pasan las 136 peticiones del panel, y
 * allí además **cortan de verdad** con `AbortController` — cosa que aquí no se podía hacer.
 *
 * Lo que esta vista conserva es lo suyo: **sus tres estados y su texto**. Cuando el plazo vence,
 * `apiRequest` rechaza con `err.vencido`, cae por el `catch` de siempre y se pinta el aviso ya
 * aprobado en SCRUM-285. Ni un texto genérico ni un plazo propio.
 */

var COBROS_METODOS = [
  { clave: 'bizum', rotulo: 'Bizum', casa: ['bizum_auto', 'bizum_manual'] },
  { clave: 'card', rotulo: 'tarjeta', casa: ['card'] },
  { clave: 'transfer', rotulo: 'transferencia', casa: ['transfer'] },
  { clave: 'cash', rotulo: 'efectivo', casa: ['cash'] },
];

/**
 * 🔴 EL CUBO QUE EL DISEÑO NO PREVIÓ, Y NO SE PUEDE NO TENER.
 *
 * `Invoice` **no guarda método de cobro** —medido sobre el esquema— así que de un cobro marcado a
 * mano no consta cómo entró el dinero. Sin este cubo, esos cobros DESAPARECERÍAN al pulsar
 * cualquier filtro: la misma mentira por omisión que evitamos al fundir las poblaciones, colándose
 * por el filtro. Su rótulo —«Método no registrado»— lo aprobó el asesor el 10-ago-2026, y NO es
 * «Otro»: «otro» AFIRMA que hubo un método distinto; aquí no consta ninguno.
 */
var COBROS_SIN_METODO = { clave: 'sin-metodo', rotulo: COBROS_COPY.filtroSinMetodo, casa: [] };

/**
 * 🔴 SCRUM-474 · LA PASARELA NO CAMBIA EL MÉTODO, Y ASÍ ESTABA PARTIENDO LAS TARJETAS EN DOS.
 *
 * `Charge.method` guarda `<metodo>` o `<metodo>:<pasarela>`: `card` lo escribe el selector de pago
 * (`charges.routes.ts`) y `card:stripe` lo escribe la pasarela. **Son el mismo método** — uno es la
 * preferencia y el otro el hecho consumado. La comparación exacta metía `card:stripe` en «Método no
 * registrado», así que el profesional filtraba por tarjeta y veía la mitad de sus cobros.
 *
 * Medido en producción el 11-ago-2026: **38 de 51 cobros** repartidos entre esas dos etiquetas.
 *
 * Se recorta la pasarela ANTES de mirar, y `COBROS_METODOS` sigue siendo la ÚNICA lista de qué
 * valor cae en qué cubo: aquí no se copia nada.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 ESTO ES UNA SEGUNDA COPIA DELIBERADA DE `partirMetodo`, Y CONSTA COMO TAL.
 *
 * La partición `<metodo>:<pasarela>` ya vive en `src/modules/billing/domain/metodoDeCobro.ts`.
 * La regla dura 4 —vanilla, sin bundler— impide que esta pantalla lo importe: es TypeScript
 * compilado a `dist/` para el servidor, y aquí no hay build que lo traiga. La copia es
 * inevitable; **que nadie la haya contado, no.**
 *
 * Por eso `tests/scrum474-dos-copias-atadas.test.mjs` las ata: mismo corpus, mismo veredicto,
 * y el corpus se DERIVA de `PAID_VIA` en vez de escribirse a mano, así que tocar una sola de
 * las dos sale en rojo. Si esta función y `partirMetodo` divergen, es un fallo, no una
 * diferencia de criterio.
 *
 * Se devuelve `null` —y no la base— cuando la pasarela viene VACÍA (`card:`), porque es lo que
 * hace `partirMetodo` (`metodoDeCobro.ts:45`) y porque `esMetodoValido('card:')` es `false`: el
 * guard de `psp.routes.ts:110` RECHAZA ese valor al escribirlo. Un lector que lo clasificara
 * como tarjeta estaría contradiciendo al escritor sobre el mismo dato. Cae en «Método no
 * registrado», que sigue en el listado: no desaparece ningún cobro.
 */
function metodoSinPasarela(metodo) {
  if (typeof metodo !== 'string') return null;
  var limpio = metodo.trim().toLowerCase();
  if (limpio === '') return null;
  var i = limpio.indexOf(':');
  if (i === -1) return limpio;
  var base = limpio.slice(0, i);
  var pasarela = limpio.slice(i + 1);
  if (base === '' || pasarela === '') return null;
  return base;
}

/** A qué cubo de filtro cae un cobro. `null` → «no consta». */
function cuboDeMetodo(metodo) {
  var base = metodoSinPasarela(metodo);
  if (!base) return COBROS_SIN_METODO.clave;
  for (var i = 0; i < COBROS_METODOS.length; i++) {
    if (COBROS_METODOS[i].casa.indexOf(base) !== -1) return COBROS_METODOS[i].clave;
  }
  return COBROS_SIN_METODO.clave;
}

/**
 * 🔴 SCRUM-481 · LA PASARELA, SIN VOLVER A PARTIR POR «:».
 *
 * Ya hay DOS copias contadas de la partición (`partirMetodo` en el servidor y `metodoSinPasarela`
 * aquí) y el trinquete de `tests/scrum474-dos-copias-atadas.test.mjs` está calibrado en **2 a
 * propósito**: «un trinquete calibrado de más es un trinquete que autoriza una copia más». Escribir
 * aquí otro `indexOf(':')` sería la tercera, y no tendría la excusa de la regla 4.
 *
 * Así que esto **no parte nada**: le pide la cabeza a `metodoSinPasarela` —la copia declarada— y se
 * queda con lo que sobra detrás. Si mañana cambia la regla de partición, cambia en un solo sitio y
 * esto la sigue sin enterarse. **Delegar, que es lo que el mensaje del trinquete pide.**
 */
function pasarelaDeMetodo(metodo) {
  var base = metodoSinPasarela(metodo);
  if (!base) return null;                       // `card:` incluido: no consta el método, ni pasarela
  var limpio = String(metodo).trim().toLowerCase();
  if (limpio.length === base.length) return null;   // venía sin pasarela
  return limpio.slice(base.length + 1);             // lo de detrás del separador, sea cual sea
}

/**
 * Cómo escribe su nombre cada pasarela. **No es la partición ni una tabla de métodos:** el conjunto
 * de pasarelas es ABIERTO a propósito (`metodoDeCobro.ts`: «inventarlo cerraría la puerta a la
 * siguiente»), así que aquí solo viven las marcas cuya grafía está aprobada.
 *
 * 🔸 Una pasarela que no esté aquí **no se pinta a medias ni se inventa**: se pinta solo el método.
 * Capitalizar por las bravas daría «Mercadopago», que no es como se escribe la marca — y escribir
 * `mercadopago` en crudo sería el defecto que este ticket viene a quitar. Queda declarado en la
 * entrada: la tercera pasarela necesita que se apruebe su grafía, no código nuevo.
 */
var COBROS_PASARELAS = { stripe: 'Stripe', mercadopago: 'MercadoPago' };

/**
 * 🔴 SCRUM-481 · EL MATIZ DE LA CASA — lo que distingue `bizum_auto` de `bizum_manual` EN LA FILA.
 *
 * SCRUM-285 dejó esta distinción viviendo justo aquí: «filtrar por cuatro, leer los cinco»
 * (`COBROS_METODOS`, arriba). Y no es cosmética — `paidVia.ts:17`: «uno lo confirma una PERSONA,
 * el otro un WEBHOOK. Son dos cadenas de evidencia distintas ante una inspección». Si la columna
 * los pinta los dos «Bizum», esa frase pasa a ser falsa y el comentario de arriba explica un
 * mecanismo que ya no existe.
 *
 * Grafía aprobada (asesor + fundador, 12-ago-2026): «Bizum · automático» y «Bizum · manual».
 *
 * 🔸 Ocupa la MISMA ranura que la pasarela y **gana cuando hay las dos**: la ranura es una sola en
 * el formato aprobado, y entre la marca de la pasarela y la cadena de evidencia, la que un
 * inspector pregunta es la segunda. Hoy es una situación imposible —solo `card` lleva pasarela—,
 * así que esto no elige por nadie: deja dicho qué pasa si algún día llega `bizum_auto:algo`.
 */
var COBROS_MATICES = { bizum_auto: 'automático', bizum_manual: 'manual' };

/**
 * La grafía aprobada de una clave, o `null`. **Solo propiedades PROPIAS y solo cadenas.**
 *
 * 🔸 Sin esto, `card:constructor` se leía «tarjeta · function Object() { [native code] }»: un
 * `mapa[clave]` heredado del prototipo es truthy y se concatenaba tal cual. Medido en este ticket
 * sobre el código ya mergeado. El valor no puede llegar de un escritor nuestro —`esMetodoValido`
 * lo rechaza— pero la columna pinta lo que venga en el payload, y una celda de dinero no se pone
 * a enseñar fontanería de JavaScript el día que alguien escriba por otro camino.
 */
function grafiaAprobada(mapa, clave) {
  if (typeof clave !== 'string') return null;
  if (!Object.prototype.hasOwnProperty.call(mapa, clave)) return null;
  return typeof mapa[clave] === 'string' && mapa[clave] !== '' ? mapa[clave] : null;
}

/**
 * 🔴 EL RÓTULO DE LA COLUMNA «MÉTODO», DEL MISMO SITIO QUE LA PESTAÑA DE AL LADO.
 *
 * Hasta SCRUM-481 la celda pintaba `c.metodo` TAL CUAL: `card:stripe`, `card`, `transfer`. Tres
 * centímetros más arriba las pestañas ya decían «tarjeta», «transferencia». **La pantalla hablaba
 * dos idiomas**, y el agravante nació con SCRUM-474: arreglado el filtro, el profesional pulsa
 * «tarjeta» y las filas que le salen dicen `card`.
 *
 * No hay tabla de traducción de métodos. Desde SCRUM-474 fase 2 el rótulo del cubo lo manda el
 * SERVIDOR (`cubosDeMetodo`, derivado de `PAID_VIA`) y en qué cubo cae cada cobro también
 * (`c.metodoCubo`). Esta función **consume las dos cosas, no las recalcula**: por eso columna y
 * pestaña no pueden discrepar — no es que se parezcan, es que es el mismo dato.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔸 EL SUELO ES LOCAL, Y NO ES LA LISTA A MANO POR LA PUERTA DE ATRÁS.
 *
 * Si el arranque no trajo los cubos (`/admin/me` viejo o caído) o la fila no trae `metodoCubo`
 * (respuesta servida por el Service Worker desde antes del despliegue), se cae a `cuboDeMetodo` y
 * `COBROS_METODOS`, que son de esta casa.
 *
 * La barra de filtros hace lo contrario a propósito —sin cubos del servidor solo pinta «Todos»— y
 * es la decisión correcta ALLÍ: una opción que el servidor no ha confirmado ofrece filtrar por algo
 * que quizá no existe. **Aquí no se ofrece nada: se describe un dato que el servidor YA mandó.**
 * Sin suelo, 51 cobros con método conocido se leerían «Método no registrado» — decirle al
 * profesional que no consta cómo entró su dinero, que es la mentira que este cubo existe para no
 * contar. Traducir con grafía aprobada un valor confirmado no inventa nada; callarlo sí.
 *
 * Formato aprobado (asesor + fundador, 11 y 12-ago-2026): `<método> · <calificador>`, y sin
 * calificador solo el método. **Nunca «tarjeta · » colgando.** El calificador es la marca de la
 * pasarela (`tarjeta · Stripe`) o el matiz de la casa (`Bizum · manual`) — una ranura, nunca dos.
 *
 * @param metodo  el valor CRUDO del cobro (`c.metodo`), que es de donde sale el calificador
 * @param cubo    `c.metodoCubo`, la clave que decidió el servidor. Sin ella, se deduce aquí
 * @param cubos   `window.appCobrosCubos`, los cubos del arranque con su rótulo aprobado
 */
function rotuloDeMetodo(metodo, cubo, cubos) {
  var clave = (typeof cubo === 'string' && cubo !== '') ? cubo : cuboDeMetodo(metodo);
  if (clave === COBROS_SIN_METODO.clave) return COBROS_SIN_METODO.rotulo;

  var rotulo = null;
  var lista = Array.isArray(cubos) ? cubos : [];
  for (var i = 0; i < lista.length; i++) {
    if (lista[i] && lista[i].clave === clave && typeof lista[i].rotulo === 'string') {
      rotulo = lista[i].rotulo; break;
    }
  }
  for (var j = 0; !rotulo && j < COBROS_METODOS.length; j++) {
    if (COBROS_METODOS[j].clave === clave) rotulo = COBROS_METODOS[j].rotulo;
  }
  // El suelo del suelo: un cubo que no tiene rótulo en ningún sitio NO se cae a la cadena vacía ni
  // al valor crudo «por si acaso». Se dice que no consta, que es lo único cierto.
  if (!rotulo) return COBROS_SIN_METODO.rotulo;

  var calificador = grafiaAprobada(COBROS_MATICES, metodoSinPasarela(metodo))
    || grafiaAprobada(COBROS_PASARELAS, pasarelaDeMetodo(metodo));
  return calificador ? rotulo + ' · ' + calificador : rotulo;
}

/** Días que lleva pendiente. `null` si ya está cobrado: un cobro cobrado no tiene deuda. */
function diasDeDeudaCobro(cobro, ahora) {
  if (!cobro || cobro.estado !== 'pending') return null;
  var desde = new Date(cobro.fecha).getTime();
  if (isNaN(desde)) return null;
  return Math.max(0, Math.floor(((ahora || new Date()).getTime() - desde) / 86400000));
}

function renderCobrosView(container) {
  container.innerHTML = '';

  var card = document.createElement('div');
  card.className = 'data-card';
  container.appendChild(card);

  var header = document.createElement('div');
  header.className = 'data-card-header';
  card.appendChild(header);

  var titulo = document.createElement('h2');
  titulo.textContent = COBROS_COPY.titulo;
  titulo.style.cssText = 'margin:0;font-size:18px';
  header.appendChild(titulo);

  // ── Filtros por método: el mismo control segmentado de la casa (jobsView, submenús) ──
  var barra = document.createElement('div');
  barra.className = 'data-card-toolbar';
  barra.setAttribute('role', 'tablist');
  card.appendChild(barra);

  var filtro = 'all';
  var datos = [];
  // SCRUM-474 fase 2 · LOS CUBOS DEL FILTRO, derivados de `PAID_VIA` en el servidor (regla 22) y
  // servidos EN EL ARRANQUE (`/admin/me` → `window.appCobrosCubos`), no con la lista de cobros.
  //
  // 🔴 Son CONSTANTES, y por eso no dependen de esta petición: con mala cobertura el profesional
  // abre Cobros, la lista no llega… y la barra de filtros sigue estando. Cuando los cubos viajaban
  // dentro de la respuesta, desaparecía — en la pantalla del dinero, justo cuando peor va la red.
  var cubos = Array.isArray(window.appCobrosCubos) ? window.appCobrosCubos : [];
  // 🔴 SCRUM-448 · EL TERCER ESTADO: «TODAVÍA NO LO SABEMOS».
  //
  // SCRUM-285 separó con cuidado los dos vacíos —«no hay ninguno» y «tu filtro los esconde»— y se
  // dejó el tercero fuera sin verlo: mientras la respuesta no ha llegado, `datos` está vacío y la
  // pantalla caía en el primero. Con mala cobertura, el profesional abría Cobros y leía **«Todavía
  // no hay cobros registrados»**: le afirmábamos que no le debe nadie nada. En la pantalla del
  // dinero eso no es impreciso, es falso — y se cierra tranquilo.
  //
  // Lo encontró el banco de SCRUM-362 en su primer uso, con el escenario «acepta y no entrega».
  //
  // 🔴 TRES ESTADOS EXPLÍCITOS, y no dos banderas. Con `cargado` a secas apareció un agujero al
  // añadir el plazo: tras el aviso, pulsar un filtro volvía a llamar a `pintarFilas()` con la lista
  // vacía y **la pantalla decía otra vez «no hay cobros»** — el defecto de este ticket colándose
  // por la puerta del plazo. Con el estado nombrado, cada uno pinta lo suyo y no hay combinación
  // que caiga en el vacío por descarte.
  var estado = 'cargando'; // 'cargando' | 'listo' | 'sin-respuesta'

  var tablaScroll = document.createElement('div');
  tablaScroll.className = 'table-scroll';
  card.appendChild(tablaScroll);

  var tabla = document.createElement('table');
  tabla.className = 'table table--cards-mobile';
  tablaScroll.appendChild(tabla);

  var thead = document.createElement('thead');
  // 🔴 SEIS COLUMNAS, Y LA SEXTA EXISTE POR UNA REGLA QUE SE LLEVA EL ASESOR:
  // **una cabecera que necesita una «y» son dos columnas.** La versión anterior tenía cinco y la
  // última se llamaba «documento y deuda» — o sea que ella misma estaba diciendo que ahí cabían
  // dos hechos. Y no es estética: la antigüedad es lo que se BARRE con la vista buscando lo que
  // lleva más tiempo sin cobrar, y enterrada junto a un número de documento no se puede barrer.
  // Ni ordenar por ella el día que alguien lo pida.
  //
  // Rótulos APROBADOS por el asesor el 10-ago-2026. Ya no queda marcador en esta pantalla.
  thead.innerHTML = '<tr>'
    + '<th>' + COBROS_COPY.cabeceras[0] + '</th>'
    + '<th>' + COBROS_COPY.cabeceras[1] + '</th>'
    + '<th style="text-align:right">' + COBROS_COPY.cabeceras[2] + '</th>'
    + '<th class="col-hide-mobile">' + COBROS_COPY.cabeceras[3] + '</th>'
    + '<th>' + COBROS_COPY.cabeceras[4] + '</th>'
    + '<th>' + COBROS_COPY.cabeceras[5] + '</th>'
    + '</tr>';
  tabla.appendChild(thead);

  var tbody = document.createElement('tbody');
  tabla.appendChild(tbody);

  function pintarFiltros() {
    barra.innerHTML = '';
    // SCRUM-474 fase 2 · LAS OPCIONES LAS MANDA EL SERVIDOR, derivadas de `PAID_VIA`. Esta vista
    // tenía su propia lista (`COBROS_METODOS`) que decidía qué valor cae en qué cubo: el conjunto
    // cerrado de la regla 22, duplicado donde no lo vigila nadie.
    //
    // Vienen del arranque, así que la barra se pinta ENTERA desde el primer repintado —haya
    // respuesta o no—. Si el arranque tampoco las trajo, solo sale «Todos»: no se inventa una
    // lista de repuesto, porque unas opciones que el servidor no ha confirmado son exactamente la
    // lista a mano volviendo por la puerta de atrás.
    var todos = [{ clave: 'all', rotulo: COBROS_COPY.filtroTodos }].concat(cubos);
    todos.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn-sm ' + (filtro === m.clave ? 'btn-secondary' : 'btn-ghost');
      b.textContent = m.rotulo;
      b.dataset.filtroCobro = m.clave;
      b.style.minHeight = '44px'; // AB6
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', filtro === m.clave ? 'true' : 'false');
      b.addEventListener('click', function () { filtro = m.clave; pintarFiltros(); pintarFilas(); });
      barra.appendChild(b);
    });
  }

  function visibles() {
    if (filtro === 'all') return datos;
    // 🔴 SE FILTRA POR EL CUBO QUE MANDA EL SERVIDOR, no por `c.metodo` en crudo. Comparar el
    // valor de la base era lo que metía `card:stripe` en «Método no registrado»; y derivarlo aquí
    // otra vez sería la regla duplicada en el front, que es lo que SCRUM-473 prohíbe.
    return datos.filter(function (c) { return c.metodoCubo === filtro; });
  }

  function pintarFilas() {
    tbody.innerHTML = '';
    var lista = visibles();

    // 🔴 MIENTRAS NO SE SABE, NO SE AFIRMA NADA. Ni «no hay cobros» ni «tu filtro los esconde»:
    // las dos son afirmaciones sobre unos datos que todavía no han llegado. La tabla se queda sin
    // filas —vacía y muda— y quien contesta cuando la respuesta no llega es el plazo de abajo.
    if (estado === 'cargando') return;

    // Y si la respuesta no llegó, se sigue diciendo eso — también al filtrar. Repintar el aviso en
    // vez de recalcular un vacío es lo que impide que un clic en un filtro convierta «no sabemos»
    // en «no hay».
    if (estado === 'sin-respuesta') { pintarAviso(); return; }

    if (!lista.length) {
      // 🔴 DOS ESTADOS VACÍOS, Y NO SON INTERCAMBIABLES. Si no hay NINGÚN cobro, la pantalla lo
      // dice. Si los hay pero el filtro los esconde, dice ESO. Poner el primero en el sitio del
      // segundo le contesta al profesional «no te deben nada» cuando lo que pasa es que él mismo
      // ha filtrado — y en la pantalla del dinero eso no es impreciso, es falso.
      var texto = datos.length ? COBROS_COPY.vacioPorFiltro : COBROS_COPY.vacioSinCobros;
      var tr0 = document.createElement('tr');
      var td0 = document.createElement('td');
      td0.colSpan = 6;
      td0.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💰</div>'
        + '<div class="empty-state-title" data-vacio="' + (datos.length ? 'filtro' : 'sin-cobros')
        + '">' + texto + '</div></div>';
      tr0.appendChild(td0);
      tbody.appendChild(tr0);
      return;
    }

    var ahora = new Date();
    lista.forEach(function (c) {
      var tr = document.createElement('tr');

      var tdFecha = document.createElement('td');
      tdFecha.className = 'cell-date';
      tdFecha.textContent = new Date(c.fecha).toLocaleDateString('es-ES',
        { day: '2-digit', month: 'short', year: 'numeric' });
      tr.appendChild(tdFecha);

      var tdCliente = document.createElement('td');
      tdCliente.className = 'cell-client';
      tdCliente.textContent = c.cliente || '—';
      tr.appendChild(tdCliente);

      var tdImporte = document.createElement('td');
      tdImporte.className = 'amount cell-amount';
      tdImporte.style.textAlign = 'right';
      tdImporte.textContent = (typeof fmtMoneyEs === 'function')
        ? fmtMoneyEs(c.importe, c.moneda) : (c.importe + ' ' + c.moneda);
      tr.appendChild(tdImporte);

      // MÉTODO: el rótulo APROBADO, y sale del MISMO sitio que la pestaña de arriba — `c.metodoCubo`
      // y `cubos`, los dos del servidor. Ya no se pinta `c.metodo` en crudo: eso era enseñarle al
      // profesional el valor de la base.
      //
      // 🔴 SE LE PASA EL CUBO DEL SERVIDOR, no se recalcula aquí. Desde SCRUM-474 fase 2 quien
      // decide en qué cubo cae un cobro es `cuboDeCobro` en el servidor, y el filtro de arriba
      // compara contra ESE campo. Si la columna volviera a deducirlo por su cuenta, tendríamos otra
      // vez dos cálculos sobre el mismo dato — que es el defecto entero de este ticket, movido de
      // sitio en lugar de arreglado.
      //
      // `col-hide-mobile`: en la card no hay cabecera que lo explique (el `thead` se oculta a
      // ≤640px), y un `transfer` suelto no dice nada. Es el reparto de la casa — `invoicesView`
      // esconde cuatro y `quotesListView` dos por lo mismo.
      var tdMetodo = document.createElement('td');
      tdMetodo.className = 'col-hide-mobile';
      tdMetodo.textContent = rotuloDeMetodo(c.metodo, c.metodoCubo, cubos);
      tr.appendChild(tdMetodo);

      // DOCUMENTO. El tipo lo dice `tipoDeFactura`, no una copia.
      var tdDoc = document.createElement('td');
      tdDoc.className = 'cell-id'; // en la card: arriba, pequeño y apagado — es lo que es
      var clasifica = (typeof tipoDeFactura === 'function') ? tipoDeFactura : null;
      var etiquetaDoc = (c.numero && clasifica)
        ? clasifica({ number: c.numero, type: c.tipo }) + ' ' + c.numero
        : (c.numero || '—');

      // SCRUM-285 (§B4) · COBRO → FACTURA. El sentido contrario —factura→cobro— se decidió SIN
      // enlace a propósito, porque NO existe ficha de cobro (`charge-detail` no está en el
      // dispatch). Éste sí tiene destino: `invoice-detail` existe, y `invoiceId` YA viajaba en el
      // payload (`cobros.service.ts:79`) sin que nadie lo usara.
      //
      // ⚠️ Y va condicionado: el dinero marcado A MANO no tiene factura y llega con
      // `invoiceId: null` (`cobros.service.ts:190`). Un enlace ahí no llevaría a ninguna parte —
      // o está el destino, o no está el enlace.
      if (c.invoiceId != null) {
        var aDoc = document.createElement('a');
        aDoc.href = '#invoice-detail';
        aDoc.textContent = etiquetaDoc;
        aDoc.style.cssText = 'color:inherit;text-decoration:underline';
        aDoc.addEventListener('click', function (ev) {
          ev.preventDefault();
          // Mismo mecanismo que el resto del dashboard (`jobDetailView.js:84`): estado + render.
          // No se inventa navegación: se reutiliza la que ya existe.
          if (window.renderAppView) {
            window.appState.invoiceId = c.invoiceId;
            window.renderAppView('invoice-detail');
          }
        });
        tdDoc.appendChild(aDoc);
      } else {
        tdDoc.textContent = etiquetaDoc;
      }
      tr.appendChild(tdDoc);

      // SIN COBRAR. Columna propia: es lo que se barre con la vista.
      //
      // 🔴 VACÍA si está cobrado — nada, ni guion ni cero. Y en la card eso además la hace
      // desaparecer (`td:empty { display:none }`), que es exactamente lo que se quiere: un cobro
      // cobrado no tiene por qué ocupar sitio hablando de una deuda que no existe.
      //
      // 🔴 Y SE PINTAN LAS DOS FORMAS, porque la CARD ES LA PANTALLA. Este producto se usa desde
      // una furgoneta: a ≤640 px la tabla se vuelve una pila de cards y el `thead` desaparece, así
      // que un «3 días» suelto se queda **sin referente justo donde de verdad se mira**. En la card
      // va la frase entera; en la tabla, solo el número, que es lo que se barre.
      //
      // El CSS elige cuál se ve (`solo-tabla` / `solo-card`, media query de 640 px, la misma
      // frontera que `col-hide-mobile`). Las dos salen de la MISMA función: la larga se deriva de
      // la corta, así que no pueden decir cosas distintas.
      var tdDeuda = document.createElement('td');
      tdDeuda.className = 'cell-status';
      var dias = diasDeDeudaCobro(c, ahora);
      if (dias !== null) {
        var enTabla = document.createElement('span');
        enTabla.className = 'solo-tabla';
        enTabla.textContent = COBROS_COPY.diasEnTabla(dias);
        var enCard = document.createElement('span');
        enCard.className = 'solo-card';
        enCard.textContent = COBROS_COPY.diasSinCobrar(dias);
        tdDeuda.appendChild(enTabla);
        tdDeuda.appendChild(enCard);
      }
      // Si está cobrado, la celda se queda VACÍA de verdad —sin spans— para que `td:empty` la
      // haga desaparecer en la card. Meter un span vacío la dejaría ocupando sitio.
      tr.appendChild(tdDeuda);

      tbody.appendChild(tr);
    });
  }

  pintarFiltros();
  pintarFilas();

  /** Pinta el aviso. Mismo texto aprobado para el fallo y para el plazo: es el mismo hecho. */
  function pintarAviso() {
    tbody.innerHTML = '';
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = COBROS_COPY.errorCarga;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function pintarNoSePudo() {
    if (estado === 'listo') return; // ya llegó: no se pisa lo que el profesional está leyendo
    estado = 'sin-respuesta';
    pintarAviso();
  }

  // 🔴 EL CASO QUE DECIDE EL DISEÑO: ¿y si la respuesta NO LLEGA NUNCA?
  //
  // Es lo que hace una red que acepta y no entrega: la promesa no resuelve **ni rechaza**, así que
  // sin plazo ni el `then` ni el `catch` correrían jamás y la tabla se quedaría muda para siempre.
  // Un indicador de carga eterno tampoco sirve: no miente, pero deja al profesional sin saber qué
  // hacer.
  //
  // SCRUM-451 · EL PLAZO LO PONE `apiRequest`, no esta vista. Al vencer, rechaza —con `sinRed` y
  // `vencido`— y esto cae por el `catch` de siempre. Se dice lo mismo que cuando falla, con el
  // texto YA APROBADO en SCRUM-285 —«No hemos podido cargar los cobros. Vuelve a intentarlo.»—,
  // porque para quien mira es el mismo hecho: no están sus datos y puede reintentar.
  //
  // Y el número de secuencia también es suyo: si mientras tanto salió otra petición para
  // `/admin/cobros`, la que manda es la última, y a ésta se le entrega ESE resultado. Aquí no hay
  // nada que comparar porque ya no puede llegar una respuesta vieja.
  apiRequest('/admin/cobros').then(function (r) {
    // 🔴 EL DATO GANA AL MENSAJE: si venció el plazo y la respuesta llega DESPUÉS, se pinta y
    // sustituye al aviso. Lo que vence no puede acabar contándose como «no hay cobros» — eso es el
    // defecto entero de SCRUM-448, y colarlo por la puerta del plazo sería reintroducirlo.
    // SCRUM-474 fase 2 · la respuesta sigue siendo un ARRAY: los cubos del filtro no viajan aquí,
    // llegan en el arranque. Son constantes, y meter un dato constante en el sobre de uno variable
    // es lo que dejaba la pantalla del dinero sin filtros cuando la red fallaba.
    datos = Array.isArray(r) ? r : [];
    estado = 'listo';
    pintarFilas();
  }).catch(function () {
    pintarNoSePudo();
  });
}

if (typeof window !== 'undefined') {
  window.renderCobrosView = renderCobrosView;
  window.COBROS_COPY = COBROS_COPY;
  window.COBROS_METODOS = COBROS_METODOS;
  window.COBROS_SIN_METODO = COBROS_SIN_METODO;
  window.cuboDeMetodo = cuboDeMetodo;
  window.rotuloDeMetodo = rotuloDeMetodo;
  window.COBROS_PASARELAS = COBROS_PASARELAS;
  window.COBROS_MATICES = COBROS_MATICES;
  window.diasDeDeudaCobro = diasDeDeudaCobro;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderCobrosView, COBROS_COPY, COBROS_METODOS, COBROS_SIN_METODO, cuboDeMetodo, metodoSinPasarela, pasarelaDeMetodo, rotuloDeMetodo, COBROS_PASARELAS, COBROS_MATICES, diasDeDeudaCobro };
}
