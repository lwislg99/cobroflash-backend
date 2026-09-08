// scripts/_trinquete-de-zona.mjs — SCRUM-813 · EL TRINQUETE DE ZONA HORARIA.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE, CON LAS FECHAS DELANTE
//
// SCRUM-640 arregló cinco tests que medían la zona horaria de la MÁQUINA en vez del producto, y
// censó el árbol entero para demostrar que no quedaban más. Se mezcló en `main` el **2-sep-2026**
// (PR #889). El **4-sep-2026** —dos días después— SCRUM-592 (`271e461f`) metió **tres nuevos**:
//
//   · `allocateQuoteNumber: toma el cerrojo ANTES de leer, y avanza la serie`  (quoteNumber)
//   · `SCRUM-592 · una mezcla de renumerados y sin renumerar no se pisa`       (scrum592-doc02)
//   · `SCRUM-592 · el display se DERIVA: …`                                    (scrum592-doc02)
//
// El defecto NO sobrevivió a 640: **volvió a entrar**. Y volvió a entrar porque aquel censo fue
// una medición de una vez — alguien la tecleó, salió un número, y el número se quedó en un
// documento. **Una medición de una vez no impide nada.** Es la diferencia entre *vigilar* y
// *hacer imposible*, y esta casa ya tiene escrito cuál de las dos vale.
//
// Esto es la otra: un instrumento que corre solo, en cada PR, y que **HABLA** cuando la familia
// crece. No arregla nada y no decide nada: cuenta y se pone en rojo.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LO QUE MIDE, Y POR QUÉ NO ES UN DETECTOR DE FORMAS
//
// La tentación es buscar la FORMA del defecto: `new Date('YYYY-MM-DD')`, `getFullYear()`,
// `toLocaleDateString` sin `timeZone`. Eso es una lista negra, y tiene el defecto de todas: sólo
// sabe decir que no a lo que le enseñaron, y **denuncia a los inocentes**. En este árbol hay
// cientos de tests que construyen fechas y son correctos porque fijan su zona o porque su borde
// no cae cerca de medianoche. Un detector así marcaría el árbol entero, y un guard que grita
// siempre se apaga — que es la forma más segura de no tener guard.
//
// Se mide **por DIFERENCIAL**, que es la propiedad misma y no un indicio de ella:
//
//     se corre la tanda ENTERA en dos zonas extremas y se anota
//     QUÉ PRUEBAS CAMBIAN DE VEREDICTO entre una y otra.
//
// Un test que fija su zona da el mismo veredicto en las dos y **no aparece**: el control positivo
// del encargo se cumple por construcción, no por una lista de excepciones. Y un test que depende
// de la máquina aparece **aunque su forma sea nueva**, porque lo que se mira es el resultado.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL TRINQUETE LLEVA SU PROPIO CONTROL POSITIVO, Y CORRE SIEMPRE
//
// Un censo que devuelve «0 hallazgos» sin haber demostrado que sabe ver alguno no es una medida:
// es un silencio. Y este censo tiene un futuro garantizado en el que el árbol se queda sin
// dependientes de zona (el día que SCRUM-643 §2·A se decida y los tres se arreglen) — justo el día
// en que su cero dejaría de significar nada.
//
// Por eso cada pasada mide, POR EL MISMO CAMINO Y EN LAS MISMAS ZONAS, cuatro canarios que este
// fichero fabrica (`CANARIOS`, abajo):
//
//   · dos DEPENDIENTES  — uno que sólo cae con desfase NEGATIVO y otro que sólo cae con desfase
//                         POSITIVO. Tienen que salir denunciados los dos.
//   · dos FIJADOS       — la misma pregunta con la zona escrita a mano, y uno sin fechas.
//                         NO pueden salir denunciados ninguno.
//
// Si el instrumento no caza a los dependientes, o denuncia a los fijados, **se declara CIEGO y no
// emite veredicto sobre el árbol**. Eso además valida LA ELECCIÓN DE ZONAS: con dos zonas del
// mismo signo, el canario del otro signo no cambia de veredicto y el trinquete lo dice en vez de
// dar un verde que no ha ganado.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LOS TRES CENSADOS NO SE ARREGLAN, Y ESO ES EL TICKET — NO UN PENDIENTE
//
// Los tres rojos de arriba tienen DOS defectos detrás, y están separados:
//
//   ¿MIENTE EL TEST?      SÍ. El fixture es `new Date('2027-01-01')` —medianoche **UTC**— leído
//                         con componentes **locales** (`getFullYear`).
//   ¿ESTÁ MAL EL PRODUCTO? SÍ, y ya está medido y PARADO en `docs/master/SCRUM-643.md` §2·A: el año
//                         de la serie sale de `now.getFullYear()`: `allocateQuoteNumber` y
//                         `displayQuoteNumber` (quoteNumber.service.ts), `allocateAlbaranNumber`
//                         (albaranNumber.service.ts) y `allocateInvoiceNumber`
//                         (invoiceNumber.service.ts). Se citan por IDENTIDAD y no por número de
//                         línea a propósito (SCRUM-710b): una línea es una posición y caduca.
//                         Ventana: 1-ene, 00:00–01:00 hora peninsular; el documento sale con el
//                         número de la serie del AÑO ANTERIOR. En `invoice` eso es numeración
//                         fiscal (regla 29).
//
// Fijarles la zona los pondría verdes en cuatro líneas **y apagaría la única evidencia automática
// que hoy tiene ese defecto sin decidir**. Así que aquí se CENSAN, no se arreglan: entran en
// `CENSADAS` con su motivo, el trinquete los espera, y el día que SCRUM-643 §2·A se decida y se
// arreglen, este fichero exige que se borren de la lista A MANO — con la decisión escrita al lado.
//
// Por eso una CENSADA que deja de cambiar de veredicto **también pone el trinquete en rojo**
// (`SALIDA_APAGADA`). Un trinquete que sólo mira hacia arriba deja pasar en silencio el peor
// movimiento de los dos: apagar la alarma antes de que el fundador haya decidido.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';   // SCRUM-730: `pathname` no decodifica el espacio

