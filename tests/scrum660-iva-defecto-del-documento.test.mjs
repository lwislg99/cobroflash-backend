// tests/scrum660-iva-defecto-del-documento.test.mjs — SCRUM-660
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL IVA POR DEFECTO DEL DOCUMENTO TAMBIÉN SE ELIGE — Y LOS DOS SELECTORES SE VEN
//
// Lo dejó escrito SCRUM-611 al cerrar el de la LÍNEA: «el "IVA por defecto" del documento es
// otro campo LIBRE (quotesView.js:385)». Cerrar uno sin el otro no cierra nada: este valor BAJA
// a cada línea nueva y desde ahí viaja al documento, al PDF y al importe que el cliente firma.
//
// ── 🔴 Y CIERRA EL HUECO QUE 611 DECLARÓ AL ENTREGAR ──────────────────────────────────────
// «Son controles de fuente y de regla, no de pantalla. Si alguien dejara el <select> sin
// insertar o tras un display:none, todos seguirían verdes.» Es el defecto de la casa nº 2:
// CONSTRUIDO ≠ ALCANZABLE. Aquí se monta la pantalla y se comprueba que los DOS selectores
// están INSERTADOS y NO OCULTOS — el de la línea también, que hasta hoy no lo verificaba nadie.
//
// ── ✅ EL HUECO QUE ESTE FICHERO DECLARÓ, CERRADO EN SCRUM-666 ────────────────────────────
// Decía: «el banco no aplica CSS EXTERNO; un `display:none` escrito en `styles.css` no se detecta
// aquí». Ya se detecta: `quienLoEsconde` consulta las reglas de las hojas que declara el índice
// (`reglasQueOcultan` + `ocultoPorCss`). Probado por el mecanismo: añadir a `styles.css` una regla
// que oculte el selector de la LÍNEA hace CAER este fichero.
//
// ⚠️ Y LO QUE SIGUE SIN CUBRIRSE, dicho en vez de suponerse: el matcher no resuelve `>`, `+`,
// `~`, `*` ni pseudoclases, y **las dos reglas que ocultan campos del editor de líneas son
// justamente de ésas**. Ahí el banco NO contesta «se ve»: se declara CIEGO y este control lo
// trata como fallo. Un `:has()` o un `@container` nuevos seguirían necesitando navegador.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { cargarDashboard, pintarVista, todos, reglasQueOcultan, ocultoPorCss, datosDeMuestra } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// SCRUM-666 · las reglas de las hojas del indice que pueden ocultar. Se leen UNA vez.
const REGLAS_CSS = reglasQueOcultan(RAIZ);

/** Sube por los padres hasta la raíz. Devuelve la cadena, para poder decir QUIÉN esconde. */
function ancestros(n) {
  const out = [];
  for (let x = n; x; x = x._padre) out.push(x);
  return out;
}

/** ¿Está el nodo colgando del contenedor que se pintó? Sin esto, «existe» no significa nada. */
function estaInsertado(n, contenedor) {
  return ancestros(n).includes(contenedor);
}

/**
 * Quién lo esconde, o `null` si se ve. Mira el nodo Y TODOS SUS ANCESTROS: esconder el padre
 * esconde al hijo, y un control que sólo mirase el propio nodo daría verde con la fila entera
 * en `display:none`.
 */
function quienLoEsconde(n) {
  for (const x of ancestros(n)) {
    const st = x.style || {};
    const css = String(st.cssText || '');
    if (st.display === 'none' || /(^|[;\s])display\s*:\s*none/.test(css)) return `${x.tagName}.${x.className} (display:none)`;
    if (st.visibility === 'hidden' || /visibility\s*:\s*hidden/.test(css)) return `${x.tagName}.${x.className} (visibility:hidden)`;
    if (x.hidden === true) return `${x.tagName}.${x.className} (atributo hidden)`;
  }
  // 🔴 SCRUM-666 · Y AHORA TAMBIÉN EL CSS EXTERNO. Hasta este ticket, este control sólo miraba
  // el marcado: un `display:none` escrito en `styles.css` lo dejaba en VERDE. Era el hueco que
  // esta misma función declaró al entregar SCRUM-660, y era de la clase cara — falso verde.
  //
  // Tres respuestas, y la tercera es la que hace que sirva: si hay una regla que MENCIONA una
  // clase de este nodo y cuyo selector el matcher NO sabe resolver, esto NO dice «se ve»: se
  // declara CIEGO y el control lo trata como un fallo. Medido en SCRUM-666: las dos reglas que
  // ocultan campos del editor de líneas usan `:not(:focus-within) >`, que no se sabe resolver.
  const porCss = ocultoPorCss(n, REGLAS_CSS);
  if (porCss.oculto === true) return `CSS externo → ${porCss.porQue}`;
  if (porCss.oculto === null) return `CIEGO: hay reglas que no sé resolver y mencionan sus clases → ${porCss.ciego.join(' · ')}`;
  return null;
}

