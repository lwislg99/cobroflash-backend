// SCRUM-1787f · DDL PROPUESTO del VENCIMIENTO de la factura y de sus FORMAS DE PAGO congeladas,
// sacado OFFLINE (sin base, sin red). Gemelo de `preview-ddl-1787c.mjs` (mismo directorio).
//
// Uso (desde la raíz del árbol, con `node_modules` propio):
//   node docs/master/evidencias/SCRUM-1787/preview-ddl-1787f.mjs
//
// Qué hace, sin tocar `prisma/schema.prisma` (regla 40: se LEE):
//   1. Copia el esquema a un temporal FUERA del árbol y saca DOS propuestas, cada una por separado,
//      porque no tienen la misma firma (SCRUM-1787 c.22325):
//        A · `dueDate    DateTime? @map("due_date")`   — firmada (① «Sí» + ③ A5 ①).
//        B · `payMethods Json?     @map("pay_methods")` — consecuencia de «congelar al emitir las
//            formas de pago» (③ GO), pero el ALTER firmado nombra SOLO el vencimiento: va aparte
//            para que el fundador pueda aplicar A sin B.
//      Las dos en `model Invoice`, detrás de `stageLabel` (ancla única: su comentario SCRUM-27).
//   2. `previewMigracion({ schema: copia, desde: original })` → el DDL de cada una (modo offline).
//   3. CONTROL NEGATIVO: `previewMigracion({ schema: original, desde: original })` → `sin_cambios`.
//   4. Pasa cada DDL por la LISTA BLANCA de `scripts/_aplicar-sql-dev.mjs` (`clasificarSentencias`):
//      0 rechazadas, y por `sentenciasDestructivas`: 0.
//   5. CONTROL POSITIVO SEMBRADO: el esquema con un `DROP` fabricado (se quita `clientComment` de la
//      factura) tiene que salir destructivo y RECHAZADO por la lista blanca. Si no sale, el
//      instrumento está ciego y el guion sale 2.
// Sale 0 si todo cuadra, 1 si algo choca, 2 si un control no se cumple (CIEGO).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { previewMigracion, sentenciasDestructivas, SCHEMA_POR_DEFECTO } from '../../../../scripts/preview-migracion.mjs';
import { clasificarSentencias } from '../../../../scripts/_aplicar-sql-dev.mjs';

const original = fs.readFileSync(SCHEMA_POR_DEFECTO, 'utf8');

const ANCLA = '  stageLabel    String?   @map("stage_label") // SCRUM-27: etiqueta del tramo, congelada al crear la factura\n';
const LINEA_A = '  dueDate       DateTime? @map("due_date")\n';
const LINEA_B = '  payMethods    Json?     @map("pay_methods")\n';
// El DROP sembrado: la línea de `clientComment` de la factura, pegada a la misma ancla.
const LINEA_SEMBRADA = '  clientComment String?   @map("client_comment")\n';

function unaVez(texto, ancla) {
  const n = texto.split(ancla).length - 1;
  if (n !== 1) { console.log(`CIEGO: el ancla aparece ${n} veces (esperaba 1): ${JSON.stringify(ancla)}`); process.exit(2); }
}
unaVez(original, ANCLA);
unaVez(original, LINEA_SEMBRADA + ANCLA);

const propuestoA = original.replace(ANCLA, ANCLA + LINEA_A);
const propuestoB = original.replace(ANCLA, ANCLA + LINEA_B);
const sembrado = original.replace(LINEA_SEMBRADA + ANCLA, ANCLA);
if ([propuestoA, propuestoB, sembrado].some((t) => t === original)) { console.log('CIEGO: no se pudo construir una de las copias'); process.exit(2); }

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1787f-'));
const escribir = (n, t) => { const f = path.join(dir, n); fs.writeFileSync(f, t); return f; };
const fOriginal = escribir('original.prisma', original);
const fA = escribir('propuesto-a.prisma', propuestoA);
const fB = escribir('propuesto-b.prisma', propuestoB);
const fSembrado = escribir('sembrado.prisma', sembrado);

function informar(etiqueta, r) {
  console.log(`--- ${etiqueta} ---`);
  console.log(`control de la herramienta (preview): ${r.control?.ok ? 'ok' : 'NO'} · ok=${r.ok} clase=${r.clase}`);
  console.log('--- DDL ---');
  console.log((r.sql || '').trim());
  console.log('--- fin DDL ---');
  const destructivas = sentenciasDestructivas(r.sql || '');
  const blanca = clasificarSentencias(r.sql || '');
  console.log(`destructivas: ${destructivas.length}`);
  console.log(`lista blanca: permitidas=${blanca.permitidas.length} rechazadas=${blanca.rechazadas.length}`);
  for (const p of blanca.permitidas) console.log(`  ✔ ${p.forma} ← ${p.sentencia.replace(/\s+/g, ' ')}`);
  return { destructivas: destructivas.length, rechazadas: blanca.rechazadas.length, permitidas: blanca.permitidas.length };
}

let salida = 1;
try {
  const a = previewMigracion({ schema: fA, desde: fOriginal });
  const b = previewMigracion({ schema: fB, desde: fOriginal });
  const neg = previewMigracion({ schema: fOriginal, desde: fOriginal });
  const pos = previewMigracion({ schema: fSembrado, desde: fOriginal });

  console.log(`población: esquema ${path.relative(process.cwd(), SCHEMA_POR_DEFECTO)} · ${original.length} B · diff = 1 línea en model Invoice por propuesta`);
  const ia = informar('A · vencimiento (firmado, c.22325 ① y ③)', a);
  const ib = informar('B · formas de pago congeladas (pendiente de ✅)', b);
  console.log(`control negativo (mismo esquema): ok=${neg.ok} clase=${neg.clase}`);
  const posDestr = sentenciasDestructivas(pos.sql || '').length;
  const posBlanca = clasificarSentencias(pos.sql || '');
  console.log(`control positivo sembrado (DROP de «clientComment» en Invoice): ok=${pos.ok} clase=${pos.clase} destructivas=${posDestr} rechazadas=${posBlanca.rechazadas.length}`);

  const malo = (i) => i.destructivas !== 0 || i.rechazadas !== 0 || i.permitidas === 0;
  if (!a.ok || !b.ok || !neg.ok || !pos.ok) { console.log('VEREDICTO: CIEGO (la herramienta no respondió)'); salida = 2; }
  else if (neg.clase !== 'sin_cambios' || posDestr === 0 || posBlanca.rechazadas.length === 0) {
    console.log('VEREDICTO: CIEGO (un control no se cumple)'); salida = 2;
  } else if (malo(ia) || malo(ib)) {
    console.log('VEREDICTO: ROJO (un DDL propuesto no es aditivo o la lista blanca lo rechaza)'); salida = 1;
  } else { console.log('VEREDICTO: VERDE (A y B aditivos, 0 destructivas, lista blanca 0 rechazadas, controles ok)'); salida = 0; }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(salida);
