// tests/scrum632-la-descripcion-de-la-linea.test.mjs — SCRUM-632
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA LÍNEA GANA DESCRIPCIÓN PROPIA — y son DOS datos, no uno.
//
// DECISIÓN DEL FUNDADOR (8-sep-2026): «la descripción del presupuesto/factura es DISTINTA a la de
// producto: es algo que aparece en el doc, que se utiliza para poner el texto que quiera el
// merchant».
//
//   · descripción del PRODUCTO → vive en el catálogo, la escribe quien lo mantiene
//   · descripción de la LÍNEA  → vive en el documento, la escribe el profesional, y es SUYA
//
// Hasta hoy sólo existía la primera: la de la línea colgaba de
// `conceptInput.dataset.pfProductDescription`, o sea DEL INPUT DEL CONCEPTO. Por eso teclear el
// concepto se la llevaba por delante — el código creía que sólo había una.
//
// ── EL DOM DE JUGUETE, y por qué el front se EJECUTA ────────────────────────────────────────
// El módulo del panel es un script clásico enorme que no se puede importar. Lo que se puede
// —y es lo que hace la casa desde SCRUM-229/500/655— es leer su fuente y EJECUTAR las piezas que
// deciden, con dobles. Un guard de texto diría «la clave está escrita»; esto comprueba qué SALE.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/quotesView.js');

const CONCEPTO = 'Sustitución de grifo monomando — baño';
const DESC_LINEA = 'Texto que escribe el profesional para ESTE documento, no el del catálogo.';

async function textoDe(gen, lines, extra) {
  const { outPath } = await gen({ ...extra, lines });
  try {
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}`);
    return r.texto;
  } finally { fs.rmSync(outPath, { force: true }); }
}

const FACTURA = { number: 'F-2026-QA632', merchant: { name: 'QA' }, customer: { name: 'C' }, currency: 'EUR', total: '121.00', qrData: 'x', type: 'F1' };

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SUELO · el barrido de sitios que borran la descripción no puede dar CERO
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-632 · 🔴 SUELO: el barrido VE los sitios que sueltan el producto, y no son cero', () => {
  const fuente = soloEjecutable(fs.readFileSync(VISTA, 'utf8'));
  const sueltan = (fuente.match(/pfProductName\s*=\s*""/g) || []).length;
  assert.ok(sueltan >= 3,
    `🔴 CIEGO: el barrido ve ${sueltan} sitios que sueltan el producto y la medición de SCRUM-632 `
    + 'encontró TRES. Si el detector se rompió, «ninguno borra la descripción» sería cierto sobre '
    + 'nada — y ése es justo el error que este ticket viene a cerrar.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ROJO 2 (el que duele) · editar el concepto YA NO borra la descripción
//
// Se comprueba por CONSTRUCCIÓN y sobre el fuente EJECUTABLE: los dos sitios de DEFECTO ya no
// tocan la descripción, y el LEGÍTIMO —el que vacía la línea entera— sí. Es la forma de
// demostrar que «desaparece por construcción» y no «se ha tenido cuidado».
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-632 · 🔴 los dos sitios de DEFECTO ya no borran la descripción; el LEGÍTIMO sigue', () => {
  const fuente = soloEjecutable(fs.readFileSync(VISTA, 'utf8'));

  // Los dos de defecto sueltan el producto SIN tocar la descripción.
  const borranDataset = (fuente.match(/pfProductDescription\s*=\s*""/g) || []).length;
  assert.equal(borranDataset, 1,
    `🔴 quedan ${borranDataset} sitios que borran \`pfProductDescription\`, y sólo puede quedar UNO: `
    + 'el que vacía la línea entera. Los otros dos eran el defecto — se llevaban por delante un '
    + 'texto que había escrito el profesional mientras tecleaba el concepto.');

  // Y el que queda es el que limpia la línea entera: ahí se vacía TAMBIÉN el campo.
  assert.match(fuente, /if \(descInput\) descInput\.value = ""/,
    '🔴 el sitio legítimo —el que vacía la línea— ya no limpia el campo de descripción. Entonces '
    + 'una línea «limpia» conservaría el texto de la anterior, que es un dato falso sobre ella.');
});

