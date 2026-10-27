// clasifica.mjs <datos-pr.json> <reglas-main.json> [lista de primer padre de main, una linea «sha asunto»]
// Solo LECTURA, sin red. Por cada PR y cada check de su punta dice VERDE, ROJO o CIEGO, y lista los
// checks NO obligatorios que no son VERDE. El nombre del obligatorio se LEE de las reglas de main.
//
//   VERDE  = el ultimo intento del job acabo en `success` Y ejecuto al menos un paso propio.
//   ROJO   = `failure` o `timed_out`.
//   CIEGO  = todo lo demas: `cancelled`, `skipped`, sin acabar, `success` con todos sus pasos
//            propios saltados, check ausente en ese PR, corrida con 0 jobs, PR sin corridas.
import fs from 'node:fs';

const [fDatos, fReglas, fMain] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(fDatos, 'utf8'));
const reglas = JSON.parse(fs.readFileSync(fReglas, 'utf8'));
const OBLIGATORIOS = reglas.filter((r) => r.type === 'required_status_checks').flatMap((r) => r.parameters.required_status_checks.map((c) => c.context));
const min = (a, b) => ((new Date(a) - new Date(b)) / 60000).toFixed(1);
// Pasos que pone GitHub y no el workflow: no cuentan como «hizo algo».
const DE_LA_CASA = /^(Set up job|Complete job|Post )/;
// El paso sin el cual el job no ha medido nada. Lista ESCRITA A MANO tras leer los pasos de cada
// job de esta poblacion: un job que no este aqui solo se juzga por su conclusion. Hace falta porque
// un paso saltado no siempre ciega (los `if: failure()` se saltan en todo job verde).
const PASO_QUE_DECIDE = { 'guards de navegador (fuera de la tanda)': 'Guards de navegador' };
const POR_DISENO = (h) => h.fin === 'skipped' || /^success sin su paso/.test(h.detalle);

function estadoDeJob(j) {
  if (j.estado !== 'completed') return ['CIEGO', `sin acabar (${j.estado})`];
  if (j.fin === 'failure' || j.fin === 'timed_out') return ['ROJO', j.fin];
  if (j.fin === 'success') {
    const decide = PASO_QUE_DECIDE[j.nombre];
    if (decide && j.pasos.find((s) => s.nombre === decide)?.fin !== 'success') return ['CIEGO', `success sin su paso «${decide}» (${j.pasos.find((s) => s.nombre === decide)?.fin ?? 'no esta'})`];
    const propios = j.pasos.filter((s) => !DE_LA_CASA.test(s.nombre));
    const hechos = propios.filter((s) => s.fin === 'success');
    if (propios.length && !hechos.length) return ['CIEGO', 'success con todos sus pasos saltados'];
    return ['VERDE', `success (${hechos.length} de ${propios.length} pasos propios ejecutados)`];
  }
  return ['CIEGO', j.fin ?? 'sin conclusion'];
}

// Por PR: un veredicto por (workflow, nombre de job), del ULTIMO intento de la corrida mas nueva.
function checksDe(pr) {
  const porNombre = new Map();
  const previos = [];
  const sinJobs = [];
  for (const r of [...pr.runs].sort((a, b) => a.creado.localeCompare(b.creado))) {
    if (!r.jobs.length) { sinJobs.push(r); continue; }
    for (const j of r.jobs) {
      const clave = `${r.workflow} / ${j.nombre}`;
      const [estado, detalle] = estadoDeJob(j);
      const fila = { pr: pr.n, clave, workflow: r.workflow, nombre: j.nombre, evento: r.evento, run: r.id, job: j.id, intento: j.intento, intentos: r.intento, estado, detalle, fin: j.fin, acabo: j.acabo, obligatorio: OBLIGATORIOS.includes(j.nombre) };
      const ya = porNombre.get(clave);
      if (!ya) { porNombre.set(clave, fila); continue; }
      const masNuevo = r.id !== ya.run ? true : j.intento > ya.intento;
      if (masNuevo) { previos.push(ya); porNombre.set(clave, fila); } else previos.push(fila);
    }
  }
  return { checks: [...porNombre.values()], previos, sinJobs };
}

