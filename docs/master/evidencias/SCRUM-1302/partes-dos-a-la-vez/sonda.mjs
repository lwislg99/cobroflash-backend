// Sonda S1 · tarea 4 (14-oct-2026): ¿dos `/firmar` (o dos `/firmar-tecnico`) A LA VEZ sobre el mismo
// parte escriben DOS veces? Rutas reales de `dist` del árbol que se pase, base doblada. El doble del
// `update` es FIEL AL `where`: si trae una clave que no casa con la fila, lanza P2025 como Prisma; si
// sólo trae `id` (como hoy), escribe — que es lo que haría Postgres.
// Uso: node sonda-partes-dos-a-la-vez.mjs <raíz del árbol>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = process.argv[2];
if (!RAIZ) { console.error('falta la raíz del árbol'); process.exit(2); }
const { inyectarBase, moduloDeDist, MERCHANT } = await import(pathToFileURL(path.join(RAIZ, 'tests', '_envio-doblado.mjs')).href);
const RUTAS = '../dist/modules/jobs/app/routes/partes.routes.js';
const copia = (x) => JSON.parse(JSON.stringify(x));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const trazo = (q) => `data:image/png;base64,${Buffer.from(`trazo de ${q}`).toString('base64')}`;

const parteSinFirmas = () => ({
  id: 1546, merchantId: MERCHANT, jobId: null, customerId: null,
  numero: 'PT-2026-1546', fecha: '2026-10-14T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: null,
  entrada: '09:00', salida: '11:00', desplazamientos: null, kilometros: null, tecnicos: [], tipo: 'reparacion_asistencia',
  lineas: [{ id: 'l1', bloque: 'mano_obra', unds: 2, descripcion: 'Hora de oficial', precioUnitario: 30, tipoIva: 0.21 }],
  notas: null, estado: 'borrador',
  firmadoAt: null, firmadoPorNombre: null, firmadoPorCalidad: null, signatureUrl: null,
  firmadoTecnicoAt: null, firmadoTecnicoNombre: null, signatureTecnicoUrl: null,
  contenidoHash: null, contenidoVersion: null,
});

const banco = { fila: parteSinFirmas(), lecturaLenta: 0, escrituras: [], rechazadas: 0 };
inyectarBase({
  'parteTrabajo.findFirst': async ({ where }) => {
    if (process.env.SONDA_DEBUG) console.log('findFirst', JSON.stringify(where));
    if (where.id !== banco.fila.id || where.merchantId !== banco.fila.merchantId) return null;
    const foto = copia(banco.fila);
    await esperar(banco.lecturaLenta);
    return foto;
  },
  'parteTrabajo.update': ({ where, data }) => {
    for (const [k, v] of Object.entries(where)) {
      const casa = v === null ? banco.fila[k] == null : banco.fila[k] === v;
      if (!casa) { banco.rechazadas += 1; throw Object.assign(new Error('no casa'), { code: 'P2025' }); }
    }
    banco.escrituras.push(copia(data));
    Object.assign(banco.fila, copia(data));
    return copia(banco.fila);
  },
}, [RUTAS]);

const router = moduloDeDist(RUTAS).default;
const h = (ruta) => {
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods.post);
  assert.ok(capa, `CIEGO: no encuentro POST ${ruta}`);
  return capa.route.stack.at(-1).handle;
};
async function pedir(ruta, body) {
  const r = { status: 200, data: undefined };
  const res = { status(s) { r.status = s; return res; }, json(j) { r.data = j; return res; }, setHeader() {} };
  await h(ruta)({ params: { id: '1546' }, body, merchantId: MERCHANT, userRole: 'admin', headers: {} }, res);
  return r;
}
const cuerpoCliente = (q) => ({ signatureData: trazo(q), firmadoPorNombre: q, firmadoPorCalidad: 'el_propio_cliente' });
const cuerpoTecnico = (q) => ({ signatureData: trazo(q), firmadoTecnicoNombre: q });

async function caso(nombre, ruta, cuerpo, campoNombre) {
  // CONTROL: una sola firma escribe UNA vez (si no, el «2» de abajo no mide nada).
  banco.fila = parteSinFirmas(); banco.escrituras = []; banco.rechazadas = 0; banco.lecturaLenta = 0;
  const sola = await pedir(ruta, cuerpo('Una'));
  console.log(`${nombre} · CONTROL una firma: ${sola.status}, escrituras=${banco.escrituras.length}`);
  if (sola.status !== 200 || banco.escrituras.length !== 1) { console.log(`   CIEGO: ${JSON.stringify(sola.data)}`); return; }
  // Una segunda firma DESPUÉS (secuencial) ya se rechazaba: 409.
  const despues = await pedir(ruta, cuerpo('Otra'));
  console.log(`${nombre} · secuencial, la segunda: ${despues.status} ${despues.data?.error ?? ''}`);
  // DOS A LA VEZ: las dos leen la ranura vacía antes de que ninguna escriba.
  banco.fila = parteSinFirmas(); banco.escrituras = []; banco.rechazadas = 0; banco.lecturaLenta = 30;
  const [a, b] = await Promise.all([pedir(ruta, cuerpo('Ana')), pedir(ruta, cuerpo('Berta'))]);
  console.log(`${nombre} · DOS A LA VEZ: ${a.status} y ${b.status}, escrituras=${banco.escrituras.length}, en la fila queda ${campoNombre}=${banco.fila[campoNombre]}`);
}

await caso('/firmar (cliente)', '/:id/firmar', cuerpoCliente, 'firmadoPorNombre');
await caso('/firmar-tecnico', '/:id/firmar-tecnico', cuerpoTecnico, 'firmadoTecnicoNombre');
