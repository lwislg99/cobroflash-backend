// SCRUM-1499c · conduce el preview de la casa (previewMigracion, modo --desde) sobre COPIAS fuera del árbol.
// El CLI es el del node_modules del checkout compartido, por ruta (el worktree desechable no tiene uno propio).
// uso: node preview.mjs <worktree-con-el-script> <raiz-con-node_modules> <desde.prisma> <hasta.prisma>
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const [wt, raizCli, desde, hasta] = process.argv.slice(2);
const mod = await import(pathToFileURL(join(wt, 'scripts', 'preview-migracion.mjs')).href);
const ejecutor = mod.ejecutorLocal(raizCli);
console.log('CLI: ' + mod.rutaCliLocal(raizCli));
const r = mod.previewMigracion({ ejecutor, schema: hasta, desde });
console.log(JSON.stringify({ ok: r.ok, clase: r.clase, tablasControl: r.control?.tablas, error: r.error ?? null }));
if (r.sql) console.log('SQL:\n' + r.sql);
const malas = r.sql ? mod.sentenciasDestructivas(r.sql) : [];
console.log('destructivas: ' + malas.length);
