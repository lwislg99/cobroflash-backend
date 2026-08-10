// tests/scrum448-cobros-estado-de-carga.test.mjs — SCRUM-448
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA: un profesional con mala cobertura abre Cobros, la petición se queda en el aire, y la
// pantalla le afirma **«Todavía no hay cobros registrados.»** Cierra tranquilo: no le debe nadie
// nada, según nosotros.
//
// 🔴 NO ERA EL TEXTO: FALTABA UN ESTADO. SCRUM-285 separó con cuidado los dos vacíos —«no hay
// ninguno» y «tu filtro los esconde»— y el tercero, **«todavía no lo sabemos»**, caía en el
// primero porque `datos` está vacío antes de que llegue la respuesta.
//
// Lo encontró el banco de SCRUM-362 en su primer uso, con el escenario «acepta y no entrega».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { redNormal, aceptaYNoEntrega, llegaTarde } from './_banco-red.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const COBRO_PENDIENTE = {
  origen: 'invoice', id: 1, fecha: '2026-07-01T10:00:00.000Z', cliente: 'Me debe',
  concepto: null, importe: '80.00', moneda: 'EUR', metodo: null, estado: 'pending',
  referencia: null, numero: 'F-2026-0007', tipo: 'F1', invoiceId: 1, chargeId: null,
};

async function abrirCobros(red, extra = {}) {
  const banco = cargarDashboard(RAIZ, { red, ...extra });
  const r = await pintarVista(banco, 'renderCobrosView');
  const texto = r.contenedor ? todos(r.contenedor).map((n) => n.textContent).filter(Boolean).join(' | ') : '';
  return { banco, r, texto };
}

// ═══ EL TEST QUE DECIDE, con su control positivo DENTRO ══════════════════════════════════

test('SCRUM-448 · con la petición EN VUELO, la pantalla NO afirma que no hay cobros', async () => {
  const red = aceptaYNoEntrega();
  const { r, texto } = await abrirCobros(red);

  // 🔴 SUELO: si el banco no consigue dejar la petición colgada, esto no mide nada. «La pantalla se
  // porta bien» y «no supe cortar la red» dan el mismo verde y significan lo contrario.
  assert.ok(red.seEjercio(),
    `🔴 BANCO CIEGO: la pantalla no llegó a pedir nada (${red.describir()}).`);
  assert.equal(red.reg.colgadas, 1,
    `🔴 la petición no se quedó en el aire (${red.describir()}): el escenario no se ha montado y ` +
    'este test estaría aprobando la pantalla sin haberla puesto nunca sin cobertura.');
  assert.equal(r.error, null, `🔴 la pantalla revienta: ${r.error && r.error.message}`);

  // Control positivo DENTRO: si la vista no pintara nada en absoluto, «no afirma» sería cierto y
  // no significaría nada. La cabecera y los filtros SÍ tienen que estar.
  assert.match(texto, /Cobros/, '🔴 la pantalla no ha pintado ni su título: no está midiendo nada.');
  assert.match(texto, /Bizum/, '🔴 no se han pintado los filtros.');

  // Y lo que decide: no se afirma nada sobre unos datos que no han llegado.
  assert.ok(!/Todavía no hay cobros registrados/.test(texto),
    '🔴 con la petición TODAVÍA EN EL AIRE la pantalla afirma que no hay cobros. Le está diciendo ' +
    'al profesional que no le debe nadie nada cuando lo único cierto es que no lo sabemos.');
  assert.ok(!/Ningún cobro coincide con este filtro/.test(texto),
    '🔴 la pantalla afirma que el filtro no casa con nada, y todavía no hay «nada» con lo que casar.');
});

// ═══ LOS OTROS DOS ESTADOS NO CAMBIAN — son los que más fácil se rompen al tocar esto ════

test('SCRUM-448 · SIN COBROS sigue diciendo lo suyo', async () => {
  const { r, texto } = await abrirCobros(redNormal([]));
  assert.equal(r.error, null);
  assert.match(texto, /Todavía no hay cobros registrados\./,
    '🔴 al arreglar el estado de carga se ha perdido el vacío de verdad: ahora, sin ningún cobro, ' +
    'la pantalla no dice nada. Callar tampoco informa.');
});

