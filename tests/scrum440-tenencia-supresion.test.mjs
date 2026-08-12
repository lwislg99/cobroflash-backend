// tests/scrum440-tenencia-supresion.test.mjs — SCRUM-440
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL AGUJERO
//
// `POST /admin/supresion/:merchantId` tomaba el merchant de la URL y **nunca lo comparaba con el
// del solicitante**: `req.merchantId` aparecía CERO veces en el fichero. Un admin autenticado del
// merchant A que supiera el NOMBRE del negocio B podía anonimizar a B.
//
// Lo único que lo contenía era que `MERCHANT_DELETE_ENABLED` está en `false` y la ruta responde 404
// antes de tocar nada. Construida y no encendida — pero ese 404 era lo único que había entre esto y
// un incidente el día que se encienda.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ NINGÚN GUARD DE TENENCIA LO VEÍA — y no es descuido, es ceguera estructural
//
// Los censos de SCRUM-243/348 miran lecturas de modelos **con columna `merchantId`**. `merchant` es
// el modelo RAÍZ y no la tiene (medido: 22 modelos la tienen, `merchant` no). Así que
// `prisma.merchant.findUnique({ where: { id: merchantId } })` produce **cero lecturas censables**.
//
// Por eso la inclusión en el guard general es **por MECANISMO y no por mención**: el censo nuevo
// (`_censo-merchant-de-la-url.mjs`) no pregunta qué modelo se lee, sino **de dónde sale el merchant
// sobre el que se actúa**. Cualquier ruta futura con `:merchantId` entra sola.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { censo, tomasDeMerchantEn } from './_censo-merchant-de-la-url.mjs';
// SCRUM-497: los modelos que hay que doblar se DERIVAN de la lista real (ver `doblarCliente`).
import { CAMPOS_PERSONALES } from '../dist/modules/system/domain/anonimizarMerchant.js';

const RAIZ = path.resolve(import.meta.dirname, '..');

const RUTA = await import('../dist/modules/system/app/routes/supresion.routes.js');
const { prisma } = await import('../dist/core/db/prisma.js');

/** El handler se DERIVA del router montado; no se reimplementa aquí lo que hace la ruta. */
function handlerDeLaRuta() {
  const router = [RUTA.default?.default, RUTA.default, RUTA].find((x) => Array.isArray(x?.stack));
  assert.ok(router, '🔴 no se encuentra el router de supresión: el test no puede mirar, y FALLA.');
  const capas = router.stack.filter((c) => c.route?.methods?.post);
  assert.equal(capas.length, 1, `🔴 el router expone ${capas.length} rutas POST y se esperaba UNA.`);
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
 * Dobla los modelos del cliente y devuelve el diario de llamadas.
 *
 * ⚠️ NINGUNA BASE REAL. Se comprueba que el doble ESTÁ PUESTO antes de invocar: si la sustitución
 * fallara, el test cae ahí y no sale una sola consulta hacia la URL de producción.
 */
function doblarCliente(diario, impl = {}) {
  // 🔴 SCRUM-497 · DERIVADO de `CAMPOS_PERSONALES`, antes estaba a mano. Al añadir `emailMessage` a
  // la lista de anonimización, la ruta llamó a un doble que no existía y este CONTROL POSITIVO dio
  // 500: decía «el dueño ya no puede pedir su supresión» cuando lo único roto era su propio fixture.
  // Se deriva el DOBLE; las expectativas del test siguen escritas a mano.
  const modelos = [...new Set([...Object.keys(CAMPOS_PERSONALES), 'auditLog'])];
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
    assert.equal(prisma[m].findUnique, doble.findUnique,
      `🔴 no se ha podido sustituir «${m}»: la ruta usaría el cliente REAL. Se para aquí a propósito.`);
  }
  return () => { for (const m of modelos) prisma[m] = original[m]; };
}

// ══ EL CONTROL QUE MÁS IMPORTA: TENENCIA ═════════════════════════════════════════════════════

