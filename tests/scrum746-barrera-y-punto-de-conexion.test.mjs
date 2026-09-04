// tests/scrum746-barrera-y-punto-de-conexion.test.mjs — SCRUM-746
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA BARRERA ESTÁ EN EL COMANDO; LAS DOS RUTAS QUE TOCAN PRODUCCIÓN NO SON UN COMANDO.
//
// 🔴 ESTE TICKET MIDE Y PROPONE. NO elige entre las dos salidas: eso toca la barrera de
// producción y lo decide el fundador. Lo que este fichero hace es (a) dejar el rojo medido para
// que no se discuta de memoria, y (b) poner un TRINQUETE para que la exposición no CREZCA
// mientras se decide.
//
// ⛔ NO EJECUTA NINGUNA DE LAS DOS RUTAS. Al hook se le da la MISMA ENTRADA que recibiría —el
// JSON del tool call— y se mira su veredicto: es una función pura sobre esa entrada, así que
// esto mide lo que pasaría sin conectar con ninguna base.
//
// LO MEDIDO (4-sep-2026), y está en docs/master/SCRUM-746.md con la propuesta:
//   · `bash scripts/db-push-prod`, `npm run db:push`, `npm run db:seed` → el hook NO los ve.
//   · 20 ficheros construyen un `PrismaClient`; 8 están ACOTADOS por su clave (_STAGING/_DEV/
//     _TESTS) y 12 pueden alcanzar producción. De esos 12, 7 comprueban el destino.
//   · De los 5 que no: uno es la app (su destino correcto ES producción), uno sólo lee, y uno
//     exige `--apply`. Quedan DOS que escriben contra lo que apunte `DATABASE_URL` sin nada:
//     `prisma/seed.ts` y `scripts/backup-restore.mjs`.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { evaluar } from '../.claude/hooks/guard-dangerous.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SENTINEL_FALSO = path.join(os.tmpdir(), 'yaqu-746-sentinel-que-no-existe');
const llamada = (c) => JSON.stringify({ tool_name: 'Bash', tool_input: { command: c, description: 'prueba' } });
const bloquea = (c) => evaluar(llamada(c), SENTINEL_FALSO).bloqueado;

/** Ficheros de código del árbol, para el censo del punto de conexión. */
function ficherosDe(dirs) {
  const out = [];
  const rec = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') rec(p); continue; }
      if (/\.(ts|mjs|js)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p);
    }
  };
  for (const d of dirs) rec(path.join(RAIZ, d));
  return out;
}

/**
 * Quién construye un cliente, con qué clave y con qué comprobación de destino.
 *
 * `acotado` = el fichero nombra una clave `_STAGING`/`_DEV`/`_TESTS`, así que NO puede alcanzar
 * producción se llame como se llame. Es la distinción que decide el riesgo, y por eso se mide
 * en vez de contar constructores a secas.
 */
