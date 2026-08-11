// SCRUM-397 · La fecha de cobro la dice quien marca, no el reloj.
//
// Sin gate: el criterio es un módulo PURO y el censo lee el código por AST. Ni BD, ni red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA VÍCTIMA, para que ningún test se despiste
//
// Un pago del **31 de marzo** conciliado el **2 de abril** quedaba fechado en abril. **Cruza de
// trimestre** — y con criterio de caja es el euro declarado en el periodo que no toca. Lo heredan
// `maintenance.service.ts:496` y `weeklyDigest.service.ts:68`, que agrupan POR `paidAt`.
//
// Y en el marcado EN LOTE se multiplica por el tamaño de la selección.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  resolverFechaDeCobro, COPY_FECHA_FUTURA, COPY_LOTE_UNA_FECHA,
} from '../dist/modules/billing/domain/fechaDeCobro.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** El trimestre natural de una fecha: 1 para ene-mar. Es lo que decide el daño. */
const trimestreDe = (d) => Math.floor(d.getMonth() / 3) + 1;

// ── EL CONTROL POSITIVO · ES EL TEST ────────────────────────────────────────────────────

test('SCRUM-397 · 🔴 EL VECTOR: pago del 31 de marzo marcado el 2 de abril → cuenta en el 1T', () => {
  const dosDeAbril = new Date(2026, 3, 2, 11, 30);          // hoy, cuando se concilia
  const r = resolverFechaDeCobro('2026-03-31', dosDeAbril);

  assert.equal(r.ok, true, `🔴 se rechazó una fecha pasada legítima: ${r.message}`);
  assert.equal(r.origen, 'declarada', '🔴 no se está usando la fecha que dio la persona');
  assert.equal(r.fecha.getMonth(), 2, `🔴 el mes guardado es ${r.fecha.getMonth() + 1} y son marzo (3)`);
  assert.equal(
    trimestreDe(r.fecha), 1,
    `🔴 EL COBRO CAE EN EL TRIMESTRE ${trimestreDe(r.fecha)} Y ES EL 1º.\n\n` +
      '  Es el defecto entero: con `new Date()` este pago se fechaba el 2 de abril y se declaraba en\n' +
      '  el 2T. Con criterio de caja, eso es el euro declarado en el periodo que no toca.',
  );
  // Y la otra cara: lo que HABRÍA pasado antes, para que el vector no se lea como trivial.
  assert.equal(trimestreDe(dosDeAbril), 2, '🔴 el suelo del vector: «hoy» tiene que caer en OTRO trimestre');
});

test('SCRUM-397 · EN LOTE: la fecha elegida se conserva, y es UNA para toda la selección', () => {
  // Decisión escrita antes del código: la acción ES una sola afirmación —«estas se cobraron el día
  // X»—. Si se cobraron en días distintos, son dos hechos y van en dos operaciones.
  const dosDeAbril = new Date(2026, 3, 2, 11, 30);
  const r = resolverFechaDeCobro('2026-03-31', dosDeAbril);
  assert.equal(r.ok, true);

  // Dos facturas del mismo lote reciben EXACTAMENTE la misma fecha, y es la elegida.
  const loteDeDos = [r.fecha, r.fecha];
  for (const f of loteDeDos) assert.equal(trimestreDe(f), 1, '🔴 una del lote se fue a otro trimestre');
  assert.equal(loteDeDos[0].getTime(), loteDeDos[1].getTime(), '🔴 el lote no comparte la fecha');

  // Y la pantalla lo DICE: sin ese aviso, poner una fecha a documentos de días distintos sería
  // inventar un hecho sin que nadie lo haya afirmado.
  assert.match(COPY_LOTE_UNA_FECHA, /todas las facturas seleccionadas/,
    '🔴 el aviso del lote ya no dice que la fecha se aplica a TODAS');
  assert.match(COPY_LOTE_UNA_FECHA, /por separado/,
    '🔴 el aviso ya no dice qué hacer si se cobraron en días distintos');
});

// ── EL CRITERIO ─────────────────────────────────────────────────────────────────────────

test('SCRUM-397 · una fecha FUTURA se rechaza: no puede ser un hecho', () => {
  const hoy = new Date(2026, 3, 2, 11, 30);
  const r = resolverFechaDeCobro('2026-04-03', hoy);
  assert.equal(r.ok, false, '🔴 se admitió una fecha futura: el dinero no ha entrado todavía');
  assert.equal(r.error, 'fecha_futura');
  assert.equal(r.message, COPY_FECHA_FUTURA);

  // HOY sí vale, aunque el reloj vaya por la tarde y la fecha llegue como medianoche.
  const hoyMismo = resolverFechaDeCobro('2026-04-02', hoy);
  assert.equal(hoyMismo.ok, true, '🔴 se rechazó HOY: la fecha ISO llega a medianoche y sigue siendo hoy');
});

