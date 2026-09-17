// scripts/censo-escalera-por-estado.mjs — PASO 0 de SCRUM-823
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿RECIBE LA LISTA LOS ALBARANES? — la pregunta que decide si SCRUM-823 se puede construir hoy.
//
// SCRUM-823 dice que `jobNextAction` **no ramifica por el estado del Trabajo**: decide por sus
// albaranes y sus facturas. Y declara su dependencia: *«hasta que la lista reciba los albaranes,
// la escalera está tomando decisiones con menos datos en una pantalla que en la otra, y cambiarla
// antes sería construir sobre una mentira»*.
//
// Este censo mide si esa dependencia **sigue viva**, y no lo deduce leyendo el código: pide la
// lista POR SU RUTA REAL y mira los campos que llegan.
//
//   (a) ¿qué CAMPOS trae cada fila de `GET /admin/jobs`? → ¿viaja `albaranes`? ¿y `invoices`?
//   (b) ¿qué decide la escalera sobre esas filas REALES, agrupado por estado del Trabajo?
//   (c) ¿dice el DETALLE lo mismo que la LISTA sobre el MISMO Trabajo?
//
// ⛔ SOLO LECTURA y SÓLO DESARROLLO. Ni un INSERT, ni un UPDATE, ni un DELETE — salvo la sesión
// efímera que hace falta para autenticarse, que se BORRA al terminar. La clave es
// `DATABASE_URL_DEV` y se contrasta con `exigirDestinoCorrecto` —host Y nombre de base, porque
// staging y dev comparten host— antes de abrir nada.
//
// ⚠️ `DATABASE_URL` no vive en un árbol de trabajo (regla 3) y este script NO la crea: la pone en
// el entorno de ESTE proceso y jamás la escribe en disco.
//
// 🔴 LOS SUELOS, y hay TRES, porque hay tres formas distintas de no estar midiendo:
//   1. sin Trabajos en la lista → CIEGO. «Ninguna acción está mal» sobre cero filas es cierto y
//      no dice nada.
//   2. sin la escalera cargada → CIEGO. Sin ella no hay nada que juzgar.
//   3. 🔴 sin NINGÚN albarán en la base, la comparación (c) es TRIVIAL: lista y detalle coinciden
//      porque no hay nada que el detalle pueda tener de más. Eso NO es «las dos pantallas están
//      de acuerdo» — es «este entorno no puede distinguirlo», y se dice con esas palabras.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { exigirDestinoCorrecto } from './_clave-vs-destino.mjs';
import { describirBD } from './_db-guard.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CLAVE = 'DATABASE_URL_DEV';

/** Los CINCO estados de la FSM, cerrados en la Parte L y en `job.service.ts`. */
const ESTADOS = ['pendiente_agendar', 'agendado', 'en_curso', 'terminado', 'cerrado'];

const url = process.env[CLAVE];
if (!url) { console.error('🔴 ' + CLAVE + ' ausente — CIEGO.'); process.exit(2); }
exigirDestinoCorrecto(CLAVE, url);
console.log('destino: ' + describirBD(url) + '\n');

