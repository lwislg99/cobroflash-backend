// tests/scrum1370-total-aceptado-es-la-suma.test.mjs — SCRUM-1370
//
// 🔴 `Job.totalAceptado` ES LA SUMA DE LO ACEPTADO, Y SE ESCRIBE EN CADA ACEPTACIÓN.
//
// Reproducido el 2-oct-2026: la columna sólo se escribía al CREAR el Trabajo. Un adicional
// aceptado, o el presupuesto colgado de un Trabajo abierto sin presupuesto, no la tocaba
// (`ensureJobForQuote` salía en `if (quote.jobId) return;`), y los informes por operario y la
// exportación —que SUMAN la columna— no veían ese dinero.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// `ensureJobForQuote` de `dist/`, con una base en memoria CON ESTADO: lo que se escribe se lee
// de vuelta, y el `where` de `quote.aggregate` se evalúa (ids, merchant y estado).
// ⚠️ Se entra por la FUNCIÓN, no por `POST /quote/:token/decision`. Que los tres sitios que
// aceptan la llamen lo mira el último test, leyendo el código. No hay base real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { ensureJobForQuote } from '../dist/modules/jobs/domain/job.service.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const M = 7;

function base({ quotes = [], jobs = [] } = {}) {
  const escriturasJob = [];
  const cl = {
    quotes, jobs, escriturasJob,
    quote: {
      async findUnique({ where }) { const q = quotes.find((x) => x.id === where.id); return q ? { ...q } : null; },
      async findMany({ where }) {
        return quotes
          .filter((q) => where.jobId === undefined || q.jobId === where.jobId)
          .filter((q) => where.merchantId === undefined || q.merchantId === where.merchantId)
          .map((q) => ({ ...q }));
      },
      async update({ where, data }) { const q = quotes.find((x) => x.id === where.id); Object.assign(q, data); return { ...q }; },
      async aggregate({ where }) {
        const filas = quotes.filter((q) => where.id.in.includes(q.id) && q.merchantId === where.merchantId && q.status === where.status);
        const centimos = filas.reduce((a, q) => a + Math.round(Number(q.total) * 100), 0);
        return { _sum: { total: filas.length ? (centimos / 100).toFixed(2) : null }, _count: { _all: filas.length } };
      },
    },
    job: {
      async findUnique({ where }) {
        const j = where.id != null ? jobs.find((x) => x.id === where.id) : jobs.find((x) => x.quoteId === where.quoteId);
        return j ? { ...j } : null;
      },
      async create({ data }) { const j = { id: 900 + jobs.length, ...data }; jobs.push(j); escriturasJob.push({ create: data }); return { ...j }; },
      async update({ where, data }) {
        escriturasJob.push({ where, data });
        const j = jobs.find((x) => x.id === where.id); Object.assign(j, data); return { ...j };
      },
    },
  };
  return cl;
}

const Q = (id, extra = {}) => ({
  id, merchantId: M, customerId: 3, status: 'accepted', total: '100.00', quoteNumber: id,
  teamMemberId: null, jobId: null, customer: { name: 'Cliente QA' }, ...extra,
});
const guardado = (cl, jobId) => cl.jobs.find((j) => j.id === jobId).totalAceptado;
const igual = (valor, esperado, msg) => assert.equal(valor == null ? valor : Number(valor), esperado, msg);

test('SCRUM-1370 · CONTROL: un presupuesto aceptado sin Trabajo lo crea con su total, como siempre', async () => {
  const cl = base({ quotes: [Q(1, { total: '200.00' })] });
  await ensureJobForQuote(1, cl);
  assert.equal(cl.jobs.length, 1, 'SUELO: no se creó el Trabajo');
  igual(cl.jobs[0].totalAceptado, 200);
});