const AQUI = fileURLToPath(import.meta.url);
export const RAIZ = path.resolve(path.dirname(AQUI), '..');
const HIJO = path.join(path.dirname(AQUI), '_trinquete-de-zona-hijo.mjs');

/**
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * LAS ZONAS, Y POR QUÉ ESTAS DOS.
 *
 * Los dos extremos habitados del planeta: +14 y −11. Veinticinco horas de separación, así que
 * CUALQUIER instante cae en días distintos en las dos, y cualquier defecto de la familia («leo
 * componentes locales de un instante fijado en UTC») tiene su borde dentro del intervalo.
 *
 * ⚠️ UTC NO ESTÁ AQUÍ A PROPÓSITO, y conviene decir por qué no es un descuido: UTC es donde corre
 * el runner de CI y donde corre Railway, así que la tanda normal ya lo mide en cada PR — y tiene
 * que salir en verde para que ese PR pase. Meterlo aquí sería pagar una tercera pasada completa
 * para volver a medir lo que el job de al lado ya exige. Se puede añadir con `--zonas` cuando
 * alguien quiera la tabla de tres.
 *
 * 🔴 LA ELECCIÓN NO SE CREE: SE COMPRUEBA. Los dos canarios dependientes —uno por signo de
 * desfase— sólo cambian de veredicto si el juego de zonas cubre los dos lados. Cambiar esta
 * constante por dos zonas del mismo signo NO da un verde cómodo: da CIEGO.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export const ZONAS = ['Pacific/Kiritimati', 'Pacific/Midway'];

/** Los tres estados que puede tener una prueba en una zona. `ausente` es el cuarto y se deriva. */
export const AUSENTE = 'ausente';

export const SALIDA_OK = 0;
/** Alguien metió un test que depende de la zona y no está censado. EL TRINQUETE HABLA. */
export const SALIDA_HABLA = 1;
/** No se ha podido medir: la sonda, los controles o la tanda. NO se emite veredicto del árbol. */
export const SALIDA_CIEGO = 2;
/** Una CENSADA dejó de cambiar de veredicto: la alarma se apagó sin que nadie lo decidiera. */
export const SALIDA_APAGADA = 3;

/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LA LÍNEA BASE · las pruebas que HOY dependen de la zona de la máquina, con su motivo.
 *
 * NO ES UNA LISTA DE EXCEPCIONES NI UN SILENCIADOR. Es la memoria del trinquete: lo que se midió
 * el 7-sep-2026 y se decidió NO tocar. Está en código y no en un JSON a propósito — así una
 * entrada nueva o una borrada **aparece en el diff del PR** y alguien tiene que escribir por qué.
 *
 * ⛔ AÑADIR AQUÍ UN TEST NUEVO PARA QUE EL TRINQUETE SE CALLE ES EL ABUSO QUE ESTO PERMITE, y no
 * hay mecanismo que lo impida: es una línea de código y quien la escriba puede escribirla. Lo
 * único que hay es que **queda firmada en el historial**, con su motivo al lado y con la revisión
 * del PR delante. Queda dicho aquí para que nadie lea esta lista como «tests aprobados».
 *
 * `clave` es `<ruta relativa con />::<nombre exacto de la prueba>`.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
