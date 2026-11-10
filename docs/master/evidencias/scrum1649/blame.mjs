// Para cada marca: commit y fecha de la LÍNEA de la marca (git blame), y tickets citados en la frase de la marca.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [raiz, entrada, salida] = process.argv.slice(2);
const v = JSON.parse(fs.readFileSync(entrada, 'utf8'));
for (const x of v) {
  const [f, l] = [x.donde.slice(0, x.donde.lastIndexOf(':')), x.donde.slice(x.donde.lastIndexOf(':') + 1)];
  // la marca puede estar unas líneas por debajo del inicio del bloque: localizar la línea que casa
  const lines = fs.readFileSync(`${raiz}/${f}`, 'utf8').split('\n');
  let ln = Number(l);
  const re = /fundador/i;
  for (let i = Number(l) - 1; i < Math.min(lines.length, Number(l) + 60); i++) if (re.test(lines[i]) && /aprob|autoriz|firm|valid|refrend|decid/i.test(lines[i])) { ln = i + 1; break; }
  try {
    const out = execFileSync('git', ['-C', raiz, 'blame', '--porcelain', '-L', `${ln},${ln}`, '--', f], { encoding: 'utf8' });
    x.commit = out.slice(0, 40);
    x.fecha = new Date(Number(out.match(/^author-time (\d+)/m)[1]) * 1000).toISOString().slice(0, 10);
    x.autor = out.match(/^author (.*)$/m)[1];
    x.resumen = out.match(/^summary (.*)$/m)[1].slice(0, 100);
  } catch (e) { x.commit = 'ERR'; }
  x.lineaMarca = ln;
  x.ticketsFrase = [...new Set((lines[ln - 1] + ' ' + (lines[ln] || '')).match(/SCRUM-\d+/gi) || [])];
  delete x.texto;
}
fs.writeFileSync(salida, JSON.stringify(v, null, 1));
const cnt = {};
for (const x of v) { const k = `${x.nivel}|${x.fecha < '2026-09-07' ? 'antes-7sep' : 'desde-7sep'}`; cnt[k] = (cnt[k] || 0) + 1; }
console.log(JSON.stringify(cnt, null, 1));
console.log('ERR', v.filter((x) => x.commit === 'ERR').length);
