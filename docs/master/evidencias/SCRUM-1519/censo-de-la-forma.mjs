// SCRUM-1519 · LA FORMA, EN GENERAL: cuántas consultas de src/ buscan una fila de un modelo que
// TIENE columna de comercio sin poner el comercio en su `where`.
//
// ES ESTÁTICO (AST de TypeScript, no grep): dice DÓNDE está escrita la forma, no si cruza. Si cruza
// lo dice el EFECTO, y eso lo miden `medir-los-llamadores.mjs` (aquí al lado) y el censo del eje de
// comercio de SCRUM-1514 (191 rutas de /admin).
//
// POBLACIÓN: toda llamada `<algo>.<modelo>.<operación>(…)` de los .ts de src/, donde <modelo> es un
// modelo de prisma/schema.prisma (LEÍDO, no escrito aquí) y <operación> una de OPS.
//
// VEREDICTO de cada llamada, por lo que lleva su `where`:
//   ATADA          · nombra el comercio (`merchantId`, una clave compuesta que lo lleva, o la
//                    relación `merchant`), a cualquier profundidad
//   SOLO-POR-ID    · where literal, lleva `id` y NO nombra el comercio        ← LA FORMA
//   POR-OTRA-CLAVE · where literal, sin `id` y sin comercio (token, jobId, quoteId…)
//   ILEGIBLE       · el where no es un literal que se pueda leer aquí (variable de otro sitio,
//                    parámetro, propagación `...x` sin comercio a la vista). NO se cuenta como atada.
//   SIN-WHERE      · no lleva where (un findMany de toda la tabla, o un create)
//
// EL PAR SEMBRADO: fuentes de mentira que escribe este fichero en memoria y pasa por la MISMA
// función que los de verdad. Si no las separa, sale 1. Con `--sin-siembra` sale 2 (CIEGO): un
// recuento sin el par no vale. Con `--sordo` (el detector de comercio dice siempre que sí) tiene que
// salir 1: es el rojo.
//
// Uso: node censo-de-la-forma.mjs <raíz del árbol> <ruta a typescript> [--sordo] [--sin-siembra] [--lista]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const raiz = process.argv[2]; const rutaTs = process.argv[3];
const fin = (n, m) => { if (m) console.log(m); console.log('EXIT=' + n); process.exit(n); };
if (!raiz || !rutaTs) fin(2, 'CIEGO: faltan la raíz del árbol y la ruta a typescript');
const SORDO = process.argv.includes('--sordo');
const SIN_SIEMBRA = process.argv.includes('--sin-siembra');
const LISTA = process.argv.includes('--lista');
const ts = createRequire(import.meta.url)(rutaTs);

// ── Los modelos, leídos del esquema (regla 40: se LEE)
const esquema = fs.readFileSync(path.join(raiz, 'prisma', 'schema.prisma'), 'utf8');
const minus = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const modelos = new Map(); // nombre en minúscula inicial → tiene columna de comercio
for (const m of esquema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
  modelos.set(minus(m[1]), /^\s*merchantId\s+Int/m.test(m[2]));
}
const conComercio = [...modelos].filter(([, v]) => v).map(([k]) => k);
if (modelos.size < 20 || !modelos.get('invoice') || !modelos.get('customer') || !modelos.get('job') || modelos.get('merchant') !== false) {
  fin(2, 'CIEGO: el esquema leído no es el que debería (modelos ' + modelos.size + ')');
}

const UNA = ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow'];
const VARIAS = ['findMany', 'count', 'aggregate', 'groupBy'];
const ESCRIBE = ['update', 'updateMany', 'delete', 'deleteMany', 'upsert'];
const OPS = new Set([...UNA, ...VARIAS, ...ESCRIBE]);

// ── El detector. `nombraComercio` es lo ÚNICO que `--sordo` estropea.
function nombres(nodo, out) {
  const visita = (n) => {
    if (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) out.push(n.name.getText());
    ts.forEachChild(n, visita);
  };
  visita(nodo); return out;
}
const nombraComercio = (claves) => SORDO || claves.some((k) => /merchantId/i.test(k) || k === 'merchant');

