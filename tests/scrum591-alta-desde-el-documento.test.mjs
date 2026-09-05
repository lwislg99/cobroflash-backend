// tests/scrum591-alta-desde-el-documento.test.mjs — SCRUM-591 (DOC-01)
//
// Sin gate: lee ficheros y monta el dashboard en el banco. Ni BD, ni red, ni servidor.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ IMPIDE ESTO
//
// LA VÍCTIMA: un fontanero hace un presupuesto con el cliente delante; al llegar al selector de
// Contacto el cliente no está, y hasta hoy tenía que ABANDONAR el documento a medias, irse a
// Clientes, darlo de alta y volver a empezar. Eso rompe «presupuesto en 30 segundos».
//
// EL DEFECTO QUE VIGILA NO ES ÉSE: es el arreglo fácil. La forma barata de cerrar el ticket era
// pintar un SEGUNDO formulario de alta en la vista del documento. Habrían nacido dos altas que
// divergen, y el aviso de duplicado de CONT-05 se habría quedado en una sola — **justo donde más
// duplicados nacen**, que es el alta rápida con prisa y el cliente delante.
//
// Por eso el test que decide no es «se puede crear desde el documento», sino **«el alta del
// documento y el alta normal son EL MISMO formulario»**, y se comprueba por comportamiento: se
// abre desde el documento y se mira si la petición de duplicados sale de verdad.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');
const VISTA_CLIENTES = path.join(DIR_JS, 'customersView.js');
const VISTA_DOC = path.join(DIR_JS, 'quotesView.js');

/**
 * Cuántos marcadores declara el censo de SCRUM-402 para un fichero. **Por AST**: se lee el objeto
 * `CENSO` de su test, no se busca la cadena — una mención en un comentario (y ese fichero está
 * lleno de comentarios que nombran ficheros) daría un número inventado.
 *
 * Se lee el FUENTE en vez de importarlo porque importar un `.test.mjs` CORRERÍA sus pruebas.
 */
function declaradosEn402(fichero) {
  const ruta = path.join(RAIZ, 'tests/scrum402-marcador-no-se-pinta.test.mjs');
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true);
  let censo = null;
  const v = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'CENSO') {
      let e = n.initializer;
      // `Object.freeze({...})`: el objeto va dentro de la llamada.
      if (e && ts.isCallExpression(e) && e.arguments.length) e = e.arguments[0];
      if (e && ts.isObjectLiteralExpression(e)) censo = e;
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  assert.ok(censo,
    '🔴 GUARD CIEGO: no encuentro el objeto `CENSO` en el test de SCRUM-402. Si se ha renombrado, '
    + 'esta comprobación dejó de mirar nada y cualquier número le parecería bien.');
  for (const p of censo.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const clave = ts.isStringLiteral(p.name) || ts.isIdentifier(p.name) ? p.name.text : null;
    if (clave === fichero) return Number(p.initializer.getText());
  }
  return 0; // no está en el censo = no debe pintar ninguno
}

const leer = (p) => fs.readFileSync(p, 'utf8');

/** Los literales de un fichero, por AST: los comentarios NO son literales y quedan fuera solos. */
function literalesDe(fuente, nombre) {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true);
  const out = [];
  const v = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    ts.forEachChild(n, v);
  };
  v(sf);
  return out;
}

// ── SUELO ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-591 · 🔴 SUELO: el censo VE los selectores de cliente de los documentos', () => {
  // Si esto diera cero, todo lo de abajo sería cierto sobre un conjunto vacío — un verde peor
  // que un rojo. El censo busca el rótulo del selector, que es lo que el profesional lee.
  const conSelector = fs.readdirSync(DIR_JS)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => literalesDe(leer(path.join(DIR_JS, f)), f).some((l) => l.includes('Selecciona un cliente')));

  assert.ok(conSelector.length >= 1,
    '🔴 CENSO CIEGO: no veo NINGÚN selector de cliente en las vistas del dashboard. O el rótulo\n' +
    '   cambió, o el escáner no está leyendo: en los dos casos, lo de abajo no mide nada.');
  assert.ok(conSelector.includes('quotesView.js'),
    `🔴 el selector del documento ya no está en \`quotesView.js\`. Veo: ${conSelector.join(', ')}`);
});

