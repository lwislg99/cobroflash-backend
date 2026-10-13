// docs/master/evidencias/SCRUM-1510/otros-tests-por-efecto.mjs — SCRUM-1510, pregunta ③
//
// ¿HAY OTRO TEST DE LA TANDA QUE CACE LOS CUATRO PUNTOS CIEGOS de
// `tests/scrum205-fallo-de-sellado-no-entrega.test.mjs`?  Medido POR EFECTO: se siembra cada punto
// ciego en un ESPEJO y se corren contra él los tests que tocan el concepto. El que caiga, lo caza.
//
//   node docs/master/evidencias/SCRUM-1510/otros-tests-por-efecto.mjs [--solo-base]   (después de compilar)
//
// 🔴 Ni el guard ni el camino de emisión se tocan. El ESPEJO es una copia de `src/`, `dist/`, `tests/`
// y `scripts/` dentro de `dist/` (git lo ignora; node encuentra `node_modules` subiendo). Cada siembra
// va a la fuente `.ts` Y a su compilado `.js`, porque hay tests que leen una y tests que ejecutan el
// otro. El árbol de verdad se coteja por sha256 antes y después.
//
// LA POBLACIÓN se busca por CONCEPTO, no por número de ticket: todo fichero de `tests/` que nombre la
// puerta, el estado, el predicado, el portero, la acción o quien produce el PDF — y, un salto más,
// todo test que importe un ayudante que los nombre (un mecanismo puede vivir en dos sitios).
// ⚠️ Es una población de CANDIDATOS, no la tanda: lo que no nombra nada de eso NO se ha corrido.
//
// CONTROLES: a cero (la búsqueda con un nombre derivado que no existe → 0 ficheros; la base sin
// sembrar → 0 caen) y POSITIVOS (el propio guard está en la población; y una siembra RUIDOSA, que
// el guard SÍ caza, tiene que verse en rojo: si no, el corredor es mudo y nada de lo demás vale).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const ESPEJO = path.join(RAIZ, 'dist', `_espejo-1510-${process.pid}`);
const SOLO_BASE = process.argv.includes('--solo-base');
const G = 'tests/scrum205-fallo-de-sellado-no-entrega.test.mjs';
const CONCEPTOS = ['sellarTrasEmision', 'SELLADO_PENDIENTE', 'pendiente_de_sellado', 'puedeProducirDocumento', 'exigirDocumentoEmitible', 'sellado_fallido', 'selladoEstado', 'reintentoSellado', 'ensureInvoicePdf', 'generateInvoicePdf', 'vfEstado', 'sellado_incompleto', 'portonDocumento'];

const SELLADO = 'modules/invoicing/domain/selladoEstado';
const REINTENTO = 'modules/invoicing/domain/reintentoSellado';
const LIB = 'lib/invoicing';
const RUTA = 'modules/system/app/routes/invoicesAdmin.routes';
const ts_ = (m) => `src/${m}.ts`;
const js_ = (m) => `dist/${m}.js`;

