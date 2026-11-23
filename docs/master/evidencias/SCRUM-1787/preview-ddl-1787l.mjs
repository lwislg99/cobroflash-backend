// SCRUM-1787l · DDL PROPUESTO del TEXTO DEL PIE («Observaciones») congelado en la factura,
// sacado OFFLINE (sin base, sin red). Gemelo de `preview-ddl-1787f.mjs` (mismo directorio).
//
// Uso (desde la raíz del árbol, con `node_modules` propio y una TEMP sin espacios):
//   node docs/master/evidencias/SCRUM-1787/preview-ddl-1787l.mjs
//
// Qué hace, sin tocar `prisma/schema.prisma` (regla 40: se LEE):
//   1. Copia el esquema a un temporal FUERA del árbol y añade UNA línea en `model Invoice`, detrás
//      de `stageLabel` (ancla única: su comentario SCRUM-27):
//        `docFooterText String? @map("doc_footer_text") @db.Text`
//      Mismo nombre, mismo tipo y misma columna que su hermano del presupuesto
//      (`Quote.docFooterText`, SCRUM-593). Decisión de partida: SCRUM-1787 c.22338 ② («2-Sí»).
//   2. `previewMigracion({ schema: copia, desde: original })` → el DDL (modo offline).
//   3. CONTROL NEGATIVO: `previewMigracion({ schema: original, desde: original })` → `sin_cambios`.
//   4. Pasa el DDL por la LISTA BLANCA de `scripts/_aplicar-sql-dev.mjs` (`clasificarSentencias`):
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
const LINEA = '  docFooterText String?   @map("doc_footer_text") @db.Text\n';
// El DROP sembrado: la línea de `clientComment` de la factura, pegada a la misma ancla.
const LINEA_SEMBRADA = '  clientComment String?   @map("client_comment")\n';

function unaVez(texto, ancla) {
  const n = texto.split(ancla).length - 1;
  if (n !== 1) { console.log(`CIEGO: el ancla aparece ${n} veces (esperaba 1): ${JSON.stringify(ancla)}`); process.exit(2); }
}
unaVez(original, ANCLA);
unaVez(original, LINEA_SEMBRADA + ANCLA);

const propuesto = original.replace(ANCLA, ANCLA + LINEA);
const sembrado = original.replace(LINEA_SEMBRADA + ANCLA, ANCLA);
if ([propuesto, sembrado].some((t) => t === original)) { console.log('CIEGO: no se pudo construir una de las copias'); process.exit(2); }

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1787l-'));
const escribir = (n, t) => { const f = path.join(dir, n); fs.writeFileSync(f, t); return f; };
const fOriginal = escribir('original.prisma', original);
const fPropuesto = escribir('propuesto.prisma', propuesto);
const fSembrado = escribir('sembrado.prisma', sembrado);

let salida = 1;
try {
  const r = previewMigracion({ schema: fPropuesto, desde: fOriginal });
  const neg = previewMigracion({ schema: fOriginal, desde: fOriginal });
  const pos = previewMigracion({ schema: fSembrado, desde: fOriginal });

  console.log(`población: esquema ${path.relative(process.cwd(), SCHEMA_POR_DEFECTO)} · ${original.length} B · diff = 1 línea en model Invoice`);
  console.log(`control de la herramienta (preview): ${r.control?.ok ? 'ok' : 'NO'} · ok=${r.ok} clase=${r.clase}`);
  console.log('--- DDL ---');
  console.log((r.sql || '').trim());
  console.log('--- fin DDL ---');
  const destructivas = sentenciasDestructivas(r.sql || '').length;
  const blanca = clasificarSentencias(r.sql || '');
  console.log(`destructivas: ${destructivas}`);
  console.log(`lista blanca: permitidas=${blanca.permitidas.length} rechazadas=${blanca.rechazadas.length}`);
  for (const p of blanca.permitidas) console.log(`  ✔ ${p.forma} ← ${p.sentencia.replace(/\s+/g, ' ')}`);
  console.log(`control negativo (mismo esquema): ok=${neg.ok} clase=${neg.clase}`);
  const posDestr = sentenciasDestructivas(pos.sql || '').length;
  const posBlanca = clasificarSentencias(pos.sql || '');
  console.log(`control positivo sembrado (DROP de «clientComment» en Invoice): ok=${pos.ok} clase=${pos.clase} destructivas=${posDestr} rechazadas=${posBlanca.rechazadas.length}`);

  if (!r.ok || !neg.ok || !pos.ok) { console.log('VEREDICTO: CIEGO (la herramienta no respondió)'); salida = 2; }
  else if (neg.clase !== 'sin_cambios' || posDestr === 0 || posBlanca.rechazadas.length === 0) {
    console.log('VEREDICTO: CIEGO (un control no se cumple)'); salida = 2;
  } else if (destructivas !== 0 || blanca.rechazadas.length !== 0 || blanca.permitidas.length === 0) {
    console.log('VEREDICTO: ROJO (el DDL propuesto no es aditivo o la lista blanca lo rechaza)'); salida = 1;
  } else { console.log('VEREDICTO: VERDE (aditivo, 0 destructivas, lista blanca 0 rechazadas, controles ok)'); salida = 0; }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(salida);