test('SCRUM-397 · hacia atrás NO hay límite, y es deliberado', () => {
  // Un tope convertiría «no me deja» en «pongo la de hoy» — el defecto de este ticket con el
  // usuario forzado a cometerlo. El caso real es conciliar una transferencia vieja.
  const hoy = new Date(2026, 3, 2);
  for (const vieja of ['2026-01-02', '2025-06-15', '2024-12-31']) {
    const r = resolverFechaDeCobro(vieja, hoy);
    assert.equal(r.ok, true, `🔴 se rechazó ${vieja}: un tope hacia atrás empuja a poner la de hoy`);
  }
});

test('SCRUM-397 · sin fecha → hoy, y eso NO es el defecto', () => {
  // El defecto no era que por defecto fuera hoy: era que NO SE PODÍA CAMBIAR.
  const hoy = new Date(2026, 3, 2, 11, 30);
  for (const vacio of [undefined, null, '']) {
    const r = resolverFechaDeCobro(vacio, hoy);
    assert.equal(r.ok, true);
    assert.equal(r.origen, 'ahora', '🔴 sin entrada, el origen tiene que declararse como «ahora»');
    assert.equal(r.fecha.getTime(), hoy.getTime());
  }
  // Y una ilegible no se convierte en hoy en silencio: se dice.
  const mala = resolverFechaDeCobro('el martes', hoy);
  assert.equal(mala.ok, false, '🔴 «el martes» se está aceptando');
  assert.equal(mala.error, 'fecha_ilegible');
});

// ── EL CENSO, CON SU SUELO DE CINCO ─────────────────────────────────────────────────────

function escriturasDePaidAt() {
  const ficheros = [];
  (function w(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) w(p); else if (e.name.endsWith('.ts')) ficheros.push(p);
    }
  })(path.join(RAIZ, 'src'));

  const sitios = [];
  let nodos = 0;
  for (const f of ficheros) {
    const sf = ts.createSourceFile('x.ts', fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const L = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const v = (n) => {
      nodos += 1;
      if (ts.isPropertyAssignment(n) && n.name.getText(sf) === 'paidAt') {
        const valor = n.initializer.getText(sf).replace(/\s+/g, ' ');
        // Solo ESCRITURAS: `paidAt: <algo>` con valor. Un `paidAt: true` de un `select` no lo es.
        if (valor !== 'true' && !/^\{/.test(valor)) {
          sitios.push({ f: path.relative(RAIZ, f).split(path.sep).join('/'), l: L(n), valor });
        }
      }
      ts.forEachChild(n, v);
    };
    v(sf);
  }
  return { sitios, nodos };
}

test('SCRUM-397 · SUELO: el censo de escrituras de `paidAt` encuentra AL MENOS CINCO', () => {
  const { sitios, nodos } = escriturasDePaidAt();
  assert.ok(nodos > 50_000, `🔴 ESCÁNER CIEGO: solo ${nodos} nodos recorridos`);
  assert.ok(
    sitios.length >= 5,
    `🔴 ESCÁNER CIEGO: el censo ve ${sitios.length} escrituras de \`paidAt\` y hay AL MENOS CINCO.\n\n` +
      '  El número no es una suposición: se midió (mpWebhook:142 · psp:121 · psp:167 ·\n' +
      '  invoicesAdmin:373 · invoicesAdmin:907). Un censo corto escrito en un comentario se hereda\n' +
      '  como si fuera medida — le pasó a `criterioCaja.ts:12`, que dice «TRES sitios».\n' +
      `  Vistos: ${sitios.map((s) => `${s.f}:${s.l}`).join(', ')}`,
  );
});

test('SCRUM-397 · 🔴 el marcado MANUAL ya no estampa el reloj', () => {
  const { sitios } = escriturasDePaidAt();
  const manual = sitios.filter((s) => s.f.endsWith('invoicesAdmin.routes.ts'));
  assert.ok(manual.length >= 2, `🔴 ESCÁNER CIEGO: ${manual.length} escrituras en invoicesAdmin, se midieron 2`);

  // 🔴 SE MIRA LA ESCRITURA AL MODELO, NO CUALQUIER `paidAt:` DEL FICHERO.
  //
  // La primera versión buscaba `/fecha\.fecha/` entre todas las propiedades `paidAt` del fichero, y
  // al probar el rojo —devolver `new Date()` en el `updateMany`— **el guard siguió verde**: casaba
  // con la METADATA DE AUDITORÍA (`paidAt: fecha.fecha.toISOString()`), que está tres líneas más
  // abajo y no escribe en la base. La herramienta funcionaba perfectamente sobre el objeto
  // equivocado. Ahora se localiza el `updateMany` del handler y se mira SU `data.paidAt`.
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/system/app/routes/invoicesAdmin.routes.ts'), 'utf8');
  const sfx = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let escrituraDelLote = null;
  const vv = (n) => {
    if (ts.isCallExpression(n) && /invoice\.updateMany$/.test(n.expression.getText(sfx))) {
      const txt = n.getText(sfx).replace(/\s+/g, ' ');
      // El del lote es el que filtra por `id: { in: ids }` — su marca, no su número de línea.
      if (/id: \{ in: ids \}/.test(txt)) {
        escrituraDelLote = (/data: \{[^}]*paidAt:\s*([^,}]+)/.exec(txt) ?? [])[1]?.trim() ?? null;
      }
    }
    ts.forEachChild(n, vv);
  };
  vv(sfx);
  assert.ok(escrituraDelLote, '🔴 ESCÁNER CIEGO: no se localiza el `updateMany` del lote ni su `paidAt`');
  // Hermano positivo: el detector reconocería el reloj si estuviera ahí.
  assert.match('new Date()', /new Date\(\)/, '🔴 ESCÁNER CIEGO: el detector no reconoce el reloj');

  const enLote = !/new Date\(\)/.test(escrituraDelLote) && /fecha/.test(escrituraDelLote);
  assert.ok(
    enLote,
    '🔴 SE HA PERDIDO LA FECHA REAL EN EL MARCADO EN LOTE.\n\n' +
      '  `POST /bulk-paid` ha vuelto a escribir el reloj en vez de la fecha que dio la persona. Un\n' +
      '  pago del 31 de marzo conciliado el 2 de abril vuelve a declararse en el 2T, y en lote eso\n' +
      `  se multiplica por la selección.\n  Escrito en el lote: ${escrituraDelLote}`,
  );
});

