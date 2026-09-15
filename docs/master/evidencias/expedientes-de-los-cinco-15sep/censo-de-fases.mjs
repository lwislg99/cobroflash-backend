// docs/master/evidencias/scrum858/censo-de-fases.mjs
//
// ¿CUANTAS FASES TIENE CADA UNO DE LOS CINCO TICKETS SIN EXPEDIENTE?
//
// 🔴 Esto se hace ANTES de escribir el primer expediente, y por un motivo medido: el 15-sep-2026
// se dio por hecho que SCRUM-834 era UN merge y eran CINCO. No se da por hecho.
//
// DOS vias, porque una sola se queda corta (SCRUM-857):
//   (1) merges cuya RAMA lleva el numero  ·  (2) merges con un commit cuyo ASUNTO empieza por el
//
// La poblacion es TODA la historia de `main`, no una ventana: estos tickets son de agosto y
// septiembre, y una ventana de 60 o 400 merges los cortaria por la mitad.
//
// SIN SHELL (`execFileSync` con array): en Windows `cmd.exe` trata `^` como escape y `<sha>^1`
// llega a git como `<sha>1`. Medido en SCRUM-854.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
const NL = String.fromCharCode(10);
const SEP = String.fromCharCode(1);
const FIN = String.fromCharCode(2);
const TICKETS = (process.argv[2] || '842,838,833,722,601').split(',');

// ── ① TODOS los commits de main, de una vez. Invertir la busqueda es lo que la hace viable:
//    preguntar merge a merge por sus commits son ~9.000 llamadas a git; esto es UNA.
const commits = git('log', 'origin/main', '--no-merges', `--format=%H${SEP}%s${SEP}${FIN}`)
  .split(FIN).map((x) => x.trim()).filter(Boolean)
  .map((b) => { const [sha, asunto] = b.split(SEP); return { sha, asunto: asunto || '' }; });

// ── ② TODOS los merges de PR, tambien de una vez.
const merges = [];
for (const b of git('log', 'origin/main', '--merges', `--format=%H${SEP}%s${SEP}${FIN}`)
  .split(FIN).map((x) => x.trim()).filter(Boolean)) {
  const [sha, asunto] = b.split(SEP);
  const m = (asunto || '').match(/^Merge pull request #(\d+) from [^/]+\/(.+)$/);
  if (m) merges.push({ sha, pr: +m[1], rama: m[2].trim() });
}

console.log(`POBLACION: toda la historia de main — ${commits.length} commits, ${merges.length} merges de PR`);
if (!commits.length || !merges.length) {
  console.log('🔴 CENSO CIEGO: sin commits o sin merges no hay nada que contar. No es un cero.');
  process.exit(3);
}
// CONTROL POSITIVO del lector: un ticket que SI sabemos que tiene fases (834 tiene cinco).
const control = merges.filter((m) => /^scrum-834(\D|$)/i.test(m.rama)).length;
console.log(`CONTROL POSITIVO — fases de SCRUM-834 por rama (deben ser 5): ${control}`
  + (control === 5 ? ' ✅' : ' 🔴 el lector no ve lo que ya se midio'));
console.log('');

/**
 * El merge DE PR que trajo un commit a `main`.
 *
 * 🔴 Y el filtro por «de PR» no es cosmético: la primera versión devolvía el último merge del
 * camino sin filtrar, y ése suele ser un `Merge remote-tracking branch 'origin/main' into <rama>`
 * —un merge INTERMEDIO, dentro de la propia rama, que no mete nada en `main`—. Con él, el censo
 * anclaba las fases a un sha que no es por donde el trabajo entró. Se vio porque cuatro fases
 * salieron como «(no es merge de PR)»: el censo lo DIJO en vez de dar un sha plausible y falso.
 */
const shasDePR = new Set(merges.map((m) => m.sha));
const mergeDe = (sha) => {
  try {
    const salida = git('log', 'origin/main', '--merges', '--ancestry-path', '--format=%H', `${sha}..origin/main`);
    const todos = salida.split(NL).map((x) => x.trim()).filter(Boolean).filter((x) => shasDePR.has(x));
    return todos[todos.length - 1] || null;
  } catch { return null; }
};

for (const t of TICKETS) {
  const reAsunto = new RegExp(`^SCRUM-${t}(\\D|$)`, 'i');
  const reRama = new RegExp(`^scrum-${t}(\\D|$)`, 'i');

  const suyos = commits.filter((c) => reAsunto.test(c.asunto));
  const porRama = merges.filter((m) => reRama.test(m.rama));

  const fases = new Map();
  for (const m of porRama) fases.set(m.sha, { ...m, via: 'rama', asuntos: [] });
  for (const c of suyos) {
    const sha = mergeDe(c.sha);
    if (!sha) continue;
    const m = merges.find((x) => x.sha === sha) || { sha, pr: null, rama: '(no es merge de PR)' };
    if (!fases.has(sha)) fases.set(sha, { ...m, via: 'asunto', asuntos: [] });
    fases.get(sha).asuntos.push(c.asunto);
  }

  console.log(`━━━━━━ SCRUM-${t} ━━━━━━  FASES: ${fases.size}   (commits suyos: ${suyos.length} · ramas propias: ${porRama.length})`);
  const orden = [...fases.values()].sort((a, b) => (a.pr || 0) - (b.pr || 0));
  for (const f of orden) {
    const fecha = git('log', '-1', '--format=%cI', f.sha).trim().slice(0, 10);
    let n = 0;
    try { n = git('diff', '--name-only', `${f.sha}^1`, f.sha).split(NL).filter(Boolean).length; } catch { /* */ }
    console.log(`   ${f.sha.slice(0, 8)} PR#${f.pr ?? '?'} ${fecha} ${f.rama}  (${n} fich., via ${f.via})`);
    for (const a of f.asuntos) console.log(`       ${a.slice(0, 100)}`);
  }
  if (!fases.size) console.log('   🔴 ninguna fase encontrada: o no hay trabajo suyo en main, o el censo esta ciego');
  console.log('');
}