const selects = (c) => todos(c).filter((n) => n.tagName === 'SELECT');
const selectDelDocumento = (c) => selects(c).find((n) => n.name === 'vat_default') || null;
/** Los de la LÍNEA: `<select>` SIN `name`, montados por `tiposDeIva.montar()` en la hoja de ajustes. */
const selectsDeLinea = (body) => selects(body).filter((n) => !n.name);

async function pantalla() {
  const banco = cargarDashboard(RAIZ, { datos: {} });
  const r = await pintarVista(banco, 'renderQuotesView');
  // La hoja de ajustes se monta en el `body`, no dentro del contenedor de la vista.
  return { ...r, banco, body: banco.ctx.document.body };
}

// ═══ 🔴 SCRUM-915d · LO QUE ESTE FICHERO MIDE DEL SELECTOR DEL DOCUMENTO, CAMBIA ═══════════════
// Antes: «se VE nada más abrir la pantalla». Ahora: «se ALCANZA por el camino del profesional, y
// ENTONCES se ve». Lo cambia la v3 del editor, APROBADA por el fundador (docs/prototipos/SCRUM-915/):
// el IVA por defecto vive en «Ajustes del documento», plegado, dentro del paso Condiciones. Decisión
// del orquestador del 18-sep-2026, escrita en docs/master/SCRUM-915.md como CAMBIO de lo medido.
//
// El fin de 660 no cambia —construido ≠ alcanzable— y se mide igual que el IVA de la LÍNEA en este
// mismo fichero: PULSANDO, como el profesional. Si un eslabón del camino falta, el camino se corta
// y se dice DÓNDE; y si el banco no sabe resolver una regla, sigue declarándose CIEGO (nunca verde).
const CLIENTE_DEL_CAMINO = { id: 7, name: 'Comunidad Los Olivos', phone: '34000000001' };

async function pantallaConCliente(fuenteMutada = null) {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => {
      const u = String(url || '');
      if (/\/admin\/merchant/.test(u)) return { id: 1, name: 'QA 660', defaultCurrency: 'EUR' };
      if (/\/admin\/customers/.test(u)) return [CLIENTE_DEL_CAMINO];
      return datosDeMuestra(u);
    },
  });
  // Un mutante se carga ENCIMA del fichero real, en el mismo contexto, y redefine `renderQuotesView`.
  // Va envuelto en una función porque el fichero declara `let` de nivel superior y volver a
  // declararlos en el mismo contexto es un SyntaxError (medido: «already been declared»).
  if (fuenteMutada) {
    vm.runInContext(`(function () {\n${fuenteMutada}\n;globalThis.renderQuotesView = renderQuotesView;\n})();`,
      banco.ctx, { filename: 'js/quotesView.js' });
  }
  const r = await pintarVista(banco, 'renderQuotesView');
  return { ...r, banco, body: banco.ctx.document.body };
}

const botones = (c, texto) => todos(c).filter((n) => n.tagName === 'BUTTON' && String(n.textContent || '').trim() === texto);
const bloqueConTitulo = (c, titulo) => {
  const h = todos(c).find((n) => n.tagName === 'H3' && String(n.textContent || '').trim() === titulo);
  return h ? h._padre : null;
};

/** Pulsa como el profesional: sólo si el botón está insertado, habilitado y a la vista. */
function pulsar(r, boton, que) {
  if (!boton || !estaInsertado(boton, r.contenedor)) return `no hay ${que}`;
  if (boton.disabled) return `${que} está deshabilitado`;
  const q = quienLoEsconde(boton);
  if (q) return `${que} está escondido por ${q}`;
  if (boton.disparar('click') < 1) return `${que} no tiene oyente de click`;
  return null;
}

/**
 * El camino: cliente → «Continuar» → una línea → «Continuar» → «Cambiar» en «Ajustes del documento».
 * Devuelve dónde se corta, o `null` si se llega.
 */
