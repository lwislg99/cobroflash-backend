// public/dashboard/js/plansView.js

async function renderPlansView(container) {
  container.innerHTML = `<div style="max-width:520px"><div style="color:var(--neutral-400);font-size:13px">Cargando plan…</div></div>`;
  let data;
  try {
    data = await apiRequest('/admin/billing/plans');
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Error cargando el plan</div><div class="empty-state-desc">${err.message}</div></div>`;
    return;
  }

  let annual = false;

  function render() {
    container.innerHTML = buildPlansHtml(data, annual);

    container.querySelector('#toggle-monthly')?.addEventListener('click', () => { annual = false; render(); });
    container.querySelector('#toggle-annual')?.addEventListener('click',  () => { annual = true;  render(); });

    container.querySelector('.plan-btn')?.addEventListener('click', (e) => {
      const planId = e.currentTarget.dataset.plan;
      selectPlan(planId, annual);
    });

    container.querySelector('#portal-btn')?.addEventListener('click', openPortal);
  }

  render();
}

function buildPlansHtml({ currentPlan, planExpiresAt, plans }, annual) {
  const plan = plans[0]; // plan único Pro
  if (!plan) return `<div class="empty-state"><div class="empty-state-title">Sin planes disponibles</div></div>`;

  const isTrialExpired = currentPlan === 'trial' && planExpiresAt && new Date(planExpiresAt) < new Date();
  const trialDaysLeft  = planExpiresAt
    ? Math.max(0, Math.ceil((new Date(planExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;
  const isCurrent = currentPlan === plan.id;

  const statusHtml = isTrialExpired ? `
    <div class="customers-card" style="display:flex;align-items:center;gap:12px;margin-bottom:20px;border-color:#fde68a;background:#fffbeb">
      <div style="font-size:28px">⏳</div>
      <div>
        <div style="font-weight:700;font-size:15px;color:var(--ink)">Tu prueba ha terminado, elige un plan para seguir</div>
        <div style="font-size:13px;color:var(--body);margin-top:2px">Puedes ver tus datos, pero para crear y enviar presupuestos necesitas una suscripción activa.</div>
      </div>
    </div>
  ` : currentPlan === 'trial' ? `
    <div class="customers-card" style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div style="font-size:28px">🎉</div>
      <div>
        <div style="font-weight:700;font-size:15px;color:var(--neutral-900)">Periodo de prueba gratuito</div>
        <div style="font-size:13px;color:var(--neutral-400);margin-top:2px">
          ${trialDaysLeft !== null ? `${trialDaysLeft} día${trialDaysLeft !== 1 ? 's' : ''} restante${trialDaysLeft !== 1 ? 's' : ''}` : 'Tiempo limitado'}
        </div>
      </div>
    </div>
  ` : `
    <div class="customers-card" style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div style="font-size:28px">✅</div>
      <div>
        <div style="font-weight:700;font-size:15px;color:var(--neutral-900)">Plan activo: <strong>Pro</strong></div>
        ${planExpiresAt ? `<div style="font-size:13px;color:var(--neutral-400);margin-top:2px">Próxima renovación: ${new Date(planExpiresAt).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })}</div>` : ''}
      </div>
    </div>
  `;

  const price    = annual ? plan.priceAnnual : plan.price;
  const perLabel = annual ? '/año' : '/mes';
  const saving   = annual ? `<div style="font-size:12px;color:var(--green-600);font-weight:600;margin-top:4px">= $${(plan.priceAnnual / 12).toFixed(2)}/mes · Ahorras 2 meses</div>` : '';

  const features = [
    'Cotizaciones ilimitadas',
    'Envío por WhatsApp nativo',
    'Firma digital del cliente',
    'Facturación automática',
    'Gastos y margen por trabajo',
    'Hasta 3 usuarios del equipo',
    'Soporte por WhatsApp',
  ];

  return `
    <div style="max-width:440px">
      ${statusHtml}

      <div class="customers-card">
        <div style="display:flex;justify-content:center;margin-bottom:20px">
          <div style="display:flex;background:var(--neutral-100);border-radius:8px;padding:3px;gap:3px">
            <button id="toggle-monthly" style="padding:6px 16px;border-radius:6px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;${!annual ? 'background:#fff;color:var(--neutral-900);box-shadow:0 1px 3px rgba(0,0,0,.08)' : 'background:transparent;color:var(--neutral-400)'}">
              Mensual
            </button>
            <button id="toggle-annual" style="padding:6px 16px;border-radius:6px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;${annual ? 'background:#fff;color:var(--neutral-900);box-shadow:0 1px 3px rgba(0,0,0,.08)' : 'background:transparent;color:var(--neutral-400)'}">
              Anual <span style="color:var(--green-600);font-size:11px">-21%</span>
            </button>
          </div>
        </div>

        <div style="text-align:center;margin-bottom:20px;${isCurrent ? 'border:2px solid var(--green-500);border-radius:12px;padding:16px;background:var(--neutral-50)' : ''}">
          ${isCurrent ? `<div style="display:inline-block;background:var(--green-500);color:#fff;font-size:10px;font-weight:700;padding:2px 10px;border-radius:var(--radius-full);margin-bottom:10px">Plan actual</div>` : ''}
          <div style="font-weight:700;font-size:18px;color:var(--neutral-800);margin-bottom:6px">Plan Pro</div>
          <div style="font-size:40px;font-weight:800;color:var(--neutral-900);letter-spacing:-.5px;line-height:1">
            $${price}<span style="font-size:16px;font-weight:400;color:var(--neutral-400)">${perLabel}</span>
          </div>
          ${saving}
          <div style="font-size:12px;color:var(--neutral-400);margin-top:8px">Todo incluido · Sin límites</div>
        </div>

        <ul style="list-style:none;padding:0;margin:0 0 20px;display:flex;flex-direction:column;gap:8px">
          ${features.map(f => `
            <li style="display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--neutral-700)">
              <span style="color:var(--green-500);font-weight:700;flex-shrink:0">✓</span> ${f}
            </li>
          `).join('')}
        </ul>

        ${!isCurrent ? `
          <button class="btn-primary plan-btn" data-plan="${plan.id}" style="width:100%;font-size:15px;padding:12px">
            Suscribirme — $${price}${perLabel}
          </button>
          <p style="text-align:center;font-size:12px;color:var(--neutral-400);margin:10px 0 0">
            Sin permanencia · Cancela cuando quieras
          </p>
        ` : `
          <button id="portal-btn" class="btn-secondary" style="width:100%">
            Gestionar suscripción / facturación
          </button>
        `}
      </div>

      ${currentPlan !== 'trial' && !isCurrent ? `
        <div style="margin-top:12px;text-align:center">
          <button id="portal-btn" class="btn-ghost btn-sm">Gestionar suscripción / facturación</button>
        </div>
      ` : ''}
    </div>
  `;
}

async function selectPlan(planId, annual) {
  try {
    const res = await apiRequest('/admin/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan: planId, annual: !!annual }),
    });
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
