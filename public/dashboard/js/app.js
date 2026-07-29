// public/dashboard/js/app.js

async function initApp() {
  // 1. Auth check
  let me;
  try { me = await apiRequest('/admin/me'); }
  catch { window.location.href = '/login.html'; return; }

  window.appMerchantId = me.merchantId;
  window.appUserRole   = me.userRole || 'admin';
  window.appUserName   = me.name || '';
  window.appVoiceEnabled = me.voiceEnabled === true; // VZ-1: flag VOICE_QUOTE_ENABLED
  window.appVoiceAlbaranEnabled = me.voiceAlbaranEnabled === true; // SCRUM-71: flag PROPIO del albarán

  // A10.2 (Parte L): past_due → banner global "Hay un problema con tu pago"
  // + portal de Stripe. La cuenta sigue funcionando (gracia); solo avisa.
  if (me.subscriptionStatus === 'past_due' && !document.getElementById('pastdue-banner')) {
    const banner = document.createElement('div');
    banner.id = 'pastdue-banner';
    banner.setAttribute('role', 'alert');
    banner.style.cssText = 'background:#fef2f2;border-bottom:1px solid #fecaca;color:#991b1b;padding:10px 16px;display:flex;align-items:center;justify-content:center;gap:12px;font-size:13.5px;font-weight:600;flex-wrap:wrap';
    banner.innerHTML = `
      <span>⚠️ Hay un problema con tu pago — tu cuenta sigue activa, pero revísalo cuanto antes.</span>
      <button id="pastdue-portal" class="btn-sm" style="border:1px solid #fecaca;background:#fff;color:#991b1b;border-radius:999px;padding:6px 14px;font-weight:700;cursor:pointer">Revisar pago</button>`;
    document.body.prepend(banner);
    document.getElementById('pastdue-portal').addEventListener('click', async () => {
      try {
        const r = await apiRequest('/admin/billing/portal', { method: 'POST' });
        if (r.portalUrl) window.location.href = r.portalUrl;
      } catch (e) {
        showToast('No se pudo abrir el portal: ' + e.message, 'error');
      }
    });
  }
  window.appLocale = me.locale || {
    quote: 'Presupuesto', quotePlural: 'Presupuestos', quoteNew: 'Nuevo presupuesto',
    quoteVerb: 'presupuesto', currency: 'EUR', defaultVat: 0.21, vatName: 'IVA',
  };

  // Ocultar elementos de navegación para técnicos
  if (window.appUserRole !== 'admin') {
    // SCRUM-24/136: la gestión y supervisión del equipo es solo del admin (S1). Ocultar el
    // nav es UX; la seguridad real la da el requireRole('admin') de /admin/team (backend, S3).
    ['nav-plans', 'nav-team', 'nav-export'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    // A1.3: Configuración es solo del admin (datos fiscales, IBAN, umbrales)
    const settingsNav = document.querySelector('.nav-item[data-view="settings"]');
    if (settingsNav) settingsNav.style.display = 'none';
    // SCRUM-107: Gastos se oculta porque la PANTALLA no es para el técnico — lista
    // completa, totales del mes y margen son economía del negocio, y sus 403 dejarían
    // la vista medio rota (loadSummary traga el error en un catch vacío). Crear un gasto
    // SÍ es suyo: POST /admin/expenses sigue abierto y el endpoint queda listo para el
    // alta rápida, que no se construye hasta que exista Expense.teamMemberId.
    const expensesNav = document.querySelector('.nav-item[data-view="expenses"]');
    if (expensesNav) expensesNav.style.display = 'none';
  }

  // Badge de solicitudes pendientes
  function updateRequestsBadge() {
    apiRequest('/admin/quote-requests?status=pending').then(function (reqs) {
      const badge = document.getElementById('req-badge');
      if (!badge) return;
      const count = Array.isArray(reqs) ? reqs.length : 0;
      if (count > 0) {
        badge.textContent = String(count);
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }).catch(function () {});
  }
  updateRequestsBadge();
  // Refrescar el badge cada 5 minutos
  setInterval(updateRequestsBadge, 5 * 60 * 1000);

  // 2. Inyectar usuario en sidebar
  const initials = (me.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const planLabels = { trial: 'Trial gratuito', basic: 'Plan Básico', pro: 'Plan Pro', empresa: 'Plan Empresa' };
  const roleLabels = { admin: 'Admin', tecnico: 'Operario' }; // A20.3: etiqueta 'Operario' (fundador); el valor interno no se migra

  const sidebarSubtitle = me.isOwner
    ? (planLabels[me.plan] || me.plan)
    : `${roleLabels[me.userRole] || me.userRole} · ${me.merchantName || 'Mi negocio'}`;

  const sidebarUser = document.getElementById('sidebar-user');
  if (sidebarUser) {
    sidebarUser.innerHTML = `
      <div class="sidebar-user-inner">
        <div class="sidebar-user-avatar">${initials}</div>
        <div>
          <div class="sidebar-user-name">${me.name || 'Mi negocio'}</div>
          <div class="sidebar-user-plan">${sidebarSubtitle}</div>
        </div>
        <button class="sidebar-user-logout" id="btn-logout" title="Cerrar sesión">Salir</button>
      </div>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', logout);
  }

  // 3. Inyectar merchant en topbar
  const topbarRight = document.getElementById('topbar-right');
  if (topbarRight) {
    const roleChip = !me.isOwner
      ? `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;background:var(--neutral-100);color:var(--neutral-500);margin-right:8px">${roleLabels[me.userRole] || me.userRole}</span>`
      : '';
    // Feedback fundador: si el negocio ha subido logo, lo mostramos arriba (marca
    // propia). Con logo + dueño, el logo ya identifica → no repetimos el nombre.
    const merchantLogo = me.logoUrl || null;
    const brandBit = merchantLogo
      ? `<img class="topbar-merchant-logo" src="${merchantLogo}" alt="${me.merchantName || 'Mi negocio'}"/>`
      : `<div class="topbar-merchant-avatar">${initials}</div>`;
    const nameBit = (merchantLogo && me.isOwner)
      ? ''
      : `<span class="topbar-merchant-name">${me.name || 'Mi negocio'}</span>`;
    topbarRight.innerHTML = `
      <div class="topbar-merchant">
        ${roleChip}
        ${brandBit}
        ${nameBit}
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

  if (!window.appState) window.appState = { view: 'home', quoteId: null, invoiceId: null, jobId: null };

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
      : view === 'invoice-detail' ? 'invoices'
      : view === 'jobs-detail' ? 'jobs' : view;

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
    if (options.jobId     !== undefined) state.jobId     = options.jobId;

    closeSidebar();

    const L = window.appLocale;

    // A22.4: transición de vista sobria (≤200ms; el CSS respeta reduced-motion)
    viewContainer.classList.remove('view-enter');
    void viewContainer.offsetWidth; // reinicia la animación
    viewContainer.classList.add('view-enter');

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
        // SCRUM-140: la plantilla viaja como ARGUMENTO, no por sessionStorage. A propósito NO se
        // guarda en `state`: es de un solo uso, y persistirla reintroduciría el estado residual
        // que causaba la plantilla huérfana (SCRUM-134). Las navegaciones a 'quotes-new' que no
        // pasan `template` (nuevo presupuesto, desde cliente, desde solicitud…) abren en blanco
        // porque no mandan nada — antes podían recoger lo que otra vista hubiera dejado escrito.
        renderQuotesView(viewContainer, options.template || null);
        break;
      case 'quotes-detail':
        viewTitle.textContent = L.quotePlural;
        if (state.quoteId != null) renderQuoteDetailView(viewContainer, state.quoteId);
        else viewContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Sin cotización seleccionada</div></div>`;
        break;
      case 'reports':
        viewTitle.textContent = 'Informes';
        if (typeof renderReportsView === 'function') renderReportsView(viewContainer);
        break;
      case 'templates':
        viewTitle.textContent = 'Plantillas';
        if (typeof renderTemplatesView === 'function') renderTemplatesView(viewContainer);
        break;
      case 'quote-requests':
        viewTitle.textContent = 'Solicitudes';
        if (typeof renderQuoteRequestsView === 'function') renderQuoteRequestsView(viewContainer);
        break;
      case 'jobs':
        viewTitle.textContent = 'Trabajos';
        if (typeof renderJobsView === 'function') renderJobsView(viewContainer);
        break;
      case 'jobs-detail':
        viewTitle.textContent = 'Trabajo';
        if (state.jobId != null && typeof renderJobDetailView === 'function') renderJobDetailView(viewContainer, state.jobId);
        else viewContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔧</div><div class="empty-state-title">Sin trabajo seleccionado</div></div>`;
        break;
      case 'customer-360':
        viewTitle.textContent = 'Cliente';
        if (typeof renderCustomer360View === 'function') renderCustomer360View(viewContainer, state.customerId360);
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
      // SCRUM-138: mismo guard que 'settings'/'team' — el export se lleva TODO el negocio,
      // datos de cliente incluidos (S4/RGPD), así que un técnico no entra ni tecleando la
      // vista. La seguridad real la da el requireRole('admin') del router /admin/exports.
      case 'export':
        if (window.appUserRole !== 'admin') {
          viewTitle.textContent = 'Inicio';
          renderHomeView(viewContainer);
          view = 'home';
        } else {
          viewTitle.textContent = 'Descargar datos';
          renderExportView(viewContainer);
        }
        break;
      case 'plans':
        viewTitle.textContent = 'Planes';
        renderPlansView(viewContainer);
        break;
      case 'team':
        if (window.appUserRole !== 'admin') {
          viewTitle.textContent = 'Inicio';
          renderHomeView(viewContainer);
          view = 'home';
        } else {
          viewTitle.textContent = 'Equipo';
          renderTeamView(viewContainer);
        }
        break;
      // SCRUM-136: 'operarios' se fusiona en 'team' (un operario es un ROL del miembro, no
      // un apartado). Se mantiene el case como REDIRECCIÓN, no se borra: hay enlaces y
      // marcadores vivos apuntando ahí, y el guard de rol de 'team' es el mismo, así que
      // caer en Equipo es exactamente lo que el usuario venía buscando.
      case 'operarios':
        return renderView('team', options);
      case 'settings':
        // A1.3: guard como en 'team' — un técnico no entra ni tecleando la vista
        if (window.appUserRole !== 'admin') {
          viewTitle.textContent = 'Inicio';
          renderHomeView(viewContainer);
          view = 'home';
        } else {
          viewTitle.textContent = 'Configuración';
          renderSettingsView(viewContainer);
        }
        break;
      default:
        viewTitle.textContent = 'Inicio';
        renderHomeView(viewContainer);
        view = 'home';
    }
    // A22.4: título de pestaña por vista
    document.title = (viewTitle.textContent ? viewTitle.textContent + ' · ' : '') + 'YaQu';
    setActiveMenu(view);
    if (typeof maybeShowSectionTip === 'function') maybeShowSectionTip(view);
  }

  window.renderAppView = renderView;

  // Deep-links por hash: /dashboard/#products abre Productos directamente.
  // Útil para compartir/QA (y para las capturas de la maqueta A4.7).
  const HASH_VIEWS = ['home','quotes-list','quotes-new','customers','products','providers',
    'invoices','expenses','export','reports','templates','quote-requests','jobs','plans','team','settings'];
  function viewFromHash() {
    const h = (window.location.hash || '').replace('#', '');
    return HASH_VIEWS.includes(h) ? h : null;
  }
  const _origRender = renderView;
  window.renderAppView = function (view, opts) {
    try { history.replaceState(null, '', '#' + view); } catch (_e) {}
    return _origRender(view, opts);
  };
  window.addEventListener('hashchange', () => {
    const v = viewFromHash();
    if (v) _origRender(v);
  });

  // Botón flotante de ayuda (guía de inicio)
  if (typeof ensureHelpButton === 'function') ensureHelpButton();

  // Badges del sidebar (contadores) independientes de la vista actual
  if (typeof refreshSidebarBadges === 'function') refreshSidebarBadges();

  // Atajo de teclado: "n" abre una nueva cotización rápida (usuarios avanzados)
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (typing) return;
    if (document.querySelector('.modal-overlay, .modal-backdrop, #qq-modal-backdrop, #onboarding-backdrop')) return;
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      if (typeof openQuickQuoteModal === 'function') openQuickQuoteModal();
    }
  });

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

// ── SCRUM-45 (C) · Aviso de versión nueva ─────────────────────────────────
// Una pestaña abierta durante un deploy se queda con el JS viejo en memoria;
// ni el SW network-first ni la revalidación HTTP la arreglan. Poll suave a
// GET /version (BUILD_ID por deploy) + toast persistente con botón Recargar.
// No se fuerza la recarga: se respeta lo que el usuario esté haciendo.
const VERSION_POLL_MS = 90_000;
// SCRUM-224: mientras NO haya línea base, se reintenta rápido. Ver `checkAppVersion`.
const VERSION_BASELINE_RETRY_MS = 5_000;
let appBuildId = null;
let versionToastShown = false;

async function checkAppVersion() {
  if (versionToastShown) return;
  let v;
  try {
    const r = await fetch('/version', { cache: 'no-store' });
    if (!r.ok) return;
    v = (await r.json()).version;
  } catch { return; } // sin red / deploy en curso: se reintenta en el siguiente poll
  if (!v) return;
  // SCRUM-224 · LA LÍNEA BASE ES LA TRAMPA, y salta justo cuando más duele.
  //
  // Esta primera lectura fija «la versión con la que arrancó esta página». Si FALLA —y el
  // momento más probable de que falle es un deploy en vuelo, o sea EXACTAMENTE cuando sale un
  // hotfix— `appBuildId` sigue a null y la línea base la fija la SIGUIENTE lectura buena, que
  // ya trae el BUILD_ID NUEVO. A partir de ahí `v === appBuildId` para siempre: el aviso no
  // sale nunca y el usuario se queda con el JS viejo sin que nada se lo diga.
  //
  // No se puede cerrar del todo desde aquí: la página no sabe con qué build la sirvieron (el
  // HTML es estático, no lleva el BUILD_ID dentro). Lo que sí se hace es ESTRECHAR la ventana
  // — mientras no haya línea base se reintenta cada 5 s en vez de cada 90 (ver
  // `startVersionWatch`), así que el hueco pasa de minuto y medio a segundos.
  // El cierre completo es sellar el BUILD_ID en el HTML servido; queda propuesto, no hecho.
  if (appBuildId === null) { appBuildId = v; return; } // primera lectura = versión de arranque
  if (v === appBuildId) return;

  versionToastShown = true;
  document.getElementById('yaqu-version-toast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'yaqu-version-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  // Mismo lenguaje visual que el toast de api.js, pero persistente y con acción
  toast.style.cssText = `
    position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
    background:var(--ink, #0f1c17); color:#fff; max-width:min(92vw,480px);
    padding:10px 12px 10px 20px; border-radius:999px; font-size:14px; font-weight:600;
    z-index:400; box-shadow:0 4px 12px rgba(0,0,0,0.2);
    display:flex; align-items:center; gap:12px;
  `;
  const txt = document.createElement('span');
  txt.textContent = 'Hay una versión nueva de YaQu. Recarga para actualizar.';
  const btn = document.createElement('button');
  btn.textContent = 'Recargar';
  btn.style.cssText = `
    border:0; background:var(--brand, #16a34a); color:#fff; border-radius:999px;
    padding:8px 16px; font-size:14px; font-weight:700; cursor:pointer; flex-shrink:0;
  `;
  btn.addEventListener('click', () => window.location.reload());
  toast.append(txt, btn);
  document.body.appendChild(toast);
}

function startVersionWatch() {
  checkAppVersion(); // fija appBuildId al arrancar
  setInterval(checkAppVersion, VERSION_POLL_MS);
  // SCRUM-224: cadencia rápida SOLO hasta tener línea base. Si la primera lectura falló (deploy
  // en vuelo), reintentar a los 90 s deja al usuario minuto y medio sin red de aviso, y encima
  // fijando como base una versión que NO es la suya. El intervalo se apaga solo al conseguirla.
  const baseline = setInterval(() => {
    if (appBuildId !== null || versionToastShown) { clearInterval(baseline); return; }
    checkAppVersion();
  }, VERSION_BASELINE_RETRY_MS);
  // Al volver a la pestaña (el caso típico: la dejó abierta y hubo deploy)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkAppVersion();
  });
}

document.addEventListener('DOMContentLoaded', () => { initApp(); startVersionWatch(); });
