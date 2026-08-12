// tests/scrum491-metodo-y-registro.test.mjs — SCRUM-491
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// SON DOS PREGUNTAS Y UNA SOLA COLUMNA LAS CONTESTABA MAL
//
//   · **MÉTODO** — por dónde entró el dinero. `Charge.method`, o `Invoice.paidVia` desde SCRUM-441.
//   · **REGISTRO** — quién lo apuntó. Que la factura no tenga `Charge` significa que la marcó una
//     persona en el panel.
//
// El informe fabricaba `'manual'` al leer una factura pagada sin `Charge` y lo metía en la columna
// del MÉTODO, donde se pinta «✍️ Marcado a mano». El profesional elegía «Bizum» al marcar el cobro
// —SCRUM-441 lo guarda— y su informe le seguía contestando a una pregunta que no había hecho.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE ESTE FICHERO NO DA POR BUENO
//
//   · **Que exista un campo no prueba que alguien lo lea.** Hay un instrumento de AST que exige
//     que la ruta lo pida en su `select`, y otro que exige que ya no fabrique `'manual'`.
//   · **Que una lista esté vacía no prueba nada.** Todo censo lleva su suelo, y los detectores se
//     autoprueban sobre fuente sintética antes de creerse su número.
//   · **Un cobro que desaparece de una pantalla de dinero es peor que uno mal etiquetado**, así que
//     el control negativo comprueba que la factura SIN método sigue estando, con su importe, y que
//     no se ha colado en el cubo de otro.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const RUTA_INFORMES = 'src/modules/reports/app/routes/reports.routes.ts';
const VISTA_INFORMES = 'public/dashboard/js/reportsView.js';

// ── LAS FUENTES, tal y como corren ───────────────────────────────────────────────────────────
const { etiquetaMetodoCobro } = require_(path.join(RAIZ, 'public/dashboard/js/paidViaEtiquetas.js'));
const { rotuloDeMetodo } = require_(path.join(RAIZ, 'public/dashboard/js/cobrosView.js'));
const { cubosDeMetodo, cuboDeCobro, ROTULO_SIN_METODO, CUBO_SIN_METODO, metodoDeclaradoEnFactura } =
  await import('../dist/modules/billing/domain/metodoDeCobro.js');
// La PUERTA del informe: lo que llama la ruta. Se entra por aquí y no por una pieza suelta.
const { filasDelInforme } = await import('../dist/modules/reports/domain/cobrosPorCubo.js');

const CUBOS = cubosDeMetodo(ROTULO_SIN_METODO);
/** Lo que leería el profesional en COBROS para ese método. */
const enCobros = (valor) => rotuloDeMetodo(valor, cuboDeCobro(valor), CUBOS);
/** Lo que lee el profesional en INFORMES para esa fila (la vista resuelve `etiquetaMetodoCobro(m.method)`). */
const pintada = (fila) => etiquetaMetodoCobro(fila.method);

const conCharge = (metodo, total) => ({ charge: { method: metodo }, total });
const aMano = (paidVia, total) => ({ paidVia, total });

/**
 * EL BANCO: las TRES poblaciones que llegan de verdad al informe, y hacen falta las tres.
 *
 *   ① cobros con `Charge` — la pasarela dijo cómo entró el dinero
 *   ② facturas marcadas a mano CON método declarado — SCRUM-441
 *   ③ facturas marcadas a mano SIN método — las históricas, y las que se marcan sin elegir
 */
const CON_CHARGE = [conCharge('card', '100.00'), conCharge('card:stripe', '50.00')];
const A_MANO_CON_METODO = [aMano('transfer', '300.00'), aMano('bizum_manual', '40.00')];
const A_MANO_SIN_METODO = [aMano(null, '25.00'), aMano('', '15.00'), aMano(undefined, '10.00')];
const BANCO = [...CON_CHARGE, ...A_MANO_CON_METODO, ...A_MANO_SIN_METODO];

