// src/modules/jobs/domain/albaranFirmaCopy.ts — SCRUM-300 (C5)
//
// LOS TEXTOS DE LOS CAMPOS NUEVOS DEL ALBARÁN, EN UN SOLO SITIO.
//
// Regla 30: el microcopy es CERRADO. Aquí conviven dos clases de texto y NO se mezclan:
//
//   · `COPY` — aprobada por el fundador, literal. No se toca sin cambio de master.
//   · `CALIDAD_FIRMANTE` — todavía SIN aprobar. Va con el marcador `[PENDIENTE microcopy oficial]`
//     visible en pantalla, igual que en portabilidad (`portabilidadCompleta.ts:201`) y en el
//     export. Se ve feo A PROPÓSITO: un placeholder que parece definitivo acaba en producción.
//
// El valor que se GUARDA en `Albaran.firmadoPorCalidad` es el `id`, no la etiqueta. Así, cuando
// llegue el texto oficial, cambia la etiqueta y NO hay que migrar ni un solo albarán firmado.

/** Marcador del repo para texto sin aprobar. Se pinta tal cual (no es un fallback silencioso). */
export const PENDIENTE = '[PENDIENTE microcopy oficial]';

export const COPY = {
  lugarEntrega: {
    label: 'Lugar de entrega',
    ayuda: 'Dónde se ha hecho el trabajo, si no es la dirección del cliente. Sale en el albarán y queda dentro de la firma.',
  },
  fechaEntrega: {
    label: 'Fecha de entrega',
    ayuda: 'El día que se entregó, que no siempre es el día que se creó.',
  },
  firmadoPorNombre: {
    label: 'Nombre de quien firma',
    ayuda: 'Una firma sin nombre no identifica a nadie. Con el nombre, el albarán vale como prueba de entrega si algún día hay discusión.',
    /** El chip de sugerencia de UN TOQUE. `%s` = nombre del cliente. */
    chip: 'Es %s',
  },
  /**
   * Lo que se enseña en un albarán FIRMADO ANTES de esta tarea, que nunca tuvo estos datos.
   * No es un error ni culpa de nadie: es que no se preguntó. Un hueco mudo en un documento
   * legal se lee como un fallo del sistema.
   */
  noSePidio: 'No se pidió al firmar',
} as const;

/**
 * EN CALIDAD DE QUÉ firma. ⚠️ Sin opción marcada por defecto — misma razón que el nombre vacío:
 * una casilla premarcada es una declaración que el firmante no ha hecho.
 *
 * Las etiquetas están PENDIENTES de aprobación; los `id` NO (son datos, no texto de pantalla).
 */
export const CALIDAD_FIRMANTE: ReadonlyArray<{ id: string; etiqueta: string; libre?: boolean }> = [
  { id: 'cliente', etiqueta: PENDIENTE },
  { id: 'familiar_o_conviviente', etiqueta: PENDIENTE },
  { id: 'encargado_o_personal_obra', etiqueta: PENDIENTE },
  { id: 'portero_o_conserje', etiqueta: PENDIENTE },
  { id: 'otra_persona', etiqueta: PENDIENTE, libre: true },
];

export const CALIDAD_IDS: ReadonlySet<string> = new Set(CALIDAD_FIRMANTE.map((c) => c.id));

/** Etiqueta para pintar una calidad ya guardada. Un `id` desconocido NO se inventa: se dice. */
export function etiquetaCalidad(id: string | null | undefined): string | null {
  if (!id) return null;
  const c = CALIDAD_FIRMANTE.find((x) => x.id === decodificarCalidad(id).id);
  return c ? c.etiqueta : PENDIENTE;
}

// ── «Otra persona ______», sin pedir una columna más ─────────────────────────
//
// El fundador aprobó CUATRO campos de schema, y el schema es territorio suyo. La opción libre
// necesita guardar además QUÉ escribió el firmante, así que se codifica dentro del mismo valor:
// `otra_persona:Vecina del 3º`. El `id` queda antes de los dos puntos y el texto detrás.
// Se documenta aquí porque un formato implícito en dos sitios es un formato roto.

const SEP_CALIDAD = ':';

export function codificarCalidad(id: string, textoLibre?: string | null): string {
  const t = String(textoLibre ?? '').trim().replace(/\s+/g, ' ');
  return t ? `${id}${SEP_CALIDAD}${t}` : id;
}

/** Tope del nombre: cabe cualquier nombre real y corta un pegote de 2 MB en el campo. */
export const NOMBRE_FIRMANTE_MAX = 120;

/**
 * Lee y valida la DECLARACIÓN de quien firma, para las DOS rutas que firman (in situ y remota).
 * Una sola implementación a propósito: si cada ruta validara por su cuenta, una de las dos
 * acabaría aceptando lo que la otra rechaza y no nos enteraríamos hasta el juicio.
 *
 * ⚠️ Los textos de error van con el marcador `[PENDIENTE microcopy oficial]` (regla 30): son
 * pantalla y todavía no están aprobados. El front impide llegar aquí con el nombre vacío, así
 * que esto es el respaldo, no el camino normal.
 */
export function leerFirmante(
  body: any,
): { nombre: string; calidad: string | null } | { error: { error: string; message: string } } {
  const nombre = String(body?.firmadoPorNombre ?? '').trim().replace(/\s+/g, ' ');
  if (!nombre) {
    return { error: { error: 'firma_sin_nombre', message: PENDIENTE } };
  }
  if (nombre.length > NOMBRE_FIRMANTE_MAX) {
    return { error: { error: 'firma_nombre_largo', message: PENDIENTE } };
  }
  const calidadId = String(body?.firmadoPorCalidad ?? '').trim();
  if (!calidadId) return { nombre, calidad: null };
  if (!CALIDAD_IDS.has(calidadId)) {
    // Un id que no está en la lista NO se guarda «por si acaso»: se rechaza. Guardar basura en
    // un campo probatorio es peor que no tenerlo.
    return { error: { error: 'firma_calidad_desconocida', message: PENDIENTE } };
  }
  return { nombre, calidad: codificarCalidad(calidadId, body?.firmadoPorCalidadOtra) };
}

export function decodificarCalidad(valor: string | null | undefined): { id: string | null; textoLibre: string | null } {
  if (!valor) return { id: null, textoLibre: null };
  const i = String(valor).indexOf(SEP_CALIDAD);
  if (i < 0) return { id: valor, textoLibre: null };
  return { id: valor.slice(0, i), textoLibre: valor.slice(i + 1) || null };
}
