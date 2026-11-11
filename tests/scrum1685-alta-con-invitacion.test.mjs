// tests/scrum1685-alta-con-invitacion.test.mjs — SCRUM-1685, tramo a
//
// EL ALTA CON INVITACIÓN. Con `REGISTRATION_INVITED_EMAILS` puesta, `POST /auth/register` deja pasar
// SÓLO a esos correos (sin mayúsculas ni espacios que cuenten) hasta `registerMerchant`, que es quien
// exige provincia y domicilio y deja fuera forales y Canarias. A cualquier otro le contesta lo mismo
// que con la ruta cerrada (SCRUM-1515), byte a byte, aunque su cuerpo sea perfecto.
// Sin la variable: `scrum1685-alta-sin-invitados.test.mjs` (y el de SCRUM-1515, intacto).
//
// El caso del no invitado NO necesita base (la puerta lo para antes). Los del invitado, sí: el banco
// desechable de `LIBRO_PG_URL` (receta en docs/RUNBOOKS.md), con un buzón SMTP de laboratorio, así
// que ningún correo sale de la máquina.
import './_staging-db.mjs';
import { URL_BANCO } from './_banco-libro.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';

const ENABLED = URL_BANCO !== '';
const SIN_BANCO = !ENABLED && 'sin LIBRO_PG_URL (banco desechable) · receta en docs/RUNBOOKS.md';

// SUCIA a propósito: mayúsculas, espacios y un hueco entre comas.
process.env.REGISTRATION_INVITED_EMAILS = ' Invitado-A-1685@Test.Local , invitado-b-1685@test.local,, invitado-c-1685@test.local ,INVITADO-D-1685@test.local ';
process.env.DISABLE_CRONS = 'true';
process.env.RESEND_API_KEY = '';
process.env.LOG_MAGIC_LINKS = 'true';
if (!ENABLED) delete process.env.DATABASE_URL;

// Literales firmados, copiados de su fuente firmada (no de la ruta):
//   · SCRUM-1515 c.18971 — la ruta cerrada.
//   · SCRUM-1536 c.20225 (copiados de c.20223 §⑤) — la exclusión territorial.
const FRASE_CERRADA = 'Ahora mismo no estamos aceptando altas nuevas. Si quieres probar YaQu, escríbenos y te damos acceso.';
const CUERPO_CERRADA = JSON.stringify({ error: 'registration_closed', message: FRASE_CERRADA });
const FUERA_POR_DOMICILIO = 'De momento YaQu no está disponible si tienes el domicilio fiscal en el País Vasco, Navarra o Canarias.';
const FUERA_POR_TRABAJO = 'De momento YaQu no está disponible para trabajos en Canarias.';
// El de la cuenta creada es el que la ruta decía antes de SCRUM-1515 (68e33c716^) y que pinta register.html.
const CUENTA_CREADA = 'Cuenta creada. Revisa tu email para acceder.';

const CORREOS = ['invitado-a-1685@test.local', 'invitado-b-1685@test.local', 'invitado-c-1685@test.local', 'invitado-d-1685@test.local', 'intruso-1685@test.local'];

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

const buzon = await buzonDeLaboratorio();
process.env.SMTP_URL = `smtp://127.0.0.1:${buzon.puerto}`;
const enlaces = []; // lo que escribe `logMagicLink`: hace de «abrir el correo»
const logReal = console.log;
console.log = (...a) => {
  for (const m of a.join(' ').matchAll(/\[magic-link\] to=(\S+) link=(\S+)/g)) enlaces.push({ para: m[1].toLowerCase(), enlace: m[2] });
  logReal(...a);
};

const { config, isInvitedEmail } = await import('../dist/core/config/env.js');
const { app } = await import('../dist/app.js');
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const puerto = server.address().port;

function pedir(metodo, ruta, cuerpo) {
  return new Promise((resolve, reject) => {
    const datos = cuerpo === undefined ? null : Buffer.from(JSON.stringify(cuerpo));
    const req = http.request({ host: '127.0.0.1', port: puerto, path: ruta, method: metodo, agent: false,
      headers: datos ? { 'Content-Type': 'application/json', 'Content-Length': datos.length } : {} },
    (res) => { let d = ''; res.setEncoding('utf8'); res.on('data', (t) => { d += t; }); res.on('end', () => resolve({ status: res.statusCode, cabeceras: res.headers, texto: d })); });
    req.on('error', reject);
    req.end(datos || undefined);
  });
}
const alta = (cuerpo) => pedir('POST', '/auth/register', cuerpo);

