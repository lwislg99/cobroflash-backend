// SCRUM-1625 · J3 · ¿por qué el brazo CON de scrum1405c ④ pierde ahora en el 7,8 % de las pasadas y no en el 3,4 %?
//
// NO es un censo nuevo: la pérdida por pasada sale de los dos censos que ya existen
//   · 1405d (14→20-oct): docs/master/evidencias/SCRUM-1405/j3n-1405d/censo.tsv   (columna «con»)
//   · 1405f (21→27-oct): docs/master/evidencias/SCRUM-1405/j3bw-1405f/censo.tsv  (columna «con»)
// Este guion sólo vuelve a bajar el log de cada job que ya está en esos censos y saca lo que ellos no
// guardaron: versión del runner y de su imagen, región, versión de node, cuántos tests tuvo la tanda,
// cuánto duró la tanda, cuánto duró ④ y a qué altura de la tanda empezó. Junta por id de job.
//
// Uso: node covariables.mjs <censo.tsv>... --logs <dir FUERA del árbol> --salida <cov.tsv>
//      node covariables.mjs --controles
//
// CONTROL POSITIVO en cada log: la línea de ④ (anclada al inicio del caso, cicatriz ③) y la línea
// «sonda: … con el módulo: [...]» tienen que estar, y la lista «con» del log tiene que ser LA MISMA que
// la del censo. Si falta algo o no casa, la fila sale CIEGO con su motivo, no con covariables a medias.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'lwislg99/cobroflash-backend';
const run = promisify(execFile);
const gh = async (args) => {
  for (let i = 1; ; i++) {
    try { return (await run(GH, args, { encoding: 'utf8', maxBuffer: 1 << 28 })).stdout; } catch (e) {
      if (i >= 4) throw e;
      await new Promise((r) => setTimeout(r, 5000 * i));
    }
  }
};

const T = '(\\S+Z) ';
const una = (re, txt) => { const m = re.exec(txt); return m ? m[1] : ''; };
const ms = (iso) => Date.parse(iso);

/** De un log: las covariables, o CIEGO con su motivo. `conCenso` es la lista «con» que dio el censo. */
export function covariables(txt, conCenso) {
  const r = { bytes: Buffer.byteLength(txt) };
  r.runner = una(/Current runner version: '([^']+)'/, txt);
  r.provisioner = una(/Hosted Compute Agent\s*\n\S+Z Version: (\S+)/, txt);
  r.region = una(/^\S+Z Region: (\S+)/m, txt);
  r.imagen = una(/^\S+Z Image: \S+\s*\n\S+Z Version: (\S+)/m, txt);
  r.node = una(/hostedtoolcache\/node\/([\d.]+)\//, txt);
  r.tests = una(new RegExp(`^${T.replace('(\\S+Z)', '\\S+Z')}ℹ tests (\\d+)$`, 'm'), txt);
  r.tandaMs = una(new RegExp(`^\\S+Z ℹ duration_ms ([\\d.]+)$`, 'm'), txt);
  const arranque = new RegExp(`^${T}> npm run build && node scripts/tanda`, 'm').exec(txt);
  const cuarto = new RegExp(`^${T}(?:[✔✖﹣]) SCRUM-1405c · ④ [^\\n]*\\(([\\d.]+)ms\\)`, 'm').exec(txt);
  // Antes de SCRUM-1574 (los jobs de 1405d) la línea no llevaba «sonda: N bytes · »: la sonda sale vacía.
  const listas = /SCRUM-1405c · (?:sonda: (\d+) bytes · )?sin el módulo: \[[^\]]*\] · con el módulo: (\[[^\]]*\])/.exec(txt);
  if (!cuarto) return { ...r, estado: 'CIEGO', motivo: r.bytes < 100000 ? `log de ${r.bytes} B` : 'sin la línea de ④' };
  if (!listas) return { ...r, estado: 'CIEGO', motivo: 'sin la línea de la sonda' };
  const con = JSON.parse(listas[2]).map((f) => f.faltan).join(',');
  if (con !== conCenso) return { ...r, estado: 'CIEGO', motivo: `con del log ${con} ≠ censo ${conCenso}` };
  r.cuartoMs = Math.round(Number(cuarto[2]));
  r.cuartoA = arranque ? Math.round((ms(cuarto[1]) - ms(arranque[1])) / 1000) : '';
  r.sonda = listas[1] ?? '';
  return { ...r, estado: 'ok', motivo: '' };
}

