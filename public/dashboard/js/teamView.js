// public/dashboard/js/teamView.js
//
// SCRUM-136: HUB único de Equipo. Antes el equipo vivía en TRES sitios que listaban el mismo
// roster de tres formas distintas: esta pantalla (alta/roles), "Operarios" (dinero por
// operario) y el panel del Inicio (presupuestos del mes). El pro no sabía dónde iba cada
// cosa. Ahora la lista lleva el resumen dentro y "Operarios" desaparece como apartado.
//
// El resumen llega YA resuelto en `m.resumen` (GET /admin/team, una sola petición).
//
// ⚠️ DOS VENTANAS DISTINTAS, escritas al lado del número a propósito: los presupuestos son
// del MES en curso (se atribuyen por quien los creó) y los trabajos son del HISTÓRICO
// completo (por quien los originó). Son preguntas distintas y así lo agregan los servicios
// que ya existían; presentarlas bajo una etiqueta común diría algo falso.

// A20.3: el schema guarda 'tecnico', pero al pro se le dice "Operario" en TODA la app.
// Antes homeView escribía "Técnico" y estas dos pantallas "Operario", para el mismo valor.
function teamRoleLabel(member) {
  if (member.isOwner) return 'Propietario';
  return member.role === 'admin' ? 'Admin' : 'Operario';
}

function teamRoleClass(member) {
  if (member.isOwner) return 'status-pill-accepted';
  return member.role === 'admin' ? 'status-pill-accepted' : 'status-pill-pending';
}

