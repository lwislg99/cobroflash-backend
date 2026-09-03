// tests/scrum593b-superficie-texto-del-documento.test.mjs — SCRUM-593 (DOC-03) · la SUPERFICIE
//
// Medido en el PASO 0: **no existía ninguna superficie** para estos dos campos — cero apariciones
// en todo el dashboard. Así que esto no era «darle superficie a un motor», era construir la puerta.
//
// Aquí se vigila la pieza de pantalla. El PDF lo cubre `scrum593-cabecera-y-pie-del-documento`,
// que lee el documento de verdad con `lineasDePdf`.
//
// ⚠️ LO QUE ESTE FICHERO **NO** PUEDE DECIR: que el formulario del presupuesto los muestre. El
// cableado al formulario y al servidor va en el MISMO PR que el esquema —la casa no admite ② ALTER
// después de ③ PR—, y las columnas todavía no existen. Queda declarado, no disimulado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// SCRUM-694: el scanner de TypeScript, no un filtro por lineas.
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const MARCA = '[PENDIENTE microcopy oficial]';
// Los DOS rótulos del FORMULARIO, firmados por el fundador el 2-sep-2026.
const ROTULO_CABECERA = 'Añadir texto en el documento';
const ROTULO_PIE = 'Observaciones';

/** Un `document` mínimo: nodos con lo justo que usa el módulo. Sin librerías (regla 36). */
function domDeMentira() {
  const crear = (tag) => ({
    tag,
    hijos: [],
    style: {},
    atributos: {},
    className: '',
    textContent: '',
    value: '',
    setAttribute(k, v) { this.atributos[k] = v; },
    appendChild(n) { this.hijos.push(n); return n; },
    // Sólo la forma `#id`, que es la única que usa la pieza. Un selector de juguete que
    // aceptara más de lo que se usa daría por probado un camino que nadie recorre.
    querySelector(sel) {
      const id = String(sel).replace(/^#/, '');
      const buscar = (n) => {
        if (n.id === id) return n;
        for (const h of n.hijos) { const r = buscar(h); if (r) return r; }
        return null;
      };
      for (const h of this.hijos) { const r = buscar(h); if (r) return r; }
      return null;
    },
  });
  return { createElement: crear };
}

/** Un contenedor vacío del mismo DOM de mentira, para montar dentro. */
function contenedorDe(doc) { return doc.createElement('div'); }

/** Carga el módulo como lo haría el navegador: colgándolo de `window`. */
function cargar() {
  const win = {};
  const doc = domDeMentira();
  const fuente = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/textoDelDocumento.js'), 'utf8');
  new Function('window', 'document', fuente)(win, doc);
  win.__doc = doc;
  return win;
}

test('SCRUM-593b · 🔴 SUELO: el módulo carga y expone sus piezas', () => {
  const w = cargar();
  for (const n of ['TD_CAMPOS', 'textoDelDocumentoCampo', 'textoDelDocumentoPintado', 'textoDelDocumentoPayload']) {
    assert.ok(w[n], `🔴 no expone ${n}: nada de lo de abajo probaría nada.`);
  }
  assert.equal(w.TD_CAMPOS.length, 2, '🔴 no son los dos campos del ticket.');
  assert.deepEqual(w.TD_CAMPOS.map((c) => c.clave), ['docHeaderText', 'docFooterText']);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// MICROCOPY: uno firmado, el otro no. Y no se confunden.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593b · 🔴 el bloque final dice «Observaciones» y NO lleva marcador', () => {
  const w = cargar();
  const pie = w.TD_CAMPOS.find((c) => c.clave === 'docFooterText');
  assert.equal(pie.rotulo, ROTULO_PIE,
    `🔴 el rótulo aprobado por el fundador (2-sep-2026) ha cambiado: «${pie.rotulo}».`);
  assert.equal(pie.rotulo.includes(MARCA), false,
    '🔴 se ha marcado texto APROBADO. Marcar de más obliga al fundador a refirmar lo que ya firmó.');
  assert.equal(pie.sinFirmar, false, '🔴 el pie figura como sin firmar y está aprobado.');
});

// ⚠️ ESTE TEST SE INVIRTIÓ EL 2-sep-2026. Exigía que el rótulo de la cabecera saliera con
// MARCADOR, porque no estaba firmado. Ese mismo día el fundador lo firmó: «Añadir texto en el
// documento», y de paso decidió que en el PDF ese bloque no lleva rótulo. La premisa caducó por
// una decisión legítima, así que el test no se borra: afirma lo contrario y sigue pudiendo fallar.
test('SCRUM-593b · 🔴 el rótulo de la CABECERA es el APROBADO, y no se confunde con el otro', () => {
  const w = cargar();
  const cab = w.TD_CAMPOS.find((c) => c.clave === 'docHeaderText');
  assert.equal(cab.rotulo, ROTULO_CABECERA,
    `🔴 el rótulo aprobado por el fundador (2-sep-2026) ha cambiado: «${cab.rotulo}».`);
  assert.equal(cab.rotulo.includes(MARCA), false,
    '🔴 se ha marcado texto APROBADO: marcar de más obliga al fundador a refirmar lo que ya firmó.');
  assert.equal(cab.sinFirmar, false, '🔴 la cabecera figura como sin firmar y SÍ está aprobada.');
  // CONTROL NEGATIVO del anterior: los dos rótulos son DISTINTOS. Si alguien «dedujera» el de la
  // cabecera de «Observaciones», este test lo cazaría.
  const pie = w.TD_CAMPOS.find((c) => c.clave === 'docFooterText');
  assert.notEqual(cab.rotulo, pie.rotulo, '🔴 los dos campos comparten rótulo.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CANAL PANTALLA DE SCRUM-655: los saltos se respetan
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593b · 🔴 lo pintado respeta los saltos: `pre-line`, no colapsado', () => {
  const w = cargar();
  const nodo = w.textoDelDocumentoPintado('UNO\nDOS\nTRES');
  assert.equal(nodo.style.whiteSpace, 'pre-line',
    `🔴 sin \`pre-line\` el navegador colapsa los saltos y ocho líneas se leen como un párrafo: `
    + `es el MISMO texto y una cosa distinta. Salió «${nodo.style.whiteSpace}».`);
  assert.equal(nodo.textContent, 'UNO\nDOS\nTRES',
    '🔴 se han perdido o normalizado los saltos ANTES de pintarlos.');
  // CONTROL NEGATIVO: `pre` conservaría también los espacios y NO envolvería — una línea larga se
  // saldría de la caja. No es lo mismo y no vale.
  assert.notEqual(nodo.style.whiteSpace, 'pre', '🔴 `pre` no envuelve: el texto largo se sale.');
});

test('SCRUM-593b · 🔴 el texto del profesional NUNCA se concatena en markup', () => {
  // Se pinta con `textContent` y se edita con `.value`. Con `innerHTML`, un `</textarea>` o un
  // `<script>` escritos en el campo serían una inyección con el nombre del profesional encima.
  // 🔴 Se mira SÓLO EL CÓDIGO. Este guard se cazó a sí mismo en la primera pasada: el comentario
  // del módulo dice «Nunca `innerHTML`», y un buscador por texto no distingue la prohibición de la
  // infracción. Es la lección de SCRUM-349 —no cobrar un impuesto sobre la claridad del código—,
  // y volvió a morder aquí.
  // SCRUM-694 · el filtro por líneas se sustituye por el scanner de TypeScript. Y la variable pasa
  // a llamarse `codigo`: `soloCodigo` es ahora la FUNCIÓN importada, y llamar igual al resultado y
  // a la herramienta es justo como se confunden las dos preguntas que ese módulo separa.
  const codigo = soloCodigo(
    fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/textoDelDocumento.js'), 'utf8'));
  assert.equal(/innerHTML/.test(codigo), false, '🔴 el módulo ha empezado a usar `innerHTML`.');
  // SUELO del recorte: si el filtro se quedara vacío, el cero de arriba no significaría nada.
  assert.ok(codigo.includes('textContent'), '🔴 el recorte de comentarios se ha comido el código.');
  const w = cargar();
  const veneno = 'antes</textarea><script>alert(1)</script>después';
  assert.equal(w.textoDelDocumentoPintado(veneno).textContent, veneno,
    '🔴 el texto se altera al pintarlo.');
  const campo = w.textoDelDocumentoCampo(w.TD_CAMPOS[0], veneno);
  const area = campo.hijos.find((h) => h.tag === 'textarea');
  assert.equal(area.value, veneno, '🔴 el editor no conserva el texto tal cual.');
});

test('SCRUM-593b · el editor conserva los saltos que escribió el profesional', () => {
  const w = cargar();
  const campo = w.textoDelDocumentoCampo(w.TD_CAMPOS[1], 'A\nB');
  const area = campo.hijos.find((h) => h.tag === 'textarea');
  assert.equal(area.value, 'A\nB', '🔴 el `<textarea>` recorta o normaliza los saltos.');
  const etiqueta = campo.hijos.find((h) => h.tag === 'label');
  assert.equal(etiqueta.textContent, 'Observaciones', '🔴 el rótulo del campo no es el aprobado.');
  assert.equal(etiqueta.atributos.for, 'campo-docFooterText', '🔴 la etiqueta no apunta a su campo.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE VIAJA AL SERVIDOR
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593b · 🔴 vacío es `null` («no se escribió»), no cadena vacía', () => {
  const w = cargar();
  assert.deepEqual(w.textoDelDocumentoPayload({}), { docHeaderText: null, docFooterText: null });
  assert.deepEqual(w.textoDelDocumentoPayload({ docHeaderText: '   ', docFooterText: '' }),
    { docHeaderText: null, docFooterText: null },
    '🔴 unos espacios se guardan como si el profesional hubiera escrito algo.');
  // CONTROL NEGATIVO: lo que SÍ tiene contenido viaja ENTERO, con sus saltos y sin recortar.
  const con = w.textoDelDocumentoPayload({ docHeaderText: ' A\nB ', docFooterText: 'x' });
  assert.equal(con.docHeaderText, ' A\nB ',
    '🔴 se está recortando el texto del profesional. El `trim` sólo decide si hay algo, no lo que se guarda.');
  assert.equal(con.docFooterText, 'x');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL CAMINO DE VUELTA · se escribe, se relee, y sale igual
//
// Es la mitad del viaje que SÍ se puede probar hoy: la otra mitad —se guarda y sale en el PDF—
// necesita las columnas y el cableado, que van en la fase ③. Se dice, no se disimula.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593b · montar deja LOS DOS campos, en su orden', () => {
  const w = cargar();
  const caja = contenedorDe(w.__doc);
  const r = w.textoDelDocumentoMontar(caja, {});
  assert.equal(r, caja, '🔴 no devuelve el contenedor que se le dio.');
  assert.equal(caja.hijos.length, 2, `🔴 no ha montado los dos campos: ${caja.hijos.length}`);
  const ids = caja.hijos.map((h) => h.hijos.find((x) => x.tag === 'textarea').id);
  assert.deepEqual(ids, ['campo-docHeaderText', 'campo-docFooterText'],
    '🔴 no están los dos, o no en el orden del documento (cabecera primero, pie después).');
});

test('SCRUM-593b · 🔴 SE ESCRIBE Y SE RELEE: el texto vuelve ENTERO, con sus saltos', () => {
  const w = cargar();
  const caja = contenedorDe(w.__doc);
  w.textoDelDocumentoMontar(caja, {});
  const ESCRITO = 'Primera línea\nSegunda línea\n\nCuarta tras un hueco';
  caja.querySelector('#campo-docFooterText').value = ESCRITO;
  caja.querySelector('#campo-docHeaderText').value = 'AVISO';

  const leido = w.textoDelDocumentoLeer(caja);
  assert.equal(leido.ok, true, `🔴 no supo leer: ${leido.motivo}`);
  assert.equal(leido.valores.docFooterText, ESCRITO,
    '🔴 el texto no vuelve idéntico: los saltos son DATO y aquí se han perdido o normalizado.');
  assert.equal(leido.valores.docHeaderText, 'AVISO');
});

test('SCRUM-593b · lo que se monta con valor se relee con ESE valor', () => {
  const w = cargar();
  const caja = contenedorDe(w.__doc);
  w.textoDelDocumentoMontar(caja, { docHeaderText: 'A\nB', docFooterText: 'C' });
  const leido = w.textoDelDocumentoLeer(caja);
  assert.equal(leido.ok, true);
  assert.equal(leido.valores.docHeaderText, 'A\nB', '🔴 el valor guardado no llega al campo.');
  assert.equal(leido.valores.docFooterText, 'C');
});

test('SCRUM-593b · en blanco se relee como `null`, no como cadena vacía', () => {
  const w = cargar();
  const caja = contenedorDe(w.__doc);
  w.textoDelDocumentoMontar(caja, {});
  caja.querySelector('#campo-docFooterText').value = '   ';
  const leido = w.textoDelDocumentoLeer(caja);
  assert.equal(leido.ok, true);
  assert.deepEqual(leido.valores, { docHeaderText: null, docFooterText: null },
    '🔴 «no se escribió» tiene que ser null; una cadena vacía diría que se escribió algo vacío.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SUELO DEL LECTOR: un lector CIEGO no puede parecer un formulario en blanco
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593b · 🔴 SUELO: sin los campos montados, LEER dice que está ciego', () => {
  const w = cargar();
  const vacio = contenedorDe(w.__doc);   // nada montado dentro
  const leido = w.textoDelDocumentoLeer(vacio);

  // Si esto devolviera {null, null} sería indistinguible de «el profesional los dejó en blanco»,
  // y esa confusión BORRA un texto ya guardado en cuanto alguien edite desde una pantalla que no
  // monte los campos. Es el defecto que este suelo existe para impedir.
  assert.equal(leido.ok, false, '🔴 dice haber leído un formulario donde no hay campos.');
  assert.equal(leido.valores, null, '🔴 devuelve valores que no ha leído de ninguna parte.');
  assert.deepEqual(leido.faltan, ['docHeaderText', 'docFooterText'],
    '🔴 no NOMBRA los que faltan: un fallo que no dice cuál es no es accionable.');
});

test('SCRUM-593b · 🔴 SUELO: con UNO SOLO montado tampoco da por leído el otro', () => {
  const w = cargar();
  const caja = contenedorDe(w.__doc);
  // Se monta a mano SOLO la cabecera: es justo el error que `montar` existe para evitar.
  caja.appendChild(w.textoDelDocumentoCampo(w.TD_CAMPOS[0], 'algo'));
  const leido = w.textoDelDocumentoLeer(caja);
  assert.equal(leido.ok, false, '🔴 con medio formulario dice haber leído el formulario entero.');
  assert.deepEqual(leido.faltan, ['docFooterText'], '🔴 no nombra el que falta.');
});

test('SCRUM-593b · 🔴 CONTROL NEGATIVO del suelo: con los dos montados NO se declara ciego', () => {
  // Sin esto, los rojos de arriba también saldrían si `leer` fallara siempre.
  const w = cargar();
  const caja = contenedorDe(w.__doc);
  w.textoDelDocumentoMontar(caja, {});
  assert.equal(w.textoDelDocumentoLeer(caja).ok, true,
    '🔴 se declara ciego con el formulario entero delante: entonces sus «no supe» no significan nada.');
  // Y una raíz que ni siquiera sabe buscar tiene su propio motivo, distinto de «faltan campos».
  assert.equal(w.textoDelDocumentoLeer(null).motivo, 'sin-raiz');
  assert.equal(w.textoDelDocumentoLeer({}).motivo, 'sin-raiz');
});

test('SCRUM-593b · 🔴 SUELO: montar en algo que no es contenedor devuelve null, no revienta', () => {
  const w = cargar();
  assert.equal(w.textoDelDocumentoMontar(null, {}), null);
  assert.equal(w.textoDelDocumentoMontar({}, {}), null);
});