const todos = d.prs.map((pr) => ({ pr, ...checksDe(pr) }));
const NOMBRES = [...new Set(todos.flatMap((t) => t.checks.map((c) => c.clave)))].sort();
// Un check que otros PR tienen y este no: CIEGO por ausencia.
for (const t of todos) {
  t.ausentes = NOMBRES.filter((n) => !t.checks.some((c) => c.clave === n));
  if (!t.pr.runs.length) t.sinCorridas = true;
}

const hallazgos = (filtro) => todos.flatMap((t) => [
  ...t.checks.filter((c) => !c.obligatorio && c.estado !== 'VERDE'),
  ...t.ausentes.map((n) => ({ pr: t.pr.n, clave: n, nombre: n.split(' / ')[1], estado: 'CIEGO', detalle: 'ausente: este PR no tiene ese check', fin: null, acabo: null, obligatorio: false })),
]).filter(filtro ?? (() => true));

const L = [];
const p = (s = '') => L.push(s);
p(`RECOGIDO ${d.recogido} (cabecera Date de GitHub) · ventana de merged_at [${d.desde}, ${d.hasta})`);
p(`OBLIGATORIO segun las reglas de main: ${OBLIGATORIOS.map((x) => `«${x}»`).join(', ')}`);
p(`POBLACION: ${d.prs.length} PR · ${d.prs.reduce((a, x) => a + x.runs.length, 0)} corridas · ${todos.reduce((a, t) => a + t.checks.length, 0)} checks (ultimo intento) + ${todos.reduce((a, t) => a + t.previos.length, 0)} de intentos anteriores · ${NOMBRES.length} nombres de check distintos`);
const porDia = {};
for (const x of d.prs) { const dia = new Date(new Date(x.mergeado).getTime() + 2 * 3600000).toISOString().slice(0, 10); porDia[dia] = (porDia[dia] || 0) + 1; }
p(`  por dia de Madrid (UTC+2): ${Object.entries(porDia).map(([k, v]) => `${k}: ${v}`).join(' · ')}`);
p(`  PR sin ninguna corrida: ${todos.filter((t) => t.sinCorridas).length} · corridas con 0 jobs: ${todos.reduce((a, t) => a + t.sinJobs.length, 0)} · PR con algun check ausente: ${todos.filter((t) => t.ausentes.length).length}`);

