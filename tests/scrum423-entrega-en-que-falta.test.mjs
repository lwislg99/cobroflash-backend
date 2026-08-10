// tests/scrum423-entrega-en-que-falta.test.mjs — SCRUM-423
//
// EL EJE DE ENTREGA LLEGA A LA PANTALLA. C6 (SCRUM-305) construyó `resumenEntrega`, lo probó, lo
// dejó verde... y lo importaba ÚNICAMENTE su propio test. Ningún profesional lo ha visto nunca.
//
// ⚠️ Y NO fue un olvido, que es lo que importa para saber qué arregla este ticket: el asesor partió
// C6 en dos el 5-ago-2026 porque CUATRO ramas vivas tenían ediciones pendientes dentro de
// `renderJobDetailView` y meter una quinta mano encima era garantizarse un conflicto. Hoy tres de
// esas cuatro ya no existen. El sitio se decidió entonces y la copy se firmó entonces; lo único que
// faltaba era el turno del fichero.
//
// Este fichero NO prueba la aritmética de C6 —eso es `scrum305-entrega-pendiente.test.mjs`, 12
// tests— sino EL ENCHUFE: que el dato llega, que la línea sale cuando hay dato, que NO sale cuando
// no lo hay, y que «no supe leer» nunca se disfraza de «no queda nada».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  entregaDelTrabajo, entregaParaVista, SIN_EJE, ILEGIBLE, CALCULADO,
} from '../dist/modules/jobs/domain/entregaDelTrabajo.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// El motor de huecos es vanilla y se carga como CommonJS, igual que hace su propio test de G5.
const G5 = require_cjs('public/dashboard/js/jobCobroHuecos.js');
function require_cjs(rel) {
  const src = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const module = { exports: {} };
  new Function('module', 'exports', src)(module, module.exports);
  return module.exports;
}

/** Un presupuesto con `n` líneas de cantidad 1, en la forma real de `Quote.lines`. */
const quoteCon = (...qtys) => ({ id: 1, lines: qtys.map((q, i) => ({ concept: `L${i}`, qty: q })) });
/** Un albarán FIRMADO que entrega `cantidad` de la línea `idx` del presupuesto. */
const albFirmado = (idx, cantidad) => ({
  estado: 'firmado', modoValoracion: 'SIN_VALORAR',
  lineas: [{ concepto: 'x', cantidad, unidad: 'ud', quoteLineIndex: idx }],
});

// ══ ① POSITIVO — HAY ENTREGA PENDIENTE: SALE LA LÍNEA, CON SU CIFRA ═══════════════════════

test('SCRUM-423 · ① un Trabajo con entrega pendiente MUESTRA la línea, con su cifra', () => {
  // Tres líneas presupuestadas, una entregada entera: quedan dos.
  const vista = entregaParaVista(entregaDelTrabajo([quoteCon(1, 1, 1)], [albFirmado(0, 1)]));
  assert.equal(vista.estado, CALCULADO);
  assert.equal(vista.calculable, true);
  assert.equal(vista.lineasPendientes, 2, '🔴 el conteo de líneas pendientes no llega a la vista.');

  const huecos = G5.huecosDeCobro({ entregaPendiente: vista });
  const h = huecos.find((x) => x.id === 'sin-entregar');
  assert.ok(h, `🔴 la línea de entrega NO aparece habiendo 2 líneas pendientes. Huecos: ${JSON.stringify(huecos)}`);
  assert.equal(h.cantidad, 2, '🔴 la cifra que se pinta no es la que calculó C6.');
  assert.equal(h.accion, 'ver-albaranes');
});

test('SCRUM-423 · ① y la sección se hace VISIBLE por este hueco aunque no haya ningún otro', () => {
  // El caso que prueba que el cableado sirve para algo: sin este hueco la sección no se pintaría.
  const vista = entregaParaVista(entregaDelTrabajo([quoteCon(2, 2)], []));
  assert.equal(G5.seccionCobroVisible({ entregaPendiente: vista }), true,
    '🔴 con entrega pendiente y nada más, «Qué falta para cobrar» no se pinta: el dato llegaría a ' +
    'una sección invisible, que es otra forma de no entregarlo.');
});

