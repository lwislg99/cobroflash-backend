// SCRUM-881 · A2 PASO 0 — REPRODUCIR CORRIENDO, no leyendo.
//
// LA AFIRMACIÓN A COMPROBAR: `huecosDeLaSerie` compone SIN FECHA, así que tras el corte de
// SCRUM-780 (7-sep-2026) marcaría TODA factura `F26…` como «ajena».
//
// Se ejercita el `dist/` de verdad —el mismo que corre el producto—, no el fuente.
//
// 🔴 REGLA 38: aquí sólo se LEE. Ni una firma tocada, ni un export nuevo, ni código movido del
// camino de emisión. La base se consulta en SOLO LECTURA y únicamente la de DESARROLLO.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const { huecosDeLaSerie } = await import('../../../../dist/modules/invoicing/domain/huecosSerie.js');
const { formatInvoiceNumber, CORTE_FORMATO_F } = await import('../../../../dist/modules/invoicing/domain/invoiceNumber.service.js');

console.log('── EL CORTE ────────────────────────────────────────────────────────────');
console.log('   CORTE_FORMATO_F.desde = ' + new Date(CORTE_FORMATO_F.desde).toISOString());
console.log('');

// ── ① QUÉ COMPONE EL FORMATEADOR CON Y SIN FECHA ────────────────────────────────────────────
const ANTES = new Date('2026-09-01T00:00:00.000Z');
const DESPUES = new Date('2026-09-10T00:00:00.000Z');
console.log('── ① LO QUE COMPONE `formatInvoiceNumber` ──────────────────────────────');
console.log('   con fecha ANTERIOR al corte : ' + formatInvoiceNumber('CF', 2026, 1, false, ANTES));
console.log('   con fecha POSTERIOR al corte: ' + formatInvoiceNumber('CF', 2026, 1, false, DESPUES));
console.log('   SIN FECHA (lo que hace el detector): ' + formatInvoiceNumber('CF', 2026, 1, false));
console.log('');

// ── ② LA REPRODUCCIÓN: una serie emitida DESPUÉS del corte ──────────────────────────────────
const emitidasTrasElCorte = [
  formatInvoiceNumber('CF', 2026, 1, false, DESPUES),
  formatInvoiceNumber('CF', 2026, 2, false, DESPUES),
  formatInvoiceNumber('CF', 2026, 3, false, DESPUES),
];
console.log('── ② SERIE EMITIDA DESPUÉS DEL CORTE ───────────────────────────────────');
console.log('   emitidas: ' + emitidasTrasElCorte.join(', '));
const r = huecosDeLaSerie(emitidasTrasElCorte, 'CF', 2026, false);
console.log('   → emitidos : ' + r.emitidos);
console.log('   → ultimoSeq: ' + r.ultimoSeq);
console.log('   → huecos   : ' + (r.huecos.length ? r.huecos.join(', ') : '(ninguno)'));
console.log('   → AJENOS   : ' + (r.ajenos.length ? r.ajenos.join(', ') : '(ninguno)'));
console.log('   → truncado : ' + r.truncado);
console.log('');
const reproducido = r.ajenos.length === emitidasTrasElCorte.length && r.ultimoSeq === 0;
console.log('   ' + (reproducido
  ? '🔴 REPRODUCIDO: las TRES salen «ajenas» y no casa ninguna (ultimoSeq=0).'
  : '⚠️ NO reproducido tal cual: ajenos=' + r.ajenos.length + ' de ' + emitidasTrasElCorte.length));
console.log('');

// ── ③ CONTROL: la misma serie emitida ANTES del corte sí casa ───────────────────────────────
const emitidasAntes = [
  formatInvoiceNumber('CF', 2026, 1, false, ANTES),
  formatInvoiceNumber('CF', 2026, 2, false, ANTES),
];
const rAntes = huecosDeLaSerie(emitidasAntes, 'CF', 2026, false);
console.log('── ③ CONTROL · la misma serie ANTES del corte ──────────────────────────');
console.log('   emitidas: ' + emitidasAntes.join(', '));
console.log('   → ajenos: ' + (rAntes.ajenos.length ? rAntes.ajenos.join(', ') : '(ninguno)')
  + ' · ultimoSeq: ' + rAntes.ultimoSeq);
console.log('   ' + (rAntes.ajenos.length === 0
  ? '✅ casan todas: el detector NO está roto en general, sólo después del corte.'
  : '🔴 también falla antes del corte: entonces el diagnóstico es otro.'));
console.log('');

