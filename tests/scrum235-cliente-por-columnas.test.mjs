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
import { fileURLToPath } from 'node:url';
import {
  modelosDelSchema,
  modelosDelCliente,
  primeraDiscrepancia,
  mensaje,
  comprobarCliente,
} from '../scripts/_prisma-client-guard.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const textoSchema = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');

/** Un cliente de mentira con la forma del DMMF: modelo → (campo → columna). */
const clienteDe = (obj) => new Map(Object.entries(obj).map(([m, campos]) => [m, new Map(Object.entries(campos))]));

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
  const columnas = [...s.values()].reduce((n, m) => n + m.size, 0);
  assert.ok(columnas >= 300, `🔴 ESCÁNER CIEGO: solo ${columnas} columnas escalares`);
  assert.ok(s.get('Invoice')?.has('vfEstado'), 'el modelo real de referencia tiene que estar');
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
  assert.equal(s.get('M').get('unCampo'), 'una_columna');
  assert.equal(s.get('M').get('otro'), 'otro', 'sin @map, la columna es el propio nombre');
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
  assert.deepEqual([...inv.keys()], ['id', 'merchantId'], '🔴 la relación entró como columna');
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
  assert.ok(s.get('Invoice').has('estado'), '🔴 el enum se descartó: vuelve la lista a mano');
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
    for (const f of m.fields) if (!enSchema?.has(f.name)) ingenuo.push(`${m.name}.${f.name}:${f.kind}`);
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
// HUECO 2 · el guard tiene que correr en la tanda que toca una base real
// ═════════════════════════════════════════════════════════════════════════════════════════

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
