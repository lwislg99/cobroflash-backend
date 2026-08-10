// tests/scrum244-supresion-y-anonimizado.test.mjs — SCRUM-244 (RGPD-1).
//
// El art. 17 estaba **implementado y sin alcanzar**: `borrarMerchant` construido, probado, y sin
// un solo llamador. Un derecho que solo se puede ejercer corriendo código a mano no está ejercido.
//
// ⚠️ TODO CONTRA LA BASE DESECHABLE O CON DOBLES. Nada contra producción ni staging, ni en lectura.
// El test con base exige loopback y una base terminada en `_test`, y si no, **falla** — no se salta.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CONTROL QUE DECIDE SI ESTO VALE
//
// Tras anonimizar, **la cadena de huellas sigue verificando**. Si se rompiera, habríamos cambiado
// un problema legal por otro peor — y ése no se arregla, porque lo sellado no se toca (regla 29).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const { suprimirMerchant } = await import('../dist/modules/system/domain/supresionMerchant.service.js');
const { CAMPOS_PERSONALES, INTOCABLES, REDACTADO, redaccionesPara, tocaIntocables, planDeAnonimizado } =
  await import('../dist/modules/system/domain/anonimizarMerchant.js');
const { FLAG_DEFAULTS } = await import('../dist/core/flags.js');

const URL_BANCO = process.env.LIBRO_PG_URL || '';
const ENABLED = URL_BANCO !== '';
const SELLO = `r${process.pid}`;

function exigirBancoDesechable(url) {
  const p = parseBDSegura(url);
  assert.ok(p, '🔴 LIBRO_PG_URL no es legible.');
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(p.host), `🔴 «${p.host}» no es loopback y esto BORRA datos.`);
  assert.ok(p.base.endsWith('_test'), `🔴 «${p.base}» no termina en «_test».`);
  return `${p.host}:${p.puerto}/${p.base}`;
}

// ── SIN BASE: el flag, el plan y las redes ───────────────────────────────────────────────────

test('SCRUM-244 · la ruta se construye APAGADA (regla 24)', () => {
  assert.equal(FLAG_DEFAULTS.MERCHANT_DELETE_ENABLED, false,
    '🔴 `MERCHANT_DELETE_ENABLED` viene encendido por defecto. Esto BORRA datos y es irreversible: ' +
    'se construye, no se enciende.');
});

test('SCRUM-244 · SUELO: hay campos personales que redactar, y son los elegidos', () => {
  assert.ok(Object.keys(CAMPOS_PERSONALES).length >= 2, '🔴 no hay modelos con campos personales: no se redactaría nada.');
  for (const modelo of ['merchant', 'customer']) {
    assert.ok((CAMPOS_PERSONALES[modelo] ?? []).length >= 4,
      `🔴 «${modelo}» tiene menos campos personales de los que tiene: una anonimización corta deja ` +
      'identificables los datos que dice haber borrado.');
  }
});

test('SCRUM-244 · 🔴 la redacción NO puede tocar lo sellado (regla 29)', () => {
  for (const modelo of Object.keys(CAMPOS_PERSONALES)) {
    assert.deepEqual(tocaIntocables(redaccionesPara(modelo)), [],
      `🔴 la redacción de «${modelo}» tocaría campos sellados. Lo sellado no se toca ni para ` +
      'arreglarlo, y romper la cadena cambia un problema legal por otro peor.');
  }
  // Y la red probada de verdad: si alguien mete `vfHash` «para limpiar bien», salta.
  assert.deepEqual(tocaIntocables({ name: 'x', vfHash: 'x' }), ['vfHash'],
    '🔴 la red no detecta un campo sellado en el `data`: entonces no es una red.');
  assert.ok(Object.keys(INTOCABLES).length >= 6);
});

test('SCRUM-244 · el plan dice QUÉ se conserva y POR QUÉ, y viaja al rastro', () => {
  const plan = planDeAnonimizado();
  assert.ok(plan.conservado.length >= 3);
  assert.ok(plan.conservado.some((c) => /17\.3\.b/.test(c.porque)),
    '🔴 el plan no cita la base legal de la conservación: sin ella, conservar datos parece un ' +
    'incumplimiento en vez de una obligación.');
  assert.ok(plan.conservado.some((c) => /regla 29/.test(c.porque)));
});