// ══ ② NEGATIVO — SIN NADA PENDIENTE NO HAY LÍNEA VACÍA NI «PENDIENTE DE CALCULAR» ═════════

test('SCRUM-423 · ② sin nada pendiente NO hay línea: ni vacía, ni «pendiente de calcular»', () => {
  // Todo entregado.
  const vista = entregaParaVista(entregaDelTrabajo([quoteCon(1, 1)], [albFirmado(0, 1), albFirmado(1, 1)]));
  assert.equal(vista.calculable, true);
  assert.equal(vista.lineasPendientes, 0);

  const huecos = G5.huecosDeCobro({ entregaPendiente: vista });
  assert.equal(huecos.filter((x) => x.id === 'sin-entregar').length, 0,
    '🔴 sale una línea de entrega sin nada pendiente.');
  // Las DOS negaciones que pide el diseño de G, por separado: que no haya hueco no basta —lo que
  // se prohíbe es que aparezca un rótulo vacío o un «calculando».
  const RELLENO = /pendiente de calcular|calculando|—|sin datos/i;
  // ⚠️ HERMANO POSITIVO PRIMERO (SCRUM-237): sin él, «no aparece relleno» daría verde para siempre
  // aunque el patrón estuviera mal escrito. Se demuestra que SÍ casa cuando el texto está, y sólo
  // entonces se exige que no esté.
  assert.ok(RELLENO.test('[{"texto":"pendiente de calcular"}]'),
    '🔴 el patrón de relleno no reconoce ni un relleno evidente: la negación de abajo no mide nada.');
  const texto = JSON.stringify(huecos);
  assert.ok(!RELLENO.test(texto), `🔴 se ha colado un texto de relleno donde no hay dato: ${texto}`);
});

test('SCRUM-423 · ② los TRES motivos de «no contesto» tampoco pintan línea (o el dato, o nada)', () => {
  const casos = [
    ['hay_adicionales', [quoteCon(1), { id: 2, lines: [{ concept: 'extra', qty: 1 }] }], []],
    ['sin_presupuesto', [quoteCon()], []],
    ['nada_atribuible', [quoteCon(1)], [{ estado: 'firmado', modoValoracion: 'VALORADO', lineas: [{ concepto: 'x', cantidad: 1 }] }]],
  ];
  for (const [motivo, quotes, albaranes] of casos) {
    const vista = entregaParaVista(entregaDelTrabajo(quotes, albaranes));
    assert.equal(vista.calculable, false, `🔴 «${motivo}» debería ser incalculable.`);
    assert.equal(vista.motivo, motivo);
    assert.equal(G5.huecosDeCobro({ entregaPendiente: vista }).filter((x) => x.id === 'sin-entregar').length, 0,
      `🔴 «${motivo}» pinta línea. La regla de G es tajante: o está el dato, o no está la línea.`);
  }
});

test('SCRUM-423 · ② un número INCOMPLETO SÍ se pinta, y con su coletilla FIRMADA detrás', () => {
  // Corrección del asesor (10-ago-2026) sobre mi propuesta. Yo quería callar la línea para no
  // pintar un número mudo; callarse produce la pantalla que dice «no queda nada por entregar», o
  // sea «ya puedes facturar». Con `sinAtribuir` el motor SÍ supo que había algo — sólo no supo
  // dónde ponerlo—, así que se dice, con la salvedad pegada al número.
  const albMixto = {
    estado: 'firmado', modoValoracion: 'SIN_VALORAR',
    lineas: [{ concepto: 'a', cantidad: 1, quoteLineIndex: 0 }, { concepto: 'b', cantidad: 1 }],
  };
  const vista = entregaParaVista(entregaDelTrabajo([quoteCon(1, 1, 1)], [albMixto]));
  assert.equal(vista.calculable, true, '🔴 precondición: este caso TIENE que ser calculable.');
  assert.ok(vista.lineasPendientes > 0, '🔴 precondición: tiene que quedar algo pendiente.');
  assert.equal(vista.sinAtribuir, 1, '🔴 precondición: tiene que haber 1 línea sin atribuir.');

  const h = G5.huecosDeCobro({ entregaPendiente: vista }).find((x) => x.id === 'sin-entregar');
  assert.ok(h, '🔴 NO se pinta la línea habiendo entrega pendiente. Callarse aquí es la pantalla ' +
    'que le dice al profesional que ya puede facturar: el suelo que este ticket prohíbe.');
  assert.ok(h.fraseSinAtribuir, '🔴 el número va sin la salvedad: sería «quedan 2 y no ha pasado nada más».');
  assert.equal(rotulo(h), '2 líneas del presupuesto sin entregar · 1 línea entregada que no sale del presupuesto');
});

