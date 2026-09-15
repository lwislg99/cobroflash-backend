// SCRUM-854 · afinar el censo: ¿existia la entrada EN EL MOMENTO del merge?
// «Hoy existe» no dice nada: pudo crearla otra sesion tres dias despues.
import { execFileSync } from 'node:child_process';
const RAIZ = 'C:/Users/Javier Pereira/cobroflash-b2';
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const existe = (...a) => { try { git(...a); return true; } catch { return false; } };

const CASOS = [
  ['5359f41d', 1261, 'scrum-839b-edad-y-rojo-obligatorio', 839],
  ['658976f0', 1257, 'scrum-846-caso-conocido-por-ast', 846],
  ['51a28288', 1248, 'scrum-637-verificacion-s5', 637],
  ['07ccd16c', 1240, 'scrum-848-tactil-ficha-trabajo', 848],
  ['85f4e0cb', 1239, 'scrum-839-detectar-conflicto', 839],
  ['d0ab360b', 1238, 'scrum-637-verificacion-s5', 637],
  ['5c35a66d', 1234, 'scrum-637-verificacion-s5', 637],
  ['4dec28eb', 1233, 'scrum-834e-censo-de-modulos', 834],
];

// CONTROL POSITIVO del comprobador: una entrada que SI esta y una que seguro NO.
console.log('CONTROL DEL COMPROBADOR:');
console.log('  SCRUM-729.md en origin/main (debe estar): '
  + (existe('cat-file', '-e', 'origin/main:docs/master/SCRUM-729.md') ? 'SI ✅' : 'NO 🔴'));
console.log('  SCRUM-99999.md en origin/main (no debe):  '
  + (existe('cat-file', '-e', 'origin/main:docs/master/SCRUM-99999.md') ? 'SI 🔴' : 'NO ✅'));
console.log('');

let sinExpediente = 0;
let soloSinActualizar = 0;
for (const [sha, pr, rama, num] of CASOS) {
  const enElMomento = existe('cat-file', '-e', `${sha}:docs/master/SCRUM-${num}.md`);
  const hoy = existe('cat-file', '-e', `origin/main:docs/master/SCRUM-${num}.md`);
  const fecha = git('log', '-1', '--format=%cI', sha).trim().slice(0, 10);
  let veredicto;
  if (!enElMomento && !hoy) { veredicto = '🔴🔴 ENTRO SIN EXPEDIENTE, Y SIGUE SIN EL'; sinExpediente++; }
  else if (!enElMomento && hoy) { veredicto = '🔴 entro SIN expediente; alguien lo escribio DESPUES'; sinExpediente++; }
  else { veredicto = '⚠️ el expediente ya existia; este PR no lo actualizo'; soloSinActualizar++; }
  console.log(`${sha}  PR#${pr}  ${fecha}  ${rama}`);
  console.log(`    SCRUM-${num}.md · en el merge: ${enElMomento ? 'SI' : 'NO'} · hoy: ${hoy ? 'SI' : 'NO'}`);
  console.log(`    ${veredicto}`);
}
console.log('');
console.log(`RESUMEN: entraron SIN expediente = ${sinExpediente} · expediente sin actualizar = ${soloSinActualizar}`);