export const CENSADAS = [
  {
    clave: 'tests/quoteNumber.test.mjs::allocateQuoteNumber: toma el cerrojo ANTES de leer, y avanza la serie',
    nacio: 'SCRUM-592 · 271e461f · 4-sep-2026',
    porque: 'El fixture `new Date(\'2027-01-01\')` es medianoche UTC y `allocateQuoteNumber` lee el '
      + 'año con `now.getFullYear()` (LOCAL). Con desfase negativo el instante es 31-dic-2026, la '
      + 'serie no reinicia y sale `{ numero: P260003, seq: 3, year: 2026 }` donde el test espera '
      + '`{ numero: P270001, seq: 1, year: 2027 }`. Medido el 7-sep-2026.',
    parado_en: 'docs/master/SCRUM-643.md §2·A — el año de la serie sale del reloj de la máquina '
      + '(`allocateQuoteNumber` y `displayQuoteNumber`, en quoteNumber.service.ts). Numeración '
      + 'fiscal: se decide, no se parchea.',
  },
  {
    clave: 'tests/scrum592-numeracion-doc02.test.mjs::SCRUM-592 · una mezcla de renumerados y sin renumerar no se pisa',
    nacio: 'SCRUM-592 · 271e461f · 4-sep-2026',
    porque: 'Los dos documentos del fixture van a `…T00:00:00Z` y `planDeRenumeracion` '
      + '(scripts/_renumerar-documentos.mjs) agrupa por `new Date(createdAt).getFullYear()`, que es '
      + 'LOCAL. Con desfase negativo el primero cae en 2025 y el segundo en 2026, así que el '
      + 'segundo coge el 1 de una serie vacía: sale `[[2, P260001]]` donde el test espera '
      + '`[[2, P260002]]` — o sea, el duplicado que esa prueba existe para impedir. '
      + 'Medido el 7-sep-2026.',
    parado_en: 'docs/master/SCRUM-643.md §2·A — misma familia: el año se deriva del reloj del proceso.',
  },
  {
    clave: 'tests/scrum592-numeracion-doc02.test.mjs::SCRUM-592 · el display se DERIVA: no hay columna de texto que pueda discrepar',
    nacio: 'SCRUM-592 · 271e461f · 4-sep-2026',
    porque: '`displayQuoteNumber({ quoteNumber: 3, createdAt: \'2027-01-01T00:00:00Z\' })` formatea '
      + 'con `d.getFullYear()` (LOCAL, en quoteNumber.service.ts). Con desfase negativo sale '
      + '`P260003` donde el test espera `P270003`. Medido el 7-sep-2026.',
    parado_en: 'docs/master/SCRUM-643.md §2·A — el año del documento sale del reloj de quien lo pinta.',
  },
];

/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * LOS CANARIOS · el control positivo Y el negativo, fabricados en cada pasada.
 *
 * Viven aquí como TEXTO y se escriben a un directorio temporal FUERA del árbol. No están en
 * `tests/` por dos motivos, los dos medidos:
 *
 *   ① los dos dependientes son ROJOS a propósito en media Tierra: dentro de `tests/` serían una
 *     mina para cualquiera que corra la tanda en un portátil con otra zona;
 *   ② y el censo del árbol los contaría como dependientes de zona, que lo son — el instrumento
 *     saldría midiéndose a sí mismo.
 *
 * Cada uno afirma algo que es VERDAD en la zona que dice su nombre, para que el rojo, cuando
 * salga, se explique solo.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
