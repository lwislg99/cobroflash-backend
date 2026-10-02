// SCRUM-1425 · GASTOS: LA FOTO QUE CABE TAMBIÉN TIENE QUE SER UNA FOTO.
//
// `fotoParaGuardar` sólo abría la foto cuando no cabía en la petición (más de ~1,5 MB de data-URI).
// Una que cabía «se mandaba tal cual»: un fichero pequeño que no es una imagen viajaba como
// justificante del gasto y la pantalla no decía nada. Medido en yaqu.app el 2-oct-2026.
//
// LO QUE ESTE FICHERO FIJA, con el modal real de Gastos en el banco:
//   🔴 un fichero PEQUEÑO que no se abre NO se manda y enseña el aviso ya firmado (SCRUM-947);
//   ✅ una imagen pequeña de verdad se manda TAL CUAL —el mismo data-URI, sin recomprimir— y sin aviso;
//   ✅ una HEIC pequeña que este navegador no sabe abrir se sigue mandando (hoy funciona: el servidor
//      la lee), reconocida por su CABECERA y no por el nombre;
//   🔴 un fichero que sólo SE LLAMA .heic no cuela;
//   y «Leer el ticket», que usa la misma función, hace lo mismo.
//
// Lo que NO mide: un navegador de verdad (aquí «se abre» o «no se abre» lo decide el banco), ni qué
// hace el servidor con lo que recibe.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AVISO_FOTO = 'No hemos podido abrir esta foto. Prueba con otra o haz una captura de pantalla del ticket.';
const EV = { preventDefault() {}, stopPropagation() {} };
const b64 = (bytes) => Buffer.from(bytes).toString('base64');

// Todas CABEN: muy por debajo del techo de 1,5 MB.
const NO_ES_IMAGEN = { name: 'ticket.jpg', type: 'image/jpeg', _abre: false, _dataUrl: 'data:image/jpeg;base64,' + b64('esto no es una imagen: es texto con nombre de foto') };
const JPEG_PEQUENO = { name: 'ticket.jpg', type: 'image/jpeg', _abre: true, _dataUrl: 'data:image/jpeg;base64,' + b64([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 1, 0, 72]) };
const HEIC_PEQUENA = { name: 'IMG_0001.heic', type: 'image/heic', _abre: false, _dataUrl: 'data:image/heic;base64,' + b64([0, 0, 0, 24, ...Buffer.from('ftypheic'), 0, 0, 0, 0, ...Buffer.from('mif1heic')]) };
const SOLO_SE_LLAMA_HEIC = { name: 'IMG_0002.heic', type: 'image/heic', _abre: false, _dataUrl: 'data:image/heic;base64,' + b64('ftyp no está donde toca: esto es texto') };
const ABRE_PERO_SIN_TAMANO = { name: 'vacia.png', type: 'image/png', _abre: true, _sinTamano: true, _dataUrl: 'data:image/png;base64,' + b64('cabecera rota') };

class FileReaderFalso {
  readAsDataURL(file) {
    this.result = file._dataUrl;
    Promise.resolve().then(() => { if (typeof this.onload === 'function') this.onload(); });
  }
}
const jsonRes = (status, body) => ({
  ok: status >= 200 && status < 300, status, statusText: 'OK', headers: { get: () => 'application/json' },
  json: async () => body, blob: async () => ({}), text: async () => JSON.stringify(body),
});
async function ticks(n = 12) { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); }

/** Abre el alta, elige `foto`, pulsa `boton` («exp-save» o «leer») y devuelve lo pintado y lo enviado. */
async function conLaFoto(foto, boton = 'exp-save') {
  const enviados = [];
  const cerradas = { n: 0 };
  const { ctx } = cargarDashboard(RAIZ, {
    red: {
      fetch: async (url, opts = {}) => {
        const u = String(url);
        const metodo = (opts && opts.method) || 'GET';
        if (metodo !== 'GET') enviados.push({ ruta: metodo + ' ' + u.replace(/^https?:\/\/[^/]+/, ''), cuerpo: opts.body ? JSON.parse(opts.body) : null });
        if (/leer-ticket/.test(u)) return jsonRes(200, { ok: true, propuesta: {}, descartados: [] });
        if (metodo === 'POST' && /\/admin\/expenses(\?|$)/.test(u)) return jsonRes(201, { id: 1 });
        if (/\/admin\/(providers|jobs)/.test(u)) return jsonRes(200, []);
        return jsonRes(200, {});
      },
    },
  });
  ctx.FileReader = FileReaderFalso;
  if (typeof ctx.atob !== 'function') ctx.atob = atob;
  // «Se abre» lo decide el fichero de prueba: así el mismo banco hace de Chrome ante una HEIC.
  ctx.createImageBitmap = async (file) => {
    if (!file._abre) throw new Error('The source image could not be decoded.');
    return { width: file._sinTamano ? 0 : 40, height: file._sinTamano ? 0 : 30, close() { cerradas.n += 1; } };
  };
  ctx.URL = { createObjectURL: () => 'blob:falso', revokeObjectURL() {} };
  ctx.Image = class { decode() { return Promise.reject(new Error('EncodingError')); } };

  assert.equal(typeof ctx.openExpenseModal, 'function', '🔴 SUELO: openExpenseModal no está en window');
  ctx.openExpenseModal(null);
  await ticks();
  const doc = ctx.document;
  doc.getElementById('exp-concept').value = 'Tubería';
  doc.getElementById('exp-amount').value = '12.10';
  const input = doc.getElementById('exp-receipt');
  assert.ok(input, '🔴 SUELO: no hay input de foto en el modal');
  input.files = [foto];
  input.disparar('change');
  await ticks();
  let btn = doc.getElementById('exp-save');
  if (boton === 'leer') {
    btn = ['exp-btn-leer-ticket', 'exp-leer-ticket', 'exp-btn-leer'].map((id) => doc.getElementById(id)).find(Boolean);
    assert.ok(btn, '🔴 SUELO: no encuentro el botón «Leer el ticket»');
  }
  const oyentes = (btn && btn._oyentes && btn._oyentes.click) || [];
  assert.ok(oyentes.length > 0, '🔴 SUELO: el botón no tiene oyente de clic');
  await Promise.all(oyentes.map((fn) => fn.call(btn, EV)));
  await ticks();
  const aviso = doc.getElementById('exp-error');
  const pintado = aviso && aviso.style.display === 'block' ? String(aviso.textContent || '') : null;
  return { pintado, enviados, cerradas: cerradas.n };
}
const altas = (r) => r.enviados.filter((e) => /^POST \/admin\/expenses$/.test(e.ruta));

