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

const RAIZ = path.resolve(import.meta.dirname, '..');
const U = await import('../dist/core/utils/utils.js');
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
// 🛑 LA FACTURA QUEDA FUERA, Y SE DICE POR QUÉ
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-636 · 🛑 la FACTURA no se toca: SCRUM-623 (S1) está en ese fichero', () => {
  // `fmtImporte` lo comparten el presupuesto y la factura, así que delegarlo mueve LOS DOS: la
  // factura pasaría de escribir `1000,00` a `1.000,00`. SCRUM-623 está tocando ahora mismo cómo
  // se presentan los importes de la factura — unificarlo aquí sería pisarse.
  //
  // Se PINCHA el estado actual para que la exclusión sea visible y temporal, no un olvido: el día
  // que 623 entre, este test cae y obliga a decidir en vez de dejarlo así para siempre.
  const codigo = soloCodigo(leer('src/modules/invoicing/infra/pdf/pdf.service.ts'));
  assert.ok(codigo.includes("toLocaleString('es-ES'"),
    '🔴 `pdf.service.ts` ha cambiado de formateador. Si ha sido SCRUM-623, ya se puede unificar y\n'
    + '  hay que retirar esta exclusión. Si has sido tú: PARA, os estáis pisando.');
  for (const n of FORMATEADORES_QUE_ESTE_GUARD_CONOCE) {
    assert.equal(codigo.includes(n), false,
      `🔴 la factura ha pasado a «${n}» sin coordinarlo con SCRUM-623.`);
  }
});
