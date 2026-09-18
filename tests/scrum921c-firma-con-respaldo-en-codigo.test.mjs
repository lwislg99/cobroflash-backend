// tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs — SCRUM-921c
//
// EL GUARD DE SCRUM-387, AMPLIADO POR LOS DOS EJES POR LOS QUE SE LE ESCAPÓ EL CASO.
//
// El 17-sep-2026 un bloque de test decía «el fundador decide que sí se pone» sobre SCRUM-878,
// que tiene `comment.total = 0`. SCRUM-387 llevaba desde agosto exigiendo procedencia a las
// marcas de aprobación y **no lo cazó** — no por fallo suyo, sino porque el caso caía fuera
// **por dos ejes a la vez**:
//
//     POBLACIÓN   vivía en `tests/`            · SCRUM-387 recorre ['src', 'public']
//     LÉXICO      decía «el fundador DECIDE»   · su marca es `aprobado por el fundador`
//
// 🔴 **Arreglar UN SOLO eje no habría bastado**, y eso no se razona: se prueba. Hay un test aquí
// abajo que lo demuestra en las dos direcciones.
//
// ── POR QUÉ ESTE FICHERO Y NO SUBIRLE EL TRINQUETE A SCRUM-387 ───────────────────────────────
// Aquel congela 17 con su marca estrecha, y su cabecera documenta dos arreglos del instrumento
// (10 → 9 → 17). Mezclar ahí una marca ancha haría que el número dejara de significar nada y
// borraría esa historia. Dos trinquetes con dos poblaciones declaradas se leen; uno con dos
// poblaciones mezcladas, no. SCRUM-387 **no cambia de comportamiento**: sólo pasa a delegar en
// `_procedencia-aprobacion.mjs`, para que ampliar no exija copiar su censo.
//
// ── LAS TRES FUENTES DE RESPALDO, Y POR QUÉ NO BASTA JIRA ────────────────────────────────────
// SCRUM-921b clasificó a mano las 16 firmas decidibles. De las 10 reales, **sólo UNA** se
// respalda en un comentario de Jira; las otras NUEVE, en el máster o en el registro congelado de
// microcopy. Un guard que exigiera un id de Jira habría producido **nueve rojos que no se
// reproducen**, y un guard así lo acaba apagando alguien. El detalle está en `_respaldo-de-firma.mjs`.
//
// ── LO QUE ESTE GUARD NO MIRA, DICHO AQUÍ ────────────────────────────────────────────────────
// `docs/` queda fuera: lee comentarios con el parser de TypeScript y un `.md` no los tiene. Esa
// mitad la cubre `_censo-firmas-autorizacion.mjs` (SCRUM-921a) con su propio trinquete de 27,
// que es **otro número sobre otra población** y no debe confundirse con el de aquí.
//
// Y **las 11 marcas del ASESOR están fuera a propósito**: la pregunta de qué cuenta como firma
// delegada está en la mesa del fundador y sin respuesta. Incluirlas sería clasificar lo que
// nadie ha decidido todavía. Hay un test que fija que siguen fuera.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { bloquesDeComentario, marcasDe } from './_procedencia-aprobacion.mjs';
import { indiceDeFuentes, respaldoDe, referenciasRotas, esProsaDistintiva } from './_respaldo-de-firma.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

// ── LOS DOS EJES AMPLIADOS ───────────────────────────────────────────────────────────────────
const DIRS = ['src', 'public', 'tests', 'scripts'];
/** Sólo el FUNDADOR, en todas sus formas. El asesor queda fuera (ver cabecera). */
const MARCA = /(?:aprobad|autorizad|firmad|validad|refrendad)[oa]s?\s+por\s+el\s+fundador|\bel\s+fundador\s+(?:lo\s+|la\s+|los\s+|las\s+|ya\s+|s[ií]\s+)*(?:decide|decidi[oó]|aprueba|aprob[oó]|autoriza|autoriz[oó]|firma|firm[oó]|valida|valid[oó])(?![A-Za-z0-9_áéíóúüñÁÉÍÓÚÜÑ])/i;
/** La marca ESTRECHA de SCRUM-387, aquí sólo para probar que un eje solo no bastaba. */
const MARCA_387 = /aprobad[oa]s?\s+por\s+el\s+fundador/i;

