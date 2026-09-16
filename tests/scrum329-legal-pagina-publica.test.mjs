// SCRUM-329 · F2 — LAS OBLIGACIONES DE LA PÁGINA PÚBLICA, CON MECANISMO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE: era un hueco sin dueño. Los bloques D y E lo mandaban a F, y F no lo asumía,
// así que la ÚNICA página pública del producto no tenía a nadie respondiendo de sus
// obligaciones como página pública.
//
// ⚠️ ESTE FICHERO NO ESCRIBE TEXTO LEGAL, y es deliberado. Produce **estructura, huecos y
// mecanismo**: qué exige cada norma, qué hay hoy medido, y un guard que impide que lo medido
// derive sin que nadie se entere. El CONTENIDO sale del bundle legal o del asesor. Un texto que
// no existe **se declara** — no se rellena con una plantilla de internet, que es como se acaba
// publicando una política que nadie ha leído y que promete cosas que el producto no hace.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA COOKIE: POR QUÉ AQUÍ NO HAY UN TEST DE «RECHAZAR»
//
// El encargo pedía comprobar que rechazar rechaza de verdad. **No se puede escribir ese test
// hoy, y el motivo es el resultado de la medición: no hay banner porque HOY NO HAY NADA QUE
// RECHAZAR.** La única cookie de toda la superficie es `pf_session` —HttpOnly, SameSite=Lax—,
// que es la de sesión: imprescindible para el servicio que el usuario pide, y por tanto exenta
// del consentimiento del art. 22.2 LSSI. Y desde SCRUM-336 la atribución ya no se persiste en el
// navegador.
//
// Escribir un test de un banner inexistente sería un rojo permanente, y un rojo permanente se
// desactiva. Lo que SÍ se puede fijar hoy es **el invariante que hace innecesario el banner**:
// la superficie pública no instala nada no esencial. El día que alguien añada analítica, este
// guard se pone rojo y obliga a la decisión —banner y consentimiento— ANTES de publicarla, que
// es cuando hay que tomarla.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// La app se levanta EN PROCESO y sin BD: las páginas legales son estáticas y no consultan nada,
// así que el «¿responde 200?» se comprueba de verdad y sin turno de staging (medido: arranca).
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://x:x@127.0.0.1:5432/x';
const { app } = await import(pathToFileURL(path.join(RAIZ, 'dist', 'app.js')).href);
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const PUERTO = server.address().port;
const BASE = `http://127.0.0.1:${PUERTO}`;
after(() => new Promise((r) => server.close(r)));

/**
 * ¿El banco SIRVE ALGO? · SUELO añadido en SCRUM-822.
 *
 * La referencia es `/index.html` a propósito: la sirve `express.static`, o sea el camino que
 * NO depende de ninguna ruta declarada a mano. Si ni eso responde, lo que venga después no mide
 * el producto — mide que aquí no hay servidor.
 *
 * Y la diferencia no es cosmética. «/privacidad → 404» manda a arreglar la landing; «no sirvo
 * nada» manda a mirar el arranque. SCRUM-822 costó exactamente esto: dos guards en rojo
 * acusando a una landing sana porque el banco no podía servir lo que se le pedía. Un hueco
 * declarado se ve; una acusación equivocada manda a buscar donde no está.
 *
 * @returns {Promise<string|null>} el motivo si el banco está mudo, `null` si sirve.
 */
const REFERENCIA_QUE_SIEMPRE_SIRVE = '/index.html';

