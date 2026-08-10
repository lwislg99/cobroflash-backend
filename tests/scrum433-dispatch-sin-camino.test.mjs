// tests/scrum433-dispatch-sin-camino.test.mjs — SCRUM-433
//
// LA DIRECCIÓN CONTRARIA: UNA VISTA DEL DISPATCH A LA QUE NO SE LLEGA POR NINGÚN SITIO.
//
// ── QUÉ VIGILA Y QUÉ NO ─────────────────────────────────────────────────────────────────────
// SCRUM-420 dejó el guard de ida: **cada entrada de la barra lleva a una pantalla que existe**.
// Falta la vuelta, que es la que se rompe en silencio: **una pantalla que existe y a la que no
// lleva nada**. Un botón que no lleva a ningún sitio se ve; una pantalla a la que no llega nadie no
// se ve nunca — solo la encuentra quien lee el código, y por eso puede pasar meses ahí.
//
// ── LA LISTA CONTRA LA QUE SE MIDE, QUE ES LA MITAD DEL TRABAJO ─────────────────────────────
// **No es `HASH_VIEWS`.** Esa es la lista de vistas navegables por hash; el registro real es el
// `switch` de `renderView`, y tiene casos que no están en ella. Un guard contra `HASH_VIEWS`
// mediría la lista equivocada y **nacería verde con el hueco dentro**.
//
// ── LOS TRES CAMINOS, DERIVADOS ─────────────────────────────────────────────────────────────
// Una vista está bien si se llega por alguno:
//
//   1. **entrada en la barra** (`data-view="x"` en el HTML);
//   2. **alguien la abre** con `renderAppView('x', …)` — así se llega a las cinco pantallas de
//      DETALLE, que no están ni pueden estar en la barra;
//   3. **es un alias puro**: un `case` cuyo único cuerpo es `return renderView('otra', …)`.
//
// El tercero **no es una excepción declarada a mano**: `operarios` cae solo por su forma. Marcarlo
// como hueco sería acusar a la decisión de SCRUM-136, que lo mantiene como redirección viva porque
// hay enlaces y marcadores apuntando ahí.
//
// Medido antes de escribir la regla: con la lectura literal —«todo case necesita entrada en la
// barra»— habrían salido **SEIS falsos positivos** (las cinco de detalle y `export`). Un guard que
// grita seis veces sin motivo se silencia entero, y entonces no vigila el séptimo.
//
// Sin gate: AST y ficheros. Ni BD, ni red, ni navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  vistasDelDispatch, entradasDeLaBarra, vistasQueAlguienAbre, vistasSinCamino, sinCamino,
} from './_censo-vistas-dispatch.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

test('SCRUM-433 · SUELO: se leen los `case` del switch de verdad', () => {
  // Sería ridículo repetir aquí el defecto que perseguimos: un escáner que no encuentra el switch
  // devolvería «cero vistas huérfanas» y **cero huérfanas y no supe mirar son el mismo verde**.
  const { vistas, leidas } = vistasDelDispatch(RAIZ);
  assert.ok(
    leidas > 0 && vistas.length >= 15,
    `🔴 ESCÁNER CIEGO: se han leído ${leidas} cláusulas y ${vistas.length} vistas del switch de `
    + '`renderView`. O el dispatch se ha movido, o el extractor dejó de encontrarlo. No se puede '
    + 'afirmar que no falta ninguna pantalla — ni que falta.');
  assert.ok(entradasDeLaBarra(RAIZ).size >= 10, '🔴 no se leen las entradas de la barra');
  assert.ok(vistasQueAlguienAbre(RAIZ).size >= 5, '🔴 no se leen las llamadas de navegación');
});

test('SCRUM-433 · SUELO: el detector distingue un alias de una vista real', () => {
  // Si `alias` saliera siempre null, `operarios` se marcaría como hueco y estaríamos acusando a
  // SCRUM-136. Si saliera siempre no-null, el guard no marcaría nada nunca.
  const { vistas } = vistasDelDispatch(RAIZ);
  const alias = vistas.filter((v) => v.alias !== null);
  const reales = vistas.filter((v) => v.alias === null);
  assert.ok(alias.length > 0,
    '🔴 el detector no reconoce NINGÚN alias. `operarios` lo es (`return renderView(\'team\', …)`), '
    + 'así que o la forma cambió o la derivación está rota — y entonces marcaría una decisión '
    + 'tomada como si fuera un hueco.');
  assert.ok(reales.length > alias.length,
    '🔴 casi todo sale como alias: la derivación está clasificando de más y no vigilaría nada');
});

