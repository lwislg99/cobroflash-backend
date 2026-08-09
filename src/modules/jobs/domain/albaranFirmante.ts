// src/modules/jobs/domain/albaranFirmante.ts — SCRUM-300 (C5)
//
// FUENTE ÚNICA de los campos que estrena C5: lugar y fecha de entrega, y QUIÉN firma.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ESTE FICHERO ES EL RESULTADO DE UNA FUSIÓN, Y CONVIENE SABERLO
//
// C5 se construyó DOS VECES en paralelo (`scrum-300-campos-albaran` y `scrum-300-firmado-por`),
// con dos ficheros de dominio distintos sobre lo mismo. El mapa de la fusión está en
// `docs/master/SCRUM-300.md`. Se conserva ESTE fichero y NO `albaranFirmaCopy.ts`: dos módulos
// vivos sobre la misma decisión serían la tercera fuente de verdad en un ticket que ya tenía dos.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO ES UN MÓDULO Y NO UNAS CADENAS EN LA VISTA
//
// Estos textos acaban en un documento que se puede leer en un juzgado, y los aprueba el fundador
// (regla 30). Si vivieran a la vez en el dashboard, en la página pública de firma y en el PDF,
// habría TRES copias que pueden divergir en silencio — que es el defecto que este repo lleva
// arreglando toda la semana (las dos cabeceras de gastos.csv, las tres copias del porqué de
// `borradoMerchant`, los dos selectores de cliente). El arreglo nunca fue sincronizarlas: fue
// dejar una sola. Aquí se aplica lo mismo ANTES de crear el problema.
//
// El navegador **recibe** las opciones por `/admin/me` y no las reimplementa — mismo criterio,
// escrito, de SCRUM-289: «dos copias del criterio es cómo se llega a que el back acepte lo que
// el front esconde».
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA MICROCOPY DE «¿EN CALIDAD DE QUÉ FIRMA?» — APROBADA POR EL FUNDADOR (6-ago-2026)
//
// Historia corta, porque explica por qué los `id` y los textos llegaron por caminos distintos:
//
//  · La rama `scrum-300-firmado-por` traía cinco textos declarados como aprobados palabra por
//    palabra. **Era falso: no habían pasado por la regla 30.** Se retiraron junto con la
//    afirmación. (No se citan aquí a propósito: un guard de texto que los persiguiera se cazaría
//    a sí mismo en la prosa que lo explica. Están en el histórico de esa rama.)
//  · Los seis textos de abajo SÍ los aprobó el fundador, literales, el 6-ago-2026.
//
// **Un texto etiquetado como aprobado es peor que uno con marcador: el marcador pide permiso y la
// etiqueta falsa lo da.** Por eso el hueco se sostuvo con `[PENDIENTE microcopy oficial]` hasta
// que hubo aprobación de verdad, en vez de rellenarse con algo razonable.

/** Marcador del repo para texto sin aprobar. Se pinta tal cual (no es un fallback silencioso). */
export const PENDIENTE = '[PENDIENTE microcopy oficial]';

// ─── EN CALIDAD DE QUÉ FIRMA ─────────────────────────────────────────────────────────────
//
// ⚠️ LOS `id` SON DATO, NO PANTALLA, y por eso SÍ están fijados aunque las etiquetas no lo estén.
// El valor que se guarda en `Albaran.firmadoPorCalidad` es el `id`, y acaba en el paquete de
// evidencias que lee un tercero. Se fijan ANTES de la migración a propósito: cambiarlos después
// obliga a migrar filas de documentos ya firmados. Descriptivos y no abreviados, por decisión del
// asesor (SCRUM-300, 5-ago-2026) — ninguna de las dos ramas usaba éstos.
//
// ⚠️ 🔴 POR QUÉ LA SEGUNDA RANURA ES `en_nombre_del_cliente` Y NO `representante_del_cliente`
//
// No es ni un descuido ni una derogación: es una decisión tomada, revisada y corregida, y se
// escribe aquí para que no se reabra por ninguno de los dos lados.
//
// La rama `scrum-300-firmado-por` razonaba por escrito que había que EVITAR «representante»,
// «autorizado» y «apoderado» por ser AFIRMACIONES JURÍDICAS que el profesional no puede sostener.
// La primera resolución del asesor fijó `representante_del_cliente`, derogando ese razonamiento
// sin abordarlo. **El fundador lo revirtió el 6-ago-2026, y el motivo es el bueno:**
//
//   «Representante» significa quien puede OBLIGAR al cliente. El profesional no está en
//   condiciones de verificar eso, así que le haríamos afirmar más de lo que sostiene — y con
//   nuestro sello encima, dentro del contenido firmado.
//
// Pero la categoría hace falta: el administrador de una comunidad de propietarios no es ninguna de
// las otras cinco. **«En nombre del cliente» describe el HECHO OBSERVADO sin afirmar la figura
// jurídica**, que es exactamente lo que un albarán puede sostener.
//
// El renombrado se hizo ANTES de la migración. Después habría obligado a migrar filas.

