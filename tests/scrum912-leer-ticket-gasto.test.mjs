// tests/scrum912-leer-ticket-gasto.test.mjs — SCRUM-912 · leer con IA la foto del ticket de gasto
//
// Sin red y sin base: Google se simula con `globalThis.fetch` y los proveedores con un doble. Lo
// que este fichero sostiene, por orden de lo que costaría romperlo:
//
//   ① SIN CLAUDE. Sin `GEMINI_API_KEY` y CON `ANTHROPIC_API_KEY`, no sale NINGUNA petición: la
//      condición del fundador (SCRUM-934) es que esto no pueda caer a un proveedor de pago.
//   ② La foto viaja a Gemini como `inline_data`, y sin foto el cuerpo sigue siendo SOLO texto.
//   ③ Lo que no cuadra se DESCARTA y se dice; la IA nunca da un ticket por deducible.
//   ④ La ruta: códigos y no frases, el tope diario, y ni la foto ni el NIF en el log.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

const { config } = await import('../dist/core/config/env.js');
const { partesDelUsuario, cuotasDelError, geminiComplete, geminiCompleteConModelo } = await import('../dist/integrations/gemini.js');
const L = await import('../dist/modules/expenses/domain/lecturaTicket.js');
// dist/ es CommonJS: el `export default` llega envuelto en `default.default`.
const modRutas = await import('../dist/modules/expenses/app/routes/expenses.routes.js');
const router = modRutas.default?.default ?? modRutas.default;

const AHORA = new Date('2026-09-18T10:00:00Z');
const FOTO = 'data:image/jpeg;base64,QUJDRA==';
// CIF comprobado a mano en `nifEspanol.ts` (control 1). Con otro control, NO es válido.
const NIF_BUENO = 'A58818501';
const NIF_MALO = 'A58818502';

const LECTURA_COMPLETA = {
  concepto: 'Codos de cobre',
  total: 12.1,
  base: 10,
  tipoIva: 21,
  cuota: 2.1,
  fecha: '2026-09-17',
  numeroFactura: 'T-0042',
  proveedor: 'Almacén Pérez',
  nifProveedor: NIF_BUENO,
};

// Para la RUTA, que usa el `prisma` de verdad: sin NIF válido no busca proveedor y no toca la base.
// El emparejado del proveedor se prueba en el dominio, con su doble (③bis).
const LECTURA_SIN_BASE = { ...LECTURA_COMPLETA, nifProveedor: NIF_MALO };

/** Google simulado. Deja pasar lo local (la app del test) y apunta todo lo demás. */
function simularGoogle(responder) {
  const real = globalThis.fetch;
  const salidas = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith('http://127.0.0.1')) return real(url, init);
    salidas.push({ url: u, body: String(init?.body ?? '') });
    return responder(u, init);
  };
  return { salidas, restaurar: () => { globalThis.fetch = real; } };
}

const respuestaGemini = (objeto) => new Response(
  JSON.stringify({ candidates: [{ content: { parts: [{ text: typeof objeto === 'string' ? objeto : JSON.stringify(objeto) }] } }] }),
  { status: 200, headers: { 'Content-Type': 'application/json' } },
);

async function conApp(merchantId, fn) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use((req, _res, next) => { req.merchantId = merchantId; next(); });
  app.use('/admin/expenses', router);
  const server = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  const base = `http://127.0.0.1:${server.address().port}/admin/expenses`;
  try {
    return await fn(async (body) => {
      const r = await fetch(`${base}/leer-ticket`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      return { status: r.status, json: await r.json() };
    });
  } finally {
    await new Promise((ok) => server.close(ok));
  }
}

