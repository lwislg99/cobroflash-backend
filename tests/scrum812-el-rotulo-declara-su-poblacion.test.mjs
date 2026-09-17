// tests/scrum812-el-rotulo-declara-su-poblacion.test.mjs — SCRUM-812
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL INSTRUMENTO CONTABA BIEN Y NOMBRABA MAL, Y EL NOMBRE ERA LA MITAD DEL DEFECTO.
//
// `meta:mutaciones` publicaba una línea de censo que llamaba «guards» a los que DECLARAN y,
// debajo, «mudas 0». (La cifra no se copia aquí: SCRUM-737 ② — una frase sin número no se
// desincroniza, y este comentario envejecería con el árbol.)
// Las dos líneas juntas se leían como «todos los guards están cubiertos», y ninguna lo decía: el
// censo sale de `censoConPoblacion`, que sólo recoge a los que DECLARAN. Un guard que no declara
// no entra en el denominador ni para bien ni para mal.
//
// Este fichero vigila las tres piezas del arreglo:
//   ① la PALABRA .......... «ficheros DECLARANTES», no «guards»
//   ② el DENOMINADOR ...... «81 de 885», que el instrumento ya tenía delante
//   ③ el LÍMITE ........... pegado al subconjunto auto-declarado, para que no se lea como censo
// y pone un TRINQUETE en la cuarta: que la cobertura auto-declarada no baje en silencio.
//
// ⛔ LO QUE AQUÍ NO SE DEFINE: qué es un guard. El árbol no tiene esa definición y no es de esta
// sesión darla. Por eso se vigila que el rótulo DIGA que no es un censo de guards, en vez de
// intentar que lo sea.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censoConPoblacion, seTitulaGuard, sueloDePoblacion, rotuloDelCenso,
} from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_TESTS = path.join(RAIZ, 'tests');

/** Lo que el lector OFICIAL ve hoy en el árbol. Una sola pasada para todo el fichero. */
const HOY = censoConPoblacion(DIR_TESTS);

/** Los que se titulan GUARD *y* declaran, uno a uno — para que el rojo sea accionable. */
function tituladosQueDeclaran() {
  const declaran = new Set(HOY.censo.filter((c) => c.mutaciones.length).map((c) => c.guard));
  return fs.readdirSync(DIR_TESTS)
    .filter((f) => f.endsWith('.test.mjs') && declaran.has(f))
    .filter((f) => seTitulaGuard(fs.readFileSync(path.join(DIR_TESTS, f), 'utf8')));
}

/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * EL TRINQUETE · cuántos ficheros se titulan GUARD **y** declaran su mutación.
 *
 * ⚓ ANCLADO: medido el **17-sep-2026 a las 19:0xZ** sobre `origin/main` =
 * `f52ff943e5a0ddff5c07aa760dbd8bc07a6acd8d`. Reparto de ese árbol:
 * 885 ficheros de test · 81 declarantes · 206 se titulan GUARD · **19** cumplen las dos cosas.
 *
 * ⚠️ **ESTE FICHERO ES UNO DE LOS 19, y hay que decirlo.** Titula sus tests GUARD y declara sus
 * mutaciones, así que entra en la población que mide. Medido antes de escribirlo eran 18; el 19
 * lo hace él. Un instrumento que se cuenta a sí mismo no está mal siempre que lo declare — lo
 * que estaría mal es publicar 18 después de haber añadido el decimonoveno.
 *
 * ── 🔴 POR QUÉ ESTE NÚMERO Y NO EL DEL HUECO, que era mi propuesta ──────────────────────────
 * La propuesta de SCRUM-812 pedía un trinquete «tipo `TOPE_PROSA_MUDA`», o sea un TOPE sobre la
 * zona ciega: los que se titulan GUARD y NO declaran, hoy 188. **Medido, ese tope no se puede
 * sostener:** nacen entre 7 y 12 al día (7 el 17-sep, 7 el 16, 12 el 15). Un tope ahí se pondría
 * rojo a diario, y las dos únicas salidas verdes serían
 *   ① escribir una declaración sin haber medido si imita el defecto que su guard vigila — que es
 *      justo lo que este ticket PROHÍBE, porque fabrica cobertura aparente; o
 *   ② subir el tope, que es apagar el aviso.
 * Un trinquete cuyas salidas son una acción prohibida o su propio interruptor no es un trinquete.
 * Y hay precedente de lo que cuesta: A12 — un barrido correcto dejó el check obligatorio en rojo
 * para los 22 PR abiertos a la vez.
 *
 * El 19, en cambio, sólo se mueve cuando alguien adopta el mecanismo en un guard nuevo (~1 al
 * día) o cuando alguien **QUITA** una declaración. Lo segundo es retirar cobertura en silencio, y
 * es exactamente el descuido que un trinquete debe convertir en decisión.
 *
 * ⛔ NO se sube este número escribiendo declaraciones a granel. Se sube de una en una, cada una
 * con su medición de que la mutación imita el defecto que su guard promete cazar.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
