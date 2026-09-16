// tests/scrum687-constancia-del-alter.test.mjs — SCRUM-687
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA CONSTANCIA DEL `ALTER` · Y LA DA PRODUCCIÓN, NO EL AUTOR DEL PR
//
// Producción estuvo NUEVE DÍAS sin desplegar. Tres veces se mergeó el esquema sin haber aplicado
// el `ALTER`, y `schemaDrift` se negó a arrancar —correctamente—. Nadie lo vio: un healthcheck
// fallido deja vivo el despliegue anterior, así que el síntoma es «no cambia nada».
//
// 🔴 EL SECRETO NO APARECE EN NINGUNA PARTE DE ESTE FICHERO. Los tests inyectan uno SUYO en el
// entorno de su propio proceso. El valor real no lo conoce esta sesión, y no hay ninguno «de
// ejemplo»: un secreto de ejemplo en un test es el primer sitio donde alguien copia uno de verdad.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RAIZ = path.resolve(import.meta.dirname, '..');
const { compararConstancia, mensajeDeConstancia, CONSULTA_COLUMNAS, TOPE_ESPERADAS } =
  await import('../dist/core/db/constanciaDelAlter.js');
const { secretoConfigurado, LARGO_MINIMO, requireSchemaCheckSecret } =
  await import('../dist/core/http/schemaCheckAuth.js');

/** Un catálogo de mentira: lo que devolvería `information_schema` de una base sana. */
const REALES = ['quotes.id', 'quotes.doc_header_text', 'jobs.id', 'customers.contact_kind'];

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LOS TRES CONTROLES OBLIGATORIOS
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-687 · ✅ POSITIVO: una que existe y una inventada → devuelve EXACTAMENTE la inventada', () => {
  const c = compararConstancia(['quotes.id', 'quotes.columna_inventada'], REALES);
  assert.equal(c.ok, true, `🔴 no pudo comparar: ${c.motivo}`);
  assert.deepEqual(c.faltan, ['quotes.columna_inventada'],
    '🔴 no devuelve exactamente la inventada: o se deja una real fuera, o se traga la que falta.');
  assert.equal(c.comparadas, 2,
    '🔴 `comparadas` no es el total enviado. Si no cuadra, la respuesta no describe la pregunta.');
});

test('SCRUM-687 · 🔴 SUELO: con CERO esperadas NO puede decir «todo bien»', () => {
  for (const vacio of [[], null, undefined]) {
    const c = compararConstancia(vacio, REALES);
    assert.equal(c.ok, false,
      '🔴 con cero columnas esperadas contesta que no falta nada. «No hay columnas que falten» y '
      + '«no me han preguntado por ninguna» son el mismo `faltan: []` con significados opuestos.');
    assert.equal(c.comparadas, 0);
    assert.match(c.motivo, /NINGUNA columna esperada/);
  }
});

test('SCRUM-687 · 🔴 NEGATIVO: una columna que EXISTE no aparece jamás en `faltan`', () => {
  const c = compararConstancia(REALES, REALES);
  assert.equal(c.ok, true);
  assert.deepEqual(c.faltan, [],
    '🔴 acusa de faltar a columnas que están: el filtro está al revés o compara mal.');
  assert.equal(c.comparadas, REALES.length);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL OTRO SUELO: el catálogo vacío no es «faltan todas»
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-687 · 🔴 SUELO: catálogo vacío NO se lee como «faltan todas»', () => {
  for (const nada of [[], null, undefined]) {
    const c = compararConstancia(['quotes.id'], nada);
    assert.equal(c.ok, false,
      '🔴 con el catálogo vacío dice que faltan todas. O la conexión apunta a otro esquema o no se '
      + 'pudo leer: en ninguno de los dos casos «faltan todas» es cierto.');
  }
});

test('SCRUM-687 · las entradas ilegibles se RECHAZAN, no se cuentan como comparadas', () => {
  for (const mala of [['sin_punto'], ['tabla.'], ['.columna'], ['a.b.c'], [42], [null], ['drop table x']]) {
    const c = compararConstancia(mala, REALES);
    assert.equal(c.ok, false, `🔴 «${JSON.stringify(mala)}» pasa por columna válida.`);
    assert.equal(c.comparadas, 0,
      '🔴 cuenta como comparada una entrada que no supo leer.');
  }
  // CONTROL del propio suelo: una BUENA sí pasa. Si no, sus rechazos no significarían nada.
  assert.equal(compararConstancia(['quotes.id'], REALES).ok, true,
    '🔴 rechaza también una entrada correcta: el validador dice que no a todo.');
});

