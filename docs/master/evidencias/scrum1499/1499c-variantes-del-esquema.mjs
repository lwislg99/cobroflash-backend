// SCRUM-1499c · banco de J5: reescribe SOLO colas de comentario `//` en una COPIA de schema.prisma.
// uso: node 1499c-variantes-del-esquema.mjs <ruta-schema> <variante>   (variantes: ver VARIANTES)
import { readFileSync, writeFileSync } from 'node:fs';

const [ruta, variante] = process.argv.slice(2);
const VARIANTES = {
  ninguna: [],
  propuesta: [
    ["  type         String // 'template' | 'service'",
     '  type         String // valores CERRADOS (regla 27): los fija el máster, Parte L («WhatsAppMessage»)'],
    ['  status String  @default("queued") // queued → sent → delivered → read | failed',
     '  status String  @default("queued") // estados CERRADOS (regla 27): los fija el máster, Parte L («WhatsAppMessage»)'],
  ],
  // Control positivo SEMBRADO: un comentario que scrum475 sí compara en main (EmailMessage.kind).
  control475: [
    ['  kind       String // invoice | quote | magic_link | digest | ...',
     '  kind       String // SEMILLA-1499c: comentario cambiado a proposito'],
  ],
  // Tras SCRUM-1501 (#2781) el mismo comentario, con el texto que dejó en main: ya NO tiene que caer.
  control475tras1501: [
    ['  kind       String // CLASES_DE_CORREO (src/modules/messaging/domain/registroDeEnvios.ts): lista cerrada, una por emisor',
     '  kind       String // SEMILLA-1499c: comentario cambiado a proposito'],
  ],
  // Control positivo ESTRUCTURAL sembrado: cambia el TIPO (no el comentario). Tiene que caer scrum475.
  semillaTipo: [
    ['  kind       String // CLASES_DE_CORREO (src/modules/messaging/domain/registroDeEnvios.ts): lista cerrada, una por emisor',
     '  kind       Int // CLASES_DE_CORREO (src/modules/messaging/domain/registroDeEnvios.ts): lista cerrada, una por emisor'],
  ],
};
const TOCA_CODIGO = new Set(['semillaTipo']);
const cambios = VARIANTES[variante];
if (!cambios) { console.error('variante desconocida: ' + variante); process.exit(2); }
const lineas = readFileSync(ruta, 'utf8').split('\n');
for (const [antes, despues] of cambios) {
  const idx = lineas.flatMap((l, i) => (l === antes ? [i] : []));
  if (idx.length !== 1) { console.error(`CIEGO: «${antes}» aparece ${idx.length} veces (se esperaba 1)`); process.exit(3); }
  // la parte de código (antes de `//`) tiene que quedar idéntica byte a byte
  const cod = (s) => s.slice(0, s.indexOf('//'));
  if (!TOCA_CODIGO.has(variante) && cod(antes) !== cod(despues)) { console.error('el código de la línea cambia: PARO'); process.exit(4); }
  lineas[idx[0]] = despues;
  console.log(`${variante}: línea ${idx[0] + 1} reescrita`);
}
writeFileSync(ruta, lineas.join('\n'));
console.log(`${variante}: ${cambios.length} cambio(s), ${lineas.length} líneas`);
