// tests/scrum603b-descripcion-en-el-albaran.test.mjs — SCRUM-603 (DOC-13) · el albarán
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA TERCERA PANTALLA DE LA MISMA CASILLA, Y POR QUÉ FALTABA.
//
// DOC-13 pedía tres cosas en tres documentos. Al medirlo, casi todo estaba hecho ya:
//
//   · descripción por línea → presupuesto la separaba desde siempre; la factura se arregló el
//     1-sep (SCRUM-603, commit `115be909`); **el albarán NO**.
//   · texto libre de cabecera → se pinta en presupuesto (`pdf.service.ts:718`) y albarán
//     (`albaranPdf.service.ts:194`). Hecho.
//   · observaciones al pie → se pintan en los dos, con el rótulo aprobado compartido
//     (`TITULO_OBSERVACIONES`). Hecho.
//
// El 1-sep se declaró que el albarán «no tiene descripción que partir». **Hoy eso ya no es
// cierto, y se ha medido**: el albarán copia el concepto del presupuesto TAL CUAL
// —`jobDetailView.js:426` hace `l.concept.trim()`—, y ese concepto es justo el que el editor
// concatena con un `\n` cuando el profesional marca «Incluir descripción en el PDF». Así que la
// descripción SÍ llegaba al albarán, y su PDF la imprimía con el mismo tamaño y peso que el
// concepto: indistinguible de un concepto largo. El mismo defecto que tenía la factura.
//
// 🔴 Y NO TOCA EL SELLADO, que es lo que había que medir antes de escribir una línea: el hash
// del albarán certifica el CONTENIDO CANÓNICO —`numero`, `fecha`, `cliente`, `lineas`…— y NO el
// PDF (`albaran.service.ts:532`). Aquí sólo cambia CÓMO se pinta un texto que ya estaba: el papel
// imprime exactamente lo mismo que se selló, que es lo que exige SCRUM-452.
//
// ⚠️ LÍMITE DEL INSTRUMENTO, el mismo que declaró SCRUM-623: se lee el TEXTO del PDF, no se
// renderiza. Sirve para saber QUÉ se imprime y qué no; que se vea bien es juicio visual.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONCEPTO = 'Bajante de PVC';
const DESC = 'Diámetro 110 mm, con junta elástica y abrazaderas cada 1,5 m';

function params(extra) {
  return {
    merchantId: 9603,
    numero: 'ALB-2026-QA603B',
    fecha: new Date(2026, 8, 3, 12, 0, 0),
    emisionAt: new Date(2026, 8, 3, 12, 0, 0),
    modoValoracion: 'SIN_VALORAR',
    merchant: { address: 'C/ Mayor 1' },
    customer: { taxId: null },
    emisor: 'Torres SL',
    emisorNif: 'B12345678',
    cliente: 'Ana Pérez',
    obra: 'Obra de prueba',
    referenciaTrabajo: 'Fuga en cocina',
    lineas: [{ concepto: CONCEPTO, cantidad: 2, unidad: 'ud' }],
    totales: null,
    notas: null,
    signatureData: null,
    firmadoAt: null,
    firmadoPorNombre: null,
    firmadoPorCalidad: null,
    evidencia: null,
    ...extra,
  };
}

