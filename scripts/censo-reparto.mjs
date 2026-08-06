// scripts/censo-reparto.mjs — SCRUM-387 · EL CENSO, para leerlo antes de repartir
//
//   node scripts/censo-reparto.mjs --jira <fichero.json>
//
// El JSON de Jira lo produce quien tenga acceso (el MCP de Atlassian), con la forma mínima
// `[{ "key": "SCRUM-304", "estado": "Tareas por hacer" }, …]` y SOLO los que están SIN CERRAR.
// No se cachea en el repo a propósito: un censo guardado envejece y vuelve a ser la foto vieja que
// causó el problema. Se genera fresco cada vez que se va a repartir.
//
// Sale con código != 0 si el censo NO es de fiar (ver `motivosParaNoFiarse`). Que nadie lea la
// salida para saber si sirve.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ticketsConEntrada, agruparRamas, cruzar, motivosParaNoFiarse, alarmasDeRama, residuoParaBorrar } from './_censo-reparto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const ficheroJira = argv[argv.indexOf('--jira') + 1];
if (!argv.includes('--jira') || !ficheroJira) {
  console.error('uso: node scripts/censo-reparto.mjs --jira <fichero.json>');
  process.exit(2);
}

// ── 1 · lo que MAIN dice que está hecho ──────────────────────────────────────────────────────
// Se lee del ÁRBOL DE GIT (`git ls-tree origin/main`), no del directorio de trabajo: el árbol
// local puede tener entradas a medio escribir de la sesión que lo está usando, y el reparto se
// hace sobre lo que está en main, no sobre lo que alguien tiene abierto.
//
// ⚠️ Aquí `origin/main` SÍ es la referencia correcta, y por eso este fichero NO corre en CI: la
// pregunta del CLI es «¿qué hay hecho AHORA MISMO?». El guard de la suite hace otra pregunta —«¿el
// árbol que se va a mergear está sano?»— y por eso lee el árbol de trabajo (SCRUM-387, tras
// tumbar #454 y #498 por dar `origin/main` por hecho en CI).
//
// Y si el ref falta, se DICE. Un `fatal: Not a valid object name` crudo no le explica a nadie qué
// hacer, y lo que no puede pasar es que la ausencia del ref se convierta en «cero entradas».
let enMain;
try {
  enMain = execFileSync('git', ['ls-tree', 'origin/main', '--name-only', 'docs/master/'],
    { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n').map((s) => s.trim()).filter(Boolean);
} catch {
  console.error('\n🔴 no se pudo leer `origin/main`. Este censo NO informa sin su referencia:');
  console.error('   «no pude mirar» y «miré y está todo alineado» no pueden dar el mismo resultado.');
  console.error('\n   Arréglalo con:  git fetch origin\n');
  process.exit(1);
}
const entradas = ticketsConEntrada(enMain);

// ── 2 · lo que JIRA dice que falta ───────────────────────────────────────────────────────────
const abiertos = JSON.parse(fs.readFileSync(ficheroJira, 'utf8'));

// ── 3 · las ramas, y cuáles siguen VIVAS ─────────────────────────────────────────────────────
// El fetch trae los objetos: sin él, `merge-base` no puede responder por las ramas de otros y
// todo saldría «indeterminado». Es lectura, no escribe nada en el árbol de trabajo.
execFileSync('git', ['fetch', '--quiet', 'origin', '+refs/heads/*:refs/remotes/origin/*'], { cwd: RAIZ });
const esAncestro = (sha) => {
  if (!sha) return null;
  try { execFileSync('git', ['cat-file', '-e', sha], { cwd: RAIZ, stdio: 'ignore' }); } catch { return null; }
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main'], { cwd: RAIZ, stdio: 'ignore' });
    return true;
  } catch { return false; }
};
const ramas = agruparRamas(execFileSync('git', ['ls-remote', '--heads', 'origin'], { cwd: RAIZ, encoding: 'utf8' }), esAncestro);

// ── SUELO, antes de informar de nada ─────────────────────────────────────────────────────────
const motivos = motivosParaNoFiarse({ entradas, abiertos, ramas });
if (motivos.length) {
  console.error('\n🔴 EL CENSO NO ES DE FIAR — no se informa de nada:\n');
  for (const m of motivos) console.error('   · ' + m);
  console.error('');
  process.exit(1);
}

const { desfases, abiertoSinEntrada, enMainYCerrado } = cruzar({ entradas, abiertos });
const alarmas = alarmasDeRama(ramas);
const sha = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: RAIZ, encoding: 'utf8' }).trim();

console.log(`\n${'═'.repeat(78)}`);
console.log(`CENSO DE REPARTO · origin/main = ${sha}`);
console.log(`${'═'.repeat(78)}`);
console.log(`  entradas en docs/master/ ....... ${entradas.size}`);
console.log(`  tickets abiertos en Jira ....... ${abiertos.length}`);
console.log(`  ramas remotas .................. ${ramas.total}  (vivas ${ramas.vivas} · ya en main ${ramas.enMain} · sin determinar ${ramas.indeterminadas})`);

console.log(`\n\n① DESFASES · ESTÁN EN MAIN Y ABIERTOS EN JIRA  (${desfases.length})`);
console.log('   Es de aquí de donde sale que se reconstruya trabajo hecho.\n');
if (!desfases.length) console.log('   (ninguno)');
for (const d of desfases) {
  console.log(`   ${d.clave.padEnd(11)} ${String(d.estado || '').padEnd(20)} ${d.fichero}`);
  if (d.titulo) console.log(`   ${''.padEnd(11)} ${d.titulo}`);
}

console.log(`\n\n② ALARMAS DE RAMA · DOS O MÁS SIN MERGEAR CON EL MISMO NÚMERO  (${alarmas.length})`);
console.log('   Cuando hay dos vivas, alguien ya está reconstruyendo lo del otro sin saberlo.');
console.log('   Las ya mergeadas NO cuentan: son basura, no trabajo en paralelo.\n');
if (!alarmas.length) console.log('   (ninguna)');
for (const a of alarmas) {
  console.log(`   ${a.clave.padEnd(11)} ${a.cuantas} sin mergear${a.residuo ? `  (+${a.residuo} ya en main)` : ''}`);
  for (const r of a.ramas) console.log(`   ${''.padEnd(11)}   · ${r}`);
}

const residuo = residuoParaBorrar(ramas);
console.log(`\n\n②b LIMPIEZA · ramas ya en main que nadie borró  (${residuo.length})`);
console.log('   No es alarma. Pero mientras estén, ahogan la señal de arriba.\n');
console.log('   ' + (residuo.length ? `${residuo.length} ramas — \`git push origin --delete <rama>\`` : '(ninguna)'));

console.log(`\n\n③ CONTROL POSITIVO · en main y ya cerrado en Jira  (${enMainYCerrado.length})`);
console.log('   Si esto sale vacío, el cruce no está cruzando: son los que SÍ funcionaron.\n');
console.log('   ' + (enMainYCerrado.map((x) => x.clave).join(' · ') || '(ninguno)'));

console.log(`\n\n④ COLA NORMAL · abiertos SIN entrada en main  (${abiertoSinEntrada.length})`);
console.log('   Esto NO es una alarma: es el trabajo que de verdad queda por hacer.\n');
console.log('   ' + (abiertoSinEntrada.map((x) => x.clave).join(' · ') || '(ninguno)'));

console.log(`\n${'═'.repeat(78)}`);
console.log('Los tickets NO se cierran desde aquí. Esta es la lista; el cierre lo hace el fundador');
console.log('con su comentario de evidencia.');
console.log(`${'═'.repeat(78)}\n`);
