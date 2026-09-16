// tests/scrum746b-guarda-en-la-conexion.test.mjs — SCRUM-746 (fase B)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA GUARDA, DONDE SE ESCRIBE. Y EL CONTROL NEGATIVO ES EL FILO.
//
// La fase A midió que la barrera del comando no ve `npm run db:seed` ni `bash scripts/db-push-prod`
// y propuso vigilar en el PUNTO DE CONEXIÓN. El asesor lo adoptó y cambió el orden: primero lo
// irreversible.
//
// 🔴 NINGUNA DE LAS TRES RUTAS SE EJECUTA. Ni contra producción, ni contra staging, ni contra
// nada: las reglas son funciones PURAS sobre una URL, así que su rojo y su verde se ejercitan con
// cadenas inventadas. Un candado que sólo se prueba ejecutándolo no se prueba nunca.
//
// LO QUE SE CIERRA, en el orden del asesor:
//   ① `scripts/backup-restore.mjs` — sobrescribe una base ENTERA y no se deshace. Tenía entrada
//      propia de línea de comandos y NO comprobaba haber llegado por `_scratch-run.mjs`.
//   ② `prisma/seed.ts` — el ÚNICO de los tres sembradores que no llamaba a `destinoSembrable`.
//   ③ `scripts/db-push-prod` — se auto-concedía el sentinel del hook.
//
// 🔴 Y NO HAY REGLA NUEVA. `destinoSembrable` ya existía (SCRUM-381) y `destinoDesechable` es la
// que `_scratch-run.mjs` ejecutaba desde SCRUM-242, sacada a `_db-guard.mjs` para que la llamen
// los dos. Dos reglas que dicen lo mismo acaban diciendo cosas distintas.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROD_HOST, STAGING_HOST, DESTINOS_SEMBRABLES, destinoSembrable, destinoDesechable,
} from '../scripts/_db-guard.mjs';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lee = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// URLs INVENTADAS. No son credenciales: usuario y contraseña son literales de relleno y los hosts
// son los que el propio `_db-guard.mjs` publica como constantes. Nada de esto conecta con nada.
const u = (host, base) => `postgresql://u:p@${host}:5432/${base}`;
const PROD = u(PROD_HOST, 'railway');
const STAGING = u(STAGING_HOST, 'railway');
const DEV = u(STAGING_HOST, 'yaqu_dev_javier');
const DESECHABLE = u('127.0.0.1', 'scratch');

// ═══ ① SUELO · las dos reglas distinguen, o nada de lo de abajo significa nada ════════════

test('SCRUM-746b · 🔴 SUELO: las dos reglas saben decir SÍ y NO', () => {
  assert.equal(destinoSembrable(DEV).ok, true, '🔴 `destinoSembrable` no deja sembrar en dev: no sabe decir que sí.');
  assert.equal(destinoSembrable(PROD).ok, false, '🔴 `destinoSembrable` deja sembrar en PRODUCCIÓN.');
  assert.equal(destinoDesechable(DESECHABLE).ok, true, '🔴 `destinoDesechable` no deja restaurar en la desechable.');
  assert.equal(destinoDesechable(PROD).ok, false, '🔴 `destinoDesechable` deja restaurar en PRODUCCIÓN.');
});

test('SCRUM-746b · 🔴 son DOS reglas distintas, y la diferencia es staging', () => {
  // Si fueran la misma con un parámetro, el día que alguien pase el flag equivocado la diferencia
  // es una base perdida. Un sembrador AÑADE filas a staging; una restauración lo SOBRESCRIBE.
  assert.equal(destinoSembrable(STAGING).ok, true,
    '🔴 sembrar en staging ha dejado de estar permitido. Eso rompe `seed-staging`, y no es este ticket.');
  assert.equal(destinoDesechable(STAGING).ok, false,
    '🔴 UNA RESTAURACIÓN PUEDE SOBRESCRIBIR STAGING. Staging es de todo el equipo: la prueba de '
    + 'restauración va contra la base desechable.');
});

test('SCRUM-746b · 🔴 sin URL, las dos fallan CERRADO', () => {
  // «No sé a dónde escribo» no es «escribo en un sitio seguro». Es el caso normal en un árbol de
  // trabajo: medido el 4-sep, ninguno de los `.env` lleva `DATABASE_URL`.
  for (const [nombre, fn] of [['destinoSembrable', destinoSembrable], ['destinoDesechable', destinoDesechable]]) {
    for (const valor of [undefined, '', 'no-es-una-url', 'postgresql://']) {
      assert.equal(fn(valor).ok, false, `🔴 ${nombre}(${JSON.stringify(valor)}) deja pasar.`);
    }
    assert.doesNotMatch(fn(PROD).etiqueta + fn(PROD).motivo, /:\/\/|u:p@/,
      `🔴 ${nombre} está volcando la URL en su mensaje (R7 / incidente #14).`);
  }
});

// ═══ ② EL CONTROL NEGATIVO · sembrar en DEV sigue sin fricción ═══════════════════════════

