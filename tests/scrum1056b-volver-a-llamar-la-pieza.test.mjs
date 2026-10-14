// tests/scrum1056b-volver-a-llamar-la-pieza.test.mjs — SCRUM-1056, la mitad de S2.
//
// «Volver a llamar»: una tarea con fecha dentro del cliente. La ficha y la lista son de J2 y las
// rutas, de S1 (no existen al escribir esto). Lo que hay aquí es la PIEZA que las dos pantallas
// montarán: `public/dashboard/js/clienteVolverALlamar.js`. No conoce ninguna ruta: recibe la
// llamada y dos funciones, `guardar` y `hecho`.
//
// Firmado por el orquestador por delegación del fundador (SCRUM-1056, comentario 19401): los
// literales de abajo, y la decisión de que una fecha en el pasado SE ACEPTA y nace vencida, porque
// «hoy» sólo lo sabe el servidor.
//
// LO QUE ESTE TEST NO MIDE, dicho aquí: que la ficha y la lista la monten (no la montan todavía) y
// qué contesta el servidor de verdad. `guardar` y `hecho` son aquí dos funciones de mentira.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIEZA = 'public/dashboard/js/clienteVolverALlamar.js';

// Los catorce de c.19401, letra por letra. B11 («Llamada hecha») lo escribe el servidor en el
// historial: no es de esta pieza y no está aquí.
const FIRMADOS = {
  titulo: 'Volver a llamar', // B1
  ponerFecha: 'Poner fecha', // B2
  hoy: 'Volver a llamar hoy', // B4
  dia: 'Día', // B6
  nota: 'Nota de la llamada', // B7
  hecho: 'Hecho', // B8
  cambiar: 'Cambiar', // B9
  marcaHoy: 'Llamar hoy', // B10
  noGuardado: 'No se ha podido guardar la llamada. Inténtalo de nuevo.', // B12 (c.19649: acaba en «de nuevo», la forma de la casa)
  noMarcado: 'No se ha podido marcar como hecha. Inténtalo de nuevo.', // B15 (c.19453; final cambiado en c.19649): el fallo de «Hecho»
  guardar: 'Guardar', // B13
  cancelar: 'Cancelar', // B14
};
const FUTURO = (f) => `Volver a llamar el ${f}`; // B3
const VENCIDO = (f) => `Había que llamar el ${f}`; // B5
const MARCA_VENCIDA = (f) => `Llamar: ${f}`; // B10

const banco = cargarDashboard(RAIZ);
const P = banco.ctx.clienteVolverALlamar;

const tic = () => new Promise((r) => setImmediate(r));
const textos = (c, tag) => todos(c).filter((n) => n.tagName === tag).map((n) => n.textContent);
const botones = (c) => todos(c).filter((n) => n.tagName === 'BUTTON');
const boton = (c, texto) => {
  const b = botones(c).filter((n) => n.textContent === texto);
  assert.equal(b.length, 1, `se esperaba UN botón «${texto}» y hay ${b.length} (botones: ${botones(c).map((n) => n.textContent).join(' · ') || 'ninguno'})`);
  return b[0];
};
const campo = (c, tag) => {
  const n = todos(c).filter((x) => x.tagName === tag);
  assert.equal(n.length, 1, `se esperaba UN <${tag.toLowerCase()}> y hay ${n.length}`);
  return n[0];
};
const avisos = (c) => todos(c).filter((n) => n.getAttribute && n.getAttribute('role') === 'alert');

/** Monta la pieza con un servidor de mentira que apunta lo que recibe. */
function montada(llamada, { guardar, hecho } = {}) {
  const contenedor = banco.mk('div');
  const visto = { guardar: [], hecho: 0 };
  const pintado = P.montar(contenedor, {
    llamada,
    guardar: (datos) => { visto.guardar.push(datos); return guardar ? guardar(datos) : Promise.resolve({ ...datos, estado: 'futuro' }); },
    hecho: () => { visto.hecho += 1; return hecho ? hecho() : Promise.resolve(); },
  });
  return { contenedor, visto, pintado };
}

test('SCRUM-1056 · SUELO: la pieza se carga con el panel, por el índice, y sin errores', () => {
  assert.equal(typeof P, 'object', '🔴 `clienteVolverALlamar` no está en el contexto: el índice no carga la pieza, y todo lo de abajo no mediría nada');
  assert.equal(typeof P.montar, 'function');
  assert.ok(banco.scripts.some((s) => String(s.fichero || s).includes('clienteVolverALlamar.js')), 'la pieza no está entre los scripts que el banco leyó del índice');
  assert.deepEqual(banco.fallos, [], 'el panel carga con fallos');
});