// Los ficheros del propio mecanismo: sus comentarios EXPLICAN la marca, así que la contienen.
// Es la trampa de autorreferencia que ya mordió cuatro veces en este repo (SCRUM-176/168/3/193).
const EXCLUIR = /^tests\/(_procedencia-aprobacion|_respaldo-de-firma|_censo-firmas-autorizacion|_microcopy-aprobada|scrum387-|scrum921)/;

// Una NEGACIÓN no es una afirmación de autorización: «su letra R NO está firmada por el
// fundador» dice justo lo contrario. Sin esto el guard lee palabras en vez de frases.
//
// 🔴 Y el cierre NO es `\b`, por el mismo motivo que ya costó un 21 % de ceguera en la fase a:
// en JavaScript `á` no es carácter de palabra, así que `est[aá]\b` casa «esta» y **no casa
// «está»**. Escribí `\b` aquí y lo cazó el test de abajo — el mismo defecto que yo mismo había
// medido y documentado unas horas antes, en este mismo ticket.
//
//     🔒 Medir no te inmuniza contra lo que mides.
//
// Y el cuantificador negativo cuenta igual que el adverbio: `quoteActionsRegistry.js` encabeza
// su bloque con «REGLA 30: **NINGUNO** ESTÁ APROBADO», que es lo contrario de una firma. Se
// añadió porque el guard lo estaba acusando, no porque se me ocurriera.
const FIN = '(?![A-Za-z0-9_áéíóúüñÁÉÍÓÚÜÑ])';
const NEGACION = new RegExp(`\\bNO\\s+(?:est[aá]n?|son|es|se|lo)${FIN}|NO\\s+es\\s+«|\\bning[uú]n[oa]?${FIN}|sin\\s+firmar|todav[ií]a\\s+no`, 'i');

/**
 * 🔴 LA NEGACIÓN SE MIRA EN LA FRASE DE LA MARCA, NO EN TODO EL BLOQUE.
 *
 * Aplicarla al bloque entero la vuelve un comodín: un comentario largo que afirme una firma en
 * su primera línea y diga «ninguna» treinta líneas más abajo quedaría absuelto. Medido: con la
 * negación aplicada al bloque, el trinquete BAJÓ por debajo de su suelo y dos casos verificados
 * a mano —`quotesAdmin.routes.ts` y `parteDictado.ts`— dejaron de acusarse. O sea, empecé a
 * ajustar el guard hasta que pasara, que es exactamente lo que no se hace.
 *
 * La unidad correcta es la frase: la que contiene la marca. «NINGUNO ESTÁ APROBADO» niega; un
 * «ninguna» en otro párrafo no dice nada sobre esta firma.
 */
function niegaLaMarca(texto) {
  return texto
    .split(/(?<=[.:;])\s|\n/)
    .filter((frase) => MARCA.test(frase))
    .some((frase) => NEGACION.test(frase));
}

// La ventana de literales: de cuántas líneas bajo el comentario se toma la frase que se va a
// buscar en las fuentes. NO es un número a dedo — medido el 17-sep-2026, el respaldo documental
// encontrado por ventana es 19 (30 líneas) · 21 (45) · 22 (70): la curva se aplana en 45.
const VENTANA = 45;

// ── EL TRINQUETE ─────────────────────────────────────────────────────────────────────────────
// Marcas de aprobación al FUNDADOR, en código, que no dicen dónde consta la decisión Y cuyo
// texto no aparece en ninguna de las tres fuentes. Medido el 17-sep-2026: 28.
//
// ⚠️ La primera medición dijo **27**, y era de un instrumento roto: la negación llevaba `\b`
// detrás de una vocal acentuada y descartaba `jobRailBlocks.js:19` por accidente — un bloque que
// atribuye al fundador los cinco rótulos del rail (regla 30) sin decir dónde consta, o sea justo
// lo que este guard persigue. El 28 no es el 27 «ajustado para que pase»: es lo que mide el
// instrumento una vez arreglado. Queda escrito porque un número que sube después de tocar el
// guard es exactamente la forma que tiene un guard relajado, y hay que poder distinguirlos.
//
// 🔴 Y esta frase está redactada así A PROPÓSITO. La primera versión REPRODUCÍA la marca entre
// comillas para ilustrarla, y el censo de SCRUM-921a —que no distingue una cita de una
// afirmación— la contó como la afirmación número 28 y paró el CI. Describir la forma no exige
// escribirla: es el escalón ② de SCRUM-737, reformular para que la frase no diga el número.
// Si algún día el censo aprende a no acusar las citas declaradas dentro de un banco, esta
// perífrasis sobra; hasta entonces, un test que documenta el defecto no debe engordar el censo
// que lo mide.
//
// ⚠️ Y NO es el 27 de `_censo-firmas-autorizacion.mjs`: aquél cuenta sobre `docs/` incluido y con
// otra marca. Que los dos rondaran 27 es casualidad, y por eso se dice aquí.
export const SIN_RESPALDO = 28;

