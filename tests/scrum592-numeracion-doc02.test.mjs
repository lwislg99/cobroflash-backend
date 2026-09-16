// tests/scrum592-numeracion-doc02.test.mjs — SCRUM-592 (DOC-02)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// NUMERACIÓN CORRELATIVA CON SERIE ANUAL — el COMPORTAMIENTO, no el formato
//
// La víctima: los presupuestos de un profesional salían `#26`, `#28`, `#32`. Medido en
// `yaqu_dev_javier` el 4-sep-2026, el merchant 1 tenía `[1, 13, 14, 15, 16]` — **faltan del 2 al
// 12**. Cuando su cliente le pregunta por «el presupuesto 32» no puede decir de cuántos es ni de
// qué año, y esa lista no es defendible ante nadie.
//
// ── 🔴 LO QUE DE VERDAD CAMBIA, Y NO ES EL FORMATO ──────────────────────────────────────
//
// El contador correlativo YA ESTABA: `allocateQuoteNumber` usaba un `{ increment: 1 }` atómico.
// Lo que rompe ese mecanismo es la SERIE ANUAL: con reinicio hay que LEER el año y DECIDIR si el
// siguiente es `nextQuoteNumber` o `1`, y eso es un read-then-write que en READ COMMITTED **no
// serializa**. Dos creaciones simultáneas del primer presupuesto del año leerían las dos «serie
// vacía» y escribirían las dos el 1.
//
// No es una hipótesis: es literalmente lo que `allocateAlbaranNumber` dejó escrito al cerrar
// SCRUM-234 —«también tiene reinicio anual, así que también va con cerrojo y no con
// `{ increment: 1 }`»—. Aquí se sigue esa decisión en vez de inventar otra.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planDeRenumeracion, contadoresFinales } from '../scripts/_renumerar-documentos.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const F = await import('../dist/core/documentos/formatoNumero.js');
const Q = await import('../dist/modules/quotes/domain/quoteNumber.service.js');
const A = await import('../dist/modules/jobs/domain/albaranNumber.service.js');

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · si la pieza no distingue nada, todo lo de abajo pasa sin medir
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-592 · SUELO: el formateador responde y DISTINGUE serie, año y secuencia', () => {
  assert.equal(typeof F.formatoNumeroDocumento, 'function');
  const base = F.formatoNumeroDocumento(F.SERIES.presupuesto, 2026, 1);
  assert.notEqual(base, F.formatoNumeroDocumento(F.SERIES.albaran, 2026, 1), '🔴 no distingue la SERIE');
  assert.notEqual(base, F.formatoNumeroDocumento(F.SERIES.presupuesto, 2027, 1), '🔴 no distingue el AÑO');
  assert.notEqual(base, F.formatoNumeroDocumento(F.SERIES.presupuesto, 2026, 2), '🔴 no distingue la SECUENCIA');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL FORMATO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-592 · 🔴 el formato es `[LETRA][AA][NNNN]`, con los números del encargo', () => {
  assert.equal(F.formatoNumeroDocumento(F.SERIES.presupuesto, 2026, 1), 'P260001');
  assert.equal(F.formatoNumeroDocumento(F.SERIES.albaran, 2026, 1), 'AB260001');
  assert.equal(F.formatoNumeroDocumento(F.SERIES.presupuesto, 2027, 1), 'P270001',
    '🔴 el reinicio anual tiene que dar `P270001`, que es el ejemplo del encargo');
  assert.equal(F.formatoNumeroDocumento(F.SERIES.presupuesto, 2026, 9999), 'P269999');
});

test('SCRUM-592 · el año va DELANTE de la secuencia, y eso ordena la lista', () => {
  // Con el año delante, ordenar como texto ordena como cronología. Con la secuencia delante, no.
  const nums = [
    F.formatoNumeroDocumento(F.SERIES.presupuesto, 2027, 1),
    F.formatoNumeroDocumento(F.SERIES.presupuesto, 2026, 9),
    F.formatoNumeroDocumento(F.SERIES.presupuesto, 2026, 10),
  ];
  assert.deepEqual([...nums].sort(), ['P260009', 'P260010', 'P270001'],
    '🔴 ordenar los números como texto no da el orden cronológico');
});

