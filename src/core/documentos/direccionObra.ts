// src/core/documentos/direccionObra.ts — SCRUM-602 (DOC-12)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA DIRECCIÓN DE LA OBRA DE UN DOCUMENTO: los tres modos, y de dónde sale el texto.
//
// El profesional trabaja en un sitio y factura a otro. Hasta hoy el documento sólo sabía
// nombrar a QUIEN PAGA, así que la dirección de la obra no cabía en ninguna parte — y el
// producto ya había tenido que separarlas una vez: `Albaran.lugarEntrega` (SCRUM-300, C5) dice
// literalmente «el lugar del trabajo puede no ser el domicilio de quien paga».
//
// ── ESTE FICHERO NO INVENTA EL MECANISMO, LE DA SUPERFICIE ─────────────────────────────────
//
// El albarán YA resolvió esto y es EL PATRÓN: campo PROPIO del documento, normalizador que
// nunca cae a otra dirección, y el dato entra en el papel sólo si lo hay. Lo que aquí se añade
// es lo que el albarán no necesitaba: un MODO, porque en el presupuesto la dirección de la obra
// coincide a menudo con la de facturación y teclearla dos veces es el camino a que difieran.
//
// ── 🔴 EL SUELO, ADOPTADO LITERAL DEL ALBARÁN (asesor, 4-sep-2026) ─────────────────────────
//
//     «si no hay dirección de obra se deja VACÍO; la sugerencia entra sólo como PLACEHOLDER,
//      porque una dirección equivocada en un documento de entrega es peor que ninguna.»
//
// De ahí sale la única regla que importa de todo el fichero: **el modo `PERSONALIZADA` NUNCA se
// rellena con la de facturación**. Si el profesional quiere la de facturación, elige ese modo y
// el documento la resuelve; si escribe una, es la suya. Prerrellenar el campo libre con la
// fiscal produciría documentos con una dirección que nadie tecleó y que nadie revisó.
//
// ── DOS COLUMNAS Y NO UNA ──────────────────────────────────────────────────────────────────
//
// Tres opciones no se derivan de un solo campo de texto: `UTILIZAR_FACTURACION` **no tiene dato
// propio**, y `NO_MOSTRAR` tampoco. Con una sola columna, «vacío» tendría que significar las
// dos cosas a la vez. El albarán usa un campo único porque allí el modo es implícito: sólo
// existe el equivalente de `PERSONALIZADA`.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Los tres modos. Son los VALORES que viajan y se guardan, no los rótulos: el texto que ve el
 * profesional vive en `public/dashboard/js/quoteDireccionObra.js` y lo firma el fundador
 * (regla 30). Separarlos es lo que permite cambiar un rótulo sin migrar una columna.
 */
export const MODO_NO_MOSTRAR = 'no_mostrar';
export const MODO_FACTURACION = 'facturacion';
export const MODO_PERSONALIZADA = 'personalizada';

export const MODOS_DIRECCION_OBRA = [
  MODO_NO_MOSTRAR,
  MODO_FACTURACION,
  MODO_PERSONALIZADA,
] as const;

export type ModoDireccionObra = (typeof MODOS_DIRECCION_OBRA)[number];

/**
 * Mismo tope que `LUGAR_ENTREGA_MAX` y `JOB_DIRECCION_MAX` (300) y con constante PROPIA, no
 * importada: el motivo lo dejó escrito `jobDireccion.ts` y vale igual aquí — «el valor coincide
 * porque los dos son direcciones postales españolas, no porque sean el mismo campo». Compartir
 * la constante ataría tres datos distintos y cambiar el tope de uno movería los otros dos.
 */
export const DIRECCION_OBRA_MAX = 300;

/** ¿Es uno de los tres? Un modo que no conocemos NO se guarda: no se adivina cuál quiso decir. */
export function esModoDireccionObra(v: unknown): v is ModoDireccionObra {
  return typeof v === 'string' && (MODOS_DIRECCION_OBRA as readonly string[]).includes(v);
}

/**
 * El modo tal y como se guarda. `null` = «este documento no dice nada del asunto», que es lo que
 * tienen TODOS los presupuestos anteriores a este ticket y NO es `NO_MOSTRAR`:
 *
 *   · `null`        → nadie decidió. El documento sale exactamente como salía.
 *   · `NO_MOSTRAR`  → alguien decidió que no salga.
 *
 * Los dos imprimen lo mismo hoy. Se distinguen igual, porque el día que el bloque tenga un
 * defecto distinto de «oculto» —o que alguien quiera censar cuántos profesionales lo usan— la
 * diferencia deja de ser filosófica. Es «AUSENTE ≠ CERO», la regla de `costeParaPayload`.
 */
export function normalizarModoDireccionObra(v: unknown): ModoDireccionObra | null {
  return esModoDireccionObra(v) ? v : null;
}

