// SCRUM-480 · LOS FINALES DE LÍNEA NO DEPENDEN DE LA MÁQUINA DE NADIE.
//
// Sin gate: lee blobs con git. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DAÑO, MEDIDO — Y NO ES EL QUE PARECÍA
//
// La fase 1 midió que un cambio de una línea produce un diff de una línea incluso en un fichero
// con el blob en CRLF, y concluyó que no había daño diario. El diff estaba bien medido; **la
// conclusión estaba mal, porque midió la operación equivocada**. El daño sale al MERGEAR:
//
//     rama A (su editor guarda LF)    1 línea cambiada  →  diff de 168 líneas
//     rama B (su editor guarda CRLF)  1 línea cambiada  →  diff de 208 líneas
//     merge                                             →  CONFLICTO, el 89 % del fichero
//
// Eso le costó media hora a la sesión 1 con `settingsView.js` el 13-ago-2026, y antes a la
// sesión 2 con `quotesView.js` (commit `9c2c69ef`, 5.144 líneas).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ HACEN FALTA LAS DOS COSAS, Y NO UNA
//
//   RENORMALIZAR SOLO  →  el primer commit desde un editor de Windows lo deshace ENTERO.
//                         Es un arreglo de una vez que se revierte solo.
//   `.gitattributes` SOLO → no arregla los blobs que ya están en CRLF.
//
// Y una tercera, que es la que no se ve venir: **`* text=auto` no basta**. Ocho de los nueve
// ficheros llevaban `\r\r\n` —la firma de una doble conversión— y ante un CR suelto git decide
// que el fichero es BINARIO y deja de normalizarlo **en silencio**. Por eso las reglas declaran
// `text` EXPLÍCITO por extensión: así la detección no participa.
import test from 'node:test';
import { soloEjecutable } from './_guard-texto.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censoEol, censoArbolDeTrabajo, mismoBlobEnLasDosPlataformas, clasificarBlob,
  extensionesConEolLf, CR_PERMITIDO, ficherosDeLaRama, censoDeRutas,
} from './_censo-eol.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ATTRS = fs.readFileSync(path.join(RAIZ, '.gitattributes'), 'utf8');
/**
 * Las extensiones que el guard del disco vigila, DERIVADAS de `.gitattributes`. Ni una lista a
 * mano —se separaría de las reglas en silencio— ni «todo el árbol»: hay ficheros de fuente ajena
 * (los `.xsd` de la AEAT, `aeat-errores.properties`) que se guardan tal cual a propósito y a los
 * que nadie ha prometido LF. El guard vigila EXACTAMENTE lo prometido.
 */
const EXT_LF = extensionesConEolLf(ATTRS);

// ── SUELO ────────────────────────────────────────────────────────────────────────────────
// «No hay ficheros con CR» y «no supe mirar» dan el mismo verde. Este bloque los separa.

test('SCRUM-480 · SUELO: el censo VE el árbol antes de decir que está limpio', () => {
  const r = censoEol(RAIZ);
  assert.ok(r.poblacion > 1000,
    `🔴 el censo solo ve ${r.poblacion} ficheros rastreados, y el repo tiene ~1.700. Si git no `
    + 'está respondiendo, el cero de abajo no significa «limpio»: significa que no se miró.');
  assert.ok(r.textos > 500,
    `🔴 solo ${r.textos} blobs clasificados como TEXTO. El criterio es «sin ningún byte NUL»; si `
    + 'se rompiera, todo pasaría por binario y el guard no acusaría nunca a nadie.');
});

test('SCRUM-480 · SUELO: el clasificador distingue las tres formas', () => {
  // Sin esto, un clasificador que devolviera siempre «0 CR» dejaría el trinquete en verde eterno.
  const b = (s) => Buffer.from(s, 'latin1');
  assert.deepEqual(clasificarBlob(b('a\nb\n')), { texto: true, crlf: 0, crSuelto: 0 });
  assert.deepEqual(clasificarBlob(b('a\r\nb\r\n')), { texto: true, crlf: 2, crSuelto: 0 });
  // 🔴 `\r\r\n` — la doble conversión que se comió el arreglo fácil: UN CRLF y UN CR suelto.
  assert.deepEqual(clasificarBlob(b('a\r\r\nb\n')), { texto: true, crlf: 1, crSuelto: 1 });
  assert.equal(clasificarBlob(Buffer.from([0x89, 0x50, 0x00, 0x0d, 0x0a])).texto, false,
    '🔴 un blob con NUL tiene que quedar fuera: si no, los 213 PNG del repo se acusarían en falso '
    + 'y el guard acabaría desactivado, que es como mueren los guards que acusan en falso.');
});

