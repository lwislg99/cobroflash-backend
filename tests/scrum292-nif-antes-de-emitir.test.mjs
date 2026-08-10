// SCRUM-292 (A1) · PEDIR EL NIF ANTES DE EMITIR.
//
// Sin gate: el módulo de revisión es puro y se importa; la puerta y los rótulos se leen del código
// por AST. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, MEDIDO — Y NO ES EL QUE EL TICKET DESCRIBÍA
//
// El ticket decía «el producto PREGUNTA en vez de PROPONER: trece opciones en un desplegable».
// Medido: **ese desplegable no existe** (el `<select>` más grande del dashboard tiene 3 opciones) y
// el tipo de factura **no lo elige nadie** — se deriva dentro del camino de emisión.
//
// El defecto real es el contrario, y es mudo: **una factura sin NIF se emite, se envía y se cobra,
// y queda FUERA del registro.** En pantalla es idéntica a una registrada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const VISTA_TXT = leer('public/dashboard/js/jobDetailView.js');
const VISTA = soloEjecutable(VISTA_TXT, { almohadillaEsComentario: false });
const A1 = require_(path.join(RAIZ, 'public/dashboard/js/facturaPreEmision.js'));

// Merchant de id REAL. `isDemoMerchant` es `id === 1`, y con el demo la puerta de la regla 24 no se
// ejercita en ningún caso: los diez casos de otra sesión corrieron así y no probaron nada.
const MERCHANT_REAL = 7;

const cliente = (extra = {}) => ({ id: 42, merchantId: MERCHANT_REAL, name: 'Francisco Jiménez', ...extra });

// ── EL CONTROL NEGATIVO, QUE ES EL TEST ─────────────────────────────────────────────────

