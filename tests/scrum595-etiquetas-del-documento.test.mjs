// tests/scrum595-etiquetas-del-documento.test.mjs — SCRUM-595 (DOC-05)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LAS ETIQUETAS DEL DOCUMENTO · LOS CONTROLES DEL ENCARGO
//
// LA VÍCTIMA: hoy el profesional no puede etiquetar sus documentos de ninguna forma. No existe.
//
// 🔴 ESTOS TESTS EJERCITAN EL MECANISMO DE CONT-07 **SIN TOCARLO**, sobre PRESUPUESTOS Y FACTURAS.
// Ése es su objeto: la Obligación 0 del encargo pregunta si el mecanismo de SCRUM-580 (CONT-07)
// es reutilizable o está atado a `Customer`, y la respuesta no se afirma — se EJECUTA. Si estos
// casos pasan, la capa de decisión sirve a los dos documentos tal cual está escrita; si fallan,
// está atada y la respuesta era otra.
//
// ── LO QUE ESTE FICHERO **NO** PRUEBA, Y SE DICE ANTES QUE NADA ─────────────────────────────
// No hay ni una lectura ni una escritura contra la base, y no es un olvido: **las columnas
// `quotes.tags` e `invoices.tags` NO EXISTEN todavía**. Medido el 7-sep-2026 contra desarrollo con
// `node scripts/censo-etiquetas-del-documento.mjs`: las dos AUSENTES, con `customers.tags` y
// `quotes.lines` como controles positivos presentes, sobre 15 presupuestos y 5 facturas.
//
// El `ALTER` está escrito (`docs/sql/scrum-595-etiquetas-del-documento.sql`) y **no aplicado**: lo
// aplica el fundador. El orden es inviolable y costó nueve días sin desplegar (SCRUM-580):
// `schemaDrift` compara esperado ⊆ real al arrancar, así que un `prisma/schema.prisma` que nombre
// una columna que la base no tiene **impide arrancar producción**.
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
  // Y «garantía» sólo está en el lote porque hay UNA FACTURA que la lleva junto a un presupuesto:
  // si el recolector mirara sólo un tipo, seguiría saliendo. Se comprueba con la que es EXCLUSIVA
  // de los presupuestos.
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE PROTEGE LA REGLA 29
//
// «Etiquetar una factura YA EMITIDA no cambia su número, ni su total, ni su PDF. Mídelo, no lo
//  supongas.»
//
// ⚠️ Estos tres casos SÓLO LEEN el camino de emisión y el sellado. No extraen un helper, no
// exportan nada y no cambian una firma: es explícitamente lo que la regla 38 permite hacer sin
// pedir GO, y lo que separa un guard de tocar el sellado.
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
  // La huella ya se ejercitó arriba; esto cubre los otros dos ficheros del camino, que no se
  // pueden ejercitar sin base ni red. Sólo se LEEN.
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL MECANISMO ES **UNO**, no dos — que es la Obligación 0 del encargo, convertida en guard
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-595 · 🔴 hay UNA sola definición de `normalizarTags` en `src/`', () => {
  // «Conviene que sea el mismo mecanismo, no dos.» El día que el lado documento se cablee (③), la
  // tentación es escribir su propia normalización porque la de hoy vive en un fichero que se
  // llama `tagsDelCliente.ts`. Esto lo impide antes de que pase.
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
// EL `ALTER` · escrito, NO aplicado — y cubre LOS DOS documentos
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

test('SCRUM-595 · 🔴 EL ORDEN: el esquema NO nombra `tags` en los documentos hasta que el ② esté aplicado', () => {
  // `schemaDrift` compara esperado ⊆ real AL ARRANCAR. Una columna que el esquema nombra y la base
  // no tiene IMPIDE ARRANCAR PRODUCCIÓN. Ésta es la secuencia que costó nueve días sin desplegar
  // (SCRUM-580), y por eso el esquema entra en el ③, con el código y los tests, cuando las TRES
  // bases tengan la columna.
  //
  // ⚠️ ESTE GUARD SE INVIERTE EN EL ③, y eso es lo correcto: entonces afirmará la PRESENCIA. Lo
  // que no puede pasar es que el esquema se adelante al ALTER sin que nada chille.
  const schema = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');

  const modeloDe = (nombre) => {
    const i = schema.indexOf(`model ${nombre} {`);
    assert.notEqual(i, -1, `🔴 CIEGO: no encuentro el modelo ${nombre} en el esquema.`);
    return schema.slice(i, schema.indexOf('\n}', i));
  };

  // SUELO: el recorte es el modelo de verdad.
  assert.match(modeloDe('Quote'), /quoteNumber/, '🔴 CIEGO: el recorte de Quote no parece Quote.');
  assert.match(modeloDe('Invoice'), /vfHash/, '🔴 CIEGO: el recorte de Invoice no parece Invoice.');
  // Y el control positivo de que este guard SABE ver un `tags` cuando lo hay: en `Customer` está.
  assert.match(modeloDe('Customer'), /^\s*tags\s+Json\?/m,
    '🔴 CIEGO: no veo `tags` ni en `Customer`, donde SÍ está (SCRUM-580). Este guard no sabe '
    + 'mirar, así que su «no está» en los documentos no significa nada.');

  for (const modelo of ['Quote', 'Invoice']) {
    assert.equal(/^\s*tags\s+Json\?/m.test(modeloDe(modelo)), false,
      `🔴 \`prisma/schema.prisma\` ya nombra \`tags\` en \`${modelo}\`, y el ALTER de este ticket `
      + 'NO consta aplicado en las tres bases. Si esta rama se mergea, `schemaDrift` se niega a '
      + 'arrancar y PRODUCCIÓN NO LEVANTA. El orden es inviolable: las tres bases primero.');
  }
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
  // Y no toca la base: es un censo, no una migración.
  for (const escritura of ['INSERT', 'UPDATE', 'DELETE', 'ALTER', 'DROP']) {
    assert.equal(new RegExp(`\\b${escritura}\\b`).test(ejecutable), false,
      `🔴 el censo contiene «${escritura}». Sólo lee: el ALTER lo aplica el fundador.`);
  }
});