// ── las siembras, DECLARADAS ANTES DE CORRER. Cada una: [fichero, ancla (cadena o regex), cambio] ×2 ──
const LL_TS = '      const r = opciones.sellar\n';
const LL_JS = '            const r = opciones.sellar\n';
const R_TS = 'const sellada = (await sellarTrasEmision(invoice, merchant, prisma)).estado === SELLADO_HECHO;';
const R_JS = 'const sellada = (await (0, selladoEstado_1.sellarTrasEmision)(invoice, merchant, prisma_1.prisma)).estado === selladoEstado_1.SELLADO_HECHO;';
const PDF_JS = 'require("../../../lib/invoicing").ensureInvoicePdf';
const SIEMBRAS = [
  { id: 'RUIDO', ciego: null, que: 'CONTROL POSITIVO: el fallo devuelve «sellado», sin comentario (el guard SÍ lo caza)', cambios: [
    [ts_(SELLADO), 'return { estado: SELLADO_PENDIENTE, error: mensaje };', 'return { estado: SELLADO_HECHO };'],
    [js_(SELLADO), 'return { estado: exports.SELLADO_PENDIENTE, error: mensaje };', 'return { estado: exports.SELLADO_HECHO };']] },
  { id: 'C①', ciego: '①', que: 'el fallo devuelve «sellado» y el estado bloqueante sólo queda en un comentario', cambios: [
    [ts_(SELLADO), 'return { estado: SELLADO_PENDIENTE, error: mensaje };', 'return { estado: SELLADO_HECHO }; // antes SELLADO_PENDIENTE'],
    [js_(SELLADO), 'return { estado: exports.SELLADO_PENDIENTE, error: mensaje };', 'return { estado: exports.SELLADO_HECHO }; // antes SELLADO_PENDIENTE']] },
  { id: 'C②', ciego: '②', que: 'el predicado sigue bien, pero quien genera el PDF deja de preguntarle', cambios: [
    [ts_(LIB), 'if (!puedeProducirDocumento(inv.vfEstado)) {', 'if (false) {'],
    [js_(LIB), 'if (!(0, selladoEstado_1.puedeProducirDocumento)(inv.vfEstado)) {', 'if (false) {']] },
  { id: 'C③-reintento', ciego: '③', que: 'el reintento sella por un ALIAS, tira el resultado y entrega el PDF', cambios: [
    [ts_(REINTENTO), LL_TS, `      const puerta = opciones.sellar ?? sellarTrasEmision; await puerta(factura, f.merchant ?? {}, prisma); await ensureInvoicePdf(f.id, prisma);\n${LL_TS}`],
    [js_(REINTENTO), LL_JS, `            const puerta = opciones.sellar ?? selladoEstado_1.sellarTrasEmision; await puerta(factura, f.merchant ?? {}, prisma); await ${PDF_JS}(f.id, prisma);\n${LL_JS}`]] },
  { id: 'C③bis-reintento', ciego: '③bis', que: 'el reintento LEE el resultado, y con «sigue pendiente» entrega el PDF igual', cambios: [
    [ts_(REINTENTO), 'else parte.siguenPendientes.push(nombrada);', 'else { await ensureInvoicePdf(f.id, prisma); parte.siguenPendientes.push(nombrada); }'],
    [js_(REINTENTO), /else\s+parte\.siguenPendientes\.push\(nombrada\);/, `else { await ${PDF_JS}(f.id, prisma); parte.siguenPendientes.push(nombrada); }`]] },
  { id: 'C③-ruta', ciego: '③', que: 'una RUTA de emisión sella por un alias, tira el resultado y entrega el PDF', cambios: [
    [ts_(RUTA), R_TS, 'const puerta = sellarTrasEmision; await puerta(invoice, merchant, prisma); await ensureInvoicePdf(invoice.id, prisma); const sellada = false;'],
    [js_(RUTA), R_JS, 'const puerta = selladoEstado_1.sellarTrasEmision; await puerta(invoice, merchant, prisma_1.prisma); await (0, invoicing_1.ensureInvoicePdf)(invoice.id, prisma_1.prisma); const sellada = false;']] },
  { id: 'C③bis-ruta', ciego: '③bis', que: 'una RUTA de emisión recoge el resultado y entrega el PDF sin mirarlo', cambios: [
    [ts_(RUTA), R_TS, `${R_TS} await ensureInvoicePdf(invoice.id, prisma);`],
    [js_(RUTA), R_JS, `${R_JS} await (0, invoicing_1.ensureInvoicePdf)(invoice.id, prisma_1.prisma);`]] },
];
const TOCADOS = [...new Set(SIEMBRAS.flatMap((s) => s.cambios.map((c) => c[0])))];

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const enRaiz = (r) => path.join(RAIZ, r);
const enEspejo = (r) => path.join(ESPEJO, r);
const veces = (txt, ancla) => (typeof ancla === 'string' ? txt.split(ancla).length - 1 : (txt.match(new RegExp(ancla.source, 'g')) || []).length);