// ── EL TEST QUE DECIDE: UN SOLO FORMULARIO ──────────────────────────────────────────────

test('SCRUM-591 · 🔴 el formulario de alta de cliente existe UNA sola vez en todo el dashboard', () => {
  // Un segundo `createField("Nombre", "name")` en otra vista es exactamente el defecto: dos altas
  // que divergen. Se busca por AST el par de literales que construye el campo obligatorio del
  // formulario, no por texto, para que un comentario que lo mencione no cuente.
  const construyen = [];
  for (const f of fs.readdirSync(DIR_JS).filter((x) => x.endsWith('.js'))) {
    const sf = ts.createSourceFile(f, leer(path.join(DIR_JS, f)), ts.ScriptTarget.Latest, true);
    const v = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'createField') {
        const a = n.arguments;
        if (a.length >= 2 && ts.isStringLiteral(a[0]) && ts.isStringLiteral(a[1])
          && a[0].text === 'Nombre' && a[1].text === 'name') construyen.push(f);
      }
      ts.forEachChild(n, v);
    };
    v(sf);
  }

  assert.deepEqual(construyen, ['customersView.js'],
    '🔴 EL FORMULARIO DE ALTA DE CLIENTE SE HA DUPLICADO:\n    ' + construyen.join('\n    ') +
    '\n\n  Dos formularios divergen, y el que se quede atrás será el que no avise de duplicados —\n' +
    '  en el alta rápida, que es donde más duplicados nacen. El documento tiene que ABRIR el que\n' +
    '  ya existe (`window.altaClienteModal.abrirNuevo`), no construir otro.');
});

test('SCRUM-591 · la vista del documento NO construye campos de cliente: los pide', () => {
  const doc = leer(VISTA_DOC);
  assert.ok(doc.includes('window.altaClienteModal.abrirNuevo'),
    '🔴 el documento ya no abre el formulario compartido.');
  const sf = ts.createSourceFile('q.js', doc, ts.ScriptTarget.Latest, true);
  let creaCampos = 0;
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'createField'
      && n.arguments.length >= 2 && ts.isStringLiteral(n.arguments[1])
      && ['name', 'taxId', 'legalName', 'phone'].includes(n.arguments[1].text)) creaCampos++;
    ts.forEachChild(n, v);
  };
  v(sf);
  assert.equal(creaCampos, 0,
    `🔴 la vista del documento construye ${creaCampos} campo(s) de ficha de cliente. Ése es el\n` +
    '   segundo formulario, aunque hoy tenga menos campos: nace divergiendo.');
});

// ── EL COMPORTAMIENTO: EL AVISO DE DUPLICADO LLEGA AL ALTA RÁPIDA ────────────────────────

/** Monta el dashboard y devuelve el banco con las URLs que se han pedido. */
function bancoConRed() {
  const pedidas = [];
  const banco = cargarDashboard(RAIZ, {
    red: {
      navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
      fetch: async (url) => {
        pedidas.push(String(url));
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ coincidencias: [] }), text: async () => '{}' };
      },
    },
  });
  return { banco, pedidas };
}

test('SCRUM-591 · 🔴 SUELO: el dashboard monta y publica el formulario compartido', () => {
  const { banco } = bancoConRed();
  assert.equal(banco.fallos.length, 0,
    '🔴 algún script del dashboard revienta al cargarse:\n    ' +
    banco.fallos.map((f) => f.script + ': ' + f.error).join('\n    '));
  assert.ok(banco.ctx.window && typeof banco.ctx.window.altaClienteModal === 'object',
    '🔴 `window.altaClienteModal` no existe. Sin él, el documento no tiene qué abrir y todo lo\n' +
    '   que se afirme debajo sería cierto sobre nada.');
  for (const m of ['abrir', 'abrirNuevo', 'configurar', 'cerrar']) {
    assert.equal(typeof banco.ctx.window.altaClienteModal[m], 'function',
      `🔴 al formulario compartido le falta \`${m}\`.`);
  }
});

