// tests/scrum675-ancla-por-identidad.test.mjs — SCRUM-675
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// UNA VENTANA FIJA NO LEE EL CÓDIGO: LEE LOS PRIMEROS N CARACTERES DE DONDE ESTABA EL CÓDIGO.
//
// Escribir un comentario cerca empuja el símbolo vigilado fuera de la ventana. Si el assert era
// `match`, el guard cae (ruidoso). Si era `doesNotMatch`, **pasa en verde sin mirar nada**.
//
// ── LO MEDIDO HOY, Y EL TICKET HA ENVEJECIDO EN SU EJEMPLO ────────────────────────────────────
//
//   · El caso que el ticket nombra —el censo de SCRUM-647, margen 152— **ya está arreglado**, y
//     con ancla por identidad: `t.slice(i, t.indexOf('Total', i) + …)`. Su propio comentario lo
//     dice: *«Un `slice` de longitud fija cortaba la…»*.
//   · El margen vivo de hoy es **644** (`scrum370`, ventana 1400), no 152.
//   · Población: **26** ventanas fijas, **21** acotan una búsqueda, y **2** tienen ceguera
//     SILENCIOSA (assert negativo).
//
// La tesis del ticket sigue viva; su ejemplo no. Por eso el arreglo va a la familia.
//
// ── LOS CONTROLES ─────────────────────────────────────────────────────────────────────────────
//
//   ① SUELO ................ hay ventanas fijas que examinar y el delimitador sabe delimitar.
//   ② 🔴 EL QUE DECIDE ..... con ventana fija, un símbolo empujado fuera pasa EN VERDE; con
//                            ancla por identidad, se sigue viendo.
//   ③ 🔴 MUTACIÓN .......... devolver la ventana fija reproduce la ceguera — y se comprueba que
//                            la mutación ENTRÓ.
//   ④ ✅ POSITIVO .......... el delimitador sigue cazando la violación real.
//   ⑤ ✅ NO SE CALLA ....... si no puede delimitar, LANZA en vez de devolver un trozo.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { bloqueDesde, BloqueNoDelimitableError } from './_bloque-por-identidad.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

/**
 * La fuente sintética reproduce el caso real: un bloque con un símbolo prohibido MÁS ALLÁ de la
 * ventana. El relleno es prosa, que es exactamente lo que empuja en la vida real — un comentario.
 */