test('SCRUM-448 · CON FILTRO que no casa sigue diciendo lo suyo', async () => {
  const { banco, r, texto } = await abrirCobros(redNormal([COBRO_PENDIENTE]));
  assert.equal(r.error, null);
  assert.match(texto, /F-2026-0007/, 'suelo: el cobro se ha pintado antes de filtrar.');

  const botonCash = todos(r.contenedor)
    .find((n) => n.dataset && n.dataset.filtroCobro === 'cash');
  assert.ok(botonCash, 'suelo: sin el filtro de efectivo no se puede provocar el caso.');
  botonCash.dispararClick();

  const despues = todos(r.contenedor).map((n) => n.textContent).filter(Boolean).join(' | ');
  assert.match(despues, /Ningún cobro coincide con este filtro\./,
    '🔴 con datos cargados y un filtro que no casa, la pantalla ya no lo dice. Se ha perdido la ' +
    'distinción que SCRUM-285 construyó.');
  assert.ok(!/Todavía no hay cobros registrados/.test(despues),
    '🔴 con el filtro puesto dice «no hay cobros»: vuelve a afirmar que no le deben nada.');
  assert.ok(banco.ctx.COBROS_COPY, 'suelo: la copia sigue publicada.');
});

// ═══ EL CASO QUE DECIDE EL DISEÑO: cuando la respuesta NO LLEGA NUNCA ════════════════════

test('SCRUM-448 · si la respuesta no llega nunca, VENCE EL PLAZO y se avisa', async () => {
  // Un indicador de carga eterno tampoco sirve. Al vencer se dice lo mismo que cuando falla, con
  // el texto YA APROBADO en SCRUM-285: para quien mira es el mismo hecho.
  //
  // El plazo se baja a 5 ms: esperar quince segundos de verdad sería un test que nadie corre.
  const red = aceptaYNoEntrega();
  const banco = cargarDashboard(RAIZ, { red });
  banco.ctx.COBROS_PLAZO_MS = 5;
  const contenedor = banco.mk('div');
  banco.ctx.renderCobrosView(contenedor);
  await new Promise((res) => setTimeout(res, 40));

  const texto = todos(contenedor).map((n) => n.textContent).filter(Boolean).join(' | ');
  assert.equal(red.reg.colgadas, 1, 'suelo: la petición sigue en el aire, que es el caso.');
  assert.match(texto, /No hemos podido cargar los cobros\. Vuelve a intentarlo\./,
    '🔴 pasado el plazo la pantalla sigue muda. La respuesta no va a llegar, y dejar al ' +
    'profesional mirando una tabla vacía sin decirle nada no es mejor que mentirle: es no ' +
    'contestarle.');
  assert.ok(!/Todavía no hay cobros registrados/.test(texto),
    '🔴 al vencer el plazo se afirma que no hay cobros. Sigue sin saberse.');
});

test('SCRUM-448 · EL DATO GANA AL MENSAJE: llega tras vencer el plazo y SUSTITUYE al aviso', async () => {
  // Lo que vence NUNCA puede acabar contándose como «no hay cobros»: eso es el defecto entero de
  // este ticket, y colarlo por la puerta del plazo sería reintroducirlo.
  const red = llegaTarde(40, [COBRO_PENDIENTE]);
  const banco = cargarDashboard(RAIZ, { red });
  banco.ctx.COBROS_PLAZO_MS = 5; // vence mucho antes de que la respuesta llegue
  const contenedor = banco.mk('div');
  banco.ctx.renderCobrosView(contenedor);

  await new Promise((res) => setTimeout(res, 20));
  const durante = todos(contenedor).map((n) => n.textContent).filter(Boolean).join(' | ');
  assert.match(durante, /No hemos podido cargar los cobros/,
    'suelo: el plazo tiene que haber vencido ya, o este test no prueba la sustitución.');

  await new Promise((res) => setTimeout(res, 80));
  const despues = todos(contenedor).map((n) => n.textContent).filter(Boolean).join(' | ');
  assert.match(despues, /F-2026-0007/,
    '🔴 la respuesta llegó tarde y la pantalla sigue con el aviso. El dato gana al mensaje: si los ' +
    'cobros están, se enseñan.');
  assert.ok(!/No hemos podido cargar/.test(despues),
    '🔴 se enseñan los cobros Y el aviso a la vez: el profesional no sabe cuál creer.');
});

test('SCRUM-448 · CARRERA: una respuesta VIEJA que llega después NO pinta', async () => {
  // Sin `AbortController` (SCRUM-451) la petición vencida sigue viva y VA A LLEGAR. Sin contador:
  // vence → se relanza → llega la nueva y pinta bien → llega la vieja y pinta encima datos MÁS
  // VIEJOS, sin que nada lo diga. Es el defecto que nadie ve hasta que muerde.
  //
  // ⚠️ El segundo lanzamiento se simula incrementando el contador, porque hoy la pantalla no tiene
  // botón de reintentar: lo que se prueba es la GUARDA, que es lo que este ticket añade.
  const red = llegaTarde(40, [COBRO_PENDIENTE]);
  const banco = cargarDashboard(RAIZ, { red });
  banco.ctx.COBROS_PLAZO_MS = 5;
  const contenedor = banco.mk('div');
  banco.ctx.renderCobrosView(contenedor);

  const antes = banco.ctx.cobrosSecuencia;
  assert.equal(typeof antes, 'number',
    '🔴 no hay contador de secuencia: sin él, una respuesta vieja pinta encima de una nueva.');
  banco.ctx.cobrosSecuencia = antes + 1; // como si se hubiera lanzado otra petición

  await new Promise((res) => setTimeout(res, 90));
  const texto = todos(contenedor).map((n) => n.textContent).filter(Boolean).join(' | ');
  assert.ok(!/F-2026-0007/.test(texto),
    '🔴 la respuesta de una petición VIEJA ha pintado. Con una más nueva en marcha, eso sustituye ' +
    'datos buenos por datos peores y el profesional se queda mirando una lista vieja sin saberlo.');
});

