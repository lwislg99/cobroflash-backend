// src/modules/messaging/domain/avisoConstancia.ts — SCRUM-477
//
// QUE UN AVISO QUE NO SALE DEJE RASTRO. El núcleo es puro; lo único que toca el mundo es escribir
// una línea de log.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA VÍCTIMA, EN UNA LÍNEA
//
// Al profesional le pagan, o le aceptan un presupuesto, y le mandamos un correo para decírselo. Si
// ese correo no sale, **el profesional cree que le avisamos y nosotros creemos que se lo dijimos**.
// Nadie se entera hasta que llama preguntando por qué no le dijimos nada.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE HABÍA, Y POR QUÉ NO BASTABA — MEDIDO, NO SUPUESTO
//
// El censo de SCRUM-475 marcó cuatro llamadores como MUDOS por su `.catch(() => {})`. Al leerlos
// para arreglarlos apareció que el emisor **sí escribía** una línea:
//
//     console.error('[merchantNotifications] Error enviando email pago:', e?.message)
//
// Así que «mudo» era demasiado fuerte: el fallo dejaba rastro. Pero ese rastro:
//
//   · **no dice PARA QUIÉN era**. Dice «Error enviando email pago: no se pudo enviar el email
//     (fallo_envio)». Con eso no se puede saber a qué profesional no se avisó, ni volver a
//     intentarlo. Un rastro que no identifica el caso no es constancia: es ruido.
//   · **no cubre el otro canal**. `sendEmail` DEVUELVE —sin lanzar— cuando el merchant no tiene
//     un correo válido. Ahí no hay excepción, el `.catch` no se dispara, y el valor devuelto se
//     tiraba: **ese caso no dejaba absolutamente nada**.
//
// Por eso esto anota en los DOS canales y con identidad, y por eso el módulo existe en vez de
// repetir un `console.error` distinto en cada sitio.
//
// ⚠️ NO PERSISTE, y es la misma frontera que declararon SCRUM-475 fase 1 y fase 2: la tabla
// (`EmailMessage`) vive en `prisma/schema.prisma`, que es del fundador, y el diff está PREPARADO Y
// SIN APLICAR en `docs/master/SCRUM-475.md`. Mientras tanto la constancia es una línea de log
// estructurada — el mismo sitio y el mismo formato que usa el emisor único. El día que exista la
// tabla, `registroDeAviso()` es exactamente la fila que hay que escribir.
import { maskEmail } from '../../../core/utils/utils';
import type { ResultadoCorreo } from '../../../integrations/enviarCorreo';
import { constanciaDeFallo, type EstadoCorreo } from './constanciaCorreo';

/** Qué aviso es. Cerrado: si nace uno nuevo, se nombra aquí y el guard lo obliga a pasar por aquí. */
export const AVISOS = [
  'pago_recibido',
  'presupuesto_aceptado',
  'presupuesto_aprobado_tecnico',
] as const;

export type Aviso = (typeof AVISOS)[number];

export type RegistroAviso = {
  evento: 'aviso_no_entregado';
  aviso: Aviso;
  /** Enmascarado SIEMPRE: un correo es dato personal y los logs los lee cualquiera con panel. */
  destinatario: string;
  estado: EstadoCorreo;
  idProveedor: string | null;
  motivo: string | null;
};

/**
 * 🔴 EL NÚCLEO, PURO. Qué queda registrado de un aviso que no llegó a salir.
 *
 * Recibe LO QUE PASÓ —el resultado del envío o la excepción— y devuelve la fila. `null` cuando el
 * aviso sí salió: no se registra ruido de lo que funcionó.
 *
 * Es puro para poder probarlo sin red y sin BD, y porque el día que haya tabla esto no cambia: lo
 * que cambia es quién se lo lleva.
 */
export function registroDeAviso(
  aviso: Aviso,
  destinatario: string,
  loQuePaso: ResultadoCorreo | { error: unknown },
): RegistroAviso | null {
  if ('error' in loQuePaso) {
    const c = constanciaDeFallo(loQuePaso.error);
    return {
      evento: 'aviso_no_entregado',
      aviso,
      destinatario: maskEmail(destinatario),
      estado: c.estado,
      idProveedor: c.idProveedor,
      motivo: c.motivo,
    };
  }
  // Salió: no hay nada que registrar. El caso feliz no paga peaje.
  if (loQuePaso.enviado) return null;
  return {
    evento: 'aviso_no_entregado',
    aviso,
    destinatario: maskEmail(destinatario),
    estado: loQuePaso.constancia.estado,
    idProveedor: loQuePaso.constancia.idProveedor,
    motivo: loQuePaso.constancia.motivo ?? loQuePaso.motivo ?? null,
  };
}

/**
 * 🔴 EL ENVOLTORIO QUE USAN LAS RUTAS — y su propiedad más importante es lo que NO hace.
 *
 * **No devuelve una promesa que pueda rechazar, y no se espera.** Un aviso que no sale NO PUEDE
 * tumbar la operación que lo dispara: el cobro se registra y el presupuesto se acepta aunque el
 * correo reviente. Ése era el motivo legítimo del `.catch()` de las rutas — el problema nunca fue
 * que hubiera `catch`, sino que estuviera VACÍO.
 *
 * Los dos canales, porque el fallo puede caerse por cualquiera de ellos:
 *   · la promesa RECHAZA  → se anota con el error;
 *   · la promesa RESUELVE con `enviado:false` → se anota con su constancia. Este es el que se
 *     perdía entero: sin excepción, el `.catch` nunca se disparaba.
 */
export function conConstancia(
  aviso: Aviso,
  destinatario: string,
  envio: Promise<ResultadoCorreo>,
): void {
  envio.then(
    (r) => anotar(registroDeAviso(aviso, destinatario, r)),
    (error) => anotar(registroDeAviso(aviso, destinatario, { error })),
  );
}

/** La única línea que toca el mundo. Estructurada, como el log del emisor único (SCRUM-475). */
function anotar(registro: RegistroAviso | null): void {
  if (!registro) return;
  console.error('[aviso]', JSON.stringify(registro));
}
