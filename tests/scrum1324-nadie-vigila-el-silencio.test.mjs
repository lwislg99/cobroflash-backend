// tests/scrum1324-nadie-vigila-el-silencio.test.mjs — SCRUM-1324
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA RED QUE SÍ CORRE SIEMPRE de `scripts/vigia-silencio-de-main.mjs`. Aquí NO se toca la red.
//
// El vigía lee GitHub, así que vive fuera de `npm test`. Lo que se ejercita aquí es su parte PURA
// —`veredicto` y los tres `umbral…`— contra el HISTORIAL REAL de `main`: 1.084 runs del 20-sep al
// 1-oct-2026, recogidos de la API y recortados (no editados) por
// `docs/master/evidencias/SCRUM-1324/reducir.mjs`. Vive en `tests/fixtures/`.
//
// ── EL ROJO PRIMERO, Y NO ESTÁ FABRICADO ───────────────────────────────────────────────────
// El 29-sep a las 09:44Z entró el merge `488410b5` y el meta-guard se quedó rojo en `main`: 31
// ejecuciones seguidas hasta el 1-oct, sin que nada avisara. El caso ③ pone al vigía en esos
// instantes, con los datos de entonces, y exige que dispare — y que una hora antes NO.
//
// ── LO QUE SÍ ESTÁ CONSTRUIDO, Y SE DICE ───────────────────────────────────────────────────
// El SILENCIO de un job (⑤) no tiene caso real en la ventana: ningún job desapareció. Se
// construye quitando el job de los últimos runs REALES, que es lo que dejaría borrarlo del
// workflow. Los bordes salen de la constante (umbral − 1 no avisa, umbral sí), no de un literal.
//
// ⚠️ Lo que este fichero NO puede vigilar: que GitHub siga contestando con esta forma, y que el
// vigía se llegue a ejecutar. Hoy no lo lanza nada (enchufarlo toca un workflow: decisión del
// fundador, registrada en `docs/master/SCRUM-1324.md`).
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

// El único check obligatorio de `main`, leído del ruleset `protect-main` el 1-oct-2026.
const OBLIGATORIO = 'build + tests (con banco desechable)';
const META = 'meta-guard · los guards caen cuando deben';
const NAVEGADOR = 'guards de navegador (fuera de la tanda)';
const TRINQUETE = 'trinquete · ningún test nuevo mide la zona de la máquina';

const mirar = (ahora, extra = {}) => veredicto({ runs: RUNS, ahora, obligatorios: [OBLIGATORIO], ...extra });
const fila = (v, job) => v.filas.find((f) => f.job === job);
const nombres = (lista) => lista.map((f) => `${f.estado} · ${f.workflow} / ${f.job}`).sort();
const masHoras = (iso, h) => new Date(Date.parse(iso) + h * 3600000).toISOString();

