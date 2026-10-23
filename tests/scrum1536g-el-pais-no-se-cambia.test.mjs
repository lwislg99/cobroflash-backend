// tests/scrum1536g-el-pais-no-se-cambia.test.mjs — SCRUM-1536g
//
// Decidido por el fundador (Jira SCRUM-1536 c.20245, opción (a)): el país NO se cambia desde la
// app una vez creada la cuenta. Medido en 1536f (c.20242): `PUT /admin/merchant` guardaba ES→MX,
// ES→ZZ y MX→ES con un 200, y el primero dejaba a un negocio español con `getEmissionMode = fiscal`
// con el flag apagado (regla 24); el último se saltaba la exclusión territorial de 1536d.
//
// Cómo mide, por las puertas reales:
//   · la RUTA `PUT /admin/merchant` de `dist/app.js`, con su sesión y su `requireRole`, contra la
//     base en memoria de SCRUM-1522e: un país distinto da 409 con el texto firmado y no se escribe
//     NADA; el mismo país y un cuerpo sin país se guardan (CONTROL).
//   · la EMISIÓN: `getEmissionMode` de `dist/` con la fila que queda tras el intento, flag apagado.
//   · las PANTALLAS: Empresa y el paso 1 del asistente ya no mandan el país al guardar.
//   · el TEXTO: el de `dist/` contra la ficha firmada de `docs/microcopy/`.
//
// Lo que NO mide: Postgres, ni yaqu.app, ni las pantallas en un navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const DOBLE = path.join(RAIZ, 'tests', '_scrum1522e-doble-de-base.cjs');
const ADMIN = path.join(RAIZ, 'dist', 'modules', 'system', 'merchantAdmin.js');
const FICHA = 'docs/microcopy/2026-10-22-SCRUM-1536-pais-no-se-cambia.md';

/**
 * Las mutaciones que este test tiene que tumbar, con el contrato del meta-guard
 * (`scripts/meta-guard-mutaciones.mjs`): sin el rechazo (el código de antes) y sin su traducción
 * a 409 en la ruta (saldría un 500).
 */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/system/merchantAdmin.ts', de: 'if (actual?.country && actual.country !== data.country) throw new PaisError();', a: '', cae: 'la RUTA: un país distinto' },
  { fichero: 'src/app.ts', de: 'if (err instanceof PaisError) {', a: 'if (false) {', cae: 'la RUTA: un país distinto' },
];

