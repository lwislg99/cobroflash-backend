// public/dashboard/js/onboardingView.js
// Wizard de 3 pasos que se muestra la primera vez que el merchant entra

function showOnboardingWizard(onComplete) {
  if (document.getElementById('onboarding-backdrop')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'onboarding-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px';

  backdrop.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px 24px;width:100%;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,.2)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#22d3ee);display:flex;align-items:center;justify-content:center;font-weight:800;color:#052e16;font-size:14px">PF</div>
        <span style="font-weight:700;font-size:18px;color:#0f172a">Bienvenido a PresuFácil</span>
      </div>

      <div id="ob-steps"></div>

      <div style="display:flex;justify-content:space-between;margin-top:24px;gap:8px">
        <button id="ob-skip" style="flex:1;padding:11px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;font-size:14px;cursor:pointer;color:#6b7280">
          Saltar por ahora
        </button>
        <button id="ob-next" style="flex:2;padding:11px;border-radius:10px;border:none;background:#22c55e;color:#052e16;font-weight:700;font-size:15px;cursor:pointer">
          Siguiente →
        </button>
      </div>
      <div style="display:flex;justify-content:center;gap:6px;margin-top:16px" id="ob-dots"></div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const steps = [
    {
      title: 'Cuéntanos sobre tu negocio',
      render: () => `
        <p style="font-size:14px;color:#6b7280;margin:0 0 16px">En 30 segundos lo tenemos listo.</p>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:5px">Nombre de tu negocio</label>
            <input id="ob-name" type="text" placeholder="Ej: Electricidad García"
              style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:9px;font-size:14px"/>
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:5px">Tu nombre</label>
            <input id="ob-owner" type="text" placeholder="Ej: Carlos García"
              style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:9px;font-size:14px"/>
          </div>
        </div>
      `,
      validate: () => document.getElementById('ob-name')?.value.trim(),
      save: async () => {
        const name = document.getElementById('ob-name')?.value.trim();
        if (name) await updateMerchantProfile({ name }).catch(() => {});
      },
    },
    {
      title: '¿Dónde te avisamos cuando cobras?',
      render: () => `
        <p style="font-size:14px;color:#6b7280;margin:0 0 16px">
          Cuando un cliente acepte o pague, te mandamos un WhatsApp al instante.
        </p>
        <div>
          <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:5px">Tu número de WhatsApp</label>
          <input id="ob-phone" type="tel" placeholder="Ej: 521XXXXXXXXXX (con código de país)"
            style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:9px;font-size:14px"/>
          <p style="font-size:12px;color:#9ca3af;margin:6px 0 0">Sin espacios ni guiones. Incluye el código de país.</p>
        </div>
      `,
      validate: () => true,
      save: async () => {
        const phone = document.getElementById('ob-phone')?.value.trim();
        if (phone) await updateMerchantProfile({ whatsappPhone: phone }).catch(() => {});
      },
    },
    {
      title: 'Añade tu primer servicio',
      render: () => `
        <p style="font-size:14px;color:#6b7280;margin:0 0 16px">
          Tener un catálogo te permite crear cotizaciones en segundos con autocompletado.
        </p>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div>
            <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:5px">Nombre del servicio</label>
            <input id="ob-product-name" type="text" placeholder="Ej: Instalación punto de luz"
              style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:9px;font-size:14px"/>
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:5px">Precio habitual</label>
            <input id="ob-product-price" type="number" min="0" step="0.01" placeholder="150.00"
              style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:9px;font-size:14px"/>
          </div>
        </div>
      `,
      validate: () => true,
      save: async () => {
        const name  = document.getElementById('ob-product-name')?.value.trim();
        const price = Number(document.getElementById('ob-product-price')?.value);
        if (name && price > 0) {
          await apiRequest('/admin/products', {
            method: 'POST',
            body: JSON.stringify({ name, price }),
          }).catch(() => {});
        }
      },
    },
  ];

  let currentStep = 0;

  function renderStep() {
    const step = steps[currentStep];
    document.getElementById('ob-steps').innerHTML = `
      <h2 style="margin:0 0 8px;font-size:17px;color:#111827">${step.title}</h2>
      ${step.render()}
    `;
    document.getElementById('ob-next').textContent =
      currentStep === steps.length - 1 ? '¡Empezar!' : 'Siguiente →';
    renderDots();
  }

  function renderDots() {
    document.getElementById('ob-dots').innerHTML = steps.map((_, i) =>
      `<div style="width:8px;height:8px;border-radius:50%;background:${i === currentStep ? '#22c55e' : '#e5e7eb'}"></div>`
    ).join('');
  }

  async function complete() {
    await fetch('/admin/onboarding/complete', { method: 'POST' }).catch(() => {});
    backdrop.remove();
    if (typeof onComplete === 'function') onComplete();
  }

  document.getElementById('ob-skip').addEventListener('click', complete);

  document.getElementById('ob-next').addEventListener('click', async () => {
    const step = steps[currentStep];
    if (!step.validate()) {
      const input = document.querySelector('#ob-steps input');
      if (input) { input.style.borderColor = '#dc2626'; input.focus(); }
      return;
    }
    await step.save();
    if (currentStep < steps.length - 1) {
      currentStep++;
      renderStep();
    } else {
      await complete();
    }
  });

  renderStep();
}
