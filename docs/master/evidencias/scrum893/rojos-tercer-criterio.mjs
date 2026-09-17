// docs/master/evidencias/scrum893/rojos-tercer-criterio.mjs — SCRUM-893/910 ⑥
//
// ¿MUERDE EL TRINQUETE DEL TERCER CRITERIO? Se comprueba por los DOS lados, que es lo que
// distingue un trinquete de una lista decorativa:
//
//   A · alguien EMPEORA `viasDeCobro.tarjeta` → aparecen discrepancias NUEVAS → debe caer.
//   B · alguien lo ARREGLA                    → hay discrepancias RESUELTAS → debe caer también,
//                                               para que la lista no se quede describiendo un
//                                               defecto que ya no existe.
//
// El lado B es el que casi nadie pone, y es el que impide que la lista envejezca en silencio.
//
// `tsc` se llama DIRECTO y no por `npm run build`: en Windows `npm` es un `.cmd` y
// `execFileSync('npm', …)` da ENOENT, así que el build no se ejecutaría y el banco leería un
// `dist/` viejo — medido en SCRUM-893, y costó una pasada entera creyendo otra causa.
//
//   node docs/master/evidencias/scrum893/rojos-tercer-criterio.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const TEST = 'tests/scrum893-solo-lo-que-puede-cobrar.test.mjs';
const FICHERO = 'src/modules/billing/domain/viasDeCobro.ts';
const ORIGINAL_LINEA = "const tarjeta = String(entrada.connectStatus || 'none') === 'active';";

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function corre(cmd, args) {
  try {
    return { ok: true, salida: execFileSync(cmd, args, { cwd: RAIZ, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (e) {
    return { ok: false, salida: (e.stdout || '') + (e.stderr || '') + (e.message || '') };
  }
}
const build = () => corre(process.execPath, [path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc')]);

/** ¿Cayó ⑥, y POR QUÉ? El «por qué» es el dato: caer no basta si cae por otra puerta. */
function estadoDelSexto(salida) {
  const cayo = /^✖ SCRUM-893\/910/m.test(salida);
  const porNuevas = /SE HA SEPARADO MÁS/.test(salida);
  const porResueltas = /HAY DISCREPANCIAS RESUELTAS/.test(salida);
  const porCiego = /CIEGO: `viasDeCobro\.tarjeta` es constante/.test(salida);
  const nombraAlguna = /(ON |OFF)\|(none|pending|active|restricted)/.test(salida);
  return { cayo, porNuevas, porResueltas, porCiego, nombraAlguna };
}

/** 🔴 LAS MUTACIONES TIENEN QUE SER FINAS, Y LA PRIMERA VERSIÓN NO LO ERA.
 *
 * Empecé con `const tarjeta = false;` y `= true;`. Las dos hacían caer ⑥ — y me habría quedado
 * ahí— pero caían por la puerta EQUIVOCADA: al volverse constante el criterio, saltaba el control
 * de ceguera (`valoresB.size === 2`) ANTES de llegar a la comparación de conjuntos, que es lo que
 * yo creía estar probando. Un verde, o un rojo, obtenido por el assert que no era.
 *
 *     🔒 Un test que cae no prueba lo que dice hasta que sabes POR CUÁL de sus asserts cayó.
 *
 * Estas tres cambian el CONJUNTO manteniendo el criterio variable — salvo la C, que está justo
 * para demostrar que el control de ceguera también hace su trabajo.
 */
const MUTACIONES = [
  { nombre: 'A · el umbral se mueve a `pending`', espera: 'conjunto',
    a: "const tarjeta = String(entrada.connectStatus || 'none') === 'pending';" },
  { nombre: 'B · se ensancha a «cualquier cosa menos none»', espera: 'conjunto',
    a: "const tarjeta = String(entrada.connectStatus || 'none') !== 'none';" },
  { nombre: 'C · se vuelve CONSTANTE (control del control)', espera: 'ciego',
    a: 'const tarjeta = false;' },
];

const abs = path.join(RAIZ, FICHERO);
const original = fs.readFileSync(abs, 'utf8');
const shaAntes = sha(original);
const ESTADO_ANTES = corre('git', ['status', '--porcelain', '--', 'src/']).salida.trim();

console.log('POBLACIÓN: ' + MUTACIONES.length + ' mutaciones sobre `' + FICHERO + '`, una cada vez.');
console.log('Banco: ' + TEST + ' (caso ⑥)\n');

if (!original.includes(ORIGINAL_LINEA)) {
  console.log('🔴 CIEGO: no encuentro la línea a mutar. Si `viasDeCobro` cambió, este script hay que');
  console.log('   actualizarlo — y un «no cae» sin mutación no diría nada.');
  process.exit(1);
}

build();
const base = corre('node', ['--test', '--test-force-exit', TEST]);
console.log('LÍNEA BASE (sin mutar) · ⑥ cae: ' + estadoDelSexto(base.salida).cayo);
if (estadoDelSexto(base.salida).cayo) {
  console.log('  🔴 ⑥ ya está rojo sin mutación: nada de lo que sigue mide la mutación.');
  process.exit(1);
}

const resultados = [];
try {
  for (const mut of MUTACIONES) {
    fs.writeFileSync(abs, original.replace(ORIGINAL_LINEA, mut.a));
    const entro = sha(fs.readFileSync(abs, 'utf8')) !== shaAntes;
    const b = build();
    console.log(`\n── ${mut.nombre} ──`);
    console.log(`   ¿entró? ${entro ? 'sí' : 'NO 🔴'} · ¿compila? ${b.ok ? 'sí' : 'NO 🔴'}`);
    if (!b.ok) {
      console.log('   🔴 CIEGO: sin build, el banco leería un `dist/` viejo. No se ejecuta.');
      resultados.push({ mut, ok: false, motivo: 'no compila' });
      continue;
    }
    const r = corre('node', ['--test', '--test-force-exit', TEST]);
    const e = estadoDelSexto(r.salida);
    console.log(`   ⑥ cae: ${e.cayo} · por NUEVAS: ${e.porNuevas} · por RESUELTAS: ${e.porResueltas} · por CIEGO: ${e.porCiego}`);
    console.log(`   ¿nombra combinaciones concretas? ${e.nombraAlguna}`);
    const esperado = mut.espera === 'ciego' ? (e.cayo && e.porCiego) : (e.cayo && (e.porNuevas || e.porResueltas) && e.nombraAlguna);
    resultados.push({ mut, ok: esperado, e });
  }
} finally {
  fs.writeFileSync(abs, original);
  const restaurado = sha(fs.readFileSync(abs, 'utf8')) === shaAntes;
  console.log(`\nrestaurado byte a byte: ${restaurado ? 'sí' : '🔴 NO'}`);
  build();
}

console.log('\n══ VEREDICTO ══');
let todo = true;
for (const r of resultados) {
  console.log(`${r.ok ? '✅' : '🔴'} ${r.mut.nombre}: ${r.ok ? 'cae y nombra cuáles' : 'NO cazó la mutación'}`);
  todo = todo && r.ok;
}
const hayNuevas = resultados.some((r) => r.e?.porNuevas);
const hayResueltas = resultados.some((r) => r.e?.porResueltas);
console.log(`\nel trinquete muerde por NUEVAS: ${hayNuevas} · por RESUELTAS: ${hayResueltas}`);
console.log(hayNuevas && hayResueltas
  ? '✅ Muerde por los DOS lados: ni se puede empeorar en silencio, ni se puede arreglar dejando\n'
    + '   la lista describiendo un defecto que ya no existe.'
  : '🔴 Sólo muerde por un lado: la otra mitad no está probada.');

const despues = corre('git', ['status', '--porcelain', '--', 'src/']).salida.trim();
console.log('\n── EL ÁRBOL ──');
console.log(despues === ESTADO_ANTES
  ? '✅ `git status src/` IDÉNTICO al de antes de mutar.'
  : `🔴 EL ÁRBOL CAMBIÓ.\n   antes:\n${ESTADO_ANTES}\n   después:\n${despues}`);
