// tests/scrum716c-la-memoria-del-vigia.test.mjs — SCRUM-716c
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA MEMORIA DEL VIGÍA · el transporte, que es lo que nadie probaba
//
// SCRUM-716 le dio al vigía un tercer veredicto —CONGELADO vs RETRASADO— comparando con la
// lectura ANTERIOR, y lo probó a conciencia… **en la capa de decisión**. Lo que no probó nadie es
// que la lectura llegue de una ejecución a la siguiente. Y no llegaba.
//
// ── EL HECHO, medido el 8-sep-2026 ───────────────────────────────────────────────────────────
//
//   vigía · atrasado · prod=15fb3b2f · main=b07546cf · hueco=17.1h · exit 2
//   «no hay lectura anterior con la que comparar»
//
// …mientras producción SÍ estaba desplegando. O sea el caso RETRASADO PERO DESPLEGANDO, que es
// exactamente el que 716 construyó para no confundir con CONGELADO. **El dato correcto y la
// conclusión imposible**, por no tener con qué comparar.
//
// ── LAS DOS CAUSAS, Y SON DISTINTAS ─────────────────────────────────────────────────────────
//
//   (a) `ci.yml` —el vigía de CADA PR— **no tenía memoria en absoluto**: ni `actions/cache` ni
//       `VIGIA_ESTADO`. No es «se guarda y no se restaura»: es que nunca hubo caché.
//
//   (b) `vigia-despliegue.yml` —el programado— sí la tenía, pero con `actions/cache@v4` **a
//       secas**, cuyo guardado es un paso POST declarado `post-if: "success()"`. Y el vigía
//       **falla el job a propósito**: ése es su aviso. Así que la lectura se guardaba SÓLO en
//       verde — sólo cuando no hacía falta— y nunca en rojo, que es cuando hace falta.
//
// ⛔ EL ARREGLO NO RELAJA NADA. Los tres veredictos siguen siendo tres, el vigía sigue saliendo
// con el mismo código y NO_SE_SABE **sigue sin ser verde**. Lo único que cambia es que la lectura
// sobrevive.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(RAIZ, 'scripts/vigilante-de-despliegue.mjs');
const PROGRAMADO = path.join(RAIZ, '.github/workflows/vigia-despliegue.yml');
const CI = path.join(RAIZ, '.github/workflows/ci.yml');

const leer = (p) => fs.readFileSync(p, 'utf8');

/** Sólo lo EJECUTABLE de un YAML: el porqué de este arreglo nombra `actions/cache@v4` para decir
 *  por qué NO vale, y un guard que mire los comentarios se cazaría a sí mismo (SCRUM-349). */
const soloYaml = (t) => t.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');

