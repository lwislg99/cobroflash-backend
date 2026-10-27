// SCRUM-1615 · censo por AST: lecturas de campos de `Merchant` que NO existen en `prisma/schema.prisma`.
//
// Uso:  node docs/master/evidencias/SCRUM-1615/censo-campos-merchant.mjs [raíz]  [--sin-semilla]
//
// Qué mide. Población: todo `src/**/*.ts`, parseado con `ts.createSourceFile` (sin Program: no
// hay tipos, y el caso del ticket va precisamente por `as any`, que borra el tipo). Sujeto: cada
// acceso `R.campo` o `R?.campo` cuyo receptor R, quitados paréntesis, `as`, `!` y `satisfies`,
// termina en un identificador que se llame `merchant` (sin distinguir mayúsculas). Se excluyen los
// delegados de Prisma (`prisma.merchant.findUnique`, `tx.merchant.update`…): ahí el receptor es
// el modelo, no una fila. Veredicto: el campo está o no está entre los campos del bloque
// `model Merchant { … }` del esquema (escalares Y relaciones).
//
// Qué NO mide (y se dice): un receptor con otro nombre (`m.campo`, `row.campo`), una
// desestructuración (`const { campo } = merchant`) ni un `merchant['campo']` con corchetes. Un
// receptor llamado `merchant` que no sea una fila de Prisma (un DTO, un objeto de prueba) sale
// igual: cada fuera-de-esquema se revisa a mano, no se da por defecto.
//
// Controles. POSITIVO SEMBRADO: se añade a la población un fichero fabricado aquí mismo, con
// `(charge.merchant as any).campoSembrado1615`. Si el censo no lo caza, sale CIEGO (código 2), no
// verde. Con `--sin-semilla` el positivo no se siembra y el censo TIENE que decir CIEGO: así se
// comprueba que el veredicto depende de la semilla. CERO DERIVADO: `connectStatus`, que el bloque
// del esquema declara, tiene que salir como «en el esquema» y nunca entre los ausentes.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const sinSemilla = args.includes('--sin-semilla');
const raiz = path.resolve(args.find(a => !a.startsWith('--')) || '.');
const require = createRequire(path.join(raiz, 'package.json'));
const ts = require('typescript');

// ── 1 · Los campos de Merchant, del esquema ────────────────────────────────────────────────────
const esquema = fs.readFileSync(path.join(raiz, 'prisma', 'schema.prisma'), 'utf8');
const bloque = esquema.match(/^model Merchant \{([\s\S]*?)^\}/m);
if (!bloque) { console.log('CIEGO: no encuentro `model Merchant {` en el esquema'); process.exit(2); }
const campos = new Set();
for (const linea of bloque[1].split('\n')) {
  const t = linea.trim();
  if (!t || t.startsWith('//') || t.startsWith('@@')) continue;
  const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s/);
  if (m) campos.add(m[1]);
}

// ── 2 · La población: src/**/*.ts ──────────────────────────────────────────────────────────────
function listar(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listar(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}
const ficheros = listar(path.join(raiz, 'src')).map(p => ({
  nombre: path.relative(raiz, p).split(path.sep).join('/'),
  texto: fs.readFileSync(p, 'utf8'),
}));
const SEMILLA = '__semilla-1615__.ts';
if (!sinSemilla) {
  ficheros.push({ nombre: SEMILLA, texto: 'export const x = (charge.merchant as any).campoSembrado1615;\n' });
}

// ── 3 · El recorrido ───────────────────────────────────────────────────────────────────────────
function pelar(n) {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) ||
               ts.isTypeAssertionExpression?.(n) || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(n)))) {
    n = n.expression;
  }
  return n;
}
function nombreFinal(n) {
  n = pelar(n);
  if (ts.isIdentifier(n)) return n.text;
  if (ts.isPropertyAccessExpression(n)) return n.name.text;
  return null;
}
const METODOS_DELEGADO = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
  'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy']);
