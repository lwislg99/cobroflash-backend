// tests/scrum707-estado-no-contemplado.test.mjs — SCRUM-707
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN ESTADO QUE EL PRODUCTO NO CONOCE YA NO REVIENTA — Y SE DICE.
//
// `destinoEfectivo` devolvía `undefined` para un estado que la tabla no contempla, y los dos
// consumidores hacen `cubos[destino].push(...)`. `cubos[undefined]` no existe:
// **`TypeError: Cannot read properties of undefined (reading 'push')`**, sin `try` alrededor.
//
// Medido sobre `main` el 8-sep-2026, antes de tocar nada:
//
//   pending (control positivo) ....  0/9  undefined → va a secundaria
//   rectificada · draft · '' ......  9/9  undefined → TypeError   (11/11 en el albarán)
//
// ── 🔴 POR QUÉ `'oculta'` Y NO UN CUBO POR DEFECTO ───────────────────────────────────────
// Un fallback OFRECERÍA las 9 acciones de la factura donde el máximo vetado en un estado conocido
// es 6 — y entre las que reaparecen está `btnAnular`, **oculta en LOS CUATRO estados conocidos**.
// En el albarán, 11 sobre 6, con `btnEmitir`, `btnEnviarFirmar` y `btnFirmarAqui` dentro.
//
// 🔒 Un fallback no es neutral: abre, en el estado que nadie ha vetado, justo las acciones que
// alguien decidió ocultar en todos los que sí vetó. Anular una factura emitida es la regla 29;
// firmar un albarán lo congela.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const ley = require_('../public/dashboard/js/patronDetalleAcciones.js');
const inv = require_('../public/dashboard/js/invoiceActionsRegistry.js');
const alb = require_('../public/dashboard/js/albaranActionsRegistry.js');

const DOCS = [
  ['factura', inv.INVOICE_ACTION_REGISTRY, inv.INVOICE_STATES],
  ['albarán', alb.ALBARAN_ACTION_REGISTRY, alb.ALBARAN_STATES],
];
const NO_DECLARADOS = ['rectificada', 'draft', ''];

/** Lo que hacen los dos consumidores: repartir en cubos. Revienta igual que en la pantalla. */
function repartir(registro, estado) {
  const cubos = { primaria: [], secundaria: [], overflow: [] };
  for (const a of registro) {
    const d = ley.destinoEfectivo(a, estado, {});
    if (d === 'oculta' || d === 'seccion-propia') continue;
    cubos[d].push(a.id); // 🔴 aquí explotaba
  }
  return cubos;
}
const ofrecidas = (registro, estado) => {
  const c = repartir(registro, estado);
  return [...c.primaria, ...c.secundaria, ...c.overflow];
};

// ═══ 🔴 SUELO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-707 · 🔴 SUELO: los dos registros traen acciones y estados de verdad', () => {
  for (const [nombre, registro, estados] of DOCS) {
    assert.ok(registro.length >= 9, `🔴 «${nombre}» sólo trae ${registro.length} acciones`);
    assert.ok(estados.length >= 3, `🔴 «${nombre}» sólo declara ${estados.length} estados`);
  }
  assert.equal(typeof ley.estadoReconocido, 'function', '🔴 la ley no publica `estadoReconocido`');
});

// ═══ 🔴 EL ROJO: LOS TRES ESTADOS DEJAN DE REVENTAR ═══════════════════════════════════════

test('SCRUM-707 · 🔴 un estado no contemplado NO lanza, en los DOS consumidores', () => {
  for (const [nombre, registro] of DOCS) {
    for (const estado of NO_DECLARADOS) {
      assert.doesNotThrow(() => repartir(registro, estado),
        `🔴 «${nombre}» con el estado ${JSON.stringify(estado)} sigue lanzando. Era `
        + '`cubos[undefined].push`, y se lleva por delante el resto del pintado del detalle.');

      const d = registro.map((a) => ley.destinoEfectivo(a, estado, {}));
      assert.equal(d.filter((x) => x === undefined).length, 0,
        `🔴 «${nombre}» sigue devolviendo \`undefined\` como destino con ${JSON.stringify(estado)}`);
      for (const x of d) {
        assert.ok(ley.DESTINOS.includes(x),
          `🔴 «${nombre}» devuelve el destino «${x}», que no es uno de los cinco de la ley`);
      }
    }
  }
});

// ═══ ✅ CONTROL POSITIVO: LO QUE FUNCIONABA, IGUAL ════════════════════════════════════════

test('SCRUM-707 · ✅ CONTROL POSITIVO: `pending` sigue yendo a secundaria, 0/9 undefined', () => {
  // Apretar esto no puede cambiar lo que ya funcionaba.
  const R = inv.INVOICE_ACTION_REGISTRY;
  const d = R.map((a) => ley.destinoEfectivo(a, 'pending', {}));
  assert.equal(d.filter((x) => x === undefined).length, 0);
  assert.equal(d[0], 'secundaria', '🔴 la primera acción de `pending` ha dejado de ir a secundaria');
  assert.deepEqual(ofrecidas(R, 'pending'),
    ['btnPdf', 'btnWhatsApp', 'btnReminder', 'btnRectify', 'btnRegen', 'btnDispute'],
    '🔴 ha cambiado lo que se ofrece en `pending`, que es un estado que ya funcionaba');
});

