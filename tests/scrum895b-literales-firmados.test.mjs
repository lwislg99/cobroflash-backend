// tests/scrum895b-literales-firmados.test.mjs — SCRUM-895, segunda mitad
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LOS TRES TEXTOS FIRMADOS ESTÁN, LITERALES — Y EL CUARTO SIGUE SIENDO EL MARCADOR
//
// El fundador firmó tres el 17-sep-2026 (SCRUM-895, comentario 15699) y PARÓ el cuarto. Este
// fichero vigila las dos cosas, y la segunda es la que se olvida.
//
//   ✅ (A) `ROTULOS_ALBARAN.btnConvertirFactura` → «Facturar con el presupuesto»
//   ✅ (C) 409 `albaran_no_firmado`              → «Este parte todavía no está firmado. …»
//   ✅ (D) 409 `albaran_ya_facturado`            → «Este parte ya está facturado entero.»
//   🔴 (B) 409 `facturacion_no_disponible`       → SIGUE con `[PENDIENTE microcopy oficial]`
//
// 🔴 POR QUÉ (B) NECESITA VIGILANCIA TANTO COMO LOS OTROS TRES. Está parado no por cómo está
// escrito, sino por lo que NOMBRA: la propuesta decía «justificantes de cobro» y el justificante
// está RETIRADO (SCRUM-825 / SCRUM-612). Un marcador que se queda a propósito se parece, para
// quien pasa por ahí, a un marcador que se olvidó — y el «arreglo de paso» entraría sin que nadie
// se enterara. Lo que se deja a propósito necesita quien lo vigile tanto como lo que se cambia.
//
// ⚠️ SE INVOCA EL HANDLER, NO SE LEE EL FICHERO (patrón de `scrum290-endpoint-convertir`). Un test
// que lee el código comprueba que el código dice lo que dice, no que haga lo que debe. Las tres
// respuestas de 409 salen de la ruta de verdad con un `prisma` de doble.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const routerDe = (mod) => mod.default?.default ?? mod.default;

const MARCADOR = '[PENDIENTE microcopy oficial]';

// ── LOS LITERALES FIRMADOS, tal y como los aprobó el fundador ────────────────────────────────
// Se escriben aquí a mano A PROPÓSITO: si se leyeran del producto, el test diría «el producto se
// parece a sí mismo» y una edición de una coma pasaría. La copia de referencia es el comentario
// 15699 del ticket.
const FIRMADO_A = 'Facturar con el presupuesto';
const FIRMADO_C = 'Este parte todavía no está firmado. Solo se factura lo que el cliente ha firmado.';
const FIRMADO_D = 'Este parte ya está facturado entero.';

// ── El banco ─────────────────────────────────────────────────────────────────────────────────

async function invocar(req) {
  const router = routerDe(await import(DIST + 'modules/jobs/app/routes/albaranes.routes.js'));
  const capa = router.stack.find((l) => l.route?.path === '/:id/convertir-en-factura' && l.route?.methods?.post);
  assert.ok(capa, '🔴 ESCÁNER CIEGO: no existe POST /:id/convertir-en-factura — este fichero no comprobaría NADA.');
  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; },
  };
  const h = capa.route.stack;
  await h[h.length - 1].handle(req, res, () => {});
  return salida;
}

/**
 * Monta lo mínimo para llegar a cada una de las tres puertas.
 *
 * ⚠️ MERCHANT 7, NUNCA id 1: `isDemoMerchant` es `id === 1` o `demo@yaqu.app`, y un fixture demo
 * haría que TODO corriera en modo 'demo' — la puerta del justificante no se ejercitaría jamás.
 * Es el mismo dato de prueba que ya tapó esta comprobación una vez (ver `scrum290`).
 */
