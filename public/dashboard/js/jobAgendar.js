// public/dashboard/js/jobAgendar.js — SCRUM-823
//
// AGENDAR UN TRABAJO, EN UN SOLO SITIO Y ALCANZABLE DESDE LAS DOS PANTALLAS.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE FICHERO — ES EL DEFECTO DE SCRUM-366, EN ESPEJO
//
// SCRUM-366 sacó `jobNextAction` de dentro de `jobDetailView.js` porque la lista **no podía
// nombrarla aunque quisiera**, y por eso escribió la suya: mismo Trabajo, dos respuestas.
//
// Aquí pasa exactamente lo mismo del revés. `abrirAgendar` y `jobsModal` vivían DENTRO de
// `jobsView.js`, así que el detalle no podía alcanzarlas — y eso, medido, es lo que hacía que
// **esta lista fuera el único sitio del producto donde se agenda un Trabajo**: `scheduledAt`
// aparece **0 veces** en `jobDetailView.js` y no tiene ni una transición de estado.
//
// 🔴 Y NO ES TEÓRICO. Medido en Edge el 8-sep-2026, antes de tocar nada: doblando la escalera
// para que devolviera `kind: 'agendar'`, el detalle **pintaba el botón**, se pulsaba, y se quedaba
// en **«Enviando…» deshabilitado para siempre** — cero escrituras, cero avisos, ninguna modal.
// Un CTA muerto que además afirma que está enviando algo. Es lo que la propia escalera prohíbe en
// su comentario («nunca un CTA muerto»), y habría entrado por la puerta de atrás.
//
// ⚠️ ESTO ES UN TRASLADO, NO UN REDISEÑO — la misma disciplina que SCRUM-366. Las dos funciones se
// mueven VERBATIM desde `jobsView.js`: mismo marcado, mismas clases, mismos textos, mismo
// comportamiento. Cambiar el criterio y moverlo en el mismo PR haría imposible saber cuál de las
// dos cosas rompió qué.
//
// Depende de `showToast` (api.js), así que este script CARGA DESPUÉS de api.js y ANTES de las dos
// vistas que lo usan. Las clases (`jobs-modal*`) ya están en la hoja y no se tocan.

/**
 * El modal de la casa. No estrena componente: `.modal-overlay` + `.modal` son los que ya usan el
 * resto de pantallas, y el `Escape`/clic fuera se comportan igual que allí.
 *
 * Se mueve aquí porque `abrirAgendarTrabajo` lo necesita; `jobsView.js` lo sigue usando por el
 * global, que es como se comparte todo en un panel sin bundler (regla 4).
 */
function jobsModal(titulo, cuerpo, acciones) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const panel = document.createElement('div');
  panel.className = 'modal jobs-modal';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', titulo);

  const h = document.createElement('div');
  h.className = 'jobs-modal-titulo';
  h.textContent = titulo;
  panel.appendChild(h);
  panel.appendChild(cuerpo);

  const pie = document.createElement('div');
  pie.className = 'jobs-modal-pie';
  const cerrar = () => { document.removeEventListener('keydown', onKey, true); overlay.remove(); };
  function onKey(e) { if (e.key === 'Escape') cerrar(); }
  const cancelar = document.createElement('button');
  cancelar.className = 'btn-secondary btn-sm';
  cancelar.textContent = 'Cancelar';
  cancelar.addEventListener('click', cerrar);
  pie.appendChild(cancelar);
  acciones(pie, cerrar);
  panel.appendChild(pie);

  overlay.appendChild(panel);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(overlay);
  return cerrar;
}

/**
 * Agendar. El `datetime-local` sale de la fila y entra aquí: dentro de la fila era lo que la
 * hacía gigante, y quitarlo sin más habría borrado la única forma de agendar que hay en todo el
 * producto.
 *
 * `patch(cuerpo, mensaje)` lo pone QUIEN LLAMA: la lista y el detalle refrescan cosas distintas
 * después de guardar, y ésa es la única diferencia legítima entre las dos. Lo que se decide aquí
 * —qué campos se escriben y con qué texto se confirma— es lo mismo para las dos.
 *
 * Los dos rótulos («Agendar» / «Reagendar») son los que ya estaban en pantalla en el «⋯» desde
 * SCRUM-727b: este ticket no estrena ni uno (regla 30).
 */
function abrirAgendarTrabajo(j, patch) {
  const cuerpo = document.createElement('div');
  cuerpo.className = 'jobs-modal-cuerpo';
  const dt = document.createElement('input');
  dt.type = 'datetime-local';
  dt.className = 'input';
  dt.id = 'jobs-agendar-fecha';
  if (j.scheduledAt) {
    const d = new Date(j.scheduledAt);
    dt.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  const lab = document.createElement('label');
  lab.className = 'jobs-modal-label';
  lab.setAttribute('for', dt.id);
  lab.textContent = 'Fecha y hora';
  cuerpo.appendChild(lab);
  cuerpo.appendChild(dt);

  jobsModal(j.status === 'agendado' ? 'Reagendar' : 'Agendar', cuerpo, (pie, cerrar) => {
    const okAgendar = document.createElement('button');
    okAgendar.className = 'btn-primary btn-sm';
    okAgendar.textContent = j.status === 'agendado' ? 'Reagendar' : 'Agendar';
    okAgendar.addEventListener('click', () => {
      if (!dt.value) { showToast('Elige fecha y hora primero.', 'warn'); return; }
      cerrar();
      patch({ status: 'agendado', scheduledAt: new Date(dt.value).toISOString() }, '📅 Trabajo agendado');
    });
    pie.appendChild(okAgendar);
  });
  setTimeout(() => dt.focus(), 0);
}

// Sin módulos (regla 4: vanilla, sin bundler): se cuelgan del global para que las DOS vistas las
// alcancen. Es exactamente lo que faltaba — las funciones eran correctas y no eran NOMBRABLES
// desde fuera de `jobsView.js`.
if (typeof window !== 'undefined') {
  window.jobsModal = jobsModal;
  window.abrirAgendarTrabajo = abrirAgendarTrabajo;
}
