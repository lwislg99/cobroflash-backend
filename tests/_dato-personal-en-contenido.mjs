// tests/_dato-personal-en-contenido.mjs — SCRUM-505
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// MIRAR DENTRO DEL TEXTO, NO EL NOMBRE DE LA COLUMNA.
//
// `CAMPOS_PERSONALES` (SCRUM-497) es un mapa modelo → **nombres de columna**. Redacta la columna
// entera de los que están en la lista, y **no mira lo que hay dentro de los que no están**. Un
// correo escrito dentro de `job.notes` sobrevive a una supresión y nadie lo ve.
//
// 🔒 **Un guard que mira la etiqueta no ve el contenido.** Es el mismo mecanismo que SCRUM-854
// (derivaba del nombre de la rama) y SCRUM-857 (no veía lo que viajaba dentro), hoy en su tercera
// forma: derivar del nombre de la COLUMNA.
//
// ── EL TAMAÑO REAL, MEDIDO ────────────────────────────────────────────────────────────────────
//
// El ticket habla de **15** columnas sin decidir, pero ése es el número de la familia «la columna
// ES un dato personal». Censado sobre el DMMF: **195 campos `String`**, de los cuales **128 son
// texto libre** y **117 no los cubre el guard**. En cualquiera de esos 117 puede haber un correo o
// un teléfono escrito a mano.
//
// ⚠️ **Y ese 117 está inflado, y se dice:** incluye campos de conjunto cerrado que el nombre no
// delata (`plan`, `country`, `ivaModo`, `vfEstado`…). Afinarlo exigiría clasificar campo a campo
// **cuáles admiten texto de una persona**, y eso —como el propio ticket dice del vocabulario
// jurídico— *«es una calificación, no una propiedad del texto»*.
//
// 🔴 **Por eso este detector no clasifica campos: mira el contenido de todos.** Si la pregunta
// «¿en cuál podría caber?» no se puede derivar, la respuesta es no necesitar contestarla.
//
// ── EL CRITERIO SE ELIGIÓ MIDIENDO LA TASA DE FALSOS POSITIVOS, NO POR INTUICIÓN ──────────────
//
// *Un guard demasiado amplio acaba relajado.* Las cifras y el porqué de cada regla están en
// `docs/master/SCRUM-505.md` §3, medidas sobre un corpus de textos legítimos fabricados.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** Lo que se busca dentro de un texto. Cada forma, con su motivo y su límite declarado. */
export const FORMAS = Object.freeze({
  /**
   * CORREO. Exige `@` con algo a cada lado y un punto en el dominio.
   *
   * Deliberadamente NO casa `ana [at] obra.example`: el ticket avisa de que el enmascarado de hoy
   * «mide por forma» y que esa variante se le escapa. Cazarla exigiría casar « at » entre
   * palabras, y eso dispara sobre prosa normal («llamar at 5»). **Queda declarado como límite en
   * vez de resuelto a medias** — ver `LIMITES`.
   */
  correo: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,

  /**
   * TELÉFONO español: 9 dígitos que empiezan por 6, 7, 8 o 9, con separadores opcionales.
   *
   * 🔴 El ancla `(?<![\d])` / `(?![\d])` es lo que separa un teléfono de un IMPORTE, de un NIF y
   * de un número de factura. Sin ella, `2026-CF-000123456789` casaba. Medido: era la regla que
   * más falsos positivos producía.
   */
  telefono: /(?<![\d])(?:\+34[ .-]?)?[6789](?:[ .-]?\d){8}(?![\d])/,

  /**
   * IBAN español. Dos letras, dos dígitos de control y 20 más.
   * Anclado igual, para no cazar la cola de un identificador largo.
   */
  iban: /(?<![A-Z0-9])ES\d{2}[ ]?(?:\d{4}[ ]?){5}(?![A-Z0-9])/i,
});

/**
 * 🔴 LO QUE ESTE DETECTOR NO VE, ESCRITO AQUÍ Y NO DESCUBIERTO EN UN ROJO RARO.
 *
 * Se declara porque un guard que no dice lo que se le escapa se lee como si no se le escapara
 * nada — y entonces su verde vale menos que su silencio.
 */
export const LIMITES = Object.freeze([
  'correo enmascarado a mano: «ana [at] obra.example» o «ana(arroba)obra.example»',
  'teléfono escrito con letras: «seis cero cero...»',
  'nombres y apellidos de personas: no tienen forma reconocible y casarlos sería adivinar',
  'direcciones postales escritas en prosa',
  'un dato personal partido entre dos campos distintos',
]);

/**
 * ¿Qué datos personales hay DENTRO de este texto?
 *
 * Devuelve las formas encontradas, **nunca el valor**: un guard que imprimiera el correo que
 * acaba de encontrar lo copiaría a los registros, que es exactamente lo que viene a impedir.
 */
export function formasEnTexto(valor) {
  if (valor == null || typeof valor !== 'string' || !valor) return [];
  return Object.entries(FORMAS).filter(([, re]) => re.test(valor)).map(([nombre]) => nombre);
}

/** ¿Este texto esconde algún dato personal? */
export const tieneDatoPersonal = (valor) => formasEnTexto(valor).length > 0;

/**
 * Recorre las filas de un modelo y devuelve DÓNDE hay datos personales escondidos.
 *
 * Cada hallazgo nombra **tabla, fila y campo** — y la FORMA encontrada, no el dato. Con eso se
 * puede ir a mirar; con el valor dentro, el informe se convierte en el problema.
 *
 * `camposYaCubiertos` son los que la anonimización ya redacta enteros: se saltan porque su
 * contenido desaparece de todas formas, y reportarlos sería ruido que empuja a relajar el guard.
 */
export function buscarEnFilas(modelo, filas, camposYaCubiertos = []) {
  const cubiertos = new Set(camposYaCubiertos);
  const hallazgos = [];
  for (const fila of filas ?? []) {
    for (const [campo, valor] of Object.entries(fila ?? {})) {
      if (cubiertos.has(campo)) continue;
      const formas = formasEnTexto(valor);
      if (formas.length) {
        hallazgos.push({ modelo, id: fila.id ?? null, campo, formas });
      }
    }
  }
  return hallazgos;
}
