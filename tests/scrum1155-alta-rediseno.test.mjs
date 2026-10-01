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
  // SCRUM-1311 · suelo de población: si el mapa cambia de comillas o de forma, aquí no sale ningún id.
  assert.ok(ids.length > 0,
    '🔴 CIEGO: no se ha leído NINGÚN id de CAMPO_DESCARTE_A_INPUT — ¿ha cambiado cómo se escribe el mapa? Sin ids, lo de abajo no comprueba nada.');
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

// ── `proveedorNombre`: FIRMADO EN SCRUM-1155 COMENTARIO 17250 (27-sep-2026) ──────────────────
//
// Hasta el 27-sep esto comprobaba que `p.proveedorNombre` NO se usara sin un texto firmado (regla
// 30) — el incremento lo dejaba explícitamente sin construir. Ya no mide lo mismo A PROPÓSITO: la
// firma llegó y el comportamiento correcto pasó a ser el contrario. El comportamiento en navegador
// (se pinta/se oculta/se limpia según corresponda) lo mide `tests/scrum1038-leer-el-ticket-
// gasto.test.mjs`; aquí solo el LITERAL y la VÍA de pintado.

test('SCRUM-1155 · `proveedorNombre` se pinta con el texto firmado (SCRUM-1155 comentario 17250)', () => {
  assert.ok(VISTA.includes('El ticket dice «'),
    '🔴 falta el prefijo firmado de la sugerencia de proveedor');
  assert.ok(VISTA.includes('». Si no está en tu lista, puedes darlo de alta en Proveedores.'),
    '🔴 falta el sufijo firmado de la sugerencia de proveedor');
});

test('SCRUM-1155 · 🔴 CONDICIÓN DE LA FIRMA: `proveedorNombre` se pinta por `textContent`, nunca por HTML', () => {
  // El nombre es contenido de una lectura por IA sobre una foto sin validar: la firma exige
  // `textContent` explícitamente. Se busca la línea que USA el valor (no la que lo comenta ni la
  // que lo lee del servidor) y se comprueba que compone `textContent`, no `innerHTML` ni una
  // plantilla HTML con el valor interpolado dentro.
  const usoReal = VISTA.split('\n').find((l) => /avisoProveedor\.\w+\s*=.*proveedorNombre/.test(l)
    || /textContent\s*=\s*TEXTO_PROVEEDOR_SUGERIDO_PREFIJO/.test(l));
  assert.ok(usoReal, '🔴 no se encuentra la línea que pinta `proveedorNombre` en el DOM');
  assert.match(usoReal, /\.textContent\s*=/,
    `🔴 AGUJERO: «${usoReal.trim()}» no usa \`.textContent\` — un nombre con \`<\`/\`&\` de una `
    + 'foto sin validar se pintaría como HTML.');
  assert.ok(!/\.innerHTML\s*=.*proveedorNombre/.test(VISTA),
    '🔴 AGUJERO: hay una asignación de `innerHTML` que interpola `proveedorNombre` en crudo.');
});

// ── EL REGISTRO ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-1155 · la aprobación queda registrada en docs/microcopy/', () => {
  const dir = path.join(RAIZ, 'docs/microcopy');
  const registros = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  assert.ok(registros.some((f) => f.includes('1155') || f.includes('alta-rediseno')),
    '🔴 no hay ficha en docs/microcopy/ para el alta rediseñada de SCRUM-1155.');
});
