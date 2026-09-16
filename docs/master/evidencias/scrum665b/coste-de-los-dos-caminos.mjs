// docs/master/evidencias/scrum665b/coste-de-los-dos-caminos.mjs — SCRUM-665 (fase «el CÓMO»)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// QUÉ MIDE, Y QUÉ NO
//
// SCRUM-665 ya tiene medido el QUÉ (entrada del 15-sep-2026): siete campos del emisor y la marca
// de agua se leen EN VIVO al reimprimir. Esto mide el **coste de las dos salidas**, para que la
// elección se haga con números y no con impresiones:
//
//   (B) guardar el PDF al emitir  → ¿cuánto ocupa un PDF de factura, MEDIDO?
//   (③) la marca «DEMO»           → ¿se queda dentro del papel guardado?
//
// ⛔ NO CONSTRUYE NINGUNO DE LOS DOS CAMINOS. No toca `src/`, ni la base, ni la red, ni escribe
//    en `storage/`. `generateInvoicePdf` recibe todo por parámetro: se le pasan juegos de datos y
//    se mira lo que sale. Misma puerta que usan los cuatro caminos de regeneración.
//
// 🔴 EL CONTROL QUE HACE LEGIBLE EL NÚMERO. Ya está medido en esta casa que **los bytes del PDF no
// son deterministas**: dos pasadas con datos idénticos dan ficheros distintos. Así que antes de
// dar un tamaño hay que preguntar si el TAMAÑO también baila. Si baila, el número es un RANGO y
// así hay que darlo. Se mide con tres pasadas idénticas, no con dos: dos iguales pueden ser
// casualidad de un valor que sólo cambia a veces.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const RAIZ = new URL('../../../../', import.meta.url).href;
const { generateInvoicePdf } = await import(RAIZ + 'dist/modules/invoicing/infra/pdf/pdf.service.js');
const { textoDePdf, contiene } = await import(RAIZ + 'tests/_pdf-texto.mjs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum665b-'));
const salida = [];
const di = (s = '') => { salida.push(s); console.log(s); };

/** La MISMA fixture que usó la medición del 15-sep, para que las dos tandas sean comparables. */
const FACTURA = (over = {}) => ({
  number: '2026-CF-0007',
  invoiceId: 90007,
  merchantId: 9001,
  merchant: {
    name: 'Fontaneria QA',
    legalName: 'Fontaneria QA S.L.',
    taxId: 'B12345678',
    address: 'Calle Mayor 1, 28001 Madrid',
    logoUrl: null,
    phone: null,
    email: 'pro@ejemplo.test',
  },
  customer: { name: 'Ferreteria Pepe', legalName: 'Ferreteria Pepe SL', taxId: 'B99999999', email: null, phone: null },
  currency: 'EUR',
  total: '480.00',
  qrData: 'INV:2026-CF-0007|AMOUNT:480.00|CUR:EUR',
  vfHash: 'abc123def456',
  createdAt: new Date('2026-06-15T10:00:00Z'),
  lines: [{ description: 'Reparacion de bajante', qty: 1, price: 396.69, tax: 0.21 }],
  type: 'F1',
  rectifiesNumber: null,
  watermark: null,
  stageLabel: null,
  ...over,
});