// ── EL TRINQUETE ─────────────────────────────────────────────────────────────────────────

test('SCRUM-480 · 🔴 ningún blob de TEXTO lleva CR (salvo lo declarado)', () => {
  const { conCR, poblacion } = censoEol(RAIZ);
  const ofensores = conCR.filter((f) => !CR_PERMITIDO[f.ruta]);

  assert.deepEqual(ofensores.map((f) => f.ruta), [],
    `🔴 HAY BLOBS DE TEXTO CON CR EN EL REPOSITORIO (${ofensores.length} de ${poblacion}):\n`
    + ofensores.map((f) => `   · ${f.ruta}  (CRLF ${f.crlf}, CR sueltos ${f.crSuelto})`).join('\n')
    + '\n\n  Cada uno es media hora perdida el día que dos ramas lo toquen desde editores\n'
    + '  distintos: el merge conflicta el fichero ENTERO y hay que reaplicar los cambios a mano.\n'
    + '  Ya pasó con `settingsView.js` (13-ago) y con `quotesView.js` (commit 9c2c69ef, 5.144\n'
    + '  líneas).\n\n'
    + '  ⚠️ Y no basta con quitar los CRLF: hay que quitar TODOS los CR. Un `\\r\\r\\n` deja el\n'
    + '  filtro de git sin punto fijo —se come un CR por pasada— y el fichero vuelve a cambiar\n'
    + '  en el commit siguiente.');

  // Y las excepciones no pueden sobrevivir a su causa: si el fichero declarado deja de tener CR,
  // la excepción sobra y se quita. Una excepción que ya no ampara nada es un permiso.
  for (const ruta of Object.keys(CR_PERMITIDO)) {
    assert.ok(conCR.some((f) => f.ruta === ruta),
      `🔴 «${ruta}» está declarado como excepción y ya NO tiene CR. Quita la entrada de `
      + '`CR_PERMITIDO` en este mismo commit: una excepción que sobrevive a su causa deja de ser '
      + 'una nota y pasa a ser un permiso.');
  }
});

