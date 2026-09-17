// tests/scrum880-el-empate-del-sello.test.mjs — SCRUM-880 (fases a y c)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA CADENA SE BIFURCABA CUANDO UN ALTA Y SU ANULACIÓN CAÍAN EN EL MISMO SEGUNDO.
//
// El defecto tenía dos mitades y el GO del fundador arregló las dos:
//
//   **A · el criterio.** `ultimaHuellaDeLaCadena` desempataba con `>` ESTRICTO, así que en un
//     empate ganaba el ALTA, el registro siguiente encadenaba a ella y la huella de la anulación
//     quedaba huérfana. Ahora es `>=`: una anulación es SIEMPRE posterior a su alta.
//
//   **B · lo que se guarda.** Los dos sellos se persistían como `new Date(formatFechaHoraHuso(…))`
//     —la cadena ya truncada al segundo, re-parseada—, así que los milisegundos guardados eran
//     siempre 0 y dos registros del mismo segundo eran indistinguibles. Ahora se guarda el
//     instante entero; la huella sigue hasheando el truncado que exige la AEAT.
//
// ── 🔴 A Y B SE PRUEBAN POR SEPARADO ───────────────────────────────────────────────────────
//
// Son dos arreglos, y un test que sólo pasara con los dos puestos no diría cuál hace el trabajo.
//   · **A** se prueba con sellos EMPATADOS puestos a mano en el banco — como los tiene cualquier
//     registro sellado antes de B. No depende de B en absoluto.
//   · **B** se prueba capturando lo que el camino real ESCRIBE, sin mirar el desempate.
//
// ⛔ NO se toca el `sort` de la construcción del XML: SCRUM-880 midió que está tapiado porque su
// único consumidor (`anulacionPrev`) busca POR HUELLA desde SCRUM-145d. Dos comparaciones con la
// misma debilidad, una sola puerta abierta — y esa puerta es la que se ha cerrado aquí.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFechaHoraHuso, applyVeriFactuAnulacion, computeVeriFactuHashAnulacion,
} from '../dist/modules/invoicing/domain/verifactu.service.js';

const NIF = '89890001K';
const MERCHANT = 1;
const HUELLA_DEL_ALTA = 'A'.repeat(64);
const HUELLA_DE_LA_ANULACION = 'B'.repeat(64);

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Devolver el `>` estricto: el empate volvería a ganarlo el alta y la cadena a bifurcarse.
    fichero: 'src/modules/invoicing/domain/verifactu.service.ts',
    de: '  return tAnul >= tAlta ? ultimaAnul.vfAnulHash : ultimaAlta.vfHash;',
    a: '  return tAnul > tAlta ? ultimaAnul.vfAnulHash : ultimaAlta.vfHash;',
    cae: 'SCRUM-880c · 🔴 A · EL QUE DECIDE: con el empate, la cadena YA NO se bifurca',
  },
  {
    // Volver a guardar el sello truncado: los milisegundos desaparecerían otra vez.
    fichero: 'src/modules/invoicing/domain/verifactu.service.ts',
    de: '      data: { vfAnulHash, vfAnulPrevHash: prevHash, vfAnulTimestamp: ahora },',
    a: '      data: { vfAnulHash, vfAnulPrevHash: prevHash, vfAnulTimestamp: new Date(timestamp) },',
    cae: 'SCRUM-880c · 🔴 B · el sello que se ESCRIBE conserva los milisegundos',
  },
];

/** El sello tal y como se persistía ANTES de B: por el formateador real, no reconstruido a mano. */
function selloTruncado(d) {
  return new Date(formatFechaHoraHuso(d));
}

/**
 * Un `prismaClient` de mentira que entiende EXACTAMENTE las dos consultas de
 * `ultimaHuellaDeLaCadena` y nada más. Lo que no entiende, revienta: un doble que ignora en
 * silencio un filtro contesta otra pregunta y el banco mide algo que no es.
 */
function bancoDeCadena(filas) {
  const tabla = filas.map((f) => ({ ...f }));
  const escrituras = [];

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
    $executeRaw: async () => 0,
    invoice: {
      findFirst,
      update: async ({ where, data }) => {
        const fila = tabla.find((r) => r.id === where.id);
        if (!fila) throw new Error('🔴 el banco no tiene la fila que se actualiza.');
        escrituras.push({ id: where.id, ...data });
        Object.assign(fila, data);
        return fila;
      },
    },
  };
  return { cliente: { $transaction: async (fn) => fn(tx), ...tx }, tabla, escrituras };
}

/**
 * Una cadena con un ALTA y una ANULACIÓN cuyos sellos guardados llevan la separación que se pida,
 * **truncados al segundo** — o sea, exactamente como los tiene cualquier registro sellado antes
 * de B. Es el banco con el que se prueba A sin depender de B.
 */