test('SCRUM-440 · 🔴 pedir la supresión de OTRO merchant: 404 y NI UNA CONSULTA', async () => {
  process.env.MERCHANT_DELETE_ENABLED = 'true';        // encendido SOLO dentro del test
  const diario = [];
  const restaurar = doblarCliente(diario);             // cualquier consulta EXPLOTA
  try {
    const res = resFalso();
    await handlerDeLaRuta()(
      { params: { merchantId: '99' }, merchantId: 7, body: { confirmacion: 'lo que sea' } },
      res,
    );

    // El diario PRIMERO: es el hecho más grave y el que se pierde si falla antes el código de
    // estado. Sin la comparación, la ruta llega a `merchant.findUnique` con un id ajeno — y el
    // 500 que devuelve el doble al explotar taparía el hallazgo detrás de un «error interno».
    assert.deepEqual(diario, [],
      `🔴 SE HA CONSULTADO LA BASE con el merchant de OTRO (${diario.join(', ')}). No basta con ` +
      'devolver 404: la comparación tiene que ir ANTES de mirar. Una respuesta que llega después ' +
      'de leer delata por el tiempo, por los logs y por cualquier efecto de esa lectura.');

    assert.equal(res.code, 404,
      `🔴 la ruta responde ${res.code} a quien pide un merchant AJENO. Y 404 y no 403 a propósito: ` +
      'un 403 confirmaría que ese merchant existe, y eso es información que no se le debe a quien ' +
      'pregunta por uno ajeno.');
  } finally { restaurar(); delete process.env.MERCHANT_DELETE_ENABLED; }
});

test('SCRUM-440 · CONTROL POSITIVO: el merchant PROPIO sí puede pedir su supresión', async () => {
  process.env.MERCHANT_DELETE_ENABLED = 'true';
  const diario = [];
  const restaurar = doblarCliente(diario, {
    'merchant.findUnique': async () => ({ name: 'Fontaneria Perez' }),
    'auditLog.create': async () => ({ id: 1 }),
    'merchant.updateMany': async () => ({ count: 1 }),
    'customer.updateMany': async () => ({ count: 3 }),
    // SCRUM-497: la supresión también redacta la dirección de `email_messages` (la fila se conserva).
    'emailMessage.updateMany': async () => ({ count: 2 }),
  });
  try {
    const res = resFalso();
    await handlerDeLaRuta()(
      { params: { merchantId: '7' }, merchantId: 7, body: { confirmacion: 'Fontaneria Perez' } },
      res,
    );
    assert.equal(res.code, 200,
      `🔴 el merchant propio ya no puede pedir su supresión: ${JSON.stringify(res.body)}. Cerrar la ` +
      'puerta a los ajenos no puede cerrarla también al dueño — eso no sería tenencia, sería una ruta rota.');
    assert.ok(diario.includes('auditLog.create'), '🔴 no ha quedado constancia de la supresión propia.');
  } finally { restaurar(); delete process.env.MERCHANT_DELETE_ENABLED; }
});

test('SCRUM-440 · la tenencia se comprueba ANTES que el flag no la haga irrelevante', async () => {
  // Con el flag apagado la ruta ya daba 404 a todo el mundo. Eso NO es tenencia: es que la puerta
  // está cerrada. Si mañana se enciende el flag, lo único que queda es la comparación de arriba.
  delete process.env.MERCHANT_DELETE_ENABLED;
  const diario = [];
  const restaurar = doblarCliente(diario);
  try {
    const res = resFalso();
    await handlerDeLaRuta()({ params: { merchantId: '99' }, merchantId: 7, body: {} }, res);
    assert.equal(res.code, 404);
    assert.deepEqual(diario, [], '🔴 con el flag apagado ya se consulta la base.');
  } finally { restaurar(); }
});

// ══ EL GUARD GENERAL, POR MECANISMO ══════════════════════════════════════════════════════════

test('SCRUM-440 · SUELO: el censo mira el árbol y ENCUENTRA la ruta que sabemos que existe', () => {
  const r = censo(RAIZ);
  assert.ok(r.ficherosMirados >= 150,
    `🔴 el censo solo ha mirado ${r.ficherosMirados} ficheros de src/. «Nadie toma el merchant de ` +
    'la URL» y «no supe leer el árbol» dan el mismo verde.');
  assert.ok(r.tomas.length >= 1,
    '🔴 el censo NO encuentra ni una función que tome el merchant de la petición, y sabemos que ' +
    '`POST /admin/supresion/:merchantId` lo hace. El detector está ciego: falla declarándolo.');
  assert.ok(r.tomas.some((t) => t.fichero.endsWith('supresion.routes.ts')),
    '🔴 el censo no ve la ruta de supresión, que es el caso del que sale este ticket.');
});

