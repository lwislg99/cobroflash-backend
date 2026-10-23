// docs/master/evidencias/SCRUM-1560f/c-mutar.mjs — SCRUM-1560f · ¿DISTINGUE CADA CONSUMIDOR «NADA CORTO» DE «NADA QUE MIRAR»?
//
// No se lee: se MIDE. Por cada par (consumidor, vista que monta) se vacía la vista —un `return;` como
// primera sentencia de su función en `public/dashboard/js/`, localizada por AST— y se corre el
// consumidor. Si sigue en verde, da por buena una pantalla que no pintó nada: NO DISTINGUE. Si cae
// algún caso, DISTINGUE, y se nombra el caso.
//
// POBLACIÓN: los 7 tests VIVOS que importan `datosDelCenso` (salida de `a-poblacion.mjs`) y las vistas
// que montan. Los que la RECORREN entera (1560) se mutan en 3 vistas (Trabajos, Configuración,
// Cobros), y se dice. El censo táctil y las 6 sondas de evidencias NO se corren aquí: el censo va en
// navegador (d-censo-tactil.mjs) y las sondas son de un solo uso.
//
// CONTROLES, antes de dar ningún veredicto:
//   ① la mutación TIENE QUE vaciar la vista: con ella puesta, el banco la monta y cuenta ≤ 1 nodo; sin
//      ella, más de 5. Si no, ese par sale CIEGO («la mutación no vació la vista»).
//   ② la línea base (sin mutar) del consumidor tiene que estar en VERDE; si no, ese par sale CIEGO.
//   ③ dos consumidores SINTÉTICOS (escritos en un temporal de fuera del árbol) sobre la misma vista:
//      «mira-primero» exige nodos > 0 antes de buscar cortos, «no-mira» sólo busca cortos. El primero
//      tiene que salir DISTINGUE y el segundo NO DISTINGUE; si no, el instrumento entero sale CIEGO.
// Se restaura en un `finally` y, además, un CENTINELA en el temporal del sistema dice al arrancar si
// la vez anterior murió con una mutación puesta (y con qué fichero), y se niega a seguir.
//
//   node docs/master/evidencias/SCRUM-1560f/c-mutar.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const JS = path.join(RAIZ, 'public/dashboard/js');
const CENTINELA = path.join(os.tmpdir(), 'scrum1560f-mutacion-puesta.json');

if (fs.existsSync(CENTINELA)) {
  console.log(`CIEGO · la vez anterior murió con una mutación puesta: ${fs.readFileSync(CENTINELA, 'utf8')}\n  restaura con git y borra ${CENTINELA}`);
  process.exit(2);
}
if (execFileSync('git', ['status', '--porcelain', '--', 'public'], { cwd: RAIZ, encoding: 'utf8' }).trim()) {
  console.log('CIEGO · `public/` tiene cambios sin comitear: restaurar desde disco se los llevaría.');
  process.exit(2);
}

/** Dónde vive `fn` y en qué posición abre su cuerpo. */
function localizar(fn) {
  for (const f of fs.readdirSync(JS).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(JS, f), 'utf8');
    if (!src.includes(fn)) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    let pos = null;
    const visita = (n) => {
      if (pos !== null) return;
      if (ts.isFunctionDeclaration(n) && n.name?.text === fn && n.body) pos = n.body.getStart(sf) + 1;
      else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === fn && n.initializer
        && (ts.isFunctionExpression(n.initializer) || ts.isArrowFunction(n.initializer)) && ts.isBlock(n.initializer.body)) pos = n.initializer.body.getStart(sf) + 1;
      else ts.forEachChild(n, visita);
    };
    visita(sf);
    if (pos !== null) return { fichero: path.join(JS, f), src, pos };
  }
  return null;
}

