// SCRUM-257 · UN ALBARÁN NACE DE UN PRESUPUESTO, Y SUS LÍNEAS VIENEN DE ÉL SIN PRECIOS.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS DOS PIEZAS, Y POR QUÉ SE PRUEBAN DISTINTO
//
//   (a) PRELLENADO (front): el mapeo `Quote.lines → líneas de albarán` es lógica pura escrita en
//       `jobDetailView.js`. Se extrae del fichero y se EJECUTA sobre los datos reales que produce
//       un presupuesto — no se busca su texto. Un guard de texto pasa en verde con el mapeo
//       escrito al revés (mismo criterio que SCRUM-271 y SCRUM-264).
//   (b) GUARD (backend): se invoca el handler REAL con un `prisma` de doble, igual que SCRUM-263.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SON DOS CASOS Y NO UNO, y lo exige el propio ticket: se comprueba que un job SIN presupuesto
// da 409… **y que uno CON presupuesto sigue dando 201**. Probar solo el primero no demuestra que
// el guard rechace lo que debe: demuestra que rechaza. Un guard que bloquea todo también pasaría.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');

/** El texto oficial del rechazo (regla 30, aprobado por el fundador en el ticket). */
const COPY_SIN_PRESUPUESTO = 'Este trabajo no tiene presupuesto; no se puede crear un albarán.';

// ═════════════════════════════════════════════════════════════════════════════════════════
// (a) EL PRELLENADO · se ejecuta el mapeo real del front
// ═════════════════════════════════════════════════════════════════════════════════════════

const jobDetail = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'jobDetailView.js'), 'utf8');

/** Saca `lineasDeQuoteParaAlbaran` del fichero del dashboard y la vuelve ejecutable aquí. */
function mapeoDelFront() {
  const m = jobDetail.match(/function lineasDeQuoteParaAlbaran\(lines\) \{([\s\S]*?)\n\}/);
  assert.ok(
    m,
    '🔴 no encuentro `lineasDeQuoteParaAlbaran` en jobDetailView.js. Si cambió de forma, este ' +
      'fichero dejaría de comprobar el prellenado y pasaría en verde sin mirar nada.',
  );
  return new Function('lines', m[1]);
}

/** Lo que trae un presupuesto de verdad: concepto, cantidad, PRECIO e IVA. */
const LINEAS_DE_QUOTE = [
  { concept: 'Sustituir grifo monomando', qty: 1, price: 85, tax: 21 },
  { concept: 'Tubo cobre 15 mm', qty: 3.5, price: 12.4, tax: 21 },
];

test('SCRUM-257 · (a) el prellenado trae concepto y cantidad, y DESCARTA precio e IVA', () => {
  const mapear = mapeoDelFront();
  const lineas = mapear(LINEAS_DE_QUOTE);

  assert.equal(lineas.length, 2);
  // SCRUM-367: se comparan los campos de ENTREGA, no la forma exacta del objeto. El prellenado
  // añade ahora `quoteLineIndex` —el origen de la línea— y la comparación literal se ponía roja por
  // un campo legítimo. Lo que este test protege es que NO se cuele precio ni IVA, y eso sigue
  // abajo, entero.
  const entrega = (l) => ({ concepto: l.concepto, cantidad: l.cantidad, unidad: l.unidad });
  assert.deepEqual(entrega(lineas[0]), { concepto: 'Sustituir grifo monomando', cantidad: 1, unidad: 'ud' });
  assert.deepEqual(entrega(lineas[1]), { concepto: 'Tubo cobre 15 mm', cantidad: 3.5, unidad: 'ud' });
  // Y el origen que añade SCRUM-367: el índice del PRESUPUESTO, que es lo que por fin distingue una
  // línea prellenada de una añadida en obra — lo que este ticket dio por imposible por no tenerlo.
  assert.equal(lineas[0].quoteLineIndex, 0, '🔴 la primera línea perdió su origen');
  assert.equal(lineas[1].quoteLineIndex, 1, '🔴 la segunda línea perdió su origen');

  // El albarán es COMPROBANTE DE ENTREGA (decisión 3 del fundador): dice QUÉ se entregó, no cuánto
  // cuesta. Y no es solo criterio: `validarLineas` RECHAZA una línea con precio en SIN_VALORAR, así
  // que colar `price` aquí no daría un albarán con precios — daría un 400 al crear.
  for (const l of lineas) {
    assert.ok(!('precioUnitario' in l) && !('price' in l), '🔴 se ha colado el precio en el albarán');
    assert.ok(!('tipoIva' in l) && !('tax' in l), '🔴 se ha colado el IVA en el albarán');
  }
});