async function textoDelAlbaran(extra) {
  const { generateAlbaranPdf } = await import('../dist/modules/jobs/infra/albaranPdf.service.js');
  const { outPath } = await generateAlbaranPdf(params(extra));
  try {
    // El lector recibe el BUFFER y devuelve `{ok, texto, motivo}`: un `ok:false` es «no supe
    // leer», que NO es «no está el texto». Se distingue aquí y no se deja pasar como cadena vacía.
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF DEL ALBARÁN: ${r.motivo}`);
    return r.texto;
  } finally { fs.rmSync(outPath, { force: true }); }
}

const contiene = (txt, s) => txt.replace(/\s+/g, ' ').includes(String(s).replace(/\s+/g, ' '));

// ═══ ① SUELO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-603b · SUELO: el lector saca texto del albarán generado', async () => {
  // Sin esto, todo lo de abajo pasaría a base de no encontrar nada — que es como un test de
  // documento deja de mirar sin que se note.
  const txt = await textoDelAlbaran();
  assert.ok(txt.length > 100,
    `🔴 sólo he sacado ${txt.length} bytes de texto: el lector no está leyendo el documento.`);
  assert.ok(contiene(txt, CONCEPTO),
    '🔴 no aparece ni el concepto de la línea: no hay nada que medir.');
});

// ═══ ② EL CASO QUE DA NOMBRE AL TICKET, EN SUS DOS MITADES ═══════════════════════════════

test('SCRUM-603b · 🔴 ALBARÁN: con descripción APARECE; sin ella NO aparece', async () => {
  const con = await textoDelAlbaran({
    lineas: [{ concepto: `${CONCEPTO}\n${DESC}`, cantidad: 2, unidad: 'ud' }],
  });
  assert.ok(contiene(con, CONCEPTO), '🔴 se ha perdido el concepto al partirlo.');
  assert.ok(contiene(con, DESC),
    '🔴 la descripción NO llega al PDF del albarán: el profesional la escribió, el dato viajó '
    + 'hasta la línea, y el documento no la enseña.');

  // 🔴 EL NEGATIVO ES EL QUE IMPORTA: si saliera siempre, esto no sería conectar una casilla,
  // sería cambiar el documento de todo el mundo.
  const sin = await textoDelAlbaran({
    numero: 'ALB-2026-QA603C',
    lineas: [{ concepto: CONCEPTO, cantidad: 2, unidad: 'ud' }],
  });
  assert.ok(contiene(sin, CONCEPTO), '🔴 sin descripción se ha perdido hasta el concepto.');
  assert.equal(contiene(sin, DESC), false,
    '🔴 aparece una descripción que nadie escribió: el documento estaría inventando texto.');
});

test('SCRUM-603b · 🔴 LO QUE ESTE CAMBIO APORTA: la descripción se DISTINGUE del concepto', () => {
  // 🔴 ESTE TEST EXISTE PORQUE LA PRUEBA DE ROJO DESTAPÓ QUE EL DE ARRIBA NO BASTABA.
  //
  // Al cortar el paso del dato —volver a `doc.text(l.concepto)` de una vez— el test de presencia
  // SEGUÍA VERDE, y con razón: el texto de la descripción aparece igual, porque PDFKit respeta el
  // salto de línea. Lo que faltaba nunca fue que LLEGARA: era que se leyera como descripción y no
  // como un concepto largo. Medir la presencia y llamarlo «la descripción no llega» era prometer
  // más de lo que se mide.
  //
  // La distinción se comprueba SOBRE EL CÓDIGO, y no por comodidad: el instrumento de la casa lee
  // el TEXTO del PDF, no sus estilos (declarado en SCRUM-623), y medido aquí — el tamaño 8 ya
  // aparece en otras partes del documento, así que «hay un 8» no distingue nada.
  const src = fs.readFileSync(
    path.join(RAIZ, 'src/modules/jobs/infra/albaranPdf.service.ts'), 'utf8');
  const codigo = src.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');

  assert.match(codigo, /partirConceptoYDescripcion\(l\.concepto\)/,
    '🔴 el albarán ha vuelto a imprimir el concepto ENTERO de una vez. El texto seguiría '
    + 'saliendo —el salto de línea se respeta— pero con el MISMO tamaño y peso que el concepto: '
    + 'indistinguible de un concepto largo, que es el defecto que este ticket vino a cerrar.');
  assert.match(codigo, /doc\.text\(cTitulo,/,
    '🔴 el título ya no se pinta por separado.');
  assert.match(codigo, /doc\.fontSize\(8\)\.fillColor\(MUTED\)\s*\n?\s*\.text\(cDesc,/,
    '🔴 la descripción ya NO se pinta más pequeña y en gris: sale con el mismo aspecto que el '
    + 'concepto, y entonces el documento no distingue una cosa de la otra.');

  // Y el suelo de esta comprobación: que el `10` del concepto siga ahí. Si ambos fueran 8, no
  // habría distinción tampoco, y las dos aserciones de arriba pasarían igual.
  assert.match(codigo, /doc\.fontSize\(10\)\.fillColor\(BODY\);\s*\n\s*doc\.text\(cTitulo,/,
    '🔴 el concepto ya no se pinta a 10: si los dos van al mismo tamaño, da igual que se pinten '
    + 'por separado.');
});

test('SCRUM-603b · 🔴 una descripción LARGA llega ENTERA y no se come el documento', async () => {
  const larga = `${DESC}. ` + 'Sellado con masilla de poliuretano en cada unión y prueba de estanqueidad '
    + 'al terminar, según indicaciones de la dirección facultativa de la obra. FINAL-DE-LA-DESCRIPCION';
  const txt = await textoDelAlbaran({
    numero: 'ALB-2026-QA603D',
    lineas: [{ concepto: `${CONCEPTO}\n${larga}`, cantidad: 2, unidad: 'ud' }],
  });
  assert.ok(contiene(txt, 'FINAL-DE-LA-DESCRIPCION'),
    '🔴 la descripción se ha truncado: llega el principio pero no el final.');
  // Y lo que va DESPUÉS de la tabla sigue estando: una fila mal medida se come lo de abajo.
  assert.ok(contiene(txt, 'Ana Pérez') && contiene(txt, 'ALB-2026-QA603D'),
    '🔴 la fila alta ha desplazado el resto del documento fuera del papel.');
});

test('SCRUM-603b · acentos, ñ y comillas sobreviven al viaje', async () => {
  const rara = 'Añadido: junta «elástica» de 110 mm — con refuerzo';
  const txt = await textoDelAlbaran({
    numero: 'ALB-2026-QA603E',
    lineas: [{ concepto: `${CONCEPTO}\n${rara}`, cantidad: 1, unidad: 'ud' }],
  });
  assert.ok(contiene(txt, rara), `🔴 la descripción con caracteres españoles no llega igual.`);
});

// ═══ ③ 🔴 LA PRUEBA DE QUE LA ACOTACIÓN SE CUMPLIÓ ═══════════════════════════════════════

test('SCRUM-603b · 🔴 EL PDF DE LA FACTURA NO SE HA TOCADO: byte a byte con `main`', () => {
  // La acotación de este ticket es que la FACTURA queda fuera (SCRUM-624 está midiendo que su
  // PDF recalcula totales, y cambiar lo que imprime una factura ya emitida es la regla 29).
  //
  // La prueba más fuerte no es leer el PDF: es que el CÓDIGO QUE LO GENERA no haya cambiado. Se
  // compara byte a byte contra `origin/main`, sin interpretación posible.
  //
  // 🔴 4-sep-2026 · SE ACOTA AL CUERPO DE `generateInvoicePdf`, Y NO SE RELAJA NADA.
  //
  // Hasta hoy comparaba el FICHERO ENTERO, y eso mide más de lo que su propio título promete:
  // en `pdf.service.ts` viven los tres documentos —factura, presupuesto y el pie—, así que
  // cualquier cambio en el PRESUPUESTO lo tumbaba aunque la factura no se rozara. Lo destapó
  // SCRUM-594 (DOC-04), que añade el descuento global al presupuesto: `git diff -U0` sitúa sus
  // dos únicos trozos dentro de `generateQuotePdf` (líneas 611 y 950), con **cero** líneas
  // eliminadas y **cero** cambios en la función de la factura.
  //
  // Un guard que hace imposible tocar un fichero de tres documentos para siempre no protege la
  // factura: protege el fichero, y acaba apagándose. Sigue siendo byte a byte y sigue sin
  // interpretación — sobre el ámbito que el título anuncia. Y no se queda solo: SCRUM-594
  // añadió el control por CONDUCTA, comparando los importes de dos facturas (con `dto` y sin
  // `dto`) y exigiendo que sean idénticos, que es lo que de verdad ve el cliente.
  const rel = 'src/modules/invoicing/infra/pdf/pdf.service.ts';
  const deMain = execFileSync('git', ['show', `origin/main:${rel}`], { cwd: RAIZ, encoding: 'utf8' });
  const deDisco = fs.readFileSync(path.join(RAIZ, rel), 'utf8');

  /** El cuerpo de `generateInvoicePdf`: de su declaración a la siguiente de nivel superior. */
  const cuerpoDeLaFactura = (txt) => {
    const ini = txt.indexOf('export async function generateInvoicePdf');
    assert.notEqual(ini, -1, '🔴 no encuentro `generateInvoicePdf`: este guard mediría el vacío.');
    const sig = txt.indexOf('\nexport ', ini + 1);
    return txt.slice(ini, sig === -1 ? txt.length : sig);
  };

  const enMain = cuerpoDeLaFactura(deMain);
  const enDisco = cuerpoDeLaFactura(deDisco);
  // SUELO: si el recorte devolviera poco, la igualdad de abajo sería casi vacía.
  assert.ok(enMain.length > 5000,
    `🔴 el cuerpo de la factura en main mide ${enMain.length} caracteres: el recorte no está `
    + 'cogiendo la función entera y este guard no compararía casi nada.');
  assert.equal(enDisco, enMain,
    `🔴 EL CÓDIGO QUE GENERA EL PDF DE LA FACTURA HA CAMBIADO respecto a \`origin/main\` `
    + `(${enDisco.length} car. frente a ${enMain.length}). Cambiar lo que imprime una factura ya `
    + 'emitida es la regla 29, y SCRUM-624 está midiendo ese camino ahora mismo.');
});

