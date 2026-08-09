#!/usr/bin/env node
// scripts/guard-conformidad-landing.mjs — SCRUM-400 · el ejecutable.
//
// La lógica vive en `_guard-conformidad-landing.mjs`, que es PURA (recibe los textos, no los
// lee). Este fichero es lo único que toca el disco, para que el rojo se pueda ejercitar sin
// preparar ficheros.
//
//   node scripts/guard-conformidad-landing.mjs
//
// Exit 0 = la web no afirma nada que el documento no respalde · 1 = sí lo afirma.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { comprobarEnDisco } from './_guard-conformidad-landing.mjs';

// `fileURLToPath`, no comparar `import.meta.url` con `argv[1]` a pelo: esta ruta lleva un espacio
// y esa comparación cruda convierte el guard en un NO-OP con exit 0 (SCRUM-235).
const esCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (esCli) {
  const raiz = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const r = comprobarEnDisco(raiz);
  console.log('\n[guard de conformidad de la landing] SCRUM-400');
  console.log(r.salida);
  if (!r.ok) {
    console.error('\n❌ La web afirma una conformidad que ningún documento emitido respalda. NO se publica.\n');
    process.exit(1);
  }
  console.log('\n✅ ninguna afirmación de conformidad sin documento emitido detrás.\n');
}
if (!esCli && process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  console.error('🔴 se ejecutó como script pero NO se reconoció como CLI (SCRUM-235).');
  process.exit(1);
}
