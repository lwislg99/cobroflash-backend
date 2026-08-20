// SCRUM-334 (F7) · CADA BOTON LLEGA A DONDE DICE QUE LLEVA.
//
// Sin gate: arranca la app real en un puerto efimero y pide de verdad. Ni BD, ni red externa.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUE EXISTE
//
// El bloque F diseño lo que el visitante LEE. Nadie comprobaba a donde le lleva lo que PULSA.
// Una landing es un embudo, y un embudo con un boton roto no convierte peor: no convierte.
//
// Y el fallo no se ve mirando la pagina: se ve pulsandola. Un `href` a una seccion que alguien
// renombro, un enlace de WhatsApp con el numero mal escrito, un CTA que promete «empieza
// gratis» y aterriza en el formulario de acceso — los tres se leen perfectos en el HTML.
//
// LO QUE VIGILA, y son cuatro cosas distintas que fallan por motivos distintos:
//   ① DESTINO INTERNO — la ruta responde 200 y con contenido (no el 200 vacio, que no se nota).
//   ② ANCLA — `#loquesea` existe como `id` en esa misma pagina.
//   ③ CANAL EXTERNO — un `wa.me` lleva un numero al que de verdad se puede escribir, y un
//     `mailto:` una direccion con forma de direccion.
//   ④ COHERENCIA PROMESA↔DESTINO — el CTA que promete empezar lleva al alta, no al acceso.
//     Es el unico de los cuatro que no se arregla solo el dia que alguien mueve una ruta.
//
// ⚠️ NO VALIDA MICROCOPY y no le corresponde (regla 30). No dice que debe decir un boton:
// dice que lo que ya dice y a donde ya va no se contradigan.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const { app } = await import(pathToFileURL(path.join(RAIZ, 'dist', 'app.js')).href);
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

/** Las paginas de la superficie publica en las que un visitante pulsa algo. */
const PAGINAS = ['public/index.html', 'public/precios.html', 'public/register.html',
  'public/login.html', 'public/privacidad.html', 'public/terminos.html'];

/**
 * Censo de CTA: todo `<a href>` con texto visible. Se quedan fuera los assets — pero NO se
 * filtra por clase ni por «parece un boton»: un enlace de texto en medio de un parrafo tambien
 * se pulsa, y filtrar por apariencia dejaria fuera justo los que nadie revisa.
 */
function censarCta() {
  const asset = /\.(css|js|png|jpe?g|svg|ico|json|webmanifest|xml|txt|woff2?)$/i;
  const out = [];
  for (const rel of PAGINAS) {
    const html = leer(rel);
    for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const href = m[1];
      const texto = m[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!texto) continue;
      if (asset.test(href)) continue;
      out.push({ href, texto, pagina: rel });
    }
  }
  return out;
}

const CTA = censarCta();
const esAncla = (h) => h.startsWith('#');
const esInterno = (h) => h.startsWith('/');
const esWhatsApp = (h) => /^https:\/\/wa\.me\//i.test(h);
const esCorreo = (h) => h.startsWith('mailto:');

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · «ningun CTA roto» y «no encontre ningun CTA» dan el mismo verde
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-334 · SUELO: el censo de CTA VE botones antes de decir que estan bien', () => {
  assert.ok(CTA.length >= 10,
    `🔴 ESCANER CIEGO: solo veo ${CTA.length} enlaces con texto en ${PAGINAS.length} paginas `
    + 'publicas. La landing sola tiene mas de diez. Si el patron dejo de casar, TODOS los casos '
    + 'de abajo pasarian sin haber comprobado ni un boton, y ese verde es la mentira mas cara '
    + 'que puede decir este fichero.');

  // Y que vea las FAMILIAS, no diez enlaces del mismo tipo: sin destinos internos no se
  // comprueba ninguna ruta, y sin anclas no se comprueba ninguna seccion.
  assert.ok(CTA.some((c) => esInterno(c.href)), '🔴 el censo no ve ni un destino interno');
  assert.ok(CTA.some((c) => esAncla(c.href)), '🔴 el censo no ve ni un ancla');
  assert.ok(CTA.filter((c) => esInterno(c.href)).length >= 3,
    '🔴 menos de 3 destinos internos: el censo esta mirando una pagina, no la superficie');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① y ② · el destino existe
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-334 · ningun CTA lleva a un 404 ni a una pagina vacia', async () => {
  const fallos = [];
  const vistos = new Map();
  for (const c of CTA.filter((x) => esInterno(x.href))) {
    const ruta = c.href.split('#')[0].split('?')[0] || '/';
    if (!vistos.has(ruta)) {
      const r = await fetch(BASE + ruta).catch((e) => ({ status: 0, _err: e?.message }));
      const cuerpo = r.status === 200 ? await r.text() : '';
      const visible = cuerpo.replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      vistos.set(ruta, { estado: r.status, largo: visible.length });
    }
    const v = vistos.get(ruta);
    if (v.estado !== 200) {
      fallos.push(`«${c.texto}» → ${ruta} → ${v.estado || 'sin respuesta'} (en ${c.pagina})`);
    } else if (v.largo < 200) {
      fallos.push(`«${c.texto}» → ${ruta} → 200 pero solo ${v.largo} car. visibles (en ${c.pagina})`);
    }
  }
  assert.deepEqual(fallos, [],
    '🔴 HAY CTA QUE NO LLEGAN A NINGUNA PARTE:\n   ' + fallos.join('\n   ')
    + '\n\n  Un boton roto en la landing no baja la conversion: la anula para quien lo pulsa,\n'
    + '  y no deja rastro porque nadie mide (SCRUM-327: instrumentacion CERO).');
});

