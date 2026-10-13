// docs/master/evidencias/SCRUM-1520/la-cola-que-cae.mjs — SCRUM-1520 · ¿PUEDE UN VERDE ESCONDER UN ROJO?
//
//     node docs/master/evidencias/SCRUM-1520/la-cola-que-cae.mjs            # las variantes, por el envoltorio
//     node docs/master/evidencias/SCRUM-1520/la-cola-que-cae.mjs --por-npm  # además, tres por `npm test` y bash
//     node docs/master/evidencias/SCRUM-1520/la-cola-que-cae.mjs --sin-siembra  # la prueba del banco: tiene que salir 2
//
// QUÉ MIDE. Siembra un caso que FALLA en la cola de un fichero, hace que esa cola NO LLEGUE al
// padre (`corte-del-informe.mjs`) y lee qué código devuelve la cadena REAL de la tanda:
//     scripts/tanda-con-veredicto.mjs  →  node --test --test-force-exit  →  un hijo por fichero
// con los dos reporters que pone `ci.yml` (`spec` a la salida, `tap` a un fichero).
//
// QUÉ NO MIDE. No reproduce POR QUÉ se pierde la cola en el runner (SCRUM-1405, SCRUM-1339): aquí
// se tira a propósito. Y corre en la máquina de quien lo lanza, no en el runner de Linux.
//
// Sale 0 si el banco pudo medir (diga lo que diga la medida), 2 si alguno de sus controles no
// salió como tiene que salir: entonces la tabla NO VALE y lo dice.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { temporal } from '../../../../tests/_temporal.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../../../..');
const ENVOLTORIO = join(RAIZ, 'scripts', 'tanda-con-veredicto.mjs');
const POR_NPM = process.argv.includes('--por-npm');
// La prueba del propio banco: con --sin-siembra NADIE cae, y el banco tiene que decir CIEGO (salida 2), no verde.
const SIN_SIEMBRA = process.argv.includes('--sin-siembra');

// Las variantes. `cae` es el caso sembrado; `en`/`modo` dicen dónde cae el corte del informe.
const VARIANTES = [
  { id: 'A', que: 'sin corte, sin fallo (control de cero)', cae: '' },
  { id: 'B', que: 'sin corte, cae el 22 (control positivo)', cae: '22' },
  { id: 'C', que: 'cae el 22 · el corte cae ENTRE dos casos (antes de que empiece el 22)', cae: '22', en: 'test:start|caso 22 ', modo: 'antes' },
  { id: 'D', que: 'cae el 21b · el corte cae DENTRO del caso 21 (llega su inicio, no su resultado)', cae: '21b', en: 'test:start|caso 21 ', modo: 'despues' },
  { id: 'E', que: 'cae el 22 · el corte parte en dos el mensaje del fallo', cae: '22', en: 'test:fail|caso 22 ', modo: 'mitad' },
  { id: 'F', que: 'cae el 22 · el fallo llega y se pierde lo de detrás', cae: '22', en: 'test:fail|caso 22 ', modo: 'despues' },
  { id: 'G', que: 'el mismo corte que C, QUITANDO la siembra (no cae nadie)', cae: '', en: 'test:start|caso 22 ', modo: 'antes' },
  { id: 'H', que: 'como C, y además el hijo sale con 0 (se quita la pieza)', cae: '22', en: 'test:start|caso 22 ', modo: 'antes', salida: '0' },
  { id: 'I', que: 'sin corte · el proceso se va con exit(0) en el 21 y el 22 habría caído', cae: '22', saleEn: '21' },
  { id: 'J', que: 'cae el 22 · no llega NADA del informe del fichero', cae: '22', en: 'test:enqueue|caso 01 ', modo: 'antes' },
  { id: 'K', que: 'como I, pero cada caso suelta el bucle: lo anterior al 21 SÍ llega', cae: '22', saleEn: '21', cede: true },
];
const DECLARADOS_COLA = 27; // 01…20, 21, 21a, 21b, 21c, 22, 23, 24
const DECLARADOS_VECINO = 5;

