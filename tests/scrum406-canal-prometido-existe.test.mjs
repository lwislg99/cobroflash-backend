// SCRUM-406 · UN CANAL DE CONTACTO PROMETIDO TIENE QUE EXISTIR, Y UN «ESCRÍBENOS» TIENE DESTINO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// LO QUE MIDIÓ EL TICKET
//
// `precios.html` y la pantalla de Planes prometían «Soporte por email y WhatsApp». Ese WhatsApp
// NO EXISTE en el código: ningún `wa.me` del producto apunta a YaQu —todos van al cliente final o
// al PRO— y no hay canal entrante. Prometerlo en la página de PRECIOS es prometer algo por lo que
// alguien paga. Se retiró la mención (no se reescribió la frase: retirar no es escribir microcopy).
//
// Y `libroRegistroView` decía «escríbenos y los revisamos» SIN dirección y SIN enlace, en la
// pantalla fiscal. Una instrucción de avisar sin destino enseña lo mismo que un canal que no
// contesta: que avisar no sirve.
//
// LO QUE VIGILA ESTE GUARD, que no es «prohibir la palabra WhatsApp»: que **lo prometido y lo que
// existe no se separen**. El día que exista un WhatsApp de soporte de verdad, se declara abajo y
// la promesa vuelve a ser legítima sin tocar esta regla.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');

/**
 * LOS CANALES DE CONTACTO QUE EXISTEN DE VERDAD, medidos el 10-ago-2026 contra `origin/main`.
 * Esto NO es una lista de deseos: cada `true` tiene que poder enseñarse en el código.
 */
const CANALES_QUE_EXISTEN = {
  email: true,      // `hola@yaqu.app` — en legales, en la guía de inicio y en el aviso del libro
  whatsapp: false,  // NINGUNO. Ver el test de abajo: todos los `wa.me` son del cliente o del PRO
  telefono: false,
  formulario: false,
};

/** Los `wa.me` del dashboard, declarados con DE QUIÉN es el número. Ninguno es de YaQu. */
const WA_DECLARADOS = {
  'homeView.js': 'del CLIENTE FINAL: «Responder →» abre WhatsApp con quien escribió al profesional.',
  'jobRailBlocks.js': 'del CLIENTE FINAL: el teléfono del trabajo, el mismo que se pinta al lado.',
};

// ── ① LA PROMESA ────────────────────────────────────────────────────────────────────────────────

