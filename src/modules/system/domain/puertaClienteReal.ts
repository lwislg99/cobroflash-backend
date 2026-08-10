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

/**
 * El aviso, ya redactado. **Microcopy APROBADA por el fundador (10-ago-2026)**, literal.
 *
 * Solo cambia la linea de la senal; el resto es fijo para que quien lo reciba lo reconozca de un
 * vistazo.
 */
export function textoDelAviso(v: VeredictoPuerta): string {
  if (!v.abierta) return '';
  const senal = v.motivos.includes('paga')
    ? 'un merchant con suscripción de Stripe'
    : 'hay más merchants que cuentas de prueba declaradas';
  const LINEAS = [
    'YaQu · Ha entrado el primer cliente real.',
    `Señal: ${senal}.`,
    '',
    'Estas decisiones dependían de que no lo hubiera y hay que revisarlas ya:',
    ...v.clausulas.map((c) => `· ${c}`),
  ];
  // Se compone por LÍNEAS y se une al final: el mensaje tiene forma fija y así se lee aquí igual
  // que se lee en el móvil.
  return LINEAS.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA CADENCIA DEL AVISO — derivada, no guardada
//
// El aviso tiene que sonar cuando la puerta PASA de cerrada a abierta, no todos los días. Eso
// pide memoria… y **no hay dónde guardarla sin tocar el schema**: `WhatsAppMessage` exige un
// `merchantId` (un aviso interno no tiene merchant, y meterle el del demo es justo lo que
// SCRUM-409 acaba de prohibir) y `AuditLog` tiene su unión de acciones CERRADA (regla 5).
//
// Así que la cadencia se **DERIVA del dato que abre la puerta**: el día en que apareció el primer
// merchant que la dispara. Con eso:
//
//   · día 0 (el de la apertura) → suena: es la transición;
//   · después, **una vez por semana** → recordatorio, para que un día perdido no lo entierre.
//
// ⚠️ EL CRITERIO ESTÁ ESCRITO, no implícito, y su límite también: si el cron no corre el día 0,
// esa notificación se pierde y la recoge el recordatorio semanal. Se prefiere eso a un estado
// nuevo en el schema que alguien tendría que mantener.
export const CADENCIA_RECORDATORIO_DIAS = 7;

export interface Cadencia {
  /** Días desde que la puerta se abrió (0 = hoy). `null` = no se sabe cuándo se abrió. */
  diasDesdeApertura: number | null;
}

export function debeAvisar(v: VeredictoPuerta, c: Cadencia): { avisa: boolean; motivo: string } {
  if (!v.abierta) return { avisa: false, motivo: 'la puerta sigue cerrada' };
  const d = c?.diasDesdeApertura;
  // Sin fecha de apertura NO se calla: un aviso de más es barato; uno de menos es el ticket entero.
  if (d === null || d === undefined || !Number.isFinite(d)) {
    return { avisa: true, motivo: 'la puerta está abierta y no se sabe desde cuándo' };
  }
  if (d <= 0) return { avisa: true, motivo: 'la puerta acaba de abrirse' };
  if (d % CADENCIA_RECORDATORIO_DIAS === 0) {
    return { avisa: true, motivo: `recordatorio semanal (día ${d})` };
  }
  return { avisa: false, motivo: `ya avisado; el próximo recordatorio toca el día ${Math.ceil(d / CADENCIA_RECORDATORIO_DIAS) * CADENCIA_RECORDATORIO_DIAS}` };
}

/**
 * El mensaje que se manda. Texto **APROBADO** (10-ago-2026): ya no lleva marcador, y un test exige
 * que no vuelva a llevarlo — un `[PENDIENTE …]` en un mensaje que alguien lee es copy sin aprobar
 * publicada, y la regla 30 no tiene excepcion por destinatario.
 */
export function mensajeParaElFundador(v: VeredictoPuerta): string {
  return textoDelAviso(v);
}