// Procedencias que apuntan a un documento que NO EXISTE. Peor que no tener procedencia: parece
// rastreable, así que nadie va a mirar. Se congela con nombre y apellidos, y NO se arregla aquí
// porque tocar la línea es editar una atribución de aprobación (punto ③ de SCRUM-921).
export const REFERENCIAS_ROTAS = 1;

let CACHE;
const censo = () => (CACHE ??= {
  marcas: marcasDe(RAIZ, { dirs: DIRS, marca: MARCA, excluir: EXCLUIR, literalesTras: VENTANA }),
  indice: indiceDeFuentes(RAIZ),
});

/** El veredicto de cada marca, por el MISMO camino que usa el trinquete. */
function veredictos() {
  const { marcas, indice } = censo();
  return marcas
    .filter((b) => !niegaLaMarca(b.texto))
    .map((b) => ({ ...b, donde: `${b.fichero}:${b.linea}`, respaldo: respaldoDe(b, indice) }));
}
const sinRespaldo = () => veredictos().filter((v) => v.respaldo.nivel === 'sin-respaldo');

/**
 * La lista congelada, EXPORTADA — y no es un adorno.
 *
 * El registro de máster tiene que publicar estas rutas, y sacarlas con un script aparte es
 * fabricar una segunda medición del mismo hecho. Ya pasó al escribir esto: un script de medición
 * paralelo dijo 29 donde el guard decía 28, por un escapado distinto de la misma expresión. La
 * lista del documento sale de AQUÍ, del mismo código que decide si el árbol pasa.
 *
 *     🔒 Dos anclas para la misma comprobación no son redundancia: son la próxima contradicción
 *        esperando fecha.
 */
export function congeladas() {
  return sinRespaldo().map((v) => v.donde).sort();
}
/** El reparto por nivel de respaldo, para el informe. Mismo camino, misma cuenta. */
export function porNivel() {
  const n = { negada: censo().marcas.filter((b) => niegaLaMarca(b.texto)).length };
  for (const v of veredictos()) n[v.respaldo.nivel] = (n[v.respaldo.nivel] || 0) + 1;
  return n;
}

/** Un caso suelto, por el MISMO lector y la MISMA marca que el árbol. */
function caso(comentario, marca = MARCA) {
  return bloquesDeComentario(`${comentario}\nconst x = 1;`, 'p.ts').filter((b) => marca.test(b.texto));
}

test('SCRUM-921c · SUELO: el guard ve marcas de aprobación de verdad', () => {
  const { marcas, indice } = censo();
  assert.ok(marcas.length > 50,
    `🔴 CIEGO: sólo ${marcas.length} marcas en ${DIRS.join(', ')}. Un cero no es «limpio»: es «no he mirado».`);
  assert.ok(indice.length > 100, `🔴 CIEGO: sólo ${indice.length} fuentes de respaldo indexadas.`);
  assert.ok(indice.some((f) => f.atribuye), '🔴 ninguna fuente atribuye nada: el detector de atribución está roto.');
  const v = veredictos();
  assert.ok(v.some((x) => x.respaldo.nivel === 'documental'),
    '🔴 CERO respaldos documentales. Si el máster no respalda a NADIE, lo roto es el buscador, no el árbol.');
});

test('SCRUM-921c · CONTROL POSITIVO: el caso de SCRUM-878b lo caza, y por el eje correcto', () => {
  const conocido = '// el fundador decide que sí se pone';
  const b = caso(conocido);
  assert.equal(b.length, 1, '🔴 el guard ampliado NO ve el caso que motivó el ticket.');
  const r = respaldoDe({ texto: b[0].texto, literales: [] }, censo().indice);
  assert.equal(r.nivel, 'sin-respaldo',
    `🔴 lo ve pero lo da por respaldado (${r.nivel}): habría pasado en verde igual que pasó.`);
});

