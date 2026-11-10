// docs/master/evidencias/SCRUM-1510/limites-de-la-cabecera-205.mjs — SCRUM-1510c
//
// LOS LÍMITES QUE LA CABECERA NUEVA DE `tests/scrum205-fallo-de-sellado-no-entrega.test.mjs` DECLARA
// y que NO medía ya `docs/master/evidencias/SCRUM-1404/censo-scrum205-por-efecto.mjs` (ése mide los
// cuatro del ticket: A3, B3, C3 y C4). Cada uno sale de LEER una línea del test; aquí se ve por efecto.
//
// 🔴 Ni el test ni el camino de emisión se tocan: se muta un ESPEJO (`src/` + el test) dentro de
// `dist/`, que git ignora y desde donde node encuentra `node_modules`. El test del espejo es idéntico
// por sha256 al del árbol, y lee SU `src/` porque calcula la raíz desde su propia carpeta.
//
//   node docs/master/evidencias/SCRUM-1510/limites-de-la-cabecera-205.mjs     (con `dist/` presente)
//
// Cada mutación declara ANTES de correr qué caso tiene que caer y qué tiene que nombrar su mensaje
// (o `espera: null` = MUDA, un límite que se quiere enseñar). Las dos primeras son las SIEMBRAS
// POSITIVAS: la misma mutación sin el truco tiene que caer; si no cae, el espejo no mide nada.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const ESPEJO = path.join(RAIZ, 'dist', `_espejo-1510c-${process.pid}`);
const G = 'tests/scrum205-fallo-de-sellado-no-entrega.test.mjs';
const SELLADO = 'src/modules/invoicing/domain/selladoEstado.ts';
const REINTENTO = 'src/modules/invoicing/domain/reintentoSellado.ts';
const AYUDANTE = 'src/modules/invoicing/domain/_sellar-sin-mirar-1510c.ts';
const QUOTES = 'src/modules/quotes/app/routes/quotes.routes.ts';

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const enRaiz = (r) => path.join(RAIZ, r);
const enEspejo = (r) => path.join(ESPEJO, r);
// Si el proceso muere a mitad, el espejo se borra igual (SCRUM-864c: ningún temporal sin borrarse).
process.on('exit', () => { try { fs.rmSync(ESPEJO, { recursive: true, force: true }); } catch {} });

const RETURN_PENDIENTE = 'return { estado: SELLADO_PENDIENTE, error: mensaje };';
const LLAMADA = '      const r = opciones.sellar\n';
const SELLA_Y_TIRA = '      await sellarTrasEmision(factura, f.merchant ?? {}, prisma);';

