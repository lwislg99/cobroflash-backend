// tests/scrum747-validar-antes-de-normalizar.test.mjs — SCRUM-747
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN MES QUE NO EXISTE NO TIENE UN MES CORRECTO QUE ADIVINAR
//
// `Date.UTC` **normaliza en silencio**. Medido en SCRUM-648: `'2026-13'` producía el plazo
// `2027-01-31` y el semáforo lo pintaba **verde**, porque para él era un plazo perfectamente
// bueno — sólo que de otro mes.
//
// 🔴 Y ESO ES PEOR QUE UN VALOR ILEGIBLE: contra un ilegible se puede programar una barrera
// porque es **detectable**; contra un plazo plausible **no hay síntoma**. El número es finito, el
// semáforo es correcto para ese número, y el número es de otro mes.
//
// ⛔ NO SE REPARA CON UN VALOR POR DEFECTO. Elegir un mes vecino convertiría un dato roto en un
// plazo legal inventado. Se falla **nombrando el valor**, que es lo único que permite arreglar el
// origen en vez de taparlo.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

// 🔴 SÓLO LA SUPERFICIE PÚBLICA. `MesKeyInvalidoError` y `partesDelMesKey` NO se exportan --lo
// pidió el guard de SCRUM-411 y tenía razón: su único consumidor está dentro del módulo, y un
// export que sólo usa su test es indistinguible de una función entregada--. Se comprueban por lo
// que de verdad usa alguien, que además es lo que vería un llamador real.
import {
  fechaLimiteRecapitulativa, avisoDeFacturacion,
} from '../dist/modules/jobs/domain/pendientesFacturar.service.js';
import { censo, partesSinValidar, tamanoPoblacion, CEBO, CEBO_ESPERADO } from './_partes-sin-validar.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

/**
 * 🔴 EL FILO · el resultado esperado se DERIVA, no se congela.
 *
 * Un fichero de referencia con 2.424 filas envejecería igual que las cifras de SCRUM-737. Aquí
 * la expectativa se calcula por OTRO camino —tabla de días por mes con la regla de bisiesto,
 * escrita a mano— para que sean dos implementaciones independientes contrastándose. Si las dos
 * coincidieran por compartir el error, no serían dos.
 */
