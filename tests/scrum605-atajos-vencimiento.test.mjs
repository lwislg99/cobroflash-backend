// tests/scrum605-atajos-vencimiento.test.mjs — SCRUM-605 (DOC-15) · sólo PRESUPUESTO
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS ATAJOS DE «VÁLIDO HASTA», Y LOS BORDES QUE MUERDEN EN FECHAS
//
// El campo YA existía (`quotesView.js`, id `quote-valid-until`, rótulo «Válido hasta» aprobado,
// valor por defecto +30 d y `min` +1 d). Lo que faltaba eran los atajos. La FACTURA no entra en
// este ticket: no tiene dónde guardar la fecha (ver `docs/master/SCRUM-605.md`).
//
// La aritmética se prueba de VERDAD porque vive fuera de la vista, en funciones puras
// (`quoteAtajosVencimiento.js`) — mismo motivo que `quoteMargen.js` y `quoteSuplido.js`: a un
// módulo de navegador sólo se le puede exigir la FORMA de su fuente, y aquí lo que hay que
// exigir es que «30 días» dé la fecha correcta el 31 de enero.
//
// 🔴 LOS BORDES NO SE RAZONAN, SE PRUEBAN. Las fechas fijadas abajo se calcularon ejecutando el
// módulo, no a mano: fin de mes, mes de 30 días, cambio de año y febrero bisiesto —incluido el
// caso en que la fecha CAE en el 29 de febrero, que es el que se escapa cuando alguien escribe
// una tabla de meses.
//
// ✅ MICROCOPY APROBADA por el ASESOR el 4-sep-2026, a la espera de la firma del fundador:
// «7 días» · «14 días» · «30 días», y los nombres accesibles «Válido hasta dentro de N días».
// El marcador se retiró y la entrada de `quoteAtajosVencimiento.js` SALIÓ del censo de
// SCRUM-402 —borrada, no puesta a 0—: comprobado con el número delante, de 13 a 12 entradas.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// Los módulos son scripts clásicos (ni DOM ni red): se evalúan con un `window` de mentira. Mismo
// procedimiento que `scrum500-suplidos.test.mjs` — dos formas de cargar el mismo fichero
// acabarían midiendo dos cosas distintas.
//
// 🔴 SCRUM-750 · SE CARGAN LOS DOS, Y EN EL MISMO `window`. Desde el 5-sep-2026 `fechaDeAtajo` no
// calcula: le pide el día a `quoteCaducidad.diaPorDefecto` (SCRUM-633), que es la pieza que sabe
// en qué zona vive el negocio. Cargar sólo este fichero dejaría a `fechaDeAtajo` devolviendo
// `null` siempre — y un test que sólo compruebe `null` pasaría igual sin enterarse. El orden es el
// mismo que el del índice: `quoteCaducidad.js` va ANTES.
const front = {};
new Function('window', leer('public/dashboard/js/quoteCaducidad.js'))(front);
new Function('window', leer('public/dashboard/js/quoteAtajosVencimiento.js'))(front);
const A = front.QUOTE_ATAJOS_VENCIMIENTO;