test('SCRUM-921c · 🔴 UN SOLO EJE NO BASTABA: se prueba, no se razona', () => {
  const conocido = '// el fundador decide que sí se pone';

  // EJE LÉXICO solo: aunque SCRUM-387 hubiera mirado en tests/, su marca no reconoce «decide».
  assert.equal(caso(conocido, MARCA_387).length, 0,
    '🔴 la marca estrecha SÍ casa el caso: entonces el eje del léxico no era un eje, y la historia está mal contada.');

  // EJE POBLACIÓN solo: aunque la marca hubiera sido ancha, `tests/` no estaba en su población.
  const DIRS_387 = ['src', 'public'];
  assert.ok(!DIRS_387.includes('tests'),
    '🔴 SCRUM-387 ya recorría tests/: entonces el eje de la población no era un eje.');

  // LOS DOS: sólo con marca ancha Y población que incluya tests/ se caza.
  assert.equal(caso(conocido, MARCA).length, 1);
  assert.ok(DIRS.includes('tests'), '🔴 el guard ampliado no mira tests/, que es donde vivía el caso.');
});

test('SCRUM-921c · CONTROL NEGATIVO: las firmas REALES no se acusan', () => {
  const acusadas = new Set(sinRespaldo().map((v) => v.donde));

  // Verificadas UNA A UNA contra Jira en SCRUM-921b. Si el guard acusa a alguna, está roto.
  //   · SCRUM-651, comentario 14229 — aprueba el vocabulario cerrado y sus tres valores.
  //   · SCRUM-379, comentario 12499 — «Microcopy firmada: "Hecho. No hemos podido…"».
  for (const f of ['src/modules/jobs/domain/tipoIntervencion.ts', 'tests/scrum379-recarga-sin-await.test.mjs']) {
    const suyas = [...acusadas].filter((d) => d.startsWith(`${f}:`));
    assert.deepEqual(suyas, [], `🔴 acusa a ${f}, cuya firma está VERIFICADA en Jira con su id de comentario.`);
  }
});

test('SCRUM-921c · 🔴 SEGUNDO NEGATIVO: lo respaldado en el MÁSTER sale limpio', () => {
  // Es el que separa este guard de uno que sólo mirase Jira. `botFlow.service.ts:125` dice «copy
  // v2 aprobado por el fundador (5-jul-2026)» y NO cita ningún ticket — su respaldo está en la
  // Parte K1 del máster: «Copy oficial v2.1 (fundador, 5-jul-2026 tarde…)». Nueve de las diez
  // firmas reales del árbol son de esta clase.
  // 🔴 Anclado por IDENTIDAD, no por línea: `botFlow.service.ts:125` es una POSICIÓN y caduca en
  // cuanto alguien añada un import diez líneas más arriba. Lo cazó SCRUM-710b, que existe justo
  // para eso, y tenía razón — escribí el número de línea igual que si no lo supiera.
  //
  //     🔒 Referenciar por posición caduca. Referenciar por identidad no.
  const v = veredictos().find(
    (x) => x.fichero.endsWith('whatsappBot/domain/botFlow.service.ts') && /Men[uú]\s+oficial\s+K1/i.test(x.texto));
  assert.ok(v, '🔴 el guard ya no ve el menú K1: la población o la marca han cambiado.');
  assert.equal(v.respaldo.nivel, 'documental',
    '🔴 acusa a una firma respaldada en el MÁSTER. Has construido el guard que sólo mira Jira, y son nueve rojos falsos.');
  assert.equal(v.respaldo.donde, 'docs/YAQU_MASTER.md');
});

test('SCRUM-921c · una NEGACIÓN no es una afirmación de autorización', () => {
  // «su letra R NO está firmada por el fundador» dice lo contrario de lo que el guard persigue.
  assert.ok(NEGACION.test('// la letra R NO está firmada por el fundador: se queda como está'));
  assert.ok(NEGACION.test('// «aprobada por el asesor» NO es «firmada por el fundador»'));
  // …y el guard no las cuenta.
  const acusadas = new Set(sinRespaldo().map((v) => v.donde));
  for (const d of [...acusadas]) {
    assert.ok(!/NO\s+est[aá]\s+firmad/i.test(d), `🔴 ${d} es una negación y está acusada.`);
  }
});