// Un `where` que es una variable se sigue UN salto: `const where = { … }` en la misma función, más
// lo que se le asigne después (`where.merchantId = …`). Más lejos no se sigue: ILEGIBLE.
function literalDe(nodo, llamada) {
  if (ts.isObjectLiteralExpression(nodo)) return { lit: nodo, extra: [] };
  if (ts.isAsExpression(nodo) || ts.isParenthesizedExpression(nodo)) return literalDe(nodo.expression, llamada);
  if (!ts.isIdentifier(nodo)) return null;
  let fn = llamada.parent;
  while (fn && !ts.isFunctionLike(fn) && !ts.isSourceFile(fn)) fn = fn.parent;
  if (!fn) return null;
  let lit = null; const extra = [];
  const visita = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nodo.text && n.initializer) {
      let ini = n.initializer; while (ts.isAsExpression(ini) || ts.isParenthesizedExpression(ini)) ini = ini.expression;
      if (ts.isObjectLiteralExpression(ini)) lit = ini;
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left)
      && ts.isIdentifier(n.left.expression) && n.left.expression.text === nodo.text) extra.push(n.left.name.text);
    ts.forEachChild(n, visita);
  };
  visita(fn);
  return lit ? { lit, extra } : null;
}

function censar(texto, nombre) {
  const sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true);
  const filas = [];
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && OPS.has(n.expression.name.text)
      && ts.isPropertyAccessExpression(n.expression.expression) && modelos.has(n.expression.expression.name.text)) {
      const modelo = n.expression.expression.name.text; const op = n.expression.name.text;
      const linea = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
      const arg = n.arguments[0];
      let whereNodo = null;
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const p of arg.properties) {
          if (ts.isPropertyAssignment(p) && p.name.getText() === 'where') whereNodo = p.initializer;
          if (ts.isShorthandPropertyAssignment(p) && p.name.getText() === 'where') whereNodo = p.name;
        }
      }
      let v; let texto = ''; let valorId = '';
      if (arg && !ts.isObjectLiteralExpression(arg)) { v = 'ILEGIBLE'; texto = arg.getText(); }
      else if (!whereNodo) v = 'SIN-WHERE';
      else {
        texto = whereNodo.getText().replace(/\s+/g, ' ');
        const r = literalDe(whereNodo, n);
        if (!r) v = nombraComercio([]) ? 'ATADA' : 'ILEGIBLE';
        else {
          const claves = [...nombres(r.lit, []), ...r.extra];
          const propaga = r.lit.properties.some((p) => ts.isSpreadAssignment(p));
          const arriba = r.lit.properties.filter((p) => ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p));
          const id = arriba.find((p) => p.name.getText() === 'id');
          if (id) valorId = ts.isPropertyAssignment(id) ? id.initializer.getText().replace(/\s+/g, ' ') : 'id';
          if (nombraComercio(claves)) v = 'ATADA';
          else if (propaga) v = 'ILEGIBLE';
          else if (id) v = 'SOLO-POR-ID';
          else v = 'POR-OTRA-CLAVE';
          if (r.lit !== whereNodo) texto += '  ⇐ ' + r.lit.getText().replace(/\s+/g, ' ').slice(0, 120);
        }
      }
      filas.push({ fichero: nombre, linea, modelo, op, v, where: texto.slice(0, 160), valorId,
        receptor: n.expression.expression.expression.getText().slice(0, 20) });
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return filas;
}

