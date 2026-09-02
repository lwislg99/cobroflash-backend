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
// ── MICROCOPY · 🔴 SIN MARCADOR EN PANTALLA (decisión del fundador, 2-sep-2026) ─────────────
// Esto CAMBIÓ. Los seis rótulos salían como `[PENDIENTE microcopy oficial] Todos`, y el fundador
// lo retiró con estas palabras: **«nada de marcadores en pantalla»**. La pantalla es de un
// profesional que paga; un corchete de proceso interno no es cosa suya.
//
// ⚠️ LO QUE NO CAMBIA: **los seis textos SIGUEN SIN APROBAR.** Lo que se retira es el marcador
// VISIBLE, no la aprobación. Son literales PROPUESTOS por la sesión, y su procedencia vive donde
// se puede leer sin abrir la pantalla: aquí, en `docs/master/SCRUM-581.md` y en el informe de
// entrega. Quitar el marcador y callar de dónde salen los textos habría sido convertir una
// propuesta en un hecho consumado por el camino.
//
// 📌 Y por eso la entrada de `filtroClientes.js` SALE del censo de SCRUM-402: ese censo cuenta
// marcadores, y aquí ya no hay ninguno. Se borra la entrada, no se baja a 0 — es la convención
// que dejaron escritas SCRUM-424 y SCRUM-405 en ese mismo fichero.
(function () {
  'use strict';

  /**
   * 🔴 CUÁNTAS RANURAS DE MICROCOPY SIGUEN SIN FIRMAR. **Cero: el fundador aprobó las seis el
   * 2-sep-2026.**
   *
   * Se queda en el fichero aunque valga 0, y a propósito: si mañana alguien añade una pestaña o
   * un orden nuevo, la ranura nace SIN APROBAR y este número tiene que subir. Borrarlo dejaría
   * el hueco sin sitio donde declararse, y el texto nuevo entraría en pantalla en silencio —
   * que es exactamente lo que el marcador impedía y lo que ya no se ve.
   */
  var SIN_APROBAR = 0;

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
   *
   * ✅ APROBADO por el fundador el 2-sep-2026. PROCEDENCIA: consta en `docs/master/SCRUM-581.md`
   * (sección «MICROCOPY APROBADA»). Una fecha sola no vale: no dice dónde mirar, y ése era el
   * defecto de las seis marcas que se contradijeron (SCRUM-387). Viene con una corrección suya
   * que vale la pena
   * dejar escrita: mi propuesta era «Ningún cliente clasificado así todavía», y **miente cuando
   * hay una búsqueda activa** — ahí el motivo de que no salga nadie no es la clasificación, es la
   * búsqueda. El texto aprobado no nombra la causa: dice lo que se ve y ofrece la salida.
   *
   * DOS LÍNEAS, que se pintan con el componente que ya existe (`.empty-state-title` y
   * `.empty-state-desc` de `styles.css`): ni un token nuevo ni un estilo inventado.
   */
  var VACIO_PESTANA = {
    palabra: 'Aquí no hay ningún cliente todavía.',
    ayuda: 'Marca cada cliente como empresa o persona al editarlo.',
  };

  /**
   * El rótulo visible: la palabra, y nada más. Sin marcador (ver el bloque de arriba).
   *
   * Sigue existiendo como función —en vez de leer `x.palabra` desde la vista— para que el día
   * que un texto se apruebe y otro no, la diferencia se resuelva en UN sitio y no en cada
   * `textContent` de `customersView.js`.
   */
  function etiqueta(x) { return String((x && x.palabra) || ''); }

  /**
   * La SEGUNDA línea, cuando la ranura la tiene. Hoy sólo el vacío de pestaña.
   *
   * Devuelve `''` —y no `undefined`— para que quien la pinte pueda hacerlo sin preguntar: un
   * `textContent = undefined` escribe la palabra «undefined» en la pantalla del profesional.
   */
  function subtitulo(x) { return String((x && x.ayuda) || ''); }

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
    SIN_APROBAR: SIN_APROBAR,
    PESTANAS: PESTANAS,
    ORDENES: ORDENES,
    POR_DEFECTO: POR_DEFECTO,
    VACIO_PESTANA: VACIO_PESTANA,
    etiqueta: etiqueta,
    subtitulo: subtitulo,
    filtrarPorPestana: filtrarPorPestana,
    ordenar: ordenar,
    aplicar: aplicar,
  };

  if (typeof window !== 'undefined') window.filtroClientes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
