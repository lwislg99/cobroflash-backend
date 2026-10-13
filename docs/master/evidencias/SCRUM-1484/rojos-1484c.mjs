// SCRUM-1484c · El test que ata la A19 al código, VISTO EN ROJO: cuatro cambios de una línea, uno por uno,
// y cuántos casos tumba cada uno. Cada cambio se deshace antes del siguiente, también si el test revienta.
// Uso: node rojos-1484c.mjs <raíz ABSOLUTA del árbol>
// Sale 0 si cada cambio tumba lo que tiene que tumbar y el árbol restaurado no tumba nada · 1 si no · 2 si no
// ha podido aplicar un cambio (el texto de partida ya no está: el instrumento está viejo, no el test).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const raiz = process.argv[2];
if (!raiz || !path.isAbsolute(raiz)) { console.error('Uso: node rojos-1484c.mjs <raíz ABSOLUTA del árbol>'); process.exit(2); }
const TEST = 'tests/scrum1484c-la-a19-dice-lo-que-dice-el-latido.test.mjs';
const NORMAS = 'docs/equipo/00-normas-comunes.md';
const SESION = 'scripts/equipo/sesion.mjs';

const CAMBIOS = [
  { nombre: 'A · la norma deja de citar la frase de «YA»', fichero: NORMAS, de: 'le dice «se releva YA, sin esperar', a: 'le dice «se releva pronto, sin esperar', caen: 1 },
  { nombre: 'B · la norma dice 200k donde el código dice 300k', fichero: NORMAS, de: '¿Pasa de **300k**?', a: '¿Pasa de **200k**?', caen: 1 },
  { nombre: 'C · el código baja el segundo número a 450k', fichero: SESION, de: 'export const UMBRAL_CONTEXTO_A_MITAD = 500_000;', a: 'export const UMBRAL_CONTEXTO_A_MITAD = 450_000;', caen: 1 },
  { nombre: 'D · el código cambia la frase de «YA»', fichero: SESION, de: '): se releva YA, sin esperar a terminar — primer punto seguro (un commit local), traspaso y relevo`', a: '): se releva en cuanto pueda`', caen: 1 },
];

function correr() {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { cwd: raiz, encoding: 'utf8' });
  const n = (rot) => Number((new RegExp(`^# ${rot} (\\d+)$`, 'm').exec(r.stdout) || [])[1]);
  const caidos = [...r.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { tests: n('tests'), pasan: n('pass'), caen: n('fail'), caidos };
}

// 🔴 Este instrumento ESCRIBE en el árbol y lo deshace al acabar. Si lo matan a mitad (un `| Select-Object -First 1`
// o un `| head -1` sobre su salida lo matan en cuanto imprime la primera línea), el cambio se queda puesto. Pasó
// el 7-oct-2026 y la norma se comiteó con el cambio A dentro. Por eso mira ANTES de empezar si el árbol trae ya
// alguno de sus cambios, y si lo trae no corre: lo dice y sale 2.
const restos = CAMBIOS.filter((c) => fs.readFileSync(path.join(raiz, c.fichero), 'utf8').includes(c.a));
if (restos.length) {
  for (const c of restos) console.log(`SUCIO: ${c.fichero} trae puesto el cambio «${c.nombre}» de una pasada que no terminó. Deshazlo a mano (\`${c.a}\` → \`${c.de}\`) y vuelve a correr.`);
  process.exit(2);
}

let mal = 0;
const base = correr();
console.log(`BASE (árbol como está) | tests ${base.tests} · pasan ${base.pasan} · caen ${base.caen}`);
if (!(base.tests > 0) || base.caen !== 0) { console.log('  ✖ la base tiene que correr y no tumbar nada: sin eso ningún rojo de abajo dice nada'); process.exit(1); }

for (const c of CAMBIOS) {
  const ruta = path.join(raiz, c.fichero);
  const original = fs.readFileSync(ruta, 'utf8');
  const veces = original.split(c.de).length - 1;
  if (veces !== 1) { console.log(`${c.nombre} | CIEGO: el texto de partida está ${veces} veces en ${c.fichero}, tenía que estar 1`); process.exit(2); }
  let r;
  try {
    fs.writeFileSync(ruta, original.replace(c.de, c.a));
    r = correr();
  } finally {
    fs.writeFileSync(ruta, original);
  }
  const bien = r.caen === c.caen && r.tests === base.tests;
  if (!bien) mal++;
  console.log(`${c.nombre} | tests ${r.tests} · caen ${r.caen} (esperado ${c.caen}) ${bien ? '✔' : '✖'}${r.caidos.map((x) => `\n    cae: ${x}`).join('')}`);
}

const fin = correr();
const limpio = fin.caen === 0 && fin.tests === base.tests;
if (!limpio) mal++;
console.log(`RESTAURADO | tests ${fin.tests} · caen ${fin.caen} ${limpio ? '✔' : '✖'}`);
process.exit(mal ? 1 : 0);
