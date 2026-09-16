// tests/scrum400-conformidad-landing.test.mjs — SCRUM-400
//
// La landing no puede afirmar un estado de conformidad sin un documento EMITIDO detrás.
// El 7-ago-2026 decía «está construida y en certificación — con declaración responsable del
// productor» mientras ese documento era una plantilla con placeholders y con la cabecera
// «NO publicar». No es una regla nueva: la entrada A4.1 del máster ya lo prohibía.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  afirmacionesDeConformidad, documentoEmitido, comprobar, comprobarEnDisco,
  textoPublicado, PAGINAS, DOCUMENTO,
} from '../scripts/_guard-conformidad-landing.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// El texto EXACTO que estaba publicado, para que este test siga hablando del caso real.
const FRASE_RETIRADA = 'Te contesto como fabricante: la facturación VeriFactu está construida y en ' +
  'certificación — con declaración responsable del productor, que es lo que tu gestor te pedirá.';
const INSIGNIA_RETIRADA = 'Facturación <b>VeriFactu en certificación</b>';

const PLANTILLA_NO_EMITIDA = `# Declaración Responsable
> **PLANTILLA — S1-E.** Borrador con placeholders […] y marcas **[VALIDAR ASESOR]**.
> **NO publicar ni entregar a merchants hasta:** (1) SIF-1 8/8, (2) revisión del asesor.
### 1. Productor del sistema
Nombre: [RAZÓN SOCIAL]  ·  NIF: [NIF]`;

const DOC_EMITIDO = `# Declaración Responsable
Conforme al artículo 13 del Real Decreto 1007/2023.
### 1. Productor del sistema
Nombre: YaQu SL  ·  NIF: B12345678  ·  Versión: 1.0  ·  Fecha: 7-ago-2026`;

// ── ① EL CASO REAL ───────────────────────────────────────────────────────────────────────

test('SCRUM-400 · 🔴 la frase publicada CAE, nombrándola y diciendo por qué', () => {
  const r = comprobar({
    paginas: [{ ruta: 'public/index.html', html: `<p>${FRASE_RETIRADA}</p>` }],
    documento: PLANTILLA_NO_EMITIDA,
  });
  assert.equal(r.ok, false,
    '🔴 EL GUARD DEJÓ PASAR LA FRASE EXACTA QUE SE RETIRÓ HOY. Es el caso que existe para cazar.');
  assert.match(r.salida, /declaración responsable del productor/,
    '🔴 no NOMBRA la afirmación: sin la cita, quien lo lea no sabe qué frase quitar');
  assert.match(r.salida, /NO EMITIDO|no está emitido/i, '🔴 no dice que el problema es el documento');
  assert.match(r.salida, /placeholder|NO publicar|PLANTILLA/i, '🔴 no dice POR QUÉ no está emitido');
});

test('SCRUM-400 · 🔴 la insignia retirada también cae', () => {
  const r = comprobar({
    paginas: [{ ruta: 'public/index.html', html: `<div>${INSIGNIA_RETIRADA}</div>` }],
    documento: PLANTILLA_NO_EMITIDA,
  });
  assert.equal(r.ok, false);
  assert.match(r.salida, /VeriFactu en certificación/);
});

// ── ② CONTROL POSITIVO: no vale bloquearlo todo ──────────────────────────────────────────

test('SCRUM-400 · CONTROL POSITIVO: el copy legítimo de la landing SIGUE pasando', () => {
  // Todo esto está publicado hoy y NO es una afirmación de conformidad.
  const legitimo = `
    <p>Clientes, gastos, facturas y bot — todo en un sitio.</p>
    <p>Y llevas clientes, gastos y facturas en el mismo sitio.</p>
    <p>Sin permanencia. Tus datos son tuyos: clientes, presupuestos, facturas, cobros,
       trabajos y gastos se exportan en CSV cuando quieras.</p>
    <p>YaQu actúa como encargado del tratamiento conforme a nuestra Política de Privacidad.</p>
    <p>Se conservan durante el plazo legal, conforme al artículo 30 del Código de Comercio.</p>`;
  const r = comprobar({ paginas: [{ ruta: 'public/index.html', html: legitimo }], documento: PLANTILLA_NO_EMITIDA });
  assert.equal(r.ok, true,
    `🔴 bloqueó copy legítimo: ${r.salida}. Un guard que bloquea todo se desactiva, y entonces no ` +
    'protege de nada. Ojo a los dos «conforme» de las páginas legales: son conformidad de OTRA cosa.');
});

// ── ③ EL OTRO SENTIDO — lo que distingue vigilar el DOCUMENTO de vigilar la PALABRA ──────

test('SCRUM-400 · 🔴 con el documento EMITIDO, la misma frase PASA', () => {
  // R1 y R3 juntos son los que demuestran que el guard mira el hecho y no el vocabulario.
  const r = comprobar({
    paginas: [{ ruta: 'public/index.html', html: `<p>${FRASE_RETIRADA}</p>` }],
    documento: DOC_EMITIDO,
  });
  assert.equal(r.ok, true,
    '🔴 el guard sigue bloqueando con el documento YA EMITIDO. Entonces no vigila la conformidad: ' +
    'vigila la palabra, y el día que la declaración se firme habrá que desactivarlo — que es como ' +
    'mueren los guards.');
  assert.match(r.salida, /EMITIDO/);
});

