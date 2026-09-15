// Censo SCRUM-752 ②: consultas de Prisma que sirven TODA la tabla por no llevar `select` de
// primer nivel. No es «le falta un select»: es que cada columna nueva del modelo entra sola por
// esa ruta sin que nadie lo decida.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = 'C:/Users/Javier Pereira/cobroflash-b5';
const ts = createRequire(RAIZ + '/package.json')('typescript');

const LECTORAS = new Set(['findMany', 'findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow']);

/** Ficheros .ts de src/, sin bajar a node_modules. */
function ficheros(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const texto = (n, sf) => n.getText(sf).replace(/\s+/g, ' ');

/** ¿Es `<algo>.<modelo>.<lectora>({...})`? Devuelve {modelo, metodo, arg} o null. */
function lectura(n, sf) {
  if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return null;
  const metodo = n.expression.name.text;
  if (!LECTORAS.has(metodo)) return null;
  const sujeto = n.expression.expression;
  if (!ts.isPropertyAccessExpression(sujeto)) return null;
  const modelo = sujeto.name.text;
  const raiz = texto(sujeto.expression, sf);
  if (!/\b(prisma|tx|db|client)\b/i.test(raiz)) return null;
  const arg = n.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) return null;
  return { modelo, metodo, arg };
}

const prop = (obj, nombre) =>
  obj.properties.find((p) => p.name && ts.isIdentifier(p.name) && p.name.text === nombre);

const hallazgos = [];
let totalLecturas = 0;
let conSelect = 0;

for (const f of ficheros(path.join(RAIZ, 'src'))) {
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const rec = (n) => {
    const L = lectura(n, sf);
    if (L) {
      totalLecturas += 1;
      const tieneSelect = !!prop(L.arg, 'select');
      const tieneInclude = !!prop(L.arg, 'include');
      if (tieneSelect) conSelect += 1;
      else {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        hallazgos.push({
          fichero: path.relative(RAIZ, f).split(path.sep).join('/'),
          linea: line + 1,
          modelo: L.modelo,
          metodo: L.metodo,
          conInclude: tieneInclude,
        });
      }
    }
    ts.forEachChild(n, rec);
  };
  rec(sf);
}

// ── SUELO del propio censo ────────────────────────────────────────────────────────────────
// Si no reconoce NINGUNA lectura, o no reconoce ninguna CON select, no está clasificando:
// está contestando lo mismo a todo, y su lista no significaría nada.
const motivos = [];
if (!totalLecturas) motivos.push('CERO lecturas de Prisma reconocidas en src/');
if (!conSelect) motivos.push('NINGUNA lectura con `select`: el clasificador no distingue');
if (!hallazgos.length) motivos.push('CERO sin select: el caso de listProducts está medido y existe');

console.log('CENSO SCRUM-752 ② · lecturas de Prisma SIN `select` de primer nivel');
console.log('='.repeat(92));
console.log(`lecturas de Prisma en src/ : ${totalLecturas}`);
console.log(`  · con \`select\`           : ${conSelect}`);
console.log(`  · SIN \`select\`           : ${hallazgos.length}   ← sirven TODA la tabla, hoy y mañana`);
console.log(`    de ellas, con \`include\`: ${hallazgos.filter((h) => h.conInclude).length}`);
console.log('');
if (motivos.length) {
  console.log('🔴 CIEGO: ' + motivos.join(' · '));
  process.exit(3);
}

const porModelo = new Map();
for (const h of hallazgos) porModelo.set(h.modelo, (porModelo.get(h.modelo) || 0) + 1);
console.log('POR MODELO (los diez primeros):');
for (const [m, n] of [...porModelo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`   ${String(n).padStart(4)}  ${m}`);
}
console.log('');
console.log('¿Y el sujeto del ticket?');
for (const h of hallazgos.filter((x) => x.fichero.includes('products.service'))) {
  console.log(`   ${h.fichero}:${h.linea}  ${h.modelo}.${h.metodo}  include=${h.conInclude}`);
}
console.log('');
console.log(`modelos distintos afectados: ${porModelo.size}`);
