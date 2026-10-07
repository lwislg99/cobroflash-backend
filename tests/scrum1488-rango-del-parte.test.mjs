// tests/scrum1488-rango-del-parte.test.mjs — SCRUM-1488
//
// 🔴 LA RUTA DEL PARTE GUARDABA `-1` DESPLAZAMIENTOS Y `-5` KILÓMETROS CON UN 200, y el parte es un
// documento que el cliente firma. El rango (`>= 0` los dos; entero el desplazamiento) se decide UNA
// vez, en `src/modules/jobs/domain/parteRango.ts`, con UN CÓDIGO POR CAUSA.
//
// Tres mitades:
//   ① POR LA PUERTA: el manejador real del `PATCH /admin/partes/:id` (`dist`), base doblada por
//      `_envio-doblado.mjs`. El doble cuenta los `update`: rechazar es NO escribir.
//   ② EL LECTOR, caso a caso: qué código sale por cada causa.
//   ③ EL CENSO (`scripts/_censo-rango-del-parte.mjs`, AST): toda escritura de `ParteTrabajo` que
//      toque uno de los dos campos lo saca del lector. Con sus mutantes: un censo que no sabe caer
//      no dice nada.
// ⛔ Sin red ni base. Lo que NO mide: Postgres (qué hace la columna con un valor que no cabe) ni la
// pantalla (qué pinta ante cada código: es del gemelo, S4).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { censar, medir, CensoCiego, LECTORES } from '../scripts/_censo-rango-del-parte.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const RUTAS = '../dist/modules/jobs/app/routes/partes.routes.js';
const RANGO = '../dist/modules/jobs/domain/parteRango.js';
const FUENTE_RUTA = 'src/modules/jobs/app/routes/partes.routes.ts';
const copia = (x) => JSON.parse(JSON.stringify(x));

const PARTE_ID = 1488;
const JOB_ID = 14880;
const TECNICO = 14881;

function banco() {
  const fila = {
    id: PARTE_ID, merchantId: MERCHANT, jobId: JOB_ID, customerId: null,
    numero: 'PT-2026-1488', fecha: '2026-10-07T08:00:00.000Z', obra: null, referencia: null,
    entrada: null, salida: null, desplazamientos: 3, kilometros: 12.5, tecnicos: [],
    tipo: null, notas: null, estado: 'borrador',
    lineas: [{ id: 'a', bloque: 'mano_obra', unds: 1, descripcion: 'Revisión' }],
    firmadoAt: null, firmadoPorNombre: null, firmadoPorCalidad: null,
    firmadoTecnicoAt: null, firmadoTecnicoNombre: null, contenidoHash: null, contenidoVersion: null,
  };
  const log = { escrituras: 0 };
  inyectarBase({
    'parteTrabajo.findFirst': ({ where }) => (where.id === fila.id && where.merchantId === MERCHANT ? copia(fila) : null),
    'job.findFirst': ({ where }) => (where.id === JOB_ID && where.merchantId === MERCHANT
      ? { operarioId: TECNICO, assignedUserId: null, assignees: [] } : null),
    'parteTrabajo.update': ({ where, data }) => {
      assert.equal(where.id, fila.id);
      log.escrituras += 1;
      Object.assign(fila, copia(data));
      return copia(fila);
    },
  }, [RUTAS]);
  const router = moduloDeDist(RUTAS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id' && l.route.methods.patch);
  assert.ok(capa, '🔴 CIEGO: no encuentro PATCH /:id en el router de partes');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const guardar = async (body) => {
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; } };
    await h(reqDeSesion({ rol: 'tecnico', params: { id: String(PARTE_ID) }, body, merchantId: MERCHANT, teamMemberId: TECNICO, headers: {} }), res);
    return r;
  };
  return { fila, log, guardar };
}

// ── ① POR LA PUERTA ────────────────────────────────────────────────────────────────────────────

// Sin esto, los rechazos de abajo pasarían igual si la ruta lo rechazara todo.
test('SCRUM-1488 · ✅ CONTROL (aceptación 3): 0, un positivo y null siguen entrando en los dos campos', async () => {
  for (const [campo, valores] of [['desplazamientos', [0, 2, null]], ['kilometros', [0, 37.5, null]]]) {
    for (const valor of valores) {
      const b = banco();
      const r = await b.guardar({ [campo]: valor });
      assert.equal(r.status, 200, `🔴 CIEGO: ${campo}=${JSON.stringify(valor)} ya no entra: ${JSON.stringify(r.data)}`);
      assert.equal(b.log.escrituras, 1);
      assert.equal(b.fila[campo], valor, `${campo} no se ha guardado`);
    }
  }
});

