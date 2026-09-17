// SCRUM-866 · ③ ¿CUÁNTAS MUTACIONES CAEN POR EL SITIO QUE DICEN?
//
// «Una mutación apuntada a un sitio que el test no ejecuta no mide cobertura: mide que el
// apuntador estaba mal.»
//
// ── EL CRITERIO ─────────────────────────────────────────────────────────────────────────────
// Para cada declaración se corre SÓLO el test que nombra (`--test-name-pattern`) y se pregunta si
// la mutación puede alcanzarlo por el punto declarado. Dos vías, y las dos cuentan:
//
//   ① EJECUCIÓN · cobertura por test: la LÍNEA que la mutación cambia tiene hits > 0.
//   ② LECTURA   · media casa son guards ESTÁTICOS: no ejecutan el fichero, lo leen como texto y
//     asertan sobre él. Se espían las lecturas reales del proceso (`fs.readFileSync` y compañía)
//     en vez de adivinarlas con un grep.
//
// 🔴 NO vale la cobertura por FICHERO, y el caso de este ticket lo demuestra: al correr `scrum859`
// se importa `scrum267`, cuyos propios tests SÍ recorren la línea. A nivel de fichero habría
// salido «cubierta» — y era justo la que no pasaba por ahí. El filtro por nombre de test es lo que
// separa «alguien lo recorre» de «lo recorre EL QUE DICE».
//
// ── DOS CEGUERAS PROPIAS, MEDIDAS Y CORREGIDAS ──────────────────────────────────────────────
// 1. Node EXCLUYE los ficheros de test de la cobertura por defecto. Sin
//    `--test-coverage-exclude=**/node_modules/**` todo objetivo `.test.mjs` daba lcov VACÍO, que
//    se lee igual que «el test no pasa por ahí». En la primera pasada eso dejó MI PROPIA mutación
//    de scrum859 como NO CLASIFICADA en 0,2 s.
// 2. Sin el espía de lecturas, los guards estáticos salían «NO RECORRE». Tres de ellos
//    (scrum745 ×2, scrum754) leen `meta-guard-mutaciones.mjs` con `readFileSync` y asertan sobre
//    el texto: la mutación SÍ les llega. Habrían sido tres hallazgos falsos.
//
// ── LO QUE SIGUE SIN ALCANZAR, y se cuenta DEL LADO MALO ────────────────────────────────────
// · Mutaciones sobre `src/*.ts`: lo que se ejecuta es `dist/*.js` y las líneas no se corresponden.
// · Ancla caducada, fichero inexistente, o el test filtrado que no llegó a correr.
// ⚠️ Y un límite que queda declarado: «lee el fichero» no prueba que mire ESA línea. Para las de
//    la vía ② la respuesta es «la mutación puede alcanzarle», no «le alcanza seguro».
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const RAIZ = 'C:/Users/Javier Pereira/cobroflash-b2';
const SCRATCH = 'C:/Users/JAVIER~1/AppData/Local/Temp/claude/c--Users-Javier-Pereira-cobroflash-b2/55056e52-6eb0-4ece-8997-627308362091/scratchpad';
process.chdir(RAIZ);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'recorre866-'));
const LIMITE = Number(process.env.LIMITE || 0);
const ESPIA = 'file:///' + (SCRATCH + '/espia-lecturas.mjs').replace(/ /g, '%20');

const m = await import('file:///C:/Users/Javier%20Pereira/cobroflash-b2/scripts/meta-guard-mutaciones.mjs');
const censo = m.censoDeDeclaraciones(path.join(RAIZ, 'tests'));
const todas = censo.flatMap((g) => g.mutaciones.map((x) => ({ ...x, guard: g.guard })));

if (!todas.length) { console.log('🔴 CIEGO: cero declaraciones.'); process.exit(2); }
console.log('POBLACION DECLARADA: ' + todas.length + ' mutaciones en ' + censo.length + ' guards');
console.log('(SCRUM-836d censo 178; el arbol dice ' + todas.length + ' hoy)');

