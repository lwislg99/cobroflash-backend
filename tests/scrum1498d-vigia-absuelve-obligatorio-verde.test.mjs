// tests/scrum1498d-vigia-absuelve-obligatorio-verde.test.mjs — SCRUM-1498d
//
// Decisión del fundador del 24-oct (SCRUM-1498 c.20795, «Sí: basta con el obligatorio en verde»): con un
// grupo de concurrencia por job (SCRUM-1498c, #2841), un commit SUSTITUIDO cuyo «build + tests» dio
// success queda absuelto aunque el meta-guard (u otro job largo) no llegara a arrancar en él. En la
// PUNTA no: allí el meta-guard se sigue exigiendo y su falta se avisa. Un sustituido con el obligatorio
// en ROJO sigue sin absolverse, y el «cancelado con 0 jobs» se absuelve como hoy (1393e). Ampliación
// c.20802: el sustituido SIN veredicto lo absuelve el siguiente obligatorio con veredicto si es verde;
// si es rojo, no, y el aviso dice cuál.
//
// Un caso SEMBRADO por clase, sin red. La forma del job sustituido (`cancelled` con `steps: []`) es la
// que da la API a un job que nunca arrancó; que GitHub la dé así en un grupo por job sólo se verá en
// `main` tras #2841 (CIEGO declarado en el registro, tramo 1498d).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  veredictoDeCommit, accionDelIssue, absolucionDeSustituidos, bajarPorSustituidos, canceladoSinArrancar, marcaDeAviso,
  JOBS_DEL_CI, JOB_META_GUARD, JOB_OBLIGATORIO, CAUSA_SUSTITUIDO, CAUSA_SUSTITUIDO_CON_OBLIGATORIO_VERDE,
  CAUSA_OBLIGATORIO_SUSTITUIDO,
} from '../scripts/vigia-silencio-de-main.mjs';

const AHORA = '2026-10-24T16:00:00Z';
const TRINQUETE = 'trinquete · ningún test nuevo mide la zona de la máquina';
const corrio = (name, conclusion) => ({ name, status: 'completed', conclusion, steps: [{ name: 'paso', status: 'completed', conclusion }] });
const sinArrancar = (name) => ({ name, status: 'completed', conclusion: 'cancelled', steps: [] });
// Los seis jobs del CI: los de `sinArrancarLos` cancelados sin arrancar, el obligatorio con `obligatorio`, el resto en success.
const jobsDe = (obligatorio, sinArrancarLos = [JOB_META_GUARD, TRINQUETE]) => JOBS_DEL_CI.map((n) => {
  if (sinArrancarLos.includes(n)) return sinArrancar(n);
  return n === JOB_OBLIGATORIO ? corrio(n, obligatorio) : corrio(n, 'success');
});
const run = (conclusion) => ({ status: 'completed', conclusion, created_at: '2026-10-24T15:30:00Z', html_url: 'https://x/run' });
const juez = (sha, r, jobs) => veredictoDeCommit({ sha, run: r, jobs, ahora: AHORA, topeMin: 130 });

// Las cinco clases del encargo, más el verde de siempre.
const VERDE = (sha) => juez(sha, run('success'), JOBS_DEL_CI.map((n) => corrio(n, 'success')));
const ROJO = (sha) => juez(sha, run('failure'), JOBS_DEL_CI.map((n) => corrio(n, n === JOB_OBLIGATORIO ? 'failure' : 'success')));
const SUSTITUIDO_VERDE = (sha) => juez(sha, run('cancelled'), jobsDe('success'));
const SUSTITUIDO_ROJO = (sha) => juez(sha, run('failure'), jobsDe('failure'));
const SUSTITUIDO_SIN_VEREDICTO = (sha) => juez(sha, run('cancelled'), jobsDe(null, [JOB_OBLIGATORIO, JOB_META_GUARD]));
const CANCELADO_0_JOBS = (sha) => juez(sha, run('cancelled'), []);

