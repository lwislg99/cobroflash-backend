// tests/scrum647-presupuesto-tambien-neutral.test.mjs — SCRUM-647
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL MISMO DOCUMENTO CON LOS DOS CRITERIOS A LA VEZ.
//
// La factura quedó neutral al impuesto en SCRUM-623. El presupuesto no, y llevaba los dos
// criterios en el mismo papel:
//
//     tabla de líneas  →  `IVA%`  GRABADO
//     bloque de totales →  `locale.vatName`, resuelto por PAÍS
//
// Y es el documento que MÁS se envía: va por WhatsApp y es el primero que ve el cliente. Un
// profesional canario repercute IGIC, no IVA; en Ceuta y Melilla, IPSI.
//
// 🔴 EL QUE SE VA ES `locale.vatName`, no el otro, y esto es lo que lo decide: está indexado
// por PAÍS y Canarias es `ES`. Dejarlo dentro del documento —aunque fuera de respaldo— sería
// meter el defecto por la puerta de atrás.
//
// ⚠️ PERO NO SE BORRA SIN MÁS. Medido antes de tocar: los TRES llamantes pasan `country`, y
// `locale.vatName` vale `IGV` en Perú. Quitarlo a secas habría hecho que un presupuesto peruano
// dejara de decir IGV — una regresión en un mercado que el registro declara. Así que la
// resolución por país NO desaparece: SUBE AL LLAMANTE, donde el país ya está a la vista.
// Por eso hay aquí un guard sobre los llamantes: si uno se olvida, Perú regresa EN SILENCIO.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extraerTextoPdf, vecesEnPdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Un tipo del 7 %, que NO existe en el juego español: la forma tampoco puede depender de él.
const LINEAS = [
  { concept: 'Mano de obra', qty: 1, price: 60, tax: 0.07 },
  { concept: 'Tasa', qty: 1, price: 45, tax: 0 },
];

