// SCRUM-1573b · ¿Este comercio ejerció su derecho de supresión?
//
// Señal A, firmada por el fundador en SCRUM-1573 c.21057: la supresión (`suprimirMerchant`,
// carril J3) redacta SIEMPRE `merchant.name`, porque `name` está en `CAMPOS_PERSONALES`. Las
// puertas de cobro ya cargan el comercio entero, así que preguntarlo no cuesta ninguna consulta.
//
// La constante se IMPORTA: copiarla aquí sería una segunda verdad, y el día que la supresión
// cambiara su texto, esta pregunta contestaría «no» a todos los comercios suprimidos sin avisar.
import { REDACTADO } from '../../system/domain/anonimizarMerchant';

export function comercioSuprimido(m: { name?: unknown } | null | undefined): boolean {
  return m?.name === REDACTADO;
}
