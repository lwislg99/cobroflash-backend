// tests/scrum348-tenencia-por-lectura.test.mjs — SCRUM-348 · la cobertura, POR LECTURA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL AGUJERO, Y SU TAMAÑO MEDIDO
//
// SCRUM-243 da una lectura por cubierta si **la función que la envuelve menciona `merchantId`**.
// Eso la cubre con el `merchantId` de otra consulta, con uno de un `select`, o con un
// `const { merchantId } = req` que no se usa en ese `where`. Y **crece solo**: cuanto más grande
// es un handler, más probable es que contenga la palabra en algún sitio, así que las lecturas
// nuevas nacen «cubiertas» sin que nadie las mire.
//
// Medido en el árbol real con el criterio por lectura:
//
//     367 lecturas de modelos con `merchantId`
//     · 243 cubiertas (su propio `where` filtra)
//     · 118 sin filtro · 6 no resolubles
//     ⚠️ **80 lecturas** que 243 daba por cubiertas SOLO porque su función menciona `merchantId`
//        — de ellas **74 sin filtro**, y **7 en ruta autenticada**.
//
// Este guard sustituye ese criterio por otro: **una lectura está cubierta si su propio `where`
// filtra**, resolviendo la indirección (una variable local se sigue; una llamada se declara).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL SUELO ES DOBLE, Y LA SEGUNDA MITAD ES LA QUE IMPORTA
//
// ① Si el censo no encuentra lecturas, falla: «cero agujeros» y «no supe mirar» son el mismo cero.
// ② Y si no encontrara ninguna desprotegida, **tiene que demostrar que sabría encontrarla**: hay
//    un control positivo con un handler sintético desprotegido — y otro cuya función SÍ menciona
//    `merchantId` en otro sitio, que es exactamente el caso que 243 dejaba pasar.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { analizarArbol, analizarFuente, clave, CUBOS, modelosConMerchant } from './_tenencia-por-lectura.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const TODO = analizarArbol(RAIZ);
const AUTENTICADAS = TODO.filter((h) => h.autenticada === true);

/**
 * EL CENSO — las lecturas SIN FILTRO en ruta autenticada, leídas UNA A UNA con su veredicto.
 *
 * Ninguna es una puerta abierta, y por eso el veredicto importa más que el número:
 *
 *   PROCEDENCIA · el `where` va por un id que salió de una fila YA filtrada por merchant (los
 *                 `jobs` de la lista, el `job` del detalle, el `quote` ya leído). No hay fuga…
 *                 **mientras la procedencia siga siendo esa**, y eso no lo comprueba nada. Es
 *                 deuda declarada, no un agujero.
 *   PLATAFORMA  · lectura cross-merchant A PROPÓSITO (métrica de plataforma). El propio código lo
 *                 dice en su comentario.
 *
 * Una lectura nueva sin filtro en ruta autenticada que no esté aquí sale ROJA.
 */
const CENSO = {
  'src/modules/jobs/app/routes/jobs.routes.ts::quote.findMany': { veredicto: 'PROCEDENCIA', nota: 'ids de `jobs`, que se leyó con merchantId (lista de trabajos)' },
  'src/modules/jobs/app/routes/jobs.routes.ts::customer.findMany': { veredicto: 'PROCEDENCIA', nota: 'ids de `jobs`, ya filtrado por merchant' },
  'src/modules/jobs/app/routes/jobs.routes.ts::quote.findUnique': { veredicto: 'PROCEDENCIA', nota: '`job.quoteId` de un Job ya acotado; su hermana de la misma llamada SÍ filtra' },
  'src/modules/jobs/app/routes/jobs.routes.ts::customer.findUnique': { veredicto: 'PROCEDENCIA', nota: '`job.customerId` de un Job ya acotado (detalle y enriquecido de SCRUM-292)' },
  'src/modules/system/app/routes/quotesAdmin.routes.ts::teamMember.findUnique': { veredicto: 'PROCEDENCIA', nota: '`quote.teamMemberId` de un presupuesto ya leído en la misma ruta' },
  'src/modules/exports/app/routes/exports.routes.ts::charge.findMany': { veredicto: 'PLATAFORMA', nota: 'cobros de TODA la plataforma a propósito (marcador de Connect, C1-2)' },
};

