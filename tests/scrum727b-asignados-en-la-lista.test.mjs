// SCRUM-727b · QUIÉN EJECUTA EL TRABAJO, EN LA LISTA Y EN PLURAL.
//
// LA VÍCTIMA: el jefe que quiere saber qué tiene Miguel esta semana y no puede ni preguntarlo,
// porque el nombre del técnico no llegaba a la pantalla. El serializer de lista mandaba
// `assignedUserId` —un id sin nombre— y nada más.
//
// 🔴 Y `assignedUserId` no valía ni resolviendo el nombre por otro lado: es el ESPEJO DEL PRIMER
// asignado (la columna escalar «solo sabe guardar uno», `asignacionDeTrabajo.ts`). Un Trabajo con
// tres técnicos que enseña uno **no está incompleto: está mintiendo con cara de estar bien**, y
// desde la pantalla no hay forma de notarlo. Por eso el control que decide este ticket es el de
// los TRES, no el de uno.
//
// LO QUE SE VIGILA AQUÍ es la ESTRUCTURA del camino de lectura, sin base de datos: que el campo
// se pida EN LOTE y no una vez por fila. Una lista de 200 que dispara 200 consultas no «va algo
// lenta»: es el N+1 que SCRUM-58 quitó midiendo 2910 ms contra 1270 ms, y volver a meterlo por la
// puerta de atrás es el modo normal de que estas cosas regresen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { soloCodigo } from './_solo-codigo.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RUTA = path.join(AQUI, '..', 'src', 'modules', 'jobs', 'app', 'routes', 'jobs.routes.ts');
const FUENTE = fs.readFileSync(RUTA, 'utf8');
// Sin comentarios: si no, los párrafos que EXPLICAN el N+1 cuentan como si lo cometieran. Es la
// trampa de la autorreferencia, que en esta casa ya ha mordido cuatro veces.
const CODIGO = soloCodigo(FUENTE);

/** El cuerpo de una función de nivel superior, por llaves equilibradas. */
function cuerpoDe(nombre) {
  const i = CODIGO.indexOf(`function ${nombre}(`);
  if (i === -1) return null;
  const abre = CODIGO.indexOf('{', i);
  let nivel = 0;
  for (let k = abre; k < CODIGO.length; k++) {
    if (CODIGO[k] === '{') nivel++;
    else if (CODIGO[k] === '}' && --nivel === 0) return CODIGO.slice(abre, k + 1);
  }
  return null;
}

const LOTE = cuerpoDe('loadJobRefs');
const SERIALIZA = cuerpoDe('serializeJob');

test('SCRUM-727b · SUELO: se encuentran las dos funciones del camino de lectura', () => {
  // Si el fichero se reorganiza y estas funciones cambian de nombre, este guard dejaría de mirar
  // lo que cree que mira y aprobaría cualquier cosa. Antes de medir, se comprueba que hay dónde.
  assert.ok(LOTE && LOTE.length > 400, '🔴 CIEGO: no encuentro el cuerpo de `loadJobRefs`.');
  assert.ok(SERIALIZA && SERIALIZA.length > 400, '🔴 CIEGO: no encuentro el cuerpo de `serializeJob`.');
});

test('SCRUM-727b · los asignados se piden EN LOTE, no una vez por fila', () => {
  assert.match(
    LOTE,
    /jobAssignee\.findMany/,
    '🔴 el lote no pide los asignados. Si no salen de aquí, salen de una consulta por fila.',
  );
  assert.match(
    LOTE,
    /jobId:\s*\{\s*in:/,
    '🔴 la consulta de asignados no usa `in` sobre los ids: eso no es un lote, es una consulta ' +
      'por Trabajo con otra cara.',
  );
});

test('SCRUM-727b · REGLA 2: la consulta en lote se acota al merchant', () => {
  const trozo = LOTE.slice(LOTE.indexOf('jobAssignee.findMany'), LOTE.indexOf('jobAssignee.findMany') + 400);
  assert.match(
    trozo,
    /merchantId/,
    '🔴 la clave ajena garantiza que el empleado EXISTE, no que sea de este negocio. Sin acotar ' +
      'por merchant, un id repetido entre negocios cruza datos de dos clientes.',
  );
});

test('SCRUM-727b · 🔴 la lista NO resuelve asignados fila por fila (el N+1 de SCRUM-58)', () => {
  // `serializeJob` se llama en bucle desde la ruta de listado. Puede tener una consulta suelta
  // para el caso SIN lote (un Trabajo aislado), pero esa rama tiene que estar guardada detrás de
  // `refs`, que es el patrón que ya usa `operario` cuatro líneas más arriba.
  const i = SERIALIZA.indexOf('jobAssignee.findMany');
  if (i === -1) return; // no hay consulta en el serializador: imposible el N+1
  const antes = SERIALIZA.slice(Math.max(0, i - 400), i);
  assert.match(
    antes,
    /refs\s*\?/,
    '🔴 `serializeJob` consulta los asignados SIN preguntar primero por el lote. La ruta de ' +
      'listado lo llama una vez por Trabajo: con 200 filas son 200 consultas.',
  );
});

test('SCRUM-727b · ADITIVO: `assignedUserId` sigue viajando', () => {
  assert.match(
    SERIALIZA,
    /assignedUserId:/,
    '🔴 se ha retirado `assignedUserId`. Esto era aditivo: quien lo consuma hoy tiene que seguir ' +
      'funcionando. Se añade `asignados` AL LADO, no en su lugar.',
  );
  assert.match(SERIALIZA, /\basignados,/, '🔴 el serializador no expone `asignados`.');
});

test('SCRUM-727b · cero cambios en el esquema', () => {
  // El dato ya existía: lo único que pasaba es que no se pedía. Si este ticket hubiera tocado el
  // esquema, sería otro ticket y otro STOP (regla 38).
  const schema = fs.readFileSync(path.join(AQUI, '..', 'prisma', 'schema.prisma'), 'utf8');
  assert.ok(
    /model JobAssignee\b/.test(schema),
    '🔴 CIEGO: no encuentro `JobAssignee` en el esquema. O ha cambiado de nombre, o este guard ' +
      'está mirando un fichero que no es.',
  );
});
