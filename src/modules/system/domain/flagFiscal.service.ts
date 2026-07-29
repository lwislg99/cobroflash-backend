// SCRUM-218 · ENCENDER LA FACTURACIÓN FISCAL DE UN MERCHANT — con constancia o no ocurre.
//
// Encender `INVOICING_ES_ENABLED` para un merchant real es **la acción de mayor consecuencia
// del producto**: es el instante exacto en que ese profesional empieza a emitir facturas con
// efectos fiscales. Hasta hoy era un UPDATE a mano contra la base (`flags.ts:8`): sin
// superficie, sin actor, sin momento, y —lo que de verdad importa— **sin poder acreditarle a
// una inspección desde cuándo emite**.
//
// Y el máster ya lo prometía (`YAQU_MASTER.md:370`), con `cambio_flag` declarada en el enum
// desde siempre **sin escribirse ni una vez**. Una promesa en la fuente de verdad que el
// código no cumplía.
//
// ── LA GARANTÍA, Y CÓMO SE SOSTIENE ──────────────────────────────────────────────────────
// El cambio de flag y su fila de auditoría van en la MISMA `$transaction`, y la auditoría usa
// `recordAuditOrThrow` (T1/T2, propaga) con el cliente de la transacción. Si la fila no se
// puede escribir, el error sube, la transacción se deshace y **el flag no cambia**.
//
// No es «se intenta auditar»: es que **sin constancia el hecho no ocurre**. Un `catch` aquí
// reconstruiría exactamente el fallo mudo que este ticket viene a cerrar.
//
// DOS REDES, y cubren cosas distintas (decisión del fundador, 29-jul-2026):
//   · la TRANSACCIÓN de aquí protege ESTE camino, en ejecución;
//   · `cambio_flag` en `ACCIONES_BLOQUEANTES` protege el camino que alguien escriba MAÑANA, en
//     compilación y sin depender de ningún call site — `recordAudit` (fire-safe) ya no lo acepta.
// La primera sola dejaba abierta la puerta del segundo escritor.
import { prisma as defaultPrisma } from '../../../core/db/prisma';
import { isFlagEnabled, type FlagName } from '../../../core/flags';
import { recordAuditOrThrow, sobreFiscal, type ActorAudit } from '../audit.service';

/**
 * Los únicos flags que este camino puede tocar. Lista CERRADA a propósito: es el conjunto de
 * los que tienen consecuencia FISCAL. Cualquier otro flag de la Parte P se sigue cambiando
 * como antes — no se abre una puerta genérica de escritura de flags por la puerta de atrás.
 */
export const FLAGS_FISCALES = ['INVOICING_ES_ENABLED', 'SIF_ENABLED'] as const;
export type FlagFiscal = (typeof FLAGS_FISCALES)[number];

export function esFlagFiscal(v: unknown): v is FlagFiscal {
  return typeof v === 'string' && (FLAGS_FISCALES as readonly string[]).includes(v);
}

export interface CambioFlagParams {
  merchantId: number;
  flag: FlagFiscal;
  valorNuevo: boolean;
  /**
   * CONFIRMACIÓN EXPLÍCITA: el email del merchant, tecleado. No es ceremonia — es lo que
   * impide encenderle la facturación al merchant equivocado por un id mal puesto. Un id es un
   * número que se confunde; un email hay que ir a buscarlo.
   */
  confirmacion: string;
  actor: ActorAudit;
  ip?: string | null;
}

/** Forma mínima del cliente Prisma que este servicio necesita (permite inyectar uno falso). */
export interface ClienteFlag {
  merchant: {
    findUnique(args: any): Promise<any>;
    update(args: any): Promise<any>;
  };
  auditLog: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
  $transaction<T>(fn: (tx: ClienteFlag) => Promise<T>): Promise<T>;
}

export class ErrorCambioFlag extends Error {
  constructor(public readonly codigo: string, mensaje: string) {
    super(mensaje);
  }
}

/**
 * Cambia un flag FISCAL de un merchant dejando constancia. Devuelve el valor efectivo antes y
 * después. Lanza `ErrorCambioFlag` con código estable para que la ruta traduzca a HTTP.
 */
