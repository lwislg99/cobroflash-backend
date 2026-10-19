// SCRUM-1527c · en cada log con «TANDA SIN VEREDICTO»: la ÚLTIMA ráfaga antes del silencio.
//
// Por qué decide (fuente de node 24.18.0 y 24.21.0, idéntica en esto: FileTest.addToReport):
// lo que llega de un hijo que no es el primero de la cola se RETIENE, y sólo se suelta cuando ese
// mismo hijo manda otro mensaje siendo ya el primero, o cuando el fichero COMPLETA. Si casos que
// duraron segundos salen impresos en el mismo milisegundo que los del fichero anterior, no se
// imprimieron en vivo: los soltó la cascada de ficheros ya completos. El último de una cascada así
// está COMPLETO, y el que no completa es el SIGUIENTE.
//
//   node cascada.mjs <dir de logs>        (sólo lee; un .log por job)
import fs from 'node:fs';
const dir = process.argv[2];
const CSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;
const HUECO_MS = 5; // dos líneas a menos de 5 ms son la misma ráfaga
let n = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.log')).sort()) {
  const L = fs.readFileSync(`${dir}/${f}`, 'utf8').replace(CSI, '').split('\n');
  const ia = L.findIndex((l) => l.includes('TANDA SIN VEREDICTO (SCRUM-858):'));
  if (ia < 0) continue;
  n++;
  const casos = [];
  for (let k = ia - 1; k > 0 && casos.length < 4000; k--) {
    const m = /^(\S+Z) ([✔✖﹣]) (.*) \(([\d.]+)ms\)\s*$/.exec(L[k]);
    if (m) casos.push({ t: Date.parse(m[1]) + Number(m[1].slice(23, 27)) / 10000, nombre: m[3], ms: Number(m[4]) });
    else if (/^\S+Z [▶ℹ]/.test(L[k]) || /^\S+Z\s*$/.test(L[k])) continue;
    else if (casos.length && /^\S+Z /.test(L[k]) && !/^\S+Z\s{2,}/.test(L[k])) break;
  }
  const rafaga = [casos[0]];
  for (let i = 1; i < casos.length && rafaga.at(-1).t - casos[i].t < HUECO_MS; i++) rafaga.push(casos[i]);
  const span = rafaga[0].t - rafaga.at(-1).t;
  const suma = rafaga.reduce((a, c) => a + c.ms, 0);
  const largos = rafaga.filter((c) => c.ms >= 1000);
  console.log(`${f} · ráfaga final: ${rafaga.length} casos en ${span.toFixed(1)} ms · suma de sus duraciones ${Math.round(suma)} ms · casos de 1 s o más dentro: ${largos.length}`);
  console.log(`   empieza: ${rafaga.at(-1).nombre.slice(0, 70)}`);
  console.log(`   acaba:   ${rafaga[0].nombre.slice(0, 70)}`);
  for (const c of largos.slice(0, 4)) console.log(`   largo:   ${Math.round(c.ms)} ms · ${c.nombre.slice(0, 60)}`);
}
console.log(`POBLACION logs con aviso=${n}`);
