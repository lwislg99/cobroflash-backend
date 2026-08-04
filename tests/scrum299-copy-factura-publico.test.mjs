// tests/scrum299-copy-factura-publico.test.mjs — SCRUM-299 (punto 4)
//
// Guarda que el copy PÚBLICO no PROMETA «factura» sobre el documento post-pago (Parte M: sin las
// variables INVOICING_ES es «justificante de cobro», sin numeración ni QR). Vigila el COPY, no la
// emisión (esa ya distingue bien — regla 38 = STOP). El discriminador promesa-vs-mención vive y se
// explica en `_copy-publico.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recolectarCopyPublico, promesasDeFactura } from './_copy-publico.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// BASELINE = las promesas CONOCIDAS hoy, por FICHERO y CANTIDAD (no por línea: anclar a la línea
// pone el guard en rojo cada vez que alguien añade texto encima — lección de SCRUM-243). Son el
// defecto que el FUNDADOR corrige en su mitad del ticket (regla 30: el microcopy lo decide él). El
// guard cae si aparece una promesa en un fichero NO baselined, o si el conteo de uno baselined SUBE.
// Cuando el fundador limpie el copy, estos bajan a 0 y el guard pasa a exigir CERO promesas.
const BASELINE = {
  'public/index.html': 3, // :380 «Recibe la factura» · :424 «tu factura» · :433 «Factura #F-128»
};

test('SCRUM-299 · SUELO: el censo LEE de verdad (control positivo: presupuesto en index.html)', () => {
  const corpus = recolectarCopyPublico(RAIZ);
  assert.ok(corpus.length >= 10, `🔴 censo vacío o roto: ${corpus.length} ficheros — no está recorriendo`);
  const idx = corpus.find((c) => c.rel === 'public/index.html');
  assert.ok(idx, '🔴 index.html no entró en el censo');
  const n = (idx.texto.match(/presupuesto/gi) || []).length;
  // El control que ya funcionó: «presupuesto» da 34 en index.html. Si el detector no las ve, no lee.
  assert.ok(n >= 25, `🔴 control positivo roto: presupuesto=${n} en index.html (esperaba ≥25)`);
});

test('SCRUM-299 · el copy público no promete «factura» MÁS ALLÁ del baseline conocido', () => {
  const corpus = recolectarCopyPublico(RAIZ);
  const nuevas = [];
  for (const { rel, texto } of corpus) {
    const p = promesasDeFactura(texto);
    const permitido = BASELINE[rel] ?? 0;
    if (p.length > permitido) {
      nuevas.push(`${rel}: ${p.length} promesa(s), baseline ${permitido} → ` +
        p.map((h) => `:${h.linea} [${h.marcador}] «${h.frag}»`).join('  |  '));
    }
  }
  assert.deepEqual(nuevas, [],
    '🔴 NUEVA promesa de «factura» en copy público. Parte M: sin INVOICING_ES el documento ' +
    'post-pago es «justificante de cobro», el copy NUNCA dice «factura». El texto lo decide el ' +
    `fundador (regla 30).\n${nuevas.join('\n')}`);
});

test('SCRUM-299 · CONTROL NEGATIVO: cae la PROMESA (A), no cae la MENCIÓN (B)', () => {
  // (A) DEBEN caer — entrega del documento al cliente final
  for (const a of [
    'Aquí tienes tu factura. Págala cuando quieras',   // posesivo
    'Recibe la factura',                                // verbo de entrega
    '<span>Factura #F-128</span>',                      // documento numerado
  ]) {
    assert.equal(promesasDeFactura(a).length, 1, `(A) debería caer y no cae: «${a}»`);
  }
  // (B) NO deben caer — categoría/feature, meta, JSON-LD, fiscal, config, acción del pro, comentario
  for (const b of [
    'llevas clientes, gastos y facturas en el mismo sitio',                               // index :317
    'Clientes, gastos, facturas y bot',                                                   // index :7 (meta)
    'gestión de clientes, gastos y facturas',                                             // index :37 (JSON-LD)
    'generar documentos de cotización y factura, pero la responsabilidad del cumplimiento fiscal recae en ti', // terminos :82
    'la facturación VeriFactu está construida',                                           // index :498
    'Serie factura (prefijo)',                                                            // admin (config del pro)
    'Ya puedes emitir la factura',                                                        // email al MERCHANT
    'el PDF del recibo/factura',                                                          // comentario whatsapp.ts
  ]) {
    assert.deepEqual(promesasDeFactura(b), [], `(B) NO debería caer y cae: «${b}»`);
  }
});

test('SCRUM-299 · TRAMPA DE LA CASA: public/dashboard NO entra en el censo (es la app del pro)', () => {
  const corpus = recolectarCopyPublico(RAIZ);
  const delDashboard = corpus.filter((c) => c.rel.startsWith('public/dashboard/'));
  assert.deepEqual(delDashboard.map((c) => c.rel), [],
    '🔴 un fichero de public/dashboard/ entró en el censo público: «factura» ahí es del pro, no una promesa al cliente');
  // Y aunque el copy del pro diga «factura», sin entrega al cliente final no es una promesa:
  assert.deepEqual(promesasDeFactura('<label>Serie factura (prefijo)</label>'), []);
});
