// tests/scrum506-cobros-distingue-el-desconocido.test.mjs — SCRUM-506
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// DENTRO DEL CUBO «SIN MÉTODO» HAY DOS HECHOS, Y COBROS LOS METÍA EN EL MISMO SACO
//
//   ausencia (`null`, `''`) → **NADIE registró nada**. Es un hueco, y no se sabrá nunca.
//   `desconocido`           → **el sistema SÍ dejó constancia**: el cobro nació en una pasarela que
//                             todavía no sabía con qué iba a pagar el cliente (SCRUM-486/489).
//
// SCRUM-503 le dio a Informes un texto para el segundo. Cobros seguía llamándolo «Método no
// registrado», o sea afirmando que no consta nada de un cobro del que SÍ consta algo — y el mismo
// cobro volvía a leerse distinto en dos pantallas, que es lo que SCRUM-488 cerró. El censo de
// aquel ticket lo cazó y subió de 4 a 5.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 UN CUBO, DOS RÓTULOS — y el filtro NO se toca
//
// `desconocido` no está en `PAID_VIA`, así que el servidor lo sigue metiendo en `sin-metodo` y la
// barra sigue teniendo UNA sola pestaña. Es la decisión que ya tomó SCRUM-285 con Bizum: **filtrar
// por cuatro, leer los cinco**. La distinción se LEE en la fila, no se OFRECE como filtro —
// ofrecerla obligaría a ampliar el conjunto cerrado (regla 22) para un valor que no es un método.
//
// Por eso el control positivo comprueba LAS DOS COSAS EN EL MISMO TEST: rótulos distintos y misma
// pestaña. Cada una por su lado se cumpliría con el ticket a medio hacer.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
// 🔴 EL BANCO DE LA CASA, y gana él. Hay una forma de pintar esta vista que YA existe y corre
// dentro de `npm test` (`_banco-vistas.mjs`, el mismo que usa SCRUM-481): montar un servidor y un
// navegador aparte habría medido lo mismo peor y fuera de la tanda.
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { redNormal } from './_banco-red.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);

const VISTA_COBROS = 'public/dashboard/js/cobrosView.js';
const RUTA_DISPUTA = 'src/modules/system/app/routes/invoicesAdmin.routes.ts';

// ── LAS FUENTES, tal y como corren ───────────────────────────────────────────────────────────
const {
  COBROS_SIN_METODO, COBROS_DESCONOCIDO, esDesconocidoDeclarado, rotuloDeMetodo, cuboDeMetodo,
} = require_(path.join(RAIZ, VISTA_COBROS));
const { etiquetaMetodoCobro } = require_(path.join(RAIZ, 'public/dashboard/js/paidViaEtiquetas.js'));
const { cubosDeMetodo, cuboDeCobro, ROTULO_SIN_METODO, CUBO_SIN_METODO, METODO_DESCONOCIDO, metodoDeUnCobro } =
  await import('../dist/modules/billing/domain/metodoDeCobro.js');
const { fundirCobros } = await import('../dist/modules/billing/domain/cobros.service.js');
const { filasDelInforme } = await import('../dist/modules/reports/domain/cobrosPorCubo.js');

const CUBOS = cubosDeMetodo(ROTULO_SIN_METODO);
/** Lo que lee el profesional en la fila de COBROS, componiendo como compone la pantalla. */
const enCobros = (valor) => rotuloDeMetodo(valor, cuboDeCobro(valor), CUBOS);

