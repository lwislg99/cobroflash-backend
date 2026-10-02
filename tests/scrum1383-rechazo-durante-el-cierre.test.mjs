// SCRUM-1383 · CERRAR SESIÓN CON FIRMAS RECHAZADAS: se cuentan antes de purgar y «Cancelar» no borra.
//
// Al cerrar sesión se intenta subir la cola (SCRUM-1302). El servidor puede RECHAZAR una firma de
// forma definitiva: sale de la cola, deja una constancia, la cola queda en cero, se cierra sin
// preguntar y el purgado borra la constancia. Una firma que no está en el servidor desaparece del
// móvil sin que nadie lo diga.
//
// 🔴 EL LITERAL ESTÁ PENDIENTE DE FIRMA. `textoFirmasRechazadasAlCerrar` devuelve `null` en `app.js`
// y con `null` no se pregunta. Aquí se mide TODO LO DEMÁS poniendo un texto de banco en su sitio:
// que se cuentan antes del purgado, que se cuentan todas menos `invalid_id`, que va UNA pregunta, y
// que «Cancelar» ni cierra ni borra. El purgado no cambia (lo fija `scrum890b`).
//
// Ejecuta el `logout()` REAL con `colaDeFirmas.js`, `almacenLocal.js` y `api.js` reales.
// Lo que NO mide: un navegador de verdad, ni partes (sólo albaranes).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIN_SUBIR_UNA = 'Te queda 1 firma por subir. Si cierras sesión ahora, se borra de este móvil y habrá que volver a firmar. ¿Cerrar sesión?';

