// public/dashboard/js/app.js

async function initApp() {
  // 1. Auth check
  let me;
  try { me = await apiRequest('/admin/me'); }
  catch { window.location.href = '/login.html'; return; }

  window.appMerchantId = me.merchantId;
  window.appLocale = me.locale || {
    quote: 'Presupuesto', quotePlural: 'Presupuestos', quoteNew: 'Nuevo presupuesto',
    quoteVerb: 'presupuesto', currency: 'EUR', defaultVat: 0.21, vatName: 'IVA',
  };

  // 2. Inyectar usuario en sidebar
  const initials = (me.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const planLabels = { trial: 'Trial gratuito', basic: 'Plan Básico', pro: 'Plan Pro', empresa: 'Plan Empresa' };

  const sidebarUser = document.getElementById('sidebar-user');
  if (sidebarUser) {
    sidebarUser.innerHTML = `
      <div class="sidebar-user-inner">
        <div class="sidebar-user-avatar">${initials}</div>
        <div>
          <div class="sidebar-user-name">${me.name || 'Mi negocio'}</div>
          <div class="sidebar-user-plan">${planLabels[me.plan] || me.plan}</div>
        </div>
        <button class="sidebar-user-logout" id="btn-logout" title="Cerrar sesión">Salir</button>
      </div>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', logout);
  }

  // 3. Inyectar merchant en topbar
  const topbarRight = document.getElementById('topbar-right');
  if (topbarRight) {
    topbarRight.innerHTML = `
      <div class="topbar-merchant">
        <div class="topbar-merchant-avatar">${initials}</div>
        <span class="topbar-merchant-name">${me.name || 'Mi negocio'}</span>
      </div>
    `;
  }

  // 4. Localizar labels del sidebar
  const navQuotesLabel = document.getElementById('nav-quotes-label');
  if (navQuotesLabel) navQuotesLabel.textContent = window.appLocale.quotePlural;
  const navQuotesNew = document.getElementById('nav-quotes-new');
  if (navQuotesNew) navQuotesNew.textContent = window.appLocale.quoteNew;

  const viewContainer = document.getElementById('view-container');
  const viewTitle     = document.getElementById('view-title');

  if (!window.appState) window.appState = { view: 'home', quoteId: null, invoiceId: null };

  // 5. Hamburger menu (móvil)
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  document.getElementById('btn-hamburger')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.add('open');
    overlay.classList.add('visible');
  });
  overlay.addEventListener('click', closeSidebar);

  function closeSidebar() {
    document.querySelector('.sidebar').classList.remove('open');
    overlay.classList.remove('visible');
  }

  // 6. Menú activo
  function setActiveMenu(view) {
    const menuView = view === 'quotes-detail' ? 'quotes-list'
      : view === 'invoice-detail' ? 'invoices' : view;

    document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === menuView);
    });
    document.querySelectorAll('.nav-group').forEach((group) => {
      const subitems = group.querySelectorAll('.nav-subitem[data-view]');
      const shouldOpen = Array.from(subitems).some((b) => b.dataset.view === menuView);
      group.classList.toggle('open', shouldOpen);
    });
  }

  // 7. Render view
  function renderView(view, options = {}) {
    const state = window.appState;
    state.view = view;
    if (options.quoteId   !== undefined) state.quoteId   = options.quoteId;
    if (options.invoiceId !== undefined) state.invoiceId = options.invoiceId;

    closeSidebar();

    const L = window.appLocale;

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
        viewTitle.textContent = L.quotePlural;
        renderQuotesListView(viewContainer);
        break;
      case 'quotes-new':
        viewTitle.textContent = L.quoteNew;
        renderQuotesView(viewContainer);
        break;
      case 'quotes-detail':
        viewTitle.textContent = L.quotePlural;
        if (state.quoteId != null) renderQuoteDetailView(viewContainer, state.quoteId);
        else viewContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Sin cotización seleccionada</div></div>`;
        break;
      case 'invoices':
        viewTitle.textContent = 'Facturas';
        renderInvoicesView(viewContainer);
        break;
      case 'invoice-detail':
        viewTitle.textContent = 'Factura';
        if (state.invoiceId != null && typeof window.renderInvoiceDetailView === 'function')
          window.renderInvoiceDetailView(viewContainer, state.invoiceId);
        break;
      case 'products':
        viewTitle.textContent = 'Productos';
        (window.renderProductsView || renderProductsView)(viewContainer);
        break;
      case 'providers':
        viewTitle.textContent = 'Proveedores';
        (window.renderProvidersView || renderProvidersView)(viewContainer);
        break;
      case 'expenses':
        viewTitle.textContent = 'Gastos';
        renderExpensesView(viewContainer);
        break;
      case 'plans':
        viewTitle.textContent = 'Planes';
        renderPlansView(viewContainer);
        break;
      case 'settings':
        viewTitle.textContent = 'Configuración';
        renderSettingsView(viewContainer);
        break;
      default:
        viewTitle.textContent = 'Inicio';
        renderHomeView(viewContainer);
        view = 'home';
    }
    setActiveMenu(view);
  }

  window.renderAppView = renderView;

  // Clicks en el sidebar
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => renderView(btn.dataset.view));
  });

  // Submenú toggle
  document.querySelectorAll('.nav-group').forEach((group) => {
    const parentBtn = group.querySelector('.nav-item-parent');
    parentBtn?.addEventListener('click', () => {
      const isOpen = group.classList.contains('open');
      document.querySelectorAll('.nav-group').forEach((g) => g.classList.remove('open'));
      if (!isOpen) group.classList.add('open');
    });
  });

  // Hash inicial
  try {
    const hash = (window.location.hash || '').replace('#', '').trim();
    if (hash) window.appState.view = hash;
  } catch {}

  // 8. Onboarding o render
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
