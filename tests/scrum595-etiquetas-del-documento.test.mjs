// tests/scrum595-etiquetas-del-documento.test.mjs — SCRUM-595 (DOC-05)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LAS ETIQUETAS DEL DOCUMENTO · LOS CONTROLES DEL ENCARGO
//
// LA VÍCTIMA: hasta hoy el profesional no podía etiquetar sus documentos de ninguna forma.
//
// 🔴 EL MECANISMO ES EL DE CONT-07 (SCRUM-580), SIN TOCARLO. La Obligación 0 del encargo preguntó
// si estaba atado a `Customer`, y la respuesta no se afirma: se EJECUTA. Estos casos importan ese
// módulo tal cual y lo corren sobre PRESUPUESTOS Y FACTURAS. Si estuviera atado, no podrían
// existir.
//
// ── ✅ LA COLUMNA ESTÁ EN LAS TRES BASES (8-sep-2026) ───────────────────────────────────────
// `quotes.tags` e `invoices.tags`: **desarrollo** medido por la sesión el 7-sep (quotes 43→44,
// invoices 35→36, `customers` de testigo sin moverse); **staging y producción aplicadas y
// VERIFICADAS por el fundador** el 8-sep en `information_schema` —`jsonb` · `YES` ·
// `default NULL`— con los recuentos cuadrando con dev (`quotes` 44 · `invoices` 36).
//
// El bloqueo de merge que llevaba esta cabecera queda LEVANTADO, y se retira por esa medición.
// La procedencia de cada casilla vive en `docs/MIGRATIONS_PENDING.md`: dos las sostiene la
// verificación del fundador y una la lectura del catálogo desde aquí — quien relea tiene que
// poder distinguir cuál puede volver a comprobar por su cuenta.
//
// ⚠️ Lo que NO caduca: el esquema, el SQL y el código viajan JUNTOS, y el orden del merge es lo
// que gestiona el riesgo. `schemaDrift` compara esperado ⊆ real al arrancar, y eso vuelve a
// valer entero para la siguiente columna.
//
// ── QUÉ CUBRE ESTE FICHERO Y QUÉ NO ────────────────────────────────────────────────────────
// Aquí no hay ni una lectura ni una escritura contra la base: todo es mecanismo puro más lecturas
// del árbol, y por eso corre en `npm test` sin base y sin navegador.
//
// El USO real —guardar una etiqueta en un presupuesto y en una factura por las rutas de verdad, y
// releerlas— lo ejercita `node scripts/pasada-real-etiquetas-del-documento.mjs`, que necesita la
// base de desarrollo y por eso no vive en la tanda. Un guard que lee el árbol no distingue «esto
// funciona» de «el código dice que funcionaría»; esa distinción es de aquel script.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { leerFuente } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

// EL MECANISMO DE CONT-07, TAL CUAL. Ni una envoltura, ni una copia: si hiciera falta adaptarlo
// para que sirviera a un documento, este import ya sería otra cosa y la respuesta sería otra.
const { normalizarTags, tagsDe, tieneTag, tagsUsadas } =
  await import('../dist/modules/system/tagsDelCliente.js');

/** La pieza del navegador, cargada como la carga el navegador (igual que hace SCRUM-580). */
function filtro() {
  const w = {};
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/filtroClientes.js'), 'utf8');
  new Function('window', 'module', src)(w, {});
  return w.filtroClientes;
}
const FC = filtro();

/**
 * 🔴 EL LOTE DE LOS DOS DOCUMENTOS.
 *
 * `tipo` NO es un campo del producto: es del test, y dice de qué lista sale cada fila. Existe
 * porque el control del encargo no se conforma con «salen dos»: exige que salga UNO DE CADA. Dos
 * presupuestos también serían dos filas, y con eso el bloque funcionaría en un documento y no en
 * el otro sin que nada chillara.
 *
 * Las facturas llevan `number` y `vfHash` porque son documentos EMITIDOS Y SELLADOS: es sobre ésos
 * sobre los que la regla 29 dice algo.
 *
 * ⚠️ Y el lote NO está ordenado por id ni agrupado por tipo, a propósito: si lo estuviera, «sale
 * uno de cada» podría cumplirse por el orden en que se escribió la lista.
 */
const LOTE_DOCUMENTOS = [
  { tipo: 'presupuesto', id: 41, number: 'P2004226', tags: ['obra puerto', 'garantía'] },
  { tipo: 'factura', id: 7, number: '2026-CF-001', vfHash: 'A1B2', tags: ['garantía'] },
  { tipo: 'presupuesto', id: 39, number: 'P2004224', tags: null },
  { tipo: 'factura', id: 8, number: '2026-CF-002', vfHash: 'C3D4', tags: null },
  { tipo: 'presupuesto', id: 44, number: 'P2004229', tags: ['obra puerto'] },
];

