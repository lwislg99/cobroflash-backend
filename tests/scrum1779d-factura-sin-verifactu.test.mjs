// SCRUM-1779d · CON `SIF_ENABLED` EN OFF LA FACTURA SALE SIN VERIFACTU; CON ON, COMO SIEMPRE.
//
// GO del fundador (regla 40), SCRUM-1779 c.22239: «Osea dejalo encendido, pero como lo que teniamos
// hecho de igual de presupuestos, no linkado a verifactu».
//
// Lo medido en 1779a (c.22240): con INVOICING_ES_ENABLED en ON y SIF_ENABLED en OFF, las seis vías
// (C1, C2 collect-rest, C3 invoice, C4 invoice-manual, documento suelto y R1) emitían SELLADAS: huella,
// QR de la AEAT, un alta `pending` en VfSubmission y, en el PDF, «Factura verificable en la sede
// electrónica de la AEAT», «VERI*FACTU» y «Huella:».
//
// Qué afirma este test, sobre el `dist/` y el banco en memoria `_banco-emision-con-estado.mjs`:
//   · OFF → por las seis vías: factura con número y estado, `vfHash` NULL, `vfEstado` no_aplica,
//     0 filas en VfSubmission; el PDF sale (el portón no lo para) y no lleva QR, ni VeriFactu, ni AEAT,
//     ni «Huella», ni «Escanea el QR».
//   · ON (control positivo, el mismo comercio con `flags.SIF_ENABLED=true`) → selladas como hoy:
//     huella, una alta por factura y la leyenda VeriFactu con su QR en el PDF.
// Población declarada: 6 vías × 2 modos; cada caso cuenta sus facturas antes de juzgarlas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

delete process.env.SIF_ENABLED;
delete process.env.INVOICING_ES_ENABLED;

const { banco, prisma, reiniciar: reiniciarBanco, requiere, rutaDe, asentar, M_ES, CLIENTE } =
  await import('./_banco-emision-con-estado.mjs');
const { extraerTextoPdf } = await import('./_texto-del-pdf.mjs');

const voces = { log: console.log, warn: console.warn, error: console.error };
console.log = () => {}; console.warn = () => {}; console.error = () => {};

// El generador REAL en la entrada que el banco dobla (como `docs/master/evidencias/SCRUM-1779/pdf-banco.mjs`).
const pdfReal = requiere(rutaDe('dist/modules/invoicing/infra/pdf/pdf.service.js'));
requiere.cache[rutaDe('dist/lib/pdf.js')].exports = { generateInvoicePdf: pdfReal.generateInvoicePdf, generateQuotePdf: pdfReal.generateQuotePdf };

const { allocateInvoiceNumber } = requiere(rutaDe('dist/modules/invoicing/domain/invoiceNumber.service.js'));
const { crearFacturaEmitida } = requiere(rutaDe('dist/modules/invoicing/domain/crearFacturaEmitida.js'));
const { congelarCliente } = requiere(rutaDe('dist/modules/invoicing/domain/clienteCongelado.js'));
const { congelarEmisorDesdeFicha } = requiere(rutaDe('dist/modules/invoicing/domain/emisorCongelado.js'));
const { sellarTrasEmision } = requiere(rutaDe('dist/modules/invoicing/domain/selladoEstado.js'));
const { ensureInvoicePdf } = requiere(rutaDe('dist/lib/invoicing.js'));
const invoicesAdmin = requiere(rutaDe('dist/modules/system/app/routes/invoicesAdmin.routes.js'));

const NIF = 'B27000001';
const LINEAS = [{ concept: 'Arreglo de una fuga', qty: 1, price: 100, tax: 0.21 }];
const PROHIBIDAS = ['VERI*FACTU', 'VeriFactu', 'AEAT', 'agenciatributaria', 'Huella', 'verificable', 'Escanea el QR'];

function reiniciar(flags) {
  reiniciarBanco();
  const m = banco.tablas.merchant.find((x) => x.id === M_ES);
  Object.assign(m, { flags, llevaLibrosPorSii: false, taxId: NIF, defaultCurrency: 'EUR' });
  Object.assign(banco.tablas.customer[0], { merchantId: M_ES, taxId: '12345678Z', legalName: 'Clienta de prueba SL', address: 'Calle 1, Lugo', tipoDestinatario: null });
  return m;
}

