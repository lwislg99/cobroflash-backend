// SCRUM-1527 · huecos de tiempo alrededor de scrum445b/446/447 en cada log. uso: node rafaga.mjs <medida.json> <dirLogs>
import { readFileSync } from 'node:fs';
import path from 'node:path';
const [medida, dir] = process.argv.slice(2);
const filas = JSON.parse(readFileSync(medida, 'utf8'));
const ESC = String.fromCharCode(27);
const CSI = new RegExp(ESC + '\\[[0-9;?]*[ -/]*[@-~]', 'g');
const t = (l) => { const m = l.match(/^﻿?(\d{4}-\d\d-\d\dT[\d:.]+Z)/); return m ? Date.parse(m[1].replace(/(\.\d{3})\d+Z/, '$1Z')) : NaN; };
const A = '✔ SCRUM-445 · ② el comentario NO vuelve';
const B0 = '✔ SCRUM-446 · SUELO';
const B1 = '✔ SCRUM-446 · los TRES overlays';
const C0 = 'SCRUM-447 · SUELO';
const C1 = 'SCRUM-447 · 🔴 ROJO POR EL MECANISMO';
const D0 = 'SCRUM-448';
const out = [];
for (const f of filas) {
  if (f.ciego || f.bytes < 1000) continue;
  const L = readFileSync(path.join(dir, `${f.job}.log`), 'utf8').split('\n').map((l) => l.replace(CSI, ''));
  const idx = (s) => L.findIndex((l) => l.includes(s));
  const [a, b0, b1, c0, c1, d0] = [A, B0, B1, C0, C1, D0].map(idx);
  const r = { job: f.job, concl: f.conclusion, sv: !!f.sinVeredicto, started: f.started, a, b0, b1, c0, c1, d0 };
  if (a >= 0 && b0 >= 0) r.gapA_B = t(L[b0]) - t(L[a]);
  if (b1 >= 0 && c0 >= 0) r.gapB_C = t(L[c0]) - t(L[b1]);
  if (c1 >= 0 && d0 >= 0) r.gapC_D = t(L[d0]) - t(L[c1]);
  if (c0 >= 0) r.msSuelo447 = Number((L[c0].match(/\(([\d.]+)ms\)/) || [])[1]);
  if (b0 >= 0) r.msSuelo446 = Number((L[b0].match(/\(([\d.]+)ms\)/) || [])[1]);
  // la rafaga que acaba en la ultima linea de caso antes del aviso (solo colgados)
  if (f.sinVeredicto) {
    const fin = L.findIndex((l) => l.includes('TANDA SIN VEREDICTO'));
    let k = fin - 1; while (k > 0 && !/Z\s*[✔✖﹣] /.test(L[k])) k--;
    const ult = k; let n = 0;
    while (k > 0 && t(L[k]) - t(L[k - 1]) < 1000) { k--; n++; }
    r.rafagaLineas = n + 1; r.rafagaHuecoAntes = t(L[k]) - t(L[k - 1]);
    r.rafagaPrimera = L[k].slice(29, 130); r.antesDeLaRafaga = L[k - 1].slice(29, 130);
    // primer caso de la tanda y arranque del paso
    const p = L.findIndex((l) => /Z\s*[✔✖] /.test(l));
    r.segDesdePrimerCaso = Math.round((t(L[ult]) - t(L[p])) / 1000);
    // huecos > 5 s dentro de la tanda antes del cuelgue
    r.huecos = [];
    for (let i = p + 1; i <= ult; i++) { const g = t(L[i]) - t(L[i - 1]); if (g > 8000) r.huecos.push(`${Math.round(g / 1000)}s antes de «${L[i].slice(29, 95)}»`); }
  }
  out.push(r);
}
const q = (arr) => { const s = arr.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? `n=${s.length} min=${s[0]} p50=${s[s.length >> 1]} p90=${s[Math.floor(s.length * 0.9)]} max=${s[s.length - 1]}` : 'n=0'; };
const completos = out.filter((r) => r.d0 >= 0 && !r.sv);
console.log(`POBLACION logs=${out.length} conLas3Anclas(a,b1,c0)=${out.filter((r) => r.a >= 0 && r.b1 >= 0 && r.c0 >= 0).length} completosHasta448=${completos.length}`);
console.log('gap 445b->446 (ms):', q(completos.map((r) => r.gapA_B)));
console.log('gap 446->447 (ms):', q(completos.map((r) => r.gapB_C)));
console.log('gap 447->448 (ms):', q(completos.map((r) => r.gapC_D)));
console.log('ms SUELO 447:', q(completos.map((r) => r.msSuelo447)));
console.log('ms SUELO 446:', q(completos.map((r) => r.msSuelo446)));
console.log('gap446->447 > 5s:', completos.filter((r) => r.gapB_C > 5000).map((r) => `${r.job}:${r.gapB_C}`).join(' ') || 'ninguno');
console.log('gap445b->446 > 5s:', completos.filter((r) => r.gapA_B > 5000).map((r) => `${r.job}:${r.gapA_B}`).join(' ') || 'ninguno');
console.log('orden raro (b0<a o c0<b1):', completos.filter((r) => r.b0 < r.a || r.c0 < r.b1).length);
for (const r of out.filter((x) => x.sv)) console.log(JSON.stringify(r, null, 0));
