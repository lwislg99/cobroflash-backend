// SCRUM-1302o · LA FIRMA EN OBRA SÓLO SE ESCRIBE SOBRE LA VERSIÓN QUE SE LEYÓ
//
// SCRUM-1302k metió el ESTADO leído en el `where` de `POST /admin/albaranes/:id/firmar` y dejó
// declarada la otra mitad: la VERSIÓN no iba. La ruta lee el albarán, sella la evidencia sobre lo
// leído (`buildFirmaEvidencia`) y después escribe. Si alguien del equipo edita el albarán en medio
// —el `PATCH` sube `version`—, con `where: { id, estado }` la escritura entraba igual: la evidencia
// sellaba el contenido VIEJO y la fila guardaba el EDITADO. Una firma que no casa con su documento.
//
// El arreglo es el de la firma remota (SCRUM-1302j): la versión leída también va en el `where`, y
// quien choca con ella recibe el texto aprobado en SCRUM-1302 c.19467, sin PDF nuevo.
//
// El doble es FIEL AL `where`: si una clave no casa con la fila, lanza P2025 como Prisma.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

const RUTA = '../dist/modules/jobs/app/routes/albaranes.routes.js';
const TRABAJO = 9;
const ID = 442;
const AVISO = 'El albarán ha cambiado mientras lo firmabas. Vuelve a abrirlo para firmar la versión actual.';
const trazo = (quien) => `data:image/png;base64,${Buffer.from(`trazo de ${quien}`).toString('base64')}`;

const albaranEmitido = () => ({
  id: ID, merchantId: MERCHANT, jobId: TRABAJO, numero: 'ALB-2026-0442', fecha: new Date('2026-10-14T08:00:00Z'),
  estado: 'emitido', version: 3, firmaToken: null, modoValoracion: 'SIN_VALORAR', lineas: [], notas: 'Lo que vio el cliente',
  lugarEntrega: null, signatureUrl: null, firmadoAt: null, firmadoPorNombre: null, firmadoPorCalidad: null,
  evidenciaFirma: null, pdfUrl: null,
});

// Un solo banco para todo el fichero: los módulos de `dist/` capturan el doble al cargarse.
const banco = { fila: albaranEmitido(), editarTrasLeer: null, lecturas: 0, firmas: [], ediciones: [], rechazadas: 0, pdfPedidos: 0 };
inyectarBase({
  // `findAlbaran`, la lectura de la ruta. Tras la PRIMERA lectura, si el caso lo pide, alguien edita
  // el albarán: es la edición que entra entre la lectura y la escritura de la firma.
  'albaran.findFirst': async ({ where }) => {
    if (where.id !== banco.fila.id || where.merchantId !== banco.fila.merchantId) return null;
    const foto = structuredClone(banco.fila);
    banco.lecturas += 1;
    if (banco.lecturas === 1 && banco.editarTrasLeer) { banco.editarTrasLeer(banco.fila); banco.enMedio = true; }
    return foto;
  },
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
    if ('notas' in data && !('signatureUrl' in data)) banco.ediciones.push({ notas: data.notas, sobreEstado: banco.fila.estado });
    if ('signatureUrl' in data) banco.firmas.push({ nombre: data.firmadoPorNombre, evidencia: data.evidenciaFirma, notas: banco.fila.notas });
    // El PATCH escribe `version: { increment: 1 }`: se aplica como Prisma, no se copia el objeto.
    for (const [clave, valor] of Object.entries(data)) {
      banco.fila[clave] = valor && typeof valor === 'object' && 'increment' in valor ? banco.fila[clave] + valor.increment : valor;
    }
    return structuredClone(banco.fila);
  },
  'job.findUnique': () => ({ id: TRABAJO, customerId: CLIENTE, titulo: 'Cambio de caldera', direccion: null, merchantId: MERCHANT }),
  'job.findFirst': () => ({ id: TRABAJO, customerId: CLIENTE, titulo: 'Cambio de caldera', quoteId: null }),
  'customer.findFirst': () => null,
  'customer.findUnique': () => ({ id: CLIENTE, name: 'Cliente 1302', legalName: null, taxId: null }),
  'merchant.findUnique': () => ({ id: MERCHANT, name: 'Fontanería 1302', legalName: null, taxId: null }),
  'auditLog.create': () => ({}),
}, [RUTA]);

const router = moduloDeDist(RUTA).default;
const capa = router.stack.find((l) => l.route && l.route.path === '/:id/firmar' && l.route.methods.post);
assert.ok(capa, '🔴 CIEGO: no encuentro POST /:id/firmar en la ruta de albaranes');
const manejador = capa.route.stack[capa.route.stack.length - 1].handle;
const capaPatch = router.stack.find((l) => l.route && l.route.path === '/:id' && l.route.methods.patch);
assert.ok(capaPatch, '🔴 CIEGO: no encuentro PATCH /:id en la ruta de albaranes');
const editarPorRuta = capaPatch.route.stack[capaPatch.route.stack.length - 1].handle;

/** Un `PATCH` de notas por el manejador real, con la versión que el editor tenía delante. */
async function guardarNotas(notas, version) {
  const r = { status: 200, body: undefined };
  const res = { status(s) { r.status = s; return res; }, json(j) { r.body = structuredClone(j); return res; }, setHeader() { return res; } };
  const deVerdad = console.error; console.error = () => {};
  try {
    await editarPorRuta(reqDeSesion({
      rol: 'admin', params: { id: String(ID) }, merchantId: MERCHANT, teamMemberId: null,
      headers: { 'user-agent': 'test' }, ip: '127.0.0.1', socket: {}, body: { notas, version },
    }), res);
  } finally { console.error = deVerdad; }
  return r;
}

