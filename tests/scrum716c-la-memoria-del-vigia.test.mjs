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
// 🔴 SCRUM-824 · EL SHA QUE UNA VEZ DE CADA CUARENTA NO SE PUEDE LEER
//
// ── EL SÍNTOMA ─────────────────────────────────────────────────────────────────────────────
//
// Los dos CONTROLES de abajo fallaban en CI de forma intermitente y bloquearon tres ramas: 626,
// 527 y 632b. El re-run salía verde. Dos sesiones no lo reprodujeron —worktree limpio, fichero
// suelto, tanda entera: 8/8 verde— y se descartaron por medición `RAILWAY_GIT_COMMIT_SHA` (no
// existe ni en la máquina de sesión ni en el runner) y `env.ts` (este test no lo toca).
//
// ── LA CAUSA, MEDIDA CON N=200 Y CORRELACIÓN PERFECTA ──────────────────────────────────────
//
//                                    el test pasa      el test FALLA
//     8 primeros del sha TODO DÍGITOS      0                 6
//     8 primeros con alguna letra        194                 0
//
// La cadena, eslabón a eslabón, y ninguno está roto:
//
//   ① el fixture crea commits VACÍOS fechados a partir de `Date.now()`, así que su sha es
//      **distinto en cada pasada** — el reloj no mueve el hueco de 48/60 h, pero SÍ aleatoriza
//      el sha, y ése es el acoplamiento que nadie había mirado;
//   ② `constanciaDeEjecucion` escribe en el historial `prod=` con los OCHO primeros
//      (`corto()`, `scripts/_vigilante-de-despliegue.mjs:240`);
//   ③ y `shaLegible` (`scripts/_ritmo-de-despliegue.mjs:76`) **rechaza a propósito lo que sea
//      todo dígitos**, porque sin `RAILWAY_GIT_COMMIT_SHA` producción publica `String(Date.now())`
//      y trece dígitos son hexadecimal válido. Ese rechazo **es correcto y tiene su precio
//      DECLARADO en el propio módulo**: «un sha abreviado que salga todo dígitos también se
//      rechaza… en torno al 2 % de las veces ((10/16)^8)».
//
// 🔴 O SEA: EL VIGÍA NO SE EQUIVOCA NI UNA VEZ. Hace exactamente lo que dice que hace y avisa del
// precio por escrito. Quien asumía era ESTE FIXTURE, que daba por hecho que un sha de git siempre
// se puede leer. Una vez de cada 43, no.
//
// ⚠️ Y LO QUE NO ERA, medido en vez de descartado de palabra: el botón «Update branch» de GitHub.
// 100 pasadas sobre una rama CON commit de merge → 6 fallos. 100 sobre `origin/main` limpio → 6
// fallos. El botón no influye: lo que hacía era **tirar el dado otra vez**.
//
// ── EL ARREGLO, Y LO QUE NO ES ─────────────────────────────────────────────────────────────
//
// El fixture MINA el commit: si los ocho primeros salen todo dígitos, lo repite con la fecha
// corrida un segundo hasta que salga legible. Un segundo no mueve un hueco de 48 h, y el tope de
// reintentos PETA en vez de devolver el malo en silencio.
//
// ⛔ NO se toca el vigía · ⛔ ningún caso baja a `skip` (SCRUM-754: un test saltado se cuenta como
// pasado) · ⛔ el margen de 6 h y el veredicto NO_SE_SABE siguen intactos. Y el rechazo de los
// todo-dígitos NO se anula: tiene su propio control abajo —el ⑤— que exige que el vigía SIGA
// diciendo NO SE SABE ante una lectura anterior de verdad ilegible. Eso no es el defecto: es su
// trabajo, y ahora queda FIJADO en vez de ocurrir por sorpresa una vez de cada 43.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Los OCHO primeros: es lo que `corto()` deja viajar en la constancia, ni uno más. */
const PREFIJO_DE_LA_CONSTANCIA = 8;
const SOLO_DIGITOS = /^[0-9]+$/;

/** ¿El prefijo que viajará en `prod=` es de los que el vigía NO puede leer? */
export function prefijoIlegible(sha) {
  return SOLO_DIGITOS.test(String(sha == null ? '' : sha).slice(0, PREFIJO_DE_LA_CONSTANCIA));
}

/**
 * Hace commits hasta que el sha sirva, y dice CUÁNTOS hicieron falta.
 *
 * `hacerCommit(iso, intentos)` es la única parte que toca git, y por eso se inyecta: los controles
 * de abajo le pasan shas de mentira y fijan el bucle **sin depender del azar** — que es justo el
 * defecto que este ticket cierra. Un control que necesitase que le tocara la lotería para probar
 * algo sería la misma trampa con otro nombre.
 */
