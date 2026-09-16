// tests/scrum551-anclas-bloque-f.test.mjs — SCRUM-551
//
// Sin gate: lee ficheros. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL CENSO ESTA HOY EN ROJO, Y ESTE FICHERO NO LO TAPA: LO FIJA
//
// `censo:anclas-f` encuentra TRES afirmaciones de capacidad sin ancla, y ese rojo es correcto.
// Por eso el guard NO esta enganchado a `pretest` (el motivo, entero, en la cabecera del
// script). Lo que hace este fichero es un TRINQUETE sobre ese rojo:
//
//   · si aparece una CUARTA promesa sin ancla → cae, y la nombra;
//   · si una de las tres se arregla → cae tambien, pidiendo que se actualice el trinquete.
//
// O sea que la suite se queda verde —el rojo esta medido y declarado, no escondido— pero el
// numero no se puede mover en silencio en ninguna de las dos direcciones. Un guard apagado y
// sin trinquete seria un fichero que nadie mira.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censar, censarEnDisco, unidades, bloquesDePropuesta, anclaViva,
  ANCLAS_F, MARCAS_CAPACIDAD, SIN_ANCLA, SIN_CAPACIDAD, LANDING,
} from '../scripts/censo-anclas-bloque-f.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(RAIZ, LANDING), 'utf8');

/** Las tres medidas el 20-ago-2026. El trinquete. */
const SIN_ANCLA_HOY = [
  'heroe-f4/p#1',
  'gremios[electricidad]/p#1',
  'gremios[pintura]/p#1',
];

/**
 * SCRUM-558 · LA CUARTA, Y NO ES DE LA MISMA CLASE.
 *
 * `gremios[climatizacion]/p#1` tiene su ancla BIEN puesta: `runMaintenanceProposals` existe y lo
 * dispara el cron. Y aun asi la frase es falsa para un merchant nuevo, porque
 * `MAINTENANCE_ENABLED` nace apagado y el merchant tampoco puede encenderlo (SCRUM-207).
 *
 * ⚠️ POR QUE NO SE SUMA A `SIN_ANCLA_HOY` Y YA. Las dos listas se arreglan de forma distinta y
 * mezclarlas perderia justo lo que este ticket vino a distinguir:
 *   · SIN_ANCLA    → no hay mecanismo. Se arregla construyendolo o reescribiendo el texto.
 *   · INALCANZABLE → el mecanismo esta. Se arregla abriendo el camino o reescribiendo el texto.
 * El trinquete que sube de 3 a 4 es el de abajo, sobre la UNION: lo que no puede crecer es el
 * numero de frases publicables que hoy no son ciertas.
 */
const INALCANZABLES_HOY = ['gremios[climatizacion]/p#1'];

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · «ninguna promesa sin ancla» y «no supe leer la landing» dan el mismo verde
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-551 · 🔴 SUELO: el censo VE las secciones de propuesta y sus textos', () => {
  const bloques = bloquesDePropuesta(html);
  assert.ok(bloques.length >= 2,
    `🔴 CIEGO: solo veo ${bloques.length} secciones \`data-microcopy="PENDIENTE_FUNDADOR"\`, y hay `
    + 'dos (el héroe F4 y los gremios F6). Si el atributo cambió, todo lo de abajo pasaría sin '
    + 'haber mirado ni un texto.');

  const us = unidades(html);
  assert.ok(us.length >= 10,
    `🔴 CIEGO: solo ${us.length} unidades de texto. Las seis tarjetas de gremio ya son doce.`);

  // Y que vea las DOS familias: si solo viera títulos, no habría mirado ninguna promesa.
  assert.ok(us.some((u) => u.bloque === 'heroe-f4'), '🔴 no ve el héroe F4');
  assert.ok(us.some((u) => u.gremio === 'pintura'), '🔴 no ve las tarjetas de gremio');
});

