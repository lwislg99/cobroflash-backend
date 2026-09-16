// tests/scrum877-la-novena-a-pelo.test.mjs — SCRUM-877
//
// Sin gate: sólo lee ficheros del árbol y analiza fuentes en memoria. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUE NADIE ESCRIBA LA NOVENA A PELO
//
// SCRUM-863 midió **diez** auto-referencias absolutas a `yaqu.app` en `src/`: dos con el respaldo
// de la convención y **ocho con el dominio escrito a pelo**, de las cuales ocho salían al exterior
// —enlaces de recibo y de cobro por WhatsApp, pie de todos los correos, pie del portal del
// cliente—. Y no era «no hay convención»: `PUBLIC_BASE_URL` tenía ya 16 usos y `assertPublicBaseUrl` (en `env.ts`) dice
// literal que **«es la raíz de TODO enlace que el sistema envía»**. Había convención y ocho se la
// saltaban.
//
// ── 🔴 POR QUÉ EL CONTROL VA CONTRA UN BANCO Y NO CONTRA EL ÁRBOL ────────────────────────
// Porque el caso que pone rojo a este guard **desaparece del árbol el día que se arregla**. En
// cuanto los ocho estén en `main`, un control que mirara el repositorio sólo sabría decir verde, y
// nadie podría comprobar nunca más que sabe decir rojo. Eso es un control que se muere de éxito.
//
// Así que el criterio se mide contra **fuentes sintéticas congeladas** —abajo, `BANCO`—, con sus
// tres respuestas esperadas. El árbol se sigue mirando, pero para lo otro: para exigir que no
// aparezca una novena.
//
// El criterio y la lista viven en `_autorreferencias.mjs`; allí está también el hueco declarado.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  analizarFuente, censar, POSICION, EXENTAS, TOPE_EXENTAS,
} from './_autorreferencias.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** Lo que el meta-guard de la casa EJECUTA contra este fichero (SCRUM-745). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'tests/_autorreferencias.mjs',
    de: "  if (/(?:href|src|action|url|link)\\s*[:=]\\s*[\"'`]?\\s*$/i.test(izq)) return POSICION.URL;",
    a: "  if (false) return POSICION.URL;",
    cae: 'SCRUM-877 · 🔴 EL BANCO: el criterio da las TRES respuestas, y son distintas',
  },
  {
    fichero: 'tests/_autorreferencias.mjs',
    de: "  if (/>[^<]*$/.test(izq)) return POSICION.CONTENIDO;",
    a: "  if (false) return POSICION.CONTENIDO;",
    cae: 'SCRUM-877 · ✅ ABSUELVE el contenido visible — la condición que evita que lo apaguen',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL BANCO SINTÉTICO · congelado, para que el caso no se muera al arreglarlo
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Cada rama es un fuente real de los que había en el árbol, reducido a su forma. Van como
 * LITERALES: si vivieran en un fichero de `src/` el propio guard los cazaría, y si se crearan en
 * disco al correr, SCRUM-824 los tumbaría con razón (la tanda va a concurrencia 12).
 */
const BANCO = {
  // 🔴 la forma de `whatsappNotifications.ts:97` y `invoiceWhatsApp.service.ts:102` antes del arreglo
  aPeloEnPlantilla: {
    codigo: 'const u = `https://yaqu.app/recibo/${t}`;',
    espera: POSICION.URL,
  },
  // 🔴 la forma de `emailLayout.ts:69` y `customerPortal.routes.ts:161` antes del arreglo
  aPeloEnHref: {
    codigo: 'const h = `<a href="https://yaqu.app/privacidad">Privacidad</a>`;',
    espera: POSICION.URL,
  },
  // 🔴 la forma de `whatsappNotifications.ts:105`: propiedad `url:`
  aPeloEnPropiedadUrl: {
    codigo: 'const cta = { url: `https://yaqu.app/pay/invoice/${p}` };',
    espera: POSICION.URL,
  },
  // ✅ el contenido visible: si esto saliera rojo, el guard cazaría a `lifecycle.service.ts:61`
  //    y quien lo viera lo apagaría. Es la condición vinculante del ticket.
  mencionEnContenido: {
    codigo: 'const p = `<p>Hecho con <a href="${BASE_URL}">https://yaqu.app</a></p>`;',
    espera: POSICION.CONTENIDO,
  },
  // ✅ el respaldo de la convención: los dos que NO se tocan
  respaldoDeLaConvencion: {
    codigo: "const base = config.PUBLIC_BASE_URL || 'https://yaqu.app';",
    espera: POSICION.EXENTA,
  },
};

test('SCRUM-877 · 🔴 EL BANCO: el criterio da las TRES respuestas, y son distintas', () => {
  const dichas = new Map();
  for (const [nombre, caso] of Object.entries(BANCO)) {
    const r = analizarFuente(caso.codigo, nombre + '.ts');
    assert.equal(r.length, 1,
      `🔴 ${nombre}: el analizador ve ${r.length} apariciones y el banco tiene UNA. Si no ve la `
      + 'del banco, nada de lo que diga sobre el árbol significa algo.');
    assert.equal(r[0].posicion, caso.espera,
      `🔴 ${nombre}: el criterio dice «${r[0].posicion}» y tenía que decir «${caso.espera}».\n`
      + `    fuente: ${caso.codigo}\n    visto : ${r[0].muestra}`);
    dichas.set(nombre, r[0].posicion);
  }

  // 🔴 Y LAS TRES RESPUESTAS TIENEN QUE SER DISTINTAS. Si el banco entero contestara lo mismo,
  // un clasificador que dijera siempre «url» pasaría los cinco casos y no habría medido nada.
  const distintas = new Set(dichas.values());
  assert.ok(distintas.size >= 3,
    `🔴 el banco sólo produce ${distintas.size} respuesta(s) distinta(s): ${[...distintas].join(', ')}. `
    + 'Un clasificador que contestara siempre igual pasaría — eso no es medir.');
});

test('SCRUM-877 · ✅ ABSUELVE el contenido visible — la condición que evita que lo apaguen', () => {
  // El caso REAL que quedó en el árbol: el texto del enlace dice el dominio, el `href` no.
  // Es la forma de `src/modules/messaging/domain/lifecycle.service.ts:61`.
  const real = 'const x = `<a href="${config.PUBLIC_BASE_URL}" style="color:#9ca3af">yaqu.app</a>`;';
  const r = analizarFuente(real, 'lifecycle.ts');
  assert.deepEqual(r.filter((h) => h.posicion === POSICION.URL), [],
    '🔴 el guard acusa al TEXTO visible del enlace. Un rojo injusto no sólo miente: enseña a '
    + 'desactivar el guard, que es como se perdió la vigilancia en SCRUM-124.');

  // Y con el esquema delante, que es el caso que sí podría confundirse.
  const conEsquema = 'const y = `<p>Entra en <a href="${BASE_URL}">https://yaqu.app</a></p>`;';
  const r2 = analizarFuente(conEsquema, 'x.ts');
  assert.equal(r2.length, 1, '🔴 no ve la aparición del contenido: entonces no la está absolviendo, la ignora.');
  assert.equal(r2[0].posicion, POSICION.CONTENIDO,
    '🔴 un dominio con esquema DENTRO del texto del enlace se está leyendo como URL.');
});

test('SCRUM-877 · 🔴 los COMENTARIOS no entran — lo que SCRUM-124 no puede hacer', () => {
  // Éste es el motivo por el que este guard se puede escribir y aquél no: se mira el nodo, no el
  // texto del fichero. Un comentario que NOMBRA el dominio no es una URL.
  const conComentario = '// ejemplo: https://yaqu.app/recibo/x\nconst u = `${BASE_URL}/recibo/${t}`;';
  assert.deepEqual(analizarFuente(conComentario, 'c.ts'), [],
    '🔴 el analizador cuenta el dominio de un COMENTARIO. Así se cazaría a sí mismo y a cualquier '
    + 'fichero que explique la regla — el modo de fallo exacto de SCRUM-124.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · un escáner que no encuentra lo que SÍ está no está mirando
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-877 · 🔴 SUELO: el escáner ve el árbol y ve la convención', () => {
  const c = censar(RAIZ, 'src');
  assert.ok(c.escaneados > 200,
    `🔴 CIEGO: sólo ${c.escaneados} ficheros .ts escaneados en src/. El 16-sep-2026 eran 282.`);
  assert.ok(c.derivaciones >= 16,
    `🔴 CIEGO: sólo ${c.derivaciones} derivaciones de PUBLIC_BASE_URL/BASE_URL. El 16-sep-2026 `
    + 'eran 16 o más. Si no ve las que SÍ están, su «ninguna a pelo» no significa nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE DECIDE SOBRE EL ÁRBOL · ninguna NOVENA a pelo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-877 · 🔴 ninguna auto-referencia a pelo en src/ — ni la novena', () => {
  const c = censar(RAIZ, 'src');
  const aPelo = c.hallazgos.filter((h) => h.posicion === POSICION.URL);
  assert.deepEqual(aPelo.map((h) => `${h.fichero}:${h.linea}  ${h.muestra}`), [],
    '🔴 HAY UNA URL PROPIA CON EL DOMINIO ESCRITO A PELO:\n'
    + aPelo.map((h) => `    ${h.fichero}:${h.linea}  ${h.muestra}`).join('\n') + '\n\n'
    + '  `PUBLIC_BASE_URL` es la raíz de TODO enlace que el sistema envía (lo dice `assertPublicBaseUrl`, en `env.ts`), y un\n'
    + '  dominio a pelo no la sigue: el día que cambie, ese enlace se queda apuntando al viejo y\n'
    + '  nadie se entera hasta que un cliente no puede pagar.\n\n'
    + '  ARRÉGLALO ASÍ: `${BASE_URL}/loquesea` — `BASE_URL` es `config.PUBLIC_BASE_URL` con nombre\n'
    + '  corto y ya está importado en la mitad de estos ficheros. El TEXTO del mensaje no cambia:\n'
    + '  sólo la raíz de la URL (regla 30).');

  // ⚠️ Lo INDETERMINADO se dice, no se cuenta como limpio ni como hallazgo.
  const dudosas = c.hallazgos.filter((h) => h.posicion === POSICION.INDETERMINADA);
  assert.deepEqual(dudosas.map((h) => `${h.fichero}:${h.linea}  ${h.muestra}`), [],
    '⚠️ hay apariciones que el criterio NO sabe clasificar. No son un hallazgo ni un verde: son\n'
    + '  un hueco. Mira cada una y decide si el criterio tiene que aprender esa forma:\n'
    + dudosas.map((h) => `    ${h.fichero}:${h.linea}  ${h.muestra}`).join('\n'));
});

test('SCRUM-877 · 🔴 la lista de exentas está CERRADA en dos, y clavada por identidad', () => {
  const claves = Object.keys(EXENTAS);
  assert.equal(claves.length, TOPE_EXENTAS,
    `🔴 hay ${claves.length} exentas y el tope es ${TOPE_EXENTAS}. Una tercera no se añade: se decide.`);

  // Por IDENTIDAD, no por posición: una línea se mueve en cuanto alguien añade un import encima.
  const c = censar(RAIZ, 'src');
  const exentasVistas = c.hallazgos.filter((h) => h.posicion === POSICION.EXENTA);
  assert.equal(exentasVistas.length, TOPE_EXENTAS,
    `🔴 el árbol tiene ${exentasVistas.length} apariciones con el respaldo de la convención y la `
    + `lista declara ${TOPE_EXENTAS}. Los números tienen que cuadrar o la lista no describe el árbol.`);
  for (const f of claves) {
    assert.ok(exentasVistas.some((h) => h.fichero === f),
      `🔴 la lista nombra ${f} como exenta y el árbol ya no tiene ahí ninguna: quítala y baja el tope.`);
  }
});
