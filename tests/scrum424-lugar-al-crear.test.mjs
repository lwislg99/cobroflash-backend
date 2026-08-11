// SCRUM-424 · Lo que se escribe al CREAR un albarán se perdía en silencio.
//
// Sin gate: se compara por AST lo que el PATCH acepta contra lo que el create escribe. Ni BD, ni red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO NO ES «UN CAMPO MÁS»
//
// `lugarEntrega` entra en el **HASH DEL SOBRE v:2** del albarán. Un albarán creado y firmado sin él
// queda **SELLADO** sin él — y sellado no se edita (regla 29). No es un dato que se pueda añadir
// después: o está al crear, o ese documento no lo tiene nunca.
//
// El campo estaba pintado, con su rótulo aprobado, y lo que el profesional tecleaba al crear **no
// llegaba a la fila**.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

/** Lo que el PATCH acepta del cuerpo, y lo que el create escribe. Derivados, no listas a mano. */
function conjuntos() {
  const alb = leer('src/modules/jobs/app/routes/albaranes.routes.ts');
  const jobs = leer('src/modules/jobs/app/routes/jobs.routes.ts');

  const i = alb.indexOf("router.patch('/:id'");
  const j = alb.indexOf('router.', i + 10);
  const patch = [...new Set([...alb.slice(i, j).matchAll(/req\.body\?\.([a-zA-Z]+)/g)].map((m) => m[1]))].sort();

  const k = jobs.indexOf('tx.albaran.create');
  const cre = jobs.slice(k, jobs.indexOf('});', k));
  const post = [...new Set([...cre.matchAll(/^\s{10}([a-zA-Z]+)[,:]/gm)].map((m) => m[1]))].sort();

  return { patch, post };
}

test('SCRUM-424 · SUELO: los DOS conjuntos se leen, o no se compara nada', () => {
  const { patch, post } = conjuntos();
  assert.ok(
    patch.length > 0,
    '🔴 ESCÁNER CIEGO: cero campos leídos del PATCH. «El PATCH no acepta nada» y «no supe mirar» ' +
      'son el mismo resultado y significan lo contrario.',
  );
  assert.ok(
    post.length > 0,
    '🔴 ESCÁNER CIEGO: cero campos en el `create`. Con cero, la comparación de abajo pasaría por ' +
      'vacío — y este fichero daría verde sobre el defecto que persigue. (Me pasó al medirlo: el ' +
      'extractor buscaba el `create` en el fichero equivocado.)',
  );
  assert.ok(patch.length >= 6, `🔴 el PATCH acepta ${patch.length} campos y se midieron 6`);
});

test('SCRUM-424 · 🔴 EL VECTOR: `lugarEntrega` se guarda AL CREAR, no solo al editar', () => {
  const { post } = conjuntos();
  assert.ok(
    post.includes('lugarEntrega'),
    '🔴 SE PIERDE EL LUGAR DE ENTREGA AL CREAR.\n\n' +
      '  El PATCH lo guarda y el `create` no lo escribe, así que lo que el profesional teclea al\n' +
      '  crear el albarán **no llega a la fila**. Y no se puede añadir después: `lugarEntrega` entra\n' +
      '  en el HASH DEL SOBRE v:2 — firmado sin él, queda SELLADO sin él (regla 29).\n' +
      `  Campos que el create escribe hoy: ${post.join(', ')}`,
  );
});

test('SCRUM-424 · y `fechaEntrega` también: era el MISMO defecto, no un campo suelto', () => {
  // La medición pedía enumerar los dos conjuntos y enfrentarlos. El resultado fue que se perdía
  // MÁS de un campo — y el segundo se habría quedado si solo se hubiera arreglado el nombrado.
  const { post } = conjuntos();
  assert.ok(
    post.includes('fechaEntrega'),
    '🔴 SE PIERDE LA FECHA DE ENTREGA AL CREAR, igual que el lugar. Es el campo nº 1 del ticket de ' +
      'C5 y el día real de la entrega, distinto del de emisión (SCRUM-67).',
  );
});

test('SCRUM-424 · no queda NINGÚN campo del PATCH sin escribir al crear (salvo `fecha`)', () => {
  const { patch, post } = conjuntos();
  // `fecha` es la excepción declarada: el documento SIEMPRE tiene una y la pone el `@default(now())`
  // del schema. No se pierde nada — el resto sí se perdería.
  const perdidos = patch.filter((c) => !post.includes(c) && c !== 'fecha');
  assert.deepEqual(
    perdidos, [],
    `🔴 HAY CAMPOS QUE EL PATCH GUARDA Y EL CREATE NO: ${perdidos.join(', ')}\n\n` +
      '  Es el mismo defecto de este ticket con otro nombre: el profesional los escribe al crear y\n' +
      '  desaparecen. Si uno es legítimo (como `fecha`, que la pone el schema), decláralo aquí con\n' +
      '  su motivo en vez de dejarlo fuera en silencio.',
  );
});

test('SCRUM-424 · CONTROL NEGATIVO: crear SIN lugar de entrega sigue funcionando', () => {
  // El helper del PATCH devuelve null ante vacío, y el create usa EL MISMO. Crear sin el campo no
  // puede romperse ni guardar basura: `null` es su valor legítimo.
  const jobs = leer('src/modules/jobs/app/routes/jobs.routes.ts');
  assert.match(
    jobs, /lugarEntrega: normalizarLugarEntrega\(req\.body\?\.lugarEntrega\)/,
    '🔴 el create ya no usa el helper del PATCH. Dos formas de leer el mismo campo acaban ' +
      'divergiendo — y la del PATCH es la que tiene el suelo: vacío → NULL, nunca el domicilio fiscal.',
  );
  // Y no se ha inventado un valor por defecto.
  assert.doesNotMatch(
    jobs, /lugarEntrega:\s*(req\.body\?\.lugarEntrega \|\||['"`])/,
    '🔴 se está sustituyendo el vacío por algo. Un lugar de entrega inventado es peor que ninguno.',
  );
});

test('SCRUM-424 · una fecha de entrega ILEGIBLE se rechaza, no se guarda como hoy', () => {
  const jobs = leer('src/modules/jobs/app/routes/jobs.routes.ts');
  assert.match(
    jobs, /isNaN\(d\.getTime\(\)\)[^\n]*invalid_date/,
    '🔴 el create acepta una fecha de entrega ilegible. Guardarla como hoy sería inventar el día de ' +
      'la entrega — el defecto de SCRUM-397 en otro campo.',
  );
});
