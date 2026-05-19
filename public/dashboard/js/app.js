// public/dashboard/js/app.js

function initApp() {
  const viewContainer = document.getElementById("view-container");
  const viewTitle = document.getElementById("view-title");

  // Estado global sencillo
  if (!window.appState) {
    window.appState = { view: "customers", quoteId: null, invoiceId: null };
  }

  function setActiveMenu(view) {
    // Para la vista de detalle usamos el mismo menú que "Historial"
    const menuView =
      view === "quotes-detail"
        ? "quotes-list"
        : view === "invoice-detail"
        ? "invoices"
        : view;

    document.querySelectorAll(".menu-item[data-view]").forEach((btn) => {
      if (btn.dataset.view === menuView) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Abrir/cerrar grupos según la vista
    document.querySelectorAll(".menu-group").forEach((group) => {
      const subitems = group.querySelectorAll(".menu-subitem[data-view]");
      const shouldOpen = Array.from(subitems).some(
        (btn) => btn.dataset.view === menuView
      );
      if (shouldOpen) {
        group.classList.add("open");
      } else {
        group.classList.remove("open");
      }
    });
  }

  function renderView(view, options = {}) {
    const state = window.appState;
    state.view = view;

    if (typeof options.quoteId !== "undefined") {
      state.quoteId = options.quoteId;
    }
    if (typeof options.invoiceId !== "undefined") {
      state.invoiceId = options.invoiceId;
    }

    switch (view) {
      case "customers":
        viewTitle.textContent = "Clientes";
        renderCustomersView(viewContainer);
        break;

      case "quotes-list":
        viewTitle.textContent = "Presupuestos";
        renderQuotesListView(viewContainer);
        break;

      case "quotes-new":
        viewTitle.textContent = "Presupuestos";
        renderQuotesView(viewContainer);
        break;

      case "quotes-detail":
        viewTitle.textContent = "Presupuestos";
        if (state.quoteId == null) {
          viewContainer.innerHTML =
            "<p>No se ha indicado ningún presupuesto.</p>";
        } else {
          renderQuoteDetailView(viewContainer, state.quoteId);
        }
        break;

      case "invoices":
        viewTitle.textContent = "Facturas";
        renderInvoicesView(viewContainer);
        break;


        case "products":
          viewTitle.textContent = "Productos";
          if (typeof window.renderProductsView === "function") {
            window.renderProductsView(viewContainer);
          } else if (typeof renderProductsView === "function") {
            renderProductsView(viewContainer);
          } else {
            viewContainer.innerHTML = "<p>No se encuentra la vista de productos.</p>";
          }
          break;

          case "providers":
            viewTitle.textContent = "Proveedores";
            if (typeof window.renderProvidersView === "function") {
              window.renderProvidersView(viewContainer);
            } else if (typeof renderProvidersView === "function") {
              renderProvidersView(viewContainer);
            } else {
              viewContainer.innerHTML = "<p>No se encuentra la vista de proveedores.</p>";
            }
            break;
  

      case "invoice-detail":
        viewTitle.textContent = "Factura";
        if (state.invoiceId == null) {
          viewContainer.innerHTML = "<p>No se ha indicado ninguna factura.</p>";
        } else if (typeof window.renderInvoiceDetailView === "function") {
          window.renderInvoiceDetailView(viewContainer, state.invoiceId);
        } else {
          viewContainer.innerHTML =
            "<p>No se encuentra la vista de detalle de factura.</p>";
        }
        break;

      case "settings":
        viewTitle.textContent = "Configuración";
        renderSettingsView(viewContainer);
        break;

      default:
        viewTitle.textContent = "Clientes";
        renderCustomersView(viewContainer);
        view = "customers";
    }

    setActiveMenu(view);
  }

  // Exponemos el render para poder navegar desde otras vistas (detalle)
  window.renderAppView = renderView;

  // Click en items con data-view => cambiar vista
  document.querySelectorAll(".menu-item[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      renderView(view);
    });
  });

  // Comportamiento del submenú: click en el padre => toggle
  document.querySelectorAll(".menu-group").forEach((group) => {
    const parentBtn = group.querySelector(".menu-item-parent");
    parentBtn.addEventListener("click", () => {
      const isOpen = group.classList.contains("open");

      // cerrar todos los grupos
      document.querySelectorAll(".menu-group").forEach((g) =>
        g.classList.remove("open")
      );

      // si estaba cerrado, lo abrimos
      if (!isOpen) {
        group.classList.add("open");
      }
    });
  });

    // Si viene un hash tipo #products, lo usamos como vista inicial
    try {
      const hash = (window.location.hash || "").replace("#", "").trim();
      if (hash) window.appState.view = hash;
    } catch (_e) {}
  
  // Vista inicial
  renderView(window.appState.view || "customers");
}

document.addEventListener("DOMContentLoaded", initApp);
