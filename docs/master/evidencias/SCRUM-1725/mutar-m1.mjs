// SCRUM-1725e · las dos mutaciones de M1, repetibles: `node docs/master/evidencias/SCRUM-1725/mutar-m1.mjs`
// (desde la raíz del árbol, con el árbol limpio en `jobsView.js`).
//
// Primero la BASE sin mutar (A3): si el test ya cae sin tocar nada, ninguna fila de abajo vale.
// Cada mutación reescribe `public/dashboard/js/jobsView.js`, corre el test y RESTAURA el fichero
// (también si revienta). Un proceso que no da cuenta de tests es CIEGO, no una fila con ceros.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const FICHERO = 'public/dashboard/js/jobsView.js';
const TEST = 'tests/scrum1725-lista-operario-sin-cobro.test.mjs';
const LINEA = "title: veCobro ? '✅ Terminados — cobra el resto' : '✅ Terminados', items: [] }";
const MUTACIONES = [
  ['todos con «— cobra el resto» (lo que hacía main)', "title: '✅ Terminados — cobra el resto', items: [] }", { fail: 2, pass: 1 }],
  ['todos «✅ Terminados» a secas (el admin pierde la suya)', "title: '✅ Terminados', items: [] }", { fail: 1, pass: 2 }],
];

const original = fs.readFileSync(FICHERO, 'utf8');
if (original.split(LINEA).length !== 2) { console.log(`CIEGO: la línea de M1 no aparece exactamente una vez en ${FICHERO}`); process.exit(2); }

function correr() {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { encoding: 'utf8' });
  const n = (clave) => { const m = new RegExp(`^# ${clave} (\\d+)$`, 'm').exec(r.stdout || ''); return m ? Number(m[1]) : null; };
  return { tests: n('tests'), pass: n('pass'), fail: n('fail') };
}

let rojo = 0;
const base = correr();
console.log(`BASE sin mutar → tests ${base.tests} · pass ${base.pass} · fail ${base.fail}`);
if (base.tests !== 3 || base.fail !== 0) { console.log('CIEGO: la base no está en 3/3; no se muta'); process.exit(2); }
try {
  for (const [nombre, sustituto, esperado] of MUTACIONES) {
    fs.writeFileSync(FICHERO, original.replace(LINEA, sustituto));
    const m = correr();
    const ok = m.tests === 3 && m.fail === esperado.fail && m.pass === esperado.pass;
    if (!ok) rojo = 1;
    console.log(`${ok ? 'MUERE' : (m.tests === null ? 'CIEGO' : 'NO-COMO-SE-ESPERABA')} · ${nombre} → tests ${m.tests} · pass ${m.pass} · fail ${m.fail} (esperado fail ${esperado.fail})`);
  }
} finally {
  fs.writeFileSync(FICHERO, original);
}
const fin = correr();
console.log(`RESTAURADO → tests ${fin.tests} · pass ${fin.pass} · fail ${fin.fail}`);
process.exit(rojo || (fin.fail ? 1 : 0));