export const CANARIOS = [
  {
    fichero: 'canario-dependiente-oeste.test.mjs',
    clase: 'dependiente',
    porque: 'Cae SÓLO con desfase NEGATIVO: medianoche UTC leída con componentes locales retrocede '
      + 'de año. Es, literalmente, el defecto de los tres censados.',
    codigo: `import test from 'node:test';
import assert from 'node:assert/strict';

// CANARIO · SCRUM-813. No es un test del producto: es el CONTROL POSITIVO del trinquete de zona.
// \`new Date('2027-01-01')\` es medianoche UTC; \`getFullYear()\` lee componentes LOCALES.
// Verdad con desfase >= 0 (UTC, Madrid, Tokio, Kiritimati) · MENTIRA con desfase < 0 (América).
test('canario OESTE · medianoche UTC leída en local no retrocede de año', () => {
  assert.equal(new Date('2027-01-01').getFullYear(), 2027);
});
`,
  },
  {
    fichero: 'canario-dependiente-este.test.mjs',
    clase: 'dependiente',
    porque: 'Cae SÓLO con desfase POSITIVO grande. Sin él, un juego de zonas todo al oeste daría '
      + 'un verde que no ha ganado.',
    codigo: `import test from 'node:test';
import assert from 'node:assert/strict';

// CANARIO · SCRUM-813. El mismo defecto por el otro lado: las 20:00Z del 31 de diciembre ya son
// del año siguiente en +14. Verdad con desfase < +4 · MENTIRA en Kiritimati (+14).
test('canario ESTE · las 20:00Z del 31-dic leídas en local siguen siendo del mismo año', () => {
  assert.equal(new Date('2026-12-31T20:00:00Z').getFullYear(), 2026);
});
`,
  },
  {
    fichero: 'canario-fijado.test.mjs',
    clase: 'fijado',
    porque: 'La MISMA pregunta con la zona escrita a mano. Es el CONTROL NEGATIVO: si el trinquete '
      + 'denuncia a éste, está denunciando a todos los tests bien escritos del árbol y se apagará '
      + 'por ruido en una semana.',
    codigo: `import test from 'node:test';
import assert from 'node:assert/strict';

// CANARIO · SCRUM-813. La misma pregunta que \`canario-dependiente-oeste\`, hecha BIEN: la zona se
// fija y no se hereda. Tiene que dar el mismo veredicto en las dos zonas y NO ser denunciado.
const anioEn = (iso, timeZone) =>
  Number(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric' }).format(new Date(iso)));

test('canario FIJADO · con la zona escrita a mano, el veredicto no depende de la máquina', () => {
  assert.equal(anioEn('2027-01-01', 'UTC'), 2027);
  assert.equal(anioEn('2026-12-31T20:00:00Z', 'Europe/Madrid'), 2026);
});
`,
  },
  {
    fichero: 'canario-sin-fechas.test.mjs',
    clase: 'fijado',
    porque: 'Un test que no habla de tiempo. Control negativo del caso más común del árbol.',
    codigo: `import test from 'node:test';
import assert from 'node:assert/strict';

// CANARIO · SCRUM-813. Aquí no hay fechas. Si el trinquete lo denuncia, no está midiendo zonas.
test('canario SIN FECHAS · dos y dos siguen siendo cuatro en las dos zonas', () => {
  assert.equal(2 + 2, 4);
});
`,
  },
];

/**
 * La ruta de un fichero tal y como la escribe la clave: relativa a la raíz y **siempre con `/`**.
 *
 * El separador importa: el CI corre en ubuntu y esta casa desarrolla en Windows. Una clave con `\`
 * no casaría con la misma clave con `/`, y la línea base entera saldría «apagada» al cruzar de
 * sistema — un rojo enorme por una barra.
 */
export function rutaRelativa(fichero, raiz = RAIZ) {
  const rel = path.isAbsolute(fichero) ? path.relative(raiz, fichero) : fichero;
  return rel.split(path.sep).join('/');
}

/** La clave estable de una prueba: ruta relativa **con `/`** y nombre exacto. */
export function claveDe(fichero, nombre, raiz = RAIZ) {
  return `${rutaRelativa(fichero, raiz)}::${nombre}`;
}

/**
 * 🔴 LA SONDA. `TZ` sólo llega por el ENTORNO DE UN PROCESO HIJO: el prefijo `TZ=x node` de Git
 * Bash **no funciona** en esta máquina (medido en SCRUM-640, y por eso está escrito aquí). Si la
 * zona no llega, todas las pasadas medirían LA MISMA zona y el censo devolvería un cero perfecto
 * que no significa nada. Se comprueba ANTES de medir, y sin ella no se mide.
 */
export function sondaDeZona(zona) {
  const r = spawnSync(process.execPath,
    ['-e', 'process.stdout.write(Intl.DateTimeFormat().resolvedOptions().timeZone)'],
    { env: entornoLimpio(zona), encoding: 'utf8' });
  const vista = (r.stdout || '').trim();
  return { zona, vista, ok: r.status === 0 && vista === zona };
}

/** Los ficheros de la tanda, tal y como los expande `npm test`. */
export function ficherosDeLaTanda(raiz = RAIZ) {
  const dir = path.join(raiz, 'tests');
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.test.mjs'))
    .sort()
    .map((f) => path.join(dir, f));
}

/**
 * Escribe los canarios a un directorio propio y devuelve, con cada uno, su ruta absoluta y la
 * `rutaClave` con la que va a aparecer en el censo — que es por la que se les reconoce, y no por
 * el nombre del fichero: viven fuera del árbol, así que su ruta relativa empieza por `../` y
 * ningún fichero de `tests/` puede coincidir con ella ni llamándose igual.
 */
export function escribirCanarios(
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trinquete-zona-')), raiz = RAIZ,
) {
  fs.mkdirSync(dir, { recursive: true });
  return CANARIOS.map((c) => {
    const destino = path.join(dir, c.fichero);
    fs.writeFileSync(destino, c.codigo);
    return { ...c, ruta: destino, rutaClave: rutaRelativa(destino, raiz) };
  });
}

