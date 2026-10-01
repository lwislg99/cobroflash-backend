// mutar.mjs — SCRUM-1327 · ¿LOS TESTS CAEN CUANDO EL DEFECTO VUELVE?
//
//   node docs/master/evidencias/scrum1327/mutar.mjs <raiz ABSOLUTA del arbol> <fichero de salida .json>
//
// Primero la BASE sin mutar (A3): si no sale entera en verde, el banco se declara CIEGO y no muta
// nada. Despues, una mutacion cada vez: sustituye contando (si el ancla no aparece EXACTAMENTE una
// vez, esa fila es CIEGA y no cuenta como cazada), corre los dos ficheros de test, deshace con la
// EDICION INVERSA y comprueba por sha256 que el fichero volvio a su sitio.
//
// El veredicto de cada fila lo da el NOMBRE del test que tenia que caer (`cae`), no «cayo algo»:
//   CAZADA ... cayo el test declarado.      OTRA ... cayo algo, pero no el declarado.
//   MUDA ..... no cayo nada: el defecto volveria sin que nadie se entere.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const [RAIZ, SALIDA] = process.argv.slice(2);
if (!RAIZ || !path.isAbsolute(RAIZ) || !SALIDA) {
  console.error('uso: node mutar.mjs <raiz ABSOLUTA> <salida.json>');
  process.exit(2);
}
const TESTS = ['tests/scrum1327-el-veredicto-no-se-decide-a-mano.test.mjs', 'tests/scrum1320-hallazgo-y-ciego-no-son-excluyentes.test.mjs'];
const NL = String.fromCharCode(10);
const RECORRIDO = 'scripts/_hallazgos-y-ciegos.mjs';
const LECTOR = 'tests/_salidas-de-guard.mjs';