p();
p('== A · SEGUNDA SONDA: los jobs (actions/runs/<id>/jobs) contra los check-runs (commits/<sha>/check-runs)');
{
  let iguales = 0; let soloJobs = 0; let soloCr = 0; let distintos = 0;
  for (const pr of d.prs) {
    const a = new Map(pr.runs.flatMap((r) => r.jobs.map((j) => [j.id, j.fin])));
    const b = new Map(pr.checkRuns.map((c) => [c.id, c.fin]));
    for (const [id, fin] of a) { if (!b.has(id)) soloJobs++; else if (b.get(id) !== fin) distintos++; else iguales++; }
    for (const id of b.keys()) if (!a.has(id)) soloCr++;
  }
  p(`  mismos id y misma conclusion: ${iguales} · solo en jobs: ${soloJobs} · solo en check-runs: ${soloCr} · misma id y conclusion distinta: ${distintos}`);
}
if (fMain) {
  const lineas = fs.readFileSync(fMain, 'utf8').split(/\r?\n/).filter(Boolean);
  const enMain = new Set(lineas.map((l) => l.split(' ')[0]));
  const porNumero = new Set(lineas.flatMap((l) => [...l.matchAll(/#(\d+)/g)].map((m) => Number(m[1]))));
  const mios = new Set(d.prs.map((x) => x.n));
  p(`  TERCERA SONDA, el primer padre de main en la ventana: ${lineas.length} commits · PR de la API cuyo merge_commit esta entre ellos: ${d.prs.filter((x) => enMain.has(x.merge)).length} de ${d.prs.length} · numeros en los asuntos que la API no trajo: ${[...porNumero].filter((n) => !mios.has(n)).join(' ') || 'ninguno'} · PR de la API que no nombra ningun asunto: ${[...mios].filter((n) => !porNumero.has(n)).join(' ') || 'ninguno'}`);
}

p();
p('== B · TABLA: cada nombre de check, por estado (ultimo intento)');
for (const n of NOMBRES) {
  const c = { VERDE: 0, ROJO: 0, CIEGO: 0 };
  const det = {};
  for (const t of todos) {
    const x = t.checks.find((y) => y.clave === n);
    const e = x ? x.estado : 'CIEGO';
    c[e]++;
    const k = `${e}: ${x ? x.detalle.replace(/\(\d+ de \d+ pasos propios ejecutados\)/, '').trim() : 'ausente'}`;
    det[k] = (det[k] || 0) + 1;
  }
  p(`  ${OBLIGATORIOS.includes(n.split(' / ')[1]) ? '[OBLIGATORIO] ' : ''}${n}`);
  p(`      VERDE ${c.VERDE} · ROJO ${c.ROJO} · CIEGO ${c.CIEGO} · suma ${c.VERDE + c.ROJO + c.CIEGO} de ${d.prs.length}   {${Object.entries(det).map(([k, v]) => `${k} = ${v}`).join(' ; ')}}`);
}

p();
p('== C · CONTROLES, corridos ANTES de dar el numero');
{
  // C1 · cero derivado: un nombre de check que no existe (derivado de los que si existen) y un PR
  // por encima del mayor de la poblacion. La MISMA funcion `hallazgos` tiene que dar 0 con ellos y
  // mas de 0 con el nombre y el PR reales de los que se derivan.
  const real = hallazgos()[0];
  const nombreFalso = `${NOMBRES.reduce((a, b) => (b.length > a.length ? b : a))} +1`;
  const prFalso = Math.max(...d.prs.map((x) => x.n)) + 1;
  p(`  C1 cero derivado · check «${nombreFalso}»: ${hallazgos((h) => h.clave === nombreFalso).length} (debe ser 0) · PR #${prFalso} (el mayor de la poblacion mas uno): ${hallazgos((h) => h.pr === prFalso).length} (debe ser 0)`);
  p(`     y la misma busqueda SI ve lo real · check «${real?.clave}»: ${real ? hallazgos((h) => h.clave === real.clave).length : 'NADA: el control no vale'} · PR #${real?.pr}: ${real ? hallazgos((h) => h.pr === real.pr).length : 'NADA'}`);
  // C2 · un PR sin corridas no puede salir verde: se fabrica uno vacio y se pasa por el mismo camino.
  const vacio = { n: prFalso, runs: [], checkRuns: [] };
  const v = checksDe(vacio);
  const aus = NOMBRES.filter((n) => !v.checks.some((c) => c.clave === n));
  p(`  C2 un PR fabricado con 0 corridas: ${v.checks.filter((c) => c.estado === 'VERDE').length} VERDE · ${aus.length} CIEGO por ausencia de ${NOMBRES.length} nombres (debe ser 0 y ${NOMBRES.length})`);
  // C3 · un job `success` con todo saltado, uno cancelado y uno sin acabar: ninguno puede dar VERDE.
  const fab = [
    ['success, pasos saltados', { estado: 'completed', fin: 'success', pasos: [{ nombre: 'Set up job', fin: 'success' }, { nombre: 'x', fin: 'skipped' }] }],
    ['success de navegador sin su paso', { nombre: Object.keys(PASO_QUE_DECIDE)[0], estado: 'completed', fin: 'success', pasos: [{ nombre: 'checkout', fin: 'success' }, { nombre: Object.values(PASO_QUE_DECIDE)[0], fin: 'skipped' }] }],
    ['success de navegador con su paso', { nombre: Object.keys(PASO_QUE_DECIDE)[0], estado: 'completed', fin: 'success', pasos: [{ nombre: Object.values(PASO_QUE_DECIDE)[0], fin: 'success' }] }],
    ['cancelled', { estado: 'completed', fin: 'cancelled', pasos: [] }],
    ['in_progress', { estado: 'in_progress', fin: null, pasos: [] }],
    ['failure', { estado: 'completed', fin: 'failure', pasos: [] }],
    ['success con un paso hecho', { estado: 'completed', fin: 'success', pasos: [{ nombre: 'x', fin: 'success' }] }],
  ];
  p(`  C3 jobs fabricados · ${fab.map(([n, j]) => `${n} → ${estadoDeJob(j)[0]}`).join(' · ')}`);
}

p();
p('== D · PR VERDES ENTEROS segun este metodo: todo check en VERDE, salvo los `skipped` (el vigia del despliegue no corre en ningun PR)');
{
  const enteros = todos.filter((t) => !t.ausentes.length && t.checks.every((c) => c.estado === 'VERDE' || c.fin === 'skipped'));
  p(`  ${enteros.length} de ${d.prs.length}: ${enteros.map((t) => `#${t.pr.n}`).join(' ')}`);
}

p();
p('== E · HALLAZGOS: checks NO obligatorios que no son VERDE, uno por linea');
p('   (los `skipped` y los `success` sin su paso van contados aparte al final: son CIEGO, pero por una condicion escrita en el workflow)');
{
  const hs = hallazgos((h) => !POR_DISENO(h));
  const prsCon = new Set(hs.map((h) => h.pr));
  const rojos = hs.filter((h) => h.estado === 'ROJO');
  const ciegos = hs.filter((h) => h.estado === 'CIEGO');
  p(`  PR con algun check no obligatorio ROJO: ${new Set(rojos.map((h) => h.pr)).size} · con alguno CANCELADO o ciego (sin contar skipped): ${new Set(ciegos.map((h) => h.pr)).size} · con una cosa u otra: ${prsCon.size} de ${d.prs.length}`);
  p(`  checks: ${rojos.length} ROJO · ${ciegos.length} CIEGO`);
  for (const h of hs.sort((a, b) => a.pr - b.pr || a.clave.localeCompare(b.clave))) {
    const pr = d.prs.find((x) => x.n === h.pr);
    const cuando = h.acabo ? `${Math.abs(min(h.acabo, pr.mergeado)).toFixed(1)} min ${h.acabo > pr.mergeado ? 'DESPUES del' : 'antes del'} merge` : 'sin hora';
    const avisos = pr.comentarios.filter((c) => /rojo|failure|fall/i.test(c.texto)).length;
    p(`  #${h.pr}  ${h.estado}  ${h.fin ?? '-'}  «${h.nombre}»  job ${h.job ?? '-'}  acabo ${h.acabo ?? '-'} · merge ${pr.mergeado} · ${cuando} · comentarios en el PR ${pr.comentarios.length} (que hablan de rojo o fallo: ${avisos})  · ${pr.rama}`);
  }
  const sk = hallazgos(POR_DISENO);
  const porNombre = {};
  for (const h of sk) porNombre[`${h.nombre} [${h.detalle}]`] = (porNombre[`${h.nombre} [${h.detalle}]`] || 0) + 1;
  p(`  aparte, CIEGO por una condicion escrita en el workflow: ${sk.length} → ${Object.entries(porNombre).map(([k, v]) => `«${k}» ${v}`).join(' · ') || 'ninguno'}`);
}

p();
p('== F · INTENTOS ANTERIORES y corridas sustituidas de la misma punta (no cuentan arriba: los tapo un intento posterior)');
for (const t of todos) for (const x of t.previos.filter((y) => y.estado !== 'VERDE' && !POR_DISENO(y))) p(`  #${x.pr}  ${x.estado}  ${x.fin}  «${x.nombre}»  job ${x.job}  intento ${x.intento} de ${x.intentos}${x.obligatorio ? '  [OBLIGATORIO]' : ''}`);

p();
p('== G · EL OBLIGATORIO en estos mismos PR (no es la pregunta; va para que la tabla tenga su otra mitad)');
{
  const c = {};
  for (const t of todos) for (const x of t.checks.filter((y) => y.obligatorio)) c[x.estado] = (c[x.estado] || 0) + 1;
  p(`  ${Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' · ')} · PR sin el obligatorio: ${todos.filter((t) => !t.checks.some((y) => y.obligatorio)).length}`);
}
console.log(L.join('\n'));
