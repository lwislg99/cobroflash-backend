// Sonda de SOLO LECTURA (AST) · ¿quién LEE INVOICING_ES_ENABLED y quién ESCRIBE merchants.flags?
//   node sonda.mjs <raiz del arbol>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = path.resolve(process.argv[2]);
const ts = (await import(pathToFileURL(path.join(RAIZ, 'node_modules/typescript/lib/typescript.js')).href)).default;
const FLAG = 'INVOICING_ES_ENABLED';
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const anda = (dir, exts, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') anda(p, exts, out); continue; }
    if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
};
const src = anda(path.join(RAIZ, 'src'), ['.ts']);
const scripts = [...anda(path.join(RAIZ, 'scripts'), ['.mjs', '.js', '.ts']), ...anda(path.join(RAIZ, 'prisma'), ['.mjs', '.js', '.ts'])];
console.log(`POBLACION · src/*.ts ${src.length} · scripts/+prisma/ ${scripts.length}`);
const parse = (p) => ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, p.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
const linea = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
const dentroDe = (n) => { for (let p = n.parent; p; p = p.parent) { if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) return p.name.getText(); if (ts.isVariableDeclaration(p) && p.initializer && (ts.isArrowFunction(p.initializer) || ts.isFunctionExpression(p.initializer))) return p.name.getText(); } return '(nivel de modulo o callback de ruta)'; };

// A · lecturas directas e indirectas
const directas = [], dinamicas = [], modo = [], importanFlags = new Set();
let totalIsFlag = 0;
for (const p of src) {
  const sf = parse(p);
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      if (n.expression.text === 'isFlagEnabled') {
        totalIsFlag++;
        const a = n.arguments[0];
        if (a && ts.isStringLiteralLike(a)) { if (a.text === FLAG) directas.push(`${rel(p)}:${linea(sf, n)} · en ${dentroDe(n)} · ctx=${n.arguments[1] ? n.arguments[1].getText(sf).replace(/\s+/g, ' ').slice(0, 70) : '(SIN CONTEXTO)'}`); }
        else dinamicas.push(`${rel(p)}:${linea(sf, n)} · en ${dentroDe(n)} · flag=${a ? a.getText(sf).slice(0, 40) : '?'}`);
      }
      if (n.expression.text === 'getEmissionMode') modo.push(`${rel(p)}:${linea(sf, n)} · en ${dentroDe(n)}`);
    }
    ts.forEachChild(n, v);
  };
  v(sf);
}
console.log(`\nA1 · isFlagEnabled('${FLAG}', …) DIRECTAS: ${directas.length}  (control: ${totalIsFlag} llamadas a isFlagEnabled en src/)`);
directas.forEach((d) => console.log('   ' + d));
console.log(`\nA2 · isFlagEnabled(<no literal>, …) — pueden recibir el flag: ${dinamicas.length}`);
dinamicas.forEach((d) => console.log('   ' + d));
console.log(`\nA3 · llamadas a getEmissionMode(): ${modo.length} en ${new Set(modo.map((m) => m.split(':')[0])).size} ficheros`);
const porFich = new Map(); for (const m of modo) { const f = m.split(':')[0]; porFich.set(f, (porFich.get(f) || 0) + 1); }
[...porFich].sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log(`   ${String(n).padStart(3)}  ${f}`));

// (los portadores del flag van aparte, en portadores.mjs)

// C · escrituras del modelo merchant
const ESCR = new Set(['update', 'updateMany', 'create', 'createMany', 'upsert']);
const escr = [];
const censarEscr = (ficheros) => {
  for (const p of ficheros) {
    const sf = parse(p);
    const v = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ESCR.has(n.expression.name.text)
        && ts.isPropertyAccessExpression(n.expression.expression) && n.expression.expression.name.text === 'merchant') {
        const arg = n.arguments[0];
        let clase = 'OPACO (argumento no literal)';
        if (arg && ts.isObjectLiteralExpression(arg)) {
          const datos = arg.properties.filter((pr) => ts.isPropertyAssignment(pr) || ts.isShorthandPropertyAssignment(pr)).filter((pr) => ['data', 'create', 'update'].includes(pr.name.getText(sf)));
          const veredictos = datos.map((pr) => {
            const ini = ts.isPropertyAssignment(pr) ? pr.initializer : pr.name;
            if (!ts.isObjectLiteralExpression(ini)) return `OPACO (${pr.name.getText(sf)}: ${ini.getText(sf).replace(/\s+/g, ' ').slice(0, 40)})`;
            const claves = ini.properties.map((q) => (ts.isSpreadAssignment(q) ? '...' + q.expression.getText(sf).slice(0, 30) : q.name.getText(sf)));
            if (claves.includes('flags')) return 'ESCRIBE flags';
            const spreads = claves.filter((c) => c.startsWith('...'));
            return spreads.length ? `OPACO (spread ${spreads.join(',')})` : 'literal sin flags';
          });
          clase = veredictos.length ? [...new Set(veredictos)].join(' + ') : 'sin data';
        }
        escr.push({ donde: `${rel(p)}:${linea(sf, n)}`, metodo: n.expression.name.text, clase, en: dentroDe(n) });
      }
      ts.forEachChild(n, v);
    };
    v(sf);
  }
};
censarEscr(src); const nSrc = escr.length; censarEscr(scripts);
console.log(`\nC · escrituras de <x>.merchant.{${[...ESCR].join(',')}}: src/ ${nSrc} · scripts/+prisma/ ${escr.length - nSrc}`);
const cuenta = new Map(); for (const e of escr) { const k = e.clase.replace(/\(.*\)/, '(…)'); cuenta.set(k, (cuenta.get(k) || 0) + 1); }
console.log('   por clase: ' + [...cuenta].map(([k, n]) => `${k}=${n}`).join(' · '));
for (const e of escr) if (e.clase !== 'literal sin flags') console.log(`   ${e.donde} · ${e.metodo} · ${e.clase} · en ${e.en}`);
