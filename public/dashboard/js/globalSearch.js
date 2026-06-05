// public/dashboard/js/globalSearch.js
// Búsqueda global: clientes, presupuestos y facturas en tiempo real.

(function () {
  const STATUS_LABELS = {
    draft: 'Borrador', sent: 'Enviado', accepted: 'Aceptado', rejected: 'Rechazado',
    pending: 'Pendiente', paid: 'Pagada', expired: 'Caducada',
  };
  const STATUS_COLORS = {
    accepted: '#166534', paid: '#166534', sent: '#1d4ed8',
    pending: '#92400e', rejected: '#991b1b', expired: '#6b756f', draft: '#6b756f',
  };
  const STATUS_BG = {
    accepted: '#dcfce7', paid: '#dcfce7', sent: '#dbeafe',
    pending: '#fef3c7', rejected: '#fee2e2', expired: '#f1f2ee', draft: '#f1f2ee',
  };

  function pill(status) {
    const bg = STATUS_BG[status] || '#f1f2ee';
    const color = STATUS_COLORS[status] || '#333c37';
    const label = STATUS_LABELS[status] || status;
    return `<span style="display:inline-block;padding:1px 7px;border-radius:999px;font-size:10.5px;font-weight:700;background:${bg};color:${color};text-transform:uppercase;letter-spacing:.02em">${label}</span>`;
  }

  function fmt(n) {
    return Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlight(text, q) {
    if (!q || !text) return esc(text);
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return esc(text).replace(re, '<mark style="background:#fef9c3;border-radius:2px;padding:0 1px">$1</mark>');
  }

  let debounceTimer;
  let currentFocusIdx = -1;
  let allItems = [];

  document.addEventListener('DOMContentLoaded', function () {
    const input    = document.getElementById('global-search-input');
    const dropdown = document.getElementById('global-search-dropdown');
    if (!input || !dropdown) return;

    // Atajo `/` para abrir la búsqueda desde cualquier pantalla
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== input
          && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });

    // Foco: mostrar borde verde
    input.addEventListener('focus', function () {
      input.style.borderColor = 'var(--green-500)';
      input.style.background = '#fff';
      input.style.boxShadow = '0 0 0 3px rgba(34,197,94,.12)';
    });

    // Blur
    input.addEventListener('blur', function () {
      input.style.borderColor = 'var(--slate-200)';
      input.style.background = 'var(--slate-50)';
      input.style.boxShadow = '';
    });

    // Cerrar al hacer click fuera
    document.addEventListener('mousedown', function (e) {
      const wrap = document.getElementById('global-search-wrap');
      if (wrap && !wrap.contains(e.target)) closeDropdown();
    });

    // Navegación con teclado
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeDropdown(); input.blur(); return; }

      const items = dropdown.querySelectorAll('[data-idx]');
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentFocusIdx = (currentFocusIdx + 1) % items.length;
        updateFocus(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentFocusIdx = (currentFocusIdx - 1 + items.length) % items.length;
        updateFocus(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const focused = dropdown.querySelector('[data-idx].focused');
        if (focused) focused.click();
      }
    });

    function updateFocus(items) {
      items.forEach((el, i) => {
        if (i === currentFocusIdx) {
          el.classList.add('focused');
          el.style.background = 'var(--slate-50)';
          el.scrollIntoView({ block: 'nearest' });
        } else {
          el.classList.remove('focused');
          el.style.background = '';
        }
      });
    }

    function closeDropdown() {
      dropdown.style.display = 'none';
      currentFocusIdx = -1;
      allItems = [];
    }

    // Búsqueda con debounce
    input.addEventListener('input', function () {
      const q = input.value.trim();
      clearTimeout(debounceTimer);

      if (q.length < 2) { closeDropdown(); return; }

      debounceTimer = setTimeout(async () => {
        let data;
        try {
          data = await apiRequest(`/admin/search?q=${encodeURIComponent(q)}`);
        } catch { return; }

        renderDropdown(data, q);
      }, 220);
    });

    function renderDropdown(data, q) {
      const { customers = [], quotes = [], invoices = [] } = data;
      const total = customers.length + quotes.length + invoices.length;

      if (total === 0) {
        dropdown.innerHTML = `<div style="padding:20px;text-align:center;color:var(--slate-400);font-size:13.5px">Sin resultados para "<strong>${esc(q)}</strong>"</div>`;
        dropdown.style.display = 'block';
        allItems = [];
        return;
      }

      const L = window.appLocale || {};
      let html = '';
      let idx = 0;
      allItems = [];

      function section(title, items, renderFn) {
        if (!items.length) return '';
        let s = `<div style="padding:8px 12px 4px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--slate-400)">${title}</div>`;
        items.forEach(item => {
          const { h, action } = renderFn(item, q);
          allItems.push(action);
          s += `<div data-idx="${idx++}" style="padding:9px 14px;cursor:pointer;transition:background .08s;border-radius:4px;margin:0 4px"
                     onmouseenter="this.style.background='var(--slate-50)'"
                     onmouseleave="this.style.background=''"
                     class="gs-item">${h}</div>`;
        });
        return s;
      }

      html += section('Clientes', customers, (c, q) => ({
        h: `<div style="display:flex;align-items:center;gap:10px">
              <span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--green-500),#22d3ee);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;color:var(--green-900);flex-shrink:0">${esc((c.name||'?').slice(0,2).toUpperCase())}</span>
              <div>
                <div style="font-size:13.5px;font-weight:600;color:var(--slate-900)">${highlight(c.name, q)}</div>
                <div style="font-size:12px;color:var(--slate-400)">${c.phone ? highlight(c.phone, q) + ' · ' : ''}${c.email ? highlight(c.email, q) : ''}</div>
              </div>
            </div>`,
        action: { type: 'customer', id: c.id },
      }));

      html += section(L.quotePlural || 'Presupuestos', quotes, (q2, q) => ({
        h: `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <div>
                <span style="font-size:13.5px;font-weight:600;color:var(--slate-900)">#${q2.id}</span>
                <span style="font-size:12.5px;color:var(--slate-500);margin-left:6px">${highlight(q2.customer?.name, q)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                <span style="font-size:12.5px;font-weight:600">${fmt(Number(q2.total))} ${esc(q2.currency)}</span>
                ${pill(q2.status)}
              </div>
            </div>`,
        action: { type: 'quote', id: q2.id },
      }));

      html += section('Facturas', invoices, (inv, q) => ({
        h: `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <div>
                <span style="font-size:13.5px;font-weight:600;color:var(--slate-900)">${highlight(inv.number, q)}</span>
                <span style="font-size:12.5px;color:var(--slate-500);margin-left:6px">${highlight(inv.customer?.name, q)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                <span style="font-size:12.5px;font-weight:600">${fmt(Number(inv.total))} ${esc(inv.currency)}</span>
                ${pill(inv.status)}
              </div>
            </div>`,
        action: { type: 'invoice', id: inv.id },
      }));

      html += `<div style="padding:8px 14px;border-top:1px solid var(--slate-100);font-size:11.5px;color:var(--slate-400);text-align:center">
                 ↑↓ para navegar · Enter para abrir · Esc para cerrar
               </div>`;

      dropdown.innerHTML = html;
      dropdown.style.display = 'block';
      currentFocusIdx = -1;

      // Click handlers
      dropdown.querySelectorAll('[data-idx]').forEach((el) => {
        el.addEventListener('click', function () {
          const i = Number(this.dataset.idx);
          const action = allItems[i];
          if (!action) return;

          closeDropdown();
          input.value = '';
          navigate(action);
        });
      });
    }

    function navigate(action) {
      if (!window.renderAppView) return;
      if (action.type === 'customer') {
        window.appState = window.appState || {};
        window.appState.customerId360 = action.id;
        renderAppView('customer-360');
      } else if (action.type === 'quote') {
        window.appState = window.appState || {};
        window.appState.quoteId = action.id;
        renderAppView('quotes-detail');
      } else if (action.type === 'invoice') {
        window.appState = window.appState || {};
        window.appState.invoiceId = action.id;
        renderAppView('invoice-detail');
      }
    }
  });
})();
