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

// ⚠️ SCRUM-1016 (14-oct-2026): esto era una lista negra ABSOLUTA, más estricta que la regla que
// decía implementar. La regla 26 del máster (`docs/YAQU_MASTER.md`, Parte I) se enmendó el 22-sep
// (firma en SCRUM-1016 c.16432) y permite nombrar VeriFactu, la AEAT, Hacienda, el RRSIF o la
// declaración responsable si se cumplen a la vez (a) cita literal firmada en el máster, (b) el
// matiz en la MISMA unidad visible y (c) ticket con la firma. Aquí se comprueban (a) y (b); la (c)
// vive en Jira y no la lee un test. Lo que se deriva del texto de la regla, no de este fichero:
//   · (b) «sin que el lector tenga que bajar a otro BLOQUE» → la unidad es el texto que hay entre
//     dos fronteras de bloque HTML. Un <span>/<b>/<a> no corta; un <p>, un <h1> o un <div> sí. Un
//     matiz en el <p> de al lado está en OTRO bloque, aunque lo envuelva el mismo <div>.
//   · (b) «el estado real (remisión no construida, sin certificación, declaración responsable
//     pendiente)» → esos tres, y sólo esos, son el matiz. «En camino» o «pronto» no lo son.
//   · (a) «cita literal de una frase ya firmada en este máster» → cada cláusula que nombra un
//     término regulado tiene que estar, letra a letra, en el máster. Se mide por cláusula porque
//     es lo que se firmó (1016i, «cláusula por cláusula»; firma c.16564).
//   · «sigue prohibido decir "VeriFactu listo" o "cumple con Hacienda"» → siempre rojo, aunque el
//     máster los contenga (los contiene, como prohibidos: por eso (a) sola no basta).
const FISCAL_RE = /veri\s*\*?\s*factu|aeat|hacienda|rrsif|declaraci[oó]n\s+responsable/i;
const MATIZ_RE = [
  /remisi[oó]n\b[^.;]{0,40}?\bno\s+est[aá]\s+construida/i,
  /sin\s+certificaci[oó]n|no\s+existe\s+(?:ninguna\s+|una\s+)?[«"]?certificaci[oó]n/i,
  /declaraci[oó]n\s+responsable\b[^.;]{0,40}?\bpendiente|\bpendiente\b[^.;]{0,40}?declaraci[oó]n\s+responsable/i,
];
const PROHIBIDO_SIEMPRE = /veri\s*\*?\s*factu\s+list[oa]|cumple\s+con\s+hacienda/i;
const INLINE = new Set(['span', 'a', 'b', 'strong', 'em', 'i', 'small', 'mark', 'abbr', 'code',
  'sub', 'sup', 'br', 'wbr', 'time', 'q', 's', 'u']);
const plano = (s) => s.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const MASTER = plano(fs.readFileSync(path.join(RAIZ, 'docs', 'YAQU_MASTER.md'), 'utf8'));

/** Texto de cada unidad visible: lo que queda entre dos fronteras de bloque. */
function unidades(bloque) {
  const out = [];
  let actual = '';
  const sinComent = String(bloque ?? '').replace(/<!--[\s\S]*?-->/g, ' ');
  for (const trozo of sinComent.split(/(<\/?[a-zA-Z][^>]*>)/)) {
    const m = trozo.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/);
    if (!m) { actual += trozo; continue; }
    if (INLINE.has(m[1].toLowerCase())) { actual += ' '; continue; }
    if (actual.trim()) out.push(actual.replace(/\s+/g, ' ').trim());
    actual = '';
  }
  if (actual.trim()) out.push(actual.replace(/\s+/g, ' ').trim());
  return out;
}

/** Las menciones de fiscalidad de un bloque que NO cumplen la regla 26, con el motivo. */
function infraccionesRegla26(bloque) {
  const malas = [];
  for (const u of unidades(bloque)) {
    if (!FISCAL_RE.test(u)) continue;
    if (PROHIBIDO_SIEMPRE.test(u)) { malas.push('«' + u + '» → dice lo que la regla 26 sigue prohibiendo'); continue; }
    if (!MATIZ_RE.some((re) => re.test(u))) malas.push('«' + u + '» → (b) sin el matiz en la MISMA unidad');
    for (const c of u.split(/[.;:,—]/)) {
      if (!FISCAL_RE.test(c)) continue;
      // Una palabra suelta («AEAT») está en el máster por fuerza: eso no es citar una frase. El
      // mínimo de 5 palabras NO sale de la regla 26, es de este guard: dicho en SCRUM-1016.md.
      if (plano(c).split(' ').length < 5) malas.push('«' + c.trim() + '» → (a) demasiado corto para ser una cita');
      else if (!MASTER.includes(plano(c))) malas.push('«' + c.trim() + '» → (a) no es cita literal del máster');
    }
  }
  return malas;
}

