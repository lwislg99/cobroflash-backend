// tests/scrum1685-formulario-de-alta.test.mjs — SCRUM-1685, tramo b
//
// EL FORMULARIO DEL ALTA CON INVITACIÓN. `public/register.html` pide, con España, la provincia y las
// dos preguntas del domicilio fiscal, y manda lo que la ruta del tramo a espera (`provincia`,
// `domicilio-foral`, `domicilio-canarias` con «si»/«no»). Aquí se ejecuta el script REAL de la página
// sobre un DOM mínimo, y su `fetch` va a la ruta REAL: lo que se mide es el formulario y la ruta juntos,
// no dos mitades que cada una cree cumplir.
//
// Textos: NINGUNO nuevo. Los dos enunciados y «Provincia» son literales ya firmados (abajo, con su
// fuente); «Sí»/«No», los de la ficha de Configuración. Firma de su reuso: SCRUM-1656 c.21408 ④,
// entradas 22-23.
//
// Los casos del invitado necesitan base (el banco desechable de `LIBRO_PG_URL`, receta en
// docs/RUNBOOKS.md); el del no invitado, no: la puerta lo para antes.
import './_staging-db.mjs';
import { URL_BANCO } from './_banco-libro.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';

const ENABLED = URL_BANCO !== '';

process.env.REGISTRATION_INVITED_EMAILS = 'invitado-e-1685@test.local,invitado-f-1685@test.local';
process.env.DISABLE_CRONS = 'true';
process.env.RESEND_API_KEY = '';
process.env.LOG_MAGIC_LINKS = 'true';
if (!ENABLED) delete process.env.DATABASE_URL;

// Literales firmados, copiados de su REGISTRO (no de la página):
//   · docs/microcopy/2026-10-22-SCRUM-1536-exclusion-territorial.md (SCRUM-1536 c.20223 §⑤, firma c.20225).
//   · «Provincia»: la ficha del cliente (SCRUM-1145 c.20592), reuso firmado en SCRUM-1656 c.21408 ④.
//   · SCRUM-1515 c.18971 — la ruta cerrada.
const PREGUNTA_FORAL = '¿Tienes el domicilio fiscal en el País Vasco o en Navarra?';
const PREGUNTA_CANARIAS = '¿Tienes el domicilio fiscal en Canarias?';
const ROTULO_PROVINCIA = 'Provincia';
const FRASE_CERRADA = 'Ahora mismo no estamos aceptando altas nuevas. Si quieres probar YaQu, escríbenos y te damos acceso.';
const FUERA_POR_DOMICILIO = 'De momento YaQu no está disponible si tienes el domicilio fiscal en el País Vasco, Navarra o Canarias.';
// El que la página pinta HOY al crear la cuenta (no cambia en este tramo).
const PINTA_CREADA = '✉️ ¡Cuenta creada! Revisa tu email y haz clic en el enlace para acceder.';

const CORREOS = ['invitado-e-1685@test.local', 'invitado-f-1685@test.local', 'intruso-f-1685@test.local'];
const HTML = fs.readFileSync(new URL('../public/register.html', import.meta.url), 'utf8');

/** El buzón de laboratorio: acepta todo y apunta a quién iba cada correo. Nada sale de la máquina. */
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
          resto = resto.slice(fin + 5); enDatos = false;
          for (const p of para) cartas.push({ para: p.toLowerCase() });
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

const { app } = await import('../dist/app.js');
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const puerto = server.address().port;

/** El `fetch` de la página, contra la ruta real. */
function fetchReal(ruta, opciones) {
  return new Promise((resolve, reject) => {
    const datos = opciones?.body ? Buffer.from(opciones.body) : null;
    const req = http.request({ host: '127.0.0.1', port: puerto, path: ruta, method: opciones?.method || 'GET', agent: false,
      headers: { ...(opciones?.headers || {}), ...(datos ? { 'Content-Length': datos.length } : {}) } },
    (res) => {
      let d = ''; res.setEncoding('utf8'); res.on('data', (t) => { d += t; });
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: async () => JSON.parse(d) }));
    });
    req.on('error', reject);
    req.end(datos || undefined);
  });
}

