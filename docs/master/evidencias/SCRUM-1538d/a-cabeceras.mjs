#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1538d/a-cabeceras.mjs — SCRUM-1538d · SÓLO LECTURA (gh api GET + git local).
//
// ¿Qué dejó de colgar las tandas el 14-oct hacia las 09:00Z? Sobre el listado de 1538c
// (`e-listar.mjs` de docs/master/evidencias/SCRUM-1538c/, re-ejecutado: `e-runs.json` + `e-jobs.tsv`),
// baja la CABECERA (los primeros 64 KB, con Range) del log de cada job de `trinquete` y de `build + tests`
// de una ventana declarada, y de las 33 colgadas. De cada cabecera saca lo que el runner dice de sí mismo:
// versión del runner, del aprovisionador y de la imagen, SHA de las acciones, node encontrado, y la BASE
// que se probó (en un PR, el `Merge <rama> into <base>` del checkout; en un push, el propio sha).
//
// Con eso contesta dos preguntas por separado, para cada familia:
//   · ¿CONTENIDO? — la base de main más nueva que todavía colgó. Todo commit de main anterior a ella queda
//     DESCARTADO como causa (una colgada con el arreglo dentro es un contraejemplo).
//   · ¿ENTORNO? — imagen, runner, node y acciones: qué valores llevan las colgadas y cuáles las limpias.
//
//   node a-cabeceras.mjs <carpeta del listado, FUERA del árbol> [--sin-siembra]
//
// Las 10 colgadas de la tanda NO se re-derivan aquí (el log entero pesa ~1,8 MB): son las 10 que
// `g-clasificar.mjs` de 1538c dio por COLGADA, y son exactamente los 10 logs de `build-failure` de menos de
// 1,3 MB de `f-bajados.tsv`. Se copian sus ids abajo y se comprueba que están en el listado.
import fs from 'node:fs';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';

const [carpeta, ...banderas] = process.argv.slice(2);
if (!carpeta) { console.error('uso: node a-cabeceras.mjs <carpeta> [--sin-siembra]'); process.exit(2); }
const REPO = 'lwislg99/cobroflash-backend';
const DESDE = '2026-10-06T13:43:02Z';   // el arranque del listado de 1538c: toda su población hasta 1494c
const HASTA = '2026-10-16T11:18:00Z';   // 1494c (#2486) entra a las 11:18Z: lo de después ya no compara igual
const CORTE = '2026-10-14T09:00:00Z';
const TECHO_TRINQUETE = 2400;           // ≥ 40 min cancelado = cortado por su techo (criterio de 1538c)
const TANDA_COLGADA = new Set(['112435237313', '112906403918', '113216097886', '115064831385', '115068271610',
  '115134364145', '115290677611', '115305001172', '115728094402', '115735116377']);

const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const p = (s) => console.log(s);

// ── el lector de la cabecera ────────────────────────────────────────────────────────────────────────
export function leerCabecera(txt) {
  const L = txt.split('\n');
  const tras = (marca) => { const i = L.findIndex((l) => l.includes(marca)); return i < 0 ? -1 : i; };
  const valor = (re) => { for (const l of L) { const m = l.match(re); if (m) return m[1]; } return null; };
  const iProv = tras('##[group]Runner Image Provisioner');
  const iImg = tras('##[group]Runner Image');
  const iImg2 = L.findIndex((l, i) => i > iProv && l.includes('##[group]Runner Image') && !l.includes('Provisioner'));
  const versionTras = (i) => { if (i < 0) return null; for (let k = i + 1; k < Math.min(i + 6, L.length); k++) { const m = L[k].match(/Version: (\S+)/); if (m) return m[1]; } return null; };
  const merge = txt.match(/HEAD is now at \w+ Merge ([0-9a-f]{40}) into ([0-9a-f]{40})/);
  return {
    runner: valor(/Current runner version: '([^']+)'/),
    provisioner: versionTras(iProv),
    imagen: valor(/Image: (\S+)/),
    imagenVersion: versionTras(iImg2 >= 0 ? iImg2 : iImg),
    checkout: valor(/Download action repository 'actions\/checkout@\S+' \(SHA:([0-9a-f]+)\)/),
    setupNode: valor(/Download action repository 'actions\/setup-node@\S+' \(SHA:([0-9a-f]+)\)/),
    node: valor(/(?:Found in cache @ \S+\/node\/|Acquiring )(\d+\.\d+\.\d+)/),
    base: merge ? merge[2] : null,
    cabezaHead: valor(/HEAD is now at (\w+)/),
  };
}