/** Las seis ranuras, en su orden. `id` y etiqueta están CERRADOS: los dos se aprobaron. */
export const FIRMANTE_CALIDAD_IDS = [
  'el_propio_cliente',
  'en_nombre_del_cliente',
  'familiar_o_conviviente',
  'encargado_o_personal_de_obra',
  'portero_o_conserje',
  'otro',
] as const;
export type FirmanteCalidadId = (typeof FIRMANTE_CALIDAD_IDS)[number];

/** La única ranura que además lleva texto libre escrito por el profesional. */
export const FIRMANTE_CALIDAD_LIBRE: FirmanteCalidadId = 'otro';

/**
 * La etiqueta de cada ranura, literales.
 *
 * **Aprobadas por el asesor y validadas por el fundador el 6-ago-2026.**
 * **Consta en SCRUM-300, comentario «Microcopy de FIRMADO POR — FIRMADA».**
 *
 * ⚠️ La referencia NO es decoración: antes aquí ponía «APROBADAS por el fundador» a secas, y eso
 * es exactamente lo que SCRUM-387 vigila. Una marca sin dónde-consta obliga al siguiente lector a
 * creerse la palabra, y en este ticket ya pasó una vez — la rama `scrum-300-firmado-por` traía
 * cinco textos declarados «aprobados tal cual, ni una palabra distinta» que **no había aprobado
 * nadie**. Un texto etiquetado como aprobado es peor que uno con marcador: el marcador pide
 * permiso y la etiqueta falsa lo da.
 * Y el mapa de la fusión (`docs/master/SCRUM-300.md`) recoge el mismo hecho, junto con las dos
 * implementaciones paralelas de las que salió este fichero.
 *
 * ⚠️ Cambiar una etiqueta NO obliga a migrar nada, porque lo que se guarda en
 * `Albaran.firmadoPorCalidad` es el `id`. Cambiar un `id` SÍ. Son dos cosas distintas y por eso
 * viven en dos constantes distintas.
 *
 * ⚠️ Estos seis acaban impresos en un documento que se puede leer en un juzgado. No se «mejoran»:
 * se cambian con una aprobación nueva, anotada, en el mismo commit.
 */
export const FIRMANTE_CALIDAD_ETIQUETAS: Readonly<Record<FirmanteCalidadId, string>> = Object.freeze({
  el_propio_cliente: 'El propio cliente',
  en_nombre_del_cliente: 'En nombre del cliente',
  familiar_o_conviviente: 'Un familiar o conviviente',
  encargado_o_personal_de_obra: 'Encargado o personal de la obra',
  portero_o_conserje: 'Portero o conserje',
  otro: 'Otro',
});

export const FIRMANTE_CALIDAD_SET: ReadonlySet<string> = new Set(FIRMANTE_CALIDAD_IDS);

// ⚠️ SIN opción marcada por defecto, y es deliberado: una casilla premarcada es una declaración
// que el firmante no ha hecho. Lo dice también el comentario de `firmadoPorCalidad` en
// `prisma/schema.prisma`, así que cambiarlo aquí dejaría el schema mintiendo.

// ─── RÓTULOS Y AYUDAS DE LOS CAMPOS ──────────────────────────────────────────────────────

