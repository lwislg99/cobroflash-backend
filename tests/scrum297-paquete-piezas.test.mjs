// tests/scrum297-paquete-piezas.test.mjs — SCRUM-297 (A7) · las piezas del paquete, sin base.
//
// ⚠️ CORRE SIEMPRE en `npm test`. La prueba de verdad —dos merchants contra Postgres— está
// gateada; si TODO lo de este ticket dependiera de tener una base, el CI no ejecutaría nada y
// una pieza podría desaparecer del ZIP sin que saltara nada.
//
// Aquí se comprueban tres cosas que no necesitan base:
//   ① el paquete lleva SUS CINCO PIEZAS y el manifiesto que las sella;
//   ② el estado del índice es el VALOR DEL VERIFICADOR, no prosa nuestra (regla 26);
//   ③ el módulo no escribe: no tiene con qué (regla 38, por AST).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const MODULO = 'src/modules/fiscal/evidencias/paquete.ts';

const { construirPaqueteEvidencias, FICHEROS } = await import('../dist/modules/fiscal/evidencias/paquete.js');

/** Un libro mínimo pero REAL en su forma: el paquete no debe saber que es de mentira. */
const asiento = (o = {}) => ({
  numero: '2026-CF-001', fecha: '2026-05-12T10:00:00.000Z', tipo: 'F1', clienteId: 3,
  base: 100, cuota: 21, porTipo: [{ tipo: 21, base: 100, cuota: 21 }], total: 121,
  moneda: 'EUR', estado: 'paid', importeIlegible: false,
  enlaces: { presupuestoId: 11, presupuestoFirmado: true, albaranes: [{ albaranId: 33, numero: 'ALB-1' }], albaranesNoSellados: 0, cobroId: 22 },
  ...o,
});
const libro = (o = {}) => ({ asientos: [asiento()], miradas: 1, ajenas: 0, sinNumero: 0, sinNumeroImporte: 0, importesIlegibles: [], ...o });
const m303 = (o = {}) => ({
  año: 2026, trimestre: 2, desde: '', hasta: '', moneda: 'EUR',
  casillas: [{ tipo: 4, casillaBase: 1, casillaTipo: 2, casillaCuota: 3, base: 0, cuota: 0 },
             { tipo: 10, casillaBase: 4, casillaTipo: 5, casillaCuota: 6, base: 0, cuota: 0 },
             { tipo: 21, casillaBase: 7, casillaTipo: 8, casillaCuota: 9, base: 100, cuota: 21 }],
  casillaTotalCuota: { casilla: 27, valor: 21 }, totalBase: 100,
  sinClasificar: [], sinDesglose: [], cruceConCobros: {}, miradas: 1, asientos: 1,
  motivosParaNoFiarse: [], avisoObligatorio: '', ...o,
});
const informe = (o = {}) => ({ examinados: 1, cuadran: 1, censoPorVersion: { 1: 1 }, hallazgos: [], versionesNoSoportadas: [], conclusion: 'todo_cuadra', ...o });
const albaran = (o = {}) => ({ albaranId: 33, numero: 'ALB-1', invoiceId: 7, resultado: { cuadra: true, numero: 'ALB-1', v: 1 }, lineas: [{ concepto: 'x', cantidad: 1, unidad: 'ud', quoteLineIndex: 0 }], ...o });

const construir = (o = {}) => construirPaqueteEvidencias({
  libro: libro(), modelo303: m303(), albaranes: [albaran()], informeVerificacion: informe(),
  merchantId: 7, periodo: { desde: '', hasta: '', año: 2026, trimestre: 2 }, ...o,
});

// ── ① LAS PIEZAS ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-297 · SUELO: el paquete produce ficheros con contenido', () => {
  const p = construir();
  assert.ok(p.ficheros.length >= 5,
    `🔴 el paquete solo trae ${p.ficheros.length} ficheros. Un ZIP vacío se entrega a un asesor o ` +
    'a una inspección y nadie pregunta por qué está vacío.');
  for (const f of p.ficheros) {
    assert.ok(f.contenido.length > 0, `🔴 «${f.nombre}» va vacío dentro del paquete.`);
  }
});