// ── ④ LA POBLACIÓN REAL, sobre la base de DESARROLLO (solo lectura) ─────────────────────────
const url = process.env.DATABASE_URL_DEV;
if (!url) { console.log('⚠️ sin DATABASE_URL_DEV: no se mide la población real.'); process.exit(0); }
const prisma = new PrismaClient({ datasources: { db: { url } } });
try {
  // ⚠️ Los nombres de columna de `invoices` son MIXTOS (`merchantId` en camel, `charge_id` en
  // snake). Se citan como están en el catálogo: adivinarlos da `column … does not exist`, que es
  // lo que me pasó en el primer intento. Y la fecha que decide el corte es la de emisión, que en
  // la fila es `createdAt` — es el `now` que `allocateInvoiceNumber` pasa como `emitidaEn`.
  const filas = await prisma.$queryRaw`
    SELECT id, "merchantId" AS merchant_id, number, "createdAt" AS issued_at,
           (rectifies_id IS NOT NULL) AS is_rectifying
    FROM invoices WHERE number IS NOT NULL ORDER BY id`;
  console.log('── ④ POBLACIÓN REAL en la base de DESARROLLO ───────────────────────────');
  console.log('   facturas CON número: ' + filas.length);
  if (!filas.length) {
    console.log('   🔴 CIEGO: cero facturas con número. El detector no evaluaría nada, y un');
    console.log('      «0 ajenas» sobre cero facturas no dice que esté sano: dice que no ha mirado.');
    process.exit(0);
  }
  for (const f of filas) {
    console.log('   · id=' + f.id + '  merchant=' + f.merchant_id + '  ' + String(f.number).padEnd(14)
      + '  emitida=' + (f.issued_at ? new Date(f.issued_at).toISOString().slice(0, 10) : '(sin fecha)')
      + (f.is_rectifying ? '  [R]' : ''));
  }
  // 🔴 EL PREFIJO SE LEE, NO SE SUPONE. En el primer intento pasé `'CF'` a pelo y las cinco
  // salieron «ajenas» — pero el prefijo real de ese merchant es `FG`, así que ese 5 era MÍO y no
  // del detector. Un censo que fabrica el defecto que viene a medir no mide nada.
  // ⚠️ Y se lee con el CLIENTE TIPADO, no con SQL crudo: adivinar el nombre de la columna me
  // falló dos veces seguidas (`merchant_id`, `invoiceSeriesPrefix`). El mapeo lo sabe Prisma.
  const merchants = await prisma.merchant.findMany({ select: { id: true, invoiceSeriesPrefix: true } });
  const prefijoDe = new Map(merchants.map((m) => [m.id, m.invoiceSeriesPrefix]));

  // Se agrupa como lo haría el detector: por merchant + año + tipo de serie.
  const grupos = new Map();
  for (const f of filas) {
    const año = f.issued_at ? new Date(f.issued_at).getUTCFullYear() : null;
    const k = f.merchant_id + '|' + año + '|' + (f.is_rectifying ? 'R' : 'F');
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(f);
  }
  console.log('');
  console.log('   CLASIFICACIÓN POR CUBO (con el prefijo REAL de cada merchant):');
  let totalAjenos = 0; let totalCasados = 0; let totalHuecos = 0;
  for (const [k, fs] of grupos) {
    const [merchant, año, tipo] = k.split('|');
    if (año === 'null') { console.log('   · merchant ' + merchant + ' · SIN FECHA DE EMISIÓN: fuera del barrido'); continue; }
    const prefijo = prefijoDe.get(Number(merchant));
    const res = huecosDeLaSerie(fs.map((x) => x.number), prefijo, Number(año), tipo === 'R');
    totalAjenos += res.ajenos.length; totalCasados += res.emitidos - res.ajenos.length; totalHuecos += res.huecos.length;
    console.log('   · merchant ' + merchant + ' (prefijo ' + JSON.stringify(prefijo) + ') · ' + año + ' · serie ' + tipo
      + ' → emitidos ' + res.emitidos + ' · casados ' + (res.emitidos - res.ajenos.length)
      + ' · huecos ' + res.huecos.length + ' · AJENOS ' + res.ajenos.length
      + (res.ajenos.length ? ' (' + res.ajenos.join(', ') + ')' : ''));
  }
  console.log('');
  console.log('   TOTALES · evaluadas ' + filas.length + ' · casadas ' + totalCasados
    + ' · huecos ' + totalHuecos + ' · AJENAS ' + totalAjenos);
} finally {
  await prisma.$disconnect();
}