async function recorrerHastaElIvaDelDocumento(r) {
  await new Promise((ok) => setTimeout(ok, 0)); // la lista de clientes llega en una promesa
  const cliente = todos(r.contenedor).find((n) => n.tagName === 'SELECT' && n.name === 'customer_id');
  if (!cliente) return 'no hay selector de cliente';
  cliente.value = String(CLIENTE_DEL_CAMINO.id);
  cliente.disparar('change');
  let corte = pulsar(r, botones(r.contenedor, 'Continuar')[0], '«Continuar» del paso Cliente');
  if (corte) return corte;
  const concepto = todos(r.contenedor).find((n) => n.tagName === 'INPUT' && String((n._padre && n._padre.className) || '').includes('quote-line__concept'));
  const precio = todos(r.contenedor).find((n) => n.tagName === 'INPUT' && String((n._padre && n._padre.className) || '').includes('quote-line__price'));
  if (!concepto || !precio) return 'no hay concepto o precio en la primera línea';
  concepto.value = 'Mano de obra (hora)'; concepto.disparar('input');
  precio.value = '38'; precio.disparar('input');
  corte = pulsar(r, botones(r.contenedor, 'Continuar')[1], '«Continuar» del paso Conceptos');
  if (corte) return corte;
  const ajustes = bloqueConTitulo(r.contenedor, 'Ajustes del documento');
  if (!ajustes) return 'no hay «Ajustes del documento»';
  return pulsar(r, botones(ajustes, 'Cambiar')[0], '«Cambiar» de Ajustes del documento');
}

/**
 * 🔴 El selector de IVA de la LÍNEA no cuelga de la fila: desde SCRUM-139 F4 vive en la HOJA DE
 * AJUSTES, que se abre con el chip «IVA 21 % · Margen …». Para verlo hay que hacer lo que hace el
 * profesional: PULSAR. Un control que no pulsara diría «no existe» y sería un falso hallazgo.
 */
function abrirAjustesDeLaPrimeraLinea(r) {
  const chip = todos(r.contenedor).find((n) => String(n.className || '').includes('quote-line__ajustes'));
  return { chip, disparados: chip ? chip.disparar('click') : 0 };
}

// ═══ SUELO ═════════════════════════════════════════════════════════════════════════════════
test('SCRUM-660 · SUELO: la pantalla pinta y el escáner ve selectores', async () => {
  const r = await pantalla();
  assert.equal(r.error, null, `🔴 la pantalla de presupuestos revienta: ${r.error && r.error.message}`);
  assert.ok(r.nodos > 20,
    `🔴 ESCÁNER CIEGO: la vista pintó ${r.nodos} nodos. Una pantalla vacía y un escáner roto dan `
    + 'el mismo verde.');
  assert.ok(selects(r.contenedor).length >= 2,
    `🔴 CIEGO: sólo veo ${selects(r.contenedor).length} \`<select>\` en toda la pantalla. Si el `
    + 'detector no los encuentra, lo de abajo no mide nada.');
});

// ═══ ① EL TICKET: el campo del documento ya no es texto libre ═════════════════════════════
test('SCRUM-660 · 🔴 el IVA por defecto del DOCUMENTO es un `<select>`, no un campo libre', async () => {
  const r = await pantalla();
  const s = selectDelDocumento(r.contenedor);
  assert.ok(s,
    '🔴 no hay ningún `<select>` con `name="vat_default"`. Mientras sea texto libre, un 2, un 210 '
    + 'o un 1,21 tecleados ahí BAJAN a cada línea nueva y de ahí al PDF y al importe que el '
    + 'cliente firma.');
  const valores = (s.hijos || []).map((o) => o.value);
  assert.deepEqual(valores, ['21', '10', '4', '0'],
    `🔴 las opciones del documento son ${JSON.stringify(valores)} y deben ser los cuatro tipos `
    + 'españoles. Salen de `tiposDeIva`, que es el único sitio donde vive la lista.');
  assert.equal(s.value, '21', '🔴 el valor de partida ha dejado de ser 21');
});

