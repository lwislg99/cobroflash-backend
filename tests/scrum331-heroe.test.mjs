// tests/scrum331-heroe.test.mjs — SCRUM-331 (F4) · el héroe.
//
// Lo que sostiene, y ninguna de las cuatro es «que el héroe exista»:
//
//   ① NINGUNA CIFRA SIN PROCEDENCIA. Toda cifra de la copia del héroe está censada con de dónde
//      sale; una nueva sin entrada pone la suite en rojo nombrándola. Y las que hoy están SIN
//      FUENTE llevan trinquete: no pueden crecer.
//   ② CERO CLIENTE INVENTADO. Con cero clientes pagando, un testimonio no es marketing agresivo:
//      es falso. Se vigila por patrón, en el héroe vivo y en la propuesta.
//   ③ REGLA 30 EN LAS DOS DIRECCIONES. Lo que el fundador no ha aprobado no se pinta — y lo
//      aprobado no puede quedarse a medias.
//   ④ EL POSICIONAMIENTO NO SE TOCA. La propuesta copia el eyebrow y el h1 letra a letra del
//      héroe vivo (máster A22); si alguien los cambia «de paso», rojo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditarCifras, bloqueHeroe, textoDeCopia, cifrasDeCopia, claveDeCifra,
  CENSO, SIN_FUENTE_MAX,
} from '../scripts/_cifras-heroe.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(RAIZ, 'public', 'index.html'), 'utf8');

/** El bloque de la propuesta de F4 (la sección `hidden`). */
function bloquePropuesta(texto = html) {
  const i = texto.indexOf('<section class="hero" id="heroe-f4"');
  if (i === -1) return null;
  const j = texto.indexOf('</section>', i);
  return j === -1 ? null : texto.slice(i, j + 10);
}

/** Texto publicado de un bloque: sin comentarios y sin etiquetas. */
function publicado(bloque) {
  return String(bloque ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
}

// ── ① LAS CIFRAS ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-331 · 🔴 SUELO: si el extractor no lee el héroe, se declara CIEGO (no «no hay cifras»)', () => {
  assert.equal(auditarCifras('<html><body>sin heroe</body></html>').ciego, true,
    '🔴 sin `<section class="hero">` ha contestado como si hubiera mirado');
  assert.equal(auditarCifras('<section class="hero"><div></div></section>').ciego, true,
    '🔴 con un héroe vacío devuelve un censo en verde: «el héroe no tiene cifras» y «el extractor ' +
    'dejó de reconocerlas» son la misma lista vacía y consecuencias opuestas.');

  const real = auditarCifras(html);
  assert.equal(real.ciego, false, '🔴 no sabe leer el héroe REAL: ' + real.motivo);
  assert.ok(real.cifras.length >= 1,
    '🔴 cero cifras en el héroe real. Si de verdad se han retirado todas, este suelo sobra y hay ' +
    'que quitarlo con su motivo; mientras haya alguna, un cero aquí es el extractor roto.');
});

test('SCRUM-331 · 🔴 ninguna cifra del héroe sin PROCEDENCIA escrita', () => {
  const { sinCenso, cifras } = auditarCifras(html);
  assert.deepEqual(sinCenso, [],
    '🔴 HAY UNA CIFRA EN EL HÉROE QUE NADIE HA DECLARADO: ' + sinCenso.join(', ') +
    '\n   Un número en el héroe sin fuente es la peor clase de dato: quien lo lee no tiene forma ' +
    'de saber que nadie lo midió. O se le escribe la procedencia en `scripts/_cifras-heroe.mjs`, ' +
    'o no se pinta.\n   (cifras leídas: ' + cifras.join(' · ') + ')');
});

test('SCRUM-331 · 🔴 TRINQUETE: las cifras SIN FUENTE no pueden crecer', () => {
  const { sinFuente } = auditarCifras(html);
  assert.ok(sinFuente.length <= SIN_FUENTE_MAX,
    '🔴 el héroe ha ganado una cifra sin fuente: ' + sinFuente.join(', ') + '. El tope es ' +
    SIN_FUENTE_MAX + ' y baja, nunca sube.');
  for (const k of sinFuente) {
    assert.ok(CENSO[k].sinFuente && CENSO[k].sinFuente.length > 40,
      '🔴 «' + k + '» está marcada sin fuente pero sin explicar por qué. Una marca sin motivo se ' +
      'borra el día que estorbe.');
    assert.ok(CENSO[k].decide,
      '🔴 «' + k + '» no dice QUIÉN lo decide. Un pendiente sin dueño no se resuelve nunca.');
  }
});

