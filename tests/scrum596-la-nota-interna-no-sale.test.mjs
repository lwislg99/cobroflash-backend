// tests/scrum596-la-nota-interna-no-sale.test.mjs — SCRUM-596 (DOC-06)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA NOTA INTERNA NO SALE. NI EN EL PDF, NI EN LA PÁGINA QUE VE EL CLIENTE.
//
// `Quote.internalNotes` existe desde mayo-2026 y su comentario en el esquema ya lo dice —«Notas
// privadas del profesional, nunca visibles al cliente»—. Lo que NO existía hasta este fichero es
// la PRUEBA, que es lo que DOC-06 pide literalmente. Y una promesa escrita en un comentario del
// esquema es exactamente la clase de garantía que este árbol no acepta.
//
// ── 🔴 POR QUÉ HACE FALTA, SI «NO SE PINTA EN NINGÚN SITIO» ────────────────────────────────
//
// Porque el campo SÍ LLEGA a la landing, y eso está medido: `loadQuote` (la carga de la página
// del cliente) usa `include`, no `select`, y en Prisma `include` trae **todos los escalares del
// modelo**. O sea que `internalNotes` está en memoria, dentro del objeto que la página compone.
// Hoy no sale porque nadie escribe esa propiedad — por OMISIÓN, no por construcción. Ese es
// justo el defecto que se descubre el día que alguien serializa el objeto entero.
//
// En el PDF la situación es la contraria y conviene no confundirlas:
//
//   · PDF      → fuera por CONSTRUCCIÓN. `ParamsPdfPresupuesto` no declara el campo y
//                `paramsDePresupuestoParaPdf` es la lista única (SCRUM-734). Lo que no está en
//                el tipo no puede pintarse, y `Completo<T>` impide olvidarse de un campo.
//   · LANDING  → fuera por OMISIÓN. El dato está cargado; sólo falta que alguien lo escriba.
//
// ── QUÉ SE REUSA, Y POR QUÉ NO SE ESCRIBE OTRO INSTRUMENTO ─────────────────────────────────
//
// `_texto-del-pdf.mjs` (SCRUM-659) lee el texto de un PDF de verdad y `_solo-codigo.mjs`
// (SCRUM-696) quita comentarios y cadenas antes de mirar el código. Los dos existen y los dos
// están vigilados. Escribir aquí un extractor propio sería el escalón 4 del listón teniendo el 2
// disponible — y además un segundo lector de PDF que nadie vigila.
//
// ── ⛔ LO QUE ESTE FICHERO NO TOCA ─────────────────────────────────────────────────────────
//
// `pdf.service.ts` NO se toca (es de S3 y es camino de emisión): aquí se LEE su salida. Tampoco
// se exporta nada nuevo de la landing para poder medirla — se observa su fuente con AST, que es
// lo que manda cuando la alternativa es modificar el producto para hacerlo observable.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extraerTextoPdf, vecesEnPdf, lineasDePdf } from './_texto-del-pdf.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const { paramsDePresupuestoParaPdf } = await import('../dist/modules/quotes/domain/presupuestoParaPdf.js');

/**
 * LAS MUTACIONES QUE TUMBAN A ESTE GUARD. Contrato de `scripts/meta-guard-mutaciones.mjs`.
 *
 * Las dos imitan el defecto REAL que cada mitad promete cazar: que la nota cruce la lista única
 * del PDF, y que la página del cliente empiece a leerla. Las dos se han ejecutado a mano antes de
 * declararlas —una declaración sin comprobar es peor que ninguna, porque parece cobertura— y cada
 * una tumbó a SU test y sólo a él.
 *
 * 🛑 NO SE DECLARA LA TERCERA, y el motivo es un STOP: la mutación que probaría «el PDF no imprime
 * la nota» tendría que añadir el campo a `pdf.service.ts`, que es **camino de emisión** — ahí vive
 * `generateInvoicePdf`. El meta-guard APLICA lo que se le declara, así que declararla sería
 * mandarle mutar el camino de emisión en cada pasada. En su lugar, ese detector se prueba con el
 * rojo provocado de «EL ROJO: el detector VE la nota cuando SÍ sale» y con el fuente sintético de
 * «EL DETECTOR DEL TIPO SE VE EN ROJO», ninguno de los cuales toca el producto.
 */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/quotes/domain/presupuestoParaPdf.ts',
    de: 'quoteId: quote.id,',
    a: 'quoteId: quote.id, internalNotes: quote.internalNotes,',
    cae: 'SCRUM-596 · 🔴 LA NOTA INTERNA NO PASA EL PROYECTOR, y la fila SÍ la traía',
  },
  {
    fichero: 'src/modules/system/app/routes/quoteDecisionLanding.routes.ts',
    de: "const displayNum = q ? (q.quoteNumber ?? q.id) : '';",
    a: "const displayNum = q ? (q.quoteNumber ?? q.internalNotes ?? q.id) : '';",
    cae: 'SCRUM-596 · 🔴 LA LANDING DEL CLIENTE NO LEE LA NOTA INTERNA',
  },
];

