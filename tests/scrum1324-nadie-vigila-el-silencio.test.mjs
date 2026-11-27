// tests/scrum1324-nadie-vigila-el-silencio.test.mjs — SCRUM-1324
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA RED QUE SÍ CORRE SIEMPRE de `scripts/vigia-silencio-de-main.mjs`. Aquí NO se toca la red.
//
// El vigía lee GitHub, así que vive fuera de `npm test`. Lo que se ejercita aquí es su parte PURA
// —`veredicto` y los tres `umbral…`— contra el HISTORIAL REAL de `main`, recogido de la API y
// recortado (no editado) por `docs/master/evidencias/SCRUM-1324/reducir.mjs`. Vive en `tests/fixtures/`.
// SCRUM-1534b (decisión del fundador, SCRUM-1534 c.22933): el fixture es el de la ventana del
// 2026-11-16 al 2026-11-27 (tomado a las 13:50Z con origin/main en eafe4fda2); el de 1324, del 20-sep
// al 1-oct, se guarda tal cual en `docs/master/evidencias/SCRUM-1534/historial-main-viejo.jsonl`
// y el caso ② lo sigue derivando como control.
//
// ── EL ROJO PRIMERO, Y NO ESTÁ FABRICADO ───────────────────────────────────────────────────
// El 2026-11-24 a las 03:29:35Z (run de `3c6c651f`) el trinquete se quedó rojo en `main`: diez
// ejecuciones seguidas hasta las 15:36:55Z. El caso ③ pone al vigía en esos instantes, con los
// datos de entonces, y exige que dispare con el segundo rojo — y que antes NO.
//
// ── LO QUE SÍ ESTÁ CONSTRUIDO, Y SE DICE ───────────────────────────────────────────────────
// El SILENCIO de un job (⑤) no tiene caso real en la ventana: ningún job desapareció. Se
// construye quitando el job de los últimos runs REALES, que es lo que dejaría borrarlo del
// workflow. Los bordes salen de la constante (umbral − 1 no avisa, umbral sí), no de un literal.
//
// ⚠️ Lo que este fichero NO puede vigilar: que GitHub siga contestando con esta forma, y que el
// vigía se llegue a ejecutar. Este modo (rachas) no lo lanza nada (enchufarlo toca un workflow:
// decisión del fundador, registrada en `docs/master/SCRUM-1324.md`).
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  leerHistorial, veredicto, serieDe, rachasRojas, huecosSinEjecutar, commitsSinRun, sueloDelVigia, informe,
  umbralDeRojos, umbralDeRunsSinEjecutar, umbralDeHorasDeCron,
  JOBS_DE_MAIN, UMBRAL_ROJOS_SEGUIDOS, UMBRAL_RUNS_SIN_EJECUTAR, UMBRAL_HORAS_DE_CRON,
  MINIMO_ROJOS_DE_CRON, AVISOS_FALSOS_AL_MES, SALIDA_OK, SALIDA_AVISO, SALIDA_CIEGO,
} from '../scripts/vigia-silencio-de-main.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HISTORIAL = leerHistorial(fs.readFileSync(path.join(AQUI, 'fixtures', 'scrum1324-historial-main.jsonl'), 'utf8'));
const RUNS = HISTORIAL.runs;

// El fixture de SCRUM-1324, sin tocar: el control de que la derivación sigue dando lo que dio.
const VIEJO = leerHistorial(fs.readFileSync(path.join(AQUI, '..', 'docs', 'master', 'evidencias', 'SCRUM-1534', 'historial-main-viejo.jsonl'), 'utf8')).runs;

// Los dos checks obligatorios de `main`, leídos de `rules/branches/main` el 2026-11-27 (el 1-oct era uno).
const OBLIGATORIO = 'build + tests (con banco desechable)';
const META = 'meta-guard · los guards caen cuando deben';
const PARTE_3 = 'meta-guard · parte 3 de 3';
const NAVEGADOR = 'guards de navegador (fuera de la tanda)';
const TRINQUETE = 'trinquete · ningún test nuevo mide la zona de la máquina';
const OBLIGATORIOS = [OBLIGATORIO, NAVEGADOR];
const CRON_ATASCADOS = 'Vigía de PR atascados';
const CRON_DESPLIEGUE = 'Vigía del despliegue';

const mirar = (ahora, extra = {}) => veredicto({ runs: RUNS, ahora, obligatorios: OBLIGATORIOS, ...extra });
const fila = (v, job) => v.filas.find((f) => f.job === job);
// Dos workflows tienen un job que se llama «vigilar»: un cron se busca por su workflow.
const filaDe = (v, workflow) => v.filas.find((f) => f.workflow === workflow);
const nombres = (lista) => lista.map((f) => `${f.estado} · ${f.workflow} / ${f.job}`).sort();
const masHoras = (iso, h) => new Date(Date.parse(iso) + h * 3600000).toISOString();