test('SCRUM-331 · AUTOPRUEBA: el detector VE una cifra nueva (si no, el trinquete no vigila nada)', () => {
  // El fixture se parece a un héroe de verdad (el suelo exige copia, no un fragmento suelto):
  // si fuese más corto, el detector lo declararía CIEGO y esta autoprueba mediría el suelo, no el
  // trinquete.
  const sintetico = '<section class="hero"><h1>Del presupuesto al cobro, sin salir de WhatsApp.</h1>' +
    '<p class="sub">Ya lo usan 340 profesionales de toda España y facturan sin perseguir a nadie.</p></section>';
  const r = auditarCifras(sintetico);
  assert.equal(r.ciego, false);
  assert.ok(r.sinCenso.map(claveDeCifra).some((c) => c.startsWith('340')),
    '🔴 el detector no ha visto un «340» metido en la copia: entonces el verde de arriba no ' +
    'significa «no hay cifras sin fuente», significa «no supe buscarlas».');
});

// ── ② CERO CLIENTE INVENTADO ─────────────────────────────────────────────────────────────────

test('SCRUM-331 · 🔴 ni un testimonio, ni un logo, ni un «más de X profesionales»', () => {
  // Con cero clientes pagando (medido en SCRUM-327/330: el contador solo cuenta suscripción
  // activa, y hoy no pinta nada), cualquiera de estos sería falso, no agresivo.
  const zonas = [['héroe vivo', bloqueHeroe(html)], ['propuesta F4', bloquePropuesta()]];
  const PROHIBIDOS = [
    /m[aá]s de\s+[0-9]/i,
    /[0-9][0-9.]*\s*(profesionales|clientes|usuarios|fontaneros|electricistas)/i,
    /(profesionales|clientes|usuarios)\s+(ya\s+)?(conf[ií]an|nos\s+eligen|lo\s+usan)/i,
    /valorad[oa]|opiniones|rese[ñn]as de clientes|testimonio/i,
    /★|⭐|[0-9][.,][0-9]\s*\/\s*5/,
  ];
  for (const [nombre, bloque] of zonas) {
    if (!bloque) continue;
    const t = publicado(bloque);
    for (const re of PROHIBIDOS) {
      assert.doesNotMatch(t, re,
        '🔴 el ' + nombre + ' contiene prueba social de clientes (' + re + '). Hoy no hay clientes ' +
        'pagando: eso no es marketing, es falso. La ausencia de prueba social no se disimula, se ' +
        'sustituye por DEMOSTRACIÓN.');
    }
  }
});

test('SCRUM-331 · regla 26: el héroe no habla de VeriFactu ni de Hacienda, ni con sinónimos', () => {
  const t = publicado(bloqueHeroe(html)) + ' ' + publicado(bloquePropuesta());
  assert.doesNotMatch(t, /veri\s*\*?\s*factu|aeat|hacienda|rrsif|declaraci[oó]n responsable/i,
    '🔴 el héroe menciona la fiscalidad. Esa pregunta se contesta SOLO con el guion H2 (regla 26), ' +
    'y no en el héroe.');
});

// ── ③ REGLA 30, EN LAS DOS DIRECCIONES ───────────────────────────────────────────────────────

test('SCRUM-331 · 🔴 la propuesta del héroe NO se pinta mientras el microcopy esté pendiente', () => {
  const bloque = bloquePropuesta();
  assert.ok(bloque, '🔴 no está la propuesta `#heroe-f4` en public/index.html');
  const apertura = bloque.slice(0, bloque.indexOf('>') + 1);
  if (apertura.includes('PENDIENTE_FUNDADOR')) {
    assert.match(apertura, /\shidden(\s|>)/,
      '🔴 la propuesta del héroe está marcada como PENDIENTE y NO lleva `hidden`: se le estaría ' +
      'enseñando al visitante la frase más importante del producto sin que el fundador la haya ' +
      'aprobado. El copy de la landing ES el máster (A22 + regla 30).');
  } else {
    assert.ok(!bloque.includes('PENDIENTE'),
      '🔴 la propuesta ya no lleva el marcador en su etiqueta pero sí en el cuerpo: media ' +
      'aprobación no es una aprobación.');
  }
});

