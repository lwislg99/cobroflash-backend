// tests/scrum815-referido-una-sola-vez.test.mjs — SCRUM-815 (efecto ②: el referido)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA CARRERA, Y LO QUE SE LLEVA: DOS MESES GRATIS POR UN SOLO REFERIDO
//
// `rewardReferralOnFirstPayment` LEE `referralRewardedAt` y DESPUÉS escribe, sin cerrojo. Dos
// entregas simultáneas del mismo primer pago leen `null` las dos, las dos pasan la guarda y las
// dos incrementan `freeMonthsEarned`. El referidor cobra el doble. Está medido en
// `docs/master/SCRUM-815.md`, paso ① §3; aquí no se re-mide: se fija y se cierra.
//
// ── QUÉ ES EL DOBLE DE ESTE FICHERO, Y POR QUÉ NO ES `_envio-doblado.mjs` ────────────────────
//
// **Es un banco de CONCURRENCIA CON ESTADO, no un rodeo.** Durante un tiempo esta cabecera dijo
// que existía por `_envio-doblado.mjs:66` —el `startsWith('$')` que devolvía `undefined` sin
// llamar al callback de `$transaction`—. Eso **ya no es cierto**: SCRUM-855 lo arregló y el doble
// compartido ejecuta el cuerpo de la transacción. El motivo de que este banco siga aquí es otro,
// y es el de abajo.
//
// LO QUE MODELA, enumerado:
//   · **tabla con estado** — lo que se escribe se puede leer de vuelta;
//   · **`{increment}` / `{decrement}`** — la semántica de escritura de Prisma, no un valor fijo;
//   · **el `where`** — `null` y `not`;
//   · **`updateMany` como UPDATE CONDICIONAL ATÓMICO**, que comprueba y escribe sin ceder el
//     turno en medio y devuelve un `{count}` de verdad;
//   · **`cede()`** antes de cada operación — obliga a que dos llamadas concurrentes se intercalen
//     de forma DETERMINISTA, para que la carrera no dependa de la suerte.
//
// 🔴 POR QUÉ NO USA EL COMPARTIDO: **porque el compartido no tiene estado.** Devuelve respuestas
// fijas declaradas por método — tras un `update`, su `findUnique` sigue devolviendo `null`, su
// `updateMany` devuelve `{count: 0}` mirando el `where`, y un `{decrement}` lo pasa tal cual.
// Sin estado, la carrera que este fichero mide **no se puede ni plantear**: no hay una segunda
// lectura que pueda ver —o no ver— lo que escribió la primera.
//
// 🔴 CUÁNDO SE FUNDEN, y es criterio, no preferencia: **si un TERCER test necesita banco de
// concurrencia, se extrae uno común.** Con tres instrumentos vivos la duplicación ya cuesta más
// que la abstracción; con dos, extraer un común obligaría a darle estado al doble de envío —que
// no lo necesita— y a que los tests que hoy lo usan bien cargaran con él. No antes de tres.
//
// ── LO QUE EL DOBLE MODELA, Y LO QUE NO ──────────────────────────────────────────────────────
// Modela lo único que decide: que un UPDATE CONDICIONAL es **atómico** —comprueba y escribe sin
// que nadie se cuele en medio— y devuelve cuántas filas tocó. Eso es lo que Postgres garantiza en
// una sola sentencia y lo que un `findUnique` + `update` por separado NO garantiza.
//
// ⚠️ LÍMITE DECLARADO: es un MODELO, no Postgres. Por eso, además de los controles de conducta,
// hay uno ESTRUCTURAL (§④) que exige que la guarda viaje dentro del `where` del update y que el
// código mire el `count`. Si alguien vuelve a leer-y-luego-escribir, el modelo podría no notarlo
// y el estructural sí.
//
// ⛔ Ninguna base real: ni producción ni staging. Ni una clave.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const requiere = createRequire(import.meta.url);
const RAIZ = path.resolve(import.meta.dirname, '..');
const FUENTE = path.join(RAIZ, 'src/modules/auth/domain/referral.service.ts');

const REFERIDOR = 10;
const REFERIDO = 20;

/** Cede el turno de verdad: obliga a que las dos llamadas se intercalen en vez de ir en fila. */
const cede = () => new Promise((r) => setImmediate(r));

