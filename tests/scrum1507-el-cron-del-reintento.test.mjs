// tests/scrum1507-el-cron-del-reintento.test.mjs — SCRUM-1507 (el PR-2 de SCRUM-1404)
//
// EL REINTENTO DEL SELLADO, ENCENDIDO. Lo que este fichero sujeta:
//
//   ① que la tarea está en `src/core/cron/cron.ts` tal como la escribió su dueño (S1, SCRUM-1507
//      c.19344 §3): cada minuto, `noOverlap`, y las tres funciones del módulo dentro del callback.
//      Leído por AST, no por texto;
//   ② que `startCronJobs` la MONTA de verdad: se llama con un `node-cron` doblado y se mira qué
//      recibe `schedule`;
//   ③ qué dice el log en cada conclusión, y a qué hora: el callback real, con la pasada doblada y
//      el reloj fijado;
//   ④ el estado decidido por el fundador (c.20227): el PR-2 va SIN fecha de corte, así que la
//      tarea corre, no consulta la base y dice «inactivo». Encenderlo es un paso aparte suyo.
//
// ⚠️ LO QUE NO SUJETA: aquí no se sella nada ni se toca ninguna base. La pasada en sí la sujeta
// `tests/scrum1404b-el-reintento-del-sellado.test.mjs`; que no re-sella, `scrum1330`. Cuántas
// réplicas corren los crons en producción (`noOverlap` no protege entre PROCESOS) no está medido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const requiere = createRequire(import.meta.url);
const RAIZ = path.resolve(import.meta.dirname, '..');
const CRON_TS = 'src/core/cron/cron.ts';
const MODULO = '../../modules/invoicing/domain/reintentoSellado';
const NOMBRE = 'reintento de sellado (cada minuto)';
const TRES = ['conclusionDelReintento', 'reintentarSelladosPendientes', 'resumenDelReintento'];

// ── ① el bloque, por AST ───────────────────────────────────────────────────────────────────────

/** Las llamadas `programar('<nombre>', cron.schedule(expr, callback, opciones?))` de una fuente. */
function tareasProgramadas(fuente) {
  const arbol = ts.createSourceFile('cron.ts', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const tareas = [];
  const importados = new Map();
  const ver = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const nombres = n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)
        ? n.importClause.namedBindings.elements.map((e) => e.name.text) : [];
      importados.set(n.moduleSpecifier.text, nombres);
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'programar'
      && n.arguments.length === 2 && ts.isStringLiteral(n.arguments[0])) {
      const sch = n.arguments[1];
      const esSchedule = ts.isCallExpression(sch) && ts.isPropertyAccessExpression(sch.expression)
        && sch.expression.name.text === 'schedule';
      const [expr, callback, opciones] = esSchedule ? sch.arguments : [];
      const llamadas = new Set();
      const dentro = (m) => {
        if (ts.isCallExpression(m) && ts.isIdentifier(m.expression)) llamadas.add(m.expression.text);
        ts.forEachChild(m, dentro);
      };
      if (callback) dentro(callback);
      const noOverlap = opciones && ts.isObjectLiteralExpression(opciones)
        && opciones.properties.some((p) => ts.isPropertyAssignment(p) && p.name.getText(arbol) === 'noOverlap'
          && p.initializer.kind === ts.SyntaxKind.TrueKeyword);
      tareas.push({
        nombre: n.arguments[0].text,
        expr: expr && ts.isStringLiteral(expr) ? expr.text : null,
        llamadas: [...llamadas].sort(),
        noOverlap: Boolean(noOverlap),
      });
    }
    ts.forEachChild(n, ver);
  };
  ver(arbol);
  return { tareas, importados };
}

const BLOQUE_SEMBRADO = `import cron from 'node-cron';
import { reintentarSelladosPendientes, conclusionDelReintento, resumenDelReintento } from '${MODULO}';
export function startCronJobs() {
  const programar = (n: string, _t: unknown) => {};
  programar('${NOMBRE}', cron.schedule('* * * * *', async () => {
    const parte = await reintentarSelladosPendientes();
    console.log(conclusionDelReintento(parte), resumenDelReintento(parte));
  }, { noOverlap: true }));
}`;