function preparar({ editarTrasLeer = null } = {}) {
  Object.assign(banco, { fila: albaranEmitido(), editarTrasLeer, enMedio: false, lecturas: 0, firmas: [], ediciones: [], rechazadas: 0, pdfPedidos: 0 });
}

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

/** Lo que hace el `PATCH` al guardar: cambia el contenido y sube la versión. El estado no cambia. */
const editar = (fila) => { fila.notas = 'Lo que editó la oficina'; fila.version += 1; };

test('SCRUM-1302o · SUELO: sin edición en medio, la firma en obra se guarda como siempre', async () => {
  preparar();
  const r = await firmar('Ana');
  assert.equal(r.status, 200, `🔴 CIEGO: el caso sano responde ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(banco.firmas.length, 1);
  assert.equal(banco.fila.estado, 'firmado');
  assert.equal(banco.fila.version, 3, 'firmar no toca la versión');
});

test('SCRUM-1302o · 🔴 EDITADO ENTRE LA LECTURA Y LA ESCRITURA: no se sella lo viejo sobre lo editado', async () => {
  preparar({ editarTrasLeer: editar });
  const r = await firmar('Ana');
  assert.equal(banco.lecturas >= 1 && banco.fila.version, 4, '🔴 CIEGO: la edición de en medio no ha ocurrido');
  assert.equal(banco.firmas.length, 0,
    `🔴 la firma se ha escrito sobre un albarán editado después de leerlo: la evidencia sella «Lo que vio el cliente» y la fila dice «${banco.fila.notas}»`);
  assert.equal(banco.fila.estado, 'emitido', 'el albarán sigue sin firmar');
  assert.equal(r.status, 409, `quien firma lo sabe: ${JSON.stringify(r)}`);
  assert.deepEqual(r.body, { error: 'albaran_cambiado', message: AVISO });
  assert.equal(banco.pdfPedidos, 0, 'sin firma no se regenera el PDF con la firma');
});

test('SCRUM-1302o · control: firmado por otro en medio sigue siendo «ya está firmado», no «ha cambiado»', async () => {
  preparar({ editarTrasLeer: (fila) => { Object.assign(fila, { estado: 'firmado', firmadoPorNombre: 'Blas' }); } });
  const r = await firmar('Ana');
  assert.equal(banco.firmas.length, 0);
  assert.equal(banco.fila.firmadoPorNombre, 'Blas');
  assert.deepEqual([r.status, r.body], [409, { error: 'albaran_locked', message: 'Este albarán ya está firmado.' }]);
});

// ── EL OTRO LADO DE LA MISMA VENTANA: el PATCH ───────────────────────────────────────────────
// La firma no sube `version`. Si el PATCH lee `emitido`, la firma entra, y el PATCH escribe con
// `where: { id }`, la edición cae sobre un albarán FIRMADO: la evidencia sella lo de antes y la
// fila guarda lo editado. El mismo defecto que arriba, llegando por la otra puerta.

test('SCRUM-1302o · SUELO: un PATCH con la versión que tenía delante guarda', async () => {
  preparar();
  const r = await guardarNotas('Corregido', 3);
  assert.equal(r.status, 200, `🔴 CIEGO: el caso sano responde ${r.status} ${JSON.stringify(r.body)}`);
  assert.deepEqual(banco.ediciones, [{ notas: 'Corregido', sobreEstado: 'emitido' }]);
  assert.equal(banco.fila.version, 4);
});

test('SCRUM-1302o · 🔴 FIRMADO ENTRE LA LECTURA Y LA ESCRITURA DEL PATCH: no se edita un albarán firmado', async () => {
  preparar({ editarTrasLeer: (fila) => { Object.assign(fila, { estado: 'firmado', firmadoPorNombre: 'Ana' }); } });
  const r = await guardarNotas('Corregido', 3);
  assert.equal(banco.fila.estado, 'firmado', '🔴 CIEGO: la firma de en medio no ha ocurrido');
  assert.deepEqual(banco.ediciones, [], `🔴 el PATCH ha escrito sobre un albarán ya firmado: ${JSON.stringify(banco.ediciones)}`);
  assert.equal(banco.fila.notas, 'Lo que vio el cliente');
  // La respuesta que esta ruta ya da sobre un albarán firmado: ningún texto nuevo.
  assert.deepEqual([r.status, r.body], [409, { error: 'albaran_locked', message: 'Un albarán firmado está congelado: no se puede editar.' }]);
});

test('SCRUM-1302o · 🔴 DOS PATCH CON LA MISMA VERSIÓN: el segundo no pisa al primero en silencio', async () => {
  preparar({ editarTrasLeer: (fila) => { fila.notas = 'Lo que guardó la otra pestaña'; fila.version += 1; } });
  const r = await guardarNotas('Lo de esta pestaña', 3);
  assert.ok(banco.enMedio, '🔴 CIEGO: la edición de en medio no ha ocurrido');
  assert.deepEqual(banco.ediciones, [], `🔴 el segundo PATCH ha pisado al primero: ${JSON.stringify(banco.ediciones)}`);
  assert.equal(banco.fila.notas, 'Lo que guardó la otra pestaña');
  assert.equal(banco.fila.version, 4);
  // La respuesta que esta ruta ya da cuando la versión no casa (SCRUM-361 fase 2): ningún texto nuevo.
  assert.deepEqual([r.status, r.body], [409, { error: 'albaran_cambiado_al_editar' }]);
});