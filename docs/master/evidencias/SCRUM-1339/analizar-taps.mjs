#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/analizar-taps.mjs
//
// Lee cada TAP bajado por `bajar-taps.mjs` y saca, por run, lo que el propio TAP dice de sí mismo:
//   · el resumen del reporter (`# tests`, `# pass`, `# fail`, `# skipped`, `# cancelled`) y el plan `1..N`;
//   · cuántas líneas de resultado (`ok` / `not ok`) hay de verdad, de primer nivel y anidadas;
//   · los HUECOS de la numeración de primer nivel (`ok 122` seguido de `ok 9187`);
//   · cuántos bytes NUL lleva (un TAP sano lleva 0).
//
//   node analizar-taps.mjs <carpeta con los .tap y artefactos.tsv>  →  <carpeta>/taps.tsv
//
// 🔴 El recuento (`# tests`) y las líneas son DOS cosas: el primero lo calcula el corredor al final,
// las segundas son lo que quedó escrito. Se sacan las dos y no se da una por la otra.
import fs from 'node:fs';
import path from 'node:path';

const carpeta = process.argv[2];
if (!carpeta) { console.error('uso: node analizar-taps.mjs <carpeta>'); process.exit(2); }

const meta = new Map();
for (const l of fs.readFileSync(path.join(carpeta, 'artefactos.tsv'), 'utf8').split('\n').slice(1)) {
  if (!l) continue;
  const [artifact, run, sha, rama, creado] = l.split('\t');
  meta.set(`${run}-${artifact}`, { artifact, run, sha, rama, creado });
}

const ficheros = fs.readdirSync(carpeta).filter((f) => f.endsWith('.tap')).sort();
const filas = [];
for (const f of ficheros) {
  const b = fs.readFileSync(path.join(carpeta, f));
  let nul = 0;
  for (let i = 0; i < b.length; i++) if (b[i] === 0) nul++;
  const lineas = b.toString('utf8').split('\n');
  const resumen = {};
  let plan = null; let primer = 0; let anidadas = 0; let noOk = 0;
  const huecos = []; let anterior = 0; let versiones = 0;
  for (const cruda of lineas) {
    // Un tramo de NUL va pegado al principio de la primera línea que se escribe detrás de él.
    const l = cruda.replace(/^\0+/, '');
    let m;
    if ((m = l.match(/^(not )?ok (\d+) /))) {
      primer++; if (m[1]) noOk++;
      const n = Number(m[2]);
      if (n !== anterior + 1) huecos.push(`${anterior}→${n}`);
      anterior = n;
    } else if (/^\s+(not )?ok \d+ /.test(l)) { anidadas++; if (/^\s+not ok/.test(l)) noOk++; }
    else if ((m = l.match(/^# (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)\s*$/))) resumen[m[1]] = Number(m[2]);
    else if ((m = l.match(/^1\.\.(\d+)\s*$/))) plan = Number(m[1]);
    else if (/^TAP version 13/.test(l)) versiones++;
  }
  const k = f.replace(/\.tap$/, '');
  const d = meta.get(k) || {};
  filas.push({
    run: d.run, artifact: d.artifact, sha: d.sha, rama: d.rama, creado: d.creado, bytes: b.length, nul,
    tests: resumen.tests ?? '', pass: resumen.pass ?? '', fail: resumen.fail ?? '', skipped: resumen.skipped ?? '',
    cancelled: resumen.cancelled ?? '', plan: plan ?? '', primer, anidadas, lineas_no_ok: noOk, cabeceras: versiones,
    huecos: huecos.join(' ') || '-',
  });
}
const columnas = Object.keys(filas[0]);
fs.writeFileSync(path.join(carpeta, 'taps.tsv'), [columnas.join('\t'), ...filas.map((r) => columnas.map((c) => r[c]).join('\t'))].join('\n') + '\n');

const conNul = filas.filter((r) => r.nul > 0);
const conHueco = filas.filter((r) => r.huecos !== '-');
const sinResumen = filas.filter((r) => r.tests === '');
const completos = filas.filter((r) => r.tests !== '' && r.huecos === '-' && r.nul === 0);
const cuadran = completos.filter((r) => r.primer + r.anidadas === r.tests);
console.log(`POBLACION: ${filas.length} TAP leídos (de ${ficheros.length} ficheros .tap)`);
console.log(`  con bytes NUL: ${conNul.length} · con hueco en la numeración de primer nivel: ${conHueco.length} · sin línea «# tests»: ${sinResumen.length}`);
console.log(`  sanos (con resumen, sin NUL, sin hueco): ${completos.length} · de ésos, líneas de resultado == «# tests»: ${cuadran.length}`);
console.log(`EXIT=0`);