// SCRUM-1765a · las quince mutaciones que aplicaba `docs/master/evidencias/SCRUM-1324/mutar.mjs`
// (retirado el 18-nov-2026), aquí para que las repita el meta-guard. Mismo `de` y mismo `a` que el
// guion; el `cae` es el caso que el guion vio caer (su salida sigue en `evidencias/SCRUM-1324/mutaciones.txt`).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // M01 · umbral de rojos 2 → 1 (SCRUM-1534b: era 5 → 4 con el fixture de 1324)
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: 'export const UMBRAL_ROJOS_SEGUIDOS = 2;',
    a: 'export const UMBRAL_ROJOS_SEGUIDOS = 1;',
    cae: '② los tres umbrales no se eligen',
  },
  {
    // M02 · umbral de rojos 2 → 3 (era 5 → 6)
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: 'export const UMBRAL_ROJOS_SEGUIDOS = 2;',
    a: 'export const UMBRAL_ROJOS_SEGUIDOS = 3;',
    cae: '② los tres umbrales no se eligen',
  },
  {
    // M03 · umbral de runs sin ejecutar 12 → 13 (era 22 → 23)
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: 'export const UMBRAL_RUNS_SIN_EJECUTAR = 12;',
    a: 'export const UMBRAL_RUNS_SIN_EJECUTAR = 13;',
    cae: '② los tres umbrales no se eligen',
  },
  {
    // M04 · umbral de horas de cron 28 → 29 (era 10 → 11)
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: 'export const UMBRAL_HORAS_DE_CRON = 28;',
    a: 'export const UMBRAL_HORAS_DE_CRON = 29;',
    cae: '② los tres umbrales no se eligen',
  },
  {
    // M05 · el rojo del obligatorio vuelve a callar (SCRUM-1534a le dio la vuelta: hasta el 27-nov la
    // mutación era la contraria, «el rojo del obligatorio también avisa», y caía en el mismo ⑦)
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: "(f.estado === 'ROJO-SOSTENIDO')",
    a: "(f.estado === 'ROJO-SOSTENIDO' && !f.obligatorio)",
    cae: '⑦ lo que no sabe, lo dice',
  },
  {
    // M06 · el silencio deja de avisar
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: "f.estado === 'SILENCIO' || (f.estado",
    a: '(f.estado',
    cae: '⑤ EL SILENCIO: un job que deja de ejecutarse',
  },
  {
    // M07 · un job ausente del run no cuenta como hueco
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: "estado: r.jobs[job] ?? 'ausente' }",
    a: "estado: r.jobs[job] ?? 'pendiente' }",
    cae: '⑤ EL SILENCIO: un job que deja de ejecutarse',
  },
  {
    // M08 · un solo rojo de cron ya avisa
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: 'export const MINIMO_ROJOS_DE_CRON = 2;',
    a: 'export const MINIMO_ROJOS_DE_CRON = 1;',
    cae: '⑥ el cron va en HORAS',
  },
  {
    // M09 · los commits de main sin run no cuentan
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: 'huecosSinEjecutar(serie).vivo + (sinRun ?? 0);',
    a: 'huecosSinEjecutar(serie).vivo;',
    cae: '⑤ EL SILENCIO: un job que deja de ejecutarse',
  },
  {
    // M10 · sin lista de obligatorios sigue adelante
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: 'if (!Array.isArray(obligatorios)) {',
    a: 'if (false) {',
    cae: '⑦ lo que no sabe, lo dice',
  },
  {
    // M11 · un run sin ejecutar rompe la racha roja
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: "    if (!EJECUTO.has(s.estado)) continue;\n    if (s.estado === 'failure') {",
    a: "    if (s.estado === 'failure') {",
    cae: '③ EL ROJO, con los datos de entonces',
  },
  {
    // M12 · el veredicto mira también el futuro
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: 'const vistos = runs.filter((r) => r.creado <= ahora);',
    a: 'const vistos = runs;',
    cae: '③ EL ROJO, con los datos de entonces',
  },
  {
    // M13 · nunca hay nada sin declarar
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: '.filter((k) => !declarados.has(k)).sort();',
    a: '.filter(() => false);',
    cae: '⑦ lo que no sabe, lo dice',
  },
  {
    // M14 · el cron que no llega no es silencio
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: 'if (fila.horasSinRun > U.horas) {',
    a: 'if (false) {',
    cae: '⑥ el cron va en HORAS',
  },
  {
    // M15 · la tasa de fallo se mide con las rachas largas dentro
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: '.filter((r) => r.tamano >= N).reduce((a, r) => a + r.tamano, 0);',
    a: '.filter(() => false).reduce((a, r) => a + r.tamano, 0);',
    cae: '② los tres umbrales no se eligen',
  },
];

