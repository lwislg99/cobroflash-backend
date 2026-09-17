// docs/master/evidencias/scrum910/rojos-910.mjs — SCRUM-910
//
// LOS TRES ROJOS, INYECTADOS DE VERDAD EN `src/`. Uno por cada sitio que decide, y cada uno solo,
// para poder ver QUÉ cae y qué NO: cinco verdes pueden ser el mismo verde cinco veces.
//
// `tsc` se llama DIRECTO: `execFileSync('npm', …)` no encuentra `npm.cmd` en Windows y el build no
// llegaría a ejecutarse — medido en SCRUM-893, donde costó una pasada entera creyendo otra causa.
// Y si el build falla, se declara CIEGO en vez de contar un cero: el banco lee `dist/`.
//
//   node docs/master/evidencias/scrum910/rojos-910.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const TEST = 'tests/scrum910-la-transferencia-que-no-mira.test.mjs';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function corre(cmd, args) {
  try {
    return { ok: true, salida: execFileSync(cmd, args, { cwd: RAIZ, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (e) {
    return { ok: false, salida: (e.stdout || '') + (e.stderr || '') + (e.message || '') };
  }
}
const build = () => corre(process.execPath, [path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc')]);

const MUTACIONES = [
  {
    nombre: 'el DOMINIO deja de mirar el país (el criterio viejo)',
    fichero: 'src/modules/billing/domain/transferenciaDisponible.ts',
    de: "  if (pais === 'MX' && noVacio(merchant?.clabe)) return true;\n  return noVacio(merchant?.iban);",
    a: "  void pais;\n  return noVacio(merchant?.iban) || noVacio(merchant?.clabe);",
    debeCaer: ['②', '③'],
  },
  {
    nombre: 'el SELECTOR vuelve a su condición vieja',
    fichero: 'src/modules/billing/app/routes/payInvoice.routes.ts',
    de: 'const hasTransfer = transferenciaDisponible(m);',
    a: 'const hasTransfer = transferenciaDisponible(m) || !!(m?.iban || m?.clabe);',
    debeCaer: ['③ el selector'],
  },
  {
    nombre: 'el RECIBO vuelve a ofrecerla sin mirar nada',
    fichero: 'src/modules/billing/app/routes/receipt.routes.ts',
    de: 'const puedeTransferencia = transferenciaDisponible(ch.merchant);',
    a: 'const puedeTransferencia = transferenciaDisponible(ch.merchant) || true;',
    debeCaer: ['③ el recibo', '④'],
  },
];

const casosQueCaen = (salida) =>
  [...salida.matchAll(/^✖ (SCRUM-910 · .+?) \(/gm)].map((m) => m[1]);

console.log('POBLACIÓN: ' + MUTACIONES.length + ' mutaciones sobre `src/`, una cada vez.');
console.log('Banco: ' + TEST + '\n');

const ESTADO_ANTES = corre('git', ['status', '--porcelain', '--', 'src/']).salida.trim();

build();
const base = corre('node', ['--test', '--test-force-exit', TEST]);
const caenEnBase = casosQueCaen(base.salida);
console.log('LÍNEA BASE (sin mutar) · casos que caen: ' + caenEnBase.length);
if (caenEnBase.length) {
  caenEnBase.forEach((c) => console.log('   ' + c));
  console.log('  🔴 el banco ya está rojo sin mutación: nada de lo que sigue mide la mutación.');
  process.exit(1);
}

const resultados = [];
for (const mut of MUTACIONES) {
  const abs = path.join(RAIZ, mut.fichero);
  const original = fs.readFileSync(abs, 'utf8');
  const shaAntes = sha(original);
  try {
    if (!original.includes(mut.de)) {
      console.log(`\n🔴 CIEGO · ${mut.nombre}: no encuentro el texto a mutar; un «no cae» no diría nada.`);
      resultados.push({ mut, ok: false, caen: [] });
      continue;
    }
    fs.writeFileSync(abs, original.replace(mut.de, mut.a));
    const entro = sha(fs.readFileSync(abs, 'utf8')) !== shaAntes;
    const b = build();
    console.log(`\n── ${mut.nombre} ──`);
    console.log(`   ¿entró? ${entro ? 'sí' : 'NO 🔴'} · ¿compila? ${b.ok ? 'sí' : 'NO 🔴'}`);
    if (!b.ok) {
      console.log('   🔴 CIEGO: sin build el banco leería un `dist/` viejo. No se ejecuta.');
      resultados.push({ mut, ok: false, caen: [] });
      continue;
    }
    const caen = casosQueCaen(corre('node', ['--test', '--test-force-exit', TEST]).salida);
    console.log(`   casos que CAEN: ${caen.length}`);
    [...new Set(caen)].forEach((c) => console.log('      ✖ ' + c));
    const cubre = mut.debeCaer.every((d) => caen.some((c) => c.includes(d)));
    resultados.push({ mut, ok: entro && caen.length > 0 && cubre, caen });
  } finally {
    fs.writeFileSync(abs, original);
    console.log(`   restaurado byte a byte: ${sha(fs.readFileSync(abs, 'utf8')) === shaAntes ? 'sí' : '🔴 NO'}`);
  }
}
build();

console.log('\n══ VEREDICTO ══');
let todo = true;
for (const r of resultados) {
  console.log(`${r.ok ? '✅' : '🔴'} ${r.mut.nombre}: esperaba tumbar [${r.mut.debeCaer.join(', ')}]`);
  todo = todo && r.ok;
}
console.log(todo
  ? '\n✅ Cada sitio que decide tiene quien lo vigile, y el banco dice CUÁL se ha movido.'
  : '\n🔴 Alguna mutación no se cazó: revisar antes de fiarse del verde.');

const despues = corre('git', ['status', '--porcelain', '--', 'src/']).salida.trim();
console.log('\n── EL ÁRBOL ──');
console.log(despues === ESTADO_ANTES
  ? '✅ `git status src/` IDÉNTICO al de antes de mutar.'
  : `🔴 EL ÁRBOL CAMBIÓ.\n   antes:\n${ESTADO_ANTES}\n   después:\n${despues}`);