test('SCRUM-440 · 🔴 el detector distingue COMPARAR de MENCIONAR (la lección de SCRUM-348)', () => {
  const sinComparar = tomasDeMerchantEn('x.ts', `
    router.post('/:merchantId', async (req, res) => {
      const id = Number(req.params.merchantId);
      const m = await prisma.merchant.findUnique({ where: { id } });
      return res.json(m);
    });
  `);
  assert.equal(sinComparar.length, 1, '🔴 el detector no ve una toma evidente del merchant de la URL.');
  assert.equal(sinComparar[0].comparaConElSolicitante, false,
    '🔴 se da por cubierta una función que NUNCA compara con `req.merchantId`.');

  const comparando = tomasDeMerchantEn('x.ts', `
    router.post('/:merchantId', async (req, res) => {
      const id = Number(req.params.merchantId);
      if (id !== req.merchantId) return res.status(404).json({ error: 'not_found' });
      return res.json(await prisma.merchant.findUnique({ where: { id } }));
    });
  `);
  assert.equal(comparando[0].comparaConElSolicitante, true,
    '🔴 no se reconoce la comparación con `req.merchantId`: el guard marcaría también lo que está bien.');

  // 🔴 LA TRAMPA DE SCRUM-348, en su forma exacta: el merchant del solicitante mencionado en OTRA
  // función del mismo fichero no cubre a ésta.
  const otraFuncion = tomasDeMerchantEn('x.ts', `
    function otra(req) { return prisma.job.findMany({ where: { merchantId: req.merchantId } }); }
    router.post('/:merchantId', async (req, res) => {
      const id = Number(req.params.merchantId);
      return res.json(await prisma.merchant.findUnique({ where: { id } }));
    });
  `);
  const laDeLaUrl = otraFuncion.find((t) => !t.comparaConElSolicitante);
  assert.ok(laDeLaUrl,
    '🔴 una mención de `req.merchantId` en OTRA función del mismo fichero está tapando la de la ' +
    'URL. Es el defecto que SCRUM-348 corrigió: cubrir por MENCIÓN crece hacia el falso verde.');
});

test('SCRUM-440 · 🔴 CONTROL NEGATIVO: lo que NO toma el merchant de la URL no cae', () => {
  // Un guard que marca todo no marca nada.
  const nada = tomasDeMerchantEn('x.ts', `
    router.get('/:id', async (req, res) => {
      const id = Number(req.params.id);
      return res.json(await prisma.job.findMany({ where: { id, merchantId: req.merchantId } }));
    });
    router.get('/mios', async (req, res) => {
      return res.json(await prisma.quote.findMany({ where: { merchantId: req.merchantId } }));
    });
    function pinta(req) { return req.params.customerId; }
  `);
  assert.deepEqual(nada, [],
    `🔴 el censo marca ${nada.length} funciones que NO toman el merchant de la petición: ` +
    `${JSON.stringify(nada)}. Un guard que marca todo acaba desactivado, y con él se va la ` +
    'protección real.');
});

test('SCRUM-440 · 🔴 EL CENSO: nadie actúa sobre un merchant de la petición sin comparar', () => {
  const { sinComparar } = censo(RAIZ);
  const lista = sinComparar.map((t) => `${t.fichero}:${t.linea}\n      ${t.fragmento}`);

  assert.deepEqual(lista, [],
    `🔴 HAY HANDLERS QUE ACTÚAN SOBRE UN MERCHANT ELEGIDO POR QUIEN LLAMA:\n    ${lista.join('\n    ')}\n\n` +
    '  El `merchantId` de `req.params`/`query`/`body` lo elige quien hace la petición. Sin\n' +
    '  compararlo con `req.merchantId` —el que inyecta `requireAuth`— cualquiera con sesión puede\n' +
    '  operar sobre el negocio de otro (regla 2).\n\n' +
    '  Arreglo: `if (id !== req.merchantId) return res.status(404)…`, y **antes de leer nada**: un\n' +
    '  403, o un 404 que llegue después de la consulta, confirma que ese merchant existe.\n\n' +
    '  Los censos de SCRUM-243/348 NO cubren esto: miran modelos con columna `merchantId`, y\n' +
    '  `merchant` es la raíz y no la tiene.');
});