async function renderTeamView(container) {
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:20px;max-width:860px';
  container.appendChild(wrap);

  // Header card con botón Invitar
  const header = document.createElement('div');
  header.className = 'customers-card';
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap';
  header.innerHTML = `
    <div>
      <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)">Equipo</h2>
      <p style="margin:0;font-size:13px;color:var(--neutral-400)">Quién trabaja contigo y qué lleva cada uno. Los operarios pueden crear presupuestos y registrar gastos, pero no tocan la configuración.</p>
    </div>
    <button class="btn-primary btn-sm" id="btn-invite-member">+ Añadir miembro</button>
  `;
  wrap.appendChild(header);

  // Alert
  const alertBox = document.createElement('div');
  alertBox.className = 'alert';
  alertBox.style.display = 'none';
  wrap.appendChild(alertBox);

  function setAlert(type, msg) {
    alertBox.textContent = msg || '';
    alertBox.className = 'alert';
    if (type === 'success') alertBox.classList.add('success');
    if (type === 'error')   alertBox.classList.add('error');
    alertBox.style.display = (type || msg) ? 'block' : 'none';
  }

  // SCRUM-136: lista de CARDS, no tabla. Cada miembro trae ahora su resumen (5 cifras), y
  // eso en una tabla obliga a 9 columnas que en móvil se apilan en una torre ilegible. La
  // card es el patrón que ya usa la vista que absorbemos (operariosView) y el resto de listas
  // con dinero de la casa (AB3).
  const listWrap = document.createElement('div');
  listWrap.style.cssText = 'display:flex;flex-direction:column;gap:12px';
  wrap.appendChild(listWrap);

  async function loadMembers() {
    uiSkeletonCards(listWrap, 3);

    let members;
    try {
      members = await apiRequest('/admin/team');
    } catch {
      uiErrorState(listWrap, 'No pudimos cargar el equipo.', loadMembers);
      return;
    }

    listWrap.innerHTML = '';

    // El propietario SIEMPRE viene (se sintetiza en backend), así que "sin equipo" es
    // "sólo estoy yo", no una lista vacía: por eso el estado vacío mira si hay ALGUIEN MÁS.
    if (members.filter((m) => !m.isOwner).length === 0) {
      const vacio = document.createElement('div');
      vacio.className = 'customers-card';
      vacio.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👷</div>
        <div class="empty-state-title">Trabaja en equipo</div>
        <div class="empty-state-desc">Invita a tus operarios: podrán crear presupuestos desde la obra y registrar gastos del trabajo, y tú apruebas los que pasen de tu umbral.</div>
      </div>`;
      listWrap.appendChild(vacio);
      return;
    }

    members.forEach((m) => {
      const tr = document.createElement('div');
      tr.className = 'customers-card';
      tr.style.cssText = 'display:flex;flex-direction:column;gap:10px';

      const roleLabel  = teamRoleLabel(m);
      const roleClass  = teamRoleClass(m);
      const statusLabel = { active: 'Activo', invited: 'Invitado', suspended: 'Suspendido' }[m.status] || m.status;
      const statusClass = { active: 'status-pill-accepted', invited: 'status-pill-pending', suspended: 'status-pill-rejected' }[m.status] || '';
      const r = m.resumen || { presupuestosEnviados: 0, presupuestosAceptados: 0, trabajosAbiertos: 0, trabajosTotales: 0, pendiente: 0 };
      const cur = (window.appLocale && window.appLocale.currency) || 'EUR';

      tr.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;color:var(--ink);font-size:15px">${esc(m.name)}</div>
            <div style="font-size:12.5px;color:var(--neutral-500);margin-top:2px;word-break:break-all">${esc(m.email)}</div>
            <div style="margin-top:6px">
              <span class="status-pill ${roleClass}">${roleLabel}</span>
              ${m.isOwner ? '' : ` <span class="status-pill ${statusClass}">${statusLabel}</span>`}
            </div>
          </div>
          <div style="flex:none;text-align:right">
            <div style="font-size:12px;color:var(--muted)">Pendiente de cobrar</div>
            <div style="font-weight:700;color:var(--ink);font-size:16px;font-variant-numeric:tabular-nums">${fmtMoneyEs(r.pendiente, cur)}</div>
          </div>
        </div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:12.5px;color:var(--muted);border-top:1px solid var(--neutral-100);padding-top:10px">
          <span>Presupuestos <b style="color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums">${r.presupuestosEnviados}</b> <span style="color:var(--neutral-400)">este mes</span>${r.presupuestosEnviados > 0 ? ` · ${r.presupuestosAceptados} aceptados` : ''}</span>
          <span>Trabajos abiertos <b style="color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums">${r.trabajosAbiertos}</b> <span style="color:var(--neutral-400)">de ${r.trabajosTotales} en total</span></span>
        </div>
        <div class="cell-actions"></div>
      `;

      // SCRUM-148: la card entera abre el detalle del miembro. Botón propio y no un
      // onclick en la card: las acciones (Editar/Suspender) viven dentro, y una card
      // clicable con botones dentro obliga a stopPropagation en cada uno — un olvido ahí
      // significa "pulsé Suspender y se me abrió otra pantalla".
      const verBtn = document.createElement('button');
      verBtn.className = 'btn-ghost btn-sm';
      verBtn.textContent = 'Ver su trabajo →';
      verBtn.addEventListener('click', () => renderTeamMemberDetail(container, m));
      tr.querySelector('.cell-actions').appendChild(verBtn);

      const actionsCell = tr.querySelector('.cell-actions');

      if (!m.isOwner) {
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap';

        if (m.status !== 'suspended') {
          // Botón editar
          const btnEdit = document.createElement('button');
          btnEdit.className = 'btn-ghost btn-sm';
          btnEdit.textContent = 'Editar';
          btnEdit.onclick = () => showEditModal(m, loadMembers, setAlert);
          actionsDiv.appendChild(btnEdit);

          // Reenviar invitación si está en invited
          if (m.status === 'invited') {
            const btnResend = document.createElement('button');
            btnResend.className = 'btn-secondary btn-sm';
            btnResend.textContent = 'Reenviar';
            btnResend.onclick = async () => {
              btnResend.disabled = true;
              try {
                await apiRequest(`/admin/team/${m.id}/resend`, { method: 'POST' });
                setAlert('success', `Invitación reenviada a ${m.email}`);
              } catch {
                setAlert('error', 'Error al reenviar la invitación.');
              }
              btnResend.disabled = false;
            };
            actionsDiv.appendChild(btnResend);
          }

          // Suspender
          const btnSuspend = document.createElement('button');
          btnSuspend.className = 'btn-danger btn-sm';
          btnSuspend.textContent = 'Suspender';
          btnSuspend.onclick = async () => {
            if (!confirm(`¿Suspender el acceso de ${m.name}? Podrás reactivarlo invitándole de nuevo.`)) return;
            btnSuspend.disabled = true;
            try {
              await apiRequest(`/admin/team/${m.id}`, { method: 'DELETE' });
              setAlert('success', `${m.name} ha sido suspendido.`);
              await loadMembers();
            } catch {
              setAlert('error', 'Error al suspender el miembro.');
              btnSuspend.disabled = false;
            }
          };
          actionsDiv.appendChild(btnSuspend);
        } else {
          // Reactivar (re-invitar)
          const btnReactivate = document.createElement('button');
          btnReactivate.className = 'btn-secondary btn-sm';
          btnReactivate.textContent = 'Reactivar';
          btnReactivate.onclick = () => showInviteModal(loadMembers, setAlert, m);
          actionsDiv.appendChild(btnReactivate);
        }

        actionsCell.appendChild(actionsDiv);
      }

      listWrap.appendChild(tr);
    });
  }

  await loadMembers();

  document.getElementById('btn-invite-member').onclick = () => showInviteModal(loadMembers, setAlert);
}

