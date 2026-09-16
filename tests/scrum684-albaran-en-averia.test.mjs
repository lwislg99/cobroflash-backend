// tests/scrum684-albaran-en-averia.test.mjs — SCRUM-684
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UNA AVERÍA TAMBIÉN SE ENTREGA EN PAPEL
//
// LA ESCENA ES UNA, y el producto la partía en dos: SCRUM-651 abrió el TRABAJO DIRECTO —«nadie
// presupuesta una urgencia»— y ALB-02 existe porque el profesional **tiene que dejar papel al
// irse**. Hasta hoy se podía abrir la avería y NO se podía entregar albarán de ella.
//
// 🔴 Y EL GUARD DE SCRUM-257 NO ESTABA MAL. Su comentario decía, con razón EN AGOSTO, que «no hay
// endpoint de trabajo manual». El 2-sep SCRUM-651 abrió justo ese endpoint, sin saber de este
// guard y sin mencionar el albarán ni una vez. **El defecto nace de dos aciertos.**
//
// LO QUE SE VIGILA:
//   ① la AVERÍA pasa: sin presupuesto y sin líneas enlazadas, el veredicto es `ok`.
//   ② el caso que SÍ debe exigirlo SIGUE cayendo: una línea que dice venir de un presupuesto
//      que no existe. Y el mensaje NOMBRA cuál.
//   ③ las dos PUERTAS lo aplican — el `POST` y el `PATCH`—, porque hoy sólo estaba en una.
//   ④ CONTROL NEGATIVO: con presupuesto, nada cambia.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// 🔴 SÓLO EL VEREDICTO SE IMPORTA, y lo pidió el trinquete de SCRUM-411: el resto —el código de
// error, el detector de origen y el marcador— son internos, y exportarlos sólo para leerlos desde
// aquí serían exports huérfanos. Se miden por la SUPERFICIE PÚBLICA, que es además donde de verdad
// deciden: lo que el profesional recibe es `{ error, message }`, no una constante.
const { veredictoAlbaranSinPresupuesto } =
  await import('../dist/modules/jobs/domain/albaranSinPresupuesto.js');

/** El código de error tal y como viaja por la API. Es el contrato que el dashboard conoce. */
const ERROR_SIN_PRESUPUESTO = 'job_without_quote';
/** La grafía que CUENTA el censo de SCRUM-402/667. Se escribe aquí porque es lo que se exige. */
const MARCA = '[PENDIENTE';

/**
 * 📏 LA CAJA, medida en navegador real con el CSS de verdad — `.modal-overlay > .modal >
 * .alert.error`, que es donde `jobDetailView.js` pinta este 409 (líneas 1471 y 2523):
 *
 *     929 px → caja 472,0 px · útil 444,0 px → el texto firmado cabe en 1 línea
 *     390 px → caja 342,0 px · útil 314,0 px → 2 líneas
 *
 * Peor caso, el plural con dos números (78 caracteres): **2 líneas en los dos tamaños**. La
 * condición del asesor —que quepa en dos— se cumple con holgura.
 *
 * ⚠️ Se fija el tope para que un texto más largo obligue a volver a medir en vez de colarse.
 */
const LARGO_MAXIMO_MEDIDO = 78;

/** Una línea de albarán como la que manda el navegador. */
const linea = (extra) => ({ concepto: 'Sustituir diferencial', cantidad: 1, unidad: 'ud', ...extra });