async function textoDePresupuesto(id, extra = {}) {
  const { generateQuotePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateQuotePdf({
    quoteId: id,
    merchant: { name: 'QA Canarias', legalName: 'QA SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' },
    currency: 'EUR', total: '109.20', lines: LINEAS, ...extra,
  });
  try {
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF (${id}): ${r.motivo}. Un texto vacío se leería `
      + 'como «el documento no dice eso», que es un falso verde.');
    return r.texto;
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

// 🔴 EL RECORTE NO PUEDE DEPENDER DE LO QUE MIDA EL NOMBRE DEL IMPUESTO, que es justo el tema
// de este ticket: `IGIC` ocupa un carácter más que `IVA`. Un `slice` de longitud fija cortaba la
// cabecera canaria por la mitad y hacía fallar el test por un motivo que no era el del producto.
// Se corta hasta el último rótulo, «Total», y ni un carácter más.
const cabecera = (t) => {
  const i = t.indexOf('Concepto');
  return t.slice(i, t.indexOf('Total', i) + 'Total'.length);
};
// Mismo criterio: se corta al final del importe del total, no a tantos caracteres.
const totales = (t) => {
  const i = t.indexOf('Base imponible');
  const j = t.indexOf('Total presupuesto', i);
  return t.slice(i, t.indexOf('EUR', j) + 'EUR'.length);
};

test('SCRUM-647 · SUELO: leo un PDF de presupuesto de verdad', async () => {
  const t = await textoDePresupuesto(9470);
  assert.ok(t.length > 100, `🔴 EXTRACTOR CIEGO: sólo he leído ${t.length} caracteres.`);
  assert.equal(vecesEnPdf(t, 'Concepto'), 1, '🔴 EXTRACTOR CIEGO: no encuentro la tabla de líneas.');
  // Control negativo del extractor: no puede encontrar lo que no está.
  assert.equal(vecesEnPdf(t, 'FACTURA RECTIFICATIVA'), 0,
    '🔴 el extractor dice ver texto que el documento no tiene.');
});

test('SCRUM-647 · ① CONTROL NEGATIVO: sin pasar el impuesto, el papel no ha cambiado', async () => {
  const t = await textoDePresupuesto(9471);

  // Las dos cadenas ENTERAS, con `===`, fijadas a lo que imprimía antes de este ticket. Una por
  // cada criterio que convivía: la cabecera de la tabla y el bloque de totales.
  assert.equal(cabecera(t), 'ConceptoCant.PrecioIVA%Total',
    '🔴 la cabecera de la tabla de líneas ya no se imprime como antes.');
  assert.equal(totales(t), 'Base imponible: 105,00 EURIVA 7%: 4,20 EURTotal presupuesto: 109,20 EUR',
    '🔴 el bloque de totales del presupuesto ya no se imprime como antes.');
});

test('SCRUM-647 · ② con el impuesto puesto desde fuera, «IVA» DESAPARECE del papel', async () => {
  const t = await textoDePresupuesto(9472, { taxName: 'IGIC' });

  assert.equal(vecesEnPdf(t, 'IVA'), 0,
    '🔴 el presupuesto sigue diciendo «IVA» aunque el impuesto que se repercute es otro. Y es el '
    + 'documento que más se envía: va por WhatsApp y es el primer papel que ve el cliente.');
  assert.equal(vecesEnPdf(t, 'IGIC'), 2,
    '🔴 el nombre puesto desde fuera no llega a los DOS sitios del documento (la cabecera de la '
    + 'tabla y la fila del desglose). Si sólo llega a uno, siguen conviviendo dos criterios.');
  assert.equal(cabecera(t), 'ConceptoCant.PrecioIGIC%Total');
});

test('SCRUM-647 · ③ la forma tampoco depende del juego de tipos español', async () => {
  // El 7 % no existe en España. Si la maqueta lo diera por bueno sólo para {21, 10, 4, 0},
  // Canarias —que es lo que motiva esto— no cabría.
  const t = await textoDePresupuesto(9473, { taxName: 'IGIC' });
  assert.equal(vecesEnPdf(t, 'IGIC 7%: 4,20 EUR'), 1,
    '🔴 el desglose no sabe imprimir un tipo que no es de los españoles.');
});

test('SCRUM-647 · 🔴 EL CONTROL NEGATIVO NO PUEDE CAZAR ESTA REGRESIÓN — y por eso hay tres', async () => {
  // La lección de SCRUM-623, comprobada en vez de repetida: si alguien vuelve a grabar el nombre,
  // el papel PENINSULAR sigue siendo correcto. O sea que ① da verde ante el defecto.
  //
  // Esto no se afirma: se ejercita. Se pinta con el nombre grabado a mano —lo que haría la
  // regresión— y se comprueba que ① lo aprobaría y que ② no.
  const conNombreGrabado = await textoDePresupuesto(9474);  // == lo que imprimiría la regresión

  // ① lo aprueba: sus dos cadenas son exactamente las de hoy.
  assert.equal(cabecera(conNombreGrabado), 'ConceptoCant.PrecioIVA%Total');
  assert.equal(totales(conNombreGrabado),
    'Base imponible: 105,00 EURIVA 7%: 4,20 EURTotal presupuesto: 109,20 EUR');

  // ② lo caza: el mismo documento, pidiendo IGIC, tendría que dejar de decir IVA.
  assert.equal(vecesEnPdf(conNombreGrabado, 'IVA'), 2,
    'suelo: este documento es el peninsular y dice IVA dos veces — es lo que ① aprueba.');

  // Un control que no puede fallar ante el defecto no es cobertura. Queda escrito.
});

test('SCRUM-647 · el documento ya no tiene DOS criterios: ni «IVA» grabado ni `locale.vatName`', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/infra/pdf/pdf.service.ts'), 'utf8');
  const ini = src.indexOf('export async function generateQuotePdf');
  assert.ok(ini > 0, '🔴 no encuentro el cuerpo del generador de presupuesto.');
  const cuerpo = src.slice(ini);

  // 🔴 DESNUDAR NO ES COSMÉTICA: los comentarios que explican esto nombran «IVA», «IGIC», «IPSI»
  // y `locale.vatName` muchas veces. Sin quitarlos el guard se cazaría a sí mismo en la prosa que
  // explica la prohibición — ya pasó en SCRUM-614 y SCRUM-617.
  const limpio = cuerpo
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

  // SUELO en las dos direcciones: quitó prosa Y no se comió el código.
  assert.ok(cuerpo.includes('Canarias'), 'suelo: el comentario de este ticket existe.');
  assert.ok(!limpio.includes('Canarias'), '🔴 el desnudado NO está quitando los comentarios.');
  // 2-sep-2026 · SCRUM-656: el canario era el literal 'Base imponible', y se MUDÓ — las filas del
  // pie las construye ahora `quotes/domain/presentacionIva.ts`, que además decide cuáles se
  // pintan según el modo de IVA del presupuesto. Se cambia por código que sigue viviendo aquí.
  assert.ok(limpio.includes('filasDeTotales'), '🔴 el desnudado se ha comido el código.');

  const grabados = limpio.split('\n').map((l) => l.trim())
    .filter((t) => /['"`][^'"`]*\bIVA\b/.test(t));
  assert.deepEqual(grabados, [],
    '🔴 el nombre del impuesto vuelve a estar GRABADO en el presupuesto.');

  assert.equal(/\blocale\.vatName\b/.test(limpio), false,
    '🔴 el presupuesto vuelve a resolver el nombre del impuesto por `locale.vatName`, que está '
    + 'indexado por PAÍS. Canarias es `ES`, así que a un canario le pondría «IVA». La resolución '
    + 'por país vive en el LLAMANTE, no aquí.');
});

test('SCRUM-647 · 🔴 TODOS los llamantes pasan el impuesto, o Perú regresa en silencio', () => {
  // Medido: sin `taxName`, un presupuesto con `country: PE` deja de decir IGV y dice IVA. El
  // documento ya no resuelve por país A PROPÓSITO — así que quien llama tiene que pasarlo.
  const dirs = [path.join(RAIZ, 'src')];
  const ficheros = [];
  (function rec(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (p.endsWith('.ts')) ficheros.push(p);
    }
  })(dirs[0]);

  /** El texto de la llamada que empieza en `desde`, equilibrando paréntesis. */
  const recorteDeLlamada = (src, desde) => {
    const abre = src.indexOf('(', desde);
    if (abre === -1) return src.slice(desde);
    let nivel = 0;
    for (let k = abre; k < src.length; k++) {
      if (src[k] === '(') nivel += 1;
      else if (src[k] === ')') { nivel -= 1; if (nivel === 0) return src.slice(desde, k + 1); }
    }
    return src.slice(desde);   // sin cerrar: se devuelve todo antes que mirar de menos
  };

  const llamadas = [];
  for (const f of ficheros) {
    const rel = path.relative(RAIZ, f).split(path.sep).join('/');
    if (rel.endsWith('pdf.service.ts')) continue; // ahí vive la función, no una llamada
    const src = fs.readFileSync(f, 'utf8');
    let i = src.indexOf('generateQuotePdf(');
    while (i !== -1) {
      // 🔴 2-sep-2026 · SCRUM-656 · ERA UNA VENTANA DE 1.400 CARACTERES, y caducó sola: añadir
      // tres parámetros con su comentario a la llamada empujó `taxName` fuera del trozo y el
      // guard acusó a una llamada que SÍ lo pasa. Una ventana de tamaño fijo mide la longitud
      // del código, no lo que quiere vigilar. Ahora se recorta la LLAMADA, equilibrando
      // paréntesis: crezca lo que crezca, se sigue mirando exactamente lo que se llamó.
      llamadas.push({ rel, trozo: recorteDeLlamada(src, i) });
      i = src.indexOf('generateQuotePdf(', i + 1);
    }
  }

  // SUELO: si el detector deja de ver llamadas, su verde no significa nada.
  assert.ok(llamadas.length >= 3,
    `🔴 CIEGO: sólo veo ${llamadas.length} llamadas a generateQuotePdf y eran TRES.`);

  const sinImpuesto = llamadas.filter((c) => !/taxName\s*:/.test(c.trozo)).map((c) => c.rel);
  assert.deepEqual(sinImpuesto, [],
    '🔴 UNA LLAMADA NO PASA EL NOMBRE DEL IMPUESTO:\n' + sinImpuesto.map((r) => '   · ' + r).join('\n')
    + '\n\n  El documento ya no lo resuelve por país (a propósito: eso miente en Canarias), así\n'
    + '  que sin pasarlo el presupuesto de un merchant peruano deja de decir IGV y dice IVA,\n'
    + '  sin que nada falle. Pásalo desde donde el país ya está a la vista.');
});
