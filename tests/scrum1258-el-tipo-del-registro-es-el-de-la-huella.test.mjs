// tests/scrum1258-el-tipo-del-registro-es-el-de-la-huella.test.mjs — SCRUM-1258
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL `TipoFactura` QUE UN REGISTRO DECLARA ES EL QUE ENTRÓ EN SU HUELLA. SIEMPRE.
//
// `TipoFactura` es uno de los ocho campos de `computeVeriFactuHash`. Al SELLAR sale de la columna
// `invoice.type` (`exigirTipoDeclarable`); al EXPORTAR, para una factura sin NIF del cliente, lo
// resolvía `resolverSinDestinatario`, que bajo el modo de la simplificada devuelve otro tipo. El
// registro salía entonces declarando un tipo y llevando firmada la huella de otro: quien la
// recalculara con los campos del propio XML obtenía una huella distinta de la que el XML lleva.
//
// Hoy no ha salido ninguno así: la constante del modo vale lo mismo desde que nació y ningún
// llamador de producción pasa el modo. Este test existe para el día en que alguien la cambie.
//
// ── CÓMO MIDE, Y POR QUÉ ASÍ ──────────────────────────────────────────────────────────────
//
//   · SELLA CON EL CAMINO REAL (`applyVeriFactu`), no con una huella puesta a mano: una huella
//     de mentira no puede discrepar de nada, y el defecto es justo una discrepancia.
//   · RECALCULA la huella con los campos QUE EL XML DECLARA, como haría un tercero, y la compara
//     con la que ese mismo XML lleva. No compara el tipo con una lista de tipos permitidos.
//   · LA POBLACIÓN DE MODOS SE LEE DEL FUENTE por AST: un modo nuevo queda cubierto sin tocar
//     este fichero.
//   · SÓLO LEE el camino de emisión. El banco revienta ante cualquier consulta que no conozca y
//     apunta cada escritura: exportar no puede escribir ninguna.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

import {
  applyVeriFactu, buildVerifactuRegistrosXml, computeVeriFactuHash, exigirTipoDeclarable,
} from '../dist/modules/invoicing/domain/verifactu.service.js';
import {
  MODO_SIN_DESTINATARIO, MOTIVO_SELLADA_F1_DECLARADA_F2,
} from '../dist/modules/fiscal/verifactu/registro.builder.js';
import { validarRegistrosXml } from './_xsd-verifactu.mjs';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Quitar la comprobación: la factura sellada como F1 volvería a salir declarada como F2.
    fichero: 'src/modules/invoicing/domain/verifactu.service.ts',
    de: '    if (inv.vfHash && tipoFactura !== tipoBase) {',
    a: '    if (false) {',
    cae: 'SCRUM-1258 · 🔴 EL QUE DECIDE: en NINGÚN modo sale un registro cuyo tipo no sea el de su huella',
  },
  {
    // Sellar con un tipo que no es el de la columna: es justo lo que este ticket no puede tocar.
    fichero: 'src/modules/invoicing/domain/verifactu.service.ts',
    de: '      tipoFactura: exigirTipoDeclarable(invoice.type ?? null, invoice.number),',
    a: "      tipoFactura: 'F2',",
    cae: 'SCRUM-1258 · 🔒 el sellado sigue calculando la huella sobre el tipo de la COLUMNA',
  },
];

const FUENTE_BUILDER = 'src/modules/fiscal/verifactu/registro.builder.ts';
const NIF = 'B12345678';
const MERCHANT = 7;
const merchant = {
  id: MERCHANT, country: 'ES', taxId: NIF, legalName: 'Fontanería QA S.L.', name: 'Fontanería QA', timezone: null,
};

// ── la población de modos, leída del fuente ────────────────────────────────────────────────