// El temporal se borra al salir el proceso (`temporal()`): el primer empujón lo creaba con
// `mkdtempSync` a pelo y no lo borraba nadie, y lo cazó `scrum864c` en el obligatorio.
const dir = temporal('scrum1520-');
if (/\s/.test(dir)) { console.error(`CIEGO: el temporal lleva un espacio (${dir}) y NODE_OPTIONS no lo admite.`); process.exit(2); }
// Las dos siembras se guardan como `.txt` y sólo son `.mjs` DENTRO del temporal: en el árbol eran
// dos ficheros que registran tests y que `npm test` no ejecuta, y lo cazó `scrum708`.
for (const [origen, destino] of [['siembra-cola.txt', 'siembra-cola.mjs'], ['siembra-vecino.txt', 'siembra-vecino.mjs'], ['corte-del-informe.mjs', 'corte-del-informe.mjs']]) copyFileSync(join(AQUI, origen), join(dir, destino));
const barra = (p) => p.replaceAll('\\', '/');
const CSI = /\u001B\[[0-9;?]*[ -\/]*[@-~]/g;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function entorno(v, sello, capa) {
  const e = { ...process.env };
  // Ni el contexto de un `node --test` de fuera, ni su color, ni sus opciones (SCRUM-1308).
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR', 'NO_COLOR', 'NODE_TEST_WORKER_ID']) delete e[k];
  const tap = barra(join(dir, `${v.id}-${capa}.tap`));
  e.NODE_OPTIONS = `--test-reporter=spec --test-reporter-destination=stdout --test-reporter=tap --test-reporter-destination=${tap} --import=${pathToFileURL(join(dir, 'corte-del-informe.mjs')).href}`;
  e.SIEMBRA_ID = sello;
  e.SIEMBRA_CAE = SIN_SIEMBRA ? '' : (v.cae || '');
  e.SIEMBRA_SALE_EN = v.saleEn || '';
  if (v.cede) e.SIEMBRA_CEDE = '1'; else delete e.SIEMBRA_CEDE;
  e.SIEMBRA_EJECUTADOS = join(dir, `${v.id}-${capa}.ejecutados`);
  e.CORTE_FICHERO = 'siembra-cola.mjs';
  e.CORTE_EN = v.en || '';
  e.CORTE_MODO = v.modo || '';
  e.CORTE_SALIDA = v.salida || '';
  e.CORTE_ACTA = join(dir, `${v.id}-${capa}.acta.json`);
  return e;
}

const leer = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : null);
const cuenta = (texto, re) => (texto.match(re) || []).length;

function medir(v, capa) {
  const sello = createHash('sha1').update(`SCRUM-1520|${v.id}|${capa}`).digest('hex').slice(0, 8);
  const env = entorno(v, sello, capa);
  let r;
  if (capa === 'npm') {
    // La capa de fuera, como la escribe `ci.yml`: `npm test > >(tee …) 2>&1`, sin tubería.
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'scrum1520-siembra', private: true,
      scripts: { test: `node "${barra(ENVOLTORIO)}" node --test --test-force-exit siembra-cola.mjs siembra-vecino.mjs` },
    }));
    r = spawnSync('bash', ['-c', `npm test > >(tee "${v.id}-npm.log") 2>&1`], { cwd: dir, env, encoding: 'utf8', timeout: 180_000 });
    r.stdout = leer(join(dir, `${v.id}-npm.log`)) ?? '';
  } else {
    r = spawnSync(process.execPath, [ENVOLTORIO, 'node', '--test', '--test-force-exit', 'siembra-cola.mjs', 'siembra-vecino.mjs'], { cwd: dir, env, encoding: 'utf8', timeout: 180_000 });
  }
  const spec = String(r.stdout || '').replace(CSI, '');
  // `spec` repite cada caído en su sección final «✖ failing tests:». Los resultados se cuentan
  // ANTES de esa sección: contarlos en todo el log da uno de más por cada rojo (me pasó: B dio 33
  // nombres con resultado sobre 32 tests, y lo cazó el control de la suma).
  const cuerpoSpec = spec.split(/^✖ failing tests:\s*$/m)[0];
  const tap =leer(join(dir, `${v.id}-${capa}.tap`)) ?? '';
  const acta = JSON.parse(leer(join(dir, `${v.id}-${capa}.acta.json`)) ?? 'null');
  const ejecutados = (leer(join(dir, `${v.id}-${capa}.ejecutados`)) ?? '').split('\n').filter(Boolean);
  const num = (clave) => { const m = spec.match(new RegExp(`^ℹ ${clave} (\\d+)`, 'm')); return m ? Number(m[1]) : null; };
  const caso = v.cae ? `caso ${v.cae} de 24 · siembra ${sello}` : null;
  // Anclado AL INICIO del caso: el glifo, y detrás el nombre. Nunca el glifo a secas (SCRUM-1336).
  const enSpec = (glifo, nombre) => new RegExp(`^\\s*${glifo} ${esc(nombre)}( |$)`, 'm').test(spec);
  const enTap = (prefijo, nombre) => new RegExp(`^\\s*${prefijo} \\d+ - ${esc(nombre)}\\s*$`, 'm').test(tap);
  return {
    v, capa, sello,
    salida: r.status, senal: r.signal, errorDeLanzamiento: r.error?.message ?? null,
    tests: num('tests'), pass: num('pass'), fail: num('fail'), cancelled: num('cancelled'),
    conResultadoEnSpec: cuenta(cuerpoSpec, new RegExp(`^\\s*[✔✖] (caso|vecino) \\S+ de \\d+ · siembra ${sello}( |$)`, 'gm')),
    conResultadoEnTap: cuenta(tap, new RegExp(`^\\s*(not ok|ok) \\d+ - (caso|vecino) \\S+ de \\d+ · siembra ${sello}\\s*$`, 'gm')),
    selloVistoEnSpec: cuenta(spec, new RegExp(esc(sello), 'g')),
    selloFalsoVisto: cuenta(spec + tap, new RegExp(esc(`${sello}-no-existe`), 'g')),
    sembradoCaeEnSpec: caso ? enSpec('✖', caso) : null,
    sembradoPasaEnSpec: caso ? enSpec('✔', caso) : null,
    sembradoCaeEnTap: caso ? enTap('not ok', caso) : null,
    ficheroCaeEnSpec: /^\s*✖ .*siembra-cola\.mjs/m.test(spec),
    ficheroCaeEnTap: /^not ok \d+ - .*siembra-cola\.mjs/m.test(tap),
    codigoDelHijoEnTap: (tap.match(/^\s*exitCode: (\d+)/m) || [])[1] ?? null,
    sinVeredicto: /TANDA SIN (VEREDICTO|RESUMEN)/.test(String(r.stderr || '') + spec),
    acta,
    ilegibles: acta ? acta.mensajes.filter((m) => m.tipo === 'ILEGIBLE').length : null,
    primerPerdido: acta ? acta.mensajes.find((m) => m.llega < m.bytes) ?? null : null,
    ejecutados: ejecutados.length,
    sembradoSeEjecuto: v.cae ? ejecutados.includes(v.cae) : null,
    tamanos: { spec: spec.length, tap: tap.length },
  };
}

