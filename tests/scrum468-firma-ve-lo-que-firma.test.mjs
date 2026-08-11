// SCRUM-468 · LA PANTALLA DE FIRMA ENSEÑA LO MISMO QUE EL PDF QUE SE FIRMA.
//
// Sin gate: se compara ejecutando las dos representaciones sobre las MISMAS líneas. Ni BD, ni red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL DEFECTO
//
// SCRUM-65 metió el modo VALORADO —precio unitario, importe por línea, Base y Total— en el PDF del
// albarán y **no tocó la pantalla pública de firma**, que seguía enseñando concepto/cantidad/unidad
// a todo el mundo. El cliente firmaba una pantalla sin importes y quedaba vinculado a un documento
// con Base y Total. **Una prueba de conformidad sobre lo que el firmante no vio no prueba nada.**
//
// El PDF firmado va sellado en el sobre v:2 y NO se reescribe (regla 29): se mueve la pantalla.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE FICHERO NO LEE, EJECUTA
//
// «Pantalla y PDF coinciden» comprobado leyendo los dos fuentes es exactamente el error que dejó
// pasar el defecto durante meses: los dos ficheros se leían bien por separado. Aquí:
//
//   · los RÓTULOS, la LEYENDA, el FORMATO DE DINERO y la ARITMÉTICA DEL IMPORTE se **derivan del
//     fuente del PDF por AST** y se **ejecutan** (`new Function` sobre el trozo derivado);
//   · la pantalla se **renderiza de verdad** llamando a `renderLineasAlbaran` desde `dist/`;
//   · y se enfrentan celda a celda.
//
// Si alguien cambia el PDF —otro formato de dinero, otro rótulo, otra leyenda— la expectativa se
// recalcula sola y la pantalla deja de casar. Ese es el mecanismo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CENSO EN PRODUCCIÓN (10-ago-2026, medido en el PASO 0)
//
//   VALORADO emitido: 1 · VALORADO firmado: 0 · SIN_VALORAR firmado: 4
//
// El único valorado vivo **aún no está firmado**, así que este arreglo llega a tiempo para él. Los
// 4 firmados son SIN_VALORAR y su pantalla no se roza: eso es el control positivo de abajo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import {
  renderLineasAlbaran,
  LEYENDA_IMPORTES_ORIENTATIVOS,
} from '../dist/modules/jobs/app/routes/albaranPublicVista.js';
import { calcAlbaranTotales } from '../dist/modules/jobs/domain/albaran.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const FUENTE_PDF = 'src/modules/jobs/infra/albaranPdf.service.ts';

/**
 * Lo que el PDF imprime para un albarán VALORADO, DERIVADO de su fuente y ejecutable.
 *
 * No hay ni un valor escrito a mano aquí: rótulos, leyenda, formateador y aritmética del importe
 * salen del árbol de `albaranPdf.service.ts`.
 */
function pdfValorado() {
  const src = leer(FUENTE_PDF);
  const sf = ts.createSourceFile(FUENTE_PDF, src, ts.ScriptTarget.Latest, true);
  const out = { rotulos: [], leyenda: null, plantillas: [], fmtMoney: null, importe: null };

  const dentroDeValorado = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isIfStatement(p) && /\bvalorado\b/.test(p.expression.getText(sf))) return true;
    }
    return false;
  };

  const visitar = (n) => {
    // El formateador de dinero del PDF: se saca su CUERPO y se convierte en función.
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'fmtMoney' && n.body) {
      const cuerpo = n.body.getText(sf).replace(/^\{|\}$/g, '');
      out.fmtMoney = new Function('v', cuerpo);
    }
    // `const importe = Number(l.precioUnitario) * Number(l.cantidad)` — la aritmética por línea.
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === 'importe' && n.initializer) {
      out.importe = new Function('l', `return ${n.initializer.getText(sf)}`);
    }
    if (ts.isCallExpression(n) && /\.text$/.test(n.expression.getText(sf)) && n.arguments.length) {
      const a = n.arguments[0];
      if (ts.isStringLiteral(a)) {
        // La leyenda vive en el bloque de totales, que TAMBIÉN está bajo un `if (valorado…)`: sin
        // separarla se colaba entre los rótulos de columna y el guard pedía una frase entera de 100
        // caracteres dentro de un `<th>`. Salió rojo a la primera por eso, no por la pantalla.
        if (/normativa vigente/.test(a.text)) out.leyenda = a.text;
        else if (dentroDeValorado(n) && a.text === a.text.toUpperCase()) out.rotulos.push(a.text);
      } else if (ts.isTemplateExpression(a) && dentroDeValorado(n)) {
        // `Base: ${fmtMoney(params.totales.base)}` → plantilla ejecutable.
        const t = a.getText(sf);
        out.plantillas.push({
          texto: t,
          render: new Function('fmtMoney', 'params', `return ${t}`),
        });
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return out;
}

/** La pantalla, troceada en celdas de verdad — no en «parece que sale». */
function celdas(html) {
  const filas = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  return filas.map((f) => [...f.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1]));
}