// ═══ ② EL HUECO DE 611: construido ≠ alcanzable. LOS DOS, en la misma pasada ═══════════════
test('SCRUM-660 · 🔴 los DOS selectores están INSERTADOS y se pueden alcanzar', async () => {
  const r = await pantalla();

  // ① El del DOCUMENTO: se ve nada más abrir la pantalla.
  const doc = selectDelDocumento(r.contenedor);
  assert.ok(doc && estaInsertado(doc, r.contenedor),
    '🔴 el selector del DOCUMENTO existe pero NO cuelga de la pantalla: nadie puede tocarlo.');

  // ② El de la LÍNEA: hay que PULSAR el chip de ajustes, como hace el profesional.
  assert.equal(selectsDeLinea(r.body).length, 0,
    '🔴 el selector de LÍNEA aparece sin abrir la hoja: entonces el clic de abajo no prueba nada');
  const { chip, disparados } = abrirAjustesDeLaPrimeraLinea(r);
  assert.ok(chip, '🔴 no hay chip de ajustes en la línea: el IVA de la línea sería inalcanzable');
  assert.equal(disparados, 1,
    `🔴 el chip de ajustes no tiene oyente de click (${disparados}): el selector de IVA de la `
    + 'LÍNEA no se puede abrir, y entonces está construido pero no es alcanzable.');

  const linea = selectsDeLinea(r.body);
  assert.equal(linea.length, 1,
    `🔴 tras abrir la hoja veo ${linea.length} selectores de LÍNEA y esperaba 1. Es el de `
    + 'SCRUM-611, y hasta hoy NADA comprobaba que un profesional pudiera verlo.');
  assert.deepEqual((linea[0].hijos || []).map((o) => o.value), ['21', '10', '4', '0'],
    '🔴 el selector de la línea no trae los cuatro tipos españoles');
  assert.ok(estaInsertado(linea[0], r.body),
    '🔴 el selector de IVA de LÍNEA existe pero no cuelga del documento.');
});

test('SCRUM-660 · 🔴 los DOS selectores se VEN: nadie los esconde, ni a ellos ni a sus padres', async () => {
  // El del DOCUMENTO, por el camino del profesional (SCRUM-915d, ver arriba).
  const rc = await pantallaConCliente();
  const corte = await recorrerHastaElIvaDelDocumento(rc);
  assert.equal(corte, null, `🔴 el camino hasta el IVA por defecto se CORTA: ${corte}. Construido no es alcanzable.`);
  const doc = selectDelDocumento(rc.contenedor);
  assert.ok(doc && estaInsertado(doc, rc.contenedor), '🔴 al final del camino no hay selector del DOCUMENTO insertado');
  const escondeDoc = quienLoEsconde(doc);
  assert.equal(escondeDoc, null,
    `🔴 el selector del DOCUMENTO está ESCONDIDO por ${escondeDoc}. Construido no es alcanzable: `
    + 'un campo que no se ve deja el valor anterior sin que nadie pueda cambiarlo.');

  const r = await pantalla();
  abrirAjustesDeLaPrimeraLinea(r);
  const linea = selectsDeLinea(r.body);
  assert.equal(linea.length, 1, '🔴 sin el selector de línea, esta comprobación no mide nada');
  const q = quienLoEsconde(linea[0]);
  assert.equal(q, null,
    `🔴 el selector de IVA de LÍNEA está ESCONDIDO por ${q}. Es el hueco que SCRUM-611 declaró al `
    + 'entregar —«si alguien dejara el <select> tras un display:none, todos seguirían verdes»— y '
    + 'que este control cierra.');
});

test('SCRUM-660 · 🔴 CONTROL del detector de ocultación: sabe ver las tres formas, y el padre', async () => {
  // Sin esto, un detector que devolviera siempre `null` daría verde con todo escondido — que es
  // exactamente el hueco que este fichero dice cerrar.
  // SCRUM-915d · se mide al final del camino, que es donde el selector se ve.
  const r = await pantallaConCliente();
  assert.equal(await recorrerHastaElIvaDelDocumento(r), null, '🔴 sin llegar al selector, este control no mide nada');
  const s = selectDelDocumento(r.contenedor);

  const padre = s._padre;
  padre.style.display = 'none';
  assert.ok(quienLoEsconde(s), '🔴 no ve un `display:none` en el PADRE');
  padre.style.display = '';

  s.style.display = 'none';
  assert.ok(quienLoEsconde(s), '🔴 no ve un `display:none` en el propio nodo');
  s.style.display = '';

  s.style.cssText = 'visibility: hidden';
  assert.ok(quienLoEsconde(s), '🔴 no ve `visibility:hidden` en `cssText`');
  s.style.cssText = '';

  s.hidden = true;
  assert.ok(quienLoEsconde(s), '🔴 no ve el atributo `hidden`');
  s.hidden = false;

  // Y el control NEGATIVO del propio detector: sin nada de eso, dice que se ve.
  assert.equal(quienLoEsconde(s), null,
    '🔴 el detector dice que está escondido cuando NO lo está: entonces sus rojos no valen nada');
});

