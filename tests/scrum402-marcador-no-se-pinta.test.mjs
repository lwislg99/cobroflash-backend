// tests/scrum402-marcador-no-se-pinta.test.mjs — SCRUM-402
//
// QUE UN `[PENDIENTE …]` EXISTA Y QUE UN `[PENDIENTE …]` SE PINTE SON DOS PROPIEDADES, Y HOY SOLO
// SE VIGILABA UNA.
//
// Los guards de microcopy de la casa (SCRUM-283, SCRUM-302) comprueban que **el marcador esté**
// mientras no haya texto aprobado — impiden que alguien se invente una frase. Correcto y necesario.
// Pero eso no dice **nada** sobre si ese marcador llega a la pantalla de un profesional. Y llega:
// SCRUM-402 nació de un botón rotulado literalmente `[PENDIENTE microcopy oficial]` que era la
// acción PRIMARIA de las facturas `pending`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTO ES UN TRINQUETE Y NO UNA PROHIBICIÓN, y hay que decirlo
//
// La propiedad que se querría —«ningún marcador se pinta»— **está violada en 36 sitios hoy**
// (medido, ver `CENSO`). Un guard que la exigiera nacería ROJO y lo apagaría alguien en una hora:
// es el defecto que `docs/METODO_YAQU.md` llama un guard que da rojo en falso.
//
// Así que se vigila lo que sí se puede sostener **desde hoy**: que el número **no suba**. Cada
// marcador nuevo que llegue a un literal cae en rojo NOMBRANDO su fichero. Y cuando el fundador
// apruebe un texto, el número baja y hay que actualizarlo aquí — un trinquete que solo aprieta.
//
// Es la forma del guard de contraste de SCRUM-368: la excepción declara CUÁNTOS nodos ampara, y
// falla si gana o pierde. Una excepción que sobrevive a su causa deja de ser una nota y pasa a ser
// un permiso.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA DISTINCIÓN QUE HACE ÚTIL AL GUARD: literal ≠ comentario
//
// Un marcador dentro de un COMENTARIO no llega a ninguna pantalla, y hacerlo caer sería cobrar un
// impuesto sobre la claridad del código — la lección entera de SCRUM-349. Por eso el censo se hace
// **por AST**: los comentarios no son nodos de literal, así que quedan fuera por CONSTRUCCIÓN, no
// por una lista de excepciones. Medido: 56 marcadores en el árbol, **36 en literales** y 20 en
// comentarios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// CommonJS con doble vida (script clásico + module.exports): se importa por defecto.
import registro from '../public/dashboard/js/invoiceActionsRegistry.js';
const { INVOICE_ACTION_REGISTRY, destinoEfectivo } = registro;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');
const MARCA = '[PENDIENTE';

/**
 * CENSO MEDIDO el 7-ago-2026. Números por fichero, no un total: mover un marcador de una pantalla
 * a otra tiene que verse, y un total lo escondería (la lección del suelo por FUNCIÓN de SCRUM-392).
 */
