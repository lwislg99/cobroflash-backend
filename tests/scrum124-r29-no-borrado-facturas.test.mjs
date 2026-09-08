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

// Las mutaciones permitidas. Ninguna toca el DOCUMENTO —ni líneas, ni total, ni número, ni
// sello, ni PDF—; todas escriben datos DE LA FICHA que se conocen después de emitir.
//
//   · `PUT /:id/status` — pending/paid/expired, auditada. `updateInvoiceStatusAdmin` no toca
//     líneas/total/número (ver `invoiceAdmin.ts`).
//
//   · `PUT /:id/tags` — 🔴 SCRUM-595 (DOC-05), 7-sep-2026. **ES EL PRIMER MIEMBRO QUE NO ES UN
//     CAMBIO DE ESTADO, y por eso se declara despacio.** Este guard ofrece dos casillas —cambio
//     de estado o edición de contenido— y una etiqueta no es ninguna: es cómo el profesional
//     ORDENA sus facturas en su propio panel. Que no sea contenido está MEDIDO, no argumentado,
//     y las tres medidas viven en `tests/scrum595-etiquetas-del-documento.test.mjs`:
//
//         la huella de VeriFactu es una lista CERRADA de ocho campos y sale IDÉNTICA con `tags`
//         los parámetros de `generateInvoicePdf` son lista blanca y `tags` no está en ella
//         `emitInvoice` no la nombra: una etiqueta NO se copia al emitir
//
//     Y para que esta entrada no pueda crecer hacia la edición de contenido, ese mismo fichero
//     exige que `setInvoiceTags` escriba **un solo campo**. Esta lista se ensancha en una ruta;
//     lo que esa ruta puede escribir queda MÁS apretado que antes, no menos.
//
// Cualquier otro PUT/PATCH, o cualquier DELETE, rompe la regla 29.
const ALLOWED_MUTATIONS = new Set(['PUT /:id/status', 'PUT /:id/tags']);

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-597 (DOC-07) · UNA TERCERA CATEGORÍA QUE ESTE GUARD NO CONTEMPLABA
//
// El guard reparte toda mutación bajo `/admin/invoices` en dos: cambio de ESTADO (permitido) o
// edición de CONTENIDO (rompe la regla 29). `PATCH /:id/asignados` no es ninguna de las dos:
// **no escribe en `invoices`**. Escribe filas en `invoice_assignees`, la tabla puente de quién
// lleva el documento, y el número, el total y el PDF viven en `invoices`, que no toca.
//
// ⚠️ ESTO ES UNA AMPLIACIÓN DE LO QUE EL GUARD EXIGE, Y SE DECLARA COMO TAL — no se ha colado en
// `ALLOWED_MUTATIONS` disfrazada de cambio de estado, que es lo que la habría hecho invisible.
// Va en su propia lista, con su motivo, para que se lea qué se ha permitido y por qué.
//
// 🔴 Y NO ES UN CHEQUE EN BLANCO: la afirmación «no toca `invoices`» está EJERCITADA, no
// razonada. `tests/scrum597-asignar-usuario-al-documento.test.mjs` levanta la app real, asigna
// una factura emitida y comprueba sobre el registro de escrituras que el ÚNICO modelo escrito es
// `invoiceAssignee` — con su control positivo de que el instrumento sí anota. Si esa ruta
// empezara a escribir la factura, ese test cae aunque esta entrada siga aquí.
//
// La alternativa era montar la ruta bajo otro prefijo para que este guard no la viera. Sería
// esquivarlo, que es peor que ampliarlo a la vista de todos.
const MUTACIONES_QUE_NO_TOCAN_LA_FACTURA = new Set(['PATCH /:id/asignados']);

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
  const unexpected = mutations.filter((r) => !ALLOWED_MUTATIONS.has(r) && !MUTACIONES_QUE_NO_TOCAN_LA_FACTURA.has(r));
  assert.equal(
    unexpected.length,
    0,
    `🔴 REGLA 29 ROTA: mutación de CONTENIDO nueva sobre facturas: ${unexpected.join(', ')}. ` +
      `Solo se permite ${[...ALLOWED_MUTATIONS].join(', ')} (cambio de ESTADO, auditado). Si ` +
      'de verdad hace falta otra, decide primero si es un cambio de estado (se añade al ' +
      'ALLOWLIST de arriba) o edición de contenido (rompe la regla 29 — habla con el fundador).',
  );
});
