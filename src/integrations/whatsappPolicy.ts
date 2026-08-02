// V0-2 (master U1.1) — Modo demo seguro: el merchant demo (regla 8) SOLO puede
// enviar WhatsApp a los números de `DEMO_SAFE_NUMBERS` (env, separados por comas).
// Destino fuera de la lista → bloquear y loguear. Lista vacía/ausente → se bloquea
// TODO envío desde el demo (imposible spamear). Rollback: quitar el guard.
//
// Pura y sin dependencias de red/BD para poder testearla (tests/whatsappPolicy.test.mjs).
import { normalizePhone } from '../core/utils/utils';
import { DEMO_MERCHANT_ID } from '../modules/invoicing/domain/emission.service';

/**
 * SCRUM-245 · LOS ÚNICOS MOTIVOS POR LOS QUE EL FRENO DEL DEMO NO SE APLICA.
 *
 * Cerrado a propósito, y con UN solo miembro: cada motivo nuevo es una puerta nueva.
 */
export type MotivoExencionDemo =
  /**
   * Responder a quien ACABA DE ESCRIBIR. No es lo mismo escribirle a alguien que contestarle:
   * el freno existe para lo que sale sin que nadie lo haya pedido —plantillas, recordatorios,
   * avisos automáticos—, y una respuesta la ha pedido el destinatario al escribir.
   *
   * Solo lo puede declarar quien PROCESA el entrante, porque es el único que lo sabe con
   * certeza. No se deduce de la ventana de 24 h de A5.2: `isServiceWindowOpen` exige un
   * `customerId`, y `recordInboundWaMessage` hace `return` temprano cuando el número no es
   * cliente de nadie — justo el caso del demo, donde quien escribe es un desconocido.
   */
  'respuesta-a-entrante';

export function demoSendBlocked(
  merchantId: number | null | undefined,
  to: string,
  safeNumbers: readonly string[],
  exencion?: MotivoExencionDemo,
): boolean {
  // ⚠️ LA EXENCIÓN VA PRIMERO Y ES EXPLÍCITA, y ese es todo el cambio de SCRUM-245: hasta hoy
  // el bot del demo respondía a cualquiera **por accidente** —sus llamadas no pasaban
  // `merchantId`, así que la comparación de abajo devolvía `false` sin que nadie lo decidiera—.
  // Comportamiento correcto por la razón equivocada: el día que alguien pasara el `merchantId`
  // «para arreglar la trazabilidad», las demos se apagaban y nadie relacionaba las dos cosas.
  // Ahora está exento porque está DECIDIDO Y ESCRITO, no porque se olvidara un parámetro.
  if (exencion) return false;
  if (merchantId !== DEMO_MERCHANT_ID) return false;
  const dest = normalizePhone(to);
  if (!dest) return true; // destino ilegible desde demo → bloquear
  const allowed = safeNumbers.map((n) => normalizePhone(n)).filter(Boolean);
  return !allowed.includes(dest);
}

// ───────────────────────────────────────────────────────────────────────────────────────
// SCRUM-180 — UN PROCESO DE TEST NO HABLA CON META. NUNCA.
//
// EL PROBLEMA REAL, y no es el que parece: los fixtures fabrican teléfonos como
// `34600` + id, y `+34 600 xxx xxx` NO es un rango reservado para pruebas — es rango de
// móvil español ordinario, y esos números pueden estar asignados a personas de verdad. Lo
// único que hoy separa la suite de mandarles WhatsApp es `process.env.WHATSAPP_DRY_RUN='1'`
// escrito DENTRO del propio fichero de test, antes del primer import de `dist` (la config se
// congela ahí). Funciona, pero es una protección de ORDEN DE EJECUCIÓN: una línea, en un
// fichero que cualquiera edita, sin nada que compruebe que sigue puesta en el momento del envío.
//
// El coste de que falle no es un test rojo: son mensajes no solicitados a desconocidos desde
// el número de negocio de Meta. Eso se paga en calidad del número y en riesgo de restricción
// de la cuenta de WhatsApp Business — infraestructura sin alternativa (regla 1: Meta Cloud API
// directa, no hay a qué caerse). Con `bot-suite` no es un mensaje: son once.
//
// POR QUÉ ESTE FRENO Y NO "UN RANGO DE PRUEBA": la vía de raíz sería que los fixtures usaran
// un prefijo no asignable, pero eso obliga a reescribir el literal en ~20 ficheros de `tests/`
// —zona roja— y hoy hay tres tickets EN CURSO justo ahí (SCRUM-159/165/167). Este freno no
// toca `tests/` y cubre MÁS: vale para cualquier número fabricado, presente o futuro, lo case
// o no un patrón. El rango sigue siendo buena idea y queda como ticket aparte.
//
// CÓMO: se pregunta si el proceso es un proceso de test, que es un hecho del RUNNER y no algo
// que se pueda olvidar dentro de un fichero. Dos señales, porque una sola tiene un hueco
// verificado:
//   · `NODE_TEST_CONTEXT` — la pone `node --test` en cada hijo. VACÍA con
//     `--test-isolation=none`, donde los tests corren en el proceso principal (comprobado,
//     no supuesto: con isolation=none sale `undefined`).
//   · `execArgv` con `--test` / `--test-*` — es lo que queda en ese modo (`["--test",
//     "--test-isolation=none"]`), y también aparece en el hijo del modo normal
//     (`--test-isolation=process`, `--test-concurrency=0`…). Las dos se solapan a propósito.
//
// En producción no se cumple ninguna: `node dist/index.js` no lleva nada de eso. Y en dry-run
// esto no aplica — ahí los senders ni llegan a la red, que es justo lo que los tests quieren.
// ───────────────────────────────────────────────────────────────────────────────────────

export function esProcesoDeTest(
  env: Record<string, string | undefined> = process.env,
  execArgv: readonly string[] = process.execArgv,
): boolean {
  if (env.NODE_TEST_CONTEXT) return true;
  return execArgv.some((a) => a === '--test' || a.startsWith('--test-'));
}

/**
 * ¿Hay que abortar antes de llamar a Meta? Sí si estamos en un proceso de test y el dry-run
 * NO está activo — es decir, justo el estado en el que un fixture llegaría a la red de verdad.
 */
export function salidaAMetaBloqueada(opts: {
  dryRun: boolean;
  env?: Record<string, string | undefined>;
  execArgv?: readonly string[];
}): boolean {
  if (opts.dryRun) return false;
  return esProcesoDeTest(opts.env, opts.execArgv);
}

export const MOTIVO_SALIDA_BLOQUEADA =
  'SCRUM-180: proceso de test intentando llamar a la API de Meta con WHATSAPP_DRY_RUN apagado. ' +
  'Los fixtures fabrican telefonos en rango movil ES real: esta llamada podria mandar WhatsApp a ' +
  'un desconocido desde el numero de negocio. Si el test necesita ejercitar el sender, pon ' +
  "WHATSAPP_DRY_RUN='1' ANTES del primer import de dist (la config se congela ahi).";
