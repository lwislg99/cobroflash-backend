// public/dashboard/js/api.js

// Si el backend sirve el dashboard desde el mismo dominio, base = "".
const API_BASE_URL = ""; // mismo origin (http://localhost:3000)

async function apiRequest(path, options = {}) {
  const url = API_BASE_URL + path;

  const finalOptions = {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  };

  const res = await fetch(url, finalOptions);

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* respuesta no JSON */ }

    // Prueba caducada: en vez de un error feo, llevamos al usuario a Planes
    // (cerrando cualquier modal abierto) para que pueda suscribirse.
    if (res.status === 403 && data && data.error === 'trial_expired') {
      document.querySelectorAll('.modal-overlay').forEach((m) => m.remove());
      const nav = document.querySelector('.nav-item[data-view="plans"]');
      if (nav) nav.click();
      else window.location.hash = '#plans';
      const e = new Error('Tu prueba ha terminado. Elige un plan para continuar.');
      e.status = 403; e.data = data; e.handled = true;
      throw e;
    }

    const err = new Error(`API ${res.status}: ${data?.error || res.statusText}`);
    err.status = res.status;
    err.data   = data;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

// -------- UI helpers compartidos (carga / error) --------

// Pinta un estado de error con botón de reintento dentro de `container`.
// onRetry se llama al pulsar "Reintentar". Reutilizable por cualquier vista.
function uiErrorState(container, message, onRetry) {
  if (!container) return;
  container.innerHTML = `
    <div class="state-error" role="alert" aria-live="assertive">
      <div class="state-error-ico" aria-hidden="true">⚠️</div>
      <div class="state-error-msg">${message || 'No pudimos cargar la información.'}</div>
      ${onRetry ? '<button type="button" class="state-error-retry">Reintentar</button>' : ''}
    </div>`;
  if (onRetry) {
    container.querySelector('.state-error-retry')?.addEventListener('click', onRetry);
  }
}
window.uiErrorState = uiErrorState;

// Marca un campo como inválido (origen del error) y lo enfoca. Limpia los
// previos dentro de `scope` para no acumular marcas.
function uiMarkFieldError(el, scope) {
  (scope || document).querySelectorAll('.input-error').forEach((n) => n.classList.remove('input-error'));
  if (!el) return;
  el.classList.add('input-error');
  el.focus?.();
  const clear = () => { el.classList.remove('input-error'); el.removeEventListener('input', clear); };
  el.addEventListener('input', clear);
}
window.uiMarkFieldError = uiMarkFieldError;

// P-A66-3: dinero SIEMPRE en formato español también dentro del BO — espejo
// del formatMoneyEs del servidor (core/utils). "2.383,70 €", nunca "2383.70 EUR".
function fmtMoneyEs(n, currency = 'EUR') {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return safe.toFixed(2) + ' ' + currency;
  }
}
window.fmtMoneyEs = fmtMoneyEs;