const MUTACIONES = [
  // ── el recorrido ──
  { id: 'R1', que: 'el recorrido corta al primer ciego (el defecto del grupo 1)', f: RECORRIDO,
    de: "    ciegos.push(...listaDe(suyo && suyo.ciegos, 'ciegos', nombre));" + NL,
    a: "    ciegos.push(...listaDe(suyo && suyo.ciegos, 'ciegos', nombre));" + NL + '    if (ciegos.length) break;' + NL,
    cae: 'un ciego DELANTE no impide medir el hallazgo' },
  { id: 'R2', que: 'un caso que lanza corta el recorrido', f: RECORRIDO,
    de: "String((e && e.message) || e));" + NL + '      continue;', a: "String((e && e.message) || e));" + NL + '      break;',
    cae: 'un caso que LANZA es un ciego de ese caso' },
  { id: 'R3', que: 'cero casos da verde', f: RECORRIDO,
    de: 'if (recorridos === 0) ciegos.push(', a: 'if (recorridos < 0) ciegos.push(',
    cae: 'SUELO del recorrido' },
  { id: 'R4', que: 'un caso que no devuelve una LISTA pasa (una frase se esparce letra a letra)', f: RECORRIDO,
    de: 'if (!Array.isArray(valor)) {', a: 'if (valor === undefined) {',
    cae: 'SUELO del recorrido' },
  // ── los seis ──
  { id: 'S4', que: 'un guard deja de decir sus dos cuentas en verde', f: 'scripts/guard-vias-de-cobro.mjs',
    de: "console.log('  ' + veredictoFinal.linea);", a: "console.log('  sin las cuentas');",
    cae: 'los seis salen SÓLO por `veredictoDe`' },
  { id: 'S1', que: 'un guard del grupo 2 vuelve a salir con 1 a mano', f: 'scripts/guard-aviso-bizum.mjs',
    de: '  process.exit(veredictoFinal.codigo);', a: '  process.exit(1);',
    cae: 'los seis salen SÓLO por `veredictoDe`' },
  { id: 'S2', que: 'un guard del grupo 1 vuelve a cerrar DENTRO del recorrido (con veredictoDe puesto)', f: 'scripts/guard-caja-datos-del-cliente.mjs',
    de: "      if (m.anchoSidebar <= 0) return soloCiego(", a: "      if (m.anchoSidebar <= 0) { ciegos.push('sidebar'); cerrar(); }" + NL + '      if (false) return soloCiego(',
    cae: 'los seis salen SÓLO por `veredictoDe`' },
  { id: 'S3', que: 'un guard del grupo 1 deja de recorrer con recorrerCasos', f: 'scripts/guard-portal-en-la-ficha.mjs',
    de: 'cuentas = await recorrerCasos(CASOS,', a: 'cuentas = await recorrerAMano(CASOS,',
    cae: 'los seis salen SÓLO por `veredictoDe`' },
  // ── el censo, sobre el árbol real ──
  { id: 'C1', que: 'entra un guard NUEVO que decide solo (el séptimo)', crear: 'scripts/guard-septimo-de-prueba.mjs',
    contenido: "const fallos = []; const ciegos = [];" + NL + "if (ciegos.length) process.exit(1);" + NL + "if (fallos.length) process.exit(1);" + NL,
    cae: 'censo: ningún `scripts/guard-*.mjs` sale a mano' },
  { id: 'C2', que: 'entra un guard NUEVO del que no se sabe cómo decide (sin ninguna salida)', crear: 'scripts/guard-mudo-de-prueba.mjs',
    contenido: "const fallos = [];" + NL + "if (fallos.length) throw new Error('hay fallos');" + NL,
    cae: 'censo: ningún `scripts/guard-*.mjs` sale a mano' },
  { id: 'C3', que: 'una salida a mano NUEVA en un guard ya declarado', f: 'scripts/guard-rastro-del-menu.mjs',
    de: "    console.error('\\n🔴 RASTRO DE NAVEGACIÓN ROTO:');", a: "    if (fallos.length > 99) process.exit(2);" + NL + "    console.error('\\n🔴 RASTRO DE NAVEGACIÓN ROTO:');",
    cae: 'censo: ningún `scripts/guard-*.mjs` sale a mano' },
  { id: 'C4', que: 'un número de la lista por encima de la realidad (holgura)', f: LECTOR,
    de: "  ['guard-contraste.mjs', {" + NL + '    salidas: 3,', a: "  ['guard-contraste.mjs', {" + NL + '    salidas: 4,',
    cae: 'censo: ningún `scripts/guard-*.mjs` sale a mano' },
  { id: 'C5', que: 'una entrada caduca: un guard ya arreglado sigue en la lista', f: LECTOR,
    de: "  ['guard-primera-pantalla.mjs', {", a: "  ['guard-portal-en-la-ficha.mjs', { salidas: 1, motivo: 'una entrada que ya no hace falta, puesta a mano para la prueba' }]," + NL + "  ['guard-primera-pantalla.mjs', {",
    cae: 'censo: ningún `scripts/guard-*.mjs` sale a mano' },
  // ── el lector ──
  { id: 'L1', que: 'cualquier `.codigo` vale como veredicto', f: LECTOR,
    de: NL + "    && ((ts.isIdentifier(arg.expression) && veredictos.has(arg.expression.text)) || esLlamadaA(arg.expression, 'veredictoDe'));", a: ' /* cualquier .codigo */;',
    cae: 'las otras formas de decidir a mano' },
  { id: 'L2', que: 'el lector deja de ver las salidas dentro del recorrido', f: LECTOR,
    de: 'const corta = s.enRecorrido || (', a: 'const corta = false && (',
    cae: 'la forma del grupo ①' },
  { id: 'L3', que: 'el lector deja de ver `process.exitCode`', f: LECTOR,
    de: "esDeProcess(n.left, 'exitCode')", a: "esDeProcess(n.left, 'exitCodigo')",
    cae: 'las otras formas de decidir a mano' },
  { id: 'L4', que: 'el lector deja de ver la cuenta escrita a mano', f: LECTOR,
    de: 'if (esCuentaLiteral(p.initializer)) {', a: 'if (false) {',
    cae: 'las otras formas de decidir a mano' },
  { id: 'L5', que: 'un guard sin ninguna salida deja de ser «no lo sé»', f: LECTOR,
    de: 'const ciego = salidas.length === 0 ?', a: 'const ciego = salidas.length < 0 ?',
    cae: 'cuando no sabe, dice que no sabe' },
  // ── el censo, como función ──
  { id: 'F1', que: 'el censo calla los «no lo sé»', f: LECTOR,
    de: "const noSe = leidos.filter((r) => r.ciego).map(", a: "const noSe = leidos.filter(() => false).map(",
    cae: 'el censo SABE FALLAR' },
  { id: 'F2', que: 'el censo sólo ve los números que SUBEN', f: LECTOR,
    de: 'declarados.get(r.f).salidas !== r.aMano.length)', a: 'declarados.get(r.f).salidas < r.aMano.length)',
    cae: 'el censo SABE FALLAR' },
  { id: 'F3', que: 'el censo pierde la mitad de las entradas caducas', f: LECTOR,
    de: 'const caducas = [...declarados.keys()].filter(', a: 'const caducas = [].filter(',
    cae: 'el censo SABE FALLAR' },
  { id: 'F4', que: 'el censo calla a los que salen a mano sin declarar', f: LECTOR,
    de: 'const sinDeclarar = aMano.filter((r) => !declarados.has(r.f)).map(', a: 'const sinDeclarar = aMano.filter(() => false).map(',
    cae: 'el censo SABE FALLAR' },
  // ── la lista única ──
  { id: 'U1', que: 'una marca de la lista miente (la que deriva el censo de SCRUM-1320)', f: LECTOR,
    de: '    eligeEntreCiegoYHallazgo: true,' + NL + "    motivo: 'NO ES EL DEFECTO", a: "    motivo: 'NO ES EL DEFECTO",
    cae: 'sus marcas no mienten' },
];

