// tests/scrum1150c-dos-crear-revision-a-la-vez.test.mjs — SCRUM-1150c
//
// 🔴 DOS «CREAR REVISIÓN» A LA VEZ CREABAN DOS `.1`, Y LA FICHA DE ESE PRESUPUESTO DABA 500.
//
// `crearRevisionDeQuote` leía el máximo del grupo y creaba la fila sin nada que lo pusiera en
// serie. Medido contra Postgres por HTTP (SCRUM-1150, comentario 19105; repetido el 13-oct-2026
// sobre `main`: 9 empates de 10): las dos peticiones contestaban 201 con `.1`, y desde entonces
// `GET /admin/quotes/:id` daba 500 y «Crear revisión» 409 `revisiones_dos_vigentes`, sin salida
// para el profesional. La sonda está en `docs/master/evidencias/SCRUM-1150c/`.
//
// Esta mitad corre SIEMPRE, con Prisma doblado: el cerrojo se toma, y el número sale de lo que se
// lee DESPUÉS de tenerlo. NO prueba que Postgres haga esperar a nadie: eso es del motor y lo
// pregunta su hermano, `scrum1150c-carrera-de-la-revision-postgres.test.mjs` (banco desechable).
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';

// La primera clave del cerrojo, la de `src/modules/system/quoteAdmin.ts`. Va escrita aquí y no
// importada: allí no se exporta. Si allí cambia, cae el primer caso.
const REVISION_LOCK_NS = 1752;
const LOS_DE_OTROS = [1748, 1749, 1750, 1751]; // sellado, serie, encolado, tope de WhatsApp

const NUMERO = 2004226;
const fila = (over = {}) => ({
  id: 700, merchantId: MERCHANT, quoteNumber: NUMERO, revision: 0, signatureUrl: null,
  customerId: 55, total: '100.00', currency: 'EUR', lines: [{ concept: 'x', qty: 1, price: 100, tax: 0.21 }],
  discountGlobalAmount: null, // la puerta de SCRUM-887 exige que venga cargado, aunque sea vacío
  createdAt: new Date('2026-10-01T10:00:00Z'), // una fila real siempre lo trae; SCRUM-1490 lee de ahí el año de una fila sin `seriesYear`
  ...over,
});

/**
 * Ejecuta `crearRevisionDeQuote(MERCHANT, 700)` sobre el doble y devuelve lo que pasó, EN ORDEN.
 * `antes` son las filas del grupo hasta que se toma el cerrojo; `despues`, las que hay una vez
 * tomado: lo que el otro confirmó mientras esta petición esperaba.
 */
async function crear({ antes = [fila()], despues = antes } = {}) {
  const pasos = [];
  let conCerrojo = false;
  const grupo = () => (conCerrojo ? despues : antes);

  inyectarBase({
    '$executeRaw': (trozos, ...valores) => {
      pasos.push({ paso: 'sentencia', texto: trozos.join('?'), valores });
      conCerrojo = true;
      return 0;
    },
    'quote.findFirst': (args) => {
      pasos.push({ paso: 'quote.findFirst', conCerrojo });
      const q = grupo().find((x) => x.id === args?.where?.id);
      return q ? { ...q } : null;
    },
    'quote.findMany': () => {
      pasos.push({ paso: 'quote.findMany', conCerrojo });
      return grupo().map((x) => ({ id: x.id, revision: x.revision, signatureUrl: x.signatureUrl }));
    },
    'quote.create': (args) => {
      pasos.push({ paso: 'quote.create', conCerrojo, data: args.data });
      return { id: 999, quoteNumber: args.data.quoteNumber, revision: args.data.revision, status: args.data.status };
    },
  }, ['../dist/modules/system/quoteAdmin.js']);

  const { crearRevisionDeQuote } = moduloDeDist('../dist/modules/system/quoteAdmin.js');
  let creada = null; let error = null;
  try { creada = await crearRevisionDeQuote(MERCHANT, 700); } catch (e) { error = e; }
  return { creada, error, pasos, escritas: pasos.filter((p) => p.paso === 'quote.create') };
}