// ── ① EL SUELO ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-348 · SUELO: el censo encuentra lecturas que auditar', () => {
  assert.ok(TODO.length >= 200,
    `🔴 el censo solo ha encontrado ${TODO.length} lecturas de modelos con merchantId. «Cero ` +
    'agujeros» y «no supe mirar» son el mismo cero: arregla el analizador antes de creerte nada.');
  assert.ok(AUTENTICADAS.length >= 50,
    `🔴 solo ${AUTENTICADAS.length} lecturas en rutas autenticadas: el mapa de montajes no se está ` +
    'leyendo, y sin él no se puede decir si un agujero es alcanzable.');
  assert.ok(TODO.some((h) => h.cubo === CUBOS.CUBIERTA),
    '🔴 ninguna lectura sale como cubierta: el analizador no reconoce ni el caso bueno.');
});

// ── ② EL CONTROL POSITIVO: demuestra que SABE encontrar una desprotegida ─────────────────────

test('SCRUM-348 · CONTROL POSITIVO: una lectura desprotegida se detecta', () => {
  const conMerchant = modelosConMerchant(RAIZ);
  const codigo = `
    router.get('/x', async (req, res) => {
      const filas = await prisma.invoice.findMany({ where: { status: 'paid' } });
      res.json(filas);
    });
  `;
  const [h] = analizarFuente(codigo, 'sintetico.ts', conMerchant);
  assert.ok(h, '🔴 el analizador no ha visto NINGUNA lectura en un handler que tiene una.');
  assert.equal(h.cubo, CUBOS.SIN_FILTRO, '🔴 una lectura sin merchantId se da por cubierta.');
});

test('SCRUM-348 · 🔴 EL AGUJERO DE 243: un merchantId en OTRA consulta ya no cubre', () => {
  // Éste es el ticket entero en un test. Con el criterio viejo, esta lectura salía cubierta.
  const conMerchant = modelosConMerchant(RAIZ);
  const codigo = `
    router.get('/x', async (req, res) => {
      const mias = await prisma.quote.findMany({ where: { merchantId: req.merchantId } });
      const todas = await prisma.invoice.findMany({ where: { status: 'paid' } });
      res.json({ mias, todas });
    });
  `;
  const hallazgos = analizarFuente(codigo, 'sintetico.ts', conMerchant);
  const fuga = hallazgos.find((x) => x.modelo === 'invoice');
  assert.ok(fuga, '🔴 el analizador no ha visto la segunda lectura.');
  assert.equal(fuga.cubo, CUBOS.SIN_FILTRO,
    '🔴 la lectura SIN filtro se da por cubierta porque OTRA consulta del mismo handler filtra. ' +
    'Ése es exactamente el agujero que este ticket cierra.');
  assert.equal(fuga.funcionMencionaMerchant, true,
    '🔴 el caso no reproduce el agujero: la función tiene que mencionar merchantId en otro sitio.');
});

test('SCRUM-348 · un merchantId en el SELECT tampoco cubre', () => {
  const conMerchant = modelosConMerchant(RAIZ);
  const [h] = analizarFuente(`
    async function f(req) {
      return prisma.invoice.findMany({ where: { status: 'paid' }, select: { merchantId: true } });
    }
  `, 'sintetico.ts', conMerchant);
  assert.equal(h.cubo, CUBOS.SIN_FILTRO,
    '🔴 un `merchantId` pedido en el `select` se está tomando por un filtro. Es el dato que sale, ' +
    'no el que acota.');
});

test('SCRUM-348 · CONTROL NEGATIVO: lo que SÍ filtra sale cubierto, en sus tres formas', () => {
  // Sin esta cara, «todo sale sin filtro» daría verde en los tests de arriba.
  const conMerchant = modelosConMerchant(RAIZ);
  const casos = {
    literal: `async function f(req){ return prisma.invoice.findMany({ where: { merchantId: req.merchantId } }); }`,
    anidado: `async function f(req){ return prisma.invoice.findMany({ where: { AND: [{ merchantId: req.merchantId }, { status: 'paid' }] } }); }`,
    variable: `async function f(req){ const w = { merchantId: req.merchantId, status: 'paid' }; return prisma.invoice.findMany({ where: w }); }`,
  };
  for (const [nombre, codigo] of Object.entries(casos)) {
    const [h] = analizarFuente(codigo, 'sintetico.ts', conMerchant);
    assert.equal(h.cubo, CUBOS.CUBIERTA, `🔴 el caso «${nombre}» filtra y sale como ${h.cubo}`);
  }
});

