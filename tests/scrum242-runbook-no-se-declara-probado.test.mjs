// tests/scrum242-runbook-no-se-declara-probado.test.mjs — SCRUM-242
//
// UN RUNBOOK NO SE DECLARA PROBADO SIN LA EVIDENCIA DELANTE.
//
// ── DE DÓNDE SALE ───────────────────────────────────────────────────────────────────────────
// Acabamos de retirar de `backup-dump.mjs` una promesa escrita: decía que el dump lógico era
// «restaurable — ver RUNBOOK al final», y ese RUNBOOK no existía. Escribir ahora un runbook y
// dejar que alguien le quite la marca de **NO PROBADO** sin haberlo ejecutado sería **meter la
// misma promesa por la puerta de atrás**, y esta vez en el documento al que se llega con la base
// caída.
//
// La marca es lo único que separa «tenemos procedimiento» de «tenemos procedimiento QUE FUNCIONA»,
// y esa diferencia solo se nota el día que importa.
//
// ── LA REGLA, Y POR QUÉ NO ES UNA LISTA DE EXCEPCIONES ──────────────────────────────────────
// El runbook está en uno de dos estados, y los dos son honestos:
//   · lleva **NO PROBADO** — es un borrador declarado; o
//   · **nombra el fichero de evidencia** de la prueba, **y ese fichero existe**.
//
// No hay tercera opción, y no hace falta ninguna marca especial ni allowlist: quitar el aviso
// obliga a apuntar a algo que se pueda abrir. Es la misma regla de SCRUM-391 y de
// `scrum242-scripts-no-prometen-documentos`: **no se nombra lo que no está**.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const RUNBOOKS = path.join(RAIZ, 'docs/RUNBOOKS.md');
const TITULO = '## R14 · Restaurar la base de datos desde un backup lógico';

/** La sección R14, recortada hasta el siguiente `## ` o el final. */
function seccionR14() {
  let texto;
  try {
    texto = fs.readFileSync(RUNBOOKS, 'utf8');
  } catch (e) {
    assert.fail(
      `🔴 no se pudo leer ${RUNBOOKS} (${e && e.code ? e.code : e}).\n\n`
      + '  «El runbook está bien» y «no supe leerlo» son el mismo verde.');
  }
  const i = texto.indexOf(TITULO);
  if (i < 0) return null;
  const resto = texto.slice(i + TITULO.length);
  const j = resto.indexOf('\n## ');
  return TITULO + (j < 0 ? resto : resto.slice(0, j));
}

test('SCRUM-242 · SUELO: la sección del runbook existe y se encuentra', () => {
  // Sin esto, borrar o renombrar la sección haría que el guard pasara en vacío — y «no hay runbook
  // sin probar» se leería como «el runbook está probado».
  const s = seccionR14();
  assert.ok(s, `🔴 no se encuentra «${TITULO}» en docs/RUNBOOKS.md: o se ha ido, o este guard dejó de mirar donde cree`);
  assert.ok(s.length > 800,
    `🔴 la sección del runbook tiene ${s.length} caracteres: un procedimiento que cabe en un párrafo no es un procedimiento`);
});

test('SCRUM-242 · o dice NO PROBADO, o nombra una evidencia QUE EXISTE', () => {
  const s = seccionR14();
  const declaradoSinProbar = /NO PROBADO/.test(s);
  if (declaradoSinProbar) return; // estado honesto nº 1: borrador declarado

  // Estado honesto nº 2: se quitó el aviso porque SE PROBÓ. Entonces tiene que decir dónde consta.
  // 🔴 LA EVIDENCIA VIVE EN `docs/evidencias/`, y esto lo apretó un rojo que NO salió rojo: la
  // primera versión aceptaba CUALQUIER `docs/**.md`, y la sección cita `docs/master/SCRUM-242.md`
  // como referencia cruzada de los criterios de comparación. Al quitar la marca, esa cita pasaba
  // por evidencia y el guard daba verde. Una referencia no es una prueba.
  const evidencias = [...s.matchAll(/docs\/evidencias\/[A-Za-z0-9_/-]+\.(md|txt|json)/g)].map((m) => m[0]);
  assert.ok(
    evidencias.length > 0,
    '🔴 SE HA QUITADO LA MARCA «NO PROBADO» SIN NOMBRAR NINGUNA EVIDENCIA.\n\n'
    + '  Acabamos de retirar de `backup-dump.mjs` una promesa escrita exactamente igual. Un runbook\n'
    + '  que se declara probado sin decir dónde consta la prueba es esa misma promesa, en el\n'
    + '  documento al que se llega con la base caída.\n\n'
    + '  O vuelve la marca, o se nombra el fichero de evidencia de la restauración.');

  const rotas = evidencias.filter((e) => !fs.existsSync(path.join(RAIZ, e)));
  assert.deepEqual(
    rotas, [],
    '🔴 el runbook se declara probado y su evidencia NO existe: ' + rotas.join(', ')
    + '\n\n  Nombrar un fichero que no está es peor que no nombrar ninguno.');
});

test('SCRUM-242 · el runbook no manda ejecutar un script que no existe', () => {
  // La versión anterior de este test exigía la frase «NO tiene hoy código», porque el paso de
  // escribir de vuelta no existía: `backup-dump.mjs` vuelca y verifica, y ninguno de sus dos modos
  // escribe en la base. Ya existe (`backup-restore.mjs`), así que la advertencia se ha ido y con
  // ella la frase — **texto y guard cambian a la vez**, que es la única forma de que el verde no me
  // lo esté regalando yo.
  //
  // Lo que queda vigilado es lo mismo de siempre, en la otra dirección:
  // `scrum242-scripts-no-prometen-documentos` impide que un SCRIPT nombre un documento ausente;
  // esto impide que el DOCUMENTO mande ejecutar un script ausente. A un runbook se llega a las tres
  // de la mañana con la base caída, y ahí un comando que no existe cuesta lo mismo que no tener
  // procedimiento — con la diferencia de que este tranquiliza.
  const s = seccionR14();
  const scripts = [...s.matchAll(/scripts\/[A-Za-z0-9_.-]+\.mjs/g)].map((m) => m[0]);

  // Suelo: si el extractor deja de ver comandos, «ninguno roto» no significaría nada.
  assert.ok(scripts.length > 0,
    '🔴 el runbook no nombra NINGÚN script: o el procedimiento se quedó sin comandos, o este guard dejó de verlos');

  const ausentes = [...new Set(scripts)].filter((f) => !fs.existsSync(path.join(RAIZ, f)));
  assert.deepEqual(
    ausentes, [],
    '🔴 EL RUNBOOK MANDA EJECUTAR UN SCRIPT QUE NO ESTÁ EN EL ÁRBOL: ' + ausentes.join(', ')
    + '\n\n  Es la promesa de `backup-dump.mjs` otra vez, en el documento al que se llega con la\n'
    + '  base caída. O vuelve el script, o el paso dice qué hacer sin él.');
});

test('SCRUM-242 · el runbook no olvida las SECUENCIAS', () => {
  // El volcado hace `SELECT *`: trae los ids pero NO el estado de las secuencias. Restaurar sin
  // reponerlas deja la base rota de forma diferida — el siguiente INSERT choca—, y en facturas eso
  // no se arregla borrando (regla 29).
  const s = seccionR14();
  assert.match(s, /setval|secuencia/i,
    '🔴 el runbook no dice cómo reponer las secuencias de autoincremento: la base quedaría rota en el siguiente INSERT, y en facturas eso es un incidente');
});