// ─────────────────────────────────────────────────────────────────────────────────────────
// ① LA AVERÍA PASA — que es el ticket entero
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-684 · 🔴 una AVERÍA sin presupuesto puede entregar albarán', () => {
  // El caso de SCRUM-651: llaman por una avería, va un técnico, la arregla. Sin presupuesto y
  // sin nada que enlazar. Antes de este ticket, esto era un `409 job_without_quote`.
  for (const lineas of [undefined, [], [linea()], [linea(), linea({ concepto: 'Mano de obra' })]]) {
    const v = veredictoAlbaranSinPresupuesto(false, lineas);
    assert.equal(v.ok, true,
      '🔴 UNA AVERÍA SIGUE SIN PODER ENTREGAR PAPEL. Es la víctima de ALB-02 otra vez: el técnico '
      + `arregla y se va sin dejar nada. Líneas: ${JSON.stringify(lineas)}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ② EL CASO QUE SÍ DEBE EXIGIRLO SIGUE CAYENDO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-684 · 🔴 una línea que dice venir de un presupuesto que NO existe SIGUE en 409', () => {
  // 🔴 ÉSTE ES EL CASO REAL, MEDIDO, y no uno fabricado para que el control parezca completo:
  // `contarLineasDePresupuesto` devuelve `undefined` sin presupuesto, y entonces `validarLineas`
  // **conserva `quoteLineIndex` sin validarlo** — su propio comentario dice que «un enlace roto
  // es peor que ningún enlace, porque C6 se lo creería y respondería “no queda nada por
  // entregar” sobre una correspondencia que no existe».
  const v = veredictoAlbaranSinPresupuesto(false, [linea(), linea({ quoteLineIndex: 2 })]);
  assert.equal(v.ok, false,
    '🔴 SE ACEPTA UNA LÍNEA QUE AFIRMA UN ORIGEN INEXISTENTE. Eso guarda un enlace a un '
    + 'presupuesto que no está, y el motor de entrega pendiente se lo cree.');
  assert.equal(v.error, ERROR_SIN_PRESUPUESTO,
    '🔴 ha cambiado el código de error: el dashboard y los tests de la casa lo conocen');
  // Y el mensaje NOMBRA la línea, en base 1 —que es como las cuenta el profesional— y ANTES que
  // el motivo: es lo que necesita para arreglarlo, y es la condición con la que se firmó.
  assert.match(v.message, /^La línea 2\b/,
    `🔴 el mensaje no empieza nombrando QUÉ línea es: «${v.message}»`);
  assert.match(v.message, /no tiene ninguno/,
    '🔴 el mensaje no dice POR QUÉ. Un código crudo en pantalla es el defecto de SCRUM-275.');

  // ✅ APROBADO POR EL ASESOR el 4-sep-2026 (provisional, a la espera del fundador), con la caja
  // medida delante. El texto que el fundador firmó en SCRUM-257 decía «no se puede crear un
  // albarán», y desde que el guard se acota eso es FALSO — un mensaje aprobado que ha dejado de
  // ser verdad es peor que uno sin firmar, así que se firmó uno nuevo en vez de reciclarlo.
  assert.equal(v.message,
    'La línea 2 dice venir de un presupuesto y este trabajo no tiene ninguno.',
    '🔴 el texto ha cambiado sin pasar por quien lo aprueba (regla 30).');
  assert.equal(v.message.includes(MARCA), false,
    `🔴 ha vuelto un marcador a un mensaje ya firmado: «${v.message}»`);

  // Plural cuando son varias: un mensaje que dice «la línea 1, 3» se lee como un fallo del programa.
  const v2 = veredictoAlbaranSinPresupuesto(false, [linea({ quoteLineIndex: 0 }), linea(), linea({ quoteLineIndex: 1 })]);
  assert.equal(v2.ok, false);
  assert.equal(v2.message,
    'Las líneas 1, 3 dicen venir de un presupuesto y este trabajo no tiene ninguno.',
    `🔴 el plural no concuerda con el texto firmado: «${v2.message}»`);
});

test('SCRUM-684 · 🔴 el índice CERO cuenta como afirmación: `0` es una línea, no un hueco', () => {
  // La familia de SCRUM-271 y de `validarLineas`: `0` es un índice legítimo —la PRIMERA línea del
  // presupuesto— y tratarlo como «no viene» dejaría pasar justo el enlace más común.
  //
  // Se mide POR EL VEREDICTO y no por el detector suelto: el trinquete de SCRUM-411 pidió que ese
  // detector dejara de exportarse, y además es aquí donde de verdad decide.
  assert.equal(veredictoAlbaranSinPresupuesto(false, [linea({ quoteLineIndex: 0 })]).ok, false,
    '🔴 un `quoteLineIndex: 0` se está leyendo como «sin origen». Es la primera línea del '
    + 'presupuesto, y es el enlace que más se da.');

  // Y lo que NO es una afirmación de origen, uno a uno: si contaran, la avería volvería a
  // bloquearse por un campo que el navegador manda vacío.
  for (const vacio of [undefined, null, '']) {
    assert.equal(veredictoAlbaranSinPresupuesto(false, [linea({ quoteLineIndex: vacio })]).ok, true,
      `🔴 \`${JSON.stringify(vacio)}\` se lee como una afirmación de origen: eso volvería a `
      + 'bloquear la avería por un campo que el navegador manda vacío.');
  }
  // Basura: SÍ afirma un origen —y `validarLineas` la rechazará después por su cuenta—. Lo que
  // no puede es colarse por «no parece un número».
  assert.equal(veredictoAlbaranSinPresupuesto(false, [linea({ quoteLineIndex: 'x' })]).ok, false,
    '🔴 una basura en `quoteLineIndex` pasa como «sin origen»: sería la puerta de atrás');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ④ CONTROL NEGATIVO · con presupuesto no cambia NADA
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-684 · ✅ CONTROL NEGATIVO: con presupuesto, todo pasa como antes', () => {
  // Si esto cayera, el ticket habría cambiado el comportamiento de los trabajos normales, que son
  // la inmensa mayoría. El veredicto ni siquiera mira las líneas cuando hay presupuesto: quien
  // valida el rango del índice es `validarLineas`, y ésa no se toca.
  for (const lineas of [undefined, [], [linea()], [linea({ quoteLineIndex: 99 })], 'no es un array']) {
    assert.equal(veredictoAlbaranSinPresupuesto(true, lineas).ok, true,
      `🔴 con presupuesto, ${JSON.stringify(lineas)} ha dejado de pasar. Este ticket no toca ese `
      + 'camino: el rango del índice lo sigue validando `validarLineas` (SCRUM-367).');
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ③ LAS DOS PUERTAS · hoy el guard sólo estaba en una
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-684 · 🔴 el veredicto se aplica en las DOS puertas: crear y parchear', () => {
  const post = leer('src/modules/jobs/app/routes/jobs.routes.ts');
  const patch = leer('src/modules/jobs/app/routes/albaranes.routes.ts');

  assert.match(post, /veredictoAlbaranSinPresupuesto\(job\.quoteId != null, req\.body\?\.lineas\)/,
    '🔴 el POST ya no consulta el veredicto: o volvió el guard viejo, o no queda ninguno.');
  assert.match(patch, /veredictoAlbaranSinPresupuesto\([\s\S]{0,120}req\.body\.lineas\)/,
    '🔴 EL PATCH NO LO APLICA, y ésa es la puerta que NUNCA tuvo guard: medido, el `POST` traía '
    + '`job_without_quote` y el `PATCH` no. Sin esto, el enlace inventado entra por el otro lado.');

  // 🔴 Y EL GUARD VIEJO NO PUEDE VOLVER: un `if (!job.quoteId)` a secas bloquearía la avería otra
  // vez. Se busca la forma exacta que había, no la palabra suelta.
  assert.equal(/if \(!job\.quoteId\) \{[\s\S]{0,120}job_without_quote/.test(post), false,
    '🔴 HA VUELTO EL GUARD DE BROCHA GORDA. Bloquea la avería entera, que es lo que este ticket '
    + 'acaba de decidir que SÍ puede entregar papel.');
});