const P = 'a'.repeat(40); // la punta
const V = 'b'.repeat(40); // su padre
const LINEA = [P, V];
const pasada = (veredictos, linea = LINEA, punta = P) => ({ veredictos, ahora: AHORA, origen: 'siembra', urlDelRun: 'https://x/p', punta, linea });

test('SCRUM-1498d · las clases sembradas son lo que dicen ser, y la causa sale del DATO', () => {
  assert.equal(JOB_OBLIGATORIO, JOBS_DEL_CI[0], 'el obligatorio es «build + tests», el primero del censo');
  assert.ok(JOBS_DEL_CI.includes(JOB_META_GUARD) && JOBS_DEL_CI.includes(TRINQUETE));
  const sv = SUSTITUIDO_VERDE(V);
  assert.deepEqual([sv.estado, sv.causa], ['CIEGO', CAUSA_SUSTITUIDO_CON_OBLIGATORIO_VERDE], sv.motivo);
  assert.deepEqual(sv.jobs.map((j) => j.name).sort(), [JOB_META_GUARD, TRINQUETE].sort(), 'nombra los que no arrancaron');
  assert.equal(SUSTITUIDO_ROJO(V).estado, 'CIEGO', 'el meta-guard sin arrancar y el obligatorio en rojo: CIEGO del meta-guard, nombrando el rojo');
  assert.match(SUSTITUIDO_ROJO(V).motivo, /además en rojo: «build \+ tests/);
  assert.notEqual(SUSTITUIDO_ROJO(V).causa, CAUSA_SUSTITUIDO_CON_OBLIGATORIO_VERDE);
  assert.deepEqual([SUSTITUIDO_SIN_VEREDICTO(V).estado, SUSTITUIDO_SIN_VEREDICTO(V).causa], ['CIEGO', CAUSA_OBLIGATORIO_SUSTITUIDO]);
  assert.equal(SUSTITUIDO_SIN_VEREDICTO(V).obligatorio, null);
  assert.deepEqual([SUSTITUIDO_VERDE(V).obligatorio, SUSTITUIDO_ROJO(V).obligatorio, CANCELADO_0_JOBS(V).obligatorio], ['success', 'failure', null]);
  assert.equal(CANCELADO_0_JOBS(V).causa, CAUSA_SUSTITUIDO);
  assert.equal(VERDE(V).estado, 'VERDE');
});

test('SCRUM-1498d · «sin arrancar» se lee de los PASOS: cortado a mitad, o sin pasos leídos, no lo es', () => {
  assert.equal(canceladoSinArrancar(sinArrancar(JOB_META_GUARD)), true);
  assert.equal(canceladoSinArrancar({ ...sinArrancar(JOB_META_GUARD), steps: [{ name: 'Set up job', status: 'queued', conclusion: null }] }), true);
  assert.equal(canceladoSinArrancar({ ...sinArrancar(JOB_META_GUARD), steps: [{ name: 'Set up job', status: 'completed', conclusion: 'success' }] }), false);
  assert.equal(canceladoSinArrancar({ ...sinArrancar(JOB_META_GUARD), steps: undefined }), false, 'pasos sin leer: no se sabe');
  assert.equal(canceladoSinArrancar(corrio(JOB_META_GUARD, 'success')), false);
  // el meta-guard CORTADO a sus 30 min (arrancó) con el obligatorio en verde sigue siendo su CIEGO, que no se absuelve
  const cortado = JOBS_DEL_CI.map((n) => (n === JOB_META_GUARD ? { ...corrio(n, 'cancelled') } : corrio(n, 'success')));
  const v = juez(V, run('cancelled'), cortado);
  assert.equal(v.estado, 'CIEGO');
  assert.notEqual(v.causa, CAUSA_SUSTITUIDO_CON_OBLIGATORIO_VERDE, v.motivo);
  assert.equal(absolucionDeSustituidos([v, VERDE(P)], LINEA).absueltos.size, 0);
  // y sin los pasos leídos, tampoco se absuelve
  const sinPasos = jobsDe('success').map(({ steps, ...j }) => (j.conclusion === 'cancelled' ? j : { ...j, steps }));
  assert.notEqual(juez(V, run('cancelled'), sinPasos).causa, CAUSA_SUSTITUIDO_CON_OBLIGATORIO_VERDE);
});

