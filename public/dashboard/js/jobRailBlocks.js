// public/dashboard/js/jobRailBlocks.js — SCRUM-318 (G3)
//
// EL CONTENIDO DEL RAIL DEL TRABAJO. G1 dejó los cinco bloques declarados y la rejilla montada;
// esto los llena.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ SON FUNCIONES PURAS Y NO DOM
//
// El ticket exige probar que **el `href` del mapa se construye con el MISMO dato que se pinta**.
// Con el enlace armado dentro del render, esa prueba obliga a montar un navegador y acaba siendo
// una que nadie ejecuta. Aquí cada bloque devuelve DATOS —texto y enlace juntos, de una sola
// variable— y la vista solo los pinta: el test compara los dos campos y no hay forma de que
// diverjan sin que salte.
//
// LA REGLA DEL HUECO (la misma de D4, G5 y del rail de G1): **o está el dato, o no está el
// bloque.** Nada de «—», ni «Sin datos», ni un bloque con el título y el cuerpo vacío. Un
// constructor sin dato devuelve `null` y desaparece.

// Rótulos APROBADOS por el fundador (regla 30): CLIENTE · DÓNDE · DINERO · PRESUPUESTO ·
// RESPONSABLE. Los que NO están aprobados llevan marcador — ver `MARCA_MICRO` abajo.
const JOB_RAIL_TITULOS = {
  cliente: 'CLIENTE',
  donde: 'DÓNDE',
  dinero: 'DINERO',
  presupuesto: 'PRESUPUESTO',
  responsable: 'RESPONSABLE',
};

// El marcador de microcopy sin aprobar. `abrir en mapa` no está en la lista aprobada, así que sale
// con marcador. Hoy no llega a pintarse nunca (ver `bloqueDonde`), pero el texto vive en el código
// y la regla 30 aplica al código, no a lo que se ve.
const MARCA_MICRO_RAIL = (typeof window !== 'undefined' && window.MICROCOPY_PENDIENTE) || '[PENDIENTE microcopy oficial]';

const limpio = (v) => (v == null ? '' : String(v).trim());

/**
 * CLIENTE — nombre y teléfono PULSABLE.
 *
 * «📞 34600000000» como texto plano es un número que hay que copiar a mano con las manos sucias;
 * pulsable es una llamada. El teléfono es opcional: sin él se pinta el bloque con el nombre solo,
 * no una línea de teléfono vacía.
 */
function bloqueCliente(job) {
  const nombre = limpio(job && job.customer && job.customer.name);
  const telefono = limpio(job && job.customer && job.customer.phone);
  if (!nombre && !telefono) return null;

  const lineas = [];
  if (nombre) lineas.push({ texto: nombre, fuerte: true });
  if (telefono) {
    // `tel:` y `wa.me` se construyen del MISMO teléfono que se pinta, normalizado igual en los dos.
    const marcable = telefono.replace(/\s+/g, '');
    lineas.push({ texto: telefono, icono: '📞', href: `tel:${marcable}` });
    lineas.push({ texto: 'WhatsApp', icono: '💬', href: `https://wa.me/${marcable}` });
  }
  return { id: 'cliente', titulo: JOB_RAIL_TITULOS.cliente, lineas };
}

/**
 * DÓNDE — la dirección de la OBRA y el enlace a mapa.
 *
 * ⚠️ HOY NO SE PINTA NUNCA, y no es un fallo de este código: **`Job.direccion` es campo propio y
 * nadie lo escribe**. Medido — en todo el repo no hay un solo `create`/`update` que lo rellene; la
 * única aparición fuera de un `select` es una lectura, y el propio schema lo dice: «direccion sin
 * fuente hoy (ni Quote ni Customer la tienen)».
 *
 * ⚠️ Y NO SE RELLENA CON LA DEL CLIENTE. Primero porque el `Customer` **no tiene** dirección
 * (medido: ni `address`, ni `city`, ni `postal`). Y segundo porque, aunque la tuviera, sería la
 * fiscal y no la de la obra: **un enlace a mapa que lleva al sitio equivocado es peor que no
 * tenerlo, porque el que no existe no se sigue.**
 *
 * El código se queda escrito y probado: el día que alguien escriba `direccion`, el bloque aparece
 * solo y con el enlace correcto.
 */
