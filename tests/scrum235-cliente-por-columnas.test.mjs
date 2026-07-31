// SCRUM-235 · EL GUARD DEL CLIENTE DE PRISMA COMPARA COLUMNAS, EN LOS DOS SENTIDOS.
//
// Este guard no tenía tests. Daba falso verde por una premisa escrita en su propia cabecera:
//
//   «Al revés no: un cliente con cosas de MÁS […] molesto pero inofensivo»
//   «Falla lo que rompe el build.»
//
// La segunda es la que mandaba: el criterio apuntaba al COMPILADO —`tsc` se queja de lo que
// FALTA— cuando el fallo caro vive en la CONSULTA, y la base se queja de lo que SOBRA. Prisma
// selecciona todos los escalares por defecto, así que un campo de más en el cliente entra en
// TODA lectura del modelo. El 29-jul-2026 eso costó 6 tests y 27 minutos con el guard en verde.
//
// Es la forma de SCRUM-239: el medidor mira un sitio y el defecto vive en otro.
//
// LOS TRES CASOS QUE FIJA, uno por hueco medido:
//   · SOBRA en el cliente  → el que estaba abierto (falso verde).
//   · FALTA en el cliente  → lo que ya cubría; no se pierde al reescribir.
//   · MISMO campo, OTRA columna → el `@map`. La base responde por columna, y en este schema hay
//     189 campos escalares cuyo `@map` difiere del nombre del campo. Comparar nombres de campo
//     dejaba pasar un cliente generado desde un schema que solo cambiara un `@map`.
//
// Y UN CONTROL NEGATIVO PERMANENTE, que es la otra mitad: el arreglo escrito de la forma obvia
// —comparar nombre a nombre en la vuelta— marca 54 campos «de más» en un cliente PERFECTAMENTE
// SANO, porque el DMMF lista las relaciones y el parser del schema no. Un guard que grita sobre
// un árbol sano se desactiva en una tarde, así que eso se vigila para siempre.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  modelosDelSchema,
  modelosDelCliente,
  primeraDiscrepancia,
  mensaje,
  comprobarCliente,
  esInvocacionDirecta,
} from '../scripts/_prisma-client-guard.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const textoSchema = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');

/**
 * Un cliente de mentira con la forma del DMMF: modelo → {tabla, campos}. La TABLA por defecto es
 * el nombre del modelo, que es lo que hace Prisma cuando no hay `@@map`.
 */
const clienteDe = (obj, tablas = {}) => new Map(Object.entries(obj).map(([m, campos]) => [
  m, { tabla: tablas[m] ?? m, campos: new Map(Object.entries(campos)) },
]));

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CONTROL · el árbol sano tiene que estar verde
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-235 · el control: schema y cliente REALES de este repo cuadran', async () => {
  const r = await comprobarCliente();
  assert.equal(r.ok, true,
    `🔴 falso positivo contra el árbol real:\n${r.mensaje ?? ''}\nUn guard que grita sin motivo se ` +
    'desactiva igual que uno que no grita nunca.');
});

test('SCRUM-235 · SUELO: el parser encuentra modelos y columnas de verdad', () => {
  // Sin esto, una regex rota devuelve un Map vacío y TODAS las comparaciones de abajo pasan
  // por vacuidad: dos conjuntos vacíos son iguales. Verde hueco en un guard de integridad.
  const s = modelosDelSchema(textoSchema);
  assert.ok(s.size >= 20, `🔴 ESCÁNER CIEGO: solo ${s.size} modelos en schema.prisma`);
  const columnas = [...s.values()].reduce((n, m) => n + m.campos.size, 0);
  assert.ok(columnas >= 300, `🔴 ESCÁNER CIEGO: solo ${columnas} columnas escalares`);
  assert.ok(s.get('Invoice')?.campos.has('vfEstado'), 'el modelo real de referencia tiene que estar');
  assert.equal(s.get('Invoice').tabla, 'invoices', 'la TABLA física también se parsea');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// (a) SOBRA · el falso verde que costó la tanda del 29-jul
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-235 · (a) un campo de MÁS en el cliente es ROJO (antes: verde)', () => {
  const schema = modelosDelSchema('model Invoice {\n  id Int @id\n  total Decimal\n}');
  const cliente = clienteDe({ Invoice: { id: 'id', total: 'total', vfEstado: 'vf_estado' } });

  const d = primeraDiscrepancia(schema, cliente);
  assert.ok(d, '🔴 EL FALSO VERDE SIGUE ABIERTO: un cliente que pide una columna que la base no ' +
    'tiene pasaría el guard, que es exactamente lo que mató la tanda del 29-jul.');
  assert.equal(d.direccion, 'sobra');
  assert.equal(d.campo, 'vfEstado');
  assert.equal(d.columna, 'vf_estado');

  // El mensaje tiene que decir por qué NO es inofensivo, que es la creencia que causó el hueco.
  const m = mensaje(d);
  assert.match(m, /TODA LECTURA/, '🔴 el mensaje no dice que rompe todas las lecturas del modelo');
  assert.match(m, /vf_estado/, '🔴 el mensaje no nombra la COLUMNA que la base va a rechazar');
});

