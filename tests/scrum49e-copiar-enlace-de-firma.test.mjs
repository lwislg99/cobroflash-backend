// tests/scrum49e-copiar-enlace-de-firma.test.mjs — SCRUM-49e
//
// Cuando «Enviar para firmar» falla, el aviso dice «Copia el enlace y mándaselo por SMS o llámale»
// (`sendOutcome.ts`) y en la ficha del albarán no había nada que copiar. Desde SCRUM-49c la ficha trae
// `firmaToken`; aquí se exige que, tras el fallo, la barra compartida (`waFallbackBar`) ofrezca copiar
// `/albaran/<token>` y reintentar, y nada que no funcione.
//
// La ficha que está en pantalla puede ser de ANTES del primer envío (sin token): el banco la sirve así
// a propósito, y el token sólo aparece al releer, que es lo que pasa en el servidor (el envío lo
// escribe antes de llamar a Meta).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = 'f'.repeat(32);

const ALB = Object.freeze({
  id: 46, numero: 'AB260001', estado: 'emitido', modoValoracion: 'SIN_VALORAR', estadoFacturacion: 'sin_facturar',
  quote: null, invoiceId: null, job: { id: 76, titulo: 'Trabajo QA', direccion: null }, customer: { name: 'Cliente QA' },
  pendientes: [], lineas: [{ concepto: 'Tubería', cantidad: 2 }],
  enviadoParaFirma: false, entregaParaFirmar: { estado: 'nunca_enviado', fallo: null, at: null }, firmaToken: null,
});

const resp = (status, data) => ({
  ok: status < 300, status, statusText: String(status), headers: { get: () => 'application/json' },
  json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
});

/** Pinta la ficha, pulsa «Enviar para firmar» y devuelve lo que queda en el aviso. */
async function pulsarEnviar({ envio, tokenAlReleer }) {
  let lecturas = 0;
  const banco = cargarDashboard(RAIZ, {
    red: {
      fetch: async (url, opts = {}) => {
        const u = String(url);
        const metodo = (opts.method || 'GET').toUpperCase();
        if (/\/admin\/albaranes\/46\/enviar-para-firmar$/.test(u) && metodo === 'POST') return envio();
        if (/\/admin\/albaranes\/46$/.test(u) && metodo === 'GET') {
          lecturas += 1;
          return resp(200, { ...ALB, firmaToken: lecturas === 1 ? null : tokenAlReleer });
        }
        return resp(200, []);
      },
      navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    },
  });
  banco.ctx.appModoEmision = 'fiscal';
  const v = await pintarVista(banco, 'renderAlbaranDetailView', ALB.id);
  assert.ok(!v.error, `🔴 SUELO: la ficha no se pinta: ${v.error && v.error.message}`);
  const boton = todos(v.contenedor).find((n) => n.tagName === 'BUTTON' && n.dataset && n.dataset.accion === 'btnEnviarFirmar');
  assert.ok(boton, '🔴 SUELO: no está «Enviar para firmar»; sin pulsarlo no se mide nada');
  boton.click();
  for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0));
  const aviso = todos(v.contenedor).find((n) => typeof n.className === 'string' && n.className.split(' ').includes('alb-status'));
  const botones = aviso ? todos(aviso).filter((n) => n.tagName === 'BUTTON') : [];
  return { aviso, textos: botones.map((b) => b.textContent), botones };
}

const FALLO = () => resp(200, { sent: false, error: 'whatsapp_send_failed', message: 'No se pudo enviar por WhatsApp. Copia el enlace y mándaselo por SMS o llámale.' });

test('SCRUM-49e · 🔴 el envío falla y hay token al releer → se ofrece copiar el enlace de firma, y reintentar', async () => {
  const { aviso, textos } = await pulsarEnviar({ envio: FALLO, tokenAlReleer: TOKEN });
  assert.ok(aviso && /Copia el enlace/.test(aviso.textContent), `🔴 SUELO: el aviso del fallo no está: ${aviso && aviso.textContent}`);
  assert.ok(textos.includes('📋 Copiar enlace'), `🔴 el aviso pide copiar el enlace y no hay con qué: ${JSON.stringify(textos)}`);
  assert.ok(textos.includes('↻ Reintentar WhatsApp'), `🔴 falta el reintento: ${JSON.stringify(textos)}`);
});

test('SCRUM-49e · 🔴 en la barra del albarán no hay botón de email: el albarán no se envía por email', async () => {
  const { textos } = await pulsarEnviar({ envio: FALLO, tokenAlReleer: TOKEN });
  assert.ok(textos.includes('📋 Copiar enlace'), `🔴 SUELO: la barra no se ha pintado: ${JSON.stringify(textos)}`);
  assert.ok(!textos.some((t) => /email/i.test(t)),
    `🔴 la barra pinta un botón de email que no hace nada (waFallbackBar sin onEmail ni motivo): ${JSON.stringify(textos)}`);
});

test('SCRUM-49e · sin token al releer → no se pinta la barra (un enlace a ningún sitio es peor que ninguno)', async () => {
  const { aviso, textos } = await pulsarEnviar({ envio: FALLO, tokenAlReleer: null });
  assert.ok(aviso && /Copia el enlace/.test(aviso.textContent), '🔴 SUELO: el aviso del fallo no está');
  assert.deepEqual(textos, [], `🔴 sin token se pinta algo: ${JSON.stringify(textos)}`);
});

test('SCRUM-49e · el envío sale → no hay barra de fallo', async () => {
  const { textos } = await pulsarEnviar({ envio: () => resp(200, { sent: true }), tokenAlReleer: TOKEN });
  assert.ok(!textos.includes('📋 Copiar enlace'), `🔴 con el envío hecho se ofrece la barra de fallo: ${JSON.stringify(textos)}`);
});
