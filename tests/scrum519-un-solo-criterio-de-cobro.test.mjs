// SCRUM-519 · UN SOLO CRITERIO DE COBRO, Y QUE NO VUELVA A HABER TRES.
//
// Sin gate: ejercita el dominio compilado y lee las dos vistas. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ QUÉ VIGILA ESTE FICHERO Y QUÉ NO — porque son dos preguntas y tienen dos instrumentos
//
// ESTE test contesta «¿el criterio sigue existiendo UNA sola vez?».
// `npm run guard:vias-de-cobro` contesta «¿las dos pantallas dicen lo mismo EN LA PANTALLA?»,
// en Edge y sobre el DOM vivo, porque la suite no arranca un navegador (misma decisión que
// `guard:contraste`, `guard:caja-avisos` y `guard:aviso-bizum`).
//
// 🔴 Y NO SE FINGE QUE ESTE SUSTITUYA A AQUÉL. SCRUM-515 dejó medido que un test que lee el
// fichero da verde ante el defecto exacto: con el aviso pintado y barrido por un `innerHTML`
// posterior, los SIETE casos de `scrum328` siguieron pasando. Siete verdes sobre el fuente no
// valen uno sobre el DOM. Lo que hace este fichero es la otra mitad, la que el navegador no
// puede ver: si las tres pantallas volvieran a calcular el criterio por su cuenta y por
// casualidad coincidieran hoy, el guard de DOM las daría por coherentes — y volverían a
// separarse el día que alguien tocara una. Eso solo se ve por la FORMA, y se ve aquí.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA, medido el 19-ago-2026
//
//   `settingsView.js:990`   tarjeta de readiness    →  `!!(m.iban || m.bizumPhone)`
//   `homeView.js:309`       checklist de la Home    →  `!!(m.iban || m.bizumPhone)`
//   `avisoBizumSinTelefono` el aviso de la pantalla →  `bizumPhone || whatsappPhone`
//
// Tres sitios, dos criterios. Y el que tenía razón era el tercero: `whatsappPhone` SÍ vale como
// móvil de Bizum, y no es una opinión — es lo que hace el producto cuando el cliente va a pagar
// (`payInvoice.routes.ts:69`, `payBizum.routes.ts:145`).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const { viasDeCobro } = await import(DIST + 'modules/billing/domain/viasDeCobro.js');
const { decidirAvisoBizum, hayQueAvisar } = await import(DIST + 'modules/billing/domain/avisoBizumSinTelefono.js');

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const IBAN = 'ES9121000418450200051332';
const TEL = '+34000000001';

/** Las OCHO combinaciones de las tres fuentes. Excluyentes y exhaustivas: suman el total. */
const CASOS = [];
for (const iban of [null, IBAN]) {
  for (const bizumPhone of [null, '+34000000002']) {
    for (const whatsappPhone of [null, TEL]) {
      CASOS.push({ iban, bizumPhone, whatsappPhone });
    }
  }
}
const nombre = (c) => `${c.iban ? 'IBAN' : '—'}/${c.bizumPhone ? 'bizum' : '—'}/${c.whatsappPhone ? 'wa' : '—'}`;
const vias = (c, flagBizum = true) => viasDeCobro({ ...c, connectStatus: 'none', flagBizum });

// ── SUELO ────────────────────────────────────────────────────────────────────────────────
// «Las tres pantallas coinciden» y «el instrumento contesta siempre lo mismo» dan el mismo
// verde. Este bloque los separa antes de que ninguna cifra signifique nada.

test('SCRUM-519 · SUELO: la función DISTINGUE, no contesta siempre igual', () => {
  const respuestas = new Set(CASOS.map((c) => JSON.stringify(vias(c))));
  assert.ok(respuestas.size >= 3,
    `🔴 CIEGO: las ${CASOS.length} combinaciones producen solo ${respuestas.size} respuestas `
    + 'distintas. Una función que contesta casi siempre lo mismo haría pasar todo lo de abajo sin '
    + 'mirar nada — y «coinciden» sería cierto por no decir nada, no por acertar.');

  // Y que los ocho casos sean ocho de verdad: si dos fueran iguales, el censo contaría de menos.
  assert.equal(new Set(CASOS.map(nombre)).size, 8,
    '🔴 los casos declarados no son ocho distintos: el barrido no cubre lo que dice cubrir.');
});

