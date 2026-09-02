// tests/scrum578-duplicados-identificador.test.mjs — SCRUM-578 (CONT-05)
//
// EL AVISO DE «ESTE VALOR YA LO USA OTRO CLIENTE», con los cinco controles del encargo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LOS TELÉFONOS SALEN DEL RANGO IMPOSIBLE, Y CON UN AVISO QUE COSTÓ MEDIR
//
// El rango imposible es `34` + `0` + 8 dígitos. Su tramo NACIONAL —el número sin el `34`— empieza
// entonces por `0`, y ahí hay una trampa:
//
//   telefonoDePrueba(1) = 34000000001  →  nacional `000000001`  →  normalizePhone = **""**
//
// Porque `normalizePhone` quita un `00` inicial por prefijo internacional, deja 7 dígitos y falla
// su propio `^\d{8,15}$`. O sea que el par natural para este test —`telefonoDePrueba(1)` y su
// forma sin prefijo— **compara "" contra "" y pasaría en VERDE sin probar nada**.
//
// Con `n` grande el tramo nacional empieza por `01…` y sobrevive. Por eso aquí los números salen
// de `telefonoDePrueba(12345678)` y no de `telefonoDePrueba(1)`, y por eso hay un SUELO que exige
// que el fixture no sea la cadena vacía: sin él, este fichero entero podría pintar verde sobre
// nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

// Solo la SUPERFICIE PUBLICA. `canonParaComparar`, `IDENTIFICADORES` y `PREFIJO_POR_DEFECTO`
// dejaron de exportarse (guard de SCRUM-411: eran export huerfano, solo los consumia este test).
// Se prueban a traves de `buscarCoincidencias`, que es lo que usa el producto de verdad.
const { buscarCoincidencias, canonEmail, canonNif, formasBuscables } =
  await import('../dist/modules/system/domain/identificadoresDuplicados.js');
import fsNode from 'node:fs';
import pathNode from 'node:path';

/** ¿Coinciden dos valores del MISMO campo? Se pregunta por la superficie publica. */
const coinciden = (campo, a, b) =>
  buscarCoincidencias({ id: 0, [campo]: a }, [{ id: 2, [campo]: b }]).length > 0;
const { normalizePhone } = await import('../dist/core/utils/utils.js');

// El par de la evidencia, en el rango imposible: el MISMO número escrito con y sin prefijo.
const COMPLETO = telefonoDePrueba(12345678); // 34012345678
const NACIONAL = COMPLETO.slice(2);          // 012345678
const CON_PREFIJO = `+34 ${NACIONAL}`;
const OTRO = telefonoDePrueba(23456789);

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-578 · SUELO: los fixtures NO son la cadena vacía', () => {
  // El falso verde que este fichero podría tener: si `normalizePhone` se comiera los números de
  // prueba, todas las comparaciones de abajo serían "" contra "" y pasarían sin medir nada.
  // Un valor que se canoniza a «» no coincide ni consigo mismo (el vacio se descarta), asi que
  // `coinciden(campo, v, v)` es la forma de comprobarlo SIN exportar el canonizador.
  for (const [nombre, v] of Object.entries({ COMPLETO, NACIONAL, CON_PREFIJO, OTRO })) {
    assert.ok(coinciden('phone', v, v), `🔴 el fixture ${nombre} (${v}) se canoniza a "": este test no mediría nada`);
  }
  // Y la trampa concreta, fijada para que nadie vuelva a caer en ella con `telefonoDePrueba(1)`.
  assert.equal(
    normalizePhone(telefonoDePrueba(1).slice(2)), '',
    '🔴 ha cambiado el comportamiento del `00`: revisa el comentario de cabecera de este fichero',
  );
});

test('SCRUM-578 · SUELO: el módulo sabe comparar los TRES identificadores', () => {
  assert.equal(typeof buscarCoincidencias, 'function');
  assert.ok(coinciden('phone', COMPLETO, COMPLETO), '🔴 no compara phone');
  assert.ok(coinciden('email', 'a@b.com', 'a@b.com'), '🔴 no compara email');
  assert.ok(coinciden('taxId', 'B12345678', 'B12345678'), '🔴 no compara taxId');
});