test('SCRUM-687 · duplicados: `comparadas` cuenta columnas DISTINTAS, no líneas del cuerpo', () => {
  const c = compararConstancia(['quotes.id', 'quotes.id', 'quotes.x'], REALES);
  assert.equal(c.comparadas, 2, '🔴 cuenta la repetida dos veces: `N` dejaría de cuadrar con lo enviado.');
  assert.deepEqual(c.faltan, ['quotes.x']);
});

test('SCRUM-687 · hay un tope de esperadas, y pasarlo se rechaza', () => {
  const muchas = Array.from({ length: TOPE_ESPERADAS + 1 }, (_, i) => `t.c${i}`);
  assert.equal(compararConstancia(muchas, REALES).ok, false, '🔴 acepta un cuerpo sin límite.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL MENSAJE OBSERVA, NO AFIRMA
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-687 · 🔴 el mensaje OBSERVA: dice cuántas y CUÁLES, no «está aplicado»', () => {
  const m = mensajeDeConstancia(compararConstancia(['quotes.id', 'jobs.zzz'], REALES));
  assert.match(m, /producción no tiene 1 de las 2 columnas preguntadas/,
    '🔴 no dice cuántas de cuántas.');
  assert.match(m, /jobs\.zzz/, '🔴 no NOMBRA la que falta: quien lo lea no puede escribir el ALTER.');
  // Y lo que NO puede decir: una afirmación en presente sobre el mecanismo.
  for (const prohibida of ['está aplicado', 'esquema correcto', 'todo bien']) {
    assert.equal(m.includes(prohibida), false, `🔴 el mensaje afirma «${prohibida}».`);
  }
  const sano = mensajeDeConstancia(compararConstancia(REALES, REALES));
  assert.match(sano, /producción responde que no le falta ninguna de las 4/,
    '🔴 el caso sano tampoco puede afirmar: dice lo que producción RESPONDE.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 FAIL-CLOSED · los tres desenlaces del secreto
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** Un secreto de USAR Y TIRAR, generado aquí. No hay ninguno escrito en este fichero. */
const SECRETO_DE_ESTE_PROCESO = crypto.randomBytes(24).toString('hex');

function respuestaDeMentira() {
  const r = { codigo: null, cuerpo: null, enviado: false };
  return {
    r,
    status(c) { r.codigo = c; return this; },
    send(x) { r.cuerpo = x; r.enviado = true; return this; },
    json(x) { r.cuerpo = x; r.enviado = true; return this; },
  };
}

test('SCRUM-687 · 🔴 SIN secreto configurado, el endpoint NO EXISTE (404)', () => {
  const previo = process.env.SCHEMA_CHECK_SECRET;
  delete process.env.SCHEMA_CHECK_SECRET;
  try {
    assert.equal(secretoConfigurado(), null);
    const res = respuestaDeMentira();
    let paso = false;
    requireSchemaCheckSecret({ headers: {} }, res, () => { paso = true; });
    assert.equal(paso, false, '🔴 deja pasar sin secreto configurado.');
    assert.equal(res.r.codigo, 404,
      '🔴 no responde 404. No puede decir «no configurado» ni responder vacío: un endpoint que '
      + 'anuncia que está apagado es un endpoint que anuncia que existe.');
  } finally {
    if (previo === undefined) delete process.env.SCHEMA_CHECK_SECRET;
    else process.env.SCHEMA_CHECK_SECRET = previo;
  }
});

test('SCRUM-687 · 🔴 un secreto DEMASIADO CORTO cuenta como no configurado', () => {
  const previo = process.env.SCHEMA_CHECK_SECRET;
  // Se GENERA, no se escribe: mi propio detector de secretos literales cazó la version
  // anterior de esta linea, y tenia razon. Un valor entre comillas asignado a esa variable
  // no puede existir en este arbol ni aunque sea inofensivo.
  process.env.SCHEMA_CHECK_SECRET = crypto.randomBytes(LARGO_MINIMO - 1).toString('hex').slice(0, LARGO_MINIMO - 1);
  try {
    assert.equal(secretoConfigurado(), null,
      '🔴 acepta un secreto corto. Es tener la puerta cerrada con un pestillo que se abre soplando '
      + 'y creer que está cerrada.');
  } finally {
    if (previo === undefined) delete process.env.SCHEMA_CHECK_SECRET;
    else process.env.SCHEMA_CHECK_SECRET = previo;
  }
});

test('SCRUM-687 · 🔴 secreto INCORRECTO → 401, y sin decir nada del esquema', () => {
  const previo = process.env.SCHEMA_CHECK_SECRET;
  process.env.SCHEMA_CHECK_SECRET = SECRETO_DE_ESTE_PROCESO;
  try {
    for (const traido of ['', 'otro', SECRETO_DE_ESTE_PROCESO + 'x', SECRETO_DE_ESTE_PROCESO.slice(0, -1)]) {
      const res = respuestaDeMentira();
      let paso = false;
      requireSchemaCheckSecret({ headers: { 'x-schema-check-secret': traido } }, res, () => { paso = true; });
      assert.equal(paso, false, `🔴 deja pasar con la llave «${traido.slice(0, 6)}…».`);
      assert.equal(res.r.codigo, 401, '🔴 no responde 401 con la llave equivocada.');
      const dicho = JSON.stringify(res.r.cuerpo);
      for (const filtracion of ['quotes', 'columna', 'information_schema', 'faltan']) {
        assert.equal(dicho.includes(filtracion), false,
          `🔴 el 401 filtra «${filtracion}»: quien trae la llave mala no puede llevarse pistas.`);
      }
    }
  } finally {
    if (previo === undefined) delete process.env.SCHEMA_CHECK_SECRET;
    else process.env.SCHEMA_CHECK_SECRET = previo;
  }
});

test('SCRUM-687 · CONTROL POSITIVO del guard: con el secreto BUENO, pasa', () => {
  // Sin esto, todos los rechazos de arriba también saldrían con un guard que dijera que no a todo.
  const previo = process.env.SCHEMA_CHECK_SECRET;
  process.env.SCHEMA_CHECK_SECRET = SECRETO_DE_ESTE_PROCESO;
  try {
    const res = respuestaDeMentira();
    let paso = false;
    requireSchemaCheckSecret(
      { headers: { 'x-schema-check-secret': SECRETO_DE_ESTE_PROCESO } }, res, () => { paso = true; },
    );
    assert.equal(paso, true, '🔴 rechaza el secreto correcto: sus «no» no significarían nada.');
    assert.equal(res.r.enviado, false, '🔴 responde algo aun dejando pasar.');
  } finally {
    if (previo === undefined) delete process.env.SCHEMA_CHECK_SECRET;
    else process.env.SCHEMA_CHECK_SECRET = previo;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL TRINQUETE DE LA COPIA · la consulta no puede divergir de la del arranque
//
// `schemaDrift.ts` NO exporta su consulta y no se puede tocar (es el arranque, y hoy fue lo único
// que funcionó). Así que la copia está FORZADA, y se paga con un trinquete: si las dos dejan de
// mirar lo mismo, esta constancia y el arranque darían verdes que no significan lo mismo — y el
// verde de aquí es el que deja mergear.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-687 · 🔴 la consulta es LA MISMA que la del arranque', () => {
  const drift = fs.readFileSync(path.join(RAIZ, 'src/core/db/schemaDrift.ts'), 'utf8');
  const m = drift.match(/const CONSULTA_COLUMNAS = `([\s\S]*?)`/);
  assert.ok(m, '🔴 CIEGO: no encuentro la consulta en `schemaDrift.ts`; el trinquete no compara nada.');

  const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  assert.equal(norm(CONSULTA_COLUMNAS), norm(m[1]),
    '🔴 la consulta de la constancia ha DIVERGIDO de la del arranque. Las dos tienen que mirar el '
    + 'mismo esquema: si no, esta constancia daría un verde que el arranque no confirmaría — y el '
    + 'verde de aquí es el que deja mergear.');

  // SUELO: y las dos dicen algo. Con dos cadenas vacías, la igualdad de arriba pasaría sola.
  assert.match(norm(CONSULTA_COLUMNAS), /information_schema\.columns/,
    '🔴 la consulta no lee `information_schema`: estaría leyendo cualquier otra cosa.');
  assert.match(norm(CONSULTA_COLUMNAS), /current_schema\(\)/,
    '🔴 no se acota al esquema actual.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// MENCIONAR NO ES HACER · que exista no prueba que alguien lo llame
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-687 · 🔴 la ruta está MONTADA y declarada como superficie pública', () => {
  const app = fs.readFileSync(path.join(RAIZ, 'src/app.ts'), 'utf8');
  assert.match(app, /app\.post\('\/schema-check', requireSchemaCheckSecret/,
    '🔴 la ruta no está montada, o no lleva su guard DELANTE del handler.');

  const dec = fs.readFileSync(path.join(RAIZ, 'src/core/http/publicAccessDeclarations.ts'), 'utf8');
  assert.match(dec, /'\/schema-check'/, '🔴 no está en PUBLIC_TOP_LEVEL_PATHS.');
  assert.match(dec, /path: '\/schema-check',\s*\n\s*kind: 'internal'/,
    '🔴 no está declarada como `internal`: es una superficie pública sin clase declarada.');
});

test('SCRUM-687 · 🔴 el guard NO es el interno: los cobros no comparten llave con CI', () => {
  const app = fs.readFileSync(path.join(RAIZ, 'src/app.ts'), 'utf8');
  const linea = app.split('\n').find((l) => l.includes("app.post('/schema-check'"));
  assert.ok(linea, '🔴 CIEGO: no encuentro la línea de la ruta.');
  assert.equal(linea.includes('requireInternalSecret'), false,
    '🔴 el endpoint usa el secreto INTERNO, que abre `/charges` e `/invoice`. Este lo llama CI, y '
    + 'un secreto que pasa por los logs de un runner no puede ser el que abre los cobros.');
});

test('SCRUM-687 · 🔴 el CI lo LLAMA, y de forma informativa', () => {
  const ci = fs.readFileSync(path.join(RAIZ, '.github/workflows/ci.yml'), 'utf8');
  assert.match(ci, /node scripts\/constancia-del-alter\.mjs/,
    '🔴 el CI no llama a la constancia: existir no sirve de nada.');
  const i = ci.indexOf('constancia-del-alter:');
  assert.notEqual(i, -1, '🔴 CIEGO: no encuentro el job.');
  assert.match(ci.slice(i, i + 700), /continue-on-error:\s*true/,
    '🔴 el job BLOQUEA. Si está en rojo el arreglo llega aplicando el ALTER y luego mergeando: un '
    + 'check bloqueante le cierra la puerta al que viene a arreglarlo.');
});

test('SCRUM-687 · 🔴 NINGÚN secreto escrito: ni en el script, ni en el workflow, ni aquí', () => {
  const script = fs.readFileSync(path.join(RAIZ, 'scripts/constancia-del-alter.mjs'), 'utf8');
  const ci = fs.readFileSync(path.join(RAIZ, '.github/workflows/ci.yml'), 'utf8');
  const yo = fs.readFileSync(path.join(RAIZ, 'tests/scrum687-constancia-del-alter.test.mjs'), 'utf8');

  for (const [nombre, src] of [['el script', script], ['el workflow', ci], ['este test', yo]]) {
    // Una asignación con valor literal al secreto es lo que no puede existir en ninguna parte.
    assert.equal(/SCHEMA_CHECK_SECRET\s*[:=]\s*['"][^'"$]/.test(src), false,
      `🔴 hay un valor literal asignado a SCHEMA_CHECK_SECRET en ${nombre}. Ni siquiera de ejemplo: `
      + 'un secreto de ejemplo es el primer sitio donde alguien copia uno de verdad.');
  }
  // 🔴 CONTROL del detector — Y SE COMPONE, NO SE ESCRIBE. La primera versión de esta línea
  // llevaba la cadena prohibida LITERAL, y el detector se cazó a sí mismo: el fichero que
  // prohíbe escribir un secreto no puede escribir uno para demostrar que sabe verlos. Es la
  // lección de SCRUM-349, y aquí se pagó en el primer intento.
  const CEBO = 'SCHEMA_CHECK' + '_SECRET' + ": 'algo'";
  assert.equal(/SCHEMA_CHECK_SECRET\s*[:=]\s*['"][^'"$]/.test(CEBO), true,
    '🔴 el detector no reconoce una asignación literal: sus `false` no valdrían nada.');
});
