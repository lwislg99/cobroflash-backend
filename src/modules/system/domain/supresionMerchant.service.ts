// src/modules/system/domain/supresionMerchant.service.ts — SCRUM-244 (RGPD-1) · la supresión.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA ANOTACIÓN VA ANTES, Y TIENE QUE SOBREVIVIR
//
// Anotar en `AuditLog` **antes** de ejecutar no basta: `ORDEN_BORRADO_MERCHANT` incluye
// `auditLog`, así que un borrado completo **se llevaría por delante la propia anotación**. Sería
// decorativa — la misma trampa que un vigilante que rompe lo que vigila.
//
// Se cierra por diseño y no por promesa: **el rastro no se borra, se ANONIMIZA** (decisión del
// fundador, 10-ago-2026, art. 17.3.b RGPD). Como las filas de `auditLog` se conservan con sus
// textos redactados, la anotación previa sigue ahí cuando todo termina — y un test lo comprueba
// leyéndola DESPUÉS.
//
// ⚠️ La ruta que llama aquí va tras `MERCHANT_DELETE_ENABLED` (OFF por defecto): esto se
// construye, no se enciende.
import { recordAuditOrThrow, type ActorAudit } from '../audit.service';
import { planDeAnonimizado, redaccionesPara, tocaIntocables, CAMPOS_PERSONALES } from './anonimizarMerchant';

export interface ResultadoSupresion {
  ok: boolean;
  anotadoAntes: boolean;
  redactados: { modelo: string; filas: number }[];
  motivo?: string;
}

/**
 * Anonimiza un merchant: quita sus datos personales y los de sus clientes, y **conserva el asiento
 * fiscal con su encadenamiento**.
 *
 * `db` y `auditar` entran por parámetro para poder probarlo contra la base desechable o con dobles;
 * **nunca** contra producción ni staging.
 */
export async function suprimirMerchant(params: {
  merchantId: number;
  /**
   * Quién lo pide. Va al rastro DOS veces —`teamMemberId` en la fila y `meta.actor` con su
   * tipo—, que es la forma en que ya se registra lo fiscal. Una supresión sin actor no se
   * puede defender después: «alguien borró estos datos» no responde a nadie.
   */
  actor: ActorAudit;
  db: any;
  auditar?: typeof recordAuditOrThrow;
}): Promise<ResultadoSupresion> {
  const { merchantId, actor, db } = params;
  // ⚠️ `recordAuditOrThrow` y NO `recordAudit`, por dos razones que este test destapó:
  //   ① LANZA si no puede escribir. `recordAudit` es fire-safe —no puede tumbar una respuesta— y
  //      aquí eso sería justo lo contrario de lo que hace falta: el rastro ES el requisito.
  //   ② acepta el CLIENTE por parámetro. La primera versión usaba el singleton, así que la
  //      anotación se iba a OTRA base que la redacción: constancia en otro sitio no es constancia,
  //      y el test contra el banco lo cazó con «la anotación NO ha sobrevivido».
  const auditar = params.auditar ?? recordAuditOrThrow;
  const plan = planDeAnonimizado();

  // ── ① ANOTAR PRIMERO. Si esto falla, no se toca nada. ───────────────────────────────────
  //
  // Y se espera (`await`): `recordAudit` es fire-safe en las rutas normales —no puede tumbar una
  // respuesta— pero aquí el rastro ES el requisito. Anotar «a lo mejor» antes de borrar datos de
  // forma irreversible no es anotar.
  try {
    await auditar({
      merchantId,
      teamMemberId: actor.teamMemberId ?? null,
      action: 'merchant_anonimizado',
      entityType: 'merchant',
      entityId: merchantId,
      meta: {
        actor,
        plan: plan.redacciones,
        conservado: plan.conservado,
        // El instante lo pone el propio registro; aquí va el porqué, que es lo que no se puede
        // reconstruir después.
        base_legal: 'art. 17 RGPD (supresión) con la excepción del 17.3.b (obligación legal)',
      },
    }, db);
  } catch (err: any) {
    return { ok: false, anotadoAntes: false, redactados: [], motivo: `no se pudo dejar constancia: ${err?.message ?? err}` };
  }

  // ── ② REDACTAR. Solo los campos elegidos, y con la red de los intocables. ────────────────
  const redactados: { modelo: string; filas: number }[] = [];
  for (const modelo of Object.keys(CAMPOS_PERSONALES)) {
    const data = redaccionesPara(modelo);
    if (!data) continue;
    const prohibidos = tocaIntocables(data);
    if (prohibidos.length) {
      return {
        ok: false, anotadoAntes: true, redactados,
        motivo: `la redacción de «${modelo}» tocaría ${prohibidos.join(', ')}: lo sellado no se toca (regla 29)`,
      };
    }
    const where = modelo === 'merchant' ? { id: merchantId } : { merchantId };
    const r = await db[modelo].updateMany({ where, data });
    redactados.push({ modelo, filas: r?.count ?? 0 });
  }

  return { ok: true, anotadoAntes: true, redactados };
}