function conClaves({ gemini, anthropic }, fn) {
  const antes = { g: config.GEMINI_API_KEY, a: config.ANTHROPIC_API_KEY, m: config.GEMINI_MODEL };
  config.GEMINI_API_KEY = gemini;
  config.ANTHROPIC_API_KEY = anthropic;
  config.GEMINI_MODEL = 'modelo-de-test';
  return Promise.resolve(fn()).finally(() => {
    config.GEMINI_API_KEY = antes.g; config.ANTHROPIC_API_KEY = antes.a; config.GEMINI_MODEL = antes.m;
  });
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① SIN CLAUDE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-912 · 🔴 sin clave de Gemini y CON clave de Anthropic: 503 y NI UNA petición fuera', async () => {
  const g = simularGoogle(() => respuestaGemini(LECTURA_COMPLETA));
  try {
    await conClaves({ gemini: '', anthropic: 'clave-de-mentira' }, async () => {
      // La ruta.
      await conApp(9121, async (post) => {
        const r = await post({ imagen: FOTO });
        assert.equal(r.status, 503);
        assert.equal(r.json.error, 'ai_not_configured');
      });
      // Y el dominio por su camino por defecto, sin la guarda de la ruta delante: tampoco cae.
      await assert.rejects(
        () => L.leerTicket({ merchantId: 9121, imagen: { mimeType: 'image/jpeg', data: 'QUJD' }, ahora: AHORA }),
        (e) => e?.code === 'gemini_not_configured',
      );
    });
    assert.deepEqual(g.salidas, [], '🔴 ha salido una petición sin clave de Gemini: ¿un respaldo de pago?');
  } finally {
    g.restaurar();
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② LA FOTO VIAJA, Y SIN FOTO NADA CAMBIA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-912 · sin imágenes, el turno del usuario es UNA parte de texto (lo de siempre)', () => {
  assert.deepEqual(partesDelUsuario({ user: 'hola' }), [{ text: 'hola' }]);
  assert.deepEqual(partesDelUsuario({ user: 'hola', images: [] }), [{ text: 'hola' }]);
});

test('SCRUM-912 · la foto sale hacia Gemini como inline_data, con el esquema y a temperatura 0', async () => {
  const g = simularGoogle(() => respuestaGemini(LECTURA_SIN_BASE));
  try {
    await conClaves({ gemini: 'clave-de-mentira', anthropic: '' }, async () => {
      await conApp(9122, async (post) => {
        const r = await post({ imagen: FOTO });
        assert.equal(r.status, 200, JSON.stringify(r.json));
        assert.equal(r.json.modelo, L.MODELOS_LECTURA[0], 'la respuesta dice qué modelo contestó');
      });
    });
    assert.equal(g.salidas.length, 1, '🔴 CIEGO: no salió ninguna petición al modelo');
    assert.ok(g.salidas[0].url.includes('generativelanguage.googleapis.com'), 'la petición va a Google');
    // La lista PROPIA, no `GEMINI_MODEL` (que aquí vale «modelo-de-test», el de los presupuestos).
    assert.ok(g.salidas[0].url.includes(`/models/${L.MODELOS_LECTURA[0]}:generateContent`), g.salidas[0].url);
    const cuerpo = JSON.parse(g.salidas[0].body);
    const partes = cuerpo.contents[0].parts;
    assert.deepEqual(partes[0], { inline_data: { mime_type: 'image/jpeg', data: 'QUJDRA==' } });
    assert.equal(typeof partes[1].text, 'string');
    assert.equal(cuerpo.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(cuerpo.generationConfig.responseSchema, JSON.parse(JSON.stringify(L.ESQUEMA_LECTURA)));
    assert.equal(cuerpo.generationConfig.temperature, 0);
  } finally {
    g.restaurar();
  }
});

test('SCRUM-912 · 🔴 la lectura NUNCA cae a gemini-2.5-flash (las 20 diarias son de los presupuestos)', async () => {
  // Todos los modelos de la lista agotados: se prueban TODOS, en orden, y ni uno más.
  const g = simularGoogle(() => new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 }));
  try {
    await conClaves({ gemini: 'clave-de-mentira', anthropic: '' }, () => conApp(9126, async (post) => {
      assert.equal((await post({ imagen: FOTO })).status, 429);
    }));
  } finally {
    g.restaurar();
  }
  const modelos = g.salidas.map((s) => s.url.match(/\/models\/([^:]+):/)?.[1]);
  assert.deepEqual(modelos, [...L.MODELOS_LECTURA]);
  assert.ok(!L.MODELOS_LECTURA.some((m) => /^gemini-2\.5-flash$|^gemini-flash-latest$/.test(m)),
    '🔴 un modelo de los presupuestos se ha colado en la lista de la lectura');
});

test('SCRUM-912 · con `models`, un 404 pasa al siguiente de ESA lista, y se dice cuál contestó', async () => {
  // El mecanismo, con una lista explícita: la de la lectura hoy tiene un solo modelo.
  const g = simularGoogle((url) => (url.includes('/models/modelo-a:')
    ? new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 })
    : respuestaGemini('hola')));
  try {
    await conClaves({ gemini: 'clave-de-mentira', anthropic: '' }, async () => {
      const r = await geminiCompleteConModelo({ system: 's', user: 'u', models: ['modelo-a', 'modelo-b'] });
      assert.deepEqual(r, { texto: 'hola', modelo: 'modelo-b' });
    });
  } finally {
    g.restaurar();
  }
  assert.deepEqual(g.salidas.map((s) => s.url.match(/\/models\/([^:]+):/)?.[1]), ['modelo-a', 'modelo-b'],
    'ni «modelo-de-test» (GEMINI_MODEL) ni nada fuera de la lista');
});

