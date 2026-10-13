// banco.mjs — SCRUM-1392 · EL HALLAZGO QUE SE PIERDE, VISTO CON EL NAVEGADOR DE VERDAD.
//
//   node banco.mjs <raiz ABSOLUTA del repo> <sha o ref> <etiqueta> <dir de salida> <node_modules ABSOLUTO>
//
// Misma técnica que `docs/master/evidencias/scrum1336/banco.mjs`: el SHA sale con `git archive` a un
// directorio temporal FUERA del repo, se rompe ALLÍ el producto y se tira. «Antes» y «después» son
// este mismo banco con otro SHA. El árbol de trabajo no se toca.
//
// El sujeto es `guard-duplicar-926`, que apunta los errores de página en una lista que nace dentro
// del caso. Cuatro escenarios, y el orden es el de las cuatro esquinas:
//
//   limpio ................ nada roto                               → 0   (control del banco)
//   error-visto ........... un error de página, y el caso se lee     → 1   (control: el guard SABE verlo)
//   lanza-sin-nada ........ la lectura lanza, sin error de página    → 2   (el ciego NO se toca: ③ del ticket)
//   error-visto-y-lanza ... un error de página Y la lectura lanza    → el defecto: ¿sale el error?
//
// Y los tres guards que llevaban la lista en la mano sin nada que lance detrás, sólo en limpio: su
// salida no puede cambiar.
//
// Cada pasada demuestra antes de contar (A21): que la rotura se aplicó (cuenta apariciones) y que el
// guard corrió (código numérico, sin señal, con salida).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [RAIZ, REF, ETIQUETA, SALIDA, MODULOS] = process.argv.slice(2);
if (!RAIZ || !path.isAbsolute(RAIZ) || !REF || !ETIQUETA || !SALIDA || !MODULOS || !path.isAbsolute(MODULOS)) {
  console.error('uso: node banco.mjs <raiz ABSOLUTA> <sha> <etiqueta> <dir de salida> <node_modules ABSOLUTO>');
  process.exit(2);
}

const EDITOR = 'public/dashboard/js/quotesView.js';
const ANCLA = 'opt5050.value = "FIFTY_FIFTY";';
const TEXTO_ERROR = 'error de pagina puesto por el banco de SCRUM-1392';
const TEXTO_LECTURA = 'lectura rota por el banco de SCRUM-1392';
// Un error de página DE VERDAD: una excepción sin capturar en un temporizador del editor.
const ERROR_DE_PAGINA = ' setTimeout(function () { throw new Error("' + TEXTO_ERROR + '"); }, 0);';
// La lectura del guard (`LEER`) empieza por este selector exacto. Sólo él lanza: lo demás del
// panel sigue leyendo el documento como siempre.
const LECTURA_QUE_LANZA = ' (function () { var q = document.querySelector; document.querySelector = function (s) {'
  + ' if (s === ".quote-dto-global__campo input") throw new Error("' + TEXTO_LECTURA + '"); return q.apply(document, arguments); }; })();';
const romper = (extra) => ({ f: EDITOR, de: ANCLA, a: ANCLA + extra, veces: 1 });

const PASADAS = [
  { guard: 'duplicar-926', escenario: 'limpio', cambios: [] },
  { guard: 'duplicar-926', escenario: 'error-visto', cambios: [romper(ERROR_DE_PAGINA)] },
  { guard: 'duplicar-926', escenario: 'lanza-sin-nada', cambios: [romper(LECTURA_QUE_LANZA)] },
  { guard: 'duplicar-926', escenario: 'error-visto-y-lanza', cambios: [romper(ERROR_DE_PAGINA + LECTURA_QUE_LANZA)] },
  { guard: 'caja-datos-del-cliente', escenario: 'limpio', cambios: [] },
  { guard: 'caja-documento-suelto', escenario: 'limpio', cambios: [] },
  { guard: 'portal-en-la-ficha', escenario: 'limpio', cambios: [] },
];

const git = (args, opciones = {}) => spawnSync('git', args, { cwd: RAIZ, maxBuffer: 512 * 1024 * 1024, ...opciones });
const sha = String(git(['rev-parse', '--verify', REF + '^{commit}'], { encoding: 'utf8' }).stdout || '').trim();
if (!/^[0-9a-f]{40}$/.test(sha)) { console.error('🔴 «' + REF + '» no es un commit de este repositorio'); process.exit(2); }
const ayudantes = String(git(['ls-tree', '-r', '--name-only', sha, 'tests'], { encoding: 'utf8' }).stdout || '')
  .split('\n').filter((f) => /^tests\/_[^/]+\.mjs$/.test(f));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1392-'));
const PRISTINO = path.join(TMP, '_pristino');
const ARBOL = path.join(TMP, 'arbol');
const ENLACE = path.join(ARBOL, 'node_modules');
process.on('exit', () => {
  // El enlace PRIMERO y por su nombre: borrar el árbol con él dentro sería pedirle a `rm` que decida si lo sigue.
  try { fs.rmdirSync(ENLACE); } catch { try { fs.unlinkSync(ENLACE); } catch { /* no estaba */ } }
  if (fs.existsSync(ENLACE)) { console.error('🔴 no pude quitar el enlace a node_modules: NO borro ' + TMP); return; }
  fs.rmSync(TMP, { recursive: true, force: true });
});
fs.mkdirSync(PRISTINO); fs.mkdirSync(ARBOL);

