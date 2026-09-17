// docs/master/evidencias/scrum893/rojos-893.mjs — SCRUM-893
//
// LOS TRES ROJOS, INYECTADOS DE VERDAD EN `src/`.
//
// Siete verdes no prueban nada si nunca se han visto caer. Y tres verdes pueden ser el MISMO verde
// tres veces: si el caso del recibo cayera al romper el selector, no estaría midiendo el recibo.
// Por eso cada mutación se hace SOLA y se comprueba QUÉ cae y qué NO.
//
// Cada mutación devuelve el fichero a su estado byte a byte y lo verifica por sha256. Si el
// proceso muere a mitad, `git status` lo delata: por eso el script lo imprime al final.
//
//   node docs/master/evidencias/scrum893/rojos-893.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const TEST = 'tests/scrum893-solo-lo-que-puede-cobrar.test.mjs';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Las tres mutaciones: cada una devuelve el criterio a «se supone que sí», que es el defecto.
 *
 * La mutación conserva la llamada a `cardChargeMode` (`… || true`) para no dejar el import sin
 * usar. ⚠️ **Eso es higiene, NO fue la causa del primer fallo** — y conviene que quede escrito,
 * porque esa explicación me pareció evidente y era falsa: comprobado a mano, `= true` a secas
 * también compilaba. La causa real está en `build()`, abajo.
 *
 *     🔒 Un build roto no es un rojo: es un verde que no vale.
 *     🔒 La causa plausible que no se comprueba es la que te hace arreglar lo que no estaba roto.
 */
const MUTACIONES = [
  {
    nombre: 'payInvoice · el selector',
    fichero: 'src/modules/billing/app/routes/payInvoice.routes.ts',
    de: "const hasCard = cardChargeMode(m) !== 'refuse';",
    a: "const hasCard = cardChargeMode(m) !== 'refuse' || true; // MUTADO: el defecto de SCRUM-893",
    debeCaer: 'el selector',
  },
  {
    nombre: 'receipt · el recibo',
    fichero: 'src/modules/billing/app/routes/receipt.routes.ts',
    de: "const puedeTarjeta = cardChargeMode(ch.merchant) !== 'refuse';",
    a: "const puedeTarjeta = cardChargeMode(ch.merchant) !== 'refuse' || true; // MUTADO: SCRUM-893",
    debeCaer: 'el recibo',
  },
  {
    nombre: 'customerPortal · el portal del cliente',
    fichero: 'src/modules/system/app/routes/customerPortal.routes.ts',
    de: "const puedeTarjeta = cardChargeMode(m) !== 'refuse';",
    a: "const puedeTarjeta = cardChargeMode(m) !== 'refuse' || true; // MUTADO: SCRUM-893",
    debeCaer: 'el portal del cliente',
  },
];