test('SCRUM-591 · 🔴 EL QUE DECIDE: abrir desde el DOCUMENTO pregunta por duplicados (CONT-05)', async () => {
  const { banco, pedidas } = bancoConRed();
  const w = banco.ctx.window;

  // Se abre como lo abre el documento: sin caja de avisos y sin tabla que recargar.
  w.altaClienteModal.abrirNuevo({ nombre: 'Comunidad Los Olmos', alGuardar: () => {} });

  const campos = todos(banco.ctx.document.body).filter((n) => n.tagName === 'INPUT');
  assert.ok(campos.length >= 5,
    `🔴 SUELO: el formulario abierto desde el documento tiene ${campos.length} campos. No se ha ` +
    'montado, así que lo de abajo no probaría nada.');

  const tel = campos.find((n) => n.name === 'phone');
  assert.ok(tel, '🔴 el formulario abierto desde el documento no tiene campo de teléfono.');

  const antes = pedidas.length;
  tel.value = '600111222';
  const oyentes = (tel._oyentes && tel._oyentes.blur) || [];
  assert.ok(oyentes.length > 0,
    '🔴 EL AVISO DE DUPLICADO NO LLEGA AL ALTA RÁPIDA: el teléfono del formulario abierto desde\n' +
    '   el documento no tiene ni un oyente de `blur`. CONT-05 se queda fuera justo donde más\n' +
    '   duplicados nacen — el alta con prisa y el cliente delante.');
  for (const fn of oyentes) await fn({});

  const consulta = pedidas.slice(antes).filter((u) => u.includes('/admin/customers/duplicados'));
  assert.ok(consulta.length > 0,
    '🔴 EL AVISO DE DUPLICADO NO LLEGA AL ALTA RÁPIDA: al salir del teléfono no se ha preguntado\n' +
    '   por duplicados. Peticiones vistas:\n    ' + (pedidas.slice(antes).join('\n    ') || '(ninguna)') +
    '\n\n  El alta desde el documento tiene que usar EL MISMO formulario, con su comprobación.');
  assert.ok(consulta[0].includes('phone='),
    `🔴 se preguntó, pero sin el teléfono: ${consulta[0]}`);
});

test('SCRUM-591 · el nombre tecleado llega PRELLENADO al formulario', async () => {
  const { banco } = bancoConRed();
  banco.ctx.window.altaClienteModal.abrirNuevo({ nombre: 'Talleres Ruiz' });
  const nombre = todos(banco.ctx.document.body).find((n) => n.tagName === 'INPUT' && n.name === 'name');
  assert.ok(nombre, '🔴 no hay campo de nombre en el formulario abierto.');
  assert.equal(nombre.value, 'Talleres Ruiz',
    '🔴 el nombre no llega prellenado. `openModal` hace `reset()`, así que el prellenado tiene\n' +
    '   que ir DESPUÉS de abrir; si va antes, se borra y el profesional lo teclea dos veces.');
});

test('SCRUM-591 · 🔴 CONTROL NEGATIVO: sin `alGuardar`, abrir NO revienta', () => {
  // La entrada de siempre (los botones de la tabla) no pasa callback. Si `abrirNuevo` lo diera
  // por hecho, el alta normal caería el día que alguien reutilizara esta puerta.
  const { banco } = bancoConRed();
  assert.doesNotThrow(() => banco.ctx.window.altaClienteModal.abrirNuevo({}),
    '🔴 abrir el formulario sin callback revienta.');
  assert.doesNotThrow(() => banco.ctx.window.altaClienteModal.abrirNuevo(),
    '🔴 abrir el formulario sin opciones revienta.');
});

// ── LA OPCIÓN DEL SELECTOR, Y SU MICROCOPY PENDIENTE ────────────────────────────────────

test('SCRUM-591 · 🔴 el selector del documento ofrece el alta, y su valor NO puede ser un id', () => {
  const doc = leer(VISTA_DOC);
  const lit = literalesDe(doc, 'quotesView.js');
  assert.ok(lit.includes('__alta_cliente__'),
    '🔴 la opción de alta ha perdido su valor centinela.');
  assert.ok(/const VALOR_ALTA_RAPIDA\s*=\s*"__alta_cliente__"/.test(doc),
    '🔴 el centinela ya no se declara en un solo sitio.');
  // Un id de cliente es un número: el centinela no puede colisionar con ninguno.
  assert.ok(Number.isNaN(Number('__alta_cliente__')),
    '🔴 el valor de la opción de alta podría confundirse con un id de cliente.');
});