test('SCRUM-244 · 🔴 ROJO DEL MECANISMO: sin poder anotar, NO se borra nada', async () => {
  // Si la anotación falla y aun así se redacta, quedan datos borrados sin constancia de quién lo
  // pidió ni de qué se hizo. Ese es el defecto que el orden «anotar primero» existe para impedir.
  const tocados = [];
  const r = await suprimirMerchant({
    merchantId: 7, actor: { tipo: 'pro_propietario', teamMemberId: null },
    db: { merchant: { updateMany: async () => { tocados.push('merchant'); return { count: 1 }; } },
          customer: { updateMany: async () => { tocados.push('customer'); return { count: 1 }; } } },
    auditar: async () => { throw new Error('auditlog caído'); },
  });
  assert.equal(r.ok, false);
  assert.equal(r.anotadoAntes, false);
  assert.deepEqual(tocados, [],
    '🔴 SE HA BORRADO SIN DEJAR CONSTANCIA. La anotación va ANTES y es requisito, no adorno: sin ' +
    'ella no se puede demostrar después quién pidió la supresión ni qué se hizo con sus datos.');
  assert.match(r.motivo ?? '', /constancia/);
});

test('SCRUM-244 · las DOS acciones existen y son distintas', () => {
  // Borrar y anonimizar son actos distintos: con una sola acción, dentro de un año nadie podría
  // saber qué se hizo con los datos de quién.
  const fuente = crypto.createHash('sha1'); // (solo para que el import se use)
  assert.ok(fuente);
  const audit = fsLeer('src/modules/system/audit.service.ts');
  assert.match(audit, /'merchant_borrado'/, '🔴 falta la acción `merchant_borrado`.');
  assert.match(audit, /'merchant_anonimizado'/, '🔴 falta la acción `merchant_anonimizado`.');
});

import fs from 'node:fs';
import path from 'node:path';
const RAIZ = path.resolve(import.meta.dirname, '..');
function fsLeer(rel) {
  const p = path.join(RAIZ, rel);
  assert.ok(fs.existsSync(p), `🔴 no existe ${rel}: el guard no puede mirar, y FALLA.`);
  return fs.readFileSync(p, 'utf8');
}

// ── LA SUPERFICIE: la ruta administrativa ──────────────────────────────────────────────────
//
// ⚠️ SIN TOCAR NINGUNA BASE. Se sustituyen los modelos del cliente por DOBLES y se comprueba
// que estan puestos ANTES de invocar nada: si la sustitucion fallara, el test cae ahi y no
// llega a salir una sola consulta. «Nada contra produccion ni staging, ni en lectura» tiene
// que ser un mecanismo, no una intencion.

const RUTA = await import('../dist/modules/system/app/routes/supresion.routes.js');
const { prisma } = await import('../dist/core/db/prisma.js');

/** El handler se DERIVA del router montado; no se reimplementa aqui lo que hace la ruta. */
function handlerDeLaRuta() {
  // El `export default` de TS compilado a CJS llega envuelto dos veces segun quien lo importe:
  // se busca el objeto que TENGA `stack`, en vez de fijar una forma que un dia cambia sola.
  const router = [RUTA.default?.default, RUTA.default, RUTA].find((x) => Array.isArray(x?.stack));
  assert.ok(router, '🔴 no se encuentra el router de supresion: el test no puede mirar, y FALLA.');
  const capas = router.stack.filter((c) => c.route?.methods?.post);
  assert.equal(capas.length, 1,
    `🔴 el router de supresion expone ${capas.length} rutas POST y se esperaba UNA. El test no ` +
    'sabria cual esta probando, y un verde asi no dice nada.');
  const pila = capas[0].route.stack;
  return pila[pila.length - 1].handle;
}

