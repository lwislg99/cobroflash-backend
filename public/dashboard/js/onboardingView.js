// public/dashboard/js/onboardingView.js
// Wizard de 3 PASOS VISUALES (AB4, A18.6): negocio+WhatsApp → catálogo 1 clic → primera cotización WOW.
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

// SCRUM-364 · la lista de oficios se PUBLICA para que otras vistas la reutilicen en vez de
// escribir la suya. No es ceremonia: el censo de SCRUM-310 encontró TRES listas del mismo gremio
// escritas a mano en el producto, y la cuarta habría sido la de `productsView`, que necesita
// ofrecer el oficio a quien se quedó sin él.
//
// Por qué `window.` y no fiarse del ámbito compartido de los scripts clásicos: `OB_TRADES` es un
// `const` de nivel superior y hoy NO lo usa ningún otro fichero — no hay precedente en el panel de
// que eso funcione. El que sí lo tiene (`updateMerchantProfile`, usado desde tres vistas) es una
// `function` de `api.js`. Publicarlo convierte una suposición sobre ámbitos en un contrato.
window.OB_TRADES = OB_TRADES;
window.obTradeLabel = obTradeLabel;

// SCRUM-313 (D2) · el año de la pregunta sale de la FECHA ACTUAL, jamás cableado. Cablearlo haría
// que el 1 de enero la pantalla preguntara por el año pasado y produjera un arranque que
// `resolveSeriesSeq` descarta — el clásico que se descubre en enero con un cliente delante.
const ANIO_EN_CURSO = new Date().getFullYear();
window.ANIO_EN_CURSO = ANIO_EN_CURSO;

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
    // SCRUM-313 (D2) · la continuidad de numeracion. `vieneDeOtroSitio` arranca en null —ni si ni
    // no— para que la pantalla no de por elegida una respuesta que el profesional no ha dado.
    vieneDeOtroSitio: null,
    serieNumero: '',
    seriePrefijo: 'CF',
  };

  const backdrop = document.createElement('div');
  backdrop.id = 'onboarding-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);display:flex;align-items:center;justify-content:center;z-index:300;padding:16px';

  backdrop.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px 24px;width:100%;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,.2)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#22d3ee);display:flex;align-items:center;justify-content:center;font-weight:800;color:#052e16;font-size:14px">YQ</div>
        <span style="font-weight:700;font-size:18px;color:#0f1c17">Bienvenido a YaQu</span>
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
        <p style="font-size:14px;color:#6b756f;margin:0 0 16px">En 30 segundos lo tenemos listo.</p>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label style="font-size:13px;font-weight:600;color:#333c37;display:block;margin-bottom:5px">Nombre de tu negocio</label>
            <input id="ob-name" type="text" placeholder="Ej: Electricidad García" value="${esc(state.name)}"
              style="width:100%;padding:11px 13px;border:1px solid #cdd2cb;border-radius:9px;font-size:14px"/>
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;color:#333c37;display:block;margin-bottom:5px">Tu oficio</label>
            <select id="ob-trade" style="width:100%;padding:11px 13px;border:1px solid #cdd2cb;border-radius:9px;font-size:14px;background:#fff">
              <option value="">Selecciona…</option>
              ${OB_TRADES.map((t) => `<option value="${t.value}" ${state.trade === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;color:#333c37;display:block;margin-bottom:5px">País</label>
            <select id="ob-country" style="width:100%;padding:11px 13px;border:1px solid #cdd2cb;border-radius:9px;font-size:14px;background:#fff">
              ${OB_COUNTRIES.map((c) => `<option value="${c.value}" ${state.country === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;color:#333c37;display:block;margin-bottom:5px">Tu WhatsApp <span style="font-weight:400;color:#6b756f">(te avisamos ahí cuando te acepten o paguen)</span></label>
            <input id="ob-phone" type="tel" placeholder="Ej: 34XXXXXXXXX (con código de país)" value="${esc(state.phone)}"
              style="width:100%;padding:11px 13px;border:1px solid #cdd2cb;border-radius:9px;font-size:14px"/>
          </div>
        </div>
      `,
      validate: () => document.getElementById('ob-name')?.value.trim(),
      save: async () => {
        state.name    = document.getElementById('ob-name')?.value.trim() || state.name;
        state.trade   = document.getElementById('ob-trade')?.value || '';
        state.country = document.getElementById('ob-country')?.value || state.country;
        state.phone   = document.getElementById('ob-phone')?.value.trim() || '';
        if (state.phone) await updateMerchantProfile({ whatsappPhone: state.phone }).catch(() => {});
        await updateMerchantProfile({
          name: state.name,
          trade: state.trade || null,
          country: state.country,
        }).catch(() => {});
      },
    },

    // ── Paso 2 · SCRUM-313 (D2) · ¿POR QUÉ NÚMERO VAS? ──────────────────────────────────────
    //
    // Un autónomo que ya factura no se cambia de programa porque el nuevo sea más bonito. No se
    // cambia porque romper la serie de numeración le da miedo con Hacienda. Ésta es la pregunta
    // que quita ese miedo, y va AQUÍ y no en Configuración: quien viene de otro programa no entra
    // en Configuración el primer día — entra, hace un presupuesto, y descubre el problema cuando
    // ya ha emitido tres facturas mal numeradas. La pregunta se hace cuando la respuesta sirve.
    //
    // 🔴 EL AÑO VA DENTRO DE LA PREGUNTA, y sale de la FECHA ACTUAL, nunca cableado. Preguntar
    // «¿de qué año es esa factura?» sería pedirle al usuario que resuelva un problema nuestro; y
    // cablear el año haría que el 1 de enero la pantalla preguntara por el año pasado y produjera
    // un arranque que `resolveSeriesSeq` descarta. Al llevar el año dentro, la respuesta ya trae
    // el par completo que necesita el mecanismo.
    {
      title: `¿Ya has facturado en ${ANIO_EN_CURSO}?`,
      render: () => `
        <div id="ob-serie-elec" style="display:flex;gap:10px;margin:4px 0 16px">
          <button type="button" id="ob-serie-si" class="btn-secondary" style="flex:1;min-height:44px">Sí</button>
          <button type="button" id="ob-serie-no" class="btn-secondary" style="flex:1;min-height:44px">No, empiezo ahora</button>
        </div>
        <div id="ob-serie-detalle" style="display:none">
          <label style="font-size:13px;font-weight:600;color:#333c37;display:block;margin-bottom:5px">
            ¿Cuál fue el número de tu última factura de ${ANIO_EN_CURSO}?</label>
          <div style="display:flex;gap:10px">
            <div style="flex:0 0 40%">
              <label for="ob-serie-prefijo" style="font-size:12px;color:#6b756f;display:block;margin-bottom:4px">Serie</label>
              <input id="ob-serie-prefijo" type="text" value="${esc(state.seriePrefijo)}" maxlength="10"
                style="width:100%;padding:11px 13px;border:1px solid #cdd2cb;border-radius:9px;font-size:14px"/>
            </div>
            <div style="flex:1">
              <label for="ob-serie-numero" style="font-size:12px;color:#6b756f;display:block;margin-bottom:4px">Número</label>
              <input id="ob-serie-numero" type="number" min="1" inputmode="numeric" placeholder="41"
                style="width:100%;padding:11px 13px;border:1px solid #cdd2cb;border-radius:9px;font-size:14px"/>
            </div>
          </div>
          <p style="font-size:12px;color:#6b756f;margin:8px 0 14px">
            Seguimos por ahí para que tu numeración no tenga saltos.</p>
          <div id="ob-serie-previa" aria-live="polite"
            style="background:#f4f7f4;border:1px solid #cdd2cb;border-radius:10px;padding:12px;display:none">
            <p style="margin:0 0 4px;font-size:13px;color:#333c37">Tu primera factura con YaQu será:
              <strong id="ob-serie-numero-previa" style="font-size:15px;white-space:nowrap"></strong></p>
            <p style="margin:0;font-size:12px;color:#6b756f">
              Compruébalo bien: cuando emitas esa factura, este número ya no se puede cambiar.</p>
          </div>
          <p id="ob-serie-error" role="alert" style="display:none;font-size:13px;color:#b91c1c;margin:10px 0 0"></p>
        </div>`,
      montar: () => {
        const detalle = document.getElementById('ob-serie-detalle');
        const previa  = document.getElementById('ob-serie-previa');
        const salida  = document.getElementById('ob-serie-numero-previa');
        const numero  = document.getElementById('ob-serie-numero');
        const prefijo = document.getElementById('ob-serie-prefijo');
        const error   = document.getElementById('ob-serie-error');
        const btnSi   = document.getElementById('ob-serie-si');
        const btnNo   = document.getElementById('ob-serie-no');

        const marcar = (elegido) => {
          state.vieneDeOtroSitio = elegido;
          btnSi.className = elegido ? 'btn-primary' : 'btn-secondary';
          btnNo.className = elegido ? 'btn-secondary' : 'btn-primary';
          detalle.style.display = elegido ? 'block' : 'none';
          if (elegido) numero.focus();
        };

        // ── LA VISTA PREVIA EN VIVO — el corazón de la pantalla, no un adorno ───────────────
        // Es lo único que convierte «41» en «2026-CF-042» delante de sus ojos ANTES de que sea
        // irreversible. Sin ella, el aviso de «ya no se puede cambiar» no protege nada: el
        // usuario no sabría qué está confirmando.
        //
        // Y NO SE CALCULA AQUÍ. Se la pide al servidor, que la resuelve con `resolveSeriesSeq` y
        // `formatInvoiceNumber` — quien de verdad decide al emitir. Dos sitios calculando el
        // mismo número es exactamente cómo la vista previa dice una cosa y la factura otra.
        let pedido = 0;
        const refrescarPrevia = async () => {
          const n = Number(numero.value);
          error.style.display = 'none';
          if (!Number.isInteger(n) || n < 1) { previa.style.display = 'none'; return; }
          const mio = ++pedido;
          try {
            const r = await apiRequest('/admin/onboarding/serie/previa', {
              method: 'POST',
              body: JSON.stringify({ vieneDeOtroSitio: true, ultimoNumero: n, serie: prefijo.value.trim() }),
            });
            if (mio !== pedido) return; // llegó tarde: manda la última pulsación
            salida.textContent = r.proximoNumero;
            previa.style.display = 'block';
          } catch (e) {
            if (mio !== pedido) return;
            previa.style.display = 'none';
            error.textContent = (e && e.data && e.data.titulo)
              ? `${e.data.titulo}. ${e.message}`
              : (e && e.message) || 'No se pudo calcular el número.';
            error.style.display = 'block';
          }
        };

        btnSi.addEventListener('click', () => { marcar(true); refrescarPrevia(); });
        btnNo.addEventListener('click', () => marcar(false));
        numero.addEventListener('input', refrescarPrevia);
        prefijo.addEventListener('input', refrescarPrevia);
        marcar(state.vieneDeOtroSitio === true);
      },
      textoBoton: () => (state.vieneDeOtroSitio ? 'Es correcto' : 'Siguiente'),
      save: async () => {
        state.serieNumero  = document.getElementById('ob-serie-numero')?.value || '';
        state.seriePrefijo = document.getElementById('ob-serie-prefijo')?.value.trim() || state.seriePrefijo;
        // Se manda SIEMPRE, también en «No, empiezo ahora»: el servidor escribe el par completo y
        // así el arranque queda declarado en vez de quedar a merced del valor por defecto.
        await apiRequest('/admin/onboarding/serie', {
          method: 'POST',
          body: JSON.stringify({
            vieneDeOtroSitio: state.vieneDeOtroSitio === true,
            ultimoNumero: state.vieneDeOtroSitio === true ? Number(state.serieNumero) : undefined,
            serie: state.vieneDeOtroSitio === true ? state.seriePrefijo : undefined,
          }),
        }).catch(() => {});
      },
    },

    // ── Paso 3 ──────────────────────────────────────────────
    {
      title: 'Tu catálogo en 1 clic',
      render: () => {
        const hasCatalog = state.trade && state.trade !== 'otro';
        if (hasCatalog) {
          return `
            <p style="font-size:14px;color:#6b756f;margin:0 0 16px">
              Hemos preparado una lista de servicios típicos de <strong>${esc(obTradeLabel(state.trade))}</strong> con precios de mercado. Cárgalos como base y edítalos a tu gusto.
            </p>
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;background:#f7f8f6;border:1px solid #e7e9e5;border-radius:12px;padding:12px 14px">
              <input type="checkbox" id="ob-load-catalog" checked style="width:18px;height:18px;accent-color:#22c55e;flex-shrink:0"/>
              <span style="font-size:14px;color:#333c37">Sí, cargar el catálogo de <strong>${esc(obTradeLabel(state.trade))}</strong></span>
            </label>
            <p style="font-size:12px;color:#6b756f;margin:10px 0 0">Podrás añadir, editar o borrar servicios cuando quieras.</p>
          `;
        }
        return `
          <p style="font-size:14px;color:#6b756f;margin:0 0 8px">
            Un catálogo te permite crear cotizaciones en segundos con autocompletado.
          </p>
          <p style="font-size:13px;color:#6b756f;margin:0">Podrás añadir tus servicios desde la sección <strong>Productos</strong> en cualquier momento.</p>
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

    // ── Paso 5 (WOW) ────────────────────────────────────────
    {
      title: '¡Envía tu primera cotización ahora! 🚀',
      custom: true,
      render: () => {
        const productLine = state.firstProduct
          ? `<p style="margin:0;font-size:13px;color:#065f46">Incluiremos <strong>${esc(state.firstProduct.name)}</strong> como primera línea — podrás ajustarla.</p>`
          : '';
        return `
          <p style="font-size:14px;color:#6b756f;margin:0 0 14px">
            Dinos a quién y te lo dejamos prerrellenado — el cliente la recibe por WhatsApp y la firma con el dedo en segundos.
          </p>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
            <div>
              <label style="font-size:13px;font-weight:600;color:#333c37;display:block;margin-bottom:5px">Nombre del cliente <span style="font-weight:400;color:#6b756f">(opcional)</span></label>
              <input id="ob-cust-name" type="text" placeholder="Ej: María López" value="${esc(state.customerName)}"
                style="width:100%;padding:11px 13px;border:1px solid #cdd2cb;border-radius:9px;font-size:14px"/>
            </div>
            <div>
              <label style="font-size:13px;font-weight:600;color:#333c37;display:block;margin-bottom:5px">Su WhatsApp <span style="font-weight:400;color:#6b756f">(con código de país)</span></label>
              <input id="ob-cust-phone" type="tel" placeholder="Ej: 34XXXXXXXXX" value="${esc(state.customerPhone)}"
                style="width:100%;padding:11px 13px;border:1px solid #cdd2cb;border-radius:9px;font-size:14px"/>
            </div>
          </div>
          <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px 16px;margin-bottom:8px">
            <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#047857">El momento que lo cambia todo</p>
            ${productLine}
          </div>
        `;
      },
      renderFooter: (footer) => {
        footer.style.flexDirection = 'column';
        footer.innerHTML = `
          <button id="ob-wow" style="width:100%;padding:13px;border-radius:12px;border:none;background:#22c55e;color:#052e16;font-weight:800;font-size:15px;cursor:pointer">
            🚀 Enviar mi primera cotización
          </button>
          <button id="ob-explore" style="width:100%;padding:11px;border-radius:10px;border:1px solid #e7e9e5;background:#fff;font-size:14px;cursor:pointer;color:#6b756f;margin-top:8px">
            Explorar el panel
          </button>
        `;
        footer.querySelector('#ob-wow').addEventListener('click', async () => {
          state.customerName  = document.getElementById('ob-cust-name')?.value.trim() || '';
          state.customerPhone = document.getElementById('ob-cust-phone')?.value.trim() || '';
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
      <h2 style="margin:0 0 8px;font-size:17px;color:#0f1c17">${step.title}</h2>
      ${step.render()}
    `;
    // SCRUM-313: los pasos con controles vivos necesitan enganchar sus listeners DESPUES de que
    // el HTML este en el DOM. Aditivo: un paso sin `montar` se comporta exactamente igual.
    if (typeof step.montar === 'function') step.montar();
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
        ? '<button id="ob-back" style="flex:1;padding:11px;border-radius:10px;border:1px solid #e7e9e5;background:#fff;font-size:14px;cursor:pointer;color:#6b756f">← Atrás</button>'
        : '<button id="ob-skip" style="flex:1;padding:11px;border-radius:10px;border:1px solid #e7e9e5;background:#fff;font-size:14px;cursor:pointer;color:#6b756f">Saltar por ahora</button>'}
      <button id="ob-next" style="flex:2;padding:11px;border-radius:10px;border:none;background:#22c55e;color:#052e16;font-weight:700;font-size:15px;cursor:pointer">
        ${typeof step.textoBoton === 'function' ? step.textoBoton() : 'Siguiente →'}
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
      `<div style="width:8px;height:8px;border-radius:50%;background:${i === currentStep ? '#22c55e' : '#e7e9e5'}"></div>`
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
