// tests/scrum49d-pildora-solo-si-llego.test.mjs — SCRUM-49d
//
// La ficha del albarán pintaba «enviado para firmar» con `enviadoParaFirma`, que sale de
// `enviadoParaFirmaAt`, y esa marca se escribe ANTES de llamar a Meta. Medido el 19-oct-2026 en
// yaqu.app (cuenta QA, albarán #46): `entregaParaFirmar = { estado: 'fallido', fallo: 'en_el_acto' }`
// y la píldora salía igual. Desde SCRUM-49b el servidor dice lo que pasó de verdad; aquí se exige
// que la píldora sólo salga cuando Meta lo aceptó o lo entregó.
//
// Sin texto nuevo: el caso que no llegó NO pinta nada. Quitar una afirmación falsa no necesita firma.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const BASE = Object.freeze({
  id: 46, numero: 'AB260001', estado: 'emitido', modoValoracion: 'SIN_VALORAR', estadoFacturacion: 'sin_facturar',
  quote: null, invoiceId: null, job: { id: 76, titulo: 'Trabajo QA', direccion: null }, customer: { name: 'Cliente QA' },
  pendientes: [], lineas: [{ concepto: 'Tubería', cantidad: 2 }],
  enviadoParaFirma: true, firmaToken: 'a'.repeat(32),
});

function red(alb) {
  const resp = (status, data) => ({
    ok: status < 300, status, statusText: String(status), headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async (url) => (/\/admin\/albaranes\/46$/.test(String(url)) ? resp(200, alb) : resp(200, [])),
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}

async function pildoras(alb) {
  const banco = cargarDashboard(RAIZ, { red: red(alb) });
  banco.ctx.appModoEmision = 'fiscal';
  const v = await pintarVista(banco, 'renderAlbaranDetailView', alb.id);
  assert.ok(!v.error, `🔴 SUELO: la ficha no se pinta: ${v.error && v.error.message}`);
  const textos = todos(v.contenedor)
    .filter((n) => typeof n.className === 'string' && n.className.split(' ').includes('status-pill'))
    .map((n) => n.textContent);
  // SUELO: la píldora del ESTADO sale siempre. Sin ella, «no hay píldora de enviado» no probaría nada.
  assert.ok(textos.includes(alb.estado), `🔴 SUELO: no encuentro la píldora del estado; vi ${JSON.stringify(textos)}`);
  return textos;
}

const entrega = (estado, fallo = null) => ({ estado, fallo, at: estado === 'nunca_enviado' ? null : '2026-10-18T18:09:53.752Z' });

for (const estado of ['entregado', 'aceptado']) {
  test(`SCRUM-49d · «${estado}» → la píldora «enviado para firmar» SÍ sale`, async () => {
    const t = await pildoras({ ...BASE, entregaParaFirmar: entrega(estado) });
    assert.ok(t.includes('enviado para firmar'), `🔴 Meta lo ${estado === 'entregado' ? 'entregó' : 'aceptó'} y la píldora no sale: ${JSON.stringify(t)}`);
  });
}

const NO_SE_AFIRMA = [
  ['fallido en el acto (el #46 del 18-oct)', entrega('fallido', 'en_el_acto')],
  ['fallido después (131026 por el webhook)', entrega('fallido', 'despues')],
  ['sin rastro', entrega('sin_rastro')],
  ['no se pudo leer', entrega('no_se_pudo_leer')],
  ['el servidor no trae `entregaParaFirmar`', undefined],
];
for (const [caso, e] of NO_SE_AFIRMA) {
  test(`SCRUM-49d · 🔴 ${caso} → la píldora NO sale aunque \`enviadoParaFirma\` sea true`, async () => {
    const alb = { ...BASE };
    if (e !== undefined) alb.entregaParaFirmar = e;
    const t = await pildoras(alb);
    assert.ok(!t.includes('enviado para firmar'), `🔴 la ficha afirma «enviado para firmar» con ${caso}: ${JSON.stringify(t)}`);
  });
}

test('SCRUM-49d · sin intento (`enviadoParaFirma` false) no sale aunque llegue un «entregado»', async () => {
  const t = await pildoras({ ...BASE, estado: 'firmado', enviadoParaFirma: false, entregaParaFirmar: entrega('entregado') });
  assert.ok(!t.includes('enviado para firmar'), `🔴 sale con un albarán que ya no espera firma: ${JSON.stringify(t)}`);
});