test('SCRUM-684 · 🔴 el mensaje no crece por encima de lo MEDIDO, y el contador dice quién falta', () => {
  // La caja está medida (arriba). Un texto más largo no se puede pintar sin volver a medirla: a
  // 390 px el peor caso ya ocupa las dos líneas que el asesor puso como condición.
  const peorCaso = veredictoAlbaranSinPresupuesto(false, [
    { concepto: 'a', cantidad: 1, unidad: 'ud', quoteLineIndex: 0 },
    { concepto: 'b', cantidad: 1, unidad: 'ud' },
    { concepto: 'c', cantidad: 1, unidad: 'ud', quoteLineIndex: 1 },
  ]);
  assert.ok(peorCaso.message.length <= LARGO_MAXIMO_MEDIDO,
    `🔴 el mensaje mide ${peorCaso.message.length} caracteres y lo medido en navegador fueron `
    + `${LARGO_MAXIMO_MEDIDO}. Vuelve a medir la caja a 390 px antes de alargarlo: ahí el peor caso `
    + 'ya ocupa las dos líneas que el asesor puso como condición.');

  // Y el contador de lo que sigue esperando la firma del FUNDADOR: que no haya marcador NO
  // significa que esté firmado por él (SCRUM-726).
  const dominio = leer('src/modules/jobs/domain/albaranSinPresupuesto.ts');
  const m = dominio.match(/const SIN_APROBAR = (\d+);/);
  assert.ok(m, '🔴 no hay contador de ranuras sin firmar: «sin marcador» se leería como «aprobado»');
  assert.equal(Number(m[1]), 1,
    `🔴 el contador dice ${m[1]} y el rechazo tiene UN texto. O ha entrado otro sin declararlo, o `
    + 'el fundador ha firmado y no se ha anotado.');
});

test('SCRUM-684 · el motivo está escrito donde el próximo lo va a buscar', () => {
  // Un cambio de regla sin motivo escrito se revierte solo dentro de dos meses. Se exige que el
  // porqué esté en el módulo, no en un commit que nadie relee.
  const dominio = leer('src/modules/jobs/domain/albaranSinPresupuesto.ts');
  for (const [que, patron] of [
    ['la escena de la avería', /nadie presupuesta una urgencia/i],
    ['que el guard viejo NO estaba mal', /con raz[óo]n entonces/i],
    ['la distinción medida', /quoteLineIndex/],
    ['que se descartaron los candidatos obvios', /tipoOperacion[\s\S]{0,400}tipoIntervencion/],
  ]) {
    assert.match(dominio, patron, `🔴 falta ${que} en el motivo escrito del módulo`);
  }
});
