// tests/scrum341-condicion-precio-publicada.test.mjs — SCRUM-341
//
// La landing promete la PERMANENCIA del precio founding («9,90 €/mes para siempre» / «de por vida»),
// pero la CONDICIÓN vinculante —«mientras mantengas la suscripción activa» (ALCANCE_BETA.md:38, regla
// 25)— vivía DESPUÉS del checkout, donde el visitante no la ve antes de decidir. Decisión tomada
// (SCRUM-341): la condición sube a la superficie donde se hace la promesa, COPIADA del documento.
//
// 🔴 ESTE GUARD acopla las DOS fuentes para que no diverjan en silencio: la promesa PUBLICADA y la
// condición del DOCUMENTO VINCULANTE. La condición NO se escribe a mano aquí —eso sería la enésima
// lista sin guard—: se DERIVA de ALCANCE_BETA.md. Si el documento reformula su condición y la landing
// no, el guard cae (test de divergencia). SUELO: si no se extrae la condición del documento, o si el
// censo no encuentra NINGUNA promesa, falla en vez de decir «ninguna».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOC = path.join(RAIZ, 'docs', 'legal', 'ALCANCE_BETA.md');

// Superficie donde se promete el precio founding a quien va a decidir: la landing del visitante
// (index/precios) y el panel del founding (la oferta de alta a un usuario logueado — SCRUM-327).
const SITIOS = ['public/index.html', 'public/precios.html', 'public/dashboard/js/plansView.js'];

const PRECIO = /9[.,]90/;

/** FUENTE A (vinculante): la condición se EXTRAE del documento, nunca se escribe a mano en el test. */
function condicionVinculante() {
  const t = fs.readFileSync(DOC, 'utf8').replace(/\s+/g, ' '); // cruza el salto de línea del markdown
  const m = t.match(/mientras\s+mantengas[^.]*/i);
  return m ? m[0].trim() : null;
}

/** Texto publicado del sitio; en JS se quitan los comentarios de línea completa (no son copy visible). */
function textoDe(rel) {
  let t = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  if (rel.endsWith('.js')) t = t.replace(/^\s*\/\/.*$/gm, '');
  return t;
}

/** ¿el texto contiene alguna promesa de permanencia del PRECIO? (marcador co-localizado con 9,90 →
 *  excluye falsos positivos como el «para siempre» de los build-ids, que no lleva precio cerca). */
function prometePermanencia(texto) {
  const re = /para siempre|de por vida/gi;
  for (let m; (m = re.exec(texto)); ) {
    if (PRECIO.test(texto.slice(Math.max(0, m.index - 120), m.index + 120))) return true;
  }
  return false;
}

/** NÚCLEO PURO: cada promesa de permanencia del precio que NO lleva la condición cerca (ventana). */
function promesasSinCondicion(condicion, sitios) {
  const faltan = [];
  for (const { rel, texto } of sitios) {
    const re = /para siempre|de por vida/gi;
    for (let m; (m = re.exec(texto)); ) {
      const ventana = texto.slice(Math.max(0, m.index - 120), m.index + 220);
      if (!PRECIO.test(ventana)) continue;                 // no es promesa de precio
      if (!ventana.includes(condicion)) faltan.push(`${rel} @${m.index} («${m[0]}»)`);
    }
  }
  return faltan;
}

const sitios = () => SITIOS.map((rel) => ({ rel, texto: textoDe(rel) }));

// ─── EL GUARD ───────────────────────────────────────────────────────────────────────────────────
test('SCRUM-341 · toda promesa pública de permanencia lleva la condición del documento vinculante', () => {
  const condicion = condicionVinculante();
  // SUELO 1: si no se extrae la condición del documento, no se compara nada.
  assert.ok(condicion && /suscrip/i.test(condicion),
    `🔴 SUELO: no se extrajo la condición de ALCANCE_BETA.md — el guard no tiene fuente A: ${JSON.stringify(condicion)}`);

  const S = sitios();
  const conPromesa = S.filter((s) => prometePermanencia(s.texto)).map((s) => s.rel);
  // SUELO 2: si el censo no ve NINGUNA promesa, no está leyendo → falla, nunca «ninguna».
  assert.ok(conPromesa.length >= 3,
    `🔴 SUELO: el censo solo ve ${conPromesa.length} sitios con promesa (esperaba ≥3: index, precios, panel). No lee.`);

  const faltan = promesasSinCondicion(condicion, S);
  assert.deepEqual(faltan, [],
    `🔴 promesas de permanencia del precio SIN la condición vinculante «${condicion}»:\n  ${faltan.join('\n  ')}\n` +
    'El visitante lee «para siempre» ANTES de decidir; la condición debe estar ahí, COPIADA de ALCANCE_BETA.md.');
});

// ─── DIVERGENCIA (teeth) · si el documento reformula la condición y la landing no, el guard cae ─────
test('SCRUM-341 · si ALCANCE_BETA.md cambia su condición y la landing no, el guard cae (acople a 2 fuentes)', () => {
  const S = sitios();
  const reformulada = (condicionVinculante() || '') + ' y al día'; // simula el cambio SIN tocar el fichero real
  const faltan = promesasSinCondicion(reformulada, S);
  assert.ok(faltan.length >= 3,
    '🔴 si el documento vinculante reformula la condición, la landing (con la vieja) DEBE caer: el guard ' +
    'estaría desacoplado de la fuente A si esto no fallara.');
});

// ─── DOS CARAS + CONTROL NEGATIVO ───────────────────────────────────────────────────────────────
test('SCRUM-341 · dos caras (promesa±condición) y control negativo (permanencia sin precio no es promesa)', () => {
  const c = condicionVinculante();
  // Cara verde: promesa CON la condición → no se marca.
  assert.deepEqual(promesasSinCondicion(c, [{ rel: 'ok', texto: `9,90 €/mes para siempre, ${c}` }]), []);
  // Cara roja: promesa SIN la condición → se marca.
  assert.deepEqual(promesasSinCondicion(c, [{ rel: 'mal', texto: '9,90 €/mes para siempre' }]).length, 1);
  // Control negativo: «para siempre» SIN precio (build-ids, avisos) NO es promesa de precio → no se marca.
  assert.equal(prometePermanencia('el aviso no vuelve a salir, para siempre'), false);
  assert.deepEqual(promesasSinCondicion(c, [{ rel: 'z', texto: 'el aviso no vuelve, para siempre' }]), []);
});