test('SCRUM-448 · tras el aviso, FILTRAR no lo convierte en «no hay cobros»', async () => {
  // El agujero que apareció al añadir el plazo: con una sola bandera, pulsar un filtro después del
  // aviso volvía a llamar a `pintarFilas()` con la lista vacía y la pantalla decía «no hay cobros».
  const red = aceptaYNoEntrega();
  const banco = cargarDashboard(RAIZ, { red });
  banco.ctx.COBROS_PLAZO_MS = 5;
  const contenedor = banco.mk('div');
  banco.ctx.renderCobrosView(contenedor);
  await new Promise((res) => setTimeout(res, 40));

  const boton = todos(contenedor).find((n) => n.dataset && n.dataset.filtroCobro === 'cash');
  assert.ok(boton, 'suelo: sin filtros no se puede provocar el caso.');
  boton.dispararClick();

  const texto = todos(contenedor).map((n) => n.textContent).filter(Boolean).join(' | ');
  assert.ok(!/Todavía no hay cobros registrados|Ningún cobro coincide/.test(texto),
    '🔴 un clic en un filtro ha convertido «no sabemos» en «no hay». El defecto de este ticket, ' +
    'reintroducido por la puerta del plazo.');
  assert.match(texto, /No hemos podido cargar los cobros/,
    '🔴 al filtrar se ha perdido el aviso y la tabla se ha quedado muda.');
});

test('SCRUM-448 · el plazo son 10 s, en UNA constante con nombre y en UN sitio', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/cobrosView.js'), 'utf8');
  assert.match(fuente, /var COBROS_PLAZO_MS = \(typeof window !== 'undefined' && window\.COBROS_PLAZO_MS\) \|\| 10000;/,
    '🔴 el plazo no son 10000 ms en su constante. Decisión del fundador, y va en UN sitio porque ' +
    'este número cambia en cuanto midamos: cambiarlo tiene que ser cambiar una línea.');
  const usos = (fuente.match(/COBROS_PLAZO_MS/g) || []).length;
  assert.equal(usos, 3,
    `🔴 \`COBROS_PLAZO_MS\` aparece ${usos} veces (esperadas 3: el comentario del bloque, la ` +
    'declaración y el `setTimeout`). Si hay otra, el plazo ya vive en dos sitios.');
  // Sin comentarios y SIN la línea de la propia declaración: si no, el escáner se caza a sí mismo
  // con el `10000` que va a buscar. (Ante un rojo raro, el primer sospechoso es el escáner — y lo
  // era: esta aserción nació roja por eso.)
  const codigo = fuente
    .replace(/\/\/[^\n]*|\/\*[^]*?\*\//g, '')
    .split('\n').filter((l) => !l.includes('var COBROS_PLAZO_MS =')).join('\n');
  assert.doesNotMatch(codigo, /\b1[05]000\b/,
    '🔴 hay otro número de plazo suelto fuera de la constante. El plazo vive en UN sitio porque va ' +
    'a cambiar en cuanto midamos.');
});

test('SCRUM-448 · el plazo NO pisa una respuesta que sí llegó', async () => {
  // Control negativo del plazo: si llega a tiempo, el aviso no puede aparecer después y borrar los
  // datos que el profesional ya está leyendo.
  const banco = cargarDashboard(RAIZ, { red: redNormal([COBRO_PENDIENTE]) });
  banco.ctx.COBROS_PLAZO_MS = 5;
  const contenedor = banco.mk('div');
  banco.ctx.renderCobrosView(contenedor);
  await new Promise((res) => setTimeout(res, 40));

  const texto = todos(contenedor).map((n) => n.textContent).filter(Boolean).join(' | ');
  assert.match(texto, /F-2026-0007/,
    '🔴 el plazo se ha llevado por delante unos datos que SÍ habían llegado.');
  assert.ok(!/No hemos podido cargar/.test(texto),
    '🔴 se avisa de que no se pudo cargar cuando sí se pudo.');
});
