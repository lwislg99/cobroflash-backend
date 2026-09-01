// tests/scrum627-censo-ciego.test.mjs — SCRUM-627
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CENSO DE SCRUM-389 NO VE LAS REIMPLEMENTACIONES, Y AQUÍ SE DEMUESTRA
//
// El censo busca ficheros que **LLAMEN** a `calcVatBreakdown`. Hace su trabajo —el 25-ago-2026
// me paró a mí y me obligó a declararme— y su motivo escrito es bueno: un llamador que agregue
// un PERIODO sería una segunda cifra oficial del mismo trimestre.
//
// Pero una **reimplementación a mano no llama a nadie**. El bloque de totales de la FACTURA
// (`pdf.service.ts`) agrupa por tipo con su propio `vatMap` y es invisible para él. Y lo es de
// la peor manera: ese fichero **sí está en el censo, con su veredicto** —desde SCRUM-604, que
// añadió una llamada para el PRESUPUESTO—, así que un lector ve el fichero clasificado y da por
// mirado lo que hay al lado. *Un censo con reputación de completo es un sitio donde dejar de
// buscar.*
//
// ⛔ ESTE FICHERO NO CAMBIA EL CENSO. Es la MEDIDA y la DEMOSTRACIÓN; qué se hace con ellas es
// decisión del fundador (ver `docs/master/SCRUM-627.md`). Aquí no se relaja ni se amplía nada.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO MEDIDO (25-ago-2026), sobre 244 ficheros de `src/`
//
//   12  llaman a la primitiva          ← lo único que SCRUM-389 ve
//    8  hacen aritmética de IVA y NO llaman  ← invisibles para él (eran 9: ver la nota de `INVISIBLES`)
//    1  reimplementa un DESGLOSE completo (base y cuota por tipo): `pdf.service.ts`
//
// El cero de los demás está declarado: **ningún otro** fichero del árbol reimplementa el
// desglose. Y el método que produce ese cero está abajo, porque un cero vale lo que valga el
// método — se busca por FORMA (multiplicar por un tipo, acumular una cuota, convertir
// fracción a porcentaje), nunca por quién llama.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { analizarFuente, censarAritmeticaIva, criterioDe389 } from './_censo-aritmetica-iva.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** Una reimplementación de libro. Es la del PDF de la factura, reducida a lo esencial. */
const REIMPLEMENTACION = `
export function desgloseAMano(lineas: Array<{ qty: number; price: number; tax: number }>) {
  const mapa: Record<string, { base: number; vat: number }> = {};
  let subtotal = 0;
  for (const l of lineas) {
    const t = Number(l.tax) || 0;
    const base = Number(l.qty) * Number(l.price);
    subtotal += base;
    const clave = String(Math.round(t * 100)) + '%';
    if (!mapa[clave]) mapa[clave] = { base: 0, vat: 0 };
    mapa[clave].base += base;
    mapa[clave].vat += base * t;
  }
  return { mapa, subtotal };
}
`;

/** Un fichero que no toca impuestos. Control negativo del detector. */
const SIN_IVA = `
export function sumar(xs: number[]) {
  let total = 0;
  for (const x of xs) total += x * 2;
  return total * 100;
}
`;

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO · el detector tiene que VER el árbol y encontrar la primitiva. Un cero de un
// instrumento ciego se lee igual que «aquí nadie reimplementa nada», que es la conclusión
// falsa más cara de este ticket.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-627 · SUELO: el detector ve el árbol y encuentra la primitiva', () => {
  const r = censarAritmeticaIva(RAIZ);
  assert.ok(r.ficherosMirados >= 200, `🔴 DETECTOR CIEGO: sólo veo ${r.ficherosMirados} ficheros .ts`);
  assert.ok(r.hallazgos.length >= 15, `🔴 DETECTOR CIEGO: sólo ${r.hallazgos.length} ficheros con indicios`);
  const primitiva = r.hallazgos.find((h) => h.ruta === 'src/modules/invoicing/domain/vat.service.ts');
  assert.ok(primitiva && primitiva.desgloseCompleto,
    '🔴 DETECTOR CIEGO: no reconozco como desglose a la PROPIA primitiva. Si no la veo a ella, '
    + 'no puedo afirmar nada sobre quién la imita.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA DEMOSTRACIÓN · el corazón del ticket, en las dos direcciones
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-627 · 🔴 el criterio de HOY (quién llama) NO ve una reimplementación', () => {
  const a = analizarFuente(REIMPLEMENTACION, 'reimplementacion.ts');
  assert.equal(a.llama, 0, 'la reimplementación no llama a nadie — por eso es invisible');
  assert.equal(criterioDe389(a), false,
    '🔴 si el criterio de SCRUM-389 viera esto, este ticket no tendría objeto. '
    + 'Que salga `false` ES el hallazgo.');
});

test('SCRUM-627 · 🔴 el criterio por FORMA sí la ve, y la nombra como desglose completo', () => {
  const a = analizarFuente(REIMPLEMENTACION, 'reimplementacion.ts');
  assert.equal(a.desgloseCompleto, true,
    '🔴 el detector nuevo NO ve la reimplementación: sin esto la propuesta es una opinión');
  assert.ok(a.desglose.length >= 1, '🔴 no ha localizado la línea que acumula la cuota');
  assert.match(a.desglose[0].txt, /\+= base \* t/,
    `🔴 ha marcado otra línea: ${a.desglose[0].txt}`);
});

