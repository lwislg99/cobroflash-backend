// tests/scrum467-tecnico-ve-lo-suyo.test.mjs — SCRUM-467
//
// UN TÉCNICO VE LO SUYO. NI UN ALBARÁN MÁS — Y ASIGNARLE UN TRABAJO SE LO ENSEÑA.
//
// ── EL DEFECTO, medido antes de tocar ──────────────────────────────────────────────────────
//   · `GET /admin/albaranes/:id` **no filtraba nada**: con el id —enteros consecutivos— un
//     técnico abría cualquier albarán del negocio y se llevaba el **nombre del cliente y la
//     dirección de la obra** de un Trabajo ajeno. La puerta principal se lo niega desde
//     SCRUM-23/147; ésta se lo servía por detrás.
//   · La lista de Trabajos filtraba SOLO por `operarioId` (autoría). Había **6 Jobs con
//     `assignedUserId` escrito que no miraba nadie**: asignar un trabajo no hacía que lo viera.
//   · `GET /admin/albaranes` era admin-only, así que al técnico se le precargaban los albaranes
//     en el móvil (SCRUM-464) y **no tenía ninguna pantalla desde la que abrirlos**.
//
// ⚠️ LOS DOS CAMPOS NO SE UNIFICAN, y lo declara el schema: `operarioId` es AUTORÍA congelada al
// aceptar (SCRUM-52) y `assignedUserId` es QUIEN EJECUTA (SCRUM-10). Son dos ejes: se filtra por
// los dos.
//
// ⚠️ ESTO SE COMPRUEBA SOBRE EL FUENTE, no ejecutando la ruta: montar Express + Prisma para esto
// exigiría base, y el gate la dejaría fuera de la tanda normal — un permiso que solo se comprueba
// cuando alguien acuerda de correr el gate no está comprobado. Lo que se exige aquí es que el
// FILTRO EXISTA y esté atado a `seesOnlyOwnJobs`; la lectura se hace sin comentarios, porque este
// fichero está lleno de las palabras que vigila.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (p) => {
  const abs = path.join(RAIZ, p);
  try {
    return soloEjecutable(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    assert.fail(`🔴 no se pudo leer ${p} (${e && e.code ? e.code : e}). «Filtra» y «no supe mirar» son el mismo verde.`);
  }
};

const ALBARANES = 'src/modules/jobs/app/routes/albaranes.routes.ts';
const JOBS = 'src/modules/jobs/app/routes/jobs.routes.ts';

// ── 0 · SUELO ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-467 · SUELO: se leen las dos rutas y tienen contenido', () => {
  assert.ok(leer(ALBARANES).length > 5000, '🔴 el router de albaranes no es el fichero que se cree');
  assert.ok(leer(JOBS).length > 5000, '🔴 el router de trabajos no es el fichero que se cree');
});

// ── 1 · CONTROL NEGATIVO, Y VA PRIMERO ────────────────────────────────────────────────────
// Si este arreglo le quita un albarán a un admin, es peor que el defecto.

test('SCRUM-467 · 🔴 CONTROL NEGATIVO: un ADMIN sigue viendo TODO', () => {
  const src = leer(ALBARANES);

  // El listado acotado SOLO se usa cuando el rol está restringido; el admin recibe el lector
  // completo. Si alguien invirtiera la condición, el admin dejaría de ver los albaranes de su
  // propio negocio y nadie lo notaría hasta que lo dijera un cliente.
  assert.match(src, /seesOnlyOwnJobs\(req\.userRole\)\s*\n?\s*\?\s*lectorAcotado|const soloLosSuyos = seesOnlyOwnJobs\(req\.userRole\)/,
    '🔴 el listado ya no decide por `seesOnlyOwnJobs`: o el técnico ve de más, o el ADMIN ve de menos.');
  assert.match(src, /:\s*lectorPrismaListado/,
    '🔴 ha desaparecido la rama sin filtrar. Un admin tiene que seguir recibiendo TODOS los '
    + 'albaranes de su negocio: si este cambio le quita uno, el arreglo es peor que el defecto.');

  // Y en el detalle: el corte va DENTRO de `seesOnlyOwnJobs`, nunca suelto.
  assert.ok(!/if \(!suyo\) return res\.status\(404\)[\s\S]{0,80}\n\}/.test(src.replace(/if \(seesOnlyOwnJobs[\s\S]*?\n    \}/, '')),
    '🔴 el 404 de pertenencia parece estar FUERA del `if (seesOnlyOwnJobs(...))`: así se lo '
    + 'aplicaría también al admin.');
});

// ── 2 · EL ROJO POR EL MECANISMO ──────────────────────────────────────────────────────────