function montar({ conTextoDeBanco = true } = {}) {
  // `rechaza`: ids de albarán → código con el que el servidor dice que no. El resto sube.
  const red = { firmas: [], cierres: 0, rechaza: {}, falla: [] };
  const responder = (status, data) => ({
    ok: status >= 200 && status < 300, status, statusText: String(status),
    headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  red.fetch = async (url, opts) => {
    const u = String(url);
    const metodo = (opts && opts.method) || 'GET';
    if (u.includes('/auth/logout')) { red.cierres += 1; return responder(200, {}); }
    if (metodo === 'POST' && /\/firmar$/.test(u)) {
      red.firmas.push(u);
      const id = Number(u.match(/(\d+)\/firmar$/)[1]);
      if (red.falla.includes(id)) return responder(500, { error: 'server_error' });
      const codigo = red.rechaza[id];
      if (codigo) return responder(400, { error: codigo, code: codigo });
      return responder(200, { id, estado: 'firmado' });
    }
    return responder(200, {});
  };
  red.navigator = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };
  const b = montarAlmacen(RAIZ, { dashboard: { red } });
  const avisos = { acepta: true, preguntas: [] };
  b.ctx.confirm = (texto) => { avisos.preguntas.push(String(texto)); return avisos.acepta; };
  if (conTextoDeBanco) {
    b.ctx.textoFirmasRechazadasAlCerrar = (rechazadas, sinSubir) => `BANCO rechazadas=${rechazadas} sinSubir=${sinSubir}`;
  }
  return { b, red, avisos };
}

async function encolar(b, ids) {
  for (const id of ids) {
    await b.ctx.encolarFirma(id, { signatureData: 'data:image/png;base64,' + 'A'.repeat(400), firmadoPorNombre: 'Ana Ruiz' }, 'albaran');
  }
}

async function enCola(b) {
  const r = await b.ctx.leerFirmasPendientes();
  assert.equal(r.estado, b.ctx.GUARDADO, '🔴 SUELO: la cola no se puede leer');
  return r.firmas.length;
}

async function constancias(b) {
  const r = await b.ctx.leerRechazosDeFirma();
  assert.equal(r.estado, b.ctx.GUARDADO, '🔴 SUELO: las constancias no se pueden leer');
  return r.rechazos.length;
}

const salio = (b) => String(b.ctx.location.href).includes('/login.html');

test('SCRUM-1383 · suelo: el banco ve la cola, las constancias, el `logout` real y el hueco del literal', () => {
  const { b } = montar({ conTextoDeBanco: false });
  assert.equal(porQueEstariaCiego(b, RAIZ), null);
  for (const n of ['logout', 'encolarFirma', 'drenarSiNoSeEstaDrenando', 'leerFirmasPendientes', 'leerRechazosDeFirma', 'textoFirmasRechazadasAlCerrar']) {
    assert.equal(typeof b.ctx[n], 'function', `\`${n}\` no es alcanzable desde el banco`);
  }
});

test('SCRUM-1383 · control positivo: sin logout, el rechazo deja su constancia (el banco la ve cuando existe)', async () => {
  const { b, red } = montar();
  red.rechaza = { 7: 'firma_invalida' };
  await encolar(b, [7]);
  await b.ctx.drenarSiNoSeEstaDrenando();
  assert.equal(await enCola(b), 0);
  assert.equal(await constancias(b), 1);
});

test('SCRUM-1383 · control: sin constancias y con la cola vacía no se pregunta nada', async () => {
  const { b, red, avisos } = montar();
  await b.ctx.logout();
  assert.deepEqual(avisos.preguntas, []);
  assert.equal(red.cierres, 1);
  assert.equal(salio(b), true);
});

test('SCRUM-1383 · 🔴 el rechazo NACE en el cierre: se pregunta antes de purgar, y «Cancelar» ni cierra ni borra', async () => {
  const { b, red, avisos } = montar();
  red.rechaza = { 7: 'firma_invalida' };
  await encolar(b, [7]);
  avisos.acepta = false;

  await b.ctx.logout();

  assert.equal(red.firmas.length, 1, '🔴 SUELO: no se intentó subir; el rechazo no ha podido nacer aquí');
  assert.equal(await enCola(b), 0, '🔴 SUELO: la firma rechazada sigue en la cola; se mediría el aviso de SCRUM-1302');
  assert.deepEqual(avisos.preguntas, ['BANCO rechazadas=1 sinSubir=0'], '🔴 la firma se rechazó en el cierre y no se preguntó');
  assert.equal(await constancias(b), 1, '🔴 dijo «Cancelar» y la constancia se ha borrado igual');
  assert.equal(red.cierres, 0, '🔴 dijo «Cancelar» y se ha llamado a /auth/logout');
  assert.equal(salio(b), false, '🔴 dijo «Cancelar» y se le ha mandado al login');
});

test('SCRUM-1383 · si acepta, se purga como siempre: no queda constancia (art. 32, `scrum890b`)', async () => {
  const { b, red, avisos } = montar();
  red.rechaza = { 7: 'firma_invalida' };
  await encolar(b, [7]);

  await b.ctx.logout();

  assert.equal(avisos.preguntas.length, 1);
  assert.equal(await constancias(b), 0, '🔴 aceptó cerrar y la constancia sigue en el móvil');
  assert.equal(red.cierres, 1);
  assert.equal(salio(b), true);
});

test('SCRUM-1383 · se cuentan TODAS las del móvil: la rechazada de antes también, con la cola ya vacía', async () => {
  const { b, red, avisos } = montar();
  red.rechaza = { 7: 'firma_invalida', 9: 'firma_sin_nombre' };
  await encolar(b, [7, 9]);
  await b.ctx.drenarSiNoSeEstaDrenando(); // las dos se rechazaron ANTES del cierre
  assert.equal(await constancias(b), 2, '🔴 SUELO: no hay dos constancias previas');
  red.firmas.length = 0;
  avisos.acepta = false;

  await b.ctx.logout();

  assert.equal(red.firmas.length, 0, 'con la cola vacía no hay nada que intentar subir');
  assert.deepEqual(avisos.preguntas, ['BANCO rechazadas=2 sinSubir=0']);
  assert.equal(salio(b), false);
});

test('SCRUM-1383 · `invalid_id` NO se cuenta: volver a pedir la firma daría el mismo no', async () => {
  const { b, red, avisos } = montar();
  red.rechaza = { 7: 'invalid_id' };
  await encolar(b, [7]);
  avisos.acepta = false; // si preguntase, no se cerraría

  await b.ctx.logout();

  assert.equal(red.firmas.length, 1, '🔴 SUELO: no se intentó subir');
  assert.deepEqual(avisos.preguntas, [], '🔴 se preguntó por una firma que repetir no arregla');
  assert.equal(salio(b), true);
});

test('SCRUM-1383 · `invalid_id` junto a otra: se cuenta sólo la otra', async () => {
  const { b, red, avisos } = montar();
  red.rechaza = { 7: 'invalid_id', 8: 'firma_invalida' };
  await encolar(b, [7, 8]);
  avisos.acepta = false;

  await b.ctx.logout();

  assert.deepEqual(avisos.preguntas, ['BANCO rechazadas=1 sinSubir=0']);
});

test('SCRUM-1383 · rechazadas Y sin subir: UNA sola pregunta, con las dos cifras', async () => {
  const { b, red, avisos } = montar();
  red.rechaza = { 7: 'firma_invalida' };
  red.falla = [8, 9];
  await encolar(b, [7, 8, 9]);
  avisos.acepta = false;

  await b.ctx.logout();

  assert.equal(red.firmas.length, 3, '🔴 SUELO: no se intentaron las tres');
  assert.deepEqual(avisos.preguntas, ['BANCO rechazadas=1 sinSubir=2'], '🔴 no es UNA pregunta con las dos cifras');
  assert.equal(await enCola(b), 2, '«Cancelar» no saca nada de la cola');
  assert.equal(await constancias(b), 1);
  assert.equal(salio(b), false);
});

test('SCRUM-1383 · si las constancias no se pueden LEER no se pregunta por ellas: se cierra como siempre', async () => {
  const { b, red, avisos } = montar();
  red.rechaza = { 7: 'firma_invalida' };
  await encolar(b, [7]);
  b.ctx.leerRechazosDeFirma = async () => ({ estado: b.ctx.FALLO, motivo: 'banco: ilegible', rechazos: [] });
  avisos.acepta = false;

  await b.ctx.logout();

  assert.deepEqual(avisos.preguntas, [], '🔴 se preguntó con una cifra que no se pudo leer');
  assert.equal(red.cierres, 1, 'cerrar sesión tiene que funcionar siempre (SCRUM-455)');
});

test('SCRUM-1383 · HOY, sin literal firmado: con rechazadas no se pregunta, y con sin-subir sigue el texto de SCRUM-1302', async () => {
  // Fija lo que hace `main` mientras el texto no esté firmado: nada nuevo se pinta.
  {
    const { b, red, avisos } = montar({ conTextoDeBanco: false });
    assert.equal(b.ctx.textoFirmasRechazadasAlCerrar(1, 0), null, '🔴 hay un literal en `app.js`: ¿está firmado? Entonces este test y el pendiente de abajo se actualizan juntos');
    red.rechaza = { 7: 'firma_invalida' };
    await encolar(b, [7]);
    avisos.acepta = false;
    await b.ctx.logout();
    assert.deepEqual(avisos.preguntas, []);
    assert.equal(salio(b), true);
  }
  {
    const { b, red, avisos } = montar({ conTextoDeBanco: false });
    red.rechaza = { 7: 'firma_invalida' };
    red.falla = [8];
    await encolar(b, [7, 8]);
    avisos.acepta = false;
    await b.ctx.logout();
    assert.deepEqual(avisos.preguntas, [SIN_SUBIR_UNA], 'sin literal combinado, la pregunta firmada de SCRUM-1302 sigue saliendo');
    assert.equal(salio(b), false);
  }
});

test('SCRUM-1383 · el literal firmado: una, varias y el combinado', { skip: 'PENDIENTE DE FIRMA del fundador (SCRUM-1383): el texto es nuevo; cuando vuelva firmado se escribe en `textoFirmasRechazadasAlCerrar` y aquí' }, () => {});
