// SCRUM-1527c · en cada log con aviso: cuánto tarda en llegar la PRIMERA línea del último fichero
// entregado desde la última del fichero anterior. ≤ 1 ms = cascada (lo soltó el cierre del anterior
// junto con lo ya completo: el último fichero estaba COMPLETO). Segundos o decenas de ms = lo soltó
// un mensaje propio o su propio cierre: no separa.
//
//   node frontera-final.mjs <dir de logs> [<dir>…]      (sólo lee)
import fs from 'node:fs';
const PRIMERO = {
  'scrum615-plazo-con-null': 'SCRUM-615 · SUELO: las cuatro piezas del plazo existen',
  'scrum615-pedir-tipo-destinatario': 'SCRUM-615 · SUELO: el módulo exporta lo que estos test',
  'scrum446-cabecera-modal': 'SCRUM-446 · SUELO: el detector ve ficheros',
  'scrum445-cobros-sin-duplicar': 'SCRUM-445 · SUELO: con las dos poblaciones vacías, la fusión',
  'scrum475-constancia-correo': 'SCRUM-475 f2 · 🔴 AUTOPRUEBA: el detector SÍ ve una respuesta tirada',
};
const CSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;
const ts = (l) => Date.parse(l.slice(0, 28)) + Number(l.slice(23, 27)) / 10000;
let n = 0;
for (const dir of process.argv.slice(2)) for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.log')).sort()) {
  const L = fs.readFileSync(`${dir}/${f}`, 'utf8').replace(CSI, '').split('\n');
  const ia = L.findIndex((l) => l.includes('TANDA SIN VEREDICTO (SCRUM-858):'));
  if (ia < 0) continue;
  n++;
  let k = ia - 1; while (!/Z [✔✖]/.test(L[k])) k--;
  let dicho = false;
  for (const [fichero, p] of Object.entries(PRIMERO)) {
    const j = L.slice(0, k + 1).findLastIndex((l) => l.includes(p));
    if (j < 0 || k - j >= 40) continue;
    let a = j - 1; while (!/Z [✔✖]/.test(L[a])) a--;
    console.log(`${f} · ${fichero} · 1.ª línea ${(ts(L[j]) - ts(L[a])).toFixed(2)} ms tras la anterior («${L[a].slice(31, 80)}»)`);
    dicho = true;
  }
  if (!dicho) console.log(`${f} · último caso «${L[k].slice(31, 100)}» (fichero sin primera línea conocida: mirar la ráfaga con cascada.mjs)`);
}
console.log(`POBLACION logs con aviso=${n}`);
