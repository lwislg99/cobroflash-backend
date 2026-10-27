// transpilar.mjs — un `dist/` de PRUEBA sin `tsc` (no cabe en memoria). NO comprueba tipos:
// `ts.transpileModule` fichero a fichero, con las opciones del `tsconfig.json` del árbol.
// Uso: node transpilar.mjs <raíz ABSOLUTA del árbol>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.argv[2];
if (!raiz) { console.error('uso: node transpilar.mjs <raíz>'); process.exit(2); }
const require = createRequire(path.join(raiz, 'package.json'));
const ts = require('typescript');

const cfg = ts.readConfigFile(path.join(raiz, 'tsconfig.json'), ts.sys.readFile);
if (cfg.error) { console.error('🔴 no leo tsconfig.json'); process.exit(1); }
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, raiz);
const outDir = parsed.options.outDir || path.join(raiz, 'dist');
const rootDir = parsed.options.rootDir || path.join(raiz, 'src');

let hechos = 0, errores = 0;
for (const f of parsed.fileNames) {
  if (f.endsWith('.d.ts')) continue;
  const rel = path.relative(rootDir, f);
  if (rel.startsWith('..')) continue;
  const fuente = fs.readFileSync(f, 'utf8');
  const r = ts.transpileModule(fuente, { compilerOptions: { ...parsed.options, sourceMap: false, declaration: false }, fileName: f, reportDiagnostics: true });
  if (r.diagnostics?.length) { errores++; console.error('🔴', rel, ts.flattenDiagnosticMessageText(r.diagnostics[0].messageText, ' ')); }
  const destino = path.join(outDir, rel).replace(/\.tsx?$/, '.js');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, r.outputText);
  hechos++;
}
console.log(`POBLACIÓN · ${parsed.fileNames.length} ficheros en el tsconfig · transpilados ${hechos} · con error de sintaxis ${errores} · outDir ${outDir}`);
console.log(`EXIT=${errores ? 1 : 0}`);
process.exit(errores ? 1 : 0);
