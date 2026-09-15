// docs/master/evidencias/scrum857/censo-con-criterio-nuevo.mjs — SCRUM-857
//
// El censo de SCRUM-854, repetido con el criterio de la UNION (rama + asunto de los commits) y
// sobre MAS POBLACION: aquel miro 60 merges y por eso solo alcanzo UNA de las CINCO fases del 834.
//
// Aqui se leen 400 merges de `origin/main`. El numero no es redondo por gusto: 400 merges son 198
// de PR y cubren desde el PR #1069 hasta hoy, o sea las CINCO fases del 834 (#1211-#1233), los dos
// merges del 846 (#1238, #1248) y los dos verdes falsos (#1143, #1149) con margen por delante.
//
// SIN SHELL: `execFileSync` con argumentos en array. En Windows `cmd.exe` trata `^` como escape y
// `<sha>^1` le llega a git como `<sha>1`. Medido en SCRUM-854.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const N = Number(process.argv[2] || 400);

const DE_PR = /^Merge pull request #(\d+) from [^/]+\/(.+)$/;
const NUM_RAMA = /^scrum-(\d+)/i;
const ENTRADA = /^docs\/master\/SCRUM-(\d+)\.md$/i;
const DEL_ASUNTO = /^SCRUM-([0-9]+)/i;
const ES_CODIGO = /^(src|tests|scripts|public|prisma)\//;
const NL = String.fromCharCode(10);
const SEP = String.fromCharCode(1);
const FIN = String.fromCharCode(2);

const crudo = git('log', 'origin/main', '--merges', `-${N}`, `--format=%H${SEP}%s${SEP}${FIN}`)
  .split(FIN).map((x) => x.trim()).filter(Boolean);

const merges = [];
for (const bloque of crudo) {
  const [sha, asunto] = bloque.split(SEP);
  const m = (asunto || '').match(DE_PR);
  if (m) merges.push({ sha, pr: Number(m[1]), rama: m[2].trim() });
}

console.log(`POBLACION: ${crudo.length} merges leidos · ${merges.length} son de PR`);
if (merges.length === 0) {
  console.log('🔴 CENSO CIEGO: cero merges de PR. No es "no hay ninguno": es que no he mirado.');
  process.exit(3);
}

for (const mg of merges) {
  let ficheros = [];
  let asuntos = [];
  try { ficheros = git('diff', '--name-only', `${mg.sha}^1`, mg.sha).split(NL).map((x) => x.trim()).filter(Boolean); } catch { /* */ }
  try { asuntos = git('log', `${mg.sha}^1..${mg.sha}`, '--no-merges', '--format=%s').split(NL).map((x) => x.trim()).filter(Boolean); } catch { /* */ }

  const deRama = (mg.rama.match(NUM_RAMA) || [])[1] || null;
  const deAsuntos = [...new Set(asuntos.map((s) => (s.match(DEL_ASUNTO) || [])[1]).filter(Boolean))];
  const entradas = ficheros.map((f) => (f.match(ENTRADA) || [])[1]).filter(Boolean);

  mg.tocaCodigo = ficheros.some((f) => ES_CODIGO.test(f));
  mg.viejo = deRama ? [deRama] : [];
  mg.nuevo = [...new Set([deRama, ...deAsuntos].filter(Boolean))];
  mg.faltanViejo = mg.viejo.filter((n) => !entradas.includes(n));
  mg.faltanNuevo = mg.nuevo.filter((n) => !entradas.includes(n));
  mg.sinVia = mg.nuevo.length === 0;
}

const conCodigo = merges.filter((m) => m.tocaCodigo);
const malViejo = conCodigo.filter((m) => m.faltanViejo.length);
const malNuevo = conCodigo.filter((m) => m.faltanNuevo.length);
const nuevosCasos = conCodigo.filter((m) => m.faltanNuevo.some((n) => !m.faltanViejo.includes(n)));

console.log(`  de ellos, TOCAN CODIGO: ${conCodigo.length}`);
console.log('');
console.log('MERGES QUE TOCAN CODIGO Y NO TRAEN ALGUNA ENTRADA QUE LES TOCA:');
console.log(`  con el criterio de SCRUM-854 (solo la rama) ....... ${malViejo.length}`);
console.log(`  con el criterio de SCRUM-857 (rama + asuntos) ..... ${malNuevo.length}`);
console.log(`  🔴 merges donde el criterio NUEVO reclama algo que el viejo no veia: ${nuevosCasos.length}`);
console.log('');

const tickets = new Map(); // ticket -> merges donde se le reclama y el viejo no lo veia
for (const m of nuevosCasos) {
  for (const n of m.faltanNuevo.filter((x) => !m.faltanViejo.includes(x))) {
    if (!tickets.has(n)) tickets.set(n, []);
    tickets.get(n).push(m);
  }
}
console.log('TICKETS CON TRABAJO EN MAIN QUE EL CRITERIO VIEJO NO RECLAMABA:');
for (const [n, ms] of [...tickets].sort((a, b) => b[1].length - a[1].length)) {
  // `stdio` silencia el `fatal:` que git escribe cuando el fichero no existe: aqui la ausencia es
  // la respuesta, no un error, y su ruido ensuciaba la salida del banco.
  const hay = (() => {
    try {
      execFileSync('git', ['cat-file', '-e', `origin/main:docs/master/SCRUM-${n}.md`],
        { cwd: RAIZ, stdio: ['ignore', 'ignore', 'ignore'] });
      return true;
    } catch { return false; }
  })();
  console.log(`  SCRUM-${n}  en ${ms.length} merge(s)  ·  entrada HOY: ${hay ? 'existe' : '🔴 NO EXISTE'}`);
  for (const m of ms) console.log(`      ${m.sha.slice(0, 8)} PR#${m.pr} ${m.rama}`);
}

const ciegos = merges.filter((m) => m.sinVia && m.tocaCodigo);
console.log('');
console.log(`🔴 LO QUE NINGUNA VIA SALVA (el caso de SCRUM-828): ${ciegos.length} merges tocan codigo`);
console.log('   y no dicen a que ticket pertenecen ni por la rama ni por el asunto de un commit.');
for (const m of ciegos) console.log(`      ${m.sha.slice(0, 8)} PR#${m.pr} ${m.rama}`);
console.log('');
console.log('   Ninguna via los alcanza, y se DECLARA en vez de dejarlo implicito: el guard los');
console.log('   marca NO_SE_PUDO_DETERMINAR, que no es CUMPLE.');