// ── 🔴 LO QUE RENORMALIZAR NO CURA: LA CEGUERA ───────────────────────────────────────────
//
// ── SCRUM-517 · QUÉ VIGILA ESTE CASO. DECIDIDO, Y ESCRITO AQUÍ PARA QUE NO SE REDECIDA ───
//
// VIGILA EL DISCO DEL DESARROLLADOR, no el blob. La pregunta «¿está limpio lo que se sube?» ya
// la contesta el caso de arriba con `git cat-file`, y contestarla dos veces no la contestaría
// mejor: dejaría dos tests que caen a la vez y no distinguen nada. Un test que vigila dos cosas
// distintas no falla por ninguna en concreto.
//
// Y EL DISCO IMPORTA AUNQUE `.gitattributes` YA PROTEJA EL REPOSITORIO, por un motivo que no es
// de higiene: **un guard no abre el repositorio, hace `readFileSync` del disco**. Con un `\r` en
// la línea, `soloEjecutable(linea)` NO HACE NADA —sin `m`, `$` exige fin de cadena y el
// `\r` está en medio—, así que un guard que promete «miro el código, no los comentarios» mira
// también los comentarios y aprueba lo que venía a prohibir. Le pasó al de SCRUM-409 durante
// semanas, y solo en Windows: el CI es Linux y allí iba en verde.
//
// O sea que las dos cosas son INDEPENDIENTES: los blobs pueden estar impecables mientras el
// árbol que ejecuta los guards está podrido. Medido el 19-ago-2026 en esta misma máquina, mismo
// commit, seis árboles del mismo repositorio:
//
//     cobroflash-b5, b4  (materializados con `eol=lf` ya en vigor)      0 de 1.479
//     cobroflash-backend (veterano)                                 1.386 de 1.480
//     cobroflash-b2      (veterano)                                 1.368 de 1.479
//     cobroflash-b1, b3  (rama con `.gitattributes` anterior)   ciegos: leen 2 de 1.714
//
// Los dos veteranos tienen sus guards cegados AHORA MISMO. El repositorio está limpio: 0 blobs
// de texto con CR sobre 1.500. Este caso es lo único que separa esas dos frases.
//
// AVISO DE INSTRUMENTO, PORQUE LOS DE ANDAR POR CASA MIENTEN SOBRE PRECISAMENTE ESTO:
//   · el `grep` de Git Bash NORMALIZA CRLF al leer, y `grep -c $'\r'` da falso NEGATIVO.
//     MEDIDO el 19-ago-2026: fichero con 3 CR en el disco, `grep -c` dice 0, node dice 3.
//   · `git show <rev>:<ruta>` se reportó el 17-ago-2026 como que APLICA el filtro de salida y
//     hace concluir que tus commits meten CR en el repositorio. NO lo he reproducido el
//     19-ago-2026 con git 2.55.0.windows.2: sobre un blob anterior a la renormalización dio
//     los mismos 223 CR que `git cat-file`. No borro el aviso —el modo de invocación importa,
//     y `git show` en modo DIFF sí reescribe lo que enseña— pero no lo doy por universal.
//   · LA REGLA QUE SOBREVIVE A LAS DOS MEDICIONES, y la única que hay que recordar: el blob se
//     lee con `git cat-file`, y los CR se cuentan en BYTES con node, que es lo que hace
//     `clasificarBlob`. Nunca con grep, y nunca fiándose de una herramienta que además de leer
//     convierte.
//
// ── Y POR QUÉ EL RECUENTO NO SE ENSEÑA CON UN `deepEqual` DE LISTAS ──────────────────────
//
// Hasta el 19-ago-2026 este assert comparaba `ofensores.slice(0, 25)` contra `[]`. El titular
// daba la cifra buena, pero **quien manda en la pantalla es el diff que imprime `node:test`, y
// ese diff era la lista cortada**: 25 rutas, las 25 de `.agents/skills/impeccable/`. Quien leía
// la salida se llevaba «cuatro ficheros de una skill». Eran 1.386: casi el checkout entero, 55
// veces más. Un recuento que se presenta cortado sin decirlo tiene la forma correcta y la
// magnitud equivocada, y eso es peor que no dar ninguna, porque se cree.
//
// Por eso el assert es sobre EL NÚMERO: así el diff automático enseña `1386` frente a `0` —la
// magnitud, que es el dato— y la lista baja al mensaje, con su corte DECLARADO en palabras.

