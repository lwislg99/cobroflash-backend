// SCRUM-1515 · NUESTRA PUERTA DE ALTA, Y LA SUYA CERRADA.
//
// Paso ① — el guion `dist/modules/auth/app/cli/altaDeMerchant.js` llama a `registerMerchant`.
// Paso ② — `POST /auth/register` ya NO da de alta: contesta siempre la frase que firmó el fundador
// (SCRUM-1515 c.18971), con la forma que ya tenía el 409 de `email_belongs_to_team`.
//
// 🔴 DECISIÓN AL CERRAR LA RUTA (8-oct-2026, J3): este test comparaba el merchant del guion con
// uno recién creado POR LA RUTA. Esa referencia ya no se puede fabricar: la ruta no crea nada. No
// se ha quitado la comparación: se ha CONGELADO la referencia. `_scrum1515-foto-de-la-ruta.json`
// es lo que dejó la ruta la última vez que dio de alta (los mismos dos merchants de aquí, con los
// mismos datos sucios, sobre `a945b405e`), y el merchant del guion se compara con ESA foto campo a
// campo. Lo que se pierde, dicho: la foto no se puede volver a sacar, así que un campo NUEVO de la
// fila no tiene con qué compararse (se cuenta y se dice, no se juzga).
//   · A: sólo nombre y correo (lo que rellenaba quien llegaba al formulario).
//   · B: los cinco campos, con `ref` = el código de A y un `source` de más de 200 caracteres.
//
// 🔴 Y EL CONTROL QUE DE VERDAD PUEDE SALIR MAL: `login` y `verify` viven en el mismo fichero que
// la ruta cerrada. Aquí un merchant que ya existe PIDE su enlace, ENTRA y lee su sesión, DESPUÉS
// de que la ruta le haya dicho que no a ese mismo correo.
//
// Lo que NO es la casa: el buzón. Un SMTP de laboratorio en 127.0.0.1 acepta el correo y lo
// cuenta; sin él la bienvenida «no sale», `lifecycleEmailsSent` no se escribe y la comparación no
// vería a un guion que cortara antes de tiempo.
//
// ⚠️ GATEADO: crea y BORRA merchants. Sólo en el banco desechable de `LIBRO_PG_URL` (loopback y
// base «*_test»); con un gate de staging puesto NO corre: no hace falta staging para medir esto.
import './_staging-db.mjs'; // SCRUM-60: si hay gate de staging, que mande él (y este fichero se salta)
import { URL_BANCO } from './_banco-libro.mjs'; // el segundo destino: justo detrás, y antes de cualquier `dist/`
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUION = path.join(RAIZ, 'dist', 'modules', 'auth', 'app', 'cli', 'altaDeMerchant.js');
const FOTO = path.join(RAIZ, 'tests', '_scrum1515-foto-de-la-ruta.json');

// El literal firmado (SCRUM-1515 c.18971). Copiado de Jira, no de la ruta.
const FRASE_FIRMADA = 'Ahora mismo no estamos aceptando altas nuevas. Si quieres probar YaQu, escríbenos y te damos acceso.';
const RUTA_CERRADA = { error: 'registration_closed', message: FRASE_FIRMADA };

// Se comparan por su REGLA, no por valor. Todo lo demás de la fila, por valor.
//   · `referralCode` acaba en las dos cifras del AÑO en que nace: por valor caería cada enero.
const POR_REGLA = ['id', 'createdAt', 'updatedAt', 'planExpiresAt', 'referralCode'];
const CATORCE_DIAS = 14 * 24 * 60 * 60 * 1000;