const accesos = [];   // todos los R.campo con R = …merchant
let delegados = 0;
for (const f of ficheros) {
  const sf = ts.createSourceFile(f.nombre, f.texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  (function visitar(n) {
    if (ts.isPropertyAccessExpression(n)) {
      const receptor = pelar(n.expression);
      const nr = nombreFinal(receptor);
      if (nr && nr.toLowerCase() === 'merchant') {
        // Delegado de Prisma: `<cliente>.merchant.<método>(…)`. Se reconoce por el MÉTODO llamado, no
        // por el nombre del cliente (la primera pasada filtraba por nombre y dejó pasar
        // `prismaClient` y `cliente`: 5 falsos ausentes).
        const llamado = ts.isCallExpression(n.parent) && n.parent.expression === n;
        if (ts.isPropertyAccessExpression(receptor) && llamado && METODOS_DELEGADO.has(n.name.text)) { delegados++; }
        else {
          const { line } = sf.getLineAndCharacterOfPosition(n.name.getStart(sf));
          accesos.push({ fichero: f.nombre, linea: line + 1, campo: n.name.text,
                         anyCast: /\bas\s+any\b/.test(n.expression.getText(sf)),
                         texto: n.getText(sf).replace(/\s+/g, ' ').slice(0, 90) });
        }
      }
    }
    ts.forEachChild(n, visitar);
  })(sf);
}

const ausentes = accesos.filter(a => !campos.has(a.campo));
const semilla = ausentes.filter(a => a.fichero === SEMILLA);
const reales = ausentes.filter(a => a.fichero !== SEMILLA);
const ceroDerivado = accesos.filter(a => a.campo === 'connectStatus');

// ── 4 · El informe ─────────────────────────────────────────────────────────────────────────────
console.log(`POBLACIÓN: ${ficheros.length} ficheros (${ficheros.length - (sinSemilla ? 0 : 1)} de src/ + ${sinSemilla ? 0 : 1} semilla)`);
console.log(`Campos de Merchant en el esquema: ${campos.size}`);
console.log(`Accesos R.campo con R = …merchant: ${accesos.length} (delegados de Prisma excluidos: ${delegados})`);
console.log(`  en el esquema: ${accesos.length - ausentes.length} · fuera del esquema: ${ausentes.length} (semilla ${semilla.length} + árbol ${reales.length})`);
console.log(`CONTROL cero derivado · connectStatus: ${ceroDerivado.length} accesos, ${ceroDerivado.filter(a => !campos.has(a.campo)).length} dados por ausentes (tiene que ser 0)`);
console.log(`CONTROL positivo sembrado · campoSembrado1615: ${semilla.length} (tiene que ser 1)`);
console.log('');
const porCampo = new Map();
for (const a of reales) { if (!porCampo.has(a.campo)) porCampo.set(a.campo, []); porCampo.get(a.campo).push(a); }
console.log(`FUERA DEL ESQUEMA en src/: ${porCampo.size} campos distintos, ${reales.length} accesos`);
for (const [campo, lista] of [...porCampo].sort()) {
  console.log(`· ${campo} (${lista.length})`);
  for (const a of lista) console.log(`    ${a.fichero}:${a.linea}${a.anyCast ? '  [as any]' : ''}  ${a.texto}`);
}

if (ceroDerivado.some(a => !campos.has(a.campo))) { console.log('\nCIEGO: el cero derivado no es cero (el parseo del esquema falla)'); process.exit(2); }
if (semilla.length !== 1) { console.log(`\nCIEGO: el positivo sembrado no se cazó (${semilla.length})`); process.exit(2); }
console.log(`\nVEREDICTO: ${reales.length === 0 ? 'VERDE — ningún campo fuera del esquema' : `ROJO — ${reales.length} accesos fuera del esquema (revisar uno a uno)`}`);
process.exit(reales.length === 0 ? 0 : 1);
