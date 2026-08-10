// src/modules/system/domain/puertaClienteReal.ts — SCRUM-390 · ¿ya entró el primer cliente real?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// Varias decisiones del proyecto llevan la cláusula **«el día que entre el primer cliente real»**
// (la regla fechada de `YAQU_MASTER.md`, el backfill de `MIGRATIONS_PENDING.md`…). Ese día **no
// dispara nada**: es una condición escrita en prosa que nadie evalúa, y una condición que nadie
// evalúa es un aviso — un aviso no impide nada. El día que llegue, nadie va a releer el máster.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ NO HAY UN CAMPO `Merchant.esCliente` — decisión del fundador, 9-ago-2026
//
// **Un campo que alguien tiene que acordarse de marcar tiene EXACTAMENTE el mismo modo de fallo
// que la cláusula en prosa que sustituye.** Cambiar una promesa escrita por una casilla que hay
// que rellenar no es un mecanismo: es la misma promesa con otra forma.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DOS SEÑALES, PORQUE UNA SOLA YA FALLÓ (SCRUM-409, el mismo día)
//
//   ① PAGA — `stripeSubscriptionId != null` en cualquier merchant. Pagar es un hecho duro, lo
//      produce un sistema EXTERNO y nadie puede olvidarse de marcarlo.
//
//   ② SON MÁS DE LOS NUESTROS — el número de merchants supera el de cuentas de prueba declaradas.
//      Existe porque la ① no basta: **un cliente real en trial que aún no ha pagado no la
//      dispara**. Ésta sí lo caza.
//
// Ninguna de las dos decide nada: **avisan de que ese día llegó**, que es lo único que hoy no
// pasa. Lo que se hace después lo decide una persona.

/**
 * Cuentas de prueba declaradas a día de hoy.
 *
 * Medido el 9-ago-2026: **13 merchants** en producción, todos nuestros
 * (`docs/MIGRATIONS_PENDING.md` lo dice al describir el nacimiento de una columna: «los 13
 * merchants»; y SCRUM-364 midió «8 de 13 merchants sin oficio»).
 *
 * ⚠️ **SOLO PUEDE BAJAR, o subir CON MOTIVO ESCRITO.** Si crece porque abrimos otra cuenta
 * nuestra, se sube aquí y se dice por qué en el mismo commit; si crece sin que nadie lo toque, es
 * que ha entrado alguien de fuera — y eso es justo lo que esta señal existe para cazar.
 */
export const CUENTAS_DE_PRUEBA_DECLARADAS = 13;

export interface EstadoDelPadron {
  /** Cuántos merchants hay en total. */
  total: number;
  /** Cuántos tienen suscripción de Stripe (`stripeSubscriptionId != null`). */
  conSuscripcion: number;
}

export type MotivoPuerta = 'paga' | 'mas_de_los_nuestros';

export interface VeredictoPuerta {
  abierta: boolean;
  motivos: MotivoPuerta[];
  /** Lo que hay que revisar cuando se abre. Se nombran, no se resuelven. */
  clausulas: string[];
  detalle: string;
}

/**
 * ¿Se cumple alguna de las dos señales?
 *
 * ⚠️ **NO tiene valor por defecto tranquilizador.** Si el padrón no se puede leer —números que no
 * son números—, la puerta **no** se declara cerrada: se declara ilegible. «No entró nadie» y «no
 * supe mirar» no pueden terminar en el mismo verde, porque el segundo autoriza a seguir tratando
 * los datos de producción como desechables.
 */
export function evaluarPuerta(
  padron: EstadoDelPadron,
  clausulas: readonly string[],
  tope: number = CUENTAS_DE_PRUEBA_DECLARADAS,
): VeredictoPuerta {
  const total = Number(padron?.total);
  const conSuscripcion = Number(padron?.conSuscripcion);
  if (!Number.isFinite(total) || !Number.isFinite(conSuscripcion)) {
    return {
      abierta: true,
      motivos: [],
      clausulas: [...clausulas],
      detalle: 'el padrón no se ha podido leer: esto NO es «no ha entrado nadie», es «no lo sé»',
    };
  }

  const motivos: MotivoPuerta[] = [];
  if (conSuscripcion > 0) motivos.push('paga');
  if (total > tope) motivos.push('mas_de_los_nuestros');

  return {
    abierta: motivos.length > 0,
    motivos,
    clausulas: [...clausulas],
    detalle: motivos.length === 0
      ? `${total} merchants (tope ${tope}), ninguno con suscripción`
      : `${total} merchants (tope ${tope}) · ${conSuscripcion} con suscripción`,
  };
}

/** El aviso, ya redactado, para quien lo tenga que enseñar o registrar. */
export function textoDelAviso(v: VeredictoPuerta): string {
  if (!v.abierta) return '';
  const porQue = v.motivos.includes('paga')
    ? 'hay un merchant con suscripción de Stripe'
    : 'hay más merchants que cuentas de prueba declaradas';
  return `Ha entrado el primer cliente real (${porQue}). Estas decisiones dependían de que no lo hubiera:\n`
    + v.clausulas.map((c) => `  · ${c}`).join('\n');
}