function controles() {
  const ok = (c, d) => { if (!c) { console.error('🔴 CONTROL FALLA:', d); process.exit(2); } };
  const h = (s) => `2026-10-27T14:${s}.0000000Z `;
  const fila = (f) => JSON.stringify(f.map((x) => ({ codigo: 0, informados: 320 - x, faltan: x })));
  const log = [
    `${h('14:50')}Current runner version: '2.338.0'`, `${h('14:50')}Hosted Compute Agent`, `${h('14:50')}Version: 20261021.618`,
    `${h('14:50')}Region: eastus2`, `${h('14:50')}Image: ubuntu-24.04`, `${h('14:50')}Version: 20261025.353.1`,
    `${h('15:10')}Found in cache @ /opt/hostedtoolcache/node/24.22.1/x64`, 'x'.repeat(200000),
    `${h('15:44')}> npm run build && node scripts/tanda-con-veredicto.mjs node --test`,
    `${h('16:00')}✔ SCRUM-1328 · un «✔ SCRUM-1405c · ④ falso» dentro de un nombre (9999ms)`,
    `${h('18:41')}✔ SCRUM-1405c · ④ 🔴 EL ROJO PRIMERO: x (4105.496182ms)`,
    `${h('18:41')}ℹ SCRUM-1405c · sonda: 1048576 bytes · sin el módulo: ${fila([28, 13, 1, 2])} · con el módulo: ${fila([0, 15, 0, 3])}`,
    `${h('28:28')}ℹ tests 12801`, `${h('28:28')}ℹ duration_ms 753950.4`,
  ].join('\n') + '\n';
  const a = covariables(log, '0,15,0,3');
  ok(a.estado === 'ok' && a.runner === '2.338.0' && a.provisioner === '20261021.618' && a.imagen === '20261025.353.1'
    && a.region === 'eastus2' && a.node === '24.22.1' && a.tests === '12801' && a.tandaMs === '753950.4'
    && a.cuartoMs === 4105 && a.cuartoA === 177 && a.sonda === '1048576', '① completo ' + JSON.stringify(a));
  // ② la lista del log no casa con la del censo → CIEGO (no se juntan covariables de otro job)
  ok(covariables(log, '0,0,0,0').estado === 'CIEGO', '② no casa');
  // ③ quitada la línea de ④ (la de dentro de otro nombre NO cuenta) → CIEGO
  ok(covariables(log.replace(/^.*✔ SCRUM-1405c · ④ 🔴.*$/m, ''), '0,15,0,3').motivo === 'sin la línea de ④', '③ sin ④');
  // ③bis el formato de antes de 1574, sin «sonda: N bytes · », también se lee
  const viejo = covariables(log.replace('sonda: 1048576 bytes · ', ''), '0,15,0,3');
  ok(viejo.estado === 'ok' && viejo.sonda === '', '③bis formato 1405d ' + JSON.stringify(viejo));
  // ④ log VACÍO → CIEGO, no una fila con covariables vacías
  const v = covariables('', '0,0,0,0');
  ok(v.estado === 'CIEGO' && v.motivo === 'log de 0 B', '④ vacío ' + JSON.stringify(v));
  console.log('CONTROLES · 5 de 5 en su sitio (completo, lista que no casa, sin ④, formato 1405d, vacío)');
}

const leeTsv = (f) => {
  const [cab, ...ls] = fs.readFileSync(f, 'utf8').trimEnd().split('\n');
  const col = cab.split('\t');
  return ls.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [col[i], v])));
};

async function main() {
  controles();
  if (process.argv[2] === '--controles') return;
  const args = process.argv.slice(2);
  const dir = args[args.indexOf('--logs') + 1];
  const salida = args[args.indexOf('--salida') + 1];
  const censos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--logs' && args[i - 1] !== '--salida');
  if (!dir || !salida || !censos.length) throw new Error('uso: covariables.mjs <censo.tsv>... --logs <dir> --salida <cov.tsv>');
  fs.mkdirSync(dir, { recursive: true });
  const filas = censos.flatMap((c) => leeTsv(c).filter((f) => f.con && f.con.includes(',')).map((f) => ({ censo: path.basename(path.dirname(c)), ...f })));
  console.log(`POBLACIÓN · ${filas.length} jobs con la lista «con» en ${censos.length} censos`);
  const out = [];
  let i = 0, hechos = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < filas.length) {
      const f = filas[i++];
      const p = path.join(dir, `${f.job}.log`);
      let c;
      try {
        if (!fs.existsSync(p)) fs.writeFileSync(p, await gh(['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${f.job}/logs`]));
        c = covariables(fs.readFileSync(p, 'utf8'), f.con);
        if (c.estado === 'ok') fs.unlinkSync(p);
      } catch (e) { c = { estado: 'LOG-NO-BAJADO', motivo: String(e.message).slice(0, 80) }; }
      out.push({ censo: f.censo, cuando: f.cuando, job: f.job, evento: f.evento, rama: f.rama, sha: f.sha, con: f.con, ...c });
      if (++hechos % 50 === 0) console.log(`… ${hechos}/${filas.length}`);
    }
  }));
  out.sort((a, b) => a.cuando.localeCompare(b.cuando));
  const col = ['censo', 'cuando', 'job', 'evento', 'rama', 'sha', 'con', 'estado', 'motivo', 'bytes', 'runner', 'provisioner', 'region', 'imagen', 'node', 'tests', 'tandaMs', 'cuartoMs', 'cuartoA', 'sonda'];
  fs.writeFileSync(salida, [col.join('\t'), ...out.map((f) => col.map((k) => String(f[k] ?? '').replace(/\t/g, ' ')).join('\t'))].join('\n') + '\n');
  const por = out.reduce((a, f) => ((a[f.estado] = (a[f.estado] || 0) + 1), a), {});
  console.log('ESTADOS', JSON.stringify(por), `· ${out.length} de ${filas.length}`);
}
// Sólo corre como guion, no al importarlo. Con `new URL().pathname` la ruta lleva «%20» y no casaba nunca:
// el guion salía 0 sin imprimir nada (27-oct, cazado al ver que --controles no decía «CONTROLES»).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