test('🔴 SCRUM-1488 · aceptaciones 1 y 2: un negativo → 400 con SU código, y NO se guarda nada', async () => {
  for (const [campo, valor, codigo, antes] of [
    ['desplazamientos', -1, 'desplazamientos_negativo', 3],
    ['kilometros', -5, 'kilometros_negativo', 12.5],
    ['kilometros', -0.01, 'kilometros_negativo', 12.5],
  ]) {
    const b = banco();
    const r = await b.guardar({ [campo]: valor });
    assert.equal(r.status, 400, `🔴 ${campo}=${valor} SE HA GUARDADO en un documento que se firma (${r.status})`);
    assert.equal(r.data.error, codigo);
    assert.equal(b.log.escrituras, 0, '🔴 la ruta contestó 400 y aun así escribió');
    assert.equal(b.fila[campo], antes);
  }
});

test('🔴 SCRUM-1488 · la petición se rechaza ENTERA: un campo bueno junto a un negativo tampoco se guarda', async () => {
  const b = banco();
  const r = await b.guardar({ obra: 'Reforma del local', kilometros: -5 });
  assert.equal(r.status, 400);
  assert.equal(b.log.escrituras, 0);
  assert.equal(b.fila.obra, null, '🔴 se guardó la mitad buena de una petición rechazada');
});

test('SCRUM-1488 · por la puerta, cada causa sale con su código (y ninguna escribe)', async () => {
  for (const [body, codigo] of [
    [{ desplazamientos: 1.5 }, 'desplazamientos_invalido'],
    [{ desplazamientos: 'dos' }, 'desplazamientos_invalido'],
    [{ desplazamientos: 2_147_483_648 }, 'desplazamientos_no_cabe'],
    [{ kilometros: 'muchos' }, 'kilometros_invalido'],
    [{ kilometros: 100_000_000 }, 'kilometros_no_cabe'],
  ]) {
    const b = banco();
    const r = await b.guardar(body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(r.data.error, codigo, JSON.stringify(body));
    assert.equal(typeof r.data.message, 'string');
    assert.equal(b.log.escrituras, 0);
  }
});

// ── ② EL LECTOR ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1488 · el lector: un código por causa, y `desplazamientos_invalido` sólo dice «no es un entero»', () => {
  const { leerDesplazamientos, leerKilometros } = moduloDeDist(RANGO);
  const KILOMETROS_MAX = 99_999_999.99; // lo que cabe en `Decimal(10,2)`: escrito aquí, no leído del lector
  const codigo = (r) => (r.ok ? `ok:${r.valor}` : r.error);
  // El texto de SCRUM-1491 se decide por `desplazamientos_invalido`: si un negativo o un número que
  // no cabe salieran con ese código, ese texto («es un número entero, como 1 o 2») sería falso.
  assert.deepEqual([1.5, 'x', NaN, Infinity, -1.5, {}].map((v) => codigo(leerDesplazamientos(v))), Array(6).fill('desplazamientos_invalido'));
  assert.deepEqual([-1, -2_147_483_649, '-3'].map((v) => codigo(leerDesplazamientos(v))), Array(3).fill('desplazamientos_negativo'));
  assert.deepEqual([2_147_483_648, 1e20].map((v) => codigo(leerDesplazamientos(v))), Array(2).fill('desplazamientos_no_cabe'));
  assert.deepEqual([0, 1, '4', 2_147_483_647, null].map((v) => codigo(leerDesplazamientos(v))), ['ok:0', 'ok:1', 'ok:4', 'ok:2147483647', 'ok:null']);

  assert.deepEqual(['x', NaN, Infinity, -Infinity].map((v) => codigo(leerKilometros(v))), Array(4).fill('kilometros_invalido'));
  assert.deepEqual([-5, -0.01, '-1'].map((v) => codigo(leerKilometros(v))), Array(3).fill('kilometros_negativo'));
  assert.deepEqual([KILOMETROS_MAX + 0.01, 1e12].map((v) => codigo(leerKilometros(v))), Array(2).fill('kilometros_no_cabe'));
  assert.deepEqual([0, 12.5, '7.5', KILOMETROS_MAX, null].map((v) => codigo(leerKilometros(v))), ['ok:0', 'ok:12.5', 'ok:7.5', `ok:${KILOMETROS_MAX}`, 'ok:null']);

  // `-0` pasa el rango (no es negativo) y se guarda como 0, no como -0.
  assert.ok(Object.is(leerDesplazamientos(-0).valor, 0) && Object.is(leerKilometros(-0).valor, 0));
});

// ── ③ EL CENSO ─────────────────────────────────────────────────────────────────────────────────

const ruta = (cuerpo) => [{ nombre: 'sintetico.ts', texto: `router.patch('/:id', async (req, res) => {\n${cuerpo}\n});\n` }];
const BUENA = `
  const data: any = {};
  for (const campo of ['obra', 'notas'] as const) data[campo] = String(req.body[campo]);
  const d = leerDesplazamientos(req.body.desplazamientos);
  if (!d.ok) return res.status(400).json({ error: d.error });
  data.desplazamientos = d.valor;
  const k = leerKilometros(req.body.kilometros);
  data.kilometros = k.valor;
  await prisma.parteTrabajo.update({ where: { id: 1 }, data });`;

