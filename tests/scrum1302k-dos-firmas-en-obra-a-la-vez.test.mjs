// SCRUM-1302k · DOS FIRMAS EN OBRA A LA VEZ SOBRE EL MISMO ALBARÁN: ESCRIBE UNA
//
// Es el gemelo de SCRUM-1302j, en la otra puerta: `POST /admin/albaranes/:id/firmar`, la firma del
// cliente en el móvil del profesional. Leía el albarán, comprobaba que estaba `emitido` y escribía
// con `where: { id }`. Leer y escribir no es una sola operación, y aquí la segunda petición no hace
// falta imaginarla: la firma en obra se reintenta sola (`firmarConRedDeSeguridad`) y la cola de
// firmas sin cobertura la vuelve a subir al recuperar la red.
//
// El arreglo es el mismo: el estado LEÍDO va en el `where`. Quien llega tarde se contesta con lo
// que esta ruta ya contestaba sobre un albarán firmado (409 `albaran_locked`), sin PDF nuevo.
//
// El doble es FIEL AL `where`: si una clave no casa con la fila, lanza P2025 como Prisma. Un doble
// que escribe siempre no ve este arreglo (ni su ausencia).
import test from 'node:test';
import assert from 'node:assert/strict';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

const RUTA = '../dist/modules/jobs/app/routes/albaranes.routes.js';
const TRABAJO = 9;
const ID = 441;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const trazo = (quien) => `data:image/png;base64,${Buffer.from(`trazo de ${quien}`).toString('base64')}`;

const albaranEmitido = () => ({
  id: ID, merchantId: MERCHANT, jobId: TRABAJO, numero: 'ALB-2026-0441', fecha: new Date('2026-10-13T08:00:00Z'),
  estado: 'emitido', version: 3, firmaToken: null, modoValoracion: 'SIN_VALORAR', lineas: [], notas: null,
  lugarEntrega: null, signatureUrl: null, firmadoAt: null, firmadoPorNombre: null, firmadoPorCalidad: null,
  evidenciaFirma: null, pdfUrl: null,
});

// Un solo banco para todo el fichero: los módulos de `dist/` capturan el doble al cargarse.
const banco = { fila: albaranEmitido(), lecturaLenta: 0, firmas: [], rechazadas: 0, pdfPedidos: 0 };
inyectarBase({
  // `findAlbaran`, la lectura de la ruta: por id Y por merchant (tenancy).
  'albaran.findFirst': async ({ where }) => {
    if (where.id !== banco.fila.id || where.merchantId !== banco.fila.merchantId) return null;
    const foto = structuredClone(banco.fila);
    await esperar(banco.lecturaLenta);
    return foto;
  },
  // `ensureAlbaranPdf` relee el albarán por id: se cuenta que se PIDIÓ el PDF.
  'albaran.findUnique': ({ where }) => {
    if (where.id !== banco.fila.id) return null;
    banco.pdfPedidos += 1;
    return structuredClone(banco.fila);
  },
  'albaran.update': ({ where, data }) => {
    for (const [clave, valor] of Object.entries(where)) {
      if (banco.fila[clave] !== valor) {
        banco.rechazadas += 1;
        throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
      }
    }
    // Sólo cuenta la escritura de la FIRMA: el PDF también escribe (`pdfUrl`) y no es de este test.
    if ('signatureUrl' in data) banco.firmas.push({ trazo: data.signatureUrl, nombre: data.firmadoPorNombre });
    Object.assign(banco.fila, data);
    return structuredClone(banco.fila);
  },
  'job.findUnique': () => ({ id: TRABAJO, customerId: CLIENTE, titulo: 'Cambio de caldera', direccion: null, merchantId: MERCHANT }),
  'job.findFirst': () => ({ id: TRABAJO, customerId: CLIENTE, titulo: 'Cambio de caldera', quoteId: null }),
  'customer.findFirst': () => null,
  'customer.findUnique': () => ({ id: CLIENTE, name: 'Cliente 1302', legalName: null, taxId: null }),
  'merchant.findUnique': () => ({ id: MERCHANT, name: 'Fontanería 1302', legalName: null, taxId: null }),
}, [RUTA]);

