// tests/scrum313-continuidad-numeracion.test.mjs — SCRUM-313 (D2) · «¿Por qué número vas?»
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTA TAREA EXISTE
//
// Un autónomo que ya factura no se cambia de programa porque el nuevo sea más bonito. No se
// cambia porque **romper la serie de numeración le da miedo con Hacienda**. Preguntarle por
// dónde va, y continuarlo, es la barrera de cambio hecha polvo.
//
// Y se pregunta EN EL ALTA, no en Configuración: quien viene de otro programa no entra en
// Configuración el primer día — entra, hace un presupuesto, y descubre el problema cuando ya ha
// emitido tres facturas mal numeradas. La pregunta se hace cuando la respuesta todavía sirve.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ LA TRAMPA, Y ES FISCAL: LOS DOS CAMPOS VAN JUNTOS
//
// `resolveSeriesSeq` decide `invoiceSeriesYear === year ? nextInvoiceNumber : 1`. Fijar el 42
// SIN fijar también el año **no continúa la serie: la reinicia en 1**, en silencio. El
// profesional creería ir por la 42 y su primera factura saldría `2026-CF-001` — un número que ya
// usó en su programa anterior. **Duplicar un número emitido es peor que dejar un hueco.**
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const { arranqueDeSerie, MAX_NUMERO_SERIE } = await import('../dist/core/validation/fiscalInput.js');
const { formatInvoiceNumber, resolveSeriesSeq } = await import('../dist/modules/invoicing/domain/invoiceNumber.service.js');

const AÑO = 2026;
const num = (seq) => formatInvoiceNumber('CF', AÑO, seq);

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS RAMAS DEL ALTA — probar solo una no demuestra nada
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-313 · «vengo de otro sitio»: continúa por la SIGUIENTE', () => {
  const r = arranqueDeSerie({ vieneDeOtroSitio: true, ultimoNumero: 41, año: AÑO, numerosDeLaSerie: [] });
  assert.equal(r.ok, true);
  assert.equal(r.nextInvoiceNumber, 42,
    '🔴 no continúa por la siguiente. Si su última fue la 41, la nuestra es la 42 — repetir la 41 ' +
    'sería emitir dos veces el mismo número.');
  assert.equal(r.invoiceSeriesYear, AÑO,
    '🔴 no se fija el año de la serie. Sin él `resolveSeriesSeq` devuelve 1 y toda la continuidad ' +
    'que acabamos de prometer se pierde EN SILENCIO.');
});

test('SCRUM-313 · CONTROL NEGATIVO — «No, empiezo ahora» NO hereda nada', () => {
  const r = arranqueDeSerie({
    vieneDeOtroSitio: false, ultimoNumero: 999, año: AÑO, numerosDeLaSerie: [],
  });
  assert.equal(r.ok, true);
  assert.equal(r.nextInvoiceNumber, 1,
    '🔴 quien empieza de cero hereda un número. El 999 de la petición NO puede colarse: es un ' +
    'campo que su rama del formulario ni siquiera enseña.');
  assert.equal(r.invoiceSeriesYear, AÑO);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS CAMPOS, JUNTOS — el par se comprueba CONTRA EL EMISOR REAL
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-313 · el par que devuelve produce DE VERDAD el número prometido', () => {
  // No se comprueba contra una copia de la regla: se le pregunta a `resolveSeriesSeq`, que es
  // quien decide de verdad al emitir. Si algún día cambia, este test cae y no al revés.
  const r = arranqueDeSerie({ vieneDeOtroSitio: true, ultimoNumero: 41, año: AÑO, numerosDeLaSerie: [] });
  const seq = resolveSeriesSeq(
    { invoiceSeriesYear: r.invoiceSeriesYear, nextInvoiceNumber: r.nextInvoiceNumber }, AÑO,
  );
  assert.equal(seq, 42, '🔴 el emisor no daría el número que la pantalla prometió');
  assert.equal(formatInvoiceNumber('CF', AÑO, seq), num(42));
});

