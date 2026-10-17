// Lee las marcas de una pasada y su TAP: ¿cuánto se pisan en el tiempo scrum1515 y scrum17, quién más
// corrió a la vez que scrum1515, y cómo acabó cada uno?
// Uso: node solape-876h.mjs <marcas.tsv> <pasada.tap> <ficheros esperados>
import fs from 'node:fs';

const [, , rutaMarcas, rutaTap, esperados] = process.argv;
const filas = fs.existsSync(rutaMarcas) ? fs.readFileSync(rutaMarcas, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t')) : [];
const porFichero = new Map();
for (const [que, t, , fichero] of filas) {
  const f = porFichero.get(fichero) || {};
  if (que === 'ARRANCA') f.t0 = Number(t); else f.t1 = Number(t);
  porFichero.set(fichero, f);
}
const completos = [...porFichero.entries()].filter(([, f]) => f.t0 && f.t1);
const A = 'scrum1515-nuestra-puerta-de-alta.test.mjs';
const B = 'scrum17-recapitulativa.test.mjs';
const a = porFichero.get(A);
const b = porFichero.get(B);
const tap = fs.existsSync(rutaTap) ? fs.readFileSync(rutaTap, 'utf8').split(/\r?\n/) : [];
const linea = (clave) => tap.find((l) => /^(not ok|ok) \d+ - /.test(l) && l.includes(clave)) || '';
// El lado por defecto NO es el bueno: una línea que no se sabe leer sale «NO-SE», nunca «ok».
const estado = (l) => (!l ? 'AUSENTE' : /^not ok/.test(l) ? 'CAE' : /# SKIP/.test(l) ? 'SALTADO' : /^ok \d+ - /.test(l) ? 'ok' : 'NO-SE');
const resumen = tap.filter((l) => /^# (tests|pass|fail|skipped) /.test(l)).map((l) => l.slice(2)).join(' ');
const caidos = tap.filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, '').slice(0, 50));
const motivo = (tap.find((l) => /!==|el guion no ha dejado|HA DADO DE ALTA/.test(l)) || '').trim().slice(0, 110);

if (!a || !a.t0 || !a.t1 || !b || !b.t0 || !b.t1) {
  console.log(`CIEGO · marcas de ${completos.length} de ${esperados} ficheros · 1515 ${a ? 'visto' : 'NO visto'} · scrum17 ${b ? 'visto' : 'NO visto'} · ${resumen}`);
  process.exit(2);
}
const solape = Math.max(0, Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0));
const aLaVez = completos.filter(([n, f]) => n !== A && f.t0 < a.t1 && f.t1 > a.t0).length;
const s = (ms) => (ms / 1000).toFixed(1);
console.log(
  `marcas ${completos.length}/${esperados} · 1515 dura ${s(a.t1 - a.t0)}s · scrum17 dura ${s(b.t1 - b.t0)}s · scrum17 arranca ${s(b.t0 - a.t0)}s tras 1515 y ${s(b.t0 - a.t1)}s tras SU final · SOLAPE ${s(solape)}s · a la vez que 1515: ${aLaVez} ficheros` +
  ` · 1515=${estado(linea('SCRUM-1515 '))} · scrum17=${estado(linea('SCRUM-17: consolidar'))} · ${resumen}${caidos.length ? ' · caidos: ' + caidos.join(' || ') : ''}${motivo ? ' · ' + motivo : ''}`,
);