test('SCRUM-603b · 🔴 y el PDF de la factura SIGUE saliendo con su contenido', async () => {
  // El byte a byte de arriba prueba que el CÓDIGO no cambió; esto prueba que el DOCUMENTO sigue
  // saliendo. Un fichero intacto que ya no genera nada pasaría el test anterior.
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  // Los MISMOS parámetros que usa el test de la factura (SCRUM-603): si me inventara otros,
  // estaría midiendo un documento que nadie genera.
  const { outPath } = await generateInvoicePdf({
    number: 'F-2026-QA603F',
    merchant: { name: 'QA' },
    customer: { name: 'C' },
    currency: 'EUR',
    total: '121.00',
    qrData: 'x',
    type: 'F1',
    lines: [{ concept: `${CONCEPTO}\n${DESC}`, qty: 1, price: 100, tax: 0.21 }],
  });
  let txt;
  try {
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF DE LA FACTURA: ${r.motivo}`);
    txt = r.texto;
  } finally { fs.rmSync(outPath, { force: true }); }
  assert.ok(contiene(txt, CONCEPTO), '🔴 la factura ya no imprime ni el concepto.');
  assert.ok(contiene(txt, DESC),
    '🔴 la factura ha dejado de imprimir la descripción que sí imprimía antes de este ticket.');
  assert.ok(contiene(txt, 'F-2026-QA603F'), '🔴 la factura no imprime su número.');
});

// ═══ ④ EL MECANISMO: UNA SOLA PARTICIÓN PARA LOS TRES ════════════════════════════════════

test('SCRUM-603b · 🔴 la partición sigue viviendo UNA vez, y ahora la usan TRES documentos', () => {
  const dir = path.join(RAIZ, 'src');
  const usos = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      // Se excluye el fichero donde se DECLARA: un censo de llamadas que cuenta la declaración
      // diría «tres documentos la usan» con sólo dos usándola. Es el mismo error de contar el
      // sitio donde algo se define como si fuera un consumidor.
      if (!e.name.endsWith('.ts') || e.name === 'conceptoLinea.ts') continue;
      const src = fs.readFileSync(p, 'utf8');
      // Sin comentarios: este ticket la nombra en varias explicaciones, y contarlas sería contar
      // usos que no existen.
      const codigo = src.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n')
        .filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
      for (const _ of codigo.matchAll(/partirConceptoYDescripcion\s*\(/g)) {
        usos.push(path.relative(RAIZ, p).replace(/\\/g, '/'));
      }
    }
  })(dir);

  assert.ok(usos.length >= 3,
    `🔴 SUELO: sólo ${usos.length} llamadas a la partición (${usos.join(', ')}). Debe haber una `
    + 'por documento: factura, presupuesto y albarán.');
  const ficheros = [...new Set(usos)].sort();
  assert.deepEqual(ficheros, [
    'src/modules/invoicing/infra/pdf/pdf.service.ts',
    'src/modules/jobs/infra/albaranPdf.service.ts',
  ], `🔴 la partición se llama desde otros sitios de los esperados: ${ficheros.join(', ')}.`);

  // Y NO hay una segunda copia de la lógica: la regla de SCRUM-604 que motivó extraerla.
  const copias = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.ts') || e.name === 'conceptoLinea.ts') continue;
      const codigo = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n')
        .filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
      // La firma de una partición escrita a mano: cortar por el primer `\n` del concepto.
      if (/\.split\(\s*['"]\\n['"]\s*\)/.test(codigo) && /concept/i.test(codigo)) {
        copias.push(path.relative(RAIZ, p).replace(/\\/g, '/'));
      }
    }
  })(dir);
  assert.deepEqual(copias, [],
    `🔴 hay una SEGUNDA copia de la partición escrita a mano en: ${copias.join(', ')}. Dos copias `
    + 'que hay que sincronizar a mano divergen — es por lo que SCRUM-604 obligó a extraerla.');
});

// ═══ ⑤ CONTROL NEGATIVO ══════════════════════════════════════════════════════════════════

test('SCRUM-603b · CONTROL NEGATIVO: el tamaño de fuente NO decide si el dato llega', async () => {
  // El censo mide que la descripción LLEGA al documento, no cómo se ve. Si midiera el `8` del
  // `fontSize`, cambiar el tamaño tumbaría el guard y estaríamos vigilando el estilo en vez de
  // la promesa de la casilla. Se comprueba sobre el fuente: el tamaño está escrito, y el test
  // de arriba pasa sin conocerlo.
  const src = fs.readFileSync(
    path.join(RAIZ, 'src/modules/jobs/infra/albaranPdf.service.ts'), 'utf8');
  assert.match(src, /fontSize\(8\)\.fillColor\(MUTED\)/,
    '🔴 la descripción del albarán ya no se pinta más pequeña y en gris.');

  // Y la prueba de que el test que importa NO depende de eso: con el tamaño cambiado a mano en
  // una copia del fuente, la aserción de contenido seguiría siendo cierta porque mide el TEXTO.
  const conOtroTamano = src.replace('fontSize(8).fillColor(MUTED)', 'fontSize(7).fillColor(MUTED)');
  assert.notEqual(conOtroTamano, src, '🔴 SUELO: no he podido simular el cambio de tamaño.');
  assert.match(conOtroTamano, /partirConceptoYDescripcion\(l\.concepto\)/,
    '🔴 cambiar el tamaño se ha llevado por delante el paso del dato: entonces el censo SÍ '
    + 'estaría atado al estilo.');
});
