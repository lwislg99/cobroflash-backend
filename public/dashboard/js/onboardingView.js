// public/dashboard/js/onboardingView.js
// Wizard de 5 pasos que se muestra la primera vez que el merchant entra.
// Objetivo: que el usuario envíe su primera cotización en los primeros minutos (momento WOW).

const OB_TRADES = [
  { value: 'electricista',  label: 'Electricista' },
  { value: 'fontanero',     label: 'Fontanero / Plomero' },
  { value: 'reformista',    label: 'Reformista' },
  { value: 'pintor',        label: 'Pintor' },
  { value: 'cerrajero',     label: 'Cerrajero' },
  { value: 'climatizacion', label: 'Climatización' },
  { value: 'otro',          label: 'Otro' },
];

const OB_COUNTRIES = [
  { value: 'ES', label: 'España' },
  { value: 'MX', label: 'México' },
  { value: 'CO', label: 'Colombia' },
  { value: 'AR', label: 'Argentina' },
  { value: 'PE', label: 'Perú' },
  { value: 'CL', label: 'Chile' },
];

function obTradeLabel(value) {
  return (OB_TRADES.find((t) => t.value === value) || {}).label || '';
}

function showOnboardingWizard(onComplete) {
  if (document.getElementById('onboarding-backdrop')) return;

  // Estado compartido entre pasos
  const state = {
    name: '',
    trade: '',
    country: 'ES',
    phone: '',
    catalogLoaded: false,
    firstProduct: null,      // { name, price } — para el paso WOW
    customerName: '',
    customerPhone: '',
  };

  const backdrop = document.createElement('div');
  backdrop.id = 'onboarding-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);display:flex;align-items:center;justify-content:center;z-index:300;padding:16px';

  backdrop.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px 24px;width:100%;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,.2)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#22d3ee);display:flex;align-items:center;justify-content:center;font-weight:800;color:#052e16;font-size:14px">YQ</div>
        <span style="font-weight:700;font-size:18px;color:#0f172a">Bienvenido a YaQu</span>
      </div>

      <div id="ob-steps"></div>

      <div id="ob-footer" style="display:flex;justify-content:space-between;margin-top:24px;gap:8px"></div>
      <div style="display:flex;justify-content:center;gap:6px;margin-top:16px" id="ob-dots"></div>
    </div>
  `;

  document.body.appendChild(backdrop);

  // Prefijar país con el del registro del merchant (si lo conseguimos)
  getMerchantProfile().then((m) => {
    if (m && m.country) {
      state.country = String(m.country).toUpperCase();
      const sel = document.getElementById('ob-country');
      if (sel) sel.value = state.country;
    }
    if (m && m.name && !state.name) {
      state.name = m.name;
      const inp = document.getElementById('ob-name');
      if (inp && !inp.value) inp.value = m.name;
    }
  }).catch(() => {});

  const steps = [
    // ── Paso 1 ──────────────────────────────────────────────
    {
      title: '¿A qué te dedicas?',
      render: () => `
        <p style="font-size:14px;color:#6b7280;margin:0 0 16px">En 30 segundos lo tenemos listo.</p>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:5px">Nombre de tu negocio</label>
            <input id="ob-name" type="text" placeholder="Ej: Electricidad García" value="${esc(state.name)}"
              style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:9px;font-size:14px"/>
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:5px">Tu oficio</label>
            <select id="ob-trade" style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:9px;font-size:14px;background:#fff">
              <option value="">Selecciona…</option>
              ${OB_TRADES.map((t) => `<option value="${t.value}" ${state.trade === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:5px">País</label>
            <select id="ob-country" style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:9px;font-size:14px;background:#fff">
              ${OB_COUNTRIES.map((c) => `<option value="${c.value}" ${state.country === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
          </div>
        </div>
      `,
      validate: () => document.getElementById('ob-name')?.value.trim(),
      save: async () => {
        state.name    = document.getElementById('ob-name')?.value.trim() || state.name;
        state.trade   = document.getElementById('ob-trade')?.value || '';
        state.country = document.getElementById('ob-country')?.value || state.country;
        await updateMerchantProfile({
          name: state.name,
          trade: state.trade || null,
          country: state.country,
        }).catch(() => {});
      },
    },

    // ── Paso 2 ──────────────────────────────────────────────
    {
      title: '¿Dónde te avisamos cuando cobras?',
      render: () => `
        <p style="font-size:14px;color:#6b7280;margin:0 0 16px">
          Cuando un cliente acepte o pague, te mandamos un WhatsApp al instante.
        </p>
        <div>
          <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:5px">Tu número de WhatsApp</label>
          <input id="ob-phone" type="tel" placeholder="Ej: 521XXXXXXXXXX (con código de país)" value="${esc(state.phone)}"
            style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:9px;font-size:14px"/>
          <p style="font-size:12px;color:#9ca3af;margin:6px 0 0">Sin espacios ni guiones. Incluye el código de país.</p>
        </div>
        <div style="margin-top:14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:12px 14px">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#047857">Así te avisaremos:</p>
          <p style="margin:0;font-size:13px;color:#065f46">✅ <strong>Carlos</strong> aceptó tu ${(window.appLocale && window.appLocale.quoteVerb) || 'cotización'} #1024 (150,00 ${(window.appLocale && window.appLocale.currency) || 'EUR'})</p>
        </div>
      `,
      validate: () => true,
      save: async () => {
        state.phone = document.getElementById('ob-phone')?.value.trim() || '';
        if (state.phone) await updateMerchantProfile({ whatsappPhone: state.phone }).catch(() => {});
      },
    },

    // ── Paso 3 ──────────────────────────────────────────────
    {
      title: 'Tu catálogo en 1 clic',
      render: () => {
        const hasCatalog = state.trade && state.trade !== 'otro';
        if (hasCatalog) {
          return `
            <p style="font-size:14px;color:#6b7280;margin:0 0 16px">
              Hemos preparado una lista de servicios típicos de <strong>${esc(obTradeLabel(state.trade))}</strong> con precios de mercado. Cárgalos como base y edítalos a tu gusto.
            </p>
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px">
              <input type="checkbox" id="ob-load-catalog" checked style="width:18px;height:18px;accent-color:#22c55e;flex-shrink:0"/>
              <span style="font-size:14px;color:#374151">Sí, cargar el catálogo de <strong>${esc(obTradeLabel(state.trade))}</strong></span>
            </label>
            <p style="font-size:12px;color:#9ca3af;margin:10px 0 0">Podrás añadir, editar o borrar servicios cuando quieras.</p>
          `;
        }
        return `
          <p style="font-size:14px;color:#6b7280;margin:0 0 8px">
            Un catálogo te permite crear cotizaciones en segundos con autocompletado.
          </p>
          <p style="font-size:13px;color:#9ca3af;margin:0">Podrás añadir tus servicios desde la sección <strong>Productos</strong> en cualquier momento.</p>
        `;
      },
      validate: () => true,
      save: async () => {
        const checkbox = document.getElementById('ob-load-catalog');
        const shouldLoad = checkbox && checkbox.checked && state.trade && state.trade !== 'otro';
        if (shouldLoad && !state.catalogLoaded) {
          try {
            await apiRequest('/admin/products/load-catalog', {
              method: 'POST',
              body: JSON.stringify({ trade: state.trade }),
            });
            state.catalogLoaded = true;
            // Recuperar el primer producto para prerrellenar la primera cotización
            const list = await apiRequest('/admin/products').catch(() => null);
            const items = list && (list.items || list.products || list);
            if (Array.isArray(items) && items.length) {
              state.firstProduct = { name: items[0].name, price: items[0].price };
            }
          } catch (_) { /* no bloquear el onboarding por esto */ }
        }
      },
    },

    // ── Paso 4 ──────────────────────────────────────────────
    {
      title: 'Tu primer cliente',
      render: () => `
        <p style="font-size:14px;color:#6b7280;margin:0 0 16px">
          ¿A quién le envías cotizaciones habitualmente? Lo usaremos para tu primera cotización.
        </p>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div>
            <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:5px">Nombre del cliente</label>
            <input id="ob-cust-name" type="text" placeholder="Ej: María López" value="${esc(state.customerName)}"
              style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:9px;font-size:14px"/>
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:5px">Su WhatsApp</label>
            <input id="ob-cust-phone" type="tel" placeholder="Ej: 521XXXXXXXXXX" value="${esc(state.customerPhone)}"
              style="width:100%;padding:11px 13px;border:1px solid #d1d5db;border-radius:9px;font-size:14px"/>
            <p style="font-size:12px;color:#9ca3af;margin:6px 0 0">Con código de país, sin espacios.</p>
          </div>
        </div>
      `,
      validate: () => true,
      save: async () => {
        state.customerName  = document.getElementById('ob-cust-name')?.value.trim() || '';
        state.customerPhone = document.getElementById('ob-cust-phone')?.value.trim() || '';
      },
    },

    // ── Paso 5 (WOW) ────────────────────────────────────────
    {
      title: '¡Envía tu primera cotización ahora! 🚀',
      custom: true,
      render: () => {
        const canQuote = !!state.customerName;
        const productLine = state.firstProduct
          ? `<p style="margin:0;font-size:13px;color:#065f46">Incluiremos <strong>${esc(state.firstProduct.name)}</strong> como primera línea — podrás ajustarla.</p>`
          : '';
        return `
          <p style="font-size:14px;color:#6b7280;margin:0 0 16px">
            Todo listo${state.customerName ? `, vamos a enviarle una cotización a <strong>${esc(state.customerName)}</strong>` : ''}. El cliente la recibe por WhatsApp y puede firmarla con el dedo en segundos.
          </p>
          <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px 16px;margin-bottom:8px">
            <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#047857">El momento que lo cambia todo</p>
            ${productLine}
          </div>
          ${canQuote ? '' : '<p style="font-size:12px;color:#9ca3af;margin:8px 0 0">Consejo: añade un cliente en el paso anterior para prerrellenar la cotización.</p>'}
        `;
      },
      renderFooter: (footer) => {
        footer.style.flexDirection = 'column';
        footer.innerHTML = `
          <button id="ob-wow" style="width:100%;padding:13px;border-radius:12px;border:none;background:#22c55e;color:#052e16;font-weight:800;font-size:15px;cursor:pointer">
            🚀 Enviar mi primera cotización
          </button>
          <button id="ob-explore" style="width:100%;padding:11px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;font-size:14px;cursor:pointer;color:#6b7280;margin-top:8px">
            Explorar el panel
          </button>
        `;
        footer.querySelector('#ob-wow').addEventListener('click', async () => {
          await complete();
          if (typeof openQuickQuoteModal === 'function') {
            openQuickQuoteModal({
              customerName: state.customerName,
              customerPhone: state.customerPhone,
              line: state.firstProduct
                ? { concept: state.firstProduct.name, price: state.firstProduct.price }
                : null,
            });
          }
        });
        footer.querySelector('#ob-explore').addEventListener('click', complete);
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
    renderFooter();
    renderDots();
  }

  function renderFooter() {
    const footer = document.getElementById('ob-footer');
    const step = steps[currentStep];
    footer.style.flexDirection = 'row';

    if (step.custom && typeof step.renderFooter === 'function') {
      step.renderFooter(footer);
      return;
    }

    footer.innerHTML = `
      ${currentStep > 0
        ? '<button id="ob-back" style="flex:1;padding:11px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;font-size:14px;cursor:pointer;color:#6b7280">← Atrás</button>'
        : '<button id="ob-skip" style="flex:1;padding:11px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;font-size:14px;cursor:pointer;color:#6b7280">Saltar por ahora</button>'}
      <button id="ob-next" style="flex:2;padding:11px;border-radius:10px;border:none;background:#22c55e;color:#052e16;font-weight:700;font-size:15px;cursor:pointer">
        Siguiente →
      </button>
    `;
    document.getElementById('ob-skip')?.addEventListener('click', complete);
    document.getElementById('ob-back')?.addEventListener('click', () => {
      if (currentStep > 0) { currentStep--; renderStep(); }
    });
    document.getElementById('ob-next')?.addEventListener('click', onNext);
  }

  function renderDots() {
    document.getElementById('ob-dots').innerHTML = steps.map((_, i) =>
      `<div style="width:8px;height:8px;border-radius:50%;background:${i === currentStep ? '#22c55e' : '#e5e7eb'}"></div>`
    ).join('');
  }

  async function onNext() {
    const step = steps[currentStep];
    const nextBtn = document.getElementById('ob-next');
    if (!step.validate()) {
      const input = document.querySelector('#ob-steps input, #ob-steps select');
      if (input) { input.style.borderColor = '#dc2626'; input.focus(); }
      return;
    }
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Guardando…'; }
    await step.save();
    currentStep++;
    renderStep();
  }

  async function complete() {
    await fetch('/admin/onboarding/complete', { method: 'POST' }).catch(() => {});
    backdrop.remove();
    if (typeof onComplete === 'function') onComplete();
  }

  renderStep();
}
