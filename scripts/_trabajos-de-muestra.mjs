// scripts/_trabajos-de-muestra.mjs — SCRUM-816
//
// LOS TRABAJOS DE MUESTRA, EN UN SOLO SITIO. Los usan el guard que vigila (`guard:lista-trabajos`)
// y el que hace las capturas: si cada uno llevara los suyos, el día que uno cambie estarían
// midiendo pantallas distintas y sus veredictos dejarían de hablar de lo mismo — que es la avería
// que este repo ya conoce con las tres listas de zona roja que habían derivado.
//
// 🔴 LA FORMA ES LA QUE MANDA EL SERVIDOR, y eso es medio ticket. `serializeJob` devuelve ahora
// `albaranes` e `invoices` (SCRUM-816); antes NO, y por eso `jobNextAction` caía siempre al nivel
// 5 y las veinte filas ofrecían «+ Nuevo albarán». El fixture trae los dos campos para poder
// medir las DOS caras: con documentos y sin ellos.

/** El equipo. Cuatro nombres, uno con tilde para que el buscador se pruebe donde falla. */
export const EQUIPO = Object.freeze([
  { id: 1, name: 'Miguel Ángel Ferrer' },
  { id: 2, name: 'Nadia Ben Ali' },
  { id: 3, name: 'Israel Carmona' },
  { id: 4, name: 'Toni Sanchís' },
]);

/** Los CINCO estados reales de la FSM (Parte L · `job.service.ts`), en su orden. */
export const ESTADOS = Object.freeze(['pendiente_agendar', 'agendado', 'en_curso', 'terminado', 'cerrado']);

/**
 * `n` Trabajos, recorriendo los cinco estados y las dos situaciones de dinero.
 *
 * `albaranes` alterna entre vacío, un borrador y uno emitido: sin variedad, el censo de acciones
 * principales volvería a salir uniforme y no distinguiría «la escalera ya decide» de «el dato
 * sigue sin viajar» — un verde que no sabría lo que mide.
 */
export function trabajosDeMuestra(n, { conDocumentos = true } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const status = ESTADOS[i % ESTADOS.length];
    const albaranes = !conDocumentos || i % 3 === 0
      ? []
      : (i % 3 === 1 ? [{ id: 900 + i, estado: 'borrador' }] : [{ id: 900 + i, estado: 'emitido' }]);
    out.push({
      id: i + 1,
      status,
      scheduledAt: status === 'pendiente_agendar' ? null : new Date(Date.UTC(2026, 8, 8 + (i % 5), 9, 30)).toISOString(),
      assignedUserId: null,
      notes: null,
      createdAt: '2026-09-01T09:00:00.000Z',
      titulo: 'Trabajo ' + (i + 1),
      direccion: null,
      totalAceptado: 1194.27,
      totalCobrado: i % 2 ? 597.14 : 0,
      estadoCobro: i % 3 === 0 ? 'Parcial' : (i % 3 === 1 ? 'Pendiente' : 'Pagado'),
      importeReferencia: 1194.27,
      // Los teléfonos NO llevan número: aquí no hace falta ninguno y un dato de prueba con pinta
      // real es el de alguien (SCRUM-262).
      customer: { id: 100 + i, name: i % 3 === 0 ? 'Comunidad de Propietarios Av. del Puerto 118' : 'Carmen Ruiz', phone: null },
      operarioId: null,
      operario: null,
      asignados: i % 4 === 0 ? [] : [EQUIPO[i % EQUIPO.length]],
      tipoOperacion: 'TRABAJO_UNICO',
      quote: { id: i + 1, number: i + 1, total: 1194.27, currency: 'EUR', paymentTerms: null },
      remaining: status === 'terminado' ? { amount: 597.13, currency: 'EUR' } : null,
      nextStage: null,
      pendingStagesCount: 0,
      hasCustomPlan: false,
      albaranes,
      invoices: [],
    });
  }
  return out;
}

export const CLIENTES = Object.freeze([
  { id: 1, name: 'Administración de Fincas Soler y Asociados', phone: '34000000001', email: 'admin@fincassoler.es', notes: '', tags: [], createdAt: '2026-01-15T10:00:00Z' },
  { id: 2, name: 'Carmen Ruiz', phone: '34000000002', email: 'carmen@ejemplo.es', notes: '', tags: [], createdAt: '2026-02-20T10:00:00Z' },
]);
export const PRESUPUESTOS = Object.freeze([
  { id: 11, quoteNumber: 'P-2026-0011', number: 11, status: 'accepted', total: 1234.56, currency: 'EUR', createdAt: '2026-04-02T09:00:00.000Z', customer: CLIENTES[0] },
  { id: 12, quoteNumber: 'P-2026-0012', number: 12, status: 'sent', total: 500, currency: 'EUR', createdAt: '2026-04-03T09:00:00.000Z', customer: CLIENTES[1] },
]);
export const FACTURAS = Object.freeze([
  { id: 31, number: 'F-2026-0031', status: 'paid', total: 999.99, currency: 'EUR', createdAt: '2026-04-09T09:00:00.000Z', customer: CLIENTES[0] },
]);

