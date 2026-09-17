// SCRUM-911 · ¿TIENE LLAMADOR `maintenanceEurInMonth`? Por AST, no por grep.
//
// El grep dice dónde aparece el TEXTO; el AST dice si alguien la IMPORTA o la LLAMA. La diferencia
// importa: un nombre citado en un comentario, en un documento o en una cadena sale en el grep y no
// es un llamador, y una reexportación sí lo es y no se parece a una llamada.
//
// Se recorre TODO el árbol de fuentes (src/ + scripts/ + tests/ + public/), no solo `src/`: un
// llamador fuera de `src/` seguiría siendo un llamador.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { WT } from './_entorno.mjs';

const require = createRequire(`${WT}/package.json`);
const ts = require('typescript');

const OBJETIVO = process.argv[2] ?? 'maintenanceEurInMonth';
const RAICES = ['src', 'scripts', 'tests', 'public'];
const EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

function* ficheros(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* ficheros(p);
    else if (EXT.has(path.extname(e.name))) yield p;
  }
}

const declaraciones = [];
const importaciones = [];
const llamadas = [];
const otrasReferencias = [];

for (const raiz of RAICES) {
  const dir = path.join(WT, raiz);
  if (!fs.existsSync(dir)) continue;
  for (const f of ficheros(dir)) {
    const texto = fs.readFileSync(f, 'utf8');
    if (!texto.includes(OBJETIVO)) continue; // atajo: el AST solo se paga donde puede haber algo
    const sf = ts.createSourceFile(f, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const rel = path.relative(WT, f).replace(/\\/g, '/');
    const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

    const visitar = (n) => {
      if (ts.isIdentifier(n) && n.text === OBJETIVO) {
        const p = n.parent;
        const sitio = `${rel}:${linea(n)}`;
        if ((ts.isFunctionDeclaration(p) || ts.isVariableDeclaration(p) || ts.isMethodDeclaration(p)) && p.name === n) {
          declaraciones.push(sitio);
        } else if (ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p)) {
          importaciones.push(sitio);
        } else if (ts.isCallExpression(p) && p.expression === n) {
          llamadas.push(sitio);
        } else if (ts.isPropertyAccessExpression(p) && p.name === n
          && ts.isCallExpression(p.parent) && p.parent.expression === p) {
          llamadas.push(`${sitio} (por propiedad)`);
        } else {
          otrasReferencias.push(`${sitio} [${ts.SyntaxKind[p.kind]}]`);
        }
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }
}

console.log(`objetivo: ${OBJETIVO}`);
console.log('declaraciones :', declaraciones);
console.log('importaciones :', importaciones);
console.log('llamadas      :', llamadas);
console.log('otras refs    :', otrasReferencias);
const sinLlamador = llamadas.length === 0 && importaciones.length === 0;
console.log(sinLlamador
  ? `🔴 CONFIRMADO por AST: ${OBJETIVO} no la importa ni la llama NADIE en ${RAICES.join('/')}.`
  : `✅ ${OBJETIVO} SÍ tiene quien la use.`);
process.exit(0);
