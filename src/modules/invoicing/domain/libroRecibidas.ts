// src/modules/invoicing/domain/libroRecibidas.ts — SCRUM-426 (A6).
//
// EL LIBRO DE FACTURAS RECIBIDAS. Hermano de `libroRegistro.ts` (emitidas, SCRUM-296), y con las
// mismas reglas duras: PURO —recibe los gastos ya leídos, no toca la base—, filtra por merchant
// aunque la consulta ya lo haga, y **cuenta todo lo que descarta**.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA FRONTERA, Y POR QUÉ ESTE FICHERO ESTÁ EN A6 Y NO EN E4
//
// A6 decide QUÉ es un asiento. E4 decide CÓMO SALE (columnas, orden, CSV, periodo). Que el módulo
// de entrega leyera `Expense` y armara los asientos por su cuenta sería **que la capa de formato
// calcule** — y entonces una cifra del fichero podría discrepar del libro sin que nadie supiera
// cuál manda. Aquí no se formatea NADA: no hay columnas, ni CSV, ni rótulos.
//
// ⚠️ Y NO se llama «Libro Registro de la AEAT» en ninguna parte, igual que su hermano: ese nombre
// es una promesa y **no hay en este árbol ningún documento oficial contra el que contrastar el
// formato** (medido el 10-ago-2026; es la pregunta P15.1 al asesor).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL DEFECTO QUE ESTE LIBRO NO PUEDE TENER
//
// Un periodo **sin compras** y un lector que **no supo mirar** producen el mismo libro vacío, y
// significan lo contrario: el primero es correcto, el segundo le dice a un despacho «este trimestre
// no compró nada». Por eso `miradas` viaja SIEMPRE con el libro, igual que en emitidas: es el único
// dato que separa las dos cosas, y sin él no hay nada que entregar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 Y EL QUE DECIDE EL ALCANCE: UN GASTO SIN `baseAmount` NO ES UN ASIENTO
//
// Las columnas fiscales de `Expense` entraron el 10-ago-2026 y **nacieron a NULL**: TODAS las filas
// anteriores las tienen vacías, y no se rellenaron por suposición porque `amount` es ambiguo por
// diseño —nadie escribió nunca si lleva IVA ni a qué tipo—.
//
// Decisión de este módulo, con su motivo: **un gasto sin `baseAmount` NO entra como asiento, y se
// declara.** Las tres alternativas y por qué no:
//
//   · **Entrarlo con base 0** — imposible: sería afirmar «compró y la base fue cero». Un cero es
//     una afirmación y aquí no se sabe. Es literalmente el defecto de SCRUM-403 en el otro lado.
//   · **Entrarlo con `amount` como base** — sería inventar los datos fiscales de alguien y
//     entregárselos a Hacienda con su nombre encima. `amount` puede ser base o total: no consta.
//   · **Entrarlo con las celdas vacías**, como hace emitidas con `importeIlegible` — tampoco, y la
//     asimetría es deliberada: una factura EMITIDA sin importe legible **sigue siendo un hecho
//     fiscal** (tiene número, salió de casa, la serie la consumió); omitirla escondería una
//     emisión real. Un gasto sin clasificar **no es una factura recibida**: es un apunte de caja,
//     que es exactamente lo que el schema dice de él. No se omite un asiento — es que no lo hay.
//
// **Pero excluir en silencio sería el mismo defecto con otra cara.** Un profesional con 200 gastos
// y 190 sin clasificar tendría un libro de 10 asientos que se lee como «compré diez cosas». Por eso
// `sinClasificar` y `sinClasificarImporte` viajan con el libro, igual que `sinNumero` y
// `sinNumeroImporte` en emitidas: **se excluye Y SE DICE, con su recuento y su dinero.**

