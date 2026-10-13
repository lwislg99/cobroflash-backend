// regenera.mjs — vuelve a sacar las salidas de esta carpeta a partir de los datos guardados.
// Sin argumentos: solo lo que NO toca la red (salidas 1 a 6). Con --red: tambien las 7 y 8 (GET de lectura).
// Los datos se recogieron con recoge.mjs y jobs.mjs el 7-oct-2026 entre las 16:30Z y las 16:36Z.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const AQUI = import.meta.dirname;
const P = 'datos-push-main-2026-09-07..10-07.json';
const J = 'datos-jobs-de-esos-runs.json';
const pasos = [
  ['salida-1-serie-y-mecanismo.txt', ['analiza.mjs', P, '--mecanismo', '2026-09-22']],
  ['salida-2-tiempos-y-commits.txt', ['detalle.mjs', P, 'datos-main-primer-padre.txt']],
  ['salida-3-el-obligatorio-por-tramo.txt', ['obligatorio.mjs', P, J]],
  ['salida-4-latencia-y-grupos.txt', ['latencia.mjs', P, J]],
  ['salida-5-modelo.txt', ['modelo.mjs', P, J, '2026-09-26', '2026-10-08']],
  ['salida-6-pr.txt', ['analiza.mjs', 'datos-pr-2026-10-06..07.json']],
];
if (process.argv.includes('--red')) {
  pasos.push(['salida-7-lo-que-dice-cada-run.txt', ['dice.mjs', P, '2026-10-02T01:54', '2026-10-07T15:44']]);
  pasos.push(['salida-8-el-par-de-control.txt', ['par.mjs', P, '37650042161']]);
}
const env = { ...process.env };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
env.NO_COLOR = '1';
let malos = 0;
for (const [salida, args] of pasos) {
  const r = spawnSync('node', args, { cwd: AQUI, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
  const texto = `$ node ${args.join(' ')}\n${r.stdout}${r.stderr ? '\n[stderr]\n' + r.stderr : ''}EXIT=${r.status}\n`;
  fs.writeFileSync(path.join(AQUI, salida), texto);
  if (r.status !== 0) malos++;
  console.log(`${salida} · ${texto.split('\n').length} lineas · EXIT=${r.status}`);
}
console.log(`POBLACION ${pasos.length} salidas · con salida distinta de 0: ${malos}`);
process.exit(malos ? 1 : 0);