/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 EL ENTORNO DEL HIJO SE LIMPIA, Y LAS DOS VARIABLES TIENEN SU AVERÍA MEDIDA.
 *
 * `NODE_TEST_CONTEXT` — MEDIDO el 7-sep-2026, provocando el caso: un proceso lanzado desde dentro
 * de `node --test` **hereda `NODE_TEST_CONTEXT=child-v8`**, y con esa variable puesta el `run()`
 * del nieto devuelve **CERO eventos**. O sea: la red que corre en cada tanda
 * (`tests/scrum813-trinquete-de-zona.test.mjs`) medía cero canarios y su cero se leía como «el
 * trinquete no ve». El síntoma era exactamente el de un instrumento roto, y la causa era una
 * variable heredada. Se borra.
 *
 * `NODE_OPTIONS` — el CI le mete a la tanda `--test-reporter=…=<fichero>` (SCRUM-552). Un hijo
 * que la hereda escribe SU informe encima del de la tanda. Se borra por la misma razón por la que
 * el hijo entrega su medida en un fichero propio: nada de este instrumento puede pisar al de al
 * lado.
 *
 * ⚠️ Lo que NO se toca es el resto del entorno: `LIBRO_PG_URL`, `QA_DB_TEST` y sus hermanas
 * tienen que llegar tal cual, o los tests que dependen de ellas se saltarían **en las dos zonas**
 * y el trinquete saldría verde sin haberlas mirado.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
export function entornoLimpio(zona, base = process.env) {
  const env = { ...base, TZ: zona };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  return env;
}

/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * LA MARCA DEL ÁRBOL · el diferencial sólo vale si el árbol NO SE MUEVE entre las dos pasadas.
 *
 * No es una precaución teórica: pasó mientras se construía este instrumento. Se lanzó la pasada,
 * se siguió editando `scripts/` y `package.json` mientras corría, y los guards que LEEN el árbol
 * —hay decenas— vieron un fichero en la primera zona y otro distinto en la segunda. Eso es un
 * «cambia de veredicto» que no tiene nada que ver con la zona: **es un hallazgo falso**, y un
 * hallazgo falso es lo que apaga un guard.
 *
 * Se toma una marca antes y otra después. Si difieren, CIEGO: no se opina del árbol.
 *
 * 🔴 POR GIT Y NO POR `mtime`. La huella por fecha de modificación (SCRUM-182) no sirve aquí y
 * está medido por qué: el 7-sep-2026 `npm run censo:escritores-arbol` contaba **12 ficheros de
 * `tests/` y `scripts/` que escriben dentro del árbol** durante la tanda (fixture que crean y
 * borran). El número es de ese día; lo que no caduca es que sean varios.
 * Con `mtime` esto saldría CIEGO en cada pasada — que es la otra forma de no tener instrumento.
 * `git diff HEAD` mira CONTENIDO: un fichero creado y borrado no deja rastro.
 *
 * ⚠️ LÍMITES DECLARADOS, los dos:
 *   · el CONTENIDO de un fichero sin seguimiento (`??`) no entra en la marca — su aparición y su
 *     desaparición sí, porque salen en `status`;
 *   · un cambio revertido a los mismos bytes antes de la segunda marca no se ve. Es el mismo
 *     límite que tiene `git status`, y no se disimula.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
export function marcaDelArbol(raiz = RAIZ) {
  const git = (args) => spawnSync('git', args, {
    cwd: raiz, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  });
  const head = git(['rev-parse', 'HEAD']);
  const estado = git(['status', '--porcelain']);
  const diff = git(['diff', 'HEAD']);
  if (head.status !== 0 || estado.status !== 0 || diff.status !== 0) {
    // 🔴 Y AQUÍ NO SE DECLARA CIEGO, a propósito. Esta marca protege contra un hallazgo FALSO;
    // no forma parte de la medida. Si no hay git, lo honesto es medir y DECIRLO —un CIEGO por
    // falta de git sería un falso ciego, y un instrumento que no arranca fuera de un checkout
    // no lo usa nadie.
    return { ok: false, porque: (head.stderr || estado.stderr || diff.stderr || 'git no respondió').trim().slice(0, 200) };
  }
  return {
    ok: true,
    head: head.stdout.trim(),
    huella: createHash('sha256')
      .update(head.stdout).update(estado.stdout).update(diff.stdout)
      .digest('hex'),
    // 🔴 SCRUM-813b · Y EL DETALLE POR RUTA, QUE ANTES SE TIRABA. Ver `huellaPorRuta`.
    porRuta: huellaPorRuta(estado.stdout, diff.stdout),
  };
}