test('SCRUM-423 · ② la coletilla es la copy FIRMADA de C6, no una cadena escrita en la vista', async () => {
  // Si la frase se escribiera en el frontend habría dos fuentes de verdad para un texto firmado, y
  // la de la pantalla sería la que nadie firmó. Se comprueba contra `fraseDeCuenta`, la de C6.
  const { fraseDeCuenta } = await import('../dist/modules/jobs/domain/entregaPendiente.js');
  for (const n of [1, 2, 7]) {
    const albs = [{
      estado: 'firmado', modoValoracion: 'SIN_VALORAR',
      lineas: [{ concepto: 'a', cantidad: 1, quoteLineIndex: 0 },
        ...Array.from({ length: n }, (_, i) => ({ concepto: `x${i}`, cantidad: 1 }))],
    }];
    const vista = entregaParaVista(entregaDelTrabajo([quoteCon(1, 1, 1)], albs));
    assert.equal(vista.fraseSinAtribuir, fraseDeCuenta('sinAtribuir', n),
      `🔴 con n=${n} la coletilla no es la que produce la copy firmada de C6.`);
  }
  // Y su singular real, que es regla dura de C6.
  assert.match(entregaParaVista(entregaDelTrabajo([quoteCon(1, 1, 1)], [{
    estado: 'firmado', modoValoracion: 'SIN_VALORAR',
    lineas: [{ concepto: 'a', cantidad: 1, quoteLineIndex: 0 }, { concepto: 'b', cantidad: 1 }],
  }])).fraseSinAtribuir, /^1 línea entregada que no sale del presupuesto$/);
});

test('SCRUM-423 · 🔴 el número y su salvedad NO SE PUEDEN RENDERIZAR POR SEPARADO', () => {
  // El principio que gobierna la composición: si un render, un truncado o un ancho pequeño los
  // parte, alguien leerá el número solo — y ese número es justo el que no se puede leer solo.
  //
  // ① El rótulo es UNA sola cadena: la función devuelve un string, no dos trozos.
  const h = { cantidad: 2, fraseSinAtribuir: '1 línea entregada que no sale del presupuesto' };
  const salida = rotulo(h);
  assert.equal(typeof salida, 'string', '🔴 el rótulo ha dejado de ser una sola cadena.');
  assert.ok(salida.includes('2 líneas del presupuesto sin entregar') && salida.includes(h.fraseSinAtribuir),
    '🔴 la cadena no lleva las dos partes.');
  assert.ok(salida.includes(' · '), '🔴 falta el separador « · » de la casa.');

  // ② Y la vista la pinta en UN SOLO nodo de texto. Si alguien la partiera en dos elementos, este
  //    assert cae: es la diferencia entre «van juntas» y «hoy salen juntas».
  const render = /const t = document\.createElement\('span'\);\s*t\.textContent = TEXTO_HUECO\[h\.id\]\(h\);/;
  assert.match(VISTA, render,
    '🔴 el hueco ha dejado de pintarse como un único `textContent`. Si el número y su salvedad se ' +
    'reparten en dos nodos, un truncado o un cambio de layout pueden dejar visible sólo el número.');

  // ③ Nadie pinta el número por su cuenta saltándose el rótulo.
  assert.ok(!/h\.cantidad[^)]*sin entregar/.test(VISTA.replace(/'sin-entregar':[\s\S]*?\n    \},/, '')),
    '🔴 hay un segundo sitio que compone esta frase: dos rótulos para la misma línea acabarán divergiendo.');
});