test('SCRUM-433 · ninguna vista del dispatch se queda sin camino', () => {
  const huerfanas = vistasSinCamino(RAIZ);
  assert.deepEqual(
    huerfanas, [],
    '🔴 HAY VISTAS A LAS QUE NO LLEGA NADA: ' + huerfanas.join(', ')
    + '\n\n  Existen en el `switch` de `renderView` y no tienen ni entrada en la barra ni nadie que\n'
    + '  las abra con `renderAppView`. Una pantalla a la que no llega nada no se ve nunca: no es\n'
    + '  como un botón roto, que se nota — sólo la encuentra quien lee el código.\n\n'
    + '  Tres salidas, y las tres son honestas:\n'
    + '    · darle entrada en la barra, si es un sitio al que el profesional debe poder ir;\n'
    + '    · abrirla desde donde tenga sentido con `renderAppView(\'…\')`, como las pantallas de\n'
    + '      detalle, que se abren desde su lista;\n'
    + '    · si es una redirección, escribirla como tal — `return renderView(\'otra\', options)` y\n'
    + '      nada más en el cuerpo. Entonces deja de contar, por su forma y sin lista de excepciones.\n\n'
    + '  Lo que no vale es dejarla ahí: es un motor sin superficie, en `public/`, que es justo\n'
    + '  donde el censo de SCRUM-411 no mira.');
});

test('SCRUM-433 · CONTROL NEGATIVO (a): un alias NO cuenta como huérfana', () => {
  // `operarios` no está en la barra y nadie la abre: si el alias no se descontara, saldría marcada.
  // Y estaría acusando a SCRUM-136, que decidió mantenerla como redirección a propósito.
  const { vistas } = vistasDelDispatch(RAIZ);
  const operarios = vistas.find((v) => v.nombre === 'operarios');
  assert.ok(operarios, '🔴 PREMISA ROTA: ya no existe el `case \'operarios\'`. Si se ha retirado, '
    + 'este control negativo ya no prueba nada: elige otro alias o revisa el guard.');
  assert.equal(operarios.alias, 'team', '🔴 `operarios` ha dejado de ser un alias puro hacia `team`');
  assert.ok(!entradasDeLaBarra(RAIZ).has('operarios'),
    '🔴 `operarios` ha entrado en la barra. SCRUM-136 decidió que NO debe tenerla: es un rol del '
    + 'miembro, no un apartado.');
  // RESPALDO de la negación (SCRUM-237): antes de afirmar «`operarios` NO sale marcada» hay que
  // demostrar que el detector SABE marcar. Se prueba con una vista real e inalcanzable inventada
  // aquí mismo: si no la marcara, el «no sale marcada» de abajo sería un verde vacío.
  const inalcanzable = sinCamino({
    vistas: [...vistas, { nombre: 'vista-de-prueba-sin-camino', alias: null }],
    barra: entradasDeLaBarra(RAIZ),
    abre: vistasQueAlguienAbre(RAIZ),
  });
  assert.ok(inalcanzable.includes('vista-de-prueba-sin-camino'),
    '🔴 el detector no marca ni una vista real sin ningún camino: está ciego, y entonces el '
    + '«`operarios` no sale marcada» de abajo no significa nada');

  // Y el hermano CON EL MISMO TOKEN, que es lo que hace verificable la negación de abajo: el
  // detector ve `operarios` en el dispatch. Sin esto, «no sale marcada» también lo cumpliría un
  // detector que no la viera en absoluto.
  assert.ok(vistas.map((v) => v.nombre).includes('operarios'),
    '🔴 el censo no encuentra `operarios` entre las vistas del dispatch: no se puede afirmar nada '
    + 'sobre si se marca o no');

  assert.ok(!vistasSinCamino(RAIZ).includes('operarios'),
    '🔴 el alias se está marcando como huérfana: el guard acusa a la decisión de SCRUM-136');
});

test('SCRUM-433 · CONTROL NEGATIVO (b): una vista real CON entrada tampoco cuenta', () => {
  // La otra mitad, y hace falta: un guard que no marcara nada nunca también pasaría el control (a).
  const barra = entradasDeLaBarra(RAIZ);
  const { vistas } = vistasDelDispatch(RAIZ);
  const conEntrada = vistas.filter((v) => v.alias === null && barra.has(v.nombre));
  assert.ok(conEntrada.length >= 10,
    `🔴 solo ${conEntrada.length} vistas reales tienen entrada en la barra: el cruce no está casando`);
  const marcadas = vistasSinCamino(RAIZ).filter((n) => barra.has(n));
  assert.deepEqual(marcadas, [],
    '🔴 se marcan como huérfanas vistas que SÍ tienen entrada en la barra: ' + marcadas.join(', '));
});