function dictamen(m) {
  const color = m.salida === 0 ? 'VERDE' : `ROJO (${m.salida})`;
  if (!m.v.cae) return color;
  const ve = m.sembradoCaeEnSpec || m.sembradoCaeEnTap ? 'el caso se ve por NOMBRE'
    : m.ficheroCaeEnSpec || m.ficheroCaeEnTap ? 'sólo se ve que cae el FICHERO' : 'NO se ve nada';
  return `${color} · ${ve}`;
}

function fila(m) {
  const a = m.acta;
  return [
    `── ${m.v.id}${m.capa === 'npm' ? ' (por npm y bash)' : ''} · ${m.v.que}`,
    `   DICTAMEN: ${dictamen(m)}`,
    `   salida de la cadena: ${m.salida}${m.senal ? ` señal ${m.senal}` : ''}${m.errorDeLanzamiento ? ` · NO SE LANZÓ: ${m.errorDeLanzamiento}` : ''}${m.sinVeredicto ? ' · el envoltorio dijo SIN VEREDICTO/RESUMEN' : ''}`,
    `   recuento del padre: tests ${m.tests} · pass ${m.pass} · fail ${m.fail} · cancelled ${m.cancelled}   (declarados: ${DECLARADOS_COLA} + ${DECLARADOS_VECINO} = ${DECLARADOS_COLA + DECLARADOS_VECINO})`,
    `   nombres con resultado: spec ${m.conResultadoEnSpec} · tap ${m.conResultadoEnTap}   · log ${m.tamanos.spec} car., tap ${m.tamanos.tap} car.`,
    m.v.cae
      ? `   el sembrado (${m.v.cae}): se ejecutó ${m.sembradoSeEjecuto ? 'SÍ' : 'NO'} · ✖ en spec ${m.sembradoCaeEnSpec ? 'SÍ' : 'NO'} · ✔ en spec ${m.sembradoPasaEnSpec ? 'SÍ' : 'NO'} · «not ok» en tap ${m.sembradoCaeEnTap ? 'SÍ' : 'NO'}`
      : '   el sembrado: no hay',
    `   el fichero como caído: spec ${m.ficheroCaeEnSpec ? 'SÍ' : 'NO'} · tap ${m.ficheroCaeEnTap ? 'SÍ' : 'NO'}${m.codigoDelHijoEnTap !== null ? ` · exitCode del hijo según el tap: ${m.codigoDelHijoEnTap}` : ''}`,
    a
      ? `   el hijo: código propio ${a.codigoPropio}${a.forzadoACero ? ' → FORZADO a 0' : ''} · mensajes ${a.mensajes.length} (ilegibles ${m.ilegibles}) · entregó ${a.entregados} B · perdió ${a.perdidos} B${m.primerPerdido ? ` · primer mensaje perdido: ${m.primerPerdido.tipo} «${m.primerPerdido.nombre}»${m.primerPerdido.llega ? ` (llegan ${m.primerPerdido.llega} de ${m.primerPerdido.bytes} B)` : ''}` : ''}`
      : '   el hijo: SIN ACTA (no llegó a su «exit» o no se cargó la precarga)',
    `   cuerpos que empezaron a correr: ${m.ejecutados} de ${DECLARADOS_COLA}`,
  ].join('\n');
}

