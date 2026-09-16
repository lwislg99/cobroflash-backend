// tests/scrum349-copy-no-comentarios.test.mjs — SCRUM-349
//
// EL TRINQUETE DE SCRUM-299 ESCANEABA LOS COMENTARIOS COMO SI FUERAN COPY.
//
// Medido antes de tocar nada: de los 99.496 bytes de `src/` que ese censo escanea, **24.466 (24,6%)
// son comentarios** — 281 bloques en 9 ficheros. Un comentario no llega a ninguna pantalla, así que
// ahí el guard no vigilaba copy: vigilaba prosa de programador.
//
// Y con víctima, una y con nombre: `lifecycle.service.ts:156` explica por qué el texto de al lado no
// enumera el documento fiscal, y **para explicarlo no puede nombrarlo**. Dice «NO usa el posesivo
// del documento fiscal» donde lo claro sería «NO dice "tus facturas"». Medido: la versión clara pone
// el guard en ROJO. La circunlocución no es estilo — es el peaje.
//
//   **Un guard que obliga a escribir peor las explicaciones para no despertarlo cobra un impuesto
//   sobre la claridad del código.**
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// EL ROJO QUE DECIDE, y es UNA SOLA PRUEBA CON DOS MITADES:
//
//   ① un comentario que EXPLICA la prohibición y contiene sus palabras NO puede caer;
//   ② un literal que LLEGA A PANTALLA con esas mismas palabras SÍ tiene que caer.
//
// Si el guard no distingue esas dos, no está arreglado: está movido. Por eso las dos mitades usan
// **el mismo texto**, cambiando solo dónde vive.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  recolectarCopyPublico,
  promesasDeFactura,
  enmascararNoPantalla,
  literalesDeJs,
} from './_copy-publico.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const noBlancos = (s) => (s.match(/\S/g) || []).length;

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-349 · SUELO: el extractor ENCUENTRA literales (si no, aprobaría por ceguera)', () => {
  // Enmascarar es peligroso justo por aquí: un extractor que devuelve todo en blanco deja el censo
  // sin nada que mirar y el trinquete en verde para siempre. «No supe leer» y «no hay copy» son el
  // mismo silencio. Se exige que encuentre literales, no que no falle.
  const corpus = recolectarCopyPublico(RAIZ);
  assert.ok(corpus.length >= 10, `🔴 censo de ${corpus.length} ficheros: no está recorriendo`);

  const total = corpus.reduce((a, c) => a + noBlancos(c.texto), 0);
  assert.ok(total > 10_000,
    `🔴 el extractor solo deja ${total} caracteres en TODO el corpus. Eso no es copy: es un censo ` +
    'vacío con otra forma.');

  const codigo = corpus.filter((c) => /\.(ts|js)$/.test(c.rel) && c.bruto.length > 500);
  assert.ok(codigo.length >= 5, `🔴 solo ${codigo.length} ficheros de código en el censo: no llega`);
  for (const c of codigo) {
    assert.ok(noBlancos(c.texto) > 0,
      `🔴 ${c.rel} (${c.bruto.length} bytes) se quedó SIN UN SOLO LITERAL. O el fichero no tiene ` +
      'copy —y entonces no pinta en este censo— o el parseo falló en silencio.');
    assert.notEqual(literalesDeJs(c.bruto), null, `🔴 ${c.rel} no se pudo parsear: el extractor está ciego ahí`);
  }
});

test('SCRUM-349 · SUELO: enmascarar NO mueve una sola línea', () => {
  // Un número de línea que miente es peor que no darlo: manda a alguien a mirar la línea equivocada
  // y a concluir que el guard se equivoca. Por eso se enmascara con espacios del mismo largo en vez
  // de recortar el texto.
  for (const { rel, texto, bruto } of recolectarCopyPublico(RAIZ)) {
    assert.equal(texto.length, bruto.length, `🔴 ${rel}: el enmascarado cambió el LARGO del texto`);
    assert.equal(texto.split('\n').length, bruto.split('\n').length,
      `🔴 ${rel}: el enmascarado cambió el NÚMERO DE LÍNEAS — los `+'`:linea`'+` que reporte serán falsos`);
  }
});