// ── siembra: el lector tiene que leer un log fabricado entero, y NO inventar sobre uno vacío ─────────────
const FAB = [
  "2026-10-14T00:00:00.0Z Current runner version: '9.9.9'",
  '2026-10-14T00:00:00.0Z ##[group]Runner Image Provisioner', '2026-10-14T00:00:00.0Z Hosted Compute Agent', '2026-10-14T00:00:00.0Z Version: 11111111.1',
  '2026-10-14T00:00:00.0Z ##[group]Runner Image', '2026-10-14T00:00:00.0Z Image: ubuntu-99.04', '2026-10-14T00:00:00.0Z Version: 22222222.2',
  "2026-10-14T00:00:00.0Z Download action repository 'actions/checkout@v4' (SHA:aaaa)",
  "2026-10-14T00:00:00.0Z Download action repository 'actions/setup-node@v4' (SHA:bbbb)",
  `2026-10-14T00:00:00.0Z HEAD is now at 1234567 Merge ${'c'.repeat(40)} into ${'d'.repeat(40)}`,
  '2026-10-14T00:00:00.0Z Found in cache @ /opt/hostedtoolcache/node/99.1.2/x64',
].join('\n');
const siembras = [
  ['log fabricado entero', () => { const c = leerCabecera(FAB); return c.runner === '9.9.9' && c.provisioner === '11111111.1' && c.imagen === 'ubuntu-99.04' && c.imagenVersion === '22222222.2' && c.checkout === 'aaaa' && c.setupNode === 'bbbb' && c.node === '99.1.2' && c.base === 'd'.repeat(40); }],
  ['log vacío no inventa nada', () => Object.values(leerCabecera('')).every((v) => v === null)],
];
let sembradas = 0;
for (const [n, f] of siembras) { const ok = !banderas.includes('--sin-siembra') && f(); p(`SIEMBRA ${ok ? 'OK  ' : 'FALLA'} ${n}`); if (ok) sembradas++; }
if (sembradas !== siembras.length) { p(`CIEGO · siembra ${sembradas} de ${siembras.length}: el lector no está probado y no se lee nada`); process.exit(4); }

// ── población ───────────────────────────────────────────────────────────────────────────────────────
const runs = JSON.parse(fs.readFileSync(path.join(carpeta, 'e-runs.json'), 'utf8'));
const tsv = fs.readFileSync(path.join(carpeta, 'e-jobs.tsv'), 'utf8').trim().split('\n');
const cab = tsv[0].split('\t');
const jobs = tsv.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cab[i], v])));
const familia = (n) => (n.startsWith('trinquete') ? 'trinquete' : n.startsWith('build + tests') ? 'tanda' : null);

const gh = (args) => new Promise((ok, mal) => execFile('gh', args, { env, encoding: 'utf8', maxBuffer: 1 << 26 }, (e, out) => (e ? mal(new Error(String(e.message).split('\n')[0])) : ok(out))));
// los runs limpios no tienen jobs en el listado (todos sus jobs salieron verdes): se piden los de la ventana
const limpios = runs.filter((r) => r.status === 'completed' && r.conclusion === 'success' && r.intento === 1 && r.creado >= DESDE && r.creado < HASTA);
let fallosLlamada = [];
for (const r of limpios) {
  try {
    const j = JSON.parse(await gh(['api', `repos/${REPO}/actions/runs/${r.id}/jobs?filter=all&per_page=100`]));
    for (const x of j.jobs) jobs.push({ run: String(r.id), evento: r.evento, rama: r.rama, sha: r.sha, intento: String(x.run_attempt), creado: r.creado, job: String(x.id), nombre: x.name, status: x.status, conclusion: x.conclusion ?? '', empieza: x.started_at ?? '', acaba: x.completed_at ?? '', segundos: String(x.started_at && x.completed_at ? (Date.parse(x.completed_at) - Date.parse(x.started_at)) / 1000 : -1), limpio: '1' });
  } catch (e) { fallosLlamada.push(e.message); }
}