test('SCRUM-519 · SUELO: el censo CUADRA — las categorías suman el total', () => {
  const conCobro = CASOS.filter((c) => vias(c).cobroManual);
  const sinCobro = CASOS.filter((c) => !vias(c).cobroManual);
  assert.equal(conCobro.length + sinCobro.length, CASOS.length,
    `🔴 el censo no cuadra: ${conCobro.length} con vía + ${sinCobro.length} sin vía ≠ `
    + `${CASOS.length} casos. Un censo cuyas categorías no suman su total no es un censo.`);
  // Y que la partición no sea trivial por ninguno de los dos lados.
  assert.ok(conCobro.length > 0 && sinCobro.length > 0,
    `🔴 partición degenerada (${conCobro.length}/${sinCobro.length}): si todos cayeran del mismo `
    + 'lado, «la tarjeta ya no miente» y «la tarjeta ya no dice ✅ nunca» serían indistinguibles.');
});

// ── 🔴 LA INVARIANTE · es el ticket entero ───────────────────────────────────────────────

test('SCRUM-519 · 🔴 las dos pantallas no pueden discrepar: mismo hecho, misma respuesta', () => {
  // El aviso y la tarjeta contestan a lo mismo —¿puede cobrar por Bizum?— y hasta hoy lo hacían
  // con criterios distintos. Aquí se comprueba caso a caso, NOMBRÁNDOLOS, que ya no.
  for (const c of CASOS) {
    const v = vias(c);
    const veredicto = decidirAvisoBizum({
      flagBizum: true, bizumPhone: c.bizumPhone, whatsappPhone: c.whatsappPhone,
    });
    const avisaria = hayQueAvisar(veredicto);

    assert.equal(v.bizum === true, !avisaria,
      `🔴 [${nombre(c)}] LAS DOS PANTALLAS DICEN COSAS DISTINTAS SOBRE BIZUM.\n\n`
      + `  la TARJETA («Tu cuenta, lista para cobrar») calcula bizum=${String(v.bizum)}\n`
      + `  el AVISO («te falta el móvil») dicta «${veredicto}» → ${avisaria ? 'avisa' : 'calla'}\n`
      + `  el campo que las separa: whatsappPhone=${c.whatsappPhone || 'sin poner'}, `
      + `bizumPhone=${c.bizumPhone || 'sin poner'}\n\n`
      + '  El profesional ve las dos en la MISMA pantalla, y la que mira primero es la que\n'
      + '  resume. El criterio vive en `src/modules/billing/domain/viasDeCobro.ts` y pregunta a\n'
      + '  `decidirAvisoBizum`: si esto discrepa, alguien ha vuelto a escribir la regla aparte.');
  }
});

test('SCRUM-519 · CONTROL: quien SÍ está listo lo sigue estando — caso por caso', () => {
  // Sin esto, «ya no miente» y «ya no dice ✅ nunca» dan el mismo verde. Se enumera, no se
  // comprueba en bloque: un `.some()` aquí dejaría pasar siete casos rotos y uno bueno.
  const esperado = {
    '—/—/—':          false, // ni IBAN ni teléfono: no puede cobrar por ninguna vía manual
    '—/—/wa':         true,  // 🔴 EL CASO DEL TICKET: cobra por Bizum, y antes la tarjeta lo negaba
    '—/bizum/—':      true,
    '—/bizum/wa':     true,
    'IBAN/—/—':       true,  // transferencia
    'IBAN/—/wa':      true,
    'IBAN/bizum/—':   true,
    'IBAN/bizum/wa':  true,
  };
  for (const c of CASOS) {
    const v = vias(c);
    assert.equal(v.cobroManual, esperado[nombre(c)],
      `🔴 [${nombre(c)}] cobroManual=${v.cobroManual} y se esperaba ${esperado[nombre(c)]}. `
      + `(transferencia=${v.transferencia}, bizum=${String(v.bizum)})`);
  }
  // Y el positivo que da sentido al resto: los que ya estaban bien no se han roto.
  assert.equal(CASOS.filter((c) => vias(c).cobroManual).length, 7,
    '🔴 han dejado de contar como listos merchants que sí lo están. El arreglo no puede ser '
    + '«apagar la tarjeta».');
});

test('SCRUM-519 · el teléfono ILEGIBLE no se cuenta como que lo tiene', () => {
  // El caso más peligroso, y el que `avisoBizumSinTelefono` existe para no colapsar: un dato que
  // no se sabe leer NO es «sí tiene». Degradarlo ahí sería afirmarle al profesional que puede
  // cobrar por una vía que quizá no funciona.
  const v = viasDeCobro({ iban: null, bizumPhone: 12345, whatsappPhone: null, connectStatus: 'none', flagBizum: true });
  assert.equal(v.bizum, null, `🔴 un bizumPhone ilegible se ha resuelto como ${String(v.bizum)}`);
  assert.equal(v.cobroManual, false,
    '🔴 con el teléfono ilegible y sin IBAN, la tarjeta diría que puede cobrar. Ese es el fallo '
    + 'mudo de SCRUM-328 reproducido una pantalla más arriba.');
  // Pero con IBAN sí puede cobrar, aunque el teléfono no se lea: son vías independientes.
  const conIban = viasDeCobro({ iban: IBAN, bizumPhone: 12345, whatsappPhone: null, connectStatus: 'none', flagBizum: true });
  assert.equal(conIban.cobroManual, true,
    '🔴 un teléfono ilegible ha tumbado la vía de transferencia, que no depende de él.');
});

