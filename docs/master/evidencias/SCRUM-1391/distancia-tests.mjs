// distancia-tests.mjs — SCRUM-1391 · cuánto tardan los tests en el obligatorio de CI, leído de sus logs.
// Dos preguntas sobre los mismos logs (los baja `bajar-logs.mjs`, prefijo `bt-`):
//   ① los CUATRO tests que llevan un `{ timeout }` escrito: cuánto tardan frente a su plazo;
//   ② el test MÁS LENTO de toda la tanda, que es lo que se mide contra los 300 s por test que
//      `run()` les pone al meta-guard y a `censo-guards-gateados`.
//   node docs/master/evidencias/SCRUM-1391/distancia-tests.mjs <log del obligatorio>...
import fs from 'node:fs';
import path from 'node:path';

const logs = process.argv.slice(2);
if (!logs.length) { console.error('uso: node distancia-tests.mjs <log>...'); process.exit(2); }
const limpiar = (l) => l.replace(/\x1b\[[0-9;]*m/g, '').replace(/^\S+Z /, '');
// nombre (fragmento) → plazo escrito en el test, en segundos, y si node:test lo APLICA
const CUATRO = [
  ['una que NO RESPONDE tampoco bloquea', 8, 'aplicado (scrum358)'],
  ['SCRUM-976 ④ mitad POSITIVA', 120, 'aplicado (scrum976)'],
  ['SCRUM-1011 · 🔴 ROJO: la sesión NUNCA', 20, 'ESCRITO Y NO APLICADO (scrum1007: va después de la función)'],
  ['SCRUM-1011 · 🟢 CONTROL POSITIVO', 20, 'ESCRITO Y NO APLICADO (scrum1007: va después de la función)'],
];
const porLog = logs.map((f) => {
  const tests = [];
  let resumen = null;
  for (const cruda of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const l = limpiar(cruda);
    const m = /^\s*([✔✖]) (.*) \((\d+(?:\.\d+)?)ms\)/.exec(l);
    if (m) tests.push({ ok: m[1] === '✔', n: m[2], s: Number(m[3]) / 1000 });
    if (!resumen && /^ℹ tests \d+/.test(l)) resumen = l.trim();
  }
  return { f: path.basename(f), tests, resumen };
});
console.log('POBLACION: ' + porLog.length + ' logs del obligatorio de main · líneas con duración: ' + porLog.map((x) => x.tests.length).join(', '));
if (porLog.some((x) => !x.tests.length)) { console.log('CIEGO: algún log no trae ni una línea con duración'); console.log('EXIT=2'); process.exit(2); }

console.log('\n① los cuatro tests con un `{ timeout }` escrito');
for (const [n, plazo, estado] of CUATRO) {
  const vistos = porLog.map((x) => x.tests.find((t) => t.n.includes(n))).map((t) => (t ? (t.ok ? '' : '✖ ') + t.s.toFixed(1) : 'AUSENTE'));
  const nums = vistos.filter((v) => v !== 'AUSENTE').map((v) => Number(v.replace('✖ ', '')));
  const peor = nums.length ? Math.max(...nums) : null;
  console.log('   «' + n + '» · plazo ' + plazo + ' s · ' + estado + '\n      tardó (s): ' + vistos.join(' · ')
    + (peor === null ? ' · SIN MEDIR' : ' → el peor ' + peor.toFixed(1) + ' s = ' + (100 * peor / plazo).toFixed(0) + ' % del plazo · margen ×' + (plazo / peor).toFixed(1)));
}

console.log('\n② el test más lento de la tanda, contra los 300 s por test de `run()`');
let peor = 0;
for (const x of porLog) {
  const orden = [...x.tests].sort((a, b) => b.s - a.s);
  peor = Math.max(peor, orden[0].s);
  console.log('   ' + x.f + ' · «' + x.resumen + '» · más de 30 s: ' + x.tests.filter((t) => t.s > 30).length + ' · los tres más lentos: ' + orden.slice(0, 3).map((t) => t.s.toFixed(1) + ' s «' + t.n.slice(0, 48) + '»').join(' · '));
}
console.log('   EL MÁS LENTO en ' + porLog.length + ' logs: ' + peor.toFixed(1) + ' s = ' + (100 * peor / 300).toFixed(0) + ' % de 300 s · margen ×' + (300 / peor).toFixed(1));
console.log('EXIT=0');