process.env.DATABASE_URL = url.trim().replace(/^['"]|['"]$/g, '');
process.env.WHATSAPP_DRY_RUN = '1';
process.env.DISABLE_CRONS = 'true';
const PORT = Number(process.env.CENSO_PORT || 3481);
process.env.PUBLIC_BASE_URL = `http://127.0.0.1:${PORT}`;

const { prisma } = await import('../dist/core/db/prisma.js');
const { app } = await import('../dist/app.js');

// La escalera, cargada COMO LA CARGA EL NAVEGADOR. No se reimplementa: reimplementarla mediría mi
// copia y no la que ve el profesional.
const w = {};
new Function('window', 'module', fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobNextAction.js'), 'utf8'))(w, {});
const jobNextAction = w.jobNextAction;

const server = app.listen(PORT);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${PORT}`;

let salida = 0;
let sesionId = null;
try {
  if (typeof jobNextAction !== 'function') {
    console.error('🔴 CIEGO (suelo 2): no se pudo cargar `jobNextAction`. Sin la escalera no hay nada que juzgar.');
    salida = 2;
    throw new Error('ciego');
  }

  // 🔴 EL MERCHANT NO SE FIJA A DEDO: se resuelve el que TIENE Trabajos, y se DICE cuál es. Con un
  // `merchantId = 1` a fuego, un entorno cuyos datos vivan en otro inquilino daría cero filas y el
  // censo se declararía ciego sin que el problema fuera la lista.
  const porMerchant = await prisma.job.groupBy({ by: ['merchantId'], _count: { _all: true } });
  if (porMerchant.length === 0) {
    console.error('🔴 CIEGO (suelo 1): no hay NI UN Trabajo en esta base.');
    salida = 2;
    throw new Error('ciego');
  }
  const elegido = porMerchant.sort((a, b) => b._count._all - a._count._all)[0];
  const merchantId = elegido.merchantId;
  console.log(`merchant medido: ${merchantId} (${elegido._count._all} trabajos) · `
    + `otros con trabajos: ${porMerchant.length - 1}`);

  const totalAlbaranes = await prisma.albaran.count({ where: { merchantId } });
  console.log(`albaranes de ese merchant en la base: ${totalAlbaranes}\n`);

  const t = 'censo823-' + crypto.randomBytes(12).toString('hex');
  const s = await prisma.authSession.create({
    data: { merchantId, token: t, type: 'magic_link', expiresAt: new Date(Date.now() + 900000) },
  });
  sesionId = s.id;
  const v = await fetch(`${base}/auth/verify?token=${t}`, { redirect: 'manual' });
  const cookie = (v.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) { console.error('🔴 CIEGO: no se obtuvo sesión.'); salida = 2; throw new Error('ciego'); }
  const get = (r) => fetch(base + r, { headers: { cookie } }).then((x) => x.json());

  const lista = await get('/admin/jobs');
  if (!Array.isArray(lista) || lista.length === 0) {
    console.error('🔴 CIEGO (suelo 1): la lista no devuelve ni un Trabajo.');
    salida = 2;
    throw new Error('ciego');
  }

  // ── (a) QUÉ CAMPOS TRAE LA LISTA · LA PREGUNTA QUE DECIDE ────────────────────────────────
  console.log(`  (a) QUÉ TRAE CADA FILA DE 'GET /admin/jobs'  (${lista.length} trabajos)\n`);
  const claves = [...new Set(lista.flatMap((j) => Object.keys(j)))].sort();
  console.log('      campos: ' + claves.join(', ') + '\n');
  const traeAlbaranes = claves.includes('albaranes');
  console.log(`      🔴 albaranes → ${traeAlbaranes ? 'SÍ VIAJA' : 'NO VIAJA'}   ← la que decide`);
  console.log(`      🔴 invoices  → ${claves.includes('invoices') ? 'SÍ VIAJA' : 'NO VIAJA'}`);
  console.log(`      ✔ status     → ${claves.includes('status') ? 'SÍ VIAJA' : 'NO VIAJA'}   ← el dato por el que SCRUM-823 quiere ramificar`);

  // ── (a2) 🔴 QUÉ PELDAÑOS DE LA ESCALERA SON SIQUIERA ALCANZABLES EN LA LISTA ─────────────
  //
  // Esto NO es una opinión sobre el código: se deriva de los campos que ACABAN DE LLEGAR. La
  // escalera tiene cinco peldaños y cada uno necesita un dato. Si el dato no viaja, ese peldaño
  // no puede salir NUNCA en esta pantalla — y eso explica la medición del ticket sin tener que
  // suponer nada: no es que la escalera «se equivoque», es que en la lista sólo puede contestar
  // dos de sus cinco respuestas.
  const PELDAÑOS = [
    { n: 1, kind: 'cobrar',   necesita: ['status', 'remaining'] },
    { n: 2, kind: 'recordar', necesita: ['invoices', 'customer'] },
    { n: 3, kind: 'firmar',   necesita: ['albaranes'] },
    { n: 4, kind: 'emitir',   necesita: ['albaranes'] },
    { n: 5, kind: 'nuevo',    necesita: [] },
  ];
  console.log('\n  (a2) PELDAÑOS ALCANZABLES EN LA LISTA, derivado de los campos que llegan');
  for (const p of PELDAÑOS) {
    const faltan = p.necesita.filter((c) => !claves.includes(c));
    const veredicto = faltan.length
      ? 'INALCANZABLE — no viaja: ' + faltan.join(', ')
      : 'alcanzable';
    console.log(`      ${faltan.length ? '🔴' : '  '} nivel ${p.n} (${p.kind.padEnd(9)}) → ${veredicto}`);
  }

  // ── (b) QUÉ DECIDE LA ESCALERA SOBRE ESAS FILAS ──────────────────────────────────────────
  console.log('\n  (b) LA ACCIÓN PRINCIPAL DE HOY, POR ESTADO  (escalera real, filas reales)');
  const porEstado = new Map();
  for (const j of lista) {
    const est = j.status || '(sin estado)';
    const a = jobNextAction(j, true);
    const etiqueta = a ? a.label : '(ninguna)';
    if (!porEstado.has(est)) porEstado.set(est, new Map());
    const m = porEstado.get(est);
    m.set(etiqueta, (m.get(etiqueta) || 0) + 1);
  }
  const orden = [...ESTADOS, ...[...porEstado.keys()].filter((e) => !ESTADOS.includes(e))];
  const estadosPresentes = [];
  for (const est of orden) {
    const m = porEstado.get(est);
    if (!m) { console.log(`      ${est.padEnd(18)}   —  (ninguno en esta base)`); continue; }
    estadosPresentes.push(est);
    for (const [etiqueta, n] of [...m.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`      ${est.padEnd(18)} ${String(n).padStart(3)} ×  ${etiqueta}`);
    }
  }
  const cerradasConAlbaran = lista.filter(
    (j) => j.status === 'cerrado' && (jobNextAction(j, true) || {}).kind === 'nuevo');
  console.log(`\n      filas CERRADAS a las que se ofrece «+ Nuevo albarán»: ${cerradasConAlbaran.length}`
    + (cerradasConAlbaran.length ? '  ← ' + cerradasConAlbaran.map((j) => '#' + j.id).join(' ') : ''));
  if (estadosPresentes.length < ESTADOS.length) {
    console.log(`      ⚠️ ALCANCE: esta base sólo tiene ${estadosPresentes.length} de los 5 estados `
      + `(${estadosPresentes.join(', ')}). Los otros NO se han observado aquí: no se afirma nada de ellos.`);
  }

  // ── (c) ¿DICEN LO MISMO LA LISTA Y EL DETALLE? ───────────────────────────────────────────
  console.log('\n  (c) LA MISMA FILA, EN LAS DOS PANTALLAS');
  const muestra = lista.slice(0, 8);
  let discrepan = 0;
  for (const j of muestra) {
    const detalle = await get(`/admin/jobs/${j.id}`);
    const l = (jobNextAction(j, true) || {}).label || '(ninguna)';
    const d = (jobNextAction(detalle, true) || {}).label || '(ninguna)';
    if (l !== d) discrepan += 1;
    const nAlb = Array.isArray(detalle.albaranes) ? detalle.albaranes.length : '(no viaja)';
    console.log(`      ${l === d ? '  ' : '🔴'} #${String(j.id).padEnd(5)} ${String(j.status).padEnd(18)} lista: ${l.padEnd(20)} detalle: ${d.padEnd(20)} (albaranes en detalle: ${nAlb})`);
  }
  // 🔴 SUELO 3 · sin albaranes, esta comparación NO PUEDE distinguir.
  if (totalAlbaranes === 0) {
    console.log(`\n      🔴 ESTE CONTROL NO DISCRIMINA AQUÍ: la base tiene CERO albaranes, así que`);
    console.log('         lista y detalle coinciden por fuerza — el detalle no puede tener nada de');
    console.log('         más. Coincidir NO significa «están de acuerdo»: significa «este entorno');
    console.log('         no puede notar la diferencia». La contradicción de SCRUM-829 sólo se ve');
    console.log('         donde HAYA albaranes.');
  } else {
    console.log(`\n      discrepan ${discrepan} de ${muestra.length} muestreadas.`);
  }

  // ── VEREDICTO ────────────────────────────────────────────────────────────────────────────
  console.log('\n════ VEREDICTO ════');
  if (!traeAlbaranes) {
    console.log('🔴 LA DEPENDENCIA DE SCRUM-816 SIGUE VIVA: la lista NO recibe los albaranes.');
    console.log('   La escalera decide en la lista con MENOS datos que en el detalle, así que');
    console.log('   cambiarla ahora sería construir sobre una mentira. SCRUM-823 NO SE CONSTRUYE.');
    salida = 1;
  } else {
    console.log('✅ La lista YA recibe los albaranes: la dependencia de SCRUM-816 está resuelta y');
    console.log('   SCRUM-823 se puede construir.');
  }
} catch (e) {
  if (e?.message !== 'ciego') {
    console.error('🔴 el censo no pudo completarse. (El error no se vuelca: puede llevar la cadena '
      + 'de conexión dentro. Lección de SCRUM-195.)');
    salida = 2;
  }
} finally {
  // La sesión efímera no se queda: es lo único que este censo escribe.
  if (sesionId) await prisma.authSession.delete({ where: { id: sesionId } }).catch(() => {});
  await prisma.$disconnect().catch(() => {});
  await new Promise((r) => server.close(r));
}
process.exit(salida);