const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const bisiesto = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
function limiteEsperado(y, m, tipo) {
  if (tipo === 'EMPRESARIO') {
    const ys = m === 12 ? y + 1 : y;
    const ms = m === 12 ? 1 : m + 1;
    return `${ys}-${String(ms).padStart(2, '0')}-16`;
  }
  const d = m === 2 && bisiesto(y) ? 29 : DIAS_MES[m - 1];
  return `${y}-${String(m).padStart(2, '0')}-${d}`;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL FILO — endurecer de más rompe la bandeja de quien no tenía ningún problema
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-747 · 🔴 EL FILO: los 2.424 casos legítimos siguen dando EXACTAMENTE lo mismo', () => {
  let comprobados = 0;
  const rotos = [];
  for (let y = 2000; y <= 2100; y++) {
    for (let m = 1; m <= 12; m++) {
      const k = `${y}-${String(m).padStart(2, '0')}`;
      for (const tipo of ['PARTICULAR', 'EMPRESARIO']) {
        const real = fechaLimiteRecapitulativa(k, tipo);
        const esperado = limiteEsperado(y, m, tipo);
        if (real !== esperado) rotos.push(`${k} · ${tipo} → ${real} (se esperaba ${esperado})`);
        comprobados++;
      }
    }
  }
  assert.equal(comprobados, 2424, `🔴 CIEGO: sólo se han comprobado ${comprobados} casos.`);
  assert.deepEqual(rotos.slice(0, 10), [],
    `🔴 SE HA ENDURECIDO DE MÁS: ${rotos.length} de ${comprobados} casos LEGÍTIMOS han cambiado ` +
    'de resultado. Validar la entrada no puede mover un plazo que ya era correcto.\n     ' +
    rotos.slice(0, 10).join('\n     '));

  // Y el desbordamiento LEGÍTIMO de año sigue funcionando, que es lo que `Date.UTC` sí debía hacer.
  assert.equal(fechaLimiteRecapitulativa('2026-12', 'EMPRESARIO'), '2027-01-16');
  assert.equal(fechaLimiteRecapitulativa('2024-02', 'PARTICULAR'), '2024-02-29', 'bisiesto');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ANTES SE NORMALIZABA EN SILENCIO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-747 · 🔴 un mes fuera de rango FALLA, y el error NOMBRA el valor', () => {
  const CORRUPTOS = ['2026-13', '2026-00', '99999-99', '2026-1', '2026-', '-09', '2026-09-04', '', '  ', 'basura'];
  for (const k of CORRUPTOS) {
    assert.throws(
      () => fechaLimiteRecapitulativa(k, 'PARTICULAR'),
      (e) => {
        assert.equal(e.name, 'MesKeyInvalidoError', `🔴 ${JSON.stringify(k)} no lanza MesKeyInvalidoError`);
        assert.ok(e.message.includes(JSON.stringify(k)),
          `🔴 el error de ${JSON.stringify(k)} NO nombra el valor. Un fallo que no dice QUÉ entró ` +
          'obliga a reproducirlo para arreglarlo, y el origen puede estar en otra máquina.');
        return true;
      },
      `🔴 ${JSON.stringify(k)} debería fallar y no lo hace`,
    );
  }

  // 🔴 Y NO SE ADIVINA: `2026-13` NO se convierte en enero de 2027 «porque es lo que sale». Se
  // comprueba por la superficie: la fecha que ANTES devolvía ya no sale por ninguna puerta.
  assert.throws(() => fechaLimiteRecapitulativa('2026-13', 'PARTICULAR'), /mesKey inválido/);
  assert.equal(fechaLimiteRecapitulativa('2026-09', 'PARTICULAR'), '2026-09-30');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL HUECO QUE YO MISMA DEJÉ DECLARADO EN SCRUM-648
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-747 · `avisoDeFacturacion` recibe el mismo mesKey, y ya no se lo traga', () => {
  const HOY = new Date('2026-09-20T10:00:00Z');
  const MADRID = 'Europe/Madrid';

  // Antes: con `2026-13` el `dia16` salía `2026-13-16` (ilegible), `diasEntre` daba NaN, la
  // comparación era falsa y **el aviso quincenal se perdía en silencio**.
  assert.throws(() => avisoDeFacturacion('QUINCENAL', 'verde', '2026-13', HOY, MADRID), /mesKey inválido/,
    '🔴 si el semáforo miente, este aviso también: recibe el MISMO mesKey y decide SI AVISAR.');

  // CONTROL NEGATIVO: con un mesKey bueno, el aviso sigue funcionando igual que antes.
  assert.deepEqual(avisoDeFacturacion('QUINCENAL', 'verde', '2026-09', HOY, MADRID),
    { avisar: true, motivo: 'periodicidad' });
  assert.deepEqual(avisoDeFacturacion('NINGUNA', 'verde', '2026-09', HOY, MADRID),
    { avisar: false, motivo: null });
  // Y la ley por delante de lo pactado, que no se ha tocado.
  assert.deepEqual(avisoDeFacturacion('NINGUNA', 'rojo', '2026-09', HOY, MADRID),
    { avisar: true, motivo: 'plazo_legal' });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CENSO — quién MÁS trocea una cadena a números sin mirar el resultado
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 LOS QUE QUEDAN, NOMBRADOS. No se arreglan aquí y cada uno dice por qué.
 *
 * Este ticket cierra los DOS de `pendientesFacturar.service.ts` — el del plazo legal y el del
 * aviso—, que son los que producen un plazo del art. 13.2. Los otros cuatro quedan censados:
 * subir un total sin decir qué lo compone es cómo un censo deja de vigilar.
 */
const PENDIENTES = [
  { fichero: 'src/core/zonaDelMerchant.ts', fn: 'inicioDelDiaEn',
    porque: 'primitiva usada por cuatro cálculos; su entrada ya viene de `diaNaturalEn`, que sólo produce días bien formados. Arreglarla toca los cuatro y merece su paso' },
  { fichero: 'src/core/zonaDelMerchant.ts', fn: 'finDelDiaEn', porque: 'idéntico al anterior' },
  { fichero: 'src/modules/expenses/domain/expenses.service.ts', fn: 'listExpenses',
    porque: 'otro módulo, otro carril (regla 9)' },
  { fichero: 'src/modules/jobs/domain/albaran.service.ts', fn: 'mesNaturalLabel',
    porque: 'produce una ETIQUETA para leer, no un plazo legal: el coste de equivocarse no es el mismo' },
];

test('SCRUM-747 · 🔴 SUELO: el censo VE el árbol y la autoprueba acierta', () => {
  const n = tamanoPoblacion(RAIZ);
  assert.ok(n >= 200, `🔴 CIEGO: sólo ${n} ficheros en la población. El barrido no llega a src/.`);
  assert.equal(partesSinValidar('cebo.ts', CEBO).length, CEBO_ESPERADO,
    '🔴 el detector no acierta sobre el cebo: ve troceos con validación, o se pierde los que no la tienen.');
});

test('SCRUM-747 · el censo de troceos SIN validar no crece, y los dos del plazo ya NO están', () => {
  const todos = censo(RAIZ);

  const delPlazo = todos.filter((c) => c.fichero.endsWith('pendientesFacturar.service.ts'));
  assert.deepEqual(delPlazo, [],
    '🔴 HA VUELTO UN TROCEO SIN VALIDAR al fichero del plazo legal. Es exactamente lo que este ' +
    'ticket cerró: `Date.UTC` normalizaría en silencio otra vez.\n     ' +
    delPlazo.map((c) => `${c.fichero}:${c.linea} (${c.fn})`).join('\n     '));

  const nombres = todos.map((c) => `${c.fichero}|${c.fn}`).sort();
  const esperados = PENDIENTES.map((p) => `${p.fichero}|${p.fn}`).sort();
  assert.deepEqual(nombres, esperados,
    '🔴 EL CENSO SE HA MOVIDO. Si has añadido un troceo sin validar, valídalo o anótalo en ' +
    '`PENDIENTES` con su motivo. Si has arreglado uno, quítalo de la lista — una lista de ' +
    'pendientes que no se vacía deja de ser una lista.\n' +
    `     hay:      ${JSON.stringify(nombres, null, 0)}\n` +
    `     esperado: ${JSON.stringify(esperados, null, 0)}`);
});