test('SCRUM-480 · 🔴 el ÁRBOL DE TRABAJO no tiene ni un `\\r` — es lo que leen los guards', (t) => {
  /** Cuántos ofensores se nombran. El resto se cuenta en voz alta, nunca se calla. */
  const MUESTRA = 25;
  const r = censoArbolDeTrabajo(RAIZ, EXT_LF);

  // 🔴 EL SUELO VA DENTRO DE ESTE CASO, A PROPÓSITO. «Cero ficheros con `\r`» y «no supe qué
  // leer» dan el mismo verde, y el segundo no es hipotético: `cobroflash-b1` y `cobroflash-b3`
  // están en ramas cuyo `.gitattributes` es anterior a `eol=lf`, así que `EXT_LF` sale con una
  // sola extensión y el censo lee 2 ficheros de 1.714. Con el suelo en un test aparte, ESTE
  // caso habría dado verde sobre la nada y el rojo del otro no habría dicho cuál era el ciego.
  assert.ok(r.leidos > 1000,
    `🔴 CIEGO, QUE NO ES LIMPIO: solo he podido leer ${r.leidos} ficheros del disco (de `
    + `${r.poblacion} rastreados), mirando las ${EXT_LF.size} extensiones que \`.gitattributes\` `
    + 'promete en LF.\n\n'
    + '  Un cero de ofensores aquí se leería como «todo limpio», y esa es la mentira más cara\n'
    + '  que puede decir este fichero. Causa medida: la rama arrastra un `.gitattributes`\n'
    + '  anterior a `eol=lf` y no queda nada que vigilar. Míralo con `git cat-file -p\n'
    + '  HEAD:.gitattributes` —no con `git show`, ver el aviso de arriba— antes de creer nada.');

  // 🔴 Y QUE EL CENSO CUADRE. Un censo cuyas categorías no suman su total no es un censo, es un
  // número suelto. `binarios` y `sinCR` los cuenta el censo en su propia rama del bucle —no los
  // deriva restando—, así que esta suma puede fallar de verdad: si mañana aparece un camino que
  // lee un fichero y no lo clasifica en ninguna categoría, sale aquí en vez de esconderse en un
  // total que ya no es de nadie. Y sin esto, el `de N leídos` del mensaje de abajo podría estar
  // contando una población distinta de la mirada sin que el lector tuviera forma de saberlo.
  assert.equal(r.conCR.length + r.sinCR + r.binarios, r.leidos,
    `🔴 el censo NO CUADRA: ${r.conCR.length} con CR + ${r.sinCR} sin CR + ${r.binarios} `
    + `binarios = ${r.conCR.length + r.sinCR + r.binarios}, y se han leído ${r.leidos}. Con las `
    + 'categorías descuadradas no vale ninguna cifra de este test, empezando por el recuento.');

  const ofensores = r.conCR.filter((f) => !CR_PERMITIDO[f.ruta]);
  const muestra = ofensores.slice(0, MUESTRA);

  const informe = (
    `🔴 TU ÁRBOL DE TRABAJO TIENE ${ofensores.length} ${ofensores.length === 1 ? 'FICHERO' : 'FICHEROS'} DE TEXTO`
    + ` CON \`\\r\` — de `
    + `${r.textos} de texto, sobre ${r.leidos} leídos y ${r.poblacion} rastreados.\n\n`
    + `  mostrando ${muestra.length} de ${ofensores.length}:\n`
    + muestra.map((f) => `   · ${f.ruta}  (CRLF ${f.crlf}, CR sueltos ${f.crSuelto})`).join('\n')
    + (ofensores.length > muestra.length
      ? `\n   … y ${ofensores.length - muestra.length} MÁS SIN NOMBRAR. La cifra es `
        + `${ofensores.length}, no ${muestra.length}: no leas esta lista como si fuera el censo.`
      : '')
    + '\n\n'
    + '  ESTO NO ACUSA AL REPOSITORIO. Lo que se sube está limpio y lo vigila el caso de arriba,\n'
    + '  que mide blobs. Acusa a ESTE ÁRBOL: se materializó antes de que `.gitattributes` dijera\n'
    + '  `eol=lf`, y git no reescribe en el checkout lo que no cambia, así que siguen como\n'
    + '  nacieron.\n\n'
    + '  🔴 NO ES `core.autocrlf`, Y ESTÁ MEDIDO (SCRUM-533, 19-ago-2026). Dos clones frescos\n'
    + '  del MISMO commit b78a3b1f, censados con este mismo instrumento:\n'
    + '     core.autocrlf=true  -> 0 de 1.502 ficheros de texto con CR\n'
    + '     core.autocrlf=false -> 0 de 1.502\n'
    + '  y este árbol veterano, también con autocrlf=true -> 1.348. La configuración NO es la\n'
    + '  variable: `eol=lf` gana a `autocrlf` en un checkout nuevo. Cambiar el ajuste no arregla\n'
    + '  un árbol ya materializado, y culparlo manda a quien lo lea a tocar lo que no es.\n'
    + '  Y no es cosmética,\n'
    + '  CIEGA TUS GUARDS EN SILENCIO: `linea.replace(/\\/\\/.*$/, \'\')` sobre una línea que\n'
    + '  arrastra `\\r` no hace NADA, así que los guards que corras aquí aprueban lo que venían a\n'
    + '  prohibir. Le pasó al de SCRUM-409 durante semanas, y solo en Windows.\n\n'
    + '  MIENTRAS ESTE CASO ESTÉ ROJO, NINGÚN «0 fallos» DE ESTE ÁRBOL VALE COMO EVIDENCIA.\n'
    + '  No porque falle este test: porque los guards que dieron ese verde estaban ciegos.\n\n'
    + '  SE ARREGLA REMATERIALIZANDO, y no se toca el repositorio para ello:\n'
    + '   · sin riesgo — un árbol nuevo nace en LF (medido: 0 de 1.479 el 19-ago-2026):\n'
    + '        git worktree add ../cobroflash-bN -b <tu-rama> origin/main\n'
    + '   · en el mismo árbol, y SOLO con todo commiteado o guardado en `git stash`, porque el\n'
    + '     `reset` de la segunda línea BORRA lo que no esté en ninguno de los dos:\n'
    + '        git rm --cached -r .   &&   git reset --hard');

  // ── SCRUM-533 · DÓNDE BLOQUEA ESTE CASO. DECIDIDO CON LA MEDICIÓN DELANTE ─────────────
  //
  // Este caso acusa al ENTORNO, no al cambio. En un árbol veterano son ~1.350 ficheros, TODOS
  // de commits ajenos y antiguos, y ninguno se arregla editándolo: se arregla rematerializando
  // el árbol, que NO toca el repositorio ni la historia. Bloquear por eso en local pone rojo a
  // una persona por algo que no ha hecho y que su rama no puede arreglar — y un rojo que no se
  // puede arreglar no se arregla: se aprende a ignorar. El día que cace un `\r` de verdad, ya
  // nadie lo mirará. Eso es lo que este ticket viene a impedir.
  //
  // 🔴 PERO NO SE CALLA, Y POR ESO NO ES UN `skip`:
  //   · EN CI BLOQUEA EXACTAMENTE IGUAL QUE ANTES. Allí el checkout es fresco y el número es
  //     0, así que el trinquete no pierde nada — y si algún día CI se clona de otra forma, cae.
  //   · EN LOCAL SE IMPRIME ENTERO con `diagnostic`: recuento, muestra y remedio. Lo que se le
  //     retira es el poder de tumbar la tanda, no el aviso.
  //   · Y EL AVISO SIGUE SIENDO CIERTO. Medido el 19-ago-2026 en este árbol: 504 ficheros de
  //     `tests/` y 216 de `src/` llevan CR, así que los guards que corran aquí PUEDEN estar
  //     ciegos y un «0 fallos» de un árbol con este diagnóstico no vale como evidencia. Eso no
  //     lo cambia este ticket: lo único que cambia es a quién se le pone el rojo delante.
  //
  // Lo que SÍ bloquea en local es el caso de abajo: los ficheros que toca TU rama.
  if (process.env.CI) {
    assert.equal(ofensores.length, 0, informe);
  } else if (ofensores.length > 0) {
    t.diagnostic(informe);
  }
});

