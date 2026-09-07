// tests/scrum727-constancia-del-vigia.test.mjs — SCRUM-727
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN RENGLÓN POR EJECUCIÓN, TAMBIÉN CUANDO SALE VERDE
//
// EL CASO, y no es preventivo: el 4-sep-2026 el vigía cantó 24,9 h y 9 commits de hueco. El
// hueco se cerró solo y NO SE PUDO DECIR POR QUÉ, porque no había historial con el que comparar.
// Los verdes no dejaban rastro: el título se imprimía en el log del job y ahí se quedaba.
//
// «Ha pasado dos veces» y «lo vemos venir» son cosas distintas, y la diferencia es tener el
// primero anotado cuando llega el segundo.
//
// LO QUE SE VIGILA AQUÍ:
//   ① el censo de ejecuciones registradas, con SUELO: si devuelve cero, falla.
//   ② los TRES veredictos siguen siendo tres. SCRUM-716 costó un ticket entero por colapsar
//      «no supe mirar» en «al día»; un registro que los junte reintroduce ese defecto un nivel
//      más arriba.
//   ③ `0` y `?` no se confunden. `hueco=0.0h` es una medición: dice que no hay hueco.
//      `hueco=?` dice que no se sabe. Las dos direcciones.
//   ④ el renglón se escribe SIEMPRE — fuera de todo `if` sobre el veredicto—, y eso se
//      comprueba por AST, no leyendo el fichero con los ojos.
//   ⑤ ANOTAR NO ES DECIDIR: la constancia no toca el veredicto ni el código de salida.
//   ⑥ y de verdad, ejecutando el vigía: el renglón sale por la salida estándar y aterriza en
//      `$GITHUB_STEP_SUMMARY` cuando lo hay.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import {
  veredictoDeDespliegue, constanciaDeEjecucion, MARCA_CONSTANCIA, SIN_MEDIR,
  AL_DIA, ATRASADO, NO_SUPE_MIRAR, SALIDA_NO_SUPE_MIRAR,
} from '../scripts/_vigilante-de-despliegue.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = 'scripts/vigilante-de-despliegue.mjs';
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// El ahora, FIJADO: el módulo no tiene reloj de pared, y por eso un renglón entero se puede
// clavar en un test. 2026-03-04T15:00:00Z.
const AHORA = 1772636400;
const sha = (c) => c.repeat(40);

// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS EJECUCIONES DEL BANCO · una por cada camino que el vigía sabe recorrer
// ─────────────────────────────────────────────────────────────────────────────────────────
const EJECUCIONES = [
  { que: 'al día, sin hueco', espera: AL_DIA,
    datos: { versionDeProduccion: sha('a'), shaDeMain: sha('a'), conoceElCommit: true, estaEnMain: true, commitsPorDelante: 0 } },
  { que: 'al día, con hueco DENTRO del margen', espera: AL_DIA,
    datos: { versionDeProduccion: sha('b'), shaDeMain: sha('c'), conoceElCommit: true, estaEnMain: true, commitsPorDelante: 6, epochDelPrimeroSinDesplegar: AHORA - 2520 } },
  // El caso del 4-sep, con sus números de verdad: 24,9 h y 9 commits.
  { que: 'ATRASADO — el caso que se vivió', espera: ATRASADO,
    datos: { versionDeProduccion: sha('d'), shaDeMain: sha('e'), conoceElCommit: true, estaEnMain: true, commitsPorDelante: 9, epochDelPrimeroSinDesplegar: AHORA - 89640 } },
  { que: 'producción corre algo que no está en `main`', espera: ATRASADO,
    datos: { versionDeProduccion: sha('9'), shaDeMain: sha('8'), conoceElCommit: true, estaEnMain: false } },
  { que: 'ciego · `/version` no se pudo leer', espera: NO_SUPE_MIRAR,
    datos: { versionDeProduccion: null } },
  { que: 'ciego · producción no publica un sha', espera: NO_SUPE_MIRAR,
    datos: { versionDeProduccion: '1772636400000' } },
  { que: 'ciego · el commit de producción no está aquí', espera: NO_SUPE_MIRAR,
    datos: { versionDeProduccion: sha('f'), shaDeMain: sha('e'), conoceElCommit: false } },
  { que: 'ciego · `main` no resuelve (SCRUM-716)', espera: NO_SUPE_MIRAR,
    datos: { versionDeProduccion: sha('f'), shaDeMain: null, conoceElCommit: true } },
  { que: 'ciego · no se pudo contar el hueco', espera: NO_SUPE_MIRAR,
    datos: { versionDeProduccion: sha('1'), shaDeMain: sha('2'), conoceElCommit: true, estaEnMain: true, commitsPorDelante: null } },
];