const abs = (f) => path.join(RAIZ, f);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(abs(f))).digest('hex');
const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
const TAP = path.join(os.tmpdir(), 'yaqu-1327-mutar-' + process.pid + '.tap');

/** Corre los dos ficheros y devuelve cuántos tests hubo y cuáles cayeron. `null` = no hubo población. */
function correr() {
  fs.rmSync(TAP, { force: true });
  spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-reporter-destination=' + TAP, ...TESTS], { cwd: RAIZ, env: entorno, encoding: 'utf8', timeout: 120000 });
  if (!fs.existsSync(TAP)) return null;
  const lineas = fs.readFileSync(TAP, 'utf8').split(NL);
  const de = (re) => lineas.map((l) => l.match(re)).filter(Boolean).map((m) => m[1]);
  const pasan = de(/^ok \d+ - (.*)$/);
  const caen = de(/^not ok \d+ - (.*)$/);
  fs.rmSync(TAP, { force: true });
  return pasan.length + caen.length === 0 ? null : { total: pasan.length + caen.length, caen };
}

const base = correr();
console.log('BASE sin mutar: ' + (base ? base.total + ' tests · ' + base.caen.length + ' caídos' : 'SIN POBLACIÓN'));
if (!base || base.caen.length) {
  console.error('🔴 CIEGO: la base no está entera en verde; una mutación que «cae» aquí no probaría nada.');
  process.exit(2);
}

const filas = [];
for (const m of MUTACIONES) {
  let ciego = null;
  let original = null;
  if (m.crear) {
    if (fs.existsSync(abs(m.crear))) ciego = m.crear + ' ya existe';
    else fs.writeFileSync(abs(m.crear), m.contenido);
  } else {
    const antes = fs.readFileSync(abs(m.f), 'utf8');
    const n = antes.split(m.de).length - 1;
    if (n !== 1) ciego = 'el ancla aparece ' + n + ' veces en ' + m.f;
    else { original = sha(m.f); fs.writeFileSync(abs(m.f), antes.replace(m.de, () => m.a)); }
  }
  const r = ciego ? null : correr();
  // LA EDICIÓN INVERSA.
  if (!ciego && m.crear) fs.rmSync(abs(m.crear));
  if (!ciego && !m.crear) {
    const mutado = fs.readFileSync(abs(m.f), 'utf8');
    if (mutado.split(m.a).length - 1 !== 1) { console.error('🔴 NO PUEDO DESHACER ' + m.id); process.exit(3); }
    fs.writeFileSync(abs(m.f), mutado.replace(m.a, () => m.de));
    if (sha(m.f) !== original) { console.error('🔴 ' + m.f + ' NO ha vuelto a su sitio tras ' + m.id); process.exit(3); }
  }
  let veredicto;
  if (ciego) veredicto = 'CIEGA';
  else if (!r) veredicto = 'CIEGA';
  else if (r.caen.some((n) => n.includes(m.cae))) veredicto = 'CAZADA';
  else veredicto = r.caen.length ? 'OTRA' : 'MUDA';
  filas.push({ id: m.id, que: m.que, fichero: m.f || m.crear, cae: m.cae, veredicto, caidos: r ? r.caen : [], motivo: ciego || (r ? null : 'la tanda no dejó TAP') });
  console.log(veredicto.padEnd(7) + ' ' + m.id.padEnd(3) + ' ' + m.que + (r ? '  [' + r.caen.length + ' de ' + r.total + ' caen]' : '  ← ' + (ciego || 'sin TAP')));
}

const despues = correr();
const st = spawnSync('git', ['status', '--porcelain'], { cwd: RAIZ, encoding: 'utf8' });
const cuenta = (v) => filas.filter((f) => f.veredicto === v).length;
const resumen = 'POBLACIÓN=' + filas.length + ' mutaciones · CAZADA=' + cuenta('CAZADA') + ' · MUDA=' + cuenta('MUDA') + ' · OTRA=' + cuenta('OTRA') + ' · CIEGA=' + cuenta('CIEGA');
console.log(resumen);
console.log('BASE tras deshacer: ' + (despues ? despues.total + ' tests · ' + despues.caen.length + ' caídos' : 'SIN POBLACIÓN'));
console.log('porcelain tras deshacer: ' + (st.stdout.trim() ? NL + st.stdout : '(vacío)'));
fs.writeFileSync(SALIDA, JSON.stringify({ base, resumen, filas, baseTrasDeshacer: despues }, null, 2) + NL);
const malo = cuenta('MUDA') + cuenta('OTRA') + cuenta('CIEGA') > 0 || !despues || despues.caen.length > 0;
console.log('EXIT=' + (malo ? 1 : 0));
process.exit(malo ? 1 : 0);