/** El buzón de laboratorio: acepta todo y apunta a quién iba cada correo y su línea de asunto. */
function buzonDeLaboratorio() {
  const cartas = [];
  const servidor = net.createServer((s) => {
    let resto = ''; let enDatos = false; let para = []; let cuerpo = '';
    s.write('220 laboratorio ESMTP\r\n');
    s.on('error', () => {});
    s.on('data', (trozo) => {
      resto += trozo.toString('latin1');
      for (;;) {
        if (enDatos) {
          const fin = resto.indexOf('\r\n.\r\n');
          if (fin === -1) return;
          cuerpo = resto.slice(0, fin); resto = resto.slice(fin + 5); enDatos = false;
          const asunto = (cuerpo.match(/^Subject: (.*(?:\r\n[ \t].*)*)/mi) || [])[1] || '';
          for (const p of para) cartas.push({ para: p, asunto: asunto.replace(/\r\n[ \t]/g, ' ') });
          para = []; s.write('250 OK\r\n');
          continue;
        }
        const corte = resto.indexOf('\r\n');
        if (corte === -1) return;
        const linea = resto.slice(0, corte); resto = resto.slice(corte + 2);
        const orden = linea.slice(0, 4).toUpperCase();
        if (orden === 'EHLO' || orden === 'HELO') s.write('250 laboratorio\r\n');
        else if (orden === 'RCPT') { para.push((linea.match(/<([^>]*)>/) || [])[1] || linea); s.write('250 OK\r\n'); }
        else if (orden === 'DATA') { enDatos = true; s.write('354 adelante\r\n'); }
        else if (orden === 'QUIT') { s.write('221 adios\r\n'); s.end(); }
        else s.write('250 OK\r\n');
      }
    });
  });
  return new Promise((resolve) => servidor.listen(0, '127.0.0.1', () => resolve({ cartas, servidor, puerto: servidor.address().port })));
}

const ENABLED = URL_BANCO !== '';

