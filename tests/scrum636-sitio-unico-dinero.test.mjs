// tests/scrum636-sitio-unico-dinero.test.mjs — SCRUM-636
//
// EL SITIO ÚNICO DEL DINERO EN EL BACKEND — y la FRONTERA, vigilada en vez de documentada.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE YA EXISTÍA, Y EL ENCARGO NO DECÍA
//
// **SCRUM-436 ya hizo esto — para el FRONT.** Su censo (`_censo-formato-euros.mjs`) cubre
// `const DIR = 'public/dashboard/js'` **y sólo eso**: `src/` nunca entró.
//
// Y su formateador no hay que elegirlo: **ya está en el backend**. Medido el 2-sep-2026 sobre los
// diez valores de borde de SCRUM-625, `fmtMoneyEs` (api.js, el de 436) y `formatMoneyEs`
// (`core/utils/utils.ts`, A6.6 + A18.2) dan **10/10 salidas idénticas**, y `formatImporteEs` es
// exactamente `formatMoneyEs` sin el ` €`. Así que esto **extiende 436, no elige otro**.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA FRONTERA, QUE SON CUATRO POBLACIONES Y SÓLO UNA SE UNIFICA
//
//   PRESENTACIÓN  → páginas servidas y PDF del albarán. Sitio único: `formatImporteEs`.
//   SELLADOR      → `verifactu.service.ts`, `registro.builder.ts`. `.toFixed(2)` A PROPÓSITO:
//                   el XML de la AEAT exige punto decimal. Tocarlo rompe el sellado.
//   CSV           → `paquete.ts`. El agrupado metería DOS separadores en una celda importable.
//   🛑 FACTURA    → `pdf.service.ts`. FUERA, y no por técnica: **SCRUM-623 (S1) está tocando cómo
//                   se presentan los importes de la factura ahora mismo.** Ver su test abajo.
//
// El criterio, de SCRUM-625 y citado literal: «`.toFixed(2)` no es un defecto por sí mismo: es
// correcto en el XML y defecto en el PDF. Ésa es la partición.»
//
// ⚠️ TODO ANCLADO EN CONTENIDO, NUNCA EN NÚMERO DE LÍNEA. Es la lección de SCRUM-615 y la del
// comentario de `nombreParaDocumento.ts`, que caducó en veinticuatro horas por listar por línea.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const U = await import('../dist/core/utils/utils.js');
const { generateInvoicePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
const { fmtMoneyAlbaran } = await import('../dist/modules/jobs/app/routes/albaranPublicVista.js');

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
/** Sólo el código: sin esto, los guards se cazan en los comentarios que explican la prohibición. */
const soloCodigo = (s) => s.split(/\r?\n/)
  .filter((l) => { const t = l.trimStart(); return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*'); })
  .map((l) => l.replace(/\s*\/\/.*$/, ''))
  .join('\n');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-636 · SUELO: el sitio único y su consumidor responden', () => {
  for (const [n, f] of Object.entries({
    formatImporteEs: U.formatImporteEs, formatMoneyEs: U.formatMoneyEs, fmtMoneyAlbaran,
  })) {
    assert.equal(typeof f, 'function', `🔴 ${n} no está`);
  }
  // Y que DISTINGUE: si diera lo mismo con y sin símbolo, los guards de abajo no medirían nada.
  assert.notEqual(U.formatImporteEs(1000), U.formatMoneyEs(1000),
    '🔴 la variante sin símbolo no se distingue de la que lo lleva');
});

// ── 🔴 LO QUE ARREGLA: EL AGRUPADO QUE FALTABA ───────────────────────────────────────────

test('SCRUM-636 · 🔴 el tramo 1.000–9.999 € YA SE AGRUPA — el defecto que cada copia reintrodujo', () => {
  // `es-ES` NO agrupa los números de cuatro cifras por CLDR, así que un `toLocaleString` a pelo
  // escribía `1000,00`. Y ése es el importe corriente de un trabajo. A18.2 (AB6) lo corrigió,
  // SCRUM-436 lo volvió a corregir en el front, y aquí queda corregido en el canal del albarán.
  assert.equal(U.formatImporteEs(1000), '1.000,00');
  assert.equal(U.formatImporteEs(2383.7), '2.383,70');
  assert.equal(U.formatImporteEs(9999.99), '9.999,99');
  assert.ok(fmtMoneyAlbaran(1000).startsWith('1.000,00'), '🔴 la vista del albarán no delega');
});

/**
 * El cuerpo de la función de DINERO de un fuente, por AST y por su nombre.
 *
 * 🔴 No vale un `grep` de `toLocaleString`: la cabecera del censo de SCRUM-436 ya avisa de que un
 * censo por texto «no distingue un importe de un porcentaje». Medido aquí: `albaranPdf.service.ts`
 * tiene DOS `toLocaleString('es-ES')` más que no son dinero — una CANTIDAD (`maximumFractionDigits`
 * sin mínimo) y una FECHA. Un guard por texto los acusaría a los dos y sería un falso rojo.
 */
function cuerpoDelFormateadorDeDinero(rel) {
  const fuente = leer(rel);
  const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
  let cuerpo = null;
  const visitar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && /money/i.test(n.name.text) && n.body) {
      cuerpo = n.body.getText(sf);
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return cuerpo;
}

test('SCRUM-636 · 🔴 EL SEXTO SITIO: el PDF del albarán y su vista escriben IGUAL', () => {
  // Lo encontró el guard de SCRUM-468, no un censo: el PDF ponía `1234,50 €` y la vista
  // `1.234,50 €`. El separador de MILLARES también divergía, y eso no estaba en el enunciado.
  for (const rel of [
    'src/modules/jobs/infra/albaranPdf.service.ts',
    'src/modules/jobs/app/routes/albaranPublicVista.ts',
  ]) {
    const cuerpo = cuerpoDelFormateadorDeDinero(rel);
    assert.ok(cuerpo, `🔴 SUELO: no encuentro la función de dinero de ${rel}; este guard no mira nada`);
    assert.ok(cuerpo.includes('formatImporteEs'), `🔴 ${rel} no usa el sitio único del dinero`);
    assert.equal(/toLocaleString|toFixed\(2\)|Intl\.NumberFormat/.test(cuerpo), false,
      `🔴 ${rel} conserva su propia copia del formato de DINERO: por ahí volvió a entrar el fallo\n`
      + `  del agrupado. Cuerpo: ${cuerpo.replace(/\s+/g, ' ').slice(0, 120)}`);
  }
});

test('SCRUM-636 · el albarán conserva su ESPACIO NORMAL antes del símbolo', () => {
  // `style:'currency'` mete un espacio DURO (U+00A0). Usarlo aquí cambiaría los bytes de una
  // página que ya se sirve, y eso no es lo que este ticket viene a hacer.
  const s = fmtMoneyAlbaran(1000);
  assert.equal(s, '1.000,00 €', `🔴 ha cambiado el separador o el símbolo: ${JSON.stringify(s)}`);
  assert.equal(s.includes(' '), false, '🔴 se ha colado un espacio duro');
});

// ── 🔴 NINGUNA CIFRA CAMBIA — con los valores de borde de SCRUM-625, sin escribir otros ───

test('SCRUM-636 · 🔴 sólo cambia la PRESENTACIÓN, nunca el número', () => {
  const valores = [0, 0.005, 0.125, 1, 12.6, 105, 117.6, 999.995, 1234.567, 1e6 + 0.004];
  for (const v of valores) {
    const antes = v.toFixed(2);
    const ahora = U.formatImporteEs(v).split('.').join('').replace(',', '.');
    assert.equal(Number(ahora), Number(antes),
      `🔴 LA CIFRA CAMBIA con ${v}: antes «${antes}», ahora «${U.formatImporteEs(v)}». Eso no es formato, es cálculo.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA FRONTERA DEL SELLADOR, CON SU TRINQUETE
//
// Aplicado el criterio de SCRUM-645: **la lista de formateadores NO se hereda de quien los
// emite.** Si este guard importara los nombres de `utils.ts`, un formateador nuevo entraría solo
// y el guard del sellador dejaría de vigilarlo en silencio — que es exactamente el defecto que
// 645 cerró en la puerta. Se escribe a mano, y un nombre que no esté aquí PARA el test.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Los formateadores de PRESENTACIÓN que este guard sabe prohibir en el sellador. A mano. */
const FORMATEADORES_QUE_ESTE_GUARD_CONOCE = ['formatMoneyEs', 'formatImporteEs'];

/** Los que `utils.ts` exporta DE VERDAD hoy, derivados por AST. */
function formateadoresExportadosDeUtils() {
  const fuente = leer('src/core/utils/utils.ts');
  const sf = ts.createSourceFile('utils.ts', fuente, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
  const out = [];
  ts.forEachChild(sf, (n) => {
    if (!ts.isFunctionDeclaration(n) || !n.name) return;
    const exportada = (n.modifiers || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exportada) return;
    const cuerpo = n.getText(sf);
    if (cuerpo.includes('Intl.NumberFormat') || cuerpo.includes('toLocaleString')) out.push(n.name.text);
  });
  return out;
}

test('SCRUM-636 · 🔴 SUELO del trinquete: el detector VE los formateadores que ya existen', () => {
  const hay = formateadoresExportadosDeUtils();
  for (const n of FORMATEADORES_QUE_ESTE_GUARD_CONOCE) {
    assert.ok(hay.includes(n), `🔴 el detector no ve «${n}», que existe. Su lista no significa nada.`);
  }
});

test('SCRUM-636 · 🔴 TRINQUETE: un formateador NUEVO en utils.ts hace caer este guard', () => {
  // No se importa la lista: se compara con ella. Un formateador que nazca y no se añada aquí deja
  // el guard del sellador ciego a él, y esto lo cuenta en vez de tragárselo.
  for (const n of formateadoresExportadosDeUtils()) {
    assert.ok(FORMATEADORES_QUE_ESTE_GUARD_CONOCE.includes(n),
      `🔴 «${n}» es un formateador de dinero NUEVO en utils.ts que este guard no conoce.\n`
      + '  Mientras no esté en `FORMATEADORES_QUE_ESTE_GUARD_CONOCE`, el guard del sellador NO\n'
      + '  vigila que ese nombre no entre en el XML de la AEAT. Añádelo — a mano, a propósito.');
  }
});

test('SCRUM-636 · 🔴 el SELLADOR sigue con `.toFixed(2)` — el XML de la AEAT exige punto', () => {
  // Si alguien «unifica» esto, el XML sale con coma y el sellado y el envío se rompen. Anclado en
  // CONTENIDO: la forma de la expresión y unas marcas del fichero, nunca dónde caen.
  for (const [f, marcas] of [
    ['src/modules/invoicing/domain/verifactu.service.ts', ['<sum1:CuotaTotal>', '<sum1:ImporteTotal>']],
    ['src/modules/fiscal/verifactu/registro.builder.ts', ['baseImponible:', 'cuotaRepercutida:']],
  ]) {
    const codigo = soloCodigo(leer(f));
    assert.ok(codigo.includes('toFixed(2)'),
      `🔴 ${f} ha dejado de usar toFixed(2): el XML de la AEAT exige PUNTO decimal`);
    for (const n of FORMATEADORES_QUE_ESTE_GUARD_CONOCE) {
      assert.equal(codigo.includes(n), false,
        `🔴 ${f} ha pasado a usar «${n}», que es de PRESENTACIÓN. Eso escribe coma, y ese número se SELLA.`);
    }
    for (const m of marcas) {
      assert.ok(codigo.includes(m),
        `🔴 SUELO: no encuentro «${m}» en ${f}; este guard no está mirando lo que cree`);
    }
  }
});

test('SCRUM-636 · 🔴 el CSV de evidencias sigue SIN agrupar', () => {
  // `paquete.ts` serializa un CSV con `;`. El agrupado metería dos separadores en una celda.
  const codigo = soloCodigo(leer('src/modules/fiscal/evidencias/paquete.ts'));
  assert.ok(codigo.includes("const SEP = ';'"),
    '🔴 SUELO: ya no es el CSV que creo; revisa si la exclusión sigue teniendo motivo');
  assert.ok(codigo.includes("toFixed(2).replace('.', ',')"),
    '🔴 el serializador del CSV ha cambiado de forma. Si se ha unificado: el agrupado mete DOS\n'
    + '  separadores en una celda que alguien importa.');
  for (const n of FORMATEADORES_QUE_ESTE_GUARD_CONOCE) {
    assert.equal(codigo.includes(n), false, `🔴 el CSV ha pasado a «${n}», que es de presentación`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA EXCLUSIÓN DE LA FACTURA SE LEVANTA — y aquí queda por qué, en vez de desaparecer
//
// Hubo aquí un test que PINCHABA la exclusión: exigía que `pdf.service.ts` conservara su
// `toLocaleString`. No estaba para proteger ese código, sino para que la exclusión fuera VISIBLE y
// TEMPORAL en lugar de un olvido — el día que SCRUM-623 entrara, caería y obligaría a decidir.
//
// Cumplió, y de forma más limpia de lo previsto: **no llegó a caer**, porque estaba anclado al
// FORMATEADOR y no al fichero, y 623 añadió 125 líneas de desglose sin tocarlo. Lo que forzó la
// decisión fue la medición que lo acompañaba: `toLocaleString('es-ES')` no agrupa los enteros de
// cuatro cifras (CLDR), así que la factura escribía `1000,00` y `12.345,67` — **incoherente
// consigo misma**, y fallando justo en la banda 1.000–9.999 €. No era una política que alguien
// hubiera elegido: era un artefacto que se estaba padeciendo.
//
// El fundador decidió la convención española en LOS CINCO sitios. El test se retira porque su
// premisa ya no existe; lo que lo sustituye es el guard de abajo, que vigila lo contrario.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** La forma exacta que tenían las cinco copias. Escrita entera para que el censo no se cace solo. */
const LA_COPIA = "toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })";

/** Todo `src/**\/*.ts`, para censar el árbol y no una lista escrita a mano que envejezca. */
function fuentesDeSrc(dir = path.join(RAIZ, 'src'), acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentesDeSrc(p, acc);
    else if (e.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

test('SCRUM-636 · 🔴 SUELO: el censo de copias VE la forma que busca', () => {
  // Sin esto, «cero copias» podría ser «no sé mirar» — que es como se leen los censos muertos.
  assert.ok(`const t = v.${LA_COPIA};`.includes(LA_COPIA), '🔴 el detector no ve su propio cebo.');
  assert.ok(fuentesDeSrc().length > 100, '🔴 el censo apenas ve ficheros: no está mirando el árbol.');
});

test('SCRUM-636 · 🔴 no queda NI UNA copia de la expresión en todo `src/`', () => {
  const conCopia = fuentesDeSrc()
    .filter((f) => soloCodigo(fs.readFileSync(f, 'utf8')).includes(LA_COPIA))
    .map((f) => path.relative(RAIZ, f).split(path.sep).join('/'));
  assert.deepEqual(conCopia, [],
    '🔴 ha vuelto a aparecer la copia del formato de dinero. Eran CINCO y se unificaron en\n'
    + `  \`formatImporteEs\`; por aquí es por donde vuelve a entrar el fallo del agrupado:\n  ${conCopia.join('\n  ')}`);
});

test('SCRUM-636 · 🔴 la FACTURA y el PRESUPUESTO beben ya del sitio único', () => {
  const codigo = soloCodigo(leer('src/modules/invoicing/infra/pdf/pdf.service.ts'));
  assert.ok(codigo.includes('formatImporteEs'), '🔴 `pdf.service.ts` no usa el sitio único.');
  assert.equal(codigo.includes(LA_COPIA), false, '🔴 la copia sigue en el PDF de la factura.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 CAMBIO VISIBLE EN UN DOCUMENTO FISCAL → SE COMPRUEBA SOBRE EL TEXTO REAL DEL PDF
//
// Leer el código diría que delega; no diría qué sale impreso. Aquí se GENERA la factura con los
// doce valores de borde de SCRUM-625 y se lee el texto del PDF de verdad.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Los mismos doce de SCRUM-625, sin escribir otros. */
const BORDE = [0, 1, 12.6, 105, 117.6, 999.99, 1000, 2383.7, 9999.99, 12345.67, 1234.567, 1e6 + 0.004];

test('SCRUM-636 · 🔴 EL PDF DE LA FACTURA escribe los doce con la convención española', async () => {
  const lines = BORDE.map((price, i) => ({ concept: `Concepto ${i + 1}`, qty: 1, price, tax: 0 }));
  const suma = BORDE.reduce((a, b) => a + b, 0);
  // `merchantId: 2` y no 1: el 1 es el merchant DEMO y no se comporta como uno normal (SCRUM-409).
  const { outPath } = await generateInvoicePdf({
    number: '2026-CF-636', invoiceId: 636, merchantId: 2,
    merchant: { name: 'Taller' }, customer: { name: 'Cliente' },
    currency: 'EUR', total: suma.toFixed(2), qrData: 'x', lines,
  });
  const r = extraerTextoPdf(fs.readFileSync(outPath));
  assert.equal(r.ok, true,
    `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un texto vacío se leería como «no dice eso» — falso verde.`);

  for (const v of BORDE) {
    const esperado = U.formatImporteEs(v);
    assert.ok(r.texto.includes(esperado),
      `🔴 el PDF no escribe «${esperado}» para ${v}. Lo que hay: ${r.texto.slice(0, 200)}`);
  }
});

test('SCRUM-636 · 🔴 y NINGUNA CIFRA cambia: sólo su escritura', () => {
  // Se le quitan los puntos de millar y se compara el NÚMERO. Si esto cae, no hemos cambiado el
  // formato: hemos cambiado el importe, y eso en un documento fiscal se para en seco.
  for (const v of BORDE) {
    const escrito = U.formatImporteEs(v);
    const comoNumero = Number(escrito.split('.').join('').replace(',', '.'));
    assert.equal(comoNumero, Number(v.toFixed(2)),
      `🔴 LA CIFRA CAMBIA con ${v}: antes «${v.toFixed(2)}», ahora «${escrito}». PARA.`);
  }
});

test('SCRUM-636 · 🔴 la banda 1.000–9.999 € ya NO se escribe sin agrupar', async () => {
  // Es la banda donde la factura era incoherente consigo misma: escribía `1000,00` pero
  // `12.345,67`. Se comprueba sobre el texto del PDF, no sobre el código.
  const enLaBanda = BORDE.filter((v) => v >= 1000 && v < 10000);
  assert.equal(enLaBanda.length, 4, '🔴 SUELO: la banda no tiene los cuatro valores que creía.');

  const lines = enLaBanda.map((price, i) => ({ concept: `Banda ${i + 1}`, qty: 1, price, tax: 0 }));
  const { outPath } = await generateInvoicePdf({
    number: '2026-CF-636B', invoiceId: 637, merchantId: 2,
    merchant: { name: 'Taller' }, customer: { name: 'Cliente' },
    currency: 'EUR', total: enLaBanda.reduce((a, b) => a + b, 0).toFixed(2), qrData: 'x', lines,
  });
  const r = extraerTextoPdf(fs.readFileSync(outPath));
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}`);

  for (const v of enLaBanda) {
    const sinAgrupar = v.toFixed(2).replace('.', ',');
    assert.equal(r.texto.includes(sinAgrupar), false,
      `🔴 el PDF sigue escribiendo «${sinAgrupar}» sin el punto de millar, para ${v}.`);
    assert.ok(r.texto.includes(U.formatImporteEs(v)),
      `🔴 SUELO: tampoco escribe la forma agrupada «${U.formatImporteEs(v)}»; este guard no mira nada.`);
  }
});