// Lo que llama cada ruta: número, creación en la tx y sellado tras el commit (vías C1-C4 y R1).
async function nucleo({ camino, rectifying = false, type = 'F1', status, rectifiesId = null }) {
  const m = banco.tablas.merchant.find((x) => x.id === M_ES);
  const cliente = await congelarCliente(prisma, M_ES, CLIENTE);
  const emisor = congelarEmisorDesdeFicha(m);
  const inv = await prisma.$transaction(async (tx) => {
    const number = await allocateInvoiceNumber(tx, M_ES, { camino, rectifying, actor: { tipo: 'propietario' } });
    return crearFacturaEmitida(tx, cliente, emisor, {
      merchantId: M_ES, customerId: CLIENTE, quoteId: null, number, type, total: '121.00', currency: 'EUR', lines: LINEAS,
      ...(status ? { status } : {}), ...(rectifiesId ? { rectifiesId } : {}),
      pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', registerId: null,
    });
  });
  // El comercio RECORTADO, como lo pasan jobs.routes.ts (`select: { country, taxId }`) y la recapitulativa:
  // el flag tiene que salir de la base, no del objeto.
  await sellarTrasEmision(inv, { country: 'ES', taxId: NIF }, prisma);
  await asentar();
  return banco.tablas.invoice.find((f) => f.id === inv.id);
}

// Vía 5: el HANDLER real de POST /admin/invoices (documento suelto).
async function suelta() {
  const capa = (invoicesAdmin.default || invoicesAdmin).stack.find((l) => l.route?.path === '/' && l.route.methods.post);
  const h = capa.route.stack.at(-1).handle;
  const antes = banco.tablas.invoice.length;
  const r = { statusCode: 200, cuerpo: null };
  const res = { status(c) { r.statusCode = c; return res; }, json(x) { r.cuerpo = x; return res; }, setHeader() {}, set() { return res; } };
  await h({ merchantId: M_ES, teamMemberId: null, role: 'admin', body: { customerId: CLIENTE, lines: LINEAS } }, res, (e) => { if (e) throw e; });
  await asentar();
  assert.equal(r.statusCode, 201, `la vía suelta devuelve ${r.statusCode} ${JSON.stringify(r.cuerpo)}`);
  // El cuerpo no siempre lleva el id: se toma la fila nueva, y se comprueba que es UNA.
  assert.equal(banco.tablas.invoice.length, antes + 1, 'la vía suelta crea una factura');
  return banco.tablas.invoice.at(-1);
}

// `ensureInvoicePdf` pide merchant/customer/rectifies; el banco sólo resuelve relaciones de `charge`.
const prismaConRelaciones = new Proxy(prisma, {
  get(t, p) {
    const v = t[p];
    if (p !== 'invoice') return v;
    return new Proxy(v, { get(mod, op) {
      if (op !== 'findUnique') return mod[op];
      return async (args = {}) => {
        const f = await mod.findUnique({ where: args.where });
        if (!f) return f;
        return {
          ...f,
          merchant: banco.tablas.merchant.find((x) => x.id === f.merchantId) ?? null,
          customer: banco.tablas.customer.find((x) => x.id === f.customerId) ?? null,
          rectifies: f.rectifiesId ? { number: banco.tablas.invoice.find((x) => x.id === f.rectifiesId)?.number ?? null } : null,
        };
      };
    } });
  },
});

async function pdfDe(inv) {
  banco.tablas.invoice.find((f) => f.id === inv.id).pdfUrl = 'PENDING_PDF';
  const r = await ensureInvoicePdf(inv.id, prismaConRelaciones);
  const buf = fs.readFileSync(r.diskPath);
  const { texto } = extraerTextoPdf(buf);
  return { texto, imagenes: (buf.toString('latin1').match(/\/Subtype\s*\/Image/g) || []).length };
}

async function lasSeisVias() {
  const f = [];
  f.push(await nucleo({ camino: 'C1' }));
  f.push(await nucleo({ camino: 'C2' }));
  const c3 = await nucleo({ camino: 'C3' });
  f.push(c3);
  f.push(await nucleo({ camino: 'C4' }));
  f.push(await suelta());
  f.push(await nucleo({ camino: 'C5', rectifying: true, type: 'R1', status: 'paid', rectifiesId: c3.id }));
  return f;
}