// Tres líneas a propósito: decimales que delatan el formato, un concepto con caracteres que hay
// que escapar, y una línea VALORADA **sin precio** —el PDF deja sus dos celdas vacías, no «0,00 €»—.
const LINEAS = [
  { concepto: 'Mano de obra', cantidad: 2.5, unidad: 'h', precioUnitario: 35.4, tipoIva: 21 },
  { concepto: 'Material <raro> & "caro"', cantidad: 3, unidad: 'ud', precioUnitario: 1234.5, tipoIva: 21 },
  { concepto: 'Desplazamiento', cantidad: 1, unidad: 'ud', precioUnitario: null, tipoIva: 21 },
];

test('SCRUM-468 · SUELO: si no se lee el PDF, no se compara nada (y no se pasa por vacío)', () => {
  const pdf = pdfValorado();
  assert.ok(
    typeof pdf.fmtMoney === 'function',
    '🔴 ESCÁNER CIEGO: no se ha derivado `fmtMoney` del PDF. Sin él, cada comparación de dinero de ' +
      'abajo se quedaría sin expectativa y el fichero daría verde sin mirar nada.',
  );
  assert.ok(
    typeof pdf.importe === 'function',
    '🔴 ESCÁNER CIEGO: no se ha derivado la aritmética del importe por línea del PDF.',
  );
  assert.ok(
    pdf.rotulos.length >= 2,
    `🔴 ESCÁNER CIEGO: el bloque VALORADO del PDF ha dado ${pdf.rotulos.length} rótulos. «El PDF no ` +
      'enseña importes» y «no supe mirar el PDF» son el mismo resultado y significan lo contrario.',
  );
  assert.ok(pdf.leyenda, '🔴 ESCÁNER CIEGO: no se ha encontrado la leyenda de importes en el PDF.');
  assert.ok(
    pdf.plantillas.length >= 2,
    `🔴 ESCÁNER CIEGO: ${pdf.plantillas.length} plantillas de total leídas del PDF; Base y Total son dos.`,
  );
  // Y el otro lado del suelo: que la fixture sea de verdad un VALORADO con precio.
  const t = calcAlbaranTotales(LINEAS);
  assert.ok(t.base > 0, '🔴 la fixture no tiene ni un precio: comparar dos pantallas vacías no prueba nada.');
});

test('SCRUM-468 · 🔴 EL TEST: para un VALORADO, pantalla y PDF coinciden CAMPO POR CAMPO', () => {
  const pdf = pdfValorado();
  const html = renderLineasAlbaran(LINEAS, 'VALORADO');
  const [cabecera, ...filas] = celdas(html);

  // 1) Los dos rótulos de columna, LITERALES del PDF.
  for (const rotulo of pdf.rotulos) {
    assert.ok(
      cabecera.includes(rotulo),
      `🔴 FALTA LA COLUMNA «${rotulo}» EN LA PANTALLA.\n\n` +
        '  El PDF que se firma la imprime y la pantalla no, así que el cliente firma sin verla.\n' +
        `  Cabecera de la pantalla: ${cabecera.join(' | ')}`,
    );
  }

  // 2) Celda a celda: precio unitario e importe de CADA línea.
  LINEAS.forEach((l, i) => {
    const fila = filas[i];
    assert.ok(fila, `🔴 la pantalla no ha pintado la línea ${i + 1} («${l.concepto}»)`);
    const conPrecio = l.precioUnitario !== null && l.precioUnitario !== undefined;
    const esperadoPrecio = conPrecio ? pdf.fmtMoney(l.precioUnitario) : '';
    const esperadoImporte = conPrecio ? pdf.fmtMoney(pdf.importe(l)) : '';
    assert.equal(
      fila[3], esperadoPrecio,
      `🔴 EL PRECIO UNITARIO DE «${l.concepto}» NO COINCIDE CON EL PDF.\n\n` +
        `  PDF: «${esperadoPrecio}» · pantalla: «${fila[3] ?? '(no hay celda)'}»\n` +
        '  Si la celda no existe, la pantalla está ocultando un dato que el firmante queda obligado\n' +
        '  a aceptar. Si existe pero difiere, hay DOS formatos de dinero para el mismo papel.',
    );
    assert.equal(
      fila[4], esperadoImporte,
      `🔴 EL IMPORTE DE LA LÍNEA «${l.concepto}» NO COINCIDE CON EL PDF.\n\n` +
        `  PDF: «${esperadoImporte}» · pantalla: «${fila[4] ?? '(no hay celda)'}»`,
    );
  });

  // 3) Base y Total: se EJECUTA la plantilla del PDF con los mismos totales.
  const totales = calcAlbaranTotales(LINEAS);
  for (const p of pdf.plantillas) {
    const linea = p.render(pdf.fmtMoney, { totales });
    assert.ok(
      html.includes(linea),
      `🔴 LA PANTALLA NO DICE «${linea}», Y EL PDF SÍ.\n\n` +
        '  Sale de la MISMA `calcAlbaranTotales` que alimenta al PDF, así que la cifra no puede\n' +
        '  discrepar: o está y coincide, o no está.\n' +
        `  Plantilla del PDF: ${p.texto}`,
    );
  }

  // 4) La leyenda, LITERAL. Ni una palabra propia (regla 30).
  assert.ok(
    html.includes(pdf.leyenda),
    `🔴 LA PANTALLA NO LLEVA LA LEYENDA DEL PDF, LITERAL.\n\n  PDF: «${pdf.leyenda}»`,
  );
  assert.equal(
    LEYENDA_IMPORTES_ORIENTATIVOS, pdf.leyenda,
    '🔴 la leyenda de la pantalla ha derivado de la del PDF. Es la misma frase aprobada o son dos ' +
      'textos distintos sobre el mismo documento.',
  );
});

