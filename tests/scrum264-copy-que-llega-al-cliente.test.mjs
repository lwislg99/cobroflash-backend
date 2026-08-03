// SCRUM-264 · EL COPY APROBADO TIENE QUE LLEGAR A LA PANTALLA, NO SOLO A LA RESPUESTA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, y por qué aprobar el texto no lo arreglaba
//
// `POST /quote/:token/decision` responde el 409 con **las dos cosas**: el código en `error` y el
// texto humano en `message`. La landing pública leía `data.error` — el CÓDIGO — así que el
// cliente final veía, en rojo y bajo la firma que acababa de dibujar:
//
//     factura_sin_lineas
//
// Es el peor sitio del producto para enseñar un identificador interno: el cliente acaba de firmar
// y lo que recibe es una cadena de programador. Y no se arreglaba aprobando el copy, porque el
// copy viajaba correctamente en `message` y **nadie lo leía**.
//
// 🔑 ES EL MISMO DEFECTO QUE SCRUM-151, A MEDIO CERRAR. `public/dashboard/js/api.js:35-37` lo
// documenta resuelto **para el dashboard**: «CUALQUIER endpoint sin `message` acababa mostrándole
// al usuario un identificador interno». La landing pública se quedó fuera de aquel arreglo — y es
// la superficie donde más duele, porque al otro lado no hay un profesional que sepa interpretarlo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE TEST EJECUTA LA EXPRESIÓN EN VEZ DE BUSCAR TEXTO
//
// Un guard de texto («que el fichero diga `data.message`») pasa en verde con la expresión escrita
// al revés, y se caza a sí mismo en el comentario que explica la prohibición. Lo que importa no es
// cómo está escrita: es **qué devuelve cuando llega un 409 real**. Así que se extrae la expresión
// del bundle que se sirve y se ejecuta sobre los cuerpos que la API produce de verdad.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANDING = fs.readFileSync(
  path.join(RAIZ, 'dist', 'modules', 'system', 'app', 'routes', 'quoteDecisionLanding.routes.js'),
  'utf8',
);

const { ERROR_SIN_LINEAS, COPY_PUBLICO_SIN_LINEAS } =
  await import('../dist/modules/invoicing/domain/lineasFacturables.js');

/** El cuerpo EXACTO que devuelve la ruta cuando el presupuesto no tiene conceptos con precio. */
const CUERPO_409_REAL = { ok: false, error: ERROR_SIN_LINEAS, message: COPY_PUBLICO_SIN_LINEAS };

/**
 * Saca una expresión del bundle y la convierte en función ejecutable.
 * Si el patrón no casa, ROJO: sin expresión no se está comprobando nada, y un test que no
 * encuentra lo que mide es indistinguible de uno que aprueba.
 */
function expresion(patron, parametro, queEs) {
  const m = LANDING.match(patron);
  assert.ok(
    m,
    `🔴 no encuentro ${queEs} en la landing compilada. Si cambió de forma, este fichero dejaría ` +
      `de comprobar nada y pasaría en verde: por eso falla aquí en vez de seguir.`,
  );
  return new Function(parametro, `return ${m[1]};`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// ACEPTAR · el camino del ticket
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-264 · al aceptar, el cliente lee el COPY y no el código interno', () => {
  const mostrar = expresion(
    /getElementById\('sig-error'\)\.textContent = ([^;]+);/,
    'data',
    'el mensaje de error de la firma',
  );

  assert.equal(
    mostrar(CUERPO_409_REAL),
    COPY_PUBLICO_SIN_LINEAS,
    '🔴 EL CLIENTE VE UN IDENTIFICADOR INTERNO. Acaba de dibujar su firma y debajo le sale ' +
      `«${ERROR_SIN_LINEAS}» en rojo. El copy aprobado viaja en \`message\` y esta pantalla está ` +
      'leyendo `error`. Es el arreglo de SCRUM-151 (api.js:35-37), que nunca llegó a la landing.',
  );
});

test('SCRUM-264 · sin `message`, el código sigue apareciendo: no se pierde información', () => {
  // Preferir el texto humano NO puede convertirse en tragarse el fallo. Muchos endpoints antiguos
  // responden solo `error`, y para esos el código crudo es mejor que un mensaje genérico: al menos
  // se puede buscar. Lo que cambia es la PRIORIDAD, no lo que se muestra cuando no hay copy.
  const mostrar = expresion(
    /getElementById\('sig-error'\)\.textContent = ([^;]+);/,
    'data',
    'el mensaje de error de la firma',
  );

  assert.equal(mostrar({ error: 'quote_expired' }), 'quote_expired');
  assert.equal(mostrar({}), 'Error al procesar.', 'y sin nada, el texto por defecto de siempre');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// RECHAZAR · el mismo defecto, en la misma pantalla
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-264 · al rechazar, el cliente también lee el COPY y no el código', () => {
  // Va aquí y no en otro ticket porque es **la misma pantalla y el mismo defecto**: arreglar solo
  // el camino de aceptar dejaría la landing medio arreglada, que es como se llega a esta clase de
  // hueco. El tipo `DecisionApiError` de ese fichero ya declaraba `message?` — estaba previsto y
  // sin usar.
  const mostrar = expresion(
    /No se pudo registrar el rechazo\.<\/strong><br\/>\$\{([^}]+)\}/,
    'json',
    'el mensaje de error del rechazo',
  );

  assert.equal(
    mostrar({ error: 'algun_codigo', message: 'Un texto para el cliente.' }),
    'Un texto para el cliente.',
    '🔴 el rechazo sigue pintando el código crudo aunque venga un mensaje humano',
  );
  assert.equal(mostrar({ error: 'algun_codigo' }), 'algun_codigo', 'sin copy, el código');
  assert.equal(mostrar(null), '', 'sin cuerpo, nada — no un «undefined» en pantalla');
});
