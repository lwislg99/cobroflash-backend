// SCRUM-37 (preparación del mec. 2) — `Job.totalCobrado` se agrega POR JOB, no por quote.
// Sin gate: prisma de mentira, ni BD ni red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA BOMBA QUE ESTO DESACTIVA, encontrada en el recon del mecanismo 2 y arreglada ANTES de
// que pueda ocurrir. La versión anterior resolvía el Job por `quoteId` y agregaba por `quoteId`:
//
//   ① SILENCIO — un presupuesto adicional no tiene Job apuntándole, así que el `findUnique`
//     daba `null` y la función se iba sin hacer nada. Cobrar el extra no movía el total.
//   ② EL TOTAL BAJA DESPUÉS DE COBRAR — el `aggregate` sumaba solo las facturas de ESE quote
//     y sobrescribía: cobrar un extra de 200 € sobre un Job con 3.000 € cobrados dejaba
//     `totalCobrado = 200`.
//
// Es el patrón de SCRUM-141 y `vat_default`: un agregado materializado que deja de cuadrar
// con lo que agrega. Y no es un dato feo en pantalla — es el número con el que el pro sabe
// cuánto le deben.
//
// CON 1:1 EL RESULTADO ES IDÉNTICO al de antes, así que esto es seguro hoy: lo que cambia es
// que la bomba ya no está armada para el día que se abra el schema.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = fs.readFileSync(
  path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'job.service.ts'),
  'utf8',
);
const CODIGO = soloEjecutable(FUENTE); // principio 10

// ── El doble de prisma: un mundo pequeño con jobs, quotes y facturas ─────────────────────

// `quotes`: la vía nueva (Quote.jobId). Si se omite, se simula una BD donde la columna AÚN NO
// EXISTE y Prisma revienta — que es exactamente el estado de producción cuando este código
// llegue allí por auto-deploy, antes de que nadie aplique el schema.
function mundo({ jobs, invoices, quotes = null }) {
  const escrituras = [];
  return {
    escrituras,
    job: {
      findUnique: async ({ where, select }) => {
        const j = jobs.find((x) => (where.id != null ? x.id === where.id : x.quoteId === where.quoteId));
        if (!j) return null;
        return select?.quoteId !== undefined ? { quoteId: j.quoteId } : { id: j.id, quoteId: j.quoteId };
      },
      update: async ({ where, data }) => {
        escrituras.push({ jobId: where.id, ...data });
        const j = jobs.find((x) => x.id === where.id);
        if (j) Object.assign(j, data);
        return j;
      },
    },
    invoice: {
      aggregate: async ({ where }) => {
        const ids = where.quoteId?.in ?? [where.quoteId];
        const total = invoices
          .filter((i) => ids.includes(i.quoteId) && i.status === where.status)
          .reduce((s, i) => s + i.total, 0);
        return { _sum: { total } };
      },
      findUnique: async () => null,
      findFirst: async () => null,
    },
    quote: {
      findFirst: async () => null,
      findMany: async ({ where }) => {
        if (quotes === null) {
          // El error REAL de Prisma cuando la columna no está en la BD.
          const e = new Error('The column `quotes.job_id` does not exist in the current database.');
          e.code = 'P2022';
          throw e;
        }
        return quotes.filter((q) => q.jobId === where.jobId).map((q) => ({ id: q.id }));
      },
    },
  };
}

// Cliente INYECTABLE, como `applyVeriFactuAnulacion` (SCRUM-145). Sustituir el export global
// de prisma no se puede (el CJS compilado no es redefinible) y, sobre todo, la inyección es
// mejor: deja esta ruta de DINERO verificable sin BD, que hoy no lo estaba en absoluto.
const { recalcJobCobradoForJob, recalcJobCobradoForQuote, quotesDelJob } =
  await import('../dist/modules/jobs/domain/job.service.js');

// ── 1. El comportamiento de HOY no cambia (1:1) ──────────────────────────────────────────

test('SCRUM-37 · con 1:1 el total sigue saliendo igual que antes', async () => {
  const p = mundo({
    jobs: [{ id: 1, quoteId: 10, totalCobrado: 0 }],
    invoices: [
      { quoteId: 10, status: 'paid', total: 1000 },
      { quoteId: 10, status: 'paid', total: 2000 },
      { quoteId: 10, status: 'pending', total: 500 }, // no cuenta: solo `paid`
    ],
  });
  await recalcJobCobradoForQuote(10, p);
  assert.equal(p.escrituras.at(-1)?.totalCobrado, 3000, '🔴 cambió el resultado con 1:1');
});

// ── 2. EL BUG QUE SE DESACTIVA: el total no puede BAJAR al cobrar ────────────────────────