function montar({ albaran, facturacionES = true }) {
  const p = moduloPrisma.prisma;
  p.albaran = { findFirst: async () => albaran, findMany: async () => [{ id: albaran.id, lineas: albaran.lineas ?? [] }] };
  p.job = { findFirst: async () => ({ id: 1, customerId: 5, quoteId: 7 }) };
  p.customer = { findFirst: async () => ({ name: 'Cliente QA', legalName: null, taxId: null, email: null, phone: null }) };
  p.merchant = {
    findUnique: async () => ({
      id: 7, email: 'pro@fontaneria.es', country: 'ES',
      flags: { INVOICING_ES_ENABLED: facturacionES },
      defaultCurrency: 'EUR', taxId: 'B1',
    }),
  };
  p.quote = { findFirst: async () => ({ id: 7, quoteNumber: 'P-1', lines: [{ concept: 'Tubo', qty: 10, price: 12.5, tax: 0.21 }], discountGlobalAmount: null }) };
  p.albaranLineaFacturada = { findMany: async () => [], createMany: async () => {} };
  p.$transaction = async (cb) => cb(new Proxy({}, { get: () => ({ findFirst: async () => null, findMany: async () => [], create: async () => ({}), update: async () => ({}), upsert: async () => ({}) }) }));
}

const REQ = { params: { id: '1' }, body: {}, merchantId: 7, userRole: 'admin', user: { id: 1 } };

const ALBARAN = (extra) => ({
  id: 1, jobId: 1, numero: 'A-2026-0001', fecha: new Date('2026-08-01'),
  estado: 'firmado', modoValoracion: 'SIN_VALORAR', invoiceId: null,
  lineas: [{ concepto: 'Tubo', cantidad: 3, unidad: 'm', quoteLineIndex: 0 }],
  ...extra,
});

// ═══ ⓿ SUELO · las tres puertas tienen que responder DISTINTO ════════════════════════════════

test('SCRUM-895b · SUELO: las tres puertas de 409 se distinguen entre sí', async () => {
  montar({ albaran: ALBARAN({ estado: 'emitido' }) });
  const c = await invocar(REQ);
  montar({ albaran: ALBARAN({ invoiceId: 99 }) });
  const d = await invocar(REQ);
  montar({ albaran: ALBARAN(), facturacionES: false });
  const b = await invocar(REQ);

  for (const [nombre, r] of [['C', c], ['D', d], ['B', b]]) {
    assert.equal(r?.code, 409, `🔴 ESCÁNER CIEGO: la puerta ${nombre} no devolvió 409 sino ${r?.code}. Si no se llega a la puerta, comparar su texto no mide nada.`);
  }
  const errores = new Set([c.body.error, d.body.error, b.body.error]);
  assert.equal(errores.size, 3,
    '🔴 ESCÁNER CIEGO: las tres puertas dan ' + errores.size + ' código(s) distintos: ' +
    JSON.stringify([...errores]) + '. Con menos de tres, un fixture está cayendo en la puerta ' +
    'equivocada y los textos de abajo se comprobarían sobre la respuesta de otro caso.');
});

// ═══ ① LOS TRES FIRMADOS, LITERALES ══════════════════════════════════════════════════════════

test('SCRUM-895b · (A) el rótulo del botón es el literal firmado', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/albaranDetailView.js'), 'utf8');
  const i = src.indexOf('const ROTULOS_ALBARAN');
  assert.ok(i !== -1, '🔴 ESCÁNER CIEGO: no se encuentra `ROTULOS_ALBARAN`.');
  const bloque = src.slice(i, src.indexOf('};', i));
  const m = /btnConvertirFactura:\s*'([^']*)'/.exec(bloque);
  assert.ok(m, '🔴 `btnConvertirFactura` NO tiene rótulo en ROTULOS_ALBARAN: `mk()` cae al respaldo\n' +
    '  `ROTULOS_ALBARAN[id] || MICROCOPY_PENDIENTE` y el botón principal de un albarán firmado\n' +
    '  vuelve a decir «' + MARCADOR + '» en pantalla.');
  assert.equal(m[1], FIRMADO_A,
    '🔴 el rótulo NO es el literal firmado, carácter por carácter (comentario 15699).');
});

test('SCRUM-895b · (C) `albaran_no_firmado` devuelve el literal firmado', async () => {
  montar({ albaran: ALBARAN({ estado: 'emitido' }) });
  const r = await invocar(REQ);
  assert.equal(r.body.error, 'albaran_no_firmado');
  assert.equal(r.body.message, FIRMADO_C,
    '🔴 el mensaje NO es el literal firmado, carácter por carácter (comentario 15699).');
});