function showInviteModal(onSuccess, setAlert, prefill = null) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <h3 class="modal-title">${prefill ? 'Reactivar miembro' : 'Invitar miembro'}</h3>
        <button class="modal-close" id="modal-close-invite">&times;</button>
      </div>
      <div class="modal-body">
        <div class="alert error" id="invite-alert" style="display:none"></div>
        <form id="invite-form" style="display:flex;flex-direction:column;gap:14px">
          <div class="field">
            <label>Nombre</label>
            <input name="name" type="text" required placeholder="Ej. María García" value="${prefill ? esc(prefill.name) : ''}"/>
          </div>
          <div class="field">
            <label>Email</label>
            <input name="email" type="email" required placeholder="correo@empresa.com" value="${prefill ? esc(prefill.email) : ''}" ${prefill ? 'readonly' : ''}/>
          </div>
          <div class="field">
            <label>Rol</label>
            <select name="role">
              <option value="tecnico" ${!prefill || prefill.role === 'tecnico' ? 'selected' : ''}>Operario — puede crear presupuestos</option>
              <option value="admin" ${prefill && prefill.role === 'admin' ? 'selected' : ''}>Admin — acceso completo</option>
            </select>
          </div>
          <button type="submit" class="btn-primary" id="btn-submit-invite">Enviar invitación</button>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#modal-close-invite').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#invite-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = overlay.querySelector('#btn-submit-invite');
    const alertEl = overlay.querySelector('#invite-alert');

    const name  = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const role  = form.role.value;

    btn.disabled = true;
    btn.textContent = 'Enviando…';

    try {
      await apiRequest('/admin/team', {
        method: 'POST',
        body: JSON.stringify({ name, email, role }),
      });
      overlay.remove();
      setAlert('success', `Invitación enviada a ${email}`);
      await onSuccess();
    } catch (err) {
      // A10.3 (W3): al tope de usuarios, mensaje digno con la oferta Equipo
      const msg = err?.data?.error === 'user_limit'
        ? (err.data.message || 'Has llegado al límite de usuarios de tu plan.')
        : err?.data?.error === 'email_is_owner'
        ? 'Ese email es el del propietario de la cuenta.'
        : 'Error al enviar la invitación.';
      alertEl.textContent = msg;
      alertEl.className = 'alert error';
      alertEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Enviar invitación';
    }
  };
}

