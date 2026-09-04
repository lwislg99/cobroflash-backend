// SCRUM-374 · `Job.direccion` NO LA ESCRIBE NADIE — y llevaba meses SELLADA dentro de la firma.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, Y POR QUÉ YA NO ESTÁ
//
// El sello de la firma (`contenidoCanonico`, v:1) metía `obra: job.direccion` dentro del hash. Y
// `Job.direccion` **no la escribe ningún camino de producto**: su único escritor en todo el árbol
// es `scripts/seed-video.mjs` (el sembrador de la demo). O sea: durante meses, TODOS los albaranes
// firmados se sellaron con el lugar de obra VACÍO — y el hash daba igual de válido, porque `null`
// es un valor perfectamente hashables.
//
// **Lo arregló SCRUM-300 (C5)**, no este ticket: el sello pasó a `Albaran.lugarEntrega` y la
// versión del sobre subió a 2 *precisamente por eso* — el propio código lo dice en
// `ALBARAN_CONTENIDO_VERSION_ACTUAL`: «subió de 1 a 2 porque el campo `obra` CAMBIÓ DE FUENTE».
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ VIGILA ESTE FICHERO, Y QUÉ NO
//
// ✅ Que la versión de HOY (v:2) tome la obra de `Albaran.lugarEntrega` y NO del Trabajo, ni
//    siquiera cayendo por detrás cuando el campo del albarán está vacío. Se comprueba EN
//    EJECUCIÓN, llamando a `obraSegunVersion`.
//
// ✅ Y que v:1 SIGA leyendo el Trabajo, que es lo que hace verificables los sobres viejos.
//
// ❌ NO prohíbe que el sellador MENCIONE `Job.direccion`. La primera versión de este fichero lo
//    hacía y salió ROJA con el código correcto: el despacho por versión necesita esa fuente para
//    recalcular un v:1. El invariante no es «no lo menciones», es «la versión de hoy no lo usa».
//
// ❌ NO vigila que nadie escriba `Job.direccion`. Sería un guard que se pone rojo el día que
//    alguien haga el trabajo bien: el schema declara esa columna como «se llenará en la UI (tarea
//    futura)», así que el escritor legítimo está PREVISTO. Un guard que dispara contra el futuro
//    previsto es un guard que alguien apaga. (Y un intento de medirlo por texto casó lecturas
//    como si fueran escrituras: `direccion: job.direccion` no escribe nada.)

import test from 'node:test';
import { soloEjecutable } from './_guard-texto.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALBARAN_CONTENIDO_VERSION_ACTUAL, obraSegunVersion } from '../dist/modules/jobs/domain/albaran.service.js';
import { versionLeeJobDireccion } from '../dist/modules/jobs/domain/jobDireccion.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELLADOR = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/domain/albaran.service.ts'), 'utf8');
const sinComentarios = (s) => soloEjecutable(s);

test('SCRUM-374 · SUELO: el sellador se lee y tiene su canónico', () => {
  // Si este fichero dejara de encontrarse o cambiara de forma, los asserts de abajo pasarían por
  // no ver nada — el verde hueco de siempre.
  assert.ok(SELLADOR.length > 2000, '🔴 no estoy leyendo el sellador');
  assert.match(SELLADOR, /contenidoCanonico/, '🔴 el canónico ha cambiado de nombre: revisar antes de fiarse');
});

/**
 * 🔴 SCRUM-438 · POR QUÉ ESTE FICHERO YA NO DICE «lugarEntrega» EN SU INVARIANTE.
 *
 * El test decía: «la versión de HOY toma la obra de `Albaran.lugarEntrega`». Eso pineaba una
 * VERSIÓN CONCRETA —la 2— disfrazada de invariante, y con v:3 se puso rojo sobre código correcto:
 * hoy la obra sale del BLOQUE CONGELADO del sobre, que a su vez se selló desde `lugarEntrega`.
 *
 * La forma correcta NO es cambiar el destino esperado por el de v:3 (con v:4 volvería a caer). El
 * defecto que este ticket cerró nunca fue «tiene que ser lugarEntrega»: era **que la versión de hoy
 * NO puede leer `Job.direccion`**, un campo que nadie escribe y que, si alguien escribiera, dejaría
 * cada firma nueva atada a un dato editable. Eso es lo que se pinea, y no caduca.
 */
