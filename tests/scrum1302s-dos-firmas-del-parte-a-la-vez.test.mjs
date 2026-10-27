// tests/scrum1302s-dos-firmas-del-parte-a-la-vez.test.mjs — SCRUM-1302s
//
// 🔴 DOS FIRMAS A LA VEZ SOBRE LA MISMA RANURA DEL PARTE: ESCRIBE UNA.
//
// El tercer sitio del patrón de SCRUM-1302j (firma remota) y SCRUM-1302k (albarán en obra):
// `POST /admin/partes/:id/firmar` y `/firmar-tecnico` leían el parte, comprobaban la ranura
// (`puedeFirmarCliente` / `puedeFirmarTecnico`) y escribían con `where: { id }`. Medido el
// 14-oct-2026 con el código de `main`: dos a la vez → 200 y 200, DOS escrituras, y en la fila quedaba
// el SEGUNDO trazo; el primero había recibido un 200 de una firma que ya no estaba.
//
// El doble del `update` es FIEL AL `where`: si una clave no casa con la fila, lanza P2025 como
// Prisma. Un doble que escribe siempre no ve ni el arreglo ni su ausencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RUTAS = '../dist/modules/jobs/app/routes/partes.routes.js';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // M1 · la ranura del cliente sale del `where`: vuelve la carrera.
    fichero: 'src/modules/jobs/app/routes/partes.routes.ts',
    de: 'where: { id: parte.id, firmadoAt: null },',
    a: 'where: { id: parte.id },',
    cae: 'dos /firmar a la vez',
  },
  {
    // M2 · lo mismo en la del técnico.
    fichero: 'src/modules/jobs/app/routes/partes.routes.ts',
    de: 'where: { id: parte.id, firmadoTecnicoAt: null },',
    a: 'where: { id: parte.id },',
    cae: 'dos /firmar-tecnico a la vez',
  },
];

const copia = (x) => JSON.parse(JSON.stringify(x));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const trazo = (q) => `data:image/png;base64,${Buffer.from(`trazo de ${q}`).toString('base64')}`;

const parteSinFirmas = () => ({
  id: 1302, merchantId: MERCHANT, jobId: null, customerId: null,
  numero: 'PT-2026-1302', fecha: '2026-10-14T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: null,
  entrada: '09:00', salida: '11:00', desplazamientos: null, kilometros: null, tecnicos: [], tipo: 'reparacion_asistencia',
  lineas: [{ id: 'l1', bloque: 'mano_obra', unds: 2, descripcion: 'Hora de oficial', precioUnitario: 30, tipoIva: 0.21 }],
  notas: null, estado: 'borrador',
  firmadoAt: null, firmadoPorNombre: null, firmadoPorCalidad: null, signatureUrl: null,
  firmadoTecnicoAt: null, firmadoTecnicoNombre: null, signatureTecnicoUrl: null,
  contenidoHash: null, contenidoVersion: null,
});

// Un solo banco para todo el fichero: los módulos de `dist/` capturan el doble al cargarse.
const banco = { fila: parteSinFirmas(), lecturaLenta: 0, escrituras: [], rechazadas: 0 };
inyectarBase({
  'parteTrabajo.findFirst': async ({ where }) => {
    if (where.id !== banco.fila.id || where.merchantId !== banco.fila.merchantId) return null;
    const foto = copia(banco.fila);
    await esperar(banco.lecturaLenta);
    return foto;
  },
  'parteTrabajo.update': ({ where, data }) => {
    for (const [k, v] of Object.entries(where)) {
      const casa = v === null ? banco.fila[k] == null : banco.fila[k] === v;
      if (!casa) { banco.rechazadas += 1; throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' }); }
    }
    banco.escrituras.push(copia(data));
    Object.assign(banco.fila, copia(data));
    return copia(banco.fila);
  },
}, [RUTAS]);

const router = moduloDeDist(RUTAS).default;
function manejador(ruta) {
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods.post);
  assert.ok(capa, `🔴 CIEGO: no encuentro POST ${ruta} en el router de partes`);
  return capa.route.stack.at(-1).handle;
}
async function pedir(ruta, body) {
  const r = { status: 200, data: undefined };
  const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; }, setHeader() {} };
  const callar = console.error; console.error = () => {};
  try {
    await manejador(ruta)(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, params: { id: String(banco.fila.id) }, body, headers: {} }), res);
  } finally { console.error = callar; }
  return r;
}
function reiniciar(lecturaLenta = 0) {
  banco.fila = parteSinFirmas(); banco.escrituras = []; banco.rechazadas = 0; banco.lecturaLenta = lecturaLenta;
}
const cliente = (q) => ({ signatureData: trazo(q), firmadoPorNombre: q, firmadoPorCalidad: 'el_propio_cliente' });
const tecnico = (q) => ({ signatureData: trazo(q), firmadoTecnicoNombre: q });

