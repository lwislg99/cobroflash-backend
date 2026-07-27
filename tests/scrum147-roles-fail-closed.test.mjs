// SCRUM-147 — el rol se pregunta por CAPACIDAD, y lo desconocido cae al lado seguro.
//
// EL FALLO: el filtro row-level de SCRUM-23 estaba escrito como DENYLIST
// (`if (req.userRole === 'tecnico') restringir`). Cualquier rol que no fuera exactamente
// 'tecnico' se saltaba la restricción y veía TODOS los Trabajos del merchant — fail-OPEN. Hoy no
// muerde porque solo hay dos roles; explota con el PRIMER rol nuevo (el "comercial" de
// SCRUM-137, que es justo lo que destapó esto).
//
// SCRUM-55 ya arregló esta clase en `consolidar-albaranes` y dejó la lección escrita tres líneas
// más arriba de las DOS que se quedaron sin convertir. Este test existe para que la tercera vez
// no dependa de que alguien se acuerde.
//
// PUROS y SIN GATE: `roleCapabilities` no toca BD ni Express. El comportamiento de las rutas con
// un técnico real ya lo cubre tenancy-permisos.test.mjs (gateado); lo que aquí se blinda es la
// DIRECCIÓN del blindaje, que es lo que se escribió al revés.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { seesAllJobs, seesOnlyOwnJobs, isFieldMember, isSupportedRole, SUPPORTED_ROLES, OWNER_ROLE } =
  await import('../dist/core/http/roleCapabilities.js');

const SRC = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'src');

// Roles que HOY no existen. Son el caso que el código viejo dejaba pasar.
const ROLES_FUTUROS = ['comercial', 'jefe_obra', 'contable', 'COMERCIAL', ''];

test('SCRUM-147: solo admin ve TODOS los Trabajos (allowlist, no denylist)', () => {
  assert.equal(seesAllJobs('admin'), true, 'admin ve todo');
  assert.equal(seesAllJobs('tecnico'), false, 'el técnico solo ve los suyos (SCRUM-23)');
});

test('SCRUM-147: un rol DESCONOCIDO queda RESTRINGIDO a sus Trabajos — el bug era el contrario', () => {
  for (const rol of ROLES_FUTUROS) {
    assert.equal(seesAllJobs(rol), false, `'${rol}' NO puede ver todos los Trabajos`);
    assert.equal(seesOnlyOwnJobs(rol), true, `'${rol}' debe quedar restringido a los suyos`);
  }
  // Sin rol (sesión rara, campo ausente): también restringido. Fail-closed de verdad.
  for (const vacio of [null, undefined]) {
    assert.equal(seesOnlyOwnJobs(vacio), true, `un rol ${vacio} debe quedar restringido`);
  }
});

test('SCRUM-147: seesOnlyOwnJobs es el complemento exacto de seesAllJobs', () => {
  // Si algún día divergen, una ruta podría quedar sin filtro Y sin acceso total a la vez.
  for (const rol of ['admin', 'tecnico', ...ROLES_FUTUROS, null, undefined]) {
    assert.equal(seesOnlyOwnJobs(rol), !seesAllJobs(rol), `complemento roto para '${rol}'`);
  }
});

test('SCRUM-147: en MÉTRICAS lo desconocido SÍ cuenta como equipo de campo (dirección opuesta, a propósito)', () => {
  // Aquí el conjunto cerrado es el EXCLUIDO (admin/propietario). Si se blindara como el gate de
  // seguridad, un rol nuevo desaparecería de las métricas de equipo — que es la otra mitad del
  // problema que destapó SCRUM-137, no su solución.
  assert.equal(isFieldMember('tecnico'), true);
  assert.equal(isFieldMember('admin'), false, 'el admin no es equipo de campo');
  assert.equal(isFieldMember(OWNER_ROLE), false, 'el propietario tampoco');
  for (const rol of ['comercial', 'jefe_obra']) {
    assert.equal(isFieldMember(rol), true, `'${rol}' debe APARECER en las métricas, no desaparecer`);
  }
});

test('SCRUM-147: isSupportedRole valida — ya no se coacciona en silencio', () => {
  // team.routes.ts reescribía cualquier valor ≠ 'admin' a 'tecnico': pedir 'comercial' creaba un
  // técnico sin decirlo. Ahora se rechaza con 400 y quien lo pide se entera.
  assert.deepEqual([...SUPPORTED_ROLES], ['admin', 'tecnico'], 'S1: los roles del máster, ni uno más');
  for (const ok of SUPPORTED_ROLES) assert.equal(isSupportedRole(ok), true);
  for (const malo of [...ROLES_FUTUROS, null, undefined, 42, {}, ['admin']]) {
    assert.equal(isSupportedRole(malo), false, `${JSON.stringify(malo)} no es un rol soportado`);
  }
});

test('SCRUM-147: no quedan denylists `=== "tecnico"` en los gates de acceso', () => {
  // Guard ESTRUCTURAL sobre el fuente: el arreglo es una CLASE, no dos líneas. Si vuelve a
  // aparecer un `userRole === 'tecnico'` en una ruta, este test lo nombra.
  // Límite honesto: solo mira `req.userRole`; una denylist sobre otra variable no la vería.
  const src = SRC;
  const ofensas = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.endsWith('.ts')) continue;
      fs.readFileSync(full, 'utf8').split('\n').forEach((linea, i) => {
        if (/^\s*\/\//.test(linea)) return; // los comentarios SÍ pueden nombrarlo (lo documentan)
        if (/req\.userRole\s*===\s*['"]tecnico['"]/.test(linea)) {
          ofensas.push(`${path.relative(src, full)}:${i + 1}`);
        }
      });
    }
  };
  walk(src);

  assert.deepEqual(ofensas, [],
    `\n🔴 DENYLIST de rol (fail-OPEN) en:\n${ofensas.map((o) => `   · ${o}`).join('\n')}\n\n` +
    'Un rol nuevo que no sea exactamente "tecnico" se saltaría la restricción.\n' +
    'Pregunta por CAPACIDAD: seesOnlyOwnJobs(req.userRole) — core/http/roleCapabilities.ts.\n');
});