const factura = (paidVia, total, id = 1) => ({
  id, createdAt: new Date('2026-08-12T10:00:00Z'), total, currency: 'EUR', status: 'paid',
  number: `F-${id}`, paidVia,
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO — va primero: un cero tiene que salir por una línea distinta de «no hay defecto»
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-506 · SUELO: se leen los dos rótulos y los cubos del arranque', () => {
  assert.equal(typeof COBROS_DESCONOCIDO, 'object',
    `🔴 ESCÁNER CIEGO: ${VISTA_COBROS} no expone el rótulo del desconocido. Sin él, todo lo de ` +
    'abajo compararía contra `undefined`.');
  assert.equal(typeof esDesconocidoDeclarado, 'function', '🔴 ESCÁNER CIEGO: falta el reconocedor.');
  assert.ok(CUBOS.length >= 5, `🔴 ESCÁNER CIEGO: el servidor sirve ${CUBOS.length} cubos.`);
  // Control positivo del instrumento: compone de verdad antes de que se compare nada.
  assert.equal(enCobros('card'), 'tarjeta');
  assert.equal(enCobros('bizum_manual'), 'Bizum · manual');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① 🔴 EL LITERAL NO SE ESCRIBE A MANO: se ata al del backend
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-506 · ① 🔴 el valor que Cobros reconoce es EL MISMO que declara el backend', () => {
  // 🔴 El frontend es vanilla y no puede importar de `src/` —medido en SCRUM-499: cero
  // importaciones en todo el árbol—, así que el literal está COPIADO. La copia no se deja sin
  // vigilar: se comparan las DOS FUENTES DE VERDAD, la del front y la de `dist`, no una
  // expectativa escrita aquí. Si el backend renombra su constante, esto cae.
  assert.equal(COBROS_DESCONOCIDO.valor, METODO_DESCONOCIDO,
    `🔴 Cobros reconoce «${COBROS_DESCONOCIDO.valor}» y el backend declara «${METODO_DESCONOCIDO}». ` +
    'La copia del literal se ha quedado atrás, y entonces el desconocido vuelve a leerse como un ' +
    'hueco sin que nadie se entere.');

  // Y el reconocedor normaliza como el resto de la casa: espacios y mayúsculas no lo despistan.
  assert.equal(esDesconocidoDeclarado(METODO_DESCONOCIDO), true);
  assert.equal(esDesconocidoDeclarado('  DESCONOCIDO  '), true,
    '🔴 el reconocedor no normaliza: un valor con espacios volvería al saco del hueco.');
  // Control negativo del reconocedor: no marca lo que no es.
  for (const otro of [null, undefined, '', '   ', 'desconocida', 'card', 42, 'no-consta']) {
    assert.equal(esDesconocidoDeclarado(otro), false,
      `🔴 el reconocedor marca «${String(otro)}» como el desconocido declarado.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② 🔴 CONTROL POSITIVO — rótulos DISTINTOS y MISMA pestaña, en el mismo test
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-506 · ② 🔴 los dos hechos: rótulos DISTINTOS y MISMA pestaña', () => {
  // Las dos cosas juntas a propósito. Rótulos distintos sin misma pestaña sería una pestaña nueva
  // (STOP 1); misma pestaña sin rótulos distintos es el defecto de partida. El ticket es el par.
  assert.equal(enCobros(METODO_DESCONOCIDO), 'Método sin especificar',
    `🔴 el desconocido declarado se lee «${enCobros(METODO_DESCONOCIDO)}»: vuelve a decir que no ` +
    'consta nada cuando lo que consta es que no se sabe.');
  assert.equal(enCobros(null), 'Método no registrado',
    `🔴 la AUSENCIA se lee «${enCobros(null)}» y su rótulo estaba aprobado desde el 10-ago-2026. ` +
    'Este ticket añade un rótulo, no cambia el que había.');
  assert.notEqual(enCobros(METODO_DESCONOCIDO), enCobros(null),
    '🔴 UN HUECO Y UN DATO SE LEEN IGUAL. «Nadie registró nada» y «se preguntó y no consta» son dos ' +
    'hechos distintos, y el profesional decide distinto con cada uno.');

  // 🔴 Y LA MISMA PESTAÑA: un cubo, dos rótulos.
  assert.equal(cuboDeCobro(METODO_DESCONOCIDO), CUBO_SIN_METODO);
  assert.equal(cuboDeCobro(null), CUBO_SIN_METODO);
  assert.equal(cuboDeCobro(METODO_DESCONOCIDO), cuboDeCobro(null),
    '🔴 los dos han dejado de compartir cubo: eso es una pestaña nueva en el filtro y ampliar el ' +
    'conjunto cerrado (regla 22) para un valor que no es un método.');
  // El suelo local de la vista dice lo mismo que el servidor: no hay dos reglas de cubo.
  assert.equal(cuboDeMetodo(METODO_DESCONOCIDO), COBROS_SIN_METODO.clave,
    '🔴 el suelo de la vista manda el desconocido a otro cubo que el servidor: dos reglas.');

  // Y la barra sigue teniendo las mismas pestañas que antes: ninguna nueva.
  assert.deepEqual(CUBOS.map((c) => c.clave), ['bizum', 'card', 'transfer', 'cash', 'sin-metodo'],
    '🔴 HA CAMBIADO LA BARRA DE FILTROS. Este ticket no la toca: la distinción se LEE en la fila.');
});

test('SCRUM-506 · ② las DOS pantallas dicen lo mismo del mismo cobro', () => {
  // Es el hecho que cierra el ticket: el censo de SCRUM-488 vuelve a 4 porque estas dos frases
  // dejan de discrepar. El emoji es decoración de Informes y no cuenta como vocabulario (SCRUM-488).
  const sinEmoji = (s) => String(s).replace(/[\p{Extended_Pictographic}️]/gu, '').trim().toLowerCase();
  assert.equal(sinEmoji(enCobros(METODO_DESCONOCIDO)), sinEmoji(etiquetaMetodoCobro(METODO_DESCONOCIDO)),
    `🔴 COBROS dice «${enCobros(METODO_DESCONOCIDO)}» e INFORMES «${etiquetaMetodoCobro(METODO_DESCONOCIDO)}». ` +
    'El mismo cobro, dos pantallas, dos lecturas — que es lo que SCRUM-488 cerró.');
  // Control positivo del comparador: sí ve una diferencia de verdad cuando la hay.
  assert.notEqual(sinEmoji(enCobros(null)), sinEmoji(etiquetaMetodoCobro(METODO_DESCONOCIDO)),
    '🔴 el comparador da igual todo: no distinguiría una divergencia real.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ 🔴 CONTROL NEGATIVO — el que protege el dinero
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-506 · ③ 🔴 ninguno de los dos desaparece de la lista ni se cuela en otro cubo', () => {
  // Un cobro que desaparece de una pantalla de dinero es peor que uno mal etiquetado: al que no
  // está no se le echa de menos. Se ejerce la fusión de VERDAD, la que alimenta la tabla.
  const banco = [factura(METODO_DESCONOCIDO, '80.00', 1), factura(null, '25.00', 2),
    factura('transfer', '300.00', 3)];
  const cobros = fundirCobros({ charges: [], candidatas: banco, invoiced: [] });

  assert.equal(cobros.length, banco.length,
    `🔴 SE HAN PERDIDO COBROS: entran ${banco.length} y salen ${cobros.length}.`);
  const porId = new Map(cobros.map((c) => [c.invoiceId ?? c.id, c]));
  const desconocido = porId.get(1);
  const ausente = porId.get(2);

  assert.equal(desconocido.metodo, METODO_DESCONOCIDO, '🔴 se ha perdido el valor declarado.');
  assert.equal(desconocido.metodoCubo, CUBO_SIN_METODO,
    `🔴 el desconocido se cuela en el cubo «${desconocido.metodoCubo}»: el profesional lo contaría ` +
    'como un método que no es.');
  assert.equal(ausente.metodo, null, '🔴 se ha inventado un método donde no consta.');
  assert.equal(ausente.metodoCubo, CUBO_SIN_METODO);

  // 🔴 Y AL FILTRAR POR ESA PESTAÑA SALEN LOS DOS. Es la comprobación que de verdad protege el
  // dinero: comparten cubo, así que el filtro no puede dejarse ninguno fuera.
  const enLaPestana = cobros.filter((c) => c.metodoCubo === CUBO_SIN_METODO);
  assert.equal(enLaPestana.length, 2,
    `🔴 al filtrar por «${COBROS_SIN_METODO.rotulo}» salen ${enLaPestana.length} de 2 cobros.`);
  assert.deepEqual(enLaPestana.map((c) => rotuloDeMetodo(c.metodo, c.metodoCubo, CUBOS)).sort(),
    ['Método no registrado', 'Método sin especificar'],
    '🔴 los dos cobros de la misma pestaña ya no se distinguen al leerlos.');
});

test('SCRUM-506 · ③ 🔴 EL INVARIANTE: un rótulo no mueve dinero', () => {
  const banco = [factura(METODO_DESCONOCIDO, '80.00', 1), factura(null, '25.00', 2),
    factura('transfer', '300.00', 3), factura(METODO_DESCONOCIDO, '40.00', 4)];
  const cobros = fundirCobros({ charges: [], candidatas: banco, invoiced: [] });
  const centimos = (n) => Math.round(Number(n) * 100);

  // Control positivo dentro: con un banco vacío las dos sumas serían 0 y esto pasaría sin medir.
  assert.ok(cobros.length >= 3, `🔴 la fusión devuelve ${cobros.length} filas: no se mide nada.`);
  assert.equal(cobros.reduce((a, c) => a + centimos(c.importe), 0),
    banco.reduce((a, f) => a + centimos(f.total), 0),
    '🔴 EL IMPORTE TOTAL DE COBROS HA CAMBIADO al añadir un rótulo. Un texto no mueve dinero.');

  // Y en INFORMES tampoco: los dos desconocidos siguen en la misma fila y con el mismo importe.
  const { byMethod } = filasDelInforme(banco);
  assert.equal(byMethod.reduce((a, f) => a + centimos(f.eur), 0), 44500,
    '🔴 el total del informe ha cambiado.');
  const fila = byMethod.filter((f) => f.metodos.includes(METODO_DESCONOCIDO));
  assert.equal(fila.length, 1, '🔴 los dos cobros desconocidos se han separado en filas distintas.');
  assert.equal(centimos(fila[0].eur), 12000, '🔴 la fila del desconocido no suma sus dos cobros.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ 🔴 ROJO POR EL MECANISMO, y lo que NO se toca
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-506 · ④ 🔴 devolver el desconocido al rótulo de la ausencia se ve, y se dice por qué', () => {
  // Se provoca sobre una COPIA del rótulo —sin tocar el fichero, restaurando en `finally`— y se
  // comprueba que se caza Y que el mensaje dice el qué: no «falta un rótulo», sino que las dos
  // pantallas vuelven a leer el mismo cobro distinto.
  const original = COBROS_DESCONOCIDO.rotulo;
  const sinEmoji = (s) => String(s).replace(/[\p{Extended_Pictographic}️]/gu, '').trim().toLowerCase();
  try {
    COBROS_DESCONOCIDO.rotulo = COBROS_SIN_METODO.rotulo;   // ← vuelve al saco del hueco
    assert.equal(enCobros(METODO_DESCONOCIDO), enCobros(null),
      '🔴 el mecanismo no es el que se cree: igualar los rótulos tenía que fundir los dos hechos, y ' +
      'no lo hace. Entonces el verde de arriba no significa lo que parece.');
    const divergen = sinEmoji(enCobros(METODO_DESCONOCIDO)) !== sinEmoji(etiquetaMetodoCobro(METODO_DESCONOCIDO));
    assert.equal(divergen, true,
      '🔴 EL CENSO NO VE LA DIVERGENCIA. Con esto ciego, las dos pantallas pueden volver a separarse ' +
      'sin que salte nadie.');
    const mensaje = `🔴 COBROS «${enCobros(METODO_DESCONOCIDO)}» · INFORMES ` +
      `«${etiquetaMetodoCobro(METODO_DESCONOCIDO)}»: el mismo cobro se lee distinto en las dos ` +
      'pantallas, y Cobros afirma que no consta nada de un cobro del que SÍ consta algo.';
    assert.match(mensaje, /Método no registrado/, '🔴 el mensaje no trae la grafía de Cobros.');
    assert.match(mensaje, /Método sin especificar/, '🔴 el mensaje no trae la grafía de Informes.');
  } finally {
    COBROS_DESCONOCIDO.rotulo = original;   // el módulo está cacheado
  }
  assert.equal(enCobros(METODO_DESCONOCIDO), 'Método sin especificar',
    '🔴 no se ha restaurado el rótulo: el resto de la tanda mediría una vista envenenada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ LA PANTALLA PINTADA — con el banco de la casa, dentro de la tanda
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Un cobro como lo serializa el servidor: el crudo AL LADO del cubo derivado, nunca a mano. */
const cobroServido = (id, metodo) => ({
  origen: 'charge', id, fecha: '2026-08-01T10:00:00.000Z', cliente: `Cliente ${id}`,
  concepto: 'Trabajo', importe: '100.00', moneda: 'EUR', metodo, metodoCubo: cuboDeCobro(metodo),
  estado: 'paid', referencia: null, numero: null, tipo: null, invoiceId: null, chargeId: id,
});

/** Los textos de la columna MÉTODO, leídos de la tabla pintada. */
const celdasDeMetodo = (nodo) => todos(nodo)
  .filter((x) => x.tagName === 'TD' && x.className === 'col-hide-mobile')
  .map((x) => x.textContent);

test('SCRUM-506 · ⑤ 🔴 EN LA TABLA PINTADA: las dos filas salen, y dicen cosas distintas', async () => {
  // Lo que de verdad ve el profesional. Que las funciones devuelvan lo correcto no prueba que la
  // celda lo pinte: el banco monta la vista entera con la respuesta del servidor.
  const datos = [cobroServido(1, METODO_DESCONOCIDO), cobroServido(2, null), cobroServido(3, 'transfer')];
  const b = cargarDashboard(RAIZ, { red: redNormal(datos) });
  const r = await pintarVista(b, 'renderCobrosView');
  assert.equal(r.error, null, `🔴 la vista revienta: ${r.error && r.error.message}`);

  const celdas = celdasDeMetodo(r.contenedor);
  // Control positivo del instrumento: si no lee celdas, lo de abajo pasaría sobre una lista vacía.
  assert.equal(celdas.length, datos.length,
    `🔴 ESCÁNER CIEGO: se leen ${celdas.length} celdas de método sobre ${datos.length} cobros.`);
  assert.deepEqual(celdas, ['Método sin especificar', 'Método no registrado', 'transferencia'],
    `🔴 la columna MÉTODO pinta ${JSON.stringify(celdas)}. Los dos primeros son un DATO y un HUECO: ` +
    'si dicen lo mismo, el profesional no puede saber de cuál de los dos cobros consta algo.');
});

test('SCRUM-506 · ④ el paquete de evidencia de disputa sigue SIN traducir (SCRUM-499)', () => {
  // Ahí el valor es prueba ante un banco y va CRUDO. Si empezara a traducirse, se habría roto lo
  // que aquel ticket dejó decidido — y este ticket toca vocabulario, así que es el momento de mirar.
  const f = factura(METODO_DESCONOCIDO, '80.00');
  assert.equal(metodoDeUnCobro(f) ?? ROTULO_SIN_METODO, METODO_DESCONOCIDO,
    '🔴 el paquete de disputa ha empezado a TRADUCIR el método: es lo que el banco cruza, y un ' +
    'rótulo no se puede cotejar con nada.');
  const disputa = fs.readFileSync(path.join(RAIZ, RUTA_DISPUTA), 'utf8');
  assert.doesNotMatch(disputa, /COBROS_DESCONOCIDO|Método sin especificar/,
    '🔴 el paquete de disputa ha empezado a usar el vocabulario de la pantalla.');
});