test('SCRUM-591 · ✅ la microcopy FIRMADA es literal, y es la MISMA que la de Clientes', () => {
  // Firmada por el asesor el 3-sep-2026: «+ Nuevo cliente», 15 caracteres. Se compara ENTERA y
  // con `===`: un `includes` dejaría colar «+ Nuevo cliente…» o «+ nuevo cliente» sin que nada
  // cayera, y microcopy aprobada que deriva sola es microcopy que deja de estar aprobada.
  const doc = leer(VISTA_DOC);
  const lit = literalesDe(doc, 'quotesView.js');
  assert.ok(lit.includes('+ Nuevo cliente'),
    '🔴 la opción de alta ya no pinta el texto firmado «+ Nuevo cliente».');
  assert.ok(/const TEXTO_ALTA_RAPIDA\s*=\s*"\+ Nuevo cliente"/.test(doc),
    '🔴 el texto firmado ya no vive en una sola constante.');

  // ⚠️ UN NOMBRE POR ACCIÓN — Y HOY NO LO ES. MEDIDO EL 3-sep-2026, NO SUPUESTO.
  //
  // El asesor firmó «+ Nuevo cliente» diciendo que era EL MISMO literal que el botón de la lista
  // de Clientes. Lo era cuando lo firmó. Al mezclar `main` dejó de serlo: SCRUM-599 cambió ese
  // botón a **«Nuevo cliente»**, sin el `+`, y le colgó dentro un `<kbd>N</kbd>` — el texto ya no
  // vive en `customersView.js`, sale de `atajoNuevo.TEXTOS.customers`, **que está declarado
  // `SIN_APROBAR = 3`**: tres ranuras esperando la firma del FUNDADOR.
  //
  // Así que la misma acción tiene hoy DOS nombres en pantalla, y este guard no lo arregla por su
  // cuenta —cambiar microcopy firmada no es de una sesión— sino que ATA LOS DOS: si cualquiera de
  // los dos se mueve, esto cae y alguien tiene que volver a decidir. Es más fuerte que la
  // comparación de antes, que sólo miraba un lado.
  const atajo = leer(path.join(DIR_JS, 'atajoNuevo.js'));
  assert.match(atajo, /customers:\s*"Nuevo cliente"/,
    '🔴 el rótulo del botón de Clientes ha cambiado otra vez. Ahora mismo el documento ofrece\n' +
    '   «+ Nuevo cliente» y la lista otra cosa: la misma acción con dos nombres. Hay que decidirlo\n' +
    '   arriba (el texto del atajo está SIN APROBAR), no aquí.');
  // 🔴 4-sep-2026 · 3 → 0: el fundador firmó los tres rótulos del atajo, y con ellos «Nuevo
  // cliente». La pregunta que este test dejaba abierta ya tiene respuesta y NO es «alinearlos»:
  // el asesor decidió que la distinción se mantiene —BOTÓN sin `+`, OPCIÓN de `<select>` con `+`—
  // porque en una lista de doscientos nombres el `+` es lo único que separa una acción de un
  // nombre, y en un botón no separa nada. Los dos textos siguen atados, cada uno al suyo.
  // 🔴 5-sep-2026 · subio a 1 y volvio a 0 el mismo dia (SCRUM-606: entro «Nuevo albarán» y el
  // asesor lo firmo en la misma sesion). Lo que este test ata sigue INTACTO: el rotulo de
  // Clientes, comprobado literal justo arriba.
  assert.match(atajo, /SIN_APROBAR = 0/,
    '🔴 el número de ranuras sin firmar del atajo ha cambiado. Si ha entrado un rótulo nuevo sin\n' +
    '   firma, hay que decirlo; y si se ha movido sin motivo, no es este test lo que hay que tocar.');

  // 🔴 4-sep-2026 (SCRUM-587) · ESTA COMPROBACIÓN AHORA HACE LO QUE SU MENSAJE YA PROMETÍA.
  //
  // Decía «si vuelve uno, hay que declararlo en el censo de SCRUM-402» y a la vez prohibía
  // CUALQUIER marcador: la vía que ofrecía no existía, así que el único modo de pasar era borrar
  // el marcador o apagar el test. Un guard que nombra una salida que no lleva a ningún sitio se
  // acaba apagando, y ahí sí se pierde la propiedad entera.
  //
  // Ahora se CONSULTA el censo del 402 —por AST, no por texto— y se exige que los marcadores de
  // esta vista sean EXACTAMENTE los declarados allí. Es más fuerte que antes: un marcador nuevo
  // sigue cayendo aquí, y además tiene que cuadrar con quien los cuenta. El número no se duplica
  // en dos sitios; éste lo LEE de aquél.
  const marcadores = lit.filter((l) => l.includes('[PENDIENTE')).length;
  assert.equal(marcadores, declaradosEn402('quotesView.js'),
    `🔴 \`quotesView.js\` pinta ${marcadores} marcadores de microcopy y el censo de SCRUM-402 `
    + `declara ${declaradosEn402('quotesView.js')}. Si has añadido uno, va al censo con su motivo; `
    + 'si has firmado un texto, su entrada se BORRA allí — no se pone a 0 (SCRUM-424 / SCRUM-405).');
});

