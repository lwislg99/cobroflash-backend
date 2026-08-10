// src/modules/auth/domain/entornoApp.service.ts — SCRUM-360 (H5 · fase 2)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// GUARDAR EL ENTORNO DE LA APP · el dato que dimensiona H5 entero
//
// WebKit borra el ORIGEN ENTERO —service worker, Cache API e IndexedDB— tras 7 días de usar Safari
// sin visitar el sitio. Los web apps AÑADIDOS A LA PANTALLA DE INICIO están **exentos**; una
// pestaña normal **no**. Con la cola de firmas ya construida (SCRUM-358), eso significa que a un
// profesional que emite cada dos semanas **puede desaparecerle una firma pendiente**, y no se
// entera él ni nos enteramos nosotros.
//
// No sabemos a cuántos les pasa. **Ese número —y no la proporción de iPhones— es el que dimensiona
// H5**, y es lo que esta fase produce.
//
// La fase 1 (SCRUM-360) construyó `entornoDeLaApp()` en `api.js`, con sus tres estados, y la dejó
// SIN LLAMAR porque no había dónde guardar. La columna ya está (SCRUM-449). Esto cierra el camino.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 `null` NO SE SUMA NUNCA A `false`
//
// `desconocido` se guarda como `null`, no como `false`. Si al contar quién está en riesgo un `null`
// cayera del lado de «pestaña», habríamos fabricado exactamente el número tranquilo que este dato
// venía a impedir: parecería que sabemos que N están en riesgo cuando no pudimos preguntárselo.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { prisma } from '../../../core/db/prisma';

/** Los tres estados que produce `entornoDeLaApp()` en el navegador. Unión CERRADA. */
export const ENTORNOS_APP = ['instalada', 'pestana', 'desconocido'] as const;
export type EntornoApp = (typeof ENTORNOS_APP)[number];

export function esEntornoApp(v: unknown): v is EntornoApp {
  return typeof v === 'string' && (ENTORNOS_APP as readonly string[]).includes(v);
}

/**
 * El entorno, como se guarda. PURA.
 *
 * 🔴 TRES VALORES A TRES VALORES, sin colapsar: `instalada`→`true`, `pestana`→`false`,
 * `desconocido`→**`null`**. Un booleano de dos estados aquí sería la mentira entera de este ticket.
 */
export function aInstaladaPwa(entorno: EntornoApp): boolean | null {
  if (entorno === 'instalada') return true;
  if (entorno === 'pestana') return false;
  return null; // `desconocido` — y NO `false`. Ver la cabecera.
}

export const ENTORNO_ESCRITO = 'ESCRITO';
export const ENTORNO_SIN_CAMBIO = 'SIN_CAMBIO';
export const ENTORNO_NO_SE_PUDO = 'NO_SE_PUDO';

export interface ResultadoEntorno {
  estado: typeof ENTORNO_ESCRITO | typeof ENTORNO_SIN_CAMBIO | typeof ENTORNO_NO_SE_PUDO;
  valor: boolean | null;
  motivo?: string;
}

/**
 * Guarda el entorno en la fila de ESTA sesión, **solo si cambia**.
 *
 * 🔴 EL CAMPO SIGNIFICA «EL ÚLTIMO ENTORNO VISTO», y por eso no se escribe ni al crear la sesión ni
 * en cada visita:
 *   · **al crear** mentiría en cuanto el profesional instale la app a mitad de sesión — e instalar
 *     es JUSTO la mitigación que queremos ver ocurrir;
 *   · **en cada visita** sería una escritura por visita sobre una tabla caliente.
 * Escribir solo si difiere da la semántica buena a coste casi cero **y captura el momento exacto de
 * la instalación**.
 *
 * ⚠️ La comparación es del SERVIDOR contra lo guardado, no del cliente: el navegador no sabe qué
 * hay en la fila, y hacérselo recordar en `localStorage` sería otra clave que purgar y que además
 * mentiría en cuanto alguien cierre sesión.
 *
 * El cliente de Prisma se INYECTA para poder ejercitar esto sin base de datos.
 */
export async function registrarEntornoDeSesion(
  sessionId: number,
  entorno: EntornoApp,
  prismaClient: any = prisma,
): Promise<ResultadoEntorno> {
  const valor = aInstaladaPwa(entorno);
  try {
    const fila = await prismaClient.authSession.findUnique({
      where: { id: sessionId },
      select: { instaladaPwa: true },
    });
    if (!fila) return { estado: ENTORNO_NO_SE_PUDO, valor, motivo: 'la sesión ya no existe' };

    // ⚠️ `??` y no `||`: `false` es un valor GUARDADO —«se miró y está en pestaña»— y con `||`
    // se confundiría con `null`, que es «no se pudo mirar». Es el mismo colapso que este fichero
    // existe para impedir, por la puerta de atrás de un operador.
    const guardado = fila.instaladaPwa ?? null;
    if (guardado === valor) return { estado: ENTORNO_SIN_CAMBIO, valor };

    await prismaClient.authSession.update({ where: { id: sessionId }, data: { instaladaPwa: valor } });
    return { estado: ENTORNO_ESCRITO, valor };
  } catch (e: any) {
    // Esto es telemetría: no puede tumbar nada. Se dice que no se pudo y se sigue.
    return { estado: ENTORNO_NO_SE_PUDO, valor, motivo: String((e && e.message) || e) };
  }
}