/** Los miembros de la unión `ModoSinDestinatario`, por AST: un comentario que la nombre no cuenta. */
function modosDeclarados() {
  const sf = ts.createSourceFile(FUENTE_BUILDER, fs.readFileSync(FUENTE_BUILDER, 'utf8'), ts.ScriptTarget.Latest, true);
  const modos = [];
  sf.forEachChild((nodo) => {
    if (!ts.isTypeAliasDeclaration(nodo) || nodo.name.text !== 'ModoSinDestinatario') return;
    assert.ok(ts.isUnionTypeNode(nodo.type), '🔴 `ModoSinDestinatario` ya no es una unión: este test no sabe leer su población.');
    for (const miembro of nodo.type.types) {
      assert.ok(ts.isLiteralTypeNode(miembro) && ts.isStringLiteral(miembro.literal),
        '🔴 un miembro de `ModoSinDestinatario` no es un literal de texto: población ilegible.');
      modos.push(miembro.literal.text);
    }
  });
  return modos;
}

// ── el banco ──────────────────────────────────────────────────────────────────────────────

const LINEAS = [{ concept: 'Reparación de fuga', qty: 1, price: 100, tax: 0.21 }];

/** Las cuatro facturas del ejercicio: los dos tipos declarables, con y sin NIF del cliente. */
function facturasSinSellar() {
  const f1ConNif = {
    id: 1, merchantId: MERCHANT, number: '2026-CF-001', type: 'F1', total: '121.00', lines: LINEAS,
    createdAt: new Date('2026-03-15T10:00:00Z'), customerName: 'Comunidad de Vecinos', customerTaxId: 'B99999999',
  };
  const f1SinNif = {
    id: 2, merchantId: MERCHANT, number: '2026-CF-002', type: 'F1', total: '121.00', lines: LINEAS,
    createdAt: new Date('2026-03-16T10:00:00Z'), customerName: 'María García', customerTaxId: null,
  };
  const rectificada = { number: f1ConNif.number, createdAt: f1ConNif.createdAt, lines: LINEAS };
  const r1ConNif = {
    id: 3, merchantId: MERCHANT, number: '2026-CF-R-001', type: 'R1', total: '12.10',
    lines: [{ concept: 'Suplemento', qty: 1, price: 10, tax: 0.21 }],
    createdAt: new Date('2026-03-17T10:00:00Z'), customerName: 'Comunidad de Vecinos', customerTaxId: 'B99999999',
    rectifies: rectificada,
  };
  const r1SinNif = {
    id: 4, merchantId: MERCHANT, number: '2026-CF-R-002', type: 'R1', total: '12.10',
    lines: [{ concept: 'Suplemento', qty: 1, price: 10, tax: 0.21 }],
    createdAt: new Date('2026-03-18T10:00:00Z'), customerName: 'María García', customerTaxId: null,
    rectifies: rectificada,
  };
  return [f1ConNif, f1SinNif, r1ConNif, r1SinNif].map((f) => ({
    customer: null, rectifies: null, vfHash: null, vfPrevHash: null, vfTimestamp: null,
    vfAnulHash: null, vfAnulPrevHash: null, vfAnulTimestamp: null, ...f,
  }));
}

/**
 * Un cliente de mentira que entiende EXACTAMENTE las consultas del sellado y de la exportación.
 * Lo que no entiende, revienta: un doble que ignora un filtro en silencio contesta otra pregunta.
 */