test('SCRUM-1515 · el merchant que crea nuestro guion nace igual que nacía el de POST /auth/register, y esa ruta ya no da de alta', { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable) · receta en docs/RUNBOOKS.md' }, async (t) => {
  assert.ok(fs.existsSync(GUION), `🔴 CIEGO: no existe ${path.relative(RAIZ, GUION)} (¿falta el build?)`);

  const buzon = await buzonDeLaboratorio();
  // El correo va al buzón de laboratorio. Antes de cargar `dist/`: la configuración se lee al importar.
  process.env.SMTP_URL = `smtp://127.0.0.1:${buzon.puerto}`;
  process.env.RESEND_API_KEY = '';
  process.env.LOG_MAGIC_LINKS = 'true';
  const enlaces = []; // lo que `logMagicLink` escribe: hace de «abrir el correo»
  const anotarEnlace = (texto) => { for (const m of String(texto).matchAll(/\[magic-link\] to=(\S+) link=(\S+)/g)) enlaces.push({ para: m[1], enlace: m[2] }); };
  const logReal = console.log;
  console.log = (...a) => { anotarEnlace(a.join(' ')); logReal(...a); };

  const { prisma } = await import('../dist/core/db/prisma.js');
  const { Prisma } = await import('@prisma/client');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  // SCRUM-560: `node:http` SIN pool de conexiones, no `fetch` sobre el propio servidor.
  const pedir = (metodo, ruta, { cuerpo, cabeceras = {} } = {}) => new Promise((resolve, reject) => {
    const datos = cuerpo === undefined ? null : Buffer.from(JSON.stringify(cuerpo));
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: ruta, method: metodo, agent: false,
      headers: { ...(datos ? { 'Content-Type': 'application/json', 'Content-Length': datos.length } : {}), ...cabeceras } },
    (res) => { let d = ''; res.setEncoding('utf8'); res.on('data', (t) => { d += t; }); res.on('end', () => resolve({ status: res.statusCode, cabeceras: res.headers, texto: d })); });
    req.on('error', reject);
    req.end(datos || undefined);
  });

  const sello = Date.now().toString(36).toUpperCase().slice(-6);
  // SUCIOS a propósito: espacios, mayúsculas, un `source` de 230 y un país con espacios.
  const A = { name: `  ${sello}A Reformas Ñandú  `, email: `  Alta-A-1515-${sello}@Test.Local ` };
  const B = { name: ` ${sello}B Fontanería Güell `, email: ` Alta-B-1515-${sello}@TEST.local  `, country: ' PT ', source: `  ${'origen/medio/campaña-'.repeat(11)}  ` };
  const limpio = (correo) => correo.trim().toLowerCase();

  // La foto de la ruta, con el sello de AQUELLA pasada cambiado por el de ésta (nombre, correo y
  // código de referido lo llevan dentro). Los dos sellos miden seis caracteres.
  const fotoCruda = fs.readFileSync(FOTO, 'utf8');
  const selloDeLaFoto = JSON.parse(fotoCruda).sello;
  assert.ok(/^[0-9A-Z]{6}$/.test(selloDeLaFoto) && sello.length === 6, '🔴 CIEGO: el sello de la foto o el de esta pasada no tiene seis caracteres');
  assert.ok(fotoCruda.split(selloDeLaFoto).length - 1 >= 4 && fotoCruda.split(selloDeLaFoto.toLowerCase()).length - 1 >= 2,
    '🔴 CIEGO: la foto no lleva su sello en nombres, códigos y correos');
  const ruta = JSON.parse(fotoCruda.replaceAll(selloDeLaFoto, sello).replaceAll(selloDeLaFoto.toLowerCase(), sello.toLowerCase())).ruta;

  // Las tablas que cuelgan de un merchant, sacadas del esquema y no escritas aquí.
  const colgadas = Prisma.dmmf.datamodel.models
    .filter((m) => m.name !== 'Merchant' && m.fields.some((f) => f.name === 'merchantId' && f.kind === 'scalar'))
    .map((m) => m.name[0].toLowerCase() + m.name.slice(1));
  assert.ok(colgadas.length >= 10 && colgadas.includes('authSession'),
    `🔴 CIEGO: sólo veo ${colgadas.length} tablas con merchantId y authSession ${colgadas.includes('authSession') ? 'está' : 'NO está'}`);

  const foto = async (correo) => {
    const fila = await prisma.merchant.findUnique({ where: { email: limpio(correo) } });
    assert.ok(fila, `🔴 no hay merchant con el correo ${limpio(correo)}: el alta no dejó fila`);
    const cuelga = {};
    for (const tabla of colgadas) {
      const n = await prisma[tabla].count({ where: { merchantId: fila.id } });
      if (n) cuelga[tabla] = n;
    }
    const sesiones = (await prisma.authSession.findMany({ where: { merchantId: fila.id }, orderBy: { id: 'asc' } }))
      .map((s) => ({ type: s.type, usada: s.usedAt !== null, teamMemberId: s.teamMemberId }));
    const cartas = buzon.cartas.filter((c) => c.para === limpio(correo)).map((c) => c.asunto).sort();
    return { fila: JSON.parse(JSON.stringify(fila)), cuelga, sesiones, cartas };
  };

  // Lo que hace el formulario de `public/register.html`: POST con el cuerpo en JSON.
  const porLaRuta = async (campos) => {
    const r = await pedir('POST', '/auth/register', { cuerpo: campos });
    return { status: r.status, cuerpo: JSON.parse(r.texto) };
  };
  const cuantos = () => prisma.merchant.count();

  // El guion se lanza como lo lanzaría una persona: otro proceso, con SU entorno escrito a mano
  // (nada del runner) y desde una carpeta vacía, para que no encuentre ningún `.env`.
  const carpetaVacia = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1515-'));
  const porElGuion = async (campos) => {
    const argumentos = Object.entries(campos).flatMap(([k, v]) => [`--${k}`, v]);
    await prisma.$disconnect(); // un banco de una sola conexión no admite a los dos a la vez
    const env = { DATABASE_URL: URL_BANCO, SMTP_URL: process.env.SMTP_URL, RESEND_API_KEY: '', LOG_MAGIC_LINKS: 'true', DISABLE_CRONS: 'true' };
    for (const k of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) if (process.env[k]) env[k] = process.env[k];
    const hijo = spawn(process.execPath, [GUION, ...argumentos], { cwd: carpetaVacia, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let salida = ''; let errores = '';
    hijo.stdout.on('data', (d) => { salida += d; });
    hijo.stderr.on('data', (d) => { errores += d; });
    const reloj = setTimeout(() => hijo.kill(), 60_000);
    const codigo = await new Promise((ok) => hijo.on('close', (c, senal) => ok(senal ? `matado (${senal}): no terminó solo en 60 s` : c)));
    clearTimeout(reloj);
    anotarEnlace(salida);
    const dicho = salida.split(/\r?\n/).filter((l) => l.startsWith('{"resultado"')).map((l) => JSON.parse(l));
    return { codigo, dicho, salida, errores };
  };

  // Entrar con el ÚLTIMO enlace que se le mandó: lo que hace quien abre su correo.
  const visitar = async (enlace) => {
    const u = new URL(enlace);
    const r = await pedir('GET', u.pathname + u.search);
    const galleta = [].concat(r.cabeceras['set-cookie'] || []).join('; ').match(/pf_session=[^;]+/);
    return { status: r.status, va: r.cabeceras.location ?? null, sesion: galleta !== null, galleta: galleta ? galleta[0] : '' };
  };
  const ultimoEnlace = (correo) => {
    const carta = enlaces.filter((e) => e.para === limpio(correo)).pop();
    assert.ok(carta, `🔴 a ${limpio(correo)} no se le ha mandado ningún enlace de acceso`);
    return carta.enlace;
  };
  const entrar = async (correo) => { const { galleta, ...resto } = await visitar(ultimoEnlace(correo)); return resto; };

  try {
    const alEmpezar = await cuantos();

    // ── LA RUTA, CERRADA ─────────────────────────────────────────────────────────────────────
    // Con los datos con los que ANTES daba de alta (los de la foto): ahora dice que no.
    const cerradaA = await porLaRuta(A);
    assert.equal(cerradaA.status, 409, `🔴 POST /auth/register tiene que negarse con 409 y contestó ${cerradaA.status} ${JSON.stringify(cerradaA.cuerpo)}`);
    assert.deepEqual(cerradaA.cuerpo, RUTA_CERRADA, '🔴 la ruta cerrada no contesta la frase firmada, con sus dos claves y ninguna más');
    // Y la contesta SIEMPRE, mande lo que mande quien llama: los cinco campos, nada, o basura.
    for (const cuerpo of [{ ...B, ref: 'LOQUESEA26' }, {}, { name: '   ', email: 'x@y.es' }, { name: 'Con nombre', email: 'sin-arroba' }]) {
      assert.deepEqual(await porLaRuta(cuerpo), cerradaA, `🔴 la ruta cerrada contesta distinto según lo que le manden: ${JSON.stringify(cuerpo).slice(0, 80)}`);
    }
    // …y las veces que haga falta: sin un 429 que cambie la frase por «espera unos minutos».
    for (let i = 0; i < 7; i++) assert.deepEqual(await porLaRuta(A), cerradaA, `🔴 a la ${i + 2}.ª vez la ruta cerrada ya no contesta lo mismo`);
    assert.equal(await cuantos(), alEmpezar, '🔴 LA RUTA CERRADA HA DADO DE ALTA A ALGUIEN');
    assert.equal(await prisma.merchant.count({ where: { email: { in: [limpio(A.email), limpio(B.email), 'x@y.es'] } } }), 0);
    assert.equal(buzon.cartas.length, 0, '🔴 la ruta cerrada ha mandado un correo');
    assert.equal(enlaces.length, 0, '🔴 la ruta cerrada ha generado un enlace de acceso');

    // Lo que PINTA la página con esa respuesta: se ejecuta SU expresión, sacada de su fuente.
    const pagina = fs.readFileSync(path.join(RAIZ, 'public', 'register.html'), 'utf8');
    const expresion = pagina.match(/showAlert\((.*'Error al crear la cuenta\.'), 'error'\)/);
    const tabla = pagina.match(/const msgs = (\{[^}]*\});/);
    assert.ok(expresion && tabla, '🔴 CIEGO: no encuentro en register.html la expresión que pinta el error, o su tabla');
    const pinta = new Function('data', 'msgs', `return ${expresion[1]};`);
    const msgs = new Function(`return ${tabla[1]};`)();
    assert.equal(pinta(cerradaA.cuerpo, msgs), FRASE_FIRMADA, '🔴 la página no pinta la frase firmada con la respuesta de la ruta cerrada');
    assert.equal(pinta({ error: 'invalid_email' }, msgs), 'Email inválido.', '🔴 CIEGO: la expresión de la página no consulta su tabla (el positivo de arriba no valdría)');
    assert.ok(/if \(res\.ok\) \{/.test(pagina) && !(cerradaA.status >= 200 && cerradaA.status < 300), '🔴 con ese código la página iría por la rama de «cuenta creada»');

    // ── EL GUION SIGUE CREANDO, con la otra puerta cerrada ───────────────────────────────────
    const gA = await porElGuion(A);
    assert.equal(gA.codigo, 0, `🔴 el guion tiene que dar de alta a A y salió ${gA.codigo}\n${gA.salida}\n${gA.errores}`);
    assert.equal(gA.dicho.at(-1)?.resultado, 'creado', `🔴 el guion salió 0 sin DECIR qué creó
${gA.salida}`);
    // POSITIVO: existe de verdad y se puede leer DESPUÉS, desde otro proceso, sin esperar a nada.
    const guionA = await foto(A.email);
    assert.deepEqual(
      { ...gA.dicho.at(-1).merchant },
      Object.fromEntries(Object.keys(gA.dicho.at(-1).merchant).map((k) => [k, guionA.fila[k]])),
      '🔴 lo que el guion DICE que creó no es lo que hay en la base');
    const entraGuionA = await entrar(A.email);
    const gB = await porElGuion({ ...B, ref: `  ${guionA.fila.referralCode} ` });
    assert.equal(gB.codigo, 0, `🔴 el guion tiene que dar de alta a B y salió ${gB.codigo}\n${gB.salida}\n${gB.errores}`);
    const guion = { A: await foto(A.email), B: await foto(B.email) };
    assert.equal(await cuantos(), alEmpezar + 2, '🔴 el guion no ha dejado exactamente dos merchants');

    // ── LA FILA DEL GUION CONTRA LA FOTO DE LA RUTA, CAMPO A CAMPO ───────────────────────────
    let porValor = 0;
    const nuevos = Object.keys(guion.A.fila).filter((k) => !(k in ruta.A.fila));
    for (const cual of ['A', 'B']) {
      const r = ruta[cual].fila; const g = guion[cual].fila;
      const faltan = Object.keys(r).filter((k) => !(k in g));
      assert.deepEqual(faltan, [], `🔴 ${cual}: la fila de hoy ya no tiene campos que la ruta sí dejaba`);
      const campos = Object.keys(r).filter((k) => !POR_REGLA.includes(k) && !(cual === 'B' && k === 'referredBy'));
      assert.ok(campos.length >= 50, `🔴 CIEGO: sólo ${campos.length} campos que comparar por valor en ${cual}`);
      const distintos = campos.filter((k) => JSON.stringify(r[k]) !== JSON.stringify(g[k]))
        .map((k) => `${k}: ruta=${JSON.stringify(r[k])} guion=${JSON.stringify(g[k])}`);
      assert.deepEqual(distintos, [], `🔴 ${cual}: EL MERCHANT DEL GUION NO NACE IGUAL QUE NACÍA EL DE LA RUTA`);
      porValor += campos.length;
      const prueba = new Date(g.planExpiresAt) - new Date(g.createdAt);
      assert.ok(Math.abs(prueba - CATORCE_DIAS) < 60_000, `🔴 ${cual}: la prueba dura ${prueba} ms y son 14 días`);
      assert.ok(Math.abs((new Date(r.planExpiresAt) - new Date(r.createdAt)) - CATORCE_DIAS) < 60_000, '🔴 CIEGO: la foto no guarda una prueba de 14 días');
      assert.ok(new Date(g.updatedAt) >= new Date(g.createdAt), `🔴 ${cual}: updatedAt anterior a createdAt`);
      // El código de referido: el de la foto, salvo las dos cifras del año en que nace cada uno.
      assert.ok(/^[0-9A-Z]{8}\d\d$/.test(r.referralCode), `🔴 CIEGO: el código de la foto no tiene la forma esperada: ${r.referralCode}`);
      assert.equal(g.referralCode.slice(0, -2), r.referralCode.slice(0, -2), `🔴 ${cual}: el código de referido no sale del nombre como salía`);
      assert.equal(g.referralCode.slice(-2), String(new Date(g.createdAt).getFullYear()).slice(-2), `🔴 ${cual}: el código de referido no acaba en el año`);
      // Y lo que el alta deja ALREDEDOR de la fila: filas colgadas, sesiones y correos.
      assert.deepEqual(guion[cual].cuelga, ruta[cual].cuelga, `🔴 ${cual}: el alta no deja las mismas filas colgadas del merchant`);
      assert.deepEqual(guion[cual].sesiones, ruta[cual].sesiones, `🔴 ${cual}: no quedan las mismas sesiones`);
      assert.deepEqual(guion[cual].cartas, ruta[cual].cartas, `🔴 ${cual}: no salen los mismos correos`);
    }
    // Los positivos de la comparación: que no esté comparando dos vacíos.
    assert.equal(guion.A.fila.email, limpio(A.email), '🔴 el guion no guardó el correo limpio');
    assert.equal(guion.A.fila.name, A.name.trim());
    assert.equal(guion.A.fila.country, 'ES');
    assert.equal(guion.A.fila.acquisitionSource, null);
    assert.deepEqual(guion.A.fila.lifecycleEmailsSent, { welcome: 1 }, '🔴 la bienvenida no llegó a anotarse: el buzón de laboratorio no está haciendo su papel');
    assert.equal(guion.A.cartas.length, 2, `🔴 el alta manda 2 correos (bienvenida y enlace) y veo ${guion.A.cartas.length}`);
    assert.equal(guion.B.fila.country, 'PT');
    assert.equal(guion.B.fila.acquisitionSource.length, 200, '🔴 el `source` no salió recortado a 200');
    assert.equal(ruta.B.fila.referredBy, ruta.A.fila.id, '🔴 CIEGO: en la foto, B no quedó referido por A');
    assert.equal(guion.B.fila.referredBy, guion.A.fila.id, '🔴 B por el guion no quedó referido por A');
    assert.ok(guion.A.cuelga.authSession >= 2, '🔴 A debería tener el enlace usado y su sesión');

    // El recién creado ENTRA, como entraba el de la ruta (lo que la foto guardó de aquel día).
    assert.deepEqual(entraGuionA, { status: 302, va: '/dashboard/', sesion: true }, '🔴 el merchant del guion no puede entrar con su enlace');
    assert.deepEqual(entraGuionA, JSON.parse(fotoCruda).entraRutaA, '🔴 el merchant del guion no entra como entraba el de la ruta');

    // ── 🔴 QUIEN YA TIENE CUENTA ENTRA IGUAL: login y verify, DESPUÉS del cierre ─────────────
    // A ya es un merchant. La ruta cerrada le dice que no también a él, y no le escribe.
    const cartasDeA = buzon.cartas.filter((c) => c.para === limpio(A.email)).length;
    const enlacesDeA = enlaces.filter((e) => e.para === limpio(A.email)).length;
    assert.deepEqual(await porLaRuta(A), cerradaA, '🔴 la ruta cerrada contesta distinto a un correo que ya es merchant');
    assert.equal(buzon.cartas.filter((c) => c.para === limpio(A.email)).length, cartasDeA, '🔴 la ruta cerrada le ha escrito a un merchant que ya existía');
    // Pide su enlace por la pantalla de acceso (con el correo como lo teclea: mayúsculas y espacios)…
    const pide = await pedir('POST', '/auth/login', { cuerpo: { email: A.email.toUpperCase() } });
    assert.equal(pide.status, 200, `🔴 UN MERCHANT QUE YA EXISTE NO PUEDE PEDIR SU ENLACE: POST /auth/login contestó ${pide.status}`);
    assert.equal(JSON.parse(pide.texto).ok, true);
    assert.equal(enlaces.filter((e) => e.para === limpio(A.email)).length, enlacesDeA + 1, '🔴 POST /auth/login no le ha mandado un enlace nuevo al merchant que ya existe');
    const enlaceNuevo = ultimoEnlace(A.email);
    // …lo abre y entra…
    const dentro = await visitar(enlaceNuevo);
    assert.deepEqual([dentro.status, dentro.va, dentro.sesion], [302, '/dashboard/', true], '🔴 UN MERCHANT QUE YA EXISTE NO PUEDE ENTRAR CON SU ENLACE (GET /auth/verify)');
    // …y esa sesión es la SUYA.
    const yo = await pedir('GET', '/admin/me', { cabeceras: { Cookie: dentro.galleta } });
    assert.equal(yo.status, 200, `🔴 la sesión que da /auth/verify no vale: GET /admin/me contestó ${yo.status}`);
    const quienSoy = JSON.parse(yo.texto);
    assert.deepEqual([quienSoy.merchantId, quienSoy.merchantName], [guion.A.fila.id, A.name.trim()], '🔴 /admin/me no devuelve al merchant que ha entrado');
    assert.equal((await pedir('GET', '/admin/me')).status, 401, '🔴 CIEGO: /admin/me contesta sin sesión, así que el 200 de arriba no prueba nada');
    // La verificación sigue NEGANDO lo que negaba: el enlace ya usado y uno inventado.
    assert.equal((await visitar(enlaceNuevo)).va, '/login.html?error=link_expired', '🔴 un enlace ya usado vuelve a dejar entrar');
    assert.equal((await visitar(`${base}/auth/verify?token=${'0'.repeat(64)}`)).va, '/login.html?error=link_expired', '🔴 un enlace inventado deja entrar');
    // Y la pantalla de acceso sigue sin dar de alta ni escribir a quien no tiene cuenta.
    const cartasAntesDelDesconocido = buzon.cartas.length;
    const desconocido = await pedir('POST', '/auth/login', { cuerpo: { email: `nadie-1515-${sello.toLowerCase()}@test.local` } });
    assert.equal(desconocido.status, 200);
    assert.equal(buzon.cartas.length, cartasAntesDelDesconocido, '🔴 /auth/login le ha escrito a un correo que no es de nadie');
    assert.equal(await cuantos(), alEmpezar + 2, '🔴 pedir acceso ha creado un merchant');

    // ── LO QUE EL GUION RECHAZA ──────────────────────────────────────────────────────────────
    const cartasAntes = buzon.cartas.length;
    const repetido = await porElGuion({ name: 'Otro nombre', email: A.email.toUpperCase() });
    assert.equal(repetido.codigo, 3, `🔴 un correo que ya es merchant: el guion tiene que salir 3 y salió ${repetido.codigo}`);
    assert.deepEqual(repetido.dicho, [{ resultado: 'ya_existe', id: guion.A.fila.id }]);
    assert.equal(buzon.cartas.length, cartasAntes, '🔴 el guion le escribió a un merchant que ya existía');
    assert.equal((await foto(A.email)).fila.name, A.name.trim(), '🔴 el guion tocó la fila que ya existía');

    // Los dos rechazos que tenía la ruta (400 `name_required` y 400 `invalid_email`), con sus códigos.
    const sinNombre = await porElGuion({ name: '   ', email: `sin-nombre-1515-${sello.toLowerCase()}@test.local` });
    const sinArroba = await porElGuion({ name: 'Con nombre', email: 'sin-arroba' });
    assert.deepEqual([sinNombre.codigo, sinNombre.dicho.at(-1)?.error, sinArroba.codigo, sinArroba.dicho.at(-1)?.error], [2, 'name_required', 2, 'invalid_email'],
      '🔴 el guion no rechaza lo que rechazaba la ruta, con sus mismos códigos');
    const malEscrito = await porElGuion({ nombre: 'Con ene', email: `mal-1515-${sello.toLowerCase()}@test.local` });
    assert.equal(malEscrito.codigo, 2, '🔴 un argumento que no es de los cinco no puede acabar en un alta');

    // SCRUM-94: el correo de un operario no puede acabar en un merchant. Por el guion sale 4; por
    // la ruta cerrada recibe lo MISMO que cualquiera (ya no se distingue a un operario de un extraño).
    const operario = await prisma.teamMember.create({ data: { merchantId: guion.A.fila.id, name: 'Operario 1515', email: `operario-1515-${sello.toLowerCase()}@test.local`, role: 'tecnico', status: 'active' } });
    const deOperario = await porElGuion({ name: 'Negocio del operario', email: operario.email });
    assert.equal(deOperario.codigo, 4, `🔴 el correo de un operario: el guion tiene que salir 4 y salió ${deOperario.codigo}\n${deOperario.salida}`);
    assert.deepEqual(await porLaRuta({ name: 'Negocio del operario', email: operario.email }), cerradaA, '🔴 la ruta cerrada contesta distinto al correo de un operario');
    assert.equal(await prisma.merchant.count({ where: { email: { in: [operario.email, `sin-nombre-1515-${sello.toLowerCase()}@test.local`, `mal-1515-${sello.toLowerCase()}@test.local`] } } }), 0,
      '🔴 un alta rechazada dejó un merchant');
    assert.equal(await cuantos(), alEmpezar + 2, '🔴 al acabar hay más merchants que los dos del guion');

    t.diagnostic(`SCRUM-1515: ruta cerrada, 409 y la frase firmada en 14 llamadas, 0 altas y 0 correos · 2 merchants por el guion · ${porValor} campos comparados por valor con la foto de la ruta (${Object.keys(ruta.A.fila).length} por fila en la foto) · por regla: ${POR_REGLA.join(', ')} y referredBy en B · campos de hoy que la foto no tiene: ${nuevos.length}${nuevos.length ? ` (${nuevos.join(', ')}; sin juzgar)` : ''} · un merchant que ya existe pide enlace, entra y lee su sesión`);
  } finally {
    console.log = logReal;
    // Todo lo de esta pasada lleva el sello: se borra por él, diga el guion lo que diga.
    const sueltos = await prisma.merchant.findMany({ where: { email: { contains: sello, mode: 'insensitive' } }, select: { id: true }, orderBy: { id: 'desc' } }).catch(() => []);
    for (const m of sueltos) {
      for (const tabla of colgadas) await prisma[tabla].deleteMany({ where: { merchantId: m.id } }).catch(() => {});
      await prisma.merchant.delete({ where: { id: m.id } }).catch((e) => logReal(`⚠️ SCRUM-1515: no se pudo borrar el merchant ${m.id}: ${e.message}`));
    }
    server.close();
    buzon.servidor.close();
    await prisma.$disconnect();
    fs.rmSync(carpetaVacia, { recursive: true, force: true });
  }
});
