// tests/scrum635-el-csv-sin-iva-y-con-coste.test.mjs — SCRUM-635
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL TARIFARIO EXPORTA COSTE Y DEJA DE EXPORTAR IVA — decisión del fundador, 16-sep-2026
//
//     ANTES   name;description;price;vat;isActive
//     AHORA   name;description;price;cost;isActive
//
// ── ⛔ EL MARGEN NO SE EXPORTA CALCULADO, y es decisión del asesor ────────────────────────────
// El margen se deriva en el catálogo a partir de precio y coste. Traerlo ya calculado al CSV
// crearía un SEGUNDO sitio donde vive el mismo número, y dos sitios es como uno de los dos se
// queda atrás. Quien abra el fichero tiene `price` y `cost`: el margen sale de ahí. Hay un test
// abajo que lo impide, para que nadie lo «mejore» mañana.
//
// ── ⚠️ LO QUE ESTO CUESTA, ESCRITO Y NO ESCONDIDO ────────────────────────────────────────────
// Los merchants que teclean el IVA a mano pierden ese dato EN LA EXPORTACIÓN (medido en el
// trabajo previo del ticket: 58 productos · 46 con 0,21 · 3 a mano). No es motivo para parar
// —está decidido— pero consta. La columna `vat` NO se borra del modelo: sólo deja de viajar aquí.
//
// ⛔ `listProducts` no se toca: su apertura está decidida en SCRUM-609 y es de otro carril.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);

/** El catálogo de prueba. Fabricado: ni producción ni staging. */
const CATALOGO = [
  { name: 'Mano de obra', description: 'Hora de fontaneria', price: '35.00', cost: '18.00', vat: '0.2100', isActive: true },
  { name: 'Desplazamiento', description: 'Zona 1', price: '20.00', cost: '12.50', vat: '0.2100', isActive: true },
  { name: 'Grifo monomando', description: 'Serie basica; con instalacion', price: '89.90', cost: '54.00', vat: '0.2100', isActive: true },
  { name: 'Revision caldera', description: 'Anual', price: '75.00', cost: null, vat: '0.1000', isActive: true },
  { name: 'Material vario', description: '', price: '12.00', cost: '7.20', vat: null, isActive: false },
];

async function exportar(catalogo = CATALOGO) {
  const fP = requiere.resolve(path.join(RAIZ, 'dist/core/db/prisma.js'));
  const fS = requiere.resolve(path.join(RAIZ, 'dist/modules/products/domain/products.service.js'));
  requiere.cache[fP] = {
    id: fP, filename: fP, loaded: true,
    exports: { prisma: { product: { findMany: async () => catalogo } } },
  };
  delete requiere.cache[fS];
  const { exportProductsCsv } = requiere(fS);
  const csv = await exportProductsCsv(4242);
  return { csv, lineas: csv.replace(/^﻿/, '').split('\n') };
}

const columnas = (linea) => {
  // parte por `;` respetando las comillas del propio escapado del export
  const out = []; let buf = ''; let dentro = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') { if (dentro && linea[i + 1] === '"') { buf += '"'; i++; } else dentro = !dentro; continue; }
    if (c === ';' && !dentro) { out.push(buf); buf = ''; continue; }
    buf += c;
  }
  out.push(buf);
  return out;
};

// ═══ SUELO ═══════════════════════════════════════════════════════════════════════════════════

test('SCRUM-635 · 🔴 SUELO: se exporta un tarifario de verdad, o CIEGO', async () => {
  const { csv, lineas } = await exportar();
  assert.notEqual(csv.length, 0,
    '🔴 CIEGO: no se ha exportado NADA. «La columna no está» medido sobre un fichero vacío no '
    + 'distingue el arreglo de un banco que no exporta.');
  assert.equal(lineas.length - 1, CATALOGO.length,
    `🔴 CIEGO: salieron ${lineas.length - 1} filas para ${CATALOGO.length} productos`);
  assert.equal(csv.charCodeAt(0), 0xFEFF, 'el BOM sigue puesto: Excel lo necesita para los acentos');
});

// ═══ 🔴 EL QUE DECIDE ════════════════════════════════════════════════════════════════════════

test('SCRUM-635 · 🔴 EL QUE DECIDE: la cabecera es `name;description;price;cost;isActive`', async () => {
  const { lineas } = await exportar();
  assert.equal(lineas[0], 'name;description;price;cost;isActive',
    `🔴 la cabecera es \`${lineas[0]}\`. El IVA sale y el coste entra: lo decidió el fundador.`);
  assert.ok(!/(^|;)vat(;|$)/.test(lineas[0]), 'y `vat` no puede seguir ahí');
});

