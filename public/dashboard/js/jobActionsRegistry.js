// public/dashboard/js/jobActionsRegistry.js — SCRUM-316 (G1)
//
// EL REGISTRO DECLARATIVO de la LEY del patrón de detalle, aplicada al TRABAJO. Misma forma que
// `invoiceActionsRegistry.js` (B2): la vista PINTA desde aquí y el guard VERIFICA contra aquí.
// Nadie escribe la tabla dos veces.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ ESTA TABLA **NO** VA POR ESTADO DEL TRABAJO, Y ESO NO ES UN OLVIDO
//
// La de factura sí: los destinos cambian entre `pending`, `paid`, `annulled` y `R1`, porque las
// acciones de una factura dependen de su estado. **Las del Trabajo no.**
//
// `[MEDIDO — G0/SCRUM-309, reconfirmado aquí]`: de las 37 acciones del detalle, sus guardas miran
// el estado del **albarán** (`alb.estado`), el del **cobro** (`!paid`) o la existencia de datos
// (`job.quote`, `job.customer.phone`). **Ninguna guarda de la vista ramifica por `job.status`.**
//
// La única excepción vive donde tiene que vivir: `jobNextAction` —la escalera de SCRUM-366— sí
// consulta `job.status` en el nivel «Cobrar» (`terminado` + saldo). Por eso **la primaria no se
// declara aquí**: se declara su SLOT, y quien lo ocupa lo decide la escalera.
//
// Escribir cinco columnas idénticas habría sido peor que no escribirlas: parecería que el destino
// depende del estado —invitando a diferenciarlas— cuando el producto no tiene ese mecanismo.
// Añadirlo es una decisión NUEVA que aprueba el fundador, no un efecto colateral de ordenar.

// Los destinos posibles. Mismos nombres que en factura para que las dos leyes se lean igual.
//   primaria   — el siguiente paso. EXACTAMENTE UNA (o ninguna). La ocupa la escalera.
//   secundaria — máximo DOS, visibles al lado de la primaria.
//   overflow   — el «⋮».
const JOB_ACTION_DESTINOS = ['primaria', 'secundaria', 'overflow'];

// La ley, como números y no como prosa: el guard la lee de aquí en vez de repetirla.
const JOB_PATRON_LEY = { primarias: 1, secundarias: 2 };

// LAS ACCIONES DE **TRABAJO** de la cabecera.
//
// Pertenencia por REGLA, no por gusto: una acción entra en la cabecera si actúa sobre el Trabajo
// ENTERO y no vive dentro de un bloque que posee otro ticket. Medido por el endpoint que llama su
// handler y por la sección a la que se cuelga:
//
//   · `cta`       → `/admin/jobs/:id/collect-rest` · albaranes · … (lo elige la escalera)
//   · `btnGasto`  → un GASTO del Trabajo. Hoy vive en `newAlbRow` (la barra de DOCUMENTOS) y un
//                   gasto **no es un documento**: está mal aparcado, no reasignado por gusto.
//
// FUERA, y cada una por su motivo medido:
//   · `+ Nuevo albarán` y `🧾 Consolidar en factura` — sí son de Trabajo, pero crean y reparten
//     DOCUMENTOS, que es **G4** y el ticket lo declara fuera de alcance.
//   · `Cambiar` (tipo de trabajo) — no es una acción sobre el Trabajo: es el editor plegado de UN
//     campo, dentro de su propia sección. Subirlo a la cabecera dejaría el botón arriba y lo que
//     abre fuera de pantalla. La ley ordena acciones, no controles de formulario.
//   · Todo lo demás del censo — por documento (`alb.estado`), por factura (`!paid`) o interno de
//     un modal.
//
// ⚠️ SALEN DOS FILAS, NO TRES: la ley permite hasta DOS secundarias y la medición da UNA. El hueco
// se queda vacío. Rellenarlo habría exigido promover un control que no es una acción o invadir G4,
// y las dos cosas son peores que una cabecera con una secundaria.
const JOB_ACTION_REGISTRY = [
  // id           destino        acciones sobre el Trabajo entero
  { id: 'cta',      destino: 'primaria', fuente: 'jobNextAction' },
  { id: 'btnGasto', destino: 'secundaria' },
];

// LOS BLOQUES DEL RAIL DERECHO — **estructura, no contenido**.
//
// El contenido es G3 y el ticket lo deja explícitamente fuera. Lo que sí hace falta hoy es que
// exista el sitio: sin la rejilla y sin los bloques declarados, G3 no tiene dónde ir y acabaría
// inventándose su propio contenedor, que es como nacen dos maquetaciones para una pantalla.
//
// Cada bloque se pinta SOLO si G3 le da contenido. Hoy ninguno lo tiene, así que el rail no se
// pinta y el cuerpo ocupa el ancho entero: la estructura está declarada y probada sin que se
// publique una columna vacía.
//
// Los RÓTULOS no viven aquí: son microcopy sin aprobar (regla 30) y llegan con G3.
const JOB_RAIL_BLOQUES = ['cliente', 'donde', 'dinero', 'presupuesto', 'responsable'];

/**
 * Destino de una acción declarada. Devuelve null si la acción no está en el registro — que es lo
 * que hace al guard capaz de cazar una acción de cabecera pintada a mano.
 */
function destinoAccionTrabajo(id) {
  const a = JOB_ACTION_REGISTRY.find((x) => x.id === id);
  return a ? a.destino : null;
}

// Doble vida: global para el <script> clásico del dashboard (regla 4: vanilla, sin bundler) y
// module.exports para que el guard IMPORTE esta misma tabla en Node en vez de re-declararla.
if (typeof window !== 'undefined') {
  window.JOB_ACTION_REGISTRY = JOB_ACTION_REGISTRY;
  window.JOB_ACTION_DESTINOS = JOB_ACTION_DESTINOS;
  window.JOB_PATRON_LEY = JOB_PATRON_LEY;
  window.JOB_RAIL_BLOQUES = JOB_RAIL_BLOQUES;
  window.destinoAccionTrabajo = destinoAccionTrabajo;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    JOB_ACTION_REGISTRY, JOB_ACTION_DESTINOS, JOB_PATRON_LEY, JOB_RAIL_BLOQUES, destinoAccionTrabajo,
  };
}
