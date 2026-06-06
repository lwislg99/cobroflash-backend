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
    <div class="state-error">
      <div class="state-error-ico">⚠️</div>
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