test('SCRUM-1507 · ① el lector del bloque distingue: lo ve sembrado, y sin él dice que no está', () => {
  // Control SEMBRADO, no prestado del árbol: si mañana alguien quita el bloque de cron.ts, este
  // caso sigue demostrando que el lector sabe verlo, y el siguiente cae.
  const con = tareasProgramadas(BLOQUE_SEMBRADO);
  assert.equal(con.tareas.length, 1);
  assert.deepEqual(con.tareas[0], { nombre: NOMBRE, expr: '* * * * *', llamadas: TRES, noOverlap: true });
  const sin = tareasProgramadas(BLOQUE_SEMBRADO.replace(", { noOverlap: true }", '').replace(/programar\('[^']+'/, "programar('otra cosa'"));
  assert.equal(sin.tareas.filter((t) => t.nombre === NOMBRE).length, 0, 'sin el bloque, el lector no lo inventa');
  assert.equal(sin.tareas[0].noOverlap, false, 'sin la opción, el lector no la inventa');
});

test('SCRUM-1507 · ① cron.ts lleva el bloque de S1 (c.19344 §3): cada minuto, noOverlap y las tres funciones', () => {
  const { tareas, importados } = tareasProgramadas(fs.readFileSync(path.join(RAIZ, CRON_TS), 'utf8'));
  assert.ok(tareas.length >= 7, `población: ${tareas.length} tareas programadas en ${CRON_TS}`);
  const mias = tareas.filter((t) => t.nombre === NOMBRE);
  assert.equal(mias.length, 1, `la tarea «${NOMBRE}» se monta UNA vez: ${tareas.map((t) => t.nombre).join(' | ')}`);
  const [t] = mias;
  assert.equal(t.expr, '* * * * *', 'cada minuto: `plazoDeAgotamientoS` supone una pasada por minuto o más rápida');
  assert.equal(t.noOverlap, true, 'una pasada puede durar más de un minuto: sin noOverlap la siguiente arranca con la anterior a medias');
  for (const f of TRES) assert.ok(t.llamadas.includes(f), `el callback llama a ${f}: ${t.llamadas.join(', ')}`);
  assert.deepEqual([...(importados.get(MODULO) ?? [])].sort(), TRES, `cron.ts importa exactamente las tres de ${MODULO}`);
});

// ── ② y ③ la tarea montada, con node-cron y la pasada doblados ──────────────────────────────────

const NODE_CRON = requiere('node-cron');
const REINTENTO = requiere('../dist/modules/invoicing/domain/reintentoSellado.js');

/** Arranca `startCronJobs` con `schedule` doblado y devuelve lo que se montó. */
function montar() {
  const montadas = [];
  const objetivos = [NODE_CRON, NODE_CRON.default].filter((o) => o && typeof o.schedule === 'function');
  const originales = objetivos.map((o) => o.schedule);
  const log = console.log;
  for (const o of objetivos) o.schedule = (expr, callback, opciones) => { montadas.push({ expr, callback, opciones }); return { stop() {} }; };
  console.log = () => {};
  try {
    const { startCronJobs } = requiere('../dist/core/cron/cron.js');
    const parte = startCronJobs();
    return { montadas, parte };
  } finally {
    objetivos.forEach((o, i) => { o.schedule = originales[i]; });
    console.log = log;
  }
}

test('SCRUM-1507 · ② startCronJobs MONTA la tarea: schedule la recibe cada minuto y con noOverlap', () => {
  const { montadas, parte } = montar();
  assert.ok(montadas.length >= 7, `población: ${montadas.length} llamadas a schedule`);
  assert.equal(montadas.length, parte.programados.length, 'cada tarea anotada es una tarea montada');
  const i = parte.programados.indexOf(NOMBRE);
  assert.ok(i >= 0, `programados: ${parte.programados.join(' | ')}`);
  assert.equal(montadas[i].expr, '* * * * *');
  assert.deepEqual(montadas[i].opciones, { noOverlap: true });
  assert.deepEqual(parte.avisosSinProgramar, [], 'la tarea nueva no desplaza a las de correo');
});

const nombrada = { id: 1507, numero: 'F-2026-1507', merchantId: 4404 };
const parteDe = (sobre) => ({
  activo: true, motivo: null, desde: '2026-10-22T00:00:00.000Z', candidatas: 0, truncado: false,
  selladas: [], noAplica: [], siguenPendientes: [], enEspera: 0, agotadas: [], conError: [],
  conHuellaSinMarcar: [], fueraDePlazo: [], ...sobre,
});

/** Corre el callback real con la pasada doblada y el reloj fijado; devuelve qué escribió y dónde.
 *  `resultado` es el parte que devuelve la pasada, un Error que lanza, o la pasada misma (función). */
async function pasada(t, minuto, resultado) {
  const { montadas, parte } = montar();
  const i = parte.programados.indexOf(NOMBRE);
  assert.ok(i >= 0, `la tarea no está montada: ${parte.programados.join(' | ')}`);
  const callback = montadas[i].callback;
  const original = REINTENTO.reintentarSelladosPendientes;
  REINTENTO.reintentarSelladosPendientes = typeof resultado === 'function' ? resultado : async () => {
    if (resultado instanceof Error) throw resultado;
    return resultado;
  };
  const ahora = new Date();
  ahora.setMinutes(minuto, 0, 0);
  t.mock.timers.enable({ apis: ['Date'], now: ahora.getTime() });
  const escrito = [];
  const guardados = { log: console.log, warn: console.warn, error: console.error };
  for (const canal of Object.keys(guardados)) console[canal] = (...a) => escrito.push([canal, a.join(' ')]);
  try {
    await callback();
  } finally {
    Object.assign(console, guardados);
    REINTENTO.reintentarSelladosPendientes = original;
    t.mock.timers.reset();
  }
  return escrito;
}

test('SCRUM-1507 · ③ lo que hay que mirar sale en ROJO y en cada pasada, no sólo en punto', async (t) => {
  const e = await pasada(t, 7, parteDe({ candidatas: 1, agotadas: [{ ...nombrada, fallos: 5 }] }));
  assert.equal(e.length, 1, JSON.stringify(e));
  assert.equal(e[0][0], 'error');
  assert.match(e[0][1], /🔴/);
  assert.match(e[0][1], /agotadas 1: F-2026-1507 \(factura 1507, merchant 4404\)/);
});

test('SCRUM-1507 · ③ una pasada que selló algo se dice siempre', async (t) => {
  const e = await pasada(t, 7, parteDe({ candidatas: 1, selladas: [nombrada] }));
  assert.deepEqual(e.map(([c]) => c), ['log']);
  assert.match(e[0][1], /selladas 1/);
});

test('SCRUM-1507 · ③ «nada que mirar» e «inactivo» callan fuera del minuto 0 y hablan en punto', async (t) => {
  assert.deepEqual(await pasada(t, 7, parteDe({})), [], 'nada que mirar, minuto 7: calla');
  const enPunto = await pasada(t, 0, parteDe({}));
  assert.deepEqual(enPunto.map(([c]) => c), ['log'], 'nada que mirar, en punto: una línea');
  assert.match(enPunto[0][1], /candidatas 0/);

  const inactivo = { ...parteDe({}), activo: false, motivo: 'sin fecha de corte: el reintento no está activado', desde: null };
  assert.deepEqual(await pasada(t, 7, inactivo), [], 'inactivo, minuto 7: calla');
  const aviso = await pasada(t, 0, inactivo);
  assert.deepEqual(aviso.map(([c]) => c), ['warn'], 'inactivo, en punto: un aviso');
  assert.match(aviso[0][1], /⚠️.*INACTIVO/);
});

test('SCRUM-1507 · ③ una pasada que no pudo leer las candidatas lo dice: no se traga', async (t) => {
  const e = await pasada(t, 7, new Error('la base no contesta'));
  assert.deepEqual(e.map(([c]) => c), ['error']);
  assert.match(e[0][1], /la pasada no miró nada.*la base no contesta/);
});

// ── ④ la fecha de corte: el PR-2 va SIN fecha (c.20227) ────────────────────────────────────────
//
// Decisión del fundador (SCRUM-1507 c.20227, «Sí» a la opción (a)): el PR-2 entra SIN fecha, y
// encender el reintento —escribir `REINTENTO_ACTIVO_DESDE`— es un paso aparte suyo. Este caso
// sujeta ese estado con la constante REAL y el callback REAL; sólo la base va doblada.
// ⚠️ LO QUE NO PUEDE: distinguir una fecha firmada de una sin firmar. La firma vive en Jira y este
// test no la ve, y un registro escrito por quien pone la fecha no es su firma (A10). Por eso afirma
// `null` a secas: el día que el fundador encienda, este caso cae y se cambia EN EL MISMO PR que la
// fecha, citando su comentario. Que la fecha sea legible y no anterior al mecanismo lo sujeta
// `tests/scrum1404b-el-reintento-del-sellado.test.mjs` ②.

const PASADA_REAL = REINTENTO.reintentarSelladosPendientes;
/** Una base doblada que apunta cada consulta y no devuelve nada. */
function baseQueCuenta() {
  const llamadas = [];
  return { llamadas, invoice: { findMany: async (a) => { llamadas.push(a.where); return []; } } };
}

test('SCRUM-1507 · ④ sin fecha (c.20227): la tarea corre, no consulta la base y dice INACTIVO en punto', async (t) => {
  assert.equal(REINTENTO.REINTENTO_ACTIVO_DESDE, null,
    'c.20227: el PR-2 va SIN fecha; escribirla es el encendido del fundador, y cambia este caso en su mismo PR');
  const base = baseQueCuenta();
  const real = (o = {}) => PASADA_REAL({ ...o, prisma: base });
  assert.deepEqual(await pasada(t, 7, real), [], 'inactivo, minuto 7: calla');
  const aviso = await pasada(t, 0, real);
  assert.deepEqual(aviso.map(([c]) => c), ['warn'], 'inactivo, en punto: un aviso');
  assert.match(aviso[0][1], /⚠️.*INACTIVO: sin fecha de corte/);
  assert.equal(base.llamadas.length, 0, 'con la constante de hoy, ni una consulta a la base');

  // Control SEMBRADO: la misma pasada real, con una fecha válida pasada por parámetro, SÍ consulta
  // y ya no dice «inactivo». Sin esto, el cero de arriba no distingue una base muda.
  const activa = baseQueCuenta();
  const conFecha = (o = {}) => PASADA_REAL({ ...o, prisma: activa, corte: REINTENTO.fechaDeCorte(REINTENTO.SUELO_DE_LA_FECHA_DE_CORTE) });
  const enPunto = await pasada(t, 0, conFecha);
  assert.ok(activa.llamadas.length >= 1, `con fecha la pasada consulta: ${activa.llamadas.length} consultas`);
  assert.deepEqual(enPunto.map(([c]) => c), ['log'], 'con fecha y nada pendiente: «nada que mirar», no el aviso de inactivo');
  assert.match(enPunto[0][1], /candidatas 0/);
});
