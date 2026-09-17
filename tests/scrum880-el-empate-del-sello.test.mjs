// tests/scrum880-el-empate-del-sello.test.mjs — SCRUM-880
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ⛔ STOP FISCAL: ESTE FICHERO MIDE. NO ARREGLA NADA.
//
// SCRUM-880 lleva un STOP escrito: modificar el camino de emisión exige GO del fundador
// (regla 38). **Aquí no se modifica ni una línea del camino**: se le llama con un cliente de
// mentira y se observa qué decide. Leer el camino de emisión NO es un STOP; escribirlo sí.
//
// ── EL DEFECTO, RE-LEÍDO EN LA FUENTE Y NO HEREDADO ────────────────────────────────────────
//
// `ultimaHuellaDeLaCadena` desempata el último eslabón así (`verifactu.service.ts:481`):
//
//     return tAnul > tAlta ? ultimaAnul.vfAnulHash : ultimaAlta.vfHash;
//
// Con `>` ESTRICTO, el empate cae del lado del ALTA. Y el empate es posible porque los dos sellos
// se persisten como `new Date(formatFechaHoraHuso(new Date()))` (`:326`/`:348` y `:410`/`:427`), y
// ese formateador **trunca al segundo** (`:66-75`): los milisegundos guardados son SIEMPRE 0.
//
//   >>> Dos registros del mismo segundo son INDISTINGUIBLES para ese desempate. <<<
//
// Consecuencia: si una anulación se sella en el mismo segundo que su alta, el siguiente registro
// encadena al ALTA y la huella de la anulación queda huérfana — **la cadena se bifurca**.
//
// ── 🔴 Y LA PREGUNTA DEL TICKET ESTÁ MAL PLANTEADA, MEDIDO ─────────────────────────────────
//
// El ticket deduce que en staging «no empata» **por la latencia**. La latencia no es la variable:
// el empate no depende de cuánto tarde, sino de si los dos instantes caen **en el mismo segundo
// de reloj**. Dos sellos separados por 1 ms en un cambio de segundo NO empatan; dos separados por
// 900 ms dentro del mismo segundo SÍ. Lo que la latencia mueve es la PROBABILIDAD, no el hecho —
// y eso se mide aquí abajo, no se deduce.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFechaHoraHuso, applyVeriFactuAnulacion,
} from '../dist/modules/invoicing/domain/verifactu.service.js';

const NIF = '89890001K';
const MERCHANT = 1;

/** El sello tal y como se PERSISTE: por el formateador real, no reconstruido a mano. */
function selloPersistido(d) {
  return new Date(formatFechaHoraHuso(d));
}

/**
 * Un `prismaClient` de mentira que entiende EXACTAMENTE las dos consultas de
 * `ultimaHuellaDeLaCadena` y nada más.
 *
 * 🔴 LO QUE NO ENTIENDE, REVIENTA. Es deliberado: un doble que ignora en silencio un filtro que
 * no sabe interpretar contesta otra pregunta y el banco mide algo que no es. Mejor que se caiga
 * ruidosamente el día que la consulta real cambie.
 */
function bancoDeCadena(filas) {
  const tabla = filas.map((f) => ({ ...f }));

  const findFirst = async ({ where, orderBy, select }) => {
    const claves = Object.keys(where).sort().join(',');
    let filtradas;
    if (claves === 'id,merchantId,vfHash' || claves === 'merchantId,vfHash') {
      assert.equal(JSON.stringify(orderBy), JSON.stringify({ id: 'desc' }),
        '🔴 el banco no entiende este orden para el lado de las ALTAS.');
      filtradas = tabla
        .filter((r) => r.merchantId === where.merchantId && r.vfHash != null)
        .filter((r) => (where.id?.not != null ? r.id !== where.id.not : true))
        .sort((a, b) => b.id - a.id);
    } else if (claves === 'merchantId,vfAnulHash') {
      assert.equal(JSON.stringify(orderBy), JSON.stringify({ vfAnulTimestamp: 'desc' }),
        '🔴 el banco no entiende este orden para el lado de las ANULACIONES.');
      filtradas = tabla
        .filter((r) => r.merchantId === where.merchantId && r.vfAnulHash != null)
        .sort((a, b) => new Date(b.vfAnulTimestamp) - new Date(a.vfAnulTimestamp));
    } else {
      throw new Error(`🔴 BANCO CIEGO: consulta no prevista (${claves}). El doble no puede `
        + 'contestar lo que no entiende: se cae en vez de inventar una fila.');
    }
    const fila = filtradas[0];
    if (!fila) return null;
    return Object.fromEntries(Object.keys(select).map((k) => [k, fila[k] ?? null]));
  };

  const tx = {
    $executeRaw: async () => 0,          // el advisory lock: aquí no hay concurrencia que serializar
    invoice: {
      findFirst,
      update: async ({ where, data }) => {
        const fila = tabla.find((r) => r.id === where.id);
        if (!fila) throw new Error('🔴 el banco no tiene la fila que se actualiza.');
        Object.assign(fila, data);
        return fila;
      },
    },
  };
  return { cliente: { $transaction: async (fn) => fn(tx), ...tx }, tabla };
}

