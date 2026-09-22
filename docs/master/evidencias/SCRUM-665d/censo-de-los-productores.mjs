// docs/master/evidencias/SCRUM-665d/censo-de-los-productores.mjs — SCRUM-665 (D) · 17-sep-2026
//
// SOLO LECTURA. SEGUNDA SONDA, INDEPENDIENTE de `censo-de-las-bocas.mjs`.
//
// POR QUÉ DOS SONDAS Y NO UNA MÁS GRANDE (norma A3): la primera censa las BOCAS del embudo
// —dónde se ESCRIBE la fila—. Ésta censa los PRODUCTORES —dónde se LEE el dato que se congela—.
// No son la misma pregunta, y la respuesta a «cuántos sitios hay que tocar» sale de la segunda,
// no de la primera: `emitInvoice` es una boca que NO produce su congelado, lo recibe. Sus
// llamadores son sitios a tocar que la primera sonda no cuenta.
//
// Donde las dos sondas SÍ deben coincidir: los 6 productores que llaman al embudo directamente.
// Si discrepan, la discrepancia es el dato.
//
// SUELO: si no ve el tipo `ClienteCongelado` ni una sola llamada a `emitInvoice`, se declara
// CIEGO y sale con 3. Un cero sin suelo no es «no hay»: es «no he mirado».
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = process.argv[2];
const POBLACION_ESPERADA = Number(process.argv[3] || 288);
if (!RAIZ) {
  console.error('uso: node censo-de-los-productores.mjs <raiz-del-arbol-exportado> [poblacion]');
  process.exit(2);
}

const FREEZERS_CLIENTE = new Set(['congelarCliente', 'congelarParaRectificativa', 'congelarDesdeFicha']);
const FREEZERS_EMISOR = new Set(['congelarEmisor']);
const EMBUDO_1 = 'crearFacturaEmitida';
const EMBUDO_2 = 'emitInvoice';
// 🔴 SIN el prefijo `src/`: `rel()` mide desde la RAÍZ que se pasa por argumento, que ya ES
// `.../src`. Con el prefijo puesto, estas tres exclusiones no disparaban NUNCA y la aritmética
// salía inflada. Error mío, cazado porque el total no cuadraba con el desglose (ver informe).
const RUTA_EMBUDO_1 = 'modules/invoicing/domain/crearFacturaEmitida.ts';
const RUTA_EMBUDO_2 = 'modules/invoicing/domain/invoicing.service.ts';
const RUTA_FREEZER_CLIENTE = 'modules/invoicing/domain/clienteCongelado.ts';
const RUTA_FREEZER_EMISOR = 'modules/invoicing/domain/emisorCongelado.ts';

