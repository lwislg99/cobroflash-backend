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

var COBROS_MARCA = '[PENDIENTE microcopy oficial]';

/**
 * MICROCOPY APROBADA por el asesor el 10-ago-2026 (regla 30). Solo las cabeceras de la tabla
 * siguen con marcador: están pendientes de que vea cuáles son las cinco columnas.
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
  /** `n=1` → «1 día». Un cobro ya cobrado NO pinta esta etiqueta: nada, ni guion ni cero. */
  diasSinCobrar: function (n) {
    return 'Sin cobrar desde hace ' + n + (n === 1 ? ' día' : ' días');
  },
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
  // 🔴 LO ÚNICO QUE QUEDA CON MARCADOR. Las cinco columnas son, en orden: fecha · cliente ·
  // importe · método · documento y deuda. El asesor las aprueba cuando vea cuáles son; hasta
  // entonces no se les inventa nombre (regla 30).
  thead.innerHTML = '<tr>'
    + '<th>' + COBROS_MARCA + '</th>'
    + '<th>' + COBROS_MARCA + '</th>'
    + '<th style="text-align:right">' + COBROS_MARCA + '</th>'
    + '<th>' + COBROS_MARCA + '</th>'
    + '<th>' + COBROS_MARCA + '</th>'
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
      td0.colSpan = 5;
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
      var tdMetodo = document.createElement('td');
      tdMetodo.textContent = c.metodo || COBROS_COPY.metodoSinRegistrar;
      tr.appendChild(tdMetodo);

      // DOCUMENTO y DEUDA. El tipo lo dice `tipoDeFactura`, no una copia.
      var tdDoc = document.createElement('td');
      var clasifica = (typeof tipoDeFactura === 'function') ? tipoDeFactura : null;
      var partes = [];
      if (c.numero && clasifica) partes.push(clasifica({ number: c.numero, type: c.tipo }) + ' ' + c.numero);
      else if (c.numero) partes.push(c.numero);
      var dias = diasDeDeudaCobro(c, ahora);
      if (dias !== null) partes.push(COBROS_COPY.diasSinCobrar(dias));
      tdDoc.textContent = partes.join(' · ') || '—';
      tr.appendChild(tdDoc);

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
    td.colSpan = 5;
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