test('SCRUM-257 · (a) `unidad` por defecto es «ud», porque el presupuesto no la trae', () => {
  // El quote no tiene unidad y el albarán la EXIGE (`validarLineas`: unidad debe ser texto). Con
  // cadena vacía el documento que alguien lee en obra saldría con un «—» donde va la unidad.
  const mapear = mapeoDelFront();
  for (const l of mapear(LINEAS_DE_QUOTE)) assert.equal(l.unidad, 'ud');
});

test('SCRUM-257 · (a) una línea que no puede ser albarán se DESCARTA, y se puede contar', () => {
  // `validarLineas` rechaza el LOTE entero si una línea no vale (concepto vacío o cantidad ≤ 0),
  // así que colarlas convertiría el prellenado en un 400 al crear. Se descartan — pero el front
  // compara los dos tamaños para avisar: una omisión silenciosa en un documento que se firma es
  // justo lo que SCRUM-271 vino a cerrar.
  const mapear = mapeoDelFront();
  const lineas = mapear([
    { concept: 'Válida', qty: 2, price: 10 },
    { concept: '', qty: 1, price: 10 },        // sin concepto
    { concept: 'Sin cantidad', qty: 0, price: 5 },
    { concept: 'Negativa', qty: -3, price: 5 },
  ]);
  assert.equal(lineas.length, 1, '🔴 se prellenan líneas que el backend va a rechazar');
  assert.equal(lineas[0].concepto, 'Válida');
});