/** Una cadena con un ALTA y una ANULACIÓN sellados con la separación que se pida. */
function cadenaCon(separacionMs, base = new Date('2026-09-17T12:00:00.400+01:00')) {
  const tAlta = base;
  const tAnul = new Date(base.getTime() + separacionMs);
  return bancoDeCadena([
    {
      id: 1, merchantId: MERCHANT, number: 'F-0001', createdAt: tAlta,
      vfHash: 'A'.repeat(64), vfTimestamp: selloPersistido(tAlta),
      vfAnulHash: null, vfAnulTimestamp: null,
    },
    {
      id: 2, merchantId: MERCHANT, number: 'F-0002', createdAt: tAnul,
      vfHash: null, vfTimestamp: null,
      vfAnulHash: 'B'.repeat(64), vfAnulTimestamp: selloPersistido(tAnul),
    },
    // La factura que va a encadenar detrás: es la que revela a cuál de los dos se enganchó.
    {
      id: 3, merchantId: MERCHANT, number: 'F-0003', createdAt: new Date(tAnul.getTime() + 5000),
      vfHash: null, vfTimestamp: null, vfAnulHash: null, vfAnulTimestamp: null,
    },
  ]);
}

const HUELLA_DEL_ALTA = 'A'.repeat(64);
const HUELLA_DE_LA_ANULACION = 'B'.repeat(64);

// ═══ 🔴 CONTROL POSITIVO OBLIGATORIO: el banco SABE producir un empate ═══════════════════════

test('SCRUM-880 · 🔴 CONTROL POSITIVO: el banco SABE producir dos sellos en el MISMO segundo', () => {
  const base = new Date('2026-09-17T12:00:00.400+01:00');
  const a = selloPersistido(base);
  const b = selloPersistido(new Date(base.getTime() + 300));

  assert.equal(a.getTime(), b.getTime(),
    '🔴 EL BANCO NO SABE PRODUCIR UN EMPATE. Dos instantes separados por 300 ms dentro del mismo '
    + 'segundo tendrían que guardarse con el MISMO sello, porque `formatFechaHoraHuso` trunca al '
    + 'segundo. Si no empatan, todo lo que este fichero mida después es el suelo del experimento '
    + 'y no un resultado: un «no ocurre» que sólo dice que no supe provocarlo.');
  assert.equal(a.getMilliseconds(), 0,
    '🔴 el sello persistido conserva milisegundos: la premisa del ticket ha dejado de ser cierta '
    + 'y hay que rehacer esta medición entera.');
});

// ═══ 🔴 EL DEFECTO, EJERCITANDO EL CAMINO REAL ══════════════════════════════════════════════

