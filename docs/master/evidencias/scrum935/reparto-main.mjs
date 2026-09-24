// SCRUM-935 · de las cancelaciones del CI, ¿cuántas son el TECHO del meta-guard y cuántas la
// concurrencia (un merge nuevo que mata al anterior)? El corte es el propio techo: 600 s.
import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const filas = d.filas.filter((f) => f.seg != null);
function reparto(nombre, arr) {
  const can = arr.filter((f) => f.jobConcl === 'cancelled');
  const techo = can.filter((f) => f.seg >= 600);
  const conc = can.filter((f) => f.seg < 600);
  const ok = arr.filter((f) => f.jobConcl === 'success');
  const fail = arr.filter((f) => f.jobConcl === 'failure');
  console.log(`${nombre}: n=${arr.length} · success ${ok.length} · failure ${fail.length} · cancelled ${can.length}`);
  console.log(`   de los cancelados: ${techo.length} por el TECHO (≥600 s) · ${conc.length} por CONCURRENCIA (<600 s)`);
  if (can.length) console.log(`   ⇒ el techo explica el ${(100 * techo.length / can.length).toFixed(0)} % de las cancelaciones; la concurrencia, el ${(100 * conc.length / can.length).toFixed(0)} %`);
  console.log(`   ⇒ legibles hoy (llegaron al final): ${(100 * (ok.length + fail.length) / arr.length).toFixed(0)} % · si se quita el techo: ${(100 * (ok.length + fail.length + techo.length) / arr.length).toFixed(0)} %`);
}
console.log(`POBLACIÓN · ${filas.length} runs de ci.yml con job meta-guard medible, ventana ${filas[filas.length - 1].creado} → ${filas[0].creado}`);
reparto('TODOS', filas);
reparto('SOLO push a main', filas.filter((f) => f.evento === 'push' && f.rama === 'main'));
reparto('SOLO pull_request', filas.filter((f) => f.evento === 'pull_request'));
console.log('EXIT=0');
