// tests/scrum493-dos-instrumentos.test.mjs — SCRUM-493 · los dos instrumentos de alcance, lado a lado.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 QUÉ IMPIDE ESTO, Y ESTÁ EN VUELO
//
// Dos casas están midiendo alcance AHORA para decidir qué se puede borrar, con instrumentos que ya
// han dado números distintos sobre el mismo fichero. **Un borrado decidido con el número bajo borra
// código vivo.** Este fichero no funde los dos —esa decisión es de los fundadores y va después—:
// mantiene viva la tabla de dónde discrepan, para que nadie borre creyendo que hay un solo número.
//
// ⚠️ AQUÍ NO SE TOCA `_alcance-dominio.mjs`. Se le LLAMA y se recoge lo que dice (regla 9).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { comparar, autoprueba, CLASES, SI, NO, NO_SE } from './_comparador-alcance.mjs';
import { censarAlcance } from './_alcance-desde-entradas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const C = comparar(RAIZ);

// ── 🔴 AUTOPRUEBA · antes de creerse ningún número ──────────────────────────────────────

test('SCRUM-493 · 🔴 AUTOPRUEBA: el comparador encuentra una discrepancia SINTÉTICA plantada', () => {
  // Sin esto, «los dos coinciden» y «el comparador está ciego» dan el mismo verde.
  const a = autoprueba();
  assert.ok(a.encuentraLaPlantada,
    '🔴 el comparador NO encuentra una discrepancia plantada a propósito, sobre un árbol de tres ' +
    `exports con la respuesta conocida. Vio: ${JSON.stringify(a.vistas)}\n` +
    '  Entonces su cero sobre el repo real no significa «coinciden»: significa que no supo mirar.');
  assert.ok(a.noInventaOtras,
    `🔴 inventa discrepancias donde no las hay: ${JSON.stringify(a.vistas)}. Un comparador que marca ` +
    'de más llena la tabla de ruido y deja de poder atenderse.');
  assert.ok(a.coincidenLosDemas,
    '🔴 no reconoce NINGÚN acuerdo. Un comparador que lo marca todo como discrepancia también ' +
    '«encuentra la plantada», y no vale para nada.');
});

// ── 🔴 EL SUELO ─────────────────────────────────────────────────────────────────────────

test('SCRUM-493 · 🔴 SUELO: una lista de discrepancias VACÍA es ceguera, no acuerdo', (t) => {
  t.diagnostic(`corpus ${C.corpus} · acuerdan ${C.acuerdos} · discrepan ${C.discrepancias.length} · ` +
    Object.entries(C.porClase).map(([k, v]) => `${k}=${v}`).join(' · '));

  assert.ok(C.discrepancias.length > 0,
    '🔴 CERO DISCREPANCIAS. Sabemos de al menos una medida a mano (`sendQuoteEmail`), así que un ' +
    'cero significa que el comparador se ha quedado ciego — no que los dos instrumentos coincidan.');
  assert.ok(C.discrepancias.length >= 50,
    `🔴 solo ${C.discrepancias.length} discrepancias, y el 12-ago-2026 eran 160 sobre 518 exports. ` +
    'Una caída así no es que los instrumentos hayan convergido en un día: es que uno de los dos ha ' +
    'dejado de responder.');
  assert.ok(C.corpus >= 400,
    `🔴 el corpus común es de ${C.corpus} exports: uno de los dos instrumentos no está censando.`);
});

test('SCRUM-493 · CONTROL NEGATIVO: donde coinciden, coinciden — no se marca todo', () => {
  assert.ok(C.acuerdos >= 300,
    `🔴 solo ${C.acuerdos} acuerdos de ${C.corpus}. Si casi todo sale como discrepancia, el ` +
    'comparador no está comparando: está marcando.');
  assert.ok(C.acuerdos > C.discrepancias.length,
    '🔴 hay más discrepancias que acuerdos. Los dos instrumentos miden preguntas parecidas sobre el ' +
    'mismo árbol: eso no es plausible, es un fallo del normalizador.');
});

// ── 🔴 CONTROL POSITIVO ─────────────────────────────────────────────────────────────────

test('SCRUM-493 · 🔴 CONTROL POSITIVO: `sendQuoteEmail` sale NO_SE_PUDO_DETERMINAR, no muerto', () => {
  // Si saliera muerto, ② estaría afirmando que un correo de presupuesto no se manda. Y sí se manda:
  // lo llama `quotesAdmin.routes.ts` por import dinámico.
  const A = censarAlcance(RAIZ);
  const v = A.veredictos.get('src/modules/messaging/domain/email.service.ts::sendQuoteEmail');
  assert.equal(v?.estado, 'NO_SE_PUDO_DETERMINAR',
    `🔴 «${v?.estado}». El instrumento se ha roto: estaría afirmando que un correo de presupuesto no ` +
    'se manda. «No se pudo determinar» y «no es alcanzable» son opuestos.');
});