test('SCRUM-880 · 🔴 EL EMPATE BIFURCA: con alta y anulación en el mismo segundo, se encadena al ALTA', async () => {
  const { cliente, tabla } = cadenaCon(300);

  // Primero: que el empate exista de verdad en los datos del banco, no sólo en la intención.
  assert.equal(tabla[0].vfTimestamp.getTime(), tabla[1].vfAnulTimestamp.getTime(),
    '🔴 los dos sellos NO empatan en este banco: el caso no está montado y el resultado no vale.');

  const { vfPrevHash } = await applyVeriFactuAnulacion(
    { id: 3, number: 'F-0003', createdAt: tabla[2].createdAt, merchantId: MERCHANT }, NIF, cliente,
  );

  assert.equal(vfPrevHash, HUELLA_DEL_ALTA,
    '🔴 la premisa del ticket ha dejado de ser cierta: con el empate, el siguiente registro YA NO '
    + 'encadena al alta. Si se arregló por otra vía, este control sobra y hay que rehacerlo — no '
    + 'relajarlo.');
  assert.notEqual(vfPrevHash, HUELLA_DE_LA_ANULACION,
    '🔴 (imposible: el mismo valor no puede ser los dos)');
});

test('SCRUM-880 · ✅ CONTROL NEGATIVO: en segundos distintos encadena a la ANULACIÓN, que es lo correcto', async () => {
  const { cliente, tabla } = cadenaCon(1000);
  assert.notEqual(tabla[0].vfTimestamp.getTime(), tabla[1].vfAnulTimestamp.getTime(),
    '🔴 con 1000 ms de separación los sellos siguen empatando: el control negativo no lo es.');

  const { vfPrevHash } = await applyVeriFactuAnulacion(
    { id: 3, number: 'F-0003', createdAt: tabla[2].createdAt, merchantId: MERCHANT }, NIF, cliente,
  );
  assert.equal(vfPrevHash, HUELLA_DE_LA_ANULACION,
    '🔴 con los sellos separados tampoco encadena a la anulación: entonces el defecto no es el '
    + 'empate y esta medición señala al sitio equivocado.');
});

// ═══ 🔴 CON QUÉ SEPARACIÓN DEJA DE OCURRIR — medido, no deducido de la latencia ══════════════

test('SCRUM-880 · 🔴 no es la LATENCIA: es el cambio de segundo, y se mide', (t) => {
  // Se recorre el segundo entero: para cada milisegundo de inicio dentro del segundo y cada
  // separación, ¿empatan los sellos persistidos? La respuesta no depende del tiempo transcurrido
  // sino de si se cruza la frontera del segundo.
  const SEPARACIONES = [0, 1, 50, 100, 250, 500, 750, 900, 999, 1000, 1500];
  const filas = [];
  for (const sep of SEPARACIONES) {
    let empates = 0;
    for (let ms = 0; ms < 1000; ms += 1) {
      const base = new Date(Date.UTC(2026, 8, 17, 10, 0, 0, ms));
      if (selloPersistido(base).getTime() === selloPersistido(new Date(base.getTime() + sep)).getTime()) empates += 1;
    }
    filas.push({ sep, empates, pct: (empates / 10).toFixed(1) });
  }
  for (const f of filas) t.diagnostic(`  separación ${String(f.sep).padStart(4)} ms → empata en ${String(f.empates).padStart(4)}/1000 arranques (${f.pct} %)`);

  const a0 = filas.find((f) => f.sep === 0);
  assert.equal(a0.empates, 1000,
    '🔴 con separación CERO no empata siempre: el truncado al segundo ha dejado de ser tal.');

  const mil = filas.find((f) => f.sep === 1000);
  assert.equal(mil.empates, 0,
    `🔴 con 1000 ms de separación todavía empata en ${mil.empates} de 1000 arranques. El umbral `
    + 'medido deja de ser un segundo exacto y la propuesta de arreglo tendría que revisarse.');

  // 🔴 LO QUE DESMONTA EL «SE DEDUCE DE LA LATENCIA»: con 999 ms —casi un segundo entero— todavía
  // empata en una parte de los arranques. Una latencia alta NO es una garantía.
  const casi = filas.find((f) => f.sep === 999);
  assert.ok(casi.empates > 0,
    '🔴 con 999 ms ya no empata nunca: entonces sí bastaría con mirar la latencia, y la premisa '
    + 'de esta medición sería falsa.');
  t.diagnostic(`  🔴 con 999 ms de separación todavía empata en ${casi.empates}/1000 arranques `
    + '(sólo salvan los que cruzan la frontera del segundo)');
});
