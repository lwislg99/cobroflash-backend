// SCRUM-1779f · CON `SIF_ENABLED` EN OFF, LA EMISIÓN SUELTA NO AVISA DE UN FALLO DE VERIFACTU QUE NO HA OCURRIDO.
//
// Medido por jv-j1go en staging (SCRUM-1779 c.22283): con SIF OFF la factura nace `no_aplica` (1779d) y
// POST /admin/invoices respondía `message: 'Se emitió la factura, pero falló su registro VeriFactu…'`.
// GO del fundador: SCRUM-1779 c.22285. Criterio del orquestador (c.22286 y su respuesta): el aviso sale SOLO
// con `pendiente_de_sellado`, igual que `quotesAdmin.routes.ts` («`no_aplica` NO es un fallo»), y
// `veriFactu:false` sigue significando «sin sello» (nunca `true` sin sello). Ningún texto nuevo.
//
//   · SIF OFF                         → 201, sin `message`, `veriFactu:false`, sin huella.
//   · SIF ON y el sellado FALLA       → 201, CON el `message` de siempre, `veriFactu:false` (control positivo).
//   · SIF ON y el sellado va bien     → 201, sin `message`, `veriFactu:true` (como hoy).
//
// Las rutas de S1 (`albaranes.routes.ts`) y la pantalla de S2 (`jobDetailView.js`) NO se tocan aquí:
// su diff va a Luis (registro `# SCRUM-1779f`, «Para Luis»).
import { test } from 'node:test';
import assert from 'node:assert/strict';

delete process.env.SIF_ENABLED;
delete process.env.INVOICING_ES_ENABLED;

const { banco, prisma, reiniciar: reiniciarBanco, requiere, rutaDe, asentar, M_ES, CLIENTE } =
  await import('./_banco-emision-con-estado.mjs');
const { reqDeSesion } = await import('./_arnes-de-router.mjs');

const voces = { log: console.log, warn: console.warn, error: console.error };
console.log = () => {}; console.warn = () => {}; console.error = () => {};

const invoicesAdmin = requiere(rutaDe('dist/modules/system/app/routes/invoicesAdmin.routes.js'));

const NIF = 'B27000001';
const LINEAS = [{ concept: 'Arreglo de una fuga', qty: 1, price: 100, tax: 0.21 }];
const AVISO = 'Se emitió la factura, pero falló su registro VeriFactu. Revísalo antes de entregarla.';

function reiniciar(flags) {
  reiniciarBanco();
  const m = banco.tablas.merchant.find((x) => x.id === M_ES);
  Object.assign(m, { flags, llevaLibrosPorSii: false, taxId: NIF, defaultCurrency: 'EUR' });
  Object.assign(banco.tablas.customer[0], { merchantId: M_ES, taxId: '12345678Z', legalName: 'Clienta de prueba SL', address: 'Calle 1, Lugo', tipoDestinatario: null });
}

// El HANDLER real de POST /admin/invoices, por su ruta (scrum1344: se busca la capa montada).
async function emitirSuelta() {
  const capa = (invoicesAdmin.default || invoicesAdmin).stack.find((l) => l.route?.path === '/' && l.route.methods.post);
  const h = capa.route.stack.at(-1).handle;
  const r = { statusCode: 200, cuerpo: null };
  const res = { status(c) { r.statusCode = c; return res; }, json(x) { r.cuerpo = x; return res; }, setHeader() {}, set() { return res; } };
  await h(reqDeSesion({ rol: 'admin', merchantId: M_ES, teamMemberId: null, body: { customerId: CLIENTE, lines: LINEAS } }), res, (e) => { if (e) throw e; });
  await asentar();
  assert.equal(r.statusCode, 201, `la vía suelta devuelve ${r.statusCode} ${JSON.stringify(r.cuerpo)}`);
  return { cuerpo: r.cuerpo, fila: banco.tablas.invoice.at(-1) };
}

test('SCRUM-1779f · SIF OFF: la suelta responde SIN aviso de fallo de VeriFactu y con veriFactu:false', async () => {
  reiniciar({ INVOICING_ES_ENABLED: true });
  const { cuerpo, fila } = await emitirSuelta();
  assert.equal(fila.vfEstado, 'no_aplica', 'premisa (1779d): con SIF OFF la factura nace no_aplica');
  assert.ok(!fila.vfHash, 'premisa: sin huella');
  assert.ok(!('message' in cuerpo), `sin message de fallo; vino ${JSON.stringify(cuerpo.message)}`);
  assert.equal(cuerpo.veriFactu, false, 'veriFactu:false = «sin sello», nunca true sin sello');
});

test('SCRUM-1779f · control positivo: SIF ON y el sellado FALLA → el aviso sigue igual', async () => {
  reiniciar({ INVOICING_ES_ENABLED: true, SIF_ENABLED: true });
  // Se rompe el paso que marca `sellado` tras la huella: `sellarTrasEmision` cae a su catch y deja la
  // factura `pendiente_de_sellado`, que es el fallo real que el aviso existe para contar.
  const original = prisma.invoice.update;
  prisma.invoice.update = async (args) => {
    if (args?.data?.vfEstado === 'sellado') throw new Error('fallo sembrado por scrum1779f');
    return original.call(prisma.invoice, args);
  };
  try {
    const { cuerpo, fila } = await emitirSuelta();
    assert.equal(fila.vfEstado, 'pendiente_de_sellado', 'premisa: el fallo sembrado deja la factura pendiente');
    assert.equal(cuerpo.message, AVISO, 'con el sellado fallido, el aviso de siempre, literal');
    assert.equal(cuerpo.veriFactu, false);
  } finally {
    prisma.invoice.update = original;
  }
});

test('SCRUM-1779f · SIF ON y el sellado va bien → sin aviso y veriFactu:true, como hoy', async () => {
  reiniciar({ INVOICING_ES_ENABLED: true, SIF_ENABLED: true });
  const { cuerpo, fila } = await emitirSuelta();
  assert.equal(fila.vfEstado, 'sellado');
  assert.ok(fila.vfHash, 'con huella');
  assert.ok(!('message' in cuerpo));
  assert.equal(cuerpo.veriFactu, true);
});

test.after(() => { Object.assign(console, voces); });

// Mutaciones (catálogo, `aplicarUna` del meta-guard): cada una tiene que tumbar un caso de arriba.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // «con SIF OFF vuelve a decir que falló»: el aviso otra vez por «no sellada» y no por «pendiente»
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: '...(estadoSellado === SELLADO_PENDIENTE ? { message:',
    a: '...(estadoSellado !== SELLADO_HECHO ? { message:',
    cae: 'SCRUM-1779f · SIF OFF: la suelta responde SIN aviso de fallo de VeriFactu y con veriFactu:false',
  },
];