const RELLENO = '// '.concat('documentación que alguien escribió aquí. '.repeat(60));
const FUENTE = `
function cargarCatalogo() {
  apiRequest('/admin/products/load-catalog', { method: 'POST' })
${RELLENO}
    .catch((_) => { throw new Error('el catálogo bloqueó el onboarding'); });
}
`;
const ANCLA = "apiRequest('/admin/products/load-catalog'";
const VENTANA = 1800;

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-675 · ① SUELO: hay ventanas fijas en el árbol y el delimitador delimita', () => {
  // Si no hubiera ninguna ventana fija que examinar, este fichero entero mediría el vacío.
  const censo = fs.readFileSync(path.join(RAIZ, 'docs/master/evidencias/scrum675/salida-censo.txt'), 'utf8');
  assert.match(censo, /ACOTAN UNA BUSQUEDA \(pueden cegar\) \.+: (\d+)/,
    '🔴 CIEGO: el censo no declara cuántas ventanas acotan una búsqueda');
  const n = Number(censo.match(/ACOTAN UNA BUSQUEDA \(pueden cegar\) \.+: (\d+)/)[1]);
  assert.ok(n > 0, `🔴 CIEGO: el censo dice ${n} ventanas peligrosas. Un cero aquí sería el instrumento roto.`);

  // Y el delimitador hace su trabajo sobre un bloque trivial.
  assert.equal(bloqueDesde('antes function f() { dentro } después', 'function f()').trim(),
    'function f() { dentro }', '🔴 el delimitador no acota un bloque trivial');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② EL QUE DECIDE
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-675 · 🔴 ② con ventana fija el símbolo empujado pasa EN VERDE; por identidad, se ve', () => {
  const i = FUENTE.indexOf(ANCLA);
  assert.ok(i > 0, '🔴 la fuente sintética no reproduce el caso');

  // ── HOY: ventana fija. El `throw` quedó fuera, y el `doesNotMatch` pasa. ──
  const porVentana = FUENTE.slice(i, i + VENTANA);
  assert.doesNotMatch(porVentana, /throw\s/,
    '🔴 la fuente sintética no empuja el símbolo fuera de la ventana: entonces este control no '
    + 'reproduce el defecto y lo de abajo no demuestra nada.');
  // ↑ Ese assert PASA. Y ahí está el defecto: pasa porque no llega, no porque esté limpio.

  // ── DESPUÉS: ancla por identidad. El bloque acaba donde acaba, no a los N caracteres. ──
  const porIdentidad = bloqueDesde(FUENTE, 'function cargarCatalogo()');
  assert.match(porIdentidad, /throw\s/,
    '🔴 EL DEFECTO DE SCRUM-675 SIGUE: delimitando por identidad, el `throw` TIENE que estar '
    + 'dentro del bloque. Si no está, el ancla estructural no alcanza y el guard seguiría ciego.');

  // Y la diferencia es exactamente la que este ticket viene a cerrar.
  assert.ok(porIdentidad.length > porVentana.length || /throw/.test(porIdentidad),
    '🔴 los dos modos dan lo mismo: entonces no se ha añadido nada');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ③ MUTACIÓN — devolver la ventana fija reproduce la ceguera
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-675 · 🔴 ③ MUTACIÓN: volver a la ventana fija devuelve la ceguera', () => {
  const i = FUENTE.indexOf(ANCLA);

  // La mutación: leer por distancia en vez de por estructura.
  const mutado = FUENTE.slice(i, i + VENTANA);
  const arreglado = bloqueDesde(FUENTE, 'function cargarCatalogo()');

  // 🔴 QUE LA MUTACIÓN ENTRÓ: el trozo mutado NO llega al símbolo, el arreglado SÍ.
  const veMutado = /throw\s/.test(mutado);
  const veArreglado = /throw\s/.test(arreglado);

  assert.equal(veMutado, false,
    '🔴 la mutación NO entró: con ventana fija el símbolo sigue dentro, así que no se está '
    + 'reproduciendo la ceguera y ② estaría verde por otra razón.');
  assert.equal(veArreglado, true, '🔴 el arreglo no ve el símbolo: entonces no arregla nada');
  assert.notEqual(veMutado, veArreglado,
    '🔴 ver y no ver dan lo mismo: la vía nueva no es lo que decide');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ POSITIVO — no se cambia un guard ciego por uno muerto
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-675 · ✅ ④ el delimitador sigue cazando la violación real', () => {
  // Un bloque que SÍ tiene la violación, sin relleno: tiene que verse igual que antes.
  const CON_VIOLACION = `
function cargarCatalogo() {
  apiRequest('/x').catch((_) => { throw new Error('boom'); });
}
`;
  assert.match(bloqueDesde(CON_VIOLACION, 'function cargarCatalogo()'), /throw\s/,
    '🔴 el delimitador ya no caza una violación que está a la vista: se ha cambiado un guard '
    + 'ciego por uno muerto, que es peor.');

  // Y el negativo: un bloque limpio NO dispara.
  const LIMPIO = `
function cargarCatalogo() {
  apiRequest('/x').catch((_) => { console.warn('sin catálogo'); });
}
`;
  assert.doesNotMatch(bloqueDesde(LIMPIO, 'function cargarCatalogo()'), /throw\s/,
    '🔴 dispara sobre un bloque limpio: un guard ruidoso acaba desactivado');

  // 🔴 Y NO SE PASA DE LARGO: lo que hay DESPUÉS del bloque no entra.
  const CON_VECINO = `
function cargarCatalogo() {
  apiRequest('/x').catch((_) => { console.warn('ok'); });
}
function otraCosa() { throw new Error('esto NO es del bloque vigilado'); }
`;
  assert.doesNotMatch(bloqueDesde(CON_VECINO, 'function cargarCatalogo()'), /throw\s/,
    '🔴 el bloque se come a su vecino: entonces el ancla por identidad lee DE MÁS, que es el '
    + 'defecto que la ventana evitaba. Sustituirla no puede reintroducirlo.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ NO SE CALLA — la salida B del ticket, como suelo de la A
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-675 · ✅ ⑤ si no puede delimitar, LANZA en vez de devolver un trozo', () => {
  assert.throws(() => bloqueDesde('nada que ver aquí', 'ancla que no existe'),
    BloqueNoDelimitableError,
    '🔴 con un ancla inexistente devuelve algo en vez de declararse ciego. Un instrumento que no '
    + 'sabe algo se declara ciego, no contesta que no.');

  assert.throws(() => bloqueDesde('function f() { sin cerrar', 'function f()'),
    BloqueNoDelimitableError, '🔴 un bloque sin cerrar tiene que gritar, no devolver lo que pilló');

  // Y el mensaje tiene que ser accionable: dice el ancla y por qué no pudo.
  try {
    bloqueDesde('x', 'ancla fantasma');
    assert.fail('no lanzó');
  } catch (e) {
    assert.match(e.message, /ancla fantasma/, '🔴 el error no dice QUÉ ancla falló');
    assert.match(e.message, /no se devuelve un trozo aproximado/i,
      '🔴 el error no explica por qué prefiere fallar a aproximar');
  }

  // 🔴 Las llaves dentro de cadenas y comentarios NO cierran el bloque.
  const CON_LLAVE_EN_TEXTO = `
function f() {
  const msg = 'esto lleva una } dentro';
  // y un comentario con } también
  throw new Error(msg);
}
`;
  assert.match(bloqueDesde(CON_LLAVE_EN_TEXTO, 'function f()'), /throw\s/,
    '🔴 una `}` dentro de una cadena cierra el bloque antes de tiempo: volveríamos a leer de menos, '
    + 'que es el mismo defecto con otra cara.');
});
