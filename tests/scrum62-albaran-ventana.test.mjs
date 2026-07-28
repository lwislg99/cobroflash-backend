import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs'; // SCRUM-193

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = path.join(raiz, 'src', 'modules', 'jobs', 'domain', 'albaranWhatsApp.service.ts');
// SIN comentarios: un guard que busca llamadas por texto casa con la prosa que las explica
// (trampa de auto-referencia de SCRUM-129 — ha mordido cuatro veces en este mismo día).
// SCRUM-193: la copia local del filtrado se retira; `leerFuente` ya devuelve solo lo ejecutable
// y además sabe qué está leyendo (en CSS `#` es un selector; en Markdown, un encabezado).
const codigo = leerFuente(FUENTE);

const paraFirmar = codigo.slice(codigo.indexOf('buildAlbaranParaFirmar({'));
const firmado = codigo.slice(0, codigo.indexOf('buildAlbaranParaFirmar({'));

/**
 * SCRUM-62 — el envío "para firmar" del albarán deja de pagar plantilla con la ventana abierta.
 */

test('SCRUM-62: "para firmar" va por ventana primero', () => {
  assert.match(paraFirmar, /sendWhatsAppWindowFirst\(\{/, 'vuelve a mandarse siempre plantilla (~0,023 € por envío) aunque la ventana esté abierta');
  assert.doesNotMatch(paraFirmar, /await sendWhatsAppTemplate\(\{/, 'la plantilla debe ser el FALLBACK de windowFirst, no la llamada directa');
});

test('SCRUM-62: la plantilla sigue siendo el camino de reserva, no desaparece', () => {
  // windowFirst cae a plantilla si la ventana está cerrada o si el texto falla. Perder la
  // plantilla convertiría un ahorro de coste en mensajes que no llegan.
  assert.match(paraFirmar, /template:\s*\{\s*templateName:\s*msg\.templateName/, 'se pierde la plantilla de reserva dentro de windowFirst');
});

test('SCRUM-62: el criterio de ventana NO se duplica aquí', () => {
  // La razón de fondo de reutilizar la función: si este servicio decidiera por su cuenta,
  // podría discrepar del camino de presupuesto (a55-window-quote) sin que nada lo notara.
  for (const patron of [/isServiceWindowOpen/, /isWaOptedOut/, /costEstimate/]) {
    assert.doesNotMatch(codigo, patron, `el criterio de ventana se está re-implementando aquí (${patron}); vive dentro de sendWhatsAppWindowFirst`);
  }
});

test('SCRUM-62: el texto de ventana es el K1 aprobado, con sus tres variables', () => {
  assert.match(paraFirmar, /Hola \$\{nombreCliente\}/, 'falta la variable de cliente del texto aprobado');
  assert.match(paraFirmar, /\$\{businessName\}/, 'falta la variable de empresa');
  assert.match(paraFirmar, /Albarán \$\{albaran\.numero\}/, 'falta el número de albarán');
  assert.match(paraFirmar, /te ha preparado el parte de trabajo/, 'el cuerpo aprobado cambió sin pasar por la regla 30');
  assert.match(paraFirmar, /buttonText: 'Ver y firmar'/, 'el botón aprobado es "Ver y firmar"');
});

test('SCRUM-62: el texto no añade información que la plantilla no dice', () => {
  // La plantilla aprobada en Meta lleva 3 variables. Meter importes o fechas en la vía de
  // ventana crearía dos mensajes distintos para el mismo hecho según el canal.
  for (const prohibido of [/formatMoneyEs/, /total/i, /€/]) {
    assert.doesNotMatch(paraFirmar.slice(0, paraFirmar.indexOf('sendWhatsAppWindowFirst')), prohibido,
      `el cuerpo de ventana añade información que la plantilla no da (${prohibido})`);
  }
});

test('SCRUM-62 (A23): con botón-enlace, el cuerpo NO lleva la URL cruda', () => {
  const cta = paraFirmar.slice(paraFirmar.indexOf('windowCta:'), paraFirmar.indexOf('template:'));
  // Con la coma: el valor tiene que ser EXACTAMENTE cuerpoVentana, sin nada concatenado.
  assert.match(cta, /bodyText: cuerpoVentana,/, 'el cuerpo del botón-enlace debe ser el texto tal cual, sin añadidos');

  // La invariante real está en la DEFINICIÓN del cuerpo, no en la línea del botón: ahí
  // `url: enlaceFirma` es correcto y esperado (es el destino del botón). Lo que no puede pasar
  // es que el enlace se cuele en el TEXTO cuando ya viaja como botón.
  const defCuerpo = paraFirmar.slice(paraFirmar.indexOf('const cuerpoVentana ='), paraFirmar.indexOf('const result'));
  assert.doesNotMatch(defCuerpo, /enlaceFirma/, 'la URL cruda vuelve al cuerpo del mensaje con botón (A23)');
  assert.match(defCuerpo, /Albarán/, 'guarda de presencia: si el recorte falla, este test pasaría en vacío');
});

test('SCRUM-62: el envío del albarán FIRMADO (documento) queda fuera, a propósito', () => {
  // `sendWhatsAppWindowFirst` no manda documentos: esa mitad exige reescribir
  // sendWhatsAppDocument a media_id + una variante documento. Es otro camino y sigue en el
  // ticket. Este guard existe para que nadie lo dé por hecho al ver la mitad barata hecha.
  assert.match(firmado, /await sendWhatsAppTemplate\(\{/, 'el envío del albarán firmado cambió de camino sin que su mitad del ticket esté hecha');
});