test('SCRUM-1498d · con la señal de nombres CIEGA en el obligatorio no se absuelve: su verde no midió', () => {
  const senalCiega = jobsDe('success').map((j) => (j.name === JOB_OBLIGATORIO ? { ...j, senal: { estado: 'no-pudo', motivo: 'cebo' } } : j));
  const v = juez(V, run('cancelled'), senalCiega);
  assert.equal(v.estado, 'CIEGO');
  assert.notEqual(v.causa, CAUSA_SUSTITUIDO_CON_OBLIGATORIO_VERDE, v.motivo);
});

test('SCRUM-1498d · con un job declarado AUSENTE no se absuelve', () => {
  const v = juez(V, run('cancelled'), jobsDe('success').filter((j) => j.name !== TRINQUETE));
  assert.equal(v.estado, 'CIEGO');
  assert.notEqual(v.causa, CAUSA_SUSTITUIDO_CON_OBLIGATORIO_VERDE, v.motivo);
});

test('SCRUM-1498d · SIEMBRA sustituido-verde → ABSUELTO por su propio obligatorio, y el Issue cierra listándolo', () => {
  const { absueltos } = absolucionDeSustituidos([SUSTITUIDO_VERDE(V), VERDE(P)], LINEA);
  assert.equal(absueltos.get(V), V, 'lo absuelve él mismo, no un verde posterior');
  const a = accionDelIssue(pasada([SUSTITUIDO_VERDE(V), VERDE(P)]), { estado: 'abierto' });
  assert.deepEqual(a.pasos, ['comentar', 'cerrar'], a.motivo);
  assert.ok(a.cuerpo.includes(`\`${V.slice(0, 12)}\` — sin meta-guard (sustituido en la cola de su job), absuelto por su propio «${JOB_OBLIGATORIO}» en verde`), a.cuerpo);
  assert.ok(!a.cuerpo.includes(marcaDeAviso(SUSTITUIDO_VERDE(V))), 'no se avisa lo que se absuelve');
  // sin un verde por encima también queda callado: no depende de ningún otro commit
  const enCurso = accionDelIssue(pasada([SUSTITUIDO_VERDE(V), { ...juez(P, { status: 'in_progress', conclusion: null, created_at: AHORA }, null) }]), { estado: 'cerrado' });
  assert.deepEqual(enCurso.pasos, [], enCurso.motivo);
  // y si ya estaba pendiente en el Issue (avisado cuando era la punta), esta pasada lo saca
  const pendiente = accionDelIssue(pasada([SUSTITUIDO_VERDE(V), VERDE(P)]), { previos: marcaDeAviso(SUSTITUIDO_VERDE(V)), estado: 'abierto' });
  assert.deepEqual(pendiente.pasos, ['comentar', 'cerrar'], pendiente.motivo);
});

test('SCRUM-1498d · SIEMBRA sustituido-rojo → NO se absuelve: avisa, aunque la punta salga verde', () => {
  assert.equal(absolucionDeSustituidos([SUSTITUIDO_ROJO(V), VERDE(P)], LINEA).absueltos.size, 0);
  const a = accionDelIssue(pasada([SUSTITUIDO_ROJO(V), VERDE(P)]), { estado: 'cerrado' });
  assert.deepEqual(a.pasos, ['reabrir', 'comentar'], a.motivo);
  assert.ok(a.cuerpo.includes(marcaDeAviso(SUSTITUIDO_ROJO(V))));
});

// c.20802 · «Los cubre el siguiente verde»: el sustituido sin veredicto lo absuelve el SIGUIENTE obligatorio con veredicto.
const SIN_VEREDICTO_SOLO = (sha) => juez(sha, run('cancelled'), jobsDe(null, [JOB_OBLIGATORIO]));
const X = 'd'.repeat(40); // un commit entre V y la punta