/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SCRUM-813b · QUÉ RUTA SE MOVIÓ — porque «se movió el árbol» no es accionable.
 *
 * EL DEFECTO QUE CIERRA: el instrumento medía las dos pasadas enteras, los cuatro canarios y las
 * tres censadas… y entonces resumía el árbol a UN hash y tiraba el resto. Cuando ese hash
 * cambiaba, lo único que sabía decir era «el contenido del árbol de trabajo cambió durante la
 * medición»: ni qué fichero, ni de qué a qué. Con eso, quien recibe el CIEGO **no puede
 * distinguir** «la tanda escribió algo» de «alguien editó un fichero mientras corría» — dos
 * causas con arreglos opuestos. Y ante esa duda, la salida cómoda es relajar la puerta.
 *
 * ⛔ ESTO NO RELAJA NADA, Y ES LO PRIMERO QUE HAY QUE LEER. Cualquier ruta que se mueva sigue
 * siendo CIEGO: no hay lista blanca, no hay excepciones, no hay zona franca. Lo único que cambia
 * es que el CIEGO **dice el nombre**.
 *
 * CÓMO, y hacen falta las DOS fuentes:
 *   · `git status --porcelain` ve la APARICIÓN y la DESAPARICIÓN de un fichero (y los que no
 *     tienen seguimiento, que sólo salen ahí);
 *   · `git diff HEAD`, troceado por fichero, ve el CONTENIDO — porque un fichero rastreado que se
 *     mute y se restaure con otros bytes deja el código de estado IGUAL y el diff distinto.
 *
 * Medido en esta sesión: mirar sólo el código de estado da «0 rutas» sobre un árbol que podría
 * haberse movido por contenido. Ese hueco es la razón de que se crucen las dos.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
export function huellaPorRuta(estadoPorcelain, diffHead) {
  const porRuta = new Map();
  for (const linea of String(estadoPorcelain).split('\n')) {
    if (!linea.trim()) continue;
    // `XY ruta` — y en los renombrados, `XY origen -> destino`: se queda el DESTINO, que es donde
    // el fichero está ahora.
    const ruta = linea.slice(3).trim().split(' -> ').pop();
    porRuta.set(ruta, 'estado:' + linea.slice(0, 2));
  }
  // El diff se trocea por su cabecera, para que el contenido viaje CON SU RUTA. Con un hash común
  // para todo el diff, dos ficheros que cambian a la vez dan una sola señal indivisible — que es
  // exactamente lo que este ticket viene a deshacer.
  const trozos = String(diffHead).split(/^diff --git /m).slice(1);
  for (const t of trozos) {
    const cabecera = t.split('\n', 1)[0];
    const casa = /b\/(.+)$/.exec(cabecera);
    const ruta = casa ? casa[1].trim() : '(cabecera de diff ilegible: ' + cabecera.slice(0, 60) + ')';
    const previo = porRuta.get(ruta) || '';
    porRuta.set(ruta, previo + '|diff:' + createHash('sha256').update(t).digest('hex').slice(0, 16));
  }
  return porRuta;
}

/**
 * ¿Qué se movió entre las dos marcas? Lista vacía = el árbol estuvo quieto.
 *
 * 🔴 SCRUM-813b · devuelve ADEMÁS `rutas`: qué ficheros se movieron, con su antes y su después.
 * La puerta es la misma —una sola ruta movida ya es CIEGO— pero el motivo deja de ser una frase
 * genérica y pasa a ser una lista de nombres, que es lo que permite arreglarlo en vez de
 * discutirlo.
 */
export function arbolQuieto(antes, despues) {
  if (!antes?.ok || !despues?.ok) return { medible: false, cambios: [], rutas: [] };
  const cambios = [];
  if (antes.head !== despues.head) {
    cambios.push(`HEAD: ${antes.head.slice(0, 12)} → ${despues.head.slice(0, 12)}`);
    return { medible: true, cambios, rutas: [] };
  }

  const rutas = [];
  if (antes.porRuta && despues.porRuta) {
    const todas = new Set([...antes.porRuta.keys(), ...despues.porRuta.keys()]);
    for (const r of [...todas].sort()) {
      const a = antes.porRuta.get(r);
      const b = despues.porRuta.get(r);
      if (a !== b) rutas.push({ ruta: r, antes: a ?? '(no aparecía)', despues: b ?? '(dejó de aparecer)' });
    }
    for (const x of rutas) cambios.push(`${x.ruta}   ${x.antes} → ${x.despues}`);
  }

  // 🔴 EL SUELO DEL DETALLE, y sin él este refinamiento SERÍA un agujero: si la huella GLOBAL dice
  // que algo cambió y el detalle por ruta no encuentra NADA, lo honesto no es dar el árbol por
  // quieto —eso convertiría un detector ciego en un verde— sino declarar que se movió y que no se
  // supo dónde. La puerta se queda cerrada precisamente cuando el instrumento no sabe.
  if (!rutas.length && antes.huella !== despues.huella) {
    cambios.push('el contenido del árbol de trabajo cambió durante la medición, y el detalle por '
      + 'ruta NO supo decir dónde — se trata como movimiento, nunca como quietud');
  }
  return { medible: true, cambios, rutas };
}