test('SCRUM-1056 · los textos son los firmados en c.19401, letra por letra', () => {
  assert.deepEqual({ ...P.TEXTOS }, FIRMADOS, '🔴 un texto fijo no es el firmado, o hay uno de más o de menos');
  assert.equal(P.FRASES.futuro('16/10/2026'), FUTURO('16/10/2026'));
  assert.equal(P.FRASES.vencido('16/10/2026'), VENCIDO('16/10/2026'));
  assert.equal(P.FRASES.marcaVencida('16/10/2026'), MARCA_VENCIDA('16/10/2026'));
  assert.deepEqual(Object.keys(P.FRASES).sort(), ['futuro', 'marcaVencida', 'vencido'], 'hay una frase con fecha que nadie firmó');
});

test('SCRUM-1056 · el día se escribe partiendo el texto, sin pasar por una fecha con hora', () => {
  assert.equal(P.diaLegible('2026-10-16'), '16/10/2026');
  assert.equal(P.diaLegible('2026-01-01'), '01/01/2026', 'el 1 de enero no puede salir como 31 de diciembre');
  for (const malo of ['16/10/2026', '2026-10-16T00:00:00.000Z', '2026-1-5', '', null, undefined, 20261016]) {
    assert.equal(P.diaLegible(malo), null, `«${malo}» no es un día AAAA-MM-DD`);
  }
});

test('SCRUM-1056 · la marca de la lista: sólo si toca hoy o está vencida', () => {
  assert.equal(P.textoDeLaMarca({ dia: '2026-10-13', nota: '', estado: 'hoy' }), FIRMADOS.marcaHoy);
  assert.equal(P.textoDeLaMarca({ dia: '2026-10-01', nota: '', estado: 'vencido' }), MARCA_VENCIDA('01/10/2026'), 'fecha pasada = vencido: lleva marca con su fecha');
  assert.equal(P.textoDeLaMarca({ dia: '2026-12-01', nota: '', estado: 'futuro' }), null, 'una llamada para más adelante no lleva marca');
  assert.equal(P.textoDeLaMarca({ dia: null }), null, 'sin fecha no hay marca');
});

test('SCRUM-1056 · 🔴 lo que no se entiende NO es «no hay ninguna»: ni marca ni bloque', () => {
  const RAROS = [
    ['sin objeto', null],
    ['sin objeto (undefined)', undefined],
    ['día con otra forma', { dia: '13/10/2026', estado: 'hoy' }],
    ['día sin estado', { dia: '2026-10-13' }],
    ['estado que nadie definió', { dia: '2026-10-13', estado: 'pronto' }],
  ];
  for (const [que, llamada] of RAROS) {
    assert.equal(P.leer(llamada), null, `${que}: tenía que leerse como «no se entiende»`);
    assert.equal(P.textoDeLaMarca(llamada), null, `${que}: no puede llevar marca`);
    const m = montada(llamada);
    assert.equal(m.pintado, false, `${que}: montar tenía que decir que no pintó`);
    assert.equal(todos(m.contenedor).length, 1, `${que}: el bloque tenía que quedar vacío, y «Poner fecha» afirmaría que no hay ninguna`);
  }
  // Control: «sin fecha» sí se entiende, de las tres formas en que puede llegar.
  for (const llamada of [{ dia: null }, {}, { dia: '' }]) {
    assert.deepEqual({ ...P.leer(llamada) }, { dia: null, nota: '', estado: null });
  }
});

test('SCRUM-1056 · ficha sin fecha: el título y «Poner fecha», nada más', () => {
  const m = montada({ dia: null, nota: null, estado: null });
  assert.equal(m.pintado, true);
  assert.deepEqual(textos(m.contenedor, 'DIV').filter((t) => t === FIRMADOS.titulo), [FIRMADOS.titulo]);
  assert.deepEqual(botones(m.contenedor).map((b) => b.textContent), [FIRMADOS.ponerFecha]);
  assert.deepEqual(textos(m.contenedor, 'P'), []);
});