export function censoDeConexiones() {
  const filas = [];
  for (const f of ficherosDe(['src', 'scripts', 'prisma'])) {
    const src = fs.readFileSync(f, 'utf8');
    if (!/new\s+PrismaClient\s*\(/.test(src)) continue;
    filas.push({
      rel: path.relative(RAIZ, f).replace(/\\/g, '/'),
      acotado: /DATABASE_URL_(STAGING|DEV|TESTS)/.test(src),
      guarda: /exigirDestinoCorrecto|exigirNoProduccion|_clave-vs-destino|parseBDSegura|_db-guard|autorack|acela\.proxy/.test(src),
    });
  }
  return filas;
}

/**
 * Los que pueden llegar a producción y NO comprueban a dónde apuntan.
 *
 * ⚠️ LA LISTA VA A MANO Y CON MOTIVO, no derivada: de los cinco que el barrido marca, TRES no son
 * un problema y decirlo es la mitad del trabajo. Derivarla haría que el número subiera solo cada
 * vez que alguien añade un script que sólo lee.
 */
/**
 * 🟢 CERRADOS EN LA FASE B — y esta lista la escribió el trinquete, no yo.
 *
 * Al terminar la fase B, este fichero CAYÓ con su propio mensaje al revés: «UN EXPUESTO CONOCIDO
 * YA NO SALE: prisma/seed.ts, scripts/backup-restore.mjs — si le has puesto guarda de destino,
 * quítalo de EXPUESTOS_CONOCIDOS y anótalo en la entrada». Eso es exactamente para lo que se
 * escribió así: un guard que sabe decir que ha dejado de hacer falta no se convierte en ruido.
 *
 * Ahora el trinquete apunta al otro lado: si a alguno de los dos le quitaran la guarda, vuelve a
 * caer. Lo que se vigila ya no es «que no crezca la exposición», es «que no vuelva».
 */
const CERRADOS_EN_FASE_B = Object.freeze({
  'prisma/seed.ts': 'llama a `destinoSembrable`, como sus dos hermanos sembradores (SCRUM-746 fase B)',
  'scripts/backup-restore.mjs': 'llama a `destinoDesechable` ANTES de construir el cliente (SCRUM-746 fase B)',
});

/** Ninguno: los dos que había los cerró la fase B. Si vuelve a haber uno, se apunta aquí. */
const EXPUESTOS_CONOCIDOS = Object.freeze({});
const NO_SON_PROBLEMA = Object.freeze({
  'src/core/db/prisma.ts': 'es el cliente de la APP: su destino correcto ES produccion',
  'scripts/censo-vias-de-cobro.mjs': 'solo LEE (y ya tiene su suelo de «ciego»)',
  'scripts/backfill-quote-numbers.mjs': 'escribe, pero exige `--apply` explicito (mitigacion, no guarda)',
});

// ═══ ① EL ROJO, FIJADO · las dos rutas no cruzan la barrera ══════════════════════════════

test('SCRUM-746 · 🔴 SUELO: el hook está vivo y ve la forma directa', () => {
  // Sin esto, «no ve las rutas» podría ser «no ve nada», que es otra cosa y se arregla distinto.
  assert.equal(bloquea('npx prisma db push'), true,
    '🔴 el hook no bloquea ni `npx prisma db push`. No está midiendo nada.');
});

test('SCRUM-746 · 🔴 MEDIDO: las rutas por INDIRECCIÓN no llegan al hook', () => {
  // Esto NO es una aspiración: es el estado de hoy, escrito para que la decisión se tome sobre un
  // hecho. Cuando se cierre el hueco, este test cae — y ES LO QUE TIENE QUE PASAR: quien lo cierre
  // vendrá aquí, verá el motivo y lo convertirá en la comprobación contraria.
  const rutas = ['bash scripts/db-push-prod', 'npm run db:push', 'npm run db:seed'];
  const vistas = rutas.filter(bloquea);
  assert.deepEqual(vistas, [],
    '🟢 ALGUNA RUTA POR INDIRECCIÓN YA CRUZA LA BARRERA: ' + vistas.join(', ') + '\n' +
    '  Si es a propósito, ENHORABUENA y hay que actualizar este test y docs/master/SCRUM-746.md:\n' +
    '  la decisión que ese documento propone ya se ha tomado. Si no es a propósito, algo ha\n' +
    '  cambiado en el hook sin que nadie lo midiera.');
});

// ═══ ② EL TRINQUETE · la exposición no crece mientras se decide ══════════════════════════

test('SCRUM-746 · 🔴 no aparecen NUEVOS puntos de conexión sin guarda de destino', () => {
  const filas = censoDeConexiones();
  assert.ok(filas.length >= 15,
    `🔴 ESCÁNER CIEGO: sólo ${filas.length} ficheros construyen un PrismaClient y se midieron 20.`);
  assert.ok(filas.some((x) => x.acotado),
    '🔴 ningún fichero sale ACOTADO por su clave, y hay scripts de staging: el detector no sabe decir que sí.');

  const alcanzan = filas.filter((x) => !x.acotado);
  const sinGuarda = alcanzan.filter((x) => !x.guarda).map((x) => x.rel).sort();
  const conocidos = [...Object.keys(EXPUESTOS_CONOCIDOS), ...Object.keys(NO_SON_PROBLEMA)].sort();
  const nuevos = sinGuarda.filter((x) => !conocidos.includes(x));

  assert.deepEqual(nuevos, [],
    '🔴 HAY UN PUNTO DE CONEXIÓN NUEVO QUE PUEDE ALCANZAR PRODUCCIÓN Y NO COMPRUEBA EL DESTINO:\n' +
    '    ' + nuevos.join('\n    ') + '\n\n' +
    '  No es «arréglalo»: es «decide y dilo». O le pones una comprobación de destino —el patrón\n' +
    '  está en `scripts/_clave-vs-destino.mjs` y lo usan siete scripts—, o lo apuntas arriba con\n' +
    '  su motivo. Mientras SCRUM-746 esté sin decidir, lo que no puede pasar es que la lista\n' +
    '  crezca sin que nadie lo note: la barrera del comando no cubre estas rutas.');

  // Y el otro lado del trinquete: si uno de los conocidos DESAPARECE, es una buena noticia que
  // hay que anotar — o el detector se ha roto. Las dos se parecen demasiado para dejarlas pasar.
  const desaparecidos = Object.keys(EXPUESTOS_CONOCIDOS).filter((x) => !sinGuarda.includes(x));
  assert.deepEqual(desaparecidos, [],
    '🟢 UN EXPUESTO CONOCIDO YA NO SALE: ' + desaparecidos.join(', ') + '\n' +
    '  Si le has puesto guarda de destino, muévelo a CERRADOS_EN_FASE_B y anótalo en la entrada.\n' +
    '  Si no le has puesto nada, entonces el detector ha dejado de verlo y ese verde no vale.');

  // 🔴 Y EL TRINQUETE INVERSO: lo que la fase B cerró, no se reabre.
  const reabiertos = Object.keys(CERRADOS_EN_FASE_B).filter((x) => sinGuarda.includes(x));
  assert.deepEqual(reabiertos, [],
    '🔴 SE HA QUITADO LA GUARDA DE DESTINO A:\n    ' + reabiertos.join('\n    ') + '\n\n' +
    '  Estos dos se cerraron en la fase B de SCRUM-746 porque ESCRIBEN contra lo que apunte\n' +
    '  `DATABASE_URL`. Uno siembra sobre el merchant 1; el otro sobrescribe una base ENTERA y no\n' +
    '  se deshace. Si de verdad hay que quitarles la guarda, hace falta un ticket que lo explique.');
});

test('SCRUM-746 · 🔴 los dos que cerró la fase B siguen escribiendo, o su guarda ya no protege nada', () => {
  // Un trinquete sobre una lista que ya no describe nada es peor que ninguno. Se comprueba que
  // los dos ficheros existen, que construyen un cliente y que ESCRIBEN — que es lo que los hace
  // peligrosos frente a los que sólo leen. Si uno dejara de escribir, su guarda sobra y hay que
  // decirlo en vez de arrastrarla.
  for (const [rel, motivo] of Object.entries({ ...EXPUESTOS_CONOCIDOS, ...CERRADOS_EN_FASE_B })) {
    const p = path.join(RAIZ, rel);
    assert.ok(fs.existsSync(p), `🔴 ${rel} ya no existe, y el trinquete sigue nombrándolo: ${motivo}`);
    const src = fs.readFileSync(p, 'utf8');
    assert.match(src, /new\s+PrismaClient\s*\(/, `🔴 ${rel} ya no construye un cliente.`);
    assert.match(src, /\.(upsert|create|createMany|update|updateMany|deleteMany|delete|executeRaw)\b/,
      `🔴 ${rel} ya no escribe. Si se ha vuelto de solo lectura, muévelo a NO_SON_PROBLEMA con su motivo.`);
  }
});

// ═══ ③ EL RESIDUO DEL SENTINEL, MEDIDO ═══════════════════════════════════════════════════

test('SCRUM-746 · 🔴 el sentinel se consume al DEJAR PASAR, no al ejecutarse', () => {
  // Es el segundo hallazgo del encargo y estaba declarado en el propio hook como «residuo
  // conocido». Se fija con una medición para que la propuesta hable de un hecho: el hook no puede
  // saber qué pasa después, así que una autorización se puede gastar sin que se ejecute nada.
  const sentinel = path.join(os.tmpdir(), 'yaqu-746-sentinel-que-si-existe');
  fs.writeFileSync(sentinel, '');
  const r = evaluar(llamada('npx prisma db push'), sentinel);
  const quedaba = fs.existsSync(sentinel);
  fs.rmSync(sentinel, { force: true });

  assert.equal(r.bloqueado, false, '🔴 con el sentinel puesto, `db push` sigue bloqueado.');
  assert.equal(quedaba, false,
    '🟢 el sentinel YA NO se consume al dejar pasar. Si es a propósito, actualiza\n' +
    '  docs/master/SCRUM-746.md: el residuo que ese documento describe ha dejado de existir.\n' +
    '  Si no, la autorización de un solo uso se ha vuelto reutilizable, que es peor.');
});
