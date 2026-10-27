// b-leer.mjs <dir> — lee cada log del vigia y saca: renglon de constancia, titulo, lineas de ritmo.
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const filas = JSON.parse(fs.readFileSync(path.join(dir, 'jobs.json'), 'utf8'));
const limpia = (l) => l.replace(/\u001b\[[0-9;]*m/g, '').replace(/^﻿/, '');
const out = [];
for (const f of filas) {
  if (!f.job) continue;
  const p = path.join(dir, 'logs', f.job + '.log');
  if (!fs.existsSync(p)) { out.push({ ...f, renglon: null }); continue; }
  const lineas = fs.readFileSync(p, 'utf8').split(/\r?\n/).map(limpia);
  const sinHora = (l) => l.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /, '');
  const idx = lineas.map(sinHora);
  const ren = idx.filter((l) => /^vigía · /.test(l));
  const horaRen = lineas.find((l) => / vigía · /.test(l));
  const ritmo = idx.filter((l) => /RETRASADO, PERO|PRODUCCIÓN CONGELADA|NO SÉ SI SE ESTÁ|NO SUPE MIRAR|producción pasó de|producción sigue en|no hay lectura anterior/.test(l) && !/^::/.test(l) && !/##\[/.test(l));
  const cache = idx.filter((l) => /Cache restored from key|Cache not found|Cache hit|cache saved|Cache saved/i.test(l));
  const exit = idx.filter((l) => /Process completed with exit code/.test(l));
  out.push({ clase: f.clase, run: f.run, job: f.job, evento: f.evento, sha: f.sha.slice(0, 9), creado: f.creado, inicio: f.inicio, concl: f.concl, runConcl: f.runConcl,
    pasoVigia: (f.pasos.find((s) => /corriendo lo que hay/.test(s.nombre)) || {}).concl,
    pasoAviso: (f.pasos.find((s) => /Avisar de verdad/.test(s.nombre)) || {}).concl,
    nRen: ren.length, renglon: ren[0] || null, horaLog: horaRen ? horaRen.slice(0, 20) : null, ritmo, cache, exit, bytes: f.bytes });
}
fs.writeFileSync(path.join(dir, 'leido.json'), JSON.stringify(out, null, 1));
out.sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
console.log(`POBLACION leidos=${out.length} con-renglon=${out.filter((o) => o.nRen === 1).length} sin-renglon=${out.filter((o) => !o.nRen).length} con-mas-de-uno=${out.filter((o) => o.nRen > 1).length}`);
for (const o of out) {
  const r = o.renglon || '';
  const m = /· (al-dia|atrasado|no-supe-mirar) · prod=(\S+) · main=(\S+) · hueco=(\S+) · commits=(\S+)/.exec(r) || [];
  const rit = o.ritmo.some((l) => /RETRASADO, PERO/.test(l)) ? 'DESPLIEGA' : o.ritmo.some((l) => /CONGELADA/.test(l)) ? 'CONGELADO' : o.ritmo.some((l) => /NO SÉ SI/.test(l)) ? 'NO-SE-SABE' : '-';
  const ca = o.cache.map((c) => c.replace(/.*(vigia-estado-\d+).*/, '$1').replace(/Cache not found.*/, 'SIN-CACHE')).join('|');
  console.log([o.clase.slice(0, 4), o.inicio, o.concl, 'paso=' + o.pasoVigia, m[1] || 'SIN-RENGLON', 'prod=' + m[2], 'main=' + m[3], m[4], 'c=' + m[5], rit, o.exit.join('').replace(/.*exit code/, 'exit'), ca, o.pasoAviso ? 'aviso=' + o.pasoAviso : '', o.job].join(' '));
}