function cadenaConSellosViejos(separacionMs, base = new Date('2026-09-17T12:00:00.400+01:00')) {
  const tAlta = base;
  const tAnul = new Date(base.getTime() + separacionMs);
  return bancoDeCadena([
    {
      id: 1, merchantId: MERCHANT, number: 'F-0001', createdAt: tAlta,
      vfHash: HUELLA_DEL_ALTA, vfTimestamp: selloTruncado(tAlta),
      vfAnulHash: null, vfAnulTimestamp: null,
    },
    {
      id: 2, merchantId: MERCHANT, number: 'F-0002', createdAt: tAnul,
      vfHash: null, vfTimestamp: null,
      vfAnulHash: HUELLA_DE_LA_ANULACION, vfAnulTimestamp: selloTruncado(tAnul),
    },
    {
      id: 3, merchantId: MERCHANT, number: 'F-0003', createdAt: new Date(tAnul.getTime() + 5000),
      vfHash: null, vfTimestamp: null, vfAnulHash: null, vfAnulTimestamp: null,
    },
  ]);
}

const tercera = (tabla) => ({ id: 3, number: 'F-0003', createdAt: tabla[2].createdAt, merchantId: MERCHANT });

// ═══ A · 🔴 EL QUE DECIDE ═══════════════════════════════════════════════════════════════════

test('SCRUM-880c · 🔴 A · EL QUE DECIDE: con el empate, la cadena YA NO se bifurca', async () => {
  const { cliente, tabla } = cadenaConSellosViejos(300);

  // 🔴 SUELO DEL EXPERIMENTO: el banco tiene que SABER producir el empate. Si no lo produce, todo
  // lo que venga después no prueba que el arreglo funcione — prueba que no supe provocar el caso.
  assert.equal(tabla[0].vfTimestamp.getTime(), tabla[1].vfAnulTimestamp.getTime(),
    '🔴 EL BANCO NO HA PRODUCIDO EL EMPATE y sin empate este control no mide nada. Dos instantes '
    + 'separados 300 ms dentro del mismo segundo tendrían que dar el MISMO sello truncado. Éste '
    + 'sería el suelo del experimento, no una prueba de que el arreglo funciona.');
  assert.equal(tabla[0].vfTimestamp.getMilliseconds(), 0,
    '🔴 los sellos del banco llevan milisegundos: no reproducen los registros de antes de B.');

  const { vfPrevHash } = await applyVeriFactuAnulacion(tercera(tabla), NIF, cliente);

  assert.equal(vfPrevHash, HUELLA_DE_LA_ANULACION,
    '🔴 CON EL EMPATE, LA CADENA SIGUE ENCADENANDO AL ALTA. Una anulación es siempre posterior a '
    + 'su alta, así que en empate debe ganar la anulación: si gana el alta, la huella de la '
    + 'anulación queda huérfana y la cadena se BIFURCA. Se arregla con `>=` en '
    + '`ultimaHuellaDeLaCadena`, no bajando esta exigencia.');
});

test('SCRUM-880c · ✅ A · VERDE REAL: el `>=` no hace ganar SIEMPRE a la anulación', async () => {
  // 🔴 LA RAMA QUE TIENE QUE RESPONDER DISTINTO. Con la anulación sellada ANTES que el alta, el
  // último eslabón es el ALTA y ahí tiene que encadenar. Sin este caso, un `>=` mal escrito como
  // «la anulación gana siempre» pasaría el control de arriba y nadie lo notaría.
  const { cliente, tabla } = cadenaConSellosViejos(-2000);
  assert.ok(tabla[1].vfAnulTimestamp.getTime() < tabla[0].vfTimestamp.getTime(),
    '🔴 la anulación no ha quedado ANTES que el alta: este control no es el contrario del otro.');

  const { vfPrevHash } = await applyVeriFactuAnulacion(tercera(tabla), NIF, cliente);
  assert.equal(vfPrevHash, HUELLA_DEL_ALTA,
    '🔴 con la anulación sellada ANTES, la cadena encadena a la anulación igualmente. Entonces el '
    + 'desempate no compara nada: la anulación gana siempre y el `>=` es un `true` disfrazado.');
});

test('SCRUM-880c · 🔴 A · MUTACIÓN: devolver el `>` estricto reabre la bifurcación, y ENTRA', () => {
  // El ancla se cuenta ANTES de sustituir: una mutación que no entra y un guard que no detecta
  // dan exactamente la misma salida.
  const empatados = [0, 300, 999];
  for (const sep of empatados) {
    const base = new Date('2026-09-17T12:00:00.000+01:00');
    const tAlta = selloTruncado(base).getTime();
    const tAnul = selloTruncado(new Date(base.getTime() + sep)).getTime();
    assert.equal(tAnul, tAlta, `🔴 con ${sep} ms los sellos truncados ya no empatan.`);
    // El criterio viejo y el nuevo, sobre el MISMO empate, tienen que dar respuestas DISTINTAS.
    assert.equal(tAnul > tAlta, false, '🔴 el criterio viejo (`>`) no daría el alta en empate.');
    assert.equal(tAnul >= tAlta, true, '🔴 el criterio nuevo (`>=`) no daría la anulación en empate.');
  }
});

// ═══ B · 🔴 LO QUE SE ESCRIBE ═══════════════════════════════════════════════════════════════