/**
 * Doble mínimo de la base, con la semántica que importa:
 *
 *  · `findUnique` lee  ·  `update` escribe (soporta `{increment}`)
 *  · `updateMany` es el UPDATE CONDICIONAL: comprueba el `where` y escribe **sin ceder el turno
 *    entre las dos cosas**, y devuelve `{count}` — que es justo lo que la base garantiza.
 *  · `$transaction` acepta las DOS formas: array (la de hoy) y callback (la del arreglo).
 *
 * Todas ceden el turno ANTES de actuar, para que dos llamadas concurrentes se intercalen de forma
 * determinista y la carrera no dependa de la suerte.
 */
function dobleDeLaBase(filas) {
  const tabla = new Map(filas.map((f) => [f.id, { ...f }]));

  const aplica = (fila, data) => {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && 'increment' in v) fila[k] = (fila[k] ?? 0) + v.increment;
      else if (v && typeof v === 'object' && 'decrement' in v) fila[k] = (fila[k] ?? 0) - v.decrement;
      else fila[k] = v;
    }
  };
  const casa = (fila, where) => Object.entries(where).every(([k, v]) => {
    if (k === 'id') return fila.id === v;
    if (v === null) return fila[k] == null;
    if (v && typeof v === 'object' && 'not' in v) return v.not === null ? fila[k] != null : fila[k] !== v.not;
    return fila[k] === v;
  });

  const merchant = {
    findUnique: async ({ where }) => { await cede(); const f = tabla.get(where.id); return f ? { ...f } : null; },
    update: async ({ where, data }) => {
      await cede();
      const f = tabla.get(where.id);
      if (!f) throw new Error('no existe');
      aplica(f, data);
      return { ...f };
    },
    // 🔴 EL ARBITRO. Cede ANTES, y después comprueba-y-escribe de una pieza.
    updateMany: async ({ where, data }) => {
      await cede();
      let count = 0;
      for (const f of tabla.values()) if (casa(f, where)) { aplica(f, data); count += 1; }
      return { count };
    },
  };

  const cliente = {
    merchant,
    $transaction: async (arg) => (typeof arg === 'function' ? arg(cliente) : Promise.all(arg)),
  };
  return { cliente, tabla };
}

/** Inyecta el doble y relee el servicio, que capturó el `prisma` bueno al importarse. */
function servicioCon(filas) {
  const { cliente, tabla } = dobleDeLaBase(filas);
  const rutaPrisma = requiere.resolve('../dist/core/db/prisma.js');
  requiere.cache[rutaPrisma] = {
    id: rutaPrisma, filename: rutaPrisma, loaded: true, exports: { prisma: cliente },
  };
  const rutaSrv = requiere.resolve('../dist/modules/auth/domain/referral.service.js');
  delete requiere.cache[rutaSrv];
  const srv = requiere(rutaSrv);
  assert.equal(typeof srv.rewardReferralOnFirstPayment, 'function',
    '🔴 CIEGO: no se encuentra `rewardReferralOnFirstPayment` en `dist/`. Si se movió o cambió de '
    + 'nombre, hay que reapuntar este banco, no borrarlo.');
  return { srv, tabla };
}

const banco = (extra = []) => servicioCon([
  { id: REFERIDOR, freeMonthsEarned: 0, referredBy: null, referralRewardedAt: null },
  { id: REFERIDO, freeMonthsEarned: 0, referredBy: REFERIDOR, referralRewardedAt: null },
  ...extra,
]);

// ═══ ① SUELO — sin esto, «un solo mes» podría ser «ninguno» ═══════════════════════════════

test('SCRUM-815 · 🔴 SUELO: un primer pago recompensa UNA vez, y se nota', async () => {
  const { srv, tabla } = banco();
  await srv.rewardReferralOnFirstPayment(REFERIDO);

  assert.equal(tabla.get(REFERIDOR).freeMonthsEarned, 1,
    '🔴 CIEGO: el referidor no ha ganado NINGÚN mes. Si el detector no ve una recompensa, todo lo '
    + 'de abajo —«no gana dos», «la segunda no toca nada»— se cumpliría sobre un sistema que no '
    + 'recompensa nunca, y eso no es el producto.');
  assert.ok(tabla.get(REFERIDO).referralRewardedAt,
    '🔴 el referido no queda marcado como ya recompensado: la segunda entrega volvería a pagar.');
});

// ═══ ② LA CARRERA ════════════════════════════════════════════════════════════════════════