test('SCRUM-1324 · ① el censo: el historial es el real, y la lista de jobs es EXACTAMENTE la que corre en main', () => {
  const porWorkflow = {};
  for (const r of RUNS) porWorkflow[r.workflow] = (porWorkflow[r.workflow] || 0) + 1;
  console.log(`scrum1324 · población: ${RUNS.length} runs de main · ${RUNS[0].creado} → ${RUNS.at(-1).creado} · ${JSON.stringify(porWorkflow)}`);

  // Suelo: un historial vacío o recortado haría verdes todos los casos de abajo sin mirar nada.
  assert.equal(RUNS.length, 1084, 'el historial real tiene 1.084 runs; si cambia, se regeneró y hay que volver a medir');
  assert.deepEqual(porWorkflow, { 'Vigía de PR atascados': 52, 'Vigía del despliegue': 56, CI: 488, 'Conflicto de registro': 488 });

  // Se comparan CONJUNTOS, no cuentas: los jobs que el historial vio correr en main y los declarados.
  const vistos = [...new Set(RUNS.flatMap((r) => Object.keys(r.jobs).map((j) => `${r.workflow} / ${j}`)))].sort();
  const declarados = JOBS_DE_MAIN.map((j) => `${j.workflow} / ${j.job}`).sort();
  assert.deepEqual(declarados, vistos);
  assert.equal(declarados.length, 9);

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
  // El peor job es el meta-guard: 41 rojos de 159 fuera de su racha larga (25,8 %, SCRUM-908).
  assert.equal(porN[5].job, `CI / ${META}`);
  assert.equal(porN[5].rojos, 41);
  assert.equal(porN[5].fuera, 159);
  // Las dos mitades del umbral: con uno menos habría más de un aviso falso al mes; con éste, menos.
  assert.ok(porN[UMBRAL_ROJOS_SEGUIDOS - 1].esperadas >= AVISOS_FALSOS_AL_MES, `N=${UMBRAL_ROJOS_SEGUIDOS - 1} da ${porN[UMBRAL_ROJOS_SEGUIDOS - 1].esperadas}`);
  assert.ok(porN[UMBRAL_ROJOS_SEGUIDOS].esperadas < AVISOS_FALSOS_AL_MES, `N=${UMBRAL_ROJOS_SEGUIDOS} da ${porN[UMBRAL_ROJOS_SEGUIDOS].esperadas}`);

  const runs = umbralDeRunsSinEjecutar(RUNS);
  console.log(`scrum1324 · umbral de silencio: hueco máximo ${runs.hueco} runs en «${runs.job}» → ${runs.umbral}`);
  assert.equal(runs.hueco, 21);
  assert.equal(runs.umbral, UMBRAL_RUNS_SIN_EJECUTAR);

  const horas = umbralDeHorasDeCron(RUNS);
  console.log(`scrum1324 · umbral de cron: hueco máximo ${horas.horas.toFixed(1)} h en «${horas.job}» → ${horas.umbral} h`);
  assert.equal(horas.umbral, UMBRAL_HORAS_DE_CRON);
  assert.ok(horas.horas > UMBRAL_HORAS_DE_CRON - 1, 'el umbral es el hueco máximo redondeado hacia arriba, no más');
});

test('SCRUM-1324 · ③ EL ROJO, con los datos de entonces: el meta-guard dispara en la ventana del 29-sep, y antes no', () => {
  // 09:44Z · el instante del merge que lo rompió. Todavía no ha fallado en main: no avisa.
  const antes = mirar('2026-09-29T09:44:00Z');
  assert.equal(fila(antes, META).estado, 'VERDE');
  assert.equal(fila(antes, META).rojosSeguidos, 0);

  // 09:54:56Z · primer rojo en main. Uno solo: se ve, y NO avisa.
  const primero = mirar('2026-09-29T09:54:56Z');
  assert.equal(fila(primero, META).estado, 'ROJO-RECIENTE');
  assert.equal(fila(primero, META).rojosSeguidos, 1);
  assert.equal(primero.avisos.filter((f) => f.job === META).length, 0);

  // 10:52:41Z · quinto rojo seguido, 58 minutos después del primero: AVISA. Lo real fueron 40 horas.
  const quinto = mirar('2026-09-29T10:52:41Z');
  assert.equal(fila(quinto, META).estado, 'ROJO-SOSTENIDO');
  assert.equal(fila(quinto, META).rojosSeguidos, UMBRAL_ROJOS_SEGUIDOS);
  assert.equal(quinto.avisos.filter((f) => f.job === META).length, 1);

  // Y al cierre del historial sigue avisando, con el recuento que J3b midió por otra vía (31 de 31).
  const cierre = mirar(HISTORIAL.tomada);
  assert.equal(fila(cierre, META).rojosSeguidos, 31);
  assert.equal(fila(cierre, NAVEGADOR).rojosSeguidos, 35);
  assert.deepEqual(nombres(cierre.avisos), [
    `ROJO-SOSTENIDO · CI / ${META}`,
    `ROJO-SOSTENIDO · CI / ${NAVEGADOR}`,
  ].sort());
});

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
  assert.ok(instantes.length > 1000, `sólo ${instantes.length} instantes: el barrido no recorrió el historial`);
  assert.deepEqual(episodios.sort(), [
    `2026-09-20 · ROJO-SOSTENIDO · CI / ${NAVEGADOR}`,
    '2026-09-25 · ROJO-SOSTENIDO · CI / constancia del ALTER (informativo)',
    `2026-09-25 · ROJO-SOSTENIDO · CI / ${NAVEGADOR}`,
    '2026-09-25 · ROJO-SOSTENIDO · CI / vigía del despliegue (informativo)',
    '2026-09-25 · ROJO-SOSTENIDO · Vigía del despliegue / vigia',
    `2026-09-28 · ROJO-SOSTENIDO · CI / ${NAVEGADOR}`,
    `2026-09-29 · ROJO-SOSTENIDO · CI / ${META}`,
    `2026-09-29 · ROJO-SOSTENIDO · CI / ${NAVEGADOR}`,
  ].sort());

  // Lo que eso deja FUERA, contado para que el positivo no se cumpla sobre el vacío:
  // · un job que pasa siempre no avisa nunca (446 ejecuciones del resolver, 0 rojos);
  const resolver = serieDe(RUNS, 'Conflicto de registro', 'resolver');
  assert.equal(resolver.filter((s) => s.estado === 'success').length, 446);
  assert.equal(rachasRojas(resolver).length, 0);
  // · un job que falla y se recupera tampoco: el trinquete falló 14 veces en 12 rachas, la mayor de 3;
  const trinquete = rachasRojas(serieDe(RUNS, 'CI', TRINQUETE));
  assert.equal(trinquete.length, 12);
  assert.equal(trinquete.reduce((a, r) => a + r.tamano, 0), 14);
  assert.equal(Math.max(...trinquete.map((r) => r.tamano)), 3);
  // · y las 31 rachas cortas del meta-guard (el 26 % de SCRUM-908), ninguna de más de 3.
  const meta = rachasRojas(serieDe(RUNS, 'CI', META));
  assert.deepEqual(meta.map((r) => r.tamano).sort((a, b) => b - a).slice(0, 3), [31, 3, 3]);
  assert.equal(meta.length, 32);
});

