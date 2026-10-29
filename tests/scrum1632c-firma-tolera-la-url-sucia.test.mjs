// tests/scrum1632c-firma-tolera-la-url-sucia.test.mjs — SCRUM-1632 (tramo c, S1)
//
// QUÉ ARREGLA
//
// El enlace de firma del parte llega por WhatsApp con el marcador `{{1}}` pegado delante del token
// (`/albaran/{{1}}<token>`, plantilla `albaran_para_firmar_es`), y la página pública buscaba el
// `firmaToken` EN CRUDO: el cliente veía un 404. El camino del presupuesto lleva meses aguantando
// esa misma URL con `parseToken` (`src/core/utils/utils.ts`); el de la firma no lo usaba en ningún
// sitio. GO del orquestador por delegación del fundador: SCRUM-1632 c.21220.
//
// Por la PUERTA: `GET /albaran/:token` y `POST /albaran/:token/firmar` de verdad (`dist`), con la
// base doblada. ⛔ Sin red, sin base y sin Meta. Lo que esto NO prueba: que el WhatsApp real llegue
// con esa forma (eso sólo se ve mandando uno al móvil; ver docs/master/SCRUM-1632.md, tramo 1632c).
//
// LOS CONTROLES, y por qué cada uno:
//   ① rojo primero — `{{1}}<token>` daba 404 en las dos rutas; ahora encuentra el parte.
//   ② positivo — el token limpio sigue igual. Sin él, «arreglado» podría ser «acepta cualquier cosa».
//   ③ del vacío — una ruta sin nada hex sigue sin encontrar parte. El doble devuelve la PRIMERA fila
//      si la consulta llega SIN clave (`firmaToken` undefined), que es lo peor que podría hacer una
//      búsqueda sin filtro: así el control no se cumple sobre el vacío.
//   ④ lo que se pinta — la página mete la ruta del POST dentro de un <script>. Con la ruta en crudo,
//      una URL con basura alrededor de un token válido la llevaría ENTERA al script.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

const RUTA = '../dist/modules/jobs/app/routes/albaranPublic.routes.js';
const SERVICIO = '../dist/modules/jobs/domain/albaran.service.js';
const ENVIO = '../dist/modules/jobs/domain/albaranWhatsApp.service.js';

// Empieza por «ccae1c» a propósito: son, en orden, las cifras hex de `</script><script>alert(1)</script>`.
// Así el caso ④ es una URL que, limpia, da EXACTAMENTE este token.
const TOKEN = 'ccae1c' + '0123456789abcdef0123456789';
const CON_MARCADOR = '{{1}}' + TOKEN;
const CON_SCRIPT = '</script><script>alert(1)</script>' + TOKEN.slice(6);
const CLIENTE_DEL_PARTE = 'Cliente 1632c';

const copia = (x) => JSON.parse(JSON.stringify(x));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function banco() {
  const fila = {
    id: 1632, merchantId: MERCHANT, jobId: 77, numero: 'PT-2026-1632', estado: 'emitido', version: 3,
    firmaToken: TOKEN, lineas: [{ concepto: 'Revisión', cantidad: 1, unidad: 'ud' }], modoValoracion: 'SIN_VALORAR',
    ocultarPreciosEnDocumento: false, signatureUrl: null, firmadoAt: null, evidenciaFirma: null,
    firmadoPorNombre: null, firmadoPorCalidad: null, contentHash: null, fecha: new Date('2026-10-29T08:00:00Z'),
    createdAt: new Date('2026-10-29T08:00:00Z'), updatedAt: new Date('2026-10-29T08:00:00Z'),
  };
  const cuenta = { escrituras: 0, claves: [] };
  inyectarBase({
    'albaran.findUnique': async ({ where }) => {
      if ('firmaToken' in where) {
        cuenta.claves.push(where.firmaToken);
        if (where.firmaToken === undefined) return { ...fila }; // ③: sin clave, lo peor posible
        return where.firmaToken === TOKEN ? { ...fila } : null;
      }
      return where.id === fila.id ? { ...fila } : null;
    },
    'albaran.update': ({ data }) => { cuenta.escrituras += 1; Object.assign(fila, data); return { ...fila }; },
    'job.findUnique': () => ({ id: 77, customerId: CLIENTE, titulo: 'Obra de prueba', direccion: null }),
    'customer.findUnique': () => ({ id: CLIENTE, name: CLIENTE_DEL_PARTE, legalName: null }),
    'merchant.findUnique': () => ({ id: MERCHANT, name: 'Fontanería 1632', legalName: null, taxId: null, country: 'ES', logoUrl: null, email: null }),
  }, [RUTA, SERVICIO, ENVIO, '../dist/modules/system/customerAdmin.js']);

  const servicio = moduloDeDist(SERVICIO);
  const envio = moduloDeDist(ENVIO);
  servicio.ensureAlbaranPdf = async () => ({ diskPath: '', pdfUrl: '', numero: fila.numero });
  envio.sendAlbaranFirmadoWhatsApp = async () => ({ ok: true });

  const router = moduloDeDist(RUTA).default;
  const manejador = (ruta, metodo) => {
    const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
    if (!capa) throw new Error(`CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en el router del parte.`);
    return capa.route.stack[capa.route.stack.length - 1].handle;
  };

  const pagina = async (token) => {
    const r = { status: 200, cuerpo: '' };
    const res = { status(s) { r.status = s; return res; }, setHeader() { return res; }, send(b) { r.cuerpo = String(b); return res; } };
    await manejador('/:token', 'get')({ params: { token }, headers: {}, ip: '127.0.0.1', socket: {} }, res);
    return r;
  };
  const firmar = async (token) => {
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; }, setHeader() { return res; } };
    await manejador('/:token/firmar', 'post')({ params: { token }, headers: { 'user-agent': 'sonda-1632c' }, ip: '127.0.0.1', socket: {},
      body: { signatureData: 'data:image/png;base64,AAAA1632', version: 3, firmadoPorNombre: 'Ana Prueba', firmadoPorCalidad: 'el_propio_cliente' } }, res);
    await esperar(30); // la copia sale sin `await`
    return r;
  };
  return { fila, cuenta, pagina, firmar };
}

