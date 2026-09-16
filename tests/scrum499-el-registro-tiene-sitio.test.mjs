// tests/scrum499-el-registro-tiene-sitio.test.mjs — SCRUM-499
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS HUECOS QUE SCRUM-491 DEJÓ DECLARADOS, CERRADOS
//
//   · **HUECO 1 · el registro tiene sitio.** SCRUM-491 sacó «marcado a mano» de la columna del
//     MÉTODO —donde contestaba otra pregunta— y lo dejó viajando en la respuesta SIN PINTAR, a la
//     espera de que el asesor decidiera dónde va. Ya está decidido: un PIE bajo la lista, con la
//     microcopy aprobada. Va en un pie y no en una fila porque es una propiedad del CONJUNTO: sus
//     euros YA están repartidos entre las filas de arriba, y una fila más los contaría dos veces.
//   · **HUECO 2 · la tercera pantalla.** El paquete de evidencia de disputa pintaba
//     `invoice.charge?.method ?? 'manual'`: el mismo defecto, en el documento que se le manda a un
//     banco. Ahora lee por el mismo sitio que las otras dos.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 «DEL MISMO SITIO», Y ESO SE MIDE
//
// Que tres pantallas den el mismo resultado hoy no prueba que lean de un solo sitio: prueba que
// tres funciones parecidas coinciden. Lo que se comprueba aquí es que **las tres llaman a
// `metodoDeUnCobro`** —por AST, con su autoprueba— y que la copia privada que había en
// `cobros.service.ts` ya no existe. Dos funciones iguales no fallan el día que se escriben: fallan
// el día que alguien arregla una.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);

const VISTA = 'public/dashboard/js/reportsView.js';
const RUTA_INFORMES = 'src/modules/reports/app/routes/reports.routes.ts';
const DOMINIO_INFORMES = 'src/modules/reports/domain/cobrosPorCubo.ts';
const SERVICIO_COBROS = 'src/modules/billing/domain/cobros.service.ts';
const RUTA_DISPUTA = 'src/modules/system/app/routes/invoicesAdmin.routes.ts';

/**
 * LAS TRES PANTALLAS QUE CONTESTAN «¿POR DÓNDE ENTRÓ EL DINERO?».
 *
 * Se declaran aquí con su nombre humano porque el mensaje del guard tiene que poder decir CUÁL se
 * ha soltado, no «alguna».
 */
const PANTALLAS = [
  { que: 'Cobros', fichero: SERVICIO_COBROS },
  { que: 'Informes', fichero: DOMINIO_INFORMES },
  { que: 'el paquete de evidencia de disputa', fichero: RUTA_DISPUTA },
];

/**
 * EL CAMINO DEL PIE, ENTERO. Son TRES ficheros y hace falta que estén los tres: el dominio lo
 * CUENTA, la ruta lo DEVUELVE y la vista lo PINTA. Si falta cualquiera, el registro deja de
 * constar — y con el detector atado a un solo fichero, dos de esos tres fallos pasarían en verde.
 * Es la lección que dejó medida la mutación A de SCRUM-491.
 */