function bloqueDonde(job) {
  const direccion = limpio(job && job.direccion);
  if (!direccion) return null; // sin dato → sin bloque → sin enlace a mapa

  // UNA sola variable para lo que se lee y para adonde se conduce. Si un día se pintara un texto y
  // se enlazara otro, el usuario leería una cosa y conduciría a otra.
  return {
    id: 'donde',
    titulo: JOB_RAIL_TITULOS.donde,
    lineas: [{ texto: direccion }],
    enlace: {
      texto: MARCA_MICRO_RAIL,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`,
      desde: direccion, // el dato del que sale el href, para que el guard lo compare con lo pintado
    },
  };
}

/**
 * DINERO — cobrado y pendiente.
 *
 * `Aceptado` NO se repite aquí: ya es el titular del cuerpo, a 2,2 rem. El mismo número dos veces
 * en la misma pantalla no informa, y en una columna de 220 px compite con lo que sí es nuevo.
 *
 * Una línea se pinta solo si tiene dato, y el bloque solo si le queda alguna. `Pendiente` exige
 * además un importe de referencia (`aceptado > 0`): sin él no hay nada contra lo que estar
 * pendiente, y afirmarlo es el defecto que SCRUM-363 arregló en el chip de cobro.
 */
/*
 * SCRUM-319 (G4) añade los JUSTIFICANTES DE COBRO, que salen de la pila de documentos y aterrizan
 * aquí enlazados. Es el criterio de B4 aplicado a esta pantalla: un justificante y una factura son
 * dos documentos con significados legales distintos, y ordenarlos juntos por fecha los presenta
 * como si fueran lo mismo. El justificante es la prueba de un cobro, así que vive con el dinero.
 *
 * ⚠️ Solo el JUSTIFICANTE. Las facturas y las rectificativas NO entran: mandarlas aquí sería
 * cometer el mismo error de B4 en dirección contraria. Se quedan en su sección hasta que el
 * fundador decida (SCRUM-319, hallazgo).
 */
function bloqueDinero(job, fmt) {
  const aceptado = Number((job && job.totalAceptado) || 0);
  const cobrado = Number((job && job.totalCobrado) || 0);
  const moneda = (job && job.quote && job.quote.currency) || 'EUR';

  const lineas = [];
  if (cobrado > 0) lineas.push({ etiqueta: 'Cobrado', texto: fmt(cobrado, moneda) });
  if (aceptado > 0) lineas.push({ etiqueta: 'Pendiente', texto: fmt(Math.max(0, aceptado - cobrado), moneda) });

  // Se clasifican con `tipoDeFactura`, la MISMA condición que usa la pila para repartir: si aquí
  // se repitiera el `startsWith('J-')` a mano, un cambio en una de las dos copias mandaría el
  // mismo documento a dos sitios, o a ninguno.
  const clasifica = (typeof tipoDeFactura === 'function')
    ? tipoDeFactura
    : (typeof require === 'function' ? require('./jobDocsReparto.js').tipoDeFactura : null);
  const invoices = Array.isArray(job && job.invoices) ? job.invoices : [];
  if (clasifica) {
    for (const inv of invoices) {
      if (clasifica(inv) !== 'justificante') continue;
      lineas.push({ texto: String(inv.number || ''), invoiceId: inv.id, icono: '🧾' });
    }
  }

  if (!lineas.length) return null;
  return { id: 'dinero', titulo: JOB_RAIL_TITULOS.dinero, lineas };
}

/**
 * PRESUPUESTO — el de origen, como atajo. La FILA del documento sigue en DOCUMENTOS (es de G4):
 * esto es el acceso rápido desde el contexto, no una segunda copia del documento.
 */
function bloquePresupuesto(job, fechaCorta) {
  const q = job && job.quote;
  if (!q || q.id == null) return null;
  const num = q.number != null ? `#${q.number}` : '';
  const fecha = fechaCorta ? limpio(fechaCorta(job.createdAt)) : '';
  const texto = [num, fecha].filter(Boolean).join(' · ');
  if (!texto) return null;
  return { id: 'presupuesto', titulo: JOB_RAIL_TITULOS.presupuesto, lineas: [{ texto, quoteId: q.id }] };
}

/**
 * RESPONSABLE — quién lleva este Trabajo. Sube de la cabecera VERBATIM, con su misma resolución:
 * el operario si lo hay, y si no el nombre del negocio.
 */
function bloqueResponsable(nombre) {
  const n = limpio(nombre);
  if (!n) return null;
  return { id: 'responsable', titulo: JOB_RAIL_TITULOS.responsable, lineas: [{ texto: n, fuerte: true }] };
}

/**
 * Los cinco bloques, EN EL ORDEN del diseño. Los que no tienen dato salen como `null` y se filtran
 * en el render; devolverlos aquí y no antes deja que el guard vea cuáles se cayeron y por qué.
 */
function construirBloquesRail(job, ctx) {
  const c = ctx || {};
  const fmt = c.fmtMoney || ((n) => String(n));
  return [
    bloqueCliente(job),
    bloqueDonde(job),
    bloqueDinero(job, fmt),
    bloquePresupuesto(job, c.fechaCorta),
    bloqueResponsable(c.responsableName),
  ];
}

if (typeof window !== 'undefined') {
  window.construirBloquesRail = construirBloquesRail;
  window.JOB_RAIL_TITULOS = JOB_RAIL_TITULOS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    construirBloquesRail, JOB_RAIL_TITULOS,
    bloqueCliente, bloqueDonde, bloqueDinero, bloquePresupuesto, bloqueResponsable,
  };
}
