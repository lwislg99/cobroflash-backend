// SCRUM-857 · PRIMERO se mide la cobertura de cada via, DESPUES se elige el criterio.
//
// ⚠️ ANTES DE NINGUNA CIFRA: de donde se leen los mensajes y si el merge los conserva.
// Con squash el commit de la rama no llega a main tal cual, y una cifra de «mensajes de commit»
// sacada de ahi seria plausible y falsa.
import { execFileSync } from 'node:child_process';

const RAIZ = 'C:/Users/Javier Pereira/cobroflash-b2';
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const N = Number(process.argv[2] || 400);

const DE_PR = /^Merge pull request #(\d+) from [^/]+\/(.+)$/;
const NUM_RAMA = /^scrum-(\d+)/i;
const ENTRADA = /^docs\/master\/SCRUM-(\d+)\.md$/i;
const NUM_TEXTO = /SCRUM-(\d+)/gi;

// ── La poblacion: merges de PR. Un solo `git log` con separador, no N llamadas ────────────
const SEP = '\u0001';
const crudo = git('log', 'origin/main', '--merges', `-${N}`, `--format=%H${SEP}%P${SEP}%s${SEP}%b${SEP}\u0002`)
  .split('\u0002').map((x) => x.trim()).filter(Boolean);

const merges = [];
let squash = 0;
for (const bloque of crudo) {
  const [sha, padres, asunto, cuerpo] = bloque.split(SEP);
  const m = (asunto || '').match(DE_PR);
  if (!m) continue;
  const nPadres = (padres || '').trim().split(/\s+/).filter(Boolean).length;
  if (nPadres < 2) squash++;
  merges.push({ sha, nPadres, pr: Number(m[1]), rama: m[2].trim(), cuerpo: cuerpo || '' });
}

console.log(`POBLACION: ${crudo.length} merges leidos · ${merges.length} son de PR`);
console.log(`  con DOS padres (merge real, conserva los commits de la rama): ${merges.length - squash}`);
console.log(`  con UN padre (squash/rebase: la via «mensajes de commit» NO existiria): ${squash}`);
if (merges.length === 0) { console.log('🔴 CENSO CIEGO: cero merges de PR.'); process.exit(3); }

// ── CONTROL de la via B: ¿el merge conserva de verdad los commits de la rama? ─────────────
const conCommits = [];
for (const mg of merges) {
  let n = 0;
  try { n = git('log', `${mg.sha}^1..${mg.sha}`, '--no-merges', '--format=%H').trim().split('\n').filter(Boolean).length; } catch { n = 0; }
  mg.nCommits = n;
  if (n > 0) conCommits.push(mg);
}
console.log(`  el merge DEVUELVE commits de rama en ${conCommits.length}/${merges.length}`
  + ` -> la via B se lee de \`<merge>^1..<merge>\`, y ahi SI estan.`);
console.log('');

// ── Las cuatro vias, por merge ───────────────────────────────────────────────────────────
const numsDe = (txt) => new Set([...String(txt).matchAll(NUM_TEXTO)].map((x) => x[1]));

for (const mg of merges) {
  // A · nombre de la rama
  const a = (mg.rama.match(NUM_RAMA) || [])[1];
  mg.A = a ? new Set([a]) : new Set();
  // B · mensajes de commit del PR
  mg.B = new Set();
  try {
    for (const x of numsDe(git('log', `${mg.sha}^1..${mg.sha}`, '--format=%s%x0A%b'))) mg.B.add(x);
  } catch { /* nada */ }
  // B' · el numero al PRINCIPIO del ASUNTO de un commit = «este commit ES trabajo de ese ticket».
  // Medido: en el PR#1248 los numeros 778 y 833 solo salen en el CUERPO (citas de pasada) y el
  // unico asunto es «SCRUM-846: …». Esa es la linea entre SER de un ticket y MENCIONARLO.
  mg.B2 = new Set();
  try {
    const asuntos = git('log', `${mg.sha}^1..${mg.sha}`, '--no-merges', '--format=%s').split(String.fromCharCode(10));
    for (const linea of asuntos) {
      const m2 = linea.trim().match(/^SCRUM-([0-9]+)/i);
      if (m2) mg.B2.add(m2[1]);
    }
  } catch { /* nada */ }
  // C · titulo del PR = cuerpo del merge commit
  mg.C = numsDe(mg.cuerpo);
  // D · ficheros tocados (entradas de registro)
  mg.D = new Set();
  try {
    for (const f of git('diff', '--name-only', `${mg.sha}^1`, mg.sha).trim().split('\n')) {
      const e = (f.match(ENTRADA) || [])[1];
      if (e) mg.D.add(e);
    }
  } catch { /* nada */ }
}