test('SCRUM-746b · 🔴 CONTROL NEGATIVO: sembrar en DEV o en local sigue funcionando', () => {
  // El filo del encargo: «si el arreglo obliga a teclear algo para sembrar en dev, se desactivará
  // en una semana». La URL de dev vive en el MISMO host que staging, así que pasa igual que antes:
  // no se añade ni un paso.
  for (const destino of [DEV, STAGING, u('localhost', 'yaqu'), u('127.0.0.1', 'yaqu'), u('[::1]', 'yaqu')]) {
    const r = destinoSembrable(destino);
    assert.equal(r.ok, true, `🔴 el sembrador ya no puede escribir en ${r.etiqueta}: eso es fricción nueva.`);
  }
  // Y la allowlist sigue siendo la de siempre: si alguien mete producción, esto cae.
  assert.ok(!DESTINOS_SEMBRABLES.includes(PROD_HOST),
    '🔴 PRODUCCIÓN está en DESTINOS_SEMBRABLES. No puede estar.');
});

// ═══ ③ QUE LA GUARDA ESTÉ ENCHUFADA, no sólo exista ══════════════════════════════════════

test('SCRUM-746b · 🔴 los TRES sembradores llaman a la misma regla', () => {
  // Mencionar no es hacer, y exportar no es llamar. `prisma/seed.ts` era el único que no.
  for (const rel of ['prisma/seed.ts', 'scripts/seed-demo.mjs', 'scripts/seed-video.mjs']) {
    assert.match(lee(rel), /destinoSembrable\s*\(/,
      `🔴 ${rel} no llama a \`destinoSembrable\`. Era el defecto de este ticket: tres sembradores y `
      + 'uno sin comprobar el destino.');
  }
});

test('SCRUM-746b · 🔴 la restauración comprueba el destino ANTES de construir el cliente', () => {
  // Después de conectar ya se ha elegido a dónde. El orden ES la regla.
  const src = lee('scripts/backup-restore.mjs');
  assert.match(src, /destinoDesechable\s*\(/, '🔴 `backup-restore.mjs` no comprueba el destino.');
  assert.ok(src.indexOf('destinoDesechable(') < src.indexOf('new PrismaClient()'),
    '🔴 la comprobación va DESPUÉS de construir el cliente. Para entonces ya se ha elegido la base.');
});

test('SCRUM-746b · 🔴 el runner y quien escribe usan LA MISMA regla, no dos copias', () => {
  const runner = lee('scripts/_scratch-run.mjs');
  assert.match(runner, /destinoDesechable/,
    '🔴 `_scratch-run.mjs` ha vuelto a tener su propia comprobación. Dos reglas que dicen lo mismo '
    + 'acaban diciendo cosas distintas.');
  assert.doesNotMatch(runner, /partes\.host\s*===\s*PROD_HOST/,
    '🔴 ha vuelto la copia inline del candado en el runner.');
});

// ═══ ④ LA AUTOCONCESIÓN DEL SENTINEL ═════════════════════════════════════════════════════

test('SCRUM-746b · 🔴 `db-push-prod` ya NO se concede el sentinel a sí mismo', () => {
  // 🔴 SE FILTRAN LOS COMENTARIOS, y no es ceremonia: la primera versión de este test buscaba
  // `touch .claude/allow-db-push` sobre el fuente crudo y CAYÓ — casando con el comentario que yo
  // mismo escribí para explicar que esa línea se había quitado. El sitio natural donde se escribe
  // el nombre de lo prohibido es la explicación de la prohibición, y aquí me mordió a mí.
  // `soloEjecutable` es el filtro ÚNICO de la casa (SCRUM-700/719); `#` abre comentario en bash.
  const src = soloEjecutable(lee('scripts/db-push-prod'), { almohadillaEsComentario: true });
  assert.doesNotMatch(src, /touch\s+\.claude\/allow-db-push/,
    '🔴 el script vuelve a crearse la autorización de un solo uso. Quien lea el hook creerá que '
    + 'hubo un OK del fundador que por esta ruta no existe.');
  assert.doesNotMatch(src, /rm\s+-f\s+\.claude\/allow-db-push/,
    '🔴 queda la limpieza de un sentinel que ya no se crea.');
  // SUELO del propio filtro: si `soloEjecutable` se comiera el fichero entero, los dos asertos de
  // arriba pasarían sobre la nada y los cinco de abajo también.
  assert.ok(src.length > 1000,
    `🔴 el filtro ha dejado ${src.length} caracteres: no se está mirando el script, se está mirando nada.`);

  // Y sus CINCO puertas siguen ahí: lo único que se quitaba era la autoconcesión.
  for (const [marca, puerta] of [
    [/estadoDelArbol/, 'la puerta del árbol (SCRUM-685)'],
    [/Destino del db push/, 'el host-check'],
    [/SUELO ANTI-SILENCIO/, 'el suelo anti-silencio del preview'],
    [/borradosDelPreview/, 'el guard de borrado'],
    [/escribe exactamente GO/, 'el GO explícito'],
  ]) {
    assert.match(src, marca, `🔴 ha desaparecido ${puerta}. Este ticket NO tocaba las cinco puertas.`);
  }
});
