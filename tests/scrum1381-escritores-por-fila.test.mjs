// tests/scrum1381-escritores-por-fila.test.mjs — SCRUM-1381
//
// «El `updatedAt` de una fila no es la versión de un trozo de esa fila.»
//
// El censo de SCRUM-1285c decía si una escritura lleva condición o no. No decía cuántos ESCRITORES
// tiene la fila, que es lo que decide si su `updatedAt` sirve como versión. Medido por S2 en
// producción: las notas internas del presupuesto se autoguardan, y «Guardar plan» devolvía 409 por la
// propia nota. Aquí se vigila que el censo SEPA contarlo —casos fabricados, tres veredictos— y que
// el patrón no se siembre en otra fila sin que nadie lo declare.
//
// Lo que NO mide: que dos sitios coincidan de verdad sobre el MISMO registro. Cuenta sitios que
// escriben el mismo modelo: sobrecuenta, no infracuenta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  RAIZ_REPO, medir, censarPiezas, camposUpdatedAt, escritoresPorFila, versionDeFilaDudosa, VEREDICTOS,
} from '../scripts/_censo-escrituras-sin-version.mjs';

const r = medir();
const DECLARADAS = path.join(RAIZ_REPO, 'scripts', '_version-de-fila-dudosa-declaradas.json');
const UPDATED_AT = camposUpdatedAt(fs.readFileSync(path.join(RAIZ_REPO, 'prisma/schema.prisma'), 'utf8'));

// ── Casos fabricados sobre un modelo real del esquema (`quote`, que tiene `@updatedAt`) ────────────
const PLAN = `router.patch('/f/:id/plan', async (req, res) => {
  await prisma.quote.update({ where: { id: 1, updatedAt: req.body.version }, data: { customBillingPlan: req.body.plan } });
});`;
const NOTAS = `router.put('/f/:id/notas', async (req, res) => {
  await prisma.quote.update({ where: { id: 1 }, data: { internalNotes: req.body.notas } });
});`;
const MISMO_CAMPO = `router.post('/f/:id/reset', async (req, res) => {
  await prisma.quote.update({ where: { id: 1 }, data: { customBillingPlan: null } });
});`;
const OPACO = `router.patch('/f/:id', async (req, res) => {
  await prisma.quote.update({ where: { id: 1 }, data: cambios });
});`;
const CON_SPREAD = `router.patch('/f/:id/varios', async (req, res) => {
  await prisma.quote.update({ where: { id: 1 }, data: { ...cambios, internalNotes: 'x' } });
});`;
const DECIDE = `router.post('/f/:id/aceptar', async (req, res) => {
  const q = await prisma.quote.findFirst({ where: { id: 1 } });
  if (q.status !== 'sent') return res.status(409).end();
  await prisma.quote.update({ where: { id: q.id }, data: { status: 'accepted' } });
});`;
const SIN_UPDATED_AT = `router.post('/f/:id/pagada', async (req, res) => {
  const i = await prisma.invoice.findFirst({ where: { id: 1 } });
  if (i.status !== 'issued') return res.status(409).end();
  await prisma.invoice.update({ where: { id: i.id }, data: { status: 'paid' } });
});`;

function veredictoDe(ruta, fuentes) {
  const filas = censarPiezas([{ nombre: '__fabricado/f.routes.ts', texto: fuentes.join('\n') }]);
  const suyas = escritoresPorFila(filas, UPDATED_AT).filter((e) => e.ruta === ruta);
  assert.equal(suyas.length, 1, `la candidata «${ruta}» tiene que salir una vez, y salió ${suyas.length}`);
  return suyas[0];
}

