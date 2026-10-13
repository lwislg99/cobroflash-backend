// SCRUM-1302j · DOS FIRMAS A LA VEZ SOBRE EL MISMO PARTE: ESCRIBE UNA
//
// `POST /albaran/:token/firmar` leía el parte, comprobaba que estaba `emitido` y escribía la firma
// con `where: { id }`. Leer y escribir no es una sola operación: dos peticiones a la vez leían las
// dos `emitido` y escribían las dos. Medido por S4 corriendo la ruta real (SCRUM-1302d,
// `docs/master/evidencias/SCRUM-1302/reintento-de-firma/`, caso 2): 2 escrituras, 2 PDF, 2 copias
// pedidas, y en el parte quedaba el SEGUNDO trazo y el segundo nombre. La firma de una persona,
// sustituida por otra escritura en un documento firmado.
//
// El arreglo es el de SCRUM-1276 en el presupuesto: el estado LEÍDO va en el `where` del `update`.
// Y la versión leída también: es la misma ventana que SCRUM-361 cerró a medias (si el profesional
// corrige el parte entre la lectura y la escritura, el cliente sellaba un contenido que no vio).
//
// El doble es FIEL AL `where`: si una clave no casa con la fila, lanza P2025 como Prisma. Un doble
// que escribe siempre no ve este arreglo (ni su ausencia).
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

const RUTA = '../dist/modules/jobs/app/routes/albaranPublic.routes.js';
const TOKEN = 'c'.repeat(32);
const TRABAJO = 9;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const trazo = (quien) => `data:image/png;base64,${Buffer.from(`trazo de ${quien}`).toString('base64')}`;

const parteEmitido = () => ({
  id: 440, merchantId: MERCHANT, jobId: TRABAJO, numero: 'ALB-2026-0440', fecha: new Date('2026-10-13T08:00:00Z'),
  estado: 'emitido', version: 3, firmaToken: TOKEN, modoValoracion: 'SIN_VALORAR', lineas: [], notas: null,
  lugarEntrega: null, signatureUrl: null, firmadoAt: null, firmadoPorNombre: null, firmadoPorCalidad: null,
  evidenciaFirma: null, pdfUrl: null,
});

