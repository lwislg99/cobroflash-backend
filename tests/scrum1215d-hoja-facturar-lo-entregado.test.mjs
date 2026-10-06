// SCRUM-1215 · la HOJA que abre «Facturar lo entregado» se titula como el botón que la abre.
//
// Firma: SCRUM-1215 comentario 18283 (6-oct-2026), que aplica a la hoja el literal ya firmado para
// el botón en el comentario 17496 (29-sep-2026). Antes la hoja decía «Facturar parte de ‹número›» y
// «Facturar parte del albarán ‹número›»: «parte» (una porción) en la misma ficha que tiene la
// entrada al «Parte de trabajo» (el documento), y un botón que decía una cosa con una hoja que
// decía otra.
//
// Se mide ABRIENDO la hoja en el banco y leyendo lo que queda pintado en `document.body`, no
// buscando el texto en el fichero: un guard de texto casaría con el comentario que lo explica.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const ALBARAN = {
  id: 11, numero: 'AB260011', estado: 'firmado', modoValoracion: 'VALORADO', estadoFacturacion: 'parcial',
  pendientes: [{ concepto: 'Tubería', cantidad: 2, facturado: 1, pendiente: 1, precio: 10 }],
};

/** Abre la hoja como la abre la fila del Trabajo y devuelve lo que se lee de ella. */
function abrirHoja() {
  const banco = cargarDashboard(RAIZ, {});
  banco.ctx.__alb1215 = ALBARAN;
  vm.runInContext('openFacturarParcialSheet(__alb1215, { refresh() {}, setStatus() {}, customer: null })', banco.ctx);
  const nodos = todos(banco.ctx.document.body);
  const hoja = nodos.find((n) => n.getAttribute && n.getAttribute('role') === 'dialog');
  const titulo = nodos.find((n) => String(n.className || '').split(' ').includes('modal-title'));
  return {
    hoja,
    nombreAccesible: hoja ? hoja.getAttribute('aria-label') : undefined,
    titulo: titulo ? String(titulo.textContent) : undefined,
    rotuloDelBoton: vm.runInContext("typeof ROTULOS_ALBARAN !== 'undefined' ? ROTULOS_ALBARAN.btnFacturar : undefined", banco.ctx),
  };
}

test('SCRUM-1215 · SUELO: la hoja se abre en el banco y se le leen título y nombre accesible', () => {
  const h = abrirHoja();
  assert.ok(h.hoja, '🔴 SUELO: la hoja de facturar no ha quedado en `document.body`: lo de abajo no mediría nada');
  assert.ok(typeof h.titulo === 'string' && h.titulo.includes(ALBARAN.numero),
    '🔴 SUELO: no se lee el título de la hoja con el número del albarán. Leído: ' + JSON.stringify(h.titulo));
  assert.ok(typeof h.nombreAccesible === 'string' && h.nombreAccesible.includes(ALBARAN.numero),
    '🔴 SUELO: no se lee el `aria-label` de la hoja. Leído: ' + JSON.stringify(h.nombreAccesible));
  assert.equal(h.rotuloDelBoton, 'Facturar lo entregado',
    '🔴 SUELO: el botón que abre la hoja ya no dice «Facturar lo entregado» (c.17496): la hoja se compara contra él');
});

test('SCRUM-1215 · 🔴 el título de la hoja es «Facturar lo entregado · ‹número›» (c.18283)', () => {
  assert.equal(abrirHoja().titulo, 'Facturar lo entregado · AB260011');
});

test('SCRUM-1215 · 🔴 el nombre accesible es «Facturar lo entregado del albarán ‹número›» (c.18283)', () => {
  assert.equal(abrirHoja().nombreAccesible, 'Facturar lo entregado del albarán AB260011');
});

test('SCRUM-1215 · 🔴 la hoja empieza por el rótulo del botón que la abre: no hay dos vocabularios', () => {
  const h = abrirHoja();
  assert.ok(h.titulo.startsWith(h.rotuloDelBoton), `🔴 título «${h.titulo}» frente a botón «${h.rotuloDelBoton}»`);
  assert.ok(h.nombreAccesible.startsWith(h.rotuloDelBoton), `🔴 aria-label «${h.nombreAccesible}» frente a botón «${h.rotuloDelBoton}»`);
});
