// tests/scrum187-codeowners-zona-roja.test.mjs — SCRUM-187
//
// ATA .github/CODEOWNERS a ZONA_ROJA (scripts/zona-roja.mjs, SCRUM-168). Las dos listas dicen
// "esto es zona roja"; hoy NADA garantiza que cuadren, y el propio CODEOWNERS lo avisa en su
// cabecera. Este test INFORMA de la divergencia, NO la sincroniza: no toca ninguna de las dos,
// solo las lee y compara.
//
// POR QUÉ IMPORTA: CODEOWNERS vivió INEXISTENTE en `main` hasta ayer, y tres tickets (168/176/
// 179) se apoyaban en un commit que no estaba en el remoto, sin que nada saltara. Un guard que
// contrasta las dos listas convierte ese silencio en un rojo — que es todo lo que le faltaba.
//
// UNA SOLA SEMÁNTICA DE MATCHING: se reutiliza `casa()` de zona-roja.mjs, el matcher que ya usa
// el job de CI de SCRUM-168. Si este test inventara su propia comparación de rutas, habría DOS
// mecanismos opinando distinto sobre "¿esta ruta casa con este patrón?", y el test podría dar
// verde mientras el job ve otra cosa. `casa()` además resuelve el desajuste de formato: ZONA_ROJA
// usa basenames (`homeView.js`) donde CODEOWNERS ancla rutas completas (`/public/.../homeView.js`).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZONA_ROJA, casa } from '../scripts/zona-roja.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODEOWNERS_PATH = path.join(ROOT, '.github', 'CODEOWNERS');

// ── DIVERGENCIA DECLARADA — DECISIÓN ABIERTA DEL FUNDADOR, NO UN RESIDUO ─────────────────────
// CODEOWNERS protege HOY estas 8 rutas que ZONA_ROJA no lista. El propio CODEOWNERS lo dice,
// literal: «Que ZONA_ROJA gane esas (o no) lo decide el fundador; scripts/zona-roja.mjs no se
// toca desde aquí». O sea es una DECISIÓN PENDIENTE, no un olvido ni basura.
//
// Esta lista la hace EJECUTABLE: el día que se decida —las 8 suben a ZONA_ROJA, o se quitan de
// CODEOWNERS— este test se pondrá ROJO y OBLIGARÁ a actualizar la declaración citando dónde se
// decidió. Con eso, la decisión NO se puede aplicar en silencio, que es exactamente cómo el
// CODEOWNERS vivió inerte hasta ayer. NO borres estas 8 «para limpiar»: son el aserto que las
// vigila, no un residuo — quitarlas apaga el guard.
const DECLARED_EXTRAS = [
  '/prisma/migrations/',
  '/tests/',
  '/scripts/seed-staging.mjs',
  '/scripts/clean-staging-tests.mjs',
  '/scripts/test-staging-gated.mjs',
  '/.github/workflows/',
  '/.github/CODEOWNERS',
  '/package-lock.json',
];

// Rutas CON DUEÑO en CODEOWNERS: líneas "/ruta  @owner". Ignora comentarios (#) y prosa.
function rutasConDueno(texto) {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('/') && /@\S+/.test(l))
    .map((l) => l.split(/\s+/)[0]);
}

const sinBarra = (r) => r.replace(/^\//, ''); // `casa()` espera el "fichero" sin la / inicial

test('SCRUM-187 · CODEOWNERS y ZONA_ROJA no divergen más allá de lo declarado', () => {
  const existe = fs.existsSync(CODEOWNERS_PATH);
  const rutas = existe ? rutasConDueno(fs.readFileSync(CODEOWNERS_PATH, 'utf8')) : [];

  // ── DIRECCIÓN B · ZONA_ROJA ⊆ CODEOWNERS ──────────────────────────────────────────────────
  // Una ruta roja SIN dueño en CODEOWNERS es un hueco de protección: es zona roja pero nadie la
  // revisa. Borrar CODEOWNERS entero cae AQUÍ y deja las 8 de ZONA_ROJA sin dueño de golpe.
  //
  // LIMITACIÓN CONOCIDA: se comparan PATRONES contra PATRONES usando `casa()`, un matcher
  // pensado para RUTAS DE FICHERO. Funciona hoy porque CODEOWNERS lista los scripts uno a uno.
  // Si CODEOWNERS pasara a un patrón de directorio MÁS AMPLIO que los de ZONA_ROJA (p. ej.
  // `/scripts/` en vez de los ficheros sueltos), `casa('scripts/', 'seed-staging.mjs')` daría
  // false y esto marcaría `seed-staging.mjs` como «SIN REVISOR» aunque `/scripts/` sí lo cubre:
  // un FALSO POSITIVO en dirección B. Falla hacia el lado SEGURO —avisa de más, no de menos— y
  // se arregla el día que haga falta.
  const sinDueno = ZONA_ROJA
    .map((z) => z.patron)
    .filter((patron) => !rutas.some((r) => casa(sinBarra(r), patron)));
  assert.equal(
    sinDueno.length,
    0,
    (existe
      ? ''
      : '.github/CODEOWNERS NO EXISTE — divergencia máxima (el estado en que vivió el repo hasta ayer sin que nada lo dijera).\n') +
      'Rutas en ZONA_ROJA que NINGÚN dueño de CODEOWNERS cubre (sentido: roja pero SIN REVISOR):\n' +
      sinDueno.map((p) => `  · ${p}`).join('\n') +
      '\nSe quitó su dueño en CODEOWNERS, o entró en ZONA_ROJA sin dueño. Cuádralas.',
  );

  // ── DIRECCIÓN A · los extras de CODEOWNERS = EXACTAMENTE los declarados ────────────────────
  const extras = rutas.filter((r) => !ZONA_ROJA.some((z) => casa(sinBarra(r), z.patron)));
  const entraron = extras.filter((r) => !DECLARED_EXTRAS.includes(r));
  const salieron = DECLARED_EXTRAS.filter((r) => !extras.includes(r));
  const cambios = [
    ...entraron.map((r) => `  · ${r} ENTRÓ (está en CODEOWNERS de más, y NO estaba declarado)`),
    ...salieron.map((r) => `  · ${r} SALIÓ (estaba declarado y ya no es un extra de CODEOWNERS)`),
  ];
  assert.equal(
    cambios.length,
    0,
    'La divergencia declarada ha cambiado:\n' +
      cambios.join('\n') +
      '\n\nDOS LECTURAS, y hay que elegir una:\n' +
      '  · Si se DECIDIÓ si ZONA_ROJA gana esa ruta → actualiza DECLARED_EXTRAS en este fichero ' +
      'Y CITA DÓNDE SE DECIDIÓ (ticket o mensaje del fundador).\n' +
      '  · Si NO → alguien tocó una lista sin la otra; cuádralas.',
  );
});