test('SCRUM-331 · 🔴 no puede haber DOS héroes visibles a la vez', () => {
  const visibles = [];
  const re = /<section class="hero"([^>]*)>/g;
  let m;
  while ((m = re.exec(html)) !== null) if (!/\shidden(\s|$)/.test(m[1])) visibles.push(m[1].trim() || '(el vivo)');
  assert.equal(visibles.length, 1,
    '🔴 hay ' + visibles.length + ' héroes sin `hidden`: ' + visibles.join(' | ') +
    '\n   Al aprobar la propuesta se SUSTITUYE el héroe vivo, no se añade otro debajo.');
});

// ── ④ EL POSICIONAMIENTO NO SE TOCA ──────────────────────────────────────────────────────────

test('SCRUM-331 · 🔴 la propuesta copia el posicionamiento LETRA A LETRA (máster A22)', () => {
  const vivo = bloqueHeroe(html);
  const prop = bloquePropuesta();
  const saca = (b, re) => { const m = b.match(re); return m ? m[1].trim() : null; };

  const eyebrowVivo = saca(vivo, /<span class="eyebrow">([\s\S]*?)<\/span>/);
  const eyebrowProp = saca(prop, /<span class="eyebrow">([\s\S]*?)<\/span>/);
  const h1Vivo = saca(vivo, /<h1>([\s\S]*?)<\/h1>/);
  const h1Prop = saca(prop, /<h1>([\s\S]*?)<\/h1>/);

  assert.ok(eyebrowVivo && h1Vivo, '🔴 no se pudo leer el posicionamiento del héroe vivo');
  assert.equal(eyebrowProp, eyebrowVivo,
    '🔴 la propuesta ha cambiado el EYEBREW del posicionamiento. Está decidido en el máster (A22, ' +
    'seis iteraciones de prototipo) y este ticket trabaja DENTRO de él, no contra él.');
  assert.equal(h1Prop, h1Vivo,
    '🔴 la propuesta ha cambiado el H1. Igual: A22 no se toca en F4.');
});

test('SCRUM-331 · la propuesta apunta a la demo, y la demo EXISTE', () => {
  const prop = bloquePropuesta();
  const hrefs = [];
  const re = /<a[^>]+href="([^"]+)"/g;
  let m;
  while ((m = re.exec(prop)) !== null) hrefs.push(m[1]);
  assert.ok(hrefs.includes('#probar'),
    '🔴 la propuesta no lleva a la demo. Con cero clientes, la demostración ES la prueba: si el ' +
    'héroe no lleva a ella, la propuesta no hace lo que dice hacer.');
  for (const h of hrefs) {
    if (h.startsWith('#')) {
      assert.ok(html.includes('id="' + h.slice(1) + '"'), '🔴 el ancla ' + h + ' no existe en la página');
    } else if (h.startsWith('/')) {
      assert.ok(fs.existsSync(path.join(RAIZ, 'public', h.split('?')[0])),
        '🔴 ' + h + ' no existe → 404 desde el héroe');
    }
  }
});

test('SCRUM-331 · la propuesta no introduce ni una cifra nueva', () => {
  const cifras = cifrasDeCopia(textoDeCopia(bloquePropuesta())).map(claveDeCifra);
  const fuera = cifras.filter((c) => !(c in CENSO));
  assert.deepEqual(fuera, [],
    '🔴 la propuesta del héroe trae cifras sin censar: ' + fuera.join(', '));
  // Y la que no tiene fuente NO puede aparecer en la propuesta: es justo la que viene a retirar.
  const sinFuente = Object.entries(CENSO).filter(([, v]) => v.sinFuente).map(([k]) => k);
  for (const s of sinFuente) {
    assert.ok(!cifras.includes(s),
      '🔴 la propuesta reintroduce «' + s + '», que es la cifra sin fuente que venía a quitar.');
  }
});