test('SCRUM-1324 · ⑤ EL SILENCIO: un job que deja de ejecutarse avisa igual que uno que falla', () => {
  const CORTE = '2026-09-28T12:00:00Z'; // un instante con todo verde o por debajo de umbral
  const hasta = RUNS.filter((r) => r.creado <= CORTE);
  const base = veredicto({ runs: hasta, ahora: CORTE, obligatorios: [OBLIGATORIO] });
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
    return veredicto({ runs, ahora, obligatorios: [OBLIGATORIO] });
  };

  for (const como of ['ausente', 'skipped', 'cancelled']) {
    const justo = fila(conHueco(UMBRAL_RUNS_SIN_EJECUTAR, como), TRINQUETE);
    assert.equal(justo.estado, 'SILENCIO', `${como} × ${UMBRAL_RUNS_SIN_EJECUTAR}`);
    assert.equal(justo.sinEjecutar, UMBRAL_RUNS_SIN_EJECUTAR);
    const unoMenos = fila(conHueco(UMBRAL_RUNS_SIN_EJECUTAR - 1, como), TRINQUETE);
    assert.equal(unoMenos.estado, 'VERDE', `${como} × ${UMBRAL_RUNS_SIN_EJECUTAR - 1} es operación normal: se vio en el historial`);
    assert.equal(unoMenos.sinEjecutar, UMBRAL_RUNS_SIN_EJECUTAR - 1);
  }
  // Sólo calla el que desapareció: las otras ocho filas son las mismas que sin tocar nada.
  const otras = (v) => v.filas.filter((x) => x.job !== TRINQUETE);
  const mudo = conHueco(UMBRAL_RUNS_SIN_EJECUTAR, 'ausente');
  const intacto = conHueco(UMBRAL_RUNS_SIN_EJECUTAR, 'real');
  assert.equal(otras(mudo).length, 8);
  assert.deepEqual(otras(mudo), otras(intacto));
  assert.deepEqual(nombres(mudo.avisos.filter((x) => x.job === TRINQUETE)), [`SILENCIO · CI / ${TRINQUETE}`]);
  assert.equal(fila(intacto, TRINQUETE).estado, 'VERDE');

  // Los workflows de push dejan de dispararse: no hay runs nuevos que mirar, sólo commits de main
  // sin run. Callan los siete jobs de push (CI y el resolver comparten último commit); los cron, no.
  const ultimo = deCi.at(-1).sha;
  const commits = (n) => [...Array.from({ length: n }, (_, i) => `nuevo${i}`), ultimo, 'anterior'];
  assert.equal(commitsSinRun(hasta, 'CI', commits(3)), 3);
  const parado = veredicto({ runs: hasta, ahora: CORTE, obligatorios: [OBLIGATORIO], commitsDeMain: commits(UMBRAL_RUNS_SIN_EJECUTAR) });
  assert.deepEqual(nombres(parado.avisos), JOBS_DE_MAIN.filter((j) => j.unidad === 'runs').map((j) => `SILENCIO · ${j.workflow} / ${j.job}`).sort());
  assert.equal(parado.avisos.length, 7);
  const alDia = veredicto({ runs: hasta, ahora: CORTE, obligatorios: [OBLIGATORIO], commitsDeMain: commits(0) });
  assert.deepEqual(nombres(alDia.avisos), []);
  // Y si el commit del último run no está en la lista, no se inventa una cuenta: queda «no se sabe».
  assert.equal(commitsSinRun(hasta, 'CI', ['otro', 'distinto']), null);
  assert.equal(commitsSinRun(hasta, 'CI', null), null);

  // El silencio del obligatorio TAMBIÉN avisa (su rojo no: ése ya para la cola).
  const obligatorioMudo = hasta.map((r) => {
    if (!new Set(deCi.slice(-UMBRAL_RUNS_SIN_EJECUTAR)).has(r)) return r;
    const jobs = { ...r.jobs };
    delete jobs[OBLIGATORIO];
    return { ...r, jobs };
  });
  assert.deepEqual(nombres(veredicto({ runs: obligatorioMudo, ahora: CORTE, obligatorios: [OBLIGATORIO] }).avisos), [`SILENCIO · CI / ${OBLIGATORIO}`]);
});