// ── LA TABLA ────────────────────────────────────────────────────────────────────────────

test('SCRUM-493 · 🔴 toda discrepancia está CLASIFICADA: `OTRO` es un hueco, no una categoría', () => {
  const otros = C.discrepancias.filter((d) => d.clase === 'OTRO');
  assert.deepEqual(otros.map((d) => `${d.modulo}:${d.linea} ${d.nombre} (①=${d.uno} ②=${d.dos})`), [],
    `🔴 hay ${otros.length} discrepancia(s) que el comparador NO sabe explicar.\n\n` +
    '  Una discrepancia sin motivo no está clasificada: está sin mirar. O se le encuentra el\n' +
    '  mecanismo y se le da su clase, o se declara como hueco en la entrada — pero no se deja\n' +
    '  pasar en verde, porque es justo la que va a decidir mal un borrado.');
  for (const d of C.discrepancias) {
    assert.ok(CLASES[d.clase], `🔴 «${d.clase}» no está definida en CLASES.`);
    assert.ok(d.sesgo && d.sesgo.length > 20,
      `🔴 ${d.modulo}::${d.nombre} no dice QUÉ instrumento falla ni hacia dónde, que es lo único ` +
      'accionable para quien vaya a borrar.');
  }
});

test('SCRUM-493 · 🔴 LA CLASE QUE DECIDE UN BORRADO: ① da por huérfano lo que el proceso SÍ ejecuta', (t) => {
  const intra = C.discrepancias.filter((d) => d.clase === 'LLAMADA_INTRA_MODULO');
  t.diagnostic(`LLAMADA_INTRA_MODULO: ${intra.length} de ${C.discrepancias.length}`);
  assert.ok(intra.length >= 50,
    `🔴 solo ${intra.length} casos de llamada intra-módulo, y se midieron 158. Si de verdad han ` +
    'bajado, alguien ha cableado 100 exports en un día; lo probable es que el detector se rompió.');
  for (const d of intra) {
    assert.equal(d.uno, NO);
    assert.equal(d.dos, SI,
      `🔴 ${d.modulo}::${d.nombre} está en la clase equivocada: la clase es «① dice huérfano y ② ` +
      'dice que sí llega», y aquí no es el caso.');
    assert.match(d.sesgo, /borra código vivo/,
      '🔴 el sesgo de esta clase ha dejado de decir la consecuencia. Es LA frase del ticket: quien ' +
      'borre guiándose por ① borra código que el proceso ejecuta.');
  }
});

test('SCRUM-493 · las dos discrepancias medidas a mano siguen ahí, con su mecanismo', () => {
  const busca = (n) => C.discrepancias.find((d) => d.nombre === n);

  const quote = busca('sendQuoteEmail');
  assert.ok(quote, '🔴 `sendQuoteEmail` ya no sale como discrepancia; se midió que lo es.');
  assert.equal(`${quote.uno}/${quote.dos}`, `${NO}/${NO_SE}`,
    '🔴 ① lo da por huérfano y ② no sabe: ése es el caso, y es el peor de todos — NADIE ha ' +
    'comprobado nada y aun así aparecería en una lista de borrables.');
  assert.equal(quote.clase, 'IMPORT_DINAMICO');

  const invoice = busca('sendInvoiceEmail');
  assert.ok(invoice, '🔴 `sendInvoiceEmail` ya no sale como discrepancia.');
  assert.equal(`${invoice.uno}/${invoice.dos}`, `${SI}/${NO_SE}`);
  assert.equal(invoice.clase, 'REEXPORT',
    '🔴 aquí ① ACIERTA y ② se queda corto: se llega por el re-export de `lib/email.ts`, y ② tira ' +
    'ese camino porque el módulo también entra por un import dinámico. La opacidad de ② es de ' +
    'GRANO GRUESO y se traga un camino que sí era determinable.');
});

test('SCRUM-493 · 🔴 el sesgo va en las DOS direcciones, y por eso no vale quedarse con un número', () => {
  // Si todas las discrepancias empujaran hacia el mismo lado, bastaría con usar el instrumento
  // conservador. No es el caso, y ésa es la razón de que la decisión de fundir sea de los fundadores.
  const direcciones = new Set(C.discrepancias.map((d) => `${d.uno}/${d.dos}`));
  assert.ok(direcciones.size >= 2,
    `🔴 todas las discrepancias van en la misma dirección (${[...direcciones].join(', ')}). Si eso ` +
    'fuera cierto, uno de los dos instrumentos sería estrictamente mejor y no haría falta la tabla. ' +
    'Compruébalo antes de creerlo.');
  assert.ok(direcciones.has(`${NO}/${SI}`), '🔴 falta la dirección «① huérfano · ② sí llega».');
  assert.ok(direcciones.has(`${SI}/${NO_SE}`), '🔴 falta la dirección «① llega · ② no sabe».');
});