/**
 * El texto libre, saneado. Vacío se queda VACÍO — misma regla, palabra por palabra, que
 * `normalizarLugarEntrega` y `normalizarJobDireccion`, y por el mismo motivo.
 */
export function normalizarDireccionObra(v: unknown): string | null {
  const s = String(v ?? '').trim().slice(0, DIRECCION_OBRA_MAX);
  return s || null;
}

/** Lo que hace falta saber de un cliente para componer su dirección de facturación. */
export type ClienteConFacturacion = {
  billingAddress?: string | null;
  billingPostalCode?: string | null;
  billingCity?: string | null;
  billingProvince?: string | null;
  billingCountry?: string | null;
};

/**
 * La dirección de facturación del cliente en UNA línea, o `null` si no tiene ninguna.
 *
 * ⚠️ `null` y no `''`: un cliente sin dirección fiscal NO produce una dirección de obra vacía —
 * produce un documento sin bloque, que es el suelo del albarán. Por eso se filtran los trozos
 * vacíos antes de unir: sin esto, un cliente con sólo provincia daría «, , , Sevilla, » impreso
 * en un papel que va a un cliente final.
 *
 * El orden es el postal español: calle · CP · población · provincia · país.
 */
export function componerDireccionFacturacion(c: ClienteConFacturacion | null | undefined): string | null {
  if (!c) return null;
  const trozos = [c.billingAddress, c.billingPostalCode, c.billingCity, c.billingProvince, c.billingCountry]
    .map((t) => String(t ?? '').trim())
    .filter((t) => t !== '');
  return trozos.length ? trozos.join(', ') : null;
}

/**
 * EL RESOLVEDOR: qué texto imprime el documento, dados su modo y su texto propio.
 *
 * 🔴 UN SOLO SITIO, y es el punto entero del fichero. La pantalla previsualiza, el PDF imprime y
 * mañana la factura copiará: si cada uno resolviera por su cuenta, el papel y la pantalla podrían
 * decir direcciones distintas del mismo documento. Es la lección de SCRUM-624 —doce sitios
 * calculando dinero— aplicada antes de que haya doce.
 *
 * `modo` desconocido o ausente → `null`. Ante «no sé», NO se imprime: el suelo del albarán dice
 * que una dirección equivocada en un documento es peor que ninguna, y una que nadie eligió es la
 * definición de equivocada.
 */
export function resolverDireccionObra(params: {
  modo: unknown;
  personalizada?: string | null;
  cliente?: ClienteConFacturacion | null;
}): string | null {
  const modo = normalizarModoDireccionObra(params.modo);
  if (modo === MODO_PERSONALIZADA) return normalizarDireccionObra(params.personalizada);
  if (modo === MODO_FACTURACION) return componerDireccionFacturacion(params.cliente);
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL RÓTULO QUE SE IMPRIME EN EL PAPEL
//
// ✅ APROBADO por el ASESOR el 4-sep-2026, **provisional a la espera del fundador** (regla 30).
// PROCEDENCIA: `docs/master/SCRUM-602.md`, sección de microcopy. Sin decir DÓNDE consta,
// «aprobado» es una afirmación que nadie puede comprobar (SCRUM-387).
//
// ⚠️ SIN MARCADOR en pantalla ni en el papel, mismo criterio que `filtroClientes.js` y que los
// tres rótulos de SCRUM-599: que no se pinte el corchete NO significa que esté firmado por el
// fundador — eso lo dice `SIN_APROBAR`, abajo.
//
// 🔴 ES LA MISMA PALABRA QUE EL RÓTULO DEL CONTROL, y tiene que serlo: el profesional elige
// «Dirección de la obra» en la pantalla y el cliente lee «Dirección de la obra» en el PDF. Como
// el front es vanilla y no puede importar este fichero, la copia vive en
// `public/dashboard/js/quoteDireccionObra.js` y un test las ata por identidad. No se puede hacer
// IMPOSIBLE sin un bundler, así que se hace VIGILADO — y el guard nombra las dos.
// ═══════════════════════════════════════════════════════════════════════════════════════════
export const ROTULO_DIRECCION_OBRA_PDF = 'Dirección de la obra';

/**
 * Cuántas ranuras de microcopy estrena esta pieza **sin la firma del fundador**. Son CUATRO: el
 * rótulo (que se pinta en la pantalla y en el papel, y cuenta UNA vez porque es un solo texto) y
 * las tres opciones del selector.
 *
 * Se queda aunque llegue a 0, por el motivo que dejó escrito `filtroClientes.js`: el día que
 * alguien añada un cuarto modo, su rótulo nace sin firma y este número tiene que subir. Borrarlo
 * dejaría el hueco sin sitio donde declararse.
 */
export const SIN_APROBAR_DIRECCION_OBRA = 4;
