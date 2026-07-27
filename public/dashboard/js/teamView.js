// public/dashboard/js/teamView.js

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
      <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)">Miembros del equipo</h2>
      <p style="margin:0;font-size:13px;color:var(--neutral-400)">Invita colaboradores a tu cuenta. Los operarios pueden crear presupuestos pero no tocar la configuración.</p>
    </div>
    <button class="btn-primary btn-sm" id="btn-invite-member">+ Invitar miembro</button>
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

  // Tabla de miembros
  const tableCard = document.createElement('div');
  tableCard.className = 'data-card';
  wrap.appendChild(tableCard);

  const tableScroll = document.createElement('div');
  tableScroll.className = 'table-scroll';
  tableCard.appendChild(tableScroll);

  const table = document.createElement('table');
  table.className = 'table table--stack-mobile'; // feedback fundador 6-jul
  tableScroll.appendChild(table);

  async function loadMembers() {
    table.innerHTML = `<thead><tr>
      <th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th style="width:120px"></th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    let members;
    try {
      members = await apiRequest('/admin/team');
    } catch {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--neutral-400);padding:32px">Error al cargar el equipo.</td></tr>`;
      return;
    }

    if (!members.length) {
      // A6.5: estado vacío digno (mismo patrón que el resto de listas)
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">👷</div>
        <div class="empty-state-title">Trabaja en equipo</div>
        <div class="empty-state-desc">Invita a tus operarios: podrán crear presupuestos desde la obra y tú apruebas los que pasen de tu umbral.</div>
      </div></td></tr>`;
      return;
    }

    members.forEach((m) => {
      const tr = document.createElement('tr');

      const roleLabel  = m.role === 'admin' ? 'Admin' : 'Operario'; // A20.3
      const roleClass  = m.role === 'admin' ? 'status-pill-accepted' : 'status-pill-pending';
      const statusLabel = { active: 'Activo', invited: 'Invitado', suspended: 'Suspendido' }[m.status] || m.status;
      const statusClass = { active: 'status-pill-accepted', invited: 'status-pill-pending', suspended: 'status-pill-rejected' }[m.status] || '';

      tr.innerHTML = `
        <td class="cell-title">${esc(m.name)}${m.isOwner ? ' <span style="font-size:11px;color:var(--neutral-400);font-weight:400">(propietario)</span>' : ''}</td>
        <td class="col-hide-mobile" style="color:var(--neutral-500)">${esc(m.email)}</td>
        <td><span class="status-pill ${roleClass}">${roleLabel}</span></td>
        <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
        <td class="cell-actions"></td>
      `;

      const actionsCell = tr.querySelector('td:last-child');

      if (!m.isOwner) {
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'display:flex;gap:6px;justify-content:flex-end';

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
                // SCRUM-131: mirar `sent`, NO `ok`. El backend responde 200 aunque el email no
                // salga (la invitación se regenera y vive 7 días), así que un `await` sin error
                // NO significa "entregada" — decirlo era justo la mentira que cierra este ticket.
                const r = await apiRequest(`/admin/team/${m.id}/resend`, { method: 'POST' });
                if (r && r.sent === false) {
                  setAlert('error', r.message || 'No se pudo enviar el email. Puedes reintentarlo.');
                } else {
                  setAlert('success', `Invitación reenviada a ${m.email}`);
                }
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

      tbody.appendChild(tr);
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
      // SCRUM-131: el alta puede ir bien y el email NO salir. El miembro queda creado y su
      // invitación es válida 7 días, así que no es un error del alta — pero decir "invitación
      // enviada" cuando no salió deja al admin esperando a alguien que nunca recibió nada.
      const creado = await apiRequest('/admin/team', {
        method: 'POST',
        body: JSON.stringify({ name, email, role }),
      });
      overlay.remove();
      if (creado && creado.sent === false) {
        setAlert('error', `${name} está añadido, pero no se pudo enviar el email a ${email}. Usa "Reenviar" para intentarlo de nuevo.`);
      } else {
        setAlert('success', `Invitación enviada a ${email}`);
      }
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
