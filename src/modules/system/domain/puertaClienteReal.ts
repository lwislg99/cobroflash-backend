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
/**
 * POR QUÉ se considera abierta. Son EXACTAMENTE dos motivos aprobados y no se inventan más: si
 * mañana hubiera una tercera forma de abrirla, su frase la aprueba el fundador (regla 30).
 *
 * SIN `export` (SCRUM-494): su consumidor real está en este fichero. Se prueba por la superficie
 * pública —`mensajeParaElFundador`, que lo pinta en las dos formas— y así el test comprueba lo que
 * de verdad importa: que el aviso ENVIADO nombra el motivo, no que exista un ayudante que sabría.
 */
function motivoDeApertura(v: VeredictoPuerta): string {
  return v.motivos.includes('paga')
    ? 'hay un merchant con suscripción de Stripe'
    : 'hay más merchants que cuentas de prueba declaradas';
}

/**
 * Las cláusulas, una por línea y con su viñeta. **Solo la lista**: el marco lo pone
 * `mensajeParaElFundador`, que es quien sabe si esto es una apertura o un recordatorio.
 *
 * ⚠️ Antes esta función traía el marco DENTRO, y por eso las dos formas eran imposibles: el texto
 * decía «Ha entrado el primer cliente real» aunque llevara ocho semanas abierta.
 */
export function textoDelAviso(v: VeredictoPuerta): string {
  if (!v.abierta) return '';
  return v.clausulas.map((c) => `  · ${c}`).join('\n');
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

/**
 * 🔴 `dia` SALE, y hasta hoy se quedaba dentro. El día vivía **incrustado en el texto de
 * diagnóstico** (`recordatorio semanal (día 14)`), así que para ponerlo en el aviso habría que
 * volver a sacarlo del string con una regex — leer un dato de una frase que se escribió para
 * humanos es como se pierden los datos. Ahora sale como número, y la frase sigue siendo la frase.
 *
 * `dia` es `null` cuando no se sabe desde cuándo está abierta, que es distinto de cero.
 */
export function debeAvisar(v: VeredictoPuerta, c: Cadencia):
{ avisa: boolean; motivo: string; apertura: boolean; dia: number | null } {
  if (!v.abierta) return { avisa: false, motivo: 'la puerta sigue cerrada', apertura: false, dia: null };
  const d = c?.diasDesdeApertura;
  // Sin fecha de apertura NO se calla: un aviso de más es barato; uno de menos es el ticket entero.
  if (d === null || d === undefined || !Number.isFinite(d)) {
    return {
      avisa: true, motivo: 'la puerta está abierta y no se sabe desde cuándo',
      // No se sabe el día, así que NO es una apertura: se avisa como recordatorio sin número. Dar
      // por apertura lo que no consta haría que el aviso dijera «acaba de entrar» cada semana.
      apertura: false, dia: null,
    };
  }
  if (d <= 0) return { avisa: true, motivo: 'la puerta acaba de abrirse', apertura: true, dia: d };
  if (d % CADENCIA_RECORDATORIO_DIAS === 0) {
    return { avisa: true, motivo: `recordatorio semanal (día ${d})`, apertura: false, dia: d };
  }
  return {
    avisa: false, apertura: false, dia: d,
    motivo: `ya avisado; el próximo recordatorio toca el día ${Math.ceil(d / CADENCIA_RECORDATORIO_DIAS) * CADENCIA_RECORDATORIO_DIAS}`,
  };
}

/**
 * El texto del aviso, APROBADO el 17-ago-2026 (regla 30). Estuvo marcado hasta hoy porque **la
 * regla 30 no tiene excepción por destinatario**: que solo lo lea el fundador no lo convertía en
 * texto aprobado.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 DOS FORMAS, Y LA SEGUNDA NO EXISTÍA
 *
 * Hasta hoy el día de la apertura y el recordatorio de la séptima semana mandaban **el mismo
 * mensaje**: «ha entrado el primer cliente real». Al mes eso se lee como que ha entrado otro, y lo
 * que de verdad pasa —que sigue abierta y **nadie ha revisado nada**— no se decía en ninguna parte.
 *
 * Ahora la apertura anuncia el hecho y el recordatorio dice **cuántos días lleva sin revisarse**,
 * que es la información que empuja a actuar.
 *
 * ⚠️ El aviso sale por WHATSAPP (`sendWhatsAppText`), no a una pantalla ni a un log: sus saltos de
 * línea son del mensaje y llegan tal cual. No hace falta `white-space` de nada — eso es CSS, y aquí
 * no hay DOM.
 */
export function mensajeParaElFundador(v: VeredictoPuerta, cadencia?: Cadencia): string {
  const d = cadencia ? debeAvisar(v, cadencia) : { apertura: true, dia: 0 };
  const cuerpo = textoDelAviso(v);
  if (d.apertura) {
    return `🔴 HA ENTRADO EL PRIMER CLIENTE REAL — ${motivoDeApertura(v)}.
Estas decisiones se tomaron dando por hecho que no lo habría. Revísalas:
${cuerpo}`;
  }
  // Sin día conocido no se inventa un número: se dice el hecho sin él. «día null» sería peor que
  // no decirlo, y redondear a 0 diría que acaba de abrirse, que es justo lo contrario.
  const dia = d.dia === null ? '' : ` — día ${d.dia}`;
  return `🔴 LA PUERTA DE CLIENTE REAL SIGUE ABIERTA${dia} — ${motivoDeApertura(v)}.
Estas decisiones seguían dando por hecho que no había ningún cliente real, y siguen
sin revisar:
${cuerpo}`;
}