console.log(`SCRUM-1520 · la cola que cae · node ${process.version} en ${process.platform} · raíz ${barra(RAIZ)}`);
console.log(`cadena: tanda-con-veredicto.mjs → node --test --test-force-exit → hijo por fichero · temporal ${barra(dir)}\n`);

const medidas = VARIANTES.map((v) => medir(v, 'envoltorio'));
for (const m of medidas) console.log(`${fila(m)}\n`);

const porNpm = POR_NPM ? VARIANTES.filter((v) => ['A', 'B', 'C'].includes(v.id)).map((v) => medir(v, 'npm')) : [];
for (const m of porNpm) console.log(`${fila(m)}\n`);

// ── LOS CONTROLES DEL BANCO. Si uno no sale, la tabla de arriba no vale. ────────────────────
const de = (id, lista = medidas) => lista.find((m) => m.v.id === id);
const TOTAL = DECLARADOS_COLA + DECLARADOS_VECINO;
const controles = [];
const control = (nombre, vale, dato) => controles.push({ nombre, vale: Boolean(vale), dato });
const A = de('A'); const B = de('B'); const G = de('G');
control('cero · A sale 0 con los 32 declarados y ninguno caído', A.salida === 0 && A.tests === TOTAL && A.pass === TOTAL && A.fail === 0, `salida ${A.salida}, tests ${A.tests}, pass ${A.pass}, fail ${A.fail}`);
control('positivo · B sale distinto de 0 y el sembrado se ve ✖ por nombre en los DOS reporters', B.salida !== 0 && B.sembradoCaeEnSpec && B.sembradoCaeEnTap && B.fail === 1, `salida ${B.salida}, spec ${B.sembradoCaeEnSpec}, tap ${B.sembradoCaeEnTap}, fail ${B.fail}`);
control('la suma cuadra en A y en B: pass + fail = tests = nombres con resultado', [A, B].every((m) => m.pass + m.fail === m.tests && m.conResultadoEnSpec === m.tests && m.conResultadoEnTap === m.tests), `A ${A.conResultadoEnSpec}/${A.conResultadoEnTap}/${A.tests} · B ${B.conResultadoEnSpec}/${B.conResultadoEnTap}/${B.tests}`);
control('el sello se ve y el sello falso no', medidas.every((m) => m.selloFalsoVisto === 0) && A.selloVistoEnSpec > 0, `visto en A ${A.selloVistoEnSpec} veces · falso ${medidas.reduce((s, m) => s + m.selloFalsoVisto, 0)}`);
control('el lector del informe entiende todos los mensajes (0 ilegibles) y hay acta en todas', medidas.every((m) => m.acta && m.ilegibles === 0), medidas.map((m) => `${m.v.id}:${m.acta ? m.ilegibles : 'SIN ACTA'}`).join(' '));
control('el corte actuó donde se pidió y sólo donde se pidió', medidas.every((m) => m.acta && (m.v.en ? m.acta.cortado && m.acta.perdidos > 0 : !m.acta.cortado && m.acta.perdidos === 0)), medidas.map((m) => `${m.v.id}:${m.acta ? m.acta.perdidos : '?'}`).join(' '));
control('el corte de G reproduce la firma del CI: VERDE, sin entrada de fichero y con menos tests', G.salida === 0 && !G.ficheroCaeEnSpec && G.tests !== null && G.tests < TOTAL, `salida ${G.salida}, tests ${G.tests} de ${TOTAL}, fichero caído ${G.ficheroCaeEnSpec}`);
if (POR_NPM) {
  control('por npm y bash: A y B dan lo mismo que por el envoltorio', de('A', porNpm).salida === 0 && de('B', porNpm).salida !== 0 && de('B', porNpm).sembradoCaeEnSpec, `A ${de('A', porNpm).salida} · B ${de('B', porNpm).salida}`);
}

console.log('CONTROLES DEL BANCO');
for (const c of controles) console.log(`   ${c.vale ? 'vale ' : 'NO VALE'} · ${c.nombre} — ${c.dato}`);
const rotos = controles.filter((c) => !c.vale).length;

console.log('\nRESUMEN (una línea por variante)');
for (const m of [...medidas, ...porNpm]) console.log(`   ${m.v.id}${m.capa === 'npm' ? '-npm' : '    '} ${dictamen(m).padEnd(46)} ${m.v.que}`);

if (rotos) { console.log(`\nCIEGO: ${rotos} control(es) del banco no salieron. La tabla NO VALE.`); process.exit(2); }
console.log(`\nEl banco midió: ${controles.length} controles de ${controles.length}.`);