test('SCRUM-297 · el paquete lleva SUS CINCO PIEZAS, cada una nombrada', () => {
  // El censo sale de `FICHEROS`, la constante del propio módulo: si mañana se añade una pieza,
  // este test la exige sin tocarlo; si se quita, cae diciendo CUÁL.
  const presentes = new Set(construir().ficheros.map((f) => f.nombre));
  const faltan = Object.entries(FICHEROS).filter(([, nombre]) => !presentes.has(nombre)).map(([k, n]) => `${k} (${n})`);

  assert.deepEqual(faltan, [],
    `🔴 al paquete de evidencias le faltan piezas: ${faltan.join(', ')}.\n\n` +
    '  Cada una demuestra una cosa distinta: el índice dice el estado de un vistazo, el libro y el\n' +
    '  303 son lo declarado, la verificación es la prueba del sello, las entregas atan lo\n' +
    '  entregado a lo presupuestado y el manifiesto certifica que nada se ha tocado.\n' +
    '  Un paquete al que le falta una pieza se entrega como completo igualmente.');
});

test('SCRUM-297 · el manifiesto sella TODAS las demás piezas', () => {
  const p = construir();
  const m = JSON.parse(p.ficheros.find((f) => f.nombre === FICHEROS.manifiesto).contenido);
  const sellados = new Set(m.ficheros.map((f) => f.nombre));
  const sinSellar = p.ficheros.filter((f) => f.nombre !== FICHEROS.manifiesto && !sellados.has(f.nombre));
  assert.deepEqual(sinSellar.map((f) => f.nombre), [],
    '🔴 hay ficheros del paquete que el manifiesto no sella: nadie podría comprobar que no se han ' +
    'tocado desde que se generó.');
  assert.ok(m.ficheros.every((f) => /^[0-9a-f]{64}$/.test(f.sha256)),
    '🔴 algún sha256 del manifiesto no es un sha256.');
});

// ── ② EL ESTADO ES EL DEL VERIFICADOR, NO PROSA NUESTRA ──────────────────────────────────────

test('SCRUM-297 · el estado del índice sale del verificador, sin traducir (regla 26)', () => {
  // Los motivos son los del verificador; `cuadra` y `sin_albaranes` son los dos únicos valores
  // que añade el paquete, y los dos son hechos, no interpretaciones. Nada de «pendiente de»,
  // nada de calendarios, nada de la AEAT.
  // SCRUM-415 añadió `hash_de_otra_version`: el hash cuadra con la receta de OTRA versión, así
  // que el contenido está intacto y lo que falla es la versión declarada. Sale por separado de
  // `hash_no_coincide` a propósito —ese acusa de manipulación y este no—.
  const MOTIVOS = ['sin_evidencia', 'version_ausente', 'version_no_soportada', 'sin_hash',
                   'hash_no_coincide', 'hash_de_otra_version', 'error_al_recalcular'];
  const PERMITIDOS = new Set([...MOTIVOS, 'cuadra', 'sin_albaranes']);

  const casos = [
    construir(),
    construir({ albaranes: [albaran({ resultado: { cuadra: false, numero: 'ALB-1', v: 1, motivo: 'hash_no_coincide', mensaje: 'x' } })] }),
    construir({ albaranes: [albaran({ resultado: { cuadra: false, numero: 'ALB-1', v: null, motivo: 'sin_evidencia', mensaje: 'x' } })] }),
    construir({ albaranes: [] }),
  ];
  const vistos = new Set();
  for (const p of casos) for (const f of p.indice) { vistos.add(f.estadoSello); }

  assert.ok(vistos.size >= 3, `🔴 solo se han visto ${vistos.size} estados distintos: el test no cubre nada.`);
  const inventados = [...vistos].filter((v) => !PERMITIDOS.has(v));
  assert.deepEqual(inventados, [],
    `🔴 el índice inventa estados que el verificador no devuelve: ${inventados.join(', ')}.\n\n` +
    '  El estado es el VALOR DERIVADO que ya devuelve el verificador. Traducirlo a prosa nuestra\n' +
    '  es escribir un claim fiscal sin aprobar (reglas 26 y 30).');
});

test('SCRUM-297 · un sello que no cuadra NO se corrige ni se oculta: sale en el índice', () => {
  const p = construir({
    albaranes: [albaran({ resultado: { cuadra: false, numero: 'ALB-1', v: 1, motivo: 'hash_no_coincide', mensaje: 'x' } })],
    informeVerificacion: informe({ cuadran: 0, hallazgos: [{ cuadra: false, numero: 'ALB-1', v: 1, motivo: 'hash_no_coincide', mensaje: 'x' }], conclusion: 'hay_hallazgos' }),
  });
  assert.equal(p.indice.length, 1, '🔴 el asiento del albarán que no cuadra ha desaparecido del índice.');
  assert.equal(p.indice[0].estadoSello, 'hash_no_coincide');
  assert.ok(p.avisos.some((a) => /sin cuadrar/.test(a)),
    '🔴 el paquete no avisa de los sellos que no cuadran. Quien lo entrega creería que entrega ' +
    'todo en orden — y eso es peor que no tener el paquete.');
});