test('SCRUM-551 · 🔴 SUELO: sin secciones de propuesta, se declara CIEGO en vez de decir «limpio»', () => {
  const r = censar({ html: '<section id="otra"><p>Cualquier cosa.</p></section>', raiz: RAIZ });
  assert.equal(r.ok, false,
    '🔴 dio por bueno un HTML donde no hay NADA que mirar. Un cero de promesas sobre una página '
    + 'que no se supo leer se lee como «landing limpia», y significa lo contrario.');
  assert.equal(r.ciego, true);
  assert.match(r.salida, /CIEGO/);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL TRINQUETE · las tres de hoy, ni una más ni una menos
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-551 · 🔴 las afirmaciones sin ancla son EXACTAMENTE las tres medidas', () => {
  const r = censarEnDisco(RAIZ);
  assert.deepEqual(r.sinAncla.map((s) => s.id).sort(), [...SIN_ANCLA_HOY].sort(),
    '🔴 HA CAMBIADO EL CONJUNTO DE PROMESAS SIN ANCLA.\n\n'
    + '  · Si ha aparecido una NUEVA: alguien ha escrito en la landing una capacidad que el\n'
    + '    producto no tiene. Eso es art. 5 LCD, y no distingue entre una tabla y una tarjeta.\n'
    + '  · Si una ha DESAPARECIDO: enhorabuena — actualiza `SIN_ANCLA_HOY` en este fichero y, si\n'
    + '    ya no queda ninguna, engancha el censo a `pretest` (ver la cabecera del script).\n\n'
    + `  Ahora mismo: ${JSON.stringify(r.sinAncla.map((s) => s.id))}`);

  // Y cada una tiene que decir QUÉ promete: un rojo que no nombra el ticket no se puede actuar.
  for (const s of r.sinAncla) {
    assert.ok(s.promete && s.promete !== '(sin declarar)',
      `🔴 «${s.id}» sale sin ancla y no declara qué ticket la sostendría. Sin eso, quien lea el `
      + 'rojo no sabe si hay que reescribir el texto o esperar a que alguien construya algo.');
    assert.ok(s.texto.length > 20, `🔴 «${s.id}» no reporta su texto literal`);
  }
});