export const SUELO_GUARD_QUE_DECLARAN = 19;

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ① SUELO · ¿he mirado algo? Un cero de población no es «no hay»: es «no he mirado».
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-812 · 🔴 SUELO del GUARD: sobre población CERO se declara CIEGO, no cero', () => {
  // El suelo es una función pura a propósito: así se le puede exigir el rojo en milisegundos, sin
  // pagar los minutos del trabajo entero. Un suelo al que nadie ha visto caer es una decoración.
  const motivo = sueloDePoblacion({ poblacion: 0 });
  assert.ok(motivo, '🔴 con CERO ficheros leídos el suelo calla, así que el censo publicaría un '
    + '«0 declarantes» que en realidad significa «no he mirado nada».');
  assert.match(motivo, /no he mirado nada/,
    '🔴 el motivo no distingue «no hay» de «no he mirado», que es la distinción entera.');

  // CONTROL POSITIVO: con población, el suelo calla.
  assert.equal(sueloDePoblacion({ poblacion: 1 }), null,
    '🔴 el suelo salta con población válida: sería un CIEGO permanente.');

  // Y el lector oficial VE el árbol de verdad — si esto fuera 0, todo lo de abajo sería una
  // tautología sobre el vacío.
  assert.ok(HOY.poblacion > 100,
    `🔴 CIEGO: el lector oficial sólo ve ${HOY.poblacion} ficheros en \`tests/\`.`);
  assert.ok(HOY.declarantes > 0 && HOY.titulados > 0,
    `🔴 CIEGO: declarantes=${HOY.declarantes}, titulados=${HOY.titulados}. Con un cero ahí, el `
    + 'rótulo de abajo no describe nada.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ② EL GUARD DEL RÓTULO · la palabra y el denominador
//
// Se ejerce sobre cifras FABRICADAS, no sobre el árbol: un guard que necesita que el árbol tenga
// un número concreto para probarse se rompe cada vez que el árbol crece.
// ─────────────────────────────────────────────────────────────────────────────────────────────
const FABRICADO = {
  poblacion: 900, declarantes: 80, declaraciones: 240, titulados: 200, tituladosQueDeclaran: 20,
};

test('SCRUM-812 · 🔴 GUARD del rótulo: dice DECLARANTES y publica su DENOMINADOR', () => {
  const [primera] = rotuloDelCenso(FABRICADO);

  assert.match(primera, /ficheros DECLARANTES/,
    '🔴 el rótulo ha vuelto a llamar «guards» a los que DECLARAN. Es el defecto de SCRUM-812: el '
    + 'instrumento cuenta bien y nombra mal, y «N guards · mudas 0» se lee como «todos los '
    + 'guards están cubiertos».');
  assert.doesNotMatch(primera, /\d+ guards/,
    '🔴 el rótulo vuelve a decir «N guards». Nadie confunde «declarantes» con «todos»; «guards» '
    + 'sí se confunde, y por eso no puede volver.');
  // El denominador, y que sea el de VERDAD y no un literal: se pide el que se le pasó.
  assert.match(primera, /de 900 ficheros de test/,
    '🔴 el rótulo ha perdido su denominador. «80 declarantes» sin «de 900» es un numerador '
    + 'suelto: no se puede saber si cubre el árbol o una esquina (A3).');
  assert.match(primera, /\(9 %\)/,
    '🔴 falta el porcentaje derivado. 80 de 900 es 9 %: si no sale, el lector tiene que dividir.');
});

test('SCRUM-812 · 🔴 EL QUE DECIDE: el subconjunto auto-declarado lleva su LÍMITE PEGADO', () => {
  const lineas = rotuloDelCenso(FABRICADO);
  const texto = lineas.join('\n');

  // El subconjunto, como cifra propia.
  assert.match(texto, /subconjunto AUTODECLARADO/,
    '🔴 el subconjunto auto-declarado ya no se publica con su nombre, así que sus cifras se leen '
    + 'como si fueran del censo general.');
  assert.match(texto, /200 ficheros se titulan GUARD/,
    '🔴 el subconjunto no publica su propio denominador.');

  // 🔴 Y SU LÍMITE, que es lo que decide. Un subconjunto sin su límite al lado se lee como un
  // censo — el mismo defecto que la primera línea, dos líneas más abajo.
  assert.match(texto, /DÉBIL EN LAS DOS DIRECCIONES/,
    '🔴 el rótulo publica el subconjunto SIN decir que la señal es débil en las dos direcciones. '
    + 'Entonces «200 se titulan guard · 20 declaran» se lee como «hay 200 guards y 180 sin '
    + 'cubrir», y ninguna de las dos cosas está medida.');
  // La otra dirección, DERIVADA y no pegada a mano: 80 declarantes − 20 titulados = 60.
  assert.match(texto, /60 declaran SIN llamarse guard/,
    '🔴 falta la mitad del límite: que la mayoría de los que declaran NO se llaman guard. Sin '
    + 'eso, «20 de 200» parece la cobertura de los guards, y no lo es.');
  assert.match(texto, /no está definido en el árbol/,
    '🔴 el rótulo ya no dice que «guard» no está definido en el árbol. Publicar «X de Y guards» '
    + 'sin esa definición es cometer dentro del instrumento el defecto que vino a denunciar.');

  // SUELO del control: si `rotuloDelCenso` devolviera una sola línea, los `match` de arriba
  // podrían pasar todos sobre un texto que no publica nada aparte.
  assert.equal(lineas.length, 3,
    `🔴 el rótulo ya no son tres líneas (${lineas.length}): la del censo, la del subconjunto y la `
    + 'del límite. Si se fusionan, el límite deja de estar PEGADO al subconjunto.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ③ EL TRINQUETE
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-812 · 🔴 EL TRINQUETE del GUARD: la cobertura auto-declarada NO BAJA', () => {
  const lista = tituladosQueDeclaran();

  assert.ok(
    lista.length >= SUELO_GUARD_QUE_DECLARAN,
    `🔴 LA COBERTURA AUTO-DECLARADA HA BAJADO: ${lista.length} ficheros se titulan GUARD y `
      + `declaran, y el suelo es ${SUELO_GUARD_QUE_DECLARAN}.\n\n`
      + '  Alguien ha QUITADO una declaración de un fichero que se llama guard a sí mismo, o ha\n'
      + '  quitado el título. Las dos cosas retiran cobertura, y el meta-guard seguiría en verde\n'
      + '  porque su censo sólo mira a los que declaran: el que se va desaparece del\n'
      + '  denominador en vez de contar como hueco. Eso es el defecto de SCRUM-812 en marcha.\n\n'
      + '  ⛔ Y NO bajes el suelo: eso es apagar el aviso, no atenderlo.\n',
  );

  // Y si SUBE, se anota — un suelo que se queda por debajo del real es decoración, y esto está
  // medido en el propio árbol: `SUELO_GUARDS` dice 20 cuando la realidad son 81, y por eso ya no
  // puede cazar nada. Un trinquete no prohíbe el futuro; obliga a que pase por una decisión.
  assert.equal(
    lista.length, SUELO_GUARD_QUE_DECLARAN,
    `✋ LA COBERTURA HA SUBIDO a ${lista.length} (el suelo decía ${SUELO_GUARD_QUE_DECLARAN}). Es `
      + 'buena noticia y hay que ANOTARLA: sube `SUELO_GUARD_QUE_DECLARAN` y re-ancla su fecha y '
      + 'su sha en el comentario de arriba. Un suelo que se queda por debajo del real deja hueco '
      + 'para volver a bajar sin aviso — es lo que le pasó a `SUELO_GUARDS`, que dice 20 sobre un '
      + `árbol de ${HOY.declarantes} declarantes.\n  Los que hay hoy:\n    · `
      + lista.join('\n    · '),
  );
});

test('SCRUM-812 · 🔴 mi ancla ④ muta la CONSTANTE, no el texto que la cita', () => {
  // El ancla de la mutación ④ aparece DOS veces en este fichero, y por construcción: la línea de
  // la constante, y la propia declaración que la copia para poder mutarla. El meta-guard hace
  // `texto.replace(de, a)`, que toma la PRIMERA — así que el ORDEN decide cuál se muta.
  //
  // 🔴 Si alguien moviera `MUTACIONES_QUE_ME_TUMBAN` por encima de la constante, la mutación
  // reescribiría el texto de la declaración, la constante seguiría en su valor, el trinquete
  // seguiría en verde y el veredicto saldría **MUDO** — acusando a este guard de no vigilar algo
  // que sí vigila. Es el defecto de SCRUM-839e (mutar un sitio por el que el test no pasa), y
  // aquí se cierra por el orden en vez de por la suerte.
  //
  // `TOPE_PROSA_MUDA` (scrum758) tiene la misma forma y el mismo riesgo sin vigilar: si esto
  // aguanta, allí conviene copiarlo — se REPORTA, no se arregla de paso.
  const yo = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const ANCLA = `export const SUELO_GUARD_QUE_DECLARAN = ${SUELO_GUARD_QUE_DECLARAN};`;

  // SUELO del control: que el ancla exista, o lo de abajo sería cierto sobre la nada.
  const veces = yo.split(ANCLA).length - 1;
  assert.equal(veces, 2, `🔴 el ancla aparece ${veces} veces y se esperaban 2 (la constante y su `
    + 'declaración). Si aparece 1, la declaración ha dejado de citarla y la mutación ④ está '
    + 'CIEGA; si aparece 3, hay una copia de más y `replace` puede tocar cualquiera.');

  // EL QUE DECIDE: la PRIMERA ocurrencia es la línea de la constante, o sea empieza en columna 0.
  // La copia de la declaración va indentada dentro del array, así que nunca lo está.
  const i = yo.indexOf(ANCLA);
  assert.ok(i === 0 || yo[i - 1] === '\n',
    '🔴 la PRIMERA ocurrencia del ancla ya no es la declaración de la constante: está indentada, '
    + 'o sea que es la copia de dentro de `MUTACIONES_QUE_ME_TUMBAN`. La mutación ④ mutaría ese '
    + 'texto en vez de la constante, el trinquete no caería y el meta-guard diría MUDO de un '
    + 'guard sano. Deja la constante ANTES del array.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA MUTACIÓN QUE ME TUMBA (SCRUM-745)
//
// Las cuatro imitan el defecto de este ticket, cada una por su lado: el nombre, el denominador,
// el límite y el trinquete. Ninguna es un cambio cosmético — todas hacen que el instrumento
// vuelva a publicar una cifra que se lee mejor de lo que es.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① El nombre vuelve atrás: cuenta a los declarantes y los llama «guards».
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: 'censo · ${declarantes} ficheros DECLARANTES de ${poblacion} ficheros de test ',
    a: 'censo · ${declarantes} guards de ${poblacion} ficheros de test ',
    cae: 'SCRUM-812 · 🔴 GUARD del rótulo: dice DECLARANTES y publica su DENOMINADOR',
  },
  {
    // ② El límite se cae del rótulo y el subconjunto se queda solo, leyéndose como un censo.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: 'la señal es DÉBIL EN LAS DOS DIRECCIONES',
    a: 'la señal es buena',
    cae: 'SCRUM-812 · 🔴 EL QUE DECIDE: el subconjunto auto-declarado lleva su LÍMITE PEGADO',
  },
  {
    // ③ El suelo de población deja de distinguir «no hay» de «no he mirado»: sobre un `tests/`
    // vacío el censo publicaría «0 declarantes» como si fuera un dato del árbol.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (poblacion > 0) return null;',
    a: '  return null; // el suelo ya no distingue «no hay» de «no he mirado»',
    cae: 'SCRUM-812 · 🔴 SUELO del GUARD: sobre población CERO se declara CIEGO, no cero',
  },
  {
    // ④ El trinquete se afloja una unidad: deja hueco para que la cobertura baje sin aviso.
    fichero: 'tests/scrum812-el-rotulo-declara-su-poblacion.test.mjs',
    de: 'export const SUELO_GUARD_QUE_DECLARAN = 19;',
    a: 'export const SUELO_GUARD_QUE_DECLARAN = 18;',
    cae: 'SCRUM-812 · 🔴 EL TRINQUETE del GUARD: la cobertura auto-declarada NO BAJA',
  },
];
