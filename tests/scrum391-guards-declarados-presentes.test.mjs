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

/** Toda ruta `tests/…​.test.mjs` que nombra una entrada, con la entrada que la nombró. */
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
  const out = [];
  for (const f of ficheros) {
    if (!/^SCRUM-\d+\.md$/.test(f)) continue; // README y notas no declaran nada
    const texto = fs.readFileSync(path.join(DIR_MASTER, f), 'utf8');
    for (const ruta of new Set([...texto.matchAll(/tests\/[A-Za-z0-9_.-]+\.test\.mjs/g)].map((m) => m[0]))) {
      out.push({ entrada: f, ruta });
    }
  }
  return out;
}

// El suelo es un NÚMERO, y se sube a mano a propósito: derivarlo del propio directorio haría que
// borrar entradas bajara el mínimo y el suelo dejara de ser suelo (lección de SCRUM-379).
const MINIMO_ENTRADAS = 90;
const MINIMO_DECLARACIONES = 120;

test('SCRUM-391 · SUELO: el detector encuentra entradas y declaraciones de verdad', () => {
  const entradas = fs.readdirSync(DIR_MASTER).filter((f) => /^SCRUM-\d+\.md$/.test(f));
  const decls = declaracionesDeTests();
  assert.ok(entradas.length >= MINIMO_ENTRADAS,
    `🔴 solo ${entradas.length} entradas de máster: el detector no está mirando donde cree. «Están todos» y «no supe mirar» son el mismo verde`);
  assert.ok(decls.length >= MINIMO_DECLARACIONES,
    `🔴 solo ${decls.length} tests declarados en ${entradas.length} entradas: si las entradas dejaron de nombrar sus tests, este guard no vigila nada`);
});

test('SCRUM-391 · CONTROL NEGATIVO: una declaración que SÍ existe no salta', () => {
  // Sin esto, un detector que marcara todo como huérfano pasaría el rojo de abajo y sería
  // inservible. Se comprueba con la declaración de ESTE fichero, que existe por construcción.
  const propio = path.join(RAIZ, 'tests/scrum391-guards-declarados-presentes.test.mjs');
  assert.ok(fs.existsSync(propio), 'este mismo fichero tiene que existir para que el control valga');
  const decls = declaracionesDeTests();
  const presentes = decls.filter(({ ruta }) => fs.existsSync(path.join(RAIZ, ruta)));
  assert.ok(presentes.length > 0,
    '🔴 el detector no reconoce NINGUNA declaración como presente: está roto, no es que falten todas');
});

test('SCRUM-391 · todo test DECLARADO en una entrada EXISTE en el árbol', () => {
  const huerfanos = declaracionesDeTests()
    .filter(({ ruta }) => !fs.existsSync(path.join(RAIZ, ruta)))
    .map(({ entrada, ruta }) => `${entrada} declara ${ruta}, que NO está en el árbol`);

  assert.deepEqual(
    huerfanos, [],
    '🔴 HAY GUARDS HUÉRFANOS: la entrada afirma que un mecanismo está vigilado y el vigilante no está.\n    '
    + huerfanos.join('\n    ')
    + '\n\n  Su ausencia y su verde son indistinguibles desde fuera, y encima retiran la desconfianza\n'
    + '  que los habría sustituido: nadie vuelve a comprobar a mano lo que cree vigilado.\n\n'
    + '  Dos salidas, las dos honestas:\n'
    + '    · traer el test (se EXTRAE de su rama, nunca se mergea la rama entera), o\n'
    + '    · corregir la ENTRADA, que es la constancia que dejó de ser cierta.\n'
    + '  Lo que NO hay es una lista de excepciones: una excepción que hay que mantener es una\n'
    + '  excepción que alguien acaba ampliando.');
});
