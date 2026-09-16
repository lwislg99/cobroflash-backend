// tests/scrum749-la-primitiva-que-normaliza.test.mjs — SCRUM-749
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UN DÍA QUE NO EXISTE NO SE INVENTA: SE RECHAZA.
//
// `inicioDelDiaEn` / `finDelDiaEn` se apoyaban en `Date.UTC(y, m - 1, d, …)`, que **normaliza en
// silencio**. Medido antes de tocar nada, merchant en `Europe/Madrid`:
//
//     '2026-02-31'  →  fin del día 2026-03-03T22:59:59.999Z    ← el 31 de febrero es 3 de marzo
//     '2026-06-31'  →  fin del día 2026-07-01T21:59:59.999Z
//     '2026-13-01'  →  fin del día 2027-01-01T22:59:59.999Z
//
// 🔴 DÓNDE LO NOTA EL PROFESIONAL. El filtro REAL de consolidación de cliente, que es lo que
// decide qué partes entran en una factura recapitulativa:
//
//     hasta «2026-02-28» → corte 2026-02-28T22:59:59.999Z   ENTRAN: [ALB-…001]
//     hasta «2026-02-31» → corte 2026-03-03T22:59:59.999Z   ENTRAN: [ALB-…001, ALB-…002]
//
// `ALB-…002` es del **2 de marzo** y entraba en una factura que el profesional acotó a febrero.
// `GET /consolidables` pasa `req.query.hasta` sin validar el formato.
//
// ── ⚠️ ESTE FICHERO NO MIDE LA ZONA HORARIA DE LA MÁQUINA ───────────────────────────────────
// Todas las zonas van ESCRITAS en cada llamada y todos los instantes se comparan en ISO (UTC).
// No se lee `process.env.TZ` ni `Intl…resolvedOptions()`: no hay nada aquí que pueda dar distinto
// según dónde corra. Comprobado corriendo la tanda entera en UTC y en `Europe/Madrid`.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inicioDelDiaEn, finDelDiaEn, diaExiste } from '../dist/core/zonaDelMerchant.js';
import { seleccionarConsolidablesDeCliente } from '../dist/modules/jobs/domain/consolidacionCliente.service.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MADRID = 'Europe/Madrid';
const CANARIAS = 'Atlantic/Canary';

/** Los días que NO existen, y por qué cada uno está en la lista. */
const IMPOSIBLES = Object.freeze([
  ['2026-02-31', 'el 31 de febrero — el caso que se midió: salía 3 de marzo'],
  ['2026-02-30', 'el 30 de febrero'],
  ['2025-02-29', 'un 29 de febrero en año NO bisiesto'],
  ['2026-06-31', 'un mes de 30 días con día 31'],
  ['2026-13-01', 'un mes 13'],
  ['2026-00-10', 'un mes 0'],
  ['2026-01-00', 'un día 0'],
  ['no-es-fecha', 'ni siquiera tiene forma de día'],
  ['2026-01', 'le falta el día'],
]);

test('SCRUM-749 · 🔴 un día que NO EXISTE se RECHAZA, no se normaliza a otro', () => {
  assert.ok(IMPOSIBLES.length >= 8, '🔴 SUELO: sin casos que probar, esto no prueba nada.');
  for (const [dia, porque] of IMPOSIBLES) {
    for (const fn of [inicioDelDiaEn, finDelDiaEn]) {
      assert.throws(() => fn(dia, MADRID), /dia_inexistente/,
        `🔴 «${dia}» (${porque}) NO se rechaza: se está normalizando a otro día en silencio. Es una `
        + 'fecha plausible que nadie eligió, que es el peor valor por defecto que hay.');
    }
  }
});

test('SCRUM-749 · ✅ POSITIVO: una fecha NORMAL da EXACTAMENTE lo mismo que antes', () => {
  // 🔴 Los instantes van escritos, no recalculados: si se recalcularan con la misma aritmética que
  // se está probando, este control sería un espejo y pasaría con cualquier cosa. Salen de la
  // medición previa al cambio, con el proceso en UTC y en Europe/Madrid (idénticos).
  const ESPERADO = Object.freeze([
    ['2026-02-28', '2026-02-27T23:00:00.000Z', '2026-02-28T22:59:59.999Z', 'un día normal de invierno'],
    ['2026-03-31', '2026-03-30T22:00:00.000Z', '2026-03-31T21:59:59.999Z', 'un día normal de verano'],
    ['2026-12-31', '2026-12-30T23:00:00.000Z', '2026-12-31T22:59:59.999Z', 'fin de año'],
    ['2024-02-29', '2024-02-28T23:00:00.000Z', '2024-02-29T22:59:59.999Z', '29 de febrero BISIESTO: existe'],
    ['2026-03-29', '2026-03-28T23:00:00.000Z', '2026-03-29T21:59:59.999Z', 'el día que ADELANTA la hora'],
    ['2026-10-25', '2026-10-24T22:00:00.000Z', '2026-10-25T22:59:59.999Z', 'el día que ATRASA la hora'],
  ]);
  for (const [dia, ini, fin, porque] of ESPERADO) {
    assert.equal(inicioDelDiaEn(dia, MADRID).toISOString(), ini,
      `🔴 el inicio de «${dia}» (${porque}) ha cambiado. Al cerrar el silencio se ha movido una `
      + 'fecha buena: eso es romperlo por el otro lado.');
    assert.equal(finDelDiaEn(dia, MADRID).toISOString(), fin,
      `🔴 el fin de «${dia}» (${porque}) ha cambiado.`);
  }

  // Y la zona sigue mandando: Canarias no es la península, y eso no lo ha tocado este ticket.
  assert.notEqual(inicioDelDiaEn('2026-06-15', CANARIAS).toISOString(),
    inicioDelDiaEn('2026-06-15', MADRID).toISOString(),
    '🔴 Canarias y la península dan el mismo instante: la zona ha dejado de contar.');
});