const VISTA = 'public/dashboard/js/quotesView.js';

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-605 · SUELO: el módulo publica lo suyo', () => {
  assert.ok(A, '🔴 CIEGO: `quoteAtajosVencimiento.js` no ha publicado nada en `window`');
  for (const f of ['fechaDeAtajo', 'rotuloDeAtajo', 'atajoPorDebajoDelMinimo']) {
    assert.equal(typeof A[f], 'function', `🔴 CIEGO: falta \`${f}\``);
  }
  assert.deepEqual(A.DIAS_ATAJO, [7, 14, 30], '🔴 cambiaron los atajos que el fundador pidió');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LOS BORDES · calculados, no razonados
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SCRUM-750 · LOS INSTANTES SON EXPLÍCITOS Y EL MERCHANT TAMBIÉN, Y ESO NO ES COSMÉTICA.
//
// Antes el instante se construía con `new Date(2026, 0, 31)` —componentes LOCALES— y la fecha
// esperada se comparaba contra un cálculo que también usaba componentes locales. Las dos mitades
// se movían juntas con la máquina, así que el test pasaba en cualquier zona SIN comprobar que el
// día no dependiera de ella: exactamente el defecto que este ticket viene a cerrar.
//
// Ahora el instante es UTC explícito y el merchant es `null` → UTC (decisión A del fundador). Las
// SIETE fechas esperadas son las MISMAS de antes, y eso es el resultado, no la casualidad: en una
// zona sin cambio de hora sumar `N × 86400000` ms equivale a sumar N días de calendario, así que
// el desbordamiento de fin de mes, de año y del bisiesto sale igual. La ventana del cambio de
// hora —donde las dos formas SÍ discrepan— se mide aparte, en `scrum750-los-dos-calendarios`.
//
// Al MEDIODÍA y nunca a medianoche (SCRUM-640).
const BORDES = [
  { que: 'fin de mes: 31 de enero + 30, febrero de 28', hoy: '2026-01-31T12:00:00Z', dias: 30, esperada: '2026-03-02' },
  { que: 'fin de mes en año BISIESTO: 31 de enero + 30', hoy: '2024-01-31T12:00:00Z', dias: 30, esperada: '2024-03-01' },
  { que: 'la fecha CAE en el 29 de febrero', hoy: '2024-01-30T12:00:00Z', dias: 30, esperada: '2024-02-29' },
  { que: 'cambio de AÑO con 30 días', hoy: '2026-12-15T12:00:00Z', dias: 30, esperada: '2027-01-14' },
  { que: 'cambio de AÑO con 7 días, desde el 31 de diciembre', hoy: '2026-12-31T12:00:00Z', dias: 7, esperada: '2027-01-07' },
  { que: 'mes de 30 días: 31 de marzo + 30', hoy: '2026-03-31T12:00:00Z', dias: 30, esperada: '2026-04-30' },
  { que: 'caso corriente de 14 días', hoy: '2026-05-20T12:00:00Z', dias: 14, esperada: '2026-06-03' },
];