test('SCRUM-627 · 🔴 y no se deja engañar por RENOMBRAR la variable del impuesto', () => {
  // La trampa que casi me come: en la factura el tipo se llama `t`, no `tax`. Un detector por
  // NOMBRE no lo ve — tenía la misma ceguera que el censo, un nivel más abajo.
  const a = analizarFuente(REIMPLEMENTACION, 'reimplementacion.ts');
  assert.ok(a.alias.includes('t'),
    `🔴 el paso de ALIAS no ha reconocido \`t\` como impuesto (alias: ${a.alias.join(', ')}). `
    + 'Sin él, renombrar una variable —lo más barato que hay— vuelve a esconder la reimplementación.');
});

test('SCRUM-627 · CONTROL NEGATIVO: un fichero sin impuestos no dispara nada', () => {
  // Sin esto, un detector que dijera «sí» a todo pasaría los tres tests de arriba.
  const a = analizarFuente(SIN_IVA, 'sinIva.ts');
  assert.equal(a.desgloseCompleto, false, '🔴 el detector ve un desglose donde sólo hay una suma');
  assert.deepEqual([a.desglose.length, a.bruto.length, a.conversion.length, a.otro.length], [0, 0, 0, 0],
    '🔴 el detector marca aritmética de IVA en un fichero que no la tiene: dice «sí» a todo');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA COPIA DEL CRITERIO ES FIEL · no se pide fe
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-627 · la copia del criterio de SCRUM-389 coincide con su censo real', () => {
  // `criterioDe389` es una copia (aquel es un fichero de test y no exporta nada). Se contrasta
  // con las CLAVES de su tabla `CENSO`: si la copia dejara de ser fiel, este test lo diría.
  const fuente = fs.readFileSync(path.join(RAIZ, 'tests/scrum389-censo-vat.test.mjs'), 'utf8');
  const sf = ts.createSourceFile('scrum389.test.mjs', fuente, ts.ScriptTarget.Latest, true);
  const claves = [];
  (function rec(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'CENSO' && n.initializer) {
      (function rec2(x) {
        if (ts.isPropertyAssignment(x) && x.name && ts.isStringLiteral(x.name)) claves.push(x.name.text);
        x.forEachChild(rec2);
      })(n.initializer);
    }
    n.forEachChild(rec);
  })(sf);

  assert.ok(claves.length >= 8, `🔴 NO SUPE LEER el censo de SCRUM-389: sólo ${claves.length} claves`);

  const mios = censarAritmeticaIva(RAIZ).hallazgos.filter(criterioDe389).map((h) => h.ruta).sort();
  assert.deepEqual(mios, [...claves].sort(),
    '🔴 mi copia del criterio de SCRUM-389 ya NO produce su misma lista. O el censo cambió, o mi '
    + 'copia dejó de ser fiel — y entonces todo lo que este fichero afirma sobre «lo que aquel ve» '
    + 'deja de valer.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA POBLACIÓN MEDIDA · con el CERO declarado de los demás
// ─────────────────────────────────────────────────────────────────────────────────────────
const INVISIBLES = [
  'src/core/utils/utils.ts',
  'src/core/validation/schemas.ts',
  'src/modules/expenses/domain/justificante.ts',
  'src/modules/invoicing/domain/recargoEquivalencia.ts',
  'src/modules/jobs/domain/albaran.service.ts',
  'src/modules/jobs/domain/albaranAFactura.ts',
  // 🔴 SALE `maintenance.service.ts` (SCRUM-627b, 25-ago-2026) — y baja de 9 a 8. NO es un
  // refinamiento silencioso: era un FALSO POSITIVO probado. El alias del impuesto nacía del
  // NOMBRE de una propiedad (`let line: QuoteLine = { …, tax: 0 }`), así que `line` entera pasaba
  // por impuesto y `line.price * line.qty` —que no toca ninguno— salía marcada. Arreglado en
  // `_censo-aritmetica-iva.mjs`: el nombre de una propiedad ya no cuenta como mención; su VALOR
  // sí. Medido: era el único, y quitarlo no pierde ningún hallazgo real.
  // La entrada se anota en vez de borrarse a secas, para que la bajada no parezca una pérdida.
  'src/modules/quotes/app/routes/quotes.routes.ts',
  'src/modules/system/app/routes/customerPortal.routes.ts',
];

test('SCRUM-627 · OCHO ficheros hacen aritmética de IVA sin llamar a la primitiva', () => {
  const invisibles = censarAritmeticaIva(RAIZ).hallazgos.filter((h) => !criterioDe389(h)).map((h) => h.ruta);
  assert.deepEqual(invisibles.sort(), [...INVISIBLES].sort(),
    '🔴 cambió la lista de los que hacen aritmética de IVA y SCRUM-389 no ve. Si ha CRECIDO, hay '
    + 'un sitio nuevo que deriva IVA por su cuenta y nadie lo ha mirado. Si ha BAJADO, alguien lo '
    + 'arregló y hay que anotarlo — un arreglo sin anotar se deshace solo.');
});

test('SCRUM-627 · 🔴 y UNA SOLA reimplementa el DESGLOSE: el cero de las demás, declarado', () => {
  const completos = censarAritmeticaIva(RAIZ).hallazgos.filter((h) => h.desgloseCompleto).map((h) => h.ruta).sort();
  assert.deepEqual(completos, [
    'src/modules/invoicing/domain/vat.service.ts',        // la primitiva: es su trabajo
    'src/modules/invoicing/infra/pdf/pdf.service.ts',     // 🔴 LA reimplementación
  ], '🔴 cambió quién agrupa IVA por tipo con su propio acumulador. Un nombre NUEVO aquí es una '
    + 'segunda cifra del mismo dinero, que es exactamente lo que el censo de SCRUM-389 existe '
    + 'para impedir y lo que hoy no puede ver.');
});
