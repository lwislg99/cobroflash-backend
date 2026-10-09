// ¿El test que trajo un PR sale ROJO con el código de antes de ese PR?
// Generaliza `rojo-con-codigo-viejo.mjs` (SCRUM-876f): el caso no se escribe a mano, sale del merge.
// Para cada merge de `main`: base verde -> se quita lo que el PR cambió en src/ y public/ (su diff
// contra el primer padre, aplicado al revés) -> build si tocó src/ -> se corren los tests que ESE PR
// añadió o cambió -> se restaura con git.
// Uso, desde la raíz de un árbol LIMPIO y ya compilado:
//   node <ruta>/rojo-por-merge.mjs [--con-banco] <sha del merge> [<sha>...]
// Tres respuestas por caso, y la tercera no se confunde con las otras:
//   ROJO   caen N de M casos al quitar el arreglo (se nombran)
//   VERDE  el arreglo quitado y sus tests siguen pasando: no lo protegen
//   CIEGO  no se pudo quitar limpio, no compila, o la base no vale
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = process.cwd();
const entorno = { ...process.env };
for (const v of ['FORCE_COLOR', 'NODE_OPTIONS', 'QA_DB_TEST', 'A55_DB_TEST', 'BOT_SUITE_TEST']) delete entorno[v];
if (!process.argv.includes('--con-banco')) delete entorno.LIBRO_PG_URL;

const git = (...a) => spawnSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const sucio = () => git('status', '--porcelain').stdout.trim();

