// SCRUM-1576 · censo por AST: desde un DOCUMENTO (factura, albarán, presupuesto, gasto, trabajo,
// parte, cobro), ¿quién lee el cliente o el proveedor VIVO por su relación?
//
// Uso:  node docs/master/evidencias/SCRUM-1576/censo.mjs [--sin-semilla]
//
// Dos patrones:
//   R · RELACIÓN: una consulta Prisma sobre un modelo-documento cuyo argumento lleva, a
//       cualquier profundidad, una clave `customer` o `provider` (include/select anidados).
//   S · SEGUNDO PASO: una función que consulta un modelo-documento y, en la misma función,
//       llama a `customer.find*` / `provider.find*` (lectura del vivo por id, en dos pasos).
// Control POSITIVO SEMBRADO: una fuente fabricada aquí con los dos patrones. Si no sale en la
// salida, el instrumento está CIEGO (salida 2), no limpio. `--sin-semilla` la quita para ver
// que entonces lo dice. Control CERO: una consulta-documento sin cliente, en la misma semilla,
// que NO debe salir.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const require = createRequire(join(raiz, 'package.json'));
let ts;
try { ts = require('typescript'); } catch { ts = createRequire(join(raiz, '..', '..', '..', 'package.json'))('typescript'); }

const DOCUMENTOS = new Set(['invoice', 'albaran', 'quote', 'expense', 'job', 'parteTrabajo', 'charge', 'maintenancePlan']);
const RELACIONES = new Set(['customer', 'provider']);
const LEC_VIVO = /^(findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|findMany)$/;
const LEC_DOC = /^(findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|findMany|update|create|upsert)$/;

const SEMILLA = `
async function semillaR(db, id) {
  return db.invoice.findUnique({ where: { id }, include: { customer: true } });
}
async function semillaS(db, id) {
  const f = await db.expense.findFirst({ where: { id } });
  return db.provider.findUnique({ where: { id: f.providerId } });
}
async function semillaCero(db, id) {
  return db.invoice.findUnique({ where: { id }, select: { customerName: true } });
}
`;

function ficheros(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...ficheros(p));
    else if (/\.ts$/.test(n) && !/\.d\.ts$/.test(n)) out.push(p);
  }
  return out;
}

// `<algo>.<modelo>.<método>(…)` → [modelo, método]
function llamadaPrisma(nodo) {
  if (!ts.isCallExpression(nodo) || !ts.isPropertyAccessExpression(nodo.expression)) return null;
  const metodo = nodo.expression.name.text;
  const obj = nodo.expression.expression;
  if (!ts.isPropertyAccessExpression(obj)) return null;
  return [obj.name.text, metodo];
}

function clavesRelacion(nodo, ruta, acc) {
  if (ts.isObjectLiteralExpression(nodo)) {
    for (const p of nodo.properties) {
      if (!ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p)) continue;
      const k = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;
      if (!k) continue;
      if (RELACIONES.has(k)) acc.push([...ruta, k].join('.'));
      if (ts.isPropertyAssignment(p)) clavesRelacion(p.initializer, [...ruta, k], acc);
    }
  }
  return acc;
}

function funcionQueContiene(n) {
  for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return p;
  return n.getSourceFile();
}

function censar(nombre, texto) {
  const sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const hallazgos = [];
  const porFuncion = new Map(); // función → { docs:[], vivos:[] }
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  (function visita(n) {
    const lp = llamadaPrisma(n);
    if (lp) {
      const [modelo, metodo] = lp;
      const f = funcionQueContiene(n);
      if (!porFuncion.has(f)) porFuncion.set(f, { docs: [], vivos: [] });
      if (DOCUMENTOS.has(modelo) && LEC_DOC.test(metodo)) {
        porFuncion.get(f).docs.push(`${modelo}:${linea(n)}`);
        const arg = n.arguments[0];
        const claves = arg ? clavesRelacion(arg, [], []) : [];
        for (const c of claves) hallazgos.push({ patron: 'R', fichero: nombre, linea: linea(n), modelo, metodo, clave: c });
      }
      if (RELACIONES.has(modelo) && LEC_VIVO.test(metodo)) porFuncion.get(f).vivos.push({ modelo, metodo, linea: linea(n) });
    }
    ts.forEachChild(n, visita);
  })(sf);
  // V · el resto de lecturas del vivo: el documento puede llegar por un helper de otro fichero
  // (`leerLibroRecibidas` → `provider.findMany`, SCRUM-1058c), y S no lo ve. V es la población
  // entera de lecturas de ficha; cada una se lee a mano o por agente.
  for (const [, v] of porFuncion) {
    for (const x of v.vivos) {
      const patron = v.docs.length ? 'S' : 'V';
      hallazgos.push({ patron, fichero: nombre, linea: x.linea, modelo: x.modelo, metodo: x.metodo, clave: v.docs.length ? `tras ${v.docs.join(',')}` : 'sin documento en la función' });
    }
  }
  return hallazgos;
}

const conSemilla = !process.argv.includes('--sin-semilla');
const lista = ficheros(join(raiz, 'src'));
let todos = [];
for (const f of lista) todos.push(...censar(relative(raiz, f).split(sep).join('/'), readFileSync(f, 'utf8')));
const semilla = conSemilla ? censar('<semilla>', SEMILLA) : [];

const posR = semilla.some((h) => h.patron === 'R' && h.modelo === 'invoice' && h.clave === 'include.customer');
const posS = semilla.some((h) => h.patron === 'S' && h.modelo === 'provider');
const cero = semilla.filter((h) => h.linea >= 9).length; // semillaCero empieza en la línea 9

for (const h of todos) console.log(`${h.patron}\t${h.fichero}:${h.linea}\t${h.modelo}.${h.metodo}\t${h.clave}`);
const n = (p) => todos.filter((h) => h.patron === p).length;
console.log(`POBLACIÓN: ${lista.length} ficheros .ts de src/ · hallazgos ${todos.length} (R ${n('R')}, S ${n('S')}, V ${n('V')}) · ficheros con hallazgo ${new Set(todos.map((h) => h.fichero)).size}`);
// Testigo del árbol (NO es el control: se jubilaría el día que alguien lo arregle; el control es
// la semilla). Sólo dice si el lector conocido de 1058c sigue donde estaba.
const testigo = todos.some((h) => h.fichero === 'src/modules/fiscal/librosAeat/librosAeat.repo.ts' && h.modelo === 'provider');
console.log(`TESTIGO del árbol (recibidas → provider.findMany): ${testigo ? 'visto' : 'no visto'}`);
console.log(`SEMILLA: ${conSemilla ? 'puesta' : 'QUITADA'} · positivo R ${posR ? 'visto' : 'NO visto'} · positivo S ${posS ? 'visto' : 'NO visto'} · control cero ${cero} (debe ser 0)`);
if (!posR || !posS || cero !== 0 || lista.length === 0) { console.log('VEREDICTO: CIEGO'); process.exit(2); }
console.log('VEREDICTO: MIDE');