function showEditModal(member, onSuccess, setAlert) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:380px">
      <div class="modal-header">
        <h3 class="modal-title">Editar miembro</h3>
        <button class="modal-close" id="modal-close-edit">&times;</button>
      </div>
      <div class="modal-body">
        <form id="edit-form" style="display:flex;flex-direction:column;gap:14px">
          <div class="field">
            <label>Nombre</label>
            <input name="name" type="text" required value="${esc(member.name)}"/>
          </div>
          <div class="field">
            <label>Rol</label>
            <select name="role">
              <option value="tecnico" ${member.role === 'tecnico' ? 'selected' : ''}>Operario</option>
              <option value="admin"   ${member.role === 'admin'   ? 'selected' : ''}>Admin</option>
            </select>
          </div>
          <button type="submit" class="btn-primary" id="btn-submit-edit">Guardar cambios</button>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#modal-close-edit').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = overlay.querySelector('#btn-submit-edit');
    btn.disabled = true;

    try {
      await apiRequest(`/admin/team/${member.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: form.name.value.trim(), role: form.role.value }),
      });
      overlay.remove();
      setAlert('success', 'Miembro actualizado.');
      await onSuccess();
    } catch {
      setAlert('error', 'Error al actualizar.');
      btn.disabled = false;
    }
  };
}

// Mismas etiquetas de estado que el filtro de Presupuestos (quotesListView): en el detalle
// se veía el valor crudo del schema ("sent"), y el pro no lee inglés de base de datos.
// `paid`/`pending` salen del estado DERIVADO del cobro que añade listQuotesAdmin.
const QUOTE_STATUS_LABELS = {
  pending_approval: 'Pendiente de aprobación',
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Caducado',
  paid: 'Pagado',
  pending: 'Pendiente',
};
function quoteStatusLabel(status) {
  return QUOTE_STATUS_LABELS[status] || status || '';
}

// ── SCRUM-148: detalle de UN miembro ─────────────────────────────────────────
// Qué lleva ese miembro: sus presupuestos y sus trabajos. No duplica las pantallas de
// Presupuestos y Trabajos — las MISMAS rutas con un filtro por autor (?teamMemberId /
// ?operarioId), así que lo que se ve aquí y lo que se ve allí no puede divergir.
//
// ⚠️ Las dos atribuciones siguen siendo distintas (y así se rotula): un presupuesto es de
// quien lo CREÓ (Quote.teamMemberId) y un trabajo de quien lo ORIGINÓ (Job.operarioId,
// congelado en el accept, SCRUM-52). No se homogeneizan.
//
// El propietario no tiene id de miembro: viaja como 'owner' porque su autoría se guarda
// como null y un id vacío no puede significar "el dueño" por descuido (ver el backend).
async function renderTeamMemberDetail(container, member) {
  const clave = member.isOwner ? 'owner' : String(member.id);
  const cur = (window.appLocale && window.appLocale.currency) || 'EUR';

  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:20px;max-width:860px';
  container.appendChild(wrap);

  const head = document.createElement('div');
  head.className = 'customers-card';
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap';
  head.innerHTML = `
    <div>
      <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)">${esc(member.name)}</h2>
      <div><span class="status-pill ${teamRoleClass(member)}">${teamRoleLabel(member)}</span></div>
    </div>
  `;
  const volver = document.createElement('button');
  volver.className = 'btn-secondary btn-sm';
  volver.textContent = '← Volver a Equipo';
  volver.addEventListener('click', () => renderTeamView(container));
  head.appendChild(volver);
  wrap.appendChild(head);

  const bloques = document.createElement('div');
  bloques.style.cssText = 'display:flex;flex-direction:column;gap:20px';
  wrap.appendChild(bloques);

  const seccion = (titulo, nota) => {
    const s = document.createElement('div');
    s.innerHTML = `<div style="font-size:13px;font-weight:600;color:#6b756f;margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">${esc(titulo)}</div>
      <div style="font-size:12px;color:var(--neutral-400);margin:-4px 0 8px">${esc(nota)}</div>`;
    const cuerpo = document.createElement('div');
    s.appendChild(cuerpo);
    bloques.appendChild(s);
    return cuerpo;
  };

  const cuerpoTrabajos = seccion('Trabajos', 'De los que originó. Histórico completo.');
  const cuerpoPresupuestos = seccion('Presupuestos', 'De los que creó. Los 100 más recientes.');
  uiSkeletonCards(cuerpoTrabajos, 2);
  uiSkeletonCards(cuerpoPresupuestos, 2);

  const vacio = (texto) => `<div class="customers-card" style="text-align:center;color:var(--muted);font-size:13px;padding:18px">${esc(texto)}</div>`;

  // Las dos listas se piden a la vez pero se pintan por separado: si una falla, la otra
  // se ve igual — un fallo en presupuestos no puede dejar la pantalla en blanco.
  apiRequest(`/admin/jobs?operarioId=${encodeURIComponent(clave)}`)
    .then((jobs) => {
      const lista = Array.isArray(jobs) ? jobs : [];
      if (!lista.length) { cuerpoTrabajos.innerHTML = vacio('Sin trabajos a su nombre.'); return; }
      cuerpoTrabajos.innerHTML = '';
      lista.slice(0, 50).forEach((j) => {
        const card = document.createElement('div');
        card.className = 'customers-card';
        card.style.cssText = 'display:flex;justify-content:space-between;gap:12px;align-items:center;cursor:pointer;margin-bottom:8px';
        card.innerHTML = `
          <div style="min-width:0">
            <div style="font-weight:600;color:var(--ink);font-size:14px">${esc(j.titulo || 'Trabajo')}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">${esc(j.customer?.name || '')} · <span class="status-pill ${cobroPillClass(j.estadoCobro)}">${esc(j.estadoCobro || '')}</span></div>
          </div>
          <div style="flex:none;text-align:right;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums">${fmtMoneyEs(j.totalAceptado || 0, cur)}</div>
        `;
        card.addEventListener('click', () => { if (window.renderAppView) window.renderAppView('jobs-detail', { jobId: j.id }); });
        cuerpoTrabajos.appendChild(card);
      });
    })
    .catch(() => { cuerpoTrabajos.innerHTML = vacio('No pudimos cargar sus trabajos.'); });

  apiRequest(`/admin/quotes?teamMemberId=${encodeURIComponent(clave)}`)
    .then((quotes) => {
      const lista = Array.isArray(quotes) ? quotes : [];
      if (!lista.length) { cuerpoPresupuestos.innerHTML = vacio('Sin presupuestos a su nombre.'); return; }
      cuerpoPresupuestos.innerHTML = '';
      lista.slice(0, 50).forEach((q) => {
        const card = document.createElement('div');
        card.className = 'customers-card';
        card.style.cssText = 'display:flex;justify-content:space-between;gap:12px;align-items:center;cursor:pointer;margin-bottom:8px';
        // OJO a los nombres: `listQuotesAdmin` NO devuelve `total` ni `quoteNumber` — los
        // renombra a `totalAmount` y `number`. Leer `q.total` daba 0,00 € en pantalla con el
        // importe correcto en la BD, y ningún test de backend lo habría visto: solo salió en
        // el click-through.
        card.innerHTML = `
          <div style="min-width:0">
            <div style="font-weight:600;color:var(--ink);font-size:14px">${esc(q.customerName || 'Cliente')}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">#${esc(String(q.number ?? q.id))} · ${esc(quoteStatusLabel(q.status))}</div>
          </div>
          <div style="flex:none;text-align:right;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums">${fmtMoneyEs(q.totalAmount || 0, q.currency || cur)}</div>
        `;
        card.addEventListener('click', () => { if (window.renderAppView) window.renderAppView('quotes-detail', { quoteId: q.id }); });
        cuerpoPresupuestos.appendChild(card);
      });
    })
    .catch(() => { cuerpoPresupuestos.innerHTML = vacio('No pudimos cargar sus presupuestos.'); });
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
