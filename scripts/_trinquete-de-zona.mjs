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
// SCRUM-864: crea Y se compromete a borrar. Este fichero es del 8-sep y nacio antes del helper.
import { temporal } from '../tests/_temporal.mjs';

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

/**
 * Los tres estados que puede tener una prueba en una zona son `pass`, `fail` y `skip`.
 *
 * 🔴 `ausente` NO ES EL CUARTO (SCRUM-1335b, 6-oct-2026). Es «en esta zona no me llegó su
 * resultado», y eso es una medida que falta, no un veredicto. Ver `compararZonas`.
 */
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
//
// ✂ RETIRADAS A PROPÓSITO · 26-sep-2026 · SCRUM-1093 (a0f454f3, PR #1811). Quien mejora, declara.
//
//   · `tests/quoteNumber.test.mjs::allocateQuoteNumber: toma el cerrojo ANTES de leer, y avanza la serie`
//   · `tests/scrum592-numeracion-doc02.test.mjs::SCRUM-592 · el display se DERIVA: no hay columna de texto que pueda discrepar`
//
// No es la alarma que se apaga sola: es el defecto que se ARREGLÓ. `allocateQuoteNumber` y
// `displayQuoteNumber` (quoteNumber.service.ts) derivan el año con `diaNaturalEn(…,
// zonaDelMerchant(…))` y ya no con `getFullYear()` del proceso, así que su veredicto no depende
// de la zona de la máquina. Medido en el CI de #1821 (run 36243801473, 26-sep 13:17Z): las dos
// salieron APAGADAS y la tercera siguió cambiando — el instrumento SÍ midió.
// Lo que queda de la familia NO está arreglado: `planDeRenumeracion` (abajo, SCRUM-643 §2·A).
// 27-sep-2026 · SCRUM-1093f: `allocateAlbaranNumber` también deriva ya el año de la zona del merchant,
// y `allocateInvoiceNumber` lo hacía desde SCRUM-735. Ninguno de los dos tenía prueba CENSADA aquí
// (sus fixtures no caen en la frontera del año), así que no hay entrada que retirar: la vigila
// `tests/scrum1093f-albarannumber-zona-merchant.test.mjs`. Medido ese día: `planDeRenumeracion`
// sigue cambiando (Kiritimati pasa, Midway cae). SCRUM-1093g, mismo día: el número del PARTE
// (`partes.routes.ts`, `siguienteNumeroParte`) tampoco tenía censada; lo vigila
// `tests/scrum1093g-parte-numero-zona-merchant.test.mjs`.
export const CENSADAS = [
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
  dir = temporal('trinquete-zona-'), raiz = RAIZ,
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
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SCRUM-813c · LO QUE LA MEDICIÓN **ESCRIBE** — lista CERRADA, con nombre y motivo.
 *
 * LA DISTINCIÓN QUE HACE HONESTA A LA PUERTA: la quietud se exige sobre lo que la medición
 * **JUZGA** —los ficheros de `tests/` y de `src/`, que es lo que los guards leen para dar su
 * veredicto— y NO sobre lo que la medición **ESCRIBE** al correr. El sujeto de la medida no puede
 * incluir los ficheros que la propia medida crea: eso es pedirle a la tanda que no corra.
 *
 * ⛔ Y ES UNA LISTA CERRADA, NO UNA ZONA FRANCA. Cualquier ruta que se mueva y NO esté aquí sigue
 * siendo CIEGO, sin excepción. Está en código y no en un JSON para que añadir una entrada
 * **aparezca en el diff del PR** y alguien tenga que escribir por qué.
 *
 * ── CÓMO SE LLEGÓ A ESTA ENTRADA, porque el camino importa ───────────────────────────────────
 *
 * El CIEGO de CI decía sólo «EL ÁRBOL SE MOVIÓ», sin ruta, y **no se reproducía en Windows**: se
 * midió tres veces (100 muestras del código de `git status`, ~178 de las tres piezas de la marca,
 * y el trinquete real en dos pasadas) y las tres salieron limpias. Con el detalle por ruta de
 * SCRUM-813b, la siguiente pasada de CI lo dijo a la primera:
 *
 *     árbol 🔴 SE MOVIÓ durante la medición
 *        · scrum659/   (no aparecía) → estado:??
 *
 * ⚠️ **Y LA ENTRADA DE ABAJO TAPA UN DEFECTO DE ORIGEN, así que queda dicho aquí:** ese directorio
 * no debería nacer nunca dentro del árbol. Sale de
 * `tests/scrum659-lector-de-lineas-del-pdf.test.mjs`, cuyo respaldo es **el directorio actual**:
 *
 *     path.join(process.env.TEMP || process.env.TMPDIR || '.', 'scrum659')
 *
 * En Windows `TEMP` existe y el fixture se va al temporal —por eso no se reproducía—; en el runner
 * de Linux no, y cae en el repo. El arreglo de raíz es `os.tmpdir()`, que es lo que usa el resto
 * de la casa (`fs.mkdtempSync(path.join(os.tmpdir(), …))`). **Se reporta y no se arregla aquí**:
 * es otro carril (regla 37). El día que se arregle, esta entrada se retira — y el suelo de abajo
 * obliga a decirlo en voz alta en vez de dejar la lista vacía en silencio.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
/**
 * 🟢 LISTA VACÍA, Y ESO ES LA BUENA NOTICIA — retirada el 17-sep-2026.
 *
 * Tenía UNA entrada: `scrum659/`, amparada porque
 * `tests/scrum659-lector-de-lineas-del-pdf.test.mjs` construía su temporal con
 * `process.env.TEMP || process.env.TMPDIR || '.'` — y ese respaldo `.` hacía nacer el directorio
 * DENTRO del repo en el runner de Linux.
 *
 * **La entrada se ancló por su EXPRESIÓN, no por su línea** (SCRUM-710b me tumbó la primera
 * versión, que citaba `…:27`), y eso la hizo AUTOVERIFICABLE. Su comentario decía, literalmente:
 * «el día que alguien la arregle a `os.tmpdir()`, su test cae y obliga a retirar esta excepción».
 *
 * **Pasó exactamente eso.** SCRUM-824 («los temporales de test salen del árbol de trabajo, y un
 * trinquete») lo cambió a `path.join(os.tmpdir(), …)`. Medido el 17-sep-2026 al traer `main`:
 * el fichero ya no contiene esa expresión —0 ocurrencias del respaldo `'.'`— y el caso
 * `SCRUM-813c` cayó pidiendo la retirada. No se tocó el guard: se retiró la excepción.
 *
 * ⚠️ **Vacía no significa desactivada: significa MÁS estricta.** Sin entradas, cualquier ruta que
 * se mueva durante la medición deja el veredicto en CIEGO, que es el comportamiento correcto.
 * Y `arbolQuieto` sigue distinguiendo «lista vacía» de «nada se movió» — lo vigila su propio caso.
 *
 *     🔒 Una excepción que sobra es exactamente cómo una lista de excepciones engorda.
 */
export const ESCRITURAS_DE_LA_TANDA = Object.freeze([]);

/** ¿Esta ruta la escribe la propia medición? Un directorio declarado ampara lo que cuelga de él. */
export function laEscribeLaTanda(ruta, declaradas = ESCRITURAS_DE_LA_TANDA) {
  const r = String(ruta || '');
  return declaradas.some((d) => r === d.ruta
    || (d.ruta.endsWith('/') && r.startsWith(d.ruta)));
}

/**
 * ¿Qué se movió entre las dos marcas? Lista vacía = el árbol estuvo quieto.
 *
 * 🔴 SCRUM-813b · devuelve ADEMÁS `rutas`: qué ficheros se movieron, con su antes y su después.
 * La puerta es la misma —una sola ruta movida ya es CIEGO— pero el motivo deja de ser una frase
 * genérica y pasa a ser una lista de nombres, que es lo que permite arreglarlo en vez de
 * discutirlo.
 *
 * 🔴 SCRUM-813c · y separa las que **la propia medición escribe** (`ESCRITURAS_DE_LA_TANDA`) de
 * las **ajenas**. Sólo las ajenas ciegan. Devuelve las dos listas: `amparadas` no es un cajón
 * silencioso, se enseña en cada pasada para que una lista que engorda se vea.
 */
export function arbolQuieto(antes, despues, declaradas = ESCRITURAS_DE_LA_TANDA) {
  if (!antes?.ok || !despues?.ok) return { medible: false, cambios: [], rutas: [], amparadas: [] };
  const cambios = [];
  if (antes.head !== despues.head) {
    cambios.push(`HEAD: ${antes.head.slice(0, 12)} → ${despues.head.slice(0, 12)}`);
    return { medible: true, cambios, rutas: [], amparadas: [] };
  }

  // 🟢 EL SUELO DE LA LISTA VACÍA, RETIRADO EL 17-sep-2026 — y retirado por donde decía retirarlo.
  //
  // Aquí había un suelo: lista vacía ⇒ CIEGO, porque «un cero es una declaración perdida, no un
  // árbol limpio». Era correcto mientras hubiera UNA entrada medida (`scrum659/`): entonces el
  // peligro era que alguien la borrase y devolviera la puerta al estado de antes en verde. Su
  // propio comentario dejaba la condición de salida escrita: «si de verdad se arregla en origen,
  // se retira la entrada Y este suelo, a la vez y diciéndolo». Es lo que se está haciendo.
  //
  // SCRUM-824 arregló el respaldo de `scrum659` a `os.tmpdir()`, la entrada quedó sin sujeto y la
  // lista llegó a cero **por el camino bueno**. Mantener el suelo dejaría el trinquete en CIEGO
  // permanente: un rojo fijo por una mejora, que es el rojo que el siguiente desactiva (SCRUM-559).
  //
  // 🔴 Y LA PROTECCIÓN NO DESAPARECE, CAMBIA DE SENTIDO. Con la lista a cero, borrarla ya no es el
  // riesgo — el riesgo es AÑADIR. De eso se encarga `SCRUM-813c · la lista declarada es
  // EXACTAMENTE ésta`, que la fija por contenido a `[]`: cualquier entrada nueva tumba ese caso y
  // obliga a escribir su medición. Y una ruta no declarada sigue cegando, con la lista vacía o sin
  // ella, porque `laEscribeLaTanda` sobre una lista vacía no ampara nada.
  //
  //     🔒 Cuando la lista tenía una entrada, el peligro era borrarla. Vacía, el peligro es añadir.

  const rutas = [];
  const amparadas = [];
  if (antes.porRuta && despues.porRuta) {
    const todas = new Set([...antes.porRuta.keys(), ...despues.porRuta.keys()]);
    for (const r of [...todas].sort()) {
      const a = antes.porRuta.get(r);
      const b = despues.porRuta.get(r);
      if (a === b) continue;
      const movimiento = { ruta: r, antes: a ?? '(no aparecía)', despues: b ?? '(dejó de aparecer)' };
      // La ampara la lista SÓLO si está declarada. Todo lo demás —incluido cualquier fichero de
      // `tests/` o de `src/`, que es lo que la medición JUZGA— ciega igual que antes.
      if (laEscribeLaTanda(r, declaradas)) amparadas.push(movimiento);
      else rutas.push(movimiento);
    }
    for (const x of rutas) cambios.push(`${x.ruta}   ${x.antes} → ${x.despues}`);
  }

  // 🔴 EL SUELO DEL DETALLE, y sin él este refinamiento SERÍA un agujero: si la huella GLOBAL dice
  // que algo cambió y el detalle por ruta no encuentra NADA —ni ajeno ni amparado—, lo honesto no
  // es dar el árbol por quieto —eso convertiría un detector ciego en un verde— sino declarar que
  // se movió y que no se supo dónde. La puerta se queda cerrada precisamente cuando no se sabe.
  if (!rutas.length && !amparadas.length && antes.huella !== despues.huella) {
    cambios.push('el contenido del árbol de trabajo cambió durante la medición, y el detalle por '
      + 'ruta NO supo decir dónde — se trata como movimiento, nunca como quietud');
  }
  return { medible: true, cambios, rutas, amparadas };
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
    || path.join(temporal('trinquete-zona-med-'), 'medida.json');
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
  return compararZonas(medidas).cambian;
}

/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SCRUM-1335b · «AUSENTE» NO ES UN VEREDICTO — es una medida que falta, y se dice así.
 *
 * LO QUE HABÍA: una prueba con resultado en una zona y sin él en la otra contaba como «cambia de
 * veredicto», igual que un pasa/cae. MEDIDO el 6-oct-2026 sobre 177 corridas del job (1→6 oct):
 * **34 rojos, 289 acusaciones, y las 289 eran `pass`↔`ausente`. Ninguna `pass`↔`fail`.** La prueba
 * había corrido y pasado en las dos zonas; lo que faltaba era su RESULTADO, que no llegó a quien
 * cuenta (el hijo corre con `forceExit`, SCRUM-1405). El instrumento acusaba de «depende de la
 * zona» a partir de un dato que no tenía, y mandaba a fijar la zona de tests que no la miran.
 *
 * LO QUE HAY (decisión del orquestador, SCRUM-1335 c.18387, con sus tres condiciones):
 *
 *   · `cambian`     — hay DOS veredictos reales y son distintos. Es la acusación, igual que antes.
 *   · `sinComparar` — en alguna zona no hay resultado. **No acusa y no se calla**: se cuenta
 *                     aparte y se imprime con su cifra. «No pude comparar» no es «son iguales».
 *
 * 🔴 Y UNA CAÍDA REAL NO SE ESCAPA POR AHÍ, que es la condición que decide. Si a una prueba que
 * cae sólo en una zona se le pierde el resultado, queda `pass`↔`ausente` y parecería ruido. Pero
 * el fichero que la contiene **sale con código ≠ 0 en esa zona y con 0 en la otra**, y el código
 * de salida no viaja por la tubería que pierde resultados: `run()` lo ve siempre, y lo entrega como
 * un `fail` —el de la prueba si llegó, el del fichero si no—. Así que:
 *
 *     un `fail` frente a un `ausente` SIGUE SIENDO «cambia» cuando, en la zona donde falta,
 *     ESE FICHERO NO TIENE NINGUNA CAÍDA. El fichero cae en una zona y en la otra no.
 *
 * Eso cubre también al fichero que MUERE AL CARGAR en una zona sola (un `fail` con la ruta por
 * nombre, y sus pruebas ausentes), que es la dependencia de zona más gorda que hay.
 *
 * Y si el fichero cae TAMBIÉN en la zona donde falta el resultado, no se sabe si es la misma
 * prueba: `sinComparar`, no acusación. Las cinco formas están medidas con ficheros sembrados
 * (`docs/master/evidencias/SCRUM-1335b/`) y fijadas en `tests/scrum813-trinquete-de-zona.test.mjs`.
 *
 * ⚠️ LÍMITES DECLARADOS:
 *   · la pérdida real sólo se ha visto en el runner de Linux; aquí se IMITA (el fichero sembrado
 *     deja de escribir su salida). Lo que se ha medido es que el código de salida llega sin ella.
 *   · un fichero cuya salida se pierde ENTERA deja una entrada de más: `run()` informa del fichero
 *     mismo como una prueba que pasa. Cuenta en `sinComparar`; no cambia ningún veredicto.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
export function compararZonas(medidas) {
  const claves = new Set();
  for (const m of medidas) for (const k of m.veredictos.keys()) claves.add(k);

  // Por cada zona, los ficheros que CAEN en ella: los que tienen al menos un `fail`.
  const caidos = medidas.map((m) => {
    const ficheros = new Set();
    for (const [clave, v] of m.veredictos) if (v === 'fail') ficheros.add(clave.split('::')[0]);
    return ficheros;
  });

  const cambian = [];
  const sinComparar = [];
  for (const clave of [...claves].sort()) {
    const porZona = medidas.map((m) => ({
      zona: m.zona, veredicto: m.veredictos.get(clave) ?? AUSENTE,
    }));
    const [fichero, ...resto] = clave.split('::');
    const entrada = { clave, fichero, prueba: resto.join('::'), porZona };
    const distintos = new Set(porZona.map((p) => p.veredicto).filter((v) => v !== AUSENTE));
    if (distintos.size > 1) {
      cambian.push(entrada);
    } else if (porZona.some((p) => p.veredicto === AUSENTE)) {
      const elFicheroCaeSoloDondeSeVio = distintos.has('fail')
        && porZona.every((p, i) => p.veredicto !== AUSENTE || !caidos[i].has(fichero));
      if (elFicheroCaeSoloDondeSeVio) cambian.push({ ...entrada, porElFichero: true });
      else sinComparar.push(entrada);
    }
  }
  return { cambian, sinComparar };
}

/**
 * LA REPESCA, la parte que MIDE: cada fichero con candidatas, a solas y en las mismas zonas.
 *
 * Devuelve `fichero → medidas a solas`. Vive aquí y no en el guion para que la red de cada tanda
 * (`tests/scrum813-…`) la corra por el mismo camino que el job, con ficheros sembrados.
 */
export function repescar({
  candidatas, zonas = ZONAS, raiz = RAIZ, dirTrabajo, medir = medirEnZona, alMedir = () => {},
}) {
  const aSolas = new Map();
  for (const c of candidatas) {
    if (aSolas.has(c.fichero)) continue;
    const abs = path.isAbsolute(c.fichero) ? c.fichero : path.join(raiz, c.fichero);
    const solo = zonas.map((zona) => medir({
      zona, ficheros: [abs], raiz,
      salida: path.join(dirTrabajo, `solo-${aSolas.size}-${path.basename(abs)}-${zona.replace(/\W/g, '_')}.json`),
    }));
    aSolas.set(c.fichero, solo);
    alMedir(c.fichero, solo);
  }
  return aSolas;
}

/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * LA REPESCA, la parte que DECIDE. No mide nada: recibe la tanda y las medidas a solas.
 *
 * Con «ausente» fuera de los veredictos, a solas puede pasar una tercera cosa que antes no
 * existía —que tampoco se pueda comparar— y hay que decir qué se hace con ella EN CADA SENTIDO:
 *
 *   una que CAMBIABA en la tanda (dos veredictos reales, distintos)
 *     · a solas cambia otra vez ...................... `confirmadas`
 *     · a solas da lo MISMO en las dos zonas ......... `noConfirmadas` (parpadeo, como siempre)
 *     · a solas NO se pudo comparar o no se midió .... `confirmadas`, marcada `sinRefutar`
 *
 *   una que NO SE PUDO COMPARAR en la tanda
 *     · a solas cambia ............................... `confirmadas` (el hallazgo estaba debajo)
 *     · a solas da lo mismo .......................... `resueltas` (se comparó, y no era nada)
 *     · a solas sigue sin poder compararse ........... `sinComparar` — se cuenta y se dice
 *
 * 🔴 `sinRefutar` ES LA MITAD QUE NO SE PUEDE REGALAR. Una diferencia que se VIO, con resultado en
 * las dos zonas, sólo la desmiente otra medida que la vea igual. Si a solas falta el resultado, la
 * diferencia de la tanda queda en pie: de lo contrario, la misma pérdida que este cambio deja de
 * acusar serviría para borrar un hallazgo de verdad.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
export function resolverRepesca({ cambian, sinComparar, aSolas }) {
  const comparadas = new Map();
  const aSolasDe = (c, cambiabaEnLaTanda) => {
    const solo = aSolas.get(c.fichero);
    if (!solo || !solo.length || !solo.every((m) => m.ok)) return { estado: 'sin medir' };
    if (!comparadas.has(c.fichero)) comparadas.set(c.fichero, compararZonas(solo));
    const r = comparadas.get(c.fichero);
    if (r.cambian.some((x) => x.clave === c.clave)) return { estado: 'cambia' };
    // El fichero cae a solas en una zona y en la otra no: confirma a una candidata de ESE fichero
    // que YA CAMBIABA en la tanda, aunque esta vez el resultado con su nombre no haya llegado.
    // A una que sólo «no se pudo comparar» NO la confirma: de ella no se ha visto nada.
    const delFichero = r.cambian.filter((x) => x.fichero === c.fichero);
    const loConfirmaElFichero = cambiabaEnLaTanda && delFichero.some((x) => x.porElFichero || c.porElFichero);
    if (loConfirmaElFichero) {
      return { estado: 'cambia', conNombre: delFichero.filter((x) => !x.porElFichero) };
    }
    // Una candidata que lo es POR EL FICHERO se compara por el fichero, y el código de salida
    // llega siempre: si a solas no cae en una zona sí y en otra no, se comparó y es lo mismo.
    if (c.porElFichero) return { estado: 'igual' };
    return { estado: solo.every((m) => m.veredictos.has(c.clave)) ? 'igual' : 'sin comparar' };
  };

  const porClave = new Map();
  const confirmar = (c) => { if (!porClave.has(c.clave)) porClave.set(c.clave, c); };
  const noConfirmadas = [];
  for (const c of cambian) {
    const s = aSolasDe(c, true);
    if (s.estado === 'igual') noConfirmadas.push(c);
    else if (s.estado !== 'cambia') confirmar({ ...c, sinRefutar: s.estado });
    // 🔴 Lo que en la tanda sólo se supo POR EL FICHERO y a solas se ve CON NOMBRE, se queda con el
    // nombre. Sin esto, una censada cuyo resultado se perdió en la tanda saldría dos veces: como
    // ella misma (a solas) y como una «nueva» sin nombre (el fichero), que no lo es.
    else if (c.porElFichero && s.conNombre?.length) for (const x of s.conNombre) confirmar(x);
    else confirmar(c);
  }
  const resueltas = [];
  const siguen = [];
  for (const c of sinComparar) {
    const s = aSolasDe(c, false);
    if (s.estado === 'cambia') confirmar(c);
    else if (s.estado === 'igual') resueltas.push(c);
    else siguen.push(c);
  }
  return { confirmadas: [...porClave.values()], noConfirmadas, resueltas, sinComparar: siguen };
}

/**
 * ¿Los canarios se han comportado? Si no, el instrumento está CIEGO y no opina del árbol.
 *
 * Los dos sentidos, y los dos importan:
 *   · un DEPENDIENTE que no sale denunciado ⇒ el trinquete no ve el defecto que existe para ver.
 *   · un FIJADO que sale denunciado ⇒ denuncia a los inocentes, y así se apaga solo por ruido.
 */
export function juzgarCanarios(cambian, canarios, sinComparar = []) {
  const denunciadas = new Set(cambian.map((c) => c.fichero));
  const sinMedida = new Set(sinComparar.map((c) => c.fichero));
  const fallos = [];
  for (const c of canarios) {
    const visto = denunciadas.has(c.rutaClave);
    // 🔴 SCRUM-1335b · un canario que no se pudo comparar NO es un control cumplido, en ninguno de
    // los dos sentidos. Antes, a un dependiente le bastaba faltar en una zona para darse por
    // «denunciado»: el autocontrol se aprobaba con un resultado que no había llegado.
    if (!visto && sinMedida.has(c.rutaClave)) {
      fallos.push(`el canario \`${c.fichero}\` NO SE PUDO COMPARAR: su resultado falta en alguna zona, `
        + 'también a solas. Sin él no se sabe si el trinquete ve, así que no opina del árbol.');
      continue;
    }
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
export function veredicto({
  cambianEnElArbol, censadas = CENSADAS, medidas = [], controles, quieto, sinComparar = [],
}) {
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
    return { estado: 'CIEGO', salida: SALIDA_CIEGO, motivos: problemas, nuevas: [], apagadas: [], sinComparar };
  }

  const porClave = new Map(censadas.map((c) => [c.clave, c]));
  const vistas = new Set(cambianEnElArbol.map((c) => c.clave));

  // 🔴 SCRUM-1335b · UNA CENSADA QUE NO SE PUDO COMPARAR NO ESTÁ «VIVA» NI «APAGADA».
  //
  // Antes, que a una censada le faltara el resultado en una zona contaba como «sigue cambiando»:
  // la alarma se daba por viva con un dato que no había llegado. Y lo contrario sería peor —
  // llamarla APAGADA es acusar a alguien de haberla arreglado en silencio. Ninguna de las dos
  // cosas se sabe, así que es CIEGO y lo dice con su nombre (más abajo).
  //
  // Lo mismo si su fichero cae en una zona y en la otra no pero el `fail` llegó sin el nombre de
  // la prueba: casi seguro es ella, y por eso mismo no se le cuelga a nadie como NUEVA.
  const sinVeredicto = new Set(sinComparar.map((c) => c.clave));
  const censadasSinComparar = censadas.filter((c) => !vistas.has(c.clave) && sinVeredicto.has(c.clave));
  const ficherosDeEsas = new Set(censadasSinComparar.map((c) => c.clave.split('::')[0]));

  const nuevas = cambianEnElArbol.filter((c) => !porClave.has(c.clave)
    && !(c.porElFichero && ficherosDeEsas.has(c.fichero)));
  const apagadas = censadas.filter((c) => !vistas.has(c.clave) && !sinVeredicto.has(c.clave));

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
      estado: 'HABLA', salida: SALIDA_HABLA, nuevas, apagadas, cieloRaso, sinComparar,
      motivos: nuevas.map((n) => `NUEVA · ${n.clave}`),
    };
  }
  if (censadasSinComparar.length) {
    return {
      estado: 'CIEGO', salida: SALIDA_CIEGO, nuevas, apagadas, cieloRaso: false, sinComparar,
      motivos: censadasSinComparar.map((c) => `la censada \`${c.clave}\` NO SE PUDO COMPARAR: su `
        + 'resultado falta en alguna zona, también a solas. No se sabe si sigue cambiando de '
        + 'veredicto, así que no se da por viva ni por apagada.'),
    };
  }
  if (cieloRaso) {
    return {
      estado: 'CIEGO', salida: SALIDA_CIEGO, nuevas, apagadas, cieloRaso, sinComparar,
      motivos: [`CERO pruebas cambian de veredicto y hay ${censadas.length} censadas que deberían `
        + 'estar cambiando. Antes de creer que se han arreglado las '
        + `${censadas.length} a la vez, comprueba que la tanda corrió de verdad: los conteos por `
        + 'zona, la sonda y los canarios.'],
    };
  }
  if (apagadas.length) {
    return {
      estado: 'APAGADA', salida: SALIDA_APAGADA, nuevas, apagadas, cieloRaso, sinComparar,
      motivos: apagadas.map((a) => `APAGADA · ${a.clave}`),
    };
  }
  // 🔴 SCRUM-1335b · EL VERDE LLEVA CONSIGO LO QUE NO PUDO COMPARAR. No lo vuelve rojo —un resultado
  // que no llegó no acusa a nadie— pero viaja en el veredicto con su cifra, para que el guion lo
  // imprima y nadie lea «0 nuevas» como «las comparé todas».
  return { estado: 'OK', salida: SALIDA_OK, nuevas: [], apagadas: [], cieloRaso, sinComparar, motivos: [] };
}
