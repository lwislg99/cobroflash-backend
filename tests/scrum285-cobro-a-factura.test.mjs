// SCRUM-285 (§B4) · DESDE UN COBRO SE LLEGA A SU FACTURA.
//
// ────────────────────────────────────────────────────────────────────────────────────────────
// LA DIRECCIÓN IMPORTA, Y SON DOS DECISIONES DISTINTAS
//
// · factura → cobro: **SIN enlace, a propósito**. No existe ficha de cobro (`charge-detail` no
//   está en el dispatch), así que el bloque «Cobro» del detalle de factura es contexto y no
//   navega. Eso está entregado y decidido.
// · cobro → factura: **SÍ va**. El destino existe (`invoice-detail`) y el dato también:
//   `invoiceId` YA viajaba en el payload (`cobros.service.ts:79`) sin que la vista lo usara.
//
// El hueco no estaba declarado en ninguna lista: salió de leer la entrada de máster entera.
//
// ⚠️ EL CONTROL NEGATIVO ES LA MITAD DEL TICKET: el dinero marcado A MANO no tiene factura y
// llega con `invoiceId: null`. Un enlace ahí no lleva a ninguna parte — o está el destino, o no
// está el enlace.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/cobrosView.js');
const SERVICIO = path.join(RAIZ, 'src/modules/billing/domain/cobros.service.ts');

/**
 * El código sin las líneas de comentario. ⚠️ No vale partir por `//`: una URL lleva dos barras.
 * Solo caen las líneas que EMPIEZAN por comentario, que es donde vive la auto-referencia.
 */
function sinComentarios(fuente) {
  return fuente.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}

/** El bloque que pinta la celda DOCUMENTO, por sus anclas reales. */
function celdaDocumento() {
  const src = fs.readFileSync(VISTA, 'utf8');
  const desde = src.indexOf("var tdDoc = document.createElement('td')");
  const hasta = src.indexOf('tr.appendChild(tdDoc)');
  if (desde === -1 || hasta === -1 || hasta <= desde) return null;
  return src.slice(desde, hasta);
}

test('SCRUM-285 · SUELO: se encuentra la celda del documento en la pantalla de Cobros', () => {
  // Sin esto, un cambio de forma dejaría los tests de abajo mirando una cadena vacía: verde por
  // no ver nada, que es como un guard deja de vigilar sin que se note.
  const c = celdaDocumento();
  assert.ok(c, '🔴 CIEGO: no se encuentran las anclas de la celda DOCUMENTO en cobrosView.js '
    + "(`var tdDoc = document.createElement('td')` … `tr.appendChild(tdDoc)`). Si la pantalla se "
    + 'reescribió, hay que enseñarle las anclas nuevas ANTES de fiarse de este archivo.');
  assert.ok(c.length > 80, `🔴 CIEGO: la celda mide ${c.length} caracteres, demasiado poco`);
});

test('SCRUM-285 · el dato ya viajaba: `invoiceId` está en el payload de cobros', () => {
  // El arreglo no inventa un campo: usa uno que el servicio ya devolvía y nadie leía. Si el
  // servicio dejara de mandarlo, el enlace de abajo apuntaría a `undefined` en silencio.
  const svc = fs.readFileSync(SERVICIO, 'utf8');
  assert.match(svc, /invoiceId:\s*number\s*\|\s*null/,
    '🔴 el servicio de cobros ya no declara `invoiceId`: el enlace de la vista se quedaría sin dato');
});

test('SCRUM-285 · 🔴 POSITIVO: desde un cobro con factura se navega a SU factura', () => {
  // ⚠️ SIN COMENTARIOS: buscar la cadena `invoice-detail` a secas casa con el comentario que
  // explica el enlace, y el guard se acusa a sí mismo — pasó al probar el rojo, que no cayó.
  // Se exige el MECANISMO (`renderAppView('invoice-detail')`), no la mención.
  const c = sinComentarios(celdaDocumento() || '');
  assert.match(c, /renderAppView\(\s*'invoice-detail'\s*\)/,
    '🔴 la celda del documento no navega a `invoice-detail`: desde un cobro no se llega a su '
    + 'factura, y hay que salir a buscarla a mano.');
  // Que lleve a ESA factura y no a la primera: el id sale de la fila, no de una constante.
  assert.match(c, /appState\.invoiceId\s*=\s*c\.invoiceId/,
    '🔴 el enlace no usa el `invoiceId` DE ESA FILA. Un destino fijo llevaría siempre a la misma '
    + 'factura, que es peor que no enlazar: parece que funciona.');
});

test('SCRUM-285 · 🔴 NEGATIVO: un cobro SIN factura no pinta enlace', () => {
  // El dinero marcado a mano llega con `invoiceId: null` (cobros.service.ts:190).
  const c = celdaDocumento() || '';
  assert.match(c, /if\s*\(\s*c\.invoiceId\s*!=\s*null\s*\)/,
    '🔴 el enlace NO está condicionado a que exista factura.\n\n'
    + '  El dinero marcado a mano no tiene factura y llega con `invoiceId: null`. Un enlace ahí\n'
    + '  no lleva a ninguna parte. O está el destino, o no está el enlace.');
  assert.match(c, /else\s*\{[\s\S]*textContent\s*=\s*etiquetaDoc/,
    '🔴 sin factura no se pinta el texto plano: la celda se quedaría vacía en vez de sin enlace');
});
