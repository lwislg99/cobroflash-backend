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

test('SCRUM-423 · ② un número INCOMPLETO tampoco se pinta: `sinAtribuir` lo bloquea', () => {
  // Hay entregas atribuidas (así que el resumen SÍ es calculable) y ADEMÁS una línea entregada que
  // no sale del presupuesto. El número dejaría fuera esa entrega y no podría decirlo con copy
  // aprobada, así que no se pinta. C6: «un número que resume tiene que declarar lo que no pudo
  // contar».
  const albMixto = {
    estado: 'firmado', modoValoracion: 'SIN_VALORAR',
    lineas: [{ concepto: 'a', cantidad: 1, quoteLineIndex: 0 }, { concepto: 'b', cantidad: 1 }],
  };
  const vista = entregaParaVista(entregaDelTrabajo([quoteCon(1, 1, 1)], [albMixto]));
  assert.equal(vista.calculable, true, '🔴 precondición: este caso TIENE que ser calculable.');
  assert.ok(vista.lineasPendientes > 0, '🔴 precondición: tiene que quedar algo pendiente.');
  assert.equal(vista.sinAtribuir, 1, '🔴 precondición: tiene que haber 1 línea sin atribuir.');

  assert.equal(G5.huecosDeCobro({ entregaPendiente: vista }).filter((x) => x.id === 'sin-entregar').length, 0,
    '🔴 se pinta un número que NO cuenta una entrega real y no lo declara. Es peor que no dar número.');
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
/** El rótulo tal y como lo produciría la vista, sin montar un DOM. */
function rotulo(cantidad) {
  const m = /'sin-entregar':\s*\(h\)\s*=>\s*(`[^`]*`)/.exec(VISTA);
  assert.ok(m, '🔴 no se encuentra el rótulo de `sin-entregar` en jobDetailView.js.');
  return new Function('h', `return ${m[1]};`)({ cantidad });
}

test('SCRUM-423 · copy aprobada: SINGULAR REAL con n=1, nunca «1 líneas» ni «línea(s)»', () => {
  assert.equal(rotulo(1), '1 línea del presupuesto sin entregar');
  assert.equal(rotulo(3), '3 líneas del presupuesto sin entregar');
  // Las dos trampas que C6 dejó nombradas: el `(s)` y el plural hecho pegando una «s».
  assert.ok(!/\(s\)/.test(rotulo(1) + rotulo(3)), '🔴 ha aparecido un «(s)».');
  assert.notEqual(rotulo(1), rotulo(3).replace('líneas', 'lineas'));
});

test('SCRUM-423 · el formato COPIA el de los otros cuatro huecos (medido, no supuesto)', () => {
  const rotulos = [...VISTA.matchAll(/'(sin-[a-z-]+)':\s*\(h\)\s*=>\s*`([^`]*)`/g)]
    .map(([, id, tpl]) => ({ id, tpl }));
  assert.equal(rotulos.length, 5, `🔴 se esperaban 5 rótulos y hay ${rotulos.length}.`);

  for (const { id, tpl } of rotulos) {
    assert.ok(tpl.startsWith('${'), `🔴 «${id}» no empieza por su número/importe como los demás.`);
    assert.ok(!/\.$/.test(tpl.trim()), `🔴 «${id}» acaba en punto y los otros no.`);
    assert.ok(!/[⬚•·]/.test(tpl), `🔴 «${id}» lleva un icono que los otros no tienen.`);
  }
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
