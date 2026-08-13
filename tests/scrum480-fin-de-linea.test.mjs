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
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censoEol, censoArbolDeTrabajo, mismoBlobEnLasDosPlataformas, clasificarBlob, CR_PERMITIDO,
} from './_censo-eol.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ATTRS = fs.readFileSync(path.join(RAIZ, '.gitattributes'), 'utf8');

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

test('SCRUM-480 · 🔴 el ÁRBOL DE TRABAJO no tiene ni un `\\r` — es lo que leen los guards', () => {
  // Un guard no abre el repositorio: hace `readFileSync` del disco. Y `core.autocrlf=true` mete
  // `\r` al hacer checkout en ficheros cuyo blob lleva en LF desde siempre, así que arreglar los
  // blobs (fase 2) NO quitaba ni un `\r` de lo que un guard lee. Lo quita `eol=lf`, y esto lo
  // comprueba por EFECTO: si mañana cambia una regla o alguien clona con otra configuración, cae.
  const r = censoArbolDeTrabajo(RAIZ);
  const ofensores = r.conCR.filter((f) => !CR_PERMITIDO[f.ruta]);

  assert.deepEqual(ofensores.map((f) => f.ruta).slice(0, 25), [],
    `🔴 HAY ${ofensores.length} FICHEROS DE TEXTO CON \`\\r\` EN EL DISCO (de ${r.textos} leídos):\n`
    + ofensores.slice(0, 25).map((f) => `   · ${f.ruta}`).join('\n')
    + (ofensores.length > 25 ? `\n   … y ${ofensores.length - 25} más` : '') + '\n\n'
    + '  Esto NO es cosmética: CIEGA GUARDS EN SILENCIO. `linea.replace(/\\/\\/.*$/, \'\')` sobre\n'
    + '  una línea que arrastra `\\r` no hace NADA —sin `m`, `$` exige fin de cadena y el `\\r`\n'
    + '  está en medio—, así que un guard que promete «miro el código, no los comentarios» acaba\n'
    + '  mirando también los comentarios. Le pasó al de SCRUM-409 durante semanas, y solo en\n'
    + '  Windows: en el CI, que es Linux, pasaba en verde.\n\n'
    + '  Se arregla con `eol=lf` en `.gitattributes` y un `git checkout` que rematerialice.');
});

test('SCRUM-480 · SUELO: el censo del disco LEE de verdad, y sabría ver un `\\r`', () => {
  const r = censoArbolDeTrabajo(RAIZ);
  assert.ok(r.leidos > 1000,
    `🔴 solo se han leído ${r.leidos} ficheros del disco: el verde de arriba no significaría nada.`);
  assert.ok(r.textos > 500, `🔴 solo ${r.textos} clasificados como texto en disco`);
  // Y que el clasificador SEPA acusar, con un búfer fabricado a propósito.
  assert.equal(clasificarBlob(Buffer.from('a\r\nb\n', 'latin1')).crlf, 1,
    '🔴 el clasificador no ve un CRLF que le doy en la mano: no puede acusar a nadie.');
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
