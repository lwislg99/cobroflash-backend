// src/modules/invoicing/domain/zonaDelLibro.ts — SCRUM-1445d (fase 2)
//
// EL CABLE DE LA ZONA: la zona del comercio llega a los bordes fiscales (303, 130, 347, 111/115,
// libros AEAT, evidencias). Decisión del fundador en SCRUM-1445 c.21896: «arreglarlo en el código,
// sin tocar TZ», cada cálculo con `zonaDelMerchant`.
//
// Mismo patrón que `criterioDelMerchant.ts`: los repos del libro leen la fila del merchant y pasan
// lo que sale. Quien resuelve la zona es `zonaDelMerchant` (S1, se importa y no se toca): sin zona
// declarada da `ZONA_POR_DEFECTO` ('UTC'), que es lo que hace hoy el proceso en producción.
//
// 🔴 EL SUELO: una lectura que falla NO se degrada a UTC. «Sin zona» es el caso de la mayoría, así
// que degradar ahí escondería el fallo: un comercio de Canarias declararía la última hora del
// trimestre en el siguiente y se parecería a todos los demás.
import { zonaDelMerchant } from '../../../core/zonaDelMerchant';

/** Lo mínimo que hace falta del cliente de datos. */
export interface ClienteParaZona {
  merchant: { findUnique: (args: any) => Promise<unknown> };
}

/**
 * LEE la zona del merchant para calcular los bordes de un periodo fiscal.
 *
 * @throws si el merchant no existe: ver el suelo, arriba.
 */
export async function zonaDelMerchantParaElLibro(db: ClienteParaZona, merchantId: number): Promise<string> {
  const fila = await db.merchant.findUnique({ where: { id: merchantId }, select: { timezone: true } });
  if (fila === null || fila === undefined) {
    throw new Error(
      'no se ha podido leer el merchant para decidir la zona de los bordes fiscales. NO se continúa ' +
      'en UTC: «sin zona» es el caso de la mayoría, y degradar a él escondería el fallo.',
    );
  }
  return zonaDelMerchant(fila as { timezone?: string | null });
}
