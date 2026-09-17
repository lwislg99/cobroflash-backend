// tests/scrum835-credenciales-en-el-historial.test.mjs — SCRUM-835
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL REPOSITORIO ES PÚBLICO Y NADIE HABÍA MIRADO NUNCA EL HISTORIAL
//
// Una clave que se subió y se borró al día siguiente **sigue publicada**: el commit que la
// introdujo continúa siendo alcanzable. Barrer `HEAD` contesta otra pregunta.
//
// Se leen los blobs ALCANZABLES desde cualquier ref —incluidas las de `origin`—, que es lo que
// de verdad está publicado y lo que un clon de CI recibe. El porqué, en `_barrido-de-credenciales.mjs`.
//
// Y no se cierra cerrando el repo: se decidió el 9-sep-2026 que sigue siendo PÚBLICO porque
// pasarlo a privado costaría ~150 $/mes de CI. Este riesgo se cierra MIRÁNDOLO, y mirándolo cada
// vez — un barrido que se hace una vez caduca al día siguiente.
//
// ── LO MEDIDO EL 9-sep-2026 (`origin/main` = 2119c430) ─────────────────────────────────────
// 10.156 blobs, 4.632 commits, 158 MB de `.git`. **Cero credenciales.** Los 12 hallazgos de la
// primera pasada eran todos falsos y están explicados en `docs/master/SCRUM-835.md`.
//
// 🔴 Y EL INSTRUMENTO MINTIÓ ANTES QUE EL ÁRBOL: dos de aquellos 12 tenían por «contraseña» un
// `${…}`, o sea el NOMBRE de una variable. Acusaba justo al código que hace las cosas bien.
// Por eso `esHueco` va antes que cualquier veredicto, y por eso el control negativo de abajo
// lleva las cinco formas de hueco.
//
// ── ⛔ LO QUE ESTE GUARD **NO** CUBRE, dicho aquí para que nadie le suponga más ──────────────
//
//   ① NO detecta un secreto SIN FORMA reconocible. Una contraseña de base de datos suelta en una
//      variable —`const clave = 'loQueSea'`— no se distingue de cualquier otra cadena. Lo que se
//      caza es el prefijo del proveedor, el bloque PEM y el `usuario:clave@host`.
//   ② NO lee blobs de más de 2 MB ni binarios (NUL en los primeros 8 KB). Se CUENTAN y se
//      declaran en el suelo; no se callan.
//   ③ NO mira los MENSAJES de commit, ni los nombres de rama, ni las etiquetas: sólo contenidos
//      de fichero. Un secreto pegado en un mensaje de commit se le escapa.
//   ④ NO mira los objetos que sólo existen en el REMOTO y no se han traído. Mide este clon.
//   ⑤ NO valida si la credencial es válida HOY. Una clave revocada sigue saliendo, y está bien:
//      revocarla es la respuesta, no dejar de verla.
//   ⑥ Una credencial rota en dos trozos y unida en tiempo de ejecución no tiene forma, y no sale.
//   ⑦ NO mira los objetos SUELTOS de este clon (los que no cuelgan de ninguna ref). Son basura
//      local —un commit enmendado, una rama descartada— y nunca se empujaron: acusarlos sería
//      decir «publicaste» de algo que no salió de esta máquina. Lo que sí queda cubierto, que es
//      el caso del ticket, es la clave introducida en un commit y BORRADA en el siguiente: ese
//      commit sigue siendo alcanzable, y el control sembrado de abajo lo fija.
//      ⚠️ La cara mala: un blob que SÍ se empujó y luego quedó inalcanzable en el remoto (un
//      `push --force`) sigue estando en GitHub y este clon ya no lo tiene. Eso no lo ve nadie
//      desde aquí, y por eso se dice.
//
// 🔒 Un guard que promete más de lo que hace es peor que uno que promete poco: el primero se
// convierte en la razón por la que nadie vuelve a mirar.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { credencialesEn, esHueco, SENALES } from '../scripts/_credenciales-en-texto.mjs';
import { blobsDelRepositorio, barrer, rutasDe, TOPE_BYTES } from '../scripts/_barrido-de-credenciales.mjs';

const RAIZ = path.join(import.meta.dirname, '..');

// 🔴 UNA SOLA VEZ. Enumerar los objetos alcanzables cuesta ~3,4 s (medido el 9-sep-2026) y no
// cambia dentro de una tanda; hacerlo por test le sumaba siete segundos a cada `npm test` sin
// medir nada nuevo. Los repositorios sintéticos de más abajo SÍ se vuelven a enumerar, porque
// ahí lo que se está probando es justamente que el barrido note el cambio.
const BLOBS = blobsDelRepositorio(RAIZ);
const BARRIDO = await barrer(RAIZ, BLOBS);