// ── 🔴 SCRUM-533 · LO QUE TOCA TU RAMA — EL CASO QUE SÍ ACUSA AL CAMBIO ──────────────────
//
// EL PROBLEMA QUE RESUELVE, y no es de comodidad. El caso de arriba mide el árbol ENTERO, así
// que en un árbol veterano sale rojo por ~1.350 ficheros ajenos y antiguos, SIEMPRE, y por algo
// que la rama no puede arreglar. Un test que falla siempre por el entorno y nunca por el código
// enseña a ignorar un rojo — y entonces deja de proteger el día que el rojo sea de verdad.
//
// Este caso mide la otra población: los ficheros que ESTA rama toca. Ahí un CR es del autor, se
// arregla guardando el fichero en LF, y el rojo vuelve a significar algo.
//
// POR QUÉ ESTO NO ES BAJAR EL LISTÓN: no se relaja ningún umbral ni se excluye ninguna ruta. El
// trinquete de los BLOBS sigue midiendo el repositorio entero y sigue en 0; el del árbol sigue
// midiéndolo entero y sigue bloqueando EN CI. Lo que se añade es un caso más ESTRECHO y más
// exigente en lo suyo: cae con UN solo fichero, el tuyo, y lo nombra.
//
// LA POBLACIÓN, y cada decisión está medida:
//   · lo COMMITEADO desde la base de la rama (`merge-base` con `origin/main`) MÁS lo modificado
//     o añadido al índice y todavía sin commitear. Un CR puede entrar en los dos momentos.
//   · lo SIN RASTREAR queda fuera (ver `ficherosDeLaRama`): el censo del árbol mira
//     `git ls-files`, o sea solo lo rastreado, y este caso no puede ser más estricto que aquel
//     en una dimensión que `.gitattributes` nunca prometió. Medido: en este árbol había dos
//     borradores ajenos sin rastrear con CRLF que lo habrían puesto rojo el primer día.
//   · las mismas extensiones que promete `.gitattributes`, DERIVADAS de él, no escritas aquí.

