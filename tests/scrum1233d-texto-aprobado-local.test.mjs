// tests/scrum1233d-texto-aprobado-local.test.mjs — SCRUM-1233d
//
// LA REGRESIÓN: el helper de SCRUM-1233 (`mensajeParaPersona`, api.js) solo entendía errores del
// SERVIDOR (`err.data.message`). Un texto aprobado que lanza el propio panel como `Error` local caía
// siempre al respaldo. En Gastos, una foto que no se puede abrir enseñaba «Error al guardar.» en vez
// del texto firmado (SCRUM-947) «No hemos podido abrir esta foto…».
//
// EL ARREGLO va en el helper, no en el sitio: quien lanza un texto aprobado lo marca con
// `errorParaPersona(texto)`, y `mensajeParaPersona` lo honra. Un `Error` local SIN marca (el
// «Failed to fetch» del navegador, un TypeError) sigue cayendo al respaldo.
//
// LO QUE ESTE FICHERO FIJA
// ① El helper: la marca se honra; `err.message` a secas, no; `data.message` sigue ganando.
// ② EL VIAJE: modal de alta de Gastos en el banco, foto que no abre, clic en «Añadir gasto», y se LEE
//    lo que se pinta en `#exp-error`. Con control: un 500 del servidor al guardar sigue diciendo el
//    respaldo, no «API 500».
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AVISO_FOTO = 'No hemos podido abrir esta foto. Prueba con otra o haz una captura de pantalla del ticket.';
const RESPALDO_GUARDAR = 'Error al guardar.';
const EV = { preventDefault() {}, stopPropagation() {} };

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① EL HELPER
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1233d · el helper honra el texto MARCADO por el panel, y nada más', () => {
  const { ctx } = cargarDashboard(RAIZ);
  const m = ctx.mensajeParaPersona;
  const marcar = ctx.errorParaPersona;
  assert.equal(typeof marcar, 'function', 'SUELO: api.js no expone `errorParaPersona`');
  const propio = marcar('Texto aprobado.');
  assert.equal(propio.message, 'Texto aprobado.', 'quien compara `err.message ===` no puede romperse');
  assert.equal(m(propio, 'R'), 'Texto aprobado.', '🔴 un texto aprobado lanzado por el panel cae al respaldo');
  // Negativos: lo local SIN marca sigue siendo tripa.
  assert.equal(m(new TypeError('Failed to fetch'), 'R'), 'R', '🔴 se pinta el inglés del navegador');
  assert.equal(m(new Error('No hemos podido abrir esta foto.'), 'R'), 'R',
    '🔴 se pinta `err.message` sin marca: cualquier Error local llegaría a la pantalla');
  assert.equal(m(marcar('   '), 'R'), 'R', 'una marca vacía no es un texto');
  assert.equal(m(Object.assign(new Error('x'), { textoAprobado: { a: 1 } }), 'R'), 'R', 'un objeto no es un texto');
  // La frase del servidor sigue mandando.
  const ambos = Object.assign(marcar('local'), { data: { message: 'del servidor' } });
  assert.equal(m(ambos, 'R'), 'del servidor');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② EL VIAJE — Gastos, alta con una foto que no se abre
// ═════════════════════════════════════════════════════════════════════════════════════════════

// Un data-URI por encima del techo (1,5 MB) obliga a `fotoParaGuardar` a ABRIR la foto para reducirla.
const FOTO_GRANDE = { name: 'ticket.heic', _dataUrl: 'data:image/heic;base64,' + 'A'.repeat(1.6 * 1024 * 1024) };

class FileReaderFalso {
  readAsDataURL(file) {
    this.result = file._dataUrl;
    Promise.resolve().then(() => { if (typeof this.onload === 'function') this.onload(); });
  }
}

const jsonRes = (status, body) => ({
  ok: status >= 200 && status < 300, status, statusText: status === 500 ? 'Internal Server Error' : 'OK',
  headers: { get: () => 'application/json' },
  json: async () => body, blob: async () => ({}), text: async () => JSON.stringify(body),
});

