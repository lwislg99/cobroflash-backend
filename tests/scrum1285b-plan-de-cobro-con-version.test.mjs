// tests/scrum1285b-plan-de-cobro-con-version.test.mjs — SCRUM-1285 (mitad de servidor, S1)
//
// 🔴 `PATCH /admin/quotes/:id/billing-plan` REEMPLAZABA SIN MIRAR SOBRE QUÉ VERSIÓN ESCRIBÍA. Dos
// guardados hechos sobre la misma lectura (dos pestañas, o dos PATCH con la latencia invertida):
// el que llegaba el último ganaba aunque fuera el VIEJO, y la base volvía al plan de antes.
//
// Por la PUERTA: el manejador real de la ruta (`dist`), base doblada por `_envio-doblado.mjs`. El
// doble de `quote.update` hace lo que hace Prisma con un `where` que no casa (P2025) y lo que hace
// `@updatedAt` (sube la versión en cada escritura). ⛔ Sin red ni base.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs'; import { reqDeSesion } from './_arnes-de-router.mjs';

const RUTAS = '../dist/modules/system/app/routes/quotesAdmin.routes.js';
const copia = (x) => JSON.parse(JSON.stringify(x));
const PLAN_30_70 = [{ label: 'Anticipo', percentage: 0.3 }, { label: 'Final', percentage: 0.7 }];
const PLAN_50_50 = [{ label: 'Anticipo', percentage: 0.5 }, { label: 'Final', percentage: 0.5 }];
const PLAN_20_80 = [{ label: 'Anticipo', percentage: 0.2 }, { label: 'Final', percentage: 0.8 }];

function banco() {
  const fila = {
    id: 1285, merchantId: MERCHANT, customerId: CLIENTE, status: 'accepted', total: '1210.00', currency: 'EUR',
    customBillingPlan: PLAN_30_70, Invoice: [], updatedAt: new Date('2026-09-29T10:00:00.000Z'),
  };
  const log = { escrituras: 0 };
  inyectarBase({
    'quote.findFirst': ({ where }) => (where.id === fila.id && where.merchantId === MERCHANT ? copia(fila) : null),
    'quote.update': ({ where, data }) => {
      if (where.id !== fila.id || (where.updatedAt && new Date(where.updatedAt).getTime() !== new Date(fila.updatedAt).getTime())) {
        throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
      }
      log.escrituras += 1;
      Object.assign(fila, copia(data), { updatedAt: new Date(new Date(fila.updatedAt).getTime() + 1000) });
      return copia(fila);
    },
  }, [RUTAS]);
  const router = moduloDeDist(RUTAS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id/billing-plan' && l.route.methods.patch);
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const guardar = async (body) => {
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; } };
    await h(reqDeSesion({ rol: 'admin', params: { id: String(fila.id) }, body, merchantId: MERCHANT, headers: {} }), res);
    return r;
  };
  const versionLeida = () => new Date(fila.updatedAt).toISOString(); // lo que la pantalla recibe en el GET
  return { fila, log, guardar, versionLeida };
}

// ── 5 · CONTROL POSITIVO: sin esto, lo de abajo pasaría igual si la ruta rechazara todo ──────────
test('SCRUM-1285 · control: guardar con la versión leída escribe y devuelve la versión nueva; el siguiente, sobre ella, también', async () => {
  const b = banco();
  const v0 = b.versionLeida();
  const r1 = await b.guardar({ customBillingPlan: PLAN_50_50, version: v0 });
  assert.equal(r1.status, 200, JSON.stringify(r1.data));
  assert.deepEqual(b.fila.customBillingPlan, PLAN_50_50);
  assert.ok(r1.data.version && r1.data.version !== v0, 'la respuesta trae la versión NUEVA para el siguiente guardado');
  const r2 = await b.guardar({ customBillingPlan: PLAN_20_80, version: r1.data.version });
  assert.equal(r2.status, 200);
  assert.deepEqual(b.fila.customBillingPlan, PLAN_20_80);
  assert.equal(b.log.escrituras, 2);
});

// ── 4 · la ruta RECHAZA escribir sobre una versión que ya no es la actual ───────────────────────
test('🔴 SCRUM-1285 · 4 · un PATCH sobre una versión superada → 409 `version_superada` y la base NO cambia', async () => {
  const b = banco();
  const v0 = b.versionLeida();
  await b.guardar({ customBillingPlan: PLAN_50_50, version: v0 }); // otra pestaña guardó antes
  const tarde = await b.guardar({ customBillingPlan: PLAN_20_80, version: v0 });
  assert.equal(tarde.status, 409, '🔴 la ruta ha escrito sobre una versión que ya no era la actual');
  assert.equal(tarde.data.error, 'version_superada');
  assert.deepEqual(b.fila.customBillingPlan, PLAN_50_50, '🔴 el guardado viejo ha pisado al nuevo');
  assert.equal(b.log.escrituras, 1);
});

// ── 3 · LATENCIA INVERTIDA: dos PATCH hechos sobre la MISMA lectura, el primero llega el último ──
test('🔴 SCRUM-1285 · 3 · latencia invertida: el PATCH viejo que llega el último NO revierte la base', async () => {
  const b = banco();
  const v0 = b.versionLeida();
  const viejo = { customBillingPlan: PLAN_50_50, version: v0 }; // salió primero…
  const nuevo = { customBillingPlan: PLAN_20_80, version: v0 }; // …y éste después, pero llega antes
  const rNuevo = await b.guardar(nuevo);
  const rViejo = await b.guardar(viejo);
  assert.equal(rNuevo.status, 200);
  assert.equal(rViejo.status, 409, '🔴 el PATCH viejo, llegado el último, ha reemplazado a ciegas');
  assert.deepEqual(b.fila.customBillingPlan, PLAN_20_80, '🔴 la base ha vuelto al plan viejo');
});

test('SCRUM-1285 · una versión ilegible → 400 y no se escribe (no se trata como «sin versión»)', async () => {
  const b = banco();
  for (const version of ['', 'ayer', 12345]) {
    const r = await b.guardar({ customBillingPlan: PLAN_50_50, version });
    assert.equal(r.status, 400, `versión ${JSON.stringify(version)}`);
    assert.equal(r.data.error, 'version_invalida');
  }
  assert.equal(b.log.escrituras, 0);
});

// ⚠️ TRANSICIÓN DECLARADA (ver `src/core/db/escrituraConVersion.ts`): la pantalla aún no manda la
// versión. Sin ella se escribe como hasta hoy; este test es el que hay que invertir el día que se exija.
test('SCRUM-1285 · transición: sin `version` el guardado funciona como hoy (la pantalla aún no la manda)', async () => {
  const b = banco();
  const r = await b.guardar({ customBillingPlan: PLAN_50_50 });
  assert.equal(r.status, 200);
  assert.deepEqual(b.fila.customBillingPlan, PLAN_50_50);
});