function banco(filas) {
  const tabla = filas;
  const escrituras = [];
  const claves = (o) => Object.keys(o || {}).sort().join(',');

  const invoice = {
    findUnique: async ({ where, select }) => {
      assert.equal(claves(where), 'id');
      const fila = tabla.find((r) => r.id === where.id);
      // SCRUM-1330: el sellado pregunta además, dentro del cerrojo, si la fila ya tiene huella. Es
      // una consulta NUEVA del sellado y este doble tiene que conocerla; cualquier otra sigue reventando.
      if (claves(select) === 'qrData,vfHash,vfPrevHash') {
        return fila ? { vfHash: fila.vfHash, vfPrevHash: fila.vfPrevHash, qrData: fila.qrData ?? null } : null;
      }
      assert.equal(claves(select), 'lines');
      return fila ? { lines: fila.lines } : null;
    },
    findFirst: async ({ where }) => {
      const c = claves(where);
      if (c === 'id,merchantId,vfHash' || c === 'merchantId,vfHash') {
        return tabla
          .filter((r) => r.merchantId === where.merchantId && r.vfHash != null)
          .filter((r) => (where.id?.not != null ? r.id !== where.id.not : true))
          .sort((a, b) => b.id - a.id)[0] ?? null;
      }
      if (c === 'merchantId,vfAnulHash') {
        return tabla.filter((r) => r.merchantId === where.merchantId && r.vfAnulHash != null)[0] ?? null;
      }
      throw new Error(`banco: findFirst con un where que no conozco (${c})`);
    },
    findMany: async ({ where }) => {
      const c = claves(where);
      if (c === 'createdAt,merchantId') {
        return tabla
          .filter((r) => r.merchantId === where.merchantId)
          .filter((r) => r.createdAt >= where.createdAt.gte && r.createdAt <= where.createdAt.lte)
          .sort((a, b) => a.createdAt - b.createdAt);
      }
      if (c === 'merchantId,vfHash') {
        return tabla.filter((r) => r.merchantId === where.merchantId && r.vfHash != null);
      }
      throw new Error(`banco: findMany con un where que no conozco (${c})`);
    },
    update: async ({ where, data }) => {
      escrituras.push({ id: where.id, campos: Object.keys(data).sort() });
      Object.assign(tabla.find((r) => r.id === where.id), data);
    },
  };
  const cliente = {
    merchant: { findUnique: async () => merchant },
    invoice,
    $executeRaw: async () => 0,
    $transaction: async (fn) => fn(cliente),
  };
  return { cliente, tabla, escrituras };
}

/** Sella las cuatro por el camino real, en orden: una cadena de cuatro eslabones. */
async function ejercicioSellado() {
  const b = banco(facturasSinSellar());
  for (const fila of b.tabla) await applyVeriFactu(fila, NIF, b.cliente);
  return b;
}

/** La cadena tal como quedó persistida, en un texto que se compara byte a byte. */
const cadenaPersistida = (tabla) => JSON.stringify(
  tabla.map((r) => [r.id, r.vfHash, r.vfPrevHash, r.vfTimestamp?.toISOString() ?? null]),
);

// ── el lector del XML: lo que haría un tercero ────────────────────────────────────────────

function campo(xml, nombre) {
  const m = xml.match(new RegExp('<sum1:' + nombre + '>([^<]*)</sum1:' + nombre + '>'));
  return m ? m[1] : null;
}

/** Cada `RegistroAlta` del documento, con sus campos y la huella RECALCULADA desde ellos. */
function altasDe(xml) {
  return xml.split('<sum1:RegistroAlta>').slice(1).map((trozo) => {
    const alta = trozo.split('</sum1:RegistroAlta>')[0];
    const anterior = alta.includes('<sum1:RegistroAnterior>')
      ? alta.split('<sum1:RegistroAnterior>')[1].split('</sum1:RegistroAnterior>')[0]
      : null;
    const huellas = [...alta.matchAll(/<sum1:Huella>([^<]*)<\/sum1:Huella>/g)].map((m) => m[1]);
    const declarado = {
      numero: campo(alta, 'NumSerieFactura'),
      tipo: campo(alta, 'TipoFactura'),
      huella: huellas[huellas.length - 1] ?? null,
      huellaAnterior: anterior ? campo(anterior, 'Huella') : '',
    };
    const recalculada = computeVeriFactuHash({
      nif: campo(alta, 'IDEmisorFactura'),
      serie: declarado.numero,
      fecha: campo(alta, 'FechaExpedicionFactura'),
      tipoFactura: declarado.tipo,
      cuotaTotal: campo(alta, 'CuotaTotal'),
      importeTotal: campo(alta, 'ImporteTotal'),
      prevHash: declarado.huellaAnterior,
      timestamp: campo(alta, 'FechaHoraHusoGenRegistro'),
    });
    return { ...declarado, recalculada, coherente: recalculada === declarado.huella };
  });
}

