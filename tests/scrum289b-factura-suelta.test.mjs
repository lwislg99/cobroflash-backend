// tests/scrum289b-factura-suelta.test.mjs — SCRUM-289 (A0.3) · el entrypoint de la factura suelta.
//
// Sin gate: AST sobre la ruta + funciones puras del dominio. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ HAY AQUÍ UN GUARD DE TENENCIA QUE PARECE DUPLICAR A SCRUM-243
//
// Porque SCRUM-243 NO cubre esta ruta, y no es una sospecha: está medido quitando el filtro y
// mirando qué pasa.
//
//   estado del `where` de `customer.findFirst`   │  cubo         │  sinRed
//   ─────────────────────────────────────────────┼───────────────┼─────────
//   con `merchantId: req.merchantId`             │  'filtra'     │  false
//   SIN `merchantId`                             │  'sin-filtro' │  false   ← sigue en false
//
// El analizador de 243 **sí ve** que el filtro desaparece —el cubo cambia—, pero su test asierta
// sobre `sinRed`, y ese se queda en `false` porque el handler menciona `req.merchantId` en OTRO
// sitio: la carga del merchant para resolver el modo de emisión. O sea que quitar la comprobación
// de tenencia de esta ruta deja la suite ENTERA en verde.
//
// Es el límite nº 2 que SCRUM-243 declara en su propia cabecera («que la función mencione
// `merchantId` no demuestra que lo use en ESA consulta»), honestamente escrito, y que aquí se
// vuelve caro: el patrón «cargar el merchant al principio del handler para decidir un gate» es
// justo lo que hace `getEmissionMode`, y va a estar en toda ruta que dependa de si el merchant
// emite factura o justificante. Cada handler que lo adopte le regala la red a sus lecturas
// posteriores — el guard no se rompe, se vuelve más permisivo A MEDIDA QUE EL CÓDIGO MEJORA.
//
// Eso NO se arregla aquí (otro carril, regla 9): tiene su ticket, **SCRUM-348**. Lo que se hace
// aquí es no dejar esta ruta a la intemperie mientras tanto. Si algún día 243 pasa a asertar por
// cubo, este guard será redundante de verdad y se podrá quitar — con su medición, no por parecerlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTAS = path.join(RAIZ, 'src', 'modules', 'system', 'app', 'routes', 'invoicesAdmin.routes.ts');
const FUENTE = fs.readFileSync(RUTAS, 'utf8');
const ARBOL = ts.createSourceFile(RUTAS, FUENTE, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const MODAL = path.join(RAIZ, 'public', 'dashboard', 'js', 'nuevaFacturaModal.js');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'invoicesView.js');

const PENDIENTE = '[PENDIENTE microcopy oficial]';

const {
  puedeCrearFacturaSuelta, validarFacturaSuelta,
  ERROR_MODO_SIN_FACTURA, ERROR_CLIENTE_INVALIDO, ERROR_LINEAS_INVALIDAS,
} = await import('../dist/modules/invoicing/domain/facturaSuelta.js');

