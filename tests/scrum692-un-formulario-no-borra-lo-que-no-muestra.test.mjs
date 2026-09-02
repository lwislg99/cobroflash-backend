// tests/scrum692-un-formulario-no-borra-lo-que-no-muestra.test.mjs — SCRUM-692
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// DOS FORMULARIOS EDITAN EL MISMO CLIENTE, Y NINGUNO PUEDE BORRAR LO QUE NO ENSEÑA
//
//   · el MODAL de `customersView.js` — 16 campos
//   · la FICHA 360 de `customerDetailView.js` (`#e360-*`) — 10 campos
//
// Y la asimetría va en LAS DOS DIRECCIONES, medido el 2-sep-2026:
//   sólo en el modal .... internalRef · recargoEquivalencia · los cinco billing*
//   sólo en la ficha .... billingPeriodicity          ← la mitad que se olvida
//
// ── 🔴 HOY NO SE BORRA, PERO ES CIERTO POR ACCIDENTE ─────────────────────────────────────
//
// Medido ejecutando el camino real contra `yaqu_dev_javier`: se guarda desde la ficha 360 y la
// dirección y la referencia SIGUEN ahí. Pero **nadie lo decidió**: es la consecuencia de que
// `customerUpdateSchema` sea un `.partial()` de Zod y de que Prisma no toque lo que no recibe.
// No está declarado en ninguna parte y no lo sujetaba ningún test.
//
// La regresión que este guard existe para impedir **sería MUDA**: alguien normaliza el payload
// «para que todos los campos viajen igual» con `?? null`, y a partir de ese día guardar desde la
// ficha 360 borra la dirección que el profesional escribió en el modal. Sin error, sin aviso, sin
// rojo. Él lo descubre semanas después, al abrir el cliente. Y post-SIF ese dato es el domicilio
// del destinatario de una factura.
//
// ── LA PROPIEDAD, Y POR QUÉ ÉSTA Y NO OTRA ──────────────────────────────────────────────
//
// **Un formulario sólo envía lo que muestra.** Una sola regla que cubre las dos direcciones.
//
// Se descartó «ninguna clave puede ser un literal `null`» porque NO caza la regresión real: un
// `billingAddress: data.customer.billingAddress ?? null` no es un literal, lee una variable — y
// si el `/detail` no trae ese campo, vale `null` y BORRA igual. Lo que hace segura a una clave no
// es su forma: es que detrás haya un control donde el profesional pueda ver y escribir el valor.
//
// Sin gate: lee los dos fuentes por AST. Ni BD, ni red, ni navegador. El viaje completo contra
// base de datos vive en el fichero gateado de al lado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MODAL = 'public/dashboard/js/customersView.js';
const FICHA = 'public/dashboard/js/customerDetailView.js';

/**
 * Las formas en que estos dos formularios LEEN un control. Si una clave del payload no toca
 * ninguna, su valor no viene del profesional: viene de otro sitio, y va a sobrescribir la base.
 */
const LEE_UN_CONTROL = [
  /\$\('#/,                    // ficha 360: $('#e360-…')
  /field\w+\.(input\.)?(value|checked)/, // modal: fieldX.input.value / fieldX.value
  /\.leer\(\)/,                // los switches (forma jurídica, tipo de artículo)
  /telefonoCompleto\(\)/,      // helper del modal que compone prefijo + número
  /direccionParaPayload\(field/, // helper del modal que normaliza cada campo de dirección
];

/** Las claves del objeto `payload`, con la expresión de la que sale cada valor. */
function clavesDelPayload(rel) {
  const src = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  // Las variables locales, para resolver los shorthand (`name,` sale de `const name = $('#…')`).
  const declaraciones = new Map();
  (function walk(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      if (!declaraciones.has(n.name.text)) declaraciones.set(n.name.text, n.initializer.getText());
    }
    n.forEachChild(walk);
  })(sf);

  const claves = [];
  (function walk(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText() === 'payload'
        && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      for (const p of n.initializer.properties) {
        const clave = p.name ? p.name.getText() : null;
        if (!clave) continue;
        let valor = ts.isShorthandPropertyAssignment(p) ? clave : (p.initializer ? p.initializer.getText() : '');
        // Shorthand o identificador suelto: se resuelve a su declaración.
        if (/^\w+$/.test(valor.trim()) && declaraciones.has(valor.trim())) valor = declaraciones.get(valor.trim());
        claves.push({ clave, valor });
      }
    }
    n.forEachChild(walk);
  })(sf);

  // Y las que se añaden después del literal (`if (phone) payload.phone = phone;`).
  for (const m of src.matchAll(/payload\.(\w+)\s*=\s*([^;]+);/g)) {
    let valor = m[2].trim();
    if (/^\w+$/.test(valor) && declaraciones.has(valor)) valor = declaraciones.get(valor);
    claves.push({ clave: m[1], valor });
  }
  return claves;
}

