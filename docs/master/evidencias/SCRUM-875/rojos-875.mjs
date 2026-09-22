// docs/master/evidencias/SCRUM-875/rojos-875.mjs — las tres cajas recuperadas, cada una con su rojo
//
//   node docs/master/evidencias/SCRUM-875/rojos-875.mjs      (desde la raíz, con el árbol limpio)
//
// EVIDENCIA, NO GUARD. Para cada una de las tres cajas que SCRUM-875 recupera en
// `guard:caja-documento-suelto`, añade al CSS REAL del panel una regla que la obliga a desbordar,
// corre el guard y exige:
//   ① que salga con 1 (hallazgo), no con 0 (verde) ni con 2 (no supo mirar);
//   ② que el hallazgo nombre ESA caja;
//   ③ que NO nombre las otras dos: un rojo que tumba a todas no prueba que cada una se mire.
// Después restaura `styles.css` byte a byte y lo verifica con `Buffer.compare`.
//
// La regla va AL FINAL de la hoja con `!important`: no se toca ninguna regla existente, así que
// restaurar es exactamente quitar lo añadido.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const HOJA = path.join(RAIZ, 'public', 'dashboard', 'css', 'styles.css');
const GUARD = path.join(RAIZ, 'scripts', 'guard-caja-documento-suelto.mjs');
const ORIGINAL = fs.readFileSync(HOJA);

const CAJAS = ['título de la página', 'botón primario', 'error al emitir'];
const ESTRECHA = 'width: 60px !important; max-width: 60px !important; white-space: nowrap !important; overflow: hidden !important;';

const MUTACIONES = [
  { rojo: 'a', caja: 'título de la página', regla: `.quotes-title { display: block !important; ${ESTRECHA} }` },
  { rojo: 'b', caja: 'botón primario', regla: `.btn.btn-primary { ${ESTRECHA} }` },
  { rojo: 'c', caja: 'error al emitir', regla: `.alert.error { ${ESTRECHA} }` },
];

function correrGuard() {
  const r = spawnSync(process.execPath, [GUARD], { cwd: RAIZ, encoding: 'utf8', timeout: 280000 });
  return { codigo: r.status, salida: `${r.stdout || ''}\n${r.stderr || ''}` };
}

/** Las cajas que el guard declara que NO caben (las líneas del veredicto). */
const cajasCaidas = (salida) => CAJAS.filter((c) => new RegExp(`@\\d+px · ${c}:`).test(salida));

let malos = 0;
try {
  const base = correrGuard();
  if (base.codigo !== 0) {
    console.log(`🔴 CON EL CSS INTACTO el guard no está en verde (exit ${base.codigo}). No se puede probar ningún rojo.`);
    console.log(base.salida.split('\n').slice(-8).join('\n'));
    process.exit(2);
  }
  console.log('✅ CSS intacto: el guard en verde (exit 0)\n');

  for (const m of MUTACIONES) {
    fs.writeFileSync(HOJA, Buffer.concat([ORIGINAL, Buffer.from(`\n/* rojo SCRUM-875 ${m.rojo} */\n${m.regla}\n`)]));
    const r = correrGuard();
    fs.writeFileSync(HOJA, ORIGINAL);
    if (Buffer.compare(fs.readFileSync(HOJA), ORIGINAL) !== 0) {
      console.log('🔴 styles.css NO QUEDÓ RESTAURADO BYTE A BYTE. Paro.');
      process.exit(3);
    }
    const caidas = cajasCaidas(r.salida);
    const ok = r.codigo === 1 && caidas.includes(m.caja) && caidas.length === 1;
    console.log(`${ok ? '✅' : '🔴'} ${m.rojo}) «${m.caja}» forzada a desbordar → exit ${r.codigo} · cajas que caen: ${caidas.join(' | ') || '(ninguna)'}`);
    if (!ok) {
      malos++;
      if (r.codigo === 2) console.log(`     el guard dijo NO SUPE MIRAR: ${(r.salida.match(/NO SUPE MIRAR[\s\S]*?\n\s+(.*)/) || [])[1] || ''}`);
    }
  }
} finally {
  fs.writeFileSync(HOJA, ORIGINAL);
}

const intacta = Buffer.compare(fs.readFileSync(HOJA), ORIGINAL) === 0;
console.log(`\nstyles.css restaurado byte a byte: ${intacta ? 'sí' : '🔴 NO'}`);
console.log(malos ? `\n🔴 ${malos} rojo(s) sin probar` : `\n✅ las ${MUTACIONES.length} cajas recuperadas caen, cada una sola`);
process.exit(malos || !intacta ? 1 : 0);