/** Lo que el libro necesita de cada gasto. Deliberadamente poco: esto solo LEE. */
export interface GastoParaLibro {
  id?: number;
  merchantId: number;
  /** Fecha del APUNTE. No es la de expedición del proveedor — ver `fechaExpedicion`. */
  date: Date | string | null;
  concept: string | null;
  /** El importe de caja de siempre. AMBIGUO por diseño: no consta si es base o total. */
  amount: unknown;
  currency: string | null;
  providerId: number | null;
  /** SCRUM-403/E4 · las columnas fiscales. Todas nullable: nacieron a NULL el 10-ago-2026. */
  baseAmount: unknown;
  vatRate: unknown;
  vatAmount: unknown;
  vatDeducible: boolean | null;
  providerInvoiceNumber: string | null;
  providerInvoiceDate: Date | string | null;
}

export interface AsientoRecibida {
  /** Nº y serie de la factura DEL PROVEEDOR. `null` = clasificada pero sin identificar. */
  numeroProveedor: string | null;
  /** Fecha de EXPEDICIÓN del proveedor. `null` si no consta: no se sustituye por la del apunte. */
  fechaExpedicion: string | null;
  /** Fecha del apunte. Es otra cosa y por eso viaja aparte (P15.1 al asesor). */
  fechaApunte: string | null;
  proveedorId: number | null;
  concepto: string | null;
  base: number | null;
  /** Tipo en ENTERO de porcentaje (21/10/4/0), la convención de la columna. */
  tipoIva: number | null;
  /** La cuota GUARDADA. Ver `sinCuota`: aquí no se deriva de base × tipo. */
  cuota: number | null;
  /** `null` = nunca clasificado · `false` = se decidió que no. No son lo mismo. */
  deducible: boolean | null;
  total: number | null;
  moneda: string | null;
}

export interface LibroRecibidas {
  asientos: AsientoRecibida[];
  /** Cuántos gastos se examinaron. Es lo que distingue «no había» de «no supe leer». */
  miradas: number;
  /** Filas descartadas por no ser de este merchant. Se cuentan, nunca se tiran en silencio. */
  ajenas: number;
  /** Gastos SIN `baseAmount`: no son asiento. Se excluyen Y se declaran. */
  sinClasificar: number;
  /** El DINERO de esos gastos, no solo cuántos son: «hay 190 fuera» no se puede revisar a mano. */
  sinClasificarImporte: number;
  /** Asientos clasificados a los que les falta el nº del proveedor. Entran, pero se cuentan. */
  sinNumeroProveedor: number;
  /** Asientos con base y tipo pero SIN cuota guardada. Entran con `cuota: null` — no se deriva. */
  sinCuota: number;
  /** Asientos cuya deducibilidad nunca se decidió (`vatDeducible` a null). */
  sinDeducibilidadDecidida: number;
}

/**
 * Lee un importe SIN coercionar. `null` si no es utilizable.
 *
 * ⚠️ `Array.isArray` primero: `Number([])` es **0**, y un array vacío entrando como cero es la
 * familia de defectos de SCRUM-271/367. Idéntico al de `libroRegistro.ts` a propósito — dos
 * lectores de importe con criterios distintos acabarían discrepando en un céntimo.
 */