/**
 * 🔴 NO SE USA `fetch` A PROPÓSITO, y no es preferencia de estilo: es el remedio que SCRUM-560 ya
 * aplicó a `scrum334-destino-de-los-cta` (`efe1004f`, 20-ago-2026: «2 abortos en 10 pasadas antes,
 * 0 en 20 después»), heredado a su vez de SCRUM-100. Con varias peticiones de undici sobre el
 * mismo `app.listen(0)`, sus conexiones agrupadas dejan el proceso en un estado que, bajo
 * concurrencia, hace que la petición ni salga: `fetch failed`, sin ruta y sin estado.
 *
 * MEDIDO EN ESTE FICHERO antes de tocarlo (SCRUM-822, 8-sep-2026): con 24 instancias en paralelo
 * y 12 procesos quemando CPU, **24 de 24 abortaban**, con 72 `fetch failed`. A una sola instancia
 * no se reproduce nunca — por eso vivió meses y por eso costó una tanda entera y un ticket falso.
 *
 * `agent: false` es la pieza que lo evita: sin pool, cada petición abre y cierra su conexión.
 *
 * @returns {Promise<{status:number, cuerpo:string, cabeceras:object, _err?:string}>}
 *   `status: 0` significa **no hubo respuesta**. NO es un 404 y abajo no se tratan igual.
 */
function pedirEn(puerto, ruta) {
  return new Promise((resolve) => {
    const req = http.request(
      { host: '127.0.0.1', port: puerto, path: ruta, method: 'GET', agent: false },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (t) => { data += t; });
        res.on('end', () => resolve({ status: res.statusCode, cuerpo: data, cabeceras: res.headers }));
      },
    );
    // Un fallo de red es «sin respuesta», no una excepción que tumbe el fichero entero sin decir
    // qué ruta fue. El clasificador de abajo es quien decide qué significa un 0.
    req.on('error', (e) => resolve({ status: 0, cuerpo: '', cabeceras: {}, _err: e?.message || 'error de red' }));
    req.end();
  });
}

const pedir = (ruta) => pedirEn(PUERTO, ruta);

/**
 * 🔴 EL CORAZÓN DE SCRUM-822 · «NO PUDE MIRAR» NO ES «ESTÁ ROTO».
 *
 * Antes, un `status: 0` caía en el MISMO cubo que un 404 y el assert lo publicaba como «enlaces
 * públicos rotos». O sea: el instrumento, cuando no podía conectar, acusaba al producto. Ésa es
 * la misma familia que «un cero no es *está limpio*, es *no he mirado*» — y aquí costó un ticket
 * Highest abierto contra una landing sana.
 *
 * El suelo `bancoMudo()` no basta por sí solo: mira UNA ruta al principio, así que si el servidor
 * enmudece a mitad del bucle, todos los enlaces siguientes salían acusados. Por eso la separación
 * se hace petición a petición.
 *
 * ── SCRUM-852 · EL ESTADO SE DEVUELVE COMO DATO, ADEMÁS DE DENTRO DEL TEXTO ──────────────
 *
 * `status` no es información repetida: es la ÚNICA forma de preguntar por el código de estado
 * sin buscarlo dentro de una cadena. El texto de `sin-respuesta` lleva el error de red entero
 * —y ahí dentro va el PUERTO EFÍMERO—, así que preguntarle al texto «¿hablas de un 404?» casa
 * con el puerto `54047` y acusa de 404 a una conexión rechazada. Medido: **157 de los 28.232
 * puertos del rango efímero (32768-60999) contienen «404», 1 de cada 180**.
 *
 * `0` = no hubo respuesta, que es lo que ya significa `r.status` a la entrada. No se inventa un
 * código: la ausencia tiene su propio valor y por eso se distingue de cualquier 4xx.
 *
 * @returns {{tipo:'sin-respuesta'|'roto'|'vacio'|'ok', texto:string, status:number}}
 */
/**
 * SCRUM-852 · La marca que el clasificador pone DELANTE del codigo de estado, en un sitio.
 * Se declara aparte para que los asserts pregunten por la POSICION del codigo en vez de
 * buscar el numero suelto dentro de un texto que lleva el puerto efimero dentro.
 */