// ── La página, leída como HTML ────────────────────────────────────────────────────────────────────
/** El <select> de `id`, con su <label for> y sus opciones (valor + texto visible). */
function selectDe(id) {
  // SCRUM-553 · sin el `>` pegado: un `class` o un `aria-*` más en la etiqueta no la vuelve invisible.
  const rotulo = (HTML.match(new RegExp(`<label for="${id}"[^>]*>([^<]*)</label>`)) || [])[1];
  const m = HTML.match(new RegExp(`<select id="${id}"([^>]*)>([\\s\\S]*?)</select>`));
  if (!m) return { rotulo, atributos: null, opciones: null };
  const opciones = [...m[2].matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map((o) => ({ valor: o[1], texto: o[2].trim() }));
  return { rotulo, atributos: m[1], opciones };
}

// ── La página, EJECUTADA sobre un DOM mínimo ──────────────────────────────────────────────────────
/** Monta la página: cada id del HTML es un elemento con valor, estilo y escuchas; devuelve los mandos. */
function montarPagina({ fetchDePagina = fetchReal } = {}) {
  const els = new Map();
  for (const m of HTML.matchAll(/\bid="([^"]+)"/g)) {
    const id = m[1];
    const sel = HTML.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)</select>`));
    const elegida = sel && (sel[1].match(/<option value="([^"]*)"[^>]*\bselected\b/) || [])[1];
    const primera = sel && (sel[1].match(/<option value="([^"]*)"/) || [])[1];
    const el = { id, value: elegida ?? primera ?? '', style: {}, textContent: '', className: '', hidden: false, disabled: false,
      escuchas: {}, addEventListener(tipo, fn) { (this.escuchas[tipo] ||= []).push(fn); } };
    if (sel) {
      // Como el navegador: un <select> sólo toma un valor que sea una de sus opciones; si no, queda vacío.
      const validos = new Set([...sel[1].matchAll(/<option value="([^"]*)"/g)].map((o) => o[1]));
      let actual = el.value;
      Object.defineProperty(el, 'value', { get: () => actual, set: (v) => { actual = validos.has(String(v)) ? String(v) : ''; } });
    }
    els.set(id, el);
  }
  // SCRUM-553 · sin el `>` pegado; los que llevan `src` no son «en línea» y no cuentan.
  const scripts = [...HTML.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 1, '🔴 register.html tiene que tener UN script en línea (el banco ejecuta ése)');
  const document = { getElementById: (id) => els.get(id) || null };
  const enviados = [];
  const fetchEspia = async (ruta, opciones) => { enviados.push({ ruta, cuerpo: JSON.parse(opciones.body) }); return fetchDePagina(ruta, opciones); };
  const window = { location: { href: '/register.html' } };
  // eslint-disable-next-line no-new-func
  new Function('document', 'fetch', 'location', 'window', 'setTimeout', 'URLSearchParams', scripts[0])(
    document, fetchEspia, { search: '' }, window, () => {}, URLSearchParams);
  const disparar = async (id, tipo) => { for (const fn of els.get(id)?.escuchas[tipo] || []) await fn({ preventDefault() {} }); };
  return {
    el: (id) => els.get(id),
    enviados,
    async elegirPais(pais) { els.get('country').value = pais; await disparar('country', 'change'); },
    async enviar() { await disparar('register-form', 'submit'); },
    alerta: () => els.get('alert').textContent,
  };
}

async function rellenar(p, campos) {
  for (const [id, valor] of Object.entries(campos)) {
    assert.ok(p.el(id), `🔴 la página no tiene el campo #${id}`);
    p.el(id).value = valor;
  }
}

let prisma = null;
async function limpiar() {
  if (!prisma) return;
  const { limpiarMerchant } = await import('./_merchant-fixture.mjs');
  const filas = await prisma.merchant.findMany({ where: { email: { in: CORREOS } }, select: { id: true } });
  for (const f of filas) await limpiarMerchant(prisma, f.id);
}
if (ENABLED) {
  ({ prisma } = await import('../dist/core/db/prisma.js'));
  await limpiar();
}
const merchantsDe = (correo) => prisma.merchant.count({ where: { email: correo } });

test.after(async () => {
  try { await limpiar(); } finally {
    server.close();
    buzon.servidor.close();
    if (prisma) await prisma.$disconnect();
  }
});

