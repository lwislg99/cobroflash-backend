// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1524 · POR QUÉ `scrum525d` NO VE LAS COORDENADAS SIN TESTIGO — EJECUTÁNDOLO, no leyéndolo.
//
// Se saca una COPIA del árbol de HEAD a un directorio temporal (el árbol de trabajo NO se toca, y
// `docs/legal/` menos), se le hace a la copia cada cosa que un PR podría hacer, y se corre el
// `tests/scrum525d-anclas-que-apuntan.test.mjs` DE LA COPIA cada vez. Lo que se apunta es cuántos
// casos pasan y cuáles caen. Después de cada experimento la copia vuelve a su estado.
//
// Los experimentos van POR PAREJAS: lo mismo hecho a una cita SIN testigo y a una CON testigo. La
// segunda mitad es el control: si el guard tampoco cayera ahí, este montaje no estaría midiendo
// al guard sino a sí mismo.
//
// Las víctimas no se escriben a mano: se derivan del censo de la casa sobre la propia copia.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { temporal } from '../../../../tests/_temporal.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const TEST = 'tests/scrum525d-anclas-que-apuntan.test.mjs';
const git = (...a) => execFileSync('git', ['-C', RAIZ, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 }).trimEnd();

// ── La copia ────────────────────────────────────────────────────────────────────────────────
const COPIA = temporal('scrum1524-copia-');
execFileSync('git', ['-C', RAIZ, 'archive', '--format=tar', '-o', path.join(COPIA, 'arbol.tar'), 'HEAD']);
execFileSync('tar', ['-xf', 'arbol.tar'], { cwd: COPIA });
fs.rmSync(path.join(COPIA, 'arbol.tar'));
// `typescript` lo pide el caso ⑦ del test; la copia no tiene node_modules y se le presta la ruta.
let nm = RAIZ;
while (!fs.existsSync(path.join(nm, 'node_modules', 'typescript')) && path.dirname(nm) !== nm) nm = path.dirname(nm);
const ENTORNO = { ...process.env, NODE_PATH: path.join(nm, 'node_modules') };
for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete ENTORNO[k];