test('① GET /albaran/{{1}}<token> encuentra el parte (antes: 404)', async () => {
  const b = banco();
  const r = await b.pagina(CON_MARCADOR);
  assert.equal(r.status, 200, 'con el marcador delante, la página de firma tiene que abrir');
  assert.ok(r.cuerpo.includes(CLIENTE_DEL_PARTE), 'y es la página de ESTE parte');
});

test('① POST /albaran/{{1}}<token>/firmar firma el parte (antes: 404)', async () => {
  const b = banco();
  const r = await b.firmar(CON_MARCADOR);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.ok, true);
  assert.equal(b.fila.estado, 'firmado');
  assert.equal(b.cuenta.escrituras > 0, true);
});

test('② control positivo: el token limpio sigue funcionando igual', async () => {
  const b = banco();
  const g = await b.pagina(TOKEN);
  assert.equal(g.status, 200);
  assert.ok(g.cuerpo.includes(CLIENTE_DEL_PARTE));
  const p = await b.firmar(TOKEN);
  assert.equal(p.status, 200, JSON.stringify(p.data));
  assert.equal(b.fila.estado, 'firmado');
  // Y un token que NO es el del parte sigue sin abrir nada: limpiar no es aceptar cualquier cosa.
  const otro = 'f'.repeat(32);
  assert.equal((await banco().pagina(otro)).status, 404);
  assert.equal((await banco().firmar(otro)).status, 404);
});

for (const vacio of ['{{1}}', '', 'zzzz-sin-nada-hex', '{{1}}{{2}}']) {
  test(`③ control del vacío: «${vacio}» no encuentra parte y la búsqueda lleva clave`, async () => {
    const b = banco();
    assert.equal((await b.pagina(vacio)).status, 404, 'GET no puede caer en la primera fila');
    const p = await b.firmar(vacio);
    assert.equal(p.status, 404, 'POST no puede firmar la primera fila');
    assert.equal(b.fila.estado, 'emitido');
    assert.equal(b.cuenta.escrituras, 0);
    assert.ok(b.cuenta.claves.length >= 2, `CIEGO: el doble no vio las dos búsquedas (${b.cuenta.claves.length})`);
    for (const k of b.cuenta.claves) assert.equal(typeof k, 'string', 'la búsqueda tiene que llevar clave');
  });
}

test('④ la ruta del POST que se pinta en la página es la LIMPIA, no la que trajo la URL', async () => {
  const b = banco();
  const r = await b.pagina(CON_SCRIPT);
  assert.equal(r.status, 200, 'la URL limpia da el token del parte: la página abre');
  assert.ok(!r.cuerpo.includes('alert(1)'), 'lo que rodeaba al token en la URL no puede llegar al <script>');
  assert.ok(r.cuerpo.includes(`/albaran/${TOKEN}/firmar`), 'el POST va al token limpio');
  const m = await banco().pagina(CON_MARCADOR);
  assert.ok(!m.cuerpo.includes('{{1}}'), 'tampoco el marcador');
});
