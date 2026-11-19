// public/dashboard/js/plansView.js

async function renderPlansView(container) {
  container.innerHTML = `<div class="j3e-04391f0"><div class="j3e-d7275d8">Cargando plan…</div></div>`;
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

function buildPlansHtml({ currentPlan, planExpiresAt, plans, founding, suscripcionViva }, annual) {
  const plan = plans[0]; // plan único Pro
  if (!plan) return `<div class="empty-state"><div class="empty-state-title">Sin planes disponibles</div></div>`;
  // V0-4: founding visible solo si quedan plazas y aún no tiene plan de pago.
  // SCRUM-1402k (P2, c.20832): ni a quien ya tiene una suscripción viva. La decide el servidor
  // (`tieneSuscripcionViva`), así que esta pantalla no lleva su propia lista de planes de pago.
  const showFounding = founding && founding.seatsLeft > 0 && currentPlan !== 'pro' && currentPlan !== 'founding' && !suscripcionViva;

  const isTrialExpired = currentPlan === 'trial' && planExpiresAt && new Date(planExpiresAt) < new Date();
  const trialDaysLeft  = planExpiresAt
    ? Math.max(0, Math.ceil((new Date(planExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;
  const isCurrent = currentPlan === plan.id;
  // SCRUM-1402k: con una suscripción viva (Pro o no) la tarjeta ofrece gestionarla, no otra.
  const conSuscripcion = isCurrent || suscripcionViva === true;
  // SCRUM-1402k (c.20866): a quien tiene una suscripción viva de Equipo no se le enseña la tarjeta de
  // Pro; le queda el botón de gestionar de debajo. Sin texto nuevo.
  const ocultaPro = currentPlan === 'equipo' && suscripcionViva === true;

  // SCRUM-345 · El rotulo «cobros» de la tarjeta de prueba caducada apuntaba a `invoices.csv`, que
  // el propio auditor llama `facturas.csv`. Se pulsaba «cobros», bajaba algo, se abria, y eran
  // FACTURAS: el peor caso, porque sale un fichero REAL que no es el que se pidio y el profesional
  // se lo lleva a su gestoria creyendolo. Llevaba escrito y sin decidir en DOS entradas de master
  // (SCRUM-343:55-58 y SCRUM-321:121) — cuarta vez que un aviso escrito no impide nada.
  //
  // Decision del fundador (10-ago-2026): se REAPUNTA el enlace, no se renombra el rotulo. El boton
  // dice «cobros», existe una exportacion de cobros de verdad y quien lo pulsa quiere cobros: lo
  // que estaba mal era el destino. Renombrarlo dejaria esta pantalla sin acceso a cobros — una
  // perdida de funcion disfrazada de arreglo de copy — y ademas exigiria microcopy nueva.
  const statusHtml = isTrialExpired ? `
    <div class="j3e-480940b customers-card">
      <div class="j3e-a2600b0">⏳</div>
      <div>
        <div class="j3e-626dca9">Tu prueba ha terminado, elige un plan para seguir</div>
        <div class="j3e-e627574">Puedes ver tus datos, pero para crear y enviar presupuestos necesitas una suscripción activa.</div>
        <div class="j3e-d56471a">
          Tus datos son tuyos y NUNCA se borran — exporta cuando quieras:
          <a href="/admin/exports/quotes.csv" class="j3e-4a12b6e">presupuestos</a> ·
          <a href="/admin/exports/charges.csv" class="j3e-4a12b6e">cobros</a> ·
          <a href="/admin/exports/expenses.csv" class="j3e-4a12b6e">gastos</a>
        </div>
      </div>
    </div>
  ` : currentPlan === 'trial' ? `
    <div class="j3e-857bdd4 customers-card">
      <div class="j3e-a2600b0">🎉</div>
      <div>
        <div class="j3e-b6de9e3">Periodo de prueba gratuito</div>
        <div class="j3e-8ad4db4">
          ${trialDaysLeft !== null ? `${trialDaysLeft} día${trialDaysLeft !== 1 ? 's' : ''} restante${trialDaysLeft !== 1 ? 's' : ''}` : 'Tiempo limitado'}
        </div>
      </div>
    </div>
  ` : `
    <div class="j3e-857bdd4 customers-card">
      <div class="j3e-a2600b0">✅</div>
      <div>
        <div class="j3e-b6de9e3">Plan activo: <strong>${currentPlan === 'founding' ? 'Founding (9,90 €/mes de por vida, mientras mantengas la suscripción activa)' : currentPlan === 'equipo' ? 'Equipo' : 'Pro'}</strong></div>
        ${planExpiresAt ? `<div class="j3e-8ad4db4">Próxima renovación: ${new Date(planExpiresAt).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })}</div>` : ''}
      </div>
    </div>
  `;

  // Anual: el número grande es el equivalente MENSUAL (engancha más que el total del
  // año); el total anual real va en la nota de ahorro y en el botón (lo que se cobra).
  const heroAmount = annual ? fmtMoneyEs(plan.priceAnnual / 12) : fmtMoneyEs(plan.price);
  const perLabel   = '/mes';
  const ctaPrice   = annual ? `${plan.priceAnnual} €/año` : `${fmtMoneyEs(plan.price)}/mes`;
  const saving     = annual ? `<div class="j3e-18b030c">${plan.priceAnnual} €/año facturado una vez · Ahorras 2 meses</div>` : '';

  // SCRUM-1029 (regla 24): estas dos filas prometen cobro; en `receipt` (ES real, facturación
  // apagada) YaQu no cobra por ninguna vía. Se OCULTAN para ese modo, no se reescriben (texto
  // sustituto pendiente de firma, docs/master/SCRUM-1029.md).
  const SOLO_SI_COBRA = new Set([
    'Cobro integrado: el cliente paga desde el móvil',
    'Recordatorios automáticos de cobro',
  ]);
  const features = [
    'Presupuestos ilimitados con firma digital',
    'Envío por WhatsApp con un toque',
    'Cobro integrado: el cliente paga desde el móvil',
    'Recordatorios automáticos de cobro',
    'Gastos y margen por trabajo',
    'Tus datos siempre exportables',
    // SCRUM-406 · decía «Soporte por email y WhatsApp»; ese WhatsApp de soporte NO EXISTE en el
    // código (ningún `wa.me` del producto apunta a YaQu). Se retira la mención, no se reescribe.
    'Soporte por email',
  ].filter((f) => window.appModoEmision !== 'receipt' || !SOLO_SI_COBRA.has(f));

  // SCRUM-1164 (#7) · la misma regla que las dos filas de arriba, y se quedó fuera: «cobras con
  // tarjeta · Bizum y transferencia» describe cobros que en `receipt` no ocurren por ninguna vía
  // (regla 24). Se oculta, no se reescribe.
  const notaComision = window.appModoEmision === 'receipt'
    ? ''
    : '<div class="j3e-0855863">+ 0,9 % solo cuando cobras con tarjeta · Bizum y transferencia, gratis</div>';

  // V0-4 (W1): banner founding sobre Pro — 9,90 €/mes de por vida, contador REAL
  const foundingHtml = showFounding ? `
    <div class="j3e-58d699c customers-card">
      <div class="j3e-9cea5ce">
        <div class="j3e-a1b26d5">
          Oferta founding: <span class="j3e-3131eb0">19,90 €</span>
          <span class="j3e-4ff818f"> 9,90 €/mes</span> de por vida, mientras mantengas la suscripción activa
        </div>
        <span class="j3e-867572a">
          Quedan ${founding.seatsLeft} de ${founding.seatsTotal} plazas
        </span>
      </div>
      <button class="j3e-3350dfb plan-btn" data-plan="founding">
        Quiero mi plaza founding — 9,90 €/mes
      </button>
    </div>
  ` : '';

  return `
    <div class="j3e-5521062">
      ${statusHtml}
      ${foundingHtml}

      ${ocultaPro ? '' : `<div class="customers-card">
        <div class="j3e-e791a2c">
          <div class="j3e-3fe60ac">
            <button id="toggle-monthly" class="${!annual ? 'j3e-fbb8fe6' : 'j3e-c3d1d19'}">
              Mensual
            </button>
            <button id="toggle-annual" class="${annual ? 'j3e-fbb8fe6' : 'j3e-c3d1d19'}">
              Anual <span class="j3e-5c97094">-17%</span>
            </button>
          </div>
        </div>

        <div class="${isCurrent ? 'j3e-7130325' : 'j3e-9f77f85'}">
          ${isCurrent ? `<div class="j3e-2d05b1d">Plan actual</div>` : ''}
          <div class="j3e-69e7d1c">Plan Pro</div>
          <div class="j3e-9a17a94">
            ${heroAmount}<span class="j3e-80cddd9">${perLabel}</span>
          </div>
          ${notaComision}
          ${saving}
          <div class="j3e-a83343d">Todo incluido · Sin límites</div>
        </div>

        <ul class="j3e-2a5a0b5">
          ${features.map(f => `
            <li class="j3e-3cc20a6">
              <span class="j3e-3999e17">✓</span> ${f}
            </li>
          `).join('')}
        </ul>

        ${!conSuscripcion ? `
          <button class="j3e-bc1a03e btn-primary plan-btn" data-plan="${plan.id}">
            Suscribirme — ${ctaPrice}
          </button>
          <p class="j3e-85eb928">
            Sin permanencia · Cancela cuando quieras
          </p>
        ` : `
          <button id="portal-btn" class="j3e-0466783 btn-secondary">
            Gestionar suscripción / facturación
          </button>
        `}
      </div>`}

      ${currentPlan !== 'trial' && (!conSuscripcion || ocultaPro) ? `
        <div class="j3e-cfd7bd7">
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
      <div class="j3e-765d57b modal">
        <div class="modal-body">
          <iframe src="/legal/alcance-beta" title="Alcance de la beta"
            class="j3e-36a245b"></iframe>
          <p class="j3e-b37c531">
            También puedes <a href="/legal/alcance-beta" target="_blank" rel="noopener">abrirlo en una pestaña</a>.
          </p>
          <label class="j3e-2ddb7ed">
            <input type="checkbox" id="alc-check" class="j3e-8640d47"/>
            <span>He leído y acepto el alcance de la beta</span>
          </label>
          <button class="j3e-ec4c999 btn-primary" id="alc-continue" disabled>
            Aceptar y continuar al pago
          </button>
        </div>
      </div>`;
    // SCRUM-446: la cabecera sale del constructor compartido.
    overlay.querySelector('.modal').prepend(cabeceraModal({ titulo: "Alcance de la oferta Founding", idCierre: "alc-close" }));
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