test('SCRUM-519 · con el Bizum APAGADO, Bizum no es una vía disponible', () => {
  const v = vias({ iban: null, bizumPhone: null, whatsappPhone: TEL }, false);
  assert.equal(v.bizum, false,
    '🔴 con `BIZUM_MANUAL_ENABLED` apagado se sigue contando Bizum como vía. El flag se aplica '
    + 'aparte del criterio de teléfono a propósito: preguntar al aviso con el flag real haría que '
    + '«apagado» (`no_aplica`) se leyera como «tiene teléfono», que es lo contrario.');
  assert.equal(v.cobroManual, false, '🔴 sin IBAN y con Bizum apagado no hay vía manual ninguna');
});

// ── EL TRINQUETE · que no vuelva a haber tres copias ─────────────────────────────────────

test('SCRUM-519 · 🔴 ninguna vista vuelve a calcular el criterio por su cuenta', () => {
  // Esto es lo que el guard de navegador NO puede ver: si las tres pantallas recalcularan la
  // regla y hoy coincidieran por casualidad, el DOM saldría coherente y volverían a separarse en
  // cuanto alguien tocara una. Se vigila por la FORMA porque por el comportamiento es invisible.
  const VISTAS = ['public/dashboard/js/settingsView.js', 'public/dashboard/js/homeView.js'];
  for (const rel of VISTAS) {
    const fuente = leer(rel);
    // Se ignoran los comentarios: los de este mismo ticket CITAN la expresión vieja para explicar
    // qué se quitó, y un guard que se caza a sí mismo por su propia documentación se acaba
    // relajando (ha pasado cinco veces en esta casa, SCRUM-267 lo deja escrito).
    const ejecutable = fuente
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    assert.ok(!/iban\s*\|\|\s*\w*\.?bizumPhone/i.test(ejecutable),
      `🔴 «${rel}» ha vuelto a calcular por su cuenta si el merchant puede cobrar, con la forma `
      + '`iban || bizumPhone`.\n\n'
      + '  Ése es exactamente el defecto de SCRUM-519: esa expresión deja fuera `whatsappPhone`,\n'
      + '  que SÍ vale como móvil de Bizum (`payInvoice.routes.ts:69`), así que le dice «no\n'
      + '  puedes cobrar» a quien sí puede — y discrepa del aviso que hay dos pantallas más\n'
      + '  abajo.\n\n'
      + '  El veredicto lo sirve `GET /admin/merchant` en el campo `viasDeCobro`, y lo calcula\n'
      + '  `src/modules/billing/domain/viasDeCobro.ts`. Se consume, no se rehace.');
    // Y que SÍ consuma el veredicto: si no lo hiciera, el assert de arriba pasaría con la vista
    // sin criterio ninguno — verde por no calcular nada.
    assert.match(ejecutable, /viasDeCobro/,
      `🔴 «${rel}» ya no consume \`viasDeCobro\`. Sin criterio propio y sin el del servidor, esa `
      + 'pantalla no está diciendo nada — y el assert de arriba pasaría igual.');
  }
});

test('SCRUM-519 · SUELO: el detector de duplicación SABE acusar', () => {
  // Sin esto, el trinquete de arriba sería una expresión regular que nadie ha visto funcionar.
  const falso = 'const chargeReady = !!(m.iban || m.bizumPhone);';
  assert.ok(/iban\s*\|\|\s*\w*\.?bizumPhone/i.test(falso),
    '🔴 el patrón no reconoce la línea EXACTA que este ticket quitó de `settingsView.js:990`. '
    + 'Un trinquete que no caza el defecto original no vigila nada.');
  assert.ok(/iban\s*\|\|\s*\w*\.?bizumPhone/i.test('done: !!(merchant.iban || merchant.bizumPhone),'),
    '🔴 el patrón no reconoce la variante de `homeView.js:309`, que era la segunda copia.');
  assert.ok(!/iban\s*\|\|\s*\w*\.?bizumPhone/i.test('const vias = m.viasDeCobro || null;'),
    '🔴 el patrón acusa a la línea NUEVA: acusaría siempre y el trinquete sería inservible.');
});