async function nodosDe(fn) {
  // Banco fresco en un hijo: el banco cachea los scripts del dashboard en el proceso.
  const guion = `
    const { cargarDashboard, pintarVista, todos } = await import(${JSON.stringify(pathToFileURL(path.join(RAIZ, 'tests/_banco-vistas.mjs')).href)});
    const { datosDelCenso, ARGUMENTOS_DEL_CENSO } = await import(${JSON.stringify(pathToFileURL(path.join(RAIZ, 'scripts/_datos-del-censo.mjs')).href)});
    const dc = datosDelCenso(); dc.enVista(${JSON.stringify(fn)});
    const r = await pintarVista(cargarDashboard(${JSON.stringify(RAIZ)}, { datos: dc.datos }), ${JSON.stringify(fn)}, ...(ARGUMENTOS_DEL_CENSO[${JSON.stringify(fn)}] || []));
    for (let i = 0; i < 6; i++) await new Promise((res) => setImmediate(res));
    console.log('NODOS=' + (r.error ? 'ERROR' : todos(r.contenedor).length - 1));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', guion], { cwd: RAIZ, encoding: 'utf8', timeout: 120000 });
  const m = /NODOS=(\S+)/.exec(r.stdout || '');
  return m ? (m[1] === 'ERROR' ? NaN : Number(m[1])) : NaN;
}

function correr(fichero) {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', fichero], { cwd: RAIZ, encoding: 'utf8', timeout: 300000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const n = (k) => Number((new RegExp(`ℹ ${k} (\\d+)`).exec(out) || [])[1] ?? NaN);
  const caidos = [...new Set(out.split('\n').filter((l) => /^\s*✖ /.test(l) && !/failing tests/.test(l)).map((l) => l.replace(/^\s*✖ /, '').replace(/ \([\d.]+m?s\)\s*$/, '').trim()))];
  return { codigo: r.status, pasan: n('pass'), fallan: n('fail'), caidos };
}

async function medir(consumidor, fn) {
  const base = correr(consumidor);
  if (base.codigo !== 0 || !(base.pasan > 0)) return { consumidor, fn, veredicto: 'CIEGO', motivo: `línea base no verde (${base.pasan} pass · ${base.fallan} fail)` };
  const sinMutar = await nodosDe(fn);
  let conM = NaN;
  let mut = null;
  const l = localizar(fn);
  if (!l) return { consumidor, fn, veredicto: 'CIEGO', motivo: 'función no localizada' };
  fs.writeFileSync(CENTINELA, JSON.stringify({ fn, fichero: path.relative(RAIZ, l.fichero) }));
  try {
    fs.writeFileSync(l.fichero, l.src.slice(0, l.pos) + ' return; ' + l.src.slice(l.pos));
    conM = await nodosDe(fn);
    mut = correr(consumidor);
  } finally {
    fs.writeFileSync(l.fichero, l.src);
    if (fs.readFileSync(l.fichero, 'utf8') === l.src) fs.rmSync(CENTINELA, { force: true });
  }
  if (!(sinMutar > 5) || !(conM <= 1)) return { consumidor, fn, veredicto: 'CIEGO', motivo: `la mutación no vació la vista (${sinMutar} → ${conM} nodos)` };
  return { consumidor, fn, nodos: `${sinMutar} → ${conM}`, base: `${base.pasan}/${base.pasan + base.fallan}`,
    veredicto: mut.fallan > 0 ? 'DISTINGUE' : 'NO DISTINGUE', caidos: mut.caidos, mut: `${mut.pasan} pass · ${mut.fallan} fail` };
}

// ── ③ los dos sintéticos ────────────────────────────────────────────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1560f-'));
const sintetico = (mira) => `
import test from 'node:test';
import assert from 'node:assert/strict';
const { cargarDashboard, pintarVista, todos } = await import(${JSON.stringify(pathToFileURL(path.join(RAIZ, 'tests/_banco-vistas.mjs')).href)});
const { datosDelCenso, ARGUMENTOS_DEL_CENSO } = await import(${JSON.stringify(pathToFileURL(path.join(RAIZ, 'scripts/_datos-del-censo.mjs')).href)});
test('${mira ? 'mira-primero' : 'no-mira'} · ningún botón sin texto en Cobros', async () => {
  const dc = datosDelCenso(); dc.enVista('renderCobrosView');
  const r = await pintarVista(cargarDashboard(${JSON.stringify(RAIZ)}, { datos: dc.datos }), 'renderCobrosView', ...(ARGUMENTOS_DEL_CENSO.renderCobrosView || []));
  for (let i = 0; i < 6; i++) await new Promise((res) => setImmediate(res));
  const ns = todos(r.contenedor).slice(1);
  ${mira ? "assert.ok(ns.length > 0, 'CIEGO: la vista no pintó nada');" : ''}
  assert.deepEqual(ns.filter((n) => n.tagName === 'BUTTON' && n.className === '__nunca__'), []);
});
`;
const MIRA = path.join(TMP, 'mira-primero.test.mjs');
const NO_MIRA = path.join(TMP, 'no-mira.test.mjs');
fs.writeFileSync(MIRA, sintetico(true));
fs.writeFileSync(NO_MIRA, sintetico(false));

const PARES = [
  ['tests/scrum1583-enlace-documento-cobros-44.test.mjs', 'renderCobrosView'],
  ['tests/scrum1562d-trabajos-con-teclado.test.mjs', 'renderJobsView'],
  ['tests/scrum1562f-ver-detalle-fuera-de-acciones.test.mjs', 'renderJobsView'],
  ['tests/scrum1562c-partes-oficina-con-teclado.test.mjs', 'renderPartesOficinaView'],
  ['tests/scrum1559j-productos-44px.test.mjs', 'renderProductsView'],
  ['tests/scrum1559g-dieciseis-controles-44px.test.mjs', 'renderHomeView'],
  ['tests/scrum1559g-dieciseis-controles-44px.test.mjs', 'renderQuoteDetailView'],
  ['tests/scrum1559g-dieciseis-controles-44px.test.mjs', 'renderQuoteRequestsView'],
  ['tests/scrum1559g-dieciseis-controles-44px.test.mjs', 'renderAlbaranesView'],
  ['tests/scrum1560-datos-de-muestra-con-forma.test.mjs', 'renderJobsView'],
  ['tests/scrum1560-datos-de-muestra-con-forma.test.mjs', 'renderSettingsView'],
  ['tests/scrum1560-datos-de-muestra-con-forma.test.mjs', 'renderCobrosView'],
];

try {
  const cMira = await medir(MIRA, 'renderCobrosView');
  const cNoMira = await medir(NO_MIRA, 'renderCobrosView');
  console.log(`CONTROL ③ · mira-primero: ${cMira.veredicto} (${cMira.nodos ?? cMira.motivo}) · no-mira: ${cNoMira.veredicto} (${cNoMira.nodos ?? cNoMira.motivo})`);
  if (cMira.veredicto !== 'DISTINGUE' || cNoMira.veredicto !== 'NO DISTINGUE') {
    console.log('CIEGO · el instrumento no separa a un consumidor que mira de uno que no: no doy veredictos.');
    process.exitCode = 2;
  } else {
    console.log(`\nPOBLACIÓN · ${PARES.length} pares (consumidor, vista) de ${new Set(PARES.map((p) => p[0])).size} tests vivos\n`);
    let ciegos = 0;
    for (const [c, fn] of PARES) {
      const r = await medir(path.join(RAIZ, c), fn);
      if (r.veredicto === 'CIEGO') ciegos++;
      console.log(`${r.veredicto.padEnd(13)} ${path.basename(c)} · ${fn}${r.nodos ? ` · nodos ${r.nodos} · base ${r.base} · mutado ${r.mut}` : ` · ${r.motivo}`}`);
      if (r.caidos?.length) for (const k of r.caidos.slice(0, 4)) console.log(`                caído: ${k.slice(0, 150)}`);
    }
    if (ciegos) process.exitCode = 2;
  }
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
  const sucio = execFileSync('git', ['status', '--porcelain', '--', 'public'], { cwd: RAIZ, encoding: 'utf8' }).trim();
  console.log(`\npublic/ al acabar: ${sucio ? 'SUCIO → ' + sucio : 'limpio'}`);
}
