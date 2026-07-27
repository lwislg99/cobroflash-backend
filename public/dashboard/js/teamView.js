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

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