async function ticks(n = 10) { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); }

/** Abre el alta, rellena lo obligatorio, elige `foto` (o ninguna), pulsa «Añadir gasto» y devuelve lo pintado. */
async function guardarGasto({ foto, alGuardar }) {
  const peticiones = [];
  const banco = cargarDashboard(RAIZ, {
    red: {
      fetch: async (url, opts = {}) => {
        const u = String(url);
        const metodo = (opts && opts.method) || 'GET';
        peticiones.push(`${metodo} ${u}`);
        if (metodo === 'POST' && /\/admin\/expenses(\?|$)/.test(u)) return alGuardar();
        if (/\/admin\/(providers|jobs)/.test(u)) return jsonRes(200, []);
        return jsonRes(200, {});
      },
    },
  });
  const { ctx } = banco;
  ctx.FileReader = FileReaderFalso;
  // La foto NO se abre por ninguna de las dos vías de `abrirFoto`, como un HEIC en Chrome.
  ctx.createImageBitmap = async () => { throw new Error('The source image could not be decoded.'); };
  ctx.URL = { createObjectURL: () => 'blob:falso', revokeObjectURL() {} };
  ctx.Image = class { decode() { return Promise.reject(new Error('EncodingError')); } };

  assert.equal(typeof ctx.openExpenseModal, 'function', 'SUELO: openExpenseModal no está en window');
  ctx.openExpenseModal(null);
  await ticks();
  const doc = ctx.document;
  doc.getElementById('exp-concept').value = 'Tubería';
  doc.getElementById('exp-amount').value = '12.10';
  if (foto) {
    const input = doc.getElementById('exp-receipt');
    assert.ok(input, 'SUELO: no hay input de foto en el modal');
    input.files = [foto];
    input.disparar('change');
  }
  const btn = doc.getElementById('exp-save');
  const oyentes = (btn && btn._oyentes && btn._oyentes.click) || [];
  assert.ok(oyentes.length > 0, 'SUELO: «Añadir gasto» no tiene oyente de clic');
  await Promise.all(oyentes.map((fn) => fn.call(btn, EV)));
  await ticks();
  const aviso = doc.getElementById('exp-error');
  assert.ok(aviso && aviso.style.display === 'block', 'CIEGO: no se pintó ningún aviso de error; no hay viaje que medir');
  return { texto: String(aviso.textContent || ''), peticiones };
}

test('SCRUM-1233d · 🔴 Gastos: una foto que no se abre enseña SU texto firmado, no «Error al guardar.»', async () => {
  const { texto, peticiones } = await guardarGasto({
    foto: FOTO_GRANDE,
    alGuardar: () => { throw new Error('no debería llegar al servidor'); },
  });
  assert.equal(texto, AVISO_FOTO);
  assert.equal(peticiones.some((p) => /^POST .*\/admin\/expenses/.test(p)), false,
    'la foto no se abrió: el gasto no tiene que salir hacia el servidor');
});

test('SCRUM-1233d · CONTROL: un 500 sin frase al guardar sigue diciendo el respaldo, no la tripa', async () => {
  const { texto, peticiones } = await guardarGasto({
    foto: null,
    alGuardar: () => jsonRes(500, { error: 'internal_error' }),
  });
  assert.ok(peticiones.some((p) => /^POST .*\/admin\/expenses/.test(p)), 'CIEGO: el guardado no llegó a pedir nada');
  assert.equal(texto, RESPALDO_GUARDAR);
});

test('SCRUM-1233d · CONTROL: una frase del servidor al guardar se enseña tal cual', async () => {
  const { texto } = await guardarGasto({
    foto: null,
    alGuardar: () => jsonRes(409, { error: 'x', message: 'Ese proveedor ya no existe.' }),
  });
  assert.equal(texto, 'Ese proveedor ya no existe.');
});
