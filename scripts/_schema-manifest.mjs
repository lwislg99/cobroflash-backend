// scripts/_schema-manifest.mjs — SCRUM-222 · DERIVA-PROD-1
//
// Lógica PURA (sin efectos) para construir el manifiesto de columnas que el código EXIGE, a partir
// del DMMF de Prisma. La comparten el generador (`gen-schema-manifest.mjs`, que escribe el fichero)
// y el guard (`tests/scrum222-manifest.test.mjs`, que exige que el fichero commiteado coincida).
//
// POR QUÉ DEL DMMF Y NO ASUMIENDO snake_case: el schema es INCONSISTENTE a propósito — la mayoría de
// modelos mapean `merchantId` a la columna `merchant_id`, pero `Quote` e `Invoice` NO (@map ausente),
// así que su columna real es `merchantId`. Derivar del DMMF (`field.dbName || field.name`) da el
// nombre correcto por modelo; asumir un patrón daría falsa alarma justo en las tablas que más duelen.
//
// QUÉ ENTRA: los campos ESCALARES y ENUM (columnas reales). Se excluyen las RELACIONES (`kind:
// 'object'`) — no son columnas; la columna que las sostiene (la FK, p. ej. `merchantId`) sí es un
// campo escalar y sí entra.

/**
 * @param {{ datamodel?: { models?: any[] } }} dmmf  el `Prisma.dmmf` del cliente generado
 * @returns {Record<string, string[]>}  tabla -> columnas, ambas ordenadas (diffs estables)
 */
export function construirManifiesto(dmmf) {
  const modelos = dmmf?.datamodel?.models || [];
  const man = {};
  for (const m of modelos) {
    const tabla = m.dbName || m.name; // @@map o nombre del modelo
    const cols = (m.fields || [])
      .filter((f) => f.kind !== 'object') // relaciones fuera; escalares y enums son columnas
      .map((f) => f.dbName || f.name)     // @map o nombre del campo
      .sort();
    man[tabla] = cols;
  }
  // Orden estable de tablas para que el diff del fichero versionado sea limpio.
  return Object.fromEntries(Object.keys(man).sort().map((k) => [k, man[k]]));
}