let prisma = null;
async function limpiar() {
  if (!prisma) return;
  const { limpiarMerchant } = await import('./_merchant-fixture.mjs');
  const filas = await prisma.merchant.findMany({ where: { email: { in: CORREOS } }, select: { id: true } });
  for (const f of filas) await limpiarMerchant(prisma, f.id);
}
if (ENABLED) {
  ({ prisma } = await import('../dist/core/db/prisma.js'));
  await limpiar(); // restos de una pasada anterior que cayera a medias
}
const merchantsDe = (correo) => prisma.merchant.count({ where: { email: correo } });
const cartasDe = (correo) => buzon.cartas.filter((c) => c.para === correo);

test.after(async () => {
  console.log = logReal;
  try { await limpiar(); } finally {
    server.close();
    buzon.servidor.close();
    if (prisma) await prisma.$disconnect();
  }
});

test('SCRUM-1685 · la lista de invitados se lee normalizada (sin mayúsculas, sin espacios, sin huecos)', () => {
  assert.deepEqual(config.REGISTRATION_INVITED_EMAILS,
    ['invitado-a-1685@test.local', 'invitado-b-1685@test.local', 'invitado-c-1685@test.local', 'invitado-d-1685@test.local']);
  assert.equal(isInvitedEmail('  INVITADO-A-1685@test.LOCAL '), true);
  assert.equal(isInvitedEmail('intruso-1685@test.local'), false);
  assert.equal(isInvitedEmail(''), false);
  assert.equal(isInvitedEmail(undefined), false);
  // Un trozo de un correo invitado no es un correo invitado.
  assert.equal(isInvitedEmail('invitado-a-1685@test.loca'), false);
});

test('SCRUM-1685 · con lista, el NO invitado recibe la ruta cerrada byte a byte, aunque su cuerpo sea perfecto', async () => {
  const perfecto = { name: 'Intruso 1685', email: 'intruso-1685@test.local', country: 'ES', provincia: 'Madrid',
    'domicilio-foral': 'no', 'domicilio-canarias': 'no' };
  for (let i = 0; i < 8; i++) {
    const r = await alta(perfecto);
    assert.equal(r.status, 409, `🔴 el no invitado tiene que recibir 409 y recibió ${r.status} ${r.texto.slice(0, 120)}`);
    assert.equal(r.texto, CUERPO_CERRADA, `🔴 a la ${i + 1}.ª vez el no invitado no recibe la frase cerrada byte a byte`);
  }
  for (const cuerpo of [{}, { email: 'x@y.es' }, { name: 'sin arroba', email: 'nada' }]) {
    assert.equal((await alta(cuerpo)).texto, CUERPO_CERRADA, `🔴 la ruta contesta distinto según el cuerpo: ${JSON.stringify(cuerpo)}`);
  }
  assert.equal(buzon.cartas.length, 0, '🔴 a un no invitado se le ha mandado un correo');
  assert.equal(enlaces.length, 0, '🔴 a un no invitado se le ha generado un enlace de acceso');
  if (ENABLED) assert.equal(await merchantsDe('intruso-1685@test.local'), 0, '🔴 EL NO INVITADO TIENE CUENTA');
});

test('SCRUM-1685 · el invitado PASA la puerta y llega hasta donde el servicio exige la provincia', { skip: SIN_BANCO }, async () => {
  // El correo, sucio: la puerta lo normaliza igual que la lista.
  const r = await alta({ name: '  Invitado A 1685 ', email: '  INVITADO-A-1685@test.LOCAL ', 'domicilio-foral': 'no', 'domicilio-canarias': 'no' });
  assert.notEqual(r.texto, CUERPO_CERRADA, '🔴 el invitado se ha quedado en la puerta: recibe la ruta cerrada');
  assert.equal(r.status, 400, `🔴 sin provincia el invitado tiene que recibir 400 y recibió ${r.status} ${r.texto}`);
  assert.equal(JSON.parse(r.texto).error, 'provincia_required');
  assert.equal(await merchantsDe('invitado-a-1685@test.local'), 0, '🔴 sin provincia se ha creado la cuenta');
  assert.equal(cartasDe('invitado-a-1685@test.local').length, 0, '🔴 sin provincia se ha mandado un correo');
});