test('SCRUM-1685b · la página pide provincia y domicilio con los literales FIRMADOS, y nada más', () => {
  assert.match(HTML, /<label for="provincia"[^>]*>Provincia<\/label>/, `🔴 falta el campo con el rótulo «${ROTULO_PROVINCIA}»`);
  for (const [id, pregunta] of [['domicilio-foral', PREGUNTA_FORAL], ['domicilio-canarias', PREGUNTA_CANARIAS]]) {
    const s = selectDe(id);
    assert.equal(s.rotulo, pregunta, `🔴 #${id} no lleva el enunciado firmado, LITERAL`);
    assert.ok(s.atributos && /\brequired\b/.test(s.atributos), `🔴 #${id} no es obligatorio`);
    // Una opción vacía (sin texto: nada que firmar) que obliga a contestar, y «Sí»/«No» como en la ficha.
    assert.deepEqual(s.opciones, [{ valor: '', texto: '' }, { valor: 'si', texto: 'Sí' }, { valor: 'no', texto: 'No' }],
      `🔴 #${id} no ofrece exactamente «Sí»/«No» (valores si/no) tras una opción vacía`);
  }
});

// ── b2: la provincia, DESPLEGABLE con las 52 firmadas ─────────────────────────────────────────────
// La lista esperada sale del REGISTRO firmado (docs/master/SCRUM-1616.md, tabla INE), no de la página:
// firma SCRUM-1616 c.21066 ① las 48 ✅ con la grafía de la columna «Código hoy» (artículo delante),
// ② las 4 ❌ con la forma doble del INE, ③ Ceuta y Melilla. Orden: el del código INE, el de la tabla.
const REGISTRO_1616 = fs.readFileSync(new URL('../docs/master/SCRUM-1616.md', import.meta.url), 'utf8');
const FIRMADAS = [...REGISTRO_1616.matchAll(/^\| (\d{2}) \| ([^|]+?) \| ([^|]+?) \| (✅|❌)[^|]*\|/gm)]
  .map((m) => (m[4] === '❌' ? m[3] : m[2]).trim());

test('SCRUM-1685 b2 · la provincia es un desplegable obligatorio con EXACTAMENTE las 52 firmadas, y cada una entra', async () => {
  assert.equal(FIRMADAS.length, 52, `🔴 el registro de 1616 ya no da 52 filas (${FIRMADAS.length}): la fuente ha cambiado`);
  assert.ok(FIRMADAS.includes('Valencia/València') && FIRMADAS.includes('A Coruña'), '🔴 el cotejo del registro no ha leído la columna que toca');
  const s = selectDe('provincia');
  assert.equal(s.rotulo, ROTULO_PROVINCIA, `🔴 falta el campo con el rótulo «${ROTULO_PROVINCIA}»`);
  assert.ok(s.atributos && /\brequired\b/.test(s.atributos), '🔴 la provincia no es un desplegable obligatorio');
  assert.doesNotMatch(HTML, /<input[^>]*id="provincia"/, '🔴 la provincia se sigue pudiendo teclear');
  assert.deepEqual(s.opciones[0], { valor: '', texto: '' }, '🔴 falta la opción vacía (sin texto) que obliga a elegir');
  const resto = s.opciones.slice(1);
  assert.deepEqual(resto.map((o) => o.texto), FIRMADAS, '🔴 el desplegable no pinta las 52 firmadas, en su orden');
  for (const o of resto) assert.equal(o.valor, o.texto, `🔴 «${o.texto}» manda otro valor (${o.valor})`);
  // Cada valor que el desplegable puede mandar, el servidor lo acepta (la misma función que usa registerMerchant).
  const { zonaDeAlta } = await import('../dist/modules/auth/domain/zonaDeLaProvincia.js');
  for (const o of resto) assert.doesNotThrow(() => zonaDeAlta('ES', o.valor), `🔴 el servidor rechaza «${o.valor}»`);
});

test('SCRUM-1685 b2 · un valor raro no se puede poner: el desplegable queda vacío', async () => {
  const p = montarPagina({ fetchDePagina: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }) });
  p.el('provincia').value = 'Madriz';
  assert.equal(p.el('provincia').value, '', '🔴 el desplegable ha aceptado un valor que no es de la lista');
  p.el('provincia').value = 'Valencia/València';
  assert.equal(p.el('provincia').value, 'Valencia/València');
});