/**
 * UNA pasada de la tanda con la zona `zona`.
 *
 * ⚠️ EL HIJO ESCRIBE A UN FICHERO, no a stdout, y no es manía: por stdout viaja lo que impriman
 * los tests, y una sola línea suelta de un `console.log` ajeno convertiría el JSON en basura. Un
 * fichero no se puede contaminar desde dentro de otro proceso.
 */
export function medirEnZona({ zona, ficheros, raiz = RAIZ, salida }) {
  const destino = salida
    || path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'trinquete-zona-med-')), 'medida.json');
  const lista = path.join(path.dirname(destino), 'ficheros.json');
  fs.writeFileSync(lista, JSON.stringify(ficheros));

  // 🔴 SE BORRA LA MEDIDA ANTERIOR ANTES DE MEDIR. Si el hijo muere sin escribir y el fichero de
  // una pasada anterior sigue ahí, esto leería la medida VIEJA y la daría por buena — un resultado
  // caducado presentado como fresco, que es la avería de SCRUM-159 en pequeño.
  try { fs.rmSync(destino, { force: true }); } catch { /* si no se puede borrar, se verá abajo */ }

  const arranque = Date.now();
  const r = spawnSync(process.execPath, [HIJO, lista, destino, raiz], {
    cwd: raiz,
    env: entornoLimpio(zona),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  let bruto = null;
  try { bruto = JSON.parse(fs.readFileSync(destino, 'utf8')); } catch { /* se decide abajo */ }

  if (!bruto) {
    return {
      zona,
      ok: false,
      porque: `el hijo no dejó medida legible (status ${r.status}${r.signal ? `, señal ${r.signal}` : ''})`
        + `${(r.stderr || '').trim() ? ` · ${(r.stderr || '').trim().slice(0, 300)}` : ''}`,
      veredictos: new Map(),
      segundos: (Date.now() - arranque) / 1000,
    };
  }

  // 🔴 Y LA MEDIDA DICE EN QUÉ ZONA SE TOMÓ. La sonda comprueba que `TZ` llega ANTES de medir;
  // esto comprueba que llegó A ESTA pasada. Sin ello, dos pasadas que hubieran corrido en la misma
  // zona darían un diferencial vacío —cero cambios— indistinguible de un árbol sano.
  if (bruto.zonaVista !== zona) {
    return {
      zona,
      ok: false,
      porque: `se pidió \`${zona}\` y el hijo corrió en \`${bruto.zonaVista}\`: las dos pasadas `
        + 'medirían la misma zona y el diferencial saldría vacío',
      veredictos: new Map(),
      segundos: (Date.now() - arranque) / 1000,
    };
  }

  const veredictos = new Map();
  for (const [clave, v] of bruto.veredictos) veredictos.set(clave, v);
  return {
    zona,
    ok: true,
    veredictos,
    zonaVista: bruto.zonaVista,
    concurrencia: bruto.concurrencia,
    ficheros: ficheros.length,
    segundos: (Date.now() - arranque) / 1000,
  };
}

/**
 * QUÉ PRUEBAS CAMBIAN DE VEREDICTO entre las medidas.
 *
 * ⚠️ LÍMITE DECLARADO: la clave es fichero + nombre de la prueba. Dos pruebas del MISMO fichero
 * con el MISMO nombre comparten clave, y el hijo las agrega quedándose con el peor veredicto
 * (`fail` > `skip` > `pass`). Si una de las dos cambiara y la otra no, aquí se vería una sola
 * entrada. No se ha visto ningún caso así en el árbol, y se dice porque no se ha comprobado que
 * no pueda haberlo.
 */
export function cambianDeVeredicto(medidas) {
  const claves = new Set();
  for (const m of medidas) for (const k of m.veredictos.keys()) claves.add(k);

  const out = [];
  for (const clave of [...claves].sort()) {
    const porZona = medidas.map((m) => ({
      zona: m.zona, veredicto: m.veredictos.get(clave) ?? AUSENTE,
    }));
    const distintos = new Set(porZona.map((p) => p.veredicto));
    if (distintos.size > 1) {
      const [fichero, ...resto] = clave.split('::');
      out.push({ clave, fichero, prueba: resto.join('::'), porZona });
    }
  }
  return out;
}

/**
 * ¿Los canarios se han comportado? Si no, el instrumento está CIEGO y no opina del árbol.
 *
 * Los dos sentidos, y los dos importan:
 *   · un DEPENDIENTE que no sale denunciado ⇒ el trinquete no ve el defecto que existe para ver.
 *   · un FIJADO que sale denunciado ⇒ denuncia a los inocentes, y así se apaga solo por ruido.
 */
export function juzgarCanarios(cambian, canarios) {
  const denunciadas = new Set(cambian.map((c) => c.fichero));
  const fallos = [];
  for (const c of canarios) {
    const visto = denunciadas.has(c.rutaClave);
    if (c.clase === 'dependiente' && !visto) {
      fallos.push(`el canario DEPENDIENTE \`${c.fichero}\` NO salió denunciado: el trinquete no ve `
        + 'el defecto que existe para ver. Si has cambiado `ZONAS`, comprueba que cubren los DOS '
        + 'signos de desfase.');
    }
    if (c.clase === 'fijado' && visto) {
      fallos.push(`el canario FIJADO \`${c.fichero}\` SALIÓ denunciado: el instrumento está `
        + 'marcando tests bien escritos, y así se apaga solo por ruido.');
    }
  }
  return { ok: fallos.length === 0, fallos };
}

/**
 * EL VEREDICTO. Recibe lo ya medido y no mide nada: así se puede probar entero sin correr la
 * tanda, que es lo que hace `tests/scrum813-trinquete-de-zona.test.mjs`.
 */
export function veredicto({ cambianEnElArbol, censadas = CENSADAS, medidas = [], controles, quieto }) {
  const problemas = [];

  // ── CIEGO ────────────────────────────────────────────────────────────────────────────────
  for (const m of medidas) {
    if (!m.ok) problemas.push(`la pasada en \`${m.zona}\` no midió: ${m.porque}`);
    else if (m.veredictos.size === 0) problemas.push(`la pasada en \`${m.zona}\` no vio NI UNA prueba`);
  }
  if (medidas.length && medidas.length < 2) {
    problemas.push('con una sola zona no hay diferencial que medir');
  }
  if (controles && !controles.ok) problemas.push(...controles.fallos);
  for (const c of (quieto?.cambios || [])) {
    problemas.push(`EL ÁRBOL SE MOVIÓ DURANTE LA MEDICIÓN — ${c}. Las dos pasadas no leyeron el `
      + 'mismo árbol, así que lo que cambió de veredicto puede haber cambiado por eso y no por la '
      + 'zona. Repítelo con el árbol quieto.');
  }
  if (problemas.length) {
    return { estado: 'CIEGO', salida: SALIDA_CIEGO, motivos: problemas, nuevas: [], apagadas: [] };
  }

  const porClave = new Map(censadas.map((c) => [c.clave, c]));
  const vistas = new Set(cambianEnElArbol.map((c) => c.clave));

  const nuevas = cambianEnElArbol.filter((c) => !porClave.has(c.clave));
  const apagadas = censadas.filter((c) => !vistas.has(c.clave));

  // 🔴 EL SUELO · un cero sobre una lista base que espera hallazgos NO es un cero.
  //
  // El 7-sep-2026 hay TRES medidos. Si el barrido devuelve **cero** teniendo censadas, lo que ha
  // pasado casi seguro no es que el árbol se haya curado de golpe: es que la medición no llegó a
  // hacerse —una zona que no cambió, media tanda que murió al cargar, un juego de ficheros vacío—.
  // Y eso no es «se apagó la alarma»: es **no he medido**. Se declara CIEGO, que es lo que es.
  //
  // La diferencia con `APAGADA` importa y por eso son dos estados: si desaparecen ALGUNAS pero
  // quedan otras, el instrumento SÍ midió y lo que hay que mirar es qué se arregló. Si no queda
  // ninguna, lo primero que hay que mirar es el instrumento.
  const cieloRaso = cambianEnElArbol.length === 0 && censadas.length > 0;

  if (nuevas.length) {
    return {
      estado: 'HABLA', salida: SALIDA_HABLA, nuevas, apagadas, cieloRaso,
      motivos: nuevas.map((n) => `NUEVA · ${n.clave}`),
    };
  }
  if (cieloRaso) {
    return {
      estado: 'CIEGO', salida: SALIDA_CIEGO, nuevas, apagadas, cieloRaso,
      motivos: [`CERO pruebas cambian de veredicto y hay ${censadas.length} censadas que deberían `
        + 'estar cambiando. Antes de creer que se han arreglado las '
        + `${censadas.length} a la vez, comprueba que la tanda corrió de verdad: los conteos por `
        + 'zona, la sonda y los canarios.'],
    };
  }
  if (apagadas.length) {
    return {
      estado: 'APAGADA', salida: SALIDA_APAGADA, nuevas, apagadas, cieloRaso,
      motivos: apagadas.map((a) => `APAGADA · ${a.clave}`),
    };
  }
  return { estado: 'OK', salida: SALIDA_OK, nuevas: [], apagadas: [], cieloRaso, motivos: [] };
}
