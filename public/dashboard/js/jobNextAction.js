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

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-823 · LOS ESTADOS EN LOS QUE UN DOCUMENTO DE ENTREGA SIGNIFICA ALGO
//
// Un albarán es el papel de que se ha ENTREGADO un trabajo. Antes de este ticket la escalera no
// preguntaba por el estado del Trabajo para nada que no fuera cobrar, así que ofrecía documentos
// en los dos estados donde no significan nada:
//
//   · `pendiente_agendar` — no hay fecha. Es un trabajo que todavía no se ha hecho, y se le
//     ofrecía crear el albarán, EMITIRLO y hasta MANDARLO AL CLIENTE A FIRMAR.
//   · `agendado` — tiene fecha, pero **NO SE HA EMPEZADO**. Prepararle el documento de entrega es
//     el mismo error que hacerlo sin fecha, sólo que más tarde. (Fundador, 8-sep-2026: la tabla
//     original del ticket 816 decía «Agendado / en marcha → Nuevo albarán» y metía en una fila dos
//     estados que no son lo mismo — que es justo lo que este ticket vino a separar.)
//   · `cerrado` — es el único acto irreversible de la FSM. Un trabajo cerrado no recibe
//     documentos nuevos; ofrecerlo invita a reabrir algo que se dio por acabado.
//
// MEDIDO sobre los cinco estados × cuatro situaciones de albarán × dos de dinero: **12 de 40
// casos** proponían una acción de documento en un estado que no la admite. Y el caso que abrió el
// ticket es el peor de leer: **un Trabajo CERRADO proponiendo «+ Nuevo albarán»**.
//
// ⚠️ SE EXPRESA COMO LOS ESTADOS QUE **SÍ**, no como los que no. Una lista de exclusiones deja
// pasar solo el estado que se olvide; una de inclusiones deja fuera al sexto estado que alguien
// añada mañana, y eso es un botón de menos —visible y reportable— en vez de un albarán emitido
// sobre un trabajo que no se ha hecho.
const JOB_ESTADOS_CON_DOCUMENTOS = ['en_curso', 'terminado'];

// SCRUM-31 (F4): resolver de la SIGUIENTE acción del héroe (escalera aprobada por el fundador).
// PURO: decide CUÁL acción mostrar a partir de `job`; NO ejecuta nada (quien lo llama reutiliza
// los endpoints existentes). Prioridad: (1) Cobrar el resto si terminado con saldo · (2) Recordar
// pago si hay factura sin pagar ≥7 días (y hay teléfono) · (2-bis, SCRUM-823) Agendar si no tiene
// fecha · (3) Enviar para firmar un albarán emitido · (4) Emitir un albarán en borrador · (5)
// Nuevo albarán si no hay ninguno · (6) nada.
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
  // ── 2-bis · SCRUM-823 · SIN FECHA, LO QUE TOCA ES PONERLE FECHA ─────────────────────────
  //
  // Va DESPUÉS del dinero y no antes, y es deliberado: una factura sin pagar de hace una semana es
  // más urgente que colocar el trabajo en el calendario, y ese orden ya estaba decidido (AB1: todo
  // gira alrededor del dinero). Lo que cambia es que por debajo del dinero ya no se cuela un
  // documento de entrega de algo que no se ha hecho.
  //
  // El rótulo NO es nuevo: «Agendar» ya estaba en pantalla, con ese literal exacto, en el «⋯» de
  // la fila desde SCRUM-727b. Sube de sitio, no se estrena (regla 30).
  //
  // ⚠️ NO ES ADMIN-ONLY, a diferencia de los dos niveles de arriba: agendar no es dinero, y el
  // PATCH de `status`/`scheduledAt` no está en el gate por campo de SCRUM-164. Un técnico que abre
  // una avería puede ponerle fecha.
  //
  // 🔴 Y EL EJECUTOR TIENE QUE EXISTIR EN LAS DOS PANTALLAS — `abrirAgendarTrabajo`
  // (`jobAgendar.js`). Medido en Edge ANTES de escribir esto: doblando la escalera para que
  // devolviera un `kind` que el detalle no conoce, su CTA se pintaba, se pulsaba y se quedaba en
  // **«Enviando…» deshabilitado para siempre** — cero escrituras, cero avisos, ninguna modal. Un
  // nivel nuevo sin ejecutor es un CTA muerto, que es justo lo que esta escalera prohíbe en el
  // comentario de aquí arriba.
  if (job.status === 'pendiente_agendar') {
    return { level: 2.5, kind: 'agendar', label: 'Agendar' };
  }
  // ── 2-ter · SCRUM-823 · TIENE FECHA Y NO SE HA EMPEZADO: lo siguiente es ponerse ─────────
  //
  // Mismo razonamiento que el peldaño de arriba, un paso más adelante. Un Trabajo `agendado` está
  // esperando a que alguien vaya: el documento de entrega viene DESPUÉS de hacer el trabajo, no
  // antes. Con este peldaño, los albaranes empiezan a proponerse exactamente cuando el trabajo
  // está en marcha.
  //
  // El rótulo tampoco es nuevo: «▶ Empezar» ya estaba en el «⋯» de la fila (SCRUM-727b), y sólo
  // ahí — con la MISMA condición de estado que aquí, así que esto no amplía dónde se puede
  // empezar un Trabajo: sube a primaria lo que ya estaba permitido en ese estado.
  //
  // Y la transición es la que la FSM ya admite: `agendado → en_curso` (la declara `JOB_TRANSITIONS` en `job.service.ts`).
  if (job.status === 'agendado') {
    return { level: 2.6, kind: 'empezar', label: '▶ Empezar' };
  }
  // ── 3/4/5 · LOS DOCUMENTOS, SÓLO EN LOS ESTADOS QUE LOS ADMITEN (SCRUM-823) ──────────────
  //
  // Un albarán es el papel de que algo se ha ENTREGADO. En un Trabajo `cerrado` —el único acto
  // irreversible de la FSM— no hay nada nuevo que entregar, y ofrecerlo invita a reabrir lo que se
  // dio por acabado. El caso que abrió el ticket era exactamente ése: una fila CERRADA proponiendo
  // «+ Nuevo albarán».
  //
  // El dinero de arriba SÍ sigue vivo para un Trabajo cerrado, y es deliberado: cerrar con saldo
  // puede ser legítimo (lo dice `jobsCierreTrabajo`), así que una factura vieja sin pagar se sigue
  // pudiendo reclamar. Lo que se retira es el documento, no el cobro.
  if (!JOB_ESTADOS_CON_DOCUMENTOS.includes(job.status)) return null;
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
// SCRUM-823 · entra `agendar`. La lista lo tiene que saber ejecutar, y el detalle también: el
// guard `scrum823` comprueba que CADA `kind` de aquí tenga rama en las DOS pantallas.
const JOB_NEXT_ACTION_KINDS = ['cobrar', 'recordar', 'agendar', 'empezar', 'firmar', 'emitir', 'nuevo'];

// Sin módulos (regla 4: vanilla, sin bundler): se cuelga del global para que las dos vistas la
// alcancen. Es exactamente lo que faltaba — la función era correcta y no era NOMBRABLE desde fuera.
window.jobNextAction = jobNextAction;
window.JOB_NEXT_ACTION_KINDS = JOB_NEXT_ACTION_KINDS;
