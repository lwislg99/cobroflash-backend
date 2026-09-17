// SCRUM-330 · EL CONTADOR CUENTA LO QUE DICE: plazas VENDIDAS, no filas con un campo puesto.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, medido en SCRUM-327
//
// «Quedan 18 de 20 plazas» le dice al visitante que **dos profesionales ya compraron**. Debajo,
// el dato era `merchant.count({ plan: 'founding' })` — el CAMPO. Y ese campo lo deja puesto el
// webhook de Stripe en tres situaciones, no una (`stripe.routes.ts:110-124`):
//
//   · `active`                → pagó                      ✔
//   · `trialing`              → NO se ha cobrado nada     ✗  (mapea a subscriptionStatus 'active')
//   · `past_due` / `unpaid`   → el cobro FALLÓ            ✗  (el plan se CONSERVA a propósito)
//
// …más cualquier fila puesta a mano o por seed, que ni siquiera tiene `subscriptionStatus`.
// O sea: una prueba social sobre gente que no ha comprado. Es material publicado, y por eso
// no espera al rediseño.
//
// LA PIEZA QUE FALTABA YA ESTABA AL LADO: `subscriptionStatus` distingue los tres estados y el
// contador no lo miraba.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS TRES REGLAS QUE SE CONSTRUYEN
//
//   1. Solo cuenta la suscripción ACTIVA de verdad.
//   2. Con CERO vendidas no se pinta la escasez. «Quedan 20 de 20» no comunica escasez:
//      comunica que no ha comprado nadie — y encima lo comunica en voz alta.
//   3. Si el dato NO se puede leer, NO se pinta un número por defecto: se oculta. Un contador
//      que falla y enseña «20» es peor que uno ausente, porque el visitante no puede saber que
//      está viendo un valor inventado.
//
// ⚠️ LO QUE ESTE TEST NO TOCA, y hay que decirlo porque comparte elemento: **la OFERTA**
// («9,90 €/mes para siempre», el tachado, las condiciones) NO es de este ticket. En
// `index.html` la escasez y la oferta viven en el MISMO bloque, así que la escasez se gobierna
// por separado — si se gateara el bloque entero, con cero ventas desaparecería también el
// precio founding y nadie podría comprarlo. Eso sería cambiar el producto, no arreglar el dato.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const { getFoundingStatus, FOUNDING_SEATS } = await import(DIST + 'modules/billing/domain/founding.js');

const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

