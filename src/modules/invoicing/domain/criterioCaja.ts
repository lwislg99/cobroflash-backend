// src/modules/invoicing/domain/criterioCaja.ts — SCRUM-294 (A3)
//
// EL CRITERIO DE CAJA (RECC), CLASIFICADO APARTE — Y CON SU LÍMITE DENTRO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE HOY SE PUEDE AFIRMAR, Y LO QUE NO
//
// El criterio de caja significa que el IVA se devenga **cuando cobras**, no cuando facturas. Un
// facturador normal solo puede ofrecer la casilla, porque no sabe cuándo cobras. Nosotros tenemos
// el cobro dentro… **pero no la fecha en que entró el euro**:
//
//     paidAt: new Date()   ← medido en TRES sitios de `src` (psp.routes ×2, mpWebhook.routes)
//
// Eso es el instante en que **alguien lo marcó**, no el instante en que el dinero entró. Y tres de
// las cinco formas de cobro se marcan a mano.
//
// Por eso este módulo **clasifica y avisa; no liquida**. Decir «esta factura se devengó el 14 de
// mayo» sería afirmar una fecha que no tenemos. Eso es **E5, y no está construido**.
//
// ⚠️ `docs/diseno/bloque-a.md` § A3 dice «nosotros sabemos exactamente cuándo entró cada euro».
// Con lo medido hoy, eso **no es cierto todavía**, y este fichero no se comporta como si lo fuera.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ SIN LLAMADORES, IGUAL QUE EL RECARGO
//
// Activar el RECC para un merchant necesita un campo de configuración que hoy no existe
// (`docs/diseno/bloque-a.md` § A3 lo sitúa en `Configuración › Empresa`) y las migraciones se
// deciden una a una. Y **el 303 no cambia**: su cuota devengada sigue saliendo por emisión.

export type FiabilidadDelCobro = 'marcado_a_mano' | 'sin_marca';

export interface AsientoParaCaja {
  numero: string;
  /** El estado del documento. `'paid'` es lo único que hoy dice «alguien lo dio por cobrado». */
  estado: string | null;
  /** La cuota devengada de ese asiento, ya calculada por quien corresponda. */
  cuota: number | null;
}

export interface ClasificacionCaja {
  /** Asientos que constan cobrados: los que un RECC declararía en este periodo. */
  cobrados: { numero: string; cuota: number }[];
  /** Asientos sin marca de cobro: su IVA se declararía MÁS TARDE bajo RECC. */
  noCobrados: { numero: string; cuota: number }[];
  /** Asientos cuya cuota no se pudo leer: ni a un lado ni al otro. Se declaran. */
  sinCuota: string[];
  cuotaCobrada: number;
  cuotaNoCobrada: number;
  /** Cuántos asientos se miraron. Sin esto, «cero cobrados» y «no supe mirar» son el mismo cero. */
  miradas: number;
  /**
   * ⚠️ LA ADVERTENCIA VIAJA CON EL DATO, no en la pantalla que lo pinte.
   *
   * Quien consuma esto tiene que saber que la marca de cobro no es la fecha del euro. Si viviera
   * solo en la interfaz, el segundo consumidor —un export, un PDF— la publicaría sin ella.
   */
  advertencia: string;
}

export const ADVERTENCIA_CAJA =
  '[PENDIENTE microcopy oficial] El estado de cobro dice que alguien marcó la factura como '
  + 'cobrada, no en qué fecha entró el dinero. No sirve para fijar el devengo por criterio de caja.';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Reparte los asientos de un periodo entre cobrados y no cobrados.
 *
 * **NO calcula ninguna liquidación** y no altera ninguna cuota: solo dice de qué lado cae cada
 * asiento con el dato que hay, y lo dice con su advertencia pegada.
 */
export function clasificarPorCobro(asientos: readonly AsientoParaCaja[]): ClasificacionCaja {
  const cobrados: { numero: string; cuota: number }[] = [];
  const noCobrados: { numero: string; cuota: number }[] = [];
  const sinCuota: string[] = [];

  for (const a of Array.isArray(asientos) ? asientos : []) {
    const cuota = typeof a?.cuota === 'number' && Number.isFinite(a.cuota) ? a.cuota : null;
    if (cuota === null) {
      // Sin cuota legible no se puede poner a ningún lado: sumarla como 0 la haría desaparecer
      // de la declaración sin que nadie lo note.
      sinCuota.push(String(a?.numero ?? ''));
      continue;
    }
    (a.estado === 'paid' ? cobrados : noCobrados).push({ numero: a.numero, cuota });
  }

  return {
    cobrados,
    noCobrados,
    sinCuota,
    cuotaCobrada: round2(cobrados.reduce((s, x) => s + x.cuota, 0)),
    cuotaNoCobrada: round2(noCobrados.reduce((s, x) => s + x.cuota, 0)),
    miradas: Array.isArray(asientos) ? asientos.length : 0,
    advertencia: ADVERTENCIA_CAJA,
  };
}

/**
 * EL SUELO, igual que en el recargo: **«no se pudo leer» no es «no tiene RECC»**.
 *
 * Un merchant acogido al criterio de caja al que se le declara por devengo liquida IVA que aún no
 * ha cobrado. Al revés —declarar por caja a quien no está acogido— es declarar de menos. Las dos
 * salidas son malas, y por eso no hay valor por defecto.
 */
export function leerCriterioCaja(config: unknown):
  | { ok: true; acogido: boolean }
  | { ok: false; motivo: string } {
  if (config === null || config === undefined) {
    return { ok: false, motivo: 'no se ha podido leer si el negocio está acogido al criterio de caja' };
  }
  if (config === true || config === false) return { ok: true, acogido: config };
  return { ok: false, motivo: `valor de criterio de caja no reconocido: ${JSON.stringify(config)}` };
}