const exportar = (b, modo) => buildVerifactuRegistrosXml(
  { merchantId: MERCHANT, year: 2026 }, b.cliente, modo === undefined ? {} : { modoSinDestinatario: modo },
);

// ── 0 · EL INSTRUMENTO VE ─────────────────────────────────────────────────────────────────

test('SCRUM-1258 · SUELO: la población de modos se lee del fuente y contiene el que rige hoy', () => {
  const modos = modosDeclarados();
  assert.ok(modos.length >= 2, `🔴 sólo se han leído ${modos.length} modos: el lector de la unión no ve.`);
  assert.ok(modos.includes(MODO_SIN_DESTINATARIO),
    `🔴 el modo que rige (${MODO_SIN_DESTINATARIO}) no está entre los leídos (${modos.join(', ')}).`);
});

test('SCRUM-1258 · SUELO: el recálculo VE un tipo cambiado a mano en un registro coherente', async () => {
  const b = await ejercicioSellado();
  const { xml } = await exportar(b, undefined);
  const sanas = altasDe(xml);
  assert.ok(sanas.length >= 1, '🔴 la exportación de control no trae ningún registro: no hay nada que envenenar.');
  assert.ok(sanas.every((a) => a.huella && a.huella.length === 64), '🔴 el lector no encuentra la huella del registro.');
  assert.ok(sanas.every((a) => a.coherente), '🔴 un registro recién sellado y exportado no recalcula su propia huella.');

  const envenenado = xml.replace('<sum1:TipoFactura>F1</sum1:TipoFactura>', '<sum1:TipoFactura>F2</sum1:TipoFactura>');
  assert.notEqual(envenenado, xml, '🔴 el veneno no entró: no había ningún `TipoFactura` F1 que cambiar.');
  assert.equal(altasDe(envenenado).filter((a) => !a.coherente).length, 1,
    '🔴 el instrumento no ve un `TipoFactura` distinto del que entró en la huella.');
});

// ── 1 · EL QUE DECIDE ─────────────────────────────────────────────────────────────────────

test('SCRUM-1258 · 🔴 EL QUE DECIDE: en NINGÚN modo sale un registro cuyo tipo no sea el de su huella', async () => {
  const modos = modosDeclarados();
  const incoherentes = [];
  let emitidos = 0;
  let excluidosTotal = 0;

  for (const modo of modos) {
    const b = await ejercicioSellado();
    const { xml, count, excluidos } = await exportar(b, modo);
    const altas = xml ? altasDe(xml) : [];
    assert.equal(altas.length, count, `🔴 [${modo}] el lector ve ${altas.length} altas y la exportación dice ${count}.`);
    assert.equal(count + excluidos.length, b.tabla.length,
      `🔴 [${modo}] entre declaradas y excluidas no suman las ${b.tabla.length} facturas del ejercicio.`);
    emitidos += count;
    excluidosTotal += excluidos.length;

    for (const alta of altas) {
      const fila = b.tabla.find((r) => r.number === alta.numero);
      const tipoSellado = exigirTipoDeclarable(fila.type, fila.number);
      if (!alta.coherente || alta.tipo !== tipoSellado || alta.huella !== fila.vfHash) {
        incoherentes.push(`[${modo}] ${alta.numero}: sellada como ${tipoSellado}, el registro declara ${alta.tipo}`
          + ` · lleva la huella sellada: ${alta.huella === fila.vfHash} · recalculada desde el XML == la que lleva: ${alta.coherente}`);
      }
    }
  }

  assert.ok(emitidos >= modos.length,
    `🔴 sólo ${emitidos} registros declarados entre ${modos.length} modos: el veredicto sería sobre el vacío.`);
  assert.deepEqual(incoherentes, [],
    `🔴 ${incoherentes.length} registro(s) declaran un tipo que no es el de su huella `
    + `(población: ${modos.length} modos · ${emitidos} declarados · ${excluidosTotal} excluidos):\n  ${incoherentes.join('\n  ')}`);
});

