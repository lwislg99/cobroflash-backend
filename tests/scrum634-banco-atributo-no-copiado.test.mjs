// tests/scrum634-banco-atributo-no-copiado.test.mjs — SCRUM-634
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL BANCO DE VISTAS DEVOLVÍA `null` EN SILENCIO POR UN ATRIBUTO QUE NO COPIABA.
//
// El parser de `innerHTML` copiaba `id`, `class` y `data-*`. Nada más. Pero el matcher SÍ da por
// **soportado** un selector como `[name="cost"]`, así que no lo anotaba en `selectoresNoSoportados`:
// resolvía a `null` y se callaba. Y `null` del banco es indistinguible de «ese nodo no existe».
//
// 🔴 ES EL DEFECTO QUE ESTE BANCO EXISTE PARA ELIMINAR, una capa más abajo — el mismo `() => null`
// fijo de SCRUM-451, con otra ropa. Censadas **36 consultas** del dashboard que caían justo ahí.
//
// ⚠️ POR QUÉ ESTE TEST MIDE LAS **DOS** DIRECCIONES, y no solo la que arregla:
//
//     · nodo que NO existe               → tiene que seguir dando `null`, callado.
//     · nodo que SÍ existe pero cuyo
//       atributo el banco no copió       → tiene que GRITAR, nunca `null`.
//
// Con una sola dirección el arreglo puede quedar midiendo su propia sonda: un banco que gritara
// SIEMPRE pasaría la segunda y sería inútil; uno que no gritara NUNCA pasaría la primera y sería el
// de antes. Solo las dos juntas dicen que la vara distingue «no está» de «no sé mirar».
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodo } from './_banco-vistas.mjs';

/** El registro mínimo que `nodo()` necesita, con la misma forma que arma `cargarDashboard`. */
const registro = () => ({ porId: new Map(), errores: [], idsNoResueltos: [], selectoresNoSoportados: [] });

/** Una raíz pintada con marcado, como pinta cualquier vista. */
function conMarcado(html) {
  const reg = registro();
  const raiz = nodo('div', reg);
  raiz.innerHTML = html;
  return { raiz, reg };
}

test('SCRUM-634 · el atributo del marcado se COPIA, y la consulta lo contesta', () => {
  const { raiz, reg } = conMarcado(
    '<input name="cost" type="number" placeholder="0,00">'
    + '<select name="providerId"></select>',
  );

  const coste = raiz.querySelector('[name="cost"]');
  assert.notEqual(coste, null,
    '🔴 `[name="cost"]` sigue devolviendo null: el parser no copió el atributo. Es el defecto entero.');
  assert.equal(coste.getAttribute('name'), 'cost');
  assert.equal(coste.getAttribute('placeholder'), '0,00');
  assert.notEqual(raiz.querySelector('input[type="number"]'), null);
  assert.notEqual(raiz.querySelector('select[name="providerId"]'), null);

  // Y no se declaró ciego: CONTESTÓ. Un banco que resolviera anotándose incapaz habría dejado
  // aquí el selector, y eso sería declarar el hueco, no cerrarlo.
  assert.deepEqual(reg.selectoresNoSoportados, []);
});

test('SCRUM-634 · CONTROL POSITIVO ①  el nodo que NO existe sigue dando null, y calla', () => {
  const { raiz } = conMarcado('<input name="cost">');

  // ⚠️ EL SUELO. Si esto gritara, el arreglo no distinguiría «no está» de «no sé mirar», que es
  // exactamente el defecto que viene a quitar — solo que gritando en vez de callando.
  assert.doesNotThrow(() => raiz.querySelector('[name="no-esta-en-el-marcado"]'));
  assert.equal(raiz.querySelector('[name="no-esta-en-el-marcado"]'), null);
  assert.equal(raiz.querySelector('input[type="checkbox"]'), null);
  assert.deepEqual(raiz.querySelectorAll('[name="tampoco"]'), []);
});

