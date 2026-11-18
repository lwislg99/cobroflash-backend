// SCRUM-1731 · Las mutaciones del guard de la línea «Mutaciones:» (tests/scrum1294), REPETIBLES.
// Uso, desde la raíz de un worktree con su árbol commiteado:  node docs/master/evidencias/SCRUM-1731/mutar.mjs
// Inyecta cada línea al final de un registro REAL (docs/master/SCRUM-1731.md), corre el guard y lo restaura
// por bytes. Base sin mutar primero (A3): si la base no sale verde, no se juzga nada.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const REGISTRO = path.resolve('docs/master/SCRUM-1731.md');
const GUARD = 'tests/scrum1294-a9-leccion-en-a10.test.mjs';
const ORIGINAL = fs.readFileSync(REGISTRO);
const env = { ...process.env };
delete env.FORCE_COLOR;

const correr = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', GUARD], { encoding: 'utf8', env });
  const pasa = Number(/^# pass (\d+)/m.exec(r.stdout)?.[1]);
  const falla = Number(/^# fail (\d+)/m.exec(r.stdout)?.[1]);
  if (!Number.isFinite(pasa) || !Number.isFinite(falla)) return { ciego: true, rc: r.status };
  return { rc: r.status, pasa, falla, salida: r.stdout };
};

const CASOS = [
  { linea: 'Mutaciones: catálogo → `tests/no-existe-1731.test.mjs`', espera: 'rojo', dice: 'no existe en el repo' },
  { linea: 'Mutaciones: catálogo → `tests/scrum1294-a9-leccion-en-a10.test.mjs`', espera: 'rojo', dice: 'no declara ninguna mutación' },
  { linea: '- **Mutaciones:** una vez → `docs/master/evidencias/SCRUM-1731/no-esta.mjs`', espera: 'rojo', dice: 'no está en git' },
  { linea: 'Mutaciones: catálogo → tests/no-existe-1731.test.mjs', espera: 'rojo', dice: 'no existe en el repo' },
  { linea: 'Mutaciones: catálogo → `tests/scrum1387d-el-recuento-dice-sobre-cuantos.test.mjs`', espera: 'verde', dice: null },
];

let mal = 0;
try {
  const base = correr();
  console.log(`BASE · rc=${base.rc} pass=${base.pasa} fail=${base.falla}${base.ciego ? ' CIEGO' : ''}`);
  if (base.ciego || base.rc !== 0) { console.log('base no verde: no se juzga nada'); process.exit(2); }
  for (const c of CASOS) {
    fs.writeFileSync(REGISTRO, Buffer.concat([ORIGINAL, Buffer.from(`${c.linea}\n`)]));
    const r = correr();
    fs.writeFileSync(REGISTRO, ORIGINAL);
    const sale = r.ciego ? 'CIEGO' : r.rc === 0 ? 'verde' : 'rojo';
    const motivo = c.dice ? r.salida?.includes(c.dice) : true;
    const ok = sale === c.espera && motivo;
    if (!ok) mal++;
    console.log(`${ok ? 'OK ' : 'MAL'} · espera ${c.espera}, sale ${sale}${c.dice ? ` · dice «${c.dice}»: ${motivo ? 'sí' : 'NO'}` : ''} · ${c.linea}`);
  }
} finally {
  fs.writeFileSync(REGISTRO, ORIGINAL);
  const igual = Buffer.compare(fs.readFileSync(REGISTRO), ORIGINAL) === 0;
  console.log(`restaurado por bytes: ${igual ? 'sí' : 'NO'}`);
  if (!igual) process.exitCode = 3;
}
console.log(`MAL ${mal} de ${CASOS.length}`);
if (mal) process.exitCode = 1;
