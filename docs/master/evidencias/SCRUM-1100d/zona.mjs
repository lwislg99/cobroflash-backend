// El GEMELO: el trinquete de zona usa el mismo `run({ forceExit: true })`. ¿Cuántas veces cae, y por «ausente»?
// Población: los runs de filas.json cuyo meta-guard tuvo veredicto (success/failure).
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const GH = path.join(process.env.ProgramFiles, 'GitHub CLI', 'gh.exe'); const REPO = 'lwislg99/cobroflash-backend';
const DIR = process.argv[2];
fs.mkdirSync(path.join(DIR, 'zona'), { recursive: true });
const env = { ...process.env }; delete env.FORCE_COLOR;
const gh = (a) => execFileSync(GH, a, { encoding: 'utf8', maxBuffer: 1 << 28, env });
const filas = JSON.parse(fs.readFileSync(path.join(DIR, 'filas.json'), 'utf8')).filter((f) => f.meta === 'success' || f.meta === 'failure');
const salida = path.join(DIR, 'zona.json');
const hechos = fs.existsSync(salida) ? JSON.parse(fs.readFileSync(salida, 'utf8')) : [];
const ya = new Set(hechos.map((h) => h.id));
const limpio = (l) => l.replace(/^[^\t]*\t[^\t]*\t/, '').replace(/^﻿?\d{4}-\d\d-\d\dT[\d:.]+Z ?/, '');
const T0 = Date.now();
for (const f of filas) {
  if (ya.has(f.id)) continue;
  if (Date.now() - T0 > 520000) break; // se reanuda en la siguiente llamada
  const o = { id: f.id, creado: f.creado, evento: f.evento, rama: f.rama };
  try {
    const j = JSON.parse(gh(['api', `repos/${REPO}/actions/runs/${f.id}/jobs?per_page=100`])).jobs.find((x) => x.name.startsWith('trinquete'));
    if (!j) o.zona = 'SIN-JOB';
    else {
      o.zona = j.conclusion || j.status; o.paso = (j.steps || []).find((s) => s.conclusion === 'failure')?.name || null;
      if (o.zona === 'failure') {
        const L = gh(['run', 'view', '--repo', REPO, '--job', String(j.id), '--log']).split('\n').map(limpio);
        fs.writeFileSync(path.join(DIR, 'zona', `${f.id}.txt`), L.join('\n'));
        o.bytes = L.join('\n').length;
        const nuevas = []; let actual = null;
        for (const l of L) {
          const n = l.match(/^ {3}🔴 NUEVA (.*)$/); if (n) { actual = { titulo: n[1] }; nuevas.push(actual); continue; }
          if (actual && /^ {8}tests\//.test(l)) actual.fichero = l.trim();
          const z = actual && l.match(/^ {8}(\S+) → (\S+)\s+·\s+(\S+) → (\S+)/); if (z) { actual.a = z[2]; actual.b = z[4]; actual = null; }
        }
        o.nuevas = nuevas.length;
        o.conAusente = nuevas.filter((x) => x.a === 'ausente' || x.b === 'ausente').length;
        o.pares = [...new Set(nuevas.map((x) => `${x.a}/${x.b}`))];
        o.ficheros = [...new Set(nuevas.map((x) => x.fichero))];
        o.habla = L.some((l) => /EL TRINQUETE HABLA/.test(l));
        o.otro = L.filter((l) => /^🔴|CIEGO|##\[error\]/.test(l)).slice(0, 6).map((l) => l.slice(0, 160));
      }
    }
  } catch (e) { o.zona = 'NO-PUDE-MIRAR'; o.error = String(e.message).slice(0, 160); }
  hechos.push(o);
  fs.writeFileSync(salida, JSON.stringify(hechos, null, 1));
}
console.log(`HECHOS ${hechos.length} de ${filas.length}`);