test('SCRUM-423 · 🔴 la salvedad no se pierde por TRUNCADO en ancho de móvil', () => {
  // Este producto se usa con el móvil en la mano, y ahí es donde el texto largo se corta. Se mide
  // el CSS real, no se supone: ninguna regla que alcance al hueco puede truncar.
  const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
  const reglas = [...CSS.matchAll(/([^{}]*\.cobro-hueco[^{}]*)\{([^}]*)\}/g)];
  assert.ok(reglas.length >= 2, `🔴 no se encuentran las reglas de .cobro-hueco (${reglas.length}).`);

  const PROHIBIDO = /text-overflow|white-space\s*:\s*nowrap|-webkit-line-clamp|overflow\s*:\s*hidden/;
  // ⚠️ HERMANO POSITIVO: se demuestra que el detector reconoce un truncado antes de afirmar que no
  // lo hay. Si no, «no hay truncado» sería verde aunque el patrón estuviera mal escrito.
  assert.ok(PROHIBIDO.test('.x { text-overflow: ellipsis; }'), '🔴 el detector de truncado no detecta nada.');

  for (const [, selector, cuerpo] of reglas) {
    assert.ok(!PROHIBIDO.test(cuerpo),
      `🔴 «${selector.trim()}» trunca el contenido del hueco: la salvedad puede desaparecer y dejar ` +
      'el número solo, que es exactamente lo que la composición existe para impedir.');
  }
  // Y lo que SÍ tiene que haber: que el contenido envuelva en vez de salirse.
  assert.ok(/\.cobro-hueco\s*\{[^}]*flex-wrap:\s*wrap/.test(CSS),
    '🔴 `.cobro-hueco` ya no envuelve: en móvil el texto largo se saldría o se cortaría.');
});

test('SCRUM-423 · 🔴 MEDIDO: `lineasPendientes === 0` CON `sinAtribuir > 0` SÍ puede darse', () => {
  // La pregunta que el asesor exigió medir antes de cerrar. Se entrega TODO lo presupuestado y
  // además algo añadido en obra que no sale del presupuesto.
  const quote = { id: 1, lines: [{ concept: 'Bajante', qty: 1 }] };
  const alb = {
    estado: 'firmado', modoValoracion: 'SIN_VALORAR',
    lineas: [{ concepto: 'Bajante', cantidad: 1, quoteLineIndex: 0 }, { concepto: 'Extra en obra', cantidad: 2 }],
  };
  const vista = entregaParaVista(entregaDelTrabajo([quote], [alb]));
  assert.equal(vista.calculable, true);
  assert.equal(vista.lineasPendientes, 0);
  assert.ok(vista.sinAtribuir > 0);

  // Y SE PINTA, con la coletilla SOLA. Es lo que cierra el suelo del ticket entero: si este caso
  // callara, la sección saldría sin línea de entrega y el profesional leería que no queda nada —
  // la pantalla que dice «ya puedes facturar» habiendo entregas que el motor no supo atribuir.
  //
  // Sin texto nuevo: «1 línea entregada que no sale del presupuesto» ya es una frase completa y
  // verdadera, ya sale de `fraseDeCuenta` (copy firmada de C6) y ya respeta el registro
  // sustantivo-primero de sus cuatro vecinas.
  const h = G5.huecosDeCobro({ entregaPendiente: vista }).find((x) => x.id === 'sin-entregar');
  assert.ok(h, '🔴 el caso «todo entregado + algo sin atribuir» NO pinta nada. Es exactamente la ' +
    'pantalla que le dice al profesional que ya puede facturar.');
  assert.equal(h.cantidad, 0, '🔴 precondición: aquí no hay número que dar.');
  assert.equal(rotulo(h), '1 línea entregada que no sale del presupuesto',
    '🔴 el rótulo de este caso no es la coletilla sola.');

  // Y NUNCA la contradicción: ni un «0 líneas», ni un separador suelto sin nada delante.
  assert.ok(!/^0 /.test(rotulo(h)), '🔴 se está pintando «0 líneas del presupuesto sin entregar».');
  assert.ok(!rotulo(h).startsWith(' · ') && !rotulo(h).includes(' ·  '),
    '🔴 ha quedado un separador sin la parte que separaba.');
});

