// tests/scrum964-la-lista-no-carga-las-fotos.test.mjs — SCRUM-964
//
// LA VÍCTIMA: el profesional en la furgoneta abre Gastos con datos móviles y el servidor le manda
// las FOTOS de todos los gastos del mes para pintar una tabla que no enseña ninguna.
//
// Medido ANTES de escribir una línea, con la sonda de solo lectura que ya existía
// (`docs/prototipos/SCRUM-920/sonda-peso-lista-gastos.mjs`), sobre la ruta y el servicio REALES:
//
//      20 gastos × foto 1,50 MiB  ->  respuesta  30,00 MiB
//      60 gastos × foto 1,50 MiB  ->  respuesta  90,01 MiB
//     200 gastos × foto 1,50 MiB  ->  respuesta 300,03 MiB      (el `take` de la lista es 200)
//     findMany con select?: NO (include sin select: trae TODAS las columnas, receipt_data incluida)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 POR QUÉ ESTE DOBLE OBEDECE AL `select`, Y POR QUÉ ESO ES EL TEST
//
// Un doble que devuelve las filas tal cual —el de la sonda— mide el peso de la RESPUESTA, pero es
// CIEGO al arreglo: con `select` o sin él contestaría lo mismo, porque la criba la hace la base,
// no el servicio. Un test así saldría verde sin que nada hubiera cambiado.
//
// Así que aquí el doble hace lo que hace una base: aplica el `select` que se le pide. Con eso, el
// peso de la respuesta vuelve a medir el MECANISMO — quitar el `select` del servicio devuelve las
// filas enteras y la respuesta se dispara a 30 MiB. Es el rojo de este fichero.
//
// Y el suelo que lo sostiene (test 1): se comprueba que el doble NO criba por su cuenta — con un
// `select` que SÍ pide `receiptData`, la foto vuelve. Sin ese control, un doble que borrara la
// columna siempre daría el mismo verde midiendo su propia mano.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
// SCRUM-694 · el fuente SIN comentarios: un guard que prohíbe un patrón por texto se caza a sí
// mismo en el comentario que lo explica, y este fichero explica justo lo que prohíbe.
import { soloCodigo } from './_solo-codigo.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const RUTAS_GASTOS = '../dist/modules/expenses/app/routes/expenses.routes.js';
const RUTAS_JOBS   = '../dist/modules/jobs/app/routes/jobs.routes.js';
const SERVICIO     = '../dist/modules/expenses/domain/expenses.service.js';

const KIB = 1024;
const MIB = 1024 * 1024;

/** `data:image/jpeg;base64,AAAA…` del tamaño pedido, con caracteres base64 de verdad. */
const fotoDe = (bytes) => 'data:image/jpeg;base64,' + 'A'.repeat(bytes - 'data:image/jpeg;base64,'.length);

/** Una fila COMPLETA de `Expense`, con todas sus columnas, como la devolvería la base. */
function filaDeGasto(i, { foto = null, quoteId = null } = {}) {
  return {
    id: i, merchantId: MERCHANT, quoteId, providerId: null,
    concept: 'Codo de 12', amount: '12.10', currency: 'EUR', category: 'materiales',
    date: new Date('2026-09-10T08:00:00Z'), notes: null, receiptData: foto,
    baseAmount: null, vatRate: null, vatAmount: null, vatDeducible: null,
    providerInvoiceNumber: null, providerInvoiceDate: null, teamMemberId: null,
    createdAt: new Date('2026-09-10T08:00:00Z'), updatedAt: new Date('2026-09-10T08:00:00Z'),
    quote: null, provider: null,
  };
}

/** Lo que hace una base: devolver EXACTAMENTE las claves que el `select` pide. */
function aplicarSelect(fila, select) {
  if (!select) return { ...fila };
  const salida = {};
  for (const [clave, valor] of Object.entries(select)) {
    if (!valor) continue;
    salida[clave] = fila[clave] ?? null;
  }
  return salida;
}

/**
 * Monta el camino real de `GET /admin/expenses` con la base doblada.
 * Devuelve el cuerpo serializado, el objeto, y TODAS las llamadas a `expense.findMany`.
 */
