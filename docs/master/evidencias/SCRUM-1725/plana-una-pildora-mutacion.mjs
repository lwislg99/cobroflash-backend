// SCRUM-1725g · «una sola píldora por fila», visto en ROJO.
//
// Qué hace: mide la BASE (sin mutar), cuelga una SEGUNDA píldora en la celda de estado de la fila
// de `jobsView.js` (lo que SCRUM-816 quitó: dos insignias apiladas), vuelve a correr los dos
// instrumentos y RESTAURA el fichero, comprobándolo byte a byte.
//
//   · tests/scrum816-la-lista-no-miente.test.mjs   (el caso «ESTADO y FECHA…»)
//   · scripts/guard-lista-trabajos-917.mjs         (B.3)
//
// Uso, desde la raíz del repo:   node docs/master/evidencias/SCRUM-1725/plana-una-pildora-mutacion.mjs
// Sale 0 si la base está verde y la mutación tumba a los DOS; 1 si alguno no cae; 3 si no pudo
// restaurar. La mutación NUNCA se commitea.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const FICHERO = 'public/dashboard/js/jobsView.js';
const DE = '    tdEstado.appendChild(pildora);';
const A = '    tdEstado.appendChild(pildora); tdEstado.appendChild(pildora.cloneNode(true));';

const correr = (args) => {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, FORCE_COLOR: undefined } });
  return { codigo: r.status, salida: (r.stdout || '') + (r.stderr || '') };
};
const medir = (rotulo) => {
  const t = correr(['--test', '--test-force-exit', '--test-reporter=tap', 'tests/scrum816-la-lista-no-miente.test.mjs']);
  const g = correr(['scripts/guard-lista-trabajos-917.mjs']);
  const lineasT = t.salida.split(/\r?\n/).filter((l) => /^not ok|^# (tests|pass|fail) |no lleva UNA sola/.test(l));
  const lineasG = g.salida.split(/\r?\n/).filter((l) => /B\.3|NO SUPE|comprobaciones|^\s*(✅|🔴)\s*guard/i.test(l));
  console.log(`\n── ${rotulo} ──`);
  console.log(`816 · exit ${t.codigo}`);
  lineasT.forEach((l) => console.log('   ' + l.trim()));
  console.log(`guard-917 · exit ${g.codigo}`);
  lineasG.forEach((l) => console.log('   ' + l.trim()));
  return { t: t.codigo, g: g.codigo };
};

const original = fs.readFileSync(FICHERO);
const texto = original.toString('utf8');
const veces = texto.split(DE).length - 1;
if (veces !== 1) {
  console.error(`🔴 CIEGO: «${DE.trim()}» aparece ${veces} veces en ${FICHERO} (esperaba 1). No inyecto.`);
  process.exit(3);
}

let base;
let mutado;
let restaurado = false;
try {
  base = medir('BASE (sin mutar)');
  fs.writeFileSync(FICHERO, texto.replace(DE, A));
  const aplicada = fs.readFileSync(FICHERO, 'utf8').includes(A);
  console.log(`\ninyección aplicada: ${aplicada ? 'SÍ' : 'NO'} (${FICHERO})`);
  if (!aplicada) throw new Error('la inyección no se aplicó');
  mutado = medir('MUTADO (dos píldoras apiladas en la celda de estado)');
} finally {
  fs.writeFileSync(FICHERO, original);
  restaurado = Buffer.compare(fs.readFileSync(FICHERO), original) === 0;
  console.log(`\nrestaurado byte a byte: ${restaurado ? 'SÍ' : '🔴 NO'}`);
}
if (!restaurado) process.exit(3);

const baseVerde = base.t === 0 && base.g === 0;
const caenLosDos = mutado && mutado.t !== 0 && mutado.g !== 0;
console.log(`\nVEREDICTO: base ${baseVerde ? 'verde' : '🔴 NO verde'} · mutación ${caenLosDos ? 'tumba a los dos' : '🔴 NO tumba a los dos'}`);
process.exit(baseVerde && caenLosDos ? 0 : 1);