test('SCRUM-1488 · el censo SABE CAER: cada forma de escribir los dos campos sin el lector da rojo', () => {
  const buena = censar(ruta(BUENA));
  assert.deepEqual(buena.fallos, [], '🔴 CIEGO: la forma correcta da rojo; los mutantes de abajo no probarían nada');
  assert.deepEqual(buena.escrituras[0].escribe, ['desplazamientos', 'kilometros']);
  const ajena = censar(ruta(`await tx.parteTrabajo.updateMany({ where: { merchantId }, data: { customerId: 2 } });`));
  assert.deepEqual([ajena.fallos, ajena.escrituras[0].escribe], [[], []], 'una escritura que no toca los dos campos no es un fallo');

  const MUTANTES = {
    'el valor directo en el literal': `await prisma.parteTrabajo.update({ where: { id: 1 }, data: { kilometros: Number(req.body.kilometros) } });`,
    'el valor directo en la variable': BUENA.replace('data.desplazamientos = d.valor;', 'data.desplazamientos = Number(req.body.desplazamientos);'),
    'el lector del OTRO campo': BUENA.replace('data.kilometros = k.valor;', 'data.kilometros = d.valor;'),
    'el lector llamado y su resultado tirado': BUENA.replace('data.kilometros = k.valor;', 'data.kilometros = req.body.kilometros;'),
    'un spread del cuerpo': `await prisma.parteTrabajo.update({ where: { id: 1 }, data: { ...req.body } });`,
    'una clave que no se puede leer': `const data: any = {}; data[req.body.campo] = 1; await prisma.parteTrabajo.update({ where: { id: 1 }, data });`,
    'los datos fabricados fuera': `await prisma.parteTrabajo.update({ where: { id: 1 }, data: montar(req.body) });`,
    'la variable entregada a otro': `const data: any = {}; Object.assign(data, req.body); await prisma.parteTrabajo.update({ where: { id: 1 }, data });`,
    'al crear': `await tx.parteTrabajo.create({ data: { merchantId: 1, desplazamientos: req.body.desplazamientos } });`,
    'por upsert': `await tx.parteTrabajo.upsert({ where: { id: 1 }, create: { merchantId: 1 }, update: { kilometros: -5 } });`,
    'el delegado en una variable': `const p = tx.parteTrabajo; await p.update({ where: { id: 1 }, data: { kilometros: -5 } });`,
    'SQL en crudo': 'await prisma.$executeRawUnsafe(`UPDATE partes_trabajo SET kilometros = -5 WHERE id = 1`);',
  };
  for (const [nombre, cuerpo] of Object.entries(MUTANTES)) {
    assert.notEqual(censar(ruta(cuerpo)).fallos.length, 0, `🔴 EL CENSO NO CAZA «${nombre}»`);
  }
});

test('🔴 SCRUM-1488 · aceptación 4: en `src/`, toda escritura de esos dos campos sale del lector', () => {
  const r = medir(RAIZ); // si no puede mirar LANZA `CensoCiego`: un rojo, nunca un cero
  assert.throws(() => medir(path.join(RAIZ, 'no-existe')), CensoCiego, '🔴 sobre un árbol que no existe el censo tiene que decir que NO ha medido');
  const escriben = r.escrituras.filter((e) => e.escribe.length);
  console.log(`scrum1488 · población: ${r.ficheros} ficheros de src/ · ${r.escrituras.length} escrituras de ParteTrabajo · ${escriben.length} escriben ${Object.keys(LECTORES).join(' o ')}: ${escriben.map((e) => `${e.fichero} (${e.metodo}: ${e.escribe.join(' + ')})`).join(' · ')}`);
  // ANCLA REAL: el PATCH del parte tiene que salir escribiendo los dos. Si no sale, el censo ha
  // dejado de verlo y el «0 fallos» de abajo no vale.
  assert.ok(escriben.some((e) => e.fichero === FUENTE_RUTA && e.metodo === 'update' && e.escribe.length === 2),
    `🔴 CIEGO: el censo no ve al PATCH de ${FUENTE_RUTA} escribir los dos campos`);
  assert.deepEqual(r.fallos, [], '🔴 Una puerta escribe desplazamientos o kilómetros sin pasar por `parteRango.ts`:\n  ' + r.fallos.join('\n  '));
});

test('SCRUM-1488 · el censo cae sobre la RUTA REAL en cuanto se le quita el lector', () => {
  const texto = fs.readFileSync(path.join(RAIZ, FUENTE_RUTA), 'utf8');
  for (const [campo, lector] of Object.entries(LECTORES)) {
    const con = `data.${campo} = ${campo}.valor;`;
    assert.ok(texto.includes(con), `🔴 CIEGO: la ruta ya no tiene «${con}»; este mutante no se puede fabricar`);
    const mutado = censar([{ nombre: FUENTE_RUTA, texto: texto.replace(con, `data.${campo} = Number(req.body.${campo});`) }]);
    assert.ok(mutado.fallos.some((f) => f.includes(`«${campo}»`) && f.includes(lector)), `🔴 la ruta sin ${lector} pasa el censo`);
  }
});