function ficherosTs(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(e.name)) ficherosTs(p, acc);
    } else if (e.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const nombreDe = (n) => (n && (ts.isIdentifier(n) || ts.isStringLiteralLike(n)) ? n.text : null);

function nombreLlamado(nodo) {
  if (!ts.isCallExpression(nodo)) return null;
  const c = nodo.expression;
  return ts.isPropertyAccessExpression(c) ? nombreDe(c.name) : nombreDe(c);
}

function esTransaccion(nodo) {
  if (!ts.isCallExpression(nodo)) return false;
  const c = nodo.expression;
  return ts.isPropertyAccessExpression(c) && nombreDe(c.name) === '$transaction';
}

const linea = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

/** ¿Hay una `$transaction` entre este nodo y la raíz? */
function txQueEnvuelve(sf, nodo) {
  let n = nodo.parent;
  while (n) {
    if (ts.isCallExpression(n) && esTransaccion(n)) return linea(sf, n);
    n = n.parent;
  }
  return null;
}

const productoresCliente = [];
const llamadasEmbudo2 = [];
const llamadasEmbudo1 = [];
const productoresEmisor = [];
let vistoTipoClienteCongelado = false;
let vistoTipoEmisorCongelado = false;
let ficherosParseados = 0;

for (const f of ficherosTs(RAIZ)) {
  const r = rel(f);
  const sf = ts.createSourceFile(r, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
  ficherosParseados++;

  (function anda(n) {
    if (ts.isInterfaceDeclaration(n) && nombreDe(n.name) === 'ClienteCongelado') vistoTipoClienteCongelado = true;
    if (ts.isInterfaceDeclaration(n) && nombreDe(n.name) === 'EmisorCongelado') vistoTipoEmisorCongelado = true;

    if (ts.isCallExpression(n)) {
      const nom = nombreLlamado(n);
      const tx = txQueEnvuelve(sf, n);
      const reg = { fichero: r, linea: linea(sf, n), tx, dondeTx: tx ? 'DENTRO' : 'FUERA' };

      if (nom && FREEZERS_CLIENTE.has(nom) && r !== RUTA_FREEZER_CLIENTE) {
        productoresCliente.push({ ...reg, que: nom });
      }
      if (nom && FREEZERS_EMISOR.has(nom) && r !== RUTA_FREEZER_EMISOR) {
        productoresEmisor.push({ ...reg, que: nom });
      }
      if (nom === EMBUDO_2 && r !== RUTA_EMBUDO_2) llamadasEmbudo2.push(reg);
      if (nom === EMBUDO_1 && r !== RUTA_EMBUDO_1) llamadasEmbudo1.push(reg);
    }
    ts.forEachChild(n, anda);
  })(sf);
}

const problemas = [];
if (ficherosParseados !== POBLACION_ESPERADA) problemas.push(`poblacion: esperaba ${POBLACION_ESPERADA}, parseados ${ficherosParseados}`);
if (!vistoTipoClienteCongelado) problemas.push('NO veo el tipo ClienteCongelado: no estoy mirando este arbol');
if (!vistoTipoEmisorCongelado) problemas.push('NO veo el tipo EmisorCongelado: no estoy mirando este arbol');
if (llamadasEmbudo2.length === 0) problemas.push('NO veo ninguna llamada a emitInvoice: eso SI existe; si no lo veo, estoy ciego');
if (productoresCliente.length === 0) problemas.push('NO veo ningun productor de cliente congelado: eso SI existe (SCRUM-729)');

console.log('========================================================================');
console.log('CENSO DE LOS PRODUCTORES · SCRUM-665 (D) · SEGUNDA SONDA · SOLO LECTURA');
console.log('========================================================================');
console.log(`POBLACION ............................ ${ficherosParseados} ficheros .ts (esperados ${POBLACION_ESPERADA})`);
console.log(`SUELO · tipo ClienteCongelado visto .. ${vistoTipoClienteCongelado ? 'SI' : 'NO'}`);
console.log(`SUELO · tipo EmisorCongelado visto ... ${vistoTipoEmisorCongelado ? 'SI' : 'NO'}`);
if (problemas.length) {
  console.log('');
  console.log('SUELO CAIDO — CIEGO:');
  for (const p of problemas) console.log(`   · ${p}`);
  process.exit(3);
}

console.log('');
console.log(`① llamadas a crearFacturaEmitida (EMBUDO 1) ..... ${llamadasEmbudo1.length}`);
for (const x of llamadasEmbudo1) console.log(`     ${x.fichero}:${x.linea}   tx: ${x.tx ? `linea ${x.tx}` : 'ninguna'}`);

console.log('');
console.log(`② llamadas a emitInvoice (EMBUDO 2, anidado en el 1) ... ${llamadasEmbudo2.length}`);
for (const x of llamadasEmbudo2) console.log(`     ${x.fichero}:${x.linea}   -> la llamada cae ${x.dondeTx} de la tx${x.tx ? ` (linea ${x.tx})` : ''}`);

console.log('');
console.log(`③ PRODUCTORES de cliente congelado (el patron ya construido) ... ${productoresCliente.length}`);
for (const x of productoresCliente) {
  console.log(`     ${x.fichero}:${x.linea}   ${x.que}()   -> ${x.dondeTx} de la tx${x.tx ? ` (linea ${x.tx})` : ''}`);
}

console.log('');
console.log(`④ PRODUCTORES de emisor congelado (lo que SCRUM-665 necesitaria) ... ${productoresEmisor.length}`);
if (productoresEmisor.length === 0) {
  console.log('     CERO. Y el suelo esta en pie: el tipo EmisorCongelado SI se ve, y el mismo');
  console.log('     barrido encuentra los productores de CLIENTE. Luego este cero es "NO HAY",');
  console.log('     no "no he mirado donde habia".');
} else {
  for (const x of productoresEmisor) console.log(`     ${x.fichero}:${x.linea}   ${x.que}()   -> ${x.dondeTx}`);
}

console.log('');
console.log('── ARITMETICA ───────────────────────────────────────────────────────────');
// La boca que vive DENTRO de `emitInvoice` no produce su congelado: lo recibe por parametro.
// Quien lo produce son los llamadores de `emitInvoice`. Contarla como productora seria contar
// dos veces el mismo camino.
const reenviadas = llamadasEmbudo1.filter((x) => x.fichero === RUTA_EMBUDO_2).length;
const directos = llamadasEmbudo1.length - reenviadas;
console.log(`   bocas del embudo 1 .................... ${llamadasEmbudo1.length}`);
console.log(`   de ellas, DENTRO de emitInvoice ....... ${reenviadas}  (reenvia, no produce)`);
console.log(`   bocas que PRODUCEN su congelado ....... ${directos}`);
console.log(`   llamadores de emitInvoice (producen) .. ${llamadasEmbudo2.length}`);
console.log(`   SITIOS QUE TENDRIAN QUE PRODUCIR EMISOR: ${directos} + ${llamadasEmbudo2.length} = ${directos + llamadasEmbudo2.length}`);
console.log('');
console.log('   CONTROL DE CUADRE — los productores de CLIENTE externos tienen que ser esos');
console.log('   mismos sitios, mas los que congelan para algo que NO es una factura:');
const productoresExternos = productoresCliente.filter(
  (x) => x.fichero !== RUTA_FREEZER_CLIENTE,
).length;
const esperados = directos + llamadasEmbudo2.length;
console.log(`   productores de cliente fuera de su propio fichero: ${productoresExternos}`);
console.log(`   sitios de FACTURA esperados ....................: ${esperados}`);
console.log(`   resto (congelan para un documento que no es factura): ${productoresExternos - esperados}`);
if (productoresExternos < esperados) {
  console.log('   🔴 NO CUADRA: hay menos productores que sitios. Uno de los dos censos miente.');
}
