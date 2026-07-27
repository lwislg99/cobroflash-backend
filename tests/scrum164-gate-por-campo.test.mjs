import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adminOnlyJobField, ADMIN_ONLY_JOB_FIELDS } from '../dist/core/http/roleCapabilities.js';
import { FIELD_LEVEL_ROLE_GATES } from '../dist/core/http/adminRouteDeclarations.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * SCRUM-164 — el gate por CAMPO de `PATCH /admin/jobs/:id`, visible y probado.
 *
 * PREMISA DEL TICKET CORREGIDA: proponía normalizarlo a `requireRole('admin')`. Eso haría
 * admin-only la ruta ENTERA y dejaría al técnico sin poder tocar el estado de sus propios
 * trabajos — justo lo que SCRUM-120 construyó a propósito. El gate por campo es correcto; lo
 * que estaba mal es que fuera un `if` suelto, invisible para la derivación y sin un solo test.
 *
 * Estos tests son PUROS (sin BD, sin gate): la regla se puede ejercer entera sin levantar nada,
 * que es la ventaja de haberla sacado del handler.
 */

test('SCRUM-164: el técnico NO puede tocar los campos de facturación/dinero', () => {
  assert.equal(adminOnlyJobField({ tipoOperacion: 'MANTENIMIENTO' }), 'tipoOperacion');
  assert.equal(adminOnlyJobField({ assignedUserId: 3 }), 'assignedUserId');
  assert.equal(adminOnlyJobField({ status: 'cerrado' }), "status:'cerrado'");
});

test('SCRUM-164: el técnico SÍ puede con su día a día', () => {
  // Si esto se rompiera, el operario dejaría de poder trabajar — y sería una regresión
  // silenciosa de SCRUM-120 disfrazada de "endurecer permisos".
  assert.equal(adminOnlyJobField({ status: 'en_curso' }), null);
  assert.equal(adminOnlyJobField({ scheduledAt: '2026-08-01' }), null);
  assert.equal(adminOnlyJobField({ notes: 'el cliente no estaba' }), null);
  assert.equal(adminOnlyJobField({ status: 'en_curso', notes: 'ok' }), null);
});

test('SCRUM-164: FAIL-CLOSED — un campo reservado contamina el PATCH entero', () => {
  // Nada de aplicar la parte inocente y descartar la fiscal: un PATCH a medias en zona de
  // dinero es peor que un 403.
  assert.equal(
    adminOnlyJobField({ notes: 'nota legítima', tipoOperacion: 'TRABAJO_UNICO' }),
    'tipoOperacion',
    'con un campo reservado mezclado, la petición se rechaza ENTERA'
  );
});

test('SCRUM-164: `status: cerrado` se distingue del resto de estados', () => {
  // 'cerrado' es la única transición IRREVERSIBLE de la FSM y mata la vía de "Cobrar el resto".
  // Un gate que mirase solo "¿viene status?" bloquearía al operario en su trabajo normal.
  assert.equal(adminOnlyJobField({ status: 'cerrado' }), "status:'cerrado'");
  assert.equal(adminOnlyJobField({ status: 'CERRADO' }), null, 'la comparación es exacta: otro valor no es esa transición');
  assert.equal(adminOnlyJobField({ status: 'pendiente' }), null);
});

test('SCRUM-164: un cuerpo ausente o raro no rompe el gate', () => {
  for (const body of [null, undefined, 'texto', 42, []]) {
    assert.equal(adminOnlyJobField(body), null, `cuerpo ${JSON.stringify(body)} no debe reventar el gate`);
  }
});

test('SCRUM-164: todo gate de rol escrito a mano en un handler está DECLARADO', () => {
  // EL GUARD QUE DA SENTIDO AL TICKET. `scrum55-admin-fail-closed` deriva el árbol /admin del
  // marcador que deja `requireRole`; un gate dentro del handler (porque depende del CUERPO, no
  // de la ruta) no deja marcador y es invisible para esa derivación Y para ADMIN_ONLY_ROUTES.
  // Aquí se cuentan los que hay en el código y se exige que estén declarados.
  const dirs = [path.join(raiz, 'src', 'modules'), path.join(raiz, 'src', 'core')];
  const ficheros = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.ts')) ficheros.push(f);
    }
  };
  dirs.forEach(walk);

  const inline = [];
  for (const f of ficheros) {
    // El fichero que DEFINE las capacidades habla de roles por oficio: no es un gate en un handler.
    if (f.endsWith('roleCapabilities.ts')) continue;
    const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    if (/req\.userRole\s*(!==|===)\s*['"]/.test(src)) inline.push(path.relative(raiz, f));
  }

  assert.deepEqual(
    inline, [],
    `🔴 Gate de rol escrito a mano y comparando contra un literal en:\n     · ${inline.join('\n     · ')}\n\n` +
    'Un `if (req.userRole !== "admin")` dentro de un handler es invisible para la derivación de\n' +
    'SCRUM-55 y para ADMIN_ONLY_ROUTES. Usa `requireRole` si el gate es de RUTA, o saca la regla\n' +
    'a roleCapabilities.ts y decláralo en FIELD_LEVEL_ROLE_GATES si es por CAMPO (SCRUM-164).'
  );
});

test('SCRUM-164: la declaración y la regla no pueden separarse', () => {
  // Dos listas a mano que deben cuadrar es el fallo de ADMIN_ONLY_ROUTES (SCRUM-158). Aquí se
  // comparan entre sí, así que separarlas pone algo en rojo.
  const decl = FIELD_LEVEL_ROLE_GATES.find((g) => g.method === 'PATCH' && g.path === '/admin/jobs/:id');
  assert.ok(decl, 'PATCH /admin/jobs/:id deja de estar declarado como gate por campo');
  assert.deepEqual(
    [...decl.campos].sort(),
    [...ADMIN_ONLY_JOB_FIELDS].sort(),
    'la lista declarada y la que aplica el código han dejado de coincidir'
  );
});
