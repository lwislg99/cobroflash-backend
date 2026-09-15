// tests/scrum856-canje-una-sola-vez.test.mjs — SCRUM-856
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA MISMA CARRERA QUE EL REFERIDO, Y TAMBIÉN ES DINERO
//
// `redeemFreeMonth` LEE `freeMonthsEarned`, comprueba `< 1` en JavaScript y DESPUÉS escribe un
// `decrement: 1`. Entre el `if` y el `update` no hay nada. Dos canjes simultáneos pasan los dos.
//
// Nace del censo de rebote de SCRUM-815, donde se midió y NO se tocó (regla 9).
//
// ── LA TRAMPA DEL BANCO, QUE AQUÍ MUERDE IGUAL ───────────────────────────────────────────────
// 🔴 `tests/_envio-doblado.mjs:66` corta todo lo que empieza por `$`:
//     if (nombre.startsWith('$')) return async () => undefined;
// O sea que `$transaction(cb)` devuelve `undefined` **sin llamar a `cb`**. El arreglo mete el
// trabajo DENTRO de una transacción: con ese doble, este fichero pasaría en verde sin ejecutar
// una sola línea del arreglo. Por eso hay doble propio. (Ese defecto tiene su ticket, SCRUM-855;
// aquí no se toca.)
//
// ── LO QUE EL DOBLE MODELA, Y LO QUE NO ──────────────────────────────────────────────────────
//  · un UPDATE CONDICIONAL es ATÓMICO: comprueba y escribe sin que nadie se cuele, y devuelve
//    `count` — lo que Postgres garantiza en una sentencia y un `findUnique`+`update` no;
//  · dos transacciones que tocan la MISMA fila **se serializan**, que es lo que hace el cerrojo
//    de fila de Postgres: la segunda espera a que la primera confirme y re-evalúa su `where`.
//
// ⚠️ LÍMITE DECLARADO: es un MODELO, no Postgres. Por eso el banco lleva además un control
// ESTRUCTURAL (§⑤) que no depende de él, y una MUTACIÓN que lo pone a prueba.
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

const MERCHANT = 77;
const DIA = 24 * 60 * 60 * 1000;

const cede = () => new Promise((r) => setImmediate(r));

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
    if (v && typeof v === 'object') {
      if ('gte' in v) return (fila[k] ?? 0) >= v.gte;
      if ('gt' in v) return (fila[k] ?? 0) > v.gt;
      if ('not' in v) return v.not === null ? fila[k] != null : fila[k] !== v.not;
    }
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
    updateMany: async ({ where, data }) => {
      await cede(); // cede ANTES; después comprueba-y-escribe de una pieza
      let count = 0;
      for (const f of tabla.values()) if (casa(f, where)) { aplica(f, data); count += 1; }
      return { count };
    },
  };

  // 🔴 EL CERROJO DE FILA, MODELADO: dos transacciones sobre la misma fila NO se intercalan.
  let cola = Promise.resolve();
  const cliente = {
    merchant,
    $transaction: async (arg) => {
      if (typeof arg !== 'function') return Promise.all(arg);
      const mio = cola.then(() => arg(cliente));
      cola = mio.then(() => undefined, () => undefined);
      return mio;
    },
  };
  return { cliente, tabla };
}

function servicioCon(filas) {
  const { cliente, tabla } = dobleDeLaBase(filas);
  const rutaPrisma = requiere.resolve('../dist/core/db/prisma.js');
  requiere.cache[rutaPrisma] = {
    id: rutaPrisma, filename: rutaPrisma, loaded: true, exports: { prisma: cliente },
  };
  const rutaSrv = requiere.resolve('../dist/modules/auth/domain/referral.service.js');
  delete requiere.cache[rutaSrv];
  const srv = requiere(rutaSrv);
  assert.equal(typeof srv.redeemFreeMonth, 'function',
    '🔴 CIEGO: no se encuentra `redeemFreeMonth` en `dist/`. Si se movió o cambió de nombre, hay '
    + 'que reapuntar este banco, no borrarlo.');
  return { srv, tabla };
}

const banco = (creditos, planExpiresAt = null) =>
  servicioCon([{ id: MERCHANT, freeMonthsEarned: creditos, planExpiresAt }]);

/** Días de extensión que ha ganado la cuenta respecto a «ahora». */
const diasGanados = (fila, desde) =>
  fila.planExpiresAt ? Math.round((fila.planExpiresAt.getTime() - desde) / DIA) : 0;

// ═══ ① SUELO — sin esto, «no canjea dos veces» podría ser «no canjea nunca» ═══════════════

