// tests/scrum441-selector-metodo.test.mjs — SCRUM-441
//
// LA SUPERFICIE QUE LE FALTABA AL MOTOR. La columna `invoices.paid_via` existía, el API la
// aceptaba y el dominio la validaba — y **nadie la mandaba**: un motor sin superficie, que es la
// enfermedad que este ticket vino a cerrar y no a repetir.
//
// 🔴 EL CONTROL NEGATIVO VA PRIMERO, y es la mitad importante: quien marca una factura como cobrada
// y se va tiene que poder seguir haciendo EXACTAMENTE eso. Un campo nuevo que obliga a contestar
// convierte un gesto de un toque en uno de dos.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);

const { opcionesDeMetodoDeclarable } = require_(path.join(RAIZ, 'dist/modules/billing/domain/metodoDeCobro.js'));
const { PAID_VIA } = require_(path.join(RAIZ, 'dist/modules/billing/domain/paidVia.js'));
const { campoPaidViaAlMarcar } = require_(path.join(RAIZ, 'dist/modules/billing/domain/metodoDeCobro.js'));

// El módulo del front es un `<script>` clásico: publica en `window` al cargarse, así que en Node
// hay que darle uno. En el navegador `window` ES el global, y así se replica —el mismo detalle que
// costó una versión entera del banco de vistas (SCRUM-417)—.
globalThis.window = globalThis;
const selector = require_(path.join(RAIZ, 'public/dashboard/js/selectorMetodoCobro.js'));

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-441 · SUELO: hay opciones y salen del conjunto cerrado', () => {
  const ops = opcionesDeMetodoDeclarable();
  assert.ok(ops.length >= 4, `🔴 solo hay ${ops.length} opciones: el selector no ofrece los métodos.`);
  // Cada valor ofrecido tiene que ser ESCRIBIBLE de verdad. Si no, la pantalla ofrecería algo que
  // el servidor rechaza en silencio — y el profesional creería haberlo dicho.
  for (const o of ops) {
    assert.deepEqual(campoPaidViaAlMarcar('paid', o.valor), { paidVia: o.valor },
      `🔴 «${o.valor}» se ofrece en el selector y el dominio NO lo escribe.`);
  }
});

// ── EL CONTROL NEGATIVO, PRIMERO ─────────────────────────────────────────────────────────────

test('SCRUM-441 · 🔴 CONTROL NEGATIVO: «sin especificar» NO manda el campo', () => {
  // `null` = no eligió. El cuerpo tiene que salir IDÉNTICO al de siempre.
  const cuerpo = selector.cuerpoConMetodo({ status: 'paid' }, null);
  assert.deepEqual(cuerpo, { status: 'paid' },
    '🔴 el cuerpo lleva algo más que el estado. Marcar cobrada sin elegir método tiene que ' +
    'producir exactamente la misma petición que antes de que este selector existiera.');
  assert.equal(Object.prototype.hasOwnProperty.call(cuerpo, 'paidVia'), false,
    '🔴 va `paidVia` en el cuerpo. Mandarlo vacío o `null` sería afirmar algo que nadie dijo.');

  // Y un `<select>` con la opción vacía seleccionada es exactamente ese caso.
  assert.equal(selector.metodoElegido({ value: '' }), null);
  assert.equal(selector.metodoElegido(null), null);
  assert.deepEqual(selector.cuerpoConMetodo({ status: 'paid' }, { value: '' }), { status: 'paid' });

  // Cierre del círculo: eso, en el dominio, NO toca la columna.
  assert.deepEqual(campoPaidViaAlMarcar('paid', undefined), {},
    '🔴 el dominio tocaría la columna con un método que nadie eligió.');
});

test('SCRUM-441 · elegir un método SÍ lo manda', () => {
  assert.deepEqual(selector.cuerpoConMetodo({ status: 'paid' }, { value: 'transfer' }),
    { status: 'paid', paidVia: 'transfer' });
});

// ── LAS OPCIONES SE DERIVAN, NO SE ESCRIBEN ──────────────────────────────────────────────────

test('SCRUM-441 · 🔴 los rótulos aprobados, y los CUATRO que son', () => {
  const ops = opcionesDeMetodoDeclarable();
  assert.deepEqual(ops.map((o) => o.rotulo), ['Bizum', 'tarjeta', 'transferencia', 'efectivo'],
    '🔴 los rótulos o su orden no son los aprobados (regla 30). El orden es el del diseño §B4, ' +
    'propiedad del cubo, no el de `PAID_VIA`.');
});