function bancoDeLaLista(filas) {
  const llamadas = [];
  inyectarBase({
    'expense.findMany': (args) => {
      llamadas.push(args);
      const candidatas = filas.filter((f) => {
        if (args?.where?.id?.in && !args.where.id.in.includes(f.id)) return false;
        // `receiptData: { not: null }` — la consulta de `tieneFoto`.
        if (args?.where?.receiptData?.not === null && f.receiptData == null) return false;
        return true;
      });
      return candidatas.map((f) => aplicarSelect(f, args?.select));
    },
  }, [SERVICIO, RUTAS_GASTOS]);
  const router = moduloDeDist(RUTAS_GASTOS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/' && l.route.methods.get);
  assert.ok(capa, 'CIEGO: no se encuentra `GET /admin/expenses` en el router. Si se movió, hay que reapuntar el test, no borrarlo.');
  const manejador = capa.route.stack[capa.route.stack.length - 1].handle;
  return {
    llamadas,
    async pedir(query = { month: '2026-09' }) {
      let cuerpo = '', objeto = null, estado = 200;
      const res = {
        status(c) { estado = c; return res; },
        json(j) { objeto = j; cuerpo = JSON.stringify(j); return res; },
      };
      await manejador({ query, merchantId: MERCHANT, userRole: 'admin' }, res);
      return { cuerpo, objeto, estado, bytes: Buffer.byteLength(cuerpo) };
    },
  };
}

// ── 1 · EL SUELO DEL INSTRUMENTO ────────────────────────────────────────────────────────────
test('SCRUM-964 · 🔴 SUELO: el doble OBEDECE al select y no criba por su cuenta', () => {
  const fila = filaDeGasto(1, { foto: fotoDe(64 * KIB) });
  const conFoto = aplicarSelect(fila, { id: true, receiptData: true });
  assert.equal(conFoto.receiptData, fila.receiptData,
    'El doble borra la foto por su cuenta: entonces el verde de este fichero mide su propia mano, no el arreglo.');
  const sinFoto = aplicarSelect(fila, { id: true, concept: true });
  assert.equal('receiptData' in sinFoto, false);
  assert.equal(sinFoto.concept, 'Codo de 12');
  // Y sin `select` devuelve la fila entera — que es lo que hacía `include`.
  assert.equal(aplicarSelect(fila, undefined).receiptData, fila.receiptData);
});

// ── 2 · EL DEFECTO, MEDIDO EN BYTES ─────────────────────────────────────────────────────────
test('SCRUM-964 · 🔴 EL DEFECTO: 200 gastos con foto de 1,5 MiB ya no pesan 300 MiB', async () => {
  const filas = Array.from({ length: 200 }, (_, i) => filaDeGasto(i + 1, { foto: fotoDe(1.5 * MIB) }));
  const banco = bancoDeLaLista(filas);
  const { objeto, bytes } = await banco.pedir();

  assert.equal(objeto.items.length, 200);
  // La sonda midió 300,03 MiB por esta misma petición. El tope es holgado a propósito: lo que se
  // afirma es el ORDEN DE MAGNITUD (KiB, no MiB), no un número de bytes que cambie con el copy.
  assert.ok(bytes < 200 * KIB,
    `la respuesta pesa ${(bytes / MIB).toFixed(2)} MiB: las fotos siguen viajando en la lista`);
  // Y ni un solo item lleva la columna.
  for (const it of objeto.items) {
    assert.equal('receiptData' in it, false, `el gasto ${it.id} sigue llevando la foto dentro`);
  }
});

// ── 3 · EL CONTRATO CON LA BASE ─────────────────────────────────────────────────────────────
test('SCRUM-964 · la lista pide `select` (no `include`) y `receiptData` NO está en él', async () => {
  const banco = bancoDeLaLista([filaDeGasto(1, { foto: fotoDe(32 * KIB) })]);
  await banco.pedir();

  const deLaLista = banco.llamadas[0];
  assert.ok(deLaLista.select, 'la consulta de la lista sigue sin `select`: trae todas las columnas');
  assert.equal('include' in deLaLista, false, '`include` sin `select` trae TODAS las columnas, foto incluida');
  assert.equal('receiptData' in deLaLista.select, false, '`receiptData` está en el select de la lista');
  assert.equal(deLaLista.take, 200, 'el tope de página no es el que fijó la lista');
  assert.equal(deLaLista.where.merchantId, MERCHANT, 'la lista no filtra por merchant (regla 2)');
});

// ── 4 · EL GUARD DE LA COLUMNA NUEVA ────────────────────────────────────────────────────────
//
// Un `select` explícito es una lista CERRADA: la columna que alguien añada mañana a `Expense`
// desaparece de la API sin que nada falle. Esto lo convierte en rojo.
const TIPOS_ESCALARES = new Set(['Int', 'String', 'Decimal', 'DateTime', 'Boolean', 'Float', 'Json', 'BigInt', 'Bytes']);

/** Los escalares de un modelo de `prisma/schema.prisma`, leídos del fichero. */
function escalaresDelModelo(nombre) {
  const texto = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');
  const ini = texto.indexOf(`model ${nombre} {`);
  assert.notEqual(ini, -1, `CIEGO: no se encuentra \`model ${nombre}\` en prisma/schema.prisma`);
  const fin = texto.indexOf('\n}', ini);
  assert.notEqual(fin, -1, `CIEGO: \`model ${nombre}\` no cierra`);
  const campos = [];
  const desconocidos = [];
  for (const cruda of texto.slice(ini, fin).split('\n').slice(1)) {
    const linea = cruda.split('//')[0].trim();
    if (!linea || linea.startsWith('@@')) continue;
    const m = /^(\w+)\s+(\w+)(\??)/.exec(linea);
    if (!m) continue;
    const [, campo, tipo] = m;
    if (TIPOS_ESCALARES.has(tipo)) campos.push(campo);
    else if (/^[A-Z]/.test(tipo)) continue;          // relación a otro modelo: no es columna
    else desconocidos.push(`${campo} ${tipo}`);
  }
  // Un guard que no sabe leer TIENE QUE DECIRLO, no dar un verde vacío (SCRUM-413).
  assert.deepEqual(desconocidos, [], `CIEGO: tipos que el lector no sabe clasificar: ${desconocidos.join(', ')}`);
  return campos;
}

test('SCRUM-964 · 🔴 SUELO: el lector del esquema encuentra columnas de verdad', () => {
  const campos = escalaresDelModelo('Expense');
  assert.ok(campos.length >= 18, `el lector solo ve ${campos.length} columnas de Expense: no está leyendo`);
  for (const esperado of ['id', 'merchantId', 'concept', 'amount', 'receiptData', 'updatedAt']) {
    assert.ok(campos.includes(esperado), `el lector no ve la columna \`${esperado}\``);
  }
  // CONTROL NEGATIVO: las relaciones NO son columnas.
  for (const relacion of ['merchant', 'quote', 'provider']) {
    assert.equal(campos.includes(relacion), false, `\`${relacion}\` es una relación, no una columna`);
  }
});

test('SCRUM-964 · 🔴 el select de la lista es EXACTAMENTE Expense menos `receiptData`', async () => {
  // Se mide en los ARGUMENTOS que salen hacia la base, no en una constante exportada para poder
  // verla: un export que solo existe para el test es código que el test se inventó (y el censo de
  // SCRUM-411 lo caza). Esto es lo que la base recibe de verdad.
  const banco = bancoDeLaLista([filaDeGasto(1)]);
  await banco.pedir();
  const { select } = banco.llamadas[0];

  // `quote` y `provider` son relaciones, no columnas: se piden con su propio select anidado.
  const columnas = Object.keys(select).filter((k) => typeof select[k] !== 'object').sort();
  const deberian = escalaresDelModelo('Expense').filter((c) => c !== 'receiptData').sort();
  assert.deepEqual(columnas, deberian,
    'El select de la lista y las columnas de `Expense` ya no cuadran. Si es una columna NUEVA: se '
    + 'decide si la lista la devuelve y se añade a `CAMPOS_DE_LA_LISTA`. Lo que no puede pasar es '
    + 'que desaparezca de la API en silencio, que es el defecto que este guard existe para impedir.');
  assert.deepEqual(Object.keys(select).filter((k) => typeof select[k] === 'object').sort(), ['provider', 'quote']);
});

// ── 5 · `tieneFoto` ─────────────────────────────────────────────────────────────────────────
test('SCRUM-964 · `tieneFoto` es true SOLO para los gastos que tienen foto', async () => {
  const filas = [
    filaDeGasto(1, { foto: fotoDe(32 * KIB) }),
    filaDeGasto(2),
    filaDeGasto(3, { foto: fotoDe(64 * KIB) }),
    filaDeGasto(4),
  ];
  const banco = bancoDeLaLista(filas);
  const { objeto } = await banco.pedir();

  assert.deepEqual(objeto.items.map((i) => [i.id, i.tieneFoto]), [[1, true], [2, false], [3, true], [4, false]]);
});

test('SCRUM-964 · la consulta de `tieneFoto` solo pide ids, acotada a la página y al merchant', async () => {
  const filas = [filaDeGasto(1, { foto: fotoDe(32 * KIB) }), filaDeGasto(2)];
  const banco = bancoDeLaLista(filas);
  await banco.pedir();

  const deLaFoto = banco.llamadas.find((a) => a?.where?.receiptData?.not === null);
  assert.ok(deLaFoto, 'no se pregunta quién tiene foto: `tieneFoto` saldría de la columna, que es lo que se quitó');
  assert.deepEqual(Object.keys(deLaFoto.select), ['id'], 'la consulta de `tieneFoto` pide más que el id');
  assert.equal(deLaFoto.where.merchantId, MERCHANT, 'la consulta de `tieneFoto` no filtra por merchant (regla 2)');
  assert.deepEqual(deLaFoto.where.id.in, [1, 2], 'la consulta de `tieneFoto` no está acotada a los gastos de esta página');
});

// ── 6 · EL COSTE ────────────────────────────────────────────────────────────────────────────
test('SCRUM-964 · NEGATIVO: coste CONSTANTE — una consulta más por página, no una por gasto', async () => {
  const pocos = bancoDeLaLista(Array.from({ length: 2 }, (_, i) => filaDeGasto(i + 1, { foto: fotoDe(8 * KIB) })));
  await pocos.pedir();
  const muchos = bancoDeLaLista(Array.from({ length: 200 }, (_, i) => filaDeGasto(i + 1, { foto: fotoDe(8 * KIB) })));
  await muchos.pedir();

  assert.equal(pocos.llamadas.length, 2, 'la lista sin trabajos hace la suya y la de `tieneFoto`, y nada más');
  assert.equal(muchos.llamadas.length, pocos.llamadas.length,
    `con 200 gastos hace ${muchos.llamadas.length} consultas y con 2 hace ${pocos.llamadas.length}: el coste creció con los gastos (SCRUM-135)`);
});

// ── 7 · LA OTRA PUERTA ──────────────────────────────────────────────────────────────────────
//
// `GET /admin/jobs/:id/gastos` llama al MISMO `listExpenses`, así que servía las fotos igual — y
// ésa no es admin-only: la abre el técnico desde la obra. Se mide, no se deduce.
test('SCRUM-964 · 🔴 la OTRA puerta: los gastos del Trabajo tampoco llevan la foto', async () => {
  const filas = Array.from({ length: 20 }, (_, i) => filaDeGasto(i + 1, { foto: fotoDe(1.5 * MIB), quoteId: 77 }));
  inyectarBase({
    'expense.findMany': (args) => filas
      .filter((f) => !(args?.where?.receiptData?.not === null && f.receiptData == null))
      .filter((f) => !args?.where?.id?.in || args.where.id.in.includes(f.id))
      .map((f) => aplicarSelect(f, args?.select)),
    'job.findFirst': () => ({ id: 9, merchantId: MERCHANT, quoteId: 77, operarioId: null }),
  }, [SERVICIO, RUTAS_JOBS]);

  const router = moduloDeDist(RUTAS_JOBS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id/gastos' && l.route.methods.get);
  assert.ok(capa, 'CIEGO: no se encuentra `GET /admin/jobs/:id/gastos`. Si se movió, hay que reapuntar el test.');
  const manejador = capa.route.stack[capa.route.stack.length - 1].handle;

  let cuerpo = '';
  const res = { status() { return res; }, json(j) { cuerpo = JSON.stringify(j); return res; } };
  await manejador({ params: { id: '9' }, merchantId: MERCHANT, userRole: 'admin' }, res);

  const bytes = Buffer.byteLength(cuerpo);
  assert.ok(bytes < 100 * KIB, `los gastos del Trabajo pesan ${(bytes / MIB).toFixed(2)} MiB: siguen llevando las fotos`);
  const { gastos } = JSON.parse(cuerpo);
  assert.equal(gastos.length, 20);
  for (const g of gastos) assert.equal('receiptData' in g, false);
  assert.equal(gastos[0].tieneFoto, true, 'y sigue diciendo que hay foto');
});

// ── 8 · LA RUTA DE LA FOTO ──────────────────────────────────────────────────────────────────
function bancoDeLaFoto(respuestas) {
  inyectarBase(respuestas, [SERVICIO, RUTAS_GASTOS]);
  const router = moduloDeDist(RUTAS_GASTOS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id/foto' && l.route.methods.get);
  assert.ok(capa, 'CIEGO: no existe `GET /admin/expenses/:id/foto`. Es la ruta por la que la foto vuelve.');
  const manejador = capa.route.stack[capa.route.stack.length - 1].handle;
  return async (id) => {
    let estado = 200, cuerpo = null, json = null;
    const cabeceras = {};
    const res = {
      status(c) { estado = c; return res; },
      setHeader(k, v) { cabeceras[k] = v; return res; },
      json(j) { json = j; return res; },
      end(b) { cuerpo = b; return res; },
    };
    await manejador({ params: { id: String(id) }, merchantId: MERCHANT, userRole: 'admin' }, res);
    return { estado, cuerpo, json, cabeceras };
  };
}

test('SCRUM-964 · 🔴 la foto se sirve por su ruta, en BINARIO y con su tipo', async () => {
  const original = fotoDe(64 * KIB);
  const pedir = bancoDeLaFoto({ 'expense.findFirst': () => ({ receiptData: original }) });
  const { estado, cuerpo, cabeceras } = await pedir(5);

  assert.equal(estado, 200);
  assert.ok(Buffer.isBuffer(cuerpo), 'la foto no sale en binario: dentro de un JSON vuelve a ir en base64');
  assert.equal(cabeceras['Content-Type'], 'image/jpeg');
  assert.equal(cabeceras['Content-Length'], String(cuerpo.length));
  assert.equal(cabeceras['X-Content-Type-Options'], 'nosniff');
  assert.equal(cabeceras['Cache-Control'], 'no-store',
    'con caché, editar la foto del gasto deja al profesional viendo la anterior');
  // Y son LOS MISMOS bytes que había guardados, no otros.
  const guardados = Buffer.from(original.slice(original.indexOf(';base64,') + ';base64,'.length), 'base64');
  assert.ok(cuerpo.equals(guardados), 'los bytes servidos no son los guardados');
  // Menos bulto que el data-URI: es el 75 % de la cadena, sin el escapado del JSON.
  assert.ok(cuerpo.length < Buffer.byteLength(original));
});

test('SCRUM-964 · la ruta de la foto filtra por merchant: el gasto de otro negocio da 404', async () => {
  let where = null;
  const pedir = bancoDeLaFoto({
    'expense.findFirst': (args) => { where = args.where; return null; },   // otro merchant: no lo encuentra
  });
  const { estado, json } = await pedir(5);

  assert.equal(estado, 404);
  assert.deepEqual(json, { ok: false, error: 'not_found' });
  assert.equal(where.merchantId, MERCHANT, 'la ruta de la foto no filtra por merchant (regla 2)');
  assert.equal(where.id, 5);
});

// ── 9 · LA OTRA MITAD: LA PANTALLA ──────────────────────────────────────────────────────────
//
// 🔴 EL PELIGRO QUE OBLIGA A ENTREGAR LAS DOS MITADES JUNTAS, y no es la vista previa:
//
// El modal de edición hacía `let receiptData = expense?.receiptData || null` y METÍA esa clave en
// el `PUT`. En cuanto la lista deja de traer la foto, ese atajo manda **`receiptData: null`** y el
// servidor lo entiende como «bórrala» (SCRUM-324: `null` es borrar, `undefined` es no tocar). O
// sea que, con solo la mitad del servidor desplegada, **editar el importe de un gasto le BORRA al
// profesional la foto de su justificante**. Por eso la pantalla va en el mismo PR.
//
// Se mide leyendo el fuente de la vista SIN COMENTARIOS. No es un banco de navegador a propósito:
// el cambio son seis líneas, sin delta visual, y montar el DOM para esto costaría más de lo que
// mide (rigor proporcional, norma del 20-sep).
const VISTA = path.join(RAIZ, 'public/dashboard/js/expensesView.js');
const codigoDeLaVista = () => soloCodigo(fs.readFileSync(VISTA, 'utf8'), 'expensesView.js');

test('SCRUM-964 · 🔴 SUELO: el detector VE los patrones cuando están (si no, las negaciones son un verde hueco)', () => {
  const comoEstaba = [
    "let receiptData = expense?.receiptData || null;",
    "${expense?.receiptData ? `<img src=\"${expense.receiptData}\" />` : ''}",
  ].join('\n');
  const codigo = soloCodigo(comoEstaba, 'x.js');
  assert.match(codigo, /expense\??\.receiptData/, '🔴 el detector no ve `expense.receiptData` ni cuando está.');
  // Y el mismo patrón DENTRO de un comentario NO cuenta: es la trampa de la auto-referencia.
  assert.doesNotMatch(soloCodigo('// expense.receiptData\nconst a = 1;', 'x.js'), /expense\??\.receiptData/);
});

test('SCRUM-964 · 🔴 la pantalla ya no lee la foto de la fila: ni para pintarla ni para reenviarla', () => {
  const codigo = codigoDeLaVista();
  assert.doesNotMatch(codigo, /expense\??\.receiptData/,
    '🔴 la vista sigue leyendo `expense.receiptData` de la fila de la lista. Desde SCRUM-964 esa '
    + 'clave NO viene, así que eso es `null`: al pintar no se ve la foto, y al GUARDAR el PUT la '
    + 'BORRA. Si hace falta la foto, se pide por `GET /admin/expenses/:id/foto`.');
  assert.match(codigo, /tieneFoto/, '🔴 la vista no usa `tieneFoto`: entonces no sabe si hay foto que ofrecer.');
});

test('SCRUM-964 · la URL que pide la pantalla es la ruta que el servidor monta', () => {
  const codigo = codigoDeLaVista();
  const m = /\/admin\/expenses\/\$\{([^}]+)\}\/foto/.exec(codigo);
  assert.ok(m, '🔴 la vista no pide la foto por `/admin/expenses/<id>/foto`.');
  assert.match(m[1], /\bid\b/, `la vista pide la foto con \`${m[1]}\`, que no es el id del gasto`);

  // Las dos mitades de la dirección, cada una leída de su sitio: el montaje y la ruta del router.
  const app = fs.readFileSync(path.join(RAIZ, 'src/app.ts'), 'utf8');
  assert.match(app, /mountAdmin\(app,\s*'\/admin\/expenses'/,
    '🔴 el router de gastos ya no se monta en `/admin/expenses`: la URL de la vista apunta a otro sitio.');
  const router = moduloDeDist(RUTAS_GASTOS).default;
  assert.ok(router.stack.some((l) => l.route && l.route.path === '/:id/foto' && l.route.methods.get),
    '🔴 el router no declara `GET /:id/foto`. La vista pediría una foto a una ruta que no existe.');
});

test('SCRUM-964 · sin foto → 404 · id inválido → 400 · contenido que no es imagen → 415', async () => {
  const sinFoto = await bancoDeLaFoto({ 'expense.findFirst': () => ({ receiptData: null }) })(5);
  assert.equal(sinFoto.estado, 404);

  const idMalo = await bancoDeLaFoto({ 'expense.findFirst': () => ({ receiptData: fotoDe(1024) }) })('pepe');
  assert.equal(idMalo.estado, 400);
  assert.deepEqual(idMalo.json, { ok: false, error: 'invalid_id' });

  // Una fila con contenido que no es un data-URI de imagen admitida. `tieneFoto` dijo la verdad
  // (la columna no es null), y aun así no hay nada que servir: CÓDIGO PROPIO, no un 404.
  const ilegible = await bancoDeLaFoto({ 'expense.findFirst': () => ({ receiptData: 'no soy una foto' }) })(5);
  assert.equal(ilegible.estado, 415);
  assert.deepEqual(ilegible.json, { ok: false, error: 'foto_no_legible' });
});
