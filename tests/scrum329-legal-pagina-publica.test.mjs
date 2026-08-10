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
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise((r) => server.close(r)));

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
  const fallos = [];
  for (const { href, origen } of enlacesInternos()) {
    const r = await fetch(BASE + href).catch((e) => ({ status: 0, _err: e?.message }));
    const cuerpo = r.status === 200 ? await r.text() : '';
    const visible = cuerpo.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    if (r.status !== 200) { fallos.push(`${href} → ${r.status || 'sin respuesta'} (enlazado desde ${origen})`); continue; }

    // El umbral de contenido se aplica SOLO a las páginas que sostienen una obligación legal, y
    // el motivo importa: un formulario de acceso es legítimamente corto (dos etiquetas y un
    // botón), así que exigirle párrafos sería un rojo falso — y un rojo falso enseña a ignorar
    // este test. Una página LEGAL de 200 caracteres, en cambio, es una plantilla vacía haciéndose
    // pasar por información, que es justo lo que hay que cazar.
    if (ES_LEGAL.test(href) && visible.length < 800) {
      fallos.push(`${href} → 200 pero solo ${visible.length} car. de texto visible (página legal)`);
    }
  }
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
  const conCookie = [];
  for (const ruta of ['/', '/precios', '/privacidad', '/terminos']) {
    const r = await fetch(BASE + ruta);
    const set = r.headers.get('set-cookie');
    if (set) conCookie.push(`${ruta} → ${set}`);
  }
  assert.deepEqual(conCookie, [], `🔴 la visita instala cookies sin pedir nada:\n    ${conCookie.join('\n    ')}`);
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