test('SCRUM-1685 · invitado con domicilio foral o en Canarias → exclusión con el texto FIRMADO, sin crear nada', { skip: SIN_BANCO }, async () => {
  const foral = await alta({ name: 'Invitado B 1685', email: 'invitado-b-1685@test.local', provincia: 'Burgos',
    'domicilio-foral': 'sí', 'domicilio-canarias': 'no' });
  assert.equal(foral.status, 409, `🔴 foral: ${foral.status} ${foral.texto}`);
  assert.deepEqual(JSON.parse(foral.texto), { error: 'territorio_excluido', message: FUERA_POR_DOMICILIO });

  const canarias = await alta({ name: 'Invitado C 1685', email: 'invitado-c-1685@test.local', provincia: 'Las Palmas',
    'domicilio-foral': 'no', 'domicilio-canarias': 'no' });
  assert.equal(canarias.status, 409, `🔴 Canarias: ${canarias.status} ${canarias.texto}`);
  assert.deepEqual(JSON.parse(canarias.texto), { error: 'territorio_excluido', message: FUERA_POR_TRABAJO });

  for (const correo of ['invitado-b-1685@test.local', 'invitado-c-1685@test.local']) {
    assert.equal(await merchantsDe(correo), 0, `🔴 ${correo} excluido y con cuenta`);
    assert.equal(cartasDe(correo).length, 0, `🔴 ${correo} excluido y con correo`);
  }
});

test('SCRUM-1685 · invitado con provincia normal → cuenta creada, bienvenida + enlace, y el enlace le abre el panel', { skip: SIN_BANCO }, async () => {
  const correo = 'invitado-d-1685@test.local';
  const r = await alta({ name: ' Reformas D 1685 ', email: ' Invitado-D-1685@TEST.local ', provincia: '  madrid ',
    'domicilio-foral': ' No ', 'domicilio-canarias': 'no' });
  assert.equal(r.status, 200, `🔴 el invitado bueno tiene que entrar y recibió ${r.status} ${r.texto}`);
  assert.deepEqual(JSON.parse(r.texto), { ok: true, message: CUENTA_CREADA });

  const fila = await prisma.merchant.findUnique({ where: { email: correo } });
  assert.ok(fila, '🔴 la ruta dijo «creada» y no hay fila');
  assert.equal(fila.name, 'Reformas D 1685');
  assert.equal(fila.country, 'ES');
  assert.equal(fila.timezone, 'Europe/Madrid', '🔴 la cuenta nace sin la zona de su provincia');
  assert.equal(fila.domicilioFiscalForal, false, '🔴 la respuesta «no» del domicilio no se ha guardado');
  assert.equal(fila.plan, 'trial');

  // El correo de bienvenida no lleva `await` en el servicio: se le da un momento para salir.
  for (let i = 0; i < 50 && cartasDe(correo).length < 2; i++) await new Promise((res) => setTimeout(res, 100));
  const asuntos = cartasDe(correo).map((c) => c.asunto).sort();
  assert.equal(asuntos.length, 2, `🔴 tenían que salir 2 correos (bienvenida + enlace) y salieron ${asuntos.length}: ${asuntos.join(' | ')}`);
  assert.ok(asuntos.includes('Tu enlace de acceso a YaQu'), `🔴 no sale el enlace de acceso: ${asuntos.join(' | ')}`);

  const carta = enlaces.filter((e) => e.para === correo).pop();
  assert.ok(carta, '🔴 no se ha generado enlace de acceso para el invitado');
  const u = new URL(carta.enlace);
  const visita = await pedir('GET', u.pathname + u.search);
  assert.equal(visita.status, 302, `🔴 el enlace no redirige: ${visita.status}`);
  assert.equal(visita.cabeceras.location, '/dashboard/', '🔴 el enlace no lleva al panel');
  assert.ok(String(visita.cabeceras['set-cookie'] || '').includes('pf_session='), '🔴 el enlace no deja sesión');

  // Un segundo alta con el mismo correo no crea otra cuenta.
  const otra = await alta({ name: 'Otra', email: correo, provincia: 'Madrid', 'domicilio-foral': 'no', 'domicilio-canarias': 'no' });
  assert.equal(otra.status, 200);
  assert.equal(await merchantsDe(correo), 1, '🔴 el mismo invitado ha creado DOS cuentas');
});