test('SCRUM-1056 · ficha con fecha: la frase la decide el ESTADO que manda el servidor', () => {
  const CASOS = [
    ['futuro', '2026-12-01', FUTURO('01/12/2026')],
    ['hoy', '2026-10-13', FIRMADOS.hoy],
    ['vencido', '2026-10-01', VENCIDO('01/10/2026')],
  ];
  for (const [estado, dia, frase] of CASOS) {
    const m = montada({ dia, nota: '  Preguntar por la caldera  ', estado });
    assert.deepEqual(textos(m.contenedor, 'P'), [frase, 'Preguntar por la caldera'], `${estado}: frase y nota`);
    assert.deepEqual(botones(m.contenedor).map((b) => b.textContent), [FIRMADOS.hecho, FIRMADOS.cambiar], `${estado}: acciones`);
    // La nota es texto libre: lleva la clase que parte una palabra larga. Sin ella se salía de la
    // tarjeta a 390 px, y eso lo vio el navegador, no este banco (aquí sólo se fija la clase).
    assert.equal(todos(m.contenedor).filter((n) => n.tagName === 'P')[1].className, 'volver-a-llamar-nota', `${estado}: la nota sin su clase`);
  }
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(css, /\n\.volver-a-llamar-nota \{[^}]*overflow-wrap: anywhere;[^}]*\}/, '🔴 la hoja ya no parte las palabras largas de la nota');
  // 🔴 El mismo día con dos estados da dos frases: la pieza no lo decide mirando la fecha.
  const a = montada({ dia: '2099-01-01', nota: '', estado: 'vencido' });
  assert.deepEqual(textos(a.contenedor, 'P'), [VENCIDO('01/01/2099')], 'manda el estado del servidor aunque la fecha parezca lejana');
  const b = montada({ dia: '2001-01-01', nota: '', estado: 'futuro' });
  assert.deepEqual(textos(b.contenedor, 'P'), [FUTURO('01/01/2001')], 'manda el estado del servidor aunque la fecha parezca pasada');
});

test('SCRUM-1056 · poner fecha: viaja lo escrito y se pinta lo que DEVUELVE el servidor (fecha pasada = vencido)', async () => {
  const m = montada({ dia: null }, { guardar: (d) => Promise.resolve({ dia: d.dia, nota: d.nota, estado: 'vencido' }) });
  boton(m.contenedor, FIRMADOS.ponerFecha).click();
  assert.deepEqual(textos(m.contenedor, 'LABEL'), [FIRMADOS.dia, FIRMADOS.nota]);
  const dia = campo(m.contenedor, 'INPUT');
  const nota = campo(m.contenedor, 'TEXTAREA');
  assert.equal(dia.type, 'date');
  assert.deepEqual(textos(m.contenedor, 'LABEL').length, 2);
  assert.deepEqual(todos(m.contenedor).filter((n) => n.tagName === 'LABEL').map((l) => l.htmlFor), [dia.id, nota.id], 'cada rótulo apunta a su campo');
  dia.value = '2020-02-03';
  nota.value = '  Quedó en mirarlo  ';
  boton(m.contenedor, FIRMADOS.guardar).click();
  await tic();
  assert.deepEqual(m.visto.guardar.map((d) => ({ ...d })), [{ dia: '2020-02-03', nota: 'Quedó en mirarlo' }], 'una fecha en el pasado se MANDA: no la rechaza el formulario');
  assert.deepEqual(textos(m.contenedor, 'P'), [VENCIDO('03/02/2020'), 'Quedó en mirarlo']);
  assert.deepEqual(avisos(m.contenedor), []);
});

test('SCRUM-1056 · poner otra sustituye a la anterior: «Cambiar» abre lo que hay y guarda UNA', async () => {
  const m = montada({ dia: '2026-10-20', nota: 'Primera', estado: 'futuro' });
  boton(m.contenedor, FIRMADOS.cambiar).click();
  assert.equal(campo(m.contenedor, 'INPUT').value, '2026-10-20', 'el formulario nace con el día que había');
  assert.equal(campo(m.contenedor, 'TEXTAREA').value, 'Primera');
  campo(m.contenedor, 'INPUT').value = '2026-11-05';
  campo(m.contenedor, 'TEXTAREA').value = 'Segunda';
  boton(m.contenedor, FIRMADOS.guardar).click();
  await tic();
  assert.equal(m.visto.guardar.length, 1);
  assert.deepEqual(textos(m.contenedor, 'P'), [FUTURO('05/11/2026'), 'Segunda'], 'queda UNA llamada, la nueva');
  // «Cancelar» no manda nada y vuelve a lo que había.
  boton(m.contenedor, FIRMADOS.cambiar).click();
  campo(m.contenedor, 'INPUT').value = '2027-01-01';
  boton(m.contenedor, FIRMADOS.cancelar).click();
  assert.equal(m.visto.guardar.length, 1, '«Cancelar» no guarda');
  assert.deepEqual(textos(m.contenedor, 'P'), [FUTURO('05/11/2026'), 'Segunda']);
});