test('SCRUM-1324 · ① el censo: el historial es el real, y la lista de jobs es EXACTAMENTE la que corre en main', () => {
  const porWorkflow = {};
  for (const r of RUNS) porWorkflow[r.workflow] = (porWorkflow[r.workflow] || 0) + 1;
  console.log(`scrum1324 · población: ${RUNS.length} runs de main · ${RUNS[0].creado} → ${RUNS.at(-1).creado} · ${JSON.stringify(porWorkflow)}`);

  // Suelo: un historial vacío o recortado haría verdes todos los casos de abajo sin mirar nada.
  assert.equal(RUNS.length, 704, 'el historial real tiene 704 runs; si cambia, se regeneró y hay que volver a medir');
  assert.deepEqual(porWorkflow, { [CRON_ATASCADOS]: 32, [CRON_DESPLIEGUE]: 33, CI: 314, 'Conflicto de registro': 314, 'Vigía de main': 11 });
  assert.equal(`${RUNS[0].creado} ${RUNS[0].sha}`, '2026-11-16T00:27:27Z 37947dc1');
  assert.equal(`${RUNS.at(-1).creado} ${RUNS.at(-1).sha}`, '2026-11-27T13:44:37Z eafe4fda');
  // Y el viejo sigue siendo el viejo: 1.084 runs, sin tocar.
  assert.equal(VIEJO.length, 1084);

  // Se comparan CONJUNTOS, no cuentas: los jobs que el historial vio correr en main y los declarados.
  const vistos = [...new Set(RUNS.flatMap((r) => Object.keys(r.jobs).map((j) => `${r.workflow} / ${j}`)))].sort();
  const declarados = JOBS_DE_MAIN.map((j) => `${j.workflow} / ${j.job}`).sort();
  assert.deepEqual(declarados, vistos);
  assert.equal(declarados.length, 13);

  // Y la unidad sigue al disparador: lo que corre por `schedule` va en horas; lo de `push`, en runs.
  for (const j of JOBS_DE_MAIN) {
    const eventos = new Set(RUNS.filter((r) => r.workflow === j.workflow).map((r) => r.evento));
    assert.equal(j.unidad, eventos.has('schedule') ? 'horas' : 'runs', `${j.workflow} / ${j.job}`);
  }
});

test('SCRUM-1324 · ② los tres umbrales no se eligen: se recalculan del historial y tienen que coincidir', () => {
  const rojos = umbralDeRojos(RUNS);
  const porN = Object.fromEntries(rojos.detalle.map((d) => [d.N, d]));
  console.log(`scrum1324 · umbral de rojos: ${rojos.detalle.map((d) => `N=${d.N} → ${d.esperadas.toFixed(2)}/mes`).join(' · ')}`);
  assert.equal(rojos.umbral, UMBRAL_ROJOS_SEGUIDOS);
  // El peor job es el obligatorio: 3 rojos de 147 fuera de sus dos rachas de 2 (2,0 %). La derivación
  // empieza en N=2 (con 1 se avisaría de cada rojo) y se queda ahí: el primer N ya cabe en la tolerancia.
  assert.deepEqual(rojos.detalle.map((d) => d.N), [2]);
  assert.equal(porN[2].job, `CI / ${OBLIGATORIO}`);
  assert.equal(porN[2].rojos, 3);
  assert.equal(porN[2].fuera, 147);
  assert.ok(porN[UMBRAL_ROJOS_SEGUIDOS].esperadas < AVISOS_FALSOS_AL_MES, `N=${UMBRAL_ROJOS_SEGUIDOS} da ${porN[UMBRAL_ROJOS_SEGUIDOS].esperadas}`);

  const runs = umbralDeRunsSinEjecutar(RUNS);
  console.log(`scrum1324 · umbral de silencio: hueco máximo ${runs.hueco} runs en «${runs.job}» → ${runs.umbral}`);
  assert.equal(runs.hueco, 11);
  assert.equal(runs.umbral, UMBRAL_RUNS_SIN_EJECUTAR);

  const horas = umbralDeHorasDeCron(RUNS);
  console.log(`scrum1324 · umbral de cron: hueco máximo ${horas.horas.toFixed(1)} h en «${horas.job}» → ${horas.umbral} h`);
  assert.equal(horas.umbral, UMBRAL_HORAS_DE_CRON);
  // El hueco que manda es el del cron DIARIO del propio vigía (SCRUM-1534 c.22944 c), desde el 22-nov 14:39:08Z.
  assert.equal(`${horas.job} ${horas.desde}`, 'Vigía de main / vigilar 2026-11-22T14:39:08Z');
  assert.ok(horas.horas > UMBRAL_HORAS_DE_CRON - 1, 'el umbral es el hueco máximo redondeado hacia arriba, no más');

  // EL CONTROL (SCRUM-1534b): la misma derivación sobre el fixture de 1324, con los nueve jobs que
  // corrían entonces, sigue dando los tres números de entonces. Ahí sí se ven las DOS mitades del
  // umbral de rojos: con uno menos habría más de un aviso falso al mes; con el suyo, menos.
  const deEntonces = JOBS_DE_MAIN.filter((j) => VIEJO.some((r) => r.workflow === j.workflow && j.job in r.jobs));
  assert.equal(deEntonces.length, 9);
  const viejo = umbralDeRojos(VIEJO, deEntonces);
  const viejoPorN = Object.fromEntries(viejo.detalle.map((d) => [d.N, d]));
  assert.equal(viejo.umbral, 5);
  assert.equal(`${viejoPorN[5].job} ${viejoPorN[5].rojos}/${viejoPorN[5].fuera}`, `CI / ${META} 41/159`);
  assert.ok(viejoPorN[4].esperadas >= AVISOS_FALSOS_AL_MES, `N=4 da ${viejoPorN[4].esperadas}`);
  assert.ok(viejoPorN[5].esperadas < AVISOS_FALSOS_AL_MES, `N=5 da ${viejoPorN[5].esperadas}`);
  assert.equal(umbralDeRunsSinEjecutar(VIEJO, deEntonces).umbral, 22);
  assert.equal(umbralDeHorasDeCron(VIEJO, deEntonces).umbral, 10);
});

