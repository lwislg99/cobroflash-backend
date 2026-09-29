// SCRUM-1280 — Un nombre NO DECLARADO en el panel pone en rojo el check obligatorio.
//
// Vive en `npm test` a propósito: es lo que corre el check `build + tests`, el único que bloquea.
// SCRUM-1275 (`cb` fuera de su `if`: la fila de Facturas no abría nada) estuvo 20 días en
// producción con la suite en verde. Con este test, el PR que lo metió habría salido en rojo.
//
// UNA sola medición (un programa de TypeScript con los 95 scripts del panel tarda segundos) con
// piezas de control añadidas, cada una con un nombre propio que no choca con el panel:
//  · el patrón exacto de 1275 → TIENE que salir (control positivo sobre la forma real del fallo);
//  · una global publicada con `root.X` en una IIFE, una con `window.X`, y una de primer nivel de un
//    script con `module.exports` → NO pueden salir (si salieran, el guard se llenaría de falsos);
//  · un nombre usado solo dentro de `typeof` → NO sale (`typeof` no lanza);
//  · una excepción declarada que ya no ocurre → sale como CADUCADA.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { medir, EXCEPCIONES } from '../scripts/guard-nombres-no-declarados.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pieza = (nombre, texto) => ({ nombre, ruta: path.join(RAIZ, `__prueba-scrum1280-${nombre}`), texto });

const PIEZAS = [
  // La forma de SCRUM-1275, tal cual estaba en invoicesView.js.
  pieza('fila1275.js', [
    'function pintarFilasPrueba1280(tbody, inv, puedeMarcar) {',
    '  const tr = document.createElement("tr");',
    '  if (puedeMarcar) {',
    '    const cbPrueba1280 = document.createElement("input");',
    '    tr.appendChild(cbPrueba1280);',
    '  }',
    '  tr.addEventListener("click", (e) => {',
    '    if (e.target === cbPrueba1280) return;',
    '  });',
    '  tbody.appendChild(tr);',
    '}',
  ].join('\n')),
  pieza('publicaRoot.js', '(function (root) {\n  function publicadaConRoot1280() { return 1; }\n  root.publicadaConRoot1280 = publicadaConRoot1280;\n})(typeof window !== "undefined" ? window : globalThis);\n'),
  pieza('publicaWindow.js', '(function () {\n  window.publicadaConWindow1280 = function () { return 2; };\n})();\n'),
  pieza('commonjs.js', 'function deScriptCommonJs1280() { return 3; }\nif (typeof module !== "undefined" && module.exports) module.exports = { deScriptCommonJs1280 };\n'),
  pieza('usa.js', [
    'function usaLasPublicadas1280() {',
    '  return publicadaConRoot1280() + publicadaConWindow1280() + deScriptCommonJs1280();',
    '}',
    'function soloPregunta1280() { return typeof noExisteYSoloSePregunta1280 === "function"; }',
  ].join('\n')),
];
const CADUCADA = { fichero: 'no-existe-1280.js', nombre: 'fantasma1280', motivo: 'control de caducidad' };

const r = medir({ piezasExtra: PIEZAS, excepcionesDeclaradas: [...EXCEPCIONES, CADUCADA] });
const deControl = new Set(PIEZAS.map((p) => p.nombre));

test('SCRUM-1280: el instrumento midió (control positivo interno cazado, población del panel completa)', () => {
  assert.equal(r.noMedido, undefined, `NO MEDIDO: ${r.noMedido}`);
  assert.ok(r.poblacion.scripts >= 60, `solo ${r.poblacion.scripts} scripts: no está mirando el panel`);
});

test('SCRUM-1280: caza la forma exacta de SCRUM-1275 (variable leída fuera del `if` que la declara), con fichero y línea', () => {
  const h = r.reales.filter((x) => x.fichero === 'fila1275.js');
  assert.deepEqual(h.map((x) => [x.nombre, x.linea]), [['cbPrueba1280', 8]]);
});

test('SCRUM-1280: las globales publicadas (root.X, window.X, primer nivel de un script CommonJS) y `typeof` NO dan falsos', () => {
  const falsos = r.reales.filter((x) => x.fichero === 'usa.js');
  assert.deepEqual(falsos, []);
});

test('SCRUM-1280: una excepción que ya no ocurre sale como caducada, para que la lista no se pudra', () => {
  assert.deepEqual(r.caducadas, [CADUCADA]);
});

test('SCRUM-1280: NINGÚN fichero del panel usa un nombre sin declarar', () => {
  const delPanel = r.reales.filter((x) => !deControl.has(x.fichero));
  assert.deepEqual(
    delPanel.map((x) => `public/dashboard/js/${x.fichero}:${x.linea} «${x.nombre}» → ${x.codigo}`),
    [],
    'En el navegador es un ReferenceError en cuanto esa línea se ejecuta (SCRUM-1275). Decláralo en su ámbito, '
      + 'o si es un falso (p. ej. dentro de un JSDoc) añádelo UNO a EXCEPCIONES en scripts/guard-nombres-no-declarados.mjs con su motivo. '
      + 'Detalle: node scripts/guard-nombres-no-declarados.mjs',
  );
});