const CENSO = Object.freeze({
  // SCRUM-404 (7-ago-2026) · SUBIDAS A CONCIENCIA, las dos, y con su motivo:
  //
  //   `albaranDetailView.js` +1 → el mensaje de «el servidor rechazó la firma». El fundador
  //   aprobó su texto CON UNA CONDICIÓN: que el profesional tuviera una forma visible de
  //   avisarnos. **Medido: no la tiene.** El único contacto es `hola@yaqu.app` y solo aparece en
  //   `privacidad.html` y `terminos.html`; el botón «?» del panel es la GUÍA DE INICIO
  //   (`tutorial.js:189-201`), no un canal. Así que la frase prometía algo que no existe y se
  //   devolvió: sale con marcador hasta que el fundador fije un texto que no lo prometa.
  //
  //   `signaturePad.js` +1 → el respaldo de cuando el error llega sin mensaje. No estaba entre
  //   los textos aprobados y NO se inventa uno (regla 30).
  //
  // Los otros DOS de SCRUM-404 sí se escribieron, porque sí estaban aprobados: «No se ha podido
  // conectar…» y «No se ha recogido el trazo…». Por eso esto sube 2 y no 4.
  'albaranDetailView.js': 1,
  'signaturePad.js': 1,
  // SCRUM-405 (+1, 7-ago-2026, A CONCIENCIA): el mensaje de «esto no es tu fichero». Vive en la
  // forma común y no en la vista PORQUE LO USAN DOS —`exportView` y `reportsView`—, y en scripts
  // clásicos una constante duplicada en dos ficheros es SyntaxError en parseo. Es el único
  // marcador de `api.js` y sale por `showToast`, así que sí se pinta: cuenta.
  'api.js': 1,
  // SCRUM-285 (+1, 10-ago-2026, A CONCIENCIA): la pantalla de Cobros nace con UN marcador
  // —`COBROS_MARCA`— y lo pinta en varios sitios: título de la pantalla, cabeceras de la tabla,
  // estado vacío, el rótulo del filtro «sin método registrado» y la etiqueta de los días de deuda.
  //
  // Sube a conciencia y el motivo es el de siempre, invertido: el diseño §B4 solo NOMBRA dos cosas
  // —el menú «Cobros» y los cuatro métodos «Bizum · tarjeta · transferencia · efectivo»—, y ésos
  // se escriben literales porque están aprobados. Todo lo demás de esta pantalla es redacción
  // nueva que NADIE ha aprobado, y la alternativa a marcarla no era escribirla: era no entregar
  // la pantalla. Un marcador visible es feo y honesto; un texto inventado es bonito y falso.
  //
  // Baja a 0 —o sea, esta línea se borra— cuando el asesor apruebe la lista de microcopy que va
  // con la entrega.
  'cobrosView.js': 1,
  // SCRUM-405 (−4, 7-ago-2026): al pasar las tres descargas por la forma común desaparecieron
  // cuatro ramas de error que pintaban marcador. El trinquete APRIETA: 15 → 11.
  // 11 → 5 el 10-ago-2026: SCRUM-244 trajo los ocho textos APROBADOS de la card de portabilidad
  // y del diálogo de descarga. Los 5 que quedan son de la card del LIBRO DE EMITIDAS (SCRUM-325),
  // que nació en `main` después de esa aprobación: nadie ha aprobado su copy todavía.
  'exportView.js': 5,
  'invoiceDetailView.js': 9,
  'invoicesView.js': 2,
  'jobDetailView.js': 1,
  // SCRUM-424 (−1, 10-ago-2026): `jobRailBlocks.js` SALE del censo. Su único marcador era el
  // rótulo del enlace a mapa del bloque DÓNDE, y el asesor aprobó «Abrir en mapa» (regla 30). El
  // trinquete APRIETA: la entrada se borra en vez de bajar a 0 — `censoActual()` solo lista
  // ficheros con marcadores, así que un 0 escrito aquí sería una bajada permanente sin anotar.
  'libroRegistroView.js': 1,
  'nuevaFacturaModal.js': 1,
  'patronDetalleAcciones.js': 1,
  'productsView.js': 1,
  'quotesView.js': 1,
  'semaforoFiscal.js': 1,
  'settingsSubmenus.js': 1,
  'settingsView.js': 1,
});

/** Marcadores que viven en un LITERAL (los que pueden pintarse). Los comentarios no son literales. */
function marcadoresEnLiterales(codigo, nombre) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const hallados = [];
  const v = (n) => {
    const trozos = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
      ? [n]
      : ts.isTemplateExpression(n) ? [n.head, ...n.templateSpans.map((s) => s.literal)] : [];
    if (trozos.some((t) => t.text.includes(MARCA))) {
      hallados.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return hallados;
}

function censoActual() {
  const out = {};
  for (const f of fs.readdirSync(DIR_JS).filter((n) => n.endsWith('.js'))) {
    const n = marcadoresEnLiterales(fs.readFileSync(path.join(DIR_JS, f), 'utf8'), f).length;
    if (n > 0) out[f] = n;
  }
  return out;
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-402 · R6 · SUELO: el escáner encuentra la ranura `btnBizum` y el corpus', () => {
  // Si el escáner se queda ciego, «cero marcadores» y «no supe mirar» dan el mismo verde — y este
  // guard pasaría para siempre sobre una pantalla llena de marcadores.
  const ficheros = fs.readdirSync(DIR_JS).filter((n) => n.endsWith('.js'));
  assert.ok(ficheros.length >= 20, `🔴 ESCÁNER CIEGO: solo veo ${ficheros.length} vistas en ${DIR_JS}`);

  const vista = fs.readFileSync(path.join(DIR_JS, 'invoiceDetailView.js'), 'utf8');
  assert.match(vista, /const btnBizum = document\.createElement/,
    '🔴 ESCÁNER CIEGO: no encuentro la ranura `btnBizum` en invoiceDetailView.js. O se renombró, o ' +
    'se movió — en los dos casos los tests de abajo dejarían de vigilar el botón y saldrían verdes ' +
    'por no encontrar nada. ARREGLA EL ESCÁNER, no el número.');

  const total = Object.values(censoActual()).reduce((a, b) => a + b, 0);
  assert.ok(total > 0, '🔴 ESCÁNER CIEGO: cero marcadores en literales. Imposible: hay 36 medidos.');
});