test('SCRUM-235 · un MODELO de más en el cliente también es rojo', () => {
  const schema = modelosDelSchema('model A {\n  id Int @id\n}');
  const d = primeraDiscrepancia(schema, clienteDe({ A: { id: 'id' }, B: { id: 'id' } }));
  assert.equal(d?.direccion, 'sobra');
  assert.equal(d.modelo, 'B');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// (b) FALTA · lo que el guard ya cubría, y que reescribirlo NO puede perder
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-235 · (b) un campo que FALTA en el cliente sigue siendo rojo', () => {
  const schema = modelosDelSchema('model Invoice {\n  id Int @id\n  vfEstado String @map("vf_estado")\n}');
  const d = primeraDiscrepancia(schema, clienteDe({ Invoice: { id: 'id' } }));
  assert.equal(d?.direccion, 'falta');
  assert.equal(d.campo, 'vfEstado');
  assert.match(mensaje(d), /POR DETRÁS/, 'el remedio se lee distinto según la dirección');
});

test('SCRUM-235 · un MODELO que falta sigue siendo rojo', () => {
  const schema = modelosDelSchema('model A {\n  id Int @id\n}');
  const d = primeraDiscrepancia(schema, clienteDe({}));
  assert.equal(d?.direccion, 'falta');
  assert.equal(d.tipo, 'modelo');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// (c) COLUMNA · el hueco que no estaba en el ticket: la base responde por COLUMNA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-235 · (c) mismo campo con OTRO @map es rojo, aunque el nombre coincida', () => {
  // Este es el caso que un guard de nombres de campo no puede ver: los dos lados tienen
  // `vfEstado`, pero el cliente pedirá `estado_vf` y la base no conoce esa columna.
  const schema = modelosDelSchema('model Invoice {\n  vfEstado String @map("vf_estado")\n}');
  const d = primeraDiscrepancia(schema, clienteDe({ Invoice: { vfEstado: 'estado_vf' } }));
  assert.equal(d?.direccion, 'columna');
  assert.equal(d.columna, 'vf_estado');
  assert.equal(d.columnaCliente, 'estado_vf');
  assert.match(mensaje(d), /por nombre de columna/);
});

test('SCRUM-235 · el parser lee @map y no el nombre del campo', () => {
  const s = modelosDelSchema('model M {\n  unCampo String @map("una_columna")\n  otro Int\n}');
  assert.equal(s.get('M').campos.get('unCampo'), 'una_columna');
  assert.equal(s.get('M').campos.get('otro'), 'otro', 'sin @map, la columna es el propio nombre');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA REGLA ESTRUCTURAL · relación ⇔ el tipo nombra un modelo, sin lista de tipos a mano
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-235 · una relación se detecta porque su tipo ES un modelo, no por una lista', () => {
  const s = modelosDelSchema([
    'model Invoice {',
    '  id Int @id',
    '  merchantId Int @map("merchant_id")',
    '  merchant Merchant @relation(fields: [merchantId], references: [id])',
    '}',
    'model Merchant {',
    '  id Int @id',
    '}',
  ].join('\n'));
  const inv = s.get('Invoice');
  assert.deepEqual([...inv.campos.keys()], ['id', 'merchantId'], '🔴 la relación entró como columna');
});

