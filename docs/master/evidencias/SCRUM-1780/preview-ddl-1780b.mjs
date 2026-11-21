// SCRUM-1780b · DDL PROPUESTO del enlace parte → factura, sacado OFFLINE (sin base, sin red).
//
// Uso (desde la raíz del árbol, con `node_modules` propio):
//   node docs/master/evidencias/SCRUM-1780/preview-ddl-1780b.mjs
//
// Qué hace, sin tocar `prisma/schema.prisma` (regla 40: se LEE):
//   1. Copia el esquema a un temporal FUERA del árbol y le mete las dos líneas propuestas en
//      `model ParteTrabajo` (la columna y su índice, gemelos de `Albaran.invoiceId`).
//   2. `previewMigracion({ schema: copia, desde: original })` → el DDL (modo offline, datamodel→datamodel).
//   3. CONTROL NEGATIVO: `previewMigracion({ schema: original, desde: original })` → tiene que dar `sin_cambios`.
//   4. Pasa el DDL por la LISTA BLANCA de `scripts/_aplicar-sql-dev.mjs` (`clasificarSentencias`):
//      0 rechazadas, y por `sentenciasDestructivas`: 0.
//   5. CONTROL POSITIVO SEMBRADO: el mismo esquema con un `DROP` fabricado (se quita la columna
//      `notas` del parte) tiene que salir destructivo y RECHAZADO por la lista blanca. Si no sale,
//      el instrumento está ciego y el guion sale 2.
// Sale 0 si todo cuadra, 1 si algo choca, 2 si un control no se cumple (CIEGO).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { previewMigracion, sentenciasDestructivas, SCHEMA_POR_DEFECTO } from '../../../../scripts/preview-migracion.mjs';
import { clasificarSentencias } from '../../../../scripts/_aplicar-sql-dev.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const original = fs.readFileSync(SCHEMA_POR_DEFECTO, 'utf8');

const ANCLA_COLUMNA = '  contenidoVersion  Int?      @map("contenido_version")\n';
const ANCLA_MAP = '  @@map("partes_trabajo")\n';
const LINEA_COLUMNA = '  invoiceId         Int?      @map("invoice_id")\n';
const LINEA_INDICE = '  @@index([merchantId, invoiceId])\n';

function unaVez(texto, ancla) {
  const n = texto.split(ancla).length - 1;
  if (n !== 1) { console.log(`CIEGO: el ancla aparece ${n} veces (esperaba 1): ${JSON.stringify(ancla)}`); process.exit(2); }
}
unaVez(original, ANCLA_COLUMNA);
unaVez(original, ANCLA_MAP);

const propuesto = original
  .replace(ANCLA_COLUMNA, ANCLA_COLUMNA + LINEA_COLUMNA)
  .replace(ANCLA_MAP, LINEA_INDICE + ANCLA_MAP);
const sembrado = original.replace('  notas  String?\n\n  /// borrador | firmado | facturado', '\n  /// borrador | firmado | facturado');
if (sembrado === original) { console.log('CIEGO: no se pudo sembrar el DROP del control positivo'); process.exit(2); }

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1780b-'));
const fOriginal = path.join(dir, 'original.prisma');
const fPropuesto = path.join(dir, 'propuesto.prisma');
const fSembrado = path.join(dir, 'sembrado.prisma');
fs.writeFileSync(fOriginal, original);
fs.writeFileSync(fPropuesto, propuesto);
fs.writeFileSync(fSembrado, sembrado);

let salida = 1;
try {
  const r = previewMigracion({ schema: fPropuesto, desde: fOriginal });
  const neg = previewMigracion({ schema: fOriginal, desde: fOriginal });
  const pos = previewMigracion({ schema: fSembrado, desde: fOriginal });

  console.log(`población: esquema ${SCHEMA_POR_DEFECTO} · ${original.length} B · diff = 2 líneas en model ParteTrabajo`);
  console.log(`control de la herramienta (preview): ${r.control?.ok ? 'ok' : 'NO'}`);
  console.log(`propuesto: ok=${r.ok} clase=${r.clase}`);
  console.log('--- DDL ---');
  console.log(r.sql.trim());
  console.log('--- fin DDL ---');
  const destructivas = sentenciasDestructivas(r.sql);
  const blanca = clasificarSentencias(r.sql);
  console.log(`destructivas: ${destructivas.length}`);
  console.log(`lista blanca: permitidas=${blanca.permitidas.length} rechazadas=${blanca.rechazadas.length}`);
  for (const p of blanca.permitidas) console.log(`  ✔ ${p.forma} ← ${p.sentencia.replace(/\s+/g, ' ')}`);
  console.log(`control negativo (mismo esquema): ok=${neg.ok} clase=${neg.clase}`);
  const posDestr = sentenciasDestructivas(pos.sql).length;
  const posBlanca = clasificarSentencias(pos.sql);
  console.log(`control positivo sembrado (DROP de «notas»): ok=${pos.ok} clase=${pos.clase} destructivas=${posDestr} rechazadas=${posBlanca.rechazadas.length}`);

  if (!r.ok || !neg.ok || !pos.ok) { console.log('VEREDICTO: CIEGO (la herramienta no respondió)'); salida = 2; }
  else if (neg.clase !== 'sin_cambios' || posDestr === 0 || posBlanca.rechazadas.length === 0) {
    console.log('VEREDICTO: CIEGO (un control no se cumple)'); salida = 2;
  } else if (destructivas.length !== 0 || blanca.rechazadas.length !== 0 || blanca.permitidas.length === 0) {
    console.log('VEREDICTO: ROJO (el DDL propuesto no es aditivo o la lista blanca lo rechaza)'); salida = 1;
  } else { console.log('VEREDICTO: VERDE (aditivo, 0 destructivas, lista blanca 0 rechazadas, controles ok)'); salida = 0; }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(salida);
