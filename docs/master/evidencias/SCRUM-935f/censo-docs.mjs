// ¿Qué declaraciones del meta-guard mutan un fichero que `esDocumentacion` llama documentación?
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const raiz = process.argv[2];
const { censoDeDeclaraciones } = await import(pathToFileURL(path.join(raiz, 'scripts/meta-guard-mutaciones.mjs')).href);
const { esDocumentacion } = await import(pathToFileURL(path.join(raiz, 'scripts/equipo/solo-docs.mjs')).href);
const censo = censoDeDeclaraciones(path.join(raiz, 'tests'));
let total = 0;
const porGuard = [];
for (const { guard, mutaciones } of censo) {
  if (!mutaciones.length) continue;
  total += mutaciones.length;
  const docs = mutaciones.filter((m) => esDocumentacion(m.fichero));
  porGuard.push({ guard, n: mutaciones.length, docs: docs.map((m) => m.fichero) });
}
const conDocs = porGuard.filter((g) => g.docs.length);
console.log(`declarantes ${porGuard.length} · declaraciones ${total}`);
console.log(`guards con mutación sobre documentación: ${conDocs.length} · declaraciones ${conDocs.reduce((n, g) => n + g.docs.length, 0)}`);
for (const g of conDocs) console.log(`  ${g.guard}  (${g.docs.length}/${g.n})  → ${[...new Set(g.docs)].join(', ')}`);
if (process.argv[3]) (await import('node:fs')).writeFileSync(process.argv[3], JSON.stringify(porGuard, null, 1));
