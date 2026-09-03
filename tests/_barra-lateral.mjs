// tests/_barra-lateral.mjs — SCRUM-420 (B1 · incremento 2)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS TRES POBLACIONES SE DERIVAN, NINGUNA SE ESCRIBE A MANO
//
//   1. lo que el DISEÑO propone  →  `docs/diseno/bloque-b.md` §B1, del bloque cercado
//   2. lo que la BARRA tiene     →  `public/dashboard/index.html`, del `<nav class="sidebar-nav">`
//   3. lo que el ROUTER conoce   →  `public/dashboard/js/app.js`, de los `case` de `renderView`
//
// Una lista a mano de cualquiera de las tres convertiría este guard en «comprueba lo que escribí»,
// que es el fallo que B1 lleva arrastrando: `SCRUM-284.md:416` declaró el hueco de la sidebar, el
// ticket se cerró, y el hueco dejó de estar en ninguna lista porque no había nada que lo derivara.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ENUMERA, NO CUENTA — y esto no es preferencia de estilo
//
// El contraste de SCRUM-411 sobre el bloque G dio los NUEVE bloques que pedía la maqueta y aun así
// uno no era el que el diseño pedía: la cuenta cuadraba y la composición no. Un guard que compara
// longitudes habría salido verde. Por eso aquí se devuelven **faltan** y **sobran** con nombre, y
// un número que coincide no prueba nada por sí solo.
import fs from 'node:fs';

/** Sin acentos, sin mayúsculas, sin adornos. Para casar «Configuración ▸» con «configuracion». */
export function normalizar(texto) {
  return String(texto)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[▸›»]/g, '')
    .trim().toLowerCase();
}

/**
 * ① EL DISEÑO. Del bloque cercado que sigue a «## Lo que proponemos» en `bloque-b.md` §B1.
 *
 * El formato lo pone el diseño, no yo: los GRUPOS van sin sangrar (`VENTA`) o son el literal
 * `(sin rótulo)`; las ENTRADAS van sangradas. El `← comentario` de la derecha se descarta: es
 * la explicación del asesor, no parte del rótulo.
 */
export function entradasDelDiseno(ruta) {
  const md = fs.readFileSync(ruta, 'utf8');
  const desde = md.indexOf('## Lo que proponemos');
  if (desde === -1) throw new Error('[barra] no encuentro «## Lo que proponemos» en el diseño');
  const cerca = md.slice(desde).match(/```([^]*?)```/);
  if (!cerca) throw new Error('[barra] no encuentro el bloque cercado de «Lo que proponemos»');

  const grupos = [];
  const entradas = [];
  let grupoActual = null;
  for (const linea of cerca[1].split('\n')) {
    if (!linea.trim()) continue;
    const sangrada = /^\s{2,}/.test(linea);
    const texto = linea.split('←')[0].trim();
    if (!texto) continue;
    if (!sangrada) { grupoActual = texto; grupos.push(texto); continue; }
    entradas.push({ rotulo: texto, grupo: grupoActual });
  }
  return { entradas, grupos };
}

/**
 * ② LA BARRA. Del `<nav class="sidebar-nav">` de `dashboard/index.html`.
 *
 * Se recorre en ORDEN, para que el grupo de cada entrada salga de dónde está y no de una tabla:
 * un `nav-section-label` abre grupo y todo lo que va detrás le pertenece.
 *
 * ⚠️ Se lee con expresiones sobre el marcado, no con un AST: no hay parser de HTML en el proyecto
 * y traerlo sería dependencia nueva (regla 36). El límite es real y por eso el SUELO existe: si el
 * recorrido se rompiera devolvería una lista corta, que se lee igual que «la barra está mal».
 */
