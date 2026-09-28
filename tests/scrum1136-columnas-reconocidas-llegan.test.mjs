// SCRUM-1136 · UNA COLUMNA QUE EL SERVIDOR RECONOCE NO SE PIERDE POR EL CAMINO.
//
// El defecto no era «el desplegable es corto»: era PÉRDIDA SILENCIOSA DE DATOS. El servidor
// (`proponerMapeo`) reconocía NIF, MOVIL, ETIQUETAS… y proponía `taxId`, `mobile`, `tags`; la
// pantalla sólo tenía opción para cuatro campos, así que el `<select>` de esas columnas se quedaba
// en «— dejar fuera —», el aviso de columna desconocida no salía —porque sí se había reconocido— y
// el cliente se creaba SIN esos datos. Nada decía nada.
//
// Por eso el juez mide el VIAJE entero y su EFECTO, no las opciones:
//   CSV real → `proponerMapeo` de `dist` (lo que devuelve /import/preparar) → el modal REAL
//   (`csvImport.js` en el banco de vistas) → el cuerpo que manda a /import → `importarClientes`
//   de `dist` → ¿qué cliente se crea?
//
// ⚠️ HUECO DEL BANCO, DECLARADO: el mini-DOM parsea las `<option>` con su atributo `selected`, pero
// no deriva `select.value` de ellas como hace el navegador (queda ''). Aquí se aplica la regla del
// estándar —la opción marcada `selected`, o la primera— sobre el marcado que PINTA el producto, y
// se dispara `change` como haría el navegador al pintar. No se inventa ningún valor: si la opción
// no existe en el marcado, no hay nada que elegir y sale '' («dejar fuera»), que es el defecto.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';
import { constaAprobado } from './_microcopy-aprobada.mjs';
import {
  proponerMapeo, importarClientes, CAMPOS_CLIENTE,
} from '../dist/modules/system/domain/importarClientes.service.js';
import { trocearCsv } from '../dist/core/csv/csv.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const espera = () => new Promise((r) => setTimeout(r, 20));

/** El `value` que el NAVEGADOR le daría a un `<select>` recién pintado (ver cabecera). */
export function valorComoNavegador(sel) {
  const opciones = sel.hijos.filter((h) => h.tagName === 'OPTION');
  const elegida = opciones.find((o) => o.hasAttribute('selected')) || opciones[0];
  return elegida ? elegida.getAttribute('value') : '';
}

/**
 * Pasa `csv` por el modal real y devuelve lo que el SERVIDOR crearía con lo que el modal manda.
 * `selects` son las opciones que pintó cada columna, para las comprobaciones de rótulos.
 */
async function importarPorLaPantalla(csv) {
  const peticiones = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, op) => {
      const u = String(url || '');
      const cuerpo = op && op.body ? JSON.parse(op.body) : null;
      peticiones.push({ u, cuerpo });
      if (u.endsWith('/admin/customers/import/preparar')) {
        return { ok: true, codificacion: 'utf-8', alternativa: 'windows-1252', primeraFila: 'x',
          columnas: proponerMapeo(trocearCsv(csv).cabecera) };
      }
      if (u.endsWith('/admin/customers/import')) return { ok: true, creados: 1, omitidos: 0, rechazos: [] };
      return [];
    },
  });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  const { ctx } = banco;
  assert.equal(typeof ctx.openImportCsvModal, 'function', '🔴 CIEGO: no existe openImportCsvModal');
  ctx.openImportCsvModal();
  const body = ctx.document.body;
  // El texto PEGADO: salta el paso de los acentos y va directo al mapeo, con los mismos bytes.
  body.querySelector('#csv-paste').value = csv;
  body.querySelector('#csv-seguir').onclick();
  await espera();

  const selects = [...body.querySelectorAll('.csv-campo')];
  const columnas = trocearCsv(csv).cabecera.length;
  assert.equal(selects.length, columnas, `🔴 CIEGO: ${selects.length} desplegables pintados y el CSV tiene ${columnas} columnas`);
  for (const s of selects) s.value = valorComoNavegador(s);
  selects[0].disparar('change');

  const boton = body.querySelector('#csv-importar');
  assert.ok(boton, '🔴 CIEGO: no hay botón «Está bien, importar»');
  await boton.onclick();
  await espera();
  const envio = peticiones.find((p) => p.u.endsWith('/admin/customers/import'));
  assert.ok(envio && envio.cuerpo, '🔴 CIEGO: la pantalla no mandó el import');

  // El SERVIDOR con lo que la pantalla mandó: los mismos bytes, la misma codificación, su mapeo.
  const texto = Buffer.from(envio.cuerpo.fichero, 'base64').toString('utf8');
  const creados = [];
  const cliente = { findFirst: async () => null, create: async ({ data }) => { creados.push(data); return data; } };
  const r = await importarClientes(1, texto, envio.cuerpo.mapeo, cliente);
  return {
    r, creados, mapeo: envio.cuerpo.mapeo,
    opciones: selects.map((s) => s.hijos.filter((h) => h.tagName === 'OPTION')
      .map((o) => ({ value: o.getAttribute('value'), texto: o._texto }))),
  };
}

const CSV_CARTERA = 'NOMBRE;TELEFONO;NIF;MOVIL;EMAIL\n'
  + 'Ana Prueba 1136;34000000001;12345678Z;34000000002;ana1136@example.test\n';

