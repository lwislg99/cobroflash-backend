// tests/scrum391-guards-declarados-presentes.test.mjs — SCRUM-391
//
// ¿ESTÁ EN EL ÁRBOL LO QUE DECIMOS QUE NOS VIGILA?
//
// ── EL DEFECTO ──────────────────────────────────────────────────────────────────────────────
// El mecanismo se mergea y su vigilante se queda en la rama. Y entonces pasa lo peor que puede
// pasar con un guard: **su ausencia y su verde son indistinguibles desde fuera**. Nadie ve un
// error, la suite pasa, y encima —éste es el agravante— al construir sobre algo que creemos
// vigilado nadie vuelve a comprobarlo a mano. El guard ausente no solo no protege: **retira la
// desconfianza que lo habría sustituido**.
//
// S1 midió 16 casos así el 6-ago-2026. Este fichero no los trae de vuelta: impide que vuelva a
// pasar. Es hermano de SCRUM-378 y SCRUM-381 —la misma pregunta una capa más arriba.
//
// ── DE DÓNDE SALE LA LISTA: DE LAS ENTRADAS, NO DE UNA LISTA A MANO ─────────────────────────
// Cada `docs/master/SCRUM-<n>.md` **declara** los tests del ticket (convención de SCRUM-273: la
// constancia del trabajo va en su entrada). Así que la fuente es la constancia misma: se leen las
// rutas `tests/*.test.mjs` que las entradas nombran y se exige que EXISTAN en el árbol.
//
// Una lista escrita aquí tendría el defecto que este ticket cierra: no avisa de lo que le falta.
//
// ⚠️ NO SE INSPECCIONAN LITERALES DE CÓDIGO. Se leen RUTAS de fichero en markdown, que no pueden
// «pasar a ser una expresión»: la trampa del ternario/`||`/objeto indexado que nos mordió tres
// veces no aplica aquí, y por eso este detector no puede quedarse ciego de esa forma.
//
// ⚠️ Y NO HAY ALLOWLIST. Una excepción que hay que mantener es una excepción que alguien acaba
// ampliando. Si una entrada declara un test que ya no debe existir, **lo que se corrige es la
// entrada** — que es exactamente la constancia que dejó de ser cierta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR_MASTER = path.join(RAIZ, 'docs/master');

/**
 * ⚠️ DECLARAR NO ES MENCIONAR, y la primera versión de este guard no lo distinguía.
 *
 * Al escribir la entrada de ESTE ticket cité en una tabla los tests huérfanos de otro — y el
 * detector los contó como si yo los declarara: **mi propia documentación fabricó tres huérfanos
 * nuevos**. Lo mismo hacía `SCRUM-369.md`, que nombra un test de 300 dentro de una cita en prosa.
 *
 * Un guard que da falsos positivos es un guard que alguien acaba silenciando, así que la
 * distinción tenía que existir — y DERIVARSE, no listarse:
 *
 *   · una entrada **DECLARA** el test cuyo número de ticket es el SUYO → se exige que exista;
 *   · si nombra el de otro ticket, es una **REFERENCIA** → no se exige aquí, porque **su dueño ya
 *     lo declara en su propia entrada**. No se pierde cobertura: cambia quién responde por él.
 *
 * Se descartó acotar a la sección «Ficheros»: solo 58 de las 104 entradas la usan, así que habría
 * cegado el detector en las otras 46 — y quedarse ciego es el defecto que este fichero persigue.
 */
const numeroDeEntrada = (f) => (f.match(/^SCRUM-(\d+)\.md$/) || [])[1] ?? null;
const esSuyo = (numero, ruta) => new RegExp(`^tests/scrum${numero}[^0-9]`, 'i').test(ruta);

/** Toda ruta `tests/…​.test.mjs` que una entrada DECLARA como suya. */
function declaracionesDeTests() {
  let ficheros;
  try {
    ficheros = fs.readdirSync(DIR_MASTER);
  } catch (e) {
    // No poder leer NO es «no hay nada declarado». Se dice qué falló y se cae.
    assert.fail(
      `🔴 no se pudo leer ${DIR_MASTER} (${e && e.code ? e.code : e}).\n\n`
      + '  Este guard no puede afirmar que están todos sin haber mirado: «no supe leer el\n'
      + '  directorio» y «están todos» son el mismo verde.');
  }
  const propias = [];
  const referencias = [];
  for (const f of ficheros) {
    const numero = numeroDeEntrada(f);
    if (!numero) continue; // README y notas no declaran nada
    const texto = fs.readFileSync(path.join(DIR_MASTER, f), 'utf8');
    for (const ruta of new Set([...texto.matchAll(/tests\/[A-Za-z0-9_.-]+\.test\.mjs/g)].map((m) => m[0]))) {
      (esSuyo(numero, ruta) ? propias : referencias).push({ entrada: f, ruta });
    }
  }
  return { propias, referencias };
}

