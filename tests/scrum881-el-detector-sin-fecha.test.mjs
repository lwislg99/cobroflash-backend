// tests/scrum881-el-detector-sin-fecha.test.mjs — SCRUM-881
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL DETECTOR DE HUECOS COMPONÍA SIN FECHA, Y TRAS EL CORTE LLAMABA «AJENA» A LO PROPIO
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// `huecosDeLaSerie` recibe NÚMEROS, no facturas: no tiene la fecha de emisión de ninguno. Desde
// SCRUM-780 el formato depende de esa fecha (`2026-CF-001` antes del corte del 7-sep-2026,
// `F260001` desde el corte). Componía siempre sin fecha —o sea, siempre en formato viejo—, así que
// toda factura emitida después del corte no casaba con nada y salía por `ajenos`.
//
// REPRODUCIDO CORRIENDO antes de tocar nada (17-sep-2026, contra `dist/`):
//     emitidas F260001, F260002, F260003 → ajenos 3 de 3 · ultimoSeq 0 · truncado true
//
// Y SCRUM-780 lo vio venir por el otro lado, en su propio expediente: «sin fecha se formatea como
// siempre… si al no saber la fecha esto eligiera el formato nuevo, el detector de huecos dejaría
// de reconocer lo ya emitido». Protegió lo anterior al corte y dejó desprotegido lo posterior. La
// salida no es elegir un lado: es componer LOS DOS y aceptar el que esté.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 NO dice que el detector se ejecute en el producto. Medido el 17-sep-2026: **NADIE llama a
//    `huecosDeLaSerie` para facturas en todo `src/`** —el único llamador es `albaranSerie.ts`, y
//    para albaranes—, así que hoy la población que evalúa en producto es CERO. El defecto es real
//    y está en el código; su alcance vivo, no.
import test from 'node:test';
import assert from 'node:assert/strict';

const { huecosDeLaSerie } = await import('../dist/modules/invoicing/domain/huecosSerie.js');
const { formatInvoiceNumber, CORTE_FORMATO_F } = await import('../dist/modules/invoicing/domain/invoiceNumber.service.js');

// ⚠️ MUTACIÓN DECLARADA (SCRUM-745): la ejecuta `npm run meta:mutaciones` en CI. Devuelve el
// barrido a UN SOLO testigo —el comportamiento de antes de este ticket— y exige el rojo.
// La sustitución cuenta 1: el texto aparece una vez en el fichero.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/invoicing/domain/huecosSerie.ts',
    de: "  const testigos: (Date | null | undefined)[] = corte.desde ? [undefined, corte.desde] : [undefined];",
    a: "  const testigos: (Date | null | undefined)[] = [undefined]; // sin el lado nuevo, a proposito",
    cae: 'SCRUM-881 · 🔴 ROJO REAL: una F26… posterior al corte es PROPIA, no ajena' },
];

const AÑO = 2026;
const ANTES_DEL_CORTE = new Date('2026-09-01T00:00:00.000Z');
const DESPUES_DEL_CORTE = new Date('2026-09-10T00:00:00.000Z');
const PREFIJO = 'CF';