test('SCRUM-707 · ✅ CONTROL POSITIVO: los estados conocidos ofrecen lo mismo que antes', () => {
  // Enumerado, no contado: un número igual puede ser otro conjunto (SCRUM-727).
  const esperado = {
    'factura|pending': ['btnPdf', 'btnWhatsApp', 'btnReminder', 'btnRectify', 'btnRegen', 'btnDispute'],
    'factura|paid': ['btnPdf', 'btnWhatsApp', 'btnTogglePaid', 'btnRectify', 'btnRegen', 'btnDispute'],
    'factura|annulled': ['btnPdf', 'btnRegen'],
    'factura|R1': ['btnPdf', 'btnRegen'],
    'albarán|borrador': ['btnEmitir', 'btnPdf', 'btnEditarLineas', 'btnFoto', 'btnVerTrabajo', 'btnDuplicar'],
    'albarán|emitido': ['btnEnviarFirmar', 'btnFirmarAqui', 'btnPdf', 'btnFoto', 'btnVerTrabajo', 'btnDuplicar'],
    'albarán|firmado': ['btnPdf', 'btnWhatsApp', 'btnFoto', 'btnVerTrabajo', 'btnDuplicar'],
  };
  for (const [nombre, registro, estados] of DOCS) {
    for (const e of estados) {
      const clave = `${nombre}|${e}`;
      assert.deepEqual(ofrecidas(registro, e).sort(), (esperado[clave] || []).sort(),
        `🔴 ha cambiado lo que se ofrece en «${clave}»`);
    }
  }
});

// ═══ ✅ CONTROL NEGATIVO: NINGUNA ACCIÓN VETADA REAPARECE ═════════════════════════════════

test('SCRUM-707 · ✅ NEGATIVO: las siete acciones vetadas NO reaparecen. Enumeradas.', () => {
  // 🔴 Las cuatro que están ocultas en TODOS los estados conocidos, más las tres peligrosas que
  // un fallback habría devuelto. Por NOMBRE, no por cuenta: «cero acciones» se cumpliría también
  // si el reparto se rompiera de otra manera.
  const VETADAS = {
    factura: ['btnAnular', 'btnBizum'],
    albarán: ['btnFacturar', 'btnConvertirFactura', 'btnEmitir', 'btnEnviarFirmar', 'btnFirmarAqui'],
  };
  for (const [nombre, registro] of DOCS) {
    for (const estado of NO_DECLARADOS) {
      const salen = ofrecidas(registro, estado);
      assert.deepEqual(salen, [],
        `🔴 con el estado ${JSON.stringify(estado)} se ofrecen ${salen.length} acciones en «${nombre}»: `
        + `${salen.join(', ')}. En un estado que nadie ha vetado no se ofrece NADA.`);
      for (const v of VETADAS[nombre]) {
        assert.equal(salen.includes(v), false,
          `🔴 «${v}» reaparece con un estado no contemplado. Está oculta en todos los conocidos, y `
          + 'ofrecerla ahí es abrir justo lo que alguien decidió cerrar.');
      }
    }
  }
});

// ═══ ✅ EL AVISO: SÓLO EN EL ESTADO NO RECONOCIDO ═════════════════════════════════════════

test('SCRUM-707 · ✅ `estadoReconocido` distingue los DOS casos', () => {
  for (const [nombre, registro, estados] of DOCS) {
    for (const e of estados) {
      assert.equal(ley.estadoReconocido(registro, e), true,
        `🔴 «${nombre}» no reconoce su propio estado «${e}»: el aviso saldría en un documento correcto`);
    }
    for (const e of NO_DECLARADOS) {
      assert.equal(ley.estadoReconocido(registro, e), false,
        `🔴 «${nombre}» da por reconocido ${JSON.stringify(e)}: el aviso no saldría donde hace falta`);
    }
  }
  // 🔴 Y el caso que separa los dos hechos: `annulled` ofrece POCAS acciones y SÍ se reconoce.
  assert.equal(ley.estadoReconocido(inv.INVOICE_ACTION_REGISTRY, 'annulled'), true);
  assert.equal(ofrecidas(inv.INVOICE_ACTION_REGISTRY, 'annulled').length, 2,
    '🔴 SUELO del control: `annulled` tiene que ofrecer POCAS pero no cero, o no separa nada');
});

test('SCRUM-707 · ✅ el aviso se pinta con el texto APROBADO, y sólo donde toca', async () => {
  const { leerFuente } = await import('./_guard-texto.mjs');
  const TEXTO = 'No reconocemos el estado de este documento — no podemos ofrecerte acciones aquí.';

  for (const vista of ['invoiceDetailView.js', 'albaranDetailView.js']) {
    const src = leerFuente(path.join(RAIZ, 'public/dashboard/js', vista),
      { ancla: 'avisoEstadoNoReconocido' });
    assert.ok(src.includes(TEXTO), `🔴 «${vista}» no pinta el texto aprobado, literal`);
    assert.match(src, /estadoReconocido\(/,
      `🔴 «${vista}» decide el aviso sin preguntar si el estado se reconoce. Si se dispara por `
      + '«cero botones», saldría en documentos correctos y nadie lo leería.');
  }

  // Y la clase tiene su regla: una clase pintada sin regla se ve desnuda (SCRUM-666).
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
  assert.match(css, /\.detail-estado-desconocido\s*\{/,
    '🔴 `.detail-estado-desconocido` se pinta y no tiene regla en la hoja');
});
