// public/dashboard/js/app.js

async function initApp() {
  // 1. Verificar autenticación
  let me;
  try {
    me = await apiRequest('/admin/me');
  } catch (err) {
    window.location.href = '/login.html';
    return;
  }

  window.appMerchantId = me.merchantId;

  const viewContainer = document.getElementById('view-container');
  const viewTitle     = document.getElementById('view-title');

  if (!window.appState) {
    window.appState = { view: 'home', quoteId: null, invoiceId: null };
  }

  // Inyectar info del merchant en el header
  const headerRight = document.querySelector('.main-header-right');
  if (headerRight) {
    headerRight.innerHTML = `
      <span style="font-size:13px;color:#6b7280;margin-right:12px">${me.name || ''}</span>
      <button id="btn-logout" class="btn btn-secondary" style="font-size:12px;padding:5px 12px">Salir</button>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', logout);
  }

  function setActiveMenu(view) {
    const menuView = view === 'quotes-detail' ? 'quotes-list'
      : view === 'invoice-detail' ? 'invoices'
      : view;

    document.querySelectorAll('.menu-item[data-view]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === menuView);
    });

    document.querySelectorAll('.menu-group').forEach((group) => {
      const subitems = group.querySelectorAll('.menu-subitem[data-view]');
      const shouldOpen = Array.from(subitems).some((btn) => btn.dataset.view === menuView);
      group.classList.toggle('open', shouldOpen);
    });
  }

  function renderView(view, options = {}) {
    const state = window.appState;
    state.view = view;
    if (options.quoteId   !== undefined) state.quoteId   = options.quoteId;
    if (options.invoiceId !== undefined) state.invoiceId = options.invoiceId;

    switch (view) {
      case 'home':
        viewTitle.textContent = 'Inicio';
        renderHomeView(viewContainer);
        break;
      case 'customers':
        viewTitle.textContent = 'Clientes';
        renderCustomersView(viewContainer);
        break;
      case 'quotes-list':
        viewTitle.textContent = 'Presupuestos';
        renderQuotesListView(viewContainer);
        break;
      case 'quotes-new':
        viewTitle.textContent = 'Presupuestos';
        renderQuotesView(viewContainer);
        break;
      case 'quotes-detail':
        viewTitle.textContent = 'Presupuestos';
        if (state.quoteId != null) renderQuoteDetailView(viewContainer, state.quoteId);
        else viewContainer.innerHTML = '<p>No se ha indicado ningún presupuesto.</p>';
        break;
      case 'invoices':
        viewTitle.textContent = 'Facturas';
        renderInvoicesView(viewContainer);
        break;
      case 'products':
        viewTitle.textContent = 'Productos';
        (window.renderProductsView || renderProductsView)(viewContainer);
        break;
      case 'providers':
        viewTitle.textContent = 'Proveedores';
        (window.renderProvidersView || renderProvidersView)(viewContainer);
        break;
      case 'invoice-detail':
        viewTitle.textContent = 'Factura';
        if (state.invoiceId != null && typeof window.renderInvoiceDetailView === 'function')
          window.renderInvoiceDetailView(viewContainer, state.invoiceId);
        else viewContainer.innerHTML = '<p>No se ha indicado ninguna factura.</p>';
        break;
      case 'settings':
        viewTitle.textContent = 'Configuración';
        renderSettingsView(viewContainer);
        break;
      case 'plans':
        viewTitle.textContent = 'Planes';
        renderPlansView(viewContainer);
        break;
      default:
        viewTitle.textContent = 'Inicio';
        renderHomeView(viewContainer);
        view = 'home';
    }
    setActiveMenu(view);
  }

  window.renderAppView = renderView;

  // Click en items del menú
  document.querySelectorAll('.menu-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => renderView(btn.dataset.view));
  });

  // Submenú toggle
  document.querySelectorAll('.menu-group').forEach((group) => {
    const parentBtn = group.querySelector('.menu-item-parent');
    parentBtn?.addEventListener('click', () => {
      const isOpen = group.classList.contains('open');
      document.querySelectorAll('.menu-group').forEach((g) => g.classList.remove('open'));
      if (!isOpen) group.classList.add('open');
    });
  });

  // Hash inicial
  try {
    const hash = (window.location.hash || '').replace('#', '').trim();
    if (hash) window.appState.view = hash;
  } catch (_e) {}

  // Onboarding wizard si es la primera vez
  if (!me.onboardingCompleted) {
    showOnboardingWizard(() => renderView(window.appState.view || 'home'));
  } else {
    renderView(window.appState.view || 'home');
  }
}

async function logout() {
  await fetch('/auth/logout', { method: 'POST' }).catch(() => {});
  window.location.href = '/login.html';
}

document.addEventListener('DOMContentLoaded', initApp);