// [id, qué, cambios [[fichero, ancla|null, cambio]], espera, nombra, noNombra]
// ancla null = fichero NUEVO en el espejo con ese contenido.
const MUTACIONES = [
  { id: 'S1', que: 'SIEMBRA POSITIVA de L1: el fallo devuelve «sellado» (= A1 de SCRUM-1404)',
    cambios: [[SELLADO, RETURN_PENDIENTE, 'return { estado: SELLADO_HECHO };']],
    espera: '① un `sellado_fallido` registrado', nombra: 'selladoEstado.ts:' },
  { id: 'S2', que: 'SIEMBRA POSITIVA de L2 y L4: el reintento sella, tira el resultado y entrega (= C1)',
    cambios: [[REINTENTO, LLAMADA, `${SELLA_Y_TIRA} await ensureInvoicePdf(f.id);\n${LLAMADA}`]],
    espera: '③ ningún llamador descarta', nombra: 'ALGUIEN SELLA' },
  { id: 'L1', que: 'LÍMITE: como S1, con un `throw` en OTRA rama que nunca se ejecuta',
    cambios: [[SELLADO, RETURN_PENDIENTE, "if (mensaje === 'nunca') throw new Error(mensaje); return { estado: SELLADO_HECHO };"]],
    espera: null },
  { id: 'L2', que: 'LÍMITE: como S2, preguntando al portero DESPUÉS de entregar y sin leer su respuesta',
    cambios: [[REINTENTO, LLAMADA, `${SELLA_Y_TIRA} await ensureInvoicePdf(f.id); puedeProducirDocumento('x');\n${LLAMADA}`]],
    espera: null },
  // L3: la primera pasada la declaró MUDA y salió SORPRESA (`salida-limites-de-la-cabecera-205-primera-pasada.txt`):
  // la regla no ve el productor, pero la llamada que tira el resultado sin «producir» suma al TOPE.
  { id: 'L3', que: 'como S2, entregando con un productor fuera de la lista de tres nombres: la regla no lo ve, lo caza el TOPE',
    cambios: [[REINTENTO, LLAMADA, `${SELLA_Y_TIRA} await escribirOtroPdf(f.id);\n${LLAMADA}`]],
    espera: '③ ningún llamador descarta', nombra: 'RATCHET', noNombra: 'ALGUIEN SELLA' },
  { id: 'L4', que: 'UN PISO MÁS ARRIBA: un ayudante sella y tira; quien lo llama entrega. Lo caza el TOPE, no la regla',
    cambios: [
      [AYUDANTE, null, "import { sellarTrasEmision } from './selladoEstado';\nexport async function sellarSinMirar(f: any, m: any, p: any) {\n  await sellarTrasEmision(f, m, p);\n}\n"],
      [REINTENTO, LLAMADA, `      await sellarSinMirar(factura, f.merchant ?? {}, prisma); await ensureInvoicePdf(f.id);\n${LLAMADA}`],
    ],
    espera: '③ ningún llamador descarta', nombra: 'RATCHET', noNombra: 'ALGUIEN SELLA' },
  { id: 'L5', que: 'LÍMITE: L4, y a la vez uno de los dos descartes de hoy pasa a recoger el valor: el tope CUENTA, no compara conjuntos',
    cambios: [
      [AYUDANTE, null, "import { sellarTrasEmision } from './selladoEstado';\nexport async function sellarSinMirar(f: any, m: any, p: any) {\n  await sellarTrasEmision(f, m, p);\n}\n"],
      [REINTENTO, LLAMADA, `      await sellarSinMirar(factura, f.merchant ?? {}, prisma); await ensureInvoicePdf(f.id);\n${LLAMADA}`],
      [QUOTES, 'if (invoice) await sellarTrasEmision(invoice, quote.merchant, prisma);', 'if (invoice) { const _r = await sellarTrasEmision(invoice, quote.merchant, prisma); }'],
    ],
    espera: null },
];

function montar() {
  fs.mkdirSync(ESPEJO, { recursive: true });
  fs.cpSync(enRaiz('src'), enEspejo('src'), { recursive: true });
  fs.mkdirSync(enEspejo('tests'));
  fs.copyFileSync(enRaiz(G), enEspejo(G));
}
function correr() {
  const entorno = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP };
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', G], { cwd: ESPEJO, env: entorno, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const salida = r.stdout || '';
  const cuenta = (q) => Number((new RegExp(`^# ${q} (\\d+)`, 'm').exec(salida) || [])[1] ?? NaN);
  const caidos = [...salida.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { tests: cuenta('tests'), pass: cuenta('pass'), fail: cuenta('fail'), caidos, salida };
}

