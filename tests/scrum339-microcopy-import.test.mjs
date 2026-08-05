// tests/scrum339-microcopy-import.test.mjs — SCRUM-339 · guard de microcopy (regla 30)
//
// El import de productos ahora reporta filas con error (contrato alineado con clientes). Mostrar ese
// contador al usuario necesita un rótulo, y CUALQUIER texto nuevo que el usuario lee es microcopy y lo
// aprueba el fundador (regla 30). Hasta entonces va con el marcador [PENDIENTE microcopy oficial], igual
// que portabilidad (SCRUM-244) y las acciones de factura (SCRUM-283).
//
// Este guard falla si el rótulo de errores del toast de import deja de ser el marcador — colar un texto
// plausible («errores», «fallos»…) es justo lo que caza. «Insertados»/«Duplicados omitidos» NO se vigilan:
// son feedback EXISTENTE reusado, no microcopy nueva (misma excepción que declara SCRUM-283).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'productsView.js');
const codigoReal = fs.readFileSync(VISTA, 'utf8');

const MARCA = '[PENDIENTE microcopy oficial]';
// Palabras que serían un rótulo de errores INVENTADO (microcopy sin aprobar):
const RE_INVENTADO = /errores|fallos|inv[aá]lid|problema|rechaz|con error/i;

/** La línea que construye la nota de errores del toast de import (donde vive el rótulo nuevo). */
const notaDeErrores = (src) => (src.match(/const errNota =.*data\.errors.*;/) || [])[0] || '';
/** ¿el rótulo de esa nota es SOLO el marcador (sin texto inventado)? */
const soloMarcador = (linea) => linea.includes(MARCA) && !RE_INVENTADO.test(linea);

test('SCRUM-339 · el toast de import existe (SUELO) y su rótulo de errores es el marcador', () => {
  // SUELO: si el escáner no ve el toast, falla en vez de pasar en vacío.
  assert.match(codigoReal, /CSV importado/, '🔴 SUELO: no encuentro el toast «CSV importado» — el escáner no lee');
  const nota = notaDeErrores(codigoReal);
  assert.ok(nota, '🔴 SUELO: no encuentro la nota de errores (const errNota … data.errors) — ¿cambió de forma?');
  assert.ok(soloMarcador(nota),
    `🔴 el rótulo de los errores del import debe ser el marcador ${MARCA} (regla 30: el texto lo aprueba ` +
    `el fundador). Un renombre plausible también es microcopy nueva. Nota: «${nota.trim()}»`);
});

test('SCRUM-339 · INYECCIÓN: un rótulo plausible en la nota de errores hace caer el guard', () => {
  const inyectado = notaDeErrores(codigoReal).replace(MARCA, 'errores');
  assert.notEqual(inyectado, notaDeErrores(codigoReal), '🔴 la inyección no encontró el marcador (¿cambió de forma?)');
  assert.equal(soloMarcador(inyectado), false,
    '🔴 el guard NO distingue un rótulo inventado del marcador: sería ciego a un texto colado (regla 30).');
});

test('SCRUM-339 · CONTROL NEGATIVO: un cambio ajeno al rótulo NO tumba el guard', () => {
  // Cambiar texto en OTRA parte del fichero (aquí, un feedback reusado) no debe afectar al veredicto:
  // el guard vigila el rótulo de errores, no cualquier edición del fichero.
  const ajeno = codigoReal.replace('Importando…', 'Importando el CSV…');
  assert.notEqual(ajeno, codigoReal, 'el cambio ajeno debe aplicarse (si no, el control no prueba nada)');
  assert.equal(soloMarcador(notaDeErrores(ajeno)), true,
    'un cambio que no toca el rótulo de errores debe dejar el guard en verde');
});