test('SCRUM-349 · el censo SÍ mira comentarios antes de enmascarar (o no habría nada que arreglar)', () => {
  // Control de que el defecto existía: si `bruto` y `texto` fueran iguales, este ticket no tendría
  // objeto y el resto de asertos aprobarían sin significar nada.
  const corpus = recolectarCopyPublico(RAIZ);
  const conRecorte = corpus.filter((c) => noBlancos(c.texto) < noBlancos(c.bruto));
  assert.ok(conRecorte.length >= 5,
    `🔴 solo ${conRecorte.length} ficheros pierden algo al enmascarar. El extractor no está quitando ` +
    'nada: seguiría escaneando el fichero entero.');

  const src = corpus.filter((c) => c.rel.startsWith('src/') && c.bruto.length > 500);
  const bruto = src.reduce((a, c) => a + noBlancos(c.bruto), 0);
  const copy = src.reduce((a, c) => a + noBlancos(c.texto), 0);
  assert.ok(copy < bruto / 2,
    `🔴 en src/ el enmascarado deja ${copy} de ${bruto} caracteres. Se esperaba MUCHO menos: el ` +
    'grueso de esos ficheros es código y comentario, no copy.');
});

// ── EL ROJO QUE DECIDE ───────────────────────────────────────────────────────────────────────────

// Las mismas palabras prohibidas, en las dos posiciones. Cada pareja es un caso.
const CASOS = [
  {
    nombre: 'posesivo del cliente',
    frase: 'Aquí tienes tu factura, ya puedes pagarla',
    comentario: (f) => `// Regla 26: al cliente final JAMÁS se le dice «${f}» — hasta SIF-1 es un justificante.\nconst x = 1;\n`,
    literal: (f) => `const html = '<p>${f}</p>';\n`,
    ext: '.ts',
  },
  {
    nombre: 'verbo de entrega',
    frase: 'Recibes la factura en tu correo',
    comentario: (f) => `/**\n * NO escribir «${f}»: el documento post-pago es J-.\n */\nexport const y = 2;\n`,
    literal: (f) => 'export const y = `<p>' + f + '</p>`;\n',
    ext: '.ts',
  },
  {
    nombre: 'documento numerado',
    frase: 'Factura #F-128',
    comentario: (f) => `// El copy prohibido es del tipo «${f}»; aquí va el número de justificante.\nconst z = 3;\n`,
    literal: (f) => `const z = "${f}";\n`,
    ext: '.js',
  },
];

test('SCRUM-349 · 🔴 ① un COMENTARIO que explica la prohibición y usa sus palabras NO cae', () => {
  for (const c of CASOS) {
    const fuente = c.comentario(c.frase);
    // Sin enmascarar, el guard viejo lo cazaba: esa es la mitad que se está quitando.
    assert.ok(promesasDeFactura(fuente).length > 0,
      `🔴 (control) el caso «${c.nombre}» ya no cae ni SIN enmascarar: el texto de prueba dejó de ` +
      'reproducir el defecto, así que este test no probaría nada.');

    assert.deepEqual(promesasDeFactura(enmascararNoPantalla(fuente, `x${c.ext}`)), [],
      `🔴 EL COMENTARIO SIGUE CAYENDO («${c.nombre}»). Un comentario no llega a ninguna pantalla: ` +
      'obligar a redactarlo esquivando las palabras que explica es cobrar un impuesto sobre la ' +
      'claridad del código.');
  }
});

test('SCRUM-349 · 🔴 ② el MISMO texto como literal que llega a pantalla SÍ cae', () => {
  for (const c of CASOS) {
    const p = promesasDeFactura(enmascararNoPantalla(c.literal(c.frase), `x${c.ext}`));
    assert.ok(p.length > 0,
      `🔴 EL LITERAL YA NO CAE («${c.nombre}»). Entonces el guard no está arreglado, está APAGADO: ` +
      'lo único que tenía que seguir vigilando es exactamente esto.');
  }
});