test('SCRUM-1370 · 🔴 Trabajo directo + presupuesto colgado y ACEPTADO → la columna deja de ser NULL', async () => {
  const cl = base({ quotes: [Q(5, { jobId: 50, total: '121.00' })], jobs: [{ id: 50, merchantId: M, quoteId: null, totalAceptado: null }] });
  await ensureJobForQuote(5, cl);
  igual(guardado(cl, 50), 121, '🔴 el cliente aceptó 121 € y el Trabajo sigue sin importe aceptado');
  assert.equal(cl.jobs.length, 1, 'no se crea un segundo Trabajo (SCRUM-195)');
});

test('SCRUM-1370 · 🔴 un ADICIONAL aceptado se SUMA al original', async () => {
  const cl = base({
    quotes: [Q(1, { jobId: 50, total: '1000.00' }), Q(2, { jobId: 50, total: '250.50' })],
    jobs: [{ id: 50, merchantId: M, quoteId: 1, totalAceptado: '1000.00' }],
  });
  await ensureJobForQuote(2, cl);
  igual(guardado(cl, 50), 1250.5, '🔴 el adicional aceptado no entra en `totalAceptado`');
});

test('SCRUM-1370 · un BORRADOR delante no desplaza al aceptado: cuenta sólo lo aceptado', async () => {
  const cl = base({
    quotes: [Q(1, { jobId: 50, status: 'draft', total: '999.00' }), Q(2, { jobId: 50, total: '300.00' })],
    jobs: [{ id: 50, merchantId: M, quoteId: null, totalAceptado: null }],
  });
  await ensureJobForQuote(2, cl);
  igual(guardado(cl, 50), 300);
});

// Nombres LITERALES, uno por estado: un nombre construido en un bucle no lo ve la señal (SCRUM-1415).
async function sinAceptarNoEscribe(estado) {
  const cl = base({ quotes: [Q(5, { jobId: 50, status: estado })], jobs: [{ id: 50, merchantId: M, quoteId: null, totalAceptado: null }] });
  await ensureJobForQuote(5, cl);
  assert.equal(guardado(cl, 50), null);
  assert.equal(cl.escriturasJob.length, 0);
}
test('SCRUM-1370 · un presupuesto en BORRADOR colgado del Trabajo no escribe nada: sigue NULL', () => sinAceptarNoEscribe('draft'));
test('SCRUM-1370 · un presupuesto ENVIADO colgado del Trabajo no escribe nada: sigue NULL', () => sinAceptarNoEscribe('sent'));
test('SCRUM-1370 · un presupuesto RECHAZADO colgado del Trabajo no escribe nada: sigue NULL', () => sinAceptarNoEscribe('rejected'));
test('SCRUM-1370 · un presupuesto CADUCADO colgado del Trabajo no escribe nada: sigue NULL', () => sinAceptarNoEscribe('expired'));

test('SCRUM-1370 · la MISMA aceptación entregada dos veces no suma dos veces', async () => {
  const cl = base({
    quotes: [Q(1, { jobId: 50, total: '1000.00' }), Q(2, { jobId: 50, total: '250.00' })],
    jobs: [{ id: 50, merchantId: M, quoteId: 1, totalAceptado: '1000.00' }],
  });
  await ensureJobForQuote(2, cl);
  await ensureJobForQuote(2, cl);
  igual(guardado(cl, 50), 1250);
});

test('SCRUM-1370 · el presupuesto de OTRO merchant con el mismo `jobId` no entra en la suma', async () => {
  const cl = base({
    quotes: [Q(1, { jobId: 50, total: '100.00' }), Q(2, { jobId: 50, total: '5000.00', merchantId: 8 })],
    jobs: [{ id: 50, merchantId: M, quoteId: 1, totalAceptado: '100.00' }],
  });
  await ensureJobForQuote(1, cl);
  igual(guardado(cl, 50), 100);
});

