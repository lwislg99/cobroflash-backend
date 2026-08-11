// public/dashboard/js/aiQuoteAssistant.js
// Asistente IA para sugerir líneas de presupuesto y generar mensajes WhatsApp.

/**
 * Abre el modal "Sugerir con IA".
 * addLinesFn: función que recibe un array [{concept, qty, price, tax}] y los añade al formulario.
 */
function openAiSuggestModal(addLinesFn) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="modal-body">
        <p style="font-size:13px;color:var(--neutral-500);margin:0 0 12px">
          Describe el trabajo con tus propias palabras y Claude sugerirá las líneas del presupuesto usando tu catálogo de productos.
        </p>
        <div class="alert" id="ai-alert" style="display:none"></div>
        <div class="field">
          <label>Descripción del trabajo</label>
          <textarea id="ai-description"
            rows="5"
            style="width:100%;resize:vertical;font-size:14px;padding:8px 10px;border:1px solid var(--neutral-200);border-radius:8px;font-family:inherit"
            placeholder="Ej: Reparar avería en tubería de cocina, cambiar grifo mezclador y revisar sifón. También verificar el calentador de agua."
          ></textarea>
        </div>
        <button class="btn-primary" id="ai-suggest-btn" style="width:100%;margin-top:8px">
          ✨ Generar sugerencias
        </button>
        <div id="ai-results" style="margin-top:16px"></div>
      </div>
    </div>
  `;
  // SCRUM-446: la cabecera sale del constructor compartido.
  overlay.querySelector('.modal').prepend(cabeceraModal({ titulo: "✨ Sugerir líneas con IA", idCierre: "ai-modal-close" }));
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  overlay.querySelector('#ai-modal-close').onclick = closeModal;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  const btn    = overlay.querySelector('#ai-suggest-btn');
  const ta     = overlay.querySelector('#ai-description');
  const alertEl = overlay.querySelector('#ai-alert');
  const results = overlay.querySelector('#ai-results');

  function setAlert(type, msg) {
    alertEl.textContent = msg || '';
    alertEl.className = 'alert';
    if (type === 'error')   alertEl.classList.add('error');
    if (type === 'success') alertEl.classList.add('success');
    alertEl.style.display = (type || msg) ? 'block' : 'none';
  }

  btn.onclick = async () => {
    const description = ta.value.trim();
    if (!description) { setAlert('error', 'Escribe una descripción del trabajo.'); return; }

    btn.disabled = true;
    btn.textContent = '⏳ Pensando…';
    setAlert(null, '');
    results.innerHTML = '';

    let lines;
    try {
      const data = await apiRequest('/admin/ai/suggest-quote', {
        method: 'POST',
        body: JSON.stringify({ description }),
      });
      lines = data.lines;
    } catch (err) {
      const msg = err?.data?.error === 'ai_not_configured'
        ? 'La IA no está configurada. Añade GEMINI_API_KEY (gratis) en Railway.'
        : 'Error al generar sugerencias. Inténtalo de nuevo.';
      setAlert('error', msg);
      btn.disabled = false;
      btn.textContent = '✨ Generar sugerencias';
      return;
    }

    btn.disabled = false;
    btn.textContent = '✨ Generar sugerencias';

    if (!lines || lines.length === 0) {
      setAlert('error', 'La IA no generó líneas. Prueba con una descripción más detallada.');
      return;
    }

    // Mostrar las líneas sugeridas con checkboxes para aceptar/rechazar
    results.innerHTML = `<p style="font-size:13px;font-weight:600;color:var(--neutral-700);margin:0 0 8px">Sugerencias (selecciona las que quieras añadir):</p>`;

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:6px';

    lines.forEach((line, i) => {
      const item = document.createElement('label');
      item.style.cssText = 'display:flex;align-items:flex-start;gap:8px;background:var(--neutral-50);border:1px solid var(--neutral-200);border-radius:8px;padding:8px 10px;cursor:pointer;font-size:13px';
      item.innerHTML = `
        <input type="checkbox" checked style="margin-top:2px;flex-shrink:0" data-idx="${i}"/>
        <div>
          <div style="font-weight:600;color:var(--neutral-900)">${escHtml(line.concept)}</div>
          <div style="color:var(--neutral-500)">
            Cantidad: ${line.qty} · Precio: ${fmtMoneyEs(line.price, (window.appLocale && window.appLocale.currency) || 'EUR')} · IVA: ${(line.tax * 100).toFixed(0)}%
          </div>
        </div>
      `;
      list.appendChild(item);
    });

    results.appendChild(list);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-primary';
    addBtn.style.cssText = 'width:100%;margin-top:12px';
    addBtn.textContent = 'Añadir líneas seleccionadas';
    results.appendChild(addBtn);

    addBtn.onclick = () => {
      const checked = [...list.querySelectorAll('input[type=checkbox]:checked')];
      const selected = checked.map(cb => lines[Number(cb.dataset.idx)]);
      if (selected.length === 0) { setAlert('error', 'Selecciona al menos una línea.'); return; }
      // VZ-3: si la descripción entró por VOZ, el consumidor lo sabe (telemetría)
      addLinesFn(selected, { voiceUsed: ta.dataset.voiceUsed === '1' });
      closeModal();
    };
  };

  // VZ-1 (VOZ-1): dictado por voz hacia el textarea (solo se pinta con flag
  // VOICE_QUOTE_ENABLED + soporte real del navegador; degradación silenciosa)
  if (typeof attachVoiceInput === 'function') attachVoiceInput(ta);

  // Auto-focus el textarea
  setTimeout(() => ta.focus(), 100);
}

/**
 * Abre el modal "Generar mensaje WhatsApp con IA".
 * onCopyFn: callback opcional con el texto generado.
 */
function openAiMessageModal({ customerName, concept, total, currency, onCopy }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:440px">
      <div class="modal-body">
        <p style="font-size:13px;color:var(--neutral-500);margin:0 0 12px">
          Claude redactará un mensaje personalizado para enviar a ${escHtml(customerName)} junto con el presupuesto.
        </p>
        <div class="alert" id="ai-msg-alert" style="display:none"></div>
        <div id="ai-msg-result" style="display:none">
          <label style="font-size:12px;font-weight:600;color:var(--neutral-500);text-transform:uppercase;letter-spacing:.04em">Mensaje generado</label>
          <textarea id="ai-msg-text" rows="5"
            style="width:100%;resize:vertical;font-size:13px;padding:8px 10px;border:1px solid var(--neutral-200);border-radius:8px;margin-top:4px;font-family:inherit"
          ></textarea>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn-primary btn-sm" id="ai-msg-copy">Copiar mensaje</button>
            <button class="btn-ghost btn-sm" id="ai-msg-regen">↻ Regenerar</button>
          </div>
        </div>
        <button class="btn-primary" id="ai-msg-btn" style="width:100%;margin-top:8px">
          ✨ Generar mensaje
        </button>
      </div>
    </div>
  `;
  // SCRUM-446: la cabecera sale del constructor compartido.
  overlay.querySelector('.modal').prepend(cabeceraModal({ titulo: "✨ Mensaje WhatsApp con IA", idCierre: "ai-msg-close" }));
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  overlay.querySelector('#ai-msg-close').onclick = closeModal;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  const btn      = overlay.querySelector('#ai-msg-btn');
  const alertEl  = overlay.querySelector('#ai-msg-alert');
  const resultEl = overlay.querySelector('#ai-msg-result');
  const msgText  = overlay.querySelector('#ai-msg-text');

  function setAlert(type, msg) {
    alertEl.textContent = msg || '';
    alertEl.className = 'alert';
    if (type === 'error')   alertEl.classList.add('error');
    if (type === 'success') alertEl.classList.add('success');
    alertEl.style.display = (type || msg) ? 'block' : 'none';
  }

  async function generateMessage() {
    btn.disabled = true;
    btn.textContent = '⏳ Redactando…';
    setAlert(null, '');
    resultEl.style.display = 'none';

    try {
      const data = await apiRequest('/admin/ai/quote-message', {
        method: 'POST',
        body: JSON.stringify({ customerName, concept, total, currency }),
      });
      msgText.value = data.message;
      resultEl.style.display = 'block';
    } catch (err) {
      const msg = err?.data?.error === 'ai_not_configured'
        ? 'La IA no está configurada. Añade GEMINI_API_KEY (gratis) en Railway.'
        : 'Error al generar el mensaje.';
      setAlert('error', msg);
    }

    btn.disabled = false;
    btn.textContent = '✨ Generar mensaje';
  }

  btn.onclick = generateMessage;
  overlay.querySelector('#ai-msg-regen').onclick = generateMessage;
  overlay.querySelector('#ai-msg-copy').onclick = () => {
    const text = msgText.value;
    navigator.clipboard.writeText(text).then(() => {
      overlay.querySelector('#ai-msg-copy').textContent = '¡Copiado!';
      setTimeout(() => { overlay.querySelector('#ai-msg-copy').textContent = 'Copiar mensaje'; }, 2000);
    }).catch(() => {});
    if (onCopy) onCopy(text);
  };
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