/**
 * El texto de la nota. SIN ESPACIOS y improbable, por dos motivos:
 * si aparece en el papel no es coincidencia, y un token sin espacios no lo puede partir el salto
 * de línea de `pdfkit` — que convertiría un fallo real en un verde por trocear la aguja.
 */
const NOTA = 'QA596NOTAINTERNA';

/** Lo que el cliente SÍ tiene que ver. Es el control positivo de todo el fichero. */
const CONCEPTO = 'Sustitucion de bajante';
const CLIENTE = 'Talleres Ruiz';

/**
 * La fila TAL COMO LLEGA de la base: con `internalNotes` dentro, porque `include` lo trae.
 *
 * Escribirla sin el campo sería fabricar el resultado: probaría que un objeto que no tiene la
 * nota no imprime la nota, que no es lo que hay que demostrar.
 */
function filaConNotaInterna(extra = {}) {
  return {
    id: 5960,
    quoteNumber: 596,
    currency: 'EUR',
    total: '121.00',
    lines: [{ concept: CONCEPTO, qty: 1, price: 100, tax: 0.21 }],
    internalNotes: NOTA,
    ...extra,
  };
}

const MERCHANT = { name: 'QA Fontaneria', legalName: 'QA SL', taxId: 'B00000000', country: 'ES' };
const CUSTOMER = { name: CLIENTE };

async function pdfDe(params) {
  const { generateQuotePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateQuotePdf(params);
  try { return fs.readFileSync(outPath); } finally { fs.rmSync(outPath, { force: true }); }
}

/** Todos los valores de un objeto, en plano, para poder preguntar si la nota está EN ALGUNO. */
function valoresPlanos(v, acc = []) {
  if (v == null) return acc;
  if (typeof v === 'object') { for (const x of Object.values(v)) valoresPlanos(x, acc); return acc; }
  acc.push(String(v));
  return acc;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① LA LISTA ÚNICA — el proyector no deja pasar la nota, aunque la fila la traiga
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-596 · SUELO: el proyector COPIA lo que debe (si no, lo de abajo no mide nada)', () => {
  const p = paramsDePresupuestoParaPdf({ quote: filaConNotaInterna(), merchant: MERCHANT, customer: CUSTOMER });
  assert.equal(p.quoteId, 5960, '🔴 el proyector no ha copiado ni el id: no está proyectando nada.');
  assert.equal(p.quoteNumber, 596);
  assert.equal(p.customer.name, CLIENTE, '🔴 no llega ni el nombre del cliente.');
  assert.ok(Array.isArray(p.lines) && p.lines.length === 1, '🔴 no llegan las líneas.');
});