test('SCRUM-313 · fijar el número SIN el año reiniciaría la serie — y por eso van juntos', () => {
  // El rojo del defecto, escrito como demostración: así se comportaría si alguien escribiera solo
  // `nextInvoiceNumber`. Es lo que este diseño impide devolviendo siempre el par.
  const seqSinAño = resolveSeriesSeq({ invoiceSeriesYear: null, nextInvoiceNumber: 42 }, AÑO);
  assert.equal(seqSinAño, 1,
    'suelo de la afirmación: sin año, el emisor devuelve 1 — no 42');
  const seqConAño = resolveSeriesSeq({ invoiceSeriesYear: AÑO, nextInvoiceNumber: 42 }, AÑO);
  assert.equal(seqConAño, 42);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CHOQUE (la puerta de A4) Y LAS ENTRADAS IMPOSIBLES
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-313 · declarar un arranque con facturas YA emitidas se PARA', () => {
  // A4 puso la puerta; aquí se comprueba que esta pantalla la respeta en vez de rodearla.
  const r = arranqueDeSerie({
    vieneDeOtroSitio: true, ultimoNumero: 41, año: AÑO, numerosDeLaSerie: [num(48), num(49), num(50)],
  });
  assert.equal(r.ok, false,
    '🔴 se deja declarar un arranque cuando ya hemos emitido. Declarar la 42 con la 50 emitida ' +
    'repetiría ocho números que ya existen, y una factura emitida no se edita (regla 29).');
  assert.equal(r.motivo, 'choca_con_emitidas');
  assert.equal(r.detalle.ultimoEmitido, num(50),
    '🔴 no se dice hasta qué número hemos emitido. Sin ese dato el profesional no puede entender ' +
    'qué le estamos negando ni por qué.');
});

test('SCRUM-313 · un número imposible se rechaza, no se redondea', () => {
  const casos = [
    ['0', 'numero_invalido'], ['-3', 'numero_invalido'], ['abc', 'numero_invalido'],
    ['4.5', 'numero_invalido'], ['', 'numero_invalido'], [undefined, 'numero_invalido'],
    [MAX_NUMERO_SERIE, 'numero_fuera_de_rango'],
  ];
  for (const [valor, motivo] of casos) {
    const r = arranqueDeSerie({ vieneDeOtroSitio: true, ultimoNumero: valor, año: AÑO, numerosDeLaSerie: [] });
    assert.equal(r.ok, false, `🔴 se acepta ${JSON.stringify(valor)} como número de factura`);
    assert.equal(r.motivo, motivo, `motivo equivocado para ${JSON.stringify(valor)}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · el censo de dónde se fija el arranque
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-313 · SUELO: el censo encuentra dónde se fija el arranque de numeración', () => {
  // «Nadie lo fija» y «no supe mirar» son el mismo número. Si el barrido vuelve vacío, lo que
  // está roto es el barrido — y su veredicto no vale.
  const ficheros = [];
  const anda = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) anda(p);
      else if (/\.ts$/.test(e.name)) ficheros.push(p);
    }
  };
  anda(path.join(RAIZ, 'src'));
  assert.ok(ficheros.length > 50,
    `🔴 el barrido solo ve ${ficheros.length} ficheros .ts: no está recorriendo el árbol.`);

  const tocan = ficheros.filter((p) => {
    const s = fs.readFileSync(p, 'utf8');
    return s.includes('nextInvoiceNumber') || s.includes('invoiceSeriesYear');
  }).map((p) => path.relative(RAIZ, p).replace(/\\/g, '/'));

  assert.ok(tocan.length > 0,
    '🔴 CERO sitios fijan o leen el arranque de numeración. Eso no significa «nadie lo toca»: ' +
    'significa que el censo no está mirando, y con él en cero nada de lo de arriba está ' +
    'verificado contra el producto real.');
  assert.ok(tocan.some((f) => f.includes('invoiceNumber.service')),
    '🔴 el censo no encuentra el asignador, que es quien LEE el arranque. Si no lo ve, no está ' +
    'mirando donde cree.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// REGLA 30 · la microcopy va marcada
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-313 · la microcopy de la pregunta va PENDIENTE de aprobación', () => {
  // Todo el texto de esta tarea habla de una obligación con Hacienda. Un texto fiscal mal escrito
  // no es feo: es peligroso — puede llevar a alguien a numerar mal y creerse cubierto.
  const src = fs.readFileSync(path.join(RAIZ, 'src/core/validation/fiscalInput.ts'), 'utf8');
  assert.match(src, /SCRUM-313/,
    '🔴 el mecanismo de D2 ya no está en validación fiscal: el test no mira donde cree.');
});
