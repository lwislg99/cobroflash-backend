// tests/scrum1685-ruta-y-guion-campo-a-campo.test.mjs — SCRUM-1685, aceptación ② («1685-② campo a campo»)
//
// UN INVITADO QUE SE DA DE ALTA POR LA RUTA NACE IGUAL QUE UNO DADO DE ALTA CON NUESTRO GUION.
// `POST /auth/register` (con `REGISTRATION_INVITED_EMAILS`) y `altaDeMerchant` (el guion de SCRUM-1515)
// son las dos puertas de `registerMerchant`, y cada una limpia los campos con su propia copia
// (`altaDelInvitado` / `camposDeAlta`). Si una de las dos copias se aparta, el piloto nace con una
// cuenta distinta según por dónde entre, y ningún otro test lo ve: cada uno mira su puerta.
//
// Se manda EL MISMO cuerpo, sucio a propósito (espacios, mayúsculas, un `source` de 230, un `ref`
// con espacios), a las dos puertas, y se comparan las dos filas de `Merchant` campo a campo, sin
// lo que por regla no puede coincidir (id, correo, fechas, código de referido). También las filas
// que cuelgan del merchant, sus sesiones y los correos que salen.
//
// Patrón: `porLaRuta` / `porElGuion` de `tests/scrum1515-nuestra-puerta-de-alta.test.mjs`.
// ⚠️ GATEADO: crea y BORRA merchants. Sólo en el banco desechable de `LIBRO_PG_URL` (loopback y base
// `_test`; receta en docs/RUNBOOKS.md), con un buzón SMTP de laboratorio: ningún correo sale de aquí.
import './_staging-db.mjs';
import { URL_BANCO } from './_banco-libro.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ENABLED = URL_BANCO !== '';
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUION = path.join(RAIZ, 'dist', 'modules', 'auth', 'app', 'cli', 'altaDeMerchant.js');

const sello = Date.now().toString(36).toUpperCase().slice(-6);
const CORREO_RUTA = `ruta-1685c-${sello.toLowerCase()}@test.local`;
const CORREO_GUION = `guion-1685c-${sello.toLowerCase()}@test.local`;
const CORREO_PADRINO = `padrino-1685c-${sello.toLowerCase()}@test.local`;
const CORREOS = [CORREO_RUTA, CORREO_GUION, CORREO_PADRINO];

// Sólo la ruta mira la lista: el guion no pasa por la puerta.
process.env.REGISTRATION_INVITED_EMAILS = CORREO_RUTA;
process.env.DISABLE_CRONS = 'true';
process.env.RESEND_API_KEY = '';
process.env.LOG_MAGIC_LINKS = 'true';
if (!ENABLED) delete process.env.DATABASE_URL;

// Lo que por regla NO puede ser igual entre dos merchants distintos.
const POR_REGLA = ['id', 'email', 'createdAt', 'updatedAt', 'planExpiresAt', 'referralCode'];

