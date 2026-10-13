// analiza.mjs <runs.json> [--mecanismo]
// Lee lo que dejo recoge.mjs. No llama a la red.
import fs from 'node:fs';
const { evento, desde, hasta, runs } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const t = (s) => Date.parse(s);
runs.sort((a, b) => t(a.creado) - t(b.creado));

const clase = (r) => {
  if (r.estado !== 'completed') return 'sin-acabar';
  if (r.fin === 'cancelled') return r.jobs === 0 ? 'cancelado-0-jobs' : 'cancelado-con-jobs';
  if (r.jobs === 0) return `${r.fin}-0-jobs`;
  return r.fin;
};
const clases = [...new Set(runs.map(clase))].sort();
console.log(`POBLACION ${runs.length} runs de ci.yml · evento ${evento} · creados ${desde}..${hasta} (dia UTC)`);
console.log(['dia', 'runs', ...clases, '%con-jobs'].join('\t'));
const dias = [...new Set(runs.map((r) => r.creado.slice(0, 10)))];
const fila = (nombre, lista) => {
  const c = Object.fromEntries(clases.map((k) => [k, 0]));
  for (const r of lista) c[clase(r)]++;
  const conJobs = lista.filter((r) => r.jobs > 0).length;
  console.log([nombre, lista.length, ...clases.map((k) => c[k]), lista.length ? (100 * conJobs / lista.length).toFixed(0) : '-'].join('\t'));
};
for (const d of dias) fila(d, runs.filter((r) => r.creado.startsWith(d)));
fila('TOTAL', runs);
const actores = {};
for (const r of runs) actores[`${r.actor}/${r.disparador}`] = (actores[`${r.actor}/${r.disparador}`] || 0) + 1;
console.log('actor/disparador:', JSON.stringify(actores));
console.log('intentos>1:', runs.filter((r) => r.intento > 1).length);

if (process.argv.includes('--mecanismo')) {
  // Prediccion de «GitHub sustituye al PENDIENTE del grupo»: un run X cancelado sin jobs
  //   (a) nacio mientras otro run Z del grupo CORRIA (Z.creado < X.creado < Z.tocado, Z con jobs), y
  //   (b) murio en el instante en que nacio el SIGUIENTE run Y del grupo (Y.creado ~ X.tocado),
  //       y ese Y es el inmediatamente posterior a X.
  const desdeCorte = process.argv[process.argv.indexOf('--mecanismo') + 1];
  const pob = runs.filter((r) => !desdeCorte || r.creado >= desdeCorte);
  const idx = new Map(runs.map((r, i) => [r.id, i]));
  const mide = (X) => {
    const i = idx.get(X.id);
    const Y = runs[i + 1];
    const dY = Y ? (t(Y.creado) - t(X.tocado)) / 1000 : null;
    const Z = runs.slice(0, i).reverse().find((z) => z.jobs > 0 && t(z.tocado) > t(X.creado));
    return { dY, corriendo: Boolean(Z), vida: (t(X.tocado) - t(X.creado)) / 1000 };
  };
  for (const [nombre, sel] of [['cancelado-0-jobs', (r) => clase(r) === 'cancelado-0-jobs'], ['CON jobs (control)', (r) => r.jobs > 0 && r.estado === 'completed']]) {
    const lista = pob.filter(sel);
    let a = 0, b = 0, ambas = 0, sinY = 0;
    const raros = [];
    for (const X of lista) {
      const m = mide(X);
      if (m.dY === null) { sinY++; continue; }
      const okB = Math.abs(m.dY) <= 15;
      if (m.corriendo) a++;
      if (okB) b++;
      if (m.corriendo && okB) ambas++; else raros.push(`${X.id} sha=${X.sha.slice(0, 8)} creado=${X.creado} tocado=${X.tocado} dY=${m.dY}s corriendo=${m.corriendo}`);
    }
    console.log(`\nMECANISMO sobre «${nombre}» · poblacion ${lista.length} (sin run posterior: ${sinY})`);
    console.log(`  (a) habia un run con jobs corriendo al nacer: ${a}`);
    console.log(`  (b) murio a <=15 s del nacimiento del run siguiente: ${b}`);
    console.log(`  (a) y (b): ${ambas}`);
    if (nombre.startsWith('cancelado')) for (const l of raros.slice(0, 15)) console.log('  NO ENCAJA ' + l);
    const vidas = lista.map((X) => mide(X).vida).sort((x, y) => x - y);
    if (vidas.length) console.log(`  vida (creado->tocado) s: min ${vidas[0]} · p50 ${vidas[Math.floor(vidas.length / 2)]} · max ${vidas[vidas.length - 1]}`);
  }
}