test('SCRUM-433 · las pantallas de DETALLE cuentan por quien las abre, no por la barra', () => {
  // Se afirma explícitamente porque es la mitad que evita seis falsos positivos, y porque el día
  // que alguien «simplifique» el guard a «barra o nada», esto dirá por qué no.
  const abre = vistasQueAlguienAbre(RAIZ);
  const barra = entradasDeLaBarra(RAIZ);
  const detalle = ['quotes-detail', 'jobs-detail', 'invoice-detail', 'albaran-detail', 'customer-360'];
  for (const v of detalle) {
    assert.ok(!barra.has(v), `🔴 PREMISA: ${v} no debería tener entrada en la barra`);
    assert.ok(abre.has(v),
      `🔴 nadie abre ${v} con renderAppView. O ha quedado sin camino, o la navegación cambió de `
      + 'nombre y este guard está midiendo una API que ya no se usa.');
  }
});

test('SCRUM-433 · SCRUM-432 sacó `Plantillas` de la barra sin chocar conmigo — sobre el HECHO', () => {
  // ⚠️ La primera versión de este test lo comprobaba leyendo el censo y buscando números fijos. Se
  // cazó a sí misma: marcaba `statements.length === 1`, que es la detección legítima del alias.
  // Un guard atado al TEXTO otra vez, y en el mismo turno en que arreglé cuatro por eso.
  //
  // ── SCRUM-432 · POR QUÉ LA PREMISA CAMBIÓ DE LADO (10-ago-2026) ───────────────────────────
  // Decía `assert.ok(barra.has('templates'), 'PREMISA: hoy Plantillas sigue en la barra')`, y era
  // correcta: anclaba la SIMULACIÓN a un estado real, para que simular la retirada simulara algo.
  // El movimiento ya está hecho, así que esa línea pasó a exigir que el trabajo NO estuviera hecho
  // — el estado anterior convertido en requisito, que es lo que ya corrigieron `scrum296` y el ①
  // de `scrum420` este mismo día.
  //
  // Se re-apunta al invariante que de verdad protegía: **`Plantillas` tiene exactamente UN camino**.
  // La mitad (a) deja de ser simulación —es el estado vivo— y la (b) sigue siendo el contrafactual,
  // que es la que no se puede comprobar de otra forma.
  const { vistas } = vistasDelDispatch(RAIZ);
  const barra = entradasDeLaBarra(RAIZ);
  const abre = vistasQueAlguienAbre(RAIZ);

  // PREMISA, ahora la de después del movimiento: fuera de la barra y con camino propio.
  assert.ok(!barra.has('templates'),
    '🔴 PREMISA: `Plantillas` ha vuelto a la barra. Si vuelve a tener DOS caminos, este test está '
    + 'midiendo otro mundo — y el diseño §B1 la quiere solo como pestaña.');
  assert.ok(abre.has('templates'),
    '🔴 PREMISA: nadie abre `templates` con `renderAppView(\'templates\')`. Es el único camino que '
    + 'le queda: sin él la vista está huérfana, y eso lo canta el primer test de este fichero.');

  // (a) BIEN HECHO — y ya no hay que imaginárselo: es el árbol de hoy. La vista no está en la
  // barra, la abre la pestaña, y este guard NO la marca. Si se relajara, aquí se vería.
  assert.ok(!sinCamino({ vistas, barra, abre }).includes('templates'),
    '🔴 este guard marca `templates` como huérfana cuando la pestaña de Presupuestos SÍ la abre: '
    + 'estaría bloqueando trabajo correcto de otra sesión.');

  // (b) MAL HECHO — el contrafactual, que sigue sin poder comprobarse de otra manera: si la
  // pestaña desapareciera, la vista se queda sin nada y este guard TIENE que cantarlo.
  const sinPestana = new Map([...abre].filter(([v]) => v !== 'templates'));
  assert.ok(sinCamino({ vistas, barra, abre: sinPestana }).includes('templates'),
    '🔴 sin la pestaña, `Plantillas` no tiene barra ni quien la abra, y este guard no lo nota. '
    + 'Entonces no vigila lo que dice vigilar.');
});
