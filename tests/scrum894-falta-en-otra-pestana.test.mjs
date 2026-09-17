// tests/scrum894-falta-en-otra-pestana.test.mjs — SCRUM-894.
//
// ── QUÉ CUBRE ESTE FICHERO, Y QUÉ NO ─────────────────────────────────────────────────────────
// El COMPORTAMIENTO —pulsar «Guardar cambios» con el NIF vacío desde Cobros y que se abra Empresa,
// con el campo enfocado y un aviso que lo nombra— lo mide `scripts/guard-falta-en-otra-pestana.mjs`
// EN NAVEGADOR: la validación de formularios no existe fuera de uno, y `npm test` no arranca ninguno.
//
// Aquí se vigila lo que sí se puede sin navegador:
//   1. la DECISIÓN (`pestanaDelQueFalta`): a qué pestaña se lleva, y cuándo NO se toca nada;
//   2. el TEXTO, carácter a carácter;
//   3. que la pantalla la USE en el clic del botón y que el guard siga en la puerta de CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import mapa from '../public/dashboard/js/settingsSubmenus.js';
import { soloEjecutable } from './_guard-texto.mjs';
import { fueraDeLaTanda } from '../scripts/guards-visuales.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const { pestanaDelQueFalta, avisoFaltaEnOtraPestana, rotuloDeSubmenu, submenuDeCampo } = mapa;

test('SCRUM-894 · 🔴 lo que falta está SOLO en pestañas ocultas → se lleva a la del primero', () => {
  // El caso del ticket: NIF (Empresa) vacío y «Guardar» pulsado desde Cobros.
  assert.equal(pestanaDelQueFalta([submenuDeCampo('taxId')], 'cobro'), 'empresa');
  // Dos ocultas: manda el orden del formulario, no la pestaña «más importante».
  assert.equal(pestanaDelQueFalta(['facturacion', 'empresa'], 'cobro'), 'facturacion');
  assert.equal(pestanaDelQueFalta(['empresa', 'facturacion'], 'cobro'), 'empresa');
});

test('SCRUM-894 · NEGATIVO: si algo de lo que falta se ve, no se toca nada (avisa el navegador como hoy)', () => {
  assert.equal(pestanaDelQueFalta(['empresa'], 'empresa'), null);
  // Aunque el primero del formulario esté oculto: lo visible lo señala el navegador y no se le
  // cambia la pantalla a quien está mirando el campo que falta.
  assert.equal(pestanaDelQueFalta(['facturacion', 'empresa'], 'empresa'), null);
});

test('SCRUM-894 · POSITIVO: sin nada que falte, no se decide nada', () => {
  assert.equal(pestanaDelQueFalta([], 'cobro'), null);
});

test('SCRUM-894 · el aviso nombra el campo y la pestaña, con sus rótulos de pantalla', () => {
  assert.equal(
    avisoFaltaEnOtraPestana('NIF/CIF', rotuloDeSubmenu('empresa')),
    'Para guardar, rellena «NIF/CIF». Está en la pestaña Empresa.',
  );
});

test('SCRUM-894 · la pantalla decide en el CLIC de «Guardar cambios», antes de que valide el navegador', () => {
  const vista = soloEjecutable(fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/settingsView.js'), 'utf8'));
  const desde = vista.indexOf('saveBtn.addEventListener("click"');
  assert.notEqual(desde, -1, '🔴 «Guardar cambios» ya no escucha el clic: un obligatorio vacío en otra '
    + 'pestaña vuelve a frenar el envío sin decir nada.');
  const cuerpo = vista.slice(desde, vista.indexOf('});', desde));
  for (const pieza of ['pestanaDelQueFalta(', 'pintarNav()', 'avisoFaltaEnOtraPestana(', 'validity.valid']) {
    assert.ok(cuerpo.includes(pieza), `🔴 el escuchador del clic ya no usa \`${pieza}\``);
  }
  // ⛔ No se cambia qué es obligatorio: ni se quita `required` ni se desactiva la validación.
  assert.ok(!/noValidate|novalidate|removeAttribute\(\s*["']required/.test(vista),
    '🔴 se ha tocado la validación en vez de avisar de ella');
});

test('SCRUM-894 · el guard de navegador existe y sigue en la puerta de CI (guards:visuales)', () => {
  assert.ok(fs.existsSync(path.join(RAIZ, 'scripts/guard-falta-en-otra-pestana.mjs')));
  assert.ok(fueraDeLaTanda().includes('guard:falta-en-otra-pestana'),
    '🔴 guards:visuales ya no recoge el guard: el comportamiento dejaría de medirse en cada PR');
});
