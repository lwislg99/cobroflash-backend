// public/dashboard/js/plansView.js

async function renderPlansView(container) {
  container.innerHTML = `<div style="max-width:660px"><div style="color:var(--slate-400);font-size:13px">Cargando planes…</div></div>`;
  try {
    const data = await apiRequest('/admin/billing/plans');
    container.innerHTML = buildPlansHtml(data);
    container.querySelectorAll('.plan-btn').forEach(btn => {
      btn.addEventListener('click', () => selectPlan(btn.dataset.plan));
    });
    container.querySelector('#portal-btn')?.addEventListener('click', openPortal);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Error cargando planes</div><div class="empty-state-desc">${err.message}</div></div>`;
  }
}

function buildPlansHtml({ currentPlan, planExpiresAt, plans }) {
  const isTrialExpired = currentPlan === 'trial' && planExpiresAt && new Date(planExpiresAt) < new Date();
  const trialDaysLeft = planExpiresAt
    ? Math.max(0, Math.ceil((new Date(planExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  const planLabels = { trial: 'Trial gratuito', basic: 'Básico', pro: 'Pro', empresa: 'Empresa' };

  return `
    <div style="max-width:660px">
      <div class="customers-card" style="margin-bottom:20px">
        ${isTrialExpired ? `
          <div class="alert error" style="margin-bottom:16px">
            <strong>Tu periodo de prueba ha terminado.</strong>
            Elige un plan para seguir creando cotizaciones y facturas.
          </div>
        ` : currentPlan === 'trial' ? `
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-size:28px">🎉</div>
            <div>
              <div style="font-weight:700;font-size:15px;color:var(--slate-900)">Estás en el periodo de prueba gratuito</div>
              <div style="font-size:13px;color:var(--slate-400);margin-top:2px">
                ${trialDaysLeft !== null ? `${trialDaysLeft} día${trialDaysLeft !== 1 ? 's' : ''} restante${trialDaysLeft !== 1 ? 's' : ''}` : 'Tiempo limitado'}
              </div>
            </div>
          </div>
        ` : `
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-size:28px">✅</div>
            <div>
              <div style="font-weight:700;font-size:15px;color:var(--slate-900)">Plan activo: <strong>${planLabels[currentPlan] || currentPlan}</strong></div>
              ${planExpiresAt ? `<div style="font-size:13px;color:var(--slate-400);margin-top:2px">Próxima renovación: ${new Date(planExpiresAt).toLocaleDateString('es', {day:'2-digit',month:'long',year:'numeric'})}</div>` : ''}
            </div>
          </div>
        `}
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        ${plans.map(p => {
          const isCurrent = currentPlan === p.id;
          return `
            <div class="customers-card" style="text-align:center;position:relative;${isCurrent ? 'border:2px solid var(--green-500);box-shadow:0 0 0 3px rgba(34,197,94,.1)' : ''}">
              ${isCurrent ? `<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:var(--green-500);color:var(--green-900);font-size:10px;font-weight:700;padding:2px 10px;border-radius:var(--radius-full)">Plan actual</div>` : ''}
              <div style="font-weight:700;font-size:15px;color:var(--slate-800);margin-bottom:6px">${p.label}</div>
              <div style="font-size:28px;font-weight:800;color:var(--slate-900);letter-spacing:-.5px">
                $${p.price}<span style="font-size:13px;font-weight:400;color:var(--slate-400)">/mes</span>
              </div>
              <button class="btn ${isCurrent ? 'btn-secondary' : 'btn-primary'} btn-full plan-btn" data-plan="${p.id}" ${isCurrent ? 'disabled' : ''} style="margin-top:14px">
                ${isCurrent ? 'Plan actual' : 'Elegir este plan'}
              </button>
            </div>
          `;
        }).join('')}
      </div>

      ${currentPlan !== 'trial' ? `
        <button id="portal-btn" class="btn btn-secondary">
          Gestionar suscripción / facturación
        </button>
      ` : ''}
    </div>
  `;
}

async function selectPlan(planId) {
  try {
    const res = await apiRequest('/admin/billing/checkout', { method: 'POST', body: JSON.stringify({ plan: planId }) });
    if (res.checkoutUrl) window.location.href = res.checkoutUrl;
  } catch (err) {
    alert('Error al iniciar el pago: ' + err.message);
  }
}

async function openPortal() {
  try {
    const res = await apiRequest('/admin/billing/portal', { method: 'POST' });
    if (res.portalUrl) window.location.href = res.portalUrl;
  } catch (err) {
    alert('Error: ' + err.message);
  }
}
