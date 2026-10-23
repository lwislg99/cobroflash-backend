// tests/_sonda-fecha-de-la-factura.mjs — SCRUM-1470c
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA SONDA: «¿QUÉ DÍA IMPRIME EL PDF DE LA FACTURA, Y QUÉ DÍA DICE SU REGISTRO FISCAL?»
//
// Un proceso hijo que ARRANCA en la zona que se le pide (UTC, como Railway) y, por cada caso:
//   ① genera el PDF de la FACTURA con el código real (`generateInvoicePdf`, de `dist/`) y lee la
//      «Fecha: dd/mm/aaaa» de su texto;
//   ② calcula la fecha que lleva su registro (`FechaExpedicionFactura`) con la MISMA función que lo
//      escribe, `formatDateES(createdAt, zonaDelMerchant(merchant))` de `verifactu.service`.
// Sólo LEE el camino de emisión (regla 38): importa y llama, no cambia nada.
//
// Hace falta un hijo porque el defecto sólo se ve con el proceso en UTC: en una máquina que va en
// la hora de Madrid, `getDate()` y la zona del negocio coinciden y el test saldría verde sin el
// arreglo (lo mismo que `tests/_sonda-fecha-impresa.mjs`, SCRUM-1470).
//
// USO:  node tests/_sonda-fecha-de-la-factura.mjs <zonaDelProceso> <json>
//         json = [{ zona, instante }]   (`zona` vacía o null = negocio SIN zona declarada)
//       Imprime UNA línea de JSON: { zonaDelProceso, casos: [{ instante, pdf, registro }] }.
//       Sale con 2 y { ciego } si no puede medir.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const [ZONA_PROCESO, ENCARGO] = process.argv.slice(2);
process.env.TZ = ZONA_PROCESO;

const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { createRequire } = await import('node:module');
const { extraerTextoPdf } = await import('./_texto-del-pdf.mjs');

const ciego = (motivo) => { console.log(JSON.stringify({ ciego: motivo })); process.exit(2); };

const resuelta = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (resuelta !== ZONA_PROCESO) ciego(`pedi ${ZONA_PROCESO}, Date resuelve ${resuelta}`);

let casos;
try { casos = JSON.parse(ENCARGO); } catch (e) { ciego(`el encargo no es JSON: ${e.message}`); }

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

// El Prisma de mentira, puesto en la caché ANTES de cargar `dist/`: generar el PDF no debe tocar la
// base, y si algún día la toca, la sonda se queda ciega diciéndolo en vez de medir otra cosa.
const prisma = new Proxy({}, {
  get(_t, modelo) {
    if (typeof modelo !== 'string' || modelo === 'then') return undefined;
    return new Proxy({}, { get: (_m, metodo) => async () => { throw new Error(`sonda: nadie ha puesto prisma.${modelo}.${String(metodo)}`); } });
  },
});
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
require_.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma } };

const { generateInvoicePdf } = require_('./dist/modules/invoicing/infra/pdf/pdf.service.js');
const { formatDateES } = require_('./dist/modules/invoicing/domain/verifactu.service.js');
const { zonaDelMerchant } = require_('./dist/core/zonaDelMerchant.js');

let n = 0;
async function caso({ zona, instante }) {
  const createdAt = new Date(instante);
  const timezone = zona || null;
  n += 1;
  const { outPath } = await generateInvoicePdf({
    number: `SONDA1470C-${n}`, invoiceId: 1470300 + n, merchantId: 1470300 + n,
    merchant: { name: 'Fontanería Sonda' }, customer: { name: 'Ana' },
    currency: 'EUR', total: '121.00', qrData: 'https://sonda.invalid/qr', vfHash: null,
    createdAt, lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }], type: 'F1',
    zona: timezone,
  });
  const leido = extraerTextoPdf(fs.readFileSync(outPath));
  fs.rmSync(outPath, { force: true });
  if (!leido.ok) ciego(`no supe leer el PDF: ${leido.motivo}`);
  const m = leido.texto.replace(/\s+/g, ' ').match(/Fecha: (\d{2}\/\d{2}\/\d{4})/);
  // El registro escribe dd-mm-aaaa; el PDF, dd/mm/aaaa. Se compara el DÍA, no el separador.
  const registro = formatDateES(createdAt, zonaDelMerchant({ timezone })).replace(/-/g, '/');
  return { instante, pdf: m ? m[1] : null, registro };
}

const salida = { zonaDelProceso: resuelta, casos: [] };
try {
  for (const c of casos) salida.casos.push(await caso(c));
} catch (e) {
  ciego(`la sonda revento: ${e?.stack || e}`);
}
console.log(JSON.stringify(salida));
process.exit(0);