test('SCRUM-334 · toda ancla apunta a una seccion que existe en su pagina', () => {
  const fallos = [];
  for (const rel of PAGINAS) {
    const html = leer(rel);
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    for (const c of CTA.filter((x) => x.pagina === rel && esAncla(x.href))) {
      const id = c.href.slice(1);
      if (id && !ids.has(id)) fallos.push(`«${c.texto}» → ${c.href} no existe en ${rel}`);
    }
  }
  assert.deepEqual(fallos, [],
    '🔴 ANCLAS QUE NO LLEVAN A NINGUN SITIO:\n   ' + fallos.join('\n   ')
    + '\n\n  El navegador no da error: se queda donde esta. El visitante cree que no funciona.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ · los canales externos — y el numero de WhatsApp es el que se rompe al cambiarlo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-334 · todo enlace de WhatsApp lleva un numero al que se puede escribir', () => {
  const fallos = [];
  for (const c of CTA.filter((x) => esWhatsApp(x.href))) {
    const numero = c.href.replace(/^https:\/\/wa\.me\//i, '').split(/[/?#]/)[0];
    // E.164 sin `+` ni separadores, que es lo unico que `wa.me` acepta.
    if (!/^[0-9]{8,15}$/.test(numero)) {
      fallos.push(`«${c.texto}» → wa.me/${numero || '(vacio)'} en ${c.pagina}`);
    }
  }
  assert.deepEqual(fallos, [],
    '🔴 ENLACES DE WHATSAPP QUE NO ABREN NINGUN CHAT:\n   ' + fallos.join('\n   ')
    + '\n\n  `wa.me` NO admite `+`, espacios ni letras: con cualquiera de los tres abre una\n'
    + '  pantalla de error. Es lo que se rompe el dia que se cambia de numero y alguien pega\n'
    + '  el formato bonito.');
});

test('SCRUM-334 · todo `mailto:` publica una direccion con forma de direccion', () => {
  const fallos = [];
  for (const c of CTA.filter((x) => esCorreo(x.href))) {
    const dir = c.href.slice('mailto:'.length).split('?')[0];
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(dir)) fallos.push(`«${c.texto}» → ${c.href} en ${c.pagina}`);
  }
  assert.deepEqual(fallos, [],
    '🔴 direcciones de correo publicadas que no lo son:\n   ' + fallos.join('\n   '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ · LA COHERENCIA · lo que el boton promete y lo que hay al otro lado
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// Las dos pantallas se parecen y NO son la misma: `/register.html` CREA la cuenta,
// `/login.html` pide un correo que ya exista. Mandar a alguien que nunca ha entrado al
// formulario de acceso es pedirle algo distinto de lo que se le prometio, y no da error:
// escribe su correo, no le llega nada, y se va.
const PROMETE_EMPEZAR = /empie|empez|crear cuenta|reg[ií]str|prueba gratis|gratis/i;
const PROMETE_ENTRAR = /entrar|acceder|iniciar sesi|ya tengo cuenta/i;

test('SCRUM-334 · el CTA que promete EMPEZAR lleva al alta, no al acceso', () => {
  const fallos = [];
  for (const c of CTA) {
    if (!esInterno(c.href)) continue;
    const ruta = c.href.split('#')[0];
    const empezar = PROMETE_EMPEZAR.test(c.texto);
    const entrar = PROMETE_ENTRAR.test(c.texto);
    if (empezar && !entrar && ruta !== '/register.html') {
      fallos.push(`«${c.texto}» (${c.pagina}) promete empezar y lleva a ${ruta}`);
    }
    if (entrar && !empezar && ruta !== '/login.html') {
      fallos.push(`«${c.texto}» (${c.pagina}) promete entrar y lleva a ${ruta}`);
    }
  }
  assert.deepEqual(fallos, [],
    '🔴 LA PROMESA Y EL DESTINO NO COINCIDEN:\n   ' + fallos.join('\n   ')
    + '\n\n  `/register.html` CREA la cuenta; `/login.html` pide un correo que ya exista. Al\n'
    + '  visitante nuevo que aterriza en el segundo no le llega ningun enlace y se va sin que\n'
    + '  quede rastro. No es un 404: es peor, porque parece que funciono.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO · el analizador sabe decir que NO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-334 · CONTROL NEGATIVO: el analizador no acusa a lo legitimo, y si acusa a lo malo', () => {
  // ① un enlace de pie legitimo no promete empezar ni entrar, asi que la regla ④ no le aplica.
  assert.equal(PROMETE_EMPEZAR.test('Privacidad'), false, '🔴 marcaria el pie legal como CTA de alta');
  assert.equal(PROMETE_ENTRAR.test('Como funciona'), false, '🔴 marcaria la navegacion como CTA de acceso');

  // ② y SI sabe acusar, con textos dados en la mano. Sin esto, una regla que no casara nunca
  //   dejaria el caso ④ en verde eterno sin comprobar un solo boton.
  assert.equal(PROMETE_EMPEZAR.test('Empieza gratis'), true, '🔴 no reconoce el CTA de alta: esta ciego');
  assert.equal(PROMETE_ENTRAR.test('Entrar'), true, '🔴 no reconoce el CTA de acceso: esta ciego');

  // ③ el censo distingue las familias por su FORMA, no por su apariencia.
  assert.equal(esWhatsApp('https://wa.me/34600000000'), true);
  assert.equal(esWhatsApp('https://ejemplo.com/wa.me/x'), false, '🔴 confunde una URL cualquiera con wa.me');
  assert.equal(esCorreo('mailto:hola@yaqu.app'), true);
  assert.equal(esInterno('#precios'), false, '🔴 confunde un ancla con una ruta');
});