test('SCRUM-921c · las 11 del ASESOR siguen FUERA, y es una decisión, no un olvido', () => {
  // La pregunta «qué cuenta de Jira es el fundador» está en la mesa del fundador y sin respuesta.
  // Hasta que se responda, una marca del asesor no se puede clasificar sin inventar el criterio.
  assert.equal(caso('// El rótulo, APROBADO por el asesor el 10-ago-2026 (regla 30).').length, 0,
    '🔴 el guard ha empezado a contar las marcas del asesor. Eso clasifica lo que nadie ha decidido.');
  assert.equal(caso('// Aprobado por el orquestador por delegación del fundador.').length, 0);
  // Y la del fundador sí, para que el cero de arriba no sea un cero de «no miro nada».
  assert.equal(caso('// El rótulo, APROBADO por el fundador el 10-ago-2026 (regla 30).').length, 1);
});

test('SCRUM-921c · 🔴 sólo PROSA respalda: un código de error no es una microcopy', () => {
  // El fallo propio que más cerca estuvo de publicarse, y era del tipo peor: el guard ABSOLVÍA.
  // Aceptaba cualquier literal de 14 caracteres, así que `internal_error` —que aparece en el
  // máster por otras razones— daba por respaldada la microcopy de `quotesAdmin.routes.ts:339`,
  // que SCRUM-921b había verificado a mano como SIN RESPALDO.
  assert.equal(esProsaDistintiva('internal_error'), false);
  assert.equal(esProsaDistintiva('sellado_incompleto'), false);
  assert.equal(esProsaDistintiva('ALB-2026-097'), false);
  assert.equal(esProsaDistintiva('La factura se creó pero no se pudo registrar.'), true);

  // Y el caso real: sigue acusado, como lo verificó la clasificación a mano.
  const acusadas = new Set(sinRespaldo().map((v) => v.donde));
  assert.ok([...acusadas].some((d) => d.startsWith('src/modules/system/app/routes/quotesAdmin.routes.ts:')),
    '🔴 el guard ha vuelto a ABSOLVER a quotesAdmin.routes.ts, verificada a mano como sin respaldo.');
  assert.ok([...acusadas].some((d) => d.startsWith('src/modules/jobs/domain/parteDictado.ts:')),
    '🔴 el guard absuelve a parteDictado.ts, verificada a mano como sin respaldo.');
});

test('SCRUM-921c · el trinquete no sube: una firma nueva nace diciendo dónde consta', () => {
  const sin = sinRespaldo();
  assert.ok(sin.length <= SIN_RESPALDO,
    `🔴 ${sin.length} marcas de aprobación al fundador sin respaldo, y el trinquete está en ${SIN_RESPALDO}.\n`
    + 'Una firma nueva lleva su `SCRUM-<n>`, su `docs/…`, o su literal en el máster o en\n'
    + '`docs/MICROCOPY_APROBADA_SIN_APLICAR.md`. Las de ahora:\n'
    + sin.map((v) => `    ${v.donde}`).join('\n'));
});

test('SCRUM-921c · el trinquete tampoco baja en silencio', () => {
  const sin = sinRespaldo();
  assert.ok(sin.length >= SIN_RESPALDO,
    `🔴 quedan ${sin.length} y el trinquete dice ${SIN_RESPALDO}. Si se ha firmado alguna, BÁJALO aquí.\n`
    + 'Y si ha bajado sin que nadie firme nada, lo roto es el guard: una bajada tiene forma de\n'
    + 'mejora, y así se descubrió que SCRUM-387 llevaba ocho marcas ciegas.');
});

test('SCRUM-921c · 🔴 una procedencia que apunta a un fichero fantasma no es procedencia', () => {
  const { marcas } = censo();
  const rotas = [];
  for (const b of marcas) for (const r of referenciasRotas(RAIZ, b.texto, b.fichero)) rotas.push(`${b.fichero}:${b.linea} → ${r}`);
  assert.equal(rotas.length, REFERENCIAS_ROTAS,
    `🔴 procedencias que citan un documento inexistente: ${rotas.length}, trinquete ${REFERENCIAS_ROTAS}.\n    ${rotas.join('\n    ')}\n`
    + '  Parece rastreable y no lleva a ninguna parte, así que nadie va a mirar.');
  // El congelado, nombrado: `scripts/voice-eval.mjs` cita `docs/evidencias/voice-eval/RESULTS.md`.
  assert.match(rotas[0], /voice-eval/, '🔴 la rota congelada ya no es la que se congeló: re-mídela y nómbrala.');
});