// SCRUM-1534b: el suceso es del fixture nuevo (el trinquete, 24-nov); el nombre del caso se queda con
// «el meta-guard» y «29-sep» porque lo cita el catálogo de arriba por su principio.
test('SCRUM-1324 · ③ EL ROJO, con los datos de entonces: el meta-guard dispara en la ventana del 29-sep, y antes no', () => {
  // 2026-11-24T03:29:00Z · 35 s antes de su primer rojo (el último verde, 02:58:44Z en 17fbc935): no avisa.
  const antes = mirar('2026-11-24T03:29:00Z');
  assert.equal(fila(antes, TRINQUETE).estado, 'VERDE');
  assert.equal(fila(antes, TRINQUETE).rojosSeguidos, 0);

  // 03:29:35Z · primer rojo en main (run de 3c6c651f). Uno solo: se ve, y NO avisa.
  const primero = mirar('2026-11-24T03:29:35Z');
  assert.equal(fila(primero, TRINQUETE).estado, 'ROJO-RECIENTE');
  assert.equal(fila(primero, TRINQUETE).rojosSeguidos, 1);
  assert.equal(primero.avisos.filter((f) => f.job === TRINQUETE).length, 0);

  // 06:38:51Z · segundo rojo seguido (run de d47f8d5c), tres horas después: AVISA. Lo real fueron
  // diez rojos y doce horas, hasta las 15:36:55Z; con el umbral de 1324 (5) habría tardado más.
  const segundo = mirar('2026-11-24T06:38:51Z');
  assert.equal(fila(segundo, TRINQUETE).estado, 'ROJO-SOSTENIDO');
  assert.equal(fila(segundo, TRINQUETE).rojosSeguidos, UMBRAL_ROJOS_SEGUIDOS);
  assert.equal(segundo.avisos.filter((f) => f.job === TRINQUETE).length, 1);
  const ultimo = mirar('2026-11-24T15:36:55Z');
  assert.equal(fila(ultimo, TRINQUETE).rojosSeguidos, 10);
  // En ese instante «guards de navegador», obligatorio, llevaba rojo desde el 18-nov 12:45:01Z
  // (bcff9d8b): la racha de 72 de SCRUM-1534 c.22940, que desde 1534a avisa con su primer rojo.
  assert.equal(fila(mirar('2026-11-18T12:45:01Z'), NAVEGADOR).estado, 'ROJO-SOSTENIDO');
  assert.equal(fila(mirar('2026-11-24T12:05:17Z'), NAVEGADOR).rojosSeguidos, 72);

  // Un run en que el job no corrió ni rompe la racha ni la alarga: el obligatorio falló en 0735f843
  // (25-nov 04:25:57Z) y en 77c000de (04:38:09Z), con un run sustituido en medio. Son dos seguidos.
  assert.equal(fila(mirar('2026-11-25T04:38:09Z'), OBLIGATORIO).rojosSeguidos, 2);

  // Y al cierre del historial no avisa nadie: lo único en rojo es el cron del despliegue, dos veces
  // (5ed6e94f), todavía dentro de sus horas.
  const cierre = mirar(HISTORIAL.tomada);
  assert.deepEqual(nombres(cierre.avisos), []);
  assert.deepEqual(cierre.filas.filter((f) => f.estado !== 'VERDE').map((f) => `${f.estado} · ${f.workflow} · ${f.rojosSeguidos}`), [`ROJO-RECIENTE · ${CRON_DESPLIEGUE} · 2`]);
});