const antes = { g: sha(enRaiz(G)), sellado: sha(enRaiz(SELLADO)), reintento: sha(enRaiz(REINTENTO)), quotes: sha(enRaiz(QUOTES)) };
let sorpresas = 0;
let ciegas = 0;
try {
  montar();
  const distintos = [G, SELLADO, REINTENTO].filter((r) => sha(enRaiz(r)) !== sha(enEspejo(r)));
  console.log(`ESPEJO: 3 ficheros cotejados por sha256 con el árbol · distintos ${distintos.length}`);
  if (distintos.length) { console.log('CIEGO: el espejo no es idéntico al árbol'); process.exit(2); }
  const base = correr();
  console.log(`BASE · ${G} · tests ${base.tests} · pass ${base.pass} · fail ${base.fail}`);
  if (!(base.tests > 0) || base.fail !== 0 || base.pass + base.fail !== base.tests) { console.log('CIEGO: la base no sale limpia'); process.exit(2); }

  console.log(`\nPOBLACION=${MUTACIONES.length} mutaciones declaradas (2 siembras positivas + 5 límites)`);
  for (const m of MUTACIONES) {
    const originales = m.cambios.map(([r, ancla]) => (ancla === null ? null : fs.readFileSync(enEspejo(r), 'utf8')));
    const veces = m.cambios.map(([, ancla], i) => (ancla === null ? (fs.existsSync(enEspejo(m.cambios[i][0])) ? 0 : 1) : originales[i].split(ancla).length - 1));
    if (veces.some((v) => v !== 1)) { console.log(`CIEGA    · ${m.id} · ${m.que} · el ancla casa ${veces.join('/')} veces`); ciegas += 1; continue; }
    m.cambios.forEach(([r, ancla, cambio], i) => fs.writeFileSync(enEspejo(r), ancla === null ? cambio : originales[i].replace(ancla, cambio)));
    const r = correr();
    m.cambios.forEach(([r2, ancla], i) => (ancla === null ? fs.rmSync(enEspejo(r2)) : fs.writeFileSync(enEspejo(r2), originales[i])));
    let veredicto;
    if (!Number.isFinite(r.tests) || r.pass + r.fail !== r.tests) veredicto = 'CIEGA   ';
    else if (m.espera === null) veredicto = r.fail === 0 ? 'ACIERTA ' : 'SORPRESA';
    else {
      const cae = r.caidos.some((c) => c.includes(m.espera));
      const nombra = !m.nombra || r.salida.includes(m.nombra);
      const noNombra = !m.noNombra || !r.salida.includes(m.noNombra);
      veredicto = cae && nombra && noNombra && r.fail === 1 ? 'ACIERTA ' : 'SORPRESA';
    }
    if (veredicto === 'SORPRESA') sorpresas += 1;
    if (veredicto === 'CIEGA   ') ciegas += 1;
    const visto = r.fail === 0 ? 'MUDA: no cae nada' : `caen ${r.fail}: ${r.caidos.join(' | ')}`;
    console.log(`${veredicto} · ${m.id} · ${m.que}\n           esperaba: ${m.espera === null ? 'MUDA' : `que caiga «${m.espera}» nombrando «${m.nombra}»${m.noNombra ? ` y NO «${m.noNombra}»` : ''}, y sólo ése`}\n           visto (${r.tests} casos · pass ${r.pass} · fail ${r.fail}): ${visto}`);
  }
  const restaurado = [G, SELLADO, REINTENTO, QUOTES].every((r) => sha(enRaiz(r)) === sha(enEspejo(r))) && !fs.existsSync(enEspejo(AYUDANTE));
  console.log(`\nespejo restaurado tras las mutaciones: ${restaurado ? 'sí' : 'NO'}`);
  if (!restaurado) sorpresas += 1;
} finally {
  fs.rmSync(ESPEJO, { recursive: true, force: true });
}
const despues = { g: sha(enRaiz(G)), sellado: sha(enRaiz(SELLADO)), reintento: sha(enRaiz(REINTENTO)), quotes: sha(enRaiz(QUOTES)) };
const movidos = Object.keys(antes).filter((k) => antes[k] !== despues[k]);
console.log(`ÁRBOL DE VERDAD: ${Object.keys(antes).length} ficheros con sha256 antes y después · movidos ${movidos.length} · espejo borrado: ${fs.existsSync(ESPEJO) ? 'NO' : 'sí'}`);
console.log(`sorpresas ${sorpresas} · ciegas ${ciegas}`);
const mal = sorpresas + ciegas + movidos.length;
console.log(`EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
