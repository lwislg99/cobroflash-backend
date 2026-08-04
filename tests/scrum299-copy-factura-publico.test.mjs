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

// DEUDA ORIGINAL declarada — INMUTABLE. Es la vara contra la que se mide si alguien BAJÓ el copy y
// por tanto DEBE anotar el commit que lo limpió. Fijada el 4-ago-2026: las 3 promesas conocidas de
// index.html (:380/:424/:433), que corrige el FUNDADOR en su propio commit (regla 30).
const DEUDA_ORIGINAL = { 'public/index.html': 3 };

// BASELINE — EDITABLE, por FICHERO y CANTIDAD (no por línea: anclar a la línea pone el guard en rojo
// cada vez que alguien añade texto encima — lección de SCRUM-243). Cuando el commit del fundador
// limpie el copy, hay que BAJAR `n` al conteo real Y escribir en `limpiadoPor` el sha de ESE commit.
// El «porqué» se anota AQUÍ, al lado del número, no en un comentario suelto: un baseline que solo
// vigila hacia arriba convierte una deuda declarada en excepción permanente — si dentro de tres meses
// sigue en 3, esos tres textos habrán quedado LEGITIMADOS por el guard que existía para matarlos.
const BASELINE = {
  // LIMPIADO en este mismo commit: las 3 promesas (:380/:424/:433) se sustituyeron por los textos
  // APROBADOS por el fundador (reglas 26/30) — :380 «Recibe el enlace de pago» · :424 «Ya puedes
  // pagar cuando quieras» · :433 «Reforma de baño». El documento post-pago ya no se promete como
  // «factura». `n` baja a 0 y `limpiadoPor` deja constancia; el guard exige ahora CERO promesas.
  'public/index.html': {
    n: 0,
    limpiadoPor: 'SCRUM-299 (este commit): textos aprobados aplicados en index.html:380/:424/:433 — ver docs/master/SCRUM-299.md',
  },
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

test('SCRUM-299 · el trinquete muerde en LOS DOS SENTIDOS (subir Y bajar), y bajar obliga a anotar', () => {
  const corpus = recolectarCopyPublico(RAIZ);

  // ── SUELO ANTES DE COMPARAR — esta es la mitad PELIGROSA del trinquete: si el detector no lee, un
  // conteo BAJO es «no supe mirar», no «se limpió» (el mismo número bajando). Dos controles positivos
  // que corren ANTES de tocar el baseline: el LECTOR de ficheros (presupuesto=34) y el DETECTOR de
  // promesas (una promesa canónica sigue cayendo). Si cualquiera falla, no se compara: falla aquí.
  const idx = corpus.find((c) => c.rel === 'public/index.html');
  assert.ok(idx, '🔴 SUELO: index.html no entró en el censo — el detector no lee; NO se compara.');
  const nPres = (idx.texto.match(/presupuesto/gi) || []).length;
  assert.ok(nPres >= 25,
    `🔴 SUELO (lector): presupuesto=${nPres} (<25) en index.html. Un conteo bajo ahora sería «no ` +
    'supe mirar», NO «se limpió» — no se compara contra el baseline.');
  assert.equal(promesasDeFactura('Aquí tienes tu factura').length, 1,
    '🔴 SUELO (detector): no reconoce una promesa canónica. Un conteo que baja a 0 con el detector ' +
    'roto es «no supe mirar», no «se limpió».');

  const problemas = [];
  const detectado = new Map();
  for (const { rel, texto } of corpus) {
    const p = promesasDeFactura(texto);
    if (p.length) detectado.set(rel, p);
  }

  // ⬆️ SUBIÓ — promesa en un fichero NO baselined, o MÁS de las permitidas: NUEVA promesa.
  for (const [rel, p] of detectado) {
    const permitido = BASELINE[rel]?.n ?? 0;
    if (p.length > permitido) {
      problemas.push(`⬆️  SUBIÓ en ${rel}: ${p.length} promesa(s), baseline ${permitido}. NUEVA promesa de ` +
        `«factura» (Parte M: el documento post-pago es justificante, no factura) → ` +
        p.map((h) => `:${h.linea} [${h.marcador}] «${h.frag}»`).join('  |  '));
    }
  }

  // ⬇️ BAJÓ — un fichero baselined con MENOS de lo declarado: se limpió el copy y el baseline quedó
  // viejo. No es un rojo de castigo: OBLIGA a registrar el arreglo (bajar `n` + anotar el commit).
  for (const [rel, { n }] of Object.entries(BASELINE)) {
    const actual = detectado.get(rel)?.length ?? 0;
    if (actual < n) {
      problemas.push(`⬇️  BAJÓ en ${rel}: ${actual} promesa(s) detectadas, baseline ${n}. Se limpió el copy ` +
        `— BAJA \`n\` a ${actual} y escribe en \`limpiadoPor\` el sha del commit que lo hizo. Si baja en ` +
        'silencio, nadie se entera de que se arregló y la deuda queda LEGITIMADA.');
    }
  }

  // ✍️ ANOTACIÓN — bajaste `n` por debajo de la deuda original pero no dijiste qué commit limpió el copy.
  for (const [rel, { n, limpiadoPor }] of Object.entries(BASELINE)) {
    if (n < (DEUDA_ORIGINAL[rel] ?? 0) && !limpiadoPor) {
      problemas.push(`✍️  ${rel}: el baseline bajó de ${DEUDA_ORIGINAL[rel]} a ${n} SIN anotar el arreglo. ` +
        'Escribe el sha del commit que limpió el copy en `limpiadoPor` — bajar obliga a anotar por qué.');
    }
  }

  assert.deepEqual(problemas, [],
    `🔴 el trinquete de «factura» muerde (Parte M · el texto lo decide el fundador, regla 30):\n${problemas.join('\n')}`);
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