// SCRUM-1534b: sobre el fixture nuevo son DOCE: las cinco rachas del obligatorio y las tres de
// navegador (obligatorios: avisan con su primer rojo, 1534a), y cuatro rachas de dos o más de los
// demás. El nombre del caso se queda en «ocho» (lo citan catálogos); el número es el de la lista.
test('SCRUM-1324 · ④ EL POSITIVO, sobre el historial entero: avisa de estas ocho veces y de ninguna más', () => {
  // Un instante por run, más una rejilla de 30 minutos (el cron se mide en horas y entre dos runs
  // suyos también pasa el tiempo). En cada uno, qué avisa; un episodio es un tramo seguido de aviso.
  const rejilla = [];
  for (let t = Date.parse(RUNS[0].creado); t <= Date.parse(HISTORIAL.tomada); t += 30 * 60000) rejilla.push(new Date(t).toISOString());
  const instantes = [...new Set([...RUNS.map((r) => r.creado), ...rejilla, HISTORIAL.tomada])]
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const episodios = [];
  let abiertos = new Set();
  for (const ahora of instantes) {
    const ahoraAvisan = new Set(nombres(mirar(ahora).avisos));
    for (const k of ahoraAvisan) if (!abiertos.has(k)) episodios.push(`${ahora.slice(0, 10)} · ${k}`);
    abiertos = ahoraAvisan;
  }
  console.log(`scrum1324 · barrido: ${instantes.length} instantes · ${episodios.length} episodios de aviso`);
  assert.equal(instantes.length, 958, `${instantes.length} instantes: el barrido no recorrió el historial`);
  assert.deepEqual(episodios.sort(), [
    ...['2026-11-17', '2026-11-24', '2026-11-24', '2026-11-24', '2026-11-25'].map((dia) => `${dia} · ROJO-SOSTENIDO · CI / ${OBLIGATORIO}`),
    ...['2026-11-16', '2026-11-17', '2026-11-18'].map((dia) => `${dia} · ROJO-SOSTENIDO · CI / ${NAVEGADOR}`),
    `2026-11-18 · ROJO-SOSTENIDO · CI / ${META}`,
    `2026-11-18 · ROJO-SOSTENIDO · CI / ${PARTE_3}`,
    `2026-11-18 · ROJO-SOSTENIDO · CI / ${TRINQUETE}`,
    `2026-11-24 · ROJO-SOSTENIDO · CI / ${TRINQUETE}`,
  ].sort());

  // Lo que eso deja FUERA, contado para que el positivo no se cumpla sobre el vacío:
  // · un job que pasa siempre no avisa nunca (286 ejecuciones del resolver, 0 rojos);
  const resolver = serieDe(RUNS, 'Conflicto de registro', 'resolver');
  assert.equal(resolver.filter((s) => s.estado === 'success').length, 286);
  assert.equal(rachasRojas(resolver).length, 0);
  // · un job que falla UNA vez y se recupera tampoco: el trinquete tuvo cuatro rachas (10, 3, 1 y 1)
  //   y sólo las dos largas están arriba; los dos informativos del CI, un rojo suelto cada uno;
  const trinquete = rachasRojas(serieDe(RUNS, 'CI', TRINQUETE));
  assert.deepEqual(trinquete.map((r) => r.tamano).sort((a, b) => b - a), [10, 3, 1, 1]);
  for (const informativo of ['vigía del despliegue (informativo)', 'constancia del ALTER (informativo)']) {
    assert.deepEqual(rachasRojas(serieDe(RUNS, 'CI', informativo)).map((r) => r.tamano), [1], informativo);
  }
  // · y ningún cron: el del despliegue falló cuatro veces en tres rachas (2, 1 y 1) sin pasar de sus horas.
  assert.deepEqual(rachasRojas(serieDe(RUNS, CRON_DESPLIEGUE, 'vigia')).map((r) => r.tamano).sort((a, b) => b - a), [2, 1, 1]);
  // El meta-guard cayó una sola vez, tres seguidos (18-nov, de 8c8c2b7c a a9e0e7ef), y por su parte 3.
  assert.deepEqual(rachasRojas(serieDe(RUNS, 'CI', META)).map((r) => r.tamano), [3]);
  assert.deepEqual(rachasRojas(serieDe(RUNS, 'CI', PARTE_3)).map((r) => r.hitos), rachasRojas(serieDe(RUNS, 'CI', META)).map((r) => r.hitos));
});