test('SCRUM-856 · 🔴 SUELO: un canje con un crédito DESCUENTA y extiende 30 días', async () => {
  const antes = Date.now();
  const { srv, tabla } = banco(1);
  const r = await srv.redeemFreeMonth(MERCHANT);

  assert.equal(r.ok, true, `🔴 CIEGO: un canje legítimo no se ha hecho (${r.reason}). Si el `
    + 'detector no ve NINGÚN canje, todo lo de abajo se cumpliría sobre un sistema que no canjea '
    + 'nunca — y eso no es el producto, es otro defecto.');
  assert.equal(tabla.get(MERCHANT).freeMonthsEarned, 0, '🔴 el crédito no se ha descontado.');
  assert.equal(diasGanados(tabla.get(MERCHANT), antes), 30,
    '🔴 no se han extendido 30 días: el canje no vale nada.');
});

test('SCRUM-856 · 🔴 SUELO: sin crédito NO se canja, y lo dice', async () => {
  const { srv, tabla } = banco(0);
  const r = await srv.redeemFreeMonth(MERCHANT);
  assert.equal(r.ok, false, '🔴 se ha canjeado sin crédito.');
  assert.equal(r.reason, 'no_credit', `🔴 el motivo no es «no_credit» sino «${r.reason}».`);
  assert.equal(tabla.get(MERCHANT).freeMonthsEarned, 0, '🔴 el saldo se ha movido sin crédito.');
});

// ═══ ② LA CARRERA, CON UN SOLO CRÉDITO ═══════════════════════════════════════════════════

test('SCRUM-856 · 🔴 dos canjes SIMULTÁNEOS con UN crédito → el saldo NUNCA queda negativo', async () => {
  const { srv, tabla } = banco(1);

  const [a, b] = await Promise.all([srv.redeemFreeMonth(MERCHANT), srv.redeemFreeMonth(MERCHANT)]);

  const saldo = tabla.get(MERCHANT).freeMonthsEarned;
  assert.ok(saldo >= 0,
    `🔴 EL SALDO HA QUEDADO EN ${saldo}. Los dos canjes leyeron el mismo crédito, los dos pasaron `
    + 'la guarda y los dos descontaron. Un saldo negativo es un estado imposible: no se llega a él '
    + 'canjeando, se llega porque leer-y-luego-escribir no es un cerrojo.');
  assert.equal(saldo, 0, `🔴 con un crédito y dos canjes el saldo tiene que quedar en 0, y está en ${saldo}.`);

  const oks = [a.ok, b.ok].filter(Boolean).length;
  assert.equal(oks, 1,
    `🔴 ${oks} de los dos canjes se han dado por buenos con UN solo crédito. Exactamente uno tiene `
    + 'que ganar y el otro recibir «no_credit».');
});

// ═══ ③ LA OTRA CARA: DOS CRÉDITOS TIENEN QUE DAR DOS MESES ═══════════════════════════════

test('SCRUM-856 · 🔴 dos canjes SIMULTÁNEOS con DOS créditos dan 60 días, no 30', async () => {
  // Esta es la cara que más se paga en silencio: los dos créditos se gastan, pero si los dos
  // calculan la nueva fecha sobre la MISMA lectura, los dos escriben el mismo valor absoluto y el
  // segundo mes se evapora. El merchant paga dos y se lleva uno.
  const antes = Date.now();
  const { srv, tabla } = banco(2);

  await Promise.all([srv.redeemFreeMonth(MERCHANT), srv.redeemFreeMonth(MERCHANT)]);

  const fila = tabla.get(MERCHANT);
  assert.equal(fila.freeMonthsEarned, 0, '🔴 no se han gastado los dos créditos.');
  assert.equal(diasGanados(fila, antes), 60,
    `🔴 se han gastado DOS créditos y la cuenta sólo se ha extendido ${diasGanados(fila, antes)} `
    + 'días. Los dos canjes calcularon la fecha nueva sobre la misma lectura y escribieron el mismo '
    + 'valor absoluto: el segundo mes desaparece sin que nadie lo note. El merchant paga dos y se '
    + 'lleva uno.');
});

// ═══ ④ QUE DECIDE LA BASE ════════════════════════════════════════════════════════════════