export async function cambiarFlagFiscal(
  params: CambioFlagParams,
  cliente: ClienteFlag = defaultPrisma as unknown as ClienteFlag,
): Promise<{ anterior: boolean; nuevo: boolean }> {
  if (!esFlagFiscal(params.flag)) {
    throw new ErrorCambioFlag('flag_no_fiscal', `${params.flag} no es un flag fiscal.`);
  }
  if (typeof params.valorNuevo !== 'boolean') {
    throw new ErrorCambioFlag('valor_invalido', 'El valor nuevo debe ser true o false.');
  }

  const merchant = await cliente.merchant.findUnique({
    where: { id: params.merchantId },
    select: { id: true, email: true, country: true, flags: true },
  });
  if (!merchant) throw new ErrorCambioFlag('merchant_no_encontrado', 'Ese merchant no existe.');

  // La confirmación se compara ya normalizada: el fallo que evita es teclear otro merchant,
  // no escribir en mayúsculas.
  const esperado = String(merchant.email ?? '').trim().toLowerCase();
  if (!esperado || String(params.confirmacion ?? '').trim().toLowerCase() !== esperado) {
    throw new ErrorCambioFlag(
      'confirmacion_no_coincide',
      'La confirmación debe ser el email exacto del merchant al que se le cambia el flag.',
    );
  }

  // Valor EFECTIVO (precedencia merchant > país > env), que es el que gobierna de verdad la
  // emisión. Se registra este y no solo el override: el override puede no cambiar nada si el
  // país o el env mandan, y lo que hay que poder acreditar es qué pasó a estar en vigor.
  const anterior = isFlagEnabled(params.flag as FlagName, { merchant });
  const overrideAnterior = leerOverride(merchant.flags, params.flag);

  const flagsNuevos = { ...normalizarFlags(merchant.flags), [params.flag]: params.valorNuevo };
  const nuevo = isFlagEnabled(params.flag as FlagName, { merchant: { ...merchant, flags: flagsNuevos } });

  if (anterior === nuevo && overrideAnterior === params.valorNuevo) {
    throw new ErrorCambioFlag('flag_sin_cambio', 'El flag ya está en ese valor para este merchant.');
  }

  await cliente.$transaction(async (tx) => {
    await tx.merchant.update({ where: { id: params.merchantId }, data: { flags: flagsNuevos } });

    // MISMO `tx`. Si esto lanza, el update de arriba se deshace y el flag NO cambia.
    await recordAuditOrThrow(
      {
        merchantId: params.merchantId,
        teamMemberId: params.actor.teamMemberId ?? null,
        action: 'cambio_flag',
        entityType: 'merchant',
        entityId: params.merchantId,
        // El momento NO se pone aquí: lo pone `AuditLog.createdAt` (@default(now())) del lado
        // de la base. Un timestamp de aplicación sería un dato que el proceso elige; el de la
        // base es el que una inspección puede contrastar contra el resto de la tabla.
        meta: sobreFiscal({
          actor: params.actor,
          flagsFiscales: {
            INVOICING_ES_ENABLED: isFlagEnabled('INVOICING_ES_ENABLED', { merchant: { ...merchant, flags: flagsNuevos } }),
            SIF_ENABLED: isFlagEnabled('SIF_ENABLED', { merchant: { ...merchant, flags: flagsNuevos } }),
          },
          payload: {
            flag: params.flag,
            valorAnterior: anterior,
            valorNuevo: nuevo,
            overrideAnterior,
            overrideNuevo: params.valorNuevo,
          },
        }),
        ip: params.ip ?? null,
      },
      tx as any,
    );
  });

  return { anterior, nuevo };
}

function normalizarFlags(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/** El override crudo del merchant, o `null` si no lo tiene puesto. */
function leerOverride(raw: unknown, flag: string): boolean | null {
  const f = normalizarFlags(raw);
  return Object.prototype.hasOwnProperty.call(f, flag) ? f[flag] : null;
}
