// public/dashboard/js/nuevaFacturaModal.js — SCRUM-289 (A0.3) · la factura suelta.
//
// FICHERO NUEVO a propósito: la pantalla de Facturas es de otro carril y este incremento no la
// rediseña (regla 4). De `invoicesView.js` solo se tocan las líneas que montan el botón.
//
// ⚠️ ÁMBITO GLOBAL COMPARTIDO, SIN IIFE: estos scripts son clásicos y comparten `window`. Un
// `const` que choque con otra global es SyntaxError EN PARSEO y tumba el fichero ENTERO — le pasó
// a `invoicesView.js` con `copyRojo`. Por eso todo aquí lleva el prefijo `nf`.
//
// 🔴 MICROCOPY: TODO literal visible es EXACTAMENTE `[PENDIENTE microcopy oficial]`, regla 30, con
// su guard en la suite. No se escriben provisionales que parezcan definitivos: un texto que «suena
// bien» se queda, y nadie vuelve a mirarlo. Mismo mecanismo que SCRUM-244 en `exportView.js`.
//
// SEGUNDO SELECTOR DE CLIENTE — DEUDA DECLARADA. A partir de aquí el dashboard tiene DOS: el de
// presupuestos (`fieldCustomer`, quotesView.js:338, dentro del cierre de la vista, no exportado,
// sin consumidores fuera de su fichero) y éste. NO se unifica aquí: extraer el de presupuestos
// obligaría a tocar carril A y otra pantalla, que es justo lo que este incremento no hace. Se
// resuelve en SCRUM-286 (B3), que es el ticket de formularios. Queda escrito para que quien
// arregle uno sepa que existe el otro.
const NF_PENDIENTE = '[PENDIENTE microcopy oficial]';

