// cotejo.mjs <dir evidencias> — LEE hueco.json y despl-sep.json ya comiteados; no mide nada nuevo.
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const H = JSON.parse(fs.readFileSync(path.join(dir, 'hueco.json'), 'utf8'));
console.log('POBLACION hueco.json filas=' + H.length);
const infl = H.filter((f) => f.hueco - f.hFp > 1);
console.log('infladas >1h: ' + infl.length + ' -> ' + infl.map((f) => f.cuando + ' vigia=' + f.hueco + 'h real=' + (f.hFp * 3600).toFixed(0) + 's ' + f.ritmo + '/' + f.concl).join(' | '));
const max = H.reduce((a, b) => (b.hFp > a.hFp ? b : a));
console.log('hueco real maximo: ' + (max.hFp * 60).toFixed(2) + ' min en ' + max.cuando);
const por = {};
for (const f of H) { const k = f.ver + '/' + f.ritmo + '/' + f.concl; por[k] = (por[k] || 0) + 1; }
console.log('por veredicto/ritmo/conclusion: ' + JSON.stringify(por));
const D = JSON.parse(fs.readFileSync(path.join(dir, 'despl-sep.json'), 'utf8')).despliegues;
console.log('POBLACION despl-sep.json despliegues=' + D.length + ' del ' + D.map((d) => d.creado).sort()[0] + ' al ' + D.map((d) => d.creado).sort().at(-1));
const v = D.filter((d) => d.creado >= '2026-09-23' && d.creado < '2026-09-27').sort((a, b) => (a.creado < b.creado ? -1 : 1));
const fin = (d) => (d.estados.some((s) => s.e === 'SUCCESS') ? 'OK' : d.estados.some((s) => s.e === 'FAILURE' || s.e === 'ERROR') ? 'FALLO' : 'OTRO');
const rachas = [];
for (const d of v) { const f = fin(d); if (!rachas.length || rachas.at(-1).f !== f) rachas.push({ f, n: 0, desde: d.creado, hasta: d.creado }); rachas.at(-1).n++; rachas.at(-1).hasta = d.creado; }
console.log('rachas 23..26-sep (' + v.length + ' despliegues): ' + rachas.map((r) => r.f + ' x' + r.n + ' [' + r.desde + ' .. ' + r.hasta + ']').join(' ; '));
console.log('suma FALLO=' + rachas.filter((r) => r.f === 'FALLO').reduce((a, r) => a + r.n, 0) + ' suma OK=' + rachas.filter((r) => r.f === 'OK').reduce((a, r) => a + r.n, 0));
const d2 = JSON.parse(fs.readFileSync(path.join(dir, 'despl.json'), 'utf8')).despliegues;
console.log('POBLACION despl.json despliegues=' + d2.length + ' del ' + d2.map((d) => d.creado).sort()[0] + ' al ' + d2.map((d) => d.creado).sort().at(-1));
