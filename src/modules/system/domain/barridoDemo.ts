// src/modules/system/domain/barridoDemo.ts — SCRUM-314 (D3): el barrido del merchant demo, DERIVADO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, medido y confirmado dos veces
//
// `wipeDemo` borraba una lista escrita a mano: **10 de los 22 modelos con `merchantId`**. Los
// once que se quedaban fuera —derivación propia sobre `schema.prisma`, y coincide con el delta
// de SCRUM-310— eran:
//
//   authSession · provider · quoteTemplate · teamMember · legalAcceptance · job ·
//   maintenancePlan · auditLog · attachment · albaran · albaranLineaFacturada
//
// Y ahí está lo que convierte esto en bloqueante: **el botón «Eliminar datos de ejemplo» iba a
// montarse encima**. Un botón que deja once tablas sucias no es un botón a medias — le dice al
// usuario que su cuenta está limpia cuando su trabajo, sus albaranes, su equipo y su rastro de
// auditoría siguen ahí. Por eso el orden no se negocia: primero esto, después el botón.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ SE REUSA `ORDEN_BORRADO_MERCHANT` Y NO SE ESCRIBE UNA SEGUNDA LISTA
//
// Esa lista ya existe, ya está en el orden correcto de FKs, y —lo que importa— **ya la guarda un
// test que la deriva del schema** (SCRUM-172/192): si mañana alguien añade un modelo con
// `merchantId` y no lo mete ahí, sale rojo. Copiarla aquí habría creado la segunda lista que se
// desincroniza sola: es el defecto de SCRUM-240 y es exactamente lo que dejó a `wipeDemo` en 10
// de 21, porque nadie mantenía dos listas a la vez.
//
// Al colgar de ella, `wipeDemo` hereda ese guard **sin mantenimiento**: un modelo nuevo entra en
// el barrido del demo el mismo día que entra en el del merchant.
//
// ⚠️ LA DIFERENCIA CON `borrarMerchant`, que es la razón de que este módulo exista: aquél borra
// **también la fila del merchant**; aquí el merchant demo tiene que SOBREVIVIR, porque el seed lo
// vuelve a rellenar justo después. Misma lista, distinto final.
import {
  ORDEN_BORRADO_MERCHANT,
  COLGADOS_DE_CHARGE,
} from './borradoMerchant';

/**
 * Prefijo de los teléfonos del bot en los datos de ejemplo.
 *
 * `BotSession` NO se puede barrer por `merchantId`: es nullable a propósito (SCRUM-174) porque la
 * sesión de primer contacto nace antes de saber de quién es. Se barre por TELÉFONO, que es lo que
 * identifica la conversación — igual que hace `borrarMerchant`.
 */
export const PREFIJO_TELEFONO_DEMO = '346110000';

/**
 * Borra TODO lo del merchant demo, sin borrar el merchant.
 *
 * @param prisma  cliente inyectado (para poder ejercitarlo con un doble, sin BD)
 * @param demoId  id del merchant demo
 * @returns {{ modelos: string[], porModelo: Record<string, number> }} qué se recorrió y cuánto
 *          cayó de cada uno — un barrido que no puede decir qué borró no se puede auditar.
 */
export async function barridoDemo(
  prisma: any,
  demoId: number,
): Promise<{ modelos: string[]; porModelo: Record<string, number | null> }> {
  const porModelo: Record<string, number | null> = {};
  const modelos: string[] = [];

  // 1) Los que cuelgan de `charge` y NO tienen `merchantId` propio (event, reconciliation): van
  //    ANTES que sus charges. Su FK es RESTRICT, así que al revés el borrado revienta a mitad
  //    (SCRUM-244) — y aquí «a mitad» significaría dejar el demo en un estado que nadie eligió.
  for (const modelo of Object.keys(COLGADOS_DE_CHARGE)) {
    modelos.push(modelo);
    porModelo[modelo] = await contar(prisma, modelo, { charge: { merchantId: demoId } });
  }

  // 2) Los 22 con `merchantId`, en el orden declarado (hijos antes que padres).
  for (const modelo of ORDEN_BORRADO_MERCHANT) {
    modelos.push(modelo);
    porModelo[modelo] = await contar(prisma, modelo, { merchantId: demoId });
  }

  // 3) Las sesiones del bot, por teléfono (ver `PREFIJO_TELEFONO_DEMO`).
  modelos.push('botSession');
  porModelo.botSession = await contar(prisma, 'botSession', {
    phone: { startsWith: PREFIJO_TELEFONO_DEMO },
  });

  return { modelos, porModelo };
}

/**
 * Un `deleteMany` que no puede tumbar el barrido.
 *
 * El `catch` es deliberado y acotado: un modelo que este entorno no tenga (o una tabla que aún no
 * exista) no debe impedir que se limpien las demás — el seed corre en máquinas distintas. Lo que
 * NO hace es esconderlo: devuelve `null`, y quien mira el resultado distingue «0 filas» de «no se
 * pudo».
 */
async function contar(prisma: any, modelo: string, where: unknown): Promise<number | null> {
  const delegado = prisma?.[modelo];
  if (!delegado?.deleteMany) return null;
  const r = await delegado.deleteMany({ where }).catch(() => null);
  return typeof r?.count === 'number' ? r.count : null;
}