// ── R1/R2/R3 · EL BOTÓN Y SU RANURA ─────────────────────────────────────────────────────────

const CTX = (bizum, charge = true) => ({
  hayCharge: charge,
  'bizum-disponible': charge && bizum,
  'bizum-no-disponible': !(charge && bizum),
});
const primariaDe = (ctx) => INVOICE_ACTION_REGISTRY
  .filter((a) => destinoEfectivo(a, 'pending', ctx) === 'primaria')
  .map((a) => a.id);

test('SCRUM-402 · 🔴 R1: con BIZUM_MANUAL_ENABLED=false el botón NO se pinta', () => {
  assert.deepEqual(primariaDe(CTX(false)).filter((id) => id === 'btnBizum'), [],
    '🔴 con Bizum APAGADO se sigue pintando `btnBizum` como primaria de `pending`. Es el defecto ' +
    'entero: acción primaria que, tras enseñar importe y nombre del cliente, devuelve 409 ' +
    '`bizum_disabled`.');

  // Y la mitad que lo hace real: la VISTA mira la bandera, no solo el dato. Sin esto, el registro
  // podría estar bien y el botón crearse igual.
  const vista = fs.readFileSync(path.join(DIR_JS, 'invoiceDetailView.js'), 'utf8');
  assert.match(vista, /if \(invoice\.chargeId && window\.appBizumManualEnabled\)/,
    '🔴 la vista vuelve a crear el botón mirando solo `invoice.chargeId`. El registro decide DÓNDE ' +
    'va, pero si el botón se crea igual, se pinta igual.');
});

test('SCRUM-402 · 🔴 R2 · CONTROL POSITIVO: con la bandera ENCENDIDA el botón vuelve a ser primaria', () => {
  // Probar solo el bloqueo no demuestra que no se haya bloqueado todo.
  assert.deepEqual(primariaDe(CTX(true)), ['btnBizum'],
    `🔴 con Bizum ENCENDIDO la primaria de pending es [${primariaDe(CTX(true))}] y debería ser btnBizum: ` +
    'el arreglo ha apagado el botón también cuando SÍ puede funcionar.');
});

test('SCRUM-402 · 🔴 R3: la ranura NUNCA queda vacía — hay primaria en los tres contextos', () => {
  for (const [nombre, ctx] of [
    ['bizum ON · con cobro', CTX(true)],
    ['bizum OFF · con cobro', CTX(false)],
    ['sin cobro en vuelo', CTX(false, false)],
  ]) {
    const p = primariaDe(ctx);
    assert.equal(p.length, 1,
      `🔴 en «${nombre}» la primaria de pending tiene ${p.length} ocupantes ([${p}]). Cero es un ` +
      'callejón sin salida —el estado se queda sin siguiente paso, que es lo que C2 vino a quitar—; ' +
      'dos rompe la regla 1.');
  }
  assert.deepEqual(primariaDe(CTX(false)), ['btnTogglePaid'],
    '🔴 con Bizum apagado la primaria no es `btnTogglePaid`. Se eligió ÉSE porque funciona y su ' +
    'texto ya está aprobado: cualquier otro generaría microcopy nueva (regla 30).');
});

// ── R4/R5 · EL TRINQUETE DEL MARCADOR ───────────────────────────────────────────────────────