const tar = git(['archive', '--format=tar', sha, 'scripts', 'public', 'package.json', ...ayudantes]);
if (tar.status !== 0 || !tar.stdout || tar.stdout.length < 1024 * 1024) {
  console.error('🔴 `git archive` no dio un árbol (' + (tar.stdout ? tar.stdout.length : 0) + ' bytes): ' + String(tar.stderr || ''));
  process.exit(2);
}
for (const destino of [PRISTINO, ARBOL]) {
  const x = spawnSync('tar', ['-x', '-f', '-'], { cwd: destino, input: tar.stdout, maxBuffer: 64 * 1024 * 1024 });
  if (x.status !== 0) { console.error('🔴 no pude extraer el árbol en ' + destino + ': ' + String(x.stderr || '')); process.exit(2); }
}
fs.symlinkSync(MODULOS, ENLACE, 'junction');
if (!fs.existsSync(path.join(ENLACE, 'puppeteer-core'))) { console.error('🔴 el árbol desechable no ve puppeteer-core'); process.exit(2); }

const veces = (texto, trozo) => texto.split(trozo).length - 1;
function aplicar(c) {
  const abs = path.join(ARBOL, c.f);
  const antes = fs.readFileSync(abs, 'utf8');
  const n = veces(antes, c.de);
  if (n !== c.veces) return `${c.f}: «${c.de.slice(0, 50)}» aparece ${n} veces y esperaba ${c.veces}`;
  fs.writeFileSync(abs, antes.split(c.de).join(c.a));
  return null;
}

// El entorno del sujeto se construye a mano (A21): sin el color ni las opciones de quien lo lanza.
const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];

fs.mkdirSync(SALIDA, { recursive: true });
const CR = String.fromCharCode(13);
const filas = [];
console.log(`POBLACION=${PASADAS.length} pasadas · etiqueta=${ETIQUETA} · sha=${sha}`);
for (const p of PASADAS) {
  for (const dir of ['public', 'scripts']) {
    fs.rmSync(path.join(ARBOL, dir), { recursive: true, force: true });
    fs.cpSync(path.join(PRISTINO, dir), path.join(ARBOL, dir), { recursive: true });
  }
  let noAplicada = null;
  for (const c of p.cambios) { noAplicada = aplicar(c); if (noAplicada) break; }
  let r = null;
  const t0 = Date.now();
  if (!noAplicada) {
    r = spawnSync(process.execPath, [path.join('scripts', 'guard-' + p.guard + '.mjs')], { cwd: ARBOL, env: entorno, encoding: 'utf8', timeout: 280000, maxBuffer: 64 * 1024 * 1024 });
  }
  const segundos = ((Date.now() - t0) / 1000).toFixed(1);
  const salida = r ? (String(r.stdout || '') + String(r.stderr || '')).split(CR).join('') : '';
  let invalida = null;
  if (noAplicada) invalida = 'la rotura NO se aplicó — ' + noAplicada;
  else if (r.error) invalida = 'el proceso no llegó a correr o se cortó — ' + String(r.error.message || r.error);
  else if (r.signal) invalida = 'el proceso murió por la señal ' + r.signal;
  else if (!Number.isInteger(r.status)) invalida = 'el proceso no dejó código de salida';
  else if (!salida.trim()) invalida = 'el proceso salió con ' + r.status + ' SIN SALIDA: no hay testigo de que midiera';
  const lineas = salida.split('\n');
  const veredicto = lineas.filter((l) => l.includes('⟦veredicto⟧')).pop() || null;
  const recorrido = lineas.filter((l) => l.includes('⟦recorrido⟧')).pop() || null;
  const id = p.guard + '-' + p.escenario;
  const fila = {
    id, guard: p.guard, escenario: p.escenario, valida: !invalida, invalida, codigo: r ? r.status : null, segundos: Number(segundos),
    veredicto, recorrido,
    // Lo que decide: ¿el error de página puesto por el banco aparece NOMBRADO en la salida del guard?
    nombraElErrorVisto: salida.includes(TEXTO_ERROR),
    nombraLaLecturaRota: salida.includes(TEXTO_LECTURA),
  };
  filas.push(fila);
  fs.writeFileSync(path.join(SALIDA, `${ETIQUETA}-${id}.txt`),
    `# ${id} · sha ${sha} · ${invalida ? 'PASADA NO VÁLIDA: ' + invalida : 'EXIT=' + r.status} · ${segundos} s\n` + salida);
  console.log(`  ${id.padEnd(42)} ${invalida ? 'NO VÁLIDA — ' + invalida : 'salida ' + r.status} · ${segundos} s`
    + (invalida ? '' : ` · error visto nombrado: ${fila.nombraElErrorVisto ? 'SÍ' : 'no'} · lectura rota nombrada: ${fila.nombraLaLecturaRota ? 'SÍ' : 'no'}`));
  if (veredicto) console.log('      ' + veredicto.trim());
  if (recorrido) console.log('      ' + recorrido.trim());
}
const validas = filas.filter((f) => f.valida).length;
fs.writeFileSync(path.join(SALIDA, `${ETIQUETA}-resumen.json`), JSON.stringify({ sha, etiqueta: ETIQUETA, pasadas: filas.length, validas, filas }, null, 2) + '\n');
console.log(`RESUMEN ${ETIQUETA}: ${validas} pasadas válidas de ${filas.length}`);
const codigo = validas === filas.length ? 0 : 2;
console.log('EXIT=' + codigo);
process.exitCode = codigo;