test('SCRUM-1258 · una factura sellada cuyo tipo cambiaría al exportar queda FUERA, y se dice', async () => {
  // El caso se BUSCA, no se nombra: cualquier modo bajo el que alguna factura sellada no salga
  // declarada tiene que haberla dejado en el parte de exclusiones con un motivo.
  for (const modo of modosDeclarados()) {
    const b = await ejercicioSellado();
    const { xml, excluidos } = await exportar(b, modo);
    const declaradas = new Set((xml ? altasDe(xml) : []).map((a) => a.numero));
    for (const fila of b.tabla) {
      if (declaradas.has(fila.number)) continue;
      const parte = excluidos.find((x) => x.number === fila.number);
      assert.ok(parte, `🔴 [${modo}] ${fila.number} no sale declarada ni excluida: se ha omitido en silencio.`);
      assert.ok(String(parte.motivo || '').trim().length > 20, `🔴 [${modo}] ${fila.number} se excluye sin motivo legible.`);
    }
  }
});

test('SCRUM-1258 · la que se excluye por el tipo lo dice con el texto FIRMADO, y sólo ella', async () => {
  // Se busca por lo que el resolvedor devuelve, no por el nombre de un modo: todo modo que a una F1
  // sin NIF le cambie el tipo tiene que acabar en esta exclusión, con este motivo.
  const { resolverSinDestinatario } = await import('../dist/modules/fiscal/verifactu/registro.builder.js');
  const modosQueCambianElTipo = modosDeclarados().filter((modo) => {
    try { return resolverSinDestinatario('F1', 'x', modo).tipoFactura !== 'F1'; } catch { return false; }
  });
  assert.ok(modosQueCambianElTipo.length >= 1,
    '🔴 ningún modo cambia ya el tipo de una F1 sin NIF: este caso se ha quedado sin población. '
    + 'Si la rama se ha retirado, este test se retira con ella, diciéndolo.');

  for (const modo of modosQueCambianElTipo) {
    const b = await ejercicioSellado();
    const { xml, excluidos } = await exportar(b, modo);
    const conEseMotivo = excluidos.filter((x) => x.motivo === MOTIVO_SELLADA_F1_DECLARADA_F2).map((x) => x.number);
    assert.deepEqual(conEseMotivo, ['2026-CF-002'],
      `🔴 [${modo}] con el motivo firmado sólo debe quedar fuera la F1 sellada sin NIF.`);
    assert.ok(xml.includes(MOTIVO_SELLADA_F1_DECLARADA_F2.slice(0, 40)),
      `🔴 [${modo}] la exclusión no viaja dentro del propio documento.`);
  }

  const ficha = aprobacionesDeMicrocopy().find((a) => a.ticket === 'SCRUM-1258' && a.ranura === 'tipo-distinto-del-sellado');
  assert.ok(ficha, '🔴 no encuentro la ficha de la firma de este texto en docs/microcopy/.');
  assert.equal(ficha.aprobada, true, '🔴 la ficha existe pero su firma no cuenta como aprobación.');
  // La ficha lleva el texto en dos líneas, una por frase; se pinta seguido, con un espacio.
  assert.equal(ficha.literales.length, 2, '🔴 la ficha ya no lleva las dos frases del texto, una por línea.');
  assert.equal(MOTIVO_SELLADA_F1_DECLARADA_F2, ficha.literales.join(' '),
    '🔴 el motivo que emite el código no es, letra a letra, el que consta firmado en su ficha.');
});

// ── 2 · EL CONTROL POSITIVO ───────────────────────────────────────────────────────────────

