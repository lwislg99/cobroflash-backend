// tests/scrum593e-el-albaran-si-es-alcanzable.test.mjs — SCRUM-593 (DOC-03) · fase ③
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// «CONSTRUIDO ≠ ALCANZABLE» — Y AQUÍ SE MIDE LA SEGUNDA MITAD, LA QUE SUELE FALTAR
//
// El resto del ticket demuestra que el texto se guarda, viaja y se imprime. Nada de eso sirve si
// **nadie puede escribirlo**. Este fichero vigila el camino que va del dedo del profesional a la
// petición: el campo se PINTA en el editor del albarán, se LEE con veredicto, y viaja por LAS DOS
// puertas del navegador — la de editar (PATCH) y la de crear (POST).
//
// 🔴 LA CAPA QUE SE OLVIDA. Al montar esto apareció el defecto en su forma más barata: el campo se
// pintaba, se leía bien, se metía en el objeto... y moría en la DESESTRUCTURACIÓN de `onGuardar`,
// que sólo sacaba `{ lineas, notas, modoValoracion }`. Ningún test del editor lo habría visto —el
// editor SÍ lo mandaba—. Por eso aquí se mira el camino ENTERO y no el editor solo.
//
// ── QUÉ NO SE VIGILA AQUÍ, y se dice ─────────────────────────────────────────────────────────
// El PRESUPUESTO. Su formulario vive en `quotesView.js`, que este sprint lo tiene S1 con
// SCRUM-598. Está cableado de punta a punta pero NO montado, y ése es el hueco abierto del ticket.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = 'public/dashboard/js/jobDetailView.js';
const src = fs.readFileSync(path.join(RAIZ, VISTA), 'utf8');

/**
 * El cuerpo del editor del albarán, acotado por sus dos extremos REALES.
 *
 * `box` es un PARÁMETRO de `buildAlbEditor`, no un `const` — buscarlo como declaración dejaba al
 * extractor ciego, y así lo dijo en vez de devolver un trozo cualquiera. El extremo de abajo es
 * `const saveRow`, donde empieza el botón de guardar.
 */
function editorDelAlbaran() {
  // 🔴 SE ANCLA EN ESTRUCTURA, NO EN COPY. La primera versión buscaba el texto literal del
  // placeholder de notas, y el control negativo la cazó: cambiarle un punto a un microcopy dejaba
  // CIEGO al extractor y tumbaba cinco tests con mensajes que no hablaban de copy. Un guard que se
  // rompe cuando alguien retoca una frase manda a buscar el defecto donde no está.
  const desde = src.indexOf('function buildAlbEditor(');
  assert.notEqual(desde, -1, '🔴 CIEGO: no encuentro `buildAlbEditor`. Todo lo de abajo sería decorado.');
  const hasta = src.indexOf('const saveRow', desde);
  assert.ok(hasta !== -1 && hasta > desde, '🔴 CIEGO: no supe acotar el editor.');
  const trozo = src.slice(desde, hasta);
  assert.ok(trozo.length > 500 && trozo.length < 25_000,
    `🔴 CIEGO: el trozo acotado mide ${trozo.length} bytes. Ni el editor entero ni el fichero entero.`);
  return trozo;
}

/**
 * `buildAlbEditor` ENTERA — pintado **y** guardado.
 *
 * Hace falta un segundo acotado y no es duplicación: el que pinta acaba en `const saveRow`, y el
 * lector y las dos peticiones viven DENTRO del manejador del botón, o sea después. Comprobar el
 * viaje con el trozo del pintado habría dado un rojo que se lee como «no se manda» cuando lo que
 * pasa es que no se está mirando.
 */
