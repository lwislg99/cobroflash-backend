// public/dashboard/js/facturaPreEmision.js — SCRUM-292 (A1) · LA REVISIÓN ANTES DE EMITIR.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, MEDIDO — Y NO ES EL QUE EL TICKET DESCRIBÍA
//
// El ticket decía que el producto «PREGUNTA en vez de PROPONER»: trece opciones en un desplegable.
// Medido, **ese desplegable no existe** — el `<select>` más grande del dashboard entero tiene 3
// opciones— y el tipo de factura **no lo elige nadie**: se deriva dentro del camino de emisión.
//
// El defecto real es el contrario: **decide solo, en silencio**. Y hay un caso concreto en que el
// silencio cuesta:
//
//   Una factura SIN NIF del cliente se emite, se envía y se cobra… y queda FUERA del registro.
//   `resolverSinDestinatario` lanza `DestinatarioSinDictamenError` y el documento se excluye.
//   **En pantalla es idéntica a una registrada.** El profesional no se entera.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE MÓDULO **NO** HACE, Y ES LO MÁS IMPORTANTE
//
// **No deriva el tipo de factura.** Ni lo copia, ni lo reimplementa, ni lo adivina. Esa decisión
// vive en `registro.builder.ts` y no se toca (regla 38): esta revisión ocurre **antes** de emitir,
// no dentro.
//
// Lo único que mira es si **falta el dato** que hace que la decisión sea posible. Con NIF, la
// derivación acierta sola y no hay nada que preguntar. Sin NIF, la decisión **no se puede tomar
// hoy** —depende del dictamen P11— y este módulo lo dice en vez de proponer «la más común por si
// acaso». Proponer por defecto es adivinar con buena letra.
//
// ⚠️ CERO TEXTO AQUÍ. Este módulo devuelve ESTADOS, no frases. El microcopy de esta pantalla está
// sin aprobar (regla 30) y, además, cualquier texto sobre el registro está sujeto a la regla 26:
// la pregunta de VeriFactu se responde SOLO con el guion H2. Las frases viven en la vista, con su
// marcador y su procedencia.

/** Los estados que la revisión puede devolver. El guard los usa para no enumerarlos a mano. */
const REVISION_ESTADOS = ['completo', 'falta-nif'];

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * ¿Hay NIF utilizable para este cliente?
 *
 * `taxId` es `String?` en el modelo. Se exige contenido de verdad: una cadena vacía o de espacios
 * **no es un NIF**, y tratarla como tal es el camino corto a emitir el documento que este ticket
 * existe para evitar.
 */
function tieneNif(customer) {
  return texto(customer && customer.taxId).length > 0;
}

/**
 * La revisión previa de una factura que se va a emitir.
 *
 * @returns `{ estado, faltaNif, decidible, clienteId }`
 *
 *   · `estado: 'completo'`   — hay NIF. La emisión sigue **exactamente igual que antes**: sin
 *                              pregunta y sin fricción. Es el camino que hoy funciona y no se toca.
 *   · `estado: 'falta-nif'`  — no hay NIF. Se pregunta ANTES de emitir.
 *
 *   · `decidible` — si el tipo de factura se puede decidir hoy con lo que hay. Sin NIF es `false`,
 *                   y **eso no se rellena con un valor por defecto**: es el suelo de esta tarea.
 */
function revisionPreEmision(customer) {
  const conNif = tieneNif(customer);
  return {
    estado: conNif ? 'completo' : 'falta-nif',
    faltaNif: !conNif,
    // Con NIF la derivación de `registro.builder.ts` tiene todo lo que necesita. Sin NIF, el
    // esquema admite DOS salidas distintas y cuál procede lo decide el dictamen P11, no el código
    // — así que aquí tampoco se decide.
    decidible: conNif,
    clienteId: (customer && customer.id) != null ? customer.id : null,
  };
}

/**
 * ¿Hay que parar y preguntar antes de emitir?
 *
 * Se separa de `revisionPreEmision` para que la vista no tenga que interpretar el estado: quien
 * pinta pregunta esto, y quien decide es este módulo. Repartir la decisión entre los dos es como se
 * acaba emitiendo por un camino que nadie revisó.
 */
function hayQuePreguntarAntesDeEmitir(customer) {
  return revisionPreEmision(customer).faltaNif;
}

if (typeof window !== 'undefined') {
  window.revisionPreEmision = revisionPreEmision;
  window.hayQuePreguntarAntesDeEmitir = hayQuePreguntarAntesDeEmitir;
  window.REVISION_ESTADOS = REVISION_ESTADOS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { revisionPreEmision, hayQuePreguntarAntesDeEmitir, tieneNif, REVISION_ESTADOS };
}