const en = (rel) => path.join(COPIA, rel);
function correr() {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { cwd: COPIA, env: ENTORNO, encoding: 'utf8', maxBuffer: 1 << 26 });
  const L = r.stdout.split(/\r?\n/);
  // Anclado al INICIO del caso (cicatriz ③ de la ficha): el símbolo de fallo vive en los nombres.
  const ok = L.filter((l) => /^ok \d+ - /.test(l)).length;
  const caen = L.filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, ''));
  const total = +(L.find((l) => /^# tests \d+/.test(l)) || '# tests -1').slice(8);
  return { salida: r.status, ok, caen, total, suma: ok + caen.length === total, texto: r.stdout };
}

const { analizar } = await import('file://' + en('scripts/_anclas-con-testigo.mjs').replace(/\\/g, '/'));
const R = analizar(COPIA);
const lista = git('ls-tree', '-r', '--name-only', 'HEAD').split('\n');
const porNombre = (ruta) => lista.filter((f) => f === ruta || f.endsWith('/' + ruta));

const conTestigo = new Set(R.juzgadas.filter((c) => c.testigo).map((c) => c.ruta));
const intocable = (f) => f.startsWith('docs/legal/') || f.startsWith('scripts/_anclas-') || f === TEST;
const sinT = R.sinTestigo.filter((c) => !conTestigo.has(c.ruta) && !intocable(c.ruta));
const soloNombre = R.sinRuta.map((c) => ({ c, f: porNombre(c.ruta) })).filter((x) => x.f.length === 1 && !conTestigo.has(x.f[0]) && !intocable(x.f[0]));
const firme = R.firmes.filter((c) => !intocable(c.ruta) && c.b === c.a);

const V_SIN = sinT[0];
const V_NOMBRE = soloNombre.find((x) => x.c.ruta === 'clean-staging-tests.mjs') || soloNombre[0];
const V_FIRME = firme[0];

const filas = [];
function experimento(nombre, hacer) {
  const guardados = new Map();
  const tocar = (rel, nuevo) => {
    if (!guardados.has(rel)) guardados.set(rel, fs.existsSync(en(rel)) ? fs.readFileSync(en(rel)) : null);
    if (nuevo === null) fs.rmSync(en(rel)); else fs.writeFileSync(en(rel), nuevo);
  };
  const detalle = hacer(tocar) || '';
  const r = correr();
  for (const [rel, b] of guardados) { if (b === null) fs.rmSync(en(rel), { force: true }); else fs.writeFileSync(en(rel), b); }
  filas.push({ nombre, detalle, ...r });
  console.log(`${r.caen.length ? '🔴' : '✅'} ${nombre}\n     ${detalle}\n     → pasan ${r.ok} de ${r.total}${r.suma ? '' : ' ⚠️ NO SUMA'} · salida ${r.status ?? r.salida}`
    + (r.caen.length ? `\n     caen: ${r.caen.map((c) => c.slice(0, 90)).join(' | ')}` : ''));
  return r;
}
const leer = (rel) => fs.readFileSync(en(rel), 'utf8');
const empujar = (rel) => '// línea añadida por el experimento\n// otra\n// y otra\n' + leer(rel);

console.log(`HEAD ${git('rev-parse', '--short=9', 'HEAD')} · copia en un temporal · ${lista.length} ficheros`);
console.log(`Censo de la casa sobre la copia: ${R.vivas} vivas · ${R.conTestigo} con testigo · firmes ${R.firmes.length} · sin testigo ${R.sinTestigo.length} · sin ruta ${R.sinRuta.length} · no resuelven ${R.noResuelven.length}`);
console.log(`Las que «no resuelven» y con las que el guard está en verde hoy:`);
for (const c of R.noResuelven) console.log(`     · ${c.doc}:${c.linea} → ${c.ruta}:${c.a} (${c.estado})${c.testigo ? ' CON testigo' : ' sin testigo'}`);
console.log('');

const base = experimento('E0 · sin tocar nada', () => 'línea base');
if (base.caen.length || !base.suma) { console.log('🔴 CIEGO: la línea base no está en verde; nada de lo que sigue se puede leer.'); process.exit(2); }

experimento('E1 · BORRAR un fichero citado con ruta completa y SIN testigo', (t) => { t(V_SIN.ruta, null); return `${V_SIN.ruta} (lo cita ${V_SIN.doc}:${V_SIN.linea})`; });
experimento('E2 · BORRAR un fichero citado sólo por su nombre', (t) => { t(V_NOMBRE.f[0], null); return `${V_NOMBRE.f[0]} (lo cita ${V_NOMBRE.c.doc}:${V_NOMBRE.c.linea} como «${V_NOMBRE.c.ruta}:${V_NOMBRE.c.a}»)`; });
const e3 = experimento('E3 · CONTROL: BORRAR un fichero citado CON testigo', (t) => { t(V_FIRME.ruta, null); return `${V_FIRME.ruta} (lo cita ${V_FIRME.doc}:${V_FIRME.linea}, testigo «${V_FIRME.testigo.join(', ')}»)`; });
experimento('E4 · DESPLAZAR tres líneas un fichero citado SIN testigo', (t) => { t(V_SIN.ruta, empujar(V_SIN.ruta)); return V_SIN.ruta; });
const e5 = experimento('E5 · CONTROL: DESPLAZAR tres líneas un fichero citado CON testigo', (t) => { t(V_FIRME.ruta, empujar(V_FIRME.ruta)); return V_FIRME.ruta; });

const todos = [...new Set([...sinT.map((c) => c.ruta), ...soloNombre.map((x) => x.f[0])])].filter((f) => fs.existsSync(en(f)));
experimento('E6 · BORRAR DE GOLPE todos los ficheros que sólo se citan sin testigo', (t) => { for (const f of todos) t(f, null); return `${todos.length} ficheros borrados`; });

const DOC = V_SIN.doc;
experimento('E7 · cita NUEVA sin testigo a un fichero que no existe (par nuevo)', (t) => { t(DOC, leer(DOC) + '\n- sembrada — `src/no-existe-scrum1524.ts:5`\n'); return `añadida a ${DOC}`; });
experimento('E8 · cita NUEVA con testigo a un fichero que no existe', (t) => { t(DOC, leer(DOC) + '\n- sembrada — `src/no-existe-scrum1524.ts:5` (`algoQueAfirma`)\n'); return `añadida a ${DOC}`; });
experimento('E9 · cita NUEVA sin testigo a un fichero que no existe, en un par YA perdonado', (t) => { t(DOC, leer(DOC) + `\n- sembrada — \`${V_SIN.ruta}:999999\`\n`); return `añadida a ${DOC}: ${V_SIN.ruta}:999999 (línea que no existe)`; });

fs.rmSync(COPIA, { recursive: true, force: true });
if (!e3.caen.length || !e5.caen.length) { console.log('\n🔴 CIEGO: el guard no cayó en los controles E3/E5. El montaje no mide al guard.'); process.exit(2); }
console.log('\n✅ controles E3 y E5: el guard SÍ cae cuando la cita lleva testigo. Lo de arriba mide al guard.');