test('SCRUM-1324 · ⑤ EL SILENCIO: un job que deja de ejecutarse avisa igual que uno que falla', () => {
  const CORTE = '2026-11-26T12:00:00Z'; // un instante con todo verde o por debajo de umbral
  const hasta = RUNS.filter((r) => r.creado <= CORTE);
  const base = veredicto({ runs: hasta, ahora: CORTE, obligatorios: OBLIGATORIOS });
  assert.deepEqual(nombres(base.avisos), [], 'el punto de partida no puede traer avisos propios');
  const deCi = hasta.filter((r) => r.workflow === 'CI');

  // Quitar el job de n runs REALES de CI seguidos, justo después de una ejecución suya: lo que
  // dejaría borrarlo de `ci.yml`. El historial se corta en el último de esos runs, y ése es el «ahora».
  const e = deCi.findLastIndex((r, i) => ['success', 'failure'].includes(r.jobs[TRINQUETE]) && i + UMBRAL_RUNS_SIN_EJECUTAR < deCi.length);
  assert.ok(e >= 0, 'no hay una ejecución real del trinquete con sitio detrás para el hueco');
  const conHueco = (n, como) => {
    const tocados = new Set(deCi.slice(e + 1, e + 1 + n));
    const ahora = deCi[e + n].creado;
    const runs = hasta.filter((r) => r.creado <= ahora).map((r) => {
      if (!tocados.has(r)) return r;
      const jobs = { ...r.jobs };
      if (como === 'ausente') delete jobs[TRINQUETE]; else if (como !== 'real') jobs[TRINQUETE] = como;
      return { ...r, jobs };
    });
    return veredicto({ runs, ahora, obligatorios: OBLIGATORIOS });
  };

  for (const como of ['ausente', 'skipped', 'cancelled']) {
    const justo = fila(conHueco(UMBRAL_RUNS_SIN_EJECUTAR, como), TRINQUETE);
    assert.equal(justo.estado, 'SILENCIO', `${como} × ${UMBRAL_RUNS_SIN_EJECUTAR}`);
    assert.equal(justo.sinEjecutar, UMBRAL_RUNS_SIN_EJECUTAR);
    const unoMenos = fila(conHueco(UMBRAL_RUNS_SIN_EJECUTAR - 1, como), TRINQUETE);
    assert.equal(unoMenos.estado, 'VERDE', `${como} × ${UMBRAL_RUNS_SIN_EJECUTAR - 1} es operación normal: se vio en el historial`);
    assert.equal(unoMenos.sinEjecutar, UMBRAL_RUNS_SIN_EJECUTAR - 1);
  }
  // Sólo calla el que desapareció: las otras doce filas son las mismas que sin tocar nada.
  const otras = (v) => v.filas.filter((x) => x.job !== TRINQUETE);
  const mudo = conHueco(UMBRAL_RUNS_SIN_EJECUTAR, 'ausente');
  const intacto = conHueco(UMBRAL_RUNS_SIN_EJECUTAR, 'real');
  assert.equal(otras(mudo).length, 12);
  assert.deepEqual(otras(mudo), otras(intacto));
  assert.deepEqual(nombres(mudo.avisos.filter((x) => x.job === TRINQUETE)), [`SILENCIO · CI / ${TRINQUETE}`]);
  assert.equal(fila(intacto, TRINQUETE).estado, 'VERDE');

  // Los workflows de push dejan de dispararse: no hay runs nuevos que mirar, sólo commits de main
  // sin run. Callan los diez jobs de push (CI y el resolver comparten último commit); los cron, no.
  const ultimo = deCi.at(-1).sha;
  const commits = (n) => [...Array.from({ length: n }, (_, i) => `nuevo${i}`), ultimo, 'anterior'];
  assert.equal(commitsSinRun(hasta, 'CI', commits(3)), 3);
  const parado = veredicto({ runs: hasta, ahora: CORTE, obligatorios: OBLIGATORIOS, commitsDeMain: commits(UMBRAL_RUNS_SIN_EJECUTAR) });
  assert.deepEqual(nombres(parado.avisos), JOBS_DE_MAIN.filter((j) => j.unidad === 'runs').map((j) => `SILENCIO · ${j.workflow} / ${j.job}`).sort());
  assert.equal(parado.avisos.length, 10);
  const alDia = veredicto({ runs: hasta, ahora: CORTE, obligatorios: OBLIGATORIOS, commitsDeMain: commits(0) });
  assert.deepEqual(nombres(alDia.avisos), []);
  // Y si el commit del último run no está en la lista, no se inventa una cuenta: queda «no se sabe».
  assert.equal(commitsSinRun(hasta, 'CI', ['otro', 'distinto']), null);
  assert.equal(commitsSinRun(hasta, 'CI', null), null);

  // El silencio del obligatorio TAMBIÉN avisa (y desde SCRUM-1534a, su rojo también: caso ⑦).
  const obligatorioMudo = hasta.map((r) => {
    if (!new Set(deCi.slice(-UMBRAL_RUNS_SIN_EJECUTAR)).has(r)) return r;
    const jobs = { ...r.jobs };
    delete jobs[OBLIGATORIO];
    return { ...r, jobs };
  });
  assert.deepEqual(nombres(veredicto({ runs: obligatorioMudo, ahora: CORTE, obligatorios: OBLIGATORIOS }).avisos), [`SILENCIO · CI / ${OBLIGATORIO}`]);
});