function corre(cmd, args) {
  try {
    return { ok: true, salida: execFileSync(cmd, args, { cwd: RAIZ, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (e) {
    return { ok: false, salida: (e.stdout || '') + (e.stderr || '') + (e.message || '') };
  }
}

/** 🔴 `tsc` DIRECTO, NO `npm run build`.
 *
 * La primera versión llamaba `execFileSync('npm', ['run','build'])` y en Windows `npm` es un
 * `.cmd`: sin `shell: true`, ENOENT. O sea que el build **no llegaba a ejecutarse nunca** y el
 * instrumento lo contaba como «no compila» — tres veces seguidas, con una explicación perfectamente
 * razonable a mano (el import sin usar) que resultó ser FALSA: comprobado a mano, la mutación
 * compila sin problema. La causa plausible casi me hace reescribir la mutación buena.
 *
 *     🔒 Si tu instrumento y tu conclusión se contradicen, gana el instrumento — después de
 *        comprobar el instrumento.
 */
const build = () => corre(process.execPath, [path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc')]);

/** Qué casos de ④/⑤ caen. Devuelve los nombres, no un booleano: el «cuál» es el dato. */
function casosQueCaen(salida) {
  return [...salida.matchAll(/^✖ (SCRUM-893 · .+?) \(/gm)].map((m) => m[1]);
}

console.log('POBLACIÓN: ' + MUTACIONES.length + ' mutaciones, una cada vez, sobre `src/` real.');
console.log('Banco: ' + TEST + '\n');

// Foto del árbol ANTES de tocar nada, para poder comprobar al final que no quedó nada suelto.
const ESTADO_ANTES = corre('git', ['status', '--porcelain', '--', 'src/']).salida.trim();

// Línea base: sin mutar, no debe caer nada. Si cae algo, el resto no significaría nada.
build();
const base = corre('node', ['--test', '--test-force-exit', TEST]);
const caenEnBase = casosQueCaen(base.salida);
console.log('LÍNEA BASE (sin mutar) · casos que caen: ' + (caenEnBase.length || 0));
if (caenEnBase.length) {
  console.log('  🔴 el banco ya está rojo sin mutación. Nada de lo que sigue mide la mutación.');
  caenEnBase.forEach((c) => console.log('      ' + c));
  process.exit(1);
}

const resultados = [];
for (const mut of MUTACIONES) {
  const abs = path.join(RAIZ, mut.fichero);
  const original = fs.readFileSync(abs, 'utf8');
  const shaAntes = sha(original);
  let restaurado = false;

  try {
    if (!original.includes(mut.de)) {
      console.log(`\n🔴 CIEGO · ${mut.nombre}: no encuentro el texto a mutar. La mutación NO entró,`);
      console.log('   así que un «no cae» no diría nada del banco. Se aborta esta mutación.');
      resultados.push({ mut, entro: false, caen: [] });
      continue;
    }
    const mutado = original.replace(mut.de, mut.a);
    fs.writeFileSync(abs, mutado);

    // ¿ENTRÓ de verdad? Contenido distinto, no «he llamado a replace».
    const entro = sha(fs.readFileSync(abs, 'utf8')) !== shaAntes;
    const buildRes = build();

    console.log(`\n── MUTACIÓN: ${mut.nombre} ──`);
    console.log(`   ¿entró? ${entro ? 'sí' : 'NO 🔴'} · ¿compila? ${buildRes.ok ? 'sí' : 'NO 🔴'}`);

    // 🔴 SIN BUILD NO HAY MEDICIÓN. El banco lee `dist/`: si `tsc` falló, correrlo mide el
    // binario ANTERIOR y su «no cae nada» habla del código sano, no del mutado.
    if (!buildRes.ok) {
      console.log('   🔴 CIEGO: el build falló, así que el banco leería un `dist/` viejo. No se');
      console.log('      ejecuta: un «0 casos caen» aquí sería un verde prestado.');
      console.log('      ' + buildRes.salida.split('\n').filter((l) => l.includes('error')).slice(0, 3).join('\n      '));
      resultados.push({ mut, entro, compila: false, caen: [] });
      continue;
    }

    const run = corre('node', ['--test', '--test-force-exit', TEST]);
    const caen = casosQueCaen(run.salida);
    console.log(`   casos que CAEN: ${caen.length}`);
    caen.forEach((c) => console.log('      ✖ ' + c));
    resultados.push({ mut, entro, compila: true, caen });
  } finally {
    fs.writeFileSync(abs, original);
    restaurado = sha(fs.readFileSync(abs, 'utf8')) === shaAntes;
    console.log(`   restaurado byte a byte: ${restaurado ? 'sí' : '🔴 NO'}`);
  }
}

// ── VEREDICTO: cada mutación tumba LO SUYO y sólo lo suyo ─────────────────────────────────────
console.log('\n══ VEREDICTO ══');
let todoBien = true;
for (const r of resultados) {
  const suyos = r.caen.filter((c) => c.includes(r.mut.debeCaer));
  const ajenos = r.caen.filter((c) => !c.includes(r.mut.debeCaer) && c.includes('④'));
  const ok = r.entro && r.compila && suyos.length >= 1 && ajenos.length === 0;
  todoBien = todoBien && ok;
  console.log(`${ok ? '✅' : '🔴'} ${r.mut.nombre}: ${r.compila ? '' : 'NO COMPILÓ (ciego) · '}`
            + `tumba «${r.mut.debeCaer}» (${suyos.length}) · tumba casos AJENOS de ④: ${ajenos.length}`);
  if (ajenos.length) ajenos.forEach((c) => console.log('       ajeno → ' + c));
}
console.log(todoBien
  ? '\n✅ Los tres casos de ④ miden TRES ficheros distintos. No son el mismo verde tres veces.'
  : '\n🔴 Algún caso no discrimina o quedó ciego: revisar antes de fiarse del verde.');

// El árbol: se compara con el de ANTES, no con «vacío». Esta rama TIENE trabajo sin commitear, así
// que un `git status` no vacío es lo normal — lo que importa es que sea EL MISMO de antes.
const despues = corre('git', ['status', '--porcelain', '--', 'src/']).salida.trim();
console.log('\n── EL ÁRBOL, ANTES Y DESPUÉS ──');
console.log(despues === ESTADO_ANTES
  ? '✅ `git status src/` es IDÉNTICO al de antes de mutar. Nada quedó suelto.'
  : `🔴 EL ÁRBOL CAMBIÓ.\n   antes:\n${ESTADO_ANTES}\n   después:\n${despues}`);