const estado = (j) => {
  const f = familia(j.nombre);
  if (f === 'trinquete') {
    if (j.conclusion === 'cancelled') return Number(j.segundos) >= TECHO_TRINQUETE ? 'COLGADA' : null; // cortado antes: empujón nuevo, no cuenta
    return ['success', 'failure'].includes(j.conclusion) ? 'LIMPIA' : null;
  }
  if (f === 'tanda') {
    if (TANDA_COLGADA.has(j.job)) return 'COLGADA';
    return ['success', 'failure'].includes(j.conclusion) ? 'LIMPIA' : null;
  }
  return null;
};
const sel = jobs.filter((j) => familia(j.nombre) && j.status === 'completed' && estado(j) && (estado(j) === 'COLGADA' || (j.creado >= DESDE && j.creado < HASTA)));
const vistos = new Set(jobs.map((j) => j.job));
const tandaFuera = [...TANDA_COLGADA].filter((id) => !vistos.has(id));

// ── cabeceras ───────────────────────────────────────────────────────────────────────────────────────
const cache = path.join(carpeta, 'cabeceras');
fs.mkdirSync(cache, { recursive: true });
const cola = [...sel];
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let j = cola.shift(); j; j = cola.shift()) {
    const f = path.join(cache, `${j.job}.log`);
    if (!fs.existsSync(f) || fs.statSync(f).size < 1000) {
      try { fs.writeFileSync(f, await gh(['api', '--allow-escape-sequences', '-H', 'Range: bytes=0-65535', `repos/${REPO}/actions/jobs/${j.job}/logs`])); } catch (e) { fallosLlamada.push(`${j.job}: ${e.message}`); continue; }
    }
    Object.assign(j, leerCabecera(fs.readFileSync(f, 'utf8')), { bytes: fs.statSync(f).size });
  }
}));

// base de main que se probó: en un PR la del merge; en un push, el sha del commit
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const primerPadre = git('rev-list', '--first-parent', 'origin/main').split('\n');
const pos = new Map(primerPadre.map((s, i) => [s, primerPadre.length - i]));
for (const j of sel) {
  j.baseMain = j.evento === 'push' ? j.sha : j.base;
  j.posBase = j.baseMain ? pos.get(j.baseMain) ?? null : null;
}
const sinBase = sel.filter((j) => j.posBase == null);
const sinCab = sel.filter((j) => !j.runner);

p(`\nPOBLACIÓN · runs del listado ${runs.length} · runs limpios de la ventana con jobs pedidos ${limpios.length} · fallos de llamada ${fallosLlamada.length}`);
for (const f of fallosLlamada) p(`  FALLO ${f}`);
p(`ventana ${DESDE} → ${HASTA} · jobs juzgados ${sel.length} (trinquete ${sel.filter((j) => familia(j.nombre) === 'trinquete').length}, tanda ${sel.filter((j) => familia(j.nombre) === 'tanda').length}) · colgadas ${sel.filter((j) => estado(j) === 'COLGADA').length} (de 33 esperadas) · colgadas de la tanda que no están en el listado ${tandaFuera.length}`);
p(`cabeceras sin leer ${sinCab.length} · sin base de main identificable ${sinBase.length}`);
for (const j of sinBase.slice(0, 10)) p(`  sin base · ${j.job} · ${j.evento} · ${j.rama} · base leída ${j.base ?? '—'} · HEAD ${j.cabezaHead ?? '—'}`);