// El suelo es un NÚMERO, y se sube a mano a propósito: derivarlo del propio directorio haría que
// borrar entradas bajara el mínimo y el suelo dejara de ser suelo (lección de SCRUM-379).
const MINIMO_ENTRADAS = 90;
const MINIMO_DECLARACIONES = 90;

test('SCRUM-391 · SUELO: el detector encuentra entradas y declaraciones de verdad', () => {
  const entradas = fs.readdirSync(DIR_MASTER).filter((f) => /^SCRUM-\d+\.md$/.test(f));
  const { propias: decls, referencias } = declaracionesDeTests();
  assert.ok(entradas.length >= MINIMO_ENTRADAS,
    `🔴 solo ${entradas.length} entradas de máster: el detector no está mirando donde cree. «Están todos» y «no supe mirar» son el mismo verde`);
  assert.ok(decls.length >= MINIMO_DECLARACIONES,
    `🔴 solo ${decls.length} tests declarados en ${entradas.length} entradas: si las entradas dejaron de nombrar sus tests, este guard no vigila nada`);
  // Y el otro cero que importa: si NINGUNA entrada nombrara un test ajeno, el separador
  // declaración/referencia no estaría separando nada y podría estar tragándose declaraciones.
  assert.ok(referencias.length > 0,
    '🔴 cero referencias ajenas: el separador entre DECLARAR y MENCIONAR no está distinguiendo nada, así que podría estar descartando declaraciones de verdad');
});

test('SCRUM-391 · CONTROL NEGATIVO: una declaración que SÍ existe no salta', () => {
  // Sin esto, un detector que marcara todo como huérfano pasaría el rojo de abajo y sería
  // inservible. Se comprueba con la declaración de ESTE fichero, que existe por construcción.
  const propio = path.join(RAIZ, 'tests/scrum391-guards-declarados-presentes.test.mjs');
  assert.ok(fs.existsSync(propio), 'este mismo fichero tiene que existir para que el control valga');
  const { propias: decls, referencias } = declaracionesDeTests();
  const presentes = decls.filter(({ ruta }) => fs.existsSync(path.join(RAIZ, ruta)));
  assert.ok(presentes.length > 0,
    '🔴 el detector no reconoce NINGUNA declaración como presente: está roto, no es que falten todas');
});

test('SCRUM-391 · todo test DECLARADO en una entrada EXISTE en el árbol', () => {
  const huerfanos = declaracionesDeTests().propias
    .filter(({ ruta }) => !fs.existsSync(path.join(RAIZ, ruta)))
    .map(({ entrada, ruta }) => `${entrada} declara ${ruta}, que NO está en el árbol`);

  assert.deepEqual(
    huerfanos, [],
    '🔴 HAY GUARDS HUÉRFANOS: la entrada afirma que un mecanismo está vigilado y el vigilante no está.\n    '
    + huerfanos.join('\n    ')
    + '\n\n  Su ausencia y su verde son indistinguibles desde fuera, y encima retiran la desconfianza\n'
    + '  que los habría sustituido: nadie vuelve a comprobar a mano lo que cree vigilado.\n\n'
    + '  ── LA REGLA, por si estabas EXPLICANDO y no declarando ─────────────────────────────\n'
    + '  UNA CONSTANCIA NO ESCRIBE LA RUTA DE UN FICHERO QUE NO EXISTE, ni siquiera para\n'
    + '  explicar por qué no existe. El motivo se escribe NOMBRANDO LO QUE SÍ EXISTE —el test\n'
    + '  que hoy cubre aquello—, no la ruta del que se fue.\n\n'
    + '  Se dice AQUÍ a propósito, y es lo único que sostiene esa regla: este guard NO puede\n'
    + '  distinguir «declaro este test» de «explico por qué retiré su declaración» —las dos\n'
    + '  escriben la misma cadena— y NO DEBE intentarlo: cualquier marca que las separase\n'
    + '  («RETIRADA:», una sección aparte) sería una lista de excepciones con otro nombre.\n'
    + '  Tampoco distingue un test RETIRADO de uno que NUNCA SE ESCRIBIÓ: los dos son «ruta\n'
    + '  que no está». No le pidas un diagnóstico que no puede dar.\n\n'
    + '  Dos salidas, las dos honestas:\n'
    + '    · traer el test (se EXTRAE de su rama, nunca se mergea la rama entera), o\n'
    + '    · corregir la ENTRADA, que es la constancia que dejó de ser cierta.\n'
    + '  Lo que NO hay es una lista de excepciones: una excepción que hay que mantener es una\n'
    + '  excepción que alguien acaba ampliando.');
});
