// SCRUM-1523b · ¿CUANDO sale «JUSTIFICANTE DE COBRO» en el PDF, y por que camino?
//
// SOLO LEE el camino de emision (regla 38): llama a `ensureInvoicePdf` tal y como esta exportada
// en `dist/`, con un Prisma de mentira que devuelve UNA fila fabricada. No toca ninguna base, no
// cambia ninguna firma y no escribe en el arbol: el proceso se muda a un directorio temporal antes
// de cargar nada, porque `core/storage/dirs` cuelga `storage/` del directorio de trabajo.
//
// Uso (desde la raiz del repositorio, con `dist/` construido con `tsc --noCheck`):
//   node docs/master/evidencias/SCRUM-1523b/camino-del-pdf.mjs <raiz ABSOLUTA>
//   node docs/master/evidencias/SCRUM-1523b/camino-del-pdf.mjs <raiz ABSOLUTA> --sin-siembra   (CIEGO, sale 2)
//
// Que mide: la PRIMERA linea del PDF que produce el camino real para cada fila fabricada, y si el
// camino se niega a producirlo. La pregunta es «con que fila guardada sale el titulo», no «el
// titulo existe en el fuente».
//
// Que NO mide: si en alguna base hay una fila asi (no se toca ninguna base); ni las rutas HTTP que
// llaman a `ensureInvoicePdf` (su sesion, su rol, su token); ni ninguna pantalla en un navegador.
import { readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { temporal } from '../../../../tests/_temporal.mjs';

const raiz = process.argv[2] ? path.resolve(process.argv[2]) : null;
const sinSiembra = process.argv.includes('--sin-siembra');
if (!raiz || !existsSync(path.join(raiz, 'dist', 'lib', 'invoicing.js'))) {
  console.log('CIEGO: falta la raiz ABSOLUTA o no hay dist/lib/invoicing.js. EXIT=2');
  process.exit(2);
}

const banco = temporal('scrum1523b-'); // el helper lo borra al salir el proceso, salga por donde salga
process.chdir(banco); // ANTES de cargar dist: storage/ nace aqui y no en el arbol

const require = createRequire(path.join(raiz, 'package.json'));
const { ensureInvoicePdf } = require(path.join(raiz, 'dist', 'lib', 'invoicing.js'));
const { lineasDePdf } = await import(pathToFileURL(path.join(raiz, 'tests', '_texto-del-pdf.mjs')).href);

const TITULO = 'JUSTIFICANTE DE COBRO';
// El cero DERIVADO: el mismo titulo, del reves. Sale de TITULO, no se elige.
const CERO = [...TITULO].reverse().join('');

// Nunca el id 1 (es el comercio demo y su PDF lleva marca de agua: SCRUM-409).
const MERCHANT = {
  id: 7, name: 'Fontaneria de Prueba', legalName: null, taxId: 'B00000000', address: 'Calle Uno 1',
  logoUrl: null, whatsappPhone: null, email: 'prueba1523b@example.invalid', country: 'ES',
  flags: {}, // INVOICING_ES_ENABLED sin encender: el caso del profesional espanol real
};
const CUSTOMER = { id: 70, merchantId: 7, name: 'Cliente de Prueba', legalName: null, taxId: null, address: null, email: null, phone: null };

let siguienteId = 152300;
function fila(extra) {
  const id = siguienteId++;
  return {
    id, merchantId: 7, customerId: 70, merchant: MERCHANT, customer: CUSTOMER, rectifies: null,
    number: 'J-2026-000' + (id % 10), type: 'JUST', vfEstado: 'no_aplica', vfHash: null, vfPrevHash: null,
    qrData: null, pdfUrl: null, total: { toString: () => '121.00' }, currency: 'EUR',
    createdAt: new Date('2026-06-01T10:00:00Z'), lines: [{ concept: 'Trabajo', qty: 1, price: 100, tax: 21 }],
    stageLabel: null, merchantName: null,
    ...extra,
  };
}

/** Un Prisma que solo sabe devolver LA fila pedida. Cuenta lo que se le pregunta. */
function prismaCon(f) {
  const visto = { findUnique: 0, update: 0 };
  return {
    visto,
    invoice: {
      findUnique: async ({ where }) => { visto.findUnique++; return where.id === f.id ? f : null; },
      update: async ({ data }) => { visto.update++; Object.assign(f, data); return f; },
    },
  };
}

async function medir(nombre, f) {
  const prisma = prismaCon(f);
  try {
    const { diskPath } = await ensureInvoicePdf(f.id, prisma);
    const buf = readFileSync(diskPath);
    const leido = lineasDePdf(buf);
    // `ok:false` es «no supe leerlo», que no es «no dice nada»: se declara y el caso no vale.
    if (!leido.ok) return { nombre, sale: false, error: 'PDF ILEGIBLE: ' + leido.motivo, preguntas: prisma.visto.findUnique };
    const { lineas, texto } = leido;
    // La primera linea de la pagina es la de `y` MAYOR (mismo criterio que tests/scrum608).
    const primera = lineas.length ? lineas.reduce((a, b) => (b.y > a.y ? b : a)).texto : '(sin lineas)';
    return {
      nombre, sale: true, bytes: buf.length, lineas: lineas.length, primera,
      conTitulo: texto.includes(TITULO), conCero: texto.includes(CERO),
      conPalabraFactura: /factura/i.test(texto.replace(/No constituye una factura\./i, '')),
      nombran: lineas.filter((l) => /justificante|factura/i.test(l.texto)).map((l) => l.texto),
      preguntas: prisma.visto.findUnique,
    };
  } catch (e) {
    return { nombre, sale: false, error: String(e && e.message || e), preguntas: prisma.visto.findUnique };
  }
}

const casos = [];
// POSITIVO SEMBRADO: la fila que TIENE que dar el titulo. Sin ella, el instrumento no ha visto nada.
if (!sinSiembra) casos.push(['A · fila guardada JUST + J- + no_aplica (SIEMBRA)', fila({})]);
// El contrario: una factura sellada no puede llevarlo.
casos.push(['B · fila F1 sellada (numero de factura, con huella)', fila({ type: 'F1', number: 'F2026-0001', vfEstado: 'sellado', vfHash: 'a'.repeat(64), qrData: 'https://example.invalid/qr' })]);
// La misma fila JUST con el estado por defecto del esquema.
casos.push(['C · fila JUST + J- + pendiente_de_sellado (el DEFAULT del esquema)', fila({ vfEstado: 'pendiente_de_sellado' })]);
// Tipo y numero que no casan: el titulo lo decide el TIPO; el porton, el NUMERO.
casos.push(['D · fila F1 con numero J- + no_aplica', fila({ type: 'F1' })]);
casos.push(['E · fila JUST con numero de factura + no_aplica, sin huella', fila({ number: 'F2026-0002' })]);

const filas = [];
for (const [nombre, f] of casos) filas.push(await medir(nombre, f));

console.log('POBLACION · casos ejecutados=' + filas.length + ' · banco=' + (banco.startsWith(tmpdir()) ? 'temporal' : 'FUERA DE SITIO'));
for (const r of filas) {
  if (r.sale) {
    console.log(`${r.nombre}\n    SALE PDF · bytes=${r.bytes} · lineas=${r.lineas} · primera linea=«${r.primera}» · titulo=${r.conTitulo ? 'SI' : 'no'} · cero derivado=${r.conCero ? 'SI' : 'no'} · dice «factura» en otro sitio=${r.conPalabraFactura ? 'SI' : 'no'} · lecturas=${r.preguntas}`);
    for (const l of r.nombran) console.log('      linea que nombra el documento: «' + l + '»');
  } else {
    console.log(`${r.nombre}\n    NO SALE · ${r.error} · lecturas=${r.preguntas}`);
  }
}

const siembra = filas.find((r) => r.nombre.startsWith('A ·'));
const visto = !!(siembra && siembra.sale && siembra.conTitulo && siembra.primera === TITULO);
const ceroLimpio = filas.every((r) => !r.sale || !r.conCero);
const todosLeyeron = filas.every((r) => r.preguntas > 0);
try { process.chdir(tmpdir()); } catch {} // sale del banco para que el borrado de `temporal` pueda con el

if (!visto) { console.log('CIEGO: la fila sembrada no dio el titulo. Ninguna fila de arriba vale. EXIT=2'); process.exit(2); }
if (!ceroLimpio || !todosLeyeron) { console.log('ROTO: el cero derivado aparece o algun caso no llego a leer su fila. EXIT=1'); process.exit(1); }
console.log('CONTROL POSITIVO SEMBRADO · VISTO · CERO DERIVADO «' + CERO + '» · 0 apariciones · EXIT=0');
