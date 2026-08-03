// SCRUM-264 (+275) · EL COPY APROBADO TIENE QUE LLEGAR A LA PANTALLA, NO SOLO A LA RESPUESTA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// Una respuesta de error trae **dos cosas**: el código en `error` y el texto humano en
// `message`. Cuando la pantalla lee `error`, el usuario ve un identificador de programador:
//
//     factura_sin_lineas          ← el cliente final, bajo la firma que acababa de dibujar
//     invalid_email               ← quien se equivoca al teclear su correo en /login.html
//     too_many_requests           ← y este es el peor: el servidor MANDABA su copy en español
//                                   («Demasiados intentos seguidos…») y la página lo tiraba
//
// 🔑 ES SCRUM-151 A MEDIO CERRAR. `public/dashboard/js/api.js:35-37` documenta ese arreglo
// **para el dashboard** —«cualquier endpoint sin `message` acababa mostrándole al usuario un
// identificador interno»—. Las pantallas públicas se quedaron fuera, que es donde más duele:
// al otro lado no hay un profesional que sepa interpretarlo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO ES UNA TABLA Y NO UN FICHERO POR PANTALLA (SCRUM-275)
//
// La propiedad vigilada es **la misma en las cuatro**: el mensaje humano gana al código, y el
// código sigue de reserva. Lo único que cambia entre ellas son dos datos —de dónde se lee el
// código y qué variables libres usa la expresión—, y eso es parametrizar, no un guard nuevo.
// Un `scrum275-*.test.mjs` aparte sería SCRUM-240 otra vez: dos arneses del mismo hecho,
// mantenidos por separado hasta que divergen.
//
// ⚠️ El guard hermano —«toda respuesta de error de superficie PÚBLICA lleva `message`»— es una
// propiedad DISTINTA (mira el servidor, no la pantalla) y vive en su propio fichero,
// `scrum275-message-en-superficie-publica.test.mjs`, con su trinquete.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EJECUTA LA EXPRESIÓN EN VEZ DE BUSCAR TEXTO
//
// Un guard de texto («que el fichero diga `data.message`») pasa en verde con la expresión
// escrita al revés, y se caza a sí mismo en el comentario que explica la prohibición. Lo que
// importa no es cómo está escrita: es **qué devuelve cuando llega un error real**. Así que se
// extrae la expresión del fichero que se sirve y se ejecuta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

const { ERROR_SIN_LINEAS, COPY_PUBLICO_SIN_LINEAS } =
  await import('../dist/modules/invoicing/domain/lineasFacturables.js');

/** Un código cualquiera, para comprobar que NO se pierde cuando no hay copy humano. */
const CODIGO = 'un_codigo_cualquiera';
/** El texto que devolvería la tabla de la página, si la consulta. */
const DEL_MAPA = 'TEXTO DE LA TABLA DE LA PÁGINA';

/**
 * LAS CUATRO PANTALLAS PÚBLICAS QUE PINTAN UN ERROR DE LA API.
 *
 * `register.html` entra como **control positivo**: ya lo hacía bien antes de todo esto, así que
 * si un día cae, el que ha cambiado es el guard y no la pantalla.
 */
const SUPERFICIES = [
  {
    nombre: 'landing de presupuesto · ACEPTAR',
    fuente: () => leer('dist', 'modules', 'system', 'app', 'routes', 'quoteDecisionLanding.routes.js'),
    patron: /getElementById\('sig-error'\)\.textContent = ([^;]+);/,
    variables: ['data'],
    porDefecto: 'Error al procesar.',
    tieneMapa: false,
  },
  {
    nombre: 'landing de presupuesto · RECHAZAR',
    fuente: () => leer('dist', 'modules', 'system', 'app', 'routes', 'quoteDecisionLanding.routes.js'),
    patron: /No se pudo registrar el rechazo\.<\/strong><br\/>\$\{([^}]+)\}/,
    variables: ['json'],
    porDefecto: '',
    tieneMapa: false,
  },
  {
    nombre: 'página de acceso · /login.html',
    fuente: () => leer('public', 'login.html'),
    // Anclado en su texto por defecto, que es lo único estable de la línea.
    patron: /showAlert\((.*'Error al enviar el enlace\.'), 'error'\)/,
    variables: ['data', 'msgs'],
    porDefecto: 'Error al enviar el enlace.',
    tieneMapa: true,
  },
  {
    nombre: 'página de alta · /register.html (control positivo)',
    fuente: () => leer('public', 'register.html'),
    patron: /showAlert\((.*'Error al crear la cuenta\.'), 'error'\)/,
    variables: ['data', 'msgs'],
    porDefecto: 'Error al crear la cuenta.',
    tieneMapa: true,
  },
];

