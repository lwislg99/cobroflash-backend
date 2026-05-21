// public/dashboard/js/plansView.js

async function renderPlansView(container) {
  container.innerHTML = `<div style="max-width:640px"><div style="font-size:13px;color:#9ca3af">Cargando planes…</div></div>`;
  try {
    const data = await apiRequest('/admin/billing/plans');
    container.innerHTML = buildPlansHtml(data);
    container.querySelectorAll('.plan-btn').forEach(btn => {
      btn.addEventListener('click', () => selectPlan(btn.dataset.plan));
    });
    container.querySelector('#portal-btn')?.addEventListener('click', openPortal);
  } catch (err) {
    container.innerHTML = `<div style="color:#b91c1c;font-size:13px">${err.message}</div>`;
  }
}

function buildPlansHtml({ currentPlan, planExpiresAt, plans }) {
  const isTrialExpired = currentPlan === 'trial' && planExpiresAt && new Date(planExpiresAt) < new Date();

  return `
    <div style="max-width:640px">
      <h2 style="margin:0 0 6px;font-size:20px">Tu plan</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
        ${isTrialExpired
          ? '⚠️ Tu periodo de prueba ha terminado. Elige un plan para seguir creando cotizaciones.'
          : currentPlan === 'trial'
          ? `🎉 Estás en el periodo de prueba gratuito${planExpiresAt ? ' · Expira ' + new Date(planExpiresAt).toLocaleDateString('es') : ''}.`
          : `Plan activo: <strong>${currentPlan}</strong>${planExpiresAt ? ' · Próxima renovación: ' + new Date(planExpiresAt).toLocaleDateString('es') : ''}`
        }
      </p>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
        ${plans.map(p => `
          <div style="border:2px solid ${currentPlan === p.id ? '#22c55e' : '#e5e7eb'};border-radius:14px;padding:16px;text-align:center">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px">${p.label}</div>
            <div style="font-size:24px;font-weight:800;color:#111827;margin-bottom:8px">$${p.price}<span style="font-size:13px;font-weight:400;color:#6b7280">/mes</span></div>
            <button class="plan-btn btn ${currentPlan === p.id ? 'btn-secondary' : 'btn-primary'}"
              data-plan="${p.id}" ${currentPlan === p.id ? 'disabled' : ''}
              style="width:100%;min-height:40px">
              ${currentPlan === p.id ? 'Plan actual' : 'Elegir'}
            </button>
          </div>
        `).join('')}
      </div>

      ${currentPlan !== 'trial' ? `
        <button id="portal-btn" class="btn btn-secondary" style="font-size:13px">
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