test('SCRUM-1056 · sin día no se guarda nada', async () => {
  const m = montada({ dia: null });
  boton(m.contenedor, FIRMADOS.ponerFecha).click();
  boton(m.contenedor, FIRMADOS.guardar).click();
  await tic();
  assert.equal(m.visto.guardar.length, 0, '🔴 se ha mandado una llamada sin día');
  assert.equal(botones(m.contenedor).length, 2, 'el formulario sigue abierto');
});

test('SCRUM-1056 · si guardar falla: se dice, UNA vez, y el formulario sigue con lo escrito', async () => {
  const m = montada({ dia: null }, { guardar: () => Promise.reject(new Error('500')) });
  boton(m.contenedor, FIRMADOS.ponerFecha).click();
  campo(m.contenedor, 'INPUT').value = '2026-10-20';
  campo(m.contenedor, 'TEXTAREA').value = 'No perder esto';
  boton(m.contenedor, FIRMADOS.guardar).click();
  await tic();
  boton(m.contenedor, FIRMADOS.guardar).click();
  await tic();
  assert.equal(m.visto.guardar.length, 2, 'el segundo intento tiene que salir: los botones se vuelven a encender');
  assert.deepEqual(avisos(m.contenedor).map((a) => a.textContent), [FIRMADOS.noGuardado], 'un solo aviso tras dos fallos');
  assert.equal(campo(m.contenedor, 'INPUT').value, '2026-10-20');
  assert.equal(campo(m.contenedor, 'TEXTAREA').value, 'No perder esto');
  assert.deepEqual(botones(m.contenedor).map((b) => b.disabled), [false, false]);
});

test('SCRUM-1056 · 🔴 guardado, pero lo devuelto no se entiende: no se inventa cuándo toca', async () => {
  const m = montada({ dia: null }, { guardar: () => Promise.resolve({ ok: true }) });
  boton(m.contenedor, FIRMADOS.ponerFecha).click();
  campo(m.contenedor, 'INPUT').value = '2026-10-20';
  boton(m.contenedor, FIRMADOS.guardar).click();
  await tic();
  // `{ ok: true }` no trae `dia`. Acaba de guardarse uno, así que tampoco vale «sin fecha»: ni una
  // frase con la fecha tecleada y un estado que el servidor no ha dicho, ni «Poner fecha».
  assert.equal(todos(m.contenedor).length, 1, 'el bloque tenía que quedar vacío');
  assert.deepEqual(avisos(m.contenedor), [], 'no falló: decir «no se ha podido guardar» sería falso');
  const n = montada({ dia: null }, { guardar: (d) => Promise.resolve({ dia: d.dia, nota: d.nota }) });
  boton(n.contenedor, FIRMADOS.ponerFecha).click();
  campo(n.contenedor, 'INPUT').value = '2026-10-20';
  boton(n.contenedor, FIRMADOS.guardar).click();
  await tic();
  assert.equal(todos(n.contenedor).length, 1, 'día sin estado: el bloque se queda vacío');
});