test('SCRUM-1150c · el cerrojo es de transacción, propio y por negocio, y el grupo se lee y se escribe DETRÁS de él', async () => {
  const { creada, error, pasos, escritas } = await crear();
  assert.equal(error, null, `🔴 CIEGO: la función no llega al final sobre un presupuesto sano: ${error?.message}`);
  assert.equal(creada?.revision, 1, 'SUELO: de un grupo con sólo la .0 sale la .1');

  const sentencias = pasos.filter((p) => p.paso === 'sentencia');
  assert.equal(sentencias.length, 1, `🔴 se esperaba UNA sentencia cruda (el cerrojo) y hay ${sentencias.length}`);
  assert.match(sentencias[0].texto, /^\s*SELECT pg_advisory_xact_lock\(\?::int, \?::int\)\s*$/,
    `🔴 la sentencia no es el cerrojo de transacción de dos enteros: «${sentencias[0].texto}»`);
  assert.deepEqual(sentencias[0].valores, [REVISION_LOCK_NS, MERCHANT],
    '🔴 las claves del cerrojo no son (espacio de las revisiones, negocio)');
  assert.equal(LOS_DE_OTROS.includes(sentencias[0].valores[0]), false,
    '🔴 el cerrojo comparte espacio con la emisión o con el tope de WhatsApp: crear una revisión esperaría a una factura');

  const detras = pasos.slice(pasos.findIndex((p) => p.paso === 'sentencia') + 1).map((p) => p.paso);
  assert.ok(detras.includes('quote.findMany'),
    `🔴 EL GRUPO NO SE LEE DETRÁS DEL CERROJO (detrás va: ${detras.join(', ') || 'nada'}). El máximo sale de una lectura que el otro pudo dejar vieja.`);
  assert.ok(detras.indexOf('quote.create') > detras.indexOf('quote.findMany'), '🔴 se escribe antes de releer el grupo');
  assert.equal(escritas.length, 1, 'y se escribe UNA fila');
  assert.equal(escritas[0].conCerrojo, true, '🔴 se ha escrito SIN el cerrojo');
});

test('SCRUM-1150c · 🔴 si el otro confirmó la `.1` mientras se esperaba el cerrojo, ésta es la `.2` y hereda de la `.1`', async () => {
  const { creada, error, escritas } = await crear({
    antes: [fila()],
    despues: [fila(), fila({ id: 701, revision: 1, total: '250.00' })],
  });
  assert.equal(error, null, `🔴 CIEGO: la función no llega al final: ${error?.message}`);
  assert.equal(creada.revision, 2,
    `🔴 SALE LA .${creada.revision} Y YA HAY UNA .1: el número se calculó con lo leído ANTES del cerrojo. Eso es el empate.`);
  assert.equal(creada.origenId, 701, '🔴 no se ha creado sobre la vigente que dejó el otro');
  assert.equal(escritas.length, 1);
  assert.equal(escritas[0].data.total, '250.00', '🔴 la revisión hereda el contenido de la .0 y la vigente ya era la .1');
});

test('SCRUM-1150c · si el presupuesto desaparece mientras se esperaba, se rechaza con su código y no se escribe', async () => {
  const { creada, error, pasos, escritas } = await crear({ antes: [fila()], despues: [] });
  assert.equal(creada, null);
  assert.equal(error?.name, 'RevisionNoCreable', `🔴 se esperaba un rechazo del dominio y llegó: ${error?.message}`);
  assert.equal(error.motivo, 'quote_not_found');
  assert.equal(pasos.some((p) => p.paso === 'sentencia'), true, 'SUELO: el rechazo es el de DENTRO del cerrojo');
  assert.equal(escritas.length, 0, '🔴 se ha escrito pese al rechazo');
});

test('SCRUM-1150c · un rechazo que se puede decidir sin esperar no llega a tomar el cerrojo', async () => {
  const { error, pasos } = await crear({ antes: [fila({ quoteNumber: null })] });
  assert.equal(error?.motivo, 'quote_sin_numero', `🔴 CIEGO: se esperaba \`quote_sin_numero\` y llegó: ${error?.message}`);
  assert.deepEqual(pasos.filter((p) => p.paso === 'sentencia' || p.paso === 'quote.create'), [],
    '🔴 un presupuesto sin número ha abierto la transacción antes de ser rechazado');
});