// Un solo banco para todo el fichero: los módulos de `dist/` capturan el doble al cargarse.
const banco = { fila: parteEmitido(), lecturaLenta: 0, alLeerPorToken: null, firmas: [], rechazadas: 0, copiasPedidas: 0 };
inyectarBase({
  'albaran.findUnique': async ({ where }) => {
    if (where.firmaToken === TOKEN) {
      const foto = structuredClone(banco.fila);
      if (banco.alLeerPorToken) banco.alLeerPorToken(banco.fila); // lo que pasa JUSTO después de leer
      await esperar(banco.lecturaLenta);
      return foto;
    }
    return where.id === banco.fila.id ? structuredClone(banco.fila) : null;
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
  // La copia firmada: `sendAlbaranFirmadoWhatsApp` es quien pide el Trabajo con su `titulo` (el PDF
  // pide otro `findFirst`, con `quoteId`). Sin teléfono no sale nada; aquí se cuenta que se PIDIÓ.
  'job.findFirst': ({ select }) => {
    if (select?.titulo) banco.copiasPedidas += 1;
    return { id: TRABAJO, customerId: CLIENTE, titulo: 'Cambio de caldera', quoteId: null };
  },
  'customer.findFirst': () => null,
  'customer.findUnique': () => ({ id: CLIENTE, name: 'Cliente 1302', legalName: null, taxId: null }),
  'merchant.findUnique': () => ({ id: MERCHANT, name: 'Fontanería 1302', legalName: null, taxId: null }),
}, [RUTA]);

const router = moduloDeDist(RUTA).default;
const capa = router.stack.find((l) => l.route && l.route.path === '/:token/firmar' && l.route.methods.post);
assert.ok(capa, '🔴 CIEGO: no encuentro POST /:token/firmar en la ruta pública del parte');
const manejador = capa.route.stack[capa.route.stack.length - 1].handle;

function preparar({ lecturaLenta = 0, alLeerPorToken = null } = {}) {
  Object.assign(banco, { fila: parteEmitido(), lecturaLenta, alLeerPorToken, firmas: [], rechazadas: 0, copiasPedidas: 0 });
}

/** Una petición de firma, por el manejador real. La versión que manda es la que «vio»: la 3. */
async function firmar(quien, version = 3) {
  const r = { status: 200, body: undefined };
  const res = { status(s) { r.status = s; return res; }, json(j) { r.body = structuredClone(j); return res; }, setHeader() { return res; } };
  const deVerdad = console.error; console.error = () => {};
  try {
    await manejador({
      params: { token: TOKEN }, headers: { 'user-agent': 'test' }, ip: '127.0.0.1', socket: {},
      body: { version, signatureData: trazo(quien), firmadoPorNombre: quien, firmadoPorCalidad: '', firmadoPorCalidadOtro: '' },
    }, res);
    await esperar(60); // el PDF y la copia son posteriores a la respuesta o no la esperan
  } finally { console.error = deVerdad; }
  return r;
}

test('SCRUM-1302j · SUELO: una sola firma sobre un parte emitido se guarda, y se pide UNA copia', async () => {
  preparar();
  const r = await firmar('Ana');
  assert.equal(r.status, 200, `🔴 CIEGO: el caso sano responde ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.already, undefined, 'la firma que entra no es un «ya estaba»');
  assert.deepEqual(banco.firmas, [{ trazo: trazo('Ana'), nombre: 'Ana' }]);
  assert.equal(banco.fila.estado, 'firmado');
  assert.equal(banco.copiasPedidas, 1, '🔴 CIEGO: el banco no llega a pedir la copia firmada');
});

test('SCRUM-1302j · 🔴 DOS A LA VEZ: escribe UNA, queda SU trazo y SU nombre, y la otra no repite nada', async () => {
  preparar({ lecturaLenta: 20 }); // las dos LEEN `emitido` antes de que ninguna escriba
  const [a, b] = await Promise.all([firmar('Ana'), firmar('Blas')]);
  assert.deepEqual([a.status, b.status], [200, 200]);
  assert.equal(banco.firmas.length, 1, `🔴 las dos peticiones han escrito la firma: ${banco.firmas.map((f) => f.nombre).join(' y después ')}`);
  const [ganadora] = banco.firmas;
  assert.equal(banco.fila.signatureUrl, ganadora.trazo, '🔴 el trazo que queda no es el de quien escribió');
  assert.equal(banco.fila.firmadoPorNombre, ganadora.nombre);
  assert.equal(banco.rechazadas, 1, 'la que llega tarde choca con el estado del `where`');
  const yaEstaba = [a, b].filter((r) => r.body.already === true);
  assert.equal(yaEstaba.length, 1, `🔴 la que no escribió tiene que contestar lo mismo que un parte ya firmado: ${JSON.stringify([a.body, b.body])}`);
  assert.equal(yaEstaba[0].body.portalUrl, undefined, 'el enlace del portal es de un solo uso: sólo en la firma que entra (SCRUM-967b)');
  assert.equal(banco.copiasPedidas, 1, '🔴 la copia firmada se ha pedido dos veces');
});

test('SCRUM-1302j · 🔴 el parte CAMBIA entre la lectura y la escritura: no se sella lo que el cliente no vio', async () => {
  // El profesional guarda una corrección justo después de que la firma lea el parte: versión 3 → 4.
  preparar({ alLeerPorToken: (fila) => { if (fila.version === 3) fila.version = 4; } });
  const r = await firmar('Ana');
  assert.equal(banco.firmas.length, 0, '🔴 se ha sellado la firma sobre una versión que el cliente no vio');
  assert.equal(banco.fila.estado, 'emitido');
  assert.equal(r.status, 409, `🔴 responde ${r.status} ${JSON.stringify(r.body)}`);
  const { puedeFirmarEstaVersion } = moduloDeDist('../dist/modules/jobs/domain/albaranFirmante.js');
  const esperado = puedeFirmarEstaVersion(3, 4);
  assert.equal(esperado.ok, false, '🔴 CIEGO: la regla de SCRUM-361 no distingue la 3 de la 4');
  assert.deepEqual(r.body, { error: esperado.error, message: esperado.message }, 'la respuesta es la de SCRUM-361, sin texto nuevo');
  assert.equal(banco.copiasPedidas, 0);
});

test('SCRUM-1302j · control: sobre un parte YA firmado, la respuesta de siempre y cero escrituras', async () => {
  preparar();
  await firmar('Ana');
  const firmasAntes = banco.firmas.length;
  const r = await firmar('Blas');
  assert.deepEqual(r.body, { ok: true, already: true });
  assert.equal(banco.firmas.length, firmasAntes);
  assert.equal(banco.fila.firmadoPorNombre, 'Ana');
});