// ═══ 🔴 SCRUM-915d · LOS DOS MUTANTES QUE TIENEN QUE DAR ROJO (condición del orquestador) ═══════
// El camino nuevo sólo vale si SE CORTA cuando el selector deja de ser alcanzable. Se muta la
// fuente REAL en memoria y se comprueba que la mutación se aplicó: un patrón que ya no existiera
// dejaría el fichero igual y el «rojo» no probaría nada.
const FUENTE_EDITOR = readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesView.js'), 'utf8');
function mutante(buscar, poner) {
  assert.ok(FUENTE_EDITOR.includes(buscar), `🔴 el patrón a mutar ya no existe: ${buscar}`);
  const m = FUENTE_EDITOR.replace(buscar, poner);
  assert.notEqual(m, FUENTE_EDITOR, 'la mutación no cambió nada');
  return m;
}

test('SCRUM-915d · MUTANTE ①: sin el selector colgado, el camino llega y NO hay IVA por defecto → ROJO', async () => {
  const r = await pantallaConCliente(mutante('  else linesVatRow.appendChild(fieldVatDefault.wrapper);', '  else void 0;'));
  await recorrerHastaElIvaDelDocumento(r);
  const doc = selectDelDocumento(r.contenedor);
  assert.ok(!doc || !estaInsertado(doc, r.contenedor),
    '🔴 con el selector descolgado, el control de arriba lo seguiría dando por alcanzable');
});

test('SCRUM-915d · MUTANTE ②: sin «Cambiar» en Ajustes del documento, el camino SE CORTA → ROJO', async () => {
  const r = await pantallaConCliente(mutante('  blockDelivery.appendChild(filaAjustesBoton);', '  void 0;'));
  const corte = await recorrerHastaElIvaDelDocumento(r);
  assert.match(String(corte), /«Cambiar» de Ajustes del documento/,
    `🔴 sin el botón que abre los ajustes, el camino tendría que cortarse ahí, y dice: ${corte}`);
});

// ═══ ③ LO QUE NO PUEDE ROMPERSE: un valor que no está en la lista NO se pierde ═════════════
test('SCRUM-660 · 🔴 un IVA que NO es español se ENSEÑA, no se pierde', async () => {
  // `locale.defaultVat` estampa 16, 18 y 19 por país, y un borrador guardado puede traerlos. Un
  // selector que los perdiera cambiaría el IVA de un documento sin que nadie lo pida — dinero.
  const { default: tipos } = await import('../public/dashboard/js/tiposDeIva.js').then((m) => ({ default: m.default || m }));
  const opciones = tipos.opciones(16);
  assert.deepEqual(opciones, [21, 16, 10, 4, 0],
    `🔴 un 16 % no aparece entre las opciones: ${JSON.stringify(opciones)}. Se perdería al `
    + 'restaurar un borrador.');
  assert.deepEqual(tipos.opciones(21), [21, 10, 4, 0],
    '🔴 un tipo que SÍ es español no debe duplicarse');
});

test('SCRUM-660 · 🔴 el borrador se restaura por `ponerValor`, no por `.value`', () => {
  // Es la línea que hace que lo de arriba sirva de algo: asignar `.value` a pelo a un `<select>`
  // con un 16 % lo dejaría EN BLANCO, y el IVA del documento cambiaría solo al restaurar.
  const vista = readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesView.js'), 'utf8');
  assert.equal(
    vista.split('if (d.vatDefault) window.tiposDeIva.ponerValor(fieldVatDefault.input, d.vatDefault);').length - 1, 1,
    '🔴 la restauración del borrador ha vuelto a asignar `.value` a pelo. Con un valor que no esté '
    + 'en la lista, el campo se queda en blanco y el documento cambia de IVA sin que nadie lo pida.');
  assert.equal(vista.split('fieldVatDefault.input.value = "21";').length - 1, 0,
    '🔴 queda una asignación directa de `.value` sobre el selector del documento');
});

// ═══ ✅ CONTROL NEGATIVO ══════════════════════════════════════════════════════════════════
test('SCRUM-660 · ✅ el rótulo aprobado no ha cambiado, y el campo sigue en el bloque de Líneas', async () => {
  // Si el rótulo cambiara sería microcopy nueva (regla 30) y habría que marcarla. No cambia.
  const r = await pantalla();
  const etiquetas = todos(r.contenedor).filter((n) => n.tagName === 'LABEL').map((n) => n._texto);
  assert.ok(etiquetas.includes('IVA por defecto (%)'),
    `🔴 el rótulo aprobado «IVA por defecto (%)» ya no está: ${JSON.stringify(etiquetas.slice(0, 12))}`);
  const s = selectDelDocumento(r.contenedor);
  assert.equal(s._padre.className, 'field',
    '🔴 el campo ha salido de su envoltorio `field`: eso es un cambio de maqueta, no de este ticket');
});
