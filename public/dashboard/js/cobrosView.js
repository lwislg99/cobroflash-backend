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
 * Los filtros de método que pide el diseño: «Bizum · tarjeta · transferencia · efectivo».
 *
 * CUATRO botones, no cinco: `bizum_auto` y `bizum_manual` son una distinción NUESTRA —confirmado
 * por la pasarela frente a dicho por el profesional— y el diseño nombra cuatro métodos porque el
 * profesional piensa en cuatro. La distinción no se pierde: se lee en la fila de cada cobro.
 * Filtrar por cuatro, leer los cinco.
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
 * 🔴 EL RÓTULO DE LA COLUMNA «MÉTODO», DERIVADO DE LA MISMA PARTICIÓN QUE EL FILTRO.
 *
 * Hasta SCRUM-481 la celda pintaba `c.metodo` TAL CUAL: `card:stripe`, `card`, `transfer`. Tres
 * centímetros más arriba las pestañas ya decían «tarjeta», «transferencia». **La pantalla hablaba
 * dos idiomas**, y el agravante nació con SCRUM-474: arreglado el filtro, el profesional pulsa
 * «tarjeta» y las filas que le salen dicen `card`.
 *
 * No hay tabla de traducción: el rótulo sale de `cuboDeMetodo` —**la misma función que decide el
 * filtro**— y de `COBROS_METODOS`, que sigue siendo la única lista. Columna y pestaña no pueden
 * discrepar porque es el mismo cálculo, no dos que se parecen.
 *
 * Formato aprobado (asesor + fundador, 11-ago-2026): `<método> · <pasarela>`, y sin pasarela solo
 * el método. **Nunca «tarjeta · » colgando.**
 */
function rotuloDeMetodo(metodo) {
  var clave = cuboDeMetodo(metodo);
  if (clave === COBROS_SIN_METODO.clave) return COBROS_SIN_METODO.rotulo;
  var rotulo = null;
  for (var i = 0; i < COBROS_METODOS.length; i++) {
    if (COBROS_METODOS[i].clave === clave) { rotulo = COBROS_METODOS[i].rotulo; break; }
  }
  // El suelo: si la partición resuelve a un cubo que no tiene rótulo, NO se cae a la cadena vacía
  // ni al valor crudo «por si acaso». Se dice que no consta, que es lo único cierto.
  if (!rotulo) return COBROS_SIN_METODO.rotulo;
  var marca = COBROS_PASARELAS[pasarelaDeMetodo(metodo)];
  return marca ? rotulo + ' · ' + marca : rotulo;
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
    var todos = [{ clave: 'all', rotulo: COBROS_COPY.filtroTodos }].concat(COBROS_METODOS, [COBROS_SIN_METODO]);
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
    return datos.filter(function (c) { return cuboDeMetodo(c.metodo) === filtro; });
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

      // MÉTODO: el rótulo APROBADO, derivado de la misma partición que el filtro (`rotuloDeMetodo`).
      // Ya no se pinta `c.metodo` en crudo: eso era enseñarle al profesional el valor de la base.
      //
      // 🔸 SCRUM-481 · LO QUE ESTE CAMBIO CUESTA, Y CONSTA: la microcopy aprobada usa los rótulos
      // de las pestañas, y ahí `bizum_auto` y `bizum_manual` son los dos «Bizum». SCRUM-285 había
      // dejado esa distinción viviendo AQUÍ —«filtrar por cuatro, leer los cinco»—, así que la
      // columna deja de distinguirlos. No se inventa un rótulo para arreglarlo (regla 30): va al
      // informe para que lo decida quien aprueba el copy.
      //
      // `col-hide-mobile`: en la card no hay cabecera que lo explique (el `thead` se oculta a
      // ≤640px), y un `transfer` suelto no dice nada. Es el reparto de la casa — `invoicesView`
      // esconde cuatro y `quotesListView` dos por lo mismo.
      var tdMetodo = document.createElement('td');
      tdMetodo.className = 'col-hide-mobile';
      tdMetodo.textContent = rotuloDeMetodo(c.metodo);
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
  window.diasDeDeudaCobro = diasDeDeudaCobro;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderCobrosView, COBROS_COPY, COBROS_METODOS, COBROS_SIN_METODO, cuboDeMetodo, metodoSinPasarela, pasarelaDeMetodo, rotuloDeMetodo, COBROS_PASARELAS, diasDeDeudaCobro };
}
