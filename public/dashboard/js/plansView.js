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

    // Hay VARIOS .plan-btn (founding + Pro): querySelectorAll, no querySelector
    // (que solo enganchaba el primero → el botón "Suscribirme 29€" quedaba mudo).
    container.querySelectorAll('.plan-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const planId = e.currentTarget.dataset.plan;
        selectPlan(planId, annual);
      });
    });

    container.querySelectorAll('#portal-btn').forEach((b) => b.addEventListener('click', openPortal));
  }

  render();
}

function buildPlansHtml({ currentPlan, planExpiresAt, plans, founding }, annual) {
  const plan = plans[0]; // plan único Pro
  if (!plan) return `<div class="empty-state"><div class="empty-state-title">Sin planes disponibles</div></div>`;
  // V0-4: founding visible solo si quedan plazas y aún no tiene plan de pago
  const showFounding = founding && founding.seatsLeft > 0 && currentPlan !== 'pro' && currentPlan !== 'founding';

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
        <div style="font-size:12.5px;color:var(--muted);margin-top:6px">
          Tus datos son tuyos y NUNCA se borran — exporta cuando quieras:
          <a href="/admin/exports/quotes.csv" style="color:#15803d">presupuestos</a> ·
          <a href="/admin/exports/invoices.csv" style="color:#15803d">cobros</a> ·
          <a href="/admin/exports/expenses.csv" style="color:#15803d">gastos</a>
        </div>
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
        <div style="font-weight:700;font-size:15px;color:var(--neutral-900)">Plan activo: <strong>${currentPlan === 'founding' ? 'Founding (9,90 €/mes de por vida, mientras mantengas la suscripción activa)' : 'Pro'}</strong></div>
        ${planExpiresAt ? `<div style="font-size:13px;color:var(--neutral-400);margin-top:2px">Próxima renovación: ${new Date(planExpiresAt).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })}</div>` : ''}
      </div>
    </div>
  `;

  // Anual: el número grande es el equivalente MENSUAL (engancha más que el total del
  // año); el total anual real va en la nota de ahorro y en el botón (lo que se cobra).
  const heroAmount = annual ? fmtMoneyEs(plan.priceAnnual / 12) : fmtMoneyEs(plan.price);
  const perLabel   = '/mes';
  const ctaPrice   = annual ? `${plan.priceAnnual} €/año` : `${fmtMoneyEs(plan.price)}/mes`;
  const saving     = annual ? `<div style="font-size:12px;color:var(--green-600);font-weight:600;margin-top:4px">${plan.priceAnnual} €/año facturado una vez · Ahorras 2 meses</div>` : '';

  const features = [
    'Presupuestos ilimitados con firma digital',
    'Envío por WhatsApp con un toque',
    'Cobro integrado: el cliente paga desde el móvil',
    'Recordatorios automáticos de cobro',
    'Gastos y margen por trabajo',
    'Tus datos siempre exportables',
    'Soporte por email y WhatsApp',
  ];

  // V0-4 (W1): banner founding sobre Pro — 9,90 €/mes de por vida, contador REAL
  const foundingHtml = showFounding ? `
    <div class="customers-card" style="margin-bottom:14px;background:linear-gradient(135deg,var(--brand) 0%,var(--logo-cyan) 100%);border:none;color:var(--brand-ink)">
      <div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between">
        <div style="font-size:14px;font-weight:700">
          Oferta founding: <span style="text-decoration:line-through;opacity:.7">19,90 €</span>
          <span style="font-size:18px"> 9,90 €/mes</span> de por vida, mientras mantengas la suscripción activa
        </div>
        <span style="font-size:12px;font-weight:700;background:rgba(255,255,255,.35);border-radius:999px;padding:4px 12px;white-space:nowrap">
          Quedan ${founding.seatsLeft} de ${founding.seatsTotal} plazas
        </span>
      </div>
      <button class="plan-btn" data-plan="founding" style="margin-top:12px;width:100%;font-size:14px;font-weight:700;padding:11px;border:none;border-radius:999px;cursor:pointer;background:#fff;color:var(--brand-700)">
        Quiero mi plaza founding — 9,90 €/mes
      </button>
    </div>
  ` : '';

  return `
    <div style="max-width:440px">
      ${statusHtml}
      ${foundingHtml}

      <div class="customers-card">
        <div style="display:flex;justify-content:center;margin-bottom:20px">
          <div style="display:flex;background:var(--neutral-100);border-radius:8px;padding:3px;gap:3px">
            <button id="toggle-monthly" style="padding:6px 16px;border-radius:6px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;${!annual ? 'background:#fff;color:var(--neutral-900);box-shadow:0 1px 3px rgba(0,0,0,.08)' : 'background:transparent;color:var(--neutral-400)'}">
              Mensual
            </button>
            <button id="toggle-annual" style="padding:6px 16px;border-radius:6px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;${annual ? 'background:#fff;color:var(--neutral-900);box-shadow:0 1px 3px rgba(0,0,0,.08)' : 'background:transparent;color:var(--neutral-400)'}">
              Anual <span style="color:var(--green-600);font-size:11px">-17%</span>
            </button>
          </div>
        </div>

        <div style="text-align:center;margin-bottom:20px;${isCurrent ? 'border:2px solid var(--green-500);border-radius:12px;padding:16px;background:var(--neutral-50)' : ''}">
          ${isCurrent ? `<div style="display:inline-block;background:var(--green-500);color:#fff;font-size:10px;font-weight:700;padding:2px 10px;border-radius:var(--radius-full);margin-bottom:10px">Plan actual</div>` : ''}
          <div style="font-weight:700;font-size:18px;color:var(--neutral-800);margin-bottom:6px">Plan Pro</div>
          <div style="font-size:40px;font-weight:800;color:var(--neutral-900);letter-spacing:-.5px;line-height:1">
            ${heroAmount}<span style="font-size:16px;font-weight:400;color:var(--neutral-400)">${perLabel}</span>
          </div>
          <div style="font-size:12.5px;color:var(--neutral-500);margin-top:8px">+ 0,9 % solo cuando cobras con tarjeta · Bizum y transferencia, gratis</div>
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
            Suscribirme — ${ctaPrice}
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
  // A10.1 (regla 25): founding exige leer y aceptar el ALCANCE BETA antes del
  // checkout. El backend además lo bloquea (412) si no hay aceptación vigente.
  if (planId === 'founding') {
    const accepted = await openAlcanceModal();
    if (!accepted) return; // canceló — sin aceptación no hay checkout
  }
  try {
    const res = await apiRequest('/admin/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan: planId, annual: !!annual }),
    });
    if (res.checkoutUrl) window.location.href = res.checkoutUrl;
  } catch (err) {
    const msg = err?.data?.error === 'alcance_not_accepted'
      ? 'Lee y acepta el alcance de la beta para continuar.'
      : 'No se pudo iniciar el pago: ' + err.message;
    showToast(msg, 'error');
  }
}