/** La línea (1-based) que la mutación CAMBIA de verdad: la primera en que `de` y `a` difieren. */
function lineaQueCambia(texto, de, a) {
  const pos = texto.indexOf(de);
  if (pos < 0) return null;
  const lineaIni = texto.slice(0, pos).split('\n').length;
  const ld = de.split('\n'); const la = a.split('\n');
  for (let k = 0; k < ld.length; k++) if (ld[k] !== (la[k] ?? null)) return lineaIni + k;
  return lineaIni;
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Corre SÓLO el test nombrado; devuelve si EJECUTA la línea y si LEE el fichero. */
function sonda(guard, cae, objetivo, linea, i) {
  const dest = path.join(TMP, 'c' + i + '.info');
  const lecturas = path.join(TMP, 'l' + i + '.txt');
  fs.writeFileSync(lecturas, '');
  const r = spawnSync(process.execPath, [
    '--experimental-test-coverage',
    '--test-coverage-include=' + objetivo,
    // 🔴 Sin esto Node excluye los ficheros de test y el lcov sale vacío (ceguera nº1, arriba).
    '--test-coverage-exclude=**/node_modules/**',
    '--import=' + ESPIA,
    '--test-reporter=lcov', '--test-reporter-destination=' + dest,
    '--test', '--test-force-exit',
    '--test-name-pattern=' + escapar(cae),
    'tests/' + guard,
    // 🔴 CEGUERA Nº3, medida: varios guards miden en un PROCESO NIETO (scrum750 arranca
    // `_sonda-calendarios.mjs` en otra zona horaria, y es ÉSE quien lee el módulo mutado). Ni la
    // cobertura ni el espía cruzan solos esa frontera: sin esto, scrum750 salía «NO RECORRE» —
    // un hallazgo falso. `NODE_OPTIONS` sí se hereda, así que el espía viaja con los nietos.
    // Comprobado: lecturas del módulo mutado 0 → 1 al propagarlo.
  ], { encoding: 'utf8', cwd: RAIZ, timeout: 180000,
    env: { ...process.env, ESPIA_DEST: lecturas, NODE_OPTIONS: '--import=' + ESPIA } });

  const leidos = new Set(fs.readFileSync(lecturas, 'utf8').split('\n').filter(Boolean));
  const lee = leidos.has(objetivo);

  if (!fs.existsSync(dest)) return { ejecuta: null, lee, motivo: 'lcov no se escribio (rc=' + r.status + ')' };
  const lcov = fs.readFileSync(dest, 'utf8');
  const bloques = lcov.split('SF:').slice(1);
  const mio = bloques.find((b) => b.split('\n')[0].trim().replace(/\\/g, '/').endsWith(objetivo));
  if (!mio) return { ejecuta: false, lee, motivo: 'el fichero no se EJECUTA en esa pasada' };
  const da = mio.split('\n').find((l) => l.startsWith('DA:' + linea + ','));
  if (!da) return { ejecuta: null, lee, motivo: 'la linea ' + linea + ' no es ejecutable segun lcov' };
  return { ejecuta: Number(da.split(',')[1]) > 0, lee, hits: Number(da.split(',')[1]) };
}

const clases = { ejecuta: [], lee: [], noRecorre: [], noClasificada: [] };
const lista = LIMITE ? todas.slice(0, LIMITE) : todas;
let i = 0;
for (const mut of lista) {
  i++;
  const et = '[' + i + '/' + lista.length + '] ';
  const nombre = mut.guard.replace('.test.mjs', '') + ' · ' + mut.cae.slice(0, 50);
  if (/^src\//.test(mut.fichero)) {
    clases.noClasificada.push({ ...mut, motivo: 'objetivo en src/: se ejecuta dist/, y las lineas no se corresponden' });
    console.log('   ' + et + 'NO CLASIFICADA (src/→dist/) · ' + nombre); continue;
  }
  const abs = path.join(RAIZ, mut.fichero);
  if (!fs.existsSync(abs)) {
    clases.noClasificada.push({ ...mut, motivo: 'el fichero declarado no existe' });
    console.log('   ' + et + 'NO CLASIFICADA (no existe) · ' + nombre); continue;
  }
  // 🔴 CEGUERA Nº4, medida: `scrum839d` muta `.gitattributes` y comprueba el EFECTO con
  // `execFileSync('git', …)`. Ese fichero no lo lee Node: lo lee git. Ni la cobertura ni el espía
  // de `fs` alcanzan a una herramienta externa, así que un «no recorre» aquí sería falso. Un
  // objetivo que no es código cargable por Node se declara NO CLASIFICADO, no acusado.
  const CARGABLE = /\.(mjs|cjs|js|ts|json)$/.test(mut.fichero);
  const linea = lineaQueCambia(fs.readFileSync(abs, 'utf8'), mut.de, mut.a);
  if (linea === null) {
    clases.noClasificada.push({ ...mut, motivo: 'el ancla `de` no aparece en el fichero' });
    console.log('   ' + et + 'NO CLASIFICADA (ancla caducada) · ' + nombre); continue;
  }
  const t0 = Date.now();
  const s = sonda(mut.guard, mut.cae, mut.fichero, linea, i);
  const seg = Math.round((Date.now() - t0) / 100) / 10;
  if (s.ejecuta === true) {
    clases.ejecuta.push({ ...mut, linea, hits: s.hits });
    console.log('   ' + et + 'EJECUTA (hits=' + s.hits + ') ' + seg + 's · ' + nombre);
  } else if (s.lee) {
    clases.lee.push({ ...mut, linea });
    console.log('   ' + et + 'LEE el fichero (guard estatico) ' + seg + 's · ' + nombre);
  } else if (s.ejecuta === false && !CARGABLE) {
    clases.noClasificada.push({ ...mut, linea, motivo: 'el objetivo NO es codigo cargable por Node (' + path.extname(mut.fichero) + '): su efecto puede viajar por una herramienta externa, y ni la cobertura ni el espia de fs la alcanzan' });
    console.log('   ' + et + 'NO CLASIFICADA (no es codigo Node) ' + seg + 's · ' + nombre);
  } else if (s.ejecuta === false) {
    clases.noRecorre.push({ ...mut, linea, motivo: s.motivo });
    console.log('   ' + et + '🔴 NO RECORRE ' + seg + 's · ' + nombre);
  } else {
    clases.noClasificada.push({ ...mut, linea, motivo: s.motivo });
    console.log('   ' + et + 'NO CLASIFICADA (' + s.motivo + ') ' + seg + 's · ' + nombre);
  }
}

const alcanza = clases.ejecuta.length + clases.lee.length;
const mal = clases.noRecorre.length + clases.noClasificada.length;
console.log('\n══ RESULTADO ═══════════════════════════════════════════════════════════════');
console.log('POBLACION: ' + lista.length + ' de ' + todas.length + ' declaradas en el arbol');
console.log('   ✅ la mutacion ALCANZA a su test por el punto declarado : ' + alcanza);
console.log('        · ejecutando la linea            : ' + clases.ejecuta.length);
console.log('        · leyendo el fichero (estaticos) : ' + clases.lee.length);
console.log('   🔴 NO RECORRE el punto                                  : ' + clases.noRecorre.length);
console.log('   ⚠️ NO CLASIFICADAS (cuentan del lado malo)              : ' + clases.noClasificada.length);
console.log('   LADO MALO (no recorre + no clasificadas)                : ' + mal);
console.log('   suma: ' + (alcanza + mal) + (alcanza + mal === lista.length ? ' ✅ cuadra' : ' 🔴 NO CUADRA'));

if (clases.noRecorre.length) {
  console.log('\n🔴 LAS QUE NO RECORREN SU PUNTO:');
  for (const x of clases.noRecorre) console.log('   · ' + x.guard + '\n       ancla → ' + x.fichero + ':' + x.linea + '\n       ' + x.motivo + '\n       cae: ' + x.cae);
}
if (clases.noClasificada.length) {
  const por = new Map();
  for (const x of clases.noClasificada) por.set(x.motivo, (por.get(x.motivo) || 0) + 1);
  console.log('\n⚠️ NO CLASIFICADAS, por motivo:');
  for (const [k, v] of por) console.log('   ' + String(v).padStart(3) + ' · ' + k);
}
fs.rmSync(TMP, { recursive: true, force: true });