const leeUnControl = (valor) => LEE_UN_CONTROL.some((re) => re.test(valor));

// ═══ ① SUELO ═════════════════════════════════════════════════════════════════════════════
//
// Si el extractor se queda ciego, «ninguna clave envía lo que no muestra» sería cierto sobre un
// conjunto vacío. Y ya me pasó midiendo esto a mano: el censo se dejó `phone`/`email` (van fuera
// del literal) y luego `name` (shorthand sin dos puntos). Lo cazó un suelo, no yo.

test('SCRUM-692 · 🔴 SUELO: el extractor VE los dos payloads, y resuelve los shorthand', () => {
  const modal = clavesDelPayload(MODAL);
  const ficha = clavesDelPayload(FICHA);

  assert.ok(modal.length >= 12,
    `🔴 EXTRACTOR CIEGO: sólo ${modal.length} claves en el payload del modal, y tiene 16.`);
  assert.ok(ficha.length >= 8,
    `🔴 EXTRACTOR CIEGO: sólo ${ficha.length} claves en el de la ficha 360, y tiene 10.`);

  // El suelo que me cazó a mí: `name` va en SHORTHAND en la ficha 360 y fuera del literal en
  // ninguno; si el extractor no lo ve, tampoco vería una clave peligrosa escrita igual.
  for (const [rel, claves] of [[MODAL, modal], [FICHA, ficha]]) {
    assert.ok(claves.some((c) => c.clave === 'name'),
      `🔴 EXTRACTOR CIEGO: no ve «name» en ${rel}. Los dos formularios lo envían.`);
  }
  // Y `phone`, que en la ficha 360 se añade DESPUÉS del literal.
  assert.ok(ficha.some((c) => c.clave === 'phone'),
    '🔴 EXTRACTOR CIEGO: no ve «phone» en la ficha 360, que se añade con `payload.phone = …` ' +
    'fuera del objeto. Una clave peligrosa escrita así se le escaparía igual.');
});

// ═══ ② LA PROPIEDAD ══════════════════════════════════════════════════════════════════════

test('SCRUM-692 · 🔴 el MODAL sólo envía lo que MUESTRA', () => {
  const malas = clavesDelPayload(MODAL).filter((c) => !leeUnControl(c.valor));
  assert.deepEqual(malas.map((c) => `${c.clave} ← ${c.valor.slice(0, 60)}`), [],
    '🔴 EL MODAL ENVÍA CAMPOS QUE NO MUESTRA:\n    ' +
    malas.map((c) => `${c.clave} ← ${c.valor.slice(0, 60)}`).join('\n    ') +
    '\n\n  Un valor que no sale de un control del formulario no lo ha escrito el profesional, y va' +
    '\n  a sobrescribir lo que haya en la base. Si el campo es de la FICHA 360 —hoy sólo' +
    '\n  `billingPeriodicity`— guardarlo aquí borraría lo que él configuró allí, sin aviso.' +
    '\n\n  Si de verdad has AÑADIDO ese campo al modal con su control, añade su forma de lectura a' +
    '\n  `LEE_UN_CONTROL` en este fichero, con su motivo.');
});

test('SCRUM-692 · 🔴 la FICHA 360 sólo envía lo que MUESTRA — la dirección no se toca', () => {
  const malas = clavesDelPayload(FICHA).filter((c) => !leeUnControl(c.valor));
  assert.deepEqual(malas.map((c) => `${c.clave} ← ${c.valor.slice(0, 60)}`), [],
    '🔴 LA FICHA 360 ENVÍA CAMPOS QUE NO MUESTRA:\n    ' +
    malas.map((c) => `${c.clave} ← ${c.valor.slice(0, 60)}`).join('\n    ') +
    '\n\n  Ésta es la regresión que este guard existe para impedir, y sería MUDA: la ficha 360 no' +
    '\n  tiene control para `internalRef`, `recargoEquivalencia` ni los cinco `billing*`. Mandarlos' +
    '\n  desde aquí BORRA lo que el profesional escribió en el modal — sin error, sin aviso, sin' +
    '\n  rojo. Lo descubre semanas después, y post-SIF ese dato es el domicilio del destinatario.' +
    '\n\n  Si has añadido el campo A LA FICHA con su input, añade su lectura a `LEE_UN_CONTROL`.');
});

// ═══ ③ CONTROL POSITIVO — el que descarta «no borra porque no guarda» ════════════════════