test('SCRUM-912 · lo aditivo: sin `models`, geminiComplete sigue usando GEMINI_MODEL (presupuestos)', async () => {
  const g = simularGoogle(() => respuestaGemini('hola'));
  try {
    await conClaves({ gemini: 'clave-de-mentira', anthropic: '' }, async () => {
      assert.equal(await geminiComplete({ system: 's', user: 'u' }), 'hola');
    });
  } finally {
    g.restaurar();
  }
  assert.equal(g.salidas.length, 1);
  assert.ok(g.salidas[0].url.includes('/models/modelo-de-test:generateContent'), g.salidas[0].url);
  assert.deepEqual(JSON.parse(g.salidas[0].body).contents[0].parts, [{ text: 'u' }]);
});

test('SCRUM-912 · parsearImagen: solo data-URL de imagen admitida, con base64', () => {
  assert.deepEqual(L.parsearImagen(FOTO), { ok: true, mimeType: 'image/jpeg', data: 'QUJDRA==' });
  assert.equal(L.parsearImagen('data:IMAGE/PNG;base64,QUJD').mimeType, 'image/png');
  const casos = [
    [undefined, 'imagen_requerida'],
    ['', 'imagen_requerida'],
    [123, 'imagen_requerida'],
    ['QUJDRA==', 'imagen_no_es_data_url'],
    ['data:image/jpeg,QUJD', 'imagen_no_es_data_url'],
    ['data:application/pdf;base64,QUJD', 'imagen_tipo_no_admitido'],
    ['data:image/gif;base64,QUJD', 'imagen_tipo_no_admitido'],
    ['data:image/jpeg;base64,', 'imagen_vacia'],
    ['data:image/jpeg;base64,QU JD', 'imagen_no_es_data_url'],
  ];
  for (const [entrada, error] of casos) {
    assert.deepEqual(L.parsearImagen(entrada), { ok: false, error }, `entrada ${JSON.stringify(entrada)}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ EL SANEADO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-912 · lectura completa → propuesta con los nombres del POST y nada descartado', () => {
  const { propuesta, descartados } = L.sanearLectura(LECTURA_COMPLETA, AHORA);
  assert.deepEqual(descartados, []);
  assert.deepEqual(propuesta, {
    concept: 'Codos de cobre',
    amount: 12.1,
    baseAmount: 10,
    vatRate: 21,
    vatAmount: 2.1,
    date: '2026-09-17',
    providerInvoiceDate: '2026-09-17',
    providerInvoiceNumber: 'T-0042',
    proveedorNombre: 'Almacén Pérez',
    nifProveedor: NIF_BUENO,
    providerId: null,
  });
});

test('SCRUM-912 · null es «no se leyó», NO un descarte; y el 0 % es un dato', () => {
  const vacio = L.sanearLectura({}, AHORA);
  assert.deepEqual(vacio.descartados, []);
  assert.ok(Object.values(vacio.propuesta).every((v) => v === null));

  const exento = L.sanearLectura({ total: 50, base: 50, tipoIva: 0, cuota: 0 }, AHORA);
  assert.deepEqual(exento.descartados, []);
  assert.equal(exento.propuesta.vatRate, 0);
  assert.equal(exento.propuesta.vatAmount, 0);
});

test('SCRUM-912 · 🔴 lo que no cuadra se DESCARTA y se dice, no se arregla', () => {
  const casos = [
    [{ tipoIva: 0.21 }, 'vatRate', 'tipo_iva_no_admitido'],   // la fracción colada
    [{ tipoIva: 15 }, 'vatRate', 'tipo_iva_no_admitido'],     // no existe en España
    [{ tipoIva: 7.5 }, 'vatRate', 'tipo_iva_no_admitido'],    // existe, pero Expense.vatRate es Int
    [{ tipoIva: '21' }, 'vatRate', 'no_es_numero'],
    [{ total: '12,10' }, 'amount', 'no_es_numero'],           // no se interpreta la coma
    [{ total: 0 }, 'amount', 'fuera_de_rango'],
    [{ total: -3 }, 'amount', 'fuera_de_rango'],
    [{ total: 2_000_000 }, 'amount', 'fuera_de_rango'],
    [{ cuota: -1 }, 'vatAmount', 'fuera_de_rango'],
    [{ total: 12.1, base: 9, cuota: 2.1 }, 'baseAmount', 'no_cuadra_con_el_total'],
    [{ fecha: '2026-09-19' }, 'date', 'fecha_futura'],
    [{ fecha: '2026-02-30' }, 'date', 'fecha_invalida'],
    [{ fecha: '17/09/2026' }, 'date', 'fecha_invalida'],
    [{ fecha: '1999-12-31' }, 'date', 'fecha_invalida'],
    [{ nifProveedor: NIF_MALO }, 'nifProveedor', 'nif_invalido'],
    [{ nifProveedor: 'HOLA' }, 'nifProveedor', 'nif_invalido'],
    [{ numeroFactura: 'x'.repeat(61) }, 'providerInvoiceNumber', 'demasiado_largo'],
    [{ concepto: 42 }, 'concept', 'no_es_texto'],
  ];
  for (const [entrada, campo, motivo] of casos) {
    const { propuesta, descartados } = L.sanearLectura(entrada, AHORA);
    assert.deepEqual(descartados, [{ campo, motivo }], `entrada ${JSON.stringify(entrada)}`);
    assert.equal(propuesta[campo], null, `🔴 ${campo} descartado pero PROPUESTO igual`);
  }
});

test('SCRUM-912 · el céntimo de tolerancia de justificante.ts vale también aquí; dos céntimos, no', () => {
  assert.deepEqual(L.sanearLectura({ total: 12.1, base: 10.01, cuota: 2.1 }, AHORA).descartados, []);
  assert.deepEqual(
    L.sanearLectura({ total: 12.1, base: 10.02, cuota: 2.1 }, AHORA).descartados,
    [{ campo: 'baseAmount', motivo: 'no_cuadra_con_el_total' }],
  );
});

test('SCRUM-912 · el NIF se propone normalizado, y el «hoy» es el de Madrid, no el de UTC', () => {
  assert.equal(L.sanearLectura({ nifProveedor: 'a-5881 8501' }, AHORA).propuesta.nifProveedor, NIF_BUENO);
  // 18-sep 23:30Z ya es 19-sep en Madrid (UTC+2): un ticket del 19 NO es futuro.
  const noche = new Date('2026-09-18T23:30:00Z');
  assert.deepEqual(L.sanearLectura({ fecha: '2026-09-19' }, noche).descartados, []);
});

test('SCRUM-912 · lo que no es un objeto no es una lectura', () => {
  for (const bruto of [null, [], 'texto', 3]) {
    assert.throws(() => L.sanearLectura(bruto, AHORA), /ai_invalid_format/);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③bis EL PROVEEDOR Y EL VEREDICTO
// ═════════════════════════════════════════════════════════════════════════════════════════

function clienteCon(fichas) {
  const consultas = [];
  return {
    consultas,
    provider: { findMany: async (args) => { consultas.push(args); return fichas; } },
  };
}
const completarCon = (objeto) => async () => ({ texto: JSON.stringify(objeto), modelo: 'modelo-doble' });

test('SCRUM-912 · el proveedor se propone solo si su NIF casa con UNA ficha del merchant', async () => {
  const imagen = { mimeType: 'image/jpeg', data: 'QUJD' };
  const uno = clienteCon([{ id: 7, taxId: 'a-58818501' }, { id: 8, taxId: 'B00000000' }]);
  const r = await L.leerTicket({ merchantId: 55, imagen, ahora: AHORA }, { completar: completarCon(LECTURA_COMPLETA), cliente: uno });
  assert.equal(r.propuesta.providerId, 7);
  assert.equal(uno.consultas.length, 1);
  assert.equal(uno.consultas[0].where.merchantId, 55, '🔴 la búsqueda de proveedor no filtra por merchant (regla 2)');

  const dos = clienteCon([{ id: 7, taxId: NIF_BUENO }, { id: 9, taxId: NIF_BUENO }]);
  const r2 = await L.leerTicket({ merchantId: 55, imagen, ahora: AHORA }, { completar: completarCon(LECTURA_COMPLETA), cliente: dos });
  assert.equal(r2.propuesta.providerId, null, 'con dos fichas iguales no se elige ninguna');

  const sinNif = clienteCon([{ id: 7, taxId: NIF_BUENO }]);
  const r3 = await L.leerTicket({ merchantId: 55, imagen, ahora: AHORA },
    { completar: completarCon({ ...LECTURA_COMPLETA, nifProveedor: null }), cliente: sinNif });
  assert.equal(r3.propuesta.providerId, null);
  assert.equal(sinNif.consultas.length, 0, 'sin NIF leído no se consulta la base');
});

test('SCRUM-912 · 🔴 la IA NUNCA da un ticket por deducible: como mucho, «falta confirmar»', async () => {
  const imagen = { mimeType: 'image/jpeg', data: 'QUJD' };
  const r = await L.leerTicket({ merchantId: 55, imagen, ahora: AHORA },
    { completar: completarCon(LECTURA_COMPLETA), cliente: clienteCon([]) });
  assert.equal(r.justificante.veredicto, 'falta_confirmar');
  assert.deepEqual(r.justificante.faltan, ['nif_destinatario_en_el_documento']);
  // 🔴 SCRUM-961b · ESTE ERA EL CASO QUE RELLENABA EL NIF Y NO LO MIRABA. `LECTURA_COMPLETA` trae
  // `NIF_BUENO`, así que aquí corre el emparejamiento entero — contra un merchant SIN proveedores.
  // Sin esta línea, el día que el emparejador enganchara a alguien de la nada, este test seguiría
  // verde. Lo caza `scrum961b` ④, que exige que ningún bloque lea un ticket con NIF sin juzgarlo.
  assert.equal(r.propuesta.providerId, null, '🔴 sin NINGUNA ficha se ha enganchado un proveedor');

  const ticket = await L.leerTicket({ merchantId: 55, imagen, ahora: AHORA },
    { completar: completarCon({ total: 3.5, fecha: '2026-09-17' }), cliente: clienteCon([]) });
  assert.equal(ticket.justificante.veredicto, 'no_deducible');
});

test('SCRUM-912 · lo que devuelve el modelo sin ser JSON es ai_invalid_json', async () => {
  await assert.rejects(
    () => L.leerTicket({ merchantId: 55, imagen: { mimeType: 'image/jpeg', data: 'QUJD' }, ahora: AHORA },
      { completar: async () => ({ texto: 'esto no es json', modelo: 'modelo-doble' }), cliente: clienteCon([]) }),
    /ai_invalid_json/,
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ LA RUTA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-912 · la ruta: foto mala → 400 con código, y no se llama a Google', async () => {
  const g = simularGoogle(() => respuestaGemini(LECTURA_COMPLETA));
  try {
    await conClaves({ gemini: 'clave-de-mentira', anthropic: '' }, () => conApp(9123, async (post) => {
      const r = await post({ imagen: 'data:application/pdf;base64,QUJD' });
      assert.equal(r.status, 400);
      assert.deepEqual(r.json, { ok: false, error: 'imagen_tipo_no_admitido' });
    }));
    assert.equal(g.salidas.length, 0);
  } finally {
    g.restaurar();
  }
});

test('SCRUM-912 · 🔴 el tope diario corta en LECTURAS_TICKET_POR_DIA + 1, y es por merchant', async () => {
  const g = simularGoogle(() => respuestaGemini({ total: 3 }));
  try {
    await conClaves({ gemini: 'clave-de-mentira', anthropic: '' }, async () => {
      await conApp(9124, async (post) => {
        for (let i = 1; i <= L.LECTURAS_TICKET_POR_DIA; i += 1) {
          const r = await post({ imagen: FOTO });
          assert.equal(r.status, 200, `lectura ${i}`);
        }
        const corte = await post({ imagen: FOTO });
        assert.equal(corte.status, 429);
        assert.deepEqual(corte.json, { ok: false, error: 'lecturas_agotadas' });
      });
      await conApp(9125, async (post) => {
        assert.equal((await post({ imagen: FOTO })).status, 200, 'otro merchant no hereda el tope');
      });
    });
    assert.equal(g.salidas.length, L.LECTURAS_TICKET_POR_DIA + 1, 'la lectura cortada no llega a Google');
  } finally {
    g.restaurar();
  }
});

/** Un 429 con la forma documentada de Google: `error.details[].violations[].quotaId`. */
const error429 = (...quotaIds) => () => new Response(JSON.stringify({
  error: {
    code: 429, message: 'quota', status: 'RESOURCE_EXHAUSTED',
    details: [
      { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: quotaIds.map((quotaId) => ({ quotaId, quotaValue: '20' })) },
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '13s' },
    ],
  },
}), { status: 429 });
const DIARIA = 'GenerateRequestsPerDayPerProjectPerModel-FreeTier';
const POR_MINUTO = 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier';

test('SCRUM-912 · el 429 de Google: la diaria manda sobre la del minuto, y sin quotaId no se adivina', () => {
  assert.deepEqual(cuotasDelError(JSON.stringify({ error: { details: [{ violations: [{ quotaId: DIARIA }] }] } })), [DIARIA]);
  assert.deepEqual(cuotasDelError('no es json'), []);
  assert.deepEqual(cuotasDelError(JSON.stringify({ error: { message: 'x' } })), []);
  assert.equal(L.corteDeCuota([DIARIA]), 'diaria');
  assert.equal(L.corteDeCuota([POR_MINUTO]), 'por_minuto');
  assert.equal(L.corteDeCuota([POR_MINUTO, DIARIA]), 'diaria');
  assert.equal(L.corteDeCuota([]), 'desconocida');
  assert.equal(L.corteDeCuota(undefined), 'desconocida');
});

test('SCRUM-912 · errores de Google → códigos (429, 502, 422), nunca un 500 ni una frase', async () => {
  const casos = [
    // La cuota de Google: código PROPIO, distinto de `ai_not_configured` y de `lecturas_agotadas`.
    [error429(DIARIA), 429, 'ai_cuota_diaria_agotada'],
    [error429(POR_MINUTO), 429, 'ai_cuota_por_minuto'],
    [() => new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 }), 429, 'ai_cuota_agotada'],
    [() => new Response('fallo', { status: 500 }), 502, 'ai_provider_error'],
    [() => respuestaGemini('esto no es json'), 422, 'ai_could_not_parse'],
    [() => respuestaGemini([1, 2]), 422, 'ai_could_not_parse'],
  ];
  let merchant = 9130;
  for (const [responder, status, error] of casos) {
    const g = simularGoogle(responder);
    try {
      await conClaves({ gemini: 'clave-de-mentira', anthropic: '' }, () => conApp(merchant++, async (post) => {
        const r = await post({ imagen: FOTO });
        assert.equal(r.status, status, error);
        assert.deepEqual(r.json, { ok: false, error });
      }));
    } finally {
      g.restaurar();
    }
  }
});

test('SCRUM-912 · 🔴 ni la foto ni lo leído acaban en el log', async () => {
  const g = simularGoogle(() => respuestaGemini(LECTURA_SIN_BASE));
  const escrito = [];
  const originales = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const k of Object.keys(originales)) console[k] = (...a) => { escrito.push(a.map(String).join(' ')); };
  try {
    await conClaves({ gemini: 'clave-de-mentira', anthropic: '' }, () => conApp(9140, async (post) => {
      const r = await post({ imagen: FOTO });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      // CONTROL: los datos SÍ se leyeron; si no, «no están en el log» no mediría nada.
      assert.equal(r.json.propuesta.proveedorNombre, 'Almacén Pérez');
      assert.deepEqual(r.json.descartados, [{ campo: 'nifProveedor', motivo: 'nif_invalido' }]);
    }));
    // Y por el camino del error, que es donde se tiende a volcar lo que se tiene a mano.
    g.restaurar();
    const g2 = simularGoogle(() => respuestaGemini('no json ' + NIF_MALO));
    try {
      await conClaves({ gemini: 'clave-de-mentira', anthropic: '' }, () => conApp(9141, (post) => post({ imagen: FOTO })));
    } finally {
      g2.restaurar();
    }
  } finally {
    Object.assign(console, originales);
    g.restaurar();
  }
  const todo = escrito.join('\n');
  assert.ok(escrito.length > 0, 'CONTROL: el camino del error SÍ escribe en el log (si no, esto es ciego)');
  const enviadoAGoogle = g.salidas.map((s) => s.body).join('\n');
  assert.ok(enviadoAGoogle.includes('QUJDRA=='), 'CONTROL: la foto SÍ estaba en la mano: viajó a Google');
  assert.ok(!todo.includes(NIF_MALO), '🔴 el NIF del proveedor ha acabado en el log');
  assert.ok(!todo.includes('QUJDRA=='), '🔴 la foto ha acabado en el log');
  assert.ok(!todo.includes('Almacén Pérez'), '🔴 el nombre del proveedor ha acabado en el log');
});