// ── EL CASO DE LA EVIDENCIA ──────────────────────────────────────────────────────────────

test('SCRUM-578 · 🔴 ANTES: `normalizePhone` a secas NO ve el duplicado de la evidencia', () => {
  // Ésta es la prueba de que el defecto existe, y de que llevar la normalización donde falta
  // NO basta: los dos valores del ticket siguen siendo distintos después de normalizar.
  assert.notEqual(
    normalizePhone(CON_PREFIJO), normalizePhone(NACIONAL),
    '🔴 si esto empieza a coincidir, `normalizePhone` ha cambiado y hay ~40 llamadores que lo notan',
  );
});

test('SCRUM-578 · ✅ DESPUÉS: con la forma canónica, el duplicado de la evidencia SÍ salta', () => {
  assert.ok(coinciden('phone', CON_PREFIJO, NACIONAL), '🔴 el par del ticket no coincide');

  const existentes = [{ id: 2, phone: NACIONAL }];
  const hallado = buscarCoincidencias({ id: 0, phone: CON_PREFIJO }, existentes);
  assert.equal(hallado.length, 1, '🔴 no se avisa del duplicado del ticket');
  assert.deepEqual(hallado[0], { campo: 'phone', campoExistente: 'phone', customerId: 2 });
});

// ── CONTROL NEGATIVO: el que evita el ruido ──────────────────────────────────────────────

test('SCRUM-578 · 🔴 CONTROL NEGATIVO: teléfonos DISTINTOS no disparan nada', () => {
  const hallado = buscarCoincidencias({ id: 0, phone: COMPLETO }, [{ id: 2, phone: OTRO }]);
  assert.deepEqual(hallado, [], '🔴 avisa de un duplicado que no existe: el aviso sería ruido');
});

test('SCRUM-578 · 🔴 EL FALSO POSITIVO QUE MÁS DAÑO HARÍA: dos clientes SIN teléfono', () => {
  // `canon(null)` es "". Sin descartar el vacío, TODO cliente sin teléfono sería duplicado de
  // todos los demás sin teléfono, y el aviso saltaría en cada alta.
  const sinNada = [{ id: 2, phone: null, email: null, taxId: null }];
  assert.deepEqual(
    buscarCoincidencias({ id: 0, phone: null, email: null, taxId: null }, sinNada), [],
    '🔴 el vacío está contando como coincidencia',
  );
  assert.deepEqual(buscarCoincidencias({ id: 0, phone: '' }, [{ id: 2, phone: '' }]), []);
});

// ── EL NOMBRE, NUNCA ─────────────────────────────────────────────────────────────────────

test('SCRUM-578 · 🔴 el NOMBRE nunca avisa — dos «María García» con datos distintos, silencio', () => {
  const a = { id: 0, name: 'María García', phone: COMPLETO };
  const b = { id: 2, name: 'María García', phone: OTRO };
  assert.deepEqual(buscarCoincidencias(a, [b]), [], '🔴 el nombre está disparando el aviso');
  // Y estructuralmente, leyendo el fuente: `name` no puede aparecer como campo identificador.
  // Se lee el `.ts` y no el `.js` compilado porque es donde vive la lista, y se busca la FORMA
  // exacta de una entrada (`campo: 'name'`), no la palabra suelta — que sale en los comentarios.
  const fuente = fsNode.readFileSync(
    pathNode.join(import.meta.dirname, '../src/modules/system/domain/identificadoresDuplicados.ts'), 'utf8');
  assert.ok(fuente.length > 500, '🔴 SUELO: no he leído el módulo, este guard no mediría nada');
  assert.ok(/campo:\s*'phone'/.test(fuente), '🔴 SUELO: el patrón no reconoce ni una entrada real');
  assert.equal(
    /campo:\s*'name'/.test(fuente), false,
    '🔴 `name` ha entrado en los identificadores: el aviso pasaría a ser ruido que nadie lee',
  );
});

// ── EMAIL Y NIF ──────────────────────────────────────────────────────────────────────────