test('SCRUM-423 · ② en cambio `enPartesSinFirmar` NO bloquea — y su declaración YA está en pantalla', () => {
  // Esas líneas no cuentan POR DEFINICIÓN de C6 («solo cuenta lo firmado»), así que el número es
  // completo respecto de lo que promete. Y lo que se queda fuera se declara solo: si hay líneas en
  // albaranes sin firmar, hay un albarán sin firmar, y ése es el hueco ① de la sección.
  const sinFirmar = { estado: 'borrador', modoValoracion: 'SIN_VALORAR', lineas: [{ concepto: 'x', cantidad: 1, quoteLineIndex: 0 }] };
  const vista = entregaParaVista(entregaDelTrabajo([quoteCon(1, 1)], [sinFirmar]));
  assert.ok(vista.enPartesSinFirmar > 0, '🔴 precondición: tiene que haber líneas en partes sin firmar.');

  const huecos = G5.huecosDeCobro({ entregaPendiente: vista, albaranes: [sinFirmar] });
  assert.ok(huecos.some((x) => x.id === 'sin-entregar'), '🔴 el hueco de entrega no sale.');
  assert.ok(huecos.some((x) => x.id === 'sin-firmar'),
    '🔴 LA IMPLICACIÓN SE HA ROTO: hay líneas en albaranes sin firmar y la sección NO lo declara en ' +
    'ninguna línea. Mientras eso era cierto, el número podía salir sin coletilla; si deja de serlo, ' +
    'este hueco necesita declarar lo que no cuenta — y eso es microcopy nueva (regla 30).');
});

// ══ ③ ROJO POR EL MECANISMO — SIN CABLEADO, EL TEST NOMBRA QUE LA LÍNEA DESAPARECIÓ ═══════

test('SCRUM-423 · ③ sin el cableado la línea DESAPARECE, y se dice así (no es un error de render)', () => {
  // Exactamente el estado de `main` antes de este ticket: el backend no manda `entregaPendiente`.
  const huecos = G5.huecosDeCobro({ /* sin entregaPendiente */ });
  const hay = huecos.some((x) => x.id === 'sin-entregar');
  assert.equal(hay, false,
    '🔴 sale la línea de entrega SIN que el backend haya mandado el dato: se estaría derivando en el ' +
    'navegador, que es la segunda fuente de verdad que C6 se negó a crear.');

  // Y el mensaje que verá quien rompa el cableado: nombra la desaparición, no un `undefined`.
  const conDato = entregaParaVista(entregaDelTrabajo([quoteCon(1, 1)], []));
  assert.ok(G5.huecosDeCobro({ entregaPendiente: conDato }).some((x) => x.id === 'sin-entregar'),
    '🔴 LA LÍNEA DE ENTREGA HA DESAPARECIDO de «Qué falta para cobrar» habiendo 2 líneas del ' +
    'presupuesto sin entregar. El cálculo de C6 sigue dando el número: lo que se ha roto es el ' +
    'ENCHUFE — o el backend dejó de mandar `job.entregaPendiente`, o el motor de huecos dejó de ' +
    'leerlo. No es un fallo de pintado: el hueco ni siquiera se produce.');
});

// ══ ④ SUELO — «NO SUPE LEER» NUNCA SE DISFRAZA DE «NO QUEDA NADA» ═════════════════════════

