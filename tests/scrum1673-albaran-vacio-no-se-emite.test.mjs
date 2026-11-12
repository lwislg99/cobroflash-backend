// tests/scrum1673-albaran-vacio-no-se-emite.test.mjs — SCRUM-1673 (PILOTO-1)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// UN ALBARÁN SIN LÍNEAS NO SE EMITE.
//
// Medido en yaqu.app el 10-nov-2026 (SCRUM-1658): `POST /admin/albaranes/52/emitir` sobre un
// borrador con `lineas: []` lo dejó `AB260007 · emitido · lineas: []` — un documento numerado,
// emitido y listo para «Enviar para firmar» que no dice nada de lo que se ha hecho.
//
// Sin gate y SIN BASE: se invoca el handler REAL de `POST /admin/albaranes/:id/emitir` con
// `prisma` de doble (patrón de SCRUM-841) y se mira si llega a `albaran.update`.
//
//   ① VACÍO ............... `lineas: []` → 409 `albaran_sin_lineas` y NO se escribe nada.
//   ② NO ES UNA LISTA ..... `lineas` null u objeto → igual (fail-closed: «no sé leerla» ≠ «tiene»).
//   ③ 🔴 CONTROL POSITIVO .. con UNA línea se emite (200 y un `update`): sin esto, ① podría estar
//                            verde porque la ruta rechaza TODO por otra puerta.
//   ④ IDEMPOTENCIA ......... el que YA está emitido (como AB260007) se devuelve sin tocar: el
//                            portón no reescribe documentos existentes (regla 29 por analogía).
//   ⑤ EL TÉCNICO TAMBIÉN ... la puerta no depende del rol.
//
// ── LO QUE ESTE TEST **NO** AFIRMA ────────────────────────────────────────────────────────────
// Qué TEXTO ve el usuario. El servidor responde un CÓDIGO, sin `message`: no hay texto firmado
// para este caso (regla 39); la propuesta va en el ticket y la pantalla es de S2 (SCRUM-1659).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { reqDeSesion } from './_arnes-de-router.mjs';

const DIST = '../dist/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const routerDe = (mod) => mod.default?.default ?? mod.default;

const BORRADOR = {
  id: 52, merchantId: 7, jobId: 42, numero: 'AB260007',
  fecha: new Date('2026-11-10T10:00:00Z'), modoValoracion: 'SIN_VALORAR',
  lineas: [], estado: 'borrador', version: 1, signatureUrl: null, firmadoAt: null,
  evidenciaFirma: null, notas: null, pdfUrl: null, invoiceId: null,
  customerName: null, customerLegalName: null, customerTaxId: null,
  customerEmail: null, customerPhone: null,
};
const UNA_LINEA = [{ concepto: 'Cambio de grifo', cantidad: 1, unidad: 'ud' }];

async function invocarEmitir(albaran, { rol = 'admin', teamMemberId } = {}) {
  let vecesQueSeActualizo = 0;
  moduloPrisma.prisma.albaran = {
    findFirst: async () => albaran,
    update: async ({ data }) => { vecesQueSeActualizo += 1; return { ...albaran, ...data }; },
  };
  moduloPrisma.prisma.job = {
    findFirst: async () => ({
      id: albaran.jobId, merchantId: albaran.merchantId, customerId: 5,
      // Forma de `SELECT_DUENOS` (accesoAlTrabajo.ts): el técnico es el operario de este trabajo.
      operarioId: teamMemberId ?? null, assignedUserId: null, assignees: [],
    }),
  };
  moduloPrisma.prisma.customer = {
    findFirst: async () => ({ name: 'Cliente QA', legalName: null, taxId: null, email: null, phone: null }),
  };

  const router = routerDe(await import(DIST + 'modules/jobs/app/routes/albaranes.routes.js'));
  const capa = router.stack.find((l) => l.route?.path === '/:id/emitir' && l.route?.methods?.post);
  assert.ok(capa, '🔴 NO EXISTE POST /:id/emitir. Sin endpoint no hay nada que medir aquí.');

  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; },
  };
  const hs = capa.route.stack;
  await hs[hs.length - 1].handle(
    reqDeSesion({ rol, merchantId: albaran.merchantId, teamMemberId, params: { id: String(albaran.id) }, body: {}, query: {}, headers: {} }),
    res, () => {},
  );
  return { salida, vecesQueSeActualizo };
}

test('SCRUM-1673 · ① un borrador con CERO líneas no se emite: 409 y nada escrito', async () => {
  const { salida, vecesQueSeActualizo } = await invocarEmitir({ ...BORRADOR, lineas: [] });
  assert.equal(salida?.code, 409, `🔴 SE EMITIÓ UN ALBARÁN VACÍO (el AB260007 de SCRUM-1658): ${JSON.stringify(salida)}`);
  assert.equal(salida.body?.error, 'albaran_sin_lineas');
  assert.equal(vecesQueSeActualizo, 0, '🔴 el 409 llegó DESPUÉS de escribir: el albarán ya no está en borrador');
});

test('SCRUM-1673 · ② `lineas` que no es una lista tampoco se emite (fail-closed)', async () => {
  for (const lineas of [null, {}, 'x']) {
    const { salida, vecesQueSeActualizo } = await invocarEmitir({ ...BORRADOR, lineas });
    assert.equal(salida?.code, 409, `🔴 con lineas=${JSON.stringify(lineas)} se emitió: ${JSON.stringify(salida)}`);
    assert.equal(salida.body?.error, 'albaran_sin_lineas');
    assert.equal(vecesQueSeActualizo, 0);
  }
});

test('SCRUM-1673 · ③ CONTROL POSITIVO: con una línea SÍ se emite', async () => {
  const { salida, vecesQueSeActualizo } = await invocarEmitir({ ...BORRADOR, lineas: UNA_LINEA });
  assert.equal(salida?.code, 200, `🔴 la ruta rechaza también lo que sí vale: ${JSON.stringify(salida)}`);
  assert.equal(salida.body?.estado, 'emitido');
  assert.equal(vecesQueSeActualizo, 1);
});

test('SCRUM-1673 · ④ el que YA está emitido (vacío) se devuelve igual, sin reescribirlo', async () => {
  const { salida, vecesQueSeActualizo } = await invocarEmitir({ ...BORRADOR, estado: 'emitido', lineas: [] });
  assert.equal(salida?.code, 200);
  assert.equal(vecesQueSeActualizo, 0, '🔴 el reintento sobre un emitido escribió');
});

test('SCRUM-1673 · ⑤ el técnico tampoco puede emitir uno vacío', async () => {
  const { salida, vecesQueSeActualizo } = await invocarEmitir({ ...BORRADOR, lineas: [] }, { rol: 'tecnico', teamMemberId: 3 });
  // 409 con el código, no un 404: un 404 querría decir que el doble no le dio acceso y que este
  // caso no ha llegado al portón (verde por otra puerta).
  assert.equal(salida?.code, 409, `🔴 el técnico no llegó al portón o emitió: ${JSON.stringify(salida)}`);
  assert.equal(salida.body?.error, 'albaran_sin_lineas');
  assert.equal(vecesQueSeActualizo, 0);
  // y su control positivo: con línea, el mismo técnico SÍ emite (el doble le da acceso de verdad)
  const ok = await invocarEmitir({ ...BORRADOR, lineas: UNA_LINEA }, { rol: 'tecnico', teamMemberId: 3 });
  assert.equal(ok.salida?.code, 200, `🔴 el doble no le da acceso al técnico: ${JSON.stringify(ok.salida)}`);
});