/**
 * Rótulos de los campos que estrena SCRUM-300, en UN solo sitio (dashboard y PDF los leen de aquí).
 *
 * ⚠️ Éstos SÍ tienen aprobación anotada campo a campo, y NO son los textos que el asesor retiró
 * (aquéllos eran las cinco ranuras de «en calidad de qué», arriba).
 *
 *  · `fechaEntrega` — **APROBADO por el fundador el 5-ago-2026**: describe lo que el campo es, no
 *    lo adorna, y es el nombre que la ley usa para ese dato.
 *
 *  · Los DOS DEL PDF — **APROBADOS por el asesor el 5-ago-2026**, y solo DESPUÉS de verlos
 *    literales. Su razón, que vale para cualquier rótulo que acabe impreso: en un PDF que puede
 *    acabar en un juzgado **no se aprueba un rótulo por su descripción**. Se le enseñaron así,
 *    con el espacio final visible y una muestra de cómo salen impresos:
 *        Firmado por: Marta Ruiz Alonso
 *        En calidad de: Personal de la obra
 *
 *    NO llevan el marcador `[PENDIENTE microcopy oficial]` y ya nunca lo llevarán: acaban en un
 *    documento que se lee en un juzgado, y un marcador impreso ahí sería peor que el rótulo.
 */
export const ALBARAN_ROTULOS = {
  /** APROBADO (fundador, 5-ago-2026). */
  fechaEntrega: 'Fecha de entrega',
  /** APROBADO (asesor, 5-ago-2026): describe lo que el campo es. */
  lugarEntrega: 'Lugar de entrega',
  /** APROBADO (asesor, 5-ago-2026): describe lo que el campo es. */
  firmadoPorNombre: 'Nombre de quien firma',
  /** APROBADO (fundador, 6-ago-2026), con sus signos de interrogación: es una pregunta al firmante. */
  firmadoPorCalidad: '¿En calidad de qué firma?',
  // ⚠️ El espacio final de los dos siguientes es PARTE DEL LITERAL, no un descuido: el PDF los
  // pinta con `continued: true`, así que el rótulo va en negrita y el dato se concatena detrás.
  // Quitarlo produce «Firmado por:Marta» — el tipo de defecto que nadie ve hasta que el PDF está
  // delante de alguien que importa. Tiene guard propio.
  /** APROBADO (asesor, 5-ago-2026) con su espacio final — rótulo del bloque de firma del PDF. */
  pdfFirmadoPor: 'Firmado por: ',
  /** APROBADO (asesor, 5-ago-2026) con su espacio final — rótulo del bloque de firma del PDF. */
  pdfEnCalidadDe: 'En calidad de: ',
} as const;

/**
 * Los rótulos que tienen aprobación explícita, con QUIÉN la dio anotado arriba, campo a campo.
 *
 * Que el guard falle cuando este censo cambia es DELIBERADO y es lo que lo separa de una
 * allowlist: una aprobación nueva obliga a tocar el test en el mismo commit, así que queda en el
 * diff **quién aprobó qué y cuándo**. Un texto aprobado sin rastro de quién lo aprobó vuelve a ser
 * un texto que cualquiera cambia.
 *
 * Hoy están los seis. Que el censo esté completo NO lo convierte en decorado: si mañana nace un
 * rótulo nuevo, nacerá FUERA de esta lista y el guard lo dirá.
 */
export const ALBARAN_ROTULOS_APROBADOS = [
  'fechaEntrega',
  'lugarEntrega',
  'firmadoPorNombre',
  'firmadoPorCalidad',
  'pdfFirmadoPor',
  'pdfEnCalidadDe',
] as const;

/**
 * Textos de AYUDA bajo cada campo del formulario. Vienen de la rama `scrum-300-campos-albaran`
 * (que no tenía rótulos con ayuda en B) y explican POR QUÉ se pide el dato, no qué teclear.
 *
 * ⚠️ No van al PDF: son ayuda de formulario. Se traen literales por decisión del mapa de fusión.
 */
export const ALBARAN_AYUDAS = {
  lugarEntrega: 'Dónde se ha hecho el trabajo, si no es la dirección del cliente. Sale en el albarán y queda dentro de la firma.',
  fechaEntrega: 'El día que se entregó, que no siempre es el día que se creó.',
  firmadoPorNombre: 'Una firma sin nombre no identifica a nadie. Con el nombre, el albarán vale como prueba de entrega si algún día hay discusión.',
  /** El chip de sugerencia de UN TOQUE. `%s` = nombre del cliente. */
  chipNombreCliente: 'Es %s',
  /**
   * Lo que se enseña en un albarán FIRMADO ANTES de esta tarea, que nunca tuvo estos datos.
   * No es un error ni culpa de nadie: es que no se preguntó. Un hueco mudo en un documento
   * legal se lee como un fallo del sistema.
   */
  noSePidio: 'No se pidió al firmar',
} as const;

