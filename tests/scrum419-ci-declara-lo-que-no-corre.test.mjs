// SCRUM-419 · CI tiene que DECLARAR lo que no ha ejecutado.
//
// Sin gate — y es el punto entero del fichero: el guard que vigila a los gateados no puede estar
// gateado él mismo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, MEDIDO (10-ago-2026)
//
// Hay **7 tests** gateados por `LIBRO_PG_URL` en 5 ficheros. `.github/workflows/ci.yml` **no
// define esa variable ni levanta ningún Postgres**, así que en CI los 7 se saltan SIEMPRE — y la
// suite informa «0 fallos» exactamente igual que si hubieran pasado.
//
// **«0 fallos porque pasó» y «0 fallos porque no se ejecutó» son hoy el mismo número.** Eso es la
// familia de defectos de toda esta semana: un mecanismo que no corre se lee igual que uno que
// aprueba.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE ESTE FICHERO **NO** HACE, Y ES LO MÁS IMPORTANTE
//
// **No quita el gate.** Los 7 necesitan un Postgres de verdad: crean un `PrismaClient` contra el
// banco y prueban TENENCIA contra el motor real —que un merchant no vea los datos de otro— y el
// cuadre entre pantallas. Hacerlos correr sin banco con un cliente falso sería **fabricar el
// defecto que este ticket persigue**: un test verde que no prueba nada.
//
// Si un test necesita banco, lo necesita. Lo correcto es que **CI declare que no lo corrió**, no
// que finja que lo corrió. Eso es lo que hace este guard.
//
// ⚠️ Y montar un Postgres en CI es **coste recurrente** y decisión del fundador (regla 36): va
// como ticket aparte, no se cuela aquí.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VARIABLE = 'LIBRO_PG_URL';

/**
 * EL INVENTARIO DECLARADO — 7 tests, uno por línea, con el fichero donde vive.
 *
 * No es decoración: es un TRINQUETE. Si aparece un gateado nuevo y nadie lo declara aquí, el guard
 * se pone rojo — porque un test que deja de ejecutarse en silencio es indistinguible de uno que no
 * existe. Y si un gateado deja de necesitar banco, este número **BAJA**, que es la única dirección
 * buena.
 */
const GATEADOS_DECLARADOS = Object.freeze({
  // SCRUM-324 (E3): los DOS que necesitan base — la cadena entera hasta el libro de recibidas
  // y su control negativo. Son justo los que prueban que la funcion existe, asi que su skip
  // es lo mas importante que este inventario declara.
  'scrum324-cadena-hasta-el-libro.test.mjs': 2,
  'scrum244-supresion-y-anonimizado.test.mjs': 1,
  'scrum295-modelo-303-postgres.test.mjs': 1,
  'scrum296-libro-postgres.test.mjs': 1,
  'scrum297-evidencias-postgres.test.mjs': 2,
  'scrum389-un-solo-iva.test.mjs': 2,
});
const TOTAL_DECLARADO = Object.values(GATEADOS_DECLARADOS).reduce((a, b) => a + b, 0);

/**
 * Los tests gateados por la variable, DERIVADOS del AST. No por `grep`: el gate viaja en el objeto
 * de opciones de `test(nombre, { skip: … }, fn)`, y contar apariciones del nombre de la variable
 * contaría también los comentarios que explican cómo correrlos.
 */