test('SCRUM-632 · 🔴 la descripción NO cuelga ya del input del concepto: es un campo propio', () => {
  const fuente = soloEjecutable(fs.readFileSync(VISTA, 'utf8'));

  assert.match(fuente, /const descInput = document\.createElement\("textarea"\)/,
    '🔴 no existe el campo de descripción de la línea. Sin él, el dato sigue colgando del '
    + '`dataset` del concepto y vuelve el defecto entero.');
  // Lo que se ENVÍA y lo que se PREVISUALIZA salen del campo, no del `dataset`.
  assert.match(fuente, /description: \(line\.descInput && line\.descInput\.value\) \|\| ""/,
    '🔴 la vista previa sigue leyendo el `dataset`: enseñaría la del catálogo y no la que el '
    + 'profesional tiene delante.');
  assert.match(fuente, /const desc = \(\(line\.descInput && line\.descInput\.value\)/,
    '🔴 el envío sigue leyendo el `dataset` como fuente principal.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ NEGATIVO · editar la descripción de la línea NO toca el catálogo
//
// Son DOS datos, y hay que demostrarlo. Se ejecuta la pieza que PRECARGA desde el catálogo con
// un doble del producto, y se comprueba que el objeto del catálogo sale intacto.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-632 · ✅ NEGATIVO: precargar del catálogo no ata, y editar la línea no toca el catálogo', () => {
  const fuente = soloEjecutable(fs.readFileSync(VISTA, 'utf8'));

  // La precarga es una ASIGNACIÓN al campo de la línea desde `it.description`. En ningún sitio se
  // escribe `it.description`: el catálogo se LEE.
  assert.match(fuente, /descInput\.value = \(it\.description \|\| ""\)\.trim\(\)/,
    '🔴 elegir un producto ya no precarga su descripción en la línea (requisito 2 del ticket).');
  assert.equal(/it\.description\s*=/.test(fuente), false,
    '🔴 ALGUIEN ESCRIBE EN EL PRODUCTO DEL CATÁLOGO. La descripción de la línea es de la línea: '
    + 'editarla no puede cambiar el catálogo, o volverían a ser un solo dato con dos nombres.');

  // Y no se pisa lo que el profesional ya escribió.
  assert.match(fuente, /if \(descInput && !\(descInput\.value \|\| ""\)\.trim\(\)\)/,
    '🔴 elegir un producto SOBRESCRIBE la descripción que el profesional ya había escrito. Es el '
    + 'mismo defecto por la otra puerta: el catálogo pisando lo suyo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ROJO 1 · leído del PDF GENERADO, no del fuente
//
// Una línea A MANO con descripción y la casilla marcada tiene que llevarla al papel. Hoy no
// podía: una línea escrita a mano no tenía dónde guardar una descripción.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-632 · 🔴 una línea A MANO con descripción SALE en el PDF (leído del PDF)', async () => {
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');

  // Es lo que el envío compone desde el campo de la línea: título + `\n` + descripción. El PDF lo
  // parte con `partirConceptoYDescripcion` (SCRUM-603), que NO se toca en este ticket.
  const con = await textoDe(generateInvoicePdf,
    [{ concept: `${CONCEPTO}\n${DESC_LINEA}`, description: DESC_LINEA, qty: 1, price: 100, tax: 0.21 }],
    FACTURA);

  assert.ok(con.includes('Texto que escribe el profesional'),
    '🔴 LA DESCRIPCIÓN DE LA LÍNEA NO LLEGA AL PAPEL. Es el ROJO 1 del ticket: la casilla '
    + '«Incluir descripción» prometía algo que una línea escrita a mano no podía cumplir.\n'
    + `  PDF:\n${con.slice(0, 400)}`);
  assert.ok(con.includes('grifo monomando'),
    '🔴 el título de la línea ha desaparecido del PDF: la partición ha dejado de funcionar.');
});

test('SCRUM-632 · ✅ POSITIVO: una línea SIN descripción sale exactamente como hoy', async () => {
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');

  // Lo que arregló SCRUM-603 no se puede mover: sin descripción, el PDF no inventa ninguna.
  const sin = await textoDe(generateInvoicePdf,
    [{ concept: CONCEPTO, qty: 1, price: 100, tax: 0.21 }],
    { ...FACTURA, number: 'F-2026-QA632b' });

  assert.ok(sin.includes('grifo monomando'), '🔴 el concepto no sale en el PDF');
  assert.equal(sin.includes('Texto que escribe el profesional'), false,
    '🔴 el PDF enseña una descripción en una línea que NO la tiene. Una línea que nadie tocó '
    + 'tiene que salir exactamente igual que antes de este ticket.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA CLAVE VIAJA, y su ausencia también significa algo
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-632 · el esquema ACEPTA `description` y una línea sin ella sigue siendo válida', async () => {
  const { CreateQuoteSchema } = await import('../dist/core/validation/schemas.js');

  const base = { merchant_id: 1, customer_id: 1, currency: 'EUR' };
  const con = CreateQuoteSchema.safeParse({
    ...base, lines: [{ concept: CONCEPTO, description: DESC_LINEA, qty: 1, price: 100, tax: 0.21 }],
  });
  assert.equal(con.success, true, `🔴 zod RECHAZA una línea con descripción: ${JSON.stringify(con.error?.issues?.[0])}`);
  assert.equal(con.data.lines[0].description, DESC_LINEA,
    '🔴 zod BORRA `description` en silencio — que es exactamente lo que hacía antes de este '
    + 'ticket, y por lo que el dato no llegaba nunca a `Quote.lines`.');

  const sin = CreateQuoteSchema.safeParse({
    ...base, lines: [{ concept: CONCEPTO, qty: 1, price: 100, tax: 0.21 }],
  });
  assert.equal(sin.success, true, '🔴 una línea SIN descripción ha dejado de ser válida');
  assert.equal('description' in sin.data.lines[0], false,
    '🔴 se ha estampado una `description` en una línea que no la tenía. Que FALTE significa «esta '
    + 'línea no lleva descripción», y es lo que tienen todas las líneas de siempre: un default '
    + 'convertiría ese silencio en una afirmación que nadie hizo.');
});
