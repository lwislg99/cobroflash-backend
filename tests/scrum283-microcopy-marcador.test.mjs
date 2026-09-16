// SCRUM-283 (B2) · GUARD DE MICROCOPY — ningún rótulo de acción inventado (regla 30).
//
// Los rótulos del patrón son microcopy SIN APROBAR: se pintan con el marcador [PENDIENTE microcopy
// oficial] hasta que el fundador apruebe los textos. Este guard extrae los rótulos que el usuario
// LEE en el patrón —vía el censo, que deriva el primer `textContent` de cada botón— y falla si
// alguno NO es el marcador. Un RENOMBRE también es microcopy nueva; colar un texto plausible es
// justo lo que esto caza. Mismo mecanismo que portabilidad (SCRUM-244).
//
// FUERA DEL GUARD, a propósito:
//   · ANULAR — su código y su rótulo no se tocan (excepción de la regla 5). «Anular factura…» no es
//     un rótulo del patrón que este guard deba marcar.
//   · Los textos de FEEDBACK dentro de los handlers («Enviando…», toasts) — son copy existente,
//     reusado, y los handlers no se tocan (cobro/firma/WhatsApp/PDF funcionan). Reusar lo existente
//     no es microcopy nueva. El guard mira el RÓTULO (primer textContent), no el feedback.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarAccionesFactura } from './_censo-acciones-factura.mjs';
import registro from '../public/dashboard/js/invoiceActionsRegistry.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'invoiceDetailView.js');
const codigoReal = fs.readFileSync(VISTA, 'utf8');

const MARCA = '[PENDIENTE microcopy oficial]';
const ANULAR = 'btnAnular';
const desnuda = (t) => String(t).replace(/^['"`]/, '').replace(/['"`]$/, ''); // el censo trae el literal con comillas

test('SCRUM-283 · el marcador del registro es exactamente el oficial', () => {
  assert.equal(registro.MICROCOPY_PENDIENTE, MARCA, '🔴 el marcador del registro no coincide con el oficial');
});

/**
 * 🔴 APROBADOS el 17-ago-2026 (regla 30). ESTA TABLA SUSTITUYE AL MARCADOR, no lo relaja.
 *
 * Hasta hoy este guard exigía que los ocho rótulos fueran EXACTAMENTE el marcador, y su motivo
 * seguía siendo bueno: «un renombre también es microcopy nueva, y lo aprueba el fundador, no esta
 * tarea». Lo que ha cambiado es que **el fundador los ha aprobado**, así que el marcador dejó de ser
 * la respuesta correcta — y borrar el guard habría dejado los ocho rótulos sin vigilar justo el día
 * que por fin tienen texto.
 *
 * Se cambia el VALOR esperado, no la exigencia: siguen sin poder renombrarse sin pasar por aquí.
 */
const ROTULOS_APROBADOS = Object.freeze({
  btnPdf: 'Descargar PDF',
  btnWhatsApp: 'Enviar por WhatsApp',
  btnTogglePaid: 'Marcar como cobrada',
  btnDispute: 'Ver la reclamación del banco',
  btnBizum: 'Cobrar por Bizum',
  btnReminder: 'Enviar recordatorio de pago',
  btnRectify: 'Emitir factura rectificativa',
  btnRegen: 'Volver a generar el PDF',
});

test('SCRUM-283 · todo rótulo de acción del patrón es su texto APROBADO (ninguno inventado)', () => {
  const { acciones } = censarAccionesFactura(codigoReal);
  const delPatron = acciones.filter((a) => a.id !== ANULAR);

  // SUELO: si el escáner deja de ver rótulos, falla en vez de pasar en vacío.
  assert.ok(delPatron.length >= 6, `🔴 ESCÁNER CIEGO: solo veo ${delPatron.length} rótulos del patrón (esperaba 8)`);

  for (const a of delPatron) {
    const esperado = ROTULOS_APROBADOS[a.id];
    assert.ok(esperado,
      `🔴 la acción «${a.id}» (L${a.linea}) no tiene texto aprobado en esta tabla. Si es nueva, su ` +
      'rótulo sale con el marcador y se añade al censo de SCRUM-402 — no se inventa aquí.');
    assert.equal(
      desnuda(a.texto), esperado,
      `🔴 el rótulo de ${a.id} (L${a.linea}) NO es el aprobado. Dice «${a.texto}» y tiene que decir ` +
        `«${esperado}». Un renombre también es microcopy nueva (regla 30): lo aprueba el fundador, ` +
        'no esta tarea.',
    );
  }
});

test('SCRUM-283 · INYECCIÓN: un texto plausible en un rótulo hace caer el guard', () => {
  // Se sustituye el rótulo de btnPdf por otro plausible; el censo debe verlo distinto del aprobado
  // (si no, el guard estaría en verde pasara lo que pasara).
  const inyectado = codigoReal.replace(
    "btnPdf.textContent = 'Descargar PDF';",
    "btnPdf.textContent = 'Bajar el PDF';",
  );
  assert.notEqual(inyectado, codigoReal, '🔴 la inyección no encontró el rótulo de btnPdf (¿cambió de forma?)');

  const pdf = censarAccionesFactura(inyectado).acciones.find((a) => a.id === 'btnPdf');
  assert.notEqual(
    desnuda(pdf.texto), ROTULOS_APROBADOS.btnPdf,
    '🔴 el guard NO distingue un texto inventado del aprobado: sería ciego a un renombre colado.',
  );
});