/**
 * La respuesta de `GET /admin/albaranes`, con SU forma: `{ filas, ejes, contadores }`.
 *
 * 🔴 NO ES UN ARRAY, y por eso hace falta escribirla. `albaranesView` trata una respuesta con
 * forma inesperada como FALLO —no como listado vacío, y hace bien—, así que servirle `[]` pintaba
 * un error de 555 caracteres. Comparar por hash dos pantallas de error habría dado «idénticas» sin
 * haber mirado ni una fila: un verde por vacío, que es el que este repo persigue.
 */
export const ALBARANES = Object.freeze({
  // 🔴 SCRUM-831 · LOS CINCO CASOS QUE DECIDEN, no dos. La primaria de un albarán la elige el
  // registro de SCRUM-302 por ESTADO, y `firmado` tiene DOS contextuales excluyentes más el caso
  // sin siguiente paso. Con sólo `borrador` y `emitido`, un censo de acciones saldría verde sin
  // haber visto la mitad de la tabla.
  //
  // `modoValoracion` y `quote` viajan desde SCRUM-831: sin ellos las dos condiciones de `firmado`
  // dan `false` y la fila se queda sin acción POR FALTA DE DATO, que se pinta igual que «no hay
  // nada que hacer» y significa lo contrario.
  filas: [
    { id: 21, numero: 'A-2026-0021', estado: 'borrador', estadoFacturacion: 'sin_facturar', modoValoracion: 'SIN_VALORAR', quote: { id: 11 }, emisionAt: null, fecha: '2026-04-05T09:00:00.000Z', cliente: CLIENTES[0].name, jobId: 1, trabajo: 'Trabajo 1' },
    { id: 22, numero: 'A-2026-0022', estado: 'emitido', estadoFacturacion: 'parcial', modoValoracion: 'VALORADO', quote: { id: 12 }, emisionAt: '2026-04-06T09:00:00.000Z', fecha: '2026-04-06T09:00:00.000Z', cliente: CLIENTES[1].name, jobId: 2, trabajo: 'Trabajo 2' },
    // firmado + VALORADO con algo pendiente → «Facturar lo entregado»
    { id: 23, numero: 'A-2026-0023', estado: 'firmado', estadoFacturacion: 'parcial', modoValoracion: 'VALORADO', quote: { id: 11 }, emisionAt: '2026-04-07T09:00:00.000Z', fecha: '2026-04-07T09:00:00.000Z', cliente: CLIENTES[0].name, jobId: 1, trabajo: 'Trabajo 1' },
    // firmado + SIN precios pero CON presupuesto detrás → «Convertir en factura»
    { id: 24, numero: 'A-2026-0024', estado: 'firmado', estadoFacturacion: 'sin_facturar', modoValoracion: 'SIN_VALORAR', quote: { id: 12 }, emisionAt: '2026-04-08T09:00:00.000Z', fecha: '2026-04-08T09:00:00.000Z', cliente: CLIENTES[1].name, jobId: 2, trabajo: 'Trabajo 2' },
    // firmado y YA FACTURADO del todo → NINGUNA acción, y esa celda vacía es información.
    { id: 25, numero: 'A-2026-0025', estado: 'firmado', estadoFacturacion: 'facturado', modoValoracion: 'VALORADO', quote: { id: 11 }, emisionAt: '2026-04-09T09:00:00.000Z', fecha: '2026-04-09T09:00:00.000Z', cliente: CLIENTES[0].name, jobId: 1, trabajo: 'Trabajo 1' },
  ],
  ejes: { estado: ['borrador', 'emitido', 'firmado'], cobro: ['sin_facturar', 'parcial', 'facturado'] },
  contadores: {
    total: 5,
    porEstado: { borrador: 1, emitido: 1, firmado: 3 },
    porCobro: { sin_facturar: 2, parcial: 2, facturado: 1 },
  },
});

/**
 * El doble de `apiRequest`, como TEXTO: viaja dentro de la página y allí no hay módulos.
 *
 * `fallaElPatch` sirve la otra mitad del candado: un guardado que revienta, para comprobar que lo
 * que se ve VUELVE ATRÁS. Sin ese caso, «revierte» sería una promesa escrita en un comentario.
 */
export function reglasDeDatos(jobs, { fallaElPatch = false } = {}) {
  const D = JSON.stringify({ jobs, equipo: EQUIPO, clientes: CLIENTES, quotes: PRESUPUESTOS, facturas: FACTURAS, albaranes: ALBARANES });
  return `(function (ruta, opciones) {
  var D = ${D};
  var metodo = (opciones && opciones.method) || 'GET';
  if (metodo === 'PATCH') {
    ${fallaElPatch
      ? "return Promise.reject(Object.assign(new Error('fallo simulado'), { data: { message: 'la base no contesta' } }));"
      : 'return { ok: true };'}
  }
  if (/\\/admin\\/team/.test(ruta)) return D.equipo;
  if (/\\/admin\\/jobs/.test(ruta)) return D.jobs;
  if (/\\/admin\\/albaranes/.test(ruta)) return D.albaranes;
  if (/\\/admin\\/customers/.test(ruta)) return D.clientes;
  if (/\\/admin\\/quotes/.test(ruta)) return D.quotes;
  if (/\\/admin\\/invoices/.test(ruta)) return D.facturas;
  if (/\\/admin\\/merchant/.test(ruta)) return { id: 1, name: 'Fontanería Soler' };
  if (/\\/billing\\/plans/.test(ruta)) return { plans: [], currentPlan: null, founding: null };
  return [];
})`;
}
