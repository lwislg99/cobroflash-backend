// SCRUM-297 / SCRUM-300 (C5) · LO QUE EL `select` DEVUELVE TIENE QUE VERIFICAR.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL HUECO QUE TAPA, y era un hueco entre dos guards que ya existían
//
// Había cobertura a los dos lados y nada en medio:
//
//   · `scrum369-verificador-sello` prueba el SELLADOR y el VERIFICADOR con vectores congelados.
//     No sabe nada de qué columnas trae la consulta.
//   · `scrum297-fuentes-selladas` compara POR AST el `select` del paquete contra lo que el
//     adaptador lee. Es estático: nunca ejecuta una verificación.
//
// Entre los dos cabía exactamente el defecto de C5: **una fila a la que le faltan columnas se
// verifica igual de bien que una completa** — porque `entradaDesdeFilas` resuelve lo ausente a
// `null`, y `null` es un valor legítimo para esas cuatro. El AST decía «faltan columnas» y el
// verificador decía «no cuadra», pero ninguno de los dos decía **por qué el segundo pasaba**.
//
// Aquí se ejecuta el camino entero con filas con la forma EXACTA que devuelve cada `select`:
// se sella de verdad, se pasa por el adaptador de verdad y se verifica de verdad.
//
// ⚠️ ESTE FICHERO NO TOCA NADA DEL SELLADO. Sella con `computeAlbaranContentHash` tal cual, no
// fija ningún hash a mano y no conoce la receta: solo compara «la fila completa» contra «la fila
// recortada». Leer no es sellar (regla 38).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { computeAlbaranContentHash } from '../dist/modules/jobs/domain/albaran.service.js';
import { entradaDesdeFilas } from '../dist/modules/jobs/domain/albaranBarrido.js';
import { verificarSobre } from '../dist/modules/jobs/domain/albaranVerificacion.js';

/** Las CUATRO que estrena C5 y que el sobre v:2 sella. */
const LAS_CUATRO = ['lugarEntrega', 'fechaEntrega', 'firmadoPorNombre', 'firmadoPorCalidad'];

const JOB = { id: 7, titulo: 'Reforma baño', direccion: 'C/ Mayor 3', merchantId: 1, customerId: 70 };
const CLIENTE = { id: 70, name: 'Ana Ruiz', legalName: null };
const EMISOR = { name: 'Fontanería Paco', legalName: 'Paco SL', taxId: 'B12345678' };

/** El albarán tal y como está en la BASE: con las cuatro columnas pobladas. */
function albaranEnLaBase() {
  return {
    id: 11, merchantId: 1, jobId: 7,
    numero: 'ALB-2026-011',
    fecha: '2026-08-01T00:00:00.000Z',
    modoValoracion: 'con_precios',
    lineas: [{ concepto: 'Mano de obra', cantidad: 2, unidad: 'h', precio: 30 }],
    notas: 'Sin incidencias',
    lugarEntrega: 'Polígono Norte, nave 4',
    fechaEntrega: '2026-08-02T00:00:00.000Z',
    firmadoPorNombre: 'Marta Gil',
    firmadoPorCalidad: 'encargada',
  };
}

/** Los params del sellador para ese albarán, en la versión que se le pida. */
function paramsDelSellador(a) {
  return {
    numero: a.numero,
    fecha: a.fecha,
    modoValoracion: a.modoValoracion,
    lineas: a.lineas,
    notas: a.notas,
    obra: a.lugarEntrega ?? JOB.direccion ?? null,
    referenciaTrabajo: JOB.titulo ?? null,
    cliente: CLIENTE.legalName || CLIENTE.name || null,
    emisor: EMISOR.legalName || EMISOR.name || null,
    emisorNif: EMISOR.taxId ?? null,
    fechaEntrega: a.fechaEntrega ?? null,
    firmadoPorNombre: a.firmadoPorNombre ?? null,
    firmadoPorCalidad: a.firmadoPorCalidad ?? null,
  };
}

/** Sella el albarán en la versión pedida y devuelve el sobre que quedaría en `evidenciaFirma`. */
function sobre(a, v) {
  // v:1 sella `obra` desde `Job.direccion`; v:2 desde `Albaran.lugarEntrega`. Se respeta cada
  // receta usando el MISMO sellador de producción: aquí no se reimplementa ninguna.
  const params = v === 1
    ? { ...paramsDelSellador(a), obra: JOB.direccion ?? null }
    : paramsDelSellador(a);
  return {
    v,
    canal: 'in_situ',
    firmadoAt: '2026-08-02T10:00:00.000Z',
    hashAlg: 'sha256',
    contentHash: computeAlbaranContentHash(params, v),
  };
}

/**
 * La fila tal y como la devuelve un `select`: **solo las claves seleccionadas existen**. Es la
 * pieza clave del fichero — Prisma no devuelve la columna que no pides, no la devuelve a `null`.
 */
function filaSegunSelect(a, columnas) {
  const fila = {};
  for (const k of columnas) if (k in a) fila[k] = a[k];
  return fila;
}

const SELECT_COMPLETO = [
  'id', 'merchantId', 'jobId', 'numero', 'fecha', 'modoValoracion', 'lineas', 'notas',
  'evidenciaFirma', ...LAS_CUATRO,
];
/** El `select` de ANTES de este arreglo: sin las cuatro de C5. */
const SELECT_VIEJO = SELECT_COMPLETO.filter((c) => !LAS_CUATRO.includes(c));