function correr(tests) {
  const tap = path.join(os.tmpdir(), `rojo-merge-${process.pid}-${Date.now()}.tap`);
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...tests], { cwd: RAIZ, env: entorno, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const lineas = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8').split(/\r?\n/) : [];
  if (fs.existsSync(tap)) fs.unlinkSync(tap);
  // Hojas: un `ok`/`not ok` a cualquier sangría que no sea un fichero ni un grupo con hijos caídos repetidos.
  const todos = lineas.filter((l) => /^\s*(not ok|ok) \d+ - /.test(l));
  const raiz = todos.filter((l) => /^(not ok|ok) /.test(l));
  const saltados = todos.filter((l) => /# SKIP/.test(l));
  const caidos = todos.filter((l) => /^\s*not ok/.test(l)).map((l) => l.trim().replace(/^not ok \d+ - /, ''));
  return { salida: r.status, casos: todos.length, raiz: raiz.length, saltados: saltados.length, caidos };
}

// `tsc` NO borra de dist/ lo que ya no está en src/: un fichero que el PR CREÓ, quitado del fuente, sigue
// compilado y el test lo encuentra (así salió VERDE #2319 en la primera pasada, con 115 líneas quitadas).
// Antes de compilar se borra de dist/ el gemelo de todo .ts que el árbol ya no tiene; el build final,
// con el árbol restaurado, lo vuelve a escribir.
function build() {
  const idos = git('ls-files', '--deleted', '--', 'src').stdout.split(/\r?\n/).filter((n) => /\.ts$/.test(n));
  for (const n of idos) {
    const gemelo = path.join(RAIZ, 'dist', n.replace(/^src\//, '').replace(/\.ts$/, '.js'));
    if (fs.existsSync(gemelo)) { fs.unlinkSync(gemelo); console.log(`   (dist: borrado el gemelo de ${n})`); }
  }
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc')], { cwd: RAIZ, env: entorno, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { salida: r.status, errores: (r.stdout || '').split(/\r?\n/).filter((l) => /error TS/.test(l)) };
}

const shas = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!shas.length) { console.error('uso: rojo-por-merge.mjs [--con-banco] <sha del merge> [...]'); process.exit(2); }
if (sucio()) { console.error('🔴 el árbol no está limpio: no se muta nada'); process.exit(2); }
console.log(`POBLACION · ${shas.length} merge(s) · HEAD ${git('rev-parse', 'HEAD').stdout.trim()} · banco ${entorno.LIBRO_PG_URL ? 'SÍ' : 'no'}`);

const cuenta = { ROJO: 0, VERDE: 0, CIEGO: 0 };
let buildSucio = false;
// Quita, al revés, lo que un merge cambió en `rutas`. Devuelve '' si salió, o el motivo.
function quitar(sha, rutas) {
  const fp = path.join(os.tmpdir(), `rojo-merge-${process.pid}-${sha.slice(0, 8)}.patch`);
  fs.writeFileSync(fp, git('diff', '--binary', `${sha}^1`, sha, '--', ...rutas).stdout);
  const prueba = git('apply', '-R', '--check', fp);
  if (prueba.status === 0) git('apply', '-R', fp);
  fs.unlinkSync(fp);
  return prueba.status === 0 ? '' : (prueba.stderr || '').split(/\r?\n/).filter(Boolean).slice(0, 2).join(' · ');
}

for (const arg of shas) {
  // `objetivo:encima1,encima2` — cuando otro PR cambió el mismo fichero después: primero se quitan los
  // de ENCIMA (del más nuevo al más viejo), se exige que los tests del objetivo sigan VERDES ahí (base
  // intermedia), y sólo entonces se quita el objetivo.
  const [sha, pila] = arg.split(':');
  if (pila) {
    const encima = pila.split(',');
    const pr = (git('log', '-1', '--format=%s', sha).stdout.match(/#(\d+)/) || [])[1] || sha.slice(0, 8);
    const nombres = git('diff', '--name-only', `${sha}^1`, sha).stdout.split(/\r?\n/).filter(Boolean);
    const rutas = nombres.filter((n) => /^(src|public)\//.test(n));
    const tests = nombres.filter((n) => /^tests\/.*\.test\.mjs$/.test(n) && fs.existsSync(path.join(RAIZ, n)));
    const tocadas = new Set(rutas);
    let veredicto;
    try {
      for (const e of encima) {
        const r = git('diff', '--name-only', `${e}^1`, e).stdout.split(/\r?\n/).filter((n) => rutas.includes(n));
        r.forEach((n) => tocadas.add(n));
        const mal = quitar(e, r);
        if (mal) { veredicto = `CIEGO: no sale el de encima ${e.slice(0, 8)}: ${mal}`; break; }
      }
      if (!veredicto) {
        buildSucio = true;
        const b1 = build();
        const media = b1.salida === 0 ? correr(tests) : null;
        const numMedia = git('diff', '--numstat').stdout.trim().split(/\r?\n/).filter(Boolean).map((l) => l.replace(/\t/g, ' ')).join(', ');
        if (!media) veredicto = `CIEGO: quitados los de encima no compila (${b1.errores.slice(0, 2).join(' · ')})`;
        else {
          const mal = quitar(sha, rutas);
          if (mal) veredicto = `CIEGO: quitados los de encima, el objetivo sigue sin salir: ${mal}`;
          else {
            const b2 = build();
            if (b2.salida !== 0) veredicto = `CIEGO: con el objetivo quitado no compila (${b2.errores.slice(0, 2).join(' · ')})`;
            else {
              const m = correr(tests);
              const soloDelObjetivo = m.caidos.filter((c) => !media.caidos.includes(c));
              veredicto = `${soloDelObjetivo.length ? 'ROJO' : 'VERDE'}: base intermedia (sin los de encima; numstat ${numMedia}) caen ${media.caidos.length} de ${media.casos}; con el objetivo quitado caen ${m.caidos.length} de ${m.casos}; SÓLO por el objetivo ${soloDelObjetivo.length} → ${soloDelObjetivo.slice(0, 6).map((c) => c.slice(0, 110)).join(' ‖ ')}${media.caidos.length ? ` · [ya caían sin los de encima: ${media.caidos.slice(0, 4).map((c) => c.slice(0, 70)).join(' ‖ ')}]` : ''}`;
            }
          }
        }
      }
    } finally {
      git('restore', '--source=HEAD', '--staged', '--worktree', '--', ...tocadas);
    }
    const limpio = !sucio();
    const clase = veredicto.split(':')[0];
    cuenta[clase] = (cuenta[clase] || 0) + 1;
    console.log(`${clase === 'ROJO' ? '✔' : clase === 'VERDE' ? '✖' : '?'} #${pr} (en pila sobre ${encima.map((e) => e.slice(0, 8)).join(',')}) · código ${rutas.length} · tests ${tests.length} · ${veredicto} · restaurado ${limpio ? 'sí' : '🔴 NO'}`);
    if (!limpio) { console.error('🔴 el árbol no quedó limpio: paro'); process.exit(2); }
    continue;
  }
  const asunto = git('log', '-1', '--format=%s', sha).stdout.trim();
  const pr = (asunto.match(/#(\d+)/) || [])[1] || sha.slice(0, 8);
  const nombres = git('diff', '--name-only', `${sha}^1`, sha).stdout.split(/\r?\n/).filter(Boolean);
  const rutas = nombres.filter((n) => /^(src|public)\//.test(n));
  const tests = nombres.filter((n) => /^tests\/.*\.test\.mjs$/.test(n) && fs.existsSync(path.join(RAIZ, n)));
  const cab = `#${pr} · código ${rutas.length} · tests ${tests.length}`;
  if (!rutas.length) { console.log(`? ${cab} · CIEGO: el merge no toca src/ ni public/`); cuenta.CIEGO++; continue; }
  if (!tests.length) { console.log(`✖ ${cab} · VERDE POR VACÍO: el PR no trajo ni cambió ningún test que exista hoy`); cuenta.VERDE++; continue; }

  const base = correr(tests);
  if (!base.casos || base.caidos.length || base.salida !== 0 || base.saltados === base.casos) {
    console.log(`? ${cab} · CIEGO: la BASE no vale (casos ${base.casos}, caídos ${base.caidos.length}, saltados ${base.saltados}, salida ${base.salida}) ${base.caidos.slice(0, 3).join(' | ')}`);
    cuenta.CIEGO++; continue;
  }

  const parche = git('diff', '--binary', `${sha}^1`, sha, '--', ...rutas).stdout;
  const fp = path.join(os.tmpdir(), `rojo-merge-${process.pid}-${pr}.patch`);
  fs.writeFileSync(fp, parche);
  const prueba = git('apply', '-R', '--check', fp);
  if (prueba.status !== 0) {
    fs.unlinkSync(fp);
    console.log(`? ${cab} · CIEGO: el parche ya no sale limpio al revés (el código cambió encima): ${(prueba.stderr || '').split(/\r?\n/).filter(Boolean).slice(0, 2).join(' · ')}`);
    cuenta.CIEGO++; continue;
  }
  git('apply', '-R', fp);
  fs.unlinkSync(fp);
  const numstat = git('diff', '--numstat').stdout.trim().split(/\r?\n/).filter(Boolean);
  let veredicto;
  try {
    if (!numstat.length) { veredicto = 'CIEGO: el parche se aplicó y el árbol no cambió'; }
    else {
      const tocaSrc = rutas.some((n) => n.startsWith('src/'));
      let b = { salida: 0, errores: [] };
      if (tocaSrc) { b = build(); buildSucio = true; }
      if (b.salida !== 0) veredicto = `CIEGO: con el arreglo quitado no compila (${b.errores.length} errores) ${b.errores.slice(0, 2).join(' · ')}`;
      else {
        const m = correr(tests);
        if (!m.casos) veredicto = `CIEGO: con el arreglo quitado los tests no dieron casos (salida ${m.salida})`;
        else if (m.caidos.length) veredicto = `ROJO: caen ${m.caidos.length} de ${m.casos} (base ${base.casos}, saltados ${base.saltados}) → ${m.caidos.slice(0, 6).map((c) => c.slice(0, 110)).join(' ‖ ')}`;
        else veredicto = `VERDE: quitado el arreglo, los ${m.casos} casos siguen pasando (saltados ${m.saltados})`;
      }
    }
  } finally {
    git('restore', '--source=HEAD', '--staged', '--worktree', '--', ...rutas);
  }
  const limpio = !sucio();
  const clase = veredicto.split(':')[0].split(' ')[0];
  cuenta[clase] = (cuenta[clase] || 0) + 1;
  console.log(`${clase === 'ROJO' ? '✔' : clase === 'VERDE' ? '✖' : '?'} ${cab} · numstat ${numstat.map((l) => l.replace(/\t/g, ' ')).join(', ')} · ${veredicto} · restaurado ${limpio ? 'sí' : '🔴 NO'}`);
  if (!limpio) { console.error('🔴 el árbol no quedó limpio: paro'); process.exit(2); }
}
if (buildSucio) { const b = build(); console.log(`build final (árbol restaurado): salida ${b.salida}`); }
console.log(`RECUENTO · ${shas.length} preguntado(s) · ${cuenta.ROJO} ROJO · ${cuenta.VERDE} VERDE · ${cuenta.CIEGO} CIEGO`);
console.log(`EXIT=${cuenta.VERDE || cuenta.CIEGO ? 1 : 0}`);
process.exit(cuenta.VERDE || cuenta.CIEGO ? 1 : 0);
