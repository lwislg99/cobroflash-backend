// SCRUM-1515, paso ① · NUESTRA PUERTA DE ALTA DEJA LA MISMA FILA QUE LA RUTA.
//
// El guion `dist/modules/auth/app/cli/altaDeMerchant.js` llama a `registerMerchant`, el mismo que
// `POST /auth/register`. Que lo llame no basta para decir que el merchant nace igual: la ruta
// LIMPIA los cinco campos antes de llamarlo, y la bienvenida —que escribe en la fila— sale después
// de que `registerMerchant` vuelva. Así que aquí se dan de alta los MISMOS dos merchants por las
// dos puertas, con los datos SUCIOS, y se comparan las filas campo a campo:
//   · A: sólo nombre y correo (lo que rellena quien llega al formulario).
//   · B: los cinco campos, con `ref` = el código de A y un `source` de más de 200 caracteres.
// Los de la ruta se BORRAN antes de crear los del guion: así el correo, el nombre y el código de
// referido son los mismos y se comparan POR VALOR. Sólo cuatro campos no pueden coincidir (el id y
// tres fechas), y `referredBy` en B; ésos se comparan por su regla, y se dice cuáles son.
//
// Lo que NO es la casa: el buzón. Un SMTP de laboratorio en 127.0.0.1 acepta el correo y lo
// cuenta; sin él la bienvenida «no sale», `lifecycleEmailsSent` no se escribe por ninguna de las
// dos puertas y la comparación no vería a un guion que cortara antes de tiempo.
//
// ⚠️ GATEADO: crea y BORRA merchants. Sólo en el banco desechable de `LIBRO_PG_URL` (loopback y
// base «*_test»); con un gate de staging puesto NO corre: no hace falta staging para medir esto.
import './_staging-db.mjs'; // SCRUM-60: si hay gate de staging, que mande él (y este fichero se salta)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { URL_BANCO } from './_banco-libro.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUION = path.join(RAIZ, 'dist', 'modules', 'auth', 'app', 'cli', 'altaDeMerchant.js');

// Se comparan por su REGLA, no por valor. Todo lo demás de la fila, por valor.
const POR_REGLA = ['id', 'createdAt', 'updatedAt', 'planExpiresAt'];
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