// ── CONTROL NEGATIVO: LO COSMÉTICO NO MUEVE NADA ────────────────────────────────────────

test('SCRUM-591 · CONTROL NEGATIVO: un cambio cosmético en el modal no mueve el censo', () => {
  // Se aplica sobre una COPIA en memoria: cambiar un comentario, una clase CSS y un espacio no
  // puede alterar lo que este guard mide. Si lo alterara, el guard estaría atado a la cosmética
  // y daría rojos que no son defectos — que es cómo muere un guard.
  const original = leer(VISTA_CLIENTES);
  const cosmetico = original
    .replace('// -------- Modal:', '// -------- Modal (retocado):')
    .replace('modal-overlay', 'modal-overlay ')
    .replace('createElement("div", "modal")', 'createElement("div",  "modal")');
  assert.notEqual(cosmetico, original, '🔴 SUELO: el cambio cosmético no ha cambiado nada.');

  const campos = (fuente) => {
    const sf = ts.createSourceFile('c.js', fuente, ts.ScriptTarget.Latest, true);
    const out = [];
    const v = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'createField'
        && n.arguments.length >= 2 && ts.isStringLiteral(n.arguments[1])) out.push(n.arguments[1].text);
      ts.forEachChild(n, v);
    };
    v(sf);
    return out.sort();
  };
  assert.ok(campos(original).length >= 10,
    `🔴 SUELO: sólo veo ${campos(original).length} campos en el formulario; el extractor no lee.`);
  assert.deepEqual(campos(cosmetico), campos(original),
    '🔴 un comentario, un espacio y una clase CSS cambian lo que mide este guard.');
});

// ── LA COSTURA: EL FORMULARIO NO SABE NADA DE LA TABLA ──────────────────────────────────

test('SCRUM-591 · 🔴 el formulario no depende de la tabla: sus costuras se inyectan', () => {
  const src = leer(VISTA_CLIENTES);
  // Dentro de la IIFE del formulario no puede quedar ninguna llamada a la recarga de la tabla:
  // si quedara, abrir desde un documento —donde no hay tabla— reventaría al guardar.
  const i = src.indexOf('window.altaClienteModal = {');
  assert.ok(i > 0, '🔴 no encuentro la superficie del formulario compartido.');
  const iIife = src.lastIndexOf('(function () {', i);
  assert.ok(iIife > 0 && iIife < i, '🔴 no encuentro la IIFE que envuelve el formulario.');
  const cuerpo = src.slice(iIife, i);
  assert.ok(!/\bloadCustomers\s*\(/.test(cuerpo),
    '🔴 el formulario compartido llama a `loadCustomers`, que es de la TABLA. Abrirlo desde un\n' +
    '   documento reventaría al guardar. La recarga se inyecta con `configurar({trasGuardar})`.');
  assert.ok(!/\bsetAlert\s*\(/.test(cuerpo),
    '🔴 el formulario compartido llama a `setAlert`, que es la caja de avisos de la tabla.');
  assert.ok(/\bavisar\s*\(/.test(cuerpo) && /\btrasGuardar\s*\(/.test(cuerpo),
    '🔴 el formulario ya no usa sus dos costuras inyectadas.');
});
