// tests/_banco-firma-del-parte.mjs — SCRUM-1302d
//
// LA PÁGINA PÚBLICA DE FIRMA DEL PARTE, POR LA PUERTA: `GET /albaran/:token` y
// `POST /albaran/:token/firmar` de verdad (`dist`), con la base doblada por `_envio-doblado.mjs` y
// una fila que RECUERDA lo escrito. ⛔ Sin red, sin base y sin Meta.
//
// Lo usan dos: `scrum1302d-textos-de-la-pagina-de-firma.test.mjs` y la medición
// `docs/master/evidencias/SCRUM-1302/reintento-de-firma/reintento.mjs`. Un módulo y no dos copias,
// por lo mismo que dice `_envio-doblado.mjs`: un doble que diverge mide otra cosa.
//
// QUÉ SE DOBLA ADEMÁS DE LA BASE, y por qué no cambia lo que se mide:
//   · `ensureAlbaranPdf` → un contador. Escribe un PDF en disco; aquí se cuenta cuántas veces se pide.
//   · `sendAlbaranFirmadoWhatsApp` → un contador. Es la copia firmada al cliente: cuántas se piden.
// NO se dobla: los manejadores de la ruta, `canTransitionAlbaran`, `puedeFirmarEstaVersion`,
// `resolverCalidadFirmante`, `exigirNombreFirmante` ni `buildFirmaEvidencia`.
//
// 🔴 EL LÍMITE: el doble no tiene cerrojos ni transacciones. Con `lecturaLenta`, dos peticiones leen
// la misma foto antes de que ninguna escriba: eso dice qué hace el CÓDIGO en esa carrera, no con qué
// frecuencia ocurre en producción.
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

const RUTA = '../dist/modules/jobs/app/routes/albaranPublic.routes.js';
const SERVICIO = '../dist/modules/jobs/domain/albaran.service.js';
const ENVIO = '../dist/modules/jobs/domain/albaranWhatsApp.service.js';

export const TOKEN_PARTE = 'c'.repeat(32);
export const TRAZO_1 = 'data:image/png;base64,AAAAPRIMERTRAZO';
export const TRAZO_2 = 'data:image/png;base64,BBBBSEGUNDOTRAZO';
export const CLIENTE_DEL_PARTE = 'Cliente 1302';

const copia = (x) => JSON.parse(JSON.stringify(x));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export function bancoDelParte({ estado = 'emitido', lecturaLenta = 0 } = {}) {
  const fila = {
    id: 1302, merchantId: MERCHANT, jobId: 77, numero: 'PT-2026-0001', estado, version: 3,
    firmaToken: TOKEN_PARTE, lineas: [{ concepto: 'Revisión', cantidad: 1, unidad: 'ud' }], modoValoracion: 'SIN_VALORAR',
    ocultarPreciosEnDocumento: false, signatureUrl: null, firmadoAt: null, evidenciaFirma: null,
    firmadoPorNombre: null, firmadoPorCalidad: null, contentHash: null, fecha: new Date('2026-10-13T08:00:00Z'),
    createdAt: new Date('2026-10-13T08:00:00Z'), updatedAt: new Date('2026-10-13T08:00:00Z'),
  };
  const cuenta = { escrituras: 0, pdf: 0, copias: 0 };
  inyectarBase({
    'albaran.findUnique': async ({ where }) => {
      if (where.firmaToken !== TOKEN_PARTE && where.id !== fila.id) return null;
      const foto = { ...fila }; await esperar(lecturaLenta); return foto;
    },
    'albaran.update': ({ data }) => { cuenta.escrituras += 1; Object.assign(fila, data); return { ...fila }; },
    'job.findUnique': () => ({ id: 77, customerId: CLIENTE, titulo: 'Obra de prueba', direccion: null }),
    'customer.findUnique': () => ({ id: CLIENTE, name: CLIENTE_DEL_PARTE, legalName: null }),
    'merchant.findUnique': () => ({ id: MERCHANT, name: 'Fontanería 1302', legalName: null, taxId: null, country: 'ES', logoUrl: null, email: null }),
  }, [RUTA, SERVICIO, ENVIO, '../dist/modules/system/customerAdmin.js']);

  const servicio = moduloDeDist(SERVICIO);
  const envio = moduloDeDist(ENVIO);
  servicio.ensureAlbaranPdf = async () => { cuenta.pdf += 1; return { diskPath: '', pdfUrl: '', numero: fila.numero }; };
  envio.sendAlbaranFirmadoWhatsApp = async () => { cuenta.copias += 1; return { ok: true }; };

  const router = moduloDeDist(RUTA).default;
  const manejador = (ruta, metodo) => {
    const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
    if (!capa) throw new Error(`CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en el router del parte.`);
    return capa.route.stack[capa.route.stack.length - 1].handle;
  };

  /** `POST /albaran/:token/firmar`. `extra` pisa el cuerpo por defecto (trazo 1, versión 3, Ana Prueba). */
  const firmar = async (extra = {}) => {
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; }, setHeader() { return res; } };
    await manejador('/:token/firmar', 'post')({ params: { token: TOKEN_PARTE }, headers: { 'user-agent': 'sonda-1302d' }, ip: '127.0.0.1', socket: {},
      body: { signatureData: TRAZO_1, version: 3, firmadoPorNombre: 'Ana Prueba', firmadoPorCalidad: 'el_propio_cliente', ...extra } }, res);
    await esperar(30); // la copia sale sin `await`
    return r;
  };

  /** `GET /albaran/:token`: el HTML que se sirve, entero. */
  const pagina = async () => {
    const r = { status: 200, cuerpo: '' };
    const res = { status(s) { r.status = s; return res; }, setHeader() { return res; }, send(b) { r.cuerpo = String(b); return res; } };
    await manejador('/:token', 'get')({ params: { token: TOKEN_PARTE }, headers: {}, ip: '127.0.0.1', socket: {} }, res);
    return r;
  };

  return { fila, cuenta, firmar, pagina };
}
