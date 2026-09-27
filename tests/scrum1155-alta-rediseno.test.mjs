// tests/scrum1155-alta-rediseno.test.mjs — SCRUM-1155 (920f)
//
// EL ALTA DE GASTO REDISEÑADA: la microcopy firmada en SCRUM-920 (comentario 15992, 20-sep-2026)
// se aplicó un mes después de firmarse (26-sep-2026). El comportamiento en navegador —foto
// primero, único mecanismo de lectura, los 9 porqués— lo miden `tests/scrum1038-leer-el-ticket-
// gasto.test.mjs` y `tests/scrum324-cadena-hasta-el-libro.test.mjs` (banco real de DOM). Aquí se
// vigila lo que un banco de comportamiento no puede: que los LITERALES sigan siendo los firmados,
// letra a letra, y que no haya vuelto un segundo mecanismo de lectura.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/expensesView.js'), 'utf8');

// ── LOS LITERALES FIRMADOS (SCRUM-920 comentario 15992) ──────────────────────────────────────

test('SCRUM-1155 · 🔴 los literales del paso 1/2/3 son los firmados, letra a letra', () => {
  const firmados = [
    '1 · La foto del ticket',
    'Hazla ahora, que el papel lo tienes delante. Lo demás lo puedes rellenar luego.',
    'Haz la foto del ticket',
    '📷 Hacer foto',
    'Elegir foto o archivo',
    'Ahora no tengo el ticket',
    'Foto guardada',
    'Si no se lee bien, repítela.',
    'Verla',
    'Quitarla',
    '2 · Qué es y cuánto',
    '✓ Con esto ya se guarda. Lo de abajo es opcional.',
    '3 · Datos de la factura del proveedor',
    'Opcional',
    'Guardamos la foto como tu copia. Los datos fiscales salen de los campos de abajo.',
  ];
  for (const texto of firmados) {
    assert.ok(VISTA.includes(texto),
      `🔴 falta (o se reescribió) el literal firmado: «${texto}». Regla 30: no se parafrasea lo `
      + 'ya aprobado.');
  }
});

// ── EL IVA, AMPLIADO POR UNA DECISIÓN YA TOMADA (SCRUM-920 comentario 16175 punto 3) ─────────

test('SCRUM-1155 · el desplegable de IVA ofrece los seis valores que el servidor admite', () => {
  assert.match(VISTA, /\[0,\s*2,\s*4,\s*5,\s*10,\s*21\]\.map/,
    '🔴 el desplegable de IVA ya no ofrece exactamente [0,2,4,5,10,21] (decisión del 21-sep-2026, '
    + 'comentario 16175 punto 3). Si el servidor cambia sus valores admitidos, se actualiza aquí '
    + 'CON referencia, no en silencio.');
  assert.ok(!VISTA.includes('[21, 10, 4, 0]'),
    '🔴 ha vuelto el desplegable viejo de IVA junto al nuevo: dos declaraciones del mismo '
    + 'desplegable es la forma exacta en la que una de las dos deja de estar viva.');
});

// ── UN SOLO MECANISMO DE LECTURA (reconciliación de SCRUM-1038 dentro de SCRUM-1155) ─────────

test('SCRUM-1155 · 🔴 un solo botón «leer el ticket», alimentado por CUALQUIERA de los dos file inputs', () => {
  const apariciones = (VISTA.match(/id="exp-leer-ticket"/g) || []).length;
  assert.equal(apariciones, 1,
    `🔴 hay ${apariciones} declaraciones de #exp-leer-ticket: dos mecanismos de lectura en la `
    + 'misma pantalla es justo el defecto que esta reconciliación tenía que cerrar.');
  assert.match(VISTA, /function\s+inputConFoto/,
    '🔴 `inputConFoto` ha desaparecido: sin ella, «leer el ticket» solo sabría mirar UNO de los '
    + 'dos file inputs (cámara o archivo) y el otro quedaría mudo.');
});

test('SCRUM-1155 · los dos file inputs son mutuamente excluyentes (cámara y archivo)', () => {
  assert.match(VISTA, /id="exp-receipt-camara"[^>]*capture="environment"/,
    '🔴 el input de cámara ha perdido `capture="environment"`: sin él, en móvil abre el mismo '
    + 'selector que «Elegir foto o archivo» y los dos botones dejan de significar cosas distintas.');
});

// ── LOS 9 PORQUÉS: EL MAPA CAMPO→INPUT NO SE INVENTA CAMPOS QUE EL SERVIDOR NO MANDA ─────────

test('SCRUM-1155 · el mapa de campo→input de los descartes solo nombra campos reales del formulario', () => {
  const m = VISTA.match(/const CAMPO_DESCARTE_A_INPUT = \{([\s\S]*?)\};/);
  assert.ok(m, '🔴 CAMPO_DESCARTE_A_INPUT ha desaparecido: los 9 porqués dejarían de saber dónde pintarse');
  const ids = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  for (const id of ids) {
    assert.ok(VISTA.includes(`id="${id}"`), `🔴 el mapa apunta a «${id}», que no existe en el formulario`);
  }
});

test('SCRUM-1155 · los 9 motivos de descarte están completos (SCRUM-920 comentario 16175)', () => {
  const motivos = [
    'no_es_numero', 'fuera_de_rango', 'tipo_iva_no_admitido', 'no_cuadra_con_el_total',
    'fecha_invalida', 'fecha_futura', 'nif_invalido', 'demasiado_largo', 'no_es_texto',
  ];
  for (const motivo of motivos) {
    assert.match(VISTA, new RegExp(`${motivo}:\\s*'`), `🔴 falta el texto firmado del motivo «${motivo}»`);
  }
});

// ── `proveedorNombre`: EL SERVIDOR YA LO MANDA, EL MODAL NO SE INVENTA CÓMO ENSEÑARLO ────────

test('SCRUM-1155 · `proveedorNombre` no se pinta con un texto sin firmar', () => {
  // El servidor ya lo lee (PropuestaGasto.proveedorNombre); pintarlo necesitaría una frase NUEVA
  // sin aprobar (regla 30), así que este incremento lo deja explícitamente sin construir — no a
  // medias con un texto inventado. Si algún día se firma, este test se actualiza CON la firma.
  assert.ok(!/p\.proveedorNombre/.test(VISTA.replace(/\/\/.*proveedorNombre.*/g, '')),
    '🔴 `p.proveedorNombre` se está usando en el código sin que haya un texto firmado que lo '
    + 'acompañe — comprueba que no se ha pintado un literal nuevo sin pasar por regla 30.');
});

// ── EL REGISTRO ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-1155 · la aprobación queda registrada en docs/microcopy/', () => {
  const dir = path.join(RAIZ, 'docs/microcopy');
  const registros = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  assert.ok(registros.some((f) => f.includes('1155') || f.includes('alta-rediseno')),
    '🔴 no hay ficha en docs/microcopy/ para el alta rediseñada de SCRUM-1155.');
});