test('SCRUM-1515 · el merchant que crea nuestro guion nace igual que el de POST /auth/register', { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable) · receta en docs/RUNBOOKS.md' }, async (t) => {
  assert.ok(fs.existsSync(GUION), `🔴 CIEGO: no existe ${path.relative(RAIZ, GUION)} (¿falta el build?)`);

  const buzon = await buzonDeLaboratorio();
  // El correo de las DOS puertas va al buzón de laboratorio. Antes de cargar `dist/`: la
  // configuración se lee al importar.
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

  const sello = Date.now().toString(36).toUpperCase().slice(-6);
  // SUCIOS a propósito: espacios, mayúsculas, un `source` de 230 y un país con espacios.
  const A = { name: `  ${sello}A Reformas Ñandú  `, email: `  Alta-A-1515-${sello}@Test.Local ` };
  const B = { name: ` ${sello}B Fontanería Güell `, email: ` Alta-B-1515-${sello}@TEST.local  `, country: ' PT ', source: `  ${'origen/medio/campaña-'.repeat(11)}  ` };
  const limpio = (correo) => correo.trim().toLowerCase();
  const creados = new Set();

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

  const borrar = async (correo) => {
    const m = await prisma.merchant.findUnique({ where: { email: limpio(correo) } });
    if (!m) return;
    for (const tabla of colgadas) await prisma[tabla].deleteMany({ where: { merchantId: m.id } });
    await prisma.merchant.delete({ where: { id: m.id } });
    creados.delete(limpio(correo));
    buzon.cartas.splice(0, buzon.cartas.length, ...buzon.cartas.filter((c) => c.para !== limpio(correo)));
  };

  const porLaRuta = async (campos) => {
    const r = await fetch(`${base}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(campos) });
    const cuerpo = await r.json();
    if (r.status === 200) {
      creados.add(limpio(campos.email));
      // La ruta contesta ANTES de que salga la bienvenida: se espera a verla en la fila.
      for (let i = 0; i < 150; i++) {
        const m = await prisma.merchant.findUnique({ where: { email: limpio(campos.email) }, select: { lifecycleEmailsSent: true } });
        if (m?.lifecycleEmailsSent?.welcome === 1) break;
        await new Promise((ok) => setTimeout(ok, 100));
      }
    }
    return { status: r.status, cuerpo };
  };

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
    if (dicho.some((d) => d.resultado === 'creado')) creados.add(limpio(campos.email));
    return { codigo, dicho, salida, errores };
  };

  // Entrar con el enlace que mandó el alta: lo que hace el recién llegado al abrir su correo.
  const entrar = async (correo) => {
    const carta = enlaces.filter((e) => e.para === limpio(correo)).pop();
    assert.ok(carta, `🔴 el alta de ${limpio(correo)} no dejó ningún enlace de acceso`);
    const u = new URL(carta.enlace);
    const r = await fetch(base + u.pathname + u.search, { redirect: 'manual' });
    return { status: r.status, va: r.headers.get('location'), sesion: /pf_session=/.test(r.headers.get('set-cookie') || '') };
  };

  try {
    // ── LA RUTA ──────────────────────────────────────────────────────────────────────────────
    const rA = await porLaRuta(A);
    assert.equal(rA.status, 200, `🔴 la ruta tiene que dar de alta a A y contestó ${rA.status} ${JSON.stringify(rA.cuerpo)}`);
    const entraRutaA = await entrar(A.email);
    const codigoRuta = (await foto(A.email)).fila.referralCode;
    const rB = await porLaRuta({ ...B, ref: `  ${codigoRuta} ` });
    assert.equal(rB.status, 200, `🔴 la ruta tiene que dar de alta a B y contestó ${rB.status}`);
    const ruta = { A: await foto(A.email), B: await foto(B.email) };
    const idRutaA = ruta.A.fila.id;
    // Los dos rechazos de la ruta, para compararlos con los del guion.
    const rSinNombre = await porLaRuta({ name: '   ', email: `sin-nombre-1515-${sello.toLowerCase()}@test.local` });
    const rSinArroba = await porLaRuta({ name: 'Con nombre', email: 'sin-arroba' });
    await borrar(B.email);
    await borrar(A.email);
    assert.equal(await prisma.merchant.count({ where: { email: { in: [limpio(A.email), limpio(B.email)] } } }), 0,
      '🔴 los merchants de la ruta siguen ahí: los del guion no nacerían en las mismas condiciones');

    // ── EL GUION ─────────────────────────────────────────────────────────────────────────────
    const gA = await porElGuion(A);
    assert.equal(gA.codigo, 0, `🔴 el guion tiene que dar de alta a A y salió ${gA.codigo}\n${gA.salida}\n${gA.errores}`);
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

    // ── LAS DOS FILAS, CAMPO A CAMPO ─────────────────────────────────────────────────────────
    let porValor = 0;
    for (const cual of ['A', 'B']) {
      const r = ruta[cual].fila; const g = guion[cual].fila;
      assert.deepEqual(Object.keys(g).sort(), Object.keys(r).sort(), `🔴 ${cual}: las dos filas no tienen los mismos campos`);
      const campos = Object.keys(r).filter((k) => !POR_REGLA.includes(k) && !(cual === 'B' && k === 'referredBy'));
      assert.ok(campos.length >= 50, `🔴 CIEGO: sólo ${campos.length} campos que comparar por valor en ${cual}`);
      const distintos = campos.filter((k) => JSON.stringify(r[k]) !== JSON.stringify(g[k]))
        .map((k) => `${k}: ruta=${JSON.stringify(r[k])} guion=${JSON.stringify(g[k])}`);
      assert.deepEqual(distintos, [], `🔴 ${cual}: EL MERCHANT DEL GUION NO NACE IGUAL QUE EL DE LA RUTA`);
      porValor += campos.length;
      for (const [quien, f] of [['ruta', r], ['guion', g]]) {
        const prueba = new Date(f.planExpiresAt) - new Date(f.createdAt);
        assert.ok(Math.abs(prueba - CATORCE_DIAS) < 60_000, `🔴 ${cual} por ${quien}: la prueba dura ${prueba} ms y son 14 días`);
        assert.ok(new Date(f.updatedAt) >= new Date(f.createdAt), `🔴 ${cual} por ${quien}: updatedAt anterior a createdAt`);
      }
      // Y lo que el alta deja ALREDEDOR de la fila: filas colgadas, sesiones y correos.
      assert.deepEqual(guion[cual].cuelga, ruta[cual].cuelga, `🔴 ${cual}: el alta no deja las mismas filas colgadas del merchant`);
      assert.deepEqual(guion[cual].sesiones, ruta[cual].sesiones, `🔴 ${cual}: no quedan las mismas sesiones`);
      assert.deepEqual(guion[cual].cartas, ruta[cual].cartas, `🔴 ${cual}: no salen los mismos correos`);
    }
    // Los positivos de la comparación: que no esté comparando dos vacíos.
    assert.equal(ruta.A.fila.email, limpio(A.email), '🔴 la ruta no guardó el correo limpio');
    assert.equal(ruta.A.fila.name, A.name.trim());
    assert.equal(ruta.A.fila.country, 'ES');
    assert.equal(ruta.A.fila.acquisitionSource, null);
    assert.deepEqual(ruta.A.fila.lifecycleEmailsSent, { welcome: 1 }, '🔴 la bienvenida de la ruta no llegó a anotarse: el buzón de laboratorio no está haciendo su papel');
    assert.equal(ruta.A.cartas.length, 2, `🔴 el alta por la ruta manda 2 correos (bienvenida y enlace) y veo ${ruta.A.cartas.length}`);
    assert.equal(ruta.B.fila.country, 'PT');
    assert.equal(ruta.B.fila.acquisitionSource.length, 200, '🔴 el `source` de la ruta no salió recortado a 200');
    assert.equal(ruta.B.fila.referredBy, idRutaA, '🔴 B por la ruta no quedó referido por A');
    assert.equal(guion.B.fila.referredBy, guion.A.fila.id, '🔴 B por el guion no quedó referido por A');
    assert.ok(ruta.A.cuelga.authSession >= 2, '🔴 A por la ruta debería tener el enlace usado y su sesión');

    // El recién creado ENTRA, por las dos puertas igual.
    assert.deepEqual(entraRutaA, { status: 302, va: '/dashboard/', sesion: true }, '🔴 el merchant de la ruta no puede entrar con su enlace');
    assert.deepEqual(entraGuionA, entraRutaA, '🔴 el merchant del guion no entra como el de la ruta');

    // ── LO QUE EL GUION RECHAZA ──────────────────────────────────────────────────────────────
    const cartasAntes = buzon.cartas.length;
    const repetido = await porElGuion({ name: 'Otro nombre', email: A.email.toUpperCase() });
    assert.equal(repetido.codigo, 3, `🔴 un correo que ya es merchant: el guion tiene que salir 3 y salió ${repetido.codigo}`);
    assert.deepEqual(repetido.dicho, [{ resultado: 'ya_existe', id: guion.A.fila.id }]);
    assert.equal(buzon.cartas.length, cartasAntes, '🔴 el guion le escribió a un merchant que ya existía');
    assert.equal((await foto(A.email)).fila.name, A.name.trim(), '🔴 el guion tocó la fila que ya existía');

    const sinNombre = await porElGuion({ name: '   ', email: `sin-nombre-1515-${sello.toLowerCase()}@test.local` });
    const sinArroba = await porElGuion({ name: 'Con nombre', email: 'sin-arroba' });
    assert.deepEqual([rSinNombre.status, rSinNombre.cuerpo.error, rSinArroba.status, rSinArroba.cuerpo.error], [400, 'name_required', 400, 'invalid_email']);
    assert.deepEqual([sinNombre.codigo, sinNombre.dicho.at(-1)?.error, sinArroba.codigo, sinArroba.dicho.at(-1)?.error], [2, 'name_required', 2, 'invalid_email'],
      '🔴 el guion no rechaza lo mismo que la ruta, con sus mismos códigos');
    const malEscrito = await porElGuion({ nombre: 'Con ene', email: `mal-1515-${sello.toLowerCase()}@test.local` });
    assert.equal(malEscrito.codigo, 2, '🔴 un argumento que no es de los cinco no puede acabar en un alta');

    const operario = await prisma.teamMember.create({ data: { merchantId: guion.A.fila.id, name: 'Operario 1515', email: `operario-1515-${sello.toLowerCase()}@test.local`, role: 'tecnico', status: 'active' } });
    const deOperario = await porElGuion({ name: 'Negocio del operario', email: operario.email });
    assert.equal(deOperario.codigo, 4, `🔴 el correo de un operario: el guion tiene que salir 4 y salió ${deOperario.codigo}\n${deOperario.salida}`);
    assert.equal(await prisma.merchant.count({ where: { email: { in: [operario.email, `sin-nombre-1515-${sello.toLowerCase()}@test.local`, `mal-1515-${sello.toLowerCase()}@test.local`] } } }), 0,
      '🔴 un alta rechazada dejó un merchant');

    t.diagnostic(`SCRUM-1515: 2 merchants por cada puerta · ${porValor} campos comparados por valor (${Object.keys(ruta.A.fila).length} por fila) · por regla: ${POR_REGLA.join(', ')} y referredBy en B · colgadas de A: ${JSON.stringify(ruta.A.cuelga)} · correos de A: ${ruta.A.cartas.length}`);
  } finally {
    console.log = logReal;
    for (const correo of [...creados].reverse()) {
      await borrar(correo).catch((e) => logReal(`⚠️ SCRUM-1515: no se pudo borrar ${correo}: ${e.message}`));
    }
    server.close();
    buzon.servidor.close();
    await prisma.$disconnect();
    fs.rmSync(carpetaVacia, { recursive: true, force: true });
  }
});
