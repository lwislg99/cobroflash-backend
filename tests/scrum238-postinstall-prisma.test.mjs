// GUARD · EL CLIENTE DE PRISMA SE GENERA EN EL INSTALL. — SCRUM-238
//
// EL DEFECTO (recon SCRUM-222): Railway construye con `npm install` + `tsc`, y NADA del repo
// generaba el cliente de Prisma en ese build — no hay `output` custom en el generator, el cliente
// no está versionado, y no había `postinstall`. Que producción arrancara dependía de que la
// AUTO-DETECCIÓN de Prisma de nixpacks corriera `prisma generate` por su cuenta: una dependencia
// invisible y load-bearing. Si nixpacks dejara de hacerlo (o se cambiara el builder), prod no
// arrancaría — y el repo no lo delataba en ningún sitio.
//
// LA REGLA: el cliente se genera de forma EXPLÍCITA en el install, vía `postinstall`. Este guard
// exige que exista y que corra `prisma generate`, para que la dependencia deje de ser invisible.
// Es aditivo e idempotente. La interacción con el node_modules compartido por junction (SCRUM-190)
// la cubre el guard de coincidencia `scripts/_prisma-client-guard.mjs`, que corre en `pretest`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));

test('SCRUM-238: hay un `postinstall` que genera el cliente de Prisma', () => {
  const post = pkg.scripts?.postinstall;
  assert.ok(
    post,
    '🔴 no hay script `postinstall`: el build de Railway (`npm install`) no generaría el cliente de '
    + 'Prisma por el repo — quedaría dependiendo de la auto-detección de nixpacks, invisible y '
    + 'load-bearing (SCRUM-238/222).',
  );
  assert.match(
    post, /(^|[^\w])prisma\s+generate([^\w]|$)/,
    `🔴 el \`postinstall\` no corre \`prisma generate\`: "${post}". El cliente tiene que generarse en el install.`,
  );
});