test('SCRUM-37 · la consulta pide el CONJUNTO de quotes, no uno suelto', async () => {
  // No se simula el 1:N (todavía no existe y fingirlo sería probar una ficción). Lo que se
  // fija es la FORMA de la consulta, que es lo que hace segura la llegada del mecanismo 2:
  // `quoteId: { in: [...] }`. Con la forma vieja —`quoteId` suelto + sobrescribir— cobrar un
  // adicional de 200 € sobre un Job con 3.000 € cobrados habría dejado totalCobrado = 200.
  let wherePedido = null;
  const p = mundo({ jobs: [{ id: 1, quoteId: 10, totalCobrado: 0 }], invoices: [{ quoteId: 10, status: 'paid', total: 3000 }] });
  const agregarOriginal = p.invoice.aggregate;
  p.invoice.aggregate = async (args) => { wherePedido = args.where; return agregarOriginal(args); };

  await recalcJobCobradoForJob(1, p);

  assert.ok(
    wherePedido && Array.isArray(wherePedido.quoteId?.in),
    `🔴 la agregación pide un quoteId suelto (${JSON.stringify(wherePedido)}). Con varios quotes ` +
      `por Job eso suma solo uno y SOBRESCRIBE: el total BAJA después de cobrar, y es el número ` +
      `con el que el pro sabe cuánto le deben.`,
  );
  assert.equal(wherePedido.status, 'paid', 'y solo cuenta lo cobrado, no lo emitido');
});

test('SCRUM-37 · quotesDelJob es el ÚNICO punto que resuelve la pertenencia', async () => {
  const p = mundo({ jobs: [{ id: 1, quoteId: 10 }], invoices: [] });
  assert.deepEqual(await quotesDelJob(1, p), [10], 'hoy 1:1 → un elemento');
  assert.deepEqual(await quotesDelJob(999, p), [], 'job inexistente → vacío, sin lanzar');
});

// ── 2-bis. LAS TRES BD A LA VEZ: el código sobrevive a las tres etapas de la migración ────
//
// Esto NO es defensa hipotética. El orden de SCRUM-169 es staging → yaqu_dev_javier → prod, y
// Railway despliega solo al mergear a `main`. O sea que hay una ventana REAL, medida en días,
// en la que producción ejecuta este código SIN la columna. Y hay una segunda ventana, más
// corta, entre aplicar la columna y ejecutar el backfill. `quotesDelJob` tiene que acertar en
// las tres, porque de él cuelga el número que le dice al pro cuánto le deben.

test('SCRUM-37 · ETAPA A (producción hoy: sin columna) → cae a Job.quoteId y NO revienta', async () => {
  const p = mundo({ jobs: [{ id: 1, quoteId: 10, totalCobrado: 0 }], invoices: [{ quoteId: 10, status: 'paid', total: 1500 }] });
  //                                                                   ↑ `quotes` omitido = la columna no existe
  assert.deepEqual(
    await quotesDelJob(1, p),
    [10],
    '🔴 sin la columna `quotes.job_id`, `quotesDelJob` no cae a `Job.quoteId`. Este código llega a ' +
      'producción ANTES que su columna (auto-deploy desde main, y prod es la ÚLTIMA de las tres BD): ' +
      'sin la caída, el primer cobro tras el merge deja de actualizar `totalCobrado` — y en silencio, ' +
      'porque el recálculo es best-effort y se traga el error.',
  );
  await recalcJobCobradoForJob(1, p);
  assert.equal(p.escrituras.at(-1)?.totalCobrado, 1500, '🔴 el dinero no se actualiza en producción');
});

test('SCRUM-37 · ETAPA B (columna aplicada, backfill aún no) → sigue acertando por la vía vieja', async () => {
  const p = mundo({
    jobs: [{ id: 1, quoteId: 10, totalCobrado: 0 }],
    invoices: [{ quoteId: 10, status: 'paid', total: 900 }],
    quotes: [{ id: 10, jobId: null }], // la columna existe pero está vacía
  });
  assert.deepEqual(
    await quotesDelJob(1, p),
    [10],
    '🔴 entre aplicar la columna y correr el backfill, la vía nueva devuelve vacío. Si eso se toma ' +
      'como «este Job no tiene quotes», el total se queda congelado durante toda esa ventana.',
  );
});

test('SCRUM-37 · ETAPA C (backfill hecho) → manda la vía nueva, y ya admite varios', async () => {
  const p = mundo({
    jobs: [{ id: 1, quoteId: 10, totalCobrado: 0 }],
    invoices: [
      { quoteId: 10, status: 'paid', total: 3000 },
      { quoteId: 11, status: 'paid', total: 200 }, // el adicional del mecanismo 2
    ],
    quotes: [{ id: 10, jobId: 1 }, { id: 11, jobId: 1 }],
  });
  assert.deepEqual(
    (await quotesDelJob(1, p)).sort(),
    [10, 11],
    '🔴 con el backfill hecho, `quotesDelJob` sigue devolviendo solo el quote original',
  );
  await recalcJobCobradoForJob(1, p);
  assert.equal(
    p.escrituras.at(-1)?.totalCobrado,
    3200,
    '🔴 cobrar un adicional de 200 € sobre 3.000 € cobrados no da 3.200. Este es el número exacto ' +
      'del bug: con la forma vieja el total BAJABA a 200 después de cobrar.',
  );
});