const router = moduloDeDist(RUTA).default;
const capa = router.stack.find((l) => l.route && l.route.path === '/:id/firmar' && l.route.methods.post);
assert.ok(capa, '🔴 CIEGO: no encuentro POST /:id/firmar en la ruta de albaranes');
const manejador = capa.route.stack[capa.route.stack.length - 1].handle;

function preparar({ lecturaLenta = 0 } = {}) {
  Object.assign(banco, { fila: albaranEmitido(), lecturaLenta, firmas: [], rechazadas: 0, pdfPedidos: 0 });
}

/** Una petición de firma en obra, por el manejador real, con la sesión de un administrador. */
async function firmar(quien) {
  const r = { status: 200, body: undefined };
  const res = { status(s) { r.status = s; return res; }, json(j) { r.body = structuredClone(j); return res; }, setHeader() { return res; } };
  const deVerdad = console.error; console.error = () => {};
  try {
    await manejador(reqDeSesion({
      rol: 'admin', params: { id: String(ID) }, merchantId: MERCHANT, teamMemberId: null,
      headers: { 'user-agent': 'test' }, ip: '127.0.0.1', socket: {},
      body: { signatureData: trazo(quien), firmadoPorNombre: quien, firmadoPorCalidad: '', firmadoPorCalidadOtro: '' },
    }), res);
  } finally { console.error = deVerdad; }
  return r;
}

test('SCRUM-1302k · SUELO: una sola firma en obra sobre un albarán emitido se guarda', async () => {
  preparar();
  const r = await firmar('Ana');
  assert.equal(r.status, 200, `🔴 CIEGO: el caso sano responde ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(r.body.estado, 'firmado');
  assert.deepEqual(banco.firmas, [{ trazo: trazo('Ana'), nombre: 'Ana' }]);
  assert.equal(banco.fila.estado, 'firmado');
  assert.ok(banco.pdfPedidos >= 1, '🔴 CIEGO: el banco no llega a pedir el PDF con la firma');
});

test('SCRUM-1302k · 🔴 DOS A LA VEZ: escribe UNA, queda SU trazo y SU nombre, y la otra no repite el PDF', async () => {
  preparar({ lecturaLenta: 20 }); // las dos LEEN `emitido` antes de que ninguna escriba
  const [a, b] = await Promise.all([firmar('Ana'), firmar('Blas')]);
  assert.equal(banco.firmas.length, 1, `🔴 las dos peticiones han escrito la firma: ${banco.firmas.map((f) => f.nombre).join(' y después ')}`);
  const [ganadora] = banco.firmas;
  assert.equal(banco.fila.signatureUrl, ganadora.trazo, '🔴 el trazo que queda no es el de quien escribió');
  assert.equal(banco.fila.firmadoPorNombre, ganadora.nombre);
  assert.equal(banco.rechazadas, 1, 'la que llega tarde choca con el estado del `where`');
  assert.deepEqual([a.status, b.status].sort(), [200, 409], `🔴 una entra y la otra se contesta como un albarán ya firmado: ${JSON.stringify([a, b])}`);
  const tarde = [a, b].find((r) => r.status === 409);
  // La respuesta de siempre de esta ruta sobre un albarán firmado: ningún texto nuevo.
  assert.deepEqual(tarde.body, { error: 'albaran_locked', message: 'Este albarán ya está firmado.' });
  assert.equal(banco.pdfPedidos, 1, '🔴 el PDF con la firma se ha regenerado dos veces');
});

test('SCRUM-1302k · control: sobre un albarán YA firmado, la respuesta de siempre y cero escrituras', async () => {
  preparar();
  await firmar('Ana');
  const firmasAntes = banco.firmas.length;
  const r = await firmar('Blas');
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { error: 'albaran_locked', message: 'Este albarán ya está firmado.' });
  assert.equal(banco.firmas.length, firmasAntes);
  assert.equal(banco.fila.firmadoPorNombre, 'Ana');
});
