// tests/scrum704-el-cuerpo-llega.test.mjs — SCRUM-704
//
// EL NOMBRE DEL TRABAJO Y LA DIRECCIÓN DE LA OBRA NO SE GUARDABAN, Y NO FALLABA NADA.
//
// `apiRequest` no serializa el `body`, y dos llamadores le pasaban un objeto. `fetch` no serializa
// nada: a lo que no es un cuerpo válido le aplica `String(x)`, y de un objeto plano eso sale
// **"[object Object]"**. Con `Content-Type: application/json` al servidor le llega basura, el campo
// no se escribe, y **no hay error en ninguna parte**.
//
// 🔴 LA DIRECCIÓN DE LA OBRA ES DONDE VA EL TÉCNICO. Si el jefe la corrige y no se guarda, el
// técnico se presenta en la vieja — y en una empresa que atiende centros repartidos por la
// provincia eso es un desplazamiento perdido, de los que Tecnosel apunta como coste real.
//
// ── QUÉ SE MIDE AQUÍ, Y POR QUÉ NO BASTA «LA PETICIÓN NO FALLA» ──────────────────────────
// Hoy la petición NO falla. Un test que compruebe que `apiRequest` resuelve pasaría igual de verde
// con el defecto puesto. Lo que hay que mirar es **qué cuerpo llega al servidor**, y por eso el
// `fetch` del banco construye un `Request` de verdad y lee su texto: eso es exactamente lo que
// haría el navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';
import { censoDeBodies, porForma, FORMAS } from './_censo-body-apirequest.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Un `fetch` que anota **lo que de verdad viajaría**: construye el `Request` que construiría el
 * navegador y lee su cuerpo. Un doble que se limitara a guardar `opts.body` mediría el objeto que
 * le pasaron, no la cadena que sale por el cable — y ahí es donde vive este defecto.
 */
function fetchQueAnotaElCuerpo() {
  const enviadas = [];
  const f = async (url, opts = {}) => {
    let cuerpo = null;
    if (opts.body !== undefined && opts.body !== null) {
      cuerpo = await new Request('http://banco.local/x', {
        method: opts.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: opts.body,
      }).text();
    }
    enviadas.push({ url: String(url), metodo: opts.method || 'GET', cuerpo });
    return {
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({}), blob: async () => ({}), text: async () => '',
    };
  };
  return { fetch: f, enviadas };
}

function bancoConCaptura() {
  const cap = fetchQueAnotaElCuerpo();
  const banco = cargarDashboard(RAIZ, { red: { fetch: cap.fetch } });
  return { ...banco, enviadas: cap.enviadas };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 0 · SUELO — un barrido a cero no es «está todo bien»: es que no se ha mirado.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-704 · 🔴 SUELO: el censo VE los llamadores; cero sería CEGUERA', () => {
  const censo = censoDeBodies(RAIZ);
  assert.ok(censo.total >= 50,
    `🔴 CIEGO: el censo ha encontrado ${censo.total} llamadas a \`apiRequest\` con \`body\` en todo ` +
    '`public/`. No son tan pocas: el detector no está leyendo el árbol, y con ese cero «ningún ' +
    'llamador manda objeto» sería verdad sin significar nada — que es exactamente cómo este ' +
    'defecto pasó meses sin que nadie lo viera.');
  const c = porForma(censo);
  assert.equal(c.objeto + c.stringify + c.otra, censo.total,
    '🔴 las formas no suman el total: el clasificador está perdiendo llamadas por el camino.');
});

