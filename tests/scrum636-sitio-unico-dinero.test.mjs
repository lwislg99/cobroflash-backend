// tests/scrum636-sitio-unico-dinero.test.mjs — SCRUM-636
//
// EL SITIO ÚNICO DEL DINERO EN EL BACKEND — y la FRONTERA, vigilada en vez de documentada.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE YA EXISTÍA, Y EL ENCARGO NO DECÍA
//
// **SCRUM-436 ya hizo esto — para el FRONT.** `fmtMoneyEs` vive en `api.js`, está en `window`, y
// aquel ticket midió 20 ficheros con 66 llamadas. Su censo (`_censo-formato-euros.mjs`) cubre
// `const DIR = 'public/dashboard/js'` **y sólo eso**: `src/` nunca entró.
//
// Así que esto no es «montar el sitio único»: es **hacer en el backend lo que 436 hizo en el
// front**, con su criterio ya fijado y sin reinventarlo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA FRONTERA, QUE AHORA SON TRES SITIOS Y NO UNO
//
// Hay tres poblaciones y sólo la primera se unifica:
//
//   PRESENTACIÓN  → PDF, páginas servidas. Sitio único: `formatImporteEs` / `formatMoneyEs`.
//   SELLADOR      → `verifactu.service.ts`, `registro.builder.ts`. `.toFixed(2)` A PROPÓSITO:
//                   el XML de la AEAT exige punto decimal. Tocarlo rompe el sellado.
//   CSV           → `paquete.ts`. Serializa un fichero que alguien importa; el agrupado de miles
//                   metería DOS separadores en una celda.
//
// El criterio, de SCRUM-625 y citado literal: «`.toFixed(2)` no es un defecto por sí mismo: es
// correcto en el XML y defecto en el PDF. Ésa es la partición.»
//
// ⚠️ TODO ANCLADO EN CONTENIDO, NUNCA EN NÚMERO DE LÍNEA. Es la lección de SCRUM-615 y de mi
// propio comentario de `nombreParaDocumento.ts`, que caducó en veinticuatro horas por listar las
// copias por línea.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const U = await import('../dist/core/utils/utils.js');
const { fmtImporte } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
const { fmtMoneyAlbaran } = await import('../dist/modules/jobs/app/routes/albaranPublicVista.js');

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
/** Sólo el código: sin esto, los guards se cazan en los comentarios que explican la prohibición. */
const soloCodigo = (s) => s.split(/\r?\n/)
  .filter((l) => { const t = l.trimStart(); return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*'); })
  .map((l) => l.replace(/\s*\/\/.*$/, ''))
  .join('\n');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-636 · SUELO: el sitio único y sus consumidores responden', () => {
  for (const [n, f] of Object.entries({ formatImporteEs: U.formatImporteEs, formatMoneyEs: U.formatMoneyEs, fmtImporte, fmtMoneyAlbaran })) {
    assert.equal(typeof f, 'function', `🔴 ${n} no está`);
  }
  // Y que DISTINGUE: si diera lo mismo con y sin símbolo, los guards de abajo no medirían nada.
  assert.notEqual(U.formatImporteEs(1000), U.formatMoneyEs(1000), '🔴 la variante sin símbolo no se distingue');
});

// ── 🔴 LO QUE ARREGLA: EL AGRUPADO QUE FALTABA ───────────────────────────────────────────

test('SCRUM-636 · 🔴 el tramo 1.000–9.999 € YA SE AGRUPA — era el defecto que cada copia reintrodujo', () => {
  // `es-ES` NO agrupa los números de cuatro cifras por CLDR, así que un `toLocaleString` a pelo
  // escribía `1000,00`. Y ése es justo el importe corriente de un trabajo. A18.2 (AB6) lo había
  // corregido y SCRUM-436 lo volvió a corregir en el front; aquí queda corregido en el backend.
  assert.equal(U.formatImporteEs(1000), '1.000,00');
  assert.equal(U.formatImporteEs(2383.7), '2.383,70');
  assert.equal(U.formatImporteEs(9999.99), '9.999,99');
  // Y los consumidores lo heredan: es la prueba de que DELEGAN de verdad.
  assert.equal(fmtImporte(1000), '1.000,00', '🔴 el PDF no ha heredado el agrupado: no delega');
  assert.ok(fmtMoneyAlbaran(1000).startsWith('1.000,00'), '🔴 el albarán no delega');
});

test('SCRUM-636 · el albarán conserva su ESPACIO NORMAL antes del símbolo', () => {
  // `style:'currency'` mete un espacio DURO (U+00A0). Usarlo aquí cambiaría los bytes de una
  // página que ya se sirve, y eso no es lo que este ticket viene a hacer.
  const s = fmtMoneyAlbaran(1000);
  assert.equal(s, '1.000,00 €', `🔴 ha cambiado el separador o el símbolo: ${JSON.stringify(s)}`);
  assert.equal(s.includes(' '), false, '🔴 se ha colado un espacio duro');
});