test('SCRUM-423 · ④ 🔴 SUELO: si no se pueden leer las líneas del presupuesto, se DECLARA ilegible', () => {
  // Los tres modos de no poder leer, cada uno con su motivo. Ninguno puede salir como «calculado
  // con cero pendiente», que es la pantalla que le dice al profesional que ya puede facturar.
  const casos = [
    ['lineas_no_son_lista', [{ id: 1, lines: null }], []],
    ['lineas_no_son_lista', [{ id: 1, lines: { 0: { qty: 1 } } }], []],
    ['albaranes_no_son_lista', [quoteCon(1)], null],
    // EL QUE DE VERDAD MUERDE: las líneas existen, pero ninguna cantidad es legible. Sin este
    // caso, `resumenEntrega` daría `presupuestada: 0` para todas y `pendienteTotal: 0` — un cero
    // derivado de no saber leer, indistinguible de «entregado todo».
    ['ninguna_linea_con_cantidad_legible', [{ id: 1, lines: [{ concept: 'a', qty: null }, { concept: 'b', qty: 'x' }] }], []],
    ['ninguna_linea_con_cantidad_legible', [{ id: 1, lines: [{ concept: 'a', qty: [] }] }], []],
  ];
  for (const [motivo, quotes, albaranes] of casos) {
    const e = entregaDelTrabajo(quotes, albaranes);
    assert.equal(e.estado, ILEGIBLE, `🔴 «${motivo}» NO se declaró ilegible: salió «${e.estado}».`);
    assert.equal(e.motivo, motivo);

    const vista = entregaParaVista(e);
    assert.equal(vista.calculable, false);
    assert.equal(vista.estado, ILEGIBLE,
      '🔴 el estado «ilegible» no llega a la vista: desde fuera sería indistinguible de «no hay dato».');
    assert.equal(G5.huecosDeCobro({ entregaPendiente: vista }).filter((x) => x.id === 'sin-entregar').length, 0,
      '🔴 se pinta una línea de entrega sobre un dato que no se pudo leer.');
  }
});

test('SCRUM-423 · ④ y «ilegible» NO es lo mismo que «sin eje» ni que «cero pendiente»', () => {
  // Los tres dan la misma pantalla —ninguna línea— y significan cosas distintas. Si el tipo no los
  // separa, nadie puede volver a distinguirlos después.
  const sinEje = entregaDelTrabajo([], []);
  assert.equal(sinEje.estado, SIN_EJE, '🔴 un Trabajo manual (SCRUM-51) no es un fallo de lectura.');

  const ilegible = entregaDelTrabajo([{ id: 1, lines: null }], []);
  const ceroPendiente = entregaDelTrabajo([quoteCon(1)], [albFirmado(0, 1)]);
  assert.equal(ceroPendiente.estado, CALCULADO);
  assert.equal(ceroPendiente.resumen.pendienteTotal, 0);

  assert.notEqual(ilegible.estado, ceroPendiente.estado,
    '🔴 «no supe leer» y «no queda nada» han colapsado en el mismo estado. Dan la misma pantalla, y ' +
    'el segundo le está diciendo al profesional que ya puede facturar.');
  assert.notEqual(ilegible.estado, sinEje.estado);
});

// ══ LA COPY APROBADA — SINGULAR REAL Y FORMATO COPIADO DE SUS VECINOS ═════════════════════

const VISTA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js'), 'utf8');

/**
 * El rótulo REAL de la vista, ejecutado sin montar un DOM.
 *
 * Se extrae el CUERPO de la función del fichero y se ejecuta: así lo que se prueba es el código que
 * se despliega, no una copia del rótulo mantenida aquí — que se quedaría vieja el día que alguien
 * cambie la vista, y el test seguiría verde sobre una frase que ya no se pinta.
 */
const CUERPO_ROTULO = (() => {
  const m = /'sin-entregar':\s*\(h\)\s*=>\s*\{([\s\S]*?)\n    \},/.exec(VISTA);
  assert.ok(m, '🔴 no se encuentra el rótulo de `sin-entregar` en jobDetailView.js.');
  return m[1];
})();
const rotulo = (h) => new Function('h', CUERPO_ROTULO)(typeof h === 'number' ? { cantidad: h } : h);

test('SCRUM-423 · copy aprobada: SINGULAR REAL con n=1, nunca «1 líneas» ni «línea(s)»', () => {
  assert.equal(rotulo(1), '1 línea del presupuesto sin entregar');
  assert.equal(rotulo(3), '3 líneas del presupuesto sin entregar');
  // Las dos trampas que C6 dejó nombradas: el `(s)` y el plural hecho pegando una «s».
  assert.ok(!/\(s\)/.test(rotulo(1) + rotulo(3)), '🔴 ha aparecido un «(s)».');
  assert.notEqual(rotulo(1), rotulo(3).replace('líneas', 'lineas'));
  // Y el singular también manda en la coletilla, que es la otra mitad de la misma frase.
  assert.equal(rotulo({ cantidad: 1, fraseSinAtribuir: '1 línea entregada que no sale del presupuesto' }),
    '1 línea del presupuesto sin entregar · 1 línea entregada que no sale del presupuesto');
});

