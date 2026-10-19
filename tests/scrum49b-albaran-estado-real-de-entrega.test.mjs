// tests/scrum49b-albaran-estado-real-de-entrega.test.mjs — SCRUM-49b
//
// 🔴 «ENVIADO PARA FIRMAR» SIN QUE EL WHATSAPP LLEGARA.
//
// `GET /admin/albaranes/:id` decía `enviadoParaFirma: true` con sólo mirar `enviadoParaFirmaAt`, que
// se escribe ANTES de llamar a Meta. El 18-oct-2026 el fundador pulsó dos veces, las dos filas de
// `whatsapp_messages` quedaron `failed` y la ficha seguía diciendo «enviado». Ahora la ruta devuelve
// además `entregaParaFirmar`, leído de esas filas.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// La app REAL (`_banco-camino-real.mjs`) por HTTP. ⚠️ El doble de `whatsAppMessage.findFirst`
// HONRA el `where` (merchant, documento y plantilla), el `orderBy` y el `select`: si la ruta dejara
// de filtrar por la plantilla, o leyera filas de otro comercio, el doble se las daría y el caso cae.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';

const app = await montarAppReal();
after(() => app.cerrar());
const M = 49;
const ses = sesionesDe(M, { id: 9, role: 'tecnico', merchantId: M });

const PARA_FIRMAR = 'albaran_para_firmar_es';
const FIRMADO = 'albaran_firmado_es';
const MARCA = new Date('2026-10-18T10:00:00Z');

const ALBARAN = {
  id: 7, merchantId: M, jobId: 70, numero: 'A-0007', fecha: new Date('2026-10-18T00:00:00Z'),
  modoValoracion: 'SIN_VALORAR', lineas: [], estado: 'emitido', version: 1, firmadoAt: null,
  notas: null, invoiceId: null, firmaToken: 'f'.repeat(32),
};

let fila = 0;
const wa = (extra) => ({
  id: ++fila, merchantId: M, relatedType: 'albaran', relatedId: ALBARAN.id, templateName: PARA_FIRMAR,
  status: 'sent', waMessageId: null, createdAt: new Date(MARCA.getTime() + fila * 1000),
  updatedAt: new Date(MARCA.getTime() + fila * 1000), ...extra,
});

/** Lo que haría Postgres: filtra por igualdad, ordena por `createdAt` y `id` descendentes, proyecta. */
function primeraQueCasa(filas, a) {
  const casa = (f) => Object.entries(a?.where ?? {}).every(([k, v]) => f[k] === v);
  const orden = [...filas.filter(casa)].sort((x, y) => (y.createdAt - x.createdAt) || (y.id - x.id));
  const f = orden[0];
  if (!f) return null;
  return a?.select ? Object.fromEntries(Object.keys(a.select).filter((k) => a.select[k]).map((k) => [k, f[k]])) : f;
}

async function ficha({ enviadoParaFirmaAt = MARCA, filas = [], lecturaRota = false } = {}) {
  const llamadas = [];
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => ({ ...ses.merchant, country: 'ES', email: 'qa49@test.local', flags: null }) },
    albaran: { findFirst: async () => ({ ...ALBARAN, enviadoParaFirmaAt }) },
    job: { findFirst: async () => ({ id: 70, titulo: 'T', direccion: null, customerId: null, quoteId: null, operarioId: null, assignedUserId: null, assignees: [] }) },
    whatsAppMessage: {
      findFirst: async (a) => {
        llamadas.push(a);
        if (lecturaRota) throw new Error('conexión perdida');
        return primeraQueCasa(filas, a);
      },
    },
  });
  const r = await app.pedir(`/admin/albaranes/${ALBARAN.id}`, { token: ses.PROPIETARIO });
  assert.equal(r.status, 200, `suelo: la ficha no respondió 200 (${r.status} ${r.texto?.slice(0, 200)})`);
  return { e: r.json.entregaParaFirmar, enviadoParaFirma: r.json.enviadoParaFirma, llamadas };
}

test('SCRUM-49b · 🔴 el caso del 18-oct: dos intentos fallidos en el acto → «fallido», aunque `enviadoParaFirma` siga en true', async () => {
  const { e, enviadoParaFirma } = await ficha({
    filas: [wa({ status: 'failed', error: 'not_configured' }), wa({ status: 'failed', error: 'not_configured' })],
  });
  assert.equal(enviadoParaFirma, true, 'suelo: la marca de intento sigue como estaba (S4 decide qué pinta)');
  assert.equal(e?.estado, 'fallido', `🔴 la ficha no dice que el envío falló: ${JSON.stringify(e)}`);
  assert.equal(e.fallo, 'en_el_acto');
});

test('SCRUM-49b · Meta lo aceptó y luego avisó del fallo (131026) → fallido «después»', async () => {
  const { e } = await ficha({ filas: [wa({ status: 'failed', waMessageId: 'wamid.X', error: '131026' })] });
  assert.deepEqual([e.estado, e.fallo], ['fallido', 'despues']);
});

test('SCRUM-49b · aceptado sin confirmar, y entregado', async () => {
  assert.equal((await ficha({ filas: [wa({ status: 'sent', waMessageId: 'wamid.S' })] })).e.estado, 'aceptado');
  assert.equal((await ficha({ filas: [wa({ status: 'delivered', waMessageId: 'wamid.D' })] })).e.estado, 'entregado');
  assert.equal((await ficha({ filas: [wa({ status: 'read', waMessageId: 'wamid.R' })] })).e.estado, 'entregado');
});

test('SCRUM-49b · manda el ÚLTIMO intento: uno viejo entregado y uno nuevo fallido → fallido', async () => {
  const { e } = await ficha({ filas: [wa({ status: 'delivered', waMessageId: 'wamid.V' }), wa({ status: 'failed' })] });
  assert.equal(e.estado, 'fallido');
});

test('SCRUM-49b · 🔴 la copia FIRMADA entregada no cuenta como el envío para firmar', async () => {
  const { e, llamadas } = await ficha({ filas: [wa({ status: 'delivered', waMessageId: 'wamid.F', templateName: FIRMADO })] });
  assert.equal(e.estado, 'sin_rastro', `🔴 una entrega de OTRO envío del albarán se cuenta como ésta: ${JSON.stringify(e)}`);
  assert.equal(llamadas[0]?.where?.templateName, PARA_FIRMAR, 'la lectura filtra por la plantilla del envío para firmar');
});

test('SCRUM-49b · 🔴 una fila de OTRO comercio no se ve', async () => {
  const { e, llamadas } = await ficha({ filas: [wa({ status: 'delivered', waMessageId: 'wamid.O', merchantId: M + 1 })] });
  assert.equal(e.estado, 'sin_rastro');
  assert.equal(llamadas[0]?.where?.merchantId, M);
});

test('SCRUM-49b · nunca enviado: estado propio y sin consulta', async () => {
  const { e, llamadas } = await ficha({ enviadoParaFirmaAt: null, filas: [wa({ status: 'delivered' })] });
  assert.equal(e.estado, 'nunca_enviado');
  assert.equal(llamadas.length, 0, 'sin marca de envío no hay nada que leer');
});

test('SCRUM-49b · 🔴 «no pude leer» NO es «no hay nada»: la lectura rota tiene su estado y la ficha sigue', async () => {
  const { e } = await ficha({ lecturaRota: true });
  assert.equal(e.estado, 'no_se_pudo_leer');
});
