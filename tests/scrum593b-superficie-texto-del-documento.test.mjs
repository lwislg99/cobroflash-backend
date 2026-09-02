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

const RAIZ = path.resolve(import.meta.dirname, '..');
const MARCA = '[PENDIENTE microcopy oficial]';

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
  });
  return { createElement: crear };
}

/** Carga el módulo como lo haría el navegador: colgándolo de `window`. */
function cargar() {
  const win = {};
  const fuente = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/textoDelDocumento.js'), 'utf8');
  new Function('window', 'document', fuente)(win, domDeMentira());
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
  assert.equal(pie.rotulo, 'Observaciones',
    `🔴 el rótulo aprobado por el fundador (2-sep-2026) ha cambiado: «${pie.rotulo}».`);
  assert.equal(pie.rotulo.includes(MARCA), false,
    '🔴 se ha marcado texto APROBADO. Marcar de más obliga al fundador a refirmar lo que ya firmó.');
  assert.equal(pie.sinFirmar, false, '🔴 el pie figura como sin firmar y está aprobado.');
});

test('SCRUM-593b · 🔴 el rótulo de la CABECERA sigue con marcador, y no se deriva del otro', () => {
  const w = cargar();
  const cab = w.TD_CAMPOS.find((c) => c.clave === 'docHeaderText');
  assert.equal(cab.rotulo, MARCA,
    `🔴 el rótulo de la cabecera se ha escrito sin que el fundador lo firme: «${cab.rotulo}».`);
  assert.equal(cab.sinFirmar, true, '🔴 la cabecera figura como firmada y no lo está.');
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
  const soloCodigo = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/textoDelDocumento.js'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => { const t = l.trimStart(); return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*'); })
    .map((l) => l.replace(/\s*\/\/.*$/, ''))
    .join('\n');
  assert.equal(/innerHTML/.test(soloCodigo), false, '🔴 el módulo ha empezado a usar `innerHTML`.');
  // SUELO del recorte: si `soloCodigo` se quedara vacío, el cero de arriba no significaría nada.
  assert.ok(soloCodigo.includes('textContent'), '🔴 el recorte de comentarios se ha comido el código.');
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