test('SCRUM-1324 · ⑥ el cron va en HORAS: el que no llega es silencio, el que llega y falla es rojo, y uno solo no avisa', () => {
  // SILENCIO · el último run real del vigía de PR atascados, y después nada.
  const ultimo = serieDe(RUNS, CRON_ATASCADOS, 'vigilar').at(-1).creado;
  assert.equal(ultimo, '2026-11-27T03:18:59Z');
  const dentro = filaDe(mirar(masHoras(ultimo, UMBRAL_HORAS_DE_CRON - 0.1)), CRON_ATASCADOS);
  assert.equal(dentro.estado, 'VERDE');
  const fuera = filaDe(mirar(masHoras(ultimo, UMBRAL_HORAS_DE_CRON + 0.1)), CRON_ATASCADOS);
  assert.equal(fuera.estado, 'SILENCIO');
  assert.equal(fuera.horasSinRun, UMBRAL_HORAS_DE_CRON + 0.1);

  // ROJO · los datos son reales y el instante NO: el cron del despliegue falló dos veces seguidas
  // (26-nov 22:39:59Z y 27-nov 05:37:36Z, las dos sobre 5ed6e94f) y al cerrarse el historial seguía
  // así, con su último verde a las 13:18:02Z del 26 (4e9ed162). En la ventana ningún cron pasó de sus
  // horas en rojo, así que se mira ese mismo estado UN POCO DESPUÉS del cierre: es lo que el vigía
  // diría si nada cambiara.
  const racha = rachasRojas(serieDe(RUNS, CRON_DESPLIEGUE, 'vigia')).find((r) => r.viva);
  assert.equal(racha.desde, '2026-11-26T22:39:59Z');
  const segundo = filaDe(mirar(racha.hitos[1]), CRON_DESPLIEGUE);
  assert.equal(segundo.rojosSeguidos, MINIMO_ROJOS_DE_CRON);
  assert.equal(segundo.estado, 'ROJO-RECIENTE');
  const VERDE_ANTES = '2026-11-26T13:18:02Z';
  const casi = filaDe(mirar(masHoras(VERDE_ANTES, UMBRAL_HORAS_DE_CRON - 0.1)), CRON_DESPLIEGUE);
  assert.equal(casi.estado, 'ROJO-RECIENTE');
  const enRojo = filaDe(mirar(masHoras(VERDE_ANTES, UMBRAL_HORAS_DE_CRON + 0.1)), CRON_DESPLIEGUE);
  assert.equal(enRojo.estado, 'ROJO-SOSTENIDO');
  assert.equal(enRojo.horasSinVerde, UMBRAL_HORAS_DE_CRON + 0.1);
  assert.ok(enRojo.horasSinRun < UMBRAL_HORAS_DE_CRON, 'es rojo y no silencio: el cron sí llegó');

  // UNO SOLO NO · real: el 24-nov a las 14:21:43Z (954448c9) falló una vez y se recuperó a las
  // 00:12:13Z del 25. Pasó 20,7 h sin verde y no avisó.
  const suelto = rachasRojas(serieDe(RUNS, CRON_DESPLIEGUE, 'vigia')).find((r) => r.desde === '2026-11-24T14:21:43Z');
  assert.equal(suelto.tamano, 1);
  const trasElFallo = filaDe(mirar('2026-11-25T00:00:00Z'), CRON_DESPLIEGUE);
  assert.equal(trasElFallo.rojosSeguidos, 1);
  assert.equal(trasElFallo.horasSinVerde, 20.5);
  assert.equal(trasElFallo.estado, 'ROJO-RECIENTE');
  // Y aunque hubiera pasado de sus horas sin verde, uno solo no avisa. CONSTRUIDO: el historial se
  // corta en ese rojo y se mira pasado el umbral desde su verde anterior (03:32:24Z, 3c6c651f).
  const cortado = veredicto({ runs: RUNS.filter((r) => r.creado <= suelto.hasta), ahora: masHoras('2026-11-24T03:32:24Z', UMBRAL_HORAS_DE_CRON + 0.1), obligatorios: OBLIGATORIOS });
  assert.equal(filaDe(cortado, CRON_DESPLIEGUE).rojosSeguidos, 1);
  assert.ok(filaDe(cortado, CRON_DESPLIEGUE).horasSinVerde > UMBRAL_HORAS_DE_CRON);
  assert.equal(filaDe(cortado, CRON_DESPLIEGUE).estado, 'ROJO-RECIENTE');
});