/** El nodo del handler de una ruta, por método y path. AST: un comentario no es un nodo. */
function handlerDe(metodo, rutaPath) {
  let encontrado = null;
  const visitar = (n) => {
    if (ts.isCallExpression(n)
      && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === metodo
      && n.arguments.length
      && ts.isStringLiteral(n.arguments[0])
      && n.arguments[0].text === rutaPath) {
      encontrado = n;
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(ARBOL, visitar);
  return encontrado;
}

const textoDe = (n) => FUENTE.slice(n.getStart(ARBOL), n.getEnd());

/** Llamadas `x.<modelo>.<metodo>(...)` dentro de un nodo. */
function consultasEn(nodo, modelo) {
  const out = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && ts.isPropertyAccessExpression(n.expression.expression)
      && n.expression.expression.name.text === modelo) {
      out.push({ metodo: n.expression.name.text, nodo: n });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(nodo);
  return out;
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-289b · SUELO: el extractor encuentra el entrypoint', () => {
  assert.ok(handlerDe('post', '/'),
    '🔴 ESCÁNER CIEGO: no encuentro `router.post("/", …)` en invoicesAdmin.routes.ts. Todos los ' +
    'guards de abajo mirarían un nodo vacío y saldrían verdes sin haber comprobado nada.');
});

// ── EL GATE ──────────────────────────────────────────────────────────────────────────────

test('SCRUM-289b · el gate es el MODO, no el flag: los tres modos y el no-ES', () => {
  // 'receipt' — ES real sin el flag: NO.
  assert.equal(puedeCrearFacturaSuelta({ id: 9, email: 'pro@x.es', country: 'ES', flags: null }), false,
    '🔴 un merchant ES real sin el flag NO emite factura: el botón no puede existir ahí.');
  // 'fiscal' por país — el caso que un gate por `isFlagEnabled` habría roto.
  assert.equal(puedeCrearFacturaSuelta({ id: 9, email: 'pro@x.fr', country: 'FR', flags: null }), true,
    '🔴 EL BUG DE LA VECINA: un merchant no-ES emite factura fiscal SIEMPRE. `INVOICING_ES_ENABLED` ' +
    'es ES-only, así que gatear por el flag le habría quitado el botón teniendo derecho a él.');
  // 'demo' — también es factura (con marca de agua), regla 8.
  assert.equal(puedeCrearFacturaSuelta({ id: 1, email: 'demo@yaqu.app', country: 'ES', flags: null }), true,
    '🔴 el merchant demo emite FACTURA completa con marca de agua: entra.');
  // 'fiscal' por flag de merchant — ES con el flag ON (post SIF-1).
  assert.equal(puedeCrearFacturaSuelta({ id: 9, email: 'pro@x.es', country: 'ES', flags: { INVOICING_ES_ENABLED: true } }), true);
  // Sin merchant no se adivina.
  assert.equal(puedeCrearFacturaSuelta(null), false, '🔴 sin merchant hay que fallar cerrado.');
});

test('SCRUM-289b · ROJO POR EL MECANISMO: con el gate cerrado la ruta responde 4xx NOMBRADO', () => {
  // Un 500 no prueba nada: quien lo reciba no puede distinguir «aquí no toca» de «se ha roto algo».
  const h = textoDe(handlerDe('post', '/'));
  assert.match(h, /if\s*\(\s*!puedeCrearFacturaSuelta\s*\(/,
    '🔴 el handler no gatea con `puedeCrearFacturaSuelta`. Si usa otra condición, el back podría ' +
    'aceptar lo que el front esconde: dos copias del criterio es exactamente cómo se llega a eso.');
  const gate = h.slice(h.indexOf('!puedeCrearFacturaSuelta'));
  const status = gate.match(/res\.status\((\d{3})\)/);
  assert.ok(status, '🔴 el gate no responde con un status explícito');
  assert.equal(status[1], '409', '🔴 el gate tiene que responder 409, no 500 ni 200');
  assert.match(gate.slice(0, 400), new RegExp(`error:\\s*${ERROR_MODO_SIN_FACTURA}|ERROR_MODO_SIN_FACTURA`),
    '🔴 el 409 tiene que llevar el error NOMBRADO. Un status sin nombre obliga a adivinar.');
});

// ── TENENCIA (regla 2) — el guard cuyo motivo está medido en la cabecera ──────────────────

test('SCRUM-289b · TENENCIA: el cliente se busca SIEMPRE acotado a req.merchantId', () => {
  const h = handlerDe('post', '/');
  const lecturas = consultasEn(h, 'customer');
  assert.ok(lecturas.length > 0,
    '🔴 el handler no lee el cliente. Sin esa lectura no hay nada que acotar — y emitiría una ' +
    'factura a un customerId que no ha comprobado que sea suyo.');
  for (const l of lecturas) {
    const txt = textoDe(l.nodo);
    assert.match(txt, /merchantId:\s*req\.merchantId/,
      '🔴 LECTURA DE CLIENTE SIN ACOTAR AL MERCHANT (regla 2):\n    ' + txt.slice(0, 200) +
      '\n\n  Con un id ajeno se emitiría una factura a nombre del cliente de otro merchant, y una\n' +
      '  factura emitida NO se borra (regla 29): el daño no se deshace con un commit.\n\n' +
      '  Y ojo: SCRUM-243 NO caza esto aquí. Medido — quitando el filtro, su `cubo` pasa a\n' +
      '  «sin-filtro» pero `sinRed` sigue en `false` porque el handler menciona `req.merchantId`\n' +
      '  en otro sitio (la carga del merchant para el gate). Ver la cabecera y SCRUM-348.');
  }
});

// ── REGLA 29 ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-289b · REGLA 29: el entrypoint SOLO da de alta — ni edita ni borra', () => {
  const h = handlerDe('post', '/');
  for (const modelo of ['invoice']) {
    for (const c of consultasEn(h, modelo)) {
      assert.ok(!/^(update|updateMany|delete|deleteMany|upsert)$/.test(c.metodo),
        `🔴 el entrypoint de la factura suelta llama a ${modelo}.${c.metodo}. Una factura emitida ` +
        'NO se edita ni se borra (regla 29): se rectifica con R1 o se anula con registro, y esos ' +
        'caminos ya existen (`/:id/rectify`, `/:id/annul`). Que el alta pueda además modificar es ' +
        'cómo esa puerta se abre sin que nadie lo decida.');
    }
  }
  // Y la ruta raíz no admite otros verbos: `PATCH /admin/invoices` no debe existir.
  for (const verbo of ['patch', 'put', 'delete']) {
    assert.equal(handlerDe(verbo, '/'), null,
      `🔴 existe un router.${verbo}('/') en invoicesAdmin.routes.ts. El alta de factura suelta no ` +
      'puede traer consigo una puerta de edición o borrado sobre la colección.');
  }
});

// ── LAS DOS CARAS ────────────────────────────────────────────────────────────────────────

test('SCRUM-289b · LAS DOS CARAS: los caminos del CICLO siguen intactos', () => {
  // Probar solo la suelta no demuestra que no se haya roto la que ya existía. Los dos emisores
  // que ya usaban `emitInvoice` siguen ahí, con SU propio gate y sin pasar por el nuevo.
  const albaranes = fs.readFileSync(path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'albaranes.routes.ts'), 'utf8');
  const recap = fs.readFileSync(path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'recapitulativa.service.ts'), 'utf8');
  assert.match(albaranes, /emitInvoice\(/, '🔴 el albarán parcial ya no emite: se ha roto un camino del ciclo');
  assert.match(recap, /emitInvoice\(/, '🔴 la recapitulativa ya no emite: se ha roto un camino del ciclo');
  assert.match(albaranes, /getEmissionMode\(merchant\)\s*===\s*'receipt'/,
    '🔴 el albarán parcial ha perdido SU gate. Cada camino conserva el suyo: la factura suelta no ' +
    'centraliza nada ni cambia el criterio de los que ya existían.');
  // Y el emisor compartido no ha cambiado de firma por culpa de esto (regla 38: el camino de
  // emisión no se toca para acomodar un llamador nuevo).
  const emisor = fs.readFileSync(path.join(RAIZ, 'src', 'modules', 'invoicing', 'domain', 'invoicing.service.ts'), 'utf8');
  assert.match(emisor, /camino:\s*'C7'/,
    '🔴 alguien ha tocado el camino declarado del emisor compartido. Distinguir la suelta exige ' +
    'cambiar su firma, y eso es STOP (regla 38) — tiene su ticket: SCRUM-347.');
});

test('SCRUM-289b · el hecho fiscal NO se audita dos veces', () => {
  // `factura_emitida` es acción BLOQUEANTE y la escribe `allocateInvoiceNumber` DENTRO de la
  // transacción (SCRUM-207). Un `recordAudit` aquí duplicaría el hecho y, encima, en su variante
  // fire-safe: un registro fiscal que se puede perder sin que nadie se entere. Estuvo a punto de
  // entrar: lo cazó el tipo de la unión, no una revisión.
  const h = textoDe(handlerDe('post', '/'));
  assert.ok(!/recordAudit\s*\(/.test(h),
    '🔴 el entrypoint escribe su propio registro de auditoría. `factura_emitida` ya se escribe en ' +
    '`allocateInvoiceNumber`, dentro de la transacción y como acción BLOQUEANTE. Añadir otro aquí ' +
    'duplica el hecho fiscal y lo hace en la variante que se puede perder.');
});

// ── MICROCOPY (regla 30) ─────────────────────────────────────────────────────────────────

/**
 * ¿Es un GLIFO de icono y no un texto? `×` (cerrar) y `✕` (quitar línea) son iconos: su nombre
 * accesible NO es ese carácter, es el `aria-label` — que este guard SÍ exige y SÍ tiene que ser el
 * marcador. Es el patrón que ya usa `jobDetailView.js` (`del.textContent = '✕'` +
 * `setAttribute('aria-label', …)`), así que exigirles el marcador dejaría un botón de cerrar
 * rotulado «[PENDIENTE microcopy oficial]», que no es lo que hizo SCRUM-244 ni tiene sentido.
 *
 * La población se acota a lo ESTRECHO: uno o dos caracteres SIN letras ni dígitos. Cualquier
 * palabra —una sola— vuelve a caer dentro del guard.
 */
const esGlifo = (s) => /^[^\p{L}\p{N}]{1,2}$/u.test(s.trim());

/** Literales que el usuario LEE. No entran clases, estilos, ids, endpoints ni tipos de input. */
function literalesVisibles(codigo, ruta) {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const PROPS = new Set(['textContent', 'placeholder', 'innerText', 'title']);
  const out = [];

  // 🔴 RESOLVER IDENTIFICADORES, y el suelo de este fichero es quien lo exigió. El modal sube el
  // marcador a `const NF_PENDIENTE = '[PENDIENTE microcopy oficial]'`, así que casi todas las
  // asignaciones son un IDENTIFICADOR y no un literal: sin esto el guard veía 2 textos de 20 y
  // habría dado verde sobre una pantalla entera sin mirar. Es el mismo fallo que el spread del
  // censo de SCRUM-289 — la forma real que tiene el código, no la que espera el analizador.
  const constantes = new Map();
  const recogerConstantes = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
      && ts.isStringLiteral(n.initializer)) constantes.set(n.name.text, n.initializer.text);
    ts.forEachChild(n, recogerConstantes);
  };
  recogerConstantes(sf);

  /** Texto de un nodo que puede ser literal o un identificador resoluble. `null` = no es texto. */
  const textoLiteral = (n) => {
    if (ts.isStringLiteral(n)) return n.text;
    if (ts.isIdentifier(n) && constantes.has(n.text)) return constantes.get(n.text);
    return null;
  };
  const visitar = (n) => {
    // x.textContent = '…'
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(n.left) && PROPS.has(n.left.name.text)) {
      const t = textoLiteral(n.right);
      if (t !== null) out.push({ texto: t, donde: `${n.left.name.text} =` });
    }
    // x.setAttribute('aria-label', '…')  ·  showToast('…')
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'setAttribute' && n.arguments.length === 2
      && ts.isStringLiteral(n.arguments[0]) && /^aria-label$|^title$/.test(n.arguments[0].text)) {
      const t = textoLiteral(n.arguments[1]);
      if (t !== null) out.push({ texto: t, donde: `setAttribute('${n.arguments[0].text}')` });
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'showToast'
      && n.arguments.length) {
      const t = textoLiteral(n.arguments[0]);
      if (t !== null) out.push({ texto: t, donde: 'showToast()' });
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

test('SCRUM-289b · SUELO del guard de microcopy: encuentra literales visibles de verdad', () => {
  const vistos = literalesVisibles(fs.readFileSync(MODAL, 'utf8'), MODAL);
  assert.ok(vistos.length >= 8,
    `🔴 solo ${vistos.length} literales visibles en el modal. El guard de abajo pasaría en verde ` +
    'sin haber mirado la pantalla: cero literales y cero literales MALOS son el mismo resultado.');
});

test('SCRUM-289b · MICROCOPY: todo literal visible nuevo es exactamente el marcador (regla 30)', () => {
  const malos = [];
  for (const f of [MODAL, VISTA]) {
    const codigo = fs.readFileSync(f, 'utf8');
    // De la vista SOLO se mira lo que este incremento añadió: el resto es copy ya aprobado de
    // otro carril y exigirle el marcador sería absurdo.
    const solo = f === VISTA
      ? (codigo.match(/nuevaFacturaBtn[\s\S]*?header\.appendChild\(nuevaFacturaBtn\);/) || [''])[0]
      : codigo;
    for (const l of literalesVisibles(solo, f)) {
      if (l.texto !== PENDIENTE && !esGlifo(l.texto)) malos.push(`${path.basename(f)} · ${l.donde} · ${JSON.stringify(l.texto)}`);
    }
  }
  assert.deepEqual(malos, [],
    '🔴 HAY TEXTO VISIBLE QUE NO ES EL MARCADOR:\n    ' + malos.join('\n    ') +
    `\n\n  Regla 30: la microcopy la aprueba el fundador. Hasta entonces todo rótulo va con\n` +
    `  ${JSON.stringify(PENDIENTE)} — mismo mecanismo que SCRUM-244 en exportView.js.\n\n` +
    '  Un provisional que «suena bien» se queda: nadie vuelve a mirar un texto que no chirría.');
});

// ── CONTROL NEGATIVO ─────────────────────────────────────────────────────────────────────

test('SCRUM-289b · control negativo: el guard de microcopy NO salta con lo que no es texto', () => {
  // Clases, estilos, endpoints, tipos de input y NOMBRES DE CLIENTE (dato del merchant, no copy)
  // no son microcopy. Un guard que saltara con ellos obligaría a marcar medio fichero.
  const falsoPositivo = `
    const b = document.createElement('button');
    b.className = 'btn-primary btn-sm';
    b.style.cssText = 'display:flex';
    b.type = 'button';
    const o = document.createElement('option');
    o.textContent = c.name || String(c.id);
    apiRequest('/admin/invoices', { method: 'POST' });
  `;
  const vistos = literalesVisibles(falsoPositivo, 'falso.js');
  assert.deepEqual(vistos, [],
    '🔴 el guard de microcopy salta con clases, estilos, endpoints o con el NOMBRE del cliente ' +
    '(que es dato del merchant, no copy). Un guard que salta con todo obliga a marcarlo todo.');
});

test('SCRUM-289b · control negativo: la validación acepta un cuerpo correcto', () => {
  const r = validarFacturaSuelta({ customerId: 7, lines: [{ concept: 'Mano de obra', qty: 2, price: 30, tax: 0.21 }] });
  assert.equal(r.ok, true, '🔴 un cuerpo válido se está rechazando: el guard de entrada es demasiado estrecho.');
  assert.equal(r.customerId, 7);
  assert.equal(r.lineas.length, 1);
});

test('SCRUM-289b · la validación rechaza, con error NOMBRADO, lo que no vale', () => {
  const casos = [
    [{ lines: [{ concept: 'x', qty: 1, price: 1, tax: 0 }] }, ERROR_CLIENTE_INVALIDO, 'sin cliente'],
    [{ customerId: 7, lines: [] }, ERROR_LINEAS_INVALIDAS, 'sin líneas'],
    [{ customerId: 7, lines: [{ concept: '', qty: 1, price: 1, tax: 0 }] }, ERROR_LINEAS_INVALIDAS, 'concepto vacío'],
    [{ customerId: 7, lines: [{ concept: 'x', qty: 0, price: 1, tax: 0 }] }, ERROR_LINEAS_INVALIDAS, 'cantidad cero'],
    // 21 en vez de 0.21: el IVA va en FRACCIÓN. Confundirlas multiplicaría la cuota por cien sin
    // que nada fallara — el error caro que este caso fija.
    [{ customerId: 7, lines: [{ concept: 'x', qty: 1, price: 1, tax: 21 }] }, ERROR_LINEAS_INVALIDAS, 'IVA en porcentaje'],
  ];
  for (const [cuerpo, esperado, que] of casos) {
    const r = validarFacturaSuelta(cuerpo);
    assert.equal(r.ok, false, `🔴 se acepta un cuerpo inválido (${que})`);
    assert.equal(r.error, esperado, `🔴 el error de «${que}» no es el nombrado`);
    assert.ok(r.message && r.message.length > 10, `🔴 «${que}» no explica nada al que lo recibe`);
  }
});