const cuantos = (k) => merges.filter((m) => m[k].size > 0).length;
const pct = (n) => ((n / merges.length) * 100).toFixed(1) + ' %';
console.log('COBERTURA DE CADA VIA — «en cuantos merges produce AL MENOS un numero de ticket»');
console.log(`  A · nombre de la rama .......... ${cuantos('A')}/${merges.length}  (${pct(cuantos('A'))})   <- lo que usa el guard HOY`);
console.log(`  B · SCRUM-n en CUALQUIER parte del mensaje ... ${cuantos('B')}/${merges.length}  (${pct(cuantos('B'))})`);
console.log(`  B'· SCRUM-n al INICIO del ASUNTO ............. ${cuantos('B2')}/${merges.length}  (${pct(cuantos('B2'))})`);
console.log(`  C · titulo del PR (cuerpo) ..... ${cuantos('C')}/${merges.length}  (${pct(cuantos('C'))})`);
console.log(`  D · ficheros tocados ........... ${cuantos('D')}/${merges.length}  (${pct(cuantos('D'))})`);

// ── 🔴 EL NUMERO QUE DECIDE: ¿en cuantos ve B (o C) un ticket que A NO ve? ────────────────
const extraB = merges.filter((m) => [...m.B].some((n) => !m.A.has(n)));
const extraC = merges.filter((m) => [...m.C].some((n) => !m.A.has(n)));
const extraBC = merges.filter((m) => [...new Set([...m.B, ...m.C])].some((n) => !m.A.has(n)));
const extraB2 = merges.filter((m) => [...m.B2].some((n) => !m.A.has(n)));
console.log('');
console.log('🔴 EL NUMERO QUE DECIDE — merges donde otra via ve un ticket que la RAMA no ve:');
console.log(`  B aporta un ticket que A no tiene: ${extraB.length}`);
console.log(`  C aporta un ticket que A no tiene: ${extraC.length}`);
console.log(`  B o C (la UNION ingenua) .........: ${extraBC.length}  de ${merges.length}  (${pct(extraBC.length)})  <- INSERVIBLE: pide entrada en 4 de cada 5 PR`);
console.log(`  B' (inicio del asunto) ...........: ${extraB2.length}  de ${merges.length}  (${pct(extraB2.length)})  <- el criterio candidato`);
console.log('');
console.log('LOS MERGES QUE LA VIA DEL ASUNTO DELATA (rama dice un ticket, un commit ES de otro):');
for (const m of extraB2) console.log(`     ${m.sha.slice(0,8)} PR#${m.pr} ${m.rama}  ->  commits de: ${[...m.B2].filter(n=>!m.A.has(n)).join(',')}`);

// ── Los que NINGUNA via identifica ───────────────────────────────────────────────────────
const ciegos = merges.filter((m) => !m.A.size && !m.B.size && !m.C.size && !m.D.size);
console.log('');
console.log(`🔴 MERGES QUE NINGUNA VIA IDENTIFICA: ${ciegos.length}`);
for (const m of ciegos.slice(0, 10)) console.log(`     ${m.sha.slice(0, 8)} PR#${m.pr} ${m.rama}`);
if (ciegos.length > 10) console.log(`     … y ${ciegos.length - 10} mas`);

// ── CONTROL POSITIVO: el caso del ticket ─────────────────────────────────────────────────
console.log('');
console.log('CONTROL POSITIVO — los merges donde viajo SCRUM-846 dentro de scrum-637-*:');
for (const m of merges.filter((x) => /scrum-637/i.test(x.rama))) {
  const extra = [...m.B2].filter((n) => !m.A.has(n));
  console.log(`  ${m.sha.slice(0, 8)} PR#${m.pr} ${m.rama}`);
  console.log(`      A(rama)=${[...m.A].join(',') || '-'}  ASUNTOS=${[...m.B2].join(',') || '-'}  TODO-EL-MENSAJE=${[...m.B].join(',') || '-'}  D(entradas)=${[...m.D].join(',') || '-'}`);
  console.log(`      tickets que la RAMA no ve: ${extra.join(',') || '(ninguno)'}`);
}