test('SCRUM-1381 · el censo MIDE: población de candidatas, veredictos que suman, y modelos con @updatedAt', () => {
  assert.equal(r.noMedido, undefined, `🔴 el censo no supo medir: ${r.noMedido}`);
  assert.ok(UPDATED_AT.size > 10, `🔴 solo ${UPDATED_AT.size} modelos con @updatedAt leídos del esquema`);
  assert.equal(UPDATED_AT.get('quote'), 'updatedAt', '🔴 `quote` tiene que tener su campo @updatedAt: los casos fabricados se montan sobre él');
  assert.equal(UPDATED_AT.has('invoice'), false, '🔴 el caso SIN-UPDATEDAT se monta sobre `invoice`: si ahora lo tiene, hay que cambiar de modelo');
  assert.ok(r.escritores.length > 10, `🔴 solo ${r.escritores.length} candidatas: el recuento ha perdido su población`);
  assert.equal(VEREDICTOS.reduce((n, v) => n + r.cuentaEscritores[v], 0), r.escritores.length, '🔴 hay candidatas sin veredicto');
  assert.equal(r.escritores.filter((e) => !e.yaLaLleva).length, r.cuenta['LEE-Y-DECIDE'], '🔴 no toda LEE-Y-DECIDE tiene su fila de escritores');
});

test('SCRUM-1381 · 🔴 FABRICADO: la versión de la fila con OTRO escritor de otro campo NO VALE', () => {
  const e = veredictoDe('PATCH /f/:id/plan', [PLAN, NOTAS]);
  assert.equal(e.veredicto, 'NO-VALE');
  assert.equal(e.yaLaLleva, true);
  assert.deepEqual(e.protegidos, ['customBillingPlan']);
  assert.deepEqual(e.ajenos, ['__fabricado/f.routes.ts::PUT /f/:id/notas']);
});

test('SCRUM-1381 · NEGATIVO DERIVADO: la MISMA escritura, sola en la fila, VALE', () => {
  const e = veredictoDe('PATCH /f/:id/plan', [PLAN]);
  assert.equal(e.veredicto, 'VALE');
  assert.equal(e.otros, 0);
});

test('SCRUM-1381 · un escritor que toca el MISMO campo no es ajeno: su cambio sí debe invalidar la versión', () => {
  const e = veredictoDe('PATCH /f/:id/plan', [PLAN, MISMO_CAMPO]);
  assert.equal(e.veredicto, 'VALE');
  assert.deepEqual(e.coinciden, ['__fabricado/f.routes.ts::POST /f/:id/reset']);
});

test('SCRUM-1381 · 🔴 un escritor que no se puede leer es NO-SE: ni ajeno ni inocuo', () => {
  assert.equal(veredictoDe('PATCH /f/:id/plan', [PLAN, OPACO]).veredicto, 'NO-SE');
  const conSpread = veredictoDe('PATCH /f/:id/plan', [PLAN, CON_SPREAD]);
  assert.equal(conSpread.veredicto, 'NO-SE', 'un `data` con spread puede traer cualquier campo: no se cuenta como «no toca»');
  assert.deepEqual(conSpread.ajenos, []);
});

test('SCRUM-1381 · con un ajeno a la vista manda NO-VALE aunque además haya opacos', () => {
  const e = veredictoDe('PATCH /f/:id/plan', [PLAN, NOTAS, OPACO]);
  assert.equal(e.veredicto, 'NO-VALE');
  assert.equal(e.opacos.length, 1);
});

test('SCRUM-1381 · 🔴 LA UNIDAD: un sitio con dos escrituras es UN sitio y DOS líneas, y la fila lo dice', () => {
  // La discusión que esto cierra: una sesión contó sitios y otra contó líneas sobre el mismo árbol,
  // y las dos cifras eran ciertas. Una cifra sin unidad se discute cada vez que alguien la cita.
  const DOS_EN_UN_SITIO = `router.put('/f/:id/notas', async (req, res) => {
    await prisma.quote.update({ where: { id: 1 }, data: { internalNotes: req.body.notas } });
    await prisma.quote.update({ where: { id: 1 }, data: { tags: [] } });
  });`;
  const e = veredictoDe('PATCH /f/:id/plan', [PLAN, DOS_EN_UN_SITIO]);
  assert.deepEqual(e.ajenos, ['__fabricado/f.routes.ts::PUT /f/:id/notas']);
  assert.equal(e.otros, 1, 'sitios');
  assert.equal(e.lineasOtras, 2, 'líneas');
  assert.equal(e.lineasAjenas, 2, 'líneas ajenas');
  assert.equal(e.lineasDe['__fabricado/f.routes.ts::PUT /f/:id/notas'].length, 2);
  // Y sobre el árbol real: nunca menos líneas que sitios, en ninguna candidata.
  for (const c of r.escritores) {
    assert.ok(c.lineasOtras >= c.otros, `${c.sitio}: ${c.lineasOtras} líneas para ${c.otros} sitios`);
    assert.equal(Object.values(c.lineasDe).reduce((n, l) => n + l.length, 0), c.lineasOtras, `${c.sitio}: las líneas por sitio no suman`);
  }
});