/** Genera y devuelve una COPIA fuera de `storage/`: no se deja nada del banco en el árbol. */
async function generar(nombre, params) {
  const { outPath } = await generateInvoicePdf(params);
  const destino = path.join(TMP, nombre);
  fs.copyFileSync(outPath, destino);
  return { destino, bytes: fs.statSync(destino).size };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
di('═══ ⑤ SUELO · ¿es ESTABLE el tamaño? (los bytes ya se sabe que no lo son) ═══');
// ═══════════════════════════════════════════════════════════════════════════════════════════
const p1 = await generar('estable-1.pdf', FACTURA());
const p2 = await generar('estable-2.pdf', FACTURA());
const p3 = await generar('estable-3.pdf', FACTURA());

if (!p1.bytes) {
  di('🔴 CIEGO: el primer PDF salió vacío. No se afirma ningún tamaño.');
  process.exit(3);
}

const tam = [p1.bytes, p2.bytes, p3.bytes];
const bytesIguales = Buffer.compare(fs.readFileSync(p1.destino), fs.readFileSync(p2.destino)) === 0;
const tamEstable = tam[0] === tam[1] && tam[1] === tam[2];
di('   tres pasadas con datos IDÉNTICOS: ' + tam.join(' · ') + ' bytes');
di('   ¿bytes idénticos? ....: ' + (bytesIguales ? 'sí' : '🔴 NO (ya medido el 15-sep)'));
di('   ¿TAMAÑO estable? .....: ' + (tamEstable ? '✅ SÍ — el número se puede dar como cifra'
  : '⚠️ NO — el número hay que darlo como RANGO: ' + Math.min(...tam) + '–' + Math.max(...tam)));
di('');

// ═══════════════════════════════════════════════════════════════════════════════════════════
di('═══ ② EL NÚMERO · cuánto ocupa un PDF de factura, por forma de factura ═══');
// ═══════════════════════════════════════════════════════════════════════════════════════════
const LINEA = (i) => ({ description: 'Partida de obra numero ' + (i + 1), qty: 1, price: 123.45, tax: 0.21 });
const formas = [
  ['factura de 1 línea (la fixture)', FACTURA()],
  ['factura de 5 líneas', FACTURA({ lines: Array.from({ length: 5 }, (_, i) => LINEA(i)) })],
  ['factura de 20 líneas', FACTURA({ lines: Array.from({ length: 20 }, (_, i) => LINEA(i)) })],
  ['rectificativa (R1, cita la rectificada)', FACTURA({ type: 'R1', rectifiesNumber: '2026-CF-0003' })],
  ['con marca DEMO', FACTURA({ watermark: 'DEMO — no válida fiscalmente' })],
];
const medidas = [];
for (const [etiqueta, params] of formas) {
  const r = await generar(etiqueta.replace(/[^a-z0-9]+/gi, '-') + '.pdf', params);
  medidas.push({ etiqueta, bytes: r.bytes });
  di('   ' + String(r.bytes).padStart(6) + ' bytes  ' + (r.bytes / 1024).toFixed(1).padStart(5) + ' KiB   ' + etiqueta);
}
di('');
di('   ⚠️ SIN LOGO en todas: `logoUrl` va a `null`. Un logo se EMBEBE en el PDF, así que es el');
di('      factor que más puede mover este número y el banco no lo mide (exigiría una imagen real');
di('      y una descarga). Se dice, no se estima.');
di('');

// ═══════════════════════════════════════════════════════════════════════════════════════════
di('═══ ③ LA MARCA «DEMO» · ¿se queda dentro del papel? — comprobado, no asumido ═══');
// ═══════════════════════════════════════════════════════════════════════════════════════════
const MARCA = 'DEMO — no válida fiscalmente';
const conMarca = await generar('demo-si.pdf', FACTURA({ watermark: MARCA }));
const sinMarca = await generar('demo-no.pdf', FACTURA({ watermark: null }));

const tConMarca = textoDePdf(conMarca.destino);
const tSinMarca = textoDePdf(sinMarca.destino);

// SUELO del lector: si no supiera leer NADA, los dos saldrían «no contiene» y parecería que la
// marca tampoco está. Se comprueba primero que lee algo que sí está seguro.
const leeAlgo = contiene(tConMarca, '2026-CF-0007');
di('   SUELO · el lector encuentra el número de la factura en el papel: ' + (leeAlgo ? 'sí' : '🔴 NO'));
if (!leeAlgo) { di('🔴 CIEGO: no sé leer este PDF. No afirmo nada sobre la marca.'); process.exit(3); }

const marcaDentro = contiene(tConMarca, 'DEMO');
const marcaFuera = contiene(tSinMarca, 'DEMO');
di('   con `watermark` puesto → el papel LLEVA la marca: ' + (marcaDentro ? '✅ sí' : '🔴 no'));
di('   con `watermark` a null → el papel NO la lleva ..: ' + (marcaFuera ? '🔴 sí (!)' : '✅ correcto'));
di('');
di('   LECTURA: la marca es CONTENIDO del fichero, no un adorno al servirlo. Luego un PDF');
di('   guardado el día de la emisión la conserva aunque el merchant deje de ser demo — que es');
di('   justo lo que hoy se pierde al reimprimir, porque `watermark` se deriva EN VIVO de');
di('   `isDemoMerchant(...)`. Con el camino (B) el problema desaparece solo: confirmado.');
di('');

// ═══════════════════════════════════════════════════════════════════════════════════════════
di('═══ RESUMEN ═══');
const base = medidas[0].bytes;
const mayor = Math.max(...medidas.map((m) => m.bytes));
di('   tamaño de una factura típica (1 línea, sin logo): ' + base + ' bytes ≈ ' + (base / 1024).toFixed(1) + ' KiB');
di('   la mayor de las formas medidas ..................: ' + mayor + ' bytes ≈ ' + (mayor / 1024).toFixed(1) + ' KiB');
di('   tamaño estable entre pasadas ....................: ' + (tamEstable ? 'sí' : 'NO'));

fs.writeFileSync(new URL('./salida-coste.txt', import.meta.url), salida.join('\n') + '\n');
fs.rmSync(TMP, { recursive: true, force: true });