test('SCRUM-856 · ✅ la segunda llamada afecta a CERO filas y devuelve «no_credit»', async () => {
  const { srv, tabla } = banco(1);
  const primera = await srv.redeemFreeMonth(MERCHANT);
  const segunda = await srv.redeemFreeMonth(MERCHANT);

  assert.equal(primera.ok, true, '🔴 la primera no ha canjeado.');
  assert.equal(segunda.ok, false, '🔴 la segunda ha vuelto a canjear con el saldo ya a 0.');
  assert.equal(segunda.reason, 'no_credit');
  assert.equal(tabla.get(MERCHANT).freeMonthsEarned, 0);
});

test('SCRUM-856 · ✅ POSITIVO: dos créditos EN SERIE siguen canjeándose los dos', async () => {
  // Comerse el segundo canje sería romper el producto por el lado bueno: el merchant ganó dos
  // meses y sólo cobraría uno. Se nota menos que el defecto, y por eso este control existe.
  const antes = Date.now();
  const { srv, tabla } = banco(2);
  const a = await srv.redeemFreeMonth(MERCHANT);
  const b = await srv.redeemFreeMonth(MERCHANT);

  assert.ok(a.ok && b.ok, '🔴 uno de los dos canjes legítimos ha sido rechazado.');
  assert.equal(tabla.get(MERCHANT).freeMonthsEarned, 0);
  assert.equal(diasGanados(tabla.get(MERCHANT), antes), 60,
    '🔴 dos canjes en serie no dan 60 días: el segundo mes se ha perdido.');
});

test('SCRUM-856 · ✅ POSITIVO: si la suscripción sigue vigente, se extiende DESDE su fin', async () => {
  // La regla de negocio que ya existía y el arreglo no puede llevarse por delante.
  const futuro = new Date(Date.now() + 10 * DIA);
  const antes = Date.now();
  const { srv, tabla } = banco(1, futuro);
  await srv.redeemFreeMonth(MERCHANT);
  assert.equal(diasGanados(tabla.get(MERCHANT), antes), 40,
    '🔴 la extensión no ha partido de la expiración vigente: se han regalado o comido días.');
});

// ═══ ⑤ ESTRUCTURAL — el doble es un modelo; la forma no depende de él ═════════════════════

test('SCRUM-856 · 🔴 la guarda viaja DENTRO del update, y el código MIRA el `count`', () => {
  const src = fs.readFileSync(FUENTE, 'utf8');
  const i = src.indexOf('export async function redeemFreeMonth');
  assert.ok(i >= 0, '🔴 CIEGO: no se encuentra `redeemFreeMonth` en la fuente.');
  const fn = src.slice(i, src.indexOf('\nexport ', i + 10) >>> 0 || undefined);

  assert.match(fn, /updateMany\(/,
    '🔴 `redeemFreeMonth` ya no usa un UPDATE CONDICIONAL. Si vuelve a leer y luego escribir, '
    + 'vuelve la carrera: dos canjes simultáneos dejan el saldo en negativo.');
  assert.match(fn, /freeMonthsEarned:\s*\{\s*gte:\s*1\s*\}/,
    '🔴 la guarda `freeMonthsEarned: { gte: 1 }` ha desaparecido del `where`. Sin ella el UPDATE no '
    + 'discrimina y la atomicidad no sirve de nada.');
  assert.match(fn, /count\s*!==\s*1|count\s*===\s*0/,
    '🔴 el código NO mira cuántas filas afectó el update. Un update que no comprueba su propio '
    + 'resultado tiene el mismo defecto con otra forma: descontaría igual.');
});

test('SCRUM-856 · 🔴 el comentario no promete lo que el código no cumple', () => {
  // 🔒 Un comentario que afirma una propiedad que el código no tiene es PEOR que no tenerlo: el
  // siguiente que lo lea no va a comprobarlo, ya se lo han dicho. El de aquí decía «Idempotente
  // por crédito» mientras la carrera lo desmentía. No se borra: se corrige.
  const src = fs.readFileSync(FUENTE, 'utf8');
  const i = src.indexOf('export async function redeemFreeMonth');
  const cabecera = src.slice(Math.max(0, i - 1400), i);

  assert.ok(!/Idempotente por crédito\./.test(cabecera),
    '🔴 sigue ahí «Idempotente por crédito.» a secas. Esa frase afirmaba una propiedad que el '
    + 'código no tenía. Corrígela para que diga QUÉ la garantiza; no la borres, que el lector '
    + 'siguiente necesita saber que la propiedad se busca a propósito.');
  assert.match(cabecera, /updateMany|condicional|count/i,
    '🔴 la cabecera ya no explica QUÉ hace seguro el canje. Sin eso, el próximo que lo lea puede '
    + '«simplificar» el UPDATE condicional a un `update` normal sin saber qué está quitando.');
});