// 🔴 LOS EJEMPLOS SE FABRICAN EN EJECUCIÓN, PARTIDOS. Escritos enteros, este fichero sería él
// mismo un hallazgo en cuanto se comiteara: el barrido lee todos los blobs ALCANZABLES, y este
// fichero lo es en cuanto entra en un commit. Pasó con el del PEM, ver abajo.
const ej = {
  stripe: 's' + 'k_live_' + 'A'.repeat(24),
  aws: 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP',
  github: 'gh' + 'p_' + 'b'.repeat(36),
  google: 'AI' + 'za' + 'C'.repeat(35),
  slack: 'xox' + 'b-' + '1234567890-abcdefghij',
  // 🔴 ÉSTE ME CAZÓ A MÍ, 9-sep-2026. Los otros siete los escribí partidos y éste entero — y en
  // cuanto se comiteó, el barrido encontró el fichero del barrido. No había ninguna credencial: era
  // la cabecera de un bloque PEM, sin material de clave, pero la FORMA es la forma. La trampa está
  // documentada en la cabecera de este mismo fichero y aun así caí en uno de los ocho.
  pem: '-----' + 'BEGIN ' + 'RSA ' + 'PRIVATE KEY' + '-----',
  jwt: 'eyJ' + 'hbGciOiJIUzI1NiJ9' + '.eyJ' + 'zdWIiOiIxMjM0NSJ9' + '.abcdefghijklmno',
  conexion: 'postgresql://' + 'unusuario' + ':' + 'Zx9-Qw3-Lm7-Pk2' + '@' + 'db.proveedor-real.net' + ':5432/base',
};

test('SCRUM-835 · ✅ CONTROL POSITIVO: el detector ve CADA forma que dice ver', () => {
  const vistos = [];
  for (const [nombre, valor] of Object.entries(ej)) {
    const r = credencialesEn(`const x = "${valor}";`);
    assert.ok(r.length > 0, `🔴 no ve la forma «${nombre}». Un cero del barrido sería su ceguera.`);
    vistos.push(r[0].tipo);
  }
  // Y las señales declaradas no se quedan sin ejercitar en silencio.
  assert.ok(SENALES.length >= 15,
    `🔴 sólo ${SENALES.length} señales declaradas. Si la lista encoge, el barrido mira menos y `
    + 'nada lo dice.');
  assert.ok(new Set(vistos).size >= 7, '🔴 varias formas están cayendo en el mismo tipo.');
});

test('SCRUM-835 · 🔴 CONTROL NEGATIVO: una plantilla NO es un valor', () => {
  // El falso positivo que este módulo YA cometió, con las cinco formas de hueco del árbol.
  for (const hueco of ['${SECRETO}', '${PASS}', '$DATABASE_URL', '%DB_PASS%', '<tu-clave>', '{{clave}}']) {
    assert.ok(esHueco(hueco), `🔴 «${hueco}» no se reconoce como hueco.`);
    assert.deepEqual(credencialesEn(`postgresql://usuario:${hueco}@servidor.ejemplo:5432/b`), [],
      `🔴 «${hueco}» se está contando como contraseña. Eso acusa al código que usa variables, que `
      + 'es justamente el que hace las cosas bien.');
  }
  // Rellenos y hosts que no son de nadie.
  for (const inocente of [
    'postgresql://user:pass@localhost:5432/db',
    'postgresql://usuario:clave@127.0.0.1/base',
    'postgresql://u:changeme@db.example.com/x',
    'https://api.proveedor.com/v1/cosas',          // una URL sin credenciales no lo es
    'la contraseña se guarda en Railway, nunca en el repo',  // la PALABRA no es la clave
  ]) {
    assert.deepEqual(credencialesEn(inocente), [], `🔴 falso positivo con: ${inocente}`);
  }
});