test('SCRUM-815 · 🔴 dos entregas SIMULTÁNEAS del mismo primer pago → UN mes, no dos', async () => {
  const { srv, tabla } = banco();

  // Simultáneas de verdad: las dos leen antes de que ninguna escriba. Es lo que pasa cuando dos
  // entregas del mismo webhook caen a la vez, o cuando hay dos réplicas.
  await Promise.all([
    srv.rewardReferralOnFirstPayment(REFERIDO),
    srv.rewardReferralOnFirstPayment(REFERIDO),
  ]);

  assert.equal(tabla.get(REFERIDOR).freeMonthsEarned, 1,
    `🔴 EL REFERIDOR SE HA LLEVADO ${tabla.get(REFERIDOR).freeMonthsEarned} MESES GRATIS POR UN `
    + 'SOLO REFERIDO. Las dos entregas leyeron `referralRewardedAt: null` y las dos incrementaron: '
    + 'leer y luego escribir no es un cerrojo. Esto es dinero de la casa, y se regala solo.');
});

// ═══ ③ QUE DECIDE LA BASE: LA SEGUNDA NO TOCA NINGUNA FILA ═══════════════════════════════

test('SCRUM-815 · ✅ la segunda llamada afecta a CERO filas — decide la base, no el código', async () => {
  const { srv, tabla } = banco();
  await srv.rewardReferralOnFirstPayment(REFERIDO);
  const tras1 = tabla.get(REFERIDOR).freeMonthsEarned;

  await srv.rewardReferralOnFirstPayment(REFERIDO);
  assert.equal(tabla.get(REFERIDOR).freeMonthsEarned, tras1,
    '🔴 la segunda llamada ha vuelto a incrementar. La condición tiene que viajar DENTRO del '
    + 'UPDATE para que la base sea la que decide y no quede ventana.');
});

// ═══ ④ CONTROL POSITIVO — romperlo por el lado bueno también es romperlo ══════════════════

test('SCRUM-815 · ✅ POSITIVO: dos referidos DISTINTOS siguen dando un mes CADA UNO', async () => {
  const OTRO = 30;
  const { srv, tabla } = banco([
    { id: OTRO, freeMonthsEarned: 0, referredBy: REFERIDOR, referralRewardedAt: null },
  ]);

  await srv.rewardReferralOnFirstPayment(REFERIDO);
  await srv.rewardReferralOnFirstPayment(OTRO);

  assert.equal(tabla.get(REFERIDOR).freeMonthsEarned, 2,
    `🔴 dos referidos distintos han dado ${tabla.get(REFERIDOR).freeMonthsEarned} mes(es). La `
    + 'deduplicación se ha comido una recompensa LEGÍTIMA: el referidor trabajó y no cobra. Eso es '
    + 'romper el producto por el lado bueno, y se nota menos que el defecto — por eso este control.');
});

test('SCRUM-815 · ✅ POSITIVO: sin referidor no se recompensa a nadie', async () => {
  const { srv, tabla } = servicioCon([
    { id: REFERIDO, freeMonthsEarned: 0, referredBy: null, referralRewardedAt: null },
  ]);
  await srv.rewardReferralOnFirstPayment(REFERIDO);
  assert.equal(tabla.get(REFERIDO).referralRewardedAt, null,
    '🔴 un merchant SIN referidor ha quedado marcado como recompensado.');
});

// ═══ ⑤ ESTRUCTURAL — el modelo no es Postgres, así que se exige la FORMA ══════════════════

test('SCRUM-815 · 🔴 la guarda viaja DENTRO del update, y el código MIRA el `count`', () => {
  // El doble de arriba es un modelo. Este control no depende de él: lee la fuente y exige la
  // forma que hace segura la concurrencia — la misma de `recapitulativa.service.ts:118`, que el
  // máster llama «el guard anti-doble-consolidación… lo que hace segura la concurrencia».
  const src = fs.readFileSync(FUENTE, 'utf8');
  const fn = src.slice(src.indexOf('export async function rewardReferralOnFirstPayment'));
  assert.ok(fn.length > 0, '🔴 CIEGO: no se encuentra la función en la fuente.');

  assert.match(fn, /updateMany\(/,
    '🔴 `rewardReferralOnFirstPayment` ya no usa un UPDATE CONDICIONAL. Si vuelve a leer y luego '
    + 'escribir, vuelve la carrera: dos entregas simultáneas regalan dos meses.');
  assert.match(fn, /referralRewardedAt:\s*null/,
    '🔴 la guarda `referralRewardedAt: null` ha desaparecido del `where`. Sin ella el UPDATE no '
    + 'discrimina y la atomicidad no sirve de nada.');
  assert.match(fn, /\.count\s*!==\s*1|\.count\s*===\s*0|count\s*!==\s*1/,
    '🔴 el código NO mira cuántas filas afectó el update. Un update que no comprueba su propio '
    + 'resultado vuelve a tener el mismo problema con otra forma: escribiría la recompensa igual, '
    + 'aunque otra entrega se hubiera adelantado.');
});
