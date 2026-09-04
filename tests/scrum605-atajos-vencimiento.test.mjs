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
// ⚠️ MICROCOPY: los rótulos de los tres botones son texto NUEVO y salen con
// `[PENDIENTE microcopy oficial]` (regla 30), de UNA sola constante para que aprobarlo los
// apague de golpe. El censo de SCRUM-402 sube de 8 a 9 ficheros, declarado en su tabla.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// El módulo es un script clásico (ni DOM ni red): se evalúa con un `window` de mentira. Mismo
// procedimiento que `scrum500-suplidos.test.mjs` — dos formas de cargar el mismo fichero
// acabarían midiendo dos cosas distintas.
const front = {};
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
const BORDES = [
  { que: 'fin de mes: 31 de enero + 30, febrero de 28', hoy: [2026, 0, 31], dias: 30, esperada: '2026-03-02' },
  { que: 'fin de mes en año BISIESTO: 31 de enero + 30', hoy: [2024, 0, 31], dias: 30, esperada: '2024-03-01' },
  { que: 'la fecha CAE en el 29 de febrero', hoy: [2024, 0, 30], dias: 30, esperada: '2024-02-29' },
  { que: 'cambio de AÑO con 30 días', hoy: [2026, 11, 15], dias: 30, esperada: '2027-01-14' },
  { que: 'cambio de AÑO con 7 días, desde el 31 de diciembre', hoy: [2026, 11, 31], dias: 7, esperada: '2027-01-07' },
  { que: 'mes de 30 días: 31 de marzo + 30', hoy: [2026, 2, 31], dias: 30, esperada: '2026-04-30' },
  { que: 'caso corriente de 14 días', hoy: [2026, 4, 20], dias: 14, esperada: '2026-06-03' },
];

