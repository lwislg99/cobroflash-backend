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
  filtroSinMetodo: 'Método no registrado',
  metodoSinRegistrar: 'No registrado',
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

/** A qué cubo de filtro cae un cobro. `null` → «no consta». */
function cuboDeMetodo(metodo) {
  if (!metodo) return COBROS_SIN_METODO.clave;
  for (var i = 0; i < COBROS_METODOS.length; i++) {
    if (COBROS_METODOS[i].casa.indexOf(metodo) !== -1) return COBROS_METODOS[i].clave;
  }
  return COBROS_SIN_METODO.clave;
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

      // MÉTODO: el valor de la casa TAL CUAL, sin traducir. Traducirlo sería microcopy nueva, y
      // además `bizum_auto`/`bizum_manual` es la distinción que aquí SÍ se lee.
      //
      // `col-hide-mobile`: en la card no hay cabecera que lo explique (el `thead` se oculta a
      // ≤640px), y un `transfer` suelto no dice nada. Es el reparto de la casa — `invoicesView`
      // esconde cuatro y `quotesListView` dos por lo mismo.
      var tdMetodo = document.createElement('td');
      tdMetodo.className = 'col-hide-mobile';
      tdMetodo.textContent = c.metodo || COBROS_COPY.metodoSinRegistrar;
      tr.appendChild(tdMetodo);

      // DOCUMENTO. El tipo lo dice `tipoDeFactura`, no una copia.
      var tdDoc = document.createElement('td');
      tdDoc.className = 'cell-id'; // en la card: arriba, pequeño y apagado — es lo que es
      var clasifica = (typeof tipoDeFactura === 'function') ? tipoDeFactura : null;
      if (c.numero && clasifica) tdDoc.textContent = clasifica({ number: c.numero, type: c.tipo }) + ' ' + c.numero;
      else tdDoc.textContent = c.numero || '—';
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

  apiRequest('/admin/cobros').then(function (r) {
    datos = Array.isArray(r) ? r : [];
    pintarFilas();
  }).catch(function () {
    tbody.innerHTML = '';
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = COBROS_COPY.errorCarga;
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
}

if (typeof window !== 'undefined') {
  window.renderCobrosView = renderCobrosView;
  window.COBROS_COPY = COBROS_COPY;
  window.COBROS_METODOS = COBROS_METODOS;
  window.COBROS_SIN_METODO = COBROS_SIN_METODO;
  window.cuboDeMetodo = cuboDeMetodo;
  window.diasDeDeudaCobro = diasDeDeudaCobro;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderCobrosView, COBROS_COPY, COBROS_METODOS, COBROS_SIN_METODO, cuboDeMetodo, diasDeDeudaCobro };
}
