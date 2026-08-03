// SCRUM-225 · EL MAPA DE LAS TRES BD, ATADO ENTRE LOS DOS DOCUMENTOS QUE LO REPITEN.
//
// Sin gate: solo lee dos ficheros. Ni BD, ni red, ni turno.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
//
// `docs/MIGRATIONS_PENDING.md` y `docs/RUNBOOKS.md` R18 llevan el MISMO mapa de las tres bases,
// y los dos lo dicen por escrito: «si divergen en una palabra, el problema no está resuelto,
// solo movido». Eso era una PROHIBICIÓN SIN MECANISMO — la frase estaba, y nada comprobaba que
// se cumpliera. Es literalmente el defecto que SCRUM-225 vino a cerrar, cometido en el propio
// documento que lo describe: dos listas que deben cuadrar y nada las ata.
//
// Precedentes de la misma familia en este repo: MODELOS_POR_MERCHANT (SCRUM-172),
// CODEOWNERS ↔ ZONA_ROJA (SCRUM-187), los aislados del runner (SCRUM-199), el semáforo ↔ el
// emisor (SCRUM-211). Éste es el de mayor consecuencia: describe qué bases tiene el proyecto, y
// una de ellas es producción.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ COMPARA, Y POR QUÉ ASÍ
//
// El bloque que va desde «Un cambio de schema NO está aplicado…» hasta «…los define en el
// árbol.», que es exactamente el mapa + el criterio + la advertencia de las dos bases en el
// mismo servidor. Se compara BYTE A BYTE tras normalizar SOLO los finales de línea: el fichero
// vive en CRLF y un `\r` de diferencia no es una divergencia de contenido. Cualquier otra
// diferencia —una palabra, un espacio, un hostname— sí lo es, y es justo lo que hay que cazar:
// el modo de fallo de estas dos listas nunca ha sido un párrafo entero, ha sido UNA palabra.
//
// NO se compara por «contiene los tres hostnames» ni por una lista de patrones. Eso pasaría
// verde con dos textos que dicen cosas distintas sobre las mismas tres bases, que es
// precisamente la divergencia que preocupa.
//
// ⚠️ ANCLAS: si alguien reescribe una de las dos frases de corte, este test NO se queda en
// verde silencioso — falla nombrando qué ancla no encontró y en qué fichero. Un guard que no
// encuentra su objeto tiene que gritar, no aprobar: es la lección del escáner ciego.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const INICIO = 'Un cambio de schema NO está aplicado hasta estar en las TRES bases:';
const FIN = 'los define en el árbol.';

const FICHEROS = {
  'docs/MIGRATIONS_PENDING.md': 'la cabecera de MIGRATIONS_PENDING',
  'docs/RUNBOOKS.md': 'R18 de RUNBOOKS',
};

/** El bloque del mapa, con los finales de línea normalizados. `null` si falta un ancla. */
function mapaDe(rel) {
  const txt = fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
  const i = txt.indexOf(INICIO);
  if (i < 0) return { error: `no encuentro el ancla de INICIO («${INICIO}»)` };
  const j = txt.indexOf(FIN, i);
  if (j < 0) return { error: `no encuentro el ancla de FIN («${FIN}») después del inicio` };
  return { mapa: txt.slice(i, j + FIN.length) };
}

test('SCRUM-225 · el mapa de las TRES BD es idéntico en los dos documentos que lo repiten', () => {
  const leidos = {};
  for (const [rel, nombre] of Object.entries(FICHEROS)) {
    const r = mapaDe(rel);
    assert.ok(
      !r.error,
      `🔴 ESCÁNER CIEGO en ${rel} (${nombre}): ${r.error}.\n\n` +
        '  Este guard no puede quedarse en verde sin haber comparado nada. Si moviste o\n' +
        '  reescribiste esa frase, actualiza las anclas de este test EN EL MISMO commit.',
    );
    leidos[rel] = r.mapa;
  }

  const [a, b] = Object.keys(FICHEROS);

  // SUELO: un bloque vacío o ridículamente corto compararía «igual» sin decir nada.
  assert.ok(
    leidos[a].length > 200,
    `🔴 ESCÁNER CIEGO: el mapa extraído mide ${leidos[a].length} caracteres. Es demasiado poco ` +
      'para ser el mapa de las tres bases; las anclas están casando con otra cosa.',
  );

  if (leidos[a] !== leidos[b]) {
    // Nombrar la PRIMERA diferencia con su contexto: «divergen» sin decir dónde obliga a
    // comparar 1.100 caracteres a ojo, y entonces el guard se ignora.
    let k = 0;
    while (k < leidos[a].length && k < leidos[b].length && leidos[a][k] === leidos[b][k]) k++;
    const ventana = (s) => JSON.stringify(s.slice(Math.max(0, k - 60), k + 60));
    assert.fail(
      `🔴 EL MAPA DE LAS TRES BD HA DIVERGIDO entre ${a} y ${b}.\n\n` +
        `  Primera diferencia en el carácter ${k}:\n` +
        `    ${a}:\n      ${ventana(leidos[a])}\n` +
        `    ${b}:\n      ${ventana(leidos[b])}\n\n` +
        '  Los dos documentos declaran por escrito que este bloque es el MISMO, verbatim. Una\n' +
        '  divergencia aquí no es cosmética: describe QUÉ bases tiene el proyecto y cuál es\n' +
        '  producción, y ya divergieron antes. Cambia los DOS en el mismo commit.',
    );
  }
});

test('SCRUM-225 · el mapa nombra las tres bases y distingue cuál es producción', () => {
  // Comprobación de CONTENIDO además de la de igualdad: dos ficheros idénticos y ambos
  // equivocados pasarían el test de arriba. Esto ata el mapa a la fuente de los hostnames.
  const { mapa } = mapaDe('docs/RUNBOOKS.md');
  const guard = fs.readFileSync(path.join(RAIZ, 'scripts', '_db-guard.mjs'), 'utf8');

  const hostProd = (guard.match(/PROD_HOST\s*=\s*'([^']+)'/) || [])[1];
  const hostStaging = (guard.match(/STAGING_HOST\s*=\s*'([^']+)'/) || [])[1];
  assert.ok(
    hostProd && hostStaging,
    '🔴 ESCÁNER CIEGO: no pude leer PROD_HOST/STAGING_HOST de scripts/_db-guard.mjs, que el ' +
      'propio mapa declara como «único sitio que los define en el árbol».',
  );

  assert.ok(
    mapa.includes(hostProd),
    `🔴 el mapa no nombra el host de PRODUCCIÓN (${hostProd}) que define _db-guard.mjs. O el ` +
      'host rotó y el mapa se quedó viejo, o el mapa apunta a otra parte.',
  );
  assert.ok(
    mapa.includes(hostStaging),
    `🔴 el mapa no nombra el host de STAGING (${hostStaging}) que define _db-guard.mjs.`,
  );
  assert.ok(
    /PRODUCCIÓN/.test(mapa) && /STAGING/.test(mapa) && /DESARROLLO/.test(mapa),
    '🔴 el mapa ha dejado de distinguir los tres papeles (STAGING / DESARROLLO / PRODUCCIÓN). ' +
      'Saber cuál es producción es la mitad del valor de este bloque.',
  );
});