test('SCRUM-1779d · SIF_ENABLED OFF: las seis vías emiten SIN huella, SIN alta y con el PDF sin VeriFactu ni QR', async () => {
  reiniciar({ INVOICING_ES_ENABLED: true });
  const facturas = await lasSeisVias();
  assert.equal(facturas.filter(Boolean).length, 6, 'población: 6 facturas emitidas');
  for (const f of facturas) {
    assert.ok(f.number, 'con número');
    assert.ok(f.status, 'con estado');
    assert.equal(f.vfHash ?? null, null, `${f.number}: sin huella`);
    assert.equal(f.vfEstado, 'no_aplica', `${f.number}: no_aplica`);
  }
  assert.equal(banco.tablas.vfSubmission.length, 0, '0 altas en VfSubmission');
  for (const f of facturas) {
    const { texto, imagenes } = await pdfDe(f);
    assert.ok(texto.includes(f.number), `${f.number}: el PDF sale y lleva su número (control de lectura)`);
    for (const p of PROHIBIDAS) assert.ok(!texto.includes(p), `${f.number}: el PDF no dice «${p}»`);
    assert.equal(imagenes, 0, `${f.number}: el PDF no lleva QR`);
  }
});

test('SCRUM-1779d · control positivo: con SIF_ENABLED ON en el comercio, selladas como hoy', async () => {
  reiniciar({ INVOICING_ES_ENABLED: true, SIF_ENABLED: true });
  const facturas = await lasSeisVias();
  assert.equal(facturas.filter(Boolean).length, 6, 'población: 6 facturas emitidas');
  for (const f of facturas) {
    assert.ok(f.vfHash, `${f.number}: con huella`);
    assert.equal(f.vfEstado, 'sellado', `${f.number}: sellado`);
    assert.match(String(f.qrData), /agenciatributaria/, `${f.number}: QR de la AEAT`);
  }
  assert.equal(banco.tablas.vfSubmission.length, 6, 'una alta por factura');
  const { texto, imagenes } = await pdfDe(facturas[0]);
  assert.ok(texto.includes('VERI*FACTU'), 'el PDF lleva la leyenda VeriFactu');
  assert.ok(imagenes >= 1, 'el PDF lleva el QR');
});

test.after(() => { Object.assign(console, voces); });

// Mutaciones (catálogo, `aplicarUna` del meta-guard): cada una tiene que tumbar un caso de arriba.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // «sella aunque SIF esté OFF»
    fichero: 'src/modules/invoicing/domain/selladoEstado.ts',
    de: '  if (!sifEncendido) {',
    a: '  if (false) {',
    cae: 'SCRUM-1779d · SIF_ENABLED OFF: las seis vías emiten SIN huella, SIN alta y con el PDF sin VeriFactu ni QR',
  },
  {
    // «encola sin sello»: el flag leído del objeto recortado (sin `flags`) y no de la base
    fichero: 'src/modules/invoicing/domain/selladoEstado.ts',
    de: "sifEncendido = isFlagEnabled('SIF_ENABLED', { merchant: conFlags ?? merchant });",
    a: "sifEncendido = isFlagEnabled('SIF_ENABLED', { merchant });",
    cae: 'SCRUM-1779d · control positivo: con SIF_ENABLED ON en el comercio, selladas como hoy',
  },
  {
    // «pinta el QR sin sello»
    fichero: 'src/modules/invoicing/domain/portonDocumento.ts',
    de: "&& inv.vfEstado === SELLADO_NO_APLICA) return '';",
    a: "&& inv.vfEstado === 'nunca') return '';",
    cae: 'SCRUM-1779d · SIF_ENABLED OFF: las seis vías emiten SIN huella, SIN alta y con el PDF sin VeriFactu ni QR',
  },
  {
    // el portón para el PDF de la factura sin sello
    fichero: 'src/modules/invoicing/domain/portonDocumento.ts',
    de: '  if (!estaSellada(inv) && inv.vfEstado === SELLADO_NO_APLICA) return true;',
    a: '  if (false) return true;',
    cae: 'SCRUM-1779d · SIF_ENABLED OFF: las seis vías emiten SIN huella, SIN alta y con el PDF sin VeriFactu ni QR',
  },
];
