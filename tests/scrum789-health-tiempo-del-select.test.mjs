// SCRUM-789 · `/health` devuelve el tiempo de su propio `SELECT 1` (`dbMs`, en ms con un decimal).
// Es la latencia app→base de producción que decide si el límite de emisiones simultáneas es
// urgente o teórico: se lee en yaqu.app en vez de ejecutarlo a mano. Sin banco: handler real y
// `prisma.$queryRaw` doblado con una espera conocida.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../dist/core/db/prisma.js';
import healthModulo from '../dist/modules/system/app/routes/health.routes.js';

const health = healthModulo.default ?? healthModulo;

async function llama(consulta) {
  const original = prisma.$queryRaw;
  prisma.$queryRaw = consulta;
  let status = 200;
  let cuerpo = null;
  const res = { status(c) { status = c; return res; }, json(b) { cuerpo = b; return res; } };
  try {
    await health.stack.find((l) => l.route?.path === '/').route.stack[0].handle({}, res);
  } finally {
    prisma.$queryRaw = original;
  }
  return { status, cuerpo };
}

test('SCRUM-789 · SUELO: /health sigue diciendo ok/db up (y la consulta se hace)', async () => {
  let llamadas = 0;
  const { status, cuerpo } = await llama(async () => { llamadas++; return [{ '?column?': 1 }]; });
  assert.equal(status, 200);
  assert.equal(cuerpo.ok, true);
  assert.equal(cuerpo.db, 'up');
  assert.equal(llamadas, 1);
});

test('SCRUM-789 · `dbMs` es el tiempo de ESA consulta: una de 40 ms no puede salir como 0', async () => {
  const { cuerpo } = await llama(() => new Promise((ok) => setTimeout(() => ok([1]), 40)));
  assert.equal(typeof cuerpo.dbMs, 'number');
  assert.ok(cuerpo.dbMs >= 35 && cuerpo.dbMs < 400, `dbMs=${cuerpo.dbMs} no cuadra con una espera de 40 ms`);
});

test('SCRUM-789 · con la base caída no hay `dbMs` (ausente no es cero)', async () => {
  const { status, cuerpo } = await llama(async () => { throw new Error('caida'); });
  assert.equal(status, 500);
  assert.equal(cuerpo.db, 'down');
  assert.ok(!('dbMs' in cuerpo));
});