const centimos = (n) => Math.round(n * 100);
const sumaEur = (facturas) => facturas.reduce((a, f) => a + centimos(Number(f.total)), 0);

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO — va primero: un cero aquí tiene que salir por una línea distinta de «no hay defecto»
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-491 · SUELO: el banco trae las TRES poblaciones, y ninguna está vacía', () => {
  assert.ok(CON_CHARGE.length >= 2,
    '🔴 ESCÁNER CIEGO: sin cobros con `Charge` no se puede comprobar que ésos NO cambian.');
  assert.ok(A_MANO_CON_METODO.length >= 2,
    '🔴 ESCÁNER CIEGO: el censo de facturas CON `paidVia` está vacío. Con cero, «el método sale de ' +
    '`Invoice.paidVia`» sería trivialmente cierto y este fichero no mediría nada.');
  assert.ok(A_MANO_SIN_METODO.length >= 3,
    '🔴 ESCÁNER CIEGO: sin facturas marcadas a mano SIN método no se puede comprobar lo que más ' +
    'importa: que no desaparecen ni se cuelan en otro cubo.');

  // Control positivo del instrumento: el reparto que corre produce filas de verdad.
  const { byMethod, marcadosAMano } = filasDelInforme(BANCO);
  assert.ok(byMethod.length >= 3, `🔴 el reparto devuelve ${byMethod.length} filas sobre ${BANCO.length} facturas.`);
  assert.equal(marcadosAMano.count, A_MANO_CON_METODO.length + A_MANO_SIN_METODO.length);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① INSTRUMENTO A · el AST de la RUTA — mencionar no es hacer
// ═════════════════════════════════════════════════════════════════════════════════════════

/** ¿Hay un `select` que pida `paidVia` JUNTO A `charge`? Es la consulta del informe, no otra. */
function selectPideMetodoYCharge(codigo) {
  const sf = ts.createSourceFile('x.ts', codigo, ts.ScriptTarget.Latest, true);
  let visto = false;
  (function rec(n) {
    if (ts.isObjectLiteralExpression(n)) {
      let paidVia = false;
      let charge = false;
      for (const p of n.properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        const nombre = p.name.getText(sf);
        if (nombre === 'paidVia' && p.initializer.kind === ts.SyntaxKind.TrueKeyword) paidVia = true;
        if (nombre === 'charge') charge = true;
      }
      if (paidVia && charge) visto = true;
    }
    ts.forEachChild(n, rec);
  })(sf);
  return visto;
}

/** ¿Se sigue fabricando el `'manual'` al leer? Literal de cadena en el fuente, sin comentarios. */
function fabricaManual(codigo) {
  const sf = ts.createSourceFile('x.ts', codigo, ts.ScriptTarget.Latest, true);
  const sitios = [];
  (function rec(n) {
    if (ts.isStringLiteral(n) && n.text === 'manual') sitios.push(n.getText(sf));
    ts.forEachChild(n, rec);
  })(sf);
  return sitios;
}

test('SCRUM-491 · ① SUELO + AUTOPRUEBA: los dos detectores de la ruta ven y DISCRIMINAN', () => {
  // Sin esto, «la ruta ya lee la columna» y «el detector se ha quedado ciego» dan el mismo verde.
  assert.equal(selectPideMetodoYCharge('const q = { select: { paidVia: true, charge: { select: { method: true } } } };'), true,
    '🔴 el detector no ve un `select` que pide las dos cosas escrito delante de sus narices.');
  assert.equal(selectPideMetodoYCharge('const q = { select: { total: true, charge: true } };'), false,
    '🔴 el detector da por bueno un `select` que NO pide `paidVia`.');
  assert.equal(selectPideMetodoYCharge('const q = { select: { paidVia: false, charge: true } };'), false,
    '🔴 el detector no distingue `paidVia: true` de `paidVia: false`.');

  assert.deepEqual(fabricaManual("const m = inv.charge?.method || 'manual';"), ["'manual'"],
    '🔴 el detector no ve el `manual` fabricado.');
  assert.deepEqual(fabricaManual('const m = inv.charge?.method; // manual'), [],
    '🔴 el detector marca la palabra dentro de un comentario: mediría prosa, no código.');
});