/** El buzón de laboratorio: acepta todo y apunta a quién iba cada correo y su asunto. */
function buzonDeLaboratorio() {
  const cartas = [];
  const servidor = net.createServer((s) => {
    let resto = ''; let enDatos = false; let para = [];
    s.write('220 laboratorio ESMTP\r\n');
    s.on('error', () => {});
    s.on('data', (trozo) => {
      resto += trozo.toString('latin1');
      for (;;) {
        if (enDatos) {
          const fin = resto.indexOf('\r\n.\r\n');
          if (fin === -1) return;
          const cuerpo = resto.slice(0, fin); resto = resto.slice(fin + 5); enDatos = false;
          const asunto = (cuerpo.match(/^Subject: (.*(?:\r\n[ \t].*)*)/mi) || [])[1] || '';
          for (const p of para) cartas.push({ para: p.toLowerCase(), asunto: asunto.replace(/\r\n[ \t]/g, ' ') });
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

test('SCRUM-1685 ② · el invitado que entra por POST /auth/register nace igual, campo a campo, que el que da de alta el guion', { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable) · receta en docs/RUNBOOKS.md' }, async () => {
  assert.ok(fs.existsSync(GUION), `🔴 CIEGO: no existe ${path.relative(RAIZ, GUION)} (¿falta el build?)`);

  const buzon = await buzonDeLaboratorio();
  process.env.SMTP_URL = `smtp://127.0.0.1:${buzon.puerto}`;

  const { prisma } = await import('../dist/core/db/prisma.js');
  const { Prisma } = await import('@prisma/client');
  const { limpiarMerchant } = await import('./_merchant-fixture.mjs');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));

  // SCRUM-560: `node:http` SIN pool de conexiones, no `fetch` sobre el propio servidor.
  const pedir = (metodo, ruta, cuerpo) => new Promise((resolve, reject) => {
    const datos = cuerpo === undefined ? null : Buffer.from(JSON.stringify(cuerpo));
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: ruta, method: metodo, agent: false,
      headers: datos ? { 'Content-Type': 'application/json', 'Content-Length': datos.length } : {} },
    (res) => { let d = ''; res.setEncoding('utf8'); res.on('data', (t) => { d += t; }); res.on('end', () => resolve({ status: res.statusCode, texto: d })); });
    req.on('error', reject);
    req.end(datos || undefined);
  });

  const limpiar = async () => {
    const filas = await prisma.merchant.findMany({ where: { email: { in: CORREOS } }, select: { id: true } });
    for (const f of filas) await limpiarMerchant(prisma, f.id);
  };

  // El guion, como lo lanzaría una persona: otro proceso, con SU entorno escrito a mano y desde una
  // carpeta vacía, para que no encuentre ningún `.env`.
  const carpetaVacia = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1685c-'));
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
    const codigo = await new Promise((ok) => hijo.on('close', (c, senal) => ok(senal ? `matado (${senal})` : c)));
    clearTimeout(reloj);
    const dicho = salida.split(/\r?\n/).filter((l) => l.startsWith('{"resultado"')).map((l) => JSON.parse(l));
    return { codigo, dicho, salida, errores };
  };
  // Lo que hace el formulario de `public/register.html`: POST con el cuerpo en JSON.
  const porLaRuta = async (campos) => {
    const r = await pedir('POST', '/auth/register', campos);
    return { status: r.status, cuerpo: JSON.parse(r.texto) };
  };

  const colgadas = Prisma.dmmf.datamodel.models
    .filter((m) => m.name !== 'Merchant' && m.fields.some((f) => f.name === 'merchantId' && f.kind === 'scalar'))
    .map((m) => m.name[0].toLowerCase() + m.name.slice(1));
  assert.ok(colgadas.length >= 10 && colgadas.includes('authSession'), `🔴 CIEGO: sólo veo ${colgadas.length} tablas con merchantId`);

  const cartasDe = (correo) => buzon.cartas.filter((c) => c.para === correo).map((c) => c.asunto).sort();
  const foto = async (correo) => {
    const fila = await prisma.merchant.findUnique({ where: { email: correo } });
    assert.ok(fila, `🔴 no hay merchant con el correo ${correo}: el alta no dejó fila`);
    const cuelga = {};
    for (const tabla of colgadas) {
      const n = await prisma[tabla].count({ where: { merchantId: fila.id } });
      if (n) cuelga[tabla] = n;
    }
    const sesiones = (await prisma.authSession.findMany({ where: { merchantId: fila.id }, orderBy: { id: 'asc' } }))
      .map((s) => ({ type: s.type, usada: s.usedAt !== null, teamMemberId: s.teamMemberId }));
    return { fila: JSON.parse(JSON.stringify(fila)), cuelga, sesiones, cartas: cartasDe(correo) };
  };
  // La bienvenida sale sin `await` en el servicio: se espera a las dos cartas y a que quede anotada.
  const esperarAlta = async (correo) => {
    for (let i = 0; i < 80; i++) {
      const f = await prisma.merchant.findUnique({ where: { email: correo }, select: { lifecycleEmailsSent: true } });
      if (cartasDe(correo).length >= 2 && f?.lifecycleEmailsSent?.welcome) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  };

  try {
    await limpiar();

    // El padrino, para que las dos altas lleven un `ref` de verdad y `referredBy` no sea NULL en ambas.
    const padrino = await porElGuion({ name: `Padrino ${sello}`, email: CORREO_PADRINO, provincia: 'Madrid', 'domicilio-foral': 'no', 'domicilio-canarias': 'no' });
    assert.equal(padrino.codigo, 0, `🔴 el guion no dio de alta al padrino\n${padrino.salida}\n${padrino.errores}`);
    const filaPadrino = await prisma.merchant.findUnique({ where: { email: CORREO_PADRINO } });
    const codigoPadrino = filaPadrino.referralCode;
    assert.ok(codigoPadrino, '🔴 CIEGO: el padrino nace sin código de referido');

    // EL MISMO cuerpo para las dos puertas; sólo cambia el correo. Sucio a propósito.
    const cuerpo = (correo) => ({
      name: `  ${sello} Reformas Ñandú  `,
      email: `  ${correo.toUpperCase()} `,
      country: ' ES ',
      ref: `  ${codigoPadrino} `,
      source: `  ${'origen/medio/campaña-'.repeat(11)}  `,
      provincia: '  madrid ',
      'domicilio-foral': ' No ',
      'domicilio-canarias': 'no',
    });

    const r = await porLaRuta(cuerpo(CORREO_RUTA));
    assert.equal(r.status, 200, `🔴 la ruta no dio de alta al invitado: ${r.status} ${JSON.stringify(r.cuerpo)}`);
    assert.equal(r.cuerpo.ok, true);
    await esperarAlta(CORREO_RUTA);

    const g = await porElGuion(cuerpo(CORREO_GUION));
    assert.equal(g.codigo, 0, `🔴 el guion no dio de alta: ${g.codigo}\n${g.salida}\n${g.errores}`);
    assert.equal(g.dicho.at(-1)?.resultado, 'creado', `🔴 el guion salió 0 sin DECIR qué creó\n${g.salida}`);
    await esperarAlta(CORREO_GUION);

    const ruta = await foto(CORREO_RUTA);
    const guion = await foto(CORREO_GUION);

    // CONTROLES: lo sucio del cuerpo de verdad llegó y se limpió (si no, la igualdad no diría nada).
    assert.equal(ruta.fila.name, `${sello} Reformas Ñandú`, '🔴 CIEGO: el nombre de la ruta no llegó limpio');
    assert.equal(ruta.fila.referredBy, filaPadrino.id,'🔴 CIEGO: la ruta no apuntó el padrino: la comparación de `referredBy` no diría nada');
    assert.equal(ruta.fila.acquisitionSource?.length, 200, '🔴 CIEGO: el `source` de 230 no llegó recortado a 200');
    assert.equal(ruta.fila.domicilioFiscalForal, false, '🔴 CIEGO: la respuesta «no» del domicilio no está en la fila');

    // ── LA FILA, CAMPO A CAMPO ─────────────────────────────────────────────────────────────────
    const solo = (a, b) => Object.keys(a).filter((k) => !(k in b));
    assert.deepEqual([solo(ruta.fila, guion.fila), solo(guion.fila, ruta.fila)], [[], []], '🔴 las dos filas no tienen los mismos campos');
    const campos = Object.keys(ruta.fila).filter((k) => !POR_REGLA.includes(k));
    assert.ok(campos.length >= 50, `🔴 CIEGO: sólo ${campos.length} campos que comparar`);
    const distintos = campos.filter((k) => JSON.stringify(ruta.fila[k]) !== JSON.stringify(guion.fila[k]))
      .map((k) => `${k}: ruta=${JSON.stringify(ruta.fila[k])} guion=${JSON.stringify(guion.fila[k])}`);
    assert.deepEqual(distintos, [], '🔴 EL INVITADO DE LA RUTA NO NACE IGUAL QUE EL DEL GUION');

    // Lo que no puede coincidir por valor, por su forma.
    for (const [cual, f] of [['ruta', ruta.fila], ['guion', guion.fila]]) {
      const prueba = new Date(f.planExpiresAt) - new Date(f.createdAt);
      assert.ok(Math.abs(prueba - 14 * 24 * 3600 * 1000) < 60_000, `🔴 ${cual}: la prueba dura ${prueba} ms y son 14 días`);
    }
    // El código sale del nombre; como los dos llevan el MISMO nombre, el segundo (el guion) choca y
    // lleva un sufijo detrás: tiene que EMPEZAR por el del primero.
    assert.ok(/^[0-9A-Z]{8}\d\d$/.test(ruta.fila.referralCode), `🔴 ruta: el código de referido no tiene su forma: ${ruta.fila.referralCode}`);
    assert.ok(guion.fila.referralCode.startsWith(ruta.fila.referralCode) && guion.fila.referralCode !== ruta.fila.referralCode,
      `🔴 el código de referido no sale del nombre igual por las dos puertas: ruta=${ruta.fila.referralCode} guion=${guion.fila.referralCode}`);

    // ── LO QUE CUELGA, LAS SESIONES Y LOS CORREOS ──────────────────────────────────────────────
    assert.deepEqual(guion.cuelga, ruta.cuelga, '🔴 las dos altas no dejan las mismas filas colgadas del merchant');
    assert.deepEqual(guion.sesiones, ruta.sesiones, '🔴 las dos altas no dejan las mismas sesiones');
    assert.deepEqual(guion.cartas, ruta.cartas, '🔴 las dos altas no mandan los mismos correos');
    assert.equal(ruta.cartas.length, 2, `🔴 CIEGO: tenían que salir 2 correos (bienvenida + enlace) y salieron ${ruta.cartas.length}`);
  } finally {
    try { await limpiar(); } finally {
      server.close();
      buzon.servidor.close();
      await prisma.$disconnect();
      fs.rmSync(carpetaVacia, { recursive: true, force: true });
    }
  }
});