test('SCRUM-349 · 🔴 y lo mismo dentro de un <script> de una página (el agujero no se muda al HTML)', () => {
  const frase = 'Aquí tienes tu factura';
  // 🔴 El comentario HTML estaba SIN CUBRIR hasta que un sabotaje lo destapó: quitar el enmascarado
  // de `<!-- -->` no ponía rojo a nadie, porque hoy ningún comentario de `public/` dice «factura» y
  // el corpus real no reproducía el caso. Un guard sin caso de prueba no está vigilando: está
  // esperando a que alguien escriba el comentario que lo despierte.
  const comentarioHtml = `<html><body>\n<!-- Ojo: nunca poner «${frase}» aquí; es un justificante -->\n<p>Hola</p></body></html>`;
  const conComentario = `<html><body><script>\n// prohibido escribir «${frase}» en el copy\nconst a = 1;\n</script></body></html>`;
  const conLiteral = `<html><body><script>\nconst a = '<p>${frase}</p>';\n</script></body></html>`;
  const enElCuerpo = `<html><body><p>${frase}</p></body></html>`;

  assert.ok(promesasDeFactura(comentarioHtml).length > 0,
    '🔴 (control) el comentario HTML de prueba ya no dispara sin enmascarar: no reproduce el caso');
  assert.deepEqual(promesasDeFactura(enmascararNoPantalla(comentarioHtml, 'x.html')), [],
    '🔴 un comentario `<!-- -->` sigue cayendo: una nota al maquetador no llega a ninguna pantalla');

  assert.deepEqual(promesasDeFactura(enmascararNoPantalla(conComentario, 'x.html')), [],
    '🔴 un comentario DENTRO de un <script> sigue cayendo: el agujero solo se mudó de `src/` al HTML');
  assert.ok(promesasDeFactura(enmascararNoPantalla(conLiteral, 'x.html')).length > 0,
    '🔴 un literal dentro de un <script> ya no cae: eso sí es copy que llega a pantalla');
  assert.ok(promesasDeFactura(enmascararNoPantalla(enElCuerpo, 'x.html')).length > 0,
    '🔴 el texto del <body> ya no cae: se ha enmascarado la página entera');
});

// ── LA VÍCTIMA MEDIDA ────────────────────────────────────────────────────────────────────────────

test('SCRUM-349 · la explicación de lifecycle.service.ts YA PUEDE decirse en plano', () => {
  // El caso que motivó el ticket, sobre el fichero REAL y sin tocarlo: se le inyecta en memoria la
  // versión clara del comentario —la que hoy no se puede escribir— y el guard tiene que aguantar.
  const rel = 'src/modules/messaging/domain/lifecycle.service.ts';
  const abs = path.join(RAIZ, rel);
  const bruto = fs.readFileSync(abs, 'utf8');

  const ancla = '      // Día 12 — 2 días antes de expirar.';
  assert.ok(bruto.includes(ancla), `🔴 no encuentro el ancla en ${rel}: el test no está midiendo lo que cree`);

  const claro = `      // La enumeración NO dice «tus facturas» a propósito: hasta SIF-1 el documento\n` +
                `      // post-pago es un justificante, no una factura (reglas 24/26).\n`;
  const conExplicacion = bruto.replace(ancla, claro + ancla);
  assert.notEqual(conExplicacion, bruto, '🔴 LA INYECCIÓN NO SE APLICÓ: no probaría nada');

  assert.ok(promesasDeFactura(conExplicacion).length > 0,
    '🔴 (control) esa explicación ya no dispara ni sin enmascarar — el guard viejo no la cazaría y ' +
    'este test habría dejado de reproducir el peaje que documenta.');

  assert.deepEqual(promesasDeFactura(enmascararNoPantalla(conExplicacion, rel)), [],
    `🔴 ${rel} SIGUE sin poder explicarse en plano. El impuesto sobre la claridad no se ha levantado.`);

  // Y el copy de verdad de ese mismo fichero sigue vigilado: si alguien mete la promesa en el email,
  // cae. Se comprueba sobre el fichero real para que no sea una afirmación sobre un ejemplo.
  const conPromesa = bruto.replace('El resto del panel sigue funcionando', 'Aquí tienes tu factura');
  assert.notEqual(conPromesa, bruto, '🔴 LA INYECCIÓN NO SE APLICÓ: el ancla del copy cambió');
  assert.ok(promesasDeFactura(enmascararNoPantalla(conPromesa, rel)).length > 0,
    '🔴 una promesa metida en el COPY de ese email ya no cae: el guard se apagó donde importaba');
});