test('SCRUM-37 · la vía nueva GANA a la vieja cuando difieren', async () => {
  // Si el backfill deja `Job.quoteId` apuntando a un sitio y `Quote.jobId` a otro, tiene que
  // mandar la nueva: es la que sobrevive al paso 2 (que retira `Job.quoteId`).
  const p = mundo({
    jobs: [{ id: 1, quoteId: 10 }],
    invoices: [],
    quotes: [{ id: 77, jobId: 1 }],
  });
  assert.deepEqual(await quotesDelJob(1, p), [77], '🔴 gana la vía vieja: el paso 2 cambiaría el resultado');
});

test('SCRUM-37 · un Job sin quotes NO se pone a cero', async () => {
  // Un Job manual (SCRUM-51) puede no tener quote. Escribir 0 ahí borraría un cobro
  // registrado por otra vía: mejor no tocar que inventar un cero.
  const p = mundo({ jobs: [{ id: 1, quoteId: null, totalCobrado: 450 }], invoices: [] });
  await recalcJobCobradoForJob(1, p);
  assert.equal(p.escrituras.length, 0, '🔴 se ha escrito sobre un Job sin quotes');
});

// ── 3. El punto de cambio del 1:N está AISLADO ───────────────────────────────────────────

test('SCRUM-37 · la agregación NO vuelve a estar escrita en términos de un solo quote', () => {
  assert.ok(
    /quoteId: \{ in: quoteIds \}/.test(CODIGO),
    '🔴 la agregación ha vuelto a filtrar por un `quoteId` suelto. Con varios quotes por Job eso ' +
      'suma solo uno y SOBRESCRIBE el total: el número baja después de cobrar.',
  );
  assert.ok(
    /export async function quotesDelJob/.test(CODIGO),
    '🔴 ha desaparecido `quotesDelJob`, que es el ÚNICO punto que hay que tocar cuando llegue el ' +
      '1:N. Sin él, la resolución vuelve a estar repartida y habrá que acordarse de todos los sitios.',
  );
  assert.ok(
    /recalcJobCobradoForJob/.test(CODIGO),
    '🔴 el núcleo debe agregar por JOB; por quote es la forma que rompe con el mecanismo 2',
  );
});

// ── 4. EL GUARD QUE PIDIÓ EL FUNDADOR: el total cuadra con sus facturas ──────────────────
//
// Hoy NADIE comprobaba que `totalCobrado` (columna materializada) coincidiera con la suma de
// las facturas que dice agregar. Un materializado sin conciliación es un dato que puede
// mentir indefinidamente sin que nada falle — y este dice cuánto le deben al pro.

export function totalCobradoCuadra(job, invoices) {
  const suya = invoices.filter((i) => i.jobId === job.id && i.status === 'paid');
  const suma = suya.reduce((s, i) => s + Number(i.total), 0);
  return Math.round(Number(job.totalCobrado) * 100) === Math.round(suma * 100);
}

test('SCRUM-37 · el guard de conciliación detecta un total que no cuadra', () => {
  const job = { id: 1, totalCobrado: 3000 };
  const facturas = [
    { jobId: 1, status: 'paid', total: 3000 },
    { jobId: 1, status: 'paid', total: 200 },
  ];
  assert.equal(
    totalCobradoCuadra(job, facturas),
    false,
    '🔴 el guard no detecta el descuadre: 3.000 materializado frente a 3.200 cobrados. Es ' +
      'exactamente lo que dejaría el bug del adicional.',
  );
  assert.equal(totalCobradoCuadra({ id: 1, totalCobrado: 3200 }, facturas), true);
});

test('SCRUM-37 · el guard no se confunde con facturas pendientes ni de otros Jobs', () => {
  const facturas = [
    { jobId: 1, status: 'paid', total: 100 },
    { jobId: 1, status: 'pending', total: 900 }, // aún no cobrada
    { jobId: 2, status: 'paid', total: 500 },    // de otro Job
  ];
  assert.equal(totalCobradoCuadra({ id: 1, totalCobrado: 100 }, facturas), true);
  assert.equal(
    totalCobradoCuadra({ id: 1, totalCobrado: 1000 }, facturas),
    false,
    '🔴 cuenta como cobrado algo que solo está emitido',
  );
});
