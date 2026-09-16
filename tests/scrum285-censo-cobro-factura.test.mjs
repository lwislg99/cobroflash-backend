// SCRUM-285 (B4) · CENSO de las acciones que TOCAN EL COBRO desde la vista de factura.
//
// La pregunta es DISTINTA a la del 283 («¿está en la vista?»): aquí es «¿toca el cobro?», y se deriva
// del ENDPOINT que llama el handler de cada acción, NO del registro. La medición decide, no la
// intuición — como los bordes: btnReminder aparece solo en pending (impagada) → toca cobro;
// btnWhatsApp aparece en pending+paid → no.
//
// NO se separa nada (eso es la construcción de B4, y necesita B1). Esto ENUMERA y GUARDA: si una
// acción de cobro se pierde al separar, es el fallo mudo que el guard existe para cazar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarCobroFactura, FUNCION_VISTA } from './_censo-cobro-factura.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'invoiceDetailView.js');
const codigoReal = fs.readFileSync(VISTA, 'utf8');
const censo = censarCobroFactura(codigoReal);
const porId = (id) => censo.cobro.find((a) => a.id === id);

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO REAL — las 4 acciones-cobro con su destino (DECISIÓN DEL ASESOR, por objeto del endpoint)
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-285 · el censo deriva 4 acciones-cobro, cada una con su destino', () => {
  assert.ok(censo.vistaEncontrada, `🔴 no encuentro ${FUNCION_VISTA}: el censo no mira nada`);

  const ids = censo.cobro.map((a) => `${a.id}→${a.destino}`).join(', ');
  assert.equal(censo.cobro.length, 4, `🔴 el censo ya no ve 4 acciones-cobro sino ${censo.cobro.length}. Ahora ve: ${ids}`);

  // Destino por el OBJETO del endpoint: /charges/ → Cobros · /invoices/ → Factura. La divergencia
  // medida (dispute: URL /invoices/ pero objeto charge → Cobros) queda anclada aquí.
  assert.equal(porId('btnBizum')?.destino, 'Cobros', '🔴 btnBizum (/charges/confirm-bizum) va a Cobros');
  assert.equal(porId('btnDispute')?.destino, 'Cobros', '🔴 btnDispute va a Cobros por OBJETO (chargeback), aunque su URL sea /invoices/');
  assert.equal(porId('btnReminder')?.destino, 'Factura', '🔴 btnReminder (/invoices/send-reminder) se queda en Factura');
  assert.equal(porId('btnTogglePaid')?.destino, 'Factura', '🔴 btnTogglePaid (/invoices/status) se queda en Factura');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// HUÉRFANA — ninguna acción-cobro sin destino (el fallo mudo de B4)
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-285 · guard de huérfanas: ninguna acción-cobro se queda sin destino', () => {
  assert.deepEqual(
    censo.orfanas.map((a) => a.id), [],
    `🔴 hay acciones que TOCAN cobro y no tienen destino declarado: ${censo.orfanas.map((a) => `${a.id}(L${a.linea})`).join(', ')}. ` +
      'Al separar Facturas de Cobros, ninguna puede perderse: o se queda o se muda, pero declarado.',
  );

  // Sintético: una acción cuyo endpoint toca cobro (collect-rest) pero SIN regla de destino → huérfana.
  const conHuerfana = `function ${FUNCION_VISTA}(c) {
    const b = document.createElement('button');
    b.addEventListener('click', () => fetch(\`/admin/invoices/\${id}/collect-rest\`));
    actions.appendChild(b);
  }`;
  const r = censarCobroFactura(conHuerfana);
  assert.equal(r.orfanas.length, 1, '🔴 el guard NO caza una acción que toca cobro y no tiene destino');
  assert.equal(r.cobro.length, 0, 'y no la cuenta como cobro-con-destino');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO — 0 acciones-cobro no es «sano», es un censo ciego
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-285 · SUELO: si el censo deja de ver acciones-cobro, FALLA (no dice «0 huérfanas»)', () => {
  const cegado = `function ${FUNCION_VISTA}(c) { const p = document.createElement('div'); c.appendChild(p); }`;
  assert.equal(censarCobroFactura(cegado).cobro.length, 0, 'el detector puede dar 0 cuando no hay endpoints de cobro');
  assert.ok(
    censo.cobro.length > 0,
    '🔴 SUELO: el censo no ve NINGUNA acción-cobro en el árbol real. No es que no haya — es que dejó de mirar ' +
      '(¿cambió el patrón de handler, se renombró la vista?).',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ROJO POR EL MECANISMO — el censo reacciona a que una acción deje de tocar cobro
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-285 · rojo por el mecanismo: cambiar el endpoint de una acción-cobro la reclasifica', () => {
  // btnBizum toca cobro por `/charges/${chargeId}/confirm-bizum`. Si su endpoint pasa a `/pdf`, deja
  // de tocar cobro — y el censo tiene que bajarlo, cayendo por eso y no por un SyntaxError.
  const mutado = codigoReal.replace('/admin/charges/${invoice.chargeId}/confirm-bizum', '/admin/invoices/${invoice.id}/pdf');
  assert.notEqual(mutado, codigoReal, 'la inyección encontró el endpoint de btnBizum');
  const r = censarCobroFactura(mutado);
  assert.ok(r.vistaEncontrada, 'el código mutado sigue parseando (no es un SyntaxError)');
  assert.equal(r.cobro.length, 3, '🔴 el censo no reacciona a que una acción deje de tocar cobro');
  assert.ok(!r.cobro.find((a) => a.id === 'btnBizum'), 'btnBizum ya no aparece como acción-cobro');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO — una acción que mueve el DOCUMENTO, no el dinero, no se cuela
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-285 · control negativo: abrir PDF y reenviar por WhatsApp NO son cobro', () => {
  // El criterio no es «lleva un enlace de pago dentro» (por esa vía el PDF tocaría cobro). Es el
  // endpoint operando sobre el pago/charge. btnPdf (/pdf) y btnWhatsApp (/resend-whatsapp, /send-email)
  // mueven el documento, no el dinero.
  const ids = censo.cobro.map((a) => a.id);
  assert.ok(!ids.includes('btnPdf'), '🔴 btnPdf (abrir PDF) se coló como cobro');
  assert.ok(!ids.includes('btnWhatsApp'), '🔴 btnWhatsApp (reenviar) se coló como cobro');
  assert.ok(censo.noCobro.find((a) => a.id === 'btnPdf'), 'btnPdf queda en no-cobro');
  assert.ok(censo.noCobro.find((a) => a.id === 'btnWhatsApp'), 'btnWhatsApp queda en no-cobro');
});
