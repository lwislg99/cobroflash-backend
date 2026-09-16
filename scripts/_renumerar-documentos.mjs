// scripts/_renumerar-documentos.mjs — SCRUM-592 (DOC-02)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL PLAN DE RENUMERACIÓN, PURO. Entra la lista de documentos, sale qué número le toca a cada uno.
//
// Separado del disco y de la base por el mismo motivo que `_suelo-de-la-tanda.mjs`: así el rojo
// se ejercita —el reinicio de año, la idempotencia, el orden— sin tocar ninguna base y sin
// esperar a enero de 2027.
//
// ── P-DOC-7, RESUELTO POR EL FUNDADOR (4-sep-2026): LOS EXISTENTES SE RENUMERAN ───────────────
//
// Ni el presupuesto ni el albarán son documentos fiscales, así que hay libertad. La elección es
// UNA sola numeración, no dos formatos conviviendo.
//
// 🔴 Y RENUMERAR REESCRIBE UN DATO QUE EL CLIENTE YA VIO, así que se midió antes de decidir:
//   · el número está IMPRESO dentro del PDF y en el nombre del fichero generado;
//   · viaja al cliente como variable de la plantilla de WhatsApp;
//   · **pero los enlaces van por `id`, no por número** — 4 de 4 medidos en `yaqu_dev_javier`.
// Por eso esto es reversible: **ningún PDF deja de abrirse**. El daño posible es de BÚSQUEDA —el
// cliente dice «el #16» y el profesional no lo encuentra—, no de acceso. Romper un enlace no
// tendría vuelta atrás; esto sí.
//
// ── EL ORDEN ES POR FECHA DE CREACIÓN, NO POR ID ─────────────────────────────────────────────
//
// No es lo mismo, y está medido: en `yaqu_dev_javier` los dos órdenes DIFIEREN. El id es un
// contador global de la plataforma y puede no seguir el orden en que ese profesional creó sus
// documentos; la fecha sí. Una serie correlativa que no siga la cronología del que la usa no
// resuelve el problema del ticket: lo cambia de sitio.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * El plan: a cada documento, el número que le toca.
 *
 * @param {Array<{id:number, merchantId:number, createdAt:Date|string, numeroActual:string|null}>} docs
 * @param {(serie:string, year:number, seq:number)=>string} formatear
 * @param {string} serie  la letra de la serie (`P`, `AB`)
 * @param {(n:string|null)=>boolean} yaRenumerado
 * @returns {{ plan: Array, contadores: Map<string,{merchantId:number,year:number,siguiente:number}>, saltados: number }}
 */
export function planDeRenumeracion(docs, { formatear, serie, yaRenumerado }) {
  const lista = Array.isArray(docs) ? [...docs] : [];

  // 🔴 ORDEN ESTABLE Y EXPLÍCITO: por fecha, y a igualdad de fecha por id. Sin el desempate, dos
  // documentos creados en el mismo milisegundo podrían intercambiarse entre dos ejecuciones y la
  // renumeración dejaría de ser idempotente sin que nada lo dijera.
  lista.sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return ta === tb ? a.id - b.id : ta - tb;
  });

  const contadores = new Map();   // "merchant:año" → siguiente secuencia
  const plan = [];
  let saltados = 0;

  for (const d of lista) {
    const year = new Date(d.createdAt).getFullYear();
    const clave = `${d.merchantId}:${year}`;
    const seq = (contadores.get(clave)?.siguiente) ?? 1;

    // 🔴 IDEMPOTENCIA: un documento YA renumerado no se vuelve a tocar, PERO SÍ CONSUME SU
    // NÚMERO. Si se saltara sin consumir, la segunda pasada le daría su número a otro y habría
    // dos documentos con el mismo — el defecto exacto que esto viene a cerrar.
    const numero = formatear(serie, year, seq);
    contadores.set(clave, { merchantId: d.merchantId, year, siguiente: seq + 1 });

    if (yaRenumerado(d.numeroActual)) {
      saltados++;
      continue;
    }
    plan.push({ id: d.id, merchantId: d.merchantId, year, seq, de: d.numeroActual, a: numero });
  }
  return { plan, contadores, saltados };
}

/**
 * Los contadores que hay que dejar en `Merchant` después de renumerar.
 *
 * Sin esto, el siguiente documento que se cree repetiría un número ya asignado: la renumeración
 * habría arreglado el pasado y roto el futuro.
 *
 * Sólo se devuelve el año MÁS ALTO de cada merchant: es el que manda para lo que venga.
 */
export function contadoresFinales(contadores) {
  const porMerchant = new Map();
  for (const c of contadores.values()) {
    const previo = porMerchant.get(c.merchantId);
    if (!previo || c.year > previo.year) porMerchant.set(c.merchantId, c);
  }
  return [...porMerchant.values()];
}