test('SCRUM-423 · el formato COPIA el de los otros cuatro huecos (medido, no supuesto)', () => {
  // Los cuatro vecinos son literales directos; el quinto tiene cuerpo porque compone la salvedad.
  // Se normalizan a su TEXTO para poder compararlos con la misma vara.
  const vecinos = [...VISTA.matchAll(/'(sin-[a-z-]+)':\s*\(h\)\s*=>\s*`([^`]*)`/g)]
    .map(([, id, tpl]) => ({ id, texto: tpl }));
  assert.equal(vecinos.length, 4, `🔴 se esperaban 4 rótulos de literal directo y hay ${vecinos.length}.`);

  const todos = [...vecinos, { id: 'sin-entregar', texto: rotulo(3) }];
  for (const { id, texto } of todos) {
    assert.ok(/^(\$\{|\d)/.test(texto), `🔴 «${id}» no empieza por su número/importe como los demás.`);
    assert.ok(!/\.$/.test(texto.trim()), `🔴 «${id}» acaba en punto y los otros no.`);
    assert.ok(!/[⬚•]/.test(texto), `🔴 «${id}» lleva un icono que los otros no tienen.`);
    assert.ok(!/^[A-ZÁÉÍÓÚÑ]/.test(texto), `🔴 «${id}» empieza con mayúscula y los otros no.`);
  }

  // El « · » sólo aparece SEPARANDO la salvedad, nunca de adorno en un rótulo simple.
  assert.ok(!rotulo(3).includes('·'), '🔴 el rótulo sin salvedad lleva un separador que no separa nada.');
});

// ══ ⑤ EL QUE CIERRA EL TICKET — `entregaPendiente.ts` YA NO ES INALCANZABLE ════════════════

test('SCRUM-423 · ⑤ `entregaPendiente.ts` sale de la lista de inalcanzables (medido por el censo)', async () => {
  // Con el censo de SCRUM-411, no a ojo: el ticket se cierra cuando el propio mecanismo que
  // detectó el cierre en falso deja de señalar este módulo.
  const { analizar } = await import('./_alcance-dominio.mjs');
  const R = analizar(RAIZ);
  const inalcanzables = R.inalcanzables.map((x) => x.modulo);
  const analizados = R.modulos.map((x) => x.modulo);

  const MOTOR = 'src/modules/jobs/domain/entregaPendiente.ts';
  const ENCHUFE = 'src/modules/jobs/domain/entregaDelTrabajo.ts';

  // ⚠️ HERMANOS POSITIVOS PRIMERO (SCRUM-237), y aquí no son un trámite: si el censo dejara de
  // VER estos dos ficheros —porque cambian de carpeta, porque el analizador cambia el formato de
  // la ruta, o porque deja de mirar `domain/`— «no está entre los inalcanzables» sería cierto y
  // vacío, y este test daría verde para siempre sobre un módulo que nadie llama. Se exige primero
  // que el censo los TENGA, con el mismo token exacto.
  assert.ok(analizados.includes(MOTOR),
    `🔴 el censo no ve siquiera «${MOTOR}»: la negación de abajo sería un verde permanente.`);
  assert.ok(analizados.includes(ENCHUFE), `🔴 el censo no ve siquiera «${ENCHUFE}».`);
  assert.ok(inalcanzables.length > 0,
    '🔴 la lista de inalcanzables está VACÍA: o se arregló todo el repo, o el censo no midió nada.');

  assert.ok(!inalcanzables.includes(MOTOR),
    '🔴 `entregaPendiente.ts` SIGUE siendo inalcanzable: el motor de C6 continúa sin llegar a ' +
    `ningún profesional. Inalcanzables hoy:\n   ${inalcanzables.join('\n   ')}`);

  // Y el adaptador tampoco puede nacer huérfano: sería cambiar un cierre en falso por otro.
  assert.ok(!inalcanzables.includes(ENCHUFE), '🔴 el adaptador de este ticket ha nacido inalcanzable.');
});