// A6.2: toast compartido de TODO el BO (una sola voz para el feedback de acción).
// kind: 'ok' (verde marca) · 'warn' (ámbar) · 'error' (rojo). Sustituye a los
// alert() del navegador. Uno cada vez; aria-live para lectores de pantalla.
function showToast(msg, kind = 'ok') {
  document.getElementById('yaqu-toast')?.remove();
  // Compat: llamadas antiguas showToast(msg, true) = warn
  if (kind === true) kind = 'warn';
  const colors = { ok: 'var(--brand, #16a34a)', warn: '#b45309', error: '#b91c1c' };
  const toast = document.createElement('div');
  toast.id = 'yaqu-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
  toast.style.cssText = `
    position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
    background:${colors[kind] || colors.ok}; color:#fff; max-width:min(92vw,480px);
    padding:10px 20px; border-radius:999px; font-size:14px; font-weight:600;
    z-index:400; box-shadow:0 4px 12px rgba(0,0,0,0.2);
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), kind === 'error' ? 5000 : 3000);
}
window.showToast = showToast;

// Rellena un <tbody> con filas-esqueleto mientras carga una lista. Se sustituyen
// al pintar los datos (tbody.innerHTML = ''). cols = nº de columnas de la tabla.
function uiSkeletonRows(tbody, cols, rows = 6) {
  if (!tbody) return;
  let html = '';
  for (let r = 0; r < rows; r++) {
    let tds = '';
    for (let c = 0; c < cols; c++) {
      const w = 45 + ((r + c) % 4) * 14;   // anchos variados 45–87%
      tds += `<td><span class="skeleton" style="display:block;height:12px;width:${w}%"></span></td>`;
    }
    html += `<tr class="skeleton-row" aria-hidden="true">${tds}</tr>`;
  }
  tbody.innerHTML = html;
}
window.uiSkeletonRows = uiSkeletonRows;

// A20.5 (J5): acciones de FALLBACK cuando un envío de WhatsApp falla — SIEMPRE
// se ofrecen las tres salidas: Copiar enlace · Enviar por email · Reintentar.
// Devuelve el elemento para insertarlo junto al mensaje de error de la vista.
function waFallbackBar({ link, onEmail, onRetry, emailDisabledReason }) {
  const bar = document.createElement('div');
  bar.className = 'wa-fallback-bar';
  bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-secondary btn-sm';
  copyBtn.textContent = '📋 Copiar enlace';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      showToast('✓ Enlace copiado — mándaselo por SMS o desde tu WhatsApp');
    } catch {
      window.prompt('Copia el enlace:', link);
    }
  });
  bar.appendChild(copyBtn);

  const emailBtn = document.createElement('button');
  emailBtn.className = 'btn-secondary btn-sm';
  emailBtn.textContent = '✉️ Enviar por email';
  if (emailDisabledReason) {
    emailBtn.disabled = true;
    emailBtn.title = emailDisabledReason;
    emailBtn.style.opacity = '.55';
  } else if (onEmail) {
    emailBtn.addEventListener('click', async () => {
      emailBtn.disabled = true;
      emailBtn.textContent = 'Enviando…';
      try { await onEmail(); showToast('✓ Enviado por email'); emailBtn.textContent = '✉️ Enviado'; }
      catch (e) {
        showToast('Email falló: ' + (e?.data?.message || e.message), 'error');
        emailBtn.disabled = false; emailBtn.textContent = '✉️ Enviar por email';
      }
    });
  }
  bar.appendChild(emailBtn);

  if (onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-ghost btn-sm';
    retryBtn.textContent = '↻ Reintentar WhatsApp';
    retryBtn.addEventListener('click', () => { bar.remove(); onRetry(); });
    bar.appendChild(retryBtn);
  }
  return bar;
}
window.waFallbackBar = waFallbackBar;

// A6.2: esqueleto para listas de TARJETAS (solicitudes, gastos…): mismas
// proporciones que una fila-card real para que la carga no "salte".
function uiSkeletonCards(container, cards = 4) {
  if (!container) return;
  let html = '';
  for (let i = 0; i < cards; i++) {
    const w = 40 + (i % 3) * 18;
    html += `
      <div class="customers-card" aria-hidden="true" style="display:flex;flex-direction:column;gap:10px">
        <span class="skeleton" style="display:block;height:14px;width:${w}%"></span>
        <span class="skeleton" style="display:block;height:11px;width:${Math.min(w + 32, 92)}%"></span>
      </div>`;
  }
  container.innerHTML = html;
}
window.uiSkeletonCards = uiSkeletonCards;

// WA-0b · chip de entrega de WhatsApp (J4). Recibe `waDelivery` del detalle
// ({status, templateName, at} | null) y devuelve el HTML del chip, o '' si no hay envío.
// Estados de Meta: sent → delivered → read | failed. Microcopy clara para el merchant.
function waDeliveryChip(waDelivery) {
  if (!waDelivery || !waDelivery.status) return '';
  const map = {
    queued:    { cls: 'wa-chip-sent',      glyph: '🕓', label: 'En cola' },
    sent:      { cls: 'wa-chip-sent',      glyph: '✓',  label: 'Enviado' },
    delivered: { cls: 'wa-chip-delivered', glyph: '✓✓', label: 'Entregado' },
    read:      { cls: 'wa-chip-read',      glyph: '✓✓', label: 'Leído' },
    failed:    { cls: 'wa-chip-failed',    glyph: '⚠',  label: 'No entregado' },
  };
  const m = map[waDelivery.status] || map.sent;
  let when = '';
  if (waDelivery.at) {
    const d = new Date(waDelivery.at);
    if (!isNaN(d)) when = ' · ' + d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }
  const title = 'WhatsApp' + (waDelivery.templateName ? ' (' + waDelivery.templateName + ')' : '');
  return `<span class="wa-chip ${m.cls}" title="${title}">`
    + `<span class="wa-chip-glyph">${m.glyph}</span> WhatsApp: ${m.label}${when}</span>`;
}
window.waDeliveryChip = waDeliveryChip;

// -------- Admin – Merchant --------

function getMerchantProfile() {
  // GET /admin/merchant
  return apiRequest("/admin/merchant");
}

function updateMerchantProfile(payload) {
  // PUT /admin/merchant
  return apiRequest("/admin/merchant", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// -------- Admin – Clientes --------

function getCustomers(search = "") {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiRequest(`/admin/customers${query}`);
}

function createCustomer(payload) {
  return apiRequest("/admin/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function updateCustomer(id, payload) {
  return apiRequest(`/admin/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// -------- Presupuestos (Quotes) – creación antigua --------

function createQuote(payload) {
  // POST /quote/create
  return apiRequest("/quote/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function acceptQuote(id, payload) {
  // POST /quote/:id/accept
  return apiRequest(`/quote/${id}/accept`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// -------- Admin – Presupuestos (historial + detalle + decisión) --------

// Lista de presupuestos para el BO
async function getQuotesList(search) {
  const params = new URLSearchParams();
  if (search && search.trim() !== "") {
    params.set("search", search.trim());
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/admin/quotes${query}`);
}

// Detalle completo de un presupuesto
async function getQuoteDetailAdmin(id) {
  return apiRequest(`/admin/quotes/${id}`);
}

// Alias para no romper nada si algún sitio llama a getQuoteDetail
async function getQuoteDetail(id) {
  return getQuoteDetailAdmin(id);
}

// Aceptar desde el BO
async function acceptQuoteAdmin(id, payload = {}) {
  return apiRequest(`/admin/quotes/${id}/accept`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Rechazar desde el BO
async function rejectQuoteAdmin(id, payload = {}) {
  return apiRequest(`/admin/quotes/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Enviar presupuesto por WhatsApp
async function sendQuoteWhatsApp(id) {
  return apiRequest(`/admin/quotes/${id}/send-whatsapp`, { method: "POST" });
}

// -------- Admin – Productos --------

function getProducts(search = "", limit = 20) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("limit", String(limit));
  return apiRequest(`/admin/products?${params.toString()}`);
}
