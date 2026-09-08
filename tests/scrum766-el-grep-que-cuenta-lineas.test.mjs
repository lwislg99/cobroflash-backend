// SCRUM-766 · EL `grep` QUE CUENTA LÍNEAS.
//
// Sin gate: fabrica ficheros en el temporal del sistema y lee el árbol. Ni BD, ni red, ni servidor.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA REGLA GENERAL, QUE ES LO ÚNICO QUE HAY QUE RECORDAR DE ESTE FICHERO
//
//   Un instrumento que devuelve un número PLAUSIBLE no está verificado hasta que se le enseña un
//   caso de RESPUESTA CONOCIDA.
//
// `wc -l` y «ficheros con CR» son números del mismo orden de magnitud sobre el mismo árbol. NADA
// EN LA SALIDA DELATA LA SUSTITUCIÓN. Contra un valor ilegible se puede programar una barrera;
// contra uno plausible no hay síntoma — y por eso el control que decide no puede ser un fichero
// del árbol, cuya respuesta sale del propio instrumento que se juzga. Tiene que ser FABRICADO.
//
// ── EL CONTROL POSITIVO SOLO NO BASTA, Y AQUÍ SE VE POR QUÉ ─────────────────────────────────
// El enunciado de este ticket decía: «un fichero LF puro da 0 en los dos — que es POR LO QUE LA
// SUSTITUCIÓN PASA DESAPERCIBIDA en el caso fácil». MEDIDO, eso vale para UNA de las dos caras y
// no para la otra, y la diferencia importa:
//
//   · cara A (`grep -c $'\r' F` directo)     LF puro → 0 = la verdad.  El control positivo PASA
//     y no delata nada. Es exactamente el caso descrito en el enunciado.
//   · cara B (`n=$(grep -c $'\r' F)`)        LF puro → 50 ≠ 0.  El control positivo NO pasa: da
//     `wc -l` también aquí. O sea que la cara B es MÁS fácil de cazar de lo que decía el
//     enunciado, y la que de verdad se cuela en silencio es la A.
//
// Lo que sí es cierto en las dos, y es el fondo del ticket: sobre un ÁRBOL de verdad las dos
// devuelven números plausibles, porque nadie sabe de antemano la respuesta correcta.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  contarCR, fabricarControl, hallazgosEn, censar, AUTORREFERENCIA, puedeContener,
  clasificarEntorno, veredictoDelEntorno, MSYS_WINDOWS, GNU_LINUX,
} from '../scripts/censo-cuenta-de-control-con-grep.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** La respuesta se sabe ANTES de medir. Ése es el punto entero. */
const LINEAS = 50;
const CON_CR = 3;

/** Un directorio propio en el temporal del sistema. Nunca se fabrica nada dentro del árbol. */
function tempPropio() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scrum766-'));
}

/**
 * El censo, UNA vez por variante. Lee TODOS los ficheros de texto que git rastrea, así que
 * llamarlo en cada caso repetía la misma lectura del árbol entero. La memoria es POR VARIANTE, no
 * global, para que el caso de la autorreferencia siga comparando dos censos DE VERDAD y no dos
 * vistas del mismo — que es justo el atajo que convertiría ese caso en una identidad siempre verde.
 *
 * ⚠️ Ni cuántos ficheros son ni cuánto se ahorra, a propósito. Lo primero es un recuento del árbol
 *    que caduca con el commit de otro (SCRUM-737); lo segundo no se puede afirmar en esta máquina
 *    (SCRUM-790): sólo leer el árbol costó 5,7 s, 7,0 s y 10,3 s en tres pasadas seguidas del
 *    7-sep-2026 sin tocar una línea, que es más dispersión que cualquier ahorro medible aquí.
 *    El número de ficheros lo DERIVA y lo publica el propio censo, en `leidos`.
 */
const CENSOS = new Map();
function censoDe(incluirAutorreferencia = false) {
  const clave = String(incluirAutorreferencia);
  if (!CENSOS.has(clave)) CENSOS.set(clave, censar(RAIZ, { incluirAutorreferencia }));
  return CENSOS.get(clave);
}

// ── ① EL INSTRUMENTO CORRECTO, CONTRA LA RESPUESTA CONOCIDA ────────────────────────────────

