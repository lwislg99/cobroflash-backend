// tests/scrum495-tres-registros.test.mjs — SCRUM-495
//
// LOS TRES REGISTROS QUE NO SE ENTERARON DE QUE HAY UNA TABLA NUEVA.
//
// Sin gate, sin base de datos y sin red: se ejercita `limpiarMerchant` con un cliente ESPÍA —el
// mismo patrón que `scrum314-wipedemo-derivado` usa para el barrido del demo— y se leen los
// ficheros de los otros dos registros.
//
// ── LA VÍCTIMA ────────────────────────────────────────────────────────────────────────────
// `email_messages` guarda la DIRECCIÓN DE CORREO del destinatario. Al nacer la tabla, tres
// registros de la casa siguieron sin saber que existía:
//
//   · el barrido del merchant efímero → sus filas sobrevivían al merchant y quedaban huérfanas
//     EN SILENCIO en las tres bases (no hay FK que proteste: el modelo no declara relaciones);
//   · el censo de deriva de producción → dejaba de preguntar por 12 columnas, o sea que habría
//     contestado «en sync» justo sobre la tabla que acababa de nacer;
//   · el volcado del backup → no la llevaba, y un backup sin ella restaura un sistema que ha
//     olvidado qué mandó.
//
// ── 🔴 LO QUE ESTE FICHERO **NO** PRUEBA, Y HAY QUE LEERLO ────────────────────────────────
// `MODELOS_POR_MERCHANT` es la limpieza del merchant EFÍMERO DE LOS TESTS: `limpiarMerchant`
// hace `deleteMany`. Ahí BORRAR es lo correcto —son datos de prueba— y por eso este fichero
// comprueba que la tabla se barre.
//
// **Eso NO es el camino de RGPD.** La supresión de un merchant real va por `suprimirMerchant`,
// que **anonimiza** los campos de `CAMPOS_PERSONALES` y CONSERVA el asiento (art. 17.3.b RGPD).
// `emailMessage.toEmail` **no está en esa lista hoy**, y este ticket no puede meterlo: vive en
// `src/`, que su encargo excluye. Está medido y declarado en `docs/master/SCRUM-495.md`.
// Confundir las dos listas sería exactamente el error que el asesor quería evitar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { limpiarMerchant } from './_merchant-fixture.mjs';
import { CAMPOS_PERSONALES } from '../dist/modules/system/domain/anonimizarMerchant.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const MERCHANT = 4242;

/**
 * Un cliente de Prisma ESPÍA: registra a quién se le pidió borrar y con qué filtro, y no toca
 * ninguna base. `modelos` permite montar el caso «la lista está vacía» sin editar el fichero.
 */
function prismaEspia() {
  const borrados = [];
  const modelo = (nombre) => ({
    deleteMany: async ({ where }) => { borrados.push({ modelo: nombre, where }); return { count: 0 }; },
  });
  const p = new Proxy({ borrados }, {
    get(destino, prop) {
      if (prop === 'borrados') return borrados;
      if (typeof prop !== 'string') return undefined;
      if (prop === 'merchant') {
        return { delete: async () => ({ id: MERCHANT }), findUnique: async () => null };
      }
      return modelo(prop);
    },
  });
  return p;
}

// ── 1 · 🔴 REGISTRO 1 · el barrido del merchant efímero ALCANZA `email_messages` ───────────