test('SCRUM-592 · 🔴 al desbordar, el número CRECE — nunca se trunca', () => {
  // Truncar daría dos documentos con el mismo número, que es lo único inaceptable. Un número más
  // largo sólo es más feo, y a 10.000 documentos al año ya hay otra conversación que tener.
  const n = F.formatoNumeroDocumento(F.SERIES.presupuesto, 2026, 10000);
  assert.equal(n, 'P2610000');
  assert.notEqual(n, F.formatoNumeroDocumento(F.SERIES.presupuesto, 2026, 1000),
    '🔴 el 10.000 y el 1.000 dan el MISMO número: se está truncando');
  assert.deepEqual(F.parseNumeroDocumento('P2610000'), { serie: 'P', year: 2026, seq: 10000 });
});

test('SCRUM-592 · una secuencia 0 o negativa NO se formatea: se rechaza', () => {
  // La serie empieza en 1. Un 0 sería un documento que nadie emitió.
  for (const malo of [0, -1, 1.5]) {
    assert.throws(() => F.formatoNumeroDocumento(F.SERIES.presupuesto, 2026, malo), RangeError,
      `🔴 acepta la secuencia ${malo}`);
  }
});

test('SCRUM-592 · `parse` reconoce lo suyo y RECHAZA lo ajeno', () => {
  assert.deepEqual(F.parseNumeroDocumento('P260001'), { serie: 'P', year: 2026, seq: 1 });
  assert.deepEqual(F.parseNumeroDocumento('AB260012'), { serie: 'AB', year: 2026, seq: 12 });
  // Lo de antes, y lo que no es de aquí: nada de esto puede pasar por un número nuevo.
  for (const ajeno of ['ALB-2026-001', '#26', '2026-CF-001', 'J-20260722-R8Y8', 'P26', '', null]) {
    assert.equal(F.parseNumeroDocumento(ajeno), null, `🔴 «${ajeno}» pasa por número nuevo`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL REINICIO ANUAL, CON LA FECHA FIJADA — sin esperar a enero de 2027
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-592 · 🔴 el 1 de enero la serie vuelve a 1', () => {
  // Serie de 2026 con el contador en 47; llega 2027 → el siguiente es el 1, no el 47.
  assert.equal(F.secuenciaDelAnio({ seriesYear: 2026, nextNumber: 47 }, 2027), 1,
    '🔴 la serie NO se reinicia: el primer presupuesto de 2027 saldría con el número 47');
  // Y dentro del mismo año NO se reinicia, que es la otra mitad.
  assert.equal(F.secuenciaDelAnio({ seriesYear: 2026, nextNumber: 47 }, 2026), 47,
    '🔴 la serie se reinicia DENTRO del mismo año: repetiría números ya usados');
  // Serie sin estrenar → empieza en 1.
  assert.equal(F.secuenciaDelAnio({ seriesYear: null, nextNumber: 1 }, 2026), 1);
});

test('SCRUM-592 · 🔴 contador avanzado SIN año no cae al 1 en silencio', () => {
  // Es el caso real de `yaqu_dev_javier`: `nextQuoteNumber = 17` con `quoteSeriesYear = null`,
  // porque esos presupuestos se numeraron ANTES de que la serie tuviera año. Devolver 1 repetiría
  // números que ya se enseñaron. Es la misma trampa que SCRUM-306 cerró para los albaranes.
  assert.equal(F.secuenciaDelAnio({ seriesYear: null, nextNumber: 17 }, 2026), 17,
    '🔴 un contador en 17 sin año vuelve al 1: repetiría los dieciséis números ya usados');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA RENUMERACIÓN: idempotente, por FECHA, y sin dejar el futuro roto
// ═════════════════════════════════════════════════════════════════════════════════════════

const DOCS = [
  // A propósito, el id NO sigue el orden de creación: es lo que se midió en dev.
  { id: 283, merchantId: 71, createdAt: '2026-03-01T10:00:00Z', numeroActual: null },
  { id: 280, merchantId: 71, createdAt: '2026-01-15T10:00:00Z', numeroActual: null },
  { id: 281, merchantId: 71, createdAt: '2026-02-01T10:00:00Z', numeroActual: null },
  { id: 400, merchantId: 2, createdAt: '2026-01-02T10:00:00Z', numeroActual: null },
  { id: 500, merchantId: 71, createdAt: '2027-01-03T10:00:00Z', numeroActual: null },
];
const OPTS = {
  formatear: (s, y, n) => F.formatoNumeroDocumento(s, y, n),
  serie: F.SERIES.presupuesto,
  yaRenumerado: (n) => F.esNumeroNuevo(n),
};

test('SCRUM-592 · 🔴 renumera POR FECHA DE CREACIÓN, no por id', () => {
  const { plan } = planDeRenumeracion(DOCS, OPTS);
  const delMerchant1 = plan.filter((p) => p.merchantId === 71 && p.year === 2026);
  assert.deepEqual(delMerchant1.map((p) => [p.id, p.a]), [
    [280, 'P260001'], [281, 'P260002'], [283, 'P260003'],
  ], '🔴 el orden NO sigue la cronología del profesional. Medido en dev: id y fecha DIFIEREN.');
});

test('SCRUM-592 · cada merchant y cada AÑO tienen su propia serie', () => {
  const { plan } = planDeRenumeracion(DOCS, OPTS);
  const porId = Object.fromEntries(plan.map((p) => [p.id, p.a]));
  assert.equal(porId[400], 'P260001', '🔴 el merchant 2 no empieza por su propio 1');
  assert.equal(porId[500], 'P270001', '🔴 2027 no abre serie nueva');
});

test('SCRUM-592 · 🔴 IDEMPOTENTE: repetir el proceso no vuelve a renumerar ni mueve a nadie', () => {
  const primera = planDeRenumeracion(DOCS, OPTS);
  // Se aplica el plan sobre los datos y se vuelve a pasar, que es lo que haría una segunda corrida.
  const yaHechos = DOCS.map((d) => {
    const p = primera.plan.find((x) => x.id === d.id);
    return p ? { ...d, numeroActual: p.a } : d;
  });
  const segunda = planDeRenumeracion(yaHechos, OPTS);

  assert.deepEqual(segunda.plan, [],
    `🔴 la segunda pasada volvería a renumerar ${segunda.plan.length} documento(s). Un proceso que `
    + 'no es idempotente cambia el número cada vez que alguien lo lanza.');
  assert.equal(segunda.saltados, DOCS.length, '🔴 no reconoce como hechos los que ya lo están');
  // 🔴 Y LO QUE DE VERDAD IMPORTA: los saltados CONSUMEN su número. Si no, el siguiente
  // documento nuevo recibiría un número ya usado.
  assert.deepEqual(
    contadoresFinales(segunda.contadores).sort((a, b) => a.merchantId - b.merchantId),
    contadoresFinales(primera.contadores).sort((a, b) => a.merchantId - b.merchantId),
    '🔴 los contadores cambian entre pasadas: un documento ya renumerado no está consumiendo su '
    + 'número, y el siguiente nuevo repetiría uno.');
});

test('SCRUM-592 · 🔴 deja el CONTADOR listo: el siguiente nuevo no repite número', () => {
  const { contadores } = planDeRenumeracion(DOCS, OPTS);
  const finales = contadoresFinales(contadores);
  const m1 = finales.find((c) => c.merchantId === 71);
  // El merchant 1 tiene 3 de 2026 y 1 de 2027 → manda 2027, y el siguiente es el 2.
  assert.equal(m1.year, 2027, '🔴 no manda el año más alto');
  assert.equal(m1.siguiente, 2,
    '🔴 el contador queda mal: el siguiente presupuesto de 2027 repetiría el P270001');
});

test('SCRUM-592 · una mezcla de renumerados y sin renumerar no se pisa', () => {
  // El caso real de una renumeración interrumpida a medias.
  const mezcla = [
    { id: 1, merchantId: 9, createdAt: '2026-01-01T00:00:00Z', numeroActual: 'P260001' },
    { id: 2, merchantId: 9, createdAt: '2026-01-02T00:00:00Z', numeroActual: null },
  ];
  const { plan } = planDeRenumeracion(mezcla, OPTS);
  assert.deepEqual(plan.map((p) => [p.id, p.a]), [[2, 'P260002']],
    '🔴 el segundo no coge el 2: la renumeración a medias produciría un duplicado');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL DEFECTO DE `displayQuoteNumber`, QUE ES DE ESTE CARRIL
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-592 · 🔴 un presupuesto sin número NO enseña el id global de la plataforma', () => {
  // Hasta hoy caía a `#${id}` — el id de la tabla, o sea el VOLUMEN DE TODA LA PLATAFORMA
  // enseñado al profesional, que es justo lo que A1.2 vino a esconder. Medido: en staging hay
  // uno así ahora mismo.
  const sinNumero = Q.displayQuoteNumber({ quoteNumber: null, id: 280, createdAt: '2026-01-01' });
  assert.equal(sinNumero, Q.SIN_NUMERO);
  assert.equal(sinNumero.includes('280'), false,
    '🔴 EL ID GLOBAL SE ESTÁ ENSEÑANDO. Un presupuesto sin número se dice sin número: enseñar un '
    + 'id ajeno no lo arregla, lo disfraza.');
  assert.equal(Q.displayQuoteNumber({ quoteNumber: 3, createdAt: '2026-05-05' }), 'P260003');
});

test('SCRUM-592 · el display se DERIVA: no hay columna de texto que pueda discrepar', () => {
  // El dato son la secuencia y el año; `P260003` es la forma de escribirlos. Si además se
  // guardara el texto, los dos podrían separarse y habría que decidir cuál manda.
  const q = { quoteNumber: 3, createdAt: '2026-05-05T00:00:00Z' };
  assert.equal(Q.displayQuoteNumber(q), Q.displayQuoteNumber({ ...q }));
  assert.equal(Q.displayQuoteNumber({ quoteNumber: 3, createdAt: '2027-01-01T00:00:00Z' }), 'P270003',
    '🔴 el año no sale de la fecha del documento');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ALBARÁN · y la transición, que no es pereza
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-592 · el albarán emite en el formato nuevo y RECONOCE el viejo', () => {
  assert.equal(A.formatAlbaranNumber(2026, 1), 'AB260001');
  // Mientras haya una base sin renumerar —producción espera—, un lector que sólo conozca la
  // forma nueva daría por «no es un albarán» a documentos que sí lo son.
  assert.equal(A.isAlbaranNumber('ALB-2026-001'), true, '🔴 deja de reconocer los de antes');
  assert.equal(A.isAlbaranNumber('AB260001'), true, '🔴 no reconoce los suyos');
  assert.equal(A.isAlbaranNumber('P260001'), false, '🔴 confunde un presupuesto con un albarán');
  assert.equal(A.isAlbaranNumber('2026-CF-001'), false, '🔴 confunde una FACTURA con un albarán');
  // Y distingue cuál está ya migrado, que es lo que pregunta la renumeración.
  assert.equal(A.esAlbaranRenumerado('ALB-2026-001'), false);
  assert.equal(A.esAlbaranRenumerado('AB260001'), true);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO · lo que NO debe mover un contador
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-592 · 🔴 CONTROL NEGATIVO: sólo tocan el contador los que emiten un número', () => {
  // «Crear un cliente no mueve ningún contador» — se comprueba sobre el ÁRBOL, que es donde
  // podría colarse: quién escribe `nextQuoteNumber` o `quoteSeriesYear`.
  const ficheros = [];
  const anda = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) anda(p);
      else if (e.name.endsWith('.ts')) ficheros.push(p);
    }
  };
  anda(path.join(RAIZ, 'src'));
  assert.ok(ficheros.length > 100, `🔴 SUELO: sólo ${ficheros.length} ficheros; el censo no mira el árbol`);

  const escriben = ficheros.filter((f) => {
    const s = fs.readFileSync(f, 'utf8');
    return /nextQuoteNumber\s*:/.test(s) || /quoteSeriesYear\s*:/.test(s);
  }).map((f) => f.slice(RAIZ.length + 1).split(path.sep).join('/'));

  assert.deepEqual(escriben, ['src/modules/quotes/domain/quoteNumber.service.ts'],
    '🔴 alguien MÁS escribe el contador de presupuestos. La correlatividad de esta serie vive en '
    + 'un solo sitio a propósito: `Quote` no tiene `@@unique` que lo respalde, así que un segundo '
    + `camino duplicaría sin que nada lo impida. Escriben: ${escriben.join(', ')}`);
});