const TIPOS = ['presupuesto', 'factura'];

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE
//
// «Etiqueta un presupuesto Y una factura, filtra por esa etiqueta, y salen los dos. Si sólo
//  funciona en uno, no está hecho: el bloque aplica a los DOS documentos.»
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-595 · 🔴 EL CONTROL: filtrar por una etiqueta saca el PRESUPUESTO **y** la FACTURA', () => {
  // SUELO DEL LOTE, antes de filtrar nada: el conjunto de prueba tiene de los dos tipos con esa
  // etiqueta. Sin esto, un filtro que devuelve cero pasaría cualquier comprobación de abajo.
  for (const t of TIPOS) {
    assert.ok(
      LOTE_DOCUMENTOS.some((d) => d.tipo === t && Array.isArray(d.tags) && d.tags.includes('garantía')),
      `🔴 CIEGO: el lote de prueba no tiene ningún ${t} con la etiqueta «garantía». El control de `
      + 'abajo no probaría nada.',
    );
  }

  const salen = FC.filtrarPorEtiqueta(LOTE_DOCUMENTOS, 'garantía');

  assert.ok(salen.length > 0,
    '🔴 SUELO: el filtro devuelve CERO sobre un lote que SÍ tiene esa etiqueta. Un filtro que '
    + 'devuelve cero pasa cualquier comprobación de «no salen los que no la llevan».');

  // 🔴 EL CONTROL DEL ENCARGO, y se comprueba POR TIPO, no por número de filas.
  const tiposQueSalen = [...new Set(salen.map((d) => d.tipo))].sort();
  assert.deepEqual(tiposQueSalen, ['factura', 'presupuesto'],
    '🔴 EL BLOQUE NO APLICA A LOS DOS DOCUMENTOS. Han salido: ' + JSON.stringify(tiposQueSalen)
    + '. Si sólo funciona en uno, NO ESTÁ HECHO: la etiqueta es del DOCUMENTO, y en YaQu hay dos.');

  // Y salen EXACTAMENTE los que la llevan: ni el presupuesto sin etiquetas ni el que lleva otra.
  assert.deepEqual(salen.map((d) => d.number).sort(), ['2026-CF-001', 'P2004226'],
    '🔴 no salen exactamente los documentos que llevan «garantía».');
});

test('SCRUM-595 · 🔴 el SERVIDOR decide lo mismo que el navegador sobre los DOS documentos', () => {
  // La copia del navegador existe para que la lista filtre sin ir al servidor en cada pulsación
  // (SCRUM-580). Que las dos digan lo mismo sobre un DOCUMENTO —y no sólo sobre un cliente— es lo
  // que hace que la respuesta a la Obligación 0 valga para los dos lados, no para uno.
  for (const doc of LOTE_DOCUMENTOS) {
    assert.deepEqual(FC.tagsDe(doc), tagsDe(doc),
      `🔴 las dos copias discrepan en ${doc.tipo} ${doc.number}: la lista enseñaría una cosa y el `
      + 'servidor guardaría otra.');
    assert.equal(
      FC.filtrarPorEtiqueta([doc], 'garantía').length > 0,
      tieneTag(doc, 'garantía'),
      `🔴 el filtro del navegador y \`tieneTag\` del servidor discrepan en ${doc.tipo} ${doc.number}.`,
    );
  }
  // SUELO: no coinciden porque las dos devuelvan siempre lo mismo.
  assert.deepEqual(tagsDe(LOTE_DOCUMENTOS[0]), ['obra puerto', 'garantía'],
    '🔴 el lector del servidor no lee nada: la coincidencia de arriba sería trivial.');
  assert.equal(tieneTag(LOTE_DOCUMENTOS[2], 'garantía'), false,
    '🔴 un documento SIN etiquetas «tiene» una: entonces la comparación de arriba no distingue.');
});