/** Prisma de doble que apunta el `where` con el que se cuenta y devuelve lo que le digan. */
function prismaQueCuenta(devuelve) {
  const vistos = [];
  moduloPrisma.prisma.merchant = {
    count: async (args) => { vistos.push(args?.where); return devuelve; },
  };
  return vistos;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// REGLA 1 · el criterio: activa de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 AQUÍ VIVÍAN LOS DOS CASOS DE LA REGLA 1, Y SE FUERON EL 8-SEP-2026. Cada uno por un
// motivo distinto, y los dos escritos aquí para que no haya que reconstruirlos.
//
// ── ① «una plaza ocupada exige suscripción ACTIVA» · RETIRADO POR DECISIÓN DEL FUNDADOR ──
//
// Decisión del fundador, 8-sep-2026, literal:
//
//   «la plaza se queda con él; si se retrasa en un pago tiene un tiempo para pagarla, y si no,
//    esa plaza desaparece con el merchant».
//
// Ese caso exigía `subscriptionStatus: 'active'` en el criterio, o sea que un `past_due` —alguien
// que COMPRÓ y va retrasado en un cobro— liberaba su plaza. La firma de arriba dice lo contrario:
// la plaza no se libera ni al cancelar ni por un cobro fallido. **El caso no se ha relajado: se ha
// quedado sin premisa.** Y la decisión va DENTRO del test, no en un mensaje de commit, porque un
// corte justificado por una decisión que no se puede leer aquí es una opinión con fecha de
// caducidad invisible.
//
// ── ② «el estado NO se deduce del plan: son dos columnas» · SE MUDÓ, y sigue vigente ──────
//
// 🔒 Lo que protegía —«`plan` dice QUÉ compró y `subscriptionStatus` dice SI sigue pagando:
// ninguna sustituye a la otra»— **NO se ha retirado: es lo que sostiene el ticket entero.** Lo
// que caducó fue la FORMA que miraba: contaba las claves de un `where` de dos columnas, y ése
// dejó de ser el mecanismo.
//
// Hoy lo vigila `tests/scrum340-la-plaza-comprada.test.mjs`, contra el par NUEVO
// (`founding_purchased_at`, `subscriptionStatus`) y sobre la regla pura `plazaOcupada`:
//   · «⛔ el predicado NO lee `plan` ni `subscriptionStatus` — son OTRA columna»
//   · «🔴 EL CONTROL QUE DECIDE: un suscriptor PRO activo NO ocupa plaza de fundador»
//
// NO se ha dejado aquí una copia a propósito. La misma regla escrita en dos sitios es cómo una de
// las dos se queda atrás, y ésta ya se quedó atrás una vez: el criterio por ESTADO que proponía
// `scrum-340-contador-plazas-reales` hacía que **cada suscriptor PRO activo ocupara una plaza de
// fundador** (medido el 8-sep-2026), que es el bug de SCRUM-327 entrando por la otra puerta.
//
// ⚠️ MIENTRAS TANTO, y esto es un HUECO DECLARADO: `getFoundingStatus` sigue contando con
// `PLAZA_OCUPADA` —el criterio viejo— hasta que exista `merchants.founding_purchased_at`. El ALTER
// está escrito y SIN APLICAR (`docs/sql/scrum-340-la-plaza-comprada.sql`) porque
// `prisma/schema.prisma` es del fundador. Hoy eso no publica ninguna mentira: nadie ha comprado
// plaza (SCRUM-41 abierto, cero clientes de pago), así que la landing dice «20 de 20» y es cierto.
// Lo retira: quien cablee el contador a la columna, que tendrá que traerse aquí un test del
// CONTADOR — este fichero vigila lo que PINTA cada página, y aquél vigilará lo que CUENTA.
// ═════════════════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════════════════
// REGLA 2 y 3 · lo que el navegador PINTA, ejecutando la condición real de cada página
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Extrae la condición que decide si se pinta la escasez, y la vuelve ejecutable. */
function condicionDe(fichero, patron) {
  const src = leer('public', fichero);
  const m = src.match(patron);
  assert.ok(
    m,
    `🔴 no encuentro la condición del contador en ${fichero}. Si cambió de forma, este test ` +
      'dejaría de comprobar nada y pasaría en verde: por eso falla aquí en vez de seguir.',
  );
  // Cada página llama a su respuesta con un nombre (`s` en index, `f` en precios). Se declaran los
  // dos y se pasa el MISMO objeto: así la expresión se ejecuta tal cual está escrita, sin
  // reescribirla — que es lo único que hace fiable extraerla en vez de leerla.
  return (respuesta) => new Function('s', 'f', `return !!(${m[1]});`)(respuesta, respuesta);
}

// La decisión se llama IGUAL en las dos páginas a propósito: es la misma propiedad, y así se
// extrae con el mismo patrón. Si una de las dos se renombra, el test no la encuentra y falla
// nombrando el fichero — en vez de comprobar una y dar por buena la otra.
const CONDICIONES = [
  ['index.html', /var pintarPlazas = ([^;]+);/],
  ['precios.html', /var pintarPlazas = ([^;]+);/],
];

for (const [fichero, patron] of CONDICIONES) {
  test(`SCRUM-330 · ${fichero}: con CERO vendidas NO se pinta la escasez`, () => {
    const pinta = condicionDe(fichero, patron);
    assert.equal(
      pinta({ seatsLeft: FOUNDING_SEATS, seatsTotal: FOUNDING_SEATS, taken: 0 }), false,
      `🔴 ${fichero} pinta «quedan 20 de 20» sin una sola venta. Eso no comunica escasez: ` +
        'comunica que no ha comprado nadie, y lo dice en el sitio donde se presume lo contrario.',
    );
  });

  test(`SCRUM-330 · ${fichero}: con ventas de verdad SÍ se pinta`, () => {
    // El control que impide «arreglarlo» no pintando nunca.
    const pinta = condicionDe(fichero, patron);
    assert.equal(pinta({ seatsLeft: 18, seatsTotal: 20, taken: 2 }), true,
      `🔴 ${fichero} ya no pinta la escasez ni cuando es cierta: entonces esto no es un arreglo, es un borrado`);
  });

  test(`SCRUM-330 · ${fichero}: con las 20 ocupadas NO queda un «quedan 0» eterno`, () => {
    const pinta = condicionDe(fichero, patron);
    assert.equal(pinta({ seatsLeft: 0, seatsTotal: 20, taken: 20 }), false,
      `🔴 ${fichero} sigue pintando con 0 plazas libres`);
  });

  test(`SCRUM-330 · ${fichero}: si el dato NO se puede leer, no se inventa un número`, () => {
    // Las tres formas de «no lo sé»: sin cuerpo, sin el campo, y con basura donde va el número.
    const pinta = condicionDe(fichero, patron);
    for (const roto of [null, undefined, {}, { seatsLeft: null }, { seatsLeft: 'muchas', taken: 5 }]) {
      assert.equal(
        pinta(roto), false,
        `🔴 ${fichero} pinta un número con la fuente rota (${JSON.stringify(roto)}). Un contador que ` +
          'falla y enseña «20» es peor que uno ausente: el visitante no puede saber que es inventado.',
      );
    }
  });
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE NO SE TOCA · la oferta comparte elemento y no es de este ticket
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-330 · la OFERTA sigue mostrándose cuando quedan plazas, aunque no haya ventas', () => {
  // En index.html la escasez y «9,90 €/mes para siempre» viven en el MISMO bloque. Si el arreglo
  // hubiera gateado el bloque entero, con cero ventas desaparecería el precio founding y nadie
  // podría comprarlo — el pez que se muerde la cola. Se gobiernan por separado a propósito.
  const src = leer('public', 'index.html');
  assert.match(src, /9,90&nbsp;€\/mes para siempre/, '🔴 se ha perdido la oferta del anuncio');
  assert.match(src, /id="founding-banner"/, '🔴 se ha perdido el banner de la oferta');
  // Y el bloque se sigue revelando con la condición de plazas libres, no con la de ventas.
  assert.match(src, /ab\.hidden\s*=\s*false/, '🔴 el anuncio ya no se revela nunca');
});

test('SCRUM-330 · el texto de la escasez no ha cambiado (regla 30)', () => {
  // Este ticket cambia CUÁNDO se enseña, no QUÉ dice. Ni una palabra nueva sin aprobación.
  assert.match(leer('public', 'index.html'), /quedan <b id="ann-left">–<\/b> plazas/);
  assert.match(leer('public', 'precios.html'), /'Quedan ' \+ f\.seatsLeft \+ ' de ' \+ f\.seatsTotal \+ ' plazas'/);
});
