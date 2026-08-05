// src/modules/jobs/domain/albaranFirmante.ts — SCRUM-300 (C5)
//
// FUENTE ÚNICA de la microcopy de «FIRMADO POR» y del rótulo de la fecha de entrega.
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
// El navegador **recibe** las ranuras por `/admin/me` y no las reimplementa — mismo criterio,
// escrito, de SCRUM-289: «dos copias del criterio es cómo se llega a que el back acepte lo que
// el front esconde». `tests/scrum300-microcopy-firmante.test.mjs` fija los textos carácter a
// carácter y comprueba que ninguna vista los escribe por su cuenta.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTAS CINCO Y NO OTRAS — el razonamiento va aquí para que nadie las «mejore»
//
// Se evitan a propósito «representante», «autorizado» y «apoderado»: son AFIRMACIONES JURÍDICAS
// que el profesional no puede sostener, y meterlas en un documento que él firma lo pone a él en
// el aprieto. «Personal de la obra» describe DÓNDE ESTABA quien firmó, no de quién depende — y
// eso es deliberado: quién es concretamente lo captura el campo NOMBRE, que es un dato y no una
// calificación.
//
// La jurisprudencia que lo justifica dice las dos cosas juntas: «las firmas ilegibles o no
// identificadas requieren prueba complementaria» y «es habitual que personal de la misma obra
// rubrique la recepción». Identificar al firmante es lo que separa esas dos frases.

/** Las cinco ranuras APROBADAS por el fundador (5-ago-2026). El orden es el aprobado. */
export const FIRMANTE_CALIDAD_RANURAS = ['cliente', 'convive', 'obra', 'porteria', 'otro'] as const;
export type FirmanteCalidadRanura = (typeof FIRMANTE_CALIDAD_RANURAS)[number];

/**
 * El texto EXACTO de cada ranura. Aprobado «tal cual, ni una palabra distinta».
 *
 * ⚠️ La quinta se aprobó como «Otro + texto libre»: «Otro» es el RÓTULO y «+ texto libre»
 * describe el campo que lo acompaña, no forma parte del rótulo. Por eso aquí pone `Otro`.
 */
export const FIRMANTE_CALIDAD_TEXTOS: Record<FirmanteCalidadRanura, string> = {
  cliente: 'El propio cliente',
  convive: 'Un familiar o alguien que vive en el domicilio',
  obra: 'Personal de la obra',
  porteria: 'Portero o conserje del edificio',
  otro: 'Otro',
};

/**
 * Rótulos de los campos que estrena SCRUM-300, en UN solo sitio (dashboard y PDF los leen de aquí).
 *
 * ⚠️ DOS PROCEDENCIAS DISTINTAS, y la diferencia importa (regla 30):
 *
 *  · `fechaEntrega` — **APROBADO por el fundador el 5-ago-2026**, con su razón escrita: describe
 *    lo que el campo es, no lo adorna, y es el nombre que la ley usa para ese dato. No es columna
 *    nueva: es el rótulo con el que se expone `Albaran.fecha`, que YA era la fecha de entrega
 *    (sellada, impresa y clave del mes natural de la recapitulativa) y que ninguna UI escribía.
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
  /** APROBADO (asesor, 5-ago-2026): viene LITERAL del enunciado del ticket, no es redacción nueva. */
  firmadoPorCalidad: 'En calidad de qué',
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

/** La ranura precargada: el caso mayoritario es que firme el propio cliente. */
export const FIRMANTE_CALIDAD_POR_DEFECTO: FirmanteCalidadRanura = 'cliente';

/** Topes de longitud. Un albarán no es un formulario largo; recortar en obra es peor que acotar. */
export const FIRMANTE_NOMBRE_MAX = 160;
export const FIRMANTE_OTRO_MAX = 120;
export const LUGAR_ENTREGA_MAX = 300;

/** Lo que viaja al navegador por `/admin/me` para que pinte el desplegable SIN reescribir nada. */
export function firmanteCalidadOpciones(): Array<{ ranura: FirmanteCalidadRanura; texto: string; libre: boolean }> {
  return FIRMANTE_CALIDAD_RANURAS.map((r) => ({
    ranura: r,
    texto: FIRMANTE_CALIDAD_TEXTOS[r],
    libre: r === 'otro',
  }));
}

export type ResolucionCalidad =
  | { ok: true; texto: string | null }
  | { ok: false; error: string; message: string };

/**
 * Convierte lo que manda el cliente (`{ ranura, textoLibre }`) en el TEXTO que se guarda y se
 * imprime. Se guarda resuelto —y no la clave de la ranura— porque lo que se sella debe ser lo
 * que el documento DICE: así un cambio futuro de rótulo no reescribe lo que alguien ya firmó.
 *
 * Ausente = `null`, sin error: los tres campos son opcionales y un albarán sin ellos es válido
 * (es exactamente lo que son todos los ya firmados).
 */
export function resolverCalidadFirmante(entrada: { ranura?: unknown; textoLibre?: unknown }): ResolucionCalidad {
  const ranura = entrada?.ranura === undefined || entrada?.ranura === null ? '' : String(entrada.ranura).trim();
  if (!ranura) return { ok: true, texto: null };

  if (!(FIRMANTE_CALIDAD_RANURAS as readonly string[]).includes(ranura)) {
    return {
      ok: false,
      error: 'calidad_firmante_invalida',
      message: 'La calidad de quien firma no es una de las opciones válidas.',
    };
  }

  if (ranura !== 'otro') {
    return { ok: true, texto: FIRMANTE_CALIDAD_TEXTOS[ranura as FirmanteCalidadRanura] };
  }

  // Ranura "otro": el texto libre es lo que se imprime, así que sin él la ranura no dice nada.
  const libre = String(entrada?.textoLibre ?? '').trim().slice(0, FIRMANTE_OTRO_MAX);
  if (!libre) {
    return {
      ok: false,
      error: 'calidad_firmante_otro_vacio',
      message: 'Al elegir «Otro», escribe en calidad de qué firma.',
    };
  }
  return { ok: true, texto: libre };
}

/** Normaliza el nombre de quien firma. Vacío → `null` (nunca la cadena vacía en la BD). */
export function normalizarNombreFirmante(v: unknown): string | null {
  const s = String(v ?? '').trim().slice(0, FIRMANTE_NOMBRE_MAX);
  return s || null;
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