export function entradasDeLaBarra(rutaHtml) {
  const html = fs.readFileSync(rutaHtml, 'utf8');
  const nav = html.match(/<nav class="sidebar-nav">([^]*?)<\/nav>/);
  if (!nav) throw new Error('[barra] no encuentro <nav class="sidebar-nav"> en index.html');

  const entradas = [];
  const grupos = [];
  let grupoActual = '(sin rótulo)';
  const token = /<div class="nav-section-label">([^<]*)<\/div>|<button[^>]*class="([^"]*)"[^>]*data-view="([^"]*)"[^>]*>([^]*?)<\/button>/g;
  let m;
  while ((m = token.exec(nav[1])) !== null) {
    if (m[1] !== undefined) { grupoActual = m[1].trim(); grupos.push(grupoActual); continue; }
    const clases = m[2] || '';
    const vista = m[3];
    // El rótulo es el primer `<span>` que no sea insignia ni chevron; si el botón no lleva span,
    // su propio texto (los subitems se escriben así).
    const cuerpo = m[4];
    const spans = [...cuerpo.matchAll(/<span(?![^>]*class="nav-badge")[^>]*>([^<]*)<\/span>/g)]
      .map((s) => s[1].trim()).filter(Boolean);
    const rotulo = spans[0] ?? cuerpo.replace(/<[^>]*>/g, '').trim();
    entradas.push({ vista, rotulo, grupo: grupoActual, esSubitem: /nav-subitem/.test(clases) });
  }
  return { entradas, grupos };
}

/**
 * ③ EL ROUTER. Los `case '<vista>':` del `switch (view)` de `renderView` en `app.js`.
 *
 * Es la única fuente que dice si una pantalla EXISTE. Escribirla a mano haría que este guard
 * comprobara mi lista contra mi lista.
 */
export function vistasDelRouter(rutaApp) {
  const js = fs.readFileSync(rutaApp, 'utf8');
  return new Set([...js.matchAll(/case\s+'([a-z0-9-]+)'\s*:/g)].map((m) => m[1]));
}

/**
 * EL CRUCE rótulo del diseño → vista del router. Es la ÚNICA pieza escrita a mano, y tiene que
 * serlo: el diseño habla en castellano de producto y el router en claves de vista. Nadie puede
 * derivar que «Solicitudes» es `quote-requests`.
 *
 * Lo que la protege de convertirse en la lista blanca de siempre: si una entrada del diseño no
 * está aquí, el test **no la ignora** — sale como no traducible y falla. Un cruce incompleto es
 * ruidoso, no mudo.
 */
export const VISTA_POR_ROTULO = {
  inicio: 'home',
  solicitudes: 'quote-requests',
  trabajos: 'jobs',
  presupuestos: 'quotes-list', // el grupo abre en su historial
  albaranes: 'albaranes',
  facturas: 'invoices',
  cobros: 'cobros',            // SCRUM-285 (B4): ya existe, con su pantalla y su entrada.
  clientes: 'customers',
  productos: 'products',
  proveedores: 'providers',
  gastos: 'expenses',
  informes: 'reports',
  equipo: 'team',
  planes: 'plans',
  configuracion: 'settings',
};

/**
 * AUSENCIAS CONOCIDAS — entradas del diseño que HOY no están en la barra, con el ticket ABIERTO
 * que las va a poner.
 *
 * 🔴 EL TICKET ES OBLIGATORIO, y es la lección de este mismo ticket. El hueco de la sidebar estaba
 * anotado en `docs/master/SCRUM-284.md:416`, SCRUM-284 se cerró, y **un hueco anotado en un ticket
 * cerrado es un hueco perdido**: pasó semanas sin estar en ninguna lista. Una ausencia sin ticket
 * abierto no es una ausencia declarada, es una que todavía no se ha notado.
 */
export const AUSENCIAS_CONOCIDAS = {
  // ⚠️ VACÍO A PROPÓSITO. `cobros` estuvo aquí desde SCRUM-420 —su pantalla no existía— y salió
  // con SCRUM-285, que la construyó y puso la entrada en el mismo commit.
  //
  // Una ausencia declarada sobre algo que YA ESTÁ es peor que no declararla: el guard afirmaría
  // que falta lo que ya está en su sitio, y la próxima sesión lo leería como trabajo pendiente.
  // Que hoy esté vacío no lo desactiva — el test exige que toda ausencia lleve ticket, así que la
  // siguiente que se declare tendrá que traerlo.
};

/**
 * ENTRADAS QUE LA BARRA TIENE Y EL DISEÑO NO LISTA. **El otro lado del enunciado.**
 *
 * 🔴 Sin esta lista el guard solo miraría lo que FALTA, y ése es exactamente el fallo que dejó
 * pasar lo de `NOTAS INTERNAS` en el bloque G (SCRUM-411, 3ª entrega): la cuenta de bloques
 * cuadraba y la composición no. Lo que sobra también hay que declararlo, o el diseño y la pantalla
 * se separan por el lado que nadie mira.
 */
export const ANADIDAS_DECLARADAS = {
  'libro-registro': {
    ticket: null,
    motivo:
      'El diseño de B1 es del 5-ago y el Libro de registro llegó después, con A6 (SCRUM-296): no ' +
      'está en la lista porque no existía cuando se escribió. Grupo NEGOCIO y rótulo «Libro de ' +
      'registro» los decide el asesor el 10-ago-2026 — y aprueba el RÓTULO DE NAVEGACIÓN, no copy ' +
      'de VeriFactu: lo que se pinte dentro sigue bajo la regla 26 y sale del guion H2.',
  },
};

/**
 * VISTAS SIN ENTRADA DE BARRA, a propósito. Dos clases, y las dos con su motivo:
 *   · las de DETALLE, a las que se llega desde su listado (no son secciones);
 *   · las excepciones de producto, que llevan TICKET.
 */
export const VISTAS_SIN_ENTRADA = {
  'quotes-detail': { motivo: 'detalle: se llega desde el listado de presupuestos' },
  // Sprint Tecnosel · NO es un detalle: es una sección, y su sitio ES la barra. Está fuera por
  // una razón concreta y temporal: su rótulo no está aprobado (regla 30) y el guard ④ de este
  // mismo fichero prohíbe —con razón— un marcador en lo primero que el profesional ve cada día.
  // Se entra desde Trabajos mientras tanto. Cuando el fundador firme el texto, esta línea SE
  // BORRA y la entrada sube a la barra. Propuesta: docs/master/SCRUM-685.md.
  'partes-oficina': { motivo: 'sección: se entra desde Trabajos hasta que su rótulo esté aprobado' },
  'albaran-detail': { motivo: 'detalle: se llega desde el listado de albaranes' },
  'invoice-detail': { motivo: 'detalle: se llega desde el listado de facturas' },
  'jobs-detail': { motivo: 'detalle: se llega desde el listado de trabajos' },
  'customer-360': { motivo: 'detalle: la ficha de un cliente, se llega desde el listado de clientes' },
  'quotes-new': { motivo: 'es subitem del grupo Presupuestos, no entrada de primer nivel' },
  export: {
    ticket: 'SCRUM-420',
    motivo:
      'SALE de la barra por el diseño §B1 («pasa a Configuración › Tus datos»). Sigue alcanzable ' +
      'desde `renderDescargarDatosCard`, y hay un test que lo exige: retirarla de la barra sin ' +
      'camino nuevo sería perder la pantalla, no reordenarla.',
  },
  templates: {
    ticket: 'SCRUM-432',
    motivo:
      'Ya NO es entrada de menú: es la pestaña «Plantillas» dentro de Presupuestos, que es lo que ' +
      'pide el diseño §B1 («se usa desde ahí y solo desde ahí»). Sigue alcanzable desde ' +
      '`quotesTabs.js`, que pinta la tira en las dos vistas, y por `#templates` en `HASH_VIEWS`. ' +
      'La pestaña y la retirada entraron en el mismo commit: en medio la vista no tenía camino.',
  },
  operarios: {
    ticket: 'SCRUM-433',
    motivo:
      'Quedó sin entrada al absorberse en Equipo (SCRUM-136) y la vista sigue en el router. Es ' +
      'excepción CONOCIDA, no decidida aquí: la mide y la resuelve SCRUM-433. Se declara citando ' +
      'su ticket porque una excepción sin ticket deja de ser excepción y pasa a ser el ' +
      'comportamiento.',
  },
};