for (const b of BORDES) {
  test(`SCRUM-605 · 🔴 ${b.que}`, () => {
    const hoy = new Date(b.hoy);
    const obtenida = A.fechaDeAtajo(b.dias, null, hoy);
    const desde = b.hoy.slice(0, 10);
    assert.equal(obtenida, b.esperada,
      `🔴 EL ATAJO DE ${b.dias} DÍAS CALCULA MAL.\n`
      + `     desde:     ${desde}\n`
      + `     sale:      ${obtenida}\n`
      + `     debería:   ${b.esperada}\n`
      + '  Es una fecha que va impresa en un documento que el cliente recibe, y de la que depende '
      + 'que el presupuesto caduque el día que toca.');
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// CONTROL NEGATIVO del propio módulo · no inventa fechas
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-605 · lo que no se puede calcular devuelve `null`, nunca una fecha inventada', () => {
  const hoy = new Date('2026-01-01T12:00:00Z');
  for (const malo of [0, -7, 7.5, NaN, '7', null, undefined, {}]) {
    assert.equal(A.fechaDeAtajo(malo, null, hoy), null,
      `🔴 \`${JSON.stringify(malo)}\` ha producido una fecha en vez de \`null\`. Una fecha inventada `
      + 'en un documento es peor que un campo sin tocar.');
  }
  // 🔴 SCRUM-750 · Y LA FIRMA VIEJA TAMBIÉN. `fechaDeAtajo(7, hoy)` era la llamada correcta hasta
  // el 5-sep; hoy ese `Date` cae en el hueco del merchant y `zonaDelMerchant` no le encontraría
  // `.timezone`, así que devolvería una fecha calculada en UTC como si fuera la del negocio. Sin
  // este aserto, una llamada sin migrar sigue escribiendo un día PLAUSIBLE en el documento.
  assert.equal(A.fechaDeAtajo(7, hoy), null,
    '🔴 la firma vieja `(dias, hoy)` ha vuelto a devolver una fecha: un `Date` en el hueco del '
    + 'merchant da la zona equivocada SIN avisar, que es peor que no escribir nada.');

  // Y el control al revés: con un dato bueno SÍ devuelve fecha. Sin esto, una función que
  // devolviera `null` siempre pasaría los bucles de arriba.
  assert.equal(A.fechaDeAtajo(7, null, hoy), '2026-01-08', '🔴 tampoco calcula el caso bueno');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA PREGUNTA DEL ENCARGO: ¿puede un atajo caer por debajo del `min` del campo?
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-605 · 🔴 NINGÚN atajo cae por debajo del `min` — y se comprueba, no se razona', () => {
  // Se prueba en los días que más duelen, no en uno cualquiera.
  const dias = ['2026-01-31T12:00:00Z', '2024-02-29T12:00:00Z', '2026-12-31T12:00:00Z', '2026-06-30T12:00:00Z'];
  for (const iso of dias) {
    const hoy = new Date(iso);
    const min = A.fechaDeAtajo(1, null, hoy);    // el `min` del campo es mañana
    assert.ok(min, `🔴 SUELO: no se ha podido calcular el propio \`min\` para ${iso}.`);
    for (const n of A.DIAS_ATAJO) {
      assert.equal(A.atajoPorDebajoDelMinimo(n, min, null, hoy), false,
        `🔴 el atajo de ${n} días cae por debajo del mínimo del campo (${min}) el `
        + `${iso}: el navegador rechazaría el valor EN SILENCIO.`);
    }
  }
  // CONTROL POSITIVO del detector: con un atajo imposible tiene que decir que SÍ cae. Sin esto,
  // una función que devolviera `false` siempre pasaría el bucle de arriba.
  assert.equal(A.atajoPorDebajoDelMinimo(0, '2026-02-01', null, new Date('2026-01-31T12:00:00Z')), true,
    '🔴 el detector no sabe decir que sí: su `false` de arriba no vale nada');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// CONTROL NEGATIVO DEL TICKET · quien no pulse un atajo ve EXACTAMENTE lo de antes
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-605 · ✅ el campo de siempre no se ha tocado: default +30 d, min +1 d y su nota', () => {
  const vista = leer(VISTA);
  // ── 🔴 SCRUM-633 · ESTE CONTROL FIJABA LA EXPRESIÓN, Y AHORA FIJA LA PROPIEDAD ────────────
  //
  // Los dos trozos del default y del mínimo eran las líneas LITERALES `new Date(Date.now() + …)
  // .toISOString().slice(0, 10)`, que es exactamente el defecto que SCRUM-633 vino a cerrar: ese
  // `toISOString()` da el día en UTC, y para un profesional en Madrid falla 335 de 365 días a las
  // 00:30. Así que este guard cayó — y **cayó bien**: su modelo (el texto de la expresión) dejó de
  // valer el día en que la expresión cambió.
  //
  // **No se ha relajado: se le devuelve la PREGUNTA.** Lo que protege —«quien no pulse un atajo ve
  // exactamente lo de antes: +30 días, +1 día y su nota»— sigue siendo cierto y sigue importando,
  // y ahora se comprueba por los DÍAS, que es lo que el control quería decir, en vez de por cómo
  // se calculan. Que el día resultante sea el correcto lo ata `scrum633-caducidad-en-la-zona`, con
  // su propio control negativo: un merchant sin zona ve EXACTAMENTE lo de antes.
  const trozos = [
    ['el rótulo aprobado', '    validLabel.textContent = "Válido hasta";'],
    ['el valor por defecto (+30 d)', 'window.quoteCaducidad.diaPorDefecto(null, 30)'],
    ['el mínimo (+1 d)', 'window.quoteCaducidad.diaPorDefecto(null, 1)'],
    ['la nota de caducidad que ve el cliente',
      '    validNote.textContent = "Pasada esta fecha el presupuesto caduca solo y el cliente verá \\"pide uno actualizado\\".";'],
  ];
  for (const [que, texto] of trozos) {
    assert.equal(vista.split(texto).length - 1, 1,
      `🔴 HA CAMBIADO ${que}. El control negativo de SCRUM-605 es que quien NO pulse un atajo vea `
      + 'exactamente lo de antes — incluida la caducidad automática y el «pide uno actualizado».');
  }
  // Y que el atajo no le haya colgado ningún listener al campo: hoy no tiene ninguno, y el
  // presupuesto se comporta igual porque el valor sólo se lee al enviar.
  assert.equal(vista.split('validInput.addEventListener').length - 1, 0,
    '🔴 alguien le ha puesto un listener a `validInput`: eso ya no es «se comporta como hoy»');
});

test('SCRUM-605 · los atajos se pintan reutilizando la ficha de AB3, no una clase nueva', () => {
  const vista = leer(VISTA);
  assert.equal(vista.split('atajosFila.className = "quote-plantillas";').length - 1, 1,
    '🔴 la fila de atajos ya no reutiliza `quote-plantillas` (AB3)');
  assert.equal(vista.split('chip.className = "quote-plantilla-chip";').length - 1, 1,
    '🔴 la ficha ya no es `quote-plantilla-chip`, que es la que trae los 44 px de AB6 y el anillo de foco');
  const css = leer('public/dashboard/css/styles.css');
  assert.equal(css.split('.quote-plantilla-chip {').length - 1, 1,
    '🔴 la clase reutilizada ha desaparecido del CSS: los atajos se quedarían sin objetivo táctil');
  assert.ok(css.includes('min-height: 44px; padding: 6px 14px;'),
    '🔴 la ficha ha perdido sus 44 px de objetivo táctil (AB6)');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// MICROCOPY · una sola constante, y el número no es texto
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-605 · 🔴 los SEIS literales son los APROBADOS, comparados con `===`', () => {
  // ✅ Aprobados por el ASESOR el 4-sep-2026, a la espera de la firma del fundador. Se comparan
  // uno a uno y con `===`: un retoque «de paso» reabre una aprobación sin que nadie se entere
  // (mismo aserto que `scrum683-parte-dictado`).
  const ROTULOS = { 7: '7 días', 14: '14 días', 30: '30 días' };
  const ACCESIBLES = {
    7: 'Válido hasta dentro de 7 días',
    14: 'Válido hasta dentro de 14 días',
    30: 'Válido hasta dentro de 30 días',
  };

  assert.ok(A.DIAS_ATAJO.length >= 3,
    `🔴 SUELO: sólo hay ${A.DIAS_ATAJO.length} atajos; comparar sobre una lista corta no prueba nada.`);

  for (const d of A.DIAS_ATAJO) {
    assert.equal(A.rotuloDeAtajo(d), ROTULOS[d],
      `🔴 el RÓTULO de ${d} días ha cambiado sin pasar por quien lo aprueba (regla 30).`);
    assert.equal(A.nombreAccesibleDeAtajo(d), ACCESIBLES[d],
      `🔴 el NOMBRE ACCESIBLE de ${d} días ha cambiado. Dice la acción completa a propósito: el
       botón puede decir «${d} días» apoyándose en el campo de al lado, pero un lector de pantalla
       puede no dar ese contexto.`);
  }

  // 🔴 Y NO PUEDE VOLVER EL MARCADOR: si alguien lo repone, el censo de SCRUM-402 subiría otra vez
  // y el profesional volvería a ver una nota interna en su presupuesto.
  const fuente = leer('public/dashboard/js/quoteAtajosVencimiento.js');
  assert.equal(/\[PENDIENTE/.test(fuente), false,
    '🔴 ha vuelto un marcador al fichero: su entrada salió del censo de SCRUM-402 el 4-sep, así '
    + 'que ahora se pintaría SIN que ningún trinquete lo contara.');

  // 🔴 «1 mes» NO: el motor hace hoy+30, y 30 días no son un mes salvo en cuatro. Un rótulo que
  // no describe lo que hace el mecanismo es la avería que este árbol lleva una semana cazando.
  for (const prohibido of ['1 mes', 'mes', 'semana']) {
    for (const d of A.DIAS_ATAJO) {
      assert.equal(A.rotuloDeAtajo(d).includes(prohibido), false,
        `🔴 el rótulo de ${d} días dice «${prohibido}», y este mecanismo cuenta DÍAS. Prometer un
         mes cuando se suman 30 días es mentir en el sitio donde el profesional sí mira.`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LOS TRES, RECORRIDOS · y el control negativo que separa el TEXTO del CÁLCULO
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-605 · 🔴 LOS TRES atajos ponen hoy + N, recorriendo la lista y no uno a mano', () => {
  // Los casos límite de arriba están escritos uno a uno —fin de mes, bisiesto, cambio de año— y
  // eso es lo que hay que probar de la aritmética. Falta lo obvio, que es justo lo que nadie
  // comprueba: que **cada uno de los tres** ponga lo que su rótulo promete. Se RECORRE
  // `DIAS_ATAJO`: si mañana entra un cuarto atajo, este test lo mide sin que nadie lo actualice.
  const hoy = new Date('2026-05-12T12:00:00Z'); // 12-may-2026, mediodía (SCRUM-640: nunca medianoche)
  const esperado = { 7: '2026-05-19', 14: '2026-05-26', 30: '2026-06-11' };

  assert.ok(A.DIAS_ATAJO.length >= 3,
    `🔴 SUELO: sólo hay ${A.DIAS_ATAJO.length} atajos. Un recorrido sobre una lista vacía pasa `
    + 'sin comprobar nada, que es como un test deja de mirar sin que se note.');

  for (const dias of A.DIAS_ATAJO) {
    assert.ok(Object.prototype.hasOwnProperty.call(esperado, dias),
      `🔴 ha entrado un atajo de ${dias} días y este test no sabe qué fecha debería dar: añádela `
      + 'aquí en el mismo commit, o el atajo nuevo viaja sin comprobar.');
    assert.equal(A.fechaDeAtajo(dias, null, hoy), esperado[dias],
      `🔴 el atajo de ${dias} DÍAS pone ${A.fechaDeAtajo(dias, null, hoy)} y debería poner `
      + `${esperado[dias]}. Un botón que promete «${dias}» y escribe otra fecha es peor que no `
      + 'tenerlo: el cliente recibe un presupuesto con una validez que nadie quiso.');
  }
});

test('SCRUM-605 · CONTROL NEGATIVO: el RÓTULO no decide la fecha', () => {
  // Lo que NO debe hacer caer el cálculo: cambiar el texto. Hoy el rótulo lleva el marcador
  // dentro, y el día que el fundador firme el copy va a cambiar entero — si el cálculo dependiera
  // del texto, aprobar la microcopy rompería las fechas de un documento que el cliente recibe.
  const hoy = new Date('2026-01-31T12:00:00Z');
  const antes = A.DIAS_ATAJO.map((d) => A.fechaDeAtajo(d, null, hoy));
  // 🔴 SUELO (SCRUM-750): si `antes` fueran todo `null` —lo que pasa con la firma vieja, porque el
  // `Date` cae en el hueco del merchant— la comparación de abajo sería `[null,null,null]` contra
  // `[null,null,null]` y este control negativo pasaría SIN MIRAR NADA.
  assert.ok(antes.every((f) => typeof f === 'string' && f.length === 10),
    `🔴 SUELO: las fechas de partida son ${JSON.stringify(antes)}; sin fechas de verdad, comparar `
    + 'antes y después no prueba que el rótulo no decida el cálculo.');

  // Se sustituye el rótulo por otro completamente distinto, sin tocar nada más.
  // 🔴 Y LO QUE DE VERDAD LO PRUEBA, porque lo de abajo NO bastaba: sustituir `A.rotuloDeAtajo`
  // cambia la PROPIEDAD exportada, pero `fechaDeAtajo` llama a la función INTERNA. Un
  // acoplamiento dentro del módulo —«si el rótulo no lleva X, no calcules»— pasaba este test
  // sin despeinarse; lo cazó su propia prueba de rojo. Así que el desacoplamiento se comprueba
  // DONDE SE DECIDE: en el cuerpo de la función.
  const fuente = leer('public/dashboard/js/quoteAtajosVencimiento.js');
  const cuerpo = fuente.slice(fuente.indexOf('function fechaDeAtajo'),
    fuente.indexOf('function rotuloDeAtajo'));
  assert.ok(cuerpo.length > 200, '🔴 SUELO: no he aislado el cuerpo de `fechaDeAtajo`.');
  // Re-anclado el 4-sep: `MARCA_MICROCOPY` ya no existe —se aprobó el copy—, así que la lista
  // pasa a las constantes NUEVAS. No se relaja: se apunta a la forma de hoy, que es lo que el
  // protocolo manda cuando cambia lo que el guard busca.
  for (const prohibido of ['rotulo', 'UNIDAD_ROTULO', 'PREFIJO_ACCESIBLE']) {
    assert.equal(cuerpo.includes(prohibido), false,
      `🔴 \`fechaDeAtajo\` menciona \`${prohibido}\`: el cálculo se ha atado al TEXTO. El día que `
      + 'se apruebe la microcopy el rótulo cambia entero, y con él cambiarían las fechas de un '
      + 'documento que el cliente recibe.');
  }

  const original = A.rotuloDeAtajo;
  try {
    A.rotuloDeAtajo = (d) => `Otro texto cualquiera para ${d}`;
    const despues = A.DIAS_ATAJO.map((d) => A.fechaDeAtajo(d, null, hoy));
    assert.deepEqual(despues, antes,
      '🔴 cambiar el RÓTULO ha cambiado las FECHAS. El texto y el cálculo tienen que estar '
      + 'separados: el día que se apruebe la microcopy, el rótulo cambia entero.');
    assert.equal(A.rotuloDeAtajo(7), 'Otro texto cualquiera para 7',
      '🔴 SUELO: el rótulo no se ha podido sustituir, así que la prueba de arriba no prueba nada.');
  } finally {
    A.rotuloDeAtajo = original;
  }
  // Re-anclado el 4-sep: comparaba con `MARCA_MICROCOPY`, que ya no existe porque se aprobó el
  // copy. Ahora contra el literal aprobado, que es lo que el rótulo tiene que ser.
  assert.equal(A.rotuloDeAtajo(7), '7 días',
    '🔴 el rótulo no se ha restaurado: el resto del fichero mediría otra cosa.');
});