test('SCRUM-1324 · ⑦ lo que no sabe, lo dice: CIEGO, SIN-DECLARAR, y un suelo que reconoce sus cebos', () => {
  // Sin la lista de obligatorios no puede separar lo que bloquea de lo que no: CIEGO, no «todo bien».
  const sinLista = veredicto({ runs: RUNS, ahora: HISTORIAL.tomada, obligatorios: null });
  assert.match(sinLista.ciego, /obligatorios/);
  assert.equal(sinLista.filas.length, 0);
  // Sin runs en la ventana, tampoco: cero runs no es «cero rojos».
  const vacio = veredicto({ runs: RUNS, ahora: '2026-09-01T00:00:00Z', obligatorios: OBLIGATORIOS });
  assert.match(vacio.ciego, /ningún run/);
  assert.equal(mirar(HISTORIAL.tomada).ciego, null);

  // El rojo del OBLIGATORIO es aviso de este instrumento (SCRUM-1534a, c.22933: hasta el 27-nov este
  // caso exigía lo contrario, «su rojo ya para la cola»). El de los demás, con la racha.
  const t = (i) => new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString();
  const jobs = [{ workflow: 'W', job: 'bloquea', unidad: 'runs' }, { workflow: 'W', job: 'no-bloquea', unidad: 'runs' }];
  const runs = Array.from({ length: UMBRAL_ROJOS_SEGUIDOS }, (_, i) => ({
    workflow: 'W', evento: 'push', creado: t(i), sha: `c${i}`, jobs: { bloquea: 'failure', 'no-bloquea': 'failure' },
  }));
  const v = veredicto({ runs, ahora: t(60), obligatorios: ['bloquea'], jobs });
  assert.equal(fila(v, 'bloquea').estado, 'ROJO-SOSTENIDO');
  assert.equal(fila(v, 'no-bloquea').estado, 'ROJO-SOSTENIDO');
  assert.deepEqual(nombres(v.avisos), ['ROJO-SOSTENIDO · W / bloquea', 'ROJO-SOSTENIDO · W / no-bloquea']);
  // Y con uno menos, el que no bloquea no llega a sostenido; el obligatorio sigue avisando.
  const corto = veredicto({ runs: runs.slice(1), ahora: t(60), obligatorios: ['bloquea'], jobs });
  assert.equal(fila(corto, 'no-bloquea').estado, 'ROJO-RECIENTE');
  assert.equal(fila(corto, 'no-bloquea').rojosSeguidos, UMBRAL_ROJOS_SEGUIDOS - 1);
  assert.deepEqual(nombres(corto.avisos), ['ROJO-SOSTENIDO · W / bloquea']);

  // Un job que corre en main y no está en la lista: SIN-DECLARAR. Si no, la lista se queda corta callada.
  const sinUno = JOBS_DE_MAIN.filter((j) => j.job !== TRINQUETE);
  assert.deepEqual(mirar(HISTORIAL.tomada, { jobs: sinUno }).sinDeclarar, [`CI / ${TRINQUETE}`]);
  assert.deepEqual(mirar(HISTORIAL.tomada).sinDeclarar, []);

  // Un run en marcha o sin leer no cuenta ni como ejecutado ni como hueco.
  assert.deepEqual(huecosSinEjecutar([{ estado: 'success' }, { estado: 'cancelled' }, { estado: 'pendiente' }, { estado: 'sin-leer' }]), { cerrados: [], vivo: 1 });

  const suelo = sueloDelVigia();
  assert.equal(suelo.ok, true, suelo.detalle);
  assert.deepEqual(suelo.estado, { rojo: 'ROJO-SOSTENIDO', mudo: 'SILENCIO', sano: 'VERDE', cron: 'SILENCIO' });
});

test('SCRUM-1324 · ⑧ el informe declara su población en la primera línea y su salida en la última', () => {
  // 2026-11-24T06:38:51Z · el segundo rojo del trinquete (caso ③), con navegador en su racha de 72:
  // dos avisos, uno por la racha y otro por ser obligatorio.
  const EN_ROJO = '2026-11-24T06:38:51Z';
  const rojo = mirar(EN_ROJO);
  const texto = informe(rojo, { ahora: EN_ROJO, origen: 'historial real', poblacion: `runs=${RUNS.length}` }).split('\n');
  assert.equal(texto[0], `POBLACION runs=704 · medido ${EN_ROJO} · historial real`);
  assert.equal(texto.at(-1), `EXIT=${SALIDA_AVISO}`);
  assert.deepEqual(nombres(rojo.avisos), [`ROJO-SOSTENIDO · CI / ${NAVEGADOR}`, `ROJO-SOSTENIDO · CI / ${TRINQUETE}`]);
  assert.equal(texto.filter((l) => l.startsWith('ROJO-SOSTENIDO')).length, 2);
  assert.match(texto.at(-2), /^AVISO: 2 de 13 jobs/);

  // Al cierre del historial, y el mediodía del 26-nov, no avisa nadie.
  const cierre = informe(mirar(HISTORIAL.tomada), { ahora: HISTORIAL.tomada, origen: 'historial real', poblacion: `runs=${RUNS.length}` }).split('\n');
  assert.equal(cierre.at(-1), `EXIT=${SALIDA_OK}`);
  const sano = mirar('2026-11-26T12:00:00Z');
  const limpio = informe(sano, { ahora: '2026-11-26T12:00:00Z', origen: 'historial real', poblacion: 'runs=…' }).split('\n');
  assert.equal(limpio.at(-1), `EXIT=${SALIDA_OK}`);
  assert.match(limpio.at(-2), /^sin avisos: 13 jobs mirados/);

  const ciego = informe(veredicto({ runs: RUNS, ahora: HISTORIAL.tomada, obligatorios: null }), { ahora: HISTORIAL.tomada, origen: 'x', poblacion: 'runs=0' }).split('\n');
  assert.equal(ciego.at(-1), `EXIT=${SALIDA_CIEGO}`);
});