test('SCRUM-1056 · «Hecho»: llama una vez y deja el bloque sin fecha; si falla, lo dice y no cambia nada', async () => {
  const m = montada({ dia: '2026-10-13', nota: 'Llamar por la tarde', estado: 'hoy' });
  boton(m.contenedor, FIRMADOS.hecho).click();
  assert.deepEqual(botones(m.contenedor).map((b) => b.disabled), [true, true], 'mientras se marca no se puede pulsar dos veces');
  await tic();
  assert.equal(m.visto.hecho, 1);
  assert.deepEqual(botones(m.contenedor).map((b) => b.textContent), [FIRMADOS.ponerFecha]);
  assert.deepEqual(textos(m.contenedor, 'P'), []);

  const f = montada({ dia: '2026-10-13', nota: 'Llamar por la tarde', estado: 'hoy' }, { hecho: () => Promise.reject(new Error('500')) });
  boton(f.contenedor, FIRMADOS.hecho).click();
  await tic();
  assert.deepEqual(textos(f.contenedor, 'P'), [FIRMADOS.hoy, 'Llamar por la tarde'], 'no se marcó: la llamada sigue ahí');
  // SCRUM-1056c · el aviso dice lo que se pulsó. Hasta c.19453 aquí salía el de GUARDAR, que nombra
  // una acción que el profesional no acaba de hacer.
  assert.deepEqual(avisos(f.contenedor).map((a) => a.textContent), [FIRMADOS.noMarcado], '🔴 el fallo de «Hecho» no sale con su texto');
  assert.deepEqual(botones(f.contenedor).map((b) => b.disabled), [false, false]);
  // Y al segundo fallo sigue habiendo UNO: el bloque se repinta entero, no se apilan.
  boton(f.contenedor, FIRMADOS.hecho).click();
  await tic();
  assert.deepEqual(avisos(f.contenedor).map((a) => a.textContent), [FIRMADOS.noMarcado], 'un solo aviso tras dos fallos de «Hecho»');
});

test('SCRUM-1056c · cada fallo con su texto: el de guardar no sale al marcar, ni el de marcar al guardar', async () => {
  assert.notEqual(FIRMADOS.noMarcado, FIRMADOS.noGuardado, 'si los dos literales fueran el mismo, lo de abajo no distinguiría nada');
  // «Cambiar» sobre una llamada puesta, y falla guardar: el aviso es el de GUARDAR.
  const g = montada({ dia: '2026-10-13', nota: '', estado: 'hoy' }, { guardar: () => Promise.reject(new Error('500')), hecho: () => Promise.reject(new Error('500')) });
  boton(g.contenedor, FIRMADOS.cambiar).click();
  boton(g.contenedor, FIRMADOS.guardar).click();
  await tic();
  assert.deepEqual(avisos(g.contenedor).map((a) => a.textContent), [FIRMADOS.noGuardado], '🔴 el fallo de guardar ya no dice «guardar la llamada»');
  // Se cancela, y ahora falla «Hecho» en ESE MISMO bloque: sale el de marcar y el de guardar se ha ido.
  boton(g.contenedor, FIRMADOS.cancelar).click();
  assert.deepEqual(avisos(g.contenedor), [], 'cancelar no arrastra el aviso del formulario');
  boton(g.contenedor, FIRMADOS.hecho).click();
  await tic();
  assert.deepEqual(avisos(g.contenedor).map((a) => a.textContent), [FIRMADOS.noMarcado]);
  assert.equal(g.visto.guardar.length, 1);
  assert.equal(g.visto.hecho, 1);
});

test('SCRUM-1056 · 🔴 la pieza no conoce rutas ni mira el reloj (por AST, no por texto)', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, PIEZA), 'utf8');
  const sf = ts.createSourceFile(PIEZA, fuente, ts.ScriptTarget.Latest, true);
  const nombres = new Set();
  const cadenas = [];
  (function ver(n) {
    if (ts.isIdentifier(n)) nombres.add(n.text);
    if (ts.isStringLiteralLike(n)) cadenas.push(n.text);
    ts.forEachChild(n, ver);
  }(sf));
  // Suelo: el recorrido ve el fichero de verdad.
  assert.ok(nombres.has('montar') && nombres.has('textoDeLaMarca') && cadenas.includes(FIRMADOS.titulo), 'el AST no ve la pieza: lo de abajo no mediría nada');
  for (const prohibido of ['Date', 'fetch', 'apiRequest', 'XMLHttpRequest', 'Intl']) {
    assert.equal(nombres.has(prohibido), false, `🔴 la pieza usa \`${prohibido}\`: o ha aprendido una ruta, o decide «hoy» con el reloj del navegador`);
  }
  // Una ruta es una barra seguida de una letra («/admin…», «/api…») o una URL. La barra suelta que
  // separa día, mes y año no lo es: la primera versión de esta línea la contaba, y era un rojo falso.
  const esRuta = (c) => /^[/][a-z]/i.test(c) || c.includes('/admin') || /https?:/i.test(c);
  assert.equal(esRuta('/admin/customers/1/callback') && esRuta('/api/x') && !esRuta('/'), true, 'el detector de rutas no distingue una ruta de una barra');
  assert.deepEqual(cadenas.filter(esRuta), [], '🔴 hay una ruta escrita dentro de la pieza');
});