const CAMINO_DEL_PIE = [
  { paso: 'lo CUENTA', fichero: DOMINIO_INFORMES, patron: /marcadosAMano/ },
  { paso: 'lo DEVUELVE', fichero: RUTA_INFORMES, patron: /marcadosAMano/ },
  { paso: 'lo PINTA', fichero: VISTA, patron: /pieDeMarcadosAMano\(d\.marcadosAMano/ },
];

// ── LAS FUENTES, tal y como corren ───────────────────────────────────────────────────────────
const { pieDeMarcadosAMano } = require_(path.join(RAIZ, VISTA));
const { etiquetaMetodoCobro } = require_(path.join(RAIZ, 'public/dashboard/js/paidViaEtiquetas.js'));
const { metodoDeUnCobro, cuboDeCobro, CUBO_SIN_METODO, ROTULO_SIN_METODO } =
  await import('../dist/modules/billing/domain/metodoDeCobro.js');
const { filasDelInforme } = await import('../dist/modules/reports/domain/cobrosPorCubo.js');
const { fundirCobros } = await import('../dist/modules/billing/domain/cobros.service.js');

/** El formateador se pasa por parámetro: espejo de `fmtMoneyEs` (`api.js:475`), sin navegador. */
const fmtMoney = (n) => new Intl.NumberFormat('es-ES',
  { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })
  .format(Number(n));

const factura = (paidVia, total, id = 1) => ({
  id, createdAt: new Date('2026-08-12T10:00:00Z'), total, currency: 'EUR', status: 'paid',
  number: `F-${id}`, paidVia,
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO — va primero: un cero tiene que salir por una línea distinta de «no hay defecto»
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-499 · SUELO: se leen las tres pantallas, el camino del pie y la función que pinta', () => {
  assert.equal(typeof pieDeMarcadosAMano, 'function',
    `🔴 ESCÁNER CIEGO: ${VISTA} no exporta el pie. Sin él, lo de abajo comprobaría una regex sobre ` +
    'el fuente en vez de lo que se pinta.');
  assert.ok(PANTALLAS.length >= 3, `🔴 solo se vigilan ${PANTALLAS.length} pantallas.`);
  assert.ok(CAMINO_DEL_PIE.length >= 3, `🔴 el camino del pie declara ${CAMINO_DEL_PIE.length} pasos.`);
  for (const { fichero } of [...PANTALLAS, ...CAMINO_DEL_PIE]) {
    assert.ok(fs.existsSync(path.join(RAIZ, fichero)), `🔴 ESCÁNER CIEGO: no existe ${fichero}.`);
  }
  // Control positivo del instrumento: el pie devuelve algo cuando hay algo que decir. Si siempre
  // devolviera cadena vacía, «con cero no se pinta» sería trivialmente cierto.
  assert.notEqual(pieDeMarcadosAMano({ count: 3, eur: 900 }, fmtMoney), '');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① HUECO 1 · EL PIE — la microcopy aprobada, ejercida sobre la función que corre
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * El texto del pie sin el envoltorio, que es lo que lee el profesional.
 *
 * 🔸 El ` ` se normaliza a espacio: `fmtMoneyEs` usa `Intl` con `style: 'currency'`, que mete
 * un ESPACIO DURO antes del «€». No es del microcopy —es del formateador de dinero de la casa, el
 * mismo en toda la app— y escribirlo invisible en la expectativa haría el literal ilegible. Que
 * está ahí se comprueba aparte, abajo, en vez de darlo por hecho.
 */
const textoDelPie = (ma) => pieDeMarcadosAMano(ma, fmtMoney).replace(/<[^>]*>/g, '').replace(/ /g, ' ');

test('SCRUM-499 · ① 🔴 el pie dice la microcopy APROBADA, literal, en singular y en plural', () => {
  // Aprobada por el asesor (regla 30) y copiada aquí carácter a carácter a propósito: si alguien la
  // «mejora», este test cae. El microcopy no se adorna ni se traduce.
  assert.match(pieDeMarcadosAMano({ count: 3, eur: 900 }, fmtMoney), /900,00 €/,
    '🔴 el importe del pie ha dejado de salir por el formateador de dinero de la casa (el espacio ' +
    'duro antes del «€» es suyo). Un importe formateado a mano diverge del resto de la pantalla.');
  assert.equal(textoDelPie({ count: 3, eur: 900 }), 'Marcados a mano: 3 cobros · 900,00 €',
    `🔴 el pie dice «${textoDelPie({ count: 3, eur: 900 })}» y el texto aprobado es otro.`);
  assert.equal(textoDelPie({ count: 1, eur: 100 }), 'Marcado a mano: 1 cobro · 100,00 €',
    '🔴 el singular no está: «1 cobros» es de las cosas que hacen que un producto parezca barato.');
  assert.equal(textoDelPie({ count: 2, eur: 1234.5 }), 'Marcados a mano: 2 cobros · 1.234,50 €',
    '🔴 el importe del pie no sale con el formato de dinero de la casa.');
});

test('SCRUM-499 · ① 🔴 CON CERO EL PIE NO SE PINTA — y «no aparece» no es «no se pinta nunca»', () => {
  // Mismo criterio que la celda vacía de Cobros (SCRUM-285): un hecho que no existe no ocupa sitio
  // hablando de sí mismo. Y son DOS comprobaciones distintas: que con cero no salga, y que con
  // datos SÍ salga — sin la segunda, un pie roto pasaría por «bien, con cero no se pinta».
  assert.equal(pieDeMarcadosAMano({ count: 0, eur: 0 }, fmtMoney), '',
    '🔴 con cero cobros marcados a mano el pie se pinta igual, diciendo «0 cobros».');
  assert.equal(pieDeMarcadosAMano(undefined, fmtMoney), '',
    '🔴 un servidor que todavía no manda `marcadosAMano` hace que la pantalla invente un «0 cobros».');
  assert.equal(pieDeMarcadosAMano({}, fmtMoney), '');
  assert.equal(pieDeMarcadosAMano({ count: null, eur: 0 }, fmtMoney), '');
  // Y el control positivo, en el mismo test: con datos, se pinta.
  assert.match(pieDeMarcadosAMano({ count: 1, eur: 1 }, fmtMoney), /Marcado a mano/,
    '🔴 el pie NO SE PINTA NUNCA. «No aparece con cero» y «no aparece jamás» dan el mismo verde si ' +
    'nadie los separa, y el segundo es el hueco de SCRUM-491 sin cerrar.');
});

test('SCRUM-499 · ① 🔴 el pie NO es una fila: sus euros ya están repartidos ahí arriba', () => {
  // Lo que protege el dinero en esta pantalla. Los cobros marcados a mano YA cuentan en las filas
  // de método (por su `paidVia`, o en «sin método»). Si el pie fuese una fila más, el profesional
  // sumaría la columna y le saldría de más.
  const pie = pieDeMarcadosAMano({ count: 3, eur: 900 }, fmtMoney);
  assert.match(pie, /^<p/, '🔴 el pie ha dejado de ser un párrafo suelto.');
  assert.doesNotMatch(pie, /width:150px|background:var\(--green-600\)/,
    '🔴 el pie ha adoptado la forma de una FILA del informe (caja de etiqueta o barra). Ahí se lee ' +
    'como un método más y su importe se cuenta dos veces.');

  // Y la comprobación con los números delante: el total de las filas NO incluye el pie aparte.
  const banco = [
    { charge: { method: 'card' }, total: '100.00' },
    factura('transfer', '300.00', 2),
    factura(null, '25.00', 3),
  ];
  const { byMethod, marcadosAMano } = filasDelInforme(banco);
  const totalFilas = byMethod.reduce((a, f) => a + Math.round(f.eur * 100), 0);
  assert.equal(totalFilas, 42500,
    '🔴 el total de las filas ha cambiado: re-mide antes de fiarte de lo de abajo.');
  assert.equal(Math.round(marcadosAMano.eur * 100), 32500,
    '🔴 el pie no cuenta lo que dice contar.');
  assert.ok(Math.round(marcadosAMano.eur * 100) < totalFilas,
    '🔴 el importe del pie NO es un subconjunto del total: o cuenta cobros que no están en las ' +
    'filas, o el total ha dejado de incluirlos.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② 🔴 ROJO POR EL MECANISMO — el camino del pie, ENTERO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-499 · ② SUELO + AUTOPRUEBA del detector del camino del pie', () => {
  // 🔴 SCRUM-491 midió que un escáner atado a la ruta deja pasar una mutación en el dominio: ocho
  // tests de comportamiento caídos y el AST en verde. Aquí el detector recorre los TRES pasos, y
  // primero se demuestra que sabe decir que NO.
  const ve = (texto, patron) => patron.test(texto);
  assert.equal(ve('const x = 1;', /marcadosAMano/), false,
    '🔴 el detector marca un fuente que no nombra el registro.');
  assert.equal(ve('return { byMethod, marcadosAMano };', /marcadosAMano/), true,
    '🔴 el detector no ve el registro escrito delante de sus narices.');
  assert.equal(ve('pieDeMarcadosAMano(otraCosa, fmtMoneyEs)', /pieDeMarcadosAMano\(d\.marcadosAMano/), false,
    '🔴 el detector da por bueno un pie alimentado con otra cosa.');
});

test('SCRUM-499 · ② 🔴 los TRES pasos del camino del pie siguen ahí, y el guard dice CUÁL falta', () => {
  const rotos = CAMINO_DEL_PIE
    .filter(({ fichero, patron }) => !patron.test(fs.readFileSync(path.join(RAIZ, fichero), 'utf8')))
    .map(({ paso, fichero }) => `${fichero} (${paso})`);
  assert.deepEqual(rotos, [],
    '🔴 EL REGISTRO HA DEJADO DE CONSTAR: se ha roto un paso del camino y el pie no llega a la ' +
    `pantalla → ${rotos.join(' · ')}.\n` +
    '  Cuántos cobros apuntó una PERSONA en vez de una pasarela es un hecho real y útil, y hasta\n' +
    '  SCRUM-491 se enseñaba en el sitio equivocado —la columna del método—. Quitarlo del pie no lo\n' +
    '  devuelve a su sitio: lo borra de la pantalla.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ HUECO 2 · LAS TRES PANTALLAS, DEL MISMO SITIO (no «parecido»)
// ═════════════════════════════════════════════════════════════════════════════════════════

/** ¿Este fichero LLAMA a `metodoDeUnCobro`? Del AST, no del texto: un import sin uso no vale. */
function llamaAlaLecturaUnica(codigo, nombreFichero) {
  const sf = ts.createSourceFile(nombreFichero, codigo, ts.ScriptTarget.Latest, true);
  let llama = false;
  (function rec(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)
      && n.expression.text === 'metodoDeUnCobro') llama = true;
    ts.forEachChild(n, rec);
  })(sf);
  return llama;
}

/** ¿Vuelve a haber una copia privada de la normalización? */
function declaraMetodoDeclarado(codigo, nombreFichero) {
  const sf = ts.createSourceFile(nombreFichero, codigo, ts.ScriptTarget.Latest, true);
  let declara = false;
  (function rec(n) {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'metodoDeclarado') declara = true;
    ts.forEachChild(n, rec);
  })(sf);
  return declara;
}

test('SCRUM-499 · ③ SUELO + AUTOPRUEBA de los dos detectores del AST', () => {
  assert.equal(llamaAlaLecturaUnica('const m = metodoDeUnCobro(inv);', 'x.ts'), true,
    '🔴 el detector no ve la llamada escrita delante de sus narices.');
  assert.equal(llamaAlaLecturaUnica("import { metodoDeUnCobro } from './x';", 'x.ts'), false,
    '🔴 el detector da por buena una IMPORTACIÓN sin llamada: mencionar no es hacer.');
  assert.equal(llamaAlaLecturaUnica('const m = otraLectura(inv);', 'x.ts'), false);
  assert.equal(declaraMetodoDeclarado('function metodoDeclarado(v) { return v; }', 'x.ts'), true,
    '🔴 el detector de copias no ve una copia escrita delante de sus narices.');
  assert.equal(declaraMetodoDeclarado('const metodoDeclaradoEnFactura = 1;', 'x.ts'), false,
    '🔴 el detector confunde la función compartida con la copia privada.');
});

test('SCRUM-499 · ③ 🔴 las TRES pantallas leen el método por `metodoDeUnCobro`, y la copia ya no existe', () => {
  const sinCablear = PANTALLAS
    .filter(({ fichero }) => !llamaAlaLecturaUnica(fs.readFileSync(path.join(RAIZ, fichero), 'utf8'), fichero))
    .map(({ que, fichero }) => `${que} (${fichero})`);
  assert.deepEqual(sinCablear, [],
    `🔴 HAY UNA PANTALLA QUE LEE EL MÉTODO POR SU CUENTA: ${sinCablear.join(' · ')}.\n` +
    '  Que hoy dé el mismo resultado no prueba que lea de un solo sitio: prueba que dos funciones\n' +
    '  parecidas coinciden. Y una de las tres es el documento que se le manda a un BANCO en una\n' +
    '  disputa: que diga algo distinto de lo que ve el profesional en su panel es lo que convierte\n' +
    '  una disputa ganada en una perdida.');

  assert.equal(declaraMetodoDeclarado(fs.readFileSync(path.join(RAIZ, SERVICIO_COBROS), 'utf8'), SERVICIO_COBROS), false,
    '🔴 ha vuelto la copia privada `metodoDeclarado` a `cobros.service.ts`. Era idéntica a la ' +
    'compartida y por eso se retiró: dos funciones iguales no fallan el día que se escriben, ' +
    'fallan el día que alguien arregla una.');

  // Y la tercera pantalla ya no fabrica el registro en la columna del método.
  const disputa = fs.readFileSync(path.join(RAIZ, RUTA_DISPUTA), 'utf8');
  assert.doesNotMatch(disputa, /charge\?\.method \?\? 'manual'/,
    '🔴 el paquete de disputa vuelve a pintar `manual` como método: eso es AFIRMAR CÓMO SE ' +
    'REGISTRÓ el cobro en el sitio donde el banco lee POR DÓNDE ENTRÓ EL DINERO.');
});

test('SCRUM-499 · ③ 🔴 CONTROL POSITIVO: el mismo `paidVia` se lee IGUAL en las tres', () => {
  // Ejercido con las funciones que corren, cada pantalla por su puerta.
  const f = factura('transfer', '300.00');

  // ① INFORMES — la fila que viaja a la pantalla.
  const [fila] = filasDelInforme([f]).byMethod;
  // ② COBROS — la fusión de verdad, la que alimenta la tabla.
  const [cobro] = fundirCobros({ charges: [], candidatas: [f], invoiced: [] });
  // ③ EL PAQUETE DE DISPUTA — la cadena que se pinta en el HTML.
  const enDisputa = metodoDeUnCobro(f) ?? ROTULO_SIN_METODO;

  assert.equal(cobro.metodo, 'transfer', '🔴 COBROS ya no lee el método declarado.');
  assert.equal(enDisputa, 'transfer', '🔴 el paquete de disputa no lee el método declarado.');
  assert.equal(fila.cubo, 'transfer', '🔴 INFORMES no clasifica el método declarado.');

  // 🔴 Y LO QUE DE VERDAD TIENE QUE COINCIDIR: el CUBO. El rótulo puede decorarse distinto en cada
  // pantalla —Informes cuenta familias, Cobros cobros individuales (SCRUM-488)— pero el cubo no.
  assert.equal(cobro.metodoCubo, fila.cubo,
    `🔴 COBROS pone el cobro en «${cobro.metodoCubo}» e INFORMES en «${fila.cubo}»: dos pantallas ` +
    'contando el mismo cobro en sitios distintos.');
  assert.equal(cuboDeCobro(enDisputa), fila.cubo);
  assert.equal(etiquetaMetodoCobro(fila.method), '🏦 Transferencia');
});

test('SCRUM-499 · ③ 🔴 CONTROL NEGATIVO: sin método, no desaparece de ninguna de las tres', () => {
  // Un cobro que desaparece de una pantalla de dinero es peor que uno mal etiquetado: al que no
  // está no se le echa de menos.
  for (const ausencia of [null, '', '   ', undefined]) {
    const f = factura(ausencia, '25.00');

    const { byMethod } = filasDelInforme([f]);
    assert.equal(byMethod.length, 1, `🔴 INFORMES pierde la factura con paidVia ${JSON.stringify(ausencia)}.`);
    assert.equal(byMethod[0].cubo, CUBO_SIN_METODO,
      `🔴 INFORMES cuela la factura sin método en «${byMethod[0].cubo}».`);
    assert.match(etiquetaMetodoCobro(byMethod[0].method), /sin método/i);

    const [cobro] = fundirCobros({ charges: [], candidatas: [f], invoiced: [] });
    assert.ok(cobro, `🔴 COBROS pierde la factura con paidVia ${JSON.stringify(ausencia)}.`);
    assert.equal(cobro.metodo, null, '🔴 COBROS se inventa un método donde no consta.');
    assert.equal(cobro.metodoCubo, CUBO_SIN_METODO,
      `🔴 COBROS cuela la factura sin método en «${cobro.metodoCubo}».`);

    assert.equal(metodoDeUnCobro(f) ?? ROTULO_SIN_METODO, ROTULO_SIN_METODO,
      '🔴 el paquete de disputa afirma un método que nadie ha declarado.');
  }

  // Y SIN BACKFILL: la de al lado no se lo contagia.
  const { byMethod } = filasDelInforme([factura('transfer', '300.00', 1), factura(null, '25.00', 2)]);
  assert.deepEqual(byMethod.map((r) => [r.cubo, r.eur]).sort(), [[CUBO_SIN_METODO, 25], ['transfer', 300]],
    '🔴 la factura sin método se ha contagiado del método de otra.');
});

test('SCRUM-499 · ③ 🔴 EL INVARIANTE: reetiquetar no mueve dinero, en las tres', () => {
  const banco = [
    { charge: { method: 'card' }, total: '100.00' },
    { charge: { method: 'card:stripe' }, total: '50.00' },
    factura('transfer', '300.00', 3),
    factura('bizum_manual', '40.00', 4),
    factura(null, '25.00', 5),
  ];
  const { byMethod, marcadosAMano } = filasDelInforme(banco);

  // Control positivo dentro: con un banco vacío las dos sumas serían 0 y esto pasaría sin medir.
  assert.ok(byMethod.length >= 3, `🔴 el banco produce ${byMethod.length} filas: no se mide nada.`);
  assert.equal(byMethod.reduce((a, f) => a + f.count, 0), banco.length,
    '🔴 se han perdido o duplicado cobros.');
  assert.equal(byMethod.reduce((a, f) => a + Math.round(f.eur * 100), 0), 51500,
    '🔴 EL TOTAL DEL INFORME HA CAMBIADO. Leer un campo nuevo reetiqueta filas; si además mueve ' +
    'dinero, lo que ha cambiado no es la lectura sino la cuenta.');
  assert.equal(marcadosAMano.count, 3, '🔴 el pie no cuenta las facturas sin `Charge`.');
  assert.equal(Math.round(marcadosAMano.eur * 100), 36500);

  // Y en Cobros: las mismas tres facturas salen, ninguna se cae.
  const candidatas = banco.filter((b) => !b.charge);
  const cobros = fundirCobros({ charges: [], candidatas, invoiced: [] });
  assert.equal(cobros.length, candidatas.length, '🔴 COBROS pierde cobros al leer el método.');
  assert.equal(
    cobros.reduce((a, c) => a + Math.round(Number(c.importe) * 100), 0),
    candidatas.reduce((a, c) => a + Math.round(Number(c.total) * 100), 0),
    '🔴 el importe total de COBROS ha cambiado.');
});
