// SCRUM-1558b · EN PRODUCCIÓN, LA FALTA DE CORREO NO ESCRIBE EL ENLACE DE ACCESO EN EL LOG.
//
// `logMagicLink` (`auth.service.ts`) escribía el enlace de acceso (token de 15 min) en el log si no
// había ni Resend ni SMTP. Es la misma condición que en SCRUM-1558a convertía un `.eml` en
// «enviado»: en producción, con la variable de Resend vacía, la credencial acababa en el log de
// Railway justo cuando no había forma de mandarla. Se queda el interruptor explícito
// `LOG_MAGIC_LINKS=true`, que alguien tiene que poner a propósito (lo usa `scrum1515`).
//
// ⚠️ Esta rama NO entra en `main` hasta que se mida el `NODE_ENV` de staging o se ponga allí
// `LOG_MAGIC_LINKS=true`: si staging corre como producción y sin Resend, el log puede ser la única
// forma de entrar. Decidido por el orquestador el 16-oct-2026 (`docs/master/SCRUM-1558.md`).
//
// Se dobla la base. NO se dobla lo que se mide: `requestMagicLink` y `logMagicLink` son dist/ tal cual.
// ⛔ Ni una clave real. Ni un byte de red.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';

// ANTES de cargar dist/: `config` lee el entorno al importarse. Los casos lo cambian sobre el
// MISMO objeto `config`, como en `scrum1299`.
process.env.RESEND_API_KEY = '';
process.env.SMTP_URL = '';
delete process.env.LOG_MAGIC_LINKS;

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const MERCHANT = 4559;
const doble = dobleDeLaBase({
  'merchant.findUnique': () => ({ id: MERCHANT, name: 'Taller', email: 'pro@ejemplo.invalid' }),
  'authSession.create': (a) => ({ id: 1, ...a.data }),
  'emailMessage.create': (a) => ({ id: 1, ...a.data }),
});
const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };

const { config } = requiere(path.join(RAIZ, 'dist/core/config/env.js'));
const { requestMagicLink } = requiere(path.join(RAIZ, 'dist/modules/auth/domain/auth.service.js'));

function reiniciar(entorno) {
  config.NODE_ENV = entorno;
  config.RESEND_API_KEY = '';
  config.SMTP_URL = '';
}

/** Lo que `requestMagicLink` escribe con `console.log`, con la consola callada. */
async function lineasDelEnlace() {
  const escritas = [];
  const [log, error] = [console.log, console.error];
  console.log = (...a) => { escritas.push(a.join(' ')); };
  console.error = () => {};
  try { await requestMagicLink('pro@ejemplo.invalid'); } finally { [console.log, console.error] = [log, error]; }
  return escritas.filter((l) => /auth\/verify\?token=/.test(l));
}

test('SCRUM-1558b · SUELO: fuera de producción sin correo, el enlace SÍ va al log (es la forma de entrar)', async () => {
  reiniciar('development');
  const lineas = await lineasDelEnlace();
  assert.equal(lineas.length, 1, '🔴 CIEGO: fuera de producción el enlace no sale en el log; el caso de producción no mide nada.');
});

test('SCRUM-1558b · 🔴 en producción sin correo, el enlace de acceso NO va al log', async () => {
  reiniciar('production');
  const lineas = await lineasDelEnlace();
  assert.deepEqual(lineas, [], `🔴 en producción, sin proveedor, el enlace de acceso se ha escrito en el log: ${lineas.length} línea(s).`);
});

test('SCRUM-1558b · CONTROL: en producción, LOG_MAGIC_LINKS=true explícito sigue mandando', async () => {
  reiniciar('production');
  process.env.LOG_MAGIC_LINKS = 'true';
  try {
    assert.equal((await lineasDelEnlace()).length, 1, '🔴 el interruptor explícito ha dejado de funcionar.');
  } finally {
    delete process.env.LOG_MAGIC_LINKS;
  }
});
