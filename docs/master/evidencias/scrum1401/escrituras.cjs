// escrituras.cjs — SCRUM-1401: qué escribe el código en cada campo, por AST.
//   node escrituras.cjs <raiz con src/> <ruta a typescript>
// Nivel 1: propiedad <campo> dentro de una llamada <algo>.<delegado>.<metodo de escritura>(...).
// Nivel 2: propiedad <campo> en cualquier objeto literal de un fichero que nombra al delegado
//          (el `data` construido fuera de la llamada). Se lista aparte: se revisa a mano.
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(process.argv[2]);
const ts = require(path.resolve(process.argv[3]));

const OBJETIVOS = [
  ['merchant', 'subscriptionStatus'],
  ['quote', 'origin'],
  ['quote', 'createdVia'],
  ['invoice', 'type'],
  ['botSession', 'state'],
  ['quoteTemplate', 'paymentTerms'],
  ['customerEvent', 'type'],
  ['whatsAppMessage', 'type'],
  ['whatsAppMessage', 'status'],
  ['whatsAppMessage', 'relatedType'],
  ['attachment', 'entityType'],
  ['attachment', 'kind'],
  ['emailMessage', 'kind'],
  ['emailMessage', 'relatedType'],
  // controles
  ['merchant', 'plan'],            // positivo: tiene que ver escrituras
  ['merchant', 'campoQueNoExiste'], // negativo: 0
  ['delegadoQueNoExiste', 'type'],  // negativo: 0
];
const ESCRIBE = new Set(['create', 'update', 'upsert', 'createMany', 'updateMany', 'createManyAndReturn']);

function ficheros(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}
const lista = ficheros(path.join(raiz, 'src'));
let sinParsear = 0;
const n1 = new Map();
const n2 = new Map();
const clave = (d, c) => `${d}.${c}`;
for (const [d, c] of OBJETIVOS) { n1.set(clave(d, c), []); n2.set(clave(d, c), []); }

function delegadoDe(call) {
  // <x>.<delegado>.<metodo>(...)
  const e = call.expression;
  if (!ts.isPropertyAccessExpression(e)) return null;
  if (!ESCRIBE.has(e.name.text)) return null;
  const o = e.expression;
  if (!ts.isPropertyAccessExpression(o)) return null;
  return { delegado: o.name.text, metodo: e.name.text };
}

for (const f of lista) {
  const texto = fs.readFileSync(f, 'utf8');
  let sf;
  try { sf = ts.createSourceFile(f, texto, ts.ScriptTarget.Latest, true); } catch { sinParsear += 1; continue; }
  const rel = path.relative(raiz, f).replace(/\\/g, '/');
  const delegadosNombrados = new Set();
  const props = [];
  (function ver(n, pila) {
    let p = pila;
    if (ts.isCallExpression(n)) {
      const d = delegadoDe(n);
      if (d) { p = [...pila, d]; }
    }
    if (ts.isPropertyAccessExpression(n)) delegadosNombrados.add(n.name.text);
    if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && n.name && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))) {
      const linea = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
      const valor = ts.isPropertyAssignment(n) ? n.initializer.getText().replace(/\s+/g, ' ').slice(0, 140) : '(abreviada)';
      props.push({ nombre: n.name.text, linea, valor, pila: p });
    }
    ts.forEachChild(n, (h) => ver(h, p));
  })(sf, []);
  for (const [d, c] of OBJETIVOS) {
    for (const pr of props) {
      if (pr.nombre !== c) continue;
      const dentro = pr.pila.find((x) => x.delegado === d);
      if (dentro) n1.get(clave(d, c)).push(`${rel}:${pr.linea}  [${dentro.metodo}]  ${pr.valor}`);
      else if (delegadosNombrados.has(d)) n2.get(clave(d, c)).push(`${rel}:${pr.linea}  ${pr.valor}`);
    }
  }
}

console.log(`POBLACION: ${lista.length} ficheros .ts bajo src/ · ${sinParsear} sin parsear · ${OBJETIVOS.length} objetivos (3 son controles)`);
for (const [d, c] of OBJETIVOS) {
  const k = clave(d, c);
  console.log(`\n=== ${k} · nivel 1: ${n1.get(k).length} · nivel 2: ${n2.get(k).length}`);
  for (const l of n1.get(k)) console.log(`  1 ${l}`);
  for (const l of n2.get(k)) console.log(`  2 ${l}`);
}
const pos = n1.get('merchant.plan').length;
const neg = n1.get('merchant.campoQueNoExiste').length + n2.get('merchant.campoQueNoExiste').length + n1.get('delegadoQueNoExiste.type').length + n2.get('delegadoQueNoExiste.type').length;
const ok = lista.length > 0 && sinParsear === 0 && pos > 0 && neg === 0;
console.log(`\nCONTROLES: positivo merchant.plan=${pos} (tiene que ser >0) · negativos=${neg} (tiene que ser 0)`);
console.log(ok ? 'EXIT=0' : 'CIEGO\nEXIT=2');
process.exit(ok ? 0 : 2);
