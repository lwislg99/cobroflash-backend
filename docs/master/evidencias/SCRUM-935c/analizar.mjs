// SCRUM-935c · de cada log del meta-guard saca: N (líneas de resultado), la fase de mutación y el
// coste POR GUARD (limpia + sus mutaciones), que es lo que imprime el instrumento: una línea por
// mutación con su hora, y los guards en serie.
// Uso: node analizar.mjs <muestra.json> <dirSalida>
//   escribe <dirSalida>/serie.tsv y <dirSalida>/guards-<run>.tsv (uno por log COMPLETO)
// Estados de un log: COMPLETO (trae la línea «vivas N · …» y el recuento de líneas casa con ella),
// CORTADO (no la trae: job cortado o colgado), NO-CASA (la trae pero el recuento no suma: estoy
// contando texto) y CIEGO (vacío o sin una sola línea de resultado).
import fs from 'node:fs';
import path from 'node:path';

const [entrada, dirSalida] = process.argv.slice(2);
const filas = JSON.parse(fs.readFileSync(entrada, 'utf8'));
fs.mkdirSync(dirSalida, { recursive: true });

// La línea de resultado: hora, DOS o más espacios, símbolo, el fichero del guard, « · ».
// Anclada al INICIO del caso (cicatriz ③): el símbolo también sale dentro de nombres de test.
const RES = /^(\d{4}-\d\d-\d\dT[\d:.]+Z) {2,}([✔✖☠?]) (\S+\.mjs) · /u;
const ARRANQUE = /^(\S+Z) > node scripts\/meta-guard-mutaciones\.mjs/;
const RESUMEN = /^(\S+Z) vivas (\d+) · mudas (\d+) · ciegas (\d+) · ficheros muertos (\d+)/;

export function analizarLog(texto) {
  const lineas = texto.split(/\r?\n/);
  let t0 = null; let resumen = null; const res = [];
  for (const l of lineas) {
    let m;
    if (!t0 && (m = l.match(ARRANQUE))) { t0 = Date.parse(m[1]); continue; }
    if ((m = l.match(RES))) { res.push({ t: Date.parse(m[1]), s: m[2], guard: m[3] }); continue; }
    if ((m = l.match(RESUMEN))) resumen = { t: Date.parse(m[1]), vivas: +m[2], mudas: +m[3], ciegas: +m[4], muertos: +m[5] };
  }
  if (!t0 || !res.length) return { estado: 'CIEGO', n: res.length };
  // control de suma: cada mutación imprime UNA línea; las ciegas por declaración ilegible también.
  const vivasLineas = res.filter((r) => r.s === '✔').length;
  let estado = 'CORTADO';
  if (resumen) {
    const total = resumen.vivas + resumen.mudas + resumen.ciegas + resumen.muertos;
    estado = (vivasLineas === resumen.vivas && res.length === total) ? 'COMPLETO' : 'NO-CASA';
  }
  // coste por guard: desde el final del bloque anterior (o el arranque) hasta su última línea.
  const guards = [];
  let prev = t0;
  for (let i = 0; i < res.length; i++) {
    const g = res[i].guard;
    if (i === 0 || res[i - 1].guard !== g) guards.push({ guard: g, n: 0, desde: prev, deltas: [] });
    const b = guards[guards.length - 1];
    b.deltas.push((res[i].t - prev) / 1000);
    b.n++; b.hasta = res[i].t; prev = res[i].t;
  }
  for (const b of guards) {
    b.seg = (b.hasta - b.desde) / 1000;
    const resto = b.deltas.slice(1).sort((a, c) => a - c);
    b.porMut = resto.length ? resto[Math.floor(resto.length / 2)] : null; // mediana sin la 1ª
    b.limpiaAprox = b.porMut == null ? null : Math.max(0, b.deltas[0] - b.porMut);
  }
  const fin = resumen ? resumen.t : res[res.length - 1].t;
  return { estado, n: res.length, vivasLineas, resumen, fase: (fin - t0) / 1000, guards,
    repetidos: guards.length - new Set(guards.map((g) => g.guard)).size };
}

const serie = ['dia\trun\tevento\trama\tconclusion_job\tpaso_seg_api\testado_log\tlog_bytes\tN_lineas\tvivas\tciegas\tmuertos\tguards\tfase_seg\tseg_por_mutacion'];
const cuenta = {};
for (const f of filas) {
  let a = null;
  if (f.log && f.log !== 'CIEGO' && fs.existsSync(f.log)) {
    const texto = fs.readFileSync(f.log, 'utf8');
    a = texto.length < 1000 ? { estado: 'CIEGO', n: 0 } : analizarLog(texto);
    if (a.estado === 'COMPLETO') {
      const t = ['# SCRUM-935c · coste por guard del meta-guard · run ' + f.run + ' · ' + f.creado + ' · ' + f.evento + ' · ' + f.rama,
        `# fase ${a.fase.toFixed(0)} s · ${a.n} mutaciones · ${a.guards.length} guards`,
        'guard\tmutaciones\tseg_total\tseg_por_mutacion_mediana\tlimpia_aprox_seg'];
      for (const g of [...a.guards].sort((x, y) => y.seg - x.seg)) {
        t.push(`${g.guard}\t${g.n}\t${g.seg.toFixed(1)}\t${g.porMut == null ? '' : g.porMut.toFixed(2)}\t${g.limpiaAprox == null ? '' : g.limpiaAprox.toFixed(1)}`);
      }
      fs.writeFileSync(path.join(dirSalida, `guards-${f.run}.tsv`), t.join('\n') + '\n');
    }
  }
  const est = a ? a.estado : (f.log === 'CIEGO' ? 'CIEGO' : 'sin-log');
  cuenta[est] = (cuenta[est] || 0) + 1;
  serie.push([f.dia, f.run, f.evento, f.rama, f.conclusion, f.pasoSeg ?? '', est, f.logBytes ?? '',
    a?.n ?? '', a?.resumen?.vivas ?? '', a?.resumen?.ciegas ?? '', a?.resumen?.muertos ?? '',
    a?.guards?.length ?? '', a?.fase != null ? a.fase.toFixed(0) : '',
    a?.fase != null && a.n ? (a.fase / a.n).toFixed(2) : ''].join('\t'));
}
fs.writeFileSync(path.join(dirSalida, 'serie.tsv'), serie.join('\n') + '\n');
console.log('POBLACIÓN · ' + filas.length + ' runs · ' + Object.entries(cuenta).map(([k, v]) => `${k} ${v}`).join(' · '));