test('SCRUM-880c · 🔴 B · el sello que se ESCRIBE conserva los milisegundos', async () => {
  // Se mira lo que el camino real ESCRIBE, no a quién encadena: esto prueba B sin tocar A.
  const CUANTAS = 50;
  const sellos = [];
  for (let i = 0; i < CUANTAS; i++) {
    const { cliente, tabla, escrituras } = cadenaConSellosViejos(5000);
    await applyVeriFactuAnulacion(tercera(tabla), NIF, cliente);
    const escrito = escrituras.find((e) => e.vfAnulTimestamp);
    assert.ok(escrito, '🔴 el camino no ha escrito ningún `vfAnulTimestamp`: no hay nada que medir.');
    sellos.push(escrito.vfAnulTimestamp);
  }

  const conMilis = sellos.filter((d) => d.getMilliseconds() !== 0).length;
  assert.ok(conMilis > 0,
    `🔴 LOS ${CUANTAS} SELLOS ESCRITOS LLEVAN LOS MILISEGUNDOS A CERO. Eso es lo que hacía el `
    + 'código de antes (`new Date(formatFechaHoraHuso(new Date()))`, la cadena truncada '
    + 're-parseada). Que salgan los 50 a cero por azar tiene probabilidad 1e-150: lo que hay es '
    + 'que el sello se está volviendo a truncar al guardarlo.');
});

test('SCRUM-880c · 🔴 B · y la HUELLA sigue siendo recomputable desde el sello guardado', async () => {
  // 🔴 LA INVARIANTE QUE NO SE PUEDE ROMPER. SCRUM-145 persiste el sello para que un tercero pueda
  // recomputar la huella. Guardar MÁS precisión de la que entró en el hash sólo es legítimo si al
  // truncar vuelve a salir exactamente la misma cadena — y eso se comprueba recomputando la
  // huella de verdad, no razonando sobre ella.
  for (let i = 0; i < 20; i++) {
    const { cliente, tabla, escrituras } = cadenaConSellosViejos(5000);
    const { vfAnulHash, vfPrevHash } = await applyVeriFactuAnulacion(tercera(tabla), NIF, cliente);
    const escrito = escrituras.find((e) => e.vfAnulTimestamp);

    const recomputada = computeVeriFactuHashAnulacion({
      nif: NIF,
      serie: 'F-0003',
      fecha: `${String(tabla[2].createdAt.getDate()).padStart(2, '0')}-`
        + `${String(tabla[2].createdAt.getMonth() + 1).padStart(2, '0')}-${tabla[2].createdAt.getFullYear()}`,
      prevHash: vfPrevHash,
      timestamp: formatFechaHoraHuso(escrito.vfAnulTimestamp),
    });
    assert.equal(recomputada, vfAnulHash,
      '🔴 LA HUELLA YA NO SE PUEDE RECOMPUTAR DESDE EL SELLO GUARDADO. Guardar el instante con '
      + 'milisegundos sólo vale si `formatFechaHoraHuso` del sello persistido devuelve la MISMA '
      + 'cadena que se hasheó. Si no coincide, un tercero no puede verificar el registro y hay '
      + 'que revertir B — no relajar esta comprobación.');
  }
});

// ═══ EL MECANISMO, que sigue siendo cierto sobre la CADENA QUE SE HASHEA ════════════════════

test('SCRUM-880 · 🔴 la huella se sigue truncando al segundo, y por eso `>=` no sobra', (t) => {
  // Esto ya no describe el sello GUARDADO —B se lo llevó— sino la cadena que entra en la huella,
  // que la AEAT exige truncada. Se conserva porque explica por qué A sigue haciendo falta: los
  // registros sellados ANTES de B tienen los milisegundos a cero para siempre.
  const SEPARACIONES = [0, 250, 500, 900, 999, 1000];
  const filas = [];
  for (const sep of SEPARACIONES) {
    let empates = 0;
    for (let ms = 0; ms < 1000; ms += 1) {
      const base = new Date(Date.UTC(2026, 8, 17, 10, 0, 0, ms));
      if (selloTruncado(base).getTime() === selloTruncado(new Date(base.getTime() + sep)).getTime()) empates += 1;
    }
    filas.push({ sep, empates });
  }
  for (const f of filas) t.diagnostic(`  separación ${String(f.sep).padStart(4)} ms → la cadena hasheada empata en ${String(f.empates).padStart(4)}/1000 arranques`);

  assert.equal(filas.find((f) => f.sep === 0).empates, 1000,
    '🔴 con separación CERO la cadena hasheada no empata siempre: el truncado al segundo que exige '
    + 'la AEAT ha dejado de aplicarse, y eso cambiaría TODAS las huellas.');
  assert.equal(filas.find((f) => f.sep === 1000).empates, 0,
    '🔴 con 1000 ms todavía empata: el umbral medido deja de ser un segundo exacto.');
  assert.ok(filas.find((f) => f.sep === 900).empates > 0,
    '🔴 con 900 ms ya no empata nunca: entonces bastaría con mirar la latencia, y la medición que '
    + 'justificó este arreglo sería falsa.');
});