export function commitHastaShaLegible(hacerCommit, cuandoMs, tope = 40) {
  let intentos = 0;
  for (;;) {
    const sha = hacerCommit(new Date(cuandoMs).toISOString(), intentos);
    if (!prefijoIlegible(sha)) return { sha, intentos };
    intentos += 1;
    if (intentos > tope) {
      throw new Error('🔴 CIEGO: ' + (tope + 1) + ' commits seguidos con los ocho primeros todo '
        + 'dígitos. Eso no pasa por azar: o `hacerCommit` no está cambiando el sha, o devuelve '
        + 'algo que no es un sha. Se PETA en vez de seguir con el ilegible, porque devolverlo en '
        + 'silencio es exactamente el fallo que cierra SCRUM-824.');
    }
    // Un segundo. Cambia el sha entero y no mueve un hueco de 48 h ni en la primera decimal.
    cuandoMs += 1000;
  }
}

/**
 * Un repo de usar y tirar con tres commits VIEJOS y `origin/main` en el tercero.
 *
 * 🔴 Los tres shas salen MINADOS: ninguno tiene los ocho primeros todo dígitos. El porqué y lo que
 * se midió, en el bloque de SCRUM-824 de aquí arriba.
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
    const { sha } = commitHastaShaLegible((iso, intentos) => {
      const env = { ...process.env, GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso };
      // El reintento AMENDA: si añadiera commits, el repo tendría más de tres y `commits=` —que
      // el vigía cuenta y la constancia publica— dejaría de ser el que estos casos esperan.
      const args = intentos === 0
        ? ['commit', '--allow-empty', '-q', '-m', 'c' + k]
        : ['commit', '--amend', '--allow-empty', '--no-edit', '-q'];
      execFileSync('git', args, { cwd: dir, env });
      return g('rev-parse', 'HEAD');
    }, Date.now() - (72 - k * 12) * 3600 * 1000);
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
// ⑤ 🔴 SCRUM-824 · LOS CONTROLES DEL MINERO, Y EL NEGATIVO QUE IMPIDE QUE ESTO SEA UN APAGADO
//
// Los cuatro primeros fijan el minero **sin tocar git y sin depender del azar**: le inyectan los
// shas. Un control que necesitase que le tocara la lotería 1-de-43 para probar algo sería el
// mismo defecto con otro nombre.
//
// El quinto es el que impide que este ticket se convierta en «se ha callado el rojo»: con una
// lectura anterior DE VERDAD ilegible, el vigía TIENE que seguir diciendo NO SE SABE.
// ═══════════════════════════════════════════════════════════════════════════════════════════

test(String.raw`SCRUM-824 · ① el detector del fixture CUADRA con lo que el vigía sabe leer`, async () => {
  // 🔴 No se copia la regla del vigía: se le PREGUNTA. Si mañana `shaLegible` cambia de criterio,
  // este control cae y avisa, en vez de quedarse con una copia que ya no corresponde.
  const { constanciaDeEjecucion } = await import('../scripts/_vigilante-de-despliegue.mjs');
  const { ultimaLectura, ritmoDeDespliegue, NO_SE_SABE } = await import('../scripts/_ritmo-de-despliegue.mjs');

  const otro = 'deadbeef' + '0'.repeat(32);
  const ritmoTrasGuardar = (sha40) => {
    const { renglon } = constanciaDeEjecucion(
      { veredicto: 'atrasado', horas: 48, titulo: '' },
      { versionDeProduccion: sha40, shaDeMain: otro, commitsPorDelante: 1, ahoraEpoch: 1757000000 },
    );
    return { renglon, ritmo: ritmoDeDespliegue(ultimaLectura(renglon), { versionDeProduccion: otro }).ritmo };
  };

  const ilegible = '12345678' + 'a'.repeat(32);
  const legible = '1234567a' + 'a'.repeat(32);

  // POSITIVO: lo que el detector marca como ilegible, el vigía NO lo puede leer.
  assert.equal(prefijoIlegible(ilegible), true,
    '🔴 el detector no ve el caso de ocho dígitos, que es el que bloqueó tres ramas.');
  const malo = ritmoTrasGuardar(ilegible);
  assert.match(malo.renglon, /prod=\d{8} /,
    '🔴 CIEGO: la constancia no ha salido con `prod=` de ocho dígitos; lo de abajo no prueba nada.');
  assert.equal(malo.ritmo, NO_SE_SABE,
    '🔴 el detector dice ILEGIBLE y el vigía sí lo lee: entonces el detector está de más y el '
    + 'fixture estaría minando por una razón que ya no existe.');

  // NEGATIVO: con UNA letra entre los ocho primeros, se lee. Sin esto, un detector que dijera
  // «ilegible» a todo pasaría el positivo y el fixture minaría eternamente.
  assert.equal(prefijoIlegible(legible), false,
    '🔴 el detector marca como ilegible un sha que sí se lee: mina de más.');
  assert.notEqual(ritmoTrasGuardar(legible).ritmo, NO_SE_SABE,
    '🔴 el vigía tampoco lee un prefijo CON letra. Entonces el problema no es el que este ticket '
    + 'midió y el arreglo no vale: hay que volver a medir antes de tocar nada.');
});

test(String.raw`SCRUM-824 · ② el minero reintenta hasta dar con uno legible, y cambia la fecha en cada vuelta`, () => {
  const dados = ['00000000' + 'a'.repeat(32), '12345678' + 'b'.repeat(32), 'a1b2c3d4' + 'c'.repeat(32)];
  const fechas = [];
  const r = commitHastaShaLegible((iso, intentos) => { fechas.push(iso); return dados[intentos]; },
    Date.parse('2026-09-01T00:00:00Z'));

  assert.equal(r.sha, dados[2], '🔴 no devuelve el primer sha legible que encontró.');
  assert.equal(r.intentos, 2, '🔴 no cuenta los reintentos, y ese número es lo que permite '
    + 'comprobar que el minero se ha usado de verdad.');

  // 🔴 Y LA FECHA CAMBIA EN CADA VUELTA. Si no cambiara, git devolvería el MISMO sha para
  // siempre: el bucle giraría 41 veces y petaría sin que nadie entendiera por qué.
  assert.equal(new Set(fechas).size, 3,
    '🔴 el minero repite el commit con la MISMA fecha. Mismo árbol, mismo padre y misma fecha dan '
    + 'el mismo sha: reintentar sin mover la fecha no reintenta nada.');
});

test(String.raw`SCRUM-824 · ③ 🔴 SUELO: si nunca encuentra uno legible PETA, no devuelve el malo en silencio`, () => {
  const siempreIlegible = '99999999' + 'a'.repeat(32);
  assert.throws(() => commitHastaShaLegible(() => siempreIlegible, Date.now(), 5), /CIEGO/,
    '🔴 el minero se rinde en silencio y devuelve el sha ilegible. Eso es EXACTAMENTE el fallo de '
    + 'SCRUM-824 —seguir adelante con una lectura que no se puede leer—, sólo que ahora sería a '
    + 'propósito.');
});

test(String.raw`SCRUM-824 · ④ y no toca lo que ya vale: cero reintentos`, () => {
  const r = commitHastaShaLegible(() => 'a1b2c3d4' + '0'.repeat(32), Date.now());
  assert.equal(r.intentos, 0, '🔴 mina un sha que ya era legible: cada vuelta de más es un commit '
    + 'de más y una fecha corrida sin motivo.');
});

test(String.raw`SCRUM-824 · ⑤ 🔴 EL NEGATIVO: con una lectura anterior DE VERDAD ilegible, el vigía SIGUE diciendo NO SE SABE`, async () => {
  // Éste es el control que impide que este ticket haya sido un apagado. El rechazo de los
  // todo-dígitos es una decisión del vigía, está razonada en su módulo y NO se anula aquí: lo que
  // se ha quitado es que el fixture lo pisara por azar. Puesto a mano, tiene que seguir pasando.
  const { constanciaDeEjecucion } = await import('../scripts/_vigilante-de-despliegue.mjs');
  const { dir, shas } = repoDePrueba();
  const srv = await servidorDeVersion();
  const estado = path.join(dir, '.vigia', 'constancias.log');
  try {
    // La constancia ilegible se le PIDE AL FORMATEADOR DE VERDAD, no se copia a mano: si el
    // formato del renglón cambia, este control cambia con él en vez de quedarse probando un
    // formato que ya nadie escribe.
    const { renglon } = constanciaDeEjecucion(
      { veredicto: 'atrasado', horas: 48, titulo: '' },
      { versionDeProduccion: '12345678' + 'a'.repeat(32), shaDeMain: shas[2], commitsPorDelante: 2, ahoraEpoch: 1757000000 },
    );
    assert.match(renglon, /prod=\d{8} /,
      '🔴 CIEGO: la constancia sembrada no lleva `prod=` de ocho dígitos, así que no está probando '
      + 'el caso ilegible y este control valdría cero.');
    fs.mkdirSync(path.dirname(estado), { recursive: true });
    fs.writeFileSync(estado, renglon + '\n', 'utf8');

    srv.di(shas[1]);
    const p = await corre({ cwd: dir, url: srv.url, estado });

    assert.equal(p.codigo, 2,
      '🔴 con una lectura anterior que NO se puede leer, el vigía ha contestado algo distinto de '
      + 'NO SE SABE. Eso sería inventarse la mitad que falta: es justo lo que su `shaLegible` existe para impedir, y no se abarata por arreglar un fixture.\n' + p.salida);
    assert.match(p.salida, /no publica un sha legible/,
      '🔴 dice NO SE SABE pero sin decir por qué. El motivo es lo que permitió DIAGNOSTICAR esto: '
      + 'sin él, SCRUM-824 habría sido otra semana de hipótesis.\n' + p.salida);
  } finally {
    await srv.cierra();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