test('SCRUM-1324 · ⑥ el cron va en HORAS: el que no llega es silencio, el que llega y falla es rojo, y uno solo no avisa', () => {
  // SILENCIO · el último run real del vigía de PR atascados, y después nada.
  const ultimo = serieDe(RUNS, 'Vigía de PR atascados', 'vigilar').at(-1).creado;
  const dentro = fila(mirar(masHoras(ultimo, UMBRAL_HORAS_DE_CRON - 0.1)), 'vigilar');
  assert.equal(dentro.estado, 'VERDE');
  const fuera = fila(mirar(masHoras(ultimo, UMBRAL_HORAS_DE_CRON + 0.1)), 'vigilar');
  assert.equal(fuera.estado, 'SILENCIO');
  assert.equal(fuera.horasSinRun, UMBRAL_HORAS_DE_CRON + 0.1);

  // ROJO · real: el cron del despliegue falló cuatro veces seguidas el 24-25 sep (16 h).
  const racha = rachasRojas(serieDe(RUNS, 'Vigía del despliegue', 'vigia')).find((r) => r.tamano === 4);
  assert.equal(racha.desde, '2026-09-24T22:46:54Z');
  const segundo = fila(mirar(racha.hitos[1]), 'vigia');
  assert.equal(segundo.rojosSeguidos, MINIMO_ROJOS_DE_CRON);
  const enRojo = fila(mirar('2026-09-25T09:00:00Z'), 'vigia');
  assert.equal(enRojo.estado, 'ROJO-SOSTENIDO');
  assert.ok(enRojo.horasSinVerde > UMBRAL_HORAS_DE_CRON);

  // UNO SOLO NO · real: el 30-sep falló una vez y se recuperó. Pasó más de 10 h sin verde sólo por
  // lo lento que es el cron, y aun así no avisa. (La primera versión de la regla avisaba aquí.)
  const suelto = rachasRojas(serieDe(RUNS, 'Vigía del despliegue', 'vigia')).find((r) => r.tamano === 1);
  assert.equal(suelto.desde, '2026-09-30T07:36:34Z');
  const trasElFallo = fila(mirar('2026-09-30T14:00:00Z'), 'vigia');
  assert.equal(trasElFallo.rojosSeguidos, 1);
  assert.ok(trasElFallo.horasSinVerde > UMBRAL_HORAS_DE_CRON, `${trasElFallo.horasSinVerde} h sin verde`);
  assert.equal(trasElFallo.estado, 'ROJO-RECIENTE');
});