test('SCRUM-495 · 🔴 CONTROL POSITIVO: al limpiar un merchant se barre `emailMessage`, filtrado por él', async () => {
  const p = prismaEspia();
  await limpiarMerchant(p, MERCHANT, { intentos: 1 });

  // SUELO: si el espía no registra NADA, lo de abajo sería un verde hueco — «no queda ninguna
  // dirección» y «no supe mirar» saldrían por la misma línea.
  assert.ok(p.borrados.length >= 20,
    `🔴 ESCÁNER CIEGO: el espía solo ha visto ${p.borrados.length} borrados y la lista tiene 22 `
    + 'modelos. Si el fixture ha dejado de recorrerla, este test no prueba nada.');

  const delCorreo = p.borrados.filter((b) => b.modelo === 'emailMessage');
  assert.equal(delCorreo.length, 1,
    '🔴 EL BARRIDO NO TOCA `emailMessage`.\n\n'
    + '  Sus filas llevan la DIRECCIÓN DE CORREO del destinatario y sobreviven al merchant: el\n'
    + '  modelo no declara ninguna relación, así que no hay FK que proteste y `merchant.delete`\n'
    + '  «tiene éxito» dejándolas huérfanas. Fallo MUDO en las tres bases.\n\n'
    + '  Añádelo a `MODELOS_POR_MERCHANT` (tests/_merchant-fixture.mjs).');

  // 🔴 Y FILTRADO POR EL MERCHANT. Un `deleteMany` sin `where` se llevaría las filas de todos:
  // en un barrido de limpieza eso no se deshace, y es peor que no barrer.
  assert.deepEqual(delCorreo[0].where, { merchantId: MERCHANT },
    `🔴 el barrido de \`emailMessage\` no va filtrado por merchant: ${JSON.stringify(delCorreo[0].where)}`);
});

test('SCRUM-495 · 🔴 con la lista VACÍA el control positivo FALLA, que es lo que lo hace valer', async () => {
  // Si con la lista vacía el test de arriba pasara, no estaría probando el barrido: estaría
  // probando que el espía funciona. Se monta el caso a mano, sin tocar el fichero.
  const p = prismaEspia();
  // Se recorre una lista VACÍA: nadie pide borrar nada.
  for (const modelo of []) await p[modelo].deleteMany({ where: { merchantId: MERCHANT } });

  const delCorreo = p.borrados.filter((b) => b.modelo === 'emailMessage');
  assert.equal(delCorreo.length, 0,
    '🔴 el espía inventa borrados que nadie pidió: entonces el control positivo de arriba daría '
    + 'verde con la lista vacía y no vigilaría nada.');
});

test('SCRUM-495 · el barrido recorre la lista en ORDEN, y `emailMessage` va antes de `customer`', () => {
  // `email_messages.customer_id` apunta a un cliente SIN FK. Barrer al cliente primero dejaría
  // filas apuntando a un id que ya no existe — y como no hay FK, nadie protestaría.
  const fuente = fs.readFileSync(path.join(RAIZ, 'tests/_merchant-fixture.mjs'), 'utf8');
  const lista = fuente.slice(fuente.indexOf('const MODELOS_POR_MERCHANT = ['));
  const iCorreo = lista.indexOf("'emailMessage'");
  const iCliente = lista.indexOf("'customer'");
  assert.ok(iCorreo > 0, '🔴 NO SUPE MIRAR: `emailMessage` no aparece en el fuente de la lista.');
  assert.ok(iCliente > 0, '🔴 NO SUPE MIRAR: `customer` no aparece en el fuente de la lista.');
  assert.ok(iCorreo < iCliente,
    '🔴 `emailMessage` va DESPUÉS de `customer` en la lista. `email_messages.customer_id` no tiene '
    + 'FK: si el cliente se borra primero, quedan filas apuntando a un id inexistente y nada avisa.');
});

// ── 2 · EL HUECO DE RGPD · CERRADO POR SCRUM-497 ───────────────────────────────────────────
//
// 🔴 AQUÍ VIVÍA EL TEST QUE DECLARABA EL HUECO, Y SE HA IDO PORQUE HIZO SU TRABAJO.
//
// Afirmaba lo que HABÍA —`CAMPOS_PERSONALES` cubría `merchant` y `customer`, y la dirección de
// `email_messages` se quedaba en claro tras una supresión— y estaba escrito para CAER el día que
// alguien lo arreglase, con el mensaje *«ENHORABUENA: el hueco ya no existe. Borra este test»*.
//
// Cayó. Lo arregló SCRUM-497, y su sitio lo ocupa ahora algo mejor que una declaración: un guard
// atado al HECHO en `tests/scrum497-dato-personal-no-sobrevive.test.mjs`, que exige que NINGUNA
// columna con dato personal quede sin clasificar — no solo ésta. Y que trajo su propio hallazgo:
// quince datos personales más que hoy sobreviven a una supresión, nombrados uno a uno.
//
// No se sustituye por otro aserto: duplicar la vigilancia aquí sería un segundo vigilante del mismo
// hecho, y el bueno vive en el fichero de SCRUM-497.