// ── EL PAR SEMBRADO (no existe en src/: son cadenas de este fichero)
const SIEMBRA = [
  ['cruza-por-id', 'SOLO-POR-ID', 'async function f(prisma, id) { return prisma.invoice.findUnique({ where: { id }, include: { customer: true } }); }'],
  ['filtra', 'ATADA', 'async function f(prisma, id, req) { return prisma.invoice.findFirst({ where: { id, merchantId: req.merchantId } }); }'],
  ['cruza-id-de-otra-fila', 'SOLO-POR-ID', 'async function f(prisma, job) { return prisma.customer.findUnique({ where: { id: job.customerId }, select: { name: true } }); }'],
  ['filtra-por-relacion', 'ATADA', 'async function f(tx, job) { return tx.jobAssignee.findMany({ where: { jobId: job.id, teamMember: { merchantId: job.merchantId } } }); }'],
  ['cruza-en-lote', 'SOLO-POR-ID', 'async function f(prisma, ids) { return prisma.customer.findMany({ where: { id: { in: ids } } }); }'],
  ['filtra-variable', 'ATADA', 'async function f(prisma, req) { const where: any = { id: 1 }; where.merchantId = req.merchantId; return prisma.job.findMany({ where }); }'],
  ['cruza-variable', 'SOLO-POR-ID', 'async function f(prisma) { const where = { id: 1 }; return prisma.job.update({ where, data: {} }); }'],
  ['escribe-cruza', 'SOLO-POR-ID', 'async function f(tx, id) { return tx.quote.update({ where: { id }, data: { status: "x" } }); }'],
  ['filtra-clave-compuesta', 'ATADA', 'async function f(prisma, m, n) { return prisma.invoice.findUnique({ where: { merchantId_number: { merchantId: m, number: n } } }); }'],
  ['otra-clave', 'POR-OTRA-CLAVE', 'async function f(prisma, t) { return prisma.quote.findFirst({ where: { publicToken: t } }); }'],
  ['de-otro-sitio', 'ILEGIBLE', 'async function f(prisma, where) { return prisma.quote.findMany({ where }); }'],
];
let siembraMal = 0; const siembraSalida = [];
if (!SIN_SIEMBRA) {
  for (const [nombre, esperado, fuente] of SIEMBRA) {
    const f = censar(fuente, '__siembra-1519/' + nombre + '.ts');
    const sale = f.length === 1 ? f[0].v : 'filas=' + f.length;
    if (sale !== esperado) siembraMal += 1;
    siembraSalida.push((sale === esperado ? '  ✓ ' : '  ✗ ') + nombre.padEnd(24) + ' espera ' + esperado.padEnd(15) + ' sale ' + sale);
  }
}

// ── El árbol de verdad
const ficheros = [];
const anda = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) anda(p); else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) ficheros.push(p);
} };
anda(path.join(raiz, 'src'));
const todas = [];
for (const f of ficheros) todas.push(...censar(fs.readFileSync(f, 'utf8'), path.relative(raiz, f).replace(/\\/g, '/')));

const cuenta = (l, clave) => { const o = {}; for (const x of l) o[clave(x)] = (o[clave(x)] || 0) + 1; return o; };
const pinta = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · ');
const clase = (x) => (modelos.get(x.modelo) ? 'CON-COLUMNA' : x.modelo === 'merchant' ? 'MERCHANT' : 'SIN-COLUMNA');
const dondeEs = (x) => (/\.routes\.ts$/.test(x.fichero) ? 'ruta' : 'no-ruta');
const tipo = (x) => (UNA.includes(x.op) ? 'lee-una' : VARIAS.includes(x.op) ? 'lee-varias' : 'escribe');

console.log('SCRUM-1519 · censo de la forma (estático, AST)' + (SORDO ? ' · ⚠️ SORDO: esto es el rojo, no una medición' : ''));
console.log('POBLACION: ' + ficheros.length + ' ficheros .ts de src/ · ' + todas.length + ' llamadas a Prisma con operación de OPS (' + [...OPS].length + ' operaciones) · modelos del esquema '
  + modelos.size + ', con columna de comercio ' + conComercio.length + ' · ficheros con alguna llamada ' + new Set(todas.map((x) => x.fichero)).size);
console.log('  por clase de modelo: ' + pinta(cuenta(todas, clase)));
console.log('  receptores: ' + pinta(cuenta(todas, (x) => x.receptor)).slice(0, 300));

console.log('\n── EL PAR SEMBRADO (' + (SIN_SIEMBRA ? 'QUITADO' : SIEMBRA.length + ' fuentes de mentira') + ')');
for (const l of siembraSalida) console.log(l);