test('SCRUM-400 · qué hace que un documento esté emitido, una condición por una', () => {
  assert.equal(documentoEmitido(DOC_EMITIDO).emitido, true);
  for (const [motivo, doc] of Object.entries({
    // Placeholders, [VALIDAR ASESOR] y «NO publicar» cuentan EN CUALQUIER PARTE del documento.
    'placeholder en el cuerpo': DOC_EMITIDO + '\nNIF: [POR RELLENAR]',
    'aviso de no publicar al final': DOC_EMITIDO + '\n> NO publicar todavía.',
    'validar asesor': DOC_EMITIDO + '\n[VALIDAR ASESOR]',
    // «PLANTILLA» solo cuenta en la CABECERA (ver el test del pie de procedencia, abajo).
    'se declara plantilla en la cabecera': '# Declaración\n> **PLANTILLA.**\n\n' + DOC_EMITIDO,
  })) {
    assert.equal(documentoEmitido(doc).emitido, false, `🔴 se dio por emitido con: ${motivo}`);
  }
  // Un enlace markdown NO es un placeholder sin rellenar.
  assert.equal(documentoEmitido(DOC_EMITIDO + '\nVer [el reglamento](https://x.es).').emitido, true,
    '🔴 confundió un enlace markdown con un placeholder: haría imposible emitir el documento');
});

test('SCRUM-400 · «plantilla» en el PIE no impide emitir; en la CABECERA sí', () => {
  // Lo destapó la prueba de rojo R3. El documento real acaba con «*Plantilla creada el
  // 13-jun-2026 (S1-E)*»: un registro de procedencia, no una declaración de estado. Con la regla
  // ancha, el documento no podría emitirse JAMÁS sin borrar esa línea — y un guard que solo se
  // satisface destruyendo historia es un guard que se acaba desactivando.
  const conPie = DOC_EMITIDO + '\n\n*Plantilla creada el 13-jun-2026 (S1-E). Fuente: art. 13 RD 1007/2023.*';
  assert.equal(documentoEmitido(conPie).emitido, true,
    '🔴 el pie de procedencia impide emitir el documento. Obligaría a borrar el registro de ' +
    'cuándo se creó, que es justo lo que no se hace en esta casa.');

  const enCabecera = '# Declaración\n> **PLANTILLA — borrador.**\n\nCuerpo con datos reales.';
  assert.equal(documentoEmitido(enCabecera).emitido, false,
    '🔴 dejó de ver la declaración de PLANTILLA donde SÍ cuenta: la cabecera');
});

// ── ④ SUELO ──────────────────────────────────────────────────────────────────────────────

test('SCRUM-400 · 🔴 SUELO: sin landing legible, NO es un verde', () => {
  const r = comprobar({ paginas: [{ ruta: 'public/index.html', html: null }], documento: DOC_EMITIDO });
  assert.equal(r.ok, false,
    '🔴 aprobó sin haber leído ninguna página. «Cero afirmaciones» y «no supe leer la landing» dan ' +
    'el mismo verde y significan lo contrario.');
  assert.match(r.salida, /SUELO/);
});

test('SCRUM-400 · 🔴 SUELO: un documento ilegible NO cuenta como emitido', () => {
  assert.equal(documentoEmitido(null).emitido, false,
    '🔴 un documento que no se pudo leer se dio por emitido: eso AUTORIZA a publicar la afirmación');
  assert.equal(documentoEmitido('').emitido, false);
});

// ── ⑤ El guard mira lo PUBLICADO, no los comentarios ─────────────────────────────────────

test('SCRUM-400 · un comentario HTML no dispara el guard, y no puede esconder nada', () => {
  // SCRUM-349: un guard de texto acaba vigilando la explicación en vez de lo publicado.
  const enComentario = `<!-- Aquí NO decimos que estemos certificados para VeriFactu, ver SCRUM-400 -->
    <p>Presupuestos y cobros por WhatsApp.</p>`;
  assert.equal(comprobar({ paginas: [{ ruta: 'x', html: enComentario }], documento: PLANTILLA_NO_EMITIDA }).ok, true,
    '🔴 se cazó a sí mismo: la frase estaba en un comentario, no en lo publicado');

  const escondido = `<!-- comentario --><p>Estamos certificados para VeriFactu.</p>`;
  assert.equal(comprobar({ paginas: [{ ruta: 'x', html: escondido }], documento: PLANTILLA_NO_EMITIDA }).ok, false,
    '🔴 un comentario delante ha bastado para colar la afirmación');
});

test('SCRUM-400 · textoPublicado conserva las líneas, para que el número reportado sea el real', () => {
  const { length } = textoPublicado('<!--\nuno\ndos\n-->\n<p>tres</p>').split('\n');
  assert.equal(length, 5, '🔴 el saneado se comió líneas: los números que reporte serán falsos');
});

// ── ⑥ EL ESTADO REAL DEL REPO, hoy ───────────────────────────────────────────────────────

test('SCRUM-400 · las dos afirmaciones retiradas NO han vuelto a la landing', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'public/index.html'), 'utf8');
  assert.doesNotMatch(html, /VeriFactu en certificaci/i, '🔴 la insignia ha vuelto');
  assert.doesNotMatch(html, /declaraci[oó]n responsable/i, '🔴 la frase de la declaración ha vuelto');
  assert.doesNotMatch(html, /como fabricante/i, '🔴 el «te contesto como fabricante» ha vuelto');
});

test('SCRUM-400 · el repo REAL pasa el guard hoy', () => {
  const r = comprobarEnDisco(RAIZ);
  assert.equal(r.ok, true, `🔴 el repo no pasa su propio guard:\n${r.salida}`);
  // Y que de verdad haya mirado las cuatro páginas y el documento.
  for (const p of PAGINAS) assert.match(r.salida, new RegExp(p.replace(/[/.]/g, '\\$&')), `🔴 no miró ${p}`);
  assert.match(r.salida, new RegExp(DOCUMENTO.replace(/[/.]/g, '\\$&')));
});