function verificarCon(columnas, v) {
  const a = albaranEnLaBase();
  const fila = filaSegunSelect({ ...a, evidenciaFirma: sobre(a, v) }, columnas);
  return verificarSobre(entradaDesdeFilas(fila, JOB, CLIENTE, EMISOR));
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-297/300 · SUELO: el montaje sella de verdad y el verificador se pronuncia', () => {
  // Sin esto, un `verificarSobre` que devolviera `undefined` dejaría en verde todo lo de abajo.
  const r = verificarCon(SELECT_COMPLETO, 2);
  assert.ok(r && typeof r.cuadra === 'boolean',
    `🔴 el verificador no se pronuncia (${JSON.stringify(r)}): este fichero no prueba nada.`);
  const sinCuatro = filaSegunSelect(albaranEnLaBase(), SELECT_VIEJO);
  for (const c of LAS_CUATRO) {
    assert.ok(!(c in sinCuatro),
      `🔴 el simulador del \`select\` viejo sigue trayendo «${c}»: no reproduce el caso, y los ` +
      'rojos de abajo saldrían por el motivo equivocado.');
  }
});

// ── R1 · REGLA 29: LO FIRMADO NO SE TOCA, NI PARA ARREGLARLO ────────────────────────────────

test('SCRUM-297/300 · 🔴 R1: un sobre v:1 sigue verificando OK — con el select nuevo Y con el viejo', () => {
  // La prueba que manda. Las cuatro columnas NO entran en la receta de v:1, así que añadirlas al
  // `select` no puede mover ni un bit de su hash. Si esto cae, el arreglo está mal y habría que
  // tirarlo: estaríamos declarando manipulados documentos que nadie tocó.
  const conNuevo = verificarCon(SELECT_COMPLETO, 1);
  assert.equal(conNuevo.cuadra, true,
    `🔴 UN SOBRE v:1 INTACTO SALE COMO MANIPULADO con el select nuevo (${conNuevo.motivo ?? ''}).\n` +
    '  Añadir columnas al lector ha cambiado el hash de una población ya firmada. Regla 29: lo\n' +
    '  sellado no se toca, y menos sin querer.');

  const conViejo = verificarCon(SELECT_VIEJO, 1);
  assert.equal(conViejo.cuadra, true,
    '🔴 v:1 ya no verifica con el select ANTERIOR. Entonces el problema no es de C5 y este fichero\n' +
    '  está midiendo otra cosa.');
});

// ── R2 · CONTROL POSITIVO: v:2 completo verifica ────────────────────────────────────────────

test('SCRUM-297/300 · 🔴 R2: un sobre v:2 con las cuatro columnas verifica OK', () => {
  const r = verificarCon(SELECT_COMPLETO, 2);
  assert.equal(r.cuadra, true,
    `🔴 un albarán v:2 INTACTO sale como manipulado (${r.motivo ?? ''}). Es el peor desenlace de\n` +
    '  esta herramienta: acusa a un documento que nadie tocó, y sobre toda la población a la vez.');
});

// ── R3/R4 · Y LA MITAD QUE EXPLICA POR QUÉ HACÍA FALTA EL ARREGLO ───────────────────────────

test('SCRUM-297/300 · 🔴 con el select VIEJO, un v:2 intacto se lee como MANIPULADO', () => {
  // El defecto, reproducido. Sin esto, R2 en verde no distingue «el arreglo funciona» de «nunca
  // hubo nada que arreglar»: los dos dan el mismo verde.
  const r = verificarCon(SELECT_VIEJO, 2);
  assert.equal(r.cuadra, false,
    '🔴 un v:2 verifica IGUAL sin las cuatro columnas. Entonces no entran en el sello y todo este\n' +
    '  arreglo sobra — o el montaje no reproduce el caso. Las dos cosas hay que mirarlas.');
});

test('SCRUM-297/300 · 🔴 R3: quitar CUALQUIERA de las cuatro rompe la verificación de un v:2', () => {
  // Una por una, no las cuatro juntas: quitarlas en bloque dejaría pasar un lector al que solo le
  // falte una. Cada assert nombra la columna, para que el rojo diga QUÉ falta y no solo que algo
  // falla.
  for (const c of LAS_CUATRO) {
    const columnas = SELECT_COMPLETO.filter((k) => k !== c);
    const r = verificarCon(columnas, 2);
    assert.equal(r.cuadra, false,
      `🔴 el lector puede quedarse SIN «${c}» y un v:2 sigue verificando OK. Esa columna entra en\n` +
      `  el sello, así que o el sellador dejó de meterla o el adaptador dejó de leerla: en cuanto\n` +
      '  una de las dos cosas sea cierta, el paquete deja de vigilar esa parte del documento.');
  }
});

test('SCRUM-297/300 · el `select` de producción trae LAS CUATRO (no una, ni tres)', () => {
  // El AST de `scrum297-fuentes-selladas` ya compara select↔adaptador. Esto es lo que aquel no
  // puede decir: que con ese select el documento REALMENTE verifica. Se apoya en el fichero real.
  const fuente = new URL('../src/modules/fiscal/evidencias/paquete.repo.ts', import.meta.url);
  const codigo = readFileSync(fuente, 'utf8');
  const i = codigo.indexOf('db.albaran.findMany');
  const j = codigo.indexOf('as Promise', i);
  assert.ok(i >= 0 && j > i, '🔴 no encuentro la consulta de albaranes en paquete.repo.ts: el test no mira nada.');
  const select = codigo.slice(i, j);
  const faltan = LAS_CUATRO.filter((c) => !new RegExp(`\\b${c}:\\s*true`).test(select));
  assert.deepEqual(faltan, [],
    `🔴 el select del paquete no pide: ${faltan.join(', ')}. Con esas ausentes, los sobres v:2\n` +
    '  intactos salen como manipulados en el paquete de evidencias fiscal.');
});