// ── 🔴 NINGUNA CIFRA CAMBIA — reutilizando los valores de borde de SCRUM-625 ──────────────

test('SCRUM-636 · 🔴 sólo cambia la PRESENTACIÓN, nunca el número', () => {
  // Los mismos diez valores de borde de `scrum625-formato-importe-pdf.test.mjs`. Se le quita el
  // separador de miles antes de comparar: lo que NO puede cambiar son los dígitos.
  const valores = [0, 0.005, 0.125, 1, 12.6, 105, 117.6, 999.995, 1234.567, 1e6 + 0.004];
  for (const v of valores) {
    const antes = v.toFixed(2);
    const ahora = U.formatImporteEs(v).replace(/\./g, '').replace(',', '.');
    assert.equal(
      Number(ahora), Number(antes),
      `🔴 LA CIFRA CAMBIA con ${v}: antes «${antes}», ahora «${U.formatImporteEs(v)}». Eso no es formato, es cálculo.`,
    );
  }
});

// ── 🔴 LA FRONTERA, VIGILADA ─────────────────────────────────────────────────────────────

test('SCRUM-636 · 🔴 el SELLADOR sigue con `.toFixed(2)` — el XML de la AEAT exige punto', () => {
  // Si alguien «unifica» esto, el XML sale con coma y el sellado y el envío a la AEAT se rompen.
  // Se ancla en CONTENIDO: la forma de la expresión, no dónde cae.
  for (const [f, marcas] of [
    ['src/modules/invoicing/domain/verifactu.service.ts', ['<sum1:CuotaTotal>', '<sum1:ImporteTotal>']],
    ['src/modules/fiscal/verifactu/registro.builder.ts', ['baseImponible:', 'cuotaRepercutida:']],
  ]) {
    const codigo = soloCodigo(leer(f));
    assert.ok(codigo.includes('toFixed(2)'), `🔴 ${f} ha dejado de usar toFixed(2): el XML de la AEAT exige PUNTO decimal`);
    assert.equal(
      /formatImporteEs|formatMoneyEs|fmtImporte/.test(codigo), false,
      `🔴 ${f} ha pasado a usar el formateador de PRESENTACIÓN. Eso escribe coma, y ese número se SELLA.`,
    );
    for (const m of marcas) {
      assert.ok(codigo.includes(m), `🔴 SUELO: no encuentro «${m}» en ${f}; este guard no está mirando lo que cree`);
    }
  }
});

test('SCRUM-636 · 🔴 el CSV de evidencias sigue SIN agrupar', () => {
  // `paquete.ts` serializa un CSV con `;`. El agrupado metería dos separadores en una celda.
  const codigo = soloCodigo(leer('src/modules/fiscal/evidencias/paquete.ts'));
  assert.ok(codigo.includes("const SEP = ';'"), '🔴 SUELO: ya no es el CSV que creo; revisa si la exclusión sigue teniendo motivo');
  assert.ok(
    codigo.includes("toFixed(2).replace('.', ',')"),
    '🔴 el serializador del CSV ha cambiado de forma. Si se ha unificado: el agrupado mete DOS separadores en una celda que alguien importa.',
  );
  assert.equal(
    /formatImporteEs|formatMoneyEs/.test(codigo), false,
    '🔴 el CSV de cumplimiento ha pasado al formateador de presentación',
  );
});

test('SCRUM-636 · SUELO de los dos guards de frontera: saben ver una unificación', () => {
  // Sin esto, los dos de arriba podrían pasar en verde con el patrón roto — que es como se ven los
  // guards muertos. Se les da texto que SÍ es una unificación y se exige que lo noten.
  const unificado = "const x = formatImporteEs(inv.total);";
  assert.ok(/formatImporteEs|formatMoneyEs|fmtImporte/.test(unificado), '🔴 el detector no ve una unificación evidente');
  const sinToFixed = 'const y = algo(v);';
  assert.equal(sinToFixed.includes('toFixed(2)'), false, '🔴 el detector no distingue la ausencia de toFixed');
});

// ── QUE LOS CONSUMIDORES DELEGUEN DE VERDAD ──────────────────────────────────────────────

test('SCRUM-636 · 🔴 no queda ninguna copia del formato en los sitios de PRESENTACIÓN', () => {
  // La forma en la que este defecto vuelve a entrar es alguien escribiendo otra vez
  // `toLocaleString('es-ES', …)` en vez de importar el sitio único.
  for (const f of [
    'src/modules/invoicing/infra/pdf/pdf.service.ts',
    'src/modules/jobs/app/routes/albaranPublicVista.ts',
  ]) {
    const codigo = soloCodigo(leer(f));
    assert.ok(codigo.includes('formatImporteEs'), `🔴 ${f} no importa el sitio único`);
    assert.equal(
      /toLocaleString\(\s*['"]es-ES['"]/.test(codigo), false,
      `🔴 ${f} vuelve a tener su propia copia del formato: eso reintroduce el fallo del agrupado`,
    );
  }
});