test('SCRUM-441 · 🔴 el Bizum declarable a mano es `bizum_manual`, NUNCA `bizum_auto`', () => {
  const bizum = opcionesDeMetodoDeclarable().find((o) => o.rotulo === 'Bizum');
  assert.equal(bizum.valor, 'bizum_manual',
    '🔴 el selector guardaría `bizum_auto`, que significa «lo confirmó la pasarela». Una persona ' +
    'no puede afirmar eso a mano: sería inventar una cadena de evidencia que no existe.');
  assert.equal(opcionesDeMetodoDeclarable().some((o) => o.valor === 'bizum_auto'), false);
});

test('SCRUM-441 · SUELO: las opciones se DERIVAN de PAID_VIA, no son una lista suelta', () => {
  // Todo valor ofrecido pertenece al conjunto cerrado. Si alguien escribiera aquí una lista a mano,
  // podría colar un valor que no está en él y esto lo cazaría.
  for (const o of opcionesDeMetodoDeclarable()) {
    assert.ok(PAID_VIA.includes(o.valor),
      `🔴 «${o.valor}» se ofrece y NO está en PAID_VIA: hay una segunda lista de métodos.`);
  }
});

// ── UNA SOLA LISTA, EN UNA SOLA PIEZA ────────────────────────────────────────────────────────

/**
 * EXCEPCIÓN DECLARADA, con su motivo — no un fichero que el guard se salta en silencio.
 *
 * `cobrosView.js` conserva `COBROS_METODOS`, la lista a mano que SCRUM-474 dejó de usar para pintar
 * la barra de filtros. **No se borra a propósito:** SCRUM-481 (traducir la columna a castellano) va
 * por otro carril y puede estar apoyándose en ella (regla 9). La decisión de retirarla es de quien
 * aterrice después de ese ticket, no de éste.
 *
 * Está aquí y no dentro del detector para que se lea en el diff: el día que 481 cierre, se quita
 * esta línea y el guard vuelve a cubrir el fichero entero. Si se borra la lista y esta excepción se
 * queda, no pasa nada — pero si se añade una lista nueva a otra vista, salta.
 */
const VISTAS_EXCEPTUADAS = Object.freeze(['cobrosView.js']);

test('SCRUM-441 · 🔴 NINGUNA vista escribe su propia lista de métodos', () => {
  const vistas = ['invoiceDetailView.js', 'quotesDetailView.js', 'invoicesView.js', 'cobrosView.js']
    .filter((v) => !VISTAS_EXCEPTUADAS.includes(v));
  assert.ok(vistas.length >= 3, `🔴 solo quedan ${vistas.length} vistas por mirar: el guard se ha vaciado.`);
  for (const v of vistas) {
    const fuente = leer(`public/dashboard/js/${v}`)
      // Se quitan los comentarios ANTES de mirar: si no, este guard se caza a sí mismo en la
      // frase que explica la prohibición. Ha mordido cuatro veces a esta casa.
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    for (const via of PAID_VIA) {
      assert.equal(fuente.includes(`'${via}'`), false,
        `🔴 «${via}» está escrito a mano en ${v}. El conjunto cerrado se sirve desde el servidor ` +
        '(regla 22): una copia en el front es la que SCRUM-474 arrancó de `cobrosView.js`.');
    }
  }
});

test('SCRUM-441 · los dos sitios cableados usan la MISMA pieza', () => {
  for (const v of ['invoiceDetailView.js', 'quotesDetailView.js']) {
    const fuente = leer(`public/dashboard/js/${v}`);
    assert.match(fuente, /window\.pintarSelectorMetodo/,
      `🔴 ${v} no pinta el selector compartido.`);
    assert.match(fuente, /window\.cuerpoConMetodo/,
      `🔴 ${v} arma el cuerpo por su cuenta en vez de usar la pieza común.`);
  }
  // Y el módulo está montado en la página: si no, nada de lo anterior existe en el navegador.
  assert.match(leer('public/dashboard/index.html'), /selectorMetodoCobro\.js/,
    '🔴 la pieza no está en `index.html`: el navegador no la carga y las vistas no la encuentran.');
});