test('SCRUM-257 · (a) sin líneas o con basura, el prellenado no revienta: devuelve vacío', () => {
  const mapear = mapeoDelFront();
  for (const entrada of [null, undefined, [], 'no soy un array', 42]) {
    assert.deepEqual(mapear(entrada), [], `🔴 revienta o inventa con ${JSON.stringify(entrada)}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// (b) EL GUARD · handler real, prisma de doble (patrón de SCRUM-263)
// ═════════════════════════════════════════════════════════════════════════════════════════

const routerDe = (mod) => mod.default?.default ?? mod.default;

async function invocar(req) {
  const router = routerDe(await import(DIST + 'modules/jobs/app/routes/jobs.routes.js'));
  const capa = router.stack.find((l) => l.route?.path === '/:id/albaranes' && l.route?.methods?.post);
  assert.ok(capa, '🔴 no existe POST /:id/albaranes: si la ruta se renombró, este test no comprueba nada');

  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; },
  };
  const handlers = capa.route.stack;
  await handlers[handlers.length - 1].handle(req, res, () => {});
  return salida;
}

/** Deja `prisma` con lo justo para llegar (o no) a la creación. */
function sustituirPrisma(job) {
  moduloPrisma.prisma.job = { findFirst: async () => job, findUnique: async () => job };
  // El `$transaction` devuelve un albarán ya hecho SIN ejecutar el callback: lo que se comprueba
  // aquí es que el guard DEJA PASAR, no la numeración (que tiene sus propios tests).
  moduloPrisma.prisma.$transaction = async () => ({
    id: 9, jobId: job?.id ?? 1, numero: 'A-2026-0001', fecha: new Date(),
    modoValoracion: 'SIN_VALORAR', lineas: [], estado: 'borrador', version: 1,
    merchantId: 7, createdAt: new Date(),
  });
}

const REQ = (id, body = {}) => ({ params: { id: String(id) }, body, merchantId: 7, query: {}, headers: {} });

// 🔴 RE-ANCLADO el 4-sep-2026 (SCRUM-684), y NO es un debilitamiento: es que la REGLA cambió.
//
// El fundador decidió que una AVERÍA abierta como trabajo directo (SCRUM-651) SÍ puede entregar
// albarán — «nadie presupuesta una urgencia» y «hay que dejar papel al irse» (ALB-02) son la misma
// escena, y el guard viejo la partía en dos. El guard se ACOTA, no se quita: lo que sigue
// devolviendo 409 es el caso donde la falta de presupuesto de verdad importa, **una línea que dice
// venir de un presupuesto que no existe** (`quoteLineIndex` sin `quoteId`).
//
// El caso de antes —cuerpo vacío sobre un job sin presupuesto— ahora es un 201, y tiene su propio
// control justo debajo. Los dos siguen aquí: si se pierde cualquiera de los dos, se nota.
test('SCRUM-257 · (b) 🔴 una línea que afirma un origen INEXISTENTE → 409 (acotado en SCRUM-684)', async () => {
  sustituirPrisma({ id: 3, merchantId: 7, quoteId: null });
  const r = await invocar(REQ(3, {
    lineas: [{ concepto: 'Sustituir diferencial', cantidad: 1, unidad: 'ud', quoteLineIndex: 0 }],
  }));

  assert.equal(
    r?.code, 409,
    '🔴 SE ACEPTA UNA LÍNEA QUE DICE VENIR DE UN PRESUPUESTO QUE NO EXISTE. `validarLineas` ' +
      'conserva ese índice sin poder validarlo, y el motor de entrega pendiente se lo cree. ' +
      `Respondió ${r?.code} con ${JSON.stringify(r?.body)}`,
  );
  assert.equal(r.body?.error, 'job_without_quote');
  // ⚠️ EL TEXTO APROBADO YA NO SIRVE, y por eso no se exige: decía «no se puede crear un albarán»
  // y hoy eso es FALSO. El mensaje nuevo sale con marcador (regla 30) y nombra QUÉ línea.
  assert.match(
    r.body?.message || '', /línea 1\b/,
    '🔴 el mensaje no dice QUÉ línea afirma el origen. Sin `message`, el dashboard enseñaría el ' +
      'código crudo «job_without_quote» — el defecto que cerró SCRUM-275 en la página de acceso.',
  );
});

test('SCRUM-257 · (b) 🔴 y una AVERÍA sin líneas enlazadas SÍ crea albarán (SCRUM-684)', async () => {
  // El otro lado del acotado, y es el ticket entero: el técnico abre la avería, la arregla y tiene
  // que poder dejar papel. Sin este control, «acotar» sería indistinguible de «bloquear siempre».
  sustituirPrisma({ id: 3, merchantId: 7, quoteId: null });
  const r = await invocar(REQ(3));

  assert.equal(
    r?.code, 201,
    '🔴 UNA AVERÍA SIGUE SIN PODER ENTREGAR PAPEL: el guard volvió a ser de brocha gorda. ' +
      `Respondió ${r?.code} con ${JSON.stringify(r?.body)}`,
  );
});

test('SCRUM-257 · (b) CONTROL: job CON presupuesto sigue devolviendo 201', async () => {
  // El caso que impide «arreglarlo» bloqueando todo. Sin este control, el guard podría rechazar
  // SIEMPRE y el test de arriba seguiría en verde.
  sustituirPrisma({ id: 4, merchantId: 7, quoteId: 77 });
  const r = await invocar(REQ(4));

  assert.equal(
    r?.code, 201,
    `🔴 el guard bloquea también a los trabajos QUE SÍ tienen presupuesto: ${JSON.stringify(r?.body)}`,
  );
  assert.equal(r.body?.numero, 'A-2026-0001', 'y devuelve el albarán creado, no otra cosa');
});

test('SCRUM-257 · (b) el guard NO se ha puesto en la ruta equivocada', async () => {
  // ⚠️ En este mismo fichero hay OTRO `job_without_quote`, en `collect-rest`: es el PRECEDENTE que
  // el ticket cita, no esta tarea. Medir por el código de error habría dado 257 por hecha estando
  // sin empezar. Este assert ancla que el rechazo sale de la ruta de ALBARANES.
  const src = fs.readFileSync(path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'jobs.routes.ts'), 'utf8');
  const iAlb = src.indexOf("router.post('/:id/albaranes'");
  const iCollect = src.indexOf("router.post('/:id/collect-rest'");
  assert.ok(iAlb !== -1 && iCollect !== -1, '🔴 no encuentro las dos rutas para distinguirlas');

  const cuerpoAlbaranes = src.slice(iAlb, iCollect > iAlb ? iCollect : undefined);
  // 🔴 RE-ANCLADO (SCRUM-684): antes se buscaba el TEXTO aprobado, que ya no vive en esta ruta —
  // el mensaje lo compone `albaranSinPresupuesto.ts`, que es donde vive la decisión. Se ancla a la
  // LLAMADA, que es más fuerte: el texto se puede reescribir sin cambiar quién decide, y lo que
  // este control tiene que distinguir es de QUÉ RUTA sale el rechazo.
  assert.ok(
    cuerpoAlbaranes.includes('veredictoAlbaranSinPresupuesto('),
    '🔴 la ruta de albaranes no consulta el veredicto. Si solo está en collect-rest, lo que ' +
      'hay es el precedente que el ticket cita, no la tarea.',
  );
  // Y el control del propio control: `collect-rest` sigue teniendo SU `job_without_quote`, que es
  // otro rechazo y no éste. Si desapareciera, este test estaría distinguiendo dos cosas iguales.
  const cuerpoCollect = src.slice(iCollect);
  assert.ok(
    cuerpoCollect.includes('job_without_quote'),
    '🔴 el precedente de `collect-rest` ha desaparecido: este control ya no distingue nada.',
  );
});