// ── CONTROL NEGATIVO: LO QUE FUNCIONA NO SE TOCA ────────────────────────────────────────

test('SCRUM-397 · CONTROL NEGATIVO: los webhooks siguen guardando el instante del aviso', () => {
  // En un webhook `new Date()` es CORRECTO: el aviso llega en el momento del cobro. Si este test
  // se pusiera rojo, alguien habría «arreglado» algo que no estaba roto.
  const { sitios } = escriturasDePaidAt();
  const webhooks = sitios.filter((s) => /psp\.routes\.ts|mpWebhook\.routes\.ts/.test(s.f));
  assert.equal(webhooks.length, 3, `🔴 ESCÁNER CIEGO: ${webhooks.length} escrituras en webhooks, se midieron 3`);
  for (const w of webhooks) {
    assert.match(w.valor, /new Date\(\)/,
      `🔴 ${w.f}:${w.l} ha dejado de usar el instante del webhook (${w.valor}). Ahí era correcto.`);
  }

  // Y `paid-webhook` con su `?? now` tampoco se toca: también es un webhook.
  const inv = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/app/routes/invoice.routes.ts'), 'utf8');
  assert.match(inv, /paidAt: invoice\.paidAt \?\? now/,
    '🔴 se ha tocado `paid-webhook`. Es un WEBHOOK, no el marcado manual: ahí `?? now` es correcto.');
});

test('SCRUM-397 · REGLA 38: el marcado manual NO toca el camino de emisión', () => {
  // Medido por fichero y por lado antes de construir, y se vuelve a fijar aquí: el handler del
  // lote no llama a nada que emita. Si algún día lo hiciera, esto cae y el ticket pasa a ser STOP.
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/system/app/routes/invoicesAdmin.routes.ts'), 'utf8');
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const EMISION = ['emitInvoice', 'allocateInvoiceNumber', 'applyVeriFactu', 'sellarTrasEmision'];

  let handler = null;
  const v = (n) => {
    if (ts.isCallExpression(n) && /router\.post$/.test(n.expression.getText(sf))
      && /'\/bulk-paid'/.test(n.arguments[0]?.getText(sf) ?? '')) handler = n.getText(sf);
    ts.forEachChild(n, v);
  };
  v(sf);
  assert.ok(handler, '🔴 ESCÁNER CIEGO: no se localiza el handler de `/bulk-paid`');
  // Hermano positivo: el detector reconoce una llamada de emisión si la tuviera delante.
  assert.ok(EMISION.some((e) => new RegExp(`\\b${e}\\s*\\(`).test(`await ${EMISION[0]}(x)`)),
    '🔴 ESCÁNER CIEGO: el detector no reconocería una llamada de emisión');

  const emite = EMISION.filter((e) => new RegExp(`\\b${e}\\s*\\(`).test(handler));
  assert.deepEqual(emite, [],
    `🔴 \`/bulk-paid\` ha empezado a llamar a ${emite.join(', ')}. Marcar un cobro dejaría de ser ` +
      'una conciliación y pasaría a tocar el camino de emisión: STOP y diff con GO (regla 38).');
});