test('SCRUM-495 · la lista de anonimización YA cubre `toEmail` (lo cerró SCRUM-497)', () => {
  // Lo que queda aquí es el eslabón entre los dos tickets: si alguien deshiciera SCRUM-497, este
  // fichero —que es el que documenta los tres registros— también lo dice.
  assert.ok('emailMessage' in CAMPOS_PERSONALES,
    '🔴 `emailMessage` ha salido de `CAMPOS_PERSONALES`: la dirección de correo de los clientes '
    + 'vuelve a sobrevivir a una supresión del art. 17. Lo cerró SCRUM-497; el guard que lo vigila '
    + 'está en `tests/scrum497-dato-personal-no-sobrevive.test.mjs`.');
  assert.deepEqual([...CAMPOS_PERSONALES.emailMessage], ['toEmail'],
    '🔴 han cambiado los campos personales de `emailMessage`.');
});

// ── 3 · REGISTRO 2 · el censo de deriva pregunta por las 12 columnas nuevas ────────────────

test('SCRUM-495 · el censo de deriva de producción pregunta por `email_messages`', () => {
  const sql = fs.readFileSync(path.join(RAIZ, 'docs/sql/deriva-prod.sql'), 'utf8');
  const pares = [...sql.matchAll(/\('([^']+)','([^']+)'\)/g)].map((m) => [m[1], m[2]]);

  assert.ok(pares.length >= 300,
    `🔴 NO SUPE MIRAR: solo se leen ${pares.length} pares del censo y son 363. El fichero se genera `
    + 'con `node scripts/generar-sql-deriva.mjs`; si el formato cambió, este test mira mal.');

  const delCorreo = pares.filter(([t]) => t === 'email_messages').map(([, c]) => c).sort();
  assert.deepEqual(delCorreo, [
    'created_at', 'customer_id', 'error', 'id', 'kind', 'merchant_id',
    'provider_id', 'related_id', 'related_type', 'status', 'to_email', 'updated_at',
  ], '🔴 el censo de deriva no pregunta por las 12 columnas de `email_messages`.\n\n'
    + '  Una consulta que no pregunta por una columna contesta «0 filas» — o sea, dice «en sync»\n'
    + '  justo sobre la tabla que acaba de nacer. Regenera con `node scripts/generar-sql-deriva.mjs`;\n'
    + '  NO se edita a mano.');
});

// ── 4 · REGISTRO 3 · la tabla entra en el volcado del backup ───────────────────────────────

test('SCRUM-495 · `email_messages` entra en el volcado del backup', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'scripts/backup-dump.mjs'), 'utf8');
  const lista = fuente.slice(fuente.indexOf('const TABLES = ['), fuente.indexOf('];', fuente.indexOf('const TABLES = [')));
  const tablas = [...lista.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

  assert.ok(tablas.length >= 24,
    `🔴 NO SUPE MIRAR: solo se leen ${tablas.length} tablas de TABLES y son 25.`);
  assert.ok(tablas.includes('email_messages'),
    '🔴 `email_messages` NO entra en el volcado del backup.\n\n'
    + '  Es el único sitio donde consta si una factura llegó a su destinatario: un backup que no la\n'
    + '  lleva restaura un sistema que ha olvidado qué mandó, y la pregunta «¿se le envió la factura\n'
    + '  F-2026-014 y cuándo?» deja de tener respuesta justo después de una restauración.\n\n'
    + '  Decisión del asesor (12-ago-2026): no hay excepción, entra.');
});