test('SCRUM-402 · 🔴 R4: el censo de marcadores PINTABLES no sube, y el rojo nombra el fichero', () => {
  const actual = censoActual();
  const subidas = [];
  const nuevos = [];
  for (const [f, n] of Object.entries(actual)) {
    if (!(f in CENSO)) nuevos.push(`${f} (+${n})`);
    else if (n > CENSO[f]) subidas.push(`${f}: ${CENSO[f]} → ${n}`);
  }
  assert.deepEqual([...nuevos, ...subidas], [],
    `🔴 HAY MARCADORES NUEVOS QUE PUEDEN PINTARSE:\n    ${[...nuevos, ...subidas].join('\n    ')}\n\n` +
    '  Un `[PENDIENTE …]` en un literal acaba en la pantalla de un profesional. Si el texto ya está\n' +
    '  aprobado, escríbelo; si no, esa superficie no se pinta todavía. Y si de verdad tiene que\n' +
    '  salir con marcador, súbelo a `CENSO` A CONCIENCIA y di por qué en el commit.');

  // La otra mitad del trinquete: si BAJA, hay que anotarlo — o el censo envejece y deja de apretar.
  const bajadas = Object.entries(CENSO)
    .filter(([f, n]) => (actual[f] ?? 0) < n)
    .map(([f, n]) => `${f}: ${n} → ${actual[f] ?? 0}`);
  assert.deepEqual(bajadas, [],
    `🔴 el censo BAJÓ (enhorabuena) y no se ha actualizado:\n    ${bajadas.join('\n    ')}\n\n` +
    '  Actualiza `CENSO`. Un trinquete que no se aprieta cuando puede deja de ser un trinquete.');
});

test('SCRUM-402 · 🔴 R4b: un fichero que SALE del censo NO sale de la vigilancia', () => {
  // Lo pregunta el asesor al aprobar SCRUM-424, y con razón: `jobRailBlocks.js` se borró de
  // `CENSO` al aprobarse su rótulo. Si el trinquete solo mirase los ficheros que ya conoce, salir
  // de la lista sería salir del radar — la misma forma que el guard de destino que deja pasar la
  // clave que no conoce (SCRUM-418).
  //
  // NO los tiene: `censoActual()` ENUMERA el directorio y cualquier fichero con marcadores que no
  // esté en `CENSO` cae por la rama `nuevos`. Se comprueba con el mecanismo, no de palabra.
  const actual = censoActual();
  assert.ok(
    !('jobRailBlocks.js' in CENSO),
    '🔴 el fixture de este test ya no vale: `jobRailBlocks.js` volvió a `CENSO`, así que esto no ' +
      'estaría probando el caso de un fichero FUERA de la lista.',
  );
  assert.ok(
    !('jobRailBlocks.js' in actual),
    '🔴 `jobRailBlocks.js` tiene marcadores otra vez y R4 ya debería estar en rojo.',
  );

  // La comprobación de verdad: se simula un fichero desconocido CON marcador y se mira que la
  // regla de R4 lo clasifique como `nuevo`. Es la misma expresión que usa R4, sin tocar el disco.
  const inventado = { ...actual, 'ficheroQueNadieCensó.js': 1 };
  const nuevos = Object.keys(inventado).filter((f) => !(f in CENSO));
  assert.deepEqual(
    nuevos, ['ficheroQueNadieCensó.js'],
    '🔴 EL TRINQUETE SOLO VIGILA LO QUE YA CONOCE: un fichero con marcadores que no esté en `CENSO` ' +
      'no se detecta. Entonces borrar una entrada —lo correcto cuando se aprueba un texto— sacaría ' +
      'ese fichero de la vigilancia para siempre, y el siguiente marcador entraría en verde.',
  );
});

test('SCRUM-402 · 🔴 R5: un marcador en un COMENTARIO no lo pone rojo', () => {
  // Sin esto el guard vigilaría la PALABRA y no el hecho, y acabaría desactivado por molesto —
  // exactamente lo que le pasó al trinquete de copy antes de SCRUM-349.
  const conComentario = `// aquí NO se puede escribir ${MARCA} microcopy oficial] todavía\nconst a = 1;\n`;
  assert.deepEqual(marcadoresEnLiterales(conComentario, 'x.js'), [],
    '🔴 un marcador dentro de un comentario cae. Un comentario no llega a ninguna pantalla, y ' +
    'obligar a redactarlo esquivando las palabras que explica es cobrar un impuesto sobre la ' +
    'claridad del código (SCRUM-349).');

  const enBloque = `/**\n * El rótulo va con ${MARCA} microcopy oficial] hasta que lo apruebe el fundador.\n */\nconst b = 2;\n`;
  assert.deepEqual(marcadoresEnLiterales(enBloque, 'x.js'), [], '🔴 el comentario de bloque también cae');

  // Y el CONTROL, que es lo que impide que este test pase por ceguera: el MISMO texto en un
  // literal SÍ tiene que detectarse.
  const enLiteral = `el.textContent = '${MARCA} microcopy oficial]';\n`;
  assert.equal(marcadoresEnLiterales(enLiteral, 'x.js').length, 1,
    '🔴 el mismo texto en un LITERAL tampoco se detecta: el escáner no ve nada y R4 sería un verde ' +
    'vacío.');
});
