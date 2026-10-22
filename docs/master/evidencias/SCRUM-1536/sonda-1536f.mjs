// docs/master/evidencias/SCRUM-1536/sonda-1536f.mjs — SCRUM-1536f (B′ del diseño 1536c)
//
// Pregunta: si un comercio cambia el PAÍS en Ajustes, ¿se guarda?, ¿y qué cambia después
// (flag INVOICING_ES_ENABLED, getEmissionMode, moneda, idioma, la exclusión de 1536d)?
//
// Cómo mide, EJECUTANDO por las puertas reales de un `dist/` compilado:
//   · el ALTA: `registerMerchant` de `dist/` (la consola `altaDeMerchant` lo llama; la consola está
//     leída, no lanzada), contra la base en memoria de SCRUM-1522e (`tests/_scrum1522e-doble-de-base.cjs`).
//   · el CAMBIO DE PAÍS: la RUTA `PUT /admin/merchant` de `dist/app.js`, con su `requireAuth` y su
//     `requireRole`, por HTTP. Es la que llaman Empresa (`settingsView.js`) y el paso 1 del asistente
//     (`onboardingView.js`).
//   · lo que cambia DESPUÉS: las funciones de `dist/` que leen `country`, llamadas con la fila que
//     quedó guardada en la base en memoria.
//
// Uso:  node sonda-1536f.mjs <raíz con dist/ y tests/_scrum1522e-doble-de-base.cjs> <etiqueta>
// Se corre DOS veces: sobre `main` y sobre una copia de la rama de 1536d (la exclusión).
//
// Lo que NO mide: Postgres (lo que la columna acepta lo midió SCRUM-1102), yaqu.app, ni la emisión
// de una factura de verdad (pide base): de la emisión sólo se llaman sus puertas puras.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(process.argv[2] || '.');
const ETIQUETA = process.argv[3] || '(sin etiqueta)';
const requiere = createRequire(path.join(RAIZ, 'sonda.cjs'));
const desde = (rel) => requiere(path.join(RAIZ, rel));

for (const k of ['SMTP_URL', 'RESEND_API_KEY']) process.env[k] = '';
process.env.DISABLE_CRONS = 'true';
delete process.env.INVOICING_ES_ENABLED;

const faltan = ['dist/app.js', 'dist/modules/auth/domain/auth.service.js', 'tests/_scrum1522e-doble-de-base.cjs']
  .filter((f) => !fs.existsSync(path.join(RAIZ, f)));
if (faltan.length) { console.log(`CIEGO · ${ETIQUETA} · faltan: ${faltan.join(', ')}`); process.exit(2); }

const { db, filas } = desde('tests/_scrum1522e-doble-de-base.cjs');
// El doble numera desde 1, y el id 1 es el comercio DEMO (regla 8): `getEmissionMode` le da «demo»
// sea cual sea su país. La segunda pasada de esta sonda midió eso y no lo que pregunta. Una fila de
// relleno ocupa el 1 y los comercios de la sonda nacen del 2 en adelante (se comprueba abajo).
filas.push({ id: 1, email: 'relleno-del-id-1@test.local', name: 'relleno' });
const { registerMerchant } = desde('dist/modules/auth/domain/auth.service.js');
const { getEmissionMode } = desde('dist/modules/invoicing/domain/emission.service.js');
const { isFlagEnabled } = desde('dist/core/flags.js');
const { getLocale } = desde('dist/core/i18n/locales.js');
const { modoDocumentoSuelto } = desde('dist/modules/invoicing/domain/facturaSuelta.js');
const { debeEstarEnLaCadena } = desde('dist/modules/invoicing/domain/portonDocumento.js');
const { estadoAlNacer } = desde('dist/modules/invoicing/domain/selladoEstado.js');
const territorio = fs.existsSync(path.join(RAIZ, 'dist/modules/auth/domain/territorioDeAlta.js'));

// La sesión: lo único que `requireAuth` le pide a la base. Token `t<id>` → comercio <id>, propietario.
const sesion = {
  findUnique: async (a) => {
    const id = Number(String(a?.where?.token ?? '').slice(1));
    const fila = filas.find((f) => f.id === id);
    if (!fila) return null;
    return { id: 1, type: 'session', token: `t${id}`, merchantId: id, teamMember: null, teamMemberId: null,
      expiresAt: new Date(Date.now() + 3_600_000),
      merchant: { id, name: fila.name, email: fila.email, plan: 'pro', planExpiresAt: null, onboardingCompleted: true, isPlatformOwner: false } };
  },
};
const fP = requiere.resolve(path.join(RAIZ, 'dist', 'core', 'db', 'prisma.js'));
// Sólo se pone delante `findUnique`: el alta usa `authSession.create` para su enlace de acceso, y
// tapar la tabla entera la tumbaba (primera pasada de esta sonda, CIEGA por eso).
const sesiones = new Proxy({}, { get: (_t, metodo) => (metodo === 'findUnique' ? sesion.findUnique : db.authSession[metodo]) });
requiere.cache[fP].exports.prisma = new Proxy({}, { get: (_t, n) => (n === 'authSession' ? sesiones : db[n]) });
const { app } = desde('dist/app.js');
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));

const guardar = (id, cuerpo) => new Promise((resolve, reject) => {
  const datos = Buffer.from(JSON.stringify(cuerpo));
  const rq = http.request({ host: '127.0.0.1', port: server.address().port, path: '/admin/merchant', method: 'PUT', agent: false,
    headers: { 'Content-Type': 'application/json', 'Content-Length': datos.length, Cookie: `pf_session=t${id}` } },
  (res) => { let d = ''; res.setEncoding('utf8'); res.on('data', (t) => { d += t; }); res.on('end', () => resolve({ status: res.statusCode, cuerpo: d.slice(0, 160) })); });
  rq.on('error', reject);
  rq.end(datos);
});