/** Toda frase del producto que promete soporte, venga de HTML o de JS. */
function promesasDeSoporte() {
  const out = [];
  const mirar = (rel) => {
    const abs = path.join(RAIZ, rel);
    if (!fs.existsSync(abs)) return;
    // ⚠️ `\r?\n`: el repo tiene finales de línea de Windows y en JS `.` NO casa `\r`, así que un
    // `.*$` para comer un comentario deja la línea intacta y el guard se acusa a sí mismo. Pasó.
    fs.readFileSync(abs, 'utf8').split(/\r?\n/).forEach((l, i) => {
      // Solo la frase de la promesa, no los comentarios que explican por qué se retiró.
      if (/^\s*(\/\/|\*|\/\*|<!--)/.test(l)) return;
      const m = l.match(/Soporte por ([^<'"\n]+)/i);
      if (m) out.push({ fichero: rel, linea: i + 1, canales: m[1] });
    });
  };
  mirar('public/precios.html');
  mirar('public/index.html');
  for (const f of fs.readdirSync(DIR_JS)) if (f.endsWith('.js')) mirar('public/dashboard/js/' + f);
  return out;
}

test('SCRUM-406 · SUELO: el buscador de promesas encuentra la promesa', () => {
  // Sin esto, la prohibición de abajo pasaría por no mirar — que es como un guard deja de vigilar
  // sin que se note. Hoy hay dos: precios.html y la pantalla de Planes.
  const p = promesasDeSoporte();
  assert.ok(p.length >= 2,
    `🔴 el buscador solo ve ${p.length} promesa(s) de soporte y debería ver al menos 2 `
    + '(precios.html y plansView.js): si dejó de encontrarlas, no está vigilando nada');
});

test('SCRUM-406 · 🔴 el producto no promete un canal que no existe', () => {
  const CANAL = { whatsapp: /whats\s*app/i, telefono: /teléfono|telefono|llámanos/i, formulario: /formulario/i };
  const mentiras = [];
  for (const p of promesasDeSoporte()) {
    for (const [nombre, re] of Object.entries(CANAL)) {
      if (re.test(p.canales) && !CANALES_QUE_EXISTEN[nombre]) {
        mentiras.push(`${p.fichero}:${p.linea} promete «${nombre}» → "Soporte por ${p.canales.trim()}"`);
      }
    }
  }
  assert.deepEqual(mentiras, [],
    '🔴 EL PRODUCTO PROMETE UN CANAL DE CONTACTO QUE NO EXISTE.\n\n'
    + '  Un canal prometido y ausente es peor que no tenerlo: enseña al profesional que avisarnos\n'
    + '  no sirve, y esa lección no se desaprende. Además esto vive en la página de PRECIOS.\n\n'
    + '  Solo hay dos salidas honestas:\n'
    + '    · CONSTRUIR el canal → y entonces ponerlo a `true` en CANALES_QUE_EXISTEN, con el\n'
    + '      código que lo demuestre.\n'
    + '    · RETIRAR la mención de la frase (retirar no es escribir microcopy: entra sin gate).');
});

test('SCRUM-406 · `whatsapp: false` está MEDIDO, no declarado de memoria', () => {
  // El punto flaco de cualquier registro es que alguien ponga `true` sin construir nada. Aquí el
  // `false` se sostiene en una medición viva: TODOS los `wa.me` del dashboard son de terceros.
  const sitios = [];
  for (const f of fs.readdirSync(DIR_JS)) {
    if (!f.endsWith('.js')) continue;
    if (/wa\.me/.test(sinComentarios(fs.readFileSync(path.join(DIR_JS, f), 'utf8')))) sitios.push(f);
  }
  assert.ok(sitios.length > 0, '🔴 no se encuentra ningún `wa.me`: el detector no está mirando');

  const sinDeclarar = sitios.filter((f) => !(f in WA_DECLARADOS));
  assert.deepEqual(sinDeclarar, [],
    `🔴 hay un \`wa.me\` nuevo sin declarar (${sinDeclarar.join(', ')}).\n\n`
    + '  Di de quién es ese número:\n'
    + '    · del CLIENTE o del PRO → añádelo a WA_DECLARADOS con su motivo.\n'
    + '    · DE YAQU → entonces el canal de soporte por WhatsApp EXISTE: ponlo a `true` en\n'
    + '      CANALES_QUE_EXISTEN y la promesa de precios vuelve a ser legítima.');

  const fantasmas = Object.keys(WA_DECLARADOS).filter((f) => !sitios.includes(f));
  assert.deepEqual(fantasmas, [],
    `🔴 estas declaraciones ya no corresponden a ningún \`wa.me\`: ${fantasmas.join(', ')}`);
});

// ── ③ EL «ESCRÍBENOS» DEL LIBRO REGISTRO ────────────────────────────────────────────────────────

function nodo(tag) {
  const n = {
    tagName: String(tag).toUpperCase(),
    className: '', id: '', type: '', href: '',
    style: { cssText: '', color: '' },
    dataset: {},
    hijos: [],
    _texto: '',
    appendChild(h) { n.hijos.push(h); return h; },
    addEventListener() {},
    set textContent(v) { n._texto = String(v); n.hijos = []; },
    get textContent() { return n._texto; },
    set innerHTML(v) { if (v === '') n.hijos = []; },
    get innerHTML() { return ''; },
  };
  return n;
}
const todos = (n, out = []) => { out.push(n); for (const h of n.hijos) todos(h, out); return out; };

/**
 * El código SIN comentarios. Sin esto, un guard que busca un patrón por texto casa con el
 * comentario que explica por qué ese patrón no está — y eso ya pasó aquí: la primera versión
 * marcó `plansView.js` como si tuviera un `wa.me`, cuando lo que tenía era la nota que dice que
 * NO lo tiene. Un guard que se cita a sí mismo no mide el producto, se mide a él.
 * ⚠️ No vale con partir por `//`: `https://wa.me` lleva dos barras. Solo caen las líneas que
 * EMPIEZAN por comentario, que es donde vive la trampa.
 */
function sinComentarios(fuente) {
  return fuente.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}

/** Pinta la vista del libro con una respuesta dada (mismo banco que SCRUM-296). */
async function pintar(respuesta) {
  const codigo = fs.readFileSync(path.join(DIR_JS, 'libroRegistroView.js'), 'utf8');
  const contenedor = nodo('div');
  const ctx = {
    document: { createElement: nodo },
    window: {},
    apiRequest: async () => respuesta,
    Intl, Date, Array, Number, String, Boolean, Object, JSON, isNaN, console,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx, { filename: 'libroRegistroView.js' });
  assert.equal(typeof ctx.window.renderLibroRegistroView, 'function',
    '🔴 la vista no publica `renderLibroRegistroView`: el test no está midiendo la pantalla');
  ctx.window.renderLibroRegistroView(contenedor);
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  return contenedor;
}

const LIBRO_CON_ILEGIBLES = {
  asientos: [{
    numero: '2026-CF-001', fecha: '2026-03-04T10:00:00.000Z', tipo: 'F1', clienteId: 3,
    base: 100, cuota: 21, total: 121, moneda: 'EUR', estado: 'paid', importeIlegible: true,
    enlaces: { albaranes: [], albaranesNoSellados: 0 },
  }],
  miradas: 1, ajenas: 0, sinNumero: 0, importesIlegibles: ['2026-CF-001'],
};

test('SCRUM-406 · SUELO: el aviso de importes ilegibles llega a pintarse', async () => {
  // Si el fixture dejara de disparar el aviso, el test de abajo pasaría por no haber nada que
  // mirar: un verde hueco. Se comprueba primero que el aviso EXISTE.
  const c = await pintar(LIBRO_CON_ILEGIBLES);
  const aviso = todos(c).find((n) => /no se han podido leer/i.test(n.textContent || ''));
  assert.ok(aviso, '🔴 el fixture no dispara el aviso de importes ilegibles: no hay nada que medir');
});

test('SCRUM-406 · 🔴 «escríbenos» del Libro registro lleva destino', async () => {
  const c = await pintar(LIBRO_CON_ILEGIBLES);
  const aviso = todos(c).find((n) => /no se han podido leer/i.test(n.textContent || ''));
  const enlace = todos(aviso).find((n) => n.tagName === 'A' && /^mailto:/.test(n.href || ''));
  assert.ok(enlace,
    '🔴 el aviso manda «escríbenos» y NO da destino: no hay ningún enlace `mailto:` dentro.\n'
    + '  Es la pantalla fiscal, y una instrucción de avisar sin dónde enseña que avisar no sirve.');
  assert.ok(/@/.test(enlace.href.replace('mailto:', '')),
    `🔴 el destino no parece una dirección: ${enlace.href}`);
  // Y que la dirección se VEA, no solo que esté en el href: un enlace cuyo texto no dice la
  // dirección obliga a pulsar para saber a dónde va, y en un móvil sin correo configurado no
  // lleva a ninguna parte.
  assert.ok(enlace.textContent.includes(enlace.href.replace('mailto:', '')),
    '🔴 el enlace no enseña la dirección: si el `mailto:` no abre nada, no queda dónde escribir');
});