function resFalso() {
  const r = { code: 200, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

/**
 * Pone dobles en el cliente y devuelve el diario de llamadas.
 *
 * `alTocar` decide que hace cada modelo: por defecto EXPLOTA, que es lo que hace falta para
 * probar «no se toco nada» — un contador a cero tambien lo da un doble que nadie instalo.
 */
function doblarCliente(diario, impl = {}) {
  const modelos = ['merchant', 'customer', 'auditLog'];
  const original = {};
  for (const m of modelos) {
    original[m] = prisma[m];
    const doble = {};
    for (const op of ['findUnique', 'updateMany', 'create']) {
      doble[op] = async (args) => {
        diario.push(`${m}.${op}`);
        const f = impl[`${m}.${op}`];
        if (!f) throw new Error(`🔴 la ruta ha llamado a ${m}.${op}, que este caso no esperaba`);
        return f(args);
      };
    }
    prisma[m] = doble;
    // 🔴 EL CINTURON: se comprueba que el doble esta puesto ANTES de invocar la ruta.
    assert.equal(prisma[m].findUnique, doble.findUnique,
      `🔴 no se ha podido sustituir «${m}» del cliente: la ruta usaria el cliente REAL, cuya URL ` +
      'apunta a produccion. Se para aqui a proposito.');
  }
  return () => { for (const m of modelos) prisma[m] = original[m]; };
}

test('SCRUM-244 · 🔴 con el flag APAGADO la ruta responde 404 y no consulta nada', async () => {
  delete process.env.MERCHANT_DELETE_ENABLED;
  const diario = [];
  const restaurar = doblarCliente(diario); // cualquier consulta EXPLOTA
  try {
    const res = resFalso();
    await handlerDeLaRuta()({ params: { merchantId: '7' }, body: { confirmacion: 'lo que sea' } }, res);
    assert.equal(res.code, 404,
      `🔴 la ruta responde ${res.code} con MERCHANT_DELETE_ENABLED apagado. Esto borra datos y es ` +
      'irreversible: se construye, no se enciende (regla 24). Y 404 y no 403 a proposito — una ruta ' +
      'que no existe todavia no anuncia que existe.');
    assert.deepEqual(diario, [],
      '🔴 con el flag apagado la ruta ya ha CONSULTADO la base. El flag deja de ser una puerta y ' +
      'pasa a ser un cartel.');
  } finally { restaurar(); }
});

test('SCRUM-244 · 🔴 confirmacion que no coincide: 409 y ni un dato tocado', async () => {
  process.env.MERCHANT_DELETE_ENABLED = 'true';
  const diario = [];
  const restaurar = doblarCliente(diario, { 'merchant.findUnique': async () => ({ name: 'Fontaneria Perez' }) });
  try {
    for (const escrito of ['si', 'Fontaneria', '', undefined]) {
      const res = resFalso();
      await handlerDeLaRuta()({ params: { merchantId: '7' }, body: { confirmacion: escrito } }, res);
      assert.equal(res.code, 409,
        `🔴 «${escrito}» ha pasado por confirmacion del negocio «Fontaneria Perez». Un «¿seguro?» se ` +
        'pulsa sin leer; hay que escribir el nombre para obligar a MIRAR de quien son los datos que ' +
        'se van, que es el error que de verdad no se deshace.');
    }
    assert.ok(!diario.some((l) => /updateMany/.test(l)),
      '🔴 se ha redactado algo pese a que la confirmacion no coincidia.');
  } finally { restaurar(); delete process.env.MERCHANT_DELETE_ENABLED; }
});

test('SCRUM-244 · con el nombre escrito: ANOTA primero y redacta despues, en ese orden', async () => {
  process.env.MERCHANT_DELETE_ENABLED = 'true';
  const diario = [];
  const restaurar = doblarCliente(diario, {
    'merchant.findUnique': async () => ({ name: 'Fontaneria Perez' }),
    'auditLog.create': async () => ({ id: 1 }),
    'merchant.updateMany': async () => ({ count: 1 }),
    'customer.updateMany': async () => ({ count: 3 }),
  });
  try {
    const res = resFalso();
    // Con espacios y otra caja: el nombre se compara normalizado, no al caracter.
    await handlerDeLaRuta()({ params: { merchantId: '7' }, body: { confirmacion: '  fontaneria perez ' } }, res);
    assert.equal(res.code, 200, `🔴 la supresion no completo: ${JSON.stringify(res.body)}`);
    assert.equal(diario.indexOf('auditLog.create'), 1,
      `🔴 el orden real fue ${diario.join(' → ')}. La anotacion va ANTES de tocar un solo dato: si se ` +
      'anotara despues, un fallo a mitad dejaria datos borrados sin constancia de quien lo pidio.');
    assert.ok(diario.indexOf('auditLog.create') < diario.indexOf('merchant.updateMany'));
    assert.deepEqual(res.body.redactados, [{ modelo: 'merchant', filas: 1 }, { modelo: 'customer', filas: 3 }]);
  } finally { restaurar(); delete process.env.MERCHANT_DELETE_ENABLED; }
});

// ── CON BASE DESECHABLE: el control que decide ───────────────────────────────────────────────

test('SCRUM-244 · CONTRA POSTGRES: se anonimiza, la ANOTACIÓN sobrevive y la CADENA verifica',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable)' },
  async (t) => {
    t.diagnostic(`banco: ${exigirBancoDesechable(URL_BANCO)}`);
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });

    try {
      await withMerchant(prisma, { name: `QA RGPD ${SELLO}`, email: `rgpd.${SELLO}@qa.invalid`, taxId: 'B12345678' }, async (m) => {
        const cli = await prisma.customer.create({
          data: { merchantId: m.id, name: 'Ana Pérez', phone: `+34644${String(m.id).padStart(6, '0')}`, email: 'ana@qa.invalid', taxId: '12345678Z' },
        });

        // Dos facturas ENCADENADAS: la segunda apunta a la huella de la primera.
        const h1 = crypto.createHash('sha256').update('f1').digest('hex');
        const h2 = crypto.createHash('sha256').update(h1 + 'f2').digest('hex');
        const f1 = await prisma.invoice.create({
          data: { merchantId: m.id, customerId: cli.id, number: `2026-CF-${SELLO}-001`, total: '121.00',
                  currency: 'EUR', pdfUrl: 'x', qrData: 'QR1', lines: [{ concept: 'Obra', qty: 1, price: 100, tax: 0.21 }],
                  vfHash: h1, vfPrevHash: null, vfEstado: 'sellado' },
        });
        const f2 = await prisma.invoice.create({
          data: { merchantId: m.id, customerId: cli.id, number: `2026-CF-${SELLO}-002`, total: '242.00',
                  currency: 'EUR', pdfUrl: 'x', qrData: 'QR2', lines: [{ concept: 'Obra', qty: 2, price: 100, tax: 0.21 }],
                  vfHash: h2, vfPrevHash: h1, vfEstado: 'sellado' },
        });

        const r = await suprimirMerchant({ merchantId: m.id, actor: { tipo: 'pro_propietario', teamMemberId: null }, db: prisma });
        assert.equal(r.ok, true, `🔴 la supresión no completó: ${r.motivo}`);
        assert.equal(r.anotadoAntes, true);

        // ① Los datos personales, fuera.
        const merchant = await prisma.merchant.findUnique({ where: { id: m.id } });
        const cliente = await prisma.customer.findUnique({ where: { id: cli.id } });
        assert.equal(merchant.name, REDACTADO, '🔴 el nombre del merchant sigue ahí.');
        assert.equal(merchant.taxId, REDACTADO, '🔴 el NIF sigue ahí.');
        assert.equal(cliente.name, REDACTADO, '🔴 el nombre del cliente sigue ahí.');
        assert.equal(cliente.phone, REDACTADO, '🔴 el teléfono del cliente sigue ahí.');

        // ② 🔴 LA ANOTACIÓN SOBREVIVE. Se lee DESPUÉS, que es la única forma de probarlo: si el
        //    rastro se hubiera ido con el merchant, aquí no habría nada.
        const rastro = await prisma.auditLog.findMany({
          where: { merchantId: m.id, action: 'merchant_anonimizado' },
        });
        assert.equal(rastro.length, 1,
          '🔴 la anotación NO ha sobrevivido a la supresión. Anotar antes de un borrado que se lleva ' +
          'el propio rastro es decorativo: la misma trampa que el vigilante que rompe lo que vigila.');

        // ③ 🔴 EL CONTROL QUE DECIDE: la cadena sigue verificando.
        const [i1, i2] = await Promise.all([
          prisma.invoice.findUnique({ where: { id: f1.id } }),
          prisma.invoice.findUnique({ where: { id: f2.id } }),
        ]);
        assert.equal(i1.vfHash, h1, '🔴 la huella de la primera factura ha cambiado.');
        assert.equal(i2.vfPrevHash, i1.vfHash,
          '🔴 LA CADENA SE HA ROTO: el eslabón de la segunda ya no apunta a la huella de la primera. ' +
          'Habríamos cambiado un problema legal por otro peor, y éste no se arregla — lo sellado no ' +
          'se toca (regla 29).');
        assert.equal(i2.vfHash, h2, '🔴 la huella de la segunda ha cambiado.');
        assert.equal(String(i1.number), `2026-CF-${SELLO}-001`, '🔴 el número, que es la identidad fiscal, se ha tocado.');
        assert.equal(String(i1.total), '121', '🔴 el importe declarado se ha tocado.');
        assert.equal(i1.qrData, 'QR1', '🔴 el QR entregado al cliente se ha tocado.');
      });
    } finally {
      await prisma.$disconnect();
    }
  });