test('SCRUM-551 · el censo NO está enganchado a pretest, y eso es deliberado', () => {
  // Si alguien lo engancha con los textos todavía sin reescribir, el CI se cae para todo el
  // mundo. Este caso existe para que ese enganche sea una decisión y no un descuido.
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  assert.ok(!/censo-anclas-bloque-f|censo:anclas-f/.test(pkg.scripts.pretest || ''),
    '🔴 el censo se ha enganchado a `pretest` y todavía hay promesas sin ancla: el CI se cae para\n'
    + '  todo el mundo por unos textos que ni siquiera están publicados. Engánchalo cuando\n'
    + '  `SIN_ANCLA_HOY` esté vacío, no antes.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ✅ CONTROL POSITIVO · «detecta promesas falsas» y «se queja de todo» dan el mismo rojo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-551 · ✅ CONTROL POSITIVO: reformas (F6-10/11) NO dispara el guard', () => {
  const r = censarEnDisco(RAIZ);
  const reformas = r.sinAncla.filter((s) => s.id.includes('reformas'));
  assert.deepEqual(reformas, [],
    '🔴 la tarjeta de reformas sale como promesa sin ancla, y sus dos mecanismos EXISTEN: el\n'
    + '  reparto por tramos (`stageLines`) y la transición emitido→firmado del albarán\n'
    + '  (`canTransitionAlbaran`). Un guard que marca lo que sí es verdad se acaba desactivando,\n'
    + '  y entonces no protege de nada.');

  // Y que sus anclas estén VIVAS de verdad, no solo declaradas.
  for (const a of ANCLAS_F['gremios[reformas]/p#1'].anclas) {
    assert.equal(anclaViva(a, RAIZ).viva, true, `🔴 el ancla de reformas está muerta: ${a}`);
  }
});

test('SCRUM-551 · ✅ CONTROL POSITIVO: las tarjetas ancladas no salen en el parte', () => {
  const r = censarEnDisco(RAIZ);
  const ids = r.sinAncla.map((s) => s.id);
  for (const g of ['fontaneria', 'cerrajeria', 'climatizacion']) {
    assert.ok(!ids.some((i) => i.includes(g)),
      `🔴 «${g}» sale sin ancla y su mecanismo existe. Ver el registro: cada una declara el suyo.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ROJO POR EL MECANISMO · sobre corpus sintético, antes de creerse el veredicto real
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-551 · 🔴 una promesa NUEVA en una tarjeta de gremio CAE, nombrándola', () => {
  // El caso que este fichero existe para cazar: alguien añade una tarjeta con una frase que
  // promete un mecanismo que no está construido.
  const nuevo = html.replace(
    '<div class="prod" data-gremio="pintura">',
    '<div class="prod" data-gremio="jardineria"><div class="p-in"><h3>Jardinería</h3>'
    + '<p>Programas el riego y el cliente paga con tarjeta desde el jardín.</p></div></div>'
    + '<div class="prod" data-gremio="pintura">',
  );
  assert.notEqual(nuevo, html, '🔴 la inyección no se aplicó: la prueba no probaría nada');

  const r = censar({ html: nuevo, raiz: RAIZ });
  assert.equal(r.ok, false, '🔴 el censo dejó pasar una tarjeta nueva sin declarar');
  assert.match(r.salida, /jardineria/, '🔴 no NOMBRA la tarjeta: sin el nombre no se sabe qué quitar');
  assert.match(r.salida, /paga con tarjeta desde el jardín/,
    '🔴 no cita la FRASE. Un rojo que no dice qué frase lo causó no se puede comprobar ni discutir.');
  assert.match(r.salida, /SIN DECLARAR/);
});

test('SCRUM-551 · 🔴 un ancla que se muere CAE, y dice qué símbolo desapareció', () => {
  // El otro sentido: la frase sigue, pero el mecanismo que la sostenía se retiró.
  const v = anclaViva('src/modules/quotes/app/routes/quotes.routes.ts::estoNoExisteEnNingunSitio', RAIZ);
  assert.equal(v.viva, false, '🔴 dio por viva un ancla cuyo símbolo no está: comprobar que el '
    + 'fichero existe es un verde hueco — un fichero puede seguir ahí con el mecanismo ya retirado');
  assert.match(v.motivo, /ya no contiene/);
  assert.equal(anclaViva('src/no/existe.ts::loQueSea', RAIZ).viva, false);
  assert.equal(anclaViva('sin-separador', RAIZ).viva, false, '🔴 acepta un ancla mal formada');
});

test('SCRUM-551 · 🔴 `SIN_CAPACIDAD` no es una puerta de escape', () => {
  // Sin este contraste, cualquiera podría colar una promesa declarándola «no afirma nada».
  // La rama solo se alcanza con un registro MAL declarado, así que se inyecta uno: es la única
  // forma de ejercitarla, y sin ejercitarla se podría borrar entera con la suite en verde.
  const idFontaneria = 'gremios[fontaneria]/p#1';
  const registroMalo = { ...ANCLAS_F, [idFontaneria]: { ...ANCLAS_F[idFontaneria], anclas: SIN_CAPACIDAD } };
  const r = censar({ html, raiz: RAIZ, registro: registroMalo });
  assert.equal(r.ok, false,
    '🔴 se declaró SIN_CAPACIDAD una frase que dice «cobras al terminar» y el censo lo dio por '
    + 'bueno. `SIN_CAPACIDAD` sería entonces la puerta por la que entra cualquier promesa.');
  assert.match(r.salida, /declarada SIN_CAPACIDAD y afirma una/);

  // Y el contraste sabe ABSOLVER: si marcara títulos neutros, acusaría en falso y acabaría
  // desactivado, que es la otra forma de perder un guard.
  assert.ok(MARCAS_CAPACIDAD.some((re) => re.test('el cliente paga con tarjeta')),
    '🔴 el contraste no reconoce «paga con tarjeta»: está ciego');
  assert.ok(!MARCAS_CAPACIDAD.some((re) => re.test('El recorrido es el mismo. El trabajo, no.')),
    '🔴 el contraste marca un título neutro: acusaría en falso');
  assert.ok(MARCAS_CAPACIDAD.length >= 8,
    '🔴 la lista de marcas se ha quedado corta: el contraste dejaría pasar casi todo');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA CORRESPONDENCIA, EN LAS DOS DIRECCIONES (heredado de F5)
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-551 · toda unidad del HTML está declarada, y todo ancla cubre una unidad', () => {
  const enHtml = unidades(html).map((u) => u.id).sort();
  const enRegistro = Object.keys(ANCLAS_F).sort();
  assert.deepEqual(enRegistro, enHtml,
    '🔴 EL REGISTRO Y EL HTML NO CUADRAN.\n\n'
    + `  solo en el HTML .....: ${JSON.stringify(enHtml.filter((x) => !enRegistro.includes(x)))}\n`
    + `  solo en el registro .: ${JSON.stringify(enRegistro.filter((x) => !enHtml.includes(x)))}\n\n`
    + '  Un texto sin entrada es una frase que nadie ha respaldado. Un ancla sin texto es un ancla\n'
    + '  que sobrevivió a su frase y ya no describe nada — las dos son rojo, igual que en F5.');
});

test('SCRUM-551 · el registro guarda el TEXTO, para que reescribir caduque el ancla', () => {
  // Es la diferencia con lo que pasó en F4 y F6: el texto se escribió y nadie volvió a mirar.
  //
  // ⚠️ Se inyecta sobre el LITERAL del registro y no sobre `unidades(html)[0].texto`: ese viene
  //   ya limpio de etiquetas y NO aparece tal cual en el HTML, así que el `replace` no casaba y
  //   la prueba salía verde sin haber inyectado nada. Lo cazó su propia post-condición.
  const original = ANCLAS_F['gremios[fontaneria]/p#1'].texto;
  const cambiado = html.replace(original, original + ' Y además cobras con tarjeta.');
  assert.notEqual(cambiado, html, '🔴 la inyección no se aplicó: la prueba no probaría nada');

  const r = censar({ html: cambiado, raiz: RAIZ });
  assert.equal(r.ok, false, '🔴 se reescribió una frase y su ancla siguió valiendo');
  assert.match(r.salida, /EL TEXTO CAMBIÓ/);
  assert.match(r.salida, /gremios\[fontaneria\]/, '🔴 no dice QUÉ unidad cambió');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL TRINQUETE UNIDO · SCRUM-558 lo sube de 3 a 4
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-551 + SCRUM-558 · las frases que HOY no son ciertas son exactamente cuatro', () => {
  const r = censarEnDisco(RAIZ);
  const hoy = [...r.sinAncla.map((s) => s.id), ...r.inalcanzables.map((s) => s.id)].sort();
  const esperado = [...SIN_ANCLA_HOY, ...INALCANZABLES_HOY].sort();

  assert.equal(esperado.length, 4, '🔴 el trinquete declarado ya no son cuatro: actualiza el comentario tambien.');
  assert.deepEqual(hoy, esperado,
    '🔴 HA CAMBIADO EL CONJUNTO DE FRASES QUE HOY NO SON CIERTAS.\n\n'
    + '  Las dos clases cuentan igual para este numero y se arreglan distinto:\n'
    + '  · sin ancla    → el mecanismo NO existe.\n'
    + '  · inalcanzable → el mecanismo existe y el usuario no llega (SCRUM-558).\n\n'
    + '  Si ha crecido, hay un texto nuevo prometiendo algo que un merchant nuevo no tiene.\n'
    + '  Si ha menguado, di CUAL y por que antes de bajar el numero.\n\n'
    + `  Ahora mismo: ${JSON.stringify(hoy)}`);
});
