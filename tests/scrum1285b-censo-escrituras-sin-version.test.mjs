// tests/scrum1285b-censo-escrituras-sin-version.test.mjs — SCRUM-1285 (parte S3)
//
// Mete en `npm test` el censo `scripts/_censo-escrituras-sin-version.mjs`. El censo no juzga: cuenta.
// Lo que se vigila aquí es que SEPA contar. Que mide el árbol de verdad, que distingue lo roto de lo
// arreglado sobre un caso fabricado y sobre los dos casos reales que ya conocemos, y que cuando no
// puede medir lo dice en vez de devolver cero filas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { medir, censarPiezas, identidadesDelEsquema, ANCLAS } from '../scripts/_censo-escrituras-sin-version.mjs';

const r = medir();

test('SCRUM-1285b · el censo MIDE el árbol real: población, control positivo y anclas', () => {
  assert.equal(r.noMedido, undefined, `🔴 el censo no supo medir: ${r.noMedido}`);
  assert.ok(r.filas.length > 50, `🔴 solo ${r.filas.length} escrituras en src/: el censo ha perdido su población`);
  assert.ok(r.modelos > 20, `🔴 solo ${r.modelos} modelos leídos del esquema`);
  assert.equal(r.anclas.length, ANCLAS.length);
});

test('SCRUM-1285b · la ruta ARREGLADA de 1276 no sale como defecto, y su escritura con la condición sale CONDICIONADO', () => {
  const suyas = r.filas.filter((f) => f.ruta === 'POST /:token/decision' && f.fichero.endsWith('quotes.routes.ts'));
  assert.ok(suyas.length >= 2, 'la ruta de decisión tiene que tener sus escrituras censadas');
  assert.deepEqual(suyas.filter((f) => f.clase === 'LEE-Y-DECIDE'), [], '🔴 la ruta arreglada sale LEE-Y-DECIDE: el censo no distingue arreglado de roto');
  assert.ok(suyas.some((f) => f.clase === 'CONDICIONADO'));
});

test('SCRUM-1285b · el plan de cobro (1285) sale: LEE-Y-DECIDE mientras siga roto, CONDICIONADO cuando se arregle', () => {
  const suyas = r.filas.filter((f) => f.ruta === 'PATCH /:id/billing-plan' && f.fichero.endsWith('quotesAdmin.routes.ts'));
  assert.ok(suyas.length >= 1, 'el PATCH billing-plan tiene que tener su escritura censada');
  assert.ok(suyas.every((f) => f.clase === 'LEE-Y-DECIDE' || f.clase === 'CONDICIONADO'), JSON.stringify(suyas));
});

test('SCRUM-1285b · una ruta fabricada CON el defecto sale LEE-Y-DECIDE; la misma con la condición, CONDICIONADO', () => {
  const ruta = (where) => `
    router.post('/prueba/:id/aceptar', async (req, res) => {
      const q = await prisma.quote.findFirst({ where: { id: 1, merchantId: req.merchantId } });
      if (q.status !== 'sent') return res.status(409).end();
      await prisma.quote.update({ where: ${where}, data: { status: 'accepted' } });
    });`;
  const filas = censarPiezas([
    { nombre: '__prueba/con-defecto.routes.ts', texto: ruta('{ id: q.id }') },
    { nombre: '__prueba/arreglada.routes.ts', texto: ruta("{ id: q.id, status: 'sent' }") },
  ]);
  const de = (n) => filas.find((f) => f.fichero === n);
  assert.equal(de('__prueba/con-defecto.routes.ts').clase, 'LEE-Y-DECIDE');
  assert.equal(de('__prueba/arreglada.routes.ts').clase, 'CONDICIONADO');
  assert.equal(de('__prueba/con-defecto.routes.ts').enRuta, true);
});

test('SCRUM-1285b · identidad derivada del esquema: `@id`, `@unique`, compuestos y la tenencia', () => {
  const ids = identidadesDelEsquema(`
model Invoice {
  id         Int    @id @default(autoincrement())
  number     String
  token      String @unique
  merchantId Int
  status     String
  @@unique([merchantId, number])
}
`);
  assert.deepEqual([...ids.get('invoice')].sort(), ['id', 'merchantId', 'merchantId_number', 'token'].sort());
});

test('SCRUM-1285b · CIEGO: sin esquema, o sin escrituras, sale «no medido» y nunca cero filas', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1285b-'));
  try {
    assert.match(medir({ raiz: dir }).noMedido, /schema\.prisma/);
    fs.mkdirSync(path.join(dir, 'prisma'));
    fs.mkdirSync(path.join(dir, 'src'));
    fs.copyFileSync(path.resolve('prisma/schema.prisma'), path.join(dir, 'prisma/schema.prisma'));
    fs.writeFileSync(path.join(dir, 'src/vacio.ts'), 'export const x = 1;\n');
    const vacio = medir({ raiz: dir });
    assert.ok(vacio.noMedido, 'un árbol sin escrituras tiene que salir NO MEDIDO, no con cero filas');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
