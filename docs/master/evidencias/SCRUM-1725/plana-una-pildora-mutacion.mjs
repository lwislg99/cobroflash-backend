// SCRUM-1725g · «una sola píldora por fila», visto en ROJO en los TRES instrumentos que lo exigen.
//
// NO trae lista propia (guard SCRUM-1387): la mutación es la que declara el catálogo
// `MUTACIONES_QUE_ME_TUMBAN` de `tests/scrum1725-lista-operario-sin-cobro.test.mjs` cuyo `de` es la
// línea que cuelga la píldora, leída con `mutacionesDeclaradas` (el lector por AST del meta-guard).
// El meta-guard ya comprueba que tumba el caso de 1725g; este guion mide ADEMÁS los otros dos:
//
//   · tests/scrum816-la-lista-no-miente.test.mjs   (caso 5, «ESTADO lleva UNA sola píldora…»)
//   · scripts/guard-lista-trabajos-917.mjs         (B.3)
//
// Mide la BASE sin mutar, inyecta, vuelve a medir y RESTAURA el fichero comprobándolo byte a byte.
// Uso, desde la raíz del repo:   node docs/master/evidencias/SCRUM-1725/plana-una-pildora-mutacion.mjs
// Sale 0 si la base está verde y la mutación tumba a los TRES; 1 si alguno no cae; 3 si quedó ciego
// o no pudo restaurar. La mutación NUNCA se commitea.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';

const CATALOGO = 'tests/scrum1725-lista-operario-sin-cobro.test.mjs';
const LINEA = '    tdEstado.appendChild(pildora);';
const suyas = mutacionesDeclaradas(fs.readFileSync(CATALOGO, 'utf8'), CATALOGO).filter((m) => m.de === LINEA);
if (suyas.length !== 1) {
  console.error(`🔴 CIEGO: el catálogo de ${CATALOGO} declara ${suyas.length} mutaciones sobre «${LINEA.trim()}» (esperaba 1).`);
  process.exit(3);
}
const { fichero: FICHERO, de: DE, a: A } = suyas[0];

const INSTRUMENTOS = [
  { nombre: '1725', args: ['--test', '--test-force-exit', '--test-reporter=tap', CATALOGO], ver: /^not ok|^# (tests|pass|fail) / },
  { nombre: '816', args: ['--test', '--test-force-exit', '--test-reporter=tap', 'tests/scrum816-la-lista-no-miente.test.mjs'], ver: /^not ok|^# (tests|pass|fail) |no lleva UNA sola/ },
  { nombre: 'guard-917', args: ['scripts/guard-lista-trabajos-917.mjs'], ver: /B\.3|NO SUPE|comprobaciones/ },
];
const entorno = { ...process.env };
delete entorno.FORCE_COLOR;
const medir = (rotulo) => {
  console.log(`\n── ${rotulo} ──`);
  return INSTRUMENTOS.map((i) => {
    const r = spawnSync(process.execPath, i.args, { encoding: 'utf8', env: entorno });
    console.log(`${i.nombre} · exit ${r.status}`);
    ((r.stdout || '') + (r.stderr || '')).split(/\r?\n/).filter((l) => i.ver.test(l.trim())).forEach((l) => console.log('   ' + l.trim()));
    return r.status;
  });
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
  console.log(`\ninyección aplicada: ${aplicada ? 'SÍ' : 'NO'} (${FICHERO}, tomada del catálogo de ${CATALOGO})`);
  if (!aplicada) throw new Error('la inyección no se aplicó');
  mutado = medir('MUTADO (dos píldoras apiladas en la celda de estado)');
} finally {
  fs.writeFileSync(FICHERO, original);
  restaurado = Buffer.compare(fs.readFileSync(FICHERO), original) === 0;
  console.log(`\nrestaurado byte a byte: ${restaurado ? 'SÍ' : '🔴 NO'}`);
}
if (!restaurado) process.exit(3);

const baseVerde = base.every((c) => c === 0);
const caen = mutado ? mutado.filter((c) => c !== 0 && c !== null).length : 0;
console.log(`\nVEREDICTO: base ${baseVerde ? 'verde' : '🔴 NO verde'} (${base.join(',')}) · la mutación tumba ${caen} de ${INSTRUMENTOS.length} (${mutado ? mutado.join(',') : 'sin medir'})`);
process.exit(baseVerde && caen === INSTRUMENTOS.length ? 0 : 1);
