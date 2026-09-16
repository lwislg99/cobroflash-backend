// SCRUM-244 · LA PUERTA DE PORTABILIDAD: que exista, que registre, y que NO sea la de supresión.
//
// Sin gate: AST sobre el router y un doble para el serializador. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE MÁS IMPORTA VIGILAR AQUÍ NO ES QUE LA RUTA FUNCIONE
//
// Es que **no se convierta en la otra**. Portabilidad (art. 15/20) y supresión (art. 17) son dos
// derechos distintos que comparten ticket, y solo uno destruye el `AuditLog` fiscal. La
// portabilidad SOLO LEE. El día que alguien «complete» esta ruta añadiéndole el borrado, el
// dictamen que lo bloquea se habrá saltado sin que nadie lo decida — y el diff se leería como
// una mejora.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTAS = path.join(RAIZ, 'src', 'modules', 'exports', 'app', 'routes', 'exports.routes.ts');
const FUENTE = fs.readFileSync(RUTAS, 'utf8');
const ARBOL = ts.createSourceFile(RUTAS, FUENTE, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const { datasetACsv, LEEME, camposDe } =
  await import('../dist/modules/exports/domain/portabilidadCompleta.js');

/** El nodo del handler de una ruta, por su path. AST y no `grep`: un comentario no es un nodo. */
function handlerDe(rutaPath) {
  let encontrado = null;
  const visitar = (n) => {
    if (ts.isCallExpression(n)
      && ts.isPropertyAccessExpression(n.expression)
      && /^(get|post|put|delete)$/.test(n.expression.name.text)
      && n.arguments.length
      && ts.isStringLiteral(n.arguments[0])
      && n.arguments[0].text === rutaPath) {
      encontrado = n;
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(ARBOL, visitar);
  return encontrado;
}

test('SCRUM-244 · SUELO: la puerta existe y el extractor la encuentra', () => {
  const nodo = handlerDe('/portabilidad.zip');
  assert.ok(
    nodo,
    '🔴 ESCÁNER CIEGO: no encuentro `router.get("/portabilidad.zip", …)` en exports.routes.ts. ' +
      'Si la ruta se renombró, los tests de abajo pasarían sin comprobar nada.',
  );
  // Y una que SÍ existe, para saber que el extractor no dice que sí a todo.
  assert.ok(handlerDe('/datos.zip'), '🔴 ESCÁNER CIEGO: tampoco encuentra la ruta que ya existía');
  assert.equal(handlerDe('/no-existe-esta-ruta'), null, '🔴 el extractor encuentra rutas inventadas');
});

test('SCRUM-244 · la puerta REGISTRA el derecho ejercido, y antes del primer byte', () => {
  const texto = handlerDe('/portabilidad.zip').getText(ARBOL);
  for (const fn of ['registrarSolicitud', 'registrarAtencion']) {
    assert.ok(
      texto.includes(fn),
      `🔴 la puerta no llama a \`${fn}\`. Sin registro no se puede DEMOSTRAR que se atendió, que es ` +
        'justo lo que hace incumplir el plazo de un mes del art. 12.3 — y es la pieza que este ' +
        'ticket construyó para eso.',
    );
  }
  const posRegistro = texto.indexOf('registrarAtencion');
  const posBytes = texto.indexOf('archive.pipe');
  assert.ok(
    posRegistro < posBytes,
    '🔴 el registro se escribe DESPUÉS de empezar a enviar bytes. Mismo criterio que ' +
      '`exportacion_fiscal` (SCRUM-221): registrar de más es infinitamente menos grave que ' +
      'registrar de menos, y una descarga que se corta no puede dejar el derecho sin constancia.',
  );
});

test('SCRUM-244 · 🔴 la puerta de PORTABILIDAD no borra nada: no es la de supresión', () => {
  const texto = handlerDe('/portabilidad.zip').getText(ARBOL);
  const prohibidos = ['borrarMerchant', 'deleteMany', 'delete(', '.delete '];
  const encontrados = prohibidos.filter((p) => texto.includes(p));

  assert.deepEqual(
    encontrados, [],
    '🔴 LA PUERTA DE PORTABILIDAD CONTIENE UNA OPERACIÓN DE BORRADO:\n' +
      encontrados.map((e) => `    ${e}`).join('\n') +
      '\n\n  Portabilidad (art. 15/20) y supresión (art. 17) son derechos DISTINTOS, y solo el\n' +
      '  segundo destruye el `AuditLog` fiscal. La supresión está BLOQUEADA por dictamen: hoy\n' +
      '  ejecutarla borraría el rastro que protege al fundador como productor del SIF.\n' +
      '  Completar esta ruta con el borrado se leería en el diff como una mejora, y sería\n' +
      '  saltarse el dictamen sin que nadie lo decidiera.',
  );
});

test('SCRUM-244 · la puerta NO relaja el rol: hereda el gate del montaje', () => {
  const app = fs.readFileSync(path.join(RAIZ, 'src', 'app.ts'), 'utf8');
  assert.match(
    app, /mountAdmin\(app, '\/admin\/exports',\s*requireRole\('admin'\), exportsRouter\)/,
    '🔴 el router de exports ha dejado de montarse con `requireRole(\'admin\')`.\n\n' +
      '  Decisión del fundador con su motivo: el titular del derecho sobre los datos del NEGOCIO\n' +
      '  es el negocio, no cada miembro del equipo. Un técnico tiene derecho sobre SUS datos\n' +
      '  personales, que es otra cosa y mucho más pequeña. Relajar un `requireRole` para resolver\n' +
      '  un caso que no es el que parece es cómo se abren los agujeros.',
  );
  const texto = handlerDe('/portabilidad.zip').getText(ARBOL);
  assert.ok(
    !/requireRole\(\s*'(tecnico|technician)'/.test(texto),
    '🔴 la puerta declara un rol más laxo que el del montaje',
  );
});

test('SCRUM-244 · el aviso del art. 15 viaja, y ahora con su texto APROBADO (regla 30)', () => {
  // 17-ago-2026 · APROBADO. Protegía que la pieza existiera VACÍA y marcada en vez de con un texto
  // inventado que pareciera aprobado — y eso sigue protegido, solo que ahora contra el texto real:
  // el guard exige que el aviso ESTÉ y que apunte a la política de privacidad, que es la decisión
  // del fundador (no se copia el art. 15 aquí: serían dos fuentes del mismo hecho legal).
  assert.ok(LEEME.includes('yaqu.app/privacidad'),
    '🔴 el LEEME ha dejado de apuntar a la política de privacidad. Ahí es donde vive el aviso del ' +
    'art. 15; si se copia aquí, hay DOS fuentes y el día que una cambie la otra miente.');
  assert.ok(!LEEME.includes('[PENDIENTE'),
    '🔴 ha vuelto el marcador al LEEME: o hay texto nuevo sin aprobar, o se ha revertido.');
  const texto = handlerDe('/portabilidad.zip').getText(ARBOL);
  assert.ok(texto.includes('LEEME'), '🔴 el paquete no incluye el aviso del art. 15');
});

test('SCRUM-244 · el CSV no pierde información: fechas en ISO y JSON serializado', () => {
  const fecha = new Date('2026-08-04T09:00:00.000Z');
  const csv = datasetACsv(
    { modelo: 'X', fichero: 'csv/x.csv', filas: [{ a: 1, b: null, c: fecha, d: { k: 'v' } }] },
    ['a', 'b', 'c', 'd'],
  );
  assert.ok(csv.includes('2026-08-04T09:00:00.000Z'), '🔴 una fecha no sale en ISO');
  assert.ok(
    !csv.includes('[object Object]'),
    '🔴 un campo JSON sale como `[object Object]`: una columna presente y sin información, que es ' +
      'peor que una ausente porque parece que está.',
  );
  // El JSON viaja CSV-escapado (comillas dobladas), que es lo correcto: se comprueba que el
  // contenido está, no la forma cruda — exigir la cruda sería pedir un CSV mal escapado.
  assert.ok(csv.includes('""k""'), '🔴 el contenido del JSON no viaja en la celda');

  // Y la fila de cabeceras tiene que ser UNA LÍNEA: unir sin terminador dejaba el CSV entero
  // en un renglón — un fichero que se abre, no da error y no significa nada.
  const lineas = csv.split('\r\n').filter(Boolean);
  assert.equal(lineas.length, 2, `🔴 el CSV no tiene cabecera + 1 fila, tiene ${lineas.length} líneas`);
  assert.equal(lineas[0], 'a;b;c;d', '🔴 la cabecera no es una línea propia');
  assert.ok(lineas[1].startsWith('1;;'), '🔴 la fila de datos no empieza donde debe');
});

test('SCRUM-244 · las cabeceras son nombres de CAMPO, no de columna física', () => {
  // Coherente con la derivación: mezclar `merchant_id` en unas tablas y `merchantId` en otras
  // —según cuál llevara @map— es lo que hace ilegible un export automático.
  const campos = camposDe('Invoice');
  assert.ok(campos.includes('merchantId'), '🔴 la cabecera de Invoice no usa el nombre de campo');
  assert.ok(!campos.includes('merchant_id'), '🔴 se ha colado el nombre físico de la columna');
});