test('SCRUM-235 · un campo de tipo ENUM SÍ es una columna (la lista a mano lo perdía)', () => {
  // El parser anterior descartaba todo tipo que empezara por mayúscula y no estuviera en una
  // lista literal de nueve. Un enum caía fuera, así que un enum ausente en el cliente era
  // invisible INCLUSO en la dirección que el guard decía cubrir. Hoy el schema no tiene enums;
  // el día que tenga uno, este test es lo que impide que se cuele.
  const s = modelosDelSchema([
    'model Invoice {',
    '  estado EstadoFactura @map("estado")',
    '}',
  ].join('\n'));
  assert.ok(s.get('Invoice').campos.has('estado'), '🔴 el enum se descartó: vuelve la lista a mano');
  const d = primeraDiscrepancia(s, clienteDe({ Invoice: {} }));
  assert.equal(d?.direccion, 'falta', '🔴 un enum que falta en el cliente no se ve');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO PERMANENTE · la vuelta INGENUA marca 54 sobre un cliente sano
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-235 · la vuelta compara ESCALARES: comparar nombre a nombre daría 54 falsos rojos', async () => {
  const schema = modelosDelSchema(textoSchema);
  const cliente = await modelosDelCliente();

  // Lo que haría la implementación obvia: todos los campos del DMMF, relaciones incluidas.
  const mod = await import('@prisma/client');
  const ingenuo = [];
  for (const m of mod.Prisma.dmmf.datamodel.models) {
    const enSchema = schema.get(m.name);
    for (const f of m.fields) if (!enSchema?.campos.has(f.name)) ingenuo.push(`${m.name}.${f.name}:${f.kind}`);
  }

  // La trampa es REAL — si esto fuera 0, el control no estaría probando nada.
  assert.ok(ingenuo.length > 0,
    '🔴 la vuelta ingenua ya no marca nada: este control ha dejado de vigilar la trampa que ' +
    'vigilaba. Compruébalo antes de borrarlo.');
  assert.deepEqual(
    ingenuo.filter((x) => !x.endsWith(':object')), [],
    '🔴 la vuelta ingenua marca algo que NO es una relación: la trampa cambió de forma.',
  );

  // Y la implementación de verdad no marca ni una.
  assert.equal(primeraDiscrepancia(schema, cliente), null,
    `🔴 el guard marca diferencias sobre un cliente SANO (la ingenua marcaba ${ingenuo.length}, ` +
    'todas relaciones). Si esto falla, alguien volvió a comparar relaciones y el guard va a ' +
    'gritar en cada tanda hasta que alguien lo apague.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO CONTRA EL VERDE HUECO · dos conjuntos vacíos son iguales
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-235 · un schema del que no sale ningún modelo NO puede dar verde', async () => {
  // Sin este suelo, un schema.prisma movido o truncado frente a un cliente sin DMMF devuelve
  // `null` — o sea ✔ — sin haber comparado un solo modelo. Es el verde hueco en el propio guard:
  // la comparación es correcta y no compara nada. Misma forma que el suelo de SCRUM-239.
  // El fichero de sonda se escribe FUERA del repo: un `.prisma` suelto en el árbol lo vería
  // cualquier otra sesión, y un schema fantasma es justo lo que este guard existe para cazar.
  const tmp = process.env.TMPDIR || process.env.TEMP || '.';
  const ruta = path.join(tmp, `scrum235-sin-modelos-${process.pid}.prisma`);
  fs.writeFileSync(ruta, ['generator client {', '  provider = "prisma-client-js"', '}', ''].join('\n'));
  try {
    const r = await comprobarCliente({ schemaPath: ruta });
    assert.equal(r.ok, false, '🔴 VERDE HUECO: un schema sin modelos dio ✔');
    assert.match(r.mensaje, /NO SE PUEDE COMPARAR/);
    assert.match(r.mensaje, /NINGÚN modelo/);
  } finally {
    fs.unlinkSync(ruta);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE ENCONTRÓ LA VERIFICACIÓN ADVERSARIAL · cuatro huecos de la PRIMERA versión de este
// mismo arreglo. Los cuatro reproducidos antes de tocar nada.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-235 · el nombre de TABLA (@@map del modelo) también se compara', () => {
  // El eje del ticket —«la base responde por nombre físico»— aplicado a medias: se comparaban
  // las columnas y NO la tabla. Un cliente que lee de otra tabla falla con 42P01 en el 100% de
  // las lecturas del modelo, y el dato (`m.dbName`) ya venía cargado en el DMMF y se tiraba.
  // Los 24 modelos de este schema llevan `@@map`, o sea que el 100% estaba sin vigilar.
  const schema = modelosDelSchema('model Invoice {\n  id Int @id\n  @@map("invoices")\n}');
  assert.equal(schema.get('Invoice').tabla, 'invoices');

  const d = primeraDiscrepancia(schema, clienteDe({ Invoice: { id: 'id' } }, { Invoice: 'facturas' }));
  assert.equal(d?.direccion, 'tabla', '🔴 un cliente que lee de OTRA tabla pasaría en verde');
  assert.equal(d.tabla, 'invoices');
  assert.equal(d.tablaCliente, 'facturas');
  assert.match(mensaje(d), /FROM/, 'el mensaje tiene que decir que rompe TODA lectura');
});

test('SCRUM-235 · sin @@map, la tabla es el nombre del modelo (y coincide)', () => {
  const schema = modelosDelSchema('model A {\n  id Int @id\n}');
  assert.equal(schema.get('A').tabla, 'A');
  assert.equal(primeraDiscrepancia(schema, clienteDe({ A: { id: 'id' } })), null);
});

test('SCRUM-235 · un @map dentro de un COMENTARIO no cuenta como el @map del campo', () => {
  // Falso ROJO sobre un árbol sano, y encima irreparable: el remedio que imprime el guard
  // («regenera el cliente») produce el mismo cliente, así que el rojo no se iría nunca y el
  // desenlace sería apagar el guard. Es la trampa de autorreferencia de SCRUM-176/168/3/193:
  // leer el código sin quitar los comentarios.
  const s = modelosDelSchema('model M {\n  slug String? @unique // antes era @map("slug_url")\n}');
  assert.equal(s.get('M').campos.get('slug'), 'slug',
    '🔴 el guard se inventa una columna leyendo el comentario que explica el renombrado');
});

test('SCRUM-235 · pero un @map REAL con comentario detrás sí cuenta', () => {
  // La otra mitad: cortar por el comentario no puede perder el @map legítimo. En este schema hay
  // 44 líneas con el `@map` detrás de un `@default`, y `sinComentario` respeta las comillas para
  // que un `@default("https://…")` no parta la línea por su propio `//`.
  const s = modelosDelSchema([
    'model M {',
    '  a String @default("https://yaqu.app") @map("col_a") // ojo con la URL',
    '  b String @map("col_b") // comentario normal',
    '}',
  ].join('\n'));
  assert.equal(s.get('M').campos.get('a'), 'col_a', '🔴 la URL del default partió la línea');
  assert.equal(s.get('M').campos.get('b'), 'col_b');
});

test('SCRUM-235 · @@ignore y @ignore no se comparan (Prisma no los genera)', () => {
  // Rojo permanente si se compararan: el modelo/campo no llega al cliente por diseño, así que
  // ningún `prisma generate` podría curarlo. Hoy el schema no usa ninguno — se contempla porque
  // es la salida estándar de una introspección y el rojo sería irreparable.
  const s = modelosDelSchema([
    'model Buena {',
    '  id Int @id',
    '  interno String @ignore',
    '}',
    'model legacy {',
    '  ref String',
    '  @@ignore',
    '}',
  ].join('\n'));
  assert.ok(!s.has('legacy'), '🔴 un modelo @@ignore entró en la comparación');
  assert.ok(!s.get('Buena').campos.has('interno'), '🔴 un campo @ignore entró en la comparación');
  assert.equal(primeraDiscrepancia(s, clienteDe({ Buena: { id: 'id' } })), null);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// HUECO 2 · el guard tiene que correr en la tanda que toca una base real
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-235 · el guard se reconoce como script aunque la ruta lleve un espacio', () => {
  // Aquí el guard entero se convertía en un no-op: `import.meta.url` viene percent-encodeado y
  // `argv[1]` no, así que `endsWith` daba false y el script salía 0 sin imprimir ni comparar
  // nada. Un checkout bajo `OneDrive - Empresa` o `Mi unidad` apagaba las tres tandas en
  // silencio. Es el «verde hueco» en su forma más cara: el medidor ni siquiera se ejecuta.
  const conEspacio = path.join(RAIZ, '..', 'con espacio', 'g.mjs');
  assert.equal(
    esInvocacionDirecta(pathToFileURL(conEspacio).href, conEspacio), true,
    '🔴 con un espacio en la ruta el guard no se reconoce y se vuelve un NO-OP con exit 0',
  );
  const normal = path.join(RAIZ, 'scripts', '_prisma-client-guard.mjs');
  assert.equal(esInvocacionDirecta(pathToFileURL(normal).href, normal), true);
  assert.equal(esInvocacionDirecta(pathToFileURL(normal).href, path.join(RAIZ, 'otro.mjs')), false,
    'importado desde otro script NO debe ejecutarse como CLI');
  assert.equal(esInvocacionDirecta(pathToFileURL(normal).href, undefined), false);
});

test('SCRUM-235 · EJECUTADO como script: exit 1 con un cliente divergente, 0 con el sano', () => {
  // El test que faltaba: el anterior comprobaba que package.json MENCIONA el fichero — miraba la
  // cadena, no la ejecución. Esto arranca el guard como subproceso, que es como corre en
  // `pretest`, y exige el código de salida. Es la diferencia entre «está el código» y «pasa lo
  // que quiero», que es justo lo que este ticket vino a arreglar.
  const tmp = process.env.TMPDIR || process.env.TEMP || '.';
  const falso = path.join(tmp, `scrum235-cliente-falso-${process.pid}.mjs`);
  // Un cliente de mentira con la forma del DMMF: un solo modelo, con un campo que el schema real
  // no tiene. Barato y hermético — no hace falta generar un cliente de Prisma para esto.
  fs.writeFileSync(falso, 'export const Prisma = { dmmf: { datamodel: { models: [' +
    '{ name: "Merchant", dbName: "merchants", fields: [' +
    '{ name: "campoQueNoExiste", kind: "scalar", dbName: "campo_que_no_existe" }] }] } } };\n');
  try {
    const malo = spawnSync(process.execPath, [
      path.join(RAIZ, 'scripts', '_prisma-client-guard.mjs'), pathToFileURL(falso).href,
    ], { cwd: RAIZ, encoding: 'utf8' });
    assert.equal(malo.status, 1,
      `🔴 el guard salió ${malo.status} con un cliente divergente. stdout=${malo.stdout} stderr=${malo.stderr}`);
    assert.match(malo.stderr, /NO CORRESPONDE A schema\.prisma/);

    const bueno = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', '_prisma-client-guard.mjs')],
      { cwd: RAIZ, encoding: 'utf8' });
    assert.equal(bueno.status, 0, `🔴 el guard salió ${bueno.status} sobre el árbol sano: ${bueno.stderr}`);
    assert.match(bueno.stdout, /✔/, '🔴 sale 0 pero sin decir nada: indistinguible de no haber corrido');
  } finally {
    fs.unlinkSync(falso);
  }
});

test('SCRUM-235 · la tanda gateada ejecuta el guard ANTES de tomar el turno', () => {
  // `pretest` solo se dispara antes del script `test`. La tanda gateada es otro script, así que
  // la única tanda que toca una base real era la única que no comprobaba el cliente: el 29-jul
  // murió en la fase 4, con 27 minutos gastados y el turno de staging tomado.
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  for (const s of ['test', 'test:staging', 'test:staging:gated']) {
    assert.ok(pkg.scripts[s], `el script ${s} tiene que existir`);
    assert.match(
      pkg.scripts[`pre${s}`] ?? '',
      /_prisma-client-guard\.mjs/,
      `🔴 "pre${s}" no comprueba el cliente. npm NO deriva los pre- entre nombres: cada script ` +
      'que arranca una tanda necesita el suyo (SCRUM-166 dejó DOS nombres para el runner).',
    );
  }
});
