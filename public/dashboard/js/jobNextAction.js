// public/dashboard/js/jobNextAction.js — SCRUM-366
//
// LA SIGUIENTE ACCIÓN DEL TRABAJO, EN UN SOLO SITIO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE FICHERO — no fue un olvido, fue FALTA DE ACCESO
//
// Esta escalera vivía DENTRO de `jobDetailView.js`, como función de fichero. Así que la lista
// (`jobsView.js`) **no podía usarla aunque quisiera**: no había forma de nombrarla desde otro
// script. Y como la lista también tiene que decir qué hacer con un Trabajo, escribió su propia
// versión a mano.
//
// El resultado, medido en SCRUM-309: mismo Trabajo, mismo estado, y **la lista decía «Marcar
// terminado» mientras el detalle decía «Enviar para firmar»**. Dos fuentes para la misma
// pregunta, divergiendo sin que nada avisara.
//
// La causa no es que alguien fuera descuidado: es que **la respuesta correcta no era
// alcanzable**. Por eso el arreglo no es «acordarse de usar la misma lógica», es hacerla
// accesible — y un guard que impida que aparezca una tercera superficie pintando acciones a mano.
//
// ⚠️ ESTO ES UN TRASLADO, NO UN REDISEÑO (SCRUM-366). Los seis niveles se mueven VERBATIM desde
// `jobDetailView.js`: mismo orden, mismas condiciones, mismas etiquetas. Cambiar el criterio y
// moverlo en el mismo PR haría imposible saber cuál de las dos cosas rompió qué.
//
// Depende de `fmtMoneyEs` (definida en `api.js`), así que este script CARGA DESPUÉS de api.js y
// ANTES de las dos vistas que lo usan.

// SCRUM-31 (F4): resolver de la SIGUIENTE acción del héroe (escalera aprobada por el fundador).
// PURO: decide CUÁL acción mostrar a partir de `job`; NO ejecuta nada (quien lo llama reutiliza
// los endpoints existentes). Prioridad: (1) Cobrar el resto si terminado con saldo · (2) Recordar
// pago si hay factura sin pagar ≥7 días (y hay teléfono) · (3) Enviar para firmar un albarán
// emitido · (4) Emitir un albarán en borrador · (5) Nuevo albarán si no hay ninguno · (6) nada.
// Entre albaranes gana el MÁS AVANZADO: emitido pesa más que borrador.
function jobNextAction(job, isAdmin = true) {
  // SCRUM-89: los niveles de DINERO (1 cobrar, 2 recordar) son admin-only (403 para técnico) — un
  // técnico los SALTA y el héroe solo le sugiere lo que SÍ puede (firmar/emitir/nuevo) o nada (nivel 6),
  // nunca un CTA muerto. El dinero queda deshabilitado en su sitio (la fila de factura), no en el héroe.
  // 1 · terminado con saldo → Cobrar el resto (label honesto SCRUM-34).
  if (isAdmin && job.status === 'terminado' && job.remaining && job.remaining.amount > 0) {
    const restAmount = (job.pendingStagesCount === 1 && job.nextStage)
      ? fmtMoneyEs(job.nextStage.amount, job.nextStage.currency)
      : fmtMoneyEs(job.remaining.amount, job.remaining.currency);
    const label = (job.hasCustomPlan && job.pendingStagesCount >= 2 && job.nextStage)
      ? `🪙 Cobrar siguiente tramo: ${job.nextStage.label} (${fmtMoneyEs(job.nextStage.amount, job.nextStage.currency)})`
      : `💰 Cobrar el resto (${restAmount})`;
    return { level: 1, kind: 'cobrar', label };
  }
  // 2 · factura sin pagar ≥7 días (y con teléfono para poder recordar) → Recordar pago.
  // Condicionado a propósito: no sugerir insistir a un cliente al que se facturó ayer.
  const invoices = Array.isArray(job.invoices) ? job.invoices : [];
  if (isAdmin && job.customer?.phone) {
    const vieja = invoices.find((inv) => {
      if (String(inv.status).toLowerCase() === 'paid') return false;
      const created = inv.createdAt ? new Date(inv.createdAt) : null;
      if (!created || isNaN(created.getTime())) return false;
      return (Date.now() - created.getTime()) >= 7 * 86400000;
    });
    if (vieja) return { level: 2, kind: 'recordar', label: 'Recordar pago', invoiceId: vieja.id };
  }
  // 3/4 · albaranes: gana el MÁS AVANZADO (emitido → firmar; si no, borrador → emitir).
  const albaranes = Array.isArray(job.albaranes) ? job.albaranes : [];
  const emitido = albaranes.find((a) => a.estado === 'emitido');
  if (emitido) return { level: 3, kind: 'firmar', label: 'Enviar para firmar', albaranId: emitido.id };
  const borrador = albaranes.find((a) => a.estado === 'borrador');
  if (borrador) return { level: 4, kind: 'emitir', label: 'Emitir albarán', albaranId: borrador.id };
  // 5 · sin ningún albarán → crear el primero. (Con albaranes todos firmados y nada pendiente → null.)
  if (!albaranes.length) return { level: 5, kind: 'nuevo', label: '+ Nuevo albarán' };
  // 6 · nada que sugerir.
  return null;
}

// Los `kind` que la escalera puede devolver. Los usa el guard para comprobar por ESTRUCTURA que
// ninguna superficie inventa una acción principal por su cuenta, sin tener que enumerar ficheros.
const JOB_NEXT_ACTION_KINDS = ['cobrar', 'recordar', 'firmar', 'emitir', 'nuevo'];

// Sin módulos (regla 4: vanilla, sin bundler): se cuelga del global para que las dos vistas la
// alcancen. Es exactamente lo que faltaba — la función era correcta y no era NOMBRABLE desde fuera.
window.jobNextAction = jobNextAction;
window.JOB_NEXT_ACTION_KINDS = JOB_NEXT_ACTION_KINDS;
