// SCRUM-1215 (lote 1, #5) · EL BLOQUE VACÍO DE UN PARTE FIRMADO YA NO PROMETE «TODAVÍA».
//
// «Todavía no has apuntado nada.» se pintaba también en un parte FIRMADO, cuyo contenido ya no se
// puede cambiar (`puedeEditarContenido` sólo abre el `borrador`): «todavía» prometía algo
// imposible, y «has» lo lee también la oficina. Firmado en SCRUM-1215 c.17367:
//   · bloque vacío y NO editable → «No se apuntó nada en este apartado.»
//   · bloque vacío y editable    → se queda «Todavía no has apuntado nada.»
// Se monta la vista de verdad en el banco y se lee lo que se pinta en cada caso.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CERRADO = 'No se apuntó nada en este apartado.';
const ABIERTO = 'Todavía no has apuntado nada.';

// Sólo mano de obra: el bloque «Materiales» sale vacío.
const BORRADOR = Object.freeze({
  id: 7, numero: 'PT-2026-007', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: null,
  entrada: '08:00', salida: '11:30', desplazamientos: 1, kilometros: 12,
  tecnicos: [], tipo: 'mantenimiento', notas: null,
  lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión' }],
  estado: 'borrador',
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const FIRMADO = { ...BORRADOR, estado: 'firmado', puedeEditarContenido: { ok: false, motivo: 'firmado' } };

// El banco guarda el texto en las HOJAS, no en el contenedor (mismo lector que scrum1175c).
const texto = (n) => todos(n).filter((x) => x.tagName === '#text' || !x.hijos?.length)
  .map((x) => x.textContent || '').join(' ').trim();

function vacios(parte) {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  assert.equal(b.ctx.renderParte(c, parte), true, '🔴 SUELO: la vista se negó a pintar');
  return todos(c)
    .filter((x) => x.getAttribute && x.getAttribute('data-parte-sin-lineas'))
    .map((x) => ({ bloque: x.getAttribute('data-parte-sin-lineas'), texto: texto(x) }));
}

test('SCRUM-1215b · parte FIRMADO: el bloque vacío dice «No se apuntó nada en este apartado.»', () => {
  const v = vacios(FIRMADO);
  assert.deepEqual(v.map((x) => x.bloque), ['materiales'], '🔴 SUELO: no encuentro el bloque vacío (o sobra uno)');
  assert.equal(v[0].texto, CERRADO);
  assert.ok(!v[0].texto.includes('Todavía'), '🔴 un parte firmado sigue prometiendo «todavía»');
});

test('SCRUM-1215b · parte en BORRADOR: el bloque vacío se queda como estaba', () => {
  const v = vacios(BORRADOR);
  assert.deepEqual(v.map((x) => x.bloque), ['materiales'], '🔴 SUELO: no encuentro el bloque vacío (o sobra uno)');
  assert.equal(v[0].texto, ABIERTO, '🔴 el texto del borrador ha cambiado, y la firma dice que se queda');
});