// ── la población, por concepto ──
function poblacion(conceptos) {
  const dir = enRaiz('tests');
  const todos = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs'));
  const texto = new Map(todos.map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
  const nombra = todos.filter((f) => conceptos.some((c) => texto.get(f).includes(c)));
  const ayudantes = nombra.filter((f) => !f.endsWith('.test.mjs'));
  const porAyudante = todos.filter((f) => f.endsWith('.test.mjs') && !nombra.includes(f) && ayudantes.some((a) => texto.get(f).includes(`/${a}'`) || texto.get(f).includes(`/${a}"`)));
  const tests = [...nombra.filter((f) => f.endsWith('.test.mjs')), ...porAyudante].sort().map((f) => `tests/${f}`);
  return { total: todos.filter((f) => f.endsWith('.test.mjs')).length, nombran: nombra.length, ayudantes, porAyudante: porAyudante.length, tests };
}

function correr(test) {
  return new Promise((resolver) => {
    const entorno = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP };
    const h = spawn(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', test], { cwd: ESPEJO, env: entorno });
    let salida = '';
    h.stdout.on('data', (d) => { salida += d; });
    h.stderr.on('data', () => {});
    const reloj = setTimeout(() => h.kill(), 180000);
    h.on('close', (codigo) => {
      clearTimeout(reloj);
      const cuenta = (q) => Number((new RegExp(`^# ${q} (\\d+)`, 'm').exec(salida) || [])[1] ?? NaN);
      // sólo los casos de primer nivel y sus hijos con nombre; la línea del FICHERO (`not ok N - ruta`) no es un caso
      const caidos = [...salida.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]).filter((n) => !n.endsWith('.test.mjs'));
      // qué DICE cada rojo: sin eso no se distingue cazar el punto ciego de tropezar con la siembra
      const lineas = salida.split(/\r?\n/);
      const dice = [];
      lineas.forEach((l, i) => {
        const m = /^\s*not ok \d+ - (.*)$/.exec(l);
        if (!m || m[1].endsWith('.test.mjs')) return;
        const j = lineas.findIndex((x, k) => k > i && k < i + 15 && /^\s*error: /.test(x));
        if (j > 0) dice.push(lineas.slice(j, j + 5).join(' ').replace(/\s+/g, ' ').replace(/^ ?error: (\|- )?/, '').trim().slice(0, 330));
      });
      resolver({ test, codigo, tests: cuenta('tests'), pass: cuenta('pass'), fail: cuenta('fail'), skipped: cuenta('skipped'), caidos, dice });
    });
  });
}
async function tanda(tests, aLaVez = 4) {
  const res = new Array(tests.length);
  let i = 0;
  await Promise.all(Array.from({ length: aLaVez }, async () => { while (i < tests.length) { const k = i; i += 1; res[k] = await correr(tests[k]); } }));
  return res;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
const VIGILADOS = [...TOCADOS, G];
const antes = Object.fromEntries(VIGILADOS.map((r) => [r, sha(enRaiz(r))]));
let mal = 0;
try {
  // ── población y su control a cero ──
  const huella = crypto.createHash('sha256').update(VIGILADOS.map((r) => antes[r]).join('')).digest('hex').slice(0, 10);
  const cero = poblacion([`sellarTrasEmision_${huella}`]);
  const pob = poblacion(CONCEPTOS);
  console.log(`CONTROL A CERO de la búsqueda · «sellarTrasEmision_${huella}» · ficheros de test leídos ${cero.total} · que lo nombran ${cero.tests.length} ${cero.tests.length === 0 && cero.total > 0 ? '(bien)' : '🔴'}`);
  if (cero.tests.length !== 0 || !(cero.total > 0)) mal += 1;
  console.log(`POBLACIÓN · ${pob.total} ficheros *.test.mjs en tests/ · nombran el concepto ${pob.nombran} ficheros (${pob.ayudantes.length} son ayudantes: ${pob.ayudantes.join(', ')}) · tests que llegan sólo por un ayudante ${pob.porAyudante} · CANDIDATOS ${pob.tests.length}`);
  console.log(`POSITIVO de la búsqueda · el propio guard está entre los candidatos: ${pob.tests.includes(G) ? 'sí' : '🔴 NO'}`);
  if (!pob.tests.includes(G)) mal += 1;
  const otros = pob.tests.filter((t) => t !== G);

  // ── el espejo ──
  fs.mkdirSync(ESPEJO, { recursive: true });
  for (const d of ['src', 'tests', 'scripts', 'prisma', 'public', 'docs']) if (fs.existsSync(enRaiz(d))) fs.cpSync(enRaiz(d), enEspejo(d), { recursive: true });
  for (const f of ['package.json', 'tsconfig.json', 'CLAUDE.md', 'DESIGN.md']) if (fs.existsSync(enRaiz(f))) fs.copyFileSync(enRaiz(f), enEspejo(f));
  fs.mkdirSync(enEspejo('dist'));
  for (const e of fs.readdirSync(enRaiz('dist'))) if (!e.startsWith('_espejo-')) fs.cpSync(path.join(RAIZ, 'dist', e), path.join(ESPEJO, 'dist', e), { recursive: true });
  const distintos = VIGILADOS.filter((r) => sha(enEspejo(r)) !== antes[r]);
  console.log(`ESPEJO · ${VIGILADOS.length} ficheros cotejados por sha256 con el árbol · distintos ${distintos.length}`);
  if (distintos.length) { console.log('CIEGO: el espejo no es idéntico'); process.exit(2); }

  // ── la base, sin sembrar ──
  const base = await tanda(pob.tests);
  const deBase = new Map(base.map((r) => [r.test, r]));
  const medibles = base.filter((r) => Number.isFinite(r.tests) && r.tests > 0 && r.fail === 0);
  const noMedibles = base.filter((r) => !medibles.includes(r));
  const suma = (k, l = medibles) => l.reduce((a, r) => a + (Number.isFinite(r[k]) ? r[k] : 0), 0);
  console.log(`\nBASE (sin sembrar) · candidatos ${base.length} · MEDIBLES (corren y 0 caen) ${medibles.length} · casos ${suma('tests')} · pasan ${suma('pass')} · caen ${suma('fail')} · SALTAN ${suma('skipped')}`);
  console.log(`  NO MEDIBLES en el espejo (ya caen o no arrancan sin sembrar nada; NO se juzgan): ${noMedibles.length}`);
  for (const r of noMedibles) console.log(`    · ${r.test} · tests ${r.tests} · fail ${r.fail} · ${r.caidos.slice(0, 2).join(' | ').slice(0, 140)}`);
  const conSaltos = medibles.filter((r) => r.skipped > 0);
  console.log(`  medibles con casos que SALTAN (esos casos no han corrido): ${conSaltos.length}`);
  for (const r of conSaltos) console.log(`    · ${r.test} · saltan ${r.skipped} de ${r.tests}`);
  if (!medibles.some((r) => r.test === G)) { console.log('CIEGO: el guard no es medible en el espejo'); process.exit(2); }

  if (!SOLO_BASE) {
    const aCorrer = medibles.map((r) => r.test);
    console.log(`\nSIEMBRAS · ${SIEMBRAS.length} declaradas · cada una contra ${aCorrer.length} ficheros (${aCorrer.length - 1} que no son el guard)`);
    for (const s of SIEMBRAS) {
      const originales = s.cambios.map(([r]) => fs.readFileSync(enEspejo(r), 'utf8'));
      const casa = s.cambios.map(([, ancla], i) => veces(originales[i], ancla));
      if (casa.some((v) => v !== 1)) { console.log(`\nCIEGA · ${s.id} · el ancla casa ${casa.join('/')} veces`); mal += 1; continue; }
      s.cambios.forEach(([r, ancla, cambio], i) => fs.writeFileSync(enEspejo(r), originales[i].replace(ancla, () => cambio)));
      const res = await tanda(aCorrer);
      s.cambios.forEach(([r], i) => fs.writeFileSync(enEspejo(r), originales[i]));
      const restaurado = s.cambios.every(([r]) => sha(enEspejo(r)) === antes[r]);
      const rotos = res.filter((r) => !Number.isFinite(r.tests) || r.fail > 0 || r.tests !== deBase.get(r.test).tests);
      const guard = res.find((r) => r.test === G);
      const guardCae = rotos.includes(guard);
      const otrosRotos = rotos.filter((r) => r.test !== G);
      console.log(`\n── ${s.id}${s.ciego ? ` · punto ciego ${s.ciego}` : ''} · ${s.que}`);
      console.log(`   corridos ${res.length} ficheros · casos ${suma('tests', res)} · el guard scrum205: ${guardCae ? `CAE (${guard.caidos.join(' | ').slice(0, 120)})` : 'MUDO'} · OTROS ficheros que caen: ${otrosRotos.length} · espejo restaurado: ${restaurado ? 'sí' : '🔴 NO'}`);
      for (const r of otrosRotos) console.log(`     · ${r.test} · tests ${r.tests} (base ${deBase.get(r.test).tests}) · fail ${r.fail}${r.caidos.length ? ` · ${r.caidos.slice(0, 4).join(' | ').slice(0, 260)}` : ' · sin caso nombrado (no arrancó o murió)'}`);
      for (const r of otrosRotos) r.dice.slice(0, 2).forEach((d, i) => console.log(`         dice [${r.test.slice(6, 20)}… caso ${i + 1}]: ${d}`));
      if (!restaurado) mal += 1;
      if (s.id === 'RUIDO' && !guardCae) { console.log('   🔴 EL CORREDOR ES MUDO: la siembra ruidosa no tumba al guard. Nada de lo de abajo vale.'); mal += 1; }
      if (s.ciego && guardCae) { console.log('   ⚠️ SORPRESA: el guard cae en un punto que se declaró ciego'); mal += 1; }
    }
  }
  void otros;
} finally {
  fs.rmSync(ESPEJO, { recursive: true, force: true });
}
const movidos = VIGILADOS.filter((r) => sha(enRaiz(r)) !== antes[r]);
console.log(`\nÁRBOL DE VERDAD · ${VIGILADOS.length} ficheros (fuente, compilado y el guard) con sha256 antes y después · movidos ${movidos.length}${movidos.length ? `: ${movidos.join(', ')}` : ''} · espejo borrado: ${fs.existsSync(ESPEJO) ? 'NO' : 'sí'}`);
if (movidos.length) mal += 1;
console.log(`controles que fallan: ${mal}`);
console.log(`EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