test('SCRUM-297 · el suelo del verificador viaja: «no se pudo mirar» no es «todo cuadra»', () => {
  const p = construir({ albaranes: [], informeVerificacion: informe({ examinados: 0, cuadran: 0, censoPorVersion: {}, conclusion: 'no_se_pudo_mirar' }) });
  assert.ok(p.avisos.some((a) => /no se examinó ningún albarán/.test(a)),
    '🔴 con cero albaranes examinados el paquete no lo dice. «Cero manipulados» y «no supe mirar» ' +
    'son el mismo número con significados opuestos.');
});

test('SCRUM-297 · un importe ilegible NO se imprime como 0,00', () => {
  const p = construir({ libro: libro({ asientos: [asiento({ total: null, importeIlegible: true })], importesIlegibles: ['2026-CF-001'] }) });
  assert.equal(p.indice[0].total, '',
    '🔴 un importe que no se pudo leer sale como cero en el paquete: eso AFIRMA que esa factura ' +
    'no cobró nada (familia SCRUM-271).');
  assert.ok(p.avisos.some((a) => /ilegibles/.test(a)));
});

// ── ③ REGLA 38 · el módulo no escribe porque no tiene con qué ─────────────────────────────────

test('SCRUM-297 · el paquete es LECTURA: ni prisma, ni escrituras, ni camino de emisión', () => {
  const ruta = path.join(RAIZ, MODULO);
  assert.ok(fs.existsSync(ruta), `🔴 no existe ${MODULO}: el guard no puede mirar, así que FALLA.`);
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const PROHIBIDAS = ['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany',
    '$executeRaw', '$executeRawUnsafe', 'allocateInvoiceNumber', 'computeAlbaranContentHash'];
  // ⚠️ EL GUARD SE CAZÓ A SÍ MISMO EN EL PRIMER INTENTO: `crypto.createHash(...).update(...)` no
  // es una escritura en la base, y la lista de métodos prohibidos lo marcaba igual. Un guard con
  // un falso positivo se «arregla» quitando el método de la lista, y ahí es donde deja de vigilar
  // lo que vino a vigilar. Se mira la RAÍZ de la cadena: lo de `crypto` y compañía no es la base.
  const RAICES_INOCENTES = new Set(['crypto', 'JSON', 'Math', 'Object', 'Array', 'String', 'Number', 'Buffer', 'params']);
  const raizDe = (expr) => {
    let e = expr;
    while (ts.isPropertyAccessExpression(e) || ts.isCallExpression(e)) e = ts.isCallExpression(e) ? e.expression : e.expression;
    return ts.isIdentifier(e) ? e.text : null;
  };

  const encontradas = [];
  const importados = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const m = n.expression.name.text;
      const raiz = raizDe(n.expression.expression);
      if (PROHIBIDAS.includes(m) && !RAICES_INOCENTES.has(raiz ?? '')) encontradas.push(`${raiz}.${m}`);
    }
    if (ts.isImportDeclaration(n)) importados.push(n.moduleSpecifier.getText().replace(/['"]/g, ''));
    ts.forEachChild(n, visitar);
  };
  visitar(sf);

  assert.deepEqual(encontradas, [],
    `🔴 el paquete escribe o recalcula: ${encontradas.join(', ')}.\n\n` +
    '  Si el verificador dice que un sobre no cuadra, el ZIP lo DECLARA — no lo corrige. Un sobre\n' +
    '  reescrito deja de ser prueba de nada, y el arreglo destruiría el dato que documenta el\n' +
    '  incidente. Y recalcular el hash aquí sería una SEGUNDA receta: la que acusa de manipulados\n' +
    '  a documentos intactos.');
  assert.ok(!importados.some((i) => /prisma|db\//.test(i)),
    `🔴 el paquete importa la base (${importados.join(', ')}). No es una promesa de no escribir: ` +
    'es que no tiene con qué, y así se queda.');
});