test('SCRUM-835 · ✅ CONTROL POSITIVO SEMBRADO: una credencial COMITEADA se caza, y BORRARLA no la esconde', async () => {
  // 🔴 EL CONTROL QUE CONVIERTE EL CERO EN UNA RESPUESTA. Los de arriba prueban el detector sobre
  // una cadena; éste prueba el CAMINO ENTERO: git guarda el blob → el barrido lo lee → lo caza.
  // Sin esto, «cero credenciales» podría ser «el barrido no llega a los objetos de git».
  //
  // ⚠️ SE SIEMBRA EN UN REPOSITORIO TEMPORAL, NO EN ÉSTE, y no es comodidad: para que el blob
  // sembrado desapareciera de aquí habría que hacer `git gc --prune=now`, y este `.git` lo
  // COMPARTEN seis worktrees — eso les borraría a las demás sesiones su red del reflog.
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-835-'));
  const git = (...a) => execFileSync('git', a, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    git('init', '--quiet');
    git('config', 'user.email', 'control@ejemplo.invalid');
    git('config', 'user.name', 'control positivo');
    git('config', 'commit.gpgsign', 'false');

    fs.writeFileSync(path.join(raiz, 'inocente.txt'), 'aquí no hay nada\n');
    git('add', '-A'); git('commit', '--quiet', '-m', 'sin nada');
    const antes = await barrer(raiz, blobsDelRepositorio(raiz));
    assert.deepEqual(antes.hallazgos, [],
      '🔴 el barrido acusa a un repositorio donde no hay nada: acusaría también a éste.');

    // Se siembra, se comitea y se BORRA en el commit siguiente — el caso exacto del ticket.
    fs.writeFileSync(path.join(raiz, 'config.txt'), `STRIPE=${ej.stripe}\nDB=${ej.conexion}\n`);
    git('add', '-A'); git('commit', '--quiet', '-m', 'la que se coló');
    fs.rmSync(path.join(raiz, 'config.txt'));
    git('add', '-A'); git('commit', '--quiet', '-m', 'y la que se borro al dia siguiente');

    const despues = await barrer(raiz, blobsDelRepositorio(raiz));
    const tipos = [...new Set(despues.hallazgos.map((h) => h.tipo))].sort();
    assert.deepEqual(tipos, ['cadena-de-conexion', 'stripe-secreta'],
      '🔴 el barrido NO caza una credencial que está en el historial. Entonces el «cero» del test '
      + 'de abajo no dice «no hay»: dice «no sé mirar».');

    // 🔒 Y LA MITAD QUE EXPLICA EL TICKET: el fichero ya NO existe en `HEAD` y la credencial sigue
    // saliendo. Borrar no despublica.
    assert.equal(fs.existsSync(path.join(raiz, 'config.txt')), false);
    assert.equal(git('ls-tree', '-r', '--name-only', 'HEAD').includes('config.txt'), false,
      '🔴 el fichero sigue en HEAD: entonces esto no está probando lo que dice probar.');
    assert.ok(despues.hallazgos.length > 0,
      '🔴 al borrar el fichero el barrido ha dejado de verla. Es justo el defecto que este ticket '
      + 'existe para cerrar: el commit que la introdujo sigue siendo alcanzable.');
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});

test('SCRUM-835 · 🔴 SUELO: el barrido LEE el repositorio, o se declara CIEGO', () => {
  const blobs = BLOBS;
  assert.ok(blobs.length >= 5000,
    `🔴 CIEGO: sólo ${blobs.length} blobs. Este repositorio tenía 10.156 el 9-sep-2026; una `
    + 'población así de corta significa que el barrido no está llegando al historial, no que el '
    + 'historial haya encogido. Un cero medido así no dice «no hay credenciales».');

  const r = BARRIDO;
  assert.equal(r.leidos + r.saltados, blobs.length,
    '🔴 las cuentas no cuadran: leídos + saltados tiene que ser el total. Si no, hay blobs que se '
    + 'pierden por el camino sin que nadie lo sepa.');
  // Lo que NO se lee se DECLARA. Callarlo convertiría el tope en un agujero silencioso.
  console.log(`    · blobs ${blobs.length} · leídos ${r.leidos} · binarios ${r.binarios} `
    + `· saltados por tamaño (>${TOPE_BYTES} B) ${r.saltados}`);
});

test('SCRUM-835 · 🔴 NO HAY NINGUNA CREDENCIAL EN EL HISTORIAL', () => {
  const r = BARRIDO;
  if (!r.hallazgos.length) return;

  // ⛔ Se informa de DÓNDE y de QUÉ TIPO. El valor no sale de aquí: un mensaje de fallo que cita
  // el secreto lo publica otra vez, y encima en la salida de CI de un repositorio público.
  const rutas = rutasDe(RAIZ, r.hallazgos.map((h) => h.oid));
  const lineas = [...new Map(r.hallazgos.map((h) => [h.oid + h.tipo, h])).values()]
    .map((h) => `   · ${h.tipo}  en  ${rutas.get(h.oid) || '(blob sin ruta: suelto en el objeto store)'}  [blob ${h.oid.slice(0, 12)}]`);
  assert.fail('🔴 HAY CREDENCIALES EN EL HISTORIAL DE UN REPOSITORIO PÚBLICO:\n' + lineas.join('\n')
    + '\n\n  Está publicada desde el día que entró y BORRARLA DEL ÁRBOL NO LA DESPUBLICA: el commit'
    + '\n  que la introdujo sigue siendo alcanzable. Lo primero es REVOCARLA y rotarla en el'
    + '\n  proveedor; reescribir el historial es lo segundo, y no la des-publica retroactivamente.'
    + '\n\n  Para saber en qué commit entró, sin imprimir el valor:'
    + '\n      git log --all --format="%h %ad %s" --date=short --find-object=<blob>');
});