test('SCRUM-895b · (D) `albaran_ya_facturado` devuelve el literal firmado', async () => {
  montar({ albaran: ALBARAN({ invoiceId: 99 }) });
  const r = await invocar(REQ);
  assert.equal(r.body.error, 'albaran_ya_facturado');
  assert.equal(r.body.message, FIRMADO_D,
    '🔴 el mensaje NO es el literal firmado, carácter por carácter (comentario 15699).');
});

// ═══ ② LA MITAD QUE SE OLVIDA · (B) SIGUE SIENDO EL MARCADOR ═════════════════════════════════

test('SCRUM-895b · 🔴 (B) `facturacion_no_disponible` SIGUE con el marcador, y es deliberado', async () => {
  montar({ albaran: ALBARAN(), facturacionES: false });
  const r = await invocar(REQ);
  assert.equal(r.body.error, 'facturacion_no_disponible');
  assert.equal(r.body.message, MARCADOR,
    '🔴 ALGUIEN HA ESCRITO AQUÍ UN TEXTO QUE NADIE HA FIRMADO, o ha «arreglado de paso» un\n' +
    '  marcador que se dejó A PROPÓSITO.\n' +
    '\n' +
    '  El fundador PARÓ este texto el 17-sep-2026 (comentario 15699) y no por la redacción: la\n' +
    '  propuesta decía «justificantes de cobro» y el justificante está RETIRADO (SCRUM-825 /\n' +
    '  SCRUM-612 — «solo habrá presupuestos, albaranes, partes y facturas»). Escribirlo metería\n' +
    '  en el producto el nombre de un documento que ya no existe, en un mensaje de error, que es\n' +
    '  lo que la gente lee con atención.\n' +
    '\n' +
    '  Lo que falta no es redactar mejor: es un DATO que hoy no existe — cómo se llama lo que\n' +
    '  emite un merchant ES con la facturación apagada. El día que lo tenga, la frase se escribe\n' +
    '  sola y este test se actualiza con su firma. Hasta entonces el marcador se queda.');
});

// ═══ ③ POBLACIÓN · antes, después, y que la diferencia sea EXACTAMENTE 3 ═════════════════════

/**
 * Medido sobre `origin/main` = `f3ab211d54fb4b04129498985b6a78079cf78448` (17-sep-2026, antes de
 * este ticket): SIETE sitios de estos dos ficheros producían el marcador de cara al usuario.
 *
 *   · 6 usos de `MICROCOPY_PENDIENTE_290` como `message` en `albaranes.routes.ts`
 *   · 1 botón sin rótulo en la vista (`btnConvertirFactura`), que caía al respaldo de `mk()`
 *
 * En la vista el marcador NO es un literal por botón: es un RESPALDO. Por eso un botón sin
 * entrada en `ROTULOS_ALBARAN` cuenta como marcador aunque el fichero no lo escriba — contar
 * literales daría 0 donde el profesional ve 1.
 */
const MARCADORES_ANTES = 7;
const BAJA_ESPERADA = 3; // (A) el botón + (C) y (D) las dos puertas firmadas