function gateadosPorVariable() {
  const porFichero = new Map();
  let nodos = 0;
  const ficheros = fs.readdirSync(path.join(RAIZ, 'tests')).filter((f) => f.endsWith('.test.mjs'));

  for (const f of ficheros) {
    const src = fs.readFileSync(path.join(RAIZ, 'tests', f), 'utf8');
    if (!src.includes(VARIABLE)) continue;
    const sf = ts.createSourceFile('x.mjs', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const encontrados = [];
    const visitar = (n) => {
      nodos += 1;
      if (ts.isCallExpression(n) && /^(test|it)$/.test(n.expression.getText(sf))) {
        for (const a of n.arguments) {
          if (!ts.isObjectLiteralExpression(a)) continue;
          for (const p of a.properties) {
            if (ts.isPropertyAssignment(p) && p.name.getText(sf) === 'skip') {
              const nombre = ts.isStringLiteral(n.arguments[0]) ? n.arguments[0].text : '(dinámico)';
              encontrados.push({ nombre, motivo: p.initializer.getText(sf).replace(/\s+/g, ' ') });
            }
          }
        }
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
    if (encontrados.length) porFichero.set(f, encontrados);
  }
  return { porFichero, nodos, ficherosMirados: ficheros.length };
}

// ── EL SUELO DEL PROPIO GUARD ───────────────────────────────────────────────────────────

test('SCRUM-419 · SUELO: el extractor ENCUENTRA los gateados, o se declara ciego', () => {
  const { porFichero, nodos, ficherosMirados } = gateadosPorVariable();
  assert.ok(ficherosMirados > 100, `🔴 ESCÁNER CIEGO: solo ${ficherosMirados} ficheros de test mirados`);
  assert.ok(nodos > 5_000, `🔴 ESCÁNER CIEGO: solo ${nodos} nodos recorridos`);
  const total = [...porFichero.values()].reduce((a, v) => a + v.length, 0);
  assert.ok(
    total > 0,
    `🔴 ESCÁNER CIEGO: el extractor ve CERO tests gateados por ${VARIABLE}.\n\n` +
      '  «Ningún test está gateado» y «no supe encontrarlos» son el mismo número y significan lo\n' +
      '  contrario — que es EXACTAMENTE el defecto que este fichero persigue, cometido por el\n' +
      '  propio guard. Con cero, todo lo de abajo pasaría por vacío.',
  );
});

// ── EL TRINQUETE: NINGÚN GATEADO NUEVO EN SILENCIO ──────────────────────────────────────

test('SCRUM-419 · el inventario de lo que NO corre está declarado, fichero por fichero', () => {
  const { porFichero } = gateadosPorVariable();
  const real = Object.fromEntries([...porFichero].map(([f, v]) => [f, v.length]));

  assert.deepEqual(
    real, GATEADOS_DECLARADOS,
    '🔴 EL INVENTARIO DE TESTS QUE NO SE EJECUTAN HA CAMBIADO.\n\n' +
      `  declarado: ${JSON.stringify(GATEADOS_DECLARADOS)}\n` +
      `  real:      ${JSON.stringify(real)}\n\n` +
      '  Un test que deja de ejecutarse EN SILENCIO es indistinguible de uno que no existe: la\n' +
      '  suite sigue diciendo «0 fallos». Si has añadido un gateado, decláralo aquí y explica por\n' +
      `  qué necesita banco. Si uno ha dejado de necesitarlo, este número BAJA — y esa es la única\n` +
      '  dirección en la que se mueve solo.',
  );
});

test('SCRUM-419 · cada gateado dice POR QUÉ no corre, y nombra la variable', () => {
  // Un `skip: true` a secas es un test apagado sin motivo: al leer el log no se distingue de uno
  // roto que alguien silenció. El motivo tiene que nombrar la variable que lo gatea.
  const { porFichero } = gateadosPorVariable();
  const mudos = [];
  for (const [f, tests] of porFichero) {
    for (const t of tests) {
      if (!t.motivo.includes(VARIABLE) && !/sin LIBRO_PG_URL|banco/i.test(t.motivo)) {
        mudos.push(`${f} → «${t.nombre.slice(0, 50)}» · skip: ${t.motivo.slice(0, 40)}`);
      }
    }
  }
  assert.deepEqual(
    mudos, [],
    '🔴 HAY TESTS GATEADOS QUE NO DICEN POR QUÉ:\n' + mudos.map((m) => `   · ${m}`).join('\n') + '\n\n' +
      '  Un `skip` sin motivo legible es un test apagado que en el log no se distingue de uno roto\n' +
      '  que alguien silenció.',
  );
});

// ── LA DECLARACIÓN: LO QUE CI NO HA EJECUTADO, DICHO ────────────────────────────────────

test('SCRUM-419 · 🔴 CI DECLARA lo que no ha ejecutado, en vez de callarlo', (t) => {
  const hayBanco = !!process.env[VARIABLE];
  const { porFichero } = gateadosPorVariable();
  const total = [...porFichero.values()].reduce((a, v) => a + v.length, 0);

  if (hayBanco) {
    t.diagnostic(`✅ ${VARIABLE} presente: los ${total} tests de banco SÍ se han ejecutado.`);
  } else {
    // Esto es lo que hoy no existe: la línea que separa los dos ceros.
    t.diagnostic(`🔴 ESTA EJECUCIÓN **NO** HA CORRIDO ${total} TESTS (gateados por ${VARIABLE}):`);
    for (const [f, tests] of porFichero) {
      for (const x of tests) t.diagnostic(`     · ${f} → ${x.nombre}`);
    }
    t.diagnostic('   «0 fallos» de esta suite NO incluye esos. Necesitan un Postgres desechable:');
    t.diagnostic(`   ${VARIABLE}="postgresql://postgres@127.0.0.1:55432/yaqu_libro_test" npm test`);
  }

  // Y el suelo del propio aviso: el número declarado y el real no pueden divergir, o la
  // declaración diría una cifra que no es.
  assert.equal(
    total, TOTAL_DECLARADO,
    `🔴 se declaran ${TOTAL_DECLARADO} tests sin ejecutar y hay ${total}. Una declaración con la ` +
      'cifra equivocada es peor que no declararla: se lee como comprobada.',
  );
});

// ── Y LA REALIDAD DE CI, ATADA AL FICHERO, NO A UNA CREENCIA ────────────────────────────

test('SCRUM-419 · 🔴 CI SIGUE levantando el banco: si deja de hacerlo, se dice', () => {
  // ⚠️ ESTE TEST SE INVIRTIÓ el 10-ago-2026, y es el ejemplo de por qué el guard estaba bien
  // construido: pedía que la declaración correspondiera con lo que CI hace HOY. Cuando el fundador
  // dio GO al `services: postgres`, **se puso rojo** — y la respuesta correcta fue ACTUALIZAR LA
  // DECLARACIÓN, no aflojar el guard.
  //
  // Antes exigía que ningún workflow definiera la variable (CI no los corría, y había que decirlo).
  // Ahora exige lo contrario: que **SÍ** la defina. El motivo es el mismo de siempre — si alguien
  // quita el servicio de Postgres, los 7 vuelven a saltarse EN SILENCIO y la suite seguiría
  // diciendo «0 fallos». Un guard que solo mirase «hay declaración» no vería eso.
  const dir = path.join(RAIZ, '.github/workflows');
  assert.ok(fs.existsSync(dir), '🔴 ESCÁNER CIEGO: no encuentro .github/workflows');
  const flujos = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
  assert.ok(flujos.length > 0, '🔴 ESCÁNER CIEGO: cero workflows que mirar');

  // 🔴 SE MIRA LA ASIGNACIÓN, NO LA MENCIÓN — y esto lo aprendí fallando aquí mismo.
  //
  // La primera versión hacía `contenido.includes('LIBRO_PG_URL')`, y al probar el rojo —quitar la
  // variable del workflow— **el guard siguió verde**: casaba con el COMENTARIO que yo mismo había
  // escrito explicando por qué la variable entra. Un guard de texto se caza a sí mismo en el
  // comentario que lo explica; es la quinta vez en esta sesión.
  //
  // Ahora se quitan los comentarios YAML y se exige la forma `LIBRO_PG_URL: <algo>`, que es una
  // asignación y no una frase sobre ella.
  const defineLaVariable = (contenido) => contenido
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .some((l) => new RegExp(`^\\s*${VARIABLE}\\s*:\\s*\\S`).test(l));

  const losDefine = flujos.filter((f) => defineLaVariable(fs.readFileSync(path.join(dir, f), 'utf8')));

  // Hermano positivo (SCRUM-237): el detector reconoce la asignación, y NO confunde una mención.
  assert.ok(defineLaVariable(`      ${VARIABLE}: postgresql://x`), '🔴 ESCÁNER CIEGO: no ve la asignación');
  assert.ok(!defineLaVariable(`      # ${VARIABLE} es un banco desechable`), '🔴 el detector cuenta un COMENTARIO');

  assert.ok(
    losDefine.length > 0,
    `🔴 NINGÚN WORKFLOW DEFINE ${VARIABLE}.\n\n` +
      `  Entonces los ${TOTAL_DECLARADO} tests de banco han dejado de correr en CI — y la suite\n` +
      '  seguirá diciendo «0 fallos», porque saltarse y aprobar dan el mismo número. Son los que\n' +
      '  prueban tenencia contra el motor real y el cuadre de las tres pantallas: sin ellos, un PR\n' +
      '  que filtre datos entre merchants entra en verde.\n\n' +
      '  Si el servicio se quitó a propósito, este guard vuelve a su forma anterior (exigir que\n' +
      '  NADIE lo defina) y el aviso de arriba pasa a declararlos como no ejecutados. Lo que no\n' +
      '  vale es quedarse a medias: sin servicio y sin declaración.',
  );

  // Y el suelo del propio workflow: que además levante el SERVICIO. Definir la variable apuntando
  // a un Postgres que nadie arranca haría que los 7 fallaran por conexión — un rojo que se lee como
  // «los tests están rotos» cuando lo que falta es la base.
  const ci = fs.readFileSync(path.join(dir, 'ci.yml'), 'utf8');
  assert.match(
    ci, /services:[\s\S]{0,400}?postgres:/,
    '🔴 `ci.yml` define la variable pero no levanta ningún servicio de Postgres. Los 7 fallarían ' +
      'por conexión, y ese rojo se lee como «los tests están rotos» en vez de «falta la base».',
  );
});
