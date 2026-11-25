// Barrido SCRUM-1821: corre la población en tandas y saca los fallos (nombre + fichero) a JSON.
// uso: node barrido1821.mjs <lista.txt> <salida.json>
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const [lista, salida] = process.argv.slice(2);
const ficheros = fs.readFileSync(lista, 'utf8').replace(/^﻿/, '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const TANDA = 30;
const res = { ficheros: ficheros.length, tandas: [], tests: 0, pass: 0, fail: 0, skipped: 0, fallos: [] };
for (let i = 0; i < ficheros.length; i += TANDA) {
  const grupo = ficheros.slice(i, i + TANDA);
  const tap = path.join(os.tmpdir(), `b1821-${process.pid}-${i}.tap`);
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-concurrency=4',
    '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...grupo], { encoding: 'utf8', timeout: 600000 });
  const t = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  const num = (k) => Number((new RegExp(`^# ${k} (\\d+)$`, 'm').exec(t) || [])[1] ?? NaN);
  const fila = { desde: i, n: grupo.length, exit: r.status, tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped') };
  if (!t || Number.isNaN(fila.tests)) fila.CIEGO = true;
  res.tandas.push(fila);
  for (const k of ['tests', 'pass', 'fail', 'skipped']) res[k] += Number.isNaN(fila[k]) ? 0 : fila[k];
  // cada «not ok» con su location (la línea `location:` que sigue en el YAML del fallo)
  const lineas = t.split(/\r?\n/);
  for (let j = 0; j < lineas.length; j++) {
    const m = /^(\s*)not ok \d+ - (.*)$/.exec(lineas[j]);
    if (!m) continue;
    let loc = '';
    for (let k = j + 1; k < Math.min(j + 40, lineas.length); k++) {
      const l = /location: '([^']+)'/.exec(lineas[k]); if (l) { loc = l[1]; break; }
      if (/^\s*(not )?ok \d+ - /.test(lineas[k])) break;
    }
    res.fallos.push({ nombre: m[2], loc: loc.replace(/:\d+:\d+$/, '').split(/[\\/]tests[\\/]/).pop() });
  }
  try { fs.unlinkSync(tap); } catch {}
  process.stdout.write(`tanda ${i}: ${JSON.stringify(fila)}\n`);
}
fs.writeFileSync(salida, JSON.stringify(res, null, 1));
console.log(`POBLACION ficheros=${res.ficheros} tests=${res.tests} pass=${res.pass} fail=${res.fail} skipped=${res.skipped} ciegas=${res.tandas.filter((x) => x.CIEGO).length}`);