test('SCRUM-1136 · 🔴 el NIF y el móvil de un CSV LLEGAN al cliente creado (antes se perdían en silencio)', async () => {
  const { r, creados, mapeo } = await importarPorLaPantalla(CSV_CARTERA);
  assert.equal(r.creados, 1, `🔴 CIEGO: no se creó el cliente (rechazos: ${JSON.stringify(r.rechazos)})`);
  const c = creados[0];
  // Suelo: lo que ya llegaba antes sigue llegando. Si esto cae, el banco no está midiendo.
  assert.equal(c.name, 'Ana Prueba 1136');
  assert.equal(c.email, 'ana1136@example.test');
  assert.ok(c.phone, '🔴 CIEGO: ni el teléfono llegó — el viaje no está midiendo el mapeo');
  // Lo que se perdía.
  assert.equal(c.taxId, '12345678Z', `🔴 el NIF se perdió por el camino · mapeo mandado: ${JSON.stringify(mapeo)}`);
  assert.ok(c.mobile, `🔴 el móvil se perdió por el camino · mapeo mandado: ${JSON.stringify(mapeo)}`);
});

test('SCRUM-1136 · los DOCE campos que el servidor acepta llegan, cada uno a su sitio', async () => {
  // Una columna por campo, con la cabecera que escribiría un fontanero. La población es
  // CAMPOS_CLIENTE entero (lo comprueba el primer assert), no una lista escrita aquí.
  // ⚠️ No se usa el nombre del campo como cabecera: el servidor normaliza la cabecera a minúsculas
  // y la compara con `billingAddress` tal cual, así que las camelCase no casan «exacta». No es de
  // este ticket; va declarado en docs/master/SCRUM-1136.md.
  const CABECERA = {
    name: 'NOMBRE', phone: 'TELEFONO', mobile: 'MOVIL', email: 'EMAIL', notes: 'NOTAS', taxId: 'NIF',
    tags: 'ETIQUETAS', billingAddress: 'DIRECCION', billingCity: 'POBLACION', billingPostalCode: 'CP',
    billingProvince: 'PROVINCIA', billingCountry: 'PAIS',
  };
  const valores = {
    name: 'Bea Prueba 1136', phone: '34000000003', mobile: '34000000004', email: 'bea1136@example.test',
    notes: 'nota', taxId: '12345678Z', tags: 'vip', billingAddress: 'Calle Mayor 3',
    billingCity: 'Alcalá', billingPostalCode: '28801', billingProvince: 'Madrid', billingCountry: 'ES',
  };
  assert.deepEqual(Object.keys(valores).sort(), [...CAMPOS_CLIENTE].sort(),
    '🔴 el servidor acepta otros campos que los de este caso: actualízalo, no lo recortes');
  const csv = CAMPOS_CLIENTE.map((k) => CABECERA[k]).join(';') + '\n' + CAMPOS_CLIENTE.map((k) => valores[k]).join(';') + '\n';
  const { r, creados, mapeo } = await importarPorLaPantalla(csv);
  assert.equal(r.creados, 1, `🔴 no se creó el cliente (rechazos: ${JSON.stringify(r.rechazos)})`);
  assert.deepEqual(Object.keys(mapeo).sort(), [...CAMPOS_CLIENTE].sort(),
    `🔴 la pantalla dejó fuera columnas que el servidor reconoció: ${JSON.stringify(mapeo)}`);
  const c = creados[0];
  for (const k of ['name', 'email', 'notes', 'taxId', 'billingAddress', 'billingCity', 'billingPostalCode', 'billingProvince', 'billingCountry']) {
    assert.equal(c[k], valores[k], `🔴 ${k} no llegó como venía en el CSV`);
  }
  assert.ok(c.phone && c.mobile, '🔴 teléfono o móvil no llegaron');
  assert.ok(JSON.stringify(c.tags).includes('vip'), `🔴 las etiquetas no llegaron: ${JSON.stringify(c.tags)}`);
});

test('SCRUM-1136 · cada desplegable ofrece EXACTAMENTE los campos del servidor, con los rótulos firmados', async () => {
  const { opciones } = await importarPorLaPantalla(CSV_CARTERA);
  for (const ops of opciones) {
    assert.equal(ops[0].value, '', 'la primera opción sigue siendo «dejar fuera»');
    // Mismo conjunto Y mismo orden que el servidor: un orden que sale de una sola fuente no diverge.
    assert.deepEqual(ops.slice(1).map((o) => o.value), [...CAMPOS_CLIENTE]);
  }
  const NUEVOS = ['mobile', 'taxId', 'tags', 'billingAddress', 'billingCity', 'billingPostalCode', 'billingProvince', 'billingCountry'];
  for (const campo of NUEVOS) {
    const texto = opciones[0].find((o) => o.value === campo).texto;
    assert.ok(constaAprobado(texto).some((f) => f.includes('SCRUM-1136')),
      `🔴 el rótulo de ${campo} («${texto}») no es el firmado en SCRUM-1136 comentario 17445`);
  }
});

test('SCRUM-1136 · CONTROL: el helper del navegador elige la marcada, o la primera, y nada más', () => {
  const op = (value, selected) => ({ tagName: 'OPTION', hasAttribute: (k) => k === 'selected' && selected, getAttribute: () => value });
  assert.equal(valorComoNavegador({ hijos: [op('', false), op('taxId', true)] }), 'taxId');
  assert.equal(valorComoNavegador({ hijos: [op('', false), op('name', false)] }), '');
  assert.equal(valorComoNavegador({ hijos: [] }), '');
});

test('SCRUM-1136 · CONTROL NEGATIVO: un rótulo parecido al firmado NO consta aprobado', () => {
  assert.deepEqual(constaAprobado('País (código ej. ES)'), []);
  assert.deepEqual(constaAprobado('País (ISO, ej. ES)'), []);
  assert.deepEqual(constaAprobado('NIF'), []);
});