test('SCRUM-533 · 🔴 los ficheros que TOCA ESTA RAMA no llevan ni un CR en disco', () => {
  const { base, rutas } = ficherosDeLaRama(RAIZ);
  const r = censoDeRutas(RAIZ, rutas, EXT_LF);
  const ofensores = r.conCR.filter((f) => !CR_PERMITIDO[f.ruta]);

  assert.equal(ofensores.length, 0,
    '🔴 ESTA RAMA TOCA ' + ofensores.length + ' FICHERO(S) DE TEXTO CON CR EN EL DISCO — de '
    + r.textos + ' de texto sobre ' + r.leidos + ' leídos (' + rutas.length + ' tocados, '
    + r.fueraDeAlcance + ' fuera de las extensiones que `.gitattributes` promete en LF).\n\n'
    + ofensores.map((f) => '   · ' + f.ruta + '  (CRLF ' + f.crlf + ', CR sueltos ' + f.crSuelto + ')').join('\n')
    + '\n\n'
    + '  ESTE SÍ ES TUYO, a diferencia del censo del árbol entero: son ficheros que esta rama\n'
    + '  toca, así que el CR viaja en tu commit. Y no es cosmética: al mergear, un fichero\n'
    + '  guardado con CRLF contra una rama en LF produce un conflicto del fichero ENTERO —\n'
    + '  `settingsView.js` (13-ago-2026) y `quotesView.js` (`9c2c69ef`, 5.144 líneas).\n\n'
    + '  SE ARREGLA GUARDÁNDOLO EN LF: en el editor, fin de línea LF, guardar y volver a mirar.\n'
    + '  Si el blob ya está bien y solo está sucio el disco, basta con rematerializar ESE\n'
    + '  fichero. No se toca `.gitattributes` ni se añade una excepción: eso sería apagar la\n'
    + '  alarma en el único caso en que suena por algo que has hecho tú.\n\n'
    + '  base de la rama: ' + (base ? base.ref + ' @ ' + base.sha.slice(0, 8) : '(NO RESUELTA)'));
});

test('SCRUM-533 · SUELO: el recolector de la rama SABE ver, y el clasificador SABE acusar', () => {
  // 🔴 SIN ESTO EL CASO DE ARRIBA ES VERDE SOBRE LA NADA. Una rama sin cambios da población
  // vacía, y una lista vacía hace verdad cualquier «no hay ninguno». Esto separa «no hay CR»
  // de «no supe qué mirar», que dan exactamente el mismo verde.
  const { base, rutas } = ficherosDeLaRama(RAIZ);
  assert.ok(Array.isArray(rutas), '🔴 el recolector no devuelve una lista de rutas');

  // ① la base se resuelve. Sin ella, «0 ficheros tocados» no significa «rama limpia» sino
  //   «no supe compararla». En un checkout somero (CI) puede no resolver, y entonces el caso
  //   de arriba solo mira lo no commiteado y lo DICE en su mensaje; aquí se exige porque en un
  //   árbol de trabajo normal siempre resuelve, y si deja de hacerlo hay que enterarse.
  if (!process.env.CI) {
    assert.ok(base && /^[0-9a-f]{40}$/.test(base.sha),
      '🔴 CIEGO: no se ha podido resolver la base de la rama con `merge-base` contra '
      + '`origin/main`. El caso de arriba estaría midiendo una población recortada y su verde '
      + 'no significaría nada.');
  }

  // ② el clasificador sabe acusar Y sabe absolver, con búferes dados en la mano. Si solo se
  //   comprobara lo primero, un clasificador que acusara SIEMPRE también pasaría.
  assert.equal(clasificarBlob(Buffer.from('a\r\nb\n', 'latin1')).crlf, 1,
    '🔴 el clasificador no ve un CRLF que le doy en la mano: no podría acusar a nadie.');
  assert.equal(clasificarBlob(Buffer.from('a\nb\n', 'latin1')).crlf, 0,
    '🔴 el clasificador acusa a un fichero en LF: acusaría a todos y acabaría desactivado.');

  // ③ y el censo restringido MIRA de verdad la ruta que se le da, en vez de devolver vacío.
  //   ⚠️ `package.json` y NO `.gitattributes`: un fichero que empieza por punto no tiene
  //   extensión para `path.extname`, así que jamás entra en la población y el censo devolvía
  //   0 leídos. Lo cazó este mismo suelo al escribirlo, que es para lo que está.
  const uno = censoDeRutas(RAIZ, ['package.json'], new Set(['.json']));
  assert.equal(uno.candidatas, 1, '🔴 el censo restringido no ha mirado la ruta que le di');
  assert.equal(uno.leidos, 1,
    '🔴 el censo restringido no ha llegado a LEER `package.json`, que existe siempre. Si no '
    + 'lee, su «0 ofensores» es ceguera y no limpieza.');
});


