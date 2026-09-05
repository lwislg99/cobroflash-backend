// tests/scrum609b-switch-tipo-articulo.test.mjs — SCRUM-609 (CAT-01)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SWITCH Producto | Servicio, que NO es una etiqueta que se guarda: OCULTA CAMPOS.
//
//     PRODUCTO  →  Nombre · Coste · Margen % · Precio · Proveedor · Descripción
//     SERVICIO  →  Nombre · Precio · Descripción
//
// 🔴 POR QUÉ ESTE TICKET PARÓ HASTA TENER COLUMNA: un switch sin dónde guardarse OLVIDA lo que
// elegiste en cuanto recargas, y eso es peor que no tenerlo. La columna `item_kind` va primero;
// esto la consume.
//
// ⚠️ LA REGLA SE EJECUTA, NO SE LEE. `debeEsconder` vive suelta y sin DOM justo para esto: los
// tests del panel no levantan navegador, así que una regla enterrada dentro del pintado sólo
// podría auditarse leyendo el fuente — y leer el fuente no ejecuta nada.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const sw = require_(path.join(RAIZ, 'public/dashboard/js/switchTipoArticulo.js'));

test('SCRUM-609b · SUELO: el módulo carga y publica la regla', () => {
  assert.equal(typeof sw, 'function');
  assert.equal(typeof sw.debeEsconder, 'function', '🔴 la regla no se puede EJECUTAR desde la suite.');
  assert.deepEqual(sw.VALORES, ['PRODUCTO', 'SERVICIO']);
  assert.deepEqual(sw.SOLO_PRODUCTO, ['cost', 'margen', 'providerId']);
});

test('SCRUM-609b · 🔴 SERVICIO esconde coste, margen y proveedor; PRODUCTO no', () => {
  for (const campo of sw.SOLO_PRODUCTO) {
    assert.equal(sw.debeEsconder('SERVICIO', false), true, `🔴 ${campo} se ve en un servicio.`);
    assert.equal(sw.debeEsconder('PRODUCTO', false), false, `🔴 ${campo} no se ve en un producto.`);
  }
});

test('SCRUM-609b · 🔴 INVARIANTE: un campo CON VALOR nunca se esconde', () => {
  // Es la invariante ② de CONT-01, copiada con su motivo: un dato invisible es un dato que nadie
  // va a corregir y que sigue viajando. Si un artículo marcado como Servicio tiene coste, SE VE.
  //
  // ⚠️ Y ES LA RESPUESTA AL CASO QUE EL ENCARGO MANDABA MEDIR («¿se borra el coste? ¿se conserva
  // oculto?»): ni una cosa ni la otra — se conserva VISIBLE. No hubo que decidirlo: ya estaba
  // decidido en CONT-01, con su porqué escrito.
  assert.equal(sw.debeEsconder('SERVICIO', true), false,
    '🔴 se está escondiendo un campo con algo escrito. Ese dato ya no lo puede corregir nadie.');
  assert.equal(sw.debeEsconder('PRODUCTO', true), false);
});

test('SCRUM-609b · 🔴 sin declarar (null) se ve TODO', () => {
  // `null` no es «es un servicio». Esconder por defecto sería suponer un lado que nadie ha dicho.
  assert.equal(sw.debeEsconder(null, false), false);
  assert.equal(sw.debeEsconder(undefined, false), false);
  // Y un valor que no es ninguno de los dos —metido por SQL a pelo— tampoco esconde.
  assert.equal(sw.debeEsconder('PRODUCTOS', false), false);
});

test('SCRUM-609b · 🔴 los valores del switch son LOS MISMOS que los del backend', () => {
  // Dos listas a mano que deben cuadrar es el fallo de `ADMIN_ONLY_ROUTES` (SCRUM-158): aquí
  // divergir daría un 400 `item_kind_invalid` DESPUÉS de que el profesional haya elegido.
  const schemas = fs.readFileSync(path.join(RAIZ, 'src/core/validation/schemas.ts'), 'utf8');
  const m = /export const ITEM_KIND = \[([^\]]+)\] as const;/.exec(schemas);
  assert.ok(m, '🔴 no encuentro `ITEM_KIND` en el backend: no puedo comparar nada.');
  const backend = m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
  assert.deepEqual(backend, sw.VALORES,
    '🔴 la lista del switch y el `z.enum` del backend han divergido.');
});

test('SCRUM-609b · el rótulo es el APROBADO, y ya no lleva marcador (SCRUM-667)', () => {
  // El fundador aprobó los tres textos TAL CUAL el 2-sep-2026 y se retiró el prefijo. El texto no
  // se toca (regla 30), así que aquí se fija LITERAL: si alguien lo abrevia o le añade puntuación,
  // esto cae. Antes este test exigía el marcador; ahora exige su ausencia y el texto exacto.
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/switchTipoArticulo.js'), 'utf8');
  assert.match(src, /leyenda\.textContent = 'Esto es';/);
  assert.match(src, /ETIQUETA = \{ PRODUCTO: 'Producto', SERVICIO: 'Servicio' \}/);
  assert.equal(sw.MARCADOR, undefined,
    '🔴 el switch vuelve a publicar un `MARCADOR`. Su copy está aprobada: si alguien necesita uno ' +
    'para un texto NUEVO, que sea suyo y entre en el censo, no reviviendo éste.');

  // Y que no quede el prefijo en ningún rótulo del fichero. Se mira el CÓDIGO, no los comentarios:
  // la cabecera nombra el marcador para explicar que se retiró, y cazarla sería un rojo por nada.
  const soloCodigo = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!soloCodigo.includes('[PENDIENTE'),
    '🔴 ha vuelto un marcador al código de este switch, que ya tiene su copy aprobada.');
});

test('SCRUM-609b · 🔴 la vista ESCRIBE el lado guardado al abrir, y REAPLICA', () => {
  // Sin esto el switch olvidaría lo elegido en cuanto recargas — que es la razón por la que este
  // ticket paró. Se comprueba sobre el fuente porque el modal necesita navegador; lo que la suite
  // sí ejecuta es la regla de arriba.
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/productsView.js'), 'utf8');
  const limpio = vista.split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
  // Suelo: que el desnudado no se haya comido la vista.
  assert.ok(limpio.includes('openEditModal'), '🔴 el desnudado se llevó la vista por delante.');

  assert.match(limpio, /_editSwitch\.escribir\(it\.itemKind/,
    '🔴 el modal no escribe el lado GUARDADO: el switch olvidaría lo elegido al recargar.');
  assert.match(limpio, /_editSwitch\.aplicar\(\)/,
    '🔴 se marca el radio pero no se REAPLICA la visibilidad: el modal enseñaría el lado nuevo '
    + 'con los campos del anterior, y el switch PARECERÍA funcionar.');
  assert.match(limpio, /itemKind: _editSwitch \? _editSwitch\.leer\(\) : null/,
    '🔴 la edición no manda el lado.');
  assert.match(limpio, /itemKind: altaSwitch\.leer\(\)/, '🔴 el alta no manda el lado.');
});

// ⚠️ LO QUE ESTE FICHERO NO CUBRE, DECLARADO: que el radio se PINTE marcado y que los campos
// desaparezcan de la pantalla necesita navegador. Aquí se ejecuta la REGLA y se comprueba que la
// vista la invoca en los cuatro puntos que hacen falta. La verificación visual es del fundador.
