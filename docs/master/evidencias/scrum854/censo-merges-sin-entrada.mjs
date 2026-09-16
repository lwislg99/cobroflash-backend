// SCRUM-854 · ¿cuantos merges a main entraron SIN entrada de registro?
//
// Derivado de `git log --merges`, que SOBREVIVE al autoborrado de ramas: `ls-remote` ya no tiene
// esas ramas y preguntarle daria cero por no mirar, no por estar limpio.
import { execFileSync } from 'node:child_process';

const N = Number(process.argv[2] || 60);
// 🔴 SIN SHELL, y no es estilo: en Windows `cmd.exe` trata `^` como carácter de escape, así que
// `<sha>^1` llegaba a git como `<sha>1` — «unknown revision». Con argumentos en array no hay
// shell que transforme nada. (Medido: el censo reventó con ese error antes de este cambio.)
const RAIZ = 'C:/Users/Javier Pereira/cobroflash-b2';
const git = (...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ── ① los merges de PR a main. NO los merges de main HACIA una rama ──────────────────────
// `Merge pull request #N from <owner>/<rama>` es la forma que deja GitHub al integrar.
const crudo = git('log', 'origin/main', '--merges', `-${N}`, '--format=%H%x09%s').trim().split('\n');
const DE_PR = /^Merge pull request #(\d+) from [^/]+\/(.+)$/;

const merges = [];
const internos = [];
for (const linea of crudo) {
  const [sha, asunto] = linea.split('\t');
  const m = asunto.match(DE_PR);
  if (m) merges.push({ sha, pr: Number(m[1]), rama: m[2].trim(), asunto });
  else internos.push({ sha, asunto });
}

console.log(`MERGES EXAMINADOS: ${crudo.length} (ultimos ${N})`);
console.log(`  · de PR (entradas a main): ${merges.length}`);
console.log(`  · otros (merge de main HACIA una rama, etc.): ${internos.length}`);

// ── SUELO ────────────────────────────────────────────────────────────────────────────────
if (merges.length === 0) {
  console.log('🔴 CENSO CIEGO: cero merges de PR. No es "no hay ninguno".');
  process.exit(3);
}

// ── ② por cada merge: numero de ticket, ficheros que aporta, y si trae entrada ────────────
const NUM_DE_RAMA = /^scrum-(\d+)/i;
const ENTRADA = /^docs\/master\/SCRUM-(\d+)\.md$/i;
const ES_CODIGO = /^(src|tests|scripts|public|prisma)\//;

const filas = [];
for (const mg of merges) {
  const ficheros = git('diff', '--name-only', `${mg.sha}^1`, mg.sha).trim().split('\n').filter(Boolean);
  const numRama = (mg.rama.match(NUM_DE_RAMA) || [])[1] || null;

  // VIA 2: los mensajes de los commits que el merge trae
  let numsCommits = new Set();
  try {
    const msgs = git('log', `${mg.sha}^1..${mg.sha}`, '--format=%s%x0A%b');
    for (const x of msgs.matchAll(/SCRUM-(\d+)/gi)) numsCommits.add(x[1]);
  } catch { /* nada */ }

  // VIA 3: entradas de registro tocadas
  const entradas = ficheros.map((f) => (f.match(ENTRADA) || [])[1]).filter(Boolean);

  const tocaCodigo = ficheros.some((f) => ES_CODIGO.test(f));
  filas.push({
    ...mg, ficheros: ficheros.length, numRama,
    numsCommits: [...numsCommits], entradas, tocaCodigo,
    traeSuEntrada: numRama ? entradas.includes(numRama) : entradas.length > 0,
  });
}

// ── ③ POR QUE VIAS SE SABE A QUE TICKET PERTENECE UN MERGE ───────────────────────────────
const conRama = filas.filter((f) => f.numRama).length;
const conCommit = filas.filter((f) => f.numsCommits.length).length;
const conEntrada = filas.filter((f) => f.entradas.length).length;
const porNinguna = filas.filter((f) => !f.numRama && !f.numsCommits.length && !f.entradas.length);
console.log('');
console.log('VIAS PARA SABER A QUE TICKET PERTENECE UN MERGE (de ' + filas.length + '):');
console.log(`  ① nombre de la rama (scrum-<n>-…) ... ${conRama}`);
console.log(`  ② mensajes de sus commits ........... ${conCommit}`);
console.log(`  ③ entrada docs/master tocada ........ ${conEntrada}`);
console.log(`  🔴 por NINGUNA de las tres .......... ${porNinguna.length}`);
for (const f of porNinguna) console.log(`       ${f.sha.slice(0, 8)} PR#${f.pr} ${f.rama}`);

// ── ④ EL NUMERO: merges que tocan codigo y NO traen su entrada ───────────────────────────
const sinEntrada = filas.filter((f) => f.tocaCodigo && !f.traeSuEntrada);
console.log('');
console.log('═══ MERGES QUE TOCAN CODIGO Y NO DEJAN ENTRADA: ' + sinEntrada.length + ' de ' + filas.length + ' ═══');
for (const f of sinEntrada) {
  const pista = f.numRama ? `SCRUM-${f.numRama}` : (f.numsCommits.length ? `commits: ${f.numsCommits.join(',')}` : '🔴 sin pista');
  console.log(`  ${f.sha.slice(0, 8)}  PR#${f.pr}  ${f.rama}`);
  console.log(`      ${f.ficheros} ficheros · esperaba docs/master/SCRUM-${f.numRama || '?'}.md · ${pista}`);
}

// ── SUELO 2: si NINGUNO sale, el instrumento no distingue ────────────────────────────────
if (sinEntrada.length === 0) {
  console.log('🔴 CENSO CIEGO: cero merges sin entrada, cuando el ticket nombra TRES con su sha.');
  process.exit(3);
}

// ── CONTROL POSITIVO: los tres casos que el ticket nombra, ¿salen? ───────────────────────
console.log('');
console.log('CONTROL POSITIVO — los tres shas del ticket, buscados en el censo:');
for (const sha of ['404c0f59', 'd2990977', 'e91a3741']) {
  const donde = filas.find((f) => {
    try { return git('log', `${f.sha}^1..${f.sha}`, '--format=%H').includes(git('rev-parse', sha).trim()); }
    catch { return false; }
  });
  const marcado = donde && sinEntrada.some((x) => x.sha === donde.sha);
  console.log(`  ${sha} -> ${donde ? `PR#${donde.pr} (${donde.rama})` : 'NO LO ENCUENTRO'}`
    + (donde ? (marcado ? '  ✅ marcado sin entrada' : '  ⚠️ el censo dice que SI trae entrada') : ''));
}