test('SCRUM-596 · 🔴 LA NOTA INTERNA NO PASA EL PROYECTOR, y la fila SÍ la traía', () => {
  const quote = filaConNotaInterna();
  assert.equal(quote.internalNotes, NOTA, '🔴 la fila de prueba no lleva la nota: el caso está vacío.');

  const p = paramsDePresupuestoParaPdf({ quote, merchant: MERCHANT, customer: CUSTOMER });

  assert.equal(Object.prototype.hasOwnProperty.call(p, 'internalNotes'), false,
    '🔴 EL PROYECTOR COPIA `internalNotes` A LOS PARÁMETROS DEL PDF. Es la lista única de '
    + 'SCRUM-734: lo que entra aquí puede acabar pintado en el papel del cliente.');

  const dentro = valoresPlanos(p).filter((s) => s.includes(NOTA));
  assert.deepEqual(dentro, [],
    `🔴 LA NOTA VIAJA DENTRO DE OTRO CAMPO de los parámetros del PDF: ${JSON.stringify(dentro)}. `
    + 'No basta con que no exista la clave: el texto no puede ir escondido en ninguna.');

  // 🔴 Y LA MISMA REGLA SOBRE EL FUENTE, que NO es redundante — lo demostró el meta-guard.
  //
  // Las dos comprobaciones de arriba ejecutan `dist/`. El defecto, en cambio, se ESCRIBE en el
  // `.ts`. Con sólo las de arriba, este guard queda ciego ante un árbol sin recompilar: es
  // exactamente lo que pasó al declararlo — `meta:mutaciones` muta el fuente, no recompila, y
  // declaró MUDO a un guard que a mano SÍ caía. Es la frontera `dist/` de SCRUM-763.
  //
  // Así que la regla se vigila donde se escribe Y donde se ejecuta. Si algún día divergen, el
  // que manda es el fuente: es lo que se va a desplegar.
  const proyector = soloCodigo(leer('src/modules/quotes/domain/presupuestoParaPdf.ts'), 'proyector.ts');
  assert.ok(/\bquoteId\b/.test(proyector),
    '🔴 SUELO: no veo ni `quoteId` en el fuente del proyector, así que no estoy mirando el fichero '
    + 'que creo y su «no está internalNotes» no vale nada.');
  assert.equal(/\binternalNotes\b/.test(proyector), false,
    '🔴 EL FUENTE DEL PROYECTOR NOMBRA `internalNotes`. Aunque `dist/` todavía no lo refleje, eso '
    + 'es lo que se despliega: la nota privada está a un paso del papel del cliente.');
});

/**
 * El bloque de un tipo, acotado por llaves desde su declaración.
 *
 * 🔴 ESTÁ EXTRAÍDO A PROPÓSITO, y el motivo es un STOP: la única forma de ver este detector en
 * rojo contra el producto sería añadir `internalNotes` a `pdf.service.ts`, que es **camino de
 * emisión** (ahí vive `generateInvoicePdf`). No se toca, ni siquiera de forma efímera. Así que el
 * detector se prueba contra un fuente SINTÉTICO —abajo— y el producto sólo se lee.
 */
function bloqueDelTipo(fuente, nombre) {
  const i = fuente.indexOf(nombre);
  if (i < 0) return null;
  const desde = fuente.slice(i);
  let prof = 0;
  for (let k = 0; k < desde.length; k++) {
    if (desde[k] === '{') prof++;
    else if (desde[k] === '}') { prof--; if (prof === 0) return desde.slice(0, k); }
  }
  return null;
}

test('SCRUM-596 · 🔴 EL DETECTOR DEL TIPO SE VE EN ROJO — contra un fuente sintético', () => {
  // Sin esto, el test de abajo sería una decoración: un detector que nunca se ha visto encontrar
  // el defecto no puede afirmar que no está.
  const CON = 'export type ParamsPdfPresupuesto = { quoteId: number; customer: { name: string }; internalNotes?: string | null; };';
  const SIN = 'export type ParamsPdfPresupuesto = { quoteId: number; customer: { name: string }; total: string; };';
  assert.equal(/\binternalNotes\b/.test(bloqueDelTipo(CON, 'ParamsPdfPresupuesto')), true,
    '🔴 EL DETECTOR NO VE LA DECLARACIÓN QUE TIENE DELANTE: no sirve para afirmar que no está.');
  assert.equal(/\binternalNotes\b/.test(bloqueDelTipo(SIN, 'ParamsPdfPresupuesto')), false,
    '🔴 el detector dice que sí en un tipo que no la declara: da falsos positivos.');
  assert.equal(bloqueDelTipo('nada que ver', 'ParamsPdfPresupuesto'), null,
    '🔴 sin el tipo delante tiene que declararse CIEGO (null), no contestar «no está».');
});