const BLOQUE = Object.freeze({
  obra: 'SELLADO EN EL SOBRE', referenciaTrabajo: null, cliente: null, emisor: null, emisorNif: null,
});

test('SCRUM-374 · 🔴 la versión de HOY no saca la obra del Trabajo, sea cual sea esa versión', () => {
  // El defecto original, convertido en invariante — y comprobado EN EJECUCIÓN, no por texto.
  //
  // ⚠️ La primera versión de este test decía «el sellador no puede mencionar `job.direccion`» y
  // salió ROJA con el código CORRECTO: el sellador SÍ lo lee, y debe, porque el resolvedor necesita
  // esa fuente para recalcular un sobre **v:1**. Prohibirlo habría roto los vectores congelados de
  // SCRUM-369. El invariante no es «no lo menciones»: es «la versión de hoy no lo usa».
  assert.notEqual(
    obraSegunVersion(ALBARAN_CONTENIDO_VERSION_ACTUAL, {
      lugarEntrega: 'C/ Mayor 12', jobDireccion: 'NO USAR', contenidoCongelado: BLOQUE,
    }),
    'NO USAR',
    '🔴 la versión actual vuelve a sacar la obra de `Job.direccion`: es el defecto de SCRUM-374. ' +
    'Cada firma nueva quedaría atada a un campo que el producto deja editar.',
  );
  // Y con TODAS las demás fuentes vacías salvo el Trabajo, sigue sin caer a él por detrás.
  assert.notEqual(
    obraSegunVersion(ALBARAN_CONTENIDO_VERSION_ACTUAL, {
      lugarEntrega: null, jobDireccion: 'NO USAR', contenidoCongelado: { ...BLOQUE, obra: null },
    }),
    'NO USAR',
    '🔴 sin lugar de entrega se está cayendo a `Job.direccion`: eso sella un dato que nadie escribió',
  );

  // Y la sonda que usa la ruta que escribe la dirección contesta lo mismo. Son dos caminos hacia el
  // mismo hecho: si dijeran cosas distintas, uno de los dos estaría protegiendo lo que no toca.
  assert.equal(versionLeeJobDireccion(ALBARAN_CONTENIDO_VERSION_ACTUAL), false,
    '🔴 la sonda de SCRUM-424 dice que la versión de HOY lee `Job.direccion`.');
});

test('SCRUM-374 · pero v:1 SIGUE leyendo el Trabajo: los sobres viejos no se tocan', () => {
  // La otra mitad, y la que impide «arreglar» esto rompiendo el histórico. Un v:1 se selló con
  // `Job.direccion` —vacía— y recalcularlo con la fuente de hoy daría otro hash: falsificaría el
  // veredicto sobre documentos intactos.
  assert.equal(obraSegunVersion(1, { lugarEntrega: 'C/ Mayor 12', jobDireccion: null }), null);
  assert.equal(obraSegunVersion(1, { lugarEntrega: null, jobDireccion: 'C/ Sol 3' }), 'C/ Sol 3');
  assert.equal(versionLeeJobDireccion(1), true,
    '🔴 la sonda dice que un sobre v:1 NO lee `Job.direccion`, y es falso: escribirla dejaría esa ' +
    'firma sin poder verificarse.');
});

test('SCRUM-374 · SUELO: v:1 y la de HOY dan resultados DISTINTOS con las mismas fuentes', () => {
  // Si dieran lo mismo, los dos tests de arriba pasarían sin distinguir nada — y el despacho por
  // versión podría estar roto sin que se notara. Se cara contra la ACTUAL, no contra un 2 escrito
  // a mano: es lo único que no caduca con la versión siguiente.
  const fuentes = { lugarEntrega: 'ALBARÁN', jobDireccion: 'TRABAJO', contenidoCongelado: BLOQUE };
  assert.notEqual(
    obraSegunVersion(1, fuentes),
    obraSegunVersion(ALBARAN_CONTENIDO_VERSION_ACTUAL, fuentes),
    '🔴 SUELO: v:1 y la versión de hoy resuelven la obra igual — el despacho por versión no ' +
    'distingue nada y los tests de arriba no miden nada.',
  );
});