test('SCRUM-1324 · ⑦ lo que no sabe, lo dice: CIEGO, SIN-DECLARAR, y un suelo que reconoce sus cebos', () => {
  // Sin la lista de obligatorios no puede separar lo que bloquea de lo que no: CIEGO, no «todo bien».
  const sinLista = veredicto({ runs: RUNS, ahora: HISTORIAL.tomada, obligatorios: null });
  assert.match(sinLista.ciego, /obligatorios/);
  assert.equal(sinLista.filas.length, 0);
  // Sin runs en la ventana, tampoco: cero runs no es «cero rojos».
  const vacio = veredicto({ runs: RUNS, ahora: '2026-09-01T00:00:00Z', obligatorios: [OBLIGATORIO] });
  assert.match(vacio.ciego, /ningún run/);
  assert.equal(mirar(HISTORIAL.tomada).ciego, null);

  // El rojo sostenido del OBLIGATORIO se ve en su fila y NO es aviso de este instrumento.
  const t = (i) => new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString();
  const jobs = [{ workflow: 'W', job: 'bloquea', unidad: 'runs' }, { workflow: 'W', job: 'no-bloquea', unidad: 'runs' }];
  const runs = Array.from({ length: UMBRAL_ROJOS_SEGUIDOS }, (_, i) => ({
    workflow: 'W', evento: 'push', creado: t(i), sha: `c${i}`, jobs: { bloquea: 'failure', 'no-bloquea': 'failure' },
  }));
  const v = veredicto({ runs, ahora: t(60), obligatorios: ['bloquea'], jobs });
  assert.equal(fila(v, 'bloquea').estado, 'ROJO-SOSTENIDO');
  assert.equal(fila(v, 'no-bloquea').estado, 'ROJO-SOSTENIDO');
  assert.deepEqual(nombres(v.avisos), ['ROJO-SOSTENIDO · W / no-bloquea']);
  // Y con uno menos, ninguno de los dos llega a sostenido.
  const corto = veredicto({ runs: runs.slice(1), ahora: t(60), obligatorios: ['bloquea'], jobs });
  assert.equal(fila(corto, 'no-bloquea').estado, 'ROJO-RECIENTE');
  assert.equal(fila(corto, 'no-bloquea').rojosSeguidos, UMBRAL_ROJOS_SEGUIDOS - 1);

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
  const cierre = mirar(HISTORIAL.tomada);
  const texto = informe(cierre, { ahora: HISTORIAL.tomada, origen: 'historial real', poblacion: `runs=${RUNS.length}` }).split('\n');
  assert.equal(texto[0], `POBLACION runs=1084 · medido ${HISTORIAL.tomada} · historial real`);
  assert.equal(texto.at(-1), `EXIT=${SALIDA_AVISO}`);
  assert.equal(texto.filter((l) => l.startsWith('ROJO-SOSTENIDO')).length, 2);
  assert.match(texto.at(-2), /^AVISO: 2 de 9 jobs/);

  const sano = mirar('2026-09-28T12:00:00Z');
  const limpio = informe(sano, { ahora: '2026-09-28T12:00:00Z', origen: 'historial real', poblacion: 'runs=…' }).split('\n');
  assert.equal(limpio.at(-1), `EXIT=${SALIDA_OK}`);
  assert.match(limpio.at(-2), /^sin avisos: 9 jobs mirados/);

  const ciego = informe(veredicto({ runs: RUNS, ahora: HISTORIAL.tomada, obligatorios: null }), { ahora: HISTORIAL.tomada, origen: 'x', poblacion: 'runs=0' }).split('\n');
  assert.equal(ciego.at(-1), `EXIT=${SALIDA_CIEGO}`);
});