/** El bloque de un job dentro de un workflow, acotado por su indentación. */
function jobDe(texto, nombre) {
  const i = texto.indexOf('\n  ' + nombre + ':');
  assert.notEqual(i, -1, `🔴 CIEGO: no encuentro el job \`${nombre}\`.`);
  const resto = texto.slice(i + 1);
  const m = /\n {2}[a-zA-Z_][\w-]*:/.exec(resto.slice(1));
  return m ? resto.slice(0, m.index + 1) : resto;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① EL PROGRAMADO · guarda AUNQUE el vigía cante
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-716c · 🔴 el workflow programado GUARDA la lectura aunque el vigía salga en rojo', () => {
  const yaml = soloYaml(leer(PROGRAMADO));

  // SUELO: se está mirando el workflow de verdad.
  assert.match(yaml, /VIGIA_ESTADO:\s*\.vigia\/constancias\.log/,
    '🔴 CIEGO: el workflow ya no le da `VIGIA_ESTADO` al vigía; lo de abajo no probaría nada.');

  // 🔴 `actions/cache@v4` A SECAS NO VALE, y ése es el defecto entero: su guardado es un POST con
  // `post-if: "success()"`, y este job falla a propósito cuando hay algo que decir.
  assert.equal(/uses:\s*actions\/cache@/.test(yaml), false,
    '🔴 ha vuelto `actions/cache@…` a secas. Su guardado es un paso POST con `post-if: '
    + '"success()"`, y el vigía FALLA EL JOB a propósito —«el aviso es el propio job en rojo»—: '
    + 'con esa acción la lectura se guarda sólo cuando el vigía está verde, o sea sólo cuando no '
    + 'hace falta. Es el defecto que este ticket cierra.');

  assert.match(yaml, /uses:\s*actions\/cache\/restore@v4/,
    '🔴 el workflow ya no RESTAURA la lectura anterior: sin ella el vigía no puede distinguir '
    + 'CONGELADO de RETRASADO y contesta NO SE SABE para siempre.');
  assert.match(yaml, /uses:\s*actions\/cache\/save@v4/,
    '🔴 el workflow ya no GUARDA la lectura de esta ejecución: la siguiente no tendrá con qué '
    + 'comparar.');

  // 🔴 Y EL `if: always()` ES LA LÍNEA ENTERA DEL ARREGLO. Se comprueba que está PEGADO al paso
  // de guardado, no suelto en cualquier parte del fichero.
  const i = yaml.indexOf('uses: actions/cache/save@v4');
  const antes = yaml.slice(Math.max(0, i - 300), i);
  assert.match(antes, /if:\s*always\(\)/,
    '🔴 el paso que GUARDA no lleva `if: always()`. Sin él, guardar vuelve a depender de que el '
    + 'vigía haya ido bien — y el vigía va mal exactamente cuando su lectura hace falta. Una '
    + 'memoria que sólo recuerda los días buenos no es una memoria.');

  // Y guarda DESPUÉS de correr el vigía: si guardara antes, guardaría el renglón heredado y no el
  // que acaba de anotar esta ejecución.
  const iVigia = yaml.indexOf('vigilante-de-despliegue.mjs');
  assert.ok(iVigia !== -1 && iVigia < i,
    '🔴 el paso de guardado va ANTES de ejecutar el vigía: guardaría la lectura heredada, no la '
    + 'de esta ejecución, y el historial dejaría de avanzar.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② EL DE CADA PR · tenía CERO memoria
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-716c · 🔴 el vigía de cada PR tiene lectura anterior (antes no tenía NINGUNA)', () => {
  const job = soloYaml(jobDe(leer(CI), 'vigia-despliegue'));

  // SUELO: el acotado es el job de verdad y no el fichero entero.
  assert.match(job, /vigilante-de-despliegue\.mjs/,
    '🔴 CIEGO: el bloque acotado no llama al vigía.');
  assert.ok(job.length < leer(CI).length / 2,
    '🔴 CIEGO: el acotado se ha llevado medio `ci.yml`; cualquier cosa que se encuentre ahí no '
    + 'dice nada sobre ESTE job.');

  assert.match(job, /VIGIA_ESTADO:\s*\.vigia\/constancias\.log/,
    '🔴 el job de PR no le da `VIGIA_ESTADO` al vigía. Sin ella el vigía corre con '
    + '`rutaEstado = \'\'`, sin lectura anterior POR CONSTRUCCIÓN, y en cuanto producción va por '
    + 'detrás contesta NO SE SABE en toda PR — el dato correcto y la conclusión imposible.');
  assert.match(job, /uses:\s*actions\/cache\/restore@v4/,
    '🔴 el job de PR no restaura la constancia que dejó el vigía programado.');

  // 🔴 Y NO GUARDA, a propósito: lo que escribiera una rama de PR se queda en el ámbito de esa
  // rama —invisible para `main`— y ensuciaría sus siguientes pasadas con lecturas tomadas desde
  // un contexto que no es producción-contra-main.
  assert.equal(/uses:\s*actions\/cache\/save@/.test(job), false,
    '🔴 el job de PR ha empezado a GUARDAR. Su escritura no llega a `main` (el ámbito de caché de '
    + 'una rama es suyo) y le ensucia sus propias pasadas: aquí la memoria es de SÓLO LECTURA.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ 🔴 LA INVARIANTE ESTRUCTURAL · sin enumerar ficheros
//
// Lo que dejó pasar este defecto es que 716 le dio memoria a UN workflow y no al otro, y nada
// comprobaba la pareja. Esto lo comprueba por barrido: quien le dé `VIGIA_ESTADO` al vigía tiene
// que tener un paso de caché sobre esa ruta, y si guarda, el guardado no puede depender de que el
// vigía haya ido bien.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-716c · 🔴 TODO job que le da `VIGIA_ESTADO` al vigía tiene su caché, y guardar no depende del veredicto', () => {
  const dir = path.join(RAIZ, '.github/workflows');
  const ficheros = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
  assert.ok(ficheros.length >= 3,
    `🔴 CIEGO: sólo veo ${ficheros.length} workflows; el barrido no está mirando donde cree.`);

  const conMemoria = [];
  for (const f of ficheros) {
    const yaml = soloYaml(leer(path.join(dir, f)));
    if (!yaml.includes('VIGIA_ESTADO')) continue;
    conMemoria.push(f);

    assert.match(yaml, /uses:\s*actions\/cache\/(restore|save)@/,
      `🔴 ${f} le da \`VIGIA_ESTADO\` al vigía pero no tiene NINGÚN paso de caché sobre esa ruta. `
      + 'El vigía escribiría su renglón en un runner efímero y se lo llevaría la basura: memoria '
      + 'que no sobrevive es no tener memoria, sólo que más difícil de ver.');

    if (/uses:\s*actions\/cache\/save@/.test(yaml)) {
      const i = yaml.indexOf('uses: actions/cache/save@');
      assert.match(yaml.slice(Math.max(0, i - 300), i), /if:\s*always\(\)/,
        `🔴 ${f} guarda la constancia sin \`if: always()\`. El vigía falla el job a propósito `
        + 'cuando tiene algo que decir, así que un guardado condicionado al éxito no guarda '
        + 'jamás lo que importa.');
    }
    // Y en ningún caso vale la acción compuesta, por lo mismo.
    assert.equal(/uses:\s*actions\/cache@/.test(yaml), false,
      `🔴 ${f} usa \`actions/cache@…\` a secas, cuyo guardado es \`post-if: "success()"\`.`);
  }

  // SUELO: el barrido ha encontrado los dos jobs que sabemos que existen. Cero no sería «todo
  // correcto»: sería que no ha mirado.
  assert.deepEqual(conMemoria.sort(), ['ci.yml', 'vigia-despliegue.yml'],
    '🔴 CIEGO o INCOMPLETO: los workflows con memoria del vigía son ' + JSON.stringify(conMemoria)
    + ' y deberían ser los dos. Si aparece uno nuevo, tiene que pasar por las reglas de arriba; '
    + 'si desaparece uno, alguien le ha quitado la memoria al vigía.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ 🔴 EL CONTROL QUE DECIDE · ejecutado de EXTREMO A EXTREMO, con fichero de estado de verdad
//
// Los tests de 716 fijan la DECISIÓN llamando a `ritmoDeDespliegue` con dos lecturas en la mano.
// Eso no prueba que la lectura de una ejecución llegue a la siguiente, que es justo lo que
// fallaba. Aquí se corre el CLI de verdad, dos veces, contra un repo de usar y tirar y un
// `/version` propio, con un `VIGIA_ESTADO` real entre medias.
// ═════════════════════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🗃️ SCRUM-824b · AQUÍ VIVÍA EL MINADO DEL FIXTURE. SE RETIRA, y queda dicho por qué.
//
// ── QUÉ HABÍA, Y QUE NO ERA UNA TONTERÍA ────────────────────────────────────────────────
// `prefijoIlegible()` y `commitHastaShaLegible()`: el fixture comítaba en bucle, corriendo la
// fecha un segundo por vuelta, hasta que los ocho primeros del sha NO fueran todo dígitos.
// Existía por algo real y bien medido: `repoDePrueba()` produce uno de esos una vez de cada 43,
// el vigía lo rechazaba, y estos casos salían rojos en un ~2,3 % de las pasadas sin que nadie
// hubiera tocado nada. Ese diagnóstico era CORRECTO, y es lo que permitió llegar al defecto.
//
// ── POR QUÉ DEJA DE SER CIERTO ────────────────────────────────────────────────────────────
// Porque lo que se arregló en SCRUM-824b fue el VIGÍA, no el fixture. `shaLegible()` rechazaba
// todo sha de sólo dígitos para callar el reloj que publica el fallback de `env.ts` cuando falta
// `RAILWAY_GIT_COMMIT_SHA`. Pero un reloj tiene 10 o 13 dígitos y un sha corto tiene 8: el
// filtro se llevaba por delante commits perfectamente legibles. Ahora decide la LONGITUD, y un
// sha de ocho dígitos SE LEE. Minarlo sería esquivar un caso que el vigía ya atiende — y peor:
// el fixture evitaría justo la única entrada que prueba el arreglo.
//
// 🔴 Y NO ES UN APAGADO, QUE ES LO ÚNICO QUE IMPORTA AL RETIRAR UN CONTROL. El rechazo del
// RELOJ sigue entero y con dos negativos: el del CRITERIO, en
// `tests/scrum824b-el-sha-que-parecia-un-numero.test.mjs`, y el de PUNTA A PUNTA por el CLI, AL
// FINAL DE ESTE FICHERO — el sucesor del ⑤ que aquí se retira. Y `repoDePrueba()` vuelve a
// comitar normal, así que un sha de ocho dígitos ENTRA aquí cuando el azar lo trae, y sale verde.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Un repo de usar y tirar con tres commits VIEJOS y `origin/main` en el tercero.
 *
 * Los shas salen COMO SALGAN: desde SCRUM-824b el vigía lee un sha corto de sólo dígitos, así
 * que ya no hay nada que esquivar. La constancia de la retirada, en el bloque de aquí arriba.
 */
function repoDePrueba() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum716c-'));
  const g = (...a) => String(execFileSync('git', a, { cwd: dir, encoding: 'utf8' })).trim();
  g('init', '-q');
  g('config', 'user.email', 'v@test.local');
  g('config', 'user.name', 'vigia');
  const shas = [];
  for (let k = 0; k < 3; k++) {
    // Fechados MUY atrás para que el hueco supere el margen de 6 h sin depender del reloj.
    //
    // 🔴 SIN MINAR, A PROPÓSITO. Aquí hubo un bucle que repetía el commit hasta que los ocho
    // primeros del sha no fueran todo dígitos; se retiró en SCRUM-824b y el porqué está escrito
    // arriba. Que el azar traiga uno de esos —una vez de cada 43— es ahora una ENTRADA VÁLIDA
    // que el vigía tiene que saber leer, no un caso que este fixture deba esquivar.
    const iso = new Date(Date.now() - (72 - k * 12) * 3600 * 1000).toISOString();
    execFileSync('git', ['commit', '--allow-empty', '-q', '-m', 'c' + k], {
      cwd: dir, env: { ...process.env, GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso },
    });
    const sha = g('rev-parse', 'HEAD');
    shas.push(sha);
  }
  g('update-ref', 'refs/remotes/origin/main', shas[2]);
  return { dir, shas };
}

/** Un `/version` propio que devuelve el sha que se le diga. Nunca sale de `127.0.0.1`. */
async function servidorDeVersion() {
  let sha = null;
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ version: sha }));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${srv.address().port}/version`,
    di: (s) => { sha = s; },
    cierra: () => new Promise((r) => srv.close(r)),
  };
}

/**
 * Corre el vigía DE VERDAD.
 *
 * 🔴 La URL NO viaja en el `argv` de ningún proceso — lo exige el guard de SCRUM-226, y con razón:
 * el argv lo ve cualquiera con `ps`. Se escribe un arrancador de usar y tirar que fija su propio
 * `process.argv` y luego importa el vigía, igual que hace el test de SCRUM-727.
 */
async function corre({ cwd, url, estado }) {
  const arrancador = path.join(cwd, 'arranca.mjs');
  fs.writeFileSync(arrancador,
    "import { pathToFileURL } from 'node:url';\n"
    + 'const CLI = ' + JSON.stringify(CLI) + ';\n'
    + 'process.argv = [process.argv[0], CLI, ' + JSON.stringify('--' + 'url') + ', '
    + JSON.stringify(url) + '];\n'
    + 'await import(pathToFileURL(CLI).href);\n');
  const opciones = {
    cwd, encoding: 'utf8',
    env: { ...process.env, VIGIA_ESTADO: estado, GITHUB_ACTIONS: '', GITHUB_STEP_SUMMARY: '' },
  };
  try {
    const { stdout, stderr } = await ejecutar('node', [arrancador], opciones);
    return { codigo: 0, salida: (stdout || '') + (stderr || '') };
  } catch (e) {
    return { codigo: e.code, salida: (e.stdout || '') + (e.stderr || '') };
  }
}

test('SCRUM-716c · 🔴 EL CONTROL: con dos lecturas y producción MOVIÉNDOSE → DESPLIEGA, exit 0', async () => {
  const { dir, shas } = repoDePrueba();
  const srv = await servidorDeVersion();
  const estado = path.join(dir, '.vigia', 'constancias.log');
  try {
    // Pasada 1 · producción en el primer commit: hay hueco y NO hay lectura anterior.
    srv.di(shas[0]);
    const p1 = await corre({ cwd: dir, url: srv.url, estado });
    assert.equal(p1.codigo, 2,
      '🔴 la PRIMERA pasada no dice NO SE SABE. Con hueco y sin lectura anterior, 2 es la verdad.\n'
      + p1.salida);

    // 🔴 SUELO DEL TRANSPORTE: la pasada 1 ha dejado su renglón EN EL FICHERO. Si no lo dejara,
    // lo de abajo mediría otra cosa.
    assert.ok(fs.existsSync(estado), '🔴 la primera pasada no escribió el historial: sin eso, la '
      + 'segunda no puede tener lectura anterior y este control no probaría el transporte.');
    assert.equal(fs.readFileSync(estado, 'utf8').trim().split('\n').length, 1,
      '🔴 el historial no tiene exactamente UN renglón tras la primera pasada.');

    // Pasada 2 · producción SE HA MOVIDO al segundo commit. Sigue habiendo hueco.
    srv.di(shas[1]);
    const p2 = await corre({ cwd: dir, url: srv.url, estado });
    assert.equal(p2.codigo, 0,
      '🔴 con producción MOVIÉNDOSE entre las dos lecturas, el vigía tiene que bajar a 0: es '
      + 'RETRASADO PERO DESPLEGANDO, no un incidente. Poner esto en rojo es lo que bloqueó cinco '
      + 'ramas media jornada el 6-sep-2026.\n' + p2.salida);
    assert.match(p2.salida, /RETRASADO, PERO DESPLEGANDO/,
      '🔴 baja a 0 pero sin decir por qué. El veredicto tiene que leerse.');
    assert.equal(fs.readFileSync(estado, 'utf8').trim().split('\n').length, 2,
      '🔴 el historial no ha crecido a DOS renglones: el vigía no está anotando cada pasada.');
  } finally {
    await srv.cierra();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-716c · 🔴 EL CONTROL, el otro sentido: producción QUIETA pasado el margen → CONGELADO, y CANTA', async () => {
  const { dir, shas } = repoDePrueba();
  const srv = await servidorDeVersion();
  const estado = path.join(dir, '.vigia', 'constancias.log');
  try {
    srv.di(shas[0]);
    const p1 = await corre({ cwd: dir, url: srv.url, estado });
    assert.equal(p1.codigo, 2, '🔴 la primera pasada debería ser NO SE SABE.\n' + p1.salida);

    // Pasada 2 · producción NO se ha movido: mismo sha, y el hueco pasa del margen.
    const p2 = await corre({ cwd: dir, url: srv.url, estado });
    assert.equal(p2.codigo, 1,
      '🔴 con producción QUIETA entre las dos lecturas y el hueco pasado el margen, el vigía tiene '
      + 'que CANTAR (salida 1). Es el caso de los nueve días, el que lo hizo nacer.\n' + p2.salida);
    assert.match(p2.salida, /PRODUCCIÓN CONGELADA/,
      '🔴 canta, pero sin decir que está CONGELADA: el veredicto tiene que distinguirse de un '
      + 'retraso cualquiera.');
  } finally {
    await srv.cierra();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ LOS POSITIVOS QUE NO PUEDEN CAMBIAR
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-716c · ✅ POSITIVO: la PRIMERA pasada de todas SIGUE diciendo NO SE SABE', async () => {
  // No es un fallo: es la verdad, y tiene que seguir saliendo. Convertirla en verde sería el
  // defecto que 716 cerró, del revés.
  const { dir, shas } = repoDePrueba();
  const srv = await servidorDeVersion();
  try {
    srv.di(shas[0]);
    const p = await corre({ cwd: dir, url: srv.url, estado: path.join(dir, '.vigia', 'c.log') });
    assert.equal(p.codigo, 2,
      '🔴 la primera pasada ya no dice NO SE SABE. Sin lectura anterior no se puede saber si '
      + 'producción se mueve, y decir «al día» sería inventárselo.\n' + p.salida);
    assert.match(p.salida, /NO SÉ SI SE ESTÁ CERRANDO|no se sabe|NO SUPE MIRAR/i,
      '🔴 sale con 2 pero sin explicar que no lo sabe.');
  } finally {
    await srv.cierra();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-716c · 🔴 SUELO: si no logra leer `/version` es NO SE SABE, nunca «al día»', async () => {
  const { dir } = repoDePrueba();
  try {
    // Conexión rechazada al instante: no depende de la red ni de producción.
    const p = await corre({
      cwd: dir, url: 'http://127.0.0.1:1/version', estado: path.join(dir, '.vigia', 'c.log'),
    });
    assert.equal(p.codigo, 2,
      '🔴 con `/version` inalcanzable el vigía NO puede salir con 0. No saber no es estar al día.\n'
      + p.salida);
    // 🔴 AQUÍ HABÍA UN `doesNotMatch(/al día/)` Y SE CAZABA A SÍ MISMO. El vigía, cuando no
    // puede mirar, EXPLICA en su propia salida que «Esto NO es producción está al día» — y esa
    // frase hacía saltar la negación. Lección de SCRUM-349, tercera vez en esta sesión: se mira
    // el VEREDICTO, que es legible por máquina, no la prosa que lo explica.
    // Se parte con una expresión regular para no depender del fin de línea de la plataforma.
    // Se parte con expresión regular para no depender del fin de línea de la plataforma.
    const renglon = p.salida.split(/\r?\n/).find((l) => l.startsWith("vigía · "));
    assert.ok(renglon, "🔴 CIEGO: no hay renglón de constancia en la salida: " + p.salida);
    assert.match(renglon, / · no-supe-mirar · /,
      "🔴 el veredicto anotado no es «no-supe-mirar» con `/version` inalcanzable: " + renglon);
    assert.doesNotMatch(renglon, / · al-dia · /,
      '🔴 el vigía ha anotado «al día» sin haber podido mirar. No saber no es estar al día.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-716c · ✅ CONTROL: el arreglo no ha tocado lo que el vigía DECIDE', () => {
  // Este ticket es de TRANSPORTE. Si además hubiera cambiado el juicio, el verde de arriba no
  // diría lo que parece.
  const cli = leer(CLI);
  assert.match(cli, /process\.exit\(final\.salida\)/,
    '🔴 ha cambiado quién decide el código de salida del vigía. Esto era un arreglo del '
    + 'transporte, no del juicio.');
  assert.match(cli, /VIGIA_ESTADO/,
    '🔴 el vigía ya no lee `VIGIA_ESTADO`: el transporte que este ticket arregla no tendría a '
    + 'quién servir.');
  // Y el job informativo de PR sigue sin vetar: en cuanto sea bloqueante, le cierra la puerta a
  // quien viene a arreglar lo que mide.
  assert.match(jobDe(leer(CI), 'vigia-despliegue'), /continue-on-error:\s*true/,
    '🔴 el vigía de PR ha dejado de ser informativo. Un check bloqueante le cierra la puerta a la '
    + 'rama que viene a arreglar el despliegue que él mismo está midiendo.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-824b · EL SUCESOR DEL ⑤ RETIRADO: LA PREGUNTA SIGUE VIVA, LO QUE MURIÓ ES SU FIXTURE
//
// El ⑤ de SCRUM-824 preguntaba lo correcto —«con una lectura anterior que NO se puede leer, ¿el
// vigía SIGUE diciendo NO SE SABE?»— y por el camino bueno: el CLI de verdad, con su código de
// salida y su motivo. Lo que se quedó sin valer es CON QUÉ lo preguntaba: sembraba `12345678…`
// como ejemplo de «ilegible», y desde SCRUM-824b ese sha SE LEE. Un control cuyo caso de prueba
// ha dejado de ser el caso no mide lo que su nombre dice — mide otra cosa, y en verde.
//
// ── QUÉ FIXTURE SIRVE HOY, MEDIDO Y NO SUPUESTO ─────────────────────────────────────────────
// Se probaron los candidatos contra la cadena real, y sólo uno llega a la rama que interesa:
//
//     prod=1788742571305  → SÍ parsea · «la lectura anterior no publica un sha legible»  ← ÉSTA
//     prod=1788742571     → SÍ parsea · misma rama (epoch en segundos)
//     prod=40606975       → SÍ parsea · «despliega»   ← ya se lee: es el arreglo de 824b
//     prod=?              → NO parsea · «no hay lectura anterior»  ← OTRA rama, la de más arriba
//
// 🔴 Y ESO ES UN SUELO, NO UN DETALLE: el primer intento de este control sembró `prod=?` dando
// por hecho que «ilegible es ilegible». Salía en exit 2, o sea VERDE, pero por la rama de «no hay
// lectura anterior»: habría sustituido al ⑤ sin cubrir nada de lo que el ⑤ cubría. Por eso abajo
// se comprueba que el renglón sembrado PARSEA antes de creerse el veredicto.
//
// ── POR QUÉ SE SUSTITUYE EL CAMPO A MANO, Y POR QUÉ ES LEGÍTIMO ─────────────────────────────
// `corto()` hoy escribe `?` ante un reloj, así que ESTE vigía no produce ya un renglón así. Pero
// el fichero de constancias es una CACHÉ que sobrevive al código que la escribió: se restaura
// entre ejecuciones, y una línea que esta versión no escribiría puede llegarle igual. Para eso
// existe el suelo. El FORMATO se le sigue pidiendo al formateador de verdad; lo único que se
// sustituye es el campo que este control interroga.
// ═══════════════════════════════════════════════════════════════════════════════════════════

test(String.raw`SCRUM-824b · 🔴 EL NEGATIVO: si la lectura anterior no publica un sha legible, el vigía SIGUE diciendo NO SE SABE`, async () => {
  const { constanciaDeEjecucion } = await import('../scripts/_vigilante-de-despliegue.mjs');
  const { lecturaDeLaConstancia } = await import('../scripts/_ritmo-de-despliegue.mjs');
  const { dir, shas } = repoDePrueba();
  const srv = await servidorDeVersion();
  const estado = path.join(dir, '.vigia', 'constancias.log');
  const RELOJ = '1788742571305';   // `String(Date.now())`, el fallback de `env.ts`, tal cual
  try {
    const { renglon } = constanciaDeEjecucion(
      { veredicto: 'atrasado', horas: 48, titulo: '' },
      { versionDeProduccion: shas[0], shaDeMain: shas[2], commitsPorDelante: 2, ahoraEpoch: 1757000000 },
    );
    const sembrado = renglon.replace('prod=' + shas[0].slice(0, 8), 'prod=' + RELOJ);

    // 🔴 LOS DOS SUELOS, y el segundo es el que cazó el primer intento de este control.
    assert.ok(sembrado.includes('prod=' + RELOJ + ' '),
      '🔴 CIEGO: no he conseguido dejar el reloj en el campo `prod=`, así que lo de abajo no '
      + 'prueba el caso ilegible: ' + sembrado);
    assert.ok(lecturaDeLaConstancia(sembrado),
      '🔴 CIEGO: el renglón sembrado NO PARSEA como lectura, así que el vigía dirá NO SE SABE por '
      + '«no hay lectura anterior» y este control saldría verde sin haber tocado la rama que dice '
      + 'vigilar. Es exactamente lo que pasó con `prod=?` al escribirlo.');

    fs.mkdirSync(path.dirname(estado), { recursive: true });
    fs.writeFileSync(estado, sembrado + '\n', 'utf8');

    srv.di(shas[1]);
    const p = await corre({ cwd: dir, url: srv.url, estado });

    assert.equal(p.codigo, 2,
      '🔴 con una lectura anterior que NO se puede leer, el vigía ha contestado algo distinto de '
      + 'NO SE SABE. Eso es inventarse la mitad que falta, y es justo lo que su `shaLegible` '
      + 'existe para impedir. Leer el sha corto de ocho dígitos (SCRUM-824b) NO se paga con esto.\n' + p.salida);
    assert.match(p.salida, /no publica un sha legible/,
      '🔴 dice NO SE SABE, pero por otro motivo: no ha entrado por la rama de la lectura anterior '
      + 'ilegible, que es la única que este control cubre. El motivo es además lo que permitió '
      + 'DIAGNOSTICAR esto; sin él, SCRUM-824 habría sido otra semana de hipótesis.\n' + p.salida);
  } finally {
    await srv.cierra();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