test('SCRUM-692 · 🔴 CONTROL POSITIVO: cada formulario SÍ envía lo suyo', () => {
  // Sin esto, un formulario que no mandara NADA pasaría los dos tests de arriba con matrícula de
  // honor. Es el mismo control que hizo válida la medición a mano: descarta «no borra porque no
  // guarda nada».
  const modal = clavesDelPayload(MODAL).map((c) => c.clave);
  const ficha = clavesDelPayload(FICHA).map((c) => c.clave);

  for (const k of ['internalRef', 'billingAddress', 'recargoEquivalencia']) {
    assert.ok(modal.includes(k), `🔴 el modal ha dejado de enviar «${k}»: entonces ya no se puede editar.`);
  }
  assert.ok(ficha.includes('billingPeriodicity'),
    '🔴 la ficha 360 ha dejado de enviar «billingPeriodicity», que es el ÚNICO campo que sólo se ' +
    'edita ahí: nadie podría configurarlo.');
  for (const k of ['name', 'legalName', 'taxId', 'notes']) {
    assert.ok(ficha.includes(k), `🔴 la ficha 360 ha dejado de enviar «${k}».`);
  }
});

// ═══ ④ LA ASIMETRÍA, FIJADA EN LAS DOS DIRECCIONES ══════════════════════════════════════

test('SCRUM-692 · la asimetría medida sigue siendo la que se declaró', () => {
  // Se fija para que crezca CON AVISO: si mañana un campo entra en un formulario y no en el otro,
  // esto cae y alguien tiene que mirar si eso es lo que se quería.
  const modal = new Set(clavesDelPayload(MODAL).map((c) => c.clave));
  const ficha = new Set(clavesDelPayload(FICHA).map((c) => c.clave));

  const soloModal = [...modal].filter((k) => !ficha.has(k)).sort();
  const soloFicha = [...ficha].filter((k) => !modal.has(k)).sort();

  assert.deepEqual(soloModal,
    ['billingAddress', 'billingCity', 'billingCountry', 'billingPostalCode', 'billingProvince',
      'internalRef', 'recargoEquivalencia'],
    '🔴 ha cambiado la lista de campos que SÓLO se editan en el modal:\n    ' + soloModal.join(', ') +
    '\n\n  Si has añadido uno, la ficha 360 no lo muestra: el profesional no podrá editarlo desde ' +
    'ahí. No es un fallo —el guardado es parcial y no se borra— pero tiene que constar.');

  assert.deepEqual(soloFicha, ['billingPeriodicity'],
    '🔴 ha cambiado la lista de campos que SÓLO se editan en la ficha 360:\n    ' + soloFicha.join(', ') +
    '\n\n  Ésta es la mitad que se olvida: la asimetría va en las DOS direcciones.');
});

// ═══ ⑤ EL CASO QUE SE OLVIDA: vaciar A PROPÓSITO sigue siendo posible ═══════════════════

test('SCRUM-692 · 🔴 «parcial» NO significa «ya no se puede borrar nada»', () => {
  // Sin este test, alguien «arreglaría» esto haciendo que un campo vacío no viaje nunca — y
  // entonces el profesional no podría BORRAR un dato que puso mal. El guard le daría verde.
  //
  // La forma que lo permite es `… || null`: el control se lee, y si está vacío manda `null`, que
  // Zod acepta (`.nullable()`) y Prisma escribe. Distinto de `undefined`, que no viaja.
  const vaciables = [
    [MODAL, 'legalName'], [MODAL, 'taxId'], [MODAL, 'internalRef'],
    [FICHA, 'legalName'], [FICHA, 'taxId'],
  ];
  for (const [rel, clave] of vaciables) {
    const c = clavesDelPayload(rel).find((x) => x.clave === clave);
    assert.ok(c, `🔴 ${rel} ya no envía «${clave}».`);
    assert.match(c.valor, /\|\|\s*null|\?\?\s*null/,
      `🔴 «${clave}» en ${rel} ya no puede VACIARSE: su valor no cae a \`null\` cuando el control ` +
      'está vacío. El profesional no podría borrar un dato que puso mal — y «guardado parcial» no ' +
      'puede convertirse en «ya no se puede borrar nada».');
  }

  // Y el contraste: `notes` en la ficha 360 usa `|| undefined` A PROPÓSITO —el schema valida
  // formato y prefiere omitir a mandar cadena vacía—, así que ahí vaciar NO borra. Queda dicho
  // para que no se «arregle» por parecido.
  const notas = clavesDelPayload(FICHA).find((x) => x.clave === 'notes');
  assert.match(notas.valor, /\|\|\s*undefined/,
    '🔴 `notes` en la ficha 360 ha cambiado de `undefined` a otra cosa. Era deliberado: omitir en ' +
    'vez de mandar cadena vacía. Si se cambia, hay que decir por qué.');
});