test('SCRUM-634 · CONTROL POSITIVO ②  el nodo que SÍ existe con el atributo sin copiar GRITA', () => {
  const reg = registro();
  const raiz = nodo('div', reg);
  const campo = nodo('input', reg);
  // El camino que el parser de marcado ya NO deja abierto, pero que sigue existiendo: un nodo hecho
  // a mano al que la vista le asigna el CAMPO en vez del atributo. En el navegador `name` refleja,
  // así que `[name="sin-copiar"]` casaría; aquí el banco tiene el dato y la consulta no lo ve.
  campo.name = 'sin-copiar';
  raiz.appendChild(campo);

  assert.throws(
    () => raiz.querySelector('[name="sin-copiar"]'),
    (e) => {
      assert.match(e.message, /SCRUM-634/);
      assert.match(e.message, /name/);
      assert.match(e.message, /sin-copiar/);
      return true;
    },
    '🔴 el banco ha devuelto algo en vez de gritar: vuelve a ser indistinguible de «no existe».',
  );

  // Y que grite NO puede ser un grito indiscriminado: en el mismo nodo, un atributo que de verdad
  // no está en ninguna parte sigue contestando `null`. Es la dirección ① repetida sobre el nodo
  // que sí dispara el grito, que es donde un grito de más se escondería.
  assert.equal(raiz.querySelector('[placeholder="nada"]'), null);
});

test('SCRUM-634 · un atributo SIN VALOR vale cadena vacía, que no es lo mismo que no estar', () => {
  const { raiz } = conMarcado('<input required name="name">');

  const campo = raiz.querySelector('[required]');
  assert.notEqual(campo, null, '🔴 `<input required>` no se ve: «puesto sin valor» se perdió.');
  assert.equal(campo.getAttribute('required'), '',
    'en el navegador un atributo sin valor es cadena vacía; `null` significaría que no está.');

  // Control negativo en el MISMO nodo: la vara sigue sabiendo decir que no.
  assert.equal(raiz.querySelector('[disabled]'), null);
});

test('SCRUM-634 · comillas simples en el marcado', () => {
  const { raiz } = conMarcado("<input name='phone' type='tel'>");
  assert.notEqual(raiz.querySelector('[name="phone"]'), null);
  assert.notEqual(raiz.querySelector("input[type='tel']"), null);
});

test('SCRUM-634 · regresión: `id`, `class` y `data-*` siguen resolviendo', () => {
  const { raiz, reg } = conMarcado(
    '<div id="caja" class="tarjeta grande" data-estado="vacio" data-id-cobro="7">hola</div>',
  );

  assert.notEqual(raiz.querySelector('#caja'), null);
  assert.notEqual(raiz.querySelector('.tarjeta'), null);
  assert.notEqual(raiz.querySelector('[data-estado="vacio"]'), null);
  assert.equal(reg.porId.get('caja'), raiz.querySelector('#caja'), 'el id se sigue registrando');

  const caja = raiz.querySelector('#caja');
  assert.equal(caja.className, 'tarjeta grande');
  assert.equal(caja.dataset.estado, 'vacio');
  assert.equal(caja.dataset.idCobro, '7', 'el guion medio se sigue volviendo camelCase');
  assert.equal(caja.textContent, 'hola');
});

test('SCRUM-634 · el hueco DECLARADO no grita: `value` y `checked` no reflejan', () => {
  const reg = registro();
  const raiz = nodo('div', reg);
  const campo = nodo('input', reg);
  campo.value = 'lo-que-tecleo';
  campo.checked = true;
  raiz.appendChild(campo);

  // En el navegador, escribir en un campo NO cambia su atributo `value`, ni marcar cambia
  // `checked`. Así que aquí `null` es la respuesta FIEL, no un hueco: gritar sería mentir al revés.
  assert.doesNotThrow(() => raiz.querySelector('[value="lo-que-tecleo"]'));
  assert.equal(raiz.querySelector('[value="lo-que-tecleo"]'), null);
  assert.equal(raiz.querySelector('[checked]'), null);
});