test('SCRUM-480 · SUELO: el censo del disco LEE de verdad, y sabría ver un `\\r`', () => {
  const r = censoArbolDeTrabajo(RAIZ, EXT_LF);
  assert.ok(r.leidos > 1000,
    `🔴 solo se han leído ${r.leidos} ficheros del disco: el verde de arriba no significaría nada.`);
  assert.ok(r.textos > 500, `🔴 solo ${r.textos} clasificados como texto en disco`);
  // Y que el clasificador SEPA acusar, con un búfer fabricado a propósito.
  assert.equal(clasificarBlob(Buffer.from('a\r\nb\n', 'latin1')).crlf, 1,
    '🔴 el clasificador no ve un CRLF que le doy en la mano: no puede acusar a nadie.');
  // La población sale de `.gitattributes`, no de una lista escrita aquí. Si el derivador se
  // rompiera, `EXT_LF` quedaría vacío, el censo no miraría NADA y el test de arriba pasaría solo.
  assert.ok(EXT_LF.size >= 10,
    `🔴 solo ${EXT_LF.size} extensiones derivadas de \`.gitattributes\`; hay 14 declaradas. Con el `
    + 'derivador roto, el guard del disco no mira ningún fichero y pasa en verde sobre la nada.');
  for (const ext of ['.js', '.ts', '.mjs']) {
    assert.ok(EXT_LF.has(ext), `🔴 \`${ext}\` no sale del derivador: el guard no vigilaría el código`);
  }
});

// ── EL MECANISMO ─────────────────────────────────────────────────────────────────────────

test('SCRUM-480 · 🔴 EL CONTROL: Windows y Linux producen el MISMO blob', () => {
  // Lo que pidió el fundador, y lo único que demuestra que esto no vuelve a pasar.
  for (const ruta of [
    'public/dashboard/js/cualquiera.js',
    'src/modules/cualquiera.ts',
    'tests/cualquiera.mjs',
    'public/dashboard/css/cualquiera.css',
  ]) {
    const r = mismoBlobEnLasDosPlataformas(RAIZ, ruta);
    assert.ok(r.igual,
      `🔴 «${ruta}» GUARDADO EN WINDOWS Y EN LINUX PRODUCE DOS BLOBS DISTINTOS.\n\n`
      + `  Windows: ${r.windows}\n  Linux:   ${r.linux}\n\n`
      + '  Es el defecto entero de SCRUM-480: quien commitee ese fichero reescribe el fichero\n'
      + '  completo según el editor que use, y la siguiente rama que lo toque conflicta entera.\n'
      + '  Se arregla en `.gitattributes`, no en la máquina de nadie.');
  }
});

test('SCRUM-480 · 🔴 CALIBRACIÓN: el instrumento sabe decir que NO', () => {
  // Sin esto, el test de arriba pasaría igual si `mismoBlobEnLasDosPlataformas` devolviera
  // siempre `igual: true` — y no habría forma de notarlo.
  const sellado = mismoBlobEnLasDosPlataformas(RAIZ, 'docs/legal/fuentes/aeat-errores.properties');
  assert.equal(sellado.igual, false,
    '🔴 el fichero de la AEAT ha dejado de estar protegido: su regla `-text` existe porque se '
    + 'guarda BYTE A BYTE y su SHA-256 está citado en un documento (SCRUM-201b). Si git le '
    + 'normaliza los saltos, el sello deja de casar.\n\n'
    + '  Y este assert hace doble trabajo: es el control que demuestra que el instrumento PUEDE '
    + 'dar «distintos». Si siempre dijera «iguales», el test de arriba sería decorativo.');
});