test('SCRUM-766 · 🔴 EL QUE DECIDE: 3 CR en 50 líneas — el contador por BYTES dice 3', () => {
  const dir = tempPropio();
  try {
    const c = fabricarControl({ lineas: LINEAS, conCR: CON_CR });
    const f = path.join(dir, 'control-3cr.txt');
    fs.writeFileSync(f, c.bytes);

    // SUELO: si el fabricante no puso los 3 CR, el resto del fichero mide sobre algo que no es
    // lo que dice medir, y un 3 casual se leería igual de bien que un 3 correcto.
    assert.equal(c.conCR, CON_CR,
      `🔴 CIEGO: el control se ha fabricado con ${c.conCR} CR y no con ${CON_CR}. Nada de lo que `
      + 'venga después mide lo que dice medir.');

    const leido = fs.readFileSync(f);
    assert.equal(contarCR(leido), CON_CR,
      `🔴 el contador por bytes dice ${contarCR(leido)} donde la respuesta CONOCIDA es ${CON_CR}. `
      + 'Este es el único instrumento del que se fía el resto de la casa para los CR.');

    // 🔴 Y ESTE ES EL ASSERT QUE HACE QUE EL CASO DECIDA. Un contador roto que devolviera el
    // número de LÍNEAS pasaría cualquier prueba que sólo mirase «¿es mayor que cero?», y ése es
    // exactamente el número que devuelve el grep de este entorno. Aquí se separan.
    const lineas = leido.toString('latin1').split('\n').length - 1;
    assert.equal(lineas, LINEAS, `🔴 CIEGO: el control tiene ${lineas} líneas y no ${LINEAS}.`);
    assert.notEqual(CON_CR, LINEAS,
      '🔴 el control NO distingue: si los CR y las líneas fuesen el mismo número, un instrumento '
      + 'que contara líneas pasaría este caso y seguiría estando roto.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SCRUM-766 · ✅ POSITIVO: un fichero LF puro da 0 — y por eso solo NO basta', () => {
  const dir = tempPropio();
  try {
    const c = fabricarControl({ lineas: LINEAS, conCR: 0 });
    assert.equal(c.conCR, 0, '🔴 CIEGO: el control «LF puro» se ha fabricado con CR dentro.');
    const f = path.join(dir, 'control-lf.txt');
    fs.writeFileSync(f, c.bytes);
    assert.equal(contarCR(fs.readFileSync(f)), 0,
      '🔴 el contador por bytes ve CR en un fichero fabricado sin ninguno.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── ② LOS DOS SENTIDOS PEGADOS: QUÉ CONTESTA EL `grep` DE ESTE ENTORNO ──────────────────────

/** ¿Hay shell con el que medir la otra cara? Sin él este caso NO APLICA, y se dice. */
const BASH = (() => {
  const r = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() === 'ok';
})();

/**
 * QUÉ PLATAFORMA HAY DELANTE. Se resuelve ANTES de medir nada y SIN mirar la medida: usar la
 * medida para decidir qué medida se espera sería un test que siempre pasa.
 *
 * Dos señales, no una, y tienen que estar de acuerdo (ver `clasificarEntorno`). Si no lo
 * están, o si no hay bash con el que preguntar, la clase sale `null` y el caso se declara
 * CIEGO en vez de absolver a nadie.
 */
const ENTORNO = (() => {
  if (!BASH) return { clase: null, uname: null, machtype: null };
  const leer = (orden) => {
    const r = spawnSync('bash', ['-c', orden], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
  };
  const uname = leer('uname -o');
  const machtype = leer('echo "$MACHTYPE"');
  return { clase: clasificarEntorno({ uname, machtype }), uname, machtype };
})();

/**
 * 🔴 QUÉ CONTESTA EL `grep` DE **ESTA** PLATAFORMA — y cuál es, dicho antes de juzgarlo.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * ENMIENDA DEL 7-sep-2026, Y EL MOTIVO ESTÁ MEDIDO
 *
 * Este caso afirmaba «el grep de este entorno NO reproduce la respuesta conocida», a secas. En CI
 * dio ROJO, y **el rojo era el correcto**: su propio mensaje decía «el entorno ha cambiado».
 * Y había cambiado. El defecto —el CR comido dentro de `$( )`— es del **bash de MSYS en
 * Windows**, que es donde trabajan las sesiones; en `ubuntu-latest`, donde corre CI, el `grep` de
 * GNU **acierta las dos caras**.
 *
 * ⛔ NO SE ARREGLA CON UN SKIP. Un skip escondería el día que CI se mueva a una plataforma que SÍ
 * tenga el defecto. Ahora cada plataforma tiene su AFIRMACIÓN:
 *
 *   · MSYS/Windows → REPRODUCE el defecto, exactamente como hasta hoy, con las dos caras nombradas;
 *   · GNU/Linux    → lo declara ausente como VEREDICTO IMPRESO, y **lo afirma**: si algún día esa
 *                     plataforma dejara de acertar, esto se pone rojo igual.
 *
 * La diferencia con un skip es que el veredicto se imprime y se puede leer. Un skip es un
 * silencio con forma de verde.
 *
 * 🔴 EL SUELO QUE IMPIDE QUE ESTO SE VUELVA UN APAGADO: si no se logra determinar QUÉ shell hay
 * delante, este caso es CIEGO — ni reproduce ni absuelve. «No sé en qué plataforma estoy» no es
 * «aquí no pasa». Y la clasificación NO mira la medida, que sería circular: sale de `uname -o` y
 * de `$MACHTYPE`, dos señales que existen antes de medir nada.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
test('SCRUM-766 · 🔴 qué contesta el `grep` de ESTA plataforma, y cuál es',
  { skip: BASH ? false : 'NO APLICA: no hay `bash` con el que medir la otra cara del instrumento' },
  (t) => {
    const dir = tempPropio();
    try {
      const conCR = fabricarControl({ lineas: LINEAS, conCR: CON_CR });
      const lf = fabricarControl({ lineas: LINEAS, conCR: 0 });
      fs.writeFileSync(path.join(dir, 'a.txt'), conCR.bytes);
      fs.writeFileSync(path.join(dir, 'b.txt'), lf.bytes);

      // La sonda se escribe EN DISCO a propósito: así los bytes que ve bash son auditables y el
      // transporte de quien la lanza no participa de la medida. `< /dev/null` porque si el patrón
      // se evapora, grep se queda leyendo la entrada estándar y la sonda se cuelga en vez de
      // contestar — que fue lo primero que pasó al medir esto.
      const sonda = path.join(dir, 'sonda.sh');
      fs.writeFileSync(sonda, [
        'F="$1"',
        'SUB=$( grep -c $\'\\r\' "$F" < /dev/null )',
        'grep -c $\'\\r\' "$F" < /dev/null > "$F.dir" || true',
        'DIR=$(cat "$F.dir")',
        'LEN=$( P=$\'\\r\'; printf %s "${#P}" )',
        'WC=$(wc -l < "$F")',
        'echo "$SUB $DIR $LEN $WC"',
        '',
      ].join('\n'));

      const medir = (f) => execFileSync('bash', [sonda, path.join(dir, f)], { encoding: 'utf8' })
        .trim().split(/\s+/).map(Number);
      const [subA, dirA, lenA, wcA] = medir('a.txt');
      const [subB, dirB] = medir('b.txt');

      t.diagnostic(`plataforma: uname -o = ${JSON.stringify(ENTORNO.uname)} · MACHTYPE = ${JSON.stringify(ENTORNO.machtype)} → ${ENTORNO.clase}`);
      t.diagnostic(`fichero con ${CON_CR} CR en ${LINEAS} líneas · verdad por bytes = ${CON_CR}`);
      t.diagnostic(`  n=$(grep -c $'\\r' F)   = ${subA}      (wc -l = ${wcA})`);
      t.diagnostic(`  grep -c $'\\r' F directo = ${dirA}`);
      t.diagnostic(`  len($'\\r') DENTRO de $() = ${lenA}   ← 0 significa PATRÓN VACÍO`);
      t.diagnostic(`fichero LF puro · verdad = 0 · sustitución ${subB} · directo ${dirB}`);

      // SUELO 1: si la sonda no ha medido nada, el resto de este caso no significa nada.
      assert.equal(wcA, LINEAS,
        `🔴 CIEGO: la sonda cuenta ${wcA} líneas donde hay ${LINEAS}. No ha medido el fichero.`);

      const acierta = (subA === CON_CR && dirA === CON_CR && subB === 0 && dirB === 0);
      const v = veredictoDelEntorno({ clase: ENTORNO.clase, acierta });

      // 🔴 EL VEREDICTO SE IMPRIME SIEMPRE, se pase o se falle. Es lo que lo separa de un skip.
      t.diagnostic(v.titular);

      // SUELO 2 · LA CEGUERA, y es un fallo distinto de «no cuadra».
      assert.equal(v.ciego, false,
        '🔴 ' + v.titular + '\n'
        + `  uname -o = ${JSON.stringify(ENTORNO.uname)} · MACHTYPE = ${JSON.stringify(ENTORNO.machtype)}\n`
        + '  Si esta plataforma es legítima, dale su marca en `clasificarEntorno`\n'
        + '  (scripts/censo-cuenta-de-control-con-grep.mjs) y DECIDE qué se espera de ella. Lo que\n'
        + '  no vale es pasar en verde sin saber a quién se está absolviendo.');

      assert.ok(v.ok,
        '🔴 ' + v.titular + '\n'
        + '  ANTES DE TOCAR NADA, vuelve a leer los avisos de scrum480-fin-de-linea.test.mjs y de\n'
        + '  scripts/censo-cr-en-disco.mjs: si el defecto ya no existe en una plataforma, hay que\n'
        + '  decirlo ahí ENCIMA de lo viejo, no borrarlo. Un aviso retirado en silencio vuelve a\n'
        + '  morder.');

      // ── Y LAS DOS CARAS, NOMBRADAS · sólo donde el defecto se reproduce ────────────────────
      // No basta con «falla»: hay que saber POR CUÁL falla, porque el arreglo es distinto (`-U`
      // cura la A y NO cura la B). En la plataforma que acierta no hay caras que nombrar.
      if (ENTORNO.clase === MSYS_WINDOWS) {
        if (dirA !== CON_CR) {
          assert.equal(dirA, 0,
            `🔴 CARA A inesperada: el grep directo dice ${dirA}. Lo medido es 0 (falso negativo: la `
            + 'lectura en modo texto se come el CR antes de casar).');
        }
        if (subA !== CON_CR) {
          assert.equal(subA, wcA,
            `🔴 CARA B inesperada: dentro de $( ) el grep dice ${subA} y wc -l dice ${wcA}. Lo `
            + 'medido es que son IGUALES, porque `$\'\\r\'` llega vacío y un patrón vacío casa con '
            + 'todas las líneas. Si ya no coinciden, el mecanismo no es el que está escrito.');
          assert.equal(lenA, 0,
            `🔴 la cara B se cae pero \`$'\\r'\` mide ${lenA} dentro de la sustitución. El mecanismo `
            + 'escrito en el árbol (patrón vacío) NO es el que está pasando aquí.');
        }
      }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

/**
 * 🔴 LAS DOS RAMAS, EJERCITADAS DESDE CUALQUIER PLATAFORMA.
 *
 * El caso de arriba sólo puede recorrer la rama de la máquina en la que corre. Sin esto, la rama
 * de la OTRA plataforma no la mira nadie hasta que CI la pisa — y un camino que nadie ha
 * ejercitado es un camino que no se sabe si funciona. Aquí se ejercita la decisión PURA con los
 * valores REALES de las dos plataformas (medidos: MSYS el 7-sep-2026, ubuntu-latest en CI).
 */
test('SCRUM-766 · 🔴 la decisión por plataforma se sostiene en LAS DOS, y la ceguera es un tercer estado', () => {
  assert.equal(clasificarEntorno({ uname: 'Msys', machtype: 'x86_64-pc-cygwin' }), MSYS_WINDOWS,
    '🔴 no reconoce esta máquina.');
  assert.equal(clasificarEntorno({ uname: 'GNU/Linux', machtype: 'x86_64-pc-linux-gnu' }), GNU_LINUX,
    '🔴 no reconoce `ubuntu-latest`, que es donde corre CI.');
  for (const raro of [{ uname: 'Plan9', machtype: '???' }, {}, { uname: 'Msys', machtype: 'x86_64-pc-linux-gnu' }]) {
    assert.equal(clasificarEntorno(raro), null,
      `🔴 «${JSON.stringify(raro)}» se ha clasificado como una plataforma conocida. La última es `
      + 'la que importa: dos señales que se contradicen NO son una respuesta, y elegir la que '
      + 'convenga es cómo un guard se apaga solo.');
  }

  // MSYS: reproduce el defecto → verde. Y si dejara de reproducirlo → ROJO, no silencio.
  assert.equal(veredictoDelEntorno({ clase: MSYS_WINDOWS, acierta: false }).ok, true,
    '🔴 en MSYS, reproducir el defecto tiene que ser el caso ESPERADO.');
  assert.equal(veredictoDelEntorno({ clase: MSYS_WINDOWS, acierta: true }).ok, false,
    '🔴 si el defecto DESAPARECIERA de MSYS, esto tiene que ponerse rojo: es donde se trabaja, y '
    + 'lo que hay escrito en el árbol dejaría de ser cierto sin que nadie lo dijera.');

  // GNU/Linux: NO tiene el defecto → verde CON veredicto. Y si lo ganara → ROJO.
  const linux = veredictoDelEntorno({ clase: GNU_LINUX, acierta: true });
  assert.equal(linux.ok, true, '🔴 en GNU/Linux, acertar las dos caras es lo esperado.');
  assert.match(linux.titular, /VEREDICTO DECLARADO/,
    '🔴 la rama que NO reproduce el defecto tiene que decirlo con un veredicto legible. Sin texto '
    + 'esto sería un skip con otro nombre.');
  assert.equal(veredictoDelEntorno({ clase: GNU_LINUX, acierta: false }).ok, false,
    '🔴 si el defecto llegara a la plataforma de CI, esto tiene que ponerse rojo.');

  // Y la CEGUERA es un estado propio, no un «no pasa nada».
  const ciego = veredictoDelEntorno({ clase: null, acierta: true });
  assert.equal(ciego.ciego, true, '🔴 no saber la plataforma tiene que marcarse como ceguera.');
  assert.equal(ciego.ok, false,
    '🔴 CIEGO ha salido en verde. «No sé en qué plataforma estoy» no es «aquí no pasa»: es '
    + 'exactamente el silencio que este ticket existe para impedir.');
});

// ── ③ EL CENSO DEL ÁRBOL, CON SU CONTROL POSITIVO ──────────────────────────────────────────

test('SCRUM-766 · ✅ CONTROL POSITIVO: el detector caza el grep que YA SABEMOS que está mal', () => {
  const cebo = [
    'n=$(grep -c $\'\\r\' "$f")',
    'grep -c $\'\\r\' fichero.txt',
    'grep -c "TODO" fichero.txt',
    'contarCR(buf)',
  ].join('\n');
  const h = hallazgosEn(cebo, '<control>');
  assert.equal(h.length, 2,
    `🔴 el detector encuentra ${h.length} de los 2 idiomas malos del cebo. Un censo que no `
    + 'reconoce el defecto conocido no puede dar un cero sobre el árbol: ese cero no es «limpio», '
    + 'es «no supe mirar».');
  assert.equal(h[0].sustitucion, true, '🔴 no distingue la cara B (dentro de `$( )` → wc -l).');
  assert.equal(h[1].sustitucion, false, '🔴 marca como sustitución lo que no lo es.');
  assert.equal(h[0].clase, 'INSTRUMENTO', '🔴 una línea ejecutable se ha clasificado como texto.');
});

test('SCRUM-766 · el filtro de velocidad NO es más estrecho que el criterio', () => {
  // El censo salta con un filtro barato las líneas que no nombran ninguna herramienta. Si ese
  // filtro se queda por detrás del criterio, el censo deja de ver idiomas malos y devuelve el
  // MISMO cero de un árbol limpio. La primera versión preguntaba por `'rg '` con espacio mientras
  // la expresión pide `\brg\b`: un `rg` seguido de tabulador se saltaba en silencio.
  // Las CINCO formas de patrón de control que reconoce el criterio, no sólo la del CR: el filtro
  // pregunta por marcas distintas para cada una y basta con que se olvide de una.
  const PATRONES = ["$'\\r'", '[[:cntrl:]]', '\\x0d', '\\015', '\\012'];
  for (const herramienta of ['grep', 'egrep', 'fgrep', 'rg', 'findstr']) {
    for (const separador of [' ', '\t', '\t-c ', ' -c ']) {
      for (const patron of PATRONES) {
        const linea = `n=$(${herramienta}${separador}${patron} "$f")`;
        assert.ok(puedeContener(linea),
          `🔴 el filtro previo descarta «${linea}», que el criterio SÍ caza. Un censo con el `
          + 'filtro por detrás del criterio da ceros que no se distinguen de un árbol limpio.');
        assert.equal(hallazgosEn(linea, '<f>').length, 1,
          `🔴 el detector no caza «${linea}» pasando ya el filtro.`);
      }
    }
  }
  // Y que el filtro SIRVE de algo: una línea con herramienta pero sin marca de control se cae.
  assert.equal(puedeContener('grep -rn "TODO" src/'), false,
    '🔴 el filtro no descarta nada, así que no está filtrando: el censo paga la expresión cara '
    + 'en cada línea que nombre una herramienta.');
});

test('SCRUM-766 · el censo VE el árbol antes de decir que está limpio', () => {
  const r = censoDe();
  assert.ok(r.leidos > 500,
    `🔴 CIEGO: sólo se han leído ${r.leidos} ficheros de texto de ${r.poblacion} rastreados.`);
  assert.equal(r.hallazgos.length, r.instrumentos.length + r.recetas.length + r.avisos.length,
    '🔴 el censo NO CUADRA: las tres clases no suman los hallazgos, así que no vale ninguna cifra.');
});

test('SCRUM-766 · 🔴 ningún instrumento ni receta del árbol cuenta control con `grep`', () => {
  const r = censoDe();
  const malos = [...r.instrumentos, ...r.recetas];
  assert.equal(malos.length, 0,
    `🔴 ${malos.length} sitio(s) cuentan caracteres de control con grep en este entorno:\n`
    + malos.map((h) => `   · ${h.fichero}:${h.linea}  ${h.texto}`
      + (h.sustitucion ? '   [EN $( ) → devuelve wc -l]' : '   [directo → devuelve 0]')).join('\n')
    + '\n\n  La forma correcta es node sobre bytes. Está en `contarCR` de\n'
    + '  scripts/censo-cuenta-de-control-con-grep.mjs, y no hace falta escribir otra.');
});

test('SCRUM-766 · el AVISO del defecto sigue en el árbol — la memoria no se retira', () => {
  const r = censoDe();
  assert.ok(r.avisos.length > 0,
    '🔴 no queda en el árbol ni un comentario que documente que `grep` no sirve para contar CR '
    + 'aquí. Este ticket existe porque una sesión perdió el tiempo por no tenerlo escrito, y un '
    + 'aviso retirado en silencio vuelve. Si de verdad sobra, se escribe ENCIMA por qué sobra.');
});

test('SCRUM-766 · la autorreferencia ampara algo real y nada más', () => {
  const sin = censoDe(false).hallazgos.length;
  const con = censoDe(true).hallazgos.length;
  assert.ok(con > sin,
    `🔴 la lista de AUTORREFERENCIA (${AUTORREFERENCIA.length} ficheros) no cambia el número `
    + `(${sin} con y sin ella). O ampara ficheros que ya no contienen el idioma —y entonces es `
    + 'una exclusión que se está quedando vieja en silencio— o el detector no los está leyendo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-745 (adopción) · LAS MUTACIONES DE ESTE GUARD
//
// Las dos rompen cosas distintas y ninguna cubre a la otra: la primera rompe EL INSTRUMENTO (el
// contador de bytes), la segunda rompe EL DETECTOR (lo que censa el árbol). Un guard con el
// instrumento roto publica números falsos; uno con el detector roto publica ceros tranquilos.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // 🔴 LA MUTACIÓN ES EL DEFECTO DEL TICKET, LITERAL: en vez de contar el byte CR (13) cuenta
    // el LF (10), o sea que devuelve EL NÚMERO DE LÍNEAS. Sobre el control fabricado pasa de 3 a
    // 50 — un número mayor, con la forma correcta, del mismo orden de magnitud. Exactamente lo
    // que hace el grep de este entorno, y exactamente por lo que no se nota sobre un árbol.
    fichero: 'scripts/censo-cuenta-de-control-con-grep.mjs',
    de: '  for (const b of buf) if (b === CR) n += 1;',
    a: '  for (const b of buf) if (b === 10) n += 1;',
    cae: 'SCRUM-766 · 🔴 EL QUE DECIDE: 3 CR en 50 líneas — el contador por BYTES dice 3',
  },
  {
    // El detector deja de reconocer `$'\r'` como patrón de control. El censo del árbol seguiría
    // dando cero —el mismo cero de hoy, indistinguible— y sin el control positivo ese cero se
    // leería como «el árbol está limpio» en vez de como «no supe mirar».
    fichero: 'scripts/censo-cuenta-de-control-con-grep.mjs',
    de: "const CONTROL = String.raw`\\$'\\\\[rnt0]'|\\[\\[:cntrl:\\]\\]|\\\\x0[dD]|\\\\015|\\\\0?12\\b`;",
    a: 'const CONTROL = String.raw`\\[\\[:cntrl:\\]\\]`;',
    cae: 'SCRUM-766 · ✅ CONTROL POSITIVO: el detector caza el grep que YA SABEMOS que está mal',
  },
];