test('SCRUM-635 · 🔴 la fila del `vat` vacío —la que parecía dato corrupto— desaparece', async () => {
  // 🔴 RESPALDO DEL TOKEN (SCRUM-237): una negación sobre un literal sin un hermano que demuestre
  // que ese literal PUEDE salir es un verde permanente — el día que cambie el separador o el
  // formato del precio, `no contiene ;;12.00;;` pasaría por no encontrarlo NUNCA, no por estar
  // arreglado. Así que primero se prueba que el export sabe producirlo: un producto sin
  // descripción Y sin coste da el hueco doble tal cual.
  const { lineas: conHueco } = await exportar([
    { name: 'Material vario', description: '', price: '12.00', cost: null, vat: null, isActive: false },
  ]);
  assert.ok(conHueco[1].includes(';;12.00;;'),
    `🔴 SUELO DEL TOKEN: el export NO sabe producir \`;;12.00;;\` ni cuando faltan los dos campos `
    + `(\`${conHueco[1]}\`). Entonces la negación de abajo no prueba nada.`);

  const { lineas } = await exportar();
  const material = lineas.find((l) => l.startsWith('Material vario'));
  assert.ok(material, '🔴 CIEGO: no está la fila que se mide');
  assert.ok(!material.includes(';;12.00;;'),
    `🔴 sigue el hueco doble que parece dato corrupto: \`${material}\``);
  assert.equal(columnas(material)[3], '7.20',
    'donde estaba el IVA vacío ahora va el coste, que es un dato que el profesional sí mantiene');
});

// ═══ ✅ POSITIVO — las demás columnas, byte a byte ════════════════════════════════════════════

test('SCRUM-635 · ✅ POSITIVO: name, description, price e isActive salen IDÉNTICAS', async () => {
  const { lineas } = await exportar();
  const filas = lineas.slice(1);
  assert.equal(filas.length, CATALOGO.length, 'precondición: una fila por producto');
  filas.forEach((l, i) => {
    const c = columnas(l);
    const p = CATALOGO[i];
    assert.equal(c[0], p.name, `columna 1 (name) movida en la fila ${i + 1}`);
    assert.equal(c[1], p.description ?? '', `columna 2 (description) movida en la fila ${i + 1}`);
    assert.equal(c[2], p.price, `columna 3 (price) movida en la fila ${i + 1}`);
    assert.equal(c[4], String(p.isActive), `columna 5 (isActive) movida en la fila ${i + 1}`);
  });
  // y el escapado del `;` dentro de una descripción sigue en pie (SCRUM-339)
  assert.ok(lineas.some((l) => l.includes('"Serie basica; con instalacion"')),
    '🔴 se ha perdido el entrecomillado de un campo con `;`: al reimportar partiría la fila');
});

// ═══ ✅ NEGATIVO — lo que NO es de este carril ════════════════════════════════════════════════

test('SCRUM-635 · ✅ NEGATIVO: `listProducts` no se toca — su apertura es de SCRUM-609', async () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/products/domain/products.service.ts'), 'utf8');
  const i = fuente.indexOf('export async function listProducts');
  assert.notEqual(i, -1, '🔴 CIEGO: no encuentro `listProducts`');
  const cuerpo = fuente.slice(i, fuente.indexOf('export async function exportProductsCsv'));
  assert.ok(/provider:/.test(cuerpo), 'sigue trayendo el proveedor, como antes');
  assert.ok(!/cost;|name;description/.test(cuerpo), 'y no se le ha colado nada del CSV');
});

// ═══ ⛔ EL MARGEN NO SE EXPORTA ═══════════════════════════════════════════════════════════════

test('SCRUM-635 · ⛔ el margen NO viaja calculado: el CSV trae precio y coste, no la resta', async () => {
  const { lineas } = await exportar();
  assert.ok(!/margen|margin/i.test(lineas[0]),
    '🔴 el margen se deriva en el catálogo. Exportarlo calculado crea un SEGUNDO sitio donde vive '
    + 'el mismo número, y es como uno de los dos se queda atrás. Decisión del asesor.');
  assert.equal(columnas(lineas[0]).length, 5, 'cinco columnas, ni una más');
});

// ═══ El coste ausente no se inventa ═══════════════════════════════════════════════════════════

test('SCRUM-635 · un producto SIN coste sale con el campo vacío, no con un cero', async () => {
  const { lineas } = await exportar();
  const caldera = lineas.find((l) => l.startsWith('Revision caldera'));
  assert.equal(columnas(caldera)[3], '',
    '🔴 un coste que no existe no es 0,00 €: eso daría un margen del 100 % inventado. Vacío es '
    + 'lo que hay, y es la misma familia que «un CERO no es está limpio, es no he mirado».');
});