test('SCRUM-491 · ① 🔴 la ruta PIDE `Invoice.paidVia`, y ya no fabrica el `manual` al leer', () => {
  const codigo = fs.readFileSync(path.join(RAIZ, RUTA_INFORMES), 'utf8');

  assert.equal(selectPideMetodoYCharge(codigo), true,
    `🔴 ${RUTA_INFORMES} no pide \`paidVia\` en el \`select\` de las facturas cobradas. Sin esa ` +
    'línea el dato se ESCRIBE y no lo lee nadie: el profesional elige «Bizum» al marcar el cobro y ' +
    'su informe no se entera. Que la columna exista no prueba que la pantalla la lea.');

  assert.deepEqual(fabricaManual(codigo), [],
    '🔴 LA RUTA VUELVE A FABRICAR `manual`, y eso es AFIRMAR CÓMO SE REGISTRÓ EL COBRO —lo marcó ' +
    'una persona— EN LA COLUMNA DONDE VA POR DÓNDE ENTRÓ EL DINERO. No es que falte un campo: es ' +
    'que se está contestando otra pregunta. El método sale de `Charge.method` o de ' +
    '`Invoice.paidVia`; el registro se cuenta aparte, en `marcadosAMano`.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② CONTROL POSITIVO · el método declarado LLEGA, y las dos pantallas lo cuentan igual
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-491 · ② CONTROL POSITIVO: `paidVia = transfer` se lee «transferencia» en las DOS pantallas', () => {
  const { byMethod } = filasDelInforme([aMano('transfer', '300.00')]);
  assert.equal(byMethod.length, 1, '🔴 una factura, una fila.');
  const fila = byMethod[0];

  assert.equal(fila.eur, 300, '🔴 el importe no ha llegado entero a su fila.');
  assert.equal(pintada(fila), '🏦 Transferencia',
    `🔴 INFORMES pinta «${pintada(fila)}» para una factura que el profesional declaró como ` +
    'transferencia. El dato está guardado y la pantalla no lo dice.');
  assert.equal(enCobros('transfer'), 'transferencia',
    '🔴 COBROS ha dejado de leer «transferencia» para el mismo valor.');
  // 🔴 Y LO QUE DE VERDAD TIENE QUE COINCIDIR: el CUBO. El rótulo puede decorarse distinto en cada
  // pantalla —Informes cuenta familias y Cobros cobros individuales, SCRUM-488— pero el cubo NO:
  // si divergiera, el filtro y el informe contarían cosas distintas del mismo cobro.
  assert.equal(fila.cubo, cuboDeCobro('transfer'),
    '🔴 el informe mete la transferencia declarada en un cubo distinto del que usa el filtro de Cobros.');
  assert.equal(fila.cubo, 'transfer');
});

test('SCRUM-491 · ② el método declarado cae en el MISMO cubo que el filtro, para TODO el conjunto', () => {
  // Uno por uno sobre el conjunto cerrado: un bucle sobre una muestra no cazaría el valor que se
  // desvía el día que alguien añada uno.
  for (const via of ['card', 'bizum_auto', 'bizum_manual', 'transfer', 'cash']) {
    const [fila] = filasDelInforme([aMano(via, '10.00')]).byMethod;
    assert.equal(fila.cubo, cuboDeCobro(via),
      `🔴 «${via}» declarado en la factura cae en «${fila.cubo}» y el filtro de Cobros lo pone en ` +
      `«${cuboDeCobro(via)}». Dos pantallas contando el mismo cobro en sitios distintos.`);
    assert.notEqual(fila.cubo, CUBO_SIN_METODO,
      `🔴 «${via}» declarado acaba en «no consta»: el dato se lee y luego se tira.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ 🔴 CONTROL NEGATIVO · el que protege el dinero
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-491 · ③ 🔴 una factura marcada a mano SIN método NO desaparece y NO se cuela en otro cubo', () => {
  const { byMethod } = filasDelInforme(A_MANO_SIN_METODO);

  // ① NO DESAPARECE. Ni un euro ni un cobro se quedan por el camino.
  assert.equal(byMethod.reduce((a, f) => a + f.count, 0), A_MANO_SIN_METODO.length,
    '🔴 SE HAN PERDIDO COBROS. Un cobro que desaparece de una pantalla de dinero es peor que uno ' +
    'mal etiquetado: el profesional no puede echar de menos lo que no ve.');
  assert.equal(byMethod.reduce((a, f) => a + centimos(f.eur), 0), sumaEur(A_MANO_SIN_METODO),
    '🔴 el importe de los cobros sin método no cuadra con lo que entró.');

  // ② NO SE CUELA EN OTRO CUBO. `null`, `''` y ausente son la MISMA ausencia y van juntos.
  assert.equal(byMethod.length, 1,
    `🔴 las tres formas de «no consta» salen en ${byMethod.length} filas distintas. «» y \`null\` ` +
    'significan lo mismo y divergen en cuanto alguien filtre por una de ellas.');
  assert.equal(byMethod[0].cubo, CUBO_SIN_METODO,
    `🔴 una factura sin método ha caído en el cubo «${byMethod[0].cubo}»: se le está atribuyendo ` +
    'una forma de cobro que nadie ha declarado.');

  // ③ Y LO DICE. El rótulo existe desde SCRUM-398 y no se inventa ninguno nuevo.
  assert.match(pintada(byMethod[0]), /sin método/i,
    `🔴 el cobro sin método se pinta «${pintada(byMethod[0])}»: tiene que DECIR que no consta.`);
});

test('SCRUM-491 · ③ 🔴 SIN BACKFILL: a una factura histórica no se le inventa un método', () => {
  // La columna llegó con SCRUM-441; lo marcado antes no tiene el dato. Rellenarlo con «suele ser
  // transferencia» es exactamente el bug que `paidVia.ts` cierra.
  const [fila] = filasDelInforme([aMano(null, '25.00')]).byMethod;
  assert.equal(fila.cubo, CUBO_SIN_METODO);
  assert.equal(metodoDeclaradoEnFactura(null), null, '🔴 `null` ha dejado de ser «no consta».');
  assert.equal(metodoDeclaradoEnFactura(''), null,
    '🔴 la cadena vacía se cuela como método. `??` solo cubre `null` y `undefined`.');
  assert.equal(metodoDeclaradoEnFactura('   '), null, '🔴 los espacios en blanco pasan por método.');
  assert.equal(metodoDeclaradoEnFactura('transfer'), 'transfer');

  // Y no adopta el de la factura de al lado: dos facturas, dos destinos.
  const { byMethod } = filasDelInforme([aMano('transfer', '300.00'), aMano(null, '25.00')]);
  assert.deepEqual(byMethod.map((f) => [f.cubo, f.eur]).sort(), [[CUBO_SIN_METODO, 25], ['transfer', 300]],
    '🔴 la factura sin método se ha contagiado del método de otra.');
});

test('SCRUM-491 · ③ `Charge.method` MANDA sobre `Invoice.paidVia` cuando están los dos', () => {
  // No es un empate: uno lo confirma un WEBHOOK y el otro lo dice una persona (`paidVia.ts:17`).
  // Ante una inspección son dos cadenas de evidencia distintas, y gana el hecho consumado.
  const [fila] = filasDelInforme([{ charge: { method: 'card' }, paidVia: 'cash', total: '80.00' }]).byMethod;
  assert.equal(fila.cubo, 'card',
    `🔴 la factura se cuenta como «${fila.cubo}»: lo que dijo una persona ha pisado lo que confirmó ` +
    'la pasarela.');
  // Y el reverso, que es el caso de todos los días: un `Charge` en blanco no bloquea lo declarado.
  const [caido] = filasDelInforme([{ charge: { method: '' }, paidVia: 'cash', total: '80.00' }]).byMethod;
  assert.equal(caido.cubo, 'cash',
    '🔴 un `Charge.method` en blanco impide leer el método declarado: el dato existe y se tira.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ EL INVARIANTE · leer un campo nuevo mueve etiquetas, NUNCA dinero
// ═════════════════════════════════════════════════════════════════════════════════════════

/** La lectura de AYER, escrita aquí para poder enseñar el ANTES. Réplica declarada, no código vivo. */
function comoAntes(facturas) {
  const m = new Map();
  for (const f of facturas) {
    const metodo = f.charge?.method || 'manual';
    const cur = m.get(metodo) ?? { centimos: 0, count: 0 };
    cur.centimos += centimos(Number(f.total));
    cur.count += 1;
    m.set(metodo, cur);
  }
  return [...m.entries()].map(([method, v]) => ({ method, eur: v.centimos / 100, count: v.count }));
}

test('SCRUM-491 · ④ 🔴 EL INVARIANTE: total del informe y nº de cobros IDÉNTICOS antes y después', () => {
  const antes = comoAntes(BANCO);
  const { byMethod: despues } = filasDelInforme(BANCO);

  // Control positivo dentro: con el banco vacío, las dos sumas serían 0 y esto pasaría sin medir.
  assert.ok(antes.length >= 3 && despues.length >= 3,
    `🔴 el banco produce ${antes.length}/${despues.length} filas: no se está midiendo nada.`);

  assert.equal(
    despues.reduce((a, f) => a + centimos(f.eur), 0),
    antes.reduce((a, f) => a + centimos(f.eur), 0),
    '🔴 EL TOTAL DEL INFORME HA CAMBIADO al leer `paidVia`. Leer un campo nuevo reetiqueta filas; ' +
    'si además mueve dinero, lo que ha cambiado no es la lectura sino la cuenta.');
  assert.equal(despues.reduce((a, f) => a + f.count, 0), antes.reduce((a, f) => a + f.count, 0));
  assert.equal(despues.reduce((a, f) => a + f.count, 0), BANCO.length);
  assert.equal(despues.reduce((a, f) => a + centimos(f.eur), 0), sumaEur(BANCO));

  // Y LO QUE SÍ CAMBIA, dicho: la fila del registro se deshace en los métodos declarados.
  const antesAMano = antes.find((f) => f.method === 'manual');
  assert.equal(antesAMano.count, A_MANO_CON_METODO.length + A_MANO_SIN_METODO.length,
    '🔴 el ANTES ya no reproduce lo que hacía la ruta: re-mide antes de fiarte de la tabla.');
  assert.equal(despues.some((f) => f.method === 'manual'), false,
    '🔴 sigue habiendo una fila `manual` DESPUÉS: es el defecto entero de este ticket.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ EL REGISTRO · no ocupa la columna del método, y NO se ha borrado
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-491 · ⑤ 🔴 ninguna fila del método dice cómo se REGISTRÓ el cobro', () => {
  const { byMethod } = filasDelInforme(BANCO);
  const registro = byMethod.filter((f) => /marcado a mano/i.test(pintada(f)));
  assert.deepEqual(registro, [],
    '🔴 LA COLUMNA DEL MÉTODO ESTÁ AFIRMANDO CÓMO SE REGISTRÓ EL COBRO. «Marcado a mano» contesta ' +
    'quién lo apuntó, no por dónde entró el dinero: el profesional que eligió «Bizum» al marcar la ' +
    'factura ve su informe contestándole otra pregunta. Filas pintadas hoy:\n' +
    byMethod.map((f) => `    ${(f.method || '(no consta)').padEnd(18)} «${pintada(f)}»`).join('\n'));
});

test('SCRUM-491 · ⑤ el registro NO se borra: se cuenta aparte, con su importe', () => {
  // 🔴 Es un hecho REAL y útil —qué parte de la caja no pasó por ninguna pasarela— y borrarlo para
  // simplificar sería perder un dato que hoy sí está. Viaja contado hasta que el asesor decida
  // dónde se enseña (regla 30).
  const { marcadosAMano } = filasDelInforme(BANCO);
  const esperadas = [...A_MANO_CON_METODO, ...A_MANO_SIN_METODO];
  assert.equal(marcadosAMano.count, esperadas.length,
    '🔴 el recuento de cobros apuntados por una persona no cuadra con las facturas sin `Charge`.');
  assert.equal(centimos(marcadosAMano.eur), sumaEur(esperadas),
    '🔴 el importe de lo marcado a mano no cuadra.');

  // Control positivo del recuento: si TODO tuviera `Charge`, tiene que dar cero — y ese cero es
  // una medición, no un fallo del instrumento.
  const soloPasarela = filasDelInforme(CON_CHARGE).marcadosAMano;
  assert.deepEqual([soloPasarela.count, soloPasarela.eur], [0, 0],
    '🔴 se cuentan como «marcados a mano» cobros que trajo una pasarela.');
  // Y el reverso: si NADA tiene `Charge`, son todos.
  assert.equal(filasDelInforme(esperadas).marcadosAMano.count, esperadas.length);
});

test('SCRUM-491 · ⑤ 🔴 STOP declarado: la vista NO pinta `marcadosAMano` — el texto lo aprueba el asesor', () => {
  // DÓNDE se le enseña al profesional que un cobro lo apuntó una persona es microcopy (regla 30).
  // Este guard existe para que ese hueco no se rellene de camino: si alguien lo pinta, que sea con
  // el texto aprobado y borrando esta línea a sabiendas, no sin enterarse.
  const vista = fs.readFileSync(path.join(RAIZ, VISTA_INFORMES), 'utf8');
  assert.doesNotMatch(vista, /marcadosAMano/,
    `🔴 ${VISTA_INFORMES} ha empezado a pintar \`marcadosAMano\`. El dato viaja a propósito y sin ` +
    'pintar: el rótulo con el que se le enseña al profesional lo aprueba el asesor (regla 30). ' +
    'Si ya está aprobado, quita este guard EN EL MISMO COMMIT y deja dicho quién lo aprobó.');
  // Control positivo del instrumento: la regex casa cuando el patrón está de verdad.
  assert.match('<span>${d.marcadosAMano.count}</span>', /marcadosAMano/);
});