for (const fam of ['trinquete', 'tanda']) {
  const F = sel.filter((j) => familia(j.nombre) === fam && j.posBase != null);
  const colg = F.filter((j) => estado(j) === 'COLGADA').sort((a, b) => a.posBase - b.posBase);
  const ult = colg.at(-1);
  p(`\n══ ${fam.toUpperCase()} · ${F.length} jobs con base · ${colg.length} colgadas`);
  p('  colgadas (creado · base de main · cuándo entró esa base · imagen · runner · node):');
  for (const j of colg) p(`    ${j.creado} · ${j.evento} · base ${j.baseMain.slice(0, 9)} (#${j.posBase}, ${git('show', '-s', '--format=%cI', j.baseMain)}) · ${j.imagen} ${j.imagenVersion} · runner ${j.runner} · prov ${j.provisioner} · node ${j.node}`);
  p(`  CONTENIDO · base más nueva que colgó: ${ult.baseMain.slice(0, 9)} (#${ult.posBase}, entró ${git('show', '-s', '--format=%cI', ult.baseMain)}): todo commit de main hasta ahí queda DESCARTADO para esta familia`);
  const viejasTras = F.filter((j) => j.creado >= CORTE && j.posBase <= ult.posBase);
  p(`  ¿hay jobs DESPUÉS de ${CORTE} con base igual o anterior a esa? ${viejasTras.length} · colgadas entre ellos ${viejasTras.filter((j) => estado(j) === 'COLGADA').length}`);
  for (const j of viejasTras.slice(0, 8)) p(`    ${j.creado} · ${j.rama} · base #${j.posBase} · ${estado(j)}`);
  const nuevas = F.filter((j) => j.posBase > ult.posBase);
  p(`  jobs con base POSTERIOR a la última colgada: ${nuevas.length} · el primero creado ${nuevas.map((j) => j.creado).sort()[0] ?? '—'}`);
  // tasa antes / después del corte, sólo en la ventana
  const enV = F.filter((j) => j.creado >= DESDE);
  const antes = enV.filter((j) => j.creado < CORTE); const tras = enV.filter((j) => j.creado >= CORTE);
  p(`  ventana: antes del corte ${antes.filter((j) => estado(j) === 'COLGADA').length} colgadas de ${antes.length} · después ${tras.filter((j) => estado(j) === 'COLGADA').length} de ${tras.length}`);
  // ENTORNO
  for (const campo of ['imagenVersion', 'runner', 'provisioner', 'node', 'checkout', 'setupNode']) {
    const t = {};
    for (const j of F) { const k = j[campo] ?? '—'; t[k] ??= { colg: 0, limpia: 0, antes: 0, tras: 0, prim: j.creado, ult: j.creado }; const o = t[k]; estado(j) === 'COLGADA' ? o.colg++ : o.limpia++; j.creado < CORTE ? o.antes++ : o.tras++; if (j.creado < o.prim) o.prim = j.creado; if (j.creado > o.ult) o.ult = j.creado; }
    p(`  ENTORNO · ${campo}:`);
    for (const [k, o] of Object.entries(t).sort((a, b) => a[1].prim.localeCompare(b[1].prim))) p(`    ${k.padEnd(18)} colgadas ${String(o.colg).padStart(2)} · limpias ${String(o.limpia).padStart(3)} · antes del corte ${String(o.antes).padStart(3)} · después ${String(o.tras).padStart(3)} · de ${o.prim} a ${o.ult}`);
  }
}

fs.writeFileSync(path.join(carpeta, 'a-jobs-con-cabecera.tsv'), ['job\tfamilia\testado\tcreado\tevento\trama\tbase\tposBase\timagenVersion\trunner\tprovisioner\tnode\tcheckout\tsetupNode', ...sel.map((j) => [j.job, familia(j.nombre), estado(j), j.creado, j.evento, j.rama, j.baseMain ?? '', j.posBase ?? '', j.imagenVersion ?? '', j.runner ?? '', j.provisioner ?? '', j.node ?? '', j.checkout ?? '', j.setupNode ?? ''].join('\t'))].join('\n') + '\n');
const colgTot = sel.filter((j) => estado(j) === 'COLGADA').length;
const ok = fallosLlamada.length === 0 && sinCab.length === 0 && colgTot === 33 && tandaFuera.length === 0;
p(`\nEXIT=${ok ? 0 : 3}`);
process.exit(ok ? 0 : 3);