test('SCRUM-1425 · suelo: los ficheros de prueba CABEN (si no, se mediría el camino que ya funcionaba)', () => {
  for (const f of [NO_ES_IMAGEN, JPEG_PEQUENO, HEIC_PEQUENA, SOLO_SE_LLAMA_HEIC, ABRE_PERO_SIN_TAMANO]) {
    assert.ok(f._dataUrl.length < 1000, `${f.name} no es pequeño`);
  }
});

test('SCRUM-1425 · 🔴 un fichero PEQUEÑO que no es una imagen no se manda, y sale el aviso firmado', async () => {
  const r = await conLaFoto(NO_ES_IMAGEN);
  assert.deepEqual(altas(r), [], '🔴 el fichero viajó como justificante del gasto');
  assert.equal(r.pintado, AVISO_FOTO);
});

test('SCRUM-1425 · ✅ una imagen pequeña de verdad se manda TAL CUAL y sin aviso', async () => {
  const r = await conLaFoto(JPEG_PEQUENO);
  assert.equal(r.pintado, null, '🔴 una foto buena enseña un aviso: se ha roto el camino normal');
  assert.equal(altas(r).length, 1, '🔴 una foto buena ya no se guarda');
  assert.equal(altas(r)[0].cuerpo.receiptData, JPEG_PEQUENO._dataUrl, '🔴 la que cabía se ha recomprimido o cambiado');
});

test('SCRUM-1425 · lo que se abre sólo para mirarlo se suelta', async () => {
  const r = await conLaFoto(JPEG_PEQUENO);
  assert.equal(r.cerradas, 1);
});

test('SCRUM-1425 · ✅ una HEIC pequeña que este navegador no abre se sigue mandando (se reconoce por su cabecera)', async () => {
  const r = await conLaFoto(HEIC_PEQUENA);
  assert.equal(r.pintado, null, '🔴 una HEIC que hoy se guarda bien ahora se rechaza');
  assert.equal(altas(r).length, 1);
  assert.equal(altas(r)[0].cuerpo.receiptData, HEIC_PEQUENA._dataUrl);
});

test('SCRUM-1425 · 🔴 llamarse .heic y declararse image/heic no basta: sin cabecera HEIF no pasa', async () => {
  const r = await conLaFoto(SOLO_SE_LLAMA_HEIC);
  assert.deepEqual(altas(r), []);
  assert.equal(r.pintado, AVISO_FOTO);
});

test('SCRUM-1425 · 🔴 una que «abre» pero sin ancho ni alto tampoco es una foto', async () => {
  const r = await conLaFoto(ABRE_PERO_SIN_TAMANO);
  assert.deepEqual(altas(r), []);
  assert.equal(r.pintado, AVISO_FOTO);
});

test('SCRUM-1425 · «Leer el ticket» usa la misma puerta: lo que no es una imagen no sale hacia la lectura', async () => {
  const malo = await conLaFoto(NO_ES_IMAGEN, 'leer');
  assert.deepEqual(malo.enviados.filter((e) => /leer-ticket/.test(e.ruta)), [], '🔴 se mandó a leer algo que no es una foto');
  assert.equal(malo.pintado, AVISO_FOTO);
  const bueno = await conLaFoto(JPEG_PEQUENO, 'leer');
  const lecturas = bueno.enviados.filter((e) => /leer-ticket/.test(e.ruta));
  assert.equal(lecturas.length, 1, '🔴 una foto buena ya no se manda a leer');
  assert.equal(lecturas[0].cuerpo.imagen, JPEG_PEQUENO._dataUrl);
});
