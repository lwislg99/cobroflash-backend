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
  // SCRUM-296 (A6): el libro de registro es la facturación ENTERA del negocio — lectura de
  // admin, no trabajo de campo. Con una ruta basta: el montaje entero comparte la instancia.
  { method: 'GET', path: '/admin/libro-registro' },
  // SCRUM-325 (E4): el mismo libro de A6, por periodo y en fichero. El CSV lleva el NIF y el
  // nombre de cada cliente del trimestre, así que es lectura de admin igual que su origen.
  { method: 'GET', path: '/admin/libros/expedidas.csv' },
  // SCRUM-295 (A5): el 303 del trimestre — misma razón que el libro.
  { method: 'GET', path: '/admin/modelo-303' },
  // SCRUM-297 (A7): el paquete de evidencias — misma razón que el libro y el 303.
  { method: 'GET', path: '/admin/evidencias.zip' },
  // SCRUM-244 (RGPD-1): la supresión del merchant, lo más destructivo que hay.
  { method: 'POST', path: '/admin/supresion/:merchantId', body: { confirmacion: 'x' } },
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
  // SCRUM-301 (C1) declaró aquí el listado GLOBAL de albaranes, y **SCRUM-467 RE-DECLARA la
  // regla**: el técnico pasa a verlo FILTRADO a sus Trabajos, porque se le precargan los albaranes
  // en el móvil y no tenía ninguna pantalla desde la que abrirlos. `GET /admin/albaranes` se MUEVE
  // a `TECNICO_ALLOWED` con su motivo escrito.
  //
  // ⚠️ EL CONTROL NO SE QUITA, y no hizo falta añadir nada: el montaje YA conserva su muestra de
  // 403 con el `POST /admin/albaranes/consolidar` que ya estaba declarado abajo — admin-only de
  // verdad, porque consolidar partes en una factura es dinero. Borrar esta entrada sin mirar si
  // quedaba otra habría dejado el montaje sin ningún 403 comprobado (invariante de SCRUM-158).
  // SCRUM-55: su hermana /team salía 200 a un Operario en PRODUCCIÓN. Mismo criterio de S1
  // ("equipo ❌ Técnico") y mismo router; estaba aparcada como "Nivel 2" por descuido, no
  // por duda. Aquí queda su 403 exigido.
  { method: 'GET', path: '/admin/metrics/team' },
  // SCRUM-107: las 5 de /admin/expenses que NO son campo. POST y /categories quedan
  // abiertos a propósito (crear el gasto desde la furgoneta) y por eso no están aquí.
  { method: 'GET',    path: '/admin/expenses' },
  { method: 'GET',    path: '/admin/expenses/summary' },
  { method: 'GET',    path: '/admin/expenses/margin/999999' },
  { method: 'PUT',    path: '/admin/expenses/999999', body: { concept: 'x', amount: 1 } },
  { method: 'DELETE', path: '/admin/expenses/999999' },
  // Mantenimientos (A15): tocar planes = dinero futuro → admin
  { method: 'POST', path: '/admin/maintenance', body: { customerId: 1, title: 'x', intervalMonths: 12 } },
  { method: 'DELETE', path: '/admin/maintenance/:planId' },
  // SCRUM-103: export del TARIFARIO. S1 marca exports ❌; los demás ya estaban aquí y
  // esta se quedó fuera, aparcada con una "duda" que citaba S1 como decidido.
  { method: 'GET', path: '/admin/products/export' },
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
  // SCRUM-178: la vía MANUAL emite igual de fiscal que la de tramos, así que su 403 se
  // ejerce igual. No hereda el de arriba: es otra ruta y otro `requireRole`.
  { method: 'POST', path: '/admin/quotes/999999/invoice-manual' },
  // SCRUM-37: reajustar tramos es zona de DINERO (cambia el reparto de lo que se cobrará).
  { method: 'PATCH', path: '/admin/quotes/999999/billing-plan', body: { customBillingPlan: [{ percentage: 1, label: 'X' }] } },
  // SCRUM-170 / SCRUM-171a: las dos vías nuevas de emisión desde albarán. Emiten factura y
  // sellan VeriFactu igual que la de Job, así que su 403 se ejerce igual.
  { method: 'POST', path: '/admin/albaranes/999999/facturar-parcial', body: { lineas: [{ index: 0, cantidad: 1 }] } },
  { method: 'POST', path: '/admin/albaranes/consolidar', body: { customerId: 999999, albaranIds: [999999] } },
  // SCRUM-290 (A0.4): la TERCERA vía de emisión desde albarán — cantidades del parte, precios del
  // presupuesto firmado. Emite factura y sella VeriFactu igual que sus dos hermanas, así que su
  // 403 se ejerce igual. No hereda el de ninguna: es otra ruta y otro `requireRole`.
  { method: 'POST', path: '/admin/albaranes/999999/convertir-en-factura' },
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