test('SCRUM-749 · 🔴 DONDE SE VE: el filtro de consolidación ya no mete marzo en febrero', () => {
  const alb = (id, numero, fechaISO) => ({
    id, numero, fecha: new Date(fechaISO),
    estado: 'firmado', modoValoracion: 'VALORADO', invoiceId: null,
    customerId: 7, jobId: 100, tipoOperacion: 'MANTENIMIENTO',
  });
  const partes = [
    alb(1, 'ALB-2026-001', '2026-02-20T10:00:00.000Z'),
    alb(2, 'ALB-2026-002', '2026-03-02T10:00:00.000Z'),
  ];

  // ✅ El rango BUENO sigue funcionando igual: entra febrero y sólo febrero.
  const bueno = seleccionarConsolidablesDeCliente(partes, 7, { hasta: '2026-02-28' }, MADRID);
  assert.deepEqual(bueno.elegibles.map((a) => a.numero), ['ALB-2026-001'],
    '🔴 el rango correcto ha dejado de funcionar: se ha roto por el otro lado.');

  // 🔴 Y el imposible se RECHAZA en vez de colar un parte de marzo.
  assert.throws(() => seleccionarConsolidablesDeCliente(partes, 7, { hasta: '2026-02-31' }, MADRID),
    /dia_inexistente/,
    '🔴 «hasta el 31 de febrero» vuelve a cortar el 3 de marzo, y un parte de marzo entra en una '
    + 'factura que el profesional acotó a febrero. Nadie se lo dice.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// LA RESPUESTA AL PROFESIONAL · el 400 y su texto FIRMADO
//
// El rechazo de la primitiva llegaba a la pantalla como `500 internal_error` — «se ha roto el
// servidor» sobre un dato que sólo estaba mal escrito. La ruta lo contesta ahora con un 400 y el
// texto que firmó el asesor. Se comprueba sobre el FUENTE porque ejercitar la ruta pide base de
// datos y este fichero corre sin gate.
// ─────────────────────────────────────────────────────────────────────────────────────────────
/**
 * LOS DOS TEXTOS FIRMADOS, uno por campo. Van ENTEROS y no compuestos: la microcopy se firma tal
 * cual (regla 30), y una plantilla que sustituyera el nombre del campo convertiría dos textos
 * aprobados en uno inventado en tiempo de ejecución.
 */
const FIRMADOS = Object.freeze({
  hasta: 'La fecha «hasta» no existe en el calendario. Revísala.',
  desde: 'La fecha «desde» no existe en el calendario. Revísala.',
});

test('SCRUM-749 · el día imposible se contesta con 400 y el texto FIRMADO, literal', () => {
  const ruta = fs.readFileSync(
    path.join(RAIZ, 'src/modules/jobs/app/routes/albaranes.routes.ts'), 'utf8');

  for (const [campo, texto] of Object.entries(FIRMADOS)) {
    assert.ok(ruta.includes(`message: '${texto}',`),
      `🔴 el texto firmado de «${campo}» ya no está literal en la ruta. Es microcopy: la firma el `
      + 'asesor (regla 30) y no se reescribe al pulir.\n     esperado: ' + texto);
  }

  assert.ok(ruta.includes("error: 'dia_inexistente'"),
    '🔴 la ruta ya no distingue el día imposible: vuelve a caer al `500 internal_error`, que le '
    + 'dice al profesional que se ha roto el servidor cuando lo que pasa es que ese día no existe.');

  // 🔴 Y NO hay un texto para un tercer campo que nadie haya firmado. `mes` («YYYY-MM») entra por
  // esta misma ruta y NO lo cubre este ticket: si alguien le escribe un aviso, que lo firme antes.
  const otros = [...ruta.matchAll(/La fecha «([^»]+)» no existe/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(otros)].sort(), ['desde', 'hasta'],
    `🔴 hay avisos para campos que nadie ha firmado: ${JSON.stringify(otros)}`);
});

test('SCRUM-749 · `diaExiste` contesta lo mismo que la primitiva, sin lanzar', () => {
  // Se DERIVA de la misma comprobación, así que no puede divergir; esto lo sujeta.
  for (const [dia] of IMPOSIBLES) {
    assert.equal(diaExiste(dia), false, `🔴 \`diaExiste\` da por bueno «${dia}».`);
    assert.throws(() => finDelDiaEn(dia, MADRID), /dia_inexistente/);
  }
  for (const dia of ['2026-02-28', '2024-02-29', '2026-12-31']) {
    assert.equal(diaExiste(dia), true, `🔴 \`diaExiste\` rechaza «${dia}», que sí existe.`);
    assert.doesNotThrow(() => finDelDiaEn(dia, MADRID));
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA MUTACIÓN QUE ME TUMBA (SCRUM-745)
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El ida y vuelta deja de comprobarse: `Date.UTC` vuelve a normalizar en silencio y el 31 de
    // febrero vuelve a ser 3 de marzo.
    fichero: 'src/core/zonaDelMerchant.ts',
    de: '  if (!existe) {',
    a: '  if (false) {',
    cae: 'un día que NO EXISTE se RECHAZA, no se normaliza a otro',
  },
];
