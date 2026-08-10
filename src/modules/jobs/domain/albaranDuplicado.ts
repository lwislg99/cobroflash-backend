/**
 * SCRUM-302 (C2) · DUPLICAR UN ALBARÁN.
 *
 * En una reforma de tres semanas **cada día es un parte**. Duplicar el de ayer y ajustar cantidades
 * ahorra casi todo el trabajo de rellenarlo — y es de las cosas que más se usan en un gremio.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 POR QUÉ ESTO ES UNA CLASIFICACIÓN Y NO UNA LISTA DE CAMPOS A COPIAR
 *
 * Un test que enumera «no copies la firma, ni las fotos, ni el número» solo sabe lo que a alguien
 * se le ocurrió escribir el día que lo escribió. Dentro de tres meses se añade un campo a
 * `Albaran`, el duplicado se lo lleva **en silencio**, y si ese campo es EVIDENCIAL nos hemos
 * fabricado un documento que afirma algo que no pasó.
 *
 * Por eso cada campo del modelo cae en UNO de los dos cubos, y el guard falla cuando aparece uno
 * **sin clasificar** — no cuando aparece uno «de los malos». La pregunta que hay que contestar al
 * añadir un campo es siempre la misma:
 *
 *   ¿esto DESCRIBE EL TRABAJO (viaja) o es UN HECHO QUE OCURRIÓ (no viaja)?
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * LA FRONTERA, dicha una vez
 *
 * «Describe el trabajo» es lo que el profesional volvería a teclear igual mañana: a qué Trabajo
 * pertenece, qué líneas lleva, si va con precios, sus notas.
 *
 * «Es un hecho que ocurrió» es todo lo que AFIRMA algo sobre el documento anterior: que se firmó,
 * cuándo, quién, desde dónde, con qué número de serie, que se emitió un PDF, que una factura lo
 * consumió. Copiar cualquiera de ésos al duplicado sería hacerle decir que ocurrió algo que no ha
 * ocurrido — y en el caso de la firma, eso tiene nombre: falsificar un documento.
 */

/** Los campos que VIAJAN al duplicado, con el motivo por el que describen el trabajo. */
export const CAMPOS_QUE_VIAJAN: Record<string, string> = {
  merchantId: 'tenencia: el duplicado es del mismo merchant (regla 2)',
  jobId: 'el parte nuevo es del MISMO Trabajo; duplicar a otro sería crearlo, no duplicarlo',
  modoValoracion: 'con o sin precios es una decisión del parte, no un hecho ocurrido',
  lineas: 'ES lo que describe el trabajo: el motivo entero de duplicar',
  notas: 'las escribió el profesional sobre la obra, y las volvería a escribir igual',
  // SCRUM-300 (C5): DÓNDE se entrega describe el trabajo —la obra es la misma— y el pro lo
  // teclearía idéntico mañana. No afirma que se haya entregado nada: eso lo dice `fechaEntrega`,
  // que está en el otro cubo justamente por eso.
  lugarEntrega: 'es la dirección de la OBRA, que no cambia al duplicar: describe, no afirma',
};

/**
 * Los campos que NO VIAJAN, con el motivo. Un motivo por campo, no un motivo por grupo: cuando
 * alguien discuta uno concreto, lo que hace falta es la razón de ÉSE.
 */
export const CAMPOS_QUE_NO_VIAJAN: Record<string, string> = {
  id: 'identidad de la fila; la asigna la base de datos',
  numero: 'ALB-YYYY-NNN ya se reservó para el original; el duplicado pide el suyo',
  fecha: 'el ticket lo fija: el duplicado nace CON FECHA DE HOY, no con la de la visita de ayer',
  estado: 'nace en `borrador`: heredar `firmado` sería afirmar una firma que no existe',
  version: 'el duplicado es un documento nuevo, no la versión n+1 de otro',
  signatureUrl: '🔴 LA FIRMA. Copiarla es FALSIFICAR UN DOCUMENTO: el cliente no firmó esto',
  firmadoAt: 'afirma CUÁNDO se firmó algo que no se ha firmado',
  firmaToken: 'token opaco de la página pública del ORIGINAL, y además `@unique`',
  enviadoParaFirmaAt: 'afirma que se envió al cliente; el duplicado no se ha enviado a nadie',
  evidenciaFirma: '🔴 evidencia probatoria (IP, UA, hash del contenido firmado) del OTRO documento',
  pdfUrl: 'el PDF renderizado del original, con su número y su firma dentro',
  createdAt: 'lo pone la base de datos al crear',
  updatedAt: 'lo pone la base de datos al escribir',
  invoiceId: 'la factura que consumió al ORIGINAL; el duplicado no lo ha facturado nadie',
  // ── SCRUM-425 / SCRUM-358 (H3) ────────────────────────────────────────────────────────
  // 🔴 LA CLAVE DE IDEMPOTENCIA DEL **ALTA**, y ahí está todo el motivo: identifica UN INTENTO
  // de creación, no un documento. Duplicar es un ALTA DISTINTA —otro día, otro parte— y necesita
  // su propia clave, o ninguna.
  //
  // Y copiarla no sería solo conceptualmente falso: **rompería la ruta**. El duplicado chocaría
  // contra `@@unique([merchantId, claveIdempotencia])` y `POST /:id/duplicar` devolvería un
  // `P2002` — un 500 en la cara del profesional al duplicar el parte de ayer, que es de lo que
  // más se usa en un gremio. El guard de clasificación no pedía papeleo: señalaba esto.
  claveIdempotencia: '🔴 identifica UN INTENTO DE ALTA, no el documento: el duplicado es otra alta y chocaría contra el único',
  // ── SCRUM-300 (C5) ────────────────────────────────────────────────────────────────────
  // Los tres son HECHOS ocurridos sobre el documento anterior, y los tres van dentro del
  // contenido SELLADO por la firma (sobre v:2). Heredarlos afirmaría en un documento nuevo —y
  // sin firma— que alguien entregó tal día y que fulano lo recibió. Es el mismo daño que copiar
  // el trazo, dicho con letras en vez de con un PNG.
  fechaEntrega: 'afirma CUÁNDO se entregó; el duplicado no se ha entregado todavía',
  firmadoPorNombre: '🔴 afirma QUIÉN recibió la entrega anterior. Nadie ha recibido ésta',
  firmadoPorCalidad: '🔴 en calidad de qué firmó ESA persona en el OTRO documento',
};

/**
 * Los datos con los que se crea el duplicado.
 *
 * Se construye SUMANDO los campos del cubo que viaja, nunca copiando el origen y borrando lo que
 * sobra: restar deja pasar lo que nadie se acordó de restar, que es exactamente el fallo que este
 * módulo existe para impedir. `estado` y `fecha` se fijan aquí porque el ticket los fija.
 *
 * ⚠️ El `numero` NO sale de aquí: lo reserva `allocateAlbaranNumber` DENTRO de la transacción, que
 * es quien sabe hacerlo sin huecos en la serie.
 *
 * Las FOTOS tampoco: no son un campo de `Albaran`, son filas propias que apuntan a él. No copiarlas
 * es no hacer nada — y hay test de que sigue siendo así, porque «no hacer nada» deja de ser cierto
 * en cuanto alguien escriba el código que las copia.
 */
export function datosDuplicado(origen: Record<string, unknown>): Record<string, unknown> {
  const datos: Record<string, unknown> = {};
  for (const campo of Object.keys(CAMPOS_QUE_VIAJAN)) datos[campo] = origen[campo];
  datos.estado = 'borrador';
  datos.fecha = new Date();
  return datos;
}
