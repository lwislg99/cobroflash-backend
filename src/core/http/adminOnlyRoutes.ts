// src/core/http/adminOnlyRoutes.ts — A12.4 (EXT3, S1)
// LISTA ÚNICA de rutas admin-only del BO: la tabla S1 del master dice que el
// rol Técnico ("Operario" en UI) NO toca dinero, configuración, equipo ni
// facturas (solo las VE). El test de permisos recorre esta lista con una
// sesión de técnico y exige 403 SIEMPRE. Ruta nueva sensible = añadirla aquí
// (default del master: Admin-only salvo declaración explícita).
//
// method + path con :id de ejemplo (el test sustituye por ids reales suyos).
export const ADMIN_ONLY_ROUTES: ReadonlyArray<{ method: string; path: string; body?: unknown }> = [
  // Facturas: emitir/anular/estado/cobro (S1: Técnico ❌)
  { method: 'PUT', path: '/admin/invoices/:invoiceId/status', body: { status: 'paid' } },
  { method: 'POST', path: '/admin/invoices/:invoiceId/pay' },
  { method: 'POST', path: '/admin/invoices/:invoiceId/unpay' },
  { method: 'POST', path: '/admin/invoices/bulk-paid', body: { ids: [1] } },
  { method: 'POST', path: '/admin/invoices/:invoiceId/rectify' },
  { method: 'POST', path: '/admin/invoices/:invoiceId/resend-whatsapp' },
  { method: 'POST', path: '/admin/invoices/:invoiceId/send-email' },
  { method: 'POST', path: '/admin/invoices/:invoiceId/send-reminder' },
  { method: 'GET', path: '/admin/invoices/:invoiceId/dispute-package' },
  { method: 'POST', path: '/admin/invoices/:invoiceId/payment-anomaly', body: { amount: 1 } },
  // Configuración / cuenta (S1: Técnico ❌)
  { method: 'PUT', path: '/admin/merchant', body: { name: 'X' } },
  { method: 'GET', path: '/admin/merchant/public-profile-qr' },
  { method: 'POST', path: '/admin/onboarding/complete' },
  { method: 'GET', path: '/admin/referral' },
  { method: 'GET', path: '/admin/digest/preview' },
  // Billing / equipo / Connect (montados con requireRole a nivel de router)
  // SCRUM-55: '/admin/billing/summary' vivía aquí y NO existe (subscriptions.routes.ts
  // solo tiene /plans, /accept-alcance, /checkout, /portal). Pasaba el test igualmente:
  // el requireRole del MONTAJE devuelve 403 antes de que Express llegue al 404, así que
  // una entrada muerta era indistinguible de una viva. Ahora la caza el segundo assert
  // de scrum55-admin-fail-closed.test.mjs.
  { method: 'GET', path: '/admin/billing/plans' },
  { method: 'GET', path: '/admin/team' },
  { method: 'POST', path: '/admin/connect/onboard' },
  // Supervisión por operario (SCRUM-24): S1 → equipo/supervisión es Admin
  { method: 'GET', path: '/admin/metrics/operarios' },
  // Mantenimientos (A15): tocar planes = dinero futuro → admin
  { method: 'POST', path: '/admin/maintenance', body: { customerId: 1, title: 'x', intervalMonths: 12 } },
  { method: 'DELETE', path: '/admin/maintenance/:planId' },
  // SCRUM-73: exportar el registro fiscal RRSIF/VeriFactu no es acción de Técnico
  { method: 'GET', path: '/admin/exports/verifactu.xml' },
  // SCRUM-25 (S1): TODO el export es admin — se lleva datos personales de los clientes
  // finales (teléfonos y emails en clientes.csv), importes y documentos del negocio.
  // SCRUM-25 (B): el paquete completo — CSVs + PDFs de factura del merchant
  { method: 'GET', path: '/admin/exports/datos.zip' },
  { method: 'GET', path: '/admin/exports/datos.zip/info' },
  { method: 'GET', path: '/admin/exports/customers.csv' },
  { method: 'GET', path: '/admin/exports/invoices.csv' },
  { method: 'GET', path: '/admin/exports/quotes.csv' },
  { method: 'GET', path: '/admin/exports/expenses.csv' },
  { method: 'GET', path: '/admin/exports/charges.csv' },
  { method: 'GET', path: '/admin/exports/jobs.csv' },

  // ── SCRUM-55 (absorbe SCRUM-54): Nivel 1 — dinero y fiscal ──────────────────
  // Los ids van LITERALES (999999) porque requireRole corta antes de mirar la BD:
  // el 403 no depende de que el recurso exista.
  // Dinero: confirmar un Bizum marca el cobro como pagado (S1: "marcar pagado ❌").
  { method: 'POST', path: '/admin/charges/999999/confirm-bizum' },
  // Emitir factura desde presupuesto (S1: "facturas emitir ❌", D2 del fundador).
  { method: 'POST', path: '/admin/quotes/999999/invoice' },
  // La factura del resto + payment_request. ERA EL OBJETIVO ORIGINAL DE SCRUM-54,
  // que se cerró sobre consolidar-albaranes y dejó esta abierta: aquí su evidencia.
  { method: 'POST', path: '/admin/jobs/999999/collect-rest' },
  // Reescribe el PDF de una factura emitida (regla 29).
  { method: 'POST', path: '/admin/invoices/:invoiceId/regenerate-pdf' },
  // Informes del negocio: /vat es "datos fiscales" ❌ explícito en S1; /pl y /x2 son
  // ingresos, beneficio y cobros. Gate en el MONTAJE de /admin/reports.
  { method: 'GET', path: '/admin/reports/vat' },
  { method: 'GET', path: '/admin/reports/pl' },
  { method: 'GET', path: '/admin/reports/x2' },
  // Borrado DURO del cliente y su historial (D2 del fundador; AA1.4 stop condition).
  { method: 'DELETE', path: '/admin/customers/999999' },

  // ── SCRUM-55: gates que eran INLINE y ahora son requireRole ─────────────────
  // Protegían igual, pero ningún enumerador podía verlos. Con requireRole entran en
  // la red Y quedan cubiertos por el 403 de comportamiento de A12.4.
  { method: 'POST', path: '/admin/referral/redeem' },
  { method: 'POST', path: '/admin/quotes/999999/approve' },
  { method: 'POST', path: '/admin/jobs/999999/consolidar-albaranes' },
];