test('SCRUM-480 · 🔴 `.gitattributes`: el orden decide, y las reglas selladas van al final', () => {
  // Se colapsan los espacios de alineación: las reglas se escriben en columnas para leerse, y un
  // guard que compare la cadena literal falla por el formato en vez de por el contenido — me pasó
  // aquí mismo, con `*.js     text` frente a `*.js text`.
  const lineas = ATTRS.split(/\r?\n/)
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l && !l.startsWith('#'));
  /** Los atributos declarados para un patrón, o `null` si el patrón no aparece. */
  const atributosDe = (patron) => {
    const l = lineas.find((x) => x.split(' ')[0] === patron);
    return l ? l.split(' ').slice(1) : null;
  };
  assert.equal(lineas[0], '* text=auto',
    `🔴 la primera regla de \`.gitattributes\` es «${lineas[0]}» y tiene que ser \`* text=auto\`.\n\n`
    + '  En `.gitattributes` manda la ÚLTIMA línea que casa. Puesto al final, `* text=auto`\n'
    + '  ANULARÍA las reglas específicas de abajo — incluido el `-text` del fichero de la AEAT,\n'
    + '  cuyo SHA-256 está citado en un documento.');

  const iAuto = lineas.indexOf('* text=auto');
  for (const especifica of [
    '*.sh text eol=lf',
    'scripts/db-push-prod text eol=lf',
    'docs/legal/fuentes/aeat-errores.properties -text',
  ]) {
    const i = lineas.indexOf(especifica);
    assert.ok(i !== -1, `🔴 ha desaparecido la regla «${especifica}» de \`.gitattributes\``);
    assert.ok(i > iAuto, `🔴 la regla «${especifica}» ha quedado ANTES de \`* text=auto\`, que la anula`);
  }

  // El `text` EXPLÍCITO por extensión no es redundante con `text=auto`: es lo que impide que el
  // arreglo se apague solo. Con `auto`, un CR suelto nuevo hace que git dé el fichero por binario
  // y deje de normalizarlo sin decir nada — que es exactamente como llegaron estos nueve aquí.
  for (const ext of ['*.js', '*.ts', '*.mjs', '*.css', '*.html', '*.json', '*.md']) {
    const attrs = atributosDe(ext);
    assert.ok(attrs && attrs.includes('text'),
      `🔴 \`${ext}\` ya no declara \`text\` explícito (declara: ${attrs ? attrs.join(' ') : 'nada'}).\n\n`
      + '  Con solo `text=auto`, el día que vuelva a colarse un `\\r\\r\\n` git clasificará ese\n'
      + '  fichero como BINARIO y dejará de normalizarlo EN SILENCIO — que es exactamente cómo\n'
      + '  llegaron aquí los nueve `.js` de este ticket.');
    // 🔴 Y `eol=lf`, que es lo que gobierna EL DISCO. `text` a secas normaliza lo que se GUARDA;
    // el árbol de trabajo seguiría en CRLF con `autocrlf`, y es el árbol lo que leen los guards.
    assert.ok(attrs.includes('eol=lf'),
      `🔴 \`${ext}\` declara \`text\` pero no \`eol=lf\` (declara: ${attrs.join(' ')}).\n\n`
      + '  Sin `eol=lf` el checkout sigue metiendo `\\r` en el disco, y ahí es donde el CRLF\n'
      + '  CIEGA GUARDS: la fase 2 arregló los blobs y dejó la ceguera intacta. Medido: con\n'
      + '  `*.ts text` el fichero rematerializado sale en CRLF; con `text eol=lf`, en LF.');
  }
  // Y el suelo del propio parseador: si `atributosDe` devolviera siempre algo, el bucle de arriba
  // pasaría con cualquier fichero.
  assert.equal(atributosDe('*.patron-que-no-existe'), null,
    '🔴 el parseador de `.gitattributes` encuentra patrones que no están: no vigila nada.');
});