function editorCompleto() {
  const desde = src.indexOf('function buildAlbEditor(');
  assert.notEqual(desde, -1, '🔴 CIEGO: no encuentro `buildAlbEditor`.');
  const hasta = src.indexOf('\nfunction ', desde + 10);
  assert.notEqual(hasta, -1, '🔴 CIEGO: no encuentro dónde acaba `buildAlbEditor`.');
  const trozo = src.slice(desde, hasta);
  assert.match(trozo, /const saveRow/,
    '🔴 CIEGO: el trozo no llega ni al botón de guardar; el viaje no se estaría mirando.');
  assert.match(trozo, /apiRequest\(/,
    '🔴 CIEGO: el trozo no contiene ninguna petición. No es la función que guarda.');
  return trozo;
}

test('SCRUM-593e · 🔴 SUELO: el fichero y el editor se leen de verdad', () => {
  assert.ok(src.length > 10_000, `🔴 CIEGO: ${VISTA} tiene ${src.length} bytes; no puede ser.`);
  const ed = editorDelAlbaran();
  assert.match(ed, /notas\.className = 'input'/,
    '🔴 el trozo acotado no es el editor del albarán: el resto del fichero no prueba nada.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SE PINTA
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593e · 🔴 el campo de cabecera SE MONTA en el editor del albarán', () => {
  const ed = editorDelAlbaran();
  assert.match(ed, /textoDelDocumentoMontar\(/,
    '🔴 el editor del albarán NO monta el campo. Un texto que se guarda y que nadie puede escribir '
    + 'es el defecto nº 2 de la casa, y este ticket no se cierra con eso dentro.');
  assert.match(ed, /\['docHeaderText'\]/,
    '🔴 no se está pidiendo EXACTAMENTE el campo de cabecera.');
});

test('SCRUM-593e · 🔴 y monta SÓLO la cabecera: el pie del albarán ya existe', () => {
  const ed = editorDelAlbaran();
  assert.equal(/docFooterText/.test(ed), false,
    '🔴 se ha montado un segundo campo de pie en el albarán. Su pie es `notas` —el textarea de '
    + 'debajo, que ya se imprime—: dos campos para lo mismo y mañana nadie sabe cuál manda.');
  // Y el suelo: `notas` SIGUE ahí. Si desapareciera, el pie del documento se habría perdido.
  assert.match(ed, /notas\.value = alb\.notas \|\| ''/,
    '🔴 ha desaparecido el editor de `notas`: ése ES el pie del albarán.');
});

test('SCRUM-593e · el campo se monta ANTES de las notas, como en el papel', () => {
  const ed = editorDelAlbaran();
  assert.ok(ed.indexOf('textoDelDocumentoMontar(') < ed.indexOf("const notas = document.createElement('textarea')"),
    '🔴 la cabecera se ofrece DESPUÉS del bloque final. Un formulario en otro orden que el '
    + 'documento obliga a traducir mentalmente lo que se escribe.');
});

test('SCRUM-593e · 🔴 si la pieza no está cargada, NO se pinta un campo sin rótulo', () => {
  const ed = editorDelAlbaran();
  assert.match(ed, /typeof window\.textoDelDocumentoMontar === 'function'/,
    '🔴 se monta el campo sin comprobar que la pieza está. El rótulo vive en la pieza y sigue sin '
    + 'firmar: un campo sin rótulo es peor que ningún campo (mismo criterio que `lugarEntrega`).');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SE LEE — Y CON VEREDICTO, QUE ES LO QUE EVITA EL BORRADO SILENCIOSO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593e · 🔴 se lee con VEREDICTO, no leyendo el nodo a pelo', () => {
  const ed = editorCompleto();
  assert.match(ed, /textoDelDocumentoLeer\(/,
    '🔴 el editor no usa el lector con veredicto.');
  assert.match(ed, /leidoCab\.ok/,
    '🔴 no se comprueba el veredicto. Un lector mudo devolvería `null` —indistinguible de «lo dejó '
    + 'en blanco»— y guardar BORRARÍA un texto ya escrito.');
  assert.equal(/body\.docHeaderText = .*querySelector/.test(ed), false,
    '🔴 se está leyendo el DOM a pelo, saltándose el suelo de la pieza.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Y VIAJA POR LAS **DOS** PUERTAS DEL NAVEGADOR
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593e · 🔴 viaja en el PATCH (editar)', () => {
  const ed = editorCompleto();
  assert.match(ed, /body\.docHeaderText = leidoCab\.valores\.docHeaderText/,
    '🔴 editar un albarán no manda el texto de cabecera: se escribe y no se guarda.');
});

test('SCRUM-593e · 🔴 viaja en el POST (crear) — la capa que se olvidó al montarlo', () => {
  const ed = editorCompleto();
  assert.match(ed, /docHeaderText: leidoCab\.valores\.docHeaderText/,
    '🔴 el editor no se lo pasa a `onGuardar`, que es quien hace el POST al crear.');

  // Y la OTRA MITAD: que quien recibe no lo tire en la desestructuración. Es donde murió al
  // montarlo la primera vez, y el editor daba verde igual porque el editor SÍ lo mandaba.
  const i = src.indexOf('onGuardar: async ({');
  assert.notEqual(i, -1, '🔴 CIEGO: no encuentro el receptor de `onGuardar`.');
  // 🔴 RE-ANCLADO el 4-sep-2026 (SCRUM-607), y no es cosmética: el recorte era `i + 900`, o sea
  // una VENTANA DE BYTES. Al meter otro campo en el mismo receptor —el interruptor de los precios
  // del albarán— el `cuerpo.docHeaderText` se salió de los 900 y este guard se puso rojo sin que
  // nada de lo que vigila hubiera cambiado. Referenciar por POSICIÓN caduca; por IDENTIDAD no
  // (SCRUM-710). Ahora el recorte va del receptor a su CIERRE, así que crece con él.
  const fin = src.indexOf('\n      },', i);
  assert.notEqual(fin, -1, '🔴 CIEGO: no encuentro el final del receptor de `onGuardar`.');
  const receptor = src.slice(i, fin);
  assert.ok(receptor.length > 300,
    `🔴 CIEGO: el receptor recortado mide ${receptor.length} caracteres. Con tan poco, cualquier `
    + '«no está» de abajo sería cierto por falta de texto donde mirar.');
  assert.match(receptor, /onGuardar: async \(\{[^}]*docHeaderText[^}]*\}\)/,
    '🔴 el receptor de `onGuardar` NO desestructura `docHeaderText`: el campo se pinta, se lee, se '
    + 'manda... y muere aquí, en silencio. Es «construido ≠ alcanzable» una capa más abajo.');
  assert.match(receptor, /cuerpo\.docHeaderText = docHeaderText/,
    '🔴 lo desestructura pero no lo mete en el cuerpo del POST.');
  assert.match(receptor, /docHeaderText !== undefined/,
    '🔴 se manda siempre, incluso cuando no se pudo leer. `undefined` tiene que significar «no '
    + 'toques la columna», no «guárdala vacía».');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL ALCANCE REAL DEL TICKET, VIGILADO — para que no se lea después como si entregara los tres
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593e · 🔴 el PRESUPUESTO sigue SIN montar, y la entrada de máster lo DICE', () => {
  const quotes = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesView.js'), 'utf8');
  const montado = /textoDelDocumentoMontar|docHeaderText/.test(quotes);

  const entrada = fs.readFileSync(path.join(RAIZ, 'docs/master/SCRUM-593.md'), 'utf8');
  assert.match(entrada, /ALBAR[ÁA]N.*cabecera montada y alcanzable/i,
    '🔴 la entrada de máster no declara que el albarán SÍ está montado.');

  if (montado) {
    // Cuando S1 libere `quotesView.js` y alguien lo monte, este test recuerda actualizar el
    // alcance escrito — un hueco que se cierra y sigue declarado abierto también miente.
    assert.match(entrada, /PRESUPUESTO.*montad/i,
      '🔴 el presupuesto YA está montado pero la entrada sigue diciendo que no. Actualízala.');
  } else {
    assert.match(entrada, /PRESUPUESTO.*NO montado/i,
      '🔴 el presupuesto no está montado y la entrada no lo dice. Un ticket que entrega un tercio '
      + 'y no lo escribe se lee después como si hubiera entregado los tres.');
  }
  assert.match(entrada, /FACTURA.*fuera.*SCRUM-665/i,
    '🔴 la entrada no declara que la factura queda fuera, ni por qué.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL VIAJE DE VUELTA: el serializador es una lista BLANCA
//
// Lo que no se nombra ahí NO LLEGA al navegador. Sin esta línea el campo se guardaba y el
// formulario salía siempre vacío — y entonces la siguiente edición lo guardaba en blanco: el texto
// no se pierde al leerlo, se pierde al VOLVER A GUARDAR. Se cazó mirando el serializador; ningún
// test del editor lo habría visto.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593e · 🔴 el serializador DEVUELVE el campo, o el formulario sale siempre vacío', () => {
  const svc = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/domain/albaran.service.ts'), 'utf8');
  const i = svc.indexOf('export function serializeAlbaran');
  assert.notEqual(i, -1, '🔴 CIEGO: no encuentro `serializeAlbaran`.');
  const cuerpo = svc.slice(i, svc.indexOf('\n}', i));

  // SUELO: que el trozo es el serializador y no otra cosa.
  assert.match(cuerpo, /notas: a\.notas/,
    '🔴 CIEGO: el trozo no contiene `notas`, así que no es el serializador del albarán.');

  assert.match(cuerpo, /docHeaderText: a\.docHeaderText/,
    '🔴 `serializeAlbaran` no devuelve `docHeaderText`. Es una lista BLANCA: lo que no nombra no '
    + 'llega al navegador, el formulario sale vacío aunque esté guardado, y la siguiente edición '
    + 'lo guarda en blanco. El texto no se pierde al leerlo: se pierde al volver a guardar.');
});