test('SCRUM-1370 · par anterior al backfill (Job con `quoteId`, Quote sin `jobId`): adopta y escribe la suma', async () => {
  const cl = base({ quotes: [Q(1, { total: '80.00' })], jobs: [{ id: 50, merchantId: M, quoteId: 1, totalAceptado: null }] });
  await ensureJobForQuote(1, cl);
  assert.equal(cl.quotes[0].jobId, 50);
  igual(guardado(cl, 50), 80);
});

// ── EL ESCRITOR ÚNICO ─────────────────────────────────────────────────────────────────────
// La columna la suman `metrics`, `team` y `exports`. Un segundo escritor con otro criterio serían
// dos verdades sobre el mismo dinero. Se mira el ÁRBOL de sintaxis, no el texto: un comentario que
// nombre la columna no cuenta, y una escritura partida en dos líneas sí.

function ficherosTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** ¿Este nodo escribe la columna? Una clave `totalAceptado` dentro del `data` de una llamada. */
function escriturasDe(codigo, nombre) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const halladas = [];
  const visitar = (n) => {
    const esClave = (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && n.name.getText(sf) === 'totalAceptado';
    if (esClave) {
      for (let p = n.parent; p; p = p.parent) {
        if (ts.isPropertyAssignment(p) && p.name.getText(sf) === 'data') { halladas.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1); break; }
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return halladas;
}

test('SCRUM-1370 · CONTROL del guard: ve una escritura fabricada, e ignora una lectura y un comentario', () => {
  assert.equal(escriturasDe('prisma.job.update({ where: { id }, data: { totalAceptado: 5 } });', 'x.ts').length, 1);
  assert.equal(escriturasDe('const totalAceptado = 5;\nprisma.job.updateMany({ where: {}, data: {\n  totalAceptado,\n} });', 'x.ts').length, 1);
  assert.equal(escriturasDe('// data: { totalAceptado: 5 }\nconst a = { totalAceptado: job.totalAceptado };\nq({ _sum: { totalAceptado: true } });', 'x.ts').length, 0);
});

test('SCRUM-1370 · 🔴 `Job.totalAceptado` sólo se escribe en `job.service.ts`', () => {
  const todos = ficherosTs(path.join(RAIZ, 'src'));
  assert.ok(todos.length > 100, `🔴 CIEGO: sólo ${todos.length} ficheros en src/`);
  const escritores = todos
    .map((f) => ({ f: path.relative(RAIZ, f).replace(/\\/g, '/'), lineas: escriturasDe(fs.readFileSync(f, 'utf8'), f) }))
    .filter((x) => x.lineas.length > 0);
  assert.deepEqual(
    escritores.map((x) => x.f),
    ['src/modules/jobs/domain/job.service.ts'],
    '🔴 hay un escritor de `Job.totalAceptado` fuera de `job.service.ts`: ' + JSON.stringify(escritores)
    + '. La columna es la suma de lo aceptado y se escribe en `escribirTotalAceptado`; si necesitas '
    + 'escribirla desde otro sitio, llama a esa función.',
  );
  assert.equal(escritores[0].lineas.length, 2, 'se esperan DOS escrituras: la del `create` y la de `escribirTotalAceptado`');
});

test('SCRUM-1370 · los tres sitios que aceptan un presupuesto llaman a `ensureJobForQuote`', () => {
  for (const f of [
    'src/modules/quotes/app/routes/quotes.routes.ts',
    'src/modules/system/app/routes/quotesAdmin.routes.ts',
    'src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts',
  ]) {
    const sf = ts.createSourceFile(f, fs.readFileSync(path.join(RAIZ, f), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let llamadas = 0;
    const visitar = (n) => {
      if (ts.isCallExpression(n) && n.expression.getText(sf) === 'ensureJobForQuote') llamadas += 1;
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
    assert.ok(llamadas >= 1, `🔴 ${f} ya no llama a \`ensureJobForQuote\`: aceptar por ahí no escribiría el importe aceptado`);
  }
});