test('SCRUM-595 · las etiquetas del selector salen de las que ESE lote ya usa, en los dos documentos', () => {
  // Mismo criterio que CONT-07: las opciones salen del lote que el servidor ya acotó por tenencia
  // (regla 2), nunca de otro merchant. Aquí se comprueba además que recoge las de los DOS tipos.
  assert.deepEqual(FC.etiquetasUsadas(LOTE_DOCUMENTOS), ['garantía', 'obra puerto'],
    '🔴 no devuelve las etiquetas usadas por los documentos, ordenadas y sin duplicar.');
  assert.deepEqual(tagsUsadas(LOTE_DOCUMENTOS), ['garantía', 'obra puerto'],
    '🔴 el lado servidor no devuelve las mismas.');
  // «garantía» la llevan un presupuesto y una factura; «obra puerto» SÓLO presupuestos. Si el
  // recolector mirara un único tipo, la segunda desaparecería y la primera seguiría saliendo.
  assert.ok(FC.etiquetasUsadas(LOTE_DOCUMENTOS).includes('obra puerto'),
    '🔴 falta una etiqueta que sólo llevan presupuestos.');
  assert.deepEqual(FC.etiquetasUsadas([]), [],
    '🔴 con lote vacío inventa etiquetas.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ✅ EL POSITIVO: un documento SIN etiquetas se comporta EXACTAMENTE igual que hoy
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-595 · ✅ POSITIVO: sin etiqueta seleccionada, la lista sale ENTERA y EN EL MISMO ORDEN', () => {
  const antes = LOTE_DOCUMENTOS.map((d) => d.number);
  for (const nada of [null, undefined, '', '   ']) {
    const r = FC.filtrarPorEtiqueta(LOTE_DOCUMENTOS, nada);
    assert.deepEqual(r.map((d) => d.number), antes,
      `🔴 con «${JSON.stringify(nada)}» la lista cambia. No filtrar NO es filtrar por nada, y el `
      + 'orden que mandó el servidor tampoco se toca: hoy la lista sale así y tiene que seguir.');
  }
  // Y no muta el lote de entrada: mutar lo que llegó del servidor haría que la lista de hoy
  // dependiera de si alguien tocó el filtro antes.
  assert.deepEqual(LOTE_DOCUMENTOS.map((d) => d.number), antes,
    '🔴 el filtro ha mutado la lista que le llegó.');
});

test('SCRUM-595 · ✅ POSITIVO: un documento sin etiquetas no cae en NINGUNA, y es correcto', () => {
  // El apaño de «si no tiene, que salga en todas» convierte el filtro en un adorno — y borra la
  // diferencia entre «no lo sé» y «sé que no hay», que es todo el diseño de este mecanismo.
  const sinEtiquetas = LOTE_DOCUMENTOS.filter((d) => d.tags === null);
  assert.ok(sinEtiquetas.length >= 2,
    '🔴 CIEGO: el lote no tiene documentos sin etiquetas de los dos tipos; esto no probaría nada.');
  for (const etiqueta of ['garantía', 'obra puerto']) {
    for (const doc of sinEtiquetas) {
      assert.equal(
        FC.filtrarPorEtiqueta(LOTE_DOCUMENTOS, etiqueta).some((d) => d.number === doc.number),
        false,
        `🔴 el ${doc.tipo} ${doc.number}, que no tiene etiquetas, sale al filtrar por «${etiqueta}».`,
      );
    }
  }
});

test('SCRUM-595 · 🔴 «ausente ≠ vacío» vale igual para un documento: sin etiquetas se guarda `null`', () => {
  // Es la MISMA función que usa el cliente. Si un documento guardara `[]`, un `IS NOT NULL` diría
  // que ese documento TIENE etiquetas y el filtro se construiría sobre esa mentira.
  for (const vacio of [null, [], ['', '   '], 'texto', 42]) {
    assert.equal(normalizarTags(vacio), null,
      `🔴 «${JSON.stringify(vacio)}» no se guarda como null.`);
  }
  assert.equal(normalizarTags(undefined), undefined,
    '🔴 `undefined` no se respeta: en una edición parcial eso BORRARÍA las etiquetas de un '
    + 'documento al que sólo se le estaba tocando otra cosa.');
  // CONTROL POSITIVO del propio suelo: algo con contenido NO se convierte en null.
  assert.deepEqual(normalizarTags([' garantía ', 'Garantía']), ['garantía'],
    '🔴 devuelve null también con contenido: entonces sus nulls no significarían nada.');
});

test('SCRUM-595 · 🔴 los TRES escritores traducen el NULL igual, y sólo `DbNull` vale', async () => {
  // Con el documento entran DOS escritores nuevos. La elección entre `Prisma.DbNull` y
  // `Prisma.JsonNull` deja de ser un detalle de un fichero para ser algo que tres sitios tienen
  // que acertar — así que la traducción vive en UNA función y los tres pasan por ella.
  const { tagsParaPrisma } = await import('../dist/modules/system/tagsDelCliente.js');
  const { Prisma } = await import('@prisma/client');

  assert.equal(tagsParaPrisma(undefined), undefined,
    '🔴 `undefined` deja de ser «no toques el campo».');
  assert.equal(tagsParaPrisma(null), Prisma.DbNull,
    '🔴 «sin etiquetas» no se traduce a `Prisma.DbNull`. Con `Prisma.JsonNull` la columna NO '
    + 'quedaría NULL: guardaría el valor JSON `null` DENTRO, y un `IS NOT NULL` diría que ese '
    + 'documento tiene etiquetas. Es «ausente ≠ vacío» con otro nombre.');
  assert.notEqual(tagsParaPrisma(null), Prisma.JsonNull,
    '🔴 se está devolviendo `Prisma.JsonNull`.');
  assert.deepEqual(tagsParaPrisma([' garantía ']), ['garantía'],
    '🔴 con contenido no devuelve la lista normalizada: entonces sus nulls no significan nada.');

  // 🔴 Y LOS TRES ESCRITORES PASAN POR AQUÍ. Si uno se escribiera su propia traducción, el día que
  // diverjan un documento y un cliente guardarían cosas distintas bajo el mismo nombre.
  for (const rel of ['src/modules/system/customerAdmin.ts',
                     'src/modules/system/quoteAdmin.ts',
                     'src/modules/system/invoiceAdmin.ts']) {
    const codigo = leerFuente(path.join(RAIZ, rel), { ancla: 'tagsParaPrisma' });
    assert.match(codigo, /tagsParaPrisma\(/,
      `🔴 ${rel} no usa la traducción compartida: se ha escrito la suya.`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE PROTEGE LA REGLA 29
//
// «Etiquetar una factura YA EMITIDA no cambia su número, ni su total, ni su PDF. Mídelo, no lo
//  supongas.»
//
// ⚠️ Estos casos SÓLO LEEN el camino de emisión y el sellado. No extraen un helper, no exportan
// nada y no cambian una firma: es lo que la regla 38 permite hacer sin pedir GO.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-595 · 🔴 REGLA 29: una etiqueta NO puede cambiar la HUELLA de una factura sellada', async () => {
  const { computeVeriFactuHash } =
    await import('../dist/modules/invoicing/domain/verifactu.service.js');

  const base = {
    nif: 'B12345678',
    serie: '2026-CF-001',
    fecha: '07-09-2026',
    tipoFactura: 'F1',
    cuotaTotal: '21.00',
    importeTotal: '121.00',
    prevHash: '',
    timestamp: '2026-09-07T12:00:00+02:00',
  };

  const sinEtiquetas = computeVeriFactuHash(base);
  const conEtiquetas = computeVeriFactuHash({ ...base, tags: ['garantía', 'obra puerto'] });

  // SUELO: la huella es una huella de verdad y no una cadena vacía que coincidiría consigo misma.
  assert.match(sinEtiquetas, /^[0-9A-F]{64}$/,
    '🔴 CIEGO: la huella no tiene forma de SHA-256 en mayúsculas. Comparar dos nadas siempre da '
    + 'igual, y eso no probaría nada.');

  assert.equal(conEtiquetas, sinEtiquetas,
    '🔴 UNA ETIQUETA HA CAMBIADO EL SELLO. La huella es una lista CERRADA de ocho campos (NIF, '
    + 'serie, fecha, tipo, cuota, importe, huella anterior y timestamp): si añadir `tags` la '
    + 'mueve, es que alguien ha metido la columna en el sellado — y una factura emitida no se '
    + 'edita (regla 29).');

  // CONTROL NEGATIVO del propio control: la huella SÍ se mueve cuando cambia algo que sí entra.
  // Sin esto, un `computeVeriFactuHash` que devolviera una constante daría el mismo verde.
  assert.notEqual(computeVeriFactuHash({ ...base, importeTotal: '122.00' }), sinEtiquetas,
    '🔴 CIEGO: la huella no cambia ni cambiando el importe. Entonces la igualdad de arriba no '
    + 'significa «las etiquetas no entran»: significa que esta función no mira nada.');
});

test('SCRUM-595 · 🔴 REGLA 29: el PDF de la factura NO puede recibir etiquetas', () => {
  // El papel de una factura ya emitida se regenera con el código de HOY (`ensureInvoicePdf`), así
  // que un dato nuevo en el PDF cambiaría documentos ya emitidos. Es el caso que SCRUM-593 se negó
  // a hacer y SCRUM-602 volvió a declarar. Aquí la protección es estructural: los parámetros de
  // `generateInvoicePdf` son una LISTA BLANCA, y `tags` no está en ella.
  const codigo = leerFuente(path.join(RAIZ, 'src/modules/invoicing/infra/pdf/pdf.service.ts'), {
    ancla: 'export async function generateInvoicePdf',
  });
  const i = codigo.indexOf('export async function generateInvoicePdf');
  const bloque = codigo.slice(i, codigo.indexOf('}) {', i));

  // SUELO: el trozo acotado ES la lista de parámetros de verdad.
  for (const campo of ['number', 'qrData', 'vfHash', 'merchantId']) {
    assert.ok(bloque.includes(campo),
      `🔴 CIEGO: el trozo acotado no contiene \`${campo}\`, así que no son los parámetros del PDF `
      + 'de factura. La negación de abajo sería cierta por vacía.');
  }

  assert.equal(/\btags\b/.test(bloque), false,
    '🔴 `tags` ha entrado en los parámetros del PDF de la factura. Etiquetar una factura ya '
    + 'emitida cambiaría su PAPEL, y una factura emitida no se edita (regla 29): la etiqueta es '
    + 'de la FICHA, no del documento.');
});

test('SCRUM-595 · 🔴 REGLA 29: el camino de emisión NO escribe etiquetas', () => {
  // Una etiqueta NO se copia al emitir: la escribe el profesional sobre la ficha, cuando quiere.
  // Por eso este ticket no necesita un escritor en `emitInvoice` — y ése es exactamente el
  // bloqueo que dejó a SCRUM-602 (DOC-12) sin cablear el lado factura. Aquí no aplica, y este
  // guard es lo que impide que alguien lo introduzca «de paso».
  const codigo = leerFuente(path.join(RAIZ, 'src/modules/invoicing/domain/invoicing.service.ts'), {
    ancla: 'export async function emitInvoice',
  });
  const i = codigo.indexOf('export async function emitInvoice');
  const bloque = codigo.slice(i);

  // SUELO: se está mirando la emisión de verdad.
  for (const campo of ['allocateInvoiceNumber', 'invoice.create']) {
    assert.ok(bloque.includes(campo),
      `🔴 CIEGO: el trozo acotado no contiene \`${campo}\`; no es el camino de emisión.`);
  }

  assert.equal(/\btags\b/.test(bloque), false,
    '🔴 el camino de emisión escribe `tags`. Eso convierte la etiqueta en parte del documento que '
    + 'se emite, y una etiqueta añadida después de emitir no puede cambiar el documento: sólo su '
    + 'ficha. Además, MODIFICAR el camino de emisión es STOP del fundador (AA1.4).');
});

test('SCRUM-595 · 🔴 REGLA 29: ni el sellado ni el registro AEAT nombran las etiquetas', () => {
  // La huella ya se ejercitó arriba; esto cubre los otros ficheros del camino, que no se pueden
  // ejercitar sin base ni red. Sólo se LEEN.
  const ficheros = [
    'src/modules/invoicing/domain/verifactu.service.ts',
    'src/modules/fiscal/verifactu/registro.builder.ts',
    'src/lib/invoicing.ts',
  ];
  for (const rel of ficheros) {
    const codigo = leerFuente(path.join(RAIZ, rel));
    // SUELO por fichero: tras filtrar comentarios queda código de verdad.
    assert.ok(codigo.trim().length > 500,
      `🔴 CIEGO: ${rel} se ha quedado en ${codigo.trim().length} caracteres tras filtrar `
      + 'comentarios. Cualquier negación sobre eso es cierta por vacía.');
    assert.equal(/\btags\b/.test(codigo), false,
      `🔴 ${rel} nombra \`tags\`. El sellado y el registro fiscal son listas cerradas: una `
      + 'columna nueva no entra ahí, y si entra deja de ser una etiqueta de ficha.');
  }
});

test('SCRUM-595 · 🔴 `setInvoiceTags` escribe UN SOLO campo, y ese campo es `tags`', () => {
  // Ésta es la CONTRAPARTIDA de haber añadido `PUT /:id/tags` al ALLOWLIST de
  // `tests/scrum124-r29-no-borrado-facturas.test.mjs`. Aquella lista se ensancha en UNA ruta; lo
  // que esa ruta puede escribir queda atado aquí, más apretado que antes.
  //
  // Sin esto, la entrada del allowlist sería una puerta: mañana alguien le pasa un objeto de
  // cambios a esta función y la regla 29 se rompe sin tocar el guard que la vigila.
  const codigo = leerFuente(path.join(RAIZ, 'src/modules/system/invoiceAdmin.ts'), {
    ancla: 'export async function setInvoiceTags',
  });
  const i = codigo.indexOf('export async function setInvoiceTags');
  const cuerpo = codigo.slice(i, codigo.indexOf('\n}', i));

  assert.ok(cuerpo.includes('prisma.invoice.updateMany'),
    '🔴 CIEGO: el trozo acotado no contiene la escritura.');
  assert.match(cuerpo, /data: \{ tags: valor \}/,
    '🔴 `setInvoiceTags` ya no escribe EXACTAMENTE `{ tags: valor }`. Cualquier otro campo en ese '
    + '`data` es editar una factura emitida (regla 29), y este ticket lo dijo por escrito al '
    + 'meterse en el allowlist de SCRUM-124.');
  // TENENCIA en el WHERE (regla 2): un id ajeno no escribe y devuelve 0.
  assert.match(cuerpo, /where: \{ id, merchantId \}/,
    '🔴 la escritura no está acotada al merchant: se podría etiquetar la factura de otro.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL MECANISMO ES **UNO**, no dos — la Obligación 0 del encargo, convertida en guard
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-595 · 🔴 hay UNA sola definición de `normalizarTags` en `src/`', () => {
  // «Conviene que sea el mismo mecanismo, no dos.» La tentación al cablear el documento era
  // escribir su propia normalización, porque la de hoy vive en un fichero que se llama
  // `tagsDelCliente.ts`. Esto lo impide, hoy y en el próximo ticket.
  const encontrados = [];
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (e.name.endsWith('.ts') && /export function normalizarTags\b/.test(fs.readFileSync(p, 'utf8'))) {
        encontrados.push(path.relative(RAIZ, p).replace(/\\/g, '/'));
      }
    }
  };
  recorrer(path.join(RAIZ, 'src'));

  // SUELO: se ha encontrado la que sabemos que existe. Cero no es «no hay copias»: es que el
  // barrido no ha mirado.
  assert.ok(encontrados.length >= 1,
    '🔴 CIEGO: el barrido no encuentra NI UNA definición de `normalizarTags`, y sabemos que hay '
    + 'una (SCRUM-580). O el fichero se movió o el barrido no mira donde cree.');
  assert.deepEqual(encontrados, ['src/modules/system/tagsDelCliente.ts'],
    '🔴 hay más de una definición de `normalizarTags`, o se ha movido sin actualizar este guard: '
    + JSON.stringify(encontrados) + '. Dos normalizaciones de etiquetas divergen, y el día que '
    + 'diverjan el documento y el cliente guardarán cosas distintas bajo el mismo nombre.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL `ALTER` Y EL ESQUEMA · viajan JUNTOS, y cubren LOS DOS documentos
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-595 · 🔴 el DDL cubre `quotes` **y** `invoices`: una sola no es el ticket', () => {
  const sql = fs.readFileSync(path.join(RAIZ, 'docs/sql/scrum-595-etiquetas-del-documento.sql'), 'utf8');
  // Se mira sólo lo EJECUTABLE: el porqué de arriba nombra las dos tablas, y contarlas ahí daría
  // verde con un DDL que sólo toca una.
  const ejecutable = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

  assert.ok(/ALTER TABLE/i.test(ejecutable),
    '🔴 CIEGO: tras quitar los comentarios no queda ningún ALTER. Lo de abajo no probaría nada.');

  for (const tabla of ['quotes', 'invoices']) {
    assert.match(ejecutable, new RegExp(`ALTER TABLE "${tabla}"[\\s\\S]{0,120}?ADD COLUMN IF NOT EXISTS "tags" JSONB`, 'i'),
      `🔴 el DDL no añade \`tags\` a "${tabla}". El bloque aplica a los DOS documentos: con una `
      + 'sola tabla, etiquetar funcionaría en un documento y no en el otro — y eso, dice el '
      + 'encargo, es NO ESTAR HECHO.');
  }

  // ADITIVO: ni una forma destructiva. Un `DEFAULT` tampoco, y no es cosmético — con `DEFAULT
  // '[]'` un `IS NOT NULL` diría que TODOS los documentos tienen etiquetas.
  for (const prohibido of ['DROP', 'RENAME', 'TRUNCATE', 'DELETE', 'NOT NULL', 'DEFAULT']) {
    assert.equal(new RegExp(prohibido, 'i').test(ejecutable), false,
      `🔴 el DDL contiene «${prohibido}». Este ALTER tiene que ser ADITIVO PURO: nullable y sin `
      + 'default, porque `null` = «no se declararon etiquetas» y `[]` = «se miraron y no hay».');
  }
});

test('SCRUM-595 · 🔴 el esquema nombra `tags` en LOS DOS documentos, y su DDL va con él', () => {
  // 🔴 ESTE GUARD ESTABA AL REVÉS Y SE HA INVERTIDO A PROPÓSITO (7-sep-2026). Antes exigía que el
  // esquema NO nombrara la columna, porque el ALTER iba a ir en otro PR. La regla de la casa
  // cambió: el esquema, el SQL y el código viajan JUNTOS, y lo que gestiona el riesgo es el ORDEN
  // DEL MERGE —el fundador aplica y luego mergea—, no retener media función.
  //
  // Lo que sigue vigilado es lo mismo y por el mismo motivo: que el esquema y el DDL digan LO
  // MISMO sobre LOS DOS documentos. Un esquema que nombre una columna que su propio SQL no crea
  // es exactamente lo que impide arrancar producción (`schemaDrift`, esperado ⊆ real).
  const schema = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');

  const modeloDe = (nombre) => {
    const i = schema.indexOf(`model ${nombre} {`);
    assert.notEqual(i, -1, `🔴 CIEGO: no encuentro el modelo ${nombre} en el esquema.`);
    return schema.slice(i, schema.indexOf('\n}', i));
  };

  // SUELO: los recortes son los modelos de verdad.
  assert.match(modeloDe('Quote'), /quoteNumber/, '🔴 CIEGO: el recorte de Quote no parece Quote.');
  assert.match(modeloDe('Invoice'), /vfHash/, '🔴 CIEGO: el recorte de Invoice no parece Invoice.');
  // Control positivo del lector: en `Customer` está desde SCRUM-580.
  assert.match(modeloDe('Customer'), /^\s*tags\s+Json\?/m,
    '🔴 CIEGO: no veo `tags` ni en `Customer`, donde SÍ está (SCRUM-580). Este lector no sabe '
    + 'mirar, así que lo que diga de los documentos no significa nada.');

  const sql = fs.readFileSync(path.join(RAIZ, 'docs/sql/scrum-595-etiquetas-del-documento.sql'), 'utf8');

  for (const [modelo, tabla] of [['Quote', 'quotes'], ['Invoice', 'invoices']]) {
    assert.match(modeloDe(modelo), /^\s*tags\s+Json\? @map\("tags"\)/m,
      `🔴 el esquema NO nombra \`tags\` en \`${modelo}\`. El bloque aplica a los DOS documentos: `
      + 'con uno solo, etiquetar funcionaría en un documento y no en el otro.');
    // 🔴 Y LO QUE DE VERDAD IMPIDE ARRANCAR: que el esquema nombre algo que el DDL no crea.
    assert.ok(sql.includes(`ALTER TABLE "${tabla}"`),
      `🔴 el esquema nombra \`tags\` en \`${modelo}\` pero el DDL no toca "${tabla}". `
      + '`schemaDrift` compara esperado ⊆ real: una columna que el código nombra y la base no '
      + 'tiene IMPIDE ARRANCAR PRODUCCIÓN. Los dos van juntos o no va ninguno.');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUINTO ESLABÓN · SE RELEE, o el defecto es MUDO
//
// «Se escribe · se envía · se valida · se guarda · SE RELEE.» Y aquí NO es simétrico entre los dos
// documentos: eso se buscó ANTES de construir.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-595 · 🔴 el PRESUPUESTO proyecta a mano: sin `tags` ahí, el guardado se pierde MUDO', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/system/quoteAdmin.ts'), 'utf8');

  // LA LISTA. `listQuotesAdmin` no usa `select`: construye un objeto a mano con `.map()`.
  const lista = src.slice(src.indexOf('export async function listQuotesAdmin'),
                          src.indexOf('export async function setQuoteTags'));
  assert.ok(lista.includes('internalNotes: q.internalNotes'),
    '🔴 CIEGO: el trozo acotado no es la proyección de la lista.');
  assert.match(lista, /tags: q\.tags/,
    '🔴 la lista de presupuestos NO proyecta `tags`. El profesional escribiría la etiqueta, la '
    + 'lista se recargaría sin ella, volvería a escribirla — y la tanda seguiría VERDE, porque el '
    + 'dato SÍ estaría en la base. El defecto sería MUDO.');

  // EL DETALLE. Es OTRA proyección explícita, y se buscaron LAS DOS.
  const detalle = src.slice(src.indexOf('export async function getQuoteDetailAdmin'));
  assert.ok(detalle.includes('numeroConRevision'),
    '🔴 CIEGO: el trozo acotado no es la proyección del detalle.');
  assert.match(detalle, /tags: quote\.tags/,
    '🔴 el DETALLE del presupuesto no proyecta `tags`: la lista las enseñaría y la ficha saldría '
    + 'vacía. Es la misma pérdida muda en otra pantalla.');
});

test('SCRUM-595 · 🔴 la FACTURA no necesita ese eslabón, y hay que saber POR QUÉ', () => {
  // Su lista devuelve `findMany` SIN `select` al nivel del documento, así que la columna sale
  // sola. Si alguien pusiera ahí un `select` explícito, este guard cae y obliga a acordarse — de
  // `tags` y de todo lo demás.
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/system/invoiceAdmin.ts'), 'utf8');
  const lista = src.slice(src.indexOf('export async function listInvoicesAdmin'),
                          src.indexOf('export async function setInvoiceTags'));
  assert.ok(lista.includes('prisma.invoice.findMany'),
    '🔴 CIEGO: el trozo acotado no contiene el `findMany` de la lista de facturas.');
  // El `select` de las RELACIONES sí existe (customer, quote) y es legítimo; lo que no puede
  // aparecer es un `select` al nivel del propio `findMany`, que recortaría los escalares.
  const nivelSuperior = lista.slice(lista.indexOf('prisma.invoice.findMany'), lista.indexOf('include:'));
  assert.equal(/\bselect:/.test(nivelSuperior), false,
    '🔴 `listInvoicesAdmin` ha ganado un `select` explícito. Desde ese momento `tags` deja de '
    + 'salir sola y hay que nombrarla ahí, como en el presupuesto — si no, la etiqueta de una '
    + 'factura se guarda y no vuelve, en silencio.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA PANTALLA · el bloque aplica a los DOS documentos, y con la MISMA pieza
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-595 · 🔴 las DOS listas montan el filtro, y las DOS lo sacan de la MISMA pieza', () => {
  for (const rel of ['public/dashboard/js/quotesListView.js', 'public/dashboard/js/invoicesView.js']) {
    const codigo = leerFuente(path.join(RAIZ, rel), { ancla: 'window.filtroClientes' });
    assert.match(codigo, /FC\.filtrarPorEtiqueta\(/,
      `🔴 ${rel} no filtra por etiqueta: el selector no filtraría nada.`);
    assert.match(codigo, /FC\.etiquetasUsadas\(/,
      `🔴 ${rel} no saca las opciones del lote: o las inventa, o las pide a otro sitio.`);
    assert.match(codigo, /FC\.TEXTOS_ETIQUETAS\.sinFiltro/,
      `🔴 ${rel} no lee de la pieza el texto de «sin filtro»: si lo repite a mano, deriva.`);
    assert.match(codigo, /FC\.TEXTOS_ETIQUETAS\.columna/,
      `🔴 ${rel} no lee de la pieza el rótulo de la columna.`);
    assert.match(codigo, /FC\.tagsDe\(/,
      `🔴 ${rel} no pinta las etiquetas de cada fila.`);
    assert.match(codigo, /badge badge-slate/,
      `🔴 ${rel} no usa el componente del inventario (AB3) para el chip: eso es estilo inventado.`);
    // Y NO repite los literales aprobados a mano.
    assert.equal(/Todas las etiquetas/.test(codigo), false,
      `🔴 ${rel} repite un texto aprobado a mano. Dos copias de una microcopy divergen, y la `
      + 'segunda deja de estar aprobada sin que nadie lo decida (regla 30).');
  }
});

test('SCRUM-595 · 🔴 el `colSpan` de los vacíos SALE de la cabecera, no de un número a mano', () => {
  // Este ticket mete una columna en las dos listas. Los dos vacíos tenían su número escrito a
  // mano (7 y 6) y habrían quedado descuadrados — y un vacío descuadrado no lo ve ninguna tanda.
  // Es la lección que SCRUM-584 tuvo que aprender en la lista de clientes.
  for (const rel of ['public/dashboard/js/quotesListView.js', 'public/dashboard/js/invoicesView.js']) {
    const codigo = leerFuente(path.join(RAIZ, rel), { ancla: 'numeroDeColumnas' });
    const aMano = [...codigo.matchAll(/colSpan = (\d+)/g)];
    assert.deepEqual(aMano.map((m) => m[1]), [],
      `🔴 ${rel} tiene un \`colSpan\` con un número escrito a mano: en cuanto entre otra columna `
      + 'quedará descuadrado, y eso no lo ve ninguna tanda.');
    assert.match(codigo, /colSpan = numeroDeColumnas\(\)/,
      `🔴 ${rel} no deriva su \`colSpan\` de la cabecera.`);
    assert.match(codigo, /uiSkeletonRows\([^,]+, numeroDeColumnas\(\)/,
      `🔴 ${rel} pinta el esqueleto con un número de columnas distinto del de la tabla.`);
  }
});

test('SCRUM-595 · 🔴 las DOS fichas montan EL MISMO bloque de edición, no dos parecidos', () => {
  const fichas = [
    ['public/dashboard/js/quotesDetailView.js', '/admin/quotes/'],
    ['public/dashboard/js/invoiceDetailView.js', '/admin/invoices/'],
  ];
  for (const [rel, ruta] of fichas) {
    const codigo = leerFuente(path.join(RAIZ, rel), { ancla: 'montarEtiquetasDelDocumento' });
    assert.match(codigo, /window\.montarEtiquetasDelDocumento\(/,
      `🔴 ${rel} no monta la pieza compartida: si ha escrito su propio bloque, son dos.`);
    assert.ok(codigo.includes(ruta) && codigo.includes('/tags'),
      `🔴 ${rel} no apunta a su propio endpoint de etiquetas (${ruta}…/tags).`);
  }
});

test('SCRUM-595 · ⛔ la pieza de la ficha NO inventa ni un literal', () => {
  const rel = 'public/dashboard/js/etiquetasDelDocumento.js';
  const codigo = leerFuente(path.join(RAIZ, rel), { ancla: 'montarEtiquetasDelDocumento' });

  // El rótulo sale de la pieza de CONT-07, no se escribe aquí.
  assert.match(codigo, /FC\.TEXTOS_ETIQUETAS\.rotulo/,
    '🔴 el rótulo del bloque no sale de la pieza: escrito a mano, deriva (regla 30).');

  // 🔴 Y NO HAY PLACEHOLDER. El de CONT-07 nombra ejemplos de CLIENTE («comunidad,
  // administrador, urgencias…»), así que uno para documento sería un literal NUEVO — y el
  // microcopy es del fundador. Se describe en `docs/master/SCRUM-595.md` y NO se escribe.
  assert.equal(/placeholder\s*=/.test(codigo), false,
    '🔴 el campo ha ganado un `placeholder`. El de CONT-07 nombra ejemplos de CLIENTE y uno de '
    + 'documento sería microcopy NUEVA: es del fundador (regla 30). Se describe y se para.');

  // Los tres avisos son los MISMOS que ya usa el bloque de notas internas: ninguna ranura nueva.
  const notas = leerFuente(path.join(RAIZ, 'public/dashboard/js/quotesDetailView.js'), {
    ancla: 'Guardado automáticamente',
  });
  for (const aviso of ['Escribiendo…', '✓ Guardado automáticamente', 'Error al guardar']) {
    assert.ok(codigo.includes(aviso),
      `🔴 la pieza ya no usa «${aviso}»: si lo ha cambiado por otro texto, ése es literal nuevo.`);
    assert.ok(notas.includes(aviso),
      `🔴 «${aviso}» ya NO existe en el bloque de notas internas, así que este fichero ha dejado `
      + 'de reutilizar un texto que ya estaba en pantalla y ha pasado a estrenarlo.');
  }
});

test('SCRUM-595 · 🔴 `index.html` carga la pieza ANTES que quien la consume', () => {
  // Las vistas leen `window.filtroClientes` sin fallback, a propósito: degradar en silencio
  // escondería una pantalla rota. Lo que sostiene esa decisión es este orden.
  const html = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');
  const pos = (f) => {
    const i = html.indexOf('./js/' + f);
    assert.notEqual(i, -1, `🔴 CIEGO: ${f} no se carga en index.html.`);
    return i;
  };
  const pieza = pos('filtroClientes.js');
  for (const consumidor of ['etiquetasDelDocumento.js', 'quotesListView.js', 'invoicesView.js',
                            'quotesDetailView.js', 'invoiceDetailView.js']) {
    assert.ok(pieza < pos(consumidor),
      `🔴 ${consumidor} se carga ANTES que filtroClientes.js: leería \`window.filtroClientes\` `
      + 'sin que exista y la pantalla se caería al abrirla.');
  }
  for (const ficha of ['quotesDetailView.js', 'invoiceDetailView.js']) {
    assert.ok(pos('etiquetasDelDocumento.js') < pos(ficha),
      `🔴 la pieza de la ficha se carga DESPUÉS de ${ficha}, que es quien la monta.`);
  }
});

test('SCRUM-595 · 🔴 una revisión del presupuesto HEREDA sus etiquetas', async () => {
  // Lo cazó el guard de SCRUM-655b, que existe justo para esto: una columna nueva de `Quote` nace
  // SIN clasificar, y sin clasificar simplemente no viaja. El defecto sería MUDO — revisar un
  // presupuesto lo sacaría del filtro «obra puerto», y el profesional vería una lista con un
  // documento menos sin forma de saber que le falta.
  const { REVISION_HEREDA } = await import('../dist/modules/quotes/domain/revision.js');
  assert.ok(REVISION_HEREDA.length > 10,
    '🔴 CIEGO: la lista de campos heredados casi no tiene campos; pertenecer a ella no diría nada.');
  assert.ok(REVISION_HEREDA.includes('tags'),
    '🔴 `tags` ha dejado de heredarse al revisar. Una revisión es otra versión del MISMO trabajo: '
    + 'la etiqueta no caduca porque cambie un precio.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO · y su suelo de ceguera
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-595 · 🔴 SUELO: el censo se declara CIEGO si no encuentra ni un documento', () => {
  // Probado además POR MUTACIÓN el 7-sep-2026 (consta en `docs/master/SCRUM-595.md`): forzando
  // cero documentos sale con código 2, y rompiendo el control positivo también. Aquí queda el
  // guard estático para que nadie lo retire sin darse cuenta.
  const src = fs.readFileSync(path.join(RAIZ, 'scripts/censo-etiquetas-del-documento.mjs'), 'utf8');
  const ejecutable = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  assert.ok(ejecutable.includes('process.exit(2)'),
    '🔴 CIEGO: el censo no sale nunca con código 2. Un censo que siempre devuelve 0 se lee como '
    + 'verde aunque no haya mirado nada.');
  assert.match(ejecutable, /totalDocumentos === 0/,
    '🔴 el censo ha perdido su SUELO de filas. Sobre una base vacía «ningún documento tiene '
    + 'etiquetas» es cierto y no dice nada: eso no puede salir en verde.');
  assert.match(ejecutable, /faltanControles/,
    '🔴 el censo ha perdido su CONTROL POSITIVO de columnas. Sin él, «no está» y «no se vio '
    + 'nada» se leen igual.');
  // ── Y NO TOCA LA BASE: es un censo, no una migración ──────────────────────────────────
  //
  // 🔴 ESTA COMPROBACIÓN SE CAZÓ A SÍ MISMA, y se deja escrito porque es la lección de SCRUM-349
  // apareciendo otra vez. Buscaba la PALABRA `ALTER` y saltó cuando el censo ganó un
  // `console.log('… la toca el ALTER')` — texto de pantalla, no SQL. Un guard que confunde una
  // palabra con una sentencia acusa al inocente, y quien lo ve en rojo aprende a ignorarlo.
  //
  // Ahora busca FORMAS DE SENTENCIA, no palabras sueltas. Es MÁS estricto donde importa: `UPDATE`
  // a secas no distinguía `prisma.quote.update` de un UPDATE de SQL, y ahora `UPDATE … SET` sí.
  const ESCRITURAS = [
    /\bALTER\s+TABLE\b/i, /\bDROP\s+(TABLE|COLUMN|INDEX)\b/i, /\bTRUNCATE\b/i,
    /\bINSERT\s+INTO\b/i, /\bUPDATE\s+[\w".]+\s+SET\b/i, /\bDELETE\s+FROM\b/i,
  ];
  for (const forma of ESCRITURAS) {
    assert.equal(forma.test(ejecutable), false,
      `🔴 el censo contiene una escritura (${forma}). Sólo lee: el ALTER se aplica con `
      + '`scripts/aplicar-sql-dev.mjs`, que comprueba el destino, o lo aplica el fundador.');
  }
  // 🔴 CONTROL POSITIVO DEL DETECTOR: que sepa ver una escritura cuando la hay. Sin esto, seis
  // negaciones sobre un texto que el detector no sabe leer darían el mismo verde.
  const CEBO = 'await prisma.$executeRawUnsafe("ALTER TABLE quotes ADD COLUMN x TEXT");';
  assert.ok(ESCRITURAS.some((f) => f.test(CEBO)),
    '🔴 CIEGO: el detector no reconoce ni un ALTER TABLE evidente. Sus «no hay escrituras» de '
    + 'arriba no significan nada.');
});