test('SCRUM-331 · regla 26: el héroe sólo nombra la fiscalidad con cita literal del máster y su matiz en la MISMA unidad', () => {
  const malas = [];
  for (const [nombre, bloque] of [['héroe vivo', bloqueHeroe(html)], ['propuesta F4', bloquePropuesta()]]) {
    for (const x of infraccionesRegla26(bloque)) malas.push(nombre + ': ' + x);
  }
  assert.deepEqual(malas, [],
    '🔴 el héroe nombra la fiscalidad sin cumplir la regla 26 del máster:\n   ' + malas.join('\n   ') +
    '\n   Sólo vale (a) una cláusula copiada letra a letra del máster, (b) con «remisión no ' +
    'construida», «sin certificación» o «declaración responsable pendiente» en el MISMO bloque, ' +
    'y (c) la firma del fundador sobre ese literal en Jira. Si no, no se pinta.');
});

test('SCRUM-331 · AUTOPRUEBA regla 26: cae sin matiz o sin cita, y deja pasar el subtítulo firmado', () => {
  const heroe = (dentro) => '<section class="hero"><div class="wrap"><div>' + dentro + '</div></div></section>';
  // Firmado por el fundador: SCRUM-1016 c.16564, ratificado en c.19607 («Ok firmamos»).
  const FIRMADO = '<h1 id="reg-hero">Del presupuesto a la firma, <span class="hl">sin salir de WhatsApp.</span></h1>' +
    '<p class="sub">Crea el presupuesto en 30 segundos y tu cliente lo firma desde el móvil por WhatsApp. ' +
    'Hoy generamos cada registro de facturación con el formato oficial de la AEAT; la remisión a ' +
    'Hacienda todavía no está construida, y los founding la estrenaréis sin cambio de precio.</p>';
  assert.deepEqual(infraccionesRegla26(heroe(FIRMADO)), [],
    '🔴 el guard tumba el subtítulo que el fundador firmó y que cumple (a) y (b): vuelve a ser la lista negra');

  const casos = [
    ['AEAT sin ningún matiz',
      '<p class="sub">Hoy generamos cada registro de facturación con el formato oficial de la AEAT.</p>', '(b)'],
    ['el matiz en el <p> de al lado, no en el mismo bloque',
      '<h1>Hoy generamos cada registro de facturación con el formato oficial de la AEAT</h1>' +
      '<p class="sub">La remisión a Hacienda todavía no está construida.</p>', '(b)'],
    ['un «matiz» que la regla no nombra',
      '<p>Hoy generamos cada registro de facturación con el formato oficial de la AEAT; Hacienda, muy pronto.</p>', '(b)'],
    ['con matiz, pero redacción nueva (no está en el máster)',
      '<p>Mandamos tus facturas a la AEAT; la remisión a Hacienda todavía no está construida.</p>', '(a)'],
    ['la palabra suelta, que está en el máster sólo por ser una palabra',
      '<p>Lo de la AEAT, AEAT. La remisión a Hacienda todavía no está construida.</p>', '(a) demasiado corto'],
    ['lo que la regla sigue prohibiendo, aunque el máster lo cite',
      '<p>Cumple con Hacienda; la remisión a Hacienda todavía no está construida.</p>', 'prohibiendo'],
  ];
  for (const [que, dentro, motivo] of casos) {
    const r = infraccionesRegla26(heroe(dentro));
    assert.ok(r.some((x) => x.includes(motivo)),
      '🔴 «' + que + '» no cae por ' + motivo + ' (dijo: ' + JSON.stringify(r) + '). Si esto pasa, ' +
      'el verde de arriba es una lista vaciada, no la regla 26.');
  }
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
  // ⚠️ SCRUM-546: el patrón era `<h1>` con el `>` pegado. SCRUM-543 le puso `id="reg-hero"` al h1
  // del héroe vivo —es lo que hace que la sección se anuncie como región con su propio titular— y
  // este `saca` devolvió `null`, con lo que el test cayó por «no se pudo leer», no por una
  // diferencia de copy. Se aceptan atributos en la etiqueta; lo que se compara sigue siendo el
  // TEXTO del h1, que es lo que este test vigila.
  const h1Vivo = saca(vivo, /<h1[^>]*>([\s\S]*?)<\/h1>/);
  const h1Prop = saca(prop, /<h1[^>]*>([\s\S]*?)<\/h1>/);

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