export const FLECHA = '→ ';
export function clasificar(r, href, origen = '') {
  const desde = origen ? ` (enlazado desde ${origen})` : '';
  if (!r || r.status === 0) return { tipo: 'sin-respuesta', status: 0, texto: `${href} → sin respuesta (${(r && r._err) || 'error de red'})${desde}` };
  if (r.status !== 200) return { tipo: 'roto', status: r.status, texto: `${href} → ${r.status}${desde}` };
  const visible = String(r.cuerpo || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (ES_LEGAL.test(href) && visible.length < 800) {
    return { tipo: 'vacio', status: r.status, texto: `${href} → 200 pero solo ${visible.length} car. de texto visible (página legal)${desde}` };
  }
  return { tipo: 'ok', status: r.status, texto: '' };
}

async function bancoMudo() {
  const ruta = REFERENCIA_QUE_SIEMPRE_SIRVE; // el mensaje sale de la constante, no de un literal
  const r = await pedir(ruta);
  if (r.status === 200) return null;
  return `\`${ruta}\` → ${r.status || `sin respuesta (${r._err || 'error de red'})`}`;
}

/** Rutas que sostienen una obligación legal: se les exige además CONTENIDO, no solo un 200. */
const ES_LEGAL = /^\/(privacidad|terminos|legal(\/|$)|aviso-legal|cookies)/;

/** Páginas públicas cuyos enlaces internos se comprueban. */
const PAGINAS = ['public/index.html', 'public/precios.html', 'public/privacidad.html',
  'public/terminos.html', 'public/login.html', 'public/register.html'];

/** Enlaces internos a PÁGINAS (no assets) que aparecen en la superficie pública. */
function enlacesInternos() {
  const fuera = /\.(css|js|png|jpe?g|svg|ico|json|webmanifest|xml|txt|woff2?)$/i;
  const out = new Map();
  for (const rel of PAGINAS) {
    for (const [, href] of leer(rel).matchAll(/href="(\/[^"#?]*)"/g)) {
      if (fuera.test(href)) continue;
      if (!out.has(href)) out.set(href, rel);
    }
  }
  return [...out].map(([href, origen]) => ({ href, origen }));
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// 1 · LOS ENLACES DEL PIE RESPONDEN, Y NO ESTÁN VACÍOS
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-329 · el censo de enlaces internos LEE de verdad (suelo)', () => {
  const enlaces = enlacesInternos();
  assert.ok(
    enlaces.length >= 3,
    `🔴 ESCÁNER CIEGO: solo veo ${enlaces.length} enlaces internos en ${PAGINAS.length} páginas ` +
      'públicas. Si el patrón dejó de casar, los tests de abajo pasarían sin comprobar nada.',
  );
  assert.ok(enlaces.some((e) => e.href === '/privacidad'), '🔴 no veo /privacidad: el censo no está leyendo el pie');
  assert.ok(enlaces.some((e) => e.href === '/terminos'), '🔴 no veo /terminos: el censo no está leyendo el pie');
});

test('SCRUM-329 · cada enlace interno responde 200 y con contenido', async () => {
  // Un aviso legal que da 404 es PEOR que no tenerlo: el visitante ve que hay enlace, lo pulsa, y
  // se queda sin la información Y con la impresión de que existe. Y una página que responde 200
  // vacía es lo mismo con otra cara, así que se mide el cuerpo, no solo el estado.
  // SUELO (SCRUM-822): antes de acusar a ningún enlace, comprobar que el banco sirve algo.
  const mudo = await bancoMudo();
  assert.equal(
    mudo, null,
    `🔴 CIEGO: el banco no sirve ni la página que siempre sirve el estático (${mudo}).\n` +
      '  NO se acusa a ningún enlace: con el servidor mudo, un «404» no distingue una landing\n' +
      '  rota de un arranque que no llegó a levantarse, y mandaría a buscar donde no está.',
  );

  // DOS CUBOS, y la separación es el ticket: lo que NO PUDE MIRAR va aparte de lo que está ROTO.
  // El umbral de contenido (800 car.) se aplica SOLO a páginas con obligación legal, y el motivo
  // importa: un formulario de acceso es legítimamente corto, así que exigirle párrafos sería un
  // rojo falso — y un rojo falso enseña a ignorar este test. Una página LEGAL de 200 caracteres,
  // en cambio, es una plantilla vacía haciéndose pasar por información. Vive en `clasificar`.
  const mudas = [];
  const fallos = [];
  for (const { href, origen } of enlacesInternos()) {
    const c = clasificar(await pedir(href), href, origen);
    if (c.tipo === 'sin-respuesta') { mudas.push(c.texto); continue; }
    if (c.tipo !== 'ok') fallos.push(c.texto);
  }
  // Primero lo CIEGO: si hubo peticiones que no llegaron a hacerse, no se acusa a nadie.
  assert.deepEqual(
    mudas, [],
    `🔴 CIEGO: hay peticiones que no llegaron a hacerse:\n    ${mudas.join('\n    ')}\n` +
      '  NO se acusa a ningún enlace por esto: «no pude conectar» no es «respondió 404», y\n' +
      '  confundirlos manda a arreglar una landing sana (SCRUM-822).',
  );
  assert.deepEqual(fallos, [], `🔴 enlaces públicos rotos o vacíos:\n    ${fallos.join('\n    ')}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 2 · COOKIES · la superficie pública no instala nada que haya que consentir
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Inventario de cookies que el producto ESCRIBE, derivado del código. */
function cookiesQueEscribeElProducto() {
  const nombres = new Set();
  const dir = path.join(RAIZ, 'src');
  const recorrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (e.name.endsWith('.ts')) {
        const src = fs.readFileSync(p, 'utf8');
        for (const [, n] of src.matchAll(/'Set-Cookie',\s*[`'"]?\s*([A-Za-z0-9_]+)=/g)) nombres.add(n);
        for (const [, n] of src.matchAll(/res\.cookie\(\s*['"]([A-Za-z0-9_]+)['"]/g)) nombres.add(n);
      }
    }
  };
  recorrer(dir);
  // El front también podría escribirlas sin pasar por el servidor.
  for (const rel of PAGINAS) {
    for (const [, n] of leer(rel).matchAll(/document\.cookie\s*=\s*[`'"]([A-Za-z0-9_]+)=/g)) nombres.add(n);
  }
  return [...nombres];
}

/** Las que son imprescindibles para el servicio pedido → exentas del art. 22.2 LSSI. */
const ESENCIALES = new Set(['pf_session']);

test('SCRUM-329 · SUELO: el inventario de cookies ENCUENTRA cookies', () => {
  // Sin esto, «no hay cookies no esenciales» y «no sé mirar cookies» son el mismo verde y
  // significan lo contrario. El producto escribe al menos la de sesión: si no aparece, el
  // escáner está ciego y todo lo de abajo no vale nada.
  const inventario = cookiesQueEscribeElProducto();
  assert.ok(
    inventario.length >= 1 && inventario.includes('pf_session'),
    `🔴 ESCÁNER CIEGO: el inventario de cookies ve ${JSON.stringify(inventario)} y la de sesión ` +
      '(`pf_session`) tiene que estar sí o sí. Si no la ve, no está leyendo el código.',
  );
});

test('SCRUM-329 · el producto NO escribe ninguna cookie no esencial', () => {
  const noEsenciales = cookiesQueEscribeElProducto().filter((n) => !ESENCIALES.has(n));
  assert.deepEqual(
    noEsenciales, [],
    `🔴 APARECE ALMACENAMIENTO QUE HAY QUE CONSENTIR: ${noEsenciales.join(', ')}.\n` +
      '  Mientras la única cookie sea la de sesión (imprescindible para el servicio pedido), el\n' +
      '  art. 22.2 LSSI no exige banner. En cuanto haya una que no lo sea, hace falta consentimiento\n' +
      '  PREVIO y poder rechazar tan fácil como aceptar (Guía de cookies de la AEPD) — y eso se\n' +
      '  decide ANTES de publicarla, no después.',
  );
});

test('SCRUM-329 · visitar la página pública no instala NINGUNA cookie', async () => {
  // El otro lado de la misma pregunta, medido en la respuesta real y no en el código: quien
  // aterriza en la landing sin registrarse no debe llevarse nada en el navegador.
  //
  // 🔴 EL `.catch` NO ES DEFENSIVO, ES LA DIFERENCIA ENTRE MEDIR Y NO MEDIR (SCRUM-822).
  // Sin él, una petición que no llega tumbaba el FICHERO entero con un `fetch failed` sin
  // nombrar ruta — y eso ya pasó: quedó anotado en `main` (commit a37427f0, SCRUM-637) como
  // flake de concurrencia de esta misma línea, mientras la hermana de arriba sí lo llevaba.
  // Una petición que no se hizo no puede sostener «no instala cookies»: eso es CIEGO, no verde.
  const mudas = [];
  const conCookie = [];
  for (const ruta of ['/', '/precios', '/privacidad', '/terminos']) {
    const r = await pedir(ruta);
    if (r.status === 0) { mudas.push(`${ruta} → sin respuesta (${r._err})`); continue; }
    const set = r.cabeceras['set-cookie'];
    if (set) conCookie.push(`${ruta} → ${Array.isArray(set) ? set.join(' · ') : set}`);
  }
  assert.deepEqual(
    mudas, [],
    `🔴 CIEGO: hay peticiones que no llegaron a hacerse:\n    ${mudas.join('\n    ')}\n` +
      '  No se afirma que la visita no instale cookies sobre una respuesta que no existe.',
  );
  assert.deepEqual(conCookie, [], `🔴 la visita instala cookies sin pedir nada:\n    ${conCookie.join('\n    ')}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-822 · EL CONTROL NEGATIVO: el instrumento sabe decir «no he podido mirar»
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// Sin esto, todo lo de arriba es una promesa. Un guard que no distingue «no pude conectar» de
// «respondió 404» acusa al producto cada vez que le falla la red — y eso NO es hipotético: pasó
// el 7-sep-2026 y costó una tanda entera y un ticket Highest abierto contra una landing sana.
//
// Se prueba contra un puerto MUERTO DE VERDAD (se abre uno, se lee su número y se cierra), no
// contra un objeto de mentira: un doble que devuelve lo que yo decida probaría mi imaginación.
test('SCRUM-822 · 🔴 «no pude conectar» NO se cuenta como 404', async () => {
  const efimero = http.createServer();
  await new Promise((r) => efimero.listen(0, '127.0.0.1', r));
  const puertoMuerto = efimero.address().port;
  await new Promise((r) => efimero.close(r));

  // ── ① lo que de verdad pasa cuando no hay nadie escuchando ──
  const r = await pedirEn(puertoMuerto, '/privacidad');
  assert.equal(r.status, 0,
    `🔴 contra un puerto cerrado el estado tendría que ser 0 y es ${r.status}: si `
    + 'aquí sale un número HTTP, el resto de este fichero está midiendo otra cosa.');
  assert.ok(r._err, '🔴 sin motivo apuntado, «sin respuesta» no se puede explicar a nadie');

  // ── ② y el clasificador lo manda al cubo CIEGO, no al de rotos ──
  const c = clasificar(r, '/privacidad', 'public/index.html');
  assert.equal(c.tipo, 'sin-respuesta',
    `🔴 EL DEFECTO DE SCRUM-822 HA VUELTO: un fallo de conexión se ha clasificado como `
    + `«${c.tipo}». Así es como este guard acusó a una landing sana de servir 404.`);
  assert.match(c.texto, /sin respuesta/, '🔴 el mensaje no dice que no hubo respuesta');
  // ── 🔴 SCRUM-852 · POR IDENTIDAD, NO POR PARECIDO ───────────────────────────────────────
  //
  // Aquí ponía `assert.doesNotMatch(c.texto, /404/)`, y `c.texto` lleva dentro el error de red
  // COMPLETO — con el puerto efímero: `connect ECONNREFUSED 127.0.0.1:54047`. El puerto `54047`
  // contiene «404», así que el guard que existe para distinguir «no pude conectar» de «404» se
  // confundía con un trozo del número de puerto y daba ROJO sobre una landing sana.
  //
  // Medido: 157 de los 28.232 puertos del rango efímero contienen «404» — **1 de cada 180
  // ejecuciones**, que con CI por PR son días, no meses.
  //
  // El código de estado se compara como DATO. `0` es «no hubo respuesta» y no se parece a nada.
  assert.equal(c.status, 0,
    `🔴 un fallo de conexión ha salido con estado ${c.status}: el clasificador le está poniendo `
    + 'un código HTTP a algo que nunca respondió.');
  assert.notEqual(c.status, 404, '🔴 una conexión rechazada se ha clasificado con un 404');
  // Y el TEXTO tampoco puede afirmar un estado. Se pregunta POR LA POSICION en la que el
  // clasificador escribe el codigo —justo detras de la flecha— y **sin una sola regex**: la
  // primera version de esta linea llevaba `s` y `d`, la herramienta se comio las barras y dejo
  // un BACKSPACE (0x08) dentro del patron. Esa regex no casaba con nada, asi que el
  // `doesNotMatch` pasaba SIEMPRE: un control incapaz de fallar, que es peor que no tenerlo.
  const trasLaFlecha = c.texto.split(FLECHA)[1] ?? '';
  assert.equal(Number.isNaN(Number.parseInt(trasLaFlecha, 10)), true,
    '🔴 el mensaje de «sin respuesta» esta ensenando un codigo de estado que nadie devolvio: '
    + `detras de la flecha hay «${trasLaFlecha.slice(0, 20)}».`);


  // ── ③ CONTROL POSITIVO del mismo clasificador: un 404 DE VERDAD sigue siendo un fallo ──
  // Sin esta mitad, un clasificador que dijera «sin-respuesta» a todo pasaría ① y ② y habría
  // apagado el guard: nunca volvería a ver un enlace legal roto.
  assert.equal(clasificar({ status: 404, cuerpo: '' }, '/privacidad').tipo, 'roto',
    '🔴 un 404 real ha dejado de contar como enlace roto: el guard está apagado');
  assert.equal(clasificar({ status: 200, cuerpo: '<p>hola</p>' }, '/privacidad').tipo, 'vacio',
    '🔴 una página legal casi vacía ha dejado de contar');
  assert.equal(clasificar({ status: 200, cuerpo: '<p>' + 'x'.repeat(900) + '</p>' }, '/privacidad').tipo, 'ok',
    '🔴 una página legal con contenido se está marcando como defecto: rojo falso');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-852 · UN PUERTO QUE CONTIENE «404» NO ES UN 404
//
// Misma familia que SCRUM-824b: allí un sha de ocho caracteres todos dígitos parecía un reloj;
// aquí un puerto efímero parece un código de estado. **Un dato numérico que casualmente cumple
// el patrón de OTRO dato numérico.** Se distingue por IDENTIDAD, no por parecido.
//
// FRECUENCIA MEDIDA, porque decide la prioridad: en el rango efímero de Linux (32768-60999,
// 28.232 puertos) hay **157 que contienen «404» — 1 de cada 180**. Con CI por PR y auto-merge,
// eso es días. No es una rareza teórica: cayó el 15-sep-2026 con el puerto 54047.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-852 · 🔴 EL QUE DECIDE: un puerto con «404» dentro NO se cuenta como 404', () => {
  // El caso exacto que tumbó la suite, reproducido como DATO y no como azar: si esto dependiera
  // de que `listen(0)` reparta un puerto concreto, el control sólo se ejecutaría 1 de cada 180
  // veces — y un control que casi nunca corre no es un control.
  //
  // ⚠️ Y esto NO es fijar el puerto para esquivar el defecto (que es lo prohibido): el servidor
  // real de este fichero sigue pidiendo puerto efímero. Lo que se fija aquí es la ENTRADA del
  // clasificador, que es justo la pieza que se equivocaba.
  const PUERTOS_TRAMPA = [54047, 33404, 40412, 44045];
  for (const puerto of PUERTOS_TRAMPA) {
    const c = clasificar({ status: 0, _err: `connect ECONNREFUSED 127.0.0.1:${puerto}` }, '/privacidad', 'public/index.html');

    assert.equal(c.tipo, 'sin-respuesta',
      `🔴 con el puerto ${puerto} un fallo de conexión se clasificó como «${c.tipo}»`);
    assert.equal(c.status, 0,
      `🔴 con el puerto ${puerto} el estado salió ${c.status}: el número del puerto se ha colado `
      + 'como si fuera un código HTTP.');
    assert.notEqual(c.status, 404, `🔴 el puerto ${puerto} se ha leído como un 404`);
  }

  // Y el suelo del propio control: los cuatro puertos TIENEN que contener «404», o esto no está
  // probando nada. Un caso de prueba que no contiene la trampa es una tautología con forma de test.
  for (const puerto of PUERTOS_TRAMPA) {
    assert.ok(String(puerto).includes('404'),
      `🔴 CONTROL VACÍO: ${puerto} no contiene «404», así que no ejercita el defecto de SCRUM-852`);
  }
});

test('SCRUM-852 · ✅ POSITIVO: un 404 DE VERDAD sigue siendo un enlace roto', () => {
  // La mitad peligrosa. Si el arreglo se comiera el caso real, habríamos apagado el guard —y eso
  // es peor que el defecto que veníamos a quitar: dejaría de avisar de una página legal caída.
  const c = clasificar({ status: 404, cuerpo: '' }, '/privacidad', 'public/index.html');
  assert.equal(c.tipo, 'roto', '🔴 un 404 real ha dejado de contar como enlace roto: el guard está apagado');
  assert.equal(c.status, 404, '🔴 el 404 real no llega como dato: no se puede distinguir de nada');
  // Derivado del DATO, no de un literal: si el codigo cambiara, el mensaje tiene que seguirlo.
  assert.ok(c.texto.includes(FLECHA + c.status),
    `🔴 el mensaje de un 404 real ya no dice el codigo: «${c.texto}`);

  // Y los otros estados de fallo siguen entrando, no sólo el 404.
  for (const st of [403, 500, 502]) {
    const x = clasificar({ status: st, cuerpo: '' }, '/privacidad');
    assert.equal(x.tipo, 'roto', `🔴 un ${st} ha dejado de contar como roto`);
    assert.equal(x.status, st, `🔴 el ${st} no viaja como dato`);
  }
});

test('SCRUM-852 · ✅ NEGATIVO: lo que cerró SCRUM-822 sigue en pie, sin relajar', () => {
  // «no pude conectar» ≠ «404». Se comprueba que las dos cosas siguen siendo DISTINGUIBLES por
  // el dato, que es más fuerte que compararlas por su texto.
  const sinRed = clasificar({ status: 0, _err: 'connect ECONNREFUSED 127.0.0.1:8080' }, '/privacidad');
  const roto = clasificar({ status: 404, cuerpo: '' }, '/privacidad');

  assert.notEqual(sinRed.tipo, roto.tipo, '🔴 «sin respuesta» y «roto» han dejado de distinguirse');
  assert.equal(sinRed.tipo, 'sin-respuesta', '🔴 EL DEFECTO DE SCRUM-822 HA VUELTO');
  assert.notEqual(sinRed.status, roto.status, '🔴 los dos casos traen el mismo estado');
  assert.match(sinRed.texto, /sin respuesta/, '🔴 el mensaje no dice que no hubo respuesta');
});

test('SCRUM-852 · SUELO: el clasificador distingue los CUATRO cubos, o está ciego', () => {
  // Si todo cayera en un solo cubo, los tres controles de arriba pasarían sin comprobar nada.
  const vistos = new Set([
    clasificar({ status: 0, _err: 'x' }, '/privacidad').tipo,
    clasificar({ status: 404, cuerpo: '' }, '/privacidad').tipo,
    clasificar({ status: 200, cuerpo: '<p>hola</p>' }, '/privacidad').tipo,
    clasificar({ status: 200, cuerpo: '<p>' + 'x'.repeat(900) + '</p>' }, '/privacidad').tipo,
  ]);
  assert.deepEqual([...vistos].sort(), ['ok', 'roto', 'sin-respuesta', 'vacio'],
    `🔴 CLASIFICADOR CIEGO: sólo distingue ${vistos.size} cubos (${[...vistos].join(', ')}). `
    + 'Con menos de cuatro, el resto de este fichero mide otra cosa.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 3 · EL ESTADO DE LAS OBLIGACIONES · declarado, y no puede derivar en silencio
//
// No se puede escribir un test que exija el texto del art. 10 LSSI: ese texto NO EXISTE y no lo
// escribe una sesión (ni se inventa una razón social). Lo que sí se puede es **fijar el estado
// medido**, de modo que:
//   · si alguien AÑADE lo que falta, el test falla pidiendo que se actualice → la mejora queda
//     anotada en vez de pasar desapercibida (mismo criterio que los trinquetes de 243/275);
//   · si alguien QUITA lo que hay, falla también.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Señales medibles de cada obligación. `true` = está; `false` = hueco declarado. */
const ESTADO_DECLARADO = {
  // Art. 10 LSSI — identificación del prestador: razón social/NIF/domicilio/registro.
  identificacionPrestador: false,
  // Art. 10 LSSI — vía de contacto directa y efectiva.
  contactoPublicado: true,
  // Art. 13 RGPD — información en el formulario que recoge datos (registro).
  infoRgpdEnRegistro: false,
  // Terceros que reciben la IP del visitante sin que medie consentimiento.
  sinTercerosEnLaLanding: false,
};

function medirObligaciones() {
  const legales = leer('public/privacidad.html') + leer('public/terminos.html');
  const registro = leer('public/register.html');
  const index = leer('public/index.html');
  const sinComentarios = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
  return {
    // Identificación: NIF/CIF del PRESTADOR, domicilio o datos registrales. No vale que la palabra
    // aparezca describiendo los datos del profesional (eso es un dato tratado, no la identidad).
    identificacionPrestador:
      /titular de (este sitio|la web)|razón social|domicilio social|registro mercantil|inscrita en/i.test(legales),
    contactoPublicado: /[a-z0-9._%-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(legales),
    infoRgpdEnRegistro: /href="\/privacidad"/.test(sinComentarios(registro)),
    sinTercerosEnLaLanding:
      !/https:\/\/fonts\.(googleapis|gstatic)\.com/.test(sinComentarios(index)),
  };
}

test('SCRUM-329 · el estado legal medido coincide con el declarado (y si mejora, se anota)', () => {
  const medido = medirObligaciones();
  const diferencias = Object.keys(ESTADO_DECLARADO)
    .filter((k) => medido[k] !== ESTADO_DECLARADO[k])
    .map((k) => `${k}: declarado ${ESTADO_DECLARADO[k]}, medido ${medido[k]}`);

  assert.deepEqual(
    diferencias, [],
    '🔴 el estado legal de la página pública ha cambiado y la declaración no:\n    ' +
      diferencias.join('\n    ') +
      '\n\n  Si es una MEJORA (pasó a `true`): enhorabuena — actualiza `ESTADO_DECLARADO` y la\n' +
      '  entrada de `docs/master/SCRUM-329.md` en el mismo commit, para que quede anotada.\n' +
      '  Si es un RETROCESO (pasó a `false`): se ha quitado algo publicado que cumplía una\n' +
      '  obligación, y eso no puede pasar en silencio.',
  );
});

test('SCRUM-329 · los huecos declarados siguen siendo huecos REALES, no una lista vieja', () => {
  // Un estado declarado que nadie vuelve a medir se convierte en folclore. Este test comprueba
  // que las señales se calculan de verdad sobre los ficheros — no que devuelvan lo esperado.
  const medido = medirObligaciones();
  assert.equal(typeof medido.identificacionPrestador, 'boolean');
  assert.equal(Object.keys(medido).length, Object.keys(ESTADO_DECLARADO).length,
    '🔴 hay obligaciones medidas que no están declaradas (o al revés): las dos listas van juntas');
});
