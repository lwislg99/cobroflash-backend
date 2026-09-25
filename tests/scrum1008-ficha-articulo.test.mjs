// tests/scrum1008-ficha-articulo.test.mjs — SCRUM-1008
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA FICHA DEL ARTÍCULO: SKU, referencia del proveedor y unidad.
//
// Hallazgo POR DENTRO de Contasimple (com. 16436/16451): `Product` no tenía código propio, ni
// la referencia con la que EL PROVEEDOR llama al artículo (distinta de `providerId`, que es la
// relación), ni unidad. Las tres, columnas ADITIVAS y nullables, mismo patrón que `itemKind`
// (SCRUM-609): ausente = nadie lo ha rellenado, no un valor por defecto que nadie ha decidido.
//
// 🔴 REDUCCIÓN DE ALCANCE DECLARADA: esta tanda NO precarga la unidad en ninguna línea de
// documento. El único sitio con un campo `unidad` real hoy es `AlbaranLinea`, y su editor
// (`buildAlbEditor`) no tiene selector de catálogo — añadírselo es una superficie nueva (UI +
// microcopy con firma, regla 39), no una precarga de un campo que ya exista. Añadir la unidad a
// `Quote.lines` (Json, sin ALTER) tendría el mismo problema. Se deja para un ticket propio.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);

const { textoOpcional } = requiere(path.join(RAIZ, 'dist/modules/products/app/routes/products.routes.js'));

// ═══ ① `textoOpcional` — la regla que valida sku/supplierRef/unit en las dos puertas ═══════

test('SCRUM-1008 · ausente o null → ok, valor null (no un vacío distinto de «no se sabe»)', () => {
  assert.deepEqual(textoOpcional(undefined, 'sku', 60), { ok: true, valor: null });
  assert.deepEqual(textoOpcional(null, 'sku', 60), { ok: true, valor: null });
});

test('SCRUM-1008 · recorta espacios y una cadena de solo espacios se guarda como null', () => {
  assert.deepEqual(textoOpcional('  ABC-123  ', 'sku', 60), { ok: true, valor: 'ABC-123' });
  assert.deepEqual(textoOpcional('   ', 'unit', 40), { ok: true, valor: null });
  assert.deepEqual(textoOpcional('', 'unit', 40), { ok: true, valor: null });
});

test('SCRUM-1008 · 🔴 un tipo que no es texto se rechaza, no se convierte a String()', () => {
  const r = textoOpcional(42, 'sku', 60);
  assert.equal(r.ok, false, '🔴 un número ha entrado como si fuera texto: `String(42)` habría colado un SKU inventado.');
  assert.equal(r.error, 'sku_invalid');
});

test('SCRUM-1008 · 🔴 el límite de longitud se respeta, con el nombre del campo en el error', () => {
  const largo = 'x'.repeat(61);
  const r = textoOpcional(largo, 'sku', 60);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'sku_too_long');
  // El límite es el borde: 60 SÍ entra, 61 no.
  assert.equal(textoOpcional('x'.repeat(60), 'sku', 60).ok, true);
});

// ═══ ② las dos rutas WIRING la regla — por AST, no por confiar en que existe ═══════════════

test('SCRUM-1008 · POST / y PUT /:id validan sku, supplierRef y unit con `textoOpcional`', () => {
  const src = requiere('node:fs').readFileSync(
    path.join(RAIZ, 'src/modules/products/app/routes/products.routes.ts'), 'utf8');

  // Población: su DECLARACIÓN (1) + 3 campos × 2 rutas (6) = 7. Se cuenta la declaración a
  // propósito: así una `textoOpcional` renombrada o borrada también hace caer este número, en
  // vez de que el conteo dependa de acertar el patrón exacto de la firma.
  const llamadas = src.split('textoOpcional(').length - 1;
  assert.equal(llamadas, 7,
    `🔴 se esperan 7 apariciones de \`textoOpcional(\` (1 declaración + 3 campos × 2 rutas), hay `
    + `${llamadas}. Si baja, una de las dos puertas ha dejado de validar; si sube, hay una tercera `
    + 'puerta sin contar aquí.');

  for (const campo of ['sku', 'supplierRef', 'unit']) {
    assert.match(src, new RegExp(`textoOpcional\\(req\\.body\\?\\.${campo}`),
      `🔴 POST / no valida \`${campo}\` con \`textoOpcional\`.`);
    assert.match(src, new RegExp(`textoOpcional\\(body\\.${campo}`),
      `🔴 PUT /:id no valida \`${campo}\` con \`textoOpcional\`.`);
  }
});

test('SCRUM-1008 · PUT /:id sólo toca la columna si la clave VIAJA (como el resto del PUT)', () => {
  const src = requiere('node:fs').readFileSync(
    path.join(RAIZ, 'src/modules/products/app/routes/products.routes.ts'), 'utf8');
  for (const campo of ['sku', 'supplierRef', 'unit']) {
    assert.match(src, new RegExp(`if \\(body\\.${campo} !== undefined\\)`),
      `🔴 PUT /:id escribe \`${campo}\` aunque la clave no viaje: borraría el dato al guardar `
      + 'cualquier otro cambio, igual que el defecto que SCRUM-609 ya dejó documentado para `vat`.');
  }
});

// ═══ ③ EL SERVICIO — createProduct/updateProduct ESCRIBEN lo validado ═══════════════════════

/** Mismo mecanismo que `scrum635`: sustituye el cliente de Prisma por un doble en memoria. */
function conPrismaFalso(product) {
  const fP = requiere.resolve(path.join(RAIZ, 'dist/core/db/prisma.js'));
  const fS = requiere.resolve(path.join(RAIZ, 'dist/modules/products/domain/products.service.js'));
  requiere.cache[fP] = { id: fP, filename: fP, loaded: true, exports: { prisma: { product } } };
  delete requiere.cache[fS];
  return requiere(fS);
}

test('SCRUM-1008 · createProduct escribe sku/supplierRef/unit, y su ausencia entra como null', async () => {
  let escrito = null;
  const { createProduct } = conPrismaFalso({
    create: async ({ data }) => { escrito = data; return { id: 1, ...data }; },
  });

  await createProduct(4242, { name: 'Cable 2.5mm', price: 3.5, sku: 'CBL-25', supplierRef: 'REF-9001', unit: 'm' });
  assert.equal(escrito.sku, 'CBL-25');
  assert.equal(escrito.supplierRef, 'REF-9001');
  assert.equal(escrito.unit, 'm');

  await createProduct(4242, { name: 'Sin ficha', price: 1 });
  assert.equal(escrito.sku, null, '🔴 sin `sku` en el input, la columna tiene que quedar en null, no en undefined ni "".');
  assert.equal(escrito.supplierRef, null);
  assert.equal(escrito.unit, null);
});

test('SCRUM-1008 · updateProduct: la clave ausente en `data` no reescribe la columna existente', async () => {
  let escrito = null;
  const { updateProduct } = conPrismaFalso({
    findFirst: async () => ({ id: 9, sku: 'YA-EXISTE' }),
    update: async ({ data }) => { escrito = data; return { id: 9, ...data }; },
  });

  // Sólo se manda `name`: `sku` no debe aparecer en absoluto en el patch (undefined se filtra
  // por Prisma igual que en el resto del PUT, mismo criterio que `vat`/`cost`/`description`).
  await updateProduct(4242, 9, { name: 'Renombrado' });
  assert.equal('sku' in escrito, false,
    '🔴 `updateProduct` ha metido `sku` en el patch aunque nadie lo mandó: borraría el dato al '
    + 'guardar cualquier otro cambio.');
});
