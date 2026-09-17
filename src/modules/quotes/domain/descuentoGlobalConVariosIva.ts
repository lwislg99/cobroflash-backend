// src/modules/quotes/domain/descuentoGlobalConVariosIva.ts — SCRUM-887 · PR 3 (caso C)
//
// UN DESCUENTO GLOBAL CON VARIOS TIPOS DE IVA NO SE GUARDA, NO SE REVISA Y NO SE FACTURA.
//
// Repartir un descuento en euros entre tipos de IVA decide cuánta base y cuánta cuota lleva cada
// tipo en un documento fiscal, y esa convención está en la asesoría (SCRUM-619, 623 y 624). Hasta
// que la fije, C se BLOQUEA (SCRUM-887 comentarios 15616, 15620 y 15697): en el editor, en el
// servidor y al facturar los que ya existen. Aquí viven el código del rechazo y sus textos; el
// predicado vive con la pieza que convierte líneas en factura (`tieneDescuentoGlobalConVariosIva`).

/** El código de los tres rechazos. Se ramifica por código, nunca por el texto (SCRUM-151). */
export const ERROR_DESCUENTO_GLOBAL_VARIOS_IVA = 'descuento_global_con_varios_iva';

/**
 * L1 · ✅ TEXTO OFICIAL — aprobado por el orquestador por delegación del fundador, SCRUM-887
 * comentario 15697. En el editor (que lo repite en `public/dashboard/js/quoteDescuentos.js`, atado
 * por test) y en el 400 de `POST /quote/create`: ahí el presupuesto aún no existe y se puede quitar.
 */
export const COPY_CREAR_CON_DESCUENTO_GLOBAL_VARIOS_IVA =
  'Un descuento global no se puede aplicar a un presupuesto con varios tipos de IVA. Quítalo o pon el descuento en cada línea.';

/**
 * Lo que va tras los dos puntos de L2 y L2r, en UNA constante (SCRUM-887 comentario 15698). La
 * salida es «Duplicar» porque un presupuesto firmado no se edita y su revisión HEREDA el global.
 * ⚠️ «Duplicar» pierde hoy el global (D6 de SCRUM-883, punto 3 de SCRUM-888): aquí no importa,
 * porque el texto pide poner el descuento en cada línea.
 */
const REMEDIO_DESCUENTO_GLOBAL_VARIOS_IVA =
  'este presupuesto tiene un descuento global y varios tipos de IVA. Duplícalo, pon el descuento en cada línea y envíaselo al cliente para que lo firme.';

/** L2 · ✅ TEXTO OFICIAL (SCRUM-887 comentario 15698). El 409 al facturar un C desde el panel. */
export const COPY_FACTURAR_CON_DESCUENTO_GLOBAL_VARIOS_IVA =
  `No se puede facturar: ${REMEDIO_DESCUENTO_GLOBAL_VARIOS_IVA}`;

/** L2r · ✅ TEXTO OFICIAL (SCRUM-887 comentario 15698). El 400 al crear una revisión de un C. */
export const COPY_REVISAR_CON_DESCUENTO_GLOBAL_VARIOS_IVA =
  `No se puede crear una revisión: ${REMEDIO_DESCUENTO_GLOBAL_VARIOS_IVA}`;