// ─── TOPES ───────────────────────────────────────────────────────────────────────────────
//
// Decisión del asesor (SCRUM-300, 5-ago-2026): el nombre a 160 y no a 120. «El coste de un límite
// corto es truncar el nombre legal de una persona en un documento firmado; el de uno generoso es
// ninguno.» Es validación, no estilo.
export const FIRMANTE_NOMBRE_MAX = 160;
export const FIRMANTE_OTRO_MAX = 120;
export const LUGAR_ENTREGA_MAX = 300;

/** Lo que viaja al navegador por `/admin/me` para que pinte el desplegable SIN reescribir nada. */
export function firmanteCalidadOpciones(): Array<{ id: FirmanteCalidadId; etiqueta: string; libre: boolean }> {
  return FIRMANTE_CALIDAD_IDS.map((id) => ({
    id,
    etiqueta: FIRMANTE_CALIDAD_ETIQUETAS[id],
    libre: id === FIRMANTE_CALIDAD_LIBRE,
  }));
}

// ─── «OTRO ______», SIN PEDIR UNA COLUMNA MÁS ────────────────────────────────────────────
//
// El fundador aprobó CUATRO columnas, y el schema es territorio suyo. La ranura libre necesita
// guardar además QUÉ escribió el firmante, así que se codifica dentro del mismo valor:
// `otro:Vecina del 3.º`. El `id` queda antes de los dos puntos y el texto detrás. Se documenta
// aquí porque un formato implícito en dos sitios es un formato roto.
//
// Ningún `id` contiene `:`, así que partir por el PRIMERO es inequívoco aunque el texto libre
// traiga los suyos.

const SEP_CALIDAD = ':';

export function codificarCalidad(id: string, textoLibre?: string | null): string {
  const t = String(textoLibre ?? '').trim().replace(/\s+/g, ' ').slice(0, FIRMANTE_OTRO_MAX);
  return t ? `${id}${SEP_CALIDAD}${t}` : id;
}

export function decodificarCalidad(valor: string | null | undefined): { id: string | null; textoLibre: string | null } {
  if (!valor) return { id: null, textoLibre: null };
  const i = String(valor).indexOf(SEP_CALIDAD);
  if (i < 0) return { id: String(valor), textoLibre: null };
  return { id: String(valor).slice(0, i), textoLibre: String(valor).slice(i + 1) || null };
}

/**
 * La etiqueta para pintar una calidad YA GUARDADA. Un `id` desconocido NO se inventa: se declara
 * con el marcador. En la ranura libre lo que se enseña es el texto que escribió el profesional.
 */
export function etiquetaCalidad(valor: string | null | undefined): string | null {
  const { id, textoLibre } = decodificarCalidad(valor);
  if (!id) return null;
  if (id === FIRMANTE_CALIDAD_LIBRE && textoLibre) return textoLibre;
  return FIRMANTE_CALIDAD_SET.has(id) ? FIRMANTE_CALIDAD_ETIQUETAS[id as FirmanteCalidadId] : PENDIENTE;
}

// ─── NORMALIZACIÓN Y VALIDACIÓN ──────────────────────────────────────────────────────────

// APROBADOS (fundador, 6-ago-2026). Venían de la rama `scrum-300-firmado-por` como literales que
// nadie había aprobado — la misma clase de texto que las cinco ranuras retiradas. Reescritos.
export const COPY_CALIDAD_INVALIDA = 'Esa opción no existe. Recarga la página y vuelve a intentarlo.';
export const COPY_CALIDAD_OTRO_VACIO = 'Si eliges «Otro», escribe en calidad de qué firma.';

export type ResolucionCalidad =
  | { ok: true; valor: string | null }
  | { ok: false; error: string; message: string };

/**
 * Convierte lo que manda el cliente (`{ ranura, textoLibre }`) en el VALOR que se guarda en
 * `Albaran.firmadoPorCalidad`, que es el `id` (con el texto libre codificado detrás si la ranura
 * es `otro`).
 *
 * ⚠️ Se guarda el `id` y NO la etiqueta, por decisión del asesor: la etiqueta es pantalla y puede
 * cambiar —hoy ni siquiera está aprobada—, y un cambio de rótulo no puede obligar a reescribir el
 * campo de un documento ya firmado.
 *
 * Ausente = `null`, sin error: los tres campos son opcionales y un albarán sin ellos es válido
 * (es exactamente lo que son todos los ya firmados).
 */
