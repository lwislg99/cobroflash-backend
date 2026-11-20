// SCRUM-1780a · censo de solo lectura: qué crea hoy una factura y si algo escribe `facturado` en un parte.
// Uso, desde la raíz del árbol: node docs/master/evidencias/SCRUM-1780/censo-rutas-factura.mjs
// Lee ficheros de `src/`; no importa nada de `src/`, no toca base ni red. Sale 0 si todos los
// controles positivos aparecen y 2 (CIEGO) si alguno falta.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function ficheros(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...ficheros(p));
    else if (p.endsWith('.ts')) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

const todos = ficheros('src');
const texto = Object.fromEntries(todos.map((f) => [f, readFileSync(f, 'utf8')]));
const casos = (re) => todos.flatMap((f) => texto[f].split('\n').map((l, i) => [f, i + 1, l]).filter(([, , l]) => re.test(l)));

let ciego = false;
function control(nombre, n) {
  const ok = n > 0;
  if (!ok) ciego = true;
  console.log(`  control positivo · ${nombre}: ${n} ${ok ? '✔' : '✘ CIEGO'}`);
}

console.log(`población: ${todos.length} ficheros .ts bajo src/`);

// ① Llamadores de emitInvoice (sin la definición).
// 1ª pasada (corregida): `\bemitInvoice\(tx\b` casaba también con la DEFINICIÓN, `emitInvoice(tx: …`.
const llamadas = casos(/\bemitInvoice\(tx,/).filter(([, , l]) => !/function emitInvoice/.test(l));
console.log(`① llamadas a emitInvoice(tx, …): ${llamadas.length}`);
for (const [f, n] of llamadas) {
  const origen = texto[f].split('\n').slice(n - 1, n + 14).join('\n').match(/origen:\s*'([^']+)'/);
  console.log(`   ${f}:${n} · origen ${origen ? origen[1] : '(no leído)'}`);
}
control('definición de emitInvoice', casos(/export async function emitInvoice\(/).length);

// ② Quién crea filas de Charge.
const cobros = casos(/\b(tx|prisma)\.charge\.create(Many)?\(/);
console.log(`② sitios que crean Charge: ${cobros.length} en ${new Set(cobros.map(([f]) => f)).size} fichero(s)`);
for (const [f, n] of cobros) console.log(`   ${f}:${n}`);
const cobroEnEmisores = cobros.filter(([f]) => llamadas.some(([g]) => g === f));
console.log(`   … de ellos en un fichero que llama a emitInvoice: ${cobroEnEmisores.length}`);

// ③ Quién escribe `estado: 'facturado'` en un parte (ParteTrabajo).
const rutasParte = 'src/modules/jobs/app/routes/partes.routes.ts';
const escriturasFacturado = casos(/estado:\s*'facturado'/);
console.log(`③ líneas con «estado: 'facturado'» literal en src/: ${escriturasFacturado.length}`);
const escriturasParte = texto[rutasParte].split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /^\s*estado:\s*/.test(l) && !/parte\.estado,|where:/.test(l));
// 1ª pasada (corregida): sin el `^\s*` contaba como escritura un COMENTARIO (`* … no porque cambie estado: …`).
console.log(`   escrituras de estado en ${rutasParte}: ${escriturasParte.length}`);
for (const [n, l] of escriturasParte) console.log(`   :${n} ${l.trim()}`);
control("'facturado' declarado en ESTADOS_PARTE", casos(/ESTADOS_PARTE = \[.*'facturado'/).length);
control("escritura literal «estado: 'borrador'» en el alta del parte", escriturasParte.filter(([, l]) => /'borrador'/.test(l)).length);

// ④ Rutas de partes que contienen la palabra factura/invoice en su registro de ruta.
const rutasConFactura = texto[rutasParte].split('\n').filter((l) => /router\.(post|patch|put)\(/.test(l) && /factur|invoice/i.test(l));
console.log(`④ rutas POST/PATCH/PUT de partes con «factur»/«invoice» en su path: ${rutasConFactura.length}`);
control('rutas POST/PATCH/PUT en partes.routes.ts', texto[rutasParte].split('\n').filter((l) => /router\.(post|patch|put)\(/.test(l)).length);

console.log(ciego ? 'VEREDICTO: CIEGO (falta un control positivo)' : 'VEREDICTO: controles positivos presentes');
process.exit(ciego ? 2 : 0);