// A10.1: modal de aceptación del alcance — el texto completo se lee en su
// página (/legal/alcance-beta, iframe); checkbox obligatorio → POST accept.
function openAlcanceModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:560px">
        <div class="modal-header">
          <h3 class="modal-title">Alcance de la oferta Founding</h3>
          <button class="modal-close" id="alc-close">&times;</button>
        </div>
        <div class="modal-body">
          <iframe src="/legal/alcance-beta" title="Alcance de la beta"
            style="width:100%;height:320px;border:1px solid var(--neutral-200);border-radius:10px;background:#fff"></iframe>
          <p style="margin:10px 0 0;font-size:12.5px;color:var(--muted)">
            También puedes <a href="/legal/alcance-beta" target="_blank" rel="noopener">abrirlo en una pestaña</a>.
          </p>
          <label style="display:flex;align-items:flex-start;gap:10px;margin-top:14px;cursor:pointer;font-size:14px;color:var(--ink)">
            <input type="checkbox" id="alc-check" style="width:18px;height:18px;margin-top:1px;accent-color:#16a34a;flex-shrink:0"/>
            <span>He leído y acepto el alcance de la beta</span>
          </label>
          <button class="btn-primary" id="alc-continue" disabled style="width:100%;margin-top:14px;opacity:.5">
            Aceptar y continuar al pago
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const done = (val) => { overlay.remove(); resolve(val); };
    overlay.querySelector('#alc-close').addEventListener('click', () => done(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(false); });

    const check = overlay.querySelector('#alc-check');
    const btn = overlay.querySelector('#alc-continue');
    check.addEventListener('change', () => {
      btn.disabled = !check.checked;
      btn.style.opacity = check.checked ? '1' : '.5';
    });
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Registrando…';
      try {
        await apiRequest('/admin/billing/accept-alcance', { method: 'POST' });
        done(true);
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Aceptar y continuar al pago';
        showToast('No se pudo registrar la aceptación: ' + err.message, 'error');
      }
    });
  });
}

async function openPortal() {
  try {
    const res = await apiRequest('/admin/billing/portal', { method: 'POST' });
    if (res.portalUrl) window.location.href = res.portalUrl;
  } catch (err) {
    showToast('No se pudo abrir el portal: ' + err.message, 'error');
  }
}