for (const b of BORDES) {
  test(`SCRUM-605 · 🔴 ${b.que}`, () => {
    const hoy = new Date(b.hoy[0], b.hoy[1], b.hoy[2]);
    const obtenida = A.fechaDeAtajo(b.dias, hoy);
    const desde = `${b.hoy[0]}-${String(b.hoy[1] + 1).padStart(2, '0')}-${String(b.hoy[2]).padStart(2, '0')}`;
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
  const hoy = new Date(2026, 0, 1);
  for (const malo of [0, -7, 7.5, NaN, '7', null, undefined, {}]) {
    assert.equal(A.fechaDeAtajo(malo, hoy), null,
      `🔴 \`${JSON.stringify(malo)}\` ha producido una fecha en vez de \`null\`. Una fecha inventada `
      + 'en un documento es peor que un campo sin tocar.');
  }
  // Y el control al revés: con un dato bueno SÍ devuelve fecha. Sin esto, una función que
  // devolviera `null` siempre pasaría el bucle de arriba.
  assert.equal(A.fechaDeAtajo(7, hoy), '2026-01-08', '🔴 tampoco calcula el caso bueno');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA PREGUNTA DEL ENCARGO: ¿puede un atajo caer por debajo del `min` del campo?
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-605 · 🔴 NINGÚN atajo cae por debajo del `min` — y se comprueba, no se razona', () => {
  // Se prueba en los días que más duelen, no en uno cualquiera.
  const dias = [[2026, 0, 31], [2024, 1, 29], [2026, 11, 31], [2026, 5, 30]];
  for (const d of dias) {
    const hoy = new Date(d[0], d[1], d[2]);
    const min = A.fechaDeAtajo(1, hoy);          // el `min` del campo es mañana
    for (const n of A.DIAS_ATAJO) {
      assert.equal(A.atajoPorDebajoDelMinimo(n, min, hoy), false,
        `🔴 el atajo de ${n} días cae por debajo del mínimo del campo (${min}) el `
        + `${hoy.toDateString()}: el navegador rechazaría el valor EN SILENCIO.`);
    }
  }
  // CONTROL POSITIVO del detector: con un atajo imposible tiene que decir que SÍ cae. Sin esto,
  // una función que devolviera `false` siempre pasaría el bucle de arriba.
  assert.equal(A.atajoPorDebajoDelMinimo(0, '2026-02-01', new Date(2026, 0, 31)), true,
    '🔴 el detector no sabe decir que sí: su `false` de arriba no vale nada');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// CONTROL NEGATIVO DEL TICKET · quien no pulse un atajo ve EXACTAMENTE lo de antes
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-605 · ✅ el campo de siempre no se ha tocado: default +30 d, min +1 d y su nota', () => {
  const vista = leer(VISTA);
  const trozos = [
    ['el rótulo aprobado', '    validLabel.textContent = "Válido hasta";'],
    ['el valor por defecto (+30 d)', '    const defUntil = new Date(Date.now() + 30 * 86400000);'],
    ['el mínimo (+1 d)', '    validInput.min = new Date(Date.now() + 86400000).toISOString().slice(0, 10);'],
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
test('SCRUM-605 · el rótulo sale del marcador oficial, y de UNA sola constante', () => {
  assert.equal(A.MARCA_MICROCOPY, '[PENDIENTE microcopy oficial]',
    '🔴 el marcador no es el que cuenta el censo de SCRUM-402 (`[PENDIENTE`). Uno que no cuente '
    + 'sería un marcador invisible para el trinquete que existe justo para verlo.');
  for (const d of A.DIAS_ATAJO) {
    assert.equal(A.rotuloDeAtajo(d), `${d} ${A.MARCA_MICROCOPY}`,
      `🔴 el rótulo de ${d} días ya no se compone del número + la constante`);
  }
  // Una sola marca escrita en el fichero: aprobar el texto los apaga los tres de golpe.
  const fuente = leer('public/dashboard/js/quoteAtajosVencimiento.js');
  assert.equal(fuente.split("'[PENDIENTE microcopy oficial]'").length - 1, 1,
    '🔴 hay más de una marca escrita: aprobar el copy ya no los apagaría a todos de golpe');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LOS TRES, RECORRIDOS · y el control negativo que separa el TEXTO del CÁLCULO
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-605 · 🔴 LOS TRES atajos ponen hoy + N, recorriendo la lista y no uno a mano', () => {
  // Los casos límite de arriba están escritos uno a uno —fin de mes, bisiesto, cambio de año— y
  // eso es lo que hay que probar de la aritmética. Falta lo obvio, que es justo lo que nadie
  // comprueba: que **cada uno de los tres** ponga lo que su rótulo promete. Se RECORRE
  // `DIAS_ATAJO`: si mañana entra un cuarto atajo, este test lo mide sin que nadie lo actualice.
  const hoy = new Date(2026, 4, 12, 12, 0, 0); // 12-may-2026, mediodía (SCRUM-640: nunca medianoche)
  const esperado = { 7: '2026-05-19', 14: '2026-05-26', 30: '2026-06-11' };

  assert.ok(A.DIAS_ATAJO.length >= 3,
    `🔴 SUELO: sólo hay ${A.DIAS_ATAJO.length} atajos. Un recorrido sobre una lista vacía pasa `
    + 'sin comprobar nada, que es como un test deja de mirar sin que se note.');

  for (const dias of A.DIAS_ATAJO) {
    assert.ok(Object.prototype.hasOwnProperty.call(esperado, dias),
      `🔴 ha entrado un atajo de ${dias} días y este test no sabe qué fecha debería dar: añádela `
      + 'aquí en el mismo commit, o el atajo nuevo viaja sin comprobar.');
    assert.equal(A.fechaDeAtajo(dias, hoy), esperado[dias],
      `🔴 el atajo de ${dias} DÍAS pone ${A.fechaDeAtajo(dias, hoy)} y debería poner `
      + `${esperado[dias]}. Un botón que promete «${dias}» y escribe otra fecha es peor que no `
      + 'tenerlo: el cliente recibe un presupuesto con una validez que nadie quiso.');
  }
});

test('SCRUM-605 · CONTROL NEGATIVO: el RÓTULO no decide la fecha', () => {
  // Lo que NO debe hacer caer el cálculo: cambiar el texto. Hoy el rótulo lleva el marcador
  // dentro, y el día que el fundador firme el copy va a cambiar entero — si el cálculo dependiera
  // del texto, aprobar la microcopy rompería las fechas de un documento que el cliente recibe.
  const hoy = new Date(2026, 0, 31, 12, 0, 0);
  const antes = A.DIAS_ATAJO.map((d) => A.fechaDeAtajo(d, hoy));

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
  for (const prohibido of ['rotulo', 'MARCA_MICROCOPY']) {
    assert.equal(cuerpo.includes(prohibido), false,
      `🔴 \`fechaDeAtajo\` menciona \`${prohibido}\`: el cálculo se ha atado al TEXTO. El día que `
      + 'se apruebe la microcopy el rótulo cambia entero, y con él cambiarían las fechas de un '
      + 'documento que el cliente recibe.');
  }

  const original = A.rotuloDeAtajo;
  try {
    A.rotuloDeAtajo = (d) => `Otro texto cualquiera para ${d}`;
    const despues = A.DIAS_ATAJO.map((d) => A.fechaDeAtajo(d, hoy));
    assert.deepEqual(despues, antes,
      '🔴 cambiar el RÓTULO ha cambiado las FECHAS. El texto y el cálculo tienen que estar '
      + 'separados: el día que se apruebe la microcopy, el rótulo cambia entero.');
    assert.equal(A.rotuloDeAtajo(7), 'Otro texto cualquiera para 7',
      '🔴 SUELO: el rótulo no se ha podido sustituir, así que la prueba de arriba no prueba nada.');
  } finally {
    A.rotuloDeAtajo = original;
  }
  assert.equal(A.rotuloDeAtajo(7), `7 ${A.MARCA_MICROCOPY}`,
    '🔴 el rótulo no se ha restaurado: el resto del fichero mediría otra cosa.');
});