function nfEsc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Abre la hoja de «nueva factura». `onCreated(factura)` se llama tras un 201. */
function openNuevaFacturaModal(onCreated) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', NF_PENDIENTE);

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.maxWidth = '560px';
  overlay.appendChild(modal);

  const header = document.createElement('div');
  header.className = 'modal-header';
  const titulo = document.createElement('div');
  titulo.className = 'modal-title';
  titulo.textContent = NF_PENDIENTE;
  const cerrarX = document.createElement('button');
  cerrarX.className = 'modal-close';
  cerrarX.type = 'button';
  cerrarX.textContent = '×';
  cerrarX.setAttribute('aria-label', NF_PENDIENTE);
  header.append(titulo, cerrarX);
  modal.appendChild(header);

  const err = document.createElement('div');
  err.className = 'alert error';
  err.style.cssText = 'display:none;margin:12px 24px 0';
  modal.appendChild(err);

  const body = document.createElement('div');
  body.className = 'modal-body';
  modal.appendChild(body);

  // ── Cliente ────────────────────────────────────────────────────────────────────────────
  // Se reutiliza el endpoint que YA existe (`GET /admin/customers?search=`), que resuelve por
  // `req.merchantId`: la tenencia (regla 2) la garantiza el servidor, no este `select`.
  const labCliente = document.createElement('label');
  labCliente.className = 'field-label';
  labCliente.textContent = NF_PENDIENTE;
  body.appendChild(labCliente);

  const buscador = document.createElement('input');
  buscador.className = 'input';
  buscador.type = 'search';
  buscador.placeholder = NF_PENDIENTE;
  buscador.setAttribute('aria-label', NF_PENDIENTE);
  buscador.style.cssText = 'width:100%;min-height:44px';
  body.appendChild(buscador);

  const selCliente = document.createElement('select');
  selCliente.className = 'input';
  selCliente.style.cssText = 'width:100%;margin-top:6px;min-height:44px';
  selCliente.setAttribute('aria-label', NF_PENDIENTE);
  body.appendChild(selCliente);

  let nfTimer = null;
  async function cargarClientes(q) {
    try {
      const url = '/admin/customers' + (q ? '?search=' + encodeURIComponent(q) : '');
      const lista = await apiRequest(url);
      const previo = selCliente.value;
      selCliente.innerHTML = '';
      const vacio = document.createElement('option');
      vacio.value = '';
      vacio.textContent = NF_PENDIENTE;
      selCliente.appendChild(vacio);
      for (const c of Array.isArray(lista) ? lista : []) {
        const o = document.createElement('option');
        o.value = String(c.id);
        // El NOMBRE del cliente es dato del merchant, no microcopy: se pinta tal cual.
        o.textContent = c.name || String(c.id);
        selCliente.appendChild(o);
      }
      if (previo) selCliente.value = previo;
    } catch {
      err.textContent = NF_PENDIENTE;
      err.style.display = 'block';
    }
  }
  buscador.addEventListener('input', () => {
    clearTimeout(nfTimer);
    nfTimer = setTimeout(() => cargarClientes(buscador.value.trim()), 250);
  });
  cargarClientes('');

  // ── Líneas ─────────────────────────────────────────────────────────────────────────────
  const labLineas = document.createElement('label');
  labLineas.className = 'field-label';
  labLineas.textContent = NF_PENDIENTE;
  labLineas.style.marginTop = '14px';
  body.appendChild(labLineas);

  const filas = document.createElement('div');
  body.appendChild(filas);

  function nuevaFila() {
    const r = document.createElement('div');
    r.className = 'nf-linea';
    r.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center;flex-wrap:wrap';
    const concepto = document.createElement('input');
    concepto.className = 'input nf-concepto';
    concepto.placeholder = NF_PENDIENTE;
    concepto.setAttribute('aria-label', NF_PENDIENTE);
    concepto.style.cssText = 'flex:3;min-width:0';
    const cantidad = document.createElement('input');
    cantidad.className = 'input nf-cantidad';
    cantidad.type = 'number'; cantidad.min = '0'; cantidad.step = 'any'; cantidad.value = '1';
    cantidad.placeholder = NF_PENDIENTE;
    cantidad.setAttribute('aria-label', NF_PENDIENTE);
    cantidad.style.cssText = 'flex:1;min-width:64px';
    const precio = document.createElement('input');
    precio.className = 'input nf-precio';
    precio.type = 'number'; precio.min = '0'; precio.step = 'any';
    precio.placeholder = NF_PENDIENTE;
    precio.setAttribute('aria-label', NF_PENDIENTE);
    precio.style.cssText = 'flex:1;min-width:80px';
    const iva = document.createElement('input');
    iva.className = 'input nf-iva';
    iva.type = 'number'; iva.min = '0'; iva.max = '100'; iva.step = 'any'; iva.value = '21';
    iva.placeholder = NF_PENDIENTE;
    iva.setAttribute('aria-label', NF_PENDIENTE);
    iva.style.cssText = 'flex:1;min-width:64px';
    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.className = 'btn-ghost btn-sm';
    quitar.textContent = '✕';
    quitar.setAttribute('aria-label', NF_PENDIENTE);
    quitar.addEventListener('click', () => { if (filas.children.length > 1) r.remove(); });
    r.append(concepto, cantidad, precio, iva, quitar);
    return r;
  }
  filas.appendChild(nuevaFila());

  const anadir = document.createElement('button');
  anadir.type = 'button';
  anadir.className = 'btn-ghost btn-sm';
  anadir.textContent = NF_PENDIENTE;
  anadir.addEventListener('click', () => filas.appendChild(nuevaFila()));
  body.appendChild(anadir);

  // ── Pie ────────────────────────────────────────────────────────────────────────────────
  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  const cancelar = document.createElement('button');
  cancelar.type = 'button';
  cancelar.className = 'btn-secondary';
  cancelar.textContent = NF_PENDIENTE;
  const emitir = document.createElement('button');
  emitir.type = 'button';
  emitir.className = 'btn-primary';
  emitir.textContent = NF_PENDIENTE;
  footer.append(cancelar, emitir);
  modal.appendChild(footer);

  const cerrar = () => { overlay.remove(); document.removeEventListener('keydown', alPulsar); };
  const alPulsar = (e) => { if (e.key === 'Escape') cerrar(); };
  cerrarX.addEventListener('click', cerrar);
  cancelar.addEventListener('click', cerrar);
  document.addEventListener('keydown', alPulsar);
  // NO se cierra al pulsar el fondo: perder las líneas tecleadas por un toque de más es peor
  // que exigir el botón (mismo criterio que el editor de albarán, SCRUM-31 F2).

  emitir.addEventListener('click', async () => {
    err.style.display = 'none';
    const lines = [];
    for (const r of filas.children) {
      const concept = r.querySelector('.nf-concepto').value.trim();
      const qty = Number(r.querySelector('.nf-cantidad').value);
      const price = Number(r.querySelector('.nf-precio').value);
      const ivaPct = Number(r.querySelector('.nf-iva').value);
      if (!concept && !r.querySelector('.nf-precio').value) continue; // fila vacía se ignora
      // El servidor espera el IVA en FRACCIÓN (0.21). La pantalla lo pide en porcentaje porque
      // es como lo dice un profesional; la conversión vive aquí, en un solo sitio.
      lines.push({ concept, qty, price, tax: ivaPct / 100 });
    }
    const cuerpo = { customerId: Number(selCliente.value), lines };

    emitir.disabled = true;
    const antes = emitir.textContent;
    emitir.textContent = NF_PENDIENTE;
    try {
      const r = await apiRequest('/admin/invoices', { method: 'POST', body: JSON.stringify(cuerpo) });
      cerrar();
      showToast(NF_PENDIENTE);
      if (typeof onCreated === 'function') onCreated(r && r.factura);
    } catch (e) {
      // El servidor manda `message` legible en cada error nombrado; se muestra tal cual porque
      // es SUYO, no microcopy de esta pantalla.
      err.textContent = (e && e.data && e.data.message) ? e.data.message : NF_PENDIENTE;
      err.style.display = 'block';
      emitir.disabled = false;
      emitir.textContent = antes;
    }
  });

  document.body.appendChild(overlay);
  buscador.focus();
}

window.openNuevaFacturaModal = openNuevaFacturaModal;