test('SCRUM-1536g · la RUTA: un país distinto del guardado da 409 con el texto firmado y no guarda nada; el mismo país sí se guarda', async () => {
  process.env.SMTP_URL = '';
  process.env.RESEND_API_KEY = '';
  process.env.DISABLE_CRONS = 'true';
  delete process.env.INVOICING_ES_ENABLED;
  // El doble ANTES que cualquier fichero de `dist/`: quien carga antes `prisma.js` se queda con el real.
  const { db } = requiere(DOBLE); // la base en memoria, delante de `dist/`
  const { MSG_PAIS_NO_CAMBIABLE: TEXTO } = requiere(ADMIN);
  // Dos comercios: el 7 nació en España y el 8 en México. Lo que la base tiene guardado de cada uno.
  const guardado = { 7: { id: 7, email: 'g7-1536g@test.local', country: 'ES', flags: {}, taxId: 'B00000000' },
    8: { id: 8, email: 'g8-1536g@test.local', country: 'MX', flags: {}, taxId: 'B00000000' } };
  const escrituras = [];
  db.merchant.findUnique = async (a) => (guardado[a?.where?.id] ? { ...guardado[a.where.id] } : null);
  db.merchant.update = async (a) => { escrituras.push(a); Object.assign(guardado[a.where.id], a.data); return { ...guardado[a.where.id] }; };
  // La sesión: el token `t<id>` es del propietario del comercio <id>. Es lo único que pide `requireAuth`.
  const sesion = { findUnique: async (a) => {
    const id = Number(String(a?.where?.token ?? '').slice(1));
    return { id: 1, type: 'session', token: `t${id}`, merchantId: id, teamMemberId: null, teamMember: null, expiresAt: new Date(Date.now() + 3_600_000),
      merchant: { id, name: 'Reformas 1536g', email: guardado[id].email, plan: 'pro', planExpiresAt: null, onboardingCompleted: true, isPlatformOwner: false } };
  } };
  const fP = requiere.resolve(path.join(RAIZ, 'dist', 'core', 'db', 'prisma.js'));
  requiere.cache[fP].exports.prisma = new Proxy({}, { get: (_t, nombre) => (nombre === 'authSession' ? sesion : db[nombre]) });
  const { app } = requiere(path.join(RAIZ, 'dist', 'app.js'));
  const { getEmissionMode } = requiere(path.join(RAIZ, 'dist', 'modules', 'invoicing', 'domain', 'emission.service.js'));
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const guardar = (id, cuerpo) => new Promise((resolve, reject) => {
    const datos = Buffer.from(JSON.stringify(cuerpo));
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: '/admin/merchant', method: 'PUT', agent: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': datos.length, Cookie: `pf_session=t${id}` } },
    (res) => { let d = ''; res.setEncoding('utf8'); res.on('data', (t) => { d += t; }); res.on('end', () => resolve({ status: res.statusCode, texto: d })); });
    req.on('error', reject);
    req.end(datos);
  });
  try {
    assert.ok(typeof TEXTO === 'string' && TEXTO.length > 20, '🔴 CIEGO: `MSG_PAIS_NO_CAMBIABLE` no está en dist/ (¿falta el build?)');
    assert.equal(getEmissionMode(guardado[7]), 'receipt', '🔴 CIEGO: el comercio español de partida no da «receipt» con el flag apagado');
    // Los tres cambios que 1536f guardó con un 200.
    for (const [id, pais] of [[7, 'MX'], [7, 'ZZ'], [8, 'ES']]) {
      const r = await guardar(id, { name: 'Reformas 1536g', country: pais });
      assert.equal(r.status, 409, `🔴 comercio ${id} → ${pais} tenía que dar 409 y dio ${r.status}: ${r.texto.slice(0, 200)}`);
      assert.deepEqual(JSON.parse(r.texto), { error: 'pais_no_cambiable', message: TEXTO }, '🔴 la ruta no contesta el código y el texto firmado, con dos claves y ninguna más');
    }
    assert.equal(escrituras.length, 0, `🔴 UN CAMBIO DE PAÍS RECHAZADO HA ESCRITO EN EL COMERCIO: ${JSON.stringify(escrituras)}`);
    assert.deepEqual([guardado[7].country, guardado[8].country], ['ES', 'MX'], '🔴 el país guardado se ha movido');
    assert.equal(getEmissionMode(guardado[7]), 'receipt', '🔴 tras el intento, el comercio español ya no da «receipt» con el flag apagado (regla 24)');

    // CONTROL: el mismo país (Empresa lo mandaba en cada guardado) y un cuerpo sin país se guardan.
    const mismo = await guardar(7, { name: 'Reformas 1536g', country: 'ES' });
    assert.equal(mismo.status, 200, `🔴 el MISMO país tenía que guardarse y dio ${mismo.status}: ${mismo.texto.slice(0, 200)}`);
    const sin = await guardar(8, { name: 'Reformas 1536g bis' });
    assert.equal(sin.status, 200, `🔴 un cuerpo sin país tenía que guardarse y dio ${sin.status}: ${sin.texto.slice(0, 200)}`);
    assert.deepEqual(escrituras.map((e) => [e.where.id, e.data.country ?? null, e.data.name]), [[7, 'ES', 'Reformas 1536g'], [8, null, 'Reformas 1536g bis']],
      '🔴 los dos guardados de control no llegaron al update del comercio de la sesión');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('SCRUM-1536g · las PANTALLAS: Empresa y el asistente enseñan el país y no lo mandan al guardar', () => {
  const vista = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'settingsView.js'), 'utf8');
  const payload = vista.match(/const payload = \{[\s\S]*?\n\s*\};/);
  assert.ok(payload, '🔴 CIEGO: no encuentro el `payload` del guardado de Empresa');
  assert.match(payload[0], /googleReviewUrl:/, '🔴 CIEGO: el trozo leído no es el payload de Empresa (no lleva googleReviewUrl)');
  assert.doesNotMatch(payload[0], /\bcountry\s*:/, '🔴 Empresa vuelve a mandar el país al guardar');
  assert.match(vista, /createElement\("output"\);\s*\n\s*fCountryTexto\.name = "country";/, '🔴 el país de Empresa ya no es un `<output>` con su columna declarada');
  assert.doesNotMatch(vista, /createElement\("select"\);\s*\n\s*\w+\.name = "country";/,'🔴 Empresa vuelve a tener un selector de país');

  const asistente = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'onboardingView.js'), 'utf8');
  const llamadas = [...asistente.matchAll(/updateMerchantProfile\(\{[\s\S]*?\}\)/g)].map((m) => m[0]);
  assert.ok(llamadas.some((l) => /\btrade:/.test(l)), `🔴 CIEGO: no veo la llamada del paso 1 (la que guarda el oficio) entre ${llamadas.length}`);
  assert.deepEqual(llamadas.filter((l) => /\bcountry\b/.test(l)), [], '🔴 el asistente vuelve a mandar el país al guardar');
  assert.doesNotMatch(asistente, /<select id="ob-country"/, '🔴 el asistente vuelve a tener un selector de país');
  assert.match(asistente, /<output id="ob-country"/,'🔴 el asistente ya no enseña el país');
});

test('SCRUM-1536g · el texto de `dist/` es, letra a letra, el de la ficha firmada', () => {
  const { MSG_PAIS_NO_CAMBIABLE: TEXTO, MSG_SERIE_YA_EMITIDA } = requiere(ADMIN);
  const ficha = aprobacionesDeMicrocopy().find((a) => a.ruta.replaceAll('\\', '/').endsWith(FICHA));
  assert.ok(ficha, `🔴 CIEGO: no encuentro la ficha ${FICHA} entre las aprobaciones`);
  assert.ok(ficha.aprobada, `🔴 la ficha ${FICHA} no cuenta como aprobada`);
  assert.ok(ficha.literales.includes(TEXTO), `🔴 el texto de dist/ no es literal de la ficha firmada: «${TEXTO}»`);
  // La segunda frase es la ya firmada de la serie: si una de las dos cambia, las dos dejan de decir lo mismo.
  assert.ok(MSG_SERIE_YA_EMITIDA.endsWith(TEXTO.slice(TEXTO.indexOf('Escríbenos'))), '🔴 la segunda frase ya no es la firmada en `MSG_SERIE_YA_EMITIDA`');
  // Control negativo con el mismo lector: la variante sin tilde no consta firmada.
  assert.ok(!ficha.literales.includes(TEXTO.replace('Escríbenos', 'Escribenos')), '🔴 CIEGO: la ficha da por firmada una variante sin tilde');
});
