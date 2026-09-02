// public/dashboard/js/filtroClientes.js — SCRUM-581 (CONT-08)
//
// PESTAÑAS Y ORDEN DE LA LISTA DE CLIENTES. Sólo la DECISIÓN, sin DOM: así se puede probar en
// `npm test` sin navegador, que es lo que hace falta porque los nueve guards de navegador NO
// cubren el dashboard (SCRUM-628).
//
// ── 🔴 EL NULL NO «ES» NADA, Y ESO ES TODO EL DISEÑO DE ESTE FICHERO ─────────────────────────
// El censo del PASO 0 midió **0 filas con `contact_kind` y 15 en NULL**. Decisión del asesor
// (1-sep-2026): **los NULL salen SÓLO en «Todos»**, sin tercera pestaña. «Empresas» y «Personas»
// nacen vacías y se llenan según se clasifiquen — el switch que las rellena ya existe y es
// alcanzable (`switchFormaJuridica.js`).
//
// Por eso el filtro compara con `===` y NO lleva ni un `||` ni un `??` para que una fila «caiga
// en algún sitio». Ese apaño es `resolveTipoDestinatario` otra vez, y costó 16 días de semáforo
// mintiendo (SCRUM-615). Una fila sin declarar no aparece en ninguna de las dos, y es correcto.
//
// 📌 CONSECUENCIA ASUMIDA Y VISIBLE: mientras haya NULLs, «Empresas» + «Personas» NO suma
// «Todos». Está decidido así. Explicarlo en pantalla, si se quiere, es microcopy del fundador.
//
// ── MICROCOPY (regla 30) ────────────────────────────────────────────────────────────────────
// Ninguna etiqueta está aprobada. Salen con el marcador oficial MÁS la palabra de trabajo, que es
// la forma que fija `switchFormaJuridica.js` y el motivo está escrito allí: `censo-marcadores.mjs`
// distingue el rótulo que SÓLO lleva la marca —que pinta a ciegas— del que lleva marca + texto,
// que al menos se puede leer y juzgar. **Con tres pestañas, el marcador solo las haría idénticas
// y la pantalla quedaría inservible**, que es exactamente el caso que ese comentario describe
// para un control de dos lados.
(function () {
  'use strict';

  // 🔴 LA ÚNICA CONSTANTE QUE APAGA LOS MARCADORES DE ESTE FICHERO. Cuando el fundador apruebe
  // los textos, se vacía aquí y se van los SEIS de golpe (3 pestañas + 2 órdenes + 1 vacío).
  //
  // ⚠️ Y hay que decirlo, que es el aviso de SCRUM-615: sus SEIS ranuras COMPARTEN esta constante.
  // El censo cuenta MARCAS, no rótulos — así que aprobar el texto de UNA pestaña no apaga las
  // otras cinco: habría que sacar esa `palabra` de aquí por separado.
  var MARCADOR = '[PENDIENTE microcopy oficial]';

  /**
   * Las tres pestañas. `valor` es lo que se compara contra `contactKind`, y `null` significa
   * «no se compara con nada»: «Todos» no filtra.
   */
  var PESTANAS = [
    { id: 'TODOS', valor: null, palabra: 'Todos' },
    { id: 'EMPRESA', valor: 'EMPRESA', palabra: 'Empresas' },
    { id: 'PERSONA', valor: 'PERSONA', palabra: 'Personas' },
  ];

  /**
   * Los dos órdenes. `RECIENTES` es el de HOY y es el DEFECTO: lo pone el servidor
   * (`listCustomers` → `orderBy: { createdAt: 'desc' }`) y aquí NO se toca — devolver la lista
   * tal cual es lo que hace que abrir la pantalla sin tocar nada enseñe exactamente lo de hoy.
   */
  var ORDENES = [
    { id: 'RECIENTES', palabra: 'Más recientes' },
    { id: 'AZ', palabra: 'Nombre A-Z' },
  ];

  var POR_DEFECTO = { pestana: 'TODOS', orden: 'RECIENTES' };

  /**
   * El vacío de una PESTAÑA, que no es el vacío de la pantalla. Hace falta porque hoy «Empresas»
   * y «Personas» salen vacías con clientes en la lista, y el vacío que ya existe dice «Añade a tu
   * primer cliente» — que ahí sería falso. El de la búsqueda tampoco vale: no se ha buscado nada.
   */
  var VACIO_PESTANA = { palabra: 'Ningún cliente clasificado así todavía' };

  /** El rótulo visible: marcador + palabra de trabajo. Ver el bloque de MICROCOPY de arriba. */
  function etiqueta(x) { return MARCADOR + ' ' + x.palabra; }

  /**
   * Filtra por pestaña. `TODOS` devuelve la lista TAL CUAL (misma referencia de elementos y mismo
   * orden): es el control negativo del ticket.
   *
   * 🔴 Comparación ESTRICTA contra el valor de la pestaña. Un `contactKind` NULL, `undefined` o
   * cualquier otra cosa no cae en «Empresas» ni en «Personas». Sin valores por defecto.
   */
  function filtrarPorPestana(clientes, pestanaId) {
    var lista = Array.isArray(clientes) ? clientes : [];
    var p = null;
    for (var i = 0; i < PESTANAS.length; i++) if (PESTANAS[i].id === pestanaId) p = PESTANAS[i];
    // Pestaña desconocida → se trata como «Todos». No se inventa un filtro que nadie pidió, y
    // enseñar de más aquí es visible; enseñar de menos escondería clientes en silencio.
    if (!p || p.valor === null) return lista.slice();
    return lista.filter(function (c) { return c && c.contactKind === p.valor; });
  }

  /**
   * Ordena. `RECIENTES` NO reordena: respeta lo que mandó el servidor.
   *
   * `AZ` usa `localeCompare` con locale `es` y `sensitivity: 'base'`, que es lo que pone
   * «Álvarez» junto a «alvarez» —donde el usuario los busca— en vez de donde los dejaría una
   * comparación binaria de códigos, que manda todas las mayúsculas delante y los acentos al final.
   * Se ordena una COPIA: `sort` muta, y mutar lo que llegó del servidor haría que el orden de hoy
   * dependiese de si alguien pulsó A-Z antes.
   */
  function ordenar(clientes, ordenId) {
    var lista = Array.isArray(clientes) ? clientes.slice() : [];
    if (ordenId !== 'AZ') return lista;
    return lista.sort(function (a, b) {
      var na = (a && a.name) || '';
      var nb = (b && b.name) || '';
      return na.localeCompare(nb, 'es', { sensitivity: 'base' });
    });
  }

  /** Lo que consume la vista: filtrar y luego ordenar. En ese orden, y no al revés. */
  function aplicar(clientes, pestanaId, ordenId) {
    return ordenar(filtrarPorPestana(clientes, pestanaId), ordenId);
  }

  var api = {
    MARCADOR: MARCADOR,
    PESTANAS: PESTANAS,
    ORDENES: ORDENES,
    POR_DEFECTO: POR_DEFECTO,
    VACIO_PESTANA: VACIO_PESTANA,
    etiqueta: etiqueta,
    filtrarPorPestana: filtrarPorPestana,
    ordenar: ordenar,
    aplicar: aplicar,
  };

  if (typeof window !== 'undefined') window.filtroClientes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
