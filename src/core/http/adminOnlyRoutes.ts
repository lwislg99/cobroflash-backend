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
  { method: 'GET', path: '/admin/billing/summary' },
  { method: 'GET', path: '/admin/team' },
  { method: 'POST', path: '/admin/connect/onboard' },
  // Supervisión por operario (SCRUM-24): S1 → equipo/supervisión es Admin
  { method: 'GET', path: '/admin/metrics/operarios' },
  // Mantenimientos (A15): tocar planes = dinero futuro → admin
  { method: 'POST', path: '/admin/maintenance', body: { customerId: 1, title: 'x', intervalMonths: 12 } },
  { method: 'DELETE', path: '/admin/maintenance/:planId' },
];
