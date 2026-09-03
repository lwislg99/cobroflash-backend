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
   * 🔴 CUÁNTAS RANURAS DE MICROCOPY SIGUEN SIN LA FIRMA DEL FUNDADOR.
   *
   * Las SEIS de SCRUM-581 las firmó él el 2-sep-2026. Las CUATRO de SCRUM-580 (CONT-07) las
   * aprobó el ASESOR ese mismo día, **provisionalmente y a la espera del fundador** — así que
   * cuentan aquí. Por eso este número existía aunque valiera 0: para que una ranura nueva no
   * entrara en pantalla sin que nadie declarara su estado.
   *
   * Se queda en el fichero aunque valga 0, y a propósito: si mañana alguien añade una pestaña o
   * un orden nuevo, la ranura nace SIN APROBAR y este número tiene que subir. Borrarlo dejaría
   * el hueco sin sitio donde declararse, y el texto nuevo entraría en pantalla en silencio —
   * que es exactamente lo que el marcador impedía y lo que ya no se ve.
   */
  var SIN_APROBAR = 5; // SCRUM-584: +1, el rotulo del selector de columnas

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

  // SCRUM-580 (CONT-07) · el filtro por ETIQUETA. `null` = «no se filtra por ninguna», que NO
  // es «filtrar por la etiqueta vacía»: son cosas distintas y aquí sólo existe la primera.
  var POR_DEFECTO = { pestana: 'TODOS', orden: 'RECIENTES', etiqueta: null };

  /**
   * SCRUM-580 (CONT-07) · LOS CUATRO TEXTOS DE LAS ETIQUETAS, en un solo sitio.
   *
   * ✅ APROBADOS por el ASESOR el 2-sep-2026, **provisionales a la espera del fundador**.
   * PROCEDENCIA: `docs/master/SCRUM-580.md`, sección de microcopy. Sin decir DÓNDE consta,
   * «aprobado» es una afirmación que nadie puede comprobar (SCRUM-387).
   *
   * Viven aquí y no repartidos por `customersView.js` para que se puedan fijar con `===` desde un
   * solo test: un texto suelto en cada `textContent` deriva sin que nada chille.
   *
   * ⚠️ SIN MARCADOR en pantalla (decisión del 2-sep-2026). Que no se pinte el corchete NO
   * significa que estén firmados por el fundador: eso lo dice `SIN_APROBAR`, arriba.
   */
  var TEXTOS_ETIQUETAS = {
    rotulo: 'Etiquetas',
    placeholder: 'comunidad, administrador, urgencias…',
    columna: 'Etiquetas',
    sinFiltro: 'Todas las etiquetas',
  };

  /**
   * 🔴 SCRUM-580 · LAS ETIQUETAS DE UN CLIENTE, CON SUELO.
   *
   * La columna es JSONB, así que puede traer cualquier cosa por otra vía. Lo que no sea una lista
   * de cadenas devuelve `[]` y no revienta: una pantalla que se cae al pintar un cliente es peor
   * que una que enseña ese cliente sin etiquetas.
   *
   * ⚠️ Esto es la MISMA decisión que `tagsDe` en `src/modules/system/tagsDelCliente.ts`. Son dos
   * copias —una por lado— y no divergen porque un test las ejercita con los mismos casos. La copia
   * es el precio de que la lista filtre sin ir al servidor en cada pulsación.
   */
  function tagsDe(c) {
    var v = c && c.tags;
    if (!Array.isArray(v)) return [];
    var fuera = [];
    for (var i = 0; i < v.length; i++) {
      if (typeof v[i] === 'string' && v[i].trim() !== '') fuera.push(v[i]);
    }
    return fuera;
  }

  /** Comparación sin distinguir mayúsculas: «Moroso» y «moroso» son la misma para el profesional. */
  function mismaEtiqueta(a, b) {
    return String(a).trim().toLocaleLowerCase('es') === String(b).trim().toLocaleLowerCase('es');
  }

  /**
   * Las etiquetas que este merchant YA usa, sacadas de la lista que el servidor le mandó.
   *
   * 🔴 Nunca de otro merchant, y no hace falta filtrar por tenencia aquí: lo que entra es lo que el
   * servidor ya acotó (regla 2). No ampliar el alcance es la forma más segura de no filtrarlo.
   */
  function etiquetasUsadas(clientes) {
    var vistas = {};
    var fuera = [];
    var lista = Array.isArray(clientes) ? clientes : [];
    for (var i = 0; i < lista.length; i++) {
      var ts = tagsDe(lista[i]);
      for (var j = 0; j < ts.length; j++) {
        var clave = ts[j].trim().toLocaleLowerCase('es');
        if (!vistas[clave]) { vistas[clave] = true; fuera.push(ts[j].trim()); }
      }
    }
    return fuera.sort(function (a, b) { return a.localeCompare(b, 'es', { sensitivity: 'base' }); });
  }

  /**
   * Filtra por etiqueta. `null` o vacío devuelve la lista TAL CUAL: no filtrar no es filtrar por
   * nada, y esa distinción es la que hace que «Todas» siga siendo el control negativo del ticket.
   *
   * 🔴 Un cliente SIN etiquetas no cae en ninguna, y es correcto. El apaño de «si no tiene, que
   * salga en todas» convierte el filtro en un adorno — y es la misma familia del valor por defecto
   * que borra la diferencia entre «no lo sé» y «sé que no hay».
   */
  function filtrarPorEtiqueta(clientes, etiqueta) {
    var lista = Array.isArray(clientes) ? clientes : [];
    if (etiqueta === null || etiqueta === undefined || String(etiqueta).trim() === '') return lista.slice();
    return lista.filter(function (c) {
      var ts = tagsDe(c);
      for (var i = 0; i < ts.length; i++) if (mismaEtiqueta(ts[i], etiqueta)) return true;
      return false;
    });
  }

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

  /**
   * Lo que consume la vista: filtrar por pestaña, filtrar por etiqueta y ORDENAR. En ese orden.
   *
   * 🔴 Los dos filtros se ENCADENAN, no se sustituyen — y el buscador de texto es un tercero que
   * ya viene aplicado desde el servidor, porque `clientes` es el lote que él devolvió. O sea que
   * los TRES se combinan por construcción; que sigan combinándose lo sostiene un test, porque «por
   * construcción» deja de ser cierto el día que alguien reordena dos líneas.
   *
   * `etiqueta` es opcional: quien llame con dos argumentos sigue teniendo el comportamiento de
   * antes, que es lo que hace que este cambio no rompa a nadie.
   */
  function aplicar(clientes, pestanaId, ordenId, etiqueta) {
    return ordenar(filtrarPorEtiqueta(filtrarPorPestana(clientes, pestanaId), etiqueta), ordenId);
  }


  /**
   * ═══════════════════════════════════════════════════════════════════════════════════════
   * SCRUM-584 (CONT-11) · QUÉ COLUMNAS SE VEN. La decisión, sin DOM.
   *
   * 🔴 EL SELECTOR ES PARA AÑADIR, NO PARA QUITAR — y eso salió de MEDIR, no del encargo. A
   * 360 px NO hay scroll horizontal (343 = 343 medido): la tabla no es una tabla, es una pila
   * de tarjetas (`table--stack-mobile`, `thead` en `display:none`). Lo que pasa es lo
   * contrario: el CSS oculta cuatro columnas con `col-hide-mobile` y **nadie puede
   * encenderlas**. El profesional que vive del email o de las notas no los ve en el móvil y no
   * tiene forma de pedirlos.
   *
   * ⚠️ El coste de encender es VERTICAL y lo asume quien enciende: la fila pasa de 153 px a
   * 222 px con las cuatro encendidas (medido a 360 px). Por eso se puede deshacer.
   *
   * ── UN SOLO MECANISMO PARA MÓVIL Y ESCRITORIO ─────────────────────────────────────────
   * No hay dos listas. Hay UNA preferencia —qué columnas ha ENCENDIDO el profesional— y una
   * regla: una columna encendida pierde `col-hide-mobile`, así que se ve también en la
   * tarjeta. En escritorio se seguían viendo todas y se siguen viendo.
   *
   * ── POR DEFECTO, LO DE HOY ────────────────────────────────────────────────────────────
   * Con la preferencia VACÍA esto devuelve exactamente las clases de hoy. Nadie se encuentra
   * la pantalla cambiada sin pedirlo, y por eso el valor por defecto no es «todas».
   *
   * ── SIN SALIDA MUERTA, POR CONSTRUCCIÓN ───────────────────────────────────────────────
   * `Nombre` y las acciones son FIJAS: no se pueden apagar. Así que apagarlo todo es
   * imposible y la lista nunca queda inservible — no hace falta un mínimo artificial que
   * alguien tenga que recordar. Un control que te deja sin pantalla es peor que no tenerlo.
   *
   * 🔴 Y EL TELÉFONO NACE VISIBLE SIEMPRE (F1). Es ocultable —lo decide el profesional— pero
   * nunca por defecto: es donde YaQu gana a Holded, que ni lo tiene como columna.
   * ═══════════════════════════════════════════════════════════════════════════════════════
   */
  /**
   * SCRUM-584 (CONT-11) · EL TEXTO DEL CONTROL. UNO, y es la única palabra nueva del ticket.
   *
   * Los NOMBRES de las columnas —ID, Nombre, Teléfono, Email, Notas, Etiquetas, Alta— NO son
   * microcopy nuevo: ya están en pantalla hoy, en la cabecera de la tabla. Lo único que este
   * ticket estrena es el rótulo del control, así que sólo eso cuenta en SIN_APROBAR.
   *
   * ⚠️ SIN MARCADOR en pantalla, como el resto de este fichero. Que no se pinte el corchete NO
   * significa que esté firmado: eso lo dice SIN_APROBAR.
   */
  var TEXTOS_COLUMNAS = { control: 'Columnas' };
  var COLUMNAS = [
    { id: 'id', texto: 'ID', fija: false, ocultaEnMovil: false },
    { id: 'nombre', texto: 'Nombre', fija: true, ocultaEnMovil: false },
    { id: 'telefono', texto: 'Teléfono', fija: false, ocultaEnMovil: false },
    { id: 'email', texto: 'Email', fija: false, ocultaEnMovil: true },
    { id: 'notas', texto: 'Notas', fija: false, ocultaEnMovil: true },
    { id: 'etiquetas', texto: TEXTOS_ETIQUETAS.columna, fija: false, ocultaEnMovil: true },
    { id: 'alta', texto: 'Alta', fija: false, ocultaEnMovil: true },
    { id: 'acciones', texto: '', fija: true, ocultaEnMovil: false },
  ];

  /** Las que el profesional puede tocar. Las fijas no salen en el control. */
  function columnasElegibles() {
    return COLUMNAS.filter(function (c) { return !c.fija; });
  }

  /**
   * Normaliza lo que venga guardado. Basura → preferencia VACÍA, que es «lo de hoy».
   *
   * 🔴 SUELO: `localStorage` lo puede escribir cualquiera y sobrevive a los despliegues. Un id
   * que ya no existe —una columna retirada— se descarta en vez de romper la tabla. Y si lo
   * guardado no es una lista, no se adivina: se vuelve al comportamiento de hoy.
   */
  function normalizarColumnas(guardado) {
    if (!Array.isArray(guardado)) return [];
    var validos = COLUMNAS.map(function (c) { return c.id; });
    var vistos = {};
    return guardado.filter(function (id) {
      if (typeof id !== 'string' || validos.indexOf(id) < 0 || vistos[id]) return false;
      vistos[id] = true;
      return true;
    });
  }

  /**
   * ¿Se PINTA esta columna? Siempre sí: la tabla se monta entera y lo que cambia es si el CSS
   * la esconde en móvil. Se deja explícito para que quien lea sepa que aquí no se borran
   * columnas del DOM — borrarlas descuadraría el `colSpan` de las filas vacías.
   */
  function columnasDeLaTabla() { return COLUMNAS; }

  /**
   * La CLASE de una columna dada la preferencia. Es la única regla que traduce «encendida» a
   * lo que ve el navegador.
   *
   *   fija o no oculta en móvil → sin clase (se ve siempre, como hoy)
   *   oculta y NO encendida ..... → `col-hide-mobile` (lo de hoy)
   *   oculta y ENCENDIDA ........ → sin clase: aparece también en la tarjeta
   */
  function claseDeColumna(id, encendidas) {
    var col = COLUMNAS.filter(function (c) { return c.id === id; })[0];
    if (!col || !col.ocultaEnMovil) return '';
    return normalizarColumnas(encendidas).indexOf(id) >= 0 ? '' : 'col-hide-mobile';
  }

  /**
   * Cuántas columnas ocupa una fila vacía.
   *
   * 🔴 SALE DE LA MISMA LISTA QUE LA CABECERA, y ése es el ticket. Hoy hay dos `colSpan = 8`
   * escritos a mano, y otra sesión los tuvo que recalcular al entrar «Etiquetas»: un número
   * copiado envejece en silencio y **un vacío descuadrado no lo ve ninguna tanda**.
   */
  function colSpanDeLaTabla() { return COLUMNAS.length; }

  var api = {
    SIN_APROBAR: SIN_APROBAR,
    PESTANAS: PESTANAS,
    ORDENES: ORDENES,
    POR_DEFECTO: POR_DEFECTO,
    VACIO_PESTANA: VACIO_PESTANA,
    etiqueta: etiqueta,
    subtitulo: subtitulo,
    filtrarPorPestana: filtrarPorPestana,
    filtrarPorEtiqueta: filtrarPorEtiqueta,
    etiquetasUsadas: etiquetasUsadas,
    TEXTOS_ETIQUETAS: TEXTOS_ETIQUETAS,
    TEXTOS_COLUMNAS: TEXTOS_COLUMNAS,
    COLUMNAS: COLUMNAS,
    columnasElegibles: columnasElegibles,
    normalizarColumnas: normalizarColumnas,
    columnasDeLaTabla: columnasDeLaTabla,
    claseDeColumna: claseDeColumna,
    colSpanDeLaTabla: colSpanDeLaTabla,
    tagsDe: tagsDe,
    ordenar: ordenar,
    aplicar: aplicar,
  };

  if (typeof window !== 'undefined') window.filtroClientes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