async function alta(nombre, params) {
  const antes = filas.length;
  try {
    await registerMerchant({ name: nombre, email: `${nombre.toLowerCase().replace(/\W+/g, '-')}@test.local`, ...params });
  } catch (e) {
    return { creado: false, error: e.code || e.message };
  }
  if (filas.length !== antes + 1) return { creado: false, error: `filas ${antes} → ${filas.length}` };
  const id = filas.at(-1).id;
  if (id === 1) { console.log(`CIEGO · ${ETIQUETA} · un comercio de la sonda nació con el id del DEMO`); process.exit(2); }
  return { creado: true, id };
}

const conFlag = (valor, fn) => {
  if (valor === undefined) delete process.env.INVOICING_ES_ENABLED;
  else process.env.INVOICING_ES_ENABLED = valor;
  try { return fn(); } finally { delete process.env.INVOICING_ES_ENABLED; }
};

/** Lo que leen de `country` las puertas de documento y de cobro, con la fila tal como quedó. */
function despues(id) {
  const f = { ...filas.find((x) => x.id === id) };
  const m = { id: f.id, email: f.email, country: f.country, flags: f.flags ?? {}, taxId: 'B00000000' };
  const loc = getLocale(f.country);
  return {
    country: f.country,
    timezone: f.timezone === undefined ? null : f.timezone,
    defaultCurrency: f.defaultCurrency ?? '(sin escribir; la pone la base)',
    domicilioFiscalForal: f.domicilioFiscalForal === undefined ? '(sin escribir)' : f.domicilioFiscalForal,
    'getEmissionMode · flag sin poner': conFlag(undefined, () => getEmissionMode(m)),
    'getEmissionMode · flag=false': conFlag('false', () => getEmissionMode(m)),
    'getEmissionMode · flag=true': conFlag('true', () => getEmissionMode(m)),
    'getEmissionMode · flag=false y override del comercio false': conFlag('false', () => getEmissionMode({ ...m, flags: { INVOICING_ES_ENABLED: false } })),
    'isFlagEnabled(INVOICING_ES_ENABLED) · flag=true': conFlag('true', () => isFlagEnabled('INVOICING_ES_ENABLED', { merchant: m })),
    'modoDocumentoSuelto · flag=false': conFlag('false', () => modoDocumentoSuelto(m)),
    'debeEstarEnLaCadena(2026-A-0001) (con NIF)': debeEstarEnLaCadena('2026-A-0001', m),
    'estadoAlNacer(2026-A-0001) (con NIF)': estadoAlNacer('2026-A-0001', m),
    'locale · moneda / impuesto / documento': `${loc.currency} / ${loc.vatName} ${loc.defaultVat} / ${loc.quote}`,
  };
}

const salida = { etiqueta: ETIQUETA, raiz: RAIZ, exclusion1536d: territorio, pasos: [] };
const paso = (nombre, dato) => { salida.pasos.push({ paso: nombre, ...dato }); };
const NO_NO = { domicilio: { foral: false, canarias: false } };

try {
  // ① Un comercio de España (Madrid, «no»/«no») que se pasa a México en Ajustes.
  const a = await alta('Reformas Madrid 1536f', { country: 'ES', provincia: 'Madrid', ...NO_NO });
  paso('① alta ES Madrid', a);
  if (a.creado) {
    paso('① estado tras el alta', despues(a.id));
    paso('① PUT country=MX', await guardar(a.id, { name: 'Reformas Madrid 1536f', country: 'MX' }));
    paso('① estado tras pasar a MX', despues(a.id));
    paso('① PUT country=MX + domicilioFiscalForal=true', await guardar(a.id, { country: 'MX', domicilioFiscalForal: true }));
    paso('① PUT country=ZZ (no está en la lista de la pantalla)', await guardar(a.id, { country: 'ZZ' }));
    paso('① estado tras ZZ', despues(a.id));
    paso('① PUT country=ES (vuelta)', await guardar(a.id, { country: 'ES' }));
    paso('① estado tras volver a ES', despues(a.id));
  }
  // ② Un comercio que nace en México (no se le pregunta el domicilio) y se pasa a España.
  const b = await alta('Reformas Mexico 1536f', { country: 'MX' });
  paso('② alta MX', b);
  if (b.creado) {
    paso('② PUT country=ES', await guardar(b.id, { name: 'Reformas Mexico 1536f', country: 'ES' }));
    paso('② estado tras pasar a ES', despues(b.id));
    paso('② PUT domicilioFiscalForal=true (ya ES)', await guardar(b.id, { domicilioFiscalForal: true }));
  }
  // ③ CONTROLES de que la exclusión está viva en esta raíz: un foral y un canario por el alta.
  paso('③ alta ES Bizkaia, domicilio foral «sí»', await alta('Reformas Bilbao 1536f', { country: 'ES', provincia: 'Bizkaia', domicilio: { foral: true, canarias: false } }));
  paso('③ alta ES Las Palmas, «no»/«no»', await alta('Reformas Palmas 1536f', { country: 'ES', provincia: 'Las Palmas', ...NO_NO }));
  // ④ CONTROL de la ruta: un cuerpo que el esquema rechaza tiene que dar 400, no 200.
  if (a.creado) paso('④ PUT country=ESP (3 letras)', await guardar(a.id, { country: 'ESP' }));
} finally {
  await new Promise((r) => server.close(r));
}
console.log(JSON.stringify(salida, null, 1));
process.exit(0);