export function resolverCalidadFirmante(entrada: { ranura?: unknown; textoLibre?: unknown }): ResolucionCalidad {
  const ranura = entrada?.ranura === undefined || entrada?.ranura === null ? '' : String(entrada.ranura).trim();
  if (!ranura) return { ok: true, valor: null };

  if (!FIRMANTE_CALIDAD_SET.has(ranura)) {
    // Un id fuera de la lista NO se guarda «por si acaso»: se rechaza. Guardar basura en un campo
    // probatorio es peor que no tenerlo.
    return {
      ok: false,
      error: 'calidad_firmante_invalida',
      // APROBADO (fundador, 6-ago-2026). Dice QUÉ HACER a propósito: si un profesional llega aquí
      // es que su pantalla está desincronizada con las ranuras servidas, y recargar es la salida.
      message: COPY_CALIDAD_INVALIDA,
    };
  }

  if (ranura !== FIRMANTE_CALIDAD_LIBRE) return { ok: true, valor: ranura };

  // Ranura libre: sin su texto no dice nada, así que se exige.
  const libre = String(entrada?.textoLibre ?? '').trim();
  if (!libre) {
    return {
      ok: false,
      error: 'calidad_firmante_otro_vacio',
      message: COPY_CALIDAD_OTRO_VACIO,
    };
  }
  return { ok: true, valor: codificarCalidad(ranura, libre) };
}

/** Normaliza el nombre de quien firma. Vacío → `null` (nunca la cadena vacía en la BD). */
export function normalizarNombreFirmante(v: unknown): string | null {
  const s = String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, FIRMANTE_NOMBRE_MAX);
  return s || null;
}

/**
 * 🔴 EL NOMBRE ES OBLIGATORIO AL FIRMAR, Y LA COLUMNA ES NULLABLE. Las dos cosas a la vez, y no
 * es una contradicción: **contestan a preguntas distintas** (decisión del fundador, 6-ago-2026).
 *
 *  · La COLUMNA admite nulo por las filas VIEJAS. Los albaranes firmados antes de C5 no tienen
 *    estos campos y tienen que seguir abriéndose, imprimiéndose y facturándose. No se negocia:
 *    es retrocompatibilidad, y `null` significa ahí «no se pidió al firmar».
 *  · El FORMULARIO lo exige porque es EL valor del ticket. C5 existe porque «guardamos un trazo
 *    sin nombre», y un nombre opcional deja el mismo trazo sin nombre en cuanto alguien tenga
 *    prisa — que en una obra es siempre.
 *
 * Por eso el guard vive AQUÍ y no en el schema: es una regla del acto de firmar, no del dato.
 * Y vive en UNA función porque firman DOS rutas (in situ y remota): si cada una validara por su
 * cuenta, una acabaría aceptando lo que la otra rechaza y no nos enteraríamos hasta el juicio.
 *
 * El `message` está APROBADO (fundador, 6-ago-2026). El front bloquea el botón, así que esto es
 * el respaldo — pero un respaldo que el profesional puede llegar a ver también es microcopy.
 */
export const COPY_FIRMA_SIN_NOMBRE = 'Falta el nombre de quien firma.';

export function exigirNombreFirmante(v: unknown): { ok: true; nombre: string } | { ok: false; error: string; message: string } {
  const nombre = normalizarNombreFirmante(v);
  if (!nombre) return { ok: false, error: 'firma_sin_nombre', message: COPY_FIRMA_SIN_NOMBRE };
  return { ok: true, nombre };
}

/**
 * Normaliza el lugar de entrega. ⚠️ SUELO (lo pide el ticket y el asesor lo reafirma): vacío se
 * queda VACÍO. Nunca se cae al domicilio fiscal ni a ninguna otra dirección «parecida» — poner
 * la dirección equivocada en un documento de entrega es peor que dejarla en blanco.
 */
export function normalizarLugarEntrega(v: unknown): string | null {
  const s = String(v ?? '').trim().slice(0, LUGAR_ENTREGA_MAX);
  return s || null;
}