test('SCRUM-1381 · una LEE-Y-DECIDE es candidata: protege el campo sobre el que decide', () => {
  const e = veredictoDe('POST /f/:id/aceptar', [DECIDE, NOTAS]);
  assert.equal(e.yaLaLleva, false);
  assert.deepEqual(e.protegidos, ['status']);
  assert.equal(e.veredicto, 'NO-VALE');
  assert.equal(veredictoDe('POST /f/:id/aceptar', [DECIDE]).veredicto, 'VALE');
});

test('SCRUM-1381 · un modelo sin @updatedAt sale SIN-UPDATEDAT: ahí el patrón no se puede copiar', () => {
  assert.equal(veredictoDe('POST /f/:id/pagada', [SIN_UPDATED_AT]).veredicto, 'SIN-UPDATEDAT');
});

test('SCRUM-1381 · 🔴 TRINQUETE: las que condicionan por el updatedAt de una fila con más escritores son EXACTAMENTE las declaradas', () => {
  const json = JSON.parse(fs.readFileSync(DECLARADAS, 'utf8'));
  assert.ok(Array.isArray(json.declaradas), `🔴 ${DECLARADAS} no trae la lista \`declaradas\``);
  for (const d of json.declaradas) assert.ok(d.sitio && d.motivo, `🔴 una entrada declarada sin sitio o sin motivo: ${JSON.stringify(d)}`);
  const medidas = [...new Set(versionDeFilaDudosa(r.escritores).map((e) => e.sitio))].sort();
  assert.deepEqual(medidas, json.declaradas.map((d) => d.sitio).sort(),
    '🔴 ha cambiado el conjunto de escrituras que usan el `updatedAt` de la FILA como versión sobre una fila con otros escritores.\n'
    + '  Si hay una NUEVA: el `updatedAt` de una fila no es la versión de un trozo de esa fila. Otro sitio que escriba otro campo lo mueve, y quien guarda recibe un 409 por un cambio que no es suyo (medido en SCRUM-1285 con las notas del presupuesto). Míralo con `node scripts/_censo-escrituras-sin-version.mjs --escritores --todo`. Usa una versión propia del trozo, o decláralo aquí A SABIENDAS con su motivo.\n'
    + '  Si falta una: se ha arreglado, o el censo ha dejado de verla. Si se arregló, BORRA su entrada de `scripts/_version-de-fila-dudosa-declaradas.json` en el mismo commit.');
});

test('SCRUM-1381 · ANCLA REAL: mientras billing-plan condicione por el updatedAt de la fila, las notas salen entre sus ajenos', () => {
  const suya = r.escritores.filter((e) => e.yaLaLleva && e.ruta === 'PATCH /:id/billing-plan' && e.fichero.endsWith('quotesAdmin.routes.ts'));
  if (suya.length === 0) {
    // Ya no condiciona por la versión de la fila. Que no sea un silencio: su entrada tiene que
    // haberse BORRADO de las declaradas (el trinquete de arriba cae si no), y aquí no hay más que medir.
    const json = JSON.parse(fs.readFileSync(DECLARADAS, 'utf8'));
    assert.equal(json.declaradas.some((d) => d.sitio.endsWith('::PATCH /:id/billing-plan')), false);
    return;
  }
  assert.equal(suya[0].veredicto, 'NO-VALE', JSON.stringify(suya[0]));
  assert.ok(suya[0].ajenos.some((a) => a.endsWith('quotesAdmin.routes.ts::PUT /:id/notes')),
    `🔴 el escritor de las notas —el que S2 midió en producción— no sale entre los ajenos: ${suya[0].ajenos.join(' · ')}`);
});