const con = todas.filter((x) => clase(x) === 'CON-COLUMNA');
console.log('\n── MODELOS CON COLUMNA DE COMERCIO · ' + con.length + ' llamadas');
console.log('  ' + pinta(cuenta(con, (x) => x.v)));
const forma = con.filter((x) => x.v === 'SOLO-POR-ID');
console.log('\n── LA FORMA · SOLO-POR-ID sobre modelo con columna de comercio · ' + forma.length + ' llamadas en ' + new Set(forma.map((x) => x.fichero)).size + ' ficheros');
console.log('  por tipo:    ' + pinta(cuenta(forma, tipo)));
console.log('  por sitio:   ' + pinta(cuenta(forma, dondeEs)));
console.log('  tipo×sitio:  ' + pinta(cuenta(forma, (x) => tipo(x) + '/' + dondeEs(x))));
console.log('  por modelo:  ' + pinta(cuenta(forma, (x) => x.modelo)));
console.log('  por fichero: ' + pinta(cuenta(forma, (x) => x.fichero.replace(/^src\/(modules\/)?/, ''))));
const otra = con.filter((x) => x.v === 'POR-OTRA-CLAVE');
console.log('\n── POR-OTRA-CLAVE (sin id y sin comercio) · ' + otra.length + ' · por tipo×sitio: ' + pinta(cuenta(otra, (x) => tipo(x) + '/' + dondeEs(x))));
const ileg = con.filter((x) => x.v === 'ILEGIBLE');
console.log('── ILEGIBLE · ' + ileg.length + ' · NO juzgadas: ni atadas ni sueltas · por sitio: ' + pinta(cuenta(ileg, dondeEs)));
const sinw = con.filter((x) => x.v === 'SIN-WHERE');
console.log('── SIN-WHERE · ' + sinw.length + ' · por operación: ' + pinta(cuenta(sinw, (x) => x.op)));
const sinCol = todas.filter((x) => clase(x) === 'SIN-COLUMNA');
console.log('\n── MODELOS SIN COLUMNA (sólo se atan por el padre) · ' + sinCol.length + ' llamadas · ' + pinta(cuenta(sinCol, (x) => x.v)) + ' · modelos: ' + pinta(cuenta(sinCol, (x) => x.modelo)));
const mer = todas.filter((x) => clase(x) === 'MERCHANT');
console.log('── MERCHANT (su id ES el comercio) · ' + mer.length + ' llamadas · ' + pinta(cuenta(mer, (x) => x.v)));

// El caso que dio pie al ticket TIENE que estar en la lista: si no, el censo no ve lo que ya sabemos.
const elDelTicket = forma.filter((x) => /jobs\.routes\.ts$/.test(x.fichero) && x.modelo === 'customer' && x.op === 'findUnique' && /job\.customerId/.test(x.where));
console.log('\n── EL DEL TICKET (customer.findUnique por job.customerId en jobs.routes.ts): ' + elDelTicket.length + ' → ' + elDelTicket.map((x) => x.fichero + ':' + x.linea).join(', '));

if (LISTA) {
  console.log('\n── LISTA · SOLO-POR-ID (' + forma.length + ')');
  for (const x of forma) console.log(`${x.fichero}:${x.linea}  ${x.modelo}.${x.op}  [${tipo(x)}/${dondeEs(x)}]  ${x.where}`);
  console.log('\n── LISTA · POR-OTRA-CLAVE (' + otra.length + ')');
  for (const x of otra) console.log(`${x.fichero}:${x.linea}  ${x.modelo}.${x.op}  [${tipo(x)}/${dondeEs(x)}]  ${x.where}`);
  console.log('\n── LISTA · ILEGIBLE (' + ileg.length + ')');
  for (const x of ileg) console.log(`${x.fichero}:${x.linea}  ${x.modelo}.${x.op}  [${tipo(x)}/${dondeEs(x)}]  ${x.where}`);
}

if (SIN_SIEMBRA) fin(2, '\nCIEGO: sin el par sembrado este recuento no distingue «no hay» de «no veo».');
if (siembraMal) fin(1, '\nROJO: ' + siembraMal + ' de ' + SIEMBRA.length + ' fuentes sembradas no salen como deben: el censo de arriba NO vale.');
if (!todas.length || !ficheros.length) fin(2, '\nCIEGO: población vacía.');
fin(0, '\nEl par sembrado se separa (' + SIEMBRA.length + ' de ' + SIEMBRA.length + ').');
