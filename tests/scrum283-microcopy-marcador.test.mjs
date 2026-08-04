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

test('SCRUM-283 · todo rótulo de acción del patrón es el marcador (ninguno inventado)', () => {
  const { acciones } = censarAccionesFactura(codigoReal);
  const delPatron = acciones.filter((a) => a.id !== ANULAR);

  // SUELO: si el escáner deja de ver rótulos, falla en vez de pasar en vacío.
  assert.ok(delPatron.length >= 6, `🔴 ESCÁNER CIEGO: solo veo ${delPatron.length} rótulos del patrón (esperaba 8)`);

  for (const a of delPatron) {
    assert.equal(
      desnuda(a.texto), MARCA,
      `🔴 el rótulo de ${a.id} (L${a.linea}) NO es el marcador: «${a.texto}». Un renombre también es ` +
        'microcopy nueva (regla 30): el rótulo lo aprueba el fundador, no esta tarea.',
    );
  }
});

test('SCRUM-283 · INYECCIÓN: un texto plausible en un rótulo hace caer el guard', () => {
  // Se sustituye el rótulo de btnPdf por un texto plausible; el censo debe verlo distinto del
  // marcador (si no, el guard estaría en verde pasara lo que pasara).
  const inyectado = codigoReal.replace(
    "btnPdf.textContent = '[PENDIENTE microcopy oficial]';",
    "btnPdf.textContent = 'Descargar PDF';",
  );
  assert.notEqual(inyectado, codigoReal, '🔴 la inyección no encontró el rótulo de btnPdf (¿cambió de forma?)');

  const pdf = censarAccionesFactura(inyectado).acciones.find((a) => a.id === 'btnPdf');
  assert.notEqual(
    desnuda(pdf.texto), MARCA,
    '🔴 el guard NO distingue un texto inventado del marcador: sería ciego a un renombre colado.',
  );
});