/**
 * Saca la expresión de la fuente y la vuelve ejecutable.
 * Si el patrón no casa, ROJO: un test que no encuentra lo que mide es indistinguible de uno
 * que aprueba.
 */
function expresionDe(sup) {
  const m = sup.fuente().match(sup.patron);
  assert.ok(
    m,
    `🔴 no encuentro la expresión de error en «${sup.nombre}». Si cambió de forma, este guard ` +
      'dejaría de comprobar nada y pasaría en verde: por eso falla aquí en vez de seguir.',
  );
  return new Function(...sup.variables, `return ${m[1]};`);
}

/** Llama a la expresión con el cuerpo y —si la pantalla tiene tabla— con la tabla. */
const invocar = (fn, sup, cuerpo, mapa = {}) => (sup.variables.length > 1 ? fn(cuerpo, mapa) : fn(cuerpo));

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PROPIEDAD, IGUAL EN LAS CUATRO
// ═════════════════════════════════════════════════════════════════════════════════════════

for (const sup of SUPERFICIES) {
  test(`SCRUM-264 · ${sup.nombre}: el mensaje humano GANA al código`, () => {
    const mostrar = expresionDe(sup);
    assert.equal(
      invocar(mostrar, sup, { error: CODIGO, message: 'Un texto para la persona.' }),
      'Un texto para la persona.',
      `🔴 «${sup.nombre}» enseña un IDENTIFICADOR INTERNO teniendo delante el texto humano. ` +
        'Es el arreglo de SCRUM-151 (api.js:35-37), que nunca llegó a esta pantalla.',
    );
  });

  test(`SCRUM-264 · ${sup.nombre}: sin copy, el código NO se pierde`, () => {
    // Preferir el texto humano no puede convertirse en tragarse el fallo: la mayoría de los
    // endpoints públicos aún no mandan `message` (27 de 36, censo de SCRUM-275) y para esos un
    // código es mejor que un genérico — al menos se puede buscar. Cambia la PRIORIDAD, no lo
    // que se ve cuando no hay copy.
    const mostrar = expresionDe(sup);
    assert.equal(invocar(mostrar, sup, { error: CODIGO }), CODIGO);
  });

  test(`SCRUM-264 · ${sup.nombre}: sin nada, su texto por defecto`, () => {
    const mostrar = expresionDe(sup);
    assert.equal(invocar(mostrar, sup, sup.variables[0] === 'json' ? null : {}), sup.porDefecto);
  });

  if (sup.tieneMapa) {
    test(`SCRUM-264 · ${sup.nombre}: la tabla de la página se CONSULTA`, () => {
      // 🔑 EL HALLAZGO DE SCRUM-275, y por eso este caso existe: `login.html` YA tenía la tabla,
      // bien escrita, con «El enlace ha caducado o ya fue usado. Solicita uno nuevo.» dentro…
      // declarada con `const` DENTRO de un `if`, así que desde `sendLink()` no estaba ni en el
      // alcance. No es que no se aplicara: es que no se podía. El arreglo no fue escribir
      // textos — fue sacar la tabla de la llave.
      const mostrar = expresionDe(sup);
      assert.equal(
        invocar(mostrar, sup, { error: CODIGO }, { [CODIGO]: DEL_MAPA }),
        DEL_MAPA,
        `🔴 «${sup.nombre}» tiene una tabla de traducción y no la mira al pintar el error de la API`,
      );
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// COBERTURA DE LA TABLA DE /login.html · DERIVADA DE LA RUTA, no escrita a mano
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-275 · la página de acceso traduce TODOS los códigos que su ruta puede devolver', () => {
  // Se derivan del handler de `POST /auth/login`, no se listan aquí: el día que alguien añada
  // un rechazo nuevo a esa ruta, este guard lo pide en la tabla antes de que nadie lo vea en
  // pantalla. El 429 del rate-limiter NO entra y es correcto que no entre: viene de un
  // middleware de fuera del handler y **trae su propio `message`** en español.
  const auth = leer('src', 'modules', 'auth', 'app', 'routes', 'auth.routes.ts');
  const desde = auth.indexOf("router.post('/login'");
  const hasta = auth.indexOf("router.post('/register'");
  assert.ok(desde !== -1 && hasta > desde, '🔴 no encuentro el handler de /auth/login para derivar sus códigos');

  const codigos = [...auth.slice(desde, hasta).matchAll(/error:\s*'([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(codigos.length >= 2,
    `🔴 ESCÁNER CIEGO: derivo ${codigos.length} código(s) de /auth/login y son al menos 2 ` +
    '(invalid_email, internal_error). Si la forma cambió, este guard no está mirando nada.');

  const login = leer('public', 'login.html');
  const mapa = login.match(/const msgs = (\{[\s\S]*?\});/);
  assert.ok(mapa, '🔴 /login.html ya no tiene tabla de traducción');
  const traducciones = new Function(`return ${mapa[1]};`)();

  const sinTraducir = codigos.filter((c) => !traducciones[c]);
  assert.deepEqual(
    sinTraducir, [],
    `🔴 /auth/login puede devolver ${sinTraducir.join(', ')} y la página no sabe traducirlo: ` +
      'el usuario leería el identificador tal cual. El texto lo aprueba el fundador (regla 30).',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PÁGINA DE ACCESO NO PUEDE LLAMAR «ERROR DE CONEXIÓN» A UN FALLO DEL SERVIDOR
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-275 · una respuesta que no es JSON NO se diagnostica como fallo de red', async () => {
  // El `try` envolvía `fetch` Y `res.json()`. Un 500 con cuerpo vacío o HTML hace que el parseo
  // lance, y el `catch` lo etiquetaba «Error de conexión. Comprueba tu internet.».
  //
  // Miente dos veces: al usuario, que se pone a mirar su wifi mientras el servidor está caído; y
  // a quien lo depure después, que buscará el fallo en el sitio equivocado. Un diagnóstico falso
  // es peor que uno genérico.
  const login = leer('public', 'login.html');
  const m = login.match(/const data = (await res\.json\(\)[^;]*);/);
  assert.ok(m, '🔴 no encuentro el parseo de la respuesta en /login.html');

  const parsear = new Function('res', `return (async () => ${m[1]})();`);
  const resultado = await parsear({ json: () => Promise.reject(new SyntaxError('Unexpected token <')) })
    .then((v) => v, (e) => ({ lanzo: e }));

  assert.ok(
    !resultado?.lanzo,
    '🔴 el parseo LANZA cuando la respuesta no es JSON, así que el `catch` de abajo lo etiqueta ' +
      'como «Error de conexión» y manda al usuario a mirar su wifi mientras el servidor devuelve ' +
      'un 500.',
  );
  assert.deepEqual(resultado, {}, 'y cae a un cuerpo vacío, para que el texto por defecto decida');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CASO REAL QUE ABRIÓ 264 · con el cuerpo que produce la ruta de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-264 · al aceptar sin conceptos, el cliente lee el COPY y no `factura_sin_lineas`', () => {
  const sup = SUPERFICIES[0];
  const mostrar = expresionDe(sup);
  assert.equal(
    mostrar({ ok: false, error: ERROR_SIN_LINEAS, message: COPY_PUBLICO_SIN_LINEAS }),
    COPY_PUBLICO_SIN_LINEAS,
    '🔴 EL CLIENTE VE UN IDENTIFICADOR INTERNO justo después de firmar.',
  );
});