test('SCRUM-348 · una llamada que construye el `where` NO se da por cubierta: se declara', () => {
  // El error contrario al de 243: dar por buena `where: whereRango(merchantId, rango)` sería
  // confiar en una función que puede dejárselo. Se declara `no_resoluble`, que no es «cubierta».
  const conMerchant = modelosConMerchant(RAIZ);
  const [h] = analizarFuente(`
    async function f(req){ return prisma.invoice.findMany({ where: whereRango(req.merchantId, r) }); }
  `, 'sintetico.ts', conMerchant);
  assert.equal(h.cubo, CUBOS.NO_RESOLUBLE);
  assert.notEqual(h.cubo, CUBOS.CUBIERTA,
    '🔴 «no pude resolverlo» se está contando como «filtra», que es cómo se fabrica una medición ' +
    'de seguridad tranquilizadora y falsa.');
});

// ── ③ EL CENSO DEL ÁRBOL REAL ────────────────────────────────────────────────────────────────

test('SCRUM-348 · toda lectura SIN FILTRO en ruta autenticada está CENSADA', () => {
  const sinCensar = AUTENTICADAS
    .filter((h) => h.cubo === CUBOS.SIN_FILTRO)
    .filter((h) => !CENSO[clave(h)])
    .map((h) => `${h.ruta}:${h.linea} ${h.modelo}.${h.metodo}`);

  assert.deepEqual(sinCensar, [],
    `🔴 LECTURAS SIN FILTRO EN RUTA AUTENTICADA Y SIN CLASIFICAR:\n   ${sinCensar.join('\n   ')}\n\n` +
    '  Leer sin `merchantId` no está prohibido: a veces el id viene de una fila ya acotada, y a\n' +
    '  veces la lectura es de plataforma a propósito. Lo que no vale es que aparezca una y NADIE\n' +
    '  la mire — que es lo que pasaba cuando bastaba con que el handler mencionara la palabra.\n\n' +
    '  Clasifícala en CENSO con su veredicto y su motivo, o dale su propio `where`.');
});

test('SCRUM-348 · el censo no describe lecturas que ya no existen (trinquete)', () => {
  const vivas = new Set(AUTENTICADAS.filter((h) => h.cubo === CUBOS.SIN_FILTRO).map(clave));
  const fantasmas = Object.keys(CENSO).filter((k) => !vivas.has(k));
  assert.deepEqual(fantasmas, [],
    `🔴 el censo describe lecturas que ya no están sin filtro: ${fantasmas.join(', ')}. Quítalas ` +
    'EN EL MISMO COMMIT en que dejen de estarlo — un censo con entradas fantasma deja de medir.');
});

test('SCRUM-348 · la deuda por PROCEDENCIA no crece en silencio', () => {
  // Un tope con holgura es el descuadre silencioso: este número baja cuando una lectura recibe su
  // propio `where`, y NO puede subir sin pasar por aquí.
  const PROCEDENCIA_MAX = 5;
  const porProcedencia = Object.values(CENSO).filter((v) => v.veredicto === 'PROCEDENCIA').length;
  assert.ok(porProcedencia <= PROCEDENCIA_MAX,
    `🔴 hay ${porProcedencia} lecturas que dependen de la PROCEDENCIA del id y el tope es ` +
    `${PROCEDENCIA_MAX}. Cada una es correcta hoy y frágil siempre: nada comprueba que el id siga ` +
    'viniendo de una fila acotada.');
  assert.equal(porProcedencia, PROCEDENCIA_MAX,
    `🔴 el tope (${PROCEDENCIA_MAX}) ya no coincide con la deuda real (${porProcedencia}). Si has ` +
    'arreglado una, BAJA el tope en el mismo commit: así queda constancia de la mejora.');
});

// ── ④ LA DIFERENCIA CON 243, MEDIDA Y CONGELADA ──────────────────────────────────────────────

test('SCRUM-348 · queda constancia de cuántas lecturas tapaba el criterio viejo', (t) => {
  const tapadas = TODO.filter((h) => h.cubo !== CUBOS.CUBIERTA && h.funcionMencionaMerchant);
  t.diagnostic(`lecturas que 243 daba por cubiertas solo por la mención en la función: ${tapadas.length}`);
  assert.ok(tapadas.length > 0,
    '🔴 ninguna lectura estaba tapada por el criterio viejo. Si de verdad ya no queda ninguna, este ' +
    'test sobra y hay que quitarlo diciéndolo; mientras haya, el número documenta el agujero.');
});