function importe(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (Array.isArray(valor)) return null;
  if (typeof valor === 'object' && typeof (valor as any).toString === 'function') {
    const n = Number((valor as any).toString());
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** El tipo de IVA, en entero de porcentaje. `null` si no es un entero utilizable. */
function tipo(valor: unknown): number | null {
  const n = importe(valor);
  if (n === null || !Number.isInteger(n) || n < 0 || n > 100) return null;
  return n;
}

function fechaIso(valor: Date | string | null): string | null {
  if (valor instanceof Date) return Number.isFinite(valor.getTime()) ? valor.toISOString() : null;
  return typeof valor === 'string' && valor !== '' ? valor : null;
}

/**
 * Construye el libro de recibidas. Puro: recibe los gastos ya leídos y no toca la base.
 *
 * ⚠️ FILTRA POR MERCHANT AQUÍ TAMBIÉN, aunque la consulta ya lo haga — mismo motivo que su
 * hermano: el guard de tenencia de SCRUM-243 tiene un agujero conocido (SCRUM-348), y apoyarse solo
 * en él dejaría el aislamiento de un documento fiscal colgando de algo que ya se sabe incompleto.
 * Y lo que se filtra SE CUENTA: un descarte silencioso es indistinguible de un dato que nunca fue.
 */
export function construirLibroRecibidas(params: {
  gastos: readonly GastoParaLibro[];
  merchantId: number;
}): LibroRecibidas {
  const asientos: AsientoRecibida[] = [];
  let ajenas = 0;
  let sinClasificar = 0;
  let sinClasificarImporte = 0;
  let sinNumeroProveedor = 0;
  let sinCuota = 0;
  let sinDeducibilidadDecidida = 0;

  for (const g of params.gastos) {
    if (g.merchantId !== params.merchantId) { ajenas += 1; continue; }

    const base = importe(g.baseAmount);
    if (base === null) {
      // No es un asiento: es un apunte de caja. Se excluye Y se declara con su dinero.
      sinClasificar += 1;
      const suyo = importe(g.amount);
      if (suyo !== null) sinClasificarImporte += suyo;
      continue;
    }

    const cuota = importe(g.vatAmount);
    // La cuota SE LEE, no se deriva de base × tipo: la especificación de la columna dice que se
    // guarda «porque un redondeo distinto entre pantalla y libro es una discrepancia que después
    // nadie sabe explicar». Si falta, va `null` y se cuenta — nunca se rellena calculándola.
    if (cuota === null) sinCuota += 1;
    if (g.vatDeducible === null || g.vatDeducible === undefined) sinDeducibilidadDecidida += 1;

    const numeroProveedor = typeof g.providerInvoiceNumber === 'string' && g.providerInvoiceNumber !== ''
      ? g.providerInvoiceNumber
      : null;
    // Sin nº del proveedor el asiento ENTRA igual —la compra ocurrió y su base consta; omitirla
    // dejaría el IVA soportado por debajo de lo real— pero se cuenta: es un asiento identificable
    // a medias, y eso tiene que verse.
    if (numeroProveedor === null) sinNumeroProveedor += 1;

    asientos.push({
      numeroProveedor,
      // La del proveedor NO se sustituye por la del apunte: son fechas distintas y confundirlas
      // movería un asiento de periodo.
      fechaExpedicion: fechaIso(g.providerInvoiceDate),
      fechaApunte: fechaIso(g.date),
      proveedorId: typeof g.providerId === 'number' ? g.providerId : null,
      concepto: typeof g.concept === 'string' ? g.concept : null,
      base,
      tipoIva: tipo(g.vatRate),
      cuota,
      // `null` se conserva: «nunca se clasificó» y «se decidió que no» no pueden salir iguales.
      deducible: g.vatDeducible ?? null,
      total: importe(g.amount),
      moneda: g.currency ?? null,
    });
  }

  return {
    asientos,
    miradas: params.gastos.length,
    ajenas,
    sinClasificar,
    sinClasificarImporte: Math.round(sinClasificarImporte * 100) / 100,
    sinNumeroProveedor,
    sinCuota,
    sinDeducibilidadDecidida,
  };
}

/**
 * EL SUELO, y en un libro que sale de casa es el asunto entero. Hermano de `exigirLibroLegible`.
 *
 * Un periodo sin compras y un lector que no supo mirar dan el MISMO libro vacío. `miradas` los
 * separa, así que sin ese número no se entrega nada: se lanza.
 *
 * No se «arregla» devolviendo cero asientos: cero asientos es una respuesta legítima, y por eso no
 * puede ser también la respuesta al fallo.
 */
export function exigirLibroRecibidasLegible(libro: unknown): asserts libro is LibroRecibidas {
  const l = libro as LibroRecibidas | null | undefined;
  if (!l || typeof l !== 'object' || !Array.isArray(l.asientos) || typeof l.miradas !== 'number') {
    throw new Error(
      '🔴 NO SE PUDO LEER EL LIBRO DE FACTURAS RECIBIDAS (SCRUM-426/A6). No se entrega nada.\n\n' +
        '  Un periodo SIN compras y un libro que no se pudo leer dan el MISMO resultado vacío, y ' +
        'significan lo contrario: el primero es correcto, el segundo le declara a un despacho que ' +
        'no se compró nada. `miradas` es lo que los distingue (cuántos gastos se examinaron), así ' +
        'que si no viene, no hay libro.',
    );
  }
}