test('SCRUM-467 · 🔴 un técnico NO puede abrir por id un albarán que no es suyo', () => {
  const src = leer(ALBARANES);
  const detalle = src.slice(src.indexOf("router.get('/:id'"));
  assert.ok(detalle.length > 200, '🔴 no se encuentra el handler de `GET /:id`');

  assert.match(detalle, /seesOnlyOwnJobs\(req\.userRole\)/,
    '🔴 UN OPERARIO PUEDE LEER EL CLIENTE Y LA DIRECCIÓN DE UN TRABAJO QUE NO ES SUYO.\n\n'
    + '  `GET /admin/albaranes/:id` ha dejado de comprobar la pertenencia. Los ids son enteros\n'
    + '  consecutivos, así que basta con probar números: cada uno devuelve el nombre del cliente\n'
    + '  y la dirección de la obra de un Trabajo ajeno. La puerta principal se lo niega desde\n'
    + '  SCRUM-23/147; ésta se lo estaría sirviendo por detrás.');

  assert.match(detalle, /job\.operarioId === req\.teamMemberId/,
    '🔴 el detalle ya no comprueba la AUTORÍA (`operarioId`): un técnico dejaría de ver los partes '
    + 'de los Trabajos que él mismo originó.');
  assert.match(detalle, /job\.assignedUserId === req\.teamMemberId/,
    '🔴 el detalle ya no comprueba la ASIGNACIÓN (`assignedUserId`): al técnico se le asignaría un '
    + 'trabajo y seguiría sin poder abrir su albarán.');
  assert.match(detalle, /res\.status\(404\)/,
    '🔴 el corte debe responder 404, igual que un albarán de otro merchant: un 403 le confirmaría '
    + 'que el documento existe.');
});

// ── 3 · EL POSITIVO ───────────────────────────────────────────────────────────────────────

test('SCRUM-467 · un técnico con trabajo ASIGNADO lo ve — los dos ejes, en las dos rutas', () => {
  const jobs = leer(JOBS);
  assert.match(jobs, /OR(?::|\s*=)\s*\[[^\]]*operarioId:\s*req\.teamMemberId[^\]]*assignedUserId:\s*req\.teamMemberId/,
    '🔴 la lista de Trabajos ha vuelto a filtrar por UN solo campo. Con `operarioId` a secas, '
    + 'ASIGNAR UN TRABAJO NO HACE QUE EL TÉCNICO LO VEA — había 6 con `assignedUserId` escrito que '
    + 'no miraba nadie.');

  const alb = leer(ALBARANES);
  assert.match(alb, /OR(?::|\s*=)\s*\[[^\]]*operarioId:\s*teamMemberId[^\]]*assignedUserId:\s*teamMemberId/,
    '🔴 el listado de albaranes ya no resuelve los Trabajos visibles por los DOS ejes.');
  assert.match(alb, /jobId:\s*\{\s*in:\s*jobIds\s*\}/,
    '🔴 el filtro del listado ha salido de la QUERY. Filtrar después, en memoria o en el front, es '
    + 'enviar datos que no se deben enviar y taparlos luego.');
});

// ── 4 · LA DECLARACIÓN SE MUEVE, EL CONTROL NO SE QUITA ───────────────────────────────────

test('SCRUM-467 · 🔴 la ruta se RE-DECLARA: sale de admin-only y entra en TECNICO_ALLOWED', () => {
  const adminOnly = leer('src/core/http/adminOnlyRoutes.ts');
  const declara = leer('src/core/http/adminRouteDeclarations.ts');

  assert.ok(!/path: '\/admin\/albaranes' \}/.test(adminOnly),
    '🔴 `GET /admin/albaranes` ha vuelto a ADMIN_ONLY_ROUTES: o se revirtió la decisión, o hay dos '
    + 'declaraciones diciendo cosas distintas de la misma ruta.');
  assert.match(declara, /path: '\/admin\/albaranes', why:/,
    '🔴 la ruta no está declarada en TECNICO_ALLOWED con su motivo. Abrir una ruta sin declarar '
    + 'POR QUÉ es exactamente lo que estas listas existen para impedir.');

  // Y la mitad que de verdad importa: el montaje CONSERVA una muestra de 403.
  assert.match(adminOnly, /path: '\/admin\/albaranes\/consolidar'/,
    '🔴 el montaje `/admin/albaranes` se ha quedado SIN NINGUNA ruta suya en ADMIN_ONLY_ROUTES.\n\n'
    + '  Eso rompe el invariante de SCRUM-158 —todo montaje admin-gateado tiene al menos un 403\n'
    + '  que alguien comprueba— y deja esta puerta sin control: podría abrirse entera sin que\n'
    + '  ningún test se entere. Re-declarar es legítimo; quitar el control, no.');
});
