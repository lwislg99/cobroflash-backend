// tests/scrum743b-cantidad-presencial-igual-que-remota.test.mjs — SCRUM-743, mitad de S2
//
// La cantidad de un albarán tiene TRES caras: el PDF, la pantalla pública donde firma el cliente a
// distancia (servidor, `renderLineasAlbaran` → `fmtCantidadAlbaran`) y el pad de firma PRESENCIAL en el
// móvil del profesional (`signaturePad.js`). S1 unificó las dos primeras; si ésta se quedara en crudo,
// el canal remoto diría «2,5» y el presencial «2.5», y habríamos cambiado una divergencia por otra.
//
// Se mide el VIAJE: se abre el pad DE VERDAD en el banco con un albarán y se lee la celda pintada. La
// expectativa NO se escribe a mano: sale de la función REAL del servidor (dist). Así, dos formateadores
// que «casi» coinciden caen aquí, número a número (condición del orquestador en SCRUM-743 c.17508).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';
import { ALBARAN_ROTULOS } from '../dist/modules/jobs/domain/albaranFirmante.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { fmtCantidadAlbaran, renderLineasAlbaran } = await import(
  pathToFileURL(path.join(RAIZ, 'dist/modules/jobs/app/routes/albaranPublicVista.js')).href);

// Enteros, decimales, miles (con y sin decimales), millones, redondeo a 2, cadenas numéricas, cero,
// negativo, vacío y basura. Los de cuatro cifras son los que `toLocaleString('es-ES')` NO agrupa (CLDR).
const CANTIDADES = [3, 2.5, 0.333, 1500, 1500.75, 12345, 1000000, '7', '2.5', 0, -1, '', null, 'abc'];

/** Abre el pad y devuelve el texto de la celda de cantidad de cada línea, en orden. */
function celdasDelPad(lineas) {
  const banco = cargarDashboard(RAIZ);
  const crear = banco.ctx.document.createElement;
  banco.ctx.document.createElement = function (tag) {
    const n = crear.call(this, tag);
    if (String(tag).toLowerCase() === 'canvas') {
      // El banco no sabe de <canvas>; lo que se mide es la tabla, no el trazo (muleta de SCRUM-466).
      n.getContext = () => ({ scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, clearRect() {},
        getImageData: () => ({}), putImageData() {}, set strokeStyle(_) {}, set lineWidth(_) {}, set lineCap(_) {}, set lineJoin(_) {} });
      n.toDataURL = () => 'data:image/png;base64,AA==';
      n.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 190 });
    }
    return n;
  };
  banco.ctx.window.appAlbaranRotulos = ALBARAN_ROTULOS;
  banco.ctx.window.appAlbaranFirmanteOpciones = [];
  assert.equal(typeof banco.ctx.openSignaturePad, 'function', 'SUELO: el dashboard no publica `openSignaturePad`');
  banco.ctx.openSignaturePad({ title: 'Firma del cliente', albaran: { cliente: 'x', lineas }, onConfirm: async () => {} });
  const tablas = [];
  const recorrer = (n) => { if (String(n.tagName).toUpperCase() === 'TABLE') tablas.push(n); (n.hijos || []).forEach(recorrer); };
  recorrer(banco.ctx.document.body);
  assert.equal(tablas.length, 1, `SUELO: el pad no pintó la tabla de líneas (${tablas.length})`);
  const html = String(tablas[0].innerHTML);
  const filas = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]));
  return filas.map((celdas) => celdas[1]);
}

/** Lo mismo desde el servidor: la segunda celda de cada fila de `renderLineasAlbaran`. */
function celdasDelServidor(lineas) {
  const html = String(renderLineasAlbaran(lineas, 'SIN_VALORAR'));
  const filas = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].slice(1); // la primera es la cabecera
  return filas.map((m) => [...m[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) => c[1])[1]);
}

test('SCRUM-743 · 🔴 el pad presencial escribe la cantidad EXACTAMENTE como el servidor, número a número', () => {
  const lineas = CANTIDADES.map((c, i) => ({ concepto: `L${i}`, cantidad: c, unidad: null }));
  const pad = celdasDelPad(lineas);
  assert.equal(pad.length, CANTIDADES.length, 'SUELO: no salen todas las líneas en el pad');
  const esperado = CANTIDADES.map((c) => fmtCantidadAlbaran(c));
  const distintos = CANTIDADES
    .map((c, i) => ({ c, pad: pad[i], servidor: esperado[i] }))
    .filter((x) => x.pad !== x.servidor);
  assert.deepEqual(distintos, [], '🔴 el canal presencial y el remoto escriben distinto la misma cantidad');
});

test('SCRUM-743 · la pantalla pública del servidor pinta lo mismo que su propia función (el otro extremo)', () => {
  // Si la pantalla pública no usara `fmtCantidadAlbaran`, comparar contra la función no probaría nada.
  const lineas = CANTIDADES.map((c, i) => ({ concepto: `L${i}`, cantidad: c, unidad: null }));
  assert.deepEqual(celdasDelServidor(lineas), CANTIDADES.map((c) => fmtCantidadAlbaran(c)));
});

test('SCRUM-743 · CONTROL: los casos que motivan el ticket salen en español', () => {
  const [a, b, c] = celdasDelPad([
    { concepto: 'a', cantidad: 2.5, unidad: null },
    { concepto: 'b', cantidad: 12345, unidad: null },
    { concepto: 'c', cantidad: 1500, unidad: null },
  ]);
  assert.deepEqual([a, b, c], ['2,5', '12.345', '1.500'], '🔴 el pad sigue escribiendo en crudo');
});

test('SCRUM-743 · la unidad sigue detrás de la cantidad formateada', () => {
  const [celda] = celdasDelPad([{ concepto: 'a', cantidad: 2.5, unidad: 'm²' }]);
  assert.equal(celda, '2,5 m²');
});