test('SCRUM-468 · CONTROL POSITIVO: un SIN_VALORAR sale EXACTAMENTE como hoy', () => {
  // Golden tomado de `origin/main` (04dc6359, albaranPublic.routes.ts, antes de este ticket). Son 4
  // albaranes ya firmados en producción: su pantalla no cambia ni un píxel.
  const esperado =
    '<table class="lines-table"><thead><tr><th>Concepto</th><th>Cant.</th><th>Unidad</th></tr></thead>' +
    '<tbody><tr><td>Mano de obra</td><td>2.5</td><td>h</td></tr>' +
    '<tr><td>Material &lt;raro&gt; &amp; &quot;caro&quot;</td><td>3</td><td>ud</td></tr>' +
    '<tr><td>Desplazamiento</td><td>1</td><td>ud</td></tr></tbody></table>';
  assert.equal(
    renderLineasAlbaran(LINEAS, 'SIN_VALORAR'), esperado,
    '🔴 HA CAMBIADO LA PANTALLA DEL SIN_VALORAR. Este ticket es ADITIVO: el modo sin valorar no ' +
      'enseña importes, y su marcado tiene que salir byte a byte como salía.',
  );
  assert.equal(
    renderLineasAlbaran([], 'SIN_VALORAR'), '<p class="meta">Sin líneas.</p>',
    '🔴 ha cambiado el vacío del SIN_VALORAR.',
  );
});

test('SCRUM-468 · CONTROL NEGATIVO: sigue sin ser una factura (regla 24)', () => {
  const pdf = pdfValorado();
  const html = renderLineasAlbaran(LINEAS, 'VALORADO');
  const totales = calcAlbaranTotales(LINEAS);

  // La cuota de IVA se CALCULA (calcAlbaranTotales la devuelve) y no se enseña, ni aquí ni en el
  // PDF. Enseñarla es lo que convierte el papel en algo que parece una factura.
  assert.ok(totales.cuota > 0, '🔴 fixture sin IVA: la ausencia de la cuota se probaría por vacío.');
  assert.ok(
    !html.includes(pdf.fmtMoney(totales.cuota)),
    `🔴 LA PANTALLA ESTÁ ENSEÑANDO LA CUOTA DE IVA (${pdf.fmtMoney(totales.cuota)}). Un parte de ` +
      'trabajo no desglosa IVA: eso es una factura, y aquí no hay serie fiscal que la sostenga.',
  );
  assert.ok(!/\bCuota\b/i.test(html), '🔴 aparece un rótulo de cuota en la pantalla de firma.');
  assert.ok(!/\bqr\b/i.test(html) && !/<img/i.test(html), '🔴 hay QR en la pantalla de firma: eso es VeriFactu.');
  assert.ok(
    !/\bF1\b|\bR1\b|FAC-\d|\bserie\b/i.test(html),
    '🔴 asoma una serie fiscal en la pantalla de firma. El albarán numera ALB-, y no es un documento fiscal.',
  );
});

test('SCRUM-468 · el PDF y la pantalla beben de la MISMA aritmética, no de dos parecidas', () => {
  // Que las cifras coincidan hoy no basta: tienen que venir de la misma función. El PDF no calcula
  // —recibe `params.totales`— y quien se los pasa es `albaran.service.ts` con `calcAlbaranTotales`.
  const svc = leer('src/modules/jobs/domain/albaran.service.ts');
  assert.match(
    svc, /totales:\s*modoValoracion === 'VALORADO' \? calcAlbaranTotales\(lineas\) : null/,
    '🔴 el PDF ya no recibe sus totales de `calcAlbaranTotales`. Si cada lado calcula por su cuenta, ' +
      'un día la pantalla firmada y el papel archivado dirán cifras distintas.',
  );
  const vista = leer('src/modules/jobs/app/routes/albaranPublicVista.ts');
  assert.match(
    vista, /calcAlbaranTotales\(filas as AlbaranLinea\[\]\)/,
    '🔴 la pantalla ha dejado de usar `calcAlbaranTotales`: segunda aritmética sobre el mismo documento.',
  );
});