test('SCRUM-1498d · SIEMBRA sustituido-sin-veredicto + siguiente obligatorio VERDE → absuelto por él (c.20802)', () => {
  for (const sinVeredicto of [SUSTITUIDO_SIN_VEREDICTO(V), SIN_VEREDICTO_SOLO(V)]) {
    assert.equal(sinVeredicto.causa, CAUSA_OBLIGATORIO_SUSTITUIDO, sinVeredicto.motivo);
    assert.equal(absolucionDeSustituidos([sinVeredicto, VERDE(P)], LINEA).absueltos.get(V), P);
    const a = accionDelIssue(pasada([sinVeredicto, VERDE(P)]), { estado: 'abierto' });
    assert.deepEqual(a.pasos, ['comentar', 'cerrar'], a.motivo);
    assert.ok(a.cuerpo.includes(`\`${V.slice(0, 12)}\` — no verificado, absuelto por el verde de \`${P.slice(0, 12)}\``), a.cuerpo);
  }
  // el siguiente con veredicto puede ser un sustituido con su obligatorio en verde, o un ROJO de otro job
  assert.equal(absolucionDeSustituidos([SUSTITUIDO_SIN_VEREDICTO(V), SUSTITUIDO_VERDE(X), VERDE(P)], [P, X, V]).absueltos.get(V), X);
  const rojoDeOtro = juez(X, run('failure'), JOBS_DEL_CI.map((n) => corrio(n, n === TRINQUETE ? 'failure' : 'success')));
  assert.deepEqual([rojoDeOtro.estado, rojoDeOtro.obligatorio], ['ROJO', 'success']);
  assert.equal(absolucionDeSustituidos([SUSTITUIDO_SIN_VEREDICTO(V), rojoDeOtro, VERDE(P)], [P, X, V]).absueltos.get(V), X);
  // y salta los que tampoco dieron veredicto: lo cubre el primero que sí
  assert.equal(absolucionDeSustituidos([SUSTITUIDO_SIN_VEREDICTO(V), SIN_VEREDICTO_SOLO(X), VERDE(P)], [P, X, V]).absueltos.get(V), P);
});

test('SCRUM-1498d · SIEMBRA sustituido-sin-veredicto + siguiente obligatorio ROJO → NO se absuelve, y el aviso dice cuál', () => {
  const { absueltos, tapados } = absolucionDeSustituidos([SUSTITUIDO_SIN_VEREDICTO(V), SUSTITUIDO_ROJO(X), VERDE(P)], [P, X, V]);
  assert.equal(absueltos.has(V), false, 'un verde MÁS ARRIBA no salta el rojo: manda el siguiente');
  assert.equal(tapados.get(V), X);
  const a = accionDelIssue(pasada([SUSTITUIDO_SIN_VEREDICTO(V), ROJO(P)]), { estado: 'cerrado' });
  assert.deepEqual(a.pasos, ['reabrir', 'comentar'], a.motivo);
  assert.ok(a.cuerpo.includes(`el siguiente «${JOB_OBLIGATORIO}» con veredicto, \`${P.slice(0, 12)}\`, salió en ROJO: no se absuelve`), a.cuerpo);
});

test('SCRUM-1498d · SIEMBRA sustituido-sin-veredicto con el siguiente aún CORRIENDO → espera; sin nada encima o con un hueco → no', () => {
  const enCurso = juez(P, { status: 'in_progress', conclusion: null, created_at: AHORA }, null);
  assert.equal(enCurso.estado, 'CORRIENDO');
  const { enEspera } = absolucionDeSustituidos([SUSTITUIDO_SIN_VEREDICTO(V), enCurso], LINEA);
  assert.ok(enEspera.has(V));
  assert.deepEqual(accionDelIssue(pasada([SUSTITUIDO_SIN_VEREDICTO(V), enCurso]), { estado: 'cerrado' }).pasos, []);
  // en la punta, nada encima: no se absuelve
  assert.equal(absolucionDeSustituidos([SUSTITUIDO_SIN_VEREDICTO(P), VERDE(V)], LINEA).absueltos.size, 0);
  // un commit sin juzgar entre medias: no se sabe qué dio, no se absuelve
  assert.equal(absolucionDeSustituidos([SUSTITUIDO_SIN_VEREDICTO(V), VERDE(P)], [P, X, V]).absueltos.size, 0);
});