test('SCRUM-1258 · ✅ con NIF, la F1 y su R1 se declaran igual que antes, encadenadas y válidas', async () => {
  const b = await ejercicioSellado();
  const { xml, count, excluidos } = await exportar(b, undefined);
  const altas = altasDe(xml);
  const porNumero = new Map(altas.map((a) => [a.numero, a]));

  const f1 = porNumero.get('2026-CF-001');
  const r1 = porNumero.get('2026-CF-R-001');
  assert.ok(f1 && r1, `🔴 faltan del registro la F1 o la R1 con NIF (declaradas: ${[...porNumero.keys()].join(', ')}).`);
  assert.equal(f1.tipo, 'F1');
  assert.equal(r1.tipo, 'R1');
  assert.equal(count, 2, 'con el modo de hoy se declaran las dos que tienen NIF');
  assert.equal(excluidos.length, 2, 'y las dos sin NIF quedan fuera, con su motivo');

  // La cadena: cada registro lleva SU huella sellada y apunta a la del eslabón anterior persistido.
  for (const alta of altas) {
    const fila = b.tabla.find((r) => r.number === alta.numero);
    assert.equal(alta.huella, fila.vfHash, `🔴 ${alta.numero} no lleva la huella con la que se selló.`);
    assert.equal(alta.huellaAnterior, fila.vfPrevHash, `🔴 ${alta.numero} no apunta al eslabón anterior persistido.`);
    assert.ok(alta.coherente, `🔴 ${alta.numero} no recalcula su huella desde sus propios campos.`);
  }
  assert.equal(f1.huellaAnterior, '', 'la primera del emisor es el primer registro de la cadena');

  const { valido, errores } = await validarRegistrosXml(xml, 'scrum1258-positivo.xml');
  assert.equal(valido, true, `🔴 el caso bueno dejó de validar contra el XSD:\n${errores.join('\n')}`);
});

// ── 3 · EL CONTROL QUE NO SE PUEDE SALTAR ─────────────────────────────────────────────────

test('SCRUM-1258 · 🔒 exportar NO escribe: la cadena persistida es byte a byte la misma en todos los modos', async () => {
  const modos = modosDeclarados();
  for (const modo of [undefined, ...modos]) {
    const b = await ejercicioSellado();
    assert.equal(b.escrituras.length, b.tabla.length, 'el sellado escribe una vez por factura: el banco apunta escrituras');
    const antes = cadenaPersistida(b.tabla);
    assert.equal(b.tabla.filter((r) => r.vfHash && r.vfHash.length === 64).length, b.tabla.length,
      '🔴 la cadena de partida no está sellada entera: la comparación sería sobre el vacío.');

    await exportar(b, modo);
    await exportar(b, modo);

    assert.equal(b.escrituras.length, b.tabla.length, `🔴 [${modo ?? 'por defecto'}] exportar ha ESCRITO en la factura.`);
    assert.equal(cadenaPersistida(b.tabla), antes, `🔴 [${modo ?? 'por defecto'}] la cadena persistida cambió al exportar.`);
  }
});

test('SCRUM-1258 · 🔒 el sellado sigue calculando la huella sobre el tipo de la COLUMNA', async () => {
  // Lo que este ticket NO toca: `applyVeriFactu`. Cada huella persistida es la de sus campos con
  // el tipo de `invoice.type`, encadenada a la anterior.
  const b = await ejercicioSellado();
  const { formatDateES, formatFechaHoraHuso } = await import('../dist/modules/invoicing/domain/verifactu.service.js');
  let anterior = '';
  for (const fila of b.tabla) {
    const { calcVatCuotaTotal } = await import('../dist/modules/invoicing/domain/vat.service.js');
    const esperada = computeVeriFactuHash({
      nif: NIF, serie: fila.number, fecha: formatDateES(fila.createdAt, 'UTC'), tipoFactura: fila.type,
      cuotaTotal: calcVatCuotaTotal(fila.lines).toFixed(2), importeTotal: Number(fila.total).toFixed(2),
      prevHash: anterior, timestamp: formatFechaHoraHuso(fila.vfTimestamp, 'UTC'),
    });
    assert.equal(fila.vfHash, esperada, `🔴 la huella de ${fila.number} ya no es la de sus campos con el tipo ${fila.type}.`);
    assert.equal(fila.vfPrevHash, anterior, `🔴 ${fila.number} no encadena a la huella anterior.`);
    anterior = fila.vfHash;
  }
});