/** El censo: una ejecución dentro, un renglón fuera. */
function censoDeEjecuciones() {
  return EJECUCIONES.map((e) => {
    const datos = { ...e.datos, ahoraEpoch: AHORA, margenHoras: 6 };
    const v = veredictoDeDespliegue(datos);
    return { ...e, v, ...constanciaDeEjecucion(v, datos) };
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// ① SUELO · si el censo devuelve cero, falla
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-727 · SUELO: cada ejecución del banco deja UN renglón, y el banco no está vacío', () => {
  const c = censoDeEjecuciones();
  assert.ok(c.length >= 8,
    `🔴 CIEGO: el banco sólo tiene ${c.length} ejecuciones. Con esa población, cualquier «todas `
    + 'dejan renglón» es verdad por falta de casos.');
  for (const f of c) {
    assert.equal(typeof f.renglon, 'string', `🔴 «${f.que}» no ha producido renglón`);
    assert.ok(f.renglon.startsWith(MARCA_CONSTANCIA + ' '),
      `🔴 el renglón de «${f.que}» no empieza por la marca «${MARCA_CONSTANCIA}»: en un log de `
      + 'miles de líneas, un renglón que no se puede localizar no es un registro.');
    assert.equal(f.renglon.split('\n').length, 1,
      `🔴 el renglón de «${f.que}» ocupa más de una línea: deja de poder alinearse con el anterior`);
  }
  // Y el veredicto del banco coincide con el que el vigía decide de verdad. Sin esto, el banco
  // podría estar midiendo una clasificación inventada aquí.
  for (const f of c) {
    assert.equal(f.v.veredicto, f.espera,
      `🔴 «${f.que}» ya no da ${f.espera}: el banco ha dejado de reproducir ese camino`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ② LOS TRES VEREDICTOS SIGUEN SIENDO TRES
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-727 · 🔴 el registro NO colapsa «no supe mirar» en «al día» ni en «hay hueco»', () => {
  const c = censoDeEjecuciones();
  // Se lee del RENGLÓN, no del veredicto: lo que hay que sostener es lo que queda escrito.
  const palabras = new Set(c.map((f) => f.renglon.split(' · ')[2]));
  assert.deepEqual([...palabras].sort(), [AL_DIA, ATRASADO, NO_SUPE_MIRAR].sort(),
    '🔴 EL REGISTRO NO DISTINGUE LOS TRES VEREDICTOS.\n'
    + '     escribe: ' + [...palabras].join(', ') + '\n'
    + `     y el vigía decide: ${AL_DIA}, ${ATRASADO}, ${NO_SUPE_MIRAR}\n`
    + '  SCRUM-716 costó un ticket entero por confundir «no supe mirar» con «al día». Un registro '
    + 'que los junte reintroduce ese defecto un nivel más arriba: en el sitio donde alguien va a '
    + 'mirar dentro de seis meses para reconstruir qué pasó.');

  for (const f of c.filter((x) => x.espera === NO_SUPE_MIRAR)) {
    assert.ok(f.renglon.includes(' · ' + NO_SUPE_MIRAR + ' · '),
      `🔴 «${f.que}» no deja escrito que no se supo mirar`);
    assert.equal(f.renglon.includes(' · ' + AL_DIA + ' · '), false,
      `🔴 «${f.que}» ha quedado registrado como «${AL_DIA}». Es exactamente el defecto de 716.`);
    // Y lleva su motivo: una fila de interrogantes sin motivo no sirve para reconstruir nada.
    assert.match(f.renglon, /· motivo=\S/,
      `🔴 «${f.que}» deja una fila de interrogantes SIN motivo: con eso no se reconstruye por qué`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ③ `0` NO ES `?` · las dos direcciones
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-727 · 🔴 un cero MEDIDO y un «no se sabe» se escriben distinto', () => {
  const c = censoDeEjecuciones();

  // ── el lado que MIDE: sin hueco es `0`, y tiene que decirlo con un número.
  const sinHueco = c.find((f) => f.que === 'al día, sin hueco');
  assert.match(sinHueco.renglon, /· hueco=0\.0h · commits=0/,
    '🔴 «sin hueco» ya no se escribe con ceros. Un cero es una MEDICIÓN —dice que producción está '
    + `al día— y se pierde si se escribe «${SIN_MEDIR}».\n     ` + sinHueco.renglon);

  // ── el lado que NO mide: nunca un cero donde no se supo.
  for (const f of c.filter((x) => !Number.isFinite(x.v.horas))) {
    assert.ok(f.renglon.includes('hueco=' + SIN_MEDIR),
      `🔴 «${f.que}» no escribe «${SIN_MEDIR}» en el hueco que no pudo medir:\n     ${f.renglon}`);
    assert.equal(/· hueco=0(\.0)?h/.test(f.renglon), false,
      `🔴 «${f.que}» ha escrito un CERO donde no midió nada. «no hay hueco» y «no sé si lo hay» `
      + 'son cosas distintas, y ésta es la confusión que esta casa arrastra.');
  }

  // CONTROL POSITIVO del detector de ceros: sobre el caso que SÍ tiene cero, la regla de arriba
  // encuentra lo que busca. Sin esto, una expresión que no casara nunca dejaría pasar el bucle.
  assert.equal(/· hueco=0(\.0)?h/.test(sinHueco.renglon), true,
    '🔴 el detector de ceros no ve el cero del caso que lo tiene: sus «false» de arriba no valen');
});

test('SCRUM-727 · el renglón fijado ENTERO, para que un cambio de forma se vea', () => {
  // Un renglón clavado carácter a carácter. Cambiar la forma del registro es una decisión —quien
  // lea el historial de dentro de seis meses lo lee así— y esto obliga a tomarla a la vista.
  const datos = { versionDeProduccion: sha('d'), shaDeMain: sha('e'), conoceElCommit: true,
    estaEnMain: true, commitsPorDelante: 9, epochDelPrimeroSinDesplegar: AHORA - 89640,
    ahoraEpoch: AHORA, margenHoras: 6 };
  const { renglon } = constanciaDeEjecucion(veredictoDeDespliegue(datos), datos);
  assert.equal(renglon,
    'vigía · 2026-03-04T15:00:00Z · atrasado · prod=dddddddd · main=eeeeeeee · hueco=24.9h · commits=9',
    '🔴 ha cambiado la FORMA del renglón. No es cosmética: es el formato con el que se van a '
    + 'comparar dos ejecuciones separadas por días.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ④ SE ESCRIBE SIEMPRE · comprobado por AST, no a ojo
// ─────────────────────────────────────────────────────────────────────────────────────────
//
// La propiedad que hay que sostener no es «la línea está en el fichero»: es que NO cuelga de
// ninguna condición sobre el veredicto. En cuanto viva dentro de un `if (v.salida !== 0)`, los
// verdes vuelven a no dejar rastro y este ticket se deshace sin que nadie lo note.

/** ¿Está esta llamada al aire, o dentro de un `if`/función? */
function contextoDeLaLlamada(codigo, nombre) {
  const sf = ts.createSourceFile(CLI, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let hallada = null;
  (function mirar(n) {
    if (ts.isCallExpression(n) && n.expression.getText(sf) === nombre) {
      const envolturas = [];
      for (let p = n.parent; p; p = p.parent) {
        if (ts.isIfStatement(p)) envolturas.push('if (' + p.expression.getText(sf) + ')');
        else if (ts.isFunctionDeclaration(p) || ts.isArrowFunction(p) || ts.isFunctionExpression(p)) envolturas.push('función');
        else if (ts.isTryStatement(p)) envolturas.push('try');
        else if (ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isWhileStatement(p)) envolturas.push('bucle');
        else if (ts.isConditionalExpression(p)) envolturas.push('ternario');
      }
      hallada = { envolturas };
    }
    ts.forEachChild(n, mirar);
  })(sf);
  return hallada;
}

test('SCRUM-727 · 🔴 el renglón se escribe SIEMPRE: fuera de todo `if` sobre el veredicto', () => {
  const codigo = leer(CLI);
  const c = contextoDeLaLlamada(codigo, 'constanciaDeEjecucion');
  assert.ok(c,
    '🔴 EL VIGÍA NO DEJA CONSTANCIA: no hay ninguna llamada a `constanciaDeEjecucion` en '
    + `\`${CLI}\`. Que la función exista no sirve de nada — mencionar no es hacer.`);
  assert.deepEqual(c.envolturas, [],
    '🔴 LA CONSTANCIA CUELGA DE ALGO: ' + c.envolturas.join(' → ') + '.\n'
    + '  El renglón tiene que salir en las tres: verde, rojo y ciego. En cuanto dependa del '
    + 'veredicto, los verdes dejan de existir y volvemos a no tener con qué comparar, que es '
    + 'literalmente el ticket.');

  // Y que lo ESCRIBE, no sólo que lo calcula.
  const imprime = contextoDeLaLlamada(codigo, 'console.log');
  assert.ok(imprime, '🔴 el vigía no imprime nada');
  assert.match(codigo, /console\.log\(constancia\.renglon\)/,
    '🔴 el renglón se calcula y no se escribe. Calcular no es dejar constancia.');
});

test('SCRUM-727 · CONTROL NEGATIVO: el AVISO sigue siendo condicional, y eso está bien', () => {
  // La anotación de GitHub (`::error` / `::warning`) NO puede volverse incondicional: avisar de un
  // verde doce veces al día es ruido, y el ruido apaga los avisos. Anotar y avisar son cosas
  // distintas, y este control impide «arreglar» el ticket haciendo que todo grite.
  const c = contextoDeLaLlamada(leer(CLI), 'String');
  assert.ok(c, '🔴 CIEGO: el lector de contexto no encuentra ni una llamada que sí existe');
  const codigo = leer(CLI);
  const i = codigo.indexOf("'::'");
  assert.notEqual(i, -1, '🔴 CIEGO: no encuentro la anotación de GitHub en el vigía');
  const antes = codigo.slice(0, i);
  // 🔴 SCRUM-716 · ACEPTA `final.salida` ADEMÁS DE `v.salida`, y es una DECISIÓN, no una holgura.
  //
  // Este guard nació cuando el único origen del código de salida era `v.salida`. El 7-sep-2026 el
  // fundador autorizó tocar el vigía («Sí autorizo») y SCRUM-716 metió un segundo decisor
  // declarado: el RITMO, que baja a 0 un retraso que se está cerrando solo. Así que el texto
  // cambió legítimamente — pero **la propiedad que este control protege es la misma y sigue
  // exigiéndose**: que la anotación siga dentro de un `if` y siga pidiendo salida distinta de 0.
  // Si alguien la vuelve incondicional, esto cae igual que antes.
  assert.match(antes.slice(antes.lastIndexOf('if (')),
    /if \(process\.env\.GITHUB_ACTIONS === 'true' && (?:v|final)\.salida !== 0\)/,
    '🔴 la anotación ha dejado de ser condicional: el vigía avisaría también en verde, doce veces '
    + 'al día. Lo que este ticket pide es ANOTAR el verde, no gritarlo.');
});

test('SCRUM-727 · el resumen usa el mecanismo que YA existe, y con su red debajo', () => {
  const codigo = leer(CLI);
  assert.match(codigo, /process\.env\.GITHUB_STEP_SUMMARY/,
    '🔴 el renglón no llega al resumen del job: habría que abrir el log para leerlo');
  const c = contextoDeLaLlamada(codigo, 'fs.appendFileSync');
  assert.ok(c, '🔴 nadie escribe en el resumen');
  assert.ok(c.envolturas.includes('try'),
    '🔴 la escritura del resumen NO está dentro de un `try`. El resumen es un extra: si el fichero '
    + 'no se puede escribir, el veredicto y el código de salida tienen que seguir siendo los que '
    + 'ya se decidieron. Mismo motivo, y mismo idioma, que `guards-visuales.mjs`.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ⑤ ANOTAR NO ES DECIDIR
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-727 · 🔴 CONTROL NEGATIVO: la constancia NO cambia el veredicto ni la salida', () => {
  for (const e of EJECUCIONES) {
    const datos = { ...e.datos, ahoraEpoch: AHORA, margenHoras: 6 };
    const v = veredictoDeDespliegue(datos);
    const copia = JSON.parse(JSON.stringify(v));
    const antesDatos = JSON.parse(JSON.stringify(datos));
    constanciaDeEjecucion(v, datos);
    assert.deepEqual(JSON.parse(JSON.stringify(v)), copia,
      `🔴 la constancia ha MODIFICADO el veredicto de «${e.que}». Anotar no es decidir: en cuanto `
      + 'el registro toque lo que registra, deja de ser un registro y pasa a ser un juez.');
    assert.deepEqual(JSON.parse(JSON.stringify(datos)), antesDatos,
      `🔴 la constancia ha modificado los datos de entrada de «${e.que}»`);
  }
  // Y el código de salida lo sigue decidiendo el veredicto, no el registro.
  //
  // 🔴 SCRUM-716 · SE COMPRUEBA LA PROPIEDAD, NO EL LITERAL, y es una DECISIÓN tomada al saltar
  // este trinquete. Lo que este control defiende es que **la CONSTANCIA no decide**; que el
  // veredicto salga solo (`v.salida`) o calificado por el ritmo (`final.salida`) le da igual — ese
  // segundo decisor lo autorizó el fundador el 7-sep-2026 con «Sí autorizo», está declarado y
  // tiene sus propios tests. Fijar el texto exacto habría obligado a ensanchar la lista cada vez
  // que el vigía cambia por una razón legítima, que es como un guard se vuelve ruido y se borra.
  //
  // Y de paso queda MÁS ESTRICTO que antes: ahora se exige explícitamente que el registro no
  // aparezca en la decisión, cosa que el `match` anterior no comprobaba.
  const cli = leer(CLI);
  const m = /process\.exit\(([^)]*)\)/.exec(cli);
  assert.ok(m, '🔴 CIEGO: el vigía ya no sale con `process.exit`, así que no sé qué decide nada.');
  assert.match(m[1], /^(?:v|final)\.salida$/,
    `🔴 el código de salida sale de \`${m[1]}\`, que no es el veredicto ni el veredicto calificado. `
    + 'El registro no puede decidir nada.');
  assert.doesNotMatch(m[1], /constancia/,
    '🔴 la CONSTANCIA está decidiendo el código de salida. En cuanto el registro toque lo que '
    + 'registra, deja de ser un registro y pasa a ser un juez.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ⑥ Y DE VERDAD: ejecutando el vigía
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-727 · 🔴 ejecutado de verdad: el renglón sale y aterriza en el resumen del job', () => {
  // Se le da una URL que no responde —`127.0.0.1:1`, conexión rechazada al instante— para no
  // depender de la red ni de producción: lo que se prueba es que ESCRIBE, no qué veredicto da. Un
  // test que se pusiera rojo porque producción está caída sería un test que miente.
  //
  // 🔴 Y LA URL NO VIAJA EN EL `argv` DE NINGÚN PROCESO, que es lo que exige el guard de
  // SCRUM-226 — sin lista de excepciones, y con razón: el argv de un proceso lo ve cualquiera con
  // `ps`. Se escribe un arrancador de usar y tirar que fija su propio `process.argv` y luego
  // importa el vigía. Así `ps` sólo vería `node …/arranca.mjs`, que es exactamente la propiedad
  // que aquel guard protege. (Mi primera versión pasaba `--url` en el spawn y él la cazó.)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum727-'));
  const resumen = path.join(dir, 'resumen.md');
  const arrancador = path.join(dir, 'arranca.mjs');
  fs.writeFileSync(arrancador,
    "import { pathToFileURL } from 'node:url';\n"
    + 'const CLI = ' + JSON.stringify(path.join(RAIZ, CLI)) + ';\n'
    + "process.argv = [process.argv[0], CLI, '--' + 'url', 'http://127.0.0.1:1/version'];\n"
    + 'await import(pathToFileURL(CLI).href);\n');

  let salida = '';
  let codigo = 0;
  try {
    salida = execFileSync('node', [arrancador], {
      cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      // 🔴 FIJADO, no heredado: si `GITHUB_ACTIONS` viniera del entorno, este test se comportaría
      // distinto en CI que en el portátil — que es literalmente lo que vigila SCRUM-702. Con el
      // valor puesto a mano se ejercita el mismo camino en los dos sitios, incluida la anotación.
      env: { ...process.env, GITHUB_STEP_SUMMARY: resumen, GITHUB_ACTIONS: 'true' },
    });
  } catch (e) {
    salida = e.stdout || '';
    codigo = e.status;
  }

  const renglones = salida.split('\n').filter((l) => l.startsWith(MARCA_CONSTANCIA + ' '));
  assert.equal(renglones.length, 1,
    `🔴 el vigía ha dejado ${renglones.length} renglones en su salida, y tiene que dejar UNO por `
    + 'ejecución. Lo que imprimió:\n' + salida);
  assert.ok(renglones[0].includes(' · ' + NO_SUPE_MIRAR + ' · '),
    '🔴 con `/version` inalcanzable, el renglón tiene que decir que no se supo mirar:\n' + renglones[0]);
  assert.equal(codigo, SALIDA_NO_SUPE_MIRAR,
    `🔴 el código de salida es ${codigo} y debería seguir siendo ${SALIDA_NO_SUPE_MIRAR}: la `
    + 'constancia no puede haber cambiado lo que el vigía decide.');

  // Y en el resumen del job, que es donde se lee sin abrir el log.
  assert.ok(fs.existsSync(resumen), '🔴 no se ha escrito nada en `$GITHUB_STEP_SUMMARY`');
  const escrito = fs.readFileSync(resumen, 'utf8');
  assert.ok(escrito.includes(renglones[0]),
    '🔴 el resumen del job no lleva el mismo renglón que el log:\n' + escrito);

  // Y ANOTAR NO ES AVISAR: con `GITHUB_ACTIONS` puesto y salida ≠ 0, la anotación sigue saliendo,
  // en su línea y aparte del renglón. Si el ticket hubiera roto el aviso, aquí se vería.
  assert.ok(salida.split('\n').some((l) => l.startsWith('::warning title=')),
    '🔴 la anotación de GitHub ha dejado de emitirse en un caso ciego. La constancia se AÑADE al '
    + 'aviso; no lo sustituye.');
});