test('SCRUM-1498d · SIEMBRA punta sin meta-guard → AVISO, y no cierra', () => {
  const punta = SUSTITUIDO_VERDE(P);
  assert.equal(absolucionDeSustituidos([punta, VERDE(V)], LINEA).absueltos.size, 0, 'en la punta no se absuelve');
  const a = accionDelIssue(pasada([punta, VERDE(V)]), { estado: 'cerrado' });
  assert.deepEqual(a.pasos, ['reabrir', 'comentar'], a.motivo);
  assert.ok(a.cuerpo.includes(marcaDeAviso(punta)), a.cuerpo);
  assert.match(a.cuerpo, /sin arrancar: .*«meta-guard · los guards caen cuando deben»/);
  assert.match(a.motivo, /la punta .* sale CIEGO/);
  // la misma forma, ya con un commit encima, se absuelve: lo que decide es la posición en la línea
  assert.equal(absolucionDeSustituidos([SUSTITUIDO_VERDE(V), VERDE(P)], LINEA).absueltos.get(V), V);
});

test('SCRUM-1498d · SIEMBRA cancelado-0-jobs → absuelto como hoy (1393e), por el verde que lo contiene', () => {
  const { absueltos } = absolucionDeSustituidos([CANCELADO_0_JOBS(V), VERDE(P)], LINEA);
  assert.equal(absueltos.get(V), P);
  const a = accionDelIssue(pasada([CANCELADO_0_JOBS(V), VERDE(P)]), { estado: 'abierto' });
  assert.deepEqual(a.pasos, ['comentar', 'cerrar']);
  assert.ok(a.cuerpo.includes(`\`${V.slice(0, 12)}\` — no verificado, absuelto por el verde de \`${P.slice(0, 12)}\``));
});

test('SCRUM-1498d · la bajada por la línea sigue por los sustituidos por job y para en el primero que no lo es', async () => {
  const [A, B, C, D, E, F] = ['1', '2', '3', '4', '5', '6'].map((c) => c.repeat(40));
  const linea = [A, B, C, D, E, F];
  const cortado = (sha) => juez(sha, run('cancelled'), JOBS_DEL_CI.map((n) => corrio(n, n === JOB_META_GUARD ? 'cancelled' : 'success')));
  const github = { [B]: SUSTITUIDO_VERDE(B), [C]: CANCELADO_0_JOBS(C), [D]: SUSTITUIDO_SIN_VEREDICTO(D), [E]: cortado(E), [F]: SUSTITUIDO_VERDE(F) };
  const veredictos = [VERDE(A)];
  const pedidos = [];
  await bajarPorSustituidos(veredictos, linea, async (sha) => { pedidos.push(sha); veredictos.push(github[sha]); return github[sha]; });
  assert.deepEqual(pedidos, [B, C, D, E], 'baja por B, C y D, para en E (meta-guard cortado) y no llega a F');
  const { absueltos } = absolucionDeSustituidos(veredictos, linea);
  assert.deepEqual([absueltos.get(B), absueltos.get(C), absueltos.get(D), absueltos.has(E)], [B, A, B, false]);
  // también baja desde un ROJO de otro job cuyo obligatorio dio verde: es el «siguiente verde» de sus sustituidos
  const rojoDeOtro = juez(A, run('failure'), JOBS_DEL_CI.map((n) => corrio(n, n === TRINQUETE ? 'failure' : 'success')));
  const desdeRojo = [rojoDeOtro];
  await bajarPorSustituidos(desdeRojo, [A, D], async (sha) => { const v = SUSTITUIDO_SIN_VEREDICTO(sha); desdeRojo.push(v); return v; });
  assert.equal(absolucionDeSustituidos(desdeRojo, [A, D]).absueltos.get(D), A);
});
