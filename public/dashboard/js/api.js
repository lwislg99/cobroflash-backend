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
    let detail = "";
    try {
      const data = await res.json();
      detail = data?.error || JSON.stringify(data);
    } catch {
      // respuesta no JSON
    }
    throw new Error(`API ${res.status}: ${detail || res.statusText}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

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