test('SCRUM-578 · el mismo email en dos clientes avisa (y no le importan mayúsculas ni espacios)', () => {
  const hallado = buscarCoincidencias(
    { id: 0, email: '  Maria.Garcia@Example.com ' },
    [{ id: 2, email: 'maria.garcia@example.com' }],
  );
  assert.equal(hallado.length, 1, '🔴 no avisa del email repetido');
  assert.equal(hallado[0].campo, 'email');
});

test('SCRUM-578 · el mismo NIF/CIF avisa (y no le importan guiones ni mayúsculas)', () => {
  const hallado = buscarCoincidencias({ id: 0, taxId: 'b-1234 5678' }, [{ id: 2, taxId: 'B12345678' }]);
  assert.equal(hallado.length, 1, '🔴 no avisa del NIF repetido');
  assert.equal(hallado[0].campo, 'taxId');
});

// ── ES AVISO, NO BLOQUEO ─────────────────────────────────────────────────────────────────

test('SCRUM-578 · 🔴 es AVISO y no bloqueo: coincidir NO impide nada', () => {
  // El módulo sólo DEVUELVE coincidencias. Los casos legítimos —marido y mujer con el mismo
  // móvil, dos comunidades del mismo administrador con el mismo email— tienen que poder guardarse.
  const hallado = buscarCoincidencias({ id: 0, phone: COMPLETO }, [{ id: 2, phone: COMPLETO }]);
  assert.equal(hallado.length, 1);
  assert.ok(Array.isArray(hallado), '🔴 debe devolver una lista, no lanzar');
});

test('SCRUM-578 · editar un cliente no avisa de que choca CONSIGO MISMO', () => {
  assert.deepEqual(buscarCoincidencias({ id: 7, phone: COMPLETO }, [{ id: 7, phone: COMPLETO }]), []);
});

// ── LO QUE 590 NECESITARÁ ────────────────────────────────────────────────────────────────

test('SCRUM-578 · el cruce entre campos YA funciona: es lo que SCRUM-590 necesita', () => {
  // El cruce móvil↔fijo no se puede probar hoy —hay UN solo campo de teléfono— pero el mecanismo
  // que lo hará posible sí: la búsqueda cruza TODOS los identificadores contra TODOS. Se prueba
  // con los campos que existen para que 590 sólo tenga que añadir una entrada a la lista.
  // El valor tiene que ser válido para LAS DOS canonizaciones, o el candidato se descarta por
  // vacío y el test pasaría sin cruzar nada. `B12345678` no vale: `normalizePhone` lo rechaza por
  // la letra y el lado teléfono queda en «». Se usa un número —el caso real es alguien que teclea
  // el teléfono en la casilla del NIF.
  const raro = COMPLETO;
  assert.ok(coinciden('phone', raro, raro), 'suelo del caso: el valor vale como teléfono');
  assert.notEqual(canonNif(raro), '', 'suelo del caso: el valor vale como NIF');

  const hallado = buscarCoincidencias({ id: 0, phone: raro }, [{ id: 2, taxId: raro }]);
  assert.equal(hallado.length, 1, '🔴 el cruce entre campos distintos no funciona: 590 tendría que rehacerlo');
  assert.deepEqual(hallado[0], { campo: 'phone', campoExistente: 'taxId', customerId: 2 });
});

// ── LAS FORMAS BUSCABLES ─────────────────────────────────────────────────────────────────

test('SCRUM-578 · `formasBuscables` cubre las dos formas guardadas del mismo número', () => {
  // Hace falta para poder buscar POR ÍNDICE en vez de leerse la tabla entera: un alta nueva con
  // prefijo tiene que encontrar a una fila vieja guardada sin él.
  const formas = formasBuscables(COMPLETO);
  assert.ok(formas.includes(COMPLETO), '🔴 no busca la forma con prefijo');
  assert.ok(formas.includes(NACIONAL), '🔴 no busca la forma SIN prefijo: no encontraría las filas viejas');
  const desdeNacional = formasBuscables(NACIONAL);
  assert.ok(desdeNacional.includes(COMPLETO), '🔴 desde el nacional no busca la forma con prefijo');
});
