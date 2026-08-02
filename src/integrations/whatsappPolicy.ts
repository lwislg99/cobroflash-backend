// SCRUM-245 · AQUÍ VIVÍA `demoSendBlocked` (V0-2), y se retiró el 2-ago-2026.
//
// Bloqueaba todo envío del merchant demo cuyo destino no estuviera en `DEMO_SAFE_NUMBERS`.
// Se retira porque el requisito de producto es el contrario y está escrito en el máster (J0):
// **el producto debe poder enviar WhatsApp a cualquier número que el profesional introduzca
// como cliente, y las listas blancas de teléfonos están prohibidas.**
//
// Y se retira MEDIDO, no por cansancio de discutirlo. La razón de ser del freno era que un
// tercero pudiera abusar de la cuenta demo pública, y esa premisa se comprobó y es FALSA:
//   · No hay contraseña: la autenticación es SOLO por magic link (`Merchant` no tiene campo de
//     clave), así que la única llave de la cuenta demo es su buzón de correo.
//   · En el Email Routing de `yaqu.app` el catch-all está DESACTIVADO y no hay regla para
//     `demo@yaqu.app`: el correo a esa dirección no llega a ningún buzón. Nadie puede recibir
//     su enlace mágico, ni de fuera ni de dentro.
//   · `E2E_TEST_LOGIN_ENABLED/_SECRET/_EMAILS` NO están en producción — leído en el panel de
//     Railway (23 variables), no en el runbook que decía que no deberían estar.
//   · `/register` siempre crea un merchant NUEVO, todo `/admin/*` va tras `requireAuth`
//     (`app.ts:243`) y las rutas públicas son de token atado a un registro que ya existe: nadie
//     de fuera elige el teléfono de destino.
// El freno no protegía a nadie de nada. Lo vigila `tests/scrum245-sin-listas-blancas.test.mjs`.
//
// LO QUE ESTO NO CUBRE: los teléfonos de PRUEBA que siembran los seeds, hoy en rango de móvil
// español real. Es SCRUM-262 y es otro problema — protege de los datos de prueba, no de lo que
// escriba el profesional.
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
