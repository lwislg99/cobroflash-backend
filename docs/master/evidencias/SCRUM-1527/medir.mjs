// SCRUM-1527 · mide cada log del job obligatorio. uso: node medir.mjs <jobs.json> <dirLogs> <salida.json>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const [jobsPath, dir, salida] = process.argv.slice(2);
const filas = JSON.parse(readFileSync(jobsPath, 'utf8'));
const ESC = String.fromCharCode(27);
const CSI = new RegExp(ESC + '\\[[0-9;?]*[ -/]*[@-~]', 'g');
const SELLO = /^﻿?\d{4}-\d\d-\d\dT[\d:.]+Z ?/;
const res = [];
for (const f of filas) {
  if (!f.job || f.conclusion === 'skipped') continue;
  const p = path.join(dir, `${f.job}.log`);
  if (!existsSync(p)) { res.push({ ...f, ciego: 'sin fichero' }); continue; }
  const buf = readFileSync(p);
  const txt = buf.toString('utf8');
  const lineas = txt.split('\n');
  const m = { bytes: buf.length, lineas: lineas.length, esc: (txt.match(new RegExp(ESC, 'g')) || []).length };
  let pasa = 0, cae = 0, pasaTop = 0, iSV = -1, iPrimero = -1, iUltimoCaso = -1;
  const limpias = lineas.map((l) => l.replace(CSI, '').replace(SELLO, ''));
  for (let i = 0; i < limpias.length; i++) {
    const l = limpias[i];
    if (/^\s*✔ /.test(l)) { pasa++; if (/^✔ /.test(l)) pasaTop++; if (iPrimero < 0) iPrimero = i; iUltimoCaso = i; }
    else if (/^\s*✖ /.test(l)) { cae++; iUltimoCaso = i; }
    if (iSV < 0 && l.includes('TANDA SIN VEREDICTO')) iSV = i;
  }
  m.pasa = pasa; m.pasaTop = pasaTop; m.cae = cae;
  const resumen = limpias.find((l) => /^\s*ℹ tests \d+/.test(l));
  m.resumen = resumen ? Number(resumen.match(/tests (\d+)/)[1]) : null;
  m.sinVeredicto = iSV >= 0;
  if (iSV >= 0) {
    m.silencio = Number((limpias[iSV].match(/: (\d+) s sin escribir/) || [])[1]);
    m.ultimo = (limpias[iSV + 1] || '').trim().slice(0, 220);
    // bytes del log hasta la linea del aviso
    m.bytesHastaAviso = Buffer.byteLength(lineas.slice(0, iSV).join('\n'));
    m.horaAviso = (lineas[iSV].match(/^﻿?(\S+Z)/) || [])[1];
    // ultima linea de caso antes del aviso, con su hora
    let k = iSV - 1; while (k >= 0 && !/^\s*[✔✖] /.test(limpias[k])) k--;
    m.ultimoCasoAntes = k >= 0 ? limpias[k].trim().slice(0, 160) : null;
    m.horaUltimoCaso = k >= 0 ? (lineas[k].match(/^﻿?(\S+Z)/) || [])[1] : null;
    m.horaPrimerCaso = iPrimero >= 0 ? (lineas[iPrimero].match(/^﻿?(\S+Z)/) || [])[1] : null;
    m.casosAntes = limpias.slice(0, iSV).filter((l) => /^\s*[✔✖] /.test(l)).length;
  }
  m.cancelado = limpias.some((l) => /The operation was canceled|##\[error\]The (job|operation) .*(cancel|timeout|exceeded)/i.test(l));
  m.ultimaLinea = (limpias.filter((l) => l.trim()).slice(-1)[0] || '').slice(0, 140);
  res.push({ ...f, ...m });
}
writeFileSync(salida, JSON.stringify(res, null, 1));
const n = (g) => res.filter(g).length;
console.log(`POBLACION logs=${res.length} ciegos=${n((r) => r.ciego)} conCeroLineasDeCaso=${n((r) => !r.ciego && r.pasa + r.cae === 0)} sinVeredicto=${n((r) => r.sinVeredicto)}`);
const por = {};
for (const r of res) { const k = `${r.conclusion}${r.sinVeredicto ? '+SV' : ''}`; por[k] = (por[k] || 0) + 1; }
console.log(por);