test('SCRUM-292 · sin NIF NO se emite sin que el profesional haya visto la pregunta', () => {
  const rev = A1.revisionPreEmision(cliente({ taxId: null }));
  assert.equal(rev.faltaNif, true, '🔴 un cliente sin NIF no se detecta: la puerta no llegaría a abrirse');
  assert.equal(rev.estado, 'falta-nif');
  assert.equal(
    A1.hayQuePreguntarAntesDeEmitir(cliente({ taxId: null })), true,
    '🔴 no se pregunta antes de emitir. La factura saldría, se enviaría y se cobraría — y quedaría ' +
      'fuera del registro sin que nadie se entere, que es el defecto entero.',
  );

  // Y una cadena vacía o de espacios NO es un NIF. Tratarla como tal es el camino corto a emitir
  // exactamente el documento que este ticket existe para evitar.
  for (const vacio of ['', '   ', null, undefined]) {
    assert.equal(
      A1.revisionPreEmision(cliente({ taxId: vacio })).faltaNif, true,
      `🔴 taxId=${JSON.stringify(vacio)} cuela como NIF válido`,
    );
  }

  // La puerta existe en el código y para de verdad: sin NIF, `return` antes de llamar a la emisión.
  assert.ok(
    /if \(revisionInicial\.faltaNif\) \{[\s\S]{0,600}?if \(!nif\) \{[\s\S]{0,200}?return;/.test(VISTA),
    '🔴 la puerta no corta: sin NIF y sin respuesta, la ejecución sigue hasta emitir.',
  );
});

// ── EL CONTROL POSITIVO, QUE ES LO QUE MÁS PUEDE ROMPERSE ───────────────────────────────

test('SCRUM-292 · CON NIF la emisión sigue EXACTAMENTE igual: sin pregunta y sin fricción', () => {
  // Meter una puerta en el camino que hoy funciona es lo que más puede romper esta tarea.
  const rev = A1.revisionPreEmision(cliente({ taxId: 'B12345678' }));
  assert.equal(rev.faltaNif, false, '🔴 se pregunta el NIF a un cliente que YA lo tiene');
  assert.equal(rev.estado, 'completo');
  assert.equal(rev.decidible, true, '🔴 con NIF la decisión debería poder tomarse');
  assert.equal(
    A1.hayQuePreguntarAntesDeEmitir(cliente({ taxId: 'B12345678' })), false,
    '🔴 la puerta se dispara con NIF: se habría metido fricción en el camino que hoy funciona.',
  );

  // Y en el código: todo lo que la puerta hace vive DENTRO de `if (revisionInicial.faltaNif)`. Si
  // algo quedara fuera, se ejecutaría también para quien sí tiene NIF.
  //
  // ⚠️ EL RECORTE SE ANCLA EN CÓDIGO EJECUTABLE, NO EN UN COMENTARIO. La primera versión buscaba
  // `// ── LA PUERTA` sobre `VISTA`, que es el fichero SIN comentarios: el extremo no existía,
  // `indexOf` daba -1 y `slice(i, -1)` se habría tragado medio fichero. Es el fallo de los dos
  // extremos, y por eso los dos se comprueban.
  // ⚠️ `if (revisionInicial.faltaNif)` aparece DOS veces —una pinta la caja, otra es la puerta— y
  // el `indexOf` cogía la primera: el recorte medía el bloque de pintado, no la puerta. Se ancla en
  // lo que solo existe dentro de la puerta.
  const i = VISTA.indexOf("const campo = document.getElementById('preemision-nif')");
  assert.ok(i > 0, '🔴 ESCÁNER CIEGO: no se encuentra la puerta. ¿Se renombró el campo del NIF?');
  const j = VISTA.indexOf('if (lineas.length < todas.length', i);
  assert.ok(
    j > i,
    '🔴 ESCÁNER CIEGO: no se encuentra el FINAL del recorte. Sin los dos extremos, `slice` mide ' +
      'hasta el final del fichero y el test comprueba código que no es el suyo.',
  );
  const puerta = VISTA.slice(i, j);
  assert.ok(
    puerta.length > 150 && puerta.length < 3000,
    `🔴 ESCÁNER CIEGO: el recorte mide ${puerta.length} caracteres — no es el bloque de la puerta.`,
  );
  assert.ok(
    /apiRequest\(`\/admin\/customers\//.test(puerta),
    '🔴 la escritura del NIF no está en la puerta: o se movió fuera del `if (faltaNif)` —y correría ' +
      'también con NIF— o el recorte mide otra cosa.',
  );
  // Y que la puerta entera vive DENTRO del `if (faltaNif)`: se cuenta desde la apertura del `if`
  // de la puerta, que es la ÚLTIMA de las dos.
  const aperturaPuerta = VISTA.lastIndexOf('if (revisionInicial.faltaNif) {');
  assert.ok(
    aperturaPuerta > 0 && aperturaPuerta < i,
    '🔴 la puerta NO está guardada por `faltaNif`: el campo del NIF se lee fuera del `if`, así que ' +
      'correría también para quien ya tiene NIF.',
  );
});

// ── EL SUELO ────────────────────────────────────────────────────────────────────────────

test('SCRUM-292 · SUELO: el detector distingue de verdad, no dice que sí a todo', () => {
  // «Ninguna sin NIF» y «no supe mirar» son el mismo número. El detector tiene que separar los dos
  // grupos, no responder siempre lo mismo.
  const conNif = [cliente({ taxId: 'B12345678' }), cliente({ taxId: '12345678Z' })];
  const sinNif = [cliente({ taxId: null }), cliente({ taxId: '' }), cliente({})];

  const faltan = [...conNif, ...sinNif].filter((c) => A1.revisionPreEmision(c).faltaNif).length;
  assert.equal(
    faltan, sinNif.length,
    `🔴 ESCÁNER CIEGO: el detector marca ${faltan} de ${conNif.length + sinNif.length} y deberían ` +
      `ser ${sinNif.length}. Si marca todos o ninguno, no está mirando el NIF.`,
  );
  assert.ok(A1.REVISION_ESTADOS.length >= 2, '🔴 ESCÁNER CIEGO: la lista de estados está vacía');
});

test('SCRUM-292 · sin NIF NO se propone un tipo «por si acaso»', () => {
  // Proponer por defecto es adivinar con buena letra. Sin NIF el esquema admite DOS salidas y cuál
  // procede lo decide el dictamen (P11), no el código — así que aquí tampoco.
  const rev = A1.revisionPreEmision(cliente({ taxId: null }));
  assert.equal(
    rev.decidible, false,
    '🔴 se da por decidible un caso que no lo es: el siguiente paso sería proponer un tipo, y un ' +
      'ClaveRegimen adivinado es una declaración falsa.',
  );
  // Y el módulo no devuelve ningún tipo: no es su trabajo.
  assert.ok(!('tipo' in rev) && !('tipoFactura' in rev), '🔴 el módulo propone un tipo de factura');
});

// ── NO SE TOCA EL CAMINO DE EMISIÓN (regla 38) ──────────────────────────────────────────

test('SCRUM-292 · la derivación del tipo se queda donde estaba, intacta', () => {
  const builder = leer('src/modules/fiscal/verifactu/registro.builder.ts');
  assert.match(builder, /export const MODO_SIN_DESTINATARIO: ModoSinDestinatario = 'SIN_DICTAMEN';/,
    '🔴 el modo activo ha cambiado. La rama SIMPLIFICADA_F2 sigue APAGADA esperando el dictamen ' +
    'P11: encenderla no es de este ticket (regla 24: se construye, no se enciende).');
  assert.match(builder, /export function resolverSinDestinatario\(/,
    '🔴 ESCÁNER CIEGO: la derivación ya no está donde este guard la busca.');

  // Y el módulo de A1 no la copia, no la reimplementa y no la nombra.
  const mod = soloEjecutable(leer('public/dashboard/js/facturaPreEmision.js'), { almohadillaEsComentario: false });
  for (const prohibido of ['F1', 'F2', 'R1', 'JUST', 'resolverSinDestinatario', 'ClaveRegimen']) {
    assert.ok(
      !mod.includes(prohibido),
      `🔴 el módulo de A1 menciona «${prohibido}»: está reimplementando en el front una derivación ` +
        'que vive en el camino de emisión. Dos sitios decidiendo el tipo fiscal es peor que uno mal.',
    );
  }
});

// ── LA TRAMPA NUEVA: EL GUARD CIEGO ANTE UNA EXPRESIÓN ──────────────────────────────────
//
// Al hacer que un rótulo dependiera de un ternario, el guard de microcopy de A0.3 pasó en VERDE —
// no porque el texto estuviera aprobado, sino porque **dejó de ver nada**. Un guard que inspecciona
// literales se queda ciego en cuanto el valor pasa a ser una expresión.
//
// Por eso este censo se hace por AST y **recorre las dos ramas del ternario**, no el literal suelto.

/** Todos los textos que la caja de revisión puede llegar a pintar, por AST y por TODAS las ramas. */
function rotulosDeLaRevision() {
  const sf = ts.createSourceFile('v.js', VISTA_TXT, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const rotulos = [];
  let asignaciones = 0;

  const ramas = (n) => {
    // Un ternario NO es un valor: son DOS. Se abren los dos lados, y recursivamente, porque
    // `a ? x : (b ? y : z)` tiene tres.
    if (ts.isConditionalExpression(n)) return [...ramas(n.whenTrue), ...ramas(n.whenFalse)];
    if (ts.isParenthesizedExpression(n)) return ramas(n.expression);
    // `a || b` es otra forma de dos valores.
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      return [...ramas(n.left), ...ramas(n.right)];
    }
    return [n];
  };

  const visita = (n) => {
    if (
      ts.isBinaryExpression(n)
      && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && /\.(textContent|innerHTML)$/.test(n.left.getText(sf))
      // Solo los rótulos de la CAJA DE REVISIÓN. `err.textContent` lo usa también el código
      // PREEXISTENTE con copy ya aprobado («Indica qué cantidad…», «No se pudo emitir la
      // factura.»), y meterlo aquí hacía que este guard reclamara textos que no son de este
      // ticket — un rojo por código ajeno es un rojo que alguien silencia.
      // Los `err` de la puerta se comprueban aparte, dentro de su propio recorte.
      && /^(linea|lbl)\b/.test(n.left.getText(sf))
    ) {
      asignaciones++;
      for (const r of ramas(n.right)) rotulos.push(r.getText(sf));
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return { rotulos, asignaciones };
}

test('SCRUM-292 · el censo de rótulos RECORRE LAS DOS RAMAS del ternario (con suelo)', () => {
  const { rotulos, asignaciones } = rotulosDeLaRevision();

  // SUELO: si el censo no ve asignaciones, todo lo de abajo pasa por vacío — que es exactamente
  // cómo el guard de A0.3 se puso verde sin comprobar nada.
  assert.ok(
    asignaciones >= 2,
    `🔴 ESCÁNER CIEGO: el censo ve ${asignaciones} asignaciones de rótulo y hay al menos 2. Un ` +
      'censo que no encuentra nada aprueba todo.',
  );
  // Y que de verdad ha abierto un ternario: más valores que asignaciones.
  assert.ok(
    rotulos.length > asignaciones,
    `🔴 ESCÁNER CIEGO: ${rotulos.length} valores para ${asignaciones} asignaciones — el censo NO ha ` +
      'abierto ningún ternario. Es la trampa exacta: al pasar el rótulo a una expresión, un guard ' +
      'de literales deja de ver el texto y pasa en verde.',
  );
});

test('SCRUM-292 · REGLA 30: todos los rótulos nuevos salen con marcador, en TODAS las ramas', () => {
  const { rotulos } = rotulosDeLaRevision();
  const inventados = rotulos.filter((r) => !/^MARCA_A1$/.test(r.trim()));
  assert.deepEqual(
    inventados, [],
    '🔴 HAY TEXTO INVENTADO EN UNA RAMA DE LA REVISIÓN: ' + inventados.join(' · ') + '\n\n' +
      '  El microcopy de esta pantalla está sin aprobar (regla 30) y, además, cualquier frase sobre\n' +
      '  el registro está sujeta a la regla 26: esa pregunta se responde SOLO con el guion H2. Un\n' +
      '  texto que explica mal una obligación fiscal no es feo: es peligroso.',
  );
  assert.ok(rotulos.length >= 3, `🔴 ESCÁNER CIEGO: solo ${rotulos.length} rótulos censados`);
});

test('SCRUM-292 · REGLA 26: ni una palabra sobre el registro, VeriFactu, la AEAT o el calendario', () => {
  // Mismo cuidado que arriba: extremos EJECUTABLES y los dos comprobados. Anclar en un comentario
  // sobre el texto sin comentarios da -1, y `slice(i, -1)` mide medio fichero — que fue justo lo
  // que puso este test en rojo la primera vez, por código que no es de este ticket.
  const i = VISTA.indexOf('const MARCA_A1');
  assert.ok(i > 0, '🔴 ESCÁNER CIEGO: no se encuentra `MARCA_A1`');
  const j = VISTA.indexOf('const todas = inputs.map', i);
  assert.ok(j > i, '🔴 ESCÁNER CIEGO: no se encuentra el FINAL del bloque de la revisión');
  const bloque = VISTA.slice(i, j);
  assert.ok(
    bloque.length > 400 && bloque.length < 4000,
    `🔴 ESCÁNER CIEGO: el recorte mide ${bloque.length} caracteres — no es el bloque de la revisión.`,
  );

  for (const prohibida of ['VeriFactu', 'AEAT', 'Hacienda', 'registro fiscal', 'obligatorio desde']) {
    assert.ok(
      !new RegExp(prohibida, 'i').test(bloque),
      `🔴 el código de la revisión escribe «${prohibida}» en algo que el usuario puede leer. La ` +
        'pregunta de VeriFactu se responde SOLO con el guion H2 (regla 26).',
    );
  }
});

// ── LA PROCEDENCIA Y EL DATO ────────────────────────────────────────────────────────────

test('SCRUM-292 · el marcador lleva PROCEDENCIA, no una fecha suelta', () => {
  const conProcedencia = (VISTA_TXT.match(/procedencia: SCRUM-292/gi) || []).length;
  assert.ok(
    conProcedencia >= 3,
    `🔴 solo ${conProcedencia} marcadores declaran su procedencia. El guard de SCRUM-387 la exige: ` +
      'un SCRUM-<n> o un docs/ en el mismo bloque; una fecha sola no vale.',
  );
});

test('SCRUM-292 · el NIF se guarda por la ruta que YA existe, no por una nueva', () => {
  assert.ok(
    // `clienteA1`, no `job.customer`: SCRUM-386 sacó esta hoja del ámbito de la vista y su guard
    // exige que no capture nada de `renderJobDetailView`. El cliente entra por `ctx`.
    /apiRequest\(`\/admin\/customers\/\$\{clienteA1\.id\}`, \{\s*method: 'PATCH', body: JSON\.stringify\(\{ taxId: nif \}\)/.test(VISTA),
    '🔴 el NIF no se guarda con el PATCH de cliente que ya existe: se habría abierto un camino de ' +
      'escritura nuevo para un campo que ya se edita desde la ficha y desde el alta.',
  );
  // Y que el backend lo sigue admitiendo (`taxId` en el esquema de edición) y lo manda al front.
  assert.match(leer('src/core/validation/schemas.ts'), /taxId: z\.string\(\)\.max\(20\)\.nullable\(\)\.optional\(\)/,
    '🔴 el esquema ya no admite `taxId`: el PATCH de arriba fallaría en validación.');
  assert.match(leer('src/modules/jobs/app/routes/jobs.routes.ts'), /taxId: c\?\.taxId \?\? null/,
    '🔴 el serializer del Trabajo no manda `taxId`: la revisión no podría saber si falta.');
});

test('SCRUM-292 · P11 queda planteada en el documento del asesor, con su cita', () => {
  const doc = leer('docs/legal/PREGUNTAS_ASESOR.md');
  assert.match(doc, /## P11\. Factura SIN identificación del destinatario/,
    '🔴 la pregunta P11 no está planteada: la rama apagada se quedaría esperando algo que nadie preguntó.');
  assert.match(doc, /FacturaSinIdentifDestinatarioArt61d/, '🔴 falta la cita literal del código');
  assert.match(doc, /FacturaSimplificadaArt7273/, '🔴 falta la otra salida del esquema');
  assert.match(doc, /SIMPLIFICADA_F2` sigue \*\*apagada\*\*/, '🔴 no consta que hay una rama apagada esperándola');
});
