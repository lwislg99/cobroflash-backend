import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const GH = path.join(process.env.ProgramFiles, 'GitHub CLI', 'gh.exe'); const REPO = 'lwislg99/cobroflash-backend';
const DIR = process.argv[2];
const det = JSON.parse(fs.readFileSync(path.join(DIR, 'detalle.json'), 'utf8'));
const limpio = (l) => l.replace(/^[^\t]*\t[^\t]*\t/, '').replace(/^﻿?\d{4}-\d\d-\d\dT[\d:.]+Z ?/, '');
const out = [];
for (const d of det) {
  const L = fs.readFileSync(path.join(DIR, 'logs', `${d.id}.txt`), 'utf8').split('\n').map(limpio);
  // líneas por mutación que no son ✔
  const marcas = L.filter((l) => /^ {2}\S+ \S+\.test\.mjs · /.test(l) && !/^ {2}✔ /.test(l));
  const i = L.findIndex((l) => /^vivas \d+/.test(l));
  const fin = L.findIndex((l, k) => k > i && /^##\[error\]/.test(l));
  // OJO: stderr y stdout se entrelazan y `##[error]` puede caer ANTES del bloque: se lee hasta el final.
  // Y las viñetas pueden caer ANTES de la línea `vivas …` por lo mismo: se lee el log ENTERO.
  const bloque = L.filter((l) => /^ {2}· \S+\.test\.mjs · /.test(l) || /^ {4}→ /.test(l)).join('\n'); void fin;
  const items = [];
  for (const m of bloque.split(/\n(?= {2}· )/)) {
    const g = (m.match(/^ {2}· (\S+)\.test\.mjs/) || [])[1]; if (!g) continue;
    const clase = /MURIÓ AL MUTAR/.test(m) ? 'MUERTO' : /en la pasada MUTADA ese test: SALTADO/.test(m) ? 'SALTADO'
      : /pasada limpia, así que no se ha mutado/.test(m) ? 'LIMPIA-SIN-VERDE' : /en la pasada MUTADA ese test: NO APARECE/.test(m) ? 'NO-APARECE' : 'OTRA';
    const cae = (m.match(/el test «([^»]*)»|declarado —«([^»]*)»|ponerse rojo: «([^»]*)»/) || []).slice(1).find(Boolean);
    items.push({ g, clase, cae });
  }
  out.push({ id: d.id, creado: d.creado, evento: d.evento, rama: d.rama, sha: d.sha, rec: d.rec, marcas: marcas.map((x) => x.slice(0, 120)), items });
}
// el obligatorio del mismo run, para los que traen LIMPIA-SIN-VERDE
for (const o of out.filter((x) => x.items.some((i) => i.clase === 'LIMPIA-SIN-VERDE'))) {
  const jobs = JSON.parse(execFileSync(GH, ['api', `repos/${REPO}/actions/runs/${o.id}/jobs?per_page=100`], { encoding: 'utf8', maxBuffer: 1 << 26 })).jobs;
  o.obligatorio = jobs.filter((j) => /^build \+ tests/.test(j.name)).map((j) => `${j.name}=${j.conclusion}`).join(' ; ') || `SIN-JOB-OBLIGATORIO (${jobs.map((j) => j.name).join(' | ').slice(0, 200)})`;
}
fs.writeFileSync(path.join(DIR, 'detalle2.json'), JSON.stringify(out, null, 1));
const cuenta = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
const tabla = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `   ${String(v).padStart(4)}  ${k}`).join('\n');
console.log('INSTANCIAS por clase:\n' + tabla(cuenta(out.flatMap((o) => o.items.map((i) => i.clase)))));
console.log('INSTANCIAS por guard · clase:\n' + tabla(cuenta(out.flatMap((o) => o.items.map((i) => `${i.g} · ${i.clase}`)))));
console.log('RUNS por guard (cualquier clase):\n' + tabla(cuenta(out.flatMap((o) => [...new Set(o.items.map((i) => i.g))]))));
console.log('RUNS por nº de guards distintos afectados:\n' + tabla(cuenta(out.map((o) => String(new Set(o.items.map((i) => i.g)).size)))));
console.log('TEST declarado, por guard·clase:\n' + tabla(cuenta(out.flatMap((o) => o.items.map((i) => `${i.g} · ${i.clase} · «${(i.cae || '').slice(0, 70)}»`)))));
console.log('glifos de las líneas no-✔:\n' + tabla(cuenta(out.flatMap((o) => o.marcas.map((m) => m.replace(/^ {2}(\S+) (\S+)\.test\.mjs · (.{0,22}).*$/, '$1 … $3'))))));
console.log('\nLIMPIA-SIN-VERDE · run · obligatorio del MISMO run:');
for (const o of out.filter((x) => x.obligatorio)) console.log(`   ${o.id} ${o.creado} ${o.evento} ${o.rama.slice(0, 45)} · ${o.items.filter((i) => i.clase === 'LIMPIA-SIN-VERDE').map((i) => i.g + ' «' + (i.cae || '').slice(0, 40) + '»').join(' + ')} · ${o.obligatorio}`);