test('SCRUM-596 · 🔴 ANTI-ARREGLO-SILENCIOSO: el tipo del PDF NO declara la nota', () => {
  // Si alguien añade `internalNotes` a `ParamsPdfPresupuesto`, `Completo<T>` obliga al proyector a
  // rellenarlo y el campo queda a un paso del papel. El compilador lo forzará a decidir; esto
  // además lo DICE, para que la decisión no pase por un diff sin que nadie la lea.
  const fuente = soloCodigo(leer('src/modules/invoicing/infra/pdf/pdf.service.ts'), 'pdf.service.ts');
  const bloque = bloqueDelTipo(fuente, 'ParamsPdfPresupuesto');
  assert.ok(bloque, '🔴 no encuentro `ParamsPdfPresupuesto`: el instrumento está mirando otro sitio.');
  assert.ok(/\bquoteId\b/.test(bloque) && /\bcustomer\b/.test(bloque),
    '🔴 SUELO: el bloque acotado no contiene ni `quoteId` ni `customer`, así que no es el tipo del '
    + 'PDF y su «no está internalNotes» no vale nada.');
  assert.equal(/\binternalNotes\b/.test(bloque), false,
    '🔴 `ParamsPdfPresupuesto` DECLARA `internalNotes`. El papel del cliente puede pintarla.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL PAPEL — generado de verdad y leído de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-596 · SUELO: el lector VE un PDF de verdad', async () => {
  const params = paramsDePresupuestoParaPdf({ quote: filaConNotaInterna(), merchant: MERCHANT, customer: CUSTOMER });
  const r = lineasDePdf(await pdfDe(params));
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un lector ciego diría que la nota `
    + 'no está por el mismo motivo por el que no ve nada.');
  assert.ok(r.lineas.length > 5,
    `🔴 LECTOR CIEGO: sólo ${r.lineas.length} líneas. «No está la nota» y «no supe mirar» serían el `
    + 'mismo resultado con significados opuestos.');
});

test('SCRUM-596 · 🔴 CONTROL POSITIVO: lo que SÍ debe ver el cliente, sale', async () => {
  const params = paramsDePresupuestoParaPdf({ quote: filaConNotaInterna(), merchant: MERCHANT, customer: CUSTOMER });
  const { texto } = extraerTextoPdf(await pdfDe(params));
  assert.ok(vecesEnPdf(texto, CONCEPTO) > 0, `🔴 no encuentro ni el concepto («${CONCEPTO}») en el papel.`);
  assert.ok(vecesEnPdf(texto, CLIENTE) > 0, `🔴 no encuentro ni el nombre del cliente en el papel.`);
});

test('SCRUM-596 · 🔴 LA NOTA INTERNA NO ESTÁ EN EL PDF', async () => {
  const params = paramsDePresupuestoParaPdf({ quote: filaConNotaInterna(), merchant: MERCHANT, customer: CUSTOMER });
  const { texto } = extraerTextoPdf(await pdfDe(params));
  assert.equal(vecesEnPdf(texto, NOTA), 0,
    '🔴 LA NOTA PRIVADA DEL PROFESIONAL ESTÁ EN EL PAPEL QUE LEE SU CLIENTE. Es texto escrito para '
    + 'no salir de casa: precios de compra, avisos sobre el propio cliente, lo que sea.');
  // Y tampoco el NOMBRE del campo, que delataría que existe aunque no se viera el texto.
  for (const n of ['internalNotes', 'Nota interna', 'nota interna']) {
    assert.equal(vecesEnPdf(texto, n), 0, `🔴 el documento nombra «${n}».`);
  }
});

test('SCRUM-596 · 🔴 EL ROJO: el detector VE la nota cuando SÍ sale', async () => {
  // «Un guard de fuga que no se ha visto caer ante la fuga no protege nada.» La fuga se provoca por
  // el único camino que no toca `pdf.service.ts`: el mismo texto, metido en un campo que el
  // documento SÍ imprime.
  //
  // ⚠️ ESTO PRUEBA EL DETECTOR, no que el proyector filtre — la distinción honesta. Demuestra que
  // si la nota llegara al papel, los tests de arriba lo verían.
  const quote = filaConNotaInterna({ lines: [{ concept: `${CONCEPTO} ${NOTA}`, qty: 1, price: 100, tax: 0.21 }] });
  const params = paramsDePresupuestoParaPdf({ quote, merchant: MERCHANT, customer: CUSTOMER });
  const { texto } = extraerTextoPdf(await pdfDe(params));
  assert.ok(vecesEnPdf(texto, NOTA) > 0,
    '🔴 EL DETECTOR NO VE UNA FUGA QUE ESTÁ DELANTE: con el texto impreso en el papel ha dado '
    + 'verde. No protege nada, y hay que arreglarlo ANTES de fiarse de los casos de arriba.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ LA PÁGINA DEL CLIENTE — donde el dato SÍ está cargado
// ═════════════════════════════════════════════════════════════════════════════════════════

const LANDING = 'src/modules/system/app/routes/quoteDecisionLanding.routes.ts';

test('SCRUM-596 · SUELO: el instrumento VE lo que la landing lee de la fila', () => {
  // Sin esto, «no lee internalNotes» no se distingue de «no supe leer el fichero».
  const codigo = soloCodigo(leer(LANDING), 'landing.ts');
  const leidos = [...codigo.matchAll(/\bquote\.([a-zA-Z]+)/g)].map((m) => m[1]);
  assert.ok(leidos.length > 5,
    `🔴 sólo veo ${leidos.length} lecturas de \`quote.\` en la landing: el instrumento no está `
    + 'mirando el fichero que cree.');
});

test('SCRUM-596 · 🔴 LA LANDING DEL CLIENTE NO LEE LA NOTA INTERNA', () => {
  // 🔴 Y AQUÍ ESTÁ EL RIESGO QUE ESTO VIGILA, medido el 5-sep-2026: `loadQuote` usa `include` y no
  // `select`, así que la fila llega ENTERA y `internalNotes` está en memoria. Que no salga depende
  // hoy de que nadie escriba la propiedad. Esto lo convierte en una regla con rojo.
  const codigo = soloCodigo(leer(LANDING), 'landing.ts');
  assert.equal(/\binternalNotes\b/.test(codigo), false,
    '🔴 LA PÁGINA QUE VE EL CLIENTE NOMBRA `internalNotes`. La fila llega entera por `include`, así '
    + 'que basta escribir la propiedad para que la nota privada acabe en el navegador del cliente.');
});

test('SCRUM-596 · EL LECTOR OFICIAL ME VE — la declaracion no vale si el meta-guard no la lee', async () => {
  const { mutacionesDeclaradas } = await import('../scripts/meta-guard-mutaciones.mjs');
  const mias = mutacionesDeclaradas(leer('tests/scrum596-la-nota-interna-no-sale.test.mjs'), 'scrum596.test.mjs');

  assert.equal(mias.length, MUTACIONES_QUE_ME_TUMBAN.length,
    `\u{1F534} EL META-GUARD VE ${mias.length} DE MIS ${MUTACIONES_QUE_ME_TUMBAN.length} MUTACIONES. `
    + 'Una declaracion con forma propia sale INVISIBLE y el meta-guard no lo dice: pasaria por '
    + 'cobertura sin serlo.');

  for (const m of mias) {
    const enDisco = leer(m.fichero);
    assert.equal(enDisco.split(m.de).length - 1, 1,
      `\u{1F534} el texto \`de\` de la mutacion no aparece EXACTAMENTE UNA VEZ en ${m.fichero}: `
      + 'una mutacion ambigua muta otra cosa, o no muta nada y se lee como guard mudo.');
    assert.ok(MUTACIONES_QUE_ME_TUMBAN.some((d) => d.cae === m.cae),
      `\u{1F534} el meta-guard ha leido un \`cae\` que no es el que escribi: ${m.cae}`);
  }
});