test('SCRUM-1685b · con España se piden y se mandan; con otro país ni se ven ni viajan', async () => {
  const p = montarPagina({ fetchDePagina: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }) });
  assert.equal(p.el('campos-es')?.hidden, false, '🔴 con España (el país de partida) los campos no se ven');
  await rellenar(p, { name: 'Taller 1685', email: 'x@test.local', provincia: 'Madrid', 'domicilio-foral': 'no', 'domicilio-canarias': 'si' });
  await p.enviar();
  assert.equal(p.enviados.length, 1);
  const c = p.enviados[0].cuerpo;
  assert.equal(c.provincia, 'Madrid');
  assert.equal(c['domicilio-foral'], 'no');
  assert.equal(c['domicilio-canarias'], 'si');

  await p.elegirPais('MX');
  assert.equal(p.el('campos-es').hidden, true, '🔴 con México se siguen viendo provincia y domicilio');
  for (const id of ['provincia', 'domicilio-foral', 'domicilio-canarias']) {
    assert.equal(p.el(id).disabled, true, `🔴 con México #${id} sigue activo (y el navegador lo exigiría)`);
  }
  await p.enviar();
  const otro = p.enviados[1].cuerpo;
  for (const k of ['provincia', 'domicilio-foral', 'domicilio-canarias']) assert.ok(!(k in otro), `🔴 con México viaja «${k}»`);
  await p.elegirPais('ES');
  assert.equal(p.el('campos-es').hidden, false, '🔴 al volver a España los campos no reaparecen');
});

test('SCRUM-1685b · el NO invitado, rellenando bien el formulario, ve la frase de la ruta cerrada', async () => {
  const p = montarPagina();
  await rellenar(p, { name: 'Intruso F 1685', email: 'intruso-f-1685@test.local', provincia: 'Madrid', 'domicilio-foral': 'no', 'domicilio-canarias': 'no' });
  await p.enviar();
  assert.equal(p.alerta(), FRASE_CERRADA, '🔴 el no invitado no ve la frase firmada de la ruta cerrada');
  assert.equal(buzon.cartas.length, 0, '🔴 a un no invitado se le ha mandado un correo');
  if (ENABLED) assert.equal(await merchantsDe('intruso-f-1685@test.local'), 0, '🔴 EL NO INVITADO TIENE CUENTA');
});

test('SCRUM-1685b · invitado con domicilio foral, por el formulario → ve la exclusión firmada y no se crea nada', { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable) · receta en docs/RUNBOOKS.md' }, async () => {
  const p = montarPagina();
  await rellenar(p, { name: 'Invitado E 1685', email: 'invitado-e-1685@test.local', provincia: 'Burgos', 'domicilio-foral': 'si', 'domicilio-canarias': 'no' });
  await p.enviar();
  assert.equal(p.alerta(), FUERA_POR_DOMICILIO, '🔴 el foral no ve la frase firmada de la exclusión');
  assert.equal(await merchantsDe('invitado-e-1685@test.local'), 0, '🔴 el foral tiene cuenta');
});

test('SCRUM-1685b · invitado con provincia normal, por el formulario → cuenta creada y bienvenida en el buzón', { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable) · receta en docs/RUNBOOKS.md' }, async () => {
  const correo = 'invitado-f-1685@test.local';
  const p = montarPagina();
  // b2: con una de las 4 formas dobles, que es lo que ahora manda el desplegable.
  await rellenar(p, { name: 'Reformas F 1685', email: correo, provincia: 'Valencia/València', 'domicilio-foral': 'no', 'domicilio-canarias': 'no' });
  await p.enviar();
  assert.equal(p.alerta(), PINTA_CREADA, `🔴 el invitado bueno no ve «cuenta creada»: ${p.alerta()}`);
  const fila = await prisma.merchant.findUnique({ where: { email: correo } });
  assert.ok(fila, '🔴 la página dijo «creada» y no hay fila');
  assert.equal(fila.timezone, 'Europe/Madrid', '🔴 la provincia del formulario no ha llegado a la cuenta');
  assert.equal(fila.domicilioFiscalForal, false, '🔴 el «No» del formulario no se ha guardado');
  for (let i = 0; i < 50 && buzon.cartas.filter((c) => c.para === correo).length < 2; i++) await new Promise((r) => setTimeout(r, 100));
  assert.equal(buzon.cartas.filter((c) => c.para === correo).length, 2, '🔴 no han salido bienvenida + enlace');
});
