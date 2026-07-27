// SCRUM-124 (r29, recon "prohibiciones sin mecanismo" — SIN gate, corre en `npm test`
// normal): ninguna mutación destructiva de facturas — solo el cambio de ESTADO.
//
// De dónde sale: regla 29 del máster — "una factura emitida JAMÁS se edita ni borra: solo
// R1 o anulación con registro". Hoy es cierta por AUSENCIA: nadie ha escrito nunca un
// DELETE ni un PUT/PATCH de contenido sobre /admin/invoices. Eso no es un mecanismo, es que
// nadie lo ha necesitado todavía — el mismo patrón que scrum87/96/124(r28) vienen a cerrar.
// Este test congela esa ausencia: si mañana alguien añade un DELETE, o un PUT que edite
// líneas/total/número en vez de solo el estado, el build se rompe en vez de fiarse de que
// nadie lo intente.
//
// Reutiliza la enumeración de rutas de scrum55 (getAdminMounts + app.router.stack) — no
// hace falta reinventar la reflexión de Express 5, ya está resuelta y probada ahí.
import test from 'node:test';
import assert from 'node:assert/strict';

const { app } = await import('../dist/app.js');
const { getAdminMounts } = await import('../dist/core/http/adminMounts.js');

const INVOICES_PREFIX = '/admin/invoices';

// La ÚNICA mutación permitida: PUT /:id/status (pending/paid/expired, auditada,
// updateInvoiceStatusAdmin no toca líneas/total/número — ver invoiceAdmin.ts). Cualquier
// otro PUT/PATCH, o cualquier DELETE, rompe la regla 29.
const ALLOWED_MUTATIONS = new Set(['PUT /:id/status']);

function enumerateInvoiceRoutes() {
  const found = [];
  for (const mount of getAdminMounts()) {
    if (mount.prefix !== INVOICES_PREFIX) continue;
    for (const layer of mount.router.stack) {
      if (!layer.route) continue; // sub-router anidado: no existe hoy bajo invoices
      const rel = layer.route.path === '/' ? '' : layer.route.path;
      for (const method of Object.keys(layer.route.methods)) {
        found.push(`${method.toUpperCase()} ${rel}`);
      }
    }
  }
  return found;
}

test('SCRUM-124 (r29): ninguna mutación destructiva de facturas — solo /status', () => {
  void app; // fuerza la carga de app.js: mountAdmin solo registra al importar app
  const routes = enumerateInvoiceRoutes();

  // Guarda de presencia (SCRUM-108): si esto no encuentra NADA, el enumerador está ciego —
  // los dos asserts de abajo pasarían en vacío sin haber comprobado nada de verdad.
  assert.ok(
    routes.length > 0,
    'ENUMERADOR CIEGO: no se encontró ninguna ruta bajo /admin/invoices. Antes de fiarte de ' +
      'los asserts de abajo, comprueba que invoicesAdmin.routes.ts sigue montado con ' +
      'mountAdmin(app, \'/admin/invoices\', ...) en app.ts — si cambió de prefijo o de forma ' +
      'de montaje, este test pasa en vacío sin vigilar nada.',
  );

  const deletes = routes.filter((r) => r.startsWith('DELETE '));
  assert.equal(
    deletes.length,
    0,
    `🔴 REGLA 29 ROTA: existe un DELETE sobre facturas: ${deletes.join(', ')}. Una factura ` +
      'emitida JAMÁS se borra — solo R1 (rectificativa) o anulación con registro.',
  );

  const mutations = routes.filter((r) => r.startsWith('PUT ') || r.startsWith('PATCH '));
  const unexpected = mutations.filter((r) => !ALLOWED_MUTATIONS.has(r));
  assert.equal(
    unexpected.length,
    0,
    `🔴 REGLA 29 ROTA: mutación de CONTENIDO nueva sobre facturas: ${unexpected.join(', ')}. ` +
      `Solo se permite ${[...ALLOWED_MUTATIONS].join(', ')} (cambio de ESTADO, auditado). Si ` +
      'de verdad hace falta otra, decide primero si es un cambio de estado (se añade al ' +
      'ALLOWLIST de arriba) o edición de contenido (rompe la regla 29 — habla con el fundador).',
  );
});