/** Un número tal y como lo compuso la emisión, con su fecha real. */
const emitido = (seq, fecha, rect = false) => formatInvoiceNumber(PREFIJO, AÑO, seq, rect, fecha);

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO · un detector que no ve ninguna factura no dice «0 ajenas»: dice que no ha mirado
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-881 · 🔴 SUELO: sin facturas que examinar, el veredicto NO vale', () => {
  const vacio = huecosDeLaSerie([], PREFIJO, AÑO);
  assert.equal(vacio.emitidos, 0);
  // 🔴 El suelo que aplica ESTE guard: con `emitidos === 0`, su `ajenos: []` es CIEGO y no se
  // puede leer como salud. El módulo ya declara su parte —devuelve `emitidos` para que quien lo
  // consuma lo mire (SCRUM-291 ①)— y esa decisión no se toca; el suelo se ejerce aquí.
  assert.ok(vacio.ajenos.length === 0 && vacio.emitidos === 0,
    '🔴 CIEGO: cero facturas examinadas. «0 ajenas» sobre cero facturas no dice que el detector '
    + 'esté sano: dice que no ha mirado nada.');

  // Y el suelo de VERDAD: lo que se mide abajo tiene población. Si estas dos listas llegaran
  // vacías, los controles de abajo pasarían por construcción sin comprobar nada.
  const propias = [emitido(1, DESPUES_DEL_CORTE), emitido(2, DESPUES_DEL_CORTE)];
  assert.ok(propias.length >= 2 && propias.every(Boolean),
    '🔴 CIEGO: la población de los controles está vacía.');
  assert.ok(CORTE_FORMATO_F.desde instanceof Date,
    '🔴 CIEGO: el corte no tiene fecha, así que no hay dos lados que distinguir y todo lo de '
    + 'abajo pasaría sin medir nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② 🔴 ROJO REAL · lo propio deja de llamarse ajeno
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-881 · 🔴 ROJO REAL: una F26… posterior al corte es PROPIA, no ajena', () => {
  const serie = [1, 2, 3].map((s) => emitido(s, DESPUES_DEL_CORTE));
  // Control del control: que estos números son DE VERDAD del formato nuevo, y no un literal que
  // yo haya escrito a mano. Si el corte se moviera, esto lo dice en vez de medir otra cosa.
  assert.ok(serie.every((n) => /^F\d{6}$/.test(n)),
    `🔴 CIEGO: la emisión no está dando el formato F tras el corte; da ${serie.join(', ')}.`);

  const r = huecosDeLaSerie(serie, PREFIJO, AÑO);
  assert.deepEqual(r.ajenos, [],
    '🔴 EL DEFECTO ESTÁ DE VUELTA: el detector llama «ajenas» a facturas que emitió esta casa.\n'
    + `  emitidas: ${serie.join(', ')}\n`
    + `  ajenas:   ${r.ajenos.join(', ')}\n`
    + '  Compone sin fecha, así que sólo sabe el formato anterior al corte de SCRUM-780.');
  assert.equal(r.ultimoSeq, 3, '🔴 no ha casado hasta la última: ' + r.ultimoSeq);
  assert.equal(r.truncado, false,
    '🔴 el barrido se agotó: no casó nada y recorrió el tope entero.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ ✅ VERDE REAL · lo que SÍ es ajeno sigue saliendo ajeno
//    Sin esta mitad, «todo es propio» pasaría el test de arriba.
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-881 · ✅ VERDE REAL: un número de OTRA serie sigue saliendo ajeno', () => {
  // Emitido con OTRO prefijo — el caso que `huecosSerie` reporta aparte desde SCRUM-291.
  const ajenoDeVerdad = formatInvoiceNumber('ZZ', AÑO, 1, false, ANTES_DEL_CORTE);
  assert.notEqual(ajenoDeVerdad, emitido(1, ANTES_DEL_CORTE),
    '🔴 CIEGO: el «ajeno» que voy a usar coincide con uno propio; no probaría nada.');

  const r = huecosDeLaSerie([emitido(1, DESPUES_DEL_CORTE), ajenoDeVerdad], PREFIJO, AÑO);
  assert.deepEqual(r.ajenos, [ajenoDeVerdad],
    '🔴 SE HA PERDIDO LA SEÑAL: aceptar los dos lados del corte no puede convertir en «propio» '
    + 'todo lo que le echen. Un número de otra serie tiene que seguir saliendo aparte.');
});

test('SCRUM-881 · ✅ VERDE REAL: un hueco de verdad se sigue viendo, y con su formato', () => {
  // Falta la 2 en una serie POSTERIOR al corte: el hueco tiene que nombrarse en formato F.
  const r = huecosDeLaSerie(
    [emitido(1, DESPUES_DEL_CORTE), emitido(3, DESPUES_DEL_CORTE)], PREFIJO, AÑO);
  assert.deepEqual(r.ajenos, []);
  assert.deepEqual(r.huecos, [emitido(2, DESPUES_DEL_CORTE)],
    '🔴 el hueco no se reporta, o se reporta con el formato de la otra serie.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ LO QUE YA FUNCIONABA SIGUE FUNCIONANDO
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-881 · lo ANTERIOR al corte sigue casando, y una serie mixta no se pierde', () => {
  const viejas = [1, 2].map((s) => emitido(s, ANTES_DEL_CORTE));
  assert.ok(viejas.every((n) => /^\d{4}-/.test(n)),
    `🔴 CIEGO: antes del corte ya no se compone el formato viejo; da ${viejas.join(', ')}.`);
  const r = huecosDeLaSerie(viejas, PREFIJO, AÑO);
  assert.deepEqual(r.ajenos, [], '🔴 se ha roto lo que sí funcionaba antes del ticket.');
  assert.equal(r.ultimoSeq, 2);

  // 🔴 EL CASO QUE OBLIGA A ACEPTAR LOS DOS: tras el corte la serie F nace de cero (SCRUM-780 §②),
  // así que un mismo año puede tener las dos. Quedarse con un solo formato por `seq` mandaría la
  // otra a `ajenos` — el mismo defecto con el signo cambiado.
  const mixta = [...viejas, emitido(1, DESPUES_DEL_CORTE)];
  const rm = huecosDeLaSerie(mixta, PREFIJO, AÑO);
  assert.deepEqual(rm.ajenos, [],
    `🔴 con las dos series del mismo año, éstas salen ajenas: ${rm.ajenos.join(', ')}`);
  assert.equal(rm.emitidos, 3);
});