/** Los `message: MICROCOPY_PENDIENTE_290` que quedan, sin contar comentarios ni la declaración. */
function usosDelMarcadorEnLaRuta() {
  const src = soloEjecutable(fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/app/routes/albaranes.routes.ts'), 'utf8'));
  const decl = /const\s+MICROCOPY_PENDIENTE_290\s*=/.test(src);
  assert.ok(decl, '🔴 ESCÁNER CIEGO: no está la declaración de `MICROCOPY_PENDIENTE_290`; el recuento no significaría nada.');
  return (src.match(/MICROCOPY_PENDIENTE_290/g) || []).length - 1; // menos la declaración
}

/** Los botones que la vista CREA y que no tienen rótulo: cada uno pinta el marcador. */
function botonesSinRotulo() {
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/albaranDetailView.js'), 'utf8');
  const codigo = soloEjecutable(src);
  const creados = new Set([...codigo.matchAll(/mk\(\s*'([A-Za-z]+)'/g)].map((m) => m[1]));
  assert.ok(creados.size >= 8,
    '🔴 ESCÁNER CIEGO: sólo ' + creados.size + ' botones derivados de `mk(...)`. La vista tiene once;\n' +
    '  si el extractor no los ve, «cero sin rótulo» sería ceguera, no limpieza.');
  const i = codigo.indexOf('const ROTULOS_ALBARAN');
  const bloque = codigo.slice(i, codigo.indexOf('};', i));
  const conRotulo = new Set([...bloque.matchAll(/([A-Za-z]+)\s*:/g)].map((m) => m[1]));
  return [...creados].filter((id) => !conRotulo.has(id));
}

test('SCRUM-895b · POBLACIÓN: 7 marcadores antes, 4 después, la diferencia es exactamente 3', () => {
  const enLaRuta = usosDelMarcadorEnLaRuta();
  const sinRotulo = botonesSinRotulo();
  const ahora = enLaRuta + sinRotulo.length;

  assert.deepEqual(sinRotulo, [],
    '🔴 hay botones que la vista crea sin rótulo, y cada uno pinta «' + MARCADOR + '» en pantalla: ' +
    JSON.stringify(sinRotulo));

  assert.equal(ahora, MARCADORES_ANTES - BAJA_ESPERADA,
    '🔴 la cuenta no cuadra: antes ' + MARCADORES_ANTES + ', ahora ' + ahora + ' (' + enLaRuta +
    ' en la ruta + ' + sinRotulo.length + ' botones sin rótulo). Se esperaban exactamente ' +
    BAJA_ESPERADA + ' de baja: el rótulo del botón y las dos puertas firmadas.\n' +
    '  Si BAJÓ de más, se ha escrito un texto que nadie ha firmado.\n' +
    '  Si SUBIÓ, ha entrado un marcador nuevo por otra puerta.');
});

// ═══ ④ EL EFECTO DE LADO QUE SÍ ERA UN DEFECTO ══════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SCRUM-732b · ESTE GUARD GOBERNABA TODO `jobDetailView.js` PARA DEFENDER UNA SENTENCIA.
//
// Lo escribí yo el 17-sep-2026 y lo cazó mi propio censo (`censo-alcance-vs-sujeto.mjs`) seis
// horas después: `assert.ok(!src.includes('|| primaria.id'))` sobre el fichero entero. Mientras
// nadie escriba ese texto en otra parte, alcance y sujeto coinciden; el día que alguien lo
// escriba legítimamente —otra fila, otro respaldo—, este guard se pone rojo acusando al rótulo
// del albarán de algo que no ha pasado. Y un rojo que nombra el sitio equivocado se apaga.
//
// ⚠️ SE ESTRECHA EL ALCANCE, NO LO QUE EXIGE. Prohíbe EXACTAMENTE lo mismo —que no vuelva el
// respaldo `|| primaria.id` al rótulo del albarán— sólo que mirando donde debe. Es el mismo
// movimiento que SCRUM-587 le hizo a `scrum286`: de `FUENTE` entera a `bloques`.
//
// EL SUJETO, derivado por AST y no por líneas: las sentencias que LEEN `ROTULOS_ALBARAN`. Se
// queda la MÁS INTERNA de cada anidamiento — si no, «la sentencia» sería la función entera y no
// habríamos estrechado nada.
// ─────────────────────────────────────────────────────────────────────────────────────────────

function sentenciasQueLeenRotulos(fuente) {
  const sf = ts.createSourceFile('jobDetailView.js', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const brutas = [];
  const visitar = (n) => {
    if (ts.isStatement(n)) {
      let usa = false;
      const buscar = (x) => { if (ts.isIdentifier(x) && x.text === 'ROTULOS_ALBARAN') usa = true; ts.forEachChild(x, buscar); };
      buscar(n);
      if (usa) brutas.push({ ini: n.getStart(sf), fin: n.getEnd(), texto: n.getText(sf) });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  // La más interna: se descarta la que CONTIENE estrictamente a otra coincidencia.
  return brutas
    .filter((a) => !brutas.some((b) => b !== a && b.ini >= a.ini && b.fin <= a.fin))
    .map((a) => a.texto);
}

test('SCRUM-895b · la fila del Trabajo deja de pintar el identificador crudo', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js'), 'utf8');
  const sujeto = sentenciasQueLeenRotulos(src);

  // SUELO: sin sujeto no hay veredicto. Un «no está» sobre cero sentencias pasaría siempre.
  assert.ok(sujeto.length >= 1,
    '🔴 ESCÁNER CIEGO: no se encuentra ninguna sentencia que lea `ROTULOS_ALBARAN` en\n' +
    '  `jobDetailView.js`. Si la fila dejó de leer la tabla, hay dos fuentes del mismo rótulo y el\n' +
    '  día que una cambie dirán cosas distintas del mismo botón.');

  const texto = sujeto.join('\n');
  assert.ok(texto.includes('ROTULOS_ALBARAN[primaria.id]'),
    '🔴 la fila del Trabajo ya no lee `ROTULOS_ALBARAN[primaria.id]`.');
  // SCRUM-905 (ya en `main`) quitó el respaldo `|| primaria.id` a propósito: sin rótulo firmado la
  // fila no pinta nada, ni el id ni el marcador. Que no haya vuelto es lo que se vigila — y ahora
  // se vigila EN SU SITIO.
  assert.ok(!texto.includes('|| primaria.id'),
    '🔴 ha vuelto el respaldo al identificador crudo (`|| primaria.id`) al rótulo del albarán:\n' +
    '  SCRUM-905 lo quitó a propósito porque sin rótulo firmado no debe pintarse nada.');
});

// ═══ LOS DOS CONTROLES DEL ESTRECHAMIENTO (SCRUM-732b) ══════════════════════════════════════
//
// Se mutan COPIAS EN MEMORIA del fuente real, nunca el árbol.

test('SCRUM-895b · 🔴 ROJO: el respaldo DENTRO del sujeto sigue saltando', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js'), 'utf8');
  const ancla = 'ROTULOS_ALBARAN[primaria.id]';
  assert.equal(src.split(ancla).length - 1, 1,
    '🔴 la mutación no entra: el ancla no aparece exactamente una vez.');
  const mutado = src.replace(ancla, ancla + ' || primaria.id');

  const texto = sentenciasQueLeenRotulos(mutado).join('\n');
  assert.ok(texto.includes('|| primaria.id'),
    '🔴 se ha reintroducido el respaldo EN EL SUJETO y el guard estrechado no lo ve. Entonces el\n' +
    '  estrechamiento no ha estrechado: ha cegado.');
});

test('SCRUM-895b · ✅ EL VERDE QUE DECIDE: el mismo texto FUERA del sujeto ya no acusa', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js'), 'utf8');
  // Una línea legítima en otra parte del fichero, que no tiene nada que ver con el rótulo del
  // albarán. ANTES del estrechamiento esto ponía el guard rojo acusando al rótulo; ahora no.
  const ANCLA = 'const JOBDET_ALB_PILL = ';
  assert.equal(src.split(ANCLA).length - 1, 1,
    '🔴 la mutación no entra: el ancla de inserción no aparece exactamente una vez.');
  const mutado = src.replace(ANCLA, 'const otroRespaldo = x || primaria.id;\n' + ANCLA);
  assert.notEqual(mutado, src, '🔴 la mutación no entró: el ancla de inserción ya no existe.');
  assert.ok(mutado.includes('|| primaria.id'),
    '🔴 la mutación no contiene el texto que se quiere probar.');

  const texto = sentenciasQueLeenRotulos(mutado).join('\n');
  assert.ok(!texto.includes('|| primaria.id'),
    '🔴 EL ESTRECHAMIENTO NO SIRVE: un `|| primaria.id` escrito FUERA del rótulo del albarán\n' +
    '  sigue acusando. Es exactamente el defecto que SCRUM-732 midió — un rojo que nombra el\n' +
    '  sitio equivocado — y es el control que decide si esto se ha arreglado o sólo movido.');
});
