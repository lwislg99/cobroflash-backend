// tests/scrum1215c-pista-del-tecnico.test.mjs — SCRUM-1215 (lote 1, `pistaFirma`)
//
// El pad de firma tiene una pista bajo el título. La única que había habla del CLIENTE («Pide al
// cliente que firme con el dedo dentro del recuadro.») y además era el valor por defecto del pad.
// SCRUM-1229 se la quitó al técnico (`hint: null`): desde entonces el técnico firmaba SIN pista.
//
// FIRMADO (SCRUM-1215 comentario 18205): cuando firma el TÉCNICO, «Firma con el dedo dentro del
// recuadro.»; y ésa pasa a ser la pista por defecto del pad, que es cierta para cualquiera. La
// frase del cliente sólo sale en el camino del cliente — y como el ALBARÁN vivía del valor por
// defecto, ahora la pasa él.
//
// Se abre el pad de verdad desde las pantallas de verdad y se lee lo que pinta.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEL_CLIENTE = 'Pide al cliente que firme con el dedo dentro del recuadro.';
const NEUTRA = 'Firma con el dedo dentro del recuadro.';

const PARTE = {
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'REF-778',
  entrada: '09:15', salida: '12:45', desplazamientos: 1, kilometros: 12,
  tecnicos: ['Israel'], tipo: 'mantenimiento',
  lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión' }],
  notas: '', estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
};
const ALBARAN = {
  id: 11, numero: 'AB260011', estado: 'emitido', modoValoracion: 'SIN_VALORAR', estadoFacturacion: 'sin_facturar',
  quote: null, invoiceId: null, job: { id: 1, titulo: 'Reforma baño' }, customer: { name: 'Ana Ruiz' },
  lineas: [{ concepto: 'Tubería', cantidad: 2 }],
};

function montar() {
  const responder = (cuerpo) => ({
    ok: true, status: 200, statusText: '200', headers: { get: () => 'application/json' },
    json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
  });
  const fetch = async (url) => {
    const u = String(url);
    if (/\/admin\/partes\/7$/.test(u)) return responder(PARTE);
    if (/\/admin\/albaranes\/11$/.test(u)) return responder(ALBARAN);
    return responder({});
  };
  const banco = cargarDashboard(RAIZ, {
    red: { fetch, navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } } },
  });
  // El banco no sabe de `<canvas>` (mismo parche acotado que SCRUM-466 y SCRUM-1229).
  const crear = banco.ctx.document.createElement;
  banco.ctx.document.createElement = function (tag) {
    const n = crear.call(this, tag);
    if (String(tag).toLowerCase() === 'canvas') {
      n.getContext = () => ({
        scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, clearRect() {},
        set strokeStyle(_) {}, set lineWidth(_) {}, set lineCap(_) {}, set lineJoin(_) {},
      });
      n.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 190 });
      n.setPointerCapture = () => {};
    }
    return n;
  };
  const w = banco.ctx.window;
  // La cola en memoria: el banco no tiene IndexedDB, y el albarán la consulta antes de abrir el pad.
  w.leerFirmasPendientes = async () => ({ estado: w.GUARDADO, firmas: [] });
  return banco;
}

const esperar = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

/** El texto del pad abierto (el último `role=dialog` del cuerpo), o `null` si no hay ninguno. */
function textoDelPad(banco) {
  const pads = todos(banco.ctx.document.body).filter((n) => n.getAttribute && n.getAttribute('role') === 'dialog');
  const pad = pads[pads.length - 1];
  return pad ? { titulo: pad.getAttribute('aria-label'), texto: todos(pad).map((n) => `${n.textContent || ''} ${n.innerHTML || ''}`).join(' ') } : null;
}

async function padDelParte(selector) {
  const banco = montar();
  const contenedor = banco.mk('div');
  banco.ctx.document.body.appendChild(contenedor);
  assert.equal(await banco.ctx.window.renderParteDetailView(contenedor, 7), true, '🔴 CIEGO: la ficha del parte no se pintó');
  const boton = contenedor.querySelector(selector);
  assert.ok(boton, '🔴 CIEGO: no está el botón de firma ' + selector);
  boton.click();
  await esperar();
  const pad = textoDelPad(banco);
  assert.ok(pad, '🔴 CIEGO: el pad no se abrió');
  return pad;
}

test('SCRUM-1215c · el pad del TÉCNICO dice «Firma con el dedo dentro del recuadro.»', async () => {
  const pad = await padDelParte('[data-parte-firmar-tecnico]');
  assert.equal(pad.titulo, 'Firma del técnico', '🔴 CIEGO: este no es el pad del técnico');
  assert.ok(pad.texto.includes(NEUTRA), '🔴 el técnico firma sin pista');
  assert.ok(!pad.texto.includes('Pide al cliente'), '🔴 al técnico se le dice «Pide al cliente…»');
});

test('SCRUM-1215c · el pad del CLIENTE en el parte sigue diciendo su frase', async () => {
  const pad = await padDelParte('[data-parte-firmar]');
  assert.equal(pad.titulo, 'Firma del cliente', '🔴 CIEGO: este no es el pad del cliente');
  assert.ok(pad.texto.includes(DEL_CLIENTE), '🔴 el cliente ha perdido su pista en el parte');
});

test('SCRUM-1215c · el pad del ALBARÁN sigue diciendo la frase del cliente, y ya no por defecto', async () => {
  const banco = montar();
  const v = await pintarVista(banco, 'renderAlbaranDetailView', 11);
  assert.ok(!v.error, `🔴 CIEGO: la ficha del albarán no se pinta: ${v.error && v.error.message}`);
  const boton = todos(v.contenedor).find((n) => n.tagName === 'BUTTON' && n.dataset && n.dataset.accion === 'btnFirmarAqui');
  assert.ok(boton, '🔴 CIEGO: un albarán emitido no ofrece «Firmar aquí mismo»');
  boton.click();
  await esperar();
  const pad = textoDelPad(banco);
  assert.ok(pad, '🔴 CIEGO: el pad del albarán no se abrió');
  assert.ok(pad.texto.includes(DEL_CLIENTE),
    '🔴 el albarán vivía de la pista por defecto del pad; al cambiarla ha perdido la suya');
});

test('SCRUM-1215c · el pad, sin que nadie le pase pista, pone la neutra y no la del cliente', () => {
  const banco = montar();
  banco.ctx.window.openSignaturePad({ title: 'Firma de prueba', onConfirm() {} });
  const pad = textoDelPad(banco);
  assert.equal(pad && pad.titulo, 'Firma de prueba', '🔴 CIEGO: el pad no se abrió');
  assert.ok(pad.texto.includes(NEUTRA), '🔴 la pista por defecto del pad no es la neutra');
  assert.ok(!pad.texto.includes('Pide al cliente'), '🔴 la pista por defecto sigue hablando del cliente');
});

test('SCRUM-1215c · `hint: null` sigue siendo «sin pista» (SCRUM-1229)', () => {
  const banco = montar();
  banco.ctx.window.openSignaturePad({ title: 'Firma de prueba', hint: null, onConfirm() {} });
  const pad = textoDelPad(banco);
  assert.equal(pad && pad.titulo, 'Firma de prueba', '🔴 CIEGO: el pad no se abrió');
  assert.ok(!pad.texto.includes('dentro del recuadro'), '🔴 con `hint: null` el pad pinta una pista');
});