const RANURAS = [
  { ruta: '/:id/firmar', nombre: '/firmar', cuerpo: cliente, campo: 'firmadoPorNombre', trazoEn: 'signatureUrl', motivo: 'el cliente ya ha firmado este parte' },
  { ruta: '/:id/firmar-tecnico', nombre: '/firmar-tecnico', cuerpo: tecnico, campo: 'firmadoTecnicoNombre', trazoEn: 'signatureTecnicoUrl', motivo: 'el técnico ya ha firmado este parte' },
];

async function controlPositivo(R) {
  reiniciar();
  const r = await pedir(R.ruta, R.cuerpo('Ana'));
  assert.equal(r.status, 200, `CIEGO: la firma sola no entra: ${JSON.stringify(r.data)}`);
  assert.equal(banco.escrituras.length, 1, 'la sonda no ve la escritura: el «1» de abajo no probaría nada');
  assert.equal(banco.fila[R.campo], 'Ana');
}
async function dosALaVez(R) {
  reiniciar(30); // las dos leen la ranura vacía antes de que ninguna escriba
  const [a, b] = await Promise.all([pedir(R.ruta, R.cuerpo('Ana')), pedir(R.ruta, R.cuerpo('Berta'))]);
  assert.equal(banco.escrituras.length, 1, `🔴 ${banco.escrituras.length} escrituras sobre la misma ranura: es el defecto medido el 14-oct`);
  assert.deepEqual([a.status, b.status], [200, 409], `🔴 contestan ${a.status} y ${b.status}`);
  assert.equal(banco.fila[R.campo], 'Ana', '🔴 la segunda firma ha pisado a la primera');
  assert.equal(banco.fila[R.trazoEn], trazo('Ana'), '🔴 el trazo guardado no es el de quien recibió el 200');
  // El mismo código y el mismo motivo que la puerta de arriba: la cola de firmas lo da por bueno.
  assert.deepEqual(b.data, { error: 'parte_locked', message: R.motivo });
}
const [DEL_CLIENTE, DEL_TECNICO] = RANURAS;

test('SCRUM-1302s · CONTROL POSITIVO /firmar: una firma sola escribe UNA vez, y el banco la ve', () => controlPositivo(DEL_CLIENTE));
test('SCRUM-1302s · 🔴 dos /firmar a la vez: UNA escritura, gana la primera, y la otra recibe 409 parte_locked', () => dosALaVez(DEL_CLIENTE));
test('SCRUM-1302s · CONTROL POSITIVO /firmar-tecnico: una firma sola escribe UNA vez, y el banco la ve', () => controlPositivo(DEL_TECNICO));
test('SCRUM-1302s · 🔴 dos /firmar-tecnico a la vez: UNA escritura, gana la primera, y la otra recibe 409 parte_locked', () => dosALaVez(DEL_TECNICO));

test('SCRUM-1302s · cliente y técnico A LA VEZ son ranuras distintas: entran los DOS, con el mismo sello', async () => {
  reiniciar(30);
  const [c, t] = await Promise.all([pedir('/:id/firmar', cliente('Ana')), pedir('/:id/firmar-tecnico', tecnico('Teo'))]);
  assert.deepEqual([c.status, t.status], [200, 200], `🔴 una ranura bloquea a la otra: ${c.status} y ${t.status}`);
  assert.equal(banco.escrituras.length, 2);
  assert.equal(banco.fila.firmadoPorNombre, 'Ana');
  assert.equal(banco.fila.firmadoTecnicoNombre, 'Teo');
  // v:2 sella CONTENIDO: las dos calculan la misma huella, así que da igual cuál escribió último.
  assert.equal(banco.escrituras[0].contenidoHash, banco.escrituras[1].contenidoHash);
});

test('SCRUM-1302s · secuencial, como antes: la segunda firma de la misma ranura da 409 sin escribir', async () => {
  reiniciar();
  await pedir('/:id/firmar', cliente('Ana'));
  const r = await pedir('/:id/firmar', cliente('Berta'));
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'parte_locked');
  assert.equal(banco.escrituras.length, 1);
});