test('SCRUM-704 · SUELO: el banco carga el dashboard de verdad y sirve `apiRequest`', () => {
  const banco = bancoConCaptura();
  assert.deepEqual(banco.fallos, [],
    `🔴 el banco no ha podido cargar los scripts: ${JSON.stringify(banco.fallos)}. Todo lo de ` +
    'abajo mediría un dashboard a medio montar.');
  assert.equal(typeof banco.ctx.apiRequest, 'function',
    '🔴 `apiRequest` no es el de `api.js`: se estaría probando el doble del banco, no el producto.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 1 · 🔴 EL ROJO: EL NOMBRE DEL TRABAJO TIENE QUE LLEGAR
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-704 · 🔴 renombrar un Trabajo: el `titulo` LLEGA al servidor', async () => {
  const banco = bancoConCaptura();
  await banco.ctx.apiRequest('/admin/jobs/41', { method: 'PATCH', body: { titulo: 'Nave 3 — cuadro general' } });

  assert.equal(banco.enviadas.length, 1, '🔴 no ha salido ninguna petición: el test no ha ejercido nada.');
  const { cuerpo } = banco.enviadas[0];

  let leido = null;
  try { leido = JSON.parse(cuerpo); } catch { /* se explica abajo */ }

  assert.ok(leido && typeof leido === 'object',
    '🔴 EL CAMPO `titulo` NO LLEGA AL SERVIDOR.\n'
    + `    lo que viaja: ${JSON.stringify(cuerpo)}\n`
    + '  Y la petición NO falla: el servidor recibe algo que no puede parsear, el campo no se\n'
    + '  escribe, y el profesional ve su cambio en pantalla hasta que recarga. `fetch` no\n'
    + '  serializa: a un objeto plano le aplica `String(x)` y sale "[object Object]".');

  assert.equal(leido.titulo, 'Nave 3 — cuadro general',
    `🔴 el servidor recibe \`titulo\` = ${JSON.stringify(leido.titulo)} y tenía que recibir el ` +
    'nombre que escribió el profesional.');
});

test('SCRUM-704 · 🔴 la DIRECCIÓN DE LA OBRA llega — es donde se presenta el técnico', async () => {
  const banco = bancoConCaptura();
  const DIR = 'Av. Rey Juan Carlos 145, Leganés';
  await banco.ctx.apiRequest('/admin/jobs/41', { method: 'PATCH', body: { direccion: DIR } });

  const leido = JSON.parse(banco.enviadas[0].cuerpo);
  assert.equal(leido.direccion, DIR,
    `🔴 EL CAMPO \`direccion\` NO LLEGA: viaja ${JSON.stringify(banco.enviadas[0].cuerpo)}.\n`
    + '  Si el jefe corrige la dirección y no se guarda, el técnico se presenta en la vieja. En una\n'
    + '  empresa que atiende centros repartidos por la provincia eso es un desplazamiento perdido,\n'
    + '  y no hay ningún error que lo avise.');
});

test('SCRUM-704 · 🔴 Y CAE CON EL MECANISMO VIEJO: un objeto sin serializar viaja como texto', async () => {
  // Esto no prueba el arreglo: prueba que SIN él el dato se pierde, y por eso el rojo de arriba
  // significa algo. Es semántica de `fetch`, no una opinión — medido aquí mismo.
  const crudo = await new Request('http://banco.local/x', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: { direccion: 'Av. Rey Juan Carlos 145' },
  }).text();

  assert.equal(crudo, '[object Object]',
    `🔴 un objeto plano como \`body\` ya no viaja como "[object Object]" sino como ${JSON.stringify(crudo)}. ` +
    'Si el entorno ha cambiado, los tests de arriba dejan de estar probando que la normalización ' +
    'de `apiRequest` añadiera algo: comprueba qué ha cambiado antes de creerte el verde.');
  assert.throws(() => JSON.parse(crudo), '🔴 «[object Object]» ya parsea como JSON: imposible.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 2 · 🔴 EL PELIGRO DEL ARREGLO: LOS 52 QUE YA MANDABAN CADENA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-704 · 🔴 una cadena pasa TAL CUAL: no se escapa dentro de otra', async () => {
  // El arreglo obvio —`JSON.stringify` incondicional— convertiría `{"a":1}` en `"{\"a\":1}"`: el
  // servidor recibiría una CADENA donde espera un objeto. Cambiaría un fallo silencioso por otro,
  // y en 52 sitios en vez de 2.
  const banco = bancoConCaptura();
  const yaSerializado = JSON.stringify({ tipoOperacion: 'TRABAJO_UNICO', nota: 'con "comillas"' });
  await banco.ctx.apiRequest('/admin/jobs/41', { method: 'PATCH', body: yaSerializado });

  const { cuerpo } = banco.enviadas[0];
  assert.equal(cuerpo, yaSerializado,
    `🔴 EL CUERPO SE HA VUELTO A SERIALIZAR.\n    mandado: ${yaSerializado}\n    viaja  : ${cuerpo}\n`
    + '  El servidor recibiría una cadena donde espera un objeto, y eso rompe a los 52 llamadores\n'
    + '  que ya serializan fuera — la convención de la casa.');
  const leido = JSON.parse(cuerpo);
  assert.equal(typeof leido, 'object',
    '🔴 lo que llega parsea a una CADENA, no a un objeto: está escapado dos veces.');
  assert.equal(leido.tipoOperacion, 'TRABAJO_UNICO');
  assert.equal(leido.nota, 'con "comillas"',
    '🔴 las comillas de dentro se han escapado de más: el texto del profesional llega alterado.');
});

test('SCRUM-704 · 🔴 LOS 52, ENUMERADOS: la convención de la casa es serializar FUERA', () => {
  const censo = censoDeBodies(RAIZ);
  const c = porForma(censo);

  // El dato que decide el arreglo, y que no se supone: la MAYORÍA ya manda cadena.
  assert.ok(c.stringify >= 50,
    `🔴 solo ${c.stringify} de ${censo.total} llamadas mandan \`JSON.stringify\`. Si la mayoría ` +
    'hubiera cambiado, la decisión de NORMALIZAR en vez de serializar siempre habría que ' +
    'reconsiderarla: se tomó porque 52 de 55 ya serializaban fuera.');
  assert.ok(c.stringify > c.objeto * 10,
    `🔴 la proporción se ha invertido: ${c.stringify} con cadena y ${c.objeto} con objeto.`);

  // Y ninguno de ellos puede quedar doble-escapado: lo garantiza el paso-a-través de arriba, que
  // es una propiedad y no una lista — cubre a los 52 por construcción.
  const conObjeto = censo.llamadas.filter((l) => l.forma === FORMAS.OBJETO);
  assert.ok(conObjeto.length <= 2,
    `🔴 hay ${conObjeto.length} llamadas mandando OBJETO y eran 2:\n`
    + conObjeto.map((l) => `    ${l.fichero}:${l.linea}  ${l.texto}`).join('\n')
    + '\n  No es un fallo —`apiRequest` ya las normaliza— pero si suben, la convención se está\n'
    + '  separando en dos y conviene decidirlo a propósito en vez de por deriva.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 3 · LO QUE NO SE PUEDE SERIALIZAR
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-704 · 🔴 un cuerpo binario NO se serializa: se perdería el fichero entero', async () => {
  // `JSON.stringify(new Blob(...))` da `{}`. Si la normalización no distinguiera, una subida
  // viajaría como dos llaves vacías y sin ningún error — el mismo defecto con otra ropa.
  const banco = bancoConCaptura();
  const params = new URLSearchParams({ a: '1', b: 'dos' });
  await banco.ctx.apiRequest('/admin/x', { method: 'POST', body: params });

  assert.equal(banco.enviadas[0].cuerpo, 'a=1&b=dos',
    `🔴 un \`URLSearchParams\` ha viajado como ${JSON.stringify(banco.enviadas[0].cuerpo)}. ` +
    'Serializarlo con `JSON.stringify` da `{}` y pierde el contenido entero, sin error.');
});

test('SCRUM-704 · un GET sin cuerpo sigue sin cuerpo', async () => {
  // Control negativo: la normalización no puede inventarse un `body` donde no lo había.
  const banco = bancoConCaptura();
  await banco.ctx.apiRequest('/admin/jobs');
  assert.equal(banco.enviadas[0].cuerpo, null,
    `🔴 un GET pelado ha salido con cuerpo: ${JSON.stringify(banco.enviadas[0].cuerpo)}.`);
});
